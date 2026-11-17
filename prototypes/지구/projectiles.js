/* =========================================================================
   Projectile simulation
   - 탄환은 중력의 영향을 받지 않고, 발사 순간의 방향·속도로 직선 등속 운동한다.
   - 위치는 매 프레임 누적시키지 않고, 발사 시점으로부터 경과한 날짜 수를 이용해
     항상 정확한 값을 다시 계산한다(analytic). 그래서 오차가 누적되지 않는다.
   - 명중/이탈해도 배열에서 제거하지 않는다. active 플래그만 false로 바뀐다.
   ========================================================================= */

const PROJECTILE_TRAIL_DAYS = 14; // 렌더링용 꼬리 길이(며칠 치 이동 거리로 표현)

let projectiles = [];
let nextProjectileId = 1;

function createProjectile({ launchDate, startX, startY, velocityX, velocityY, speed, targetPlanet, originPlanet }) {
  const proj = {
    id: nextProjectileId++,
    launchDate: new Date(launchDate),
    startX,
    startY,
    x: startX,
    y: startY,
    velocityX,
    velocityY,
    speed,
    targetPlanet,
    originPlanet: originPlanet || EARTH_KEY,
    clearedOrigin: false, // 발사 지점(지구) 충돌 반경을 한 번이라도 벗어나기 전까지는 자기 충돌로 보지 않는다
    active: true,
    status: "flying", // flying | hit_target | wrong_target | lost_in_sun | escaped
    flightDays: 0,
    resolvedDate: null,
    resolvedPlanet: null,
  };
  projectiles.push(proj);
  return proj;
}

// 발사 이후 경과 일수만으로 world 좌표를 계산한다 (등속 직선 운동, 가속 없음).
function projectilePositionAt(proj, date) {
  const days = (date.getTime() - proj.launchDate.getTime()) / MS_PER_DAY;
  return {
    x: proj.startX + proj.velocityX * days,
    y: proj.startY + proj.velocityY * days,
    days,
  };
}

function activeProjectiles() {
  return projectiles.filter((p) => p.active);
}
