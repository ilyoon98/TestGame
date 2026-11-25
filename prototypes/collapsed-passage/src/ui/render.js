"use strict";
// 화면 전체 그리기(GameScreen)와 단계별 화면(Screen), 추격 표시, 자동 전투 조작, QA 도구.

// 자동 전투 버튼(일시정지·배속)과 한 걸음 진행 뒤의 화면 반영.
class AutoBattleControls {
  render(){
    const pause=document.querySelector("#auto-pause");
    const inCombat=game.phase==="combat";
    pause.disabled=!inCombat;
    pause.textContent=autoPaused?"전투 계속":"일시정지";
    pause.title=autoPaused?"전투 계속 (Space)":"전투 일시정지 (Space)";
    pause.setAttribute("aria-pressed",String(autoPaused));
    // 무대 위 '일시정지' 표시는 CSS가 이 값을 읽어 그린다. 연출 재생 중에도 바로 바뀐다.
    document.querySelector("#game-board").setAttribute("data-paused",String(inCombat && autoPaused));
    const speed=document.querySelector("#auto-speed");
    speed.textContent=`배속 ${autoSpeed}×`;
    speed.title="배속 바꾸기 (F)";
    speed.setAttribute("aria-label",`전투 배속 ${autoSpeed}배, 누르면 다음 배속`);
  }

  togglePause(){
    if(game.phase!=="combat") return;
    autoBattle.togglePause();
    cancelAutoBattleTimer();
    renderAutoControls();
    if(!combatPresentation) render();
    scheduleAutoBattle();
  }

  cycleSpeed(){
    autoBattle.cycleSpeed();
    renderAutoControls();
    scheduleAutoBattle();
  }

  // 자동 전투 한 걸음과 그 결과를 화면에 반영한다.
  step(){
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
}

// 사형수 추격 표시. 직전에 그린 도망 여유를 기억해 다가오는 움직임과 경고 진입을 연출한다.
class PursuitHud {
  #last=null;

  update(){
    const inCombat=game.phase==="combat";
    const warning=inCombat && !game.training && game.distance<=pursuitWarningDistance;
    const last=this.#last;
    const sameRun=last?.player===game.player;
    const entering=warning && (!sameRun || !last.warning);
    const advancing=inCombat && sameRun && game.distance<last.distance;
    if(sameRun && last.distance!==game.distance && !matchMedia("(prefers-reduced-motion: reduce)").matches){
      const pursuer=document.querySelector(".pursuit-track .pursuer");
      const old=pursuerPosition(last.distance);
      const end=pursuerPosition(game.distance);
      pursuer.animate([
        {left:`${old}%`,translate:"0 0"},
        {left:`${old+(end-old)*.65}%`,translate:"0 -3px",offset:.58},
        {left:`${end}%`,translate:"0 0"}
      ],{duration:410,easing:"ease-out"});
    }
    this.#last={player:game.player,distance:game.distance,warning};
    const announcement=document.querySelector("#pursuit-announcement");
    const message=warning?`사형수 접근 · 도망 여유 ${game.distance}`:"";
    if(announcement.textContent!==message) announcement.textContent=message;
    return {warning,entering,advancing};
  }
}

// QA 도구 패널. 열림 상태를 가진다.
class QaPanel {
  #open=false;

  get isOpen(){ return this.#open; }

  toggle(){ this.#open=!this.#open; }

  available(action){
    if(game.training && action!=="heal") return false;
    return action==="win"?game.phase==="combat" || (game.phase==="prep" && loadoutsReady()):
      ["prep","combat","reward","route"].includes(game.phase);
  }

  render(){
    const panel=document.querySelector("#qa-tools");
    panel.hidden=!this.#open;
    if(this.#open) for(const button of panel.querySelectorAll("button")) button.disabled=!qaAvailable(button.dataset.value);
  }

  run(action){
    if(!this.#open || combatPresentation || routeTravel || !qaAvailable(action)) return;
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
}

// 단계별 무대 화면의 계약. view: {area, pursuit, expandedBodies}
class Screen {
  render(stage,view){ throw new Error(`${this.constructor.name}.render 미구현`); }
}

class CombatScreen extends Screen {
  render(stage,{area,pursuit,expandedBodies}){
    const eyes=condition(game.player,"eyes"), intents=battleIntent();
    const sides=[...partySides().reverse(),"enemy"];
    const warning=pursuit.warning?`<div class="pursuit-warning">${icon("pursuer")}<b>사형수가 가까워졌어요</b><span>도망 여유 ${game.distance}</span></div>`:"";
    const depth=!game.training && {1:"imminent",2:"close",3:"approaching",4:"distant"}[game.distance];
    const shadow=depth?`<span class="pursuit-shadow" data-depth="${depth}" aria-hidden="true"><img src="${pursuerArt}" alt="" width="480" height="720"></span>`:"";
    stage.innerHTML=`<div class="stage-combat${pursuit.warning?" is-pursued":""}${pursuit.entering?" pursuit-entering":""}${pursuit.advancing?" pursuit-advancing":""}">${warning}
      <div class="combat-field" style="--combat-columns:${sides.length};${arenaStyle(area)}">${shadow}${intentPanel(intents,eyes)}<div class="combat ${sides.length>2?"party-combat":""}">${sides.map(side=>bodyPanel(side,intents,eyes)).join("")}</div>${combatWoundPanel(sides)}<div class="combat-impact-layer" aria-hidden="true"></div></div>
    </div>${skillPanel()}${partyNotice()}`;
    if(pursuit.entering) playPursuitSound();
    for(const detail of stage.querySelectorAll(".actor-body-status")) detail.open=expandedBodies.has(detail.dataset.side);
    const scene=stage.querySelector(".stage-combat");
    layoutCombatHud(scene);
    combatHudResize.observe(scene);
  }
}

class PrepScreen extends Screen {
  render(stage){ stage.innerHTML=prepPanel(Boolean(stage.querySelector(".prep-vitals[open]"))); }
}

class RewardScreen extends Screen {
  render(stage){ stage.innerHTML=rewardPanel(); }
}

// 영입·? 방 선택이 있으면 그 화면, 없으면 지도.
class RouteScreen extends Screen {
  render(stage){
    const choice=companionEncounterPanel() || mysteryPanel();
    stage.innerHTML=choice || routePanel();
    if(!choice){
      const layout=stage.querySelector(".map-layout");
      layoutMapLinks(layout);
      mapResize.observe(layout);
    }
  }
}

// 탈출 성공·실패·추격에 붙잡힘·훈련 종료.
class EndScreen extends Screen {
  render(stage){
    const won=game.phase==="won";
    const escaped=won && !game.training;
    const captured=game.phase==="lost" && !game.training && game.lossCause==="pursuit";
    if(!captured || !stage.querySelector(".capture-scene")) stage.innerHTML=`<section class="routes${escaped?" escape-panel":""}">${escaped?surfaceExitScene():captured?captureScene():""}
      <h2>${game.training?"훈련 종료":won?"탈출 성공":captured?"추격에 붙잡힘":"탈출 실패"}</h2>${!won && !captured?`<p class="muted">${game.reason}</p>`:""}
      ${game.qaUses?`<p class="qa-summary">QA ${won?"클리어":"테스트"} · 치트 ${game.qaUses}회 사용</p>`:""}
      <p><button type="button" class="btn primary" data-action="restart">한 판 더</button></p></section>`;
  }
}

// 상단 표시와 QA·훈련 도구를 갱신하고, 단계(phase)에 맞는 Screen에 무대를 맡긴다.
// 새 단계는 screens에 Screen을 하나 더 등록하면 된다.
class GameScreen {
  #screens;
  #fallback;
  #pursuit;

  constructor(screens,fallback,pursuit){
    this.#screens=screens;
    this.#fallback=fallback;
    this.#pursuit=pursuit;
  }

  render(){
    const area=areas[game.area];
    document.querySelector("#location").textContent=(area.type==="mystery"?"? 방":area.name)+(game.mapConfig?` · ${game.mapConfig.seed}`:"");
    document.querySelector("#status").innerHTML=gauges();
    this.#renderTrainingTools();
    renderQaTools();
    renderAutoControls();
    const pursuit=this.#pursuit.update();
    const stage=document.querySelector("#stage");
    const expandedBodies=new Set(Array.from(stage.querySelectorAll(".actor-body-status[open]"),node=>node.dataset.side));
    combatHudResize.disconnect();
    mapResize.disconnect();
    if(game.phase==="combat" || game.phase==="prep") warmCombatArt();
    (this.#screens[game.phase] ?? this.#fallback).render(stage,{area,pursuit,expandedBodies});
    document.querySelector("#log").innerHTML=game.log.map(message=>`<li>${message}</li>`).join("");
    if(minimapDialog.open) renderMinimap();
    scheduleAutoBattle();
  }

  #renderTrainingTools(){
    document.querySelector("#training-tools").hidden=!game.training;
    if(!game.training) return;
    const enemyToggle=document.querySelector("#training-enemy");
    enemyToggle.disabled=game.phase==="combat";
    enemyToggle.setAttribute("aria-pressed",String(game.trainingEnemyActs));
    enemyToggle.textContent=game.trainingEnemyActs?"적 행동 켬":"적 행동 끔";
    const damage=document.querySelector("#training-enemy-damage");
    damage.disabled=game.phase==="combat";
    damage.value=String(game.trainingEnemyDamage);
    const injuryForm=document.querySelector("#training-injury");
    injuryForm.hidden=game.phase!=="combat";
    if(injuryForm.hidden) return;
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

const autoBattleControls=new AutoBattleControls();
const qaPanel=new QaPanel();
const gameScreen=new GameScreen(
  {combat:new CombatScreen(),prep:new PrepScreen(),reward:new RewardScreen(),route:new RouteScreen()},
  new EndScreen(),
  new PursuitHud()
);

function stepAutoBattle(){ autoBattleControls.step(); }
function renderAutoControls(){ autoBattleControls.render(); }
function toggleAutoPause(){ autoBattleControls.togglePause(); }
function cycleAutoSpeed(){ autoBattleControls.cycleSpeed(); }
function render(){ gameScreen.render(); }
function qaAvailable(action){ return qaPanel.available(action); }
function renderQaTools(){ qaPanel.render(); }
function runQaAction(action){ qaPanel.run(action); }
