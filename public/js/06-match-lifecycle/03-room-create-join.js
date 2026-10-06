/**
 * Block Puzzle — js/06-match-lifecycle/03-room-create-join.js
 * Create / join private room (MatchClient).
 * Shares the client bundle scope (order: public/js/modules.json).
 */
async function createMpRoom() {
  if (typeof MatchClient === 'undefined') {
    setMpStatus('Сервер матчей недоступен. Обнови страницу.');
    return;
  }
  try { stopMatchmaking(true); } catch (_) {}
  try { closeRoomLobby(); } catch (_) {}
  const myGen = ++mpCreateGen;
  // Leave finished/rematch room so server does not answer in_match
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient._skipAutoRejoin = true;
      MatchClient.leaveMatch();
      MatchClient.freeMatch && MatchClient.freeMatch();
    }
  } catch (_) {}
  try { roomMatchMode = false; BPState.roomMatchMode = false; } catch (_) {}
  try { postMatchOnlineEligible = false; } catch (_) {}
  // Soft reset without leavePrivate race before create
  try { if (typeof MatchClient !== 'undefined') MatchClient.leavePrivate(); } catch (_) {}
  mpPendingJoin = null;
  mpFromMatchmaking = false;
  mpGameSource = 'lobby';
  vsModeType = 'online';
  mpRole = 'host';
  mpMode = true;
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  mpLobbyDuration = 120;
  mpMatchStarting = false;
  mpRoomCode = null;
  setMpStatus('Создаю комнату…');
  try { bindMatchClientHandlers(); } catch (_) {}
  try { bindPrivateLobbyHandlers(); } catch (_) {}
  try { ensureFriendPresence(); } catch (_) {}
  let gotLobby = false;
  const onLobby = (data) => {
    if (myGen !== mpCreateGen) return;
    if (!data || data.role !== 'host') return;
    gotLobby = true;
    try { MatchClient.off('private_lobby', onLobby); } catch (_) {}
  };
  try { MatchClient.on('private_lobby', onLobby); } catch (_) {}

  (async () => {
    setMpStatus('Подключение к серверу…');
    const opened = await MatchClient.waitForOpen(8000);
    if (myGen !== mpCreateGen) return;
    if (!opened) {
      setMpStatus('Нет связи с сервером. Запусти: npm start и открой http://localhost:9000 (не file://).');
      return;
    }
    try { ensureFriendPresence(); } catch (_) {}
    setMpStatus('Создаю комнату…');
    MatchClient.createPrivate({
      name: myNickname,
      trophies: trophies | 0,
      skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
      boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
      avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
      avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
      duration: mpLobbyDuration || 120,
      friendCode: typeof myFriendCode !== 'undefined' ? myFriendCode : null
    });
    setTimeout(() => {
      if (myGen !== mpCreateGen || gotLobby || mpRoomCode) return;
      setMpStatus('Повтор создания комнаты…');
      MatchClient.createPrivate({
        name: myNickname,
        trophies: trophies | 0,
        skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
        boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
        avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
        avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
        duration: mpLobbyDuration || 120,
        friendCode: typeof myFriendCode !== 'undefined' ? myFriendCode : null
      });
      setTimeout(() => {
        if (myGen !== mpCreateGen) return;
        if (!mpRoomCode) {
          setMpStatus('Сервер не ответил. Открой сайт по адресу сервера (не file://).');
        }
      }, 4000);
    }, 3000);
  })();
}

function joinMpRoom(code, opts) {
  opts = opts || {};
  const fromChallenge = !!opts.fromChallenge;
  if (typeof MatchClient === 'undefined') {
    setMpStatus('Сервер матчей недоступен. Обнови страницу.');
    return;
  }
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) {
    setMpStatus('Введи код комнаты (5 символов)');
    return;
  }
  const myGen = ++mpJoinGen;
  destroyMp();
  hideRjToast(false);
  mpPendingJoin = null;
  mpRoomCode = code;
  mpRole = 'guest';
  mpMode = true;
  mpFromMatchmaking = false;
  mpGameSource = 'lobby';
  postMatchOnlineEligible = false;
  mmActive = false;
  mmFound = false;
  try { stopMatchmaking(true); } catch (_) {}
  try { document.getElementById('versusResult')?.classList.remove('visible'); } catch (_) {}
  try { showScreen('friends'); } catch (_) {}
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  mpLobbyDuration = 120;
  mpMatchStarting = false;
  setMpStatus(fromChallenge ? ('Входим в комнату вызова ' + code + '…') : ('Ищем комнату ' + code + '…'));
  try { bindMatchClientHandlers(); } catch (_) {}
  try { bindPrivateLobbyHandlers(); } catch (_) {}
  try { ensureFriendPresence(); } catch (_) {}
  try { MatchClient.connect(); } catch (_) {}
  MatchClient.joinPrivate(code, {
    name: myNickname,
    trophies: trophies | 0,
    skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
    boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
    avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
    avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
    friendCode: typeof myFriendCode !== 'undefined' ? myFriendCode : null
  });
  setTimeout(() => {
    if (myGen !== mpJoinGen) return;
    if (!mpOppConnected && mpRole === 'guest' && !mpRoomCode) {
      setMpStatus('Комната не найдена. Проверь код (5 символов) — хост должен держать лобби открытым.');
    }
  }, 5000);
}

