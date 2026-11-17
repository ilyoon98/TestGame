import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { openDungeonEvent, planDungeonEvents, eventEligible } from '../dist/dungeon-events.js';
import { bondState, openTownConnection } from '../dist/town-connections.js';
import { person, conditionLabel, eligibleRelationshipGroups, openRelationshipEvent } from '../dist/relationships.js';
import { eligibleCompanions, openCompanionEvent, openCompanionMemory, eligibleCompanionMemories, companionReminiscence } from '../dist/companions.js';
import { toMemorial, memorialText } from '../dist/memorial.js';
import { memorialStory } from '../dist/cemetery-walker.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<60)g.step();};
function friend(seed=11,group='miners'){
  const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.s.gold=100;g.enterDungeon('mine');g.s.queue=[];g.s.floor=1;g.s.room=2;
  bondState(g).contacts[group]={source:null,choice:null,status:'known'};Object.assign(person(g,group),{score:3,meetings:2});return g;
}
function join(seed=11,group='miners'){const g=friend(seed,group);assert.equal(openCompanionEvent(g,group,'invite'),true);g.choose('together');drain(g);return g;}
function incident(state='injured',group='miners'){
  const g=join(11,group);openCompanionEvent(g,group,'danger');g.chance=()=>state==='injured';g.choose('rescue');drain(g);return g;
}
function work(g,career='inn'){g.world.mode='life';g.world.career=career;g.world.day=0;g.world.totalDays+=36;g.advanceTime(1080);g.s.status='running';g.s.choice=null;g.s.queue=[];g.oldAge=()=>false;g.townEvent=()=>false;return g;}

test('only trusted healthy acquaintances can accompany, at most three expeditions each',()=>{
  const g=friend();assert.ok(eligibleCompanions(g).includes('miners'));person(g,'miners').score=1;assert.ok(!eligibleCompanions(g).includes('miners'));person(g,'miners').score=3;person(g,'miners').travelTrips=[1,2,3];assert.ok(!eligibleCompanions(g).includes('miners'));
  for(const status of ['injured','dead'])assert.ok(!eligibleCompanions(incident(status)).includes('miners'));
});
test('companion plans share one or two existing slots and preserve required dungeon continuations',()=>{
  let invites=0,trials=0;for(let seed=1;seed<=300;seed++){
    const g=friend(seed);const plan=planDungeonEvents(g);assert.ok(plan.length>=1&&plan.length<=2);assert.equal(new Set(plan.map(p=>`${p.floor}:${p.room}`)).size,plan.length);const invite=plan.find(p=>p.phase==='invite'),trial=plan.find(p=>p.phase==='danger');if(invite)invites++;if(trial){trials++;assert.ok(invite);assert.ok(trial.floor>invite.floor||trial.room>invite.room);assert.ok(trial.room-invite.room<=3);}for(const p of plan){assert.ok(p.room<=g.roomCount(p.floor));if(p.source)assert.equal(eventEligible(g,p.source),true);}
    const h=friend(seed);h.world.dungeonStories.pending=[{id:'miners_return',trip:1,dungeon:'mine',origin:'dwarf_lift',trail:[{source:'dwarf_lift',choice:'repair'}]}];const required=planDungeonEvents(h);assert.ok(required.some(p=>p.source==='miners_return'));assert.ok(required.length<=2);
  }assert.ok(invites>50);assert.ok(trials>15);
});
test('joining commits once, preserves names and can be declined without starting an adventure',()=>{
  const g=friend(),name=person(g,'miners').name;openCompanionEvent(g,'miners','invite');g.choose('together');assert.equal(g.world.companions?.active,undefined);assert.equal(openCompanionEvent(g,'miners','invite'),false);drain(g);assert.equal(g.world.companions.active.remaining,3);assert.deepEqual(person(g,'miners').travelTrips,[1]);assert.equal(person(g,'miners').name,name);assert.equal(openCompanionEvent(g,'miners','invite'),false);
  const h=friend();openCompanionEvent(h,'miners','invite');h.choose('alone');drain(h);assert.equal(h.world.companions.active,null);assert.equal(openCompanionEvent(h,'miners','invite'),false);
});
test('a short companion leaves after three actual room advances and restore retains the remaining distance',()=>{
  const g=join();g.world.tripLandmarks=[];g.chance=()=>false;g.oldAge=()=>false;for(const key of ['combat','loot','trap','rest','encounter','rare'])g[key]=()=>g.emit('함께 길을 살폈습니다.','note');
  const room=g.s.room;g.step();assert.equal(g.s.room,room+1);assert.equal(g.world.companions.active.remaining,2);assert.equal(Fantasy.restore(structuredClone(g.s)).world.companions.active.remaining,2);g.step();g.step();assert.equal(g.world.companions.active.remaining,0);g.step();assert.equal(g.world.companions.active,null);assert.match(g.s.log.at(-1).text,/짧은 동행을 마쳤습니다/);assert.equal(g.s.room,room+3);
});
test('the engine reaches a reserved rescue scene during the short walk before the companion departs',()=>{
  const g=join();g.world.tripLandmarks=[{kind:'companion-event',group:'miners',phase:'danger',floor:1,room:4}];g.oldAge=()=>false;g.chance=()=>false;for(const key of ['combat','loot','trap','rest','encounter','rare'])g[key]=()=>g.emit('함께 길을 살폈습니다.','note');g.step();assert.equal(g.world.companions.active.remaining,2);g.step();assert.equal(g.s.room,4);assert.equal(g.s.choice.kind,'companion-event');assert.equal(g.s.choice.phase,'danger');assert.equal(g.world.companions.active.remaining,1);g.chance=()=>true;g.choose('rescue');drain(g);assert.equal(person(g,'miners').fate.state,'injured');assert.equal(g.world.companions.active,null);
});
test('the player can rescue an injured friend and the injury remains after returning',()=>{
  const g=incident(),p=person(g,'miners');assert.equal(p.fate.state,'injured');assert.equal(p.meetings,3);assert.equal(conditionLabel(p),'요양 중');assert.equal(g.world.companions.active,null);assert.ok(p.fate.history.length);const fate=structuredClone(p.fate);g.requestChange();g.choose('leave');drain(g);assert.equal(g.world.mode,'hub');assert.deepEqual(person(g,'miners').fate,fate);assert.ok(!eligibleRelationshipGroups(g).includes('miners'));
});
test('failing a rescue can kill the friend, and all subsequent live appearances are blocked',()=>{
  const g=incident('dead');assert.equal(person(g,'miners').fate.state,'dead');assert.equal(g.world.companions.active,null);assert.equal(openCompanionEvent(g,'miners','invite'),false);work(g);assert.equal(openTownConnection(g,'inn_miners'),false);assert.equal(openRelationshipEvent(g,'miners'),false);
  g.world.mode='dungeon';g.world.dungeonStories.pending=[{id:'miners_return',trip:1,dungeon:'mine',origin:'dwarf_lift'}];assert.equal(eventEligible(g,'miners_return'),false);assert.equal(openDungeonEvent(g,'miners_return'),false);for(let n=0;n<30;n++)assert.ok(!planDungeonEvents(g).some(p=>p.group==='miners'||p.source==='miners_return'));
});
test('using a potion costs exactly one, improves rescue odds and remains fixed in a queued save',()=>{
  const g=join(),risks=[];g.chance=p=>{risks.push(p);return true;};openCompanionEvent(g,'miners','danger');const potions=g.s.potions;g.choose('potion');assert.equal(g.s.potions,potions-1);assert.ok(risks[0]>=.86);assert.equal(g.choose('potion'),false);const h=Fantasy.restore(structuredClone(g.s));drain(g);drain(h);assert.deepEqual(person(g,'miners').fate,person(h,'miners').fate);assert.deepEqual(g.s.log,h.s.log);
});
test('insufficient potions do not advance randomness or the choice, and retreat is always available',()=>{
  const g=join();g.s.potions=0;openCompanionEvent(g,'miners','danger');assert.equal(g.s.choice.options.find(o=>o.id==='potion').disabled,true);const raw=structuredClone(g.s);assert.equal(g.choose('potion'),false);assert.deepEqual(g.s,raw);g.chance=()=>false;const hp=g.s.hp;g.choose('retreat');drain(g);assert.equal(g.s.hp,hp);assert.equal(person(g,'miners').fate.state,'dead');
});
test('a companion can take a lethal blow, saving the player at the cost of injury or death',()=>{
  for(const dies of [false,true]){const g=join();g.s.hp=8;const sequence=[true,dies];g.chance=()=>sequence.shift()??false;g.emit('치명적인 기습입니다.','bad',{hp:-30});assert.ok(g.s.hp>0);assert.equal(person(g,'miners').fate.state,dies?'dead':'injured');assert.equal(person(g,'miners').fate.savedPlayer,true);assert.equal(g.world.companions.lastRescueTrip,g.world.trips);assert.match(g.s.log.at(-1).text,/목숨을 구해 줬습니다/);assert.equal(g.world.companions.active,null);g.emit('이어진 공격','bad',{hp:-99});drain(g);assert.equal(g.s.outcome.type,'death');}
});
test('companions do not guarantee protection and the same saved seed produces the same rescue',()=>{
  const g=join();g.s.hp=5;g.chance=()=>false;g.emit('막지 못한 기습','bad',{hp:-30});drain(g);assert.equal(g.s.outcome.type,'death');assert.equal(person(g,'miners').fate,undefined);
  const a=join(65),b=Fantasy.restore(structuredClone(a.s));a.s.hp=b.s.hp=5;a.emit('기습','bad',{hp:-30});b.emit('기습','bad',{hp:-30});drain(a);drain(b);assert.deepEqual(a.s.log,b.s.log);assert.deepEqual(a.world.bonds.people,b.world.bonds.people);
});
test('fatal player injuries and companion deaths can be recorded together without resurrecting either',()=>{
  const g=join();openCompanionEvent(g,'miners','danger');g.chance=()=>false;g.s.hp=1;g.choose('rescue');drain(g);assert.equal(g.s.outcome.type,'death');assert.equal(person(g,'miners').fate.state,'dead');assert.ok(toMemorial(g.s).relationships[0].fate);
});
test('a prior fatal queued event cancels an unobserved rescue and grants no invented injury memory',()=>{
  const g=join();openCompanionEvent(g,'miners','danger');const p=structuredClone(person(g,'miners'));g.enqueue('먼저 입은 치명상','bad',{hp:-999});g.chance=()=>false;g.choose('rescue');drain(g);assert.equal(g.s.outcome.type,'death');assert.deepEqual(person(g,'miners'),p);assert.ok(!g.s.log.some(l=>l.text.includes('이 원정에서 사망했습니다')));
});
test('safe withdrawal remains immediate even with a trapped companion or pending invitation',()=>{
  for(const pending of [false,true]){const g=pending?friend():join();if(pending){openCompanionEvent(g,'miners','invite');g.choose('together');}else openCompanionEvent(g,'miners','danger');g.requestChange();g.choose('leave');drain(g);assert.equal(g.world.mode,'hub');assert.equal(g.world.companions?.active,null);assert.equal(person(g,'miners').fate,undefined);assert.match(g.s.log.map(l=>l.text).join(' '),/함께 출구까지/);}
});
test('saved decisions, reserved automatic choices and canceling departure keep the same companion state',()=>{
  const g=join();openCompanionEvent(g,'miners','danger');const h=Fantasy.restore(structuredClone(g.s)),auto=g.autoChoice();assert.equal(h.autoChoice(),auto);assert.equal(g.autoChoice(),auto);const before=structuredClone(g.s);g.requestChange();g.choose('continue');assert.deepEqual(g.world.companions,before.world.companions);assert.equal(g.s.choice.kind,'companion-event');
});
test('all four careers offer distinct injury and bereavement follow-ups with persistent outcomes',()=>{
  for(const status of ['injured','dead'])for(const career of ['inn','guild','trader','smith']){
    const template=work(incident(status),career);assert.ok(eligibleCompanionMemories(template).includes('miners'));openCompanionMemory(template,'miners');assert.match(template.s.choice.prompt,status==='dead'?/마지막 동행/:/요양/);for(const option of template.s.choice.options){const g=Fantasy.restore(structuredClone(template.s));g.choose(option.id);drain(g);assert.equal(person(g,'miners').fate.memorySeen,true);assert.equal(openCompanionMemory(work(g,career),'miners'),false);assert.equal(person(g,'miners').fate.state,status==='dead'?'dead':option.id==='care'?'well':'retired');assert.ok(g.s.log.every(l=>!/[\r\n]/.test(l.text)));}
  }
});
test('rehabilitation permits future adventures while retirement and death remain excluded',()=>{
  const g=work(incident());openCompanionMemory(g,'miners');g.choose('care');drain(g);assert.equal(person(g,'miners').fate.state,'well');assert.ok(eligibleCompanions(g).includes('miners'));assert.ok(person(g,'miners').fate.history[0].state==='injured');
  const h=work(incident());openCompanionMemory(h,'miners');h.choose('work');drain(h);assert.equal(conditionLabel(person(h,'miners')),'모험 은퇴');assert.ok(!eligibleCompanions(h).includes('miners'));assert.equal(openTownConnection(h,'inn_miners'),false);
});
test('mourning consumes existing major-event slots and later remembrance replaces ordinary annual text',()=>{
  const g=work(incident('dead'));g.world.bonds.lastWasBond=false;g.world.nextLifeEvent=g.world.totalDays;g.step();assert.equal(g.s.choice.kind,'companion-memory');g.choose('tell');drain(g);const choices=g.s.choicesMade;g.advanceTime(1080);assert.equal(companionReminiscence(g),true);assert.equal(g.s.choicesMade,choices);assert.match(g.s.log.at(-1).text,/빈자리/);assert.equal(companionReminiscence(g),false);g.advanceTime(1080);assert.equal(companionReminiscence(g),true);g.advanceTime(1080);assert.equal(companionReminiscence(g),false);assert.equal(person(g,'miners').fate.echoes,2);
});
test('deceased rescued goblins never reappear through the older town visitor or fourth-floor gift',()=>{
  const g=incident('dead','caravan');g.s.flags.helped=true;work(g);g.world.nextLifeEvent=99999;g.step();assert.ok(!g.world.flags.friendVisited);g.world.mode='dungeon';g.s.floor=4;g.s.room=1;g.world.tripLandmarks=[];g.oldAge=()=>false;g.chance=()=>false;g.step();assert.equal(g.s.flags.repaid,true);assert.ok(!g.s.log.at(-1).text.includes('비밀 통로와 물약을 건넸습니다'));
});
test('injury and loss remain in compact graves, text and imported records even without full logs',()=>{
  const g=work(incident('dead'));openCompanionMemory(g,'miners');g.choose('tell');drain(g);g.s.flags.deathCause='그 후 생을 마쳤습니다.';g.emit('마지막 기록','bad',{},{finish:'death'});const m=toMemorial(g.s);assert.equal(m.relationships[0].fate.state,'dead');assert.match(memorialText(m),/사망/);assert.match(memorialStory(m,null),/동행의 그 후: 사망/);const r=importRecords(exportRecords([m],[g.s]),[],[]);assert.deepEqual(r.memorials[0].relationships,m.relationships);
});
test('old saves do not invent a companion, injury, death or new random state',()=>{
  const g=friend(),raw=structuredClone(g.s);delete raw.world.companions;const seed=raw.seed,h=Fantasy.restore(raw);assert.equal(h.world.companions,undefined);assert.equal(person(h,'miners').fate,undefined);assert.equal(h.s.seed,seed);assert.deepEqual(h.s.log,raw.log);
});
test('malformed active companions, queued fates and memory snapshots are rejected',()=>{
  const g=join(),raw=structuredClone(g.s);raw.world.companions.active.remaining=99;assert.throws(()=>Fantasy.restore(raw),/동행/);const wrong=structuredClone(g.s);wrong.world.companions.active.trip++;assert.throws(()=>Fantasy.restore(wrong),/동행/);openCompanionEvent(g,'miners','danger');g.chance=()=>true;g.choose('rescue');const bad=structuredClone(g.s);bad.queue[0].companionEffect.status='revived';assert.throws(()=>Fantasy.restore(bad),/동행/);
  const h=work(incident());openCompanionMemory(h,'miners');const memory=structuredClone(h.s);memory.choice.personSnapshot.fate.state='revived';assert.throws(()=>Fantasy.restore(memory),/동행/);
});
