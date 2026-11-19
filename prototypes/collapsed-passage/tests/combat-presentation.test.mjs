import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";
import {inspectRgbaPng} from "./helpers/png.mjs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const partyBaselines={nun:1432,guard:1445,awakened:1452,archer:1446,shaman:1452};
const actors=[...Object.keys(partyBaselines),"janitor","crawler","medic","sentinel","warden"];

test("all actors have attack and hurt cutouts with registered ground and a defeat sprite",()=>{
  const run=engine();
  for(const id of actors){
    const party=Object.hasOwn(partyBaselines,id);
    const width=party?1024:360,height=party?1536:["janitor","crawler"].includes(id)?344:376;
    const baseline=partyBaselines[id]??height-6;
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
    const defeat=readFileSync(new URL(`../${run(`motionArt['${id}'].defeat`)}`,import.meta.url));
    assert.equal(defeat.toString("ascii",8,12),"WEBP");
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
  assert.match(map,/<div class="map-node current" data-room="threshold"[^>]*aria-current="location"/);
  assert.match(map,/<span class="room-state">현재 위치<\/span>/);
  assert.equal((map.match(/<span class="room-state">이동 가능<\/span>/g)||[]).length,3);
  assert.match(map,/<div class="map-node " data-room="lift"[^>]*>/);
  assert.ok(map.includes("휴식·치료"));
  assert.match(html,/\.combat \.hotspots\{visibility:hidden;pointer-events:none\}/);
  run("layoutCombatHud=()=>{}; renderScreen();");
  const stage=run("document.querySelector('#stage').innerHTML");
  assert.ok(!stage.includes('<svg class="intent-arrows"'));
  assert.ok(stage.includes('class="actor-body-status"'));
  run("game.enemy.hp=0; finishCombat(); chooseReward(null); declineCompanion(); moveTo('corridor');");
  const afterMove=run("mapPanel()");
  assert.match(afterMove,/<div class="map-node visited" data-room="threshold"/);
  assert.match(afterMove,/<div class="map-node current" data-room="corridor"[^>]*aria-current="location"/);
  assert.match(afterMove,/<button class="map-node next" data-room="landing"/);
  assert.equal((afterMove.match(/data-action="move"/g)||[]).length,1);
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
      getAttribute(name){return this[name];},setAttribute(name,value){this[name]=value;}
    }]));
    globalThis.emotes={};
    globalThis.figures=Object.fromEntries(Object.keys(sprites).map(side=>[side,{
      insertAdjacentHTML(_position,html){emotes[side]={html,remove(){delete emotes[side];}};}
    }]));
    globalThis.panels=Object.fromEntries(['player','companion','enemy'].map(side=>[side,{
      dataset:{portrait:{player:'nun',companion:'guard',enemy:'janitor'}[side]},
      health:{textContent:''},
      querySelector(selector){return selector==='.foe-health'?this.health:sprites[side];}
    }]));
    globalThis.scene={
      dataset:{},style:{setProperty(){}},
      querySelector(selector){
        if(selector==='.combat-action') return actionReadout;
        if(selector==='.combat-skill-emote') return Object.values(emotes)[0]??null;
        if(selector.endsWith(' .actor-figure')) return figures[selector.split(' ')[0].replace('.actor-','')]??null;
        return panels[selector.replace('.actor-','')]??null;
      },
      querySelectorAll(selector){
        if(selector==='.actor-sprite[data-pose]') return Object.values(sprites).filter(s=>s.dataset.pose);
        if(selector==='.actor-sprite[data-defeated]') return Object.values(sprites).filter(s=>'defeated' in s.dataset);
        if(selector==='.panel[data-lunge]') return Object.values(panels).filter(p=>p.dataset.lunge);
        if(selector==='.impact, .combat-skill-emote') return Object.values(emotes);
        return [];
      }
    };
    globalThis.playerHealth={textContent:'',style:{setProperty(){}},classList:{toggle(){}}};
    const gauge=document.querySelector('#status .status-box.health');
    gauge.querySelector=()=>playerHealth;
    gauge.classList=playerHealth.classList;
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
  run(`game.feedback=${JSON.stringify([hit(),hit("enemy","player")])};game.phase='won';playCombatFeedback();`);
  at(0);assert.match(run("sprites.player.src"),/nun-attack\.png$/);
  assert.match(run("emotes.player.html"),/<img class="combat-skill-emote" src="art\/skills\/emotes\/strike\.webp"/);
  assert.equal(run("panels.player.dataset.lunge"),"normal");
  assert.equal(run("panels.player.dataset.attackMotion"),"thrust");
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
  at(105);assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-hit\.png/);
  at(574);assert.match(run("sprites.player.src"),/nun-attack\.png$/);
  at(575);assert.equal(run("sprites.player.src"),"player-idle.png");
  assert.equal(run("Object.keys(emotes).length"),0);
  assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-attack\.png/);
  assert.equal(run("panels.player.dataset.lunge"),undefined);
  assert.equal(run("panels.player.dataset.attackMotion"),undefined);
  assert.equal(run("panels.enemy.dataset.lunge"),"normal");
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
  assert.doesNotMatch(readout,/보상 기술/);
  at(575);assert.equal(run("sprites.enemy.style.backgroundImage"),"");
});

test("companion poses honor reduced motion and speed, and cancellation restores all sprites",()=>{
  const {run,at}=presentation({reduced:true,speed:4});
  run(`game.feedback=${JSON.stringify([hit("companion","enemy")])};playCombatFeedback();`);
  at(0);assert.match(run("sprites.companion.src"),/guard-attack/);
  assert.equal(run("panels.companion.dataset.lunge"),undefined);
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

test("the archer and shaman show their own attack, hurt, and defeat frames",()=>{
  for(const [kind,card] of [["archer","snapShot"],["shaman","unseal"]]){
    const {run,at}=presentation({reduced:true,speed:4});
    run(`const companionType=companionTypes['${kind}'];
      game.companion=fighter(companionType.name,companionType.health,companionType.vitality);
      panels.companion.dataset.portrait='${kind}';`);
    run(`game.feedback=${JSON.stringify([{...hit("companion","enemy"),card}])};playCombatFeedback();`);
    at(0);
    assert.equal(run("sprites.companion.src"),`art/characters/motion/${kind}-attack.png`);
    assert.match(run("emotes.companion.html"),new RegExp(card));
    at(117.5);assert.equal(run("sprites.companion.src"),"companion-idle.png");
    run("cancelCombatPresentation();");
    run(`game.feedback=${JSON.stringify([hit("enemy","companion")])};playCombatFeedback();`);
    at(0);assert.equal(run("sprites.companion.src"),`art/characters/motion/${kind}-hit.png`);
    at(117.5);assert.equal(run("sprites.companion.src"),"companion-idle.png");
    run("cancelCombatPresentation();");
    run(`game.feedback=${JSON.stringify([{...hit("enemy","companion"),defeated:true,hp:0}])};playCombatFeedback();`);
    at(999);assert.equal(run("sprites.companion.src"),`art/characters/motion/${kind}-defeat.webp`);
    run("cancelCombatPresentation();");
    assert.equal(run("sprites.companion.src"),"companion-idle.png");
  }
});

test("an activated reward skill shows its real effects and stays readable at 4× speed",()=>{
  const {run,at}=presentation({speed:4});
  run("applyCard('cover',game.player,game.enemy,['arms','legs']);playCombatFeedback();");
  at(0);
  assert.match(run("actionReadout.innerHTML"),/퇴로 엄호.*보상 기술.*수녀 팔·다리.*각 가드 \+3/s);
  assert.match(run("document.querySelector('#combat-announcement').textContent"),/보상 기술 · 퇴로 엄호/);
  at(649);assert.match(run("actionReadout.className"),/is-reward/);
  at(650);assert.equal(run("actionReadout.innerHTML"),"");
  assert.equal(run("actionReadout.className"),"combat-action");
  assert.equal(run("combatPresentation"),null);
});

test("a class skill shows its emote over the caster for 400 ms at 4× speed",()=>{
  const {run,at}=presentation({speed:4});
  const cast="game.feedback=[{type:'guard',card:'escort',from:'companion',side:'player',targets:['head'],added:3,intent:null}];playCombatFeedback();";
  run(cast);
  at(0);
  assert.match(run("emotes.companion.html"),/<img class="combat-skill-emote" src="art\/skills\/emotes\/escort\.webp"/);
  assert.equal(run("emotes.player"),undefined);
  at(399);
  assert.equal(run("Boolean(emotes.companion)"),true);
  at(400);
  assert.equal(run("emotes.companion"),undefined);
  at(420);

  run(cast);
  at(0);
  run("cancelCombatPresentation();");
  assert.equal(run("emotes.companion"),undefined);
  assert.equal(run.timers.size,0);
});

test("unloaded or failed pose images leave the idle art visible",()=>{
  const {run}=presentation();
  run("combatArtCache.set(motionArt.nun.attack,{complete:false,naturalWidth:0});setActorPose(scene,'player','attack');");
  assert.equal(run("sprites.player.src"),"player-idle.png");
  run("combatArtCache.set(motionArt.nun.attack,{complete:true,naturalWidth:0});setActorPose(scene,'player','attack');");
  assert.equal(run("sprites.player.src"),"player-idle.png");
  run("combatArtCache.set(motionArt.nun.attack,{complete:true,naturalWidth:1024});setActorPose(scene,'player','attack');restoreActorPoses(scene);");
  assert.equal(run("sprites.player.src"),"player-idle.png");
});

test("the pursuit cue sounds once per warning, and leg injuries expose their travel cost",()=>{
  const run=engine();
  run("layoutCombatHud=()=>{}; playPursuitSound=()=>game.testCues=(game.testCues??0)+1; game.distance=3; renderScreen();");
  const stage=()=>run("document.querySelector('#stage').innerHTML");
  assert.doesNotMatch(stage(),/class="pursuit-warning"/);
  assert.match(stage(),/class="leg-status healthy" hidden/);
  run("game.distance=2; renderScreen(); renderScreen(); game.distance=1; renderScreen();");
  assert.match(stage(),/사형수가 가까워졌어요.*도망 여유 1/s);
  assert.equal(run("game.testCues"),1);
  run("hit(game.enemy,game.player,'legs',4,{id:'heavy'},game); renderScreen();");
  assert.match(stage(),/다리 부상.*다음 이동 \+1/s);
  assert.match(run("legStatusLabel(game.feedback[0].legChange.after,game.feedback[0].legChange.before)"),/\+2 → \+1/);
  assert.match(stage(),/class="wound-durability"[^>]*>3\/7/);
  run("hit(game.enemy,game.player,'legs',1,{id:'strike'},game);");
  assert.equal(run("game.feedback.at(-1).wounds[0].hp"),2);
  run("hit(game.enemy,game.player,'legs',2,{id:'strike'},game); renderScreen();");
  assert.match(stage(),/다리 결손.*다음 이동 \+0/s);
  assert.match(stage(),/class="wound-durability"[^>]*>0\/7/);
  run("game.player.body.legs.hp=7; game.distance=4; renderScreen();");
  assert.doesNotMatch(stage(),/class="pursuit-warning"/);
  assert.match(stage(),/class="leg-status healthy" hidden/);
});

test("critical feedback counts only bonus damage that gets through guard and part durability",()=>{
  const run=engine();
  assert.equal(run("applyCard('heavy',game.player,game.enemy,['head']); game.feedback.at(-1).critical"),1);
  assert.equal(run("game.enemy.body.chest.guard=5; applyCard('heavy',game.player,game.enemy,['chest']); game.feedback.at(-1).critical"),0);
  assert.equal(run("game.enemy.body.chest.hp=1; applyCard('heavy',game.player,game.enemy,['chest']); game.feedback.at(-1).critical"),0);
});

test("a critical chop keeps the larger emote until its 550 ms animation ends at 4×",()=>{
  const {run,at}=presentation({speed:4});
  run(`game.feedback=${JSON.stringify([{...hit(),card:"heavy",critical:1},hit("enemy","player")])};playCombatFeedback();`);
  at(0);
  assert.equal(run("panels.player.dataset.attackMotion"),"chop");
  assert.match(run("emotes.player.html"),/data-emphasis="critical" style="--emote-duration:550ms"/);
  at(549);
  assert.equal(run("Boolean(emotes.player)"),true);
  assert.equal(run("panels.enemy.dataset.attackMotion"),undefined);
  at(550);
  assert.equal(run("emotes.player"),undefined);
  assert.equal(run("panels.enemy.dataset.attackMotion"),"thrust");
});

test("a final blow shows the defeat frame for one real second at 4×",()=>{
  const {run,at}=presentation({speed:4});
  run(`game.feedback=${JSON.stringify([{...hit(),hp:0,critical:1,defeated:true}])};game.phase='reward';playCombatFeedback();`);
  at(0);assert.equal(run("panels.player.dataset.lunge"),"strong");
  assert.match(run("emotes.player.html"),/data-emphasis="finisher" style="--emote-duration:650ms"/);
  at(26.25);assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-defeat\.webp/);
  assert.match(run("actionReadout.innerHTML"),/치명타 \+1 · 격파/);
  assert.equal(run("scene.dataset.impact"),"finisher");
  at(649);assert.equal(run("Boolean(emotes.player)"),true);
  at(650);assert.equal(run("emotes.player"),undefined);
  at(1026.24);assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-defeat\.webp/);
  assert.notEqual(run("combatPresentation"),null);
  at(1026.25);assert.equal(run("combatPresentation"),null);
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
});
