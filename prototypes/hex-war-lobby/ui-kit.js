/* ============================================================================
   HEX / 전장 — UI KIT
   프레젠테이션 전용 레이어. 게임 규칙 · 네트워크 · 서버 상태에는 관여하지 않는다.

   - motion.dev (window.Motion)  : 스프링 · 스태거 · inView 리빌
   - anime.js   (window.anime)   : 숫자 카운트업 · 승리 연출
   - WAAPI / CSS                 : 위 두 라이브러리가 없을 때의 폴백
   세 가지 모두 실패해도 UI는 그대로 동작한다(오프라인 LAN 대비).
   ========================================================================= */
const UI = (() => {
  const EASE_OUT = [0.22, 1, 0.36, 1];
  const EASE_OUT_CSS = 'cubic-bezier(.22,1,.36,1)';

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = () => (window.Motion && window.Motion.animate ? window.Motion : null);
  const anime = () => (typeof window.anime === 'function' ? window.anime : null);
  const list = target => {
    if (!target) return [];
    if (target instanceof Element) return [target];
    return Array.from(target);
  };

  /* ---------------------------------------------------------------- motion */

  // keyframes 는 WAAPI 형식: {opacity:[0,1], transform:['translateY(8px)','none']}
  // motion.dev 가 있으면 스프링을, 없으면 WAAPI 를,
  // 모션 축소 환경에서는 최종 상태만 즉시 적용한다.
  function animate(target, keyframes, options = {}) {
    const targets = list(target);
    if (!targets.length) return;
    const { duration = 0.42, delay = 0, stagger = 0, spring = null, easing = EASE_OUT_CSS } = options;

    if (reduced()) {
      targets.forEach(el => {
        Object.entries(keyframes).forEach(([prop, frames]) => {
          const value = Array.isArray(frames) ? frames[frames.length - 1] : frames;
          el.style[prop] = prop === 'transform' && value === 'none' ? '' : value;
        });
      });
      return;
    }

    const lib = motion();
    targets.forEach((el, index) => {
      const at = delay + stagger * index;
      if (lib) {
        lib.animate(el, keyframes, spring
          ? { type: 'spring', stiffness: spring.stiffness ?? 320, damping: spring.damping ?? 26, delay: at }
          : { duration, delay: at, ease: EASE_OUT });
      } else if (el.animate) {
        el.animate(keyframes, { duration: duration * 1000, delay: at * 1000, easing, fill: 'both' });
      }
    });
  }

  // 컨테이너 안의 항목들을 순차적으로 등장시킨다.
  function enter(scope, selector, options = {}) {
    const root = typeof scope === 'string' ? document.querySelector(scope) : scope;
    if (!root) return;
    const items = selector ? root.querySelectorAll(selector) : [root];
    animate(items, {
      opacity: [0, 1],
      transform: ['translateY(' + (options.shift ?? 10) + 'px) scale(' + (options.scale ?? 0.995) + ')', 'none']
    }, { duration: options.duration ?? 0.42, delay: options.delay ?? 0, stagger: options.stagger ?? 0.045 });
  }

  // 스크롤 진입 시 1회 리빌. motion.dev 의 inView 를 우선 사용한다.
  function reveal(target, options = {}) {
    const items = list(typeof target === 'string' ? document.querySelectorAll(target) : target);
    if (!items.length || reduced()) return;
    const play = el => {
      el.style.opacity = '';
      animate(el, { opacity: [0, 1], transform: ['translateY(14px)', 'none'] }, { duration: 0.5 });
    };
    const lib = motion();
    items.forEach(el => {
      if (el.dataset.revealed) return;
      el.dataset.revealed = '1';
      el.style.opacity = '0';
      if (lib && lib.inView) {
        lib.inView(el, () => { play(el); return false; }, { amount: options.amount ?? 0.2 });
      } else if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => { if (entry.isIntersecting) { play(el); observer.disconnect(); } });
        }, { threshold: options.amount ?? 0.2 });
        observer.observe(el);
      } else {
        play(el);
      }
    });
  }

  // 시선을 끌어야 할 때의 짧은 펄스.
  function pop(target, options = {}) {
    animate(target, { transform: ['scale(1)', 'scale(' + (options.scale ?? 1.06) + ')', 'scale(1)'] },
      { duration: options.duration ?? 0.34 });
  }

  function shake(target) {
    animate(target, {
      transform: ['translateX(0)', 'translateX(-6px)', 'translateX(5px)', 'translateX(-3px)', 'translateX(0)']
    }, { duration: 0.36 });
  }

  /* --------------------------------------------------------------- 숫자 */

  // anime.js 가 있으면 숫자를 굴리고, 없으면 값만 바꾼다.
  function countUp(el, to, options = {}) {
    if (!el) return;
    const from = Number(el.dataset.countValue ?? 0);
    el.dataset.countValue = String(to);
    const suffix = options.suffix ?? '';
    const engine = anime();
    if (reduced() || from === to || !engine) { el.textContent = to + suffix; return; }
    const proxy = { value: from };
    engine({
      targets: proxy,
      value: to,
      round: 1,
      duration: options.duration ?? 680,
      easing: 'easeOutCubic',
      update: () => { el.textContent = proxy.value + suffix; }
    });
  }

  /* ---------------------------------------------------------------- 토스트 */

  let toastStack = null;
  function stack() {
    if (!toastStack || !toastStack.isConnected) {
      toastStack = document.createElement('div');
      toastStack.className = 'toast-stack';
      toastStack.setAttribute('role', 'status');
      toastStack.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastStack);
    }
    return toastStack;
  }

  const TOAST_ICONS = { info: '◇', success: '✓', warn: '!', error: '✕' };
  const recentToasts = new Map();

  function toast(message, options = {}) {
    if (!message) return;
    const tone = options.tone || 'info';
    const signature = tone + ':' + message;
    const now = Date.now();
    // 폴링 루프가 같은 오류를 반복해서 던져도 화면이 토스트로 덮이지 않게 한다.
    if (now - (recentToasts.get(signature) || 0) < 2600) return;
    recentToasts.set(signature, now);

    const node = document.createElement('div');
    node.className = 'toast toast-' + tone;
    node.innerHTML = '<span class="toast-icon">' + (TOAST_ICONS[tone] || '◇') + '</span><p>' + escapeForUi(message) + '</p>';
    stack().appendChild(node);
    animate(node, { opacity: [0, 1], transform: ['translateY(14px) scale(.96)', 'none'] },
      { spring: { stiffness: 360, damping: 28 } });

    const dismiss = () => {
      if (!node.isConnected) return;
      animate(node, { opacity: [1, 0], transform: ['none', 'translateY(8px) scale(.97)'] }, { duration: 0.22 });
      setTimeout(() => node.remove(), reduced() ? 0 : 240);
    };
    node.onclick = dismiss;
    setTimeout(dismiss, options.duration ?? 3200);
  }

  /* ----------------------------------------------------------------- 모달 */

  // window.confirm 대체. Promise<boolean> 을 돌려준다.
  function confirmDialog(config = {}) {
    const { title, body = '', confirmText = '확인', cancelText = '취소', tone = 'default' } = config;
    return new Promise(resolve => {
      const scrim = document.createElement('div');
      scrim.className = 'modal-scrim';
      scrim.innerHTML =
        '<div class="modal-card" role="dialog" aria-modal="true">' +
          '<h3>' + escapeForUi(title || '확인') + '</h3>' +
          (body ? '<p>' + escapeForUi(body) + '</p>' : '') +
          '<div class="modal-actions">' +
            '<button type="button" class="secondary" data-modal="cancel">' + escapeForUi(cancelText) + '</button>' +
            '<button type="button" class="' + (tone === 'danger' ? 'danger' : 'primary') + '" data-modal="ok">' + escapeForUi(confirmText) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(scrim);
      document.body.classList.add('modal-open');

      const card = scrim.querySelector('.modal-card');
      animate(scrim, { opacity: [0, 1] }, { duration: 0.18 });
      animate(card, { opacity: [0, 1], transform: ['translateY(18px) scale(.97)', 'none'] },
        { spring: { stiffness: 340, damping: 27 } });

      const close = result => {
        document.removeEventListener('keydown', onKey);
        document.body.classList.remove('modal-open');
        animate(scrim, { opacity: [1, 0] }, { duration: 0.16 });
        setTimeout(() => scrim.remove(), reduced() ? 0 : 170);
        resolve(result);
      };
      const onKey = event => {
        if (event.key === 'Escape') close(false);
        if (event.key === 'Enter') close(true);
      };
      document.addEventListener('keydown', onKey);
      scrim.onclick = event => { if (event.target === scrim) close(false); };
      scrim.querySelector('[data-modal="cancel"]').onclick = () => close(false);
      scrim.querySelector('[data-modal="ok"]').onclick = () => close(true);
      scrim.querySelector('[data-modal="ok"]').focus();
    });
  }

  /* --------------------------------------------------------------- 햅틱 */

  // 브라우저는 사용자가 한 번이라도 화면을 건드리기 전의 진동 호출을 거부하고
  // 콘솔에 오류를 남긴다. 첫 입력이 들어온 뒤에만 호출한다.
  let userHasTapped = false;

  function haptic(pattern = 12) {
    if (reduced() || !userHasTapped) return;
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (error) { /* 미지원 기기 */ }
  }

  /* -------------------------------------------------------------- 캔버스 */

  // 고배율 디스플레이에서 캔버스가 흐려지지 않도록 백버퍼를 확대한다.
  // 논리 좌표계(width × height)는 그대로라 그리기 · 클릭 계산은 바뀌지 않는다.
  function scaleCanvas(canvas, width, height) {
    if (!canvas) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  /* --------------------------------------------------------------- 유틸 */

  function escapeForUi(value) {
    return String(value).replace(/[&<>'"]/g, character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  // 같은 내용으로 다시 그리는 낭비(와 그로 인한 깜빡임 · 애니메이션 리셋)를 막는다.
  const signatures = new Map();
  function changed(key, value) {
    const next = typeof value === 'string' ? value : JSON.stringify(value);
    if (signatures.get(key) === next) return false;
    signatures.set(key, next);
    return true;
  }
  function forget(key) { signatures.delete(key); }

  // 참가자 구분색. 방 정원이 6명이고 팔레트도 6색이라, 명단 순번으로 주면
  // 절대 겹치지 않는다. 해시 방식(playerHue)은 순번을 모를 때만 쓴다.
  const PLAYER_HUES = [82, 18, 196, 44, 276, 152];
  function hueAt(index) { return PLAYER_HUES[((index % PLAYER_HUES.length) + PLAYER_HUES.length) % PLAYER_HUES.length]; }
  function playerHue(seed) {
    const text = String(seed || '');
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return PLAYER_HUES[hash % PLAYER_HUES.length];
  }

  function skeleton(rows = 3) {
    return '<div class="skeleton-list">' +
      Array.from({ length: rows }, () => '<div class="skeleton-row"></div>').join('') +
      '</div>';
  }

  /* ----------------------------------------------------------- 승리 연출 */

  function burst(anchor) {
    if (reduced() || !anchor) return;
    const engine = anime();
    const layer = document.createElement('div');
    layer.className = 'burst-layer';
    anchor.appendChild(layer);
    const pieces = Array.from({ length: 26 }, () => {
      const piece = document.createElement('i');
      piece.style.setProperty('--hue', String(70 + Math.random() * 40));
      layer.appendChild(piece);
      return piece;
    });
    if (engine) {
      engine({
        targets: pieces,
        translateX: () => engine.random(-180, 180),
        translateY: () => engine.random(-130, 90),
        rotate: () => engine.random(-220, 220),
        scale: [{ value: 1, duration: 160 }, { value: 0, duration: 780, delay: 160 }],
        opacity: [{ value: 1, duration: 100 }, { value: 0, duration: 740, delay: 200 }],
        easing: 'easeOutCubic',
        duration: 1000,
        complete: () => layer.remove()
      });
    } else {
      pieces.forEach(piece => animate(piece, {
        transform: ['none', 'translate(' + (Math.random() - 0.5) * 320 + 'px,' + (Math.random() - 0.5) * 220 + 'px) scale(0)'],
        opacity: [1, 0]
      }, { duration: 0.9 }));
      setTimeout(() => layer.remove(), 1000);
    }
  }

  /* ------------------------------------------------- 전역 인터랙션 바인딩 */

  function bindGlobalInteractions() {
    // 누름 반응은 위임으로 걸어 둔다 — innerHTML 을 다시 써도 유지된다.
    document.addEventListener('pointerdown', () => { userHasTapped = true; }, { passive: true, capture: true });
    document.addEventListener('keydown', () => { userHasTapped = true; }, { capture: true });

    document.addEventListener('pointerdown', event => {
      const target = event.target.closest('button, .room-card, .unit-card');
      if (!target || target.disabled) return;
      target.classList.add('is-pressed');
      const release = () => {
        target.classList.remove('is-pressed');
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    }, { passive: true });

    // 키보드 사용자에게만 포커스 링을 보여 준다.
    document.addEventListener('keydown', event => {
      if (event.key === 'Tab') document.body.classList.add('using-keyboard');
    });
    document.addEventListener('pointerdown', () => document.body.classList.remove('using-keyboard'), { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindGlobalInteractions);
  else bindGlobalInteractions();

  return {
    reduced, animate, enter, reveal, pop, shake, countUp,
    toast, confirm: confirmDialog, haptic, scaleCanvas,
    changed, forget, playerHue, hueAt, skeleton, burst, escape: escapeForUi,
    EASE_OUT_CSS
  };
})();

window.UI = UI;
