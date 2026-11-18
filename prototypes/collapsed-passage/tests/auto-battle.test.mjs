import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("a battle finishes automatically and waits for the reward choice",()=>{
  const run=engine();
  run("scheduleAutoBattle();");
  let ticks=0;
  while(run.tick()) assert.ok(++ticks<80,"automatic combat must terminate");
  assert.equal(run("game.phase"),"reward");
  assert.equal(run("game.turns>0"),true);
  assert.equal(run("game.acquired.length"),0);
  assert.equal(run.timers.size,0);
  assert.equal(run("game.area"),"threshold");
});

test("the planner is pure and chooses a finishing blow over unnecessary healing",()=>{
  const run=engine();
  run("game.enemy.hp=1; game.enemy.body.head.hp=1; game.enemy.body.head.guard=0; game.player.hp=2; game.player.body.legs.hp=1; game.hand=['strike','dressing']; globalThis.before=JSON.stringify(game);");
  assert.equal(run("chooseAutoAction().id"),"strike");
  assert.equal(run("JSON.stringify(game)===before"),true);
  run("advanceAutoBattle();");
  assert.equal(run("game.phase"),"reward");
});

test("a visible lethal head strike is blocked and wounds are treated without target input",()=>{
  const run=engine();
  run("game.hand=['shelter','strike']; game.player.body.head.hp=2; game.enemy.hp=30; game.plan=[{id:'heavy',side:'player',targets:['head']}];");
  assert.equal(run("chooseAutoAction().id"),"shelter");
  assert.equal(run("chooseAutoAction().targets.join(',')"),"head");
  run("advanceAutoBattle();");
  assert.equal(run("game.player.body.head.guard"),6);
  run("game.hand=['dressing']; game.plan=[]; game.player.hp=2; game.player.body.head.hp=1; advanceAutoBattle();");
  assert.equal(run("game.player.body.head.hp"),5);
  assert.equal(run("game.player.hp"),6);
});

test("blind automatic combat cannot inspect a hidden enemy plan",()=>{
  const run=engine();
  run("game.player.body.eyes.hp=2; game.hand=['guard','strike']; game.plan=[{id:'heavy',side:'player',targets:['head']}]; globalThis.first=JSON.stringify(chooseAutoAction()); game.plan=[{id:'heavy',side:'player',targets:['legs']}];");
  assert.equal(run("JSON.stringify(chooseAutoAction())===first"),true);
});

test("unusable cards and lost body parts do not stall automatic turns",()=>{
  const run=engine();
  run("game.hand=['heavy','aid']; game.player.body.arms.hp=0; game.player.body.legs.hp=0; game.plan=[];");
  assert.equal(run("chooseAutoAction()"),null);
  assert.equal(run("advanceAutoBattle().endedTurn"),true);
  assert.equal(run("game.round"),2);
  assert.equal(run("game.distance"),8);
  run("game.hand=['rethink','heavy']; game.stamina=0; advanceAutoBattle();");
  assert.equal(run("game.rethought"),true);
  assert.equal(run("game.selected"),null);
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
  run("toggleAutoPause(); cycleAutoSpeed();");
  assert.equal(run.timers.size,1);
  assert.equal(run.timers.values().next().value.delay,275);
  run("document.hidden=true; document.querySelector('document').listeners.visibilitychange();");
  assert.equal(run.timers.size,0);
  run("document.hidden=false; document.querySelector('document').listeners.visibilitychange();");
  const oldRun=run.timers.values().next().value.callback;
  run("start();");
  assert.equal(run.timers.size,0);
  run("scheduleAutoBattle(); globalThis.newTimer=autoTimer;");
  oldRun();
  assert.equal(run("game.enemy.hp"),8);
  assert.equal(run("autoTimer===newTimer"),true);
  assert.equal(run.timers.size,1);
  assert.equal(run("autoPaused"),false);
});

test("the battle panel is for watching and exposes no manual turn or card controls",()=>{
  const run=engine();
  assert.equal(run("handPanel(false).includes('자동 전투 진행 중')"),true);
  assert.equal(run("handPanel(false).includes('data-action=\"end\"')"),false);
  assert.equal(run("handPanel(false).includes('data-action=\"card\"')"),false);
});

test("automatic combat runs through varied routes, decks and companion choices without invalid state",t=>{
  let wins=0, losses=0;
  for(let seed=1;seed<=45;seed++){
    const run=engine(seed);
    run(`globalThis.actions=0; globalThis.path=${seed%3};
      while(!['won','lost'].includes(game.phase) && actions<200){
        if(game.phase==='combat'){advanceAutoBattle(); game.feedback=[]; actions++;}
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
        if(game.stamina<0 || !Number.isFinite(game.distance)) throw new Error('invalid resources');
        for(const actor of [game.player,game.enemy,game.companion].filter(Boolean)){
          if(actor.hp<0 || actor.hp>actor.maxHp) throw new Error('invalid HP');
          for(const part of Object.values(actor.body)) if(part.hp<0 || part.hp>part.max || part.guard<0) throw new Error('invalid body state');
        }
      }
    `);
    assert.ok(run("actions<200"));
    const outcome=run("game.phase");
    if(outcome==="won") wins++;
    else if(outcome==="lost") losses++;
    else assert.fail(`seed ${seed} stalled in ${outcome}`);
  }
  assert.equal(wins+losses,45);
  assert.ok(wins>0,"automatic play must be able to escape");
  t.diagnostic(`${wins} escapes, ${losses} losses across 45 deterministic complete runs`);
});
