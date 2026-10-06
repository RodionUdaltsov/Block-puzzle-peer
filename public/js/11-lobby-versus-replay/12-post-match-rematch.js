/**
 * Block Puzzle — js/11-lobby-versus-replay/12-post-match-rematch.js
 * Post-result replay and rematch invites.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
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
      if (postMatchOnlineEligible || (mpMode && vsModeType === 'online') || roomMatchMode || BPState.roomMatchMode) {
        // Room mode does not need server link
        if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
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
  // If score-duel / result still on screen — skip them immediately (match_found will also clean up)
  try { if (typeof dismissPostMatchResult === 'function') dismissPostMatchResult(); } catch (_) {}
  // Server room rematch
  if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
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
    if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
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
  navigateScreen('history', () => { try { renderHistory(); } catch (_) {} });
});
document.getElementById('btnHistoryBack')?.addEventListener('click', () => {
  navigateScreen('menu', () => { try { updateMenuStats(); } catch (_) {} });
});
document.getElementById('btnHistoryClear')?.addEventListener('click', () => {
  const run = () => {
    matchHistory = [];
    try { localStorage.setItem('bp_history', '[]'); } catch (_) {}
    try { renderHistory(); } catch (_) {}
    try { if (typeof scheduleHistorySync === 'function') scheduleHistorySync(); } catch (_) {}
  };
  if (typeof bpConfirm === 'function') {
    bpConfirm({
      title: 'Очистить историю?',
      text: 'Вся история матчей на этом устройстве будет удалена.',
      okLabel: 'Очистить',
      danger: true
    }).then(function (ok) { if (ok) run(); });
  } else if (window.confirm('Очистить всю историю матчей?')) {
    run();
  }
});
document.getElementById('btnFriends')?.addEventListener('click', () => {
  if (!requireOnline('Друзья')) return;
  setFriendAddStatus('');
  navigateScreen('friends', () => {
    try { renderFriends(); } catch (_) {}
    try { renderFriendRequests(); } catch (_) {}
    try { renderOutgoingPending(); } catch (_) {}
    try { ensureFriendPresence(); } catch (_) {}
    try { scheduleFriendsPresence(); } catch (_) {}
    try {
      if (typeof frIncoming !== 'undefined' && frIncoming && frIncoming[0] && typeof showFrToast === 'function') {
        const toast = document.getElementById('frToast');
        if (toast && !toast.classList.contains('visible')) showFrToast(frIncoming[0]);
      }
    } catch (_) {}
  });
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
  navigateScreen('menu', () => {
    try { closeRoomLobby(); } catch (_) {}
    if (mpRoomCode || (mpMode && !mmActive && mpGameSource !== 'ranked')) {
      try { destroyMp(); } catch (_) {}
      try { setMpStatus(''); } catch (_) {}
    }
    try { updateMenuStats(); } catch (_) {}
  });
});
document.getElementById('btnAddFriend')?.addEventListener('click', () => {
  addFriendByCode(document.getElementById('friendCodeInput').value);
});
document.getElementById('friendCodeInput')?.addEventListener('input', (e) => {
  const el = e.target;
  // Code field only: A–Z0–9, max 12 (server may assign longer unique codes)
  const clean = String(el.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (el.value !== clean) {
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

document.getElementById('btnFindByNick')?.addEventListener('click', () => {
  try { openNickSearchModal(''); } catch (_) {}
});
document.getElementById('btnNickSearchClose')?.addEventListener('click', () => {
  try { closeNickSearchModal(); } catch (_) {}
});
document.getElementById('btnNickSearchGo')?.addEventListener('click', () => {
  try { runNickSearchFromModal(); } catch (_) {}
});
document.getElementById('nickSearchInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    try { runNickSearchFromModal(); } catch (_) {}
  }
});
document.getElementById('nickSearchModal')?.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'nickSearchModal') {
    try { closeNickSearchModal(); } catch (_) {}
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
    // Only the host may change match duration; guest clicks do nothing
    if (mpRole !== 'host') return;
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

