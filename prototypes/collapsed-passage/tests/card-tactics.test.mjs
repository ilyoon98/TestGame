import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

function training(formation){
  const run=engine();
  run(`start({seed:"card-tactics",widths:[1],training:true}); game.formation=${JSON.stringify(formation)};`);
  return run;
}

test("rest prayer heals a single vital part before other wounds",()=>{
  const run=training(["companion","player","companion3"]);
  run(`setTrainingSkill("player",0,"sharedPrayer"); beginCombat();
    game.companion.body.legs.hp=2;
    game.companion.body.chest.hp=3;
    game.companion3.body.legs.hp=4;
    game.cooldownBattle.skills.find(skill=>skill.id==="sharedPrayer").readyAt=0;`);
  assert.equal(run("advanceAutoBattle().id"),"sharedPrayer");
  assert.equal(run("game.companion.body.legs.hp"),2);
  assert.equal(run("game.companion3.body.legs.hp"),4);
  assert.equal(run("game.companion.body.chest.hp"),6);
  assert.equal(run("game.feedback.map(event=>event.side).join(',')"),"companion");
});

test("rear escort protects the last ally behind its caster and waits without one",()=>{
  const run=training(["companion","player","companion3"]);
  run(`setTrainingSkill("companion",0,"rearEscort"); beginCombat();
    game.cooldownBattle.skills.find(skill=>skill.id==="rearEscort").readyAt=0;`);
  assert.equal(run("advanceAutoBattle().id"),"rearEscort");
  assert.equal(run("game.feedback.at(-1).side"),"companion3");
  assert.equal(run("game.feedback.at(-1).targets.join(',')"),"head,chest");
  assert.equal(run("game.companion3.body.chest.guard"),3);
  assert.equal(run("game.companion.body.chest.guard"),0);
  run('game.formation=["player","companion",null];');
  assert.equal(run('skillBlocked({id:"rearEscort",side:"companion"})'),"후열 아군 없음");
});

test("chain sweep attacks two distinct parts with one activation and respects the closed gate",()=>{
  const run=training(["companion2","player",null]);
  run(`setTrainingSkill("companion2",0,"chainSweep"); beginCombat();
    game.cooldownBattle.skills.find(skill=>skill.id==="chainSweep").readyAt=0;`);
  assert.equal(run("advanceAutoBattle().id"),"chainSweep");
  assert.equal(run("new Set(game.feedback.map(event=>event.targets[0])).size"),2);
  assert.equal(run("game.feedback.every(event=>event.card==='chainSweep' && event.dealt===3)"),true);
  assert.equal(run("game.cooldownBattle.skills.find(skill=>skill.id==='chainSweep').readyAt"),5100);

  run('game.feedback=[]; enterArea("lift"); beginCombat(); executePartySkill({id:"chainSweep",side:"companion2"});');
  assert.equal(run("game.feedback.length"),1);
  assert.equal(run("game.feedback[0].gateBlock"),true);
});

test("wound shot scores and hits an already injured part using its damage bonus",()=>{
  const run=training(["player",null,"companion3"]);
  run(`setTrainingSkill("companion3",0,"woundShot"); beginCombat();
    game.enemy.body.chest.max=10; game.enemy.body.chest.hp=5;
    game.cooldownBattle.skills.find(skill=>skill.id==="woundShot").readyAt=0;`);
  assert.equal(run("advanceAutoBattle().id"),"woundShot");
  assert.equal(run("game.feedback.at(-1).targets[0]"),"chest");
  assert.equal(run("game.feedback.at(-1).dealt"),4);
  run('applyCard("woundShot",game.companion3,game.enemy,["arms"]);');
  assert.equal(run("game.feedback.at(-1).dealt"),2);
});

test("exposure lasts until another ally damages the marked part",()=>{
  const run=training(["player","companion4",null]);
  run(`beginCombat();
    applyCard("exposeHex",game.companion4,game.enemy,["chest"]); `);
  assert.equal(run("game.enemy.mark.target"),"chest");
  assert.match(run('bodyPanel("enemy",[],"healthy")'),/가슴 표식 · 다른 아군 첫 적중 피해 \+2/);
  run(`applyCard("strike",game.player,game.enemy,["legs"]);
    game.enemy.body.chest.guard=2;
    applyCard("strike",game.player,game.enemy,["chest"]);`);
  assert.equal(run("game.feedback.at(-1).dealt"),0);
  assert.equal(run("game.enemy.mark.target"),"chest");
  run('applyCard("exposeHex",game.companion4,game.enemy,["chest"]);');
  assert.equal(run("game.feedback.at(-1).dealt"),1);
  assert.equal(run("game.enemy.mark.target"),"chest");
  assert.equal(run('timedAttackTarget("strike",game.player)'),"chest");
  run('applyCard("strike",game.player,game.enemy,["chest"]);');
  assert.equal(run("game.feedback.at(-1).dealt"),4);
  assert.equal(run("game.enemy.mark"),undefined);
  assert.doesNotMatch(run('bodyPanel("enemy",[],"healthy")'),/class="actor-mark"/);
});
