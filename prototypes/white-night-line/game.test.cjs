const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const source = ["crew-data.js", "crew.js", "game.js"].map((file) => readFileSync(join(__dirname, file), "utf8")).join("\n");
const { Expedition, Battle, SkillBag, crewCatalog, route, seededRandom, clashPower, coinDamage, headsChance,
  skillProfile, teamSynergies, applySynergies } = runInNewContext(
  source + "\n({ Expedition, Battle, SkillBag, crewCatalog, route, seededRandom, clashPower, coinDamage, headsChance, skillProfile, teamSynergies, applySynergies })",
  { structuredClone },
);

function advanceUntil(run, condition) {
  for (let step = 0; step < 1500; step += 1) {
    const view = run.view;
    assert.ok(view.crew.length <= 5);
    if (condition(view)) return view;
    if (view.phase === "reward") {
      const choice = view.recruitChoice;
      if (choice?.selectedId) assert.ok(run.replaceRecruit(choice.candidates.find(({ id }) => id === choice.selectedId).replacementId));
      else if (choice) assert.ok(run.chooseIdentity(choice.candidates[0].id));
      else {
        const pack = view.reward.find(({ recommended }) => recommended);
        assert.ok(run.chooseReward(pack.field, pack.key, pack.cost));
      }
    } else assert.equal(run.advance(), true, "The run stalled in " + view.phase);
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
});

test("victory grants synchronization material and waits for one valid pack and cost", () => {
  const run = new Expedition(() => 0);
  run.start();
  const victory = advanceUntil(run, ({ phase, position }) => phase === "battleResult" && position === 1);
  assert.equal(victory.syncParts, 1);
  assert.match(victory.message, /동기화 재료/);
  assert.equal(victory.notice.title, "승리");
  assert.ok(victory.clash, "Final combat frame stays visible during the result");
  run.advance();
  assert.equal(run.view.phase, "reward");
  assert.equal(run.view.clash, null);
  assert.equal(run.view.notice, null);
  assert.equal(run.advance(), false);
  assert.deepEqual(Array.from(run.view.reward, ({ field }) => field), ["affiliation", "type", "affinity"]);
  for (const offer of run.view.reward) {
    const matches = run.view.crew.filter((unit) => unit.slot >= 0 && unit.hp > 0 && unit[offer.field] === offer.key);
    assert.ok(matches.length > 0);
    assert.equal(offer.deployedCount, matches.length);
  }
  const [pack] = run.view.reward;
  assert.equal(run.chooseReward(pack.field, pack.key, 7), false);
  assert.ok(run.chooseReward(pack.field, pack.key, pack.cost));
  assert.equal(run.chooseReward(pack.field, pack.key, pack.cost), false);
  assert.equal(run.view.crew.length, 4);
  assert.equal(run.chooseIdentity("없는 인격"), false);
  assert.ok(run.chooseIdentity(run.view.recruitChoice.candidates[0].id));
  assert.equal(run.view.phase, "stop");
  assert.ok(run.advance());
  assert.equal(run.view.phase, "roll");
});

test("reading and editing snapshots cannot change an expedition or a later run", () => {
  const run = new Expedition(() => 0);
  run.start();
  const crew = run.view.crew[0];
  const originalBase = crew.skills[0].basePower;
  const originalResistance = crew.typeResists.blunt;
  crew.skills[0].basePower = 777;
  crew.typeResists.blunt = 0;
  const later = new Expedition();
  later.start();
  for (const expedition of [run, later]) {
    assert.equal(expedition.view.crew[0].skills[0].basePower, originalBase);
    assert.equal(expedition.view.crew[0].typeResists.blunt, originalResistance);
  }
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
    ["벤", 0], ["나령", 1], ["노엘", 2],
  ]);
  const firstClash = advanceUntil(run, ({ clash }) => clash?.group === 0 && clash.stage === "contact");
  assert.ok(firstClash.clash.lanes.every((lane) => lane.scores.ally - lane.scores.enemy >= 9));
  const parallel = advanceUntil(run, ({ clash }) => clash?.group === 1 && clash.stage === "impact");
  assert.deepEqual(Array.from(parallel.clash.lanes, (lane) => [lane.ally.name, lane.enemy.name]), [
    ["벤", "표적 A"], ["나령", "표적 B"],
  ]);
  assert.ok(parallel.clash.lanes.every((lane) => lane.hit.damage > 0));
  assert.deepEqual(Array.from(parallel.clash.waitingUnits, ({ name, slot }) => [name, slot]), [["노엘", 2]]);
  const finalHit = advanceUntil(run, ({ clash }) => clash?.group === 2 && clash.stage === "impact");
  assert.equal(finalHit.clash.lanes.length, 1);
  assert.equal(finalHit.clash.lanes[0].ally.name, "노엘");
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
  const seed = 39;
  const run = new Expedition(() => 0, seededRandom(seed), seededRandom(seed ^ 0x85ebca6b));
  run.start(8);
  const state = advanceUntil(run, ({ clash }) => clash?.stage === "strike" && clash.lanes[0].winner === "enemy");
  assert.equal(state.position, 1);
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

test("the same starting seed and pack choices produce a deterministic expedition", () => {
  function play(seed) {
    const run = new Expedition(seededRandom(seed), seededRandom(seed ^ 0x9e3779b9), seededRandom(seed ^ 0x85ebca6b));
    assert.equal(run.start(), true);
    assert.equal(run.start(), false);
    return JSON.stringify(advanceUntil(run, isOver));
  }
  const outcomes = Array.from({ length: 24 }, (_, index) => play(index * 7919));
  assert.ok(outcomes.some((view) => JSON.parse(view).phase === "won"));
  assert.equal(play(15838), outcomes[2]);
});

test("independent starting rosters contain four different characters at the exact selected cost", () => {
  assert.equal(new Set(crewCatalog.map(({ id }) => id)).size, 26);
  assert.deepEqual([1, 2, 3, 4].map((cost) => crewCatalog.filter((unit) => unit.cost === cost).length), [6, 7, 7, 6]);
  for (let budget = 4; budget <= 16; budget += 1) {
    const rosters = new Set();
    for (let seed = 0; seed < 24; seed += 1) {
      const run = new Expedition(seededRandom(seed), seededRandom(seed), seededRandom(seed * 104729));
      assert.equal(run.start(0), false);
      assert.ok(run.start(budget));
      const crew = run.view.crew;
      assert.equal(crew.length, 4);
      assert.equal(new Set(crew.map(({ id }) => id)).size, 4);
      assert.equal(crew.reduce((sum, unit) => sum + unit.cost, 0), budget);
      assert.ok(crew.every((unit) => unit.sync === 1));
      assert.ok(crew.every((unit, index) => index === 0 || crew[index - 1].power >= unit.power));
      rosters.add(crew.map(({ id }) => id).sort().join(","));
    }
    assert.ok(rosters.size > 1);
  }
});

test("the published roster keeps the agreed species, gender and age proportions", () => {
  assert.equal(crewCatalog.filter(({ animal }) => animal).length, 18);
  assert.equal(crewCatalog.filter(({ gender }) => gender === "남성").length, 16);
  assert.equal(crewCatalog.filter(({ gender }) => gender === "여성").length, 10);
  assert.equal(crewCatalog.filter(({ age }) => age >= 13 && age < 20).length, 13);
  assert.equal(crewCatalog.filter(({ age }) => age >= 20 && age <= 32).length, 13);
});

test("a recruit from the selected card stays within that category", () => {
  const run = new Expedition(() => 0, () => 0, seededRandom(0));
  run.start(10);
  const offer = advanceUntil(run, ({ phase }) => phase === "reward");
  const pack = offer.reward[0];
  const original = new Set(offer.crew.map((unit) => unit.id));
  assert.equal(offer.reward.filter(({ recommended }) => recommended).length, 1);
  assert.ok(run.chooseReward(pack.field, pack.key, pack.cost));
  const { candidates } = run.view.recruitChoice;
  assert.equal(candidates.filter(({ recommended }) => recommended).length, 1);
  assert.equal(candidates.length, 2);
  assert.ok(run.backRecruit());
  assert.ok(run.chooseReward(pack.field, pack.key, pack.cost));
  assert.deepEqual(run.view.recruitChoice.candidates, candidates);
  assert.ok(run.chooseIdentity(candidates[1].id));
  const recruited = run.view.crew.find((unit) => !original.has(unit.id));
  assert.equal(recruited[pack.field], pack.key);
  assert.equal(recruited.cost, pack.cost);
  assert.equal(recruited.sync, 1);
});

test("pack candidates match the shown category and cost and a full team requires a replacement", () => {
  const run = new Expedition(() => 0, () => 0, seededRandom(0));
  run.start();
  const first = advanceUntil(run, ({ phase }) => phase === "reward");
  for (const pack of first.reward) {
    assert.ok(pack.candidates.length > 1);
    assert.equal(new Set(pack.candidates.map(({ id }) => id)).size, pack.candidates.length);
    for (const { id } of pack.candidates) {
      const unit = crewCatalog.find((u) => u.id === id);
      assert.equal(unit[pack.field], pack.key);
      assert.equal(unit.cost, pack.cost);
    }
  }
  const open = (pack) => assert.ok(run.chooseReward(pack.field, pack.key, pack.cost));
  open(first.reward[0]);
  assert.ok(run.chooseIdentity(run.view.recruitChoice.candidates[0].id));
  const full = advanceUntil(run, ({ phase }) => phase === "reward");
  assert.equal(full.crew.length, 5);
  const pack = full.reward.find(({ candidates }) => candidates.some(({ duplicate }) => !duplicate));
  open(pack);
  const candidate = run.view.recruitChoice.candidates.find(({ duplicate }) => !duplicate);
  assert.ok(run.chooseIdentity(candidate.id));
  const choice = run.view.recruitChoice;
  assert.equal(choice.replacementId, candidate.replacementId);
  assert.equal(choice.replacements.length, 5);
  const incoming = crewCatalog.find(({ id }) => id === candidate.id);
  const before = new Map(full.synergies.map(({ field, name, bonus }) => [`${field}:${name}`, bonus]));
  for (const option of choice.replacements) {
    const after = teamSynergies([...full.crew.filter(({ id }) => id !== option.id), { ...incoming, hp: incoming.maxHp }]);
    const expected = new Map(after.map(({ field, name, bonus }) => [`${field}:${name}`, bonus]));
    const changes = [...new Set([...before.keys(), ...expected.keys()])].filter((key) => (before.get(key) ?? 0) !== (expected.get(key) ?? 0));
    assert.equal(option.changes.length, changes.length);
    for (const { field, name, previous, next } of option.changes) {
      assert.equal(previous, before.get(`${field}:${name}`) ?? 0);
      assert.equal(next, expected.get(`${field}:${name}`) ?? 0);
    }
  }
  const outgoing = choice.replacements.find(({ id }) => id !== candidate.replacementId);
  assert.equal(run.previewReplacement(candidate.id), false);
  assert.ok(run.previewReplacement(outgoing.id));
  assert.equal(run.view.recruitChoice.replacementId, outgoing.id);
  assert.deepEqual(run.view.crew.map(({ id }) => id), full.crew.map(({ id }) => id));
  assert.equal(run.replaceRecruit(candidate.id), false);
  assert.equal(run.replaceRecruit(candidate.replacementId), false);
  assert.ok(run.replaceRecruit(outgoing.id));
  assert.equal(run.view.crew.length, 5);
  assert.ok(run.view.crew.some(({ id }) => id === candidate.id));
  assert.ok(!run.view.crew.some(({ id }) => id === outgoing.id));
});

test("duplicate pack recruits automatically strengthen the first living fighter and unlock skills", () => {
  const run = new Expedition(() => 0, () => 0, seededRandom(172));
  run.start(10);
  const reward = advanceUntil(run, ({ phase }) => phase === "reward");
  const leader = reward.crew[0];
  const pack = reward.reward.find(({ candidates }) => candidates.some(({ duplicate }) => duplicate));
  assert.ok(run.chooseReward(pack.field, pack.key, pack.cost));
  assert.ok(run.chooseIdentity(run.view.recruitChoice.candidates.find(({ duplicate }) => duplicate).id));
  const promoted = run.view.crew.find((unit) => unit.id === leader.id);
  assert.equal(run.view.crew.length, 4);
  assert.equal(promoted.sync, 2);
  assert.equal(run.view.syncParts, 1);
  assert.match(run.view.notice.detail, /중복 영입.*동기화 2/);
  assert.equal(skillProfile(promoted, 0).basePower, leader.skills[0].basePower + 1);
  assert.equal(skillProfile(promoted, 0).coinPower, leader.skills[0].coinPower + 1);

});

test("skill bags add newly unlocked slots without refreshing used cards", () => {
  const bag = new SkillBag();
  assert.equal(bag.draw(() => 0, 1), 0);
  assert.equal(bag.remaining, 2);
  assert.equal(bag.draw(() => 0.99, 2), 1);
  assert.equal(bag.remaining, 3);
  assert.equal(bag.draw(() => 0.99, 3), 2);
  assert.equal(bag.remaining, 3);
  const rest = Array.from({ length: 3 }, () => bag.draw(() => 0, 3));
  assert.deepEqual(rest, [0, 0, 1]);
  assert.equal(bag.remaining, 0);
  assert.equal(bag.draw(() => 0.99, 3), 2);
  assert.equal(bag.remaining, 5);
});

test("main and secondary synergies affect their own members only", () => {
  const crew = ["hae", "naru", "ryeon"].map((id) => crewCatalog.find((unit) => unit.id === id));
  const synergies = teamSynergies(crew);
  const [hae, naru, ryeon] = crew.map((unit) => applySynergies(unit, synergies));
  assert.equal(hae.clashPower, 1);
  assert.equal(hae.offenseLevel, hae.level + hae.attack + 2);
  assert.equal(hae.defenseLevel, hae.level + hae.armor * 2);
  assert.equal(hae.firstHitDamage, 1);
  assert.equal(naru.clashPower, 2);
  assert.equal(naru.offenseLevel, naru.level + naru.attack);
  assert.equal(naru.firstHitDamage, undefined);
  assert.equal(ryeon.clashPower, 0);
  assert.equal(ryeon.firstHitDamage, 1);
  assert.equal(teamSynergies([crew[0]]).length, 0);
});

test("every redesigned character has three skills and active sets follow the cost budget", () => {
  const counts = new Map();
  for (const fighter of crewCatalog) {
    counts.set(fighter.affiliation, (counts.get(fighter.affiliation) ?? 0) + 1);
    assert.equal(fighter.skills.length, 3);
    assert.equal(new Set(fighter.sets).size, fighter.cost === 1 ? 3 : 4);
    assert.ok(fighter.sets.includes("affiliation") && fighter.sets.includes("type"));
    for (const field of fighter.sets) assert.ok(fighter[field]);
    assert.equal(fighter.type, fighter.skills[0].type);
    assert.equal(fighter.affinity, fighter.skills[0].affinity);
  }
  assert.equal(counts.size, 8);
  assert.equal(counts.get("Before 사전 준비 팀"), 4);
  assert.equal(counts.get("Omega 서포트 팀"), 4);
  for (const [team, count] of counts) {
    if (team !== "Before 사전 준비 팀" && team !== "Omega 서포트 팀") assert.equal(count, 3);
  }
});

test("animal and affinity only count members with that active tag", () => {
  const crew = ["miru", "seol", "sol", "baek", "ian"].map((id) => crewCatalog.find((unit) => unit.id === id));
  const synergies = teamSynergies(crew);
  assert.equal(synergies.find(({ key }) => key === "쥐").count, 3);
  assert.equal(synergies.find(({ key }) => key === "frost").count, 2);
  const [miru, , , baek] = crew.map((fighter) => applySynergies(fighter, synergies));
  assert.equal(headsChance(miru), 55);
  assert.equal(miru.defenseLevel, 23);
  assert.equal(baek.defenseLevel, 30);
});

test("the first round bonus and unopposed bonus apply to the selected skill only", () => {
  const skills = [{ name: "test", basePower: 7, coinCount: 1, coinPower: 1 }];
  const first = unit("first", 7, { openingPower: 2, skills });
  const second = unit("second", 7, { openingPower: 2, followUpPower: 1, skills });
  const battle = new Battle([first, second], [unit("enemy", 1)], () => 0.99);
  battle.startRound();
  assert.equal(battle.view.lanes[0].skills.ally.basePower, 9);
  advanceBattle(battle, (view) => view.group === 1);
  assert.equal(battle.view.lanes[0].skills.ally.basePower, 10);
  for (let step = 0; battle.view && step < 30; step += 1) battle.advance();
  battle.startRound();
  assert.equal(battle.view.round, 2);
  assert.equal(battle.view.lanes[0].skills.ally.basePower, 7);
});

test("protection absorbs damage, and first hits can heal and set a mark for a different ally", () => {
  const medic = unit("medic", 6, { hp: 10, maxHp: 20,
    skills: [{ name: "aid", basePower: 6, coinCount: 1, coinPower: 1, heal: 4, mark: 2 }] });
  const attacker = unit("follow", 6, { coinCount: 1 });
  const enemy = unit("enemy", 1, { hp: 25, maxHp: 25, guard: 8, coinCount: 1 });
  const battle = new Battle([medic, attacker], [enemy], () => 0.99);
  battle.startRound();
  advanceBattle(battle, (view) => view.stage === "strike");
  const [first] = battle.advance();
  assert.equal(first.damage, 0);
  assert.equal(first.absorbed, 6);
  assert.equal(first.recovery.healed, 4);
  assert.equal(battle.alliedState[0].hp, 14);
  advanceBattle(battle, (view) => view.stage === "strike" && view.group === 1);
  const [follow] = battle.advance();
  assert.equal(follow.damage, 6);
  assert.equal(follow.absorbed, 2);
});
