import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { DUNGEON_EVENTS as EVENTS, storyState, eventEligible, eventOptions, openDungeonEvent } from '../dist/dungeon-events.js';
const game=()=>{const g=Fantasy.restore(new Dungeon(11).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.enterDungeon('mine');g.s.queue=[];g.s.floor=g.s.maxFloor=1;g.s.gold=100;g.s.hp=g.character.maxHp=200;return g;};
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<30)g.step();};
function miners(choice){const g=game();openDungeonEvent(g,'dwarf_lift');g.choose('repair');drain(g);g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'miners_return');g.choose(choice);drain(g);return g;}

test('the second decision forks the same friendship into two different third encounters',()=>{
  const a=miners('supplies'),b=miners('map');assert.equal(storyState(a).pending[0].id,'miners_request');assert.equal(storyState(b).pending[0].id,'unmapped_chamber');
  assert.equal(eventEligible(a,'miners_request'),false);a.enterDungeon('crypt');a.s.queue=[];assert.equal(eventEligible(a,'miners_request'),true);
  b.enterDungeon('crypt');b.s.queue=[];assert.equal(eventEligible(b,'unmapped_chamber'),false);b.enterDungeon('mine');b.s.queue=[];assert.equal(eventEligible(b,'unmapped_chamber'),true);
});
test('a third encounter remembers both actual prior choices and survives save restoration',()=>{
  const g=miners('map'),pending=storyState(g).pending[0];assert.deepEqual(pending.trail,[{source:'dwarf_lift',choice:'repair'},{source:'miners_return',choice:'map'}]);
  const h=Fantasy.restore(structuredClone(g.s));h.enterDungeon('mine');h.s.queue=[];openDungeonEvent(h,'unmapped_chamber');assert.equal(h.s.choice.stage,3);assert.match(h.s.choice.prompt,/새로 이어진 갱도의 지도를 받는다/);assert.deepEqual(h.s.choice.trail,pending.trail);
  const saved=Fantasy.restore(structuredClone(h.s));assert.equal(saved.autoChoice(),h.autoChoice());h.choose('seal');saved.choose('seal');drain(h);drain(saved);assert.deepEqual(h.s.log,saved.s.log);assert.deepEqual(storyState(h),storyState(saved));assert.equal(storyState(h).flags.mineSealed,true);assert.equal(storyState(h).pending.length,0);
});
test('all third encounter branches terminate, with no cycles or unlimited reward chain',()=>{
  function visit(id,path=[]){assert.ok(!path.includes(id),`cycle ${[...path,id]}`);const nextPath=[...path,id];assert.ok(nextPath.length<=3,`${nextPath}`);for(const o of EVENTS[id].options)for(const r of [o,o.success,o.failure].filter(Boolean))if(r.next)visit(r.next,nextPath);}
  for(const [id,e] of Object.entries(EVENTS))if(!e.followup)visit(id);
  assert.equal(Object.values(EVENTS).filter(e=>e.stage===3).length,8);
});
test('the result must be emitted before reserving a third encounter, including after saved leave',()=>{
  const g=game();storyState(g).pending.push({id:'hidden_vault',origin:'rogue_cipher',trip:0,dungeon:null});openDungeonEvent(g,'hidden_vault');g.choose('notes');assert.equal(storyState(g).pending.length,0);
  const h=Fantasy.restore(structuredClone(g.s));h.requestChange();h.choose('leave');drain(h);assert.equal(h.world.mode,'hub');assert.equal(storyState(h).pending[0].id,'archive_test');assert.equal(storyState(h).pending[0].trail[0].choice,'notes');
});
test('third encounter exclusive options depend on the character race, job and trait',()=>{
  const g=game();assert.ok(eventOptions(g,'unmapped_chamber').some(o=>o.id==='shore'));g.character.race='elf';assert.ok(!eventOptions(g,'unmapped_chamber').some(o=>o.id==='shore'));
  g.character.job='mage';assert.ok(eventOptions(g,'archive_test').some(o=>o.id==='spell'));assert.ok(eventOptions(g,'archive_test').some(o=>o.id==='notice'));
  g.character.job='warrior';g.character.traits=['brave','lucky'];assert.ok(!eventOptions(g,'archive_test').some(o=>['spell','notice'].includes(o.id)));
});
test('settlement and violence produce different consequences rather than checking a shared completion flag',()=>{
  for(const [choice,next] of [['pay','clean_deal'],['fight','marked_hunters'],['flee','marked_hunters']]){
    const g=game();storyState(g).pending.push({id:'debt_collector',origin:'sealed_cache',trip:0,dungeon:null});openDungeonEvent(g,'debt_collector');g.choose(choice);drain(g);assert.equal(storyState(g).flags.debtSettled,true);assert.equal(storyState(g).pending[0].id,next);
  }
});
test('an old pending or already chosen result is preserved without inventing a past decision',()=>{
  const g=game();const st=storyState(g);st.pending.push({id:'miners_return',origin:'dwarf_lift',trip:0,dungeon:'mine'});const h=Fantasy.restore(structuredClone(g.s));openDungeonEvent(h,'miners_return');assert.deepEqual(h.s.choice.trail,[]);h.choose('map');drain(h);assert.equal(storyState(h).pending[0].trail.length,1);
  const old=game();storyState(old).seen.push('miners_return');old.enqueue('이미 정해진 보급을 받았습니다.','good',{gold:8},{storyEffect:{flag:'minersAlly',next:null,origin:'miners_return',trip:1,dungeon:'mine'}});const copy=Fantasy.restore(structuredClone(old.s));drain(copy);assert.equal(storyState(copy).pending.length,0);
});
test('a third encounter does not repeat after taking its result or returning midway',()=>{
  const g=miners('supplies');g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'miners_request');g.choose('carry');drain(g);assert.equal(storyState(g).flags.minersRescued,true);assert.equal(storyState(g).pending.length,0);g.enterDungeon('mine');g.s.queue=[];assert.equal(openDungeonEvent(g,'miners_request'),false);
});
test('malformed provenance is rejected in pending records and queued results',()=>{
  const g=miners('map'),raw=structuredClone(g.s);raw.world.dungeonStories.pending[0].trail=[{source:'fake',choice:'fake'}];assert.throws(()=>Fantasy.restore(raw),/던전 사건/);
  const a=game();openDungeonEvent(a,'dwarf_lift');a.choose('repair');const queued=structuredClone(a.s);queued.queue[0].storyEffect.trail='bad';assert.throws(()=>Fantasy.restore(queued),/인연 기록/);
});
