"use strict";
// 상단 게이지, 체력·가드 표시, 적 행동 예고.

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
