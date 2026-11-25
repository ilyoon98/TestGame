"use strict";
// 지도와 미니맵.

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
