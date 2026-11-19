import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("preparation toggles known skills and requires exactly three equipped skills",()=>{
  const run=engine(1,{prep:true});
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("game.distance"),5);
  assert.equal(run("advanceAutoBattle()"),null);
  assert.equal(run("toggleEquippedSkill('crush')"),false);
  run("renderScreen();");
  const prep=run("document.querySelector('#stage').innerHTML");
  assert.match(prep,/전투 준비/);
  assert.match(prep,/수녀 부위별 내구도/);
  assert.equal((prep.match(/class="part-drawing"/g)||[]).length,6);
  assert.match(prep,/data-formation-side="player"/);
  assert.deepEqual([...prep.matchAll(/class="formation-slot[^"]*" data-rank="(\d)"/g)].map(match=>match[1]),["2","1","0"]);
  assert.match(prep,/class="formation-portrait"><img src="art\/characters\/nun-sd.png"/);
  assert.match(prep,/aria-describedby="prep-tip-guard".*class="skill-term"><svg.*<strong>방어<\/strong>.*id="prep-tip-guard" role="tooltip".*가드로 아군 부위를 보호/s);
  assert.equal((prep.match(/aria-pressed="true"/g)||[]).length,3);
  run("game.skillLevels.force=1;");
  assert.equal(run("toggleEquippedSkill('force')"),false);
  assert.equal(run("toggleEquippedSkill('heavy')"),true);
  assert.equal(run("beginCombat()"),false);
  assert.equal(run("qaAvailable('win')"),false);
  run("renderScreen();");
  const partial=run("document.querySelector('#stage').innerHTML");
  assert.match(partial,/장착 2\/3/);
  assert.match(partial,/data-action="begin-combat" disabled/);
  assert.match(partial,/data-value="force"[^>]*aria-pressed="false"/);
  assert.equal(run("toggleEquippedSkill('force')"),true);
  assert.equal(run("game.combatTime"),0);
  assert.equal(run("beginCombat()"),true);
  assert.equal(run("beginCombat()"),false);
  assert.equal(run("game.cooldownBattle.skills.map(skill=>skill.id).join(',')"),"guard,force,strike");
  assert.equal(run("toggleEquippedSkill('heavy')"),false);
});

test("victory offers both a new skill and an upgrade and accepts one choice",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat();");
  assert.equal(run("game.phase"),"reward");
  assert.equal(run("new Set(game.rewards).size"),3);
  assert.equal(run("game.rewards.some(id=>!game.skillLevels[id])"),true);
  assert.equal(run("game.rewards.some(id=>game.skillLevels[id])"),true);
  assert.match(run("rewardPanel()"),/reward-kind learn[^>]*><svg/);
  assert.match(run("rewardPanel()"),/reward-kind upgrade[^>]*><svg/);
  assert.match(run("rewardPanel()"),/class="skill-card-art"/);
  assert.match(run("const rewards=game.rewards; game.rewards=['pierce']; const piercing=rewardPanel(); game.rewards=rewards; piercing;"),/class="skill-term"><svg.*<strong>공격<\/strong>.*class="skill-term"><svg.*<strong>관통<\/strong>.*id="reward-tip-pierce" role="tooltip".*적의 가드를 표시된 수치만큼 무시/s);
  run("moveTo('duct');");
  assert.equal(run("game.area"),"threshold");
  run("globalThis.learned=game.rewards.find(id=>!game.skillLevels[id]); globalThis.other=game.rewards.find(id=>id!==learned);");
  assert.equal(run("chooseReward(learned)"),true);
  assert.equal(run("chooseReward(other)"),false);
  assert.equal(run("game.skillLevels[learned]"),1);
  assert.equal(run("game.loadout.includes(learned)"),false);
  run("declineCompanion(); moveTo('duct');");
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("toggleEquippedSkill('heavy') && toggleEquippedSkill(learned)"),true);
  run("beginCombat();");
  assert.equal(run("game.cooldownBattle.skills[1].id"),run("learned"));
});

test("an upgrade lowers actual cooldown without unequipping a skill",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); globalThis.improved=game.rewards.find(id=>game.skillLevels[id]); globalThis.base=skillCooldown(improved);");
  assert.equal(run("chooseReward(improved)"),true);
  assert.equal(run("skillLevel(improved)"),2);
  assert.equal(run("skillCooldown(improved)"),run("base-400"));
  assert.equal(run("game.loadout.join(',')"),"guard,heavy,strike");
  run("declineCompanion(); moveTo('duct'); beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.find(skill=>skill.id===improved).cooldown"),run("base-400"));
});

test("reward selection respects the level cap and restart clears progression",()=>{
  const run=engine();
  run("for(const id of availableSkills()) game.skillLevels[id]=maxSkillLevel; game.enemy.hp=0; finishCombat();");
  assert.equal(run("game.rewards.every(id=>!game.skillLevels[id])"),true);
  run("chooseReward(game.rewards[0]); start();");
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("Object.keys(game.skillLevels).length"),3);
  assert.equal(run("availableSkills().every(id=>skillLevel(id)===1)"),true);
  assert.equal(run("game.combatTime"),0);
});

test("a companion adds two moves which fire from that companion and stop on death",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); chooseReward(null); recruitCompanion('guard'); moveTo('duct');");
  assert.equal(run("availableSkills('companion').includes('baton')"),true);
  assert.equal(run("availableSkills('player').includes('baton')"),false);
  assert.equal(run("game.companion.loadout.join(',')"),"baton,escort");
  run("beginCombat(); globalThis.baton=game.cooldownBattle.skills.find(skill=>skill.id==='baton'); baton.readyAt=0;");
  assert.equal(run("game.cooldownBattle.skills.length"),5);
  assert.equal(run("advanceAutoBattle().actor"),"companion");
  assert.equal(run("game.feedback.at(-1).from"),"companion");
  run("hit(game.enemy,game.companion,'head',99,{id:'heavy'},game);");
  assert.equal(run("partySides().join(',')"),"player");
  assert.equal(run("availableSkills('companion').includes('baton')"),false);
  assert.equal(run("game.loadout.join(',')"),"guard,heavy,strike");
  assert.equal(run("skillBlocked(baton)"),"동료 이탈");
  run("game.enemy.hp=0; finishCombat(); chooseReward(null); declineCompanion(); moveTo('lift'); beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.some(skill=>skill.id==='baton')"),false);
});

test("recruiting a second companion preserves the first loadout and adds a third position",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); chooseReward(null); recruitCompanion('guard'); moveTo('infirmary');");
  assert.equal(run("game.formation.join(',')"),"companion,,player");
  assert.equal(run("toggleEquippedSkill('prayer','companion')"),false);
  assert.equal(run("toggleEquippedSkill('escort','companion')"),true);
  assert.equal(run("toggleEquippedSkill('guard','companion')"),false);
  assert.equal(run("beginCombat()"),false);
  run("toggleEquippedSkill('guard'); toggleEquippedSkill('prayer'); toggleEquippedSkill('guard','companion'); beginCombat();");
  run("game.enemy.hp=0; finishCombat(); chooseReward(null);");
  assert.equal(run("recruitCompanion('awakened')"),true);
  run("declineCompanion(); moveTo('lift');");
  assert.equal(run("game.formation.join(',')"),"companion,companion2,player");
  assert.equal(run("game.companion.loadout.join(',')"),"baton,guard");
  assert.equal(run("game.companion2.loadout.join(',')"),"irons,hook");
  assert.equal(run("placePartyMember('player',1)"),true);
  assert.equal(run("game.formation.join(',')"),"companion,player,companion2");
  assert.equal(run("skillBlocked({id:'irons',side:'companion2'})"),"위치 제한");
  assert.equal(run("availableSkills('companion2').includes('aimedShot')"),false);
  run("game.companion2.weapon='bow'; toggleEquippedSkill('irons','companion2');");
  assert.equal(run("toggleEquippedSkill('aimedShot','companion2')"),true);
  assert.equal(run("skillBlocked({id:'aimedShot',side:'companion2'})"),"");
  run("placePartyMember('companion2',1);");
  assert.equal(run("skillBlocked({id:'aimedShot',side:'companion2'})"),"위치 제한");
  run("placePartyMember('companion2',2); beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.length"),7);
  assert.equal(run("enemyAttackSide('strike')"),"companion");
  assert.equal(run("enemyAttackSide('aim')"),"companion2");
  assert.equal(run("placePartyMember('player',0)"),false);
  run("hit(game.enemy,game.companion,'head',99,{id:'heavy'},game);");
  assert.equal(run("enemyAttackSide('strike')"),"player");
  assert.equal(run("partySides().join(',')"),"player,companion2");
});

test("a charged heal waits for a wound and takes effect on the injured target",()=>{
  const run=engine(1,{prep:true});
  run("game.skillLevels.dressing=1; toggleEquippedSkill('guard'); toggleEquippedSkill('dressing'); beginCombat(); game.cooldownBattle.skills[0].readyAt=0;");
  assert.equal(run("readyTimedSkill(game.cooldownBattle)"),undefined);
  run("game.player.body.legs.hp=3; game.player.hp=24;");
  assert.equal(run("advanceAutoBattle().id"),"dressing");
  assert.equal(run("game.player.body.legs.hp"),7);
  assert.equal(run("game.player.hp"),28);
});

test("recruitment previews traits and reserve swaps keep only three active loadouts",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat(); chooseReward(null); recruitCompanion('guard'); moveTo('infirmary'); beginCombat();");
  run("game.enemy.hp=0; finishCombat(); chooseReward(null);");
  assert.match(run("companionEncounterPanel()"),/전사 1→2/);
  run("recruitCompanion('awakened');");
  assert.match(run("companionEncounterPanel()"),/탈출 중인 간수 교대.*수감자 1→2.*마법사 1→2/s);
  assert.match(run("companionEncounterPanel()"),/영입 · 대기/);
  assert.equal(run("canMoveTo('lift')"),false);
  run("recruitCompanion('shaman'); moveTo('lift');");
  assert.equal(run("reserveSides().join(',')"),"companion3");
  assert.match(run("prepPanel()"),/전사 2\/2/);
  assert.doesNotMatch(run("prepPanel()"),/마법사 2\/2/);
  assert.equal(run("placePartyMember('companion3',2)"),false);
  assert.equal(run("placePartyMember('companion3',0)"),true);
  assert.equal(run("reserveSides().join(',')"),"companion");
  assert.equal(run("game.companion.loadout.join(',')"),"baton,escort");
  assert.match(run("prepPanel()"),/수감자 2\/2.*마법사 2\/2/s);
  run("beginCombat();");
  assert.equal(run("game.cooldownBattle.skills.length"),7);
  assert.equal(run("game.cooldownBattle.skills.some(skill=>skill.id==='baton')"),false);
  assert.equal(run("game.cooldownBattle.traits.has('warrior')"),false);
});

test("archer recruits to the rear and guard and warrior grant their first eligible bonus",()=>{
  for(const archer of [true,false]){
    const run=engine();
    run(`game.enemy.hp=0; finishCombat(); chooseReward(null); recruitCompanion('guard'); moveTo('${archer?"duct":"infirmary"}'); beginCombat();
      game.enemy.hp=0; finishCombat(); chooseReward(null);`);
    assert.match(run("companionEncounterPanel()"),archer?/간수 1→2/:/전사 1→2/);
    run(archer?"recruitCompanion('archer');":"recruitCompanion('awakened'); declineCompanion();");
    run("moveTo('lift'); beginCombat();");
    if(archer){
      assert.equal(run("game.formation.join(',')"),"companion,player,companion2");
      assert.equal(run("game.companion2.loadout.join(',')"),"aimedShot,snapShot");
      run("applyCard('guard',game.player,game.enemy,['head'],game,game.companion);");
      assert.equal(run("game.feedback.at(-1).added"),5);
      run("applyCard('guard',game.player,game.enemy,['head'],game,game.companion);");
      assert.equal(run("game.feedback.at(-1).added"),3);
      run("clearDefense(game.companion); game.cooldownBattle.usedTraits.clear(); game.feedback=[]; while(game.phase==='combat' && !game.feedback.some(event=>event.from==='enemy')) advanceAutoBattle();");
      assert.equal(run("game.feedback.at(-1).from"),"enemy");
      assert.equal(run("game.feedback.at(-1).dealt"),0);
    }else{
      run("game.enemy.body.chest.hp=3; game.enemy.body.chest.guard=0; applyCard('strike',game.companion,game.enemy,['chest']);");
      assert.equal(run("game.feedback.at(-1).dealt"),3);
      run("game.enemy.body.chest.hp=3; applyCard('strike',game.companion,game.enemy,['chest']);");
      assert.equal(run("game.feedback.at(-1).dealt"),2);
      run("game.enemy.body.chest.hp=3; applyCard('strike',game.companion2,game.enemy,['chest']);");
      assert.equal(run("game.feedback.at(-1).dealt"),3);
    }
  }
});

test("the same prisoner and mage lineup can battle with or without trait bonuses",()=>{
  for(const enabled of [true,false]){
    const run=engine();
    run(`game.synergiesEnabled=${enabled}; game.enemy.hp=0; finishCombat(); chooseReward(null);
      declineCompanion(); moveTo('infirmary'); beginCombat(); game.enemy.hp=0; finishCombat();
      chooseReward(null); recruitCompanion('awakened'); recruitCompanion('shaman'); moveTo('lift'); beginCombat();`);
    assert.equal(run("game.cooldownBattle.traits.size"),enabled?2:0);
    run("game.enemy.body.chest.guard=2; applyCard('unseal',game.companion2,game.enemy,['chest']);");
    assert.equal(run("game.feedback.at(-1).dealt"),enabled?2:1);
    run("game.enemy.body.chest.guard=2; applyCard('unseal',game.companion2,game.enemy,['chest']);");
    assert.equal(run("game.feedback.at(-1).dealt"),1);
    run("game.player.body.legs.hp=2; applyCard('mending',game.companion2,game.enemy,['legs'],game,game.player);");
    assert.equal(run("game.feedback.at(-1).recovered"),enabled?3:2);
    run("applyCard('mending',game.companion2,game.enemy,['legs'],game,game.player);");
    assert.equal(run("game.feedback.at(-1).recovered"),2);
  }
});

test("no post-victory reward is offered at the exit fight",()=>{
  const run=engine();
  run("enterArea('lift'); beginCombat(); game.enemy.hp=0; finishCombat();");
  assert.equal(run("game.phase"),"route");
  assert.equal(run("game.rewards.length"),0);
  run("moveTo('exit');");
  assert.equal(run("game.phase"),"won");
});
