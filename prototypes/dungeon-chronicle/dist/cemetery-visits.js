// Presentation only: playing a farewell never writes to a life or memorial.
import { npcAppearance, NPC_OUTFITS } from './npc-appearance.js';
export const VISIT_TIMING=Object.freeze({speed:96,offer:1.25,place:.6,linger:4.8,gap:1.2});
export const visitorOutfit=v=>v.action==='letter'?'porter':v.appearance?.job||NPC_OUTFITS[v.group]||'porter';
export const visitorAppearance=(v,lifeId)=>v.action==='letter'?{version:1,race:'human',job:'porter'}:npcAppearance(lifeId,v.group,v);
export const visitorName=v=>v.action==='letter'?`${v.name}의 꽃을 전하는 이`:`${v.role} ${v.name}`;
export function visitPhaseLabel(s){return ({arriving:'묘비로 걸어오는 중',offering:s.visit?.flowers?'꽃을 내려놓는 중':'고개 숙여 인사하는 중',remembering:'잠시 곁에 머무는 중',leaving:'인사를 마치고 돌아가는 중',gap:'다음 추모의 기억',complete:'추모의 방문을 모두 보았습니다'})[s.phase]||'';}
export function bouquetMarkup(index=0){
  const colors=['#d7bcc7','#e1cd93','#b9cee0'],color=colors[Math.abs(Math.trunc(index))%3]||colors[0];
  return `<svg viewBox="0 0 16 22" aria-hidden="true" shape-rendering="crispEdges"><path d="M7 6h2v14H7zM3 12h5v2H3zM8 15h5v2H8z" fill="#86a57d"/><path d="M4 2h8v6H4zM2 4h12v3H2zM6 0h4v10H6z" fill="${color}"/><path d="M6 3h4v3H6z" fill="#e7ce8d"/><path d="M5 17h6v2H5z" fill="#bf9e76"/></svg>`;
}
export class CemeteryVisitScene{
  constructor(visits,centerX,width,{reducedMotion=false}={}){
    this.visits=structuredClone(visits);this.centerX=centerX;this.width=Math.max(160,width);this.reducedMotion=reducedMotion;
    const clamp=x=>Math.max(40,Math.min(this.width-40,x));
    this.targetX=clamp(centerX-64);this.startX=clamp(centerX-232);
    if(this.targetX-this.startX<60){this.targetX=clamp(centerX+64);this.startX=clamp(centerX+232);}
    this.restart();
  }
  restart(){this.index=0;this.elapsed=0;this.placed=new Map();this.phase=this.visits.length?(this.reducedMotion?'offering':'arriving'):'complete';this.x=this.reducedMotion?this.targetX:this.startX;this.facing=Math.sign(this.targetX-this.startX)||1;return this.snapshot();}
  change(phase){this.phase=phase;this.elapsed=0;}
  walkTo(target,dt){const distance=target-this.x,travel=VISIT_TIMING.speed*dt;this.facing=Math.sign(distance)||this.facing;if(Math.abs(distance)<=travel){this.x=target;return true;}this.x+=Math.sign(distance)*travel;return false;}
  step(seconds,{paused=false}={}){
    const dt=Number.isFinite(seconds)?Math.max(0,Math.min(.05,seconds)):0;
    if(paused||!dt||this.phase==='complete')return this.snapshot();
    const visit=this.visits[this.index];this.elapsed+=dt;
    if(this.phase==='arriving'){if(this.walkTo(this.targetX,dt))this.change('offering');}
    else if(this.phase==='offering'){
      if(visit.flowers&&this.elapsed>=VISIT_TIMING.place)this.placed.set(visit.id,visit);
      if(this.elapsed>=VISIT_TIMING.offer)this.change('remembering');
    }else if(this.phase==='remembering'){if(this.elapsed>=VISIT_TIMING.linger)this.change(this.reducedMotion?'gap':'leaving');}
    else if(this.phase==='leaving'){if(this.walkTo(this.startX,dt))this.change('gap');}
    else if(this.phase==='gap'&&this.elapsed>=VISIT_TIMING.gap){
      if(++this.index>=this.visits.length)this.change('complete');
      else{this.x=this.reducedMotion?this.targetX:this.startX;this.facing=Math.sign(this.targetX-this.startX)||1;this.change(this.reducedMotion?'offering':'arriving');}
    }
    return this.snapshot();
  }
  snapshot(){
    const visit=this.visits[Math.min(this.index,this.visits.length-1)]||null,walking=this.phase==='arriving'||this.phase==='leaving';
    return {visit,index:this.index,phase:this.phase,x:this.x,facing:this.facing,walking,bowing:this.phase==='offering',carrying:!!visit?.flowers&&['arriving','offering'].includes(this.phase)&&!this.placed.has(visit.id),visible:!!visit&&!['gap','complete'].includes(this.phase),complete:this.phase==='complete',flowers:[...this.placed.values()]};
  }
}
