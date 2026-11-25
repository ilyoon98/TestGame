import {cardPower} from "../cards/cardMath.js";

// 기술이 스스로 대상을 고르는 규칙. 공격 표적은 실제 타격과 같은 피해 계산(DamageCalculator.preview)으로
// 후보를 비교하고, 비교할 때 상태를 바꾸지 않는다.
export class TargetSelector {
  #cards;
  #calculator;
  #attack;
  #party;
  #planner;

  // attack()와 planner()는 서로 참조하는 객체라 함수로 받는다.
  constructor({cards, calculator, attack, party, planner}){
    this.#cards = cards;
    this.#calculator = calculator;
    this.#attack = attack;
    this.#party = party;
    this.#planner = planner;
  }

  // 자기보다 뒤에 있는 살아 있는 아군 중 맨 뒤.
  rearAlly(state, rank){
    return state.formation.slice(rank + 1).findLast(side => side && !state[side].isDown());
  }

  // 가장 많이 다친 부위(회복할 수 있는 대원만).
  quickHealTarget(state, excludedSide = null){
    let best = null;
    for(const side of this.#party.sides(state)){
      if(side === excludedSide) continue;
      const actor = state[side];
      if(!actor.receivableHealing()) continue;
      for(const [target, part] of actor.woundedParts()){
        const missing = part.max - part.hp;
        if(!best || missing > best.missing) best = {side, target, missing};
      }
    }
    return best;
  }

  // 회복 카드의 대상. 대원마다 가장 급한 부위 하나씩, 카드가 허용하는 인원까지.
  healingTargets(state, card, side){
    const mode = card.healMode, powerValue = cardPower(card, state[side]);
    const patients = this.#party.sides(state).filter(patient => mode === "self" ? patient === side : mode !== "others" || patient !== side);
    const choices = patients.flatMap(patient => {
      const ally = state[patient];
      return ally.woundedParts().flatMap(([target, part]) => {
        const injured = ally.condition(target) === "injured";
        const limb = target === "arms" || target === "legs";
        const vital = target === "head" || target === "chest";
        if((mode === "limbs" && (!limb || !injured)) || (mode === "injured" && !injured)) return [];
        const amount = mode === "vitals" && !vital ? 2 : powerValue;
        const healing = ally.receivableHealing(amount);
        if(!healing) return [];
        const priority = mode === "vitals" && vital ? 100 - part.hp :
          mode === "limbs" && (part.hp + healing) * 2 > part.max ? 100 : mode === "self" && injured ? 100 : 0;
        return [{side: patient, target, amount, priority, missing: part.max - part.hp}];
      });
    }).sort((a, b) => b.priority - a.priority || b.missing - a.missing);
    const bestByAlly = choices.filter((choice, index) => choices.findIndex(other => other.side === choice.side) === index);
    return bestByAlly.length < (card.minimumPatients ?? 1) ? [] : bestByAlly.slice(0, card.healAllies ?? 1);
  }

  // 가드 카드의 대상 대원과 부위. 눈이 정상이면 적의 예고 부위를 막는다.
  guardTargetPlan(state, id, side){
    const card = this.#cards[id], mode = card.guardMode;
    const partySides = () => this.#party.sides(state);
    const intent = state.player.condition("eyes") === "healthy" ? this.#planner().intent(state)[0] : null;
    const rear = card.target === "rear" || mode === "rearWound";
    const recipient = rear ? this.rearAlly(state, state.formation.indexOf(side)) : mode?.startsWith("self") ? side : intent?.side || side;
    if(mode === "recovery"){
      const entry = state.cooldownBattle?.tactics?.recovery;
      return entry && partySides().includes(entry.side) && state[entry.side].condition(entry.target) === "healthy" ?
        {side: entry.side, targets: [entry.target]} : null;
    }
    if(mode === "wounded"){
      const wound = partySides().flatMap(key => state[key].woundedParts()
        .filter(([target]) => state[key].condition(target) === "injured").map(([target, part]) => ({side: key, target, hp: part.hp})))
        .sort((a, b) => a.hp - b.hp)[0];
      const front = partySides()[0];
      return wound ? {side: wound.side, targets: [wound.target]} :
        {side: front, targets: [TargetSelector.fallbackTarget("chest", state[front].intactParts())]};
    }
    if(!recipient) return null;
    const ally = state[recipient], intact = ally.intactParts();
    const incoming = intent?.side === recipient ? intent.targets[0] : null;
    let targets;
    switch(mode){
      case "selfHead": targets = ["head"]; break;
      case "selfChest": targets = ["chest"]; break;
      case "selfLegs": targets = ["legs"]; break;
      case "selfVitals": targets = ["head", "chest"]; break;
      case "rearWound":{
        const injured = ally.woundedParts().filter(([target]) => ally.condition(target) === "injured")
          .sort(([, a], [, b]) => (b.max - b.hp) - (a.max - a.hp));
        if(!injured.length) return null;
        targets = [incoming || injured[0][0]];
        break;
      }
      default:{
        const fallback = card.guardFallback || "head";
        const first = TargetSelector.fallbackTarget(incoming || fallback, intact);
        const others = intact.filter(target => target !== first);
        const second = (card.effect || id) === "split" ? (rear && others.includes("chest") ? "chest" : others[0]) : null;
        targets = second ? [first, second] : [first];
      }
    }
    targets = targets.filter(target => intact.includes(target));
    return targets.length ? {side: recipient, targets} : null;
  }

  static fallbackTarget(target, active){
    if(active.includes(target)) return target;
    return active.includes("chest") ? "chest" : "head";
  }

  // 카드의 targetOrder에 따른 부위 우선순위.
  attackPriority(state, order, actor, enemy, target){
    const injured = enemy.condition(target) === "injured";
    const limb = target === "arms" || target === "legs";
    const guard = enemy.body[target].guard;
    switch(order){
      case "visibleGuard": return actor.condition("eyes") === "healthy" ? guard : 0;
      case "injuredArms": return Number(target === "arms" && injured);
      case "wounded": return Number(injured);
      case "woundedLimbs": return Number(limb && injured);
      case "stripped": return Number(state.cooldownBattle?.tactics?.strippedPart === target);
      case "healthyGuardedLimbs": return limb && !injured ? guard : 0;
      case "limbs": return Number(limb);
      case "unguarded": return Number(!guard);
      case "guarded": return guard;
    }
    return 0;
  }

  // 공격 표적. 머리를 끝낼 수 있으면 머리, 아니면 우선순위·실제 피해·선호 순으로 고른다.
  timedAttackTarget(state, id, actor, excluded = [], index = 0, prepared = this.#attack().prepare(this.#cards[id], actor, state)){
    const {enemy} = state, skill = this.#cards[id], effect = skill.effect || id;
    if(enemy.isGateClosed(state.cooldownBattle)) return effect === "aim" ? "head" : "chest";
    const amount = cardPower(skill, actor);
    const targets = enemy.intactParts().filter(target => !excluded.includes(target));
    if(!targets.length) return null;
    const priority = target => this.attackPriority(state, skill.targetOrder, actor, enemy, target) ||
      (prepared.retaliation ? Math.min(prepared.retaliation, enemy.body[target].guard) : 0);
    const maximum = Math.max(...targets.map(priority));
    const values = new Map(targets.map(target => {
      const {damage, options} = this.#attack().plan(id, actor, target, state, prepared, index);
      return [target, this.#calculator.preview(actor, enemy, target, damage, options, state)?.dealt ?? 0];
    }));
    const dealt = target => values.get(target);
    if((!maximum || priority("head") === maximum) && targets.includes("head") && dealt("head") >= enemy.body.head.hp) return "head";
    const prefer = target => effect === "break" ? Math.min(amount, enemy.body[target].guard) :
      Number(Boolean(actor.jobs?.includes("warrior")) && enemy.condition(target) === "injured");
    return targets.reduce((best, target) => {
      const order = priority(target) - priority(best) || dealt(target) - dealt(best) || prefer(target) - prefer(best);
      return order > 0 ? target : best;
    }, targets.includes("chest") ? "chest" : targets[0]);
  }
}
