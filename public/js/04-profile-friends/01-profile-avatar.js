/**
 * Block Puzzle — js/04-profile-friends/01-profile-avatar.js
 * Guest profile: avatar presets, nickname, profile screen.
 * Shares the client bundle scope (order: public/js/modules.json).
 */

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
