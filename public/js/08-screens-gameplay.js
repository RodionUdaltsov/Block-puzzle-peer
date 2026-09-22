/**
 * Block Puzzle — 06-screens-gameplay.js
 * Screens, classic/versus flow, clear lines, render pieces, core play
 * Lines ~11843-13911 from legacy game.js monolith (refactored).
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

function showScreen(name) {
  // Shop mini-previews: only run while shop/inventory is visible
  try {
    if (name !== 'shop' && name !== 'inventory') {
      if (typeof shopMiniTimer !== 'undefined' && shopMiniTimer) {
        clearInterval(shopMiniTimer);
        shopMiniTimer = null;
      }
    }
  } catch (_) {}
  // Leaving achievements → collapse all tabs to default order
  try {
    const achEl = screens.achievements;
    const leavingAch = achEl && achEl.classList.contains('active') && name !== 'achievements';
    if (leavingAch) {
      closeAllAchTabs();
      // Re-render so section order resets to default next visit
      try { renderAchievements(); } catch (_) {}
    }
  } catch (_) {}
  // Leave replay safely when navigating away from versus
  try {
    if (name !== 'versus' && typeof replayMode !== 'undefined' && replayMode) {
      try { stopReplayPlay(); } catch (_) {}
      replayMode = false;
      document.body.classList.remove('replay-ui');
      document.body.classList.remove('replay-playing');
      try { hideReplayEndCard(); } catch (_) {}
      try {
        if (window._replaySkinBackup) {
          equippedSkinId = window._replaySkinBackup;
          applyEquippedSkin();
        }
        if (window._replayBoardBackup) {
          equippedBoardId = window._replayBoardBackup;
          applyEquippedBoard();
        }
        clearOppSkin();
        clearOppBoard();
        window.mpOppSkinId = null;
        window.mpOppBoardId = null;
        window._replaySkinBackup = null;
        window._replayBoardBackup = null;
      } catch (_) {}
      try {
        const rb = document.getElementById('reviewBar');
        if (rb) {
          rb.classList.remove('visible', 'replay-dock');
        }
      } catch (_) {}
      try {
        const scrub = document.getElementById('replayScrubBar');
        if (scrub) {
          scrub.style.display = 'none';
          scrub.setAttribute('aria-hidden', 'true');
        }
      } catch (_) {}
      try {
        const fb = document.getElementById('btnForfeit');
        if (fb) fb.style.display = '';
      } catch (_) {}
    }
  } catch (_) {}
  // Cancel in-progress drag when leaving play screens
  try {
    if (name !== 'classic' && name !== 'versus') {
      if (typeof isDragging !== 'undefined' && isDragging) {
        isDragging = false;
        selectedIdx = -1;
        dragPiece = null;
        placingLock = false;
        try { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } } catch (_) {}
        try {
          const g = document.getElementById('ghost');
          if (g) { g.style.display = 'none'; g.style.opacity = '0'; }
        } catch (_) {}
      }
    }
  } catch (_) {}
  // If leaving versus while a bot AI tick is still scheduled, stop it
  try {
    if (name !== 'versus' && !vsActive) {
      if (typeof aiInterval !== 'undefined' && aiInterval) {
        clearInterval(aiInterval);
        aiInterval = null;
      }
      aiBusy = false;
    }
  } catch (_) {}
  Object.values(screens).forEach(s => {
    s.classList.remove('active', 'screen-enter');
  });
  if (screens[name]) {
    const el = screens[name];
    // Force reflow so entrance animation always replays
    el.classList.remove('active', 'screen-enter');
    void el.offsetWidth;
    el.classList.add('active', 'screen-enter');
    // Drop enter class after anim so nested dynamic content is not stuck mid-anim
    clearTimeout(el._enterT);
    el._enterT = setTimeout(() => {
      try { el.classList.remove('screen-enter'); } catch (_) {}
    }, 700);
  }
  mode = (name === 'classic' || name === 'versus') ? name : name;
  try {
    const prevAct = myActivity;
    detectMyActivity();
    if (myActivity !== prevAct) scheduleActivityBroadcast();
  } catch (_) {}
  const lock = (name === 'versus' || name === 'classic' || name === 'difficulty' || name === 'history' || name === 'achievements');
  setFitLock(lock);
  if (lock) {
    requestAnimationFrame(() => applyBoardScales());
  }
  if (name === 'classic' || name === 'versus') {
    try { applyEquippedBoard(); } catch (_) {}
    try { requestWakeLock(); } catch (_) {}
  } else {
    try { releaseWakeLock(); } catch (_) {}
  }
  syncMusicToScreen(name);
  // If a live match snapshot exists and we are not in versus, surface rejoin toast
  // (covers: both left, one already back in match — the other must still see the panel)
  try {
    if (name === 'menu' || name === 'friends' || name === 'settings' || name === 'history') {
      if (!vsActive && !window._matchEnded && !window._mpRejoiningMatch) {
        const s = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
        if (s) {
          showMatchRejoinPanel(s);
          try { startRejoinPanelListen(s); } catch (_2) {}
        }
      }
    }
  } catch (_) {}
}
/** Silver = each duration win (1/2/3 min). Gold = bot fully cleared (3/3). */
function totalSilverStars() {
  return totalBotStars();
}
function maxSilverStars() {
  return (BOTS && BOTS.length ? BOTS.length : 0) * 3;
}
function totalGoldStars() {
  let n = 0;
  if (!BOTS || !BOTS.length) return 0;
  for (const b of BOTS) {
    if (getBotStarCount(b.id) >= 3) n++;
  }
  return n;
}
function maxGoldStars() {
  return BOTS && BOTS.length ? BOTS.length : 0;
}
function updateMenuStats() {
  const tEl = document.getElementById('menuTrophies');
  const dEl = document.getElementById('menuDiamonds');
  const bEl = document.getElementById('menuBest');
  if (tEl) tEl.textContent = trophies;
  if (dEl) dEl.textContent = diamonds;
  if (bEl) bEl.textContent = best;
  const live = document.getElementById('trophiesLive');
  if (live) live.textContent = trophies;
  // Silver stars: collected / total (top bar)
  const silverEl = document.getElementById('menuSilverStars');
  if (silverEl) silverEl.textContent = totalSilverStars() + '/' + maxSilverStars();
  // Gold star counter only if element still exists somewhere
  const goldEl = document.getElementById('menuGoldStars');
  if (goldEl) goldEl.textContent = totalGoldStars() + '/' + maxGoldStars();
  const starsEl = document.getElementById('menuStars');
  if (starsEl) starsEl.textContent = totalSilverStars() + '/' + maxSilverStars();
  const rb = document.getElementById('menuRankedBest');
  if (rb) rb.textContent = rankedBest;
  const csh = document.getElementById('compSilverHint');
  if (csh) csh.textContent = totalSilverStars() + '/' + maxSilverStars();
  try { updateAchievementsButton(); } catch (_) {}
  try { refreshProfileUI(); } catch (_) {}
}

function normalize(shape) {
  const minR = Math.min(...shape.map(p => p[0]));
  const minC = Math.min(...shape.map(p => p[1]));
  return shape.map(([r,c]) => [r-minR, c-minC]);
}
function randomPiece(palette) {
  if (_R) {
    const p = _R.randomPiece(palette && palette.length ? palette : COLORS);
    return p;
  }
  const cols = (palette && palette.length) ? palette : COLORS;
  const total = SHAPE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let idx = 0;
  for (let i = 0; i < SHAPE_WEIGHTS.length; i++) {
    r -= SHAPE_WEIGHTS[i];
    if (r <= 0) { idx = i; break; }
  }
  return {
    shape: normalize(SHAPES[idx]),
    color: cols[Math.floor(Math.random() * cols.length)],
    used: false
  };
}
/** Bot / classic opponent palette — always default, never player legendary colors */
function randomBotPiece() {
  return randomPiece(DEFAULT_COLORS);
}
function isCellEmpty(g, r, c) {
  // Treat null/undefined/'' as empty — avoids false "occupied" from sparse values
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE && !g[r][c];
}
function canPlaceOn(g, shape, baseR, baseC) {
  if (_R) return _R.canPlaceOn(g, shape, baseR, baseC);
  for (const [dr, dc] of shape) {
    const r = baseR + dr, c = baseC + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || g[r][c]) return false;
  }
  return true;
}
function findAllPlacements(g, shape) {
  if (_R) return _R.findAllPlacements(g, shape);
  if (!shape || !shape.length) return [];
  const maxR = Math.max(...shape.map(s => s[0]));
  const maxC = Math.max(...shape.map(s => s[1]));
  const candidates = [];
  for (let r = 0; r <= SIZE - 1 - maxR; r++) {
    for (let c = 0; c <= SIZE - 1 - maxC; c++) {
      if (canPlaceOn(g, shape, r, c)) candidates.push({ r, c });
    }
  }
  return candidates;
}
/** True only if every remaining piece has zero legal cells */
function piecesTrulyUnplayable(g, pieceArr) {
  const left = (pieceArr || []).filter(p => p && !p.used && p.shape && p.shape.length);
  if (!left.length) return false; // empty tray = deal pending, NOT stuck
  // Must have zero legal cells for EVERY remaining piece
  for (const p of left) {
    if (findAllPlacements(g, p.shape).length > 0) return false;
  }
  return true;
}
function pieceIsPlayable(g, piece) {
  if (!piece || piece.used || !piece.shape) return false;
  return findAllPlacements(g, piece.shape).length > 0;
}
function scorePlacement(g, shape, pos) {
  const test = g.map(row => row.slice());
  for (const [dr, dc] of shape) test[pos.r + dr][pos.c + dc] = '#';
  let lines = 0;
  for (let r = 0; r < SIZE; r++) if (test[r].every(x => x !== null)) lines++;
  for (let c = 0; c < SIZE; c++) if (test.every(row => row[c] !== null)) lines++;

  // Neighbour contact — prefer snug fits
  let contacts = 0;
  let edges = 0;
  for (const [dr, dc] of shape) {
    const r = pos.r + dr, c = pos.c + dc;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [rr, cc] of dirs) {
      const nr = r + rr, nc = c + cc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) edges++;
      else if (g[nr][nc] !== null) contacts++;
    }
  }

  // How full rows/cols become after place (progress toward clear)
  let progress = 0;
  for (let r = 0; r < SIZE; r++) {
    const fill = test[r].filter(x => x !== null).length;
    if (fill >= 5) progress += fill;
  }
  for (let c = 0; c < SIZE; c++) {
    let fill = 0;
    for (let r = 0; r < SIZE; r++) if (test[r][c] !== null) fill++;
    if (fill >= 5) progress += fill;
  }

  // Penalize isolated holes created nearby (rough)
  let holes = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (test[r][c] !== null) continue;
      let blocked = 0;
      if (r === 0 || test[r-1][c] !== null) blocked++;
      if (r === SIZE-1 || test[r+1][c] !== null) blocked++;
      if (c === 0 || test[r][c-1] !== null) blocked++;
      if (c === SIZE-1 || test[r][c+1] !== null) blocked++;
      if (blocked >= 3) holes++;
    }
  }

  const st = (currentBot && currentBot.style) || { clearBias: 0.7, risk: 0.4, preferSmall: 1 };
  const clearW = 350 + 550 * (st.clearBias || 0.7);
  const holePen = 3 + 12 * (1 - (st.risk || 0.4));
  const contactW = 2 + 4 * (1 - (st.risk || 0.4));
  const sizePref = (st.preferSmall || 1) * (5 - Math.min(4, shape.length));
  return lines * clearW + progress * 3 + contacts * contactW + edges * 1.2 - holes * holePen + sizePref * 3;
}

function findPlacement(g, shape, skill = 1) {
  const candidates = findAllPlacements(g, shape);
  if (!candidates.length) return null;
  candidates.sort((a, b) => scorePlacement(g, shape, b) - scorePlacement(g, shape, a));
  if (Math.random() < skill) return candidates[0];
  // Weaker bots: pick from top half randomly
  const pool = Math.max(1, Math.ceil(candidates.length * (1 - skill * 0.7)));
  return candidates[Math.floor(Math.random() * pool)];
}

/** Evaluate all available pieces, return best {piece, idx, pos, score} */
function findBestMove(g, piecesArr, skill) {
  let best = null;
  piecesArr.forEach((piece, idx) => {
    if (piece.used) return;
    // Exhaustive legal placements — never miss a valid cell
    const all = findAllPlacements(g, piece.shape);
    if (!all.length) return;
    all.sort((a, b) => scorePlacement(g, piece.shape, b) - scorePlacement(g, piece.shape, a));
    const pos = (Math.random() < skill) ? all[0]
      : all[Math.floor(Math.random() * Math.max(1, Math.ceil(all.length * (1 - skill * 0.7))))];
    const sc = scorePlacement(g, piece.shape, pos);
    if (!best || sc > best.sc) best = { piece, idx, pos, sc };
  });
  return best;
}
/** Clear anim from equipped FIELD only (not piece skin). Duration FIXED for fair play. */
const CLEAR_ANIM_MS = 110;
function getClearAnimMeta(boardDOM) {
  let fx = 'none';
  let boardId = '';
  try {
    const wrap = boardDOM && boardDOM.closest && boardDOM.closest('.board-wrap');
    if (wrap) {
      boardId = wrap.dataset.board || '';
      const hit = [...wrap.classList].find(c => c.startsWith('board-fx-'));
      if (hit) fx = hit.slice('board-fx-'.length);
    }
    // Always prefer catalog entry for this board id (reliable, independent of skins)
    if (typeof getBoardById === 'function') {
      const isOpp = boardDOM && (boardDOM.id === 'boardOpp' ||
        (boardDOM.closest && boardDOM.closest('.player-panel.opp')));
      const id = boardId || (!isOpp ? equippedBoardId : (window.mpOppBoardId || 'field_default'));
      const b = getBoardById(id);
      if (b && b.fx) fx = b.fx;
    }
  } catch (_) {}
  // Same ms everywhere — look differs by field theme / id
  if (fx === 'nebula') return { cls: 'clearing-nebula', name: 'clearNebula', beam: 'nebula', ms: CLEAR_ANIM_MS };
  if (fx === 'solar') return { cls: 'clearing-solar', name: 'clearSolar', beam: 'solar', ms: CLEAR_ANIM_MS };
  if (fx === 'quantum') return { cls: 'clearing-quantum', name: 'clearQuantum', beam: 'quantum', ms: CLEAR_ANIM_MS };
  if (fx === 'abyss') return { cls: 'clearing-abyss', name: 'clearAbyss', beam: 'abyss', ms: CLEAR_ANIM_MS };
  if (fx === 'prismfield') return { cls: 'clearing-prism', name: 'clearPrism', beam: 'prism', ms: CLEAR_ANIM_MS };
  if (fx === 'magma') return { cls: 'clearing-magma', name: 'clearMagma', beam: 'magma', ms: CLEAR_ANIM_MS };
  // Epic pulse fields: crystal vs neon_grid by board id
  if (fx === 'pulse') {
    if (boardId === 'field_neon_grid') return { cls: 'clearing-neon', name: 'clearNeon', beam: 'neon', ms: CLEAR_ANIM_MS };
    return { cls: 'clearing-epic', name: 'clearEpic', beam: 'epic', ms: CLEAR_ANIM_MS };
  }
  // Rare soft fields: unique per board
  if (fx === 'soft') {
    if (boardId === 'field_violet') return { cls: 'clearing-rare-violet', name: 'clearRareViolet', beam: 'rare-violet', ms: CLEAR_ANIM_MS };
    if (boardId === 'field_jade') return { cls: 'clearing-rare-jade', name: 'clearRareJade', beam: 'rare-jade', ms: CLEAR_ANIM_MS };
    return { cls: 'clearing-rare-azure', name: 'clearRareAzure', beam: 'rare-azure', ms: CLEAR_ANIM_MS };
  }
  return { cls: 'clearing-common', name: 'clearCommon', beam: null, ms: CLEAR_ANIM_MS };
}
const CLEARING_CLASSES = [
  'clearing', 'clearing-common',
  'clearing-rare', 'clearing-rare-azure', 'clearing-rare-violet', 'clearing-rare-jade',
  'clearing-epic', 'clearing-neon', 'clearing-magma',
  'clearing-nebula', 'clearing-solar', 'clearing-quantum', 'clearing-abyss', 'clearing-prism'
];
/** Visible line sweep on rare+ fields — makes clear unmistakably themed */
function spawnClearBeams(boardDOM, rows, cols, beamTheme) {
  if (!boardDOM || !beamTheme || settings.anim === 'off') return;
  const wrap = boardDOM.parentElement;
  if (!wrap) return;
  try {
    const boardRect = boardDOM.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const step = boardRect.height / SIZE;
    const paint = (isRow, index) => {
      const el = document.createElement('div');
      el.className = `clear-beam ${isRow ? 'row' : 'col'} ${beamTheme}`;
      if (isRow) {
        el.style.top = (boardRect.top - wrapRect.top + step * (index + 0.5)) + 'px';
        el.style.left = (boardRect.left - wrapRect.left) + 'px';
        el.style.width = boardRect.width + 'px';
      } else {
        el.style.left = (boardRect.left - wrapRect.left + step * (index + 0.5)) + 'px';
        el.style.top = (boardRect.top - wrapRect.top) + 'px';
        el.style.height = boardRect.height + 'px';
      }
      wrap.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, CLEAR_ANIM_MS + 40);
    };
    (rows || []).forEach(r => paint(true, r));
    (cols || []).forEach(c => paint(false, c));
  } catch (_) {}
}
/** Legendary-only: maximally distinct debris per field */
function spawnClearDebris(boardDOM, cellIndices, theme) {
  if (!boardDOM || !theme || settings.anim === 'off') return;
  const wrap = boardDOM.parentElement;
  if (!wrap) return;
  const themed = ['solar', 'abyss', 'nebula', 'quantum', 'prism',
    'magma', 'epic', 'neon', 'rare-azure', 'rare-violet', 'rare-jade', 'rare'];
  if (!themed.includes(theme)) return;
  try {
    const boardRect = boardDOM.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cellW = boardRect.width / SIZE;
    const cellH = boardRect.height / SIZE;
    const rand = (a, b) => a + Math.random() * (b - a);
    const add = (cls, x, y, dx, dy, rot, extraStyle) => {
      const el = document.createElement('div');
      el.className = 'clear-debris ' + cls;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--dy', dy.toFixed(1) + 'px');
      el.style.setProperty('--rot', (rot || 0) + 'deg');
      if (extraStyle) Object.assign(el.style, extraStyle);
      wrap.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 400);
    };
    // Cap debris on big multi-line clears for performance
    const indices = cellIndices.length > 16
      ? cellIndices.filter((_, i) => i % 2 === 0)
      : cellIndices;
    indices.forEach(idx => {
      const r = (idx / SIZE) | 0;
      const c = idx % SIZE;
      const cx = boardRect.left - wrapRect.left + (c + 0.5) * cellW;
      const cy = boardRect.top - wrapRect.top + (r + 0.5) * cellH;

      if (theme === 'solar') {
        // Explosion upward + outward (sun pieces)
        for (let i = 0; i < 4; i++) {
          const ang = rand(-Math.PI * 0.9, -Math.PI * 0.1); // mostly upward
          const dist = rand(22, 52);
          add('solar-shard', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, rand(-200, 200));
        }
        for (let i = 0; i < 3; i++) {
          const ang = rand(0, Math.PI * 2);
          const dist = rand(14, 36);
          add('solar-ember', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist - rand(8, 20), 0);
        }
      } else if (theme === 'abyss') {
        // ONLY vertical: drops sink hard, bubbles rise
        for (let i = 0; i < 3; i++) {
          add('abyss-drop', cx + rand(-8, 8), cy, 0, rand(20, 48), 0);
        }
        for (let i = 0; i < 3; i++) {
          add('abyss-bubble', cx + rand(-10, 10), cy + rand(0, 6), rand(-12, 12), rand(-28, -12), 0);
        }
      } else if (theme === 'nebula') {
        // Soft radial drift — slower, floaty
        for (let i = 0; i < 3; i++) {
          const ang = rand(0, Math.PI * 2);
          const dist = rand(16, 40);
          add('nebula-star', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, rand(-40, 40));
        }
        for (let i = 0; i < 4; i++) {
          const ang = rand(0, Math.PI * 2);
          const dist = rand(10, 32);
          add('nebula-dust', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
        }
      } else if (theme === 'quantum') {
        // Cardinal directions only + scan blips (robotic)
        const dirs = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]];
        dirs.forEach((d, i) => {
          const dist = 14 + (i % 4) * 6;
          add('quantum-bit', cx, cy, d[0] * dist, d[1] * dist, 0);
        });
        add('quantum-scan', cx, cy, rand(20, 36) * (Math.random() < 0.5 ? 1 : -1), 0, 0);
      } else if (theme === 'prism') {
        // Spectrum chips: 2–3 per cell, short travel — stays near the cleared line
        const hues = ['#ff6b81', '#ffd666', '#5ee7ff', '#c77dff', '#ff9de2'];
        const n = 2 + (Math.random() < 0.35 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
          const dist = rand(8, 18);
          add('prism-shard', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, rand(-90, 90), {
            background: hues[i % hues.length],
            boxShadow: '0 0 3px ' + hues[i % hues.length]
          });
        }
      } else if (theme === 'magma') {
        for (let i = 0; i < 4; i++) {
          const ang = rand(-Math.PI * 0.85, -Math.PI * 0.15);
          const dist = rand(14, 34);
          add('magma-ember', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
        }
      } else if (theme === 'epic') {
        for (let i = 0; i < 4; i++) {
          const ang = rand(0, Math.PI * 2);
          const dist = rand(12, 30);
          add('epic-spark', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
        }
      } else if (theme === 'neon') {
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          const dist = rand(12, 28);
          add('neon-bit', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
        }
      } else if (theme === 'rare-azure' || theme === 'rare-violet' || theme === 'rare-jade' || theme === 'rare') {
        const col = theme === 'rare-violet' ? '#b388ff' : theme === 'rare-jade' ? '#2dd4a8' : '#5ac8ff';
        for (let i = 0; i < 3; i++) {
          const ang = rand(0, Math.PI * 2);
          const dist = rand(8, 22);
          add('rare-spark', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0, {
            background: col,
            boxShadow: '0 0 6px ' + col
          });
        }
      }
    });
  } catch (_) {}
}
function clearLinesOn(g, boardDOM) {
  const rows=[], cols=[];
  for (let r=0;r<SIZE;r++) if (g[r].every(c => !!c)) rows.push(r);
  for (let c=0;c<SIZE;c++) if (g.every(row => !!row[c])) cols.push(c);
  if (!rows.length && !cols.length) return { count: 0, rows: [], cols: [] };
  const toAnim = new Set();
  rows.forEach(r => { for(let c=0;c<SIZE;c++) toAnim.add(r*SIZE+c); });
  cols.forEach(c => { for(let r=0;r<SIZE;r++) toAnim.add(r*SIZE+c); });
  const meta = getClearAnimMeta(boardDOM);
  const animCss = `${meta.name} ${meta.ms}ms ease-out forwards`;
  if (boardDOM) {
    toAnim.forEach(idx => {
      const cell = boardDOM.children[idx];
      if (!cell) return;
      CLEARING_CLASSES.forEach(c => cell.classList.remove(c));
      cell.style.setProperty('animation', 'none', 'important');
      void cell.offsetWidth;
      cell.classList.add(meta.cls);
      cell.style.setProperty('animation', animCss, 'important');
      cell.style.setProperty('transition', 'none', 'important');
      cell.style.setProperty('overflow', 'hidden', 'important');
    });
    if (meta.beam) spawnClearBeams(boardDOM, rows, cols, meta.beam);
    // Legendary debris from each cleared cell
    if (meta.beam) {
      spawnClearDebris(boardDOM, [...toAnim], meta.beam);
    }
  }
  rows.forEach(r => { for(let c=0;c<SIZE;c++) g[r][c]=null; });
  cols.forEach(c => { for(let r=0;r<SIZE;r++) g[r][c]=null; });
  // After anim: hard paint. Also a short safety re-paint in case place_ok raced.
  const clearBoard = boardDOM;
  const clearGridRef = g;
  setTimeout(() => {
    try { if (clearBoard) renderGrid(clearGridRef, clearBoard); } catch (_) {}
  }, meta.ms);
  setTimeout(() => {
    try { if (clearBoard) renderGrid(clearGridRef, clearBoard); } catch (_) {}
  }, meta.ms + 80);
  return { count: rows.length + cols.length, rows, cols };
}

/** Centers of cleared rows/cols relative to board-wrap for score floats */
/** Pixel position inside board-wrap for a cell (or fractional cell). */
function cellToWrapPos(boardDOM, r, c) {
  if (!boardDOM) return null;
  const wrap = boardDOM.parentElement;
  if (!wrap) return null;
  const wrapRect = wrap.getBoundingClientRect();
  const rr = Math.max(0, Math.min(SIZE - 1, Math.round(r)));
  const cc = Math.max(0, Math.min(SIZE - 1, Math.round(c)));
  const cell = boardDOM.children[rr * SIZE + cc];
  if (!cell) return null;
  const cr = cell.getBoundingClientRect();
  // Sub-cell offset when r/c are fractional (piece center)
  const fr = r - rr;
  const fc = c - cc;
  return {
    left: cr.left + cr.width * (0.5 + fc) - wrapRect.left,
    top: cr.top + cr.height * (0.5 + fr) - wrapRect.top
  };
}
/**
 * Float positions for clear bonus.
 * Prefer the placed piece center (where the combo came from) — never force board center.
 * Optional: also mark midpoints of cleared rows/cols near the piece.
 */
function getClearFloatPositions(boardDOM, rows, cols, placeAnchor) {
  if (!boardDOM) return [];
  const pts = [];
  // Primary: where the piece was dropped
  if (placeAnchor && typeof placeAnchor.centerR === 'number' && typeof placeAnchor.centerC === 'number') {
    const p = cellToWrapPos(boardDOM, placeAnchor.centerR, placeAnchor.centerC);
    if (p) pts.push({ left: p.left, top: p.top, kind: 'place' });
  } else if (placeAnchor && typeof placeAnchor.baseR === 'number') {
    const p = cellToWrapPos(boardDOM, placeAnchor.baseR, placeAnchor.baseC);
    if (p) pts.push({ left: p.left, top: p.top, kind: 'place' });
  }
  // If we have a place anchor, one float at the piece is enough (full bonus shown there)
  if (pts.length) return pts;
  // Fallback without anchor: centers of cleared lines (not whole-board center unless line is middle)
  const wrap = boardDOM.parentElement;
  if (!wrap) return pts;
  const wrapRect = wrap.getBoundingClientRect();
  (rows || []).forEach(r => {
    // Center of the cleared row horizontally among filled span — use mid of board only as row midpoint
    const cell = boardDOM.children[r * SIZE + Math.floor((SIZE - 1) / 2)];
    if (!cell) return;
    const cr = cell.getBoundingClientRect();
    pts.push({
      left: cr.left + cr.width / 2 - wrapRect.left,
      top: cr.top + cr.height / 2 - wrapRect.top,
      kind: 'row'
    });
  });
  (cols || []).forEach(c => {
    const cell = boardDOM.children[Math.floor((SIZE - 1) / 2) * SIZE + c];
    if (!cell) return;
    const cr = cell.getBoundingClientRect();
    pts.push({
      left: cr.left + cr.width / 2 - wrapRect.left,
      top: cr.top + cr.height / 2 - wrapRect.top,
      kind: 'col'
    });
  });
  return pts;
}
function renderGrid(g, boardDOM) {
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
    const cell = boardDOM.children[r*SIZE+c];
    if (!cell) continue;
    const val = g[r][c];
    if (val) {
      const prev = cell.style.getPropertyValue('--cell-base');
      // Keep in-flight placeSoft visible even if renderGrid runs mid-settle
      const already = cell.classList.contains('filled') && prev === val &&
        !cell.classList.contains('preview-ok') && !cell.classList.contains('preview-bad');
      if (already) {
        let clearing = false;
        for (let k=0;k<CLEARING_CLASSES.length;k++) {
          if (cell.classList.contains(CLEARING_CLASSES[k])) { clearing = true; break; }
        }
        // Skip thrash — preserves .placing animation
        if (!clearing) continue;
      }
      if (prev !== val) paintCellColor(cell, val);
      if (!cell.classList.contains('filled')) cell.classList.add('filled');
      CLEARING_CLASSES.forEach(cl => cell.classList.remove(cl));
      cell.classList.remove('preview-ok','preview-bad');
      // Only kill place anim when color/value actually changed
      if (prev !== val) {
        cell.classList.remove('placing');
        cell.style.removeProperty('animation');
        cell.style.removeProperty('transition');
        cell.style.removeProperty('transform');
        cell.style.removeProperty('opacity');
        cell.style.removeProperty('filter');
        cell.style.removeProperty('box-shadow');
        cell.style.removeProperty('clip-path');
      }
    } else {
      const wasClearing = CLEARING_CLASSES.some(cl => cell.classList.contains(cl));
      if (cell.classList.contains('filled') || cell.classList.contains('preview-ok') || cell.classList.contains('preview-bad') || wasClearing || cell.classList.contains('placing')) {
        // Kill any in-flight clear anim without a flash-back
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
        CLEARING_CLASSES.forEach(cl => cell.classList.remove(cl));
        cell.classList.remove('filled','preview-ok','preview-bad','placing');
        // Restore default transition on next frame
        requestAnimationFrame(() => {
          if (!cell.classList.contains('filled')) {
            cell.style.removeProperty('transition');
            cell.style.removeProperty('animation');
          }
        });
      }
    }
  }
}
function createBoardDOM(el) {
  el.innerHTML = '';
  for (let i=0;i<SIZE*SIZE;i++) {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.dataset.idx = i;
    el.appendChild(cell);
  }
  try {
    const wrap = el && el.closest && el.closest('.board-wrap');
    if (wrap && typeof getBoardById === 'function') {
      const isOpp = (el && el.id === 'boardOpp') || (wrap.closest && wrap.closest('.player-panel.opp'));
      const b = getBoardById(isOpp ? 'field_default' : equippedBoardId);
      applyBoardToWrap(wrap, b);
    }
  } catch (_) {}
}
function bonusFor(cleared) {
  if (_R) return _R.bonusFor(cleared);
  return [0,100,300,600,1000,1500,2200,3000,4000][cleared] || 4000;
}
/** Extra points for consecutive clears (chain): 2nd clear +50, 3rd +100, … */
function chainBonusFor(chain) {
  if (_R) return _R.chainBonusFor(chain);
  if (chain < 2) return 0;
  return Math.min(800, (chain - 1) * 50);
}

function saveClassicState() {
  if (mode !== 'classic') return;
  try {
    const payload = {
      grid,
      score,
      diamonds,
      pieces: (pieces || []).map(p => ({
        shape: p.shape.map(c => c.slice()),
        color: p.color,
        used: !!p.used
      }))
    };
    localStorage.setItem('bp_classic_save', JSON.stringify(payload));
  } catch (_) {}
}
function clearClassicSave() {
  try { localStorage.removeItem('bp_classic_save'); } catch (_) {}
}
function loadClassicState() {
  try {
    const raw = localStorage.getItem('bp_classic_save');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.grid) || data.grid.length !== SIZE) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function clearBoardScoreFX() {
  try {
    document.querySelectorAll('.score-float').forEach(el => el.remove());
    document.querySelectorAll('.combo-banner').forEach(b => {
      b.classList.remove('show');
      b.textContent = '';
      try {
        b.style.opacity = '';
        b.style.left = '';
        b.style.top = '';
      } catch (_) {}
    });
    window._lastPlaceAnchor = null;
  } catch (_) {}
}
function startClassic(forceNew) {
  const run = () => {
  // Hard-stop any leftover versus / AI clocks before classic board opens
  try {
    if (typeof vsTimerId !== 'undefined' && vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
    if (typeof aiInterval !== 'undefined' && aiInterval) { clearInterval(aiInterval); aiInterval = null; }
    if (typeof replayTimer !== 'undefined' && replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    vsActive = false;
    replayMode = false;
    document.body.classList.remove('replay-ui');
    document.body.classList.remove('replay-playing');
  } catch (_) {}
  showScreen('classic');
  mode = 'classic';
  try { clearBoardScoreFX(); } catch (_) {}
  gameOverEl.classList.remove('visible');
  stuckOfferEl.classList.remove('visible');
  selectedIdx = -1; placingLock = false;

  const saved = (!forceNew) ? loadClassicState() : null;
  if (saved) {
    grid = saved.grid.map(row => row.map(c => c));
    score = typeof saved.score === 'number' ? saved.score : 0;
    if (typeof saved.diamonds === 'number') diamonds = saved.diamonds;
    if (diamonds < 0) diamonds = 0;
    pieces = Array.isArray(saved.pieces) && saved.pieces.length
      ? saved.pieces.map(p => ({
          shape: (p.shape || []).map(c => c.slice()),
          color: p.color || COLORS[0],
          used: !!p.used
        }))
      : [randomPiece(), randomPiece(), randomPiece()];
  } else {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0;
    if (diamonds < 1) diamonds = 3;
    pieces = [randomPiece(), randomPiece(), randomPiece()];
  }
  clearChain = 0;

  updateClassicUI();
  createBoardDOM(boardEl);
  applyBoardScales();
  renderGrid(grid, boardEl);
  renderPieces(piecesArea);
  // If all pieces used, deal new set
  if (pieces.every(p => p.used)) generatePieces(piecesArea);
  updateBoardMetrics(boardEl);
  saveClassicState();
  };
  // Open board immediately — no waiting on intro
  run();
  // Optional brief flash (does not block input)
  try {
    showMatchIntro({
      label: 'Классика',
      title: 'Собери поле',
      sub: forceNew ? 'Новая партия' : 'Продолжение',
      goText: 'Играй!',
      ms: 520
    });
  } catch (_) {}
}
function updateClassicUI() {
  scoreEl.textContent = score; bestEl.textContent = best; diamondsEl.textContent = diamonds;
  localStorage.setItem('bp_diamonds', diamonds);
  document.getElementById('btnRelief').disabled = diamonds < 1;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem('bp_best', best);
  }
  try {
    if (mode === 'classic' && score >= 50000 && !window._classicUsedRelief) {
      setAchStat('perfectClassic', 1);
    }
  } catch (_) {}
  saveClassicState();
}
function generatePieces(areaEl) {
  // Ranked room mode: server owns deal — never invent local hands, never wipe tray
  if (roomMatchMode || window._roomMatchMode) {
    try {
      // If we still have unused pieces, just re-render; do not request deal
      const hasLive = Array.isArray(pieces) && pieces.some(p => p && !p.used);
      if (hasLive) {
        if (areaEl) renderPieces(areaEl);
        return;
      }
      // Hand empty — ask server; keep showing empty until deal arrives (do not randomize)
      try { if (typeof roomSendDeal === 'function') roomSendDeal({}); } catch (_) {}
      if (areaEl) renderPieces(areaEl);
    } catch (_) {}
    return;
  }
  pieces = [randomPiece(), randomPiece(), randomPiece()];
  try { window._animateDealIn = true; window._quietPieceRender = false; } catch (_) {}
  renderPieces(areaEl);
  if (mode === 'versus' && vsActive) {
    logDeal('me', pieces);
    if (mpMode) {
      
    }
  }
  if (mode === 'classic') saveClassicState();
}
function getPieceCellPx(isVs) {
  // Prefer live board cell so tray pieces stay proportional after any scale
  try {
    const board = isVs ? document.getElementById('boardMe') : document.getElementById('board');
    if (board) {
      const w = board.getBoundingClientRect().width;
      if (w > 40) {
        const boardCell = w / SIZE;
        return Math.max(isVs ? 8 : 9, Math.min(isVs ? 16 : 22, Math.round(boardCell * 0.42)));
      }
    }
  } catch (_) {}
  const cs = getComputedStyle(document.documentElement);
  if (isVs) {
    const v = parseFloat(cs.getPropertyValue('--versus-piece'));
    return Number.isFinite(v) && v > 0 ? v : 12;
  }
  const v = parseFloat(cs.getPropertyValue('--classic-piece'));
  return Number.isFinite(v) && v > 0 ? v : 16;
}
function getPieceSlotPx(isVs) {
  const cell = getPieceCellPx(isVs);
  return Math.max(isVs ? 44 : 56, Math.min(isVs ? 78 : 110, cell * 5 + (isVs ? 8 : 12)));
}
function renderPieces(areaEl) {
  // Never overwrite replay trays with live hand
  if (typeof replayMode !== 'undefined' && replayMode) return;
  // Rejoin / desync safety: try restore own hand from match log if empty
  try {
    if ((!pieces || !pieces.length) && (vsModeType === 'online' || mpMode || mode === 'versus')) {
      recoverHandsFromMatchLog();
    }
  } catch (_) {}
  areaEl.innerHTML = '';
  const isVs = mode === 'versus' || (areaEl && areaEl.id === 'piecesAreaVs');
  const cellPx = getPieceCellPx(isVs);
  const slotPx = getPieceSlotPx(isVs);
  if (!pieces || !pieces.length) return;
  const quiet = !!(window._quietPieceRender);
  const animateIn = !quiet && !!(window._animateDealIn);
  pieces.forEach((p, idx) => {
    const slot = document.createElement('div');
    slot.className = 'piece-slot'; slot.dataset.idx = idx;
    // Store shape signature so softRender can detect rejoin desync
    try {
      const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
      slot.dataset.handSig = (p.used ? 'U' : 'A') + '|' + (p.color || '') + '|' + sh;
    } catch (_) {}
    if (p.used) { slot.classList.add('used'); areaEl.appendChild(slot); return; }
    slot.style.width = slotPx + 'px';
    slot.style.height = slotPx + 'px';
    slot.style.minWidth = slotPx + 'px';
    const maxR = Math.max(...p.shape.map(s=>s[0])), maxC = Math.max(...p.shape.map(s=>s[1]));
    const gridEl = document.createElement('div');
    gridEl.className = 'piece-grid';
    gridEl.style.gridTemplateColumns = `repeat(${maxC+1},${cellPx}px)`;
    gridEl.style.gridTemplateRows = `repeat(${maxR+1},${cellPx}px)`;
    gridEl.style.gap = isVs ? '1px' : '1.5px';
    const occ = new Set(p.shape.map(([r,c])=>r+','+c));
    for (let r=0;r<=maxR;r++) for (let c=0;c<=maxC;c++) {
      const cell = document.createElement('div');
      if (occ.has(r+','+c)) {
        cell.className='piece-cell';
        paintCellColor(cell, p.color);
        cell.style.width=cellPx+'px';
        cell.style.height=cellPx+'px';
      }
      gridEl.appendChild(cell);
    }
    slot.appendChild(gridEl); areaEl.appendChild(slot);
    if (animateIn) {
      // Smooth short pop-in for new deals (not for quiet network sync)
      slot.classList.add('deal-in');
      slot.style.opacity = '0';
      slot.style.transform = 'scale(0.72) translateY(10px)';
      const delay = idx * 45;
      setTimeout(() => {
        try {
          slot.classList.add('show');
          slot.style.opacity = '1';
          slot.style.transform = 'scale(1) translateY(0)';
        } catch (_) {}
      }, 20 + delay);
      setTimeout(() => {
        try { slot.classList.remove('deal-in'); } catch (_) {}
      }, 320 + delay);
    } else {
      // Quiet/sync path: no animation, stay interactive
      slot.classList.add('show');
      slot.style.opacity = '1';
      slot.style.transform = 'none';
      slot.style.transition = 'none';
      try { slot.style.animation = 'none'; } catch (_) {}
    }
    const startHandler = e => startDrag(e, idx, areaEl);
    slot.style.pointerEvents = 'auto';
    slot.style.touchAction = 'none';
    try {
      if (typeof _pieceHandSig === 'function') slot.dataset.handSig = _pieceHandSig(p);
    } catch (_) {}
    if (window.PointerEvent) {
      slot.addEventListener('pointerdown', startHandler, { passive: false });
    } else {
      slot.addEventListener('touchstart', startHandler, { passive: false });
      slot.addEventListener('mousedown', startHandler, { passive: false });
    }
  });
  try { window._animateDealIn = false; } catch (_) {}
}
function markPieceUsed(idx, areaEl) {
  // Never skip marking used — locks only block NEW input, not finishing a placed piece
  if (!pieces[idx]) return;
  pieces[idx].used = true;
  const slot = areaEl && areaEl.querySelector(`.piece-slot[data-idx="${idx}"]`);
  if (!slot) return;
  slot.classList.remove('lifting','show');
  slot.classList.add('used');
  try {
    slot.style.width = '0';
    slot.style.minWidth = '0';
    slot.style.opacity = '0';
    slot.innerHTML = '';
  } catch (_) {}
}

function getActiveBoard() { return mode==='versus' ? boardMe : boardEl; }
function getActiveGrid() { return grid; }
function getActivePiecesArea() { return mode==='versus' ? piecesAreaVs : piecesArea; }
function getActiveBanner() { return mode==='versus' ? comboBannerMe : comboBanner; }

let _metricsDirty = true;
let _finePointerCached = null;
function invalidateBoardMetrics() { _metricsDirty = true; }
function updateBoardMetrics(el) {
  const target = el || getActiveBoard();
  if (!target) return;
  boardRect = target.getBoundingClientRect();
  // Uniform step across the board — robust under any CSS scale/gap
  const step = boardRect.width / SIZE;
  gap = 0;
  cellSize = step;
  // Refine with real first-cell size when available (for visual lift only)
  const c0 = target.children[0];
  if (c0) {
    const r0 = c0.getBoundingClientRect();
    if (r0.width > 4) cellSize = r0.width;
  }
  _metricsDirty = false;
}
function ensureBoardMetrics() {
  if (_metricsDirty || !boardRect || boardRect.width < 8) updateBoardMetrics();
}
function isFinePointer() {
  if (_finePointerCached != null) return _finePointerCached;
  try {
    _finePointerCached = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  } catch (_) { _finePointerCached = false; }
  return _finePointerCached;
}
/** Finger → board aim point. No magnet — 1:1 with finger, piece lifted above. */
function aimFromPointer(clientX, clientY) {
  ensureBoardMetrics();
  // Keep aim almost under the finger/cursor — ghost sits just above the contact point
  const fine = isFinePointer();
  const base = cellSize > 4 ? cellSize : 24;
  const lift = fine
    ? Math.max(6, Math.min(18, base * 0.35))
    : Math.max(18, Math.min(36, base * 0.95));
  return { x: clientX, y: clientY - lift, lift };
}

function eventClientXY(e) {
  if (!e) return { x: 0, y: 0 };
  if (typeof e.clientX === 'number' && (e.touches === undefined || !e.touches.length)) {
    return { x: e.clientX, y: e.clientY };
  }
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (t) return { x: t.clientX, y: t.clientY };
  if (typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
  return { x: 0, y: 0 };
}
let activeDragPointerId = null;
function clearAllLifting(areaEl) {
  try {
    const root = areaEl || document;
    root.querySelectorAll('.piece-slot.lifting').forEach(s => {
      if (!s.classList.contains('used')) {
        s.classList.remove('lifting');
        s.classList.add('show');
      }
    });
  } catch (_) {}
}
/** Abort any in-progress piece drag (used during rejoin load). */
function cancelActivePieceDrag() {
  try {
    isDragging = false;
    activeDragPointerId = null;
    dragPiece = null;
    selectedIdx = -1;
    lastPreview = null;
    if (typeof rafId !== 'undefined' && rafId) {
      try { cancelAnimationFrame(rafId); } catch (_) {}
      rafId = 0;
    }
    try { clearPreview(); } catch (_) {}
    try { hideGhost(); } catch (_) {}
    try {
      if (ghost) {
        ghost.classList.remove('visible');
        ghost.style.display = 'none';
      }
    } catch (_) {}
    try { clearAllLifting(); } catch (_) {}
    // Strip document-level drag listeners that may still be attached
    try {
      const noop = () => {};
      document.removeEventListener('pointermove', noop);
      // Named handlers are scoped inside startDrag — force visual restore via re-render
    } catch (_) {}
  } catch (_) {}
}
function startDrag(e, idx, areaEl) {
  // Always clear sticky locks unless rejoin overlay is actually visible
  try {
    const ov = document.getElementById('rejoinLoading');
    const ovOn = ov && (ov.classList.contains('show') || ov.classList.contains('visible'));
    if (!ovOn) {
      window._rejoinLoading = false;
      window._rejoinInputLock = false;
      try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
      if (ov) {
        try { ov.classList.remove('show', 'visible'); ov.style.display = 'none'; } catch (_) {}
      }
    }
    if (placingLock && !isDragging) placingLock = false;
    try {
      if (!document.getElementById('matchEndFreeze')?.classList.contains('visible')) {
        document.body.classList.remove('match-ending');
      }
    } catch (_) {}
    // Live online match must be interactive
    if (mode === 'versus' && (mpMode || roomMatchMode || window._roomMatchMode)) {
      if (!vsActive && !window._matchEnded) vsActive = true;
      try { vsIntroLock = false; mpMatchStarting = false; mpLoading = false; } catch (_) {}
    }
  } catch (_) {}
  if (window._rejoinLoading || window._rejoinInputLock || placingLock) return;
  if (!pieces[idx] || pieces[idx].used) return;
  if (mode==='versus' && !vsActive) return;
  // One piece at a time — ignore second finger / multi-touch
  if (isDragging) return;
  if (e && e.pointerId != null && activeDragPointerId != null && e.pointerId !== activeDragPointerId) return;
  // Never hard-lock on playerStuck: if this piece fits, unstick and allow
  if (mode === 'versus' && playerStuck) {
    if (pieceIsPlayable(grid, pieces[idx])) {
      playerStuck = false;
      const w = document.getElementById('stuckWait');
      if (w) w.style.display = 'none';
      } else {
      return; // this specific piece can't place
    }
  }
  e.preventDefault(); e.stopPropagation();
  selectedIdx = idx; dragPiece = pieces[idx]; isDragging = true;
  activeDragPointerId = (e && e.pointerId != null) ? e.pointerId : 'mouse';
  SFX.pick();
  const xy0 = eventClientXY(e);
  pointerX = xy0.x; pointerY = xy0.y;
  updateBoardMetrics();
  const slot = e.currentTarget;
  // Ensure no other slot is stuck in lifting from a previous multi-touch
  clearAllLifting(areaEl);
  slot.classList.add('lifting');
  showGhost(dragPiece);
  const slotRect = slot.getBoundingClientRect();
  ghost.classList.add('no-glide');
  invalidateBoardMetrics();
  updateBoardMetrics();
  moveGhost(slotRect.left + slotRect.width / 2, slotRect.top + slotRect.height / 2);
  ghost.style.display = 'block';
  requestAnimationFrame(() => {
    ghost.classList.add('visible');
    const aim = aimFromPointer(pointerX, pointerY);
    updatePreview(aim.x, aim.y);
    // First frame: jump to aim without lag (no-glide already on)
    moveGhost(aim.x, aim.y);
    requestAnimationFrame(() => {
      // Keep no-glide until cell snap decides cell-glide in dragFrame
      _ghostCellKey = '';
      if (isDragging) dragFrame();
    });
  });
  try {
    if (e.pointerId != null && slot.setPointerCapture) slot.setPointerCapture(e.pointerId);
  } catch(_){}
  const onMove = ev => {
    if (!isDragging) return;
    const xy = eventClientXY(ev);
    pointerX = xy.x; pointerY = xy.y;
    if (ev.cancelable && ev.type && ev.type.indexOf('touch') === 0) {
      try { ev.preventDefault(); } catch (_) {}
    }
    if (!rafId) rafId = requestAnimationFrame(dragFrame);
  };
  const unbind = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    document.removeEventListener('touchcancel', onUp);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  const onUp = ev => {
    if (!isDragging) return;
    // Ignore pointerup from a different finger
    if (ev && ev.pointerId != null && activeDragPointerId != null &&
        activeDragPointerId !== 'mouse' && ev.pointerId !== activeDragPointerId) {
      return;
    }
    // Rejoin loading overlay only — solo wait / rejoin flag must still allow play
    if (window._rejoinLoading || window._rejoinInputLock || placingLock) {
      isDragging = false;
      activeDragPointerId = null;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      try {
        if (e.pointerId != null && slot.releasePointerCapture) slot.releasePointerCapture(e.pointerId);
      } catch (_) {}
      try { ghost.classList.remove('visible'); hideGhost(); } catch (_) {}
      try { slot.classList.remove('lifting'); slot.classList.add('show'); } catch (_) {}
      try { clearAllLifting(areaEl); } catch (_) {}
      try { clearPreview(); } catch (_) {}
      lastPreview = null;
      dragPiece = null;
      unbind();
      return;
    }
    isDragging = false;
    activeDragPointerId = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId=0; }
    try {
      if (e.pointerId != null && slot.releasePointerCapture) slot.releasePointerCapture(e.pointerId);
    } catch(_){}
    const xy = eventClientXY(ev);
    pointerX = xy.x; pointerY = xy.y;
    updateBoardMetrics();
    const aim = aimFromPointer(pointerX, pointerY);
    let placed = false;
    if (lastPreview && lastPreview.valid && dragPiece) {
      const pos = getGridPos(aim.x, aim.y);
      if (pos) {
        const maxR = Math.max(...dragPiece.shape.map(s => s[0]));
        const maxC = Math.max(...dragPiece.shape.map(s => s[1]));
        const expectR = pos.r - Math.floor(maxR / 2);
        const expectC = pos.c - Math.floor(maxC / 2);
        if (Math.abs(lastPreview.baseR - expectR) <= 1 && Math.abs(lastPreview.baseC - expectC) <= 1) {
          placed = tryPlaceAt(aim.x, aim.y, lastPreview);
        }
      }
    }
    if (!placed) placed = tryPlaceAt(aim.x, aim.y);
    // Soft lock: settle ghost onto board center before fade (desktop-like, no hard snap)
    try {
      if (placed && lastPreview && lastPreview.valid && dragPiece) {
        const center = placementWorldCenter(lastPreview, dragPiece.shape);
        if (center) {
          ghost.classList.remove('no-glide');
          ghost.classList.add('cell-glide');
          moveGhost(center.x, center.y);
        }
      }
    } catch (_) {}
    ghost.classList.remove('visible');
    setTimeout(hideGhost, placed ? 160 : 100);
    if (placed) markPieceUsed(idx, areaEl);
    else { SFX.bad(); slot.classList.remove('lifting'); slot.classList.add('show'); }
    // Always clear any stuck lifting slots (multi-touch recovery)
    clearAllLifting(areaEl);
    // clearPreview after place must not rewrite filled cells (see clearPreview guard)
    clearPreview(); lastPreview = null;
    dragPiece = null;
    unbind();
  };
  if (window.PointerEvent) {
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  } else {
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);
  }
}

/** World center of a placement so the ghost sits flush on those cells */
function placementWorldCenter(result, shape) {
  if (!boardRect || !result || !shape) return null;
  const step = boardRect.width / SIZE;
  const maxR = Math.max(...shape.map(s => s[0]));
  const maxC = Math.max(...shape.map(s => s[1]));
  const cx = boardRect.left + (result.baseC + (maxC + 1) / 2) * step;
  const cy = boardRect.top + (result.baseR + (maxR + 1) / 2) * step;
  return { x: cx, y: cy };
}
let _ghostCellKey = '';
function dragFrame() {
  rafId = 0; if (!isDragging) return;
  // Cache board rect for the whole drag — measuring every frame forces layout on mobile
  ensureBoardMetrics();
  const aim = aimFromPointer(pointerX, pointerY);
  updatePreview(aim.x, aim.y);
  // Soft cell lock: ghost snaps/glides to placement grid center
  if (lastPreview && dragPiece && boardRect && boardRect.width > 8) {
    const key = lastPreview.baseR + ',' + lastPreview.baseC + ',' + (lastPreview.valid ? 1 : 0);
    const center = placementWorldCenter(lastPreview, dragPiece.shape);
    if (center) {
      if (key !== _ghostCellKey) {
        _ghostCellKey = key;
        ghost.classList.remove('no-glide');
        ghost.classList.add('cell-glide');
      }
      moveGhost(center.x, center.y);
      return;
    }
  }
  // Off-board / free finger: 1:1 follow — no CSS transition lag
  _ghostCellKey = '';
  ghost.classList.add('no-glide');
  ghost.classList.remove('cell-glide');
  moveGhost(aim.x, aim.y);
}
function showGhost(piece) {
  ghost.innerHTML = ''; ghost.classList.remove('visible');
  invalidateBoardMetrics();
  updateBoardMetrics();
  let px = 24;
  let gapPx = 2;
  if (boardRect && boardRect.width > 40) {
    const step = boardRect.width / SIZE;
    if (cellSize > 4 && cellSize <= step) {
      px = Math.round(cellSize);
      gapPx = Math.max(1, Math.round(step - cellSize));
    } else {
      px = Math.max(12, Math.min(48, Math.round(step * 0.9)));
      gapPx = Math.max(1, Math.round(step - px));
    }
  }
  const maxR = Math.max(...piece.shape.map(s => s[0]));
  const maxC = Math.max(...piece.shape.map(s => s[1]));
  const gridEl = document.createElement('div');
  gridEl.className = 'piece-grid';
  gridEl.style.gridTemplateColumns = `repeat(${maxC + 1}, ${px}px)`;
  gridEl.style.gridTemplateRows = `repeat(${maxR + 1}, ${px}px)`;
  gridEl.style.gap = gapPx + 'px';
  const occ = new Set(piece.shape.map(([r, c]) => r + ',' + c));
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
    const cell = document.createElement('div');
    if (occ.has(r + ',' + c)) {
      cell.className = 'piece-cell';
      paintCellColor(cell, piece.color);
      cell.style.width = px + 'px';
      cell.style.height = px + 'px';
      cell.style.borderRadius = Math.max(3, Math.round(px * 0.18)) + 'px';
    }
    gridEl.appendChild(cell);
  }
  ghost.appendChild(gridEl);
  _ghostCellKey = '';
}
function moveGhost(x, y) {
  // Compositor path: --gx/--gy drive translate3d (see #ghost CSS)
  ghost.style.setProperty('--gx', x + 'px');
  ghost.style.setProperty('--gy', y + 'px');
  const scale = ghost.classList.contains('visible') ? 1 : 0.7;
  ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) scale(' + scale + ')';
}
function hideGhost() {
  ghost.style.display = 'none';
  ghost.classList.remove('visible', 'cell-glide', 'no-glide');
}

function getGridPos(clientX, clientY) {
  ensureBoardMetrics();
  const x = clientX - boardRect.left;
  const y = clientY - boardRect.top;
  const step = boardRect.width / SIZE;
  // Modest pad — stay on the board, less aggressive edge snap
  const pad = step * 0.45;
  if (x < -pad || y < -pad || x > boardRect.width + pad || y > boardRect.height + pad) return null;
  // Nearest cell by center — stable and predictable
  let c = Math.round((x - step / 2) / step);
  let r = Math.round((y - step / 2) / step);
  c = Math.max(0, Math.min(SIZE - 1, c));
  r = Math.max(0, Math.min(SIZE - 1, r));
  return { r, c };
}
function findBestPlacement(shape, hintR, hintC) {
  const maxR = Math.max(...shape.map(s => s[0]));
  const maxC = Math.max(...shape.map(s => s[1]));
  // Align piece bbox center under the aim cell (matches ghost -50%/-50%)
  const aimR = hintR - Math.floor(maxR / 2);
  const aimC = hintC - Math.floor(maxC / 2);
  const g = getActiveGrid();

  // Soft assist: only nearest neighbour (radius 1) — less aggressive hop between slots
  const radius = 1;
  let best = null;
  let bestScore = Infinity;
  for (let or = -radius; or <= radius; or++) {
    for (let oc = -radius; oc <= radius; oc++) {
      const r = aimR + or;
      const c = aimC + oc;
      if (!canPlaceOn(g, shape, r, c)) continue;
      const manh = Math.abs(or) + Math.abs(oc);
      // Prefer exact aim strongly; diagonal slightly penalized
      const score = manh * 1.35 + (or !== 0 && oc !== 0 ? 0.35 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { baseR: r, baseC: c, valid: true };
      }
    }
  }
  // Exact aim wins when valid
  if (canPlaceOn(g, shape, aimR, aimC)) {
    return { baseR: aimR, baseC: aimC, valid: true };
  }
  if (best) return best;

  return {
    baseR: Math.max(0, Math.min(SIZE - 1 - maxR, aimR)),
    baseC: Math.max(0, Math.min(SIZE - 1 - maxC, aimC)),
    valid: false
  };
}

// Track only cells currently in preview — avoid scanning the whole board each move
let _previewCells = [];
function updatePreview(x,y) {
  const pos = getGridPos(x,y); const board = getActiveBoard();
  if (!pos||!dragPiece) { clearPreview(); lastPreview=null; return; }
  const result = findBestPlacement(dragPiece.shape, pos.r, pos.c);
  // Always keep placement aim for drop accuracy, even when visual preview is off
  if (lastPreview && lastPreview.baseR===result.baseR && lastPreview.baseC===result.baseC && lastPreview.valid===result.valid) {
    return;
  }
  clearPreview();
  lastPreview = result;
  // Visual highlight disabled in settings — do not paint cells (avoids blink via opacity transition)
  if (settings.preview === '0' || document.body.classList.contains('no-preview')) {
    return;
  }
  const cls = result.valid ? 'preview-ok' : 'preview-bad';
  const g = getActiveGrid();
  const color = dragPiece.color;
  _previewCells = [];
  for (const [dr,dc] of dragPiece.shape) {
    const r=result.baseR+dr, c=result.baseC+dc;
    if (r<0||r>=SIZE||c<0||c>=SIZE) continue;
    const cell = board.children[r*SIZE+c];
    if (!cell) continue;
    if (g[r][c]) continue;
    cell.classList.add(cls);
    cell.style.background = color;
    _previewCells.push(cell);
  }
}
function clearPreview() {
  const g = getActiveGrid();
  const scrub = (cell, r, col) => {
    if (!cell) return;
    cell.classList.remove('preview-ok', 'preview-bad');
    // CRITICAL: if this cell is now a real filled piece (or mid place anim),
    // do NOT rewrite background/styles — that cancels placeSoft/legendPlace on mobile
    if (cell.classList.contains('filled') || cell.classList.contains('placing')) return;
    if (r >= 0 && g[r] && g[r][col]) {
      cell.style.background = g[r][col];
    } else {
      cell.style.removeProperty('background');
      cell.style.removeProperty('background-color');
      cell.style.removeProperty('background-image');
    }
  };
  if (!_previewCells.length) {
    const board = getActiveBoard();
    if (!board) return;
    for (let i = 0; i < board.children.length; i++) {
      const cell = board.children[i];
      if (!cell.classList.contains('preview-ok') && !cell.classList.contains('preview-bad')) continue;
      scrub(cell, Math.floor(i / SIZE), i % SIZE);
    }
    return;
  }
  for (let i = 0; i < _previewCells.length; i++) {
    const cell = _previewCells[i];
    if (!cell) continue;
    const idx = cell.dataset.idx != null ? parseInt(cell.dataset.idx, 10) : -1;
    const r = idx >= 0 ? Math.floor(idx / SIZE) : -1;
    const col = idx >= 0 ? idx % SIZE : -1;
    scrub(cell, r, col);
  }
  _previewCells = [];
}


/** Diamonds from multi-clears: classic and all versus modes (bots, ranked, friends). */
function canEarnClearDiamonds() {
  return mode === 'classic' || mode === 'versus';
}
function tryPlaceAt(x, y, forcedResult) {
  // Only hard rejoin overlay blocks; _mpRejoiningMatch alone must not freeze the player
  if (window._rejoinLoading || window._rejoinInputLock || placingLock) return false;
  const pos = getGridPos(x, y);
  if (!pos || selectedIdx < 0 || !dragPiece) return false;
  const result = (forcedResult && forcedResult.valid) ? forcedResult : findBestPlacement(dragPiece.shape, pos.r, pos.c);
  if (!result.valid) return false;

  const isServerMatch = !!(roomMatchMode || window._roomMatchMode);

  // ——— Server-authoritative place (online room / ranked) ———
  // Client only sends intent; grid/hand/score come back via place_ok.
  if (isServerMatch) {
    placingLock = true;
    hapticTap(14);
    SFX.place();
    const color = dragPiece.color, shape = dragPiece.shape;
    const placedIdx = selectedIdx;
    const board = getActiveBoard();
    let netShape = shape.map(p => p.slice());
    try {
      if (typeof normalize === 'function') netShape = normalize(netShape.map(p => p.slice()));
    } catch (_) {}

    // Soft local preview only (not authoritative). Rollback on place_reject.
    const _legendNow = document.body.classList.contains('skin-fx-prism');
    window._pendingServerPlace = {
      pieceIdx: placedIdx,
      r: result.baseR,
      c: result.baseC,
      shape: netShape.map(c => c.slice()),
      color,
      gridBefore: grid.map(row => row.slice()),
      piecesBefore: (pieces || []).map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      })),
      scoreBefore: score | 0,
      legendFx: !!_legendNow,
      skinId: _legendNow ? (document.body.dataset.skinId || (typeof equippedSkinId !== 'undefined' ? equippedSkinId : null)) : null
    };
    try {
      for (const [dr, dc] of shape) {
        const cell = board && board.children[(result.baseR + dr) * SIZE + (result.baseC + dc)];
        if (!cell) continue;
        cell.classList.remove('preview-ok', 'preview-bad');
        paintCellColor(cell, color);
        cell.classList.add('filled', 'placing');
      }
      if (pieces[placedIdx]) pieces[placedIdx].used = true;
      selectedIdx = -1;
      isDragging = false;
      dragPiece = null;
      try { markPieceUsed(placedIdx, getActivePiecesArea()); } catch (_) {}
      // Legendary place sparks for the local player (online path used to skip these)
      try {
        const isLegendPlace = document.body.classList.contains('skin-fx-prism');
        if (isLegendPlace && typeof spawnLegendSparks === 'function' && board) {
          const wrap = board.parentElement;
          const maxR = Math.max(...shape.map(s => s[0]));
          const maxC = Math.max(...shape.map(s => s[1]));
          const cell0 = board.children[result.baseR * SIZE + result.baseC];
          let origin = null;
          if (cell0 && wrap) {
            const cr = cell0.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            origin = {
              left: cr.left - wr.left + cr.width * (0.5 + maxC / 2),
              top: cr.top - wr.top + cr.height * (0.5 + maxR / 2)
            };
          }
          spawnLegendSparks(wrap, 6 + shape.length, document.body.dataset.skinId || equippedSkinId, origin);
        }
      } catch (_) {}
    } catch (_) {}

    try {
      roomSendPlace({
        shape: netShape,
        color,
        r: result.baseR,
        c: result.baseC,
        pieceIdx: placedIdx
        // NO score/grid/pieces — server is sole authority
      });
    } catch (e) {
      console.warn('roomSendPlace', e);
      try { rollbackPendingServerPlace(); } catch (_) {}
      placingLock = false;
      return false;
    }
    // Safety unlock if server never answers
    try {
      if (window._pendingPlaceTimer) clearTimeout(window._pendingPlaceTimer);
      window._pendingPlaceTimer = setTimeout(() => {
        if (window._pendingServerPlace) {
          try { MatchClient && MatchClient.sync && MatchClient.sync({}); } catch (_) {}
        }
        placingLock = false;
      }, 4000);
    } catch (_) {}
    return true;
  }

  placingLock = true;
  hapticTap(14);
  SFX.place();
  const color = dragPiece.color, shape = dragPiece.shape;
  const placedIdx = selectedIdx;
  const board = getActiveBoard(), g = getActiveGrid(), areaEl = getActivePiecesArea(), banner = getActiveBanner();
  for (const [dr,dc] of shape) g[result.baseR+dr][result.baseC+dc] = color;
  pieces[placedIdx].used = true; selectedIdx = -1;
  // Unlock immediately so the next piece can be grabbed without waiting for anim
  placingLock = false;
  // Visual: promote preview cells → filled + restart place anim so mobile sees full soft settle
  const placeCells = [];
  for (const [dr,dc] of shape) {
    const cell = board.children[(result.baseR+dr)*SIZE+(result.baseC+dc)];
    if (!cell) continue;
    // Drop preview classes without wiping paint (avoids A→D skip of placeSoft)
    cell.classList.remove('preview-ok', 'preview-bad');
    paintCellColor(cell, color);
    cell.classList.add('filled');
    cell.classList.remove('placing');
    // Clear any leftover inline anim kills from clear/render paths
    cell.style.removeProperty('animation');
    cell.style.removeProperty('transition');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('opacity');
    placeCells.push(cell);
  }
  // Detach from preview tracking so later clearPreview won't touch these cells
  try {
    if (_previewCells && _previewCells.length) {
      const set = new Set(placeCells);
      _previewCells = _previewCells.filter(c => !set.has(c));
    }
  } catch (_) {}
  // Double-rAF: let the browser commit filled state, then start placeSoft/legendPlace
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (let i = 0; i < placeCells.length; i++) {
        const cell = placeCells[i];
        if (!cell || !cell.classList.contains('filled')) continue;
        cell.classList.add('placing');
      }
    });
  });
  const isLegendPlace = document.body.classList.contains('skin-fx-prism');
  try {
    const _mr = Math.max(...shape.map(s => s[0]));
    const _mc = Math.max(...shape.map(s => s[1]));
    window._lastPlaceAnchor = {
      baseR: result.baseR,
      baseC: result.baseC,
      centerR: result.baseR + _mr / 2,
      centerC: result.baseC + _mc / 2
    };
    // Legendary place: soft spark burst at piece center (local)
    if (isLegendPlace && typeof spawnLegendSparks === 'function') {
      const wrap = board.parentElement;
      const cell0 = board.children[result.baseR * SIZE + result.baseC];
      let origin = null;
      if (cell0) {
        const cr = cell0.getBoundingClientRect();
        const wr = wrap.getBoundingClientRect();
        origin = {
          left: cr.left - wr.left + cr.width * (0.5 + _mc / 2),
          top: cr.top - wr.top + cr.height * (0.5 + _mr / 2)
        };
      }
      spawnLegendSparks(wrap, 6 + shape.length, document.body.dataset.skinId, origin);
    }
  } catch (_) {}
  const placePts = shape.length * 10;
  score += placePts;
  if (mode==='versus') {
    matchLog.push({
      type: 'place',
      side: 'me',
      t: Date.now() - matchStartTs,
      shape: (typeof normalize === 'function' ? normalize(shape.map(p => p.slice())) : shape.map(p => p.slice())),
      color,
      r: result.baseR,
      c: result.baseC,
      myScore: score,
      oppScore,
      pieceIdx: (typeof placedIdx === 'number' && placedIdx >= 0) ? placedIdx : -1,
      placePts,
      legendFx: !!isLegendPlace,
      skinId: isLegendPlace ? (document.body.dataset.skinId || equippedSkinId || null) : null
    });
    document.getElementById('myScore').textContent = score;
    try { if (typeof noteMyAction === 'function') noteMyAction(); } catch (_) {}
    try { persistLiveMatch(); } catch (_) {}
    // Online room path already sent intent above and returned.
    // Bots / offline still use local state only.
    if (false && mpMode) {
      let netShape = shape.map(p => p.slice());
      try {
        if (typeof normalize === 'function') netShape = normalize(netShape.map(p => p.slice()));
      } catch (_) {}
      
    }
    if (aiStuck && score > oppScore) { endVersus(); return true; }
  } else updateClassicUI();
  // Clear immediately when the piece is placed (classic + versus)
  const runPlaceClear = () => {
    if (!vsActive && mode==='versus') { placingLock = false; return; }
    // Keep .placing so placeSoft is visible even on rapid successive places;
    // clearLinesOn overrides anim only on cells that actually clear.
    const clearInfo = clearLinesOn(g, board);
    const cleared = clearInfo.count || 0;
    if (cleared > 0) {
      clearChain = (clearChain || 0) + 1;
      bumpAchStat('linesCleared', cleared);
      const baseBonus = bonusFor(cleared);
      const chainExtra = chainBonusFor(clearChain);
      const bonus = baseBonus + chainExtra;
      score += bonus;
      if (cleared >= 3 || clearChain >= 2) SFX.combo();
      else SFX.clear(cleared);
      const wrap = board.parentElement;
      const maxR = Math.max(...shape.map(s => s[0]));
      const maxC = Math.max(...shape.map(s => s[1]));
      const placeAnchor = {
        baseR: result.baseR,
        baseC: result.baseC,
        centerR: result.baseR + maxR / 2,
        centerC: result.baseC + maxC / 2
      };
      const positions = getClearFloatPositions(board, clearInfo.rows, clearInfo.cols, placeAnchor);
      showCombo(banner, cleared, bonus, wrap, 'me', {
        chain: clearChain,
        positions,
        baseBonus,
        chainExtra,
        placeAnchor
      });
      // Achievements (classic tracking)
      if (mode === 'classic') {
        const cmax = Math.max(cleared || 0, clearChain || 0);
        if (cmax >= 2) setAchStat('combo2', 1);
        if (cmax >= 3) setAchStat('combo3', 1);
        if (cmax >= 4) setAchStat('megaCombo', 1);
        if (cmax >= 5) setAchStat('combo5', 1);
        if (cmax >= 6) setAchStat('combo6', 1);
        if (cmax >= 7) setAchStat('combo7', 1);
        if (cmax >= 8) setAchStat('combo8', 1);
        if (cmax >= 10) setAchStat('combo10', 1);
      }
      // Diamonds for ×4+ clears: classic, bots, ranked online — NOT friend/lobby matches
      if (cleared >= 4 && canEarnClearDiamonds()) {
        diamonds += cleared >= 6 ? 2 : 1;
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
        if (mode === 'classic') updateClassicUI();
        else {
          try {
            const dEl = document.getElementById('diamonds');
            if (dEl) dEl.textContent = diamonds;
            updateMenuStats();
          } catch (_) {}
        }
      } else if (mode === 'classic') {
        updateClassicUI();
      }
      if (mode==='versus') {
        document.getElementById('myScore').textContent = score;
        if (matchLog.length) {
          const last = matchLog[matchLog.length - 1];
          if (last && last.type === 'place' && last.side === 'me') {
            last.myScore = score;
            last.oppScore = oppScore;
            last.cleared = cleared;
            last.bonus = bonus;
            last.baseBonus = baseBonus;
            last.chainExtra = chainExtra;
            last.chain = clearChain;
            last.rows = clearInfo.rows ? clearInfo.rows.slice() : [];
            last.cols = clearInfo.cols ? clearInfo.cols.slice() : [];
          }
        }
        if (mpMode) {
          
          
        }
        if (aiStuck && score > oppScore) { placingLock = false; endVersus(); return; }
      } else updateClassicUI();
    } else {
      clearChain = 0;
    }
    if (mode==='classic') updateClassicUI();
    placingLock = false;
    if (pieces.every(p=>p.used)) {
      setTimeout(() => {
        generatePieces(areaEl);
        if (mode==='classic') setTimeout(checkStuck, 100);
        if (mode==='versus') {
          setPlayerStuck(false);
          // Wait until new pieces painted + board settled
          setTimeout(checkVersusStuck, 400);
        }
      }, 200);
    } else {
      if (mode==='classic') setTimeout(checkStuck, 100);
      // After clearLinesOn (grid already updated) give a beat before stuck check
      if (mode==='versus') setTimeout(checkVersusStuck, 280);
    }
  };
  // Clear fires in the same turn as the place — only yield so the filled paint commits
  requestAnimationFrame(runPlaceClear);
  return true;
}
function legendSparkPalette(skinId) {
  const id = skinId || (document.body.dataset && document.body.dataset.skinId) || '';
  if (id === 'cyber') return ['#0aff99', '#00f5ff', '#7b2ff7', '#ff006e', '#4cc9f0', '#b8f2e6'];
  if (id === 'midnight') return ['#5ee7ff', '#7c5cff', '#c9ada7', '#e0e1dd', '#415a77', '#778da9'];
  if (id === 'gold') return ['#ffd700', '#fff3a0', '#ffb703', '#ffe566', '#f4a261', '#ffdb58'];
  return ['#ffd666', '#fff6c8', '#c77dff', '#5ee7ff', '#ff9ecd', '#ffe566'];
}

function applyParticleOrigin(el, origin) {
  if (!el) return;
  if (origin && origin.left != null && origin.top != null) {
    el.style.left = origin.left + 'px';
    el.style.top = origin.top + 'px';
    el.style.marginLeft = '0';
    el.style.marginTop = '0';
    el.style.transform = 'translate(-50%, -50%)';
  }
}
function spawnLegendSparks(boardWrap, count, skinId, origin) {
  if (!boardWrap || settings.anim === 'off') return;
  const n = Math.max(6, Math.min(18, count || 10));
  const palette = legendSparkPalette(skinId);
  boardWrap.style.position = boardWrap.style.position || 'relative';
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    const isRing = i % 5 === 0;
    sp.className = 'legend-spark' + (isRing ? ' ring' : '');
    applyParticleOrigin(sp, origin);
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.35;
    const dist = 40 + Math.random() * 85;
    sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
    const col = palette[i % palette.length];
    if (!isRing) sp.style.background = col;
    sp.style.color = col;
    sp.style.animationDelay = (Math.random() * 0.1) + 's';
    boardWrap.appendChild(sp);
    setTimeout(() => { try { sp.remove(); } catch (_) {} }, 1100);
  }
}

function spawnEpicSparks(boardWrap, count, origin) {
  if (!boardWrap || settings.anim === 'off') return;
  const n = Math.max(4, Math.min(12, count || 6));
  const palette = ['#c77dff', '#ffd666', '#5ee7ff', '#ff8fab', '#a78bfa'];
  boardWrap.style.position = boardWrap.style.position || 'relative';
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    sp.className = 'epic-spark';
    applyParticleOrigin(sp, origin);
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 28 + Math.random() * 48;
    sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
    sp.style.background = palette[i % palette.length];
    sp.style.color = palette[i % palette.length];
    boardWrap.appendChild(sp);
    setTimeout(() => { try { sp.remove(); } catch (_) {} }, 900);
  }
}

function spawnThemedParticles(boardWrap, skinId, rarity, nLines, origin) {
  if (!boardWrap || settings.anim === 'off') return;
  if (rarity === 'common' || !rarity) return; // common: no FX
  // Intensity by rarity: rare modest, epic medium, legend strong
  let base, mult, distMax, life;
  if (rarity === 'legendary') { base = 10; mult = 4; distMax = 100; life = 1500; }
  else if (rarity === 'epic') { base = 7; mult = 3; distMax = 78; life = 1300; }
  else { base = 4; mult = 2; distMax = 52; life = 1050; } // rare
  const n = Math.max(base, Math.min(base + 12, base + (nLines || 1) * mult));
  boardWrap.style.position = boardWrap.style.position || 'relative';
  const id = skinId || 'default';
  const clsMap = {
    gold: 'gold-shard',
    sakura: 'sakura-petal',
    cyber: 'cyber-bit',
    lava: 'lava-ember',
    toxic: 'toxic-drop',
    ice: 'ice-flake',
    aurora: 'aurora-wisp',
    neon: 'neon-spark',
    royal: 'royal-gem',
    midnight: 'midnight-star',
    candy: 'candy-spark',
    sunset: 'sunset-spark'
  };
  let pclass = clsMap[id];
  if (!pclass) {
    if (rarity === 'legendary') pclass = 'gold-shard';
    else if (rarity === 'epic') pclass = 'royal-gem';
    else if (rarity === 'rare') pclass = 'neon-spark';
    else return;
  }
  const neonCols = ['#39ff14','#ff00ff','#00f5ff','#ffe600','#ff3d81'];
  const sunsetCols = ['#ff6b35','#ffd166','#ef476f','#f4a261'];
  const candyCols = ['#ff8fab','#bde0fe','#ffc8dd','#a2d2ff','#cdb4db'];
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    sp.className = 'skin-particle ' + pclass;
    if (pclass === 'cyber-bit' && i % 2) sp.classList.add('alt');
    if (pclass === 'neon-spark') {
      const c = neonCols[i % neonCols.length];
      sp.style.background = c;
      sp.style.color = c;
      sp.style.boxShadow = '0 0 10px ' + c + ', 0 0 18px ' + c;
    }
    if (pclass === 'sunset-spark') {
      const c = sunsetCols[i % sunsetCols.length];
      sp.style.background = c;
      sp.style.boxShadow = '0 0 8px ' + c;
    }
    if (pclass === 'candy-spark') {
      const c = candyCols[i % candyCols.length];
      sp.style.background = c;
      sp.style.boxShadow = '0 0 8px ' + c;
    }
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.55;
    const dist = 24 + Math.random() * distMax;
    sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
    sp.style.setProperty('--rot', (120 + Math.random() * 280) + 'deg');
    sp.style.animationDelay = (Math.random() * 0.1) + 's';
    applyParticleOrigin(sp, origin);
    boardWrap.appendChild(sp);
    setTimeout(() => { try { sp.remove(); } catch (_) {} }, life);
  }
}

function resolveFloatAnchor(wrap, opts) {
  opts = opts || {};
  // 1) explicit pixel positions
  if (opts.positions && opts.positions.length) {
    const p = opts.positions.find(x => x && x.left != null && x.top != null);
    if (p) return { left: p.left, top: p.top };
  }
  // 2) placeAnchor → measure on board inside wrap
  const board = wrap && wrap.querySelector && wrap.querySelector('.board');
  const a = opts.placeAnchor || window._lastPlaceAnchor;
  if (board && a) {
    if (typeof a.centerR === 'number' && typeof a.centerC === 'number') {
      const p = cellToWrapPos(board, a.centerR, a.centerC);
      if (p) return p;
    }
    if (typeof a.baseR === 'number' && typeof a.baseC === 'number') {
      const p = cellToWrapPos(board, a.baseR, a.baseC);
      if (p) return p;
    }
  }
  return null;
}
function showCombo(banner, n, bonus, boardWrap, side, opts) {
  opts = opts || {};
  // Combo labels always run unless animations fully disabled
  if (settings.anim === 'off') return;
  const chain = opts.chain || 0;
  const isCombo = n >= 2 || chain >= 2;
  const wrap = boardWrap || (banner && banner.parentElement);
  if (!banner && wrap) banner = wrap.querySelector('.combo-banner');
  if (!banner && side === 'opp') banner = document.getElementById('comboBannerOpp');
  if (!banner && (side === 'me' || !side)) {
    banner = document.getElementById('comboBannerMe') || document.getElementById('comboBanner');
  }
  let sideKey = side;
  if (!sideKey && wrap) {
    if (wrap.closest && wrap.closest('.player-panel.opp')) sideKey = 'opp';
    else sideKey = 'me';
  }
  if (!sideKey) sideKey = 'me';
  let meta = { id: 'default', rarity: 'common' };
  try { meta = skinMetaForSide(sideKey) || meta; } catch (_) {}

  // Always resolve anchor near last placed piece
  let anchor = resolveFloatAnchor(wrap, opts);
  if (!anchor && opts.positions && opts.positions[0]) anchor = opts.positions[0];
  const positions = (anchor && anchor.left != null)
    ? [{ left: anchor.left, top: anchor.top, kind: 'place' }]
    : (opts.positions || []).filter(p => p && p.left != null);

  if (banner && (n >= 1 || chain >= 2 || bonus > 0)) {
    let label;
    if (chain >= 2 && n >= 2) label = `×${n} · COMBO ×${chain}`;
    else if (chain >= 2) label = `COMBO ×${chain}`;
    else if (n >= 2) label = `×${n}`;
    else label = `+${bonus || 0}`;
    banner.textContent = label;
    // Full class reset so animation always restarts
    banner.className = 'combo-banner';
    try {
      const sf = scoreFloatSkinClass(meta.id, meta.rarity);
      const cb = sf ? sf.replace(/^sf-/, 'cb-') : '';
      if (cb) banner.classList.add(cb);
    } catch (_) {}
    // Pin banner to piece location (not board center)
    if (anchor && anchor.left != null && anchor.top != null) {
      banner.style.left = anchor.left + 'px';
      banner.style.top = anchor.top + 'px';
    } else {
      banner.style.left = '50%';
      banner.style.top = '50%';
    }
    // Force reflow then show — CSS handles fade; auto-clear after anim
    void banner.offsetWidth;
    banner.classList.add('show');
    try {
      clearTimeout(banner._hideT);
      banner._hideT = setTimeout(() => {
        try {
          banner.classList.remove('show');
          banner.textContent = '';
          banner.style.left = '';
          banner.style.top = '';
          banner.style.opacity = '';
        } catch (__) {}
      }, 900);
    } catch (_) {}
  }
  if (wrap && settings.floats !== '0' && bonus) {
    spawnScoreFloat(wrap, bonus, isCombo, meta.rarity, meta.id, positions, chain);
  }
  try {
    if (!wrap || n < 1) return;
    const rar = meta.rarity || 'common';
    if (rar === 'common') return;
    const intensity = Math.max(n || 1, chain || 0);
    if (rar === 'legendary') {
      wrap.classList.remove('legend-combo-flash');
      void wrap.offsetWidth;
      if (anchor && anchor.left != null) {
        wrap.style.setProperty('--flash-x', anchor.left + 'px');
        wrap.style.setProperty('--flash-y', anchor.top + 'px');
      }
      wrap.classList.add('legend-combo-flash');
      setTimeout(() => { try { wrap.classList.remove('legend-combo-flash'); } catch (_) {} }, 650);
      spawnLegendSparks(wrap, 10 + intensity * 3, meta.id, anchor);
      spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
    } else if (rar === 'epic') {
      spawnEpicSparks(wrap, 4 + intensity * 2, anchor);
      spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
    } else if (rar === 'rare') {
      spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
    }
  } catch (_) {}
}

function scoreFloatSkinClass(skinId, rarity) {
  const id = skinId || '';
  if (rarity === 'rare') {
    if (id === 'neon') return 'sf-rare-neon';
    if (id === 'ice') return 'sf-rare-ice';
    if (id === 'sunset') return 'sf-rare-sunset';
    if (id === 'candy') return 'sf-rare-candy';
    return 'sf-rare';
  }
  if (rarity === 'epic') {
    if (id === 'lava') return 'sf-epic-lava';
    if (id === 'royal') return 'sf-epic-royal';
    if (id === 'aurora') return 'sf-epic-aurora';
    if (id === 'sakura') return 'sf-epic-sakura';
    if (id === 'toxic') return 'sf-epic-toxic';
    return 'sf-epic';
  }
  if (rarity === 'legendary') {
    if (id === 'cyber') return 'sf-legend-cyber';
    if (id === 'midnight') return 'sf-legend-midnight';
    if (id === 'gold') return 'sf-legend-gold';
    return 'sf-legend';
  }
  return ''; // common: no special float FX
}

function spawnScoreFloat(boardWrap, amount, isCombo, rarityHint, skinId, positions, chain) {
  if (!boardWrap || !amount || settings.floats === '0') return;
  boardWrap.style.position = boardWrap.style.position || 'relative';
  const rar = rarityHint || (document.body.dataset && document.body.dataset.skinRarity) || 'common';
  const skinCls = scoreFloatSkinClass(skinId, rar);
  const life = rar === 'legendary' ? 1400 : rar === 'epic' ? 1200 : rar === 'rare' ? 1250 : 1000;
  let pts = (positions && positions.length)
    ? positions.filter(p => p && p.left != null && p.top != null)
    : [];
  // Fallback: last placed piece on this board
  if (!pts.length) {
    const fb = resolveFloatAnchor(boardWrap, { placeAnchor: window._lastPlaceAnchor });
    if (fb) pts = [fb];
  }
  if (!pts.length) return;
  // One float at placement (or first clear point) with full bonus amount
  const showPts = pts.slice(0, 1);
  showPts.forEach((pt, i) => {
    const el = document.createElement('div');
    el.className = 'score-float'
      + (isCombo ? ' combo' : '')
      + (skinCls ? ' ' + skinCls : '')
      + (chain >= 2 ? ' chain' : '');
    el.textContent = `+${amount}`;
    el.style.left = pt.left + 'px';
    el.style.top = pt.top + 'px';
    el.style.animationDelay = (i * 0.05) + 's';
    boardWrap.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, life + i * 40);
  });
  // Chain tag near the same place as the score (not board center)
  if (chain >= 2) {
    const base = showPts[0];
    const ch = document.createElement('div');
    ch.className = 'score-float combo chain-tag' + (skinCls ? ' ' + skinCls : '');
    ch.textContent = `×${chain}`;
    ch.style.left = (base.left) + 'px';
    ch.style.top = Math.max(8, base.top - 22) + 'px';
    boardWrap.appendChild(ch);
    setTimeout(() => { try { ch.remove(); } catch (_) {} }, life + 80);
  }
}
function checkStuck() {
  if (mode!=='classic') return;
  const available = pieces.filter(p=>!p.used);
  if (!available.length) return;
  if (!available.some(p => findAllPlacements(grid, p.shape).length > 0)) {
    if (diamonds>=1) stuckOfferEl.classList.add('visible');
    else {
      document.getElementById('finalScore').textContent = score;
      const msg = document.getElementById('gameOverMsg');
      if (msg) msg.textContent = 'Места больше нет';
      clearClassicSave();
      gameOverEl.classList.add('visible');
    }
  }
}
function doRelief() {
  if (diamonds<1||mode!=='classic') return;
  diamonds--;
  try { bumpAchStat('reliefUsed', 1); } catch (_) {}
  try { if (mode === 'classic') window._classicUsedRelief = true; } catch (_) {} updateClassicUI(); stuckOfferEl.classList.remove('visible');
  let bestR=0,bestRF=0,bestC=0,bestCF=0;
  for (let r=0;r<SIZE;r++) { const f=grid[r].filter(x=>x).length; if(f>bestRF){bestRF=f;bestR=r;} }
  for (let c=0;c<SIZE;c++) { const f=grid.filter(row=>row[c]).length; if(f>bestCF){bestCF=f;bestC=c;} }
  const toClear = new Set();
  if (bestRF>=2) for(let c=0;c<SIZE;c++) if(grid[bestR][c]) toClear.add(bestR*SIZE+c);
  if (bestCF>=2) for(let r=0;r<SIZE;r++) if(grid[r][bestC]) toClear.add(r*SIZE+bestC);
  if (!toClear.size) {
    const filled=[]; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(grid[r][c]) filled.push(r*SIZE+c);
    filled.sort(()=>Math.random()-0.5).slice(0,8).forEach(i=>toClear.add(i));
  }
  const reliefMeta = getClearAnimMeta(boardEl);
  toClear.forEach(idx => {
    const cell = boardEl.children[idx];
    if (!cell) return;
    CLEARING_CLASSES.forEach(c => cell.classList.remove(c));
    cell.classList.add(reliefMeta.cls);
  });
  setTimeout(() => {
    let sumR = 0, sumC = 0, nC = 0;
    toClear.forEach(idx => {
      const r=Math.floor(idx/SIZE),c=idx%SIZE;
      grid[r][c]=null;
      sumR += r; sumC += c; nC++;
    });
    score += toClear.size*15+30; updateClassicUI(); renderGrid(grid, boardEl);
    pieces.forEach(p=>p.used=true); generatePieces(piecesArea);
    const placeAnchor = nC ? { centerR: sumR / nC, centerC: sumC / nC } : null;
    const positions = getClearFloatPositions(boardEl, [], [], placeAnchor);
    showCombo(comboBanner, 0, toClear.size*15+30, boardEl.parentElement, 'me', { positions, placeAnchor });
    setTimeout(checkStuck, 150);
  }, reliefMeta.ms);
}

function startVersusFlow() { showScreen('compType'); }

