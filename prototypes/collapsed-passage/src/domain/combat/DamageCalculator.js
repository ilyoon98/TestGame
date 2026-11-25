import {HitDraft} from "./HitDraft.js";
import {resolveHitDamage} from "./resolveHitDamage.js";

// 타격 한 번의 결과를 계산한다. 자동 표적 비교와 실제 타격이 같은 계산을 쓰고,
// preview는 게임 상태를 바꾸지 않는다. 보너스 소모는 commit에서만 한다.
export class DamageCalculator {
  #cards;
  #modifiers;
  #sideOf;

  constructor({cards, modifiers, sideOf}){
    this.#cards = cards;
    this.#modifiers = modifiers;
    this.#sideOf = sideOf;
  }

  // 쓰러졌거나 결손된 부위면 undefined, 철문에 막히면 gateBlock 결과, 그 밖에는 {draft, result}.
  draft(attacker, defender, target, damage, {id, pierce = 0, remove = 0, bonusDamage = 0, trainingOverride = false}, state){
    if(defender.isDown()) return undefined;
    if(defender === state.enemy){
      const intercepted = defender.interceptHit({pierce, damage}, state.cooldownBattle);
      if(intercepted?.blocked) return {blocked: {...intercepted.blocked}};
      if(intercepted) target = intercepted.target;
    }
    if(!defender.body[target].hp) return undefined;
    const draft = new HitDraft({attacker, defender, target, card: this.#cards[id], damage, pierce, remove, bonusDamage,
      trainingOverride, state, from: this.#sideOf(attacker, state)});
    for(const modifier of this.#modifiers) modifier.preview(draft);
    return {draft};
  }

  preview(...args){
    const drafted = this.draft(...args);
    if(!drafted) return undefined;
    if(drafted.blocked) return drafted.blocked;
    return DamageCalculator.summarize(drafted.draft);
  }

  commit(draft){
    for(const modifier of this.#modifiers) modifier.commit(draft);
  }

  static summarize(draft){
    const {target, before, removed, weakened, prisoner, warrior, exposed, strengthened} = draft;
    return {target, before, removed, weakened, prisoner, warrior, exposed, strengthened,
      ...resolveHitDamage(draft.part.hp, draft.effectiveGuard, draft.final, draft.bonusDamage)};
  }
}
