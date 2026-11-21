import {parseArgs} from "node:util";
import {engine} from "../tests/helpers/game-engine.mjs";
import {playFirstStage} from "../tests/helpers/first-stage-policy.mjs";

const {values}=parseArgs({options:{
  ablate:{type:"boolean"},sweep:{type:"boolean"},jsonl:{type:"boolean"},"rotate-reward":{type:"boolean"},
  first:{type:"string",default:"1"},count:{type:"string",default:"45"},
  distance:{type:"string"},head:{type:"string"},vitality:{type:"string"},windup:{type:"string"}
}});
const first=Number(values.first),count=Number(values.count);
if(![first,count].every(value=>Number.isSafeInteger(value) && value>0)) throw new Error("Expected positive seed and run count");
const reference={distance:5,head:21,vitality:27,windup:2000};
const requested=Object.fromEntries(Object.keys(reference).filter(key=>values[key]!==undefined).map(key=>[key,Number(values[key])]));
if(Object.values(requested).some(value=>!Number.isSafeInteger(value) || value<=0)) throw new Error("Expected positive balance values");

// Reconstruct the replaced rules in the QA process. Combat/progression still uses the game engine.
function restorePreviousRules({guard,targeting,rewards}){
  if(rewards){
    skillRewardOptions=function(){
      const random=mapRandom(JSON.stringify(["reward",game.rewardSeed,game.area]));
      const squad=partySides().map(side=>game[side]);
      const eligible=id=>squad.some(actor=>skillFits(cards[id],actor));
      const newSkills=rewardPool.filter(id=>!game.skillLevels[id] && eligible(id));
      const upgrades=Object.keys(cards).filter(id=>game.skillLevels[id] && skillLevel(id)<maxSkillLevel && eligible(id));
      const picked=[drawSkillReward(newSkills,random,true),drawSkillReward(upgrades,random,true)].filter(Boolean);
      const remaining=[...newSkills,...upgrades].filter(id=>!picked.includes(id));
      const extra=drawSkillReward(remaining,random,picked.filter(id=>exclusiveSkill(cards[id])).length<2);
      return extra?[...picked,extra]:picked;
    };
  }
  if(targeting){
    timedAttackTarget=function(id,actor,excluded=[],index=0,prepared=attackSetup(cards[id],actor,game)){
      const {enemy}=game, skill=cards[id], effect=skill.effect || id;
      if(bellboyGateClosed()) return effect==="aim"?"head":"chest";
      const amount=power(skill,actor);
      const ignore=effect==="aim" || effect==="break"?amount:prepared.retaliation;
      const targets=intactParts(enemy).filter(target=>!excluded.includes(target));
      if(!targets.length) return null;
      const priority=target=>attackPriority(skill.targetOrder,actor,enemy,target) ||
        (prepared.retaliation?Math.min(prepared.retaliation,enemy.body[target].guard):0);
      const maximum=Math.max(...targets.map(priority));
      const dealt=target=>{
        const part=enemy.body[target];
        const guard=Math.max(0,part.guard-ignore);
        const gap=skill.stripBonus && priority(target)?skill.stripBonus:0;
        const finish=skill.stripFinish && part.guard && !guard?skill.stripFinish:0;
        const damage=attackDamage(id,amount)+woundedHitBonus(skill,enemy,target)+prepared.aim+prepared.recover+gap+finish;
        return resolveHitDamage(part.hp,guard,damage+exposedHitBonus(skill,actor,enemy,target,damage,guard,game)).dealt;
      };
      if((!maximum || priority("head")===maximum) && targets.includes("head") && dealt("head")>=enemy.body.head.hp) return "head";
      const prefer=target=>effect==="break"?Math.min(amount,enemy.body[target].guard):
        Number(Boolean(actor.jobs?.includes("warrior")) && condition(enemy,target)==="injured");
      return targets.reduce((best,target)=>{
        const order=priority(target)-priority(best) || dealt(target)-dealt(best) || prefer(target)-prefer(best);
        return order>0?target:best;
      },targets.includes("chest")?"chest":targets[0]);
    };
    readyTimedSkill=function(battle){
      return battle.skills.filter(skill=>skill.readyAt<=battle.elapsed && !skillBlocked(skill) && partySkillReady(skill))
        .sort((a,b)=>a.readyAt-b.readyAt || Number(cards[a.id].type==="attack")-Number(cards[b.id].type==="attack") ||
          b.cooldown-a.cooldown || a.id.localeCompare(b.id))[0];
    };
  }
  if(guard){
    const playCard=applyCard;
    applyCard=function(id,actor,opponent,targets,state=game,recipient=actor,amount=power(cards[id],actor)){
      const skill=cards[id], effect=skill.effect || id;
      const enemy=actor===state.enemy;
      const defense=["guard","split","counter"].includes(effect);
      if(enemy && defense) clearDefense(actor);
      const previous=defense?targets.map(target=>recipient.body[target].guard):[];
      playCard(id,actor,opponent,targets,state,recipient,amount);
      if(defense){
        const {added}=state.feedback.at(-1);
        targets.forEach((target,index)=>{recipient.body[target].guard=previous[index]+added;});
      }
      if(enemy && skill.type==="attack") clearDefense(recipient);
    };
  }
  if(guard || targeting){
    const act=executePartySkill;
    executePartySkill=function({id,side}){
      const skill=cards[id], actor=game[side];
      if(skill.type==="attack"){
        if(targeting){
          const targets=[];
          const hits=bellboyGateClosed()?1:skill.hits ?? 1;
          for(let index=0;index<hits;index++){
            const target=timedAttackTarget(id,actor,targets);
            if(!target) break;
            targets.push(target);
          }
          if(targets.length) applyAttack(id,actor,game.enemy,targets,game);
        }else act({id,side});
        if(guard && !skill.cooldown && (!bellboyGateClosed() || (skill.effect || id)==="aim")){
          clearDefense(game.enemy);
        }
      }else if(guard && skill.type==="defense"){
        const plan=guardTargetPlan(id,side);
        if(!plan) return;
        const recipient=game[plan.side], previous=plan.targets.map(target=>recipient.body[target].guard);
        clearDefense(recipient);
        act({id,side});
        plan.targets.forEach((target,index)=>{recipient.body[target].guard=Math.max(previous[index],recipient.body[target].guard);});
      }else act({id,side});
    };
  }
}

const live={label:"live",tuning:requested};
const referenceVariant={label:"reference",tuning:reference};
const variants=values.ablate
  ?Array.from({length:8},(_,mask)=>({
    label:mask===7?"before-rules":mask===0?"after-rules":
      [mask&1?"old-guard":"",mask&2?"old-targeting":"",mask&4?"old-rewards":""].filter(Boolean).join("+"),
    old:{guard:Boolean(mask&1),targeting:Boolean(mask&2),rewards:Boolean(mask&4)},tuning:reference
  }))
  :values.sweep
    ?[referenceVariant,...[
      {distance:6},{distance:7},{head:19},{head:17},{head:15},{vitality:25},{vitality:24},{vitality:23},{vitality:22},{vitality:21},
      {windup:1900},{windup:1800},{windup:1600}
    ].map(change=>({label:Object.entries(change).map(([key,value])=>key+"-"+value).join("+"),tuning:{...reference,...change}}))]
    :Object.keys(requested).length?[referenceVariant,live]:[live];

const runs=variants.map(variant=>{
  const outcomes=[];
  for(let seed=first;seed<first+count;seed++){
    const run=engine(seed);
    run(`((tuning)=>{
      if(tuning.distance!==undefined) game.distance=tuning.distance;
      if(tuning.head!==undefined) foes.bellboy.hp[0]=tuning.head;
      if(tuning.vitality!==undefined) foes.bellboy.vitality=tuning.vitality;
      if(tuning.windup!==undefined) bellboyTiming.windup=tuning.windup;
    })(${JSON.stringify(variant.tuning)});`);
    if(variant.old) run(`(${restorePreviousRules.toString()})(${JSON.stringify(variant.old)});`);
    outcomes.push({balance:variant.label,...playFirstStage(run,seed,{rotateReward:values["rotate-reward"]})});
  }
  return {variant,outcomes};
});
if(values.jsonl){
  for(const {outcomes} of runs) for(const outcome of outcomes) console.log(JSON.stringify(outcome));
}else{
  const base=runs[0].outcomes;
  for(const {variant,outcomes} of runs){
    const lost=outcomes.filter(result=>!result.won);
    const group=field=>Object.fromEntries([...new Set(lost.map(result=>result[field]))].map(key=>[key,lost.filter(result=>result[field]===key).length]));
    console.log(JSON.stringify({balance:variant.label,runs:count,wins:outcomes.length-lost.length,
      failures:group("room"),reasons:group("failureReason"),
      helped:outcomes.filter((result,i)=>result.won&&!base[i].won).map(result=>result.seed),
      hurt:outcomes.filter((result,i)=>!result.won&&base[i].won).map(result=>result.seed)}));
  }
}
