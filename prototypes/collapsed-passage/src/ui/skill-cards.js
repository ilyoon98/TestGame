"use strict";
// 기술 카드 문구·원화·등급 표시, 전투 준비와 보상 화면, 충전 게이지.

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
