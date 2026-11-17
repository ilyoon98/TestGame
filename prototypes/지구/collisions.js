/* =========================================================================
   Collision system
   - 탄환과 행성 중심 사이의 거리가 충돌 반경보다 작으면 충돌로 판정한다.
   - 시간 배속(x1000 등)이 높을 때 한 프레임에 며칠씩 건너뛰면 얇은 표적을
     그냥 통과해버릴 수 있다. 그래서 실제 충돌 판정은 프레임 단위가 아니라,
     game.js의 advanceSimulation()이 만들어내는 촘촘한 substep마다 호출된다.
   ========================================================================= */

const SUN_COLLISION_RADIUS = 26; // world px
const ESCAPE_RADIUS = orbitRadiusForIndex(PLANETS.length) * 1.4; // 명왕성 궤도 바깥 이 정도면 이탈로 간주

function planetCollisionRadius(planet) {
  return planet.visualR + 4; // world px, 약간의 여유를 둔 판정 반경
}

// date 시점 기준으로 모든 활성 탄환 vs 태양/행성 충돌을 검사하고,
// 충돌/이탈한 탄환은 active=false 처리 후 onProjectileResolved로 알린다.
function checkCollisionsAt(date) {
  const planets = activePlanets();

  for (const proj of projectiles) {
    if (!proj.active) continue;

    const pos = projectilePositionAt(proj, date);
    proj.x = pos.x;
    proj.y = pos.y;
    proj.flightDays = pos.days;

    const distFromSun = Math.hypot(pos.x, pos.y);

    if (distFromSun <= SUN_COLLISION_RADIUS) {
      resolveProjectile(proj, "lost_in_sun", null, date);
      continue;
    }

    if (distFromSun >= ESCAPE_RADIUS) {
      resolveProjectile(proj, "escaped", null, date);
      continue;
    }

    for (const planet of planets) {
      const planetPos = planetWorldPosition(planet, date);
      const dist = Math.hypot(pos.x - planetPos.x, pos.y - planetPos.y);
      const radius = planetCollisionRadius(planet);

      // 발사 직후 탄환은 발사 지점(지구) 반경 안에서 시작하므로, 그 반경을
      // 한 번이라도 벗어나기 전까지는 발사 지점과의 충돌을 판정하지 않는다.
      if (planet.key === proj.originPlanet && !proj.clearedOrigin) {
        if (dist > radius) proj.clearedOrigin = true;
        continue;
      }

      if (dist <= radius) {
        const outcome = planet.key === proj.targetPlanet ? "hit_target" : "wrong_target";
        resolveProjectile(proj, outcome, planet.key, date);
        break;
      }
    }
  }
}

function resolveProjectile(proj, status, planetKey, date) {
  proj.active = false;
  proj.status = status;
  proj.resolvedDate = new Date(date);
  proj.resolvedPlanet = planetKey;
  if (typeof onProjectileResolved === "function") {
    onProjectileResolved(proj);
  }
}
