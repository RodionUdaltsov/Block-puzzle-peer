/**
 * Block Puzzle — 08-boot.js
 * Boot loader hide, match intro overlays
 * Lines ~19010-19105 from legacy game.js monolith (refactored).
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

// —— Boot loader: hide when ready ——
(function initBootLoader() {
  const hide = () => {
    try {
      if (typeof window.__hideBootLoader === 'function') {
        window.__hideBootLoader();
        return;
      }
    } catch (_) {}
    const el = document.getElementById('bootLoader');
    if (!el || el.classList.contains('hide')) return;
    el.classList.add('hide');
    el.setAttribute('data-hidden', '1');
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 600);
  };
  try {
    const t0 = performance.now();
    const finish = () => {
      const left = Math.max(0, 900 - (performance.now() - t0));
      setTimeout(hide, left);
    };
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    setTimeout(hide, 2800);
  } catch (_) {
    setTimeout(hide, 500);
  }
})();

// —— Match intro (classic / versus) ——
let matchIntroTimer = null;
function showMatchIntro(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    try {
      if (settings && settings.matchIntro === '0') { resolve(); return; }
    } catch (_) {}
    if (opts.skip) { resolve(); return; }
    const el = document.getElementById('matchIntro');
    if (!el) { resolve(); return; }
    // Already showing — wait for it, do not stack
    if (el.classList.contains('visible') && matchIntroTimer) {
      const wait = setInterval(() => {
        if (!el.classList.contains('visible')) {
          clearInterval(wait);
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(wait); resolve(); }, 2800);
      return;
    }
    // Reduced motion: still show a short static flash (do not skip entirely)
    let reduced = false;
    try {
      reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {}
    const label = document.getElementById('miLabel');
    const title = document.getElementById('miTitle');
    const sub = document.getElementById('miSub');
    if (label) label.textContent = opts.label || 'Загрузка';
    if (title) title.textContent = opts.title || 'Почти готово…';
    if (sub) sub.textContent = opts.sub || '';
    el.classList.remove('mi-go');
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    // Force visible — hideMatchLoading leaves inline display:none which overrides .visible
    try {
      el.style.display = 'flex';
      el.style.pointerEvents = 'auto';
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      el.style.zIndex = '9000';
    } catch (_) {}
    if (matchIntroTimer) clearTimeout(matchIntroTimer);
    const hideIntro = () => {
      try {
        el.classList.remove('visible', 'mi-go');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      } catch (_) {}
      matchIntroTimer = null;
      resolve();
    };
    // Respect explicit ms. Default 1200. goPhase = final «Старт!» flash
    const requested = (typeof opts.ms === 'number') ? opts.ms : 1200;
    const total = reduced
      ? Math.min(600, Math.max(200, requested))
      : Math.min(2200, Math.max(0, requested));
    const goPhase = total <= 0 ? 0 : Math.min(520, Math.max(280, Math.floor(total * 0.35)));
    const hold = Math.max(0, total - goPhase);
    if (total <= 0) {
      hideIntro();
      return;
    }
    matchIntroTimer = setTimeout(() => {
      el.classList.add('mi-go');
      if (label) label.textContent = 'Готово';
      if (title) title.textContent = opts.goText || 'Старт!';
      if (sub) sub.textContent = opts.sub || '';
      matchIntroTimer = setTimeout(hideIntro, goPhase);
    }, hold);
  });
}

window.addEventListener('resize', () => { invalidateBoardMetrics(); updateBoardMetrics(); _finePointerCached = null; });
try { updateMenuStats(); } catch (_) {}
try { refreshProfileUI(); } catch (_) {}
try { if (bestEl) bestEl.textContent = best; } catch (_) {}
try {
  if (typeof window.__unlockUI === 'function') window.__unlockUI();
  else if (typeof window.__hideBootLoader === 'function') window.__hideBootLoader();
} catch (_) {}
try {
  // Clear stale rejoin session so menu is never locked behind rejoin overlay
  if (!window._roomMatchMode) {
    sessionStorage.removeItem('bp_match_id');
    sessionStorage.removeItem('bp_match_token');
  }
} catch (_) {}

