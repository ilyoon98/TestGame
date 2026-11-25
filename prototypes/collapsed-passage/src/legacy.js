"use strict";
const gameData=CP.createGameData();
const {parts,labels,effects,cards,newClassCards,rewardPool,skillRarities,starterSkills,skillCharge,maxSkillLevel,formationRanks,companionSides,companionSkillSlots,traits,traitThreshold,nunType,companionTypes,standardAreas,shopOffers,mysteryEvents,foes,battleTiming,bellboyTiming}=gameData;

const {pursuitWarningDistance,categories,icons,bodyAnchors,partyArt,motionArt,armLossAnchors,kneelingAnchors,woundPoseAnchors,woundSprites,eyeLossAnchors}=CP.createArtData();
function icon(id){
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[id]}</svg>`;
}
const combatArtCache=new Map();

// Eye line, abdomen and the selected leg in each displayed pose, as frame percentages.

function armLossAnchor(kind,pose){
  return armLossAnchors[kind]?.[pose] || bodyAnchors[kind==="nun"?"player":kind][2];
}

function armLossSrc(kind,pose){
  return armLossAnchors[kind]?.[pose]?`art/characters/conditions/arms-lost/${kind}-${pose}.webp`:null;
}

function combatArtReady(src){
  const cached=combatArtCache.get(src);
  return Boolean(src && (!cached || (cached.complete && cached.naturalWidth)));
}

function readyArmLossSrc(kind,pose){
  const src=armLossSrc(kind,pose);
  return combatArtReady(src)?src:null;
}

function kneelingSrc(kind,variant,pose){
  return `art/characters/conditions/legs-lost/${kind}-${pose}${variant==="armsAndLegs"?"-arms-lost":""}.webp`;
}

function kneelingVariant(armsLost){
  return armsLost?"armsAndLegs":"legsOnly";
}

// Eye line center (frame %), clockwise tilt (degrees), and wrap width (frame %).
const eyeLossFrames=new Map();
for(const {kind,src} of Object.values(partyArt)){
  const {upright,armsOnly,legsOnly,armsAndLegs}=eyeLossAnchors[kind];
  for(const [pose,anchor] of Object.entries(upright)){
    eyeLossFrames.set(pose==="idle"?src:motionArt[kind][pose],anchor);
    eyeLossFrames.set(armLossSrc(kind,pose),armsOnly[pose] || anchor);
  }
  for(const [variant,poses] of Object.entries({legsOnly,armsAndLegs})){
    for(const [pose,anchor] of Object.entries(poses)) eyeLossFrames.set(kneelingSrc(kind,variant,pose),anchor);
  }
}

function readyKneelingPose(kind,pose,armsLost){
  if(pose==="defeat") return null;
  const variant=kneelingVariant(armsLost), poses=kneelingAnchors[kind]?.[variant];
  if(!poses) return null;
  const first=pose==="release"?"attack":pose==="heal"?"idle":pose;
  for(const candidate of new Set([first,"idle"])){
    const src=kneelingSrc(kind,variant,candidate);
    if(poses[candidate] && combatArtReady(src)) return {src,pose:candidate,anchors:poses[candidate]};
  }
  return null;
}

function currentKneelingAnchors(panel){
  const {portrait,armsLost,kneeling}=panel.dataset;
  return kneelingAnchors[portrait]?.[kneelingVariant(armsLost!==undefined)]?.[kneeling];
}

function warmCombatArt(){
  if(typeof Image==="undefined") return;
  const sides=partySides();
  const actors=[...sides.map(side=>game[side].kind),areas[game.area].foe];
  const poses=actors.flatMap(id=>[...Object.values(motionArt[id] || {}),
    ...Object.keys(armLossAnchors[id] || {}).map(pose=>armLossSrc(id,pose)),
    ...Object.entries(kneelingAnchors[id] || {}).flatMap(([variant,poses])=>Object.keys(poses).map(pose=>kneelingSrc(id,variant,pose)))]);
  const emotes=sides.flatMap(side=>sideLoadout(side)).filter(Boolean).map(skillEmoteSrc);
  for(const src of [arenaSrc(areas[game.area]),captureBackdrop,pursuerArt,...poses,...emotes,...Object.values(woundSprites)]){
    if(combatArtCache.has(src)) continue;
    const image=new Image();
    combatArtCache.set(src,image);
    image.src=src;
  }
}
const skillRarity=id=>rewardDraft.rarity(id);
function exclusiveSkill(card){
  return CP.Loadout.exclusive(card);
}

function skillFits(card,actor){
  return CP.Loadout.fits(card,actor);
}

function companionStarterSkills(kind){
  return loadoutRules.starterSkills(kind);
}

let areas=standardAreas;

function arenaSrc(area){
  return `art/arena/${area.arena || "prison-backdrop"}.webp`;
}

function arenaStyle(area){
  return `--arena-image:url('${arenaSrc(area)}')${area.arena?";--arena-position:center":""}`;
}

function mapRandom(seed){
  return CP.seededRandom(seed);
}

function generateMap(config){
  return mapGenerator.generate(config);
}

function placeMapRooms(map,rooms,counts,firstWidth,random){
  return mapGenerator.placeRooms(map,rooms,counts,firstWidth,random);
}


function bellboyPhase(state=game){
  return state.enemy?.gatePhase(state.cooldownBattle) ?? null;
}

function bellboyGateClosed(state=game){
  return Boolean(state.enemy?.isGateClosed(state.cooldownBattle));
}

function bellboyDamageBonus(id,actor,state){
  return actor===state.enemy?actor.attackBonus(id,state.cooldownBattle):0;
}

function battleIsBellboy(state){
  return state.cooldownBattle?.bellboyStaggered!==undefined;
}

let game;
let lastPursuit=null;
let combatPresentation=null;
let routeTravel=null;
let qaOpen=false;
let audioContext;
let audioOutput;
let soundEnabled=true;
const noiseBuffers=new WeakMap();

// 게임 규칙 객체는 모듈(createGameServices)에서 조립한다.
// seams는 QA 도구(first-stage-balance --ablate)가 전역 함수를 옛 규칙으로 바꿔 끼울 수 있게 호출할 때마다 전역 이름을 찾는다.
const rules=CP.createGameServices(gameData,{
  areas:()=>areas,
  hooks:{fightPrepared:()=>warmCombatArt()},
  seams:{
    timedAttackTarget:(state,...args)=>timedAttackTarget(...args),
    readyTimedSkill:(state,battle)=>readyTimedSkill(battle),
    executePartySkill:(state,skill)=>executePartySkill(skill),
    applyCard:(state,id,actor,opponent,targets,recipient,amount)=>applyCard(id,actor,opponent,targets,state,recipient,amount),
    skillRewardOptions:()=>skillRewardOptions()
  }
});
const {fighters,events:domainEvents,synergies,calculator:damageCalculator,hits:hitResolver,cards:cardEffects,planner:enemyPlanner,
  mapGenerator,party:partyRules,loadout:loadoutRules,recruitment,rewards:rewardDraft,journey,market:blackMarket,runs:runFactory,
  targets:targetSelector,battle:battleRules}=rules;
// 타이머는 이 실행 환경(브라우저 또는 테스트)의 것을 넘긴다.
const autoBattle=new CP.AutoBattleRunner({
  scheduler:new CP.TimeoutScheduler((callback,ms)=>setTimeout(callback,ms),handle=>clearTimeout(handle)),
  host:{
    canRun:()=>Boolean(game) && game.phase==="combat" && !document.hidden && !minimapDialog.open && !codexDialog.open && !combatPresentation && !routeTravel,
    token:()=>({game,enemy:game.enemy}),
    isCurrent:token=>game===token.game && game.enemy===token.enemy,
    nextDelay:()=>battleRules.nextDelay(game),
    step:()=>stepAutoBattle()
  }
});
// 화면과 테스트가 읽는 예전 전역 이름. 값은 autoBattle이 가진다.
Object.defineProperty(globalThis,"autoPaused",{get:()=>autoBattle.paused,set:value=>{autoBattle.paused=value;},configurable:true});
Object.defineProperty(globalThis,"autoSpeed",{get:()=>autoBattle.speed,set:value=>{autoBattle.speed=value;},configurable:true});
Object.defineProperty(globalThis,"autoTimer",{get:()=>autoBattle.handle,configurable:true});

function fighter(name, health, vitality){
  return fighters.generic(name,health,vitality);
}

function isDown(actor){
  return actor.isDown();
}

function partySides(state=game){
  return partyRules.sides(state);
}

function livingRoster(state=game){
  return partyRules.roster(state);
}

function reserveSides(){
  return partyRules.reserve(game);
}

function sideOf(actor,state){
  return partyRules.sideOf(actor,state);
}

function placePartyMember(side,rank){
  return partyRules.place(game,side,rank);
}

function setTrainingReserve(side){
  return partyRules.setTrainingReserve(game,side);
}

// 대원 객체와 대원 종류 표(companionTypes) 모두 받는다.
function actorTraits(actor){
  return new Set([...actor.factions,...actor.jobs]);
}

function countTraits(actors){
  const counts=new Map();
  for(const actor of actors){
    for(const id of actorTraits(actor)) counts.set(id,(counts.get(id) || 0)+1);
  }
  return counts;
}

function availableTraitBonus(id,state,key=id){
  return synergies.available(id,state.cooldownBattle,key);
}

function useTrait(id,state,key=id){
  return synergies.consume(id,state.cooldownBattle,key);
}

function condition(fighter, id){
  return fighter.condition(id);
}

function travelGain(legs=condition(game.player,"legs")){
  return journey.travelGain(legs);
}

function power(card, actor){
  return CP.cardPower(card,actor);
}

function attackDamage(id,amount){
  return CP.attackDamage(cards[id],id,amount);
}

function enemyDamageMultiplier(state){
  return state.training?state.trainingEnemyDamage:1;
}

function healValue(actor,amount=2){
  return actor.receivableHealing(amount);
}

function healPart(actor,target,amount){
  return actor.healPart(target,amount);
}

function woundedParts(actor){
  return actor.woundedParts();
}

function guardAmount(id,actor){
  return id==="counter"?1:power(cards[id],actor);
}

function record(message,state=game){
  domainEvents.log(message,state);
}

function shuffle(items,random=Math.random){
  return CP.shuffle(items,random);
}

function newRunSeed(){
  return Math.floor(Math.random()*4294967296).toString(36).toUpperCase();
}

function start(mapConfig=game?.mapConfig,rewardSeed=mapConfig?.seed || game?.rewardSeed || newRunSeed()){
  cancelAutoBattleTimer();
  cancelCombatPresentation();
  if(minimapDialog.open) minimapDialog.close();
  autoPaused=false;
  if(routeTravel){
    routeTravel.cancel();
    routeTravel=null;
    document.querySelector("#stage").inert=false;
  }
  areas=runFactory.map(mapConfig);
  game=runFactory.create(mapConfig,rewardSeed);
  document.querySelector('#map-form [name="seed"]').value=rewardSeed;
  enterArea("threshold");
  render();
}

function clearDefense(actor){
  actor.clearDefense();
}

function restoreFighter(actor){
  actor.restore();
}

function openTrainingView(phase){
  if(!game.training || routeTravel || game.phase===phase) return;
  cancelAutoBattleTimer();
  cancelCombatPresentation();
  game.feedback=[];
  if(game.trainingFormation){
    game.formation=game.trainingFormation;
    game.trainingFormation=null;
    game.deadCompanions=[];
    for(const side of ["player",...companionSides]) restoreFighter(game[side]);
  }
  if(phase==="prep") enterArea(game.area,game.prepSide);
  else game.phase="route";
  render();
}

function setTrainingInjury(side,target,level){
  if(!game.training || game.phase!=="combat" || !partySides().includes(side) ||
     !Object.hasOwn(parts,target) || !Object.hasOwn(labels,level)) return false;
  const actor=game[side], part=actor.body[target];
  const hp=level==="healthy"?part.max:level==="injured"?Math.floor(part.max/2):0;
  if(hp===part.hp) return false;
  const interrupted=Boolean(combatPresentation);
  cancelCombatPresentation();
  if(interrupted) render();
  if(hp<part.hp){
    hit(game.enemy,actor,target,part.hp-hp,{id:"strike",pierce:part.guard,trainingOverride:true},game);
    finishCombat();
    playCombatFeedback();
  }else{
    healPart(actor,target,hp-part.hp);
    record(`QA · ${actor.name} ${parts[target]} ${labels[level]}`);
    render();
  }
  return true;
}

function enterArea(id,prepSide="player"){
  journey.enterArea(game,id,prepSide);
}

function availableSkills(side="player",state=game){
  return loadoutRules.available(state,side);
}

function sideLoadout(side,state=game){
  return loadoutRules.of(state,side);
}

function equippedBy(id){
  return loadoutRules.equippedBy(game,id);
}

function loadoutsReady(){
  return loadoutRules.ready(game);
}

function skillLevel(id){
  return loadoutRules.level(game,id);
}

function skillCooldown(id,level=skillLevel(id)){
  return loadoutRules.cooldown(game,id,level);
}

function toggleEquippedSkill(id,side="player"){
  return loadoutRules.toggle(game,id,side);
}

function setTrainingSkill(side,slot,id){
  return loadoutRules.setTrainingSkill(game,side,slot,id);
}

function beginCombat(){
  if(game.phase!=="prep" || !loadoutsReady()) return false;
  const sides=partySides();
  if(game.training) game.trainingFormation=[...game.formation];
  for(const side of sides) clearDefense(game[side]);
  if(game.lanternOil){
    const [front]=sides, actor=game[front];
    const part=actor.body.chest.hp?"chest":"head";
    actor.body[part].guard+=shopOffers.oil.amount;
    game.lanternOil=false;
    record(`등불 기름 · ${actor.name} ${parts[part]} 가드 +${shopOffers.oil.amount}`);
  }
  autoPaused=false;
  game.phase="combat";
  battleRules.start(game,sides);
  return true;
}

function timedEnemyPlan(){
  return enemyPlanner.plan(game);
}

function weakest(actor, permitted){
  return CP.EnemyPlanner.weakest(actor,permitted);
}

function attackTarget(target,active){
  return CP.EnemyPlanner.attackTarget(target,active);
}

function intactParts(actor){
  return actor.intactParts();
}

function enemyAttackSide(id,state=game){
  return enemyPlanner.attackSide(id,state);
}

function resolveIntent(action,state=game){
  return enemyPlanner.resolve(action,state);
}

function guardParts(actor){
  return actor.guardParts();
}

function queueFeedback(event,state){
  domainEvents.emit(event,state);
}

function resolveHitDamage(durability,effectiveGuard,damage,bonusDamage=0){
  return CP.resolveHitDamage(durability,effectiveGuard,damage,bonusDamage);
}

function woundedHitBonus(card,defender,target){
  return CP.WoundedHitModifier.bonus(card,defender,target);
}

function exposedHitBonus(card,attacker,defender,target,damage,guard,state){
  return CP.MarkModifier.bonus(card,attacker,defender,target,damage,guard,state,sideOf);
}

function evaluateHit(attacker,defender,target,damage,options,state){
  return damageCalculator.preview(attacker,defender,target,damage,options,state);
}

function hit(attacker,defender,target,damage,options,state){
  return hitResolver.resolve(attacker,defender,target,damage,options,state);
}

function attackSetup(card,actor,state){
  return cardEffects.attack.prepare(card,actor,state);
}

function attackHit(id,actor,target,state,prepared,index){
  return cardEffects.attack.plan(id,actor,target,state,prepared,index);
}

function applyAttack(id,actor,opponent,targets,state){
  cardEffects.attack.apply({id,actor,opponent,targets,state});
}

function applyHealing(id,actor,recipient,target,amount,state){
  cardEffects.heal.heal(id,actor,recipient,target,amount,state);
}

function applyCard(id, actor, opponent, targets,state=game,recipient=actor,amount=power(cards[id],actor)){
  cardEffects.apply(state,id,actor,opponent,targets,recipient,amount);
}

function quickHealTarget(excludedSide=null){
  return targetSelector.quickHealTarget(game,excludedSide);
}

function rearAlly(rank){
  return targetSelector.rearAlly(game,rank);
}

function healingTargets(card,side){
  return targetSelector.healingTargets(game,card,side);
}

function guardTargetPlan(id,side){
  return targetSelector.guardTargetPlan(game,id,side);
}

function setupReady(card,side){
  return cardEffects.setup.ready({card,side,state:game});
}

function applySetup(id,side){
  cardEffects.setup.place(id,side,game);
}

function skillBlocked({id,side}){
  return loadoutRules.blocked(game,{id,side});
}

function partySkillReady({id,side}){
  return cardEffects.ready(game,{id,side});
}

function readyTimedSkill(battle){
  return battleRules.readySkill(game,battle);
}

function attackPriority(order,actor,enemy,target){
  return targetSelector.attackPriority(game,order,actor,enemy,target);
}

function timedAttackTarget(id,actor,excluded=[],index=0,prepared=attackSetup(cards[id],actor,game)){
  return targetSelector.timedAttackTarget(game,id,actor,excluded,index,prepared);
}

function executePartySkill({id,side}){
  cardEffects.activate(game,{id,side});
}

function advanceAutoBattle(){
  return battleRules.advance(game);
}

function cancelAutoBattleTimer(){
  autoBattle.cancel();
}

function scheduleAutoBattle(){
  autoBattle.schedule();
}

// 자동 전투 한 걸음과 그 결과를 화면에 반영한다.
function stepAutoBattle(){
  const distance=game.distance;
  const previousBellboyPhase=bellboyPhase();
  const action=advanceAutoBattle();
  if(game.phase==="combat" && previousBellboyPhase!=="bell" && bellboyPhase()==="bell"){
    const scene=document.querySelector("#stage .stage-combat");
    setBellboyPresentation(scene,"bell");
    playBellboyBell();
  }
  if(action?.clockOnly){
    if(game.distance!==distance || game.phase!=="combat") render();
    else {
      updateCooldownReadout();
      scheduleAutoBattle();
    }
  }else if(action) playCombatFeedback(undefined,action.keepIntent);
}

function renderAutoControls(){
  const pause=document.querySelector("#auto-pause");
  pause.disabled=game.phase!=="combat";
  pause.textContent=autoPaused?"전투 계속":"전투 일시정지";
  pause.setAttribute("aria-pressed",String(autoPaused));
  const speed=document.querySelector("#auto-speed");
  speed.textContent=`배속 ${autoSpeed}×`;
  speed.setAttribute("aria-label",`전투 배속 ${autoSpeed}배, 누르면 다음 배속`);
}

function toggleAutoPause(){
  if(game.phase!=="combat") return;
  autoBattle.togglePause();
  cancelAutoBattleTimer();
  renderAutoControls();
  if(!combatPresentation) render();
  scheduleAutoBattle();
}

function cycleAutoSpeed(){
  autoBattle.cycleSpeed();
  renderAutoControls();
  scheduleAutoBattle();
}

const captureBackdrop="art/locations/pursuer-capture.webp";
const pursuerArt="art/arena/prison-pursuer.webp";

function lose(reason,cause="combat"){
  journey.lose(game,reason,cause);
}

function finishCombat(){
  return journey.finishCombat(game);
}

function hasUpcomingBattle(id){
  return journey.hasUpcomingBattle(id);
}

function skillRewardOptions(){
  return rewardDraft.options(game);
}

function drawSkillReward(ids,random,preferExclusive){
  return rewardDraft.draw(ids,random,preferExclusive);
}

function chooseReward(id){
  return rewardDraft.choose(game,id);
}

function canRecruit(kind){
  return recruitment.canRecruit(game,kind);
}

function nextCompanionOffer(){
  recruitment.nextOffer(game);
}

function makeCompanion(kind){
  return recruitment.makeCompanion(kind);
}

function recruitCompanion(kind,outgoing=null){
  return recruitment.recruit(game,kind,outgoing);
}

function declineCompanion(){
  return recruitment.decline(game);
}

function canMoveTo(id){
  return journey.canMoveTo(game,id);
}

function moveTo(id){
  journey.moveTo(game,id);
}

function mysteryBlockReason(event){
  return journey.mysteryBlockReason(game,event);
}

function mysteryDistance(event){
  return journey.mysteryDistance(game,event);
}

function mysteryEffect(event){
  return journey.mysteryEffect(game,event);
}

function resolveMystery(choice){
  return journey.resolveMystery(game,choice);
}

function treatAtStairs(target,side="player"){
  return journey.treatAtStairs(game,target,side);
}

function healthBar(actor){
  return `<span class="health-bar" aria-hidden="true"><i style="--life:${actor.hp/actor.maxHp*100}%"></i></span>`;
}

function guardBadge(guards){
  if(!guards.length) return "";
  const total=guards.reduce((sum,[,amount])=>sum+amount,0);
  const label=`부위 가드 합계 ${total} · ${guards.map(([id,amount])=>`${parts[id]} ${amount}`).join(" · ")}`;
  return `<span class="guard-badge" role="img" aria-label="${label}" title="${label}">${icon("defense")}${total}</span>`;
}

function actorHealth(actor,defeated="",guards=[]){
  const hp=actor.infinite?"∞":`${actor.hp}/${actor.maxHp}`;
  const label=defeated || (actor.infinite?"무한 체력":`체력 ${hp}`);
  return `<span class="actor-hp">${healthBar(defeated?{...actor,hp:0}:actor)}<b class="hp-value" role="img" aria-label="${label}">${defeated || hp}</b></span><span class="actor-guard">${defeated?"":guardBadge(guards)}</span>`;
}

function pursuerPosition(distance){
  return Math.max(5,88-Math.max(0,distance)*5);
}

function combatSeconds(milliseconds){
  return `${(milliseconds/1000).toFixed(1)}초`;
}

function pursuitCountdown(){
  return battleTiming.pursuit-game.cooldownBattle.elapsed%battleTiming.pursuit;
}

function combatReport(){
  return combatSeconds(game.combatTime);
}

function gauges(){
  const combat=game.phase==="combat";
  const timed=combat && game.cooldownBattle;
  const distance=Math.max(0,game.distance);
  const pursuit=timed?`<span id="pursuit-countdown">${combatSeconds(pursuitCountdown())}</span> 뒤 −1`:"";
  const activity=timed?`<div class="status-box"><strong id="combat-elapsed">${combatSeconds(timed.elapsed)}</strong><div><p>전투 경과</p></div></div>`:
    `<div class="status-box"><strong>${game.steps}</strong><div><p>이동한 칸</p><small>전투 소모 ${combatReport()}</small></div></div>`;
  const pursuitBox=game.training?"":`<div class="status-box pursuit ${distance<=pursuitWarningDistance?"urgent":""}"><strong>${distance}</strong><div><p>사형수 추격 · 도망 여유</p>
    <small>${pursuit?`${pursuit} · `:""}다음 이동 +${travelGain()}</small></div>
    <div class="pursuit-track" role="img" aria-label="기도를 받았던 사형수가 뒤쫓는 중 · 남은 도망 여유 ${distance}">
      <span class="pursuer" style="--near:${pursuerPosition(distance)}%">${icon("pursuer")}</span>
      <span class="runner">${icon("runner")}</span>
    </div></div>`;
  return `${pursuitBox}${activity}${combat?"":`<div class="status-box health ${game.player.hp<=7?"urgent":""}"><strong>${game.player.hp}/${game.player.maxHp}</strong><div><p>체력</p></div>${healthBar(game.player)}</div>`}`;
}

function enemyAttackDamage(id,amount,state=game){
  const damage=(attackDamage(id,amount)+bellboyDamageBonus(id,state.enemy,state))*enemyDamageMultiplier(state);
  return Math.max(0,damage-(state.cooldownBattle?.tactics?.weaken || 0));
}

function intentLabel(action,state=game){
  const {id,targets}=action, card=cards[id];
  const amount=power(card,state.enemy);
  const target=targets.map(key=>parts[key]).join("·");
  const scale=enemyDamageMultiplier(state), damage=enemyAttackDamage(id,amount,state);
  const detail=id==="aid"?healValue(state.enemy):
    id==="aim" || id==="break"?card.text(amount,damage):
    id==="counter"?card.text(amount*scale):card.type==="attack"?damage:amount;
  return `${target?`${target} `:""}${card.name} ${detail}`;
}

function battleIntent(){
  return enemyPlanner.intent(game);
}

function layoutCombatHud(scene){
  const rail=scene.querySelector(".intent-rail");
  const intent=rail.firstElementChild;
  const head=scene.querySelector('.actor-enemy [data-value="head"]').getBoundingClientRect();
  const center=head.left+head.width/2-rail.getBoundingClientRect().left;
  const offset=Math.max(0,Math.min(rail.clientWidth-16-intent.offsetWidth,center-8-intent.offsetWidth/2));
  intent.style.setProperty("--intent-offset",`${offset}px`);

}
const combatHudResize=new ResizeObserver(([entry])=>layoutCombatHud(entry.target));

function intentPanel(intents, eyes){
  if(!game.trainingEnemyActs) return '<div class="intent-rail"><div class="intent"><span class="intent-chip">적 행동 꺼짐</span></div></div>';
  const planned=timedEnemyPlan();
  const changes=intents.some(action=>action.id!==planned.id || (action.side && planned.side!==action.side));
  const heading=changes&&eyes==="healthy"?"변경된 예고":"적 행동 예고";
  const chips=eyes!=="healthy"
    ? `<span class="intent-chip" title="눈 부상으로 예고가 가려짐" role="img" aria-label="눈 부상으로 예고가 가려짐">${icon("hiddenIntent")}<strong>?</strong></span>`
    : intents.map(action=>{
      const {id}=action;
      const card=cards[id],type=card.type,amount=power(card,game.enemy);
      const value=id==="aid"?`+${healValue(game.enemy)}`:
        type==="defense"?`+${guardAmount(id,game.enemy)}`:enemyAttackDamage(id,amount);
      const attackLink=type==="attack"?` data-attack-side="${action.side}" data-attack-target="${action.targets[0]}" data-attack-source="${cards[action.id].part || "chest"}"`:"";
      const targetName=type==="attack" && partySides().length>1?`${game[action.side].name} `:"";
      const label=`${targetName}${intentLabel(action)}`;
      const targets=action.targets.length?`<span class="intent-target ${companionSides.includes(action.side)?"ally":action.side || "enemy"}">${action.targets.map(icon).join("")}</span>`:"";
      return `<span class="intent-chip ${type}" data-intent="${action.planIndex}"${attackLink} role="img" title="${label}" aria-label="${label}">${icon(type)}<strong>${value}</strong>${targets}</span>`;
    }).join("") || '<span aria-label="행동 없음">—</span>';
  const timer=game.cooldownBattle && eyes==="healthy"?`<span class="intent-chip intent-time" title="다음 적 행동까지">${icon("clock")}<strong id="enemy-cooldown">${combatSeconds(game.cooldownBattle.enemyReadyAt-game.cooldownBattle.elapsed)}</strong></span>`:"";
  return `<div class="intent-rail"><div class="intent" role="group" aria-label="${heading}">${chips}${timer}</div></div>`;
}

function bodyTiles(side,intents,eyes,anchors){
  const actor=game[side];
  const enemy=side==="enemy";
  const inCombat=game.phase==="combat";
  const threats=new Set(intents.filter(action=>cards[action.id].type==="attack" && action.side===side).flatMap(action=>action.targets));
  const guardIntents=enemy && eyes==="healthy"?intents.filter(action=>cards[action.id].type==="defense"):[];
  return Object.entries(actor.body).map(([id,part],index)=>{
    const level=condition(actor,id);
    const threat=!enemy && eyes==="healthy" && threats.has(id);
    const guard=!enemy && eyes==="lost"?"?":part.guard;
    const guarded=guard>0;
    const futureGuard=guardIntents.reduce((highest,action)=>
      action.targets.includes(id)?Math.max(highest,guardAmount(action.id,actor)):highest,part.guard);
    const upcoming=futureGuard-part.guard;
    const guardReadout=!inCombat?"":guarded || upcoming?`<span class="part-guard">${icon("defense")}${guarded?`<b>${guard}</b>`:""}${upcoming?`<b class="guard-upcoming">+${upcoming}</b>`:""}</span>`:`<span>가드 ${guard}</span>`;
    const position=anchors?`style="--x:${anchors[index][0]}%;--y:${anchors[index][1]}%"`:"";
    const marked=actor.mark?.target===id;
    return `<div data-side="${side}" data-value="${id}"
      class="part ${level} ${threat?"threat":""} ${guarded?"guarded":""} ${upcoming?"guard-intent":""}"
      ${position} ${marked?"data-marked":""}
      title="${side==="player"?effects[id]:!enemy && id==="arms"?"팔 결손 시 팔 기술 사용 불가":""}" aria-label="${actor.name} ${parts[id]} ${labels[level]} 내구도 ${part.hp}/${part.max}${inCombat?` 가드 ${guard}`:""}${upcoming?` · 가드 +${upcoming} 예정`:""}${marked?" · 균열 표식":""}">
      ${anchors?"":partDrawing(id,level==="lost")}
      <span class="part-top"><b>${parts[id]}</b><small>${labels[level]}</small></span>
      <span class="bar" style="--life:${part.hp/part.max*100}%"><i></i></span>
      <span class="part-stats"><span>${part.hp}/${part.max}</span>${guardReadout}</span></div>`;
  }).join("");
}

function legTravelLabel(legs,previous){
  const change=previous?`+${travelGain(previous)} → `:"";
  return `<span class="leg-travel">다음 이동 ${change}+${travelGain(legs)}</span>`;
}

function bodyStatus(actor){
  return actor.statusLabel();
}

function bodyStatusSummary(status,eyesLost){
  const badge=eyesLost?`<span class="eye-loss-badge" role="img" aria-label="눈 결손" title="눈 결손">${icon("hiddenIntent")}</span>`:"";
  return `${badge}<span class="body-status-label">부위 상태 · </span>${status}`;
}

function partDrawing(id,lost=false){
  const art=`<img class="part-drawing" src="art/body-parts/${id}.webp" width="96" height="96" alt="" draggable="false">`;
  return lost?`<span class="part-drawing-lost">${art}${icon(id==="eyes"?"hiddenIntent":"partLost")}</span>`:art;
}

function bodyWounds(actor){
  return actor.wounds();
}

const woundAppearance={
  injured:{arms:["scratch",13],chest:["scratch",13],belly:["scratch",15],legs:["scratch",14]},
  lost:{head:[null,15],chest:["wrap",18],belly:["wrap",19],legs:["wrap",18]}
};

function woundAnchors(kind,pose,kneeling){
  const poses=woundPoseAnchors[kind];
  if(!poses) return null;
  const upright=poses[pose] || poses.idle;
  const [ex,ey]=kneeling?.eyes || upright.slice(0,2);
  const [bx,by]=kneeling?.belly || upright.slice(2,4);
  const [lx,ly]=kneeling?.legs || upright.slice(4,6);
  const faceToBelly=ratio=>[ex+(bx-ex)*ratio,ey+(by-ey)*ratio];
  return {head:faceToBelly(-.24),eyes:[ex,ey],arms:kneeling?.arms || armLossAnchor(kind,pose),chest:faceToBelly(.56),belly:[bx,by],legs:[lx,ly]};
}

function woundDecal(part,level,[art,size],[x,y]){
  const image=art?`<img src="${woundSprites[art]}" alt="" draggable="false">`:"";
  const tag=level==="lost"?`<span class="wound-loss-tag">${icon("partLost")}</span>`:"";
  return `<span class="wound-decal${art?"":" mark-only"}" data-part="${part}" data-level="${level}" style="--x:${x}%;--y:${y}%;--size:${size}%">${image}${tag}</span>`;
}

function woundDecals(kind,pose,wounds,poseAnchors,appearanceByLevel=woundAppearance){
  if(!wounds.length) return "";
  const anchors=woundAnchors(kind,pose,poseAnchors);
  return wounds.flatMap(({id,level})=>{
    const appearance=appearanceByLevel[level][id];
    return appearance?[woundDecal(id,level,appearance,anchors[id])]:[];
  }).join("");
}

function combatWoundDecals(kind,pose,wounds,poseAnchors,spriteSrc){
  const eyes=eyeLossFrames.get(spriteSrc);
  let wrap="";
  if(eyes && wounds.some(({id,level})=>id==="eyes" && level==="lost")){
    const [x,y,tilt,size]=eyes;
    wrap=`<span class="eye-loss-wrap" data-part="eyes" data-level="lost" style="--x:${x}%;--y:${y}%;--tilt:${tilt}deg;--size:${size}%"></span>`;
  }
  return wrap+woundDecals(kind,pose,wounds,poseAnchors);
}

function woundChips(wounds,side,previousLegs){
  return wounds.map(({id,level,hp,max})=>`<span class="wound-chip ${level}">${partDrawing(id,level==="lost")}<span class="wound-chip-copy">
    <b>${parts[id]} <small>${labels[level]}</small></b><span class="wound-durability" title="남은 내구도">${hp}/${max}</span>
    ${side==="player" && id==="legs"?legTravelLabel(level,previousLegs):""}</span></span>`).join("");
}

function combatWoundPanel(sides){
  const reports=sides.map(side=>({side,wounds:bodyWounds(game[side])}));
  return `<div class="combat-wounds" ${reports.some(report=>report.wounds.length)?"":"hidden"}>
    ${reports.map(({side,wounds})=>`<div data-wounds-side="${side}" role="group" aria-label="${game[side].name} 부상 부위">${woundChips(wounds,side)}</div>`).join("")}</div>`;
}

function prepWoundPanel(){
  const groups=partySides().map(side=>{
    const actor=game[side], wounds=bodyWounds(actor);
    return wounds.length?`<div class="wound-group"><b>${actor.name}</b>${woundChips(wounds)}</div>`:"";
  }).join("");
  return groups?`<div class="prep-wounds" role="group" aria-label="아군 부상 부위">${groups}</div>`:"";
}

function bodyPanel(side, intents, eyes){
  const actor=game[side], enemy=side==="enemy";
  const sprite=enemy?areas[game.area].foe:side==="player"?"player":actor.kind;
  const bellboy=sprite==="bellboy", gatePhase=bellboy?bellboyPhase():"";
  const companion=companionSides.includes(side);
  const art=partyArt[sprite];
  const armsLost=Boolean(art && condition(actor,"arms")==="lost");
  const legsLost=Boolean(art && condition(actor,"legs")==="lost");
  const wounds=art?bodyWounds(actor):[];
  const lostIdle=armsLost?readyArmLossSrc(art.kind,"idle"):null;
  const kneeling=legsLost?readyKneelingPose(art.kind,"idle",armsLost):null;
  const spriteSrc=kneeling?.src || lostIdle || art?.src;
  const locations=kneeling?woundAnchors(art.kind,"idle",kneeling.anchors):null;
  const tiles=bodyTiles(side,intents,eyes,locations?Object.keys(parts).map(id=>locations[id]):bodyAnchors[sprite]);
  const portrait=art?`<img class="actor-sprite" src="${spriteSrc}" width="1024" height="1536" alt="" aria-hidden="true" draggable="false">`:
    `<div class="actor-sprite" aria-hidden="true"${bellboy?"":` style="--portrait:var(--art-${sprite})"`}></div>`;
  const gate=bellboy?`<div class="bellboy-gate" role="img" aria-label="${gatePhase==="staggered"?"철문 열림":"철문 닫힘"}"><div class="bellboy-grille"></div></div>
    <span class="bellboy-cue" role="img" aria-label="호출벨 · 강타 강화">${icon("bell")}</span>`:"";
  const [armX,armY]=art?armLossAnchor(art.kind,"idle"):[];
  const conditionArt=art?`<div class="actor-condition-layer" aria-hidden="true">
    <span class="arm-loss-marker" style="--x:${armX}%;--y:${armY}%" ${armsLost && !lostIdle && !kneeling?"":"hidden"}>${icon("partLost")}</span>
    <div class="actor-wound-decals" data-wounds='${JSON.stringify(wounds)}'>${combatWoundDecals(art.kind,"idle",wounds,kneeling?.anchors,spriteSrc)}</div>
    </div>`:"";
  const mark=actor.mark, markLabel=mark?`${parts[mark.target]} 표식 · 다른 아군 첫 적중 피해 +${mark.bonus}`:"";
  const markBadge=mark?`<span class="actor-mark" role="img" aria-label="${markLabel}" title="${markLabel}">${icon("skill")}${icon(mark.target)}</span>`:"";
  return `<section class="panel actor-${side} ${companion?"companion-actor":""} ${art?"sd-actor":""}${bellboy?"bellboy-actor":""}" data-portrait="${art?.kind || sprite}" ${bellboy?`data-bellboy-phase="${gatePhase}"`:""} ${armsLost?'data-arms-lost':""} ${legsLost?'data-legs-lost':""} ${kneeling?`data-kneeling="${kneeling.pose}"`:""} aria-label="${actor.name}"><div class="actor-caption"><h2>${actor.name}</h2>${markBadge}${!enemy && partySides().length>1?`<small>${formationRanks[game.formation.indexOf(side)]}</small>`:""}</div>
    <div class="actor-figure">${portrait}${conditionArt}${gate}<div class="body-grid hotspots" aria-hidden="true">${tiles}</div></div>
    <div class="foe-health">${actorHealth(actor,"",!enemy && eyes==="lost"?[]:guardParts(actor))}</div>
    <details class="actor-body-status" data-side="${side}"><summary>${bodyStatusSummary(bodyStatus(actor),condition(actor,"eyes")==="lost")}</summary><div class="body-grid body-readout">${bodyTiles(side,intents,eyes)}</div></details></section>`;
}

function traitChip(id,scope,count=""){
  const {name,icon:mark,group,effect}=traits[id];
  const tipId=`trait-tip-${scope}-${id}`;
  const category=group==="faction"?"진영":"직업";
  return `<span class="trait-chip-wrap"><button class="trait-chip${count?" active":""}" data-group="${group}" type="button" aria-describedby="${tipId}">${icon(mark)}${name}${count?` ${count}`:""}</button>
    <span class="trait-tip" id="${tipId}" role="tooltip"><b>${category}${effect?` · ${traitThreshold}명 출전`:""}</b><span>${effect || "현재 시너지 효과 없음"}</span></span></span>`;
}

function traitTags(actor,scope){
  return `<div class="trait-list">${[...actorTraits(actor)].map(id=>traitChip(id,scope)).join("")}</div>`;
}

function activeTraitChips(){
  const counts=countTraits(partySides().map(side=>game[side]));
  const chips=[...counts].filter(([id,count])=>traits[id].effect && count>=traitThreshold)
    .map(([id,count])=>traitChip(id,"active",`${count}/${traitThreshold}`));
  return chips.length?`<div class="trait-list" aria-label="활성 시너지">${chips.join("")}</div>`:"";
}

function reservePanel(){
  if(!game.training) return "";
  const reserves=reserveSides();
  if(!reserves.length) return "";
  return `<div class="reserve-list" aria-label="대기 동료"><small>대기</small>${reserves.map(side=>`<div class="reserve-entry">
    <button class="btn" type="button" data-action="prep-member" data-side="${side}" aria-current="${game.prepSide===side}">${game[side].name}</button>
    ${traitTags(game[side],`reserve-${side}`)}
    </div>`).join("")}</div>`;
}

function formationPanel(){
  const active=game.prepSide;
  const activeRank=game.formation.indexOf(active);
  const slots=game.formation.map((side,rank)=>{
    const rankName=formationRanks[rank];
    const locked=rank===activeRank || (activeRank<0 && side==="player");
    const rankButton=`<button type="button" class="formation-rank" data-action="formation-rank" data-value="${rank}" aria-label="${game[active].name} · ${rankName}로 이동" ${locked?"disabled":""}>${rankName}</button>`;
    if(!side) return `<div class="formation-slot" data-rank="${rank}">${rankButton}<div class="formation-vacancy"><span class="formation-portrait empty" aria-hidden="true">${icon("head")}</span><small>빈자리</small></div></div>`;
    const actor=game[side], selected=side===active;
    const portrait=partyArt[side==="player"?"player":actor.kind];
    const loadout=sideLoadout(side).map(id=>{
      const restricted=cards[id]?.ranks && !cards[id].ranks.includes(rank);
      return `<span${restricted?' class="rank-limited"':""}>${id?cards[id].name:"빈 슬롯"}${restricted?" · 위치 제한":""}</span>`;
    }).join("");
    return `<div class="formation-slot ${selected?"is-selected":""}" data-rank="${rank}">
      ${rankButton}
      <button class="formation-member" type="button" data-action="prep-member" data-side="${side}" aria-current="${selected}" aria-label="${actor.name} 기술" aria-describedby="formation-loadout-${side}">
        <span class="formation-portrait"><img src="${portrait.src}" width="1024" height="1536" alt="" draggable="false"></span><strong class="formation-name">${actor.name}</strong>
        <span class="formation-skills" id="formation-loadout-${side}">${loadout}</span>
      </button>
      ${traitTags(actor,side)}</div>`;
  }).reverse().join("");
  const trainingReserve=game.training && active!=="player" && activeRank>=0?
    '<div class="formation-tools"><button class="btn" type="button" data-action="formation-reserve">대기</button></div>':"";
  return `<div class="formation" role="group" aria-label="대열">${slots}</div>${trainingReserve}`;
}

function skillReadout(skill,elapsed){
  const remaining=Math.max(0,skill.readyAt-elapsed);
  const blocked=skillBlocked(skill);
  const waiting=!remaining && !blocked && !partySkillReady(skill);
  return {blocked:Boolean(blocked),ready:!remaining && !blocked && !waiting,
    value:blocked?0:skill.cooldown-remaining,label:blocked || (remaining?combatSeconds(remaining):
      waiting?(cards[skill.id].target==="heal"?"회복 대기":"조건 대기"):"준비 완료")};
}

const skillClassNames={common:"공용",nun:"수녀 전용",guard:"간수 전용",awakened:"개화 수감자 전용",archer:"감시탑 궁수 전용",shaman:"주술사 전용",bow:"활 전용"};
const skillClassIcons={nun:"nunLantern",guard:"guardCrest",awakened:"brokenShackle",archer:"traitBow",shaman:"skill",bow:"traitBow"};
const skillTerms={
  "공격":{icon:"attack",tip:"적의 부위에 피해를 줘요."},
  "방어":{icon:"defense",tip:"가드로 아군 부위를 보호해요."},
  "관통":{icon:"pierce",tip:"적의 가드를 표시된 수치만큼 무시해요."},
  "회복":{icon:"skill",tip:"부위 내구도를 회복해요. 대상의 배가 부상이면 절반만 회복돼요. 배가 결손되거나 회복할 부위가 결손되면 회복할 수 없어요."},
  "가드":{icon:"defense",tip:"부위별로 피해를 막아요. 같은 부위를 다시 보호하면 더 큰 가드 값이 남아요."},
  "부상":{icon:"arms",tip:"부위 내구도가 절반 이하로 남으면 관련 기술이 약해질 수 있어요."},
  "결손":{icon:"hiddenIntent",tip:"부위 내구도가 0이 되어 관련 기술을 쓸 수 없어요."},
  "표식":{icon:"skill",tip:"같은 부위에 다른 아군의 피해가 들어가면 추가 피해를 주고 사라져요. 새 표식은 앞선 표식을 덮어요."},
  "강화":{icon:"upgradeSkill",tip:"다음 조건에 맞는 아군 행동을 강화해요."},
  "약화":{icon:"brokenShackle",tip:"적의 가드나 다음 행동을 약화해요."}
};

function skillTerm(term){
  return `<span class="skill-term">${icon(skillTerms[term].icon)}<strong>${term}</strong></span>`;
}

function skillEffectLines(id,actor,term){
  const skill=cards[id];
  const amount=power(skill,actor);
  if(skill.lines) return skill.lines;
  switch(skill.effect || id){
    case "aim": return [`한 부위 피해 ${attackDamage(id,amount)}`,`${term("관통")} ${amount} · ${term("가드")} 무시`];
    case "break": return [`${term("가드")} ${amount} 제거`,`한 부위 피해 ${attackDamage(id,amount)}`];
    case "guard": return [`한 부위 ${term("가드")} +${amount}`];
    case "split": return [`${skill.target==="rear"?"맨 뒤 아군 ":""}두 부위에 각각 ${term("가드")} +${amount}`];
    case "counter": return [`한 부위 ${term("가드")} +${guardAmount(id,actor)}`,`해당 부위 피격 시 반격 ${amount}`];
    case "aid": return [skill.healMode==="vitals"?"머리·가슴 한 곳 3 회복 · 그 외 2 회복":
      `${skill.healAllies===2?"아군 최대 2명 · 각각 한 부위":"한 부위"} 내구도 최대 ${amount} 회복`,
      `대상의 배 ${term("부상")} 시 회복량 절반`,
      `${term("결손")} 부위는 회복 불가`];
    default:{
      const base=`${skill.hits===2?"두 부위에 각각":"한 부위"} 피해 ${amount}`;
      if(skill.woundBonus) return [base,`${term("부상")} 부위 피해 +${skill.woundBonus}`];
      if(skill.mark) return [base,`적중 시 ${term("표식")} · 다음 아군 피해 +${skill.mark}`];
      return [base];
    }
  }
}

function skillCardText(id,actor=game.player){
  const skill=cards[id];
  const type=skill.effect==="setup"?(["strip","weaken"].includes(skill.setup)?"약화":"강화"):
    skill.type==="skill"?"회복":categories[skill.type];
  const terms=new Set([type]);
  const lines=skillEffectLines(id,actor,name=>{
    terms.add(name);
    return skillTerm(name);
  });
  return {type:skillTerm(type),lines,terms};
}

function skillTooltip(id,terms,holder,transferable=false){
  return `<span class="skill-tooltip" id="${id}" role="tooltip">
    ${holder?`<span>${holder} 장착${transferable?" · 빈 슬롯으로 옮길 수 있음":""}</span>`:""}
    ${[...terms].map(term=>`<span><b>${term}</b> · ${skillTerms[term].tip}</span>`).join("")}
  </span>`;
}

function skillEffects(lines){
  return `<span class="skill-effects">${lines.map(line=>`<span class="skill-effect">${line}</span>`).join("")}</span>`;
}

const revisedSkillArt=new Set(["snapShot","mending","unseal"]);

function skillArtSrc(id){
  const art=cards[id].artFrom || id;
  return `art/skills/${art}${revisedSkillArt.has(art)?"-v5":""}.webp`;
}

function skillEmoteSrc(id){
  return `art/skills/emotes/${cards[id]?.artFrom || id}.webp`;
}

function skillCardArt(id){
  const src=cards[id].character?skillArtSrc(id):skillEmoteSrc(id);
  return `<img class="skill-card-art" src="${src}" width="240" height="100" alt="" draggable="false">`;
}

function skillOwnerMark(skillClass){
  const mark=skillClassIcons[skillClass];
  return `<span class="skill-owner">${mark?icon(mark):""}${skillClassNames[skillClass]}</span>`;
}

function skillRarityMark(id){
  const rarity=skillRarity(id);
  return `<span class="skill-rarity" data-rarity="${rarity}">${skillRarities[rarity].name}</span>`;
}

const skillRankLabels={"0":"전위만","1":"중위만","2":"후위만","0,1":"후위 불가","1,2":"전위 불가","0,2":"중위 불가"};

function skillRankMark(id){
  const ranks=cards[id].ranks || [0,1,2];
  const label=skillRankLabels[ranks.join(",")] || "모든 위치";
  const slots=formationRanks.map((name,rank)=>
    `<span class="skill-rank" data-open="${ranks.includes(rank)}">${name[0]}</span>`).join("");
  return `<span class="skill-ranks" role="img" aria-label="${label}" title="${label}">
    ${slots}<span class="skill-rank-label">${label}</span></span>`;
}

function trainingSkillSlots(side){
  if(!game.training) return "";
  const choices=availableSkills(side).filter(id=>{
    const owner=equippedBy(id);
    return !owner || owner===side;
  });
  return `<div class="training-slots" role="group" aria-label="기술 슬롯">${sideLoadout(side).map((current,index)=>
    `<label>슬롯 ${index+1}<select data-training-slot="${index}" data-side="${side}">
    <option value="">빈 슬롯</option>${choices.map(id=>`<option value="${id}" ${current===id?"selected":""}>${cards[id].name}</option>`).join("")}
    </select></label>`).join("")}</div>`;
}

function prepPanel(vitalsOpen=false){
  const side=game.prepSide, actor=game[side], loadout=sideLoadout(side);
  const equipped=loadout.filter(Boolean).length;
  const ready=loadoutsReady();
  const choices=availableSkills(side).sort((a,b)=>Number(exclusiveSkill(cards[b]))-Number(exclusiveSkill(cards[a]))).map(id=>{
    const skill=cards[id], selected=loadout.includes(id), level=skillLevel(id);
    const skillClass=skill.character || skill.weapon || "common";
    const {lines,terms}=skillCardText(id,actor);
    const other=!selected && equippedBy(id);
    const sharedOwner=other && !exclusiveSkill(skill)?game[other].name:"";
    const blocked=skillBlocked({id,side});
    const tooltipId=`prep-tip-${id}`;
    return `<li class="skill-card-item"><button class="btn prep-choice skill-class-card ${skill.type}" data-skill-class="${skillClass}" type="button" data-action="toggle-skill" data-value="${id}" aria-pressed="${selected}" aria-describedby="${tooltipId}" ${other && !sharedOwner?"disabled":""}>
      <span class="prep-choice-top"><span class="prep-choice-icon">${icon(skill.type)}</span>${skillRarityMark(id)}<b class="prep-choice-time">${combatSeconds(skillCooldown(id))}</b></span>
      ${skillCardArt(id)}
      <span class="prep-choice-name"><strong>${skill.name}</strong>${selected || other?`<span class="prep-choice-state">${selected?"장착":sharedOwner?`${sharedOwner} 장착`:"사용 중"}</span>`:""}</span>
      <span class="prep-choice-meta">${skillOwnerMark(skillClass)}${level>1?` · Lv.${level}`:""}</span>
      ${skillRankMark(id)}
      ${blocked?`<span class="skill-effects"><span class="skill-effect is-blocked">${blocked==="위치 제한"?"발동 불가":blocked}</span></span>`:""}
      ${skillEffects(lines)}
    </button>${skillTooltip(tooltipId,terms,game[other]?.name,Boolean(sharedOwner))}</li>`;
  }).join("");
  return `<section class="routes prep-panel"><div class="prep-heading" style="${arenaStyle(areas[game.area])}"><div><h2>전투 준비</h2>
    <p>${game.enemy.name} · 체력 ${game.enemy.infinite?"∞":game.enemy.hp}</p></div></div>
    ${formationPanel()}
    ${activeTraitChips()}
    ${reservePanel()}
    ${prepWoundPanel()}
    <details class="prep-vitals" ${vitalsOpen?"open":""}><summary>수녀 부위별 내구도</summary>
      <div class="body-grid body-readout">${bodyTiles("player",[],condition(game.player,"eyes"))}</div></details>
    <div class="prep-picker"><div class="prep-picker-head"><h3>${actor.name} 기술</h3><b class="prep-count">장착 ${equipped}/${loadout.length}</b></div>
    ${trainingSkillSlots(side)}
    <ul class="prep-choices">${choices}</ul><p class="prep-hint" id="prep-skill-hint" role="status">${ready?"":"빈 기술 칸을 채우세요."}</p></div>
    <div class="prep-footer"><button class="btn primary" type="button" data-action="begin-combat" ${ready?"":"disabled"}>전투 시작</button></div></section>`;
}

function rewardPanel(){
  const options=game.rewards.map((id,index)=>{
    const skill=cards[id], level=game.skillLevels[id];
    const skillClass=skill.character || skill.weapon || "common", currentTime=combatSeconds(skillCooldown(id));
    const changes=level?[`레벨 ${level} → ${level+1}`,`쿨타임 ${currentTime} → ${combatSeconds(skillCooldown(id,level+1))}`]:[`쿨타임 ${currentTime}`];
    const actor=partySides().map(side=>game[side]).find(actor=>skillFits(skill,actor)) || game.player;
    const {type,lines,terms}=skillCardText(id,actor);
    const tooltipId=`reward-tip-${id}`;
    return `<div class="skill-card-item"><button class="btn skill-reward skill-class-card" type="button" data-action="reward" data-value="${id}" data-skill-class="${skillClass}" aria-keyshortcuts="${index+1}" aria-describedby="${tooltipId}">
      <span class="reward-top"><span class="reward-kind ${level?"upgrade":"learn"}">${icon(level?"upgradeSkill":"learnSkill")}${level?"강화":"새 기술"}</span>${skillRarityMark(id)}<kbd>${index+1}</kbd></span>
      ${skillCardArt(id)}<strong>${skill.name}</strong><span class="prep-choice-meta">${skillOwnerMark(skillClass)} · ${type}</span>
      ${skillRankMark(id)}
      ${skillEffects([...changes,...lines])}</button>${skillTooltip(tooltipId,terms)}</div>`;
  }).join("");
  return `<section class="routes" aria-label="기술 보상"><h2>기술 보상</h2><div class="skill-rewards">${options}</div>
    <button class="btn" type="button" data-action="skip-reward" aria-keyshortcuts="0">건너뛰기 (0)</button></section>`;
}

function skillPanel(){
  const {skills,elapsed}=game.cooldownBattle;
  const sides=partySides().reverse();
  const slots=side=>skills.filter(skill=>skill.side===side).map(skill=>{
    const card=cards[skill.id], state=skillReadout(skill,elapsed);
    return `<li class="skill-slot ${card.type}" data-skill="${skill.id}" data-ready="${state.ready}" data-blocked="${state.blocked}" data-skill-side="${side}">
      <div class="skill-slot-name"><img class="skill-slot-art" src="${skillEmoteSrc(skill.id)}" width="240" height="180" alt="" draggable="false"><strong>${card.name}</strong>${skillLevel(skill.id)>1?`<small>Lv.${skillLevel(skill.id)}</small>`:""}</div>
      <progress class="skill-meter" aria-label="${card.name} 충전" value="${state.value}" max="${skill.cooldown}"></progress>
      <small class="skill-timing"><span>${combatSeconds(skill.cooldown)} 충전</span><b class="skill-remaining">${state.label}</b><span class="skill-activation" aria-hidden="true"></span></small>
    </li>`;
  }).join("");
  const content=sides.length===1?`<ul class="skill-slots">${slots(sides[0])}</ul>`:
    `<div class="skill-groups" style="--party-size:${sides.length}">${sides.map(side=>`<div class="skill-group"><h3>${game[side].name}</h3><ul class="skill-slots">${slots(side)}</ul></div>`).join("")}</div>`;
  return `<section class="skill-loadout" aria-label="자동 발동 기술"><h2>자동 기술</h2>${content}</section>`;
}

function updateCooldownReadout(){
  const stage=document.querySelector("#stage");
  const panel=stage.querySelector(".skill-loadout");
  if(!panel) return;
  const {skills,elapsed,enemyReadyAt}=game.cooldownBattle;
  for(const skill of skills){
    const node=panel.querySelector(`[data-skill="${skill.id}"]`);
    if(!node) continue;
    const state=skillReadout(skill,elapsed);
    node.dataset.ready=state.ready;
    node.dataset.blocked=state.blocked;
    node.querySelector("progress").value=state.value;
    node.querySelector(".skill-remaining").textContent=state.label;
  }
  document.querySelector("#combat-elapsed").textContent=combatSeconds(elapsed);
  if(!game.training) document.querySelector("#pursuit-countdown").textContent=combatSeconds(pursuitCountdown());
  const enemyCountdown=stage.querySelector("#enemy-cooldown");
  if(enemyCountdown) enemyCountdown.textContent=combatSeconds(enemyReadyAt-elapsed);
}

function routeType(id){
  return areas[id].type || (id==="exit"?"exit":id==="lift"?"elite":"battle");
}

function mapPanel({preview=false}={}){
  const next=areas[game.area].next;
  const gain=travelGain();
  const types={battle:{icon:"routeBattle",label:"전투"},rest:{icon:"routeRest",label:"휴식·치료"},shop:{icon:"routeShop",label:"상점"},mystery:{icon:"routeMystery",label:"사건"},elite:{icon:"routeElite",label:"강적"},boss:{icon:"bell",label:"보스"},exit:{icon:"routeExit",label:"출구"}};
  const roomTypes=new Set(Object.keys(areas).map(routeType));
  const columns=Math.max(...Object.values(areas).map(area=>area.col));
  const traveled=new Set(game.trail.slice(1).map((id,i)=>`${game.trail[i]}-${id}`));
  const nodes=Object.entries(areas).map(([id,area])=>{
    const current=id===game.area;
    const visited=game.trail.includes(id);
    const reachable=game.training?(preview?!current && Boolean(area.foe):canMoveTo(id)):next.includes(id);
    const kind=routeType(id), type=types[kind];
    const nextLabel=preview && !game.training?"다음 방":"이동 가능";
    const state=current?"현재 위치":reachable?nextLabel:visited?"완료":"";
    const interactive=reachable && !preview;
    const tag=interactive?"button":"div";
    return `<${tag} class="map-node ${current?"current":reachable?"next":visited?"visited":""}" data-room="${id}" data-room-type="${kind}" aria-label="${area.name} · ${type.label}${state?` · ${state}`:""}" ${current?'aria-current="location"':""}
      ${interactive?`type="button" data-action="move" data-value="${id}"`:""}
      style="--col:${area.col};--row:${area.row}"><span class="room-icon">${icon(type.icon)}</span><b>${area.name}</b>
      ${state?`<span class="room-state">${state}</span>`:""}</${tag}>`;
  }).join("");
  const lines=Object.entries(areas).flatMap(([id,area])=>(area.next||[]).map(dest=>{
    const edge=`${id}-${dest}`;
    return `<line class="${traveled.has(edge)?"walked":""}" data-edge="${edge}" data-from="${id}" data-to="${dest}"/>`;
  })).join("");
  const detail=game.training?"적 체력 ∞":`${game.mapConfig?`동전 ${game.coins} · `:""}다음 이동 · 도망 여유 +${gain}`;
  return `<section class="route-map" aria-label="전체 경로 지도"><div class="map-head"><h3>전체 경로</h3><small>${detail}</small></div>
    <div class="route-legend">${Object.entries(types).filter(([key])=>roomTypes.has(key)).map(([,type])=>`<span>${icon(type.icon)}${type.label}</span>`).join("")}</div>
    <div class="map-layout" style="--map-stages:${columns}"><svg class="map-lines" aria-hidden="true">${lines}</svg>${nodes}</div></section>`;
}

function centerInFrame(node,frame){
  const rect=node.getBoundingClientRect();
  return {x:rect.left+rect.width/2-frame.left,y:rect.top+rect.height/2-frame.top};
}

function layoutMapLinks(layout){
  const frame=layout.getBoundingClientRect();
  const centers=Object.fromEntries(Array.from(layout.querySelectorAll(".map-node"),node=>
    [node.dataset.room,centerInFrame(node,frame)]));
  for(const line of layout.querySelectorAll("[data-edge]")){
    const from=centers[line.dataset.from], to=centers[line.dataset.to];
    line.setAttribute("x1",from.x);
    line.setAttribute("y1",from.y);
    line.setAttribute("x2",to.x);
    line.setAttribute("y2",to.y);
  }
}
const mapResize=new ResizeObserver(([entry])=>layoutMapLinks(entry.target));

function renderMinimap(){
  minimapResize.disconnect();
  const content=document.querySelector("#minimap-content");
  content.innerHTML=mapPanel({preview:true});
  const layout=content.querySelector(".map-layout");
  layoutMapLinks(layout);
  minimapResize.observe(layout);
}

function toggleMinimap(){
  if(minimapDialog.open){
    minimapDialog.close();
    return;
  }
  cancelAutoBattleTimer();
  minimapDialog.showModal();
  document.querySelector("#minimap-toggle").setAttribute("aria-expanded","true");
  renderMinimap();
}

function roomScene(src,alt,foreground=""){
  return `<figure class="room-scene"><img class="room-backdrop" src="${src}" width="1200" height="675" alt="${alt}">${foreground}</figure>`;
}

const campSides=[
  {
    order:["guard","awakened","nun"],
    seats:[[],[[37,12,29]],[[26,21,25],[40,10,28]],[[13,25,24],[25,17,26],[41,8,27]]]
  },
  {
    order:["shaman","archer"],
    seats:[[],[[67,13,27]],[[64,9,26],[79,22,25]]]
  }
];

const campDepartureSeats=[
  [],
  [[63,13,24]],
  [[50,17,22],[70,23,21]],
  [[45,23,19],[60,19,20],[77,28,18]],
  [[42,25,18],[55,19,19],[68,25,18],[82,31,17]],
  [[40,27,17],[51,21,18],[63,24,17],[75,28,16],[87,32,15]]
];
const campRestAnchors={
  nun:{
    normal:{eyes:[54.2,28.2],belly:[54.7,65.7],legs:[66.1,78.2],arms:[39.1,51.9]},
    arms:{eyes:[54.2,28.7],belly:[53.6,66.2],legs:[66.1,78.2],arms:[30.7,53.2]},
    legs:{eyes:[53.6,28.7],belly:[54.2,65.7],legs:[65.6,78.2],arms:[38.5,51.9]},
    both:{eyes:[53.1,28.7],belly:[54.2,66.7],legs:[64.1,77.8],arms:[28.6,54.2]}
  },
  guard:{
    normal:{eyes:[56.8,35.2],belly:[52.6,66.2],legs:[66.7,79.2],arms:[64.1,46.3]},
    arms:{eyes:[58.9,34.7],belly:[54.2,66.2],legs:[72.9,79.6],arms:[67.7,46.8]},
    legs:{eyes:[56.8,34.7],belly:[52.1,66.2],legs:[65.1,81],arms:[64.1,47.7]},
    both:{eyes:[57.8,34.7],belly:[53.6,65.7],legs:[69.8,81.5],arms:[71.4,47.7]}
  },
  awakened:{
    normal:{eyes:[53.6,26.9],belly:[52.6,66.7],legs:[74.5,69.9],arms:[37.5,52.8]},
    arms:{eyes:[53.6,26.9],belly:[53.1,66.2],legs:[75,69.9],arms:[35.9,53.2]},
    legs:{eyes:[53.1,26.9],belly:[53.1,65.7],legs:[71.9,75],arms:[37,52.8]},
    both:{eyes:[54.2,26.9],belly:[53.1,66.2],legs:[71.9,76.4],arms:[36.5,53.2]}
  },
  archer:{
    normal:{eyes:[44.3,25.9],belly:[54.2,60.6],legs:[32.3,69],arms:[30.2,45.8]},
    arms:{eyes:[44.3,34.7],belly:[55.2,66.2],legs:[32.8,72.2],arms:[38.5,53.2]},
    legs:{eyes:[44.8,26.4],belly:[54.2,61.1],legs:[31.8,73.6],arms:[30.7,46.8]},
    both:{eyes:[43.2,35.2],belly:[54.7,67.1],legs:[36.5,75.9],arms:[36.5,54.2]}
  },
  shaman:{
    normal:{eyes:[39.6,41.2],belly:[45.3,69],legs:[46.4,83.8],arms:[31.3,61.6]},
    arms:{eyes:[40.1,41.2],belly:[46.9,68.5],legs:[45.8,84.3],arms:[30.7,61.6]},
    legs:{eyes:[39.6,41.2],belly:[45.8,68.1],legs:[49.5,84.3],arms:[31.3,62]},
    both:{eyes:[39.6,41.2],belly:[45.8,68.1],legs:[49,84.3],arms:[30.7,62]}
  }
};
const campWoundAppearance={
  injured:{...woundAppearance.injured,head:["scratch",11],eyes:["scratch",12]},
  lost:{...woundAppearance.lost,eyes:[null,10],arms:[null,15]}
};
const campSparks=[
  [51,69,-13,1.8,-.4,2],[54,70,19,2.7,-1.1,3],[51,67,5,2.1,-1.9,2],
  [53,68,25,2.8,-2.1,2],[50,71,-24,2.4,-1.3,2],[55,70,8,1.7,-.6,2],
  [52,65,-5,1.9,-1.6,3],[53,68,12,2.6,-2.3,2],[49,72,-18,2.8,-.2,2],
  [55,69,26,2.9,-1.7,2],[52,71,-13,2.2,-1.2,2],[54,66,5,2.9,-2.8,2]
];

function locationActor(actor,art,[x,bottom,width],readyToMove){
  const {kind}=art;
  const armsLost=condition(actor,"arms")==="lost";
  const legsLost=condition(actor,"legs")==="lost";
  const variant=legsLost?(armsLost?"both":"legs"):(armsLost?"arms":"normal");
  let src=`art/locations/camp-poses/${kind}-${variant}.webp`;
  let anchors=campRestAnchors[kind]?.[variant];
  let imageWidth=480,imageHeight=540;
  if(readyToMove){
    const kneeling=kneelingVariant(armsLost);
    src=legsLost?kneelingSrc(kind,kneeling,"idle"):armsLost?armLossSrc(kind,"idle"):art.src;
    anchors=legsLost?kneelingAnchors[kind][kneeling].idle:null;
    imageWidth=1024;
    imageHeight=1536;
  }
  const wounds=bodyWounds(actor);
  const description=[actor.name,...wounds.map(({id,level})=>`${parts[id]} ${labels[level]}`)].join(" · ");
  const decals=woundDecals(kind,"idle",wounds,anchors,campWoundAppearance);
  return `<div class="rest-guest" data-kind="${kind}" data-condition="${variant}" role="img" aria-label="${description}"
    style="--seat-x:${x}%;--seat-bottom:${bottom}%;--seat-width:${width}%;z-index:${100-bottom}">
    <img class="rest-portrait" src="${src}" width="${imageWidth}" height="${imageHeight}" alt="">
    ${decals?`<div class="actor-wound-decals" aria-hidden="true">${decals}</div>`:""}</div>`;
}

function restScene(finished){
  const roster=new Map(livingRoster().map(side=>{
    const actor=game[side], art=partyArt[side==="player"?"player":actor.kind];
    return [art.kind,{actor,art}];
  }));
  const occupants=finished?[{order:[...roster.keys()],seats:campDepartureSeats}]:campSides;
  const guests=occupants.flatMap(({order,seats})=>{
    const nearby=order.filter(kind=>roster.has(kind));
    return nearby.map((kind,index)=>{
      const {actor,art}=roster.get(kind);
      return locationActor(actor,art,seats[nearby.length][index],finished);
    });
  }).join("");
  const src=finished?"art/locations/camp-departure.webp":"art/locations/camp.webp";
  const alt=finished?"재가 남은 화덕을 지나 다음 통로로 떠날 채비":"어두운 감옥 통로 옆에 급히 피운 모닥불";
  const sparks=finished?"":`<div class="camp-spark-field" aria-hidden="true">${campSparks.map(([x,y,drift,duration,delay,size])=>
    `<i class="camp-spark" style="--x:${x}%;--y:${y}%;--drift:${drift}px;--duration:${duration}s;--delay:${delay}s;--size:${size}px"></i>`).join("")}</div>`;
  return roomScene(src,alt,`${sparks}<div class="rest-guests${finished?" is-cold":""}">${guests}</div>`);
}

function surfaceExitScene(){
  const roster=livingRoster();
  const spacing=Math.min(14,56/Math.max(1,roster.length-1));
  const survivors=roster.map((side,index)=>{
    const actor=game[side], art=partyArt[side==="player"?"player":actor.kind];
    const x=55+(index-(roster.length-1)/2)*spacing;
    const bottom=13+index*2;
    return locationActor(actor,art,[x,bottom,roster.length<3?22:18],true);
  }).join("");
  return roomScene("art/locations/surface-exit.webp","감옥 문 밖으로 새벽빛이 비치는 지상 출구",`<div class="rest-guests">${survivors}</div>`);
}

function captureScene(){
  return `<figure class="room-scene capture-scene" style="--lantern-x:64.3%;--lantern-y:76.4%">
    <img class="room-backdrop" src="${captureBackdrop}" width="1200" height="675" alt="수녀의 등불이 꺼지고 뒤에서 사형수의 그림자가 다가온다.">
    <img class="capture-pursuer" src="${pursuerArt}" width="480" height="720" alt="">
    <span class="capture-dark" aria-hidden="true"></span><span class="capture-lantern" aria-hidden="true"></span></figure>`;
}

function treatmentPanel(){
  const area=areas[game.area];
  if(area.type!=="rest") return "";
  const patients=partySides().map(side=>({side,actor:game[side],wounds:woundedParts(game[side])}));
  const treated=game.stairTreatment?.area===game.area?game.stairTreatment:null;
  const hasWounds=patients.some(patient=>patient.wounds.length);
  const canTreat=!game.restFinished && !game.stairTreatment && hasWounds && game.distance>1;
  let message="도망 여유 −1 · 부위 내구도 최대 +2";
  if(game.restFinished) message="";
  else if(game.stairTreatment) message="치료 기회 사용";
  else if(!hasWounds) message="치료할 부상 없음";
  else if(game.distance<=1) message="도망 여유 부족";
  const options=canTreat?patients.filter(({wounds})=>wounds.length).map(({side,actor,wounds})=>{
    const buttons=wounds.map(([id,part])=>`<button type="button" class="btn" data-action="treat" data-side="${side}" data-value="${id}" aria-label="${actor.name} ${parts[id]} 치료 ${part.hp}에서 ${Math.min(part.max,part.hp+2)}">${parts[id]} ${part.hp} → ${Math.min(part.max,part.hp+2)}</button>`).join("");
    return `<div class="treatment-group" data-patient="${side}"><strong>${actor.name}</strong><div class="treatment-options">${buttons}</div></div>`;
  }).join(""):"";
  const finish=!canTreat && !game.restFinished?`<button class="btn rest-finish" type="button" data-action="finish-rest">휴식 마치기</button>`:"";
  const illustration=treated?eventIllustration("aid","healing","치료 완료",`${treated.name} ${parts[treated.target]} 내구도 +${treated.recovered}`):"";
  return `<section class="treatment" aria-label="${area.name} 치료">${restScene(game.restFinished)}${!treated && message?`<p>${message}</p>`:""}
    ${options?`<div class="treatment-options">${options}</div>`:""}${finish}${illustration}</section>`;
}

function shopTargets(id){
  return blackMarket.targets(game,id);
}

function shopOfferIssue(id,options){
  return blackMarket.issue(game,id,options);
}

function buyShopOffer(id,target=""){
  return blackMarket.buy(game,id,target);
}

function roomDecision(kind,{name,art,alt,description},content){
  return `<section class="room-decision ${kind}-room" aria-label="${name}">
    ${roomScene(art,alt)}<div class="room-decision-copy">
      <div class="room-decision-heading"><h2>${name}</h2><small>동전 ${game.coins}</small></div>
      ${description?`<p>${description}</p>`:""}${content}
    </div></section>`;
}

function shopPanel(){
  if(areas[game.area].type!=="shop") return "";
  const stock=Object.entries(shopOffers).map(([id,{name,price,effect,art}])=>{
    const options=shopTargets(id), issue=shopOfferIssue(id,options);
    const result=game.shopPurchases.get(id), selection=game.shopSelections.get(id);
    const button=issue || `동전 ${price} · 구입`;
    const targets=options.length && !issue?`<select data-shop-target="${id}" aria-label="${name} 사용할 대상">
      ${options.map(({value,label})=>`<option value="${value}"${value===selection?" selected":""}>${label}</option>`).join("")}</select>`:"";
    return `<article class="shop-item"><img src="${art}" alt="" width="180" height="180" decoding="async">
      <div class="shop-item-copy"><h3>${name}</h3>${result?`<p class="shop-result" id="shop-result-${id}" tabindex="-1">${result}</p>`:`<p>${effect}</p>`}</div>
      ${targets}<button type="button" class="btn" data-action="buy-shop" data-value="${id}" ${issue?"disabled":""} aria-label="${name} · ${button}">${button}</button></article>`;
  }).join("");
  return roomDecision("shop",{name:"암시장",art:"art/locations/shop.webp",alt:"나무 진열대 뒤에 선 암시장 상인"},`<div class="shop-stock">${stock}</div>`);
}

function partyNotice(){
  const fallen=game.deadCompanions.map(kind=>companionTypes[kind].name);
  return fallen.length?`<p class="party-notice">사망 · ${fallen.join(" · ")}</p>`:"";
}

function recruitmentTraitPreview(candidate,outgoing){
  const sides=partySides();
  const before=countTraits(sides.map(side=>game[side]));
  const after=countTraits([...sides.filter(side=>side!==outgoing).map(side=>game[side]),candidate]);
  const changes=[...new Set([...after.keys(),...before.keys()])].filter(id=>traits[id].effect &&
    ((after.get(id) || 0)>=traitThreshold)!==((before.get(id) || 0)>=traitThreshold));
  return changes.length?`<div class="trait-preview" aria-label="시너지 변화">${changes.map(id=>
    traitChip(id,`preview-${outgoing || "join"}`,`${before.get(id) || 0}→${after.get(id) || 0}`)).join("")}</div>`:"";
}

function companionEncounterPanel(){
  const kind=game.pendingCompanion, type=companionTypes[kind];
  if(!canRecruit(kind)) return "";
  const sides=partySides();
  const full=sides.length===formationRanks.length;
  const choices=(full?sides.filter(side=>side!=="player"):[null]).map(outgoing=>`<div class="recruit-choice">
    <button type="button" class="btn ${full?"":"primary"}" data-action="recruit" data-value="${kind}"${outgoing?` data-side="${outgoing}"`:""}>${outgoing?`${game[outgoing].name} 대신 영입`:"함께 가기"}</button>
    ${recruitmentTraitPreview(type,outgoing)}</div>`).join("");
  return `<section class="treatment companion-encounter" aria-label="동료와의 만남"><img class="encounter-portrait" src="art/encounters/${kind}.webp" width="960" height="540" alt=""><div class="encounter-copy"><h3 tabindex="-1">${type.name}</h3>
    ${traitTags(type,"candidate")}
    <div class="treatment-options">${choices}
      <div class="recruit-choice"><button type="button" class="btn" data-action="decline-companion">${full?"두고 가기":"지나가기"}</button></div></div></div></section>`;
}

function mysteryPanel(){
  const event=mysteryEvents[game.pendingMystery];
  if(!event) return "";
  const blocked=mysteryBlockReason(event), distance=mysteryDistance(event);
  const values=[["도망 여유",game.distance,distance],["동전",game.coins,event.coins]];
  const preview=values.filter(([, ,change])=>change).map(([label,current,change])=>
    `<div><dt>${label}</dt><dd data-change="${change<0?"cost":"gain"}">${current} → ${current+change}</dd></div>`).join("");
  const detail=blocked?`<p class="room-blocked" id="mystery-detail">${blocked}</p>`:
    `<dl class="mystery-preview" id="mystery-detail" aria-label="선택 후 변화">${!distance?'<div><dt>자물쇠 따개</dt><dd>사용</dd></div>':""}${preview}</dl>`;
  return roomDecision("mystery",event,`${detail}<div class="room-choices">
    <button type="button" class="btn primary" data-action="mystery" data-value="take" ${blocked?"disabled":""} aria-describedby="mystery-detail">${event.action}</button>
    <button type="button" class="btn" data-action="mystery" data-value="skip">지나치기</button></div>`);
}

function routePanel(){
  if(game.training) return `<section class="routes">${mapPanel()}</section>`;
  const gain=travelGain();
  const result=game.mysteryResult;
  const receipt=result?`<div class="room-result" id="mystery-result" tabindex="-1"><b>${result.name}</b><span>${result.effect}</span></div>`:"";
  return `${shopPanel()}<section class="routes" aria-label="이동">${receipt}${game.distance+gain<=0?'<p class="danger">이동 시 추격에 붙잡힘</p>':""}
    ${partyNotice()}${treatmentPanel()}${mapPanel()}</section>`;
}


function render(){
  const area=areas[game.area];
  document.querySelector("#location").textContent=(area.type==="mystery"?"? 방":area.name)+(game.mapConfig?` · ${game.mapConfig.seed}`:"");
  document.querySelector("#status").innerHTML=gauges();
  document.querySelector("#training-tools").hidden=!game.training;
  if(game.training){
    const enemyToggle=document.querySelector("#training-enemy");
    enemyToggle.disabled=game.phase==="combat";
    enemyToggle.setAttribute("aria-pressed",String(game.trainingEnemyActs));
    enemyToggle.textContent=game.trainingEnemyActs?"적 행동 켬":"적 행동 끔";
    const damage=document.querySelector("#training-enemy-damage");
    damage.disabled=game.phase==="combat";
    damage.value=String(game.trainingEnemyDamage);
    const injuryForm=document.querySelector("#training-injury");
    injuryForm.hidden=game.phase!=="combat";
    if(!injuryForm.hidden){
      const select=document.querySelector('#training-injury [name="side"]');
      const sides=partySides();
      const options=sides.map(side=>`<option value="${side}">${game[side].name}</option>`).join("");
      if(select.innerHTML!==options){
        const current=select.value;
        select.innerHTML=options;
        select.value=sides.includes(current)?current:"player";
      }
    }
  }
  renderQaTools();
  renderAutoControls();
  const inCombat=game.phase==="combat";
  const pursuitWarning=inCombat && !game.training && game.distance<=pursuitWarningDistance;
  const sameRun=lastPursuit?.player===game.player;
  const pursuitEntering=pursuitWarning && (!sameRun || !lastPursuit.warning);
  const pursuitAdvancing=inCombat && sameRun && game.distance<lastPursuit.distance;
  if(sameRun && lastPursuit.distance!==game.distance && !matchMedia("(prefers-reduced-motion: reduce)").matches){
    const pursuer=document.querySelector(".pursuit-track .pursuer");
    const old=pursuerPosition(lastPursuit.distance);
    const end=pursuerPosition(game.distance);
    pursuer.animate([
      {left:`${old}%`,translate:"0 0"},
      {left:`${old+(end-old)*.65}%`,translate:"0 -3px",offset:.58},
      {left:`${end}%`,translate:"0 0"}
    ],{duration:410,easing:"ease-out"});
  }
  lastPursuit={player:game.player,distance:game.distance,warning:pursuitWarning};
  const announcement=document.querySelector("#pursuit-announcement");
  const pursuitMessage=pursuitWarning?`사형수 접근 · 도망 여유 ${game.distance}`:"";
  if(announcement.textContent!==pursuitMessage) announcement.textContent=pursuitMessage;
  const stage=document.querySelector("#stage");
  const expandedBodies=new Set(Array.from(stage.querySelectorAll(".actor-body-status[open]"),node=>node.dataset.side));
  combatHudResize.disconnect();
  mapResize.disconnect();
  if(inCombat || game.phase==="prep") warmCombatArt();
  if(inCombat){
    const eyes=condition(game.player,"eyes"), intents=battleIntent();
    const sides=[...partySides().reverse(),"enemy"];
    const warning=pursuitWarning?`<div class="pursuit-warning">${icon("pursuer")}<b>사형수가 가까워졌어요</b><span>도망 여유 ${game.distance}</span></div>`:"";
    const depth=!game.training && {1:"imminent",2:"close",3:"approaching",4:"distant"}[game.distance];
    const shadow=depth?`<span class="pursuit-shadow" data-depth="${depth}" aria-hidden="true"><img src="${pursuerArt}" alt="" width="480" height="720"></span>`:"";
    stage.innerHTML=`<div class="stage-combat${pursuitWarning?" is-pursued":""}${pursuitEntering?" pursuit-entering":""}${pursuitAdvancing?" pursuit-advancing":""}">${warning}
      <div class="combat-field" style="--combat-columns:${sides.length};${arenaStyle(area)}">${shadow}${intentPanel(intents,eyes)}<div class="combat ${sides.length>2?"party-combat":""}">${sides.map(side=>bodyPanel(side,intents,eyes)).join("")}</div>${combatWoundPanel(sides)}<div class="combat-impact-layer" aria-hidden="true"></div></div>
    </div>${skillPanel()}${partyNotice()}`;
    if(pursuitEntering) playPursuitSound();
    for(const detail of stage.querySelectorAll(".actor-body-status")) detail.open=expandedBodies.has(detail.dataset.side);
    const scene=stage.querySelector(".stage-combat");
    layoutCombatHud(scene);
    combatHudResize.observe(scene);
  }else if(game.phase==="prep"){
    stage.innerHTML=prepPanel(Boolean(stage.querySelector(".prep-vitals[open]")));
  }else if(game.phase==="reward"){
    stage.innerHTML=rewardPanel();
  }else if(game.phase==="route"){
    const choice=companionEncounterPanel() || mysteryPanel();
    stage.innerHTML=choice || routePanel();
    if(!choice){
      const layout=stage.querySelector(".map-layout");
      layoutMapLinks(layout);
      mapResize.observe(layout);
    }
  }else{
    const won=game.phase==="won";
    const escaped=won && !game.training;
    const captured=game.phase==="lost" && !game.training && game.lossCause==="pursuit";
    if(!captured || !stage.querySelector(".capture-scene")) stage.innerHTML=`<section class="routes${escaped?" escape-panel":""}">${escaped?surfaceExitScene():captured?captureScene():""}
      <h2>${game.training?"훈련 종료":won?"탈출 성공":captured?"추격에 붙잡힘":"탈출 실패"}</h2>${!won && !captured?`<p class="muted">${game.reason}</p>`:""}
      ${game.qaUses?`<p class="qa-summary">QA ${won?"클리어":"테스트"} · 치트 ${game.qaUses}회 사용</p>`:""}
      <p><button type="button" class="btn primary" data-action="restart">한 판 더</button></p></section>`;
  }
  document.querySelector("#log").innerHTML=game.log.map(message=>`<li>${message}</li>`).join("");
  if(minimapDialog.open) renderMinimap();
  scheduleAutoBattle();
}

function qaAvailable(action){
  if(game.training && action!=="heal") return false;
  return action==="win"?game.phase==="combat" || (game.phase==="prep" && loadoutsReady()):
    ["prep","combat","reward","route"].includes(game.phase);
}

function renderQaTools(){
  const panel=document.querySelector("#qa-tools");
  panel.hidden=!qaOpen;
  if(qaOpen) for(const button of panel.querySelectorAll("button")) button.disabled=!qaAvailable(button.dataset.value);
}

function runQaAction(action){
  if(!qaOpen || combatPresentation || routeTravel || !qaAvailable(action)) return;
  switch(action){
    case "win":
      if(game.phase==="prep") beginCombat();
      game.enemy.hp=0;
      record("QA · 전투 즉시 승리");
      finishCombat();
      break;
    case "heal":
      for(const side of partySides()){
        const actor=game[side];
        actor.hp=actor.maxHp;
        for(const part of Object.values(actor.body)) part.hp=part.max;
      }
      record("QA · 살아 있는 아군의 전체 HP와 모든 부위 회복");
      break;
    case "margin":
      game.distance+=5;
      record("QA · 도망 여유 +5");
      break;
    default: return;
  }
  game.qaUses++;
  finishBoardAction();
}

function unlockCombatAudio(){
  if(!soundEnabled) return;
  const Audio=window.AudioContext || window.webkitAudioContext;
  if(!Audio) return;
  if(!audioContext){
    audioContext=new Audio();
    audioOutput=audioContext.createGain();
    audioOutput.gain.value=.5;
    audioOutput.connect(audioContext.destination);
  }
  if(audioContext.state==="suspended") audioContext.resume().catch(()=>{});
}

function toggleCombatAudio(){
  soundEnabled=!soundEnabled;
  const button=document.querySelector("#sound");
  button.setAttribute("aria-pressed",String(soundEnabled));
  button.textContent=soundEnabled?"효과음 켬":"효과음 끔";
  if(audioOutput) audioOutput.gain.value=soundEnabled ? .5 : 0;
  unlockCombatAudio();
}

function tone(ctx, output, at, duration, level, startPitch, endPitch, wave){
  const oscillator=ctx.createOscillator();
  const gain=ctx.createGain();
  oscillator.type=wave;
  oscillator.frequency.setValueAtTime(startPitch,at);
  oscillator.frequency.exponentialRampToValueAtTime(endPitch,at+duration);
  gain.gain.setValueAtTime(level,at);
  gain.gain.exponentialRampToValueAtTime(.001,at+duration);
  oscillator.connect(gain).connect(output);
  oscillator.start(at);
  oscillator.stop(at+duration);
}

function collisionNoise(ctx, output, at, duration, level, filterType, cutoff){
  if(!noiseBuffers.has(ctx)){
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.24),ctx.sampleRate);
    const samples=buffer.getChannelData(0);
    const random=crypto.getRandomValues(new Uint16Array(samples.length));
    for(let i=0;i<samples.length;i++) samples[i]=random[i]/32767.5-1;
    noiseBuffers.set(ctx,buffer);
  }
  const source=ctx.createBufferSource();
  const filter=ctx.createBiquadFilter();
  const gain=ctx.createGain();
  source.buffer=noiseBuffers.get(ctx);
  filter.type=filterType;
  filter.frequency.value=cutoff;
  gain.gain.setValueAtTime(level,at);
  gain.gain.exponentialRampToValueAtTime(.001,at+duration);
  source.connect(filter).connect(gain).connect(output);
  source.start(at);
  source.stop(at+duration);
}

function synthesizeImpact(ctx,output,event){
  const at=ctx.currentTime+.006;
  const metallic=event.blocked || event.removed;
  if(metallic){
    tone(ctx,output,at,.18,.2,1460,1410,"triangle");
    tone(ctx,output,at,.13,.13,2170,2230,"sine");
    tone(ctx,output,at,.077,.09,3120,3040,"sine");
    collisionNoise(ctx,output,at,.07,.27,"highpass",1800);
  }
  if(event.dealt){
    const thudAt=at+(metallic ? .043 : 0);
    tone(ctx,output,thudAt,.16,.42,130,51,"sine");
    collisionNoise(ctx,output,thudAt,.1,.39,"lowpass",580);
  }
  if(event.defeated || event.critical){
    const [startPitch,endPitch]=event.defeated?[82,36]:[290,162];
    tone(ctx,output,at,.25,.28,startPitch,endPitch,"triangle");
  }
}

function playBellboyBell(){
  if(!soundEnabled || audioContext?.state!=="running") return;
  const at=audioContext.currentTime+.008;
  tone(audioContext,audioOutput,at,.36,.19,880,878,"sine");
  tone(audioContext,audioOutput,at,.19,.09,1766,1750,"triangle");
  tone(audioContext,audioOutput,at,.10,.045,2370,2340,"sine");
}

function playHealingSound(){
  if(!soundEnabled || audioContext?.state!=="running") return;
  const at=audioContext.currentTime+.008;
  tone(audioContext,audioOutput,at,.19,.12,523,587,"sine");
  tone(audioContext,audioOutput,at+.08,.23,.105,659,784,"sine");
}

function playPursuitSound(){
  if(!soundEnabled || audioContext?.state!=="running") return;
  const at=audioContext.currentTime+.01;
  collisionNoise(audioContext,audioOutput,at,.22,.17,"bandpass",850);
  collisionNoise(audioContext,audioOutput,at+.16,.17,.13,"bandpass",1180);
  tone(audioContext,audioOutput,at+.035,.24,.1,760,680,"triangle");
  tone(audioContext,audioOutput,at+.17,.18,.08,1220,1120,"sine");
}

function eventIllustration(card,kind,title,detail){
  return `<div class="event-illustration ${kind}" style="--event-art:var(--art-${cards[card].art || card})"><strong>${title}</strong><small>${detail}</small></div>`;
}

function markSkillActivation(slot,event){
  const reward=cards[event.card].reward;
  const traitsUsed=(event.synergies || []).map(id=>`<span class="skill-activation-trait">${icon(traits[id].icon)}+${traits[id].bonus}</span>`).join("");
  slot.querySelector(".skill-activation").innerHTML=`${reward?"보상":"발동"}${traitsUsed}`;
  slot.dataset.activation=reward?"reward":"skill";
}

function announceCombatAction(event){
  const card=cards[event.card];
  const recipient=event.side==="enemy"?"적":game[event.side]?.name || "동료";
  const targets=event.targets.map(id=>parts[id]).join("·");
  let result;
  switch(event.type){
    case "hit":{
      const damage=event.card==="counter"?"반격 피해":"피해";
      const outcomes=[event.gateBlock?"철문에 막힘":!event.dealt && event.blocked?"완전 방어":`${damage} ${event.dealt}`];
      if(event.blocked) outcomes.push(`${event.blocked} 막음`);
      if(event.removed) outcomes.push(`가드 −${event.removed}`);
      if(event.injury) outcomes.push(labels[event.injury]);
      result=outcomes.join(" · ");
      break;
    }
    case "guard":
      result=`${event.targets.length>1?"각 ":""}가드 +${event.added}${event.card==="counter"?" · 반격 준비":""}`;
      break;
    case "heal":
      result=`내구도 +${event.recovered}${event.restored?" · 정상 회복":""}`;
      break;
    case "setup":
      result=event.removed?`가드 −${event.removed}`:card.lines[0];
      break;
  }
  const synergies=event.synergies || [];
  const emphasis=[event.critical?`치명타 +${event.critical}`:"",event.defeated?(event.side==="enemy"?"격파":"쓰러짐"):""].filter(Boolean).join(" · ");
  document.querySelector("#combat-announcement").textContent=
    [card.reward?"보상 기술":"",event.trainingOverride?"QA":card.name,`${recipient} ${targets}`,result,emphasis,...synergies.map(id=>`${traits[id].name} +${traits[id].bonus}`)].filter(Boolean).join(" · ");
}

function cancelCombatPresentation(){
  if(!combatPresentation) return;
  for(const timer of combatPresentation.timers) clearTimeout(timer);
  if(typeof CPHitFx!=="undefined") CPHitFx.cancel(combatPresentation.scene);
  restoreActorPoses(combatPresentation.scene);
  delete combatPresentation.scene.dataset.impact;
  combatPresentation.scene.querySelectorAll(".impact, .combat-skill-emote, .part-loss-pop, .healing-flight, .arrow-flight, .seal-flight").forEach(el=>el.remove());
  combatPresentation.scene.querySelectorAll(".combat-impact-number").forEach(el=>el.remove());
  for(const slot of combatPresentation.stage.querySelectorAll(".skill-slot[data-activation]")) delete slot.dataset.activation;
  document.querySelector("#combat-announcement").textContent="";
  combatPresentation.stage.inert=false;
  combatPresentation=null;
}

function updateArmLossMarker(panel,pose,visible){
  const marker=panel.querySelector(".arm-loss-marker");
  const [x,y]=armLossAnchor(panel.dataset.portrait,pose);
  marker.style.setProperty("--x",`${x}%`);
  marker.style.setProperty("--y",`${y}%`);
  marker.hidden=!visible;
}

function updateWoundDecals(panel,pose,wounds){
  const layer=panel.querySelector(".actor-wound-decals");
  if(!layer) return;
  if(wounds){
    layer.dataset.wounds=JSON.stringify(wounds);
    if(wounds.some(({id,level})=>id==="legs" && level==="lost")) panel.dataset.legsLost="";
    else delete panel.dataset.legsLost;
  }else if(layer.dataset.wounds==="[]") return;
  const spriteSrc=panel.querySelector(".actor-sprite").getAttribute("src");
  layer.innerHTML=combatWoundDecals(panel.dataset.portrait,pose,wounds || JSON.parse(layer.dataset.wounds),currentKneelingAnchors(panel),spriteSrc);
}

function markKneelingPose(panel,kneeling){
  if(kneeling) panel.dataset.kneeling=kneeling.pose;
  else delete panel.dataset.kneeling;
}

function setActorPose(scene,side,pose){
  const panel=scene.querySelector(`.actor-${side}`);
  const sprite=panel?.querySelector(".actor-sprite");
  if(!sprite) return;
  const kind=panel.dataset.portrait;
  const armsLost=panel.dataset.armsLost!==undefined;
  const kneeling=panel.dataset.legsLost!==undefined?readyKneelingPose(kind,pose,armsLost):null;
  const variant=armsLost?readyArmLossSrc(kind,pose):null;
  const src=kneeling?.src || variant || motionArt[kind]?.[pose];
  if(!combatArtReady(src)) return;
  if(!sprite.dataset.pose){
    if(sprite.tagName==="IMG") sprite.dataset.idleSrc=sprite.getAttribute("src");
    else sprite.dataset.idleBackground=sprite.style.backgroundImage;
  }
  sprite.dataset.pose=pose;
  markKneelingPose(panel,kneeling);
  if(sprite.tagName==="IMG") sprite.setAttribute("src",src);
  else sprite.style.backgroundImage=`url("${src}")`;
  if(armsLost) updateArmLossMarker(panel,pose,!variant && !kneeling);
  updateWoundDecals(panel,pose);
}

function setBellboyPresentation(scene,phase){
  const panel=scene?.querySelector(".bellboy-actor");
  if(!panel) return;
  panel.dataset.bellboyPhase=phase;
  panel.querySelector(".bellboy-gate").setAttribute("aria-label",phase==="staggered"?"철문 열림":"철문 닫힘");
}

function restoreActorPoses(scene,keepDefeated=false){
  scene?.querySelectorAll(".panel[data-lunge]").forEach(panel=>{
    delete panel.dataset.lunge;
    delete panel.dataset.attackMotion;
  });
  if(!keepDefeated) scene?.querySelectorAll(".actor-sprite[data-defeated]").forEach(sprite=>delete sprite.dataset.defeated);
  scene?.querySelectorAll(".actor-sprite[data-pose]").forEach(sprite=>{
    if(keepDefeated && sprite.dataset.pose==="defeat") return;
    if(sprite.tagName==="IMG"){
      const panel=sprite.closest(".panel");
      const armsLost=panel.dataset.armsLost!==undefined;
      const kneeling=panel.dataset.legsLost!==undefined?readyKneelingPose(panel.dataset.portrait,"idle",armsLost):null;
      const variant=armsLost?readyArmLossSrc(panel.dataset.portrait,"idle"):null;
      sprite.setAttribute("src",kneeling?.src || variant || sprite.dataset.idleSrc);
      markKneelingPose(panel,kneeling);
      if(armsLost) updateArmLossMarker(panel,"idle",!variant && !kneeling);
      updateWoundDecals(panel,"idle");
    }else sprite.style.backgroundImage=sprite.dataset.idleBackground;
    delete sprite.dataset.pose;
    delete sprite.dataset.idleSrc;
    delete sprite.dataset.idleBackground;
  });
}

function showImpact(scene,event){
  const panel=scene.querySelector(`.actor-${event.side}`);
  const layer=scene.querySelector(".combat-impact-layer");
  const frame=layer.getBoundingClientRect();
  const projectile=attackFlight(event);
  for(const target of event.targets){
    const tile=panel.querySelector(`[data-value="${target}"]`);
    const figure=tile.closest(".actor-figure, .companion-parts");
    const bounds=figure.getBoundingClientRect();
    const pose=event.defeated?"defeat":event.dealt?"hit":panel.querySelector(".actor-sprite").dataset.pose || "idle";
    const armsLost=panel.dataset.armsLost!==undefined || event.injury==="lost" && target==="arms";
    const legsLost=panel.dataset.legsLost!==undefined || event.injury==="lost" && target==="legs";
    const kneeling=event.dealt && legsLost?readyKneelingPose(panel.dataset.portrait,pose,armsLost)?.anchors:currentKneelingAnchors(panel);
    const point=event.dealt || kneeling?woundAnchors(panel.dataset.portrait,pose,kneeling)?.[target]:null;
    const {x,y}=point?{x:bounds.width*point[0]/100,y:bounds.height*point[1]/100}:centerInFrame(tile,bounds);
    const impact=document.createElement("span");
    impact.className=`impact${event.type==="heal"?" is-heal":event.defeated?" is-finisher":event.critical?" is-critical":event.dealt?"":" is-guard"}`;
    if(event.gateBlock) impact.classList.add("is-gate");
    if(projectile===attackFlights.seal) impact.classList.add("is-seal");
    else if(projectile===attackFlights.arrow && event.dealt) impact.classList.add("is-arrow");
    impact.dataset.part=target;
    impact.setAttribute("aria-hidden","true");
    impact.style.setProperty("--x",`${x}px`);
    impact.style.setProperty("--y",`${y}px`);
    const damage=event.dealt?`<b class="damage">−${event.dealt}</b>`:"";
    const block=event.blocked?`<b class="block">막음 ${event.blocked}</b>`:"";
    const removed=event.removed?`<b class="block">가드 −${event.removed}</b>`:"";
    const added=event.added?`<b class="block">가드 +${event.added}</b>`:"";
    const healed=event.recovered?`<b class="heal">+${event.recovered}</b>`:"";
    panel.querySelector(`.impact[data-part="${target}"]`)?.remove();
    const shards=projectile===attackFlights.seal && event.removed?'<span class="seal-shard"></span>'.repeat(3):"";
    impact.innerHTML=`<span class="impact-ring"></span>${shards}`;
    figure.append(impact);
    if(damage || block || removed || added || healed){
      const numberPoint={x:bounds.left-frame.left+x,y:bounds.top-frame.top+y};
      const number=document.createElement("span");
      number.className=`combat-impact-number${event.defeated?" is-finisher":event.critical?" is-critical":""}`;
      number.dataset.side=event.side;
      number.style.setProperty("--y",`${numberPoint.y}px`);
      number.innerHTML=`<span class="impact-part">${icon(event.gateBlock?"gate":target)}</span><span class="impact-copy">${damage}${block}${removed}${added}${healed}</span>`;
      layer.append(number);
      if(typeof CPHitFx!=="undefined") CPHitFx.decorate(number,event,target,autoSpeed);
      const offset=frame.width<580?27:36;
      const left=event.side==="enemy"?numberPoint.x-offset-number.offsetWidth:numberPoint.x+offset;
      number.style.left=`${Math.max(4,Math.min(left,frame.width-number.offsetWidth-4))}px`;
    }
    if(event.injury==="lost" && target!=="eyes"){
      const position=point?`--x:${point[0]}%;--y:${point[1]}%`:`--x:${x}px;--y:${y}px`;
      figure.insertAdjacentHTML("beforeend",`<span class="part-loss-pop" data-part="${target}" style="${position}" aria-hidden="true">${icon("partLost")}</span>`);
    }
  }
}

function visibleGuards(event){
  return event.side!=="enemy" && condition(game.player,"eyes")==="lost"?[]:event.guards || [];
}

function showActorHealth(panel,event){
  const {maxHp,infinite}=game[event.side];
  const defeated=event.defeated?(event.side==="enemy"?"격파":"쓰러짐"):"";
  panel.querySelector(".foe-health").innerHTML=actorHealth({hp:event.hp,maxHp,infinite},defeated,visibleGuards(event));
}

function showWoundOutcome(scene,panel,event){
  if(!event.wounds) return;
  const pose=panel.querySelector(".actor-sprite").dataset.pose || "idle";
  updateWoundDecals(panel,pose,event.wounds);
  if(event.bodyStatus){
    const eyesLost=event.wounds.some(({id,level})=>id==="eyes" && level==="lost");
    panel.querySelector(".actor-body-status summary").innerHTML=bodyStatusSummary(event.bodyStatus,eyesLost);
  }
  const band=scene.querySelector(".combat-wounds");
  band.querySelector(`[data-wounds-side="${event.side}"]`).innerHTML=woundChips(event.wounds,event.side,event.legChange?.before);
  band.hidden=!band.querySelector(".wound-chip");
}

function showHitOutcome(scene,event){
  const panel=scene.querySelector(`.actor-${event.side}`);
  if(event.side==="player" && event.injury==="lost" && event.targets.includes("eyes")){
    scene.querySelectorAll(".panel:not(.actor-enemy) .actor-guard").forEach(badge=>badge.innerHTML="");
  }
  if(event.side!=="enemy" && event.injury==="lost" && event.targets.includes("arms")){
    panel.dataset.armsLost="";
    updateArmLossMarker(panel,"idle",true);
  }
  showActorHealth(panel,event);
  showWoundOutcome(scene,panel,event);
  if(event.defeated){
    setActorPose(scene,event.side,"defeat");
    panel.querySelector(".actor-sprite").dataset.defeated="";
  }else if(event.dealt) setActorPose(scene,event.side,"hit");
}

const overheadAttacks=new Set(["heavy","crush","irons","votiveStrike","chainSwing"]);
const healingTime=420;
const healingFlightTime=240;
const attackFlights={
  arrow:{className:"arrow-flight",duration:190,maxRise:22,curve:.045,pose:"release",
    origins:{release:[.82,.32],attack:[.94,.31],idle:[.80,.45]}},
  seal:{className:"seal-flight",duration:240,maxRise:43,curve:.12,
    origins:{attack:[.91,.29],idle:[.85,.21]}}
};
const healingOrigins={
  nun:{heal:[.50,.47],idle:[.22,.57]},
  shaman:{heal:[.81,.18],idle:[.85,.18]}
};

function combatFlightPoints(scene,event,origins){
  const field=scene.querySelector(".combat-field");
  const caster=scene.querySelector(`.actor-${event.from} .actor-sprite`);
  const target=scene.querySelector(`.actor-${event.side} .hotspots [data-value="${event.targets[0]}"]`);
  const frame=field.getBoundingClientRect();
  const source=caster.getBoundingClientRect();
  const kneeling=currentKneelingAnchors(caster.closest(".panel"));
  const [x,y]=kneeling?[Math.min(95,kneeling.eyes[0]+17)/100,(kneeling.eyes[1]+8)/100]:origins[caster.dataset.pose] || origins.idle;
  const start={x:source.left-frame.left+source.width*x,y:source.top-frame.top+source.height*y};
  const recipient=target.closest(".panel");
  const recipientKneeling=currentKneelingAnchors(recipient);
  let end=centerInFrame(target,frame);
  if(recipientKneeling){
    const rect=target.closest(".actor-figure").getBoundingClientRect();
    const [tx,ty]=woundAnchors(recipient.dataset.portrait,"idle",recipientKneeling)[event.targets[0]];
    end={x:rect.left-frame.left+rect.width*tx/100,y:rect.top-frame.top+rect.height*ty/100};
  }
  return {field,start,end};
}

function showHealingFlight(scene,event,origin){
  const {field,start,end}=combatFlightPoints(scene,event,origin);
  const rise=Math.min(62,Math.max(20,Math.abs(end.x-start.x)*.15));
  const keyframes=Array.from({length:9},(_,index)=>{
    const progress=index/8;
    const left=start.x+(end.x-start.x)*progress;
    const top=start.y+(end.y-start.y)*progress-4*rise*progress*(1-progress);
    return {transform:`translate(${left}px,${top}px) translate(-50%,-50%)`};
  });
  const flight=document.createElement("span");
  flight.className="healing-flight";
  flight.setAttribute("aria-hidden","true");
  flight.innerHTML='<span class="healing-spark"></span>'.repeat(3);
  field.append(flight);
  const startTime=document.timeline.currentTime;
  Array.from(flight.children).forEach((spark,index)=>{
    const animation=spark.animate(keyframes,{duration:healingFlightTime,delay:index*22,fill:"both"});
    if(startTime!==null) animation.startTime=startTime;
  });
}

function attackFlight(event){
  if(event.type!=="hit") return null;
  const kind=game[event.from]?.kind;
  if(kind==="archer" && cards[event.card].weapon==="bow") return attackFlights.arrow;
  return kind==="shaman" && (event.card==="unseal" || event.card==="exposeHex")?attackFlights.seal:null;
}

function showAttackFlight(scene,event,projectile){
  const {field,start,end}=combatFlightPoints(scene,event,projectile.origins);
  const dx=end.x-start.x,dy=end.y-start.y;
  const rise=Math.min(projectile.maxRise,Math.abs(dx)*projectile.curve);
  const keyframes=Array.from({length:7},(_,index)=>{
    const progress=index/6;
    const x=start.x+dx*progress;
    const y=start.y+dy*progress-4*rise*progress*(1-progress);
    const angle=Math.atan2(dy-4*rise*(1-2*progress),dx);
    return {transform:`translate(${x}px,${y}px) rotate(${angle}rad)`};
  });
  const flight=document.createElement("span");
  flight.className=projectile.className;
  flight.setAttribute("aria-hidden","true");
  if(projectile===attackFlights.seal) flight.innerHTML='<span class="seal-trail"></span>';
  field.append(flight);
  const animation=flight.animate(keyframes,{duration:projectile.duration,fill:"both"});
  const time=document.timeline.currentTime;
  if(time!==null) animation.startTime=time;
}

function showSkillEmote(scene,event,emphasis,duration){
  const caster=scene.querySelector(`.actor-${event.from} .actor-figure`);
  caster?.insertAdjacentHTML("beforeend",`<img class="combat-skill-emote" src="${skillEmoteSrc(event.card)}" data-emphasis="${emphasis}" style="--emote-duration:${duration}ms" width="240" height="180" alt="" aria-hidden="true" draggable="false">`);
}

function playCombatFeedback(after, endOfTurn=false){
  cancelAutoBattleTimer();
  const pending=game.feedback.splice(0);
  const stage=document.querySelector("#stage");
  if(!pending.length || !stage.querySelector(".stage-combat")){
    render();
    after?.();
    scheduleAutoBattle();
    return;
  }
  // Keep the target's old health visible until a projectile lands.
  const deferRender=endOfTurn || game.phase!=="combat" ||
    pending.some(event=>event.defeated || event.injury || event.recovered || event.type==="guard" ||
      event.type==="setup" || event.hadGuard || event.markChanged || attackFlight(event));
  if(!deferRender) render();
  const scene=stage.querySelector(".stage-combat");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playback={stage,scene,timers:[]};
  combatPresentation=playback;
  stage.inert=true;
  const speed=autoSpeed;
  scene.style.setProperty("--lunge-in",`${105/speed}ms`);
  scene.style.setProperty("--lunge-out",`${150/speed}ms`);
  scene.style.setProperty("--healing-time",`${healingTime}ms`);
  const schedule=(fn,delay)=>playback.timers.push(setTimeout(fn,delay/speed));
  let elapsed=0;
  const emoteEvents=new Map();
  for(const event of pending){
    if(event.from==="enemy" || !skillCharge[event.card]) continue;
    const key=`${event.from}:${event.card}`;
    const chosen=emoteEvents.get(key);
    if(!chosen || (!chosen.defeated && (event.defeated || (!chosen.critical && event.critical)))) emoteEvents.set(key,event);
  }

  for(const event of pending){
    const starts=elapsed;
    let resultAt=starts;
    let poseEnds=starts+400;
    const projectile=attackFlight(event);
    const emphasis=event.defeated?"finisher":event.critical?"critical":"";
    const showEmote=emoteEvents.get(`${event.from}:${event.card}`)===event;
    const emoteTime=showEmote?(emphasis==="finisher"?650:emphasis==="critical"?550:400):0;
    const lossTime=event.injury==="lost"?500:0;
    // 치명·부상·결손의 히트스톱과 컷인·컷신 동안 타격 장면을 붙잡는다 (src/presentation/hit-fx.js)
    const hold=event.type==="hit" && typeof CPHitFx!=="undefined"?CPHitFx.holdFor(event,{speed})*speed:0;
    const slot=showEmote?stage.querySelector(`[data-skill="${event.card}"][data-skill-side="${event.from}"]`):null;
    if(slot) schedule(()=>markSkillActivation(slot,event),starts);
    if(event.intent!==null) schedule(()=>{
      scene.querySelector(".intent-chip.executing")?.classList.remove("executing");
      scene.querySelector(`[data-intent="${event.intent}"]`)?.classList.add("executing");
    },starts);
    if(event.type==="hit"){
      const from=event.from;
      if(!event.trainingOverride) schedule(()=>{
        setActorPose(scene,from,"attack");
        if(projectile || event.hadGuard) updateCooldownReadout();
        if(!reduced && !projectile && !event.opensGate){
          const {dataset}=scene.querySelector(`.actor-${from}`);
          dataset.lunge=emphasis?"strong":"normal";
          dataset.attackMotion=overheadAttacks.has(event.card)?"chop":"thrust";
        }
      },starts);
      resultAt=starts+(reduced || event.trainingOverride?0:105);
      if(projectile && !reduced){
        schedule(()=>{
          if(projectile.pose) setActorPose(scene,from,projectile.pose);
          showAttackFlight(scene,event,projectile);
        },resultAt);
        resultAt+=projectile.duration*speed;
      }
      poseEnds=resultAt+hold+(projectile?Math.max(470,240*speed):470);
      schedule(()=>{
        if(projectile) scene.querySelector(`.${projectile.className}`)?.remove();
        showImpact(scene,event);
        if(emphasis) scene.dataset.impact=emphasis;
        showHitOutcome(scene,event);
        if(event.opensGate){
          setBellboyPresentation(scene,"staggered");
          setActorPose(scene,"enemy","staggered");
        }else if(event.defeated && event.side==="enemy"){
          setBellboyPresentation(scene,"staggered");
        }
        if(event.trainingOverride && game.phase==="combat") updateCooldownReadout();
        if(soundEnabled && audioContext?.state==="running") synthesizeImpact(audioContext,audioOutput,event);
        if(typeof CPHitFx!=="undefined") CPHitFx.play(scene,event,{speed,
          audio:soundEnabled && audioContext?.state==="running"?{ctx:audioContext,out:audioOutput}:null});
      },resultAt);
      if(lossTime) schedule(()=>scene.querySelector(".part-loss-pop")?.remove(),resultAt+hold+lossTime*speed);
    }else if(event.type==="guard"){
      poseEnds=Math.max(poseEnds,starts+320*speed);
      schedule(()=>{
        setActorPose(scene,event.from,"guard");
        updateCooldownReadout();
        scene.querySelector(`.actor-${event.side}`).querySelector(".actor-guard").innerHTML=guardBadge(visibleGuards(event));
        showImpact(scene,event);
      },starts);
    }else if(event.recovered){
      const origin=healingOrigins[game[event.from]?.kind];
      const flightTime=!reduced && origin?healingFlightTime:0;
      resultAt=starts+flightTime*speed;
      poseEnds=resultAt+healingTime*speed;
      schedule(()=>{
        setActorPose(scene,event.from,"heal");
        updateCooldownReadout();
        if(flightTime) showHealingFlight(scene,event,origin);
      },starts);
      schedule(()=>{
        scene.querySelector(".healing-flight")?.remove();
        const panel=scene.querySelector(`.actor-${event.side}`);
        showImpact(scene,event);
        showActorHealth(panel,event);
        showWoundOutcome(scene,panel,event);
        playHealingSound();
      },resultAt);
    }
    const emoteStarts=projectile && emphasis?resultAt:starts;
    if(emoteTime){
      schedule(()=>showSkillEmote(scene,event,emphasis,emoteTime),emoteStarts);
      schedule(()=>scene.querySelector(".combat-skill-emote")?.remove(),emoteStarts+emoteTime*speed);
    }
    schedule(()=>announceCombatAction(event),resultAt);
    schedule(()=>{
      restoreActorPoses(scene,true);
      delete scene.dataset.impact;
      scene.querySelectorAll(".impact").forEach(el=>el.remove());
    },poseEnds);
    // Leave room for the first and last painted frames at higher playback speeds.
    const numberEnds=event.dealt?Math.max(poseEnds,resultAt+hold+300*speed):poseEnds;
    schedule(()=>scene.querySelectorAll(".combat-impact-number").forEach(el=>el.remove()),numberEnds);
    // The defeat frame holds for a real second at every battle speed.
    const readTime=event.defeated?1000:cards[event.card].reward?650:420;
    elapsed=Math.max(numberEnds,resultAt+hold+Math.max(readTime,lossTime)*speed,emoteStarts+emoteTime*speed);
    if(slot) schedule(()=>delete slot.dataset.activation,elapsed);
  }
  schedule(()=>{
    scene.querySelector(".intent-chip.executing")?.classList.remove("executing");
    cancelCombatPresentation();
    if(deferRender || autoPaused) render();
    after?.();
    scheduleAutoBattle();
  },elapsed);
}

const board=document.querySelector("#game-board");
const opening=document.querySelector("#opening");
const openingPanels=[
  ["01-descent-v2","수녀가 등불을 들고 지하 감옥 계단을 내려간다."],
  ["02-cell-v2","수녀가 철창 너머 사형수 앞에 선다."],
  ["03-prayer","수녀가 무릎을 꿇고 두 손을 모아 기도한다."],
  ["04-glance","수녀가 돌아서 나가자 사형수가 그 뒷모습을 바라본다."],
  ["05-quake-v2","통로가 크게 흔들리고 천장에서 돌이 떨어진다."],
  ["06-chaos","감옥 문이 벌어지고 사람들은 무너지는 통로에서 흩어진다."],
  ["07-flight-v2","수녀가 등불을 쥐고 무너지는 감옥을 달려 나간다."],
  ["08-pursuit-v2","멀리 어둠 속에서 사형수가 쇠사슬을 끌며 다가온다."]
];
const openingLessons=[
  ["대열","defense","대원 카드를 끌어 전위·중위·후위를 바꾸세요. 적의 일반 공격은 맨 앞을 노립니다."],
  ["자동 전투","routeBattle","대원 카드를 눌러 기술을 장착하세요. 충전이 끝나면 자동으로 발동합니다."],
  ["추격","pursuer","전투 3초마다 도망 여유가 1 줄어듭니다. 0이 되면 붙잡힙니다."]
];
const tutorialKey="collapsed-passage:tutorial-v1";
let openingView="home",openingStep=0,tutorialSeen=false;

function renderOpening(){
  opening.dataset.screen=openingView;
  if(openingView==="home"){
    opening.innerHTML=`<div class="opening-home"><h1>붕괴 통로</h1>
      <div class="opening-home-actions"><button type="button" class="opening-button primary" data-opening="next">시작하기</button>
      <button type="button" class="opening-button" data-codex-open aria-haspopup="dialog" aria-controls="codex">도감</button></div></div>`;
    return;
  }
  const comic=openingView==="comic";
  const total=(comic?openingPanels:openingLessons).length;
  const isLast=openingStep===total-1;
  const controls=`<div class="opening-nav">
    <button type="button" class="opening-button skip" data-opening="skip">건너뛰기</button>
    <span class="steps"><span aria-live="polite">${openingStep+1} / ${total}</span>
      <button type="button" class="opening-button" data-opening="back" ${openingStep?"":"disabled"}>이전</button>
      <button type="button" class="opening-button primary" data-opening="next">${isLast?(comic?"계속":"전투 준비"):"다음"}</button>
    </span></div>`;
  if(comic){
    const [file,alt]=openingPanels[openingStep];
    opening.innerHTML=`<section class="opening-strip" aria-label="오프닝 만화">
      <figure><img src="art/opening/${file}.webp" width="1440" height="960" alt="${alt}"></figure>${controls}</section>`;
    if(!isLast) new Image().src=`art/opening/${openingPanels[openingStep+1][0]}.webp`;
  }else{
    const [title,mark,detail]=openingLessons[openingStep];
    opening.innerHTML=`<section class="opening-lesson" aria-label="튜토리얼">
      <span class="lesson-icon" aria-hidden="true">${icon(mark)}</span><h1>${title}</h1><p>${detail}</p>${controls}</section>`;
  }
}

function openFirstBattle(){
  opening.hidden=true;
  board.hidden=false;
  start(null);
  document.querySelector('[data-action="begin-combat"]')?.focus({preventScroll:true});
}

function stepOpening(action){
  if(openingView==="home"){
    if(action!=="next") return;
    openingView="comic";
  }else if(action==="back"){
    if(!openingStep) return;
    openingStep--;
  }else{
    const total=(openingView==="comic"?openingPanels:openingLessons).length;
    if(action==="next" && openingStep+1<total){
      openingStep++;
    }else if(openingView==="comic"){
      try{tutorialSeen ||= localStorage.getItem(tutorialKey)==="1";}catch{}
      if(tutorialSeen){openFirstBattle();return;}
      openingView="tutorial";
      openingStep=0;
    }else{
      tutorialSeen=true;
      try{localStorage.setItem(tutorialKey,"1");}catch{}
      openFirstBattle();
      return;
    }
  }
  renderOpening();
  opening.querySelector('[data-opening="next"]')?.focus({preventScroll:true});
}

opening.addEventListener("click",event=>{
  const button=event.target.closest("button[data-opening]");
  if(button && !button.disabled) stepOpening(button.dataset.opening);
});

const codexDialog=document.querySelector("#codex");
const codexMembers={nun:nunType,...companionTypes};
const codexLabels={nun:"수녀",guard:"간수",awakened:"개화 수감자",archer:"궁수",shaman:"주술사",common:"공용"};
const codexRoles={nun:"단일 치유 · 회복 연계",guard:"전위 방어 · 반격",awakened:"가드 제거 · 부상 추가 피해",
  archer:"중위 연타 · 후위 일격",shaman:"여러 아군 치유 · 강화와 약화"};
const codexWeapons={mace:"등불 · 방패",baton:"진압봉",chains:"사슬",bow:"활",staff:"지팡이"};
let codexMember="nun",codexRarity="all";

function codexCardIds(kind){
  const member=codexMembers[kind];
  return Object.keys(cards).filter(id=>Number.isFinite(skillCharge[id]) &&
    (member?exclusiveSkill(cards[id]) && skillFits(cards[id],{kind,weapon:member.weapon}):!exclusiveSkill(cards[id])));
}

function codexProfile(kind){
  const profile=codexMembers[kind];
  if(!profile) return "";
  const portrait=partyArt[kind==="nun"?"player":kind];
  const durability=Object.values(parts).map((label,index)=>`${label} ${profile.health[index]}`).join(" · ");
  return `<div class="codex-profile">
    <div class="codex-portrait"><img src="${portrait.src}" alt="" width="1024" height="1536"></div>
    <div class="codex-profile-copy"><h3>${profile.name}</h3><p class="role">${codexRoles[kind]}</p>
      ${traitTags(profile,`codex-${kind}`)}
      <p class="codex-facts"><span>최대 체력 <b>${profile.vitality}</b></span>
      <span>${codexWeapons[profile.weapon]}</span>
      <span>기술 슬롯 <b>${kind==="nun"?starterSkills.length:companionSkillSlots}</b></span></p>
      <details class="codex-parts"><summary>부위 내구도</summary><p>${durability}</p></details>
    </div></div>`;
}

function renderCodex(){
  const choice=(value,label,group,active)=>`<button type="button" class="codex-choice" data-codex-${group}="${value}" aria-pressed="${active===value}">${label}</button>`;
  const tabs=Object.entries(codexLabels).map(([id,label])=>choice(id,label,"member",codexMember)).join("");
  const rarities=choice("all","전체","rarity",codexRarity)+Object.entries(skillRarities).map(([id,{name}])=>choice(id,name,"rarity",codexRarity)).join("");
  const profile=codexMembers[codexMember] || nunType;
  const actor=fighter(profile.name,profile.health,profile.vitality);
  const entries=codexCardIds(codexMember).filter(id=>codexRarity==="all" || skillRarity(id)===codexRarity);
  const list=entries.map(id=>{
    const skill=cards[id], skillClass=skill.character || skill.weapon || "common";
    return `<article class="codex-card skill-class-card" data-card="${id}" data-skill-class="${skillClass}" data-tier="${skillRarity(id)}">
      <div class="prep-choice-top"><b>${combatSeconds(skillCooldown(id,1))}</b>${skill.reward?"":'<small class="basic-mark">기본</small>'}${skillRarityMark(id)}</div>
      ${skillCardArt(id)}<strong>${skill.name}</strong>
      <div class="prep-choice-meta">${skillOwnerMark(skillClass)}</div>
      ${skillRankMark(id)}${skillEffects(skillCardText(id,actor).lines)}
    </article>`;
  }).join("");
  document.querySelector("#codex-content").innerHTML=`
    <div class="codex-tabs" role="group" aria-label="대원과 공용 카드">${tabs}</div>
    ${codexProfile(codexMember)}
    <div class="codex-filter" role="group" aria-label="카드 희귀도">${rarities}</div>
    ${entries.length?`<div class="codex-card-grid" aria-label="카드 목록">${list}</div>`:'<p class="muted">해당 카드 없음</p>'}`;
}

document.addEventListener("click",event=>{
  if(!event.target.closest("[data-codex-open]")) return;
  cancelAutoBattleTimer();
  renderCodex();
  codexDialog.showModal();
  codexDialog.scrollTop=0;
});
codexDialog.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(!button) return;
  if(button.hasAttribute("data-codex-close")){codexDialog.close();return;}
  const {codexMember:member,codexRarity:rarity}=button.dataset;
  if(!member && !rarity) return;
  if(member) codexMember=member;
  else codexRarity=rarity;
  renderCodex();
  codexDialog.querySelector(member?`[data-codex-member="${member}"]`:`[data-codex-rarity="${rarity}"]`)?.focus({preventScroll:true});
});
codexDialog.addEventListener("close",scheduleAutoBattle);

let formationDrag=null,ignoreFormationClick=false;

function moveFormationCard(side,rank){
  if(!placePartyMember(side,rank)) return;
  game.prepSide=side;
  render();
  board.querySelector(`.formation-member[data-side="${side}"]`)?.focus({preventScroll:true});
}

board.addEventListener("pointerdown",event=>{
  if(game?.phase!=="prep" || !event.isPrimary || event.button!==0) return;
  const card=event.target.closest(".formation-member");
  if(!card) return;
  const rect=card.getBoundingClientRect();
  formationDrag={pointer:event.pointerId,card,source:card.closest(".formation-slot"),
    x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width,ghost:null,target:null};
});

document.addEventListener("pointermove",event=>{
  const drag=formationDrag;
  if(!drag || drag.pointer!==event.pointerId) return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.ghost){
    if(Math.hypot(dx,dy)<8) return;
    drag.ghost=drag.card.cloneNode(true);
    drag.ghost.classList.add("formation-ghost");
    drag.ghost.setAttribute("aria-hidden","true");
    drag.ghost.removeAttribute("aria-describedby");
    drag.ghost.querySelector("[id]")?.removeAttribute("id");
    drag.ghost.tabIndex=-1;
    drag.ghost.style.width=`${drag.width}px`;
    drag.source.classList.add("is-drag-source");
    document.body.append(drag.ghost);
  }
  drag.ghost.style.transform=`translate(${drag.left+dx}px,${drag.top+dy}px)`;
  const slot=document.elementFromPoint(event.clientX,event.clientY)?.closest(".formation-slot");
  const target=slot && slot!==drag.source?slot:null;
  if(target!==drag.target){
    drag.target?.classList.remove("is-drop-target");
    drag.target=target;
    target?.classList.add("is-drop-target");
  }
});

function finishFormationDrag(event){
  const drag=formationDrag;
  if(!drag || drag.pointer!==event.pointerId) return;
  formationDrag=null;
  if(!drag.ghost) return;
  drag.ghost.remove();
  drag.source.classList.remove("is-drag-source");
  drag.target?.classList.remove("is-drop-target");
  ignoreFormationClick=true;
  setTimeout(()=>{ignoreFormationClick=false;},0);
  if(event.type==="pointerup" && drag.target) moveFormationCard(drag.card.dataset.side,Number(drag.target.dataset.rank));
}

document.addEventListener("pointerup",finishFormationDrag);
document.addEventListener("pointercancel",finishFormationDrag);

const minimapDialog=document.querySelector("#minimap");
const minimapResize=new ResizeObserver(([entry])=>layoutMapLinks(entry.target));

minimapDialog.addEventListener("close",()=>{
  if(minimapDialog.open) return;
  minimapResize.disconnect();
  document.querySelector("#minimap-toggle").setAttribute("aria-expanded","false");
  scheduleAutoBattle();
});
function finishBoardAction(){
  playCombatFeedback(()=>{
    const replacement=game.phase==="prep"?document.querySelector('[data-action="begin-combat"]'):
      document.querySelector(".companion-encounter h3") || document.querySelector("#stage button:not(:disabled)");
    replacement?.focus({preventScroll:true});
  });
}

async function travelAlongMap(button){
  const id=button.dataset.value;
  if(routeTravel || !canMoveTo(id)) return;
  if(!game.training && !matchMedia("(prefers-reduced-motion: reduce)").matches){
    const stage=document.querySelector("#stage");
    const layout=button.closest(".map-layout");
    const current=layout.querySelector(".map-node.current");
    const frame=layout.getBoundingClientRect(), from=centerInFrame(current,frame), to=centerInFrame(button,frame);
    const dx=to.x-from.x, dy=to.y-from.y;
    const traveler=document.createElement("span");
    traveler.className="map-traveler";
    traveler.setAttribute("aria-hidden","true");
    traveler.style.setProperty("--from-x",from.x+"px");
    traveler.style.setProperty("--from-y",from.y+"px");
    traveler.innerHTML=icon("runner");
    layout.append(traveler);
    button.classList.add("traveling");
    layout.querySelector(`[data-edge="${game.area}-${id}"]`).classList.add("traveling");
    stage.inert=true;
    const animation=traveler.animate([
      {transform:"translate(-50%, -50%)"},
      {transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`}
    ],{duration:480,easing:"cubic-bezier(.37,.03,.24,1)",fill:"both"});
    routeTravel=animation;
    try {
      await animation.finished;
    } catch {
      return; // Restart interrupts travel.
    } finally {
      if(routeTravel===animation){
        routeTravel=null;
        stage.inert=false;
      }
    }
  }
  moveTo(id);
  finishBoardAction();
}

document.querySelector("#map-form").addEventListener("submit",event=>{
  event.preventDefault();
  const training=event.submitter?.value==="training";
  const fields=event.currentTarget.elements;
  const widths=fields.widths.value.split(",").map(value=>Number(value.trim()));
  const shops=fields.shops.valueAsNumber,rests=fields.rests.valueAsNumber,elites=fields.elites.valueAsNumber,mysteries=fields.mysteries.valueAsNumber;
  const message=document.querySelector("#map-error");
  if(widths.length>4 || widths.some(width=>!Number.isInteger(width) || width<1 || width>3)){
    message.textContent="구간 1~4개, 방 1~3개씩 입력하세요. 예: 3,2,3";
    return;
  }
  const counts=[shops,rests,elites,mysteries];
  if(!training && (counts.some(count=>!Number.isInteger(count) || count<0) || counts.reduce((a,b)=>a+b,0)>widths.reduce((a,b)=>a+b,0))){
    message.textContent="특수 방 합계가 전체 방 수를 넘습니다.";
    return;
  }
  const seed=fields.seed.value.trim() || newRunSeed();
  fields.seed.value=seed;
  message.textContent="";
  document.querySelector("#map-settings").open=false;
  start({seed,widths,shops,rests,elites,mysteries,training});
});

document.querySelector("#training-enemy-damage").addEventListener("change",event=>{
  if(!game.training || game.phase==="combat") return;
  const damage=Number(event.currentTarget.value);
  if(Number.isInteger(damage) && damage>=1 && damage<=5) game.trainingEnemyDamage=damage;
});

document.querySelector("#training-injury").addEventListener("submit",event=>{
  event.preventDefault();
  const fields=event.currentTarget.elements;
  setTrainingInjury(fields.side.value,fields.part.value,fields.condition.value);
});

board.addEventListener("change",event=>{
  const {shopTarget,trainingSlot,side:skillSide}=event.target.dataset;
  if(shopTarget){
    game.shopSelections.set(shopTarget,event.target.value);
    return;
  }
  if(trainingSlot!==undefined && setTrainingSkill(skillSide,Number(trainingSlot),event.target.value)){
    render();
    document.querySelector(`[data-training-slot="${trainingSlot}"]`)?.focus({preventScroll:true});
    return;
  }
});

board.addEventListener("click",event=>{
  const button=event.target.closest("button[data-action]");
  if(!button || button.disabled) return;
  const {action,side,value}=button.dataset;
  if(action==="minimap"){toggleMinimap();return;}
  if(action==="sound"){toggleCombatAudio();return;}
  if(action==="auto-pause"){unlockCombatAudio();toggleAutoPause();return;}
  if(action==="auto-speed"){unlockCombatAudio();cycleAutoSpeed();return;}
  if(action==="training-prep"){openTrainingView("prep");return;}
  if(action==="training-map"){openTrainingView("route");return;}
  if(action==="training-enemy"){
    if(game.training && game.phase!=="combat"){
      game.trainingEnemyActs=!game.trainingEnemyActs;
      render();
    }
    return;
  }
  if(action==="qa"){runQaAction(value);return;}
  unlockCombatAudio();
  if(action==="restart"){start();return;}
  if(action==="classic-map"){
    document.querySelector("#map-error").textContent="";
    document.querySelector("#map-settings").open=false;
    const seed=document.querySelector('#map-form [name="seed"]').value.trim() || newRunSeed();
    start(null,seed);
    return;
  }
  if(action==="move"){travelAlongMap(button);return;}
  if(action==="prep-member" && game.phase==="prep"){
    if(ignoreFormationClick) return;
    game.prepSide=side;
    render();
    document.querySelector(`[data-action="prep-member"][data-side="${side}"]`)?.focus({preventScroll:true});
    return;
  }
  if(action==="formation-rank"){moveFormationCard(game.prepSide,Number(value));return;}
  if(action==="formation-reserve"){
    if(setTrainingReserve(game.prepSide)){
      render();
      board.querySelector(`[data-action="prep-member"][data-side="${game.prepSide}"]`)?.focus({preventScroll:true});
    }
    return;
  }
  if(action==="toggle-skill"){
    if(toggleEquippedSkill(value,game.prepSide)){
      render();
      document.querySelector(`[data-action="toggle-skill"][data-value="${value}"]`)?.focus({preventScroll:true});
    }else if(game.phase==="prep" && availableSkills(game.prepSide).includes(value)){
      document.querySelector("#prep-skill-hint").textContent="장착한 기술을 먼저 빼세요.";
    }
    return;
  }
  if(action==="begin-combat"){
    if(beginCombat()) render();
    return;
  }
  if(action==="reward") chooseReward(value);
  if(action==="skip-reward") chooseReward(null);
  if(action==="recruit" && !recruitCompanion(value,side ?? null)) return;
  if(action==="decline-companion") declineCompanion();
  if(action==="mystery"){
    if(!resolveMystery(value)) return;
    if(game.mysteryResult){
      render();
      document.querySelector("#mystery-result").focus({preventScroll:true});
      return;
    }
  }
  if(action==="buy-shop"){
    if(buyShopOffer(value,button.closest(".shop-item").querySelector("select")?.value)){
      render();
      document.querySelector(`#shop-result-${value}`).focus({preventScroll:true});
    }
    return;
  }
  if(action==="treat" && treatAtStairs(value,side)) playHealingSound();
  if(action==="finish-rest" && game.phase==="route" && areas[game.area].type==="rest") game.restFinished=true;
  finishBoardAction();
});

document.addEventListener("keydown",event=>{
  if(event.defaultPrevented || event.repeat ||
     event.ctrlKey || event.metaKey || event.altKey ||
     event.target.closest?.("input,textarea,select,[contenteditable]")) return;
  if(codexDialog.open) return;
  if(!game){
    if(openingView!=="home" && ["ArrowLeft","ArrowRight"].includes(event.key)){
      event.preventDefault();
      stepOpening(event.key==="ArrowLeft"?"back":"next");
    }
    return;
  }
  if(event.code==="KeyM"){
    event.preventDefault();
    toggleMinimap();
    return;
  }
  if(minimapDialog.open || event.shiftKey) return;
  if(game.phase==="combat" && event.code==="Space"){
    event.preventDefault();
    unlockCombatAudio();
    toggleAutoPause();
    return;
  }
  if(combatPresentation || routeTravel) return;
  if(event.key==="F8"){
    event.preventDefault();
    qaOpen=!qaOpen;
    renderQaTools();
    return;
  }
  const qaAction={KeyK:"win",KeyH:"heal",KeyJ:"margin"}[event.code];
  if(qaOpen && qaAction){
    event.preventDefault();
    runQaAction(qaAction);
    return;
  }
  if(game.phase==="reward"){
    const action=event.key==="0"?board.querySelector('[data-action="skip-reward"]'):
      /^[1-3]$/.test(event.key)?board.querySelectorAll('[data-action="reward"]')[Number(event.key)-1]:null;
    if(action){event.preventDefault();action.click();}
    return;
  }
});

document.addEventListener("visibilitychange",scheduleAutoBattle);

renderOpening();
