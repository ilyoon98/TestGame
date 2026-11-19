import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";
import {inspectRgbaPng} from "./helpers/png.mjs";

test("party cutouts have real alpha, matching canvases, safe margins and registered feet",()=>{
  const run=engine();
  const feet=[];
  for(const name of ["player","guard","awakened","archer","shaman"]){
    const src=run(`partyArt['${name}'].src`);
    const png=inspectRgbaPng(readFileSync(new URL(`../${src}`,import.meta.url)));
    assert.equal(png.width,1024);
    assert.equal(png.height,1536);
    assert.ok(png.transparent/(png.width*png.height)>.4,`${name}: insufficient transparent background`);
    for(const [x,y] of [[0,0],[1023,0],[0,1535],[1023,1535]]) assert.ok(png.alphaAt(x,y)<=1,`${name}: opaque corner`);
    assert.ok(png.bounds.left>40 && png.bounds.right<984,`${name}: clipped equipment`);
    assert.ok(png.bounds.top>30 && png.bounds.bottom<1506,`${name}: clipped head or feet`);
    assert.ok(png.bounds.bottom>1400,`${name}: incorrect ground registration`);
    feet.push(png.bounds.bottom);
  }
  assert.ok(Math.max(...feet)-Math.min(...feet)<=32,"party foot baseline differs by more than 2.1% of canvas");
});

test("the nun uses the new portrait and each party portrait has six normalized body anchors",()=>{
  const run=engine();
  assert.equal(run("bodyPanel('player',battleIntent(),'healthy').includes('art/characters/nun-sd.png')"),true);
  assert.equal(run("bodyPanel('player',battleIntent(),'healthy').includes('sd-actor')"),true);
  assert.equal(run("bodyPanel('player',battleIntent(),'healthy').includes('var(--art-player)')"),false);
  for(const key of ["player","guard","awakened","archer","shaman"]){
    assert.equal(run(`bodyAnchors['${key}'].length`),6);
    assert.equal(run(`bodyAnchors['${key}'].every(point=>point.length===2 && point.every(n=>Number.isFinite(n) && n>0 && n<100))`),true);
    const src=run(`partyArt['${key}'].src`);
    assert.ok(readFileSync(new URL(`../${src}`,import.meta.url)).length>0);
  }
  for(const id of ["snapShot","mending","unseal"]){
    assert.match(run(`skillArtSrc('${id}')`),/-v5\.webp$/);
    assert.ok(readFileSync(new URL(`../${run(`skillArtSrc('${id}')`)}`,import.meta.url)).length>0);
  }
});

test("both recruited companions appear and only the fallen companion leaves the field",()=>{
  const run=engine();
  const field=()=>run("layoutCombatHud=()=>{}; renderScreen(); document.querySelector('#stage').innerHTML");
  assert.doesNotMatch(field(),/class="panel actor-companion/);
  run("game.enemy.hp=0; finishCombat(); chooseReward(null);");
  assert.equal(run("companionEncounterPanel().includes('art/characters/guard-sd.png')"),true);
  run("recruitCompanion('guard'); moveTo('infirmary'); beginCombat();");
  assert.match(field(),/art\/characters\/guard-sd\.png/);
  run("game.enemy.hp=0; finishCombat(); chooseReward(null);");
  assert.equal(run("companionEncounterPanel().includes('art/characters/awakened-sd.png')"),true);
  run("recruitCompanion('awakened'); declineCompanion(); moveTo('lift'); beginCombat();");
  assert.match(field(),/--combat-columns:4/);
  assert.match(field(),/art\/characters\/awakened-sd\.png/);
  assert.match(field(),/art\/characters\/guard-sd\.png/);
  run("hit(game.enemy,game.companion,'head',99,{id:'heavy'},game);");
  assert.match(field(),/--combat-columns:3/);
  assert.match(field(),/art\/characters\/awakened-sd\.png/);
  assert.doesNotMatch(field(),/art\/characters\/guard-sd\.png/);
});

test("combat renders the ally on the field and retains expanded body readouts across actions",()=>{
  const run=engine();
  run("layoutCombatHud=()=>{}; renderScreen();");
  assert.equal(run("document.querySelector('#stage').innerHTML.includes('party-combat')"),false);
  run(`
    game.enemy.hp=0; finishCombat(); chooseReward(null); recruitCompanion('guard'); moveTo('duct'); beginCombat();
    globalThis.readouts=['player','companion','enemy'].map(side=>({dataset:{side},open:false}));
    document.querySelector('#stage').querySelectorAll=selector=>selector==='.actor-body-status[open]'?[readouts[1]]:selector==='.actor-body-status'?readouts:[];
    renderScreen();
    globalThis.markup=document.querySelector('#stage').innerHTML;
  `);
  assert.equal(run("markup.includes('party-combat')"),true);
  assert.equal(run("markup.indexOf('actor-player')<markup.indexOf('actor-companion') && markup.indexOf('actor-companion')<markup.indexOf('actor-enemy')"),true);
  assert.equal(run("readouts.map(node=>node.open).join(',')"),"false,true,false");
  assert.equal(run("markup.includes('class=\"actor-sprite\" src=\"art/characters/guard-sd.png\"')"),true);
  assert.equal(run("markup.includes('companion-parts')"),false);
});
