/**
 * Block Puzzle — js/05-render-and-match-state/04-disconnect-afk-ui.js
 * Disconnect / AFK banners, timers and win resolution.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** While a live online match is running, accept opponent reconnect on ANY role. */
/** Register once: any incoming peer during live match is treated as rejoin. */
/* ========== Disconnect + AFK (time-first, no stalling) ==========
   AFK: 15s idle → bottom warn (15s left) → 30s total → AFK loss
   Disconnect: center overlay on opp board; wait min(60s, vsTimeLeft)
   If already AFK when disconnect → AFK loss immediately
   Reconnect does NOT reset timers until a real move (place)
*/
const AFK_WARN_MS = 15000;   // show bottom warning
const AFK_LIMIT_MS = 30000;  // auto-loss
const DC_LIMIT_MS = 60000;   // full disconnect wait when not AFK

let lastMyActionTs = 0;
let lastOppActionTs = 0;
let afkCheckTimer = null;
let afkBannerKind = null; // 'opp' | 'me' | null

// oppDisconnected / mpDisconnectTimer declared once above with other mp state
let dcDeadlineTs = 0;       // absolute end time for disconnect wait (opponent)
let dcWasAfk = false;       // disconnected while already AFK
let dcPausedByReconnect = false; // linked again but no move yet
let oppDcAt = 0;            // when opponent left (wall clock)
let myDcAt = 0;             // when I left (wall clock)
let bothAwayMode = false;   // both players currently away from the match

function ensureStatusToastStack() {
  let stack = document.getElementById('statusToastStack');
  if (stack) return stack;
  const vs = document.getElementById('screenVersus');
  if (!vs) return null;
  stack = document.createElement('div');
  stack.id = 'statusToastStack';
  stack.className = 'status-toast-stack';
  // Place under boards, before player pieces tray
  const piecesLabel = vs.querySelector('.opp-pieces-label:last-of-type') || document.getElementById('piecesAreaVs');
  const anchor = document.getElementById('disconnectBanner') || piecesLabel;
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(stack, anchor);
  } else {
    vs.appendChild(stack);
  }
  // Hide legacy single banner
  try {
    const legacy = document.getElementById('disconnectBanner');
    if (legacy) legacy.style.display = 'none';
  } catch (_) {}
  return stack;
}

function statusToastText(sec, kind) {
  if (kind === 'afk') {
    return sec > 0
      ? ('⏱ АФК соперника — автопобеда через ' + sec + ' сек')
      : '⏱ АФК соперника…';
  }
  if (kind === 'afk-me') {
    return sec > 0
      ? ('⏱ Вы АФК — автопоражение через ' + sec + ' сек')
      : '⏱ Вы АФК…';
  }
  if (kind === 'need-move') {
    return sec > 0
      ? ('📡 Нужен ход — сделай ход · ' + sec + ' сек')
      : '📡 Нужен ход — сделай ход';
  }
  if (kind === 'need-move-opp') {
    return sec > 0
      ? ('📡 Соперник вернулся — ждём ход · ' + sec + ' сек')
      : '📡 Соперник вернулся — ждём ход';
  }
  return sec > 0
    ? ('📡 Отсоединение… ' + sec + ' сек')
    : '📡 Отсоединение…';
}

/** Stacked bottom toasts — multiple kinds can show at once (no alternating flash). */
function showDisconnectBanner(sec, kind) {
  kind = kind || 'disconnect';
  try {
    if (kind !== 'afk' && kind !== 'afk-me' && kind !== 'need-move' && kind !== 'need-move-opp'
        && isRejoinCalm()) return;
  } catch (_) {}
  const stack = ensureStatusToastStack();
  if (!stack) {
    const el = document.getElementById('disconnectBanner');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = statusToastText(sec, kind);
    return;
  }
  let toast = stack.querySelector('.status-toast[data-kind="' + kind + '"]');
  const isAfk = (kind === 'afk' || kind === 'afk-me');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'status-toast status-banner ' +
      ((kind === 'afk' || kind === 'afk-me' || kind === 'disconnect') ? 'status-danger' : 'status-info');
    toast.dataset.kind = kind;
    // Stable structure: label + seconds so text updates don't reflow animation
    toast.innerHTML = '<span class="st-label"></span><span class="st-sec"></span>';
    stack.appendChild(toast);
    // Enter animation only once
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      try {
        toast.classList.add('show');
        toast.style.opacity = '';
        toast.style.transform = '';
      } catch (_) {}
    });
  }
  // Update text without removing .show (no blink on moves / afk ticks)
  try {
    const label = toast.querySelector('.st-label');
    const secEl = toast.querySelector('.st-sec');
    const full = statusToastText(sec, kind);
    if (label && secEl) {
      // Split "… · N сек" so only the number changes
      const m = full.match(/^(.*?)(\d+)\s*сек\s*$/);
      if (m) {
        label.textContent = m[1];
        secEl.textContent = m[2] + ' сек';
      } else {
        label.textContent = full;
        secEl.textContent = '';
      }
    } else if (toast.textContent !== full) {
      toast.textContent = full;
    }
  } catch (_) {
    const full = statusToastText(sec, kind);
    if (toast.textContent !== full) toast.textContent = full;
  }
  toast.style.display = 'block';
  // Never strip .show for AFK — that causes the blink
  if (!toast.classList.contains('show')) toast.classList.add('show');
  if (isAfk) {
    try { afkBannerKind = (kind === 'afk-me') ? 'me' : 'opp'; } catch (_) {}
  }
}

function dismissStatusToast(kind) {
  const stack = document.getElementById('statusToastStack');
  if (!stack) return;
  if (kind) {
    const toast = stack.querySelector('.status-toast[data-kind="' + kind + '"]');
    if (toast) toast.remove();
    if (kind === 'afk' || kind === 'afk-me') {
      try {
        if (kind === 'afk' && afkBannerKind === 'opp') afkBannerKind = null;
        if (kind === 'afk-me' && afkBannerKind === 'me') afkBannerKind = null;
      } catch (_) {}
    }
  }
}

function hideDisconnectBanner() {
  // NEVER wipe AFK toasts — only disconnect / need-move
  try {
    const stack = document.getElementById('statusToastStack');
    if (stack) {
      stack.querySelectorAll('.status-toast').forEach(t => {
        const k = t.dataset && t.dataset.kind;
        if (k === 'afk' || k === 'afk-me') return;
        t.remove();
      });
    }
  } catch (_) {}
  const el = document.getElementById('disconnectBanner');
  if (el) el.style.display = 'none';
}

function ensureBoardDcOverlay(which) {
  const board = which === 'me'
    ? ((typeof boardMe !== 'undefined' && boardMe) || document.getElementById('boardMe'))
    : ((typeof boardOpp !== 'undefined' && boardOpp) || document.getElementById('boardOpp'));
  if (!board) return null;
  const wrap = board.parentElement;
  if (!wrap) return null;
  let ov = wrap.querySelector('.board-dc-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'board-dc-overlay';
    ov.innerHTML = '<div class="dc-card"><div class="dc-title">📡 Отсоединение…</div><div class="dc-sub"></div></div>';
    wrap.appendChild(ov);
  }
  return ov;
}
function showBoardDisconnectOverlay(sec, which, opts) {
  opts = opts || {};
  try {
    if (!(roomMatchMode || BPState.roomMatchMode)) {
      if (isRejoinCalm()) return;
      if (sessionStorage.getItem('bp_rejoin_storm') === '1') return;
      if (bothAwayMode) return;
    }
  } catch (_) {}
  const side = which || 'opp';
  const reason = String(opts.reason || '');
  const pending = !!opts.pending;
  // AFK and "need move" must NOT cover the board — bottom notification only
  // so the player can still aim and place pieces.
  if (reason === 'afk') {
    try { hideBoardDisconnectOverlay(side); } catch (_) {}
    try { showDisconnectBanner(sec, side === 'me' ? 'afk-me' : 'afk'); } catch (_) {}
    return;
  }
  if (pending || reason === 'rejoin_pending') {
    try { hideBoardDisconnectOverlay(side); } catch (_) {}
    try {
      showDisconnectBanner(sec, side === 'me' ? 'need-move' : 'need-move-opp');
    } catch (_) {}
    return;
  }
  const ov = ensureBoardDcOverlay(side);
  if (!ov) return;
  const title = ov.querySelector('.dc-title');
  const sub = ov.querySelector('.dc-sub');
  if (title) title.textContent = side === 'me' ? '📡 Нет связи' : '📡 Отсоединение';
  if (sub) sub.textContent = sec > 0 ? ('До поражения ' + sec + ' сек') : 'Ожидание…';
  ov.classList.add('show');
}
function hideBoardDisconnectOverlay(which) {
  try {
    if (which === 'me' || which === 'opp') {
      const ov = ensureBoardDcOverlay(which);
      if (ov) ov.classList.remove('show');
    } else {
      document.querySelectorAll('.board-dc-overlay').forEach(el => el.classList.remove('show'));
    }
  } catch (_) {}
}

function clearDisconnectTimer() {
  try {
    if (window._dcGraceTimer) {
      clearTimeout(window._dcGraceTimer);
      window._dcGraceTimer = null;
    }
  } catch (_) {}
  if (mpDisconnectTimer) {
    clearInterval(mpDisconnectTimer);
    mpDisconnectTimer = null;
  }
  try {
    if (BPState.soloOverlayIv) { clearInterval(BPState.soloOverlayIv); BPState.soloOverlayIv = null; }
  } catch (_) {}
  try {
    if (BPState.soloDeadlineTimer) { clearTimeout(BPState.soloDeadlineTimer); BPState.soloDeadlineTimer = null; }
  } catch (_) {}
  try {
    if (BPState.soloDialIv) { clearInterval(BPState.soloDialIv); BPState.soloDialIv = null; }
  } catch (_) {}
  oppDisconnected = false;
  dcDeadlineTs = 0;
  dcWasAfk = false;
  dcPausedByReconnect = false;
  oppDcAt = 0;
  myDcAt = 0;
  bothAwayMode = false;
  try { BPState.soloRejoinActive = false; } catch (_) {}
  // Only clear disconnect / need-move toasts — NEVER wipe AFK banners on opp moves
  try {
    if (typeof dismissStatusToast === 'function') {
      dismissStatusToast('disconnect');
      dismissStatusToast('need-move');
      dismissStatusToast('need-move-opp');
    }
  } catch (_) {}
  hideBoardDisconnectOverlay();
}

/** Resolve when disconnect wait ends. Supports dual-away score/timer rules. */
function isServerAuthMatch() {
  try {
    return !!(roomMatchMode || BPState.roomMatchMode
      || (typeof MatchClient !== 'undefined' && MatchClient.matchId));
  } catch (_) { return false; }
}
function resolveDisconnectWin() {
  if (!vsActive || !mpMode) return;
  // Server-authoritative room: client NEVER ends the match on local DC timer.
  // Wait for match_end from server only — prevents one-sided 0:0 / false forfeit.
  try {
    if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
      try { softRedial && softRedial(); } catch (_) {}
      try {
        if (typeof MatchClient !== 'undefined' && MatchClient.connected) {
          MatchClient.sync({});
        }
      } catch (_) {}
      // Keep overlay, but do not call endVersus
      return;
    }
  } catch (_) {}
  try {
    if (noMovesYet()) {
      forceCancelPreMoveMatch('Соперник отключился до начала матча');
      return;
    }
  } catch (_) {}
  // Never award DC win during rejoin storms / recent traffic
  try {
    if (isRejoinCalm()) {
      try { softRedial(); } catch (_) {}
      return;
    }
    if (false) {
      clearDisconnectTimer();
      hideBoardDisconnectOverlay();
      oppDisconnected = false;
      return;
    }
    if (BPState.lastOppPacketAt && (Date.now() - BPState.lastOppPacketAt) < 12000) {
      clearDisconnectTimer();
      hideBoardDisconnectOverlay();
      oppDisconnected = false;
      try { softRedial(); } catch (_) {}
      return;
    }
    if (BPState.mpRejoiningMatch) {
      return;
    }
  } catch (_) {}
  try {
    const age = matchStartTs ? (Date.now() - matchStartTs) : 999999;
    if (age < 20000 && (score | 0) < 100 && (oppScore | 0) < 100) {
      clearDisconnectTimer();
      hideBoardDisconnectOverlay();
      oppDisconnected = false;
      
      try { softRedial(); } catch (_) {}
      return;
    }
  } catch (_) {}

  // Detect mutual leave from snapshot (both refreshed / both offline)
  let snapBothAway = false;
  let snapMyLeft = myDcAt || 0;
  let snapOppLeft = oppDcAt || 0;
  try {
    const snap = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
    if (snap) {
      if (snap.bothAway) snapBothAway = true;
      if (typeof snap.leftAt === 'number' && snap.leftAt > 0) snapMyLeft = snap.leftAt;
      if (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) snapOppLeft = snap.oppLeftAt;
      // If I also left recently (page refresh), I must not get a free win
      if (typeof snap.leftAt === 'number' && snap.leftAt > 0 && (Date.now() - snap.leftAt) < 90000) {
        snapBothAway = true;
      }
    }
  } catch (_) {}
  if (myDcAt > 0) snapBothAway = true;
  if (bothAwayMode) snapBothAway = true;

  const wasAfk = dcWasAfk;
  clearDisconnectTimer();
  stopAfkWatch();
  BPState.soloRejoinActive = false;
  const reason = wasAfk ? 'afk' : 'disconnect';

  // If the player is still looking at the match screen, always show result UI
  // (quiet end was causing a hard jump to main menu during AFK/DC tests).
  function _viewerOnMatch() {
    try {
      const vs = document.getElementById('screenVersus');
      return !!(vs && vs.classList.contains('active') && !document.hidden);
    } catch (_) { return true; }
  }
  function _endScoreQuietAware(r) {
    const q = !_viewerOnMatch();
    try {
      if (score > oppScore) endVersus({ forceWin: true, reason: r, quiet: q });
      else if (score < oppScore) endVersus({ forceLoss: true, reason: r, quiet: q });
      else endVersus({ reason: r, quiet: q });
    } catch (_) {}
  }

  // True AFK forfeit must not be swallowed by dual-rejoin score path
  if (wasAfk) {
    try {
      endVersus({ forceWin: true, reason: 'afk', quiet: false });
    } catch (_) {}
    return;
  }

  // Dual rejoin / any rejoin this match → NEVER "Обрыв связи" win
  let dual = !!(snapBothAway || (snapMyLeft > 0 && snapOppLeft > 0) || snapMyLeft > 0);
  try {
    if (window._thisMatchHadRejoin) dual = true;
    if (window._lastRejoinActivityAt && (Date.now() - window._lastRejoinActivityAt) < 120000) dual = true;
  } catch (_) {}
  if (dual) {
    const left = (vsTimeLeft | 0);
    if (left > 5) {
      try { markRejoinCalm(20000); } catch (_) {}
      try { softRedial(); } catch (_) {}
      
      try { persistLiveMatch(); } catch (_) {}
      try {
        oppDisconnected = true;
        // Wait only until match clock ends — then fair score, never DC win
        const clockEnd = (typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)
          ? BPState.matchClockEndTs
          : (Date.now() + left * 1000);
        dcDeadlineTs = clockEnd;
        if (mpDisconnectTimer) { clearInterval(mpDisconnectTimer); mpDisconnectTimer = null; }
        mpDisconnectTimer = setInterval(() => {
          try {
            if (BPState.matchEnded || !vsActive) {
              clearDisconnectTimer();
              return;
            }
            if (false) {
              clearDisconnectTimer();
              hideBoardDisconnectOverlay();
              return;
            }
            if (BPState.lastOppPacketAt && (Date.now() - BPState.lastOppPacketAt) < 8000) {
              clearDisconnectTimer();
              hideBoardDisconnectOverlay();
              return;
            }
            if (Date.now() >= dcDeadlineTs || (vsTimeLeft | 0) <= 0) {
              clearInterval(mpDisconnectTimer);
              mpDisconnectTimer = null;
              _endScoreQuietAware('time');
            }
          } catch (_) {}
        }, 1000);
      } catch (_) {}
      return;
    }
    _endScoreQuietAware('time');
    return;
  }

  // Absolute ban: if this client refreshed/rejoined during the match, never
  // award "Обрыв связи" win — only fair score when clock ends.
  try {
    let banned = false;
    try { if (window._thisMatchHadRejoin) banned = true; } catch (_) {}
    try {
      if (sessionStorage.getItem('bp_rejoin_storm') === '1') banned = true;
    } catch (_) {}
    try {
      if (window._lastRejoinActivityAt && (Date.now() - window._lastRejoinActivityAt) < 180000) banned = true;
    } catch (_) {}
    if (banned) {
      try {
        // Viewer still on match → show result, never silent menu jump
        const q = (function () {
          try {
            const vs = document.getElementById('screenVersus');
            return !(vs && vs.classList.contains('active') && !document.hidden);
          } catch (_) { return false; }
        })();
        if (score > oppScore) endVersus({ forceWin: true, reason: 'time', quiet: q });
        else if (score < oppScore) endVersus({ forceLoss: true, reason: 'time', quiet: q });
        else endVersus({ reason: 'time', quiet: q });
      } catch (_) {}
      return;
    }
  } catch (_) {}
  // True stayer (never rejoined this match): opponent gone long enough
  endVersus({ forceWin: true, reason });
}

/** Offline resolve when rejoin window expired (both away / no peer).
 *  force=true skips the "window still open" guard (used by expiry timer). */
function resolveBothAwayFromSnap(snap, force) {
  if (!snap || BPState.matchEnded) return false;
  // Server owns the match — never resolve from localStorage snapshot
  try {
    if (snap.serverAuth || snap.matchId
        || roomMatchMode || BPState.roomMatchMode
        || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
      return false;
    }
  } catch (_) {}
  const myLeft = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
  const oppLeft = (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) ? snap.oppLeftAt : 0;
  const myScore = (typeof snap.score === 'number') ? snap.score : 0;
  const oScore = (typeof snap.oppScore === 'number') ? snap.oppScore : 0;
  const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft : 120;
  const reconnectMs = Math.min(60000, Math.max(0, leftSec) * 1000);
  const now = Date.now();
  // My window still open → not yet time to auto-resolve (unless forced by timer)
  if (!force && (now - myLeft < reconnectMs)) return false;

  try { hideMatchRejoinPanel(); } catch (_) {}
  try {
    if (window._rejoinPanelTick) {
      clearInterval(window._rejoinPanelTick);
      window._rejoinPanelTick = null;
    }
  } catch (_) {}
  try {
    if (BPState.bothAwayResolveTimer) {
      clearTimeout(BPState.bothAwayResolveTimer);
      BPState.bothAwayResolveTimer = null;
    }
  } catch (_) {}

  // Restore boards + replay log before endVersus writes history
  try { restoreSnapState(snap); } catch (_) {}
  try {
    score = myScore;
    oppScore = oScore;
    vsTimeLeft = leftSec;
    vsDuration = snap.vsDuration || 120;
    oppName = snap.oppName || 'Соперник';
    mpMode = true;
    mode = 'versus';
    vsModeType = 'online';
    mpFromMatchmaking = !!snap.fromMM || !!snap.ranked;
    if (Array.isArray(snap.moves) && (!matchLog || !matchLog.length)) {
      matchLog = snap.moves.slice();
    }
  } catch (_) {}

  const reason = 'time';
  vsActive = true;
  BPState.mpRejoiningMatch = false;
  BPState.soloRejoinActive = false;
  try {
    // Score-based end (both left) — never "Обрыв связи".
    // If the player is still on the match screen, show the result UI.
    let quietEnd = true;
    try {
      const vs = document.getElementById('screenVersus');
      if (vs && vs.classList.contains('active') && !document.hidden) quietEnd = false;
    } catch (_) {}
    const q = { reason, silent: true, quiet: quietEnd };
    const byScore = () => {
      if (myScore > oScore) endVersus({ forceWin: true, ...q });
      else if (myScore < oScore) endVersus({ forceLoss: true, ...q });
      else endVersus({ ...q }); // draw
    };
    if (!oppLeft) {
      byScore();
    } else {
      const SIMUL_MS = 2000;
      if (Math.abs(myLeft - oppLeft) <= SIMUL_MS) {
        byScore();
      } else if (myLeft < oppLeft) {
        endVersus({ forceLoss: true, ...q });
      } else {
        endVersus({ forceWin: true, ...q });
      }
    }
  } catch (e) {
    console.warn('resolveBothAwayFromSnap', e);
  }
  try { clearLiveMatch(); } catch (_) {}
  return true;
}

/* BPPerf hooks (v3.9.30) */
(function () {
  if (typeof softRenderGrid !== 'function') return;
  var _sg = softRenderGrid;
  softRenderGrid = function (g, boardEl) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    try { return _sg.apply(this, arguments); }
    finally {
      if (typeof BPPerf !== 'undefined' && BPPerf.sample) {
        var dt = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
        BPPerf.sample('softGrid', dt);
        BPPerf.sample('softRender', dt);
      }
    }
  };
  if (typeof softRenderPieces === 'function') {
    var _sp = softRenderPieces;
    softRenderPieces = function (areaEl) {
      var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      try { return _sp.apply(this, arguments); }
      finally {
        if (typeof BPPerf !== 'undefined' && BPPerf.sample) {
          BPPerf.sample('softPieces', ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0);
        }
      }
    };
  }
})();
