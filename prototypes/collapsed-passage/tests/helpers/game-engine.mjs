import {readFileSync} from "node:fs";
import vm from "node:vm";

const html=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\nstart\(\);\s*$/, "");
const compiled=new vm.Script(source);

export function engine(seed=12345,{prep=false}={}){
  const elements=new Map(), timers=new Map();
  let timerId=0, randomSeed=seed;
  const math=Object.create(Math);
  math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  function element(selector){
    if(!elements.has(selector)) elements.set(selector,{
      innerHTML:"",listeners:{},addEventListener(type,listener){this.listeners[type]=listener;},
      setAttribute(name,value){this[name]=value;},
      querySelector(child){return child==='.map-layout'?element(child):null;},querySelectorAll(){return [];},
      getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},
    });
    return elements.get(selector);
  }
  const context=vm.createContext({
    document:{hidden:false,querySelector:element,addEventListener(type,listener){element('document').listeners[type]=listener;}},
    ResizeObserver:class {observe(){} disconnect(){}},
    structuredClone,matchMedia:()=>({matches:true}),window:{},Math:math,
    setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},
    clearTimeout(id){timers.delete(id);},
  });
  compiled.runInContext(context);
  vm.runInContext("globalThis.renderScreen=render; render=()=>{}; start();",context);
  if(!prep) vm.runInContext("beginCombat();",context);
  const run=code=>vm.runInContext(code,context);
  run.timers=timers;
  run.tick=()=>{
    const item=timers.entries().next().value;
    if(!item) return false;
    timers.delete(item[0]);item[1].callback();return true;
  };
  return run;
}
