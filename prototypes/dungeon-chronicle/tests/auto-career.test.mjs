import test from 'node:test';
import assert from 'node:assert/strict';
import { Fantasy, CAREERS } from '../dist/world.js';
import { Dungeon } from '../dist/engine.js';
import { automaticPreference } from '../dist/preferences.js';

function careerChoice(seed){const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.worldChoice('careers');return g;}

test('new and pre-default sessions begin with automatic decisions enabled',()=>{
  assert.equal(automaticPreference(),true);assert.equal(automaticPreference({automatic:false}),true);assert.equal(automaticPreference({automatic:true}),true);
});
test('explicitly canceled automatic decisions remain manual after a saved reload',()=>{
  const saved=JSON.parse(JSON.stringify({autoModeVersion:1,automatic:false}));assert.equal(automaticPreference(saved),false);assert.equal(automaticPreference({autoModeVersion:1,automatic:true}),true);
});
test('all four automatic careers have a substantial share without a guild fallback',()=>{
  const counts=Object.fromEntries(CAREERS.map(c=>[c.id,0]));for(let seed=1;seed<=5000;seed++){const g=careerChoice(seed),id=g.autoChoice();counts[id]++;assert.equal(g.autoChoice(),id);const b=Fantasy.restore(JSON.parse(JSON.stringify(g.s)));assert.equal(b.autoChoice(),id);}console.log('Automatic first careers / 5000:',counts);for(const count of Object.values(counts))assert.ok(count>=800&&count<=1800);assert.ok(counts.guild<1500);
});
test('a neutral character has comparable odds for every career',()=>{
  const counts={inn:0,guild:0,trader:0,smith:0};for(let seed=1;seed<=1000;seed++){const g=careerChoice(seed);g.character.race='human';g.character.job='warrior';g.character.traits=['sharp','regen'];counts[g.autoChoice()]++;}for(const count of Object.values(counts))assert.ok(count>=180&&count<=320);
});
test('switching work slightly favors careers the person has not tried',()=>{
  let first=0,repeated=0;for(let seed=1;seed<=1000;seed++){const a=careerChoice(seed),b=Fantasy.restore(structuredClone(a.s));for(const g of [a,b]){g.character.race='human';g.character.job='warrior';g.character.traits=['sharp','regen'];}b.world.careerHistory=['guild'];if(a.autoChoice()==='guild')first++;if(b.autoChoice()==='guild')repeated++;}assert.ok(repeated<first*.85);
});
test('cached career reservations from the old guild-heavy policy are recalculated once',()=>{
  const seen=new Set();for(let seed=1;seed<=40;seed++){const g=careerChoice(seed);g.s.choice.autoTarget='guild';const id=g.autoChoice();seen.add(id);assert.equal(g.s.choice.autoPolicy,2);assert.equal(g.autoChoice(),id);}assert.ok(seen.size>=3);
});
