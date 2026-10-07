/**
 * Block Puzzle — js/11-lobby-versus-replay/02-versus-start.js
 * Online matchmaking and versus start.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function startOnlineMatchmaking() {
  try { document.body.classList.remove('vs-bots'); } catch (_) {}
  try { clearBotMatchResidue && clearBotMatchResidue(); } catch (_) {}
  try { currentBot = null; } catch (_) {}
  if (!checkCrossPlatformReady()) return;
  // Prefer authoritative room server when MatchClient is available
  if (typeof MatchClient !== 'undefined') {
    try { bindMatchClientHandlers(); } catch (_) {}
    const searchGen = ++mmSearchGen;
    const selectedDuration = (vsDuration === 60 || vsDuration === 120 || vsDuration === 180) ? vsDuration : 120;
    vsDuration = selectedDuration;
    vsTimeLeft = selectedDuration;
    try { BPState.leftForRankedSearch = Date.now(); } catch (_) {}
    try { closeRoomLobby(); } catch (_) {}
    // Soft reset — don't leave queue after we join
    try {
      mpRoomCode = null;
      mpMode = false;
      mpRole = null;
      mpReady = false;
      mpOppReady = false;
      mpOppConnected = false;
    } catch (_) {}
    try {
      if (BPState.roomExpandIv) { clearInterval(BPState.roomExpandIv); BPState.roomExpandIv = null; }
    } catch (_) {}
    mmActive = true;
    mmFound = false;
    roomMatchMode = false;
    BPState.roomMatchMode = false;
    mpFromMatchmaking = true;
    mpGameSource = 'ranked';
    vsModeType = 'online';
    postMatchOnlineEligible = false;
    try { BPState.matchEnded = false; BPState.rankedDeltaApplied = false; } catch (_) {}
    showScreen('match');
    mmSetStatus('Ищем игроков (ПК + телефон)…', 'Кроссплей');
    let clientId = null;
    try { clientId = localStorage.getItem('bp_client_id'); } catch (_) {}
    if (!clientId) {
      clientId = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem('bp_client_id', clientId); } catch (_) {}
    }
    MatchClient.joinQueue({
      name: myNickname,
      trophies: trophies | 0,
      skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
      boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
      avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
      avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
      duration: selectedDuration,
      expandLevel: 0,
      clientId
    });
    // Expand skill gap over time (same as old online bands)
    let expand = 0;
    if (BPState.roomExpandIv) { try { clearInterval(BPState.roomExpandIv); } catch (_) {} }
    BPState.roomExpandIv = setInterval(() => {
      if (!mmActive || mmFound || searchGen !== mmSearchGen) {
        clearInterval(BPState.roomExpandIv);
        BPState.roomExpandIv = null;
        return;
      }
      expand = Math.min(3, expand + 1);
      MatchClient.expandQueue(expand);
      mmSetStatus('Ищем игроков…', 'Расширяем диапазон');
    }, 5000);
    return;
  }
  // online ranked removed — MatchClient required
  alert('Клиент матчей не загрузился. Обнови страницу.');
  return;
}


function startMatchFlow() {
  const lobbyEl = document.getElementById('roomLobby');
  const lobbyOpen = !!(lobbyEl && lobbyEl.classList.contains('visible'));
  // Only treat as private lobby when we actually have a room code / lobby source
  const inLobbySession = !!(mpRoomCode || mpGameSource === 'lobby');

  // Private lobby (server rooms): match starts when both press Ready — not from this button
  if (inLobbySession && vsModeType !== 'bots') {
    try {
      setMpStatus(mpOppConnected
        ? 'Оба нажмите «Готов» в лобби'
        : 'Ждём соперника по коду комнаты');
    } catch (_) {}
    try { if (lobbyOpen) updateLobbyUI && updateLobbyUI(); else openRoomLobby && openRoomLobby(); } catch (_) {}
    return;
  }

  // Ranked search
  if (vsModeType === 'online' && !currentBot) {
    startOnlineMatchmaking();
    return;
  }
  // Bots — always offline local match
  try { closeRoomLobby(); } catch (_) {}
  try { stopMatchmaking(true); } catch (_) {}
  roomMatchMode = false;
  BPState.roomMatchMode = false;
  mpMode = false;
  mpRoomCode = null;
  mpGameSource = null;
  currentBot = (typeof BOTS !== 'undefined' && BOTS)
    ? (BOTS.find(b => b.id === selectedBotId) || BOTS[5] || BOTS[0])
    : null;
  oppName = currentBot ? currentBot.name : 'Бот';
  vsModeType = 'bots';
  try { document.body.classList.add('vs-bots'); } catch (_) {}
  beginVersusMatch();
}
function beginVersusMatch() {
  try { clearBoardScoreFX(); } catch (_) {}
  // Bot match must not inherit leftover multiplayer flags from a previous online game
  try {
    // Soft-clear MP without relying on session teardown
    clearMpJoinTimer();
  } catch (_) {}
  mpMode = false;
  mpRole = null;
  mpRoomCode = null;
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  mpMatchStarting = false;
  mpFromMatchmaking = false;
  try { if (typeof mpPendingJoin !== 'undefined') mpPendingJoin = null; } catch (_) {}
  try { if (typeof mpExpectedJoinCode !== 'undefined') mpExpectedJoinCode = null; } catch (_) {}
  try { BPState.matchEnded = false; BPState.rankedDeltaApplied = false; } catch (_) {}
  vsModeType = 'bots';
  mode = 'versus';
  rematchIWant = false;
  rematchTheyWant = false;
  rematchPending = false;
  pendingRematchOfferName = null;
  if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }

  showScreen('versus');
  document.body.classList.remove('replay-ui');
  document.body.classList.remove('replay-playing');
  const fb = document.getElementById('btnForfeit');
  if (fb) fb.style.display = '';
  grid = Array.from({length:SIZE},()=>Array(SIZE).fill(null));
  oppGrid = Array.from({length:SIZE},()=>Array(SIZE).fill(null));
  score = 0; oppScore = 0; vsTimeLeft = vsDuration;
  BPState.matchEnded = false;
  vsActive = true; placingLock = false; aiBusy = false;
  playerStuck = false; aiStuck = false;
  clearChain = 0; oppClearChain = 0;
  oppPieces = [];
  matchLog = [];
  matchStartTs = Date.now();
  replayMode = false;
  if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
  const waitEl = document.getElementById('stuckWait');
  if (waitEl) waitEl.style.display = 'none';
  const oppWait = document.getElementById('oppStuckWait');
  if (oppWait) oppWait.style.display = 'none';
  const reviewBar = document.getElementById('reviewBar');
  if (reviewBar) reviewBar.classList.remove('visible');
  const liveCtrl = document.getElementById('vsLiveControls');
  if (liveCtrl) liveCtrl.style.display = '';
  const footer = document.getElementById('vsFooter');
  if (footer) footer.style.display = '';
  const piecesVs = document.getElementById('piecesAreaVs');
  if (piecesVs) { piecesVs.style.opacity = '1'; piecesVs.style.pointerEvents = ''; }
  document.getElementById('versusResult').classList.remove('visible');
  hideRematchOffer();
  hideRematchWait();
  try { closeRoomLobby(); } catch (_) {}
  createBoardDOM(boardMe); createBoardDOM(boardOpp);
  applyBoardScales();
  try { window.mpOppSkinId = null; } catch (_) {}
  try { document.body.classList.add('vs-bots'); } catch (_) {}
  try { clearOppSkin(); } catch (_) {}
  try { applyOppSkin('default'); } catch (_) {}
  try { applyEquippedBoard(); } catch (_) {}
  try {
    window.mpOppBoardId = 'field_default';
    applyOppBoard('field_default');
  } catch (_) {}
  renderGrid(grid, boardMe); renderGrid(oppGrid, boardOpp);
  document.getElementById('myScore').textContent = '0';
  document.getElementById('oppScore').textContent = '0';
  if (!currentBot) currentBot = BOTS.find(b => b.id === selectedBotId) || BOTS[0] || BOTS[5];
  if (!currentBot && BOTS.length) currentBot = BOTS[0];
  oppName = (currentBot && currentBot.name) || 'Бот';
  document.getElementById('oppName').innerHTML =
    `${botAvatarHTML(currentBot, 24)} <span>${escapeHtmlLobby(oppName)}</span>` +
    (currentBot && typeof currentBot.trophies === 'number'
      ? `<span style="opacity:0.85;font-weight:700;font-size:0.72rem;margin-left:5px;color:var(--trophy);flex-shrink:0;white-space:nowrap">🏆 ${currentBot.trophies}</span>`
      : '');
  try { updateVersusNameLabels(); } catch (_) {}
  document.getElementById('trophiesLive').textContent = trophies;
  const speechEl = document.getElementById('botSpeech');
  if (speechEl) speechEl.classList.remove('visible');
  updateTimerDisplay();
  generatePieces(piecesAreaVs || piecesVs);
  // generatePieces already logs deal('me') when vsActive — do not double-log
  if (!matchLog.some(e => e && e.type === 'deal' && e.side === 'me')) {
    try { logDeal('me', pieces); } catch (_) {}
  }
  oppPieces = [randomBotPiece(), randomBotPiece(), randomBotPiece()];
  renderOppPieces();
  logDeal('opp', oppPieces);
  updateBoardMetrics(boardMe);
  // Brief ready lock — board is already drawn; clocks start after intro
  vsActive = false;
  placingLock = true;
  if (vsTimerId) clearInterval(vsTimerId);
  if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
  const botLabel = (currentBot && currentBot.name) ? currentBot.name : 'Бот';
  const durLabel = vsDuration === 60 ? '1 мин' : vsDuration === 180 ? '3 мин' : '2 мин';
  const unlockBotMatch = () => {
    if (mode !== 'versus') return;
    vsActive = true;
    placingLock = false;
    try { BPState.rejoinLoading = false; BPState.rejoinInputLock = false; } catch (_) {}
    BPState.matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
    try { startMatchWallClock(BPState.matchClockEndTs); } catch (_) {}
    const combat = (typeof resolveBotCombat === 'function' && currentBot)
      ? resolveBotCombat(currentBot)
      : currentBot;
    let base = (combat && combat.interval) || (currentBot && currentBot.interval) || 1400;
    if (!Number.isFinite(base) || base < 400) base = 1400;
    let jitter = (combat && combat.style && combat.style.speedJitter)
      || (currentBot && currentBot.style && currentBot.style.speedJitter) || 0.25;
    if (!Number.isFinite(jitter) || jitter < 0) jitter = 0.25;
    const onPhone = typeof isTouchUiClient === 'function' ? isTouchUiClient() : false;
    // Low floor so high-trophy bots can be fast; weak stay slow via base interval
    const floor = onPhone ? 520 : 420;
    const scale = onPhone ? 1.06 : 1.0;
    let tickMs = Math.max(floor, Math.round(base * scale + Math.random() * (base * jitter)));
    if (!Number.isFinite(tickMs) || tickMs < floor) tickMs = floor;
    aiTickMs = tickMs;
    aiBusy = false;
    try { aiBusySince = 0; } catch (_) {}
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
    // Primary loop — sole regular driver of bot pace
    aiInterval = setInterval(() => {
      try { aiTick(); } catch (e) {
        console.warn('aiTick', e);
        aiBusy = false;
        try { aiBusySince = 0; } catch (_) {}
      }
    }, tickMs);
    // First move: weak bots delay more, strong start sooner
    const firstDelay = Math.min(tickMs, Math.max(floor, Math.round(tickMs * 0.55)));
    setTimeout(() => { try { aiTick(); } catch (_) {} }, firstDelay);
    setTimeout(() => { try { showBotPhrase('start'); } catch (_) {} }, 400);
  };
  showMatchIntro({
    label: 'Загрузка',
    title: 'Почти готово…',
    sub: botLabel + ' · ' + durLabel,
    goText: 'Старт!',
    ms: 1400
  }).then(unlockBotMatch).catch(unlockBotMatch);
  // Safety: never leave player locked if intro hangs
  setTimeout(() => {
    if (mode === 'versus' && vsModeType === 'bots' && !vsActive) unlockBotMatch();
  }, 2800);
}
