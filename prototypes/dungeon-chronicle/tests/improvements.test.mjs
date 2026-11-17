import test from 'node:test';
import assert from 'node:assert/strict';
import { Fantasy, DUNGEONS } from '../dist/world.js';
import { Dungeon } from '../dist/engine.js';
import { createLayout, validLayout } from '../dist/dungeon-layout.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
import { toMemorial } from '../dist/memorial.js';
import { searchMemorials } from '../dist/cemetery-map.js';
import { playbackBlocked } from '../dist/playback.js';
const adult=seed=>{const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];return g;};
const drain=g=>{let n=0;while(g.s.queue.length&&g.s.status==='running'&&n++<30)g.step();};
function dead(seed){const g=adult(seed);g.s.flags.deathCause='마을에서 생을 마쳤습니다.';g.emit('마지막 기록','bad',{},{finish:'death'});g.s.outcome.at=`2026-10-${String(seed).padStart(2,'0')}T00:00:00Z`;return g.s;}

test('terrain varies across lives, stays in its scale, and has valid variable segments',()=>{
  for(const d of DUNGEONS){const counts=new Set(),rooms=new Set();for(let seed=1;seed<=200;seed++){const l=createLayout(String(seed),d);assert.ok(validLayout(l));assert.ok(Math.abs(l.floors.length-d.floors.length)<=1);assert.equal(l.floors.at(-1),d.floors.at(-1));counts.add(l.floors.length);l.rooms.forEach(n=>rooms.add(n));}assert.equal(counts.size,3);assert.equal(rooms.size,5);}
});
test('revisiting a seeded dungeon keeps terrain but redraws encounter landmarks',()=>{
  const g=adult(18);g.enterDungeon('crypt');drain(g);const terrain=structuredClone(g.layout()),landmarks=structuredClone(g.world.tripLandmarks);
  g.s.floor=2;g.emit('발자국','note');assert.equal(g.layout().visited,2);g.enterDungeon('crypt');assert.deepEqual(g.layout().floors,terrain.floors);assert.deepEqual(g.layout().rooms,terrain.rooms);assert.equal(g.layout().visited,2);assert.notDeepEqual(g.world.tripLandmarks,landmarks);
  const restored=Fantasy.restore(structuredClone(g.s));assert.deepEqual(restored.layout(),g.layout());assert.deepEqual(restored.world.tripLandmarks,g.world.tripLandmarks);
});
test('old active dungeon saves retain the previous exact structure and queued outcomes',()=>{
  const g=adult(15);g.enterDungeon('mine');g.s.floor=2;g.s.maxFloor=2;const raw=structuredClone(g.s);delete raw.world.layouts;delete raw.world.tripLandmarks;
  const copy=Fantasy.restore(raw);assert.deepEqual(copy.floorNames(),DUNGEONS[0].floors);assert.equal(copy.roomCount(),6);assert.deepEqual(copy.s.queue,raw.queue);assert.equal(copy.layout().visited,2);
});
test('unknown malformed stored terrain is rejected',()=>{
  const g=adult(16);g.enterDungeon('ruins');const raw=structuredClone(g.s);raw.world.layouts.ruins.rooms[0]=-1;assert.throws(()=>Fantasy.restore(raw),/구조/);
});
test('automatic stairs use the generated segment count, not a fixed six',()=>{
  const g=adult(12);g.enterDungeon('crypt');g.s.queue=[];g.s.floor=1;g.s.room=g.roomCount();g.step();assert.equal(g.s.floor,2);assert.equal(g.s.room,0);assert.equal(g.s.status,'running');
});
test('preparation checks every passing birthday and records deaths outside the dungeon',()=>{
  const g=adult(20);g.character.race='human';g.s.timeline.elapsedDays=41*360;g.enterDungeon('mine');g.chance=()=>true;g.step();assert.equal(g.age().years,60);assert.equal(g.s.status,'ended');assert.equal(g.s.outcome.type,'death');assert.match(g.s.outcome.location,/원정 준비/);assert.equal(g.s.log.at(-1).ageYears,60);
});
test('one trip spends one to three whole years on preparation and recovery',()=>{
  for(let seed=1;seed<=100;seed++){const g=adult(seed),start=g.s.timeline.elapsedDays;g.enterDungeon('mine');drain(g);g.finish('return','귀환');drain(g);assert.ok(g.s.timeline.elapsedDays-start>=360&&g.s.timeline.elapsedDays-start<=1080);}
});
test('encounter scenery does not repeat before the scene bag is exhausted',()=>{
  const g=adult(12);g.enterDungeon('crypt');g.s.queue=[];g.s.floor=1;g.chance=()=>false;
  const scenes=[];for(let i=0;i<12;i++){g.encounter();scenes.push(g.s.log.at(-1).text);}for(let i=0;i<12;i+=3)assert.equal(new Set(scenes.slice(i,i+3)).size,3);for(let i=1;i<12;i++)assert.notEqual(scenes[i],scenes[i-1]);
});
test('background, help, result, and cemetery independently suspend playback',()=>{
  assert.equal(playbackBlocked(),false);for(const key of ['hidden','guide','result','cemetery'])assert.equal(playbackBlocked({[key]:true}),true);
});
test('record backups round trip, add records, and never overwrite an existing grave',()=>{
  const a=dead(1),b=dead(2),ma=toMemorial(a),mb=toMemorial(b);
  const round=importRecords(exportRecords([ma],[a]),[],[]);assert.deepEqual(round.memorials,[ma]);assert.equal(round.history[0].id,a.id);
  const changed=structuredClone(ma);changed.character.name='파일의 변경된 이름';
  const merged=importRecords(exportRecords([changed,mb],[a,b]),[ma],[a]);assert.equal(merged.added,1);assert.equal(merged.memorials.find(m=>m.id===ma.id).character.name,ma.character.name);assert.equal(merged.history.length,2);
  const repeated=importRecords(exportRecords([mb],[b]),merged.memorials,merged.history);assert.equal(repeated.added,0);assert.equal(repeated.memorials.length,2);
});
test('invalid backup formats and malformed memorials are rejected before merging',()=>{
  for(const text of ['{','{}',JSON.stringify({format:'fantasy-memorial-backup',version:1,memorials:[{}],history:[]})])assert.throws(()=>importRecords(text,[],[]));
  const m=toMemorial(dead(2));m.character.traits=['unknown'];assert.throws(()=>importRecords(exportRecords([m],[]),[],[]));
  assert.throws(()=>importRecords('x'.repeat(5*1024*1024+1),[],[]),/5MB/);
});
test('search can combine name, race and occupation without changing resting places',()=>{
  const a=toMemorial(dead(1)),b=toMemorial(dead(2));a.character.name='라온';a.character.race='elf';a.career='guild';const records=[a,b],before=structuredClone(records);
  assert.deepEqual(searchMemorials(records,'라온 엘프 길드'),[a]);assert.deepEqual(searchMemorials(records,'없는 이름'),[]);assert.deepEqual(searchMemorials(records,' '),[]);assert.deepEqual(records,before);
});
