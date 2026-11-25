import {createBodyData} from "./body.js";
import {createCardData} from "./cards.js";
import {createRosterData} from "./roster.js";
import {createWorldData} from "./world.js";
import {createFoeData} from "./foes.js";

// 한 판에서 쓰는 선언형 데이터 전체. 판마다 새로 만든다.
export function createGameData(){
  return {...createBodyData(), ...createCardData(), ...createRosterData(), ...createWorldData(), ...createFoeData()};
}
