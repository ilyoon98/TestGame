import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../src/presentation/hit-fx.js",import.meta.url),"utf8");
const context={};
context.globalThis=context;
vm.runInNewContext(source,context);
const fx=context.CPHitFx;
const hit=extra=>({type:"hit",side:"enemy",from:"player",targets:["arms"],dealt:3,...extra});

test("hit tiers follow loss, injury, critical, then normal",()=>{
  assert.equal(fx.tierOf(hit({injury:"lost",critical:true})),"loss");
  assert.equal(fx.tierOf(hit({injury:"injured"})),"injury");
  assert.equal(fx.tierOf(hit({critical:true})),"crit");
  assert.equal(fx.tierOf(hit()),"normal");
  assert.equal(fx.tierOf(hit({dealt:0,injury:"lost"})),null);
  assert.equal(fx.tierOf({type:"heal",recovered:2,targets:["arms"]}),null);
});

test("only critical, injury and loss hits hold the battle presentation",()=>{
  const {tiers,injury,loss}=fx.CONFIG;
  assert.equal(fx.holdFor(hit()),0);
  assert.equal(fx.holdFor(hit({critical:true})),tiers.crit.hitStop);
  assert.equal(fx.holdFor(hit({injury:"injured"})),tiers.injury.hitStop+injury.cutinMs);
  assert.equal(fx.holdFor(hit({injury:"lost"})),tiers.loss.hitStop+loss.sceneMs+loss.afterMs);
});

test("cut-ins shorten by the square root of battle speed and skip a defeat",()=>{
  const {tiers,injury,loss}=fx.CONFIG;
  assert.equal(fx.holdFor(hit({injury:"injured"}),{speed:4}),tiers.injury.hitStop+injury.cutinMs/2);
  assert.equal(fx.holdFor(hit({injury:"lost"}),{speed:4}),tiers.loss.hitStop+loss.sceneMs/2+loss.afterMs);
  assert.equal(fx.holdFor(hit({injury:"lost",defeated:true})),tiers.loss.hitStop);
});
