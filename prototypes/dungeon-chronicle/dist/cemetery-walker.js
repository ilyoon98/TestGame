import { RACES, JOBS } from './engine.js';
import { HONORS, ageLabel, lifeRole } from './memorial.js';
import { relationLabel, conditionLabel } from './relationships.js';
import { isCompanionGrave, companionStory } from './companion-graves.js';

export class CemeteryWalker{
  constructor(width,x=220){this.speed=235;this.x=x;this.direction=0;this.target=null;this.facing=1;this.moving=false;this.setWidth(width);}
  setWidth(width){this.width=Math.max(120,width);this.x=this.clamp(this.x);if(this.target!==null)this.target=this.clamp(this.target);}
  clamp(x){return Math.max(70,Math.min(this.width-70,x));}
  walkTo(x){this.direction=0;this.target=this.clamp(x);}
  hold(direction){this.direction=Math.sign(direction);this.target=null;}
  stop(){this.direction=0;this.target=null;this.moving=false;}
  step(seconds){
    const before=this.x,dt=Math.max(0,Math.min(.05,seconds));
    if(this.direction)this.x=this.clamp(this.x+this.direction*this.speed*dt);
    else if(this.target!==null){const distance=this.target-this.x,travel=this.speed*dt;if(Math.abs(distance)<=travel){this.x=this.target;this.target=null;}else this.x+=Math.sign(distance)*travel;}
    this.moving=Math.abs(this.x-before)>.01;if(this.moving)this.facing=this.x>before?1:-1;return this.x;
  }
}
export function nearbyGrave(plots,x,radius=82){let nearest=null,distance=Infinity;for(const plot of plots){const d=Math.abs(plot.x+89-x);if(d<=radius&&d<distance){distance=d;nearest=plot;}}return nearest;}
export function memorialStory(m,full){
  if(isCompanionGrave(m))return companionStory(m);
  const first=JOBS.find(j=>j.id===m.character.job)?.name,race=RACES.find(r=>r.id===m.character.race)?.name||'',parts=[];
  if(m.family?.parents?.length)parts.push(`${m.family.place}에서 ${m.family.parents.map(p=>p.name).join('·')}의 아이로 자랐습니다.`);
  else if(first)parts.push(`${race} ${m.character.name}의 첫 직업은 ${first}${(first.charCodeAt(first.length-1)-0xac00)%28?'이었습니다':'였습니다'}.`);
  else parts.push('어린 시절의 짧은 발자취가 이곳에 남아 있습니다.');
  if(m.careers.length)parts.push(`${lifeRole(m)}의 삶을 살며 마을에 발자취를 남겼습니다.`);
  else if(m.stats.trips)parts.push(`${m.stats.trips}번의 원정에서 던전 ${m.outcome.floor||0}층까지 걸어갔습니다.`);
  const honor=HONORS.find(h=>m.honors.includes(h.id));
  const event=full?.log?.filter(l=>!l.text.startsWith('선택:')&&/살려준|구조대를 이끌|검역소를 조직|전쟁|피난|계승|용광로|정복했습니다/.test(l.text)&&!l.text.includes('사망')).at(-1);
  if(honor)parts.push(`마을에는 ‘${honor.name}’의 이름이 남았습니다.`);if(Array.isArray(m.reunions)&&m.reunions.length)parts.push(m.reunions.at(-1));else if(!honor&&event)parts.push(event.text);
  if(m.relationships?.length){const p=[...m.relationships].sort((a,b)=>b.meetings-a.meetings||Math.abs(b.score)-Math.abs(a.score))[0];parts.push(`${p.role} ${p.name} — ${p.meetings}번의 만남 끝에 ${relationLabel(p.score)}의 인연으로 기억됩니다.${p.fate?` 동행의 그 후: ${conditionLabel(p)}. ${p.fate.cause}`:''}`);}
  parts.push(`${ageLabel(m)}에 생을 마쳤습니다. ${m.outcome.cause||''}`);
  return parts.join(' ');
}
