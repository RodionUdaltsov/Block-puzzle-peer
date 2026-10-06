/**
 * Block Puzzle — js/11-lobby-versus-replay/03-bot-ai.js
 * Versus helpers and bot AI.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function updateTimerDisplay() {
  const m = Math.floor(vsTimeLeft/60), s = vsTimeLeft%60;
  timerEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  timerEl.classList.toggle('urgent', vsTimeLeft<=15);
  if (vsActive && vsTimeLeft > 0 && vsTimeLeft <= 10) SFX.tick();
}
function getBoardCellMetrics(boardEl) {
  try {
    const el = boardEl || boardOpp || boardMe || boardEl;
    if (!el) return { px: 18, gap: 2 };
    const rect = el.getBoundingClientRect();
    if (rect.width < 40) return { px: 18, gap: 2 };
    const step = rect.width / SIZE;
    const gap = Math.max(1, Math.min(4, step * 0.08));
    const px = Math.max(10, Math.round(step - gap));
    return { px, gap: Math.max(1, Math.round(gap)) };
  } catch (_) {
    return { px: 18, gap: 2 };
  }
}
function buildPieceGhostHTML(piece, cellPx, gapPx) {
  const maxR = Math.max(...piece.shape.map(s=>s[0]));
  const maxC = Math.max(...piece.shape.map(s=>s[1]));
  const occ = new Set(piece.shape.map(([r,c])=>r+','+c));
  const col = (piece.color && String(piece.color).trim()) ? String(piece.color).trim() : '#00d4aa';
  const px = Math.max(8, Math.round(cellPx || 18));
  const gap = (gapPx != null) ? gapPx : Math.max(1, Math.round(px * 0.08));
  const rad = Math.max(3, Math.round(px * 0.18));
  // Same paint vars as board cells so every rarity looks identical in flight
  const cellStyle = `width:${px}px;height:${px}px;border-radius:${rad}px;background:${col};background-color:${col};background-image:none;--cell-base:${col};--cell-glow:${col}`;
  let html = `<div class="piece-grid" style="grid-template-columns:repeat(${maxC+1},${px}px);grid-template-rows:repeat(${maxR+1},${px}px);gap:${gap}px">`;
  for (let r=0;r<=maxR;r++) for (let c=0;c<=maxC;c++) {
    if (occ.has(r+','+c)) html += `<div class="piece-cell" style="${cellStyle}"></div>`;
    else html += `<div></div>`;
  }
  return html + '</div>';
}

function shapeKey(shape) {
  try {
    if (!Array.isArray(shape) || !shape.length) return '';
    let cells = shape.map(p => [p[0]|0, p[1]|0]);
    try {
      if (typeof normalize === 'function') cells = normalize(cells);
    } catch (_) {}
    return cells.map(p => p[0] + ',' + p[1]).sort().join('|');
  } catch (_) { return ''; }
}
function colorKey(c) {
  return String(c || '').trim().toLowerCase();
}
/** Find unused opp tray index matching placed shape (and color when possible) */
function findOppTrayIdx(shape, color) {
  if (!oppPieces || !oppPieces.length) return -1;
  const sk = shapeKey(shape);
  const ck = colorKey(color);
  let shapeOnly = -1;
  for (let i = 0; i < oppPieces.length; i++) {
    const p = oppPieces[i];
    if (!p || p.used || !p.shape) continue;
    if (shapeKey(p.shape) !== sk) continue;
    if (ck && colorKey(p.color) === ck) return i;
    if (shapeOnly < 0) shapeOnly = i;
  }
  return shapeOnly;
}

function aiTick() {
  // Bot AI only — ignore leftover mpMode from previous online matches
  if (!vsActive) return;
  // Accept bots mode via flag OR selected bot (vsModeType alone was too fragile)
  const isBotMatch = (vsModeType === 'bots')
    || !!currentBot
    || (typeof document !== 'undefined' && document.body && document.body.classList.contains('vs-bots'));
  if (!isBotMatch) return;
  if (mpMode && (roomMatchMode || BPState.roomMatchMode)) return; // never drive AI in live ranked room
  // Safety: never freeze forever if a settle timer was lost
  // Threshold above max fly+settle so we do not interrupt a normal slow move
  if (aiBusy) {
    const since = (typeof aiBusySince === 'number' && aiBusySince > 0)
      ? (Date.now() - aiBusySince) : 99999;
    if (since < 2800) return;
    aiBusy = false;
    try { aiBusySince = 0; } catch (_) {}
  }
  if (!currentBot && BOTS && BOTS.length) currentBot = BOTS[0];
  const rawBot = currentBot || (BOTS && BOTS[5]) || { skill: 0.5, mistake: 0.2, interval: 1000, trophies: 200 };
  const profile = (typeof resolveBotCombat === 'function')
    ? resolveBotCombat(rawBot)
    : rawBot;

  // New set if empty or all used
  if (!oppPieces.length || oppPieces.every(p => p.used)) {
    oppPieces = [randomBotPiece(), randomBotPiece(), randomBotPiece()];
    renderOppPieces();
    logDeal('opp', oppPieces);
    if (piecesTrulyUnplayable(oppGrid, oppPieces)) {
      setAiStuck(true);
      evaluateMatchEnd();
      return;
    }
    setAiStuck(false);
  }

  // Re-verify stuck each tick — recover if a piece actually fits (fixes false positives)
  if (aiStuck) {
    if (!piecesTrulyUnplayable(oppGrid, oppPieces)) {
      setAiStuck(false);
    } else {
      evaluateMatchEnd();
      return;
    }
  }

  const available = oppPieces.filter(p => !p.used);
  if (!available.length) {
    // Force deal next tick
    oppPieces = [];
    return;
  }

  // Soft hesitation — weak bots skip a think more often; never twice in a row
  if (!aiTick._skip && Math.random() < (profile.mistake || 0) * 0.22) {
    aiTick._skip = true;
    return;
  }
  aiTick._skip = false;

  // Exhaustive legal search; skill = chance to keep the best move (scales with trophies)
  const sk = Math.max(0.05, Math.min(0.995, profile.skill || 0.5));
  let move = findBestMove(oppGrid, oppPieces, sk);
  // Low skill: often pick a weaker legal placement (makes low-trophy bots beatable)
  // High skill almost never takes this branch
  if (move && Math.random() > sk) {
    const playable = [];
    for (let idx = 0; idx < oppPieces.length; idx++) {
      const piece = oppPieces[idx];
      if (!piece || piece.used) continue;
      const all = findAllPlacements(oppGrid, piece.shape);
      if (!all.length) continue;
      // Weak: sample more random cells; strong rarely reaches here
      const n = Math.min(sk < 0.4 ? 5 : 3, all.length);
      for (let k = 0; k < n; k++) {
        const pos = all[Math.floor(Math.random() * all.length)];
        playable.push({ piece, idx, pos, sc: 0 });
      }
    }
    if (playable.length) {
      move = playable[Math.floor(Math.random() * playable.length)];
    }
  }

  if (!move) {
    // Hard check: only stuck if zero legal placements remain
    if (piecesTrulyUnplayable(oppGrid, oppPieces)) {
      setAiStuck(true);
      evaluateMatchEnd();
    }
    return;
  }
  setAiStuck(false);

  const chosen = move.piece;
  const pos = move.pos;
  const chosenIdx = move.idx;

  aiBusy = true;
  try { aiBusySince = Date.now(); } catch (_) { aiBusySince = Date.now(); }
  // Resolve tray index before marking used (DOM still has the piece)
  let resolvedIdx = (typeof chosenIdx === 'number') ? chosenIdx : -1;
  if (resolvedIdx < 0 || !oppPieces[resolvedIdx] || oppPieces[resolvedIdx] !== chosen) {
    resolvedIdx = findOppTrayIdx(chosen.shape, chosen.color);
  }
  // Mark used only inside place commit (avoids burning piece if fly/place fails)

  // Lift visual on opponent piece slot
  const oppArea = document.getElementById('piecesAreaOpp');
  let slotEl = oppArea && resolvedIdx >= 0
    ? oppArea.querySelector(`.piece-slot[data-opp-idx="${resolvedIdx}"]`)
    : null;
  if (!slotEl && oppArea) {
    // fallback: first non-used visible slot
    slotEl = oppArea.querySelector('.piece-slot:not(.used)');
  }
  if (slotEl) slotEl.classList.add('lifting');

  // Animate piece from slot → board cell
  const aiGhost = document.getElementById('aiGhost');
  const oppRect = boardOpp.getBoundingClientRect();
  const step = (oppRect.width - 2.5 * (SIZE - 1)) / SIZE;
  const maxR = Math.max(...chosen.shape.map(s => s[0]));
  const maxC = Math.max(...chosen.shape.map(s => s[1]));
  const targetX = oppRect.left + (pos.c + maxC / 2) * (step + 2.5) + step / 2;
  const targetY = oppRect.top + (pos.r + maxR / 2) * (step + 2.5) + step / 2;

  let startX = oppRect.left + oppRect.width / 2;
  let startY = oppRect.bottom + 20;
  if (slotEl) {
    const sr = slotEl.getBoundingClientRect();
    startX = sr.left + sr.width / 2;
    startY = sr.top + sr.height / 2;
  }

  try { setAiGhostSkin('opp'); } catch (_) {}
  {
    const m = getBoardCellMetrics(boardOpp);
    aiGhost.innerHTML = buildPieceGhostHTML(chosen, m.px, m.gap);
  }
  aiGhost.style.transition = 'none';
  aiGhost.style.left = startX + 'px';
  aiGhost.style.top = startY + 'px';
  aiGhost.style.display = 'block';
  aiGhost.style.opacity = '1';
  aiGhost.style.visibility = 'visible';
  aiGhost.style.zIndex = '50';
  void aiGhost.offsetWidth;
  aiGhost.style.transition = 'left 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      aiGhost.style.left = targetX + 'px';
      aiGhost.style.top = targetY + 'px';
    });
  });

  const phoneUi = typeof isTouchUiClient === 'function' ? isTouchUiClient() : false;
  const flyMs = phoneUi ? 480 : 400;
  setTimeout(function aiPlaceCommit() {
    let released = false;
    const releaseBusy = (delay) => {
      if (released) return;
      released = true;
      const d = Math.max(0, delay | 0);
      setTimeout(() => {
        aiBusy = false;
        try { aiBusySince = 0; } catch (_) {}
      }, d);
    };
    try {
      if (!vsActive) {
        try { if (aiGhost) aiGhost.style.display = 'none'; } catch (_) {}
        releaseBusy(0);
        return;
      }

      // Commit: mark piece used then write cells
      try { chosen.used = true; } catch (_) {}
      for (const [dr, dc] of chosen.shape) {
        oppGrid[pos.r + dr][pos.c + dc] = chosen.color;
      }
      oppScore += chosen.shape.length * 10;
      let _botIdx = -1;
      try {
        if (oppPieces && chosen) {
          for (let i = 0; i < oppPieces.length; i++) {
            if (oppPieces[i] === chosen) { _botIdx = i; break; }
          }
        }
      } catch (_) {}
      try {
        matchLog.push({
          type: 'place',
          side: 'opp',
          t: Date.now() - matchStartTs,
          shape: (typeof normalize === 'function'
            ? normalize(chosen.shape.map(p => p.slice()))
            : chosen.shape.map(p => p.slice())),
          color: chosen.color,
          r: pos.r,
          c: pos.c,
          myScore: score,
          oppScore,
          pieceIdx: _botIdx,
          placePts: chosen.shape.length * 10
        });
      } catch (_) {}

      try {
        for (const [dr, dc] of chosen.shape) {
          const cell = boardOpp.children[(pos.r + dr) * SIZE + (pos.c + dc)];
          if (cell) {
            paintCellColor(cell, chosen.color);
            cell.classList.add('filled', 'placing');
            setTimeout(() => { try { cell.classList.remove('placing'); } catch (_) {} },
              (document.body && document.body.classList.contains('touch-ui')) ? 500 : 780);
          }
        }
      } catch (_) {}

      try {
        aiGhost.style.opacity = '0';
        setTimeout(() => { try { aiGhost.style.display = 'none'; } catch (_) {} }, 150);
      } catch (_) {}

      if (slotEl) {
        try {
          slotEl.classList.remove('lifting');
          slotEl.classList.add('used');
        } catch (_) {}
      }

      let cleared = 0;
      try {
        const clearInfo = clearLinesOn(oppGrid, boardOpp);
        cleared = clearInfo.count || 0;
        if (cleared > 0) {
          oppClearChain = (oppClearChain || 0) + 1;
          const bonus = bonusFor(cleared) + chainBonusFor(oppClearChain);
          oppScore += bonus;
          const maxRa = Math.max(...chosen.shape.map(s => s[0]));
          const maxCa = Math.max(...chosen.shape.map(s => s[1]));
          const placeAnchor = {
            baseR: pos.r, baseC: pos.c,
            centerR: pos.r + maxRa / 2,
            centerC: pos.c + maxCa / 2
          };
          try {
            const positions = getClearFloatPositions(boardOpp, clearInfo.rows, clearInfo.cols, placeAnchor);
            const oppBanner = document.getElementById('comboBannerOpp');
            showCombo(oppBanner, cleared, bonus, boardOpp.parentElement, 'opp', {
              chain: oppClearChain,
              positions,
              placeAnchor
            });
          } catch (_) {}
          try {
            if ((cleared >= 3 || oppClearChain >= 2) && Math.random() < 0.35) showBotPhrase('clear');
            else if (cleared >= 2 && Math.random() < 0.18) showBotPhrase('clear');
          } catch (_) {}
        } else {
          oppClearChain = 0;
        }
        try {
          if (Math.random() < 0.12) {
            if (oppScore > score + 250 && Math.random() < 0.28) showBotPhrase('lead');
            else if (score > oppScore + 250 && Math.random() < 0.28) showBotPhrase('behind');
          }
        } catch (_) {}
        try {
          const el = document.getElementById('oppScore');
          if (el) el.textContent = oppScore;
        } catch (_) {}
        try {
          if (matchLog.length && matchLog[matchLog.length - 1].side === 'opp') {
            const last = matchLog[matchLog.length - 1];
            last.oppScore = oppScore;
            last.myScore = score;
            if (cleared > 0) {
              const bb = bonusFor(cleared);
              const ce = chainBonusFor(oppClearChain);
              last.cleared = cleared;
              last.bonus = bb + ce;
              last.baseBonus = bb;
              last.chainExtra = ce;
              last.chain = oppClearChain;
              last.rows = clearInfo.rows ? clearInfo.rows.slice() : [];
              last.cols = clearInfo.cols ? clearInfo.cols.slice() : [];
            }
          }
        } catch (_) {}
      } catch (clearErr) {
        console.warn('ai clear', clearErr);
      }

      // New set only here — always log for replay chronology
      try {
        if (oppPieces.every(p => p.used)) {
          oppPieces = [randomBotPiece(), randomBotPiece(), randomBotPiece()];
          renderOppPieces();
          logDeal('opp', oppPieces);
        }
      } catch (_) {}

      try {
        const el = document.getElementById('oppScore');
        if (el) el.textContent = oppScore;
      } catch (_) {}
      try { onAiScoreChanged(); } catch (_) {}

      // Settle: clear FX need a beat; plain places recover faster
      const settleMs = phoneUi
        ? ((cleared > 0 ? 300 : 0) + 200)
        : ((cleared > 0 ? 140 : 0) + 80);
      releaseBusy(settleMs);
      // Safety nudge only if primary interval stalled — must respect rank pace.
      // Fast bots (low aiTickMs) get a short gap; slow bots stay slow.
      const think = (typeof aiTickMs === 'number' && aiTickMs > 0) ? aiTickMs : 1400;
      const minGap = Math.max(280, Math.round(think * 0.72));
      const nudgeAt = settleMs + minGap;
      setTimeout(() => {
        try {
          if (vsActive && !aiBusy) aiTick();
        } catch (_) {}
      }, nudgeAt);
    } catch (e) {
      console.warn('ai place', e);
      try { if (aiGhost) aiGhost.style.display = 'none'; } catch (_) {}
      releaseBusy(0);
    }
  }, flyMs);
}

