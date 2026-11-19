import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("the cooldown battle finishes automatically and waits for the reward choice",()=>{
  const run=engine();
  assert.equal(run("game.distance"),5);
  run("render=()=>scheduleAutoBattle(); scheduleAutoBattle();");
  let ticks=0;
  while(run.tick()) assert.ok(++ticks<80,"automatic combat must terminate");
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
  assert.deepEqual([...opening.matchAll(/data-skill="([^"]+)"/g)].map(match=>match[1]),["guard","heavy","strike"]);
  assert.equal((opening.match(/<progress /g)||[]).length,3);
  assert.doesNotMatch(opening,/class="hand /);
  run("enterArea('duct'); beginCombat(); renderScreen();");
  const next=run("document.querySelector('#stage').innerHTML");
  assert.match(next,/class="skill-loadout"/);
  assert.equal((next.match(/<progress /g)||[]).length,3);
  assert.doesNotMatch(next,/data-action="(?:end|card)"/);
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

test("automatic combat runs through varied routes, loadouts and companions without invalid state",t=>{
  let wins=0, losses=0;
  for(let seed=1;seed<=45;seed++){
    const run=engine(seed);
    run(`globalThis.actions=0; globalThis.path=${seed%3};
      while(!['won','lost'].includes(game.phase) && actions<1000){
        if(game.phase==='prep'){
          const learned=Object.keys(game.skillLevels).find(id=>!starterSkills.includes(id) && !game.loadout.includes(id) && cards[id].type==='attack');
          if(learned){
            toggleEquippedSkill(game.loadout[1]);
            toggleEquippedSkill(learned);
          }
          beginCombat();
        }else if(game.phase==='combat'){advanceAutoBattle(); game.feedback=[]; actions++;}
        else if(game.phase==='reward') chooseReward(game.rewards[${seed%3}]);
        else {
          if(game.pendingCompanion) recruitCompanion(game.pendingCompanion);
          if(game.area==='corridor'){
            const patient=quickHealTarget();
            if(patient) treatAtStairs(patient.target,patient.side);
          }
          const next=areas[game.area].next;
          moveTo(game.area==='threshold'?next[path]:next[0]);
        }
        if(!Number.isFinite(game.distance) || !Number.isFinite(game.combatTime)) throw new Error('invalid resources');
        for(const side of [...partySides(),'enemy']){
          const actor=game[side];
          if(actor.hp<0 || actor.hp>actor.maxHp) throw new Error('invalid HP');
          for(const part of Object.values(actor.body)) if(part.hp<0 || part.hp>part.max || part.guard<0) throw new Error('invalid body state');
        }
      }
    `);
    assert.ok(run("actions<1000"));
    const outcome=run("game.phase");
    if(outcome==="won") wins++;
    else if(outcome==="lost") losses++;
    else assert.fail(`seed ${seed} stalled in ${outcome}`);
  }
  assert.equal(wins+losses,45);
  assert.ok(wins>0,"automatic play must be able to escape");
  t.diagnostic(`${wins} escapes, ${losses} losses across 45 deterministic complete runs`);
});
