// 일반 스크립트인 legacy.js(화면과 예전 전역 API)가 모듈을 쓰는 통로다.
// 브라우저에서는 main.js가, Node에서는 tests/helpers/game-engine.mjs가 globalThis.CP로 넣는다.
import {createGameData} from "./data/index.js";
import {createArtData} from "./presentation/artData.js";
import {seededRandom, shuffle} from "./domain/random.js";
import {resolveHitDamage} from "./domain/combat/resolveHitDamage.js";
import {WoundedHitModifier, MarkModifier} from "./domain/combat/hitModifiers.js";
import {cardPower, attackDamage} from "./domain/cards/cardMath.js";
import {EnemyPlanner} from "./domain/combat/EnemyPlanner.js";
import {Loadout} from "./domain/party/Loadout.js";
import {createGameServices} from "./application/createGameServices.js";
import {AutoBattleRunner} from "./application/AutoBattleRunner.js";
import {TimeoutScheduler} from "./infrastructure/TimeoutScheduler.js";

export const CP = Object.freeze({
  createGameData, createArtData, createGameServices, seededRandom, shuffle, resolveHitDamage,
  WoundedHitModifier, MarkModifier, cardPower, attackDamage, EnemyPlanner, Loadout,
  AutoBattleRunner, TimeoutScheduler,
});
