// 타격 단계별 연출: 일반 · 치명타 · 부상 · 결손
// 값은 prototypes/collapsed-passage-fx-lab 실험실의 기본값이다. 실험실에서 'JSON 복사'한 값을 CONFIG에 붙여 넣으면 된다.
// 화면 스크립트(src/game-api.js, src/ui/*.js)보다 먼저 일반 <script>로 불러와 globalThis.CPHitFx를 만든다. 화면 스크립트는 typeof로 확인한 뒤 부른다.
(()=>{
"use strict";

const CONFIG={
  tiers:{
    normal:{font:"Bricolage Grotesque",color:"#efe6da",size:24,weight:500,pop:1.15,growTo:1,growMs:0,jitter:0,rise:46,hitStop:0,shake:2,flashMs:60,icon:false},
    crit:{font:"Bricolage Grotesque",color:"#ffd36e",size:34,weight:800,pop:1.6,growTo:1,growMs:0,jitter:0,rise:56,hitStop:60,shake:7,flashMs:90,icon:false},
    injury:{font:"Bricolage Grotesque",color:"#e9a54a",size:34,weight:800,pop:1.3,growTo:1.55,growMs:650,jitter:3,rise:28,hitStop:110,shake:11,flashMs:120,icon:false},
    loss:{font:"Bricolage Grotesque",color:"#ff4a3d",size:38,weight:800,pop:1.4,growTo:1.9,growMs:900,jitter:5,rise:18,hitStop:180,shake:18,flashMs:160,icon:true}
  },
  injury:{ring:true,cutin:true,cutinMs:750},
  loss:{ring:true,cutscene:true,sceneMs:1900,letterbox:true,shards:true,vignette:true,ringTone:true,afterMs:900},
  global:{dirShake:true,streak:true,compress:true}
};
const PART_NAMES={head:"머리",eyes:"눈",arms:"팔",chest:"가슴",belly:"배",legs:"다리"};
const SIDE_NAMES={player:"수녀",companion:"동료",enemy:"적"};
const LOST_X='<svg class="hitfx-x" viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" stroke="#f8e3cf" stroke-width="5"/><path d="m5 5 14 14M19 5 5 19" stroke="#d3241b" stroke-width="2.6"/></svg>';
const FLASH={
  normal:"brightness(0) invert(1)",
  crit:"brightness(0) invert(1)",
  injury:"brightness(0) invert(.92) sepia(1) saturate(2.6) hue-rotate(-8deg)",
  loss:"brightness(0) invert(.55) sepia(1) saturate(9) hue-rotate(-38deg)"
};

function tierOf(event){
  if(!event || event.type!=="hit" || !event.dealt) return null;
  if(event.injury==="lost") return "loss";
  if(event.injury==="injured") return "injury";
  return event.critical?"crit":"normal";
}
const cutFactor=speed=>CONFIG.global.compress?Math.sqrt(Math.max(1,speed||1)):1;
function hasScene(event,tier){
  if(event.defeated) return false;   // 쓰러짐은 기존 격파 연출(1초 정지)을 쓴다
  return tier==="injury"?CONFIG.injury.cutin:tier==="loss"&&CONFIG.loss.cutscene;
}
/* 타격 뒤 전투 연출을 붙잡아 둘 실제 시간(ms). combat-presenter.js는 여기에 배속을 곱해 타임라인에 더한다. */
function holdFor(event,{speed=1}={}){
  const tier=tierOf(event);
  if(!tier) return 0;
  let ms=CONFIG.tiers[tier].hitStop;
  if(hasScene(event,tier)){
    ms+=tier==="injury"?CONFIG.injury.cutinMs/cutFactor(speed):CONFIG.loss.sceneMs/cutFactor(speed)+CONFIG.loss.afterMs;
  }
  return Math.round(ms);
}

/* ---------- 데미지 숫자 ---------- */
function decorate(number,event,part,speed=1){
  const tier=tierOf(event);
  const damage=number?.querySelector?.(".damage");
  if(!tier || !damage || typeof damage.animate!=="function") return;
  const T=CONFIG.tiers[tier];
  number.classList.add("hitfx",`hitfx-${tier}`);
  number.style.setProperty("--fx-c",T.color);
  number.style.setProperty("--fx-s",`${T.size}px`);
  number.style.setProperty("--fx-w",T.weight);
  number.style.setProperty("--fx-f",`"${T.font}"`);
  damage.innerHTML=`<span class="hitfx-pop"><span class="hitfx-jit">${damage.innerHTML}</span></span>`;
  const icon=number.querySelector(".impact-part");
  if(icon && tier==="loss"){icon.classList.add("hitfx-lost");icon.insertAdjacentHTML("beforeend",LOST_X);}
  else if(icon && tier==="injury") icon.classList.add("hitfx-injured");
  // 기존 숫자 표시 시간(1배속 470ms, 최소 300ms)에 이 단계가 붙잡는 시간을 더한 만큼 움직인다
  const base=Math.max(470/Math.max(1,speed),300);
  const scene=hasScene(event,tier);
  const life=tier==="loss"&&scene?base+CONFIG.loss.afterMs:base+holdFor(event,{speed});
  const start=()=>animateNumber(number,damage,T,life,reduced());
  if(tier==="loss"&&scene){
    // 결손 숫자는 컷신이 끝나 몸이 드러날 때 튀어나온다 (play()의 reveal에서 시작)
    number.style.opacity="0";
    number._hitfxStart=()=>{number.style.opacity="";number._hitfxStart=null;start();};
  }else start();
}
const reduced=()=>typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function animateNumber(number,damage,T,life,rm){
  const pop=damage.querySelector(".hitfx-pop"),jit=damage.querySelector(".hitfx-jit");
  number.animate([{translate:"0 0"},{translate:`0 ${-T.rise}px`}],{duration:life,easing:"cubic-bezier(.25,.6,.3,1)",fill:"forwards"});
  const tPeak=Math.min(90/life,.2),tSet=Math.min(210/life,.3),tGrow=Math.min((210+T.growMs)/life,.95);
  const g=rm?1:T.growTo,pk=rm?Math.min(T.pop,1.1):T.pop;
  const frames=[{transform:"scale(.25)",offset:0,easing:"cubic-bezier(.2,.9,.3,1)"},{transform:`scale(${pk})`,offset:tPeak,easing:"ease-in-out"},{transform:"scale(1)",offset:tSet,easing:"cubic-bezier(.35,0,.25,1)"}];
  if(T.growMs>0&&g!==1) frames.push({transform:`scale(${g})`,offset:tGrow});
  frames.push({transform:`scale(${T.growMs>0?g:1})`,offset:1});
  pop.animate(frames,{duration:life,fill:"forwards"});
  if(T.jitter>0&&!rm){
    const end=Math.min(tGrow+200/life,.97),steps=Math.max(4,Math.round((end-tSet)*life/38));
    const jf=[{transform:"translate(0,0)",offset:0},{transform:"translate(0,0)",offset:tSet*.6}];
    for(let i=1;i<=steps;i++){
      const off=tSet+(end-tSet)*i/steps;
      const ramp=off<=tGrow?.4+.6*((off-tSet)/Math.max(tGrow-tSet,.001)):Math.max(0,1-(off-tGrow)/Math.max(end-tGrow,.001));
      const amp=T.jitter*ramp;
      jf.push({transform:`translate(${((Math.random()*2-1)*amp).toFixed(1)}px,${((Math.random()*2-1)*amp*.7).toFixed(1)}px)`,offset:off});
    }
    jf.push({transform:"translate(0,0)",offset:1});
    jit.animate(jf,{duration:life,fill:"forwards"});
  }
}

/* ---------- 타격 연출 ---------- */
function track(scene){return scene._hitfx||(scene._hitfx={timers:[],nodes:[]});}
function later(scene,fn,ms){const t=track(scene);t.timers.push(setTimeout(fn,ms));}
function add(scene,host,node){host.append(node);track(scene).nodes.push(node);return node;}
function el(cls,html=""){const n=document.createElement("div");n.className=cls;n.setAttribute("aria-hidden","true");n.innerHTML=html;return n;}

function shake(target,px,dirX,ms){
  if(!target?.animate||px<=0||reduced()) return;
  const frames=[],n=Math.max(6,Math.round(ms/28));
  for(let i=0;i<=n;i++){
    const k=1-i/n,amp=px*k*k;   // 제곱 감쇠: 약타는 금방 멎고 강타만 오래 남는다
    const bias=CONFIG.global.dirShake?dirX*amp*.9:0;
    frames.push({translate:i===n?"0 0":`${(bias+(Math.random()*2-1)*amp*.7).toFixed(1)}px ${((Math.random()*2-1)*amp*.55).toFixed(1)}px`});
  }
  target.animate(frames,{duration:ms,easing:"linear"});
}
function impactPoint(figure,part){
  const impact=figure?.querySelector(`.impact[data-part="${part}"]`);
  if(!impact) return null;
  return {x:impact.style.getPropertyValue("--x"),y:impact.style.getPropertyValue("--y")};
}
function spriteImage(panel){
  const sprite=panel?.querySelector(".actor-sprite");
  if(!sprite) return "";
  if(sprite.currentSrc||sprite.src) return `url("${sprite.currentSrc||sprite.src}")`;
  const bg=getComputedStyle(sprite).backgroundImage;
  return bg&&bg!=="none"?bg.split(/,(?![^(]*\))/)[0]:"";
}

function actorName(panel,side){
  const name=panel?.querySelector("h2, h3")?.textContent.trim();
  return escapeText(name||SIDE_NAMES[side]||"");
}
const escapeText=text=>text.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);

function play(scene,event,{speed=1,audio=null}={}){
  const tier=tierOf(event);
  if(!tier||!scene?.querySelector||typeof document==="undefined") return;
  const T=CONFIG.tiers[tier],part=event.targets?.[0];
  const panel=scene.querySelector(`.actor-${event.side}`);
  const impact=panel?.querySelector(`.impact[data-part="${part}"]`);
  const figure=impact?.parentElement;
  const field=scene.querySelector(".combat-field")||scene;
  const dir=event.side==="enemy"?1:-1;
  const sprite=panel?.querySelector(".actor-sprite");
  const point=impactPoint(figure,part);

  if(T.flashMs>0&&sprite?.animate) sprite.animate([{filter:FLASH[tier]},{filter:FLASH[tier],offset:.45},{filter:"none"}],{duration:T.flashMs});
  shake(field,T.shake,dir,tier==="normal"?180:tier==="crit"?260:340);
  if(T.hitStop>0&&figure?.animate&&!reduced()){
    figure.animate([{translate:"0 0"},{translate:`${dir*3}px 0`},{translate:`${-dir*2}px 0`},{translate:`${dir*2}px 0`},{translate:"0 0"}],{duration:T.hitStop});
  }
  if(point&&figure){
    if(tier!=="normal"&&CONFIG.global.streak){
      const s=add(scene,figure,el("hitfx-streak"));
      s.style.cssText=`left:${point.x};top:${point.y};--fx-c:${T.color};--fx-a:${dir>0?-28:28}deg`;
      s.addEventListener("animationend",()=>s.remove());
    }
    if((tier==="injury"&&CONFIG.injury.ring)||(tier==="loss"&&CONFIG.loss.ring)){
      const r=add(scene,figure,el("hitfx-ring"));
      r.style.cssText=`left:${point.x};top:${point.y};--fx-c:${T.color}`;
      r.addEventListener("animationend",()=>r.remove());
    }
  }
  sound(audio,tier==="loss"?"injury":tier);

  const scenePlays=hasScene(event,tier);
  if(!scenePlays) return;
  const cut=cutFactor(speed);
  if(tier==="injury") later(scene,()=>cutin(scene,event,part,CONFIG.injury.cutinMs/cut,T.color,audio),T.hitStop);
  else{
    const lossPop=figure?.querySelector(`.part-loss-pop[data-part="${part}"]`);
    if(lossPop) lossPop.style.visibility="hidden";
    later(scene,()=>lossScene(scene,event,part,CONFIG.loss.sceneMs/cut,audio,()=>{
      if(lossPop){lossPop.style.visibility="";lossPop.animate?.([{scale:2.6,rotate:"-20deg",opacity:0},{scale:.9,rotate:"0deg",opacity:1,offset:.55},{scale:1,opacity:1}],{duration:340,easing:"cubic-bezier(.2,.8,.3,1.2)"});}
      scene.querySelectorAll(".combat-impact-number.hitfx-loss").forEach(n=>n._hitfxStart?.());
    }),T.hitStop);
  }
}

function cutin(scene,event,part,ms,color,audio){
  const fromLeft=event.side==="enemy",s=fromLeft?-1:1;
  const actorPanel=scene.querySelector(`.actor-${event.side}`);
  const art=spriteImage(actorPanel);
  const dim=add(scene,scene,el("hitfx-dim"));
  const band=add(scene,scene,el("hitfx-cutin",`<div class="hitfx-cutin-inner">
    ${art?'<div class="hitfx-face"></div>':""}
    <div class="hitfx-part" style="background-image:url(art/body-parts/${part}.webp)"></div>
    <div class="hitfx-text"><b>부상</b><span>${actorName(actorPanel,event.side)} · ${PART_NAMES[part]||""}</span></div></div>`));
  // 원화가 data: URL이면 따옴표가 들어 있어 style 속성 문자열에 넣지 않고 DOM으로 지정한다
  if(art) band.querySelector(".hitfx-face").style.backgroundImage=art;
  band.style.setProperty("--fx-c",color);
  const tin=Math.min(170,ms*.22),tout=Math.min(170,ms*.22);
  sound(audio,"whoosh");
  dim.animate([{opacity:0},{opacity:.5}],{duration:tin,fill:"forwards"});
  band.animate([{transform:`skewY(-5deg) translateX(${s*110}%)`},{transform:"skewY(-5deg) translateX(0)"}],{duration:tin,easing:"cubic-bezier(.2,.9,.25,1)",fill:"forwards"});
  band.firstElementChild.animate([{transform:`skewY(5deg) translateX(${s*-8}%)`},{transform:`skewY(5deg) translateX(${s*4}%)`}],{duration:ms,fill:"forwards"});
  later(scene,()=>{
    band.animate([{transform:"skewY(-5deg) translateX(0)"},{transform:`skewY(-5deg) translateX(${-s*110}%)`}],{duration:tout,easing:"cubic-bezier(.6,0,.8,.3)",fill:"forwards"});
    dim.animate([{opacity:.5},{opacity:0}],{duration:tout,fill:"forwards"});
  },ms-tout);
  later(scene,()=>{band.remove();dim.remove();},ms);
}

function lossScene(scene,event,part,total,audio,reveal){
  const L=CONFIG.loss,C=CONFIG.tiers.loss.color,rm=reduced(),ph=f=>total*f;
  const field=scene.querySelector(".combat-field")||scene;
  const dim=add(scene,scene,el("hitfx-dim hitfx-dim-loss"));
  const flash=add(scene,scene,el("hitfx-flash"));
  const top=L.letterbox?add(scene,scene,el("hitfx-letterbox top")):null;
  const bottom=L.letterbox?add(scene,scene,el("hitfx-letterbox bottom")):null;
  const vig=L.vignette?add(scene,scene,el("hitfx-vignette")):null;
  // 맞은 인물의 반대편에 패널을 둔다 (대열이 3~4칸이라 진영만으로는 위치를 알 수 없다)
  const box=scene.getBoundingClientRect(),target=scene.querySelector(`.actor-${event.side}`)?.getBoundingClientRect();
  const centerX=target&&box.width?(target.left+target.width/2-box.left)/box.width:event.side==="enemy"?1:0;
  const left=centerX>=.5?28:72;
  const img=`url(art/body-parts/${part}.webp)`;
  const cs=add(scene,scene,el("hitfx-cs",`<div class="hitfx-cs-panel" style="left:${left}%">
      <div class="hitfx-cs-art" style="background-image:${img}"></div>
      <div class="hitfx-cs-half a" style="background-image:${img}"></div>
      <div class="hitfx-cs-half b" style="background-image:${img}"></div>
      <svg class="hitfx-cs-slash" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="-6" y1="106" x2="106" y2="-6" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
    </div>
    <div class="hitfx-cs-stamp" style="left:${left}%"><b>결손</b><span>${actorName(scene.querySelector(`.actor-${event.side}`),event.side)} · ${PART_NAMES[part]||""}</span></div>`));
  const panel=cs.querySelector(".hitfx-cs-panel"),art=cs.querySelector(".hitfx-cs-art"),ha=cs.querySelector(".a"),hb=cs.querySelector(".b"),line=cs.querySelector("line"),stamp=cs.querySelector(".hitfx-cs-stamp");
  const F={fill:"forwards"};
  // 1) 번쩍 + 레터박스 + 주변 어둡게
  flash.animate([{opacity:rm?.15:.7},{opacity:0}],{duration:ph(.12),easing:"ease-out",...F});
  dim.animate([{opacity:0},{opacity:.78}],{duration:ph(.14),...F});
  top?.animate([{height:"0%"},{height:"11%"}],{duration:ph(.12),easing:"ease-out",...F});
  bottom?.animate([{height:"0%"},{height:"11%"}],{duration:ph(.12),easing:"ease-out",...F});
  vig?.animate([{opacity:0},{opacity:.85}],{duration:ph(.16),...F});
  panel.animate([{transform:"scale(.6) rotate(-4deg)",opacity:0},{transform:"scale(1.04) rotate(1deg)",opacity:1,offset:.7},{transform:"scale(1)",opacity:1}],{duration:ph(.1),delay:ph(.12),easing:"ease-out",...F,fill:"both"});
  // 2) 베기
  later(scene,()=>{sound(audio,"slash");line.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:Math.max(70,ph(.05)),easing:"cubic-bezier(.6,0,.4,1)",...F});},ph(.26));
  // 3) 갈라짐
  later(scene,()=>{
    sound(audio,"loss");
    flash.style.background="#ff3b2b";
    flash.animate([{opacity:rm?.1:.45},{opacity:0}],{duration:ph(.06),...F});
    shake(field,CONFIG.tiers.loss.shake*.7,event.side==="enemy"?1:-1,260);
    art.style.opacity=0;ha.style.opacity=1;hb.style.opacity=1;
    const d=rm?.3:1;
    ha.animate([{transform:"none",opacity:1},{transform:`translate(${-14*d}%,${-12*d}%) rotate(${-10*d}deg)`,opacity:1,offset:.5},{transform:`translate(${-22*d}%,${-26*d}%) rotate(${-16*d}deg)`,opacity:0}],{duration:ph(.32),easing:"cubic-bezier(.2,.7,.3,1)",...F});
    hb.animate([{transform:"none",opacity:1},{transform:`translate(${14*d}%,${12*d}%) rotate(${9*d}deg)`,opacity:1,offset:.5},{transform:`translate(${24*d}%,${34*d}%) rotate(${18*d}deg)`,opacity:0}],{duration:ph(.32),easing:"cubic-bezier(.2,.7,.3,1)",...F});
    line.animate([{opacity:1},{opacity:0}],{duration:ph(.12),...F});
    if(L.shards&&!rm){
      const ink=el("hitfx-ink");panel.append(ink);
      ink.animate([{transform:"translate(-50%,-50%) scale(.3)",opacity:0},{transform:"translate(-50%,-50%) scale(1.6)",opacity:.9,offset:.25},{transform:"translate(-50%,-50%) scale(1.9)",opacity:0}],{duration:ph(.4),easing:"ease-out",...F});
      for(let i=0;i<14;i++){
        const sh=el("hitfx-shard"),a=Math.random()*Math.PI*2,r=60+Math.random()*90;
        sh.style.cssText=`width:${2+Math.random()*4}%;--fx-c:${i%3?C:"#f3e4d0"}`;panel.append(sh);
        sh.animate([{transform:"translate(-50%,-50%)",opacity:1},{transform:`translate(${Math.cos(a)*r-50}%,${Math.sin(a)*r-50+30}%) rotate(${Math.random()*540-270}deg)`,opacity:0}],{duration:ph(.3)+Math.random()*ph(.1),easing:"cubic-bezier(.1,.8,.3,1)",...F});
      }
    }
  },ph(.26)+Math.max(70,ph(.05)));
  // 4) 도장
  const stampAt=ph(.26)+Math.max(70,ph(.05))+ph(.08);
  later(scene,()=>{
    sound(audio,"stamp");
    shake(field,CONFIG.tiers.loss.shake,0,380);
    stamp.animate([{transform:"translateX(-50%) scale(2.8) rotate(-14deg)",opacity:0},{transform:"translateX(-50%) scale(.92) rotate(-5deg)",opacity:1,offset:.55},{transform:"translateX(-50%) scale(1) rotate(-6deg)",opacity:1}],{duration:ph(.09),easing:"cubic-bezier(.3,0,.3,1)",...F});
  },stampAt);
  if(L.ringTone) later(scene,()=>sound(audio,"ring"),stampAt+ph(.06));
  // 5) 복귀: 어둠이 걷히면 이미 결손 원화로 바뀐 몸과 X 표식이 드러난다
  const outAt=stampAt+ph(.32);
  later(scene,()=>{
    panel.animate([{opacity:1},{opacity:0}],{duration:ph(.08),...F});
    stamp.animate([{opacity:1},{opacity:0}],{duration:ph(.12),...F});
    dim.animate([{opacity:.78},{opacity:0}],{duration:ph(.14),...F});
    top?.animate([{height:"11%"},{height:"0%"}],{duration:ph(.12),...F});
    bottom?.animate([{height:"11%"},{height:"0%"}],{duration:ph(.12),...F});
    vig?.animate([{opacity:.85},{opacity:.25,offset:.5},{opacity:0}],{duration:ph(.3),...F});
    reveal();
  },outAt);
  later(scene,()=>{for(const n of [dim,flash,top,bottom,vig,cs]) n?.remove();},Math.max(total,outAt+ph(.3)));
}

/* ---------- 효과음 층 (기존 synthesizeImpact 위에 더한다) ---------- */
function sound(audio,kind){
  const a=audio?.ctx,out0=audio?.out;
  if(!a||!out0||a.state!=="running") return;
  const t=a.currentTime,out=a.createGain();out.gain.value=.45;out.connect(out0);
  const tone=(f0,f1,dur,type="sine",vol=.6,d=0)=>{const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t+d);o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+d+dur);g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(vol,t+d+.006);g.gain.exponentialRampToValueAtTime(.0001,t+d+dur);o.connect(g).connect(out);o.start(t+d);o.stop(t+d+dur+.03);};
  const burst=(dur,type,freq,vol=.5,d=0,q=1)=>{const b=a.createBuffer(1,Math.ceil(a.sampleRate*dur),a.sampleRate),ch=b.getChannelData(0);for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length)**2;const s=a.createBufferSource();s.buffer=b;const f=a.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=a.createGain();g.gain.value=vol;s.connect(f).connect(g).connect(out);s.start(t+d);};
  ({
    crit(){burst(.1,"highpass",2600,.3);tone(1900,1500,.28,"sine",.1,.01);},
    injury(){burst(.2,"bandpass",650,.9,0,.8);tone(110,42,.28,"sine",.6);},
    loss(){tone(72,28,.9,"sine",.9);burst(.35,"lowpass",520,.8);},
    slash(){burst(.24,"bandpass",3600,.6,0,2);burst(.12,"highpass",5000,.25,.02);},
    stamp(){tone(95,38,.55,"square",.2);burst(.3,"lowpass",900,.7);tone(55,30,.7,"sine",.7);},
    ring(){tone(3400,3320,1.5,"sine",.04);},
    whoosh(){burst(.28,"bandpass",1100,.4,0,1.3);}
  })[kind]?.();
}

function cancel(scene){
  const t=scene?._hitfx;
  if(!t) return;
  t.timers.splice(0).forEach(clearTimeout);
  t.nodes.splice(0).forEach(n=>n.remove());
  scene.querySelectorAll?.(".part-loss-pop").forEach(p=>p.style.visibility="");
}

globalThis.CPHitFx={CONFIG,tierOf,holdFor,decorate,play,cancel};
})();
