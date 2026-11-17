import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../dist/engine.js';
import { Fantasy } from '../dist/world.js';
import { openDungeonEvent, storyState } from '../dist/dungeon-events.js';
import { TOWN_CONNECTIONS as EVENTS, TOWN_CONNECTION_IDS as IDS, bondState, eligibleConnections, drawTownConnection, openTownConnection, connectionOptions } from '../dist/town-connections.js';
import { toMemorial, memorialText } from '../dist/memorial.js';
import { memorialStory } from '../dist/cemetery-walker.js';
import { exportRecords, importRecords } from '../dist/record-backup.js';
const drain=g=>{let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<50)g.step();};
function game(seed=11){const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];g.character.race='dwarf';g.character.traits=['sharp','brave'];g.s.gold=100;return g;}
function contact(g,event,choice){g.enterDungeon('mine');g.s.queue=[];g.s.floor=g.s.maxFloor=1;openDungeonEvent(g,event);g.choose(choice);drain(g);}
function work(g,career='inn'){g.world.mode='life';g.world.career=career;g.world.careerHistory.push(career);g.world.day=0;g.world.nextLifeEvent=g.world.totalDays+36;g.s.status='running';g.s.choice=null;g.s.queue=[];g.oldAge=()=>false;g.townEvent=()=>false;return g;}
function prepared(career='inn'){const g=game();contact(g,'dwarf_lift','repair');return work(g,career);}

test('twenty-six reunions cover four careers and require a real contact',()=>{
  assert.equal(IDS.length,26);for(const [career,count] of [['inn',6],['guild',6],['trader',7],['smith',7]])assert.equal(IDS.filter(id=>EVENTS[id].career===career).length,count);
  const g=work(game());assert.deepEqual(eligibleConnections(g),[]);assert.equal(openTownConnection(g,'inn_miners'),false);
});

test('actual mid-dungeon retirement leads to a merchant contract or a crafting order',()=>{
  for(const career of ['trader','smith']){
    const g=game();contact(g,'dwarf_lift','repair');g.requestChange();g.choose('leave');drain(g);g.step();g.choose('work');drain(g);g.step();g.choose(career);drain(g);g.oldAge=()=>false;g.townEvent=()=>false;
    let n=0;while(g.s.status==='running'&&n++<10)g.step();assert.equal(g.s.choice.source,`${career}_miners`);assert.match(g.s.choice.prompt,/부품을 써서 톱니를 고친다/);g.choose(career==='trader'?'contract':'order');drain(g);assert.equal(g.world.flags[career==='trader'?'bondTraderOre':'bondSmithTools'],true);assert.match(bondState(g).memories.at(-1),career==='trader'?/거래처/:/제작 의뢰/);
  }
});

test('all four career contracts improve only their own recurring work',()=>{
  const flags=['bondTraderOre','bondTraderHerbs','bondTraderCaravan','bondTraderCatalog','bondTraderPacking','bondSmithTools','bondSmithHerbs','bondSmithCaravan','bondSmithPatterns'];
  for(const career of ['trader','smith','inn','guild']){
    const a=work(game(),career),b=Fantasy.restore(structuredClone(a.s));for(const f of flags)a.world.flags[f]=true;
    for(const g of [a,b]){g.oldAge=()=>false;g.townEvent=()=>false;g.world.nextLifeEvent=99999;}a.step();b.step();assert.equal(a.s.gold-b.s.gold,career==='trader'?6:career==='smith'?5:0);assert.equal(b.world.fatigue-a.world.fatigue,['trader','smith'].includes(career)?2:0);
  }
});

test('a shared mine map changes both later trade and crafting commissions',()=>{
  for(const career of ['trader','smith'])for(const choice of ['supplies','map']){
    const g=game();contact(g,'dwarf_lift','repair');contact(g,'miners_return',choice);work(g,career);openTownConnection(g,`${career}_miners`);assert.equal(/지도에 맞/.test(g.s.choice.options[0].label),choice==='map');const before=g.character.scout;g.choose(g.s.choice.options[0].id);drain(g);assert.equal(g.character.scout-before,choice==='map'?1:0);
  }
});

test('sharing bandages becomes rescue supplies or stretcher orders rather than route supplies',()=>{
  for(const career of ['trader','smith'])for(const choice of ['route','bandage']){
    const g=game();g.character.job='warrior';contact(g,'warrior_banner','signal');contact(g,'scout_reunion',choice);work(g,career);openTownConnection(g,`${career}_scouts`);assert.equal(/구호|들것/.test(g.s.choice.options[0].label),choice==='bandage');const before=g.world.reputation;g.choose(g.s.choice.options[0].id);drain(g);assert.equal(g.world.reputation-before,choice==='bandage'?6:3);
  }
});

test('learning herbs gives a concrete trade discount or better tool knowledge after retirement',()=>{
  for(const career of ['trader','smith'])for(const choice of ['heal','learn']){
    const g=game();contact(g,'wounded_herbalist','buy');contact(g,'herbalist_return',choice);work(g,career);openTownConnection(g,`${career}_herbalist`);const before=career==='trader'?g.s.potions:g.character.scout,cost=g.s.gold;g.choose(career==='trader'?'medicine':'study');drain(g);assert.equal((career==='trader'?g.s.potions:g.character.scout)-before,choice==='learn'?2:1);assert.equal(cost-g.s.gold,career==='trader'?6:0);assert.ok(!/potions|power/.test(g.s.log.at(-1).text));
  }
});

test('donating a family gift continues as new adventurer supplies or equipment',()=>{
  for(const career of ['trader','smith']){
    const g=game();g.character.race='human';contact(g,'human_register','record');contact(g,'family_reply','donate');work(g,career);openTownConnection(g,`${career}_families`);assert.match(g.s.choice.prompt,/신입/);g.choose(g.s.choice.options[0].id);drain(g);assert.match(bondState(g).memories.at(-1),/신입/);assert.doesNotMatch(g.s.log.at(-1).text,/기념패|물품의 이름표/);
  }
});

test('studied magic circuits become different appraisal and model-making work',()=>{
  for(const career of ['trader','smith']){
    const g=game();g.character.job='mage';contact(g,'mage_resonance','tune');contact(g,'circuit_awake','learn');work(g,career);openTownConnection(g,`${career}_records`);assert.match(g.s.choice.prompt,/연구했던 마력 회로/);const before=g.character.scout;g.choose(g.s.choice.options[0].id);drain(g);assert.equal(g.character.scout-before,2);assert.match(bondState(g).memories.at(-1),/회로/);
  }
});

test('a displayed branch and automatic choice stay fixed across updated contact data and restore',()=>{
  const g=game();contact(g,'dwarf_lift','repair');contact(g,'miners_return','map');work(g,'smith');openTownConnection(g,'smith_miners');const id=g.autoChoice();g.world.bonds.contacts.miners.choice='supplies';const h=Fantasy.restore(structuredClone(g.s));assert.equal(h.autoChoice(),id);assert.equal(h.s.choice.bondContact.choice,'map');const scout=h.character.scout;assert.equal(h.choose('order'),true);drain(h);assert.equal(h.character.scout,scout+1);assert.match(h.s.log.at(-1).text,/지도/);
});

test('resolved trade disputes become regular business while new settlements stop dungeon pursuit',()=>{
  for(const career of ['trader','smith']){
    const g=game();contact(g,'sealed_cache','steal');work(g,career);openTownConnection(g,`${career}_debt`);assert.ok(g.s.choice.options.some(o=>o.id==='settle'));g.choose('settle');drain(g);assert.equal(bondState(g).contacts.debt.status,'settled');assert.ok(!storyState(g).pending.some(p=>['debt_collector','marked_hunters'].includes(p.id)));
    const h=game();contact(h,'sealed_cache','steal');contact(h,'debt_collector','pay');work(h,career);openTownConnection(h,`${career}_debt`);assert.match(h.s.choice.prompt,/이미 해결/);assert.ok(!h.s.choice.options.some(o=>o.id==='settle'));const gold=h.s.gold;h.choose('welcome');drain(h);assert.equal(h.s.gold-gold,14);
  }
});

test('rescued goblins return as buyers or commissioners without inventing wall marks',()=>{
  for(const career of ['trader','smith']){
    const g=game();g.s.flags.helped=true;const raw=structuredClone(g.s);delete raw.world.bonds;const h=work(Fantasy.restore(raw),career);openTownConnection(h,`${career}_caravan`);assert.match(h.s.choice.prompt,/물약/);assert.doesNotMatch(h.s.choice.prompt,/안전 표식|벽/);h.choose(h.s.choice.options[0].id);drain(h);assert.doesNotMatch(h.s.log.at(-1).text,/벽에 남/);assert.match(bondState(h).memories.at(-1),/살린 고블린/);
  }
});

test('new careers keep ordinary event spacing even with every dungeon contact',()=>{
  for(const career of ['trader','smith']){
    const g=work(game(),career);for(const group of ['miners','scouts','herbalist','caravan','families','records','debt'])bondState(g).contacts[group]={source:null,choice:null,status:group==='debt'?'open':'known'};
    let previous=0,lastBond=false,count=0;while(g.world.totalDays<240){if(g.s.status==='choice'){assert.ok(g.world.totalDays-previous>=36);previous=g.world.totalDays;const isBond=g.s.choice.kind==='bond-event';assert.ok(!(lastBond&&isBond));lastBond=isBond;count++;g.choose(g.s.choice.options.find(o=>o.id==='pass'||o.id==='decline')?.id||g.autoChoice());}else g.step();}assert.ok(count<=7);
  }
});

test('trade costs, pending contracts and one-time rewards survive career changes and old saves',()=>{
  for(const career of ['trader','smith']){
    const g=prepared(career);openTownConnection(g,`${career}_miners`);const cost=g.s.gold;g.choose(career==='trader'?'contract':'order');assert.equal(g.s.gold,cost-12);const h=Fantasy.restore(structuredClone(g.s));h.requestChange();h.choose('leave');drain(h);assert.equal(h.world.mode,'hub');assert.equal(bondState(h).memories.length,1);work(h,career);assert.equal(openTownConnection(h,`${career}_miners`),false);
    work(h,career==='trader'?'smith':'trader');assert.ok(eligibleConnections(h).includes(`${h.world.career}_miners`));
    const old=structuredClone(h.s);delete old.world.bonds;const migrated=Fantasy.restore(old);assert.ok(eligibleConnections(migrated).includes(`${h.world.career}_miners`));
  }
});
test('an actual dungeon result creates the contact; merely seeing or skipping the event does not',()=>{
  const g=game();g.enterDungeon('mine');g.s.queue=[];g.s.floor=1;openDungeonEvent(g,'dwarf_lift');assert.ok(!bondState(g).contacts.miners);g.choose('repair');assert.ok(!bondState(g).contacts.miners);drain(g);assert.equal(bondState(g).contacts.miners.choice,'repair');
  const a=game();contact(a,'dwarf_lift','skip');assert.ok(!bondState(a).contacts.miners);
});
test('a fatal dungeon result grants neither the contact nor a later town reward',()=>{
  const g=game();g.character.job='warrior';g.enterDungeon('mine');g.s.queue=[];g.s.hp=1;openDungeonEvent(g,'warrior_banner');g.chance=()=>true;g.choose('lead');drain(g);assert.equal(g.s.outcome.type,'death');assert.equal(Object.keys(bondState(g).contacts).length,0);
});
test('retiring mid-dungeon and taking inn work carries the same past choice into a reunion',()=>{
  const g=game();contact(g,'dwarf_lift','repair');g.requestChange();g.choose('leave');drain(g);g.step();g.choose('work');drain(g);g.step();g.choose('inn');drain(g);g.oldAge=()=>false;g.townEvent=()=>false;
  let n=0;while(g.s.status==='running'&&n++<10)g.step();assert.equal(g.s.choice.kind,'bond-event');assert.equal(g.s.choice.source,'inn_miners');assert.match(g.s.choice.prompt,/끊어진 갱도 승강기/);assert.match(g.s.choice.prompt,/부품을 써서 톱니를 고친다/);
});
test('reunions replace existing major-event slots and alternate with ordinary life events',()=>{
  const g=prepared();g.world.bonds.contacts.scouts={source:'warrior_banner',choice:'signal',status:'known'};let previous=0,reunions=0,total=0;
  while(g.world.totalDays<20*12){if(g.s.status==='choice'){total++;assert.ok(g.world.totalDays-previous>=36);previous=g.world.totalDays;if(g.s.choice.kind==='bond-event')reunions++;g.choose(g.s.choice.options.find(o=>o.id==='pass'||o.id==='decline')?.id||g.autoChoice());}else g.step();}
  assert.equal(reunions,2);assert.ok(total<=7);assert.ok(total>reunions);
});
test('regular guest and mentor agreements change ongoing income and fatigue only in the matching career',()=>{
  const a=prepared();openTownConnection(a,'inn_miners');a.choose('rooms');assert.equal(a.s.gold,82);assert.equal(a.world.flags.bondInnMiners,undefined);drain(a);assert.equal(a.world.flags.bondInnMiners,true);
  const b=Fantasy.restore(structuredClone(a.s));b.world.flags.bondInnMiners=false;for(const g of [a,b]){g.oldAge=()=>false;g.townEvent=()=>false;g.world.nextLifeEvent=99999;}a.step();b.step();assert.equal(a.s.gold-b.s.gold,2);
  const c=prepared('guild');c.world.bonds.contacts.scouts={source:'warrior_banner',choice:'signal',status:'known'};openTownConnection(c,'guild_scouts');c.choose('mentor');drain(c);const d=Fantasy.restore(structuredClone(c.s));d.world.flags.bondGuildMentor=false;for(const g of [c,d]){g.oldAge=()=>false;g.townEvent=()=>false;g.world.nextLifeEvent=99999;}c.step();d.step();assert.equal(d.world.fatigue-c.world.fatigue,2);
});
test('town mediation cancels unresolved dungeon pursuit without deleting history or other promises',()=>{
  const g=game();contact(g,'sealed_cache','steal');contact(g,'dwarf_lift','repair');work(g,'guild');assert.ok(storyState(g).pending.some(p=>p.id==='debt_collector'));openTownConnection(g,'guild_debt');g.choose('settle');drain(g);
  assert.equal(bondState(g).contacts.debt.status,'settled');assert.ok(!storyState(g).pending.some(p=>['debt_collector','marked_hunters'].includes(p.id)));assert.ok(storyState(g).pending.some(p=>p.id==='miners_return'));assert.ok(storyState(g).seen.includes('sealed_cache'));
  work(g,'inn');openTownConnection(g,'inn_debt');assert.match(g.s.choice.prompt,/이미 해결/);assert.ok(g.s.choice.options.some(o=>o.id==='welcome'));assert.ok(!g.s.choice.options.some(o=>o.id==='mediate'));
});
test('settled and unresolved dungeon choices produce different town variants',()=>{
  for(const [choice,status] of [['pay','settled'],['fight','open'],['flee','open']]){
    const g=game();contact(g,'sealed_cache','steal');g.enterDungeon('mine');g.s.queue=[];openDungeonEvent(g,'debt_collector');g.choose(choice);drain(g);assert.equal(bondState(g).contacts.debt.status,status);work(g);openTownConnection(g,'inn_debt');assert.equal(g.s.choice.options.some(o=>o.id==='welcome'),status==='settled');
  }
});
test('reunions are not replayed by retirement, job switching, reloading or repeated display',()=>{
  const g=prepared();openTownConnection(g,'inn_miners');g.choose('pass');drain(g);work(g,'guild');assert.ok(eligibleConnections(g).includes('guild_miners'));work(g,'inn');const h=Fantasy.restore(structuredClone(g.s));assert.equal(openTownConnection(h,'inn_miners'),false);
});
test('costs are charged once and saved queued outcomes finish even if the player changes jobs',()=>{
  const g=prepared();openTownConnection(g,'inn_miners');g.choose('rooms');const gold=g.s.gold;assert.equal(g.choose('rooms'),false);const h=Fantasy.restore(structuredClone(g.s));h.requestChange();h.choose('leave');drain(h);assert.equal(h.world.mode,'hub');assert.equal(h.s.gold,gold);assert.equal(h.world.flags.bondInnMiners,true);assert.equal(bondState(h).memories.length,1);
});
test('insufficient gold disables paid options and every reunion has a free alternative',()=>{
  const g=prepared();g.s.gold=0;for(const id of IDS)assert.ok(connectionOptions(g,id).some(o=>!o.disabled));openTownConnection(g,'inn_miners');const before=structuredClone(g.s);assert.equal(g.choose('rooms'),false);assert.deepEqual(g.s,before);
});
test('seeded automatic reservations and a saved town reunion remain stable',()=>{
  const g=prepared();openTownConnection(g,'inn_miners');const h=Fantasy.restore(structuredClone(g.s)),rng=g.s.seed,id=g.autoChoice();assert.equal(h.autoChoice(),id);assert.equal(g.autoChoice(),id);assert.equal(g.s.seed,rng);g.choose(id);h.choose(id);drain(g);drain(h);assert.deepEqual(g.s.log,h.s.log);assert.deepEqual(bondState(g),bondState(h));
});
test('legacy promises and completion flags migrate, while seen-only encounters do not invent friends',()=>{
  const g=prepared(),raw=structuredClone(g.s);delete raw.world.bonds;const h=Fantasy.restore(raw);assert.ok(bondState(h).contacts.miners);assert.equal(bondState(h).contacts.miners.choice,'repair');
  const a=game(),old=structuredClone(a.s);delete old.world.bonds;old.world.dungeonStories.seen=['dwarf_lift'];assert.ok(!bondState(Fantasy.restore(old)).contacts.miners);
  old.world.dungeonStories.flags.minersAlly=true;assert.ok(bondState(Fantasy.restore(old)).contacts.miners);
});
test('the old rescued goblin can return in town without inventing a wall-mark choice',()=>{
  const g=game();g.s.flags.helped=true;const raw=structuredClone(g.s);delete raw.world.bonds;const h=Fantasy.restore(raw);work(h);openTownConnection(h,'inn_caravan');assert.match(h.s.choice.prompt,/物薬|물약/);assert.ok(!h.s.choice.prompt.includes('안전 표식'));assert.equal(bondState(h).contacts.caravan.source,null);
});
test('all reunion results and status variants run with one-line logs and restorable resources',()=>{
  for(const id of IDS)for(const status of ['known','open','settled']){
    const template=work(game(),EVENTS[id].career);bondState(template).contacts[EVENTS[id].group]={source:'dwarf_lift',choice:'repair',status};
    for(const option of connectionOptions(template,id)){
    const g=work(game(),EVENTS[id].career);bondState(g).contacts[EVENTS[id].group]={source:'dwarf_lift',choice:'repair',status};openTownConnection(g,id);const o=g.s.choice.options.find(o=>o.id===option.id)||g.s.choice.options[0];assert.equal(g.choose(o.id),true);drain(g);assert.ok(g.s.gold>=0);assert.ok(g.s.log.every(l=>!/[\r\n]/.test(l.text)));assert.deepEqual(bondState(Fantasy.restore(structuredClone(g.s))),bondState(g));
    }
  }
});
test('a clinic reduces illness fatality risk but does not replace aging checks',()=>{
  const a=prepared(),b=prepared();a.world.flags.bondClinic=true;const risks=[];
  for(const g of [a,b]){g.townEvent=Fantasy.prototype.townEvent;g.character.traits=['sharp','brave'];g.chance=p=>{if(p===.006)return false;if(p===.04)return true;risks.push(p);return false;};g.townEvent();}
  assert.equal(risks[0],risks[1]*.8);assert.equal(a.world.adultArc.type,'illness');
});
test('each contact group is earned from a concrete successful dungeon decision',()=>{
  for(const [source,choice,group,race,job] of [['dwarf_lift','repair','miners','dwarf','warrior'],['warrior_banner','signal','scouts','human','warrior'],['wounded_herbalist','aid','herbalist','human','mage'],['goblin_marks','answer','caravan','goblin','mage'],['human_register','record','families','human','mage'],['rogue_cipher','decode','records','human','rogue'],['sealed_cache','steal','debt','human','mage']]){
    const g=game();g.character.race=race;g.character.job=job;contact(g,source,choice);assert.equal(bondState(g).contacts[group].source,source);assert.equal(bondState(g).contacts[group].choice,choice);
  }
});
test('older ambiguous debts are not charged again and newer pending pursuit wins over an old settlement',()=>{
  const g=game(),raw=structuredClone(g.s);delete raw.world.bonds;raw.world.dungeonStories.flags.debtSettled=true;const h=Fantasy.restore(raw);work(h);openTownConnection(h,'inn_debt');assert.ok(!h.s.choice.options.some(o=>o.id==='mediate'));
  raw.world.dungeonStories.flags.honestTrade=true;raw.world.dungeonStories.pending.push({id:'debt_collector',trip:2,dungeon:null,origin:'sealed_cache',trail:[{source:'sealed_cache',choice:'steal'}]});const a=Fantasy.restore(raw);assert.equal(bondState(a).contacts.debt.status,'open');
});
test('a fatal queued injury prevents later town agreements and memories from being granted',()=>{
  const g=prepared();g.s.hp=1;openTownConnection(g,'inn_miners');g.enqueue('미리 입은 치명상','bad',{hp:-8});g.choose('rooms');drain(g);assert.equal(g.s.outcome.type,'death');assert.equal(g.world.flags.bondInnMiners,undefined);assert.equal(bondState(g).memories.length,0);
});
test('a town reunion remains in the compact memorial, biography and a restored records backup',()=>{
  const g=prepared();openTownConnection(g,'inn_miners');g.choose('rooms');drain(g);g.s.flags.deathCause='오랜 뒤 생을 마쳤습니다.';g.emit('마지막 기록','bad',{},{finish:'death'});const m=toMemorial(g.s);assert.equal(m.reunions.length,1);assert.match(memorialStory(m,null),/단골/);assert.match(memorialText(m),/다시 만난 인연/);
  const restored=importRecords(exportRecords([m],[g.s]),[],[]);assert.deepEqual(restored.memorials[0].reunions,m.reunions);
});
test('invalid contacts and queued town effects are rejected before playback',()=>{
  const g=prepared(),raw=structuredClone(g.s);raw.world.bonds.contacts.miners.source='fake';assert.throws(()=>Fantasy.restore(raw),/마을 인연/);
  openTownConnection(g,'inn_miners');g.choose('rooms');const queue=structuredClone(g.s);queue.queue[0].bondEffect.flags=['unknownFlag'];assert.throws(()=>Fantasy.restore(queue),/마을 재회 결과/);
});
