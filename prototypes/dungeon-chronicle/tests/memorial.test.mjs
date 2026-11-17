import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { earnedHonors, toMemorial, mergeMemorials, tombDesign, tombMarkup, lifeRole, memorialText } from '../dist/memorial.js';
function deceased(seed=11){const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.finish('death','낙석');g.s.outcome.cause='낙석';return g.s;}
test('existing deaths migrate without changing their identity, logs or age',()=>{
  const s=deceased(),before=structuredClone(s),m=toMemorial(s);assert.equal(m.id,s.id);assert.deepEqual(m.outcome,s.outcome);assert.deepEqual(s,before);assert.equal(m.character.name,s.character.name);assert.equal('log' in m,false);assert.equal('queue' in m,false);
});
test('death results retain the deepest current floor even without a completed trip',()=>{
  const g=Fantasy.restore(new Dungeon(11).s);g.start();g.world.bestFloor=3;g.s.maxFloor=6;g.finish('death','유적에서 사망');assert.equal(g.s.outcome.floor,6);
});
test('compact graves survive beyond twenty stories and reloads without duplicates',()=>{
  const states=Array.from({length:80},(_,i)=>deceased(i+1));const a=mergeMemorials([],states),b=mergeMemorials(JSON.parse(JSON.stringify(a)),states.slice(-20));assert.equal(b.length,80);assert.deepEqual(b,a);assert.equal(mergeMemorials(a,[states[0]]).length,80);
});
test('living, returned and deliberately completed stories do not acquire graves',()=>{
  const s=deceased();for(const type of ['story','return','clear']){s.outcome.type=type;assert.equal(toMemorial(s),null);}assert.deepEqual(mergeMemorials([], [s]),[]);
});
test('rare dungeon honors require real victories and the hard dungeon trophy',()=>{
  const s=deceased();s.maxFloor=7;s.outcome.floor=7;assert.deepEqual(earnedHonors(s),[]);s.world.cleared=['ruins'];assert.deepEqual(earnedHonors(s),[]);s.inventory.push('별의 심장');assert.deepEqual(earnedHonors(s),['star']);s.world.cleared.push('mine','crypt');assert.deepEqual(earnedHonors(s),['three','star']);assert.equal(tombDesign(toMemorial(s)).ornament,'crown');
});
test('work and kindness honors require several earned conditions, not just a job',()=>{
  const s=deceased();s.world.careerHistory=['smith','trader'];s.gold=2000;s.world.reputation=90;assert.deepEqual(earnedHonors(s),[]);Object.assign(s.world.flags,{oreUsed:true,smithFurnace:true,traderTrusted:true,friendVisited:true,healthNetwork:true});assert.deepEqual(earnedHonors(s),['master','guardian','fortune']);s.world.reputation=79;assert.deepEqual(earnedHonors(s),['fortune']);
});
test('race, job, traits, work, age and life identity each leave stable visual marks',()=>{
  const s=deceased(),m=toMemorial(s),baseline=tombMarkup(m);assert.equal(tombMarkup(JSON.parse(JSON.stringify(m))),baseline);
  for(const change of [x=>x.character.race=x.character.race==='elf'?'human':'elf',x=>x.character.job='priest',x=>x.character.traits=['lost','frail'],x=>x.career='smith',x=>x.outcome.ageYears=82,x=>x.id='another-life']){const n=structuredClone(m);change(n);assert.notEqual(tombMarkup(n),baseline);}
  m.character.job='child';m.outcome.ageYears=5;assert.equal(tombDesign(m).young,true);m.character.job='warrior';m.outcome.ageYears=85;assert.equal(tombDesign(m).weathered,true);
});
test('historical summaries show the last lived profession and export only that life',()=>{
  const s=deceased();s.world.careerHistory=['inn','trader'];s.world.career=null;s.character.name='<새 이름>';const m=toMemorial(s);assert.equal(lifeRole(m),'상인');assert.match(memorialText(m),/<새 이름>/);assert.match(tombMarkup(m),/&lt;새 이름&gt;/);assert.doesNotMatch(tombMarkup(m),/aria-label="<새 이름>/);assert.match(memorialText(m),/낙석/);
});
