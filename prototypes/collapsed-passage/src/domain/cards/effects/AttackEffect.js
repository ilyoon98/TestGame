import {CardEffect} from "../CardEffect.js";
import {attackDamage, cardPower} from "../cardMath.js";

// 강타·정밀 타격·가드 깨기 계열. 여러 부위를 치는 카드는 앞 타격이 끝난 상태에서 다음 부위를 고른다.
export class AttackEffect extends CardEffect {
  activate({id, side, state}){
    this.apply({id, actor: state[side], opponent: state.enemy, targets: null, state});
  }

  // 이번 공격에 쓸 일회성 준비 보너스(조준, 자가 회복 뒤 일격, 막은 뒤 반격).
  prepare(card, actor, state){
    const tactics = state.cooldownBattle?.tactics;
    const side = this.deps.party.sideOf(actor, state);
    return {
      aim: card.weapon === "bow" && card.type === "attack" && !card.hits ? (tactics?.aim.get(side) || 0) : 0,
      recover: card.recoveryBonus && tactics?.selfHealed.has(side) ? card.recoveryBonus : 0,
      retaliation: card.blockedRemoval && tactics?.blocked.has(side) ? card.blockedRemoval : 0,
    };
  }

  // 한 부위를 칠 때의 피해와 관통·가드 제거 옵션.
  plan(id, actor, target, state, prepared, index){
    const card = this.deps.cards[id], effect = card.effect || id;
    const amount = cardPower(card, actor);
    const gap = card.stripBonus && state.cooldownBattle?.tactics?.strippedPart === target ? card.stripBonus : 0;
    const bellBonus = actor === state.enemy ? actor.attackBonus(id, state.cooldownBattle) : 0;
    const damage = index && card.followupPower ? card.followupPower :
      attackDamage(card, id, amount) + bellBonus + prepared.aim + prepared.recover + gap;
    return {
      damage, gap,
      options: {id, pierce: effect === "aim" ? amount : 0, remove: effect === "break" ? amount : prepared.retaliation,
        bonusDamage: effect === "aim" || effect === "break" ? 0 : amount - card.power},
    };
  }

  apply({id, actor, opponent, targets, state}){
    const {cards, party, hits, seams, heal} = this.deps;
    const card = cards[id];
    const tactics = state.cooldownBattle?.tactics, side = party.sideOf(actor, state);
    const gate = opponent === state.enemy && opponent.isGateClosed(state.cooldownBattle);
    const prepared = this.prepare(card, actor, state);
    if(prepared.aim) tactics.aim.delete(side);
    if(prepared.recover) tactics.selfHealed.delete(side);
    if(prepared.retaliation) tactics.blocked.delete(side);
    let firstDealt = 0;
    const chosen = [];
    const hitCount = gate ? 1 : Math.min(card.hits ?? 1, targets?.length ?? Infinity);
    for(let index = 0; index < hitCount; index++){
      if(index && card.followupPower && !firstDealt) break;
      if(opponent.isDown()) break;
      const target = targets ? targets[index] : seams.timedAttackTarget(state, id, actor, chosen, index, prepared);
      if(!target) break;
      if(!opponent.body[target].hp) continue;
      chosen.push(target);
      const {damage, gap, options} = this.plan(id, actor, target, state, prepared, index);
      if(gap && !gate) delete tactics.strippedPart;
      const event = hits.resolve(actor, opponent, target, damage, options, state);
      if(!index) firstDealt = event?.dealt || 0;
    }
    if(firstDealt && card.onHitHeal){
      const target = actor.woundedParts().sort(([, a], [, b]) => b.missing - a.missing)[0]?.[0];
      if(target) heal().heal(id, actor, actor, target, card.onHitHeal, state);
    }
  }
}
