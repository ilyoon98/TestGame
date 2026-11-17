import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy, CAREERS, DUNGEONS } from '../dist/world.js';
import { spriteMarkup, VISUAL_IDS } from '../dist/visuals.js';

function nextChoice(g){let n=0;while(g.s.status==='running'&&n++<250)g.step();assert.equal(g.s.status,'choice');}
function queued(g){let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<250)g.step();}
// Adult regression scenarios intentionally use a legacy adult save; birth is tested separately.
function initial(seed=11){const g=Fantasy.restore(new Dungeon(seed).s);g.start();nextChoice(g);return g;}
function work(id,seed=11){const g=initial(seed);g.choose('work');nextChoice(g);g.choose(id);queued(g);return g;}
function delve(id,seed=11){const g=initial(seed);g.enterDungeon(id);queued(g);return g;}

test('a fresh story can choose work without visiting any dungeon',()=>{
  const g=work('inn');assert.equal(g.world.trips,0);assert.equal(g.s.floor,0);assert.equal(g.world.mode,'life');assert.equal(g.displayJob().id,'inn');assert.ok(g.s.log.every(x=>x.location));
});
test('all four careers run and provide meaningful choices',()=>{
  for(const c of CAREERS){const g=work(c.id);nextChoice(g);assert.equal(g.s.choice.kind,'life-event');assert.ok(g.world.day>=36&&g.world.day<=60);assert.ok(g.s.choice.options.length>=2);assert.ok(g.s.gold>0);assert.ok(g.world.totalDays>=3);assert.ok(VISUAL_IDS.includes(c.id));assert.ok(spriteMarkup(g.character.race,c.id).includes('sprite-front'));}
});
test('the same career equipment is used at the same coordinates for all races',()=>{
  for(const c of CAREERS){const layers=['human','elf','dwarf','goblin','undead'].map(r=>spriteMarkup(r,c.id).split('<span class="sprite-front">')[1].split('</span>')[0]);assert.equal(new Set(layers).size,1);}
});
test('leaving a dungeon mid-floor preserves identity, equipment and wealth',()=>{
  const g=delve('mine');g.step();g.s.gold=41;const id=g.s.id,c=structuredClone(g.character),items=[...g.s.inventory];assert.equal(g.s.room,0);assert.equal(g.requestChange(),true);g.choose('leave');queued(g);nextChoice(g);assert.equal(g.world.mode,'hub');assert.equal(g.s.id,id);assert.deepEqual(g.character,c);assert.deepEqual(g.s.inventory,items);assert.equal(g.s.gold,41);assert.equal(g.s.choice.kind,'hub');
});
test('canceling departure restores the exact pending choice and queue',()=>{
  const g=delve('crypt');g.s.queue=[];g.s.floor=1;g.setChoice('chest');const pending=structuredClone(g.s.choice),queue=structuredClone(g.s.queue);g.requestChange();g.choose('continue');assert.deepEqual(g.s.choice,pending);assert.deepEqual(g.s.queue,queue);assert.equal(g.s.status,'choice');
});
test('retiring from a job permits another job and then another dungeon',()=>{
  const g=work('inn'),identity={name:g.character.name,race:g.character.race,job:g.character.job,traits:[...g.character.traits]};g.step();g.requestChange();g.choose('leave');queued(g);nextChoice(g);assert.equal(g.s.status,'choice');assert.equal(g.world.mode,'hub');g.choose('work');nextChoice(g);g.choose('smith');queued(g);assert.equal(g.displayJob().id,'smith');assert.deepEqual(g.world.careerHistory,['inn','smith']);g.requestChange();g.choose('leave');queued(g);nextChoice(g);g.enterDungeon('ruins');queued(g);assert.equal(g.world.mode,'dungeon');assert.equal(g.dungeon().id,'ruins');assert.deepEqual({name:g.character.name,race:g.character.race,job:g.character.job,traits:g.character.traits},identity);
});
test('all three dungeons can reach their distinct final floors and bosses',()=>{
  for(const d of DUNGEONS){const g=delve(d.id);g.character.maxHp=500;g.s.hp=500;g.character.power=100;let n=0;while(!g.world.cleared.includes(d.id)&&n++<350){if(g.s.status==='choice'){const ch=g.s.choice;g.choose(ch.kind==='stairs'?'descend':ch.kind==='boss'?'fight':ch.options.find(o=>o.id==='skip')?.id||g.autoChoice());}else g.step();}assert.ok(g.world.cleared.includes(d.id),d.id);assert.equal(g.world.bestFloor,g.floorCount());assert.equal(g.world.mode,'hub');assert.ok(g.s.inventory.includes(d.loot));}
});
test('a confirmed paid event resolves before a job change',()=>{
  const g=work('smith');g.s.gold=100;g.lifeChoice('smith_ore');const power=g.character.power;g.choose('weapon');assert.equal(g.s.gold,88);g.requestChange();g.choose('leave');queued(g);assert.equal(g.character.power,power+3);assert.equal(g.s.gold,88);assert.equal(g.world.mode,'hub');
});
test('a pending fatal encounter cannot be escaped by clearing its queue',()=>{
  const g=delve('mine');g.character.traits=['sharp','brave'];g.s.hp=1;g.enqueue('이미 맞은 치명상','bad',{hp:-5});g.requestChange();g.choose('leave');queued(g);assert.equal(g.s.status,'ended');assert.equal(g.s.outcome.type,'death');
});
test('saved life and dungeon departures resume deterministically',()=>{
  const a=work('trader');a.step();a.requestChange();const b=Fantasy.restore(JSON.parse(JSON.stringify(a.s)));a.choose('continue');b.choose('continue');for(let n=0;n<20&&a.s.status!=='ended';n++){if(a.s.status==='choice'){const id=a.autoChoice();a.choose(id);b.choose(id);}else{a.step();b.step();}}assert.deepEqual(a.s.log,b.s.log);assert.deepEqual(a.world,b.world);assert.equal(a.s.seed,b.s.seed);
});
test('legacy dungeon saves and completed returns can continue into town',()=>{
  const old=new Dungeon(4);old.start();old.s.queue=[];old.s.floor=1;old.s.maxFloor=1;old.s.gold=20;old.setChoice('stairs');old.choose('return');queued(old);const g=Fantasy.restore(JSON.parse(JSON.stringify(old.s)));assert.equal(g.resumeStory(),true);queued(g);nextChoice(g);assert.equal(g.world.mode,'hub');assert.equal(g.s.gold,20);assert.equal(g.s.id,old.s.id);
});
test('expensive decisions reject spending without changing state',()=>{
  const g=work('trader');g.s.gold=0;g.lifeChoice('trader_curse');const s=JSON.stringify(g.s);assert.equal(g.choose('buy'),false);assert.equal(JSON.stringify(g.s),s);assert.equal(g.choose('decline'),true);
});
test('deferred favors and dungeon friendships reach later work',()=>{
  const g=work('inn');g.s.flags.helped=true;g.step();assert.equal(g.world.flags.friendVisited,true);assert.ok(g.s.log.at(-1).text.includes('고블린'));g.s.gold=30;g.lifeChoice('inn_credit');g.choose('credit');queued(g);g.requestChange();g.choose('leave');queued(g);nextChoice(g);g.choose('work');nextChoice(g);g.choose('guild');queued(g);g.world.totalDays+=2;g.step();assert.ok(g.s.log.at(-1).text.includes('외상값'));assert.equal(g.world.due.length,0);
});
test('1000 complete auto stories terminate with valid resources and single-line logs',()=>{
  const outcomes={};for(let seed=1;seed<=1000;seed++){const g=new Fantasy(seed);g.start();let steps=0;while(g.s.status!=='ended'&&steps++<800){const n=g.s.log.length;if(g.s.status==='choice')g.choose(g.autoChoice());else g.step();assert.equal(g.s.log.length,n+1);}assert.equal(g.s.status,'ended',`seed ${seed}`);assert.ok(g.s.gold>=0&&g.s.potions>=0);assert.ok(g.world.reputation>=0&&g.world.reputation<=100);assert.ok(g.world.fatigue>=0&&g.world.fatigue<=100);assert.ok(g.s.log.every(x=>x.location&&!/[\r\n]/.test(x.text)));outcomes[g.s.outcome.type]=(outcomes[g.s.outcome.type]||0)+1;}console.log('World simulation outcomes:',outcomes);
});
