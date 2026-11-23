import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { engine } from "../../collapsed-passage/tests/helpers/game-engine.mjs";

const godot = process.argv[2] || "godot";
const openingLoadouts = [
  ["guard", "heavy", "strike"],
  ["guard", "heavy", "prayer"],
  ["guard", "strike", "prayer"],
  ["heavy", "strike", "prayer"],
];
const seeds = ["THRESHOLD", "BOX-07", "격리문", 'A"\\path/🚪', "0"];
const cases = openingLoadouts.flatMap((skills, loadoutIndex) =>
  [0, 1, 2].flatMap(rank => [true, false].flatMap(recruit => seeds.map((seed, i) => ({
    skills, rank, recruit, seed, reward: (i + loadoutIndex) % 4 - 1,
    destination: ["duct", "infirmary", "corridor"][(i + rank) % 3],
  })))));
cases.unshift({ skills: openingLoadouts[0], rank: 0, recruit: true, seed: "THRESHOLD", reward: 0, destination: "infirmary" });
cases.push({ ...cases[0], skills: ["strike", "heavy", "guard"], reward: 1 });
cases.push(
  { ...cases[0], destination: "corridor", treat: ["companion", "arms"], continueToLanding: true },
  { ...cases[0], destination: "corridor", treat: ["player", "legs"], continueToLanding: true },
  { ...cases[0], destination: "corridor", continueToLanding: true },
  { ...cases[0], destination: "corridor", travelLegs: 0, travelDistance: 1, treat: ["companion", "arms"], continueToLanding: true },
  { ...cases[0], destination: "duct", travelLegs: 3 },
  { ...cases[0], destination: "duct", travelLegs: 0 },
  { ...cases[0], destination: "infirmary", travelLegs: 0, travelDistance: 0 },
);
cases.push(
  { ...cases[0], hp: 1 },
  { ...cases[0], distance: 1 },
  { ...cases[0], enemyHp: 50 },
);

function playWeb(scenario) {
  const run = engine(1, { prep: true });
  return JSON.parse(run('JSON.stringify((scenario => {'
    + 'start(undefined, scenario.seed);'
    + 'placePartyMember("player", scenario.rank);'
    + 'for (const id of starterSkills) toggleEquippedSkill(id);'
    + 'for (const id of scenario.skills) if (!toggleEquippedSkill(id)) throw Error("Invalid skill: " + id);'
    + 'if ("hp" in scenario) game.player.hp = scenario.hp;'
    + 'if ("distance" in scenario) game.distance = scenario.distance;'
    + 'if ("enemyHp" in scenario) game.enemy.hp = scenario.enemyHp;'
    + 'if (!beginCombat()) throw Error("Could not begin");'
    + 'const actor = a => ({hp: a.hp, body: structuredClone(a.body)});'
    + 'const trace = [];'
    + 'for (let i = 0; i < 500 && game.phase === "combat"; i++) {'
    + 'const distance = game.distance;'
    + 'const action = advanceAutoBattle();'
    + 'delete action.keepIntent;'
    + 'const events = game.feedback.splice(0).map(event => Object.fromEntries('
    + '["type","card","from","side","targets","added","dealt","blocked","removed","critical","defeated","recovered"]'
    + '.filter(key => key in event).map(key => [key, event[key]])));'
    + 'if (action.id || distance !== game.distance) trace.push({time: game.combatTime, distance: game.distance,'
    + 'action, events, player: actor(game.player), enemy: actor(game.enemy)});'
    + '}'
    + 'if (game.phase === "combat") throw Error("Web combat did not finish");'
    + 'const result = {trace, phase: game.pendingCompanion ? "recruit" : game.phase, loss: game.lossCause || "",'
    + 'time:game.combatTime, distance:game.distance, player:actor(game.player), enemy:actor(game.enemy)};'
    + 'if (!game.pendingCompanion) return result;'
    + 'if (!(scenario.recruit ? recruitCompanion("guard") : declineCompanion())) throw Error("Recruit failed");'
    + 'Object.assign(result, {formation:game.formation, guard:game.companion && {...actor(game.companion), loadout:game.companion.loadout},'
    + 'rewards:[...game.rewards]});'
    + 'const id = game.rewards[scenario.reward] ?? null;'
    + 'if (!chooseReward(id)) throw Error("Could not choose reward");'
    + 'if ("travelLegs" in scenario) {'
    + 'game.player.hp -= game.player.body.legs.hp - scenario.travelLegs; game.player.body.legs.hp = scenario.travelLegs;'
    + '}'
    + 'if ("travelDistance" in scenario) game.distance = scenario.travelDistance;'
    + 'const snapshot = () => ({area:game.area, phase:game.phase, loss:game.lossCause || "",'
    + 'trail:[...game.trail], steps:game.steps, distance:game.distance, nextGain:travelGain(), time:game.combatTime,'
    + 'player:actor(game.player), enemy:actor(game.enemy), guard:game.companion && {...actor(game.companion), loadout:game.companion.loadout},'
    + 'formation:game.formation, loadout:game.loadout, levels:game.skillLevels, restFinished:game.restFinished,'
    + 'treatment:game.stairTreatment || {}});'
    + 'const journey = [snapshot()];'
    + 'if (!canMoveTo(scenario.destination) || canMoveTo("lift")) throw Error("Wrong destinations");'
    + 'moveTo(scenario.destination); journey.push(snapshot());'
    + 'if (scenario.treat) {'
    + 'const [side,part] = scenario.treat; journey.push({treated:treatAtStairs(part,side)}, snapshot());'
    + 'if (treatAtStairs(part,side)) throw Error("Treatment repeated");'
    + '}'
    + 'if (scenario.continueToLanding) {'
    + 'if (!canMoveTo("landing")) throw Error("Landing unavailable");'
    + 'moveTo("landing"); journey.push(snapshot());'
    + '}'
    + 'return {...result, chosen:id || "", levels:game.skillLevels, chosenCooldown:id ? skillCooldown(id) : null, journey};'
    + '})(' + JSON.stringify(scenario) + '))'));
}

const folder = mkdtempSync(join(tmpdir(), "passage-parity-"));
const input = join(folder, "cases.json");
try {
  writeFileSync(input, JSON.stringify(cases));
  const result = spawnSync(godot, ["--headless", "--path", fileURLToPath(new URL("../", import.meta.url)),
    "--script", "res://tests/compare_web.gd", "--", input], { encoding: "utf8", maxBuffer: 12_000_000, timeout: 30000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0 || /SCRIPT ERROR|Parse Error/.test(result.stderr)) {
    throw Error(result.stderr + result.stdout.slice(0, 3000));
  }
  const line = result.stdout.split(/\r?\n/).find(line => line.startsWith("COMPARISON "));
  assert.ok(line, result.stderr || result.stdout);
  const native = JSON.parse(line.slice("COMPARISON ".length));
  assert.equal(native.length, cases.length);
  for (const [i, scenario] of cases.entries()) {
    assert.deepEqual(native[i], playWeb(scenario), "Mismatch: " + JSON.stringify(scenario));
  }
  const [opening] = native;
  console.log(cases.length + " matched cases");
  console.log("Opening: " + JSON.stringify({
    seed: cases[0].seed, time: opening.time, distance: opening.distance, hp: opening.player.hp,
    legs: opening.player.body.legs.hp, enemyHp: opening.enemy.hp,
    guard: opening.guard.hp, guardArms: opening.guard.body.arms.hp, rewards: opening.rewards, chosen: opening.chosen,
    actions: opening.trace.filter(e => e.action.id).map(e => [e.time, e.action.actor, e.action.id,
      e.events.map(action => [action.targets[0], action.dealt, action.blocked])]),
  }));
  console.log("Outcomes: " + JSON.stringify(native.reduce((counts, item) => {
    const key = item.loss || item.phase;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {})));
  const arrival = opening.journey.at(-1);
  console.log("Arrival: " + JSON.stringify({
    area: arrival.area, phase: arrival.phase, distance: arrival.distance, trail: arrival.trail,
    playerHP: arrival.player.hp, playerLegs: arrival.player.body.legs.hp, guardHP: arrival.guard.hp,
    guardArms: arrival.guard.body.arms.hp, rewardLevel: arrival.levels[opening.chosen], enemyHP: arrival.enemy.hp,
  }));
} finally {
  rmSync(input, { force: true });
  rmdirSync(folder);
}
