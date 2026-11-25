import {Fighter} from "./Fighter.js";
import {Nun, Companion} from "./PartyMember.js";
import {Enemy, TrainingDummy} from "./Enemy.js";
import {BellboyGate, NoGate} from "../combat/gates.js";

// 데이터 표의 값을 전투원 객체로 바꾼다. 어떤 클래스를 쓸지는 여기서만 정한다.
export class FighterFactory {
  #data;

  constructor(data){ this.#data = data; }

  get #partIds(){ return Object.keys(this.#data.parts); }

  generic(name, health, vitality){ return new Fighter(name, health, vitality, this.#partIds); }

  nun(){ return new Nun(this.#data.nunType, this.#partIds); }

  companion(kind, loadout){ return new Companion(this.#data.companionTypes[kind], kind, this.#partIds, loadout); }

  enemy(foeId, {elite = false, training = false} = {}){
    const foe = this.#data.foes[foeId];
    const Type = training ? TrainingDummy : Enemy;
    const gate = foeId === "bellboy" ? new BellboyGate(this.#data.bellboyTiming) : new NoGate();
    return new Type(foe, foeId, foe.vitality + (elite ? 2 : 0), this.#partIds, gate);
  }
}
