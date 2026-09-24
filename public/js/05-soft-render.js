/**
 * Block Puzzle — 05-soft-render.js
 * Differential softRender for boards/hands; early match DOM helpers
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

const _boardCellCache = new WeakMap();
function _cachedBoardCells(boardEl) {
  let cells = _boardCellCache.get(boardEl);
  if (!cells || cells.length !== SIZE * SIZE || cells.some((c, i) => !c || c !== boardEl.children[i])) {
    cells = Array.from(boardEl.children).filter(el => el && el.classList && el.classList.contains('cell'));
    _boardCellCache.set(boardEl, cells);
  }
  return cells;
}

function softRenderGrid(g, boardEl) {
  if (!boardEl || !g) return;
  try {
    // Never thrash board mid clear animation (esp. mobile 420ms window)
    if (typeof isClearBusy === 'function' && isClearBusy(boardEl)) return;
    // Prefer differential cell update if board already has cells
    const cells = _cachedBoardCells(boardEl);
    if (cells && cells.length === SIZE * SIZE) {
      const clearingSet = (typeof CLEARING_CLASSES !== 'undefined' && CLEARING_CLASSES)
        ? CLEARING_CLASSES
        : ['clearing', 'clearing-common', 'clearing-mobile-soft', 'placing'];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const cell = cells[r * SIZE + c];
          if (!cell) continue;
          const val = g[r] && g[r][c];
          const filled = !!val;
          let isClearing = false;
          for (let k = 0; k < clearingSet.length; k++) {
            if (cell.classList.contains(clearingSet[k])) { isClearing = true; break; }
          }
          const isPlacing = cell.classList.contains('placing');
          const was = cell.classList.contains('filled') || cell.classList.contains('has-block') || isClearing || isPlacing;
          if (filled && !was) {
            cell.classList.add('filled');
            try { paintCellColor(cell, val); } catch (_) {}
            cell.dataset.renderColor = String(val);
          } else if (!filled && was) {
            // Let in-flight CLEAR finish. Placing on a now-empty cell must
            // clear (line clear after place) — do not freeze placing forever.
            if (isClearing) continue;
            // Full cleanup — incomplete wipe left painted squares until next place
            try {
              cell.style.setProperty('transition', 'none', 'important');
              cell.style.setProperty('animation', 'none', 'important');
              cell.style.background = '';
              cell.style.backgroundColor = '';
              cell.style.backgroundImage = '';
              cell.style.removeProperty('--cell-base');
              cell.style.removeProperty('--cell-glow');
              cell.style.removeProperty('transform');
              cell.style.removeProperty('opacity');
              cell.style.removeProperty('filter');
              cell.style.removeProperty('box-shadow');
              cell.style.removeProperty('clip-path');
            } catch (_) {}
            for (let k = 0; k < clearingSet.length; k++) cell.classList.remove(clearingSet[k]);
            cell.classList.remove('filled', 'has-block', 'preview-ok', 'preview-bad', 'placing');
            delete cell.dataset.renderColor;
            requestAnimationFrame(() => {
              try {
                if (!cell.classList.contains('filled')) {
                  cell.style.removeProperty('transition');
                  cell.style.removeProperty('animation');
                }
              } catch (_) {}
            });
          } else if (filled) {
            // Don't repaint a cell whose color is already represented in the DOM.
            // Opponent snapshots can arrive frequently; repainting all 64 cells
            // on every snapshot creates needless style/paint work on phones.
            if (isClearing || isPlacing) continue;
            const renderKey = String(val);
            if (cell.dataset.renderColor !== renderKey) {
              try { paintCellColor(cell, val); } catch (_) {}
              cell.dataset.renderColor = renderKey;
            }
            if (!cell.classList.contains('filled')) cell.classList.add('filled');
          }
        }
      }
      return;
    }
  } catch (_) {}
  try { renderGrid(g, boardEl); } catch (_) {}
}
function softRenderPieces(areaEl) {
  if (!areaEl) return;
  try {
    if (!pieces || !pieces.length) {
      try { recoverHandsFromMatchLog(); } catch (_) {}
    }
    if (!pieces || !pieces.length) return;
    const slots = areaEl.querySelectorAll('.piece-slot');
    // Same count: update used flags only — no innerHTML wipe (no jump)
    if (slots.length === pieces.length) {
      let needsFull = false;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const slot = slots[i];
        if (!slot) { needsFull = true; break; }
        // Shape mismatch (rejoin desync) → full rebuild so pieces stay pickable
        const domSig = slot.dataset && slot.dataset.handSig;
        const pSig = _pieceHandSig(p);
        if (domSig && pSig && domSig !== pSig && !p.used) {
          needsFull = true;
          break;
        }
        const usedDom = slot.classList.contains('used');
        if (!!p.used !== usedDom) {
          if (p.used) {
            slot.classList.add('used');
            slot.classList.remove('show', 'lifting');
            try {
              slot.style.width = '0';
              slot.style.minWidth = '0';
              slot.style.opacity = '0';
              slot.innerHTML = '';
            } catch (_) {}
          } else {
            needsFull = true;
            break;
          }
        }
      }
      if (!needsFull) {
        // Ensure visible unused slots stay interactive (clear stuck lifting)
        slots.forEach(s => {
          if (!s.classList.contains('used')) {
            s.classList.remove('lifting');
            s.classList.add('show');
            s.style.opacity = '1';
            s.style.visibility = '';
            s.style.pointerEvents = 'auto';
            s.style.touchAction = 'none';
            s.style.width = '';
            s.style.minWidth = '';
            s.style.filter = '';
          }
        });
        return;
      }
    }
  } catch (_) {}
  try {
    // Quiet full rebuild: skip staggered fade-in (sync/rejoin)
    BPState.quietPieceRender = true;
    renderPieces(areaEl);
    BPState.quietPieceRender = false;
  } catch (_) {
    try { BPState.quietPieceRender = false; } catch (_2) {}
  }
}
function _pieceHandSig(p) {
  try {
    if (!p) return 'X';
    const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
    return (p.used ? 'U' : 'A') + '|' + (p.color || '') + '|' + sh;
  } catch (_) { return 'X'; }
}
function softRenderOppPieces() {
  try {
    const area = document.getElementById('piecesAreaOpp');
    if (!area) { renderOppPieces(); return; }
    if (!oppPieces || !oppPieces.length) {
      try { recoverHandsFromMatchLog(); } catch (_) {}
    }
    if (!oppPieces || !oppPieces.length) return;
    // Mid place-anim: never rebuild opp tray
    try { if (typeof _oppPlaceAnimBusy !== 'undefined' && _oppPlaceAnimBusy) return; } catch (_) {}
    const slots = area.querySelectorAll('.piece-slot');
    if (slots.length === oppPieces.length) {
      let needsFull = false;
      for (let i = 0; i < oppPieces.length; i++) {
        const p = oppPieces[i];
        const slot = slots[i];
        if (!slot) { needsFull = true; break; }
        const usedDom = slot.classList.contains('used');
        if (!!p.used !== usedDom) {
          if (p.used) {
            // Soft collapse — no full rebuild (prevents jump)
            slot.classList.add('used');
            slot.classList.remove('show', 'lifting');
            try {
              slot.style.width = '0';
              slot.style.minWidth = '0';
              slot.style.opacity = '0';
              slot.innerHTML = '';
            } catch (_) {}
          } else {
            needsFull = true;
            break;
          }
        }
      }
      if (!needsFull) {
        slots.forEach(s => {
          if (!s.classList.contains('used')) {
            s.classList.remove('lifting');
            s.classList.add('show');
            s.style.opacity = '1';
            s.style.visibility = '';
          }
        });
        return;
      }
    }
    BPState.quietPieceRender = true;
    renderOppPieces();
    BPState.quietPieceRender = false;
  } catch (_) {
    try { BPState.quietPieceRender = false; renderOppPieces(); } catch (_2) {}
  }
}

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
    document.getElementById('vsTitle').textContent = 'Поражение · вы сдались';
    document.getElementById('vsMyScore').textContent = myScoreNow;
    document.getElementById('vsOppScore').textContent = oppScoreNow;
    const lab = document.getElementById('vsOppLabel');
    if (lab) lab.textContent = oppName || mpOppName || 'Соперник';
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


// ========== Online multiplayer (MatchClient / rooms) ==========
let mpMode = false;
let mpRole = null; // 'host' | 'guest'
let mpRoomCode = null;
let mpPendingJoin = null;
let mpExpectedJoinCode = null;
let mpRemoteSessionId = null;
let mpOppName = 'Соперник';
try { window.mpOppAvatarId = window.mpOppAvatarId || null; } catch (_) {}
let mpReady = false;
let mpOppReady = false;
let mpOppConnected = false;
let mpLobbyDuration = 120;
let mpMatchStarting = false;
let vsIntroLock = false;
let mpJoinTimer = null;
let oppDisconnected = false;
let mpDisconnectTimer = null;
let rematchPending = false;
let mpFromMatchmaking = false;
/** 'ranked' | 'lobby' | null */
let mpGameSource = null;
let rematchIWant = false;
let rematchTheyWant = false;
/** Queued rematch offer while score-duel overlay is still covering the UI */
let pendingRematchOfferName = null;
/** Keep online link after match so rematch works from menu / delayed result UI */
let postMatchOnlineEligible = false;
/** Remote server id for post-match reconnect */

function setMpStatus(t) {
  const el = document.getElementById('mpStatus');
  if (el) el.textContent = t || '';
}

function clearMpJoinTimer() {
  if (mpJoinTimer) {
    clearTimeout(mpJoinTimer);
    mpJoinTimer = null;
  }
}

function failJoinRoom(reason, silentAlert) {
  clearMpJoinTimer();
  closeRoomLobby();
  hideRjToast(false);
  // Room gone / full — drop pending lobby invite for this room
  try {
    if (chPending && chPending.room) {
      const closed = String(chPending.room).toUpperCase();
      const tried = String(mpRoomCode || '').toUpperCase();
      if (!tried || closed === tried || (reason && /занят|не найден|отклон|закрыт|full|closed/i.test(String(reason)))) {
        chPending = null;
        try { hideChToast(false); } catch (_) {}
      }
    }
  } catch (_) {}
  const modal = document.getElementById('joinRoomModal');
  if (modal) modal.classList.remove('visible');
  const msg = reason || 'Комната не найдена';
  setMpStatus(msg);
  mpMode = false;
  mpRole = null;
  mpRoomCode = null;
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
  if (!silentAlert) {
    try { SFX.bad && SFX.bad(); } catch (_) {}
  }
}

function mpIsLinked() {
  try {
    if (roomMatchMode || BPState.roomMatchMode) return true;
    if (typeof MatchClient !== "undefined" && MatchClient.connected) return true;
  } catch (_) {}
  return false;
}











function destroyMp() {
  clearMpJoinTimer();
  const closedRoom = mpRoomCode;
  try { stopLobbyPing(); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient.leavePrivate();
      if (!(roomMatchMode || BPState.roomMatchMode)) {
        /* keep matchId for rematch if room mode ended */
      }
    }
  } catch (_) {}
  try {
    if (closedRoom) notifyChallengeCancelled(closedRoom, 'closed');
  } catch (_) {
    try { clearLobbyInviteWait(null, closedRoom); } catch (_) {}
  }
  mpMode = false; mpRole = null;
  mpRoomCode = null; mpReady = false; mpOppReady = false;
  mpOppConnected = false; mpMatchStarting = false;
  mpFromMatchmaking = false;
  mpGameSource = null;
  postMatchOnlineEligible = false;
  try { stopMatchmaking(true); } catch (_) {}
  try { mmFound = false; mmActive = false; } catch (_) {}
  vsIntroLock = false;
  rematchIWant = false;
  rematchTheyWant = false;
  rematchPending = false;
  pendingRematchOfferName = null;
  try { hideRmToast(false); } catch (_) {}
  try { hideRjToast(false); } catch (_) {}
  setMpStatus('');
  closeRoomLobby();
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
}

function roomSessionId(code) {
  return 'bp-room-' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** @deprecated server removed — always rejects */
let _netOk = null;
function setNetStatus(ok, detail) {
  _netOk = !!ok;
  const el = document.getElementById('netStatusPill');
  if (!el) return;
  if (ok) {
    // Online — no indicator
    el.textContent = '';
    el.title = '';
    el.removeAttribute('aria-label');
    el.className = 'net-status-pill ok';
  } else {
    const map = {
      'peer-unavailable': 'друг оффлайн',
      'network': 'нет связи',
      'server-error': 'ошибка сервера',
      'socket-error': 'ошибка сокета',
      'timeout': 'таймаут сети',
      'peer': 'нет связи',
      'disconnected': 'отключение',
      'network': 'network недоступен'
    };
    const label = detail ? (map[detail] || String(detail)) : 'оффлайн';
    // Visual: red ring only; error name in tooltip
    el.textContent = '';
    el.title = label;
    el.setAttribute('aria-label', 'Сеть: ' + label);
    el.className = 'net-status-pill bad';
  }
}

function isNetworkApiSupported() {
  // online removed — network not required
  return true;
}

function isSecureOk() {
  // WebSocket works on http:// and https://. legacy needed secure context —
  // we no longer use server, so allow plain HTTP (LAN IP, tunnels, etc.).
  try {
    const p = location.protocol;
    if (p === 'https:' || p === 'http:' || p === 'file:') return true;
  } catch (_) {}
  return true;
}

function showNetBanner(html, opts) {
  let el = document.getElementById('netBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'netBanner';
    el.className = 'net-banner';
    el.innerHTML = '<div class="nb-text"></div><div class="nb-actions"></div>';
    document.body.appendChild(el);
  }
  el.querySelector('.nb-text').innerHTML = html;
  const actions = el.querySelector('.nb-actions');
  actions.innerHTML = '';
  const dismiss = document.createElement('button');
  dismiss.className = 'ghost';
  dismiss.textContent = 'Понятно';
  dismiss.onclick = () => el.classList.remove('visible');
  actions.appendChild(dismiss);
  if (opts && opts.copyUrl) {
    const b = document.createElement('button');
    b.className = 'primary';
    b.textContent = 'Скопировать ссылку';
    b.onclick = () => {
      try {
        copyText(location.href.split('#')[0]);
        b.textContent = 'Скопировано';
      } catch (_) {}
    };
    actions.appendChild(b);
  }
  el.classList.add('visible');
}

function checkCrossPlatformReady() {
  if (typeof MatchClient === 'undefined') {
    showNetBanner('<strong>Клиент матчей не загрузился</strong><br/>Обнови страницу.');
    return false;
  }
  try { MatchClient.connect(); } catch (_) {}
  return true;
}

// iOS Safari: prevent pinch-zoom / double-tap zoom during play
(function iosGestureGuards() {
  document.addEventListener('gesturestart', (e) => { e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

function delayMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let mpCreateGen = 0;
let mpJoinGen = 0;
/** Friend code expected after challenge — auto-admit without host toast */

let rjToastHideTimer = null;
let rjToastCountTimer = null;
function clearRjToastHideTimer() {
  if (rjToastHideTimer) { clearTimeout(rjToastHideTimer); rjToastHideTimer = null; }
  if (rjToastCountTimer) { clearInterval(rjToastCountTimer); rjToastCountTimer = null; }
}
function hideRjToast(animate) {
  const toast = document.getElementById('rjToast');
  if (!toast) return;
  clearRjToastHideTimer();
  if (animate === false) {
    toast.classList.remove('visible', 'out');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out'), 400);
}

function showRjToast(req) {
  const toast = document.getElementById('rjToast');
  if (!toast || !req) return;
  clearRjToastHideTimer();
  const av = document.getElementById('rjToastAv');
  const name = document.getElementById('rjToastName');
  const meta = document.getElementById('rjToastMeta');
  if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
  if (name) name.textContent = req.name || 'Игрок';
  if (meta) {
    const parts = [];
    if (req.code) parts.push('код ' + req.code);
    if (req.trophies != null) parts.push('🏆 ' + req.trophies);
    parts.push('хочет войти');
    meta.textContent = parts.join(' · ');
  }
  toast.classList.remove('out');
  void toast.offsetWidth;
  toast.classList.add('visible');
  try { SFX.ui(); } catch (_) {}
  try { hapticTap(12); } catch (_) {}
  rjToastCountTimer = startToastCountdown('rjToastCountdown', 5, null);
  try { renderFriendRequests(); } catch (_) {}
  rjToastHideTimer = setTimeout(() => {
    rjToastHideTimer = null;
    if (null && mpPendingJoin === req) {
      try { declinePendingJoin('timeout'); } catch (_) { hideRjToast(true); }
    } else {
      hideRjToast(true);
    }
  }, 5000);
}






(function bindRjToast() {
  const acc = document.getElementById('rjToastAccept');
  const dec = document.getElementById('rjToastDecline');
  if (acc) acc.addEventListener('click', () => { try { hideRjToast(true); } catch (_) {} });
  if (dec) dec.addEventListener('click', () => { try { hideRjToast(true); } catch (_) {} });
})();
(function bindRjToastSwipe() {
  const toast = document.getElementById('rjToast');
  if (!toast || toast._bpSwipe) return;
  toast._bpSwipe = true;
  let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
  const onStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY; startX = t.clientX; dy = 0; dx = 0;
    dragging = true;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY; dx = t.clientX - startX;
    if (dx > 8 || dy < -8) {
      if (e.cancelable) e.preventDefault();
      const distX = Math.max(0, Math.min(dx, 200));
      const distY = Math.min(0, Math.max(dy, -120));
      toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
      toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
    }
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove('dragging');
    if (dx > 64 || dy < -56) {
      try { declinePendingJoin('declined'); } catch (_) { hideRjToast(true); }
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
    dy = 0; dx = 0;
  };
  toast.addEventListener('touchstart', onStart, { passive: true });
  toast.addEventListener('touchmove', onMove, { passive: false });
  toast.addEventListener('touchend', onEnd);
  toast.addEventListener('touchcancel', onEnd);
})();

(function bindChToast() {
  const a = document.getElementById('chBtnAccept');
  const d = document.getElementById('chBtnDecline');
  if (a) a.addEventListener('click', () => acceptChallenge());
  if (d) d.addEventListener('click', () => declineChallenge());
})();

function openRoomLobby() {
  const el = document.getElementById('roomLobby');
  if (!el) return;
  document.getElementById('lobbyCode').textContent = mpRoomCode || '————';
  document.getElementById('lobbyTitle').textContent = mpRole === 'host' ? 'Твоя комната' : 'Комната';
  updateLobbyHostLabels();
  updateLobbyUI();
  el.classList.add('visible');
  startLobbyPing();
}
function updateLobbyHostLabels() {
  try {
    const meName = document.getElementById('lobbyMeName');
    const oppName = document.getElementById('lobbyOppName');
    const meHost = mpRole === 'host';
    if (meName) {
      meName.innerHTML = escapeHtmlLobby(myNickname || 'Ты') +
        (meHost ? ' <span class="lobby-host-badge">хост</span>' : '');
    }
    if (oppName && mpOppConnected) {
      const on = mpOppName || 'Соперник';
      oppName.innerHTML = escapeHtmlLobby(on) +
        (!meHost ? ' <span class="lobby-host-badge">хост</span>' : '');
    }
  } catch (_) {}
}
function escapeHtmlLobby(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function closeRoomLobby() {
  const el = document.getElementById('roomLobby');
  if (el) el.classList.remove('visible');
  stopLobbyPing();
}

function updateLobbyUI() {
  const meState = document.getElementById('lobbyMeState');
  const meSlot = document.getElementById('lobbySlotMe');
  const oppName = document.getElementById('lobbyOppName');
  const oppState = document.getElementById('lobbyOppState');
  const oppSlot = document.getElementById('lobbySlotOpp');
  const readyBtn = document.getElementById('btnLobbyReady');
  const inviteBtn = document.getElementById('btnLobbyInvite');
  const hint = document.getElementById('lobbyHint');

  if (meState) meState.textContent = mpReady ? 'Готов ✓' : 'Не готов';
  if (meSlot) meSlot.classList.toggle('ready', !!mpReady);
  if (readyBtn) {
    readyBtn.textContent = mpReady ? 'Не готов' : 'Готов';
    readyBtn.classList.toggle('is-ready', !!mpReady);
  }

  try { updateLobbyHostLabels(); } catch (_) {}
  if (mpOppConnected) {
    if (oppState) oppState.textContent = mpOppReady ? 'Готов ✓' : 'Не готов';
    if (oppSlot) {
      oppSlot.classList.remove('empty');
      oppSlot.classList.toggle('ready', !!mpOppReady);
    }
    // Room is full (2/2) — no more invites
    if (inviteBtn) inviteBtn.style.display = 'none';
    try { closeLobbyInviteModal(); } catch (_) {}
    try { updateLobbyPingUI(); } catch (_) {}
  } else {
    if (oppName) oppName.textContent = 'Ожидание игрока…';
    if (oppState) oppState.textContent = '—';
    if (oppSlot) {
      oppSlot.classList.add('empty');
      oppSlot.classList.remove('ready');
    }
    if (inviteBtn) inviteBtn.style.display = '';
    try {
      const op = document.getElementById('lobbyOppPing');
      const mp = document.getElementById('lobbyMePing');
      if (op) { op.textContent = ''; op.className = 'lobby-ping'; }
      if (mp) { mp.textContent = ''; mp.className = 'lobby-ping'; }
    } catch (_) {}
  }

  if (hint) {
    if (!mpOppConnected) {
      hint.textContent = 'Нажми «Пригласить» или скажи другу код комнаты';
    } else if (!mpReady || !mpOppReady) {
      hint.textContent = 'Оба игрока должны нажать «Готов»';
    } else {
      hint.textContent = 'Оба готовы — старт…';
    }
  }

  // Sync duration button selection
  document.querySelectorAll('.lobby-dur').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.sec, 10) === mpLobbyDuration);
  });

  tryStartMpMatch();
}

function tryStartMpMatch() {
  // Server starts the match when both players are ready (private_ready).
  // Kept as no-op for legacy callers.
}


let rjExpireTimer = null;

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
