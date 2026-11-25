// 기본 지도, 암시장 상품, ? 방 사건
// 호출할 때마다 새 객체를 만든다. 판마다 값을 바꿔 시험하는 QA 도구가 서로 영향을 주지 않게 하기 위해서다.
export function createWorldData(){
  const standardAreas = {
    threshold:{name:"격리문", foe:"janitor", companion:"guard", col:1, row:2, next:["duct","infirmary","corridor"]},
    duct:{name:"환기 통로", arena:"ventilation", foe:"crawler", companion:"archer", col:2, row:1, detail:"기어오는 탈옥수가 팔을 노려요.", next:["lift"]},
    infirmary:{name:"의무실", arena:"infirmary", foe:"medic", companions:["awakened","shaman"], col:2, row:2, detail:"붕대를 감은 탈옥수는 부상 부위를 치료해요.", next:["lift"]},
    corridor:{name:"정비 계단", type:"rest", col:2, row:3, detail:"전투 없이 들어가 한 부위를 치료할 수 있어요.", next:["landing"]},
    landing:{name:"계단참", arena:"landing", foe:"sentinel", companion:"archer", col:3, row:3, detail:"방패를 든 탈옥수가 머리를 단단히 지켜요.", next:["lift"]},
    lift:{name:"승강기실", arena:"lift", type:"boss", foe:"bellboy", col:4, row:2, next:["exit"]},
    exit:{name:"지상 출구", col:5, row:2, detail:"던전 밖으로 나가요."}
  };
  const shopOffers={
    shortcut:{name:"뒷길 정보",price:1,amount:2,effect:"도망 여유 +2",art:"art/locations/shortcut.webp"},
    bandage:{name:"붕대 묶음",price:1,amount:3,effect:"한 부위 내구도 최대 +3",art:"art/locations/stock/bandage.webp"},
    tonic:{name:"회복 약병",price:2,amount:6,effect:"한 대원 체력 최대 +6",art:"art/locations/stock/tonic.webp"},
    oil:{name:"등불 기름",price:2,amount:3,effect:"다음 전투 전위 가드 +3",art:"art/locations/stock/oil.webp"},
    lockpicks:{name:"자물쇠 따개",price:1,effect:"물자함 도망 여유 소모 면제",art:"art/locations/stock/lockpicks.webp"}
  };
  const mysteryEvents={
    cache:{name:"잠긴 물자함",description:"안에서 동전 소리가 난다.",action:"자물쇠 열기",distance:-1,coins:2,
      art:"art/locations/mystery-cache.webp",alt:"수녀가 등불을 들어 물자함의 자물쇠를 살핀다."},
    drain:{name:"배수로 입구",description:"대가를 내면 지름길을 알려주겠다고 한다.",action:"길 묻기",distance:3,coins:-1,
      art:"art/locations/mystery-drain.webp",alt:"수녀가 등불로 물이 흐르는 배수로 입구를 비춘다."}
  };

  return {standardAreas, shopOffers, mysteryEvents};
}
