// 적의 다음 행동을 고른다. 각 적은 패턴을 차례로 시도하고, 쓸 수 없는 행동은 바꾸거나 건너뛴다.
// 일반 공격은 맨 앞 대원을, 정밀 타격(aim)은 맨 뒤 대원을 노린다.
export class EnemyPlanner {
  #cards;
  #party;

  constructor({cards, party}){
    this.#cards = cards;
    this.#party = party;
  }

  // 내구도와 가드 합이 가장 낮은 부위.
  static weakest(actor, permitted){
    return [...permitted].sort((a, b) => {
      const x = actor.body[a], y = actor.body[b];
      return x.hp + x.guard - (y.hp + y.guard);
    })[0];
  }

  // 노린 부위가 결손이면 가슴, 가슴도 없으면 머리를 친다.
  static attackTarget(target, active){
    if(active.includes(target)) return target;
    return active.includes("chest") ? "chest" : "head";
  }

  attackSide(id, state){
    const sides = this.#party.sides(state);
    return (id === "aim" ? sides.at(-1) : sides[0]) || "player";
  }

  plan(state){
    const battle = state.cooldownBattle, enemy = state.enemy;
    const [id, target, second] = battle.enemySkills[battle.enemyIndex];
    if(id === "aid"){
      const wound = enemy.receivableHealing() ? EnemyPlanner.weakest(enemy, enemy.woundedParts().map(([part]) => part)) : null;
      return wound ? {id: "aid", targets: [wound]} : {id: "guard", targets: ["head"]};
    }
    return {id, side: this.attackSide(id, state), targets: second ? [target, second] : [target]};
  }

  // 현재 상태에서 실제로 할 행동. 할 수 없으면 null.
  resolve(action, state){
    const cards = this.#cards;
    const card = cards[action.id];
    const actor = state.enemy;
    if(action.id === "aid"){
      const {hp, max} = actor.body[action.targets[0]];
      if(!actor.receivableHealing() || !hp || hp === max) return null;
    }
    let id = action.id;
    let targets = [...action.targets];
    if(card.part && actor.condition(card.part) === "lost"){
      id = card.type === "attack" ? "strike" : card.type === "defense" ? "guard" : null;
      if(!id) return null;
      targets = targets.slice(0, 1);
    }
    if(cards[id].type === "defense"){
      targets = targets.filter(target => actor.condition(target) !== "lost");
      if(id === "split" && targets.length === 1) id = "guard";
      if(!targets.length) return null;
    }
    if(cards[id].type === "attack"){
      const sides = this.#party.sides(state);
      const side = sides.includes(action.side) ? action.side : this.attackSide(id, state);
      const target = EnemyPlanner.attackTarget(targets[0], state[side].intactParts());
      const intercept = state.cooldownBattle?.tactics?.intercept;
      if(id === "aim" && intercept && sides.includes(intercept) &&
        state.formation.indexOf(intercept) < state.formation.indexOf(side) && state[intercept].body[target].hp){
        return {id, side: intercept, targets: [target], intercept: true};
      }
      return {id, side, targets: [target]};
    }
    return {id, targets};
  }

  // 화면에 예고하고 다음 차례에 실행할 행동. 계획한 행동을 못 하면 가슴 기본 공격.
  intent(state){
    if(!state.cooldownBattle || !state.trainingEnemyActs) return [];
    const action = this.resolve(this.plan(state), state) || this.resolve({id: "strike", targets: ["chest"]}, state);
    return [{...action, planIndex: 0}];
  }
}
