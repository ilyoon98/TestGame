import { PEOPLE, relationshipSummaries } from './relationships.js';
import { npcAppearance, optionalNpcAppearance, sameNpcAppearance } from './npc-appearance.js';

const hash=text=>{let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const short=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const subject=label=>label+((label.charCodeAt(label.length-1)-0xac00)%28?'이':'가');
const survivors=record=>(record.world?relationshipSummaries(record):Array.isArray(record.relationships)?record.relationships:[]).filter(p=>p.meetings>0&&p.fate?.state!=='dead');
export const visitWhen=v=>v.daysAfterDeath>=365?`사망 ${Math.floor(v.daysAfterDeath/365)}년 뒤`:`사망 ${v.daysAfterDeath}일 뒤`;
export const remembranceVisits=m=>m?.remembrance?.visits||[];

function sharedMemory(record,p,n){
  const label=`${p.role} ${p.name}`;
  const logs=(record.log||[]).filter(l=>l.kind!=='choice'&&l.text?.includes(label));
  // A rescue is a stronger link than an unrelated later greeting.
  const rescued=logs.find(l=>/목숨을 구해|몸을 던져/.test(l.text));
  const log=rescued||logs[n%Math.max(1,logs.length)];
  if(log)return {text:log.text.split(` · ${label}:`)[0],ageYears:log.ageYears??null,location:log.location||''};
  const memories=record.reunions||record.world?.bonds?.memories||[];
  const remembered=memories.find(text=>text.includes(label));
  if(remembered)return {text:remembered,ageYears:null,location:''};
  // Older compact records have no complete log. Do not invent a rescue or a place.
  return {text:p.journeys?`${record.character.name}의 곁에서 던전의 길을 함께 걸었던 날들이 남았습니다.`:`${record.character.name}의 이름을 부르며 안부를 나눴던 만남이 남았습니다.`,ageYears:null,location:''};
}
export function makeRemembrance(record){
  if(record?.kind==='companion'||record?.outcome?.type!=='death')return null;
  const visits=[];
  for(const p of survivors(record)){
    const group=Object.keys(PEOPLE).find(k=>PEOPLE[k].role===p.role);if(!group)continue;
    // Life identity contains the original seed; the live RNG state keeps advancing.
    const n=hash(`${record.id}:${group}:${p.name}`),label=`${p.role} ${p.name}`,condition=p.fate?.state||'well',close=p.score>=2,conflict=p.score<=-2,injured=condition==='injured';
    const memory=sharedMemory(record,p,n),action=injured?'letter':close?'flowers':conflict?'quiet':n%2?'memory':'flowers';
    const text=injured?`${label}의 요양처에서 꽃과 편지가 도착했습니다. 함께했던 날을 잊지 않았다는 짧은 안부가 묘비 앞에 놓였습니다.`:
      conflict?`${subject(label)} 묘비 앞에서 한동안 말없이 서 있었습니다. 풀지 못한 말은 끝내 입 밖으로 나오지 않았지만, 돌아서기 전 먼지를 조용히 털었습니다.`:
      close?[`${subject(label)} 꽃을 내려놓고 돌에 새겨진 이름을 손끝으로 짚었습니다. 함께 나눴던 말들을 떠올리며 오래 곁에 머물렀습니다.`,`${subject(label)} 작은 꽃다발을 놓았습니다. 예전처럼 이름을 한 번 부른 뒤, 이제는 들려오지 않는 대답을 기다렸습니다.`][n%2]:
      action==='flowers'?`${subject(label)} 꽃 한 송이를 놓고 갔습니다. 길게 나누지 못했던 안부가 묘비 앞에 남았습니다.`:`${subject(label)} 묘비 앞에 앉아 함께 겪었던 일을 떠올렸습니다. 해가 기울 무렵, 조용히 인사를 남기고 돌아갔습니다.`;
    const appearance=npcAppearance(record.id,group,p);
    visits.push({id:`${group}:first`,group,name:p.name,role:p.role,appearance,score:p.score,condition,daysAfterDeath:14+n%50,action,flowers:action==='flowers'||action==='letter',text,memory});
    if(p.score>=4&&!injured)visits.push({id:`${group}:anniversary`,group,name:p.name,role:p.role,appearance:structuredClone(appearance),score:p.score,condition,daysAfterDeath:365+n%45,action:'flowers',flowers:true,
      text:`${subject(label)} 한 해 뒤 다시 찾아왔습니다. 시든 꽃을 거두고 새 꽃을 놓으며, ${record.character.name}의 이야기를 아직 기억하는 이가 있다고 전했습니다.`,memory:sharedMemory(record,p,n+1)});
  }
  return {version:1,visits:visits.sort((a,b)=>a.daysAfterDeath-b.daysAfterDeath||a.id.localeCompare(b.id))};
}
export function validRemembrance(r,relationships=[]){
  if(r===undefined)return true;
  if(r?.version!==1||!Array.isArray(relationships)||!Array.isArray(r.visits)||r.visits.length>14||new Set(r.visits.map(v=>v?.id)).size!==r.visits.length)return false;
  return r.visits.every(v=>{
    const p=relationships.find(p=>p.role===v?.role&&p.name===v?.name);
    return p&&p.fate?.state!=='dead'&&Object.hasOwn(PEOPLE,v.group)&&v.role===PEOPLE[v.group].role&&[`${v.group}:first`,`${v.group}:anniversary`].includes(v.id)&&
      short(v.name,50)&&optionalNpcAppearance(v.appearance,v.group)&&(!v.appearance||!p.appearance||sameNpcAppearance(v.appearance,p.appearance))&&r.visits.every(other=>other?.group!==v.group||!other.appearance||!v.appearance||sameNpcAppearance(other.appearance,v.appearance))&&v.score===p.score&&v.condition===(p.fate?.state||'well')&&Number.isInteger(v.daysAfterDeath)&&v.daysAfterDeath>=1&&v.daysAfterDeath<=730&&
      ['flowers','memory','letter','quiet'].includes(v.action)&&typeof v.flowers==='boolean'&&v.flowers===(v.action==='flowers'||v.action==='letter')&&(v.condition==='injured'?v.action==='letter':v.action!=='letter')&&
      short(v.text,1500)&&short(v.memory?.text,2000)&&(v.memory.ageYears===null||Number.isInteger(v.memory.ageYears)&&v.memory.ageYears>=0&&v.memory.ageYears<=1000)&&typeof v.memory.location==='string'&&v.memory.location.length<=200;
  });
}
export function visitText(m){return remembranceVisits(m).map(v=>`[${visitWhen(v)}] ${v.text} 함께한 기억: ${v.memory.text}`);}
export function decorateRemembranceTomb(markup,m){
  const flowers=remembranceVisits(m).filter(v=>v.flowers);if(!flowers.length)return markup;
  const colors=['#d7bcc7','#e1cd93','#b9cee0'];
  const petals=flowers.slice(0,3).map((v,i)=>`<g transform="translate(${6+i*6} ${79-i%2*3})"><path d="M2 0h1v7H2zM0 3h3v1H0z" fill="#78977b"/><path d="M0 -3h5v4H0zM1 -4h3v6H1z" fill="${colors[i]}"/><path d="M2 -2h1v2H2z" fill="#e8cf87"/></g>`).join('');
  return markup.replace('</svg>',`<g class="remembrance-flowers"><title>인연이 놓고 간 추모 꽃</title>${petals}</g></svg>`);
}
