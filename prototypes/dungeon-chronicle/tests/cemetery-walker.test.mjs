import test from 'node:test';
import assert from 'node:assert/strict';
import { CemeteryWalker, nearbyGrave, memorialStory } from '../dist/cemetery-walker.js';
test('the traveler walks toward a grave and stops at its exact position',()=>{
  const w=new CemeteryWalker(2000);w.walkTo(409);for(let i=0;i<100;i++)w.step(.016);assert.equal(w.x,409);assert.equal(w.target,null);w.step(.016);assert.equal(w.moving,false);
});
test('holding either direction walks, turns and respects both map boundaries',()=>{
  const w=new CemeteryWalker(500);w.hold(-1);for(let i=0;i<300;i++)w.step(.02);assert.equal(w.x,70);assert.equal(w.facing,-1);w.hold(1);for(let i=0;i<300;i++)w.step(.02);assert.equal(w.x,430);assert.equal(w.facing,1);w.setWidth(250);assert.equal(w.x,180);
});
test('lost focus stops a held walk and a delayed frame cannot teleport the traveler',()=>{
  const w=new CemeteryWalker(2000),start=w.x;w.hold(1);w.step(60);assert.ok(w.x-start<=w.speed*.05);w.stop();const x=w.x;w.step(.05);assert.equal(w.x,x);assert.equal(w.moving,false);
});
test('only the nearest grave in reach can show its story',()=>{
  const a={x:320,memorial:{id:'a'}},b={x:530,memorial:{id:'b'}};assert.equal(nearbyGrave([a,b],220),null);assert.equal(nearbyGrave([a,b],409),a);assert.equal(nearbyGrave([a,b],619),b);assert.equal(nearbyGrave([],409),null);assert.equal(nearbyGrave([a,b],514),null);
});
test('the life summary uses the approached persons actual stored life',()=>{
  const m={character:{name:'에린',race:'elf',job:'mage'},family:{place:'성벽 밖 마을',parents:[{name:'헤나'},{name:'로안'}]},careers:['inn'],career:'inn',stats:{trips:3},honors:[],outcome:{ageYears:73,cause:'노환으로 생을 마쳤습니다.',floor:4}};
  const text=memorialStory(m,{log:[{text:'선택: 피난민을 돌본다.'},{text:'전쟁이 끝나고 이웃들이 돌아왔습니다.'}]});assert.match(text,/헤나·로안/);assert.match(text,/여관주인/);assert.match(text,/전쟁이 끝나고/);assert.match(text,/73세/);assert.doesNotMatch(text,/선택:/);
});
