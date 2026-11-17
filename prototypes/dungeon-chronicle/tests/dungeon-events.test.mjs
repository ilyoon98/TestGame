import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, RACES, JOBS, TRAITS } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { DUNGEON_EVENTS as EVENTS, DUNGEON_EVENT_IDS as IDS, storyState, eventEligible, eventOptions, openDungeonEvent, planDungeonEvents } from '../dist/dungeon-events.js';
const game=(seed=11)=>{const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];g.enterDungeon('mine');g.s.queue=[];g.s.floor=g.s.maxFloor=1;g.s.gold=100;return g;};
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<40)g.step();};
const matches=(g,id)=>{const e=EVENTS[id];if(e.race)g.character.race=e.race;if(e.job)g.character.job=e.job;if(e.traits)g.character.traits=[e.traits[0],'sharp'];};

test('all races, jobs and ten traits have real gated content in a 39-story catalog',()=>{
  assert.equal(IDS.length,39);assert.equal(Object.values(EVENTS).reduce((n,e)=>n+e.options.length,0),124);
  for(const race of RACES)assert.ok(Object.values(EVENTS).some(e=>e.race===race.id));
  for(const job of JOBS)assert.ok(Object.values(EVENTS).some(e=>e.job===job.id));
  for(const trait of TRAITS)assert.ok(Object.values(EVENTS).some(e=>e.options.some(o=>o.requires===trait.id)));
  for(const e of Object.values(EVENTS)){assert.ok(e.options.length>=3);assert.equal(new Set(e.options.map(o=>o.id)).size,e.options.length);for(const o of e.options)for(const result of [o,o.success,o.failure].filter(Boolean)){if(result.next)assert.ok(EVENTS[result.next]?.followup);if(result.text)assert.ok(!/[\r\n]/.test(result.text));}}
});
test('race and job origins cannot be drawn or forced by unrelated characters',()=>{
  for(const id of IDS.filter(id=>!EVENTS[id].followup)){
    const g=game();matches(g,id);assert.equal(eventEligible(g,id),true,id);
    const e=EVENTS[id];if(e.race){g.character.race=RACES.find(r=>r.id!==e.race).id;assert.equal(openDungeonEvent(g,id),false);}
    if(e.job){g.character.job=JOBS.find(j=>j.id!==e.job).id;assert.equal(openDungeonEvent(g,id),false);}
  }
});
test('trait-specific options are visible only with the required trait and cannot be forged',()=>{
  const g=game();g.character.traits=['lost','brave'];openDungeonEvent(g,'trait_tracks');
  assert.ok(g.s.choice.options.some(o=>o.id==='wander'));assert.ok(!g.s.choice.options.some(o=>o.id==='read'));const before=structuredClone(g.s);assert.equal(g.choose('read'),false);assert.deepEqual(g.s,before);
  const h=game();h.character.traits=['sharp','brave'];openDungeonEvent(h,'trait_tracks');assert.ok(h.s.choice.options.some(o=>o.icon==='sharp'));assert.ok(!h.s.choice.options.some(o=>o.id==='wander'));
});
test('every offered event has an affordable fallback even without money or potions',()=>{
  for(const id of IDS){const g=game();matches(g,id);g.s.gold=0;g.s.potions=0;assert.ok(eventOptions(g,id).some(o=>!o.disabled),id);}
});
test('paid decisions charge once, survive leaving, and commit the follow-up after their result',()=>{
  const g=game();g.character.race='dwarf';openDungeonEvent(g,'dwarf_lift');g.s.gold=8;assert.equal(g.choose('repair'),true);assert.equal(g.s.gold,0);assert.equal(storyState(g).pending.length,0);assert.equal(g.choose('repair'),false);
  g.requestChange();g.choose('leave');drain(g);assert.equal(g.s.gold,0);assert.equal(g.world.mode,'hub');assert.equal(storyState(g).pending[0].id,'miners_return');
});
test('insufficient resources reject selection without advancing RNG or spending anything',()=>{
  const g=game();g.character.race='elf';g.s.potions=0;openDungeonEvent(g,'elf_roots');const before=structuredClone(g.s);assert.equal(g.choose('water'),false);assert.deepEqual(g.s,before);
});
test('passing by creates no promised reward and the same origin never replays',()=>{
  const g=game();g.character.job='porter';openDungeonEvent(g,'porter_cargo');g.choose('skip');drain(g);assert.equal(storyState(g).pending.length,0);assert.equal(openDungeonEvent(g,'porter_cargo'),false);g.enterDungeon('crypt');g.s.queue=[];assert.equal(openDungeonEvent(g,'porter_cargo'),false);
});
test('a promised encounter waits for a later trip to the correct dungeon, then happens only once',()=>{
  const g=game();g.character.race='dwarf';openDungeonEvent(g,'dwarf_lift');g.choose('repair');drain(g);assert.equal(eventEligible(g,'miners_return'),false);
  g.enterDungeon('crypt');g.s.queue=[];assert.equal(eventEligible(g,'miners_return'),false);g.enterDungeon('mine');g.s.queue=[];assert.equal(eventEligible(g,'miners_return'),true);assert.ok(g.world.tripLandmarks.some(p=>p.source==='miners_return'));
  openDungeonEvent(g,'miners_return');assert.match(g.s.choice.prompt,/끊어진 갱도 승강기/);assert.equal(g.s.choice.followup,true);g.choose('supplies');drain(g);assert.equal(storyState(g).flags.minersAlly,true);assert.equal(storyState(g).pending[0].id,'miners_request');assert.equal(openDungeonEvent(g,'miners_return'),false);
});
test('stealing leads to a distinct later threat instead of a kindness reward',()=>{
  const g=game();openDungeonEvent(g,'sealed_cache');g.choose('steal');drain(g);assert.equal(storyState(g).pending[0].id,'debt_collector');g.enterDungeon('ruins');g.s.queue=[];g.s.gold=0;openDungeonEvent(g,'debt_collector');assert.ok(g.s.choice.options.find(o=>o.id==='pay').disabled);g.choose('flee');drain(g);assert.equal(storyState(g).flags.debtSettled,true);assert.ok(g.s.hp<g.character.maxHp);
});
test('lethal results discard the promised follow-up and every later queued reward',()=>{
  const g=game();g.character.race='undead';g.character.traits=['sharp','brave'];g.s.hp=1;openDungeonEvent(g,'undead_name');g.choose('restore');g.enqueue('받지 못할 보상','good',{gold:999});drain(g);assert.equal(g.s.outcome.type,'death');assert.equal(storyState(g).pending.length,0);assert.ok(g.s.gold<999);assert.ok(!g.s.log.some(l=>l.text==='받지 못할 보상'));
});
test('helping creates useful boss knowledge for one expedition and resets on the next',()=>{
  const g=game();g.character.job='warrior';openDungeonEvent(g,'warrior_banner');g.choose('signal');drain(g);g.enterDungeon('crypt');g.s.queue=[];openDungeonEvent(g,'scout_reunion');g.choose('route');drain(g);assert.equal(g.s.flags.secret,true);g.enterDungeon('mine');assert.equal(g.s.flags.secret,false);
});
test('pending choice, random outcome, queued effect and later reunion restore deterministically',()=>{
  const a=game(55);a.character.race='goblin';openDungeonEvent(a,'goblin_marks');const b=Fantasy.restore(structuredClone(a.s));const seed=a.s.seed;assert.equal(a.autoChoice(),a.autoChoice());assert.equal(a.autoChoice(),b.autoChoice());assert.equal(a.s.seed,seed);
  a.choose('answer');b.choose('answer');const c=Fantasy.restore(structuredClone(a.s));drain(a);drain(b);drain(c);assert.deepEqual(a.s.log,b.s.log);assert.deepEqual(storyState(a),storyState(c));a.enterDungeon('ruins');b.enterDungeon('ruins');assert.deepEqual(a.world.tripLandmarks,b.world.tripLandmarks);
});
test('the plan uses one or two unique slots; origins are drawn only from eligible unseen content',()=>{
  const seen=new Set();for(let seed=1;seed<=1000;seed++){const g=game(seed),plan=g.world.tripLandmarks;assert.ok(plan.length>=1&&plan.length<=2);assert.equal(new Set(plan.map(p=>`${p.floor}:${p.room}`)).size,plan.length);for(const p of plan){assert.ok(p.floor>=1&&p.floor<=g.floorCount());assert.ok(p.room>=2&&p.room<=g.roomCount(p.floor));if(p.source){assert.equal(eventEligible(g,p.source),true);seen.add(p.source);}}}
  assert.ok(seen.size>=16,`drawn origins: ${seen.size}`);
});
test('legacy in-progress landmark positions survive migration without rerolling',()=>{
  const g=game(),raw=structuredClone(g.s);delete raw.world.dungeonStories;raw.world.tripLandmarks=[{kind:'chest',floor:1,room:3}];const h=Fantasy.restore(raw);assert.deepEqual(h.world.tripLandmarks,raw.world.tripLandmarks);assert.deepEqual(storyState(h),{version:1,seen:[],flags:{},pending:[]});
});
test('malformed story continuations cannot enter restored sessions',()=>{
  const g=game(),raw=structuredClone(g.s);raw.world.dungeonStories.pending.push({id:'fake',origin:'mage_resonance',trip:2,dungeon:null});assert.throws(()=>Fantasy.restore(raw),/던전 사건/);
});
test('automatic choices reflect low health and traits while retaining a seed-stable reservation',()=>{
  let safe=0,bold=0;for(let seed=1;seed<=300;seed++){
    const g=game(seed);g.character.traits=['coward','sharp'];openDungeonEvent(g,'bridge_rope');g.s.hp=1;const target=g.autoChoice();assert.equal(g.autoChoice(),target);if(target==='skip')safe++;
    const h=game(seed);h.character.traits=['brave','greedy'];openDungeonEvent(h,'bridge_rope');if(h.autoChoice()==='jump')bold++;
  }assert.ok(safe>230);assert.ok(bold>150);
});
test('every gated option and both random branches resolve with valid resources and one-line records',()=>{
  let paths=0;for(const id of IDS)for(const opt of EVENTS[id].options)for(const success of opt.p==null?[true]:[true,false]){
    const g=game(17);matches(g,id);if(opt.requires)g.character.traits=[opt.requires,'sharp'];if(opt.job)g.character.job=opt.job;if(opt.race)g.character.race=opt.race;
    g.s.hp=g.character.maxHp=200;g.s.gold=100;g.s.potions=3;
    if(EVENTS[id].followup)storyState(g).pending.push({id,origin:'sealed_cache',trip:0,dungeon:null});
    assert.equal(openDungeonEvent(g,id),true,id);g.chance=()=>success;assert.equal(g.choose(opt.id),true,`${id}/${opt.id}`);drain(g);paths++;
    assert.ok(g.s.hp>=0&&g.s.hp<=g.character.maxHp&&g.s.gold>=0&&g.s.potions>=0);assert.ok(g.s.log.every(l=>!/[\r\n]/.test(l.text)));assert.ok(!g.s.choice);
    const restored=Fantasy.restore(structuredClone(g.s));assert.deepEqual(storyState(restored),storyState(g));
  }assert.ok(paths>100);
});
test('complete multi-trip stories encounter every new origin and continuation without exceeding two landmark choices per trip',()=>{
  const observed=new Set();for(let seed=1;seed<=250;seed++){
    const g=game(seed);g.s.queue=[];g.character.maxHp=500;g.character.power=60;g.character.scout=25;g.s.hp=500;
    for(let trip=0;trip<8;trip++){
      if(trip)g.enterDungeon('mine');g.s.potions=4;g.s.gold=100;let steps=0,landmarks=0;
      while(g.world.mode==='dungeon'&&g.s.status!=='ended'&&steps++<350){
        if(g.s.status==='choice'){const ch=g.s.choice;if(ch.kind==='dungeon-event'){observed.add(ch.source);landmarks++;}else if(['chest','traveler'].includes(ch.kind))landmarks++;
          const id=ch.kind==='boss'?'fight':ch.kind==='dungeon-event'?ch.options.filter(o=>o.id!=='skip'&&!o.disabled)[(seed+trip)%ch.options.filter(o=>o.id!=='skip'&&!o.disabled).length].id:ch.options.find(o=>o.id==='skip')?.id||g.autoChoice();g.choose(id);
        }else g.step();
      }assert.ok(steps<350);assert.ok(landmarks<=2);if(g.s.status==='ended')break;drain(g);
    }
  }assert.equal(observed.size,IDS.length,`missing: ${IDS.filter(id=>!observed.has(id)).join(',')}`);
});
