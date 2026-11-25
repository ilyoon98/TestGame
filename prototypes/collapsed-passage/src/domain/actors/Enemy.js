import {Fighter} from "./Fighter.js";
import {NoGate} from "../combat/gates.js";

// 통로에서 마주치는 적. 철문 같은 장치(gate)는 조합으로 붙인다.
export class Enemy extends Fighter {
  #gate;

  constructor(foe, foeId, vitality, partIds, gate = new NoGate()){
    super(foe.name, foe.hp, vitality, partIds);
    this.foeId = foeId;
    this.#gate = gate;
    for(const [part, amount] of Object.entries(foe.armor)) this.body[part].guard = amount;
  }

  gatePhase(battle){ return this.#gate.phase(battle); }
  isGateClosed(battle){ return this.#gate.isClosed(battle); }
  interceptHit(hit, battle){ return this.#gate.intercept(hit, battle); }
  attackBonus(cardId, battle){ return this.#gate.attackBonus(cardId, battle); }

  // 머리를 잃은 뒤 다시 일어나는 적만 true를 돌려준다.
  reviveIfHeadLost(){ return false; }
}

// QA 훈련장의 적. 쓰러지지 않고, 머리를 잃으면 모든 부위가 회복된다.
export class TrainingDummy extends Enemy {
  get infinite(){ return true; }
  isDown(){ return false; }
  loseVitality(){}
  reviveIfHeadLost(){
    if(this.body.head.hp) return false;
    this.restore();
    return true;
  }
}
