/**
 * Block Puzzle — js/11-lobby-versus-replay/06-replay-core.js
 * Replay start, playback and result card.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function clearLinesSilent(g) {
  if (_R) return _R.clearLinesSilent(g);
  const rows = [], cols = [];
  for (let r = 0; r < SIZE; r++) if (g[r].every(c => c !== null)) rows.push(r);
  for (let c = 0; c < SIZE; c++) if (g.every(row => row[c] !== null)) cols.push(c);
  rows.forEach(r => { for (let c = 0; c < SIZE; c++) g[r][c] = null; });
  cols.forEach(c => { for (let r = 0; r < SIZE; r++) g[r][c] = null; });
  return rows.length + cols.length;
}

function clearReplayEffects() {
  document.querySelectorAll('.score-float').forEach(el => el.remove());
  [comboBanner, comboBannerMe, document.getElementById('comboBannerOpp')].forEach(b => {
    if (!b) return;
    b.classList.remove('show');
    b.textContent = '';
  });
  const g = document.getElementById('aiGhost');
  if (g) { g.style.display = 'none'; g.style.opacity = '0'; g.innerHTML = ''; }
}

function startReplay(match, opts) {
  opts = opts || {};
  if (!match || !match.moves || !match.moves.length) {
    try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
    return;
  }
  if (opts.from === 'result' || opts.from === 'history' || opts.from === 'menu') {
    replayReturnTo = opts.from;
  } else {
    replayReturnTo = 'history';
  }
  // Cancel any pending result modal / score-duel chain (fixes race: quick "Смотреть повтор"
  // after match would open replay and then overlay the result window on top).
  try { dismissPostMatchResult(); } catch (_) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_2) {}
  }
  if (vsTimerId) clearInterval(vsTimerId);
  if (aiInterval) clearInterval(aiInterval);
  if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
  vsActive = false;
  replayMode = true;
  document.body.classList.add('replay-ui');
  document.body.classList.add('replay-playing');
  BPState.repChainMe = 0;
  BPState.repChainOpp = 0;
  // Backup current cosmetics; restore when leaving replay
  try {
    BPState.replaySkinBackup = equippedSkinId;
    BPState.replayBoardBackup = equippedBoardId;
  } catch (_) {}
  // My skins/fields from that match
  try {
    if (match && match.mySkinId) {
      equippedSkinId = match.mySkinId;
      applyEquippedSkin();
    }
    if (match && match.myBoardId) {
      equippedBoardId = match.myBoardId;
      applyEquippedBoard();
    }
  } catch (_) {}
  // Opponent cosmetics
  try {
    if (match && match.oppSkinId) {
      window.mpOppSkinId = match.oppSkinId;
      applyOppSkin(match.oppSkinId);
    } else {
      clearOppSkin();
      window.mpOppSkinId = null;
    }
    if (match && match.oppBoardId) {
      window.mpOppBoardId = match.oppBoardId;
      applyOppBoard(match.oppBoardId);
    } else {
      clearOppBoard();
      window.mpOppBoardId = null;
    }
  } catch (_) {}
  const fb = document.getElementById('btnForfeit');
  if (fb) fb.style.display = 'none';
  // Fix deal/place order from online races (deal logged after first place)
  try {
    if (match.moves && match.moves.length) {
      match = Object.assign({}, match, { moves: normalizeMatchLogDealOrder(match.moves) });
    }
  } catch (_) {}
  replayData = match;
  replayIndex = 0;
  replayBusy = false;
  stopReplayPlay();

  showScreen('versus');
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  createBoardDOM(boardMe);
  createBoardDOM(boardOpp);
  try { applyEquippedBoard(); } catch (_) {}
  try { if (window.mpOppBoardId) applyOppBoard(window.mpOppBoardId); } catch (_) {}
  try { applyEquippedSkin(); } catch (_) {}
  try { if (window.mpOppSkinId) applyOppSkin(window.mpOppSkinId); } catch (_) {}
  renderGrid(grid, boardMe);
  renderGrid(oppGrid, boardOpp);
  clearReplayEffects();

  document.getElementById('myScore').textContent = '0';
  document.getElementById('oppScore').textContent = '0';
  {
    const bot = match.botId ? BOTS.find(b => b.id === match.botId) : null;
    document.getElementById('oppName').innerHTML = bot
      ? `${botAvatarHTML(bot, 24)} <span>${escapeHtmlLobby(match.oppName || match.opp)}</span>`
      : `<span>${escapeHtmlLobby(match.oppName || match.opp)}</span>`;
  }
  timerEl.classList.remove('urgent');

  document.getElementById('stuckWait').style.display = 'none';
  document.getElementById('oppStuckWait').style.display = 'none';
  document.getElementById('vsLiveControls').style.display = 'none';
  document.getElementById('vsFooter').style.display = 'none';
  const piecesVs = document.getElementById('piecesAreaVs');
  if (piecesVs) {
    piecesVs.style.opacity = '1';
    piecesVs.style.visibility = 'visible';
    piecesVs.style.pointerEvents = 'none';
    piecesVs.style.display = 'flex';
    piecesVs.innerHTML = '';
  }
  const oppArea = document.getElementById('piecesAreaOpp');
  if (oppArea) {
    oppArea.style.opacity = '1';
    oppArea.style.visibility = 'visible';
    oppArea.style.pointerEvents = 'none';
    oppArea.style.display = 'flex';
    oppArea.innerHTML = '';
  }
  // Clear live hands so accidental live re-render cannot show wrong pieces
  try { pieces = []; } catch (_) {}
  try { oppPieces = []; } catch (_) {}

  // Opening hands: deals + align shapes to the places that will actually be played
  replayMePieces = [];
  replayOppPieces = [];
  try { applyOpeningReplayHands(match.moves, false); } catch (_) {}
  // Cursor after opening deals (both sides) so seek/reset never drops trays
  replayIndex = (typeof replayMinIndex === 'function')
    ? replayMinIndex(match.moves)
    : leadingDealCount(match.moves);
  // Force tray silhouettes to match the next places (deal log can be the wrong hand on races)
  try { rebuildReplayTraysFromMoves(match.moves, replayIndex); } catch (_) {}
  clearReplayEffects();
  // Paint trays from match log, then scale (applyBoardScales respects replayMode)
  try {
    renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
    renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
  } catch (_) {}
  requestAnimationFrame(() => {
    try { applyBoardScales(); } catch (_) {}
    try {
      renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
      renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
    } catch (_) {}
  });

  const reviewBar = document.getElementById('reviewBar');
  reviewBar.classList.add('visible');
  document.getElementById('reviewTitle').textContent = (typeof globalThis.t==='function'?globalThis.t('js.replay','Повтор'):'Повтор') + ' · ' + match.result;
  document.getElementById('reviewMeta').textContent = (typeof globalThis.t==='function'?globalThis.t('js.event','Событие'):'Событие') + ' ' + replayIndex + ' / ' + match.moves.length + ' · 0:0';
  replaySpeed = 1;
  replayClockMs = 0;
  if (match.duration) timerEl.textContent = formatReplayClock(match.duration * 1000);
  else timerEl.textContent = '0:00';
  reviewBar.classList.add('replay-dock');
  applyBoardScales();
  hideReplayEndCard();
  // Full-width scrubber under boards
  try {
    const scrub = document.getElementById('replayScrubBar');
    if (scrub) {
      scrub.style.display = 'flex';
      scrub.setAttribute('aria-hidden', 'false');
    }
    const slider = document.getElementById('replayProgress');
    if (slider) {
      slider.max = String(match.moves.length || 0);
      slider.value = String(replayIndex);
      if (!slider._bpBound) {
        slider._bpBound = true;
        let seekTimer = null;
        const doSeek = () => {
          seekTimer = null;
          const v = parseInt(slider.value, 10);
          if (!Number.isFinite(v)) return;
          hideReplayEndCard();
          seekReplayTo(v, { force: true });
        };
        slider.addEventListener('input', () => {
          stopReplayPlay();
          hideReplayEndCard();
          const lab = document.getElementById('replayProgressLabel');
          // Use live replayData — handler is bound once; match from first open would be stale
          const total = (replayData && replayData.moves) ? replayData.moves.length : 0;
          if (lab) lab.textContent = slider.value + '/' + total;
          if (seekTimer) clearTimeout(seekTimer);
          seekTimer = setTimeout(doSeek, 70);
        });
        slider.addEventListener('change', () => {
          if (seekTimer) { clearTimeout(seekTimer); seekTimer = null; }
          doSeek();
        });
      }
    }
  } catch (_) {}
  reviewBar.querySelector('.controls').innerHTML = `
    <button class="primary" id="btnReplayPlay" title="Пуск">▶</button>
    <button class="ghost" id="btnReplayBackStep" title="Назад">◀</button>
    <button class="ghost" id="btnReplayStep" title="Вперёд">▶▶</button>
    <button class="ghost" id="btnReplaySpeed" title="Скорость">1x</button>
    <button class="ghost" id="btnReplayResult" title="Результат матча">🏆</button>
    <button class="ghost" id="btnReplayReset" title="Сначала">↺</button>
    <button class="ghost" id="btnReplayBack" title="Закрыть повтор">✕</button>
  `;
  document.getElementById('btnReplayPlay')?.addEventListener('click', toggleReplayPlay);
  document.getElementById('btnReplayStep')?.addEventListener('click', () => {
    stopReplayPlay();
    if (replayBusy) return;
    hideReplayEndCard();
    if (replayIndex >= match.moves.length) {
      showReplayResult();
      return;
    }
    if (replayIndex < match.moves.length) {
      replayClockMs = getEventTime(match.moves[replayIndex], replayIndex);
      updateReplayClockDisplay();
    }
    replayStep(() => { updateReplayProgressUI(); }, Math.max(1.25, replaySpeed));
  });
  document.getElementById('btnReplayBackStep')?.addEventListener('click', () => {
    stopReplayPlay();
    if (replayBusy) return;
    hideReplayEndCard();
    const minIdx = (typeof replayMinIndex === 'function')
      ? replayMinIndex(match.moves)
      : leadingDealCount(match.moves);
    seekReplayTo(Math.max(minIdx, replayIndex - 1), { force: true });
  });
  document.getElementById('btnReplaySpeed')?.addEventListener('click', () => {
    const speeds = [1, 1.5, 2, 4, 8];
    let i = speeds.indexOf(replaySpeed);
    if (i < 0) {
      i = speeds.findIndex(s => s >= replaySpeed);
      if (i < 0) i = 0;
    }
    replaySpeed = speeds[(i + 1) % speeds.length];
    const lab = document.getElementById('btnReplaySpeed');
    if (lab) lab.textContent = replaySpeed === 1.5 ? '1.5x' : `${replaySpeed}x`;
    const curT = replayClockMs || 0;
    replayAbsBase = performance.now() - curT / replaySpeed;
  });
  document.getElementById('btnReplayResult')?.addEventListener('click', () => {
    stopReplayPlay();
    showReplayResult();
  });
  document.getElementById('btnReplayReset')?.addEventListener('click', () => {
    stopReplayPlay();
    hideReplayEndCard();
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    resetReplay();
    updateReplayProgressUI();
  });
  updateReplayProgressUI();
  document.getElementById('btnReplayBack')?.addEventListener('click', () => {
    stopReplayPlay();
    replayMode = false;
    document.body.classList.remove('replay-ui');
    document.body.classList.remove('replay-playing');
    hideReplayEndCard();
    try {
      const scrub = document.getElementById('replayScrubBar');
      if (scrub) {
        scrub.style.display = 'none';
        scrub.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
    // Restore cosmetics used outside of this replay
    try {
      if (BPState.replaySkinBackup) {
        equippedSkinId = BPState.replaySkinBackup;
        applyEquippedSkin();
      }
      if (BPState.replayBoardBackup) {
        equippedBoardId = BPState.replayBoardBackup;
        applyEquippedBoard();
      }
      clearOppSkin();
      clearOppBoard();
      window.mpOppSkinId = null;
      window.mpOppBoardId = null;
      BPState.replaySkinBackup = null;
      BPState.replayBoardBackup = null;
    } catch (_) {}
    applyBoardScales();
    const fb = document.getElementById('btnForfeit');
    if (fb) fb.style.display = '';
    reviewBar.classList.remove('visible');
    reviewBar.classList.remove('replay-dock');
    reviewBar.querySelector('.controls').innerHTML = `
      <button type="button" class="primary" data-review-action="result" title="Результат">🏆</button>
      <button type="button" class="ghost" data-review-action="again" title="Ещё матч">↻</button>
      <button type="button" class="ghost" data-review-action="menu" title="В меню">☰</button>
    `;
    // Return to where the replay was opened from
    const ret = replayReturnTo || 'history';
    if (ret === 'result') {
      try { showScreen('versus'); } catch (_) {}
      try { configurePostMatchButtons(); } catch (_) {}
      try { document.getElementById('versusResult').classList.add('visible'); } catch (_) {}
    } else if (ret === 'menu') {
      try { showScreen('menu'); updateMenuStats(); } catch (_) {}
    } else {
      try { renderHistory(); } catch (_) {}
      try { showScreen('history'); } catch (_) {}
    }
  });
}

let replayBusy = false;
let replayPlaying = false;

function stopReplayPlay() {
  replayPlaying = false;
  if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
  const btn = document.getElementById('btnReplayPlay');
  if (btn) btn.textContent = '▶';
}

function updateReplayProgressUI() {
  try {
    if (!replayData || !replayData.moves) return;
    const total = replayData.moves.length;
    const cur = Math.min(replayIndex, total);
    const slider = document.getElementById('replayProgress');
    if (slider) {
      slider.max = String(Math.max(0, total));
      slider.value = String(cur);
    }
    const lab = document.getElementById('replayProgressLabel');
    if (lab) lab.textContent = cur + '/' + total;
  } catch (_) {}
}

/** Human-readable end reason for a stored match */
function formatMatchEndReason(match) {
  if (!match) return '';
  const reason = match.reason || 'normal';
  const res = match.result || '';
  const won = res === 'Победа';
  const draw = res === 'Ничья';
  if (reason === 'disconnect') {
    return won ? 'Соперник отключился' : 'Отключение';
  }
  if (reason === 'forfeit') {
    return won ? 'Соперник сдался' : 'Вы сдались';
  }
  if (reason === 'afk') {
    if (draw) return 'АФК обеих сторон';
    return won ? 'Соперник АФК' : 'АФК';
  }
  if (match.timeLeft != null && match.timeLeft <= 0) return 'Время вышло';
  if (draw) return 'Ничья по очкам';
  return won ? 'Победа по очкам' : 'Поражение по очкам';
}

function hideReplayEndCard() {
  try {
    const card = document.getElementById('replayEndCard');
    if (card) {
      card.classList.remove('visible');
      card.style.display = 'none';
      card.style.pointerEvents = 'none';
      card.setAttribute('aria-hidden', 'true');
    }
    document.getElementById('versusResult')?.classList.remove('visible');
  } catch (_) {}
}

function showReplayResult() {
  if (!replayData) return;
  stopReplayPlay();
  try {
    const match = replayData;
    const my = typeof match.my === 'number' ? match.my : 0;
    const opp = typeof match.oppScore === 'number' ? match.oppScore : 0;
    const res = match.result || (my > opp ? 'Победа' : my < opp ? 'Поражение' : 'Ничья');
    const reasonLine = formatMatchEndReason(match);
    let titleText = res === 'Ничья' ? 'Ничья!' : res === 'Победа' ? 'Победа!' : 'Поражение';
    if (match.reason === 'disconnect' && res === 'Победа') titleText = 'Победа · соперник отключился';
    if (match.reason === 'disconnect' && res === 'Поражение') titleText = 'Поражение · отключение';
    if (match.reason === 'forfeit' && res === 'Поражение') titleText = 'Поражение · вы сдались';
    if (match.reason === 'forfeit' && res === 'Победа') titleText = 'Победа · соперник сдался';
    if (match.reason === 'afk' && res === 'Ничья') titleText = 'Ничья · АФК';
    if (match.reason === 'afk' && res === 'Поражение') titleText = 'Поражение · АФК';
    if (match.reason === 'afk' && res === 'Победа') titleText = 'Победа · соперник АФК';

    // Ensure modal stays closed — result is part of the replay UI
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}

    const card = document.getElementById('replayEndCard');
    const titleEl = document.getElementById('replayEndTitle');
    const myEl = document.getElementById('replayEndMy');
    const oppEl = document.getElementById('replayEndOpp');
    const oppLab = document.getElementById('replayEndOppLabel');
    const metaEl = document.getElementById('replayEndMeta');
    if (titleEl) titleEl.textContent = titleText;
    if (myEl) myEl.textContent = my;
    if (oppEl) oppEl.textContent = opp;
    if (oppLab) {
      oppLab.textContent =
        (match.oppName || match.opp || 'Соперник').toString().replace(/\s*\d+\s*🏆\s*/g, '').trim() || 'Соперник';
    }
    if (metaEl) {
      const parts = [];
      parts.push(reasonLine || '');
      if (match.mode === 'online' && typeof match.delta === 'number' && match.delta !== 0) {
        const sign = match.delta > 0 ? '+' : '−';
        parts.push('🏆 ' + sign + Math.abs(match.delta));
      } else if (match.mode === 'friendly') {
        parts.push('Товарищеский');
      } else if (match.botId || match.mode === 'bots') {
        parts.push('Тренировка');
      }
      if (match.timeLeft != null) {
        if (match.timeLeft <= 0) parts.push('Время вышло');
        else parts.push('Осталось ' + formatTimeLeft(match.timeLeft));
      }
      if (match.duration) {
        const dur = match.duration === 60 ? '1 мин' : match.duration === 180 ? '3 мин' : '2 мин';
        parts.push(dur);
      }
      metaEl.textContent = parts.filter(Boolean).join(' · ');
    }
    if (card) {
      // Escape #screenVersus overflow:hidden — attach to body
      try {
        if (card.parentElement !== document.body) {
          document.body.appendChild(card);
        }
      } catch (_) {}
      card.classList.add('visible');
      card.setAttribute('aria-hidden', 'false');
      card.style.display = 'flex';
      card.style.position = 'fixed';
      card.style.inset = '0';
      card.style.zIndex = '10050';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.pointerEvents = 'auto';
      card.style.opacity = '1';
      card.style.visibility = 'visible';
    }
    // Close only
    const closeBtn = document.getElementById('btnReplayEndClose');
    if (closeBtn && !closeBtn._bpBound) {
      closeBtn._bpBound = true;
      closeBtn.addEventListener('click', () => {
        hideReplayEndCard();
      });
    }
    try {
      document.getElementById('reviewMeta').textContent =
        `Конец · ${res}` + (reasonLine ? ' · ' + reasonLine : '');
    } catch (_) {}
    updateReplayProgressUI();
  } catch (e) {
    console.warn('showReplayResult', e);
  }
}

function seekReplayTo(targetIdx, opts) {
  opts = opts || {};
  if (!replayData || !replayData.moves) return;
  stopReplayPlay();
  if (replayBusy && !opts.force) return;
  hideReplayEndCard();
  const minIdx = (typeof replayMinIndex === 'function')
    ? replayMinIndex(replayData.moves)
    : leadingDealCount(replayData.moves);
  const end = Math.max(minIdx, Math.min(targetIdx, replayData.moves.length));
  const vs = document.getElementById('screenVersus');
  if (vs) vs.classList.add('replay-seeking');
  rebuildReplayTo(end, false);
  updateReplayProgressUI();
  requestAnimationFrame(() => {
    setTimeout(() => {
      try { if (vs) vs.classList.remove('replay-seeking'); } catch (_) {}
    }, 160);
  });
}

function formatReplayClock(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateReplayClockDisplay() {
  if (!replayData) return;
  // Show time remaining like live match if duration known
  if (replayData.duration) {
    const left = Math.max(0, replayData.duration * 1000 - replayClockMs);
    timerEl.textContent = formatReplayClock(left);
  } else {
    timerEl.textContent = formatReplayClock(replayClockMs);
  }
}

function getEventTime(ev, idx) {
  if (ev && typeof ev.t === 'number') return ev.t;
  // Legacy events without timestamps — approximate
  return idx * 600;
}

let replayAbsBase = 0; // performance.now() anchor for 1:1 timing

function toggleReplayPlay() {
  if (replayPlaying) {
    stopReplayPlay();
    return;
  }
  if (!replayData || !replayData.moves || !replayData.moves.length) return;
  // Already at end → show result or restart from beginning
  if (replayIndex >= replayData.moves.length) {
    showReplayResult();
    return;
  }
  hideReplayEndCard();
  replayPlaying = true;
  const btn = document.getElementById('btnReplayPlay');
  if (btn) btn.textContent = '⏸';

  // Absolute timeline: 1x == real match pace (gaps already include think time)
  const nowT = replayIndex > 0
    ? getEventTime(replayData.moves[Math.max(0, replayIndex - 1)], Math.max(0, replayIndex - 1))
    : (replayData.moves[0] ? getEventTime(replayData.moves[0], 0) : 0);
  replayAbsBase = performance.now() - nowT / replaySpeed;

  const scheduleNext = () => {
    if (!replayPlaying || !replayMode || !replayData) { stopReplayPlay(); return; }
    if (replayIndex >= replayData.moves.length) {
      stopReplayPlay();
      // Brief pause so last place/clear anim settles, then show result
      setTimeout(() => {
        if (replayMode && replayData && replayIndex >= replayData.moves.length) {
          showReplayResult();
        }
      }, 480);
      return;
    }
    if (replayBusy) {
      replayTimer = setTimeout(scheduleNext, 28);
      return;
    }

    const nextT = getEventTime(replayData.moves[replayIndex], replayIndex);
    const prevT = replayIndex > 0
      ? getEventTime(replayData.moves[replayIndex - 1], replayIndex - 1)
      : 0;
    const gap = Math.max(0, nextT - prevT);
    // Cap long "think" gaps so scrubbing/playback feels continuous
    const maxGap = replaySpeed >= 4 ? 280 : replaySpeed >= 2 ? 520 : 900;
    const minGap = replaySpeed >= 4 ? 40 : 70;
    const cappedGap = Math.min(maxGap, Math.max(minGap, gap / replaySpeed));
    const targetWall = performance.now() + cappedGap;
    // Also respect absolute timeline when gaps are short
    const absWall = replayAbsBase + nextT / replaySpeed;
    const delay = Math.max(0, Math.min(cappedGap, Math.max(0, absWall - performance.now())));
    // Prefer capped gap for smoothness when think time is huge
    const finalDelay = gap / replaySpeed > maxGap ? cappedGap : Math.min(delay, maxGap);

    replayTimer = setTimeout(() => {
      if (!replayPlaying) return;
      replayClockMs = nextT;
      updateReplayClockDisplay();
      replayStep(() => {
        updateReplayProgressUI();
        if (replayPlaying) scheduleNext();
      }, replaySpeed);
    }, Math.max(0, finalDelay));
  };
  scheduleNext();
}
