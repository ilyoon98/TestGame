/* =========================================================================
   초기화 및 메인 루프
   ========================================================================= */

resizeCanvas();
window.addEventListener("load", resizeCanvas);

populateStepSelect();
populateTargetDropdown();
syncDateUI();
angleReadout.textContent = `${launchAngleDeg}°`;
speedReadout.textContent = `${launchSpeed}`;
updateTargetInfoPanel();
updateEstimatedFlightTime();
updateProjectileCountDisplay();

let lastTick = performance.now();

function loop(now) {
  const dt = now - lastTick;
  lastTick = now;

  if (dateAnim) {
    // 디버그 날짜 이동 트윈 (게임 시간 배속과는 별개의 경로)
    const t = Math.min(1, (now - dateAnim.startTime) / dateAnim.duration);
    const eased = easeInOutCubic(t);
    currentDate = new Date(dateAnim.fromMs + (dateAnim.toMs - dateAnim.fromMs) * eased);
    if (t >= 1) {
      dateAnim = null;
      checkCollisionsAt(currentDate); // 도착 지점에서의 충돌은 마지막에 한 번 확인
    }
  } else if (timeSpeedMultiplier > 0) {
    const deltaDays = timeSpeedMultiplier * (dt / 1000); // x1 = 1일/초
    advanceSimulation(deltaDays);
  }

  syncDateUI();
  updateTargetInfoPanel();
  updateEstimatedFlightTime();
  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
