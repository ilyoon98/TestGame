"use strict";
// 원화 좌표표와 스프라이트 경로, 전투 원화 미리 불러오기.

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

function arenaSrc(area){
  return `art/arena/${area.arena || "prison-backdrop"}.webp`;
}

function arenaStyle(area){
  return `--arena-image:url('${arenaSrc(area)}')${area.arena?";--arena-position:center":""}`;
}

const captureBackdrop="art/locations/pursuer-capture.webp";

const pursuerArt="art/arena/prison-pursuer.webp";
