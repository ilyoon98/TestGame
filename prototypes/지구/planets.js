/* =========================================================================
   Planet simulation
   - 각 행성은 "평균 공전"만 사용하는 단순 원궤도 모델입니다 (이심률 무시).
   - J2000.0 (2000-01-01 12:00 UTC) 기준 평균 황경(L0)과 공전 주기(일)로
     임의의 날짜에서의 궤도상 각도를 계산합니다.
     angle(deg) = L0 + 360 * (daysSinceJ2000 / periodDays)
   - world 좌표계는 태양을 원점(0,0)으로 하고, 화면 확대율(viewScale)이 1일 때
     스크린 픽셀과 정확히 일치하도록 정의합니다. 탄환 속도(px/일) 등 게임의
     모든 물리량은 이 world 좌표계 단위를 그대로 사용합니다.
   ========================================================================= */

const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
const MS_PER_DAY = 86400000;

const PLANETS = [
  { key: "mercury", name: "수성",   color: "#b1adad", radiusKm: 2439,  au: 0.387, periodDays: 87.969,   L0: 252.25, visualR: 4  },
  { key: "venus",   name: "금성",   color: "#e8c39e", radiusKm: 6052,  au: 0.723, periodDays: 224.701,  L0: 181.98, visualR: 7  },
  { key: "earth",   name: "지구",   color: "#4f83cc", radiusKm: 6371,  au: 1.000, periodDays: 365.256,  L0: 100.47, visualR: 7.5},
  { key: "mars",    name: "화성",   color: "#c1440e", radiusKm: 3390,  au: 1.524, periodDays: 686.980,  L0: 355.43, visualR: 5  },
  { key: "jupiter", name: "목성",   color: "#d8ca9d", radiusKm: 69911, au: 5.203, periodDays: 4332.589, L0: 34.35,  visualR: 16 },
  { key: "saturn",  name: "토성",   color: "#e3cf9d", radiusKm: 58232, au: 9.537, periodDays: 10759.22, L0: 50.08,  visualR: 14, ring: true },
  { key: "uranus",  name: "천왕성", color: "#b0e0e6", radiusKm: 25362, au: 19.191,periodDays: 30688.5,  L0: 314.20, visualR: 10 },
  { key: "neptune", name: "해왕성", color: "#4166f5", radiusKm: 24622, au: 30.069,periodDays: 60182,    L0: 304.22, visualR: 10 },
  { key: "pluto",   name: "명왕성", color: "#c9b29b", radiusKm: 1188,  au: 39.482,periodDays: 90560,    L0: 238.93, visualR: 3  },
];

const EARTH_KEY = "earth";

// 실제 AU 비율로 그리면 수금지화가 태양 근처에 겹쳐 보이지 않으므로,
// 궤도 간격은 실제 거리 대신 "행성 순서" 기준 균등 간격으로 표시한다.
const ORBIT_BASE_PX = 70;     // 첫 번째 궤도(수성) 반지름
const ORBIT_SPACING_PX = 55;  // 궤도 간 간격

function orbitRadiusForIndex(index) {
  return ORBIT_BASE_PX + index * ORBIT_SPACING_PX;
}

function daysSinceJ2000(date) {
  return (date.getTime() - J2000) / MS_PER_DAY;
}

function orbitAngleRad(planet, date) {
  const days = daysSinceJ2000(date);
  const deg = planet.L0 + 360 * (days / planet.periodDays);
  return (deg % 360) * (Math.PI / 180);
}

let plutoVisible = true; // false면 렌더링·탐지·충돌·정렬 모두에서 명왕성을 제외한다.

function activePlanets() {
  return plutoVisible ? PLANETS : PLANETS.filter((p) => p.key !== "pluto");
}

function getPlanetByKey(key) {
  return PLANETS.find((p) => p.key === key) || null;
}

function getPlanetIndex(planet) {
  return PLANETS.indexOf(planet);
}

// 태양을 원점으로 하는 world 좌표(px, 확대율 1 기준 스크린 px와 동일 단위).
function planetWorldPosition(planetOrKey, date) {
  const planet = typeof planetOrKey === "string" ? getPlanetByKey(planetOrKey) : planetOrKey;
  const index = getPlanetIndex(planet);
  const radius = orbitRadiusForIndex(index);
  const angleRad = orbitAngleRad(planet, date);
  return {
    x: radius * Math.cos(angleRad),
    y: radius * Math.sin(angleRad),
    angleRad,
    radius,
  };
}
