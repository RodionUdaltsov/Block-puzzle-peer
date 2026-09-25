/* 13-performance.js — adaptive rendering/performance layer
 * Keeps the game's visual identity intact: gradients, board shimmer and placement
 * animations stay on. We only remove redundant paint/compositing work on devices
 * that need it, and automatically step down further if frame time stays high.
 */
(() => {
  'use strict';

  const mm = (q) => {
    try { return !!window.matchMedia && window.matchMedia(q).matches; }
    catch (_) { return false; }
  };

  const coarse = mm('(pointer: coarse)') || ('ontouchstart' in window && (navigator.maxTouchPoints || 0) > 0);
  const small = mm('(max-width: 900px)');
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0);
  const lowEnd = (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);

  // Do not touch desktop unless it is clearly a low-end device.
  if (coarse && small) document.documentElement.classList.add('bp-mobile-perf');

  // Full board FX (shimmer, filter, heavy keyframes) only on capable devices.
  // Low-end / mobile-lite keep palette colors only — major lag fix on phones.
  const prefersReduced = mm('(prefers-reduced-motion: reduce)');
  if (!prefersReduced && !(coarse && small && lowEnd) && !mm('(max-width: 600px) and (pointer: coarse)')) {
    document.documentElement.classList.add('bp-full-board-fx');
  }
  // Lazy-load optional heavy board FX stylesheet when full FX is enabled
  if (document.documentElement.classList.contains('bp-full-board-fx')) {
    try {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/styles-board-fx.css?v=' + (document.querySelector('link[href*="styles.css"]') || {}).href;
      // Prefer versioned path next to styles
      link.href = 'css/styles-board-fx.css';
      document.head.appendChild(link);
    } catch (_) {}
  }

  if ((coarse && small && lowEnd) || (lowEnd && !mm('(pointer: fine)'))) {
    document.documentElement.classList.add('bp-mobile-perf-lite');
  }

  // Pause decorative CSS work when the page is hidden. This has no visible effect
  // while the game is on-screen and saves battery/CPU in background tabs.
  const syncVisibility = () => {
    try { document.documentElement.classList.toggle('bp-page-hidden', document.hidden); }
    catch (_) {}
  };
  document.addEventListener('visibilitychange', syncVisibility, { passive: true });
  syncVisibility();

  // Adaptive quality: sample frame pacing without creating a permanent 60Hz loop.
  // We only react after sustained poor pacing, and recover slowly to avoid oscillation.
  let raf = 0;
  let running = false;
  let badMs = 0;
  let goodMs = 0;
  let last = 0;

  function sample(ts) {
    raf = 0;
    if (!running) return;
    if (!last) last = ts;
    const dt = ts - last;
    last = ts;

    // Ignore long background/suspend jumps.
    if (dt > 0 && dt < 120) {
      if (dt > 24) {
        badMs += dt;
        goodMs = 0;
      } else if (dt < 19) {
        goodMs += dt;
        badMs = Math.max(0, badMs - dt * 0.25);
      } else {
        badMs = Math.max(0, badMs - dt * 0.1);
        goodMs = Math.max(0, goodMs - dt * 0.1);
      }

      if (badMs > 2200 && !document.documentElement.classList.contains('bp-adaptive-lite')) {
        document.documentElement.classList.add('bp-adaptive-lite');
        badMs = 0;
        goodMs = 0;
      } else if (goodMs > 7000 && document.documentElement.classList.contains('bp-adaptive-lite')) {
        document.documentElement.classList.remove('bp-adaptive-lite');
        goodMs = 0;
      }
    }

    // Sample roughly 4 times/second, not every frame.
    raf = window.setTimeout(() => requestAnimationFrame(sample), 250);
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(sample);
  }

  function stop() {
    running = false;
    if (raf) {
      clearTimeout(raf);
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  }, { passive: true });

  // A performance layer is useful only while the game is visible.
  start();

  // Board geometry changes (orientation, browser chrome, responsive layout) invalidate
  // the cached metrics used by drag/preview. ResizeObserver avoids polling layout.
  const attachObservers = () => {
    try {
      if (typeof window.invalidateBoardMetrics !== 'function') return;
      const RO = window.ResizeObserver;
      if (!RO) return;
      document.querySelectorAll('.board').forEach((board) => {
        if (board.__bpPerfObserved) return;
        board.__bpPerfObserved = true;
        const ro = new RO(() => {
          try { window.invalidateBoardMetrics(); } catch (_) {}
        });
        ro.observe(board);
        if (board.parentElement) ro.observe(board.parentElement);
      });
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachObservers, { once: true });
  } else {
    attachObservers();
  }

  // Re-check after screen/board creation without polling.
  const mo = new MutationObserver(() => {
    attachObservers();
  });
  try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
})();
