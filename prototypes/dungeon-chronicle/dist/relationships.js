// Identity uses its own saved seed: reading a name never rerolls the simulation.
import { npcAppearance, optionalNpcAppearance } from './npc-appearance.js';
export const PEOPLE={
  miners:{role:'광부',names:['브람','토르빈','두렌','바르딘','코르문','그룬'],request:'갱도에서 쓰던 도구와 보급 약속을 다시 맞춰 달라고 합니다.'},
  scouts:{role:'정찰병',names:['세린','리오나','에단','라비','키안','테린'],request:'새로 들어온 정찰병들이 무사히 돌아오도록 준비를 도와 달라고 합니다.'},
  herbalist:{role:'약초꾼',names:['미엘','에린','루엘','하니아','오르벨','사피'],request:'던전에서 다친 사람들에게 보낼 약품과 도구를 함께 마련하자고 합니다.'},
  caravan:{role:'상단원',names:['니크','고르비','픽스','로크','지그','쿠루'],request:'던전 보급길의 다음 짐을 준비하며 예전의 약속을 이어 가자고 합니다.'},
  families:{role:'유족 대표',names:['이네스','나린','오렐','실비','레나드','메이린'],request:'돌아오지 못한 사람들을 기억하며 신입 모험가를 돕는 자리를 부탁합니다.'},
  records:{role:'조사원',names:['아델','루시안','베른','노엘','에스텔','칼렌'],request:'던전에서 남긴 단서를 다음 원정에 쓸 기록으로 함께 정리하자고 합니다.'},
  debt:{role:'표식 중개인',names:['카르도','베스','제르','다미르','펠린','모르카'],request:'소유권이 확인된 물건으로 서로 믿을 수 있는 거래를 만들자고 합니다.'}
};
const hash=text=>{let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function initRelationships(g){
  const b=g.world.bonds;if(b.socialVersion===1){for(const [group,p] of Object.entries(b.people))if(p.appearance===undefined)p.appearance=npcAppearance(g.s.id,group,p);return b;}
  b.socialVersion=1;b.nameSeed=g.s.seed>>>0;b.people={};
  // Old records prove an acquaintance, but cannot prove affection or an argument.
  for(const group of Object.keys(b.contacts))person(g,group).meetings=1;
  return b;
}
export function person(g,group){
  if(!PEOPLE[group])return null;const b=initRelationships(g);
  const p=b.people[group]??={name:PEOPLE[group].names[hash(`${b.nameSeed}:${group}`)%PEOPLE[group].names.length],score:0,meetings:0,chapter:0,lastTownDay:-1,lastChoice:'',applied:[]};
  p.appearance??=npcAppearance(g.s.id,group,p);return p;
}
export function relationLabel(score){return score>=4?'절친':score>=2?'신뢰':score<=-4?'깊은 불화':score<=-2?'불화':'아는 사이';}
export function personAvailable(p){return !p?.fate||p.fate.state==='well';}
export function conditionLabel(p){return ({injured:'요양 중',retired:'모험 은퇴',dead:'사망'})[p?.fate?.state]||(p?.fate?'회복':'건강');}
export function personLabel(g,group){const p=person(g,group);return `${PEOPLE[group].role} ${p.name}`;}
const eventGroups={dwarf_lift:'miners',miners_return:'miners',miners_request:'miners',unmapped_chamber:'miners',warrior_banner:'scouts',trait_door:'scouts',scout_reunion:'scouts',countertrail:'scouts',rookie_escort:'scouts',wounded_herbalist:'herbalist',trait_rest:'herbalist',herbalist_return:'herbalist',goblin_marks:'caravan',goblin_caravan:'caravan',human_register:'families',priest_bell:'families',family_reply:'families',rogue_cipher:'records',mage_resonance:'records',hidden_vault:'records',archive_test:'records',circuit_awake:'records',relic_claimant:'records',debt_collector:'debt',clean_deal:'debt',marked_hunters:'debt'};
export function dungeonPersonGroup(source,choice){return source==='sealed_cache'?(choice==='steal'?'debt':choice==='return'?'families':null):eventGroups[source]||null;}
export function dungeonHasPerson(source){return ['dwarf_lift','warrior_banner','trait_door','wounded_herbalist','miners_return','miners_request','scout_reunion','rookie_escort','herbalist_return','goblin_caravan','family_reply','relic_claimant','debt_collector','clean_deal','marked_hunters'].includes(source);}
export function personIntro(g,group){const p=person(g,group);return `「${personLabel(g,group)}」 · ${p.meetings?`${p.meetings+1}번째 만남 · ${relationLabel(p.score)}`:'첫 만남'}. `;}
export function applyRelationship(g,effect){
  if(!effect||!g.world.bonds.contacts[effect.group])return false;
  const p=person(g,effect.group);if(p.applied.includes(effect.key)||p.fate?.state==='dead')return false;
  p.score=Math.max(-6,Math.min(6,p.score+effect.change));if(effect.countMeeting!==false)p.meetings++;p.lastChoice=effect.choice;p.applied.push(effect.key);
  if(effect.town)p.lastTownDay=g.world.totalDays;if(Number.isInteger(effect.chapter))p.chapter=Math.max(p.chapter,effect.chapter);
  const log=g.s.log.at(-1);if(log)log.text+=` · ${personLabel(g,effect.group)}: ${relationLabel(p.score)}${effect.change?` (인연 ${effect.change>0?'+':''}${effect.change})`:''}`;
  return true;
}
export function applyDungeonRelationship(g,effect){
  const step=effect.trail?.at(-1),source=step?.source||effect.origin,choice=step?.choice,group=dungeonPersonGroup(source,choice);
  if(source==='dwarf_lift'&&choice==='salvage')g.world.bonds.contacts.miners??={source,choice,status:'known',unfriendly:true};
  if(!group||!dungeonHasPerson(source)||!g.world.bonds.contacts[group])return;
  const hostile=['steal','salvage','bluff','fight','flee','hide'].includes(choice),settle=['pay','bargain','settle','return'].includes(choice),hurt=choice==='skip',failed=effect.flag==='rookiesWarned'||effect.flag==='archiveClosed';
  applyRelationship(g,{group,key:`d:${source}`,choice:effect.choiceLabel||choice||'기록된 만남',change:hostile?-2:settle?2:hurt?-1:failed?0:1});
}
export function dungeonRelationshipTerms(g,source,options,score){
  if(!['miners_return','scout_reunion','herbalist_return','goblin_caravan','family_reply','clean_deal'].includes(source))return options;
  const group=dungeonPersonGroup(source),p=g.world.bonds?.people?.[group];if(!g.world.bonds?.contacts[group]||!p)return options;
  const value=score??p.score;if(value>-2&&value<3)return options;
  return options.map((o,index)=>{
    if(index!==0)return o;
    if(value<=-2)return {...o,label:'비용과 조건을 확인하고 도움을 구한다',cost:(o.cost||0)+6,hint:`추가 금화 -6 · ${o.hint}`,text:`서로 비용과 조건부터 확인했습니다. ${o.text}`};
    const delta={...o.delta},bonus=delta.gold?'gold':delta.hp?'hp':'reputation',amount=bonus==='reputation'?2:4;delta[bonus]=(delta[bonus]||0)+amount;
    return {...o,delta,hint:`신뢰의 보답: ${bonus==='gold'?'금화':bonus==='hp'?'체력':'평판'} +${amount} 추가 · ${o.hint}`,text:`오래 쌓은 신뢰가 작은 보답으로 돌아왔습니다. ${o.text}`};
  });
}
export function knownPeople(g){const b=initRelationships(g);return Object.keys(b.contacts).filter(group=>PEOPLE[group]&&b.people[group]?.meetings>0).map(group=>({group,...b.people[group],role:PEOPLE[group].role,label:relationLabel(b.people[group].score)}));}
export function relationshipSummaries(state){const b=state.world?.bonds;return Object.keys(b?.contacts||{}).filter(group=>b.people?.[group]?.meetings>0&&PEOPLE[group]).map(group=>{const p=b.people[group];return {name:p.name,role:PEOPLE[group].role,appearance:npcAppearance(state.id,group,p),score:p.score,meetings:p.meetings,...(p.fate?{fate:structuredClone(p.fate)}:{}),...(p.travelTrips?{journeys:p.travelTrips.length}:{})};});}
export function choicePerson(g,ch=g.s.choice){
  if(!ch)return null;
  const group=ch.kind==='bond-event'?ch.bondGroup:['companion-event','companion-memory','relation-event'].includes(ch.kind)?ch.source:ch.kind==='dungeon-event'&&dungeonHasPerson(ch.source)?dungeonPersonGroup(ch.source):ch.kind==='traveler'?'caravan':null;
  if(!group||!PEOPLE[group])return null;const live=person(g,group),p=ch.personSnapshot?{...ch.personSnapshot,appearance:ch.personSnapshot.appearance||(ch.personSnapshot.name===live.name?live.appearance:undefined)}:live;
  if(ch.kind==='traveler'&&p.fate?.state==='dead')return {group:null,name:'이름 모를 고블린',role:'모험가',appearance:{version:1,race:'goblin',job:'porter'}};
  return {group,name:p.name,role:PEOPLE[group].role,appearance:npcAppearance(g.s.id,group,p)};
}
export function validFate(f){const incident=x=>x&&['injured','dead'].includes(x.state)&&Number.isInteger(x.ageYears)&&x.ageYears>=0&&Number.isInteger(x.elapsedDays)&&x.elapsedDays>=0&&typeof x.location==='string'&&x.location.length<200&&typeof x.cause==='string'&&x.cause.length<500;return f===undefined||f&&['well','injured','retired','dead'].includes(f.state)&&incident({...f,state:f.state==='dead'?'dead':'injured'})&&Number.isInteger(f.serial)&&f.serial>=1&&f.serial<=3&&Array.isArray(f.history)&&f.history.length<=3&&f.history.every(incident)&&typeof f.memorySeen==='boolean'&&Number.isInteger(f.echoes)&&f.echoes>=0&&f.echoes<=2&&Number.isInteger(f.lastEchoDay)&&f.lastEchoDay>=0&&typeof f.savedPlayer==='boolean';}
export function validRelationshipSummaries(list){return Array.isArray(list)&&list.length<=7&&list.every(p=>p&&typeof p.name==='string'&&p.name.length<50&&typeof p.role==='string'&&p.role.length<50&&optionalNpcAppearance(p.appearance,Object.keys(PEOPLE).find(k=>PEOPLE[k].role===p.role))&&Number.isInteger(p.score)&&p.score>=-6&&p.score<=6&&Number.isInteger(p.meetings)&&p.meetings>=1&&p.meetings<=100&&validFate(p.fate)&&(p.journeys===undefined||Number.isInteger(p.journeys)&&p.journeys>=0&&p.journeys<=3));}
export function validSocialEffect(e){return e&&!!PEOPLE[e.group]&&typeof e.key==='string'&&e.key.length<120&&typeof e.choice==='string'&&e.choice.length<200&&Number.isInteger(e.change)&&e.change>=-6&&e.change<=6&&(e.town===undefined||typeof e.town==='boolean')&&(e.chapter===undefined||Number.isInteger(e.chapter)&&e.chapter>=1&&e.chapter<=2);}
export function validRelationships(b){return b.socialVersion===undefined||b.socialVersion===1&&Number.isInteger(b.nameSeed)&&b.nameSeed>=0&&b.nameSeed<=0xffffffff&&b.people&&typeof b.people==='object'&&!Array.isArray(b.people)&&Object.entries(b.people).every(([group,p])=>PEOPLE[group]&&p&&PEOPLE[group].names.includes(p.name)&&optionalNpcAppearance(p.appearance,group)&&Number.isInteger(p.score)&&p.score>=-6&&p.score<=6&&Number.isInteger(p.meetings)&&p.meetings>=0&&p.meetings<=100&&Number.isInteger(p.chapter)&&p.chapter>=0&&p.chapter<=2&&Number.isFinite(p.lastTownDay)&&p.lastTownDay>=-1&&typeof p.lastChoice==='string'&&p.lastChoice.length<200&&Array.isArray(p.applied)&&p.applied.length<=100&&p.applied.every(k=>typeof k==='string'&&k.length<120)&&new Set(p.applied).size===p.applied.length&&validFate(p.fate)&&(p.travelTrips===undefined||Array.isArray(p.travelTrips)&&p.travelTrips.length<=3&&p.travelTrips.every(t=>Number.isInteger(t)&&t>=1)&&new Set(p.travelTrips).size===p.travelTrips.length));}

const venues={inn:{place:'여관',help:'머물 자리와 식사를 내준다',cost:6},guild:{place:'길드',help:'의뢰와 인력을 연결해 준다',cost:4},trader:{place:'상점',help:'필요한 물자를 먼저 마련해 준다',cost:8},smith:{place:'공방',help:'필요한 도구를 먼저 제작해 준다',cost:8}};
export function eligibleRelationshipGroups(g){const b=initRelationships(g);return knownPeople(g).filter(p=>personAvailable(p)&&(p.meetings>=2||p.score<=-2)&&p.chapter<2&&(p.lastTownDay<0||g.world.totalDays-p.lastTownDay>=36)&&!g.s.queue.some(e=>e.bondEffect?.social?.group===p.group)&&!(p.group==='debt'&&b.contacts.debt.status==='open')).map(p=>p.group);}
export function relationshipScene(g,group,snapshot){
  const p=snapshot||person(g,group),label=`${PEOPLE[group].role} ${p.name}`,v=venues[g.world.career],phase=p.chapter+1,tone=p.score>=2?'friend':p.score<=-2?'conflict':'neutral';
  const option=(id,label,hint,bias,text,delta,change,cost=0)=>({id,label,hint:`${hint} · 인연 ${change>0?'+':''}${change}`,bias,text,delta,change,cost});
  const together=label+((p.name.charCodeAt(p.name.length-1)-0xac00)%28?'과':'와');
  const context=(phase===2?'지난 재회 뒤 시간이 흘렀습니다. ':'')+(p.lastChoice?`지난 선택: ‘${p.lastChoice}’. `:'');
  if(tone==='conflict')return {title:phase===1?'어긋난 약속의 재회':'지난 선택의 값을 묻다',tone,prompt:`${context}${label}의 말투가 전보다 조심스럽습니다. ${phase===2?'지난 만남에서':'그동안'} 남은 불만을 풀고 앞으로의 약속을 다시 정하자고 합니다.`,options:[
    option('mend','지난 일을 인정하고 손해를 나눠 맡는다','금화 -6 · 평판 +3','kind',`${together} 장부와 기억을 함께 맞췄습니다. 서로의 손해를 인정하고 다시 이야기할 여지를 남겼습니다.`,{reputation:3},3,6),
    option('boundary','앞으로 지킬 조건만 분명히 정한다','평판 +1','smart',`${together} 지킬 수 있는 조건만 적었습니다. 가까워지지는 못했지만 더 다투지 않기로 했습니다.`,{reputation:1},1),
    option('cut','책임을 돌리고 만남을 끝낸다','평판 -3','greed',`${label}에게 책임을 돌렸습니다. 돌아서는 발걸음 사이에 풀지 못한 말이 남았습니다.`,{reputation:-3},-2)]};
  if(phase===2&&tone==='friend')return {title:'오래된 인연의 답례',tone,prompt:`${context}${label}의 손에 작은 꾸러미가 들려 있습니다. 여러 번 나눴던 도움을 기억하며 ${v.place}에서의 새 약속을 제안합니다. ${PEOPLE[group].request}`,options:[
    option('share','답례를 받고 다음 사람에게 도움을 잇는다','금화 +12 · 평판 +4','kind',`${label}의 답례를 받고 다음 원정을 준비하는 이들을 함께 도왔습니다. 던전에서 시작한 인연은 서로를 부르는 이름으로 남았습니다.`,{gold:12,reputation:4},1),
    option('rest','보답 대신 함께 쉬며 이야기를 나눈다','피로 -8 · 평판 +2','safe',`${together} 오래된 던전 이야기를 나누며 쉬었습니다. 보답보다 서로 돌아왔다는 사실이 반가웠습니다.`,{fatigue:-8,reputation:2},2),
    option('profit','친분을 내세워 더 큰 몫을 챙긴다','금화 +18 · 평판 -4','greed',`${label}의 친분을 내세워 더 큰 몫을 챙겼습니다. 함께 나누던 이야기가 짧아졌습니다.`,{gold:18,reputation:-4},-4)]};
  return {title:phase===2?'다시 써 보는 약속':tone==='friend'?'이름을 부르며 건넨 부탁':'조심스럽게 건넨 새 부탁',tone,prompt:`${context}「${label}」 — ${v.place}에서 다시 마주쳤습니다. ${tone==='friend'?'이제는 이름을 부르며 안부부터 묻습니다. ':'아직은 서로의 생각을 조금 더 알아가려 합니다. '}${PEOPLE[group].request}`,options:[
    option('help',v.help,`금화 -${v.cost} · 평판 +5`,'kind',`${label}의 부탁을 듣고 ${v.place}에서 할 수 있는 일을 보탰습니다. 다음에는 서로의 사정도 먼저 살피기로 했습니다.`,{reputation:5},2,v.cost),
    option('fair','감당할 수 있는 몫만 공정하게 맡는다','금화 +10 · 평판 +1','smart',`${together} 각자 맡을 몫을 정하고 일을 마쳤습니다. 무리한 약속 대신 지킬 수 있는 거래를 택했습니다.`,{gold:10,reputation:1},0),
    option('profit','급한 사정을 이용해 값을 높인다','금화 +18 · 평판 -4','greed',`${label}의 급한 사정을 이용해 값을 높였습니다. 대금은 받았지만 다음 약속에는 침묵이 남았습니다.`,{gold:18,reputation:-4},-4)]};
}
export function validRelationshipChoice(ch){return ch?.kind!=='relation-event'||!!PEOPLE[ch.source]&&ch.personSnapshot&&Object.keys(venues).includes(ch.personSnapshot.career)&&ch.personSnapshot.chapter<2&&validRelationships({socialVersion:1,nameSeed:0,people:{[ch.source]:ch.personSnapshot}});}
export function openRelationshipEvent(g,group){
  if(g.world.mode!=='life'||g.s.status!=='running'||!eligibleRelationshipGroups(g).includes(group))return false;
  const p=person(g,group),scene=relationshipScene(g,group),b=initRelationships(g);b.lastWasBond=true;
  const snapshot={...structuredClone(p),career:g.world.career};
  g.setMenu('relation-event',scene.prompt,scene.options.map(({id,label,hint,bias,cost})=>({id,label,hint,bias,disabled:cost>g.s.gold})),{source:group,title:scene.title,personName:personLabel(g,group),relation:relationLabel(p.score),meetings:p.meetings+1,personSnapshot:snapshot});return true;
}
export function chooseRelationshipEvent(g,id){
  const ch=g.s.choice;if(ch?.kind!=='relation-event'||!ch.options.some(o=>o.id===id))return false;
  const scene=relationshipScene({world:{career:ch.personSnapshot.career}},ch.source,ch.personSnapshot),o=scene.options.find(o=>o.id===id);if(!o||o.cost>g.s.gold)return false;
  g.s.status='running';g.s.choice=null;g.s.choicesMade++;g.emit(`선택: ${o.label}.`,'choice');g.s.gold-=o.cost;
  const labels={gold:'금화',reputation:'평판',fatigue:'피로'},changes=Object.entries(o.delta).map(([key,value])=>`${labels[key]} ${value>0?'+':''}${value}`);
  g.enqueue([o.text,...(o.cost?[`금화 -${o.cost}`]:[]),...changes].join(' · '),o.change<0?'bad':'good',o.delta,{bondEffect:{flags:[],settleDebt:false,memory:o.text,social:{group:ch.source,key:`r:${ch.source}:${ch.personSnapshot.chapter+1}`,change:o.change,choice:o.label,town:true,chapter:ch.personSnapshot.chapter+1}}});return true;
}
