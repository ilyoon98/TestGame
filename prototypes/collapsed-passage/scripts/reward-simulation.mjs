import {readFileSync} from "node:fs";
import {parseArgs} from "node:util";
import {engine,gameEngine} from "../tests/helpers/game-engine.mjs";

const {values}=parseArgs({options:{
  runs:{type:"string",default:"300"},
  classic:{type:"boolean"},
  baseline:{type:"string"},
  "without-synergies":{type:"boolean"},
  jsonl:{type:"boolean"}
}});
const count=Number(values.runs);
if(!Number.isSafeInteger(count) || count<1) throw new Error("--runs needs a positive integer");
const policy="slot-rotation-v1";
const map=values.classic?"classic":"seeded";
const synergies=!values["without-synergies"];
const iterations=values.baseline
  ?[["baseline",gameEngine(readFileSync(values.baseline,"utf8"))],["current",engine]]
  :[["current",engine]];

function simulate(create,seed,balance){
  const run=create(seed,{prep:true});
  const config={seed:String(seed),widths:[3,3],shops:1,rests:1,elites:1,mysteries:1};
  run(`start(${map==="classic"?"null":JSON.stringify(config)}); game.synergiesEnabled=${synergies};`);
  return JSON.parse(run(`
    const seed=${seed};
    const policyRandom=mapRandom(JSON.stringify(["policy",seed]));
    const pickSlot=length=>Math.floor(policyRandom()*length);
    const preferredPair=[
      ["guard","archer"],["guard","awakened"],["guard","shaman"],
      ["awakened","shaman"],["awakened","archer"],["shaman","archer"]
    ][seed%6];
    const priority=[...new Set([...preferredPair,"guard","awakened","shaman","archer"])];
    const rewards=[], skillUses={}, traitUses={}, choices=[];
    let minDistance=game.distance, turns=0, steps=0;
    while(!["won","lost"].includes(game.phase) && steps++<5000){
      if(game.phase==="prep"){
        const roster=livingRoster().filter(side=>side!=="player");
        if(roster.length>2){
          roster.sort((a,b)=>priority.indexOf(game[a].kind)-priority.indexOf(game[b].kind));
          const party=roster.slice(0,2).sort((a,b)=>Number(Boolean(companionTypes[game[a].kind].preferredRank))-
            Number(Boolean(companionTypes[game[b].kind].preferredRank)));
          placePartyMember("player",1);
          placePartyMember(party[0],0);
          placePartyMember(party[1],2);
        }
        choices.push({room:game.area,party:partySides().map(side=>game[side].kind)});
        for(const side of partySides()){
          const actor=game[side];
          const score=id=>{
            if(!id || skillBlocked({id,side})) return -Infinity;
            const skill=cards[id], effect=skill.effect || id;
            if(areas[game.area].foe==="bellboy" && effect==="aim") return 10000/skillCooldown(id);
            const amount=power(skill,actor);
            if(skill.type==="attack") return attackDamage(id,amount)/skillCooldown(id);
            if(effect==="aid") return amount*1.5/skillCooldown(id);
            if(effect==="split") return amount*1.3/skillCooldown(id);
            return (guardAmount(id,actor)+(effect==="counter"?amount/2:0))/skillCooldown(id);
          };
          for(const attack of [true,false]){
            const matches=id=>(cards[id].type==="attack")===attack;
            const pick=availableSkills(side).filter(id=>!equippedBy(id) && matches(id))
              .sort((a,b)=>score(b)-score(a))[0];
            const replace=sideLoadout(side).filter(matches).sort((a,b)=>score(a)-score(b))[0];
            if(pick && replace && score(pick)>score(replace)){
              toggleEquippedSkill(replace,side);
              toggleEquippedSkill(pick,side);
              choices.push({room:game.area,side,equip:pick});
            }
          }
        }
        if(!beginCombat()) throw new Error("Invalid loadout for seed "+seed+" in "+game.area);
      }else if(game.phase==="combat"){
        const action=advanceAutoBattle();
        if(action?.id){
          turns++;
          if(action.actor!=="enemy") skillUses[action.id]=(skillUses[action.id] || 0)+1;
        }
        for(const event of game.feedback) for(const trait of event.synergies || []) traitUses[trait]=(traitUses[trait] || 0)+1;
        game.feedback=[];
      }else if(game.phase==="reward"){
        const chosen=game.rewards[pickSlot(game.rewards.length)];
        rewards.push({room:game.area,options:game.rewards.map(id=>({
          id,rarity:cards[id].rarity || "common",level:game.skillLevels[id] || 0
        })),chosen});
        chooseReward(chosen);
      }else if(game.pendingCompanion){
        const kind=game.pendingCompanion;
        const join=kind==="guard"?seed%6!==3:
          preferredPair.includes(kind) || !game.recruitQueue.some(other=>preferredPair.includes(other));
        const party=partySides();
        const replaceable=party.length===formationRanks.length?party.filter(side=>side!=="player")
          .sort((a,b)=>priority.indexOf(game[b].kind)-priority.indexOf(game[a].kind))[0]:null;
        const replace=replaceable && priority.indexOf(kind)<priority.indexOf(game[replaceable].kind)?replaceable:null;
        const outgoing=replace?game[replace].kind:null;
        const joined=join && (!replaceable || replace) && recruitCompanion(kind,replace);
        if(!joined) declineCompanion();
        choices.push({room:game.area,candidate:kind,joined:Boolean(joined),outgoing:joined?outgoing:null});
      }else if(game.pendingMystery){
        const taken=resolveMystery("take");
        if(!taken) resolveMystery("skip");
        choices.push({room:game.area,event:taken?"take":"skip"});
      }else{
        const room=areas[game.area];
        if(room.type==="shop" && buyShopOffer("shortcut")) choices.push({room:game.area,buy:"shortcut"});
        const patient=room.type==="rest" && quickHealTarget();
        if(patient && treatAtStairs(patient.target,patient.side)) choices.push({room:game.area,treat:patient});
        moveTo(room.next[pickSlot(room.next.length)]);
      }
      minDistance=Math.min(minDistance,game.distance);
    }
    if(!["won","lost"].includes(game.phase)) throw new Error("Seed "+seed+" stalled in "+game.area+" ("+game.phase+")");
    JSON.stringify({balance:${JSON.stringify(balance)},policy:${JSON.stringify(policy)},seed,
      rewardSeed:game.rewardSeed, map:${JSON.stringify(map)},synergies:game.synergiesEnabled,
      won:game.phase==="won",stage:game.steps,room:game.area,score:game.coins,
      seconds:game.combatTime/1000,turns,failureReason:game.phase==="lost"?game.log[0]:null,
      finalDistance:game.distance,minDistance,trail:game.trail,rewards,choices,skillUses,traitUses});
  `));
}

function summarize(results){
  const rarities={common:0,uncommon:0,rare:0};
  const cards={},skillUses={},traitUses={};
  let screens=0,slots=0,runsWithRare=0,firstRoomsWithRare=0;
  for(const result of results){
    if(result.rewards.some(reward=>reward.options.some(option=>option.rarity==="rare"))) runsWithRare++;
    if(result.rewards[0]?.options.some(option=>option.rarity==="rare")) firstRoomsWithRare++;
    for(const reward of result.rewards){
      screens++;
      for(const {id,rarity,level} of reward.options){
        slots++;
        rarities[rarity]++;
        const entry=cards[id] ??= {offered:0,new:0,chosen:0};
        entry.offered++;
        if(!level) entry.new++;
        if(reward.chosen===id) entry.chosen++;
      }
    }
    for(const [id,uses] of Object.entries(result.skillUses)) skillUses[id]=(skillUses[id] || 0)+uses;
    for(const [id,uses] of Object.entries(result.traitUses)) traitUses[id]=(traitUses[id] || 0)+uses;
  }
  for(const [id,entry] of Object.entries(cards)) entry.used=skillUses[id] || 0;
  return {balance:results[0].balance,policy,map,synergies,runs:results.length,
    wins:results.filter(result=>result.won).length,
    averageTurns:results.reduce((total,result)=>total+result.turns,0)/results.length,
    averageMinDistance:results.reduce((total,result)=>total+result.minDistance,0)/results.length,
    screens,slots,rarities,runsWithRare,firstRoomsWithRare,traitUses,cards};
}

const data=iterations.map(([balance,create])=>Array.from({length:count},(_,index)=>simulate(create,index+1,balance)));
if(values.jsonl){
  for(const result of data.flat()) console.log(JSON.stringify(result));
}else{
  const changedSeeds=values.baseline?data[0].filter((result,index)=>result.won!==data[1][index].won).map(result=>result.seed):undefined;
  console.log(JSON.stringify({summaries:data.map(summarize),changedSeeds},null,2));
}
