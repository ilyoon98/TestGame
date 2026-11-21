import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

function scenario(formation, loadout, {enemy=false}={}){
  const run=engine();
  run(`start({seed:"class-deck-qa",widths:[1],training:true});
    game.formation=${JSON.stringify(formation)}; game.trainingEnemyActs=${enemy};
    globalThis.qaCards=${JSON.stringify(loadout)};
    for(const [side,ids] of Object.entries(qaCards)){
      ids.forEach((id,slot)=>{if(!setTrainingSkill(side,slot,id)) throw new Error("Cannot equip "+id);});
    }
    if(!beginCombat()) throw new Error("Cannot start equipped QA party");
    for(const skill of game.cooldownBattle.skills){
      if(!qaCards[skill.side]?.includes(skill.id)) skill.readyAt=Infinity;
    }`);
  return run;
}

function next(run,id,side){
  return JSON.parse(run(`
    ((id,side)=>{
      for(let tick=0;tick<500;tick++){
        game.feedback=[];
        const action=advanceAutoBattle();
        if(action?.id===id && (!side || action.actor===side)) return JSON.stringify(game.feedback);
      }
      throw new Error("Awaited skill didn't fire: "+id);
    })(${JSON.stringify(id)},${JSON.stringify(side ?? null)});
  `));
}

test("nun single-target healing restores the limb before covering it",()=>{
  const run=scenario(["companion","player",null],{player:["emergencyStitch","woundCover"]});
  run('game.companion.body.arms.hp=2; game.player.body.legs.hp=1; game.player.body.belly.hp=2;');
  const [healed]=next(run,"emergencyStitch");
  assert.deepEqual([healed.side,healed.targets[0],healed.recovered,healed.restored],["companion","arms",3,true]);
  const [guarded]=next(run,"woundCover");
  assert.deepEqual([guarded.side,guarded.targets[0],guarded.added],["companion","arms",3]);
  assert.equal(run("game.cooldownBattle.tactics.recovery"),undefined);
});

test("combat nun's self-heal powers one candlestick strike",()=>{
  const run=scenario(["player",null,null],{player:["penance","candleCrash"]});
  run("game.player.body.chest.hp=3; game.enemy.body.chest.hp=10; game.enemy.body.chest.max=10;");
  assert.equal(next(run,"penance")[0].side,"player");
  assert.equal(next(run,"candleCrash")[0].dealt,5);
  assert.equal(run('game.cooldownBattle.tactics.selfHealed.has("player")'),false);
});

test("guard blocks an attack and strips guard on the next shove",()=>{
  const run=scenario(["companion","player",null],{companion:["holdShield","shoveBack"]},{enemy:true});
  run('game.cooldownBattle.enemySkills=[["heavy","legs"],["guard","chest"]]; game.enemy.body.chest.guard=3;');
  assert.equal(next(run,"holdShield")[0].added,4);
  assert.equal(next(run,"heavy","enemy")[0].blocked,4);
  const [hit]=next(run,"shoveBack");
  assert.deepEqual([hit.targets[0],hit.removed,hit.dealt],["chest",3,2]);
  assert.equal(run('game.cooldownBattle.tactics.blocked.has("companion")'),false);
});

test("middle guard protects the rear then takes the aimed hit forecast for that ally",()=>{
  const run=scenario(["player","companion","companion3"],{companion:["rearEscort","takeAimHit"]},{enemy:true});
  run('game.cooldownBattle.enemySkills=[["guard","chest"],["aim","arms"]];');
  assert.equal(next(run,"rearEscort")[0].side,"companion3");
  next(run,"takeAimHit");
  assert.equal(run("battleIntent()[0].side"),"companion");
  const [hit]=next(run,"aim","enemy");
  assert.deepEqual([hit.side,hit.targets[0]],["companion","arms"]);
  assert.equal(run("game.companion3.body.arms.hp"),run("game.companion3.body.arms.max"));
  assert.equal(run("game.cooldownBattle.tactics.intercept"),undefined);
});

test("prisoner attacks wounded parts and gets the two-wound payoff",()=>{
  const run=scenario(["companion2","player",null],{companion2:["tightenWound","digDeep"]});
  run('for(const part of ["head","chest"]){Object.assign(game.enemy.body[part],{hp:5,max:10,guard:0});}');
  assert.equal(next(run,"tightenWound")[0].dealt,4);
  assert.equal(next(run,"digDeep")[0].dealt,5);
});

test("prisoner strips the thickest guard and opens an injury in the same part",()=>{
  const run=scenario(["companion2","player",null],{companion2:["twistRing","openGap"]});
  run("game.enemy.body.chest.guard=4;");
  const [stripped]=next(run,"twistRing");
  assert.deepEqual([stripped.targets[0],stripped.removed],["chest",4]);
  const [hit]=next(run,"openGap");
  assert.deepEqual([hit.targets[0],hit.dealt,hit.injury],["chest",4,"injured"]);
  assert.equal(run("game.cooldownBattle.tactics.strippedPart"),undefined);
});

test("rear archer stores one Aim and fires it in one nine-damage arrow",()=>{
  const run=scenario(["player",null,"companion3"],{companion3:["holdBreath","executionArrow"]});
  run("Object.assign(game.enemy.body.chest,{hp:16,max:16});");
  next(run,"holdBreath");
  assert.equal(run('game.cooldownBattle.tactics.aim.get("companion3")'),2);
  const hits=next(run,"executionArrow");
  assert.equal(hits.length,1);
  assert.equal(hits[0].dealt,9);
  assert.equal(run('game.cooldownBattle.tactics.aim.has("companion3")'),false);
});

test("middle archer spreads guard stripping, then shoots arms and legs separately",()=>{
  const run=scenario(["player","companion3",null],{companion3:["scatteringTips","forkShot"]});
  run("game.enemy.body.head.guard=0; game.enemy.body.arms.guard=2; game.enemy.body.chest.guard=2; game.enemy.body.eyes.guard=1;");
  const scatter=next(run,"scatteringTips");
  assert.deepEqual(new Set(scatter.map(event=>event.targets[0])),new Set(["chest","arms"]));
  assert.deepEqual(scatter.map(event=>event.removed),[1,1]);
  assert.equal(run("game.enemy.body.eyes.guard"),1);
  const fork=next(run,"forkShot");
  assert.deepEqual(new Set(fork.map(event=>event.targets[0])),new Set(["arms","legs"]));
  assert.deepEqual(fork.map(event=>event.dealt),[2,2]);
});

test("shaman heals two allies once each and reinforces both with the follow-up knot",()=>{
  const run=scenario(["companion","companion4","player"],{companion4:["runeWard","medicinalKnot"]});
  run("game.companion.body.legs.hp=1; game.player.body.arms.hp=1;");
  const healed=next(run,"runeWard");
  assert.deepEqual(new Set(healed.map(event=>event.side)),new Set(["companion","player"]));
  assert.ok(healed.every(event=>event.recovered>=2));
  const reinforced=next(run,"medicinalKnot");
  assert.equal(reinforced.length,2);
  assert.ok(reinforced.every(event=>event.recovered===1 && event.guards.some(([,amount])=>amount===1)));
});

test("shaman mark and party buff apply together to another ally's first hit",()=>{
  const run=scenario(["player","companion4",null],{player:["heavy"],companion4:["exposeHex","battleKnot"]});
  run("Object.assign(game.enemy.body.chest,{hp:12,max:12});");
  next(run,"battleKnot");
  next(run,"exposeHex");
  const [hit]=next(run,"heavy","player");
  assert.deepEqual([hit.targets[0],hit.dealt,hit.strengthened],["chest",8,1]);
  assert.equal(run("game.enemy.mark"),undefined);
  assert.equal(run("game.cooldownBattle.tactics.empower"),undefined);
});

test("the shaman's weakening survives guard actions and reduces one forecast and attack",()=>{
  const run=scenario(["player","companion4",null],{companion4:["stifleBreath"]},{enemy:true});
  run('game.cooldownBattle.enemySkills=[["guard","head"],["guard","arms"],["heavy","chest"]];');
  next(run,"stifleBreath");
  next(run,"guard","enemy");
  assert.equal(run("game.cooldownBattle.tactics.weaken"),2);
  assert.equal(run('enemyAttackDamage("heavy",power(cards.heavy,game.enemy))'),3);
  assert.equal(next(run,"heavy","enemy")[0].dealt,3);
  assert.equal(run("game.cooldownBattle.tactics.weaken"),undefined);
});

test("a blocked fragment arrow cannot cause its second hit",()=>{
  const run=scenario(["player","companion3",null],{companion3:["fragmentArrow"]});
  run("for(const part of Object.values(game.enemy.body)) part.guard=4;");
  const blocked=next(run,"fragmentArrow");
  assert.equal(blocked.length,1);
  assert.equal(blocked[0].dealt,0);
  run("for(const part of Object.values(game.enemy.body)) part.guard=0;");
  const landed=next(run,"fragmentArrow");
  assert.equal(landed.length,2);
  assert.notEqual(landed[0].targets[0],landed[1].targets[0]);
  assert.deepEqual(landed.map(event=>event.dealt),[3,1]);
});

test("legacy attacks remove only their own target guard and piercing is not permanent",()=>{
  const run=scenario(["player",null,"companion3"],{companion3:["aimedShot"]});
  run(`game.enemy.body.arms.guard=5;
    game.enemy.body.chest.guard=4;
    applyCard("aimedShot",game.companion3,game.enemy,["chest"]);`);
  assert.equal(run("game.feedback.at(-1).blocked"),1);
  assert.equal(run("game.enemy.body.chest.guard"),3);
  run('applyCard("strike",game.player,game.enemy,["chest"]);');
  assert.equal(run("game.feedback.at(-1).dealt"),0);
  assert.equal(run("game.enemy.body.chest.guard"),1);
  run('executePartySkill({id:"barbedArrow",side:"companion3"});');
  const selected=run("game.feedback.at(-1).targets[0]");
  if(selected==="arms") assert.equal(run("game.enemy.body.chest.guard"),1);
  else assert.equal(run("game.enemy.body.arms.guard"),5);
});

test("target selection includes one-use buffs without spending them while scoring alternatives",()=>{
  const run=scenario(["player","companion4",null],{player:["strike"],companion4:["battleKnot"]});
  run(`Object.assign(game.enemy.body.head,{hp:3,guard:0});
    Object.assign(game.enemy.body.chest,{hp:6,guard:0});`);
  // Prime the buff through its normal action, with the striker still charging.
  run('game.cooldownBattle.skills.find(skill=>skill.id==="strike").readyAt=4000;');
  next(run,"battleKnot");
  assert.equal(run('timedAttackTarget("strike",game.player)'),"head");
  assert.equal(run('timedAttackTarget("strike",game.player)'),"head");
  assert.equal(run("game.cooldownBattle.tactics.empower.amount"),1);
  const [hit]=next(run,"strike","player");
  assert.deepEqual([hit.targets[0],hit.dealt,hit.injury],["head",3,"lost"]);
  assert.equal(run("game.cooldownBattle.tactics.empower"),undefined);
});

test("target selection sees a warrior's lethal bonus on a wounded head",()=>{
  const run=scenario(["companion2","companion","player"],{companion2:["chainSwing"]});
  run('Object.assign(game.enemy.body.head,{hp:6,max:14,guard:0});');
  assert.equal(run('timedAttackTarget("chainSwing",game.companion2)'),"head");
  assert.equal(run('availableTraitBonus("warrior",game,"warrior:companion2")'),1);
  const [hit]=next(run,"chainSwing","companion2");
  assert.deepEqual([hit.targets[0],hit.dealt,hit.synergies[0]],["head",6,"warrior"]);
  assert.equal(run('availableTraitBonus("warrior",game,"warrior:companion2")'),0);
});

test("a currently usable new reward gets the first slot while off-position cards stay eligible",()=>{
  const run=engine();
  run(`start({seed:"rank-eligible",widths:[1],training:true});
    game.formation=["player","companion3",null];
    for(const id of rewardPool) game.skillLevels[id]=maxSkillLevel;
    delete game.skillLevels.executionArrow;
    delete game.skillLevels.woundShot;`);
  assert.equal(run("skillRewardOptions()[0]"),"woundShot");
  assert.equal(run('skillRewardOptions().includes("executionArrow")'),true);
  assert.equal(run('skillRewardOptions().join(",")===skillRewardOptions().join(",")'),true);
});

test("card collection, rewards and prep address the same position restrictions",()=>{
  const run=engine();
  run(`start({seed:"rank-badges",widths:[1],training:true}); game.prepSide="companion3";`);
  assert.equal(run(`["nun","guard","awakened","archer","shaman"].map(kind=>rewardPool.filter(id=>cards[id].character===kind).length).join(",")`),"12,12,12,12,12");
  assert.match(run("prepPanel()"),/data-value="forkShot"[^>]*>.*?aria-label="중위만".*?발동 불가/s);
  assert.equal(run('placePartyMember("companion3",1)'),true);
  assert.equal(run('skillBlocked({id:"forkShot",side:"companion3"})'),"");
  assert.equal(run('skillBlocked({id:"executionArrow",side:"companion3"})'),"위치 제한");
  run('game.rewards=["executionArrow","forkShot","woundShot","candleCrash"];');
  const rewards=run("rewardPanel()");
  for(const position of ["후위만","중위만","전위 불가","전위만"]){
    assert.ok(rewards.includes(`aria-label="${position}"`),position);
  }
});

test("all 60 documented class rewards can be equipped and fired on the training clock",()=>{
  const run=engine();
  const cards=JSON.parse(run(`JSON.stringify(rewardPool.filter(id=>cards[id].character)
    .map(id=>({id,name:cards[id].name,kind:cards[id].character,rank:cards[id].ranks?.[0] ?? 0})))`));
  const design=readFileSync(new URL("../CARD_DESIGN.md",import.meta.url),"utf8");
  const documented=[...design.matchAll(/^\| [^|]+ \| \*\*(.*?)\*\*/gm)].map(([,name])=>name);
  assert.deepEqual(cards.map(card=>card.name).sort(),documented.sort());
  const sideByKind={nun:"player",guard:"companion",awakened:"companion2",archer:"companion3",shaman:"companion4"};
  for(const {id,kind,rank} of cards){
    const side=sideByKind[kind];
    const others=["player","companion","companion2"].filter(candidate=>candidate!==side);
    const formation=others.slice(0,2);
    formation.splice(rank,0,side);
    const battle=scenario(formation,{[side]:[id]});
    battle(`
      for(const key of partySides()){
        game[key].body.arms.hp=2;
        game[key].body.legs.hp=2;
      }
      if(${JSON.stringify(id)}==="woundCover"){
        applyHealing("aid",game.player,game.player,"arms",4,game);
      }`);
    const events=next(battle,id,side);
    assert.ok(events.some(event=>event.card===id),id);
  }
});
