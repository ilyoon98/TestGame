import test from 'node:test';
import assert from 'node:assert/strict';
import { cemeteryLayout, mapPercent } from '../dist/cemetery-map.js';
const stone=(id,day)=>({id,outcome:{at:`2026-10-${String(day).padStart(2,'0')}T00:00:00Z`}});
test('the cemetery grows horizontally and retains every resting place',()=>{
  const records=Array.from({length:80},(_,i)=>({id:String(i),outcome:{at:new Date(1700000000000+i*1000).toISOString()}})),map=cemeteryLayout(records);
  assert.equal(map.plots.length,80);assert.ok(map.width>16000);assert.ok(map.plots.at(-1).x+178<map.width);assert.equal(new Set(map.plots.map(x=>x.x)).size,80);
});
test('resting places are chronological, stable on restore and unchanged by a later death',()=>{
  const input=[stone('b',3),stone('a',1)],copy=structuredClone(input),a=cemeteryLayout(input);assert.deepEqual(input,copy);assert.equal(a.plots[0].memorial.id,'a');assert.deepEqual(a,cemeteryLayout(JSON.parse(JSON.stringify(input))));const b=cemeteryLayout([...input,stone('c',4)]);assert.deepEqual(b.plots.slice(0,2),a.plots);
});
test('navigation remains valid at the entrance, far end and empty cemetery',()=>{
  assert.equal(mapPercent(0,1500),0);assert.equal(mapPercent(750,1500),50);assert.equal(mapPercent(2000,1500),100);assert.equal(mapPercent(-100,1500),0);assert.equal(mapPercent(1,0),0);assert.ok(cemeteryLayout([]).width>=1500);
});
