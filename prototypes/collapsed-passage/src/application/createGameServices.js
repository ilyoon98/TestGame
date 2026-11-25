import {FighterFactory} from "../domain/actors/FighterFactory.js";
import {StateEventSink} from "../domain/events/StateEventSink.js";
import {SynergyBook} from "../domain/party/SynergyBook.js";
import {Party} from "../domain/party/Party.js";
import {Loadout} from "../domain/party/Loadout.js";
import {DamageCalculator} from "../domain/combat/DamageCalculator.js";
import {HitResolver} from "../domain/combat/HitResolver.js";
import {createHitModifiers} from "../domain/combat/hitModifiers.js";
import {CardRegistry} from "../domain/cards/CardRegistry.js";
import {EnemyPlanner} from "../domain/combat/EnemyPlanner.js";
import {TargetSelector} from "../domain/combat/TargetSelector.js";
import {CooldownBattle} from "../domain/combat/CooldownBattle.js";
import {MapGenerator} from "../domain/map/MapGenerator.js";
import {Recruitment} from "../domain/run/Recruitment.js";
import {RewardDraft} from "../domain/run/RewardDraft.js";
import {Journey} from "../domain/run/Journey.js";
import {BlackMarket} from "../domain/run/BlackMarket.js";
import {RunFactory} from "../domain/run/RunFactory.js";

// 게임 규칙 객체를 만들고 서로 연결한다. 규칙 객체를 new로 만드는 곳은 여기뿐이다.
//
// data   createGameData()의 결과
// areas  현재 지도를 돌려주는 함수
// hooks  {fightPrepared(state)} 화면 준비 알림
// seams  QA 도구가 옛 규칙으로 바꿔 끼우는 교체 지점. 생략하면 현재 규칙을 쓴다.
//        {timedAttackTarget(state, id, actor, excluded, index, prepared), readyTimedSkill(state, battle),
//         executePartySkill(state, skill), applyCard(state, id, actor, opponent, targets, recipient, amount),
//         skillRewardOptions(state)}
export function createGameServices(data, {areas, hooks = {}, seams: overrides = {}} = {}){
  const services = {};
  const seams = {
    timedAttackTarget: (state, ...args) => services.targets.timedAttackTarget(state, ...args),
    readyTimedSkill: (state, battle) => services.battle.readySkill(state, battle),
    executePartySkill: (state, skill) => services.cards.activate(state, skill),
    applyCard: (state, ...args) => services.cards.apply(state, ...args),
    skillRewardOptions: state => services.rewards.options(state),
    ...overrides,
  };
  const events = new StateEventSink();
  const fighters = new FighterFactory(data);
  const party = new Party(data);
  const synergies = new SynergyBook(data.traits, data.traitThreshold);
  const sideOf = (actor, state) => party.sideOf(actor, state);
  const calculator = new DamageCalculator({cards: data.cards, modifiers: createHitModifiers({synergies, sideOf}), sideOf});
  const hits = new HitResolver({...data, calculator, sideOf, events});
  const targets = () => services.targets;
  const cards = new CardRegistry({cards: data.cards, parts: data.parts, synergies, events, party, hits, targets, seams});
  const planner = new EnemyPlanner({cards: data.cards, party});
  const loadout = new Loadout({...data, party, targets});
  const recruitment = new Recruitment({...data, party, loadout, fighters, events, seams});
  const journey = new Journey({...data, areas, party, recruitment, fighters, events, hooks});
  const mapGenerator = new MapGenerator(data);
  Object.assign(services, {
    events, fighters, party, synergies, calculator, hits, cards, planner, loadout, recruitment, journey, mapGenerator,
    targets: new TargetSelector({cards: data.cards, calculator, attack: () => cards.attack, party, planner: () => planner}),
    battle: new CooldownBattle({cards: data.cards, foes: data.foes, timing: data.battleTiming, synergies, events,
      loadout, effects: cards, planner, journey: () => journey, seams}),
    rewards: new RewardDraft({...data, party, loadout, events}),
    market: new BlackMarket({...data, party, areas, events}),
    runs: new RunFactory({...data, mapGenerator, fighters, recruitment, events}),
  });
  return services;
}
