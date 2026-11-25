import {DamageCalculator} from "./DamageCalculator.js";

// 계산한 타격을 실제로 적용한다. 가드·내구도·체력·표식·반격을 갱신하고 이벤트와 기록을 남긴다.
export class HitResolver {
  #cards;
  #names;
  #companionSides;
  #calculator;
  #sideOf;
  #events;

  // events: {emit(event, state), log(message, state)}
  constructor({cards, parts, labels, companionSides, calculator, sideOf, events}){
    this.#cards = cards;
    this.#names = {parts, labels};
    this.#companionSides = companionSides;
    this.#calculator = calculator;
    this.#sideOf = sideOf;
    this.#events = events;
  }

  resolve(attacker, defender, target, damage, options, state){
    const {id, trainingOverride = false} = options;
    const card = this.#cards[id];
    const drafted = this.#calculator.draft(attacker, defender, target, damage, options, state);
    if(!drafted) return;
    const from = this.#sideOf(attacker, state);
    if(drafted.blocked){
      const {target: blockedAt, dealt, blocked} = drafted.blocked;
      this.#events.emit({type: "hit", card: id, from, side: "enemy", targets: [blockedAt], dealt, blocked, hp: defender.hp, gateBlock: true}, state);
      return;
    }
    const {draft} = drafted;
    const {blocked, dealt, removed, critical, before, exposed, strengthened, prisoner, warrior} = DamageCalculator.summarize(draft);
    target = draft.target;
    const tactics = state.cooldownBattle?.tactics;
    const part = defender.body[target];
    const hadGuard = Object.values(defender.body).some(other => other.guard > 0);
    this.#calculator.commit(draft);
    part.guard -= removed + blocked;
    if(removed && tactics && defender === state.enemy) tactics.strippedPart = target;
    part.hp -= dealt;
    defender.loseVitality(dealt);
    const side = this.#sideOf(defender, state);
    if(!trainingOverride && attacker === state.enemy && side !== "enemy" && blocked) tactics?.blocked.add(side);
    const defeated = defender.isDown();
    const fallen = this.#companionSides.includes(side) && defeated;
    const after = defender.condition(target);
    const event = {type: "hit", card: id, from, side, targets: [target], dealt, blocked, removed, critical, defeated, hp: defender.hp, hadGuard};
    if(strengthened) event.strengthened = strengthened;
    this.#updateMark({event, card, defender, target, from, dealt, defeated, after, exposed, state});
    if(trainingOverride) event.trainingOverride = true;
    if(prisoner || warrior) event.synergies = [prisoner ? "prisoner" : null, warrior ? "warrior" : null].filter(Boolean);
    if(before !== after){
      event.injury = after;
      event.bodyStatus = defender.statusLabel();
    }
    if(dealt && after !== "healthy") event.wounds = defender.wounds();
    if(side === "player" && target === "legs" && before !== after) event.legChange = {before, after};
    if(after === "lost") part.guard = 0;
    if(after === "lost" && defender.counter?.target === target) defender.counter = null;
    if(after === "lost" && defender === state.enemy && tactics?.strippedPart === target) delete tactics.strippedPart;
    this.#events.emit(event, state);
    this.#log(attacker, defender, target, {dealt, blocked, before, after, trainingOverride}, state);
    if(fallen){
      state.deadCompanions = [...state.deadCompanions, defender.kind];
      state.formation[state.formation.indexOf(side)] = null;
      this.#events.log(`${defender.name}이(가) 쓰러졌어요.`, state);
    }
    if(!trainingOverride && defender.counter?.target === target && !defender.isDown()) this.#counterAttack(defender, attacker, state);
    return event;
  }

  // 표식을 쓴 타격, 대상이 쓰러지거나 표식 부위가 결손되면 표식이 사라진다. 표식 카드는 새 표식을 남긴다.
  #updateMark({event, card, defender, target, from, dealt, defeated, after, exposed, state}){
    if(exposed || (defender.mark && (defeated || (after === "lost" && defender.mark.target === target)))){
      delete defender.mark;
      event.markChanged = true;
    }
    if(card.mark && defender === state.enemy && dealt && !defeated && after !== "lost"){
      defender.mark = {target, side: from, bonus: card.mark};
      event.markChanged = true;
    }
  }

  #log(attacker, defender, target, {dealt, blocked, before, after, trainingOverride}, state){
    const {parts, labels} = this.#names;
    this.#events.log(`${trainingOverride ? "QA" : attacker.name} → ${defender.name} ${parts[target]} · 피해 ${dealt}${blocked ? ` · 가드 ${blocked}` : ""}`, state);
    if(after !== before) this.#events.log(`${defender.name}의 ${parts[target]} ${labels[after]}`, state);
  }

  // 반격 자세: 그 부위가 맞으면 공격자의 가슴을 친다.
  #counterAttack(defender, attacker, state){
    const {id: counterId = "counter", damage} = defender.counter;
    defender.counter = null;
    this.resolve(defender, attacker, "chest", damage, {id: counterId, bonusDamage: damage - this.#cards[counterId].power}, state);
  }
}
