"use strict";

const byId = (id) => document.getElementById(id);
const delay = { draft: 680, roll: 740, travel: 340, combat: 0, stop: 1750, battleResult: 2200 };
const draftFlipTime = 620;
const reducedDraftFlipTime = 420;
const clashDelay = { ready: 150, approach: 320, toss: 330, reveal: 380, contact: 1050, break: 400, attackToss: 205, strike: 150, impact: 320 };
const dieReadTime = 490;
const dispatchTime = 560;
const hpTrailDelay = 250;
const hpTrailDuration = 610;
const recoilEase = "cubic-bezier(.12,.82,.22,1)";
const sparkVectors = [[-38, -17], [-23, -32], [-53, 1], [-35, 20], [25, -29], [47, -13], [42, 13], [17, 24]];
const dieFaces = ["⚀", "⚁", "⚂"];
const symbols = { start: "⊙", boss: "◆" };
const stationKinds = { start: "출발", battle: "전투", supply: "보급", recruit: "영입", boss: "종착역" };
const phases = {
  ready: "출발 대기", draft: "대원 추첨", roll: "주사위 준비", travel: "자동 이동", combat: "자동 전투",
  stop: "정차", battleResult: "전투 결과", reward: "영입", won: "원정 성공", lost: "원정 종료", testDone: "테스트 완료",
};
const speeds = [1, 2, 4];
const standardAngles = { carried: -18, planted: 0, swept: 57 };
const syncMarks = ["", "Ⅰ", "Ⅱ", "Ⅲ"];

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function makeStandard() {
  const prop = element("span", "brin-standard");
  prop.setAttribute("aria-hidden", "true");
  const rig = element("span", "standard-rig");
  rig.append(element("span", "standard-cloth"));
  prop.append(rig);
  return prop;
}

function standardPose(stage, lane) {
  const firstClash = lane.exchanges === 1 && !lane.winner && !lane.draw;
  const firstHit = lane.winner === "ally" && lane.hit?.number === 1;
  if ((stage === "contact" && firstClash) || (stage === "strike" && firstHit)) return "swept";
  if ((stage === "approach" && lane.skills.ally) ||
      ((stage === "toss" || stage === "reveal") && firstClash) ||
      (stage === "attackToss" && firstHit)) return "planted";
  return "carried";
}

function health(unit) {
  const bar = element("meter", "health");
  bar.min = 0;
  bar.max = unit.maxHp;
  bar.value = unit.hp;
  bar.setAttribute("aria-label", `${unit.name} 체력 ${unit.hp} / ${unit.maxHp}`);
  return bar;
}

const signed = (value) => `${value > 0 ? "+" : ""}${value}`;

const portraitCells = { naru: 0, ian: 1, yul: 2, seol: 3, jin: 4, onha: 5, sentry: 6, drone: 7, switch: 8,
  "test-a": 6, "test-b": 7 };
const iconCells = { slash: 0, pierce: 1, blunt: 2, steam: 3, frost: 4, current: 5, hp: 6, spirit: 7,
  attack: 8, defense: 9, level: 10, coin: 11, tails: 12, broken: 13, unrevealed: 14, rating: 15 };
const skillIconCells = { bat: 0, blade: 1, spike: 2, shield: 3, flag: 4, relay: 5, scope: 6, gun: 7,
  aid: 8, bag: 9, whistle: 10, lamp: 11, ice: 12, valve: 13, bolt: 14, wing: 15 };
const crewSkillIcons = new Map([
  [1001, ["bat", "ice", "bat"]], [1002, ["spike", "bolt", "ice"]],
  [1003, ["gun", "shield", "gun"]], [1004, ["bolt", "spike", "relay"]],
  [1005, ["lamp", "ice", "relay"]], [1006, ["ice", "scope", "lamp"]],
  [1007, ["spike", "scope", "lamp"]], [1008, ["bag", "shield", "aid"]],
  [1009, ["scope", "spike", "lamp"]], [1010, ["spike", "bag", "scope"]],
  [1011, ["bat", "spike", "shield"]], [1012, ["scope", "lamp", "bag"]],
  [1013, ["bag", "bat", "ice"]], [1014, ["whistle", "bat", "valve"]],
  [1015, ["blade", "shield", "valve"]], [1016, ["gun", "scope", "gun"]],
  [1017, ["blade", "scope", "bolt"]], [1018, ["shield", "ice", "blade"]],
  [1019, ["shield", "valve", "shield"]], [1020, ["aid", "relay", "whistle"]],
  [1021, ["shield", "aid", "ice"]], [1022, ["blade", "shield", "valve"]],
  [1023, ["wing", "ice", "wing"]], [1024, ["blade", "ice", "bolt"]],
  [1025, ["flag", "whistle", "flag"]], [1026, ["scope", "relay", "aid"]],
]);

function setBitmap(node, sheet, columns, cell, variant = "simple") {
  const step = 100 / (columns - 1);
  node.style.backgroundImage = `url("assets/${sheet}-${variant}.png")`;
  node.style.backgroundSize = `${columns * 100}% ${columns * 100}%`;
  node.style.backgroundPosition = `${cell % columns * step}% ${Math.floor(cell / columns) * step}%`;
}

function setPortrait(node, unit, framing = "face") {
  const portrait = crewPortrait(crewById[unit.id]);
  if (portrait) {
    const [image, size, position] = portrait;
    const isCard = framing === "card";
    node.textContent = "";
    node.style.backgroundImage = `url(${JSON.stringify(image)})`;
    node.style.backgroundSize = isCard ? "contain" : size;
    node.style.backgroundPosition = isCard ? "center" : position;
    node.style.backgroundRepeat = "no-repeat";
    return;
  }
  const cell = portraitCells[unit.id];
  if (cell === undefined) node.textContent = unit.icon;
  else {
    node.textContent = "";
    setBitmap(node, "portraits", 3, cell, "anime");
  }
}

function hudIcon(key, label) {
  const icon = element("span", "hud-icon");
  setBitmap(icon, "combat-icons", 4, iconCells[key]);
  if (label) {
    icon.title = label;
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", label);
  } else icon.setAttribute("aria-hidden", "true");
  return icon;
}

function iconValue(key, label, value) {
  const stat = element("span", "icon-value");
  stat.append(hudIcon(key, label), element("span", "", value));
  return stat;
}

function showSpirit(node, unit) {
  const spirit = signed(unit.spirit ?? 0);
  if (!node.lastElementChild) node.append(hudIcon("spirit", "정신력"), element("span", "", spirit));
  else if (node.lastElementChild.textContent !== spirit) node.lastElementChild.textContent = spirit;
}

function trainPosition(position) {
  return `${(position + 0.5) / route.length * 100}%`;
}

function dicePosition(view, previous) {
  return view.phase === "travel" && previous?.phase !== "roll"
    ? `clamp(28px, ${trainPosition(view.position)}, calc(100% - 28px))` : "50%";
}

function willReengage(lane) {
  return !lane.winner && !lane.draw;
}

function clampLanePosition(left) {
  return `clamp(var(--lane-edge), ${left}, calc(100% - var(--lane-edge)))`;
}

function clashPositions(stage, lane, group) {
  return clashOffsets(stage, lane, group).map(clampLanePosition);
}

function laneTranslation(position, anchor) {
  return `calc(${position.replaceAll("%", "cqi")} - ${anchor.replaceAll("%", "cqi")}) 0px`;
}

function clashOffsets(stage, lane, group) {
  if (group > 0) {
    const ally = lane.winner === "ally";
    if (stage === "ready") return ["24%", "76%"];
    if (stage === "strike" && lane.hit) return ally ? ["calc(76% - 9px)", "76%"] : ["24%", "calc(24% + 9px)"];
    if (stage === "impact" && lane.hit) return ally
      ? ["calc(76% - 26px)", "calc(76% + 7px)"] : ["calc(24% - 7px)", "calc(24% + 26px)"];
    return ally ? ["calc(76% - min(40%, 62px))", "76%"] : ["24%", "calc(24% + min(40%, 62px))"];
  }
  if (stage === "ready") return ["18%", "82%"];
  if (stage === "break" && willReengage(lane)) {
    const distance = (side) => Math.round(36 + (lane.exchangeWinner === side ? 11 : 21) * clashForce(lane));
    return [`max(15%, calc(50% - ${distance("ally")}px))`, `min(85%, calc(50% + ${distance("enemy")}px))`];
  }
  if (stage === "strike" && lane.hit) {
    return lane.winner === "ally"
      ? ["calc(50% + 12px)", "calc(50% + 24px)"]
      : ["calc(50% - 24px)", "calc(50% - 12px)"];
  }
  if (stage === "impact" && lane.hit) {
    return lane.winner === "ally"
      ? ["48%", "calc(50% + 47px)"]
      : ["calc(50% - 47px)", "52%"];
  }
  return ["calc(50% - min(24%, 36px))", "calc(50% + min(24%, 36px))"];
}

const hpText = (unit) => `${unit.hp} / ${unit.maxHp}`;
const attackTypes = crewAttackTypes;
const affinities = crewAffinities;

function unitStats(unit) {
  const stats = element("div", "unit-level");
  stats.append(iconValue("level", "캐릭터 레벨", String(characterLevel(unit))),
    iconValue("attack", "공격력 · 공격 레벨", `${unit.attack} / ${offenseLevel(unit)}`),
    iconValue("defense", "방어력 · 방어 레벨", `${unit.armor} / ${defenseLevel(unit)}`),
    iconValue("spirit", "정신력", signed(unit.spirit ?? 0)));
  return stats;
}

function unitResists(unit) {
  const stats = element("div", "unit-resists");
  for (const [labels, values, label] of [[attackTypes, unit.typeResists, "공격 유형 내성"], [affinities, unit.affinityResists, "속성 내성"]]) {
    const row = element("div", "resistance-row");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    row.append(...Object.entries(labels).map(([key, name]) => {
      const percent = Math.round(resistanceModifier(values?.[key] ?? 1) * 10000) / 100;
      return iconValue(key, `${name} 내성에 따른 피해 보정`, `${signed(percent)}%`);
    }));
    stats.append(row);
  }
  return stats;
}

function crewBadge(kind, number, mark = number) {
  const badge = element("span", `unit-badge unit-badge-${kind}`, String(mark));
  const label = `${kind === "cost" ? "코스트" : "동기화"} ${number}`;
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", label);
  badge.title = label;
  return badge;
}

function skillCard(unit, skill, position) {
  const item = element("li", "coin-profile");
  const locked = unit.sync !== undefined && position >= unit.sync;
  item.classList.toggle("is-locked", locked);
  const key = `${unit.id}-${position}`;
  const name = skill?.name ?? unit.skillName;
  const type = skill?.type ?? unit.type ?? "blunt";
  const affinity = skill?.affinity ?? unit.affinity ?? "steam";
  const trigger = element("button", "skill-trigger");
  trigger.type = "button";
  trigger.dataset.skillKey = key;
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", `skill-detail-${key}`);

  const artwork = element("span", "skill-artwork");
  const picture = element("span", "skill-picture");
  picture.setAttribute("aria-hidden", "true");
  const illustrations = crewSkillIcons.get(crewById[unit.id]?.sheetId);
  const illustration = illustrations?.[position];
  if (illustration) {
    setBitmap(picture, "skill-icons", 4, skillIconCells[illustration], "painted");
    picture.classList.toggle("is-alternate", illustrations.indexOf(illustration) !== position);
  } else setBitmap(picture, "combat-icons", 4, iconCells[type]);
  artwork.append(picture, hudIcon(affinity));
  trigger.append(artwork, element("strong", "skill-name", name));
  if (locked) {
    const required = position + 1;
    const badge = crewBadge("sync", required, syncMarks[required]);
    badge.className += " skill-lock";
    badge.title = `동기화 ${required} 필요`;
    badge.setAttribute("aria-label", badge.title);
    trigger.append(badge);
  }

  const detail = element("div", "skill-detail");
  detail.id = `skill-detail-${key}`;
  detail.hidden = true;
  const count = coinCount(unit, skill);
  const strength = baseStrength(unit, skill);
  const perHead = coinStrength(unit, skill);
  const allHeads = strength + perHead * count;
  const range = strength === allHeads ? String(strength) : `${Math.min(strength, allHeads)}–${Math.max(strength, allHeads)}`;
  const header = element("div", "skill-detail-heading");
  header.append(element("strong", "", name), element("span", "skill-power", `위력 ${range}`));
  const roll = perHead ? `코인 ${count}개 · 앞면 하나마다 위력 ${signed(perHead)}` : `코인 ${count}개 · 위력 고정`;
  detail.append(header, element("p", "skill-type", `${attackTypes[type]} · ${affinities[affinity]}`),
    element("p", "skill-roll", roll));
  if (locked) detail.append(element("p", "skill-unlock", `동기화 ${syncMarks[position + 1]}에서 해금`));
  const effects = [];
  if (skill?.clashBonus) effects.push(`합에서 위력 ${signed(skill.clashBonus)}.`);
  if (skill?.mark) effects.push(`첫 타격에 표식. 다른 아군이 표식 대상을 치면 추가 피해 ${skill.mark}.`);
  if (skill?.guard) effects.push(`첫 타격에 자신에게 보호막 ${skill.guard}.`);
  if (skill?.heal) effects.push(`첫 타격에 체력 비율이 가장 낮은 부상 아군을 ${skill.heal} 회복.`);
  if (skill?.finishDamage) effects.push(`체력이 절반 이하인 적에게 타격마다 추가 피해 ${skill.finishDamage}.`);
  if (skill?.followUpDamage) effects.push(`합 없이 공격할 때 타격마다 추가 피해 ${skill.followUpDamage}.`);
  if (effects.length) {
    const list = element("ul", "skill-effects");
    list.append(...effects.map((text) => element("li", "", text)));
    detail.append(list);
  }
  item.append(trigger, detail);
  return { key, item, trigger, detail };
}

function clashForce(lane) {
  const gap = lane.scores ? Math.abs(lane.scores.ally - lane.scores.enemy) : 0;
  return Math.min(2.2, 1 + Math.max(0, gap - 3) / 7);
}

class GameScreen {
  #run;
  #draftCount = null;
  #tiles;
  #lastView = null;
  #crewKey = null;
  #crewRows = new Map();
  #waitingKey = null;
  #enemyKey = null;
  #effects = [];
  #healthBars = new Map();
  #motion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  #timer = null;
  #remaining = 0;
  #armedAt = 0;
  #paused = false;
  #speedIndex = 0;
  #noticePlaying = false;
  #skillPreview = null;

  constructor() {
    const costPicker = byId("starting-cost");
    costPicker.replaceChildren(...selectableStartingBudgets.map((cost) => {
      const option = element("option", "", String(cost));
      option.value = String(cost);
      return option;
    }));
    costPicker.value = String(defaultStartingCost);
    const track = byId("track");
    track.style.setProperty("--station-count", route.length);
    this.#tiles = route.map((tile, index) => {
      const cell = element("li", `tile ${tile.kind}`);
      const icon = element("span", "tile-icon");
      icon.append(element("span", `route-symbol route-${tile.kind}`, symbols[tile.kind]));
      icon.setAttribute("aria-hidden", "true");
      const label = `${tile.name} · ${stationKinds[tile.kind]}`;
      cell.setAttribute("aria-label", `${index}칸 ${label}`);
      cell.title = label;
      cell.append(icon, element("span", "tile-number", index.toString().padStart(2, "0")));
      track.append(cell);
      return cell;
    });
    byId("start").addEventListener("click", () => this.#reset("expedition"));
    byId("test-battle").addEventListener("click", () => this.#reset("test"));
    byId("pause").addEventListener("click", () => this.#togglePause());
    byId("speed").addEventListener("click", () => this.#changeSpeed());
    document.addEventListener("pointerdown", (event) => {
      if (this.#skillPreview && !this.#skillPreview.item.contains(event.target)) this.#showSkillDetail(null);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.#skillPreview) this.#showSkillDetail(null);
    });
    this.#reset("ready");
  }

  get #speed() {
    return speeds[this.#speedIndex];
  }

  get #clockSpeed() {
    return this.#noticePlaying ? 1 : this.#speed;
  }

  #reset(mode) {
    this.#freeze();
    this.#clearHealthBars();
    this.#paused = false;
    this.#lastView = null;
    this.#crewKey = null;
    this.#crewRows.clear();
    this.#waitingKey = null;
    this.#enemyKey = null;
    this.#draftCount = null;
    this.#showSkillDetail(null);
    const [seed] = crypto.getRandomValues(new Uint32Array(1));
    this.#run = new Expedition(seededRandom(seed), seededRandom(seed ^ 0x9e3779b9), seededRandom(seed ^ 0x85ebca6b));
    if (mode === "expedition" && this.#run.start(Number(byId("starting-cost").value || defaultStartingCost))) {
      this.#draftCount = 0;
    }
    if (mode === "test") {
      this.#speedIndex = 0;
      this.#run.startTestBattle();
    }
    this.#next();
    if (mode !== "ready") byId("pause").focus();
  }

  #next() {
    this.#freeze();
    for (const effect of this.#effects) effect.cancel();
    this.#effects = [];
    const view = this.#run.view;
    if (this.#draftCount !== null) {
      view.phase = "draft";
      view.draftCount = this.#draftCount;
    }
    const previous = this.#lastView;
    const dispatching = view.clash?.group > 0 && previous?.clash
      && view.clash.group !== previous.clash.group && !this.#motion?.matches;
    const waitingOrigins = dispatching ? this.#waitingOrigins() : null;
    const die = byId("dice");
    const dieOrigin = { left: die.style.left, following: die.dataset.following === "true" };
    this.#noticePlaying = Boolean(view.notice);
    this.#remaining = this.#stepDuration(view, previous);
    this.#render(view, previous);
    this.#playTransition(view, previous, waitingOrigins, dieOrigin);
    this.#lastView = view;
    this.#arm();
  }

  #stepDuration(view, previous) {
    if (view.phase === "draft") {
      if (view.draftCount === 0) return 300;
      return view.draftCount === view.crew.length ? 1140 : delay.draft;
    }
    if (view.notice) return delay[view.phase];
    if (view.clash) {
      if (view.clash.stage === "ready" && view.clash.group > 0 && previous?.clash?.group !== view.clash.group) return dispatchTime;
      if (view.clash.stage === "ready" && previous?.position !== view.position) return delay.travel + 60;
      return clashDelay[view.clash.stage];
    }
    if (view.phase === "travel" && previous?.phase === "roll") return dieReadTime;
    return delay[view.phase] ?? 0;
  }

  #arm() {
    if (this.#paused || this.#remaining <= 0) return;
    this.#armedAt = performance.now();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (this.#draftCount === null) this.#run.advance();
      else this.#draftCount = this.#draftCount < this.#lastView.crew.length ? this.#draftCount + 1 : null;
      this.#next();
    }, this.#remaining / this.#clockSpeed);
  }

  #freeze() {
    if (this.#timer === null) return;
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#remaining = Math.max(1, this.#remaining - (performance.now() - this.#armedAt) * this.#clockSpeed);
  }

  #togglePause() {
    this.#freeze();
    this.#paused = !this.#paused;
    const healthEffects = [...this.#healthBars.values()].map(({ effect }) => effect).filter(Boolean);
    for (const effect of [...this.#effects, ...healthEffects]) {
      if (effect.playState === "finished") continue;
      if (this.#paused) effect.pause();
      else effect.play();
    }
    this.#renderControls(this.#run.view.phase);
    this.#arm();
  }

  #changeSpeed() {
    this.#freeze();
    this.#speedIndex = (this.#speedIndex + 1) % speeds.length;
    for (const effect of this.#effects) effect.updatePlaybackRate(this.#clockSpeed);
    for (const { effect } of this.#healthBars.values()) effect?.updatePlaybackRate(this.#clockSpeed);
    this.#renderControls(this.#run.view.phase);
    this.#arm();
  }

  #renderControls(phase) {
    const active = phase in delay;
    const inRun = active || phase === "reward";
    const pause = byId("pause");
    const start = byId("start");
    const test = byId("test-battle");
    const speed = byId("speed");
    const restoreFocus = !inRun && pause === document.activeElement;
    pause.disabled = !active;
    pause.textContent = this.#paused ? "계속" : "일시정지";
    start.disabled = inRun;
    test.disabled = inRun;
    byId("launch-controls").hidden = inRun;
    test.textContent = phase === "testDone" ? "5대2 다시 보기" : "5대2 테스트";
    start.firstChild.nodeValue = phase === "ready" || phase === "testDone" ? "원정 시작 " : active ? "진행 중 " : "새 원정 ";
    speed.textContent = `${this.#speed}×`;
    speed.setAttribute("aria-label", `재생 속도 ${this.#speed}배`);
    if (restoreFocus) (phase === "testDone" ? test : start).focus();
  }

  #render(view, previous) {
    this.#renderControls(view.phase);
    const drafting = view.phase === "draft";
    byId("route-panel").hidden = view.testBattle || drafting;
    byId("crew-panel").hidden = drafting;
    const plan = byId("test-plan");
    plan.hidden = !view.testBattle;
    if (view.testBattle) {
      const step = view.phase === "battleResult" ? plan.children.length : view.clash?.group ?? plan.children.length;
      [...plan.children].forEach((item, index) => {
        item.classList.toggle("is-current", index === step);
        item.classList.toggle("is-complete", index < step);
        if (index === step) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
    }
    byId("distance").textContent = `${view.position} / ${route.length - 1}칸`;
    this.#tiles.forEach((cell, index) => {
      cell.classList.toggle("past", index < view.position);
      cell.classList.toggle("current", index === view.position);
      cell.classList.toggle("destination", view.phase === "travel" && index === view.destination);
      if (index === view.position) cell.setAttribute("aria-current", "step");
      else cell.removeAttribute("aria-current");
    });
    const inBattle = view.phase === "combat" || view.phase === "battleResult";
    const phase = byId("phase");
    phase.textContent = phases[view.phase];
    phase.classList.toggle("sr-only", inBattle || drafting);
    byId("stage").textContent = drafting ? "출발 편성" : view.testBattle ? "5대2 테스트 전투" : route[view.position].name;
    const message = byId("message");
    const status = drafting ? "" : view.message;
    if (message.textContent !== status) message.textContent = status;
    message.classList.toggle("sr-only", inBattle || drafting);
    byId("train").style.left = trainPosition(view.position);
    this.#renderDie(view, previous);
    this.#renderClash(view.clash);
    this.#renderDraft(view, previous);
    const notice = byId("scene-notice");
    notice.hidden = !view.notice;
    notice.dataset.kind = view.phase;
    byId("notice-title").textContent = view.notice?.title ?? "";
    byId("notice-detail").textContent = view.notice?.detail ?? "";
    if (!previous || view.phase === "reward" || previous.phase === "reward") this.#renderRewards(view);
    if (!previous || view.syncParts !== previous.syncParts || view.startingCost !== previous.startingCost
      || JSON.stringify(view.syncTarget) !== JSON.stringify(previous.syncTarget)
      || JSON.stringify(view.synergies) !== JSON.stringify(previous.synergies)) this.#renderGrowth(view);
    const impacts = view.clash?.stage === "impact" ? view.clash.lanes.filter((lane) => lane.hit) : [];
    const hitIds = (side, winner) => new Set(impacts.filter((lane) => lane.winner === winner).map((lane) => lane[side].id));
    const showingSkills = new Map(view.phase === "combat" ? view.clash.lanes.map((lane) => [lane.ally.id, lane.skills.ally]) : []);
    const allyHits = hitIds("ally", "enemy");
    const enemyHits = hitIds("enemy", "ally");
    const crewKey = JSON.stringify(view.crew.map((unit) => [unit.id, unit.slot, unit.hp, unit.maxHp, unit.spirit,
      unit.attack, unit.sync, allyHits.has(unit.id), showingSkills.get(unit.id)?.slot]));
    const enemyKey = JSON.stringify([view.enemies, [...enemyHits]]);
    if (this.#crewKey !== crewKey) {
      this.#renderCrew(view.crew, allyHits, showingSkills);
      this.#crewKey = crewKey;
    }
    if (this.#enemyKey !== enemyKey) {
      this.#renderEnemies(view.enemies, enemyHits);
      this.#enemyKey = enemyKey;
    }
    if (!previous || view.journal.length !== previous.journal.length || view.journal.some((line, index) => line !== previous.journal[index])) {
      byId("journal").replaceChildren(...view.journal.map((line) => element("li", "", line)));
    }
    byId("journal").closest("section").hidden = drafting || view.journal.length === 0;
  }

  #renderDie(view, previous) {
    const die = byId("dice");
    const rolling = view.phase === "roll";
    const traveling = view.phase === "travel";
    die.hidden = !rolling && !traveling;
    die.dataset.following = String(traveling && previous?.phase !== "roll");
    die.style.left = dicePosition(view, previous);
    const face = byId("dice-face");
    const value = byId("dice-value");
    const faces = byId("dice-faces");
    faces.hidden = !rolling || Boolean(this.#motion?.matches);
    face.hidden = !faces.hidden;
    face.textContent = rolling ? "…" : dieFaces[view.die - 1] ?? "–";
    value.hidden = rolling || view.die === null;
    value.textContent = view.die === null ? "" : String(view.die);
    die.setAttribute("aria-label", rolling ? "주사위를 굴리는 중" : view.die === null ? "주사위 대기" : `주사위 눈 ${view.die}`);
  }

  #renderDraft(view, previous) {
    const panel = byId("draft-panel");
    panel.hidden = view.phase !== "draft";
    if (panel.hidden) return;

    const cards = byId("draft-cards");
    const status = byId("draft-status");
    const count = view.draftCount;
    const budget = view.startingCost;
    const spent = view.crew.slice(0, count).reduce((sum, unit) => sum + unit.cost, 0);
    const complete = count === view.crew.length;
    if (previous?.phase !== "draft") {
      cards.replaceChildren(...view.crew.map((unit) => {
        const card = element("li", "draft-card");
        card.setAttribute("aria-label", "미공개 대원");
        const turn = element("div", "draft-card-turn");
        const back = element("div", "draft-card-face draft-card-back");
        back.setAttribute("aria-hidden", "true");
        back.append(element("span", "draft-card-mark", "✳"));
        const front = element("div", "draft-card-face draft-card-front");
        front.setAttribute("aria-hidden", "true");
        const art = element("span", "draft-portrait");
        art.setAttribute("aria-hidden", "true");
        setPortrait(art, unit, "card");
        const caption = element("div", "draft-caption");
        caption.append(element("strong", "", unit.name), element("span", "draft-cost", `코스트 ${unit.cost}`));
        front.append(art, caption);
        turn.append(back, front);
        card.append(turn);
        return card;
      }));
      status.textContent = `시작 코스트 ${budget}로 대원 네 명을 뽑습니다.`;
    }

    if (count > 0) {
      const unit = view.crew[count - 1];
      const card = cards.children[count - 1];
      card.classList.toggle("is-revealed", true);
      card.removeAttribute("aria-label");
      card.querySelector(".draft-card-front").removeAttribute("aria-hidden");
      status.textContent = `${unit.name} 영입, 코스트 ${unit.cost}. ${complete ? "출발 편성 완료." : `합계 ${spent}, 한도 ${budget}.`}`;
    }

    panel.classList.toggle("is-complete", complete);
    byId("draft-total").textContent = `${spent} / ${budget}`;
    const meter = byId("draft-meter");
    meter.setAttribute("aria-valuemax", String(budget));
    meter.setAttribute("aria-valuenow", String(spent));
    byId("draft-fill").style.width = `${spent / budget * 100}%`;
  }

  #renderClash(clash) {
    const arena = byId("arena");
    arena.hidden = !clash;
    if (!clash) {
      this.#clearHealthBars();
      return;
    }
    const lanes = byId("clash-lanes");
    lanes.style.setProperty("--engagement-count", clash.fieldSlots);
    const activeSlots = new Set(clash.lanes.map((lane) => String(lane.slot)));
    for (const row of [...lanes.children]) {
      if (!activeSlots.has(row.dataset.slot)) row.remove();
    }
    for (const [bar, state] of this.#healthBars) {
      if (bar.isConnected !== false) continue;
      state.effect?.cancel();
      this.#healthBars.delete(bar);
    }
    const action = clash.group === 0 ? "동시 합" : `추가 공격 ${clash.group}`;
    byId("clash-caption").textContent = `${clash.round}턴 · ${action} · ${clash.lanes.length}쌍${clash.waiting ? ` · 대기 ${clash.waiting}명` : ""}`;
    clash.lanes.forEach((lane, index) => {
      const slot = String(lane.slot);
      let node = [...lanes.children].find((row) => row.dataset.slot === slot);
      if (!node) {
        node = byId("clash-lane").content.firstElementChild.cloneNode(true);
        node.dataset.slot = slot;
        node.querySelector(".clash-sparks").append(...sparkVectors.map(() => element("i", "clash-spark")));
      }
      if (lanes.children[index] !== node) lanes.insertBefore(node, lanes.children[index] ?? null);
      node.style.gridColumn = String(lane.slot + 1);
      this.#renderLane(node, lane, clash);
    });
    this.#renderWaiting(clash);
  }

  #renderWaiting(clash) {
    const key = JSON.stringify([clash.waitingSide, clash.waitingSlots, clash.waitingUnits.map(({ id, hp, slot, spirit }) => [id, hp, slot, spirit])]);
    if (key === this.#waitingKey) return;
    this.#waitingKey = key;
    const row = byId("waiting-line");
    const list = byId("waiting-crew");
    row.hidden = clash.waitingSlots === 0;
    byId("waiting-label").textContent = `${clash.waitingSide === "ally" ? "아군" : "적"} 대기열 · ${clash.waiting}명`;
    list.style.setProperty("--queue-slots", Math.max(1, clash.waitingSlots));
    list.replaceChildren(...clash.waitingUnits.map((unit) => {
      const item = element("li", `waiting-unit ${clash.waitingSide}`);
      item.dataset.fighterId = unit.id;
      item.style.gridColumn = String(unit.slot + 1);
      const bar = element("span", "combat-hp");
      this.#renderHealthBar(bar, unit, false);
      const icon = element("span", "waiting-icon");
      setPortrait(icon, unit);
      const spirit = element("span", "combat-spirit");
      showSpirit(spirit, unit);
      item.append(icon, element("strong", "", unit.name), bar, spirit);
      if (unit.id === "brin") item.append(makeStandard());
      return item;
    }));
  }

  #waitingOrigins() {
    const origins = new Map();
    for (const item of byId("waiting-crew").children) {
      const badge = item.querySelector(".waiting-icon");
      origins.set(item.dataset.fighterId, badge.getBoundingClientRect());
    }
    return origins;
  }

  #renderLane(node, lane, { stage, group }) {
    const [allyPosition, enemyPosition] = clashPositions(stage, lane, group);
    const damaged = stage === "impact" && lane.hit;
    const attack = stage === "attackToss" || stage === "strike" || stage === "impact";
    const highlight = lane.winner ?? lane.exchangeWinner;
    const deciding = stage === "contact" && !lane.winner && !lane.draw;
    const verdict = (deciding || (stage === "break" && lane.broken)) && highlight;
    const damage = node.querySelector(".damage-number");
    const slash = node.querySelector(".slash");
    const finish = node.querySelector(".finish-burst");
    const victim = lane.winner === "ally" ? lane.enemy : lane.ally;
    const defeated = Boolean(damaged && victim.hp === 0);
    node.dataset.stage = stage;
    node.dataset.winner = highlight ?? "";
    const standardSpace = node.querySelector(".standard-space");
    standardSpace.hidden = lane.ally.id !== "brin" || lane.ally.hp === 0;
    if (!standardSpace.hidden) {
      if (!standardSpace.firstElementChild) standardSpace.append(makeStandard());
      const standard = standardSpace.firstElementChild;
      standard.style.left = allyPosition;
      standard.dataset.pose = standardPose(stage, lane);
      standard.style.setProperty("--standard-angle", `${standardAngles[standard.dataset.pose]}deg`);
    }
    node.classList.toggle("decisive-clash", Boolean(verdict && clashForce(lane) >= 1.6));
    const result = verdict === "ally" ? "승리" : verdict === "enemy" ? "패배" : "동점";
    const announcement = node.querySelector(".clash-announcement");
    if (deciding) announcement.textContent = `${lane.ally.name} 제 ${lane.exchanges}합 ${result}, ${lane.scores.ally} 대 ${lane.scores.enemy}`;
    else if (stage === "ready" && announcement.textContent) announcement.textContent = "";
    for (const [side, selector, position] of [["ally", ".ally", allyPosition], ["enemy", ".foe", enemyPosition]]) {
      const score = attack
        ? (lane.winner === side ? lane.attackPower : null)
        : lane.scores?.[side];
      const token = node.querySelector(`.combatant${selector}`);
      this.#renderCombatant(token, lane[side], score ?? "", position, highlight === side);
      const gain = token.querySelector(".combat-gain");
      const increase = stage === "reveal" ? lane.gain[side]
        : (stage === "strike" || stage === "impact") && lane.winner === side ? lane.hit?.gain : undefined;
      gain.hidden = !increase;
      gain.textContent = gain.hidden ? "" : signed(increase);
      const tag = token.querySelector(".win-tag");
      tag.hidden = !verdict;
      tag.classList.toggle("falls", verdict !== side);
      tag.textContent = verdict === side ? "▲" : "▼";
      const spirit = token.querySelector(".spirit-change");
      const change = stage === "break" ? lane.spiritChange[side] : undefined;
      spirit.hidden = !change;
      spirit.classList.toggle("is-loss", change < 0);
      spirit.textContent = spirit.hidden ? "" : signed(change);
      this.#renderCoins(token, lane, side, stage, group, attack);
    }
    const targetPosition = lane.winner === "ally" ? enemyPosition : allyPosition;
    slash.style.left = targetPosition;
    slash.hidden = stage !== "strike" || !lane.hit;
    slash.classList.toggle("from-enemy", lane.winner === "enemy");
    damage.style.left = targetPosition;
    damage.hidden = !damaged;
    damage.classList.toggle("is-finisher", defeated);
    damage.classList.toggle("is-blocked", damaged && lane.hit.damage === 0 && lane.hit.absorbed > 0);
    damage.textContent = damaged ? (lane.hit.damage ? `−${lane.hit.damage}` : `막음 ${lane.hit.absorbed}`) : "";
    finish.style.left = targetPosition;
    finish.hidden = !defeated;
  }

  #renderCoins(token, lane, side, stage, group, attack) {
    const strip = token.querySelector(".coins");
    const broken = stage === "break" && lane.broken === side;
    const count = group > 0 && side !== lane.winner ? 0 : lane.counts[side];
    const states = [];
    for (let i = 0; i < count + Number(broken); i += 1) {
      const isBroken = i === count;
      const current = attack && lane.winner === side && lane.hit?.number === i + 1;
      const tossing = stage === "toss" && !lane.winner && !lane.draw || stage === "attackToss" && current;
      const spent = attack && lane.winner === side && i < lane.hitsUsed && !current;
      const face = attack ? (lane.winner === side ? lane.attackFaces[i] : null) : lane.faces[side][i];
      const image = isBroken ? "broken" : face === true ? "coin" : face === false ? "tails" : "unrevealed";
      states.push({ image, isBroken, spent, tossing: Boolean(tossing), face });
    }
    const key = states.map(({ image, spent, tossing }) => `${image}:${Number(spent)}:${Number(tossing)}`).join("|");
    if (strip.dataset.coins === key) return;
    strip.dataset.coins = key;
    const coins = states.map(({ image, isBroken, spent, tossing, face }) => {
      const coin = element("span", "coin");
      setBitmap(coin, "combat-icons", 4, iconCells[image]);
      coin.setAttribute("aria-hidden", "true");
      coin.dataset.face = isBroken ? "파손" : face === true ? "앞면" : face === false ? "뒷면" : "미공개";
      coin.classList.toggle("coin-broken", isBroken);
      coin.classList.toggle("coin-spent", spent);
      coin.classList.toggle("coin-tossing", tossing);
      return coin;
    });
    strip.replaceChildren(...coins);
    strip.hidden = coins.length === 0;
    strip.setAttribute("aria-label", `코인 ${coins.length}개, ${coins.map((coin) => coin.dataset.face).join(", ")}`);
  }

  #renderCombatant(token, unit, score, position, winner) {
    token.style.left = position;
    token.classList.toggle("is-guarded", unit.guard > 0);
    token.classList.toggle("is-marked", unit.marked === true);
    const portrait = token.querySelector(".combat-icon");
    if (portrait.dataset.fighterId !== unit.id) {
      token.querySelector(".combat-name").textContent = unit.name;
      setPortrait(portrait, unit);
      portrait.dataset.fighterId = unit.id;
    }
    const scoreNode = token.querySelector(".combat-score");
    if (scoreNode.dataset.score !== String(score)) {
      scoreNode.dataset.score = String(score);
      scoreNode.textContent = score;
      scoreNode.setAttribute("aria-hidden", String(score === ""));
      scoreNode.setAttribute("aria-label", `위력 ${score}`);
    }
    this.#renderHealthBar(token.querySelector(".combat-hp"), unit);
    showSpirit(token.querySelector(".combat-spirit"), unit);
    token.classList.toggle("is-winner", winner);
    token.classList.toggle("is-defeated", unit.hp === 0);
  }

  #clearHealthBars() {
    for (const { effect } of this.#healthBars.values()) effect?.cancel();
    this.#healthBars.clear();
  }

  #renderHealthBar(bar, unit, animated = true) {
    const previous = this.#healthBars.get(bar);
    if (previous?.id === unit.id && previous.hp === unit.hp && previous.maxHp === unit.maxHp) return;
    if (!bar.querySelector(".hp-fill")) {
      bar.append(element("span", "hp-trail"), element("span", "hp-fill"), hudIcon("hp"), element("span", "hp-number"));
    }
    const cap = unit.maxHp || 1;
    const ratio = Math.max(0, Math.min(100, unit.hp / cap * 100));
    bar.setAttribute("role", "meter");
    bar.setAttribute("aria-label", `${unit.name} 체력`);
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(cap));
    bar.setAttribute("aria-valuenow", String(unit.hp));
    bar.querySelector(".hp-number").textContent = hpText(unit);
    bar.querySelector(".hp-fill").style.width = `${ratio}%`;
    const trail = bar.querySelector(".hp-trail");
    const progress = previous?.effect?.effect?.getComputedTiming().progress ?? 0;
    const from = previous?.effect
      ? previous.from + (previous.ratio - previous.from) * progress : previous?.ratio;
    previous?.effect?.cancel();
    trail.style.width = `${ratio}%`;
    let effect = null;
    if (animated && previous?.id === unit.id && ratio < previous.ratio && trail.animate && !this.#motion?.matches) {
      effect = trail.animate([{ width: `${from}%` }, { width: `${ratio}%` }], {
        delay: hpTrailDelay, duration: hpTrailDuration, easing: "linear", fill: "both",
      });
      effect.playbackRate = this.#clockSpeed;
      if (this.#paused) effect.pause();
    }
    if (animated) this.#healthBars.set(bar, { id: unit.id, hp: unit.hp, maxHp: unit.maxHp, ratio, from, effect });
  }

  #animate(node, keyframes, duration, easing = "ease-out", delay = 0) {
    if (this.#motion?.matches) return;
    this.#playEffect(node, keyframes, { duration, easing, delay });
  }

  #playEffect(node, keyframes, timing) {
    if (!node.animate) return;
    const effect = node.animate(keyframes, timing);
    effect.playbackRate = this.#clockSpeed;
    if (this.#paused) effect.pause();
    this.#effects.push(effect);
  }

  #playTransition(view, previous, waitingOrigins, dieOrigin) {
    if (view.phase === "draft") {
      if (view.draftCount > 0) this.#playDraftReveal(view);
      else [...byId("draft-cards").children].forEach((card, index) => {
        this.#animate(card, [
          { transform: "translateY(12px) scale(.96)", opacity: .15 },
          { transform: "translateY(0) scale(1)", opacity: 1 },
        ], 210, "ease-out", index * 24);
      });
      return;
    }
    if (view.notice) {
      this.#animate(byId("scene-notice"), [{ opacity: 0 }, { opacity: 1, offset: .16 },
        { opacity: 1, offset: .83 }, { opacity: 0 }], delay[view.phase], "ease-in-out");
      return;
    }
    if (view.phase === "roll") {
      this.#animate(byId("dice"), [
        { transform: "translateY(0) rotate(-9deg)" },
        { transform: "translateY(-9px) rotate(12deg)" },
        { transform: "translateY(0) rotate(-12deg)" },
        { transform: "translateY(-5px) rotate(8deg)" },
        { transform: "translateY(0) rotate(0)" },
      ], delay.roll, "ease-in-out");
      const previews = [0, 2, 1, 2, 0, 1];
      [...byId("dice-faces").children].forEach((face, index) => {
        const frames = [...previews, previews.at(-1)].map((value) => ({ opacity: Number(value === index) }));
        this.#animate(face, frames, delay.roll, "steps(6, end)");
      });
    } else if (previous?.phase === "roll" && view.phase === "travel") {
      this.#animate(byId("dice"), [
        { transform: "scale(.88)", backgroundColor: "#354353" },
        { transform: "scale(1.12)", backgroundColor: "#5a482f", offset: .32 },
        { transform: "scale(1)", backgroundColor: "#152b3f" },
      ], 320);
    }
    if (previous && previous.position !== view.position) {
      this.#animate(byId("train"), [
        { left: trainPosition(previous.position) }, { left: trainPosition(view.position) },
      ], delay.travel - 30, "cubic-bezier(.24,.72,.49,1)");
      const die = byId("dice");
      this.#animate(die, [{ left: dieOrigin.left, scale: dieOrigin.following ? .62 : 1 },
        { left: die.style.left, scale: .62 }], delay.travel - 30, "ease-out");
    }
    if (view.clash && previous?.clash) {
      this.#playClash(view.clash, previous.clash);
      if (waitingOrigins) this.#playDispatch(view.clash, waitingOrigins);
    }
  }

  #playDraftReveal(view) {
    const card = byId("draft-cards").children[view.draftCount - 1];
    const turn = card.querySelector(".draft-card-turn");
    if (this.#motion?.matches) {
      const timing = { duration: reducedDraftFlipTime, easing: "ease-in-out" };
      this.#playEffect(turn, [
        { transform: "scaleX(1)" }, { transform: "scaleX(.64)", offset: .5 }, { transform: "scaleX(1)" },
      ], timing);
      this.#playEffect(card.querySelector(".draft-card-back"), [
        { opacity: 1, easing: "steps(1, end)" }, { opacity: 0, offset: .5 }, { opacity: 0 },
      ], timing);
      return;
    }

    this.#animate(turn, [
      { transform: "translateY(0) rotateY(180deg) scale(1)", easing: "ease-out" },
      { transform: "translateY(-3px) rotateY(190deg) scale(.99)", offset: .16, easing: "ease-in" },
      { transform: "translateY(-6px) rotateY(90deg) scale(.93)", offset: .48, easing: "ease-out" },
      { transform: "translateY(-2px) rotateY(-7deg) scale(.99)", offset: .81, easing: "ease-in-out" },
      { transform: "translateY(0) rotateY(0deg) scale(1)" },
    ], draftFlipTime, "linear");
    const fill = byId("draft-fill");
    const spent = view.crew.slice(0, view.draftCount - 1).reduce((sum, unit) => sum + unit.cost, 0);
    const from = `${spent / view.startingCost * 100}%`;
    this.#animate(fill, [{ width: from }, { width: from, offset: .48, easing: "ease-out" }, { width: fill.style.width }],
      draftFlipTime, "linear");
    if (view.draftCount === view.crew.length) {
      this.#animate(byId("draft-total"), [
        { transform: "scale(1)" }, { transform: "scale(1.13)", offset: .34 }, { transform: "scale(1)" },
      ], 420, "ease-out", 470);
    }
  }

  #playDispatch(clash, origins) {
    clash.lanes.forEach((lane, index) => {
      const origin = origins.get(lane[lane.winner].id);
      if (!origin || this.#motion?.matches) return;
      const row = byId("clash-lanes").children[index];
      const token = row.querySelector(lane.winner === "ally" ? ".combatant.ally" : ".combatant.foe");
      const target = token.querySelector(".combat-icon").getBoundingClientRect();
      const dx = origin.left + origin.width / 2 - target.left - target.width / 2;
      const dy = origin.top + origin.height / 2 - target.top - target.height / 2;
      this.#animate(token, [
        { transform: `translate(calc(-50% + ${dx}px), ${dy}px)` },
        { transform: `translate(calc(-50% + ${dx * .28}px), ${dy * .28 - 7}px) rotate(-7deg)`, offset: .62 },
        { transform: "translateX(-50%)" },
      ], dispatchTime - 20, "ease-out");
      if (lane.winner === "ally" && lane.ally.id === "brin") {
        this.#animate(row.querySelector(".brin-standard"), [
          { transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" },
        ], dispatchTime - 20, "ease-out");
      }
    });
  }

  #playClash(clash, previous) {
    const sameGroup = clash.round === previous.round && clash.group === previous.group;
    const active = sameGroup && clash.stage === "contact"
      ? clash.lanes.filter((_, index) => !previous.lanes[index]?.winner && !previous.lanes[index]?.draw)
      : [];
    if (active.length) {
      const force = Math.max(...active.map(clashForce));
      const shake = Math.round(4 * force);
      this.#animate(byId("arena"), [
        { transform: "translate(0, 0)" }, { transform: `translate(${-shake}px, 1px)` },
        { transform: `translate(${shake}px, -2px)` }, { transform: "translate(-2px, 1px)" },
        { transform: "translate(0, 0)" },
      ], Math.round(180 + force * 30), "ease-out");
    }
    clash.lanes.forEach((lane, index) => this.#playLane(
      byId("clash-lanes").children[index], clash.stage, lane, clash.group, sameGroup ? previous : null, index,
    ));
  }

  #playLane(node, stage, lane, group, previous, laneIndex) {
    const lastLane = previous?.lanes[laneIndex];
    if (!lastLane) return;
    const from = clashPositions(previous.stage, lastLane, group);
    const to = clashPositions(stage, lane, group);
    const retreat = stage === "break" && willReengage(lane);
    const reengage = stage === "toss" && previous.stage === "break" && willReengage(lane);
    if (lane.ally.id === "brin" && lane.ally.hp > 0 && lastLane.ally.id === "brin") {
      this.#playStandard(node.querySelector(".brin-standard"), stage, standardPose(previous.stage, lastLane), from[0], to[0]);
    }
    [".combatant.ally", ".combatant.foe"].forEach((selector, index) => {
      if (from[index] === to[index]) return;
      const token = node.querySelector(selector);
      const easing = retreat || reengage ? recoilEase : stage === "strike" ? "cubic-bezier(.39,0,.69,.21)" : "ease-out";
      const duration = clashDelay[stage] - (retreat || reengage ? 45 : 20);
      this.#animate(token, [{ translate: laneTranslation(from[index], to[index]) }, { translate: "0px 0px" }], duration, easing);
      if (retreat) {
        const tilt = index === 0 ? -10 : 10;
        this.#animate(token, [
          { transform: "translateX(-50%)" },
          { transform: `translate(-50%, 5px) rotate(${tilt}deg)`, offset: .27 },
          { transform: "translateX(-50%)" },
        ], clashDelay.break - 45, recoilEase);
      }
    });
    if (reengage) this.#playClashSparks(node, .52 * clashForce(lastLane), 115);
    if (stage === "toss" || stage === "attackToss") {
      for (const coin of node.querySelectorAll(".coin-tossing")) {
        this.#animate(coin, [
          { transform: "translateY(0) scaleX(1)" }, { transform: "translateY(-8px) scaleX(.15)" },
          { transform: "translateY(-9px) scaleX(-1)" }, { transform: "translateY(-5px) scaleX(-.15)" },
          { transform: "translateY(0) scaleX(1)" },
        ], clashDelay[stage] - 10, "ease-in-out");
      }
    } else if (stage === "reveal") {
      for (const gain of node.querySelectorAll(".combat-gain")) {
        if (gain.hidden) continue;
        this.#animate(gain, [
          { transform: "translateY(4px) scale(.86)" },
          { transform: "translateY(-2px) scale(1.13)", offset: .42 },
          { transform: "translateY(-3px) scale(1)" },
        ], clashDelay.reveal);
      }
    } else if (stage === "break" && lane.broken && !lastLane.winner) {
      const coin = node.querySelector(".coin-broken");
      const force = clashForce(lane);
      this.#animate(coin, [
        { transform: "scale(1.25)", opacity: 1 },
        { transform: `translateY(${Math.round(6 * force)}px) rotate(${Math.round(35 * force)}deg) scale(.5)`, opacity: .14 },
      ], clashDelay.break);
    } else if (stage === "contact" && !lastLane.winner && !lastLane.draw) {
      const force = clashForce(lane);
      this.#playClashSparks(node, force);
      this.#animate(node.querySelector(".clash-flash"), [
        { opacity: .98, transform: "translate(-50%, -50%) scale(.3)" },
        { opacity: .58, transform: `translate(-50%, -50%) scale(${1 + force * .39})`, offset: .33 },
        { opacity: 0, transform: `translate(-50%, -50%) scale(${1.4 + force * .56})` },
      ], Math.round(270 + 60 * force));
      if (lane.exchangeWinner) {
        for (const [index, side] of ["ally", "enemy"].entries()) {
          const winner = lane.exchangeWinner === side;
          const direction = side === "ally" ? -1 : 1;
          const dx = Math.round(direction * (winner ? -4 : 9) * force);
          const dy = Math.round((winner ? -13 : 10) * force);
          const position = to[index];
          const shifted = (offset) => clampLanePosition(`calc(${position} + ${Math.round(dx * offset)}px)`);
          const token = node.querySelector(side === "ally" ? ".combatant.ally" : ".combatant.foe");
          const duration = Math.round(270 + 55 * force);
          this.#animate(token, [
            { translate: "0px 0px", transform: "translateX(-50%)" },
            { translate: laneTranslation(shifted(1), position), transform: `translate(-50%, ${dy}px)`, offset: .22 },
            { translate: laneTranslation(shifted(.4), position), transform: `translate(-50%, ${Math.round(dy * .4)}px)`, offset: .65 },
            { translate: "0px 0px", transform: "translateX(-50%)" },
          ], duration);
          const angle = Math.round(direction * (winner ? -2 : 3) * force);
          this.#animate(token.querySelector(".combat-icon"), [
            { transform: "rotate(0)" }, { transform: `rotate(${angle}deg)`, offset: .22 }, { transform: "rotate(0)" },
          ], duration);
        }
      }
    } else if (stage === "strike" && lane.hit) {
      const angle = lane.winner === "ally" ? -27 : 27;
      this.#animate(node.querySelector(".slash"), [
        { opacity: 0, transform: `translateX(-50%) rotate(${angle}deg) scaleX(.2)` },
        { opacity: 1, transform: `translateX(-50%) rotate(${angle}deg) scaleX(1)`, offset: .72 },
        { opacity: .8, transform: `translateX(-50%) rotate(${angle}deg) scaleX(1.16)` },
      ], clashDelay.strike);
    } else if (stage === "impact" && lane.hit) {
      const target = node.querySelector(lane.winner === "ally" ? ".combatant.foe" : ".combatant.ally");
      const finishing = (lane.winner === "ally" ? lane.enemy : lane.ally).hp === 0;
      this.#animate(target.querySelector(".combat-icon"), finishing ? [
        { transform: "scale(1.15)", filter: "brightness(2)" },
        { transform: "translateY(7px) rotate(-19deg) scale(.72)", opacity: .64, offset: .6 },
        { transform: "translateY(8px) rotate(-12deg) scale(.78)", opacity: .42 },
      ] : [
        { transform: "rotate(-14deg) scale(.84)", filter: "brightness(2.35)" },
        { transform: "rotate(9deg) scale(1.09)", filter: "brightness(1.5)", offset: .3 },
        { transform: "rotate(0) scale(1)", filter: "brightness(1)" },
      ], 315);
      if (finishing) this.#animate(node.querySelector(".finish-burst"), [
        { opacity: 1, transform: "translate(-50%, -50%) scale(.32) rotate(0)" },
        { opacity: .95, transform: "translate(-50%, -50%) scale(.96) rotate(18deg)", offset: .32 },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.6) rotate(38deg)" },
      ], clashDelay.impact);
      this.#animate(node.querySelector(".damage-number"), [
        { opacity: 1, transform: "translate(-50%, 3px) scale(.72)" },
        { opacity: 1, transform: "translate(-50%, -11px) scale(1.23)", offset: .33 },
        { opacity: .12, transform: "translate(-50%, -24px) scale(1)" },
      ], clashDelay.impact, "ease-out");
    }
  }

  #playStandard(standard, stage, previousPose, from, to) {
    const pose = standard.dataset.pose;
    const duration = clashDelay[stage];
    if (from !== to) this.#animate(standard, [{ translate: laneTranslation(from, to) }, { translate: "0px 0px" }], duration - 20);
    if (pose === previousPose) return;

    const rig = standard.querySelector(".standard-rig");
    const cloth = standard.querySelector(".standard-cloth");
    const start = { transform: `rotate(${standardAngles[previousPose]}deg)` };
    const end = { transform: `rotate(${standardAngles[pose]}deg)` };
    const raised = { transform: "var(--standard-sweep-offset)" };
    const grounded = { transform: "translate(0, 0)" };
    const unfurled = { transform: "var(--standard-unfurled)" };
    if (pose === "swept") {
      const swingTime = Math.min(360, duration);
      this.#animate(standard, [grounded, { ...raised, offset: .54 }, raised], swingTime, "ease-out");
      this.#animate(rig, [start, { transform: "rotate(-15deg)", offset: .16 },
        { transform: "rotate(73deg)", offset: .68 }, end], swingTime, "ease-out");
      this.#animate(cloth, [
        { transform: "scaleX(.8) skewY(-8deg)" },
        { transform: "rotate(calc(var(--standard-cloth-angle) - 10deg)) scaleX(1.14) skewY(12deg)", offset: .68 },
        unfurled,
      ], swingTime);
    } else {
      const settleTime = Math.min(250, duration);
      this.#animate(rig, [start, end], settleTime);
      if (previousPose === "swept") {
        this.#animate(standard, [raised, grounded], settleTime);
        this.#animate(cloth, [unfurled, { transform: "rotate(0deg)" }], settleTime);
      }
    }
  }

  #playClashSparks(node, force, delay = 0) {
    const sparks = node.querySelector(".clash-sparks").children;
    sparkVectors.forEach(([x, y], index) => {
      const angle = Math.round(Math.atan2(y, x) * 180 / Math.PI);
      const flyX = Math.round(x * force);
      const flyY = Math.round(y * force);
      this.#animate(sparks[index], [
        { opacity: 0, transform: `translate(0, 0) rotate(${angle}deg) scaleX(.3)` },
        { opacity: .98, transform: `translate(${Math.round(flyX * .57)}px, ${Math.round(flyY * .57)}px) rotate(${angle}deg)`, offset: .3 },
        { opacity: 0, transform: `translate(${flyX}px, ${flyY + 6}px) rotate(${angle}deg) scaleX(.42)` },
      ], 180, recoilEase, delay);
    });
  }

  #renderRewards(view) {
    const panel = byId("recruit-panel");
    const { reward: packs, recruitChoice: choice, crew } = view;
    panel.hidden = view.phase !== "reward";
    const comparison = byId("recruit-comparison");
    comparison.hidden = panel.hidden || !choice?.selectedId;
    if (comparison.hidden) comparison.replaceChildren();
    if (panel.hidden) return;
    const list = byId("recruit-packs");
    const title = byId("recruit-title");
    const actions = byId("recruit-actions");
    list.classList.toggle("is-identities", Boolean(choice && !choice.selectedId));
    list.classList.toggle("is-replacements", Boolean(choice?.selectedId));
    actions.replaceChildren();
    if (choice?.selectedId) {
      const incoming = crewById[choice.selectedId];
      const recommended = choice.candidates.find(({ id }) => id === incoming.id).replacementId;
      title.textContent = `${incoming.name} 영입 · 교체할 대원 선택`;
      const options = new Map(choice.replacements.map((option) => [option.id, option]));
      list.replaceChildren(...crew.map((unit) => {
        const button = element("button", "recruit-pack replacement-choice");
        button.type = "button";
        button.dataset.replacementId = unit.id;
        const changes = options.get(unit.id).changes;
        const gains = changes.filter(({ previous, next }) => next > previous).length;
        const losses = changes.length - gains;
        button.append(element("strong", "pack-name", unit.name));
        const totals = element("span", "replacement-totals");
        if (gains) totals.append(element("span", "synergy-gain", `+${gains}`));
        if (losses) totals.append(element("span", "synergy-loss", `−${losses}`));
        if (!changes.length) totals.append(element("span", "pack-count", "변화 없음"));
        button.append(totals);
        if (unit.id === recommended) button.append(element("span", "recruit-recommendation", "추천"));
        button.setAttribute("aria-label", `${unit.name}${unit.id === recommended ? ", 추천" : ""}, 얻는 시너지 ${gains}개, 잃는 시너지 ${losses}개`);
        button.addEventListener("click", () => {
          if (this.#run.previewReplacement(unit.id)) this.#renderReplacementPreview(this.#run.view);
        });
        return button;
      }));
      const confirm = element("button", "primary confirm-replacement");
      confirm.type = "button";
      confirm.addEventListener("click", () => this.#rewardAction(() => this.#run.replaceRecruit(this.#run.view.recruitChoice?.replacementId)));
      actions.append(confirm);
      this.#renderReplacementPreview(view);
    } else if (choice) {
      title.textContent = `${choice.name} · 인격 1명 선택`;
      list.replaceChildren(...choice.candidates.map(({ id, reason, recommended, duplicate }) => {
        const unit = crewById[id];
        const button = element("button", "recruit-pack identity-choice");
        button.type = "button";
        const art = element("span", "identity-art");
        art.setAttribute("aria-hidden", "true");
        setPortrait(art, unit, "card");
        const caption = element("span", "identity-caption");
        caption.append(element("strong", "pack-name", unit.name), element("span", "pack-count", duplicate ? "중복 · 재료 +2" : unit.affiliation));
        if (recommended) caption.append(element("span", "recruit-recommendation", `추천 · ${reason}`));
        button.append(art, caption);
        button.addEventListener("click", () => this.#rewardAction(() => this.#run.chooseIdentity(id)));
        return button;
      }));
    } else {
      title.textContent = "영입 팩 선택";
      list.replaceChildren(...packs.map(({ field, key, label, name, cost, deployedCount, candidates, reason, recommended }) => {
        const button = element("button", "recruit-pack recruit-choice");
        button.type = "button";
        button.append(element("span", "pack-category", label), element("strong", "pack-name", name),
          element("span", "pack-cost", `${cost}코스트 확정`), element("span", "pack-count", `후보 ${candidates.length}명 · 출전 ${deployedCount}명`));
        if (recommended) button.append(element("span", "recruit-recommendation", `추천 · ${reason}`));
        button.setAttribute("aria-label", `${name} ${cost}코스트 확정, 후보 ${candidates.length}명, 출전 ${deployedCount}명${recommended ? `, 추천 ${reason}` : ""}`);
        button.addEventListener("click", () => this.#rewardAction(() => this.#run.chooseReward(field, key, cost)));
        return button;
      }));
    }
    if (choice) {
      if (choice.selectedId || packs?.length) {
        const back = element("button", "control", choice.selectedId ? "인격 다시 고르기" : "팩 다시 고르기");
        back.type = "button";
        back.addEventListener("click", () => this.#rewardAction(() => this.#run.backRecruit()));
        actions.append(back);
      }
      const skip = element("button", "control", "영입 건너뛰기");
      skip.type = "button";
      skip.addEventListener("click", () => this.#rewardAction(() => this.#run.skipRecruit()));
      actions.append(skip);
    }
    title.focus({ preventScroll: true });
  }

  #renderReplacementPreview({ recruitChoice: choice, crew }) {
    const outgoing = crew.find((unit) => unit.id === choice.replacementId);
    const incoming = crewById[choice.selectedId];
    const { changes } = choice.replacements.find(({ id }) => id === outgoing.id);
    for (const button of byId("recruit-packs").querySelectorAll(".replacement-choice")) {
      button.setAttribute("aria-pressed", String(button.dataset.replacementId === outgoing.id));
    }
    byId("recruit-actions").querySelector(".confirm-replacement").textContent = `교체 확정 · ${outgoing.name}`;

    const cards = element("div", "replacement-cards");
    for (const [unit, title, kind] of [[outgoing, "기존 대원", "outgoing"], [incoming, "새 인격", "incoming"]]) {
      const card = element("article", `replacement-card replacement-${kind}`);
      const art = element("span", "replacement-art");
      art.setAttribute("aria-hidden", "true");
      setPortrait(art, unit, "card");
      const info = element("div", "replacement-info");
      const name = element("strong", "replacement-name", unit.name);
      const badges = element("span", "unit-badges");
      const sync = unit.sync ?? 1;
      badges.append(crewBadge("cost", unit.cost), crewBadge("sync", sync, syncMarks[sync]));
      info.append(element("span", "pack-category", title), name, element("span", "pack-count", unit.affiliation),
        badges, element("span", "pack-count", `체력 ${unit.hp ?? unit.maxHp} / ${unit.maxHp}`));
      card.append(art, info);
      cards.append(card);
    }

    const effects = element("div", "replacement-effects");
    const bonusText = (bonus, unit) => bonus ? `+${bonus}${unit ?? ""}` : "미적용";
    for (const [title, kind, positive] of [["얻는 시너지", "gain", true], ["잃는 시너지", "loss", false]]) {
      const group = element("div", `replacement-effect-group synergy-${kind}`);
      group.append(element("h4", "", title));
      const matching = changes.filter(({ previous, next }) => (next > previous) === positive);
      if (!matching.length) group.append(element("p", "pack-count", "없음"));
      else {
        const list = element("ul", "replacement-effect-list");
        list.append(...matching.map(({ field, name, label, unit, previous, next }) => {
          const item = element("li", "replacement-effect");
          const status = previous === 0 ? "활성" : next === 0 ? "해제" : positive ? "강화" : "약화";
          item.append(element("strong", "effect-name", `${crewSetLabels[field]} · ${name}`),
            element("span", "effect-value", `${status} · ${label} ${bonusText(previous, unit)} → ${bonusText(next, unit)}`));
          return item;
        }));
        group.append(list);
      }
      effects.append(group);
    }
    byId("recruit-comparison").replaceChildren(cards, effects);
  }

  #rewardAction(action) {
    if (!action()) return;
    this.#next();
    if (byId("recruit-panel").hidden) byId("pause").focus({ preventScroll: true });
  }

  #renderGrowth(view) {
    byId("crew-growth").hidden = view.startingCost === null;
    const target = view.syncTarget;
    const progress = target ? `${target.name} 동기화 ${syncMarks[target.level]} 재료 ${view.syncParts}/${target.required}` : `동기화 재료 ${view.syncParts}`;
    byId("sync-parts").textContent = `시작 코스트 ${view.startingCost} · ${progress}`;
    byId("synergies").replaceChildren(...view.synergies.map(({ field, name, count, label, bonus, unit }) => {
      const item = element("li", `synergy ${field === "affiliation" ? "is-main" : ""}`);
      item.append(element("span", "synergy-tier", crewSetLabels[field]),
        element("span", "", `${name} ${count}명 · ${label} +${bonus}${unit ?? ""}`));
      return item;
    }));
  }

  #renderCrew(crew, hitIds, showingSkills) {
    byId("crew-count").textContent = `${crew.length}/${deploymentLimit}명`;
    const list = byId("crew");
    const previousPreview = this.#skillPreview;
    const focusedKey = document.activeElement?.dataset.skillKey;
    const focusedSummary = document.activeElement?.dataset.crewSummary;
    const previews = new Map();
    const order = (unit) => unit.slot < 0 ? crew.length : unit.slot;
    const ordered = [...crew].sort((a, b) => order(a) - order(b));
    const rows = ordered.map((unit) => {
      const old = this.#crewRows.get(unit.id);
      const entry = old && old.sync === unit.sync ? old : this.#buildCrewRow(unit, old?.details.open);
      this.#crewRows.set(unit.id, entry);
      const { row, state, hpValue, meter, spirit, rating } = entry;
      row.classList.toggle("reserve", unit.slot < 0 || unit.hp === 0);
      row.classList.toggle("is-hit", hitIds.has(unit.id));
      const stateText = unit.hp === 0 ? "이탈" : unit.slot < 0 ? "대기" : `출전 ${unit.slot + 1}`;
      if (state.textContent !== stateText) state.textContent = stateText;
      if (meter.value !== unit.hp || meter.max !== unit.maxHp) {
        meter.value = unit.hp;
        meter.max = unit.maxHp;
        meter.setAttribute("aria-label", `${unit.name} 체력 ${hpText(unit)}`);
        hpValue.textContent = hpText(unit);
      }
      const spiritText = signed(unit.spirit ?? 0);
      if (spirit.textContent !== spiritText) spirit.textContent = spiritText;
      const powerText = `전투력 ${unit.power}`;
      if (rating.textContent !== powerText) rating.textContent = powerText;
      const current = showingSkills.get(unit.id)?.slot;
      entry.previews.forEach((preview, index) => {
        preview.item.classList.toggle("is-current", current === index + 1);
        previews.set(preview.key, preview);
      });
      return row;
    });
    for (const [id] of this.#crewRows) if (!ordered.some((unit) => unit.id === id)) this.#crewRows.delete(id);
    for (const old of [...list.children]) if (!rows.includes(old)) old.remove();
    rows.forEach((row, index) => {
      if (list.children[index] !== row) list.insertBefore(row, list.children[index] ?? null);
    });
    const restored = previews.get(previousPreview?.key);
    if (restored) restored.pinned = previousPreview.pinned;
    if (focusedKey && document.activeElement !== previews.get(focusedKey)?.trigger) previews.get(focusedKey)?.trigger.focus({ preventScroll: true });
    else if (focusedSummary && document.activeElement !== this.#crewRows.get(focusedSummary)?.summary) {
      this.#crewRows.get(focusedSummary)?.summary.focus({ preventScroll: true });
    }
    this.#showSkillDetail(restored ?? null);
  }

  #buildCrewRow(unit, open = false) {
    const row = element("li", "crew-row");
    const portrait = element("span", "portrait");
    portrait.setAttribute("aria-hidden", "true");
    setPortrait(portrait, unit, "card");
    const bio = element("span", "crew-bio");
    const state = element("span", "unit-state");
    const name = element("span", "crew-name");
    name.append(element("strong", "", unit.name), state);
    bio.append(name);
    if (unit.sync !== undefined) {
      const badges = element("span", "unit-badges");
      badges.append(crewBadge("cost", unit.cost), crewBadge("sync", unit.sync, syncMarks[unit.sync]));
      bio.append(badges);
    }
    const vitals = element("span", "crew-vitals");
    const hp = iconValue("hp", "체력", hpText(unit));
    const meter = health(unit);
    vitals.append(hp, meter);
    bio.append(vitals, element("span", "crew-info-label", "대원 정보"));
    const summary = element("summary", "crew-summary");
    summary.dataset.crewSummary = unit.id;
    summary.append(portrait, bio);

    const setNames = { affiliation: unit.affiliation, type: attackTypes[unit.type], affinity: affinities[unit.affinity],
      animal: unit.animal, weapon: unit.weapon };
    const details = element("details", "crew-details");
    details.dataset.unitId = unit.id;
    details.open = open;
    const data = element("div", "crew-detail-body");
    const traits = element("dl", "crew-traits");
    for (const field of unit.sets ?? []) {
      if (!setNames[field]) continue;
      const trait = element("div", "crew-trait");
      trait.append(element("dt", "", crewSetLabels[field]), element("dd", "", setNames[field]));
      traits.append(trait);
    }
    if (traits.firstElementChild) data.append(traits);
    else if (unit.identity) data.append(element("p", "", unit.identity));
    const stats = unitStats(unit);
    const rating = element("p", "", `전투력 ${unit.power}`);
    data.append(stats, unitResists(unit), rating);
    details.append(summary, data);

    const skills = element("ol", "skill-list");
    const previews = (unit.skills ?? [null]).map((skill, index) => {
      const preview = skillCard(unit, skill ? skillProfile(unit, index) : null, index);
      this.#bindSkillDetail(preview);
      return preview;
    });
    skills.append(...previews.map(({ item }) => item));
    row.append(details, skills);
    return { row, state, hpValue: hp.lastElementChild, meter, spirit: stats.lastElementChild.lastElementChild,
      summary, details, rating, sync: unit.sync, previews };
  }

  #bindSkillDetail(preview) {
    const { item, trigger } = preview;
    item.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" && !this.#skillPreview?.pinned) this.#showSkillDetail(preview);
    });
    item.addEventListener("pointerleave", () => {
      if (this.#skillPreview === preview && !preview.pinned && !trigger.matches(":focus-visible")) this.#showSkillDetail(null);
    });
    trigger.addEventListener("focus", () => {
      if (trigger.matches(":focus-visible")) this.#showSkillDetail(preview);
    });
    trigger.addEventListener("blur", () => {
      if (this.#skillPreview === preview && !preview.pinned && !item.matches(":hover")) this.#showSkillDetail(null);
    });
    trigger.addEventListener("click", () => {
      const closing = this.#skillPreview === preview && preview.pinned;
      preview.pinned = !closing;
      this.#showSkillDetail(closing ? null : preview);
    });
  }

  #showSkillDetail(preview) {
    if (this.#skillPreview === preview) return;
    if (this.#skillPreview) {
      const { trigger, detail } = this.#skillPreview;
      trigger.setAttribute("aria-expanded", "false");
      detail.hidden = true;
      this.#skillPreview.pinned = false;
    }
    this.#skillPreview = preview;
    if (preview) {
      const { trigger, detail } = preview;
      trigger.setAttribute("aria-expanded", "true");
      detail.hidden = false;
      detail.classList.toggle("opens-up", false);
      const panel = detail.getBoundingClientRect();
      detail.classList.toggle("opens-up", panel.bottom > globalThis.innerHeight && trigger.getBoundingClientRect().top >= panel.height);
    }
  }

  #renderEnemies(enemies, hitIds) {
    const list = byId("enemies");
    list.hidden = enemies.length === 0;
    list.replaceChildren(...enemies.map((unit) => {
      const tile = element("li", "enemy");
      tile.classList.toggle("is-hit", hitIds.has(unit.id));
      tile.append(element("strong", "", unit.name), iconValue("hp", "체력", hpText(unit)), health(unit),
        unitStats(unit), unitResists(unit));
      return tile;
    }));
  }
}

new GameScreen();
