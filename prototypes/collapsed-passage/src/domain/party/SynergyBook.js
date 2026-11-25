// 진영·직업 시너지. 같은 특성의 출전 대원이 기준 인원 이상이면 전투 동안 켜지고,
// 각 효과는 전투마다 정해진 열쇠(key)당 한 번만 쓴다.
export class SynergyBook {
  #traits;
  #threshold;

  constructor(traits, threshold){
    this.#traits = traits;
    this.#threshold = threshold;
  }

  // 출전 대원 목록에서 켜질 효과 id 목록.
  activeFor(members){
    const counts = new Map();
    for(const member of members){
      for(const id of new Set([...member.factions, ...member.jobs])) counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts].filter(([id, count]) => this.#traits[id].effect && count >= this.#threshold).map(([id]) => id);
  }

  // 상태를 바꾸지 않고 남은 보너스를 확인한다.
  available(id, battle, key = id){
    return battle?.traits?.has(id) && !battle.usedTraits.has(key) ? this.#traits[id].bonus : 0;
  }

  consume(id, battle, key = id){
    const bonus = this.available(id, battle, key);
    if(bonus) battle.usedTraits.add(key);
    return bonus;
  }
}
