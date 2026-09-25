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
  BPState.roomMatchMode = false;
  showScreen('duration');
}
function goDifficulty() {
  try { destroyMp(); } catch (_) {}
  try { closeRoomLobby(); } catch (_) {}
  try { stopMatchmaking(true); } catch (_) {}
  mpMode = false;
  mpRoomCode = null;
  mpGameSource = null;
  mpFromMatchmaking = false;
  roomMatchMode = false;
  BPState.roomMatchMode = false;
  postMatchOnlineEligible = false;
  vsModeType = 'bots';
  currentBot = null;
  try { document.body.classList.add('vs-bots'); } catch (_) {}
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
BPState.roomMatchMode = false;
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
// Crossplay: ONE queue for mobile + desktop + any OS (server-authoritative rules)
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
    if (BPState.roomExpandIv) {
      clearInterval(BPState.roomExpandIv);
      BPState.roomExpandIv = null;
    }
  } catch (_) {}
  try {
    if (!mmFound && typeof MatchClient !== 'undefined') MatchClient.leaveQueue();
  } catch (_) {}
  if (!mmFound) {
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
    BPState.rejoinLoading = false;
    BPState.rejoinInputLock = false;
    BPState.mpRejoiningMatch = false;
    placingLock = false;
    isDragging = false;
    selectedIdx = -1;
    dragPiece = null;
    activeDragPointerId = null;
    try { vsIntroLock = false; } catch (_) {}
    try { mpMatchStarting = false; } catch (_) {}
    try { mpLoading = false; } catch (_) {}
  } catch (_) {}
  try {
    document.body.classList.remove('rejoin-loading');
    const el = document.getElementById('rejoinLoading');
    if (el) el.classList.remove('show');
  } catch (_) {}
  try {
    document.body.classList.remove('match-ending');
    document.querySelectorAll('#piecesAreaVs .piece-slot.lifting, #piecesAreaVs .piece-slot').forEach(s => {
      s.classList.remove('lifting');
      if (!s.classList.contains('used')) {
        s.classList.add('show');
        s.style.visibility = '';
        s.style.opacity = '1';
        s.style.pointerEvents = 'auto';
        s.style.touchAction = 'none';
        s.style.filter = '';
      }
    });
  } catch (_) {}
  try { hideGhost && hideGhost(); } catch (_) {}
}

function applyRoomState(data) {
  if (!data) return;
  const stillLoading = !!(BPState.matchAwaitingGo || mpLoading || mpMatchStarting);
  if (!stillLoading) {
    try { unlockRoomPlay(); } catch (_) {}
  }
  try {
    roomMatchMode = true;
    BPState.roomMatchMode = true;
    if (!stillLoading) vsActive = true;
    mpMode = true;
    mode = 'versus';
  } catch (_) {}

  // While our optimistic place awaits place_ok, never adopt server me-grid/hand/score
  // from concurrent opp_place / periodic sync — that made the piece snap back to hand.
  const protectMyBoard = !!(BPState.pendingServerPlace && !data._forceHand && !data.deal && !data._rejoin);

  // Throttle rapid full-sync storms (periodic sync + place echoes)
  try {
    const now = Date.now();
    if (data._fromSync && window._lastRoomApplyAt && (now - window._lastRoomApplyAt) < 1200) {
      // Still allow score/clock quiet updates
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        BPState.matchClockEndTs = data.clockEndTs;
        const nextLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
        if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) vsTimeLeft = nextLeft;
      }
      return;
    }
    window._lastRoomApplyAt = now;
  } catch (_) {}

  try {
    if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
      BPState.matchClockEndTs = data.clockEndTs;
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
      return (arr || []).map(p => {
        if (!p) return 'X';
        const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
        return (p.used ? 'U' : 'A') + '|' + (p.color || '') + '|' + sh;
      }).join(',');
    } catch (_) { return ''; }
  }
  /** Prefer local slot order when remote is only a reordering of the same pieces (stops tray jump). */
  function adoptHandStable(localArr, remoteSrc) {
    const remote = adoptHand(remoteSrc);
    if (!localArr || !localArr.length || localArr.length !== remote.length) return remote;
    try {
      const localSigs = localArr.map(p => {
        if (!p) return 'X';
        const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
        return (p.color || '') + '|' + sh;
      });
      const remoteByKey = {};
      for (let i = 0; i < remote.length; i++) {
        const p = remote[i];
        const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
        const key = (p.color || '') + '|' + sh;
        if (!remoteByKey[key]) remoteByKey[key] = [];
        remoteByKey[key].push(p);
      }
      const out = [];
      const usedKeys = {};
      for (let i = 0; i < localSigs.length; i++) {
        const key = localSigs[i];
        const bucket = remoteByKey[key];
        if (bucket && bucket.length) {
          out.push(bucket.shift());
          usedKeys[key] = true;
        } else {
          return remote; // shape multiset mismatch — fall back
        }
      }
      return out;
    } catch (_) {
      return remote;
    }
  }

  try {
    // Prefer structured me/opp, then flat place_ok / opp_place fields
    if (me && !protectMyBoard) {
      if (typeof me.score === 'number' && (me.score | 0) !== (score | 0)) { score = me.score | 0; scoresChanged = true; }
      // While dragging, do not replace our board — avoids layout thrash / pointercancel on phones
      if (Array.isArray(me.grid) && !dragging) {
        const next = me.grid.map(row => (row || []).slice());
        if (gridSig(next) !== gridSig(grid)) { grid = next; myBoardChanged = true; }
      }
      if (Array.isArray(me.pieces) && !dragging) {
        const next = adoptHandStable(pieces, me.pieces);
        const localU = (pieces || []).filter(p => p && !p.used).length;
        const remoteU = next.filter(p => p && !p.used).length;
        // Only adopt on real deal / unused-count change — never cosmetic reshuffle (causes lag + unpickable)
        const force = !!(data.deal || data._forceHand || data._rejoin);
        if (force || localU !== remoteU || localU === 0) {
          if (handSig(next) !== handSig(pieces)) {
            if (!(localU > 0 && remoteU === 0 && !force)) {
              pieces = next; myHandChanged = true;
            }
          }
        }
      }
    }
    if (!protectMyBoard) {
      if (typeof data.score === 'number' && !data.me && (data.score | 0) !== (score | 0)) { score = data.score | 0; scoresChanged = true; }
      if (Array.isArray(data.grid) && !data.me) {
        const next = data.grid.map(row => (row || []).slice());
        if (gridSig(next) !== gridSig(grid)) { grid = next; myBoardChanged = true; }
      }
      if (Array.isArray(data.pieces) && !data.me && !dragging) {
        const next = adoptHandStable(pieces, data.pieces);
        const localU = (pieces || []).filter(p => p && !p.used).length;
        const remoteU = next.filter(p => p && !p.used).length;
        const force = !!(data.deal || data._forceHand || data._rejoin);
        if (force || localU !== remoteU || localU === 0) {
          if (handSig(next) !== handSig(pieces)) {
            if (!(localU > 0 && remoteU === 0 && !force)) {
              pieces = next; myHandChanged = true;
            }
          }
        }
      }
      // New deal always wins (hand was empty / refreshed) — but never mid-drag
      if (Array.isArray(data.deal) && data.deal.length && !dragging) {
        pieces = adoptHand(data.deal);
        myHandChanged = true;
        try { BPState.animateDealIn = true; } catch (_) {}
      }
      // place_ok / opp_place aliases
      if (typeof data.meScore === 'number' && (data.meScore | 0) !== (score | 0)) { score = data.meScore | 0; scoresChanged = true; }
      if (Array.isArray(data.meGrid) && !dragging) {
        const next = data.meGrid.map(row => (row || []).slice());
        if (gridSig(next) !== gridSig(grid)) { grid = next; myBoardChanged = true; }
      }
      if (Array.isArray(data.mePieces) && !dragging) {
        const next = adoptHandStable(pieces, data.mePieces);
        if (handSig(next) !== handSig(pieces)) {
          const localU = (pieces || []).filter(p => p && !p.used).length;
          const remoteU = next.filter(p => p && !p.used).length;
          if (!(localU > 0 && remoteU === 0 && !data.deal)) {
            pieces = next; myHandChanged = true;
          }
        }
      }
    }
  } catch (_) {}

  try {
    // Opp place animation owns the tray — never thrash opp hand mid-anim / from sync storms
    const oppAnimBusy = !!(typeof _oppPlaceAnimBusy !== 'undefined' && _oppPlaceAnimBusy);
    const fromSync = !!data._fromSync;
    // place_ok must never overwrite opponent board/hand (concurrent place race)
    const skipOppBoard = !!(data._fromPlaceOk || data._fromOppPlace);

    if (opp) {
      if (typeof opp.score === 'number' && (opp.score | 0) !== (oppScore | 0)) { oppScore = opp.score | 0; scoresChanged = true; }
      if (Array.isArray(opp.grid) && !oppAnimBusy && !skipOppBoard) {
        const next = opp.grid.map(row => (row || []).slice());
        if (gridSig(next) !== gridSig(oppGrid)) { oppGrid = next; oppBoardChanged = true; }
      }
      if (Array.isArray(opp.pieces) && !oppAnimBusy && !skipOppBoard) {
        const next = adoptHandStable(oppPieces, opp.pieces);
        if (handSig(next) !== handSig(oppPieces)) {
          // On sync: only adopt if unused count differs (real deal / place), not cosmetic reshuffles
          const localU = (oppPieces || []).filter(p => p && !p.used).length;
          const remoteU = next.filter(p => p && !p.used).length;
          if (!fromSync || localU !== remoteU || localU === 0) {
            oppPieces = next; oppHandChanged = true;
          }
        }
      }
      // Mutual identity: name / trophies / skin / board / avatar from server
      try {
        if (typeof applyOppProfileFromServer === 'function') {
          applyOppProfileFromServer(opp, { forcePaint: false });
        } else {
          if (opp.name) { mpOppName = opp.name; oppName = opp.name; }
          if (typeof opp.trophies === 'number') mpOppTrophies = opp.trophies | 0;
          if (opp.skinId && opp.skinId !== window.mpOppSkinId && typeof applyOppSkin === 'function') {
            window.mpOppSkinId = opp.skinId;
            try { applyOppSkin(opp.skinId); } catch (_) {}
          }
          if (opp.boardId && opp.boardId !== window.mpOppBoardId && typeof applyOppBoard === 'function') {
            window.mpOppBoardId = opp.boardId;
            try { applyOppBoard(opp.boardId); } catch (_) {}
          }
          if (opp.avatarId) {
            window.mpOppAvatarId = opp.avatarId;
            if (opp.avatarCustom) window.mpOppAvatarCustom = opp.avatarCustom;
          }
        }
      } catch (_) {}
    }
    if (typeof data.oppScore === 'number' && (data.oppScore | 0) !== (oppScore | 0)) { oppScore = data.oppScore | 0; scoresChanged = true; }
    if (Array.isArray(data.oppGrid) && !oppAnimBusy && !skipOppBoard) {
      const next = data.oppGrid.map(row => (row || []).slice());
      if (gridSig(next) !== gridSig(oppGrid)) { oppGrid = next; oppBoardChanged = true; }
    }
    if (Array.isArray(data.oppPieces) && !oppAnimBusy && !skipOppBoard) {
      const next = adoptHandStable(oppPieces, data.oppPieces);
      if (handSig(next) !== handSig(oppPieces)) {
        const localU = (oppPieces || []).filter(p => p && !p.used).length;
        const remoteU = next.filter(p => p && !p.used).length;
        if (!fromSync || localU !== remoteU || localU === 0) {
          oppPieces = next; oppHandChanged = true;
        }
      }
    }
    // opp_place: mover board is data.grid, mover pieces data.pieces
    if (Array.isArray(data.grid) && data.meGrid == null && data.me == null && data.oppGrid == null) {
      // already handled above for local; for opp_place path we map in handler
    }
  } catch (_) {}

  try {
    // Never clear placingLock mid-gesture or while optimistic place awaits place_ok
    if (!dragging && !BPState.pendingServerPlace) placingLock = false;
    BPState.rejoinLoading = false;
    BPState.rejoinInputLock = false;
    // Critical: sticky body.rejoin-loading sets pointer-events:none on ALL versus UI
    try {
      const ov = document.getElementById('rejoinLoading');
      const ovOn = ov && (ov.classList.contains('show') || ov.classList.contains('visible'));
      if (!ovOn) {
        document.body.classList.remove('rejoin-loading');
        try { if (ov) { ov.classList.remove('show', 'visible'); ov.style.display = 'none'; } } catch (_) {}
      }
    } catch (_) {}
    try {
      if (!document.getElementById('matchEndFreeze')?.classList.contains('visible')) {
        document.body.classList.remove('match-ending');
      }
    } catch (_) {}
  } catch (_) {}

  // Soft differential renders — skip while intro overlay owns the screen
  const paintFrozen = !!(BPState.paintFrozen || BPState.matchIntroSeqRunning || BPState.matchStartPhase);
  if (!paintFrozen) {
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
          if (BPState.animateDealIn && typeof renderPieces === 'function') {
            BPState.quietPieceRender = false;
            renderPieces(area);
            BPState.animateDealIn = false;
          } else if (typeof softRenderPieces === 'function') softRenderPieces(area);
          else if (typeof renderPieces === 'function') renderPieces(area);
        }
      }
      if (oppHandChanged && !oppAnimBusy) {
        try { BPState.quietPieceRender = true; } catch (_) {}
        if (typeof softRenderOppPieces === 'function') softRenderOppPieces();
        else if (typeof renderOppPieces === 'function') renderOppPieces();
        try { BPState.quietPieceRender = false; } catch (_) {}
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
  }
  // Always keep logical scores in sync even when paint is frozen
  try {
    if (paintFrozen && scoresChanged) {
      /* DOM update deferred until after «Старт!» */
    }
  } catch (_) {}
  if (!paintFrozen) {
    try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
    try { ensureMatchClockRunning && ensureMatchClockRunning(); } catch (_) {}
  }
}

