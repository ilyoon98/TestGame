import assert from "node:assert/strict";
import {test} from "node:test";
import {engine} from "./helpers/game-engine.mjs";

test("the starter deck and scripted opening stay unchanged",()=>{
  const run=engine();
  assert.equal(run("game.deck.length"),12);
  assert.equal(run("game.deck.some(id=>cards[id].reward || cards[id].owner)"),false);
  assert.equal(run("game.hand.join(',')"),"strike,heavy,guard,aim");
  assert.equal(run("game.draw[0]"),"strike");
});

test("victory offers three distinct cards, blocks travel, and accepts only one reward",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn();");
  assert.equal(run("game.phase"),"reward");
  const rewardDistance=run("game.distance");
  assert.equal(run("new Set(game.rewards).size"),3);
  assert.equal(run("game.rewards.every(id=>cards[id].reward)"),true);
  assert.equal(run("game.deck.length"),12);
  assert.equal(run("game.companion"),null);
  assert.equal(run("game.pendingCompanion"),"guard");
  assert.equal(run("recruitCompanion('guard')"),false);
  run("moveTo('duct'); endTurn();");
  assert.equal(run("game.area"),"threshold");
  assert.equal(run("game.distance"),rewardDistance);
  assert.equal(run("chooseReward('strike')"),false);
  run("globalThis.picked=game.rewards[0]; chooseReward(picked);");
  assert.equal(run("game.phase"),"route");
  assert.equal(run("game.deck.length"),13);
  assert.equal(run("game.acquired[0]===picked"),true);
  assert.equal(run("chooseReward(picked)"),false);
  assert.equal(run("game.distance"),rewardDistance);
});

test("rewards survive safe rooms and every battle reshuffle without duplicating companion cards",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn(); globalThis.picked=game.rewards[0]; chooseReward(picked); recruitCompanion('guard'); moveTo('corridor');");
  assert.equal(run("game.phase"),"route");
  assert.equal(run("game.deck.includes(picked)"),true);
  run("moveTo('landing');");
  assert.equal(run("game.hand.slice(0,2).join(',')"),"baton,escort");
  assert.equal(run("[...game.hand,...game.draw].filter(id=>id===picked).length"),1);
  assert.equal(run("[...game.hand,...game.draw].length"),15);
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); moveTo('lift');");
  assert.equal(run("[...game.hand,...game.draw].filter(id=>id===picked).length"),1);
  assert.equal(run("[...game.hand,...game.draw].filter(id=>cards[id].owner).length"),2);
  assert.equal(run("game.deck.length"),15);
});

test("skip leaves the deck intact and all three routes reach the exit without a final useless reward",()=>{
  for(const path of [["duct","lift","exit"],["infirmary","lift","exit"],["corridor","landing","lift","exit"]]){
    const run=engine();
    run("game.enemy.hp=0; settleTurn(); chooseReward(null);");
    assert.equal(run("game.deck.length"),12);
    assert.equal(run("game.acquired.length"),0);
    for(const room of path){
      run(`moveTo('${room}');`);
      if(run("game.phase==='combat'")){
        run("game.enemy.hp=0; settleTurn();");
        assert.equal(run("game.phase"),room==="lift"?"route":"reward");
        run("chooseReward(null);");
      }
    }
    assert.equal(run("game.phase"),"won");
  }
});

test("companion death removes only companion cards from the run deck and combat piles",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn(); chooseReward(game.rewards[0]); recruitCompanion('guard'); moveTo('duct');");
  run("hit(game.enemy,game.companion,'head',99,{id:'heavy'},game);");
  assert.equal(run("livingCompanion()"),null);
  assert.equal(run("['deck','hand','draw','discard'].every(pile=>game[pile].every(id=>!cards[id].owner))"),true);
  assert.equal(run("game.deck.length"),13);
  assert.equal(run("game.deck.includes(game.acquired[0])"),true);
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); moveTo('lift');");
  assert.equal(run("[...game.hand,...game.draw].some(id=>cards[id].owner)"),false);
});

test("new attack and defense effects respect body condition and chosen targets",()=>{
  const run=engine();
  run("game.enemy.body.head.guard=0; applyCard('force',game.player,game.enemy,['head']);");
  assert.equal(run("game.enemy.body.head.hp"),4);
  run("applyCard('shelter',game.player,game.enemy,['legs']);");
  assert.equal(run("game.player.body.legs.guard"),6);
  run("applyCard('cover',game.player,game.enemy,['head','eyes']);");
  assert.equal(run("game.player.body.head.guard"),3);
  assert.equal(run("game.player.body.eyes.guard"),3);
  run("game.player.body.arms.hp=3;");
  assert.equal(run("power(cards.crush,game.player)"),6);
  run("game.player.body.arms.hp=0;");
  assert.equal(run("cardBlocked('crush')"),"팔 결손");
});

test("piercing bypasses guard and new healing scales with the recipient's belly",()=>{
  const run=engine();
  run("game.enemy.body.head.guard=5; applyCard('pierce',game.player,game.enemy,['head']);");
  assert.equal(run("game.enemy.body.head.hp"),6);
  assert.equal(run("game.enemy.body.head.guard"),5);
  run("game.player.body.legs.hp=1; game.player.hp=10; applyCard('dressing',game.player,game.enemy,['legs']);");
  assert.equal(run("game.player.body.legs.hp"),5);
  assert.equal(run("game.player.hp"),14);
  run("game.player.body.belly.hp=3; game.player.body.legs.hp=1; applyCard('dressing',game.player,game.enemy,['legs']);");
  assert.equal(run("game.player.body.legs.hp"),3);
  assert.equal(run("healValue(game.player)"),1);
  run("game.player.body.belly.hp=0;");
  assert.equal(run("cardBlocked('dressing')"),"배 결손 · 회복 불가");
});

test("death grants no reward and restart clears the built deck and pending offers",()=>{
  const run=engine();
  run("game.player.hp=0; settleTurn();");
  assert.equal(run("game.phase"),"lost");
  assert.equal(run("game.rewards.length"),0);
  run("start(); game.enemy.hp=0; settleTurn(); chooseReward(game.rewards[0]); start();");
  assert.equal(run("game.deck.length"),12);
  assert.equal(run("game.acquired.length"),0);
  assert.equal(run("game.rewards.length"),0);
  assert.equal(run("game.companion"),null);
});

test("reward and deck screens render the real choices and survive a rerender",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn(); renderScreen();");
  assert.equal(run("(document.querySelector('#stage').innerHTML.match(/data-action=\"reward\"/g)||[]).length"),3);
  assert.equal(run("document.querySelector('#stage').innerHTML.includes('보상 건너뛰기')"),true);
  assert.equal(run("document.querySelector('#deck-summary').textContent.includes('12장')"),true);
  run("globalThis.offered=game.rewards.join(','); renderScreen();");
  assert.equal(run("game.rewards.join(',')===offered"),true);
  run("chooseReward(game.rewards[0]); renderScreen();");
  assert.equal(run("document.querySelector('#stage').innerHTML.includes('전체 경로')"),true);
  assert.equal(run("document.querySelector('#deck-list').innerHTML.includes(cards[game.acquired[0]].name)"),true);
});

test("keyboard selection and skip dispatch the same reward click flow",()=>{
  const run=engine();
  run(`
    game.enemy.hp=0; settleTurn();
    globalThis.picked=game.rewards[1];
    finishBoardAction=()=>{};
    globalThis.press=(key)=>document.querySelector('document').listeners.keydown({
      key,code:'Digit'+key,target:{closest:()=>null},preventDefault(){},
    });
    globalThis.rewardButton=(id)=>({click(){
      board.listeners.click({target:{closest:()=>({dataset:id===null?{action:'skip-reward'}:{action:'reward',value:id}})}});
    }});
    board.querySelectorAll=()=>game.rewards.map(id=>rewardButton(id));
    board.querySelector=()=>rewardButton(null);
    press('2');
  `);
  assert.equal(run("game.acquired[0]===picked"),true);
  assert.equal(run("game.phase"),"route");
  run("moveTo('duct'); game.enemy.hp=0; settleTurn(); press('0');");
  assert.equal(run("game.acquired.length"),1);
  assert.equal(run("game.phase"),"route");
});

test("the prayed-for prisoner is the pursuer and never an automatic companion",()=>{
  const run=engine();
  assert.equal(run("game.log.some(entry=>entry.includes('사형수가 뒤에서 쫓아와요'))"),true);
  assert.equal(run("gauges().includes('기도를 받았던 사형수가 뒤쫓는 중')"),true);
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); declineCompanion(); moveTo('duct');");
  assert.equal(run("game.companion"),null);
  assert.equal(run("game.deck.some(id=>cards[id].owner)"),false);
  run("game.distance=1; endTurn();");
  assert.equal(run("game.phase"),"lost");
  assert.equal(run("game.reason.includes('사형수에게 따라잡혔어요')"),true);
});

test("the guard is optional and an awakened inmate can replace them with a different deck",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn(); chooseReward(game.rewards[0]); globalThis.picked=game.acquired[0];");
  assert.equal(run("recruitCompanion('awakened')"),false);
  assert.equal(run("recruitCompanion('guard')"),true);
  assert.equal(run("recruitCompanion('guard')"),false);
  run("moveTo('infirmary');");
  assert.equal(run("game.hand.slice(0,2).join(',')"),"baton,escort");
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); renderScreen();");
  assert.equal(run("document.querySelector('#stage').innerHTML.includes('동료 교체')"),true);
  assert.equal(run("recruitCompanion('awakened')"),true);
  assert.equal(run("game.companion.name"),"개화한 수감자");
  assert.equal(run("game.deck.filter(id=>cards[id].owner).join(',')"),"irons,hook");
  assert.equal(run("game.deck.includes(picked)"),true);
  assert.equal(run("game.deck.length"),15);
  assert.equal(run("companionPanel([], 'healthy').includes('개화한 수감자')"),true);
  run("moveTo('lift');");
  assert.equal(run("game.hand.slice(0,2).join(',')"),"irons,hook");
  assert.equal(run("cardBlocked('baton')"),"현재 동료의 카드가 아님");
});

test("solo travel and keeping a current companion are both valid encounter choices",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); moveTo('infirmary');");
  assert.equal(run("game.companion"),null);
  assert.equal(run("game.pendingCompanion"),null);
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); recruitCompanion('awakened'); moveTo('lift');");
  assert.equal(run("game.hand.slice(0,2).join(',')"),"irons,hook");

  run("start(); game.enemy.hp=0; settleTurn(); chooseReward(null); recruitCompanion('guard'); moveTo('infirmary'); game.enemy.hp=0; settleTurn(); chooseReward(null); declineCompanion(); moveTo('lift');");
  assert.equal(run("game.companion.kind"),"guard");
  assert.equal(run("game.deck.some(id=>cards[id].companion==='awakened')"),false);
});

test("a dead companion stays dead while a different survivor can join",()=>{
  const run=engine();
  run("game.enemy.hp=0; settleTurn(); chooseReward(null); recruitCompanion('guard'); moveTo('infirmary'); hit(game.enemy,game.companion,'head',99,{id:'heavy'},game); game.enemy.hp=0; settleTurn(); chooseReward(null);");
  assert.equal(run("game.deadCompanions.includes('guard')"),true);
  assert.equal(run("recruitCompanion('awakened')"),true);
  assert.equal(run("game.deck.filter(id=>cards[id].owner).length"),2);
  run("game.pendingCompanion='guard';");
  assert.equal(run("recruitCompanion('guard')"),false);
  assert.equal(run("game.companion.kind"),"awakened");
  run("start();");
  assert.equal(run("game.deadCompanions.length"),0);
  assert.equal(run("game.pendingCompanion"),null);
});
