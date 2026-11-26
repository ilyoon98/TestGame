"use strict";

const byId = (id) => document.getElementById(id);
const delay = { roll: 740, travel: 340, combat: 0, stop: 1750, battleResult: 2200 };
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
  ready: "출발 대기", roll: "주사위 준비", travel: "자동 이동", combat: "자동 전투",
  stop: "정차", battleResult: "전투 결과", won: "원정 성공", lost: "원정 종료", testDone: "테스트 완료",
};
const speeds = [1, 2, 4];

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
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

function setBitmap(node, sheet, columns, cell) {
  const step = 100 / (columns - 1);
  node.style.backgroundImage = `url("assets/${sheet}-simple.png")`;
  node.style.backgroundSize = `${columns * 100}% ${columns * 100}%`;
  node.style.backgroundPosition = `${cell % columns * step}% ${Math.floor(cell / columns) * step}%`;
}

function setPortrait(node, unit) {
  const cell = portraitCells[unit.id];
  if (cell === undefined) node.textContent = unit.icon;
  else {
    node.textContent = "";
    setBitmap(node, "portraits", 3, cell);
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
  node.replaceChildren(hudIcon("spirit", "정신력"), element("span", "", signed(unit.spirit ?? 0)));
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
const attackTypes = { slash: "참격", pierce: "관통", blunt: "타격" };
const affinities = { steam: "증기", frost: "서리", current: "전류" };

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

function skillCard(unit, skill, position, current) {
  const item = element("li", "coin-profile");
  item.classList.toggle("is-current", current);
  const picture = element("span", "skill-picture");
  picture.setAttribute("aria-hidden", "true");
  const row = portraitCells[unit.id];
  const sheet = row < 3 ? "skills-naru-ian-yul" : "skills-seol-jin-onha";
  const pictureIndex = skill ? position : unit.id === "seol" ? 1 : 0;
  setBitmap(picture, sheet, 3, row % 3 * 3 + pictureIndex);

  const copy = element("div", "skill-copy");
  const heading = element("div", "skill-heading");
  const count = coinCount(unit, skill);
  const coins = element("span", "skill-coins");
  coins.setAttribute("role", "img");
  coins.setAttribute("aria-label", `코인 ${count}개`);
  coins.append(...Array.from({ length: count }, () => hudIcon("coin")));
  heading.append(element("strong", "", skill ? `${position + 1}. ${skill.name}` : unit.skillName), coins);

  const meta = element("div", "skill-meta");
  const type = skill?.type ?? unit.type ?? "blunt";
  const affinity = skill?.affinity ?? unit.affinity ?? "steam";
  meta.append(element("span", "", `기본 ${baseStrength(unit, skill)} · 앞면 ${signed(coinStrength(unit, skill))}`),
    hudIcon(type, attackTypes[type]), hudIcon(affinity, affinities[affinity]));
  copy.append(heading, meta);
  item.append(picture, copy);
  return item;
}

function clashForce(lane) {
  const gap = lane.scores ? Math.abs(lane.scores.ally - lane.scores.enemy) : 0;
  return Math.min(2.2, 1 + Math.max(0, gap - 3) / 7);
}

class GameScreen {
  #run;
  #tiles;
  #lastView = null;
  #crewKey = null;
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

  constructor() {
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
    this.#enemyKey = null;
    const [seed] = crypto.getRandomValues(new Uint32Array(1));
    this.#run = new Expedition(seededRandom(seed), seededRandom(seed ^ 0x9e3779b9));
    if (mode === "expedition") this.#run.start();
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
      this.#run.advance();
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
    const pause = byId("pause");
    const start = byId("start");
    const test = byId("test-battle");
    const speed = byId("speed");
    const restoreFocus = !active && pause === document.activeElement;
    pause.disabled = !active;
    pause.textContent = this.#paused ? "계속" : "일시정지";
    start.disabled = active;
    test.disabled = active;
    byId("launch-controls").hidden = active;
    test.textContent = phase === "testDone" ? "5대2 다시 보기" : "5대2 테스트";
    start.firstChild.nodeValue = phase === "ready" || phase === "testDone" ? "원정 시작 " : active ? "진행 중 " : "새 원정 ";
    speed.textContent = `${this.#speed}×`;
    speed.setAttribute("aria-label", `재생 속도 ${this.#speed}배`);
    if (restoreFocus) (phase === "testDone" ? test : start).focus();
  }

  #render(view, previous) {
    this.#renderControls(view.phase);
    byId("route-panel").hidden = view.testBattle;
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
    phase.classList.toggle("sr-only", inBattle);
    byId("stage").textContent = view.testBattle ? "5대2 테스트 전투" : route[view.position].name;
    const message = byId("message");
    if (message.textContent !== view.message) message.textContent = view.message;
    message.classList.toggle("sr-only", inBattle);
    byId("train").style.left = trainPosition(view.position);
    this.#renderDie(view, previous);
    this.#renderClash(view.clash);
    const notice = byId("scene-notice");
    notice.hidden = !view.notice;
    notice.dataset.kind = view.phase;
    byId("notice-title").textContent = view.notice?.title ?? "";
    byId("notice-detail").textContent = view.notice?.detail ?? "";
    const impacts = view.clash?.stage === "impact" ? view.clash.lanes.filter((lane) => lane.hit) : [];
    const hitIds = (side, winner) => new Set(impacts.filter((lane) => lane.winner === winner).map((lane) => lane[side].id));
    const showingSkills = new Map(view.clash?.lanes.map((lane) => [lane.ally.id, lane.skills.ally]));
    const allyHits = hitIds("ally", "enemy");
    const enemyHits = hitIds("enemy", "ally");
    const crewKey = JSON.stringify(view.crew.map((unit) => [unit.id, unit.slot, unit.hp, unit.maxHp, unit.spirit,
      unit.attack, allyHits.has(unit.id), showingSkills.get(unit.id)?.slot]));
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
      byId("journal").closest("section").hidden = view.journal.length === 0;
    }
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
    damage.textContent = damaged ? `−${lane.hit.damage}` : "";
    finish.style.left = targetPosition;
    finish.hidden = !defeated;
  }

  #renderCoins(token, lane, side, stage, group, attack) {
    const strip = token.querySelector(".coins");
    const broken = stage === "break" && lane.broken === side;
    const count = group > 0 && side !== lane.winner ? 0 : lane.counts[side];
    const coins = [];
    for (let i = 0; i < count + Number(broken); i += 1) {
      const isBroken = i === count;
      const current = attack && lane.winner === side && lane.hit?.number === i + 1;
      const tossing = stage === "toss" && !lane.winner && !lane.draw || stage === "attackToss" && current;
      const spent = attack && lane.winner === side && i < lane.hitsUsed && !current;
      const face = attack ? (lane.winner === side ? lane.attackFaces[i] : null) : lane.faces[side][i];
      const coin = element("span", "coin");
      const image = isBroken ? "broken" : face === true ? "coin" : face === false ? "tails" : "unrevealed";
      setBitmap(coin, "combat-icons", 4, iconCells[image]);
      coin.setAttribute("aria-hidden", "true");
      coin.dataset.face = isBroken ? "파손" : face === true ? "앞면" : face === false ? "뒷면" : "미공개";
      coin.classList.toggle("coin-broken", isBroken);
      coin.classList.toggle("coin-spent", spent);
      coin.classList.toggle("coin-tossing", Boolean(tossing));
      coins.push(coin);
    }
    strip.replaceChildren(...coins);
    strip.hidden = coins.length === 0;
    strip.setAttribute("aria-label", `코인 ${coins.length}개, ${coins.map((coin) => coin.dataset.face).join(", ")}`);
  }

  #renderCombatant(token, unit, score, position, winner) {
    token.style.left = position;
    token.querySelector(".combat-name").textContent = unit.name;
    setPortrait(token.querySelector(".combat-icon"), unit);
    const scoreNode = token.querySelector(".combat-score");
    scoreNode.textContent = score;
    scoreNode.setAttribute("aria-hidden", String(score === ""));
    scoreNode.setAttribute("aria-label", `위력 ${score}`);
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
    const previous = this.#healthBars.get(bar);
    if (previous?.id === unit.id && previous.ratio === ratio) return;
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
    if (animated) this.#healthBars.set(bar, { id: unit.id, ratio, from, effect });
  }

  #animate(node, keyframes, duration, easing = "ease-out", delay = 0) {
    if (this.#motion?.matches || !node.animate) return;
    const effect = node.animate(keyframes, { duration, easing, delay });
    effect.playbackRate = this.#clockSpeed;
    if (this.#paused) effect.pause();
    this.#effects.push(effect);
  }

  #playTransition(view, previous, waitingOrigins, dieOrigin) {
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
    [".combatant.ally", ".combatant.foe"].forEach((selector, index) => {
      if (from[index] === to[index]) return;
      const token = node.querySelector(selector);
      const easing = retreat || reengage ? recoilEase : stage === "strike" ? "cubic-bezier(.39,0,.69,.21)" : "ease-out";
      const duration = clashDelay[stage] - (retreat || reengage ? 45 : 20);
      this.#animate(token, [{ left: from[index] }, { left: to[index] }], duration, easing);
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
            { left: position, transform: "translateX(-50%)" },
            { left: shifted(1), transform: `translate(-50%, ${dy}px)`, offset: .22 },
            { left: shifted(.4), transform: `translate(-50%, ${Math.round(dy * .4)}px)`, offset: .65 },
            { left: position, transform: "translateX(-50%)" },
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

  #renderCrew(crew, hitIds, showingSkills) {
    byId("crew-count").textContent = `${crew.filter((unit) => unit.slot >= 0 && unit.hp > 0).length}명 출전`;
    const order = (unit) => unit.slot < 0 ? crew.length : unit.slot;
    const ordered = [...crew].sort((a, b) => order(a) - order(b));
    byId("crew").replaceChildren(...ordered.map((unit) => {
      const row = element("li", `crew-row ${unit.slot < 0 || unit.hp === 0 ? "reserve" : ""}`);
      row.classList.toggle("is-hit", hitIds.has(unit.id));
      const portrait = element("span", "portrait");
      portrait.setAttribute("aria-hidden", "true");
      setPortrait(portrait, unit);
      const bio = element("div", "crew-bio");
      const state = unit.hp === 0 ? "이탈" : unit.slot < 0 ? "대기" : `출전 ${unit.slot + 1}`;
      const name = element("div", "crew-name");
      name.append(element("strong", "", unit.name), element("span", "unit-state", state));
      bio.append(name, element("span", "identity", unit.identity), unitStats(unit), health(unit));
      const current = showingSkills.get(unit.id)?.slot;
      const skills = element("ol", "skill-list");
      skills.append(...(unit.skills ?? [null]).map((skill, index) => skillCard(unit, skill, index, current === index + 1)));
      const stats = element("div", "crew-stats");
      const rating = element("strong", "power");
      rating.append(iconValue("rating", "전투력", String(unit.power)));
      stats.append(rating, iconValue("hp", "체력", hpText(unit)));
      row.append(portrait, bio, stats, unitResists(unit), skills);
      return row;
    }));
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
