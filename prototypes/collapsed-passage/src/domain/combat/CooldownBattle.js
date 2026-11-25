// 쿨타임 자동 전투의 규칙. 시간은 tick 단위로 흐르고, 충전된 기술부터 발동한다.
// 동시에 준비되면 준비 시각, 공격 이외의 기술, 긴 충전 시간, 카드 ID 순으로 정한다.
// 추격은 전투 시간 pursuit마다 도망 여유를 1 줄인다.
//
// 전투 상태는 state.cooldownBattle에 둔다(화면과 QA 도구가 읽는다).
// seams의 함수(readyTimedSkill, executePartySkill, applyCard)는 QA 도구가 옛 규칙으로 바꿔 끼우는 교체 지점이다.
export class CooldownBattle {
  #cards;
  #foes;
  #timing;
  #synergies;
  #events;
  #loadout;
  #effects;
  #planner;
  #journey;
  #seams;

  // journey()는 서로 참조하는 객체라 함수로 받는다.
  constructor({cards, foes, timing, synergies, events, loadout, effects, planner, journey, seams}){
    this.#cards = cards;
    this.#foes = foes;
    this.#timing = timing;
    this.#synergies = synergies;
    this.#events = events;
    this.#loadout = loadout;
    this.#effects = effects;
    this.#planner = planner;
    this.#journey = journey;
    this.#seams = seams;
  }

  start(state, sides){
    const loadout = this.#loadout;
    const skills = sides.flatMap(side => loadout.of(state, side).map(id => {
      const cooldown = loadout.cooldown(state, id);
      return {id, side, cooldown, readyAt: cooldown};
    }));
    const activeTraits = state.synergiesEnabled ? this.#synergies.activeFor(sides.map(side => state[side])) : [];
    state.cooldownBattle = {elapsed: 0, skills, traits: new Set(activeTraits), usedTraits: new Set(),
      tactics: {selfHealed: new Set(), blocked: new Set(), aim: new Map()},
      enemySkills: state.foe.patterns.flat(), enemyIndex: 0,
      enemyReadyAt: state.trainingEnemyActs ? this.#timing.enemyInterval : Infinity};
    if(state.foe === this.#foes.bellboy) state.cooldownBattle.bellboyStaggered = false;
  }

  // 지금 발동할 기술. 없으면 undefined.
  readySkill(state, battle){
    const cards = this.#cards;
    const ready = battle.skills.filter(skill => skill.readyAt <= battle.elapsed &&
      !this.#loadout.blocked(state, skill) && this.#effects.ready(state, skill));
    // 칸 순서는 표시에만 쓴다. 마지막 비교는 로캘과 무관하게 한다.
    return ready.sort((a, b) => a.readyAt - b.readyAt ||
      Number(cards[a.id].type === "attack") - Number(cards[b.id].type === "attack") ||
      b.cooldown - a.cooldown || Number(a.id > b.id) - Number(a.id < b.id))[0];
  }

  // 다음 진행까지 기다릴 시간(ms). 바로 할 행동이 있으면 0.
  nextDelay(state){
    const battle = state.cooldownBattle;
    return this.#seams.readyTimedSkill(state, battle) || battle.elapsed >= battle.enemyReadyAt ? 0 : this.#timing.tick;
  }

  // 한 걸음 진행한다. 시간만 흘렀으면 {clockOnly:true}, 기술이나 적 행동이 있었으면 그 id와 주체.
  advance(state){
    if(state.phase !== "combat") return null;
    const seams = this.#seams, timing = this.#timing;
    const battle = state.cooldownBattle;
    if(state.enemy.reviveIfHeadLost()) delete battle.tactics.strippedPart;
    let skill = seams.readyTimedSkill(state, battle);
    if(!skill && battle.elapsed < battle.enemyReadyAt){
      battle.elapsed += timing.tick;
      state.combatTime += timing.tick;
      if(!state.training && battle.elapsed % timing.pursuit === 0){
        state.distance--;
        this.#events.log("전투 시간 경과 · 도망 여유 −1", state);
        this.#journey().finishCombat(state);
        return {clockOnly: true};
      }
      skill = seams.readyTimedSkill(state, battle);
    }
    if(skill){
      skill.readyAt = battle.elapsed + skill.cooldown;
      seams.executePartySkill(state, skill);
      this.#journey().finishCombat(state);
      return {id: skill.id, actor: skill.side};
    }
    if(battle.elapsed >= battle.enemyReadyAt) return this.#enemyTurn(state, battle);
    return {clockOnly: true};
  }

  #enemyTurn(state, battle){
    const action = this.#planner.intent(state)[0];
    const defender = state[action.side || "player"];
    if(action.intercept) delete battle.tactics.intercept;
    state.enemyAction = 0;
    // 벨보이는 강타 직후 기절해 철문이 열린다.
    const opensGate = battle.bellboyStaggered !== undefined;
    const feedbackStart = state.feedback.length;
    if(opensGate) battle.bellboyStaggered = true;
    battle.enemyReadyAt += this.#timing.enemyInterval;
    this.#seams.applyCard(state, action.id, state.enemy, defender, action.targets);
    if(opensGate && state.feedback[feedbackStart]) state.feedback[feedbackStart].opensGate = true;
    state.enemyAction = null;
    battle.enemyIndex = (battle.enemyIndex + 1) % battle.enemySkills.length;
    this.#journey().finishCombat(state);
    return {id: action.id, actor: "enemy", keepIntent: true};
  }
}
