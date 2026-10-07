/**
 * Block Puzzle — lib/clock.js
 * Single time source for the server: clock.now(), clock.setTimeout/setInterval/clear*.
 * Production uses the real Date/timers. Tests can swap in a deterministic fake:
 *
 *   const { clock, createFakeClock } = require('./lib/clock');
 *   const fake = createFakeClock({ start: 1_700_000_000_000 });
 *   clock.use(fake);       // install BEFORE creating rooms/timers
 *   fake.advance(61_000);  // runs due timers in order, moves now()
 *   clock.reset();         // back to the real clock
 *
 * Timers created while the real clock was active stay real; install the fake first.
 */
'use strict';

const real = {
  now: () => Date.now(),
  setTimeout: (fn, ms, ...a) => setTimeout(fn, ms, ...a),
  setInterval: (fn, ms, ...a) => setInterval(fn, ms, ...a),
  clearTimeout: (h) => clearTimeout(h),
  clearInterval: (h) => clearInterval(h)
};

let impl = real;

const clock = {
  now: () => impl.now(),
  setTimeout: (fn, ms, ...a) => impl.setTimeout(fn, ms, ...a),
  setInterval: (fn, ms, ...a) => impl.setInterval(fn, ms, ...a),
  clearTimeout: (h) => impl.clearTimeout(h),
  clearInterval: (h) => impl.clearInterval(h),
  use(next) { impl = next || real; },
  reset() { impl = real; },
  isFake() { return impl !== real; }
};

/** Deterministic clock: time only moves through advance()/runAll(). */
function createFakeClock(opts) {
  let current = Number(opts && opts.start) || 0;
  let seq = 0;
  const timers = new Map(); // id -> { id, at, fn, args, every }

  function make(fn, ms, args, every) {
    if (typeof fn !== 'function') throw new TypeError('callback must be a function');
    const delay = Math.max(0, Number(ms) || 0);
    const id = ++seq;
    const t = { id, at: current + (every ? Math.max(1, delay) : delay), fn, args, every: every ? Math.max(1, delay) : 0, order: id };
    timers.set(id, t);
    return { _fakeTimerId: id, ref() { return this; }, unref() { return this; }, hasRef() { return true; }, refresh() { return this; } };
  }
  function cancel(h) {
    const id = h && typeof h === 'object' ? h._fakeTimerId : h;
    if (id != null) timers.delete(id);
  }
  function nextDue(limit) {
    let best = null;
    for (const t of timers.values()) {
      if (t.at > limit) continue;
      if (!best || t.at < best.at || (t.at === best.at && t.order < best.order)) best = t;
    }
    return best;
  }

  const fake = {
    now: () => current,
    setTimeout: (fn, ms, ...a) => make(fn, ms, a, false),
    setInterval: (fn, ms, ...a) => make(fn, ms, a, true),
    clearTimeout: cancel,
    clearInterval: cancel,
    /** Move time forward by ms, firing every due timer in (time, creation) order. */
    advance(ms) {
      const target = current + Math.max(0, Number(ms) || 0);
      let guard = 0;
      for (;;) {
        const t = nextDue(target);
        if (!t) break;
        if (++guard > 100000) throw new Error('fake clock: runaway timers');
        current = Math.max(current, t.at);
        if (t.every) { t.at = current + t.every; t.order = ++seq; } else timers.delete(t.id);
        t.fn(...t.args);
      }
      current = target;
      return current;
    },
    /** Set absolute time without firing timers that become due (they fire on next advance). */
    set(ts) { current = Number(ts) || 0; },
    pending() { return timers.size; }
  };
  return fake;
}

module.exports = { clock, createFakeClock };
