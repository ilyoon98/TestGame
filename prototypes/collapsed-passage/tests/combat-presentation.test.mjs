import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";
import {inspectRgbaPng} from "./helpers/png.mjs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const partyBaselines={nun:1432,guard:1445,awakened:1452,archer:1446,shaman:1452};
const actors=[...Object.keys(partyBaselines),"janitor","crawler","medic","sentinel","warden"];

test("all actors have attack, guard, hurt, and defeat cutouts",()=>{
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
    const webpPoses=id==="nun" || id==="shaman"?["guard","heal"]:["guard"];
    if(id==="archer") webpPoses.push("release");
    for(const pose of webpPoses){
      const frame=readFileSync(new URL(`../${run(`motionArt['${id}']['${pose}']`)}`,import.meta.url));
      assert.equal(frame.toString("ascii",8,16),"WEBPVP8X");
      assert.ok(frame[20]&0x10,`${id}/${pose}: missing alpha`);
      assert.deepEqual([frame.readUIntLE(24,3)+1,frame.readUIntLE(27,3)+1],[width,height]);
    }
    const defeat=readFileSync(new URL(`../${run(`motionArt['${id}'].defeat`)}`,import.meta.url));
    assert.equal(defeat.toString("ascii",8,12),"WEBP");
  }
});

test("registered arm loss art matches its authored coordinates and transparent canvas",()=>{
  const run=engine();
  const anchors=JSON.parse(readFileSync(new URL("../art/characters/conditions/arms-lost/anchors.json",import.meta.url),"utf8"));
  const registered=JSON.parse(run("JSON.stringify(armLossAnchors)"));
  assert.deepEqual(Object.keys(registered).sort(),Object.keys(partyBaselines).sort());
  assert.deepEqual(registered,anchors.actorFigurePercent);
  for(const [kind,poses] of Object.entries(registered)){
    const animated=JSON.parse(run(`JSON.stringify(Object.keys(motionArt['${kind}']))`));
    assert.deepEqual(Object.keys(poses).sort(),["idle",...animated].sort(),kind);
    for(const [pose,point] of Object.entries(poses)){
      const label=`${kind}/${pose}`;
      assert.deepEqual(point,anchors.actorFigurePercent[kind]?.[pose],label);
      const src=run(`armLossSrc('${kind}','${pose}')`);
      assert.ok(src,`Missing arm loss art for ${label}`);
      const frame=readFileSync(new URL(`../${src}`,import.meta.url));
      assert.equal(frame.toString("ascii",8,16),"WEBPVP8X",label);
      assert.ok(frame[20]&0x10,`${label}: missing alpha`);
      assert.deepEqual([frame.readUIntLE(24,3)+1,frame.readUIntLE(27,3)+1],[1024,1536],label);
    }
  }
});

test("all five allies have registered kneeling art with and without an arm loss",()=>{
  const run=engine();
  const registered=JSON.parse(run("JSON.stringify(kneelingAnchors)"));
  const anchors=JSON.parse(readFileSync(new URL("../art/characters/conditions/legs-lost/anchors.json",import.meta.url),"utf8"));
  assert.deepEqual(Object.keys(registered).sort(),Object.keys(partyBaselines).sort());
  assert.deepEqual(registered,anchors.actorFigurePercent);
  for(const [kind,variants] of Object.entries(registered)){
    assert.deepEqual(Object.keys(variants).sort(),["armsAndLegs","legsOnly"]);
    for(const [variant,poses] of Object.entries(variants)){
      assert.deepEqual(Object.keys(poses).sort(),["attack","guard","hit","idle"],`${kind}/${variant}`);
      for(const pose of Object.keys(poses)){
        const path=run(`kneelingSrc('${kind}','${variant}','${pose}')`);
        const sprite=readFileSync(new URL(`../${path}`,import.meta.url));
        assert.equal(sprite.toString("ascii",8,16),"WEBPVP8X",path);
        assert.ok(sprite[20]&0x10,path);
        assert.deepEqual([sprite.readUIntLE(24,3)+1,sprite.readUIntLE(27,3)+1],[1024,1536],path);
      }
    }
  }
});

test("combat wound decals are available with transparency",()=>{
  const run=engine();
  const images=JSON.parse(run("JSON.stringify(Object.values(woundSprites))"));
  assert.equal(images.length,2);
  for(const src of images){
    const frame=readFileSync(new URL(`../${src}`,import.meta.url));
    assert.equal(frame.toString("ascii",8,16),"WEBPVP8X",src);
    assert.ok(frame[20]&0x10,src);
  }
});

test("the route shows room icons and one travel bonus without combat forecasts",()=>{
  const run=engine();
  const map=run("mapPanel()");
  assert.equal((map.match(/data-room-type=/g)||[]).length,7);
  assert.equal((map.match(/data-action="move"/g)||[]).length,3);
  for(const kind of ["battle","rest","boss","exit"]) assert.ok(map.includes(`data-room-type="${kind}"`));
  assert.ok(map.includes(run('icon("bell")')));
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
  run("game.enemy.hp=0; finishCombat(); declineCompanion(); chooseReward(null); moveTo('corridor');");
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
    globalThis.announcement=document.querySelector('#combat-announcement');
    announcement.textContent='';
    const slotsBySelector={};
    function makeSkillSlot(side,id){
      const slot={dataset:{},label:{innerHTML:''},querySelector(){return this.label;}};
      slotsBySelector['[data-skill="'+id+'"][data-skill-side="'+side+'"]']=slot;
      return slot;
    }
    globalThis.rewardSlot=makeSkillSlot('player','cover');
    globalThis.strikeSlot=makeSkillSlot('player','strike');
    globalThis.escortSlot=makeSkillSlot('companion','escort');
    globalThis.sprites=Object.fromEntries(['player','companion','enemy'].map(side=>[side,{
      tagName:side==='enemy'?'DIV':'IMG',dataset:{},style:{backgroundImage:''},src:side+'-idle.png',
      closest(){return panels[side];},
      getAttribute(name){return this[name];},setAttribute(name,value){this[name]=value;}
    }]));
    globalThis.emotes={};
    globalThis.figures=Object.fromEntries(Object.keys(sprites).map(side=>[side,{
      insertAdjacentHTML(_position,html){emotes[side]={html,remove(){delete emotes[side];}};}
    }]));
    globalThis.panels=Object.fromEntries(['player','companion','enemy'].map(side=>[side,{
      dataset:{portrait:{player:'nun',companion:'guard',enemy:'janitor'}[side]},
      health:{textContent:''},
      guardBadge:{innerHTML:''},
      armMarker:{hidden:true,style:{setProperty(){}}},
      woundArt:{dataset:{wounds:'[]'},innerHTML:''},
      querySelector(selector){
        if(selector==='.foe-health') return this.health;
        if(selector==='.actor-guard') return this.guardBadge;
        if(selector==='.arm-loss-marker') return this.armMarker;
        if(selector==='.actor-wound-decals') return side==='enemy'?null:this.woundArt;
        return sprites[side];
      }
    }]));
    globalThis.scene={
      dataset:{},style:{setProperty(){}},
      querySelector(selector){
        if(selector==='.combat-skill-emote') return Object.values(emotes)[0]??null;
        if(selector.endsWith(' .actor-figure')) return figures[selector.split(' ')[0].replace('.actor-','')]??null;
        return panels[selector.replace('.actor-','')]??null;
      },
      querySelectorAll(selector){
        if(selector==='.actor-sprite[data-pose]') return Object.values(sprites).filter(s=>s.dataset.pose);
        if(selector==='.actor-sprite[data-defeated]') return Object.values(sprites).filter(s=>'defeated' in s.dataset);
        if(selector==='.panel[data-lunge]') return Object.values(panels).filter(p=>p.dataset.lunge);
        if(selector.split(', ').includes('.combat-skill-emote')) return Object.values(emotes);
        if(selector==='.combat-impact-number') return globalThis.damageNumber?[damageNumber]:[];
        return [];
      }
    };
    globalThis.playerHealth={textContent:'',style:{setProperty(){}},classList:{toggle(){}}};
    const gauge=document.querySelector('#status .status-box.health');
    gauge.querySelector=()=>playerHealth;
    gauge.classList=playerHealth.classList;
    const stage=document.querySelector('#stage');
    stage.querySelector=selector=>selector==='.stage-combat'?scene:slotsBySelector[selector]??null;
    stage.querySelectorAll=selector=>selector==='.skill-slot[data-activation]'?
      Object.values(slotsBySelector).filter(slot=>slot.dataset.activation):[];
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
  const readout=run("announcement.textContent");
  assert.match(readout,/기본 공격.*수녀 가슴.*완전 방어 · 2 막음/s);
  assert.doesNotMatch(readout,/보상 기술/);
  assert.equal(run("strikeSlot.dataset.activation"),undefined);
  at(575);assert.equal(run("sprites.enemy.style.backgroundImage"),"");
});

test("the health bar keeps guard on parts untouched by a hit",()=>{
  const {run,at}=presentation({speed:4});
  run(`
    game.player.body.arms.guard=5;
    game.cooldownBattle.enemyReadyAt=0;
    game.cooldownBattle.enemySkills=[["heavy","legs"]];
    executePartySkill({id:"cover",side:"player"});
    playCombatFeedback();
  `);
  at(0);
  assert.match(run("panels.player.guardBadge.innerHTML"),/부위 가드 합계 11 · 머리 3 · 팔 5 · 다리 3/);
  at(650);
  run("advanceAutoBattle(); playCombatFeedback();");
  at(26.25);
  assert.match(run("panels.player.health.innerHTML"),/26\/28/);
  assert.match(run("panels.player.health.innerHTML"),/부위 가드 합계 8 · 머리 3 · 팔 5/);
});

test("kneeling pose selection preserves both losses and falls back to a kneeling frame for other actions",()=>{
  const {run}=presentation();
  run(`
    const anchors={eyes:[52,48],belly:[48,63],legs:[63,82],arms:[60,54]};
    kneelingAnchors.nun={
      legsOnly:{idle:anchors,attack:anchors},
      armsAndLegs:{idle:anchors,guard:anchors,hit:anchors}
    };
    updateWoundDecals(panels.player,"idle",[{id:"legs",level:"lost"}]);
    setActorPose(scene,"player","attack");
  `);
  assert.match(run("sprites.player.src"),/legs-lost\/nun-attack\.webp$/);
  run('panels.player.dataset.armsLost=""; setActorPose(scene,"player","guard");');
  assert.match(run("sprites.player.src"),/legs-lost\/nun-guard-arms-lost\.webp$/);
  assert.match(run("panels.player.woundArt.innerHTML"),/--x:63%;--y:82%/);
  run('setActorPose(scene,"player","heal");');
  assert.match(run("sprites.player.src"),/legs-lost\/nun-idle-arms-lost\.webp$/);
  run('setActorPose(scene,"player","hit"); restoreActorPoses(scene);');
  assert.match(run("sprites.player.src"),/legs-lost\/nun-idle-arms-lost\.webp$/);
  run('setActorPose(scene,"player","defeat");');
  assert.match(run("sprites.player.src"),/arms-lost\/nun-defeat\.webp$/);
  assert.equal(run("'kneeling' in panels.player.dataset"),false);
});

test("an arm loss becomes visible at impact and carries through pose changes",()=>{
  const {run,at}=presentation({speed:4});
  run(`
    game.player.body.arms.hp=0;
    game.feedback=[{type:"hit",card:"strike",from:"enemy",side:"player",targets:["arms"],dealt:7,hp:21,injury:"lost",intent:null}];
    playCombatFeedback();
  `);
  at(26.24);
  assert.equal(run("sprites.player.src"),"player-idle.png");
  at(26.25);
  assert.match(run("sprites.player.src"),/arms-lost\/nun-hit\.webp$/);
  assert.equal(run("panels.player.armMarker.hidden"),true);
  at(526.25);
  assert.match(run("sprites.player.src"),/arms-lost\/nun-idle\.webp$/);
  run("setActorPose(scene,'player','guard');");
  assert.match(run("sprites.player.src"),/arms-lost\/nun-guard\.webp$/);
  run("combatArtCache.set(armLossSrc('nun','attack'),{complete:true,naturalWidth:0}); setActorPose(scene,'player','attack');");
  assert.match(run("sprites.player.src"),/motion\/nun-attack\.png$/);
  assert.equal(run("panels.player.armMarker.hidden"),false);
  run("restoreActorPoses(scene); game.player.body.arms.hp=7;");
  assert.match(run("sprites.player.src"),/arms-lost\/nun-idle\.webp$/);
  assert.match(run("bodyPanel('player',[],'healthy')"),/src="art\/characters\/nun-sd\.png"/);
  assert.doesNotMatch(run("bodyPanel('player',[],'healthy')"),/data-arms-lost/);
});

test("an archer with an arm loss stays visually consistent if the release pose is displayed",()=>{
  const {run}=presentation();
  run(`
    const archer=companionTypes.archer;
    game.companion={...fighter(archer.name,archer.health,archer.vitality),kind:"archer"};
    game.companion.body.arms.hp=0;
    game.formation[1]="companion";
    panels.companion.dataset.portrait="archer";
    panels.companion.dataset.armsLost="";
    setActorPose(scene,"companion","release");
  `);
  assert.equal(run("skillBlocked({id:'snapShot',side:'companion'})"),"팔 결손");
  assert.match(run("sprites.companion.src"),/arms-lost\/archer-release\.webp$/);
  assert.equal(run("panels.companion.armMarker.hidden"),true);
});

test("localized wounds follow combat poses and the eye wrap follows the displayed frame",()=>{
  const {run}=presentation();
  const injuries=[{id:"eyes",level:"lost"},{id:"arms",level:"lost"},{id:"legs",level:"lost"},{id:"belly",level:"lost"}];
  run(`panels.player.dataset.armsLost=""; updateWoundDecals(panels.player,"idle",${JSON.stringify(injuries)});`);
  const idle=run("panels.player.woundArt.innerHTML");
  assert.doesNotMatch(idle,/data-part="(?:arms|eyes)"|face-decal|fear|sweat|face-blood|gash/);
  assert.match(idle,/data-part="legs" data-level="lost"[^>]*--size:18%[^>]*><img[^>]*\/wrap\.webp/);
  assert.match(idle,/data-part="belly" data-level="lost"[^>]*--size:19%[^>]*><img[^>]*\/wrap\.webp/);
  assert.equal(run("'legsLost' in panels.player.dataset"),true);
  run("setActorPose(scene,'player','guard');");
  const guarding=run("panels.player.woundArt.innerHTML");
  assert.notEqual(guarding,idle);
  assert.match(guarding,/class="eye-loss-wrap" data-part="eyes" data-level="lost"[^>]*--x:68%;--y:40\.7%/);
  assert.match(run("sprites.player.src"),/legs-lost\/nun-guard-arms-lost\.webp$/);
  assert.equal(run('woundDecals("nun","idle",[{id:"eyes",level:"injured"},{id:"head",level:"injured"}])'),"");
  run('updateWoundDecals(panels.player,"defeat",[{id:"head",level:"lost"}]);');
  assert.match(run("panels.player.woundArt.innerHTML"),/data-part="head" data-level="lost".*wound-loss-tag/s);
  assert.doesNotMatch(run("panels.player.woundArt.innerHTML"),/<img/);
  run('updateWoundDecals(panels.player,"idle",[]);');
  assert.equal(run("panels.player.woundArt.innerHTML"),"");
  assert.equal(run("'legsLost' in panels.player.dataset"),false);
});

test("eye loss shows a fitted wrap and status icon until the eye is restored",()=>{
  const run=engine();
  assert.doesNotMatch(run('bodyPanel("player",[],"healthy")'),/eye-loss-badge/);
  run("game.player.body.eyes.hp=0;");
  const injured=run('bodyPanel("player",[],"lost")');
  assert.match(injured,/<summary><span class="eye-loss-badge" role="img" aria-label="눈 결손".*결손 1<\/summary>/);
  assert.match(injured,/class="eye-loss-wrap" data-part="eyes" data-level="lost"[^>]*--x:58\.8%;--y:22%/);
  assert.ok(run('partDrawing("eyes",true).includes(icon("hiddenIntent"))'));
  assert.doesNotMatch(run('bodyPanel("enemy",[],"lost")'),/eye-loss-badge/);
  run("game.player.body.eyes.hp=game.player.body.eyes.max;");
  assert.doesNotMatch(run('bodyPanel("player",[],"healthy")'),/eye-loss-(?:badge|wrap)/);
});

test("damage numbers stay above emotes and remain visible for 250 ms at 4×",()=>{
  assert.match(html,/\.combat-impact-layer\{position:absolute;inset:0;z-index:10/);
  const {run,at}=presentation({speed:4});
  run(`showImpact=()=>{globalThis.damageNumber={remove(){globalThis.damageNumber=null;}};};
    game.feedback=${JSON.stringify([hit()])};playCombatFeedback();`);
  at(26.25);assert.equal(run("Boolean(damageNumber)"),true);
  at(276.25);assert.equal(run("Boolean(damageNumber)"),true);
  at(326.25);assert.equal(run("damageNumber"),null);
  assert.equal(run("Boolean(emotes.player)"),true);
});

test("companion poses honor reduced motion and speed, and cancellation restores all sprites",()=>{
  const {run,at}=presentation({reduced:true,speed:4});
  run(`game.feedback=${JSON.stringify([hit("companion","enemy")])};playCombatFeedback();`);
  at(0);assert.match(run("sprites.companion.src"),/guard-attack/);
  assert.equal(run("panels.companion.dataset.lunge"),undefined);
  assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-hit/);
  at(117.5);assert.equal(run("sprites.companion.src"),"companion-idle.png");
  assert.match(run("announcement.textContent"),/피해 2/);
  run("cancelCombatPresentation();");
  assert.equal(run("sprites.companion.src"),"companion-idle.png");
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
  assert.equal(run("announcement.textContent"),"");
  assert.equal(run.timers.size,0);
  at(200);assert.equal(run("sprites.companion.src"),"companion-idle.png");
});

test("the archer and shaman show their own attack, hurt, and defeat frames",()=>{
  for(const [kind,card] of [["archer","snapShot"],["shaman","unseal"]]){
    const {run,at}=presentation({reduced:true,speed:4});
    run(`const companionType=companionTypes['${kind}'];
      game.companion={...fighter(companionType.name,companionType.health,companionType.vitality),kind:'${kind}'};
      panels.companion.dataset.portrait='${kind}';`);
    run(`game.feedback=${JSON.stringify([{...hit("companion","enemy"),card}])};playCombatFeedback();`);
    at(0);
    assert.equal(run("sprites.companion.src"),`art/characters/motion/${kind}-attack.png`);
    assert.match(run("emotes.companion.html"),new RegExp(card));
    at(240);assert.equal(run("sprites.companion.src"),"companion-idle.png");
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

test("both bow skills release an arrow before impact or a critical cue at 4×",()=>{
  for(const card of ["aimedShot","snapShot"]){
    const {run,at}=presentation({speed:4});
    run(`
      game.companion={kind:"archer"};
      panels.companion.dataset.portrait="archer";
      globalThis.arrow=null;
      globalThis.arrowHit=null;
      showAttackFlight=(_scene,event,projectile)=>arrow={event,projectile,remove(){arrow=null;}};
      const lookup=scene.querySelector.bind(scene);
      scene.querySelector=selector=>selector===".arrow-flight"?arrow:lookup(selector);
      showImpact=(_scene,event)=>arrowHit=event;
      game.feedback=${JSON.stringify([{...hit("companion","enemy"),card,critical:1}])};
      playCombatFeedback();
    `);
    at(26.24);
    assert.match(run("sprites.companion.src"),/archer-attack\.png$/);
    assert.equal(run("arrow"),null);
    assert.equal(run("panels.companion.dataset.lunge"),undefined);
    at(26.25);
    assert.match(run("sprites.companion.src"),/archer-release\.webp$/);
    assert.equal(run("arrow.event.targets[0]"),"chest");
    assert.equal(run("arrow.projectile===attackFlights.arrow"),true);
    at(216.24);
    assert.equal(run("arrowHit"),null);
    assert.equal(run("emotes.companion"),undefined);
    assert.equal(run("announcement.textContent"),"");
    at(216.25);
    assert.equal(run("arrow"),null);
    assert.equal(run("arrowHit.card"),card);
    assert.match(run("announcement.textContent"),/피해 2/);
    assert.match(run("emotes.companion.html"),/data-emphasis="critical"/);
  }
});

test("Unseal applies its guard break and damage cues on spell contact",()=>{
  const {run,at}=presentation({speed:4});
  run(`
    const shaman=companionTypes.shaman;
    game.companion={...fighter(shaman.name,shaman.health,shaman.vitality),kind:"shaman"};
    panels.companion.dataset.portrait="shaman";
    game.enemy.body.head.guard=2;
    globalThis.spell=null;
    globalThis.impactEvent=null;
    showAttackFlight=(_scene,event,projectile)=>spell={event,projectile,remove(){spell=null;}};
    const lookup=scene.querySelector.bind(scene);
    scene.querySelector=selector=>selector===".seal-flight"?spell:lookup(selector);
    showImpact=(_scene,event)=>impactEvent=event;
    applyCard("unseal",game.companion,game.enemy,["head"]);
    playCombatFeedback();
  `);
  at(26.24);
  assert.match(run("sprites.companion.src"),/shaman-attack\.png$/);
  assert.equal(run("spell"),null);
  at(26.25);
  assert.equal(run("spell.projectile===attackFlights.seal"),true);
  assert.equal(run("spell.event.targets[0]"),"head");
  at(266.24);
  assert.equal(run("impactEvent"),null);
  assert.equal(run("announcement.textContent"),"");
  at(266.25);
  assert.equal(run("spell"),null);
  assert.equal(run("impactEvent.removed"),2);
  assert.equal(run("impactEvent.dealt"),1);
  assert.match(run("announcement.textContent"),/피해 1 · 가드 −2/);
});

test("an activated reward skill highlights its lineup slot and announces its effect at 4× speed",()=>{
  const {run,at}=presentation({speed:4});
  run("game.cooldownBattle.traits.add('guard'); applyCard('cover',game.player,game.enemy,['arms','legs']);playCombatFeedback();");
  at(0);
  assert.match(run("announcement.textContent"),/보상 기술 · 퇴로 엄호 · 수녀 팔·다리 · 각 가드 \+5 · 간수 \+2/);
  assert.match(run("rewardSlot.label.innerHTML"),/^보상.*skill-activation-trait.*\+2/);
  assert.equal(run("strikeSlot.dataset.activation"),undefined);
  at(649);assert.equal(run("rewardSlot.dataset.activation"),"reward");
  at(650);assert.equal(run("rewardSlot.dataset.activation"),undefined);
  assert.equal(run("announcement.textContent"),"");
  assert.equal(run("combatPresentation"),null);
});

test("a class skill shows its emote over the caster for 400 ms at 4× speed",()=>{
  const {run,at}=presentation({speed:4});
  const cast="game.feedback=[{type:'guard',card:'escort',from:'companion',side:'player',targets:['head'],added:3,intent:null}];playCombatFeedback();";
  run(cast);
  at(0);
  assert.equal(run("escortSlot.dataset.activation"),"skill");
  assert.equal(run("escortSlot.label.innerHTML"),"발동");
  assert.match(run("emotes.companion.html"),/<img class="combat-skill-emote" src="art\/skills\/emotes\/escort\.webp"/);
  assert.equal(run("emotes.player"),undefined);
  assert.match(run("sprites.companion.src"),/guard-guard\.webp$/);
  assert.equal(run("sprites.player.src"),"player-idle.png");
  at(319);
  assert.match(run("sprites.companion.src"),/guard-guard\.webp$/);
  at(320);
  assert.equal(run("sprites.companion.src"),"companion-idle.png");
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

test("healers launch light before the 420 ms recovery effect at 4×",()=>{
  for(const [from,side,id,kind] of [["player","companion","prayer","nun"],["companion","player","mending","shaman"]]){
    const {run,at}=presentation({speed:4});
    run(`
      const shaman=companionTypes.shaman;
      game.companion={...fighter(shaman.name,shaman.health,shaman.vitality),kind:"shaman"};
      panels.companion.dataset.portrait="shaman";
      globalThis.healImpact=null;
      globalThis.healFlight=null;
      showHealingFlight=(_scene,event,origin)=>healFlight={event,origin};
      showImpact=(_scene,event)=>healImpact=event;
      game.feedback=[{type:"heal",card:"${id}",from:"${from}",side:"${side}",targets:["arms"],recovered:2,hp:10,intent:null}];
      playCombatFeedback();
    `);
    at(0);
    assert.equal(run(`sprites.${from}.src`),`art/characters/motion/${kind}-heal.webp`);
    assert.equal(run(`sprites.${side}.src`),`${side}-idle.png`);
    assert.equal(run("healFlight.event.from"),from);
    assert.equal(run(`healFlight.origin===healingOrigins.${kind}`),true);
    at(239);
    assert.equal(run("healImpact"),null);
    assert.equal(run("announcement.textContent"),"");
    at(240);
    assert.equal(run("healImpact.side"),side);
    assert.equal(run("healImpact.targets[0]"),"arms");
    assert.match(run("announcement.textContent"),/내구도 \+2/);
    at(659);
    assert.equal(run(`sprites.${from}.dataset.pose`),"heal");
    at(660);
    assert.equal(run(`sprites.${from}.src`),`${from}-idle.png`);
    assert.equal(run("combatPresentation"),null);
  }
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
  assert.doesNotMatch(stage(),/class="leg-travel"/);
  run("game.distance=2; renderScreen(); renderScreen(); game.distance=1; renderScreen();");
  assert.match(stage(),/사형수가 가까워졌어요.*도망 여유 1/s);
  assert.equal(run("game.testCues"),1);
  run("hit(game.enemy,game.player,'legs',4,{id:'heavy'},game); renderScreen();");
  assert.match(stage(),/다리 <small>부상<\/small>.*다음 이동 \+1/s);
  assert.match(run("woundChips(game.feedback[0].wounds,'player',game.feedback[0].legChange.before)"),/\+2 → \+1/);
  assert.match(stage(),/class="wound-durability"[^>]*>3\/7/);
  run("hit(game.enemy,game.player,'legs',1,{id:'strike'},game);");
  assert.equal(run("game.feedback.at(-1).wounds[0].hp"),2);
  run("hit(game.enemy,game.player,'legs',2,{id:'strike'},game); renderScreen();");
  assert.match(stage(),/다리 <small>결손<\/small>.*다음 이동 \+0/s);
  assert.match(stage(),/class="wound-chip lost"><span class="part-drawing-lost">.*part-loss-ink.*다리 <small>결손<\/small>.*class="wound-durability"[^>]*>0\/7/s);
  assert.equal(run("game.feedback.at(-1).injury"),"lost");
  run("hit(game.enemy,game.player,'legs',1,{id:'strike'},game);");
  assert.equal(run("game.feedback.length"),3);
  run("game.player.body.legs.hp=7; game.distance=4; renderScreen();");
  assert.doesNotMatch(stage(),/class="pursuit-warning"/);
  assert.doesNotMatch(stage(),/class="leg-travel"/);
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

test("the capture scene appears for a pursuit loss in combat or travel",()=>{
  const combat=engine();
  combat(`game.distance=1;
    for(let i=0;i<100 && game.phase==="combat";i++) advanceAutoBattle();
    renderScreen();`);
  assert.equal(combat("game.lossCause"),"pursuit");
  assert.match(combat("document.querySelector('#stage').innerHTML"),/class="room-scene capture-scene"/);

  const travel=engine();
  travel(`game.enemy.hp=0; finishCombat(); declineCompanion(); chooseReward(null);
    game.distance=0; game.player.body.legs.hp=0; moveTo("corridor"); renderScreen();`);
  assert.equal(travel("game.phase"),"lost");
  assert.equal(travel("game.lossCause"),"pursuit");
  assert.match(travel("document.querySelector('#stage').innerHTML"),/pursuer-capture\.webp/);

  const defeat=engine();
  defeat("game.player.hp=0; game.distance=0; finishCombat(); renderScreen();");
  assert.equal(defeat("game.lossCause"),"combat");
  assert.doesNotMatch(defeat("document.querySelector('#stage').innerHTML"),/capture-scene/);
});

test("a final blow shows the defeat frame for one real second at 4×",()=>{
  const {run,at}=presentation({speed:4});
  run(`game.feedback=${JSON.stringify([{...hit(),hp:0,critical:1,defeated:true}])};game.phase='reward';playCombatFeedback();`);
  at(0);assert.equal(run("panels.player.dataset.lunge"),"strong");
  assert.match(run("emotes.player.html"),/data-emphasis="finisher" style="--emote-duration:650ms"/);
  at(26.25);assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-defeat\.webp/);
  assert.match(run("announcement.textContent"),/치명타 \+1 · 격파/);
  assert.equal(run("scene.dataset.impact"),"finisher");
  at(649);assert.equal(run("Boolean(emotes.player)"),true);
  at(650);assert.equal(run("emotes.player"),undefined);
  at(1026.24);assert.match(run("sprites.enemy.style.backgroundImage"),/janitor-defeat\.webp/);
  assert.notEqual(run("combatPresentation"),null);
  at(1026.25);assert.equal(run("combatPresentation"),null);
  assert.equal(run("sprites.enemy.style.backgroundImage"),"");
});
