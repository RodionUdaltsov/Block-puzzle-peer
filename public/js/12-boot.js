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
    const el = document.getElementById('matchIntro');
    if (!el) { resolve(); return; }
    // Already showing — do not restart the animation
    if (el.classList.contains('visible') && matchIntroTimer) {
      const wait = setInterval(() => {
        if (!el.classList.contains('visible')) {
          clearInterval(wait);
          resolve();
        }
      }, 80);
      setTimeout(() => { clearInterval(wait); resolve(); }, 3500);
      return;
    }
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        resolve(); return;
      }
    } catch (_) {}
    const label = document.getElementById('miLabel');
    const title = document.getElementById('miTitle');
    const sub = document.getElementById('miSub');
    if (label) label.textContent = opts.label || 'Подготовка';
    if (title) title.textContent = opts.title || 'Старт';
    if (sub) sub.textContent = opts.sub || '';
    el.classList.remove('mi-go');
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    if (matchIntroTimer) clearTimeout(matchIntroTimer);
    const total = Math.min(2400, Math.max(1100, opts.ms || 1600));
    matchIntroTimer = setTimeout(() => {
      el.classList.add('mi-go');
      if (title) title.textContent = opts.goText || 'Вперёд!';
      if (sub) sub.textContent = '';
      matchIntroTimer = setTimeout(() => {
        el.classList.remove('visible', 'mi-go');
        el.setAttribute('aria-hidden', 'true');
        matchIntroTimer = null;
        resolve();
      }, 920);
    }, Math.max(400, total - 920));
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

