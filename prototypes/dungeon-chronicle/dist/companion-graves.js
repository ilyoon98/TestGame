import { PEOPLE, relationshipSummaries, relationLabel } from './relationships.js';
import { npcAppearance, optionalNpcAppearance, npcAppearanceLabel } from './npc-appearance.js';

export const isCompanionGrave=m=>m?.kind==='companion';
const short=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const natural=v=>Number.isInteger(v)&&v>=0;
export const companionGraveId=(ownerId,group)=>`companion:${encodeURIComponent(ownerId)}:${group}`;
export function validCompanionGrave(m){
  return m?.version===1&&isCompanionGrave(m)&&short(m.id,1000)&&short(m.owner?.id,300)&&short(m.owner?.name,100)&&
    Object.hasOwn(PEOPLE,m.group)&&m.role===PEOPLE[m.group].role&&short(m.character?.name,50)&&optionalNpcAppearance(m.appearance,m.group)&&
    m.id===companionGraveId(m.owner.id,m.group)&&Number.isInteger(m.score)&&m.score>=-6&&m.score<=6&&natural(m.meetings)&&m.meetings<=100&&natural(m.journeys)&&m.journeys<=3&&
    m.outcome?.type==='death'&&typeof m.outcome.at==='string'&&m.outcome.at.length<=100&&short(m.outcome.cause,500)&&short(m.outcome.location,200)&&natural(m.outcome.ownerAgeYears)&&m.outcome.ownerAgeYears<=1000&&natural(m.outcome.elapsedDays)&&
    Array.isArray(m.honors)&&m.honors.length===0&&Array.isArray(m.sharedEvents)&&m.sharedEvents.length<=16&&m.sharedEvents.every(e=>short(e?.text,2000)&&typeof e.location==='string'&&e.location.length<=200&&(e.ownerAgeYears===null||natural(e.ownerAgeYears)&&e.ownerAgeYears<=1000)&&(e.elapsedDays===null||natural(e.elapsedDays)));
}
export const sharedEventLabel=(m,e)=>`${Number.isInteger(e.ownerAgeYears)?`${m.owner.name} ${e.ownerAgeYears}세 때`:'시기 기록 없음'}${e.location?` · ${e.location}`:''}`;
export function mergeSharedEvents(a=[],b=[]){
  const events=new Map();for(const e of [...a,...b])events.set(`${e.elapsedDays}:${e.text}`,structuredClone(e));
  return [...events.values()].sort((x,y)=>(x.elapsedDays??Number.MAX_SAFE_INTEGER)-(y.elapsedDays??Number.MAX_SAFE_INTEGER)).slice(-16);
}
export function companionGraves(record){
  if(!record?.character||typeof record.id!=='string'||isCompanionGrave(record))return [];
  const summaries=record.world?relationshipSummaries(record):Array.isArray(record.relationships)?record.relationships:[];
  return summaries.filter(p=>p?.fate?.state==='dead').flatMap(p=>{
    const group=Object.keys(PEOPLE).find(k=>PEOPLE[k].role===p.role);if(!group)return [];
    const f=p.fate,label=`${p.role} ${p.name}`,events=[];
    for(const l of record.log||[]){
      // Prompts and uncommitted choices are not experiences. Only emitted results survive.
      if(l.kind==='choice'||!l.text?.includes(label))continue;
      events.push({text:l.text.split(` · ${label}:`)[0],ownerAgeYears:l.ageYears??null,location:l.location||'',elapsedDays:l.elapsedDays??null});
    }
    if(!events.length){
      for(const h of f.history||[])events.push({text:h.cause,ownerAgeYears:h.ageYears,location:h.location,elapsedDays:h.elapsedDays});
      for(const text of record.reunions||record.world?.bonds?.memories||[])if(text.includes(label))events.push({text,ownerAgeYears:null,location:'',elapsedDays:null});
    }
    const m={version:1,kind:'companion',id:companionGraveId(record.id,group),owner:{id:record.id,name:record.character.name},group,character:{name:p.name},role:p.role,appearance:npcAppearance(record.id,group,p),score:p.score,meetings:p.meetings,journeys:p.journeys||0,
      outcome:{type:'death',at:record.startedAt||record.outcome?.at||'',location:f.location,cause:f.cause,ownerAgeYears:f.ageYears,elapsedDays:f.elapsedDays},honors:[],sharedEvents:mergeSharedEvents([],events)};
    return validCompanionGrave(m)?[m]:[];
  });
}
export function companionStory(m){
  const memories=m.sharedEvents.filter(e=>!e.text.includes(m.outcome.cause)).slice(-2).map(e=>e.text).join(' ');
  return `${m.owner.name}의 인연, ${m.role} ${m.character.name}. ${m.meetings}번의 만남 끝에 ${relationLabel(m.score)}의 인연으로 남았습니다. ${memories} ${m.owner.name} ${m.outcome.ownerAgeYears}세 때, ${m.outcome.location}에서 세상을 떠났습니다. ${m.outcome.cause}`;
}
export function companionText(m){return [`${m.character.name}의 묘비`,`${m.role} · ${m.owner.name}의 인연 · ${relationLabel(m.score)}`,...(m.appearance?[npcAppearanceLabel(m.appearance,m.role)]:[]),`만남 ${m.meetings}번 · 동행 ${m.journeys}회`,`사망: ${m.outcome.location} · ${m.outcome.cause}`,`그때 ${m.owner.name}의 나이: ${m.outcome.ownerAgeYears}세`,'함께 겪었던 일',...m.sharedEvents.map(e=>`[${sharedEventLabel(m,e)}] ${e.text}`)].join('\n');}
