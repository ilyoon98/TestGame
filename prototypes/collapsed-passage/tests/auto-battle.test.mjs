import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";
import {playFirstStage} from "./helpers/first-stage-policy.mjs";

test("the cooldown battle finishes automatically and waits for recruitment and then the reward",()=>{
  const run=engine();
  assert.equal(run("game.distance"),5);
  run("render=()=>scheduleAutoBattle(); scheduleAutoBattle();");
  let ticks=0;
  while(run.tick()) assert.ok(++ticks<80,"automatic combat must terminate");
  assert.equal(run("game.phase"),"route");
  assert.equal(run("game.pendingCompanion"),"guard");
  assert.equal(run("game.rewards.length"),0);
  assert.equal(run("declineCompanion()"),true);
  assert.equal(run("game.phase"),"reward");
  assert.equal(run("game.combatTime"),6000);
  assert.equal(run("game.distance"),3);
  assert.equal(run.timers.size,0);
  assert.equal(run("game.area"),"threshold");
});

test("repeated renders, pause, speed, hidden tabs and restart cannot duplicate or leak timers",()=>{
  const run=engine();
  run("scheduleAutoBattle(); scheduleAutoBattle();");
  assert.equal(run.timers.size,1);
  const stale=run.timers.values().next().value.callback;
  run("toggleAutoPause();");
  assert.equal(run.timers.size,0);
  stale();
  assert.equal(run("game.enemy.hp"),8);
  assert.equal(run("game.combatTime"),0);
  run("toggleAutoPause(); cycleAutoSpeed();");
  assert.equal(run.timers.size,1);
  assert.equal(run.timers.values().next().value.delay,50);
  assert.equal(run.tick(),true);
  assert.equal(run("game.combatTime"),100);
  run("document.hidden=true; document.querySelector('document').listeners.visibilitychange();");
  assert.equal(run.timers.size,0);
  run("document.hidden=false; document.querySelector('document').listeners.visibilitychange();");
  const oldRun=run.timers.values().next().value.callback;
  run("start(); beginCombat();");
  assert.equal(run.timers.size,0);
  assert.equal(run("game.distance"),5);
  run("scheduleAutoBattle(); globalThis.newTimer=autoTimer;");
  oldRun();
  assert.equal(run("game.enemy.hp"),8);
  assert.equal(run("game.combatTime"),0);
  assert.equal(run("autoTimer===newTimer"),true);
  assert.equal(run.timers.size,1);
  assert.equal(run("autoPaused"),false);
});

test("opening and later fights have three cooldown gauges",()=>{
  const run=engine();
  run("layoutCombatHud=()=>{}; renderScreen();");
  const opening=run("document.querySelector('#stage').innerHTML");
  assert.match(opening,/class="skill-loadout"/);
  assert.doesNotMatch(opening,/class="combat-action/);
  assert.deepEqual([...opening.matchAll(/data-skill="([^"]+)"/g)].map(match=>match[1]),["guard","heavy","strike"]);
  assert.deepEqual([...opening.matchAll(/class="skill-slot-art" src="art\/skills\/emotes\/([^"]+)\.webp"/g)].map(match=>match[1]),["guard","heavy","strike"]);
  assert.equal((opening.match(/<progress /g)||[]).length,3);
  assert.doesNotMatch(opening,/class="hand /);
  run("enterArea('duct'); beginCombat(); renderScreen();");
  const next=run("document.querySelector('#stage').innerHTML");
  assert.match(next,/class="skill-loadout"/);
  assert.equal((next.match(/<progress /g)||[]).length,3);
  assert.doesNotMatch(next,/data-action="(?:end|card)"/);
});

test("the minimap holds the battle clock independently of the player's pause",()=>{
  const run=engine();
  run("scheduleAutoBattle();");
  assert.equal(run.timers.size,1);
  run("minimapDialog.open=true; scheduleAutoBattle();");
  assert.equal(run.timers.size,0);
  assert.equal(run("game.combatTime"),0);
  run("minimapDialog.open=false; minimapDialog.listeners.close();");
  assert.equal(run.timers.size,1);
  assert.equal(run.tick(),true);
  assert.equal(run("game.combatTime"),100);
  run("autoPaused=true; minimapDialog.open=true; scheduleAutoBattle(); minimapDialog.open=false; minimapDialog.listeners.close();");
  assert.equal(run.timers.size,0);
  assert.equal(run("autoPaused"),true);
});

test("simultaneous skills resolve in the same order regardless of their display slots",()=>{
  const run=engine();
  run(`
    game.enemy.hp=game.enemy.maxHp=20;
    game.cooldownBattle.skills.reverse();
    while(game.combatTime<6000) advanceAutoBattle();
  `);
  assert.equal(run("game.distance"),3);
  assert.equal(run("advanceAutoBattle().id"),"guard");
  assert.equal(run("advanceAutoBattle().id"),"heavy");
  assert.equal(run("advanceAutoBattle().id"),"strike");
  assert.equal(run("game.combatTime"),6000);
  assert.equal(run("game.player.hp"),26);
  assert.equal(run("game.cooldownBattle.skills.map(skill=>skill.readyAt).join(',')"),"8000,12000,9000");
});

test("a lost arm disables strong attacks and the pursuit clock still ends combat",()=>{
  const run=engine();
  run(`
    game.player.body.arms.hp=0;
    game.distance=1;
    game.cooldownBattle.skills[1].readyAt=0;
    game.cooldownBattle.skills[2].readyAt=0;
  `);
  assert.match(run("skillPanel()"),/data-skill="heavy" data-ready="false" data-blocked="true"/);
  assert.equal(run("advanceAutoBattle().id"),"strike");
  assert.equal(run("game.combatTime"),0);
  run("while(game.phase==='combat') advanceAutoBattle();");
  assert.equal(run("game.phase"),"lost");
  assert.equal(run("game.combatTime"),3000);
  assert.equal(run("game.distance"),0);
  assert.match(run("game.reason"),/사형수에게 따라잡혔어요/);
});

test("the Bellboy blocks ordinary attacks and opens the gate between slams and bells",()=>{
  const run=engine();
  run(`enterArea("lift"); beginCombat(); game.distance=20;
    game.cooldownBattle.skills=[];
    executePartySkill({id:"strike",side:"player"});`);
  assert.equal(run("bellboyPhase()"),"closed");
  assert.equal(run("game.enemy.hp"),23);
  assert.equal(run("game.enemy.body.head.hp"),21);
  assert.equal(run("game.enemy.body.head.guard"),2);
  assert.equal(run("game.feedback.at(-1).gateBlock"),true);
  run(`applyCard("break",game.player,game.enemy,["head"]);`);
  assert.equal(run("game.enemy.body.head.guard"),2);
  run(`applyCard("pierce",game.player,game.enemy,["belly"]);`);
  assert.equal(run("game.feedback.at(-1).targets[0]"),"head");
  assert.ok(run("game.enemy.hp < game.enemy.maxHp"));
  assert.equal(run("game.enemy.body.belly.hp"),5);

  run(`while(game.cooldownBattle.elapsed<1400) advanceAutoBattle();`);
  assert.equal(run("bellboyPhase()"),"closed");
  run(`advanceAutoBattle();`);
  assert.equal(run("bellboyPhase()"),"bell");
  assert.match(run("bodyPanel('enemy',battleIntent(),'healthy')"),/호출벨 · 강타 강화/);
  assert.match(run("intentPanel(battleIntent(),'healthy')"),/<strong>7<\/strong>/);
  run(`while(bellboyPhase()!=="staggered") advanceAutoBattle();`);
  assert.equal(run("game.feedback.at(-1).opensGate"),true);
  assert.equal(run("game.feedback.at(-1).targets[0]"),"chest");
  assert.equal(run("game.feedback.at(-1).dealt"),7);
  assert.equal(run("game.cooldownBattle.elapsed"),3500);
  assert.match(run("bodyPanel('enemy',battleIntent(),'healthy')"),/aria-label="철문 열림"/);
  run(`applyCard("strike",game.player,game.enemy,["belly"]);`);
  assert.equal(run("game.enemy.body.belly.hp"),3);
  run(`while(game.cooldownBattle.elapsed<4900) advanceAutoBattle();`);
  assert.equal(run("bellboyPhase()"),"staggered");
  run(`advanceAutoBattle();`);
  assert.equal(run("bellboyPhase()"),"bell");
  run(`applyCard("strike",game.player,game.enemy,["belly"]);`);
  assert.equal(run("game.enemy.body.belly.hp"),3);
  assert.equal(run("game.feedback.at(-1).gateBlock"),true);
});

test("automatic combat runs through varied routes, loadouts and companions without invalid state",t=>{
  let wins=0;
  for(let seed=1;seed<=45;seed++){
    const outcome=playFirstStage(engine(seed),seed);
    assert.ok(outcome.actions<1000,`seed ${seed} exceeded the action budget`);
    if(outcome.won) wins++;
  }
  assert.ok(wins>0,"automatic play must be able to escape");
  t.diagnostic(`${wins} escapes, ${45-wins} losses across 45 deterministic complete runs`);
});
