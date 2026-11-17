import { RACES, JOBS, TRAITS } from './engine.js';
import { PEOPLE, relationshipSummaries, relationLabel, conditionLabel } from './relationships.js';
import { isCompanionGrave, validCompanionGrave, companionGraves, mergeSharedEvents, companionText } from './companion-graves.js';
import { makeRemembrance, validRemembrance, decorateRemembranceTomb, visitText, remembranceVisits } from './grave-visits.js';
import { npcAppearance } from './npc-appearance.js';

export const MEMORIAL_KEY='dungeon-chronicle.memorials.v1';
const careers={inn:'여관주인',guild:'길드 직원',trader:'상인',smith:'장인'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number.isFinite(v)?Math.max(0,v):0;
const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export const HONORS=Object.freeze([
  {id:'three',name:'세 미궁의 정복자',detail:'이끼 광산·속삭이는 묘지·별잠긴 유적을 모두 정복',ornament:'crown'},
  {id:'star',name:'별을 깨운 자',detail:'별잠긴 유적을 정복하고 별의 심장을 획득',ornament:'star'},
  {id:'master',name:'미궁의 명장',detail:'장인 경험 · 거수의 광석 활용 · 새 용광로 · 평판 80 이상',ornament:'anvil'},
  {id:'guardian',name:'마을의 등불',detail:'고블린 구조와 후속 인연 · 검역소 조직 · 평판 90 이상',ornament:'lantern'},
  {id:'fortune',name:'황금 거래의 전설',detail:'상인 경험 · 물약 공급 신뢰 · 생전 소지금 2,000 G 이상',ornament:'coins'}
]);

export function earnedHonors(s){
  const w=s.world||{},flags=w.flags||{},items=s.inventory||[],cleared=w.cleared||[],jobs=w.careerHistory||[];
  const earned={three:['mine','crypt','ruins'].every(id=>cleared.includes(id)),star:cleared.includes('ruins')&&items.includes('별의 심장'),master:jobs.includes('smith')&&flags.oreUsed&&flags.smithFurnace&&number(w.reputation)>=80,guardian:flags.friendVisited&&flags.healthNetwork&&number(w.reputation)>=90,fortune:jobs.includes('trader')&&flags.traderTrusted&&number(s.gold)>=2000};
  return HONORS.filter(h=>earned[h.id]).map(h=>h.id);
}
export function toMemorial(s){
  if(!s?.character||!s?.outcome||s.outcome.type!=='death'||typeof s.id!=='string')return null;
  const w=s.world||{};
  return {version:1,id:s.id,character:{name:String(s.character.name||'이름 없는 이'),race:s.character.race,job:s.character.job,traits:[...(s.character.traits||[])]},outcome:structuredClone(s.outcome),stats:{kills:number(s.kills),rooms:number(s.roomsExplored),trips:number(w.trips),gold:number(s.gold),reputation:number(w.reputation),months:number(w.totalDays)},career:w.career||null,careers:[...(w.careerHistory||[])],cleared:[...(w.cleared||[])],honors:earnedHonors(s),reunions:Array.isArray(w.bonds?.memories)?w.bonds.memories.slice(-4):[],relationships:relationshipSummaries(s),family:s.life?.family?structuredClone(s.life.family):null,remembrance:makeRemembrance(s)};
}
function valid(m){if(isCompanionGrave(m))return validCompanionGrave(m);return m?.version===1&&typeof m.id==='string'&&typeof m.character?.name==='string'&&RACES.some(r=>r.id===m.character.race)&&m.outcome?.type==='death'&&Array.isArray(m.character.traits)&&Array.isArray(m.honors)&&m.stats&&Array.isArray(m.careers)&&validRemembrance(m.remembrance,m.relationships);}
export function mergeMemorials(saved=[],states=[]){
  const records=new Map();for(const m of Array.isArray(saved)?saved:[])if(valid(m))records.set(m.id,structuredClone(m));
  const addCompanions=(s,missingOnly=false)=>{for(const m of companionGraves(s)){const old=records.get(m.id);if(old&&missingOnly)continue;records.set(m.id,old?{...m,outcome:{...m.outcome,at:old.outcome.at||m.outcome.at},sharedEvents:mergeSharedEvents(old.sharedEvents,m.sharedEvents)}:m);}};
  for(const s of states){const m=toMemorial(s);if(m&&valid(m)){const old=records.get(m.id);if(old?.remembrance)m.remembrance=structuredClone(old.remembrance);records.set(m.id,m);}}
  for(const s of states)addCompanions(s);
  // Recover old deaths even when their owner's full log has expired.
  for(const m of [...records.values()])if(!isCompanionGrave(m))addCompanions(m,true);
  for(const m of records.values()){
    if(isCompanionGrave(m)){m.appearance??=npcAppearance(m.owner.id,m.group,{name:m.character.name});continue;}
    if(!m.remembrance)m.remembrance=makeRemembrance(m);
    const visits=remembranceVisits(m);
    for(const p of m.relationships||[]){const group=Object.keys(PEOPLE).find(k=>PEOPLE[k].role===p.role),saved=visits.find(v=>v.name===p.name&&v.role===p.role&&v.appearance);if(group)p.appearance??=npcAppearance(m.id,group,{...p,appearance:saved?.appearance});}
    for(const v of visits){const p=m.relationships?.find(p=>p.role===v.role&&p.name===v.name);v.appearance??=npcAppearance(m.id,v.group,p||v);}
  }
  return [...records.values()].sort((a,b)=>String(b.outcome.at||'').localeCompare(String(a.outcome.at||''))||Number(isCompanionGrave(a))-Number(isCompanionGrave(b))||a.id.localeCompare(b.id));
}
export function lifeRole(m){if(isCompanionGrave(m))return m.role;return careers[m.career]||careers[m.careers?.at(-1)]||(m.character.job==='child'?'어린 시절':JOBS.find(j=>j.id===m.character.job)?.name)||'모험가';}
export function ageLabel(m){if(isCompanionGrave(m))return '기억 속 인연';const o=m.outcome;return Number.isInteger(o.ageYears)?`${o.ageYears}세${o.ageMonths?` ${o.ageMonths}개월`:''}`:'나이 미상';}
export function epitaph(m){
  if(isCompanionGrave(m))return `${m.owner.name}의 길에 함께했던 사람`;
  if(m.character.job==='child')return '아직 쓰이지 않은 내일을 품고';
  if(m.honors.includes('three'))return '세 미궁 너머까지 발자취를 남기다';
  if(m.honors.includes('star'))return '어둠 속에서 별 하나를 깨우다';
  return ({inn:'돌아오는 이들을 위해 불을 밝히다',guild:'누군가의 귀환을 끝까지 기다리다',trader:'먼 길의 물건과 소식을 나누다',smith:'남은 이들의 손에 도구를 남기다'})[m.career||m.careers?.at(-1)]||'자신의 길을 걸었던 한 사람';
}

const glyphs={
  warrior:'M6 0h2v10H6zM2 7h10v2H2zM5 10h4v3H5z',rogue:'M8 0h4L5 9H2zM2 8h3v5H2z',mage:'M5 0h3v3h3v3H8v7H5V6H2V3h3z',priest:'M5 0h3v4h4v3H8v6H5V7H1V4h4z',porter:'M3 3V0h7v3h2v10H1V3zM5 2v3h3V2z',child:'M5 1h3v3h3v3H8v3H5V7H2V4h3z',inn:'M2 2h8v9H2zM10 4h3v5h-3zM4 0h4v2H4z',guild:'M1 0h10v13H1zM3 3h6v2H3zM3 7h4v2H3z',trader:'M1 3h11v8H1zM3 0h7v3H3zM5 5h3v4H5z',smith:'M1 3h11v3H8v4h3v3H2v-3h3V6H1z',
  greedy:'M1 2h7v7H1zM3 0h3v11H3z',coward:'M0 0h8v5L4 9 0 5z',unlucky:'M0 0h3v3h3v3h3v3H6V6H3V3H0z',lost:'M0 0h8v3H3v3h5v3H0z',frail:'M2 0h5v3H4v2h3v3H2V5H0V3h2z',regen:'M3 0h3v3h3v3H6v3H3V6H0V3h3z',lucky:'M1 0h3v3H1zM5 0h3v3H5zM1 5h3v3H1zM5 5h3v3H5z',brave:'M4 0h2v2h2v6H1V4h3z',sharp:'M0 3h3V1h3v2h3v3H6v2H3V6H0z',blessed:'M3 0h3v3h3v3H6v3H3V6H0V3h3z'
};
const ornaments={crown:'M13 19v-8l6 5 7-9 6 9 7-9 7 9 6-5v8z',star:'M30 3h4v6h6v4h-6v6h-4v-6h-6V9h6z',anvil:'M21 9h22v5H35v5h7v4H22v-4h7v-5h-8z',lantern:'M28 6h8v4h4v15H24V10h4zM30 0h4v6h-4z',coins:'M19 8h13v7H19zM32 14h13v7H32zM21 22h13v5H21z'};
const palette={human:['#8296a5','#485c6c','#bed0d8'],elf:['#8daca1','#456d62','#c4d8c2'],dwarf:['#a6957a','#645542','#d7c5a0'],goblin:['#879c75','#50633f','#c5d19e'],undead:['#9b99af','#5d5775','#dbd6e4']};
export function tombDesign(m){
  const n=hash(JSON.stringify([m.id,m.character,m.career,m.careers,m.outcome.ageYears,m.stats,m.honors]));
  const age=m.outcome.ageYears,young=m.character.job==='child',honors=HONORS.filter(h=>m.honors.includes(h.id));
  return {variant:n,young,weathered:Number.isInteger(age)&&age>=75,role:m.career||m.careers.at(-1)||m.character.job,ornament:honors[0]?.ornament||null,material:palette[m.character.race]||palette.human,traits:m.character.traits.slice(0,2),height:young?47:58+n%5};
}
export function tombMarkup(m){
  if(isCompanionGrave(m))return companionTombMarkup(m);
  return decorateRemembranceTomb(protagonistTombMarkup(m),m);
}
function protagonistTombMarkup(m){
  const d=tombDesign(m),[stone,shade,light]=d.material,top=76-d.height,n=d.variant;
  const cap=({human:`M20 ${top+6}v-4h5v-3h14v3h5v4z`,elf:`M16 ${top+7}l16-10 16 10z`,dwarf:`M17 ${top}h30v7H17z`,goblin:`M18 ${top+6}v-5h18v-3h10v8z`,undead:`M19 ${top+6}v-4h6v-5h14v5h6v4z`})[m.character.race];
  const ornament=ornaments[d.ornament];
  const p=(path,x,y,color,scale=1)=>path?`<path d="${path}" fill="${color}" transform="translate(${x} ${y}) scale(${scale})" fill-rule="evenodd"/>`:'';
  return `<svg class="tomb-art ${d.ornament?'honored':''}" viewBox="0 0 64 96" role="img" aria-label="${esc(m.character.name)}의 ${esc(lifeRole(m))} 묘비" shape-rendering="crispEdges"><ellipse cx="32" cy="86" rx="29" ry="4" fill="#091520"/><path d="M12 81h40v5H12z" fill="${shade}"/><path d="M17 ${top+6}h30v${76-top-6}H17z" fill="${shade}"/><path d="M20 ${top+6}h24v${76-top-6}H20z" fill="${stone}"/><path d="${cap}" fill="${stone}"/><path d="M21 ${top+8}h2v${59-top}h-2zM24 ${top+8}h17v2H24z" fill="${light}" opacity=".55"/>${p(glyphs[d.role],26,top+13,shade)}<path d="M25 ${top+40}h14v1H25z" fill="${shade}"/>${d.role!==m.character.job?p(glyphs[m.character.job],29,top+31,shade,.55):''}${d.traits.map((id,i)=>p(glyphs[id],22+i*13,65,id==='blessed'||id==='lucky'?'#e7c582':id==='regen'?'#b6d3b5':light,.65)).join('')}${d.weathered?`<path d="M${36+n%5} ${top+7}v10h-3v7h3v6" stroke="${shade}" stroke-width="1" fill="none"/>`:''}<path d="M${12+n%5} 79h5v-4h2v8h-7zM43 80h${4+n%4}v3h-4z" fill="${m.character.traits.includes('regen')?'#87b68c':'#5e7966'}"/>${d.young?'<path d="M9 73h2v10H9zM7 69h6v4H7z" fill="#cfb7ba"/>':''}${p(ornament,0,0,'#e0c382')}${d.ornament?'<path d="M17 29v51h-3V29zM47 29v51h3V29z" fill="#c4a264"/>':''}<path d="M${22+n%13} 77h3v2h-3z" fill="${light}" opacity=".7"/></svg>`;
}
export function memorialText(m){
  if(isCompanionGrave(m))return companionText(m);
  return [protagonistText(m),...visitText(m)].join('\n');
}
function protagonistText(m){
  return [`${m.character.name}의 생애`,`${RACES.find(r=>r.id===m.character.race)?.name||''} · ${lifeRole(m)} · ${ageLabel(m)}`,`사망: ${m.outcome.location||'장소 미상'} · ${m.outcome.cause||'원인 미상'}`,`특성: ${m.character.traits.map(id=>TRAITS.find(t=>t.id===id)?.name||id).join(' / ')}`,`묘비명: ${epitaph(m)}`,`생전 소지금 ${m.stats.gold} G · 평판 ${m.stats.reputation} · 탐험 ${m.stats.trips}회 · 처치 ${m.stats.kills}회`,...(Array.isArray(m.relationships)?m.relationships:[]).map(p=>`이름으로 남은 인연: ${p.role} ${p.name} · ${relationLabel(p.score)} · ${p.meetings}번 만남 · ${conditionLabel(p)}${p.fate?` · 동행의 기억: ${p.fate.location} · ${p.fate.cause}`:''}`),...(Array.isArray(m.reunions)?m.reunions:[]).map(text=>`다시 만난 인연: ${text}`),...HONORS.filter(h=>m.honors.includes(h.id)).map(h=>`업적: ${h.name} — ${h.detail}`)].join('\n');
}
export function engravingGlyph(id){
  if(id==='crack')return '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M10 1v5H6v5h4v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const path=glyphs[id]||ornaments[id]||({flower:'M5 1h4v4h4v4H9v6H5V9H1V5h4z',stone:'M3 3h10v11H3zM5 1h6v2H5z'})[id];
  return `<svg viewBox="${ornaments[id]?'8 0 48 32':'0 0 16 16'}" aria-hidden="true" shape-rendering="crispEdges"><path d="${path||glyphs.child}" fill="currentColor" fill-rule="evenodd"/></svg>`;
}
export function engravingLegend(m){
  if(isCompanionGrave(m))return [{icon:companionRoleGlyph(m),label:'중앙 문양',value:m.role,detail:`함께 만났던 ${m.role}의 일을 새겼습니다.`},{icon:'flower',label:'작은 꽃',value:`${m.owner.name}의 인연`,detail:'함께 겪었던 일과 마지막 동행을 기억하는 꽃입니다.'}];
  const d=tombDesign(m),race=RACES.find(r=>r.id===m.character.race)?.name||'',job=JOBS.find(j=>j.id===m.character.job)?.name||'어린 시절';
  const items=[{icon:'race',label:'돌의 윤곽과 색',value:race,detail:`${race} 종족에 맞춘 돌의 윤곽과 색입니다.`},{icon:d.role,label:'중앙 문양',value:lifeRole(m),detail:`중앙 문양은 ${lifeRole(m)}의 삶을 뜻합니다.${d.role===m.character.job?' 첫 직업의 문양도 함께 나타냅니다.':''}`}];
  if(d.role!==m.character.job)items.push({icon:m.character.job,label:'아래 문양',value:job,detail:`아래 작은 문양은 첫 직업 ${job}을 뜻합니다.`});
  for(const [index,id] of d.traits.entries()){const trait=TRAITS.find(t=>t.id===id);items.push({icon:id,label:`특성 ${index+1}`,value:trait?.name||id,detail:`아래의 ${index+1}번째 표식은 ${trait?.name||id}입니다. ${trait?.tip||''}`});}
  items.push({icon:d.young?'flower':d.weathered?'crack':'stone',label:d.young?'꽃':d.weathered?'돌의 균열':'돌의 흔적',value:ageLabel(m),detail:d.young?'어린 시절에 끝난 삶을 작은 꽃으로 기억합니다.':d.weathered?'75세 이상을 살아온 흔적이 돌의 균열로 남았습니다.':'사망 나이와 이 사람의 삶이 돌의 크기와 작은 흔적에 반영됩니다.'});
  const honor=HONORS.find(h=>m.honors.includes(h.id));if(honor)items.push({icon:honor.ornament,label:'꼭대기 장식',value:honor.name,detail:honor.detail});
  if(remembranceVisits(m).some(v=>v.flowers))items.push({icon:'flower',label:'돌 앞의 꽃',value:'인연이 남긴 추모',detail:'살아남은 인연이 놓거나 보내온 꽃입니다. 함께 겪었던 일과 방문 이야기가 생애 기록에 남습니다.'});
  return items;
}
const companionRoleGlyph=m=>({miners:'smith',scouts:'rogue',herbalist:'priest',caravan:'trader',families:'inn',records:'guild',debt:'trader'})[m.group];
function companionTombMarkup(m){
  const n=hash(m.id),stone=['#8296a5','#8daca1','#a6957a'][n%3],top=22+n%5;
  return `<svg class="tomb-art companion-tomb" viewBox="0 0 64 96" role="img" aria-label="${esc(m.character.name)}의 인연 묘비" shape-rendering="crispEdges"><ellipse cx="32" cy="86" rx="29" ry="4" fill="#091520"/><path d="M12 81h40v5H12zM17 ${top+4}h30v${77-top}H17z" fill="#485c6c"/><path d="M20 ${top}h24v57H20zM24 ${top-4}h16v4H24z" fill="${stone}"/><path d="M22 ${top+3}h2v44h-2zM24 ${top+3}h16v2H24z" fill="#bed0d8" opacity=".6"/><path d="${glyphs[companionRoleGlyph(m)]}" fill="#3a515d" transform="translate(26 ${top+13})" fill-rule="evenodd"/><path d="M25 64h14v1H25zM27 69h10v1H27z" fill="#485c6c"/><path d="M45 75h2v9h-2zM42 78h3v2h-3z" fill="#87a58b"/><path d="M43 71h6v5h-6zM41 73h10v2H41z" fill="#d6b7b0"/><path d="M45 73h2v2h-2z" fill="#e1c783"/></svg>`;
}
