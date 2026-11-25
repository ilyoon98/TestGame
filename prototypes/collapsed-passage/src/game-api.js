"use strict";
// 게임 데이터와 규칙 객체를 연결하고, 테스트·QA·Godot 도구가 부르는 전역 함수(규칙 객체를 한 줄로 부른다)를 둔다.

const gameData=CP.createGameData();

const {parts,labels,effects,cards,newClassCards,rewardPool,skillRarities,starterSkills,skillCharge,maxSkillLevel,formationRanks,companionSides,companionSkillSlots,traits,traitThreshold,nunType,companionTypes,standardAreas,shopOffers,mysteryEvents,foes,battleTiming,bellboyTiming}=gameData;

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

function battleIntent(){
  return enemyPlanner.intent(game);
}

function bodyStatus(actor){
  return actor.statusLabel();
}

function bodyWounds(actor){
  return actor.wounds();
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
