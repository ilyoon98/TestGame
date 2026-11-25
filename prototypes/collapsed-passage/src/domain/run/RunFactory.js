// 새 판의 지도와 초기 상태를 만든다. 기본 지도 또는 시드 지도에서 격리문 전투 준비로 시작한다.
// QA 훈련장은 특수 방과 출구가 없는 시드 지도에서 모든 동료와 모든 보상 기술을 가진 채 시작한다.
export class RunFactory {
  #starterSkills;
  #rewardPool;
  #companionSides;
  #companionTypes;
  #standardAreas;
  #mapGenerator;
  #fighters;
  #recruitment;
  #events;

  constructor({starterSkills, rewardPool, companionSides, companionTypes, standardAreas, mapGenerator, fighters, recruitment, events}){
    this.#starterSkills = starterSkills;
    this.#rewardPool = rewardPool;
    this.#companionSides = companionSides;
    this.#companionTypes = companionTypes;
    this.#standardAreas = standardAreas;
    this.#mapGenerator = mapGenerator;
    this.#fighters = fighters;
    this.#recruitment = recruitment;
    this.#events = events;
  }

  map(mapConfig){
    const training = Boolean(mapConfig?.training);
    if(!mapConfig) return this.#standardAreas;
    const areas = this.#mapGenerator.generate(training ? {...mapConfig, shops: 0, rests: 0, elites: 0, mysteries: 0} : mapConfig);
    if(training){
      delete areas.exit;
      areas.lift.next = [];
    }
    return areas;
  }

  create(mapConfig, rewardSeed){
    const training = Boolean(mapConfig?.training);
    const starters = this.#starterSkills;
    const state = {phase: "prep", area: "threshold", trail: ["threshold"], distance: 5, steps: 0, combatTime: 0, mapConfig, rewardSeed, coins: 0,
      shopPurchases: new Map(), shopSelections: new Map(), lanternOil: false, lockpicks: false, mysteryResult: null,
      player: this.#fighters.nun(),
      ...Object.fromEntries(this.#companionSides.map(side => [side, null])),
      pendingCompanion: null, recruitQueue: [], pendingVictoryReward: false, metCompanions: new Set(), deadCompanions: [],
      synergiesEnabled: true, training, trainingFormation: null, trainingEnemyActs: true, trainingEnemyDamage: 1,
      formation: ["player", null, null], prepSide: "player",
      skillLevels: Object.fromEntries(starters.map(id => [id, 1])), loadout: [...starters], rewards: [], log: [], feedback: [],
      enemy: null, enemyAction: null, stairTreatment: null, restFinished: false, lossCause: null, qaUses: 0};
    if(training){
      for(const [index, kind] of Object.keys(this.#companionTypes).entries()){
        state[this.#companionSides[index]] = this.#recruitment.makeCompanion(kind);
      }
      state.formation = ["player", "companion4", "companion3"];
      for(const id of this.#rewardPool) state.skillLevels[id] = 1;
      this.#events.log("QA 훈련장 · 적 체력 ∞", state);
    }else{
      this.#events.log("폭동 경보. 사형수가 뒤쫓는다.", state);
    }
    return state;
  }
}
