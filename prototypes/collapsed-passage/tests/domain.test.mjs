// 도메인 모듈을 DOM이나 vm 없이 직접 불러와 검사한다.
import assert from "node:assert/strict";
import {test} from "node:test";
import {createGameData} from "../src/data/index.js";
import {createGameServices} from "../src/application/createGameServices.js";
import {AutoBattleRunner} from "../src/application/AutoBattleRunner.js";
import {BodyPart} from "../src/domain/body/BodyPart.js";
import {BellboyGate, NoGate} from "../src/domain/combat/gates.js";
import {CardEffect} from "../src/domain/cards/CardEffect.js";

function setup(seed = "DOMAIN"){
  const data = createGameData();
  let areas = data.standardAreas;
  const services = createGameServices(data, {areas: () => areas});
  const state = services.runs.create(null, seed);
  services.journey.enterArea(state, "threshold");
  return {data, services, state, setAreas: next => { areas = next; }};
}

function beginFight({services, state}){
  state.phase = "combat";
  services.battle.start(state, services.party.sides(state));
}

class ManualScheduler {
  pending = new Map();
  #next = 0;
  after(ms, callback){ const id = ++this.#next; this.pending.set(id, {ms, callback}); return id; }
  cancel(id){ this.pending.delete(id); }
  runNext(){ const [id, {callback}] = this.pending.entries().next().value; this.pending.delete(id); callback(); }
}

test("a body part keeps the larger guard, never drops below zero and reports its condition", () => {
  const part = new BodyPart(6);
  part.raiseGuard(3);
  part.raiseGuard(2);
  assert.equal(part.guard, 3);
  part.guard -= 10;
  assert.equal(part.guard, 0);
  part.hp = 3;
  assert.equal(part.condition, "injured");
  assert.equal(part.restoreDurability(10), 3);
  assert.equal(part.condition, "healthy");
  part.hp = -4;
  assert.equal(part.condition, "lost");
  assert.deepEqual(JSON.parse(JSON.stringify(part)), {hp: 0, max: 6, guard: 0});
});

test("a training dummy can stand in for any enemy without ever going down", () => {
  const {services} = setup();
  const dummy = services.fighters.enemy("janitor", {training: true});
  dummy.body.head.hp = 0;
  dummy.loseVitality(99);
  assert.equal(dummy.isDown(), false);
  assert.equal(dummy.reviveIfHeadLost(), true);
  assert.equal(dummy.body.head.hp, dummy.body.head.max);
  const ordinary = services.fighters.enemy("janitor");
  ordinary.body.head.hp = 0;
  assert.equal(ordinary.isDown(), true);
  assert.equal(ordinary.reviveIfHeadLost(), false);
});

test("the bellboy gate lets piercing hits through to the head and blocks the rest", () => {
  const timing = {windup: 2000, damageBonus: 2};
  const gate = new BellboyGate(timing);
  const battle = {elapsed: 0, enemyReadyAt: 3500, bellboyStaggered: false};
  assert.equal(gate.phase(battle), "closed");
  assert.deepEqual(gate.intercept({pierce: 2, damage: 3}, battle), {target: "head"});
  assert.equal(gate.intercept({pierce: 0, damage: 3}, battle).blocked.gateBlock, true);
  battle.elapsed = 1500;
  assert.equal(gate.phase(battle), "bell");
  battle.elapsed = 0;
  battle.bellboyStaggered = true;
  assert.equal(gate.phase(battle), "staggered");
  assert.equal(gate.intercept({pierce: 0, damage: 3}, battle), null);
  timing.windup = 4000;
  assert.equal(gate.phase(battle), "bell", "balance tools change timing in place");
  assert.equal(new NoGate().intercept({pierce: 0, damage: 3}, battle), null);
});

test("previewing a hit does not spend synergies or tactics, committing it does", () => {
  const {services, state} = setup();
  const guard = services.recruitment.makeCompanion("guard");
  state.companion = guard;
  state.formation = ["companion", "player", null];
  beginFight({services, state});
  const battle = state.cooldownBattle;
  battle.traits.add("warrior");
  battle.tactics.empower = {side: "player", amount: 1};
  state.enemy.body.chest.hp = 2;
  state.enemy.body.chest.guard = 0;
  const before = JSON.stringify({used: [...battle.usedTraits], empower: battle.tactics.empower});
  const preview = services.calculator.preview(guard, state.enemy, "chest", 2, {id: "heavy"}, state);
  assert.equal(preview.warrior, 1);
  assert.equal(preview.strengthened, 1);
  assert.equal(JSON.stringify({used: [...battle.usedTraits], empower: battle.tactics.empower}), before);
  services.hits.resolve(guard, state.enemy, "chest", 2, {id: "heavy"}, state);
  assert.equal(battle.usedTraits.has("warrior:companion"), true);
  assert.equal(battle.tactics.empower, undefined);
});

test("a new card effect is added by registering it, without changing the callers", () => {
  const {data, services, state} = setup();
  const calls = [];
  class EchoEffect extends CardEffect {
    apply({id, targets}){ calls.push([id, ...targets]); }
  }
  data.cards.echo = {name: "메아리", effect: "echo", type: "skill", target: "self", power: 1};
  services.cards.register("echo", new EchoEffect({}));
  services.cards.apply(state, "echo", state.player, state.enemy, ["head"]);
  assert.deepEqual(calls, [["echo", "head"]]);
});

test("the auto-battle runner keeps a single timer, ignores stale callbacks and honours pause and speed", () => {
  const scheduler = new ManualScheduler();
  let steps = 0, running = true;
  const runner = new AutoBattleRunner({scheduler, host: {
    canRun: () => running, token: () => 1, isCurrent: () => true, nextDelay: () => 100, step: () => steps++,
  }});
  runner.schedule();
  const stale = scheduler.pending.values().next().value.callback;
  runner.schedule();
  assert.equal(scheduler.pending.size, 1);
  stale();
  assert.equal(steps, 0);
  runner.cycleSpeed();
  runner.schedule();
  assert.equal(scheduler.pending.values().next().value.ms, 50);
  runner.togglePause();
  runner.schedule();
  assert.equal(scheduler.pending.size, 0);
  runner.togglePause();
  runner.schedule();
  scheduler.runNext();
  assert.equal(steps, 1);
  running = false;
  runner.schedule();
  assert.equal(scheduler.pending.size, 0);
});

test("the same seed and state draw the same rewards", () => {
  const draw = () => {
    const {services, state} = setup("SAME-SEED");
    state.area = "duct";
    return services.rewards.options(state);
  };
  assert.deepEqual(draw(), draw());
  assert.ok(draw().length >= 2);
});

test("the services alone play the first fight to a result without a page", () => {
  const {services, state} = setup("NO-DOM");
  beginFight({services, state});
  let steps = 0;
  while(state.phase === "combat"){
    services.battle.advance(state);
    assert.ok(++steps < 2000, "combat must terminate");
  }
  assert.ok(["route", "reward", "lost"].includes(state.phase));
  assert.ok(state.log.length > 0);
  assert.ok(state.feedback.every(event => event.type && event.side));
});
