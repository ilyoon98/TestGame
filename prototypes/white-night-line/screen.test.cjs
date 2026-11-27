const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const { join } = require("node:path");
const vm = require("node:vm");
const load = (file) => fs.readFileSync(join(__dirname, file), "utf8");
const markup = load("index.html");
const domain = ["crew-data.js", "crew.js", "game.js"].map(load).join("\n");
const screenCode = load("main.js");

function simulateScreen(seed, reduced = false) {
  const elements = new Map(), timers = new Map(), effects = [];
  let now = 0, serial = 0;
  class Element {
    constructor(...names) {
      Object.assign(this, { children: [], firstChild: {}, dataset: {}, attributes: {}, handlers: {}, classes: new Set(names), className: "" });
      this.style = { setProperty(key, value) { this[key] = value; } };
      this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
    }
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    insertBefore(item, reference) {
      const old = this.children.indexOf(item);
      if (old >= 0) this.children.splice(old, 1);
      const index = reference === null ? this.children.length : this.children.indexOf(reference);
      this.children.splice(index, 0, item);
      item.parent = this;
    }
    get lastElementChild() { return this.children.at(-1); }
    get firstElementChild() { return this.children[0]; }
    remove() { this.parent.children = this.parent.children.filter((node) => node !== this); }
    addEventListener(event, callback) { this.handlers[event] = callback; }
    click() { if (!this.disabled) this.handlers.click(); }
    focus() { document.activeElement = this; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    closest() { return this.parent; }
    querySelectorAll(query) {
      const classes = query.slice(1).split(".");
      return this.children.flatMap((child) => [
        ...(classes.every((name) => child.classes.has(name) || child.className.split(" ").includes(name)) ? [child] : []),
        ...child.querySelectorAll(query),
      ]);
    }
    querySelector(query) { return this.querySelectorAll(query)[0] ?? null; }
    getBoundingClientRect() {
      return this.className === "waiting-icon"
        ? { left: 45 + Number(this.parent.style.gridColumn) * 32, top: 370, width: 24, height: 24 }
        : { left: 150, top: 200, width: 45, height: 45 };
    }
    animate(frames, options) {
      const effect = { node: this, frames, options, effect: { getComputedTiming: () => ({ progress: .5 }) }, playState: "running",
        cancel() { this.playState = "idle"; }, pause() { this.playState = "paused"; },
        play() { this.playState = "running"; }, updatePlaybackRate(rate) { this.playbackRate = rate; },
      };
      effects.push(effect);
      return effect;
    }
  }
  const get = (id) => elements.get(id);
  const document = { createElement: () => new Element(), getElementById: get, activeElement: null, addEventListener() {} };
  const makeLane = () => {
    const lane = new Element("clash-lane");
    lane.append(...["clash-announcement", "standard-space", "clash-flash", "clash-sparks", "slash", "damage-number", "finish-burst"]
      .map((name) => new Element(name)));
    for (const side of ["ally", "foe"]) {
      const unit = new Element("combatant", side);
      unit.append(new Element("combat-name"), new Element("combat-score"), new Element("combat-icon"), new Element("combat-gain"), new Element("win-tag"), new Element("coins"), new Element("spirit-change"), new Element("combat-hp"), new Element("combat-spirit"));
      lane.append(unit);
    }
    return lane;
  };
  for (const [, id] of markup.matchAll(/\bid="([^"]+)"/g)) elements.set(id, new Element(id));
  get("clash-lane").content = { firstElementChild: { cloneNode: makeLane } };
  (new Element()).append(get("journal"));
  for (let i = 0; i < 3; i++) get("dice-faces").append(new Element());
  for (let i = 0; i < 3; i++) get("test-plan").append(new Element());
  const context = vm.createContext({
    document, structuredClone, matchMedia: () => ({ matches: reduced }),
    crypto: { getRandomValues(array) { array[0] = seed; return array; } },
    performance: { now: () => now },
    setTimeout(fn, time) { timers.set(++serial, { fn, at: now + time }); return serial; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(domain, context);
  vm.runInContext(screenCode, context);
  function step() {
    const [id, timer] = [...timers][0] ?? [];
    assert.ok(timer, "Playback stopped before reaching the expected phase");
    timers.delete(id);
    now = timer.at;
    timer.fn();
  }
  return { get, effects, timers, step };
}

function advanceUntil(screen, condition) {
  for (let step = 0; step < 300; step += 1) {
    if (condition()) return;
    screen.step();
  }
  assert.fail("Playback did not reach the expected phase");
}

test("damage trails respect speed changes and pause with the rest of playback", () => {
  const screen = simulateScreen(0);
  const { get } = screen;
  get("test-battle").click();
  get("speed").click();
  get("speed").click();
  const trail = () => screen.effects.find((effect) => effect.node.className === "hp-trail");
  advanceUntil(screen, trail);
  assert.equal(trail().playbackRate, 4);
  get("speed").click();
  assert.equal(trail().playbackRate, 1);
  get("pause").click();
  assert.equal(screen.timers.size, 0);
  assert.equal(trail().playState, "paused");
  get("pause").click();
  assert.equal(screen.timers.size, 1);
  assert.equal(trail().playState, "running");
});

test("unchanged crew, enemies and journal retain their DOM during the toss", () => {
  const screen = simulateScreen(0);
  const { get } = screen;
  get("start").click();
  const lane = () => get("clash-lanes").children[0];
  advanceUntil(screen, () => lane()?.dataset.stage === "ready");
  const original = ["crew", "enemies", "journal"].map((id) => get(id).children[0]);
  advanceUntil(screen, () => lane().dataset.stage === "reveal");
  const updated = ["crew", "enemies", "journal"].map((id) => get(id).children[0]);
  updated.forEach((node, index) => assert.equal(node, original[index]));
});

test("the default ten-cost lineup reveals one card at a time before the dice roll", () => {
  for (const reduced of [false, true]) {
    const screen = simulateScreen(0, reduced);
    const { get } = screen;
    get("start").click();
    assert.equal(get("draft-panel").hidden, false);
    assert.equal(get("crew-panel").hidden, true);
    assert.equal(get("draft-total").textContent, "0 / 10");
    assert.equal(get("draft-cards").children.length, 4);
    for (const card of get("draft-cards").children) {
      assert.equal(card.attributes["aria-label"], "미공개 대원");
      assert.equal(card.querySelector(".draft-card-front").attributes["aria-hidden"], "true");
      assert.ok(card.querySelector(".draft-card-back"));
    }
    let total = 0;
    for (let i = 0; i < 4; i += 1) {
      screen.step();
      assert.equal(get("dice").hidden, true);
      const revealed = get("draft-cards").querySelectorAll(".draft-card.is-revealed");
      assert.equal(revealed.length, i + 1);
      const latest = revealed.at(-1);
      total += Number(latest.querySelector(".draft-cost").textContent.split(" ").at(-1));
      assert.equal(get("draft-total").textContent, `${total} / 10`);
      assert.equal(get("draft-meter").attributes["aria-valuenow"], String(total));
      assert.match(latest.querySelector(".draft-portrait").style.backgroundImage, /(?:assets|concept-art)\/.+\.png/);
      assert.equal(latest.querySelector(".draft-card-front").attributes["aria-hidden"], undefined);
      const flip = screen.effects.find((effect) => effect.node === latest.querySelector(".draft-card-turn"));
      if (reduced) {
        assert.match(flip.frames[1].transform, /scaleX\(.64\)/);
        const back = screen.effects.find((effect) => effect.node === latest.querySelector(".draft-card-back"));
        assert.equal(back.frames[0].opacity, 1);
        assert.equal(back.frames[1].opacity, 0);
      }
      else {
        assert.match(flip.frames[0].transform, /rotateY\(180deg\)/);
        assert.match(flip.frames.at(-1).transform, /rotateY\(0deg\)/);
      }
      if (i === 0) {
        get("pause").click();
        assert.equal(screen.timers.size, 0);
        if (flip) assert.equal(flip.playState, "paused");
        get("pause").click();
      }
    }
    assert.equal(total, 10);
    assert.ok(get("draft-panel").classes.has("is-complete"));
    assert.equal(get("draft-fill").style.width, "100%");
    screen.step();
    assert.equal(get("draft-panel").hidden, true);
    assert.equal(get("dice").hidden, false);
    assert.equal(get("crew-panel").hidden, false);
  }
});

test("the detailed draft cards and battlefield portraits use different framing of the same art", () => {
  const screen = simulateScreen(8299, true);
  const { get } = screen;
  get("start").click();
  advanceUntil(screen, () => get("draft-panel").classes.has("is-complete"));
  const roster = [
    ["제온", "assets/jun-recruit.png"], ["도건", "concept-art/1011-rok.png"],
    ["케이", "concept-art/1017-yeon.png"], ["다인", "concept-art/1010-siwon.png"],
  ];
  const cards = get("draft-cards").children;
  roster.forEach(([name, path], index) => {
    const card = cards[index];
    assert.equal(card.querySelector(".draft-caption").children[0].textContent, name);
    assert.equal(card.querySelector(".draft-portrait").style.backgroundImage, `url("${path}")`);
    assert.equal(card.querySelector(".draft-portrait").style.backgroundSize, "contain");
  });

  advanceUntil(screen, () => get("clash-lanes").firstElementChild?.dataset.stage === "ready");
  const portraits = new Map([
    ...get("clash-lanes").querySelectorAll(".combatant.ally").map((unit) =>
      [unit.querySelector(".combat-name").textContent, unit.querySelector(".combat-icon")]),
    ...get("waiting-crew").children.map((unit) => [unit.children[1].textContent, unit.querySelector(".waiting-icon")]),
  ]);
  for (const [name, path] of roster) {
    assert.equal(portraits.get(name).style.backgroundImage, `url("${path}")`);
    assert.ok(parseFloat(portraits.get(name).style.backgroundSize) > 100);
  }
});

test("the opening cost and reward buttons complete a recruitment interaction", () => {
  const screen = simulateScreen(0);
  const { get } = screen;
  get("starting-cost").value = "8";
  get("start").click();
  assert.equal(get("draft-total").textContent, "0 / 8");
  advanceUntil(screen, () => get("draft-panel").hidden);
  assert.match(get("sync-parts").textContent, /시작 코스트 8.*동기화 Ⅱ 재료 0\/2/);
  for (const row of get("crew").children) {
    assert.equal(row.querySelectorAll(".coin-profile.is-locked").length, 2);
    const cost = row.querySelector(".unit-badge-cost");
    assert.match(cost.textContent, /^[1-4]$/);
    assert.equal(cost.attributes["aria-label"], `코스트 ${cost.textContent}`);
    assert.equal(row.querySelector(".unit-badge-sync").textContent, "Ⅰ");
    assert.equal(row.querySelector(".crew-details").open, false);
    assert.equal(row.querySelector(".portrait").style.backgroundSize, "contain");
  }
  const skill = get("crew").querySelector(".coin-profile");
  const trigger = skill.querySelector(".skill-trigger");
  const detail = skill.querySelector(".skill-detail");
  assert.match(skill.querySelector(".skill-picture").style.backgroundImage, /skill-icons-painted\.png/);
  assert.equal(detail.hidden, true);
  trigger.click();
  assert.equal(trigger.attributes["aria-expanded"], "true");
  assert.match(detail.querySelector(".skill-power").textContent, /^위력 \d/);
  assert.match(detail.querySelector(".skill-roll").textContent, /코인 \d개/);
  trigger.click();
  assert.equal(detail.hidden, true);
  advanceUntil(screen, () => !get("recruit-panel").hidden);
  assert.equal(screen.timers.size, 0);
  assert.ok(get("launch-controls").hidden);
  assert.equal(get("recruit-packs").children.length, 3);
  assert.equal(get("recruit-packs").querySelectorAll(".recruit-choice").length, 3);
  const choice = get("recruit-packs").querySelector(".recruit-choice");
  assert.match(choice.attributes["aria-label"], /[1-4]코스트 확정, 후보 [1-3]명, 출전 [1-5]명/);
  assert.equal(get("recruit-packs").querySelectorAll(".recruit-recommendation").length, 1);
  choice.click();
  assert.equal(get("recruit-panel").hidden, false);
  assert.match(get("recruit-title").textContent, /인격 1명 선택/);
  assert.equal(get("recruit-packs").querySelectorAll(".recruit-recommendation").length, 1);
  get("recruit-packs").querySelector(".identity-choice").click();
  assert.ok(get("recruit-panel").hidden);
  assert.match(get("notice-title").textContent, /새 대원 영입|동기화 재료 획득/);
  assert.equal(screen.timers.size, 1);
});

test("the crew view displays the active animal and weapon set effects", () => {
  const screen = simulateScreen(119);
  const { get } = screen;
  get("starting-cost").value = "10";
  get("start").click();
  advanceUntil(screen, () => get("draft-panel").hidden);
  const setEffects = get("synergies").children.map((item) => item.children.map((label) => label.textContent).join(" "));
  assert.ok(setEffects.includes("동물 쥐 2명 · 앞면 확률 +3%p"));
  assert.ok(setEffects.includes("무기 도검 3명 · 첫 적중 추가 피해 +2"));
  const crew = get("crew").children.map((row) => row.querySelectorAll(".crew-trait").map((trait) => trait.children[1].textContent).join(" · "));
  assert.ok(crew.includes("Alfa 간부 · 참격 · 쥐 · 도검"));
});

test("simultaneous contact recoil keeps horizontal positions within each lane", () => {
  const screen = simulateScreen(0);
  const { get } = screen;
  get("test-battle").click();
  advanceUntil(screen, () => get("clash-lanes").children[0].dataset.stage === "contact");
  const rebounds = screen.effects.filter((effect) => effect.playState === "running"
    && effect.node.classes.has("combatant") && effect.frames.some((frame) => frame.offset === .22));
  assert.equal(rebounds.length, 4);
  for (const { frames } of rebounds) {
    assert.equal(frames[0].translate, "0px 0px");
    assert.match(frames[1].translate, /^calc\(clamp\(var\(--lane-edge\),.*cqi/);
    assert.match(frames[1].transform, /^translate\(-50%, -?\d+px\)$/);
  }
});

test("arena exposes coin faces and current power and keeps clash feedback readable", () => {
  assert.match(markup, /<div class="clash-field">/);
  const screen = simulateScreen(0, true);
  const { get } = screen;
  get("test-battle").click();
  const lane = () => get("clash-lanes").children[0];
  advanceUntil(screen, () => lane().dataset.stage === "contact");
  const ally = lane().querySelector(".combatant.ally");
  assert.match(ally.querySelector(".coins").attributes["aria-label"], /코인 \d+개, (앞면|뒷면)/);
  assert.match(ally.querySelector(".combat-score").attributes["aria-label"], /위력 \d+/);
  assert.equal(ally.querySelector(".combat-hp").attributes.role, "meter");
  const announcement = lane().querySelector(".clash-announcement");
  assert.match(announcement.textContent, /합 (승리|패배|동점)/);
  const verdict = announcement.textContent;
  screen.step();
  assert.equal(announcement.textContent, verdict);
  advanceUntil(screen, () => get("phase").textContent === "테스트 완료");
  assert.equal(screen.effects.length, 0);
});
