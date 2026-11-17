/* =========================================================================
   Rendering
   - 캔버스, 카메라(줌/패닝), world <-> screen 좌표 변환, 실제 그리기를 담당한다.
   - world 좌표계는 태양이 원점이고 viewScale=1일 때 스크린 px와 동일하다.
   ========================================================================= */

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let dpr = Math.max(1, window.devicePixelRatio || 1);
let viewScale = 1;   // 줌 배율
let viewOffsetX = 0; // 패닝 (스크린 px)
let viewOffsetY = 0;

let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let dragOffsetStartX = 0, dragOffsetStartY = 0;

let stars = [];

// 행성 hover 판정을 위해 매 프레임 화면 좌표를 기록해둔다.
let lastPlanetScreenPositions = []; // {planet, x, y, r}

function resizeCanvas() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildStarfield();
}

function buildStarfield() {
  const count = Math.floor((window.innerWidth * window.innerHeight) / 4000);
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.6 + 0.2,
    });
  }
}

function worldCenter() {
  return {
    x: window.innerWidth / 2 + viewOffsetX,
    y: window.innerHeight / 2 + viewOffsetY,
  };
}

function worldToScreen(wx, wy) {
  const c = worldCenter();
  return { x: c.x + wx * viewScale, y: c.y + wy * viewScale };
}

function screenToWorld(sx, sy) {
  const c = worldCenter();
  return { x: (sx - c.x) / viewScale, y: (sy - c.y) / viewScale };
}

function setZoom(next) {
  viewScale = Math.min(6, Math.max(0.15, next));
}

/* ---------------------------- 카메라 입력 ---------------------------- */

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    // 스크롤 다운 = 축소, 스크롤 업 = 확대. 커서 위치를 기준점으로 확대/축소한다.
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldBefore = screenToWorld(mouseX, mouseY);

    const zoomFactor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
    setZoom(viewScale * zoomFactor);

    viewOffsetX = mouseX - window.innerWidth / 2 - worldBefore.x * viewScale;
    viewOffsetY = mouseY - window.innerHeight / 2 - worldBefore.y * viewScale;
  },
  { passive: false }
);

canvas.addEventListener("mousedown", (e) => {
  isDragging = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOffsetStartX = viewOffsetX;
  dragOffsetStartY = viewOffsetY;

  const onMove = (ev) => {
    const dx = ev.clientX - dragStartX;
    const dy = ev.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
    if (isDragging) {
      viewOffsetX = dragOffsetStartX + dx;
      viewOffsetY = dragOffsetStartY + dy;
      canvas.classList.add("dragging");
    }
  };
  const onUp = () => {
    canvas.classList.remove("dragging");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

window.addEventListener("resize", resizeCanvas);

/* ------------------------------ 그리기 ------------------------------ */

function drawStarfield() {
  ctx.save();
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(cx, cy) {
  const r = 22 * Math.max(0.6, Math.min(1.6, viewScale));
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
  gradient.addColorStop(0, "rgba(255, 244, 200, 1)");
  gradient.addColorStop(0.25, "rgba(255, 200, 80, 0.9)");
  gradient.addColorStop(1, "rgba(255, 160, 40, 0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff2b0";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOrbit(cx, cy, radiusPx) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.setLineDash([2, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlanet(planet, x, y, r) {
  ctx.save();

  if (planet.ring) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "rgba(227, 207, 157, 0.7)";
    ctx.lineWidth = Math.max(1.5, r * 0.28);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.0, r * 0.75, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = planet.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();

  if (viewScale > 0.35) {
    ctx.save();
    ctx.font = "11px 'Segoe UI', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "center";
    ctx.fillText(planet.name, x, y - r - 8);
    ctx.restore();
  }
}

function projectileStatusColor(proj) {
  switch (proj.status) {
    case "hit_target":
      return "#5cff8f";
    case "wrong_target":
      return "#ffb24d";
    case "lost_in_sun":
      return "#ff5c5c";
    case "escaped":
      return "#8891a8";
    default:
      return "#fff9d6"; // flying
  }
}

function drawProjectile(proj) {
  const pos = projectilePositionAt(proj, currentDate);
  const tailWorld = {
    x: pos.x - proj.velocityX * PROJECTILE_TRAIL_DAYS,
    y: pos.y - proj.velocityY * PROJECTILE_TRAIL_DAYS,
  };
  const head = worldToScreen(pos.x, pos.y);
  const tail = worldToScreen(tailWorld.x, tailWorld.y);
  const color = projectileStatusColor(proj);

  ctx.save();
  ctx.globalAlpha = proj.active ? 1 : 0.35;

  const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(1, color);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// LAUNCH CONTROL의 발사각 슬라이더를 조정할 때, 지구에서 그 방향으로 뻗는
// 화살표를 보여준다. 어디까지나 "지금 고른 방향"의 시각화일 뿐이며,
// 미래 궤적이나 명중 지점을 계산해서 보여주는 것이 아니다.
function drawAimPreview() {
  const earthPos = planetWorldPosition(EARTH_KEY, currentDate);
  const angleRad = (launchAngleDeg * Math.PI) / 180;
  const lengthWorld = 65;
  const endWorld = {
    x: earthPos.x + Math.cos(angleRad) * lengthWorld,
    y: earthPos.y + Math.sin(angleRad) * lengthWorld,
  };
  const start = worldToScreen(earthPos.x, earthPos.y);
  const end = worldToScreen(endWorld.x, endWorld.y);
  const color = "rgba(255, 210, 90, 0.9)";

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.setLineDash([]);
  const headLen = 9;
  const headAngle = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLen * Math.cos(angleRad - headAngle), end.y - headLen * Math.sin(angleRad - headAngle));
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLen * Math.cos(angleRad + headAngle), end.y - headLen * Math.sin(angleRad + headAngle));
  ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawStarfield();

  const center = worldCenter();
  const cx = center.x;
  const cy = center.y;

  drawSun(cx, cy);

  lastPlanetScreenPositions = [];

  for (let i = 0; i < PLANETS.length; i++) {
    const planet = PLANETS[i];
    if (planet.key === "pluto" && !plutoVisible) continue;

    const orbitRadiusPx = orbitRadiusForIndex(i) * viewScale;
    drawOrbit(cx, cy, orbitRadiusPx);

    const worldPos = planetWorldPosition(planet, currentDate);
    const screen = worldToScreen(worldPos.x, worldPos.y);
    const r = planet.visualR * Math.max(0.5, Math.min(1.4, viewScale));

    drawPlanet(planet, screen.x, screen.y, r);
    lastPlanetScreenPositions.push({ planet, x: screen.x, y: screen.y, r });
  }

  drawAimPreview();

  for (const proj of projectiles) {
    drawProjectile(proj);
  }
}
