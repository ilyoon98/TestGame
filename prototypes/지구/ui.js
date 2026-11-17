/* =========================================================================
   HUD / UI
   - DOM 참조, 이벤트 연결, 화면 갱신 함수를 모아둔다.
   - 게임 로직(game.js)이나 충돌 시스템(collisions.js)이 상태를 바꾸면
     onProjectileLaunched / onProjectileResolved 콜백을 통해 이 파일이
     미션 로그 · 배너 · HUD 숫자를 갱신한다.
   ========================================================================= */

const currentDateDisplay = document.getElementById("currentDateDisplay");
const missionLogEl = document.getElementById("missionLog");
const targetSelect = document.getElementById("targetSelect");
const targetInfoPanel = document.getElementById("targetInfoPanel");

const launchAngleRange = document.getElementById("launchAngleRange");
const angleReadout = document.getElementById("angleReadout");
const launchSpeedRange = document.getElementById("launchSpeedRange");
const speedReadout = document.getElementById("speedReadout");
const estFlightTimeEl = document.getElementById("estFlightTime");
const estArrivalDateEl = document.getElementById("estArrivalDate");
const fireBtn = document.getElementById("fireBtn");

const timeSpeedGroup = document.getElementById("timeSpeedGroup");
const projectileCountEl = document.getElementById("projectileCount");

const stepSelect = document.getElementById("stepSelect");
const prevDateBtn = document.getElementById("prevDateBtn");
const nextDateBtn = document.getElementById("nextDateBtn");
const dateInput = document.getElementById("dateInput");
const todayBtn = document.getElementById("todayBtn");
const resetViewBtn = document.getElementById("resetViewBtn");
const plutoToggleBtn = document.getElementById("plutoToggleBtn");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");

const missionBanner = document.getElementById("missionBanner");
const tooltip = document.getElementById("tooltip");

function planetLabel(key) {
  const p = getPlanetByKey(key);
  return p ? p.name : key;
}

/* --------------------------- 날짜 표시 --------------------------- */

function syncDateUI() {
  currentDateDisplay.textContent = formatDateUTC(currentDate);
  dateInput.value = formatDateUTC(currentDate);
}

/* --------------------------- 미션 로그 / 배너 --------------------------- */

const MAX_LOG_ENTRIES = 40;
let bannerTimeout = null;

function addMissionLog(text, type) {
  const li = document.createElement("li");
  li.className = `log-${type}`;
  li.textContent = text;
  missionLogEl.prepend(li);
  while (missionLogEl.children.length > MAX_LOG_ENTRIES) {
    missionLogEl.removeChild(missionLogEl.lastChild);
  }
}

function flashBanner(text, type) {
  missionBanner.textContent = text;
  missionBanner.className = `banner-${type}`;
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => {
    missionBanner.className = "hidden";
  }, 1800);
}

function onProjectileLaunched(proj) {
  addMissionLog(
    `🚀 발사 · 목표 ${planetLabel(proj.targetPlanet)} · 각도 ${launchAngleDeg.toFixed(0)}° · 속도 ${proj.speed} · ${formatDateUTC(proj.launchDate)}`,
    "launch"
  );
  updateProjectileCountDisplay();
}

function onProjectileResolved(proj) {
  const dateStr = formatDateUTC(proj.resolvedDate);
  const flightDays = Math.round(proj.flightDays);

  if (proj.status === "hit_target") {
    addMissionLog(`✅ MISSION SUCCESS · ${planetLabel(proj.resolvedPlanet)} 명중 (비행 ${flightDays}일, ${dateStr})`, "success");
    flashBanner("MISSION SUCCESS", "success");
  } else if (proj.status === "wrong_target") {
    addMissionLog(
      `⚠ WRONG TARGET · ${planetLabel(proj.resolvedPlanet)}에 명중 (목표는 ${planetLabel(proj.targetPlanet)}, ${dateStr})`,
      "wrong"
    );
    flashBanner("WRONG TARGET", "wrong");
  } else if (proj.status === "lost_in_sun") {
    addMissionLog(`☀ PROJECTILE LOST · 태양에 흡수됨 (${dateStr})`, "lost");
    flashBanner("PROJECTILE LOST", "lost");
  } else if (proj.status === "escaped") {
    addMissionLog(`🛰 태양계 이탈 · 탄환 #${proj.id} (${dateStr})`, "escaped");
  }

  updateProjectileCountDisplay();
}

function updateProjectileCountDisplay() {
  const flying = activeProjectiles().length;
  projectileCountEl.textContent = `비행 중인 탄환: ${flying} (총 발사 ${projectiles.length})`;
}

/* --------------------------- TARGET / 탐지기 --------------------------- */

function populateTargetDropdown() {
  const prevValue = selectedTargetKey;
  targetSelect.innerHTML = "";
  activePlanets()
    .filter((p) => p.key !== EARTH_KEY)
    .forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.key;
      opt.textContent = p.name;
      targetSelect.appendChild(opt);
    });

  const stillValid = Array.from(targetSelect.options).some((o) => o.value === prevValue);
  selectedTargetKey = stillValid ? prevValue : targetSelect.options[0]?.value || "mars";
  targetSelect.value = selectedTargetKey;
}

targetSelect.addEventListener("change", () => {
  selectedTargetKey = targetSelect.value;
  updateTargetInfoPanel();
  updateEstimatedFlightTime();
});

function updateTargetInfoPanel() {
  const planet = getPlanetByKey(selectedTargetKey);
  if (!planet) return;
  const pos = planetWorldPosition(planet, currentDate);
  const angleDeg = (((pos.angleRad * 180) / Math.PI) % 360 + 360) % 360;
  const angularVel = 360 / planet.periodDays;
  const years = planet.periodDays / 365.256;

  targetInfoPanel.innerHTML = `
    <div class="info-row"><span>목표</span><b>${planet.name}</b></div>
    <div class="info-row"><span>현재 공전 각도</span><b>${angleDeg.toFixed(1)}°</b></div>
    <div class="info-row"><span>궤도 반지름</span><b>${pos.radius}px</b></div>
    <div class="info-row"><span>공전 주기</span><b>${years >= 1 ? years.toFixed(2) + "년" : planet.periodDays.toFixed(1) + "일"}</b></div>
    <div class="info-row"><span>각속도</span><b>${angularVel.toFixed(3)}°/일</b></div>
  `;
}

/* --------------------------- LAUNCH CONTROL --------------------------- */

launchAngleRange.addEventListener("input", () => {
  launchAngleDeg = Number(launchAngleRange.value);
  angleReadout.textContent = `${launchAngleDeg}°`;
  updateEstimatedFlightTime();
});

launchSpeedRange.addEventListener("input", () => {
  launchSpeed = Number(launchSpeedRange.value);
  speedReadout.textContent = `${launchSpeed}`;
  updateEstimatedFlightTime();
});

fireBtn.addEventListener("click", () => {
  fireProjectile();
});

// 스펙 8: 참고용 단순 예상치일 뿐, 실제 명중 위치를 계산해주지 않는다.
// "현재" 지구-목표 직선거리 / 탄속 으로만 추정한다.
function updateEstimatedFlightTime() {
  const target = getPlanetByKey(selectedTargetKey);
  if (!target) return;
  const earthPos = planetWorldPosition(EARTH_KEY, currentDate);
  const targetPos = planetWorldPosition(target, currentDate);
  const dist = Math.hypot(targetPos.x - earthPos.x, targetPos.y - earthPos.y);
  const days = dist / Math.max(1, launchSpeed);
  const arrival = new Date(currentDate.getTime() + days * MS_PER_DAY);

  estFlightTimeEl.textContent = `약 ${Math.round(days)}일`;
  estArrivalDateEl.textContent = formatDateUTC(arrival);
}

/* --------------------------- 시간 배속 --------------------------- */

timeSpeedGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".speedBtn");
  if (!btn) return;
  timeSpeedMultiplier = Number(btn.dataset.speed);
  Array.from(timeSpeedGroup.children).forEach((b) => b.classList.toggle("active", b === btn));
});

/* --------------------------- 디버그 / 샌드박스 --------------------------- */

function populateStepSelect() {
  const presetGroup = document.createElement("optgroup");
  presetGroup.label = "기본 간격";
  [
    { label: "1일", value: 1 },
    { label: "7일 (1주)", value: 7 },
    { label: "30일 (1개월)", value: 30 },
    { label: "365일 (1년)", value: 365 },
  ].forEach((preset) => {
    const opt = document.createElement("option");
    opt.value = preset.value;
    opt.textContent = preset.label;
    presetGroup.appendChild(opt);
  });
  stepSelect.appendChild(presetGroup);

  const planetGroup = document.createElement("optgroup");
  planetGroup.label = "행성 공전 주기";
  PLANETS.forEach((planet) => {
    const opt = document.createElement("option");
    opt.value = planet.periodDays;
    const years = planet.periodDays / 365.256;
    const periodLabel = years >= 1 ? `${years.toFixed(1)}년` : `${Math.round(planet.periodDays)}일`;
    opt.textContent = `${planet.name} (${periodLabel})`;
    planetGroup.appendChild(opt);
  });
  stepSelect.appendChild(planetGroup);
}

stepSelect.addEventListener("change", () => {
  dateStepDays = Number(stepSelect.value);
});

prevDateBtn.addEventListener("click", () => stepDate(-dateStepDays));
nextDateBtn.addEventListener("click", () => stepDate(dateStepDays));

dateInput.addEventListener("change", () => {
  if (!dateInput.value) return;
  const [y, m, d] = dateInput.value.split("-").map(Number);
  animateToDate(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
});

todayBtn.addEventListener("click", () => {
  const now = new Date();
  animateToDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)));
});

resetViewBtn.addEventListener("click", () => {
  viewScale = 1;
  viewOffsetX = 0;
  viewOffsetY = 0;
});

plutoToggleBtn.addEventListener("click", () => {
  plutoVisible = !plutoVisible;
  plutoToggleBtn.textContent = plutoVisible ? "명왕성 제거" : "명왕성 추가";
  populateTargetDropdown();
  updateTargetInfoPanel();
  updateEstimatedFlightTime();
});

zoomInBtn.addEventListener("click", () => setZoom(viewScale * 1.25));
zoomOutBtn.addEventListener("click", () => setZoom(viewScale / 1.25));

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") stepDate(dateStepDays);
  if (e.key === "ArrowLeft") stepDate(-dateStepDays);
  if (e.key === "ArrowUp") stepDate(dateStepDays * 10);
  if (e.key === "ArrowDown") stepDate(-dateStepDays * 10);
  if (e.key === " ") {
    e.preventDefault();
    const nextBtn = timeSpeedMultiplier > 0
      ? timeSpeedGroup.querySelector('[data-speed="0"]')
      : timeSpeedGroup.querySelector('[data-speed="1"]');
    nextBtn.click();
  }
});

/* --------------------------- 행성 hover 툴팁 --------------------------- */

function handleHover(clientX, clientY) {
  let hit = null;
  for (const p of lastPlanetScreenPositions) {
    const dx = clientX - p.x;
    const dy = clientY - p.y;
    if (Math.sqrt(dx * dx + dy * dy) <= Math.max(p.r + 4, 8)) {
      hit = p;
      break;
    }
  }
  if (!hit) {
    tooltip.classList.add("hidden");
    return;
  }
  const planet = hit.planet;
  const years = planet.periodDays / 365.256;
  tooltip.innerHTML = `
    <div class="t-name">${planet.name}</div>
    <div class="t-row">실제 거리: ${planet.au.toFixed(2)} AU (화면은 균등 간격)</div>
    <div class="t-row">공전 주기: ${years >= 1 ? years.toFixed(2) + "년" : planet.periodDays.toFixed(1) + "일"}</div>
  `;
  tooltip.style.left = clientX + "px";
  tooltip.style.top = clientY + "px";
  tooltip.classList.remove("hidden");
}

canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    tooltip.classList.add("hidden");
    return;
  }
  handleHover(e.clientX, e.clientY);
});

canvas.addEventListener("mouseleave", () => {
  tooltip.classList.add("hidden");
});
