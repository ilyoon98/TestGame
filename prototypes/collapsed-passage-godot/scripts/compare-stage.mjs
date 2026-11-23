import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, unlinkSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { engine } from "../../collapsed-passage/tests/helpers/game-engine.mjs";

// This function is evaluated in the existing web game's test VM.
function playStage({ number, variant, options, mapOnly, customSeed }) {
  const commands = [];
  const frames = [];
  const seed = customSeed ?? game.rewardSeed;
  if (options) start({ ...options, seed });
  const layout = Object.fromEntries(Object.entries(areas).map(([id, room]) => [id, {
    name: room.name, col: room.col, row: room.row, type: routeType(id),
    foe: room.foe || "", next: room.next || [], arena: arenaSrc(room),
    recruits: room.companions || (room.companion ? [room.companion] : []),
    event: room.event || "",
  }]));
  if (mapOnly) return { seed, options, commands, frames, layout };
  let displayedGate = "";
  let localTime = 0;
  const actor = unit => ({ hp: unit.hp, body: unit.body });
  const frame = (action = {}, events = []) => {
    const party = {};
    for (const side of ["player", "companion", "companion2"]) {
      if (game[side]) party[side] = { ...actor(game[side]), loadout: sideLoadout(side) };
    }
    const value = {
      area: game.area, phase: game.pendingCompanion ? "recruit" : game.phase,
      localTime, combatTime: game.combatTime, distance: game.distance, formation: game.formation,
      loss: game.lossCause || "", party, enemy: actor(game.enemy),
      pending: game.pendingCompanion || "", rewards: game.rewards, levels: game.skillLevels,
      coins: game.coins, oil: game.lanternOil, lockpicks: game.lockpicks, mystery: game.pendingMystery || "",
      gate: displayedGate, action, events,
    };
    frames.push(structuredClone(value));
  };
  const execute = (command, operation) => {
    commands.push(command);
    if (operation() === false) throw Error("Rejected web action " + JSON.stringify(command));
    frame();
  };
  const equip = (side, id, slot) => {
    const before = sideLoadout(side)[slot];
    if (before === id || equippedBy(id)) return;
    execute(["toggle", before, side], () => toggleEquippedSkill(before, side));
    execute(["toggle", id, side], () => toggleEquippedSkill(id, side));
  };
  for (let turn = 0; turn < 60; turn++) {
    if (game.phase === "won" || game.phase === "lost") break;
    if (game.phase === "prep") {
      const learned = availableSkills().find(id => game.skillLevels[id] &&
        !starterSkills.includes(id) && !equippedBy(id) && cards[id].type === "attack");
      if (learned) equip("player", learned, 1);
      if (variant && game.area === "lift") {
        const companion = partySides().find(side => side !== "player");
        if (companion) {
          const card = availableSkills(companion).find(id => game.skillLevels[id] && !equippedBy(id) && cards[id].character);
          if (card) equip(companion, card, 0);
        }
        const ranks = [...partySides()];
        if (ranks.length > 1) {
          const rank = game.formation.indexOf(ranks[0]);
          execute(["rank", rank, "player"], () => placePartyMember("player", rank));
        }
      }
      commands.push(["fight"]);
      if (!beginCombat()) throw Error("Web fight did not begin");
      for (let tick = 0; tick < 600 && game.phase === "combat"; tick++) {
        const distance = game.distance;
        const gate = bellboyPhase() || "";
        const a = advanceAutoBattle();
        localTime = game.cooldownBattle.elapsed;
        displayedGate = bellboyPhase() || "";
        delete a.keepIntent;
        const events = game.feedback.splice(0).map(event => Object.fromEntries(
          ["type", "card", "from", "side", "targets", "added", "dealt", "blocked", "removed",
            "critical", "defeated", "recovered", "gateBlock"]
            .filter(key => key in event).map(key => [key, event[key]])));
        if (a.id || distance !== game.distance || gate !== displayedGate) frame(a, events);
      }
      if (game.phase === "combat") throw Error("Web fight stalled");
      frame();
    } else if (game.pendingCompanion) {
      const full = partySides().length === 3;
      const outgoing = full && variant ? partySides().find(side => side !== "player") : "";
      const accept = !full || Boolean(outgoing);
      execute(["recruit", accept, outgoing], () => accept ?
        recruitCompanion(game.pendingCompanion, outgoing || null) : declineCompanion());
    } else if (game.phase === "reward") {
      const id = game.rewards[number % game.rewards.length];
      execute(["reward", id], () => chooseReward(id));
    } else {
      if (areas[game.area].type === "rest" && !game.stairTreatment && game.distance > 1) {
        const patient = quickHealTarget();
        if (patient) execute(["treat", patient.side, patient.target], () => treatAtStairs(patient.target, patient.side));
      }
      if (areas[game.area].type === "shop") {
        const inventory = ["shortcut", "bandage", "tonic", "oil", "lockpicks"];
        for (const [i] of inventory.entries()) {
          const id = inventory[(i + number) % inventory.length];
          const targets = shopTargets(id);
          if (!shopOfferIssue(id, targets)) {
            const target = targets[0]?.value || "";
            execute(["buy", id, target], () => buyShopOffer(id, target));
          }
        }
      }
      if (game.pendingMystery) {
        const take = number % 2 === 0 && !mysteryBlockReason(mysteryEvents[game.pendingMystery]);
        execute(["mystery", take], () => resolveMystery(take ? "take" : "skip"));
      }
      const index = options || game.area === "threshold" ? number % areas[game.area].next.length : 0;
      const dest = areas[game.area].next[index];
      execute(["move", dest], () => {
        if (!canMoveTo(dest)) return false;
        moveTo(dest);
        if (game.phase !== "lost") {
          localTime = 0;
          displayedGate = "";
        }
      });
    }
  }
  if (!["won", "lost"].includes(game.phase)) throw Error("Web run stalled");
  return { seed, options, commands, frames, layout };
}

const normalOptions = { widths: [3, 3], shops: 1, rests: 1, elites: 1, mysteries: 1 };
const scenarios = Array.from({ length: 133 }, (_, i) => {
  const params = { number: i + 1, variant: i >= 45, options: i >= 57 ? normalOptions : null };
  if (i >= 93) {
    params.mapOnly = true;
    params.customSeed = ["0", "겹친 문", 'A"\\path/🚪', "repeat"][i % 4] + i;
    params.options = [
      { widths: [3, 1, 2, 3], shops: 2, rests: 2, elites: 1, mysteries: 1 },
      { widths: [2, 2, 2], shops: 0, rests: 0, elites: 5 },
      { widths: [1, 1, 1, 1], shops: 0, rests: 0, elites: 0 },
    ][i % 3];
  }
  return params;
});
const countLimits = [
  { widths: [1], shops: 0, rests: 0, elites: 0, mysteries: 0 },
  { widths: [1], shops: 0, rests: 0, elites: 1, mysteries: 0 },
  { widths: [3, 1], shops: 1, rests: 0, elites: 0, mysteries: 3 },
  { widths: [2, 1, 3, 2], shops: 2, rests: 1, elites: 2, mysteries: 1 },
  { widths: [3, 3, 3, 3], shops: 0, rests: 0, elites: 0, mysteries: 0 },
  { widths: [3, 3, 3, 3], shops: 12, rests: 0, elites: 0, mysteries: 0 },
  { widths: [3, 3, 3, 3], shops: 0, rests: 12, elites: 0, mysteries: 0 },
  { widths: [3, 3, 3, 3], shops: 0, rests: 0, elites: 12, mysteries: 0 },
  { widths: [3, 3, 3, 3], shops: 0, rests: 0, elites: 0, mysteries: 12 },
  { widths: [3, 3, 3, 3], shops: 2, rests: 2, elites: 5, mysteries: 3 },
];
for (const options of countLimits) {
  for (const customSeed of ["0", "격리문-04", 'A"\\길/🚪', "123456789012345678901234"]) {
    scenarios.push({ number: scenarios.length + 1, options, mapOnly: true, customSeed });
  }
}
const runs = scenarios.map((params, i) => {
  const run = engine(i + 1, { prep: true });
  return JSON.parse(run("JSON.stringify((" + playStage.toString() + ")(" + JSON.stringify(params) + "))"));
});
const folder = mkdtempSync(join(tmpdir(), "passage-stage-"));
const input = join(folder, "cases.json");
try {
  writeFileSync(input, JSON.stringify(runs.map(({ seed, commands, options }) => ({ seed, commands, options }))));
  const result = spawnSync(process.argv[2] || "godot", ["--headless", "--path", fileURLToPath(new URL("../", import.meta.url)),
    "--script", "res://tests/compare_stage.gd", "--", input], {
    encoding: "utf8", maxBuffer: 30_000_000, timeout: 30000, windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 || /SCRIPT ERROR|Parse Error/.test(result.stderr)) throw Error(result.stderr);
  const output = result.stdout.split(/\r?\n/).find(line => line.startsWith("STAGE "));
  assert.ok(output, result.stdout);
  const native = JSON.parse(output.slice(6));
  assert.equal(native.length, runs.length);
  for (const [i, run] of runs.entries()) {
    assert.deepEqual(native[i].layout, run.layout, "Run " + (i + 1) + " map " +
      JSON.stringify({ seed: run.seed, options: run.options }));
    assert.equal(native[i].frames.length, run.frames.length, "Run " + (i + 1) + " frame count");
    for (const [j, frame] of run.frames.entries()) {
      assert.deepEqual(native[i].frames[j], frame,
        "Run " + (i + 1) + ", frame " + j + ", " + frame.area + " @ " + frame.localTime + "ms");
    }
  }
  const wins = native.slice(0, 45).filter(({ frames }) => frames.at(-1).phase === "won").length;
  const { frames: sample } = native.slice(0, 45).find(({ frames }) => frames.at(-1).phase === "won");
  const seeded = runs.slice(57, 93);
  const actions = seeded.flatMap(run => run.commands);
  console.log("57 fixed-map regressions, " + seeded.length + " seeded runs and " +
    runs.filter(run => run.frames.length === 0).length + " extra seed layouts matched.");
  console.log("Seeded encounters: " + actions.filter(action => action[0] === "buy").length + " purchases, "
    + actions.filter(action => action[0] === "mystery").length + " mystery decisions.");
  console.log("Baseline: " + wins + "/45 escaped. Ending example: " +
    JSON.stringify(Object.fromEntries(["area", "distance", "combatTime"].map(k => [k, sample.at(-1)[k]]))));
} finally {
  unlinkSync(input);
  rmdirSync(folder);
}
