import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engine } from "../../collapsed-passage/tests/helpers/game-engine.mjs";

const seed = "0";
const steps = [
  ["fight"], ["recruit", "guard"], ["reward", "strike"], ["move", "room-1-2"],
  ["buy", "shortcut"], ["move", "room-2-2"], ["treat", "companion", "arms"],
  ["move", "lift"], ["fight"], ["move", "exit"],
];

function playWeb(seed, steps) {
  start({ seed, widths: [3, 3], shops: 1, rests: 1, elites: 1, mysteries: 1 });
  return steps.map(([type, first, second]) => {
    let ok;
    switch (type) {
      case "fight":
        ok = beginCombat();
        for (let i = 0; i < 900 && game.phase === "combat"; i++) advanceAutoBattle();
        break;
      case "recruit": ok = recruitCompanion(first); break;
      case "reward": ok = chooseReward(first); break;
      case "move":
        ok = canMoveTo(first);
        if (ok) moveTo(first);
        break;
      case "buy": ok = buyShopOffer(first); break;
      case "treat": ok = treatAtStairs(second, first); break;
    }
    if (!ok || game.phase === "combat") throw Error("Web step failed: " + [type, first, second]);
    const allies = Object.fromEntries(["player", ...companionSides].filter(side => game[side]).map(side =>
      [side, { hp: game[side].hp, body: game[side].body, skills: sideLoadout(side) }]));
    return structuredClone({
      phase: game.pendingCompanion ? "recruit" : game.phase, area: game.area, trail: game.trail,
      time: game.combatTime, distance: game.distance, coins: game.coins, formation: game.formation,
      allies, levels: game.skillLevels, rewards: game.rewards, enemyHp: game.enemy.hp,
    });
  });
}

const run = engine(1, { prep: true });
const expected = JSON.parse(run("JSON.stringify((" + playWeb + ")(" + JSON.stringify(seed) + "," + JSON.stringify(steps) + "))"));
assert.equal(expected.at(-1).phase, "won");
const directory = mkdtempSync(join(tmpdir(), "passage-playthrough-"));
const input = join(directory, "playthrough.json");
const log = join(directory, "standalone.log");
const exported = process.argv.includes("--exported");
const [executable = "godot", capture] = process.argv.slice(2).filter(arg => arg !== "--exported");
const isolatedExe = join(directory, "CollapsedPassage.exe");
const override = join(directory, "override.cfg");
try {
  writeFileSync(input, JSON.stringify({ seed, steps, exported }));
  if (exported) {
    copyFileSync(executable, isolatedExe);
    const runner = fileURLToPath(new URL("../tests/play_full_run.gd", import.meta.url)).replaceAll("\\", "/");
    writeFileSync(override, [
      "[application]",
      "config/use_custom_user_dir=true",
      "config/custom_user_dir_name=" + JSON.stringify(basename(directory)),
      "",
      "[autoload]",
      "PlaythroughVerifier=" + JSON.stringify("*" + runner),
      "",
    ].join("\n"));
  }
  const result = spawnSync(exported ? isolatedExe : executable, [
    ...(capture ? [] : ["--headless"]),
    ...(exported ? ["--log-file", log] :
      ["--path", fileURLToPath(new URL("../", import.meta.url)), "--script", "res://tests/run_playthrough.gd"]),
    "--", input, ...(capture ? [capture] : []),
  ], { cwd: exported ? directory : undefined, encoding: "utf8", timeout: 60000, windowsHide: true });
  if (result.error) throw result.error;
  const output = existsSync(log) ? readFileSync(log, "utf8") : result.stdout;
  if (result.status !== 0 || /ERROR:|Parse Error/.test(result.stderr + output)) throw Error(result.stderr + output);
  const line = output.split("\n").find(value => value.startsWith("PLAYTHROUGH "));
  assert.ok(line, output);
  const actual = JSON.parse(line.slice(12));
  assert.equal(actual.length, expected.length);
  for (const [i, checkpoint] of actual.entries()) {
    assert.deepEqual(checkpoint, expected[i], "Playthrough step: " + steps[i].join(" "));
  }
  console.log("Title, 8 comic panels, tutorial and 10 in-game checkpoints matched.");
  const { phase, time, distance, coins, allies } = actual.at(-1);
  console.log(JSON.stringify({ phase, time, distance, coins, nunHp: allies.player.hp, guardHp: allies.companion.hp }));
} finally {
  for (const file of [log, input, override, isolatedExe]) {
    if (existsSync(file)) unlinkSync(file);
  }
  rmdirSync(directory);
}
