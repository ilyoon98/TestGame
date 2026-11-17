import { RACES, JOBS, TRAITS } from './engine.js';
import { Fantasy } from './world.js';
import { HONORS, mergeMemorials } from './memorial.js';
import { validRelationshipSummaries } from './relationships.js';
import { isCompanionGrave, validCompanionGrave } from './companion-graves.js';
import { validRemembrance, makeRemembrance } from './grave-visits.js';
const string=v=>typeof v==='string'&&v.length<=5000;
const number=v=>Number.isFinite(v)&&v>=0;
const jobs=['inn','guild','trader','smith'];
const list=(v,valid)=>Array.isArray(v)&&v.every(valid);
function validMemorial(m){
  if(isCompanionGrave(m))return validCompanionGrave(m);
  return m?.version===1&&string(m.id)&&string(m.character?.name)&&RACES.some(r=>r.id===m.character.race)&&['child',...JOBS.map(j=>j.id)].includes(m.character.job)&&list(m.character.traits,id=>TRAITS.some(t=>t.id===id))&&m.character.traits.length===2&&
    m.outcome?.type==='death'&&string(m.outcome.at)&&string(m.outcome.cause)&&string(m.outcome.location)&&Number.isInteger(m.outcome.ageYears)&&m.outcome.ageYears>=0&&m.outcome.ageYears<=1000&&number(m.outcome.floor)&&
    ['kills','rooms','trips','gold','reputation','months'].every(k=>number(m.stats?.[k]))&&list(m.careers,id=>jobs.includes(id))&&(!m.career||jobs.includes(m.career))&&list(m.cleared,id=>['mine','crypt','ruins'].includes(id))&&list(m.honors,id=>HONORS.some(h=>h.id===id))&&
    (m.relationships===undefined||validRelationshipSummaries(m.relationships))&&validRemembrance(m.remembrance,m.relationships)&&(m.reunions===undefined||list(m.reunions,string)&&m.reunions.length<=4)&&(!m.family||(string(m.family.place)&&list(m.family.parents,p=>string(p?.name)&&string(p?.job))));
}
export function exportRecords(memorials,history){return JSON.stringify({format:'fantasy-memorial-backup',version:1,createdAt:new Date().toISOString(),memorials,history},null,2);}
export function importRecords(text,currentMemorials,currentHistory){
  if(typeof text!=='string'||text.length>5*1024*1024)throw new Error('5MB 이하의 기록 백업 파일을 골라 주세요.');
  let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('읽을 수 없는 JSON 파일입니다.');}
  if(data?.format!=='fantasy-memorial-backup'||data.version!==1||!Array.isArray(data.memorials)||data.memorials.length>10000||!data.memorials.every(validMemorial)||!Array.isArray(data.history)||data.history.length>20)throw new Error('판타지 모험록의 기록 백업 형식이 아닙니다.');
  const incoming=data.history.map(raw=>{
    const state=Fantasy.restore(raw).s,o=state.outcome;
    if(state.status!=='ended'||!o||!['death','story','return','clear'].includes(o.type)||!string(state.id)||!string(state.character.name)||!state.log.every(l=>string(l.text))||
      !['gold','potions','kills','roomsExplored','choicesMade'].every(k=>number(state[k]))||!['trips','reputation','totalDays'].every(k=>number(state.world[k]))||!number(o.floor)||!number(o.recoveredGold)||!number(o.ageYears)||!string(o.at)||!string(o.title)||!string(o.cause))throw new Error('완료된 이야기 기록이 올바르지 않습니다.');
    return state;
  });
  // Existing records win on duplicate IDs; importing cannot erase a resting place.
  const recovered=mergeMemorials([],incoming).filter(isCompanionGrave);
  const enriched=data.memorials.map(m=>!isCompanionGrave(m)&&!m.remembrance?{...m,remembrance:makeRemembrance({...m,log:incoming.find(s=>s.id===m.id)?.log})}:m);
  const memorials=mergeMemorials([...recovered,...enriched,...currentMemorials],[]);
  const histories=new Map(incoming.map(s=>[s.id,s]));for(const s of currentHistory)histories.set(s.id,s);
  const history=[...histories.values()].sort((a,b)=>String(b.outcome.at).localeCompare(String(a.outcome.at))).slice(0,20);
  return {memorials,history,added:memorials.length-currentMemorials.length};
}
