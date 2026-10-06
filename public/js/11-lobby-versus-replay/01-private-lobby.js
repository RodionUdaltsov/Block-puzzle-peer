/**
 * Block Puzzle — js/11-lobby-versus-replay/01-private-lobby.js
 * Private lobby handlers.
 * Shares the client bundle scope (order: public/js/modules.json).
 */

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
        try {
          if (typeof applyOppProfileFromServer === 'function') {
            applyOppProfileFromServer(data.opp, { alwaysPaint: true });
          } else {
            mpOppName = data.opp.name || 'Соперник';
            oppName = mpOppName;
            if (typeof data.opp.trophies === 'number') mpOppTrophies = data.opp.trophies | 0;
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
          }
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
          const hostOnly = mpRole === 'host';
          btn.disabled = !hostOnly;
          btn.setAttribute('aria-disabled', hostOnly ? 'false' : 'true');
          btn.style.pointerEvents = hostOnly ? '' : 'none';
          btn.style.opacity = hostOnly ? '' : '0.55';
          btn.style.cursor = hostOnly ? '' : 'default';
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
      // Guest was invited but lobby closed — drop toast + pending invite card
      try {
        const closed = data && data.code ? String(data.code).toUpperCase() : null;
        if (typeof chPending !== 'undefined' && chPending) {
          const pendRoom = chPending.room ? String(chPending.room).toUpperCase() : null;
          if (!closed || !pendRoom || pendRoom === closed) {
            chPending = null;
            if (typeof hideChToast === 'function') hideChToast(false);
          }
        }
        try { renderFriendRequests && renderFriendRequests(); updateFriendsSectionCounts && updateFriendsSectionCounts(); } catch (_) {}
      } catch (_) {}
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
            const cancelRoom = msg.room ? String(msg.room).toUpperCase() : null;
            if (typeof chPending !== 'undefined' && chPending) {
              const pendRoom = chPending.room ? String(chPending.room).toUpperCase() : null;
              if (!cancelRoom || !pendRoom || pendRoom === cancelRoom) {
                chPending = null;
                if (typeof hideChToast === 'function') hideChToast(false);
              }
            } else {
              if (typeof hideChToast === 'function') hideChToast(false);
            }
            try { renderFriendRequests && renderFriendRequests(); updateFriendsSectionCounts && updateFriendsSectionCounts(); } catch (_) {}
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

