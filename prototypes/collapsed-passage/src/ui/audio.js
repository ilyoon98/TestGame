"use strict";
// 전투 효과음.
// - WebAudioSynth: 소리 재료(음, 잡음)를 만든다.
// - CombatAudio: 언제 어떤 소리를 낼지 정하고, 오디오 장치와 켜고 끈 상태를 가진다.
// Godot의 bake-combat-audio.mjs와 테스트가 전역 tone·collisionNoise를 바꿔 끼워 소리 설계를 기록하므로,
// CombatAudio는 합성기를 전역 이름으로 부른다.

class WebAudioSynth {
  #noiseBuffers=new WeakMap();

  tone(ctx, output, at, duration, level, startPitch, endPitch, wave){
    const oscillator=ctx.createOscillator();
    const gain=ctx.createGain();
    oscillator.type=wave;
    oscillator.frequency.setValueAtTime(startPitch,at);
    oscillator.frequency.exponentialRampToValueAtTime(endPitch,at+duration);
    gain.gain.setValueAtTime(level,at);
    gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at+duration);
  }

  noise(ctx, output, at, duration, level, filterType, cutoff){
    if(!this.#noiseBuffers.has(ctx)){
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.24),ctx.sampleRate);
      const samples=buffer.getChannelData(0);
      const random=crypto.getRandomValues(new Uint16Array(samples.length));
      for(let i=0;i<samples.length;i++) samples[i]=random[i]/32767.5-1;
      this.#noiseBuffers.set(ctx,buffer);
    }
    const source=ctx.createBufferSource();
    const filter=ctx.createBiquadFilter();
    const gain=ctx.createGain();
    source.buffer=this.#noiseBuffers.get(ctx);
    filter.type=filterType;
    filter.frequency.value=cutoff;
    gain.gain.setValueAtTime(level,at);
    gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    source.connect(filter).connect(gain).connect(output);
    source.start(at);
    source.stop(at+duration);
  }
}

class CombatAudio {
  context=undefined;
  output=undefined;
  enabled=true;
  #synth;

  // synth: {tone(...), noise(...)}
  constructor(synth){ this.#synth=synth; }

  get #ready(){ return this.enabled && this.context?.state==="running"; }

  // 브라우저는 사용자 입력 뒤에만 소리를 낼 수 있어서 첫 클릭에서 장치를 연다.
  unlock(){
    if(!this.enabled) return;
    const Audio=window.AudioContext || window.webkitAudioContext;
    if(!Audio) return;
    if(!this.context){
      this.context=new Audio();
      this.output=this.context.createGain();
      this.output.gain.value=.5;
      this.output.connect(this.context.destination);
    }
    if(this.context.state==="suspended") this.context.resume().catch(()=>{});
  }

  toggle(){
    this.enabled=!this.enabled;
    const button=document.querySelector("#sound");
    button.setAttribute("aria-pressed",String(this.enabled));
    button.textContent=this.enabled?"효과음 켬":"효과음 끔";
    if(this.output) this.output.gain.value=this.enabled ? .5 : 0;
    this.unlock();
  }

  // 가드에 막히면 금속음, 피해가 들어가면 둔탁한 소리, 치명타·격파는 낮은 울림을 겹친다.
  impact(ctx,output,event){
    const {tone,noise}=this.#synth;
    const at=ctx.currentTime+.006;
    const metallic=event.blocked || event.removed;
    if(metallic){
      tone(ctx,output,at,.18,.2,1460,1410,"triangle");
      tone(ctx,output,at,.13,.13,2170,2230,"sine");
      tone(ctx,output,at,.077,.09,3120,3040,"sine");
      noise(ctx,output,at,.07,.27,"highpass",1800);
    }
    if(event.dealt){
      const thudAt=at+(metallic ? .043 : 0);
      tone(ctx,output,thudAt,.16,.42,130,51,"sine");
      noise(ctx,output,thudAt,.1,.39,"lowpass",580);
    }
    if(event.defeated || event.critical){
      const [startPitch,endPitch]=event.defeated?[82,36]:[290,162];
      tone(ctx,output,at,.25,.28,startPitch,endPitch,"triangle");
    }
  }

  bell(){
    if(!this.#ready) return;
    const {tone}=this.#synth, ctx=this.context, out=this.output;
    const at=ctx.currentTime+.008;
    tone(ctx,out,at,.36,.19,880,878,"sine");
    tone(ctx,out,at,.19,.09,1766,1750,"triangle");
    tone(ctx,out,at,.10,.045,2370,2340,"sine");
  }

  healing(){
    if(!this.#ready) return;
    const {tone}=this.#synth, ctx=this.context, out=this.output;
    const at=ctx.currentTime+.008;
    tone(ctx,out,at,.19,.12,523,587,"sine");
    tone(ctx,out,at+.08,.23,.105,659,784,"sine");
  }

  pursuit(){
    if(!this.#ready) return;
    const {tone,noise}=this.#synth, ctx=this.context, out=this.output;
    const at=ctx.currentTime+.01;
    noise(ctx,out,at,.22,.17,"bandpass",850);
    noise(ctx,out,at+.16,.17,.13,"bandpass",1180);
    tone(ctx,out,at+.035,.24,.1,760,680,"triangle");
    tone(ctx,out,at+.17,.18,.08,1220,1120,"sine");
  }
}

const webAudioSynth=new WebAudioSynth();
const combatAudio=new CombatAudio({
  tone:(...args)=>tone(...args),
  noise:(...args)=>collisionNoise(...args)
});
// 예전 전역 이름. 값은 combatAudio가 가진다.
Object.defineProperty(globalThis,"audioContext",{get:()=>combatAudio.context,set:value=>{combatAudio.context=value;},configurable:true});
Object.defineProperty(globalThis,"audioOutput",{get:()=>combatAudio.output,set:value=>{combatAudio.output=value;},configurable:true});
Object.defineProperty(globalThis,"soundEnabled",{get:()=>combatAudio.enabled,set:value=>{combatAudio.enabled=value;},configurable:true});

function unlockCombatAudio(){ combatAudio.unlock(); }
function toggleCombatAudio(){ combatAudio.toggle(); }
function tone(...args){ webAudioSynth.tone(...args); }
function collisionNoise(...args){ webAudioSynth.noise(...args); }
function synthesizeImpact(ctx,output,event){ combatAudio.impact(ctx,output,event); }
function playBellboyBell(){ combatAudio.bell(); }
function playHealingSound(){ combatAudio.healing(); }
function playPursuitSound(){ combatAudio.pursuit(); }
