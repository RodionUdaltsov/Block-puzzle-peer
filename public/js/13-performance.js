/* 13-performance.js — graphics quality manager (v3.11)
 *
 * One place that decides how heavy the visuals are and exposes it as classes on <html>:
 *
 *   bp-q-high | bp-q-balanced | bp-q-low      effective preset
 *   bp-skin-full | bp-skin-tray | bp-skin-off  skin shimmer: every cell / hand+ghost only / static
 *   bp-field-full | bp-field-lite | bp-field-off   animated board fields
 *   bp-fx-full | bp-fx-lite | bp-fx-off        particles / sparks / debris
 *   bp-glow-full | bp-glow-lite | bp-glow-off  glow radius + backdrop blur
 *   bp-full-board-fx                            (legacy gate, kept for styles-board.css)
 *
 * Settings (see 02-bots-achievements-settings.js):
 *   gfx        auto | high | balanced | low
 *   gfxSkin    auto | full | tray | off
 *   gfxField   auto | full | lite | off
 *   gfxFx      auto | full | lite | off
 *   gfxGlow    auto | full | lite | off
 *   gfxFps     0 | 1         FPS counter
 *
 * "auto" = detected device tier, then (in auto only) stepped down when frame pacing is
 * measurably bad during real gameplay. The step-down is remembered for 7 days.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const mm = (q) => {
    try { return !!window.matchMedia && window.matchMedia(q).matches; }
    catch (_) { return false; }
  };
  const LS_CAP = 'bp_gfx_auto_cap';
  const CAP_TTL = 7 * 24 * 3600 * 1000;
  const TIERS = ['low', 'balanced', 'high'];

  const coarse = mm('(pointer: coarse)') || ('ontouchstart' in window && (navigator.maxTouchPoints || 0) > 0);
  const small = mm('(max-width: 900px)');
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0);
  const dpr = Number(window.devicePixelRatio || 1);
  const conn = navigator.connection || {};
  const saveData = !!conn.saveData;
  const prefersReduced = mm('(prefers-reduced-motion: reduce)');
  const ua = String(navigator.userAgent || '');
  const isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);

  /* ---------- 1. device tier detection ---------- */
  function gpuHint() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return '';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return r;
    } catch (_) { return ''; }
  }

  function detectTier() {
    if (saveData || prefersReduced) return 'low';
    // Desktop / laptop with a real pointer
    if (!coarse) return (cores && cores < 4) ? 'balanced' : 'high';
    // Phones & tablets
    let score = 0;
    if (cores >= 8) score += 2; else if (cores >= 6) score += 1; else if (cores > 0 && cores <= 4) score -= 1;
    if (memory >= 6) score += 2; else if (memory >= 4) score += 1; else if (memory > 0 && memory <= 3) score -= 2;
    if (isIOS) score += 1;                 // Apple SoCs are strong for their core count
    if (dpr >= 3 && !isIOS) score -= 1;    // dense Android panels = many pixels to fill
    const gpu = gpuHint();
    if (/Mali-(4|T[0-7])|Adreno \(TM\) ?(2|3|4|5[0-2])\d|PowerVR|SwiftShader|llvmpipe/i.test(gpu)) score -= 2;
    if (/Adreno \(TM\) ?(6[4-9]|7|8)\d|Mali-G(7[0-9]|6[5-9]|[89]\d)|Apple GPU/i.test(gpu)) score += 1;
    if (score >= 4) return 'high';
    if (score <= -2) return 'low';
    return 'balanced';
  }
  const detected = detectTier();

  /* ---------- 2. presets & resolution ---------- */
  const PRESETS = {
    high:     { skin: 'full', field: 'full', fx: 'full', glow: 'full' },
    balanced: { skin: 'tray', field: 'lite', fx: 'lite', glow: 'full' },
    low:      { skin: 'off',  field: 'off',  fx: 'lite', glow: 'lite' }
  };

  function readCap() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_CAP) || 'null');
      if (!raw || !TIERS.includes(raw.tier)) return null;
      if (Date.now() - (raw.ts || 0) > CAP_TTL) { localStorage.removeItem(LS_CAP); return null; }
      return raw.tier;
    } catch (_) { return null; }
  }
  function writeCap(tier) {
    try {
      if (!tier) localStorage.removeItem(LS_CAP);
      else localStorage.setItem(LS_CAP, JSON.stringify({ tier, ts: Date.now() }));
    } catch (_) {}
  }
  let autoCap = readCap();           // lowest tier the monitor has demoted us to
  let sessionDemotion = null;        // demotion applied in this session (auto only)

  function cfg() {
    try { return (typeof settings !== 'undefined' && settings) ? settings : {}; }
    catch (_) { return {}; }
  }

  function autoTier() {
    let t = detected;
    const caps = [autoCap, sessionDemotion].filter(Boolean);
    caps.forEach((c) => { if (TIERS.indexOf(c) < TIERS.indexOf(t)) t = c; });
    return t;
  }

  function resolve() {
    const s = cfg();
    const mode = ['high', 'balanced', 'low'].includes(s.gfx) ? s.gfx : 'auto';
    const tier = mode === 'auto' ? autoTier() : mode;
    const p = PRESETS[tier];
    const pick = (key, allowed) => (allowed.includes(s[key]) ? s[key] : p[key.replace('gfx', '').toLowerCase()]);
    return {
      mode,
      tier,
      skin: pick('gfxSkin', ['full', 'tray', 'off']),
      field: pick('gfxField', ['full', 'lite', 'off']),
      fx: pick('gfxFx', ['full', 'lite', 'off']),
      glow: pick('gfxGlow', ['full', 'lite', 'off']),
      fps: s.gfxFps === '1'
    };
  }

  function setGroup(prefix, values, current) {
    values.forEach((v) => root.classList.toggle(prefix + v, v === current));
  }

  let current = null;
  let lastFps = null;
  let lastMode = null;
  function apply() {
    const r = resolve();
    current = r;
    setGroup('bp-q-', ['high', 'balanced', 'low'], r.tier);
    setGroup('bp-skin-', ['full', 'tray', 'off'], r.skin);
    setGroup('bp-field-', ['full', 'lite', 'off'], r.field);
    setGroup('bp-fx-', ['full', 'lite', 'off'], r.fx);
    setGroup('bp-glow-', ['full', 'lite', 'off'], r.glow);
    // legacy gates used by styles-board.css
    root.classList.toggle('bp-full-board-fx', r.field !== 'off');
    root.classList.toggle('bp-mobile-perf', coarse && small);
    root.classList.toggle('bp-mobile-perf-lite', r.tier === 'low');
    try {
      // Only touch the profiler when the setting itself changed (keeps ?perf=1 working).
      if (r.fps !== lastFps) {
        if (window.BPPerf && BPPerf.enable && (r.fps || lastFps !== null)) BPPerf.enable(r.fps);
        lastFps = r.fps;
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('bp-gfx-change', { detail: r })); } catch (_) {}
    return r;
  }

  /* Public helpers used by gameplay code (particles, debris, beams) */
  const BPGfx = {
    detected,
    get state() { return current || apply(); },
    /** 0 = none, otherwise a multiplier for particle counts. */
    fxScale() {
      const f = (current || apply()).fx;
      return f === 'full' ? 1 : f === 'lite' ? 0.5 : 0;
    },
    /** Hard cap on simultaneously-live decorative DOM particles. */
    maxLiveParticles() {
      const f = (current || apply()).fx;
      return f === 'full' ? 90 : f === 'lite' ? 36 : 0;
    },
    refresh: apply,
    resetAuto() { autoCap = null; sessionDemotion = null; writeCap(null); apply(); }
  };
  window.BPGfx = BPGfx;

  apply();

  // Re-apply whenever the player changes a setting (applySettings() is called after each chip tap).
  lastMode = cfg().gfx;
  const origApply = typeof applySettings === 'function' ? applySettings : null;
  if (origApply) {
    try {
      // eslint-disable-next-line no-global-assign
      applySettings = function () {
        const out = origApply.apply(this, arguments);
        try {
          const m = cfg().gfx;
          // Player tapped "Авто" again → forget old step-downs and re-measure.
          if (lastMode !== null && lastMode !== m && (m === 'auto' || m === undefined)) BPGfx.resetAuto();
          lastMode = m;
          apply(); markGfxChips();
        } catch (_) {}
        return out;
      };
    } catch (_) {}
  }

  /* Settings screen: show what "Авто" currently resolved to */
  function markGfxChips() {
    try {
      const r = current || apply();
      const lab = document.getElementById('gfxAutoInfo');
      if (lab) {
        const names = { high: 'Макс', balanced: 'Баланс', low: 'Эконом' };
        const namesEn = { high: 'High', balanced: 'Balanced', low: 'Battery' };
        const en = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
        lab.textContent = (en ? 'Now: ' : 'Сейчас: ') + (en ? namesEn : names)[r.tier] +
          (r.mode === 'auto' ? (en ? ' (auto)' : ' (авто)') : '');
      }
    } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', markGfxChips, { once: true });
  window.addEventListener('bp-gfx-change', markGfxChips);

  /* ---------- 3. pause decorative work when hidden ---------- */
  const syncVisibility = () => {
    try { root.classList.toggle('bp-page-hidden', document.hidden); } catch (_) {}
  };
  document.addEventListener('visibilitychange', syncVisibility, { passive: true });
  syncVisibility();

  /* ---------- 4. frame-pacing monitor (auto mode only) ---------- */
  // Measure a short burst of contiguous frames every few seconds, but ONLY while a play
  // screen is visible. A demotion needs two consecutive bad bursts (no one-off hiccups).
  let monitorTimer = 0;
  let badStreak = 0;
  let burstRaf = 0;

  function playScreenActive() {
    try {
      const a = document.querySelector('.screen.active');
      return !!a && (a.id === 'screenClassic' || a.id === 'screenVersus');
    } catch (_) { return false; }
  }

  function burst() {
    const frames = [];
    let last = 0;
    const N = 40;
    const step = (ts) => {
      burstRaf = 0;
      if (document.hidden) return;
      if (last) frames.push(ts - last);
      last = ts;
      if (frames.length < N) { burstRaf = requestAnimationFrame(step); return; }
      evaluate(frames);
    };
    burstRaf = requestAnimationFrame(step);
  }

  function evaluate(frames) {
    // Drop outliers caused by GC / tab switches, judge on the median + 90th percentile.
    const f = frames.filter((x) => x > 0 && x < 250).sort((a, b) => a - b);
    if (f.length < 20) return;
    const med = f[Math.floor(f.length * 0.5)];
    const p90 = f[Math.floor(f.length * 0.9)];
    // Refresh-rate aware: a 120 Hz panel at 60 fps is fine (med ≈ 16.7) — only act on clearly slow frames.
    const bad = med > 24 || p90 > 40;
    badStreak = bad ? badStreak + 1 : 0;
    if (BPGfx._debug) { try { console.log('[BPGfx] med', med.toFixed(1), 'p90', p90.toFixed(1), 'streak', badStreak); } catch (_) {} }
    if (badStreak >= 2) {
      badStreak = 0;
      demote();
    }
  }

  function demote() {
    const r = current || apply();
    if (r.mode !== 'auto') return;
    const i = TIERS.indexOf(r.tier);
    if (i <= 0) return;
    sessionDemotion = TIERS[i - 1];
    // Persist only after a second demotion in a *later* session would be overkill; keep it simple:
    // remember for a week, the player can press "Авто" again in settings to re-measure.
    autoCap = sessionDemotion;
    writeCap(autoCap);
    apply();
  }

  function tick() {
    monitorTimer = 0;
    const r = current || apply();
    if (r.mode === 'auto' && !document.hidden && playScreenActive() && !burstRaf) burst();
    monitorTimer = setTimeout(tick, 4000);
  }
  // Start after boot settles so loading spikes never count.
  setTimeout(() => { if (!monitorTimer) monitorTimer = setTimeout(tick, 4000); }, 6000);
  document.addEventListener('visibilitychange', () => { badStreak = 0; }, { passive: true });
  window.addEventListener('bp-gfx-change', () => { badStreak = 0; });

  /* ---------- 5. board geometry observers (drag math) ---------- */
  const attachObservers = () => {
    try {
      if (typeof window.invalidateBoardMetrics !== 'function') return;
      const RO = window.ResizeObserver;
      if (!RO) return;
      document.querySelectorAll('.board').forEach((board) => {
        if (board.__bpPerfObserved) return;
        board.__bpPerfObserved = true;
        const ro = new RO(() => { try { window.invalidateBoardMetrics(); } catch (_) {} });
        ro.observe(board);
        if (board.parentElement) ro.observe(board.parentElement);
      });
    } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachObservers, { once: true });
  else attachObservers();
  // Boards are created once at boot; watch only direct structural changes, debounced.
  let moTimer = 0;
  try {
    const mo = new MutationObserver(() => {
      if (moTimer) return;
      moTimer = setTimeout(() => { moTimer = 0; attachObservers(); }, 400);
    });
    mo.observe(document.body, { childList: true, subtree: false });
    document.querySelectorAll('.screen').forEach((s) => mo.observe(s, { childList: true }));
  } catch (_) {}

  /* ---------- 6. holo-sweep overlay (one cheap layer per board instead of one per cell) ---------- */
  function ensureSweeps() {
    try {
      document.querySelectorAll('.board-wrap').forEach((wrap) => {
        if (wrap.querySelector(':scope > .bp-holo-sweep')) return;
        if (wrap.closest('#skinPreviewModal')) return;
        const el = document.createElement('div');
        el.className = 'bp-holo-sweep';
        el.setAttribute('aria-hidden', 'true');
        wrap.appendChild(el);
      });
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureSweeps, { once: true });
  else ensureSweeps();
  window.addEventListener('bp-gfx-change', ensureSweeps);
  document.addEventListener('visibilitychange', ensureSweeps, { passive: true });
  BPGfx.ensureSweeps = ensureSweeps;
})();
