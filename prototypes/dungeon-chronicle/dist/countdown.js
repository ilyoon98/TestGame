// Rendering never restarts the single clock shared by both choice views.
export class AutoChoiceCountdown {
  constructor(now=()=>performance.now()){this.now=now;this.cancel();}
  start(key,target,duration=5000){this.key=key;this.target=target;this.duration=duration;this.remaining=duration;this.deadline=this.now()+duration;this.paused=false;}
  pause(){if(this.key===null||this.paused)return;this.remaining=this.snapshot().remaining;this.paused=true;}
  resume(){if(this.key===null||!this.paused)return;this.deadline=this.now()+this.remaining;this.paused=false;}
  retarget(target){if(this.key!==null)this.target=target;}
  snapshot(){const remaining=this.key===null?0:this.paused?this.remaining:Math.max(0,this.deadline-this.now());return {key:this.key,target:this.target,remaining,duration:this.duration,paused:this.paused,expired:this.key!==null&&!this.paused&&remaining<=0};}
  cancel(){this.key=null;this.target=null;this.duration=0;this.remaining=0;this.deadline=0;this.paused=false;}
}
