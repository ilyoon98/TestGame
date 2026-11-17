import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, RACES } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { PEOPLE, person, knownPeople, choicePerson, openRelationshipEvent } from '../dist/relationships.js';
import { openDungeonEvent } from '../dist/dungeon-events.js';
import { openCompanionEvent } from '../dist/companions.js';
import { bondState, openTownConnection } from '../dist/town-connections.js';
import { validNpcAppearance, NPC_OUTFITS } from '../dist/npc-appearance.js';
import { visitorAppearance } from '../dist/cemetery-visits.js';
import { toMemorial, mergeMemorials } from '../dist/memorial.js';
import { companionGraves } from '../dist/companion-graves.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
import { spriteMarkup } from '../dist/visuals.js';
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<60)g.step();};
function game(seed=14){const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.s.gold=100;g.enterDungeon('mine');g.s.queue=[];g.s.floor=g.s.maxFloor=1;return g;}
function contact(g){openDungeonEvent(g,'dwarf_lift');const shown=choicePerson(g);g.choose('repair');drain(g);return shown;}
function trusted(g){const shown=contact(g);Object.assign(person(g,'miners'),{score:3,meetings:2});return shown;}
function join(g){trusted(g);assert.equal(openCompanionEvent(g,'miners','invite'),true);g.choose('together');drain(g);return g;}
function die(g){g.s.flags.deathCause='노환으로 생을 마쳤습니다.';g.finish('death','마지막 기록');return g;}

test('all races occur among NPCs and every role has suitable stable equipment',()=>{
  const races=new Set();for(let seed=1;seed<=100;seed++){const g=game(seed);for(const group of Object.keys(PEOPLE)){const p=person(g,group);assert.ok(validNpcAppearance(p.appearance,group));assert.equal(p.appearance.job,NPC_OUTFITS[group]);races.add(p.appearance.race);assert.match(spriteMarkup(p.appearance.race,p.appearance.job),/pixel-character/);}}
  assert.deepEqual([...races].sort(),RACES.map(r=>r.id).sort());
});
test('reading or migrating appearances consumes no simulation randomness and changes no past logs',()=>{
  const g=game(),before=g.s.seed,logs=structuredClone(g.s.log);for(let i=0;i<20;i++)for(const group of Object.keys(PEOPLE))person(g,group);assert.equal(g.s.seed,before);assert.deepEqual(g.s.log,logs);
  const raw=structuredClone(g.s);for(const p of Object.values(raw.world.bonds.people))delete p.appearance;const h=Fantasy.restore(raw);assert.equal(h.s.seed,raw.seed);assert.deepEqual(h.s.log,logs);
});
test('the same named person has identical art in dungeon encounters, the contact book and farewell visits',()=>{
  const g=game(),met=trusted(g),appearance=met.appearance;assert.deepEqual(knownPeople(g)[0].appearance,appearance);assert.equal(openCompanionEvent(g,'miners','invite'),true);assert.deepEqual(choicePerson(g).appearance,appearance);g.choose('together');drain(g);die(g);
  const m=toMemorial(g.s);for(const v of m.remembrance.visits){assert.deepEqual(visitorAppearance(v,m.id),appearance);assert.equal(spriteMarkup(v.appearance.race,v.appearance.job),spriteMarkup(appearance.race,appearance.job));}
  assert.deepEqual(m.relationships[0].appearance,appearance);
});
test('the goblin rescued in the ordinary encounter remains a goblin caravan acquaintance',()=>{
  const g=game();g.setChoice('traveler');const met=choicePerson(g);assert.equal(met.appearance.race,'goblin');g.choose('help');drain(g);assert.deepEqual(person(g,'caravan').appearance,met.appearance);assert.ok(bondState(g).contacts.caravan.rescued);die(g);
  assert.deepEqual(visitorAppearance(toMemorial(g.s).remembrance.visits[0],g.s.id),met.appearance);
});
test('town work and relationship snapshots keep the dungeon appearance',()=>{
  const g=game(),met=trusted(g);g.world.mode='life';g.world.career='guild';assert.equal(openTownConnection(g,'guild_miners'),true);assert.deepEqual(choicePerson(g).appearance,met.appearance);g.choose('protocol');drain(g);g.world.totalDays+=40;assert.equal(openRelationshipEvent(g,'miners'),true);assert.deepEqual(g.s.choice.personSnapshot.appearance,met.appearance);
  const h=Fantasy.restore(structuredClone(g.s));assert.deepEqual(choicePerson(h).appearance,met.appearance);
});
test('legacy people and pending choices acquire deterministic appearances without changing names or choices',()=>{
  const g=game();trusted(g);g.world.mode='life';g.world.career='inn';openRelationshipEvent(g,'miners');const raw=structuredClone(g.s),expected=person(g,'miners').appearance,name=person(g,'miners').name,prompt=raw.choice.prompt;
  delete raw.world.bonds.people.miners.appearance;delete raw.choice.personSnapshot.appearance;const h=Fantasy.restore(raw);assert.equal(person(h,'miners').name,name);assert.equal(h.s.choice.prompt,prompt);assert.deepEqual(choicePerson(h).appearance,expected);assert.deepEqual(Fantasy.restore(structuredClone(h.s)).world.bonds.people,h.world.bonds.people);
});
test('a stored appearance stays authoritative after random draws and restoration of an older snapshot',()=>{
  const g=game();trusted(g);person(g,'miners').appearance={version:1,race:'elf',job:'porter'};g.world.mode='life';g.world.career='inn';openRelationshipEvent(g,'miners');delete g.s.choice.personSnapshot.appearance;const h=Fantasy.restore(structuredClone(g.s));for(let i=0;i<30;i++)h.random();assert.deepEqual(choicePerson(h).appearance,{version:1,race:'elf',job:'porter'});die(h);assert.deepEqual(toMemorial(h.s).remembrance.visits[0].appearance,person(h,'miners').appearance);
});
test('dead NPC graves retain their own appearance without borrowing the protagonists race',()=>{
  const g=join(game());const original=structuredClone(person(g,'miners').appearance);openCompanionEvent(g,'miners','danger');g.chance=()=>false;g.choose('rescue');drain(g);const [m]=companionGraves(g.s);assert.deepEqual(m.appearance,original);assert.equal(m.character.race,undefined);assert.equal(m.outcome.ageYears,undefined);assert.deepEqual(importRecords(exportRecords([m],[]),[],[]).memorials[0].appearance,original);
});
test('old compact biographies and visit copies gain the same appearance and keep every farewell word',()=>{
  const g=die(join(game())),m=toMemorial(g.s),old=structuredClone(m),words=old.remembrance.visits.map(v=>v.text);for(const p of old.relationships)delete p.appearance;for(const v of old.remembrance.visits)delete v.appearance;
  const migrated=mergeMemorials([old],[])[0];assert.deepEqual(migrated.relationships[0].appearance,m.relationships[0].appearance);for(const v of migrated.remembrance.visits)assert.deepEqual(v.appearance,migrated.relationships[0].appearance);assert.deepEqual(migrated.remembrance.visits.map(v=>v.text),words);assert.deepEqual(mergeMemorials([migrated],[]),[migrated]);
});
test('record backups preserve looks beyond full-log eviction and reject inconsistent visitor copies',()=>{
  const m=toMemorial(die(join(game())).s),imported=importRecords(exportRecords([m],[]),[],[]);assert.deepEqual(imported.memorials[0],m);assert.equal(imported.history.length,0);
  for(const change of [x=>x.relationships[0].appearance.race='dragon',x=>x.remembrance.visits[0].appearance.race='elf',x=>x.remembrance.visits[0].appearance.job='unknown']){const bad=structuredClone(m);change(bad);assert.throws(()=>importRecords(exportRecords([bad],[]),[],[]));}
});
test('malformed persistent and queued appearances are rejected before restored play',()=>{
  const g=game();trusted(g);for(const value of [{version:1,race:'dragon',job:'porter'},{version:2,race:'human',job:'porter'},{version:1,race:'human',job:'trader'}]){const raw=structuredClone(g.s);raw.world.bonds.people.miners.appearance=value;assert.throws(()=>Fantasy.restore(raw),/마을 인연/);}
  g.world.mode='life';g.world.career='inn';openRelationshipEvent(g,'miners');const raw=structuredClone(g.s);raw.choice.personSnapshot.appearance.race='dragon';assert.throws(()=>Fantasy.restore(raw),/인연의 재회/);
});
test('a flower messenger is a separate person and never changes an injured friends appearance',()=>{
  const g=join(game()),original=structuredClone(person(g,'miners').appearance);openCompanionEvent(g,'miners','danger');g.chance=()=>true;g.choose('rescue');drain(g);die(g);const v=toMemorial(g.s).remembrance.visits[0];assert.equal(v.action,'letter');assert.deepEqual(v.appearance,original);assert.deepEqual(visitorAppearance(v,g.s.id),{version:1,race:'human',job:'porter'});assert.deepEqual(person(g,'miners').appearance,original);
});
