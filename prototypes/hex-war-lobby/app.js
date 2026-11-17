/* ============================================================================
   HEX / 전장 — 홈 · 로비 화면
   네트워크 계약(엔드포인트 · 페이로드)과 게임 규칙은 그대로 두고
   표시 · 입력 · 피드백만 다룬다. 전장 화면은 battle-ui-v4.js 가 이어받는다.
   ========================================================================= */

const state = {
  room: null, playerId: null, reconnectToken: null,
  role: 'player', mode: 'player',
  timer: null, roomListTimer: null,
  soundEnabled: false, audioContext: null, audioCues: new Set(),
  invite: null, invitedRoomId: null,
  activeView: null, missingRoomStreak: 0
};

const $ = id => document.getElementById(id);

const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) {
    // 호출한 쪽이 "방이 사라짐(404)"과 "잠깐 끊김"을 구분할 수 있게 상태 코드를 붙인다.
    const failure = new Error(data.error || '요청에 실패했습니다.');
    failure.status = response.status;
    throw failure;
  }
  return data;
};

const name = () => $('homeName').value.trim();

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

/* ------------------------------------------------------------- 피드백 --- */

// 인라인 오류 문구. 반복 폴링이 쏟아내는 메시지까지 토스트로 띄우지는 않는다.
function error(target, message = '') {
  const box = $(target);
  if (!box) return;
  box.textContent = message;
  if (message) UI.shake(box);
}

// 사용자가 방금 한 행동에 대한 응답에만 토스트를 쓴다.
function notify(message, tone = 'info') { UI.toast(message, { tone }); }

function requireName() {
  if (name()) return true;
  error('homeError', '닉네임을 먼저 입력해 주세요.');
  UI.shake($('homeName'));
  $('homeName').focus();
  return false;
}

/* ------------------------------------------------------------ 화면 전환 --- */

function show(view) {
  const moved = state.activeView !== view;
  state.activeView = view;
  ['homeView', 'lobbyView', 'gameView'].forEach(id => $(id).classList.toggle('hidden', id !== view));
  if (moved) {
    window.scrollTo({ top: 0, behavior: UI.reduced() ? 'auto' : 'smooth' });
    UI.animate($(view), { opacity: [0, 1], transform: ['translateY(14px)', 'none'] }, { duration: 0.42 });
  }
}

/* -------------------------------------------------------------- 세션 --- */

function saveSession() {
  sessionStorage.setItem('hexLobby', JSON.stringify({
    room: state.room.code, playerId: state.playerId,
    reconnectToken: state.reconnectToken, role: state.role, mode: state.mode
  }));
}

function resetToHome(message = '') {
  clearInterval(state.timer);
  sessionStorage.removeItem('hexLobby');
  state.room = null;
  state.playerId = null;
  state.reconnectToken = null;
  state.invite = null;
  history.replaceState({}, '', '/');
  document.body.classList.remove('invite-entry');
  document.body.dataset.role = 'home';
  UI.forget('lobby');
  UI.forget('rooms');
  show('homeView');
  error('homeError', message);
  if (message) notify(message, 'warn');
  loadRooms();
}

/* ---------------------------------------------------------- 방 만들기 --- */

async function createRoom() {
  error('homeError');
  if (!requireName()) return;
  const button = $('createBtn');
  button.disabled = true;
  try {
    const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name: name() }) });
    state.room = data.room;
    state.playerId = data.playerId;
    state.reconnectToken = data.reconnectToken;
    state.role = 'player';
    state.mode = 'player';
    UI.forget('lobby');
    saveSession();
    UI.haptic(18);
    notify('작전실을 열었습니다. QR로 동료를 불러오세요.', 'success');
    renderLobby();
  } catch (e) {
    error('homeError', e.message);
    notify(e.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function joinRoom(role, roomId) {
  error('homeError');
  if (!requireName()) return;
  const code = String(roomId || state.invitedRoomId || '').trim().toUpperCase();
  if (!code) return error('homeError', '참여할 방을 선택해 주세요.');
  try {
    const data = await api(`/api/rooms/${code}/join`, {
      method: 'POST', body: JSON.stringify({ name: name(), role })
    });
    state.room = data.room;
    state.playerId = data.playerId;
    state.reconnectToken = data.reconnectToken;
    state.role = role;
    state.mode = role;
    state.invitedRoomId = null;
    history.replaceState({}, '', '/');
    document.body.classList.remove('invite-entry');
    UI.forget('lobby');
    saveSession();
    UI.haptic(18);
    notify(role === 'screen' ? '전광판으로 연결되었습니다.' : '작전실에 합류했습니다.', 'success');
    renderLobby();
  } catch (e) {
    error('homeError', e.message);
    notify(e.message, 'error');
  }
}

/* -------------------------------------------------------- 방 목록 (홈) --- */

function elapsedLabel(createdAt) {
  if (!createdAt) return '';
  const minutes = Math.floor((Date.now() - createdAt) / 60000);
  if (minutes < 1) return '방금 개설';
  if (minutes < 60) return `${minutes}분 전 개설`;
  return `${Math.floor(minutes / 60)}시간 전 개설`;
}

function roomCardMarkup(room, invitedId) {
  const full = room.players >= room.maxPlayers;
  return `
    <article class="room-card ${room.roomId === invitedId ? 'invited' : ''}">
      <div class="room-signal" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="room-meta">
        <strong>${escapeHtml(room.hostName)}의 작전실</strong>
        <small>${room.players} / ${room.maxPlayers}명 · 전광판 ${room.screenConnected ? '연결됨' : '미연결'}${
          elapsedLabel(room.createdAt) ? ` · ${elapsedLabel(room.createdAt)}` : ''}</small>
      </div>
      <div class="room-actions">
        <button class="secondary" data-join-room="${room.roomId}" data-role="player" ${full ? 'disabled' : ''}>
          ${full ? '정원 초과' : '참여'}
        </button>
        <button class="screen-button" data-join-room="${room.roomId}" data-role="screen">전광판</button>
      </div>
    </article>`;
}

// 초대 전용 화면에서 일반 홈으로 되돌린다.
function leaveInviteMode() {
  state.invitedRoomId = null;
  document.body.classList.remove('invite-entry');
  history.replaceState({}, '', '/');
  const kicker = document.querySelector('.rooms-panel .panel-kicker');
  const heading = document.querySelector('.rooms-panel h2');
  if (kicker) kicker.textContent = '02 / 로컬 작전실';
  if (heading) heading.textContent = '참여 가능한 방';
  UI.forget('rooms');
  loadRooms();
  $('homeName').focus();
}

async function loadRooms() {
  if (state.room) return;
  try {
    const data = await api('/api/rooms');
    const rooms = data.rooms || [];
    const invited = state.invitedRoomId;
    const ordered = invited
      ? [...rooms].sort((a, b) => (b.roomId === invited) - (a.roomId === invited))
      : rooms;

    // 같은 목록이면 다시 그리지 않는다 — 3초마다 깜빡이거나 애니메이션이 끊기는 걸 막는다.
    if (!UI.changed('rooms', ordered.map(room =>
      [room.roomId, room.hostName, room.players, room.screenConnected].join('|')).join('/'))) return;

    const listBox = $('roomsList');
    // 초대 링크로 들어왔는데 그 방이 목록에 없으면(이미 시작했거나 닫힘) 막다른 길이 된다.
    // '새 작전실 만들기' 버튼이 숨겨져 있으므로 빠져나갈 길을 따로 준다.
    const inviteMissing = invited && !ordered.some(room => room.roomId === invited);

    const inviteNotice = inviteMissing
      ? `<div class="room-empty invite-missing">
           <strong>초대받은 방을 찾을 수 없습니다.</strong>
           <span>이미 전투가 시작됐거나 방이 닫혔을 수 있어요.</span>
           <button class="secondary" id="exitInviteBtn">직접 방 만들기</button>
         </div>`
      : '';

    listBox.innerHTML = inviteNotice + (ordered.length
      ? ordered.map(room => roomCardMarkup(room, invited)).join('')
      : inviteMissing
        ? ''
        : `<div class="room-empty">
             <strong>열린 작전실이 없습니다.</strong>
             <span>첫 번째 방을 만들어 QR로 동료를 초대해.</span>
           </div>`);
    UI.enter(listBox, '.room-card, .room-empty', { stagger: 0.05 });

    listBox.querySelectorAll('[data-join-room]').forEach(button => {
      button.onclick = () => joinRoom(button.dataset.role, button.dataset.joinRoom);
    });
    const exitInvite = $('exitInviteBtn');
    if (exitInvite) exitInvite.onclick = leaveInviteMode;
  } catch (e) {
    error('homeError', `방 목록을 불러오지 못했습니다 · ${e.message}`);
  }
}

/* ---------------------------------------------------------------- 초대 --- */

async function ensureInvite(code) {
  if (state.invite?.code === code) return;
  try {
    const data = await api(`/api/rooms/${code}/invite`);
    state.invite = { code, ...data };
    $('inviteQr').innerHTML = data.svg;
    $('inviteLinkText').textContent = data.url;
    $('inviteLinkBtn').onclick = () => copyInviteLink(data.url);
    UI.animate($('inviteQr'), { opacity: [0, 1], transform: ['scale(.9)', 'none'] },
      { spring: { stiffness: 300, damping: 24 } });
  } catch (e) {
    $('inviteLinkText').textContent = '초대 링크를 만들지 못했습니다.';
  }
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

async function copyInviteLink(url) {
  try {
    await copyText(url);
    $('copyNote').textContent = '복사됨';
    UI.pop($('inviteLinkBtn'));
    UI.haptic(12);
    notify('초대 링크를 복사했습니다.', 'success');
    setTimeout(() => { $('copyNote').textContent = ''; }, 1600);
  } catch {
    $('copyNote').textContent = '';
    notify('링크를 길게 눌러 복사해 주세요.', 'warn');
  }
}

/* ---------------------------------------------------------------- 로비 --- */

// 참가자 색은 명단 순번으로 정한다 — 정원(6명)과 팔레트 크기가 같아 절대 겹치지 않는다.
function playerHueFor(playerId) {
  const index = state.room?.players?.findIndex(player => player.id === playerId) ?? -1;
  return index >= 0 ? UI.hueAt(index) : UI.playerHue(playerId);
}

function playerMarkup(player, isHost) {
  return `
    <div class="player">
      <span class="avatar" style="--hue:${playerHueFor(player.id)}" aria-hidden="true">${escapeHtml(player.name[0])}</span>
      <span class="player-name">${escapeHtml(player.name)}</span>
      <span class="connection ${player.connected ? 'online' : 'offline'}">${player.connected ? '접속' : '재접속 대기'}</span>
      ${player.isHost
        ? '<span class="host-label">방장</span>'
        : `<span class="ready-state ${player.ready ? 'ready' : ''}">${player.ready ? '준비 완료' : '대기 중'}</span>`}
      ${isHost && !player.isHost ? `<button class="kick" data-kick="${player.id}">추방</button>` : ''}
    </div>`;
}

function settingMarkup(room, isHost) {
  const size = isHost
    ? `<select data-setting="radius">
         <option value="4" ${room.settings.radius == 4 ? 'selected' : ''}>표준 · 61칸</option>
         <option value="5" ${room.settings.radius == 5 ? 'selected' : ''}>대형 · 91칸</option>
       </select>`
    : `<strong>${room.settings.radius == 5 ? '대형' : '표준'}</strong>`;
  const turns = isHost
    ? `<select data-setting="turns">
         <option ${room.settings.turns == 10 ? 'selected' : ''}>10</option>
         <option ${room.settings.turns == 15 ? 'selected' : ''}>15</option>
         <option ${room.settings.turns == 20 ? 'selected' : ''}>20</option>
       </select>`
    : `<strong>${room.settings.turns}턴</strong>`;
  return `
    <div class="setting"><span>전장</span><strong>절차적 육각 전장</strong></div>
    <div class="setting"><span>전장 크기</span>${size}</div>
    <div class="setting"><span>턴 수</span>${turns}</div>
    <div class="setting"><span>유닛 행동</span><strong>각각 이동 1 · 공격 1</strong></div>`;
}

// 방장에게 "왜 아직 시작할 수 없는지"를 먼저 알려 준다.
function startGate(room) {
  const others = room.players.filter(player => !player.isHost);
  if (room.players.length < 2) return '플레이어가 2명 이상 모여야 출격할 수 있습니다.';
  const waiting = others.filter(player => !player.ready);
  if (waiting.length) return `${waiting.map(player => player.name).join(', ')} 준비 대기 중`;
  return '';
}

function lobbyActionsMarkup(room, me, isHost) {
  if (state.role === 'screen') {
    return '<div class="hint">전광판 연결 대기 중 · 게임이 시작되면 화면이 전환됩니다.</div>';
  }
  if (isHost) {
    const gate = startGate(room);
    return `${gate ? `<span class="start-gate">${escapeHtml(gate)}</span>` : ''}
      <button class="primary" id="startBtn" ${gate ? 'disabled' : ''}>게임 시작 <span aria-hidden="true">↗</span></button>`;
  }
  return `<button class="secondary" id="readyBtn">${me.ready ? '레디 취소' : '준비 완료'}</button>`;
}

function renderLobby() {
  document.body.dataset.role = state.role;
  show('lobbyView');

  const room = state.room;
  ensureInvite(room.code);

  const me = room.players.find(player => player.id === state.playerId)
    || room.screens.find(screen => screen.id === state.playerId);
  if (!me) return resetToHome('방장에 의해 방에서 추방되었습니다.');
  const isHost = me.isHost;

  // 1초마다 돌아오는 폴링이 DOM 을 통째로 갈아엎지 않도록, 바뀐 게 있을 때만 다시 그린다.
  // (열어 둔 select 가 닫히거나 등장 애니메이션이 반복되는 문제를 막는다)
  const signature = JSON.stringify({
    players: room.players, screens: room.screens,
    settings: room.settings, role: state.role, host: isHost
  });

  if (UI.changed('lobby', signature)) {
    UI.countUp($('playerCount'), room.players.length, { suffix: ` / 6` });
    $('hostBadge').classList.toggle('hidden', !isHost);
    $('playersList').innerHTML = room.players.map(player => playerMarkup(player, isHost)).join('');
    $('screenStatus').innerHTML = room.screens.length
      ? `전광판 <strong>● ${escapeHtml(room.screens[0].name)} 연결됨</strong>${
          isHost ? `<button class="kick" data-kick="${room.screens[0].id}">추방</button>` : ''}`
      : '전광판 <strong>연결 안 됨</strong>';
    $('settingsContent').innerHTML = settingMarkup(room, isHost);
    $('lobbyActions').innerHTML = lobbyActionsMarkup(room, me, isHost);

    UI.enter($('playersList'), '.player', { stagger: 0.04, shift: 6 });

    document.querySelectorAll('[data-kick]').forEach(button => {
      button.onclick = () => kick(button.dataset.kick);
    });
    if (isHost) {
      const start = $('startBtn');
      if (start) start.onclick = startGame;
      document.querySelectorAll('[data-setting]').forEach(el => { el.onchange = saveSettings; });
    } else if (state.role === 'player') {
      $('readyBtn').onclick = () => toggleReady(!me.ready);
    }
  }

  clearInterval(state.timer);
  state.timer = setInterval(refresh, 1000);
}

/* -------------------------------------------------------------- 폴링 --- */

async function refresh() {
  if (!state.room) return;
  try {
    const data = await api(`/api/rooms/${state.room.code}?playerId=${encodeURIComponent(state.playerId)}`);
    if (!data.room) return;
    state.room = data.room;
    const stillHere = state.role === 'screen'
      ? state.room.screens.some(screen => screen.id === state.playerId)
      : state.room.players.some(player => player.id === state.playerId);
    if (!stillHere) return resetToHome('방장에 의해 방에서 추방되었습니다.');

    state.missingRoomStreak = 0;

    if (['playing', 'finished'].includes(state.room.status)) {
      const signature = gameSignature(state.room.game);
      if (signature !== state.gameSignature) renderBattlefield();
    } else {
      renderLobby();
    }
  } catch (e) {
    // 마지막 플레이어가 나가면 방이 삭제된다. 남아 있던 전광판·관전 화면이
    // "연결 복구 중"만 띄운 채 영원히 폴링하지 않도록 홈으로 돌려보낸다.
    // 일시적인 오류로 쫓아내지 않게 두 번 연속 404 일 때만 처리한다.
    if (e.status === 404) {
      state.missingRoomStreak = (state.missingRoomStreak || 0) + 1;
      if (state.missingRoomStreak >= 2) {
        state.missingRoomStreak = 0;
        return resetToHome('방이 닫혔습니다. 홈으로 돌아갑니다.');
      }
      return;
    }
    state.missingRoomStreak = 0;
    const target = state.room?.status === 'lobby' ? 'lobbyError' : 'battleError';
    const box = $(target);
    if (box) box.textContent = `연결 복구 중 · ${e.message}`;
  }
}

/* ------------------------------------------------------------- 방 조작 --- */

async function toggleReady(ready) {
  try {
    const data = await api(`/api/rooms/${state.room.code}/ready`, {
      method: 'POST', body: JSON.stringify({ playerId: state.playerId, ready })
    });
    state.room = data.room;
    UI.haptic(ready ? 16 : 8);
    renderLobby();
    if (ready) UI.pop($('lobbyActions'));
  } catch (e) {
    error('lobbyError', e.message);
    notify(e.message, 'error');
  }
}

async function saveSettings() {
  const settings = {};
  document.querySelectorAll('[data-setting]').forEach(el => { settings[el.dataset.setting] = el.value; });
  try {
    const data = await api(`/api/rooms/${state.room.code}/settings`, {
      method: 'POST', body: JSON.stringify({ hostId: state.playerId, settings })
    });
    state.room = data.room;
    renderLobby();
    notify('전장 설정을 저장했습니다.', 'success');
  } catch (e) {
    error('lobbyError', e.message);
    notify(e.message, 'error');
  }
}

async function kick(playerId) {
  const confirmed = await UI.confirm({
    title: '참가자 추방',
    body: '이 참가자를 방에서 내보냅니다. 다시 들어오려면 초대 링크가 필요합니다.',
    confirmText: '추방', cancelText: '취소', tone: 'danger'
  });
  if (!confirmed) return;
  try {
    const data = await api(`/api/rooms/${state.room.code}/kick`, {
      method: 'POST', body: JSON.stringify({ hostId: state.playerId, playerId })
    });
    state.room = data.room;
    renderLobby();
    notify('참가자를 추방했습니다.', 'info');
  } catch (e) {
    error('lobbyError', e.message);
    notify(e.message, 'error');
  }
}

async function leave() {
  const confirmed = await UI.confirm({
    title: '방 나가기',
    body: '작전실에서 나갑니다. 방장이라면 방이 닫힐 수 있습니다.',
    confirmText: '나가기', cancelText: '머무르기', tone: 'danger'
  });
  if (!confirmed) return;
  try {
    await api(`/api/rooms/${state.room.code}/leave`, {
      method: 'POST', body: JSON.stringify({ playerId: state.playerId })
    });
    resetToHome();
  } catch (e) {
    error('lobbyError', e.message);
    notify(e.message, 'error');
  }
}

async function startGame() {
  const button = $('startBtn');
  if (button) button.disabled = true;
  try {
    const data = await api(`/api/rooms/${state.room.code}/start`, {
      method: 'POST', body: JSON.stringify({ hostId: state.playerId })
    });
    state.room = data.room;
    UI.haptic([20, 40, 20]);
    showGame();
  } catch (e) {
    error('lobbyError', e.message);
    notify(e.message, 'error');
    if (button) button.disabled = false;
  }
}

function showGame() {
  clearInterval(state.timer);
  document.body.dataset.role = state.role;
  show('gameView');
  renderBattlefield();
  state.timer = setInterval(refresh, 350);
}

/* --------------------------------------------- 전장 좌표 (v4 에서 사용) --- */

function hexRadius(game = state.room?.game) { return game?.radius >= 5 ? 27 : 34; }

function hexCenter(q, r, game = state.room?.game) {
  const size = hexRadius(game);
  return { x: 380 + Math.sqrt(3) * size * (q + r / 2), y: 280 + 1.5 * size * r };
}

/* ---------------------------------------------------------------- 바인딩 --- */

$('roomsList').innerHTML = UI.skeleton(3);
$('createBtn').onclick = createRoom;
$('refreshRoomsBtn').onclick = () => { UI.forget('rooms'); loadRooms(); };
$('leaveBtn').onclick = leave;

// 엔터 한 번으로 방을 만들거나, 초대받은 방에 바로 합류한다.
$('homeName').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (state.invitedRoomId) joinRoom('player', state.invitedRoomId);
  else createRoom();
});
