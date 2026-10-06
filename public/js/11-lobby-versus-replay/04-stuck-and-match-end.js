/**
 * Block Puzzle — js/11-lobby-versus-replay/04-stuck-and-match-end.js
 * Stuck detection and match-end evaluation.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function playerHasMoves() {
  const available = pieces.filter(p => !p.used);
  if (!available.length) return true;
  return !piecesTrulyUnplayable(grid, pieces);
}
function aiHasMoves() {
  if (!oppPieces.length) return true;
  const available = oppPieces.filter(p => !p.used);
  if (!available.length) return true;
  return !piecesTrulyUnplayable(oppGrid, oppPieces);
}
function confirmPlayerStuck() {
  if (placingLock) return false;
  return piecesTrulyUnplayable(grid, pieces);
}
function confirmAiStuck() {
  if (aiBusy) return aiStuck; // keep state during animation
  const left = oppPieces.filter(p => p && !p.used);
  if (!left.length) return aiStuck; // transitional (deal pending)
  return piecesTrulyUnplayable(oppGrid, oppPieces);
}

function setAiStuck(value) {
  if (aiStuck === value) {
    updateStuckBanners();
    return;
  }
  aiStuck = value;
  updateStuckBanners();
  if (value && Math.random() < 0.4) showBotPhrase('stuck');
}

function updateStuckBanners() {
  updateOppStuckBanner();
  if (playerStuck) showPlayerStuckBanner();
}

function updateOppStuckBanner() {
  const el = document.getElementById('oppStuckWait');
  if (!el) return;
  // Only while AI is stuck and player still has a chance to play
  if (aiStuck && vsActive && !playerStuck) {
    el.style.display = 'block';
    el.textContent = oppScore >= score
      ? 'Соперник без ходов — доигрывай и постарайся обогнать!'
      : 'Соперник без ходов — доигрывай!';
  } else {
    el.style.display = 'none';
  }
}

let stuckCheckTimer = null;
let stuckConfirmTimer = null;
let stuckEndTimer = null;
let stuckWatchId = null;

function setPlayerStuck(value) {
  if (playerStuck === value) {
    if (value) {
      showPlayerStuckBanner();
      updateOppStuckBanner();
    }
    return;
  }
  playerStuck = value;
  if (!value) {
    const waitEl = document.getElementById('stuckWait');
    if (waitEl) waitEl.style.display = 'none';
    if (stuckConfirmTimer) { clearTimeout(stuckConfirmTimer); stuckConfirmTimer = null; }
    // don't clear stuckEndTimer here if ending
  } else {
    showPlayerStuckBanner();
  }
  updateOppStuckBanner();
  if (mpMode && (roomMatchMode || BPState.roomMatchMode) && typeof MatchClient !== 'undefined') {
    try { MatchClient.send({ type: 'stuck', stuck: !!value }); } catch (_) {}
  }
}

function showPlayerStuckBanner() {
  const waitEl = document.getElementById('stuckWait');
  if (!waitEl || !vsActive) return;
  waitEl.style.display = 'block';
  waitEl.textContent = score > oppScore
    ? 'Нет ходов — ожидай соперника...'
    : score < oppScore
      ? 'Нет ходов — соперник впереди...'
      : 'Нет ходов — ничья, пока соперник может выйти вперёд...';
}

function sideHasPlayable(g, pieceArr) {
  const left = (pieceArr || []).filter(p => p && !p.used && p.shape && p.shape.length);
  if (!left.length) return null; // unknown / tray empty (deal pending)
  for (const p of left) {
    if (findAllPlacements(g, p.shape).length > 0) return true;
  }
  return false;
}

function scheduleMatchEnd(delay) {
  if (stuckEndTimer) clearTimeout(stuckEndTimer);
  stuckEndTimer = setTimeout(() => {
    stuckEndTimer = null;
    if (!vsActive) return;
    // Final hard check: only cancel end if player clearly can still move AND is not forced-loss
    const myPlay = sideHasPlayable(grid, pieces);
    const oppPlay = sideHasPlayable(oppGrid, oppPieces);
    // Player has no moves and is behind or tied while opp also stuck → end
    if (myPlay === false && score < oppScore) {
      endVersus();
      return;
    }
    if (myPlay === false && oppPlay === false) {
      endVersus();
      return;
    }
    if (oppPlay === false && score > oppScore && myPlay !== false) {
      // only end if player is not also without moves waiting — actually opp behind + stuck means player wins if player can still play OR both stuck
      if (myPlay === false || myPlay === true) {
        // if player can play, keep going; if player also stuck, ended above
        if (myPlay === false) endVersus();
      }
      return;
    }
    // Opp stuck and behind
    if (oppPlay === false && oppScore < score) {
      endVersus();
      return;
    }
    // Re-sync flags
    if (myPlay === true) setPlayerStuck(false);
    if (oppPlay === true) setAiStuck(false);
    if (myPlay === false) setPlayerStuck(true);
    if (oppPlay === false) setAiStuck(true);
  }, delay);
}

function evaluateMatchEnd() {
  if (!vsActive || mode !== 'versus') return;
  // Ranked room: server decides stuck wins/losses — client only updates banners
  if (roomMatchMode || BPState.roomMatchMode) {
    const myPlay = sideHasPlayable(grid, pieces);
    const oppPlay = sideHasPlayable(oppGrid, oppPieces);
    if (myPlay === true) setPlayerStuck(false);
    else if (myPlay === false) setPlayerStuck(true);
    if (oppPlay === true) setAiStuck(false);
    else if (oppPlay === false) setAiStuck(true);
    try { updateStuckBanners && updateStuckBanners(); } catch (_) {}
    return;
  }

  const myPlay = sideHasPlayable(grid, pieces);
  const oppPlay = sideHasPlayable(oppGrid, oppPieces);

  // Sync flags from board truth (null = tray empty, leave flag alone)
  if (myPlay === true) setPlayerStuck(false);
  else if (myPlay === false) {
    if (!playerStuck) setPlayerStuck(true);
    else showPlayerStuckBanner();
  }

  if (oppPlay === true) setAiStuck(false);
  else if (oppPlay === false) {
    if (!aiStuck) setAiStuck(true);
  }

  updateStuckBanners();

  // 1) Player cannot move and is behind → loss (no reason to wait)
  if (myPlay === false && score < oppScore) {
    scheduleMatchEnd(350);
    return;
  }

  // 2) Both sides have pieces but neither can place → end by score
  if (myPlay === false && oppPlay === false) {
    scheduleMatchEnd(350);
    return;
  }

  // 3) Player stuck (ahead or tie) — wait only while opponent can still play
  if (myPlay === false && oppPlay === true) {
    showPlayerStuckBanner();
    return;
  }

  // 4) Opponent stuck and behind → player wins
  if (oppPlay === false && oppScore < score && myPlay !== false) {
    scheduleMatchEnd(350);
    return;
  }

  // 5) Opponent stuck, player still playing and not ahead yet
  if (oppPlay === false && myPlay === true) {
    updateOppStuckBanner();
  }
}

function checkVersusStuck() {
  if (mode !== 'versus' || !vsActive) return;
  if (stuckConfirmTimer) clearTimeout(stuckConfirmTimer);
  stuckConfirmTimer = setTimeout(() => {
    if (!vsActive) return;
    // Double-sample to avoid mid-animation false stuck
    const first = sideHasPlayable(grid, pieces);
    stuckConfirmTimer = setTimeout(() => {
      if (!vsActive) return;
      const second = sideHasPlayable(grid, pieces);
      if (second === false && first === false) {
        setPlayerStuck(true);
        evaluateMatchEnd();
      } else if (second === true) {
        setPlayerStuck(false);
        evaluateMatchEnd();
      } else {
        evaluateMatchEnd();
      }
    }, 200);
  }, 120);
}

// Watchdog: while either side is stuck, re-check every 1.2s so match cannot hang
function ensureStuckWatch() {
  if (stuckWatchId) return;
  stuckWatchId = setInterval(() => {
    if (!vsActive || mode !== 'versus') return;
    if (playerStuck || aiStuck) evaluateMatchEnd();
  }, 1800);
}
ensureStuckWatch();

// Pause expensive holo spins when tab is in background (big win in versus)
try {
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('holo-paused', document.hidden);
  });
} catch (_) {}

function onAiScoreChanged() {
  try {
    if (vsActive && (oppScore - score) >= 200) window._matchWasBehind200 = true;
  } catch (_) {}
  evaluateMatchEnd();
}

function clonePieceForLog(p) {
  // Deep-copy shape cells; tolerate array pairs OR {r,c}/{0,1} from server/JSON quirks
  let norm = [[0, 0]];
  try {
    if (typeof cloneShapeCells === 'function') {
      norm = cloneShapeCells(p && p.shape);
    } else {
      const shape = [];
      const src = (p && p.shape) ? p.shape : [];
      for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (Array.isArray(c) && c.length >= 2) shape.push([+c[0] || 0, +c[1] || 0]);
        else if (c && typeof c === 'object') {
          const r = c.r != null ? c.r : (c[0] != null ? c[0] : 0);
          const col = c.c != null ? c.c : (c[1] != null ? c[1] : 0);
          shape.push([+r || 0, +col || 0]);
        }
      }
      norm = shape.length ? shape : [[0, 0]];
    }
    if (typeof normalize === 'function' && norm.length) norm = normalize(norm.map(c => c.slice()));
  } catch (_) {}
  return {
    shape: norm.map(c => [+c[0] || 0, +c[1] || 0]),
    color: (p && p.color) ? String(p.color) : '#7c5cff',
    used: false
  };
}

/** Convert server move log (seat a/b) into client matchLog (side me/opp). */
function importServerMovesToMatchLog(serverMoves, mySeat) {
  if (!Array.isArray(serverMoves) || !serverMoves.length) return false;
  const seat = mySeat || (typeof MatchClient !== 'undefined' && MatchClient.seat) || 'a';
  const out = [];
  for (let i = 0; i < serverMoves.length; i++) {
    const m = serverMoves[i];
    if (!m || !m.type) continue;
    const side = (m.seat === seat) ? 'me' : 'opp';
    if (m.type === 'deal' && Array.isArray(m.pieces)) {
      out.push({
        type: 'deal',
        side,
        t: typeof m.t === 'number' ? m.t : 0,
        pieces: m.pieces.map(p => (typeof clonePieceForLog === 'function' ? clonePieceForLog(p) : {
          shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
          color: (p && p.color) || '#7c5cff',
          used: false
        }))
      });
    } else if (m.type === 'place' && Array.isArray(m.shape)) {
      out.push({
        type: 'place',
        side,
        t: typeof m.t === 'number' ? m.t : 0,
        shape: m.shape.map(c => Array.isArray(c) ? c.slice() : c),
        color: m.color,
        r: m.r | 0,
        c: m.c | 0,
        pieceIdx: (typeof m.pieceIdx === 'number') ? m.pieceIdx : -1,
        placePts: (typeof m.placePts === 'number') ? m.placePts : 0,
        myScore: side === 'me' ? (m.score | 0) : undefined,
        oppScore: side === 'opp' ? (m.score | 0) : undefined,
        legendFx: !!m.legendFx,
        skinId: m.skinId || null
      });
    }
  }
  if (!out.length) return false;
  try { matchLog = out; } catch (_) { return false; }
  return true;
}

function logDeal(side, pieceArr) {
  if (mode !== 'versus' && !(roomMatchMode || BPState.roomMatchMode)) return;
  if (!Array.isArray(pieceArr) || !pieceArr.length) return;
  try {
    const pieces = pieceArr.map(clonePieceForLog);
    if (!pieces.length) return;
    const sideKey = side === 'opp' ? 'opp' : 'me';
    // Dedupe identical consecutive deal for same side
    try {
      for (let i = matchLog.length - 1; i >= 0; i--) {
        const ev = matchLog[i];
        if (!ev || ev.type !== 'deal') continue;
        if (ev.side !== sideKey) break;
        const a = JSON.stringify((ev.pieces || []).map(p => [p.color, p.shape]));
        const b = JSON.stringify(pieces.map(p => [p.color, p.shape]));
        if (a === b) return;
        break;
      }
    } catch (_) {}
    matchLog.push({
      type: 'deal',
      side: sideKey,
      t: Math.max(0, Date.now() - (matchStartTs || Date.now())),
      pieces
    });
  } catch (_) {}
}
let lastMatchResult = null;


function isOnVersusScreen() {
  try {
    const vs = document.getElementById('screenVersus');
    return !!(vs && vs.classList.contains('active'));
  } catch (_) { return false; }
}
/** Full end animation only when player is actually looking at versus; otherwise toast-only */
function shouldQuietMatchEnd() {
  try {
    if (isOnVersusScreen() && (vsActive || BPState.mpRejoiningMatch || BPState.soloRejoinActive)) return false;
    if (isOnVersusScreen() && document.getElementById('versusResult') &&
        document.getElementById('versusResult').classList.contains('visible')) return false;
    // Menu / friends / shop / etc.
    return true;
  } catch (_) { return !vsActive; }
}

function formatTimeLeft(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
