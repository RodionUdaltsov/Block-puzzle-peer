/**
 * Block Puzzle — js/08-gameplay/03-clear-fx.js
 * Line-clear animation and particle FX.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** Clear anim from equipped FIELD only (not piece skin). Duration FIXED for fair play. */
/** Desktop 110ms; mobile ~300ms — readable scale-fade without blocking play */
function getClearAnimMs() {
  try {
    // Mobile: longer readable clear (simple scale-fade needs time to be visible).
    // Keep under ~350ms so it does not block the next place.
    if (document.body && document.body.classList.contains('touch-ui')) return 300;
  } catch (_) {}
  return 110;
}
const CLEAR_ANIM_MS = 110; // desktop default; always prefer getClearAnimMs() at runtime
/** Board element → timestamp until which softRender must not wipe clearing cells */
const _clearBusyUntil = new WeakMap();
function markClearBusy(boardDOM, ms) {
  try {
    if (!boardDOM) return;
    const until = Date.now() + (ms | 0) + 30;
    _clearBusyUntil.set(boardDOM, until);
  } catch (_) {}
}
function isClearBusy(boardDOM) {
  try {
    if (!boardDOM) return false;
    const until = _clearBusyUntil.get(boardDOM);
    return !!(until && Date.now() < until);
  } catch (_) { return false; }
}
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
  if (fx === 'nebula') return { cls: 'clearing-nebula', name: 'clearNebula', beam: 'nebula', ms: getClearAnimMs() };
  if (fx === 'solar') return { cls: 'clearing-solar', name: 'clearSolar', beam: 'solar', ms: getClearAnimMs() };
  if (fx === 'quantum') return { cls: 'clearing-quantum', name: 'clearQuantum', beam: 'quantum', ms: getClearAnimMs() };
  if (fx === 'abyss') return { cls: 'clearing-abyss', name: 'clearAbyss', beam: 'abyss', ms: getClearAnimMs() };
  if (fx === 'prismfield') return { cls: 'clearing-prism', name: 'clearPrism', beam: 'prism', ms: getClearAnimMs() };
  if (fx === 'magma') return { cls: 'clearing-magma', name: 'clearMagma', beam: 'magma', ms: getClearAnimMs() };
  // Epic pulse fields: crystal vs neon_grid by board id
  if (fx === 'pulse') {
    if (boardId === 'field_neon_grid') return { cls: 'clearing-neon', name: 'clearNeon', beam: 'neon', ms: getClearAnimMs() };
    return { cls: 'clearing-epic', name: 'clearEpic', beam: 'epic', ms: getClearAnimMs() };
  }
  // Rare soft fields: unique per board
  if (fx === 'soft') {
    if (boardId === 'field_violet') return { cls: 'clearing-rare-violet', name: 'clearRareViolet', beam: 'rare-violet', ms: getClearAnimMs() };
    if (boardId === 'field_jade') return { cls: 'clearing-rare-jade', name: 'clearRareJade', beam: 'rare-jade', ms: getClearAnimMs() };
    return { cls: 'clearing-rare-azure', name: 'clearRareAzure', beam: 'rare-azure', ms: getClearAnimMs() };
  }
  return { cls: 'clearing-common', name: 'clearCommon', beam: null, ms: getClearAnimMs() };
}
const CLEARING_CLASSES = [
  'clearing', 'clearing-common', 'clearing-mobile-soft',
  'clearing-rare', 'clearing-rare-azure', 'clearing-rare-violet', 'clearing-rare-jade',
  'clearing-epic', 'clearing-neon', 'clearing-magma',
  'clearing-nebula', 'clearing-solar', 'clearing-quantum', 'clearing-abyss', 'clearing-prism'
];
/** Particle budget from the graphics preset (13-performance.js). Returns how many of `n` may spawn now. */
function _fxLive() {
  try { return document.querySelectorAll('.skin-particle, .legend-spark, .epic-spark, .clear-debris').length; }
  catch (_) { return 0; }
}
function _fxCount(n, min) {
  let k = 1, cap = 90;
  try {
    if (window.BPGfx) { k = BPGfx.fxScale(); cap = BPGfx.maxLiveParticles(); }
  } catch (_) {}
  if (k <= 0 || cap <= 0) return 0;
  const want = Math.max(min || 1, Math.round(n * k));
  return Math.max(0, Math.min(want, cap - _fxLive()));
}
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
      try { el.dataset.born = String(Date.now()); } catch (_) {}
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
      setTimeout(() => { try { el.remove(); } catch (_) {} }, getClearAnimMs() + 40);
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
  // Budget from graphics preset: how many debris elements may still be created right now.
  let _debrisLeft = _fxCount(90, 1);
  if (_debrisLeft <= 0) return;
  try {
    const boardRect = boardDOM.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cellW = boardRect.width / SIZE;
    const cellH = boardRect.height / SIZE;
    const rand = (a, b) => a + Math.random() * (b - a);
    const add = (cls, x, y, dx, dy, rot, extraStyle) => {
      if (_debrisLeft <= 0) return;
      _debrisLeft--;
      const el = document.createElement('div');
      el.className = 'clear-debris ' + cls;
      try { el.dataset.born = String(Date.now()); } catch (_) {}
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--dy', dy.toFixed(1) + 'px');
      el.style.setProperty('--rot', (rot || 0) + 'deg');
      if (extraStyle) Object.assign(el.style, extraStyle);
      wrap.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 500);
    };
    // Cap debris on big multi-line clears for performance
    let _stride = cellIndices.length > 16 ? 2 : 1;
    try { if (window.BPGfx && BPGfx.fxScale() < 1) _stride = Math.max(_stride, Math.round(1 / Math.max(0.25, BPGfx.fxScale()))); } catch (_) {}
    const indices = _stride > 1
      ? cellIndices.filter((_, i) => i % _stride === 0)
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

/** Progressive-lag guard: purge orphan FX / will-change every few seconds during play */
let _fxScrubTimer = 0;
function startFxMaintenance() {
  try { if (_fxScrubTimer) clearInterval(_fxScrubTimer); } catch (_) {}
  _fxScrubTimer = setInterval(() => {
    try {
      if (typeof scrubTransientFx === 'function') {
        // Soft scrub: only orphan particles / beams, never mid-clear cells
        document.querySelectorAll(
          '.clear-debris, .legend-spark, .epic-spark, .skin-particle, .neon-spark, .candy-spark, .sunset-spark, .rare-spark, .clear-beam'
        ).forEach(el => {
          try {
            // Keep if still young (< 600ms)
            const born = el.dataset && el.dataset.born;
            if (born && (Date.now() - (+born)) < 600) return;
            el.remove();
          } catch (_) {}
        });
      }
      // Drop will-change only where it was set (cheap)
      document.querySelectorAll('.cell[style*="will-change"]').forEach(cell => {
        try {
          if (cell.classList.contains('placing')) return;
          if (cell.className.indexOf('clearing') !== -1) return;
          cell.style.removeProperty('will-change');
        } catch (_) {}
      });
      // Trim matchLog so long sessions don't grow forever
      if (typeof matchLog !== 'undefined' && Array.isArray(matchLog) && matchLog.length > 400) {
        matchLog = matchLog.slice(-200);
      }
    } catch (_) {}
  }, 8000);
}
function stopFxMaintenance() {
  try { if (_fxScrubTimer) clearInterval(_fxScrubTimer); } catch (_) {}
  _fxScrubTimer = 0;
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
  const touchUi = (function(){ try { return !!(document.body && document.body.classList.contains('touch-ui')); } catch(_){ return false; } })();
  // Mobile: ONLY clearing-mobile-soft (no themed class — they fight animation-name !important)
  const animName = touchUi ? 'clearMobileSoft' : meta.name;
  const animCss = `${animName} ${meta.ms}ms cubic-bezier(0.2,0.7,0.2,1) forwards`;
  if (boardDOM) {
    // Only strip particle debris — do NOT call full scrubTransientFx (it used to wipe #ghost)
    try {
      document.querySelectorAll(
        '.clear-debris, .clear-beam, .legend-spark, .epic-spark, .score-float'
      ).forEach(function (el) {
        try {
          // Keep floats on the OTHER board; only remove orphans not under a board-wrap
          el.remove();
        } catch (_) {}
      });
    } catch (_) {}
    markClearBusy(boardDOM, meta.ms);
    const cells = [];
    toAnim.forEach(idx => {
      const cell = boardDOM.children[idx];
      if (!cell) return;
      cells.push(cell);
      CLEARING_CLASSES.forEach(c => cell.classList.remove(c));
      cell.style.removeProperty('animation');
      cell.style.setProperty('animation', 'none', 'important');
    });
    const startAnim = () => {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        cell.classList.add('clearing');
        cell.classList.add(touchUi ? 'clearing-mobile-soft' : meta.cls);
        // Restart: none → reflow → name (Safari needs this per wave, not per cell thrash)
        cell.style.setProperty('animation', animCss, 'important');
        cell.style.setProperty('transition', 'none', 'important');
        cell.style.setProperty('overflow', 'hidden', 'important');
      }
    };
    // Double rAF so mobile WebKit always plays from 0% (was intermittent before)
    requestAnimationFrame(() => {
      try { if (cells[0]) void cells[0].offsetWidth; } catch (_) {}
      requestAnimationFrame(startAnim);
    });
    if (meta.beam && !touchUi) {
      spawnClearBeams(boardDOM, rows, cols, meta.beam);
      spawnClearDebris(boardDOM, [...toAnim], meta.beam);
    } else if (meta.beam && touchUi) {
      try { spawnClearBeams(boardDOM, rows, cols, meta.beam); } catch (_) {}
    }
  }
  rows.forEach(r => { for(let c=0;c<SIZE;c++) g[r][c]=null; });
  cols.forEach(c => { for(let r=0;r<SIZE;r++) g[r][c]=null; });
  const clearBoard = boardDOM;
  const clearGridRef = g;
  const clearMs = meta.ms;
  setTimeout(() => {
    try { if (clearBoard) renderGrid(clearGridRef, clearBoard); } catch (_) {}
  }, clearMs);
  setTimeout(() => {
    try { if (clearBoard) renderGrid(clearGridRef, clearBoard); } catch (_) {}
    try { if (typeof scrubTransientFx === 'function') scrubTransientFx(); } catch (_) {}
  }, clearMs + 80);
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

/** Drop temporary DOM FX + drop will-change so mobile GC can reclaim layers. */
function scrubTransientFx() {
  // Player independence: never touch local held piece / pending place when opponent FX clears
  let holding = false;
  try {
    holding = !!(typeof isDragging !== 'undefined' && isDragging)
      || !!(typeof activeDragSlot !== 'undefined' && activeDragSlot)
      || !!(document.body && document.body.classList.contains('is-dragging'));
  } catch (_) { holding = false; }

  try {
    document.querySelectorAll(
      '.clear-debris, .legend-spark, .epic-spark, .skin-particle, .neon-spark, .candy-spark, .sunset-spark, .rare-spark, .score-float, .clear-beam'
    ).forEach(el => { try { el.remove(); } catch (_) {} });
  } catch (_) {}
  try {
    document.querySelectorAll('.cell.placing, .cell[class*="clearing-"]').forEach(cell => {
      try {
        // Do not strip styles from the board the player is currently aiming at mid-drag
        if (holding) {
          try {
            const board = cell.closest && cell.closest('.board');
            if (board && (board.id === 'boardMe' || board.id === 'board')) return;
          } catch (_) {}
        }
        cell.classList.remove('placing');
        cell.style.removeProperty('will-change');
        cell.style.removeProperty('animation');
        cell.style.removeProperty('filter');
        cell.style.removeProperty('clip-path');
        cell.style.removeProperty('transform');
        cell.style.removeProperty('opacity');
      } catch (_) {}
    });
  } catch (_) {}
  try {
    // LOCAL drag ghost (#ghost) — never wipe while holding (opp clear must not hide it)
    if (!holding) {
      const g = document.getElementById('ghost');
      if (g) {
        g.style.display = 'none';
        g.classList.remove('visible', 'cell-glide', 'no-glide');
        g.innerHTML = '';
        try { delete g.dataset.holdSig; } catch (_) {}
      }
    } else {
      // Re-assert held ghost stays visible after any concurrent DOM thrash
      try {
        const g = document.getElementById('ghost');
        if (g) {
          g.style.display = 'block';
          g.style.visibility = 'visible';
          g.style.opacity = '1';
          g.style.transition = 'none';
          g.classList.add('visible');
        }
      } catch (_) {}
    }
    // aiGhost is opponent/bot fly only — safe to clear when not mid opp anim
    // (applyOppRemotePlace owns aiGhost during its timeout; do not wipe if visible opacity)
    const ag = document.getElementById('aiGhost');
    if (ag) {
      const oppBusy = (typeof _oppPlaceAnimBusy !== 'undefined' && _oppPlaceAnimBusy);
      if (!oppBusy) {
        ag.style.display = 'none';
        ag.innerHTML = '';
        ag.style.opacity = '';
      }
    }
  } catch (_) {}
  // Placement preview / pending place belong to LOCAL player only
  if (!holding) {
    try { _previewCells = []; } catch (_) {}
    try { lastPreview = null; } catch (_) {}
    try {
      if (typeof BPState !== 'undefined' && BPState && !BPState.pendingServerPlace) {
        // leave pendingServerPlace alone always — server ack owns it
      }
    } catch (_) {}
  }
  // NEVER clear pendingServerPlace here — that is local optimistic place state
  // (previously wiped on every opp clear → desync)
}
