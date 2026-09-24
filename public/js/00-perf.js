/**
 * BPPerf — client performance profiler (v3.9.30)
 *
 * Enable: localStorage.setItem('bp_perf','1')  or  ?perf=1
 * After match: BPPerf.log()
 * Buckets: softRender, softGrid, softPieces, placeRtt, fps
 */
(function (global) {
  'use strict';

  var MAX = 80;
  var buckets = {
    softRender: [],
    softGrid: [],
    softPieces: [],
    placeRtt: [],
    fps: []
  };
  var marks = Object.create(null);
  var enabled = false;
  var overlayEl = null;
  var lastFrame = 0;
  var rafId = 0;

  function avg(a) {
    if (!a.length) return 0;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }

  function push(name, ms) {
    var a = buckets[name];
    if (!a) buckets[name] = a = [];
    a.push(ms);
    if (a.length > MAX) a.shift();
  }

  function now() {
    try { return performance.now(); } catch (_) { return Date.now(); }
  }

  var BPPerf = {
    enable: function (on) {
      enabled = on !== false;
      try {
        if (enabled) localStorage.setItem('bp_perf', '1');
        else localStorage.removeItem('bp_perf');
      } catch (_) {}
      if (enabled) {
        BPPerf._overlay(true);
        BPPerf._raf(true);
      } else {
        BPPerf._overlay(false);
        BPPerf._raf(false);
      }
      return enabled;
    },
    isEnabled: function () { return enabled; },
    mark: function (label) { marks[label] = now(); },
    measure: function (label, bucket) {
      var t0 = marks[label];
      if (t0 == null) return 0;
      var ms = now() - t0;
      delete marks[label];
      if (bucket) push(bucket, ms);
      return ms;
    },
    sample: function (bucket, ms) { push(bucket, ms); },
    /** Alias used in docs */
    log: function () {
      var r = BPPerf.report();
      try { console.log('[BPPerf]', r); } catch (_) {}
      return r;
    },
    report: function () {
      var out = { enabled: enabled };
      Object.keys(buckets).forEach(function (k) {
        var a = buckets[k];
        out[k] = {
          n: a.length,
          avgMs: Math.round(avg(a) * 100) / 100,
          lastMs: a.length ? Math.round(a[a.length - 1] * 100) / 100 : 0
        };
      });
      return out;
    },
    _raf: function (on) {
      if (!on) {
        if (rafId) try { cancelAnimationFrame(rafId); } catch (_) {}
        rafId = 0;
        return;
      }
      if (rafId) return;
      lastFrame = 0;
      function loop(ts) {
        if (!enabled) { rafId = 0; return; }
        if (lastFrame) {
          var dt = ts - lastFrame;
          if (dt > 0) push('fps', 1000 / dt);
        }
        lastFrame = ts;
        rafId = requestAnimationFrame(loop);
      }
      rafId = requestAnimationFrame(loop);
    },
    _overlay: function (on) {
      if (!on) {
        if (overlayEl && overlayEl.parentNode) try { overlayEl.parentNode.removeChild(overlayEl); } catch (_) {}
        overlayEl = null;
        return;
      }
      if (overlayEl) return;
      try {
        overlayEl = document.createElement('div');
        overlayEl.id = 'bp-perf-overlay';
        overlayEl.style.cssText =
          'position:fixed;top:8px;right:8px;z-index:99999;font:11px/1.35 ui-monospace,monospace;' +
          'background:rgba(0,0,0,.72);color:#9f9;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre;';
        document.body.appendChild(overlayEl);
        setInterval(function () {
          if (!overlayEl || !enabled) return;
          var r = BPPerf.report();
          overlayEl.textContent =
            'BPPerf\n' +
            'soft  ' + (r.softRender.avgMs || r.softGrid.avgMs || 0) + 'ms\n' +
            'hand  ' + (r.softPieces.avgMs || 0) + 'ms\n' +
            'rtt   ' + (r.placeRtt.avgMs || 0) + 'ms\n' +
            'fps   ' + Math.round(r.fps.avgMs || 0);
        }, 500);
      } catch (_) {}
    }
  };

  try {
    var q = typeof location !== 'undefined' ? location.search || '' : '';
    var ls = '';
    try { ls = localStorage.getItem('bp_perf') || ''; } catch (_) {}
    if (/[?&]perf=1\b/.test(q) || ls === '1') {
      setTimeout(function () { BPPerf.enable(true); }, 40);
    }
  } catch (_) {}

  global.BPPerf = BPPerf;
})(typeof window !== 'undefined' ? window : this);
