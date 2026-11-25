import {CardEffect} from "../CardEffect.js";

// 응급처치·기도 계열. 받는 쪽의 배 상태에 따라 회복량이 줄어든다.
export class HealEffect extends CardEffect {
  apply({id, actor, targets, state, recipient, amount}){
    this.heal(id, actor, recipient, targets[0], amount, state);
  }

  ready({card, side, state}){ return this.deps.targets().healingTargets(state, card, side).length > 0; }

  activate({id, side, state}){
    const {cards, targets, seams} = this.deps;
    const skill = cards[id], actor = state[side];
    for(const {side: patient, target, amount} of targets().healingTargets(state, skill, side)){
      seams.applyCard(state, id, actor, state.enemy, [target], state[patient], amount);
    }
  }

  heal(id, actor, recipient, target, amount, state){
    const {cards, parts, party, synergies, events} = this.deps;
    const part = recipient.body[target];
    if(!part.hp || recipient.isDown()) return;
    const before = recipient.condition(target);
    const healing = recipient.receivableHealing(amount);
    // 마법사 2: 마법사의 첫 회복량 +1.
    const bonus = healing && part.hp < part.max && actor.jobs?.includes("mage") ? synergies.consume("mage", state.cooldownBattle) : 0;
    const recovered = recipient.healPart(target, healing + bonus);
    const after = recipient.condition(target), restored = before !== after;
    const from = party.sideOf(actor, state), side = party.sideOf(recipient, state);
    const tactics = state.cooldownBattle?.tactics;
    if(tactics && side !== "enemy" && recovered){
      if(from === side) tactics.selfHealed.add(side);
      if(restored) tactics.recovery = {side, target};
    }
    const guard = healing ? (cards[id].healGuard || 0) : 0;
    if(guard) part.raiseGuard(guard);
    const event = {type: "heal", card: id, from, side, targets: [target], recovered, restored, hp: recipient.hp};
    if(bonus) event.synergies = ["mage"];
    if(restored) event.bodyStatus = recipient.statusLabel();
    if(restored || (recovered && after !== "healthy")) event.wounds = recipient.wounds();
    events.emit(event, state);
    events.log(`${recipient.name} · ${parts[target]} 내구도 +${recovered}${restored ? " · 정상 회복" : ""}`, state);
  }
}
