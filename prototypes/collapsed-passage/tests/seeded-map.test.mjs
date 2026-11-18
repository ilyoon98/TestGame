import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("seeded maps reproduce exact room counts and connect each stage without crossings",()=>{
  const run=engine();
  const config={seed:"passage",widths:[3,1,2,3],shops:2,rests:2,elites:1};
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
    assert.equal(counts.battle.length,4);
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
    }
  }
});

test("seeded rooms use the normal route actions and restart reproduces the map",()=>{
  const run=engine();
  run("start({seed:'market',widths:[3],shops:1,rests:1,elites:1});");
  const layout=run("JSON.stringify(areas)");
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); moveTo(areas.threshold.next.find(id=>areas[id].type==='shop'));");
  assert.match(run("mapPanel()"),/data-room-type="shop"/);
  assert.equal(run("game.coins"),1);
  const distance=run("game.distance");
  run("buyShortcut(); buyShortcut();");
  assert.equal(run("game.coins"),0);
  assert.equal(run("game.distance"),distance+2);
  run("moveTo('lift');");
  assert.equal(run("game.phase"),"combat");
  run("game.enemy.hp=0; settleTurn(); moveTo('exit');");
  assert.equal(run("game.phase"),"won");

  run("start();");
  assert.equal(run("JSON.stringify(areas)"),layout);
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); moveTo(areas.threshold.next.find(id=>areas[id].type==='rest')); game.player.body.legs.hp=3;");
  assert.equal(run("treatAtStairs('legs')"),true);
  assert.equal(run("treatAtStairs('legs')"),false);
  run("start(null);");
  assert.equal(run("areas===standardAreas"),true);
});

test("enemy intents show icon and number while HP renders below each portrait",()=>{
  const run=engine();
  const visible=run("game.plan=[{id:'heavy',side:'player',targets:['legs']}]; intentPanel(battleIntent(),'healthy')");
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
