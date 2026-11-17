import { RACES } from './engine.js';
import { lifeRole } from './memorial.js';
// Memorial order fixes each resting place; filters never move its neighbors.
export function searchMemorials(memorials,query){
  const words=String(query).trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  if(!words.length)return [];
  return memorials.filter(m=>{const text=`${m.character.name} ${RACES.find(r=>r.id===m.character.race)?.name||''} ${lifeRole(m)} ${m.owner?.name||''} ${m.kind==='companion'?'인연':''}`.toLocaleLowerCase('ko-KR');return words.every(word=>text.includes(word));});
}
export function cemeteryLayout(memorials){
  const rows=[...memorials].sort((a,b)=>String(a.outcome.at||'').localeCompare(String(b.outcome.at||''))||a.id.localeCompare(b.id));
  return {width:Math.max(1500,540+rows.length*210),plots:rows.map((memorial,index)=>({memorial,x:320+index*210,rise:[0,14,5,22][index%4]}))};
}
export function mapPercent(position,extent){return extent>0?Math.max(0,Math.min(100,position/extent*100)):0;}
