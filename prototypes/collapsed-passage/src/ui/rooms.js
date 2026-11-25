"use strict";
// 휴식·상점·? 방·출구·포획 장면, 동료 영입 화면, 이동 화면.

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
