// 대원 종류, 진영·직업 특성, 대열 칸
// 호출할 때마다 새 객체를 만든다. 판마다 값을 바꿔 시험하는 QA 도구가 서로 영향을 주지 않게 하기 위해서다.
export function createRosterData(){
  const formationRanks=["전위","중위","후위"];
  const companionSides=["companion","companion2","companion3","companion4"];
  const companionSkillSlots=2;
  const traits={
    nun:{name:"수녀",icon:"nunLantern",group:"faction"},
    guard:{name:"간수",icon:"guardCrest",group:"faction",effect:"맨 앞 대원에게 처음 주는 가드 +2",bonus:2},
    prisoner:{name:"수감자",icon:"brokenShackle",group:"faction",effect:"수감자가 처음 가드를 깎으면 같은 부위에 피해 +1",bonus:1},
    neutral:{name:"중립",icon:"routeMystery",group:"faction"},
    warrior:{name:"전사",icon:"routeBattle",group:"job",effect:"전사마다 첫 부상 부위 적중 시 피해 +1",bonus:1},
    mage:{name:"마법사",icon:"skill",group:"job",effect:"마법사의 첫 회복량 +1",bonus:1},
    archer:{name:"궁수",icon:"traitBow",group:"job"}
  };
  const traitThreshold=2;
  const nunType={name:"수녀",factions:["nun"],jobs:["mage"],weapon:"mace",health:[9,5,7,7,6,7],vitality:28};
  const companionTypes = {
    guard:{name:"탈출 중인 간수", factions:["guard"],jobs:["warrior"],weapon:"baton", health:[8,5,7,7,6,7], vitality:20, hurtArm:3},
    awakened:{name:"개화한 수감자", factions:["prisoner"],jobs:["warrior"],weapon:"chains", health:[8,5,7,6,6,7], vitality:18, hurtArm:3},
    archer:{name:"감시탑 궁수", factions:["guard"],jobs:["archer"],weapon:"bow",health:[7,5,6,6,5,7],vitality:16,preferredRank:2},
    shaman:{name:"탈옥한 주술사", factions:["prisoner"],jobs:["mage"],weapon:"staff",health:[7,5,6,6,6,6],vitality:16}
  };

  return {formationRanks, companionSides, companionSkillSlots, traits, traitThreshold, nunType, companionTypes};
}
