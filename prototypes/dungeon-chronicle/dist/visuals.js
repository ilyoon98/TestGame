// Race bodies are generated raster sprites; equipment is a separately aligned pixel layer.
const iconPaths = {
  inn:'<path fill="#d6b977" d="M2 8h12v6H2zM3 6h4v2H3zM2 14h2v2H2zm10 0h2v2h-2z"/><path fill="#e0d8bf" d="M8 5h5v3H8z"/>',
  guild:'<path fill="#89a6c4" d="M3 2h10v9h-2v2H9v2H7v-2H5v-2H3z"/><path fill="#d6b977" d="M7 4h2v7H7zM5 6h6v2H5z"/>',
  trader:'<path fill="#89bda5" d="M2 3h12v4H2zM3 8h10v7H3z"/><path fill="#d6b977" d="M6 9h4v4H6z"/><path fill="#385247" d="M4 4h2v3H4zm6 0h2v3h-2z"/>',
  smith:'<path fill="#a8b8c2" d="M2 2h9v4H2zM5 6h4v2H5z"/><path fill="#ad8151" d="M5 7h3v8H5z"/><path fill="#647a89" d="M10 11h5v4h-5z"/>',
  human:'<path fill="#d4a77c" d="M5 3h6v8H5zM3 6h2v3H3zm8 0h2v3h-2z"/><path fill="#76533d" d="M5 2h6v3H5z"/><path fill="#c2ccd2" d="M4 12h8v3H4z"/><path fill="#172332" d="M6 6h1v1H6zm3 0h1v1H9z"/>',
  elf:'<path fill="#ddcaa1" d="M5 2h6v3H5zM4 4h1v7H4zm7 0h1v7h-1z"/><path fill="#f0d7bb" d="M5 5h6v6H5zM1 5h4v2H2zm10 0h4l-1 2h-3z"/><path fill="#89bda5" d="M4 12h8v3H4z"/><path fill="#172332" d="M6 7h1v1H6zm3 0h1v1H9z"/>',
  dwarf:'<path fill="#d4a77c" d="M4 4h8v6H4z"/><path fill="#a86538" d="M4 2h8v3H4zm0 6h3v2h2V8h3v5h-2v2H6v-2H4z"/><path fill="#172332" d="M5 6h1v1H5zm5 0h1v1h-1z"/>',
  goblin:'<path fill="#91ad50" d="M4 3h8v9H4zM1 4h3v3H2zm11 0h3l-1 3h-2z"/><path fill="#627b3c" d="M4 12h8v3H4z"/><path fill="#172332" d="M5 6h2v2H5zm4 0h2v2H9z"/>',
  undead:'<path fill="#e4d8bb" d="M5 2h6v1h2v7h-2v3H5v-3H3V3h2zM4 14h8v1H4z"/><path fill="#172332" d="M5 5h2v3H5zm4 0h2v3H9zM7 9h2v2H7zM6 12h1v1H6zm3 0h1v1H9z"/>',
  warrior:'<path fill="#b9cbd5" d="M11 1h3v4h-2v2h-2v2H8v2H6V9h2V7h2V5h1z"/><path fill="#d6b977" d="M4 8h2v2h2v2H6v-1H5v-1H4z"/><path fill="#8b6046" d="M2 12h2v2H2zm2-2h2v2H4z"/>',
  rogue:'<path fill="#c5d1d9" d="M10 2h2v4h-2v3H8v2H6V9h2V6h2z"/><path fill="#b8a4d6" d="M4 9h2v2h2v2H6v-1H4z"/><path fill="#8d6545" d="M2 12h3v3H2z"/>',
  mage:'<path fill="#a694c8" d="M7 1h2v3h2v4h2v3H3V8h2V4h2zM1 11h14v2H1z"/><path fill="#d6b977" d="M5 8h6v2H5z"/>',
  priest:'<path fill="#e2d9c0" d="M7 1h2v2h2v2h2v9H3V5h2V3h2z"/><path fill="#d6b977" d="M7 4h2v3h3v2H9v4H7V9H4V7h3z"/>',
  porter:'<path fill="#ad8151" d="M4 5h8v1h2v8h-2v1H4v-1H2V6h2z"/><path fill="#74563c" d="M5 2h6v3H9V4H7v1H5zm-1 7h8v2H4z"/><path fill="#d6b977" d="M6 10h4v3H6z"/>',
  greedy:'<path fill="#d6b977" d="M3 3h6v1h1v5H9v1H3V9H2V4h1zm5 5h5v1h1v5h-1v1H8v-1H7V9h1z"/><path fill="#96763b" d="M5 5h2v3H5zm5 5h2v3h-2z"/>',
  coward:'<path fill="#91abc2" d="M3 2h10v8h-2v2H9v2H7v-2H5v-2H3z"/><path fill="#263b4c" d="M7 4h2v3H7zm0 4h2v3H7z"/>',
  unlucky:'<path fill="#a3a2b5" d="M5 2h6v2h3v5H2V4h3z"/><path fill="#c69ab7" d="M5 10h2v4H5zm5 1h2v4h-2z"/>',
  lost:'<path fill="#bd9764" d="M7 1h2v14H7zM2 3h11v3H2zm2 6h10v3H4z"/><path fill="#172332" d="M3 4h2v1H3zm8 6h2v1h-2z"/>',
  frail:'<path fill="#d5908b" d="M2 3h4v2h4V3h4v7h-2v2h-2v2H6v-2H4v-2H2z"/><path fill="#263b4c" d="M7 4h2v3H7zm1 3h2v3H8zm-2 3h2v3H6z"/>',
  regen:'<path fill="#89bda5" d="M7 2h7v6h-2v2h-2v2H7V9H4V7h3zM2 12h5v2H2z"/><path fill="#d6dd9c" d="M7 7h2v2H7zm2-2h2v2H9zm-4 4h2v5H5z"/>',
  lucky:'<path fill="#89bda5" d="M3 2h4v4H3zm6 0h4v4H9zM3 8h4v4H3zm6 0h4v4H9zM7 5h2v5H7zm0 6h2v4H7z"/>',
  brave:'<path fill="#d6b977" d="M7 1h2v9H7zM3 8h10v2H3zM6 10h4v4H6z"/><path fill="#e2938c" d="M2 2h2v3H2zm10 2h2v3h-2z"/>',
  sharp:'<path fill="#b8a4d6" d="M5 4h6v2h2v2h2v2h-2v2h-2v1H5v-1H3v-2H1V8h2V6h2z"/><path fill="#182536" d="M6 6h4v5H6z"/><path fill="#e0e7ea" d="M7 6h1v2H7zM12 1h2v3h-2zm-1 1h4v1h-4z"/>',
  blessed:'<path fill="#d6b977" d="M5 1h6v1h2v3h-2v1H5V5H3V2h2z"/><path fill="#172332" d="M5 2h6v2H5z"/><path fill="#e0e7ea" d="M7 7h2v3h3v2H9v3H7v-3H4v-2h3z"/>'
};

export const VISUAL_IDS=Object.freeze(Object.keys(iconPaths));
export function pixelIcon(id){return `<svg class="pixel-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${iconPaths[id]||''}</svg>`;}

export const SPRITE_FRAMES={human:[0,0],elf:[1,0],dwarf:[2,0],goblin:[0,1],undead:[1,1]};
export const SPRITE_LAYOUT=Object.freeze({width:32,height:48,bodyTop:12,feetY:44,centerX:16});
// Fit only the base artwork to the shared anchors. Equipment never varies by race.
const BASE_BOUNDS={human:[123,185,336,604],elf:[82,185,336,604],dwarf:[83,206,297,604],goblin:[97,139,362,516],undead:[107,139,310,516]};
export function baseTransform(race){
  const [left,top,right,bottom]=BASE_BOUNDS[race],frameWidth=418,frameHeight=627;
  const scaleY=(SPRITE_LAYOUT.feetY-SPRITE_LAYOUT.bodyTop)/SPRITE_LAYOUT.height*frameHeight/(bottom-top);
  const x=(frameWidth/2-(left+right)/2)/frameWidth*100;
  const y=SPRITE_LAYOUT.bodyTop/SPRITE_LAYOUT.height*100-top/frameHeight*100*scaleY;
  return `translate(${x}%,${y}%) scaleY(${scaleY})`;
}
const gearFront={
  inn:'<path fill="#dbcda8" d="M12 26h8v5h2v11H10V31h2z"/><path fill="#b89b66" d="M10 34h12v2H10z"/><path fill="#d6b977" d="M23 31h3v3h-3zm1 3h1v7h-1zM22 39h3v2h-3z"/>',
  guild:'<path fill="#496583" d="M10 26h12v15H10z"/><path fill="#90aac3" d="M11 26h3v14h-3z"/><path fill="#d6b977" d="M18 28h3v4h-3zM10 38h12v2H10z"/><path fill="#e6dcc1" d="M26 29h5v10h-5z"/><path fill="#647582" d="M27 31h3v1h-3zm0 3h3v1h-3z"/>',
  trader:'<path fill="#57735b" d="M10 26h12v14H10z"/><path fill="#8cab80" d="M11 26h3v13h-3z"/><path fill="#ac8254" d="M11 26h2v10h-2zM19 26h2v10h-2z"/><path fill="#d6b977" d="M10 35h12v2H10zM15 34h3v4h-3z"/>',
  smith:'<path fill="#75563d" d="M12 26h8v5h2v11H10V31h2z"/><path fill="#b38b5b" d="M12 26h2v13h-2z"/><path fill="#d6b977" d="M10 34h12v2H10z"/><path fill="#8e6747" d="M27 32h2v10h-2z"/><path fill="#a8b8c2" d="M25 29h6v4h-6z"/>',
  warrior:'<path fill="#283c48" d="M10 26h12v11H10zM6 25h6v5H6zm15 0h6v5h-6z"/><path fill="#90a7b3" d="M11 26h10v9H11zM7 25h4v3H7zm15 0h4v3h-4z"/><path fill="#d6b977" d="M14 27h4v7h-4zM11 35h10v2H11z"/><path fill="#b9cbd5" d="M27 20h2v17h-2z"/><path fill="#d6b977" d="M25 36h6v2h-6z"/><path fill="#8d6545" d="M27 38h2v4h-2z"/>',
  rogue:'<path fill="#4f5067" d="M10 26h12v10H10z"/><path fill="#8b88a4" d="M11 26h3v10h-3z"/><path fill="#ad8151" d="m13 27 2-1 7 9-2 1z"/><path fill="#c5d1d9" d="M27 30h2v6h-2z"/><path fill="#a694c8" d="M25 36h6v2h-6z"/><path fill="#8d6545" d="M27 38h2v3h-2z"/>',
  mage:'<path fill="#635380" d="M11 26h10v6h1v9H10v-9h1z"/><path fill="#a694c8" d="M11 26h3v14h-3z"/><path fill="#d6b977" d="M14 33h7v2h-7zM10 40h12v2H10z"/><path fill="#8d6545" d="M27 24h2v19h-2z"/><path fill="#b8a4d6" d="M26 22h4v4h-4z"/>',
  priest:'<path fill="#cdc7b4" d="M11 26h10v6h1v10H10V32h1z"/><path fill="#ece4ce" d="M11 26h3v14h-3z"/><path fill="#d6b977" d="M15 26h2v13h-2zM12 29h8v2h-8zM10 40h12v2H10z"/>',
  porter:'<path fill="#ac8254" d="M11 26h2v9h-2zm8 0h2v9h-2z"/><path fill="#644b36" d="M10 34h12v3H10z"/><path fill="#d6b977" d="M15 34h3v3h-3z"/>'
};
const hats={
  warrior:'<path fill="#617987" d="M12 11h8v3H12zM10 13h12v3H10z"/><path fill="#a7bdc5" d="M13 11h4v2h-4zM10 15h12v1H10z"/>',
  rogue:'<path fill="#57586f" d="M12 11h8v2h2v4H10v-4h2z"/><path fill="#8b88a4" d="M12 11h3v2h-3z"/>',
  mage:'<path fill="#635380" d="M15 4h2v3h2v3h2v4H11v-4h2V7h2zM8 14h16v2H8z"/><path fill="#a694c8" d="M15 5h1v4h-1z"/><path fill="#d6b977" d="M11 12h10v2H11z"/>',
  priest:'<path fill="#ece4ce" d="M15 7h2v2h2v2h2v5H11v-5h2V9h2z"/><path fill="#d6b977" d="M15 10h2v5h-2zM13 12h6v2h-6zM11 15h10v1H11z"/>'
};
const backpack='<path fill="#5c4432" d="M22 24h7v2h2v13h-2v2h-7z"/><path fill="#ad8151" d="M23 26h6v12h-6z"/><path fill="#caa372" d="M23 26h6v3h-6z"/><path fill="#d6b977" d="M25 32h3v3h-3z"/>';
const layer=content=>`<svg viewBox="0 0 32 48" aria-hidden="true" shape-rendering="crispEdges">${content}</svg>`;

export function spriteMarkup(race,job=null){
  if(!SPRITE_FRAMES[race])return '<span class="unknown-character" aria-hidden="true">?</span>';
  const [col,row]=SPRITE_FRAMES[race],hat=hats[job];
  const source=`background-position:${col*50}% ${row*100}%;`;
  const base=`<span class="sprite-base" style="${source}transform-origin:0 0;transform:${baseTransform(race)}"></span>`;
  const face=race==='undead'?`<span class="sprite-face"><span class="sprite-base" style="background-image:url(./assets/race-bases-undead-face-v3.png);${source}transform-origin:0 0;transform:${baseTransform(race)}"></span></span>`:'';
  const back=['porter','trader'].includes(job)?`<span class="sprite-back">${layer(backpack)}</span>`:'';
  const front=gearFront[job]?`<span class="sprite-front">${layer(gearFront[job]+(hat||''))}</span>`:'';
  return `<span class="pixel-character" data-race="${race}" data-job="${job||''}" aria-hidden="true">${back}${base}${face}${front}</span>`;
}
