/**
 * Block Puzzle — 04-profile-friends.js
 * Guest profile, avatars, friends presence/social via MatchClient
 * Lines ~2456-4983 from legacy game.js monolith (refactored).
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

// —— Profile (guest) ——
const AVATAR_PRESETS = [
  { id: 'init', kind: 'initials', bg: 'linear-gradient(135deg,#00d4aa,#7c5cff)' },
  { id: 'init2', kind: 'initials', bg: 'linear-gradient(135deg,#ff9f43,#ff5c7a)' },
  { id: 'init3', kind: 'initials', bg: 'linear-gradient(135deg,#4fc3f7,#7c5cff)' },
  { id: 'init4', kind: 'initials', bg: 'linear-gradient(135deg,#ffd666,#ff9f43)' },
  { id: 'init5', kind: 'initials', bg: 'linear-gradient(135deg,#c77dff,#5ee7ff)' },
  { id: 'e1', kind: 'emoji', emoji: '😎', bg: 'linear-gradient(145deg,#1a2a36,#0f1820)' },
  { id: 'e2', kind: 'emoji', emoji: '🔥', bg: 'linear-gradient(145deg,#2a1810,#1a0e08)' },
  { id: 'e3', kind: 'emoji', emoji: '💎', bg: 'linear-gradient(145deg,#0e2430,#081820)' },
  { id: 'e4', kind: 'emoji', emoji: '🎮', bg: 'linear-gradient(145deg,#1a1830,#100e20)' },
  { id: 'e5', kind: 'emoji', emoji: '⚡', bg: 'linear-gradient(145deg,#242010,#181408)' },
  { id: 'e6', kind: 'emoji', emoji: '🦊', bg: 'linear-gradient(145deg,#2a1c14,#1a1008)' },
  { id: 'e7', kind: 'emoji', emoji: '🐱', bg: 'linear-gradient(145deg,#221a20,#140e14)' },
  { id: 'e8', kind: 'emoji', emoji: '🚀', bg: 'linear-gradient(145deg,#101828,#0a1018)' },
  { id: 'e9', kind: 'emoji', emoji: '🌟', bg: 'linear-gradient(145deg,#242018,#141008)' },
  { id: 'e10', kind: 'emoji', emoji: '🧊', bg: 'linear-gradient(145deg,#0e2030,#081018)' },
  { id: 'e11', kind: 'emoji', emoji: '🎯', bg: 'linear-gradient(145deg,#201018,#14080c)' },
  { id: 'e12', kind: 'emoji', emoji: '🍀', bg: 'linear-gradient(145deg,#102018,#081210)' },
  { id: 'e13', kind: 'emoji', emoji: '🦄', bg: 'linear-gradient(145deg,#241428,#140c18)' },
  { id: 'e14', kind: 'emoji', emoji: '👾', bg: 'linear-gradient(145deg,#1a1430,#0c0a18)' },
  { id: 'e15', kind: 'emoji', emoji: '👑', bg: 'linear-gradient(145deg,#2a2410,#181408)' },
];
let myAvatarId = localStorage.getItem('bp_avatar') || 'init';
let myStatus = '';
try { myStatus = localStorage.getItem('bp_status') || ''; } catch (_) { myStatus = ''; }
let profileDraft = { nick: myNickname, avatarId: myAvatarId, status: myStatus };

function getAvatarPreset(id) {
  return AVATAR_PRESETS.find(a => a.id === id) || AVATAR_PRESETS[0];
}
function profileInitials(name) {
  const n = String(name || 'Гость').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  let s;
  if (parts.length >= 2) s = (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  else s = n.slice(0, 2).toUpperCase();
  // Pure digits look broken in avatar grid — mix in a letter
  if (/^\d+$/.test(s)) {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
    s = letters[Math.abs(h) % letters.length] + s[0];
  }
  return s;
}
let myAvatarCustom = '';
try { myAvatarCustom = localStorage.getItem('bp_avatar_custom') || ''; } catch (_) { myAvatarCustom = ''; }

function renderAvatarInto(el, opts) {
  if (!el) return;
  opts = opts || {};
  const id = opts.avatarId || myAvatarId;
  const nick = opts.nick != null ? opts.nick : myNickname;
  const customUrl = (opts.custom != null) ? opts.custom : myAvatarCustom;
  el.innerHTML = '';
  el.classList.remove('has-photo');
  // Reset previous photo/gradient so switching presets is clean
  el.style.background = '';
  el.style.backgroundImage = '';
  el.style.backgroundSize = '';
  el.style.backgroundPosition = '';
  el.style.backgroundRepeat = '';
  el.style.backgroundColor = '';
  if (id === 'custom' && customUrl) {
    el.style.backgroundColor = 'transparent';
    el.style.backgroundImage = 'url(' + JSON.stringify(customUrl) + ')';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.color = 'transparent';
    el.textContent = '';
    el.classList.add('has-photo');
    return;
  }
  const preset = getAvatarPreset(id);
  // Gradient must be set via background (shorthand) and NOT cleared with backgroundImage='none'
  el.style.background = preset.bg;
  if (preset.kind === 'emoji') {
    el.textContent = preset.emoji;
    el.style.fontSize = opts.big ? '1.85rem' : (opts.size === 'duel' ? '1.45rem' : '1rem');
    el.style.color = '#fff';
  } else {
    el.textContent = profileInitials(nick);
    el.style.fontSize = opts.big ? '1.55rem' : (opts.size === 'duel' ? '1.1rem' : '0.85rem');
    el.style.color = '#04120e';
  }
}

function compressAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Нужно изображение'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Файл слишком большой (макс. 8 МБ)'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const max = 160;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let data = c.toDataURL('image/jpeg', 0.82);
        // shrink if still huge
        if (data.length > 180000) data = c.toDataURL('image/jpeg', 0.65);
        if (data.length > 220000) data = c.toDataURL('image/jpeg', 0.5);
        URL.revokeObjectURL(url);
        resolve(data);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать фото')); };
    img.src = url;
  });
}
function sanitizeNick(raw) {
  let s = String(raw || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length > 9) s = s.slice(0, 9);
  return s;
}
function saveProfile(data) {
  const nick = sanitizeNick(data.nick);
  if (nick.length < 2) return { ok: false, err: 'Ник слишком короткий (мин. 2)' };
  const prevNick = myNickname;
  const prevAv = myAvatarId;
  const prevStatus = myStatus;
  myNickname = nick;
  myAvatarId = data.avatarId || myAvatarId;
  myStatus = String(data.status || '').slice(0, 48);
  if (data.custom != null) myAvatarCustom = data.custom;
  try {
    if (myNickname && myNickname !== prevNick && !/^Player/i.test(myNickname)) setAchStat('profileNick', 1);
    if (myAvatarId && myAvatarId !== prevAv) setAchStat('profileAvatar', 1);
    if (myAvatarId === 'custom' && myAvatarCustom) setAchStat('profileCustom', 1);
    if (myStatus && myStatus !== prevStatus) setAchStat('profileStatus', 1);
    checkNewAchievements();
  } catch (_) {}
  try {
    localStorage.setItem('bp_nickname', myNickname);
    localStorage.setItem('bp_avatar', myAvatarId);
    localStorage.setItem('bp_status', myStatus);
    if (myAvatarId === 'custom' && myAvatarCustom) {
      localStorage.setItem('bp_avatar_custom', myAvatarCustom);
    }
  } catch (e) {
    if (myAvatarId === 'custom') {
      return { ok: false, err: 'Не хватило места для фото — выбери пресет' };
    }
  }
  refreshProfileUI();
  try { updateMenuStats(); } catch (_) {}
  return { ok: true };
}
function refreshProfileUI() {
  renderAvatarInto(document.getElementById('homeProfileAv'), { avatarId: myAvatarId, nick: myNickname });
  const hn = document.getElementById('homeProfileName');
  if (hn) hn.textContent = myNickname || (typeof globalThis.t==='function'?globalThis.t('js.guest','Гость'):'Гость');
  renderAvatarInto(document.getElementById('profileAvBig'), { avatarId: myAvatarId, nick: myNickname, big: true });
  const heroN = document.getElementById('profileHeroName');
  if (heroN) heroN.textContent = myNickname || (typeof globalThis.t==='function'?globalThis.t('js.guest','Гость'):'Гость');
  const prev = document.getElementById('profileStatusPreview');
  if (prev) prev.textContent = myStatus || '';
  const codeEl = document.getElementById('profileFriendCode');
  if (codeEl) codeEl.textContent = myFriendCode;
  const stT = document.getElementById('profStatTrophies');
  const stD = document.getElementById('profStatDiamonds');
  const stB = document.getElementById('profStatBest');
  const stS = document.getElementById('profStatStars');
  if (stT) stT.textContent = typeof trophies === 'number' ? trophies : 0;
  if (stD) stD.textContent = typeof diamonds === 'number' ? diamonds : 0;
  if (stB) stB.textContent = typeof best === 'number' ? best : 0;
  try { if (stS) stS.textContent = totalSilverStars() + '/' + maxSilverStars(); } catch (_) {}
  // Sync duel avatar if present
  try {
    const avMe = document.getElementById('duelAvMeInner');
    if (avMe) renderAvatarInto(avMe, { avatarId: myAvatarId, nick: myNickname, size: 'duel' });
  } catch (_) {}
}
function renderProfileAvatarGrid() {
  const grid = document.getElementById('profileAvatarGrid');
  if (!grid) return;
  const selected = profileDraft.avatarId || myAvatarId;
  const customUrl = profileDraft.custom != null ? profileDraft.custom : myAvatarCustom;
  const customSel = selected === 'custom' ? ' selected' : '';
  let html = '';
  // upload / custom slot first
  if (customUrl) {
    html += `<button type="button" class="profile-av-opt custom-upload${customSel}" data-av="custom" role="option" aria-selected="${selected === 'custom'}" title="Своё фото"></button>`;
  } else {
    html += `<button type="button" class="profile-av-opt custom-upload${customSel}" data-av="upload" role="option" title="Загрузить фото">＋</button>`;
  }
  html += AVATAR_PRESETS.map(p => {
    const sel = p.id === selected ? ' selected' : '';
    let content;
    if (p.kind === 'emoji') {
      content = p.emoji || '⭐';
    } else {
      // Always show nickname initials on every initials skin (different gradient only)
      content = profileInitials(profileDraft.nick || myNickname);
    }
    const emojiCls = p.kind === 'emoji' ? ' is-emoji' : ' is-initials';
    return `<button type="button" class="profile-av-opt${emojiCls}${sel}" data-av="${p.id}" role="option" aria-selected="${p.id === selected}" style="background:${p.bg}">${content}</button>`;
  }).join('');
  grid.innerHTML = html;
  const customBtn = grid.querySelector('[data-av="custom"]');
  if (customBtn && customUrl) {
    customBtn.style.backgroundImage = 'url("' + customUrl.replace(/"/g, '%22') + '")';
    customBtn.style.backgroundSize = 'cover';
    customBtn.style.backgroundPosition = 'center';
    customBtn.textContent = '';
  }
  grid.querySelectorAll('.profile-av-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const av = btn.dataset.av;
      if (av === 'upload') {
        const fi = document.getElementById('profileAvatarFile');
        if (fi) fi.click();
        return;
      }
      if (av === 'custom') {
        profileDraft.avatarId = 'custom';
        renderProfileAvatarGrid();
        renderAvatarInto(document.getElementById('profileAvBig'), {
          avatarId: 'custom',
          nick: profileDraft.nick || myNickname,
          custom: customUrl,
          big: true
        });
        try { SFX.ui(); } catch (_) {}
        return;
      }
      profileDraft.avatarId = av;
      renderProfileAvatarGrid();
      renderAvatarInto(document.getElementById('profileAvBig'), {
        avatarId: profileDraft.avatarId,
        nick: profileDraft.nick || myNickname,
        big: true
      });
      try { SFX.ui(); } catch (_) {}
    });
  });
}
function openProfileScreen() {
  profileDraft = { nick: myNickname, avatarId: myAvatarId, status: myStatus, custom: myAvatarCustom };
  const nickIn = document.getElementById('profileNickInput');
  const stIn = document.getElementById('profileStatusInput');
  if (nickIn) nickIn.value = myNickname;
  if (stIn) stIn.value = myStatus;
  renderProfileAvatarGrid();
  refreshProfileUI();
  renderAvatarInto(document.getElementById('profileAvBig'), {
    avatarId: profileDraft.avatarId,
    nick: profileDraft.nick,
    big: true
  });
  showScreen('profile');
}

let friends = [];
try { friends = JSON.parse(localStorage.getItem('bp_friends') || '[]'); } catch (_) { friends = []; }
function saveFriends() { localStorage.setItem('bp_friends', JSON.stringify(friends)); }

const screens = {
  menu: document.getElementById('screenMenu'),
  settings: document.getElementById('screenSettings'),
  history: document.getElementById('screenHistory'),
  friends: document.getElementById('screenFriends'),
  compType: document.getElementById('screenCompType'),
  difficulty: document.getElementById('screenDifficulty'),
  achievements: document.getElementById('screenAchievements'),
  duration: document.getElementById('screenDuration'),
  match: document.getElementById('screenMatch'),
  classic: document.getElementById('screenClassic'),
  versus: document.getElementById('screenVersus'),
  shop: document.getElementById('screenShop'),
  inventory: document.getElementById('screenInventory'),
  profile: document.getElementById('screenProfile'),
};

// —— Friends: presence + requests via WebSocket MatchClient ——
function friendRelayKey(code) {
  // Legacy id helper (server removed). Kept for rare log keys only.
  return 'bp-friend-' + normalizeFriendCode(code);
}

let frSessionLink = null;
let frSessionReady = false;
let frIncoming = []; // { code, name, trophies, conn, ts }
let frSearchBusy = false;
let frActiveToast = null; // current toast request
let frOutgoingTimer = null;
/** Outgoing friend requests awaiting accept/decline: { code, name, ts } */
let frOutgoingPending = [];
/** code -> 'online' | 'offline' | 'checking' */
let friendPresence = {};
let friendPresenceBusy = false;
let friendPresenceTimer = null;
/** code -> activity string from last pong/ping */
let friendActivity = {};
/** Local activity broadcast to friends */
let myActivity = 'menu';
function activityLabel(act) {
  const a = String(act || '').toLowerCase();
  if (a === 'classic') return 'Классика';
  if (a === 'versus_bots' || a === 'training' || a === 'bots') return 'Играет с ботом';
  if (a === 'ranked' || a === 'queue' || a === 'matchmaking') return 'Поиск матча';
  if (a === 'lobby' || a === 'room' || a === 'private') return 'В лобби';
  if (a === 'versus' || a === 'online' || a === 'match' || a === 'live') return 'В матче';
  if (a === 'shop' || a === 'inventory') return 'Магазин';
  if (a === 'settings') return 'Настройки';
  if (a === 'friends') return 'В друзьях';
  if (a === 'history') return 'История';
  if (a === 'achievements') return 'Достижения';
  if (a === 'difficulty' || a === 'duration' || a === 'comptype') return 'Выбор режима';
  if (a === 'menu') return 'В меню';
  if (a === 'offline') return 'Не в сети';
  return 'В сети';
}
function detectMyActivity() {
  try {
    // Live match / lobby take priority over which screen class is active
    if (typeof mmActive !== 'undefined' && mmActive) {
      myActivity = 'ranked';
      return myActivity;
    }
    if ((typeof roomMatchMode !== 'undefined' && roomMatchMode) || BPState.roomMatchMode) {
      if (typeof vsActive !== 'undefined' && vsActive) {
        myActivity = 'match';
        return myActivity;
      }
      myActivity = 'lobby';
      return myActivity;
    }
    if (typeof mpRoomCode !== 'undefined' && mpRoomCode) {
      myActivity = 'lobby';
      return myActivity;
    }
    const lobbyEl = document.getElementById('roomLobby');
    if (lobbyEl && lobbyEl.classList.contains('visible')) {
      myActivity = 'lobby';
      return myActivity;
    }
    const active = document.querySelector('.screen.active');
    const id = (active && active.id) || '';
    const raw = id.replace(/^screen/, '');
    const map = {
      Menu: 'menu', Classic: 'classic', Versus: 'versus', Settings: 'settings',
      Match: 'match', Friends: 'friends', History: 'history', Achievements: 'achievements',
      CompType: 'comptype', Difficulty: 'difficulty', Duration: 'duration',
      Shop: 'shop', Inventory: 'inventory'
    };
    let act = map[raw] || 'menu';
    if (act === 'versus') {
      if (vsModeType === 'bots' || currentBot) act = 'versus_bots';
      else if (vsModeType === 'online' || mpMode) act = 'match';
    }
    if (act === 'match' && (vsModeType === 'bots' || currentBot)) act = 'versus_bots';
    myActivity = act;
    return act;
  } catch (_) {
    return myActivity || 'menu';
  }
}
function getFriendActivity(code) {
  code = normalizeFriendCode(code);
  return friendActivity[code] || null;
}
function setFriendActivity(code, act) {
  code = normalizeFriendCode(code);
  if (!code) return;
  const next = act ? String(act) : null;
  const prev = friendActivity[code] || null;
  if (next) friendActivity[code] = next;
  else delete friendActivity[code];
  if (prev !== next) {
    // Live update status line without leaving the Friends tab
    try { paintFriendStatusLine(code); } catch (_) {}
  }
}
try {
  frOutgoingPending = JSON.parse(localStorage.getItem('bp_fr_out') || '[]') || [];
  if (!Array.isArray(frOutgoingPending)) frOutgoingPending = [];
} catch (_) { frOutgoingPending = []; }

function saveOutgoingPending() {
  try { localStorage.setItem('bp_fr_out', JSON.stringify(frOutgoingPending.slice(0, 20))); } catch (_) {}
}
function addOutgoingPending(code, name) {
  code = normalizeFriendCode(code);
  if (!code) return;
  frOutgoingPending = frOutgoingPending.filter(p => p.code !== code);
  // Prefer real nickname; never display raw code as the title (avoids code→name flicker)
  let displayName = (name || '').toString().trim().slice(0, 20);
  if (!displayName || displayName.toUpperCase() === code) {
    displayName = 'Игрок';
  }
  frOutgoingPending.unshift({
    code,
    name: displayName,
    namePending: displayName === 'Игрок',
    ts: Date.now()
  });
  saveOutgoingPending();
  renderOutgoingPending(true);
}

/** Update outgoing card name in-place (no full re-render / no flash) */
function updateOutgoingPendingName(code, name) {
  code = normalizeFriendCode(code);
  const p = frOutgoingPending.find(x => x.code === code);
  if (!p) return;
  const n = String(name || '').trim().slice(0, 20);
  if (!n) return;
  p.name = n;
  p.namePending = false;
  saveOutgoingPending();
  const list = document.getElementById('friendOutList');
  if (!list) return;
  const card = list.querySelector('.friend-req-card[data-code="' + code + '"]');
  if (!card) {
    renderOutgoingPending(false);
    return;
  }
  const nameEl = card.querySelector('.f-name');
  const av = card.querySelector('.f-av');
  if (nameEl) nameEl.textContent = n;
  if (av) {
    // keep only initials text node; preserve structure
    const initials = n.slice(0, 2).toUpperCase();
    // replace first text content carefully
    let replaced = false;
    av.childNodes.forEach(node => {
      if (node.nodeType === 3 && node.textContent.trim()) {
        node.textContent = initials;
        replaced = true;
      }
    });
    if (!replaced) {
      // prepend text
      av.insertBefore(document.createTextNode(initials), av.firstChild);
    }
  }
}
function removeOutgoingPending(code) {
  code = normalizeFriendCode(code);
  frOutgoingPending = frOutgoingPending.filter(p => p.code !== code);
  saveOutgoingPending();
  renderOutgoingPending(false);
  updateFriendsSectionCounts();
}

/** Notify recipient that we cancelled the friend request */
function notifyFriendReqCancel(targetCode) {
  targetCode = normalizeFriendCode(targetCode);
  if (!targetCode) return;
  try {
    deliverSocialMessage(targetCode, {
      type: 'friend_req_cancel',
      code: myFriendCode,
      name: myNickname
    });
  } catch (_) {}
}

function cancelOutgoingRequest(code) {
  code = normalizeFriendCode(code);
  if (!code) return;
  const list = document.getElementById('friendOutList');
  const card = list && (
    list.querySelector('.friend-req-card[data-code="' + code + '"]') ||
    (list.querySelector('.fr-out-cancel[data-code="' + code + '"]') &&
      list.querySelector('.fr-out-cancel[data-code="' + code + '"]').closest('.friend-req-card'))
  );
  const finish = () => {
    removeOutgoingPending(code);
    if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
    frSearchBusy = false;
    notifyFriendReqCancel(code);
    setFriendAddStatus('Заявка отменена', 'ok');
    try { SFX.ui(); } catch (_) {}
  };
  if (card) {
    card.classList.add('friend-exit');
    setTimeout(finish, 360);
  } else {
    finish();
  }
  try { refreshFriendFindCards(); } catch (_) {}
}

function updateFriendsSectionCounts() {
  let reqN = (frIncoming ? frIncoming.length : 0) + (frOutgoingPending ? frOutgoingPending.length : 0);
  try {
    if (typeof chPending !== 'undefined' && chPending && chPending.room) reqN += 1;
    if (typeof rmPending !== 'undefined' && rmPending) reqN += 1;
  } catch (_) {}
  const reqCount = document.getElementById('friendsReqCount');
  const listCount = document.getElementById('friendsListCount');
  const empty = document.getElementById('friendsReqEmpty');
  if (reqCount) reqCount.textContent = String(reqN);
  if (listCount) listCount.textContent = String(friends ? friends.length : 0);
  if (empty) empty.style.display = reqN ? 'none' : '';
}

function renderOutgoingPending(animateEnter) {
  const list = document.getElementById('friendOutList');
  if (!list) return;
  const week = 7 * 24 * 3600 * 1000;
  frOutgoingPending = frOutgoingPending.filter(p => p && p.code && (Date.now() - (p.ts || 0)) < week);
  saveOutgoingPending();
  if (!frOutgoingPending.length) {
    list.innerHTML = '';
    updateFriendsSectionCounts();
    return;
  }
  const existing = new Map();
  list.querySelectorAll('.friend-req-card[data-code]').forEach(el => {
    existing.set(el.getAttribute('data-code'), el);
  });
  const keepCodes = new Set(frOutgoingPending.map(p => p.code));
  existing.forEach((el, code) => {
    if (!keepCodes.has(code) && !el.classList.contains('friend-exit')) el.remove();
  });
  frOutgoingPending.forEach((p, i) => {
    let card = existing.get(p.code);
    const ts = p.ts ? new Date(p.ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const label = (p.name && p.name.toUpperCase() !== p.code) ? p.name : (typeof globalThis.t==='function'?globalThis.t('js.player','Игрок'):'Игрок');
    if (card) {
      const nameEl = card.querySelector('.f-name');
      const metaEl = card.querySelector('.f-meta');
      const av = card.querySelector('.f-av');
      if (nameEl && nameEl.textContent !== label) nameEl.textContent = label;
      if (metaEl) metaEl.textContent = (typeof globalThis.t==='function'?globalThis.t('js.outgoing','Исходящая'):'Исходящая') + ' · ' + p.code + (ts ? ' · ' + ts : '');
      if (av) {
        const initials = label.slice(0, 2).toUpperCase();
        av.childNodes.forEach(node => {
          if (node.nodeType === 3 && node.textContent.trim()) node.textContent = initials;
        });
      }
      return;
    }
    card = document.createElement('div');
    card.className = 'friend-req-card' + (animateEnter ? ' friend-enter' : '');
    card.setAttribute('data-code', p.code);
    card.style.opacity = '0.95';
    card.innerHTML =
      '<div class="f-av">' + label.slice(0, 2).toUpperCase() + '</div>' +
      '<div class="f-info">' +
        '<div class="f-name">' + label.replace(/</g, '') + '</div>' +
        '<div class="f-meta">' + (typeof globalThis.t==='function'?globalThis.t('js.outgoing','Исходящая'):'Исходящая') + ' · ' + p.code + (ts ? ' · ' + ts : '') + '</div>' +
      '</div>' +
      '<div class="f-actions">' +
        '<button type="button" class="ghost fr-out-cancel" data-code="' + p.code + '">✕</button>' +
      '</div>';
    list.appendChild(card);
    const cancelBtn = card.querySelector('.fr-out-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { cancelOutgoingRequest(p.code); } catch (_) {}
      });
    }
  });
  updateFriendsSectionCounts();
}

function setFriendAddStatus(msg, kind) {
  const el = document.getElementById('friendAddStatus');
  if (el) {
    el.textContent = msg || '';
    el.className = 'friend-add-status' + (kind ? ' ' + kind : '');
  }
}

/** Deliver social message via server relay (replaces server one-shot). */
function deliverSocialMessage(code, payload, opts) {
  opts = opts || {};
  code = normalizeFriendCode(code);
  if (!code || typeof MatchClient === 'undefined') return Promise.resolve(false);
  const timeoutMs = opts.timeoutMs || 10000;
  const msgType = (payload && payload.type) ? payload.type : 'message';
  const body = Object.assign({}, payload || {});
  delete body.type;
  return new Promise(async (resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { MatchClient.off('social_result', onResult); } catch (_) {}
      resolve(!!ok);
    };
    const onResult = (data) => {
      if (!data) return;
      const to = normalizeFriendCode(data.to || '');
      if (to && to !== code) return;
      if (data.msgType && data.msgType !== msgType) return;
      finish(!!data.ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try { MatchClient.on('social_result', onResult); } catch (_) {}
    try {
      // Register presence BEFORE send so target can find us too
      try { ensureFriendPresence(); } catch (_) {}
      const opened = await MatchClient.waitForOpen(Math.min(7000, timeoutMs - 500));
      if (!opened) {
        finish(false);
        return;
      }
      try { ensureFriendPresence(); } catch (_) {}
      // Small delay so presence_register is processed before social_send
      await new Promise(r => setTimeout(r, 120));
      MatchClient.socialSend(code, msgType, body, {
        name: myNickname,
        trophies: typeof trophies === 'number' ? trophies : 0,
        activity: (typeof detectMyActivity === 'function' ? detectMyActivity() : 'online'),
        from: myFriendCode
      });
    } catch (_) {
      finish(false);
    }
  });
}

function applyIncomingFriendAccept(data) {
  const code = normalizeFriendCode(data && data.code);
  if (!code || code === myFriendCode) return;
  const theirName = (data.name || ('Игрок ' + code.slice(0, 3))).toString().slice(0, 20);
  if (typeof data.activity === 'string') setFriendActivity(code, data.activity);
  const wasPending = frOutgoingPending.some(p => p.code === code);
  const added = addFriendRecord(code, theirName, { trophies: data.trophies });
  removeOutgoingPending(code);
  try { setFriendPresence(code, 'online'); } catch (_) {}
  try { renderFriends(!!(added || wasPending)); } catch (_) {}
  try { renderOutgoingPending(false); } catch (_) {}
  try { updateFriendsSectionCounts(); } catch (_) {}
  try { refreshFriendFindCards(); } catch (_) {}
  if (wasPending || added) {
    try {
      setFriendAddStatus('✓ ' + theirName + ' принял(а) заявку!', 'ok');
    } catch (_) {}
    try { SFX.win && SFX.win(); } catch (_) {}
  }
}

function applyIncomingFriendDecline(data) {
  const code = normalizeFriendCode(data && data.code);
  if (!code) return;
  const wasPending = frOutgoingPending.some(p => p.code === code);
  removeOutgoingPending(code);
  if (wasPending) {
    try { setFriendAddStatus('Заявка отклонена', 'err'); } catch (_) {}
    try { SFX.bad && SFX.bad(); } catch (_) {}
  }
  try { renderOutgoingPending(false); } catch (_) {}
  try { updateFriendsSectionCounts(); } catch (_) {}
  try { refreshFriendFindCards(); } catch (_) {}
}

function ensureFriendPresence() {
  if (typeof MatchClient === 'undefined' || !myFriendCode) return;
  try {
    var hint = null;
    try {
      hint = {
        diamonds: typeof diamonds === 'number' ? diamonds : 0,
        ownedSkins: typeof ownedSkins !== 'undefined' ? ownedSkins.slice() : undefined,
        ownedBoards: typeof ownedBoards !== 'undefined' ? ownedBoards.slice() : undefined,
        equippedSkin: typeof equippedSkinId !== 'undefined' ? equippedSkinId : undefined,
        equippedBoard: typeof equippedBoardId !== 'undefined' ? equippedBoardId : undefined
      };
    } catch (_) {}
    MatchClient.registerPresence({
      friendCode: myFriendCode,
      name: myNickname || 'Игрок',
      activity: (typeof detectMyActivity === 'function' ? detectMyActivity() : 'online'),
      trophies: typeof trophies === 'number' ? trophies : 0,
      cosmeticsHint: hint
    });
  } catch (_) {}
}


function normalizeFriendCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function clearFriendRequestState(code) {
  code = normalizeFriendCode(code);
  if (!code) return;
  frIncoming = frIncoming.filter(r => r.code !== code);
  if (frActiveToast && frActiveToast.code === code) dismissFrToast(false);
  frOutgoingPending = frOutgoingPending.filter(p => p.code !== code);
  saveOutgoingPending();
}

function addFriendRecord(code, name, extra) {
  code = normalizeFriendCode(code);
  if (!code || code === myFriendCode) return false;
  // Becoming friends clears any mutual hanging requests both ways locally
  clearFriendRequestState(code);
  if (friends.some(f => f.code === code)) {
    // update name if empty
    const f = friends.find(x => x.code === code);
    if (f && name && (!f.name || f.name.startsWith('Friend'))) f.name = name;
    saveFriends();
    try { renderFriendRequests(); renderOutgoingPending(); updateFriendsSectionCounts(); } catch (_) {}
    return false;
  }
  friends.unshift({
    code,
    name: (name || ('Игрок ' + code.slice(0, 3))).trim().slice(0, 20),
    added: Date.now(),
    trophies: extra && typeof extra.trophies === 'number' ? extra.trophies : undefined
  });
  saveFriends();
  try { renderFriendRequests(); renderOutgoingPending(); updateFriendsSectionCounts(); } catch (_) {}
  return true;
}

function handleIncomingFriendReq(data, conn) {
  const code = normalizeFriendCode(data.code || data.from);
  if (!code || code === myFriendCode) {
    return;
  }
  // Always ack so sender sees «на рассмотрении»
  try {
    deliverSocialMessage(code, {
      type: 'friend_req_ack',
      code: myFriendCode,
      name: myNickname
    });
  } catch (_) {}
  try {
    if (conn && conn.open) {
      conn.send({
        type: 'friend_req_ack',
        code: myFriendCode,
        name: myNickname
      });
    }
  } catch (_) {}
  if (friends.some(f => f.code === code)) {
    const accPayload = {
      type: 'friend_accept',
      code: myFriendCode,
      name: myNickname,
      trophies: typeof trophies === 'number' ? trophies : 0,
      already: true,
      activity: detectMyActivity()
    };
    try { conn.send(accPayload); } catch (_) {}
    try { deliverSocialMessage(code, accPayload); } catch (_) {}
    clearFriendRequestState(code);
    renderFriendRequests();
    renderOutgoingPending();
    return;
  }
  // Mutual: we already sent them a request — auto-accept both sides
  const hadOutgoing = frOutgoingPending.some(p => p.code === code);
  if (hadOutgoing) {
    const accPayload = {
      type: 'friend_accept',
      code: myFriendCode,
      name: myNickname,
      trophies: typeof trophies === 'number' ? trophies : 0,
      activity: detectMyActivity()
    };
    try { conn.send(accPayload); } catch (_) {}
    try { deliverSocialMessage(code, accPayload); } catch (_) {}
    addFriendRecord(code, data.name, { trophies: data.trophies });
    setFriendAddStatus('Вы теперь друзья с ' + ((data.name || code).toString().slice(0, 20)), 'ok');
    renderFriends();
    try { SFX.win && SFX.win(); } catch (_) {}
    return;
  }
  // Deduplicate by code
  frIncoming = frIncoming.filter(r => r.code !== code);
  const req = {
    code,
    name: (data.name || ('Игрок ' + code.slice(0, 3))).toString().slice(0, 20),
    trophies: typeof data.trophies === 'number' ? data.trophies : null,
    conn,
    ts: Date.now()
  };
  frIncoming.unshift(req);
  renderFriendRequests();
  showFrToast(req);
  try { SFX.ui(); } catch (_) {}
  try { hapticTap(12); } catch (_) {}
}

let frToastHideTimer = null;
let frToastCountTimer = null;
function clearFrToastHideTimer() {
  if (frToastHideTimer) { clearTimeout(frToastHideTimer); frToastHideTimer = null; }
  if (frToastCountTimer) { clearInterval(frToastCountTimer); frToastCountTimer = null; }
}
function startToastCountdown(elId, seconds, onZero) {
  const el = document.getElementById(elId);
  let left = Math.max(1, seconds | 0);
  const paint = () => {
    if (el) el.textContent = (typeof globalThis.t==='function'?globalThis.t('js.hideIn','Скроется через {n} с',{n:left}):('Скроется через '+left+' с'));
  };
  paint();
  const tickId = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(tickId);
      if (el) el.textContent = (typeof globalThis.t==='function'?globalThis.t('js.hiding','Скроется…'):'Скроется…');
      if (onZero) onZero();
      return;
    }
    paint();
  }, 1000);
  return tickId;
}
function showFrToast(req) {
  const toast = document.getElementById('frToast');
  if (!toast || !req) return;
  frActiveToast = req;
  clearFrToastHideTimer();
  const av = document.getElementById('frToastAv');
  const name = document.getElementById('frToastName');
  const meta = document.getElementById('frToastMeta');
  if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
  if (name) name.textContent = req.name || req.code;
  if (meta) {
    const parts = ['код ' + req.code];
    if (req.trophies != null) parts.push('🏆 ' + req.trophies);
    meta.textContent = parts.join(' · ');
  }
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('out', 'dragging');
  void toast.offsetWidth;
  toast.classList.add('visible');
  frToastCountTimer = startToastCountdown('frToastCountdown', 15, null);
  frToastHideTimer = setTimeout(() => {
    frToastHideTimer = null;
    if (frActiveToast === req) dismissFrToast(true);
  }, 15000);
}

/** Hide toast only — request stays in frIncoming / «Друзья» */
function dismissFrToast(animate) {
  const toast = document.getElementById('frToast');
  if (!toast) return;
  clearFrToastHideTimer();
  frActiveToast = null;
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('dragging');
  if (animate === false) {
    toast.classList.remove('visible', 'out');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out'), 400);
}

function hideFrToast(animate) {
  // backward-compatible alias: hide UI only, keep pending request
  dismissFrToast(animate);
}

function respondFriendReq(req, accept) {
  if (!req) return;
  const payload = accept ? {
    type: 'friend_accept',
    code: myFriendCode,
    name: myNickname,
    trophies: typeof trophies === 'number' ? trophies : 0,
    activity: detectMyActivity()
  } : {
    type: 'friend_decline',
    code: myFriendCode,
    reason: 'declined'
  };
  try {
    if (req.conn && req.conn.open) {
      req.conn.send(payload);
    }
  } catch (_) {}
  // Always deliver via presence relay so sender clears outgoing even if original conn died
  try {
    deliverSocialMessage(req.code, payload).then((ok) => {
      if (accept && !ok) {
        // Retry once after short delay
        setTimeout(() => {
          try { deliverSocialMessage(req.code, payload); } catch (_) {}
        }, 2000);
      }
    });
  } catch (_) {}
  const finishResp = () => {
    if (accept) {
      addFriendRecord(req.code, req.name, { trophies: req.trophies });
      try { SFX.win && SFX.win(); } catch (_) {}
      setFriendAddStatus('Вы теперь друзья с ' + (req.name || req.code), 'ok');
    } else {
      clearFriendRequestState(req.code);
      setFriendAddStatus('Запрос отклонён', 'err');
    }
    frIncoming = frIncoming.filter(r => r !== req && r.code !== req.code);
    if (frActiveToast === req) dismissFrToast(true);
    renderFriendRequests();
    renderFriends(!!accept);
    renderOutgoingPending(false);
    updateFriendsSectionCounts();
  };
  // Animate card out if visible in list
  try {
    const list = document.getElementById('friendReqList');
    const cards = list ? list.querySelectorAll('.friend-req-card') : [];
    let card = null;
    cards.forEach(c => {
      const meta = c.querySelector('.f-meta');
      if (meta && meta.textContent && meta.textContent.indexOf(req.code) >= 0) card = c;
    });
    if (card) {
      card.classList.add('friend-exit');
      setTimeout(finishResp, 360);
      return;
    }
  } catch (_) {}
  finishResp();
  try {
    if (req.conn) setTimeout(() => { try { req.conn.close(); } catch (_) {} }, 400);
  } catch (_) {}
}


(function bindFrToastButtons() {
  if (window._bpFrToastBtns) return;
  window._bpFrToastBtns = true;
  const acc = document.getElementById('frToastAccept');
  const dec = document.getElementById('frToastDecline');
  const dis = document.getElementById('frToastDismiss');
  if (acc) {
    acc.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const req = frActiveToast;
      if (!req) return;
      try { respondFriendReq(req, true); } catch (err) { console.warn('fr toast accept', err); }
    });
  }
  if (dec) {
    dec.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const req = frActiveToast;
      if (!req) return;
      try { respondFriendReq(req, false); } catch (err) { console.warn('fr toast decline', err); }
    });
  }
  if (dis) {
    dis.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { dismissFrToast(true); } catch (_) {}
    });
  }
})();

// Swipe right / up to dismiss friend-request toast (request stays pending)
(function bindFrToastSwipe() {
  const toast = document.getElementById('frToast');
  if (!toast || toast._bpSwipe) return;
  toast._bpSwipe = true;
  let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
  const onStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY;
    startX = t.clientX;
    dy = 0; dx = 0;
    dragging = true;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY;
    dx = t.clientX - startX;
    if (dx > 8 || dy < -8) {
      if (e.cancelable) e.preventDefault();
      const distX = Math.max(0, Math.min(dx, 200));
      const distY = Math.min(0, Math.max(dy, -120));
      toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
      toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
    }
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove('dragging');
    if (dx > 64 || dy < -56) {
      dismissFrToast(true);
      try { setFriendAddStatus('Заявка сохранена', 'ok'); } catch (_) {}
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
    dy = 0; dx = 0;
  };
  toast.addEventListener('touchstart', onStart, { passive: true });
  toast.addEventListener('touchmove', onMove, { passive: false });
  toast.addEventListener('touchend', onEnd, { passive: true });
  toast.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
})();

function renderFriendRequests() {
  const list = document.getElementById('friendReqList');
  if (!list) return;
  try {
    if (null) {
      const roomDead = !mpRoomCode && !(typeof MatchClient !== "undefined" && MatchClient.matchId);
      const full = !!mpOppConnected || !!vsActive;
      if (roomDead || full) {
        const pend = null;
        mpPendingJoin = null;
        try { hideRjToast(false); } catch (_) {}
        try {
          if (pend.conn && pend.conn.open) {
            pend.conn.send({ type: 'join_decline', reason: full ? 'full' : 'closed' });
          }
        } catch (_) {}
        setTimeout(() => { try { if (pend.conn) pend.conn.close(); } catch (_) {} }, 150);
      }
    }
  } catch (_) {}

  const parts = [];
  frIncoming.forEach((r, i) => {
    const initials = (r.name || r.code || '?').slice(0, 2).toUpperCase();
    const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
    const nm = (r.name || r.code || 'Игрок').toString().replace(/</g, '');
    parts.push(`<div class="friend-req-card" data-code="${r.code}">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${nm}</div>
        <div class="f-meta"><span class="req-badge">Заявка</span>${r.code}${cups}</div>
      </div>
      <div class="f-actions">
        <button class="primary fr-acc" data-ri="${i}">✓</button>
        <button class="ghost fr-dec" data-ri="${i}">✕</button>
      </div>
    </div>`);
  });

  if (null && mpRoomCode) {
    const r = null;
    const initials = (r.name || r.code || '?').slice(0, 2).toUpperCase();
    const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
    parts.push(`<div class="friend-req-card lobby-join-card" data-join="1">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${r.name || 'Игрок'}</div>
        <div class="f-meta"><span class="req-badge">Вход</span>комната ${mpRoomCode}${r.code ? ' · ' + r.code : ''}${cups}</div>
      </div>
      <div class="f-actions">
        <button class="primary" id="frJoinAcc">✓</button>
        <button class="ghost" id="frJoinDec">✕</button>
      </div>
    </div>`);
  }
  if (typeof chPending !== 'undefined' && chPending && chPending.room) {
    const r = chPending;
    const initials = (r.name || r.code || '?').slice(0, 2).toUpperCase();
    const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
    const mid = vsActive ? ' · матч идёт' : '';
    parts.push(`<div class="friend-req-card lobby-ch-card" data-ch="1">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${r.name || 'Игрок'}</div>
        <div class="f-meta"><span class="req-badge">Лобби</span>${r.room}${mid}${cups}</div>
      </div>
      <div class="f-actions">
        <button class="primary" id="frChAcc">✓</button>
        <button class="ghost" id="frChDec">✕</button>
      </div>
    </div>`);
  }
  if (typeof rmPending !== 'undefined' && rmPending) {
    const r = rmPending;
    const initials = (r.name || '?').slice(0, 2).toUpperCase();
    parts.push(`<div class="friend-req-card lobby-rm-card" data-rm="1">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${r.name || 'Соперник'}</div>
        <div class="f-meta"><span class="req-badge">Реванш</span>предлагает ещё матч</div>
      </div>
      <div class="f-actions">
        <button class="primary" id="frRmAcc">✓</button>
        <button class="ghost" id="frRmDec">✕</button>
      </div>
    </div>`);
  }

  list.innerHTML = parts.join('');
  list.querySelectorAll('.fr-acc').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = frIncoming[parseInt(btn.dataset.ri, 10)];
      respondFriendReq(r, true);
    });
  });
  list.querySelectorAll('.fr-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = frIncoming[parseInt(btn.dataset.ri, 10)];
      respondFriendReq(r, false);
    });
  });
  const ja = document.getElementById('frJoinAcc');
  const jd = document.getElementById('frJoinDec');
  if (ja) ja.addEventListener('click', () => {  });
  if (jd) jd.addEventListener('click', () => {  });
  const ca = document.getElementById('frChAcc');
  const cd = document.getElementById('frChDec');
  if (ca) ca.addEventListener('click', () => { try { acceptChallenge(); } catch (_) {} });
  if (cd) cd.addEventListener('click', () => { try { declineChallenge(); } catch (_) {} });
  const ra = document.getElementById('frRmAcc');
  const rd = document.getElementById('frRmDec');
  if (ra) ra.addEventListener('click', () => { try { acceptRematchInvite(); } catch (_) {} });
  if (rd) rd.addEventListener('click', () => { try { declineRematchInvite(); } catch (_) {} });
  updateFriendsSectionCounts();
}


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
      if (info && info.online) {
        if (info.activity) setFriendActivity(code, info.activity);
        if (typeof info.trophies === 'number') {
          const f = friends.find(x => x.code === code);
          if (f) { f.trophies = info.trophies; try { saveFriends(); } catch (_) {} }
        }
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
  if (true /* no client mesh */) return;
  friendPresenceBusy = true;
  try {
    // Probe sequentially with small gaps to avoid server spam
    for (const f of friends.slice(0, 30)) {
      const c = normalizeFriendCode(f.code);
      if (!c) continue;
      await probeFriendOnline(c);
      await new Promise(r => setTimeout(r, 180));
    }
  } catch (_) {}
  friendPresenceBusy = false;
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

function getFriendSearchQuery() {
  const el = document.getElementById('friendSearchInput');
  return el ? (el.value || '').trim().toLowerCase() : '';
}

function renderFriends(highlightNew) {
  const codeEl = document.getElementById('myFriendCode');
  if (codeEl) codeEl.textContent = myFriendCode;
  renderFriendRequests();
  renderOutgoingPending();
  const list = document.getElementById('friendList');
  if (!list) return;
  if (!friends.length) {
    list.innerHTML = '<div class="friends-section-empty">Пока нет друзей — добавьте по коду выше</div>';
    updateFriendsSectionCounts();
    return;
  }
  const q = getFriendSearchQuery();
  const indexed = friends.map((f, i) => ({ f, i })).filter(({ f }) => {
    if (!q) return true;
    const name = (f.name || '').toLowerCase();
    const code = (f.code || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });
  if (!indexed.length) {
    list.innerHTML = '';
    updateFriendsSectionCounts();
    return;
  }
  list.innerHTML = indexed.map(({ f, i }, visIdx) => {
    const initials = (f.name || f.code || '?').slice(0, 2).toUpperCase();
    const cups = (typeof f.trophies === 'number') ? ` · 🏆 ${f.trophies}` : '';
    // Animate only on first paint of the screen (or new friend) — not on presence refresh
    const scr = document.getElementById('screenFriends');
    const alreadyOpen = !!(scr && scr.classList.contains('active'));
    const anim = (highlightNew && i === 0)
      ? ' friend-added'
      : (!alreadyOpen && visIdx < 8 ? ' friend-enter' : '');
    const delay = (!alreadyOpen && visIdx < 8) ? ` style="animation-delay:${visIdx * 0.04}s"` : '';
    const pres = getFriendPresence(f.code);
    const act = getFriendActivity(f.code);
    const dotCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking';
    let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
    if (pres === 'online' && act) stText = activityLabel(act);
    const stCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : '';
    return `<div class="friend-card${anim}" data-fi="${i}" data-code="${f.code}"${delay}>
      <div class="f-av">${initials}<span class="f-online-dot ${dotCls}"></span></div>
      <div class="f-info">
        <div class="f-name">${f.name || 'Друг'}</div>
        <div class="f-code">${f.code}${cups} · <span class="f-status-line ${stCls}" style="display:inline">${stText}</span></div>
      </div>
      <div class="f-actions">
        <button type="button" class="primary f-challenge" data-fi="${i}">Вызов</button>
        <button type="button" class="ghost f-remove" data-fi="${i}">✕</button>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.f-challenge').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      challengeFriend(friends[parseInt(btn.dataset.fi, 10)]);
    });
  });
  list.querySelectorAll('.f-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(btn.dataset.fi, 10);
      if (confirm('Удалить из друзей? Вы также пропадёте у него в списке.')) {
        removeFriendAt(idx);
      }
    });
  });
  updateFriendsSectionCounts();
}

// Event delegation backup for friend actions (touch / re-renders)
(function bindFriendListDelegation() {
  const list = document.getElementById('friendList');
  if (!list || list._bpFriendDel) return;
  list._bpFriendDel = true;
  list.addEventListener('click', (e) => {
    const rm = e.target.closest && e.target.closest('.f-remove');
    const ch = e.target.closest && e.target.closest('.f-challenge');
    if (rm) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(rm.dataset.fi, 10);
      if (!isNaN(idx) && confirm('Удалить из друзей? Вы также пропадёте у него в списке.')) {
        removeFriendAt(idx);
      }
    } else if (ch) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(ch.dataset.fi, 10);
      if (!isNaN(idx)) challengeFriend(friends[idx]);
    }
  });
})();


function cleanupOutgoingSearch() {
  if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
  frSearchBusy = false;
}

function sendFriendRequestToCode(code, displayName, opts) {
  opts = opts || {};
  code = normalizeFriendCode(code);
  if (!code || code.length !== 6) {
    setFriendAddStatus('Нужен код из 6 символов', 'err');
    return;
  }
  if (code === myFriendCode) {
    setFriendAddStatus('Это твой собственный код', 'err');
    return;
  }
  if (friends.some(f => f.code === code)) {
    setFriendAddStatus('Уже в списке друзей', 'err');
    return;
  }
  if (frOutgoingPending.some(p => p.code === code)) {
    renderOutgoingPending();
    setFriendAddStatus('Заявка уже отправлена', 'wait');
    return;
  }
  if (typeof MatchClient === 'undefined') {
    setFriendAddStatus('Сервер недоступен. Обнови страницу.', 'err');
    return;
  }
  if (!checkCrossPlatformReady()) return;
  if (frSearchBusy) {
    setFriendAddStatus('Подождите…', 'wait');
    return;
  }

  // Mandatory existence check (unless already verified, e.g. from nick search pick)
  if (!opts.skipCheck) {
    frSearchBusy = true;
    setFriendAddStatus((typeof globalThis.t==='function'?globalThis.t('friends.codeChecking','Проверяем код…'):'Проверяем код…'), 'wait');
    try { ensureFriendPresence(); } catch (_) {}
    try { MatchClient.connect(); } catch (_) {}
    let settled = false;
    const onCheck = (data) => {
      if (settled) return;
      if (!data || String(data.code || '').toUpperCase() !== code) return;
      settled = true;
      try { MatchClient.off('friend_code_check_result', onCheck); } catch (_) {}
      frSearchBusy = false;
      if (!data.ok) {
        const reason = data.reason || 'not_found';
        if (reason === 'self') setFriendAddStatus('Это твой собственный код', 'err');
        else setFriendAddStatus((typeof globalThis.t==='function'?globalThis.t('friends.codeNotFound','Такого кода нет'):'Такого кода нет'), 'err');
        return;
      }
      sendFriendRequestToCode(code, data.name || displayName, { skipCheck: true });
    };
    try { MatchClient.on('friend_code_check_result', onCheck); } catch (_) {}
    try { MatchClient.friendCodeCheck(code); } catch (_) {}
    setTimeout(() => {
      if (settled) return;
      settled = true;
      try { MatchClient.off('friend_code_check_result', onCheck); } catch (_) {}
      frSearchBusy = false;
      setFriendAddStatus((typeof globalThis.t==='function'?globalThis.t('friends.codeNotFound','Такого кода нет'):'Такого кода нет'), 'err');
    }, 8000);
    return;
  }

  frSearchBusy = true;
  setFriendAddStatus('Отправляем заявку…', 'wait');
  try { SFX.ui(); } catch (_) {}
  try { ensureFriendPresence(); } catch (_) {}

  try {
    if (!frOutgoingPending.some(p => p.code === code)) {
      frOutgoingPending.unshift({
        code,
        name: (displayName || '').toString().trim().slice(0, 20) || null,
        ts: Date.now()
      });
      saveOutgoingPending();
      renderOutgoingPending(true);
    } else if (displayName) {
      updateOutgoingPendingName(code, displayName);
    }
  } catch (_) {}

  deliverSocialMessage(code, {
    type: 'friend_req',
    code: myFriendCode,
    name: myNickname,
    trophies: trophies | 0
  }, { timeoutMs: 10000 }).then((ok) => {
    frSearchBusy = false;
    if (!ok) {
      setFriendAddStatus('Заявка сохранена. Друг получит её, когда зайдёт в игру', 'ok');
      try {
        _friendFindCache = (_friendFindCache || []).filter(r => normalizeFriendCode(r.code) !== code);
      } catch (_) {}
      try { renderOutgoingPending(false); } catch (_) {}
      try { refreshFriendFindCards(); } catch (_) {}
      return;
    }
    setFriendAddStatus('Заявка отправлена — ждём ответа', 'ok');
    try {
      _friendFindCache = (_friendFindCache || []).filter(r => normalizeFriendCode(r.code) !== code);
    } catch (_) {}
    try { renderOutgoingPending(false); } catch (_) {}
    try { refreshFriendFindCards(); } catch (_) {}
  });
}

/** Add friend by 6-char code (existence checked on server). Nickname search uses the modal. */
function addFriendByCode(raw) {
  const input = document.getElementById('friendCodeInput');
  const typed = String(raw != null ? raw : (input && input.value) || '').trim();
  if (input) input.value = typed;

  if (!typed) {
    setFriendAddStatus('Введи код друга из 6 символов', 'err');
    return;
  }

  const asCode = normalizeFriendCode(typed);
  if (asCode.length === 6) {
    sendFriendRequestToCode(asCode);
    return;
  }

  // Incomplete code — nick search is a separate button/modal
  setFriendAddStatus('Нужен код из 6 символов. Поиск по нику — кнопка ниже.', 'err');
}

/** Last successful presence_search results (kept when input is cleared). */
let _friendFindCache = [];

function activityFindLabel(act) {
  const a = String(act || 'online');
  if (a === 'match' || a === 'versus' || a === 'ranked') return 'В матче';
  if (a === 'lobby' || a === 'room') return 'В комнате';
  if (a === 'menu' || a === 'online') return 'В меню';
  return a;
}


function openNickSearchModal(prefill) {
  const modal = document.getElementById('nickSearchModal');
  const input = document.getElementById('nickSearchInput');
  const results = document.getElementById('nickSearchResults');
  const empty = document.getElementById('nickSearchEmpty');
  if (!modal) return;
  if (results) results.innerHTML = '';
  if (empty) empty.style.display = 'none';
  if (input) input.value = prefill ? String(prefill).slice(0, 11) : '';
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  try { if (input) input.focus(); } catch (_) {}
}

function closeNickSearchModal() {
  const modal = document.getElementById('nickSearchModal');
  if (!modal) return;
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

function runNickSearchFromModal() {
  const input = document.getElementById('nickSearchInput');
  const resultsEl = document.getElementById('nickSearchResults');
  const empty = document.getElementById('nickSearchEmpty');
  const q = String((input && input.value) || '').trim();
  if (q.length < 2) {
    if (empty) { empty.style.display = ''; empty.textContent = 'Введите минимум 2 символа'; }
    return;
  }
  if (typeof MatchClient === 'undefined') {
    if (empty) { empty.style.display = ''; empty.textContent = 'Сервер недоступен'; }
    return;
  }
  if (resultsEl) resultsEl.innerHTML = '';
  if (empty) { empty.style.display = ''; empty.textContent = 'Ищем…'; }
  try { ensureFriendPresence(); } catch (_) {}
  try { MatchClient.connect(); } catch (_) {}
  let settled = false;
  const onRes = (data) => {
    if (settled || !data) return;
    settled = true;
    try { MatchClient.off('presence_search_result', onRes); } catch (_) {}
    renderNickSearchResults(Array.isArray(data.results) ? data.results : [], q);
  };
  try { MatchClient.on('presence_search_result', onRes); } catch (_) {}
  try { MatchClient.presenceSearch(q); } catch (_) {}
  setTimeout(() => {
    if (settled) return;
    settled = true;
    try { MatchClient.off('presence_search_result', onRes); } catch (_) {}
    if (empty) {
      empty.style.display = '';
      empty.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.notFoundNick','Никого не нашли'):'Никого не нашли');
    }
  }, 8000);
}

function renderNickSearchResults(results, q) {
  const list = document.getElementById('nickSearchResults');
  const empty = document.getElementById('nickSearchEmpty');
  if (!list) return;
  list.innerHTML = '';
  results = Array.isArray(results) ? results : [];
  if (!results.length) {
    if (empty) {
      empty.style.display = '';
      empty.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.notFoundNick','Никого не нашли'):'Никого не нашли')
        + (q ? (' · «' + String(q).slice(0, 20) + '»') : '');
    }
    return;
  }
  if (empty) empty.style.display = 'none';
  for (const r of results) {
    const code = normalizeFriendCode(r.code);
    if (!code) continue;
    const name = String(r.name || code).slice(0, 20);
    const isOnline = r.online !== false && String(r.activity || '') !== 'offline';
    const statusLabel = isOnline
      ? activityFindLabel(r.activity)
      : (typeof globalThis.t === 'function' ? globalThis.t('friends.offline', 'Не в сети') : 'Не в сети');
    const card = document.createElement('div');
    card.className = 'friend-req-card';
    card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;margin-bottom:6px;border-radius:12px;background:var(--surface2)';
    card.innerHTML =
      '<div style="min-width:0"><div style="font-weight:800">' + name.replace(/</g, '') +
      (isOnline ? ' <span style="color:#3dce6a;font-size:0.7rem">●</span>' : ' <span style="opacity:0.45;font-size:0.7rem">○</span>') +
      '</div>' +
      '<div style="font-size:0.75rem;opacity:0.7">' + code +
      (r.trophies != null ? ' · 🏆 ' + (r.trophies | 0) : '') +
      ' · ' + statusLabel +
      '</div></div>';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    btn.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.add','Добавить'):'Добавить');
    btn.addEventListener('click', () => {
      closeNickSearchModal();
      const mainIn = document.getElementById('friendCodeInput');
      if (mainIn) mainIn.value = code;
      sendFriendRequestToCode(code, name, { skipCheck: true });
    });
    card.appendChild(btn);
    list.appendChild(card);
  }
}

function syncFindByNickButton() {
  const btn = document.getElementById('btnFindByNick');
  if (btn) btn.style.display = '';
}


function refreshFriendFindCards() { /* online find list removed */ }

function renderFriendFindResults(results, q, opts) { /* online find list removed */ }

function runFriendFind(q) { /* online find list removed */ }

function bindFriendFindUI() {
  if (window._friendFindBound) return;
  window._friendFindBound = true;
  const input = document.getElementById('friendSearchInput');
  if (input) {
    input.addEventListener('input', () => {
      try { renderFriends(false); } catch (_) {}
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        try { renderFriends(false); } catch (_) {}
      }
    });
  }
}
try { bindFriendFindUI(); } catch (_) {}

// Start presence when possible (WebSocket, no server)
setTimeout(() => {
  try { checkCrossPlatformReady(); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient.connect();
      ensureFriendPresence();
      setNetStatus(true);
    }
  } catch (_) { try { setNetStatus(false, 'ws'); } catch (_) {} }
}, 800);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Opera/Chromium: tab hide often fires before pagehide; send leave while channel is still open
    try {
      if (mpMode && !BPState.matchEnded && (typeof isPreStartOrEmptyMatchLeave === 'function')
        && isPreStartOrEmptyMatchLeave()) {
        
        
      }
    } catch (_) {}
  } else {
    try { ensureFriendPresence(); } catch (_) {}
    // Both left → one rejoined already: other must still see rejoin toast on return
    try {
      if (!vsActive && !BPState.matchEnded && !BPState.mpRejoiningMatch) {
        const s = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
        if (s) {
          showMatchRejoinPanel(s);
          try { startRejoinPanelListen(s); } catch (_2) {}
        }
      }
    } catch (_) {}
  }
});

const LIVE_MATCH_KEY = 'bp_live_match';
function persistLiveMatch(opts) {
  try {
    opts = opts || {};
    // Server-authoritative matches: do NOT store grid/hand/score locally.
    // Rejoin uses MatchClient credentials + server snapshot only.
    const serverMatch = !!(
      (typeof roomMatchMode !== 'undefined' && roomMatchMode)
      || BPState.roomMatchMode
      || (typeof MatchClient !== 'undefined' && MatchClient.matchId)
    );
    if (serverMatch && !opts.forceLeave && !opts.force) {
      // Keep only a tiny pointer so UI knows a match existed — no board state
      try {
        const thin = {
          v: 2,
          serverAuth: true,
          matchId: (typeof MatchClient !== 'undefined' && MatchClient.matchId) || null,
          seat: (typeof MatchClient !== 'undefined' && MatchClient.seat) || null,
          ts: Date.now()
        };
        // Intentionally omit grid/pieces/score/moves
        localStorage.setItem(LIVE_MATCH_KEY, JSON.stringify(thin));
      } catch (_) {}
      return;
    }
    const resultUp = (() => {
      try {
        const r = document.getElementById('versusResult');
        return !!(r && r.classList.contains('visible'));
      } catch (_) { return false; }
    })();
    // Never DELETE the snapshot here — only skip writing.
    // Deleting on !vsActive wiped rejoin ability when both players left.
    if (resultUp || BPState.matchEnded) return;
    if (!opts.forceLeave && (!vsActive || !mpMode)) return;
    if (!mpMode && !opts.forceLeave) return;
    // Empty pre-start / no moves: never create a rejoinable live snapshot.
    // (Previously only within 6s after go-live — waiting on loaded boards without
    // touching the screen left a rejoin offer for the leaver into a cancelled match.)
    try {
      if (typeof isEmptyMatchNoMoves === 'function' && isEmptyMatchNoMoves()) {
        try { clearLiveMatch(); } catch (_) {}
        return;
      }
    } catch (_) {}

    const nowTs = Date.now();
    // leftAt only when the player actually left (myDcAt set by notifyLeavingMatch)
    const leftAtVal = (typeof myDcAt === 'number' && myDcAt > 0) ? myDcAt : null;
    const oppLeftVal = (typeof oppDcAt === 'number' && oppDcAt > 0) ? oppDcAt : 0;
    const snap = {
      t: nowTs,
      leftAt: leftAtVal || nowTs,
      oppLeftAt: oppLeftVal,
      oppDcDeadline: (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) ? dcDeadlineTs : 0,
      bothAway: !!(leftAtVal && oppLeftVal),
      role: mpRole,
      room: mpRoomCode,
      remoteSessionId: mpRemoteSessionId,
      selfSessionId: (typeof MatchClient !== "undefined" && MatchClient.matchId) ? MatchClient.matchId : null,
      fromMM: !!mpFromMatchmaking,
      score: score,
      oppScore: oppScore,
      vsTimeLeft: vsTimeLeft,
      // Wall-clock match end — keeps ticking while both players are offline
      clockEndTs: (function () {
        try {
          if (typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0) {
            return BPState.matchClockEndTs;
          }
          const prev = JSON.parse(localStorage.getItem(LIVE_MATCH_KEY) || 'null');
          if (prev && typeof prev.clockEndTs === 'number' && prev.clockEndTs > 0) {
            BPState.matchClockEndTs = prev.clockEndTs;
            return prev.clockEndTs;
          }
        } catch (_) {}
        const end = Date.now() + Math.max(0, vsTimeLeft || 0) * 1000;
        BPState.matchClockEndTs = end;
        return end;
      })(),
      vsDuration: vsDuration,
      oppName: oppName || mpOppName,
      myBoardId: equippedBoardId,
      oppBoardId: window.mpOppBoardId || null,
      mySkinId: equippedSkinId,
      oppSkinId: window.mpOppSkinId || null,
      ranked: !!mpFromMatchmaking,
      grid: (typeof grid !== 'undefined' && Array.isArray(grid)) ? grid : null,
      oppGrid: (typeof oppGrid !== 'undefined' && Array.isArray(oppGrid)) ? oppGrid : null,
      pieces: (typeof pieces !== 'undefined' && Array.isArray(pieces)) ? pieces.map(p => ({
        shape: (p.shape || []).map(c => c.slice()), color: p.color, used: !!p.used
      })) : null,
      oppPieces: (typeof oppPieces !== 'undefined' && Array.isArray(oppPieces)) ? oppPieces.map(p => ({
        shape: (p.shape || []).map(c => c.slice()), color: p.color, used: !!p.used
      })) : null,
      // Replay log so expired dual-away matches still appear in history
      moves: (typeof matchLog !== 'undefined' && Array.isArray(matchLog)) ? matchLog.slice() : null,
      matchStartTs: (typeof matchStartTs === 'number') ? matchStartTs : null
    };
    // Preserve prior leave stamps if this is a mid-match autosave without leave
    // Critical: while solo-rejoin / opponent still offline, never rewrite leftAt to "now"
    // (that freezes the reconnect countdown for both clients).
    if (!leftAtVal) {
      try {
        const prev = JSON.parse(localStorage.getItem(LIVE_MATCH_KEY) || 'null');
        const solo = !!(typeof window !== 'undefined' && BPState.soloRejoinActive);
        const waitingOpp = !!(typeof oppDisconnected !== 'undefined' && oppDisconnected);
        if (prev && typeof prev.leftAt === 'number' && prev.leftAt > 0 && (prev.bothAway || solo || waitingOpp)) {
          snap.leftAt = prev.leftAt;
          snap.bothAway = !!(prev.bothAway || solo);
          if (typeof prev.oppLeftAt === 'number' && prev.oppLeftAt > 0 && !snap.oppLeftAt) {
            snap.oppLeftAt = prev.oppLeftAt;
          }
          if (typeof prev.oppDcDeadline === 'number' && prev.oppDcDeadline > 0 && !snap.oppDcDeadline) {
            snap.oppDcDeadline = prev.oppDcDeadline;
          }
        } else if (solo || waitingOpp) {
          // Keep absolute deadline already in memory
          if (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) {
            snap.oppDcDeadline = dcDeadlineTs;
            // Reconstruct a stable leftAt so panel countdown keeps ticking
            const winMs = (typeof reconnectWindowMs === 'function' && prev)
              ? reconnectWindowMs(prev) : 60000;
            snap.leftAt = Math.max(0, dcDeadlineTs - winMs);
          } else if (prev && typeof prev.leftAt === 'number' && prev.leftAt > 0) {
            snap.leftAt = prev.leftAt;
          }
          snap.bothAway = true;
        } else {
          // Active match save — leftAt = t means "last seen alive", not a leave
          snap.leftAt = nowTs;
          snap.bothAway = false;
        }
      } catch (_) {}
    }
    localStorage.setItem(LIVE_MATCH_KEY, JSON.stringify(snap));
  } catch (_) {}
}
function clearLiveMatch() {
  try { localStorage.removeItem(LIVE_MATCH_KEY); } catch (_) {}
  try { hideMatchRejoinPanel(); } catch (_) {}
  try { window._rejoinStateApplied = false; } catch (_) {}
  try { window._rejoinPanelListening = false; } catch (_) {}
  try {
    if (window._rejoinPanelDialIv) {
      clearInterval(window._rejoinPanelDialIv);
      window._rejoinPanelDialIv = null;
    }
  } catch (_) {}
}
/** Sync vsTimeLeft from wall-clock end; start 1s tick. Time runs even if opponent is gone. */
function startMatchWallClock(endTs) {
  try {
    // Do not start the clock while waiting for match_go / loading overlay
    if (BPState.matchAwaitingGo || mpLoading) {
      try { updateTimerDisplay(); } catch (_) {}
      return;
    }
    if (typeof endTs === 'number' && endTs > 0) {
      BPState.matchClockEndTs = endTs;
    } else if (!(typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)) {
      BPState.matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
    }
    vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));
    try { updateTimerDisplay(); } catch (_) {}
    if (vsTimerId) { try { clearInterval(vsTimerId); } catch (_) {} vsTimerId = null; }
    vsTimerId = setInterval(() => {
      if (!vsActive || BPState.matchEnded) return;
      vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));
      try { updateTimerDisplay(); } catch (_) {}
      if (vsTimeLeft <= 0) {
        // Server-authoritative online/room: ONLY server may end the match.
        // Local endVersus here caused one client "Ничья 0:0" while the other kept playing.
        try {
          if (roomMatchMode || BPState.roomMatchMode
              || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
            try { MatchClient.sync && MatchClient.sync({}); } catch (_) {}
            return;
          }
        } catch (_) {}
        try { endVersus(); } catch (_) {}
      }
    }, 250);
  } catch (_) {}
}
/** Restart wall clock if interval was killed but match is still live. */
function ensureMatchClockRunning() {
  try {
    if (!vsActive || BPState.matchEnded || replayMode) return;
    if (vsTimerId) return;
    const end = (typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)
      ? BPState.matchClockEndTs
      : (Date.now() + Math.max(0, vsTimeLeft || 0) * 1000);
    startMatchWallClock(end);
  } catch (_) {}
}
/** Drop input locks if match is live (recovers from stuck rejoin overlay). */
function ensurePlayableIfLive() {
  try {
    if (mpMode || mode === 'versus') document.body.classList.add('quiet-hands');
    else document.body.classList.remove('quiet-hands');
  } catch (_) {}
  try {
    if (!vsActive || BPState.matchEnded || replayMode) return;
    // Overlay must not stick forever
    if (BPState.rejoinLoading || BPState.rejoinInputLock) {
      const el = document.getElementById('rejoinLoading');
      const shown = el && el.classList.contains('show');
      // If overlay not visible, force-clear locks
      if (!shown) {
        BPState.rejoinLoading = false;
        BPState.rejoinInputLock = false;
        placingLock = false;
        BPState.mpRejoiningMatch = false;
      }
    }
    if (placingLock && !isDragging && !BPState.rejoinLoading) {
      placingLock = false;
    }
    ensureMatchClockRunning();
  } catch (_) {}
}
/** Absolute wall-clock end of match timer (ms). Time keeps running while both are away. */
function getSnapClockEndTs(snap) {
  if (!snap) return 0;
  if (typeof snap.clockEndTs === 'number' && snap.clockEndTs > 0) return snap.clockEndTs;
  const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
  const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft
    : (typeof snap.vsDuration === 'number' ? snap.vsDuration : 120);
  return leftAt + Math.max(0, leftSec) * 1000;
}
/** Remaining match seconds from wall clock (0 if time already up). */
function remainingMatchSecFromSnap(snap) {
  const end = getSnapClockEndTs(snap);
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}
/** Reconnect window: min(60s from leave, remaining match time at leave). */
function reconnectWindowMs(snap) {
  if (!snap) return 60000;
  const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
  const end = getSnapClockEndTs(snap);
  // How much match time was left when they left
  const matchLeftAtLeave = Math.max(0, end - leftAt);
  return Math.min(60000, matchLeftAtLeave);
}
function reconnectDeadlineTs(snap) {
  const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
  return leftAt + reconnectWindowMs(snap);
}
function readLiveMatch() {
  try {
    const raw = localStorage.getItem(LIVE_MATCH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.t) return null;
    const now = Date.now();
    // Hard expire after 10 minutes wall-clock (safety)
    if (now - s.t > 10 * 60 * 1000) {
      localStorage.removeItem(LIVE_MATCH_KEY);
      return null;
    }
    // Empty 0–0 never-played match is not rejoinable (opponent already cancelled as pre-start).
    // Drop so leaver is not offered «переподключиться» into a free win on disconnected board.
    try {
      const empty = (s.score | 0) === 0 && (s.oppScore | 0) === 0
        && (!Array.isArray(s.moves) || !s.moves.some(e => e && (e.type === 'place' || e.type === 'opp_place')));
      if (empty) {
        localStorage.removeItem(LIVE_MATCH_KEY);
        return null;
      }
    } catch (_) {}
    const leftAt = (typeof s.leftAt === 'number' && s.leftAt > 0) ? s.leftAt : s.t;
    const age = now - leftAt;
    const reconnectMs = reconnectWindowMs(s);
    // Prefer wall-clock match end: allow rejoin while match time remains
    let clockEnd = 0;
    try {
      if (typeof s.clockEndTs === 'number' && s.clockEndTs > 0) clockEnd = s.clockEndTs;
      else if (typeof s.vsTimeLeft === 'number') clockEnd = leftAt + Math.max(0, s.vsTimeLeft) * 1000;
    } catch (_) {}
    const matchStillRunning = clockEnd > now + 1500;
    // Expire only if reconnect window AND match clock are both over
    if (age > reconnectMs + 5000 && !matchStillRunning) {
      localStorage.removeItem(LIVE_MATCH_KEY);
      return null;
    }
    // Soft: if age > reconnect but match still running, keep snap for auto-rejoin
    return s;
  } catch (_) { return null; }
}
function resolveRejoinAwait(payload) {
  try {
    const fn = window._rejoinAwait;
    window._rejoinAwait = null;
    if (typeof fn === 'function') fn(payload);
  } catch (_) {}
}
/** Quiet probe: if opponent says match ended (or unreachable), drop rejoin toast. */
function probeAndCleanLiveMatch() {
  const snap = readLiveMatch();
  if (!snap) { try { hideMatchRejoinPanel(); } catch (_) {} return false; }
  if (vsActive || BPState.mpRejoiningMatch) return true;
  return true;
}
/** True when no one has placed a piece and scores are still 0-0. */
function isEmptyMatchNoMoves() {
  try {
    if (BPState.matchHadAnyPlace) return false;
    const hasPlace = Array.isArray(matchLog) && matchLog.some(e => e && (e.type === 'place' || e.type === 'opp_place'));
    if (hasPlace) return false;
    if ((score | 0) !== 0 || (oppScore | 0) !== 0) return false;
    return true;
  } catch (_) {
    return (score | 0) === 0 && (oppScore | 0) === 0;
  }
}
/** Align with abortPreMatch / handleOpponentDisconnect: loading or empty (no places) = pre-start. */
function isPreStartOrEmptyMatchLeave() {
  try {
    if (!vsActive && (
      (typeof isMatchLoadActive === 'function' && isMatchLoadActive())
      || !!mpLoading || !!vsIntroLock || !!mpMatchStarting
    )) return true;
    // Went live but nobody placed: always cancel as pre-start (no time window).
    // Leaver must not keep a rejoin snapshot; stayer must not freeze on DC wait.
    if (mpMode && isEmptyMatchNoMoves()) return true;
  } catch (_) {}
  return false;
}
function notifyLeavingMatch() {
  try { sessionStorage.setItem('bp_rejoin_storm', '1'); } catch (_) {}
  try { window._thisMatchHadRejoin = true; } catch (_) {}

  if (!mpMode) return;
  // Pre-live / empty just-started leave: cancel for opponent, never persist rejoin snapshot
  const preLive = isPreStartOrEmptyMatchLeave();
  if (preLive) {
    // Fire both signals repeatedly — Opera may drop the first packet on tab close
    const blast = () => {
      
      
    };
    try { blast(); } catch (_) {}
    try { blast(); } catch (_) {}
    
    // After boards were prepared / "Старт!" shown — record local forfeit so history is not empty
    try {
      const bound = (_matchLoad && _matchLoad.meBound && _matchLoad.oppBound)
        || mode === 'versus'
        || !!vsIntroLock
        || !!mpMatchStarting
        || !!vsActive;
      if (bound && !BPState.matchEnded) {
        // Soft local loss record without full live fight UI
        BPState.matchEnded = true;
        vsActive = false;
        const opp = oppName || mpOppName || 'Соперник';
        const entry = {
          id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          opp: opp,
          oppName: opp,
          botId: null,
          mySkinId: (typeof equippedSkinId !== 'undefined' ? equippedSkinId : null) || 'default',
          myBoardId: (typeof equippedBoardId !== 'undefined' ? equippedBoardId : null) || 'field_default',
          oppSkinId: (typeof window.mpOppSkinId === 'string' && window.mpOppSkinId) ? window.mpOppSkinId : null,
          oppBoardId: (typeof window.mpOppBoardId === 'string' && window.mpOppBoardId) ? window.mpOppBoardId : null,
          my: 0,
          oppScore: 0,
          result: 'Поражение',
          delta: 0,
          mode: mpFromMatchmaking ? 'online' : 'friendly',
          difficulty: '',
          duration: vsDuration || 120,
          timeLeft: vsDuration || 120,
          date: Date.now(),
          reason: 'leave_before_start',
          moves: []
        };
        try {
          matchHistory.unshift(entry);
          if (matchHistory.length > 30) matchHistory = matchHistory.slice(0, 30);
          localStorage.setItem('bp_history', JSON.stringify(matchHistory));
        } catch (_) {}
      }
    } catch (_) {}
    try { clearMatchLoadState(); } catch (_) {}
    try { hideMatchLoading(); } catch (_) {}
    try { vsIntroLock = false; mpMatchStarting = false; mpLoading = false; } catch (_) {}
    // Critical: never offer "переподключиться" into a match the opponent already cancelled
    try { clearLiveMatch(); } catch (_) {}
    try { myDcAt = 0; oppDcAt = 0; bothAwayMode = false; } catch (_) {}
    return;
  }
  // Allow leave stamp even if vsActive just flipped — still need rejoin snapshot
  if (!vsActive && !readLiveMatch()) return;
  try {
    if (!myDcAt) myDcAt = Date.now();
  } catch (_) { myDcAt = Date.now(); }
  try {
    if (oppDcAt > 0) bothAwayMode = true;
  } catch (_) {}
  try { myDcAt = Date.now(); } catch (_) {}
  try { bothAwayMode = !!(oppDcAt > 0); } catch (_) {}
  try { persistLiveMatch({ forceLeave: true }); } catch (_) {}
  
  
  // Force flush storage for mobile webviews
  try { localStorage.setItem(LIVE_MATCH_KEY, localStorage.getItem(LIVE_MATCH_KEY) || ''); } catch (_) {}
}
window.addEventListener('pagehide', () => { try { notifyLeavingMatch(); } catch (_) {} });
window.addEventListener('beforeunload', () => { try { notifyLeavingMatch(); } catch (_) {} });

function showMatchRejoinPanel(snap) {
  // New system: no rejoin toasts/panels — auto-return into the match
  try { hideMatchRejoinPanel(); } catch (_) {}
  if (!snap) {
    try { snap = readLiveMatch(); } catch (_) { snap = null; }
  }
  if (!snap) return;
  if (BPState.matchEnded || vsActive || BPState.mpRejoiningMatch) return;
  try {
    if (typeof snap.leftAt === 'number') myDcAt = snap.leftAt;
    if (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) oppDcAt = snap.oppLeftAt;
    if (myDcAt && oppDcAt) bothAwayMode = true;
  } catch (_) {}
  // Keep listening so forfeit packets still arrive
  try { startRejoinPanelListen(snap); } catch (_) {}
  // Auto rejoin immediately (and retry a few times if opponent is not up yet)
  try {
    if (window._autoRejoinTimer) { clearTimeout(window._autoRejoinTimer); window._autoRejoinTimer = null; }
  } catch (_) {}
  const tryAuto = (attempt) => {
    try {
      if (BPState.matchEnded || vsActive) return;
      const s = readLiveMatch();
      if (!s) return;
      if (BPState.mpRejoiningMatch) {
        window._autoRejoinTimer = setTimeout(() => tryAuto(attempt), 800);
        return;
      }
      attemptMatchRejoin().then(() => {
        try {
          if (!vsActive && !BPState.matchEnded && readLiveMatch() && attempt < 8) {
            window._autoRejoinTimer = setTimeout(() => tryAuto(attempt + 1), 1200);
          }
        } catch (_) {}
      }).catch(() => {
        try {
          if (!vsActive && !BPState.matchEnded && readLiveMatch() && attempt < 8) {
            window._autoRejoinTimer = setTimeout(() => tryAuto(attempt + 1), 1200);
          }
        } catch (_) {}
      });
    } catch (_) {}
  };
  tryAuto(0);
}

function hideMatchRejoinPanel() {
  const el = document.getElementById('matchRejoinPanel');
  if (el) el.classList.remove('show');
}
function showRejoinLoading(msg) {
  BPState.rejoinLoading = true;
  BPState.rejoinInputLock = true;
  placingLock = true;
  try { cancelActivePieceDrag(); } catch (_) {}
  try { document.body.classList.add('rejoin-loading'); } catch (_) {}
  const el = document.getElementById('rejoinLoading');
  if (el) {
    const sub = document.getElementById('rejoinLoadingSub');
    if (sub) sub.textContent = msg || (typeof globalThis.t==='function'?globalThis.t('js.returnMatch','Возврат в матч…'):'Возврат в матч…');
    el.classList.add('show');
  }
}
function hideRejoinLoading() {
  BPState.rejoinLoading = false;
  try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
  const el = document.getElementById('rejoinLoading');
  if (el) el.classList.remove('show');
}
function finishRejoinLoading() {
  // Brief lock + overlay, then unlock for play
  showRejoinLoading('Возврат в матч…');
  if (window._rejoinUnlockTimer) {
    try { clearTimeout(window._rejoinUnlockTimer); } catch (_) {}
  }
  const unlockNow = () => {
    try {
      cancelActivePieceDrag();
      hideRejoinLoading();
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.mpRejoiningMatch = false;
      placingLock = false;
      try { ensureMatchClockRunning(); } catch (_) {}
      try { ensurePlayableIfLive(); } catch (_) {}
    } catch (_) {
      hideRejoinLoading();
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.mpRejoiningMatch = false;
      placingLock = false;
    }
    window._rejoinUnlockTimer = null;
  };
  window._rejoinUnlockTimer = setTimeout(() => {
    hideRejoinLoading();
    window._rejoinUnlockTimer = setTimeout(unlockNow, 400);
  }, 350);
  // Hard safety: never leave locks on longer than 2.5s
  setTimeout(() => {
    if (BPState.rejoinLoading || BPState.rejoinInputLock || placingLock) {
      unlockNow();
    }
  }, 2500);
}

// Capture-phase: swallow tray/board input while rejoin lock is on
(function rejoinInputCaptureBlock() {
  const block = (e) => {
    try {
      const ov = document.getElementById('rejoinLoading');
      const ovOn = ov && ov.classList.contains('show');
      if (!ovOn) {
        // Sticky flags must not freeze a live room match
        if (roomMatchMode || BPState.roomMatchMode) {
          BPState.rejoinLoading = false;
          BPState.rejoinInputLock = false;
        }
        if (!BPState.rejoinLoading && !BPState.rejoinInputLock) return;
      }
    } catch (_) {}
    if (!BPState.rejoinLoading && !BPState.rejoinInputLock) return;
    try {
      const t = e.target;
      if (t && t.closest && (t.closest('#screenVersus .pieces-area') || t.closest('#screenVersus .board-wrap') || t.closest('#screenVersus .piece-slot'))) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    } catch (_) {}
  };
  ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => {
    document.addEventListener(ev, block, true);
  });
})();

/**
 * One player rejoins while the other is still offline.
 * Match UI + wall-clock timer run; opponent side keeps listening / retrying dial.
 */
/** While rejoin panel is open, stay reachable so opponent «Сдаться» arrives as quiet win. */
function startRejoinPanelListen(snap) {
  return;
}

function enterSoloRejoinWait(snap, existingPeer) {
  try {
    if (typeof MatchClient !== "undefined" && MatchClient.matchId) {
      MatchClient.rejoin(MatchClient.matchId, MatchClient.token);
    }
  } catch (_) {}
}


function packHandForNet(arr) {
  return (arr || []).map(p => ({
    shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
    color: p && p.color,
    used: !!(p && p.used)
  }));
}
function buildFullMatchSyncPayload(extra) {
  const base = {
    type: 'match_rejoin_ok',
    stillLive: !BPState.matchEnded && (!!vsActive || !!BPState.mpRejoiningMatch || !!BPState.soloRejoinActive),
    name: myNickname,
    score: score | 0,
    oppScore: oppScore | 0,
    vsTimeLeft: vsTimeLeft | 0,
    clockEndTs: (typeof BPState.matchClockEndTs === 'number') ? BPState.matchClockEndTs : 0,
    grid: grid,
    oppGrid: oppGrid,
    pieces: packHandForNet(pieces),
    oppPieces: packHandForNet(oppPieces),
    boardId: equippedBoardId,
    skinId: equippedSkinId,
    matchStartTs: matchStartTs || 0,
    fullSync: true,
    t: Date.now()
  };
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(k => { base[k] = extra[k]; });
  }
  return base;
}
/** Apply remote state as truth (remote "me" → our opp). Always full replace of boards/hands. */
function handSig(arr) {
  try {
    return (arr || []).map(p => {
      if (!p) return '_';
      const sh = (p.shape || []).map(c => (c && c[0]) + ',' + (c && c[1])).join(';');
      return (p.used ? '1' : '0') + '#' + sh + '#' + (p.color || '');
    }).join('/');
  } catch (_) { return ''; }
}
function gridSig(g) {
  try {
    if (!Array.isArray(g)) return '';
    let s = '';
    for (let r = 0; r < g.length; r++) {
      const row = g[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) s += row[c] ? '1' : '0';
      s += '|';
    }
    return s;
  } catch (_) { return ''; }
}
function countUnusedInHand(arr) {
  try {
    return (arr || []).filter(p => p && !p.used && p.shape && p.shape.length).length;
  } catch (_) { return 0; }
}
function cloneHand(arr) {
  return (arr || []).map(p => ({
    shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
    color: p.color,
    used: !!p.used
  }));
}


/* ========== Server accounts (API) ========== */
let authToken = null;
try { authToken = localStorage.getItem('bp_auth_token') || null; } catch (_) {}
let authAccount = null;
let authMode = 'login'; // 'login' | 'register'

function apiBase() {
  try {
    if (typeof location !== 'undefined' && location.origin && location.protocol !== 'file:') {
      return location.origin;
    }
  } catch (_) {}
  return '';
}

async function apiFetch(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (authToken) headers.Authorization = 'Bearer ' + authToken;
  let res;
  try {
    res = await fetch(apiBase() + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined
    });
  } catch (netErr) {
    return { status: 0, ok: false, data: null, networkError: true };
  }
  let data = null;
  const ct = String((res.headers && res.headers.get && res.headers.get('content-type')) || '');
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, contentType: ct };
}

function applyServerAccount(account) {
  if (!account) return;
  authAccount = account;
  try {
    if (account.nick) {
      myNickname = String(account.nick).slice(0, 24);
      localStorage.setItem('bp_nickname', myNickname);
    }
    if (typeof account.trophies === 'number') {
      trophies = Math.max(0, account.trophies | 0);
      localStorage.setItem('bp_trophies', String(trophies));
    }
    if (account.friendCode) {
      myFriendCode = String(account.friendCode).toUpperCase();
      localStorage.setItem('bp_my_code', myFriendCode);
    }
    if (account.avatarId) {
      myAvatarId = account.avatarId;
      localStorage.setItem('bp_avatar', myAvatarId);
    }
    if (typeof account.avatarCustom === 'string') {
      myAvatarCustom = account.avatarCustom;
      if (myAvatarCustom) localStorage.setItem('bp_avatar_custom', myAvatarCustom);
      else localStorage.removeItem('bp_avatar_custom');
    }
    if (typeof account.status === 'string') {
      myStatus = account.status;
      localStorage.setItem('bp_status', myStatus);
    }
    if (account.skinId && typeof equippedSkinId !== 'undefined') {
      try {
        equippedSkinId = account.skinId;
        localStorage.setItem('bp_skin', equippedSkinId);
        if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
      } catch (_) {}
    }
    if (account.boardId && typeof equippedBoardId !== 'undefined') {
      try {
        equippedBoardId = account.boardId;
        localStorage.setItem('bp_board', equippedBoardId);
        if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
      } catch (_) {}
    }
  } catch (_) {}
  try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
  try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
  try { if (typeof updateVersusNameLabels === 'function') updateVersusNameLabels(); } catch (_) {}
  updateAccountUI();
}

function updateAccountUI() {
  const guest = document.getElementById('accountGuestBlock');
  const logged = document.getElementById('accountLoggedBlock');
  const label = document.getElementById('accountLoginLabel');
  const pill = document.getElementById('profileGuestPill');
  const isIn = !!(authToken && authAccount);
  if (guest) guest.hidden = isIn;
  if (logged) logged.hidden = !isIn;
  if (label && authAccount) {
    label.textContent = '@' + (authAccount.login || '') + ' · код ' + (authAccount.friendCode || myFriendCode || '—');
  }
  if (pill) {
    if (isIn) {
      pill.textContent = '✓ Аккаунт';
      pill.style.color = 'var(--accent, #00d4aa)';
    } else {
      pill.textContent = '👤 Гость';
      pill.style.color = '';
    }
  }
}

function openAuthModal(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  const modal = document.getElementById('authModal');
  const nickField = document.getElementById('authNickField');
  const title = document.getElementById('authModalTitle');
  const submit = document.getElementById('authSubmit');
  const err = document.getElementById('authError');
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.classList.toggle('on', tab.getAttribute('data-auth-tab') === authMode);
  });
  if (nickField) nickField.hidden = authMode !== 'register';
  if (title) title.textContent = authMode === 'register' ? 'Регистрация' : 'Вход';
  if (submit) submit.textContent = authMode === 'register' ? 'Создать аккаунт' : 'Войти';
  if (err) { err.hidden = true; err.textContent = ''; }
  const pass = document.getElementById('authPassword');
  if (pass) pass.setAttribute('autocomplete', authMode === 'register' ? 'new-password' : 'current-password');
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    modal.classList.add('visible');
  }
  try { setTimeout(() => document.getElementById('authLogin')?.focus(), 30); } catch (_) {}
}
// Expose for inline onclick / console
try { window.openAuthModal = openAuthModal; } catch (_) {}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.classList.remove('visible');
  }
}
try { window.closeAuthModal = closeAuthModal; } catch (_) {}

async function submitAuthForm(e) {
  if (e) e.preventDefault();
  const login = (document.getElementById('authLogin')?.value || '').trim();
  const password = document.getElementById('authPassword')?.value || '';
  const nick = (document.getElementById('authNick')?.value || '').trim();
  const err = document.getElementById('authError');
  const submit = document.getElementById('authSubmit');
  if (err) { err.hidden = true; err.textContent = ''; }
  if (submit) submit.disabled = true;
  try {
    const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = { login, password };
    if (authMode === 'register' && nick) body.nick = nick;
    const { ok, data, status, networkError, contentType } = await apiFetch(path, { method: 'POST', body });
    if (!ok || !data || !data.ok) {
      let msg = (data && (data.message || data.error)) || null;
      if (!msg) {
        if (networkError || status === 0) {
          msg = 'Нет связи с сервером. Откройте игру через http://localhost:9000 (не file://) и убедитесь, что node server.js запущен.';
        } else if (status === 503) {
          msg = 'Сервис аккаунтов недоступен';
        } else if (status === 404 || (contentType && contentType.indexOf('json') === -1)) {
          msg = 'API недоступен (сервер отдаёт не JSON). Нужен Node-сервер (server.js), а не только статические файлы на хостинге.';
        } else if (status >= 500) {
          msg = 'Ошибка сервера (' + status + ')';
        } else {
          msg = 'Ошибка (код ' + status + ')';
        }
      }
      // Humanize known error codes
      if (msg === 'accounts_unavailable') msg = 'Сервис аккаунтов недоступен';
      if (msg === 'server_error') msg = 'Ошибка сервера';
      if (msg === 'not_found') msg = 'API не найден — обновите страницу или перезапустите сервер';
      if (err) { err.textContent = msg; err.hidden = false; }
      try { console.warn('[auth]', status, data, contentType); } catch (_) {}
      return;
    }
    authToken = data.token;
    try { localStorage.setItem('bp_auth_token', authToken); } catch (_) {}
    applyServerAccount(data.account);
    closeAuthModal();
    try {
      if (typeof showInfoToast === 'function') {
        showInfoToast('Аккаунт', authMode === 'register' ? 'Регистрация успешна' : 'Вход выполнен', 'ok');
      }
    } catch (_) {}
    try { if (typeof ensureFriendPresence === 'function') ensureFriendPresence(); } catch (_) {}
  } catch (ex) {
    if (err) {
      err.textContent = 'Нет связи с сервером';
      err.hidden = false;
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function logoutAccount() {
  try {
    if (authToken) await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  authToken = null;
  authAccount = null;
  try { localStorage.removeItem('bp_auth_token'); } catch (_) {}
  updateAccountUI();
  try {
    if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Вы вышли', 'info');
  } catch (_) {}
}

/** Push local profile fields to server (when logged in). */
async function syncProfileToServer(extra) {
  if (!authToken) return null;
  const body = Object.assign({
    nick: typeof myNickname !== 'undefined' ? myNickname : undefined,
    status: typeof myStatus !== 'undefined' ? myStatus : undefined,
    avatarId: typeof myAvatarId !== 'undefined' ? myAvatarId : undefined,
    avatarCustom: (typeof myAvatarId !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
    trophies: typeof trophies === 'number' ? trophies : undefined,
    skinId: typeof equippedSkinId !== 'undefined' ? equippedSkinId : undefined,
    boardId: typeof equippedBoardId !== 'undefined' ? equippedBoardId : undefined
  }, extra || {});
  try {
    const { ok, data } = await apiFetch('/api/me', { method: 'PATCH', body });
    if (ok && data && data.account) {
      authAccount = data.account;
      return data.account;
    }
  } catch (_) {}
  return null;
}

async function restoreSessionFromToken() {
  if (!authToken) {
    updateAccountUI();
    return;
  }
  try {
    const { ok, data } = await apiFetch('/api/me');
    if (ok && data && data.account) {
      applyServerAccount(data.account);
    } else {
      authToken = null;
      authAccount = null;
      try { localStorage.removeItem('bp_auth_token'); } catch (_) {}
      updateAccountUI();
    }
  } catch (_) {
    updateAccountUI();
  }
}

function bindAccountUI() {
  const bindBtn = document.getElementById('btnProfileBind');
  if (bindBtn && !bindBtn._authBound) {
    bindBtn._authBound = true;
    bindBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAuthModal('login');
    });
  }
  const logoutBtn = document.getElementById('btnAccountLogout');
  if (logoutBtn && !logoutBtn._authBound) {
    logoutBtn._authBound = true;
    logoutBtn.addEventListener('click', () => logoutAccount());
  }
  const closeBtn = document.getElementById('authModalClose');
  if (closeBtn && !closeBtn._authBound) {
    closeBtn._authBound = true;
    closeBtn.addEventListener('click', closeAuthModal);
  }
  const backdrop = document.getElementById('authModalBackdrop');
  if (backdrop && !backdrop._authBound) {
    backdrop._authBound = true;
    backdrop.addEventListener('click', closeAuthModal);
  }
  const form = document.getElementById('authForm');
  if (form && !form._authBound) {
    form._authBound = true;
    form.addEventListener('submit', submitAuthForm);
  }
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    if (tab._authBound) return;
    tab._authBound = true;
    tab.addEventListener('click', () => {
      openAuthModal(tab.getAttribute('data-auth-tab') === 'register' ? 'register' : 'login');
    });
  });
}

// Delegation: works even if profile DOM is re-rendered later
if (!window._authDelegateBound) {
  window._authDelegateBound = true;
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest && e.target.closest('#btnProfileBind, #btnAccountLogout, #authModalClose, .auth-tab');
    if (!t) return;
    if (t.id === 'btnProfileBind') {
      e.preventDefault();
      openAuthModal('login');
    } else if (t.id === 'btnAccountLogout') {
      e.preventDefault();
      logoutAccount();
    } else if (t.id === 'authModalClose') {
      closeAuthModal();
    } else if (t.classList && t.classList.contains('auth-tab')) {
      openAuthModal(t.getAttribute('data-auth-tab') === 'register' ? 'register' : 'login');
    }
  }, true);
}

function scheduleAuthBind() {
  try { bindAccountUI(); } catch (e) { console.warn('bindAccountUI', e); }
  try { restoreSessionFromToken(); } catch (e) { console.warn('restoreSession', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleAuthBind);
} else {
  scheduleAuthBind();
}
window.addEventListener('load', () => { try { bindAccountUI(); } catch (_) {} });

/** Hook: after profile save, sync to cloud */
(function patchProfileSaveSync() {
  const btn = document.getElementById('btnProfileSave');
  if (!btn || btn._authSyncBound) return;
  btn._authSyncBound = true;
  btn.addEventListener('click', () => {
    setTimeout(() => { try { syncProfileToServer(); } catch (_) {} }, 50);
  });
})();
