/**
 * Block Puzzle — js/04-profile-friends/08-auth-session.js
 * Auth token/cookies, device identity, apiFetch, applying server account, account UI.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
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
