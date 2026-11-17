/* =========================================================================
   Game state
   - 현재 날짜, 시간 배속, 발사 설정(목표/각도/속도)을 보관한다.
   - 시간이 흐를 때 "행성 위치 갱신"과 "탄환 위치 갱신 + 충돌 판정"이
     항상 같은 타임라인 위에서 함께 일어나도록 advanceSimulation()이 조율한다.
   ========================================================================= */

let currentDate = new Date(); // 시스템 현재 날짜에서 시작

// 시간 배속: 0(정지), 1, 10, 100, 1000 (1일/초 기준 배수)
let timeSpeedMultiplier = 0;

// 발사 설정
let selectedTargetKey = "mars";
let launchAngleDeg = 90;
let launchSpeed = 60; // world px / 일

let dateStepDays = 1; // 디버그 ◀▶ / 방향키 이동 간격(일)
let dateAnim = null;  // {fromMs, toMs, startTime, duration} — 디버그 날짜 이동용 트윈

function formatDateUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 디버그용 날짜 이동(방향키, ◀▶, 오늘, 날짜 직접 입력)에 사용. 즉시 순간이동하지
// 않고 목표 날짜까지 부드럽게 보간한다. 실제 게임 진행(시간 배속)과는 별개의 경로.
function animateToDate(targetDate) {
  const fromMs = currentDate.getTime();
  const toMs = targetDate.getTime();
  if (fromMs === toMs) return;
  const deltaDays = Math.abs(toMs - fromMs) / MS_PER_DAY;
  const duration = Math.min(2500, Math.max(400, 400 + Math.log10(1 + deltaDays) * 250));
  dateAnim = { fromMs, toMs, startTime: performance.now(), duration };
}

function stepDate(days) {
  const target = new Date(currentDate);
  target.setUTCDate(target.getUTCDate() + Math.round(days));
  animateToDate(target);
}

// 실제 시간이 dt만큼 흐를 때 행성/탄환을 같은 타임라인 위에서 전진시킨다.
// 시간 배속이 높으면 한 프레임에 며칠씩 건너뛸 수 있으므로, 탄환 속도에 맞춰
// substep으로 잘게 나눠 충돌 판정을 촘촘히 수행한다 (얇은 표적 통과 방지).
function advanceSimulation(deltaDays) {
  if (deltaDays <= 0) return;

  const speeds = activeProjectiles().map((p) => p.speed);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 1;
  const maxStepWorldDist = 6; // 한 substep에서 탄환이 이동할 수 있는 최대 world 거리
  let substeps = Math.ceil((deltaDays * maxSpeed) / maxStepWorldDist);
  substeps = Math.min(Math.max(substeps, 1), 300);

  const stepDays = deltaDays / substeps;
  const startMs = currentDate.getTime();

  for (let i = 1; i <= substeps; i++) {
    const stepDate = new Date(startMs + stepDays * i * MS_PER_DAY);
    currentDate = stepDate;
    checkCollisionsAt(stepDate);
  }
}

function fireProjectile() {
  const earth = getPlanetByKey(EARTH_KEY);
  const earthPos = planetWorldPosition(earth, currentDate);
  const angleRad = (launchAngleDeg * Math.PI) / 180;

  const proj = createProjectile({
    launchDate: currentDate,
    startX: earthPos.x,
    startY: earthPos.y,
    velocityX: launchSpeed * Math.cos(angleRad),
    velocityY: launchSpeed * Math.sin(angleRad),
    speed: launchSpeed,
    targetPlanet: selectedTargetKey,
  });

  if (typeof onProjectileLaunched === "function") onProjectileLaunched(proj);
  return proj;
}
