// 적 정의와 전투 시간 상수
// 호출할 때마다 새 객체를 만든다. 판마다 값을 바꿔 시험하는 QA 도구가 서로 영향을 주지 않게 하기 위해서다.
export function createFoeData(){
  const foes = {
    janitor:{name:"탈옥한 죄수", hp:[8,4,5,6,4,5], vitality:8, armor:{head:2},
      patterns:[ [["heavy","legs"],["guard","chest"]], [["aim","arms"],["guard","head"]], [["heavy","chest"],["counter","head"]] ]},
    crawler:{name:"기어오는 탈옥수", hp:[7,4,4,5,4,4], vitality:10, armor:{head:1},
      patterns:[ [["aim","arms"],["guard","eyes"]], [["heavy","legs"]], [["split","head","arms"],["strike","eyes"]] ]},
    medic:{name:"붕대를 감은 탈옥수", hp:[7,4,4,6,4,4], vitality:11, armor:{head:1},
      patterns:[ [["break","chest"],["strike","belly"]], [["aid"],["aim","chest"],["guard","head"]], [["heavy","arms"]] ]},
    sentinel:{name:"방패를 든 탈옥수", hp:[9,5,5,6,4,5], vitality:12, armor:{head:3},
      patterns:[ [["guard","head"],["aim","eyes"]], [["heavy","chest"]], [["split","head","eyes"],["strike","arms"]] ]},
    bellboy:{name:"뒤틀린 벨보이", hp:[21,5,5,7,5,5], vitality:23, armor:{head:2},
      patterns:[ [["heavy","chest"]] ]}
  };

  const battleTiming={
    tick:100,
    pursuit:3000,
    enemyInterval:3500
  };
  const bellboyTiming={windup:2000,damageBonus:2};
  return {foes, battleTiming, bellboyTiming};
}
