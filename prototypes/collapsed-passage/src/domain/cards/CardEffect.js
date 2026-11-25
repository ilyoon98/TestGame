// 카드 효과 하나의 계약.
// - apply: 정해진 대상에게 효과를 낸다(적 행동, 회복 대상별 적용 등).
// - activate: 전투 중 대원의 기술이 충전되어 자동 발동할 때 대상을 스스로 골라 낸다.
// - ready: 지금 발동할 의미가 있는지(회복할 부위, 설치할 전술 등) 확인한다. 상태를 바꾸지 않는다.
// 대상이 없으면 아무것도 하지 않고 끝나야 한다.
export class CardEffect {
  constructor(deps){ this.deps = deps; }
  apply(){}
  activate(){ throw new Error(`${this.constructor.name}.activate 미구현`); }
  ready(){ return true; }
}
