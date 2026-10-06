/**
 * Block Puzzle — js/04-profile-friends/09-guest-progress-migration.js
 * Guest progress snapshot, register payload, discard, finishAuthSuccess.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
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
