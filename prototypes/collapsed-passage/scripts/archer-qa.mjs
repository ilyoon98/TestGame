import {parseArgs} from "node:util";
import {engine} from "../tests/helpers/game-engine.mjs";

const {values}=parseArgs({options:{trace:{type:"boolean"}}});
const seed="archer-guard-qa";
const windowMs=21000;
const builds=[
  {policy:"rear-single-v1",rank:2,cards:["holdBreath","executionArrow"]},
  {policy:"middle-multi-v1",rank:1,cards:["scatteringTips","forkShot"]}
];

for(const build of builds){
  const run=engine();
  const result=run(`
    (() => {
      const build=${JSON.stringify(build)}, limit=${windowMs};
      start({seed:${JSON.stringify(seed)},widths:[3,3,3],training:true});
      const area=Object.keys(areas).find(key=>areas[key].foe==="sentinel");
      if(!area) throw Error("Sentinel missing from QA seed");
      enterArea(area);
      game.formation=["player",null,null];
      game.formation[build.rank]="companion3";
      build.cards.forEach((id,slot)=>{
        if(!setTrainingSkill("companion3",slot,id)) throw Error("Could not equip "+id);
      });
      if(!beginCombat()) throw Error("Could not begin QA combat");
      const battle=game.cooldownBattle;
      // Keep the same front ally and enemy AI. Only the archer's loadout may act.
      for(const skill of battle.skills) if(skill.side!=="companion3") skill.readyAt=Infinity;
      const startParts=Object.fromEntries(Object.entries(game.enemy.body).map(([part,{hp,guard}])=>[part,{hp,guard}]));
      const events=[];
      let firstInjury=null,firstLoss=null,actualDamage=0,blockedDamage=0,removedGuard=0,headResets=0;
      for(let steps=0;game.phase==="combat" && steps<5000;steps++){
        if(battle.elapsed>=limit && !readyTimedSkill(battle) && battle.enemyReadyAt>limit) break;
        if(!game.enemy.body.head.hp) headResets++;
        game.feedback=[];
        advanceAutoBattle();
        for(const event of game.feedback){
          if(event.side!=="enemy" || event.from!=="companion3" || event.type!=="hit") continue;
          const entry={ms:battle.elapsed,card:event.card,part:event.targets[0],
            dealt:event.dealt,blocked:event.blocked,removed:event.removed,injury:event.injury};
          events.push(entry);
          actualDamage+=entry.dealt;
          blockedDamage+=entry.blocked;
          removedGuard+=entry.removed;
          if(entry.injury==="injured" && !firstInjury) firstInjury={ms:entry.ms,part:entry.part};
          if(entry.injury==="lost" && !firstLoss) firstLoss={ms:entry.ms,part:entry.part};
        }
      }
      if(game.phase==="combat" && battle.elapsed!==limit) throw Error("Unexpected QA clock");
      return JSON.stringify({
        balance:"shared-hit-rules-v1",...build,seed:${JSON.stringify(seed)},area,enemy:game.enemy.name,startParts,
        stop:game.phase==="combat"?"time-limit":game.phase,ms:battle.elapsed,actualDamage,blockedDamage,removedGuard,
        firstInjury,firstLoss,headResets,events:${Boolean(values.trace)}?events:undefined
      });
    })()
  `);
  console.log(result);
}
