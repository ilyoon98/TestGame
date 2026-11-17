import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RACES, JOBS, TRAITS } from '../dist/engine.js';
import { spriteMarkup, baseTransform, SPRITE_LAYOUT, VISUAL_IDS } from '../dist/visuals.js';

test('every race, job and trait has an icon',()=>{
  for(const value of [...RACES,...JOBS,...TRAITS])assert.ok(VISUAL_IDS.includes(value.id),value.id);
});
test('each job uses the identical front equipment layer on every race',()=>{
  for(const job of JOBS){
    const layers=RACES.map(race=>spriteMarkup(race.id,job.id).split('<span class="sprite-front">')[1].split('</span>')[0]);
    assert.equal(new Set(layers).size,1,job.id);
    assert.ok(layers[0].includes('viewBox="0 0 32 48"'));
  }
});
test('porter backpack is behind all five base bodies',()=>{
  for(const race of RACES){const sprite=spriteMarkup(race.id,'porter');assert.ok(sprite.indexOf('sprite-back')<sprite.indexOf('sprite-base'));assert.ok(sprite.indexOf('sprite-base')<sprite.indexOf('sprite-front'));}
});
test('generated base bodies fit the common head and feet anchors',()=>{
  const bounds={human:[123,185,336,604],elf:[82,185,336,604],dwarf:[83,206,297,604],goblin:[97,139,362,516],undead:[107,139,310,516]};
  for(const race of RACES){
    const values=baseTransform(race.id).match(/-?\d+(?:\.\d+)?/g).map(Number),[x,y,scale]=values,[left,top,right,bottom]=bounds[race.id];
    const frameWidth=418,frameHeight=627;
    const targetX=(left+right)/2/frameWidth*32+x/100*32;
    const targetTop=top/frameHeight*48*scale+y/100*48,targetFeet=bottom/frameHeight*48*scale+y/100*48;
    assert.ok(Math.abs(targetX-SPRITE_LAYOUT.centerX)<.001,race.id);
    assert.ok(Math.abs(targetTop-SPRITE_LAYOUT.bodyTop)<.001,race.id);
    assert.ok(Math.abs(targetFeet-SPRITE_LAYOUT.feetY)<.001,race.id);
  }
});
test('the raster sheet has the expected grid dimensions and alpha channel',()=>{
  const png=readFileSync(new URL('../dist/assets/race-bases-simple.png',import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1254);assert.equal(png.readUInt32BE(20),1254);assert.equal(png[25],6);
  const undead=readFileSync(new URL('../dist/assets/race-bases-undead-face-v3.png',import.meta.url));
  assert.equal(undead.readUInt32BE(16),1254);assert.equal(undead.readUInt32BE(20),1254);assert.equal(undead[25],6);
});
