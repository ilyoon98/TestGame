"use strict";

const route = [
  { name: "북단 관제소", kind: "start" },
  { name: "철교 감시탑", kind: "battle" },
  { name: "결빙 터널", kind: "battle" },
  { name: "비상 보급고", kind: "supply" },
  { name: "설풍 검문소", kind: "battle" },
  { name: "통신 기지", kind: "recruit" },
  { name: "침엽수 절개지", kind: "battle" },
  { name: "유리 빙벽", kind: "battle" },
  { name: "중간 정비역", kind: "supply" },
  { name: "야간 전환기", kind: "battle" },
  { name: "폐쇄 승강장", kind: "recruit" },
  { name: "황동 철문", kind: "battle" },
  { name: "마지막 급전소", kind: "supply" },
  { name: "백야 종착역", kind: "boss" },
];

const routeRecruits = { 5: "jin", 10: "onha" };
const crewById = Object.fromEntries(crewCatalog.map((unit) => [unit.id, unit]));
const startingSize = 4;
const startingBudgets = possibleDraftCosts(crewCatalog, startingSize);
const usualStartingBudgets = [8, 10, 12].filter((cost) => startingBudgets.has(cost));
const selectableStartingBudgets = usualStartingBudgets.length ? usualStartingBudgets : [...startingBudgets].sort((a, b) => a - b);
const defaultStartingCost = startingBudgets.has(10) ? 10 : selectableStartingBudgets[0];
const crewGroups = [
  { field: "affiliation", label: "소속", names: Object.fromEntries(crewTeams.map(({ name }) => [name, name])) },
  { field: "type", label: "공격 유형", names: crewAttackTypes },
  { field: "affinity", label: "공격 속성", names: crewAffinities },
];
const secondarySets = [
  { field: "type", stat: "offenseLevel", label: "공격 레벨", values: [2, 3] },
  { field: "affinity", stat: "defenseLevel", label: "방어 레벨", values: [2, 3] },
  { field: "animal", stat: "headsBonus", label: "앞면 확률", unit: "%p", values: [3, 5] },
  { field: "weapon", stat: "firstHitDamage", label: "첫 적중 추가 피해", values: [1, 2] },
];
const crewSetLabels = { affiliation: "소속", type: "물리", affinity: "속성", animal: "동물", weapon: "무기" };
const crewSets = [...crewTeams.map((team) => ({ ...team, field: "affiliation", key: team.name })),
  ...secondarySets.flatMap((set) => {
    const labels = crewGroups.find(({ field }) => field === set.field)?.names;
    const keys = new Set(crewCatalog.filter((unit) => unit.sets.includes(set.field)).map((unit) => unit[set.field]));
    return [...keys].map((key) => ({ ...set, key, name: labels?.[key] ?? key }));
  }),
];
const belongsToSet = (unit, { field, key }) => unit[field] === key && (unit.sets?.includes(field) ?? true);

function drawItem(items, random) {
  return items[Math.floor(random() * items.length)];
}

function possibleDraftCosts(units, size) {
  const totals = Array.from({ length: size + 1 }, () => new Set());
  totals[0].add(0);
  for (const { cost } of units) {
    for (let slots = size; slots > 0; slots -= 1) {
      for (const subtotal of totals[slots - 1]) totals[slots].add(subtotal + cost);
    }
  }
  return totals[size];
}

function draftCrew(budget, random) {
  const units = [];
  for (let slotsLeft = startingSize - 1; slotsLeft >= 0; slotsLeft -= 1) {
    const available = crewCatalog.filter((unit) => !units.includes(unit));
    const eligible = available.filter((unit) =>
      possibleDraftCosts(available.filter((candidate) => candidate !== unit), slotsLeft).has(budget - unit.cost));
    const unit = drawItem(eligible, random);
    units.push(unit);
    budget -= unit.cost;
  }
  return units.map(makeRecruit);
}

function eligiblePacks(random) {
  return crewGroups.map(({ field, label, names }) => {
    const activeKeys = new Set(crewCatalog.map((unit) => unit[field]));
    const key = drawItem(Object.keys(names).filter((name) => activeKeys.has(name)), random);
    const costs = [...new Set(crewCatalog.filter((unit) => unit[field] === key).map((unit) => unit.cost))];
    return { field, key, label, name: names[key], costs: costs.sort((a, b) => a - b) };
  });
}

function teamSynergies(units) {
  return crewSets.flatMap(({ values, ...set }) => {
    const count = units.filter((unit) => unit.hp !== 0 && belongsToSet(unit, set)).length;
    return count < 2 ? [] : [{ ...set, count, bonus: values[Number(count >= 3)] }];
  });
}

function applySynergies(unit, synergies) {
  const applied = { ...unit, clashPower: unit.clashPower ?? 0, offenseLevel: offenseLevel(unit), defenseLevel: defenseLevel(unit) };
  for (const set of synergies) {
    if (!belongsToSet(unit, set)) continue;
    if (set.stat === "commandLevel") {
      applied.offenseLevel += set.bonus;
      applied.defenseLevel += set.bonus;
    } else {
      applied[set.stat] = (applied[set.stat] ?? 0) + set.bonus;
    }
  }
  return applied;
}

const deploymentLimit = 5;
const maxClashExchanges = 99;
const testCrew = ["ian", "naru", "yul", "seol", "jin"].map((id) => crewById[id])
  .map(({ skills, typeResists, affinityResists, ...unit }) => ({
  ...unit, skillName: skills[0].name, level: 20, basePower: 5, coinCount: 2, coinPower: 2, offenseLevel: 20,
  ...(["ian", "naru"].includes(unit.id) ? { clashPower: (unit.clashPower ?? 0) + 4 } : {}),
  ...(unit.id === "seol" ? { basePower: 6, coinPower: 4, spirit: 45 } : {}),
}));
const testTargets = [
  { id: "test-a", name: "표적 A", maxHp: 19, attack: 2, armor: 0 },
  { id: "test-b", name: "표적 B", maxHp: 46, attack: 2, armor: 0 },
].map((unit) => ({ ...unit, basePower: 1, coinPower: 1, offenseLevel: 20, defenseLevel: 20 }));
const clampSpirit = (spirit) => Math.max(-45, Math.min(45, spirit));
const headsChance = (unit) => 50 + clampSpirit((unit.spirit ?? 0) + (unit.headsBonus ?? 0));

function copyFighter(unit) {
  const copy = { ...unit };
  if (unit.skills) copy.skills = unit.skills.map((skill) => ({ ...skill }));
  if (unit.typeResists) copy.typeResists = { ...unit.typeResists };
  if (unit.affinityResists) copy.affinityResists = { ...unit.affinityResists };
  if (unit.sets) copy.sets = [...unit.sets];
  return copy;
}

const fighter = (unit) => ({ ...copyFighter(unit), hp: unit.maxHp, spirit: unit.spirit ?? 0 });
const makeRecruit = (unit) => fighter({ ...unit, sync: 1 });
const power = (unit) => unit.attack * 3 + unit.hp + unit.armor * 2 + ((unit.sync ?? 1) - 1) * 5;
const rankCrew = (crew) => crew.filter((unit) => unit.hp > 0).sort((a, b) => power(b) - power(a));
const syncRequirement = (unit) => unit.sync === 1 ? 2 : 3 + Number(unit.cost >= 3);
const characterLevel = (unit) => unit.level ?? 20;
const offenseLevel = (unit) => unit.offenseLevel ?? characterLevel(unit) + unit.attack;
const defenseLevel = (unit) => unit.defenseLevel ?? characterLevel(unit) + unit.armor * 2;
const coinCount = (unit, skill) => skill?.coinCount ?? unit.coinCount ?? 2;
const coinStrength = (unit, skill) => skill?.coinPower ?? unit.coinPower ?? 2;
const baseStrength = (unit, skill) => skill?.basePower ?? unit.basePower ?? Math.ceil(unit.attack / 2);
const baseCoinPower = (unit, heads, skill) =>
  baseStrength(unit, skill) + heads * coinStrength(unit, skill) + (unit.finalPower ?? 0);

function skillProfile(unit, index) {
  const skill = unit.skills[index];
  const bonus = Math.max(unit.sync ?? 1, index + 1) - 1;
  if (unit.sync === undefined) return { ...skill };
  return { ...skill, basePower: skill.basePower + bonus, coinPower: skill.coinPower + bonus };
}

function clashPower(unit, opponent, heads, skill) {
  const levelBonus = Math.floor(Math.max(0, offenseLevel(unit) - offenseLevel(opponent)) / 3);
  return Math.max(0, baseCoinPower(unit, heads, skill) + (unit.clashPower ?? 0) + (skill?.clashBonus ?? 0) + levelBonus);
}

function resistanceModifier(resistance) {
  const difference = Math.max(0, resistance) - 1;
  return difference < 0 ? difference / 2 : difference;
}

function coinDamage(source, target, coinPower, exchanges, skill) {
  const level = offenseLevel(source) - defenseLevel(target);
  const physical = resistanceModifier(target.typeResists?.[skill?.type ?? source.type ?? "blunt"] ?? 1);
  const affinity = resistanceModifier(target.affinityResists?.[skill?.affinity ?? source.affinity ?? "steam"] ?? 1);
  const multiplier = 1 + physical + affinity + level / (Math.abs(level) + 25) + exchanges * 0.03;
  return Math.floor(Math.max(1, coinPower * 0.05, coinPower * multiplier));
}

const skillCycle = [0, 0, 0, 1, 1, 2];

class SkillBag {
  #remaining = [];
  #unlocked = 0;

  get remaining() { return this.#remaining.length; }

  draw(random, unlocked = 3) {
    if (!this.#remaining.length) this.#remaining = skillCycle.filter((slot) => slot < unlocked);
    else if (unlocked > this.#unlocked) {
      this.#remaining.push(...skillCycle.filter((slot) => slot >= this.#unlocked && slot < unlocked));
    }
    this.#unlocked = unlocked;
    const index = Math.floor(random() * this.#remaining.length);
    return this.#remaining.splice(index, 1)[0];
  }
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function threats(position) {
  if (route[position].kind === "boss") {
    return [
      fighter({ id: "switch", name: "폭주 전환기", maxHp: 86, attack: 13, armor: 3, coinCount: 3, coinPower: 3, affinity: "frost",
        typeResists: { blunt: 0.75, slash: 0.75, pierce: 1.25 }, affinityResists: { frost: 0.75, current: 1.25 } }),
      fighter({ id: "drone", name: "경비 드론", maxHp: 28, attack: 7, armor: 1, type: "pierce" }),
    ];
  }
  const armored = position >= 7;
  const main = fighter({
    id: "sentry", name: armored ? "장갑 순찰기" : "순찰기",
    maxHp: 20 + position * 2, attack: 6 + Math.floor(position / 3), armor: armored ? 2 : 1, coinPower: armored ? 3 : 2,
    typeResists: armored ? { slash: 0.75, blunt: 1.25 } : { pierce: 0.75, slash: 1.25 },
    affinityResists: armored ? { steam: 0.75, current: 1.25 } : { current: 0.75, frost: 1.25 },
  });
  if (position < 9) return [main];
  return [main, fighter({ id: "drone", name: "경비 드론", maxHp: 14, attack: 6, armor: 1 })];
}

class Battle {
  #allies;
  #enemies;
  #random;
  #alliedBags;
  #enemyBags = new Map();
  #round = 0;
  #group = 0;
  #stage = null;
  #lanes = [];
  #waiting = [];
  #waitingSide = null;
  #waitingOrder = [];
  #fieldOrder = [];
  #marks = new Map();

  constructor(allies, enemies, random = seededRandom(0), alliedBags = new Map()) {
    const copy = (unit) => ({ ...copyFighter(unit), spirit: clampSpirit(unit.spirit ?? 0) });
    this.#allies = allies.map(copy);
    this.#enemies = enemies.map(copy);
    this.#random = random;
    this.#alliedBags = alliedBags;
  }

  get enemies() {
    return this.#enemies.map(copyFighter);
  }

  get alliedState() {
    return this.#allies.map(({ id, hp, spirit }) => ({ id, hp, spirit }));
  }

  get alliedSpirit() {
    return this.alliedState.map(({ id, spirit }) => ({ id, spirit }));
  }

  get outcome() {
    if (this.#enemies.every((unit) => unit.hp === 0)) return "won";
    return this.#allies.every((unit) => unit.hp === 0) ? "lost" : null;
  }

  get view() {
    if (!this.#stage) return null;
    const fighterView = (unit) => ({ id: unit.id, name: unit.name, icon: unit.icon ?? "✦",
      portraitSheet: unit.portraitSheet, portraitCell: unit.portraitCell, hp: unit.hp, maxHp: unit.maxHp,
      guard: unit.guard ?? 0, marked: this.#marks.has(unit.id), spirit: unit.spirit, headsChance: headsChance(unit) });
    return { round: this.#round, group: this.#group, stage: this.#stage, waiting: this.#waiting.length,
      fieldSlots: this.#fieldOrder.length, waitingSide: this.#waitingSide, waitingSlots: this.#waitingOrder.length,
      waitingUnits: this.#waiting.map((unit) => ({ ...fighterView(unit), slot: this.#waitingOrder.indexOf(unit.id) })),
      lanes: this.#lanes.map(({ ally, enemy, counts, faces, scores, hit, nextFaces, gain, attackFaces, spiritChange, ...lane }) => ({
        ...lane, ally: fighterView(ally), enemy: fighterView(enemy), slot: this.#fieldOrder.indexOf(enemy.id), counts: { ...counts },
        skills: { ally: lane.skills.ally && { ...lane.skills.ally }, enemy: lane.skills.enemy && { ...lane.skills.enemy } },
        faces: { ally: [...faces.ally], enemy: [...faces.enemy] }, scores: scores && { ...scores },
        gain: { ...gain }, hit: hit && { ...hit }, attackFaces: [...attackFaces], spiritChange: { ...spiritChange },
      })),
    };
  }

  startRound() {
    if (this.#stage || this.outcome) return;
    const allies = this.#allies.filter((unit) => unit.hp > 0);
    const enemies = this.#enemies.filter((unit) => unit.hp > 0);
    // Rotate who takes the initial pairs so the same surplus fighters don't always wait.
    const offset = this.#round % Math.max(allies.length, enemies.length);
    const rotated = (units) => {
      const start = offset % units.length;
      return [...units.slice(start), ...units.slice(0, start)];
    };
    const [left, right] = [rotated(allies), rotated(enemies)];
    this.#fieldOrder = right.map((unit) => unit.id);
    const count = Math.min(left.length, right.length);
    this.#waitingSide = left.length > right.length ? "ally" : "enemy";
    this.#waiting = (this.#waitingSide === "ally" ? left : right).slice(count);
    this.#waitingOrder = this.#waiting.map((unit) => unit.id);
    this.#round += 1;
    this.#marks.clear();
    this.#lanes = left.slice(0, count).map((ally, index) => this.#lane(ally, right[index]));
    this.#group = 0;
    this.#stage = "ready";
  }

  #lane(ally, enemy, winner = null) {
    const skills = {
      ally: winner === "enemy" ? null : this.#drawSkill(ally, this.#alliedBags, winner === "ally"),
      enemy: winner === "ally" ? null : this.#drawSkill(enemy, this.#enemyBags, winner === "enemy"),
    };
    return { ally, enemy, skills, counts: { ally: coinCount(ally, skills.ally), enemy: coinCount(enemy, skills.enemy) }, exchanges: 0,
      faces: { ally: [], enemy: [] }, scores: null, winner, exchangeWinner: null, broken: null, draw: false,
      hit: null, hitsUsed: 0, heads: 0, nextFaces: null, gain: {}, attackFaces: [], spiritChange: {},
      attackPower: winner ? Math.max(0, baseCoinPower(winner === "ally" ? ally : enemy, 0, skills[winner])) : null,
    };
  }

  #drawSkill(unit, bags, followUp) {
    if (!unit.skills?.length) return null;
    if (!bags.has(unit.id)) bags.set(unit.id, new SkillBag());
    const index = bags.get(unit.id).draw(this.#random, Math.min(unit.sync ?? unit.skills.length, unit.skills.length));
    const skill = skillProfile(unit, index);
    const opening = this.#round === 1 ? unit.openingPower ?? 0 : 0;
    const unopposed = followUp ? unit.followUpPower ?? 0 : 0;
    return { ...skill, basePower: skill.basePower + opening + unopposed, slot: index + 1 };
  }

  #flip(unit) {
    return this.#random() < headsChance(unit) / 100;
  }

  #activeClashes() {
    return this.#lanes.filter((lane) => !lane.winner && !lane.draw);
  }

  #toss() {
    for (const lane of this.#lanes) {
      lane.broken = null;
      lane.spiritChange = {};
    }
    for (const lane of this.#activeClashes()) {
      lane.exchanges += 1;
      lane.scores = { ally: clashPower(lane.ally, lane.enemy, 0, lane.skills.ally),
        enemy: clashPower(lane.enemy, lane.ally, 0, lane.skills.enemy) };
      lane.exchangeWinner = null;
      lane.faces = { ally: [], enemy: [] };
      lane.gain = {};
    }
    this.#stage = "toss";
  }

  #revealCoin() {
    const active = this.#activeClashes();
    let revealed = false;
    for (const lane of active) {
      lane.nextFaces ??= {
        ally: Array.from({ length: lane.counts.ally }, () => this.#flip(lane.ally)),
        enemy: Array.from({ length: lane.counts.enemy }, () => this.#flip(lane.enemy)),
      };
      lane.gain = {};
      for (const [side, opponent] of [["ally", "enemy"], ["enemy", "ally"]]) {
        const faces = lane.faces[side];
        const next = lane.nextFaces[side][faces.length];
        if (next === undefined) continue;
        faces.push(next);
        if (next) lane.gain[side] = coinStrength(lane[side], lane.skills[side]);
        lane.scores[side] = clashPower(lane[side], lane[opponent], faces.filter(Boolean).length, lane.skills[side]);
        revealed = true;
      }
    }
    if (revealed) {
      this.#stage = "reveal";
      return;
    }
    for (const lane of active) {
      const { ally, enemy } = lane.scores;
      lane.exchangeWinner = ally === enemy ? null : ally > enemy ? "ally" : "enemy";
      lane.nextFaces = null;
    }
    this.#stage = "contact";
  }

  #breakCoins() {
    for (const lane of this.#activeClashes()) {
      if (lane.exchangeWinner) {
        const loser = lane.exchangeWinner === "ally" ? "enemy" : "ally";
        lane.counts[loser] -= 1;
        lane.broken = loser;
        if (lane.counts[loser] === 0) {
          lane.winner = lane.exchangeWinner;
          lane.attackPower = Math.max(0, baseCoinPower(lane[lane.winner], 0, lane.skills[lane.winner]));
          const change = 8 + 2 * lane.exchanges;
          for (const [side, delta] of [[lane.winner, change], [loser, -change]]) {
            const unit = lane[side];
            const newSpirit = clampSpirit(unit.spirit + delta);
            lane.spiritChange[side] = newSpirit - unit.spirit;
            unit.spirit = newSpirit;
          }
        }
      }
      lane.draw = !lane.winner && lane.exchanges >= maxClashExchanges;
    }
    this.#stage = "break";
  }

  #prepareHits() {
    for (const lane of this.#lanes) {
      lane.hit = null;
      if (!lane.winner) continue;
      const other = lane.winner === "ally" ? "enemy" : "ally";
      const [source, target] = [lane[lane.winner], lane[other]];
      const total = lane.counts[lane.winner];
      if (lane.hitsUsed >= total || source.hp === 0 || target.hp === 0) continue;
      const heads = this.#flip(source);
      lane.hit = { heads, number: lane.hitsUsed + 1, total,
        power: Math.max(0, baseCoinPower(source, lane.heads + Number(heads), lane.skills[lane.winner])) };
    }
    if (this.#lanes.some((lane) => lane.hit)) this.#stage = "attackToss";
    else this.#nextGroup();
  }

  #revealHits() {
    for (const lane of this.#lanes) {
      if (!lane.hit) continue;
      lane.attackFaces.push(lane.hit.heads);
      lane.heads += Number(lane.hit.heads);
      lane.hit.gain = lane.hit.power - lane.attackPower;
      lane.attackPower = lane.hit.power;
    }
    this.#stage = "strike";
  }

  #applyHits() {
    const hits = [];
    const recoveries = [];
    for (const lane of this.#lanes) {
      if (!lane.hit) continue;
      const enemyWon = lane.winner === "enemy";
      const [source, target] = enemyWon ? [lane.enemy, lane.ally] : [lane.ally, lane.enemy];
      const skill = lane.skills[lane.winner];
      const firstHit = lane.hitsUsed === 0;
      const mark = this.#marks.get(target.id);
      const markedDamage = mark && mark.source !== source.id ? mark.amount : 0;
      if (markedDamage) this.#marks.delete(target.id);
      const finishing = target.hp * 2 <= (target.maxHp ?? target.hp);
      const bonuses = markedDamage + (firstHit ? source.firstHitDamage ?? 0 : 0)
        + (finishing ? (source.finishDamage ?? 0) + (skill?.finishDamage ?? 0) : 0)
        + (lane.exchanges === 0 ? skill?.followUpDamage ?? 0 : 0);
      const incoming = coinDamage(source, target, lane.hit.power, lane.exchanges, skill) + bonuses;
      const absorbed = Math.min(target.guard ?? 0, incoming);
      if (absorbed) target.guard -= absorbed;
      const damage = Math.min(target.hp, incoming - absorbed);
      target.hp -= damage;
      lane.hitsUsed += 1;
      lane.hit.damage = damage;
      lane.hit.absorbed = absorbed;
      const hit = { source: source.name, target: target.name, damage, allyId: enemyWon ? target.id : null, hp: target.hp, absorbed };
      hits.push(hit);
      if (!firstHit) continue;
      const markAmount = Math.max(source.mark ?? 0, skill?.mark ?? 0);
      if (markAmount > 0 && target.hp > 0 && markAmount >= (this.#marks.get(target.id)?.amount ?? 0)) {
        this.#marks.set(target.id, { source: source.id, amount: markAmount });
      }
      if (skill?.guard) source.guard = Math.max(source.guard ?? 0, skill.guard);
      if (skill?.heal) recoveries.push({ hit, amount: skill.heal, allies: enemyWon ? this.#enemies : this.#allies });
    }
    for (const { hit, amount, allies } of recoveries) {
      const target = allies.filter((unit) => unit.hp > 0 && unit.hp < unit.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!target) continue;
      const healed = Math.min(amount, target.maxHp - target.hp);
      target.hp += healed;
      hit.recovery = { name: target.name, healed };
    }
    this.#stage = "impact";
    return hits;
  }

  #nextGroup() {
    const allyAttacks = this.#waitingSide === "ally";
    const targets = (allyAttacks ? this.#enemies : this.#allies).filter((unit) => unit.hp > 0);
    this.#waiting = this.#waiting.filter((unit) => unit.hp > 0);
    if (this.outcome || targets.length === 0 || this.#waiting.length === 0) {
      this.#stage = null;
      return;
    }
    const attackers = this.#waiting.splice(0, targets.length);
    this.#lanes = attackers.map((attacker, index) => allyAttacks
      ? this.#lane(attacker, targets[index], "ally")
      : this.#lane(targets[index], attacker, "enemy"));
    this.#group += 1;
    this.#stage = "ready";
  }

  advance() {
    switch (this.#stage) {
      case "ready":
        this.#stage = "approach";
        break;
      case "approach":
        if (this.#group > 0) this.#prepareHits();
        else this.#toss();
        break;
      case "toss":
      case "reveal":
        this.#revealCoin();
        break;
      case "contact":
        this.#breakCoins();
        break;
      case "break":
        if (this.#activeClashes().length) this.#toss();
        else this.#prepareHits();
        break;
      case "attackToss":
        this.#revealHits();
        break;
      case "strike":
        return this.#applyHits();
      case "impact":
        this.#prepareHits();
        break;
    }
    return [];
  }
}

class Expedition {
  #random;
  #combatRandom;
  #recruitRandom;
  #skillBags = new Map();
  #crew = [];
  #startingCost = null;
  #syncParts = 0;
  #reward = null;
  #synergies = [];
  #phase = "ready";
  #position = 0;
  #destination = 0;
  #die = null;
  #battle = null;
  #deployed = [];
  #testBattle = false;
  #notice = null;
  #noticeDestination = null;
  #resultClash = null;
  #journal = [];
  #message = "원정을 시작하면 주사위와 전투가 자동으로 진행됩니다.";

  constructor(random = seededRandom(0), combatRandom = seededRandom(0), recruitRandom = seededRandom(172)) {
    this.#random = random;
    this.#combatRandom = combatRandom;
    this.#recruitRandom = recruitRandom;
  }

  get view() {
    const ranked = rankCrew(this.#crew);
    const nextSync = ranked.find((unit) => unit.sync < 3);
    const fighting = ["combat", "battleResult"].includes(this.#phase);
    const deployed = fighting
      ? this.#deployed : ranked.slice(0, deploymentLimit).map((unit) => unit.id);
    return {
      phase: this.#phase,
      position: this.#position,
      destination: this.#destination,
      die: this.#die,
      message: this.#message,
      startingCost: this.#startingCost,
      syncParts: this.#syncParts,
      syncTarget: nextSync ? { name: nextSync.name, level: nextSync.sync + 1, required: syncRequirement(nextSync) } : null,
      reward: this.#phase === "reward" ? structuredClone(this.#reward) : null,
      synergies: fighting ? this.#synergies.map((synergy) => ({ ...synergy })) : teamSynergies(ranked.slice(0, deploymentLimit)),
      testBattle: this.#testBattle,
      journal: this.#journal.slice(),
      notice: this.#notice && { ...this.#notice },
      clash: this.#phase === "combat" ? this.#battle.view : structuredClone(this.#resultClash),
      enemies: ["combat", "battleResult", "won", "lost", "testDone"].includes(this.#phase) ? this.#battle.enemies : [],
      crew: [...ranked, ...this.#crew.filter((unit) => unit.hp === 0)].map((unit) => ({
        ...copyFighter(unit), power: power(unit), slot: deployed.indexOf(unit.id),
        bagRemaining: unit.skills ? this.#skillBags.get(unit.id)?.remaining ?? skillCycle.length : null,
      })),
    };
  }

  start(budget = defaultStartingCost) {
    if (this.#phase !== "ready" || !startingBudgets.has(budget)) return false;
    this.#startingCost = budget;
    this.#crew = draftCrew(budget, this.#recruitRandom);
    this.#phase = "roll";
    this.#record(`시작 코스트 ${budget} · ${this.#crew.map((unit) => unit.name).join(", ")} 출전`);
    return true;
  }

  startTestBattle() {
    if (this.#phase !== "ready") return false;
    this.#testBattle = true;
    this.#crew = testCrew.map(fighter);
    this.#deploy(this.#crew, testTargets.map(fighter), seededRandom(991));
    this.#record("아군 5명 · 적 2명");
    return true;
  }

  chooseReward(field, key, cost) {
    if (this.#phase !== "reward") return false;
    const pack = this.#reward.find((item) => item.field === field && item.key === key);
    if (!pack?.costs.includes(cost)) return false;
    const pool = crewCatalog.filter((unit) => unit[field] === key && unit.cost === cost);
    const result = this.#recruit(drawItem(pool, this.#recruitRandom));
    this.#reward = null;
    this.#hold("stop", "roll", result.title, result.detail);
    return true;
  }

  advance() {
    switch (this.#phase) {
      case "roll":
        this.#die = 1 + Math.floor(this.#random() * 3);
        this.#destination = Math.min(this.#position + this.#die, route.length - 1);
        this.#phase = "travel";
        this.#message = `주사위 ${this.#die} · 목적지 ${route[this.#destination].name}`;
        break;
      case "travel":
        if (this.#position === this.#destination) this.#arrive();
        else this.#position += 1;
        break;
      case "combat":
        this.#fight();
        break;
      case "stop":
      case "battleResult":
        this.#phase = this.#noticeDestination;
        this.#notice = null;
        this.#resultClash = null;
        break;
      default:
        return false;
    }
    return true;
  }

  #arrive() {
    const tile = route[this.#position];
    if (tile.kind === "supply") {
      const restored = this.#heal(12);
      const recovery = restored ? `대원 체력 총 ${restored} 회복` : "모든 대원의 체력이 가득 찼습니다.";
      this.#hold("stop", "roll", "보급 완료", `${recovery} · ${this.#grantSync(1)}`);
    } else if (tile.kind === "recruit") {
      const identity = crewById[routeRecruits[this.#position]];
      const result = this.#recruit(identity);
      this.#hold("stop", "roll", result.title, result.detail);
    } else {
      const allies = rankCrew(this.#crew).slice(0, deploymentLimit);
      this.#deploy(allies, threats(this.#position), this.#combatRandom);
      this.#record(`${tile.name} · 전투 시작`);
    }
  }

  #deploy(allies, enemies, random) {
    this.#deployed = allies.map((unit) => unit.id);
    this.#synergies = this.#testBattle ? [] : teamSynergies(allies);
    this.#battle = new Battle(allies.map((unit) => applySynergies(unit, this.#synergies)), enemies, random, this.#skillBags);
    this.#phase = "combat";
    this.#battle.startRound();
  }

  #fight() {
    const previous = this.#battle.view;
    const hits = this.#battle.advance();
    for (const { id, hp, spirit } of this.#battle.alliedState) {
      const unit = this.#crew.find((member) => member.id === id);
      unit.hp = hp;
      unit.spirit = spirit;
    }
    if (hits.length) this.#record(hits.map(({ source, target, damage, absorbed, recovery }) =>
      `${source} → ${target} −${damage}${absorbed ? ` (보호막 ${absorbed})` : ""}${recovery ? ` · ${recovery.name} 체력 +${recovery.healed}` : ""}`
    ).join(" · "));
    if (!this.#battle.view) this.#finishClash(previous);
  }

  #hold(phase, next, title, detail) {
    this.#phase = phase;
    this.#noticeDestination = next;
    this.#notice = { title, detail };
    this.#record(`${title} · ${detail}`);
  }

  #finishClash(previous) {
    if (this.#testBattle) {
      this.#resultClash = previous;
      this.#hold("battleResult", "testDone", "훈련 완료", "동시 합과 추가 공격을 모두 마쳤습니다.");
      return;
    }
    const outcome = this.#battle.outcome;
    if (outcome === "lost") {
      this.#resultClash = previous;
      this.#hold("battleResult", "lost", "전투 종료", "출전 대원이 모두 쓰러졌습니다.");
    } else if (outcome === "won") {
      if (route[this.#position].kind === "boss") {
        this.#resultClash = previous;
        this.#hold("battleResult", "won", "승리", "폭주 전환기를 멈추고 종착역에 도달했습니다.");
      } else {
        this.#heal(3);
        this.#resultClash = previous;
        this.#reward = eligiblePacks(this.#recruitRandom);
        this.#hold("battleResult", "reward", "승리", this.#grantSync(1));
      }
    } else {
      this.#battle.startRound();
    }
  }

  #recruit(identity) {
    if (this.#crew.some((unit) => unit.id === identity.id)) {
      return { title: "동기화 재료 획득", detail: `${identity.name} 중복 영입 · ${this.#grantSync(2)}` };
    }
    this.#crew.push(makeRecruit(identity));
    const detail = `${identity.name} · 코스트 ${identity.cost} · ${identity.affiliation}`;
    return { title: "새 대원 영입", detail: [detail, this.#grantSync(0)].filter(Boolean).join(" · ") };
  }

  #grantSync(amount) {
    this.#syncParts += amount;
    const advances = amount > 0 ? [`동기화 재료 +${amount}`] : [];
    for (const unit of rankCrew(this.#crew)) {
      while (unit.sync < 3) {
        const cost = syncRequirement(unit);
        if (this.#syncParts < cost) return advances.join(" · ");
        this.#syncParts -= cost;
        unit.sync += 1;
        advances.push(`${unit.name} 동기화 ${unit.sync}`);
      }
    }
    return advances.join(" · ");
  }

  #heal(amount) {
    let recovered = 0;
    for (const unit of this.#crew) {
      if (unit.hp === 0) continue;
      const gain = Math.min(amount, unit.maxHp - unit.hp);
      unit.hp += gain;
      recovered += gain;
    }
    return recovered;
  }

  #record(message) {
    this.#message = message;
    this.#journal.unshift(message);
    this.#journal.length = Math.min(this.#journal.length, 5);
  }
}
