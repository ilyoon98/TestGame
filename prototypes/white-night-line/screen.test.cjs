const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const { join } = require("node:path");
const vm = require("node:vm");
const load = (file) => fs.readFileSync(join(__dirname, file), "utf8");
const markup = load("index.html");
const domain = load("game.js");
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
  const document = { createElement: () => new Element(), getElementById: get, activeElement: null };
  const makeLane = () => {
    const lane = new Element("clash-lane");
    lane.append(...["clash-announcement", "clash-flash", "clash-sparks", "slash", "damage-number", "finish-burst"]
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

test("simultaneous contact recoil keeps horizontal positions within each lane", () => {
  const screen = simulateScreen(0);
  const { get } = screen;
  get("test-battle").click();
  advanceUntil(screen, () => get("clash-lanes").children[0].dataset.stage === "contact");
  const rebounds = screen.effects.filter((effect) => effect.playState === "running"
    && effect.node.classes.has("combatant") && effect.frames.some((frame) => frame.offset === .22));
  assert.equal(rebounds.length, 4);
  for (const { frames } of rebounds) {
    assert.ok(frames.every((frame) => frame.left.startsWith("clamp(var(--lane-edge),")));
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
