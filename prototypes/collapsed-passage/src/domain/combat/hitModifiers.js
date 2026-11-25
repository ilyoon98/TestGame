// 피해 보정 하나가 클래스 하나다. preview는 상태를 바꾸지 않고 HitDraft만 채운다.
// commit은 그 타격이 실제로 들어갈 때 한 번 쓰는 보너스를 소모한다.
// 새 보정은 클래스를 추가하고 createHitModifiers의 목록에 넣으면 된다.

export class HitModifier {
  preview(draft){}
  commit(draft){}
}

// 가드를 0으로 만들면 카드의 마무리 피해를 더한다(찢긴 쇠고리).
export class StripFinishModifier extends HitModifier {
  preview(draft){
    if(draft.removed && draft.removed === draft.part.guard) draft.damage += draft.card.stripFinish || 0;
  }
}

// 부상 부위를 치면 카드의 부상 보너스를 더한다.
export class WoundedHitModifier extends HitModifier {
  static bonus(card, defender, target){
    if(!card.woundBonus || defender.condition(target) !== "injured") return 0;
    if(card.woundParts && !card.woundParts.includes(target)) return 0;
    if(card.minimumWounds && defender.intactParts().filter(key => defender.condition(key) === "injured").length < card.minimumWounds) return 0;
    return card.woundBonus;
  }

  preview(draft){ draft.damage += WoundedHitModifier.bonus(draft.card, draft.defender, draft.target); }
}

// QA 훈련장에서 적 피해 배율을 적용한다.
export class TrainingDamageModifier extends HitModifier {
  preview(draft){
    const multiplier = draft.byEnemy && !draft.trainingOverride && draft.state.training ? draft.state.trainingEnemyDamage : 1;
    draft.damage *= multiplier;
    draft.bonusDamage *= multiplier;
  }
}

// 눌린 숨: 적의 다음 공격 피해를 줄인다.
export class WeakenModifier extends HitModifier {
  preview(draft){
    draft.weakened = !draft.trainingOverride && draft.byEnemy && draft.isAttackCard ? (draft.battle?.tactics?.weaken || 0) : 0;
    draft.damage = Math.max(0, draft.damage - draft.weakened);
  }
  commit(draft){
    if(draft.weakened) delete draft.battle.tactics.weaken;
  }
}

// 수감자 2: 수감자가 처음 가드를 깎으면 같은 부위에 피해 +1.
export class PrisonerSynergy extends HitModifier {
  #synergies;
  constructor(synergies){ super(); this.#synergies = synergies; }
  preview(draft){
    draft.prisoner = draft.removed && draft.attacker.factions?.includes("prisoner") ? this.#synergies.available("prisoner", draft.battle) : 0;
  }
  commit(draft){
    if(draft.prisoner) this.#synergies.consume("prisoner", draft.battle);
  }
}

// 전사 2: 전사마다 첫 부상 부위 적중 시 피해 +1. 남은 가드를 뚫을 수 있을 때만 붙는다.
export class WarriorSynergy extends HitModifier {
  #synergies;
  constructor(synergies){ super(); this.#synergies = synergies; }
  #key(draft){ return `warrior:${draft.from}`; }
  preview(draft){
    draft.warrior = draft.before === "injured" && draft.isAttackCard && draft.damage + draft.prisoner >= draft.effectiveGuard &&
      draft.attacker.jobs?.includes("warrior") ? this.#synergies.available("warrior", draft.battle, this.#key(draft)) : 0;
  }
  commit(draft){
    if(draft.warrior) this.#synergies.consume("warrior", draft.battle, this.#key(draft));
  }
}

// 균열 표식: 표식을 남긴 대원이 아닌 아군이 그 부위를 뚫으면 피해를 더한다. 표식 정리는 HitResolver가 한다.
export class MarkModifier extends HitModifier {
  #sideOf;
  constructor(sideOf){ super(); this.#sideOf = sideOf; }
  static bonus(card, attacker, defender, target, damage, guard, state, sideOf){
    const mark = defender.mark;
    return mark?.target === target && card.type === "attack" && attacker !== state.enemy &&
      damage > guard && mark.side !== sideOf(attacker, state) ? mark.bonus : 0;
  }
  preview(draft){
    draft.exposed = draft.trainingOverride ? 0 :
      MarkModifier.bonus(draft.card, draft.attacker, draft.defender, draft.target, draft.total, draft.effectiveGuard, draft.state, this.#sideOf);
  }
}

// 기세 매듭: 다른 아군의 다음 첫 적중 피해 +1.
export class EmpowerModifier extends HitModifier {
  preview(draft){
    const empower = draft.battle?.tactics?.empower;
    draft.strengthened = !draft.trainingOverride && empower && empower.side !== draft.from && !draft.byEnemy &&
      draft.onEnemy && draft.isAttackCard && draft.total > draft.effectiveGuard ? empower.amount : 0;
  }
  commit(draft){
    if(draft.strengthened) delete draft.battle.tactics.empower;
  }
}

// DESIGN.md의 피해 계산 순서. 순서를 바꾸면 결과가 달라진다.
export function createHitModifiers({synergies, sideOf}){
  return [
    new StripFinishModifier(),
    new WoundedHitModifier(),
    new TrainingDamageModifier(),
    new WeakenModifier(),
    new PrisonerSynergy(synergies),
    new WarriorSynergy(synergies),
    new MarkModifier(sideOf),
    new EmpowerModifier(),
  ];
}
