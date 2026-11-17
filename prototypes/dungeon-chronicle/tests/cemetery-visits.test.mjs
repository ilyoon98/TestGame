import test from 'node:test';
import assert from 'node:assert/strict';
import { CemeteryVisitScene, VISIT_TIMING, visitorName, visitorOutfit, visitPhaseLabel, bouquetMarkup } from '../dist/cemetery-visits.js';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { bondState } from '../dist/town-connections.js';
import { person } from '../dist/relationships.js';
import { toMemorial } from '../dist/memorial.js';
import { exportRecords } from '../dist/record-backup.js';
const visit=(id='miners:first',action='flowers')=>({id,group:'miners',name:'코르문',role:'광부',action,flowers:action==='flowers'||action==='letter'});
const advanceTo=(s,phase)=>{let n=0;while(s.phase!==phase&&n++<3000)s.step(.05);assert.equal(s.phase,phase);return s.snapshot();};

test('a visitor walks in, places flowers, stays, turns and leaves in that order',()=>{
  const s=new CemeteryVisitScene([visit()],409,1500),start=s.snapshot();assert.equal(start.phase,'arriving');assert.ok(start.carrying);assert.equal(start.flowers.length,0);
  const afterStep=s.step(.05);assert.ok(afterStep.x>start.x);assert.equal(afterStep.facing,1);
  const arrived=advanceTo(s,'offering');assert.equal(arrived.x,s.targetX);assert.equal(arrived.flowers.length,0);assert.equal(arrived.bowing,true);
  for(let i=0;i<13;i++)s.step(.05);assert.equal(s.snapshot().flowers.length,1);assert.equal(s.snapshot().carrying,false);
  advanceTo(s,'remembering');assert.equal(s.snapshot().visible,true);advanceTo(s,'leaving');s.step(.05);assert.equal(s.snapshot().facing,-1);assert.ok(s.x<s.targetX);
  advanceTo(s,'complete');assert.equal(s.x,s.startX);assert.equal(s.snapshot().visible,false);assert.equal(s.snapshot().flowers.length,1);
});
test('the visitor really stays for the reading interval instead of immediately departing',()=>{
  const s=new CemeteryVisitScene([visit()],409,1500);advanceTo(s,'remembering');const x=s.x;
  for(let i=0;i<Math.floor((VISIT_TIMING.linger-.2)/.05);i++)s.step(.05);assert.equal(s.phase,'remembering');assert.equal(s.x,x);assert.equal(s.snapshot().walking,false);
  advanceTo(s,'leaving');
});
test('quiet and remembering visits bow and depart without inventing flowers',()=>{
  for(const action of ['quiet','memory']){const s=new CemeteryVisitScene([visit('miners:first',action)],409,1500);advanceTo(s,'offering');assert.match(visitPhaseLabel(s.snapshot()),/인사/);assert.equal(s.snapshot().carrying,false);advanceTo(s,'complete');assert.equal(s.snapshot().flowers.length,0);}
});
test('several visits play once in recorded order, with only one visible visitor at a time',()=>{
  const visits=[visit(),{...visit('miners:anniversary'),name:'브람'}],s=new CemeteryVisitScene(visits,409,1500),order=[];let last=null;
  for(let i=0;i<1200&&!s.snapshot().complete;i++){const frame=s.step(.05);if(frame.visible&&frame.visit.id!==last){last=frame.visit.id;order.push(last);}}
  assert.deepEqual(order,visits.map(v=>v.id));assert.equal(s.phase,'complete');assert.equal(s.snapshot().flowers.length,2);for(let i=0;i<100;i++)s.step(.05);assert.equal(s.snapshot().flowers.length,2);
});
test('a modal, offscreen map or hidden tab can pause without consuming scene time',()=>{
  const s=new CemeteryVisitScene([visit()],409,1500);s.step(.05);const before=s.snapshot(),elapsed=s.elapsed;for(let i=0;i<100;i++)s.step(60,{paused:true});assert.deepEqual(s.snapshot(),before);assert.equal(s.elapsed,elapsed);
  s.step(60);assert.ok(s.x-before.x<=VISIT_TIMING.speed*.05+.00001);assert.equal(s.phase,'arriving');
});
test('walking respects map edges and can approach from the opposite side near the entrance',()=>{
  for(const [center,width] of [[409,1500],[90,300],[1450,1500]]){const s=new CemeteryVisitScene([visit()],center,width);for(let i=0;i<500&&!s.snapshot().complete;i++){const f=s.step(.05);assert.ok(f.x>=40&&f.x<=width-40);}assert.equal(s.phase,'complete');}
});
test('replaying flowers cannot modify permanent visits, a life, its random stream or a backup',()=>{
  const g=Fantasy.restore(new Dungeon(11).s);g.start();bondState(g).contacts.miners={source:null,choice:null,status:'known'};Object.assign(person(g,'miners'),{score:4,meetings:3});g.finish('death','노환');const m=toMemorial(g.s),state=structuredClone(g.s),backup=JSON.parse(exportRecords([m],[])),s=new CemeteryVisitScene(m.remembrance.visits,409,1500);
  for(let replay=0;replay<3;replay++){advanceTo(s,'complete');assert.equal(s.snapshot().flowers.length,2);s.restart();assert.equal(s.snapshot().flowers.length,0);}
  assert.deepEqual(g.s,state);const after=JSON.parse(exportRecords([m],[]));assert.deepEqual(after.memorials,backup.memorials);assert.equal(m.remembrance.visits.length,2);
});
test('an injured friend sends a messenger without becoming healthy or walking to the stone',()=>{
  const v=visit('herbalist:first','letter');v.group='herbalist';v.name='미엘';v.role='약초꾼';v.condition='injured';const s=new CemeteryVisitScene([v],409,1500);assert.equal(visitorName(s.snapshot().visit),'미엘의 꽃을 전하는 이');assert.equal(visitorOutfit(v),'porter');advanceTo(s,'complete');assert.equal(v.condition,'injured');assert.equal(s.snapshot().flowers.length,1);
});
test('reduced motion keeps a quiet offering and rest without horizontal travel',()=>{
  const s=new CemeteryVisitScene([visit()],409,1500,{reducedMotion:true});assert.equal(s.phase,'offering');assert.equal(s.x,s.targetX);
  for(let i=0;i<200&&!s.snapshot().complete;i++){const f=s.step(.05);assert.equal(f.walking,false);assert.equal(f.x,s.targetX);}assert.equal(s.phase,'complete');assert.equal(s.snapshot().flowers.length,1);
});
test('an empty grave has no invented visitor and bouquet artwork is bounded SVG',()=>{
  const s=new CemeteryVisitScene([],409,1500);assert.equal(s.snapshot().complete,true);assert.equal(s.snapshot().visible,false);assert.equal(s.step(.05).visit,null);assert.deepEqual(s.snapshot().flowers,[]);assert.match(bouquetMarkup(),/viewBox="0 0 16 22"/);assert.doesNotMatch(bouquetMarkup(NaN),/undefined|NaN/);
});
