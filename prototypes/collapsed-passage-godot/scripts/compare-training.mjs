import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, unlinkSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { engine } from "../../collapsed-passage/tests/helpers/game-engine.mjs";

const fields = ["type", "card", "from", "side", "targets", "added", "dealt", "blocked", "removed",
  "critical", "defeated", "recovered", "gateBlock"];
const web = engine(1, { prep: true });
const skills = JSON.parse(web(`JSON.stringify(Object.keys(skillCharge).map(id => ({
  id, kind: cards[id].character || (cards[id].weapon ? Object.keys(companionTypes)
    .find(kind => companionTypes[kind].weapon === cards[id].weapon) : "nun"),
  rank: cards[id].ranks?.[0] ?? 0,
})))`));
const sideByKind = { nun: "player", guard: "companion", awakened: "companion2", archer: "companion3", shaman: "companion4" };
const cases = skills.map(({ id, kind, rank }) => {
  const side = sideByKind[kind];
  const formation = ["player", "companion", "companion2"].filter(other => other !== side).slice(0, 2);
  formation.splice(rank, 0, side);
  return { id, side, formation };
});

function firstAction({ id, side, formation }, fields) {
  start({ seed: "skill-parity", widths: [1], training: true });
  game.formation = formation;
  game.trainingEnemyActs = false;
  if (!setTrainingSkill(side, 0, id) || !beginCombat()) throw Error("Web rejected " + id);
  for (const slot of game.cooldownBattle.skills) if (slot.id !== id) slot.readyAt = Infinity;
  for (const ally of formation) {
    game[ally].body.arms.hp = 2;
    game[ally].body.legs.hp = 2;
  }
  if (id === "woundCover") applyHealing("aid", game.player, game.player, "arms", 4, game);
  for (let step = 0; step < 500; step++) {
    game.feedback = [];
    if (advanceAutoBattle()?.id !== id) continue;
    return {
      time: game.cooldownBattle.elapsed,
      events: game.feedback.map(event => Object.fromEntries(fields.filter(key => key in event).map(key => [key, event[key]]))),
      fighters: Object.fromEntries([...formation, "enemy"].map(key => [key, { hp: game[key].hp, body: game[key].body }])),
    };
  }
  throw Error("Web skill did not activate: " + id);
}

const expected = cases.map(fixture => JSON.parse(web(
  "JSON.stringify((" + firstAction + ")(" + JSON.stringify(fixture) + "," + JSON.stringify(fields) + "))"
)));
const directory = mkdtempSync(join(tmpdir(), "passage-skills-"));
const input = join(directory, "cases.json");
try {
  writeFileSync(input, JSON.stringify(cases));
  const result = spawnSync(process.argv[2] || "godot", ["--headless", "--path", fileURLToPath(new URL("../", import.meta.url)),
    "--script", "res://tests/compare_training.gd", "--", input], {
    encoding: "utf8", maxBuffer: 4_000_000, timeout: 30000, windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 || /SCRIPT ERROR|Parse Error/.test(result.stderr)) throw Error(result.stderr);
  const line = result.stdout.split("\n").find(value => value.startsWith("SKILLS "));
  assert.ok(line, result.stdout);
  const actual = JSON.parse(line.slice(7));
  const mismatches = [];
  for (const [i, fixture] of cases.entries()) {
    try {
      assert.deepEqual(actual[i], expected[i]);
    } catch {
      mismatches.push({ card: fixture.id, actual: actual[i]?.events, expected: expected[i].events });
    }
  }
  assert.deepEqual(mismatches, [], "Native and web skill outcomes differ");
  console.log(cases.length + " playable skills matched: initial activation time, targets, combat events and resulting body states.");
} finally {
  unlinkSync(input);
  rmdirSync(directory);
}
