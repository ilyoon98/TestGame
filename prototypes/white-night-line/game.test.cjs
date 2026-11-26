const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const source = readFileSync(join(__dirname, "game.js"), "utf8");
const { Expedition, Battle, route, seededRandom, clashPower, coinDamage, headsChance } = runInNewContext(
  source + "\n({ Expedition, Battle, route, seededRandom, clashPower, coinDamage, headsChance })", { structuredClone }
);

function advanceUntil(run, condition) {
  for (let step = 0; step < 1500; step += 1) {
    if (condition(run.view)) return run.view;
    assert.equal(run.advance(), true, "The run stalled in " + run.view.phase);
  }
  assert.fail("The run did not reach the expected state");
}

function isOver(view) {
  return view.phase === "won" || view.phase === "lost";
}

test("a three-square roll crosses intermediate rooms without triggering them", () => {
  const run = new Expedition(() => 0.95);
  run.start();
  run.advance();
  assert.equal(run.view.die, 3);
  assert.equal(run.view.destination, 3);
  for (const position of [1, 2]) {
    run.advance();
    assert.equal(run.view.position, position);
    assert.equal(run.view.phase, "travel");
    assert.equal(run.view.enemies.length, 0);
  }
  run.advance();
  assert.equal(run.view.position, 3);
  assert.equal(run.view.phase, "travel", "The destination frame still shows the train moving into the stop");
  run.advance();
  assert.equal(run.view.phase, "stop");
  assert.equal(run.view.notice.title, "보급 완료");
  assert.match(run.view.notice.detail, /체력이 가득/);
  run.advance();
  assert.equal(run.view.phase, "roll");
  assert.equal(run.view.notice, null);
});

test("overflow past the terminus still starts the boss fight", () => {
  const run = new Expedition(() => 0.95);
  run.start();
  const view = advanceUntil(run, ({ phase, position }) => phase === "combat" && position === route.length - 1);
  assert.equal(view.die, 3);
  assert.equal(view.destination, route.length - 1);
  assert.equal(view.enemies[0].name, "폭주 전환기");
  assert.ok(isOver(advanceUntil(run, isOver)));
});

test("automatic formation selects up to five by power and locks combat slots", () => {
  const rolls = [0.4, 0.9, 0.4, 0.9];
  const run = new Expedition(() => rolls.shift() ?? 0);
  run.start();
  const first = advanceUntil(run, ({ phase }) => phase === "combat");
  const slots = new Map(first.crew.map(({ id, slot }) => [id, slot]));
  const active = [...first.crew].filter(({ slot }) => slot >= 0);
  assert.deepEqual(active.map(({ slot }) => slot), [0, 1, 2, 3]);
  for (let turn = 0; turn < 3; turn += 1) run.advance();
  assert.equal(run.view.phase, "combat");
  for (const { id, slot } of run.view.crew) assert.equal(slot, slots.get(id));
  const joined = advanceUntil(run, ({ position, phase }) => position === 5 && phase === "stop");
  assert.ok(joined.crew.some(({ name }) => name === "진"));
  assert.match(joined.notice.detail, /진 .*합류/);
  const next = advanceUntil(run, ({ phase }) => phase === "combat");
  assert.ok(next.crew.find(({ name }) => name === "진").slot >= 0);
  const full = advanceUntil(run, ({ position, phase }) => position === 10 && phase === "roll");
  assert.equal(full.crew.length, 6);
  const deployed = [...full.crew].filter(({ slot }) => slot >= 0);
  assert.equal(deployed.length, 5);
  assert.ok(deployed.at(-1).power >= full.crew.find(({ slot }) => slot < 0).power);
});

test("reinforcement applies once on victory and travel resumes without a reward phase", () => {
  const run = new Expedition(() => 0);
  run.start();
  const firstFight = advanceUntil(run, ({ phase }) => phase === "combat");
  const original = new Map(firstFight.crew.map((unit) => [unit.id, unit]));
  const victory = advanceUntil(run, ({ phase, position }) => phase === "battleResult" && position === 1);
  const upgrades = victory.crew.filter((unit) => original.get(unit.id).attack !== unit.attack);
  assert.equal(upgrades.length, 1);
  const lead = upgrades[0];
  assert.equal(lead.attack, original.get(lead.id).attack + 1);
  assert.equal(lead.maxHp, original.get(lead.id).maxHp + 2);
  assert.match(victory.message, /무장 강화/);
  assert.equal(victory.notice.title, "승리");
  assert.ok(victory.clash, "Final combat frame stays visible during the result");
  run.advance();
  assert.equal(run.view.phase, "roll");
  assert.equal(run.view.clash, null);
  assert.equal(run.view.notice, null);
  run.advance();
  assert.equal(run.view.phase, "travel");
  assert.equal(run.view.crew.find(({ id }) => id === lead.id).attack, lead.attack);
});

test("reading and editing snapshots cannot change an expedition or a later run", () => {
  const run = new Expedition(() => 0);
  const crew = run.view.crew[0];
  const originalBase = crew.skills[0].basePower;
  const originalResistance = crew.typeResists.blunt;
  crew.skills[0].basePower = 777;
  crew.typeResists.blunt = 0;
  for (const expedition of [run, new Expedition()]) {
    assert.equal(expedition.view.crew[0].skills[0].basePower, originalBase);
    assert.equal(expedition.view.crew[0].typeResists.blunt, originalResistance);
  }
  run.start();
  const active = advanceUntil(run, ({ phase }) => phase === "combat");
  active.enemies[0].typeResists.pierce = 0;
  assert.equal(run.view.enemies[0].typeResists.pierce, 0.75);
  const result = advanceUntil(run, ({ phase }) => phase === "battleResult");
  const hp = result.clash.lanes[0].ally.hp;
  result.clash.lanes[0].ally.hp = -1;
  assert.equal(run.view.clash.lanes[0].ally.hp, hp);
});

function unit(id, basePower, options = {}) {
  return { id, name: id, hp: 80, basePower, attack: 4, armor: 0, offenseLevel: 20, defenseLevel: 20, ...options };
}

function advanceBattle(battle, condition) {
  for (let step = 0; step < 800; step += 1) {
    if (condition(battle.view)) return;
    battle.advance();
  }
  assert.fail("Battle did not reach the expected stage");
}

test("level advantage is added once per clash and is a separate damage multiplier", () => {
  const attacker = unit("A", 4, { coinPower: 2, offenseLevel: 31, clashPower: 2,
    finalPower: 1, type: "slash", affinity: "steam" });
  const target = unit("E", 4, { offenseLevel: 25, defenseLevel: 25,
    typeResists: { slash: 1.5 }, affinityResists: { steam: 0.75 } });
  assert.equal(clashPower(attacker, target, 2), 13);
  assert.equal(clashPower(target, attacker, 0), 4);
  assert.equal(coinDamage(attacker, target, 10, 2), 16);
  assert.equal(coinDamage(target, attacker, 10, 0), 11);
  assert.equal(coinDamage(attacker, target, 0, 0), 1);
});

test("a lost toss removes one coin, and the winner rerolls surviving coins for consecutive hits", () => {
  const ally = unit("A", 6);
  const enemy = unit("E", 3);
  let flips = 0;
  const battle = new Battle([ally], [enemy], () => flips++ < 7 ? 0.95 : 0);
  const lane = () => battle.view.lanes[0];
  battle.startRound();
  advanceBattle(battle, (view) => view.stage === "contact");
  assert.equal(lane().scores.ally, 6);
  assert.equal(lane().counts.enemy, 2);
  assert.equal(battle.enemies[0].hp, 80);
  battle.advance();
  assert.equal(lane().counts.enemy, 1);
  assert.equal(lane().broken, "enemy");
  assert.equal(lane().winner, null);
  advanceBattle(battle, (view) => view.stage === "break" && lane().counts.enemy === 0);
  assert.equal(lane().winner, "ally");
  advanceBattle(battle, (view) => view.stage === "strike");
  assert.equal(lane().hit.power, 8);
  assert.equal(battle.enemies[0].hp, 80);
  assert.equal(battle.advance()[0].damage, 8);
  advanceBattle(battle, (view) => view.stage === "strike");
  assert.equal(lane().hit.power, 10);
  assert.equal(battle.advance()[0].damage, 10);
  assert.equal(battle.enemies[0].hp, 62);
  battle.advance();
  assert.equal(battle.view, null);
  assert.equal(enemy.hp, 80, "Battle owns its mutable HP");
});

test("each revealed heads increases the live score before the exchange winner is decided", () => {
  const rolls = [0, 0.95, 0.95, 0];
  const battle = new Battle([unit("A", 5)], [unit("E", 3)], () => rolls.shift());
  const lane = () => battle.view.lanes[0];
  battle.startRound();
  advanceBattle(battle, (view) => view.stage === "toss");
  assert.equal(lane().scores.ally, 5);
  assert.equal(lane().scores.enemy, 3);
  battle.advance();
  assert.equal(battle.view.stage, "reveal");
  assert.equal(lane().scores.ally, 7);
  assert.equal(lane().gain.ally, 2);
  assert.equal(lane().gain.enemy, undefined);
  assert.equal(lane().exchangeWinner, null);
  battle.advance();
  assert.equal(lane().scores.ally, 7);
  assert.equal(lane().scores.enemy, 5);
  assert.equal(lane().gain.ally, undefined);
  assert.equal(lane().gain.enemy, 2);
  assert.equal(lane().exchangeWinner, null);
  battle.advance();
  assert.equal(battle.view.stage, "contact");
  assert.equal(lane().exchangeWinner, "ally");
  assert.equal(lane().counts.enemy, 2);
});

test("unopposed attacks retain spent coin faces and accumulate power from 6 to 10 to 14", () => {
  const battle = new Battle([unit("Clasher", 10), unit("Attacker", 6, { coinPower: 4 })],
    [unit("Target", 1)], () => 0);
  const lane = () => battle.view.lanes[0];
  battle.startRound();
  advanceBattle(battle, (view) => view.group === 1 && view.stage === "attackToss");
  assert.equal(lane().attackPower, 6);
  assert.equal(lane().attackFaces.length, 0);
  battle.advance();
  assert.equal(lane().attackPower, 10);
  assert.deepEqual(Array.from(lane().attackFaces), [true]);
  battle.advance();
  assert.equal(lane().hit.damage, 10);
  battle.advance();
  assert.equal(battle.view.stage, "attackToss");
  assert.equal(lane().attackPower, 10);
  assert.deepEqual(Array.from(lane().attackFaces), [true]);
  battle.advance();
  assert.equal(lane().attackPower, 14);
  assert.deepEqual(Array.from(lane().attackFaces), [true, true]);
  battle.advance();
  assert.equal(lane().hit.damage, 14);
});

test("spirit changes once at a decided clash and the new chance drives the attack roll", () => {
  assert.equal(headsChance({ spirit: 0 }), 50);
  assert.equal(headsChance({ spirit: 50 }), 95);
  assert.equal(headsChance({ spirit: -50 }), 5);
  let flips = 0;
  const battle = new Battle([unit("A", 6)], [unit("E", 3)], () => flips++ < 7 ? 0.99 : 0.61);
  battle.startRound();
  advanceBattle(battle, (view) => view.stage === "break");
  assert.equal(battle.view.lanes[0].ally.spirit, 0);
  advanceBattle(battle, (view) => view.stage === "break" && view.lanes[0].winner === "ally");
  const lane = battle.view.lanes[0];
  assert.equal(lane.exchanges, 2);
  assert.equal(lane.ally.spirit, 12);
  assert.equal(lane.enemy.spirit, -12);
  assert.equal(lane.ally.headsChance, 62);
  assert.equal(lane.enemy.headsChance, 38);
  advanceBattle(battle, (view) => view.stage === "strike");
  assert.equal(battle.view.lanes[0].hit.heads, true);
  assert.equal(battle.alliedSpirit[0].spirit, 12);

  const capped = new Battle([unit("A", 6, { spirit: 43 })], [unit("E", 1, { spirit: -42 })], () => 0.99);
  capped.startRound();
  advanceBattle(capped, (view) => view.stage === "break" && view.lanes[0].winner === "ally");
  assert.equal(capped.view.lanes[0].ally.spirit, 45);
  assert.equal(capped.view.lanes[0].enemy.spirit, -45);
});

test("ties toss again without coin loss and a prolonged draw ends without damage", () => {
  const battle = new Battle([unit("A", 3)], [unit("E", 3)], () => 0);
  battle.startRound();
  advanceBattle(battle, (view) => view.stage === "break");
  assert.equal(battle.view.lanes[0].counts.enemy, 2);
  assert.equal(battle.view.lanes[0].counts.ally, 2);
  assert.equal(battle.view.lanes[0].winner, null);
  battle.advance();
  assert.equal(battle.view.stage, "toss");
  advanceBattle(battle, (view) => view === null);
  assert.equal(battle.enemies[0].hp, 80);
});

test("five versus two runs two simultaneous clashes, two parallel strikes, then retargets the last attacker", () => {
  const allies = Array.from({ length: 5 }, (_, index) => unit("A" + (index + 1), 5));
  const enemies = [unit("E1", 1, { hp: 17 }), unit("E2", 1)];
  const battle = new Battle(allies, enemies, () => 0.95);
  battle.startRound();
  assert.equal(battle.view.lanes.length, 2);
  assert.equal(battle.view.waiting, 3);
  advanceBattle(battle, (view) => view.stage === "contact");
  assert.ok(battle.view.lanes.every((lane) => lane.scores.ally === 5 && lane.scores.enemy === 1));
  advanceBattle(battle, (view) => view.group === 0 && view.stage === "strike");
  assert.deepEqual(Array.from(battle.advance(), ({ source }) => source), ["A1", "A2"]);
  advanceBattle(battle, (view) => view.group === 1 && view.stage === "strike");
  assert.deepEqual(Array.from(battle.advance(), ({ source, target }) => [source, target]), [["A3", "E1"], ["A4", "E2"]]);
  advanceBattle(battle, (view) => view.group === 2 && view.stage === "strike");
  assert.equal(battle.enemies[0].hp, 0);
  assert.deepEqual(Array.from(battle.advance(), ({ source, target }) => [source, target]), [["A5", "E2"]]);
});

test("the public test battle opens directly and runs one scripted five-versus-two demonstration", () => {
  const run = new Expedition(() => { throw Error("A test battle must skip dice"); });
  assert.equal(run.startTestBattle(), true);
  assert.equal(run.startTestBattle(), false);
  assert.equal(run.view.testBattle, true);
  assert.equal(run.view.crew.length, 5);
  assert.equal(run.view.enemies.length, 2);
  assert.equal(run.view.clash.lanes.length, 2);
  assert.deepEqual(Array.from(run.view.clash.waitingUnits, ({ name, slot }) => [name, slot]), [
    ["율", 0], ["설", 1], ["진", 2],
  ]);
  const firstClash = advanceUntil(run, ({ clash }) => clash?.group === 0 && clash.stage === "contact");
  assert.ok(firstClash.clash.lanes.every((lane) => lane.scores.ally - lane.scores.enemy >= 9));
  const parallel = advanceUntil(run, ({ clash }) => clash?.group === 1 && clash.stage === "impact");
  assert.deepEqual(Array.from(parallel.clash.lanes, (lane) => [lane.ally.name, lane.enemy.name]), [
    ["율", "표적 A"], ["설", "표적 B"],
  ]);
  assert.ok(parallel.clash.lanes.every((lane) => lane.hit.damage > 0));
  assert.deepEqual(Array.from(parallel.clash.waitingUnits, ({ name, slot }) => [name, slot]), [["진", 2]]);
  const finalHit = advanceUntil(run, ({ clash }) => clash?.group === 2 && clash.stage === "impact");
  assert.equal(finalHit.clash.lanes.length, 1);
  assert.equal(finalHit.clash.lanes[0].ally.name, "진");
  assert.equal(finalHit.clash.lanes[0].enemy.name, "표적 B");
  assert.equal(finalHit.clash.lanes[0].slot, 1);
  assert.equal(finalHit.enemies[0].hp, 0);
  const result = advanceUntil(run, ({ phase }) => phase === "battleResult");
  assert.equal(result.notice.title, "훈련 완료");
  assert.equal(result.clash.stage, "impact");
  const end = advanceUntil(run, ({ phase }) => phase === "testDone");
  assert.equal(end.clash, null);
  assert.equal(run.advance(), false);
});

test("enemy coin impacts update the expedition's allied HP only at contact with the target", () => {
  const flips = [0, 0.95, 0.95, 0, 0, 0.95, 0, 0, 0];
  const run = new Expedition(() => 0, () => flips.shift() ?? 0);
  run.start();
  const state = advanceUntil(run, ({ clash }) => clash?.stage === "strike");
  const lane = state.clash.lanes[0];
  assert.equal(lane.winner, "enemy");
  const before = state.crew.find(({ id }) => id === lane.ally.id).hp;
  run.advance();
  assert.equal(run.view.clash.stage, "impact");
  assert.ok(run.view.crew.find(({ id }) => id === lane.ally.id).hp < before);
});

test("a fighter draws all six skills before refilling, including across battles", () => {
  const skills = [
    { basePower: 7, coinCount: 2, coinPower: 2 },
    { basePower: 8, coinCount: 3, coinPower: 2 },
    { basePower: 12, coinCount: 1, coinPower: -2 },
  ];
  const ally = unit("A", 2, { skills });
  const enemy = unit("E", 1, { hp: 500 });
  const bags = new Map();
  const slots = [];
  for (let use = 0; use < 7; use += 1) {
    const battle = new Battle([ally], [enemy], () => 0.4, bags);
    battle.startRound();
    const bag = bags.get("A");
    const lane = () => battle.view.lanes[0];
    const { slot, basePower, coinCount } = lane().skills.ally;
    slots.push(slot);
    assert.equal(lane().counts.ally, coinCount);
    assert.equal(bag.remaining, 5 - use % 6);
    advanceBattle(battle, (view) => view.stage === "toss");
    assert.equal(lane().scores.ally, basePower);
    advanceBattle(battle, (view) => view.stage === "strike");
    assert.equal(lane().skills.ally.slot, slot);
    assert.equal(lane().hit.power, basePower + skills[slot - 1].coinPower);
    assert.equal(bag.remaining, 5 - use % 6);
  }
  assert.deepEqual(slots.slice(0, 6).sort(), [1, 1, 1, 2, 2, 3]);
});

test("only participating fighters spend a skill in each attack group", () => {
  const skills = [7, 8, 9].map((basePower) => ({ basePower, coinCount: 1, coinPower: 2 }));
  const allies = [unit("A", 1, { skills }), unit("B", 1, { skills })];
  const enemy = unit("E", 1, { skills: [1, 2, 3].map((basePower) => ({ basePower, coinCount: 1, coinPower: 1 })) });
  const bags = new Map();
  let drawsAndFlips = 0;
  const battle = new Battle(allies, [enemy], () => { drawsAndFlips += 1; return 0; }, bags);
  battle.startRound();
  assert.equal(bags.get("A").remaining, 5);
  assert.equal(bags.has("B"), false);
  assert.equal(drawsAndFlips, 2);
  advanceBattle(battle, (view) => view.group === 1 && view.stage === "ready");
  const lane = battle.view.lanes[0];
  assert.equal(lane.ally.id, "B");
  assert.equal(lane.skills.ally.slot, 1);
  assert.equal(lane.skills.enemy, null);
  assert.equal(bags.get("A").remaining, 5);
  assert.equal(bags.get("B").remaining, 5);
  assert.equal(drawsAndFlips, 6);
});

test("character level affects clashes and selected skill types determine both damage resistances", () => {
  const source = unit("A", 8, { level: 28, offenseLevel: undefined, type: "blunt", affinity: "steam" });
  const target = unit("E", 8, { level: 19, offenseLevel: undefined, defenseLevel: undefined, armor: 2,
    typeResists: { slash: 1.5 }, affinityResists: { frost: 0.5 } });
  const skill = { basePower: 10, coinPower: 3, type: "slash", affinity: "frost" };
  assert.equal(clashPower(source, target, 1, skill), 16);
  assert.equal(clashPower(target, source, 0), 8);
  assert.equal(coinDamage(source, target, 20, 0, skill), 30);
  assert.equal(coinDamage(source, target, 20, 0), 25);
  assert.equal(coinDamage(source, { ...target, armor: 6 }, 20, 0, skill), 25);
});

test("a single start finishes a deterministic expedition with no further input", () => {
  function play(seed) {
    const run = new Expedition(seededRandom(seed), seededRandom(seed ^ 0x9e3779b9));
    assert.equal(run.start(), true);
    assert.equal(run.start(), false);
    return JSON.stringify(advanceUntil(run, isOver));
  }
  const outcomes = Array.from({ length: 24 }, (_, index) => play(index * 7919));
  assert.ok(outcomes.some((view) => JSON.parse(view).phase === "won"));
  assert.equal(play(15838), outcomes[2]);
});
