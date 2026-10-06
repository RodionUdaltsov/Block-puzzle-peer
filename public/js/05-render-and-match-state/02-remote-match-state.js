/**
 * Block Puzzle — js/05-render-and-match-state/02-remote-match-state.js
 * Applying remote match state, rejoin/restore, hand recovery, surrender.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function applyRemoteMatchState(data) {
  if (!data || data.stillLive === false) return false;
  // Throttle echo storms
  try {
    if (data._echo && window._lastRemoteSyncAt && (Date.now() - window._lastRemoteSyncAt) < 900) {
      return false;
    }
    if (!data._echo && window._lastRemoteSyncAt && (Date.now() - window._lastRemoteSyncAt) < 250 && data.fullSync) {
      // Burst of fullSync from dual rejoin — skip near-duplicate
      return false;
    }
  } catch (_) {}
  try {
    let scoresChanged = false;
    if (typeof data.score === 'number' && (data.score | 0) !== (oppScore | 0)) {
      oppScore = data.score | 0; scoresChanged = true;
    }
    if (typeof data.oppScore === 'number' && (data.oppScore | 0) !== (score | 0)) {
      score = data.oppScore | 0; scoresChanged = true;
    }
    if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
      const nextLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
      // Only adopt clock if it does not jump more than 3s (quiet)
      if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) {
        BPState.matchClockEndTs = data.clockEndTs;
        vsTimeLeft = nextLeft;
      }
    } else if (typeof data.vsTimeLeft === 'number') {
      const nextLeft = Math.max(0, data.vsTimeLeft | 0);
      if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) vsTimeLeft = nextLeft;
    }
    if (scoresChanged) {
      try {
        const myEl = document.getElementById('myScore');
        const oppEl = document.getElementById('oppScore');
        if (myEl) myEl.textContent = String(score);
        if (oppEl) oppEl.textContent = String(oppScore);
      } catch (_) {}
    }
    if (typeof data.matchStartTs === 'number' && data.matchStartTs > 0) {
      matchStartTs = data.matchStartTs;
    }

    let myBoardChanged = false;
    let oppBoardChanged = false;
    if (Array.isArray(data.oppGrid)) {
      const next = data.oppGrid.map(row => Array.isArray(row) ? row.slice() : row);
      if (gridSig(next) !== gridSig(grid)) {
        grid = next;
        myBoardChanged = true;
      }
    }
    if (Array.isArray(data.grid)) {
      const next = data.grid.map(row => Array.isArray(row) ? row.slice() : row);
      if (gridSig(next) !== gridSig(oppGrid)) {
        oppGrid = next;
        oppBoardChanged = true;
      }
    }

    // MY hand is local-authoritative — network never empties or shrinks it.
    let myHandChanged = false;
    let oppHandChanged = false;
    const localMineUnused = countUnusedInHand(pieces);
    if (Array.isArray(data.oppPieces)) {
      // remote's opp = our hand. NEVER wipe a non-empty local hand on rejoin storms.
      const remoteMe = cloneHand(data.oppPieces);
      const localU = countUnusedInHand(pieces);
      const remoteU = countUnusedInHand(remoteMe);
      if (localU === 0 && remoteU > 0) {
        pieces = remoteMe;
        myHandChanged = true;
      } else if (localU > 0 && remoteU > localU && handSig(remoteMe) !== handSig(pieces)) {
        // Remote has more unused pieces — take remote hand
        pieces = remoteMe;
        myHandChanged = true;
      }
      // else keep local
    }
    if (Array.isArray(data.pieces)) {
      // peer's me = our opp hand
      const remoteOpp = cloneHand(data.pieces);
      const localOppU = countUnusedInHand(oppPieces);
      const remoteOppU = countUnusedInHand(remoteOpp);
      if (localOppU === 0 && remoteOppU > 0) {
        oppPieces = remoteOpp;
        oppHandChanged = true;
      } else if (remoteOppU > 0 && handSig(remoteOpp) !== handSig(oppPieces)) {
        // Opp board/hand from peer is more authoritative for THEIR hand
        if (localOppU === 0 || remoteOppU >= localOppU) {
          oppPieces = remoteOpp;
          oppHandChanged = true;
        }
      }
    }
    // Absolute safety: never leave my hand empty if log can restore it
    try {
      if (countUnusedInHand(pieces) === 0) {
        recoverHandsFromMatchLog();
        if (countUnusedInHand(pieces) > 0) myHandChanged = true;
      }
    } catch (_) {}
    // Final safety: if my hand is empty after sync, rebuild from match log
    try {
      if (countUnusedInHand(pieces) === 0 && Array.isArray(matchLog) && matchLog.length) {
        const before = handSig(pieces);
        recoverHandsFromMatchLog();
        if (handSig(pieces) !== before && countUnusedInHand(pieces) > 0) {
          myHandChanged = true;
        }
      }
    } catch (_) {}

    // Cosmetics only when id changes
    try {
      if (data.boardId && data.boardId !== window.mpOppBoardId && typeof applyOppBoard === 'function') {
        window.mpOppBoardId = data.boardId;
        applyOppBoard(data.boardId);
      }
    } catch (_) {}
    try {
      if (data.skinId && data.skinId !== window.mpOppSkinId && typeof applyOppSkin === 'function') {
        window.mpOppSkinId = data.skinId;
        applyOppSkin(data.skinId);
      }
    } catch (_) {}

    // Quiet DOM: only redraw what actually changed
    if (myBoardChanged) {
      try { softRenderGrid(grid, boardMe); } catch (_) {
        try { renderGrid(grid, boardMe); } catch (_2) {}
      }
    }
    if (oppBoardChanged) {
      try { softRenderGrid(oppGrid, boardOpp); } catch (_) {
        try { renderGrid(oppGrid, boardOpp); } catch (_2) {}
      }
    }
    if (myHandChanged) {
      try {
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof softRenderPieces === 'function') softRenderPieces(area);
        else if (area && typeof renderPieces === 'function') renderPieces(area);
      } catch (_) {}
    }
    if (oppHandChanged) {
      try {
        if (typeof softRenderOppPieces === 'function') softRenderOppPieces();
        else if (typeof renderOppPieces === 'function') renderOppPieces();
      } catch (_) {}
    }
    try { updateTimerDisplay(); } catch (_) {}
    window._rejoinStateApplied = true;
    window._lastRemoteSyncAt = Date.now();
    return true;
  } catch (e) {
    console.warn('applyPeerMatchState', e);
    return false;
  }
}



function attemptMatchRejoin() {
  try {
    if (typeof MatchClient === "undefined") return false;
    const mid = MatchClient.matchId || (typeof loadMatchCreds === "function" ? null : null);
    try {
      const c = (typeof MatchClient.loadCreds === "function") ? null : null;
    } catch (_) {}
    if (MatchClient.matchId && MatchClient.token) {
      MatchClient.rejoin(MatchClient.matchId, MatchClient.token);
      return true;
    }
    // fallback: session storage creds via MatchClient internal
    try { MatchClient.connect(); } catch (_) {}
  } catch (_) {}
  return false;
}

    function killAllMatchTimers() {
  try { stopAfkWatch(); } catch (_) {}
  try { clearDisconnectTimer(); } catch (_) {}
  try { hideBoardDisconnectOverlay(); } catch (_) {}
  try { hideDisconnectBanner(); } catch (_) {}
  try { hideMatchRejoinPanel(); } catch (_) {}
  if (typeof vsTimerId !== 'undefined' && vsTimerId) {
    try { clearInterval(vsTimerId); } catch (_) {}
    vsTimerId = null;
  }
  if (typeof aiInterval !== 'undefined' && aiInterval) {
    try { clearInterval(aiInterval); } catch (_) {}
    aiInterval = null;
  }
  if (typeof mpDisconnectTimer !== 'undefined' && mpDisconnectTimer) {
    try { clearInterval(mpDisconnectTimer); } catch (_) {}
    mpDisconnectTimer = null;
  }
  try { oppDisconnected = false; } catch (_) {}
  try { dcDeadlineTs = 0; } catch (_) {}
}

function restoreSnapState(snap) {
  if (!snap) return;
  if (typeof snap.score === 'number') score = snap.score;
  if (typeof snap.oppScore === 'number') oppScore = snap.oppScore;
  if (typeof snap.vsTimeLeft === 'number') vsTimeLeft = snap.vsTimeLeft;
  if (snap.vsDuration) vsDuration = snap.vsDuration;
  if (snap.oppName) { oppName = snap.oppName; mpOppName = snap.oppName; }
  if (snap.role) mpRole = snap.role;
  if (snap.room) mpRoomCode = snap.room;
  if (snap.remoteSessionId) mpRemoteSessionId = snap.remoteSessionId;
  mpFromMatchmaking = !!snap.fromMM;
  // Cosmetics from snapshot — critical for rejoin so opp skins/boards reappear
  try {
    if (typeof snap.oppSkinId === 'string' && snap.oppSkinId) {
      window.mpOppSkinId = snap.oppSkinId;
    }
    if (typeof snap.oppBoardId === 'string' && snap.oppBoardId) {
      window.mpOppBoardId = snap.oppBoardId;
    }
    // Prefer current equipped, but fall back to match-time skin if local state was wiped
    if ((!equippedSkinId || equippedSkinId === 'default') && typeof snap.mySkinId === 'string' && snap.mySkinId) {
      equippedSkinId = snap.mySkinId;
    }
    if ((!equippedBoardId || equippedBoardId === 'field_default') && typeof snap.myBoardId === 'string' && snap.myBoardId) {
      equippedBoardId = snap.myBoardId;
    }
  } catch (_) {}
  if (Array.isArray(snap.grid)) {
    grid = snap.grid.map(row => Array.isArray(row) ? row.slice() : row);
  }
  if (Array.isArray(snap.oppGrid)) {
    oppGrid = snap.oppGrid.map(row => Array.isArray(row) ? row.slice() : row);
  }
  if (Array.isArray(snap.pieces)) {
    pieces = snap.pieces.map(p => ({
      shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
      color: p.color,
      used: !!p.used
    }));
  }
  if (Array.isArray(snap.oppPieces)) {
    oppPieces = snap.oppPieces.map(p => ({
      shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
      color: p.color,
      used: !!p.used
    }));
  }
  if (Array.isArray(snap.moves)) {
    try { matchLog = snap.moves.slice(); } catch (_) { matchLog = snap.moves; }
  }
  if (typeof snap.matchStartTs === 'number') {
    try { matchStartTs = snap.matchStartTs; } catch (_) {}
  }
  try { recoverHandsFromMatchLog(); } catch (_) {}
  // Guard: never leave empty hand after restore if snap had pieces
  try {
    if ((!pieces || !pieces.length || countUnusedInHand(pieces) === 0) && Array.isArray(snap.pieces) && snap.pieces.length) {
      const unused = snap.pieces.filter(p => p && !p.used);
      if (unused.length) {
        pieces = snap.pieces.map(p => ({
          shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
          color: p.color,
          used: !!p.used
        }));
      }
    }
  } catch (_) {}
}
/** Apply my + opponent cosmetics after restore / rejoin paint. Safe no-op if IDs missing. */
function applyMatchCosmetics() {
  try { applyEquippedBoard(); } catch (_) {}
  try { applyEquippedSkin(); } catch (_) {}
  try {
    if (window.mpOppBoardId && typeof applyOppBoard === 'function') {
      applyOppBoard(window.mpOppBoardId);
    }
  } catch (_) {}
  try {
    if (window.mpOppSkinId && typeof applyOppSkin === 'function') {
      applyOppSkin(window.mpOppSkinId);
    }
  } catch (_) {}
}
function countUnusedHand(arr) {
  if (!Array.isArray(arr) || !arr.length) return 0;
  let n = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] && !arr[i].used) n++;
  }
  return n;
}
/** Clone hand from network/snap payload. */
function cloneHandPayload(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.map(p => ({
    shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
    color: p && p.color,
    used: !!(p && p.used)
  }));
}
/**
 * Prefer the richer hand during rejoin so a partial peer snapshot cannot erase
 * a local piece the opponent still sees (or vice versa).
 * Keep local if it has more unused pieces, or remote is empty while local is not.
 */
function preferHand(localArr, remoteArr) {
  const remote = cloneHandPayload(remoteArr);
  if (!remote || !remote.length) {
    return Array.isArray(localArr) && localArr.length ? localArr : (remote || localArr || []);
  }
  if (!Array.isArray(localArr) || !localArr.length) return remote;
  const lu = countUnusedHand(localArr);
  const ru = countUnusedHand(remote);
  // Remote strictly richer → take remote; otherwise keep local (avoids flicker + lost piece)
  if (ru > lu) return remote;
  return localArr;
}
function recoverHandsFromMatchLog() {
  // Server-authoritative match: never invent hands from local matchLog
  try {
    if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
      return;
    }
  } catch (_) {}
  const log = (typeof matchLog !== 'undefined' && Array.isArray(matchLog)) ? matchLog : null;
  if (!log || !log.length) return;
  const needMe = !Array.isArray(pieces) || !pieces.length;
  const needOpp = !Array.isArray(oppPieces) || !oppPieces.length;
  // Even if hands exist, we may need to mark used flags from places after last deal
  let lastMeIdx = -1, lastOppIdx = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    const ev = log[i];
    if (!ev || (ev.type !== 'deal' && ev.type !== 'Deal')) continue;
    if (ev.side === 'opp') {
      if (lastOppIdx < 0 && Array.isArray(ev.pieces) && ev.pieces.length) lastOppIdx = i;
    } else {
      if (lastMeIdx < 0 && Array.isArray(ev.pieces) && ev.pieces.length) lastMeIdx = i;
    }
    if (lastMeIdx >= 0 && lastOppIdx >= 0) break;
  }
  const mapDeal = (ev) => (ev.pieces || []).map(p => ({
    shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
    color: (p && p.color) ? p.color : '#7c5cff',
    used: !!(p && p.used)
  }));
  if (needMe && lastMeIdx >= 0) pieces = mapDeal(log[lastMeIdx]);
  if (needOpp && lastOppIdx >= 0) oppPieces = mapDeal(log[lastOppIdx]);
  // Mark pieces used according to place events after the last deal for each side
  const markUsedAfterDeal = (side, dealIdx, hand) => {
    if (!Array.isArray(hand) || !hand.length || dealIdx < 0) return;
    for (let i = dealIdx + 1; i < log.length; i++) {
      const ev = log[i];
      if (!ev) continue;
      if ((ev.type === 'deal' || ev.type === 'Deal') && (ev.side === side || (side !== 'opp' && ev.side !== 'opp'))) break;
      if (ev.type !== 'place' && !ev.shape) continue;
      const evSide = ev.side === 'opp' ? 'opp' : 'me';
      if (evSide !== side) continue;
      let marked = false;
      if (typeof ev.pieceIdx === 'number' && ev.pieceIdx >= 0 && hand[ev.pieceIdx] && !hand[ev.pieceIdx].used) {
        hand[ev.pieceIdx].used = true;
        marked = true;
      }
      if (!marked && Array.isArray(ev.shape) && ev.shape.length) {
        try {
          const sk = (typeof shapeKey === 'function') ? shapeKey(ev.shape) : '';
          const ck = (typeof colorKey === 'function') ? colorKey(ev.color) : String(ev.color || '').toLowerCase();
          for (const p of hand) {
            if (!p || p.used || !p.shape) continue;
            if (sk && typeof shapeKey === 'function' && shapeKey(p.shape) !== sk) continue;
            const pck = (typeof colorKey === 'function') ? colorKey(p.color) : String(p.color || '').toLowerCase();
            if (!ck || pck === ck) { p.used = true; marked = true; break; }
          }
          if (!marked) {
            for (const p of hand) {
              if (!p || p.used || !p.shape) continue;
              if (typeof shapeKey === 'function' && shapeKey(p.shape) === sk) { p.used = true; break; }
            }
          }
        } catch (_) {}
      }
    }
  };
  try {
    if (Array.isArray(pieces) && pieces.length) markUsedAfterDeal('me', lastMeIdx, pieces);
    if (Array.isArray(oppPieces) && oppPieces.length) markUsedAfterDeal('opp', lastOppIdx, oppPieces);
  } catch (_) {}
}

function forceShowForfeitLoss(myScoreNow, oppScoreNow) {
  try {
    document.getElementById('vsTitle').textContent = (typeof globalThis.t==='function'?globalThis.t('js.defeatForfeit','Поражение · вы сдались'):'Поражение · вы сдались');
    document.getElementById('vsMyScore').textContent = myScoreNow;
    document.getElementById('vsOppScore').textContent = oppScoreNow;
    const lab = document.getElementById('vsOppLabel');
    if (lab) lab.textContent = oppName || mpOppName || (typeof globalThis.t==='function'?globalThis.t('js.opp','Соперник'):'Соперник');
    const deltaEl = document.getElementById('vsTrophyDelta');
    if (deltaEl) deltaEl.innerHTML = '<span class="muted">Сдача</span>';
    const timeInfo = document.getElementById('vsTimeLeftInfo');
    if (timeInfo) timeInfo.textContent = '';
  } catch (_) {}
  try {
    const surrRanked = !!(mpGameSource === 'ranked' || mpFromMatchmaking
      || (vsModeType === 'online' && !currentBot));
    try { window._lastMatchWasRanked = !!surrRanked; } catch (_) {}
    lastMatchResult = {
      result: 'Поражение', won: false, draw: false,
      my: myScoreNow, opp: oppScoreNow, oppName: oppName || 'Соперник',
      delta: 0, timeLeft: vsTimeLeft, duration: vsDuration,
      mode: surrRanked ? 'online' : (vsModeType || 'online'),
      ranked: surrRanked,
      botId: null, date: Date.now()
    };
  } catch (_) {}
  try { showScreen('versus'); } catch (_) {}
  try {
    document.getElementById('versusResult').classList.add('visible');
  } catch (_) {}
  try { configurePostMatchButtons(); } catch (_) {}
}

function surrenderLiveMatch() {
  // Idempotent — second click does nothing harmful
  if (BPState.matchEnded) {
    try { hideMatchRejoinPanel(); } catch (_) {}
    return;
  }

  // Room mode first: server notifies opponent
  try {
    if ((roomMatchMode || BPState.roomMatchMode) && typeof MatchClient !== 'undefined') {
      MatchClient.forfeit();
    }
  } catch (_) {}

  BPState.matchEnded = true;

  const snap = readLiveMatch();
  killAllMatchTimers();
  try { clearLiveMatch(); } catch (_) {}
  try { restoreSnapState(snap); } catch (_) {}

  mpMode = true;
  mode = 'versus';
  vsModeType = 'online';

  const myScoreNow = Math.max(0, typeof score === 'number' ? score : 0);
  const oppScoreNow = Math.max(0, typeof oppScore === 'number' ? oppScore : 0);

  const payload = {
    type: 'end',
    reason: 'forfeit',
    youWin: true,
    youLose: false,
    myScore: myScoreNow,
    oppScore: oppScoreNow
  };
  const overMsg = { type: 'match_over', reason: 'forfeit' };

  // Quiet loss for the player who surrendered (toast only, no duel / modal)
  try {
    if (Array.isArray(snap && snap.moves) && (!matchLog || !matchLog.length)) {
      matchLog = snap.moves.slice();
    }
  } catch (_) {}
  vsActive = true;
  try {
    endVersus({ forceLoss: true, reason: 'forfeit', silent: true, quiet: true });
  } catch (e) {
    console.warn('surrender endVersus', e);
    try {
      /* no match-end toast */
      showScreen('menu');
      updateMenuStats();
    } catch (_) {}
  }
  vsActive = false;
  killAllMatchTimers();
  BPState.matchEnded = true;
  try { hideMatchRejoinPanel(); } catch (_) {}
}

function bindMatchRejoinUI() {
  const a = document.getElementById('btnMatchRejoin');
  const b = document.getElementById('btnMatchSurrender');
  if (a) {
    a.onclick = (e) => { e.preventDefault(); attemptMatchRejoin(); };
  }
  if (b) {
    b.onclick = (e) => { e.preventDefault(); surrenderLiveMatch(); };
  }
  try {
    // Raw snap (may be expired by readLiveMatch) — if expired, try dual-away resolve
    let rawSnap = null;
    try {
      const raw = localStorage.getItem(LIVE_MATCH_KEY);
      if (raw) rawSnap = JSON.parse(raw);
    } catch (_) {}
    const snap = readLiveMatch();
    const resultUp = (() => {
      try {
        const r = document.getElementById('versusResult');
        return !!(r && r.classList.contains('visible'));
      } catch (_) { return false; }
    })();
    if (!snap && rawSnap && !vsActive && !resultUp && !BPState.matchEnded) {
      // Reconnect window already elapsed → finish match + history + toast
      try {
        if (typeof resolveBothAwayFromSnap === 'function' && resolveBothAwayFromSnap(rawSnap, true)) {
          return;
        }
      } catch (_) {}
      try { clearLiveMatch(); } catch (_) {}
      hideMatchRejoinPanel();
      return;
    }
    if (snap && !vsActive && !resultUp) {
      // Restore leave stamps for dual-away if user retries rejoin
      try {
        if (typeof snap.leftAt === 'number') myDcAt = snap.leftAt;
        if (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) oppDcAt = snap.oppLeftAt;
        if (myDcAt && oppDcAt) bothAwayMode = true;
      } catch (_) {}
      showMatchRejoinPanel(snap);
      // Host: listen for opponent surrender while on rejoin toast
      try { startRejoinPanelListen(snap); } catch (_) {}
      // Schedule auto-resolve when this client's 1-min (or match-left) window ends
      try {
        const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
        const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft : 120;
        const reconnectMs = Math.min(60000, Math.max(0, leftSec) * 1000);
        const remain = Math.max(0, leftAt + reconnectMs - Date.now());
        if (BPState.bothAwayResolveTimer) {
          try { clearTimeout(BPState.bothAwayResolveTimer); } catch (_) {}
        }
        BPState.bothAwayResolveTimer = setTimeout(() => {
          BPState.bothAwayResolveTimer = null;
          if (BPState.matchEnded) return;
          // If user is mid-rejoin attempt, let it finish; otherwise end the match
          if (BPState.mpRejoiningMatch && vsActive) return;
          try {
            let expired = null;
            try {
              const r = localStorage.getItem(LIVE_MATCH_KEY);
              if (r) expired = JSON.parse(r);
            } catch (_) {}
            if (!expired) {
              try { hideMatchRejoinPanel(); } catch (_) {}
              try { /* no match-end toast */ } catch (_) {}
              return;
            }
            if (typeof resolveBothAwayFromSnap === 'function') {
              resolveBothAwayFromSnap(expired, true);
            }
          } catch (_) {}
        }, remain + 400);
      } catch (_) {}
      // Do not auto-probe: connecting briefly would steal the host's live link
    } else if (!snap || resultUp) {
      hideMatchRejoinPanel();
    }
  } catch (_) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindMatchRejoinUI);
} else {
  setTimeout(bindMatchRejoinUI, 0);
}
window.addEventListener('load', () => { try { bindMatchRejoinUI(); } catch (_) {} });
setTimeout(() => { try { bindMatchRejoinUI(); } catch (_) {} }, 800);
setTimeout(() => { try { bindMatchRejoinUI(); } catch (_) {} }, 2000);

function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
  } else fallbackCopy(t);
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  ta.remove();
}

