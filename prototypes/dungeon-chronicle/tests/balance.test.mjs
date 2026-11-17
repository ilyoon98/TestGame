import test from 'node:test';
import assert from 'node:assert/strict';
import { Fantasy } from '../dist/world.js';
import { Dungeon } from '../dist/engine.js';
import { trip, sample } from './balance-simulation.mjs';

function fixture(id='ruins'){
  const g=Fantasy.restore(new Dungeon(17).s);g.start();g.s.queue=[];g.enterDungeon(id);g.s.queue=[];
  g.s.floor=7;g.s.maxFloor=7;g.character.traits=['sharp','brave'];return g;
}
function drain(g){let n=0;while(g.s.queue.length&&g.s.status==='running'&&n++<30)g.step();}

test('fresh, prepared, reckless and cautious trips have distinct risks across all dungeons',()=>{
  const mine=sample('mine'),crypt=sample('crypt'),ruins=sample('ruins');
  assert.ok(mine.clear/2000>.4&&mine.clear/2000<.8);
  assert.ok(mine.death/2000>.05&&mine.death/2000<.3);
  assert.ok(crypt.death>mine.death&&ruins.death>crypt.death);
  assert.ok(ruins.clear/2000>.005&&ruins.clear/2000<.12,'a fresh character can clear, but rarely');
  const prepared=sample('ruins',{prepared:true});
  assert.ok(prepared.clear/2000>.2&&prepared.clear/2000<.65);
  assert.ok(prepared.death<ruins.death*.7,'preparation improves survival');
  const reckless=sample('crypt',{policy:'reckless'}),cautious=sample('crypt',{policy:'cautious'});
  assert.ok(reckless.death>crypt.death,'opening risky chests costs lives');
  assert.ok(cautious.death<crypt.death*.1&&cautious.return>1800,'early retreat protects a life');
  assert.ok(cautious.death>0&&ruins.disasterDeath>0,'automatic events can still kill');
  console.log('Balance (2000 trips per scenario):', {mine,crypt,ruins,prepared,reckless,cautious});
});
test('survival curves also hold on a separate seed cohort',()=>{
  const fresh=sample('ruins',{},500,10001),prepared=sample('ruins',{prepared:true},500,10001);
  assert.ok(fresh.clear>0&&fresh.clear<=60,'at most 12% of this separate cohort clear unprepared');assert.ok(prepared.clear>fresh.clear*3);assert.ok(prepared.death<fresh.death);
});
test('a sudden event can kill at full health without presenting any choice',()=>{
  const g=fixture();g.s.hp=g.character.maxHp=40;g.chance=()=>false;g.int=()=>42;
  const choices=g.s.choicesMade;g.disaster();assert.equal(g.s.hp,0);assert.equal(g.s.choice,null);drain(g);
  assert.equal(g.s.outcome.type,'death');assert.equal(g.s.choicesMade,choices);assert.match(g.s.outcome.cause,/천장/);assert.equal(g.s.outcome.ageYears,g.age().years);
});
test('blessing prevents one sudden death, then a later hazard can end the story',()=>{
  const g=fixture();g.character.traits=['blessed','sharp'];g.s.hp=g.character.maxHp=40;g.chance=()=>false;g.int=()=>42;
  g.disaster();drain(g);assert.equal(g.s.hp,1);assert.equal(g.s.flags.saved,true);assert.notEqual(g.s.status,'ended');
  g.disaster();drain(g);assert.equal(g.s.outcome.type,'death');
});
test('the same dangerous chest kills an opener but allows a passerby to continue',()=>{
  const open=fixture(),skip=Fantasy.restore(structuredClone(open.s));
  for(const g of [open,skip]){g.s.hp=10;g.chance=()=>true;g.setChoice('chest');}
  open.choose('open');skip.choose('skip');drain(open);drain(skip);
  assert.equal(open.s.outcome.type,'death');assert.equal(open.s.gold,0,'fatal explosion cancels pending treasure');assert.equal(skip.s.hp,10);assert.equal(skip.s.status,'running');
});
test('losing an ordinary battle grants neither kills nor loot',()=>{
  const g=fixture('mine');g.s.floor=1;g.s.hp=g.character.maxHp=200;g.chance=()=>false;
  g.combat();drain(g);assert.equal(g.s.kills,0);assert.equal(g.s.gold,0);assert.ok(g.s.hp<200);assert.match(g.s.log.at(-1).text,/도망/);
});
test('a fatal ordinary battle clears its pending kill and loot',()=>{
  const g=fixture();g.s.hp=1;g.chance=()=>true;g.combat();drain(g);
  assert.equal(g.s.outcome.type,'death');assert.equal(g.s.kills,0);assert.equal(g.s.gold,0);
});
test('bosses scale by dungeon and failing a healthy battle never grants the boss reward',()=>{
  const mine=fixture('mine'),ruins=fixture();assert.ok(ruins.bossStrength()>mine.bossStrength());
  ruins.character.maxHp=300;ruins.s.hp=300;ruins.chance=()=>false;ruins.setChoice('boss');ruins.choose('fight');drain(ruins);
  assert.equal(ruins.world.lastTrip.type,'return');assert.equal(ruins.s.gold,0);assert.ok(!ruins.s.inventory.includes(ruins.bossLoot()));assert.ok(!ruins.world.cleared.includes('ruins'));
});
test('saved potions are consumed between boss attacks, with one log per tick',()=>{
  const g=fixture();g.s.hp=10;g.s.potions=1;g.enqueue('보스의 다음 공격','bad',{hp:-20},{bossAttack:true});
  const logs=g.s.log.length,age=g.ageLabel();g.step();assert.equal(g.s.hp,35);assert.equal(g.s.potions,0);assert.equal(g.s.log.length,logs+1);assert.equal(g.s.queue.length,1);assert.equal(g.ageLabel(),age);
  g.step();assert.equal(g.s.hp,15);assert.equal(g.s.log.length,logs+2);
});
test('duplicate equipment and repeated undead memories do not grant unlimited power',()=>{
  const g=fixture();g.s.inventory.push('은빛 반지');g.pick=()=> '은빛 반지';let rolls=[false,true];g.chance=()=>rolls.shift();
  const power=g.character.power;g.loot();assert.equal(g.character.power,power);
  g.character.race='undead';g.chance=()=>false;g.rare();assert.equal(g.character.power,power+2);g.rare();assert.equal(g.character.power,power+2);
});
test('a dangerous trip restores the same deaths and rewards from saved random state',()=>{
  const {game:a}=trip(431,'crypt');const b=Fantasy.restore(structuredClone(a.s));assert.deepEqual(b.s,a.s);
  const x=fixture(),y=Fantasy.restore(structuredClone(x.s));
  for(let n=0;n<120&&x.s.status!=='ended'&&x.world.mode==='dungeon';n++){if(x.s.status==='choice'){const id=x.s.choice.kind==='boss'?'fight':x.autoChoice();x.choose(id);y.choose(id);}else{x.step();y.step();}}
  const comparable=g=>{const s=structuredClone(g.s);if(s.outcome)delete s.outcome.at;return s;};
  assert.deepEqual(comparable(y),comparable(x));
});
