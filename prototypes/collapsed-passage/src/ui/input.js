"use strict";
// 대열 끌기, 미니맵, 지도 이동 연출, 폼·클릭·키보드 입력. 마지막에 첫 화면을 그린다.

// 전투 준비의 대원 카드 끌기. 8px 넘게 움직이면 카드 복제본을 띄우고, 놓은 칸으로 대원을 옮긴다.
class FormationDrag {
  #drag=null;
  #suppressClick=false;

  // 끌기를 막 끝낸 직후의 click은 무시한다.
  get suppressClick(){ return this.#suppressClick; }

  begin(event){
    if(game?.phase!=="prep" || !event.isPrimary || event.button!==0) return;
    const card=event.target.closest(".formation-member");
    if(!card) return;
    const rect=card.getBoundingClientRect();
    this.#drag={pointer:event.pointerId,card,source:card.closest(".formation-slot"),
      x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width,ghost:null,target:null};
  }

  move(event){
    const drag=this.#drag;
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
  }

  finish(event){
    const drag=this.#drag;
    if(!drag || drag.pointer!==event.pointerId) return;
    this.#drag=null;
    if(!drag.ghost) return;
    drag.ghost.remove();
    drag.source.classList.remove("is-drag-source");
    drag.target?.classList.remove("is-drop-target");
    this.#suppressClick=true;
    setTimeout(()=>{this.#suppressClick=false;},0);
    if(event.type==="pointerup" && drag.target) moveFormationCard(drag.card.dataset.side,Number(drag.target.dataset.rank));
  }
}

// 지도에서 다음 방으로 가는 이동 연출. 연출 중에는 무대 입력을 막고, 판을 새로 시작하면 취소된다.
class MapTravel {
  animation=null;

  async travel(button){
    const id=button.dataset.value;
    if(this.animation || !canMoveTo(id)) return;
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
      this.animation=animation;
      try {
        await animation.finished;
      } catch {
        return; // Restart interrupts travel.
      } finally {
        if(this.animation===animation){
          this.animation=null;
          stage.inert=false;
        }
      }
    }
    moveTo(id);
    finishBoardAction();
  }
}

const formationDrag=new FormationDrag();
const mapTravel=new MapTravel();
// 예전 전역 이름. 값은 mapTravel이 가진다.
Object.defineProperty(globalThis,"routeTravel",{get:()=>mapTravel.animation,set:value=>{mapTravel.animation=value;},configurable:true});

function moveFormationCard(side,rank){
  if(!placePartyMember(side,rank)) return;
  game.prepSide=side;
  render();
  board.querySelector(`.formation-member[data-side="${side}"]`)?.focus({preventScroll:true});
}

function finishFormationDrag(event){ formationDrag.finish(event); }

board.addEventListener("pointerdown",event=>formationDrag.begin(event));

document.addEventListener("pointermove",event=>formationDrag.move(event));

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

function travelAlongMap(button){ return mapTravel.travel(button); }

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
    if(formationDrag.suppressClick) return;
    const fromFooter=Boolean(button.closest(".prep-footer"));
    game.prepSide=side;
    render();
    document.querySelector(`${fromFooter?".prep-footer ":""}[data-action="prep-member"][data-side="${side}"]`)?.focus({preventScroll:true});
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
    if(openingView.screen!=="home" && ["ArrowLeft","ArrowRight"].includes(event.key)){
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
  if(event.code==="KeyF" && ["prep","combat"].includes(game.phase)){
    event.preventDefault();
    unlockCombatAudio();
    cycleAutoSpeed();
    return;
  }
  if(combatPresentation || routeTravel) return;
  // 버튼·요약에 포커스가 있으면 Enter는 그 요소의 동작이므로, 빈 곳에 있을 때만 전투를 시작한다.
  if(game.phase==="prep" && event.key==="Enter" && !event.target.closest?.("button,a,summary,[tabindex]")){
    const begin=board.querySelector('[data-action="begin-combat"]');
    if(begin && !begin.disabled){event.preventDefault();begin.click();}
    return;
  }
  if(event.key==="F8"){
    event.preventDefault();
    qaPanel.toggle();
    renderQaTools();
    return;
  }
  const qaAction={KeyK:"win",KeyH:"heal",KeyJ:"margin"}[event.code];
  if(qaPanel.isOpen && qaAction){
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
