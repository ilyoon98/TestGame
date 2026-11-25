// 아직 적용하지 않은 타격 한 번. 피해 보정(HitModifier)이 차례로 값을 채운다.
// 게임 상태는 읽기만 하고 바꾸지 않는다.
export class HitDraft {
  constructor({attacker, defender, target, card, damage, pierce, remove, bonusDamage, trainingOverride, state, from}){
    const part = defender.body[target];
    this.attacker = attacker;
    this.defender = defender;
    this.target = target;
    this.card = card;
    this.state = state;
    this.battle = state.cooldownBattle;
    this.from = from;
    this.trainingOverride = trainingOverride;
    this.part = part;
    this.removed = Math.min(part.guard, remove);
    this.before = defender.condition(target);
    this.effectiveGuard = Math.max(0, part.guard - this.removed - pierce);
    this.damage = damage;
    this.bonusDamage = bonusDamage;
    this.weakened = 0;
    this.prisoner = 0;
    this.warrior = 0;
    this.exposed = 0;
    this.strengthened = 0;
  }

  get byEnemy(){ return this.attacker === this.state.enemy; }
  get onEnemy(){ return this.defender === this.state.enemy; }
  get isAttackCard(){ return this.card.type === "attack"; }

  // 시너지까지 더한 피해. 표식과 기세 매듭은 이 값으로 발동 여부를 정한다.
  get total(){ return this.damage + this.prisoner + this.warrior; }
  get final(){ return this.total + this.exposed + this.strengthened; }
}
