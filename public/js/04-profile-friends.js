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

function scheduleIdle(fn, timeout) {
  try {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => { try { fn(); } catch (_) {} }, { timeout: timeout || 48 });
      return;
    }
  } catch (_) {}
  setTimeout(() => { try { fn(); } catch (_) {} }, Math.min(timeout || 48, 32));
}
function renderAvatarInto(el, opts) {
  if (!el) return;
  opts = opts || {};
  const id = opts.avatarId || myAvatarId;
  const nick = opts.nick != null ? opts.nick : myNickname;
  const customUrl = (opts.custom != null && opts.custom !== '')
    ? opts.custom
    : ((id === 'custom' && myAvatarCustom) ? myAvatarCustom : '');
  el.innerHTML = '';
  el.classList.remove('has-photo', 'av-loading');
  // Reset previous photo/gradient so switching presets is clean
  el.style.background = '';
  el.style.backgroundImage = '';
  el.style.backgroundSize = '';
  el.style.backgroundPosition = '';
  el.style.backgroundRepeat = '';
  el.style.backgroundColor = '';
  el.style.color = '';
  if (id === 'custom' && customUrl) {
    // Use <img> (async decode) — CSS background with huge data-URL freezes the main thread
    el.classList.add('has-photo', 'av-loading');
    el.style.backgroundColor = 'var(--surface2, #1a1f2e)';
    el.style.color = 'transparent';
    el.textContent = '';
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.loading = opts.eager ? 'eager' : 'lazy';
    img.draggable = false;
    // Keep photo strictly inside the frame (friends list used to stretch)
    img.style.cssText = 'width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;object-position:center;display:block;border-radius:inherit;';
    const done = () => {
      try { el.classList.remove('av-loading'); } catch (_) {}
    };
    img.onload = done;
    img.onerror = () => {
      done();
      el.classList.remove('has-photo');
      try {
        const preset = getAvatarPreset('init');
        el.style.background = preset.bg;
        el.textContent = profileInitials(nick);
        el.style.color = '#04120e';
      } catch (_) {}
    };
    img.src = customUrl;
    el.appendChild(img);
    // Ensure host is a fixed frame
    try {
      el.style.overflow = 'hidden';
      if (!el.style.flexShrink) el.style.flexShrink = '0';
    } catch (_) {}
    // If already cached, onload may have fired synchronously
    if (img.complete && img.naturalWidth) done();
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
  const loggedIn = !!(typeof authToken !== 'undefined' && authToken && typeof authAccount !== 'undefined' && authAccount);
  const prevNick = myNickname;
  const prevAv = myAvatarId;
  const prevStatus = myStatus;
  // Name & status only editable after registration
  if (loggedIn) {
    const nick = sanitizeNick(data.nick);
    if (nick.length < 2) return { ok: false, err: 'Ник слишком короткий (мин. 2)' };
    myNickname = nick;
    myStatus = String(data.status || '').slice(0, 48);
  }
  myAvatarId = data.avatarId || myAvatarId;
  if (data.custom != null) myAvatarCustom = data.custom;
  try {
    if (loggedIn && myNickname && myNickname !== prevNick && !/^Player/i.test(myNickname)) setAchStat('profileNick', 1);
    if (myAvatarId && myAvatarId !== prevAv) setAchStat('profileAvatar', 1);
    if (myAvatarId === 'custom' && myAvatarCustom) setAchStat('profileCustom', 1);
    if (loggedIn && myStatus && myStatus !== prevStatus) setAchStat('profileStatus', 1);
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
  // Push updated nick/avatar to server presence so friends list refreshes live
  try { ensureFriendPresence(); } catch (_) {}
  try { scheduleGuestProgressSync && scheduleGuestProgressSync(); } catch (_) {}
  return { ok: true };
}
function refreshProfileUI() {
  renderAvatarInto(document.getElementById('homeProfileAv'), { avatarId: myAvatarId, nick: myNickname, custom: myAvatarCustom, eager: true });
  const hn = document.getElementById('homeProfileName');
  if (hn) hn.textContent = myNickname || (typeof globalThis.t==='function'?globalThis.t('js.guest','Гость'):'Гость');
  // Home badge: «Гость» → nick when logged in
  try {
    const badge = document.querySelector('.home-profile-badge');
    if (badge) {
      if (authToken && authAccount) {
        const st = (myStatus || '').trim();
        badge.textContent = st || (typeof globalThis.t==='function'?globalThis.t('menu.account','Аккаунт'):'Аккаунт');
        badge.classList.remove('guest');
        badge.classList.add('account');
      } else {
        badge.textContent = (typeof globalThis.t==='function'?globalThis.t('menu.guest','Гость'):'Гость');
        badge.classList.add('guest');
        badge.classList.remove('account');
      }
    }
  } catch (_) {}
  renderAvatarInto(document.getElementById('profileAvBig'), { avatarId: myAvatarId, nick: myNickname, custom: myAvatarCustom, big: true, eager: true });
  const heroN = document.getElementById('profileHeroName');
  if (heroN) heroN.textContent = myNickname || (typeof globalThis.t==='function'?globalThis.t('js.guest','Гость'):'Гость');
  // Guest pill: «Гость» → after registration show status (if any), else nothing
  const pill = document.getElementById('profileGuestPill');
  if (pill) {
    if (authToken && authAccount) {
      const st = (myStatus || '').trim();
      if (st) {
        pill.textContent = st;
        pill.style.color = 'var(--accent, #00d4aa)';
        pill.hidden = false;
      } else {
        pill.textContent = '';
        pill.hidden = true;
      }
    } else {
      pill.textContent = (typeof globalThis.t==='function'?globalThis.t('profile.guestPill','👤 Гость'):'👤 Гость');
      pill.style.color = '';
      pill.hidden = false;
    }
  }
  const prev = document.getElementById('profileStatusPreview');
  // Status already shown in pill after login; keep preview only for guests or as secondary
  if (prev) {
    if (authToken && authAccount) prev.textContent = '';
    else prev.textContent = myStatus || '';
  }
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
    const avMe = document.getElementById('duelAvMe') || document.getElementById('duelAvMeInner');
    if (avMe) renderAvatarInto(avMe, { avatarId: myAvatarId, nick: myNickname, custom: myAvatarCustom, size: 'duel', eager: true });
  } catch (_) {}
  try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
  try { setProfileNameStatusLocked(!(authToken && authAccount)); } catch (_) {}
}
function renderProfileAvatarGrid() {
  const grid = document.getElementById('profileAvatarGrid');
  if (!grid) return;
  const selected = profileDraft.avatarId || myAvatarId;
  const customUrl = (profileDraft.custom != null && profileDraft.custom !== '')
    ? profileDraft.custom
    : (myAvatarCustom || '');
  const customSel = selected === 'custom' ? ' selected' : '';
  let html = '';
  if (customUrl) {
    html += `<button type="button" class="profile-av-opt custom-upload has-photo${customSel}" data-av="custom" role="option" aria-selected="${selected === 'custom'}" title="Своё фото"><img alt="" decoding="async" loading="lazy" src=""></button>`;
  } else {
    html += `<button type="button" class="profile-av-opt custom-upload${customSel}" data-av="upload" role="option" title="Загрузить фото">＋</button>`;
  }
  html += AVATAR_PRESETS.map(p => {
    const sel = p.id === selected ? ' selected' : '';
    let content;
    if (p.kind === 'emoji') {
      content = p.emoji || '⭐';
    } else {
      content = profileInitials(profileDraft.nick || myNickname);
    }
    const emojiCls = p.kind === 'emoji' ? ' is-emoji' : ' is-initials';
    return `<button type="button" class="profile-av-opt${emojiCls}${sel}" data-av="${p.id}" role="option" aria-selected="${p.id === selected}" style="background:${p.bg}">${content}</button>`;
  }).join('');
  grid.innerHTML = html;
  const customBtn = grid.querySelector('[data-av="custom"]');
  if (customBtn && customUrl) {
    const img = customBtn.querySelector('img');
    if (img) {
      img.onload = () => { try { customBtn.classList.add('photo-ready'); } catch (_) {} };
      // Defer assigning huge data-URL so the grid chrome paints first
      setTimeout(() => { try { img.src = customUrl; } catch (_) {} }, 0);
    }
  }
  // Event delegation once — avoids N listeners on every open
  if (!grid._bpAvBound) {
    grid._bpAvBound = true;
    grid.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('.profile-av-opt');
      if (!btn || !grid.contains(btn)) return;
      const av = btn.dataset.av;
      if (av === 'upload') {
        const fi = document.getElementById('profileAvatarFile');
        if (fi) fi.click();
        return;
      }
      const cUrl = (profileDraft.custom != null && profileDraft.custom !== '')
        ? profileDraft.custom
        : (myAvatarCustom || '');
      if (av === 'custom') {
        profileDraft.avatarId = 'custom';
        renderProfileAvatarGrid();
        renderAvatarInto(document.getElementById('profileAvBig'), {
          avatarId: 'custom',
          nick: profileDraft.nick || myNickname,
          custom: cUrl,
          big: true,
          eager: true
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
  }
}
function isAccountLoggedIn() {
  return !!(authToken && authAccount);
}

function setProfileNameStatusLocked(locked) {
  const nickIn = document.getElementById('profileNickInput');
  const stIn = document.getElementById('profileStatusInput');
  const card = nickIn && nickIn.closest && nickIn.closest('.profile-card');
  if (nickIn) {
    nickIn.disabled = !!locked;
    nickIn.readOnly = !!locked;
    if (locked) nickIn.setAttribute('aria-disabled', 'true');
    else nickIn.removeAttribute('aria-disabled');
  }
  if (stIn) {
    stIn.disabled = !!locked;
    stIn.readOnly = !!locked;
    if (locked) stIn.setAttribute('aria-disabled', 'true');
    else stIn.removeAttribute('aria-disabled');
  }
  try {
    let hint = document.getElementById('profileNameStatusLockHint');
    if (locked) {
      if (!hint && card) {
        hint = document.createElement('div');
        hint.id = 'profileNameStatusLockHint';
        hint.className = 'hint profile-lock-hint';
        hint.textContent = (typeof globalThis.t === 'function'
          ? globalThis.t('profile.nameStatusLocked', 'Имя и статус доступны после регистрации')
          : 'Имя и статус доступны после регистрации');
        card.appendChild(hint);
      }
      if (hint) hint.hidden = false;
    } else if (hint) {
      hint.hidden = true;
    }
  } catch (_) {}
}

function openProfileScreen() {
  profileDraft = { nick: myNickname, avatarId: myAvatarId, status: myStatus, custom: myAvatarCustom };
  const nickIn = document.getElementById('profileNickInput');
  const stIn = document.getElementById('profileStatusInput');
  if (nickIn) nickIn.value = myNickname || '';
  if (stIn) stIn.value = myStatus || '';
  setProfileNameStatusLocked(!isAccountLoggedIn());
  // Show screen immediately so the click does not feel frozen
  try { showScreen('profile'); } catch (_) {}
  // Lightweight hero paint first
  try {
    renderAvatarInto(document.getElementById('profileAvBig'), {
      avatarId: profileDraft.avatarId,
      nick: profileDraft.nick,
      custom: profileDraft.custom,
      big: true,
      eager: true
    });
    const heroN = document.getElementById('profileHeroName');
    if (heroN) heroN.textContent = profileDraft.nick || myNickname || 'Гость';
  } catch (_) {}
  // Avatar grid is heavy (many nodes + optional photo) — defer + loading shimmer
  const grid = document.getElementById('profileAvatarGrid');
  if (grid) {
    grid.classList.add('is-loading');
    grid.innerHTML = '<div class="profile-av-loading" aria-busy="true"><span class="profile-av-spinner"></span><span>Загрузка…</span></div>';
  }
  const paint = () => {
    try { renderProfileAvatarGrid(); } catch (_) {}
    try { refreshProfileUI(); } catch (_) {}
    if (grid) grid.classList.remove('is-loading');
  };
  // Double rAF + microtask so the loading frame paints first
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (typeof scheduleIdle === 'function') scheduleIdle(paint, 32);
        else setTimeout(paint, 16);
      } catch (_) {
        setTimeout(paint, 16);
      }
    });
  });
}

let friends = [];
try { friends = JSON.parse(localStorage.getItem('bp_friends') || '[]'); } catch (_) { friends = []; }
let _friendsSyncTimer = null;
function saveFriends() {
  try { localStorage.setItem('bp_friends', JSON.stringify(friends)); } catch (_) {}
  try { scheduleFriendsSync(); } catch (_) {}
}
function scheduleFriendsSync() {
  if (!authToken) return;
  if (_friendsSyncTimer) clearTimeout(_friendsSyncTimer);
  _friendsSyncTimer = setTimeout(() => {
    _friendsSyncTimer = null;
    try { syncFriendsToServer(); } catch (_) {}
  }, 800);
}
async function syncFriendsToServer() {
  if (!authToken) return;
  try {
    const payload = (friends || []).slice(0, 200).map((f) => ({
      code: f.code,
      name: f.name,
      trophies: f.trophies,
      avatarId: f.avatarId,
      avatarCustom: f.avatarCustom,
      added: f.added
    }));
    await apiFetch('/api/me', { method: 'PATCH', body: { friends: payload } });
  } catch (_) {}
}
function mergeFriendsFromServer(serverFriends) {
  if (!Array.isArray(serverFriends) || !serverFriends.length) return;
  const byCode = new Map();
  for (const f of friends) {
    if (f && f.code) byCode.set(normalizeFriendCode(f.code), f);
  }
  for (const sf of serverFriends) {
    if (!sf || !sf.code) continue;
    const code = normalizeFriendCode(sf.code);
    if (!code) continue;
    const existing = byCode.get(code);
    if (existing) {
      if (sf.name && (!existing.name || existing.name.startsWith('Игрок'))) existing.name = sf.name;
      if (sf.avatarId) existing.avatarId = sf.avatarId;
      if (sf.avatarCustom) existing.avatarCustom = sf.avatarCustom;
      if (typeof sf.trophies === 'number') existing.trophies = sf.trophies;
    } else {
      const rec = {
        code,
        name: (sf.name || ('Игрок ' + code.slice(0, 3))).slice(0, 20),
        added: sf.added || Date.now(),
        trophies: typeof sf.trophies === 'number' ? sf.trophies : undefined,
        avatarId: sf.avatarId,
        avatarCustom: sf.avatarCustom
      };
      friends.push(rec);
      byCode.set(code, rec);
    }
  }
  try { localStorage.setItem('bp_friends', JSON.stringify(friends)); } catch (_) {}
}

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
    // After match end, roomMatchMode may stay true for rematch — do NOT keep
    // "lobby / match starting" activity or lock Friends controls.
    const matchOver = !!(typeof BPState !== 'undefined' && BPState.matchEnded);
    const liveFight = (typeof vsActive !== 'undefined' && vsActive) && !matchOver;
    if (((typeof roomMatchMode !== 'undefined' && roomMatchMode) || BPState.roomMatchMode) && liveFight) {
      myActivity = 'match';
      return myActivity;
    }
    if (((typeof roomMatchMode !== 'undefined' && roomMatchMode) || BPState.roomMatchMode)
        && !matchOver && !liveFight) {
      // Pre-start lobby only
      if (typeof mpMatchStarting !== 'undefined' && mpMatchStarting) {
        myActivity = 'lobby';
        return myActivity;
      }
      if (typeof mpRoomCode !== 'undefined' && mpRoomCode) {
        myActivity = 'lobby';
        return myActivity;
      }
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

/** Throttled presence: registered accounts were lagging because every call
 *  re-uploaded avatarCustom (up to ~50KB) + triggered cosmetics_state. */
let _lastPresenceAt = 0;
let _lastPresenceSig = '';
let _presenceCustomSent = false;
function ensureFriendPresence(force) {
  if (typeof MatchClient === 'undefined' || !myFriendCode) return;
  try {
    const now = Date.now();
    if (!force && _lastPresenceAt && (now - _lastPresenceAt) < 25000) return;
    const name = myNickname || 'Игрок';
    const activity = (typeof detectMyActivity === 'function' ? detectMyActivity() : 'online');
    const trophiesN = typeof trophies === 'number' ? trophies : 0;
    const avatarId = typeof myAvatarId !== 'undefined' ? myAvatarId : 'init';
    const status = (typeof myStatus === 'string') ? myStatus : '';
    // Signature without the heavy base64 blob
    const sig = [myFriendCode, name, activity, trophiesN, avatarId, status].join('|');
    const needCustom = avatarId === 'custom' && myAvatarCustom
      && (!_presenceCustomSent || force);
    if (!force && sig === _lastPresenceSig && !needCustom) {
      _lastPresenceAt = now;
      return;
    }
    _lastPresenceAt = now;
    _lastPresenceSig = sig;
    // cosmeticsHint only once per session (migration); not every heartbeat
    var hint = undefined;
    try {
      if (!_presenceCustomSent && typeof window._bpCosmeticsHintSent === 'undefined') {
        window._bpCosmeticsHintSent = true;
        hint = {
          diamonds: typeof diamonds === 'number' ? diamonds : 0,
          ownedSkins: typeof ownedSkins !== 'undefined' ? ownedSkins.slice() : undefined,
          ownedBoards: typeof ownedBoards !== 'undefined' ? ownedBoards.slice() : undefined,
          equippedSkin: typeof equippedSkinId !== 'undefined' ? equippedSkinId : undefined,
          equippedBoard: typeof equippedBoardId !== 'undefined' ? equippedBoardId : undefined
        };
      }
    } catch (_) {}
    const payload = {
      friendCode: myFriendCode,
      name: name,
      activity: activity,
      trophies: trophiesN,
      avatarId: avatarId,
      status: status
    };
    // Send custom avatar at most once until it changes (force=true on profile save)
    if (needCustom) {
      payload.avatarCustom = myAvatarCustom;
      _presenceCustomSent = true;
    } else if (avatarId !== 'custom') {
      payload.avatarCustom = '';
      _presenceCustomSent = false;
    }
    if (hint) payload.cosmeticsHint = hint;
    MatchClient.registerPresence(payload);
  } catch (_) {}
}

/** Server may reassign friend code when the local one collides with another live guest. */
(function bindPresenceOkHandler() {
  if (typeof MatchClient === 'undefined') return;
  try {
    MatchClient.on('presence_ok', (data) => {
      if (!data || !data.friendCode) return;
      const serverCode = String(data.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!serverCode || serverCode.length < 4) return;
      if (serverCode === myFriendCode) return;
      // Accept server-assigned unique code (guests and anyone whose proposed code was taken)
      myFriendCode = serverCode;
      try { localStorage.setItem('bp_my_code', myFriendCode); } catch (_) {}
      try {
        const codeEl = document.getElementById('profileFriendCode');
        if (codeEl) codeEl.textContent = myFriendCode;
      } catch (_) {}
      try {
        const codeEl2 = document.getElementById('myFriendCode');
        if (codeEl2) codeEl2.textContent = myFriendCode;
      } catch (_) {}
      try { scheduleGuestProgressSync && scheduleGuestProgressSync(); } catch (_) {}
    });
  } catch (_) {}
})();


function normalizeFriendCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
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
    // update name / avatar if we learned more
    const f = friends.find(x => x.code === code);
    if (f) {
      if (name && (!f.name || f.name.startsWith('Friend') || f.name.startsWith('Игрок'))) f.name = name;
      if (extra && extra.avatarId) f.avatarId = String(extra.avatarId).slice(0, 32);
      if (extra && typeof extra.avatarCustom === 'string') f.avatarCustom = extra.avatarCustom;
      if (extra && typeof extra.trophies === 'number') f.trophies = extra.trophies | 0;
    }
    saveFriends();
    try { scheduleFriendsSync(); } catch (_) {}
    try { renderFriendRequests(); renderOutgoingPending(); updateFriendsSectionCounts(); } catch (_) {}
    return false;
  }
  friends.unshift({
    code,
    name: (name || ('Игрок ' + code.slice(0, 3))).trim().slice(0, 20),
    added: Date.now(),
    trophies: extra && typeof extra.trophies === 'number' ? extra.trophies : undefined,
    avatarId: extra && extra.avatarId ? String(extra.avatarId).slice(0, 32) : undefined,
    avatarCustom: extra && typeof extra.avatarCustom === 'string' ? extra.avatarCustom : undefined
  });
  saveFriends();
  try { scheduleFriendsSync(); } catch (_) {}
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
      <div class="f-av" data-av-fi="${i}">${initials}<span class="f-online-dot ${dotCls}"></span></div>
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
  // Paint real avatars into friend cards + open mini profile on click
  try {
    list.querySelectorAll('.f-av[data-av-fi]').forEach((avEl) => {
      const fi = parseInt(avEl.getAttribute('data-av-fi'), 10);
      const f = friends[fi];
      if (!f) return;
      const dot = avEl.querySelector('.f-online-dot');
      try {
        renderAvatarInto(avEl, {
          avatarId: f.avatarId || 'init',
          nick: f.name || f.code,
          custom: (f.avatarId === 'custom' && f.avatarCustom) ? f.avatarCustom : null
        });
      } catch (_) {}
      if (dot) {
        try { avEl.appendChild(dot); } catch (_) {
          const d = document.createElement('span');
          d.className = 'f-online-dot ' + (getFriendPresence(f.code) === 'online' ? 'on' : getFriendPresence(f.code) === 'offline' ? 'off' : 'checking');
          avEl.appendChild(d);
        }
      }
      avEl.style.cursor = 'pointer';
      avEl.title = 'Профиль';
      avEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { openFriendMiniProfile(f); } catch (_) {}
      });
    });
  } catch (_) {}
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
      bpConfirm({
        title: 'Удалить из друзей?',
        text: 'Вы также пропадёте у него в списке.',
        okLabel: 'Удалить',
        danger: true
      }).then(function (ok) { if (ok) removeFriendAt(idx); });
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
      if (!isNaN(idx)) {
        bpConfirm({
          title: 'Удалить из друзей?',
          text: 'Вы также пропадёте у него в списке.',
          okLabel: 'Удалить',
          danger: true
        }).then(function (ok) { if (ok) removeFriendAt(idx); });
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
  if (!code || code.length < 8) {
    setFriendAddStatus('Нужен код из 8 символов', 'err');
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

/** Add friend by 8-char code (existence checked on server). Nickname search uses the modal. */
function addFriendByCode(raw) {
  const input = document.getElementById('friendCodeInput');
  const typed = String(raw != null ? raw : (input && input.value) || '').trim();
  if (input) input.value = typed;

  if (!typed) {
    setFriendAddStatus('Введи код друга из 8 символов', 'err');
    return;
  }

  const asCode = normalizeFriendCode(typed);
  if (asCode.length >= 8) {
    sendFriendRequestToCode(asCode);
    return;
  }

  // Incomplete code — nick search is a separate button/modal
  setFriendAddStatus('Нужен код из 8 символов. Поиск по нику — кнопка ниже.', 'err');
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
    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;flex:1';
    const av = document.createElement('div');
    av.className = 'f-av';
    av.style.cssText = 'width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden';
    try {
      renderAvatarInto(av, {
        avatarId: r.avatarId || 'init',
        nick: name,
        custom: (r.avatarId === 'custom' && r.avatarCustom) ? r.avatarCustom : null
      });
    } catch (_) {
      av.textContent = name.slice(0, 2).toUpperCase();
    }
    const info = document.createElement('div');
    info.style.minWidth = '0';
    info.innerHTML =
      '<div style="font-weight:800">' + name.replace(/</g, '') +
      (isOnline ? ' <span style="color:#3dce6a;font-size:0.7rem">●</span>' : ' <span style="opacity:0.45;font-size:0.7rem">○</span>') +
      '</div>' +
      '<div style="font-size:0.75rem;opacity:0.7">' + code +
      (r.trophies != null ? ' · 🏆 ' + (r.trophies | 0) : '') +
      ' · ' + statusLabel +
      '</div>';
    left.appendChild(av);
    left.appendChild(info);
    card.appendChild(left);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    btn.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.add','Добавить'):'Добавить');
    btn.addEventListener('click', () => {
      closeNickSearchModal();
      const mainIn = document.getElementById('friendCodeInput');
      if (mainIn) mainIn.value = code;
      // Only send invitation — do NOT add to friends until they accept
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
    // Before playStartTs show full duration (intro is not match time)
    const playStart = (typeof BPState.matchPlayStartTs === 'number' && BPState.matchPlayStartTs > 0)
      ? BPState.matchPlayStartTs : 0;
    if (playStart && Date.now() < playStart) {
      vsTimeLeft = (typeof vsDuration === 'number' ? vsDuration : 120) | 0;
    } else {
      vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));
    }
    try { updateTimerDisplay(); } catch (_) {}
    if (vsTimerId) { try { clearInterval(vsTimerId); } catch (_) {} vsTimerId = null; }
    vsTimerId = setInterval(() => {
      if (!vsActive || BPState.matchEnded) return;
      const ps = (typeof BPState.matchPlayStartTs === 'number' && BPState.matchPlayStartTs > 0)
        ? BPState.matchPlayStartTs : 0;
      if (ps && Date.now() < ps) {
        vsTimeLeft = (typeof vsDuration === 'number' ? vsDuration : 120) | 0;
      } else {
        vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));
      }
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
          try { if (typeof scheduleHistorySync === 'function') scheduleHistorySync(); } catch (_2) {}
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
function readAuthTokenCookie() {
  try {
    const m = /(?:^|;\s*)bp_auth_token=([^;]+)/.exec(document.cookie || '');
    return m ? decodeURIComponent(m[1].trim()) : '';
  } catch (_) { return ''; }
}
function persistAuthToken(token) {
  if (!token) {
    try { localStorage.removeItem('bp_auth_token'); } catch (_) {}
    try { document.cookie = 'bp_auth_token=; path=/; max-age=0; SameSite=Lax'; } catch (_) {}
    return;
  }
  try { localStorage.setItem('bp_auth_token', String(token)); } catch (_) {}
  try {
    document.cookie = 'bp_auth_token=' + encodeURIComponent(String(token))
      + '; path=/; max-age=2592000; SameSite=Lax';
  } catch (_) {}
}
function loadAuthToken() {
  try {
    const ls = localStorage.getItem('bp_auth_token');
    if (ls) return ls;
  } catch (_) {}
  const c = readAuthTokenCookie();
  return c || null;
}
function readGuestOkCookie() {
  try {
    return /(?:^|;\s*)bp_guest_ok=1(?:;|$)/.test(document.cookie || '');
  } catch (_) { return false; }
}
function persistGuestOk(on) {
  if (on) {
    try { localStorage.setItem('bp_guest_ok', '1'); } catch (_) {}
    try { document.cookie = 'bp_guest_ok=1; path=/; max-age=2592000; SameSite=Lax'; } catch (_) {}
  } else {
    try { localStorage.removeItem('bp_guest_ok'); } catch (_) {}
    try { document.cookie = 'bp_guest_ok=; path=/; max-age=0; SameSite=Lax'; } catch (_) {}
  }
}
try { authToken = loadAuthToken(); } catch (_) { authToken = null; }
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

function readDeviceIdCookie() {
  try {
    const m = /(?:^|;\s*)bp_device_id=([A-Za-z0-9_-]{16,64})/.exec(document.cookie || '');
    return m ? m[1] : '';
  } catch (_) { return ''; }
}
function persistDeviceId(id) {
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) return;
  try { localStorage.setItem('bp_device_id', id); } catch (_) {}
  try {
    document.cookie = 'bp_device_id=' + id + '; path=/; max-age=315360000; SameSite=Lax';
  } catch (_) {}
}

/**
 * Hardware/browser fingerprint — same machine+browser ⇒ same id after full cookie/localStorage wipe.
 * This is the anti-multi-guest key (not IP, not random UUID).
 */
function computeDeviceFingerprint() {
  try {
    const parts = [];
    try { parts.push(String(navigator.userAgent || '')); } catch (_) {}
    try { parts.push(String(navigator.language || '')); } catch (_) {}
    try { parts.push(String(navigator.languages ? navigator.languages.join(',') : '')); } catch (_) {}
    try { parts.push(String(navigator.platform || '')); } catch (_) {}
    try { parts.push(String(navigator.hardwareConcurrency || 0)); } catch (_) {}
    try { parts.push(String(navigator.deviceMemory || 0)); } catch (_) {}
    try { parts.push(String(navigator.maxTouchPoints || 0)); } catch (_) {}
    try {
      parts.push([
        screen.width | 0, screen.height | 0, screen.availWidth | 0, screen.availHeight | 0,
        screen.colorDepth | 0, screen.pixelDepth | 0
      ].join('x'));
    } catch (_) {}
    try { parts.push(String(new Date().getTimezoneOffset())); } catch (_) {}
    try { parts.push(String(Intl.DateTimeFormat().resolvedOptions().timeZone || '')); } catch (_) {}
    // Canvas
    try {
      const c = document.createElement('canvas');
      c.width = 240; c.height = 60;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '16px "Arial"';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 120, 60);
        ctx.fillStyle = '#069';
        ctx.fillText('BlockPuzzle.fp.v2', 4, 8);
        ctx.strokeStyle = '#0f0';
        ctx.strokeRect(1, 1, 238, 58);
        parts.push(c.toDataURL().slice(-96));
      }
    } catch (_) {}
    // WebGL renderer
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || ''));
          parts.push(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''));
        }
        parts.push(String(gl.getParameter(gl.VERSION) || ''));
      }
    } catch (_) {}
    const raw = parts.join('|');
    // FNV-1a 32-bit x4 over slices → 40 hex-like chars
    function fnv1a(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }
    const h0 = fnv1a(raw);
    const h1 = fnv1a(raw + '#1' + String(h0));
    const h2 = fnv1a(raw + '#2' + String(h1));
    const h3 = fnv1a(raw + '#3' + String(h2));
    const h4 = fnv1a(raw + '#4' + String(h3));
    function toBase36(n) {
      return (n >>> 0).toString(36);
    }
    let id = 'fp' + toBase36(h0) + toBase36(h1) + toBase36(h2) + toBase36(h3) + toBase36(h4);
    id = id.replace(/[^A-Za-z0-9]/g, '').slice(0, 48);
    if (id.length < 16) id = (id + '0000000000000000').slice(0, 16);
    return id;
  } catch (_) {
    return '';
  }
}

function ensureMyFriendCode() {
  try {
    // Keep only full 8-char codes; short legacy codes get replaced on next assign
    if (typeof myFriendCode === 'string' && myFriendCode.length === 8) return myFriendCode;
  } catch (_) {}
  try {
    const ls = localStorage.getItem('bp_my_code');
    if (ls && String(ls).length === 8) {
      myFriendCode = String(ls).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      return myFriendCode;
    }
  } catch (_) {}
  let code = '';
  try {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } catch (_) {
    code = ('G' + String(Date.now()).slice(-7)).slice(0, 8);
  }
  myFriendCode = code;
  try { localStorage.setItem('bp_my_code', code); } catch (_) {}
  return code;
}

/**
 * Constant device id for anti multi-guest.
 * Source of truth = browser fingerprint (survives full cookie + localStorage wipe).
 * localStorage/cookie only cache the same fingerprint for speed.
 */
function getDeviceId() {
  try {
    // Always compute fingerprint — same PC/browser ⇒ same id after total wipe
    const fp = computeDeviceFingerprint();
    if (fp && /^[A-Za-z0-9_-]{16,64}$/.test(fp)) {
      persistDeviceId(fp);
      return fp;
    }
    // Extremely rare fallback (no canvas/navigator)
    let id = '';
    try { id = localStorage.getItem('bp_device_id') || ''; } catch (_) { id = ''; }
    if (id && /^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
    id = readDeviceIdCookie();
    if (id && /^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      persistDeviceId(id);
      return id;
    }
    id = 'fpfallback' + String(Date.now()).slice(-10);
    persistDeviceId(id);
    return id;
  } catch (_) {
    return 'fpfallback' + String(Date.now()).slice(-10);
  }
}

async function apiFetch(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (authToken) headers.Authorization = 'Bearer ' + authToken;
  try {
    const did = getDeviceId();
    if (did) headers['X-Device-Id'] = did;
  } catch (_) {}
  let body = opts.body;
  // Ensure deviceId also present in JSON body for POST APIs
  if (body != null && typeof body === 'object' && !Array.isArray(body) && !body.deviceId) {
    try {
      body = Object.assign({}, body, { deviceId: getDeviceId() });
    } catch (_) {}
  }
  let res;
  try {
    res = await fetch(apiBase() + path, {
      method: opts.method || 'GET',
      headers,
      credentials: 'same-origin',
      body: body != null ? JSON.stringify(body) : undefined
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
    // Prefer server nick always (registration / login must replace guest "Игрок"/"Player")
    if (account.nick) {
      myNickname = String(account.nick).slice(0, 24);
      localStorage.setItem('bp_nickname', myNickname);
    } else if (account.login) {
      myNickname = String(account.login).slice(0, 24);
      localStorage.setItem('bp_nickname', myNickname);
    }
    if (typeof account.trophies === 'number') {
      trophies = Math.max(0, account.trophies | 0);
      localStorage.setItem('bp_trophies', String(trophies));
    }
    if (typeof account.diamonds === 'number') {
      try {
        // Server is the ONLY authority for donation currency
        diamonds = Math.max(0, account.diamonds | 0);
        localStorage.setItem('bp_diamonds', String(diamonds));
      } catch (_) {}
    }
    if (typeof account.best === 'number') {
      try {
        best = Math.max(0, account.best | 0);
        localStorage.setItem('bp_best', String(best));
      } catch (_) {}
    }
    if (account.classicSave && typeof account.classicSave === 'object' && Array.isArray(account.classicSave.grid)) {
      try {
        const key = (typeof classicSaveStorageKey === 'function')
          ? classicSaveStorageKey()
          : ('bp_classic_save_acc_' + String(account.id || ''));
        localStorage.setItem(key, JSON.stringify(account.classicSave));
      } catch (_) {}
    } else {
      // Different account — do not keep previous user's board under this identity
      try {
        const key = (typeof classicSaveStorageKey === 'function')
          ? classicSaveStorageKey()
          : ('bp_classic_save_acc_' + String(account.id || ''));
        // leave key as-is if empty; wipe shared legacy key
        localStorage.removeItem('bp_classic_save');
      } catch (_) {}
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
    if (Array.isArray(account.ownedSkins) && typeof ownedSkins !== 'undefined') {
      try {
        const free = (typeof FREE_SKIN_IDS !== 'undefined' && Array.isArray(FREE_SKIN_IDS))
          ? FREE_SKIN_IDS.slice()
          : ['default'];
        ownedSkins = account.ownedSkins.map(String);
        free.forEach((id) => { if (!ownedSkins.includes(id)) ownedSkins.push(id); });
        localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins));
      } catch (_) {}
    }
    if (Array.isArray(account.ownedBoards) && typeof ownedBoards !== 'undefined') {
      try {
        const freeB = (typeof FREE_BOARD_IDS !== 'undefined' && Array.isArray(FREE_BOARD_IDS))
          ? FREE_BOARD_IDS.slice()
          : ['field_default'];
        ownedBoards = account.ownedBoards.map(String);
        freeB.forEach((id) => { if (!ownedBoards.includes(id)) ownedBoards.push(id); });
        localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards));
      } catch (_) {}
    }
    if (account.skinId && typeof equippedSkinId !== 'undefined') {
      try {
        equippedSkinId = account.skinId;
        localStorage.setItem('bp_skin_equipped', equippedSkinId);
        localStorage.setItem('bp_skin', equippedSkinId);
        if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
      } catch (_) {}
    }
    if (account.boardId && typeof equippedBoardId !== 'undefined') {
      try {
        equippedBoardId = account.boardId;
        localStorage.setItem('bp_board_equipped', equippedBoardId);
        localStorage.setItem('bp_board', equippedBoardId);
        if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
      } catch (_) {}
    }
    // Always refresh shop/inventory so owned skins survive reload/re-login
    try {
      if (typeof renderShopGrid === 'function') renderShopGrid();
      if (typeof renderInvGrid === 'function') renderInvGrid();
      if (typeof renderShop === 'function') renderShop();
      else if (typeof renderSkinShop === 'function') renderSkinShop();
      if (typeof updateMenuStats === 'function') updateMenuStats();
    } catch (_) {}
  } catch (_) {}
  try {
    if (Array.isArray(account.friends) && account.friends.length) {
      mergeFriendsFromServer(account.friends);
      try { renderFriends(false); } catch (_) {}
    }
  } catch (_) {}
  try {
    if (Array.isArray(account.history)) {
      mergeHistoryFromServer(account.history);
      try { if (typeof renderHistory === 'function') renderHistory(); } catch (_) {}
    }
  } catch (_) {}
  try {
    if (account.achievements && typeof account.achievements === 'object') {
      if (typeof achProgress === 'undefined') {
        // will be defined in 03-audio; assign via global
      }
      try {
        achProgress = Object.assign({}, account.achievements);
        localStorage.setItem('bp_ach', JSON.stringify(achProgress));
        // Ranked score record lives in the account (achievements.ranked_best_score), never in the device
        try {
          let rb = Math.max(0, Number(achProgress.ranked_best_score) | 0);
          (Array.isArray(account.history) ? account.history : []).forEach(function (h) {
            if (h && h.mode === 'online' && typeof h.my === 'number' && h.my > rb) rb = h.my | 0;
          });
          rankedBest = rb;
          localStorage.setItem('bp_ranked_best', String(rb));
        } catch (_) {}
        if (typeof checkNewAchievements === 'function') checkNewAchievements();
        if (typeof updateAchievementsButton === 'function') updateAchievementsButton();
        if (typeof renderAchievements === 'function') renderAchievements();
      } catch (_) {}
    }
    // Account is sole source of truth for bot stars (same as skins) — replace, never merge local leftovers
    try {
      botStars = {};
      if (account.botStars && typeof account.botStars === 'object' && !Array.isArray(account.botStars)) {
        const incoming = account.botStars;
        for (const id of Object.keys(incoming)) {
          if (!id) continue;
          const st = incoming[id];
          if (!st || typeof st !== 'object') continue;
          const entry = {};
          if (st['60']) entry['60'] = true;
          if (st['120']) entry['120'] = true;
          if (st['180']) entry['180'] = true;
          if (Object.keys(entry).length) botStars[String(id)] = entry;
        }
      }
      if (typeof saveBotStars === 'function') saveBotStars();
      else try { localStorage.setItem('bp_bot_stars', JSON.stringify(botStars)); } catch (_) {}
    } catch (_) {}
  } catch (_) {}
  // Server state is now in memory — only from here on is it safe to PATCH it back
  try { window._bpAccountLoaded = true; } catch (_) {}
  try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
  try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
  try { if (typeof updateVersusNameLabels === 'function') updateVersusNameLabels(); } catch (_) {}
  updateAccountUI();
}

/** Merge server match history with local (by id / date). Server is preferred on login. */
function mergeHistoryFromServer(serverHistory, opts) {
  opts = opts || {};
  if (!Array.isArray(serverHistory)) return;
  try {
    if (!Array.isArray(matchHistory)) matchHistory = [];
  } catch (_) {
    return;
  }
  const byId = new Map();
  const add = (h) => {
    if (!h) return;
    const id = h.id || (String(h.date || '') + '_' + String(h.my || '') + '_' + String(h.oppScore || h.opp || ''));
    if (!id) return;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, h);
      return;
    }
    // Prefer entry that still has moves (replay)
    const prevMoves = Array.isArray(prev.moves) ? prev.moves.length : 0;
    const nextMoves = Array.isArray(h.moves) ? h.moves.length : 0;
    if (nextMoves > prevMoves) byId.set(id, h);
  };
  if (opts.preferServer) {
    for (const h of matchHistory) add(h);
    for (const h of serverHistory) add(h);
  } else {
    for (const h of serverHistory) add(h);
    for (const h of matchHistory) add(h);
  }
  matchHistory = Array.from(byId.values())
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, 30);
  try { localStorage.setItem('bp_history', JSON.stringify(matchHistory)); } catch (e) {
    try {
      matchHistory = matchHistory.slice(0, 15).map((h, i) => (i < 8 ? h : Object.assign({}, h, { moves: [] })));
      localStorage.setItem('bp_history', JSON.stringify(matchHistory));
    } catch (_) {}
  }
}

function scheduleHistorySync() {
  if (!authToken) return;
  if (window._historySyncTimer) clearTimeout(window._historySyncTimer);
  window._historySyncTimer = setTimeout(() => {
    window._historySyncTimer = null;
    if (!authToken) return; // logged out meanwhile — must not fall through to the guest path
    try {
      syncProfileToServer({
        history: (typeof matchHistory !== 'undefined' && Array.isArray(matchHistory))
          ? matchHistory.slice(0, 30)
          : []
      });
    } catch (_) {}
  }, 1200);
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
  // After registration: status takes the place of «Гость» pill. Empty → nothing.
  if (pill) {
    if (isIn) {
      const st = (myStatus || '').trim();
      if (st) {
        pill.textContent = st;
        pill.style.color = 'var(--accent, #00d4aa)';
        pill.hidden = false;
      } else {
        pill.textContent = '';
        pill.hidden = true;
      }
    } else {
      pill.textContent = (typeof globalThis.t==='function'?globalThis.t('profile.guestPill','👤 Гость'):'👤 Гость');
      pill.style.color = '';
      pill.hidden = false;
    }
  }
  // Home profile badge — status under nick (not the nick again)
  try {
    const badge = document.querySelector('.home-profile-badge');
    if (badge) {
      if (isIn) {
        const st = (myStatus || '').trim();
        badge.textContent = st || (typeof globalThis.t==='function'?globalThis.t('menu.account','Аккаунт'):'Аккаунт');
        badge.classList.remove('guest');
        badge.classList.add('account');
      } else {
        badge.textContent = (typeof globalThis.t==='function'?globalThis.t('menu.guest','Гость'):'Гость');
        badge.classList.add('guest');
        badge.classList.remove('account');
      }
    }
  } catch (_) {}
  try {
    const hn = document.getElementById('homeProfileName');
    if (hn && isIn && myNickname) hn.textContent = myNickname;
  } catch (_) {}
  try { setProfileNameStatusLocked(!isIn); } catch (_) {}
}

function showAuthLoading(text, subText) {
  let el = document.getElementById('authLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'authLoadingOverlay';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="auth-load-card">' +
      '<div class="auth-load-spin"></div>' +
      '<div class="auth-load-title" id="authLoadTitle">Загрузка аккаунта…</div>' +
      '<div class="auth-load-sub" id="authLoadSub">Синхронизация прогресса</div>' +
      '</div>';
    document.body.appendChild(el);
    // Inject minimal styles once — z-index ABOVE entry-gate (100000)
    if (!document.getElementById('authLoadStyles')) {
      const st = document.createElement('style');
      st.id = 'authLoadStyles';
      st.textContent =
        '#authLoadingOverlay{position:fixed;inset:0;z-index:100050;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(4,12,10,.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);opacity:0;transition:opacity .25s ease;pointer-events:none}' +
        '#authLoadingOverlay.visible{opacity:1;pointer-events:auto}' +
        '.auth-load-card{display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px 32px;border-radius:20px;' +
        'background:linear-gradient(160deg,rgba(20,40,36,.97),rgba(10,22,20,.97));border:1px solid rgba(0,212,170,.28);box-shadow:0 20px 60px rgba(0,0,0,.55);min-width:240px}' +
        '.auth-load-spin{width:42px;height:42px;border-radius:50%;border:3px solid rgba(0,212,170,.18);border-top-color:#00d4aa;' +
        'animation:authSpin .75s linear infinite}' +
        '@keyframes authSpin{to{transform:rotate(360deg)}}' +
        '.auth-load-title{font-weight:800;font-size:1.05rem;color:#e8fff8;text-align:center}' +
        '.auth-load-sub{font-size:.8rem;opacity:.7;color:#b8e8d8;text-align:center}';
      document.head.appendChild(st);
    }
  }
  const title = document.getElementById('authLoadTitle');
  const sub = document.getElementById('authLoadSub');
  if (title) title.textContent = text || 'Загрузка аккаунта…';
  if (sub) sub.textContent = subText || 'Синхронизация прогресса';
  el.style.display = 'flex';
  el.style.zIndex = '100050';
  // Force reflow so opacity transition always plays
  try { void el.offsetWidth; } catch (_) {}
  el.classList.add('visible');
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';
}
function hideAuthLoading() {
  const el = document.getElementById('authLoadingOverlay');
  if (!el) return;
  el.classList.remove('visible');
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  setTimeout(() => { try { el.style.display = 'none'; } catch (_) {} }, 320);
}

function snapshotGuestProgress() {
  let ach = {};
  try { ach = (typeof achProgress === 'object' && achProgress) ? Object.assign({}, achProgress) : {}; } catch (_) {}
  let stars = null;
  try {
    if (typeof botStars === 'object' && botStars && Object.keys(botStars).length) {
      stars = JSON.parse(JSON.stringify(botStars));
    }
  } catch (_) { stars = null; }
  let classicSave = null;
  try {
    const raw = localStorage.getItem(typeof classicSaveStorageKey === 'function' ? classicSaveStorageKey() : 'bp_classic_save');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.grid) && data.grid.length >= 8) classicSave = data;
    }
  } catch (_) { classicSave = null; }
  return {
    trophies: typeof trophies === 'number' ? trophies : 0,
    diamonds: typeof diamonds === 'number' ? diamonds : 0,
    best: typeof best === 'number' ? best : 0,
    ownedSkins: (typeof ownedSkins !== 'undefined' && Array.isArray(ownedSkins)) ? ownedSkins.slice() : null,
    ownedBoards: (typeof ownedBoards !== 'undefined' && Array.isArray(ownedBoards)) ? ownedBoards.slice() : null,
    skinId: typeof equippedSkinId !== 'undefined' ? equippedSkinId : null,
    boardId: typeof equippedBoardId !== 'undefined' ? equippedBoardId : null,
    friends: (typeof friends !== 'undefined' && Array.isArray(friends)) ? friends.slice() : null,
    history: (typeof matchHistory !== 'undefined' && Array.isArray(matchHistory)) ? matchHistory.slice() : null,
    achievements: ach,
    botStars: stars,
    classicSave: classicSave,
    nick: typeof myNickname === 'string' ? myNickname : null,
    status: typeof myStatus === 'string' ? myStatus : null,
    avatarId: typeof myAvatarId === 'string' ? myAvatarId : null,
    avatarCustom: typeof myAvatarCustom === 'string' ? myAvatarCustom : null,
    friendCode: (typeof myFriendCode === 'string' && myFriendCode)
      ? String(myFriendCode).toUpperCase()
      : (function () {
          try { return String(localStorage.getItem('bp_my_code') || '').toUpperCase() || null; } catch (_) { return null; }
        })()
  };
}

/** True if nick looks like auto-generated guest default (PlayerABC / Гость / …). */
function isDefaultGuestNick(n) {
  const s = String(n || '').trim();
  if (!s) return true;
  if (s === 'Гость' || s === 'Guest' || s === 'Игрок') return true;
  if (/^Player[A-Z0-9]{0,8}$/i.test(s)) return true;
  if (/^Игрок\s/i.test(s)) return true;
  return false;
}

/** Merge local guest + IP-bound progress for registration transfer. */
function collectGuestProgressForRegister() {
  // After browser wipe there is no local guest session — do NOT invent starter 9999.
  // Server IP / DB progress is the only truth in that case.
  let hasLocalGuest = false;
  try { hasLocalGuest = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
  const ip = (typeof _ipGuestProgress !== 'undefined' && _ipGuestProgress) ? _ipGuestProgress : null;

  if (!hasLocalGuest) {
    // Pure server snapshot (from /api/auth/guest-allowed)
    if (ip && typeof ip === 'object') {
      const out = Object.assign({}, ip);
      if (typeof out.diamonds !== 'number' && typeof diamonds === 'number') {
        // only if live value is not a fresh-default
        const d = diamonds | 0;
        if (d !== 9999) out.diamonds = Math.max(0, d);
      }
      return out;
    }
    // No IP progress known — return null so server uses IP/DB only
    return null;
  }

  // Live shop balance for active guest session
  try {
    const lsD = parseInt(localStorage.getItem('bp_diamonds') || '', 10);
    if (isFinite(lsD) && lsD >= 0) diamonds = Math.max(typeof diamonds === 'number' ? diamonds : 0, lsD | 0);
  } catch (_) {}
  if (typeof diamonds !== 'number' || !isFinite(diamonds)) {
    try {
      const lsD2 = parseInt(localStorage.getItem('bp_diamonds') || '0', 10);
      diamonds = isFinite(lsD2) ? (lsD2 | 0) : 0;
    } catch (_) { diamonds = 0; }
  }
  const local = snapshotGuestProgress() || {};
  local.diamonds = Math.max(0, diamonds | 0);
  if (!ip) {
    return local;
  }

  // Start from IP, then layer local — but never let empty local arrays wipe IP data
  const merged = Object.assign({}, ip);

  // Currencies: max of both + live
  try {
    merged.diamonds = Math.max(
      typeof ip.diamonds === 'number' ? ip.diamonds : 0,
      typeof local.diamonds === 'number' ? local.diamonds : 0,
      typeof diamonds === 'number' ? diamonds : 0
    );
    merged.trophies = Math.max(
      typeof ip.trophies === 'number' ? ip.trophies : 0,
      typeof local.trophies === 'number' ? local.trophies : 0
    );
    merged.best = Math.max(
      typeof ip.best === 'number' ? ip.best : 0,
      typeof local.best === 'number' ? local.best : 0
    );
  } catch (_) {}

  // Cosmetics inventory: union
  try {
    const skins = [];
    (Array.isArray(ip.ownedSkins) ? ip.ownedSkins : []).forEach((x) => { if (x) skins.push(String(x)); });
    (Array.isArray(local.ownedSkins) ? local.ownedSkins : []).forEach((x) => { if (x) skins.push(String(x)); });
    if (skins.length) merged.ownedSkins = Array.from(new Set(skins));
  } catch (_) {}
  try {
    const boards = [];
    (Array.isArray(ip.ownedBoards) ? ip.ownedBoards : []).forEach((x) => { if (x) boards.push(String(x)); });
    (Array.isArray(local.ownedBoards) ? local.ownedBoards : []).forEach((x) => { if (x) boards.push(String(x)); });
    if (boards.length) merged.ownedBoards = Array.from(new Set(boards));
  } catch (_) {}

  // Equipped: prefer local if set
  if (local.skinId) merged.skinId = local.skinId;
  if (local.boardId) merged.boardId = local.boardId;
  if (local.avatarId) merged.avatarId = local.avatarId;
  if (typeof local.avatarCustom === 'string' && local.avatarCustom) merged.avatarCustom = local.avatarCustom;
  if (typeof local.status === 'string' && local.status) merged.status = local.status;

  // Friend code: local session first
  if (local.friendCode) merged.friendCode = local.friendCode;
  else if (ip.friendCode) merged.friendCode = ip.friendCode;

  // Friends: union by code
  try {
    const map = new Map();
    (Array.isArray(ip.friends) ? ip.friends : []).forEach((f) => {
      if (f && f.code) map.set(String(f.code).toUpperCase(), f);
    });
    (Array.isArray(local.friends) ? local.friends : []).forEach((f) => {
      if (f && f.code) map.set(String(f.code).toUpperCase(), f);
    });
    merged.friends = Array.from(map.values());
  } catch (_) {}

  // History: prefer longer / merge by id
  try {
    const byId = new Map();
    (Array.isArray(ip.history) ? ip.history : []).forEach((h, i) => {
      if (!h) return;
      byId.set(String(h.id || ('ip' + i)), h);
    });
    (Array.isArray(local.history) ? local.history : []).forEach((h, i) => {
      if (!h) return;
      byId.set(String(h.id || ('loc' + i)), h);
    });
    merged.history = Array.from(byId.values()).slice(0, 30);
  } catch (_) {}

  // Achievements: merge
  try {
    merged.achievements = Object.assign(
      {},
      (ip.achievements && typeof ip.achievements === 'object') ? ip.achievements : {},
      (local.achievements && typeof local.achievements === 'object') ? local.achievements : {}
    );
  } catch (_) {}

  // Bot stars: union (guest progress only — account apply later replaces from server)
  try {
    const stars = {};
    const add = (src) => {
      if (!src || typeof src !== 'object') return;
      for (const id of Object.keys(src)) {
        const st = src[id];
        if (!st || typeof st !== 'object') continue;
        if (!stars[id]) stars[id] = {};
        if (st['60']) stars[id]['60'] = true;
        if (st['120']) stars[id]['120'] = true;
        if (st['180']) stars[id]['180'] = true;
      }
    };
    add(ip.botStars);
    add(local.botStars);
    if (Object.keys(stars).length) merged.botStars = stars;
  } catch (_) {}
  // Classic board: prefer local (newer play), else IP
  try {
    if (local.classicSave && local.classicSave.grid) merged.classicSave = local.classicSave;
    else if (ip.classicSave && ip.classicSave.grid) merged.classicSave = ip.classicSave;
  } catch (_) {}

  // Nick is NOT transferred to registration — form/login wins on server.
  // Still keep best available guest nick in snapshot for display only.
  try {
    const lNick = local.nick ? String(local.nick) : '';
    const iNick = ip.nick ? String(ip.nick) : '';
    if (!isDefaultGuestNick(lNick)) merged.nick = lNick;
    else if (!isDefaultGuestNick(iNick)) merged.nick = iNick;
    else merged.nick = lNick || iNick || null;
  } catch (_) {}

  return merged;
}
try { window.collectGuestProgressForRegister = collectGuestProgressForRegister; } catch (_) {}

/**
 * Wipe ALL local progress to a clean slate.
 * Account data on the server is NOT touched — only this device's local state.
 * Generates a new friend code so the guest does not inherit the previous
 * account's server cosmetics / presence profile.
 */
/**
 * Wipe local guest progress.
 * @param {{ keepFriendCode?: boolean }} [opts]
 *   keepFriendCode — do not blank myFriendCode (login flow already applied account code).
 */
function discardGuestProgressFully(opts) {
  opts = opts || {};
  try {
    trophies = 0;
    diamonds = 9999;
    best = 0;
    friends = [];
    matchHistory = [];
    try { achProgress = {}; localStorage.setItem('bp_ach', '{}'); } catch (_) {}
    try {
      botStars = {};
      if (typeof saveBotStars === 'function') saveBotStars();
      else localStorage.setItem('bp_bot_stars', '{}');
    } catch (_) {}
    try { localStorage.setItem('bp_friends', '[]'); } catch (_) {}
    try { localStorage.setItem('bp_history', '[]'); } catch (_) {}
    try { localStorage.setItem('bp_trophies', '0'); } catch (_) {}
    try { localStorage.setItem('bp_diamonds', '9999'); } catch (_) {}
    try { localStorage.setItem('bp_best', '0'); } catch (_) {}
    try { localStorage.removeItem('bp_status'); myStatus = ''; } catch (_) {}
    // Reset skins/boards to base defaults only (no free pack)
    try {
      ownedSkins = (typeof FREE_SKIN_IDS !== 'undefined' && Array.isArray(FREE_SKIN_IDS))
        ? FREE_SKIN_IDS.slice()
        : ['default'];
      ownedBoards = (typeof FREE_BOARD_IDS !== 'undefined' && Array.isArray(FREE_BOARD_IDS))
        ? FREE_BOARD_IDS.slice()
        : ['field_default'];
      equippedSkinId = 'default';
      equippedBoardId = 'field_default';
      localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins));
      localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards));
      localStorage.setItem('bp_skin_equipped', 'default');
      localStorage.setItem('bp_board_equipped', 'field_default');
      localStorage.setItem('bp_skin', 'default');
      localStorage.setItem('bp_board', 'field_default');
    } catch (_) {}
    try { localStorage.removeItem('bp_avatar_custom'); myAvatarCustom = ''; } catch (_) {}
    try { myAvatarId = 'init'; localStorage.setItem('bp_avatar', 'init'); } catch (_) {}
    // Always end guest mode flag so polls stop treating us as guest
    try {
      localStorage.removeItem('bp_guest_ok');
      if (typeof persistGuestOk === 'function') persistGuestOk(false);
      else {
        try { document.cookie = 'bp_guest_ok=; Max-Age=0; path=/; SameSite=Lax'; } catch (_2) {}
      }
    } catch (_) {}
    // Clear friend code only when not mid-login (blank code → alive:false → false "Аккаунт удалён")
    if (!opts.keepFriendCode) {
      try {
        myFriendCode = '';
        localStorage.removeItem('bp_my_code');
      } catch (_) {}
      try {
        myNickname = 'Гость';
        localStorage.setItem('bp_nickname', 'Гость');
      } catch (_) {}
    }
    try { localStorage.removeItem('bp_guest_shop_warned'); } catch (_) {}
    try { sessionStorage.removeItem('bp_guest_shop_warned'); } catch (_) {}
    // Ranked score record, classic board saves (account / guest / legacy keys),
    // pending friend requests and rejoin tokens belong to the identity being discarded.
    try { rankedBest = 0; localStorage.setItem('bp_ranked_best', '0'); } catch (_) {}
    try { clearAllLocalClassicSaves(); } catch (_) {}
    try { localStorage.removeItem('bp_fr_out'); } catch (_) {}
    try { if (typeof frOutgoingPending !== 'undefined') frOutgoingPending = []; } catch (_) {}
    try {
      ['bp_match_id', 'bp_match_token', 'bp_match_seat'].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (_) {}
        try { sessionStorage.removeItem(k); } catch (_) {}
      });
    } catch (_) {}
  } catch (_) {}
}

/** Remove EVERY locally cached classic board (per-account, per-guest-code, legacy). */
function clearAllLocalClassicSaves() {
  try {
    const dead = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('bp_classic_save') === 0) dead.push(k);
    }
    dead.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
  } catch (_) {}
}

async function finishAuthSuccess(account, mode) {
  try { window._bpAuthTransition = true; } catch (_) {}
  // If registering after browser wipe: restore IP guest progress into local state first
  // so snapshotGuestProgress() / migration carries diamonds, skins, etc.
  if (mode === 'register') {
    try {
      if (_ipGuestProgress) applyGuestProgressSnapshot(_ipGuestProgress);
      else if (account && account._guestProgress) applyGuestProgressSnapshot(account._guestProgress);
    } catch (_) {}
  }
  const loadTitle = mode === 'register' ? 'Создаём аккаунт…' : 'Входим в аккаунт…';
  const loadSub = mode === 'register' ? 'Аккаунт создан, загружаем данные…' : 'Загрузка данных с сервера…';
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  // Loading MUST be above entry-gate (z-index fixed in showAuthLoading)
  showAuthLoading(loadTitle, loadSub);
  // Let the overlay paint before heavy work / closing the gate
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    // Prefer server-side guest progress for migration (survives browser wipe)
    let guestSnap = null;
    let hadLocalGuest = false;
    try { hadLocalGuest = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
    try {
      if (mode === 'register') {
        const merged = collectGuestProgressForRegister();
        if (merged) guestSnap = merged;
        else if (_ipGuestProgress) guestSnap = _ipGuestProgress;
      } else if (hadLocalGuest) {
        guestSnap = snapshotGuestProgress();
      }
    } catch (_) {}
    if (mode === 'login') {
      // Strip leftover locals FIRST (previous guest / previous account), THEN load the account.
      // The old order (apply → discard) zeroed the freshly loaded account in memory and the
      // full PATCH below then overwrote friends / history / achievements / bot stars on the
      // server with empty data. Never discard after applyServerAccount.
      try { window._bpAccountLoaded = false; } catch (_) {}
      discardGuestProgressFully({ keepFriendCode: true });
      applyServerAccount(account);
    } else {
      applyServerAccount(account);
    }
    if (mode === 'register') {
      // Prefer guest friend code if server kept it (or if account has it)
      try {
        const gCode = guestSnap && guestSnap.friendCode
          ? String(guestSnap.friendCode).toUpperCase()
          : '';
        const aCode = account && account.friendCode
          ? String(account.friendCode).toUpperCase()
          : '';
        if (gCode && aCode && gCode === aCode) {
          myFriendCode = gCode;
          localStorage.setItem('bp_my_code', gCode);
        } else if (aCode) {
          myFriendCode = aCode;
          localStorage.setItem('bp_my_code', aCode);
        }
      } catch (_) {}
      // Server account (converted guest) is the sole source of truth after register.
      // Never Math.max with fresh-client starter 9999 after browser wipe.
      try {
        {
          // Server account is the converted guest — copy 1:1, do not Math.max with local defaults
          if (account && typeof account.trophies === 'number') {
            trophies = Math.max(0, account.trophies | 0);
          } else if (guestSnap && typeof guestSnap.trophies === 'number') {
            trophies = Math.max(0, guestSnap.trophies | 0);
          }

          if (account && typeof account.diamonds === 'number') {
            diamonds = Math.max(0, account.diamonds | 0);
          } else if (guestSnap && typeof guestSnap.diamonds === 'number') {
            diamonds = Math.max(0, guestSnap.diamonds | 0);
          }
          // If active guest had higher live balance not yet synced, raise server once via PATCH below
          if (hadLocalGuest) {
            try {
              let liveD = typeof diamonds === 'number' ? (diamonds | 0) : 0;
              const lsD = parseInt(localStorage.getItem('bp_diamonds') || '0', 10);
              if (isFinite(lsD)) liveD = Math.max(liveD, lsD | 0);
              // Only raise if live is from real session and server is lower (sync lag)
              if (liveD > (diamonds | 0) && liveD !== 9999) {
                diamonds = liveD;
              }
            } catch (_) {}
          }

          if (account && typeof account.best === 'number') {
            best = Math.max(0, account.best | 0);
          } else if (guestSnap && typeof guestSnap.best === 'number') {
            best = Math.max(0, guestSnap.best | 0);
          }
        }

        // Cosmetics inventory — account (converted guest) first, then guest snap gaps
        {
          const free = (typeof FREE_SKIN_IDS !== 'undefined' && Array.isArray(FREE_SKIN_IDS))
            ? FREE_SKIN_IDS : ['default'];
          const fromAcc = (account && Array.isArray(account.ownedSkins) && account.ownedSkins.length)
            ? account.ownedSkins : [];
          const fromGuest = (guestSnap && guestSnap.ownedSkins && guestSnap.ownedSkins.length)
            ? guestSnap.ownedSkins : [];
          ownedSkins = Array.from(new Set([
            ...fromAcc.map(String),
            ...fromGuest.map(String),
            ...free.map(String)
          ].filter(Boolean)));
        }
        {
          const freeB = (typeof FREE_BOARD_IDS !== 'undefined' && Array.isArray(FREE_BOARD_IDS))
            ? FREE_BOARD_IDS : ['field_default'];
          const fromAcc = (account && Array.isArray(account.ownedBoards) && account.ownedBoards.length)
            ? account.ownedBoards : [];
          const fromGuest = (guestSnap && guestSnap.ownedBoards && guestSnap.ownedBoards.length)
            ? guestSnap.ownedBoards : [];
          ownedBoards = Array.from(new Set([
            ...fromAcc.map(String),
            ...fromGuest.map(String),
            ...freeB.map(String)
          ].filter(Boolean)));
        }
        if (account && account.skinId) equippedSkinId = account.skinId;
        else if (guestSnap && guestSnap.skinId) equippedSkinId = guestSnap.skinId;
        if (account && account.boardId) equippedBoardId = account.boardId;
        else if (guestSnap && guestSnap.boardId) equippedBoardId = guestSnap.boardId;

        // Profile cosmetics
        if (guestSnap.avatarId) {
          myAvatarId = guestSnap.avatarId;
          try { localStorage.setItem('bp_avatar', myAvatarId); } catch (_) {}
        }
        if (guestSnap.avatarCustom) {
          myAvatarCustom = guestSnap.avatarCustom;
          try { localStorage.setItem('bp_avatar_custom', myAvatarCustom); } catch (_) {}
        } else if (guestSnap.avatarCustom === '') {
          myAvatarCustom = '';
          try { localStorage.removeItem('bp_avatar_custom'); } catch (_) {}
        }
        if (typeof guestSnap.status === 'string' && guestSnap.status) {
          myStatus = guestSnap.status;
          try { localStorage.setItem('bp_status', myStatus); } catch (_) {}
        }

        // Nick: ALWAYS from registration account (form nick || login). Never keep PlayerABC.
        try {
          const regNick = (account && (account.nick || account.login))
            ? String(account.nick || account.login).slice(0, 24)
            : '';
          if (regNick) {
            myNickname = regNick;
            localStorage.setItem('bp_nickname', myNickname);
          }
          // Reflect in profile «Имя и статус» inputs
          try {
            const nickIn = document.getElementById('profileNickInput');
            if (nickIn) nickIn.value = myNickname || '';
            if (typeof profileDraft === 'object' && profileDraft) profileDraft.nick = myNickname || '';
          } catch (_) {}
        } catch (_) {}

        // Social / history / achievements — full guest carry-over
        if (guestSnap.friends && guestSnap.friends.length) {
          try { mergeFriendsFromServer(guestSnap.friends); } catch (_) {}
        }
        if (guestSnap.history && guestSnap.history.length) {
          try { mergeHistoryFromServer(guestSnap.history); } catch (_) {}
        }
        if (guestSnap.achievements && typeof guestSnap.achievements === 'object') {
          try {
            const merged = Object.assign({}, guestSnap.achievements);
            for (const k of Object.keys(guestSnap.achievements)) {
              const g = guestSnap.achievements[k];
              if (typeof g === 'number') merged[k] = g;
              else if (g) merged[k] = g;
            }
            achProgress = merged;
            localStorage.setItem('bp_ach', JSON.stringify(achProgress));
          } catch (_) {}
        }
        if (guestSnap.botStars && typeof guestSnap.botStars === 'object') {
          try {
            if (typeof botStars !== 'object' || !botStars) botStars = {};
            const incoming = guestSnap.botStars;
            for (const id of Object.keys(incoming)) {
              if (!id) continue;
              const st = incoming[id];
              if (!st || typeof st !== 'object') continue;
              if (!botStars[id]) botStars[id] = {};
              if (st['60']) botStars[id]['60'] = true;
              if (st['120']) botStars[id]['120'] = true;
              if (st['180']) botStars[id]['180'] = true;
            }
            if (typeof saveBotStars === 'function') saveBotStars();
            else try { localStorage.setItem('bp_bot_stars', JSON.stringify(botStars)); } catch (_) {}
          } catch (_) {}
        }

        // Persist local mirror
        try { localStorage.setItem('bp_trophies', String(trophies)); } catch (_) {}
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
        try { localStorage.setItem('bp_best', String(best)); } catch (_) {}
        try { localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins)); } catch (_) {}
        try { localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards)); } catch (_) {}
        try {
          if (equippedSkinId) {
            localStorage.setItem('bp_skin_equipped', equippedSkinId);
            localStorage.setItem('bp_skin', equippedSkinId);
          }
          if (equippedBoardId) {
            localStorage.setItem('bp_board_equipped', equippedBoardId);
            localStorage.setItem('bp_board', equippedBoardId);
          }
        } catch (_) {}
        try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
        try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
      } catch (_) {}
    }
    try { persistGuestOk(true); } catch (_) {}
    // Device is now bound to a real account — guest option locked until account delete
    markDeviceHadBoundAccount();
    // Keep loading visible while gate closes under it
    try { hideEntryGate(); } catch (_) {}
    showAuthLoading(
      mode === 'register' ? 'Загрузка аккаунта…' : 'Загрузка аккаунта…',
      'Синхронизация прогресса с сервером'
    );
    // Persist full progress to account
    try {
      await syncProfileToServer({
        friends: (friends || []).slice(0, 200),
        history: (typeof matchHistory !== 'undefined' && Array.isArray(matchHistory)) ? matchHistory.slice(0, 30) : [],
        achievements: (typeof achProgress === 'object' && achProgress) ? achProgress : {},
        botStars: (typeof botStars === 'object' && botStars) ? botStars : {},
        trophies: trophies | 0,
        diamonds: diamonds | 0,
        best: best | 0,
        ownedSkins: ownedSkins || [],
        ownedBoards: ownedBoards || [],
        skinId: typeof equippedSkinId !== 'undefined' ? equippedSkinId : undefined,
        boardId: typeof equippedBoardId !== 'undefined' ? equippedBoardId : undefined,
        nick: myNickname,
        status: myStatus,
        avatarId: myAvatarId,
        avatarCustom: myAvatarCustom
      });
    } catch (_) {}
    try {
      _presenceCustomSent = false;
      window._bpCosmeticsHintSent = undefined;
      window._bpAvatarCustomSynced = false;
      if (typeof ensureFriendPresence === 'function') ensureFriendPresence(true);
    } catch (_) {}
    try {
      if (typeof MatchClient !== 'undefined' && MatchClient.cosmeticsGet) MatchClient.cosmeticsGet();
    } catch (_) {}
    // After cosmetics_state may arrive async — pin diamonds to account (migrated guest)
    if (account && typeof account.diamonds === 'number') {
      // Strict: account row is the source of truth after login/register
      const pinD = Math.max(0, account.diamonds | 0);
      diamonds = pinD;
      try { localStorage.setItem('bp_diamonds', String(pinD)); } catch (_) {}
      try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
      const rePin = function () {
        try {
          if (account && typeof account.diamonds === 'number') {
            const d = Math.max(0, account.diamonds | 0);
            diamonds = d;
            localStorage.setItem('bp_diamonds', String(d));
            if (typeof updateMenuStats === 'function') updateMenuStats();
          }
        } catch (_) {}
      };
      setTimeout(rePin, 400);
      setTimeout(rePin, 1200);
    }
    try {
      // Keep profile form fields in sync (Имя и статус)
      const nickIn = document.getElementById('profileNickInput');
      if (nickIn) nickIn.value = myNickname || '';
      const stIn = document.getElementById('profileStatusInput');
      if (stIn) stIn.value = myStatus || '';
      if (typeof profileDraft === 'object' && profileDraft) {
        profileDraft.nick = myNickname || '';
        profileDraft.status = myStatus || '';
        profileDraft.avatarId = myAvatarId;
        profileDraft.custom = myAvatarCustom;
      }
    } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof updateAccountUI === 'function') updateAccountUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    try { if (typeof renderShop === 'function') renderShop(); } catch (_) {}
    try { if (typeof updateAchievementsButton === 'function') updateAchievementsButton(); } catch (_) {}
    // Minimum visible loading time so registration never feels instant
    const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
    const minMs = mode === 'register' ? 1400 : 1100;
    if (elapsed < minMs) {
      await new Promise((r) => setTimeout(r, minMs - elapsed));
    }
  } finally {
    hideAuthLoading();
    // Keep transition flag longer so in-flight alive/WS events cannot flash delete UX
    setTimeout(function () {
      try { window._bpAuthTransition = false; } catch (_) {}
    }, 8000);
  }
  try {
    if (typeof showInfoToast === 'function') {
      showInfoToast('Аккаунт', mode === 'register' ? 'Регистрация успешна' : 'Вход выполнен', 'ok');
    }
  } catch (_) {}
}

/** When true, entry gate shows × to dismiss (guest already active — just cancel login/register). */
let entryGateDismissible = false;
/** When true, «Играть гостем» is allowed (ONLY first visit). Never from profile. */
let entryGateShowGuest = false;

/** Device once registered/logged in — no more guest accounts until account delete. */
function deviceHadBoundAccount() {
  try { return localStorage.getItem('bp_device_had_account') === '1'; } catch (_) { return false; }
}
function markDeviceHadBoundAccount() {
  try { localStorage.setItem('bp_device_had_account', '1'); } catch (_) {}
}
function clearDeviceHadBoundAccount() {
  try { localStorage.removeItem('bp_device_had_account'); } catch (_) {}
}
/** Server device binding state (survives browser wipe; not bypassable via VPN). */
let _ipGuestBlocked = false;      // cannot CREATE a new guest
let _ipCanResumeGuest = false;    // can CONTINUE previous device guest
let _ipGuestProgress = null;      // snapshot from server
let _ipHasRealAccount = false;
function ipBlocksGuest() {
  return !!_ipGuestBlocked;
}
function ipCanResumeGuest() {
  return !!_ipCanResumeGuest;
}
function getIpGuestProgress() {
  return _ipGuestProgress;
}
/**
 * Ask server whether guest is allowed / resumable for this device id.
 */
async function refreshGuestAllowedFromServer() {
  try {
    try {
      const did = getDeviceId();
      if (typeof persistDeviceId === 'function') persistDeviceId(did);
    } catch (_) {}
    const { ok, data } = await apiFetch('/api/auth/guest-allowed');
    if (ok && data) {
      if (data.deviceId && typeof persistDeviceId === 'function') {
        try { persistDeviceId(String(data.deviceId)); } catch (_) {}
      }
      // Real registered account only — never treat "bound" guest mark as registered
      const hasReal = !!(data.hasAccount);
      _ipHasRealAccount = hasReal;
      // Server canResume is authoritative for guest continue
      _ipCanResumeGuest = !hasReal && !!(data.canResumeGuest);
      _ipGuestProgress = (_ipCanResumeGuest && data.guestProgress) ? data.guestProgress : null;

      if (hasReal) {
        _ipGuestBlocked = true;
        _ipCanResumeGuest = false;
        _ipGuestProgress = null;
        markDeviceHadBoundAccount();
        try { persistGuestOk(false); } catch (_) {}
        return false;
      }

      try { clearDeviceHadBoundAccount(); } catch (_) {}

      // Persist guest session flag when server says we can resume
      if (_ipCanResumeGuest) {
        try { persistGuestOk(true); } catch (_) {}
      }

      // guestAllowed=false only blocks NEW guest create, not resume
      if (data.guestAllowed === false && !_ipCanResumeGuest) {
        _ipGuestBlocked = true;
        return false;
      }
      _ipGuestBlocked = false;
      return true;
    }
  } catch (_) {}
  // Network fail: keep local guest session if present
  try {
    if (localStorage.getItem('bp_guest_ok') === '1' || readGuestOkCookie()) {
      _ipCanResumeGuest = true;
      return true;
    }
  } catch (_) {}
  return !deviceHadBoundAccount();
}
/** Apply server-stored guest progress into local state (after browser wipe resume). */
function applyGuestProgressSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return;
  try {
    if (typeof snap.trophies === 'number') {
      trophies = Math.max(0, snap.trophies | 0);
      localStorage.setItem('bp_trophies', String(trophies));
    }
    if (typeof snap.diamonds === 'number') {
      diamonds = Math.max(0, snap.diamonds | 0);
      localStorage.setItem('bp_diamonds', String(diamonds));
    }
    if (typeof snap.best === 'number') {
      best = Math.max(0, snap.best | 0);
      localStorage.setItem('bp_best', String(best));
    }
    if (Array.isArray(snap.ownedSkins) && snap.ownedSkins.length) {
      ownedSkins = snap.ownedSkins.slice();
      try { localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins)); } catch (_) {}
    }
    if (Array.isArray(snap.ownedBoards) && snap.ownedBoards.length) {
      ownedBoards = snap.ownedBoards.slice();
      try { localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards)); } catch (_) {}
    }
    if (snap.skinId) {
      equippedSkinId = snap.skinId;
      try {
        localStorage.setItem('bp_skin_equipped', snap.skinId);
        localStorage.setItem('bp_skin', snap.skinId);
      } catch (_) {}
    }
    if (snap.boardId) {
      equippedBoardId = snap.boardId;
      try {
        localStorage.setItem('bp_board_equipped', snap.boardId);
        localStorage.setItem('bp_board', snap.boardId);
      } catch (_) {}
    }
    if (typeof snap.nick === 'string' && snap.nick) {
      myNickname = snap.nick;
      try { localStorage.setItem('bp_nickname', snap.nick); } catch (_) {}
    }
    if (typeof snap.status === 'string') {
      myStatus = snap.status;
      try { localStorage.setItem('bp_status', snap.status); } catch (_) {}
    }
    if (typeof snap.avatarId === 'string') {
      myAvatarId = snap.avatarId;
      try { localStorage.setItem('bp_avatar_id', snap.avatarId); } catch (_) {}
    }
    if (typeof snap.avatarCustom === 'string') {
      myAvatarCustom = snap.avatarCustom;
      try { localStorage.setItem('bp_avatar_custom', snap.avatarCustom); } catch (_) {}
    }
    if (snap.friendCode) {
      myFriendCode = String(snap.friendCode).toUpperCase();
      try { localStorage.setItem('bp_my_code', myFriendCode); } catch (_) {}
    }
    if (Array.isArray(snap.friends)) {
      try { mergeFriendsFromServer(snap.friends); } catch (_) {
        friends = snap.friends.slice();
        try { localStorage.setItem('bp_friends', JSON.stringify(friends)); } catch (_) {}
      }
    }
    if (Array.isArray(snap.history)) {
      try { mergeHistoryFromServer(snap.history); } catch (_) {
        matchHistory = snap.history.slice();
        try { localStorage.setItem('bp_history', JSON.stringify(matchHistory)); } catch (_) {}
      }
    }
    if (snap.achievements && typeof snap.achievements === 'object') {
      try {
        achProgress = Object.assign({}, snap.achievements);
        localStorage.setItem('bp_ach', JSON.stringify(achProgress));
      } catch (_) {}
    }
    if (snap.botStars && typeof snap.botStars === 'object') {
      try {
        if (typeof botStars !== 'object' || !botStars) botStars = {};
        const incoming = snap.botStars;
        for (const id of Object.keys(incoming)) {
          if (!id) continue;
          const st = incoming[id];
          if (!st || typeof st !== 'object') continue;
          if (!botStars[id]) botStars[id] = {};
          if (st['60']) botStars[id]['60'] = true;
          if (st['120']) botStars[id]['120'] = true;
          if (st['180']) botStars[id]['180'] = true;
        }
        if (typeof saveBotStars === 'function') saveBotStars();
        else try { localStorage.setItem('bp_bot_stars', JSON.stringify(botStars)); } catch (_) {}
        try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
      } catch (_) {}
    }
    if (snap.classicSave && typeof snap.classicSave === 'object' && Array.isArray(snap.classicSave.grid)) {
      try {
        localStorage.setItem(typeof classicSaveStorageKey === 'function' ? classicSaveStorageKey() : 'bp_classic_save', JSON.stringify(snap.classicSave));
      } catch (_) {}
    }
    try {
      if (typeof renderShopGrid === 'function') renderShopGrid();
      if (typeof renderInvGrid === 'function') renderInvGrid();
      if (typeof renderShop === 'function') renderShop();
      if (typeof updateMenuStats === 'function') updateMenuStats();
    } catch (_) {}
  } catch (_) {}
}
/** Push current local guest progress to server (IP-bound). */
let _guestSyncInFlight = false;
let _guestSyncTimer = null;
let _guestSyncLastAt = 0;

function buildGuestProgressPayload(full) {
  const progress = snapshotGuestProgress();
  try {
    if (typeof myFriendCode === 'string' && myFriendCode) progress.friendCode = myFriendCode;
  } catch (_) {}
  // Skip heavy fields on frequent sync to avoid body limits / lag
  if (!full) {
    try { delete progress.avatarCustom; } catch (_) {}
    try { delete progress.history; } catch (_) {}
  }
  return progress;
}

async function syncGuestProgressToServer(opts) {
  opts = opts || {};
  if (authToken) return false;
  try {
    if (window._bpGuestSyncBlocked || window._bpAccountDeleted) return false;
  } catch (_) {}
  try {
    if (localStorage.getItem('bp_guest_ok') !== '1') return false;
  } catch (_) { return false; }
  if (_guestSyncInFlight && !opts.force) return false;
  const now = Date.now();
  if (!opts.force && now - _guestSyncLastAt < 2000) return false;
  _guestSyncInFlight = true;
  try {
    const progress = buildGuestProgressPayload(!!opts.full);
    const result = await apiFetch('/api/auth/guest-sync', {
      method: 'POST',
      body: { progress }
    });
    _guestSyncLastAt = Date.now();
    if (result && result.ok) {
      _ipCanResumeGuest = true;
      if (result.data && result.data.guestProgress) {
        _ipGuestProgress = result.data.guestProgress;
      }
      return true;
    }
    // Deleted guest identity — clear quietly (no "Аккаунт удалён" flash on boot)
    if (result && (result.status === 410 || (result.data && (result.data.error === 'account_deleted' || result.data.accountDeleted)))) {
      try { softClearDeadGuest('guest_sync_410'); } catch (_) {}
      return false;
    }
    // If not bound yet, claim guest slot with progress
    if (result && (result.status === 403 || result.status === 400)) {
      try {
        await apiFetch('/api/auth/guest-bind', { method: 'POST', body: { progress } });
        _guestSyncLastAt = Date.now();
        return true;
      } catch (_) {}
    }
    return false;
  } catch (_) {
    return false;
  } finally {
    _guestSyncInFlight = false;
  }
}

/** Fire-and-forget sync when tab closes (best-effort). */
function syncGuestProgressBeacon() {
  try {
    if (authToken) return;
    if (localStorage.getItem('bp_guest_ok') !== '1') return;
    const progress = buildGuestProgressPayload(true);
    const url = apiBase() + '/api/auth/guest-sync';
    const body = JSON.stringify({ progress });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    // keepalive fetch fallback
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      });
    } catch (_) {}
  } catch (_) {}
}

function scheduleGuestProgressSync() {
  try {
    if (_guestSyncTimer) return;
    _guestSyncTimer = setInterval(function () {
      try {
        if (authToken) return;
        if (window._bpGuestSyncBlocked || window._bpAccountDeleted) return;
        if (localStorage.getItem('bp_guest_ok') !== '1') return;
        syncGuestProgressToServer({ full: false }).catch(function () {});
      } catch (_) {}
    }, 15000);
    // Page hide / background
    if (!window._bpGuestSyncVisBound) {
      window._bpGuestSyncVisBound = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          syncGuestProgressBeacon();
          syncGuestProgressToServer({ force: true, full: true }).catch(function () {});
        }
      });
      window.addEventListener('pagehide', function () {
        syncGuestProgressBeacon();
      });
      window.addEventListener('beforeunload', function () {
        syncGuestProgressBeacon();
      });
    }
  } catch (_) {}
}
try { window.syncGuestProgressToServer = syncGuestProgressToServer; } catch (_) {}
try { window.scheduleGuestProgressSync = scheduleGuestProgressSync; } catch (_) {}
/**
 * «Играть гостем» only when:
 * - not logged in, AND
 * - not already a guest, AND
 * - device never had a real account (local), AND
 * - this IP is not bound on the server
 */
function hasLocalGuestSession() {
  try { if (window._bpAccountDeleted || window._bpGuestSyncBlocked) return false; } catch (_) {}
  try { if (localStorage.getItem('bp_guest_ok') === '1') return true; } catch (_) {}
  try { if (readGuestOkCookie()) return true; } catch (_) {}
  return false;
}

/** True when the player is currently in guest mode (not logged into a registered account). */
function isPlayingAsGuest() {
  try { if (authToken) return false; } catch (_) {}
  try { if (authAccount) return false; } catch (_) {}
  return hasLocalGuestSession() || !!(_ipCanResumeGuest && _ipGuestProgress);
}

/**
 * Warn before login from guest: guest progress will be wiped.
 * @returns {Promise<'register'|'continue'|'cancel'>}
 */
function confirmGuestLoginWipe() {
  return new Promise(function (resolve) {
    const modal = document.getElementById('guestLoginWarnModal');
    if (!modal) {
      // Fallback: binary confirm
      const ok = window.confirm(
        'Прогресс гостя будет безвозвратно удалён. Рекомендуем зарегистрироваться.\n\nOK — войти и удалить гостя\nОтмена — остаться'
      );
      resolve(ok ? 'continue' : 'cancel');
      return;
    }
    const regBtn = document.getElementById('guestLoginWarnRegister');
    const skipBtn = document.getElementById('guestLoginWarnSkip');
    const cancelBtn = document.getElementById('guestLoginWarnCancel');
    const backdrop = document.getElementById('guestLoginWarnBackdrop');

    function cleanup(result) {
      modal.classList.remove('visible');
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      if (regBtn) regBtn.onclick = null;
      if (skipBtn) skipBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (backdrop) backdrop.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') cleanup('cancel');
    }
    if (regBtn) regBtn.onclick = function () { cleanup('register'); };
    if (skipBtn) skipBtn.onclick = function () { cleanup('continue'); };
    if (cancelBtn) cancelBtn.onclick = function () { cleanup('cancel'); };
    if (backdrop) backdrop.onclick = function () { cleanup('cancel'); };
    document.addEventListener('keydown', onKey);
    // Above entry-gate (z-index 100000) and auth form
    try { document.body.appendChild(modal); } catch (_) {}
    modal.hidden = false;
    modal.style.display = 'flex';
    modal.style.zIndex = '100060';
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    try { setTimeout(function () { if (regBtn) regBtn.focus(); }, 40); } catch (_) {}
  });
}

/** Current guest friend code to purge on login (if any). */
function getActiveGuestFriendCode() {
  try {
    if (typeof myFriendCode === 'string' && myFriendCode) {
      return String(myFriendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    }
  } catch (_) {}
  try {
    const c = localStorage.getItem('bp_my_code');
    if (c) return String(c).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  } catch (_) {}
  try {
    if (_ipGuestProgress && _ipGuestProgress.friendCode) {
      return String(_ipGuestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    }
  } catch (_) {}
  return '';
}

try { window.confirmGuestLoginWipe = confirmGuestLoginWipe; } catch (_) {}
try { window.isPlayingAsGuest = isPlayingAsGuest; } catch (_) {}
function shouldAllowGuestButton() {
  try { if (authToken) return false; } catch (_) {}
  // Absolute rule: any real account bound to this IP → never offer guest
  if (_ipHasRealAccount) return false;
  if (deviceHadBoundAccount()) return false;
  if (ipBlocksGuest()) return false;
  try { if (localStorage.getItem('bp_guest_ok') === '1') return false; } catch (_) {}
  return true;
}



function openAuthModal(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  // Guest (or not logged in): use entry gate; allow closing without recreating guest
  const isLoggedIn = !!(authToken && authAccount);
  if (!isLoggedIn) {
    try { closeAuthModal(); } catch (_) {}
    let guestOk = false;
    try { guestOk = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
    // From profile login/register: NEVER show guest buttons
    entryGateDismissible = true;
    entryGateShowGuest = false;
    try { showEntryGate({ dismissible: true, showGuest: false }); } catch (_) {}
    try { entryGateSetMode(authMode); } catch (_) {}
    try {
      const gb = document.getElementById('entryGateGuestBlock');
      if (gb) {
        gb.hidden = true;
        gb.setAttribute('hidden', '');
        gb.style.setProperty('display', 'none', 'important');
      }
      const warn = document.getElementById('entryGateGuestWarn');
      if (warn) {
        warn.hidden = true;
        warn.setAttribute('hidden', '');
        warn.style.setProperty('display', 'none', 'important');
      }
    } catch (_) {}
    try {
      setTimeout(() => document.getElementById('entryAuthLogin')?.focus(), 40);
    } catch (_) {}
    return;
  }
  // Logged in: secondary modal (rare path)
  const modal = document.getElementById('authModal');
  const nickField = document.getElementById('authNickField');
  const passConfirmField = document.getElementById('authPasswordConfirmField');
  const title = document.getElementById('authModalTitle');
  const submit = document.getElementById('authSubmit');
  const err = document.getElementById('authError');
  document.querySelectorAll('#authModal .auth-tab').forEach((tab) => {
    tab.classList.toggle('on', tab.getAttribute('data-auth-tab') === authMode);
  });
  if (nickField) nickField.hidden = authMode !== 'register';
  if (passConfirmField) passConfirmField.hidden = authMode !== 'register';
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


/** Build guestProgress + preferredFriendCode for /api/auth/register (1:1 migrate). */
async function prepareRegisterGuestPayload() {
  // 1) Force-save current guest state to server (IP + DB)
  try { await refreshGuestAllowedFromServer(); } catch (_) {}
  try { await syncGuestProgressToServer({ force: true, full: true }); } catch (_) {}
  // 2) Snapshot live client state (active guest session)
  let hasLocalGuest = false;
  try { hasLocalGuest = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
  let gp = null;
  try { gp = collectGuestProgressForRegister(); } catch (_) { gp = null; }
  // 3) Active guest: always prefer live snapshot over empty IP
  if (hasLocalGuest) {
    const live = snapshotGuestProgress() || {};
    try {
      if (typeof myFriendCode === 'string' && myFriendCode) live.friendCode = myFriendCode;
      else {
        const ls = localStorage.getItem('bp_my_code');
        if (ls) live.friendCode = String(ls).toUpperCase();
      }
    } catch (_) {}
    try {
      live.diamonds = Math.max(0, (typeof diamonds === 'number' ? diamonds : 0) | 0);
    } catch (_) {}
    if (gp) {
      gp = Object.assign({}, gp, live);
      // Currencies: take max so we never drop live balance
      gp.diamonds = Math.max(
        typeof gp.diamonds === 'number' ? gp.diamonds : 0,
        typeof live.diamonds === 'number' ? live.diamonds : 0
      );
      gp.trophies = Math.max(
        typeof gp.trophies === 'number' ? gp.trophies : 0,
        typeof live.trophies === 'number' ? live.trophies : 0
      );
      gp.best = Math.max(
        typeof gp.best === 'number' ? gp.best : 0,
        typeof live.best === 'number' ? live.best : 0
      );
    } else {
      gp = live;
    }
    _ipGuestProgress = gp;
  } else if (!gp && _ipGuestProgress) {
    gp = _ipGuestProgress;
  }
  try { ensureMyFriendCode(); } catch (_) {}
  const fc = (gp && gp.friendCode)
    || (_ipGuestProgress && _ipGuestProgress.friendCode)
    || (typeof myFriendCode === 'string' ? myFriendCode : '')
    || (function () { try { return localStorage.getItem('bp_my_code') || ''; } catch (_) { return ''; } })();
  const preferredFriendCode = fc
    ? String(fc).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    : '';
  if (gp && preferredFriendCode) gp.friendCode = preferredFriendCode;
  if (preferredFriendCode) {
    try {
      myFriendCode = preferredFriendCode;
      localStorage.setItem('bp_my_code', preferredFriendCode);
    } catch (_) {}
  }
  return { guestProgress: gp, preferredFriendCode: preferredFriendCode || undefined };
}

async function submitAuthForm(e) {
  if (e) e.preventDefault();
  const login = (document.getElementById('authLogin')?.value || '').trim();
  const password = document.getElementById('authPassword')?.value || '';
  const nick = (document.getElementById('authNick')?.value || '').trim();
  const passwordConfirm = (document.getElementById('authPasswordConfirm')?.value || '');
  const err = document.getElementById('authError');
  const submit = document.getElementById('authSubmit');
  if (err) { err.hidden = true; err.textContent = ''; }
  if (authMode === 'register') {
    if (password.length < 6) {
      if (err) { err.textContent = 'Пароль: минимум 6 символов'; err.hidden = false; }
      return;
    }
    if (password !== passwordConfirm) {
      if (err) { err.textContent = 'Пароли не совпадают'; err.hidden = false; }
      return;
    }
  }
  // Capture guest state BEFORE any auth (must not change until user confirms wipe)
  const wasGuestOnLogin = (authMode === 'login' && isPlayingAsGuest());
  const guestCodePending = wasGuestOnLogin ? getActiveGuestFriendCode() : '';
  if (submit) submit.disabled = true;
  showAuthLoading(
    authMode === 'register' ? 'Создаём аккаунт…' : 'Входим в аккаунт…',
    authMode === 'register' ? 'Регистрация на сервере…' : 'Проверка данных…'
  );
  try {
    // ── Guest login: check credentials ONLY (no session / no wipe) ──
    if (authMode === 'login' && wasGuestOnLogin) {
      const check = await apiFetch('/api/auth/check-login', {
        method: 'POST',
        body: { login, password }
      });
      if (!check.ok || !check.data || !check.data.ok) {
        hideAuthLoading();
        let msg = (check.data && (check.data.message || check.data.error)) || null;
        if (!msg) {
          if (check.networkError || check.status === 0) msg = 'Нет связи с сервером';
          else if (check.status === 401) msg = 'Неверный логин или пароль';
          else msg = 'Ошибка (код ' + check.status + ')';
        }
        if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
        if (err) { err.textContent = msg; err.hidden = false; }
        return;
      }
      // Account exists — show warning. Server state is UNCHANGED (no session, no wipe).
      hideAuthLoading();
      const decision = await confirmGuestLoginWipe();
      if (decision === 'cancel') return;
      if (decision === 'register') {
        try {
          if (typeof openAuthModal === 'function') openAuthModal('register');
          else if (typeof entryGateSetMode === 'function') entryGateSetMode('register');
        } catch (_) {}
        return;
      }
      // ONLY after "Понятно, войти": real login + wipe guest
      try { window._bpAuthTransition = true; } catch (_) {}
      try {
        localStorage.removeItem('bp_guest_ok');
        if (typeof persistGuestOk === 'function') persistGuestOk(false);
        else { try { document.cookie = 'bp_guest_ok=; Max-Age=0; path=/; SameSite=Lax'; } catch (_2) {} }
      } catch (_) {}
      showAuthLoading('Входим в аккаунт…', 'Удаляем гостевой прогресс…');
      const loginBody = {
        login,
        password,
        wipeGuest: true,
        guestFriendCode: guestCodePending || undefined
      };
      const { ok, data, status, networkError } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: loginBody
      });
      if (!ok || !data || !data.ok) {
        hideAuthLoading();
        try { window._bpAuthTransition = false; } catch (_) {}
        let msg = (data && (data.message || data.error)) || 'Не удалось войти';
        if (networkError || status === 0) msg = 'Нет связи с сервером';
        if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
        if (err) { err.textContent = msg; err.hidden = false; }
        return;
      }
      authToken = data.token;
      try { persistAuthToken(authToken); } catch (_) {}
      try {
        if (data.account && data.account.friendCode) {
          myFriendCode = String(data.account.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
          localStorage.setItem('bp_my_code', myFriendCode);
        }
      } catch (_) {}
      try {
        if (guestCodePending) {
          await apiFetch('/api/auth/wipe-guest', {
            method: 'POST',
            body: { guestFriendCode: guestCodePending }
          });
        }
      } catch (_) {}
      closeAuthModal();
      await finishAuthSuccess(data.account, 'login');
      return;
    }

    // ── Register or non-guest login ──
    const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = { login, password };
    if (authMode === 'register' && nick) body.nick = nick;
    if (authMode === 'register') {
      try {
        const prep = await prepareRegisterGuestPayload();
        if (prep.guestProgress) {
          body.guestProgress = prep.guestProgress;
          try { applyGuestProgressSnapshot(prep.guestProgress); } catch (_) {}
          _ipGuestProgress = prep.guestProgress;
        }
        if (prep.preferredFriendCode) body.preferredFriendCode = prep.preferredFriendCode;
      } catch (_) {}
    }
    if (authMode === 'login') {
      try { window._bpAuthTransition = true; } catch (_) {}
    }
    const { ok, data, status, networkError, contentType } = await apiFetch(path, { method: 'POST', body });
    if (!ok || !data || !data.ok) {
      hideAuthLoading();
      try { window._bpAuthTransition = false; } catch (_) {}
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
      if (msg === 'accounts_unavailable') msg = 'Сервис аккаунтов недоступен';
      if (msg === 'server_error') msg = 'Ошибка сервера';
      if (msg === 'not_found') msg = 'API не найден — обновите страницу или перезапустите сервер';
      if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
      if (err) { err.textContent = msg; err.hidden = false; }
      try { console.warn('[auth]', status, data, contentType); } catch (_) {}
      return;
    }

    authToken = data.token;
    try { persistAuthToken(authToken); } catch (_) {}
    try {
      if (data.guestProgress && authMode === 'register') {
        _ipGuestProgress = data.guestProgress;
        applyGuestProgressSnapshot(data.guestProgress);
      }
      if (data.account && typeof data.account.diamonds === 'number') {
        diamonds = Math.max(0, data.account.diamonds | 0);
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
      }
    } catch (_) {}
    closeAuthModal();
    await finishAuthSuccess(data.account, authMode);
  } catch (ex) {
    hideAuthLoading();
    try { window._bpAuthTransition = false; } catch (_) {}
    if (err) {
      err.textContent = 'Нет связи с сервером';
      err.hidden = false;
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

/**
 * Push EVERYTHING the account owns to the server right now (used before logout).
 * Cancels debounced syncs first so nothing fires later under a different identity.
 * @returns {Promise<boolean>} true when the server confirmed the save
 */
async function flushAccountProgressToServer() {
  if (!authToken) return true;
  if (!window._bpAccountLoaded) return true; // nothing was loaded → nothing of ours to push
  try { if (window._achSyncTimer) { clearTimeout(window._achSyncTimer); window._achSyncTimer = null; } } catch (_) {}
  try { if (window._historySyncTimer) { clearTimeout(window._historySyncTimer); window._historySyncTimer = null; } } catch (_) {}
  try {
    const ach = Object.assign({}, achProgress || {});
    if (typeof rankedBest === 'number' && rankedBest > (Number(ach.ranked_best_score) | 0)) ach.ranked_best_score = rankedBest | 0;
    const acc = await syncProfileToServer({
      history: Array.isArray(matchHistory) ? matchHistory.slice(0, 30) : [],
      achievements: ach,
      botStars: botStars || {},
      friends: Array.isArray(friends) ? friends.slice(0, 200) : [],
      best: typeof best === 'number' ? best : 0
    });
    return !!acc;
  } catch (_) {
    return false;
  }
}
try { window.flushAccountProgressToServer = flushAccountProgressToServer; } catch (_) {}

async function logoutAccount() {
  // Block the alive/session poll from treating logout as "account deleted"
  try { window._bpIntentionalLogout = true; } catch (_) {}
  try {
    if (typeof showAuthLoading === 'function') showAuthLoading('Сохраняем прогресс…');
  } catch (_) {}
  // 1) Save first. If the server cannot be reached, stay logged in: logging out now would
  //    erase the only copy of the unsynced progress (the local cache is wiped below).
  if (authToken) {
    let saved = false;
    try {
      saved = await Promise.race([
        flushAccountProgressToServer(),
        new Promise(function (r) { setTimeout(function () { r(false); }, 8000); })
      ]);
    } catch (_) { saved = false; }
    if (!saved) {
      try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
      try { window._bpIntentionalLogout = false; } catch (_) {}
      try {
        if (typeof showInfoToast === 'function') {
          showInfoToast('Выход отменён', 'Нет связи с сервером — прогресс ещё не сохранён. Попробуйте позже.', 'warn');
        }
      } catch (_) {}
      return;
    }
  }
  try {
    if (typeof showAuthLoading === 'function') showAuthLoading('Выходим из аккаунта…');
  } catch (_) {}
  try {
    if (authToken) await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  authToken = null;
  authAccount = null;
  try { window._bpAccountLoaded = false; } catch (_) {}
  // Pending debounced syncs must not run under the logged-out (guest) identity
  try { if (window._achSyncTimer) { clearTimeout(window._achSyncTimer); window._achSyncTimer = null; } } catch (_) {}
  try { if (window._historySyncTimer) { clearTimeout(window._historySyncTimer); window._historySyncTimer = null; } } catch (_) {}
  // Drop the live socket: it is still registered under the old friend code (presence / cosmetics)
  try {
    if (typeof MatchClient !== 'undefined') {
      try { MatchClient._lastPresence = null; } catch (_) {}
      try { MatchClient._wantQueue = null; } catch (_) {}
      try { if (typeof MatchClient.disconnect === 'function') MatchClient.disconnect(); } catch (_) {}
    }
  } catch (_) {}
  try { persistAuthToken(null); } catch (_) {}
  try { persistGuestOk(false); } catch (_) {}
  try { sessionStorage.removeItem('bp_guest_shop_warned'); } catch (_) {}
  // Full wipe — next session starts clean (guest or new account)
  try { discardGuestProgressFully(); } catch (_) {}
  try {
    myNickname = 'Гость';
    localStorage.setItem('bp_nickname', 'Гость');
  } catch (_) {}
  try {
    if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
    if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
  } catch (_) {}
  try { updateAccountUI(); } catch (_) {}
  try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
  try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
  try { if (typeof renderFriends === 'function') renderFriends(false); } catch (_) {}
  try { if (typeof renderShop === 'function') renderShop(); } catch (_) {}
  try {
    if (typeof showScreen === 'function') showScreen('menu');
    else if (typeof navigateScreen === 'function') navigateScreen('menu');
  } catch (_) {}
  await new Promise((r) => setTimeout(r, 600));
  try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
  // After logout: account remains bound to IP → guest must stay hidden
  entryGateDismissible = false;
  try {
    if (typeof showAuthLoading === 'function') {
      showAuthLoading('Выход выполнен', 'Подготовка меню…');
    }
  } catch (_) {}
  try { await refreshGuestAllowedFromServer(); } catch (_) {}
  const showGuestAfterLogout = !_ipHasRealAccount && shouldAllowGuestButton();
  entryGateShowGuest = showGuestAfterLogout;
  await new Promise(function (r) { setTimeout(r, 400); });
  try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
  try {
    showEntryGate({
      dismissible: false,
      showGuest: showGuestAfterLogout
    });
    entryGateSetMode('login');
    try { bindEntryGate(); } catch (_) {}
  } catch (_) {}
  // Keep the flag a bit longer so in-flight alive polls cannot flash "Аккаунт удалён"
  setTimeout(function () {
    try { window._bpIntentionalLogout = false; } catch (_) {}
  }, 5000);
}


/**
 * Server (or session poll) says this account no longer exists / session revoked.
 * Clear all local auth and force the entry gate — no soft continue as the old user.
 */
/**
 * Guest identity gone from server — clear local guest quietly.
 * Never show the dramatic "Аккаунт удалён" overlay (that is for registered accounts).
 */
/**
 * Guest identity missing/expired on server.
 * NEVER force the login gate while the player is already in the game —
 * that was kicking users when opening Friends/Shop tabs.
 */
function softClearDeadGuest(reason) {
  try {
    if (authToken) return false; // registered — forceAuthRevoked handles
  } catch (_) {}
  try {
    if (window._bpSoftGuestClearBusy) return true;
    window._bpSoftGuestClearBusy = true;
  } catch (_) {}
  try {
    // CRITICAL: never re-upload guest progress when the server says the identity is dead.
    // The old path called scheduleGuestProgressSync() and resurrected deleted accounts.
    try {
      window._bpAccountDeleted = true;
      window._bpGuestSyncBlocked = true;
    } catch (_) {}
    try { persistGuestOk(false); } catch (_) {}
    try { localStorage.removeItem('bp_guest_ok'); } catch (_) {}
    try {
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
    } catch (_) {}
    // Wipe local friend code + progress so presence_register cannot push the dead code back
    try {
      if (typeof discardGuestProgressFully === 'function') {
        discardGuestProgressFully({ keepFriendCode: false });
      } else {
        try { myFriendCode = ''; localStorage.removeItem('bp_my_code'); } catch (_) {}
      }
    } catch (_) {}
    // Force entry gate — identity is gone on every device path
    try {
      entryGateShowGuest = true;
      entryGateDismissible = false;
      if (typeof showEntryGate === 'function') {
        showEntryGate({ dismissible: false, showGuest: true });
      }
      if (typeof entryGateSetMode === 'function') entryGateSetMode('login');
    } catch (_) {}
    try {
      if (typeof showInfoToast === 'function' && reason !== 'boot') {
        showInfoToast('Сессия', 'Гостевой прогресс сброшен', 'warn');
      }
    } catch (_) {}
  } finally {
    setTimeout(function () {
      try { window._bpSoftGuestClearBusy = false; } catch (_) {}
    }, 2000);
  }
  return true;
}

try { window.softClearDeadGuest = softClearDeadGuest; } catch (_) {}

async function forceAuthRevoked(reason) {
  reason = reason || 'account_deleted';
  // Intentional logout / clean boot must never show "Аккаунт удалён"
  try {
    if (window._bpIntentionalLogout) return;
    // Login/register in progress — ignore stale guest-code "not alive" kicks
    if (window._bpAuthTransition) return;
    // Boot / entry-gate loading — never flash delete over "Подготовка меню"
    if (window._bpBooting) {
      try { softClearDeadGuest('boot'); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Guest-only identity death → hard local wipe + entry gate (no re-sync)
  try {
    if (!authToken && (reason === 'account_deleted' || reason === 'deleted')) {
      try { softClearDeadGuest(reason); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Session expiry is not account deletion — soft clear without delete UX
  if (reason === 'session_expired' || reason === 'unauthorized') {
    try {
      authToken = null;
      authAccount = null;
      try { persistAuthToken(null); } catch (_) {}
    } catch (_) {}
    return;
  }
  // False alarm guard: if we still have a live session, do NOT show "Аккаунт удалён"
  // (common race: wiped guest code polled while logged into a real account)
  // Skip this guard when reason is explicit account_deleted — identity is gone.
  if (reason !== 'account_deleted' && reason !== 'deleted') {
    try {
      if (authToken && typeof apiFetch === 'function') {
        const tok = authToken;
        const res = await apiFetch('/api/me', { method: 'GET' });
        if (authToken === tok && res && res.ok && res.data && res.data.ok && res.data.account) {
          // Session is valid — ignore the spurious revoke
          try {
            if (res.data.account.friendCode) {
              myFriendCode = String(res.data.account.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
              localStorage.setItem('bp_my_code', myFriendCode);
            }
          } catch (_) {}
          return;
        }
      }
    } catch (_) {}
  }
  try {
    if (window._bpAuthRevokedBusy) return;
    window._bpAuthRevokedBusy = true;
  } catch (_) {}
  try {
    // Block any further guest-sync / resume of the deleted identity
    try {
      window._bpAccountDeleted = true;
      window._bpGuestSyncBlocked = true;
    } catch (_) {}
    authToken = null;
    authAccount = null;
    try { persistAuthToken(null); } catch (_) {}
    try { localStorage.removeItem('bp_auth_token'); } catch (_) {}
    try { localStorage.removeItem('bp_account'); } catch (_) {}
    // Wipe in-memory + local guest resume so "Продолжить гостем" cannot appear
    try {
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
      _ipHasRealAccount = false;
    } catch (_) {}
    try {
      localStorage.removeItem('bp_my_code');
      localStorage.removeItem('bp_guest_ok');
      try { if (typeof persistGuestOk === 'function') persistGuestOk(false); } catch (_) {}
      try { document.cookie = 'bp_guest_ok=; Max-Age=0; path=/'; } catch (_) {}
      localStorage.removeItem('bp_skins_owned');
      localStorage.removeItem('bp_skin_equipped');
      localStorage.removeItem('bp_boards_owned');
      localStorage.removeItem('bp_board_equipped');
      localStorage.removeItem('bp_skin');
      localStorage.removeItem('bp_board');
      localStorage.removeItem('bp_trophies');
      localStorage.removeItem('bp_diamonds');
      localStorage.removeItem('bp_best');
      localStorage.removeItem('bp_friends');
      localStorage.removeItem('bp_history');
      localStorage.removeItem('bp_ach');
      localStorage.removeItem('bp_bot_stars');
      localStorage.removeItem('bp_status');
      localStorage.removeItem('bp_avatar');
      localStorage.removeItem('bp_avatar_custom');
    } catch (_) {}
    try { myFriendCode = ''; } catch (_) {}
    try { trophies = 0; diamonds = 9999; best = 0; friends = []; matchHistory = []; } catch (_) {}
    try { achProgress = {}; botStars = {}; rankedBest = 0; } catch (_) {}
    try { clearAllLocalClassicSaves(); localStorage.removeItem('bp_ranked_best'); localStorage.removeItem('bp_fr_out'); } catch (_) {}
    try { window._bpAccountLoaded = false; } catch (_) {}
    try {
      if (typeof MatchClient !== 'undefined') {
        try { MatchClient._lastPresence = null; } catch (_) {}
        try { MatchClient._wantClose = true; } catch (_) {}
        try { MatchClient._wantQueue = null; } catch (_) {}
        try { if (typeof MatchClient.disconnect === 'function') MatchClient.disconnect(); } catch (_) {}
      }
    } catch (_) {}
    try { if (typeof closeAccountDeleteModal === 'function') closeAccountDeleteModal(); } catch (_) {}
    try { if (typeof navigateScreen === 'function') navigateScreen('menu'); } catch (_) {}
    try {
      if (typeof showAuthLoading === 'function') {
        showAuthLoading(
          reason === 'account_deleted' ? 'Аккаунт удалён' : 'Сессия завершена',
          'Все данные стёрты'
        );
      }
    } catch (_) {}
    // Ask server — residual device guest progress should already be purged
    try { await refreshGuestAllowedFromServer(); } catch (_) {}
    // Force no resume regardless of laggy server response
    try {
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
    } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 400); });
    try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
    try {
      // Only offer a FRESH guest slot if device is free — never "continue"
      const canCreate = !_ipHasRealAccount
        && !(typeof deviceHadBoundAccount === 'function' && deviceHadBoundAccount())
        && !(typeof ipBlocksGuest === 'function' && ipBlocksGuest());
      showEntryGate({ dismissible: false, showGuest: !!canCreate });
      if (typeof entryGateSetMode === 'function') entryGateSetMode('login');
      if (typeof bindEntryGate === 'function') bindEntryGate();
      // Force guest plaque to "create" mode if visible
      try {
        const gb = document.getElementById('entryGateGuestBlock');
        if (gb && !gb.hidden) {
          gb.setAttribute('data-guest-mode', 'create');
          const strong = gb.querySelector('.entry-gate-btn-text strong');
          const small = gb.querySelector('.entry-gate-btn-text small');
          if (strong) strong.textContent = 'Играть гостем';
          if (small) small.textContent = 'Данные на сервере живут до 48 часов';
        }
      } catch (_) {}
    } catch (_) {}
    try {
      if (typeof showInfoToast === 'function') {
        showInfoToast('Аккаунт', 'Аккаунт удалён — все данные уничтожены', 'bad');
      }
    } catch (_) {}
  } finally {
    try { window._bpAuthRevokedBusy = false; } catch (_) {}
  }
}
try { window.forceAuthRevoked = forceAuthRevoked; } catch (_) {}

/** Open in-app modal to permanently delete server account (no native prompt/confirm). */
function openAccountDeleteModal() {
  if (!authToken) {
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Сначала войдите', 'bad');
    } catch (_) {}
    return;
  }
  const modal = document.getElementById('accountDeleteModal');
  const pw = document.getElementById('accountDeletePassword');
  const err = document.getElementById('accountDeleteError');
  if (!modal) {
    // Fallback if markup missing
    if (typeof bpConfirm === 'function') {
      bpConfirm({
        title: 'Удалить аккаунт?',
        text: 'Потребуется пароль. Действие необратимо.',
        okLabel: 'Продолжить',
        danger: true
      }).then(function (ok) { if (ok) openAccountDeleteModal(); });
    }
    return;
  }
  if (err) { err.hidden = true; err.textContent = ''; }
  if (pw) { pw.value = ''; }
  modal.hidden = false;
  modal.style.display = '';
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  try { setTimeout(function () { if (pw) pw.focus(); }, 60); } catch (_) {}
}
try { window.openAccountDeleteModal = openAccountDeleteModal; } catch (_) {}

function closeAccountDeleteModal() {
  const modal = document.getElementById('accountDeleteModal');
  if (!modal) return;
  modal.classList.remove('visible');
  modal.hidden = true;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  const pw = document.getElementById('accountDeletePassword');
  if (pw) pw.value = '';
  const err = document.getElementById('accountDeleteError');
  if (err) { err.hidden = true; err.textContent = ''; }
}
try { window.closeAccountDeleteModal = closeAccountDeleteModal; } catch (_) {}

async function submitAccountDelete() {
  const pwEl = document.getElementById('accountDeletePassword');
  const err = document.getElementById('accountDeleteError');
  const password = pwEl ? String(pwEl.value || '') : '';
  if (!password.length) {
    if (err) { err.hidden = false; err.textContent = 'Введите пароль аккаунта'; }
    try { if (pwEl) pwEl.focus(); } catch (_) {}
    return;
  }
  if (!authToken) {
    closeAccountDeleteModal();
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Сначала войдите', 'bad');
    } catch (_) {}
    return;
  }
  const confirmBtn = document.getElementById('accountDeleteConfirm');
  if (confirmBtn) confirmBtn.disabled = true;
  try {
    if (typeof showAuthLoading === 'function') showAuthLoading('Удаление аккаунта…');
  } catch (_) {}
  try {
    const { ok, data, status } = await apiFetch('/api/auth/delete', {
      method: 'POST',
      body: { password: password }
    });
    if (!ok || !data || !data.ok) {
      let msg = (data && (data.message || data.error))
        || (status === 403 ? 'Неверный пароль' : 'Не удалось удалить аккаунт');
      if (msg === 'password_required' || (data && data.error === 'password_required')) {
        msg = 'Введите пароль для удаления аккаунта';
      }
      if (msg === 'bad_password' || (data && data.error === 'bad_password')) {
        msg = 'Неверный пароль';
      }
      if (err) { err.hidden = false; err.textContent = msg; }
      try {
        if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', msg, 'bad');
      } catch (_) {}
      return;
    }
    authToken = null;
    authAccount = null;
    try { persistAuthToken(null); } catch (_) {}
    try { persistGuestOk(false); } catch (_) {}
    try { sessionStorage.removeItem('bp_guest_shop_warned'); } catch (_) {}
    // Unlock guest on this device BEFORE discard (clean slate like first visit)
    clearDeviceHadBoundAccount();
    try { discardGuestProgressFully(); } catch (_) {}
    try {
      myNickname = 'Гость';
      localStorage.setItem('bp_nickname', 'Гость');
    } catch (_) {}
    closeAccountDeleteModal();
    try {
      if (typeof showScreen === 'function') showScreen('menu');
      else if (typeof navigateScreen === 'function') navigateScreen('menu');
    } catch (_) {}
    try { updateAccountUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
    try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
    // Keep loading overlay while preparing first-visit gate
    try {
      if (typeof showAuthLoading === 'function') {
        showAuthLoading('Аккаунт удалён', 'Подготовка экрана входа…');
      }
    } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 500); });
    entryGateDismissible = false;
    authMode = 'login';
    // Blank slate: guest progress was merged into the account and is gone with it.
    // Never offer «Продолжить играть гостем» — only a fresh guest (or login/register).
    clearDeviceHadBoundAccount();
    _ipGuestBlocked = false;
    _ipCanResumeGuest = false;
    _ipGuestProgress = null;
    _ipHasRealAccount = false;
    try { persistGuestOk(false); } catch (_) {}
    try { persistAuthToken(null); } catch (_) {}
    authToken = null;
    authAccount = null;
    // Ask server: other accounts may still be bound to this IP
    try { await refreshGuestAllowedFromServer(); } catch (_) {}
    // Never resume deleted guest progress
    _ipCanResumeGuest = false;
    _ipGuestProgress = null;
    try { persistGuestOk(false); } catch (_) {}
    // Guest button ONLY if IP has zero real accounts left
    const canOfferGuest = !_ipHasRealAccount && !ipBlocksGuest();
    if (canOfferGuest) {
      clearDeviceHadBoundAccount();
      _ipGuestBlocked = false;
      entryGateShowGuest = true;
    } else {
      markDeviceHadBoundAccount();
      _ipGuestBlocked = true;
      entryGateShowGuest = false;
    }
    try { hideAuthLoading(); } catch (_) {}
    try {
      showEntryGate({ dismissible: false, showGuest: canOfferGuest });
      entryGateSetMode('login');
      try {
        const guestBlock = document.getElementById('entryGateGuestBlock');
        if (guestBlock && canOfferGuest) {
          guestBlock.setAttribute('data-guest-mode', 'create');
          const strong = guestBlock.querySelector('.entry-gate-btn-text strong');
          const small = guestBlock.querySelector('.entry-gate-btn-text small');
          if (strong) strong.textContent = 'Играть гостем';
          if (small) small.textContent = 'Чистый старт — прошлый прогресс удалён вместе с аккаунтом';
        } else if (guestBlock && !canOfferGuest) {
          guestBlock.hidden = true;
          guestBlock.setAttribute('hidden', '');
          guestBlock.style.setProperty('display', 'none', 'important');
        }
        const lead = document.querySelector('#entryGate .entry-gate-lead');
        if (lead) {
          lead.textContent = canOfferGuest
            ? 'Аккаунт удалён. Войди, зарегистрируйся или начни заново гостем'
            : 'Аккаунт удалён. Войди в существующий аккаунт или зарегистрируй новый';
        }
      } catch (_) {}
      try {
        const gb = document.getElementById('entryGateGuest');
        const cb = document.getElementById('entryGateGuestConfirm');
        const xb = document.getElementById('entryGateGuestCancel');
        if (gb) gb._egBound = false;
        if (cb) cb._egBound = false;
        if (xb) xb._egBound = false;
        bindEntryGate();
      } catch (_) {}
    } catch (_) {}
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Аккаунт удалён', 'ok');
    } catch (_) {}
  } catch (e) {
    if (err) { err.hidden = false; err.textContent = 'Нет связи с сервером'; }
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Нет связи с сервером', 'bad');
    } catch (_) {}
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
    try {
      if (typeof hideAuthLoading === 'function') hideAuthLoading();
    } catch (_) {}
  }
}
try { window.submitAccountDelete = submitAccountDelete; } catch (_) {}

/** Back-compat alias used by older onclick / delegation paths. */
function deleteAccount() {
  openAccountDeleteModal();
}
try { window.deleteAccount = deleteAccount; } catch (_) {}

/** Generic in-app confirm (Promise). Replaces native confirm() for destructive actions. */
function bpConfirm(opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    const modal = document.getElementById('bpConfirmModal');
    if (!modal) {
      // last-resort fallback
      resolve(window.confirm(opts.text || opts.title || 'Продолжить?'));
      return;
    }
    const title = document.getElementById('bpConfirmTitle');
    const text = document.getElementById('bpConfirmText');
    const okBtn = document.getElementById('bpConfirmOk');
    const cancelBtn = document.getElementById('bpConfirmCancel');
    const backdrop = document.getElementById('bpConfirmBackdrop');
    if (title) title.textContent = opts.title || 'Подтверждение';
    if (text) text.textContent = opts.text || '';
    if (okBtn) {
      okBtn.textContent = opts.okLabel || 'Да';
      okBtn.classList.toggle('danger-btn', !!opts.danger);
    }
    if (cancelBtn) cancelBtn.textContent = opts.cancelLabel || 'Отмена';

    function cleanup(result) {
      modal.classList.remove('visible');
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      if (okBtn) okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (backdrop) backdrop.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(!!result);
    }
    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    }
    if (okBtn) okBtn.onclick = function () { cleanup(true); };
    if (cancelBtn) cancelBtn.onclick = function () { cleanup(false); };
    if (backdrop) backdrop.onclick = function () { cleanup(false); };
    document.addEventListener('keydown', onKey);
    modal.hidden = false;
    modal.style.display = '';
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    try { setTimeout(function () { if (okBtn) okBtn.focus(); }, 40); } catch (_) {}
  });
}
try { window.bpConfirm = bpConfirm; } catch (_) {}

(function bindAccountDeleteModal() {
  const closeBtn = document.getElementById('accountDeleteClose');
  const cancelBtn = document.getElementById('accountDeleteCancel');
  const backdrop = document.getElementById('accountDeleteBackdrop');
  const confirmBtn = document.getElementById('accountDeleteConfirm');
  const pw = document.getElementById('accountDeletePassword');
  if (closeBtn && !closeBtn._bpBound) {
    closeBtn._bpBound = true;
    closeBtn.addEventListener('click', closeAccountDeleteModal);
  }
  if (cancelBtn && !cancelBtn._bpBound) {
    cancelBtn._bpBound = true;
    cancelBtn.addEventListener('click', closeAccountDeleteModal);
  }
  if (backdrop && !backdrop._bpBound) {
    backdrop._bpBound = true;
    backdrop.addEventListener('click', closeAccountDeleteModal);
  }
  if (confirmBtn && !confirmBtn._bpBound) {
    confirmBtn._bpBound = true;
    confirmBtn.addEventListener('click', function () { submitAccountDelete(); });
  }
  if (pw && !pw._bpBound) {
    pw._bpBound = true;
    pw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAccountDelete();
      }
    });
  }
})();


/** Push local profile fields to server (when logged in). Full progress bind. */
let _lastProfileSyncAt = 0;
let _lastProfileSyncSig = '';
async function syncProfileToServer(extra) {
  if (!authToken) {
    // Guest: persist progress on server by IP so it survives browser wipe
    try { await syncGuestProgressToServer(); } catch (_) {}
    return null;
  }
  // Never PATCH before the account has been loaded from the server: the in-memory state would be
  // device defaults, and the server replaces friends / history / achievements / bot stars wholesale.
  if (!window._bpAccountLoaded) {
    try {
      if (!window._bpRestoreRetry) {
        window._bpRestoreRetry = true;
        restoreSessionFromToken().finally(function () { window._bpRestoreRetry = false; });
      }
    } catch (_) { window._bpRestoreRetry = false; }
    return null;
  }
  try {
    const now = Date.now();
    // Soft throttle unless explicit extra fields (place rewards etc.)
    const forced = extra && typeof extra === 'object' && Object.keys(extra).length;
    if (!forced && _lastProfileSyncAt && (now - _lastProfileSyncAt) < 8000) return null;
    const body = Object.assign({
      nick: typeof myNickname !== 'undefined' ? myNickname : undefined,
      status: typeof myStatus !== 'undefined' ? myStatus : undefined,
      avatarId: typeof myAvatarId !== 'undefined' ? myAvatarId : undefined,
      trophies: typeof trophies === 'number' ? trophies : undefined,
      // diamonds intentionally omitted — server owns donation currency
      best: typeof best === 'number' ? best : undefined,
      skinId: typeof equippedSkinId !== 'undefined' ? equippedSkinId : undefined,
      boardId: typeof equippedBoardId !== 'undefined' ? equippedBoardId : undefined,
      ownedSkins: (typeof ownedSkins !== 'undefined' && Array.isArray(ownedSkins)) ? ownedSkins.slice(0, 64) : undefined,
      ownedBoards: (typeof ownedBoards !== 'undefined' && Array.isArray(ownedBoards)) ? ownedBoards.slice(0, 64) : undefined,
      friends: (typeof friends !== 'undefined' && Array.isArray(friends)) ? friends.slice(0, 200) : undefined,
      history: (typeof matchHistory !== 'undefined' && Array.isArray(matchHistory)) ? matchHistory.slice(0, 30) : undefined,
      achievements: (typeof achProgress === 'object' && achProgress) ? achProgress : undefined,
      botStars: (typeof botStars === 'object' && botStars) ? botStars : undefined,
      classicSave: (function () {
        try {
          const raw = localStorage.getItem(typeof classicSaveStorageKey === 'function' ? classicSaveStorageKey() : 'bp_classic_save');
          if (!raw) return undefined;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.grid) && data.grid.length >= 8) return data;
        } catch (_) {}
        return undefined;
      })()
    }, extra || {});
    // avatarCustom only when custom and either forced or not yet synced this session
    if (typeof myAvatarId !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) {
      if (forced || !window._bpAvatarCustomSynced) {
        body.avatarCustom = myAvatarCustom;
        window._bpAvatarCustomSynced = true;
      }
    } else if (!('avatarCustom' in (extra || {}))) {
      body.avatarCustom = '';
    }
    const sig = [
      body.nick, body.status, body.avatarId, body.trophies, body.diamonds, body.best,
      body.skinId, body.boardId,
      Array.isArray(body.ownedSkins) ? body.ownedSkins.length : 0,
      Array.isArray(body.friends) ? body.friends.length : 0
    ].join('|');
    if (!forced && sig === _lastProfileSyncSig && !body.avatarCustom) return null;
    _lastProfileSyncSig = sig;
    _lastProfileSyncAt = now;
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
    try { authToken = loadAuthToken(); } catch (_) {}
  }
  if (!authToken) {
    updateAccountUI();
    return false;
  }
  try {
    let result = await apiFetch('/api/me');
    // Retry once on network / server error (refresh mid-match, brief outage)
    if (!result.ok && (result.networkError || result.status >= 500 || result.status === 0)) {
      await new Promise(function (r) { setTimeout(r, 450); });
      result = await apiFetch('/api/me');
    }
    if (result.ok && result.data && result.data.account) {
      applyServerAccount(result.data.account);
      try { persistAuthToken(authToken); } catch (_) {}
      markDeviceHadBoundAccount();
      updateAccountUI();
      return true;
    }
    // Wipe token only on explicit unauthorized (not on offline)
    if (result.status === 401 || result.status === 403) {
      authToken = null;
      authAccount = null;
      try { persistAuthToken(null); } catch (_) {}
    }
    updateAccountUI();
    return false;
  } catch (_) {
    updateAccountUI();
    return false;
  }
}

function entryGateSetMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  const title = document.getElementById('entryGateTitle');
  const lead = document.querySelector('#entryGate .entry-gate-lead');
  const nickField = document.getElementById('entryAuthNickField');
  const passConfirmField = document.getElementById('entryAuthPasswordConfirmField');
  const submit = document.getElementById('entryAuthSubmit');
  const err = document.getElementById('entryAuthError');
  const guestBlock = document.getElementById('entryGateGuestBlock');
  const warn = document.getElementById('entryGateGuestWarn');
  const closeBtn = document.getElementById('entryGateClose');
  if (err) { err.hidden = true; err.textContent = ''; }
  if (warn) warn.hidden = true;
  document.querySelectorAll('[data-entry-auth-tab]').forEach((tab) => {
    const on = tab.getAttribute('data-entry-auth-tab') === authMode;
    tab.classList.toggle('on', on);
  });
  if (title) title.textContent = 'Добро пожаловать';
  if (lead) {
    const canGuest = !authToken && !_ipHasRealAccount && (ipCanResumeGuest() || (!ipBlocksGuest() && shouldAllowGuestButton()));
    if (canGuest && (hasLocalGuestSession() || ipCanResumeGuest())) {
      lead.textContent = authMode === 'register'
        ? 'Создай аккаунт — весь гостевой прогресс перенесётся'
        : 'Войди в аккаунт или продолжай играть гостем';
    } else if (canGuest) {
      lead.textContent = authMode === 'register'
        ? 'Создай аккаунт — прогресс сохранится навсегда'
        : 'Войди в аккаунт или играй гостем';
    } else {
      lead.textContent = authMode === 'register'
        ? 'Создай аккаунт — прогресс сохранится навсегда'
        : 'Войди в аккаунт или зарегистрируйся';
    }
  }
  if (submit) submit.textContent = authMode === 'register' ? 'Создать аккаунт' : 'Войти';
  if (nickField) nickField.hidden = authMode !== 'register';
  if (passConfirmField) passConfirmField.hidden = authMode !== 'register';
  // Guest block:
  //  - CREATE: first visit / after account delete (entryGateShowGuest + allowed)
  //  - CONTINUE: local guest session already exists (bp_guest_ok) — keep progress
  // CREATE: first visit only (entryGateShowGuest + allowed)
  // CONTINUE: start gate only (entryGateShowGuest) + local guest OR IP-resumable guest
  // Profile openAuthModal sets entryGateShowGuest=false → no guest button at all
  // CREATE: only if IP never had real account AND never claimed guest slot
  // CONTINUE: if local/IP guest progress exists AND no real account on IP
  //           (ipBlocksGuest is OK for continue — it only means "no NEW guest")
  // Profile login/register (dismissible): never show guest plaque
  const fromProfileAuth = !!entryGateDismissible && !entryGateShowGuest;
  // CONTINUE: server canResume OR local guest session (not from profile login modal)
  const allowContinueGuest = !fromProfileAuth
    && !authToken
    && !_ipHasRealAccount
    && !(window._bpAccountDeleted || window._bpGuestSyncBlocked)
    && (ipCanResumeGuest() || hasLocalGuestSession());
  // CREATE: only brand-new device, not when resume is available
  const allowCreateGuest = !fromProfileAuth
    && !authToken
    && !_ipHasRealAccount
    && !allowContinueGuest
    && !ipBlocksGuest()
    && !!entryGateShowGuest
    && shouldAllowGuestButton();
  const showGuestBlock = allowContinueGuest || allowCreateGuest;
  if (guestBlock) {
    if (showGuestBlock) {
      guestBlock.hidden = false;
      guestBlock.removeAttribute('hidden');
      guestBlock.style.setProperty('display', 'flex', 'important');
      guestBlock.style.setProperty('visibility', 'visible', 'important');
      guestBlock.style.setProperty('opacity', '1', 'important');
      // Update button label
      try {
        const strong = guestBlock.querySelector('.entry-gate-btn-text strong');
        const small = guestBlock.querySelector('.entry-gate-btn-text small');
        if (allowContinueGuest) {
          if (strong) strong.textContent = 'Продолжить играть гостем';
          if (small) {
            small.textContent = hasLocalGuestSession()
              ? 'Вернуться в игру с текущим прогрессом'
              : 'Восстановить гостевой прогресс с этого устройства';
          }
          guestBlock.setAttribute('data-guest-mode', 'continue');
        } else {
          if (strong) strong.textContent = 'Играть гостем';
          if (small) small.textContent = 'Данные на сервере живут до 48 часов';
          guestBlock.setAttribute('data-guest-mode', 'create');
        }
      } catch (_) {}
      const warnEl = document.getElementById('entryGateGuestWarn');
      if (warnEl) {
        warnEl.hidden = true;
        warnEl.style.removeProperty('display');
        warnEl.style.removeProperty('visibility');
        warnEl.style.removeProperty('opacity');
      }
      // Hide «или» divider text nuance
      try {
        const orEl = guestBlock.querySelector('.entry-gate-or span');
        if (orEl) {
          orEl.textContent = allowContinueGuest
            ? 'или войди / зарегистрируйся (прогресс перенесётся)'
            : 'или войди / зарегистрируйся';
        }
      } catch (_) {}
    } else {
      guestBlock.hidden = true;
      guestBlock.setAttribute('hidden', '');
      guestBlock.style.setProperty('display', 'none', 'important');
      const warnEl = document.getElementById('entryGateGuestWarn');
      if (warnEl) {
        warnEl.hidden = true;
        warnEl.style.setProperty('display', 'none', 'important');
      }
    }
  }
  if (closeBtn) {
    if (entryGateDismissible) {
      closeBtn.hidden = false;
      closeBtn.removeAttribute('hidden');
    } else {
      closeBtn.hidden = true;
      closeBtn.setAttribute('hidden', '');
    }
  }
  const pw = document.getElementById('entryAuthPassword');
  if (pw) pw.setAttribute('autocomplete', authMode === 'register' ? 'new-password' : 'current-password');
  const pw2 = document.getElementById('entryAuthPasswordConfirm');
  if (pw2) {
    if (authMode === 'register') {
      pw2.setAttribute('required', '');
    } else {
      pw2.removeAttribute('required');
      pw2.value = '';
    }
  }
}
function entryGateShowAuth(mode) {
  entryGateSetMode(mode);
}
function entryGateShowChoice() {
  entryGateSetMode('login');
}
/** Close login/register overlay without touching guest or server account. */
function dismissEntryGate() {
  entryGateDismissible = false;
  hideEntryGate();
  try { updateAccountUI(); } catch (_) {}
  try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
}
let _entryGateHideTimer = null;
let _entryGateGen = 0;

function showEntryGate(opts) {
  opts = opts || {};
  const el = document.getElementById('entryGate');
  if (!el) return;
  // Cancel pending hide so it cannot wipe flags right after reopen (e.g. after account delete)
  if (_entryGateHideTimer) {
    clearTimeout(_entryGateHideTimer);
    _entryGateHideTimer = null;
  }
  _entryGateGen += 1;
  if (typeof opts.dismissible === 'boolean') entryGateDismissible = opts.dismissible;
  if (typeof opts.showGuest === 'boolean') entryGateShowGuest = opts.showGuest;
  // Real registered account on this IP → never show guest (create OR continue)
  if (_ipHasRealAccount) entryGateShowGuest = false;
  try { closeAuthModal(); } catch (_) {}
  entryGateSetMode(authMode || 'login');
  el.hidden = false;
  el.style.display = 'flex';
  el.setAttribute('aria-hidden', 'false');
  try { void el.offsetWidth; } catch (_) {}
  el.classList.add('visible');
  try { document.body.classList.add('entry-gate-open'); } catch (_) {}
  try { document.documentElement.classList.add('entry-gate-pending'); } catch (_) {}
  try { document.documentElement.classList.remove('entry-gate-booting'); } catch (_) {}
  // Re-apply guest visibility after paint (guards against stale style/hidden)
  try {
    const gen = _entryGateGen;
    setTimeout(function () {
      if (gen !== _entryGateGen) return;
      try { entryGateSetMode(authMode || 'login'); } catch (_) {}
    }, 50);
  } catch (_) {}
}
function hideEntryGate() {
  try { document.documentElement.classList.remove('entry-gate-booting'); } catch (_) {}
  const el = document.getElementById('entryGate');
  if (!el) return;
  el.classList.remove('visible');
  const genAtHide = _entryGateGen;
  if (_entryGateHideTimer) {
    clearTimeout(_entryGateHideTimer);
    _entryGateHideTimer = null;
  }
  _entryGateHideTimer = setTimeout(function () {
    _entryGateHideTimer = null;
    // If gate was reopened meanwhile, do not reset flags / hide it
    if (genAtHide !== _entryGateGen) return;
    if (el.classList.contains('visible')) return;
    el.hidden = true;
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    try { document.body.classList.remove('entry-gate-open'); } catch (_) {}
    try { document.documentElement.classList.remove('entry-gate-pending'); } catch (_) {}
    entryGateDismissible = false;
    // Do not force entryGateShowGuest=false here — shouldAllowGuestButton + open path control it
  }, 420);
}
/**
 * Guest account is created ONLY when the player explicitly chooses guest mode.
 * Always a clean slate (new friend code, default skins, nick «Гость»).
 */
/** Resume existing guest (local session or IP-bound server progress). */
async function resumeGuestMode() {
  try { showAuthLoading('Загрузка гостевого аккаунта…'); } catch (_) {}
  try {
    try { await refreshGuestAllowedFromServer(); } catch (_) {}
    // Prefer server snapshot (after browser wipe)
    if (_ipGuestProgress) {
      applyGuestProgressSnapshot(_ipGuestProgress);
    } else if (!hasLocalGuestSession()) {
      // Guest mark without progress — enter as clean guest with same IP bind
      try { discardGuestProgressFully(); } catch (_) {}
    }
    try {
      const progress = snapshotGuestProgress() || {};
      try { if (myFriendCode) progress.friendCode = myFriendCode; } catch (_) {}
      if (!progress.ts) progress.ts = Date.now();
      const { ok, data } = await apiFetch('/api/auth/guest-bind', { method: 'POST', body: { progress } });
      if (data && data.deviceId && typeof persistDeviceId === 'function') {
        try { persistDeviceId(String(data.deviceId)); } catch (_) {}
      }
      if (data && data.guestProgress) {
        try { applyGuestProgressSnapshot(data.guestProgress); } catch (_) {}
      }
      if (!ok && data && (data.bound || data.hasAccount) && !data.canResumeGuest) {
        _ipHasRealAccount = true;
        markDeviceHadBoundAccount();
        try {
          if (typeof showInfoToast === 'function') {
            showInfoToast('Аккаунт', (data && data.message) || 'Войдите в аккаунт', 'bad');
          }
        } catch (_) {}
        return;
      }
    } catch (_) {
      try {
        if (typeof showInfoToast === 'function') showInfoToast('Сеть', 'Нет связи с сервером', 'bad');
      } catch (_2) {}
      return;
    }
    try { persistGuestOk(true); } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
    try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
    try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
    try { updateAccountUI(); } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    // Pull authoritative shop inventory after guest resume
    try {
      if (typeof MatchClient !== 'undefined' && MatchClient.cosmeticsGet) MatchClient.cosmeticsGet();
    } catch (_) {}
    try {
      if (typeof renderShopGrid === 'function') renderShopGrid();
      if (typeof renderInvGrid === 'function') renderInvGrid();
      if (typeof renderShop === 'function') renderShop();
    } catch (_) {}
    try { scheduleGuestProgressSync(); } catch (_) {}
    try { await syncGuestProgressToServer({ force: true, full: true }); } catch (_) {}
    try {
      setTimeout(function () {
        try {
          if (typeof MatchClient !== 'undefined' && MatchClient.cosmeticsGet) MatchClient.cosmeticsGet();
        } catch (_) {}
        try {
          if (typeof renderShopGrid === 'function') renderShopGrid();
          if (typeof renderInvGrid === 'function') renderInvGrid();
        } catch (_) {}
      }, 700);
    } catch (_) {}
    hideEntryGate();
  } finally {
    try { hideAuthLoading(); } catch (_) {}
  }
}

async function acceptGuestMode(opts) {
  opts = opts || {};
  // After account deletion — never resume old identity
  try {
    if (window._bpAccountDeleted || window._bpGuestSyncBlocked) {
      opts = Object.assign({}, opts, { resume: false });
      try { localStorage.removeItem('bp_guest_ok'); } catch (_) {}
      try { _ipCanResumeGuest = false; _ipGuestProgress = null; } catch (_) {}
    }
  } catch (_) {}
  // Resume path: local flag, server canResume, or explicit { resume: true }
  try {
    if (!window._bpAccountDeleted && !window._bpGuestSyncBlocked
        && (opts.resume || localStorage.getItem('bp_guest_ok') === '1' || ipCanResumeGuest())) {
      try { await resumeGuestMode(); } catch (_) {
        hideEntryGate();
        try { updateAccountUI(); } catch (_) {}
      }
      return;
    }
  } catch (_) {}
  try {
    const block = document.getElementById('entryGateGuestBlock');
    const mode = block && block.getAttribute('data-guest-mode');
    if (mode !== 'create') {
      try { await refreshGuestAllowedFromServer(); } catch (_) {}
      if (ipCanResumeGuest()) {
        await resumeGuestMode();
        return;
      }
    } else {
      // Fresh start: ignore any leftover IP guest snapshot
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
    }
  } catch (_) {}
  if (deviceHadBoundAccount() || ipBlocksGuest() || _ipHasRealAccount) {
    try {
      if (typeof showInfoToast === 'function') {
        showInfoToast('Аккаунт', 'На этом устройстве или сети уже был аккаунт — войдите или зарегистрируйтесь', 'bad');
      }
    } catch (_) {}
    try {
      entryGateShowGuest = false;
      entryGateSetMode(authMode || 'login');
    } catch (_) {}
    return;
  }
  try { showAuthLoading('Создаём гостевой аккаунт…'); } catch (_) {}
  try {
    try { discardGuestProgressFully(); } catch (_) {}
    // Device id must exist before bind
    try {
      const did = getDeviceId();
      if (typeof persistDeviceId === 'function') persistDeviceId(did);
    } catch (_) {}
    try { ensureMyFriendCode(); } catch (_) {}
    // Bind on server FIRST — bp_guest_ok only after success
    let bindOk = false;
    try {
      const progress = snapshotGuestProgress() || {};
      try { if (myFriendCode) progress.friendCode = myFriendCode; } catch (_) {}
      if (!progress.ts) progress.ts = Date.now();
      const { ok, data, status } = await apiFetch('/api/auth/guest-bind', { method: 'POST', body: { progress } });
      if (data && data.deviceId && typeof persistDeviceId === 'function') {
        try { persistDeviceId(String(data.deviceId)); } catch (_) {}
      }
      if (ok && data && data.ok !== false) {
        bindOk = true;
        _ipGuestBlocked = true;
        _ipCanResumeGuest = true;
        if (data.guestProgress) _ipGuestProgress = data.guestProgress;
        // Fresh guest after a deleted identity — allow normal play/sync again
        try {
          window._bpAccountDeleted = false;
          window._bpGuestSyncBlocked = false;
        } catch (_) {}
      } else if (data && (data.error === 'already_bound' || data.bound || data.hasAccount)) {
        if (data.canResumeGuest) {
          _ipCanResumeGuest = true;
          _ipGuestProgress = data.guestProgress || null;
          await resumeGuestMode();
          return;
        }
        _ipHasRealAccount = true;
        _ipGuestBlocked = true;
        markDeviceHadBoundAccount();
        try {
          if (typeof showInfoToast === 'function') {
            showInfoToast('Аккаунт', (data && data.message) || 'С этого устройства уже был аккаунт — войдите', 'bad');
          }
        } catch (_) {}
        entryGateShowGuest = false;
        try { entryGateSetMode(authMode || 'login'); } catch (_) {}
        return;
      } else {
        try {
          if (typeof showInfoToast === 'function') {
            showInfoToast('Сеть', (data && data.message) || ('Не удалось привязать устройство (' + (status || '?') + ')'), 'bad');
          }
        } catch (_) {}
        return;
      }
    } catch (e) {
      try {
        if (typeof showInfoToast === 'function') {
          showInfoToast('Сеть', 'Нет связи с сервером — гость без привязки недоступен', 'bad');
        }
      } catch (_) {}
      return;
    }
    if (!bindOk) return;
    try { persistGuestOk(true); } catch (_) {}

    await new Promise((r) => setTimeout(r, 700));
    try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
    try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
    try { updateAccountUI(); } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    try { if (typeof renderShop === 'function') renderShop(); } catch (_) {}
    try { if (typeof renderFriends === 'function') renderFriends(false); } catch (_) {}
    try { scheduleGuestProgressSync(); } catch (_) {}
    try { await syncGuestProgressToServer({ force: true, full: true }); } catch (_) {}
    hideEntryGate();
  } finally {
    try { hideAuthLoading(); } catch (_) {}
  }
}
/**
 * First visit: only the registration/login gate.
 * No guest account and no server account are loaded until the player chooses.
 * Returning guest (bp_guest_ok) or valid token may enter the game.
 */
async function maybeShowEntryGate() {
  function endBoot() {
    try { window._bpBooting = false; } catch (_) {}
  }
  if (authToken) {
    try { window._bpBooting = true; } catch (_) {}
    try { showAuthLoading('Загрузка аккаунта…'); } catch (_) {}
    try {
      const ok = await restoreSessionFromToken();
      if (ok) {
        await new Promise((r) => setTimeout(r, 600));
        hideEntryGate();
        endBoot();
        return;
      }
    } finally {
      try { hideAuthLoading(); } catch (_) {}
    }
  }
  // Always ask server first — admin may have deleted the account on this device
  try { window._bpBooting = true; } catch (_) {}
  try { showAuthLoading('Загрузка…', 'Подготовка меню'); } catch (_) {}
  try {
    await refreshGuestAllowedFromServer();
  } catch (_) {}
  // If device had a registered account (even deleted), never auto-enter as guest
  if (_ipHasRealAccount || ipBlocksGuest()) {
    try { persistGuestOk(false); } catch (_) {}
    entryGateShowGuest = false;
    entryGateDismissible = false;
    try { hideAuthLoading(); } catch (_) {}
    showEntryGate({ dismissible: false, showGuest: false });
    try { entryGateSetMode(authMode || 'login'); } catch (_) {}
    endBoot();
    return;
  }
  let guestOk = false;
  try { guestOk = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
  // Auto-resume guest like registered auto-login (no gate if progress/device allows)
  const canAutoGuest = !_ipHasRealAccount && !authToken
    && (ipCanResumeGuest() || hasLocalGuestSession() || guestOk);
  if (canAutoGuest) {
    try { hideAuthLoading(); } catch (_) {}
    hideEntryGate();
    try {
      if (typeof acceptGuestMode === 'function') {
        await acceptGuestMode({ silent: true, resume: true });
      } else {
        try { persistGuestOk(true); } catch (_) {}
        try { updateAccountUI(); } catch (_) {}
        try { scheduleGuestProgressSync(); } catch (_) {}
      }
    } catch (_) {
      try { updateAccountUI(); } catch (_) {}
    }
    // Keep booting flag briefly so in-flight alive polls cannot flash delete UX
    setTimeout(endBoot, 2500);
    return;
  }
  if (guestOk && !ipCanResumeGuest() && !hasLocalGuestSession()) {
    try { persistGuestOk(false); } catch (_) {}
  }
  // Create OR continue guest — never if a real account is bound to this IP
  const showGuest = !_ipHasRealAccount && (ipCanResumeGuest() || hasLocalGuestSession() || shouldAllowGuestButton());
  entryGateShowGuest = showGuest;
  entryGateDismissible = false;
  await new Promise(function (r) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(r, 280); });
    });
  });
  try { hideAuthLoading(); } catch (_) {}
  showEntryGate({ dismissible: false, showGuest: showGuest });
  try { entryGateSetMode(authMode || 'login'); } catch (_) {}
  try {
    setTimeout(function () {
      try { entryGateSetMode(authMode || 'login'); } catch (_) {}
    }, 100);
  } catch (_) {}
  setTimeout(endBoot, 1500);
}


async function submitEntryAuthForm(e) {
  if (e) e.preventDefault();
  const loginEl = document.getElementById('entryAuthLogin');
  const passEl = document.getElementById('entryAuthPassword');
  const nickEl = document.getElementById('entryAuthNick');
  const err = document.getElementById('entryAuthError');
  const submit = document.getElementById('entryAuthSubmit');
  const login = loginEl ? String(loginEl.value || '').trim() : '';
  const password = passEl ? String(passEl.value || '') : '';
  const nick = nickEl ? String(nickEl.value || '').trim() : '';
  const passConfirmEl = document.getElementById('entryAuthPasswordConfirm');
  const passwordConfirm = passConfirmEl ? String(passConfirmEl.value || '') : '';
  if (err) { err.hidden = true; err.textContent = ''; }
  if (authMode === 'register') {
    if (password.length < 6) {
      if (err) { err.textContent = 'Пароль: минимум 6 символов'; err.hidden = false; }
      return;
    }
    if (password !== passwordConfirm) {
      if (err) { err.textContent = 'Пароли не совпадают'; err.hidden = false; }
      return;
    }
  }
  const wasGuestOnLogin = (authMode === 'login' && isPlayingAsGuest());
  const guestCodePending = wasGuestOnLogin ? getActiveGuestFriendCode() : '';
  if (submit) submit.disabled = true;
  showAuthLoading(
    authMode === 'register' ? 'Создаём аккаунт…' : 'Входим в аккаунт…',
    authMode === 'register' ? 'Регистрация на сервере…' : 'Проверка данных…'
  );
  try {
    // ── Guest login: check credentials ONLY (no session / no wipe) ──
    if (authMode === 'login' && wasGuestOnLogin) {
      const check = await apiFetch('/api/auth/check-login', {
        method: 'POST',
        body: { login, password }
      });
      if (!check.ok || !check.data || !check.data.ok) {
        hideAuthLoading();
        let msg = (check.data && (check.data.message || check.data.error)) || null;
        if (!msg) {
          if (check.networkError || check.status === 0) msg = 'Нет связи с сервером';
          else if (check.status === 401) msg = 'Неверный логин или пароль';
          else msg = 'Ошибка (код ' + check.status + ')';
        }
        if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
        if (err) { err.textContent = msg; err.hidden = false; }
        return;
      }
      hideAuthLoading();
      const decision = await confirmGuestLoginWipe();
      if (decision === 'cancel') return;
      if (decision === 'register') {
        try {
          if (typeof entryGateSetMode === 'function') entryGateSetMode('register');
          else if (typeof openAuthModal === 'function') openAuthModal('register');
        } catch (_) {}
        return;
      }
      // ONLY after confirm: real login + wipe guest
      try { window._bpAuthTransition = true; } catch (_) {}
      try {
        localStorage.removeItem('bp_guest_ok');
        if (typeof persistGuestOk === 'function') persistGuestOk(false);
        else { try { document.cookie = 'bp_guest_ok=; Max-Age=0; path=/; SameSite=Lax'; } catch (_2) {} }
      } catch (_) {}
      showAuthLoading('Входим в аккаунт…', 'Удаляем гостевой прогресс…');
      const loginBody = {
        login,
        password,
        wipeGuest: true,
        guestFriendCode: guestCodePending || undefined
      };
      const { ok, data, status, networkError } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: loginBody
      });
      if (!ok || !data || !data.ok) {
        hideAuthLoading();
        try { window._bpAuthTransition = false; } catch (_) {}
        let msg = (data && (data.message || data.error)) || 'Не удалось войти';
        if (networkError || status === 0) msg = 'Нет связи с сервером';
        if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
        if (err) { err.textContent = msg; err.hidden = false; }
        return;
      }
      authToken = data.token;
      try { persistAuthToken(authToken); } catch (_) {}
      try {
        if (data.account && data.account.friendCode) {
          myFriendCode = String(data.account.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
          localStorage.setItem('bp_my_code', myFriendCode);
        }
      } catch (_) {}
      try {
        if (guestCodePending) {
          await apiFetch('/api/auth/wipe-guest', {
            method: 'POST',
            body: { guestFriendCode: guestCodePending }
          });
        }
      } catch (_) {}
      await finishAuthSuccess(data.account, 'login');
      return;
    }

    // ── Register or non-guest login ──
    const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = { login, password };
    if (authMode === 'register' && nick) body.nick = nick;
    if (authMode === 'register') {
      try {
        const prep = await prepareRegisterGuestPayload();
        if (prep.guestProgress) {
          body.guestProgress = prep.guestProgress;
          try { applyGuestProgressSnapshot(prep.guestProgress); } catch (_) {}
          _ipGuestProgress = prep.guestProgress;
        }
        if (prep.preferredFriendCode) body.preferredFriendCode = prep.preferredFriendCode;
      } catch (_) {}
    }
    if (authMode === 'login') {
      try { window._bpAuthTransition = true; } catch (_) {}
    }
    const { ok, data, status, networkError } = await apiFetch(path, { method: 'POST', body });
    if (!ok || !data || !data.ok) {
      hideAuthLoading();
      try { window._bpAuthTransition = false; } catch (_) {}
      let msg = (data && (data.message || data.error)) || null;
      if (!msg) {
        if (networkError || status === 0) msg = 'Нет связи с сервером';
        else if (status === 503) msg = 'Сервис аккаунтов недоступен';
        else msg = 'Ошибка (код ' + status + ')';
      }
      if (msg === 'accounts_unavailable') msg = 'Сервис аккаунтов недоступен';
      if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
      if (err) { err.textContent = msg; err.hidden = false; }
      return;
    }
    authToken = data.token;
    try { persistAuthToken(authToken); } catch (_) {}
    try {
      if (data.guestProgress && authMode === 'register') {
        _ipGuestProgress = data.guestProgress;
        applyGuestProgressSnapshot(data.guestProgress);
      }
      if (data.account && typeof data.account.diamonds === 'number') {
        diamonds = Math.max(0, data.account.diamonds | 0);
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
      }
    } catch (_) {}
    await finishAuthSuccess(data.account, authMode);
  } catch (ex) {
    hideAuthLoading();
    try { window._bpAuthTransition = false; } catch (_) {}
    if (err) { err.textContent = 'Нет связи с сервером'; err.hidden = false; }
  } finally {
    if (submit) submit.disabled = false;
  }
}

function bindEntryGate() {
  const guestBtn = document.getElementById('entryGateGuest');
  const confirmBtn = document.getElementById('entryGateGuestConfirm');
  const cancelBtn = document.getElementById('entryGateGuestCancel');
  const closeBtn = document.getElementById('entryGateClose');
  const form = document.getElementById('entryAuthForm');
  if (closeBtn && !closeBtn._egBound) {
    closeBtn._egBound = true;
    closeBtn.addEventListener('click', () => dismissEntryGate());
  }
  function showGuestWarn() {
    const warn = document.getElementById('entryGateGuestWarn');
    if (!warn) return;
    warn.hidden = false;
    warn.removeAttribute('hidden');
    warn.style.setProperty('display', 'block', 'important');
    warn.style.setProperty('visibility', 'visible', 'important');
    warn.style.setProperty('opacity', '1', 'important');
  }
  function hideGuestWarn() {
    const warn = document.getElementById('entryGateGuestWarn');
    if (!warn) return;
    warn.hidden = true;
    warn.setAttribute('hidden', '');
    warn.style.removeProperty('display');
    warn.style.removeProperty('visibility');
    warn.style.removeProperty('opacity');
  }
  // Always (re)bind guest controls
  if (guestBtn) {
    guestBtn._egBound = true;
    guestBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const block = document.getElementById('entryGateGuestBlock');
      const mode = block && block.getAttribute('data-guest-mode');
      // Explicit create mode (e.g. after account delete) — never resume old progress
      if (mode === 'create') {
        showGuestWarn();
        return;
      }
      if (mode === 'continue' || hasLocalGuestSession() || ipCanResumeGuest()) {
        // Resume guest (local or from IP server snapshot)
        resumeGuestMode().catch(function (err) { console.warn('resumeGuest', err); });
        return;
      }
      // New guest — show warning first
      showGuestWarn();
    };
  }
  if (confirmBtn) {
    confirmBtn._egBound = true;
    confirmBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      acceptGuestMode().catch(function (err) { console.warn('acceptGuestMode', err); });
    };
  }
  if (cancelBtn) {
    cancelBtn._egBound = true;
    cancelBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      hideGuestWarn();
    };
  }
  if (form && !form._egBound) {
    form._egBound = true;
    form.addEventListener('submit', submitEntryAuthForm);
  }
  document.querySelectorAll('[data-entry-auth-tab]').forEach((tab) => {
    if (tab._egBound) return;
    tab._egBound = true;
    tab.addEventListener('click', () => {
      entryGateSetMode(tab.getAttribute('data-entry-auth-tab') === 'register' ? 'register' : 'login');
    });
  });
}

try {
  window.showEntryGate = showEntryGate;
  window.hideEntryGate = hideEntryGate;
  window.dismissEntryGate = dismissEntryGate;
  window.acceptGuestMode = acceptGuestMode;
  window.entryGateShowAuth = entryGateShowAuth;
  window.entryGateShowChoice = entryGateShowChoice;
} catch (_) {}

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
  const delBtn = document.getElementById('btnAccountDelete');
  if (delBtn && !delBtn._authBound) {
    delBtn._authBound = true;
    delBtn.addEventListener('click', () => deleteAccount());
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
  // Only modal tabs — entry-gate tabs use data-entry-auth-tab and must NOT call openAuthModal
  document.querySelectorAll('#authModal .auth-tab').forEach((tab) => {
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
    const t = e.target && e.target.closest && e.target.closest('#btnProfileBind, #btnAccountLogout, #btnAccountDelete, #authModalClose, #authModal .auth-tab');
    if (!t) return;
    if (t.id === 'btnProfileBind') {
      e.preventDefault();
      openAuthModal('login');
    } else if (t.id === 'btnAccountLogout') {
      e.preventDefault();
      logoutAccount();
    } else if (t.id === 'btnAccountDelete') {
      e.preventDefault();
      deleteAccount();
    } else if (t.id === 'authModalClose') {
      closeAuthModal();
    } else if (t.closest && t.closest('#authModal') && t.classList && t.classList.contains('auth-tab')) {
      // Never treat entry-gate tabs as modal tabs (that was killing «Играть гостем»)
      openAuthModal(t.getAttribute('data-auth-tab') === 'register' ? 'register' : 'login');
    }
  }, true);
}

function scheduleAuthBind() {
  try { bindAccountUI(); } catch (e) { console.warn('bindAccountUI', e); }
  try { bindEntryGate(); } catch (e) { console.warn('bindEntryGate', e); }
  try {
    maybeShowEntryGate().catch(function (e) { console.warn('entryGate', e); });
  } catch (e) { console.warn('entryGate', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleAuthBind);
} else {
  scheduleAuthBind();
}
window.addEventListener('load', () => {
  try { bindAccountUI(); } catch (_) {}
  try { bindEntryGate(); } catch (_) {}
});

/** Hook: after profile save, sync to cloud */
(function patchProfileSaveSync() {
  const btn = document.getElementById('btnProfileSave');
  if (!btn || btn._authSyncBound) return;
  btn._authSyncBound = true;
  btn.addEventListener('click', () => {
    setTimeout(() => { try { syncProfileToServer(); } catch (_) {} }, 50);
  });
})();


(function wireAuthRevokedWatcher() {
  function onRevoked(data) {
    try {
      if (!(data && (data.type === 'auth_revoked' || data.reason === 'account_deleted'))) return;
      // Guest / no session: soft path — never yank open tabs to login gate
      try {
        if (!authToken) {
          softClearDeadGuest(data.reason === 'account_deleted' ? 'session_check' : (data.reason || 'session_check'));
          return;
        }
      } catch (_) {}
      forceAuthRevoked(data.reason || 'account_deleted');
    } catch (_) {}
  }
  function tryWire() {
    if (typeof MatchClient === 'undefined' || typeof MatchClient.on !== 'function') {
      setTimeout(tryWire, 400);
      return;
    }
    try { MatchClient.on('auth_revoked', onRevoked); } catch (_) {}
    // Also catch generic messages if client routes by type field only
    try {
      MatchClient.on('message', function (msg) {
        if (msg && msg.type === 'auth_revoked') onRevoked(msg);
      });
    } catch (_) {}
  }
  tryWire();

  // Poll every 2.5s: account/guest gone from DB → force entry gate
  setInterval(function () {
    try {
      if (window._bpAuthRevokedBusy) return;
      if (window._bpIntentionalLogout) return;
      if (window._bpAuthTransition) return;
      if (window._bpBooting) return;
      // Only poll while we actually have an active identity (session or guest)
      let guestOk = false;
      try { guestOk = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
      const hasSession = !!(authToken || guestOk);
      if (!hasSession) return;

      // Prefer registered account friend code when logged in (never poll wiped guest code)
      let code = '';
      try {
        if (authToken && authAccount && authAccount.friendCode) {
          code = String(authAccount.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        }
      } catch (_) {}
      if (!code && typeof myFriendCode !== 'undefined' && myFriendCode) {
        code = String(myFriendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      }

      // Logged-in users: trust /api/me. Alive-by-code is only a guest safety net.
      if (authToken && typeof apiFetch === 'function') {
        const tok = authToken;
        const polledCode = code;
        apiFetch('/api/me', { method: 'GET' }).then(function (res) {
          try {
            if (window._bpIntentionalLogout || window._bpAuthTransition) return;
            if (!authToken || authToken !== tok) return;
            if (!res) return;
            if (res.status === 401 || res.status === 403 || (res.data && res.data.error === 'unauthorized')) {
              // Account row gone (deleted from DB) → full wipe + auto-logout everywhere
              const deleted = !!(res.data && (res.data.accountDeleted || res.data.error === 'account_deleted'));
              forceAuthRevoked(deleted ? 'account_deleted' : 'session_expired');
            }
          } catch (_) {}
        }).catch(function () {});
        // Optional: if we know account code, soft-check alive; ignore mismatches
        if (polledCode && authAccount && authAccount.friendCode) {
          const accCode = String(authAccount.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
          if (polledCode === accCode) {
            apiFetch('/api/auth/alive?code=' + encodeURIComponent(polledCode), { method: 'GET' }).then(function (res) {
              try {
                if (window._bpIntentionalLogout || window._bpAuthTransition) return;
                if (!authToken) return;
                if (!res || !res.data) return;
                // Only kick if server says account is gone (hasAccount false & not alive)
                if (res.data.alive === false && res.data.hasAccount === false) {
                  forceAuthRevoked('account_deleted');
                }
              } catch (_) {}
            }).catch(function () {});
          }
        }
      } else if (code && typeof apiFetch === 'function') {
        // Guest-only alive check
        apiFetch('/api/auth/alive?code=' + encodeURIComponent(code), { method: 'GET' }).then(function (res) {
          try {
            if (window._bpIntentionalLogout || window._bpAuthTransition) return;
            if (authToken) return; // logged in mid-flight — ignore guest check
            if (!res || !res.data) return;
            if (res.data.alive === false) {
              try { softClearDeadGuest('alive_poll'); } catch (_) {
                forceAuthRevoked('account_deleted');
              }
            }
          } catch (_) {}
        }).catch(function () {});
      }
      try {
        if (window._bpBooting) { /* skip session_check during boot */ }
        else if (code && MatchClient && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.send === 'function') {
          MatchClient.send({ type: 'session_check', friendCode: code });
        }
      } catch (_) {}
    } catch (_) {}
  }, 2500);
  // WS close 4001 → immediate kick
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.on) {
      MatchClient.on('close', function (ev) {
        try {
          if (window._bpIntentionalLogout || window._bpAuthTransition) return;
          if (ev && (ev.code === 4001 || ev.reason === 'account_deleted')) {
            if (!authToken) {
              softClearDeadGuest('session_check');
              return;
            }
            forceAuthRevoked('account_deleted');
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
