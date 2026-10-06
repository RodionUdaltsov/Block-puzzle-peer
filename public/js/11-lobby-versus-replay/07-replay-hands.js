/**
 * Block Puzzle — js/11-lobby-versus-replay/07-replay-hands.js
 * Replay tray rendering and hand reconstruction.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function replayTrayCellPx(small) {
  try {
    const cs = getComputedStyle(document.documentElement);
    const v = cs.getPropertyValue(small ? '--opp-piece' : '--versus-piece').trim();
    const n = parseFloat(v);
    if (n > 4) return n;
  } catch (_) {}
  // Fallback from board width
  try {
    const b = small ? boardOpp : boardMe;
    if (b) {
      const w = b.getBoundingClientRect().width;
      if (w > 40) return Math.max(7, Math.round(w / SIZE * (small ? 0.32 : 0.42)));
    }
  } catch (_) {}
  return small ? 10 : 12;
}

function cloneShapeCells(sh) {
  const out = [];
  if (!Array.isArray(sh)) return [[0, 0]];
  for (let i = 0; i < sh.length; i++) {
    const c = sh[i];
    if (Array.isArray(c) && c.length >= 2) {
      out.push([+c[0] || 0, +c[1] || 0]);
    } else if (c && typeof c === 'object') {
      // Rare: {r,c} / {0,1} from bad serialization
      const r = c.r != null ? c.r : (c[0] != null ? c[0] : 0);
      const col = c.c != null ? c.c : (c[1] != null ? c[1] : 0);
      out.push([+r || 0, +col || 0]);
    }
  }
  if (!out.length) return [[0, 0]];
  try {
    if (typeof normalize === 'function') return normalize(out);
  } catch (_) {}
  return out;
}

function renderReplayTray(areaEl, pieceArr, small, animateIn) {
  if (!areaEl) return;
  try {
    areaEl.style.opacity = '1';
    areaEl.style.visibility = 'visible';
    areaEl.style.pointerEvents = 'none';
    areaEl.style.display = 'flex';
  } catch (_) {}
  areaEl.innerHTML = '';
  const list = Array.isArray(pieceArr) ? pieceArr : [];
  let cellPx = 12;
  try {
    const v = replayTrayCellPx(!!small);
    if (v > 4) cellPx = v;
  } catch (_) {}
  if (!(cellPx > 4)) cellPx = small ? 10 : 12;
  cellPx = Math.max(small ? 8 : 10, cellPx);
  const gapPx = Math.max(1, Math.round(cellPx * 0.12));
  const slotPx = Math.max(small ? 36 : 44, Math.min(small ? 56 : 78, cellPx * 5 + 8));
  list.forEach((p, idx) => {
    const used = !!(p && p.used);
    const slot = document.createElement('div');
    slot.className = 'piece-slot' + (used ? ' used' : '');
    slot.dataset.replayIdx = String(idx);
    if (small) slot.dataset.oppIdx = String(idx);
    else slot.dataset.idx = String(idx);
    if (!used) {
      slot.style.width = slotPx + 'px';
      slot.style.height = slotPx + 'px';
      slot.style.minWidth = slotPx + 'px';
      slot.style.opacity = '1';
      slot.style.transform = 'none';
      const shape = cloneShapeCells(p && p.shape);
      const maxR = Math.max(0, ...shape.map(s => +s[0] || 0));
      const maxC = Math.max(0, ...shape.map(s => +s[1] || 0));
      const gridEl = document.createElement('div');
      gridEl.className = 'piece-grid';
      gridEl.style.gridTemplateColumns = 'repeat(' + (maxC + 1) + ', ' + cellPx + 'px)';
      gridEl.style.gridTemplateRows = 'repeat(' + (maxR + 1) + ', ' + cellPx + 'px)';
      gridEl.style.gap = gapPx + 'px';
      const occ = new Set(shape.map(([r, c]) => (+r || 0) + ',' + (+c || 0)));
      const col = (p && p.color) ? String(p.color) : '#7c5cff';
      for (let r = 0; r <= maxR; r++) {
        for (let c = 0; c <= maxC; c++) {
          const cell = document.createElement('div');
          // Size every cell so CSS grid never collapses (empty spacers included)
          cell.style.width = cellPx + 'px';
          cell.style.height = cellPx + 'px';
          cell.style.minWidth = cellPx + 'px';
          cell.style.minHeight = cellPx + 'px';
          if (occ.has(r + ',' + c)) {
            cell.className = 'piece-cell';
            try {
              paintCellColor(cell, col);
            } catch (_) {
              cell.style.background = col;
              cell.style.backgroundColor = col;
              cell.style.setProperty('--cell-base', col);
              cell.style.setProperty('--cell-glow', col);
            }
          }
          gridEl.appendChild(cell);
        }
      }
      slot.appendChild(gridEl);
      slot.classList.add('show');
      if (animateIn) {
        slot.style.opacity = '0';
        slot.style.transform = 'scale(0.6) translateY(8px)';
        const delay = 30 + idx * 45;
        setTimeout(() => {
          try {
            slot.style.transition = 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.22,1.1,0.36,1)';
            slot.style.opacity = '1';
            slot.style.visibility = 'visible';
            slot.style.transform = 'scale(1) translateY(0)';
          } catch (_) {}
        }, delay);
        // Safety: never leave refill hand invisible if timeouts were cleared mid-seek
        setTimeout(() => {
          try {
            if (slot && !slot.classList.contains('used')) {
              slot.style.opacity = '1';
              slot.style.visibility = 'visible';
              slot.style.transform = 'none';
            }
          } catch (_) {}
        }, delay + 400);
      } else {
        slot.style.opacity = '1';
        slot.style.visibility = 'visible';
        slot.style.transform = 'none';
      }
    }
    areaEl.appendChild(slot);
  });
}

function applyReplayDeal(ev, animateIn) {
  if (!ev || !Array.isArray(ev.pieces)) return;
  // Exact hand from the match log — never invent/pad fake shapes
  const arr = ev.pieces.map(p => ({
    shape: cloneShapeCells(p && p.shape),
    color: (p && p.color) ? String(p.color) : '#7c5cff',
    used: false
  }));
  // Soft appear only for true opening deals; refills always paint solid (avoids invisible 2nd hand)
  const softIn = !!animateIn;
  if (ev.side === 'opp') {
    replayOppPieces = arr;
    const el = document.getElementById('piecesAreaOpp');
    renderReplayTray(el, replayOppPieces, true, softIn);
    try {
      if (el) {
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.querySelectorAll('.piece-slot:not(.used)').forEach(s => {
          s.style.opacity = '1';
          s.style.visibility = 'visible';
          s.style.transform = 'none';
        });
      }
    } catch (_) {}
  } else {
    replayMePieces = arr;
    const el = document.getElementById('piecesAreaVs');
    renderReplayTray(el, replayMePieces, false, softIn);
    try {
      if (el) {
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.querySelectorAll('.piece-slot:not(.used)').forEach(s => {
          s.style.opacity = '1';
          s.style.visibility = 'visible';
          s.style.transform = 'none';
        });
      }
    } catch (_) {}
  }
}

function findReplaySlot(side, shape, color, pieceIdx) {
  const arr = side === 'me' ? replayMePieces : replayOppPieces;
  const area = document.getElementById(side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
  if (!area || !arr) return { slot: null, idx: -1 };
  let shapeNorm = shape;
  try {
    if (Array.isArray(shape) && typeof normalize === 'function') {
      shapeNorm = normalize(shape.map(c => Array.isArray(c) ? c.slice() : c));
    }
  } catch (_) {}
  const sk = (typeof shapeKey === 'function') ? shapeKey(shapeNorm) : '';
  const ck = (typeof colorKey === 'function') ? colorKey(color) : String(color || '').toLowerCase();
  let shapeOnly = -1;
  let anyUnused = -1;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (!p || p.used || !p.shape) continue;
    if (anyUnused < 0) anyUnused = i;
    let psk = '';
    try {
      const ps = (typeof normalize === 'function')
        ? normalize((p.shape || []).map(c => Array.isArray(c) ? c.slice() : c))
        : p.shape;
      psk = (typeof shapeKey === 'function') ? shapeKey(ps) : '';
    } catch (_) {
      psk = (typeof shapeKey === 'function') ? shapeKey(p.shape) : '';
    }
    if (!sk || psk !== sk) continue;
    const pck = (typeof colorKey === 'function') ? colorKey(p.color) : String(p.color || '').toLowerCase();
    if (ck && pck === ck) {
      return { slot: area.querySelector('.piece-slot[data-replay-idx="' + i + '"]'), idx: i };
    }
    if (shapeOnly < 0) shapeOnly = i;
  }
  if (shapeOnly >= 0) {
    return { slot: area.querySelector('.piece-slot[data-replay-idx="' + shapeOnly + '"]'), idx: shapeOnly };
  }
  // pieceIdx only after shape — avoids collapsing the wrong silhouette
  if (typeof pieceIdx === 'number' && pieceIdx >= 0 && pieceIdx < arr.length &&
      arr[pieceIdx] && !arr[pieceIdx].used) {
    try {
      if (shapeNorm && shapeNorm.length) {
        arr[pieceIdx].shape = (typeof cloneShapeCells === 'function')
          ? cloneShapeCells(shapeNorm) : shapeNorm.map(c => [+c[0]||0, +c[1]||0]);
      }
      if (color) arr[pieceIdx].color = String(color);
      if (typeof renderReplayTray === 'function') {
        renderReplayTray(area, arr, side === 'opp', false);
      }
    } catch (_) {}
    return {
      slot: area.querySelector('.piece-slot[data-replay-idx="' + pieceIdx + '"]'),
      idx: pieceIdx
    };
  }
  // Last resort: first unused slot so tray still collapses
  if (anyUnused >= 0) {
    try {
      if (shapeNorm && shapeNorm.length && arr[anyUnused]) {
        arr[anyUnused].shape = (typeof cloneShapeCells === 'function')
          ? cloneShapeCells(shapeNorm) : shapeNorm.map(c => [+c[0]||0, +c[1]||0]);
        if (color) arr[anyUnused].color = String(color);
        if (typeof renderReplayTray === 'function') {
          renderReplayTray(area, arr, side === 'opp', false);
        }
      }
    } catch (_) {}
    return { slot: area.querySelector('.piece-slot[data-replay-idx="' + anyUnused + '"]'), idx: anyUnused };
  }
  return { slot: null, idx: -1 };
}

function markReplayPieceUsed(side, idx) {
  const arr = side === 'me' ? replayMePieces : replayOppPieces;
  const area = document.getElementById(side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
  if (idx >= 0 && arr[idx]) arr[idx].used = true;
  else {
    const u = arr.find(p => !p.used);
    if (u) u.used = true;
  }
  // Soft collapse existing DOM node — no full re-render (avoids flicker)
  if (area && idx >= 0) {
    const slot = area.querySelector(`.piece-slot[data-replay-idx="${idx}"]`);
    if (slot) {
      slot.classList.remove('lifting', 'show');
      slot.classList.add('used');
      try {
        slot.style.width = '0';
        slot.style.minWidth = '0';
        slot.style.maxWidth = '0';
        slot.style.height = '0';
        slot.style.opacity = '0';
        slot.style.margin = '0';
        slot.style.padding = '0';
        slot.style.border = 'none';
        slot.style.background = 'transparent';
        slot.style.boxShadow = 'none';
        slot.innerHTML = '';
      } catch (_) {}
    }
  }
}

function isReplayDealEv(ev) {
  if (!ev) return false;
  const t = ev.type;
  return t === 'deal' || t === 'Deal';
}

function leadingDealCount(moves) {
  let n = 0;
  while (n < moves.length && isReplayDealEv(moves[n])) n++;
  return n;
}

/** Index of the first deal event for a side (me|opp), or -1 */
function firstDealIndex(moves, side) {
  if (!moves || !moves.length) return -1;
  const wantOpp = side === 'opp';
  for (let i = 0; i < moves.length; i++) {
    const ev = moves[i];
    if (!isReplayDealEv(ev)) continue;
    const isOpp = ev.side === 'opp';
    if (isOpp === wantOpp) return i;
  }
  return -1;
}

/**
 * Hands at the true start of the match: first deal for each side.
 * Opp's first deal may appear AFTER the player's first place when the player moved first —
 * still use that deal as the opening tray (not only consecutive leading deals).
 */

/**
 * Rebuild tray arrays from the move log so shapes always match what is placed.
 * Deals define hand slots; each place overwrites that slot's shape/color from the place event.
 * Fixes opp-moved-first races where the logged deal is the wrong/refill hand.
 */
function rebuildReplayTraysFromMoves(moves, endIdx) {
  const end = Math.max(0, Math.min(endIdx == null ? (moves ? moves.length : 0) : endIdx, moves ? moves.length : 0));
  let me = [];
  let opp = [];
  const cloneSh = (sh) => {
    try {
      if (typeof cloneShapeCells === 'function') return cloneShapeCells(sh);
    } catch (_) {}
    if (!Array.isArray(sh)) return [[0, 0]];
    return sh.map(c => Array.isArray(c) ? [+c[0] || 0, +c[1] || 0] : [0, 0]);
  };
  const freshDeal = (ev) => {
    if (!ev || !Array.isArray(ev.pieces)) return [];
    return ev.pieces.map(p => ({
      shape: cloneSh(p && p.shape),
      color: (p && p.color) ? String(p.color) : '#7c5cff',
      used: false
    }));
  };
  const emptyHand = () => ([
    { shape: [[0, 0]], color: '#7c5cff', used: false },
    { shape: [[0, 0]], color: '#7c5cff', used: false },
    { shape: [[0, 0]], color: '#7c5cff', used: false }
  ]);
  const markPlace = (arr, m) => {
    // Implicit refill when the logged deal is late/missing
    if (!arr.length || arr.every(p => p && p.used)) arr = emptyHand();
    const placeShape = cloneSh(m.shape);
    const sk = (typeof shapeKey === 'function') ? shapeKey(placeShape) : '';
    const ck = (typeof colorKey === 'function') ? colorKey(m.color) : '';
    let idx = -1;
    // 1) shape (+color) among unused — tray must match what lands on the board
    for (let j = 0; j < arr.length; j++) {
      if (!arr[j] || arr[j].used) continue;
      let psk = '';
      try { psk = shapeKey(arr[j].shape); } catch (_) {}
      if (sk && psk === sk) {
        if (!ck || colorKey(arr[j].color) === ck) { idx = j; break; }
        if (idx < 0) idx = j;
      }
    }
    // 2) pieceIdx only if that slot is still free
    if (idx < 0 && typeof m.pieceIdx === 'number' && m.pieceIdx >= 0 &&
        m.pieceIdx < arr.length && arr[m.pieceIdx] && !arr[m.pieceIdx].used) {
      idx = m.pieceIdx;
    }
    // 3) first unused
    if (idx < 0) {
      for (let j = 0; j < arr.length; j++) {
        if (arr[j] && !arr[j].used) { idx = j; break; }
      }
    }
    if (idx < 0) {
      arr = emptyHand();
      idx = 0;
    }
    arr[idx].shape = placeShape;
    if (m.color) arr[idx].color = String(m.color);
    arr[idx].used = true;
    return arr;
  };
  for (let i = 0; i < end; i++) {
    const m = moves[i];
    if (!m) continue;
    if (m.type === 'deal' || m.type === 'Deal') {
      if (m.side === 'opp') opp = freshDeal(m);
      else me = freshDeal(m);
      continue;
    }
    if (!(m.type === 'place' || m.shape)) continue;
    if (m.side === 'opp') opp = markPlace(opp, m);
    else me = markPlace(me, m);
  }
  // If a side still has no hand, synthesize from its places in the full log (opening race)
  const synthFromPlaces = (side) => {
    const hand = emptyHand();
    let n = 0;
    for (let i = 0; i < moves.length && n < 3; i++) {
      const m = moves[i];
      if (!m || !(m.type === 'place' || m.shape)) continue;
      if ((m.side === 'opp') !== (side === 'opp')) continue;
      const idx = (typeof m.pieceIdx === 'number' && m.pieceIdx >= 0 && m.pieceIdx < 3)
        ? m.pieceIdx : n;
      hand[idx].shape = cloneSh(m.shape);
      if (m.color) hand[idx].color = String(m.color);
      hand[idx].used = false;
      n++;
    }
    return hand;
  };
  if (!me.length) me = synthFromPlaces('me');
  if (!opp.length) opp = synthFromPlaces('opp');
  // Align unused opening slots with the next places of that side (deal may be wrong hand)
  const alignUnused = (arr, side) => {
    if (!arr || !arr.length) return arr;
    const unusedIdx = [];
    for (let j = 0; j < arr.length; j++) if (arr[j] && !arr[j].used) unusedIdx.push(j);
    if (!unusedIdx.length) return arr;
    const upcoming = [];
    for (let i = end; i < moves.length && upcoming.length < unusedIdx.length; i++) {
      const m = moves[i];
      if (!m) continue;
      if ((m.type === 'deal' || m.type === 'Deal') && ((m.side === 'opp') === (side === 'opp'))) {
        // next hand starts — do not pull shapes from a later deal's places
        if (upcoming.length) break;
        continue;
      }
      if (!(m.type === 'place' || m.shape)) continue;
      if ((m.side === 'opp') !== (side === 'opp')) continue;
      upcoming.push(m);
    }
    // Also collect places already consumed to fix used slots that were mismatch-marked
    // Prefer mapping upcoming free slots by pieceIdx then order
    for (let k = 0; k < upcoming.length && k < unusedIdx.length; k++) {
      const m = upcoming[k];
      let slot = unusedIdx[k];
      if (typeof m.pieceIdx === 'number' && m.pieceIdx >= 0 && m.pieceIdx < arr.length &&
          arr[m.pieceIdx] && !arr[m.pieceIdx].used) {
        slot = m.pieceIdx;
      }
      arr[slot].shape = cloneSh(m.shape);
      if (m.color) arr[slot].color = String(m.color);
    }
    return arr;
  };
  me = alignUnused(me, 'me');
  opp = alignUnused(opp, 'opp');
  replayMePieces = me;
  replayOppPieces = opp;
}

function applyOpeningReplayHands(moves, animateIn) {
  const mi = firstDealIndex(moves, 'me');
  const oi = firstDealIndex(moves, 'opp');
  if (mi >= 0) applyReplayDeal(moves[mi], !!animateIn);
  else replayMePieces = [];
  if (oi >= 0) applyReplayDeal(moves[oi], !!animateIn);
  else replayOppPieces = [];
}

/** Deal active just before index: last deal < beforeIdx, else first deal in log (late-logged opening hand) */
function dealIndexForSideBefore(moves, side, beforeIdx) {
  if (!moves || !moves.length) return -1;
  const wantOpp = side === 'opp';
  let last = -1;
  const limit = Math.max(0, beforeIdx | 0);
  for (let i = 0; i < moves.length; i++) {
    const ev = moves[i];
    if (!isReplayDealEv(ev)) continue;
    if ((ev.side === 'opp') !== wantOpp) continue;
    if (i < limit) last = i;
    else {
      if (last < 0) return i;
      break;
    }
  }
  return last;
}

function ensureReplayHandBefore(side, beforeIdx) {
  if (!replayData || !replayData.moves) return;
  const arr = side === 'opp' ? replayOppPieces : replayMePieces;
  const hasUnused = !!(arr && arr.some(p => p && !p.used));
  if (hasUnused) return;

  const wantOpp = side === 'opp';
  const limit = Math.max(0, beforeIdx | 0);
  let di = dealIndexForSideBefore(replayData.moves, side, beforeIdx);
  if (di < 0) di = firstDealIndex(replayData.moves, side);

  // Hand exhausted: prefer a later deal for this side still before the place,
  // or the next deal at/after the place (online race: places logged before refill deal)
  if (arr && arr.length && arr.every(p => p && p.used)) {
    let nextBefore = -1;
    for (let i = (di >= 0 ? di + 1 : 0); i < limit; i++) {
      const ev = replayData.moves[i];
      if (!isReplayDealEv(ev)) continue;
      if ((ev.side === 'opp') === wantOpp) nextBefore = i;
    }
    if (nextBefore >= 0) {
      di = nextBefore;
    } else {
      for (let i = limit; i < replayData.moves.length; i++) {
        const ev = replayData.moves[i];
        if (!isReplayDealEv(ev)) continue;
        if ((ev.side === 'opp') === wantOpp) { di = i; break; }
      }
    }
  }

  if (di >= 0) {
    applyReplayDeal(replayData.moves[di], false);
    return;
  }
  // No deal in log for refill — synthesize next hand from the next places of this side
  const places = [];
  for (let i = limit; i < replayData.moves.length && places.length < 3; i++) {
    const ev = replayData.moves[i];
    if (!ev) continue;
    if ((ev.type === 'deal' || ev.type === 'Deal') && ((ev.side === 'opp') === wantOpp)) break;
    if (!(ev.type === 'place' || ev.shape)) continue;
    if ((ev.side === 'opp') !== wantOpp) continue;
    places.push(ev);
  }
  if (!places.length) return;
  const hand = places.map(p => ({
    shape: (typeof cloneShapeCells === 'function') ? cloneShapeCells(p.shape) : (p.shape || [[0,0]]).map(c => [+c[0]||0, +c[1]||0]),
    color: p.color ? String(p.color) : '#7c5cff',
    used: false
  }));
  while (hand.length < 3) hand.push({ shape: [[0,0]], color: '#7c5cff', used: true });
  if (wantOpp) {
    replayOppPieces = hand;
    try { renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, true); } catch (_) {}
  } else {
    replayMePieces = hand;
    try { renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, true); } catch (_) {}
  }
}

/**
 * Move each side's first deal before their first place (online race often logs deal after place).
 */
function normalizeMatchLogDealOrder(moves) {
  if (!Array.isArray(moves) || moves.length < 2) return moves;
  try {
    const out = moves.slice();
    const pull = (side) => {
      const wantOpp = side === 'opp';
      let di = -1;
      for (let i = 0; i < out.length; i++) {
        if (!isReplayDealEv(out[i])) continue;
        if ((out[i].side === 'opp') === wantOpp) { di = i; break; }
      }
      if (di < 0) return;
      let firstPlace = -1;
      for (let i = 0; i < out.length; i++) {
        const m = out[i];
        if (!m || isReplayDealEv(m)) continue;
        if (m.type === 'place' || (m.shape && m.type !== 'deal' && m.type !== 'Deal')) {
          if (wantOpp ? m.side === 'opp' : m.side !== 'opp') { firstPlace = i; break; }
        }
      }
      if (firstPlace < 0 || di < firstPlace) return;
      const deal = out.splice(di, 1)[0];
      // Insert among leading deals, always before this side's first place
      let insertAt = 0;
      while (insertAt < out.length && isReplayDealEv(out[insertAt])) insertAt++;
      const fp = firstPlace > di ? firstPlace - 1 : firstPlace;
      insertAt = Math.min(insertAt, Math.max(0, fp));
      out.splice(insertAt, 0, deal);
    };
    // Opp first: when they moved first their deal is often after their place
    pull('opp');
    pull('me');
    // Second pass in case pulling one shifted the other
    pull('opp');
    pull('me');
    return out;
  } catch (_) {
    return moves;
  }
}

/** Min seek index after consecutive leading deals + first deal of each side */
function replayBootstrapIndex(moves) {
  if (!moves || !moves.length) return 0;
  let n = leadingDealCount(moves);
  const mi = firstDealIndex(moves, 'me');
  const oi = firstDealIndex(moves, 'opp');
  let firstPlace = -1;
  for (let i = 0; i < moves.length; i++) {
    const ev = moves[i];
    if (!ev) continue;
    if (ev.type === 'place' || (ev.shape && ev.type !== 'deal' && ev.type !== 'Deal')) {
      firstPlace = i;
      break;
    }
  }
  const candidates = [n];
  // Always include opening deal of each side in the "start" cursor when it appears before any place
  if (mi >= 0 && (firstPlace < 0 || mi < firstPlace)) candidates.push(mi + 1);
  if (oi >= 0 && (firstPlace < 0 || oi < firstPlace)) candidates.push(oi + 1);
  // When a side's first deal is still after the first place (race), still advance past
  // consecutive leading deals only — applyOpeningReplayHands paints the late opening hand.
  return Math.max.apply(null, candidates);
}

/** Safe min index for seek/reset — never before both opening hands are accounted for */
function replayMinIndex(moves) {
  if (!moves || !moves.length) return 0;
  try {
    return Math.max(leadingDealCount(moves), replayBootstrapIndex(moves));
  } catch (_) {
    return leadingDealCount(moves);
  }
}
