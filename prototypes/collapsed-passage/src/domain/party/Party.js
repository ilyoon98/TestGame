// 일행의 자리. 대열(state.formation)은 전위·중위·후위 세 칸이고, 수녀(player)와 동료 칸(companion…)에 대원이 들어간다.
// 출전 대원은 대열에 있고 쓰러지지 않은 대원, 생존 명단은 대열 밖 대기 대원까지 포함한다.
export class Party {
  #companionSides;
  #ranks;

  constructor({companionSides, formationRanks}){
    this.#companionSides = companionSides;
    this.#ranks = formationRanks;
  }

  get size(){ return this.#ranks.length; }

  sides(state){
    return state.formation.filter(side => side && state[side] && !state[side].isDown());
  }

  roster(state){
    return ["player", ...this.#companionSides].filter(side => state[side] && !state[side].isDown());
  }

  reserve(state){
    return this.roster(state).filter(side => !state.formation.includes(side));
  }

  sideOf(actor, state){
    if(actor === state.player) return "player";
    return this.#companionSides.find(side => state[side] === actor) || "enemy";
  }

  isCompanionSide(side){ return this.#companionSides.includes(side); }

  // 비어 있거나 쓰러진 동료가 있던 칸.
  freeCompanionSide(state){
    return this.#companionSides.find(key => !state[key] || state[key].isDown());
  }

  // 전투 준비에서 대원을 다른 위치로 옮긴다. 대원이 있는 자리면 둘이 자리를 바꾼다.
  // 대기 대원은 QA 훈련장에서만, 수녀가 아닌 자리로 들어온다.
  place(state, side, rank){
    if(state.phase !== "prep" || !this.roster(state).includes(side) || !this.#ranks[rank]) return false;
    const current = state.formation.indexOf(side);
    if(current < 0 && (!state.training || state.formation[rank] === "player")) return false;
    if(current >= 0) state.formation[current] = state.formation[rank];
    state.formation[rank] = side;
    return true;
  }

  // QA 훈련장에서 동료를 대열에서 뺀다.
  setTrainingReserve(state, side){
    if(!state.training || state.phase !== "prep" || side === "player" || !this.sides(state).includes(side)) return false;
    state.formation[state.formation.indexOf(side)] = null;
    return true;
  }
}
