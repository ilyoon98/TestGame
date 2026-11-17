import test from 'node:test';
import assert from 'node:assert/strict';
import { Fantasy } from '../dist/world.js';
import { Dungeon, JOBS } from '../dist/engine.js';

function grow(g){let n=0;while(g.world.mode==='childhood'&&g.s.status!=='ended'&&n++<100)g.step();assert.ok(n<100);return g;}
function comparable(g){const s=structuredClone(g.s);if(s.outcome)delete s.outcome.at;return s;}

test('a new life begins at one with two named parents and no future job or equipment',()=>{
  const g=new Fantasy(11);assert.deepEqual(g.age(),{years:1,months:0});assert.equal(g.character.job,'child');assert.equal(g.displayJob().name,'아직 직업 없음');assert.equal(g.s.potions,0);assert.deepEqual(g.s.inventory,[]);g.start();g.step();
  assert.equal(g.s.log[0].ageYears,1);assert.equal(g.world.mode,'childhood');assert.equal(g.s.choice,null);assert.equal(g.canChangePath(),false);assert.equal(g.enterDungeon('mine'),false);
  for(const p of g.life.family.parents){assert.ok(g.s.log[0].text.includes(p.name));assert.ok(g.s.log[1].text.includes(p.job));}assert.ok(g.s.log[0].text.includes(g.life.family.place));
});
test('childhood advances automatically and only assigns a job at eighteen',()=>{
  const g=new Fantasy(11);g.start();g.chance=()=>false;const traits=[...g.character.traits],power=g.character.power;grow(g);
  assert.equal(g.age().years,18);assert.equal(g.world.mode,'hub');assert.equal(g.life.stage,'adult');assert.ok(JOBS.some(j=>j.id===g.character.job));assert.equal(g.character.power,power+g.job().power);assert.equal(g.s.inventory.length,1);assert.equal(g.s.potions,2);assert.deepEqual(g.character.traits,traits);assert.equal(g.life.jobRevealPending,true);
  assert.ok(g.s.log.filter(x=>x.ageYears<18).every(x=>!JOBS.some(j=>x.text.includes(`${j.name} 일을 배우기`))));g.step();assert.equal(g.s.choice.kind,'hub');
});
test('an illness produces dedicated care and recovery logs before time moves on',()=>{
  const g=new Fantasy(11);g.start();g.step();const before=g.age().years;let rolls=[false,true,false];g.chance=()=>rolls.shift()??false;g.step();assert.ok(g.life.illness);const age=g.age().years;g.step();assert.equal(g.age().years,age);g.step();assert.equal(g.life.illness,null);assert.equal(g.age().years,before+1);assert.match(g.s.log.at(-1).text,/회복/);assert.notEqual(g.s.status,'ended');
});
test('a child can die from illness before any job, with family, age and cause preserved',()=>{
  const g=new Fantasy(11);g.start();g.step();g.character.traits=['sharp','brave'];g.life.illness={id:'fever',step:1,fatal:true};g.step();g.step();g.step();assert.equal(g.s.status,'ended');assert.equal(g.s.outcome.type,'death');assert.equal(g.s.outcome.ageYears,1);assert.match(g.s.outcome.cause,/고열/);assert.match(g.s.outcome.location,/집/);assert.equal(g.character.job,'child');assert.ok(g.life.family.parents.length===2);assert.ok(g.s.log.every(x=>!/[\r\n]/.test(x.text)));
});
test('the first fatal childhood illness respects the blessing trait',()=>{
  const g=new Fantasy(11);g.start();g.step();g.character.traits=['blessed','sharp'];g.life.illness={id:'infection',step:2,fatal:true};g.step();g.step();assert.equal(g.s.hp,1);assert.equal(g.s.flags.saved,true);assert.notEqual(g.s.status,'ended');
});
test('restoring during illness reproduces recovery, growth and the random first job',()=>{
  const a=new Fantasy(11);a.start();a.step();a.life.illness={id:'infection',step:1,fatal:false};const b=Fantasy.restore(JSON.parse(JSON.stringify(a.s)));
  for(let n=0;n<70&&a.s.status!=='ended'&&a.world.mode==='childhood';n++){a.step();b.step();}assert.deepEqual(comparable(a),comparable(b));assert.deepEqual(a.life.family,b.life.family);
});
test('legacy adult saves keep their identity, age, resources and logs',()=>{
  const old=new Dungeon(45);old.start();const raw=structuredClone(old.s);raw.timeline={version:1,startAge:23,elapsedDays:90};const g=Fantasy.restore(raw);assert.equal(g.life,undefined);assert.deepEqual(g.character,old.character);assert.deepEqual(g.s.log,old.s.log);assert.deepEqual(g.age(),{years:23,months:3});assert.equal(g.s.potions,2);
});
test('malformed family and inconsistent growth phase are rejected on restore',()=>{
  const g=new Fantasy(11),raw=structuredClone(g.s);raw.life.family.parents=[];assert.throws(()=>Fantasy.restore(raw));const other=structuredClone(g.s);other.life.stage='adult';assert.throws(()=>Fantasy.restore(other));
});
test('childhood deaths stay near the planned ten to twenty percent across five thousand lives',()=>{
  let deaths=0;const jobs=new Set();for(let seed=1;seed<=5000;seed++){const g=new Fantasy(seed);g.start();grow(g);if(g.s.status==='ended'){deaths++;assert.ok(g.s.outcome.ageYears<18);}else{jobs.add(g.character.job);assert.equal(g.age().years,18);}assert.ok(g.s.log.every(x=>x.location&&!/[\r\n]/.test(x.text)));}
  console.log('Childhood deaths / 5000:',deaths);assert.ok(deaths/5000>=.10&&deaths/5000<=.20);assert.equal(jobs.size,5);
});
