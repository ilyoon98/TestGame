export function playFirstStage(run,seed,{rotateReward=false}={}){
  return JSON.parse(run(`
    (() => {
      const path=${seed%3};
      const rewardSlot=${rotateReward?Math.floor((seed-1)/3)%3:seed%3};
      let actions=0,steps=0,minDistance=game.distance;
      const decisions=[];
      while(!["won","lost"].includes(game.phase) && actions<1000 && steps++<1050){
        if(game.phase==="prep"){
          const learned=availableSkills().find(id=>game.skillLevels[id] &&
            !starterSkills.includes(id) && !equippedBy(id) && cards[id].type==="attack");
          if(learned){
            toggleEquippedSkill(game.loadout[1]);
            toggleEquippedSkill(learned);
          }
          decisions.push({room:game.area,equipped:[...game.loadout]});
          if(!beginCombat()) throw new Error("Could not begin combat");
        }else if(game.phase==="combat"){
          advanceAutoBattle();
          game.feedback=[];
          actions++;
        }else if(game.phase==="reward"){
          const choice=game.rewards[rewardSlot];
          decisions.push({room:game.area,offered:[...game.rewards],chosen:choice});
          if(!chooseReward(choice)) throw new Error("Could not choose the regression reward slot");
        }else{
          if(game.pendingCompanion){
            const kind=game.pendingCompanion;
            if(partySides().length===formationRanks.length){
              declineCompanion();
              decisions.push({room:game.area,declined:kind});
            }else{
              if(!recruitCompanion(kind)) throw new Error("Could not recruit "+kind);
              decisions.push({room:game.area,recruited:kind});
            }
          }
          if(game.area==="corridor"){
            const patient=quickHealTarget();
            if(patient) treatAtStairs(patient.target,patient.side);
          }
          const next=areas[game.area].next;
          moveTo(game.area==="threshold"?next[path]:next[0]);
        }
        minDistance=Math.min(minDistance,game.distance);
        if(!Number.isFinite(game.distance) || !Number.isFinite(game.combatTime)) throw new Error("Invalid resources");
        for(const side of [...partySides(),"enemy"]){
          const actor=game[side];
          if(actor.hp<0 || actor.hp>actor.maxHp) throw new Error("Invalid HP");
          for(const part of Object.values(actor.body)){
            if(part.hp<0 || part.hp>part.max || part.guard<0) throw new Error("Invalid body state");
          }
        }
      }
      if(!["won","lost"].includes(game.phase)) throw new Error("Stage stalled in "+game.area);
      return JSON.stringify({seed:${seed},policy:${JSON.stringify(rotateReward?"classic-rotated-rewards-v1":"classic-regression-v1")},rewardSeed:game.rewardSeed,
        won:game.phase==="won",room:game.area,stage:game.steps,trail:game.trail,
        score:game.player.hp,seconds:game.combatTime/1000,minDistance,distance:game.distance,actions,
        failureReason:game.phase==="lost"?(game.lossCause || game.log[0]):null,
        bossHp:game.area==="lift"?game.enemy.hp:null,bossHead:game.area==="lift"?game.enemy.body.head.hp:null,
        decisions});
    })()
  `));
}
