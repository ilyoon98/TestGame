import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { openDungeonEvent, storyState } from '../dist/dungeon-events.js';
import { bondState, openTownConnection } from '../dist/town-connections.js';
import { PEOPLE, person, knownPeople, relationLabel, eligibleRelationshipGroups, relationshipScene, openRelationshipEvent } from '../dist/relationships.js';
import { toMemorial, memorialText } from '../dist/memorial.js';
import { memorialStory } from '../dist/cemetery-walker.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<50)g.step();};
function game(seed=11){const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.s.gold=100;return g;}
function contact(g,event='dwarf_lift',choice='repair'){g.enterDungeon('mine');g.s.queue=[];g.s.floor=g.s.maxFloor=1;assert.equal(openDungeonEvent(g,event),true);assert.equal(g.choose(choice),true);drain(g);}
function work(g,career='inn'){g.world.mode='life';g.world.career=career;g.world.day=0;g.world.nextLifeEvent=g.world.totalDays+36;g.s.status='running';g.s.choice=null;g.s.queue=[];g.oldAge=()=>false;g.townEvent=()=>false;return g;}
function ready(career='inn'){const g=game();contact(g);work(g,career);openTownConnection(g,`${career}_miners`);g.choose({inn:'rooms',guild:'protocol',trader:'contract',smith:'order'}[career]);drain(g);g.world.totalDays+=36;return g;}

test('names are seed-stable, unique across roles and never consume simulation randomness',()=>{
  const a=game(91),b=game(91),rng=a.s.seed,names=Object.keys(PEOPLE).map(k=>person(a,k).name);assert.equal(new Set(names).size,7);assert.deepEqual(names,Object.keys(PEOPLE).map(k=>person(b,k).name));assert.equal(a.s.seed,rng);
  const h=Fantasy.restore(structuredClone(a.s));assert.deepEqual(h.world.bonds.people,a.world.bonds.people);assert.ok(new Set(Array.from({length:30},(_,i)=>person(game(i),'miners').name)).size>1);
});
test('a first named encounter becomes an acquaintance only after a real surviving result',()=>{
  const g=game();g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'dwarf_lift');assert.match(g.s.choice.prompt,/첫 만남/);const name=g.s.choice.personName;assert.equal(knownPeople(g).length,0);g.choose('repair');assert.equal(knownPeople(g).length,0);drain(g);assert.equal(person(g,'miners').meetings,1);assert.equal(person(g,'miners').score,1);assert.ok(g.s.log.at(-1).text.includes(name));
  const h=game();contact(h,'dwarf_lift','skip');assert.equal(knownPeople(h).length,0);
});
test('reading a wall mark or studying a circuit does not invent an in-person meeting',()=>{
  const g=game();g.character.job='mage';g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'mage_resonance');assert.equal(g.s.choice.personName,undefined);g.choose('tune');drain(g);assert.equal(knownPeople(g).length,0);work(g,'smith');openTownConnection(g,'smith_records');assert.equal(g.s.choice.meetings,1);assert.match(g.s.choice.prompt,/첫 만남/);g.choose('model');drain(g);assert.equal(person(g,'records').meetings,1);assert.equal(person(g,'records').score,1);
});
test('a legacy dungeon promise gains a neutral named contact without fabricating past affection',()=>{
  const g=game();contact(g);const raw=structuredClone(g.s);delete raw.world.bonds;const h=Fantasy.restore(raw);assert.equal(person(h,'miners').meetings,1);assert.equal(person(h,'miners').score,0);assert.equal(knownPeople(h).length,1);assert.deepEqual(h.s.log,raw.log);
});
test('the same named person returns in dungeon and all four town careers',()=>{
  for(const career of ['inn','guild','trader','smith']){
    const g=game();contact(g);const name=person(g,'miners').name;contact(g,'miners_return','map');assert.equal(person(g,'miners').meetings,2);assert.match(g.s.log.at(-1).text,new RegExp(name));work(g,career);openTownConnection(g,`${career}_miners`);assert.ok(g.s.choice.personName.includes(name));assert.equal(g.s.choice.meetings,3);g.choose('pass');drain(g);assert.equal(person(g,'miners').name,name);assert.equal(person(g,'miners').meetings,3);
  }
});
test('repeated encounters without kindness do not automatically create friendship',()=>{
  const g=ready();person(g,'miners').score=0;assert.equal(openRelationshipEvent(g,'miners'),true);g.choose('fair');drain(g);assert.equal(person(g,'miners').score,0);g.world.totalDays+=36;openRelationshipEvent(g,'miners');g.choose('fair');drain(g);assert.equal(person(g,'miners').score,0);assert.equal(relationLabel(0),'아는 사이');assert.equal(person(g,'miners').meetings,4);
});
test('stripping the miners equipment leads to a named dispute, never a fictional thank-you contract',()=>{
  const g=game();contact(g,'dwarf_lift','salvage');assert.equal(person(g,'miners').score,-2);assert.equal(person(g,'miners').meetings,1);assert.equal(storyState(g).pending.length,0);work(g,'trader');assert.equal(openTownConnection(g,'trader_miners'),false);assert.equal(openRelationshipEvent(g,'miners'),true);assert.match(g.s.choice.prompt,/불만/);assert.match(g.s.choice.prompt,/남은 금속을 떼어낸다/);assert.ok(g.s.choice.options.some(o=>o.id==='mend'));g.choose('mend');drain(g);assert.equal(person(g,'miners').score,1);assert.equal(openTownConnection(g,'trader_miners'),false);
});
test('kindness and exploitation create different second chapters for the same person',()=>{
  const a=ready(),b=Fantasy.restore(structuredClone(a.s));for(const g of [a,b]){g.oldAge=()=>false;g.townEvent=()=>false;assert.equal(openRelationshipEvent(g,'miners'),true);}a.choose('help');b.choose('profit');drain(a);drain(b);assert.equal(relationLabel(person(a,'miners').score),'절친');assert.equal(relationLabel(person(b,'miners').score),'불화');
  for(const g of [a,b]){g.world.totalDays+=36;assert.equal(openRelationshipEvent(g,'miners'),true);}assert.match(a.s.choice.title,/답례/);assert.match(b.s.choice.title,/값을 묻다/);assert.ok(a.s.choice.options.some(o=>o.id==='share'));assert.ok(b.s.choice.options.some(o=>o.id==='mend'));assert.match(b.s.choice.prompt,/급한 사정을 이용해 값을 높인다/);assert.equal(a.s.choice.personName,b.s.choice.personName);
});
test('a later apology improves a damaged relationship without erasing the remembered argument',()=>{
  const g=ready();const name=person(g,'miners').name;openRelationshipEvent(g,'miners');g.choose('profit');drain(g);g.world.totalDays+=36;openRelationshipEvent(g,'miners');const gold=g.s.gold;g.choose('mend');drain(g);assert.equal(gold-g.s.gold,6);assert.equal(person(g,'miners').score,1);assert.equal(person(g,'miners').meetings,4);assert.equal(person(g,'miners').chapter,2);assert.ok(bondState(g).memories.some(t=>t.includes(name)&&t.includes('급한 사정')));assert.match(g.s.log.at(-1).text,/다시 이야기할 여지/);
});
test('seven contacts have three relationship tones and two chapters in every career',()=>{
  for(const career of ['inn','guild','trader','smith'])for(const group of Object.keys(PEOPLE))for(const score of [-3,0,3])for(const chapter of [0,1]){
    const template=work(game(),career);bondState(template).contacts[group]={source:null,choice:null,status:'known'};Object.assign(person(template,group),{meetings:2,score,chapter});
    const scene=relationshipScene(template,group);assert.equal(scene.tone,score<0?'conflict':score>0?'friend':'neutral');for(const option of scene.options){const g=Fantasy.restore(structuredClone(template.s));assert.equal(openRelationshipEvent(g,group),true);assert.equal(g.choose(option.id),true);drain(g);assert.equal(person(g,group).chapter,chapter+1);assert.equal(person(g,group).meetings,3);assert.ok(g.s.log.every(l=>!/[\r\n]/.test(l.text)));assert.equal(g.s.gold,100-option.cost+(option.delta.gold||0));assert.deepEqual(Fantasy.restore(structuredClone(g.s)).world.bonds,g.world.bonds);}
  }
});
test('relationship choices always retain a free option when money is insufficient',()=>{
  for(const score of [-3,0,3]){const g=ready('smith');g.s.gold=0;person(g,'miners').score=score;openRelationshipEvent(g,'miners');const paid=g.s.choice.options.find(o=>o.disabled);assert.ok(paid);const before=structuredClone(g.s);assert.equal(g.choose(paid.id),false);assert.deepEqual(g.s,before);assert.ok(g.s.choice.options.some(o=>!o.disabled));}
});
test('reunions have a three-year cooldown, alternate with ordinary events and end after two chapters',()=>{
  const g=ready();g.world.totalDays-=36;assert.equal(openRelationshipEvent(g,'miners'),false);g.world.totalDays+=36;assert.equal(openRelationshipEvent(g,'miners'),true);g.choose('help');assert.equal(openRelationshipEvent(g,'miners'),false);drain(g);assert.equal(openRelationshipEvent(g,'miners'),false);g.world.totalDays+=36;openRelationshipEvent(g,'miners');g.choose('share');drain(g);g.world.totalDays+=120;assert.ok(!eligibleRelationshipGroups(g).includes('miners'));
  const h=ready();h.world.bonds.lastWasBond=false;h.world.nextLifeEvent=h.world.totalDays;h.step();assert.equal(h.s.choice.kind,'relation-event');h.choose('help');drain(h);let n=0;while(h.s.status==='running'&&n++<10)h.step();assert.equal(h.s.choice.kind,'life-event');
});
test('unresolved debt cannot masquerade as a friendly new request',()=>{
  const g=game();contact(g,'sealed_cache','steal');contact(g,'debt_collector','flee');work(g);g.world.totalDays=120;assert.equal(openRelationshipEvent(g,'debt'),false);openTownConnection(g,'inn_debt');g.choose('mediate');drain(g);g.world.totalDays+=36;assert.equal(openRelationshipEvent(g,'debt'),true);assert.ok(!storyState(g).pending.some(p=>p.id==='marked_hunters'));
});
test('queued relationship results, automatic reservations and departure restore without double application',()=>{
  const g=ready('trader');openRelationshipEvent(g,'miners');const auto=g.autoChoice(),rng=g.s.seed;assert.equal(g.autoChoice(),auto);assert.equal(g.s.seed,rng);const h=Fantasy.restore(structuredClone(g.s));assert.equal(h.autoChoice(),auto);const name=person(h,'miners').name;h.choose('help');const paid=h.s.gold;assert.equal(h.choose('help'),false);const saved=Fantasy.restore(structuredClone(h.s));saved.requestChange();saved.choose('leave');drain(saved);assert.equal(saved.s.gold,paid);assert.equal(saved.world.mode,'hub');assert.equal(person(saved,'miners').meetings,3);assert.equal(person(saved,'miners').name,name);assert.equal(person(saved,'miners').applied.filter(k=>k==='r:miners:1').length,1);
});
test('fatal queued injuries grant no meeting, affection, chapter or new memory',()=>{
  const g=ready();openRelationshipEvent(g,'miners');const before=structuredClone(person(g,'miners')),memories=[...bondState(g).memories];g.s.hp=1;g.enqueue('미리 입은 치명상','bad',{hp:-100});g.choose('help');drain(g);assert.equal(g.s.outcome.type,'death');assert.deepEqual(person(g,'miners'),before);assert.deepEqual(bondState(g).memories,memories);
});
test('friendship changes dungeon favors while conflict adds explicit costs with a free fallback',()=>{
  for(const score of [4,-2]){
    const g=ready();person(g,'miners').score=score;g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'miners_return');const option=g.s.choice.options.find(o=>o.id==='supplies');assert.match(option.hint,score>0?/신뢰의 보답/:/추가 금화 -6/);const gold=g.s.gold;g.choose('supplies');drain(g);assert.equal(g.s.gold-gold,score>0?12:2);
  }
  const g=ready();person(g,'miners').score=-2;g.enterDungeon('mine');g.s.queue=[];g.s.gold=0;openDungeonEvent(g,'miners_return');assert.equal(g.s.choice.options.find(o=>o.id==='supplies').disabled,true);assert.ok(g.s.choice.options.some(o=>!o.disabled));
});
test('a displayed dungeon favor keeps its quoted terms after relationship changes and reload',()=>{
  const g=ready();person(g,'miners').score=4;g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'miners_return');person(g,'miners').score=-4;const h=Fantasy.restore(structuredClone(g.s)),gold=h.s.gold;h.choose('supplies');drain(h);assert.equal(h.s.gold-gold,12);assert.match(h.s.log.at(-1).text,/신뢰가 작은 보답/);
});
test('old saved acquaintances gain stable names without invented scores, meetings or altered logs',()=>{
  const g=ready(),raw=structuredClone(g.s);delete raw.world.bonds.socialVersion;delete raw.world.bonds.people;delete raw.world.bonds.nameSeed;const log=structuredClone(raw.log),h=Fantasy.restore(raw);assert.equal(person(h,'miners').meetings,1);assert.equal(person(h,'miners').score,0);assert.equal(person(h,'miners').chapter,0);assert.deepEqual(h.s.log,log);const i=Fantasy.restore(structuredClone(h.s));assert.deepEqual(i.world.bonds,h.world.bonds);
  const old=structuredClone(g.s);openTownConnection(work(g,'guild'),'guild_miners');const ch=structuredClone(g.s);delete ch.choice.personName;delete ch.choice.relation;delete ch.choice.meetings;assert.equal(Fantasy.restore(ch).choose('protocol'),true);assert.equal(old.world.bonds.people.miners.name,person(g,'miners').name);
});
test('malformed relationship scores, identities, pending scenes and outcome effects are rejected',()=>{
  const g=ready();for(const [key,value] of [['score',100],['meetings',-1],['name','아무 이름'],['chapter',3]]){const raw=structuredClone(g.s);raw.world.bonds.people.miners[key]=value;assert.throws(()=>Fantasy.restore(raw),/마을 인연/);}
  openRelationshipEvent(g,'miners');const raw=structuredClone(g.s);raw.choice.personSnapshot.career='fake';assert.throws(()=>Fantasy.restore(raw),/인연의 재회 선택/);g.choose('help');const effect=structuredClone(g.s);effect.queue[0].bondEffect.social.change=99;assert.throws(()=>Fantasy.restore(effect),/마을 재회 결과/);
});
test('names and final relationships remain in compact graves, readable biographies and backups',()=>{
  const g=ready();openRelationshipEvent(g,'miners');g.choose('help');drain(g);g.s.flags.deathCause='오랜 뒤 조용히 생을 마쳤습니다.';g.emit('마지막 기록','bad',{},{finish:'death'});const m=toMemorial(g.s),name=person(g,'miners').name;assert.equal(m.relationships[0].meetings,3);assert.equal(m.relationships[0].name,name);assert.match(memorialText(m),new RegExp(`${name}.*절친`));assert.match(memorialStory(m,null),new RegExp(`${name}.*3번`));const restored=importRecords(exportRecords([m],[g.s]),[],[]);assert.deepEqual(restored.memorials[0].relationships,m.relationships);const bad=structuredClone(m);bad.relationships[0].score=9;assert.throws(()=>importRecords(exportRecords([bad],[]),[],[]),/백업 형식/);
});
