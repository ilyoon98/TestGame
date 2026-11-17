import test from 'node:test';
import assert from 'node:assert/strict';
import { Fantasy } from '../dist/world.js';
import { Dungeon } from '../dist/engine.js';
const adult=seed=>Fantasy.restore(new Dungeon(seed).s);
const next=g=>{let n=0;while(g.s.status==='running'&&n++<250)g.step();assert.equal(g.s.status,'choice');};
const working=seed=>{const g=adult(seed);g.start();next(g);g.choose('work');next(g);g.choose('inn');while(g.s.queue.length)g.step();return g;};

test('twenty years of work contain at most seven major choices and no yearly reviews',()=>{
  for(let seed=1;seed<=100;seed++){
    const g=working(seed),start=g.s.timeline.elapsedDays;g.townEvent=()=>false;let choices=0,previous=start,n=0;
    while(g.s.timeline.elapsedDays-start<20*360&&n++<150){
      if(g.s.status==='choice'){
        assert.equal(g.s.choice.kind,'life-event');choices++;
        assert.ok(g.s.timeline.elapsedDays-previous>=3*360);previous=g.s.timeline.elapsedDays;
        g.choose(g.autoChoice());
      }else g.step();
    }
    assert.ok(choices>=3&&choices<=7,`${seed}: ${choices}`);
  }
});
test('departing discovers a dungeon without opening a dungeon picker',()=>{
  const found=new Set();for(let seed=1;seed<=200;seed++){
    const g=adult(seed);g.start();next(g);g.choose('delve');
    assert.equal(g.world.mode,'dungeon');assert.equal(g.s.status,'running');assert.equal(g.s.choice,null);
    while(g.s.queue.length)g.step();assert.match(g.s.log.at(-1).text,/도착한 곳은/);assert.equal(g.s.log.at(-1).location,`${g.dungeon().name} · 입구`);found.add(g.dungeon().id);
  }assert.equal(found.size,3);
});
test('random arrival is reproducible from the saved state',()=>{
  const a=adult(55);a.start();next(a);const b=Fantasy.restore(structuredClone(a.s));
  a.choose('delve');b.choose('delve');assert.equal(a.dungeon().id,b.dungeon().id);assert.deepEqual(a.s.queue,b.s.queue);
});
test('ordinary stairs advance automatically without spending a user choice',()=>{
  const g=adult(12);g.start();g.s.queue=[];g.enterDungeon('crypt');g.s.queue=[];g.s.floor=1;g.s.room=g.roomCount();g.s.maxFloor=1;
  const choices=g.s.choicesMade,age=g.s.timeline.elapsedDays,logs=g.s.log.length;
  g.step();assert.equal(g.s.floor,2);assert.equal(g.s.room,0);assert.equal(g.s.status,'running');assert.equal(g.s.choice,null);assert.equal(g.s.choicesMade,choices);assert.equal(g.s.timeline.elapsedDays,age);assert.equal(g.s.log.length,logs+1);
});
