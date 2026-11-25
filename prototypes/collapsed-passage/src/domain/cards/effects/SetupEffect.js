import {CardEffect} from "../CardEffect.js";

// 설치형 전술 하나. ready는 상태를 바꾸지 않고, place는 전술을 깔고 이벤트에 쓸 정보를 돌려준다.
export class SetupTactic {
  ready(){ return false; }
  place({side}){ return {recipient: side, targets: [], removed: 0}; }
}

// 등 뒤 지키기: 뒤 아군을 노리는 다음 정밀 타격을 대신 받는다.
export class InterceptTactic extends SetupTactic {
  #targets;
  constructor(targets){ super(); this.#targets = targets; }
  ready({side, state, tactics}){ return !tactics.intercept && Boolean(this.#targets().rearAlly(state, state.formation.indexOf(side))); }
  place({side, tactics}){ tactics.intercept = side; return {recipient: side, targets: [], removed: 0}; }
}

// 고리 비틀기: 가장 두꺼운 부위의 가드를 벗긴다. 철문이 닫혀 있으면 쓰지 않는다.
export class StripTactic extends SetupTactic {
  ready({state}){
    return !state.enemy.isGateClosed(state.cooldownBattle) && Object.values(state.enemy.body).some(part => part.hp && part.guard);
  }
  place({card, state, tactics}){
    const {enemy} = state;
    const target = enemy.intactParts().sort((a, b) => enemy.body[b].guard - enemy.body[a].guard)[0];
    const part = enemy.body[target];
    const removed = Math.min(part.guard, card.power);
    part.guard -= removed;
    tactics.strippedPart = target;
    return {recipient: "enemy", targets: [target], removed};
  }
}

// 숨 참기: 다음 단일 사격 한 발의 피해를 올린다.
export class AimTactic extends SetupTactic {
  ready({side, tactics}){ return !tactics.aim.has(side); }
  place({card, side, tactics}){ tactics.aim.set(side, card.power); return {recipient: side, targets: [], removed: 0}; }
}

// 눌린 숨: 적의 다음 공격 피해를 줄인다.
export class WeakenTactic extends SetupTactic {
  ready({tactics}){ return !tactics.weaken; }
  place({card, tactics}){ tactics.weaken = card.power; return {recipient: "enemy", targets: [], removed: 0}; }
}

// 기세 매듭: 다른 아군의 다음 첫 적중 피해를 올린다.
export class EmpowerTactic extends SetupTactic {
  #party;
  constructor(party){ super(); this.#party = party; }
  ready({side, state, tactics}){ return !tactics.empower && this.#party.sides(state).some(key => key !== side); }
  place({card, side, tactics}){ tactics.empower = {side, amount: card.power}; return {recipient: side, targets: [], removed: 0}; }
}

export class SetupEffect extends CardEffect {
  #tactics;

  constructor(deps, tactics){
    super(deps);
    this.#tactics = tactics;
  }

  #tactic(card){ return this.#tactics[card.setup] ?? new SetupTactic(); }

  ready({card, side, state}){
    return this.#tactic(card).ready({card, side, state, tactics: state.cooldownBattle.tactics});
  }

  place(id, side, state){
    const {cards, events} = this.deps;
    const card = cards[id];
    const {recipient, targets, removed} = this.#tactic(card).place({card, side, state, tactics: state.cooldownBattle.tactics});
    events.emit({type: "setup", card: id, from: side, side: recipient, targets, removed}, state);
    events.log(`${state[side].name} · ${card.name}`, state);
  }

  activate({id, side, state}){
    const card = this.deps.cards[id];
    if(this.ready({card, side, state})) this.place(id, side, state);
  }
}
