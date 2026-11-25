// 지도 위의 이동과 전투 결과. 이동할 때 다리 상태에 따라 도망 여유를 얻고, 여유가 0 이하가 되면 사형수에게 잡힌다.
// 수녀가 쓰러지거나 붙잡히면 판이 끝나고, 지상 출구에 도달하면 클리어다.
export class Journey {
  #areas;
  #foes;
  #mysteryEvents;
  #parts;
  #party;
  #recruitment;
  #fighters;
  #events;
  #hooks;

  // areas: 현재 지도를 돌려주는 함수(판을 시작할 때 지도가 바뀐다).
  // hooks.fightPrepared(state): 전투 준비에 들어갈 때 화면이 원화를 미리 불러오도록 알린다.
  constructor({areas, foes, mysteryEvents, parts, party, recruitment, fighters, events, hooks = {}}){
    this.#areas = areas;
    this.#foes = foes;
    this.#mysteryEvents = mysteryEvents;
    this.#parts = parts;
    this.#party = party;
    this.#recruitment = recruitment;
    this.#fighters = fighters;
    this.#events = events;
    this.#hooks = hooks;
  }

  // 다리 정상 +2, 부상 +1, 결손 +0.
  travelGain(legs){ return {healthy: 2, injured: 1, lost: 0}[legs]; }

  lose(state, reason, cause = "combat"){
    state.phase = "lost";
    state.reason = reason;
    state.lossCause = cause;
    this.#events.log(reason, state);
  }

  // 전투가 끝났는지 확인하고 결과를 반영한다. 끝났으면 true.
  finishCombat(state){
    if(state.phase !== "combat") return true;
    if(state.player.isDown()){
      this.lose(state, !state.player.body.head.hp ? "머리가 결손되어 쓰러졌어요." : "전체 HP가 0이 되어 쓰러졌어요.");
    }else if(state.enemy.isDown()){
      state.phase = "route";
      for(const side of this.#party.sides(state)) state[side].clearDefense();
      this.#events.log(`${state.enemy.name} 격파`, state);
      const area = this.#areas()[state.area];
      state.recruitQueue = (area.companions || [area.companion])
        .filter(kind => this.#recruitment.canRecruit(state, kind) && !state.metCompanions.has(kind));
      if(state.mapConfig) state.coins++;
      state.pendingVictoryReward = this.hasUpcomingBattle(state.area);
      this.#recruitment.nextOffer(state);
    }else if(state.distance <= 0){
      this.lose(state, "기도를 받았던 사형수에게 따라잡혔어요.", "pursuit");
    }
    return state.phase !== "combat";
  }

  hasUpcomingBattle(id){
    const areas = this.#areas();
    return (areas[id].next || []).some(next => areas[next].foe || this.hasUpcomingBattle(next));
  }

  // 방에 들어간다. 적이 있으면 전투 준비로 가고 true를 돌려준다.
  enterArea(state, id, prepSide = "player"){
    state.area = id;
    state.shopPurchases.clear();
    state.shopSelections.clear();
    state.mysteryResult = null;
    state.restFinished = false;
    state.cooldownBattle = null;
    const area = this.#areas()[id];
    state.pendingMystery = area.event || null;
    if(!area.foe){
      state.phase = id === "exit" ? "won" : "route";
      return false;
    }
    state.prepSide = prepSide;
    state.foe = this.#foes[area.foe];
    state.enemy = this.#fighters.enemy(area.foe, {elite: area.type === "elite", training: state.training});
    state.phase = "prep";
    this.#hooks.fightPrepared?.(state);
    return true;
  }

  canMoveTo(state, id){
    if(state.phase !== "route" || state.pendingCompanion || state.pendingMystery) return false;
    const areas = this.#areas();
    return state.training ? id !== state.area && Boolean(areas[id]?.foe) : areas[state.area].next.includes(id);
  }

  moveTo(state, id){
    if(!this.canMoveTo(state, id)) return;
    if(state.training){
      state.steps++;
      state.trail.push(id);
      this.enterArea(state, id);
      return;
    }
    const area = this.#areas()[id];
    const gain = this.travelGain(state.player.condition("legs"));
    state.distance += gain;
    state.steps++;
    state.trail.push(id);
    state.area = id;
    this.#events.log(`${area.type === "mystery" ? "? 방" : area.name} 도착 · 도망 여유 +${gain}`, state);
    if(state.distance <= 0) this.lose(state, "이동 후에도 도망 여유가 없어 사형수에게 따라잡혔어요.", "pursuit");
    else this.enterArea(state, id);
  }

  // ? 방 사건. 잠긴 물자함은 자물쇠 따개가 있으면 도망 여유를 쓰지 않는다.
  mysteryDistance(state, event){
    return event === this.#mysteryEvents.cache && state.lockpicks ? 0 : event.distance;
  }

  mysteryBlockReason(state, event){
    if(state.distance + this.mysteryDistance(state, event) <= 0) return "도망 여유 부족";
    if(state.coins + event.coins < 0) return "동전 부족";
    return "";
  }

  mysteryEffect(state, event){
    const distance = this.mysteryDistance(state, event);
    if(!distance) return `자물쇠 따개 사용 · 동전 +${event.coins}`;
    return distance < 0 ? `도망 여유 −${-distance} · 동전 +${event.coins}` :
      `동전 −${-event.coins} · 도망 여유 +${distance}`;
  }

  resolveMystery(state, choice){
    const event = this.#mysteryEvents[state.pendingMystery];
    if(state.phase !== "route" || !event) return false;
    if(choice === "take"){
      if(this.mysteryBlockReason(state, event)) return false;
      const effect = this.mysteryEffect(state, event);
      state.distance += this.mysteryDistance(state, event);
      if(event === this.#mysteryEvents.cache) state.lockpicks = false;
      state.coins += event.coins;
      state.mysteryResult = {name: event.name, effect};
      this.#events.log(`${event.name} · ${effect}`, state);
    }else if(choice === "skip") this.#events.log(`${event.name} · 지나침`, state);
    else return false;
    state.pendingMystery = null;
    return true;
  }

  // 정비 계단·휴게소: 도망 여유 1을 써서 부위 하나를 최대 2 회복한다. 결손 부위는 대상이 아니다.
  treatAtStairs(state, target, side = "player"){
    const actor = state[side], part = actor?.body[target];
    if(state.phase !== "route" || this.#areas()[state.area].type !== "rest" || state.restFinished || state.stairTreatment || state.distance <= 1 ||
       !this.#party.sides(state).includes(side) || !part?.hp || part.hp === part.max) return false;
    const recovered = actor.healPart(target, 2);
    state.distance--;
    state.stairTreatment = {area: state.area, name: actor.name, target, recovered};
    state.restFinished = true;
    this.#events.log(`정비 계단에서 ${actor.name} ${this.#parts[target]} 내구도 +${recovered} · 도망 여유 −1`, state);
    return true;
  }
}
