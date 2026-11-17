import { Fantasy, DUNGEONS } from '../dist/world.js';
import { Dungeon } from '../dist/engine.js';

// A fresh random character, two potions, one trip. No retries or town grinding.
// push skips optional risks but always fights the boss; reckless opens the chest;
// cautious exits at half health before the next encounter can be rolled.
export function trip(seed,id,{prepared=false,policy='push'}={}){
  const g=Fantasy.restore(new Dungeon(seed).s);g.start();g.s.queue=[];
  if(prepared){g.character.power+=12;g.character.scout+=5;g.s.potions+=2;}
  g.enterDungeon(id);let steps=0;
  while(g.world.mode==='dungeon'&&g.s.status!=='ended'&&steps++<500){
    if(policy==='cautious'&&!g.world.exitPending&&!g.s.queue.length&&g.s.hp<g.character.maxHp*.5&&g.canChangePath()){
      g.requestChange();g.choose('leave');
    }else if(g.s.status==='choice'){
      const ch=g.s.choice;
      g.choose(ch.kind==='boss'?(policy==='cautious'?'return':'fight'):ch.kind==='chest'&&policy==='reckless'?'open':ch.options.find(o=>o.id==='skip')?.id||g.autoChoice());
    }else g.step();
  }
  if(steps>=500)throw new Error(`Trip did not terminate: ${seed}/${id}`);
  return {game:g,outcome:g.s.outcome?.type==='death'?'death':g.world.cleared.includes(id)?'clear':'return'};
}
export function sample(id,options={},count=2000,start=1){
  const results={clear:0,death:0,return:0,automaticDeath:0,disasterDeath:0};
  for(let seed=start;seed<start+count;seed++){
    const {game:g,outcome}=trip(seed,id,options);results[outcome]++;
    if(outcome==='death'){
      if(!g.s.outcome.cause.includes(g.dungeon().boss)&&!g.s.outcome.cause.includes('봉인'))results.automaticDeath++;
      if(g.s.outcome.cause.includes('천장'))results.disasterDeath++;
    }
  }
  return results;
}
if(process.argv.includes('--report'))for(const d of DUNGEONS)for(const scenario of [{policy:'push'},{policy:'reckless'},{policy:'cautious'},{policy:'push',prepared:true}])console.log(d.id,scenario,sample(d.id,scenario));
