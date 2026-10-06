/**
 * Block Puzzle — js/11-lobby-versus-replay/05-end-versus.js
 * endVersus, review mode, history.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function endVersus(opts) {
  opts = opts || {};
  try { BPState.matchClockEndTs = 0; } catch (_) {}
  try { BPState.soloRejoinActive = false; } catch (_) {}
  try {
    if (BPState.soloDialIv) { clearInterval(BPState.soloDialIv); BPState.soloDialIv = null; }
    if (BPState.soloDeadlineTimer) { clearTimeout(BPState.soloDeadlineTimer); BPState.soloDeadlineTimer = null; }
    if (BPState.soloOverlayIv) { clearInterval(BPState.soloOverlayIv); BPState.soloOverlayIv = null; }
  } catch (_) {}
  try { stopAfkWatch(); } catch (_) {}
  try { clearLiveMatch(); } catch (_) {}
  try { hideMatchRejoinPanel(); } catch (_) {}
  try { hideBoardDisconnectOverlay(); } catch (_) {}
  try { hideDisconnectBanner(); } catch (_) {}
  // Hard stop clocks even if we early-return later
  try {
    if (vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
    if (typeof clearDisconnectTimer === 'function') clearDisconnectTimer();
  } catch (_) {}
  if (!vsActive && document.getElementById('versusResult').classList.contains('visible')) {
    // Result UI already open — skip only if history was written recently
    try {
      if (BPState.matchEnded && Array.isArray(matchHistory) && matchHistory.length
          && (Date.now() - (matchHistory[0].date || 0)) < 120000) {
        return;
      }
    } catch (_) {
      BPState.matchEnded = true;
      return;
    }
  }
  // Prevent double end (disconnect + timer race) from applying trophies twice
  if (BPState.matchEnded && BPState.rankedDeltaApplied) {
    return;
  }
  BPState.matchEnded = true;
  // Do NOT leaveMatch here — server keeps room ~3 min for rematch; MatchClient.matchId required
  vsActive = false;
  try {
    // Stay in room mode until user leaves menu / starts unrelated flow
    if (typeof MatchClient !== 'undefined' && MatchClient.matchId) {
      roomMatchMode = true;
      BPState.roomMatchMode = true;
      postMatchOnlineEligible = true;
    } else {
      roomMatchMode = false;
      BPState.roomMatchMode = false;
    }
  } catch (_) {}
  try {
    document.body.classList.remove('rejoin-loading', 'match-ending');
  } catch (_) {}
  try {
    _oppPlaceAnimBusy = false;
    _pendingOppDeal = null;
    _pendingOppPlaces = [];
  } catch (_) {}
  try { mpMatchStarting = false; } catch (_) {}
  try { vsIntroLock = false; } catch (_) {}
  try { mpLoading = false; } catch (_) {}
  try { BPState.matchAwaitingGo = false; } catch (_) {}
  try { BPState.matchIntroSeqRunning = false; } catch (_) {}
  try { if (typeof setMpStatus === 'function') setMpStatus(''); } catch (_) {}
  try {
    if (typeof broadcastMyActivity === 'function') broadcastMyActivity(true);
  } catch (_) {}
  clearDisconnectTimer();
  if (vsTimerId) clearInterval(vsTimerId);
  if (aiInterval) clearInterval(aiInterval);
  const waitEl = document.getElementById('stuckWait');
  if (waitEl) waitEl.style.display = 'none';
  const oppWait = document.getElementById('oppStuckWait');
  if (oppWait) oppWait.style.display = 'none';
  hideDisconnectBanner();

  // Freeze timer display
  updateTimerDisplay();
  timerEl.classList.remove('urgent');

  const my = Math.max(0, score), opp = oppScore;
  let won, draw;
  if (opts.forceWin) {
    won = true; draw = false;
  } else if (opts.forceLoss) {
    won = false; draw = false;
  } else {
    won = my > opp;
    draw = my === opp;
  }
  if (!opts.quiet) {
    if (won) SFX.win();
    else if (!draw) SFX.lose();
    if (!draw && currentBot) showBotPhrase(won ? 'lose' : 'win');
  }
  const trophiesBefore = trophies;
  let delta = 0;
  // Keep online session eligible for rematch (menu / delayed result still works)
  if (vsModeType === 'online' && mpMode) {
    postMatchOnlineEligible = true;
    // Clear load/intro flags so a later opponent leave is soft (not "до старта")
    try { vsIntroLock = false; } catch (_) {}
    try { mpLoading = false; } catch (_) {}
    try { mpMatchStarting = false; } catch (_) {}
    try { clearMatchLoadState(); } catch (_) {}
    try { /* post-match link is MatchClient / roomMatchMode only */ } catch (_) {}
  } else {
    postMatchOnlineEligible = false;
  }
  // Trophies ONLY in ranked matchmaking — not bots, not lobby/friendly rooms
  const isRankedOnline = (vsModeType === 'online' && mpMode && (mpGameSource === 'ranked' || (!!mpFromMatchmaking && mpGameSource !== 'lobby')));
  let actualDelta = 0;
  if (BPState.rankedDeltaApplied) {
    // Already applied this match — keep displayed delta from lastMatchResult if any
    actualDelta = (lastMatchResult && typeof lastMatchResult.delta === 'number') ? lastMatchResult.delta : 0;
    delta = actualDelta;
  } else if (isRankedOnline) {
    const oppT = (typeof mpOppTrophies === 'number')
      ? mpOppTrophies
      : (lastMatchResult && typeof lastMatchResult.oppTrophies === 'number'
          ? lastMatchResult.oppTrophies : trophiesBefore);
    delta = calcOnlineTrophyDelta(won, draw, trophiesBefore, oppT, vsDuration);
    // Can't go below 0
    actualDelta = delta >= 0 ? delta : -Math.min(trophiesBefore, Math.abs(delta));
    trophies = Math.max(0, trophiesBefore + actualDelta);
    try { localStorage.setItem('bp_trophies', String(trophies)); } catch (_) {}
    try { if (typeof syncProfileToServer === 'function') syncProfileToServer({ trophies: trophies }); } catch (_) {}
    BPState.rankedDeltaApplied = true;
    // Ranked score record (best points in a single ranked match)
    if (my > rankedBest) {
      rankedBest = my;
      try { localStorage.setItem('bp_ranked_best', String(rankedBest)); } catch (_) {}
      // Persist the record in the account (achievements.ranked_best_score) — it used to be device-only
      try { achProgress.ranked_best_score = rankedBest | 0; saveAch(); } catch (_) {}
    }
    updateMenuStats();
  } else {
    actualDelta = 0;
    delta = 0;
  }

  trackMatchAchievements(won);

  // Stars for beating bots on each match duration
  let newStar = false;
  if (won && vsModeType === 'bots' && currentBot) {
    newStar = awardBotStar(currentBot.id, vsDuration);
  }

  const resultLabel = draw ? 'Ничья' : won ? 'Победа' : 'Поражение';
  const botCups = currentBot ? currentBot.trophies : 0;
  const wasRanked = !!(mpGameSource === 'ranked' || (mpFromMatchmaking && mpGameSource !== 'lobby'));
  try { window._lastMatchWasRanked = !!wasRanked; } catch (_) {}
  lastMatchResult = {
    result: resultLabel, won, draw, my, opp, oppName,
    delta: actualDelta, timeLeft: vsTimeLeft, duration: vsDuration,
    mode: wasRanked ? 'online' : (vsModeType === 'online' && mpMode ? 'friendly' : vsModeType),
    ranked: wasRanked,
    botId: currentBot && currentBot.id, date: Date.now(),
    oppTrophies: typeof mpOppTrophies === 'number' ? mpOppTrophies : null,
    moves: (matchLog || []).slice(),
    mySkinId: equippedSkinId || 'default',
    myBoardId: equippedBoardId || 'field_default',
    oppSkinId: (typeof window.mpOppSkinId === 'string' && window.mpOppSkinId) ? window.mpOppSkinId : null,
    oppBoardId: (typeof window.mpOppBoardId === 'string' && window.mpOppBoardId) ? window.mpOppBoardId : null,
    oppScore: opp,
    reason: (opts && opts.reason) ? String(opts.reason) : 'normal'
  };
  if (wasRanked) mpGameSource = 'ranked';
  else if (vsModeType === 'online' && mpMode) mpGameSource = 'lobby';

  matchHistory.unshift({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    opp: oppName,
    oppName,
    botId: currentBot ? currentBot.id : null,
    mySkinId: equippedSkinId || 'default',
    myBoardId: equippedBoardId || 'field_default',
    oppSkinId: (typeof window.mpOppSkinId === 'string' && window.mpOppSkinId) ? window.mpOppSkinId : null,
    oppBoardId: (typeof window.mpOppBoardId === 'string' && window.mpOppBoardId) ? window.mpOppBoardId : null,
    my, oppScore: opp, result: resultLabel, delta: actualDelta,
    mode: isRankedOnline ? 'online' : (vsModeType === 'online' && mpMode ? 'friendly' : vsModeType),
    difficulty: currentBot ? currentBot.name : '',
    duration: vsDuration, timeLeft: vsTimeLeft, date: Date.now(),
    reason: (opts && opts.reason) ? String(opts.reason) : 'normal',
    moves: (function () {
      let mv = (matchLog || []).slice();
      try {
        const hasDealMe = mv.some(e => e && e.type === 'deal' && e.side !== 'opp');
        const hasDealOpp = mv.some(e => e && e.type === 'deal' && e.side === 'opp');
        if (!hasDealMe && pieces && pieces.length && typeof clonePieceForLog === 'function') {
          mv.unshift({ type: 'deal', side: 'me', t: 0, pieces: pieces.map(clonePieceForLog) });
        }
        if (!hasDealOpp && oppPieces && oppPieces.length && typeof clonePieceForLog === 'function') {
          mv.unshift({ type: 'deal', side: 'opp', t: 0, pieces: oppPieces.map(clonePieceForLog) });
        }
      } catch (_) {}
      return (typeof normalizeMatchLogDealOrder === 'function') ? normalizeMatchLogDealOrder(mv) : mv;
    })()
  });
  // Keep last 30 matches (replays can be large)
  if (matchHistory.length > 30) matchHistory = matchHistory.slice(0, 30);
  try {
    localStorage.setItem('bp_history', JSON.stringify(matchHistory));
  } catch (e) {
    // Storage full — drop oldest replays
    matchHistory = matchHistory.slice(0, 15).map((h, i) => i < 10 ? h : { ...h, moves: [] });
    try { localStorage.setItem('bp_history', JSON.stringify(matchHistory)); } catch (_) {}
  }
  try { if (typeof scheduleHistorySync === 'function') scheduleHistorySync(); } catch (_) {}

  // Quiet end: no toast — clear frozen versus and return to menu
  if (opts.quiet) {
    try {
      BPState.resultDismissed = true;
      document.getElementById('versusResult').classList.remove('visible');
    } catch (_) {}
    try { document.body.classList.remove('replay-ui'); } catch (_) {}
    document.body.classList.remove('replay-playing');
    try { clearDisconnectTimer(); } catch (_) {}
    try { hideBoardDisconnectOverlay(); } catch (_) {}
    try { hideDisconnectBanner(); } catch (_) {}
    try { placingLock = false; } catch (_) {}
    try { updateMenuStats(); } catch (_) {}
    try {
      // Avoid frozen vs screen after dual-disconnect timer
      const vs = document.getElementById('screenVersus');
      if (vs && vs.classList.contains('active')) {
        showScreen('menu');
      }
    } catch (_) {}
    return;
  }

  let titleText = draw ? 'Ничья!' : won ? 'Победа!' : 'Поражение';
  if (opts.reason === 'disconnect' && won) titleText = 'Победа · соперник отключился';
  if (opts.reason === 'disconnect' && !won) titleText = 'Поражение · отключение';
  if (opts.reason === 'forfeit' && !won) titleText = 'Поражение · вы сдались';
  if (opts.reason === 'forfeit' && won) titleText = 'Победа · соперник сдался';
  if (opts.reason === 'afk' && draw) titleText = 'Ничья · АФК';
  if (opts.reason === 'afk' && !draw && !won) titleText = 'Поражение · АФК';
  if (opts.reason === 'afk' && !draw && won) titleText = 'Победа · соперник АФК';
  document.getElementById('vsTitle').textContent = titleText;
  document.getElementById('vsMyScore').textContent = my;
  document.getElementById('vsOppScore').textContent = opp;
  document.getElementById('vsOppLabel').textContent = oppName;
  const deltaEl = document.getElementById('vsTrophyDelta');
  deltaEl.className = 'trophy-line';
  if (vsModeType !== 'online') {
    if (won && currentBot) {
      const n = getBotStarCount(currentBot.id);
      const starRow = [60, 120, 180].map(sec =>
        botHasStar(currentBot.id, sec) ? '★' : '☆'
      ).join(' ');
      deltaEl.innerHTML = newStar
        ? `<span style="color:var(--trophy)">Новая звезда! ${starRow}</span><br><span class="muted" style="font-size:0.78rem">${n}/3 · ${currentBot.name}</span>`
        : `<span style="color:var(--text-dim)">${starRow}</span><br><span class="muted" style="font-size:0.78rem">${n}/3 · тренировка</span>`;
    } else {
      deltaEl.innerHTML = `<span class="muted">Тренировочный бой</span>`;
    }
  } else if (!isRankedOnline) {
    deltaEl.innerHTML = `<span class="muted">Товарищеский матч · без трофеев</span>`;
  } else {
    const sign = actualDelta > 0 ? '+' : actualDelta < 0 ? '−' : '+';
    const abs = Math.abs(actualDelta);
    const color = actualDelta > 0 ? 'var(--trophy)' : actualDelta < 0 ? 'var(--danger)' : 'var(--text-dim)';
    const oppTShow = typeof mpOppTrophies === 'number' ? mpOppTrophies : '—';
    deltaEl.innerHTML = `🏆 ${trophiesBefore} <span style="color:${color}">${sign} ${abs}</span> → <strong>${trophies}</strong>` +
      `<div class="muted" style="font-size:0.75rem;margin-top:4px">соперник 🏆 ${oppTShow}</div>`;
  }

  const timeInfo = document.getElementById('vsTimeLeftInfo');
  if (vsTimeLeft <= 0) timeInfo.textContent = (typeof globalThis.t==='function'?globalThis.t('js.timeUp','Время вышло'):'Время вышло');
  else timeInfo.textContent = (typeof globalThis.t==='function'?globalThis.t('js.timeLeft','Осталось времени: {t}',{t:formatTimeLeft(vsTimeLeft)}):('Осталось времени: '+formatTimeLeft(vsTimeLeft)));

  // Prepare review bar
  const reviewTitle = document.getElementById('reviewTitle');
  const reviewMeta = document.getElementById('reviewMeta');
  reviewTitle.textContent = resultLabel + (delta ? ` · ${delta > 0 ? '+' : ''}${delta} 🏆` : '');
  reviewMeta.textContent = (typeof globalThis.t==='function'?globalThis.t('js.you','Ты'):'Ты') + ' ' + my + ' — ' + opp + ' ' + oppName + ' · ' + (typeof globalThis.t==='function'?globalThis.t('js.timeLeft','Осталось времени: {t}',{t:formatTimeLeft(vsTimeLeft)}):('Осталось времени: '+formatTimeLeft(vsTimeLeft)));

  const liveCtrl = document.getElementById('vsLiveControls');
  const footer = document.getElementById('vsFooter');
  const piecesVs = document.getElementById('piecesAreaVs');
  if (liveCtrl) liveCtrl.style.display = 'none';
  if (footer) footer.style.display = 'none';
  if (piecesVs) { piecesVs.style.opacity = '0.35'; piecesVs.style.pointerEvents = 'none'; }
  document.body.classList.add('replay-ui');
  const fbEnd = document.getElementById('btnForfeit');
  if (fbEnd) fbEnd.style.display = 'none';

  // Do NOT clear rematchTheyWant / pending offer here — invite may already be in flight
  rematchIWant = false;
  rematchPending = false;

  // 1) Freeze overlay so players see the match stopped
  // 2) Score duel count-up
  // 3) Result modal
  // (lobby invite accepted mid-match: join only after player goes to main menu)
  BPState.resultDismissed = false;
  const resultEpoch = ++resultModalEpoch;
  if (resultModalSafetyTimer) {
    try { clearTimeout(resultModalSafetyTimer); } catch (_) {}
    resultModalSafetyTimer = null;
  }
  const showResultModal = () => {
    // User already closed result / left to menu — do not re-open
    if (resultEpoch !== resultModalEpoch || BPState.resultDismissed) return;
    try {
      const active = document.querySelector('.screen.active');
      // Only force-show while still on versus (or no active screen yet)
      if (active && active.id && active.id !== 'screenVersus') return;
    } catch (_) {}
    try { hideMatchEndFreeze(); } catch (_) {}
    try { configurePostMatchButtons(); } catch (_) {}
    document.getElementById('versusResult').classList.add('visible');
    // Flush rematch invite that arrived during score duel (or just before)
    try { tryShowPendingRematchOffer(); } catch (_) {}
  };
  const runScoreDuelThenResult = () => {
    if (resultEpoch !== resultModalEpoch || BPState.resultDismissed) return;
    try {
      const p = showScoreDuel(my, opp, won, draw, oppName, currentBot);
      if (p && typeof p.then === 'function') {
        p.then(showResultModal).catch(() => { showResultModal(); });
      } else {
        showResultModal();
      }
    } catch (_) {
      showResultModal();
    }
  };
  try {
    // Sequence: Матч окончен (freeze) → подсчёт (score duel) → окно результата
    const freezeP = showMatchEndFreeze({
      reason: (opts && opts.reason) ? String(opts.reason) : 'normal',
      timeUp: vsTimeLeft <= 0,
      timeLeft: vsTimeLeft,
      my, opp, won, draw,
      ms: (opts && opts.reason === 'forfeit') ? 2000 : 2600
    });
    if (freezeP && typeof freezeP.then === 'function') {
      freezeP.then(runScoreDuelThenResult).catch(runScoreDuelThenResult);
    } else {
      runScoreDuelThenResult();
    }
    // Safety: freeze + duel (~5s) then force result
    resultModalSafetyTimer = setTimeout(() => {
      resultModalSafetyTimer = null;
      try {
        if (resultEpoch !== resultModalEpoch || BPState.resultDismissed) return;
        const r = document.getElementById('versusResult');
        if (r && !r.classList.contains('visible') && BPState.matchEnded) showResultModal();
      } catch (_) {}
    }, 7000);
  } catch (_) {
    runScoreDuelThenResult();
  }
}

function enterReviewMode() {
  document.getElementById('versusResult').classList.remove('visible');
  const reviewBar = document.getElementById('reviewBar');
  reviewBar.classList.add('replay-dock');
  reviewBar.classList.add('visible');
  document.getElementById('reviewTitle').textContent = '';
  document.getElementById('reviewMeta').textContent = '';
  reviewBar.querySelector('.controls').innerHTML = `
    <button type="button" class="primary" data-review-action="result" title="Результат">🏆</button>
    <button type="button" class="ghost" data-review-action="again" title="Ещё матч">↻</button>
    <button type="button" class="ghost" data-review-action="menu" title="В меню">☰</button>
  `;
  document.body.classList.add('replay-ui');
  const fb = document.getElementById('btnForfeit');
  if (fb) fb.style.display = 'none';
  showScreen('versus');
  // Rebuild boards so cells are never empty after forfeit/reload
  try {
    if (!grid || !grid.length) grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    if (!oppGrid || !oppGrid.length) oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    if (typeof boardMe !== 'undefined' && boardMe) {
      if (!boardMe.children || boardMe.children.length !== SIZE * SIZE) createBoardDOM(boardMe);
      renderGrid(grid, boardMe);
    }
    if (typeof boardOpp !== 'undefined' && boardOpp) {
      if (!boardOpp.children || boardOpp.children.length !== SIZE * SIZE) createBoardDOM(boardOpp);
      renderGrid(oppGrid, boardOpp);
    }
    try {
      const area = document.getElementById('piecesAreaVs');
      if (area && pieces && pieces.length && typeof renderPieces === 'function') renderPieces(area);
    } catch (_) {}
    try {
      if (oppPieces && oppPieces.length && typeof renderOppPieces === 'function') renderOppPieces();
    } catch (_) {}
    applyEquippedBoard();
    applyEquippedSkin();
    if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
    if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
    applyBoardScales();
    requestAnimationFrame(() => { try { applyBoardScales(); } catch (_) {} });
  } catch (e) {
    console.warn('enterReviewMode boards', e);
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (!matchHistory.length) {
    list.innerHTML = '<div class="history-empty">Пока нет матчей. Сыграй в соревновании!</div>';
    return;
  }
  list.innerHTML = matchHistory.map((h, idx) => {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const isOnline = h.mode === 'online';
    const isFriendly = h.mode === 'friendly';
    const modeStr = isOnline ? '🌐 Рейтинг' : isFriendly ? '🤝 Товарищеский' : `🤖 ${h.difficulty || h.oppName || 'Бот'}`;
    const durStr = h.duration === 60 ? '1м' : h.duration === 180 ? '3м' : '2м';
    const cls = h.result === 'Победа' ? 'win' : h.result === 'Поражение' ? 'lose' : 'draw';
    const hasReplay = h.moves && h.moves.length;
    const bot = h.botId ? BOTS.find(b => b.id === h.botId) : null;
    const av = bot ? botAvatarHTML(bot, 22) : '';
    // Strip trophy suffixes from stored names (legacy)
    const oppLabel = (h.oppName || h.opp || 'Соперник').toString()
      .replace(/\s*\(\s*\d+\s*🏆\s*\)\s*/g, '')
      .replace(/\s*\d+\s*🏆\s*/g, '')
      .trim() || 'Соперник';
    let rightExtra = '';
    const deltaN = (typeof h.delta === 'number') ? h.delta : 0;
    // Ranked online: show trophy gains and losses
    if (isOnline && deltaN !== 0) {
      if (deltaN > 0) {
        rightExtra = `<span class="hi-delta up">🏆 +${deltaN}</span>`;
      } else {
        rightExtra = `<span class="hi-delta down">🏆 −${Math.abs(deltaN)}</span>`;
      }
    } else if (bot) {
      const st = botStars[bot.id] || {};
      rightExtra = '<span class="hi-stars" title="Серебряные звёзды 1/2/3 мин">' +
        [60, 120, 180].map(sec =>
          `<span class="${st[String(sec)] ? 'on' : ''}">☆</span>`
        ).join('') + '</span>';
    } else {
      // Friendly / zero-delta ranked: no trophy line
      rightExtra = '';
    }
    return `<div class="history-item" data-hist="${idx}">
      <div class="hi-left">
        <div class="hi-opp" style="display:flex;align-items:center;gap:6px">${av}<span>vs ${oppLabel}</span></div>
        <div class="hi-meta">${modeStr} · ${durStr} · ${h.my}:${h.oppScore} · ${dateStr}</div>
        ${hasReplay ? '<div class="hi-replay">▶ Смотреть повтор</div>' : '<div class="hi-meta">Повтор недоступен</div>'}
      </div>
      <div class="hi-result ${cls}">${h.result}<br>${rightExtra}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const h = matchHistory[parseInt(item.dataset.hist, 10)];
      if (h && h.moves && h.moves.length) startReplay(h, { from: 'history' });
      else {
        try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
      }
    });
  });
}
