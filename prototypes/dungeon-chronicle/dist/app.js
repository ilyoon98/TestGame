import { RACES, JOBS, TRAITS, RACE_DETAILS } from './engine.js';
import { Fantasy as Dungeon, CAREERS, DUNGEONS } from './world.js';
import { pixelIcon, spriteMarkup } from './visuals.js';
import { AutoChoiceCountdown } from './countdown.js';
import { createTooltips } from './tooltips.js';
import { automaticPreference } from './preferences.js';
import { MEMORIAL_KEY, HONORS, toMemorial, mergeMemorials, lifeRole, ageLabel, epitaph, tombMarkup, memorialText, engravingGlyph, engravingLegend } from './memorial.js';
import { cemeteryLayout, mapPercent, searchMemorials } from './cemetery-map.js';
import { CemeteryWalker, nearbyGrave, memorialStory } from './cemetery-walker.js';
import { exportRecords, importRecords } from './record-backup.js';
import { playbackBlocked } from './playback.js';
import { knownPeople, relationLabel, conditionLabel, choicePerson } from './relationships.js';
import { isCompanionGrave, sharedEventLabel } from './companion-graves.js';
import { remembranceVisits, visitWhen } from './grave-visits.js';
import { CemeteryVisitScene, visitorAppearance, visitorName, visitPhaseLabel, bouquetMarkup } from './cemetery-visits.js';
import { npcAppearance, npcAppearanceLabel } from './npc-appearance.js';

const $ = id => document.getElementById(id);
const SESSION_KEY='dungeon-chronicle.session.v1', HISTORY_KEY='dungeon-chronicle.history.v1';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let game, paused=false, speed=1, automatic=true, timer=null, choiceTimer=null, renderedLogs=0, actionKey='', autoFollow=true;
let creating=false, creationToken=0, choiceRenderKey='', dismissedChoice=null, visualKey='';
let history=[],memorials=[],resultPresented=null,resultRecord=null;let creationResolve=null,creationTicker=null,creationHeld=false,creationMode='birth';const tooltips=createTooltips(document);
let syncedMemorialKey='';
let cemeteryOpen=false,cemeteryWasPaused=true,cemeteryScroll=0,mapDrag=null,suppressMapClick=false;
let cemeteryWalker=null,walkingFrame=null,walkingTime=0,nearbyId=null,walkingPlots=[],heldWalkKeys=new Set(),heldWalkButton=null;
const visitScenes=new Map();let activeVisitScene=null,activeVisitPlot=null,activeVisitStone=null,visitorRenderKey='',tributeRenderKey='',flowerRenderKey='',scenePaintKey='';
const creationCountdown=new AutoChoiceCountdown();
const countdown=new AutoChoiceCountdown();let countdownTicker=null;
try{const stored=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(Array.isArray(stored))history=stored.filter(x=>x?.outcome && x?.character && Array.isArray(x.log)).slice(0,20);}catch{}
try{memorials=mergeMemorials(JSON.parse(localStorage.getItem(MEMORIAL_KEY)||'[]'),history);}catch{memorials=mergeMemorials([],history);}
persistMemorials();
try{
  const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
  if(saved){game=Dungeon.restore(saved.state);speed=[1,2,4,8].includes(saved.speed)?saved.speed:1;automatic=automaticPreference(saved);paused=game.s.status==='running';}
}catch{}
if(!game)game=new Dungeon(seed());

function save(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({state:game.s,speed,automatic,paused,autoModeVersion:1}));}catch{}}
function persistMemorials(){try{localStorage.setItem(MEMORIAL_KEY,JSON.stringify(memorials));}catch{}}
function syncCompanionGraves(){
  const key=`${game.s.id}:${game.s.log.length}`;if(key===syncedMemorialKey)return;syncedMemorialKey=key;
  if(!Object.values(game.s.world?.bonds?.people||{}).some(p=>p.fate?.state==='dead'))return;
  memorials=mergeMemorials(memorials,[game.s]);persistMemorials();$('historyCount').textContent=memorials.length;
}
function archive(){syncCompanionGraves();if(game.s.status!=='ended')return;const old=history.find(x=>x.id===game.s.id);if(old&&old.log.length===game.s.log.length&&old.outcome.at===game.s.outcome.at)return;history=history.filter(x=>x.id!==game.s.id);history.unshift(structuredClone(game.s));history=history.slice(0,20);memorials=mergeMemorials(memorials,[game.s]);persistMemorials();try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch{}$('historyCount').textContent=memorials.length;}
function floorLabel(f){return f===0?'입구':`${f}층`;}
function logLabel(log){return log.location||floorLabel(log.floor);}
const recordAge=o=>Number.isInteger(o?.ageYears)?`${o.ageYears}세${o.ageMonths?` ${o.ageMonths}개월`:''}`:'나이 기록 없음';
const outcomeLabel=type=>({death:'이야기 종료',return:'무사 귀환',clear:'던전 정복',story:'이야기 완결'}[type]||'이야기 종료');
function changePath(){if(!game.requestChange())return;paused=false;dismissedChoice=null;actionKey='';render();save();schedule();}
function clearTimers(){clearTimeout(timer);clearTimeout(choiceTimer);clearInterval(countdownTicker);timer=choiceTimer=countdownTicker=null;countdown.cancel();}
function blocked(){return playbackBlocked({hidden:document.hidden,guide:$('guideDialog').open,result:$('resultDialog').open,cemetery:cemeteryOpen});}
function schedule(){
  clearTimeout(timer);timer=null;
  if(blocked()){clearTimeout(choiceTimer);clearInterval(countdownTicker);choiceTimer=countdownTicker=null;countdown.pause();renderCountdown();return;}
  if(game.s.status==='running'&&!paused&&!creating&&game.life?.jobRevealPending){revealAdultJob();return;}
  if(game.s.status==='running' && !paused && !creating)timer=setTimeout(tick,1450/speed);
  syncCountdown();
}
function syncCountdown(){
  clearTimeout(choiceTimer);clearInterval(countdownTicker);choiceTimer=countdownTicker=null;
  if(game.s.status!=='choice'||!automatic||creating){countdown.cancel();renderCountdown();return;}
  const key=`${game.s.id}-${game.s.choice.id}`;
  if(countdown.key!==key)countdown.start(key,game.autoChoice());
  if(paused)countdown.pause();else countdown.resume();
  renderCountdown();if(paused)return;
  choiceTimer=setTimeout(()=>{
    const c=countdown.snapshot();
    if(c.key===key&&automatic&&!paused&&game.s.status==='choice'&&`${game.s.id}-${game.s.choice.id}`===key){if(c.expired)selectChoice(c.target);else syncCountdown();}
  },Math.ceil(countdown.snapshot().remaining));
  countdownTicker=setInterval(renderCountdown,50);
}
function renderCountdown(){
  const c=countdown.snapshot(),active=automatic&&game.s.status==='choice'&&c.key!==null;
  for(const prefix of ['popup','inline']){
    const block=$(`${prefix}Countdown`);block.hidden=!active;if(!active)continue;
    $(`${prefix}AutoSeconds`).textContent=c.paused?'자동 선택 일시정지':`${(c.remaining/1000).toFixed(1)}초 후 자동 선택`;
    const progress=$(`${prefix}AutoProgress`);progress.max=c.duration;progress.value=c.remaining;progress.setAttribute('aria-valuetext',`${Math.ceil(c.remaining/1000)}초 남음`);
    $(`${prefix}AutoLabel`).textContent=`예정: ${game.s.choice.options.find(o=>o.id===c.target)?.label||''}`;
  }
  const select=$('autoChoiceTarget');
  if(active){if(select.dataset.choice!==c.key){select.dataset.choice=c.key;select.replaceChildren(...game.s.choice.options.filter(o=>!o.disabled).map(o=>Object.assign(document.createElement('option'),{value:o.id,textContent:o.label})));}select.value=c.target;}
  $('popupChoices').querySelectorAll('[data-choice]').forEach(b=>b.classList.toggle('auto-scheduled',active&&b.dataset.choice===c.target));
}
function cancelAutomatic(){automatic=false;actionKey='';clearTimeout(choiceTimer);clearInterval(countdownTicker);choiceTimer=countdownTicker=null;countdown.cancel();render();save();schedule();}
function tick(){if(paused || blocked() || game.s.status!=='running')return;game.step();render();save();schedule();}
function startNew(){beginCreation();}
function selectChoice(id){if(!game.choose(id))return;paused=false;dismissedChoice=null;if($('choiceDialog').open)$('choiceDialog').close();render();save();schedule();}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function drawLabel(element,item){element.innerHTML=`${pixelIcon(item.id)}<span>${item.name}</span>`;}
function traitMarkup(id){const t=TRAITS.find(x=>x.id===id);return `<button type="button" class="trait ${t.negative?'negative':''}" data-tooltip="${esc(t.tip)}" data-tooltip-name="${esc(t.name)}" data-tooltip-negative="${!!t.negative}" aria-label="${esc(t.name)}">${pixelIcon(t.id)}${t.name}</button>`;}
function drawTraitChips(ids){tooltips.hide();$('drawTraits').innerHTML=ids.map(traitMarkup).join('');}
function jobEffect(job){return [[job.hp,'최대 체력'],[job.power,'전투력'],[job.scout,'탐색력'],[job.luck,'행운']].filter(([v])=>v).map(([v,label])=>`${label} ${v>0?'+':''}${v}`).join(' · ');}
function addCreationEffect(item,label,text,detail=''){
  const row=document.createElement('li');row.innerHTML=`<span>${pixelIcon(item.id)}</span><div><small>${label}</small><strong>${esc(item.name)}</strong><p>${esc(text)}</p>${detail?`<p class="effect-secondary">${esc(detail)}</p>`:''}</div>`;
  $('creationEffects').querySelectorAll('.latest').forEach(x=>x.classList.remove('latest'));row.classList.add('latest');$('creationEffects').append(row);
  $('creationEffects').scrollTop=$('creationEffects').scrollHeight;
}
function renderCreationCountdown(){
  const c=creationCountdown.snapshot();
  $('creationSeconds').textContent=c.paused?'설명을 읽는 동안 잠시 멈췄습니다.':'잠시 감상하면 다음 내용이 자동으로 공개됩니다.';
  $('creationPauseButton').textContent=c.paused?'자동 공개 계속':'잠깐 멈추기';
  $('creationPauseButton').setAttribute('aria-pressed',String(c.paused));
}
function waitForAutomaticReveal(token,duration){
  creationCountdown.start(String(token),'automatic-reveal',duration);if(creationHeld||document.hidden)creationCountdown.pause();
  $('creationTiming').hidden=false;renderCreationCountdown();
  return new Promise(resolve=>{
    creationResolve=ok=>{creationResolve=null;clearInterval(creationTicker);creationTicker=null;creationCountdown.cancel();$('creationTiming').hidden=true;resolve(ok&&token===creationToken&&creating);};
    creationTicker=setInterval(()=>{if(token!==creationToken||!creating){creationResolve?.(false);return;}if(creationCountdown.snapshot().expired)creationResolve?.(true);},50);
  });
}
function finishCreation(){
  if(!creating)return;creating=false;creationToken++;if(creationResolve)creationResolve(false);tooltips.hide();$('creationDialog').close();
  if(creationMode==='adult'){game.life.jobRevealPending=false;paused=false;visualKey='';render();save();schedule();return;}
  paused=false;autoFollow=true;renderedLogs=0;actionKey='';visualKey='';choiceRenderKey='';dismissedChoice=null;
  $('logList').replaceChildren();game.start();render();save();schedule();
}
async function rollPhase(pool,element,slot,finalItem,update,token){
  slot.classList.add('rolling');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(let i=0;i<8;i++){
    if(token!==creationToken||!creating)return false;
    const item=pool[Math.floor(Math.random()*pool.length)];drawLabel(element,item);update(item);await delay(65+i*13);
  }
  if(token!==creationToken||!creating)return false;
  drawLabel(element,finalItem);update(finalItem);slot.classList.remove('rolling');slot.classList.add('locked');return true;
}
async function beginCreation(){
  if(creating)return;clearTimers();tooltips.hide();game=new Dungeon(seed());automatic=true;creating=true;creationMode='birth';const token=++creationToken;
  closeRecordDialogs();
  dismissedChoice=null;if($('choiceDialog').open)$('choiceDialog').close();
  $('drawRace').textContent='?';$('drawJob').textContent='성장 후 공개';$('drawJobLabel').textContent='미래의 직업';$('drawTraits').replaceChildren();$('creationEffects').replaceChildren();
  creationHeld=false;$('creationTiming').hidden=true;
  $('raceSlot').className='draw-slot';$('jobSlot').className='draw-slot';$('creationCharacter').innerHTML='<span class="unknown-character">?</span>';
  $('creationStatus').textContent='태어날 종족을 뽑고 있습니다.';$('creationTitle').textContent='어떤 아이가 태어날까?';$('creationDialog').showModal();
  const race=game.race();
  if(!await rollPhase(RACES,$('drawRace'),$('raceSlot'),race,r=>$('creationCharacter').innerHTML=spriteMarkup(r.id),token))return;
  const detail=RACE_DETAILS[race.id];addCreationEffect(race,'1 / 3 · 종족',detail.summary,detail.event);
  $('creationStatus').textContent='종족이 정해졌습니다. 태생 특성은 지금, 직업은 18세에 공개됩니다.';
  if(!await waitForAutomaticReveal(token,5000))return;
  const revealed=[];
  for(let index=0;index<2;index++){
    $('creationStatus').textContent=`${index+1}번째 특성을 뽑고 있습니다.`;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(let i=0;i<7;i++){if(token!==creationToken||!creating)return;drawTraitChips([...revealed,TRAITS[Math.floor(Math.random()*TRAITS.length)].id]);await delay(85+i*20);}
    if(token!==creationToken||!creating)return;const trait=TRAITS.find(t=>t.id===game.character.traits[index]);revealed.push(trait.id);drawTraitChips(revealed);
    addCreationEffect(trait,`${index+2} / 3 · ${index+1}번째 특성`,trait.tip);
    if(index===1)$('creationTitle').textContent=`${game.character.name}, ${game.ageLabel()}`;
    $('creationStatus').textContent=index===0?'첫 특성이 정해졌습니다. 설명을 보여드린 뒤 둘째 특성을 자동 공개합니다.':`${game.familyLabel()}. 잠시 뒤 출생 기록부터 자동으로 시작됩니다.`;
    if(!await waitForAutomaticReveal(token,index===0?6000:6500))return;
  }
  finishCreation();
}
async function revealAdultJob(){
  if(creating)return;clearTimers();tooltips.hide();creating=true;creationMode='adult';creationHeld=false;const token=++creationToken,race=game.race(),job=game.job();
  $('drawRace').textContent='';drawLabel($('drawRace'),race);$('raceSlot').className='draw-slot locked';$('jobSlot').className='draw-slot';$('drawJobLabel').textContent='성장 후 직업';$('drawJob').textContent='?';
  drawTraitChips(game.character.traits);$('creationEffects').replaceChildren();$('creationTiming').hidden=true;
  $('creationTitle').textContent=`${game.character.name}, 18세`;$('creationStatus').textContent='성인이 되었습니다. 처음 배울 직업을 공개합니다.';$('creationCharacter').innerHTML=spriteMarkup(race.id);$('creationDialog').showModal();
  if(!await rollPhase(JOBS,$('drawJob'),$('jobSlot'),job,j=>$('creationCharacter').innerHTML=spriteMarkup(race.id,j.id),token))return;
  addCreationEffect(job,'성장 후 · 첫 직업',jobEffect(job),'출생과 유년기의 기록을 이어서 살아갑니다.');$('creationStatus').textContent='직업이 정해졌습니다. 효과를 읽은 뒤 이야기가 자동으로 이어집니다.';
  if(!await waitForAutomaticReveal(token,6500))return;finishCreation();
}
function goHome(){clearTimers();closeRecordDialogs();if($('choiceDialog').open)$('choiceDialog').close();game=new Dungeon(seed());paused=false;renderedLogs=0;visualKey='';actionKey='';choiceRenderKey='';dismissedChoice=null;$('logList').replaceChildren();render();save();}

function renderMeter(id,value,reference,text){
  const bar=$(id),track=bar.parentElement,percent=Math.max(0,Math.min(100,value/reference*100));
  bar.style.width=`${percent}%`;track.setAttribute('aria-valuenow',String(Math.round(percent)));track.setAttribute('aria-valuetext',text);
}
function renderCharacter(){
  const s=game.s,c=game.character;
  const shownJob=game.displayJob(),key=`${s.id}-${c.race}-${shownJob.id}-${c.traits.join(',')}`;
  if(visualKey!==key){
    visualKey=key;$('raceName').innerHTML=`${pixelIcon(c.race)}<span>${game.race().name}</span>`;$('characterName').textContent=c.name;$('jobName').innerHTML=`${pixelIcon(shownJob.id)}<span>${shownJob.name}</span>`;
    $('portrait').innerHTML=spriteMarkup(c.race,shownJob.id);$('birthJob').textContent=game.world.mode==='life'?`첫 직업 · ${game.job().name}`:'';
    tooltips.hide();$('traits').innerHTML=c.traits.map(traitMarkup).join('');
  }
  $('characterFlavor').textContent=game.race().flavor;
  const raceDetail=RACE_DETAILS[c.race];$('raceAbility').textContent=raceDetail.summary;$('raceEvent').textContent=raceDetail.event;$('raceAbility').dataset.tooltip=raceDetail.detail;$('raceAbility').dataset.tooltipName=game.race().name;
  $('ageValue').textContent=game.ageLabel();$('ageElapsed').textContent=`시작 ${game.s.timeline.startAge}세 · ${game.elapsedLabel()} 경과`;
  $('familySummary').hidden=!game.life;$('familySummary').textContent=game.life?`가족 · ${game.familyLabel()} · ${game.life.family.wealth==='어려움'?'어려운 살림':game.life.family.wealth==='넉넉함'?'넉넉한 살림':'소박한 살림'}`:'';
  $('portrait').classList.toggle('child-portrait',game.world.mode==='childhood');$('portrait').style.setProperty('--growth-scale',game.age().years<6?'.65':game.age().years<12?'.8':'.9');
  $('healthText').textContent=`${s.hp} / ${c.maxHp}`;renderMeter('healthBar',s.hp,c.maxHp,`체력 ${s.hp} / ${c.maxHp}`);
  $('healthBar').closest('.attribute-row').classList.toggle('low',s.hp<c.maxHp*.35);
  $('powerValue').textContent=c.power;$('scoutValue').textContent=c.scout;$('luckValue').textContent=c.luck;
  $('goldValue').textContent=s.gold.toLocaleString('ko-KR');$('potionValue').textContent=s.potions;
  renderMeter('powerBar',c.power,50,`전투력 ${c.power}`);renderMeter('scoutBar',c.scout,30,`탐색력 ${c.scout}`);renderMeter('luckBar',c.luck,25,`행운 ${c.luck}`);
  renderMeter('goldBar',s.gold,500,`소지금 ${s.gold} G`);renderMeter('reputationBar',game.world.reputation,100,`평판 ${game.world.reputation} / 100`);renderMeter('fatigueBar',game.world.fatigue,100,`피로 ${game.world.fatigue} / 100`);
  $('fatigueBar').closest('.attribute-row').classList.toggle('high',game.world.fatigue>=70);
  $('inventory').innerHTML=s.inventory.map(x=>`<li>${esc(x)}</li>`).join('');
  const contacts=knownPeople(game);$('contactBook').hidden=!contacts.length;$('contactCount').textContent=contacts.length;
  const peopleMarkup=contacts.map(p=>`<li><button type="button" class="contact-entry ${p.fate?.state==='dead'?'deceased':p.score>=2?'friendly':p.score<=-2?'strained':''}" data-tooltip-name="${esc(p.role+' '+p.name)}" data-tooltip="${esc(`${npcAppearanceLabel(p.appearance,p.role)} · ${conditionLabel(p)} · ${p.label} · ${p.meetings}번 만남 · 인연 ${p.score>0?'+':''}${p.score}${p.lastChoice?' · 마지막 선택: '+p.lastChoice:''}${p.fate?' · 동행의 기억: '+p.fate.location+' · '+p.fate.cause:''}`)}"><span class="contact-portrait">${spriteMarkup(p.appearance.race,p.appearance.job)}</span><span class="contact-description"><strong>${esc(p.name)}</strong><small>${esc(npcAppearanceLabel(p.appearance,p.role))} · ${p.meetings}번 만남 · ${game.world.companions?.active?.group===p.group?'동행 '+game.world.companions.active.remaining+'구간':esc(conditionLabel(p))}</small></span><em>${esc(p.label)}</em></button></li>`).join('');if($('contactList').innerHTML!==peopleMarkup)$('contactList').innerHTML=peopleMarkup;
  $('characterStatus').textContent=s.status==='ready'?'시작 대기':s.status==='ended'?outcomeLabel(s.outcome.type):game.world.mode==='childhood'?'자라는 중':game.world.mode==='life'?'일하는 중':game.world.mode==='hub'?'마을에 있음':'탐험 중';
  $('reputationValue').textContent=game.world.reputation;$('fatigueValue').textContent=game.world.fatigue;
  const child=game.world.mode==='childhood',inDungeon=game.world.mode==='dungeon';$('depthTitle').textContent=child?'어린 시절':inDungeon?game.dungeon().name:'미궁마을의 삶';$('depthLabel').textContent=child?game.life.family.place:inDungeon?(s.floor>0?`${s.floor}층 · ${s.room}구간`:'입구'):game.world.mode==='life'?`${game.career().place} · ${Math.floor(game.world.day/12)}년째`:'새로운 길';
  $('floorMap').classList.toggle('town-map',!inDungeon);
  $('floorMap').innerHTML=inDungeon?game.floorNames().slice(0,Math.max(s.floor,game.layout()?.visited||0)).map((name,i)=>{const f=i+1,current=f===s.floor;return `<li class="floor-row ${current?'current':f<s.floor?'visited':''}" ${current?'aria-current="step"':''}><span class="floor-node">${f}</span><span class="floor-info"><span title="${name}">${name}</span><span class="room-dots">${current?'탐험 중':'탐험한 층'}</span></span></li>`;}).join('')+'<li class="unknown-depth">? · 아직 닿지 않은 깊이</li>':CAREERS.map(career=>`<li class="town-place ${game.world.mode==='life'&&career.id===game.world.career?'current':''}">${pixelIcon(career.id)}<span>${career.place}</span><small>${game.world.careerHistory.includes(career.id)?'해본 일':'새로운 일'}</small></li>`).join('');
  $('mapFootnote').textContent=inDungeon?'지도에는 지나온 층만 남습니다. 언제든 안전하게 귀환할 수 있습니다.':`${game.world.trips}번의 탐험 · ${game.world.totalDays}개월의 생활 · 정복 ${game.world.cleared.length}/${DUNGEONS.length}`;
  if(child){$('floorMap').innerHTML='<li class="town-place current"><span>출생 → 유년기 → 성장</span></li>';$('mapFootnote').textContent='어린 시절은 자동 진행합니다. 18세에 첫 직업이 정해집니다.';}
}
function renderLogs(){
  const list=$('logList'),win=$('logWindow');
  if(renderedLogs>game.s.log.length){list.replaceChildren();renderedLogs=0;}
  const fragment=document.createDocumentFragment();
  for(const log of game.s.log.slice(renderedLogs)){
    const row=document.createElement('li');row.className=`log-row ${['normal','good','bad','rare','choice','big','note'].includes(log.kind)?log.kind:'normal'}`;
    const floor=document.createElement('span');floor.className=`log-floor ${log.location?'world-location':''}`;floor.textContent=`[${logLabel(log)}]`;
    const text=document.createElement('span');text.className='log-text';text.textContent=log.text;
    const age=document.createElement('span');age.className='log-age';age.textContent=Number.isInteger(log.ageYears)?`${log.ageYears}세`:'';row.append(floor,age,text);fragment.append(row);
  }
  list.append(fragment);renderedLogs=game.s.log.length;
  $('emptyState').hidden=renderedLogs>0;$('logCount').textContent=`${renderedLogs}개의 기록`;
  if(autoFollow)win.scrollTop=win.scrollHeight;
  $('followButton').hidden=autoFollow || renderedLogs<8;
}
function renderAction(){
  const s=game.s,key=`${s.status}-${s.choice?.id??''}-${paused}-${s.outcome?.type??''}`;
  if(key===actionKey && s.status!=='running')return;
  actionKey=key;const area=$('actionArea');
  if(s.status==='ready'){
    area.innerHTML='<div class="start-action"><p class="action-copy">모험가가 당신의 결정을 기다립니다.<small>자유로운 탐험과 생활 · 중요한 순간의 선택</small></p><button class="primary-button" id="startButton">이야기 시작 <span aria-hidden="true">→</span></button></div>';
    $('startButton').addEventListener('click',beginCreation);
  }else if(s.status==='running'){
    area.innerHTML=`<div class="running-action"><div class="running-copy"><span class="progress-symbol" aria-hidden="true">${paused?'Ⅱ':'◇'}</span><p>${paused?'잠시 이야기를 멈췄습니다.':game.world.mode==='childhood'?'가족과 함께 어린 시절을 보냅니다.':game.world.mode==='life'?`${game.career().name}의 생활이 이어집니다.`:game.world.mode==='hub'?'마을에서 다음 길을 준비합니다.':'던전의 이야기가 이어집니다.'}<small>${paused?'계속 진행하면 다음 기록이 이어집니다.':game.world.mode==='childhood'?'직업은 성장 후에 정해집니다.':'중요한 갈림길에서는 멈춰서 선택합니다.'}</small></p></div><span class="tag">${esc(game.world.mode==='childhood'?'유년기':game.world.mode==='life'?game.career().place:game.world.mode==='hub'?'마을':floorLabel(s.floor))}</span></div>`;
  }else if(s.status==='choice'){
    area.innerHTML='<div class="running-action"><div class="running-copy"><span class="progress-symbol" aria-hidden="true">↔</span><p>중요한 갈림길에 도착했습니다.<small>팝업에서 선택하면 모험이 이어집니다.</small></p></div><button id="reopenChoiceButton" class="secondary-button">선택지 보기</button></div>';
    $('reopenChoiceButton').addEventListener('click',()=>{dismissedChoice=null;renderChoice();});
  }else{
    const o=s.outcome,label=outcomeLabel(o.type);
    area.innerHTML=`<span class="result-label">${label}</span><h3 class="result-title">${esc(o.title)}</h3><p class="result-detail">${game.race().name} ${esc(game.character.name)} · ${recordAge(o)}${o.type==='death'?'에 사망':'에 기록 종료'} · 최고 ${o.floor}층 · 생활 ${game.world.totalDays}개월 · 선택 ${s.choicesMade}회</p>${o.type==='death'?`<p class="death-record">${esc(o.location||'')} · ${esc(o.cause||'')}</p>`:''}<div class="result-bottom"><div class="result-stat">남긴 자산 ${o.recoveredGold} G<small>${o.type==='death'?'소지금의 25%를 회수했습니다.':`평판 ${game.world.reputation} · 경험한 생활 직업 ${game.world.careerHistory.length}개`}</small></div><div class="result-actions"><button class="secondary-button" id="downloadButton">기록 저장</button><button class="primary-button" id="newButton">새 운명 뽑기 →</button></div></div>${['return','clear'].includes(o.type)?'<button id="resumeStoryButton" class="secondary-button resume-story">이 캐릭터로 이어 살기</button>':''}<button id="returnHomeButton" class="text-button return-home">홈으로 돌아가기</button>`;
    $('newButton').addEventListener('click',startNew);$('downloadButton').addEventListener('click',downloadLog);
    const review=document.createElement('button');review.id='reviewResultButton';review.className='secondary-button';review.textContent='결과 창 다시 보기';review.addEventListener('click',()=>showResult(s));area.append(review);
    $('returnHomeButton').addEventListener('click',goHome);
    $('resumeStoryButton')?.addEventListener('click',()=>{if(game.resumeStory()){paused=false;render();save();schedule();}});
  }
}
function renderChoice(){
  const s=game.s,d=$('choiceDialog');
  if(s.status!=='choice'){if(d.open)d.close();choiceRenderKey='';return;}
  const ch=s.choice,key=`${s.id}-${ch.id}`;
  if(key!==choiceRenderKey){
    choiceRenderKey=key;dismissedChoice=null;
    $('choiceFloor').textContent=`${game.location()} · ${game.ageLabel()}`;
    $('choiceKind').textContent=(ch.kind==='companion-memory'?'함께 걸었던 기억 · ':ch.kind==='companion-event'?'짧은 동행 · ':ch.kind==='relation-event'?'이름을 기억하는 재회 · ':ch.kind==='bond-event'?'던전에서 이어진 인연 · ':ch.stage===3?'인연의 세 번째 만남 · ':ch.followup?'지난 선택의 결과 · ':'')+(ch.title||({hub:'어떤 삶을 이어갈까',careers:'새로운 일',dungeons:'새로운 던전',review:'앞으로의 삶',leave:'다른 길로',chest:'봉인된 보물',traveler:'어둠 속 만남',stairs:'더 깊은 곳으로',merchant:'수상한 거래',shrine:'성소의 제안',boss:'마지막 결전'}[ch.kind]||'중요한 갈림길'));
    const npc=choicePerson(game,ch),personName=ch.personName||(npc?`${npc.role} ${npc.name}`:'');
    $('choiceRelationship').hidden=!personName;$('choiceRelationship').textContent=personName?`${personName}${npc?` · ${npcAppearanceLabel(npc.appearance)}`:''}${ch.relation?` · ${ch.relation}`:''}${ch.kind==='companion-memory'||!ch.meetings?'':` · ${ch.meetings===1?'첫 만남':ch.meetings+'번째 만남'}`}`:'';
    $('choiceRelationship').classList.toggle('strained',!!ch.relation?.includes('불화'));
    $('choicePrompt').textContent=ch.prompt;$('choiceCharacter').innerHTML=npc?spriteMarkup(npc.appearance.race,npc.appearance.job):spriteMarkup(game.character.race,game.displayJob().id);
    $('choiceCharacter').setAttribute('aria-label',npc?`${npc.role} ${npc.name} · ${npcAppearanceLabel(npc.appearance)}`:game.character.name);
    $('popupChoices').innerHTML=ch.options.map((o,i)=>`<button class="choice-button" data-choice="${o.id}" ${o.disabled?'disabled':''}><span class="choice-number">${i+1}</span><span><strong>${o.icon?pixelIcon(o.icon):''}${esc(o.label)}</strong><small>${esc(o.hint)}</small></span><span class="choice-arrow" aria-hidden="true">→</span></button>`).join('');
    $('popupChoices').querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>selectChoice(b.dataset.choice)));
  }
  $('popupAutoChoice').checked=automatic;$('choiceAutoStatus').textContent=automatic?(paused?'자동 선택도 일시정지 중입니다.':'게이지가 끝나기 전 예약을 바꾸거나 취소할 수 있습니다.'):'선택할 때까지 이야기가 멈춥니다.';
  $('popupChangePath').hidden=!game.canChangePath();
  $('popupChangePath').textContent=game.world.mode==='life'?'이 일을 그만두기':'던전에서 나가기';
  if(dismissedChoice!==key && !d.open&&!blocked())d.showModal();
}
function render(){
  const home=game.s.status==='ready';$('homeScreen').hidden=!home;$('gameScreen').hidden=home;
  $('newLifeButton').hidden=home||creating;
  renderCharacter();renderLogs();renderAction();renderChoice();archive();
  if(game.s.status==='ended'&&resultPresented!==game.s.id){resultPresented=game.s.id;showResult(game.s);}
  const s=game.s,canPause=s.status==='running' || (s.status==='choice' && automatic);
  $('pauseButton').disabled=!canPause;$('pauseButton').textContent=paused?'▶ 계속 진행':'Ⅱ 일시정지';
  $('changePathButton').disabled=!game.canChangePath();
  $('changePathButton').textContent=game.world.mode==='life'?'일을 그만두기':'마을로 나가기';
  const status=s.status==='choice'?'선택 대기':s.status==='ended'?outcomeLabel(s.outcome.type):s.status==='ready'?'시작 대기':paused?'일시정지':game.world.mode==='childhood'?'유년기 자동 진행':game.world.mode==='life'?'자동 생활 중':game.world.mode==='hub'?'마을에서 준비 중':'자동 탐험 중';
  $('runStatus').className=`run-status ${s.status==='choice'?'waiting':s.status==='running'&&!paused?'active':''}`;
  $('runStatus').replaceChildren(Object.assign(document.createElement('i'),{}),document.createTextNode(status));
  $('autoChoice').checked=automatic;
  document.querySelectorAll('[data-speed]').forEach(b=>{const active=Number(b.dataset.speed)===speed;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  $('historyCount').textContent=memorials.length;
}
function downloadLog(){
  const s=game.s,text=[`${game.race().name} ${game.job().name} ${game.character.name}`,`나이: ${game.ageLabel()} · 시작 ${s.timeline.startAge}세`,...(game.life?[`가족: ${game.familyLabel()}`]:[]),...(s.outcome?.type==='death'?[`사망: ${recordAge(s.outcome)} · ${s.outcome.location} · ${s.outcome.cause}`]:[]),`특성: ${game.character.traits.map(id=>TRAITS.find(t=>t.id===id).name).join(' / ')}`,...s.log.map(x=>`[${logLabel(x)}] ${Number.isInteger(x.ageYears)?`[${x.ageYears}세] `:''}${x.text}`)].join('\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`모험록-${game.character.name}-${game.age().years}세.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function closeRecordDialogs(){if($('resultDialog').open)$('resultDialog').close();if(cemeteryOpen)leaveCemetery(false);}
function honorMarkup(m){return HONORS.filter(h=>m.honors.includes(h.id)).map(h=>`<div class="honor-item"><strong>${esc(h.name)}</strong><span>${esc(h.detail)}</span></div>`).join('');}
function engravingMarkup(m){return `<div class="engraving-icons" role="group" aria-label="묘비 표식의 뜻">${engravingLegend(m).map(item=>`<button type="button" class="engraving-icon" data-tooltip-name="${esc(item.label)} · ${esc(item.value)}" data-tooltip="${esc(item.detail)}" aria-label="${esc(item.label)}: ${esc(item.value)}"><span class="engraving-symbol">${item.icon==='race'?pixelIcon(m.character.race):engravingGlyph(item.icon)}</span><span><small>${esc(item.label)}</small><strong>${esc(item.value)}</strong></span></button>`).join('')}</div>`;}
function tributeEntry(v){return `<li><div class="tribute-heading">${v.appearance?`<span class="tribute-person">${spriteMarkup(v.appearance.race,v.appearance.job)}</span>`:`<span class="tribute-symbol" aria-hidden="true">${engravingGlyph(v.flowers?'flower':'stone')}</span>`}<strong>${esc(v.role)} ${esc(v.name)}</strong><small>${v.appearance?esc(npcAppearanceLabel(v.appearance))+' · ':''}${esc(visitWhen(v))} · ${esc(relationLabel(v.score))}</small></div><p>${esc(v.text)}</p><div class="tribute-memory"><small>함께 겪었던 일${Number.isInteger(v.memory.ageYears)?` · 생전 ${v.memory.ageYears}세 때`:''}${v.memory.location?` · ${esc(v.memory.location)}`:''}</small><p>${esc(v.memory.text)}</p></div></li>`;}
function tributeMarkup(m){const visits=remembranceVisits(m);if(!visits.length)return '';return `<section class="grave-visits"><h3>묘비를 찾아온 인연들</h3><p class="memorial-note">마지막 기록 뒤에도, 함께한 사람들의 기억은 이어졌습니다.</p><ol>${visits.slice(0,2).map(tributeEntry).join('')}</ol>${visits.length>2?`<details><summary>다른 추모 기록 ${visits.length-2}개 펼치기</summary><ol>${visits.slice(2).map(tributeEntry).join('')}</ol></details>`:''}</section>`;}
function showResult(record){
  if(cemeteryOpen)stopCemeteryWalking();
  if(isCompanionGrave(record)){showCompanionResult(record);return;}
  $('resultDownload').textContent='생애 기록 저장';
  resultRecord=record;const m=record.version===1&&record.stats?record:toMemorial(record),c=record.character,o=record.outcome,w=record.world||{},death=o.type==='death';
  const career=m?lifeRole(m):CAREERS.find(x=>x.id===w.career)?.name||JOBS.find(x=>x.id===c.job)?.name||'어린 시절';
  $('resultTitle').textContent=death?`${c.name}의 생애가 끝났습니다`:`${c.name}의 이야기 결과`;
  $('resultEyebrow').textContent=death?'한 사람의 삶이 돌에 남습니다':'한 사람이 남긴 발자취';
  const full=Array.isArray(record.log)?record:history.find(x=>x.id===record.id);
  const stats=m?.stats||{gold:record.gold,reputation:w.reputation||0,trips:w.trips||0,kills:record.kills||0,months:w.totalDays||0};
  $('resultContent').innerHTML=`<div class="memorial-result"><div class="result-monument ${m?.honors.length?'rare-monument':''}">${death?tombMarkup(m):spriteMarkup(c.race,w.career||c.job)}<p>${death?esc(epitaph(m)):esc(o.title)}</p>${death?`<span>${m.honors.length?'특별한 기념비':'기억의 묘비'}</span>`:''}</div><div class="result-life"><span class="memorial-race">${esc(RACES.find(x=>x.id===c.race)?.name||'')} · ${esc(career)}</span><h3>${esc(c.name)} <small>${recordAge(o)}</small></h3><div class="memorial-traits">${c.traits.map(id=>{const t=TRAITS.find(x=>x.id===id);return `<span>${pixelIcon(id)}${esc(t?.name||id)}</span>`;}).join('')}</div><p class="memorial-first-job">첫 직업 · ${esc(JOBS.find(j=>j.id===c.job)?.name||'아직 직업 없음')}</p><p class="memorial-cause">${esc(o.cause||o.title)}</p><p class="memorial-location">${esc(o.location||'장소 기록 없음')}</p><dl class="life-numbers"><div><dt>최고 탐험</dt><dd>${o.floor||0}층</dd></div><div><dt>원정 / 처치</dt><dd>${stats.trips}회 / ${stats.kills}회</dd></div><div><dt>생전 소지금</dt><dd>${stats.gold||0} G</dd></div><div><dt>평판</dt><dd>${stats.reputation}</dd></div><div><dt>생활한 시간</dt><dd>${Math.floor(stats.months/12)}년</dd></div><div><dt>남긴 자산</dt><dd>${o.recoveredGold||0} G</dd></div></dl></div></div>${m?.honors.length?`<section class="result-honors"><h3>어렵게 남긴 성취</h3>${honorMarkup(m)}</section>`:''}${m?`<details class="stone-meaning"><summary class="stone-info-toggle" aria-label="묘비 표식 설명 보기"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6.5v1"/></svg></summary><p>종족은 돌의 윤곽과 색, 직업은 가운데 문양, 두 특성은 아래 표식으로 남습니다. 어린 삶에는 꽃, 75세 이상의 삶에는 균열이 생깁니다. 특별한 업적을 이루면 꼭대기 장식과 금빛 테두리가 추가됩니다.</p>${engravingMarkup(m)}</details>`:''}${full?`<details class="result-logs"><summary>생애 기록 펼치기 · ${full.log.length}줄</summary><div class="history-log">${full.log.map(x=>`<div>[${esc(logLabel(x))}] ${Number.isInteger(x.ageYears)?`[${x.ageYears}세] `:''}${esc(x.text)}</div>`).join('')}</div></details>`:'<p class="memorial-note">묘비와 생애 요약이 남아 있습니다. 전체 로그는 최근 20개 이야기에서 볼 수 있습니다.</p>'}`;
  if(m)$('resultContent').querySelector('.memorial-result').insertAdjacentHTML('afterend',tributeMarkup(m));
  if(m?.relationships?.length)$('resultContent').insertAdjacentHTML('beforeend',`<section class="result-honors"><h3>이름으로 남은 인연</h3>${m.relationships.map(p=>`<p>${esc(p.role)} ${esc(p.name)} · ${esc(relationLabel(p.score))} · ${p.meetings}번 만남 · ${esc(conditionLabel(p))}${p.fate?`<small class="companion-remembrance">${esc(p.fate.location)} · ${esc(p.fate.cause)}</small>`:''}</p>`).join('')}</section>`);
  $('resultNewLife').hidden=record.id!==game.s.id;$('resultCemetery').hidden=!death;
  if($('choiceDialog').open)$('choiceDialog').close();if(!$('resultDialog').open)$('resultDialog').showModal();schedule();
}
function showCompanionResult(m){
  resultRecord=m;$('resultTitle').textContent=`${m.character.name}의 기억`;$('resultEyebrow').textContent=`${m.owner.name}의 길에 함께했던 사람`;
  $('resultContent').innerHTML=`<div class="memorial-result"><div class="result-monument">${tombMarkup(m)}<p>${esc(epitaph(m))}</p><span>인연의 묘비</span></div><div class="result-life"><span class="memorial-race">${esc(m.role)} · ${esc(relationLabel(m.score))}</span><h3>${esc(m.character.name)}</h3><p class="memorial-first-job">${esc(m.owner.name)}의 이야기에서 만난 사람</p><p class="memorial-location">${m.meetings}번의 만남 · ${m.journeys}번의 동행</p><h4>마지막 동행</h4><p class="memorial-cause">${esc(m.outcome.cause)}</p><p class="memorial-location">${esc(m.outcome.location)} · ${esc(m.owner.name)} ${m.outcome.ownerAgeYears}세 때</p></div></div><section class="shared-memories"><h3>함께 겪었던 일들</h3>${m.sharedEvents.length?`<ol>${m.sharedEvents.map(e=>`<li><small>${esc(sharedEventLabel(m,e))}</small><p>${esc(e.text)}</p></li>`).join('')}</ol>`:'<p>함께한 사건의 상세 기록은 남아 있지 않습니다.</p>'}</section><details class="stone-meaning"><summary class="stone-info-toggle" aria-label="묘비 표식 설명 보기">${engravingGlyph('stone')}</summary>${engravingMarkup(m)}</details>`;
  const appearance=npcAppearance(m.owner.id,m.group,{name:m.character.name,appearance:m.appearance});
  $('resultContent').querySelector('.result-life').insertAdjacentHTML('afterbegin',`<span class="npc-remembrance-portrait">${spriteMarkup(appearance.race,appearance.job)}</span>`);
  $('resultContent').querySelector('.memorial-race').textContent=`${npcAppearanceLabel(appearance,m.role)} · ${relationLabel(m.score)}`;
  $('resultNewLife').hidden=true;$('resultCemetery').hidden=cemeteryOpen;$('resultDownload').textContent='인연 기록 저장';
  if($('choiceDialog').open)$('choiceDialog').close();if(!$('resultDialog').open)$('resultDialog').showModal();schedule();
}
function renderCemetery(){
  const rare=$('graveFilter').value==='rare',layout=cemeteryLayout(memorials);
  const companions=memorials.filter(isCompanionGrave).length;
  $('cemeterySummary').textContent=`${memorials.length-companions}명의 삶 · 기억 속 인연 ${companions}명 · 특별한 기념비 ${memorials.filter(m=>m.honors.length).length}개`;
  $('cemeteryTrack').style.width=`${layout.width}px`;
  walkingPlots=layout.plots;if(!cemeteryWalker)cemeteryWalker=new CemeteryWalker(layout.width);else cemeteryWalker.setWidth(layout.width);
  $('cemeteryWalker').innerHTML=`<span class="walker-facing">${spriteMarkup('human','porter')}</span><span class="walker-shadow"></span>`;
  if(!$('cemeteryVisitor'))$('cemeteryTrack').insertAdjacentHTML('beforeend','<div id="cemeteryVisitor" class="cemetery-visitor" role="img" hidden></div><div id="cemeteryOffering" class="cemetery-offering" aria-hidden="true" hidden></div>');
  $('historyList').innerHTML=layout.plots.length?layout.plots.map(({memorial:m,x,rise},i)=>`<button class="grave-plot ${m.honors.length?'rare-plot':''} ${rare&&!m.honors.length?'quiet-plot':''}" style="--plot-x:${x}px;--plot-rise:${rise}px" data-memorial="${esc(m.id)}" aria-label="${esc(m.character.name)}, ${esc(ageLabel(m))}, ${esc(lifeRole(m))}의 묘비 보기">${tombMarkup(m)}<strong>${esc(m.character.name)}</strong><span>${esc(ageLabel(m))} · ${esc(lifeRole(m))}</span><small>${m.honors.length?esc(HONORS.find(h=>h.id===m.honors[0])?.name):esc(epitaph(m))}</small></button>${i%3===1?`<span class="map-lantern" style="left:${x-34}px" aria-hidden="true"><i></i></span>`:''}`).join(''):'<p class="cemetery-empty">아직 이곳에 잠든 사람이 없습니다.<br>삶이 끝나면 이름과 이야기가 남습니다.</p>';
  $('historyList').querySelectorAll('[data-memorial]').forEach(b=>b.addEventListener('click',()=>{const plot=walkingPlots.find(p=>p.memorial.id===b.dataset.memorial);if(plot){cemeteryWalker.walkTo(plot.x+89);$('cemeteryViewport').focus({preventScroll:true});}}));
  $('completedStories').innerHTML=history.filter(s=>s.outcome.type!=='death').map(s=>`<button class="completed-story" data-story="${esc(s.id)}">${esc(s.character.name)} · ${recordAge(s.outcome)} · ${esc(s.outcome.title)} <span>결과 보기 →</span></button>`).join('');
  $('completedStoriesSection').hidden=!$('completedStories').children.length;
  $('completedStories').querySelectorAll('[data-story]').forEach(b=>b.addEventListener('click',()=>showResult(history.find(s=>s.id===b.dataset.story))));
  updateMapPosition();
  nearbyId=undefined;paintCemeteryWalker();
  $('latestGraveButton').disabled=!memorials.length;renderGraveSearch();
  if(rare){const first=$('historyList').querySelector('.rare-plot');if(first)first.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});}
}
function enterCemetery(){
  if(cemeteryOpen)return;
  if($('resultDialog').open)$('resultDialog').close();if($('choiceDialog').open)$('choiceDialog').close();tooltips.hide();
  cemeteryWasPaused=paused;paused=true;clearTimeout(timer);clearTimeout(choiceTimer);clearInterval(countdownTicker);timer=choiceTimer=countdownTicker=null;countdown.pause();
  cemeteryOpen=true;document.querySelector('.shell').hidden=true;$('cemeteryScreen').hidden=false;document.body.classList.add('visiting-cemetery');
  renderCemetery();$('cemeteryViewport').scrollLeft=cemeteryScroll||(matchMedia('(max-width:700px)').matches?170:0);window.scrollTo(0,0);$('cemeteryTitle').focus({preventScroll:true});save();
  walkingTime=0;walkingFrame=requestAnimationFrame(animateCemeteryWalker);
}
function showHistory(){if(cemeteryOpen){if($('resultDialog').open)$('resultDialog').close();return;}if(location.hash!=='#cemetery')window.history.pushState(null,'','#cemetery');enterCemetery();}
function leaveCemetery(resume=true){
  if(!cemeteryOpen)return;
  stopCemeteryWalking();cancelAnimationFrame(walkingFrame);walkingFrame=null;
  clearCemeteryVisitScene();
  cemeteryScroll=$('cemeteryViewport').scrollLeft;cemeteryOpen=false;$('cemeteryScreen').hidden=true;document.querySelector('.shell').hidden=false;document.body.classList.remove('visiting-cemetery');paused=cemeteryWasPaused;
  if(location.hash==='#cemetery')window.history.replaceState(null,'',location.pathname+location.search);
  if($('resultDialog').open)$('resultDialog').close();
  if(resume){dismissedChoice=null;render();save();schedule();$('historyButton').focus({preventScroll:true});}
}
function updateMapPosition(){
  const map=$('cemeteryViewport'),extent=Math.max(0,map.scrollWidth-map.clientWidth),percent=mapPercent(map.scrollLeft,extent);
  $('cemeteryPosition').value=percent;$('cemeteryPositionLabel').textContent=percent<1?'묘지 입구':percent>99?'숲길의 끝':`돌길을 따라 · ${Math.round(percent)}%`;
  $('cemeteryLeft').disabled=cemeteryWalker?cemeteryWalker.x<=70:percent<1;$('cemeteryRight').disabled=cemeteryWalker?cemeteryWalker.x>=cemeteryWalker.width-70:percent>99;
}
function walkCemetery(direction){cemeteryWalker?.walkTo(cemeteryWalker.x+direction*210);}
function stopCemeteryWalking(){heldWalkKeys.clear();heldWalkButton=null;cemeteryWalker?.stop();$('cemeteryWalker').classList.remove('walking');}
function paintCemeteryWalker(follow=false){
  if(!cemeteryWalker)return;
  const actor=$('cemeteryWalker');actor.style.left=`${cemeteryWalker.x}px`;actor.style.setProperty('--facing',cemeteryWalker.facing);actor.classList.toggle('walking',cemeteryWalker.moving);
  $('cemeteryLeft').disabled=cemeteryWalker.x<=70;$('cemeteryRight').disabled=cemeteryWalker.x>=cemeteryWalker.width-70;
  if(follow){const map=$('cemeteryViewport');map.scrollLeft=Math.max(0,Math.min(map.scrollWidth-map.clientWidth,cemeteryWalker.x-map.clientWidth*.48));}
  const plot=nearbyGrave(walkingPlots,cemeteryWalker.x),id=plot?.memorial.id||null;
  if(id===nearbyId)return;nearbyId=id;
  $('historyList').querySelectorAll('[data-memorial]').forEach(b=>b.classList.toggle('near-traveler',b.dataset.memorial===id));
  $('nearbyMemorial').hidden=!plot;$('walkingHint').hidden=!!plot;
  if(plot){const m=plot.memorial;$('nearbyName').textContent=`${m.character.name} · ${ageLabel(m)}`;$('nearbyRole').textContent=lifeRole(m);$('nearbyStory').textContent=memorialStory(m,history.find(s=>s.id===m.id));$('readNearbyMemorial').innerHTML=`${isCompanionGrave(m)?'함께한 기록 읽기':'생애 기록 읽기'} <small>E</small>`;}
  startCemeteryVisitScene(plot);
}
function clearCemeteryVisitScene(){
  activeVisitScene=null;activeVisitPlot=null;activeVisitStone=null;visitorRenderKey=tributeRenderKey=flowerRenderKey=scenePaintKey='';
  $('cemeteryVisitor')?.setAttribute('hidden','');$('cemeteryOffering')?.setAttribute('hidden','');
  $('historyList').querySelectorAll('.visit-playing').forEach(b=>b.classList.remove('visit-playing'));
}
function startCemeteryVisitScene(plot){
  clearCemeteryVisitScene();const visits=remembranceVisits(plot?.memorial);$('nearbyTribute').hidden=!visits.length;
  if(!plot||!visits.length)return;
  const id=plot.memorial.id,center=plot.x+89;let scene=visitScenes.get(id);
  if(!scene||scene.centerX!==center||scene.visits.length!==visits.length){scene=new CemeteryVisitScene(visits,center,cemeteryWalker.width,{reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches});visitScenes.set(id,scene);}
  activeVisitScene=scene;activeVisitPlot=plot;activeVisitStone=[...$('historyList').querySelectorAll('[data-memorial]')].find(b=>b.dataset.memorial===id);paintCemeteryVisitScene(scene.snapshot());
}
function paintCemeteryVisitScene(s){
  if(!activeVisitScene||!s.visit)return;const plot=activeVisitPlot,v=s.visit,actor=$('cemeteryVisitor'),offering=$('cemeteryOffering');
  const paintKey=`${plot.memorial.id}:${v.id}:${s.phase}:${s.x}:${s.carrying}:${s.flowers.length}`;if(paintKey===scenePaintKey)return;scenePaintKey=paintKey;
  const key=`${plot.memorial.id}:${v.id}`;
  if(key!==visitorRenderKey){visitorRenderKey=key;const appearance=visitorAppearance(v,plot.memorial.id);actor.innerHTML=`<span class="visitor-label">${esc(visitorName(v))}</span><span class="visitor-facing">${spriteMarkup(appearance.race,appearance.job)}<span class="visitor-bouquet">${bouquetMarkup(s.index)}</span></span><span class="visitor-shadow"></span>`;}
  actor.hidden=!s.visible;actor.dataset.phase=s.phase;actor.style.left=`${s.x}px`;actor.style.setProperty('--facing',s.facing);actor.style.setProperty('--plot-rise',`${plot.rise}px`);actor.classList.toggle('walking',s.walking);actor.classList.toggle('bowing',s.bowing);actor.classList.toggle('carrying',s.carrying);actor.setAttribute('aria-label',`${visitorName(v)} · ${visitPhaseLabel(s)}`);
  activeVisitStone?.classList.toggle('visit-playing',!s.complete);
  const flowerKey=`${plot.memorial.id}:${s.flowers.map(v=>v.id).join(',')}`;
  if(flowerKey!==flowerRenderKey){flowerRenderKey=flowerKey;offering.innerHTML=s.flowers.slice(0,3).map((v,i)=>bouquetMarkup(i)).join('');}
  offering.hidden=s.complete||!s.flowers.length;offering.style.left=`${activeVisitScene.centerX-46}px`;offering.style.setProperty('--plot-rise',`${plot.rise}px`);
  if(key!==tributeRenderKey){tributeRenderKey=key;$('nearbyTribute').innerHTML=`<span class="tribute-symbol" aria-hidden="true">${engravingGlyph(v.flowers?'flower':'stone')}</span><div><strong>이 묘비를 찾아온 인연 · ${esc(v.role)} ${esc(v.name)}</strong><small>${esc(npcAppearanceLabel(v.appearance))} · ${esc(visitWhen(v))}${v.condition==='injured'?' · 요양처에서 보낸 추모':''}</small><p>${esc(v.text)}</p><p class="nearby-memory">함께한 기억 · ${esc(v.memory.text)}</p><div class="visit-playback"><span id="visitSceneStatus" role="status"></span><button type="button" class="secondary-button" data-replay-visit>장면 다시 보기</button></div></div>`;}
  const status=$('visitSceneStatus'),label=visitPhaseLabel(s);if(status.textContent!==label)status.textContent=label;
}
$('nearbyTribute').addEventListener('click',e=>{if(e.target.closest('[data-replay-visit]')&&activeVisitScene){visitorRenderKey=tributeRenderKey=flowerRenderKey=scenePaintKey='';paintCemeteryVisitScene(activeVisitScene.restart());const map=$('cemeteryViewport');map.scrollLeft=Math.max(0,Math.min(map.scrollWidth-map.clientWidth,activeVisitScene.centerX-map.clientWidth*.48));map.scrollIntoView({block:'start',behavior:'instant'});map.focus({preventScroll:true});}});
function animateCemeteryWalker(time){
  if(!cemeteryOpen)return;
  const dt=walkingTime?(time-walkingTime)/1000:0;walkingTime=time;
  const pausedVisit=document.hidden||$('resultDialog').open;
  if(!pausedVisit){cemeteryWalker.step(dt);paintCemeteryWalker(cemeteryWalker.moving);}
  if(activeVisitScene){const map=$('cemeteryViewport'),actor=$('cemeteryVisitor'),rect=map.getBoundingClientRect(),feet=rect.bottom-parseFloat(getComputedStyle(actor).bottom),visible=feet>40&&feet-90<innerHeight-20&&activeVisitScene.centerX>=map.scrollLeft&&activeVisitScene.centerX<=map.scrollLeft+map.clientWidth;actor.classList.toggle('paused',pausedVisit||!visible);paintCemeteryVisitScene(activeVisitScene.step(dt,{paused:pausedVisit||!visible}));}
  walkingFrame=requestAnimationFrame(animateCemeteryWalker);
}
function readNearbyMemorial(){const m=memorials.find(m=>m.id===nearbyId);if(m)showResult(m);}
$('readNearbyMemorial').addEventListener('click',readNearbyMemorial);
$('cemeteryViewport').addEventListener('click',e=>{if(e.target.closest('button')||suppressMapClick)return;const map=$('cemeteryViewport');cemeteryWalker.walkTo(e.clientX-map.getBoundingClientRect().left+map.scrollLeft);});
$('cemeteryBackButton').addEventListener('click',()=>leaveCemetery());
$('cemeteryLeft').addEventListener('click',()=>walkCemetery(-1));$('cemeteryRight').addEventListener('click',()=>walkCemetery(1));
for(const [id,direction] of [['cemeteryLeft',-1],['cemeteryRight',1]]){
  const button=$(id);let suppressClick=false;
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();suppressClick=true;heldWalkButton=direction;cemeteryWalker.hold(direction);button.setPointerCapture(e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{if(heldWalkButton===direction){heldWalkButton=null;cemeteryWalker.stop();}});
  button.addEventListener('click',e=>{const ignore=suppressClick&&e.detail>0;suppressClick=false;if(ignore){e.stopImmediatePropagation();e.preventDefault();}},{capture:true});
}
$('cemeteryPosition').addEventListener('input',e=>{const map=$('cemeteryViewport');map.scrollLeft=(map.scrollWidth-map.clientWidth)*Number(e.target.value)/100;});
$('cemeteryViewport').addEventListener('scroll',updateMapPosition,{passive:true});
$('cemeteryViewport').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();$('cemeteryViewport').scrollLeft+=e.deltaY*(e.deltaMode===1?28:e.deltaMode===2?$('cemeteryViewport').clientWidth:1);}},{passive:false});
document.addEventListener('keydown',e=>{
  if(!cemeteryOpen||$('resultDialog').open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  const direction=({ArrowLeft:-1,a:-1,A:-1,ArrowRight:1,d:1,D:1})[e.key];
  if(direction){e.preventDefault();heldWalkKeys.add(e.key.toLowerCase());cemeteryWalker.hold(direction);}
  else if(e.key.toLowerCase()==='e'||(e.key==='Enter'&&!e.target.closest('button'))){e.preventDefault();readNearbyMemorial();}
});
document.addEventListener('keyup',e=>{if(!heldWalkKeys.delete(e.key.toLowerCase()))return;const last=[...heldWalkKeys].at(-1);if(last)cemeteryWalker.hold(['a','arrowleft'].includes(last)?-1:1);else cemeteryWalker.stop();});
window.addEventListener('blur',stopCemeteryWalking);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCemeteryWalking();});
$('cemeteryViewport').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;suppressMapClick=false;mapDrag={x:e.clientX,scroll:$('cemeteryViewport').scrollLeft,id:e.pointerId,moved:false};});
$('cemeteryViewport').addEventListener('pointermove',e=>{if(!mapDrag)return;if(!e.buttons){stopMapDrag();return;}const distance=e.clientX-mapDrag.x;if(Math.abs(distance)>6){mapDrag.moved=true;$('cemeteryViewport').setPointerCapture(mapDrag.id);$('cemeteryViewport').classList.add('dragging');$('cemeteryViewport').scrollLeft=mapDrag.scroll-distance;}});
function stopMapDrag(){if(!mapDrag)return;const drag=mapDrag;suppressMapClick=drag.moved;mapDrag=null;$('cemeteryViewport').classList.remove('dragging');if($('cemeteryViewport').hasPointerCapture(drag.id))$('cemeteryViewport').releasePointerCapture(drag.id);}
$('cemeteryViewport').addEventListener('pointerup',stopMapDrag);$('cemeteryViewport').addEventListener('pointercancel',stopMapDrag);
$('cemeteryViewport').addEventListener('click',e=>{if(suppressMapClick){suppressMapClick=false;e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
window.addEventListener('popstate',()=>{if(location.hash==='#cemetery')enterCemetery();else leaveCemetery();});
window.addEventListener('hashchange',()=>{if(location.hash==='#cemetery')enterCemetery();else leaveCemetery();});
function downloadResult(){
  const full=Array.isArray(resultRecord.log)?resultRecord:history.find(s=>s.id===resultRecord.id),m=toMemorial(full)||resultRecord;
  const text=m.stats||isCompanionGrave(m)?memorialText(m):`${resultRecord.character.name} · ${recordAge(resultRecord.outcome)}\n${resultRecord.outcome.title}`;
  const logs=full?.log?.map(x=>`[${logLabel(x)}] ${Number.isInteger(x.ageYears)?`[${x.ageYears}세] `:''}${x.text}`)||[];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+[text,...logs].join('\n')],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`생애-${resultRecord.character.name}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('graveFilter').addEventListener('change',renderCemetery);
function visitGrave(id){
  const plot=walkingPlots.find(p=>p.memorial.id===id);if(!plot)return;
  stopCemeteryWalking();cemeteryWalker.x=plot.x+89;nearbyId=undefined;paintCemeteryWalker(true);$('cemeteryViewport').focus({preventScroll:true});
}
function renderGraveSearch(){
  const query=$('graveSearch').value.trim(),matches=searchMemorials(memorials,query),results=$('graveSearchResults');
  results.hidden=!query;results.replaceChildren();
  for(const m of matches.slice(0,20)){const b=document.createElement('button');b.type='button';b.className='secondary-button';b.textContent=`${m.character.name} · ${ageLabel(m)} · ${lifeRole(m)}`;b.addEventListener('click',()=>visitGrave(m.id));results.append(b);}
  $('graveSearchStatus').textContent=query?matches.length?`${matches.length}명의 기록${matches.length>20?' · 앞의 20명 표시':''}`:'이름과 일치하는 묘비가 없습니다.':'';
}
$('graveSearch').addEventListener('input',renderGraveSearch);
$('latestGraveButton').addEventListener('click',()=>{if(memorials[0])visitGrave(memorials[0].id);});
$('backupRecords').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([exportRecords(memorials,history)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`판타지-모험록-기록-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent=`묘비 ${memorials.length}개와 생애 ${history.length}개의 백업 파일을 만들었습니다.`;
});
$('restoreRecords').addEventListener('click',()=>$('backupFile').click());
$('backupFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error('5MB 이하의 기록 백업 파일을 골라 주세요.');
    const merged=importRecords(await file.text(),memorials,history),previous=[localStorage.getItem(MEMORIAL_KEY),localStorage.getItem(HISTORY_KEY)];
    try{localStorage.setItem(MEMORIAL_KEY,JSON.stringify(merged.memorials));localStorage.setItem(HISTORY_KEY,JSON.stringify(merged.history));}
    catch{for(const [i,key] of [MEMORIAL_KEY,HISTORY_KEY].entries())try{if(previous[i]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[i]);}catch{}throw new Error('브라우저 저장 공간이 부족해 불러오지 못했습니다. 백업 파일을 보관해 주세요.');}
    memorials=merged.memorials;history=merged.history;renderCemetery();$('historyCount').textContent=memorials.length;$('backupStatus').textContent=`묘비 ${merged.added}개를 추가했습니다. 기존 기록과 진행 중인 이야기는 유지했습니다.`;
  }catch(error){$('backupStatus').textContent=error.message||'백업 파일을 읽지 못했습니다.';}
  finally{e.target.value='';}
});
$('resultCemetery').addEventListener('click',showHistory);
$('resultDownload').addEventListener('click',downloadResult);
$('resultNewLife').addEventListener('click',startNew);
$('resultClose').addEventListener('click',()=>$('resultDialog').close());
$('pauseButton').addEventListener('click',()=>{paused=!paused;actionKey='';render();save();schedule();});
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);render();save();schedule();}));
$('autoChoice').addEventListener('change',e=>{automatic=e.target.checked;actionKey='';if(game.s.status==='choice')paused=false;render();save();schedule();});
$('historyButton').addEventListener('click',showHistory);
$('guideButton').addEventListener('click',()=>{$('guideDialog').showModal();schedule();});
document.querySelectorAll('#guideDialog').forEach(d=>{d.querySelector('.dialog-close').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)d.close();}});});
$('homeStartButton').addEventListener('click',beginCreation);
$('newLifeButton').addEventListener('click',beginCreation);
$('skipCreationButton').addEventListener('click',finishCreation);

$('creationPauseButton').addEventListener('click',()=>{if(!creationResolve)return;creationHeld=!creationHeld;if(creationHeld||document.hidden)creationCountdown.pause();else creationCountdown.resume();renderCreationCountdown();});
$('creationDialog').addEventListener('cancel',e=>{e.preventDefault();tooltips.hide();});
function minimizeChoice(){dismissedChoice=choiceRenderKey;$('choiceDialog').close();}
$('minimizeChoiceButton').addEventListener('click',minimizeChoice);
$('choiceDialog').addEventListener('cancel',e=>{e.preventDefault();minimizeChoice();});
$('popupAutoChoice').addEventListener('change',e=>{automatic=e.target.checked;paused=false;actionKey='';render();save();schedule();});
$('popupCancelAuto').addEventListener('click',cancelAutomatic);$('inlineCancelAuto').addEventListener('click',cancelAutomatic);
$('autoChoiceTarget').addEventListener('change',e=>{if(game.s.choice?.options.some(o=>o.id===e.target.value&&!o.disabled)){countdown.retarget(e.target.value);renderCountdown();}});
$('changePathButton').addEventListener('click',changePath);$('popupChangePath').addEventListener('click',changePath);
$('logWindow').addEventListener('scroll',()=>{const w=$('logWindow');autoFollow=w.scrollHeight-w.clientHeight-w.scrollTop<45;$('followButton').hidden=autoFollow || renderedLogs<8;},{passive:true});
$('followButton').addEventListener('click',()=>{autoFollow=true;$('logWindow').scrollTop=$('logWindow').scrollHeight;$('followButton').hidden=true;});
document.addEventListener('keydown',e=>{if(cemeteryOpen||document.querySelector('#creationDialog[open],#guideDialog[open],#resultDialog[open]') || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(game.s.status==='choice' && /^[1-9]$/.test(e.key)){const o=game.s.choice.options[Number(e.key)-1];if(o&&!o.disabled){e.preventDefault();selectChoice(o.id);}}});
window.addEventListener('pagehide',save);
for(const id of ['guideDialog','resultDialog'])$(id).addEventListener('close',()=>{if(!creating){renderChoice();schedule();}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){creationCountdown.pause();tooltips.hide();}
  else if(creating&&!creationHeld)creationCountdown.resume();
  if(creating)renderCreationCountdown();else if(!document.hidden)renderChoice();schedule();save();
});
$('homeCharacters').innerHTML=[['human','inn'],['elf','mage'],['dwarf','smith'],['goblin','trader'],['undead','guild']].map(([r,j])=>`<span class="home-sprite">${spriteMarkup(r,j)}</span>`).join('');
if(location.hash==='#cemetery'){render();if($('resultDialog').open)$('resultDialog').close();enterCemetery();}else render();save();schedule();
