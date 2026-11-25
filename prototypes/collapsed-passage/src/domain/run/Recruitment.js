// 전투 뒤 동료 영입. 후보는 한 명씩 제안되고, 모두 결정하면 승리 보상이 열린다.
// 자리가 가득 차면 후보를 두고 가거나 현재 동료 한 명을 떠나보내고 그 자리에 영입한다.
export class Recruitment {
  #companionTypes;
  #slots;
  #party;
  #loadout;
  #fighters;
  #events;
  #seams;

  // seams.skillRewardOptions: QA 도구가 옛 보상 규칙으로 바꿔 끼우는 교체 지점.
  constructor({companionTypes, companionSkillSlots, party, loadout, fighters, events, seams}){
    this.#companionTypes = companionTypes;
    this.#slots = companionSkillSlots;
    this.#party = party;
    this.#loadout = loadout;
    this.#fighters = fighters;
    this.#events = events;
    this.#seams = seams;
  }

  canRecruit(state, kind){
    return Object.hasOwn(this.#companionTypes, kind) && !state.deadCompanions.includes(kind) &&
      this.#party.roster(state).every(side => state[side].kind !== kind);
  }

  makeCompanion(kind){
    const starters = this.#loadout.starterSkills(kind);
    const loadout = Array.from({length: this.#slots}, (_, slot) => starters[slot] ?? null);
    return this.#fighters.companion(kind, loadout);
  }

  // 다음 후보를 꺼낸다. 후보가 없고 승리 보상이 남아 있으면 보상 화면으로 간다.
  nextOffer(state){
    state.pendingCompanion = state.recruitQueue.shift() ?? null;
    if(state.pendingCompanion) state.metCompanions.add(state.pendingCompanion);
    if(!state.pendingCompanion && state.pendingVictoryReward){
      state.pendingVictoryReward = false;
      state.rewards = this.#seams.skillRewardOptions(state);
      if(state.rewards.length) state.phase = "reward";
    }
  }

  recruit(state, kind, outgoing = null){
    if(state.phase !== "route" || state.pendingCompanion !== kind || !this.canRecruit(state, kind)) return false;
    const sides = this.#party.sides(state);
    const full = sides.length === this.#party.size;
    if(full ? outgoing === "player" || !sides.includes(outgoing) : outgoing !== null) return false;
    const side = outgoing ?? this.#party.freeCompanionSide(state);
    if(!side) return false;
    const type = this.#companionTypes[kind];
    const actor = this.makeCompanion(kind);
    // 이미 다친 채로 합류하는 동료.
    if(type.hurtArm){
      actor.body.arms.hp = type.hurtArm;
      actor.hp -= type.health[2] - type.hurtArm;
    }
    state[side] = actor;
    if(!full){
      if(sides.length === 1 && state.formation[0] === "player") state.formation = [null, null, "player"];
      const empty = state.formation.indexOf(null);
      const rank = type.preferredRank ?? empty;
      state.formation[empty] = state.formation[rank];
      state.formation[rank] = side;
    }
    this.nextOffer(state);
    this.#events.log(`${type.name} 합류`, state);
    return true;
  }

  decline(state){
    if(state.phase !== "route" || !state.pendingCompanion) return false;
    this.nextOffer(state);
    return true;
  }
}
