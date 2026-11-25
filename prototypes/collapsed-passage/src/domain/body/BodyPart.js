// 부위 하나의 내구도와 가드. 값은 이 객체를 통해서만 바뀐다.
// 내구도와 가드는 0 아래로 내려가지 않는다. QA 시나리오와 밸런스 도구가 최대치와 현재치를
// 순서 없이 맞추므로 내구도의 상한은 setter에서 강제하지 않고, 회복 규칙(restoreDurability)이 지킨다.
//
// hp·max·guard는 인스턴스 자신의 열거 가능한 접근자다. 값은 private 필드에 두되, structuredClone·
// 전개({...part})·Object.entries·JSON이 예전 평범한 객체처럼 {hp, max, guard}를 그대로 얻는다.
// Godot 비교 스크립트(compare-*.mjs)가 structuredClone으로 웹 상태를 복사하기 때문이다.
export class BodyPart {
  #hp;
  #max;
  #guard = 0;

  constructor(max){
    this.#max = max;
    this.#hp = max;
    Object.defineProperties(this, {
      hp: {enumerable: true, get: () => this.#hp, set: value => { this.#hp = Math.max(0, value); }},
      max: {enumerable: true, get: () => this.#max, set: value => { this.#max = Math.max(0, value); }},
      guard: {enumerable: true, get: () => this.#guard, set: value => { this.#guard = Math.max(0, value); }},
    });
  }

  // 내구도가 절반 이하면 부상, 0이면 결손.
  get condition(){
    if(this.#hp === 0) return "lost";
    return this.#hp * 2 <= this.#max ? "injured" : "healthy";
  }

  get isLost(){ return this.#hp === 0; }
  get isWounded(){ return this.#hp > 0 && this.#hp < this.#max; }
  get missing(){ return this.#max - this.#hp; }

  // 새 가드는 남은 값과 비교해 큰 값으로 갱신한다.
  raiseGuard(amount){ this.#guard = Math.max(this.#guard, amount); }

  // 최대치를 넘지 않게 회복하고 실제로 회복한 양을 돌려준다. 결손 여부는 호출하는 규칙이 판단한다.
  restoreDurability(amount){
    const recovered = Math.min(this.#max - this.#hp, amount);
    this.#hp += recovered;
    return recovered;
  }

  reset(){
    this.#hp = this.#max;
    this.#guard = 0;
  }
}
