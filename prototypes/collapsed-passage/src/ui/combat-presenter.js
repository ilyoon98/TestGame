"use strict";
// 전투 피드백 연출(자세, 피격, 비행, 이모트)과 타임라인.


// 전투 피드백 연출의 진행자. 쌓인 도메인 이벤트(game.feedback)를 순서대로 재생하고,
// 재생 중인 타임라인(current)을 가진다. 재생 중에는 자동 전투가 멈춘다.
class CombatPresenter {
  current=null;

  illustration(card,kind,title,detail){
    return `<div class="event-illustration ${kind}" style="--event-art:var(--art-${cards[card].art || card})"><strong>${title}</strong><small>${detail}</small></div>`;
  }

  markSkill(slot,event){
    const reward=cards[event.card].reward;
    const traitsUsed=(event.synergies || []).map(id=>`<span class="skill-activation-trait">${icon(traits[id].icon)}+${traits[id].bonus}</span>`).join("");
    slot.querySelector(".skill-activation").innerHTML=`${reward?"보상":"발동"}${traitsUsed}`;
    slot.dataset.activation=reward?"reward":"skill";
  }

  announce(event){
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

  cancel(){
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

  play(after, endOfTurn=false){
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
}

const combatPresenter=new CombatPresenter();
// 예전 전역 이름. 값은 combatPresenter가 가진다.
Object.defineProperty(globalThis,"combatPresentation",{get:()=>combatPresenter.current,set:value=>{combatPresenter.current=value;},configurable:true});
function eventIllustration(...args){ return combatPresenter.illustration(...args); }
function markSkillActivation(...args){ return combatPresenter.markSkill(...args); }
function announceCombatAction(...args){ return combatPresenter.announce(...args); }
function cancelCombatPresentation(...args){ return combatPresenter.cancel(...args); }
function playCombatFeedback(...args){ return combatPresenter.play(...args); }

// 전투 무대의 인물 그림. 자세(공격·피격·방어·회복·쓰러짐), 팔 결손·다리 결손(무릎 꿇기) 그림,
// 상처 표시와 벨보이 철문 상태를 바꾼다. 상태는 DOM(data-*)에 있다.
class ActorSprites {
  updateArmLossMarker(panel,pose,visible){
    const marker=panel.querySelector(".arm-loss-marker");
    const [x,y]=armLossAnchor(panel.dataset.portrait,pose);
    marker.style.setProperty("--x",`${x}%`);
    marker.style.setProperty("--y",`${y}%`);
    marker.hidden=!visible;
  }

  updateWoundDecals(panel,pose,wounds){
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

  markKneelingPose(panel,kneeling){
    if(kneeling) panel.dataset.kneeling=kneeling.pose;
    else delete panel.dataset.kneeling;
  }

  setActorPose(scene,side,pose){
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

  setBellboyPresentation(scene,phase){
    const panel=scene?.querySelector(".bellboy-actor");
    if(!panel) return;
    panel.dataset.bellboyPhase=phase;
    panel.querySelector(".bellboy-gate").setAttribute("aria-label",phase==="staggered"?"철문 열림":"철문 닫힘");
  }

  restoreActorPoses(scene,keepDefeated=false){
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
}

const actorSprites=new ActorSprites();
function updateArmLossMarker(...args){ return actorSprites.updateArmLossMarker(...args); }
function updateWoundDecals(...args){ return actorSprites.updateWoundDecals(...args); }
function markKneelingPose(...args){ return actorSprites.markKneelingPose(...args); }
function setActorPose(...args){ return actorSprites.setActorPose(...args); }
function setBellboyPresentation(...args){ return actorSprites.setBellboyPresentation(...args); }
function restoreActorPoses(...args){ return actorSprites.restoreActorPoses(...args); }

// 타격·회복의 화면 효과. 피해 숫자, 체력·가드 표시 갱신, 부상 결과, 날아가는 화살·주문, 기술 이모트.
class HitEffects {
  showImpact(scene,event){
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

  visibleGuards(event){
    return event.side!=="enemy" && condition(game.player,"eyes")==="lost"?[]:event.guards || [];
  }

  showActorHealth(panel,event){
    const {maxHp,infinite}=game[event.side];
    const defeated=event.defeated?(event.side==="enemy"?"격파":"쓰러짐"):"";
    panel.querySelector(".foe-health").innerHTML=actorHealth({hp:event.hp,maxHp,infinite},defeated,visibleGuards(event));
  }

  showWoundOutcome(scene,panel,event){
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

  showHitOutcome(scene,event){
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

  combatFlightPoints(scene,event,origins){
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

  showHealingFlight(scene,event,origin){
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

  attackFlight(event){
    if(event.type!=="hit") return null;
    const kind=game[event.from]?.kind;
    if(kind==="archer" && cards[event.card].weapon==="bow") return attackFlights.arrow;
    return kind==="shaman" && (event.card==="unseal" || event.card==="exposeHex")?attackFlights.seal:null;
  }

  showAttackFlight(scene,event,projectile){
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

  showSkillEmote(scene,event,emphasis,duration){
    const caster=scene.querySelector(`.actor-${event.from} .actor-figure`);
    caster?.insertAdjacentHTML("beforeend",`<img class="combat-skill-emote" src="${skillEmoteSrc(event.card)}" data-emphasis="${emphasis}" style="--emote-duration:${duration}ms" width="240" height="180" alt="" aria-hidden="true" draggable="false">`);
  }
}

const hitEffects=new HitEffects();
function showImpact(...args){ return hitEffects.showImpact(...args); }
function visibleGuards(...args){ return hitEffects.visibleGuards(...args); }
function showActorHealth(...args){ return hitEffects.showActorHealth(...args); }
function showWoundOutcome(...args){ return hitEffects.showWoundOutcome(...args); }
function showHitOutcome(...args){ return hitEffects.showHitOutcome(...args); }
function combatFlightPoints(...args){ return hitEffects.combatFlightPoints(...args); }
function showHealingFlight(...args){ return hitEffects.showHealingFlight(...args); }
function attackFlight(...args){ return hitEffects.attackFlight(...args); }
function showAttackFlight(...args){ return hitEffects.showAttackFlight(...args); }
function showSkillEmote(...args){ return hitEffects.showSkillEmote(...args); }

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

