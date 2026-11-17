import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { bondState } from '../dist/town-connections.js';
import { person, personLabel } from '../dist/relationships.js';
import { openCompanionEvent } from '../dist/companions.js';
import { makeRemembrance, remembranceVisits, validRemembrance, visitWhen } from '../dist/grave-visits.js';
import { toMemorial, mergeMemorials, tombMarkup, memorialText } from '../dist/memorial.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<60)g.step();};
function joined(){
  const g=Fantasy.restore(new Dungeon(11).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.s.gold=100;g.enterDungeon('mine');g.s.queue=[];g.s.floor=2;g.s.room=2;
  bondState(g).contacts.miners={source:null,choice:null,status:'known'};Object.assign(person(g,'miners'),{score:3,meetings:2});openCompanionEvent(g,'miners','invite');g.choose('together');drain(g);return g;
}
function finish(g){g.s.flags.deathCause='고요한 밤에 노환으로 생을 마쳤습니다.';g.finish('death','마지막 기록');return g;}

test('surviving friends visit only after the player dies and recall a committed shared encounter',()=>{
  const g=joined();assert.equal(makeRemembrance(g.s),null);finish(g);const before=structuredClone(g.s),m=toMemorial(g.s),visits=remembranceVisits(m);
  assert.equal(visits.length,2);assert.ok(visits.every(v=>v.name===person(g,'miners').name&&v.group==='miners'));assert.ok(visits[0].memory.text.includes('다음 세 구간을 함께'));assert.ok(visits[0].flowers);assert.ok(visits[1].daysAfterDeath>=365);assert.deepEqual(g.s,before);assert.ok(validRemembrance(m.remembrance,m.relationships));
});
test('a deceased companion never visits even if they had the closest relationship',()=>{
  const g=joined();openCompanionEvent(g,'miners','danger');g.chance=()=>false;g.choose('rescue');drain(g);assert.equal(person(g,'miners').fate.state,'dead');finish(g);assert.deepEqual(remembranceVisits(toMemorial(g.s)),[]);
  g.s.outcome.at=g.s.startedAt;const records=importRecords(exportRecords([toMemorial(g.s)],[]),[],[]).memorials;assert.equal(records[0].id,g.s.id);assert.equal(records[1].kind,'companion');
});
test('injured survivors send flowers from care instead of being silently healed',()=>{
  const g=joined();openCompanionEvent(g,'miners','danger');g.chance=()=>true;g.choose('rescue');drain(g);finish(g);const m=toMemorial(g.s),[v]=remembranceVisits(m);
  assert.equal(v.action,'letter');assert.equal(v.condition,'injured');assert.match(v.text,/요양처에서 꽃과 편지/);assert.equal(person(g,'miners').fate.state,'injured');assert.equal(m.remembrance.visits.length,1);
});
test('a survivor remembers the actual rescue when the player later dies',()=>{
  const g=joined(),chances=[true,false];g.chance=()=>chances.shift()??false;g.emit('치명적인 낙석.','bad',{hp:-g.s.hp});assert.equal(person(g,'miners').fate.savedPlayer,true);assert.equal(person(g,'miners').fate.state,'injured');finish(g);
  assert.match(toMemorial(g.s).remembrance.visits[0].memory.text,/목숨을 구해 줬습니다/);
});
test('a retired friend still visits while estranged acquaintances do not pretend to reconcile',()=>{
  const g=joined();openCompanionEvent(g,'miners','danger');g.chance=()=>true;g.choose('rescue');drain(g);person(g,'miners').fate.state='retired';finish(g);assert.equal(toMemorial(g.s).remembrance.visits[0].action,'flowers');
  const h=joined();person(h,'miners').score=-4;finish(h);const [v]=toMemorial(h.s).remembrance.visits;assert.equal(v.action,'quiet');assert.equal(v.flowers,false);assert.match(v.text,/풀지 못한 말/);assert.equal(toMemorial(h.s).remembrance.visits.length,1);
});
test('uncommitted prompts and unintroduced people are not promoted to shared memories',()=>{
  const g=joined(),name=personLabel(g,'miners');g.emit(`${name} — 아직 선택하지 않은 부탁.`,'choice');g.enqueue(`${name} — 실행되지 않은 약속.`);person(g,'scouts');finish(g);const visits=toMemorial(g.s).remembrance.visits;
  assert.ok(visits.every(v=>v.group==='miners'));assert.ok(visits.every(v=>!v.memory.text.includes('아직 선택')&&!v.memory.text.includes('실행되지')));
});
test('a seeded epilogue stays identical across restore, repeated rendering and unrelated random draws',()=>{
  const g=finish(joined()),first=toMemorial(g.s),copy=Fantasy.restore(structuredClone(g.s));assert.deepEqual(toMemorial(copy.s).remembrance,first.remembrance);for(let i=0;i<20;i++)g.random();assert.deepEqual(toMemorial(g.s).remembrance,first.remembrance);
  const twice=mergeMemorials(mergeMemorials([],[g.s]),[g.s,g.s]);assert.equal(twice.length,1);assert.deepEqual(twice[0].remembrance,first.remembrance);
});
test('old compact stones gain modest visits without inventing lost incident details',()=>{
  const g=finish(joined()),old=toMemorial(g.s);delete old.remembrance;old.reunions=[];const [m]=mergeMemorials([old],[]);assert.ok(m.remembrance.visits.length);assert.match(m.remembrance.visits[0].memory.text,/함께 걸었던/);assert.equal(m.remembrance.visits[0].memory.ageYears,null);assert.equal(m.remembrance.visits[0].memory.location,'');
  assert.deepEqual(mergeMemorials([m],[]),[m]);const restored=mergeMemorials([old],[g.s])[0];assert.match(restored.remembrance.visits[0].memory.text,/다음 세 구간/);
  const imported=importRecords(exportRecords([old],[g.s]),[],[]).memorials.find(x=>x.id===g.s.id);assert.match(imported.remembrance.visits[0].memory.text,/다음 세 구간/);
});
test('flowers and farewell stories survive log eviction, backups and text export',()=>{
  const g=finish(joined()),m=toMemorial(g.s),restored=importRecords(exportRecords([m],[]),[],[]).memorials[0];assert.deepEqual(restored,m);assert.match(tombMarkup(restored),/remembrance-flowers/);assert.match(memorialText(restored),/사망 .*뒤/);assert.match(memorialText(restored),/다음 세 구간/);assert.match(visitWhen(restored.remembrance.visits[1]),/사망 1년 뒤/);
  const repeat=importRecords(exportRecords([m],[]),[m],[]);assert.equal(repeat.added,0);assert.deepEqual(repeat.memorials[0].remembrance,m.remembrance);
});
test('backups reject unknown visitors, duplicate visits and invented healthy visits from injured friends',()=>{
  const m=toMemorial(finish(joined()).s);for(const mutate of [x=>x.remembrance.visits[0].name='만난 적 없는 사람',x=>x.remembrance.visits.push(x.remembrance.visits[0]),x=>x.remembrance.visits[0].condition='injured',x=>x.remembrance.visits[0].daysAfterDeath=-5]){
    const bad=structuredClone(m);mutate(bad);assert.throws(()=>importRecords(exportRecords([bad],[]),[],[]));
  }
  const g=joined();openCompanionEvent(g,'miners','danger');g.chance=()=>false;g.choose('rescue');drain(g);const dead=toMemorial(finish(g).s);dead.remembrance=m.remembrance;assert.throws(()=>importRecords(exportRecords([dead],[]),[],[]));
});
test('a short life with no acquaintances remains a quiet grave, not an invented funeral',()=>{
  const g=Fantasy.restore(new Dungeon(4).s);g.start();finish(g);const m=toMemorial(g.s);assert.deepEqual(m.remembrance.visits,[]);assert.doesNotMatch(tombMarkup(m),/remembrance-flowers/);assert.equal(makeRemembrance({...m,kind:'companion'}),null);
});
