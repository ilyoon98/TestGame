import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { engine } from "../../collapsed-passage/tests/helpers/game-engine.mjs";

const web = new URL("../../collapsed-passage/", import.meta.url);
const local = new URL("../", import.meta.url);
const run = engine(1, { prep: true });
const data = JSON.parse(run('JSON.stringify((() => {'
  + 'const starters = availableSkills();'
  + 'const recruits = Object.fromEntries(Object.entries(companionTypes).map(([id, type]) => [id, {...type, loadout:companionStarterSkills(id)}]));'
  + 'const profile = card => Object.keys(companionTypes).find(kind => skillFits(card, makeCompanion(kind)));'
  + 'const describe = (id, card) => {'
  + 'const kind = exclusiveSkill(card) ? profile(card) : null;'
  + 'const actor = kind ? makeCompanion(kind) : game.player;'
  + 'if(kind && recruits[kind].hurtArm) actor.body.arms.hp = recruits[kind].hurtArm;'
  + 'return skillEffectLines(id, actor, term => term).join("\\n"); };'
  + 'const catalog = Object.entries(codexLabels).map(([id, label]) => {'
  + 'const profile = codexMembers[id] || nunType;'
  + 'const actor = fighter(profile.name, profile.health, profile.vitality);'
  + 'return {id, label, role:codexRoles[id] || "",'
  + 'slots:id === "nun" ? starterSkills.length : companionSkillSlots,'
  + 'cards:codexCardIds(id).map(cardId => ({id:cardId, lines:skillEffectLines(cardId, actor, term => term)}))}; });'
  + 'return {'
  + 'parts, effects, nun: nunType, recruits, foes, timing: battleTiming, bellboyTiming, traits, traitThreshold, pursuitWarningDistance,'
  + 'openingPanels, openingLessons, shopOffers, mysteryEvents, healingOrigins,'
  + 'wounds:{appearance:woundAppearance,decals:woundSprites,'
  + 'eyeWraps:Object.fromEntries([...eyeLossFrames].filter(([src]) => typeof src === "string"))},'
  + 'camp:{groups:campSides,departure:campDepartureSeats,appearance:campWoundAppearance,'
  + 'poses:Object.fromEntries(Object.entries(campRestAnchors).map(([kind,variants]) => [kind,'
  + 'Object.fromEntries(Object.entries(variants).map(([variant,anchor]) => [variant,'
  + '{src:"art/locations/camp-poses/" + kind + "-" + variant + ".webp",anchors:woundAnchors(kind,"idle",anchor)}]))]))},'
  + 'codex:{tabs:catalog, weapons:codexWeapons, ranks:skillRankLabels},'
  + 'visuals: Object.fromEntries(["nun", ...Object.keys(recruits), ...Object.keys(foes)].map(kind => [kind, {'
  + 'idle: partyArt[kind === "nun" ? "player" : kind]?.src || motionArt[kind]?.idle || "art/characters/" + kind + "-idle.webp",'
  + 'poses: motionArt[kind],'
  + 'anchors: woundAnchors(kind, "idle") ? Object.fromEntries(["idle", ...Object.keys(motionArt[kind])]'
  + '.map(pose => [pose, woundAnchors(kind, pose)])) : '
  + '{idle:Object.fromEntries(Object.keys(parts).map((part, i) => [part, bodyAnchors[kind][i]]))},'
  + 'armLoss:Object.fromEntries(Object.keys(armLossAnchors[kind] || {}).map(pose => [pose, armLossSrc(kind, pose)])),'
  + 'kneeling:Object.fromEntries(Object.entries(kneelingAnchors[kind] || {}).map(([variant, poses]) => [variant,'
  + 'Object.fromEntries(Object.entries(poses).map(([pose, anchor]) => [pose,'
  + '{src:kneelingSrc(kind, variant, pose), anchors:woundAnchors(kind, pose, anchor)}]))]))}])),'
  + 'map: Object.fromEntries(Object.entries(standardAreas).map(([id, room]) => [id, {'
  + 'name: room.name, col: room.col, row: room.row, type: routeType(id), next: room.next || [],'
  + 'foe: room.foe || "", arena: arenaSrc(room), recruits: room.companions || (room.companion ? [room.companion] : [])}])),'
  + 'distance: game.distance, loadout: starterSkills, prepSkills: starters,'
  + 'rarities: skillRarities, maxSkillLevel,'
  + 'cards: Object.entries(cards).filter(([id, card]) => skillCharge[id] || Object.values(foes).some(foe => foe.patterns.flat().some(([key]) => id === key)))'
  + '.map(([id, card]) => ({...card, id,'
  + 'cooldown: skillCharge[id], description: describe(id,card),'
  + 'art: card.character ? skillArtSrc(id) : skillEmoteSrc(id),'
  + 'emote: skillCharge[id] ? skillEmoteSrc(id) : null}))'
  + '}; })())'));
const publish = (relative, content) => {
  const path = new URL(relative, local);
  mkdirSync(new URL(".", path), { recursive: true });
  if (content !== undefined) writeFileSync(path, content);
  else copyFileSync(new URL(relative, web), path);
};

const assets = [
  "art/arena/prison-backdrop.webp", "art/arena/ventilation.webp", "art/arena/infirmary.webp",
  "art/arena/landing.webp", "art/arena/lift.webp", "art/locations/camp.webp", "art/locations/surface-exit.webp",
  "art/arena/solitary.webp", "art/locations/shop.webp", "art/locations/camp-departure.webp",
  "art/arena/prison-pursuer.webp", "art/locations/pursuer-capture.webp",
  ...data.openingPanels.map(([id]) => "art/opening/" + id + ".webp"),
  ...Object.values(data.mysteryEvents).map(event => event.art),
  ...Object.values(data.shopOffers).map(offer => offer.art),
  ...Object.keys(data.recruits).map(kind => "art/encounters/" + kind + ".webp"),
  ...["nun", ...Object.keys(data.recruits)].map(kind => run('partyArt[' + JSON.stringify(kind === "nun" ? "player" : kind) + '].src')),
  ...["nun", ...Object.keys(data.recruits), "janitor", "crawler", "medic", "sentinel", "bellboy"]
    .flatMap(kind => JSON.parse(run("JSON.stringify(Object.values(motionArt[" + JSON.stringify(kind) + "]))"))),
  ...data.cards.filter(card => Number.isFinite(card.cooldown))
    .flatMap(card => [card.art, card.emote]),
  ...Object.values(data.wounds.decals),
  ...Object.values(data.camp.poses).flatMap(poses => Object.values(poses).map(pose => pose.src)),
  ...Object.values(data.visuals).flatMap(visual => [
    ...Object.values(visual.armLoss),
    ...Object.values(visual.kneeling).flatMap(poses => Object.values(poses).map(pose => pose.src)),
  ]),
];
for (const relative of new Set(assets)) publish(relative);
const html = readFileSync(new URL("index.html", web), "utf8");
for (const kind of ["janitor", "crawler", "medic", "sentinel"]) {
  const marker = "--art-" + kind + ":url(data:image/webp;base64,";
  const start = html.indexOf(marker);
  if (start < 0) throw Error("Expected the web prototype's embedded " + kind + " idle portrait");
  const dataStart = start + marker.length;
  publish("art/characters/" + kind + "-idle.webp", Buffer.from(html.slice(dataStart, html.indexOf(")", dataStart)), "base64"));
}
for (const [type, id] of Object.entries({
  battle: "routeBattle", rest: "routeRest", boss: "bell", exit: "routeExit",
  shop: "routeShop", elite: "routeElite", mystery: "routeMystery",
  defense: "defense", pursuer: "pursuer", runner: "runner", "tutorial-battle": "routeBattle",
})) {
  const size = ["defense", "pursuer", "tutorial-battle"].includes(type) ? 96 : 24;
  const svg = run("icon(" + JSON.stringify(id) + ")")
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" ')
    .replace('stroke="currentColor"', 'stroke="#ffffff"');
  publish("art/route/" + type + ".svg", svg + "\n");
}
publish("data/threshold.json", JSON.stringify(data, null, 2) + "\n");
