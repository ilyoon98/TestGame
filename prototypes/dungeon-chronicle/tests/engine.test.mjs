import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, RACES, JOBS, TRAITS } from '../dist/engine.js';

function exhaust(game){let steps=0;while(game.s.status!=='ended' && steps++<500){if(game.s.status==='ready')game.start();else if(game.s.status==='choice')game.choose(game.autoChoice());else game.step();}assert.equal(game.s.status,'ended');return game.s;}
function drain(game){let n=0;while(game.s.queue.length && game.s.status==='running' && n++<50)game.step();}
function choiceFixture(kind,seed=17){const g=new Dungeon(seed);g.start();g.s.queue=[];g.s.floor=3;g.s.maxFloor=3;g.s.hp=g.character.maxHp;g.s.potions=2;g.setChoice(kind);return g;}

test('all species, jobs, and ten traits occur across random generations',()=>{
  const races=new Set(),jobs=new Set(),traits=new Set();
  for(let i=1;i<=600;i++){const g=new Dungeon(i);races.add(g.character.race);jobs.add(g.character.job);g.character.traits.forEach(x=>traits.add(x));assert.equal(new Set(g.character.traits).size,2);assert.ok(g.character.maxHp>0);}
  assert.equal(races.size,RACES.length);assert.equal(jobs.size,JOBS.length);assert.equal(traits.size,TRAITS.length);
});
test('each tick produces one single-line log with a floor',()=>{
  const g=new Dungeon(120);g.start();
  for(let i=0;i<500 && g.s.status!=='ended';i++){
    const before=g.s.log.length;
    if(g.s.status==='choice')g.choose(g.autoChoice());else g.step();
    assert.equal(g.s.log.length,before+1);
    const log=g.s.log.at(-1);assert.equal(typeof log.floor,'number');assert.ok(log.floor>=0 && log.floor<=5);assert.ok(!/[\r\n]/.test(log.text));
  }
});
test('important choice blocks automatic exploration until a valid choice',()=>{
  const g=choiceFixture('chest');const state=JSON.stringify(g.s);assert.equal(g.step(),false);assert.equal(JSON.stringify(g.s),state);assert.equal(g.choose('invalid'),false);assert.equal(JSON.stringify(g.s),state);assert.equal(g.choose('skip'),true);assert.equal(g.s.status,'running');
});
test('helping the traveler consumes a potion and yields a later reward',()=>{
  const g=choiceFixture('traveler');g.choose('help');drain(g);assert.equal(g.s.potions,1);assert.equal(g.s.flags.helped,true);g.s.floor=4;g.s.maxFloor=4;g.s.room=0;g.step();assert.equal(g.s.potions,2);assert.equal(g.s.flags.secret,true);assert.equal(g.s.flags.repaid,true);
});
test('traveler help is unavailable without a potion',()=>{const g=choiceFixture('traveler');g.s.potions=0;g.setChoice('traveler');assert.equal(g.s.choice.options[0].disabled,true);assert.equal(g.choose('help'),false);});
test('return resolves once and recovers all gold',()=>{const g=choiceFixture('stairs');g.s.gold=77;g.choose('return');drain(g);assert.equal(g.s.outcome.type,'return');assert.equal(g.s.outcome.recoveredGold,77);assert.equal(g.choose('return'),false);const length=g.s.log.length;g.step();assert.equal(g.s.log.length,length);});
test('death clears queued victory and recovers only 25 percent',()=>{const g=new Dungeon(5);g.start();g.s.queue=[];g.s.hp=3;g.character.traits=['sharp','brave'];g.s.gold=81;g.enqueue('致命적인 함정에 다쳤습니다.','bad',{hp:-10});g.enqueue('도달해서는 안 되는 보상','good',{gold:100},{finish:'clear'});g.step();g.step();assert.equal(g.s.outcome.type,'death');assert.equal(g.s.outcome.recoveredGold,20);assert.equal(g.s.hp,0);assert.ok(!g.s.log.some(x=>x.text==='도달해서는 안 되는 보상'));});
test('blessing survives once without dropping later event results',()=>{const g=new Dungeon(5);g.start();g.s.queue=[];g.character.traits=['blessed','sharp'];g.s.hp=1;g.enqueue('치명상','bad',{hp:-4});g.enqueue('살아서 얻은 보물','good',{gold:10});drain(g);assert.equal(g.s.hp,1);assert.equal(g.s.flags.saved,true);assert.equal(g.s.gold,10);g.enqueue('두 번째 치명상','bad',{hp:-4});drain(g);assert.equal(g.s.outcome.type,'death');});
test('boss can be cleared with enough health',()=>{const g=choiceFixture('boss');g.s.floor=5;g.s.maxFloor=5;g.character.power=40;g.s.hp=g.character.maxHp;g.choose('fight');drain(g);assert.equal(g.s.outcome.type,'clear');assert.ok(g.s.inventory.includes('검은 왕의 왕관'));assert.equal(g.s.gold,100);});
test('low health uses a potion without advancing the room',()=>{const g=new Dungeon(11);g.start();g.s.queue=[];g.s.floor=2;g.s.maxFloor=2;g.s.hp=5;const room=g.s.room;g.step();assert.equal(g.s.hp,30);assert.equal(g.s.potions,1);assert.equal(g.s.room,room);});
test('state restoration resumes the identical random sequence',()=>{const a=new Dungeon(82);a.start();for(let i=0;i<4;i++)a.step();const b=Dungeon.restore(JSON.parse(JSON.stringify(a.s)));for(let i=0;i<10 && a.s.status!=='ended';i++){if(a.s.status==='choice'){const id=a.autoChoice();a.choose(id);b.choose(id);}else{a.step();b.step();}}assert.deepEqual(b.s.log,a.s.log);assert.equal(b.s.hp,a.s.hp);assert.equal(b.s.seed,a.s.seed);});
test('invalid stored sessions are rejected',()=>{for(const x of [null,{}, {version:3}, {version:1,status:'strange'}])assert.throws(()=>Dungeon.restore(x));});
test('all 500 simulated adventures terminate with valid resources and logs',()=>{
  const outcomes={death:0,return:0,clear:0};
  for(let seed=1;seed<=500;seed++){const s=exhaust(new Dungeon(seed));outcomes[s.outcome.type]++;assert.ok(s.hp>=0 && s.hp<=s.character.maxHp);assert.ok(s.potions>=0 && s.gold>=0);assert.ok(s.maxFloor>=1 && s.maxFloor<=5);assert.ok(s.log.length<350);assert.ok(s.log.every(x=>Number.isInteger(x.floor)&&!/[\r\n]/.test(x.text)));}
  assert.ok(outcomes.death>0);assert.ok(outcomes.return>0);assert.ok(outcomes.clear>0);console.log('Simulation outcomes:',outcomes);
});
