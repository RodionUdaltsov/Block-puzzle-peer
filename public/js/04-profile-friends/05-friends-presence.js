/**
 * Block Puzzle — js/04-profile-friends/05-friends-presence.js
 * Friend presence, activity broadcast, mini profile.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function getFriendPresence(code) {
  code = normalizeFriendCode(code);
  return friendPresence[code] || 'checking';
}

function paintFriendStatusLine(code, state) {
  code = normalizeFriendCode(code);
  if (!code) return;
  const pres = state || getFriendPresence(code);
  const act = getFriendActivity(code);
  let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
  if (pres === 'online' && act) stText = activityLabel(act);
  try {
    document.querySelectorAll('.friend-card[data-code="' + code + '"], .lobby-invite-item[data-code="' + code + '"]').forEach(card => {
      const dot = card.querySelector('.f-online-dot');
      const st = card.querySelector('.f-status-line');
      if (dot) {
        dot.classList.remove('on', 'off', 'checking');
        dot.classList.add(pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking');
      }
      if (st) {
        st.classList.remove('on', 'off');
        if (pres === 'online') st.classList.add('on');
        else if (pres === 'offline') st.classList.add('off');
        st.textContent = stText;
      }
    });
  } catch (_) {}
}

function setFriendPresence(code, state) {
  code = normalizeFriendCode(code);
  if (!code) return;
  const prev = friendPresence[code];
  if (prev === state) {
    // Still refresh label (activity may have changed)
    if (state === 'online') paintFriendStatusLine(code, state);
    return;
  }
  friendPresence[code] = state;
  paintFriendStatusLine(code, state);
}

/** Apply live profile fields from presence_query / friend_profile onto local friends list. */
function applyFriendProfileUpdate(code, info) {
  code = normalizeFriendCode(code);
  if (!code || !info || typeof info !== 'object') return false;
  const f = friends.find(x => normalizeFriendCode(x.code) === code);
  if (!f) return false;
  let changed = false;
  if (info.name && typeof info.name === 'string') {
    const n = info.name.trim().slice(0, 24);
    // Prefer real nick over placeholder guest/player names
    if (n && n !== f.name) {
      f.name = n;
      changed = true;
    }
  }
  if (typeof info.trophies === 'number' && isFinite(info.trophies)) {
    const t = Math.max(0, info.trophies | 0);
    if (f.trophies !== t) { f.trophies = t; changed = true; }
  }
  if (info.avatarId && String(info.avatarId) !== String(f.avatarId || '')) {
    f.avatarId = String(info.avatarId).slice(0, 32);
    changed = true;
  }
  if (typeof info.avatarCustom === 'string' && info.avatarCustom && f.avatarId === 'custom') {
    if (f.avatarCustom !== info.avatarCustom) {
      f.avatarCustom = info.avatarCustom.slice(0, 49152);
      changed = true;
    }
  }
  if (typeof info.wins === 'number') f.wins = info.wins | 0;
  if (typeof info.played === 'number') f.played = info.played | 0;
  if (info.winrate != null && isFinite(info.winrate)) f.winrate = info.winrate | 0;
  if (typeof info.status === 'string') {
    const st = info.status.slice(0, 80);
    if (st !== (f.status || '')) { f.status = st; changed = true; }
  }
  if (changed) {
    try { saveFriends(); } catch (_) {}
  }
  return changed;
}

function probeFriendOnline(code) {
  code = normalizeFriendCode(code);
  if (!code) return Promise.resolve(false);
  if (typeof MatchClient === 'undefined') {
    setFriendPresence(code, 'offline');
    return Promise.resolve(false);
  }
  setFriendPresence(code, 'checking');
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try { MatchClient.off('presence_state', onState); } catch (_) {}
      setFriendPresence(code, ok ? 'online' : 'offline');
      resolve(!!ok);
    };
    const onState = (data) => {
      if (!data || !data.friends) return;
      const info = data.friends[code];
      if (info === undefined) return;
      try { applyFriendProfileUpdate(code, info); } catch (_) {}
      if (info && info.online) {
        if (info.activity) setFriendActivity(code, info.activity);
        finish(true);
      } else {
        finish(false);
      }
    };
    try { MatchClient.on('presence_state', onState); } catch (_) {}
    setTimeout(() => finish(false), 5000);
    try {
      MatchClient.queryPresence([code]);
    } catch (_) {
      finish(false);
    }
  });
}


async function refreshFriendsPresence() {
  if (friendPresenceBusy) return;
  if (!friends || !friends.length) return;
  if (typeof MatchClient === 'undefined') return;
  friendPresenceBusy = true;
  try {
    const codes = [];
    for (const f of friends.slice(0, 40)) {
      const c = normalizeFriendCode(f.code);
      if (c) codes.push(c);
    }
    if (!codes.length) {
      friendPresenceBusy = false;
      return;
    }
    for (const c of codes) setFriendPresence(c, 'checking');
    let settled = false;
    const onState = (data) => {
      if (settled || !data || !data.friends) return;
      settled = true;
      try { MatchClient.off('presence_state', onState); } catch (_) {}
      let anyProfileChange = false;
      for (const code of codes) {
        const info = data.friends[code];
        if (!info) {
          setFriendPresence(code, 'offline');
          continue;
        }
        try {
          if (applyFriendProfileUpdate(code, info)) anyProfileChange = true;
        } catch (_) {}
        if (info.online) {
          setFriendPresence(code, 'online');
          if (info.activity) setFriendActivity(code, info.activity);
        } else {
          setFriendPresence(code, 'offline');
        }
      }
      // Re-render friends list when names/avatars changed so UI stays in sync
      if (anyProfileChange) {
        try {
          const scr = document.getElementById('screenFriends');
          if (scr && scr.classList.contains('active')) renderFriends(false);
        } catch (_) {}
      } else {
        // Still refresh status lines without full re-render
        try {
          for (const code of codes) paintFriendStatusLine(code, getFriendPresence(code));
        } catch (_) {}
      }
      friendPresenceBusy = false;
    };
    try { MatchClient.on('presence_state', onState); } catch (_) {}
    setTimeout(() => {
      if (settled) return;
      settled = true;
      try { MatchClient.off('presence_state', onState); } catch (_) {}
      for (const c of codes) {
        if (getFriendPresence(c) === 'checking') setFriendPresence(c, 'offline');
      }
      friendPresenceBusy = false;
    }, 6000);
    try {
      MatchClient.queryPresence(codes);
    } catch (_) {
      settled = true;
      try { MatchClient.off('presence_state', onState); } catch (_) {}
      friendPresenceBusy = false;
    }
  } catch (_) {
    friendPresenceBusy = false;
  }
}

function scheduleFriendsPresence() {
  try { refreshFriendsPresence(); } catch (_) {}
  if (friendPresenceTimer) clearInterval(friendPresenceTimer);
  friendPresenceTimer = setInterval(() => {
    const scr = document.getElementById('screenFriends');
    const inv = document.getElementById('lobbyInviteModal');
    if ((scr && scr.classList.contains('active')) || (inv && inv.classList.contains('visible'))) {
      try { refreshFriendsPresence(); } catch (_) {}
      try { broadcastMyActivity(true); } catch (_) {}
    }
  }, 3000);
}

let activityBroadcastTimer = null;
let lastBroadcastActivity = null;
function broadcastMyActivity(force) {
  try {
    const act = detectMyActivity();
    if (!force && act === lastBroadcastActivity) return;
    lastBroadcastActivity = act;
    // Authoritative: update server presence so friends see us via presence_query
    if (typeof MatchClient !== 'undefined') {
      try { ensureFriendPresence(); } catch (_) {}
      try {
        if (typeof MatchClient.setActivity === 'function') MatchClient.setActivity(act);
        else MatchClient.send({ type: 'presence_activity', activity: act });
      } catch (_) {}
    }
  } catch (_) {}
}
function scheduleActivityBroadcast() {
  if (activityBroadcastTimer) clearTimeout(activityBroadcastTimer);
  activityBroadcastTimer = setTimeout(() => {
    activityBroadcastTimer = null;
    try { broadcastMyActivity(false); } catch (_) {}
  }, 400);
}

function closeFriendMiniProfile() {
  const modal = document.getElementById('friendMiniProfileModal');
  if (!modal) return;
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
  try { modal.style.display = ''; } catch (_) {}
}

function openFriendMiniProfile(friendOrCode) {
  let code = '';
  let local = null;
  if (friendOrCode && typeof friendOrCode === 'object') {
    local = friendOrCode;
    code = normalizeFriendCode(friendOrCode.code);
  } else {
    code = normalizeFriendCode(friendOrCode);
    local = friends.find(x => normalizeFriendCode(x.code) === code) || null;
  }
  if (!code) return;
  const modal = document.getElementById('friendMiniProfileModal');
  if (!modal) return;

  const nameEl = document.getElementById('friendMiniName');
  const codeEl = document.getElementById('friendMiniCode');
  const tropEl = document.getElementById('friendMiniTrophies');
  const wrEl = document.getElementById('friendMiniWinrate');
  const stEl = document.getElementById('friendMiniStatus');
  const avEl = document.getElementById('friendMiniAv');

  const paint = (p) => {
    const name = (p && p.name) || (local && local.name) || code;
    const trophies = (p && typeof p.trophies === 'number') ? (p.trophies | 0)
      : (local && typeof local.trophies === 'number') ? (local.trophies | 0) : 0;
    const avatarId = (p && p.avatarId) || (local && local.avatarId) || 'init';
    const avatarCustom = (p && p.avatarCustom) || (local && local.avatarCustom) || '';
    let winrateStr = '—';
    if (p && p.winrate != null && isFinite(p.winrate)) {
      winrateStr = (p.winrate | 0) + '%';
      if (typeof p.played === 'number' && p.played > 0) {
        winrateStr += ' (' + (p.wins | 0) + '/' + (p.played | 0) + ')';
      }
    } else if (local && local.winrate != null && isFinite(local.winrate)) {
      winrateStr = (local.winrate | 0) + '%';
    }
    if (nameEl) nameEl.textContent = name;
    // Under nick: profile status text (not the code in CAPS)
    const profileStatus = (p && typeof p.status === 'string' && p.status.trim())
      ? p.status.trim()
      : (local && typeof local.status === 'string' && local.status.trim())
        ? local.status.trim()
        : '';
    if (codeEl) {
      codeEl.textContent = profileStatus || '';
      codeEl.style.display = profileStatus ? '' : 'none';
      codeEl.classList.toggle('friend-mini-status-text', !!profileStatus);
    }
    if (tropEl) tropEl.textContent = '🏆 ' + trophies;
    if (wrEl) wrEl.textContent = winrateStr;
    // Online / activity line
    if (stEl) {
      const online = p ? !!p.online : (getFriendPresence(code) === 'online');
      const act = (p && p.activity) || getFriendActivity(code);
      if (online) {
        stEl.textContent = act ? activityLabel(act) : 'В сети';
        stEl.style.color = '#3dce6a';
      } else {
        stEl.textContent = 'Не в сети';
        stEl.style.color = '';
      }
    }
    if (avEl) {
      avEl.innerHTML = '';
      try {
        renderAvatarInto(avEl, {
          avatarId: avatarId,
          nick: name,
          custom: (avatarId === 'custom' && avatarCustom) ? avatarCustom : null,
          big: true
        });
      } catch (_) {
        avEl.textContent = String(name || code).slice(0, 2).toUpperCase();
      }
    }
  };

  // Show immediately with local data, then refresh from server
  paint(null);
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  try { modal.style.display = 'flex'; } catch (_) {}

  if (typeof MatchClient === 'undefined') return;
  let settled = false;
  const onRes = (data) => {
    if (settled) return;
    if (!data || normalizeFriendCode(data.code) !== code) return;
    settled = true;
    try { MatchClient.off('friend_profile_result', onRes); } catch (_) {}
    if (data.ok === false) return;
    try { applyFriendProfileUpdate(code, data); } catch (_) {}
    paint(data);
    // Keep friends list in sync if still on the screen
    try {
      const scr = document.getElementById('screenFriends');
      if (scr && scr.classList.contains('active')) renderFriends(false);
    } catch (_) {}
  };
  try { MatchClient.on('friend_profile_result', onRes); } catch (_) {}
  try {
    if (typeof MatchClient.friendProfile === 'function') MatchClient.friendProfile(code);
    else MatchClient.send({ type: 'friend_profile', code: code });
  } catch (_) {}
  setTimeout(() => {
    if (settled) return;
    settled = true;
    try { MatchClient.off('friend_profile_result', onRes); } catch (_) {}
  }, 8000);
}

(function bindFriendMiniProfileUI() {
  if (window._friendMiniBound) return;
  window._friendMiniBound = true;
  document.getElementById('btnFriendMiniClose')?.addEventListener('click', closeFriendMiniProfile);
  document.getElementById('btnFriendMiniClose2')?.addEventListener('click', closeFriendMiniProfile);
  document.getElementById('friendMiniProfileModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'friendMiniProfileModal') closeFriendMiniProfile();
  });
})();
