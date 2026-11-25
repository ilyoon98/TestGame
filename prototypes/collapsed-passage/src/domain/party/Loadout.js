// 대원별 장착 기술. 수녀의 칸은 state.loadout, 동료의 칸은 동료 객체의 loadout에 있다.
// 공용 기술은 일행에 한 장씩이고, 전용 기술은 인물 또는 무기 조건을 충족해야 한다.
export class Loadout {
  #cards;
  #skillCharge;
  #companionTypes;
  #slots;
  #parts;
  #party;
  #targets;

  constructor({cards, skillCharge, companionTypes, companionSkillSlots, parts, party, targets}){
    this.#cards = cards;
    this.#skillCharge = skillCharge;
    this.#companionTypes = companionTypes;
    this.#slots = companionSkillSlots;
    this.#parts = parts;
    this.#party = party;
    this.#targets = targets;
  }

  static exclusive(card){ return Boolean(card.character || card.weapon); }

  static fits(card, actor){
    return (!card.character || card.character === actor.kind) && (!card.weapon || card.weapon === actor.weapon);
  }

  // 동료가 합류할 때 장착하고 오는 전용 기술.
  starterSkills(kind){
    const actor = {kind, weapon: this.#companionTypes[kind].weapon};
    const cards = this.#cards;
    return Object.keys(cards).filter(id => !cards[id].reward && Loadout.exclusive(cards[id]) && Loadout.fits(cards[id], actor))
      .slice(0, this.#slots);
  }

  available(state, side = "player"){
    if(!this.#party.roster(state).includes(side)) return [];
    const actor = state[side];
    return Object.entries(this.#cards).filter(([id, card]) =>
      Loadout.fits(card, actor) && (state.skillLevels[id] || (!card.reward && Loadout.exclusive(card)))
    ).map(([id]) => id);
  }

  of(state, side){ return side === "player" ? state.loadout : state[side].loadout; }

  equippedBy(state, id){ return this.#party.roster(state).find(side => this.of(state, side).includes(id)); }

  ready(state){ return this.#party.sides(state).every(side => !this.of(state, side).includes(null)); }

  level(state, id){ return state.skillLevels[id] || 1; }

  // 강화하면 레벨당 충전 시간이 0.4초 짧아진다.
  cooldown(state, id, level = this.level(state, id)){ return this.#skillCharge[id] - (level - 1) * 400; }

  // 장착 중이면 빼고, 아니면 빈 칸에 넣는다. 다른 대원이 장착 중인 공용 기술은 옮겨 온다.
  toggle(state, id, side = "player"){
    if(state.phase !== "prep" || !this.available(state, side).includes(id)) return false;
    const loadout = this.of(state, side);
    const equipped = loadout.indexOf(id);
    if(equipped >= 0){
      loadout[equipped] = null;
      return true;
    }
    const empty = loadout.indexOf(null);
    const owner = this.equippedBy(state, id);
    if(empty < 0 || (owner && Loadout.exclusive(this.#cards[id]))) return false;
    if(owner){
      const from = this.of(state, owner);
      from[from.indexOf(id)] = null;
    }
    loadout[empty] = id;
    return true;
  }

  // QA 훈련장에서 특정 칸에 기술을 넣거나 뺀다.
  setTrainingSkill(state, side, slot, id){
    if(!state.training || state.phase !== "prep" || !this.#party.roster(state).includes(side)) return false;
    const loadout = this.of(state, side);
    if(!Number.isInteger(slot) || slot < 0 || slot >= loadout.length) return false;
    if(id){
      const owner = this.equippedBy(state, id);
      if(!this.available(state, side).includes(id) || (owner && owner !== side)) return false;
      const source = loadout.indexOf(id);
      if(source >= 0) loadout[source] = loadout[slot];
    }
    loadout[slot] = id || null;
    return true;
  }

  // 기술을 지금 쓸 수 없는 이유. 쓸 수 있으면 빈 문자열.
  blocked(state, {id, side}){
    const {part, ranks, target} = this.#cards[id];
    const actor = state[side];
    if(!actor || actor.isDown()) return "동료 이탈";
    const rank = state.formation.indexOf(side);
    if(ranks && rank >= 0 && !ranks.includes(rank)) return "위치 제한";
    if(target === "rear" && rank >= 0 && !this.#targets().rearAlly(state, rank)) return "후열 아군 없음";
    return part && actor.condition(part) === "lost" ? `${this.#parts[part]} 결손` : "";
  }
}
