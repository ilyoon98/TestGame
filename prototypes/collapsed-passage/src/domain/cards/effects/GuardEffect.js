import {CardEffect} from "../CardEffect.js";
import {cardPower} from "../cardMath.js";

// 부위 가드·두 부위 가드 계열. 새 가드는 남은 값과 비교해 큰 값으로 갱신한다.
export class GuardEffect extends CardEffect {
  // 이 카드가 실제로 올리는 가드 양.
  guardAmount(id, amount){ return amount; }

  apply({id, actor, targets, state, recipient, amount}){
    const {cards, parts, party, synergies, events} = this.deps;
    const card = cards[id];
    // 간수 2: 맨 앞 대원에게 처음 주는 가드 +2.
    const bonus = state.enemy !== actor && state[party.sides(state)[0]] === recipient ? synergies.consume("guard", state.cooldownBattle) : 0;
    const added = this.guardAmount(id, amount) + bonus;
    for(const key of targets) recipient.body[key].raiseGuard(added);
    const event = {type: "guard", card: id, from: party.sideOf(actor, state), side: party.sideOf(recipient, state), targets: [...targets], added};
    if(bonus) event.synergies = ["guard"];
    events.emit(event, state);
    this.afterGuard({id, recipient, target: targets[0], amount});
    events.log(`${recipient.name} · ${targets.map(key => parts[key]).join("·")}에 ${card.name}`, state);
  }

  afterGuard(){}

  ready({id, card, side, state}){
    return card.guardMode ? Boolean(this.deps.targets().guardTargetPlan(state, id, side)) : true;
  }

  activate({id, side, state}){
    const {cards, targets: selector, seams} = this.deps;
    const skill = cards[id], actor = state[side];
    const plan = selector().guardTargetPlan(state, id, side);
    if(!plan) return;
    if(skill.guardMode === "recovery") delete state.cooldownBattle.tactics.recovery;
    const {targets} = plan, recipient = state[plan.side];
    if(skill.injuredGuard){
      const amount = cardPower(skill, actor);
      for(const target of targets){
        const bonus = recipient.condition(target) === "injured" ? skill.injuredGuard : 0;
        seams.applyCard(state, id, actor, state.enemy, [target], recipient, amount + bonus);
      }
    }else seams.applyCard(state, id, actor, state.enemy, targets, recipient);
  }
}

// 반격 자세: 가드를 올리고, 그 부위가 맞으면 공격자의 가슴을 치도록 예약한다.
export class CounterStanceEffect extends GuardEffect {
  // 기본 반격 자세는 가드 1, 다른 반격 카드는 위력만큼 가드를 올린다.
  guardAmount(id, amount){ return id === "counter" ? 1 : amount; }

  afterGuard({id, recipient, target, amount}){
    recipient.counter = {id, target, damage: amount};
  }
}
