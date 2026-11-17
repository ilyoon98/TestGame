import { RACES } from './engine.js';

export const NPC_OUTFITS=Object.freeze({miners:'porter',scouts:'rogue',herbalist:'priest',caravan:'trader',families:'inn',records:'guild',debt:'trader'});
const pools={miners:['dwarf','dwarf','human','goblin','elf','undead'],scouts:['elf','human','goblin','dwarf','undead'],herbalist:['elf','human','goblin','dwarf','undead'],caravan:['goblin'],families:['human','elf','dwarf','goblin','undead'],records:['human','elf','undead','dwarf','goblin'],debt:['human','goblin','undead','elf','dwarf']};
const hash=text=>{let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function validNpcAppearance(a,group){return a?.version===1&&RACES.some(r=>r.id===a.race)&&Object.values(NPC_OUTFITS).includes(a.job)&&(!group||a.job===NPC_OUTFITS[group]&&(group!=='caravan'||a.race==='goblin'));}
export const optionalNpcAppearance=(a,group)=>a===undefined||validNpcAppearance(a,group);
export const sameNpcAppearance=(a,b)=>!!a&&!!b&&a.version===b.version&&a.race===b.race&&a.job===b.job;
export function npcAppearance(lifeId,group,person={}){
  if(validNpcAppearance(person.appearance,group))return structuredClone(person.appearance);
  const pool=pools[group]||['human'];
  return {version:1,race:pool[hash(`${lifeId}:${group}:${person.name||''}:appearance`)%pool.length],job:NPC_OUTFITS[group]||'porter'};
}
export const npcAppearanceLabel=(a,role='')=>`${RACES.find(r=>r.id===a?.race)?.name||'알 수 없는 종족'}${role?` · ${role}`:''}`;
