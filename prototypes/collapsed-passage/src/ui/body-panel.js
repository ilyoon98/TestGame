"use strict";
// 부위 상태 패널, 상처 표시, 진영·직업 배지, 대열 패널.

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

function bodyStatusSummary(status,eyesLost){
  const badge=eyesLost?`<span class="eye-loss-badge" role="img" aria-label="눈 결손" title="눈 결손">${icon("hiddenIntent")}</span>`:"";
  return `${badge}<span class="body-status-label">부위 상태 · </span>${status}`;
}

function partDrawing(id,lost=false){
  const art=`<img class="part-drawing" src="art/body-parts/${id}.webp" width="96" height="96" alt="" draggable="false">`;
  return lost?`<span class="part-drawing-lost">${art}${icon(id==="eyes"?"hiddenIntent":"partLost")}</span>`:art;
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
