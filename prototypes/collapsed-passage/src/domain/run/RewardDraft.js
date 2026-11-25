import {seededRandom} from "../random.js";
import {Loadout} from "../party/Loadout.js";

// 승리 보상. 최대 세 가지 선택지를 시드로 뽑는다. 시드·방·출전 대원·대열·부위 상태·습득 상태가 같으면
// 카드와 순서가 재현된다. 새 기술과 강화가 각각 한 장 이상 나오고, 전용 카드 두 장을 우선한다.
export class RewardDraft {
  #cards;
  #rewardPool;
  #rarities;
  #maxLevel;
  #party;
  #loadout;
  #events;

  constructor({cards, rewardPool, skillRarities, maxSkillLevel, party, loadout, events}){
    this.#cards = cards;
    this.#rewardPool = rewardPool;
    this.#rarities = skillRarities;
    this.#maxLevel = maxSkillLevel;
    this.#party = party;
    this.#loadout = loadout;
    this.#events = events;
  }

  rarity(id){ return this.#cards[id].rarity ?? "common"; }

  options(state){
    const cards = this.#cards;
    const random = seededRandom(JSON.stringify(["reward", state.rewardSeed, state.area]));
    const sides = this.#party.sides(state), squad = sides.map(side => state[side]);
    const eligible = id => squad.some(actor => Loadout.fits(cards[id], actor));
    const personal = id => Loadout.exclusive(cards[id]);
    const newSkills = this.#rewardPool.filter(id => !state.skillLevels[id] && eligible(id));
    const upgrades = Object.keys(cards).filter(id => state.skillLevels[id] && this.#loadout.level(state, id) < this.#maxLevel && eligible(id));
    // 지금 대열과 부위 상태에서 바로 발동할 수 있는 새 기술을 먼저 뽑는다.
    const readyToEquip = newSkills.filter(id => sides.some(side => Loadout.fits(cards[id], state[side]) && !this.#loadout.blocked(state, {id, side})));
    const learned = this.draw(readyToEquip.length ? readyToEquip : newSkills, random, true);
    const upgrade = this.draw(upgrades, random, true);
    const picked = [learned, upgrade].filter(Boolean);
    const remaining = [...newSkills, ...upgrades].filter(id => !picked.includes(id));
    const preferExclusive = picked.filter(personal).length < 2;
    const extra = this.draw(remaining, random, preferExclusive);
    return extra ? [...picked, extra] : picked;
  }

  // 후보가 있는 등급만 가중치(일반·고급·희귀)로 추첨한 뒤 그 등급 안에서 고른다.
  draw(ids, random, preferExclusive){
    if(!ids.length) return null;
    const preferred = ids.filter(id => Loadout.exclusive(this.#cards[id]) === preferExclusive);
    const candidates = preferred.length ? preferred : ids;
    const tiers = Object.entries(this.#rarities).map(([rarity, {weight}]) => ({
      weight, choices: candidates.filter(id => this.rarity(id) === rarity),
    })).filter(tier => tier.choices.length);
    let roll = random() * tiers.reduce((sum, tier) => sum + tier.weight, 0);
    for(const {weight, choices} of tiers){
      roll -= weight;
      if(roll < 0) return choices[Math.floor(random() * choices.length)];
    }
  }

  // 고른 기술을 습득하거나 강화한다. null이면 건너뛴다.
  choose(state, id){
    if(state.phase !== "reward" || (id !== null && !state.rewards.includes(id))) return false;
    if(id !== null){
      const previous = state.skillLevels[id] || 0;
      if(previous >= this.#maxLevel) return false;
      state.skillLevels[id] = previous + 1;
      this.#events.log(previous ? `${this.#cards[id].name} 강화 · Lv.${previous + 1}` : `기술 습득 · ${this.#cards[id].name}`, state);
    }else this.#events.log("전투 보상을 건너뛰었어요.", state);
    state.rewards = [];
    state.phase = "route";
    return true;
  }
}
