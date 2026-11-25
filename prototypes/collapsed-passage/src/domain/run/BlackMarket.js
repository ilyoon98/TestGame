// 암시장. 상품은 방마다 한 번씩 살 수 있다.
export class BlackMarket {
  #offers;
  #parts;
  #party;
  #areas;
  #events;

  constructor({shopOffers, parts, party, areas, events}){
    this.#offers = shopOffers;
    this.#parts = parts;
    this.#party = party;
    this.#areas = areas;
    this.#events = events;
  }

  // 붕대는 다친 부위, 약병은 체력이 줄어든 대원을 고른다. 결손 부위는 대상이 아니다.
  targets(state, id){
    const offers = this.#offers;
    if(id === "bandage"){
      return this.#party.roster(state).flatMap(side => state[side].woundedParts().map(([part, body]) => ({
        side, part, value: `${side}:${part}`,
        label: `${state[side].name} · ${this.#parts[part]} ${body.hp} → ${Math.min(body.max, body.hp + offers.bandage.amount)}/${body.max}`,
      })));
    }
    if(id === "tonic"){
      return this.#party.roster(state).filter(side => state[side].hp < state[side].maxHp).map(side => {
        const {name, hp, maxHp} = state[side];
        return {side, value: side, label: `${name} · ${hp} → ${Math.min(maxHp, hp + offers.tonic.amount)}/${maxHp}`};
      });
    }
    return [];
  }

  // 살 수 없는 이유. 살 수 있으면 빈 문자열.
  issue(state, id, options){
    if(state.shopPurchases.has(id)) return "구입 완료";
    if((id === "oil" && state.lanternOil) || (id === "lockpicks" && state.lockpicks)) return "보유 중";
    if(state.coins < this.#offers[id].price) return `동전 ${this.#offers[id].price} 필요`;
    if(id === "bandage" && !options.length) return "치료할 부위 없음";
    if(id === "tonic" && !options.length) return "회복할 대원 없음";
    return "";
  }

  buy(state, id, target = ""){
    if(state.phase !== "route" || this.#areas()[state.area].type !== "shop" || !Object.hasOwn(this.#offers, id)) return false;
    const {name, price, amount, effect} = this.#offers[id];
    const options = this.targets(state, id);
    if(this.issue(state, id, options)) return false;
    let result = effect;
    if(id === "bandage" || id === "tonic"){
      const selected = options.find(option => option.value === target);
      if(!selected) return false;
      const actor = state[selected.side];
      if(id === "bandage"){
        const recovered = actor.healPart(selected.part, amount);
        result = `${actor.name} ${this.#parts[selected.part]} 내구도 +${recovered}`;
      }else{
        const recovered = Math.min(amount, actor.maxHp - actor.hp);
        actor.hp += recovered;
        result = `${actor.name} 체력 +${recovered}`;
      }
    }
    if(id === "shortcut") state.distance += amount;
    if(id === "oil") state.lanternOil = true;
    if(id === "lockpicks") state.lockpicks = true;
    state.coins -= price;
    state.shopPurchases.set(id, result);
    this.#events.log(`암시장 · ${name} · ${result}`, state);
    return true;
  }
}
