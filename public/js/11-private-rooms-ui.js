/**
 * Block Puzzle — 11-private-rooms-ui.js
 * Private lobbies, settings sliders, remaining online UI
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

function bindPrivateLobbyHandlers() {
  if (_privateLobbyHandlersBound || typeof MatchClient === 'undefined') return;
  _privateLobbyHandlersBound = true;

  MatchClient.on('open', () => {
    try { ensureFriendPresence(); } catch (_) {}
  });
  try { ensureFriendPresence(); } catch (_) {}

  MatchClient.on('private_lobby', (data) => {
    try {
      mpMode = true;
      mpGameSource = 'lobby';
      vsModeType = 'online';
      mpRoomCode = data.code || mpRoomCode;
      mpRole = data.role || mpRole;
      mpLobbyDuration = data.duration || mpLobbyDuration || 120;
      if (data.role === 'host') {
        mpReady = !!data.hostReady;
        mpOppReady = !!data.guestReady;
      } else {
        mpReady = !!data.guestReady;
        mpOppReady = !!data.hostReady;
      }
      if (data.opp) {
        mpOppConnected = true;
        mpOppName = data.opp.name || 'Соперник';
        oppName = mpOppName;
        if (typeof data.opp.trophies === 'number') mpOppTrophies = data.opp.trophies | 0;
        try {
          if (data.opp.skinId) {
            window.mpOppSkinId = data.opp.skinId;
            if (typeof applyOppSkin === 'function') applyOppSkin(data.opp.skinId);
          }
          if (data.opp.boardId) {
            window.mpOppBoardId = data.opp.boardId;
            if (typeof applyOppBoard === 'function') applyOppBoard(data.opp.boardId);
          }
          if (data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
          if (data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
        } catch (_) {}
      } else {
        mpOppConnected = false;
        mpOppName = null;
      }
      // Dual ping from server snapshot
      try {
        if (data.role === 'host') {
          if (typeof data.hostRtt === 'number') window._lobbyMeRtt = data.hostRtt;
          if (typeof data.guestRtt === 'number') window._lobbyOppRtt = data.guestRtt;
          else if (data.opp && typeof data.opp.rtt === 'number') window._lobbyOppRtt = data.opp.rtt;
        } else {
          if (typeof data.guestRtt === 'number') window._lobbyMeRtt = data.guestRtt;
          if (typeof data.hostRtt === 'number') window._lobbyOppRtt = data.hostRtt;
          else if (data.opp && typeof data.opp.rtt === 'number') window._lobbyOppRtt = data.opp.rtt;
        }
      } catch (_) {}
      setMpStatus(mpOppConnected
        ? ('Комната ' + mpRoomCode + ' · соперник в лобби')
        : ('Комната ' + mpRoomCode + ' · ждут игрока'));
      try { openRoomLobby(); } catch (_) {}
      try { updateLobbyUI && updateLobbyUI(); } catch (_) {}
      // Reflect ready button
      try {
        const readyBtn = document.getElementById('btnLobbyReady');
        if (readyBtn) readyBtn.classList.toggle('ready', !!mpReady);
      } catch (_) {}
      try {
        document.querySelectorAll('.lobby-dur').forEach(btn => {
          btn.classList.toggle('selected', parseInt(btn.dataset.sec, 10) === mpLobbyDuration);
        });
      } catch (_) {}
    } catch (e) { console.warn('private_lobby', e); }
  });

  MatchClient.on('private_error', (data) => {
    try {
      const reason = (data && data.reason) || 'error';
      const map = {
        not_found: 'Комната не найдена',
        full: 'Комната заполнена',
        self: 'Нельзя войти в свою комнату',
        in_match: 'Уже в матче',
        not_in_lobby: 'Не в лобби'
      };
      setMpStatus(map[reason] || ('Ошибка: ' + reason));
      if (reason === 'not_found' || reason === 'full') {
        try { failJoinRoom(map[reason] || reason, true); } catch (_) {}
      }
    } catch (e) { console.warn('private_error', e); }
  });

  MatchClient.on('private_closed', (data) => {
    try {
      setMpStatus('Хост закрыл комнату');
      try { closeRoomLobby(); } catch (_) {}
      mpOppConnected = false;
      mpMode = false;
    } catch (_) {}
  });

  MatchClient.on('private_left', () => {
    try { closeRoomLobby(); } catch (_) {}
  });

  MatchClient.on('presence_state', (data) => {
    try {
      if (!data || !data.friends) return;
      for (const code of Object.keys(data.friends)) {
        const info = data.friends[code];
        if (info && info.online) {
          try { setFriendPresence(code, 'online'); } catch (_) {}
          if (info.activity) try { setFriendActivity(code, info.activity); } catch (_) {}
          if (typeof info.trophies === 'number') {
            const f = (friends || []).find(x => x.code === code);
            if (f) { f.trophies = info.trophies; try { saveFriends(); } catch (_) {} }
          }
        } else {
          try { setFriendPresence(code, 'offline'); } catch (_) {}
        }
      }
      try { renderFriends && renderFriends(); } catch (_) {}
    } catch (e) { console.warn('presence_state', e); }
  });

  MatchClient.on('social_msg', (data) => {
    try {
      const msg = (data && data.msg) ? data.msg : data;
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case 'friend_req':
          handleIncomingFriendReq(msg, null);
          break;
        case 'friend_req_cancel':
          try { clearFriendRequestState(normalizeFriendCode(msg.code || msg.from)); } catch (_) {}
          try { renderFriendRequests(); renderOutgoingPending(); } catch (_) {}
          break;
        case 'friend_req_ack':
          try { updateOutgoingPendingName(normalizeFriendCode(msg.code || msg.from), msg.name); } catch (_) {}
          break;
        case 'friend_accept':
          try { applyIncomingFriendAccept(msg); } catch (_) {}
          break;
        case 'friend_decline':
          try { applyIncomingFriendDecline(msg); } catch (_) {}
          break;
        case 'friend_remove':
          try { applyRemoteFriendRemove(msg); } catch (_) {}
          break;
        case 'challenge':
          try { handleIncomingChallenge(msg, null); } catch (_) {}
          break;
        case 'challenge_cancel':
          try {
            if (typeof hideChToast === 'function') hideChToast(false);
            chPending = null;
          } catch (_) {}
          break;
        case 'challenge_decline':
          try {
            clearLobbyInviteWait(normalizeFriendCode(msg.code || msg.from), msg.room);
            setMpStatus('Вызов отклонён');
          } catch (_) {}
          break;
        case 'challenge_accept':
          try {
            clearLobbyInviteWait(normalizeFriendCode(msg.code || msg.from), msg.room);
            setMpStatus('Друг принял вызов');
          } catch (_) {}
          break;
        default:
          break;
      }
    } catch (e) { console.warn('social_msg', e); }
  });

  // Extra lobby marker (primary handler already starts the match)
  MatchClient.on('match_found', (data) => {
    try {
      if (data && data.source === 'lobby') {
        mpGameSource = 'lobby';
        mpFromMatchmaking = false;
      }
    } catch (_) {}
  });
}
try { bindPrivateLobbyHandlers(); } catch (_) {}


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
    try { window._leftForRankedSearch = Date.now(); } catch (_) {}
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
      if (window._roomExpandIv) { clearInterval(window._roomExpandIv); window._roomExpandIv = null; }
    } catch (_) {}
    mmActive = true;
    mmFound = false;
    roomMatchMode = false;
    window._roomMatchMode = false;
    mpFromMatchmaking = true;
    mpGameSource = 'ranked';
    vsModeType = 'online';
    postMatchOnlineEligible = false;
    try { window._matchEnded = false; window._rankedDeltaApplied = false; } catch (_) {}
    showScreen('match');
    mmSetStatus('Ищем игроков в очереди…', 'Сервер матчей');
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
    if (window._roomExpandIv) { try { clearInterval(window._roomExpandIv); } catch (_) {} }
    window._roomExpandIv = setInterval(() => {
      if (!mmActive || mmFound || searchGen !== mmSearchGen) {
        clearInterval(window._roomExpandIv);
        window._roomExpandIv = null;
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
  window._roomMatchMode = false;
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
  try { window._matchEnded = false; window._rankedDeltaApplied = false; } catch (_) {}
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
  window._matchEnded = false;
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
    `${botAvatarHTML(currentBot, 24)} <span>${oppName}</span>` +
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
    try { window._rejoinLoading = false; window._rejoinInputLock = false; } catch (_) {}
    window._matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
    try { startMatchWallClock(window._matchClockEndTs); } catch (_) {}
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
  if (mpMode && (roomMatchMode || window._roomMatchMode)) return; // never drive AI in live ranked room
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
  if (mpMode && (roomMatchMode || window._roomMatchMode) && typeof MatchClient !== 'undefined') {
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
  if (roomMatchMode || window._roomMatchMode) {
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
  if (mode !== 'versus' && !(roomMatchMode || window._roomMatchMode)) return;
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
    if (isOnVersusScreen() && (vsActive || window._mpRejoiningMatch || window._soloRejoinActive)) return false;
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

function endVersus(opts) {
  opts = opts || {};
  try { window._matchClockEndTs = 0; } catch (_) {}
  try { window._soloRejoinActive = false; } catch (_) {}
  try {
    if (window._soloDialIv) { clearInterval(window._soloDialIv); window._soloDialIv = null; }
    if (window._soloDeadlineTimer) { clearTimeout(window._soloDeadlineTimer); window._soloDeadlineTimer = null; }
    if (window._soloOverlayIv) { clearInterval(window._soloOverlayIv); window._soloOverlayIv = null; }
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
      if (window._matchEnded && Array.isArray(matchHistory) && matchHistory.length
          && (Date.now() - (matchHistory[0].date || 0)) < 120000) {
        return;
      }
    } catch (_) {
      window._matchEnded = true;
      return;
    }
  }
  // Prevent double end (disconnect + timer race) from applying trophies twice
  if (window._matchEnded && window._rankedDeltaApplied) {
    return;
  }
  window._matchEnded = true;
  // Do NOT leaveMatch here — server keeps room ~3 min for rematch; MatchClient.matchId required
  vsActive = false;
  try {
    // Stay in room mode until user leaves menu / starts unrelated flow
    if (typeof MatchClient !== 'undefined' && MatchClient.matchId) {
      roomMatchMode = true;
      window._roomMatchMode = true;
      postMatchOnlineEligible = true;
    } else {
      roomMatchMode = false;
      window._roomMatchMode = false;
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
  if (window._rankedDeltaApplied) {
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
    window._rankedDeltaApplied = true;
    // Ranked score record (best points in a single ranked match)
    if (my > rankedBest) {
      rankedBest = my;
      try { localStorage.setItem('bp_ranked_best', String(rankedBest)); } catch (_) {}
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

  // Quiet end: no toast — clear frozen versus and return to menu
  if (opts.quiet) {
    try {
      window._resultDismissed = true;
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
      deltaEl.innerHTML = `<span class="muted">Тренировка · без трофеев</span>`;
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
  if (vsTimeLeft <= 0) timeInfo.textContent = 'Время вышло';
  else timeInfo.textContent = `Осталось времени: ${formatTimeLeft(vsTimeLeft)}`;

  // Prepare review bar
  const reviewTitle = document.getElementById('reviewTitle');
  const reviewMeta = document.getElementById('reviewMeta');
  reviewTitle.textContent = resultLabel + (delta ? ` · ${delta > 0 ? '+' : ''}${delta} 🏆` : '');
  reviewMeta.textContent = `Ты ${my} — ${opp} ${oppName} · осталось ${formatTimeLeft(vsTimeLeft)}`;

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
  window._resultDismissed = false;
  const resultEpoch = ++resultModalEpoch;
  if (resultModalSafetyTimer) {
    try { clearTimeout(resultModalSafetyTimer); } catch (_) {}
    resultModalSafetyTimer = null;
  }
  const showResultModal = () => {
    // User already closed result / left to menu — do not re-open
    if (resultEpoch !== resultModalEpoch || window._resultDismissed) return;
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
    if (resultEpoch !== resultModalEpoch || window._resultDismissed) return;
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
        if (resultEpoch !== resultModalEpoch || window._resultDismissed) return;
        const r = document.getElementById('versusResult');
        if (r && !r.classList.contains('visible') && window._matchEnded) showResultModal();
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
  window._repChainMe = 0;
  window._repChainOpp = 0;
  // Backup current cosmetics; restore when leaving replay
  try {
    window._replaySkinBackup = equippedSkinId;
    window._replayBoardBackup = equippedBoardId;
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
      ? `${botAvatarHTML(bot, 24)} <span>${match.oppName || match.opp}</span>`
      : `<span>${match.oppName || match.opp}</span>`;
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
  document.getElementById('reviewTitle').textContent = `Повтор · ${match.result}`;
  document.getElementById('reviewMeta').textContent = `Событие ${replayIndex} / ${match.moves.length} · 0:0`;
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

function resetReplay() {
  if (!replayData) return;
  stopReplayPlay();
  rebuildReplayTo(replayMinIndex(replayData.moves), true);
}

/** Rebuild state after applying events [0 .. end) */
function rebuildReplayTo(end, animateDeals = false) {
  if (!replayData) return;
  replayBusy = false;
  clearReplayEffects();

  const minIdx = replayMinIndex(replayData.moves);
  end = Math.max(minIdx, Math.min(end, replayData.moves.length));

  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  createBoardDOM(boardMe);
  createBoardDOM(boardOpp);

  replayMePieces = [];
  replayOppPieces = [];
  document.getElementById('piecesAreaVs').innerHTML = '';
  const oa = document.getElementById('piecesAreaOpp');
  if (oa) oa.innerHTML = '';

  // Trays from deals + place shapes (place wins) — fixes wrong first hands when opp moved first
  try { rebuildReplayTraysFromMoves(replayData.moves, end); } catch (_) {
    try { applyOpeningReplayHands(replayData.moves, false); } catch (_) {}
  }

  let my = 0, opp = 0;
  for (let i = 0; i < end; i++) {
    const m = replayData.moves[i];
    if (!m) continue;
    if (m.type === 'deal' || m.type === 'Deal') {
      // Tray already built by rebuildReplayTraysFromMoves; optional soft anim on bootstrap deals
      if (animateDeals && i < minIdx) {
        try {
          if (m.side === 'opp') renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, true);
          else renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, true);
        } catch (_) {}
      }
    } else if (m.type === 'place' || m.shape) {
      const placeSide = m.side === 'opp' ? 'opp' : 'me';
      const g = placeSide === 'me' ? grid : oppGrid;
      const placeShape = Array.isArray(m.shape) ? m.shape : [];
      for (const cell of placeShape) {
        if (!Array.isArray(cell) || cell.length < 2) continue;
        const dr = +cell[0] || 0, dc = +cell[1] || 0;
        if (g[m.r + dr]) g[m.r + dr][m.c + dc] = m.color;
      }
      clearLinesSilent(g);
      if (typeof m.myScore === 'number') my = m.myScore;
      if (typeof m.oppScore === 'number') opp = m.oppScore;
    }
  }

  // Fallback empty trays
  try {
    if (!replayMePieces.length) {
      let di = dealIndexForSideBefore(replayData.moves, 'me', end);
      if (di < 0) di = firstDealIndex(replayData.moves, 'me');
      if (di >= 0) applyReplayDeal(replayData.moves[di], false);
    }
    if (!replayOppPieces.length) {
      let di = dealIndexForSideBefore(replayData.moves, 'opp', end);
      if (di < 0) di = firstDealIndex(replayData.moves, 'opp');
      if (di >= 0) applyReplayDeal(replayData.moves[di], false);
    }
  } catch (_) {}

  renderGrid(grid, boardMe);
  renderGrid(oppGrid, boardOpp);
  renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
  renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
  document.getElementById('myScore').textContent = my;
  document.getElementById('oppScore').textContent = opp;
  clearReplayEffects();

  // Re-apply cosmetics after createBoardDOM — otherwise opp field/skin resets on step-back
  try {
    if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
    if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
    if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
    else if (replayData && replayData.oppBoardId && typeof applyOppBoard === 'function') {
      window.mpOppBoardId = replayData.oppBoardId;
      applyOppBoard(replayData.oppBoardId);
    }
    if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
    else if (replayData && replayData.oppSkinId && typeof applyOppSkin === 'function') {
      window.mpOppSkinId = replayData.oppSkinId;
      applyOppSkin(replayData.oppSkinId);
    }
  } catch (_) {}

  replayIndex = end;
  replayClockMs = end > 0 ? getEventTime(replayData.moves[end - 1], end - 1) : 0;
  updateReplayClockDisplay();
  document.getElementById('reviewMeta').textContent =
    `Событие ${replayIndex} / ${replayData.moves.length} · ${my}:${opp}`;
  try { updateReplayProgressUI(); } catch (_) {}
}

function replayStepBack() {
  if (!replayData || replayBusy) return;
  const minIdx = (typeof replayMinIndex === 'function')
    ? replayMinIndex(replayData.moves)
    : leadingDealCount(replayData.moves);
  const target = Math.max(minIdx, replayIndex - 1);
  if (target === replayIndex) return;
  seekReplayTo(target, { force: true });
}

function replayStep(onDone, speed = 1) {
  if (!replayData || replayIndex >= replayData.moves.length || replayBusy) {
    if (onDone) onDone();
    return false;
  }
  const m = replayData.moves[replayIndex];
  // Visual timing scales with speed, but 1x matches live feel
  const s = Math.max(1, speed || 1);
  // Softer flight + land (slightly longer at 1x, still snappy when sped up)
  const tFly = Math.max(120, 380 / s);
  const tClear = Math.max(50, 120 / s);
  const tDeal = Math.max(110, 320 / s);
  const tLift = Math.max(50, 100 / s);

  // Deal — soft staggered appear, same as live
  if (m.type === 'deal' || m.type === 'Deal') {
    replayBusy = true;
    applyReplayDeal(m, true);
    replayIndex++;
    document.getElementById('reviewMeta').textContent =
      `Событие ${replayIndex} / ${replayData.moves.length} · раздача (${m.side === 'me' ? 'ты' : 'соперник'})`;
    try { updateReplayProgressUI(); } catch (_) {}
    setTimeout(() => {
      replayBusy = false;
      if (onDone) onDone();
    }, tDeal);
    return true;
  }

  // Place — mirror live: lift → fly → land → collapse → clear + combo floats
  replayBusy = true;
  try {
    ensureReplayHandBefore(m.side === 'opp' ? 'opp' : 'me', replayIndex);
  } catch (_) {}
  const g = m.side === 'me' ? grid : oppGrid;
  const board = m.side === 'me' ? boardMe : boardOpp;
  const boardRect = board.getBoundingClientRect();
  const gapSz = 2.5;
  const step = (boardRect.width - gapSz * (SIZE - 1)) / SIZE;
  const maxR = Math.max(...m.shape.map(s => s[0]));
  const maxC = Math.max(...m.shape.map(s => s[1]));
  const targetX = boardRect.left + (m.c + maxC / 2) * (step + gapSz) + step / 2;
  const targetY = boardRect.top + (m.r + maxR / 2) * (step + gapSz) + step / 2;

  const found = findReplaySlot(m.side, m.shape, m.color, m.pieceIdx);
  let startX, startY;
  if (found.slot) {
    const sr = found.slot.getBoundingClientRect();
    startX = sr.left + sr.width / 2;
    startY = sr.top + sr.height / 2;
    found.slot.classList.add('lifting');
  } else {
    const trayEl = document.getElementById(m.side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
    if (trayEl) {
      const tr = trayEl.getBoundingClientRect();
      startX = tr.left + tr.width / 2;
      startY = tr.top + tr.height / 2;
    } else {
      startX = boardRect.left + boardRect.width / 2;
      startY = boardRect.bottom + 20;
    }
  }

  const ghost = document.getElementById('aiGhost');
  // Apply the same skin FX as the tray / board for this side (legendary prism, epic gloss, …)
  try { setAiGhostSkin(m.side === 'opp' ? 'opp' : 'me'); } catch (_) {}
  let cellPx = Math.max(10, Math.round(step * 0.92));
  let gapPx = Math.max(1, Math.round(step - cellPx));
  try {
    const c0 = board.children[0];
    if (c0) {
      const rw = c0.getBoundingClientRect().width;
      if (rw > 4) { cellPx = Math.round(rw); gapPx = Math.max(1, Math.round(step - cellPx)); }
    }
  } catch (_) {}
  // Normalize shape for ghost grid
  let flyShape = m.shape;
  try { if (typeof normalize === 'function') flyShape = normalize(m.shape.map(c => c.slice())); } catch (_) {}
  ghost.innerHTML = buildPieceGhostHTML({ shape: flyShape, color: m.color }, cellPx, gapPx);
  ghost.style.transition = 'none';
  ghost.style.transform = 'translate(-50%,-50%) scale(0.82)';
  ghost.style.left = startX + 'px';
  ghost.style.top = startY + 'px';
  ghost.style.display = 'block';
  ghost.style.opacity = '0';
  void ghost.offsetWidth;
  // Pickup: fade+scale up in tray, then soft fly + settle onto board
  ghost.style.transition =
    `opacity ${tLift}ms ease, transform ${tLift}ms cubic-bezier(0.33, 0.0, 0.25, 1)`;
  requestAnimationFrame(() => {
    ghost.style.opacity = '1';
    ghost.style.transform = 'translate(-50%,-50%) scale(1.03)';
  });
  setTimeout(() => {
    ghost.style.transition =
      `left ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease, transform ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
    requestAnimationFrame(() => {
      ghost.style.left = targetX + 'px';
      ghost.style.top = targetY + 'px';
      ghost.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  }, tLift);

  setTimeout(() => {
    for (const [dr, dc] of m.shape) {
      if (!g[m.r + dr]) continue;
      g[m.r + dr][m.c + dc] = m.color;
      const cell = board.children[(m.r + dr) * SIZE + (m.c + dc)];
      if (cell) {
        paintCellColor(cell, m.color);
        cell.classList.add('filled', 'placing');
        setTimeout(() => cell.classList.remove('placing'), Math.max(400, 900 / s));
      }
    }
    // Legendary placement sparks (same as live)
    try {
      const wantLegend = !!(m.legendFx) ||
        (m.side === 'me' && document.body.classList.contains('skin-fx-prism')) ||
        (m.side === 'opp' && document.querySelector('.player-panel.opp') &&
          document.querySelector('.player-panel.opp').classList.contains('skin-fx-prism'));
      if (wantLegend && typeof spawnLegendSparks === 'function') {
        const wrap = board.parentElement;
        const maxRr0 = Math.max(...(m.shape || [[0, 0]]).map(s => s[0]));
        const maxCr0 = Math.max(...(m.shape || [[0, 0]]).map(s => s[1]));
        const cell0 = board.children[m.r * SIZE + m.c];
        let origin = null;
        if (cell0 && wrap) {
          const cr = cell0.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          origin = {
            left: cr.left - wr.left + cr.width * (0.5 + maxCr0 / 2),
            top: cr.top - wr.top + cr.height * (0.5 + maxRr0 / 2)
          };
        }
        const skinForFx = m.skinId ||
          (m.side === 'opp' ? window.mpOppSkinId : (document.body.dataset.skinId || equippedSkinId)) ||
          'gold';
        spawnLegendSparks(wrap, 6 + (m.shape ? m.shape.length : 4), skinForFx, origin);
      }
    } catch (_) {}
    ghost.style.opacity = '0';
    setTimeout(() => {
      ghost.style.display = 'none';
      ghost.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 150);

    markReplayPieceUsed(m.side, found.idx);
    // Show place points first, then full score after clear (mirrors live feel)
    try {
      const placePts = (typeof m.placePts === 'number')
        ? m.placePts
        : (Array.isArray(m.shape) ? m.shape.length * 10 : 0);
      const clearedN = m.cleared || 0;
      const bonusN = m.bonus || 0;
      if (m.side === 'me') {
        const beforeClear = (typeof m.myScore === 'number')
          ? Math.max(0, m.myScore - (clearedN > 0 ? bonusN : 0))
          : null;
        if (beforeClear != null) document.getElementById('myScore').textContent = beforeClear;
        else if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
        if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
      } else {
        const beforeClear = (typeof m.oppScore === 'number')
          ? Math.max(0, m.oppScore - (clearedN > 0 ? bonusN : 0))
          : null;
        if (beforeClear != null) document.getElementById('oppScore').textContent = beforeClear;
        else if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
        if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
      }
      // Brief +N float for place points
      if (placePts > 0 && settings.anim !== 'off' && !document.body.classList.contains('no-floats')) {
        const wrap = board.parentElement;
        if (wrap) {
          const maxRr = Math.max(...(m.shape || [[0, 0]]).map(s => s[0]));
          const maxCr = Math.max(...(m.shape || [[0, 0]]).map(s => s[1]));
          const cell0 = board.children[(m.r + Math.floor(maxRr / 2)) * SIZE + (m.c + Math.floor(maxCr / 2))]
            || board.children[m.r * SIZE + m.c];
          if (cell0) {
            const cr = cell0.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            const fl = document.createElement('div');
            fl.className = 'score-float';
            fl.textContent = '+' + placePts;
            fl.style.left = (cr.left - wr.left + cr.width / 2) + 'px';
            fl.style.top = (cr.top - wr.top) + 'px';
            wrap.appendChild(fl);
            setTimeout(() => { try { fl.remove(); } catch (_) {} }, Math.max(600, 1100 / s));
          }
        }
      }
    } catch (_) {
      try {
        document.getElementById('myScore').textContent = m.myScore;
        document.getElementById('oppScore').textContent = m.oppScore;
      } catch (_2) {}
    }

    setTimeout(() => {
      // Animated clear + same combo/float as live
      let cleared = m.cleared || 0;
      let bonus = m.bonus || 0;
      let rows = Array.isArray(m.rows) ? m.rows.slice() : [];
      let cols = Array.isArray(m.cols) ? m.cols.slice() : [];
      if (!cleared) {
        rows = []; cols = [];
        for (let r = 0; r < SIZE; r++) if (g[r].every(c => c !== null)) rows.push(r);
        for (let c = 0; c < SIZE; c++) if (g.every(row => row[c] !== null)) cols.push(c);
        cleared = rows.length + cols.length;
        if (cleared) bonus = bonusFor(cleared);
      }
      if (cleared > 0) {
        if (m.side === 'me') {
          window._repChainMe = (typeof m.chain === 'number' && m.chain > 0)
            ? m.chain
            : ((window._repChainMe || 0) + 1);
          window._repChainOpp = 0;
        } else {
          window._repChainOpp = (typeof m.chain === 'number' && m.chain > 0)
            ? m.chain
            : ((window._repChainOpp || 0) + 1);
          window._repChainMe = 0;
        }
        const chain = (typeof m.chain === 'number' && m.chain > 0)
          ? m.chain
          : (m.side === 'me' ? window._repChainMe : window._repChainOpp);
        const info = clearLinesOn(g, board);
        rows = info.rows.length ? info.rows : rows;
        cols = info.cols.length ? info.cols : cols;
        const banner = m.side === 'me'
          ? document.getElementById('comboBannerMe')
          : document.getElementById('comboBannerOpp');
        const maxRr = Math.max(...(m.shape || [[0,0]]).map(s => s[0]));
        const maxCr = Math.max(...(m.shape || [[0,0]]).map(s => s[1]));
        const placeAnchor = (typeof m.r === 'number') ? {
          baseR: m.r, baseC: m.c,
          centerR: m.r + maxRr / 2,
          centerC: m.c + maxCr / 2
        } : null;
        const positions = getClearFloatPositions(board, rows, cols, placeAnchor);
        const wrap = board.parentElement;
        const baseBonus = (typeof m.baseBonus === 'number') ? m.baseBonus : bonusFor(cleared);
        const chainExtra = (typeof m.chainExtra === 'number') ? m.chainExtra : (bonus - baseBonus);
        showCombo(
          banner || (wrap && wrap.querySelector('.combo-banner')),
          cleared,
          bonus || bonusFor(cleared),
          wrap,
          m.side === 'me' ? 'me' : 'opp',
          { chain, positions, placeAnchor, baseBonus, chainExtra }
        );
        // Final scores after clear bonus
        try {
          if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
          if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
        } catch (_) {}
      } else {
        if (m.side === 'me') window._repChainMe = 0;
        else window._repChainOpp = 0;
        clearLinesSilent(g);
        renderGrid(g, board);
        try {
          if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
          if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
        } catch (_) {}
      }

      replayIndex++;
      document.getElementById('reviewMeta').textContent =
        `Событие ${replayIndex} / ${replayData.moves.length} · ${m.side === 'me' ? 'Ты' : 'Соперник'} · ${m.myScore}:${m.oppScore}`;
      try { updateReplayProgressUI(); } catch (_) {}
      setTimeout(() => {
        replayBusy = false;
        if (onDone) onDone();
        // Manual step landed on last event → offer result after a beat
        if (!replayPlaying && replayData && replayIndex >= replayData.moves.length) {
          setTimeout(() => {
            if (replayMode && !replayPlaying && replayIndex >= replayData.moves.length) {
              try { showReplayResult(); } catch (_) {}
            }
          }, 420);
        }
      }, tClear);
    }, Math.max(60, 160 / s));
  }, tFly + Math.max(80, 160 / s));

  return true;
}

document.getElementById('cardClassic')?.addEventListener('click', () => startClassic(false));
document.getElementById('cardVersus')?.addEventListener('click', startVersusFlow);
['cardClassic', 'cardVersus'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
});
document.getElementById('btnBackFromComp')?.addEventListener('click', () => { showScreen('menu'); updateMenuStats(); });
document.getElementById('cardOnline')?.addEventListener('click', goDurationFromOnline);
document.getElementById('cardBots')?.addEventListener('click', goDifficulty);
['cardOnline', 'cardBots'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
});
document.getElementById('btnDiffNext')?.addEventListener('click', () => showScreen('duration'));

let botPickBusy = false;
function showBotPickOverlay(bot, phase) {
  const ov = document.getElementById('botPickOverlay');
  const av = document.getElementById('botPickAvatar');
  const name = document.getElementById('botPickName');
  const meta = document.getElementById('botPickMeta');
  const stars = document.getElementById('botPickStars');
  const label = document.getElementById('botPickLabel');
  if (!ov || !bot) return;
  // Restart reel animation each tick (translateY + fade)
  if (av) {
    av.classList.remove('spin', 'bot-pick-flash');
    void av.offsetWidth;
  }
  if (name) {
    name.classList.remove('bot-pick-name-spin', 'bot-pick-name-final');
    void name.offsetWidth;
  }
  av.innerHTML = botAvatarSVG(bot, 88);
  name.textContent = bot.name;
  const tier = (typeof botTierLabel === 'function')
    ? botTierLabel(bot.trophies)
    : (bot.title || '');
  meta.innerHTML =
    '<span class="bot-pick-cups">🏆 ' + (bot.trophies | 0) + '</span>' +
    (tier ? ('<span class="bot-pick-tier">' + tier + '</span>') : '');
  const st = (typeof botStars !== 'undefined' && botStars[bot.id]) ? botStars[bot.id] : {};
  stars.innerHTML = [60, 120, 180].map(sec =>
    '<span style="opacity:' + (st[String(sec)] ? 1 : 0.25) + '">★</span>'
  ).join('');
  if (phase === 'spin') {
    label.textContent = 'Прокрутка соперников…';
    av.classList.add('spin');
    name.classList.add('bot-pick-name-spin');
  } else {
    label.textContent = 'Твой соперник';
    av.classList.remove('spin');
    name.classList.remove('bot-pick-name-spin');
    void name.offsetWidth;
    name.classList.add('bot-pick-name-final');
  }
  ov.classList.add('visible');
  ov.setAttribute('aria-hidden', 'false');
}
function hideBotPickOverlay() {
  const ov = document.getElementById('botPickOverlay');
  if (!ov) return;
  ov.classList.remove('visible');
  ov.setAttribute('aria-hidden', 'true');
  const av = document.getElementById('botPickAvatar');
  if (av) av.classList.remove('spin');
}
function startRandomBotPick() {
  if (botPickBusy) return;
  if (!BOTS || !BOTS.length) return;
  botPickBusy = true;
  try { SFX.ui(); } catch (_) {}
  try { hapticTap(10); } catch (_) {}
  // Sort by trophies so the reel "climbs" visually at times
  const sorted = BOTS.slice().sort((a, b) => (a.trophies | 0) - (b.trophies | 0));
  let ticks = 0;
  const totalTicks = 22 + Math.floor(Math.random() * 10);
  let delay = 35;
  const finalBot = sorted[Math.floor(Math.random() * sorted.length)];
  let cursor = Math.floor(Math.random() * sorted.length);
  try {
    const ov = document.getElementById('botPickOverlay');
    if (ov) {
      ov.style.display = '';
      ov.style.pointerEvents = '';
      ov.style.opacity = '';
      ov.classList.add('visible');
      ov.setAttribute('aria-hidden', 'false');
    }
  } catch (_) {}

  const highlightList = (bot) => {
    try {
      document.querySelectorAll('.bot-card.pick-flash').forEach(c => c.classList.remove('pick-flash'));
      if (!bot) return;
      const card = document.querySelector('.bot-card[data-bot="' + bot.id + '"]');
      if (card) {
        card.classList.add('pick-flash');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } catch (_) {}
  };

  const tick = () => {
    ticks++;
    let show;
    if (ticks >= totalTicks) {
      show = finalBot;
    } else {
      // Mostly sequential reel with occasional jumps
      cursor = (cursor + 1 + (Math.random() < 0.18 ? Math.floor(Math.random() * 5) : 0)) % sorted.length;
      show = sorted[cursor];
    }
    showBotPickOverlay(show, ticks >= totalTicks ? 'final' : 'spin');
    highlightList(show);
    try { if (ticks % 2 === 0) SFX.ui(); } catch (_) {}
    if (ticks < totalTicks) {
      // Ease out: slow near the end
      const progress = ticks / totalTicks;
      delay = Math.round(35 + progress * progress * 200);
      setTimeout(tick, delay);
    } else {
      selectedBotId = finalBot.id;
      currentBot = finalBot;
      renderBotList();
      highlightList(finalBot);
      const card = document.querySelector('.bot-card[data-bot="' + finalBot.id + '"]');
      if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      try { SFX.ui(); } catch (_) {}
      try { hapticTap(18); } catch (_) {}
      setTimeout(() => {
        hideBotPickOverlay();
        botPickBusy = false;
        try {
          document.querySelectorAll('.bot-card.pick-flash').forEach(c => c.classList.remove('pick-flash'));
        } catch (_) {}
        showScreen('duration');
      }, 1200);
    }
  };
  tick();
}
document.getElementById('btnRandomBot')?.addEventListener('click', startRandomBotPick);
document.getElementById('btnBackDiff')?.addEventListener('click', () => showScreen('compType'));
document.getElementById('btnBackMenu')?.addEventListener('click', () => {
  if (vsModeType === 'bots') showScreen('difficulty');
  else showScreen('compType');
});
document.getElementById('btnClassicMenu')?.addEventListener('click', () => { showScreen('menu'); updateMenuStats(); });
document.querySelectorAll('#screenDuration .dur-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#screenDuration .dur-card').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    vsDuration = parseInt(btn.dataset.sec, 10);
  });
});
document.getElementById('btnStartMatch')?.addEventListener('click', startMatchFlow);
document.getElementById('btnCancelSearch')?.addEventListener('click', () => {
  stopMatchmaking(true);
  mmFound = false;
  showScreen('duration');
  mmSetStatus('Ищем соперника...', '—');
});

(function bindSkinPreviewModal() {
  const close = document.getElementById('skinPrevClose');
  const ov = document.getElementById('skinPreviewModal');
  if (close) close.addEventListener('click', closeSkinPreview);
  if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) closeSkinPreview(); });
})();

document.getElementById('btnShop')?.addEventListener('click', () => {
  renderShopGrid();
  showScreen('shop');
});
document.getElementById('btnInventory')?.addEventListener('click', () => {
  renderInvGrid();
  showScreen('inventory');
});
document.getElementById('btnShopBack')?.addEventListener('click', () => {
  try { closeShopInvSections(); } catch (_) {}
  showScreen('menu');
  updateMenuStats();
});
document.getElementById('btnInvBack')?.addEventListener('click', () => {
  try { closeShopInvSections(); } catch (_) {}
  showScreen('menu');
  updateMenuStats();
});
// Shop & Inventory are separate screens (no cross-tabs)
const _shopToInv = document.getElementById('btnShopToInv');
if (_shopToInv) _shopToInv.addEventListener('click', () => {
  try { closeShopInvSections(); } catch (_) {}
  renderInvGrid();
  showScreen('inventory');
});
const _invToShop = document.getElementById('btnInvToShop');
if (_invToShop) _invToShop.addEventListener('click', () => {
  try { closeShopInvSections(); } catch (_) {}
  renderShopGrid();
  showScreen('shop');
});


document.getElementById('profileAvatarFile')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = await compressAvatarFile(file);
    profileDraft.custom = data;
    profileDraft.avatarId = 'custom';
    renderProfileAvatarGrid();
    renderAvatarInto(document.getElementById('profileAvBig'), {
      avatarId: 'custom',
      nick: profileDraft.nick || myNickname,
      custom: data,
      big: true
    });
    try { SFX.ui(); hapticTap(10); } catch (_) {}
  } catch (err) {
    try {
      const t = document.getElementById('infoToast');
      if (t) {
        document.getElementById('infoToastLabel').textContent = 'Аватар';
        document.getElementById('infoToastText').textContent = (err && err.message) || 'Ошибка загрузки';
        t.classList.add('visible');
        clearTimeout(t._hide);
        t._hide = setTimeout(() => t.classList.remove('visible'), 2600);
      }
    } catch (_) {}
  }
});

document.getElementById('btnHomeProfile')?.addEventListener('click', () => {
  try { SFX.ui(); } catch (_) {}
  openProfileScreen();
});
document.getElementById('btnProfileBack')?.addEventListener('click', () => {
  showScreen('menu');
  updateMenuStats();
  refreshProfileUI();
});
document.getElementById('btnProfileSave')?.addEventListener('click', () => {
  const nickIn = document.getElementById('profileNickInput');
  const stIn = document.getElementById('profileStatusInput');
  profileDraft.nick = nickIn ? nickIn.value : myNickname;
  profileDraft.status = stIn ? stIn.value : myStatus;
  const res = saveProfile({
    nick: profileDraft.nick,
    avatarId: profileDraft.avatarId,
    status: profileDraft.status,
    custom: profileDraft.custom != null ? profileDraft.custom : myAvatarCustom
  });
  if (!res.ok) {
    try {
      const t = document.getElementById('infoToast');
      if (t) {
        document.getElementById('infoToastLabel').textContent = 'Профиль';
        document.getElementById('infoToastText').textContent = res.err || 'Ошибка';
        t.classList.add('visible');
        clearTimeout(t._hide);
        t._hide = setTimeout(() => t.classList.remove('visible'), 2400);
      }
    } catch (_) {}
    return;
  }
  try { SFX.ui(); hapticTap(12); } catch (_) {}
  try {
    const t = document.getElementById('infoToast');
    if (t) {
      document.getElementById('infoToastLabel').textContent = 'Профиль';
      document.getElementById('infoToastText').textContent = 'Сохранено';
      t.classList.add('visible');
      clearTimeout(t._hide);
      t._hide = setTimeout(() => t.classList.remove('visible'), 1800);
    }
  } catch (_) {}
});
document.getElementById('btnProfileCopyCode')?.addEventListener('click', () => {
  try { copyText(myFriendCode); } catch (_) {}
  try { SFX.ui(); } catch (_) {}
  try {
    const t = document.getElementById('infoToast');
    if (t) {
      document.getElementById('infoToastLabel').textContent = 'Код';
      document.getElementById('infoToastText').textContent = 'Скопирован';
      t.classList.add('visible');
      clearTimeout(t._hide);
      t._hide = setTimeout(() => t.classList.remove('visible'), 1600);
    }
  } catch (_) {}
});
document.getElementById('profileNickInput')?.addEventListener('input', (e) => {
  profileDraft.nick = e.target.value;
  const clean = sanitizeNick(profileDraft.nick) || myNickname;
  const hn = document.getElementById('profileHeroName');
  if (hn) hn.textContent = clean;
  renderAvatarInto(document.getElementById('profileAvBig'), {
    avatarId: profileDraft.avatarId,
    nick: clean,
    custom: profileDraft.custom,
    big: true
  });
  // refresh initials on grid
  const grid = document.getElementById('profileAvatarGrid');
  if (grid) {
    grid.querySelectorAll('.profile-av-opt').forEach(btn => {
      const p = getAvatarPreset(btn.dataset.av);
      if (p.kind === 'initials') btn.textContent = profileInitials(sanitizeNick(profileDraft.nick) || myNickname);
    });
  }
});

document.getElementById('btnSettings')?.addEventListener('click', () => {
  applySettings();
  showScreen('settings');
});

function switchSettingsTab(id) {
  const tabs = document.querySelectorAll('#settingsTabs .settings-tab');
  const secs = document.querySelectorAll('#screenSettings .settings-section[data-stab]');
  tabs.forEach(t => {
    const on = t.dataset.stab === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  secs.forEach(s => s.classList.toggle('active-tab', s.dataset.stab === id));
  const list = document.querySelector('#screenSettings .settings-list');
  if (list) list.scrollTop = 0;
  try { SFX.ui(); } catch (_) {}
}
document.getElementById('settingsTabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.settings-tab');
  if (!btn || !btn.dataset.stab) return;
  switchSettingsTab(btn.dataset.stab);
});

document.getElementById('btnSettingsBack')?.addEventListener('click', () => {
  applySettings();
  showScreen('menu');
  updateMenuStats();
});
document.getElementById('btnSettingsReset')?.addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  applySettings();
});
document.querySelectorAll('.set-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const key = chip.dataset.set;
    const val = chip.dataset.val;
    if (!key) return;
    settings[key] = val;
    saveSettings();
    applySettings();
    hapticTap(8);
    SFX.ui();
  });
});
function bindVolSlider(id, key, labelId) {
  const el = document.getElementById(id);
  if (!el) return;
  const applyVol = () => {
    settings[key] = String(el.value);
    saveSettings();
    const lab = document.getElementById(labelId);
    if (lab) lab.textContent = el.value + '%';
    if (key === 'musicVol' && musicMaster && musicCtx && settings.music === '1') {
      const volMul = Math.max(0, Math.min(1, parseInt(el.value, 10) / 100));
      const base = musicMode === 'battle' ? 0.22 : 0.16;
      try {
        musicMaster.gain.linearRampToValueAtTime(Math.max(0.0001, base * volMul), musicCtx.currentTime + 0.08);
      } catch (_) {}
    }
  };
  el.addEventListener('input', applyVol);
  el.addEventListener('change', applyVol);
}
bindVolSlider('musicVolSlider', 'musicVol', 'musicVolLabel');
bindVolSlider('voiceVolSlider', 'voiceVol', 'voiceVolLabel');
// Soft UI clicks + unlock AudioContext on first gesture
document.addEventListener('pointerdown', () => {
  try { ensureFriendPresence(); } catch (_) {}
  getSfxCtx();
  getMusicCtx();
  const active = document.querySelector('.screen.active');
  if (active && settings.music === '1') {
    const raw = (active.id || '').replace(/^screen/, '');
    const map = {
      Menu: 'menu', Classic: 'classic', Versus: 'versus', Settings: 'settings',
      Match: 'match', Friends: 'friends', History: 'history', Achievements: 'achievements',
      CompType: 'compType', Difficulty: 'difficulty', Duration: 'duration'
    };
    syncMusicToScreen(map[raw] || 'menu');
  }
}, { once: true, passive: true });
document.body.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('button, .menu-card, .bot-card, .history-item');
  if (btn) SFX.ui();
}, true);
applySettings();

document.getElementById('btnAchievements')?.addEventListener('click', () => {
  renderAchievements();
  try { updateClaimAllButton(); } catch (_) {}
  showScreen('achievements');
});
document.getElementById('btnClaimAllAch')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (claimAllBusy || achClaimOpen) return;
  try { SFX.ui(); hapticTap(14); } catch (_) {}
  claimAllAchievements();
});
try { updateAchievementsButton(); } catch (_) {}
document.getElementById('btnAchBack')?.addEventListener('click', () => {
  showScreen('menu');
  updateMenuStats();
});
document.getElementById('btnNew')?.addEventListener('click', () => { clearClassicSave(); startClassic(true); });
document.getElementById('btnRestart')?.addEventListener('click', () => { clearClassicSave(); startClassic(true); });
document.getElementById('btnOverMenu')?.addEventListener('click', () => {
  gameOverEl.classList.remove('visible'); showScreen('menu'); updateMenuStats();
});
document.getElementById('btnRelief')?.addEventListener('click', doRelief);
document.getElementById('btnUseDiamond')?.addEventListener('click', doRelief);
document.getElementById('btnGiveUp')?.addEventListener('click', () => {
  stuckOfferEl.classList.remove('visible');
  document.getElementById('finalScore').textContent = score;
  const msg = document.getElementById('gameOverMsg');
  if (msg) msg.textContent = 'Места больше нет';
  clearClassicSave();
  gameOverEl.classList.add('visible');
});
let forfeitLock = false;
function openForfeitConfirm() {
  if (!vsActive || forfeitLock) return;
  try {
    if (settings && settings.confirmForfeit === '0') {
      confirmForfeit();
      return;
    }
  } catch (_) {}
  const el = document.getElementById('forfeitConfirm');
  if (el) el.classList.add('visible');
}
function closeForfeitConfirm() {
  const el = document.getElementById('forfeitConfirm');
  if (el) el.classList.remove('visible');
}
function confirmForfeit() {
  if (!vsActive || forfeitLock) return;
  closeForfeitConfirm();
  forfeitLock = true;
  const flag = document.getElementById('flagBreak');
  const btn = document.getElementById('btnForfeit');
  if (btn) {
    btn.style.visibility = 'hidden';
    btn.disabled = true;
  }
  if (flag) {
    flag.classList.remove('play');
    void flag.offsetWidth;
    flag.classList.add('play');
  }
  // Room mode: server ends match and notifies opponent with match_end
  try {
    if ((roomMatchMode || window._roomMatchMode) && typeof MatchClient !== 'undefined') {
      MatchClient.forfeit();
    }
  } catch (_) {}
  // Legacy server path for non-room matches
  try {
    if (!(roomMatchMode || window._roomMatchMode) && mpMode) {
      try {
        try { if (typeof MatchClient !== 'undefined') MatchClient.forfeit(); } catch (_) {}
      } catch (_) {}
    }
  } catch (_) {}
  setTimeout(() => {
    // Local loss UI (server match_end may also fire — endVersus is idempotent via _matchEnded)
    try {
      if (!window._matchEnded) {
        endVersus({ forceLoss: true, reason: 'forfeit' });
      }
    } catch (_) {}
    forfeitLock = false;
    if (btn) {
      btn.style.visibility = '';
      btn.disabled = false;
    }
    if (flag) flag.classList.remove('play');
  }, 900);
}
document.getElementById('btnForfeit')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openForfeitConfirm();
});
document.getElementById('btnForfeitYes')?.addEventListener('click', (e) => {
  e.preventDefault();
  confirmForfeit();
});
document.getElementById('btnForfeitNo')?.addEventListener('click', (e) => {
  e.preventDefault();
  closeForfeitConfirm();
});
document.getElementById('btnVsRematch')?.addEventListener('click', () => {
  requestRematch();
});
document.getElementById('btnVsAgain')?.addEventListener('click', () => {
  // «Ещё матч» / «Другой бот»: new opponent — not same-bot rematch
  try { dismissPostMatchResult(); } catch (_) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
  }
  hideRematchOffer();
  hideRematchWait();
  rematchIWant = false;
  rematchTheyWant = false;
  pendingRematchOfferName = null;
  pendingJoinAfterForfeit = null;
  // Ranked «Ещё матч»: new opponent search (not same-opponent rematch).
  // Use durable signals — after session teardown / false abort, mpFromMatchmaking &
  // mpGameSource are often cleared; lastMatchResult / _lastMatchWasRanked must still win.
  const wantRankedAgain = !!(
    window._lastMatchWasRanked
    || mpGameSource === 'ranked'
    || (lastMatchResult && lastMatchResult.ranked)
    || (lastMatchResult && lastMatchResult.mode === 'online')
    || (mpMode && mpFromMatchmaking)
  );
  if (wantRankedAgain) {
    // startOnlineMatchmaking() performs the single authoritative teardown.
    vsModeType = 'online';
    mpFromMatchmaking = true;
    mpGameSource = 'ranked';
    try { window._leftForRankedSearch = 0; } catch (_) {}
    startOnlineMatchmaking();
    return;
  }
  if (mpMode && vsModeType === 'online') {
    try { destroyMp(); } catch (_) {}
    showScreen('menu');
    return;
  }
  // Bot path: pick another bot
  try { destroyMp(); } catch (_) {}
  mpMode = false;
  vsModeType = 'bots';
  renderBotList();
  showScreen('difficulty');
});
document.getElementById('btnVsMenu')?.addEventListener('click', () => {
  try { dismissPostMatchResult(); } catch (_) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
  }
  hideRematchOffer();
  hideRematchWait();
  rematchIWant = false;
  // Keep rematchTheyWant / pending offer — opponent may still send invite while we are in menu
  // Do not clear pendingRematchOfferName if invite already queued
  const lobbyJoin = pendingJoinAfterForfeit;
  pendingJoinAfterForfeit = null;
  // Free server match binding so "create room" is never blocked by in_match.
  // Rematch invite can still arrive via presence/challenge path.
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient._skipAutoRejoin = true;
      MatchClient.leaveMatch();
      MatchClient.freeMatch && MatchClient.freeMatch();
    }
  } catch (_) {}
  try { roomMatchMode = false; window._roomMatchMode = false; } catch (_) {}
  if (!vsActive && !lobbyJoin && !postMatchOnlineEligible) {
    try { destroyMp(); } catch (_) {}
  }
  showScreen('menu');
  updateMenuStats();
  // If rematch invite arrived during score duel / result, surface toast on menu
  try { tryShowPendingRematchOffer(); } catch (_) {}
  if (lobbyJoin && lobbyJoin.room) {
    setTimeout(() => {
      try { doAcceptChallengeJoin(lobbyJoin); } catch (_) {}
    }, 280);
  }
});
document.getElementById('btnVsReview')?.addEventListener('click', () => {
  const match = getMatchForPostResultReplay();
  if (!match) {
    try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
    return;
  }
  startReplay(match, { from: 'result' });
});

function getMatchForPostResultReplay() {
  // Prefer newest history entry with moves (written in endVersus)
  try {
    if (matchHistory && matchHistory.length) {
      const h = matchHistory[0];
      if (h && h.moves && h.moves.length) {
        // Sanity: same scores as last result when available
        if (!lastMatchResult) return h;
        const sameMy = typeof lastMatchResult.my === 'number' ? lastMatchResult.my === h.my : true;
        const sameOpp = typeof lastMatchResult.opp === 'number' ? lastMatchResult.opp === h.oppScore : true;
        if (sameMy && sameOpp) return h;
        // Still return newest if dates are close
        if (lastMatchResult.date && h.date && Math.abs(h.date - lastMatchResult.date) < 60000) return h;
        return h;
      }
    }
  } catch (_) {}
  try {
    if (lastMatchResult && lastMatchResult.moves && lastMatchResult.moves.length) return lastMatchResult;
  } catch (_) {}
  return null;
}
// Single delegated handler for review-bar actions (survives innerHTML rebuilds; no duplicate IDs)
(function bindReviewBarActions() {
  const bar = document.getElementById('reviewBar');
  if (!bar || bar._reviewBound) return;
  bar._reviewBound = true;
  bar.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('[data-review-action]');
    if (!btn || !bar.contains(btn)) return;
    const act = btn.getAttribute('data-review-action');
    if (act === 'result') {
      bar.classList.remove('visible');
      try { document.getElementById('versusResult').classList.add('visible'); } catch (_) {}
      return;
    }
    if (act === 'again') {
      if (postMatchOnlineEligible || (mpMode && vsModeType === 'online') || roomMatchMode || window._roomMatchMode) {
        // Room mode does not need server link
        if (roomMatchMode || window._roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
          try { requestRematch(); } catch (_) {}
          return;
        }
        if (typeof mpIsLinked === 'function' && mpIsLinked()) {
          try { requestRematch(); } catch (_) {}
          return;
        }
        try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
        return;
      }
      bar.classList.remove('visible');
      try {
        const br = document.getElementById('btnVsRematch');
        if (br && br.style.display !== 'none') { br.click(); return; }
      } catch (_) {}
      if (vsModeType === 'bots' || currentBot) {
        try { beginVersusMatch(); } catch (_) {}
      } else if (vsModeType === 'online') {
        try { startMatchFlow(); } catch (_) {}
      } else {
        try {
          const again = document.getElementById('btnVsAgain');
          if (again) again.click();
          else beginVersusMatch();
        } catch (_) {
          try { beginVersusMatch(); } catch (_2) {}
        }
      }
      return;
    }
    if (act === 'menu') {
      bar.classList.remove('visible');
      try {
        const menuBtn = document.getElementById('btnVsMenu');
        if (menuBtn) menuBtn.click();
        else { showScreen('menu'); updateMenuStats(); }
      } catch (_) {
        try { showScreen('menu'); updateMenuStats(); } catch (_2) {}
      }
    }
  });
})();
function acceptRematchInvite() {
  rematchIWant = true;
  pendingRematchOfferName = null;
  try { rmPending = null; } catch (_) {}
  try { renderFriendRequests && renderFriendRequests(); } catch (_) {}
  if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }
  hideRematchOffer();
  hideRmToast(false);
  // Server room rematch
  if (roomMatchMode || window._roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
    try { MatchClient.rematchAccept(); } catch (_) {}
    try { showRematchWait && showRematchWait(); } catch (_) {}
    return;
  }
  if (!mpIsLinked()) {
    try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
    rematchIWant = false;
    return;
  }
  try { if (typeof MatchClient !== 'undefined') MatchClient.rematchAccept(); } catch (_) {}
  startRematchMatch();
}
function declineRematchInvite() {
  pendingRematchOfferName = null;
  try { if (typeof clearRmPending === 'function') clearRmPending(); else rmPending = null; } catch (_) {}
  if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }
  try {
    if (roomMatchMode || window._roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
      MatchClient.rematchDecline();
    } else if (mpIsLinked()) {
      try { if (typeof MatchClient !== 'undefined') MatchClient.rematchDecline(); } catch (_) {}
    }
  } catch (_) {}
  leaveAfterRematchDecline();
}
document.getElementById('btnRematchAccept')?.addEventListener('click', () => {
  acceptRematchInvite();
});
document.getElementById('btnRematchDecline')?.addEventListener('click', () => {
  declineRematchInvite();
});
document.getElementById('btnRematchCancel')?.addEventListener('click', () => {
  pendingRematchOfferName = null;
  if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }
  rematchIWant = false;
  rematchPending = false;
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.rematchCancel) MatchClient.rematchCancel();
    else if (typeof MatchClient !== 'undefined') MatchClient.rematchDecline();
  } catch (_) {}
  try { hideRematchWait && hideRematchWait(); } catch (_) {}
  try { restorePostMatchResultUI && restorePostMatchResultUI(); } catch (_) {}
});
document.getElementById('rmBtnAccept')?.addEventListener('click', () => {
  acceptRematchInvite();
});
document.getElementById('rmBtnDecline')?.addEventListener('click', () => {
  declineRematchInvite();
});
document.getElementById('btnHistory')?.addEventListener('click', () => {
  renderHistory();
  showScreen('history');
});
document.getElementById('btnHistoryBack')?.addEventListener('click', () => {
  showScreen('menu');
  updateMenuStats();
});
document.getElementById('btnHistoryClear')?.addEventListener('click', () => {
  if (confirm('Очистить всю историю матчей?')) {
    matchHistory = [];
    localStorage.setItem('bp_history', '[]');
    renderHistory();
  }
});
document.getElementById('btnFriends')?.addEventListener('click', () => {
  if (!requireOnline('Друзья')) return;
  try { ensureFriendPresence(); } catch (_) {}
  renderFriends();
  renderFriendRequests();
  renderOutgoingPending();
  showScreen('friends');
  setFriendAddStatus('');
  try { scheduleFriendsPresence(); } catch (_) {}
});
(function bindLobbyInviteModal() {
  const closeBtn = document.getElementById('btnLobbyInviteClose');
  const modal = document.getElementById('lobbyInviteModal');
  if (closeBtn) closeBtn.addEventListener('click', closeLobbyInviteModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLobbyInviteModal();
    });
  }
  const search = document.getElementById('lobbyInviteSearch');
  if (search && !search._bpBound) {
    search._bpBound = true;
    let t = null;
    search.addEventListener('input', () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => renderLobbyInviteList(), 100);
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        search.value = '';
        renderLobbyInviteList();
      }
    });
  }
})();
(function bindFriendSearch() {
  const el = document.getElementById('friendSearchInput');
  if (!el || el._bpBound) return;
  el._bpBound = true;
  let t = null;
  el.addEventListener('input', () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => renderFriends(), 120);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      el.value = '';
      renderFriends();
    }
  });
})();
document.getElementById('btnFriendsBack')?.addEventListener('click', () => {
  try { closeRoomLobby(); } catch (_) {}
  if (mpRoomCode || (mpMode && !mmActive && mpGameSource !== 'ranked')) {
    try { destroyMp(); } catch (_) {}
    try { setMpStatus(''); } catch (_) {}
  }
  showScreen('menu');
  updateMenuStats();
});
document.getElementById('btnAddFriend')?.addEventListener('click', () => {
  addFriendByCode(document.getElementById('friendCodeInput').value);
});
document.getElementById('friendCodeInput')?.addEventListener('input', (e) => {
  const el = e.target;
  const cur = el.value;
  const clean = normalizeFriendCode(cur);
  if (cur !== clean) {
    const pos = el.selectionStart;
    el.value = clean;
    try { el.setSelectionRange(Math.min(pos, clean.length), Math.min(pos, clean.length)); } catch (_) {}
  }
  if (document.getElementById('friendAddStatus')) {
    const st = document.getElementById('friendAddStatus');
    if (st && !frSearchBusy && st.classList.contains('err')) setFriendAddStatus('');
  }
});
document.getElementById('friendCodeInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addFriendByCode(document.getElementById('friendCodeInput').value);
  }
});
document.getElementById('btnCopyCode')?.addEventListener('click', () => {
  copyText(myFriendCode);
  setFriendAddStatus('Код скопирован', 'ok');
  try { SFX.ui(); } catch (_) {}
});
document.getElementById('btnShareCode')?.addEventListener('click', () => {
  const msg = `Добавь меня в Block Puzzle!\nМой код: ${myFriendCode}`;
  if (navigator.share) {
    navigator.share({ title: 'Block Puzzle', text: msg }).then(() => {
      setFriendAddStatus('Отправлено', 'ok');
    }).catch(() => {
      // User cancelled share sheet — silent, no popup
    });
  } else {
    copyText(msg);
    setFriendAddStatus('Код скопирован', 'ok');
    try { SFX.ui(); } catch (_) {}
  }
});
document.getElementById('btnJoinRoom')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!requireOnline('Комната')) return;
  joinRoomFlow();
});
document.getElementById('btnJoinRoomGo')?.addEventListener('click', (e) => {
  e.preventDefault();
  submitJoinRoom();
});
document.getElementById('btnJoinRoomCancel')?.addEventListener('click', () => {
  document.getElementById('joinRoomModal').classList.remove('visible');
});
document.getElementById('joinRoomInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitJoinRoom();
});
document.getElementById('btnCreateRoom')?.addEventListener('click', () => { if (!requireOnline('Комната')) return; createMpRoom(); });
document.getElementById('btnLobbyReady')?.addEventListener('click', toggleLobbyReady);
document.getElementById('btnLobbyInvite')?.addEventListener('click', inviteFromLobby);
document.getElementById('btnLobbyLeave')?.addEventListener('click', () => {
  const room = mpRoomCode;
  try { if (room) notifyChallengeCancelled(room, 'closed'); } catch (_) {}
  destroyMp();
  setMpStatus('');
});
document.querySelectorAll('.lobby-dur').forEach(btn => {
  btn.addEventListener('click', () => {
    mpLobbyDuration = parseInt(btn.dataset.sec, 10) || 120;
    try {
      if (typeof MatchClient !== 'undefined' && mpRoomCode) {
        MatchClient.privateDuration(mpLobbyDuration, mpRoomCode);
      }
    } catch (_) {}
    try { if (typeof MatchClient !== 'undefined') MatchClient.privateDuration(mpLobbyDuration); } catch (_) {}
    // Changing duration resets ready so both re-confirm
    if (mpReady) {
      mpReady = false;
      try { if (typeof MatchClient !== 'undefined') MatchClient.privateReady(false); } catch (_) {}
    }
    updateLobbyUI();
  });
});

