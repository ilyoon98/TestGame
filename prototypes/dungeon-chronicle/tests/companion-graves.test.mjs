import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { bondState } from '../dist/town-connections.js';
import { person } from '../dist/relationships.js';
import { openCompanionEvent, openCompanionMemory } from '../dist/companions.js';
import { companionGraves, validCompanionGrave, isCompanionGrave, sharedEventLabel } from '../dist/companion-graves.js';
import { mergeMemorials, toMemorial, tombMarkup, memorialText, engravingLegend, ageLabel } from '../dist/memorial.js';
import { cemeteryLayout, searchMemorials } from '../dist/cemetery-map.js';
import { CemeteryWalker, nearbyGrave, memorialStory } from '../dist/cemetery-walker.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<60)g.step();};
function joined(){
  const g=Fantasy.restore(new Dungeon(11).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.s.gold=100;g.enterDungeon('mine');g.s.queue=[];g.s.floor=1;g.s.room=2;
  bondState(g).contacts.miners={source:null,choice:null,status:'known'};Object.assign(person(g,'miners'),{score:3,meetings:2});
  openCompanionEvent(g,'miners','invite');g.choose('together');drain(g);return g;
}
function death(){const g=joined();openCompanionEvent(g,'miners','danger');g.chance=()=>false;g.choose('rescue');drain(g);return g;}

test('an NPC grave appears on the actual death result while its owner is still alive',()=>{
  const g=joined();assert.deepEqual(companionGraves(g.s),[]);openCompanionEvent(g,'miners','danger');g.chance=()=>false;g.choose('rescue');
  assert.deepEqual(companionGraves(g.s),[]);drain(g);assert.equal(g.s.status,'running');assert.ok(g.s.hp>0);
  const [m]=mergeMemorials([],[g.s]);assert.ok(isCompanionGrave(m));assert.equal(m.character.name,person(g,'miners').name);assert.equal(m.owner.id,g.s.id);assert.equal(m.outcome.location,person(g,'miners').fate.location);assert.equal(m.outcome.cause,person(g,'miners').fate.cause);assert.ok(validCompanionGrave(m));
  assert.ok(m.sharedEvents.some(e=>e.text.includes('다음 세 구간을 함께')));assert.ok(m.sharedEvents.every(e=>!e.text.startsWith('선택:')&&!e.text.includes('위험을 함께 살핍니다')));
});
test('injured and retired friends do not receive graves',()=>{
  const g=joined();openCompanionEvent(g,'miners','danger');g.chance=()=>true;g.choose('rescue');drain(g);assert.equal(person(g,'miners').fate.state,'injured');assert.deepEqual(companionGraves(g.s),[]);
  person(g,'miners').fate.state='retired';assert.deepEqual(companionGraves(g.s),[]);
});
test('restoring and saving repeatedly preserves one stone and its shared events',()=>{
  const g=death(),first=mergeMemorials([],[g.s]),restored=Fantasy.restore(structuredClone(g.s));
  const merged=mergeMemorials(first,[restored.s,restored.s]);assert.deepEqual(merged,first);assert.deepEqual(mergeMemorials(JSON.parse(JSON.stringify(first)),[]),first);
  const other=structuredClone(g.s);other.id+='another-life';const two=mergeMemorials(first,[other]);assert.equal(two.length,2);assert.equal(two[0].character.name,two[1].character.name);assert.notEqual(two[0].id,two[1].id);
});
test('later mourning joins the same permanent shared-history record',()=>{
  const g=death(),saved=mergeMemorials([],[g.s]);g.world.mode='life';g.world.career='inn';g.world.totalDays+=36;g.advanceTime(1080);g.s.queue=[];
  assert.equal(openCompanionMemory(g,'miners'),true);g.choose('tell');drain(g);const [m]=mergeMemorials(saved,[g.s]);
  assert.ok(m.sharedEvents.some(e=>e.text.includes('신입')));assert.equal(m.id,saved[0].id);assert.equal(m.outcome.cause,saved[0].outcome.cause);assert.ok(m.sharedEvents.length>saved[0].sharedEvents.length);
});
test('old compact protagonist stones recover dead acquaintances without inventing their ages',()=>{
  const g=death();g.finish('death','마지막 기록');const old=toMemorial(g.s),all=mergeMemorials([old],[]),m=all.find(isCompanionGrave);
  assert.ok(m);assert.equal(m.owner.name,g.character.name);assert.ok(m.sharedEvents.some(e=>e.text===m.outcome.cause));assert.equal(m.character.race,undefined);assert.equal(m.outcome.ageYears,undefined);
  for(const e of m.sharedEvents.filter(e=>e.ownerAgeYears===null))assert.match(sharedEventLabel(m,e),/시기 기록 없음/);
  assert.equal(ageLabel(m),'기억 속 인연');assert.match(memorialText(m),/그때 .*의 나이:/);
});
test('full logs recover richer shared experiences than compact grave summaries',()=>{
  const g=death();g.finish('death','마지막 기록');const old=toMemorial(g.s),m=mergeMemorials([old],[g.s]).find(isCompanionGrave);
  assert.deepEqual(m.sharedEvents,companionGraves(g.s)[0].sharedEvents);assert.ok(m.sharedEvents.some(e=>e.text.includes('다음 세 구간을 함께')));
});
test('a walking visitor finds the named friend and reads the death and shared story',()=>{
  const g=death(),[m]=companionGraves(g.s),layout=cemeteryLayout([m]),walker=new CemeteryWalker(layout.width);walker.walkTo(layout.plots[0].x+89);for(let i=0;i<100;i++)walker.step(.05);
  assert.equal(nearbyGrave(layout.plots,walker.x).memorial.id,m.id);const story=memorialStory(m);assert.ok(story.includes(m.character.name));assert.ok(story.includes(m.owner.name));assert.ok(story.includes(m.outcome.location));assert.ok(story.includes(m.outcome.cause));
  assert.deepEqual(searchMemorials([m],`${m.owner.name} 인연 ${m.role}`),[m]);assert.match(tombMarkup(m),/companion-tomb/);assert.doesNotMatch(tombMarkup(m),/undefined/);assert.equal(engravingLegend(m).length,2);
});
test('NPC graves survive history eviction and backup round trips, without duplicate import',()=>{
  const g=death(),saved=mergeMemorials([],[g.s]);const imported=importRecords(exportRecords(saved,[]),[],[]);assert.deepEqual(imported.memorials,saved);assert.equal(imported.history.length,0);
  const twice=importRecords(exportRecords(saved,[]),saved,[]);assert.equal(twice.added,0);assert.deepEqual(twice.memorials,saved);
  const bad=structuredClone(saved);bad[0].owner.id='a-different-life';assert.throws(()=>importRecords(exportRecords(bad,[]),[],[]));
  const forged=structuredClone(saved);forged[0].honors=['three'];assert.throws(()=>importRecords(exportRecords(forged,[]),[],[]));
});
test('importing old completed stories recovers NPC deaths even without their own stone',()=>{
  const g=death();g.finish('story','모험을 마칩니다.');const restored=importRecords(exportRecords([],[g.s]),[],[]);assert.equal(restored.memorials.length,1);assert.ok(isCompanionGrave(restored.memorials[0]));assert.equal(restored.history[0].outcome.type,'story');
});
