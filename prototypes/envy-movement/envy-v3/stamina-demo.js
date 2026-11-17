const sprintMs = 3200;
const recoveryMs = 2400;

const transitions = {
  startWalk: { next: "walk" },
  stopWalk: { next: "idle" },
  startRun: { next: "run" },
  slowRun: { next: "walk" },
  jumpStanding: { next: "idle" },
  landRun: { next: "walk" },
  stand: { next: "idle" },
};

function createPlayer(clips) {
  return {
    clips, mode: "idle", frame: 0, elapsed: 0, x: 0, facing: 1,
    stamina: 1, sprintLocked: false, runJumpQueued: false, slideQueued: false,
  };
}

function setMode(player, mode, frame = 0) {
  player.mode = mode;
  player.frame = frame;
  player.elapsed = 0;
}

function activeClip(player) {
  const { mode, clips } = player;
  return clips[mode === "pending" || mode === "runLanding" ? "run" : mode];
}

function spriteFor(player) {
  const { mode, frame, clips } = player;
  if (mode === "jumpStanding" && frame === 0) return player.jumpEntrySprite;
  if (mode === "crouch" && frame === 0) {
    return { clip: clips.idle, cell: player.idleEntryFrame, offsetY: 0 };
  }
  if (mode === "slide") {
    if (frame === 0) return player.slideEntrySprite;
    if (frame === clips.slide.durations.length - 1) {
      return { clip: clips.crouch, cell: clips.crouch.cells.at(-1), offsetY: 0 };
    }
  }
  let clip = activeClip(player);
  let cell = clip.cells?.[frame] ?? frame;
  let groundAdjust = clip.groundAdjust?.[frame] ?? 0;
  if (frame === 0) {
    const entries = {
      startWalk: ["idle", player.idleEntryFrame],
      startRun: ["walk", player.walkEntryFrame],
      slowRun: ["run", player.slowRunEntryFrame],
      stand: ["breathing", clips.stand.breathingEntry],
      landRun: ["run", 0],
    };
    if (entries[mode]) {
      const [source, sourceCell] = entries[mode];
      clip = clips[source];
      cell = sourceCell;
      groundAdjust = clip.groundAdjust?.[cell] ?? 0;
    }
  }
  return { clip, cell, offsetY: (clip.rise?.[frame] ?? 0) + groundAdjust };
}

function startStandingJump(player) {
  player.jumpEntrySprite = spriteFor(player);
  player.walkingJump = player.mode === "walk";
  player.runJumpQueued = false;
  setMode(player, "jumpStanding");
}

function checkRunJump(player, input) {
  if (!player.runJumpQueued || player.mode !== "run") return;
  if (!input.sprint || input.direction !== player.facing) {
    startStandingJump(player);
  } else if (player.clips.jumpRunning.entryFrames.includes(player.frame)) {
    const { frame, elapsed } = player;
    player.runJumpQueued = false;
    setMode(player, "jumpRunning", frame);
    player.elapsed = elapsed;
  }
}

function requestJump(player, input) {
  if (player.mode === "run" || player.mode === "startRun") {
    player.runJumpQueued = true;
    checkRunJump(player, input);
  } else if (["idle", "walk", "startWalk", "stopWalk"].includes(player.mode)) {
    startStandingJump(player);
  }
}

function selectMovement(player, input) {
  const { mode, clips } = player;
  if (mode !== "idle" && mode !== "walk" && mode !== "run") return;
  if (input.crouch || player.slideQueued) {
    player.runJumpQueued = false;
    if (mode === "run") {
      player.slideQueued = true;
      if (clips.slide.runContacts.includes(player.frame)) {
        player.slideEntrySprite = spriteFor(player);
        player.idleEntryFrame = 0;
        player.slideQueued = false;
        setMode(player, "slide");
      }
    } else if (mode === "idle") {
      player.idleEntryFrame = player.frame;
      player.crouchTime = 0;
      setMode(player, "crouch");
    } else {
      setMode(player, "stopWalk");
    }
    return;
  }
  if (player.runJumpQueued) {
    if (mode === "run") checkRunJump(player, input);
    else startStandingJump(player);
    if (player.mode !== mode) return;
  }
  if (input.direction) player.facing = input.direction;
  const sprinting = input.sprint && !player.sprintLocked && player.stamina > 0;
  if (mode === "idle" && input.direction) {
    player.idleEntryFrame = player.frame;
    setMode(player, "startWalk");
  } else if (mode !== "idle" && !input.direction) {
    setMode(player, "stopWalk");
  } else if (mode === "walk" && sprinting && clips.startRun.walkContacts.includes(player.frame)) {
    player.walkEntryFrame = player.frame;
    setMode(player, "startRun");
  } else if (mode === "run" && !sprinting) {
    if (clips.slowRun.runContacts.includes(player.frame)) {
      player.slowRunEntryFrame = player.frame;
      setMode(player, "slowRun");
    }
  }
}

function advanceCrouch(player, input, delta) {
  const { durations, duration } = player.clips.crouch;
  const moving = input.crouch && input.direction !== 0;
  const time = input.crouch
    ? Math.min(delta, duration - player.crouchTime)
    : Math.min(delta, player.crouchTime);
  player.crouchTime += input.crouch ? time : -time;
  player.stamina = Math.min(1, player.stamina + time / recoveryMs);
  if (moving && player.crouchTime === duration) {
    player.facing = input.direction;
    setMode(player, "crouchWalk");
    return delta - time;
  }
  if (input.crouch && player.crouchTime === duration) {
    player.stamina = Math.min(1, player.stamina + (delta - time) / recoveryMs);
  }
  if (!input.crouch && player.crouchTime === 0) {
    setMode(player, "idle", player.idleEntryFrame);
    return delta - time;
  }

  // Use the same poses in reverse when the key is released mid-motion.
  let elapsed = player.crouchTime;
  let frame = 0;
  while (frame < durations.length - 1 && elapsed >= durations[frame]) {
    elapsed -= durations[frame++];
  }
  player.frame = frame;
  return 0;
}

function stopCrouchWalk(player) {
  const { crouch } = player.clips;
  player.crouchTime = crouch.duration;
  setMode(player, "crouch", crouch.durations.length - 1);
}

function updatePlayer(player, input, delta) {
  if (!input.sprint) player.sprintLocked = false;
  if (input.jump && !input.crouch) requestJump(player, input);
  selectMovement(player, input);

  while (delta > 0) {
    const mode = player.mode;
    if (mode === "crouch") {
      delta = advanceCrouch(player, input, delta);
      selectMovement(player, input);
      continue;
    }
    const clip = activeClip(player);
    if (mode === "crouchWalk" && clip.contacts.includes(player.frame)) {
      if (!input.crouch || !input.direction) {
        stopCrouchWalk(player);
        continue;
      }
      player.facing = input.direction;
    }
    const frameTime = clip.durations[player.frame];
    const time = Math.min(delta, frameTime - player.elapsed);
    player.elapsed += time;
    delta -= time;

    if (mode === "run" || mode === "jumpRunning") {
      player.stamina = Math.max(0, player.stamina - time / sprintMs);
      if (player.stamina <= 1e-9) {
        player.stamina = 0;
        player.sprintLocked = true;
        player.runJumpQueued = false;
        player.slideQueued = false;
        // A running jump finishes its landing before exhaustion takes over.
        if (mode === "run") player.mode = "pending";
      }
    } else if (mode === "idle" || mode === "walk" || mode === "breathing" || mode === "startWalk" || mode === "stopWalk" || mode === "crouchWalk") {
      player.stamina = Math.min(1, player.stamina + time / recoveryMs);
    }

    if (mode === "startRun" || mode === "slowRun") {
      const start = mode === "startRun" ? player.clips.walk.speed : player.clips.run.speed;
      const end = mode === "startRun" ? player.clips.run.speed : player.clips.walk.speed;
      const midpoint = clip.frameStarts[player.frame] + player.elapsed - time / 2;
      const speed = start + (end - start) * midpoint / clip.duration;
      player.x += player.facing * speed * time;
    } else if (clip.speed && (mode !== "crouchWalk" || (input.crouch && input.direction))) {
      player.x += player.facing * clip.speed * time;
    }
    const usesContinuousTravel = mode === "jumpRunning" || mode === "slide" ||
      mode === "brake" || mode === "landRun";
    if (usesContinuousTravel) {
      const distance = clip.travel[player.frame + 1] - clip.travel[player.frame];
      player.x += player.facing * distance * time / frameTime;
    } else if (mode === "jumpStanding" && player.walkingJump &&
      player.frame >= clip.takeoffFrame && player.frame < clip.landFrame) {
      player.x += player.facing * player.clips.walk.speed * time;
    }
    if (player.elapsed < frameTime) continue;
    if (player.mode === "pending" && player.frame === player.clips.brake.afterRunFrame) {
      setMode(player, "brake");
      continue;
    }

    if (mode === "jumpRunning" && player.frame + 1 === clip.durations.length) {
      const resume = player.stamina === 0 ? "pending"
        : !input.crouch && input.sprint && input.direction === player.facing ? "run" : "runLanding";
      setMode(player, resume, clip.resumeFrame);
      continue;
    }
    if (mode === "runLanding" && player.frame === player.clips.brake.afterRunFrame) {
      setMode(player, !input.crouch && input.sprint && input.direction === player.facing ? "run" : "landRun");
      continue;
    }
    if (mode === "slide" && player.frame + 1 === clip.durations.length) {
      stopCrouchWalk(player);
      continue;
    }

    if (mode === "brake" && player.frame + 1 === clip.durations.length) {
      setMode(player, "breathing", clip.nextBreathingFrame);
      continue;
    }

    const transition = transitions[mode];
    if (transition) {
      const next = player.frame + 1;
      if (clip.travel && !usesContinuousTravel) {
        player.x += player.facing * (clip.travel[next] - clip.travel[player.frame]);
      }
      if (next === clip.durations.length) {
        // Finish at the same speed as the next gait. If Shift changed during
        // the transition, movement selection can begin the opposite ramp.
        setMode(player, transition.next);
        selectMovement(player, input);
        continue;
      }
    }

    player.elapsed = 0;
    player.frame = (player.frame + 1) % clip.durations.length;
    if (mode === "breathing" && player.stamina >= 1 - 1e-9 && player.frame === player.clips.stand.breathingEntry) {
      player.stamina = 1;
      setMode(player, "stand");
    }
    if (mode === "walk") selectMovement(player, input);
    if (mode === "run") {
      if (input.crouch || player.slideQueued || !input.sprint) selectMovement(player, input);
      else checkRunJump(player, input);
    }
  }
}

const labels = {
  idle: "대기", walk: "걷기", run: "달리기", pending: "스태미나 소진",
  brake: "감속 · 무릎 짚기", breathing: "숨 고르는 중",
  startWalk: "첫발 내딛기", startRun: "가속", stopWalk: "멈추는 중", stand: "몸 일으키는 중",
  jumpStanding: "제자리 점프", jumpRunning: "달리기 점프", runLanding: "착지", landRun: "착지 후 감속",
  crouch: "숙이기",
  crouchWalk: "숙여 걷기",
  slide: "슬라이딩",
  slowRun: "걷기까지 감속",
};

async function startDemo() {
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const meter = document.querySelector("progress");
  const percent = document.querySelector("output");
  const status = document.querySelector("#status");
  const reset = document.querySelector("#reset");
  const sprintButton = document.querySelector("#sprint");
  const jumpButton = document.querySelector("#jump");
  const clips = JSON.parse(document.querySelector("#clips").textContent);
  try {
    const sources = [...new Set(Object.values(clips).map((clip) => clip.src))];
    const images = new Map(await Promise.all(sources.map(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [src, image];
    })));
    for (const clip of Object.values(clips)) {
      clip.image = images.get(clip.src);
    }
  } catch {
    status.textContent = "스프라이트를 불러오지 못했어요. 데모를 원래 폴더에서 열어 주세요.";
    return;
  }

  let player = createPlayer(clips);
  let camera = 0;
  let lastPercent = -1;
  let lastMode;
  let autoSprint = false;
  let jumpPressed = false;
  const keys = new Set();
  const heldButtons = new Map();
  const controlCodes = new Set(["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "ArrowDown", "ShiftLeft", "ShiftRight"]);
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!event.repeat) jumpPressed = true;
      return;
    }
    if (!controlCodes.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  const setAutoSprint = (enabled) => {
    autoSprint = enabled;
    sprintButton.setAttribute("aria-pressed", String(enabled));
  };
  const releaseControls = () => {
    keys.clear();
    heldButtons.clear();
    jumpPressed = false;
    setAutoSprint(false);
  };
  window.addEventListener("blur", releaseControls);
  document.addEventListener("visibilitychange", releaseControls);

  for (const button of document.querySelectorAll("[data-control]")) {
    const action = button.dataset.control;
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      button.setPointerCapture(event.pointerId);
      heldButtons.set(event.pointerId, action);
    });
    for (const end of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(end, (event) => heldButtons.delete(event.pointerId));
    }
    button.addEventListener("keydown", (event) => {
      if (event.code !== "Enter") return;
      event.preventDefault();
      heldButtons.set(button, action);
    });
    button.addEventListener("keyup", () => heldButtons.delete(button));
    button.addEventListener("blur", () => heldButtons.delete(button));
  }

  reset.addEventListener("click", () => {
    releaseControls();
    player = createPlayer(clips);
    camera = 0;
  });
  sprintButton.addEventListener("click", () => setAutoSprint(!autoSprint));
  jumpButton.addEventListener("click", () => { jumpPressed = true; });
  for (const button of document.querySelectorAll("button")) button.disabled = false;

  function getInput() {
    const actions = new Set(heldButtons.values());
    const left = keys.has("ArrowLeft") || keys.has("KeyA") || actions.has("left");
    const right = keys.has("ArrowRight") || keys.has("KeyD") || actions.has("right");
    const crouch = keys.has("ArrowDown") || actions.has("crouch");
    const input = {
      direction: Number(right) - Number(left) || (autoSprint && !crouch && !left && !right ? player.facing : 0),
      sprint: autoSprint || keys.has("ShiftLeft") || keys.has("ShiftRight"),
      jump: jumpPressed,
      crouch,
    };
    jumpPressed = false;
    return input;
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ground = Math.round(height * 0.84);
    const scale = Math.min(height / 530, width / 380);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#18263a");
    sky.addColorStop(1, "#354e66");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Ground markings make both deceleration and planted feet easier to see.
    ctx.fillStyle = "#152131";
    ctx.fillRect(0, ground, width, height - ground);
    ctx.fillStyle = "#577286";
    ctx.fillRect(0, ground, width, 1);
    const spacing = 82 * scale;
    const phase = ((camera * scale - width / 2) % spacing + spacing) % spacing;
    for (let x = -phase; x < width; x += spacing) {
      ctx.fillRect(x, ground + 10, Math.max(6, 17 * scale), 2);
    }

    const { clip, cell, offsetY } = spriteFor(player);
    const [cellWidth, cellHeight] = clip.size;
    const [originX, originY] = clip.origin;
    const spriteX = width / 2 + (player.x - camera) * scale;
    const lift = Math.max(0, -offsetY);
    ctx.fillStyle = `rgba(7, 13, 22, ${0.35 - Math.min(0.22, lift * 0.0035)})`;
    ctx.beginPath();
    ctx.ellipse(spriteX, ground + 1, 46 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(spriteX, ground + offsetY * scale);
    ctx.scale(player.facing * scale, scale);
    ctx.drawImage(
      clip.image, (cell % clip.columns) * cellWidth,
      Math.floor(cell / clip.columns) * cellHeight, cellWidth, cellHeight,
      -originX, -originY, cellWidth, cellHeight,
    );
    ctx.restore();
  }

  let previous;
  function tick(now) {
    const delta = previous === undefined ? 0 : Math.min(now - previous, 80);
    previous = now;
    if (!document.hidden) {
      updatePlayer(player, getInput(), delta);
      camera += (player.x - camera) * (1 - Math.exp(-delta / 185));
      const value = Math.ceil(player.stamina * 100);
      if (lastPercent !== value) {
        lastPercent = value;
        meter.value = value;
        percent.textContent = `${value}%`;
      }
      if (lastMode !== player.mode) {
        lastMode = player.mode;
        status.textContent = labels[player.mode];
        canvas.dataset.state = player.mode;
        sprintButton.disabled = ["pending", "brake", "breathing", "stand"].includes(player.mode);
        if ((sprintButton.disabled || player.mode === "slide") && autoSprint) setAutoSprint(false);
      }
      draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (typeof document !== "undefined") startDemo();
