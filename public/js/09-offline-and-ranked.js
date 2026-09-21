/**
 * Block Puzzle — 09-offline-and-ranked.js
 * Offline bots mode and ranked queue entry / roomMatchMode state
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

// —— Offline mode: classic + bots only ——
function isAppOnline() {
  try {
    if (typeof navigator.onLine === 'boolean') return navigator.onLine;
  } catch (_) {}
  return true;
}
function applyOfflineMode(online) {
  const on = !!online;
  try {
    document.body.classList.toggle('is-offline', !on);
  } catch (_) {}
  try { setNetStatus(on, on ? null : 'network'); } catch (_) {}
  const chip = document.getElementById('offlineChip');
  if (chip) chip.style.display = on ? 'none' : '';
  // Soft-disable online entry points
  const card = document.getElementById('cardOnline');
  if (card) {
    card.setAttribute('aria-disabled', on ? 'false' : 'true');
    card.title = on ? '' : 'Нужен интернет для рейтинговых матчей';
  }
}
function requireOnline(label) {
  // Prefer live MatchClient; navigator.onLine is often wrong in embedded browsers
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient.connect();
      return true;
    }
  } catch (_) {}
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const msg = 'Нет сети. «' + (label || 'Онлайн') + '» недоступно офлайн.';
      if (typeof showNetBanner === 'function') {
        showNetBanner('<strong>Нет интернета</strong><br/>' + msg);
      }
      return false;
    }
  } catch (_) {}
  return true;
}
window.addEventListener('online', () => applyOfflineMode(true));
window.addEventListener('offline', () => applyOfflineMode(false));
// Initial state after DOM
try { applyOfflineMode(isAppOnline()); } catch (_) {}

function goDurationFromOnline() {
  if (!requireOnline('Рейтинг')) return;
  try { closeRoomLobby(); } catch (_) {}
  try { destroyMp(); } catch (_) {}
  try { stopMatchmaking(true); } catch (_) {}
  try { if (typeof MatchClient !== 'undefined') MatchClient.leaveQueue(); } catch (_) {}
  mpMode = false;
  mpFromMatchmaking = false;
  mpGameSource = null;
  mpRoomCode = null;
  postMatchOnlineEligible = false;
  currentBot = null;
  vsModeType = 'online';
  roomMatchMode = false;
  window._roomMatchMode = false;
  showScreen('duration');
}
function goDifficulty() {
  try { destroyMp(); } catch (_) {}
  mpMode = false;
  vsModeType = 'bots';
  currentBot = null;
  renderBotList();
  showScreen('difficulty');
}
function pickOnlineOpponent() {
  const target = trophies;
  const sorted = [...BOTS].sort((a, b) =>
    Math.abs(a.trophies - target - 80) - Math.abs(b.trophies - target - 80)
  );
  const pool = sorted.slice(0, 5);
  return pool[Math.floor(Math.random() * pool.length)];
}

// —— Real online matchmaking (server queue by trophy bucket ±100) ——
let mmActive = false;
/** Ranked via authoritative server room (WebSocket MatchClient) */
let roomMatchMode = false;
window._roomMatchMode = false;
let mmSessionLink = null; /* p2p unused */
let mmFound = false;
let mmHostMode = false;
let mmDotsTimer = null;
let mmTimeout = null;
let mmTryIndex = 0;
let mmExpandLevel = 0;
let mmHostBucket = null;
let mmSearchGen = 0;
let mmExpandTimers = [];
/** After ranked match / «Ещё матч», avoid instantly re-pairing the same opponent. */
let mmExcludeSessionId = null;
let mmExcludeUntil = 0;
// Every ranked-search run gets its own generation. Late server promises from an
// older search must never attach themselves to a newer queue.
function mmGenAlive(gen) {
  return gen === mmSearchGen && mmActive && !mmFound;
}

// Skill-based queue: trophy buckets, rating check, expand gap over time
function mmTrophyBucket(t) {
  return Math.floor(Math.max(0, t) / 50) * 50;
}
function mmQueueId(bucket) {
  // Separate queues per match duration + trophy band
  return 'bpmmq6-d' + (vsDuration || 120) + '-b' + bucket;
}
/** Allowed trophy gap grows while searching */
function mmMaxGap() {
  // ±75 → ±100 → ±150 → ±220
  return [75, 100, 150, 220][Math.min(mmExpandLevel, 3)];
}
function mmBucketsAround() {
  const b = mmTrophyBucket(trophies);
  const gap = mmMaxGap();
  const set = new Set([b]);
  for (let step = 50; step <= gap + 25; step += 50) {
    if (b - step >= 0) set.add(b - step);
    set.add(b + step);
  }
  // Own skill band first, then nearest bands
  const list = [b];
  for (const x of [...set].sort((a, c) => Math.abs(a - b) - Math.abs(c - b) || a - c)) {
    if (x !== b) list.push(x);
  }
  return list;
}
function mmRatingOk(theirT) {
  // Missing/invalid trophies = reject (no open skill gate)
  if (typeof theirT !== 'number' || !Number.isFinite(theirT) || theirT < 0) return false;
  return Math.abs(theirT - trophies) <= mmMaxGap();
}
/** Same account / same device probing its own host seat */
/** Queue peer IDs ordered by skill proximity (optionally skip our hosted seat) */
function stopMatchmaking(silent) {
  mmActive = false;
  clearInterval(mmDotsTimer); mmDotsTimer = null;
  clearTimeout(mmTimeout); mmTimeout = null;
  (mmExpandTimers || []).forEach(clearTimeout);
  mmExpandTimers = [];
  try {
    if (window._roomExpandIv) {
      clearInterval(window._roomExpandIv);
      window._roomExpandIv = null;
    }
  } catch (_) {}
  try {
    if (!mmFound && typeof MatchClient !== 'undefined') MatchClient.leaveQueue();
  } catch (_) {}
  if (!mmFound) {
    /* p2p removed */
    mmSessionLink = null; /* p2p unused */
  }
  if (!silent) setMpStatus('');
}

function mmSetStatus(s, name) {
  const st = document.getElementById('mmStatus');
  const nm = document.getElementById('mmName');
  const box = document.getElementById('mmBox');
  if (st) st.textContent = s;
  if (nm && name !== undefined) nm.textContent = name;
  if (box) {
    const found = /найден|начина|синхрон|Матч/i.test(String(s || ''));
    box.classList.toggle('mm-found', found);
  }
}

function mmDurationLabel() {
  const d = vsDuration || 120;
  if (d <= 60) return '1 мин';
  if (d >= 180) return '3 мин';
  return '2 мин';
}
function mmUpdateHint() {
  const hint = document.getElementById('mmHint');
  if (!hint) return;
  const g = mmMaxGap();
  const lo = Math.max(0, trophies - g);
  const hi = trophies + g;
  hint.textContent = mmDurationLabel() + ' · уровень 🏆 ' + lo + '–' + hi +
    (mmExpandLevel > 0 ? ' · расширяем' : '');
}

/**
 * Elo-style trophy change for real online matches.
 * Win vs higher rating → more cups; win vs lower → fewer.
 * Loss vs higher → fewer cups lost; loss vs lower → more lost.
 */
function calcOnlineTrophyDelta(won, draw, myT, oppT, duration) {
  if (draw) return 0;
  const K = duration <= 60 ? 24 : duration <= 120 ? 32 : 40;
  const me = Math.max(0, myT | 0);
  const opp = (typeof oppT === 'number') ? Math.max(0, oppT) : me;
  const expected = 1 / (1 + Math.pow(10, (opp - me) / 400));
  if (won) {
    return Math.max(8, Math.min(52, Math.round(K * (1 - expected))));
  }
  // loss: -K * expected  (stronger opp → smaller expected → smaller loss)
  return -Math.max(6, Math.min(42, Math.round(K * expected)));
}

let mpOppTrophies = null;

/** Host: wait for guest hello, check rating, then accept or reject */



function unlockRoomPlay() {
  try {
    window._rejoinLoading = false;
    window._rejoinInputLock = false;
    placingLock = false;
    isDragging = false;
    selectedIdx = -1;
    dragPiece = null;
    activeDragPointerId = null;
  } catch (_) {}
  try {
    document.body.classList.remove('rejoin-loading');
    const el = document.getElementById('rejoinLoading');
    if (el) el.classList.remove('show');
  } catch (_) {}
  try {
    document.querySelectorAll('#piecesAreaVs .piece-slot.lifting').forEach(s => {
      s.classList.remove('lifting');
      s.style.visibility = '';
      s.style.opacity = '';
    });
  } catch (_) {}
  try { hideGhost && hideGhost(); } catch (_) {}
}

function applyRoomState(data) {
  if (!data) return;
  try { unlockRoomPlay(); } catch (_) {}
  try {
    roomMatchMode = true;
    window._roomMatchMode = true;
    vsActive = true;
    mpMode = true;
    mode = 'versus';
  } catch (_) {}

  // Throttle rapid full-sync storms (periodic sync + place echoes)
  try {
    const now = Date.now();
    if (data._fromSync && window._lastRoomApplyAt && (now - window._lastRoomApplyAt) < 1200) {
      // Still allow score/clock quiet updates
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        window._matchClockEndTs = data.clockEndTs;
        const nextLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
        if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) vsTimeLeft = nextLeft;
      }
      return;
    }
    window._lastRoomApplyAt = now;
  } catch (_) {}

  try {
    if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
      window._matchClockEndTs = data.clockEndTs;
      const nextLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
      if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) vsTimeLeft = nextLeft;
    } else if (typeof data.vsTimeLeft === 'number') {
      const nextLeft = Math.max(0, data.vsTimeLeft | 0);
      if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) vsTimeLeft = nextLeft;
    }
  } catch (_) {}

  const dragging = !!(typeof isDragging !== 'undefined' && isDragging);
  let myBoardChanged = false;
  let oppBoardChanged = false;
  let myHandChanged = false;
  let oppHandChanged = false;
  let scoresChanged = false;

  const me = data.me || null;
  const opp = data.opp || null;

  function adoptHand(src) {
    return (src || []).map(p => ({
      shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
      color: p.color,
      used: !!p.used
    }));
  }
  function handSig(arr) {
    try {
      return (arr || []).map(p => (p && p.used ? 'U' : 'A') + (p && p.color ? p.color : '') + ((p && p.shape) ? p.shape.length : 0)).join(',');
    } catch (_) { return ''; }
  }

  try {
    // Prefer structured me/opp, then flat place_ok / opp_place fields
    if (me) {
      if (typeof me.score === 'number' && (me.score | 0) !== (score | 0)) { score = me.score | 0; scoresChanged = true; }
      if (Array.isArray(me.grid)) {
        const next = me.grid.map(row => (row || []).slice());
        if (gridSig(next) !== gridSig(grid)) { grid = next; myBoardChanged = true; }
      }
      if (Array.isArray(me.pieces) && !dragging) {
        const next = adoptHand(me.pieces);
        if (handSig(next) !== handSig(pieces)) { pieces = next; myHandChanged = true; }
      }
    }
    if (typeof data.score === 'number' && !data.me && (data.score | 0) !== (score | 0)) { score = data.score | 0; scoresChanged = true; }
    if (Array.isArray(data.grid) && !data.me) {
      const next = data.grid.map(row => (row || []).slice());
      if (gridSig(next) !== gridSig(grid)) { grid = next; myBoardChanged = true; }
    }
    if (Array.isArray(data.pieces) && !data.me && !dragging) {
      const next = adoptHand(data.pieces);
      if (handSig(next) !== handSig(pieces)) { pieces = next; myHandChanged = true; }
    }
    // New deal always wins (hand was empty)
    if (Array.isArray(data.deal) && data.deal.length) {
      pieces = adoptHand(data.deal);
      myHandChanged = true;
    }
    // place_ok / opp_place aliases
    if (typeof data.meScore === 'number' && (data.meScore | 0) !== (score | 0)) { score = data.meScore | 0; scoresChanged = true; }
    if (Array.isArray(data.meGrid)) {
      const next = data.meGrid.map(row => (row || []).slice());
      if (gridSig(next) !== gridSig(grid)) { grid = next; myBoardChanged = true; }
    }
    if (Array.isArray(data.mePieces) && !dragging) {
      const next = adoptHand(data.mePieces);
      if (handSig(next) !== handSig(pieces)) { pieces = next; myHandChanged = true; }
    }
  } catch (_) {}

  try {
    if (opp) {
      if (typeof opp.score === 'number' && (opp.score | 0) !== (oppScore | 0)) { oppScore = opp.score | 0; scoresChanged = true; }
      if (Array.isArray(opp.grid)) {
        const next = opp.grid.map(row => (row || []).slice());
        if (gridSig(next) !== gridSig(oppGrid)) { oppGrid = next; oppBoardChanged = true; }
      }
      if (Array.isArray(opp.pieces)) {
        const next = adoptHand(opp.pieces);
        if (handSig(next) !== handSig(oppPieces)) { oppPieces = next; oppHandChanged = true; }
      }
      if (opp.name) { mpOppName = opp.name; oppName = opp.name; }
    }
    if (typeof data.oppScore === 'number' && (data.oppScore | 0) !== (oppScore | 0)) { oppScore = data.oppScore | 0; scoresChanged = true; }
    if (Array.isArray(data.oppGrid)) {
      const next = data.oppGrid.map(row => (row || []).slice());
      if (gridSig(next) !== gridSig(oppGrid)) { oppGrid = next; oppBoardChanged = true; }
    }
    if (Array.isArray(data.oppPieces)) {
      const next = adoptHand(data.oppPieces);
      if (handSig(next) !== handSig(oppPieces)) { oppPieces = next; oppHandChanged = true; }
    }
    // opp_place: mover board is data.grid, mover pieces data.pieces
    if (Array.isArray(data.grid) && data.meGrid == null && data.me == null && data.oppGrid == null) {
      // already handled above for local; for opp_place path we map in handler
    }
  } catch (_) {}

  try {
    // Never clear placingLock while player is mid-gesture
    if (!dragging) placingLock = false;
    window._rejoinLoading = false;
    window._rejoinInputLock = false;
  } catch (_) {}

  // Soft differential renders — avoid full DOM wipe (fixes jump / flicker)
  try {
    if (myBoardChanged && typeof boardMe !== 'undefined' && boardMe) {
      if (typeof softRenderGrid === 'function') softRenderGrid(grid, boardMe);
      else renderGrid(grid, boardMe);
    }
    if (oppBoardChanged && typeof boardOpp !== 'undefined' && boardOpp) {
      if (typeof softRenderGrid === 'function') softRenderGrid(oppGrid, boardOpp);
      else renderGrid(oppGrid, boardOpp);
    }
  } catch (_) {}
  try {
    if (myHandChanged && !dragging) {
      const area = document.getElementById('piecesAreaVs');
      if (area) {
        if (typeof softRenderPieces === 'function') softRenderPieces(area);
        else if (typeof renderPieces === 'function') renderPieces(area);
      }
    }
    if (oppHandChanged) {
      if (typeof softRenderOppPieces === 'function') softRenderOppPieces();
      else if (typeof renderOppPieces === 'function') renderOppPieces();
    }
  } catch (_) {}
  try {
    if (scoresChanged) {
      const myEl = document.getElementById('myScore');
      const oppEl = document.getElementById('oppScore');
      if (myEl) myEl.textContent = String(score);
      if (oppEl) oppEl.textContent = String(oppScore);
    }
  } catch (_) {}
  try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
  try { ensureMatchClockRunning && ensureMatchClockRunning(); } catch (_) {}
}

