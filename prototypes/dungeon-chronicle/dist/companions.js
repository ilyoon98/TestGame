import { PEOPLE, person, personLabel, relationLabel, knownPeople, applyRelationship, personAvailable, validRelationships, dungeonPersonGroup } from './relationships.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function companionState(g){return g.world.companions??={version:1,active:null,lastOfferTrip:0,lastRescueTrip:0};}
const memory=(g,text)=>{const b=g.world.bonds;if(!b.memories.includes(text))b.memories.push(text);b.memories=b.memories.slice(-4);};
export function eligibleCompanions(g){return knownPeople(g).filter(p=>p.score>=2&&personAvailable(p)&&(p.travelTrips?.length||0)<3&&!(p.group==='debt'&&g.world.bonds.contacts.debt.status==='open')).map(p=>p.group);}
export function planCompanions(g,chosen,hasFollow){
  const groups=eligibleCompanions(g).filter(group=>!hasFollow||dungeonPersonGroup(chosen[0])!==group),state=g.world.companions;
  if(!groups.length||state?.active||state?.lastOfferTrip&&g.world.trips-state.lastOfferTrip<2||hasFollow&&chosen.length<2||!g.chance(.45))return chosen;
  const group=g.pick(groups);companionState(g).lastOfferTrip=g.world.trips;
  if(hasFollow)return [chosen[0],{companion:group,phase:'invite'}];
  return [{companion:group,phase:'invite'},...(chosen.length>1?[{companion:group,phase:'danger'}]:[])];
}
function scene(g,group,phase){
  const label=personLabel(g,group);
  if(phase==='invite')return {title:'익숙한 이름의 짧은 동행',prompt:`${label} — 던전에서 다시 마주쳤습니다. 목적지가 겹치는 다음 세 구간만 함께 걷자고 합니다. 함께 가도 위험은 남습니다.`,options:[
    {id:'together',label:'다음 몇 구간을 함께 걷는다',hint:'세 구간 동행 · 서로 구할 수도 있지만 동행도 다치거나 죽을 수 있음',bias:'kind'},
    {id:'directions',label:'길 소식만 나누고 각자의 길을 간다',hint:'동행 없이 탐험 계속',bias:'smart'},
    {id:'alone',label:'혼자 걷겠다고 인사한다',hint:'동행 없이 탐험 계속',bias:'safe'}]};
  return {title:'동행의 발밑이 무너지다',prompt:`${label} — 같은 길을 걷던 중 바닥이 꺼졌습니다. 손을 뻗으면 닿을 거리지만 돌이 계속 쏟아집니다. 붙잡거나 치료하며 빠져나올 수 있을지 결정해야 합니다.`,options:[
    {id:'rescue',label:'손을 잡고 끌어올린다',hint:'구조 시 함께 귀환 준비 · 실패하면 동행 사망 · 자신도 부상',bias:'bold'},
    {id:'potion',label:'물약을 나누며 안전한 자리로 옮긴다',hint:'물약 -1 · 구조 확률이 높아짐 · 자신도 부상',bias:'kind',potionCost:1},
    {id:'retreat',label:'자신부터 안전한 곳으로 물러난다',hint:'자신의 추가 피해 없음 · 동행의 부상 또는 사망 · 인연 -3',bias:'safe'}]};
}
export function openCompanionEvent(g,group,phase){
  if(g.world.mode!=='dungeon'||g.s.status!=='running'||!PEOPLE[group])return false;
  const p=person(g,group),active=g.world.companions?.active;
  if(phase==='invite'&&(!eligibleCompanions(g).includes(group)||active||p.travelTrips?.includes(g.world.trips)||p.applied.some(k=>k===`c:${g.world.trips}:decline`)||g.s.queue.some(e=>e.companionEffect?.group===group&&e.companionEffect.trip===g.world.trips)))return false;
  if(phase==='danger'&&(!active||active.group!==group||active.trip!==g.world.trips||!personAvailable(p)))return false;
  if(!['invite','danger'].includes(phase))return false;
  const e=scene(g,group,phase);g.setMenu('companion-event',e.prompt,e.options.map(o=>({...o,disabled:(o.potionCost||0)>g.s.potions})),{source:group,title:e.title,phase,trip:g.world.trips,personName:personLabel(g,group),relation:relationLabel(p.score),meetings:p.meetings+(phase==='invite'?1:0),companionScore:p.score});return true;
}
export function chooseCompanionEvent(g,id){
  const ch=g.s.choice;if(ch?.kind!=='companion-event'||!ch.options.some(o=>o.id===id))return false;
  const group=ch.source,p=person(g,group),o=scene(g,group,ch.phase).options.find(o=>o.id===id);
  if(!o||!personAvailable(p)||(o.potionCost||0)>g.s.potions||ch.phase==='danger'&&g.world.companions?.active?.group!==group)return false;
  g.s.status='running';g.s.choice=null;g.s.choicesMade++;g.s.potions-=o.potionCost||0;g.emit(`선택: ${o.label}.`,'choice');
  const label=personLabel(g,group);
  if(ch.phase==='invite'){
    const text=id==='together'?`${label} — 다음 세 구간을 함께 걷기로 했습니다. 서로의 퇴로를 먼저 살피기로 했습니다.`:`${label} — 안부와 길 소식을 나눈 뒤 각자의 길로 향했습니다.`;
    g.enqueue(text,'note',{}, {companionEffect:{type:id==='together'?'join':'decline',group,trip:ch.trip,change:id==='together'?1:0,choice:o.label,memory:text}});return true;
  }
  const risk=id==='potion'?clamp(.86+ch.companionScore*.01,.86,.94):clamp(.42+g.character.scout*.009+ch.companionScore*.035,.45,.88),saved=id==='retreat'?g.chance(.45):g.chance(risk),status=saved?'injured':'dead';
  const hp=id==='retreat'?0:id==='potion'?(saved?-2:-8):(saved?-6:-14);
  const cause=id==='retreat'?(saved?'다른 탐험자의 도움으로 무너진 길에서 빠져나왔습니다.':'무너진 길에서 돌아오지 못했습니다.'):(saved?'도움을 받아 무너진 길을 빠져나왔지만 떨어진 돌에 크게 다쳤습니다.':'구조하던 손이 미끄러진 뒤 쏟아지는 돌을 피하지 못했습니다.');
  const text=`${label} — ${cause}${saved?' 한동안 던전을 떠나 요양해야 합니다.':' 이 원정에서 사망했습니다.'}${hp?` 자신도 체력 ${hp}.`:''}${o.potionCost?' 물약 -1.':''}`;
  g.enqueue(text,saved?'note':'bad',{hp,...(saved&&id!=='retreat'?{reputation:4}:{})},{companionEffect:{type:'incident',group,trip:ch.trip,status,change:id==='retreat'?-3:saved?2:0,choice:o.label,cause,memory:text,savedPlayer:false}});return true;
}
export function rescueByCompanion(g,text,delta,extra){
  const state=g.world.companions,a=state?.active;
  if(g.world.mode!=='dungeon'||!a||a.trip!==g.world.trips||state.lastRescueTrip===a.trip||extra.finish||extra.travelYear||extra.companionEffect||!(delta.hp<0)||-delta.hp<g.s.hp||!personAvailable(person(g,a.group))||!g.chance(clamp(.35+person(g,a.group).score*.05,.35,.65)))return {text,delta,extra};
  const group=a.group,status=g.chance(clamp(.10+g.s.floor*.015,.10,.25))?'dead':'injured',label=personLabel(g,group),hp=-Math.max(0,Math.min(-delta.hp-8,g.s.hp-1));
  const cause=status==='dead'?'치명적인 공격 앞에서 대신 막아서다 사망했습니다.':'치명적인 공격을 대신 막아서다 크게 다쳤습니다.';
  const replacement=`${label} — 위험을 알아채고 몸을 던져 목숨을 구해 줬습니다. ${cause}${hp<0?` 자신의 체력 ${hp}.`:' 자신은 추가로 다치지 않았습니다.'}`;
  return {text:replacement,delta:{...delta,hp},extra:{...extra,companionEffect:{type:'incident',group,trip:a.trip,status,change:2,choice:'동행에게 목숨을 빚지다',cause,memory:replacement,savedPlayer:true}}};
}
export function commitCompanionEffect(g,e){
  const p=person(g,e.group),state=companionState(g),key=`c:${e.trip}:${e.type}`;
  if(e.type==='remember'){
    if(!p.fate||p.fate.serial!==e.serial||p.fate.memorySeen)return;
    if(g.s.hp<=0)return;
    if(p.fate.state!=='dead')applyRelationship(g,{group:e.group,key:`m:${e.group}:${e.serial}`,choice:e.choice,change:e.change,town:true});
    if(p.fate.state!=='dead'&&e.status)p.fate.state=e.status;
    p.fate.memorySeen=true;p.fate.lastEchoDay=g.s.timeline.elapsedDays;memory(g,e.memory);return;
  }
  if(p.applied.includes(key)||p.fate?.state==='dead')return;
  if(e.type==='incident'){
    if(g.s.hp>0)applyRelationship(g,{group:e.group,key,choice:e.choice,change:e.change,countMeeting:false});else p.applied.push(key);
    const incident={state:e.status,ageYears:g.age().years,elapsedDays:g.s.timeline.elapsedDays,location:g.location(),cause:e.cause};
    p.fate={...incident,serial:(p.fate?.serial||0)+1,history:[...(p.fate?.history||[]),incident].slice(-3),memorySeen:false,echoes:0,lastEchoDay:g.s.timeline.elapsedDays,savedPlayer:e.savedPlayer};
    state.active=null;if(e.savedPlayer)state.lastRescueTrip=e.trip;memory(g,e.memory);return;
  }
  if(g.s.hp<=0||!personAvailable(p))return;
  applyRelationship(g,{group:e.group,key,choice:e.choice,change:e.change});
  if(e.type==='join'){p.travelTrips??=[];if(!p.travelTrips.includes(e.trip))p.travelTrips.push(e.trip);state.active={group:e.group,trip:e.trip,remaining:3};memory(g,e.memory);}
}
export function advanceCompanion(g,floor,room){const a=g.world.companions?.active;if(a&&a.trip===g.world.trips&&(g.s.floor!==floor||g.s.room!==room))a.remaining=Math.max(0,a.remaining-1);}
export function partCompanion(g,reason='brief'){
  const a=g.world.companions?.active;if(!a)return false;g.world.companions.active=null;
  if(reason==='death'||reason==='story')return true;
  const text=reason==='return'||reason==='clear'?`${personLabel(g,a.group)} — 이번 동행을 마치고 함께 출구까지 돌아왔습니다.`:`${personLabel(g,a.group)} — 갈림길에서 짧은 동행을 마쳤습니다. 각자의 목적지로 향하며 다음 안부를 약속했습니다.`;
  g.emit(text,'note');memory(g,text);return true;
}
export function eligibleCompanionMemories(g){return knownPeople(g).filter(p=>p.fate&&!p.fate.memorySeen&&g.s.timeline.elapsedDays-p.fate.elapsedDays>=360&&!g.s.queue.some(e=>e.companionEffect?.group===p.group)).map(p=>p.group);}
function memoryScene(g,group,snapshot){
  const p=snapshot||person(g,group),f=p.fate,label=`${PEOPLE[group].role} ${p.name}`,place={inn:'여관',guild:'길드',trader:'상점',smith:'공방'}[g.world.career];
  const together=label+((p.name.charCodeAt(p.name.length-1)-0xac00)%28?'과':'와');
  const option=(id,label,hint,bias,text,delta,change=0,cost=0,status)=>({id,label,hint,bias,text,delta,change,cost,status});
  if(f.state==='dead')return {title:'돌아오지 않은 이름의 자리',prompt:`${place}의 하루가 조용해졌습니다. ${label}의 이름이 떠오릅니다. 당신이 ${f.ageYears}세이던 때, 함께 갔던 ${f.location}에서의 마지막 동행입니다. ${f.cause}`,options:[
    option('memorial','함께 걸었던 이를 위한 자리를 마련한다','금화 -6 · 평판 +5','kind',`${place}에 ${label}의 이름을 남길 자리를 마련했습니다. 다시 만날 수는 없어도 함께 걸었던 길은 이야기로 남았습니다.`,{reputation:5},0,6),
    option('tell','신입에게 함께 걸었던 길을 전한다','평판 +2','smart',`${place}에 온 신입에게 ${together} 함께 지나온 위험을 전했습니다. 돌아오지 못한 이름을 잊지 않기로 했습니다.`,{reputation:2}),
    option('quiet','혼자 조용히 그 이름을 떠올린다','피로 -3','safe',`${place}의 일을 마치고 ${label}의 이름을 조용히 불렀습니다. 그날 들었던 발소리를 오래 기억했습니다.`,{fatigue:-3})]};
  return {title:'함께 다쳤던 사람의 그 후',prompt:`${label}의 요양 소식이 ${place}에 닿았습니다. ${f.location}에서 다친 뒤로 시간이 흘렀습니다. ${f.cause} 이제 회복을 돕거나 던전 밖에서 새 일을 이어 갈 자리를 살필 수 있습니다.`,options:[
    option('care','치료와 재활을 끝까지 돕는다','금화 -8 · 평판 +4 · 회복 후 다시 동행 가능','kind',`${label}의 치료와 재활을 도왔습니다. 오랜 회복 끝에 다시 길을 걸을 수 있게 됐지만, 그때 다쳤던 이야기는 잊지 않았습니다.`,{reputation:4},2,8,'well'),
    option('work','던전 밖에서 할 수 있는 일을 연결한다','평판 +4 · 인연 +1 · 모험 은퇴','smart',`${label}에게 ${place}와 연결된 가벼운 일을 소개했습니다. 부상 뒤 모험을 내려놓았지만 살아서 다시 안부를 나눌 수 있었습니다.`,{reputation:4},1,0,'retired'),
    option('visit','요양을 존중하며 조용히 곁을 지킨다','피로 -3 · 모험 은퇴','safe',`${label}의 요양 곁을 지키며 오래 이야기를 나눴습니다. 다친 몸으로 다시 던전에 가지 않고 마을에서 살아가기로 했습니다.`,{fatigue:-3},1,0,'retired')]};
}
export function openCompanionMemory(g,group){
  if(g.world.mode!=='life'||g.s.status!=='running'||!eligibleCompanionMemories(g).includes(group))return false;
  const p=person(g,group),e=memoryScene(g,group);g.world.bonds.lastWasBond=true;
  g.setMenu('companion-memory',e.prompt,e.options.map(({id,label,hint,bias,cost})=>({id,label,hint,bias,disabled:cost>g.s.gold})),{source:group,title:e.title,personName:personLabel(g,group),relation:p.fate.state==='dead'?'기억 속의 인연':'요양 중',meetings:p.meetings,personSnapshot:{...structuredClone(p),career:g.world.career}});return true;
}
export function chooseCompanionMemory(g,id){
  const ch=g.s.choice;if(ch?.kind!=='companion-memory'||!ch.options.some(o=>o.id===id))return false;
  const p=person(g,ch.source);if(!p.fate||p.fate.serial!==ch.personSnapshot.fate.serial||p.fate.memorySeen)return false;
  const e=memoryScene({world:{career:ch.personSnapshot.career}},ch.source,ch.personSnapshot),o=e.options.find(o=>o.id===id);if(!o||o.cost>g.s.gold)return false;
  g.s.status='running';g.s.choice=null;g.s.choicesMade++;g.s.gold-=o.cost;g.emit(`선택: ${o.label}.`,'choice');
  g.enqueue([o.text,...(o.cost?[`금화 -${o.cost}`]:[])].join(' · '),'note',o.delta,{companionEffect:{type:'remember',group:ch.source,serial:p.fate.serial,trip:g.world.trips,change:o.change,choice:o.label,status:o.status,memory:o.text}});return true;
}
export function companionReminiscence(g){
  const p=knownPeople(g).find(p=>p.fate?.memorySeen&&p.fate.echoes<2&&g.s.timeline.elapsedDays-p.fate.lastEchoDay>=1080);if(!p)return false;
  const f=person(g,p.group).fate,place=g.career().place,label=personLabel(g,p.group),dead=f.state==='dead',together=label+((p.name.charCodeAt(p.name.length-1)-0xac00)%28?'과':'와');
  const echoes=dead?[`${place}에서 낡은 짐을 정리하다 ${together} 함께 걷던 날을 떠올렸습니다. 빈자리는 여전히 그 이름으로 남았습니다.`,`${place}에 새 모험가가 찾아왔습니다. ${label}의 마지막 동행을 이야기하며 무사히 돌아오라는 말을 건넸습니다.`]:[`${place}의 바쁜 날에 ${label}의 안부가 닿았습니다. 던전에서 다쳤던 날 이후의 삶도 조금씩 이어지고 있었습니다.`,`${place}에서 오래된 도구를 보며 ${together} 버텼던 길을 떠올렸습니다. 상처 뒤에도 남은 시간을 잊지 않았습니다.`];
  g.emit(echoes[f.echoes],'note');f.echoes++;f.lastEchoDay=g.s.timeline.elapsedDays;memory(g,echoes[f.echoes-1]);return true;
}
export function validCompanionState(s){return s===undefined||s?.version===1&&Number.isInteger(s.lastOfferTrip)&&s.lastOfferTrip>=0&&Number.isInteger(s.lastRescueTrip)&&s.lastRescueTrip>=0&&(s.active===null||s.active&&PEOPLE[s.active.group]&&Number.isInteger(s.active.trip)&&s.active.trip>=1&&Number.isInteger(s.active.remaining)&&s.active.remaining>=0&&s.active.remaining<=3);}
export function validCompanionEffect(e){
  return e&&PEOPLE[e.group]&&['join','decline','incident','remember'].includes(e.type)&&Number.isInteger(e.trip)&&e.trip>=0&&Number.isInteger(e.change)&&e.change>=-3&&e.change<=3&&typeof e.choice==='string'&&e.choice.length<200&&typeof e.memory==='string'&&e.memory.length<1000&&
    (e.type!=='incident'||['injured','dead'].includes(e.status)&&typeof e.cause==='string'&&e.cause.length<500&&typeof e.savedPlayer==='boolean')&&
    (e.type!=='remember'||Number.isInteger(e.serial)&&e.serial>=1&&(!e.status||['well','retired'].includes(e.status)));
}
export function validCompanionChoice(ch){return !['companion-event','companion-memory'].includes(ch?.kind)||!!PEOPLE[ch.source]&&(ch.kind==='companion-event'?['invite','danger'].includes(ch.phase)&&Number.isInteger(ch.trip)&&ch.trip>=1&&Number.isInteger(ch.companionScore)&&ch.companionScore>=-6&&ch.companionScore<=6:ch.personSnapshot?.fate&&['inn','guild','trader','smith'].includes(ch.personSnapshot.career)&&validRelationships({socialVersion:1,nameSeed:0,people:{[ch.source]:ch.personSnapshot}}));}
