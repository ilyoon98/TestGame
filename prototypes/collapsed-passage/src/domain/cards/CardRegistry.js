import {AttackEffect} from "./effects/AttackEffect.js";
import {GuardEffect, CounterStanceEffect} from "./effects/GuardEffect.js";
import {HealEffect} from "./effects/HealEffect.js";
import {SetupEffect, InterceptTactic, StripTactic, AimTactic, WeakenTactic, EmpowerTactic} from "./effects/SetupEffect.js";
import {cardPower} from "./cardMath.js";

// 카드의 effect 키(없으면 카드 id)를 효과 객체에 연결한다.
// 새 효과는 CardEffect를 상속한 클래스를 만들고 register로 등록하면 된다. 호출하는 쪽은 바꾸지 않는다.
//
// deps: {cards, parts, synergies, events, party, hits, targets(), seams}
//   hits      HitResolver
//   targets() TargetSelector(서로 참조하므로 함수로 받는다)
//   seams     QA 도구가 옛 규칙으로 바꿔 끼우는 교체 지점(timedAttackTarget, applyCard)
export class CardRegistry {
  #effects = new Map();
  #cards;

  constructor(deps){
    this.#cards = deps.cards;
    this.attack = new AttackEffect({...deps, heal: () => this.heal});
    this.guard = new GuardEffect(deps);
    this.counter = new CounterStanceEffect(deps);
    this.heal = new HealEffect(deps);
    this.setup = new SetupEffect(deps, {
      intercept: new InterceptTactic(deps.targets),
      strip: new StripTactic(),
      aim: new AimTactic(),
      weaken: new WeakenTactic(),
      empower: new EmpowerTactic(deps.party),
    });
    for(const key of ["strike", "heavy", "aim", "break"]) this.register(key, this.attack);
    for(const key of ["guard", "split"]) this.register(key, this.guard);
    this.register("counter", this.counter);
    this.register("aid", this.heal);
    this.register("setup", this.setup);
  }

  register(effectKey, effect){ this.#effects.set(effectKey, effect); }

  of(id){
    const card = this.#cards[id];
    const effect = this.#effects.get(card.effect || id);
    if(!effect) throw new Error(`등록되지 않은 카드 효과: ${card.effect || id}`);
    return effect;
  }

  // 정해진 대상에게 카드를 쓴다. 위력을 생략하면 사용자의 부위 상태로 계산한다.
  apply(state, id, actor, opponent, targets, recipient = actor, amount = cardPower(this.#cards[id], actor)){
    this.of(id).apply({id, actor, opponent, targets, state, recipient, amount});
  }

  // 충전된 대원 기술을 자동 발동한다.
  activate(state, {id, side}){
    this.of(id).activate({id, side, state});
  }

  ready(state, {id, side}){
    return this.of(id).ready({id, card: this.#cards[id], side, state});
  }
}
