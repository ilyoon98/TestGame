// 적 앞을 가로막는 장치. 기본은 아무것도 막지 않는 NoGate이고,
// 승강기실의 벨보이는 철문(BellboyGate)을 가진다.

export class NoGate {
  phase(){ return null; }
  isClosed(){ return false; }
  // 공격을 그대로 통과시킨다.
  intercept(){ return null; }
  attackBonus(){ return 0; }
}

// 철문은 닫힌 채 시작한다. 강타 직전 벨이 울리고(bell), 강타 직후 소년이 기절하면 열린다(staggered).
// 닫혀 있을 때 관통 공격은 창살 틈으로 머리를 맞히고, 나머지는 가슴 앞 철문에 막힌다.
export class BellboyGate extends NoGate {
  #timing;

  // timing은 밸런스 도구가 값을 바꿀 수 있으므로 호출할 때마다 읽는다.
  constructor(timing){
    super();
    this.#timing = timing;
  }

  phase(battle){
    if(battle?.bellboyStaggered === undefined) return null;
    if(battle.elapsed >= battle.enemyReadyAt - this.#timing.windup) return "bell";
    return battle.bellboyStaggered ? "staggered" : "closed";
  }

  isClosed(battle){
    const phase = this.phase(battle);
    return phase === "closed" || phase === "bell";
  }

  intercept({pierce, damage}, battle){
    if(!this.isClosed(battle)) return null;
    return pierce > 0 ? {target: "head"} : {blocked: {target: "chest", dealt: 0, blocked: damage, gateBlock: true}};
  }

  attackBonus(cardId, battle){
    return cardId === "heavy" && this.phase(battle) !== null ? this.#timing.damageBonus : 0;
  }
}
