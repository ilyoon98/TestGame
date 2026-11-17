import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, RACES } from '../dist/engine.js';
import { Fantasy, AGING } from '../dist/world.js';

function atAge(race,age,seed=11){
  const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.character.race=race;g.s.timeline.elapsedDays=(age-18)*360;return g;
}

test('aging starts at each race threshold and rises exactly on ten-year boundaries',()=>{
  for(const {id:race} of RACES){const n=AGING[race].from;
    for(const [offset,expected] of [[-1,0],[0,.02],[9,.02],[10,.08],[19,.08],[20,.20],[29,.20],[30,.45],[39,.45],[40,.80],[49,.80],[50,.95],[140,.95]]){
      const g=atAge(race,n+offset),rolls=[];g.chance=risk=>{rolls.push(risk);return false;};
      assert.equal(g.oldAge(),false);assert.deepEqual(rolls,expected?[expected]:[],`${race} age ${n+offset}`);
    }
  }
});

test('a failed roll survives even extreme age and cannot reroll before a birthday or after reload',()=>{
  const g=atAge('elf',204);let rolls=0;g.chance=()=>{rolls++;return false;};
  for(let day=0;day<360;day++){g.oldAge();g.advanceTime(1);}
  assert.equal(rolls,1);assert.equal(g.s.outcome,null);
  const b=Fantasy.restore(JSON.parse(JSON.stringify(g.s)));let nextRolls=0;b.chance=risk=>{assert.equal(risk,.95);nextRolls++;return false;};
  b.oldAge();assert.equal(nextRolls,1);const c=Fantasy.restore(JSON.parse(JSON.stringify(b.s)));c.chance=()=>{throw new Error('same age rolled twice');};c.oldAge();
});

test('seeded aging survival and death reproduce across saved state',()=>{
  const outcomes=new Set();
  for(let seed=1;seed<=200;seed++){
    const a=atAge('human',80,seed),b=Fantasy.restore(JSON.parse(JSON.stringify(a.s)));
    const survived=!a.oldAge();assert.equal(!b.oldAge(),survived);outcomes.add(survived);
    assert.equal(b.s.seed,a.s.seed);assert.equal(b.world.lastAgeCheck,80);assert.equal(b.s.outcome?.type,a.s.outcome?.type);
  }
  assert.equal(outcomes.size,2);
});
