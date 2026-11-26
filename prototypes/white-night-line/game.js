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

const initialCrew = [
  { id: "naru", name: "나루", role: "선로 경비", identity: "철교 경비대", skillName: "철로 엄호", icon: "⛨",
    level: 20, maxHp: 36, attack: 5, armor: 4, clashPower: 1,
    typeResists: { blunt: 0.75, pierce: 1.25 }, affinityResists: { frost: 0.75, current: 1.25 },
    skills: [
      { name: "철로 엄호", basePower: 4, coinCount: 2, coinPower: 2, type: "blunt", affinity: "steam" },
      { name: "차륜 밀기", basePower: 6, coinCount: 2, coinPower: 4, type: "blunt", affinity: "frost" },
      { name: "철교 봉쇄", basePower: 5, coinCount: 3, coinPower: 2, type: "blunt", affinity: "steam" },
    ] },
  { id: "ian", name: "이안", role: "교대장", identity: "야간 호송대", skillName: "교차 베기", icon: "✳",
    level: 21, maxHp: 31, attack: 8, armor: 2, type: "slash", spirit: 15,
    typeResists: { slash: 0.75, blunt: 1.25 }, affinityResists: { steam: 0.75, frost: 1.25 },
    skills: [
      { name: "교차 베기", basePower: 4, coinCount: 2, coinPower: 3, type: "slash", affinity: "frost" },
      { name: "신호등 베기", basePower: 4, coinCount: 3, coinPower: 4, type: "slash", affinity: "current" },
      { name: "밤샘 호송", basePower: 5, coinCount: 3, coinPower: 4, type: "slash", affinity: "steam" },
    ] },
  { id: "yul", name: "율", role: "정찰수", identity: "설원 수색대", skillName: "삼연 사격", icon: "↗",
    level: 20, maxHp: 25, attack: 8, armor: 1, type: "pierce", spirit: 10,
    typeResists: { pierce: 0.75, slash: 1.25 }, affinityResists: { frost: 0.75, steam: 1.25 },
    skills: [
      { name: "삼연 사격", basePower: 4, coinCount: 3, coinPower: 2, type: "pierce", affinity: "frost" },
      { name: "설야 조준", basePower: 4, coinCount: 4, coinPower: 2, type: "pierce", affinity: "current" },
      { name: "눈보라 사격", basePower: 3, coinCount: 5, coinPower: 2, type: "pierce", affinity: "frost" },
    ] },
  { id: "seol", name: "설", role: "기관 정비사", identity: "북단 급전반", skillName: "과전류 타격", icon: "⌁",
    level: 19, maxHp: 28, attack: 6, armor: 2,
    typeResists: { blunt: 0.75, slash: 1.25 }, affinityResists: { current: 0.75, steam: 1.25 },
    skills: [
      { name: "활선 점검", basePower: 4, coinCount: 1, coinPower: 8, type: "blunt", affinity: "current" },
      { name: "과전류 타격", basePower: 6, coinCount: 2, coinPower: 4, type: "blunt", affinity: "current" },
      { name: "급전 복구", basePower: 6, coinCount: 3, coinPower: 3, type: "blunt", affinity: "steam" },
    ] },
];

const recruits = {
  5: { id: "jin", name: "진", role: "통신선 기사", identity: "북단 통신반", skillName: "신호봉 강타", icon: "⌘",
    level: 22, maxHp: 32, attack: 8, armor: 3,
    typeResists: { pierce: 0.75, blunt: 1.25 }, affinityResists: { current: 0.75, frost: 1.25 },
    skills: [
      { name: "신호봉 강타", basePower: 5, coinCount: 1, coinPower: 6, type: "blunt", affinity: "steam" },
      { name: "통신선 절단", basePower: 5, coinCount: 3, coinPower: 3, type: "slash", affinity: "current" },
      { name: "비상 송신", basePower: 6, coinCount: 3, coinPower: 3, type: "slash", affinity: "current" },
    ] },
  10: { id: "onha", name: "온하", role: "철도 구조대", identity: "터널 구조대", skillName: "차단기 파쇄", icon: "◇",
    level: 23, maxHp: 34, attack: 10, armor: 3,
    typeResists: { slash: 0.75, pierce: 1.25 }, affinityResists: { steam: 0.75, current: 1.25 },
    skills: [
      { name: "안전핀 해체", basePower: 5, coinCount: 2, coinPower: 1, type: "pierce", affinity: "frost" },
      { name: "차단기 파쇄", basePower: 6, coinCount: 2, coinPower: 3, type: "blunt", affinity: "steam" },
      { name: "낙석 천공", basePower: 8, coinCount: 2, coinPower: 3, type: "pierce", affinity: "steam" },
    ] },
};

const deploymentLimit = 5;
const maxClashExchanges = 99;
const testCrew = [initialCrew[1], initialCrew[0], initialCrew[2], initialCrew[3], recruits[5]].map(({ skills, typeResists, affinityResists, ...unit }) => ({
  ...unit, level: 20, basePower: 5, coinCount: 2, coinPower: 2, offenseLevel: 20,
  ...(["ian", "naru"].includes(unit.id) ? { clashPower: (unit.clashPower ?? 0) + 4 } : {}),
  ...(unit.id === "seol" ? { basePower: 6, coinPower: 4, spirit: 45 } : {}),
}));
const testTargets = [
  { id: "test-a", name: "표적 A", maxHp: 19, attack: 2, armor: 0 },
  { id: "test-b", name: "표적 B", maxHp: 46, attack: 2, armor: 0 },
].map((unit) => ({ ...unit, basePower: 1, coinPower: 1, offenseLevel: 20, defenseLevel: 20 }));
const clampSpirit = (spirit) => Math.max(-45, Math.min(45, spirit));
const headsChance = (unit) => 50 + clampSpirit(unit.spirit ?? 0);

function copyFighter(unit) {
  const copy = { ...unit };
  if (unit.skills) copy.skills = unit.skills.map((skill) => ({ ...skill }));
  if (unit.typeResists) copy.typeResists = { ...unit.typeResists };
  if (unit.affinityResists) copy.affinityResists = { ...unit.affinityResists };
  return copy;
}

const fighter = (unit) => ({ ...copyFighter(unit), hp: unit.maxHp, spirit: unit.spirit ?? 0 });
const power = (unit) => unit.attack * 3 + unit.hp + unit.armor * 2;
const rankCrew = (crew) => crew.filter((unit) => unit.hp > 0).sort((a, b) => power(b) - power(a));
const characterLevel = (unit) => unit.level ?? 20;
const offenseLevel = (unit) => unit.offenseLevel ?? characterLevel(unit) + unit.attack;
const defenseLevel = (unit) => unit.defenseLevel ?? characterLevel(unit) + unit.armor * 2;
const coinCount = (unit, skill) => skill?.coinCount ?? unit.coinCount ?? 2;
const coinStrength = (unit, skill) => skill?.coinPower ?? unit.coinPower ?? 2;
const baseStrength = (unit, skill) => skill?.basePower ?? unit.basePower ?? Math.ceil(unit.attack / 2);
const baseCoinPower = (unit, heads, skill) =>
  baseStrength(unit, skill) + heads * coinStrength(unit, skill) + (unit.finalPower ?? 0);

function clashPower(unit, opponent, heads, skill) {
  const levelBonus = Math.floor(Math.max(0, offenseLevel(unit) - offenseLevel(opponent)) / 3);
  return Math.max(0, baseCoinPower(unit, heads, skill) + (unit.clashPower ?? 0) + levelBonus);
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
  #remaining = [...skillCycle];

  get remaining() { return this.#remaining.length; }

  draw(random) {
    if (!this.#remaining.length) this.#remaining = [...skillCycle];
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

  get alliedSpirit() {
    return this.#allies.map(({ id, spirit }) => ({ id, spirit }));
  }

  get outcome() {
    if (this.#enemies.every((unit) => unit.hp === 0)) return "won";
    return this.#allies.every((unit) => unit.hp === 0) ? "lost" : null;
  }

  get view() {
    if (!this.#stage) return null;
    const fighterView = (unit) => ({ id: unit.id, name: unit.name, icon: unit.icon ?? "✦",
      hp: unit.hp, maxHp: unit.maxHp, spirit: unit.spirit, headsChance: headsChance(unit) });
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
    this.#lanes = left.slice(0, count).map((ally, index) => this.#lane(ally, right[index]));
    this.#round += 1;
    this.#group = 0;
    this.#stage = "ready";
  }

  #lane(ally, enemy, winner = null) {
    const skills = {
      ally: winner === "enemy" ? null : this.#drawSkill(ally, this.#alliedBags),
      enemy: winner === "ally" ? null : this.#drawSkill(enemy, this.#enemyBags),
    };
    return { ally, enemy, skills, counts: { ally: coinCount(ally, skills.ally), enemy: coinCount(enemy, skills.enemy) }, exchanges: 0,
      faces: { ally: [], enemy: [] }, scores: null, winner, exchangeWinner: null, broken: null, draw: false,
      hit: null, hitsUsed: 0, heads: 0, nextFaces: null, gain: {}, attackFaces: [], spiritChange: {},
      attackPower: winner ? Math.max(0, baseCoinPower(winner === "ally" ? ally : enemy, 0, skills[winner])) : null,
    };
  }

  #drawSkill(unit, bags) {
    if (!unit.skills) return null;
    if (!bags.has(unit.id)) bags.set(unit.id, new SkillBag());
    const index = bags.get(unit.id).draw(this.#random);
    return { ...unit.skills[index], slot: index + 1 };
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
    for (const lane of this.#lanes) {
      if (!lane.hit) continue;
      const enemyWon = lane.winner === "enemy";
      const [source, target] = enemyWon ? [lane.enemy, lane.ally] : [lane.ally, lane.enemy];
      const damage = Math.min(target.hp, coinDamage(source, target, lane.hit.power, lane.exchanges, lane.skills[lane.winner]));
      target.hp -= damage;
      lane.hitsUsed += 1;
      lane.hit.damage = damage;
      hits.push({ source: source.name, target: target.name, damage, allyId: enemyWon ? target.id : null, hp: target.hp });
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
  #skillBags = new Map();
  #crew = initialCrew.map(fighter);
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

  constructor(random, combatRandom = seededRandom(0)) {
    this.#random = random;
    this.#combatRandom = combatRandom;
  }

  get view() {
    const ranked = rankCrew(this.#crew);
    const deployed = ["combat", "battleResult"].includes(this.#phase)
      ? this.#deployed : ranked.slice(0, deploymentLimit).map((unit) => unit.id);
    return {
      phase: this.#phase,
      position: this.#position,
      destination: this.#destination,
      die: this.#die,
      message: this.#message,
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

  start() {
    if (this.#phase !== "ready") return false;
    this.#phase = "roll";
    this.#record("북단 관제소를 출발합니다.");
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
      this.#hold("stop", "roll", "보급 완료", restored ? `대원 체력 총 ${restored} 회복` : "모든 대원의 체력이 가득 찼습니다.");
    } else if (tile.kind === "recruit") {
      const unit = fighter(recruits[this.#position]);
      this.#crew.push(unit);
      this.#hold("stop", "roll", "새 대원 영입", `${unit.name} · ${unit.role} 합류`);
    } else {
      const allies = rankCrew(this.#crew).slice(0, deploymentLimit);
      this.#deploy(allies, threats(this.#position), this.#combatRandom);
      this.#record(`${tile.name} · 전투 시작`);
    }
  }

  #deploy(allies, enemies, random) {
    this.#deployed = allies.map((unit) => unit.id);
    this.#battle = new Battle(allies, enemies, random, this.#skillBags);
    this.#phase = "combat";
    this.#battle.startRound();
  }

  #fight() {
    const previous = this.#battle.view;
    const hits = this.#battle.advance();
    for (const { id, spirit } of this.#battle.alliedSpirit) {
      this.#crew.find((unit) => unit.id === id).spirit = spirit;
    }
    for (const hit of hits) {
      if (hit.allyId) this.#crew.find((unit) => unit.id === hit.allyId).hp = hit.hp;
    }
    if (hits.length) this.#record(hits.map((hit) => `${hit.source} → ${hit.target} −${hit.damage}`).join(" · "));
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
        const lead = rankCrew(this.#crew)[0];
        lead.attack += 1;
        lead.maxHp += 2;
        lead.hp += 2;
        this.#resultClash = previous;
        this.#hold("battleResult", "roll", "승리", `${lead.name} 무장 강화 · 공격 +1 / 최대 HP +2`);
      }
    } else {
      this.#battle.startRound();
    }
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
