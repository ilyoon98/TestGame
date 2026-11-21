import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("seeded maps reproduce exact room counts and connect each stage without crossings",()=>{
  const run=engine();
  const config={seed:"passage",widths:[3,1,2,3],shops:2,rests:2,elites:1,mysteries:1};
  const mapOf=options=>JSON.parse(run(`JSON.stringify(generateMap(${JSON.stringify(options)}))`));
  const first=mapOf(config);
  assert.deepEqual(mapOf(config),first);
  assert.notDeepEqual(mapOf({...config,seed:"other"}),first);

  for(let seed=0;seed<40;seed++){
    const map=mapOf({...config,seed:String(seed)});
    const rooms=Object.entries(map);
    const counts=Object.groupBy(rooms.slice(1,-2),([,room])=>room.type);
    assert.equal(counts.shop.length,2);
    assert.equal(counts.rest.length,2);
    assert.equal(counts.elite.length,1);
    assert.equal(counts.battle.length,3);
    assert.equal(counts.mystery.length,1);
    assert.ok(counts.elite.every(([,room])=>room.col>2));
    assert.ok(["cache","drain"].includes(counts.mystery[0][1].event));
    assert.equal(map.lift.type,"boss");
    assert.deepEqual(map.lift.next,["exit"]);
    assert.deepEqual(config.widths.map((_,stage)=>rooms.filter(([,room])=>room.col===stage+2).length),config.widths);

    const incoming=new Set();
    const edges=rooms.flatMap(([id,room])=>{
      if(id!=="exit") assert.ok(room.next.length);
      return room.next.map(destination=>{
        incoming.add(destination);
        assert.equal(map[destination].col,room.col+1);
        return [room,map[destination]];
      });
    });
    assert.equal(incoming.size,rooms.length-1);
    for(const [from,to] of edges){
      assert.ok(!edges.some(([otherFrom,otherTo])=>from.col===otherFrom.col && from.row<otherFrom.row && to.row>otherTo.row));
      if(["shop","rest","elite","mystery"].includes(from.type)) assert.notEqual(from.type,to.type);
    }
  }
});

test("dense maps relax only unavoidable room rules and keep seeded links independent of the inventory",()=>{
  const run=engine();
  run(`const config={seed:"dense",widths:[2,2,2],shops:0,rests:0,elites:5};
    const dense=generateMap(config), sparse=generateMap({...config,elites:0});
    globalThis.denseRooms=Object.values(dense).filter(room=>room.type==="elite");
    globalThis.repeated=denseRooms.flatMap(room=>room.next).filter(id=>dense[id].type==="elite").length;`);
  assert.equal(run("denseRooms.length"),5);
  assert.equal(run("denseRooms.filter(room=>room.col===2).length"),1);
  assert.equal(run("JSON.stringify(Object.values(dense).map(room=>room.next))===JSON.stringify(Object.values(sparse).map(room=>room.next))"),true);
  assert.equal(run("repeated"),run(`Math.min(...Object.entries(dense).filter(([,room])=>room.col===2).map(([plain])=>
    Object.entries(dense).filter(([id,room])=>id.startsWith("room-") && id!==plain)
      .flatMap(([,room])=>room.next).filter(id=>id.startsWith("room-") && id!==plain).length))`));
});

test("seeded rooms use the normal route actions and restart reproduces the map",()=>{
  const run=engine();
  run("start({seed:'market',widths:[3],shops:1,rests:1,elites:1}); beginCombat();");
  const layout=run("JSON.stringify(areas)");
  run("game.enemy.hp=0; finishCombat(); declineCompanion(); chooseReward(null); moveTo(areas.threshold.next.find(id=>areas[id].type==='shop'));");
  assert.match(run("mapPanel()"),/data-room-type="shop"/);
  assert.equal(run("game.coins"),1);
  const distance=run("game.distance");
  assert.equal(run("buyShopOffer('shortcut')"),true);
  assert.equal(run("buyShopOffer('shortcut')"),false);
  assert.equal(run("game.coins"),0);
  assert.equal(run("game.distance"),distance+2);
  run("moveTo('lift');");
  assert.equal(run("game.phase"),"prep");
  run("beginCombat();");
  run("game.enemy.hp=0; finishCombat(); moveTo('exit');");
  assert.equal(run("game.phase"),"won");

  run("start(); beginCombat();");
  assert.equal(run("JSON.stringify(areas)"),layout);
  run("game.enemy.hp=0; finishCombat(); declineCompanion(); chooseReward(null); moveTo(areas.threshold.next.find(id=>areas[id].type==='rest')); game.player.body.legs.hp=3;");
  assert.equal(run("treatAtStairs('legs')"),true);
  assert.equal(run("treatAtStairs('legs')"),false);
  run("start(null);");
  assert.equal(run("areas===standardAreas"),true);
});

test("market stock heals the selected target and consumes supplies once",()=>{
  const run=engine();
  run(`start({seed:"market-stock",widths:[2,2],shops:2,rests:0,elites:0,mysteries:1});
    const shops=Object.keys(areas).filter(id=>areas[id].type==="shop");
    enterArea(shops[0]); game.coins=8;
    game.player.hp=20; game.player.body.legs.hp=3; game.player.body.arms.hp=0;`);
  assert.equal((run("shopPanel()").match(/class="shop-item"/g)||[]).length,5);
  assert.match(run("shopPanel()"),/다리 3 → 6\/7/);
  assert.match(run("shopPanel()"),/수녀 · 20 → 26\/28/);
  assert.equal(run("buyShopOffer('bandage','player:arms')"),false);
  assert.equal(run("buyShopOffer('bandage','player:legs')"),true);
  assert.equal(run("game.player.body.legs.hp"),6);
  assert.match(run("shopPanel()"),/id="shop-result-bandage"[^>]*>수녀 다리 내구도 \+3/);
  assert.equal(run("buyShopOffer('bandage','player:legs')"),false);
  assert.equal(run("buyShopOffer('tonic','player')"),true);
  assert.equal(run("game.player.hp"),28);
  assert.equal(run("game.player.body.arms.hp"),0);
  assert.equal(run("buyShopOffer('oil') && buyShopOffer('lockpicks')"),true);
  assert.equal(run("game.coins"),2);
  run("enterArea(shops[1]);");
  assert.equal(run("buyShopOffer('oil') || buyShopOffer('lockpicks')"),false);
  assert.equal(run("buyShopOffer('shortcut')"),true);
  run("game.pendingMystery='cache'; game.distance=1;");
  assert.match(run("mysteryPanel()"),/<dt>자물쇠 따개<\/dt><dd>사용<\/dd>/);
  assert.match(run("mysteryPanel()"),/<dt>동전<\/dt><dd data-change="gain">1 → 3<\/dd>/);
  assert.equal(run("resolveMystery('skip')"),true);
  assert.equal(run("game.lockpicks"),true);
  run("game.pendingMystery='cache';");
  assert.equal(run("resolveMystery('take')"),true);
  assert.equal(run("game.distance"),1);
  assert.equal(run("game.lockpicks"),false);
  assert.equal(run("game.coins"),3);
  assert.match(run("routePanel()"),/id="mystery-result"[^>]*><b>잠긴 물자함<\/b><span>자물쇠 따개 사용 · 동전 \+2<\/span>/);
  assert.equal(run("buyShopOffer('invalid')"),false);
  run("enterArea('lift');");
  assert.equal(run("buyShopOffer('shortcut')"),false);
  assert.equal(run("beginCombat()"),true);
  assert.equal(run("game.player.body.chest.guard"),3);
  assert.equal(run("game.lanternOil"),false);
  run("enterArea('lift'); beginCombat();");
  assert.equal(run("game.player.body.chest.guard"),0);
});

test("the companion choice gates the map until accepted or declined",()=>{
  for(const accept of [false,true]){
    const run=engine();
    const stage=()=>run("renderScreen(); document.querySelector('#stage').innerHTML");
    run("game.enemy.hp=0; finishCombat();");
    assert.match(stage(),/data-action="recruit".*data-action="decline-companion"/s);
    assert.doesNotMatch(stage(),/class="route-map"/);
    run("moveTo('duct');");
    assert.equal(run("game.area"),"threshold");
    assert.equal(run(accept?"recruitCompanion('guard')":"declineCompanion()"),true);
    assert.match(stage(),/data-action="reward"/);
    run("chooseReward(null);");
    assert.match(stage(),/class="route-map"/);
    assert.equal(run("game.companion?.kind ?? null"),accept?"guard":null);
  }
});

test("the minimap previews the current route during recruitment without providing move actions",()=>{
  const run=engine();
  run("game.enemy.hp=0; finishCombat();");
  const preview=()=>run("mapPanel({preview:true})");
  assert.match(preview(),/<div class="map-node current" data-room="threshold"[^>]*aria-current="location"/);
  assert.match(preview(),/<div class="map-node next" data-room="duct"[^>]*다음 방/);
  assert.doesNotMatch(preview(),/data-action="move"/);
  assert.equal(run("canMoveTo('duct')"),false);
  run("declineCompanion(); chooseReward(null); moveTo('duct');");
  assert.match(preview(),/class="map-node current" data-room="duct"/);
  assert.match(preview(),/class="walked" data-edge="threshold-duct"/);
});

test("a seeded mystery hides the map until its outcome is chosen once",()=>{
  const run=engine();
  const enter=()=>run(`start({seed:'passage',widths:[1],shops:0,rests:0,elites:0,mysteries:1});
    beginCombat(); game.enemy.hp=0; finishCombat(); declineCompanion(); chooseReward(null);
    moveTo(areas.threshold.next[0]);`);
  const stage=()=>run("renderScreen(); document.querySelector('#stage').innerHTML");
  enter();
  const event=run("game.pendingMystery");
  const room=run("game.area");
  assert.match(stage(),/class="room-decision mystery-room"/);
  assert.doesNotMatch(stage(),/class="route-map"/);
  run("moveTo('lift');");
  assert.equal(run("game.area"),room);
  const result=run("game.distance+mysteryEvents[game.pendingMystery].distance");
  assert.equal(run("resolveMystery('take')"),true);
  assert.equal(run("game.distance"),result);
  assert.equal(run("resolveMystery('take')"),false);
  assert.match(stage(),/class="route-map"/);
  assert.match(stage(),/id="mystery-result"/);

  enter();
  assert.equal(run("game.pendingMystery"),event);
  run("game.distance=1; game.coins=0;");
  assert.match(stage(),/data-value="take" disabled/);
  assert.match(stage(),/id="mystery-detail">(?:도망 여유|동전) 부족/);
  assert.equal(run("resolveMystery('take')"),false);
  assert.equal(run("resolveMystery('skip')"),true);
  assert.equal(run("game.distance"),1);
  assert.equal(run("game.coins"),0);
  assert.match(stage(),/class="route-map"/);
  assert.doesNotMatch(stage(),/id="mystery-result"/);
});

test("enemy intents show icon and number while HP renders below each portrait",()=>{
  const run=engine();
  const visible=run("intentPanel(battleIntent(),'healthy')");
  assert.match(visible,/<strong>5<\/strong>/);
  assert.match(visible,/class="intent-target player"><svg/);
  assert.doesNotMatch(visible.replace(/<[^>]*>/g,""),/적 행동 예고|다리|강타/);
  const hidden=run("intentPanel(battleIntent(),'injured')");
  assert.match(hidden,/<strong>\?<\/strong>/);
  assert.doesNotMatch(hidden,/data-intent=/);
  const player=run("bodyPanel('player',battleIntent(),'healthy')");
  assert.match(player,/class="actor-figure".*class="foe-health".*class="hp-value"[^>]*>28\/28/s);
  assert.doesNotMatch(run("gauges()"),/class="status-box health/);
});

test("the training seed determines the rooms and fighting preserves the roster and loadouts",()=>{
  const run=engine();
  run("globalThis.config={seed:'V5-01',widths:[1,1,1,1],training:true}; start(config);");
  const original=run("JSON.stringify(areas)");
  run("start({ ...config, seed:'V5-02' });");
  assert.notEqual(run("JSON.stringify(areas)"),original);
  run("start(config);");
  assert.equal(run("JSON.stringify(areas)"),original);
  assert.equal(run("livingRoster().length"),5);
  assert.equal(run("setTrainingSkill('companion3',0,'snapShot')"),true);
  assert.equal(run("game.companion3.loadout.join(',')"),"snapShot,aimedShot");
  assert.equal(run("setTrainingSkill('companion3',0,'prayer')"),false);
  assert.equal(run("setTrainingReserve('companion4')"),true);
  assert.equal(run("placePartyMember('companion4',1)"),true);
  run("beginCombat(); hit(game.player,game.enemy,'head',99,{id:'heavy'},game);");
  assert.equal(run("game.feedback.at(-1).defeated"),false);
  assert.equal(run("game.enemy.hp===game.enemy.maxHp"),true);
  run("while(game.phase==='combat' && game.cooldownBattle.elapsed<4000) advanceAutoBattle();");
  assert.equal(run("game.phase"),"combat");
  assert.equal(run("game.distance"),5);
  assert.match(run("actorHealth(game.enemy)"),/무한 체력[^>]*>∞/);
  run("hit(game.enemy,game.companion4,'head',99,{id:'heavy'},game); openTrainingView('route'); moveTo('room-4-2');");
  assert.equal(run("game.phase"),"prep");
  assert.equal(run("game.area"),"room-4-2");
  assert.equal(run("partySides().map(side=>game[side].kind).join(',')"),"nun,shaman,archer");
  assert.equal(run("game.companion3.loadout.join(',')"),"snapShot,aimedShot");
});

test("the enemy damage multiplier affects only training attacks and their forecasts",()=>{
  const run=engine();
  run("game.trainingEnemyDamage=5; applyCard('heavy',game.enemy,game.player,['legs']);");
  assert.equal(run("game.feedback.at(-1).dealt"),5);
  assert.match(run("intentPanel(battleIntent(),'healthy')"),/<strong>5<\/strong>/);
  run("start({seed:'V5-01',widths:[1],training:true}); game.trainingEnemyDamage=5; beginCombat();");
  assert.match(run("intentPanel(battleIntent(),'healthy')"),/<strong>25<\/strong>/);
  assert.match(run("intentLabel({id:'aim',targets:['arms']})"),/피해 10 · 가드 2 무시/);
  run("applyCard('strike',game.player,game.enemy,['chest']);");
  assert.equal(run("game.feedback.at(-1).dealt"),2);
  run("game.player.body.legs.guard=3; applyCard('heavy',game.enemy,game.player,['legs']);");
  assert.equal(run("game.feedback.at(-1).blocked"),3);
  assert.equal(run("game.feedback.at(-1).injury"),"lost");
});

test("the training injury editor bypasses guard and restores selected parts at exact durability",()=>{
  const run=engine();
  assert.equal(run("setTrainingInjury('player','arms','lost')"),false);
  run("start({seed:'V5-01',widths:[1],training:true}); game.trainingEnemyDamage=5; beginCombat(); playCombatFeedback=()=>{};");
  run("game.player.body.arms.guard=99;");
  assert.equal(run("setTrainingInjury('player','arms','injured')"),true);
  assert.equal(run("game.player.body.arms.hp"),3);
  assert.equal(run("game.feedback.at(-1).blocked"),0);
  assert.equal(run("setTrainingInjury('player','arms','lost')"),true);
  assert.equal(run("game.player.body.arms.hp"),0);
  assert.equal(run("skillBlocked({id:'heavy',side:'player'})"),"팔 결손");
  assert.equal(run("setTrainingInjury('player','arms','healthy')"),true);
  assert.equal(run("game.player.body.arms.hp"),7);
  assert.equal(run("skillBlocked({id:'heavy',side:'player'})"),"");
  assert.equal(run("setTrainingInjury('companion3','legs','lost')"),true);
  assert.equal(run("game.companion3.body.legs.hp"),0);
  assert.equal(run("setTrainingInjury('player','head','lost')"),true);
  assert.equal(run("game.phase"),"lost");
  run("openTrainingView('prep');");
  assert.equal(run("game.player.body.head.hp"),9);
  assert.equal(run("game.trainingEnemyDamage"),5);
});
