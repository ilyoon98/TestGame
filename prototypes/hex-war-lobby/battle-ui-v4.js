/* ============================================================================
   HEX / 전장 — 전장 화면 (v4)
   서버가 내려 준 게임 상태를 그리고, 명령을 다시 서버로 보낸다.
   규칙 · 판정 · 타이밍은 서버가 정하며 이 파일은 표현과 조작만 담당한다.
   ========================================================================= */

/* 캔버스 논리 좌표계. 실제 백버퍼는 UI.scaleCanvas 가 화면 배율만큼 키운다. */
const BOARD_W = 760;
const BOARD_H = 560;

const phaseNames = { planning: '명령 준비', movement: '이동 단계', attack: '공격 단계', result: '전투 결과', gameover: '전투 종료' };
const terrainLabels = { plain: '평지', river: '강', bridge: '다리', forest: '숲', highland: '고지' };
const attackTiming = { delay: 260, travel: 1900, impact: 340, confirm: 420, roll: 1200, resultHold: 300, hp: 750 };
const axialDirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/* 지형별 바닥색과 그 위에 덧칠할 하이라이트 */
const TERRAIN_STYLE = {
  plain:    { base: '#1c261e', top: 'rgba(255,255,255,.035)' },
  river:    { base: '#16394f', top: 'rgba(92,200,255,.14)' },
  bridge:   { base: '#6a562b', top: 'rgba(255,212,82,.16)' },
  forest:   { base: '#204a2d', top: 'rgba(120,220,140,.10)' },
  highland: { base: '#575c33', top: 'rgba(255,240,170,.14)' }
};

/* 범례용 지형 아이콘 — 캔버스에 그리는 마크와 같은 모양 */
const TERRAIN_ICONS = {
  highland: '<svg viewBox="0 0 16 16" fill="none" stroke="#ffe9a8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 8 4l6 8"/><path d="M5 10.5 8 7l3 3.5"/></svg>',
  forest:   '<svg viewBox="0 0 16 16" fill="#b2ebb4"><path d="M5 3 8 11H2z"/><path d="M11 5l3 6h-6z"/></svg>',
  river:    '<svg viewBox="0 0 16 16" fill="none" stroke="#b4e4ff" stroke-width="1.7" stroke-linecap="round"><path d="M2 6q2.5-2.5 5 0t5 0"/><path d="M2 11q2.5-2.5 5 0t5 0"/></svg>',
  bridge:   '<svg viewBox="0 0 16 16" fill="none" stroke="#ffe6aa" stroke-width="1.7" stroke-linecap="round"><path d="M2 5.5h12M2 10.5h12M5.5 5.5v5M10.5 5.5v5"/></svg>'
};

function terrainColor(type) { return (TERRAIN_STYLE[type] || TERRAIN_STYLE.plain).base; }

// 보드가 화면에서 얼마나 줄어드는지에 따라 글자와 아이콘을 키운다.
// 휴대폰에서는 760px 짜리 판이 300px 남짓으로 줄어들기 때문에
// 논리 크기를 그대로 쓰면 숫자와 글자를 읽을 수 없다.
function boardZoom(canvas) {
  const shown = canvas?.clientWidth || BOARD_W;
  return Math.min(1.5, Math.max(1, 700 / shown));
}

// drawV4 가 매 프레임 갱신한다. 캔버스 위 글자 크기의 공통 배율.
let glyphZoom = 1;
function hexDistanceV4(a, b) { return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs((a.q + a.r) - (b.q + b.r))) / 2; }
function battleCells(game) { return game.cells || []; }
function cellKey(q, r) { return `${q},${r}`; }
function hasBattleCell(game, q, r) { return battleCells(game).some(cell => cell.q === q && cell.r === r); }

function gameSignature(game) {
  return JSON.stringify({
    turn: game?.turn, maxTurns: game?.maxTurns, phase: game?.phase, lastEvent: game?.lastEvent,
    winner: game?.winner, actions: game?.actions, submitted: game?.submitted, units: game?.units,
    animation: game?.animation, lastKnown: game?.lastKnown, terrain: game?.terrain, scoreBoard: game?.scoreBoard
  });
}

/* ============================================================ 마크업 ==== */

function turnRailMarkup(game) {
  const total = Math.max(1, game.maxTurns || 1);
  const cells = Array.from({ length: total }, (_, index) => {
    const turn = index + 1;
    const cls = turn < game.turn ? 'done' : turn === game.turn ? 'current' : '';
    return `<i class="${cls}"></i>`;
  }).join('');
  return `<div class="turn-rail">
      <div class="turn-rail-track" aria-hidden="true">${cells}</div>
      <span class="turn-rail-label">${Math.min(game.turn, total)} / ${total} 턴</span>
    </div>`;
}

// 서버는 부대가 남은 플레이어만 세서 턴을 넘긴다(server.js allSubmitted).
// 전멸한 사람을 대기자로 세면 "2/3 대기 중"인데 턴이 넘어가는 모순이 생긴다.
// scoreBoard 는 첫 결과 단계부터 채워지므로, 그 전에는 전원 생존으로 본다.
function alivePlayerIds(game) {
  const board = game.scoreBoard || [];
  if (!board.length) return null;
  return new Set(board.filter(entry => entry.alive > 0).map(entry => entry.playerId));
}

function ownLivingUnits(game) {
  return game.units.filter(unit => unit.ownerId === state.playerId && unit.hp > 0);
}

// 누가 명령을 제출했고 누구를 기다리는지 보여 준다.
function submitStatusMarkup(game) {
  const players = state.room?.players || [];
  if (!players.length) return '';
  const alive = alivePlayerIds(game);
  const active = alive ? players.filter(player => alive.has(player.id)) : players;
  const fallen = alive ? players.filter(player => !alive.has(player.id)) : [];
  const submitted = game.submitted || {};
  const done = active.filter(player => submitted[player.id]).length;

  const pill = (player, tone) => {
    const me = player.id === state.playerId ? ' (나)' : '';
    // connected 는 서버가 true 로만 되돌린다. 끊긴 게 확실할 때만 표시한다.
    const offline = player.connected === false ? '<i class="pill-offline">재접속 대기</i>' : '';
    return `<span class="submit-pill ${tone}">${escapeHtml(player.name)}${me}${offline}</span>`;
  };

  const pills = [
    ...active.map(player => pill(player, submitted[player.id] ? 'done' : 'waiting')),
    ...fallen.map(player => pill(player, 'fallen'))
  ].join('');

  return `<div class="submit-status">
      <b>${done} / ${active.length}</b>
      <span>${done === active.length ? '모두 제출 · 곧 해결됩니다' : '명령 제출 대기 중'}</span>
      <span id="waitClock" class="wait-clock"></span>
      <div class="submit-pills">${pills}</div>
    </div>`;
}

/* ------------------------------------------------- 명령 단계 경과 시간 --- */

// 서버에 단계 시작 시각이 없어서 클라이언트가 직접 잰다.
// 폴링 주기(350ms) 안에서 모두 비슷한 값을 보므로 눈치 주는 용도로는 충분하다.
function markPlanningStart(game) {
  if (game.phase !== 'planning') { state.planningSince = null; return; }
  if (state.planningSince?.turn !== game.turn) state.planningSince = { turn: game.turn, at: Date.now() };
}

function tickWaitClock() {
  const box = document.getElementById('waitClock');
  if (!box) return;
  const since = state.planningSince;
  const everyoneIn = box.parentElement?.querySelector('.submit-pill.waiting') === null;
  if (!since || everyoneIn) { box.textContent = ''; box.className = 'wait-clock'; return; }
  const seconds = Math.floor((Date.now() - since.at) / 1000);
  // 처음 20초는 조용히 둔다 — 바로 재촉하면 피곤하다.
  if (seconds < 20) { box.textContent = ''; box.className = 'wait-clock'; return; }
  box.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} 경과`;
  box.className = seconds >= 60 ? 'wait-clock urgent' : 'wait-clock';
}

if (!window.__hexWaitTicker) window.__hexWaitTicker = setInterval(tickWaitClock, 1000);

/* ------------------------------------------------------- 조우 전투 연출 --- */

// 서버가 이동 단계에 encounters 를 실어 보낸다. 각 조우는 제 시각에 전면 VS 화면으로 재생된다.
const ENCOUNTER_BEATS = { slash: 360, spin: 1050, settle: 1650, strike: 2050, out: 2400 };

function scheduleEncounters(game) {
  if (game.phase !== 'movement' || game.animation?.type !== 'movement') return;
  const list = game.animation.encounters || [];
  if (!list.length) return;
  // 같은 애니메이션을 두 번 예약하지 않는다(폴링이 renderBattlefield 를 여러 번 부를 수 있다).
  if (!UI.changed('encounter-beat', `${game.turn}:${game.animation.startedAt}`)) return;

  for (const encounter of list) {
    const delay = Math.max(0, game.animation.startedAt + (encounter.startAt || 0) - Date.now());
    setTimeout(() => showEncounter(encounter), delay);
  }
}

function dieFaceMarkup(entry, index) {
  const sign = entry.bonus > 0 ? `+${entry.bonus}` : entry.bonus < 0 ? `${entry.bonus}` : '±0';
  const maxHp = entry.maxHp || entry.hpBefore || 1;
  const ratio = Math.max(0, Math.min(1, entry.hpBefore / maxHp));
  return `
    <div class="duel-side" data-side="${index}">
      <div class="duel-who">
        <span class="duel-mark" style="--hue:${playerHueFor(entry.ownerId)}">${escapeHtml(entry.mark || '?')}</span>
        <div>
          <strong>${escapeHtml(entry.ownerName)}</strong>
          <small>${escapeHtml(entry.typeName)}</small>
        </div>
      </div>
      <div class="duel-die"><span data-roll>?</span></div>
      <div class="duel-math"><b data-total>–</b><i class="duel-bonus">근접 ${sign}</i></div>
      <div class="duel-damage" data-damage></div>
      <div class="duel-hp">
        <span class="duel-hp-bar"><i data-hpbar style="width:${ratio * 100}%"></i></span>
        <b data-hptext>${Math.ceil(entry.hpBefore)} / ${maxHp}</b>
      </div>
    </div>`;
}

function showEncounter(encounter) {
  if (!encounter?.rolls?.length) return;
  document.querySelectorAll('.duel-scrim').forEach(node => node.remove());

  const scrim = document.createElement('div');
  scrim.className = 'duel-scrim';
  scrim.innerHTML = `
    <div class="duel-stage">
      <div class="duel-grid ${encounter.rolls.length === 2 ? 'pair' : 'many'}">
        ${encounter.rolls.map(dieFaceMarkup).join('<div class="duel-vs" aria-hidden="true"><span>VS</span></div>')}
      </div>
      <p class="duel-verdict" data-verdict></p>
    </div>`;
  document.body.appendChild(scrim);

  const sides = [...scrim.querySelectorAll('.duel-side')];
  const reduced = UI.reduced();

  // 등장 연출은 CSS 애니메이션으로 건다. JS 애니메이션은 탭이 백그라운드로 가거나
  // rAF 가 멈추면 첫 키프레임(opacity:0)에 갇혀 아예 안 보이는 사고가 난다.
  soundTone(180, .26, .07, 'sawtooth', 80);

  // 주사위 굴리기 — 모션 축소 환경에서는 곧바로 결과만 보여 준다.
  const spinners = sides.map(side => side.querySelector('[data-roll]'));
  let spin = null;
  if (!reduced) {
    spin = setInterval(() => {
      spinners.forEach(node => { node.textContent = String(1 + Math.floor(Math.random() * 20)); });
      soundTone(420 + Math.random() * 60, .02, .012, 'square');
    }, 70);
  }

  const settle = () => {
    if (spin) clearInterval(spin);
    encounter.rolls.forEach((entry, index) => {
      sides[index].querySelector('[data-roll]').textContent = String(entry.roll);
      sides[index].querySelector('[data-total]').textContent = String(entry.total);
    });
    soundTone(700, .2, .05, 'triangle', 430);
  };

  const strike = () => {
    const verdict = scrim.querySelector('[data-verdict]');
    if (encounter.draw) {
      verdict.textContent = '무승부 · 서로 밀려났다';
      verdict.className = 'duel-verdict draw';
      return;
    }
    encounter.rolls.forEach((entry, index) => {
      const side = sides[index];
      if (entry.unitId === encounter.winnerUnitId) {
        side.classList.add('won');
        UI.pop(side, { scale: 1.07 });
      } else if (entry.damage > 0) {
        side.classList.add('lost');
        const box = side.querySelector('[data-damage]');
        box.textContent = `−${entry.damage}`;
        box.classList.add('hit');
        // HP 바를 실제로 깎아 준다 — 숫자보다 줄어드는 게 눈에 들어온다.
        const maxHp = entry.maxHp || entry.hpBefore || 1;
        const bar = side.querySelector('[data-hpbar]');
        bar.style.width = `${Math.max(0, Math.min(1, entry.hpAfter / maxHp)) * 100}%`;
        if (entry.hpAfter === 0) bar.classList.add('dead');
        else if (entry.hpAfter / maxHp <= .4) bar.classList.add('low');
        side.querySelector('[data-hptext]').textContent = `${Math.ceil(entry.hpAfter)} / ${maxHp}`;
        UI.shake(side);
      }
    });
    const winner = encounter.rolls.find(entry => entry.unitId === encounter.winnerUnitId);
    const fallen = encounter.rolls.filter(entry => entry.hpAfter === 0 && entry.damage > 0);
    verdict.textContent = fallen.length
      ? `${winner.ownerName} 승리 · ${fallen.map(entry => `${entry.ownerName} ${entry.typeName} 격파`).join(' · ')}`
      : `${winner.ownerName} 승리 · 차액만큼 피해`;
    verdict.className = 'duel-verdict win';
    soundTone(120, .34, .08, 'square', 52);
    UI.haptic([18, 50, 24]);
  };

  const close = () => {
    UI.animate(scrim, { opacity: [1, 0] }, { duration: 0.2 });
    setTimeout(() => scrim.remove(), reduced ? 0 : 220);
  };

  // 모션을 줄인 환경에서도 결과는 읽어야 한다. 굴리는 과정만 건너뛰고 화면은 충분히 붙잡아 둔다.
  if (reduced) { settle(); strike(); setTimeout(close, 1800); return; }
  setTimeout(settle, ENCOUNTER_BEATS.settle);
  setTimeout(strike, ENCOUNTER_BEATS.strike);
  setTimeout(close, ENCOUNTER_BEATS.out);
}

function eliminatedPanelMarkup() {
  return `<div class="eliminated-panel">
      <strong>전멸 · 관전 중</strong>
      <span>남은 지휘관들의 전투를 지켜봅니다. 이제 턴을 제출하지 않아도 진행됩니다.</span>
    </div>`;
}

// 전광판 전용: 누가 무슨 색인지 알려 주는 팀 범례.
function teamLegendMarkup() {
  const players = state.room?.players || [];
  if (state.role !== 'screen' || !players.length) return '';
  const chips = players.map((player, index) =>
    `<span class="team-chip" style="--hue:${UI.hueAt(index)}">${escapeHtml(player.name)}</span>`).join('');
  return `<div class="team-legend">${chips}</div>`;
}

// 전광판은 "모두가 이미 아는 것"만 비춘다.
// 서버가 공개하는 집합은 사격한 부대와 피격된 부대뿐이라, 빈 판일 때가 있는 게 정상이다.
function screenFogNoteMarkup(game) {
  if (state.role !== 'screen' || game.phase === 'gameover') return '';
  if (game.units.length || (game.lastKnown || []).length) return '';
  return `<div class="fog-note">
      <strong>아직 드러난 부대가 없습니다</strong>
      <span>사격한 부대와 피격된 부대만 공개됩니다. 포격이 시작되면 이 판이 채워집니다.</span>
    </div>`;
}

/* ---------------------------------------------------- 이번 턴의 포격 기록 --- */

function unitLabel(game, unitId) {
  const unit = game.units.find(item => item.id === unitId);
  return unit ? `${unit.ownerName} ${unit.typeName}` : '미확인 부대';
}

// 기록은 클라이언트가 쌓은 것이라 새로고침하면 날아간다.
// 전광판은 한 판 내내 켜 두는 화면이므로 세션에 남겨 재접속에도 버티게 한다.
const battleLogKey = () => `hexBattleLog:${state.room?.code || '-'}`;

function ensureBattleLog() {
  if (state.battleLog) return state.battleLog;
  try {
    const stored = sessionStorage.getItem(battleLogKey());
    state.battleLog = stored ? JSON.parse(stored) : [];
  } catch {
    state.battleLog = [];
  }
  return state.battleLog;
}

function saveBattleLog() {
  try { sessionStorage.setItem(battleLogKey(), JSON.stringify(state.battleLog || [])); } catch { /* 저장 불가 */ }
}

function resetBattleLog() {
  state.battleLog = [];
  state.turnAttacks = null;
  try { sessionStorage.removeItem(battleLogKey()); } catch { /* 저장 불가 */ }
}

// 공격 단계의 attacks 배열은 결과 단계에 오면 사라진다(animation 이 교체됨).
// 착탄 흔적과 전투 기록을 계속 보여주려면 클라이언트가 한 번 받아 둬야 한다.
function recordTurnAttacks(game) {
  if (game.phase !== 'attack' || game.animation?.type !== 'attack') return;
  if (state.turnAttacks?.turn === game.turn) return;

  state.turnAttacks = { turn: game.turn, attacks: game.animation.attacks };
  const lines = game.animation.attacks.map(attack => attack.hit
    ? {
        turn: game.turn, tone: 'hit',
        text: `${unitLabel(game, attack.unitId)} → ${unitLabel(game, attack.targetUnitId)} −${attack.damage} (d20 ${attack.roll})`
      }
    : {
        turn: game.turn, tone: 'miss',
        text: `${unitLabel(game, attack.unitId)} · ${attack.reason === 'out-of-range' ? '사거리 밖' : '빈 칸 포격'}`
      });
  state.battleLog = [...lines, ...ensureBattleLog()].slice(0, 14);
  saveBattleLog();
}

// 전광판이 명령 단계에도 볼거리를 갖도록, 공개된 포격 기록을 쌓아 보여 준다.
function battleLogMarkup() {
  const entries = ensureBattleLog().slice(0, 5);
  if (state.role !== 'screen' || !entries.length) return '';
  const rows = entries.map(entry =>
    `<div class="log-row ${entry.tone}"><b>T${entry.turn}</b><span>${escapeHtml(entry.text)}</span></div>`).join('');
  return `<div class="battle-log"><div class="battle-log-head">전투 기록</div>${rows}</div>`;
}

// 보드 위 착탄 흔적은 한 턴이 지나면 사라진다.
// 명령을 짜는 동안에도 "지난 턴에 누가 맞았는지"는 알아야 하므로 한 줄로 남긴다.
function lastTurnSummaryMarkup(game) {
  if (state.role === 'screen' || game.phase !== 'planning' || game.turn <= 1) return '';
  const hits = ensureBattleLog().filter(entry => entry.turn === game.turn - 1 && entry.tone === 'hit');
  if (!hits.length) return '';
  return `<div class="last-turn">
      <b>지난 턴</b>
      <span>${hits.slice(0, 3).map(entry => escapeHtml(entry.text)).join(' · ')}</span>
    </div>`;
}

function scoreboardMarkup(game) {
  if (!game.scoreBoard?.length) return '';
  const rows = game.scoreBoard.map((entry, index) => `
      <div class="score-row ${entry.alive ? '' : 'eliminated'}">
        <span>${index + 1}</span>
        <strong>${escapeHtml(entry.name)}</strong>
        <small>피해 ${entry.damage} · 체력 ${entry.hp}</small>
        <b>${entry.score < 0 ? '전멸' : `${entry.score}점`}</b>
      </div>`).join('');
  return `<div class="scoreboard">${rows}</div>`;
}

function ordersForUnit(game, unitId) { return game.actions?.[state.playerId]?.[unitId] || {}; }

function rosterMarkup(game) {
  const own = game.units.filter(unit => unit.ownerId === state.playerId && unit.hp > 0);
  if (!own.length) return '';
  const cards = own.map(unit => {
    const orders = ordersForUnit(game, unit.id);
    const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    return `
      <button class="unit-card ${state.selectedUnitId === unit.id ? 'selected' : ''}" data-unit-id="${unit.id}"
              aria-pressed="${state.selectedUnitId === unit.id}">
        <span class="unit-mark" aria-hidden="true">${unit.mark}</span>
        <strong>${unit.typeName}</strong>
        <small>HP ${Math.ceil(unit.hp)}/${unit.maxHp}</small>
        <span class="unit-hp"><i class="${ratio <= .4 ? 'low' : ''}" style="width:${ratio * 100}%"></i></span>
        <span class="unit-orders">
          <span class="order-chip move ${orders.move ? 'set' : ''}">이동 ${orders.move ? '✓' : '–'}</span>
          <span class="order-chip attack ${orders.attack ? 'set' : ''}">공격 ${orders.attack ? '✓' : '–'}</span>
        </span>
      </button>`;
  }).join('');
  return `<div class="unit-dock">${cards}</div>`;
}

function commandConsoleMarkup(game, locked) {
  const selectedOrders = state.selectedUnitId ? ordersForUnit(game, state.selectedUnitId) : {};
  const needsUnit = !state.selectedUnitId;
  const headline = locked
    ? '명령 제출 완료 · 다른 지휘관을 기다립니다'
    : state.selectedUnitId ? '선택한 부대에 명령' : '먼저 부대를 선택하세요';
  return `
    <div class="command-console">
      <div class="command-step">
        <span aria-hidden="true">1</span>
        <strong>${headline}</strong>
        <small>부대마다 이동 1 · 공격 1을 예약할 수 있습니다.</small>
      </div>
      ${rosterMarkup(game)}
      <div class="battle-controls">
        <button id="moveBtn" class="secondary action-button ${state.actionType === 'move' ? 'action-selected' : ''}"
                ${(locked || needsUnit) ? 'disabled' : ''}>이동${selectedOrders.move ? ' ✓' : ''}</button>
        <button id="attackBtn" class="secondary action-button ${state.actionType === 'attack' ? 'action-selected' : ''}"
                ${(locked || needsUnit) ? 'disabled' : ''}>공격${selectedOrders.attack ? ' ✓' : ''}</button>
        <button id="submitBtn" class="primary" ${locked ? 'disabled' : ''}>
          ${locked ? '제출 완료' : '턴 제출'} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p id="battleError" class="error battle-error" role="alert"></p>
    </div>`;
}

/* ============================================================== 렌더 ==== */

function renderBattlefield() {
  const game = state.room?.game;
  if (!game) return;

  if (state.lastBattleTurn !== game.turn) {
    // 새 전투(재대결 포함)면 지난 판의 포격 기록을 버린다.
    if (game.turn <= 1) resetBattleLog();
    state.lastBattleTurn = game.turn;
    state.actionType = null;
    state.selectedUnitId = null;
    state.target = null;
    state.audioCues.clear();
  }

  state.renderEpoch = (state.renderEpoch || 0) + 1;
  const epoch = state.renderEpoch;
  state.gameSignature = gameSignature(game);
  show('gameView');

  const screen = state.role === 'screen';
  const planning = game.phase === 'planning';
  const gameOver = game.phase === 'gameover';
  const locked = !!game.submitted?.[state.playerId];
  const stageText = game.phase === 'attack' ? '포격 처리 중…' : game.lastEvent;

  // 부대가 전멸하면 낼 명령이 없다. 서버도 이 사람을 기다리지 않으므로 관전 화면으로 바꾼다.
  const eliminated = !screen && !gameOver && ownLivingUnits(game).length === 0;
  markPlanningStart(game);

  const console_ = eliminated ? eliminatedPanelMarkup()
    : !screen && planning ? commandConsoleMarkup(game, locked) : '';
  const modeBanner = !screen && !eliminated && planning && !locked
    ? `<div id="commandModeBanner" class="command-mode-banner ${state.actionType || 'hidden'}"></div>` : '';

  // 전투가 끝나면 방장은 같은 멤버 그대로 다시 시작할 수 있다(기존 start 엔드포인트).
  const isHost = state.room?.hostId === state.playerId;
  const rematch = gameOver && !screen && isHost
    ? '<button id="rematchBtn" class="primary rematch">같은 멤버로 다시 <span aria-hidden="true">↗</span></button>'
    : '';

  const footer = gameOver
    ? `<div class="victory-banner">
         <span>${game.winner ? 'WINNER' : 'DRAW'}</span>
         <strong>${escapeHtml(game.lastEvent)}</strong>
       </div>${scoreboardMarkup(game)}${rematch}`
    : screen
      // 전광판은 공개 정보 전용 화면이다. 단계와 상관없이
      // 이번 상황 · 지금까지의 포격 기록 · 순위 · 제출 현황을 계속 띄워 둔다.
      ? `<div class="phase-stage">${escapeHtml(stageText)}</div>
         ${battleLogMarkup()}
         ${scoreboardMarkup(game)}
         ${planning ? submitStatusMarkup(game) : ''}`
      : !planning
        ? `<div class="phase-stage">${escapeHtml(stageText)}</div>${
            game.phase === 'result' ? scoreboardMarkup(game) : ''}`
        : submitStatusMarkup(game);

  $('battlefieldApp').innerHTML = `
    <div class="panel battlefield-shell">
      <div class="battlefield-head">
        <div>
          <p class="eyebrow">${screen ? 'PUBLIC SCREEN' : 'PLAYER COMMAND'}</p>
          <h2>${gameOver ? '전투 종료' : `TURN ${game.turn} <small>/ ${game.maxTurns}</small>`}</h2>
        </div>
        <div class="battle-head-actions">
          <button id="soundBtn" class="sound-toggle" aria-pressed="${state.soundEnabled}">
            ${state.soundEnabled ? '🔊 소리 켜짐' : '🔇 소리 켜기'}
          </button>
          <div class="phase-chip phase-${game.phase}">${phaseNames[game.phase]}</div>
        </div>
      </div>
      ${gameOver ? '' : turnRailMarkup(game)}
      ${console_}
      ${modeBanner}
      ${teamLegendMarkup()}
      ${lastTurnSummaryMarkup(game)}
      <canvas id="hexCanvas" width="${BOARD_W}" height="${BOARD_H}" aria-label="육각 전장 지도"></canvas>
      <div id="boardTooltip" class="board-tooltip hidden"></div>
      ${screenFogNoteMarkup(game)}
      <div class="battle-legend">
        <span class="move-key">이동 가능</span>
        <span class="attack-key">공격 가능</span>
        <span class="ghost-key">마지막 발견 위치</span>
        ${Object.entries(TERRAIN_ICONS).map(([terrain, icon]) =>
          `<span class="terrain-key">${icon}${terrainLabels[terrain]}</span>`).join('')}
      </div>
      ${footer}
      <button id="gameLeaveBtn" class="text-button">방 나가기</button>
    </div>`;

  updateModeBanner();
  scheduleEncounters(game);
  drawV4(game, epoch);

  // 턴이나 단계가 바뀔 때만 등장 연출을 준다 — 폴링마다 흔들리면 눈이 피로하다.
  const beat = `${game.turn}:${game.phase}`;
  if (UI.changed('battle-beat', beat)) {
    UI.enter($('battlefieldApp'), '.battlefield-head, .turn-rail, .command-console, canvas, .battle-legend, .phase-stage, .submit-status, .victory-banner',
      { stagger: 0.035, shift: 8 });
    if (gameOver) UI.burst(document.querySelector('.victory-banner'));
  }

  $('soundBtn').onclick = toggleSound;
  tickWaitClock();
  if (!screen && !eliminated && planning && !locked) {
    $('moveBtn').onclick = () => selectMode('move');
    $('attackBtn').onclick = () => selectMode('attack');
    $('submitBtn').onclick = submitTurn;
    document.querySelectorAll('[data-unit-id]').forEach(button => {
      button.onclick = () => selectUnit(button.dataset.unitId);
    });
  }
  const rematchButton = $('rematchBtn');
  if (rematchButton) rematchButton.onclick = () => restartMatch(rematchButton);
  $('gameLeaveBtn').onclick = leaveBattle;
}

// 같은 방·같은 멤버로 새 전투를 연다. 서버의 기존 start 엔드포인트를 그대로 쓴다.
async function restartMatch(button) {
  button.disabled = true;
  try {
    const data = await api(`/api/rooms/${state.room.code}/start`, {
      method: 'POST', body: JSON.stringify({ hostId: state.playerId })
    });
    state.room = data.room;
    state.lastBattleTurn = null;
    UI.forget('battle-beat');
    UI.toast('새 전투를 시작합니다.', { tone: 'success' });
    UI.haptic([20, 40, 20]);
    renderBattlefield();
  } catch (error) {
    button.disabled = false;
    showBattleError(error.message);
  }
}

function updateModeBanner() {
  const banner = $('commandModeBanner');
  if (!banner) return;
  if (!state.actionType) {
    banner.className = 'command-mode-banner hidden';
    banner.textContent = '';
    return;
  }
  const selected = state.room?.game?.units.find(unit => unit.id === state.selectedUnitId);
  const label = state.actionType === 'move' ? '이동' : '공격';
  const next = selected
    ? (state.actionType === 'move' ? `${selected.typeName} 목적지를 선택하세요` : `${selected.typeName} 사격 지점을 선택하세요`)
    : '명령을 내릴 유닛을 선택하세요';
  banner.className = `command-mode-banner ${state.actionType}`;
  banner.innerHTML = `<strong>${label} 모드</strong><span>${next}</span>`;
}

/* ============================================================ 입력 ===== */

function selectMode(type) {
  if (!state.selectedUnitId) return showBattleError('먼저 내 부대를 선택하세요.');
  state.actionType = state.actionType === type ? null : type;
  state.target = null;
  hideTip();
  showBattleError('');
  UI.haptic(10);
  renderBattlefield();
}

function selectUnit(unitId) {
  const unit = state.room.game.units.find(item => item.id === unitId && item.ownerId === state.playerId && item.hp > 0);
  if (!unit) return;
  state.selectedUnitId = unit.id;
  state.actionType = null;
  state.target = null;
  hideTip();
  showBattleError('');
  UI.haptic(8);
  renderBattlefield();
}

function hideTip() {
  const tip = $('boardTooltip');
  if (tip) tip.classList.add('hidden');
}

function showBattleError(message) {
  const box = $('battleError');
  if (box) box.textContent = message;
  if (message) {
    UI.toast(message, { tone: 'warn' });
    UI.haptic([12, 40, 12]);
  }
}

/* ========================================================== 사거리 계산 == */

function attackOriginV4(game, unit) {
  const move = ordersForUnit(game, unit.id).move;
  return move?.target || { q: unit.q, r: unit.r };
}

function attackRangeV4(game, unit, origin = attackOriginV4(game, unit)) {
  return unit.range + (game.terrain[cellKey(origin.q, origin.r)] === 'highland' ? 1 : 0);
}

function reachableCellsV4(game, unit) {
  const seen = new Map([[cellKey(unit.q, unit.r), 0]]);
  const queue = [{ q: unit.q, r: unit.r, steps: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.steps >= unit.move) continue;
    for (const [dq, dr] of axialDirs) {
      const next = { q: current.q + dq, r: current.r + dr, steps: current.steps + 1 };
      const nextKey = cellKey(next.q, next.r);
      if (seen.has(nextKey) || !hasBattleCell(game, next.q, next.r) || game.terrain[nextKey] === 'river') continue;
      seen.set(nextKey, next.steps);
      queue.push(next);
    }
  }
  seen.delete(cellKey(unit.q, unit.r));
  return seen;
}

/* ============================================================ 드로잉 ==== */

function hexPath(ctx, center, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// 지형은 글자 대신 도형으로 찍는다 — 판이 줄어도 모양은 알아볼 수 있다.
function drawTerrainMark(ctx, center, terrain, size) {
  const s = size * 0.44;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.lineWidth = Math.max(1.3, size * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (terrain === 'highland') {
    ctx.strokeStyle = 'rgba(255,240,180,.82)';
    ctx.beginPath();
    ctx.moveTo(-s, s * .5); ctx.lineTo(0, -s * .65); ctx.lineTo(s, s * .5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * .42, s * .05); ctx.lineTo(0, -s * .32); ctx.lineTo(s * .42, s * .05);
    ctx.stroke();
  } else if (terrain === 'forest') {
    ctx.fillStyle = 'rgba(178,235,180,.78)';
    [[-s * .46, .1], [s * .46, -.12]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(dx, -s * .68 + dy * s);
      ctx.lineTo(dx + s * .44, s * .46 + dy * s);
      ctx.lineTo(dx - s * .44, s * .46 + dy * s);
      ctx.closePath();
      ctx.fill();
    });
  } else if (terrain === 'river') {
    ctx.strokeStyle = 'rgba(180,228,255,.86)';
    [-s * .34, s * .34].forEach(dy => {
      ctx.beginPath();
      ctx.moveTo(-s * .9, dy);
      ctx.quadraticCurveTo(-s * .3, dy - s * .42, 0, dy);
      ctx.quadraticCurveTo(s * .3, dy + s * .42, s * .9, dy);
      ctx.stroke();
    });
  } else if (terrain === 'bridge') {
    ctx.strokeStyle = 'rgba(255,230,170,.9)';
    ctx.beginPath();
    ctx.moveTo(-s * .9, -s * .34); ctx.lineTo(s * .9, -s * .34);
    ctx.moveTo(-s * .9, s * .34);  ctx.lineTo(s * .9, s * .34);
    ctx.moveTo(-s * .4, -s * .34); ctx.lineTo(-s * .4, s * .34);
    ctx.moveTo(s * .4, -s * .34);  ctx.lineTo(s * .4, s * .34);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(190,210,180,.2)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.3, size * .06), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHexBase(ctx, game) {
  const selected = game.units.find(unit => unit.id === state.selectedUnitId && unit.hp > 0);
  const attackOrigin = game.phase === 'planning' && selected && state.actionType === 'attack'
    ? attackOriginV4(game, selected) : null;
  const attackRange = attackOrigin ? attackRangeV4(game, selected, attackOrigin) : 0;
  const moveCells = game.phase === 'planning' && selected && state.actionType === 'move'
    ? reachableCellsV4(game, selected) : new Map();
  const radius = hexRadius(game) - 2;

  for (const cell of battleCells(game)) {
    const center = hexCenter(cell.q, cell.r, game);
    const tileKey = cellKey(cell.q, cell.r);
    const terrain = game.terrain[tileKey];
    const style = TERRAIN_STYLE[terrain] || TERRAIN_STYLE.plain;
    const chosen = game.phase === 'planning' && state.target?.q === cell.q && state.target?.r === cell.r;
    const distance = attackOrigin ? hexDistanceV4(attackOrigin, cell) : 0;
    const attackInRange = attackRange > 0 && distance >= selected.minRange && distance <= attackRange;
    const moveInRange = moveCells.has(tileKey);

    // 바닥 + 위에서 들어오는 빛
    hexPath(ctx, center, radius);
    ctx.fillStyle = chosen ? '#5d7530' : style.base;
    ctx.fill();
    if (!chosen) {
      const shade = ctx.createLinearGradient(center.x, center.y - radius, center.x, center.y + radius);
      shade.addColorStop(0, style.top);
      shade.addColorStop(1, 'rgba(0,0,0,.18)');
      ctx.fillStyle = shade;
      ctx.fill();
    }

    if (attackInRange || moveInRange) {
      ctx.fillStyle = moveInRange ? 'rgba(92,200,255,.22)' : 'rgba(255,122,82,.19)';
      ctx.fill();
    }

    ctx.strokeStyle = chosen ? '#ffd452' : moveInRange ? '#5cc8ff' : attackInRange ? '#e17458' : 'rgba(150,180,140,.16)';
    ctx.lineWidth = chosen ? 3.5 : (moveInRange || attackInRange) ? 2 : 1;
    ctx.stroke();

    drawTerrainMark(ctx, center, terrain, radius);
  }
}

/* 착탄 흔적 — 포탄이 떨어진 칸은 그 턴이 끝날 때까지 모두에게 남는다.
   부대는 숨어 있어도 "어디에 떨어졌고 누가 맞았는지"는 공개 정보다. */

// 포탄이 실제로 떨어진 뒤에만 흔적을 그린다(아직 날아가는 중이면 안 그림).
function impactsToDraw(game, now) {
  const record = state.turnAttacks;
  if (!record || record.turn !== game.turn) return [];
  const running = game.phase === 'attack' && game.animation?.type === 'attack' ? game.animation : null;
  return record.attacks.filter((attack, index) => {
    if (!running) return true;                     // 결과 단계에서는 전부 남긴다
    const elapsed = now - running.startedAt - shotOffset(attack, index);
    return elapsed >= attackTiming.travel;
  });
}

function drawCraters(ctx, game, impacts) {
  const radius = hexRadius(game) - 2;
  for (const attack of impacts) {
    const center = hexCenter(attack.to.q, attack.to.r, game);
    ctx.save();
    hexPath(ctx, center, radius);
    ctx.fillStyle = attack.hit ? 'rgba(120, 28, 14, .5)' : 'rgba(18, 20, 18, .45)';
    ctx.fill();
    ctx.strokeStyle = attack.hit ? 'rgba(255, 138, 92, .85)' : 'rgba(170, 178, 166, .5)';
    ctx.lineWidth = attack.hit ? 2.5 : 1.5;
    ctx.setLineDash(attack.hit ? [] : [5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 파편 자국
    ctx.strokeStyle = attack.hit ? 'rgba(255, 176, 120, .5)' : 'rgba(150, 160, 148, .35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i + 0.4;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(angle) * radius * .3, center.y + Math.sin(angle) * radius * .3);
      ctx.lineTo(center.x + Math.cos(angle) * radius * .72, center.y + Math.sin(angle) * radius * .72);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawImpactLabels(ctx, game, impacts) {
  for (const attack of impacts) {
    const center = hexCenter(attack.to.q, attack.to.r, game);
    const y = center.y + hexRadius(game) + 4 * glyphZoom;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8, 10, 8, .9)';
    ctx.lineWidth = 3.5;

    if (attack.hit) {
      const victim = game.units.find(unit => unit.id === attack.targetUnitId);
      ctx.font = `700 ${12 * glyphZoom}px 'Space Mono', monospace`;
      ctx.strokeText(`−${attack.damage}`, center.x, y);
      ctx.fillStyle = '#ff9a6b';
      ctx.fillText(`−${attack.damage}`, center.x, y);
      if (victim) {
        ctx.font = `700 ${9 * glyphZoom}px 'Pretendard Variable', sans-serif`;
        ctx.strokeText(victim.ownerName, center.x, y + 12 * glyphZoom);
        ctx.fillStyle = 'rgba(240, 226, 214, .92)';
        ctx.fillText(victim.ownerName, center.x, y + 12 * glyphZoom);
      }
    } else {
      ctx.font = `700 ${9 * glyphZoom}px 'Pretendard Variable', sans-serif`;
      const text = attack.reason === 'out-of-range' ? '사거리 밖' : '빈 칸';
      ctx.strokeText(text, center.x, y);
      ctx.fillStyle = 'rgba(180, 188, 176, .85)';
      ctx.fillText(text, center.x, y);
    }
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawArrow(ctx, from, to, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.setLineDash([9, 7]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.setLineDash([]);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 13 * Math.cos(angle - .5), to.y - 13 * Math.sin(angle - .5));
  ctx.lineTo(to.x - 13 * Math.cos(angle + .5), to.y - 13 * Math.sin(angle + .5));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

const SLIDE_MS = 820;
// 서버가 사람별로 발사 시각을 배분해 준다. 옛 상태(startAt 없음)는 예전 간격으로 대체.
const shotOffset = (attack, index) => (Number.isFinite(attack.startAt) ? attack.startAt : index * attackTiming.delay);
const clamp01 = value => Math.min(1, Math.max(0, value));

// 서버가 각 이동에 startAt(재생 시작 오프셋)을 실어 준다.
// 플레이어 차례대로 재생돼야 누가 뭘 했는지 따라갈 수 있다.
function unitPosition(game, unit, now) {
  if (game.phase !== 'movement' || game.animation?.type !== 'movement') return hexCenter(unit.q, unit.r, game);
  const animation = game.animation;
  const elapsed = now - animation.startedAt;

  const move = animation.moves.find(item => item.unitId === unit.id);
  if (move) {
    const progress = clamp01((elapsed - (move.startAt || 0)) / SLIDE_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    const from = hexCenter(move.from.q, move.from.r, game);
    const to = hexCenter(move.to.q, move.to.r, game);
    return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
  }

  // 같은 칸을 노린 부대는 제자리로 돌아온다. 가만히 서 있으면 "명령이 씹혔나?" 싶으므로
  // 밀고 나갔다가 튕겨 나오는 걸 보여 준다.
  const blocked = (animation.blocked || []).find(item => item.unitId === unit.id);
  if (blocked) {
    const progress = clamp01((elapsed - (blocked.startAt || 0)) / SLIDE_MS);
    const lunge = Math.sin(Math.min(1, progress * 1.7) * Math.PI) * 0.34;
    const from = hexCenter(unit.q, unit.r, game);
    const to = hexCenter(blocked.to.q, blocked.to.r, game);
    return { x: from.x + (to.x - from.x) * lunge, y: from.y + (to.y - from.y) * lunge };
  }

  return hexCenter(unit.q, unit.r, game);
}

// 서로 밀려난 칸에 충돌 표시를 남긴다.
function drawBlockedMarks(ctx, game, now) {
  if (game.phase !== 'movement' || game.animation?.type !== 'movement') return;
  const blocked = game.animation.blocked || [];
  if (!blocked.length) return;

  const elapsed = now - game.animation.startedAt;
  const radius = hexRadius(game) - 2;
  const seen = new Set();

  for (const item of blocked) {
    // 안개전장 유지 — 내가 볼 수 없는 부대끼리의 충돌은 위치를 흘리지 않는다.
    if (!game.units.some(unit => unit.id === item.unitId)) continue;
    const local = elapsed - (item.startAt || 0);
    if (local < SLIDE_MS * 0.28) continue;

    const tileKey = cellKey(item.to.q, item.to.r);
    if (seen.has(tileKey)) continue;
    seen.add(tileKey);

    const pulse = 0.55 + 0.45 * Math.sin(local / 140);
    const center = hexCenter(item.to.q, item.to.r, game);
    ctx.save();
    hexPath(ctx, center, radius);
    ctx.fillStyle = `rgba(255, 212, 82, ${0.12 * pulse})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 212, 82, ${0.5 + 0.35 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 맞부딪힌 표시 — X 자
    const arm = radius * 0.34;
    ctx.strokeStyle = 'rgba(255, 232, 160, .92)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(center.x - arm, center.y - arm); ctx.lineTo(center.x + arm, center.y + arm);
    ctx.moveTo(center.x + arm, center.y - arm); ctx.lineTo(center.x - arm, center.y + arm);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = `700 ${9 * glyphZoom}px 'Pretendard Variable', sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8, 10, 8, .9)';
    ctx.lineWidth = 3.5;
    ctx.strokeText('이동 충돌', center.x, center.y + radius + 4 * glyphZoom);
    ctx.fillStyle = '#ffd452';
    ctx.fillText('이동 충돌', center.x, center.y + radius + 4 * glyphZoom);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function attackDisplayHp(game, unit, now) {
  if (game.phase !== 'attack' || game.animation?.type !== 'attack') return unit.hp;
  const hits = game.animation.attacks
    .map((attack, index) => ({ attack, index }))
    .filter(item => item.attack.hit && item.attack.targetUnitId === unit.id && Number.isFinite(item.attack.hpBefore));
  if (!hits.length) return unit.hp;
  let hp = hits[0].attack.hpBefore;
  for (const { attack, index } of hits) {
    const start = game.animation.startedAt + shotOffset(attack, index)
      + attackTiming.travel + attackTiming.impact + attackTiming.confirm + attackTiming.roll + attackTiming.resultHold;
    const progress = Math.min(1, Math.max(0, (now - start) / attackTiming.hp));
    const eased = 1 - Math.pow(1 - progress, 3);
    hp -= (attack.hpBefore - attack.hpAfter) * eased;
  }
  return Math.max(0, hp);
}

// 플레이어 화면은 "내 부대 / 적 부대" 두 색이면 충분하지만,
// 전광판은 관전자 시점이라 소유자별로 색이 달라야 누가 누군지 읽힌다.
// 색상값은 로비 참가자 아바타와 같은 팔레트(UI.playerHue)를 쓴다.
function unitPalette(unit) {
  if (state.role === 'screen') {
    const hue = playerHueFor(unit.ownerId);
    return {
      light: `hsl(${hue} 88% 74%)`,
      dark: `hsl(${hue} 68% 48%)`,
      ring: `hsl(${hue} 55% 20%)`
    };
  }
  return unit.ownerId === state.playerId
    ? { light: '#e4ff8f', dark: '#a9d431', ring: 'rgba(244,241,232,.9)' }
    : { light: '#ff9c7c', dark: '#e8583a', ring: 'rgba(37,21,18,.9)' };
}

function drawUnit(ctx, game, unit, pos, selected, displayHp = unit.hp) {
  const size = game.radius >= 5 ? 17 : 20;
  const ratio = Math.max(0, Math.min(1, displayHp / unit.maxHp));
  const palette = unitPalette(unit);
  ctx.save();

  // 바닥 그림자로 말을 판에서 살짝 띄운다
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + size * .78, size * .82, size * .28, 0, 0, Math.PI * 2);
  ctx.fill();

  if (selected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size + 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd452';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffd452';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size + 3, 0, Math.PI * 2);
    ctx.strokeStyle = palette.ring;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const body = ctx.createLinearGradient(pos.x, pos.y - size, pos.x, pos.y + size);
  body.addColorStop(0, palette.light);
  body.addColorStop(1, palette.dark);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  const markSize = (game.radius >= 5 ? 11 : 13) * glyphZoom;
  ctx.fillStyle = '#12160f';
  ctx.font = `700 ${markSize}px 'Space Mono', 'Pretendard Variable', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(unit.mark || unit.ownerName[0], pos.x, pos.y + markSize * .34);

  const barWidth = size * 2 + 6;
  const barY = pos.y - size - 12;
  ctx.fillStyle = 'rgba(6,8,6,.85)';
  ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, 5);
  ctx.fillStyle = ratio > .4 ? '#c8f24a' : '#ff7a52';
  ctx.fillRect(pos.x - barWidth / 2, barY, barWidth * ratio, 5);
  ctx.restore();
}

function drawGhost(ctx, game, ghost) {
  const center = hexCenter(ghost.q, ghost.r, game);
  const size = game.radius >= 5 ? 16 : 19;
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = '#a6b4a0';
  ctx.globalAlpha = .58;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const ghostSize = (game.radius >= 5 ? 9 : 11) * glyphZoom;
  ctx.fillStyle = '#a6b4a0';
  ctx.font = `700 ${ghostSize}px 'Space Mono', 'Pretendard Variable', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(ghost.mark || '?', center.x, center.y + ghostSize * .34);
  ctx.font = `${8 * glyphZoom}px 'Space Mono', monospace`;
  ctx.fillText(`T${ghost.turn}`, center.x, center.y + size + 11 * glyphZoom);
  ctx.restore();
}

function drawD20(ctx, attack, to, elapsed, index) {
  const progress = Math.min(1, Math.max(0, elapsed / attackTiming.roll));
  const reduced = UI.reduced();
  const value = reduced || progress === 1 ? attack.roll : 1 + (Math.floor(elapsed / 55) + index * 7) % 20;
  const scale = glyphZoom * 1.2;
  const dieRadius = 24 * scale;
  const x = Math.max(dieRadius + 18, Math.min(BOARD_W - dieRadius - 18, to.x));
  const y = Math.max(dieRadius + 34, to.y - 48);
  const spin = reduced ? 0 : (1 - progress) * Math.PI * 4;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  hexPath(ctx, { x: 0, y: 0 }, dieRadius);
  ctx.fillStyle = progress === 1 ? '#ffd452' : '#20251f';
  ctx.strokeStyle = progress === 1 ? '#f4f1e8' : '#ffd452';
  ctx.lineWidth = 3;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = progress === 1 ? 18 : 10;
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.rotate(-spin);
  ctx.fillStyle = progress === 1 ? '#111312' : '#f4f1e8';
  ctx.font = `700 ${15 * scale}px 'Space Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, 0, 1);
  ctx.restore();

  ctx.fillStyle = progress === 1 ? '#ffd452' : '#f4f1e8';
  ctx.font = `700 ${10 * scale}px 'Space Mono', 'Pretendard Variable', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(progress === 1 ? `D20 결과 · 피해 ${attack.damage}` : 'D20 판정 중', x, y + dieRadius + 16);
  ctx.textAlign = 'left';
}

function artilleryPoint(from, to, t, lift) {
  const inv = 1 - t;
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift };
  return {
    x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
    y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y
  };
}

function artilleryTangent(from, to, t, lift) {
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift };
  return {
    x: 2 * (1 - t) * (control.x - from.x) + 2 * t * (to.x - control.x),
    y: 2 * (1 - t) * (control.y - from.y) + 2 * t * (to.y - control.y)
  };
}

function drawArtilleryShot(ctx, attack, from, to, progress, elapsed) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.max(72, Math.min(145, distance * .38));
  const color = attack.hit ? '#ffd452' : '#ff7a52';
  const shell = artilleryPoint(from, to, progress, lift);
  const tangent = artilleryTangent(from, to, progress, lift);
  const ground = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };

  ctx.save();
  if (elapsed < 180) {
    const flash = 1 - elapsed / 180;
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#fff1aa';
    ctx.beginPath();
    ctx.arc(from.x, from.y, 8 + 18 * (1 - flash), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = .12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 22; i++) {
    const point = artilleryPoint(from, to, progress * i / 22, lift);
    i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y);
  }
  ctx.stroke();

  ctx.globalAlpha = .3;
  ctx.fillStyle = '#050706';
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y + 10, 12 - 4 * progress, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (progress < 1) {
    for (let i = 1; i <= 6; i++) {
      const trail = artilleryPoint(from, to, Math.max(0, progress - i * .025), lift);
      ctx.globalAlpha = .28 * (1 - i / 7);
      ctx.fillStyle = i < 3 ? '#ff8a3d' : '#d9d4bf';
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, 3 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(shell.x, shell.y);
    ctx.rotate(Math.atan2(tangent.y, tangent.x));
    ctx.shadowColor = '#ffb13b';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#292b28';
    ctx.strokeStyle = '#fff1bd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(8, -8, -10, -7);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-10, 7);
    ctx.quadraticCurveTo(8, 8, 16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff7a32';
    ctx.beginPath();
    ctx.moveTo(-15, -5);
    ctx.lineTo(-29, 0);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff5d1';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(7, -5);
    ctx.lineTo(7, 5);
    ctx.closePath();
    ctx.fill();
  } else {
    const age = elapsed - attackTiming.travel;
    const impactProgress = Math.min(1, Math.max(0, age / attackTiming.impact));
    if (impactProgress < 1) {
      ctx.globalAlpha = 1 - impactProgress;
      ctx.strokeStyle = color;
      ctx.lineWidth = 6 - 3 * impactProgress;
      ctx.beginPath();
      ctx.arc(to.x, to.y, 10 + 40 * impactProgress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = (1 - impactProgress) * .9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(to.x, to.y, 20 * (1 - impactProgress), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHitConfirm(ctx, to, progress) {
  const eased = 1 - Math.pow(1 - Math.min(1, progress), 3);
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 4);
  ctx.fillStyle = '#ffd452';
  ctx.strokeStyle = '#191c17';
  ctx.lineWidth = 4;
  ctx.font = `900 ${(17 + 5 * eased) * glyphZoom}px 'Space Mono', 'Pretendard Variable', sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeText('명중!', to.x, to.y - 40 - 8 * eased);
  ctx.fillText('명중!', to.x, to.y - 40 - 8 * eased);
  ctx.restore();
}

function drawV4(game, epoch = state.renderEpoch) {
  if (epoch !== state.renderEpoch) return;
  const canvas = $('hexCanvas');
  if (!canvas) return;

  // 화면 배율에 맞춰 백버퍼를 키운다. 아래 좌표는 모두 논리 좌표(760×560)다.
  const ctx = UI.scaleCanvas(canvas, BOARD_W, BOARD_H);
  glyphZoom = boardZoom(canvas);
  const now = Date.now();
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  drawHexBase(ctx, game);

  recordTurnAttacks(game);
  const impacts = impactsToDraw(game, now);
  drawCraters(ctx, game, impacts);

  if (game.phase === 'planning') {
    const mine = game.actions?.[state.playerId] || {};
    for (const [unitId, orders] of Object.entries(mine)) {
      const unit = game.units.find(item => item.id === unitId && item.hp > 0);
      if (!unit) continue;
      [[orders.move, '#5cc8ff'], [orders.attack, '#ff7a52']].forEach(([command, color]) => {
        if (command) drawArrow(ctx, hexCenter(unit.q, unit.r, game), hexCenter(command.target.q, command.target.r, game), color);
      });
    }
  }

  if (state.selectedUnitId && state.target) {
    const unit = game.units.find(item => item.id === state.selectedUnitId);
    if (unit) drawArrow(ctx, hexCenter(unit.q, unit.r, game), hexCenter(state.target.q, state.target.r, game), '#ffd452');
  }

  drawBlockedMarks(ctx, game, now);

  for (const ghost of game.lastKnown || []) drawGhost(ctx, game, ghost);

  for (const unit of game.units) {
    const displayHp = attackDisplayHp(game, unit, now);
    if (displayHp > 0) drawUnit(ctx, game, unit, unitPosition(game, unit, now), unit.id === state.selectedUnitId, displayHp);
  }

  if (game.phase === 'attack' && game.animation?.type === 'attack') {
    for (const [attackIndex, attack] of game.animation.attacks.entries()) {
      const from = hexCenter(attack.from.q, attack.from.r, game);
      const to = hexCenter(attack.to.q, attack.to.r, game);
      const elapsed = now - game.animation.startedAt - shotOffset(attack, attackIndex);
      if (elapsed < 0) continue;
      const progress = UI.reduced() ? 1 : Math.min(1, elapsed / attackTiming.travel);
      drawArtilleryShot(ctx, attack, from, to, progress, elapsed);
      if (progress < 1) continue;

      const afterImpact = elapsed - attackTiming.travel;
      if (attack.hit && attack.roll) {
        if (afterImpact >= attackTiming.impact && afterImpact < attackTiming.impact + attackTiming.confirm) {
          drawHitConfirm(ctx, to, (afterImpact - attackTiming.impact) / attackTiming.confirm);
        }
        const diceElapsed = afterImpact - attackTiming.impact - attackTiming.confirm;
        if (diceElapsed >= 0) drawD20(ctx, attack, to, diceElapsed, attackIndex);
      } else if (afterImpact >= attackTiming.impact) {
        ctx.fillStyle = '#ff9a80';
        ctx.font = `700 ${11 * glyphZoom}px 'Space Mono', 'Pretendard Variable', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(attack.reason === 'out-of-range' ? '유효 사거리 밖' : '목표 없음', to.x, to.y - 36);
        ctx.textAlign = 'left';
      }
    }
  }

  // 공격 단계에는 D20 연출이 이미 피해량을 말해 주므로 라벨을 겹쳐 쓰지 않는다.
  // 포격이 끝난 뒤(결과 단계)에 피해 숫자와 피격자 이름을 기록처럼 얹는다.
  if (game.phase !== 'attack') drawImpactLabels(ctx, game, impacts);

  updateBattleAudio(game, now);
  canvas.onclick = event => handleBoardClick(event, canvas, game, epoch);

  if (['movement', 'attack'].includes(game.phase)
    && state.renderEpoch === epoch
    && state.room?.game?.phase === game.phase
    && document.getElementById('hexCanvas') === canvas) {
    requestAnimationFrame(() => drawV4(game, epoch));
  }
}

/* ========================================================== 보드 클릭 === */

// 화면 좌표를 캔버스 논리 좌표(760×560)로 바꾼다.
function boardPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * BOARD_W / rect.width,
    y: (event.clientY - rect.top) * BOARD_H / rect.height
  };
}

function handleBoardClick(event, canvas, game, epoch) {
  if (state.role === 'screen' || game.phase !== 'planning' || game.submitted?.[state.playerId]) return;
  const { x, y } = boardPoint(event, canvas);
  const hit = game.units.find(unit => unit.hp > 0
    && Math.hypot(hexCenter(unit.q, unit.r, game).x - x, hexCenter(unit.q, unit.r, game).y - y) < hexRadius(game) * .72);

  if (!state.actionType) {
    if (hit?.ownerId === state.playerId) return selectUnit(hit.id);
    if (hit) showTip(hit, event, canvas, game);
    else hideTip();
    return;
  }
  hideTip();

  if (hit && hit.ownerId === state.playerId) return selectUnit(hit.id);
  if (!state.selectedUnitId) return showBattleError('명령을 내릴 내 유닛을 먼저 선택하세요.');

  const tile = battleCells(game).find(cell => {
    const center = hexCenter(cell.q, cell.r, game);
    return Math.hypot(center.x - x, center.y - y) < hexRadius(game);
  });
  if (!tile) return;

  const selected = game.units.find(unit => unit.id === state.selectedUnitId);
  if (state.actionType === 'move') {
    if (!reachableCellsV4(game, selected).has(cellKey(tile.q, tile.r))) {
      return showBattleError(`${selected.typeName}의 파란 이동 범위 안에서 선택하세요.`);
    }
  } else {
    const origin = attackOriginV4(game, selected);
    const range = attackRangeV4(game, selected, origin);
    const distance = hexDistanceV4(origin, tile);
    if (distance < selected.minRange) return showBattleError(`${selected.typeName}의 최소 사거리는 ${selected.minRange}칸입니다.`);
    if (distance > range) return showBattleError(`사거리 밖입니다. 붉은 ${range}칸 안에서 선택하세요.`);
  }

  showBattleError('');
  state.target = tile;
  UI.haptic(14);
  drawV4(game, epoch);
  sendAction(state.actionType);
}

// 툴팁은 .battlefield-shell 기준으로 놓이므로 캔버스 오프셋을 더해 준다.
function showTip(unit, event, canvas, game) {
  const box = $('boardTooltip');
  if (!box || state.actionType) return;
  const shell = canvas.closest('.battlefield-shell');
  const canvasRect = canvas.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  const left = event.clientX - shellRect.left + 14;
  const top = event.clientY - shellRect.top + 14;
  const terrain = terrainLabels[game.terrain[cellKey(unit.q, unit.r)]];

  box.classList.remove('hidden');
  box.innerHTML = `
    <strong>${escapeHtml(unit.ownerName)} · ${unit.typeName}</strong>
    <span>HP ${Math.ceil(unit.hp)}/${unit.maxHp}</span>
    <span>사거리 ${unit.minRange}–${unit.range}${terrain === '고지' ? '+1' : ''}</span>
    <span>이동 ${unit.move} · 시야 ${unit.vision}${terrain === '고지' ? '+1' : ''}</span>
    <span>${terrain}</span>`;
  // 오른쪽 끝에서 잘리지 않도록 되돌려 놓는다
  box.style.left = `${Math.min(left, shellRect.width - box.offsetWidth - 12)}px`;
  box.style.top = `${Math.min(top, canvasRect.bottom - shellRect.top - 12)}px`;
  UI.animate(box, { opacity: [0, 1], transform: ['scale(.94)', 'none'] }, { duration: 0.18 });
}

/* ============================================================ 통신 ===== */

async function sendAction(action) {
  if (!state.selectedUnitId || !state.target) return;
  const selectedUnitId = state.selectedUnitId;
  try {
    const data = await api(`/api/rooms/${state.room.code}/command`, {
      method: 'POST',
      body: JSON.stringify({ playerId: state.playerId, action, unitId: selectedUnitId, target: state.target })
    });
    state.room = data.room;
    state.selectedUnitId = selectedUnitId;
    state.actionType = null;
    state.target = null;
    hideTip();
    renderBattlefield();
    if (data.notice) showBattleError(data.notice);
    else UI.toast(action === 'move' ? '이동 명령을 예약했습니다.' : '사격 명령을 예약했습니다.', { tone: 'success', duration: 1800 });
  } catch (error) {
    showBattleError(error.message);
  }
}

async function submitTurn() {
  try {
    const data = await api(`/api/rooms/${state.room.code}/submit`, {
      method: 'POST', body: JSON.stringify({ playerId: state.playerId })
    });
    state.room = data.room;
    state.actionType = null;
    state.selectedUnitId = null;
    state.target = null;
    UI.haptic([16, 30, 16]);
    UI.toast('명령을 제출했습니다. 다른 지휘관을 기다립니다.', { tone: 'success' });
    renderBattlefield();
  } catch (error) {
    showBattleError(error.message);
  }
}

async function leaveBattle() {
  const confirmed = await UI.confirm({
    title: '전장에서 이탈',
    body: '남은 부대는 전투에서 빠집니다. 되돌릴 수 없습니다.',
    confirmText: '이탈', cancelText: '계속 싸우기', tone: 'danger'
  });
  if (!confirmed) return;
  try {
    await api(`/api/rooms/${state.room.code}/leave`, {
      method: 'POST', body: JSON.stringify({ playerId: state.playerId })
    });
    resetToHome();
  } catch (error) {
    showBattleError(error.message);
  }
}

/* ============================================================ 사운드 ==== */

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  if (state.soundEnabled) {
    state.audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    state.audioContext.resume();
    soundTone(520, .08, .05, 'triangle');
  }
  UI.toast(state.soundEnabled ? '전장 사운드를 켰습니다.' : '전장 사운드를 껐습니다.', { tone: 'info', duration: 1600 });
  renderBattlefield();
}

function soundTone(frequency, duration = .12, volume = .045, type = 'sine', endFrequency = null) {
  if (!state.soundEnabled || !state.audioContext) return;
  const context = state.audioContext;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function soundCue(key, callback) {
  if (state.audioCues.has(key)) return;
  state.audioCues.add(key);
  callback();
}

function updateBattleAudio(game, now) {
  if (!state.soundEnabled || game.phase !== 'attack' || game.animation?.type !== 'attack') return;
  game.animation.attacks.forEach((attack, index) => {
    const elapsed = now - game.animation.startedAt - shotOffset(attack, index);
    const prefix = `${game.turn}-${index}`;
    if (elapsed >= 0) soundCue(`${prefix}-launch`, () => soundTone(240, .28, .06, 'sawtooth', 70));
    if (elapsed >= attackTiming.travel) soundCue(`${prefix}-impact`, () => {
      soundTone(90, .34, .09, 'square', 38);
      soundTone(620, .08, .035, 'triangle', 180);
    });
    const diceStart = attackTiming.travel + attackTiming.impact + attackTiming.confirm;
    if (attack.hit && elapsed >= diceStart && elapsed < diceStart + attackTiming.roll) {
      const tick = Math.floor((elapsed - diceStart) / 110);
      soundCue(`${prefix}-tick-${tick}`, () => soundTone(430 + tick * 18, .035, .018, 'square'));
    }
    if (attack.hit && elapsed >= diceStart + attackTiming.roll) {
      soundCue(`${prefix}-result`, () => soundTone(760, .25, .055, 'triangle', 420));
    }
    if (attack.hit && elapsed >= diceStart + attackTiming.roll + attackTiming.resultHold) {
      soundCue(`${prefix}-damage`, () => soundTone(150, .32, .05, 'sawtooth', 60));
    }
  });
}
