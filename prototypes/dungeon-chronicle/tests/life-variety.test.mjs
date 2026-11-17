import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, RACES } from '../dist/engine.js';
import { Fantasy, CAREERS, LIFE_EVENT_IDS } from '../dist/world.js';
import { LIFE_EVENTS } from '../dist/life-events.js';

function working(seed=11,career='guild'){
  const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.world.mode='life';g.world.career=career;g.world.nextLifeEvent=36;return g;
}
function drain(g){let n=0;while(g.s.status==='running'&&g.s.queue.length&&n++<20)g.step();}
const comparable=g=>{const s=structuredClone(g.s);if(s.outcome)delete s.outcome.at;return s;};

test('each career has seven mechanically distinct major events',()=>{
  assert.equal(LIFE_EVENT_IDS.length,28);
  for(const career of CAREERS){const g=working(11,career.id);g.s.gold=500;g.world.reputation=40;g.world.flags.warSeen=g.world.flags.illnessSeen=true;g.advanceTime(45*360);const keys=[];let key;while((key=g.drawLifeEvent())){keys.push(key);g.lifeChoice(key);}assert.equal(keys.length,7,career.id);assert.equal(new Set(keys).size,7);}
});
test('past events do not reappear after retiring, changing jobs or restoring',()=>{
  const g=working();g.lifeChoice('guild_map');g.choose('publish');drain(g);g.stopCareer();g.world.mode='life';g.world.career='guild';const b=Fantasy.restore(JSON.parse(JSON.stringify(g.s)));for(let i=0;i<20;i++)assert.notEqual(b.drawLifeEvent(),'guild_map');
});
test('age, money, reputation and earlier illnesses or war unlock relevant events',()=>{
  const g=working();assert.equal(g.drawLifeEvent()?.startsWith('guild_'),true);g.world.eventCounts={guild_rescue:1,guild_rookie:1,guild_map:1};assert.equal(g.drawLifeEvent(),null);
  g.world.flags.illnessSeen=true;assert.equal(g.drawLifeEvent(),'guild_quarantine');g.world.eventCounts.guild_quarantine=1;g.world.reputation=20;assert.equal(g.drawLifeEvent(),'guild_archive');
  const inn=working(11,'inn');inn.world.eventCounts={inn_credit:1,inn_patient:1,inn_luggage:1};assert.equal(inn.drawLifeEvent(),null);inn.s.gold=25;assert.equal(inn.drawLifeEvent(),'inn_expansion');inn.world.eventCounts.inn_expansion=1;inn.world.flags.warSeen=true;assert.equal(inn.drawLifeEvent(),'inn_refugees');
});
test('old saves infer spent events from their existing prompts rather than replay them',()=>{
  const g=working();g.lifeChoice('guild_map');const raw=structuredClone(g.s);delete raw.world.eventCounts;delete raw.world.routineOrder;delete raw.world.lastAgeCheck;delete raw.world.adultArc;const b=Fantasy.restore(raw);assert.equal(b.world.eventCounts.guild_map,1);assert.deepEqual(b.s.log,raw.log);assert.equal(b.s.choice.source,'guild_map');
});
test('a paid improvement changes future income and helpers reduce ongoing fatigue',()=>{
  const a=working(11,'inn');a.s.gold=100;a.lifeChoice('inn_expansion');a.choose('expand');drain(a);assert.equal(a.s.gold,75);assert.equal(a.world.flags.innExpanded,true);
  const b=Fantasy.restore(structuredClone(a.s));b.world.flags.innExpanded=false;for(const g of [a,b]){g.oldAge=()=>false;g.townEvent=()=>false;g.world.nextLifeEvent=9999;}a.step();b.step();assert.equal(a.s.gold-b.s.gold,3);
  const c=Fantasy.restore(structuredClone(a.s));c.world.flags.innHelper=true;c.oldAge=()=>false;c.townEvent=()=>false;const f=c.world.fatigue;c.step();assert.ok(c.world.fatigue-f<=5);
});
test('a successor decision can retire from a career without ending the life',()=>{
  const g=working(11,'smith');g.lifeChoice('smith_legacy');g.choose('handoff');drain(g);assert.equal(g.world.mode,'hub');assert.equal(g.s.status,'running');assert.equal(g.s.outcome,null);assert.equal(g.s.gold,40);
});
test('illness and war have their own continuation logs and can end a life outside a dungeon',()=>{
  for(const type of ['illness','war']){const g=working();g.character.traits=['sharp','brave'];g.world.adultArc={type,step:1,fatal:true};const age=g.ageLabel();g.step();g.step();drain(g);assert.equal(g.s.status,'ended');assert.equal(g.ageLabel(),age);assert.equal(g.s.outcome.ageYears,18);assert.match(g.s.outcome.cause,type==='war'?/전쟁/:/열병/);assert.equal(g.s.choicesMade,0);assert.match(g.s.outcome.location,/길드/);}
});
test('a quiet routine can be followed immediately by a lethal street incident',()=>{
  const g=working();g.character.traits=['sharp','brave'];g.chance=()=>true;g.townEvent();assert.equal(g.s.hp,0);assert.equal(g.s.choice,null);drain(g);assert.equal(g.s.outcome.type,'death');assert.equal(g.s.choicesMade,0);
});
test('old-age risk rolls only once per age even while exploring daily dungeon segments',()=>{
  const g=working();g.character.race='elf';g.s.timeline.elapsedDays=(80-18)*360;let rolls=0;g.chance=()=>{rolls++;return false;};for(let i=0;i<200;i++)g.oldAge();assert.equal(rolls,1);g.advanceTime(360);g.oldAge();assert.equal(rolls,2);
});
test('a formerly long-lived save uses the late aging band and retains finished history',()=>{
  const g=working();g.character.race='elf';g.s.timeline.elapsedDays=(204-18)*360;const b=Fantasy.restore(structuredClone(g.s));b.chance=risk=>{assert.equal(risk,.95);return true;};b.step();assert.equal(b.s.outcome.type,'death');assert.equal(b.s.outcome.ageYears,205);const ended=Fantasy.restore(JSON.parse(JSON.stringify(b.s)));assert.equal(ended.step(),false);assert.deepEqual(ended.s.outcome,b.s.outcome);
});
test('seeded automatic decisions stay stable on reread and across restoration without consuming event RNG',()=>{
  const choices=new Set();for(let seed=1;seed<=100;seed++){const a=working(seed);a.character.traits=['sharp','brave'];a.lifeChoice('guild_forgery');const b=Fantasy.restore(structuredClone(a.s)),rng=a.s.seed,id=a.autoChoice();assert.equal(b.autoChoice(),id);assert.equal(a.autoChoice(),id);assert.equal(a.s.seed,rng);choices.add(id);}assert.ok(choices.size>=2);
});
test('a seeded town cohort yields varied death ages within the intended lifespan range',()=>{
  const report={};for(const race of RACES){const ages=[];for(let seed=1;seed<=400;seed++){const g=working(seed);g.character.race=race.id;let n=0;while(g.s.status!=='ended'&&n++<400){if(g.s.status==='choice'){const opts=g.s.choice.options.filter(o=>!o.disabled&&!o.retireCareer);g.choose((opts.find(o=>o.bias==='safe')||opts[0]).id);}else g.step();}assert.equal(g.s.status,'ended');assert.ok(g.s.outcome.ageYears<=120,'sample cohort should rarely reach extreme old age');ages.push(g.s.outcome.ageYears);}ages.sort((a,b)=>a-b);report[race.id]={median:ages[200],min:ages[0],max:ages.at(-1),under60:ages.filter(a=>a<60).length};assert.ok(new Set(ages).size>20);assert.ok(ages[200]>=40&&ages[200]<=90);}console.log('Town lifetimes (400 per race):',report);
});
test('saved disease branches and event history reproduce later outcomes',()=>{
  const a=working();a.world.adultArc={type:'illness',step:1,fatal:false};a.world.flags.illnessSeen=true;const b=Fantasy.restore(JSON.parse(JSON.stringify(a.s)));for(let n=0;n<200&&a.s.status!=='ended';n++){if(a.s.status==='choice'){const id=a.autoChoice();assert.equal(b.autoChoice(),id);a.choose(id);b.choose(id);}else{a.step();b.step();}}assert.deepEqual(comparable(b),comparable(a));
});
