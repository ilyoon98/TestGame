import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";
import {inspectRgbaPng} from "./helpers/png.mjs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const actors=["nun","guard","awakened","janitor","crawler","medic","sentinel","warden"];

test("all eight actors have one attack and one hurt cutout with registered ground and intact margins",()=>{
  const run=engine();
  for(const id of actors){
    const party=actors.indexOf(id)<3;
    const width=party?1024:360,height=party?1536:["janitor","crawler"].includes(id)?344:376;
    const baseline={nun:1432,guard:1445,awakened:1452}[id]??height-6;
    const frames=[];
    for(const pose of ["attack","hit"]){
      const src=run(`motionArt['${id}']['${pose}']`);
      const png=inspectRgbaPng(readFileSync(new URL(`../${src}`,import.meta.url)));
      assert.equal(png.width,width);assert.equal(png.height,height);
      assert.ok(png.transparent/(width*height)>.35,`${id}/${pose}: insufficient alpha`);
      assert.ok(png.bounds.left>4 && png.bounds.right<width-4,`${id}/${pose}: cropped weapon`);
      assert.ok(png.bounds.top>4 && png.bounds.bottom<height-3,`${id}/${pose}: cropped head or feet`);
      assert.ok(Math.abs(png.bounds.bottom-baseline)<=2,`${id}/${pose}: floating foot`);
      frames.push(png.bounds.bottom);
    }
    assert.ok(Math.abs(frames[0]-frames[1])<=2,`${id}: inconsistent ground`);
  }
});

test("the route shows room icons and one travel bonus without combat forecasts",()=>{
  const run=engine();
  const map=run("mapPanel()");
  assert.equal((map.match(/data-room-type=/g)||[]).length,7);
  assert.equal((map.match(/data-action="move"/g)||[]).length,3);
  for(const kind of ["battle","rest","elite","exit"]) assert.ok(map.includes(`data-room-type="${kind}"`));
  assert.equal((map.match(/도망 여유/g)||[]).length,1);
  for(const detail of ["주 표적","출구까지","전투 진입 여유","기어오는 탈옥수","붕대를 감은 탈옥수"]) assert.ok(!map.includes(detail));
  assert.ok(map.includes('aria-current="location"'));
  assert.ok(map.includes("휴식·치료"));
  assert.match(html,/\.combat \.hotspots\{visibility:hidden;pointer-events:none\}/);
  run("layoutCombatHud=()=>{}; renderScreen();");
  const stage=run("document.querySelector('#stage').innerHTML");
  assert.ok(!stage.includes('<svg class="intent-arrows"'));
  assert.ok(stage.includes('class="actor-body-status"'));
});

function presentation({reduced=false,speed=1}={}){
  const run=engine();
  run(`
    cancelAutoBattleTimer(); autoPaused=true; autoSpeed=${speed};
    matchMedia=()=>({matches:${reduced}});
    scheduleAutoBattle=()=>{};showImpact=()=>{};
    globalThis.actionReadout={className:'combat-action',innerHTML:''};
    globalThis.sprites=Object.fromEntries(['player','companion','enemy'].map(side=>[side,{
      tagName:side==='enemy'?'DIV':'IMG',dataset:{},style:{backgroundImage:''},src:side+'-idle.png',
      getAttribute(name){return this[name];},setAttribute(name,value){this[name]=value;},
      animate(){throw Error('still poses must not tween the whole character');}
    }]));
    globalThis.panels=Object.fromEntries(['player','companion','enemy'].map(side=>[side,{
      dataset:{portrait:{player:'nun',companion:'guard',enemy:'janitor'}[side]},
      querySelector:()=>sprites[side]
    }]));
    globalThis.scene={
      querySelector(selector){return selector==='.combat-action'?actionReadout:panels[selector.replace('.actor-','')]??null;},
      querySelectorAll(selector){return selector==='.actor-sprite[data-pose]'?Object.values(sprites).filter(s=>s.dataset.pose):[];}
    };
    document.querySelector('#stage').querySelector=selector=>selector==='.stage-combat'?scene:null;
  `);
  const at=time=>{
    for(;;){
      const next=[...run.timers].sort((a,b)=>a[1].delay-b[1].delay)[0];
      if(!next || next[1].delay>time)break;
      run.timers.delete(next[0]);next[1].callback();
    }
  };
  return {run,at};
}
const hit=(from="player",side="enemy",dealt=2)=>({type:"hit",from,side,dealt,hp:6,blocked:0,targets:["chest"],card:"strike",intent:null});

test("attack and hit stills hold through contact and restore idle before a counter or final result",()=>{
  const {run,at}=presentation();
  run(`game.feedback=${JSON.stringify([hit(),{...hit("enemy","player"),fallen:true}])};game.phase='won';playCombatFeedback();`);
  at(0);assert.match(run("sprites.player.src"),/nun-attack\.png$/);
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
  at(105);assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-hit\.png/);
  at(574);assert.match(run("sprites.player.src"),/nun-attack\.png$/);
  at(575);assert.equal(run("sprites.player.src"),"player-idle.png");
  assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-attack\.png/);
  at(680);assert.match(run("sprites.player.src"),/nun-hit\.png$/);
  at(1150);assert.equal(run("sprites.player.src"),"player-idle.png");
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
  assert.equal(run("combatPresentation"),null);
  assert.equal(run("document.querySelector('#stage').inert"),false);
  assert.equal(run.timers.size,0);
});

test("a completely blocked attack never uses the hurt image",()=>{
  const {run,at}=presentation();
  run(`game.feedback=${JSON.stringify([{...hit("enemy","player",0),blocked:2}])};playCombatFeedback();`);
  at(105);assert.equal(run("sprites.player.src"),"player-idle.png");
  assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-attack/);
  const readout=run("actionReadout.innerHTML");
  assert.match(readout,/기본 공격.*수녀 가슴.*완전 방어 · 2 막음/s);
  assert.doesNotMatch(readout,/보상 카드/);
  at(575);assert.equal(run("sprites.enemy.style.backgroundImage"),"");
});

test("companion poses honor reduced motion and speed, and cancellation restores all sprites",()=>{
  const {run,at}=presentation({reduced:true,speed:4});
  run(`game.feedback=${JSON.stringify([hit("companion","enemy")])};playCombatFeedback();`);
  at(0);assert.match(run("sprites.companion.src"),/guard-attack/);
  assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-hit/);
  at(117.5);assert.equal(run("sprites.companion.src"),"companion-idle.png");
  assert.match(run("actionReadout.innerHTML"),/피해 2/);
  run("cancelCombatPresentation();");
  assert.equal(run("sprites.companion.src"),"companion-idle.png");
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
  assert.equal(run("actionReadout.innerHTML"),"");
  assert.equal(run.timers.size,0);
  at(200);assert.equal(run("sprites.companion.src"),"companion-idle.png");
});

test("an activated reward card shows its real effects and stays readable at 4× speed",()=>{
  const {run,at}=presentation({speed:4});
  run("applyCard('cover',game.player,game.enemy,['arms','legs']);playCombatFeedback();");
  at(0);
  assert.match(run("actionReadout.innerHTML"),/퇴로 엄호.*보상 카드.*수녀 팔·다리.*각 가드 \+3/s);
  assert.match(run("document.querySelector('#combat-announcement').textContent"),/보상 카드 · 퇴로 엄호/);
  at(649);assert.match(run("actionReadout.className"),/is-reward/);
  at(650);assert.equal(run("actionReadout.innerHTML"),"");
  assert.equal(run("actionReadout.className"),"combat-action");
  assert.equal(run("combatPresentation"),null);
});

test("unloaded or failed pose images leave the idle art visible",()=>{
  const {run}=presentation();
  run("poseCache.set(motionArt.nun.attack,{complete:false,naturalWidth:0});setActorPose(scene,'player','attack');");
  assert.equal(run("sprites.player.src"),"player-idle.png");
  run("poseCache.set(motionArt.nun.attack,{complete:true,naturalWidth:0});setActorPose(scene,'player','attack');");
  assert.equal(run("sprites.player.src"),"player-idle.png");
  run("poseCache.set(motionArt.nun.attack,{complete:true,naturalWidth:1024});setActorPose(scene,'player','attack');restoreActorPoses(scene);");
  assert.equal(run("sprites.player.src"),"player-idle.png");
});
