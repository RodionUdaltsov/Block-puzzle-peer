/**
 * Account registry — zero-deps (Node crypto).
 * Passwords: scrypt. Sessions: opaque tokens in store.
 */
'use strict';

const crypto = require('crypto');

const LOGIN_RE = /^[a-z0-9_]{3,24}$/;
const PASS_MIN = 6;
const PASS_MAX = 72;
const SESSION_TTL_SEC = 30 * 24 * 3600; // 30 days
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeLogin(raw) {
  return String(raw || '').trim().toLowerCase();
}

function validLogin(login) {
  return LOGIN_RE.test(login);
}

function validPassword(pass) {
  const s = String(pass || '');
  return s.length >= PASS_MIN && s.length <= PASS_MAX;
}

function genId() {
  return crypto.randomBytes(16).toString('hex');
}

function genSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function genFriendCode(len) {
  len = len || 6;
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function verifyPassword(password, salt, hash) {
  try {
    const a = Buffer.from(hashPassword(password, salt), 'hex');
    const b = Buffer.from(String(hash || ''), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function publicAccount(acc) {
  if (!acc) return null;
  let friends = [];
  try {
    if (Array.isArray(acc.friends)) {
      friends = acc.friends.slice(0, 200).map((f) => ({
        code: String((f && f.code) || '').toUpperCase().slice(0, 12),
        name: String((f && f.name) || '').slice(0, 24),
        trophies: (f && typeof f.trophies === 'number') ? (f.trophies | 0) : undefined,
        avatarId: (f && f.avatarId) ? String(f.avatarId).slice(0, 32) : undefined,
        avatarCustom: (f && typeof f.avatarCustom === 'string') ? f.avatarCustom.slice(0, 49152) : undefined,
        added: (f && f.added) || null
      })).filter((f) => f.code);
    }
  } catch (_) { friends = []; }
  let ownedSkins = [];
  let ownedBoards = [];
  let history = [];
  try {
    if (Array.isArray(acc.ownedSkins)) ownedSkins = acc.ownedSkins.map(String).slice(0, 64);
    if (Array.isArray(acc.ownedBoards)) ownedBoards = acc.ownedBoards.map(String).slice(0, 64);
  } catch (_) {}
  try {
    if (Array.isArray(acc.history)) {
      history = acc.history.slice(0, 30).map(sanitizeHistoryEntry).filter(Boolean);
    }
  } catch (_) { history = []; }
  let achievements = {};
  try {
    if (acc.achievements && typeof acc.achievements === 'object' && !Array.isArray(acc.achievements)) {
      // Cap size: max ~200 keys, values numbers/bools/short strings
      const keys = Object.keys(acc.achievements).slice(0, 250);
      for (const k of keys) {
        const v = acc.achievements[k];
        if (typeof v === 'number' && isFinite(v)) achievements[String(k).slice(0, 48)] = v;
        else if (typeof v === 'boolean') achievements[String(k).slice(0, 48)] = v ? 1 : 0;
        else if (typeof v === 'string') achievements[String(k).slice(0, 48)] = v.slice(0, 64);
      }
    }
  } catch (_) { achievements = {}; }
  return {
    id: acc.id,
    login: acc.login,
    friendCode: acc.friendCode,
    nick: acc.nick || 'Игрок',
    trophies: Math.max(0, acc.trophies | 0),
    diamonds: Math.max(0, acc.diamonds | 0),
    best: Math.max(0, acc.best | 0),
    avatarId: acc.avatarId || 'init',
    avatarCustom: typeof acc.avatarCustom === 'string' ? acc.avatarCustom : '',
    status: acc.status || '',
    skinId: acc.skinId || 'default',
    boardId: acc.boardId || 'field_default',
    ownedSkins,
    ownedBoards,
    friends,
    history,
    achievements,
    createdAt: acc.createdAt || null,
    updatedAt: acc.updatedAt || null
  };
}

/** Keep history entries compact enough for file/redis storage */
function sanitizeHistoryEntry(h, idx) {
  if (!h || typeof h !== 'object') return null;
  const entry = {
    id: String(h.id || '').slice(0, 48) || null,
    opp: String(h.opp || h.oppName || '').slice(0, 32),
    oppName: String(h.oppName || h.opp || '').slice(0, 32),
    botId: h.botId ? String(h.botId).slice(0, 32) : null,
    mySkinId: h.mySkinId ? String(h.mySkinId).slice(0, 32) : undefined,
    myBoardId: h.myBoardId ? String(h.myBoardId).slice(0, 32) : undefined,
    oppSkinId: h.oppSkinId ? String(h.oppSkinId).slice(0, 32) : undefined,
    oppBoardId: h.oppBoardId ? String(h.oppBoardId).slice(0, 32) : undefined,
    my: Math.max(0, h.my | 0),
    oppScore: Math.max(0, (h.oppScore != null ? h.oppScore : h.opp) | 0),
    result: String(h.result || '').slice(0, 16),
    delta: (typeof h.delta === 'number') ? (h.delta | 0) : 0,
    mode: String(h.mode || '').slice(0, 16),
    difficulty: String(h.difficulty || '').slice(0, 32),
    duration: Math.max(0, h.duration | 0),
    timeLeft: Math.max(0, h.timeLeft | 0),
    date: h.date || null,
    reason: String(h.reason || 'normal').slice(0, 24)
  };
  // Keep full replay only for the most recent matches (moves can be large)
  if (Array.isArray(h.moves) && (idx == null || idx < 8)) {
    try {
      const raw = JSON.stringify(h.moves);
      if (raw.length <= 80000) {
        entry.moves = h.moves;
      } else {
        entry.moves = [];
      }
    } catch (_) {
      entry.moves = [];
    }
  } else {
    entry.moves = Array.isArray(h.moves) ? [] : undefined;
  }
  return entry;
}

/**
 * @param {import('./store').FileStore|import('./store').MemoryStore|import('./store').RedisStore} store
 */
function createAccounts(store) {
  if (!store) throw new Error('accounts: store required');

  /** True if code is already used by a registered account (or optionally live presence for NEW codes). */
  async function isFriendCodeTaken(code, opts) {
    opts = opts || {};
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code.length < 4) return true;
    try {
      const existing = await store.loadAccountByCode(code);
      if (existing) return true;
    } catch (_) {}
    // When generating a brand-new code, also avoid colliding with active/recent presence
    if (opts.checkPresence !== false) {
      try {
        if (typeof store.loadPresence === 'function') {
          const pres = await store.loadPresence(code);
          if (pres && (pres.name || pres.lastSeen || pres.online)) return true;
        }
      } catch (_) {}
      try {
        if (typeof store.loadProfile === 'function') {
          const prof = await store.loadProfile(code);
          if (prof && (prof.registered || prof.accountId)) return true;
        }
      } catch (_) {}
    }
    return false;
  }

  async function uniqueFriendCode() {
    const lengths = [6, 6, 6, 7, 8, 10];
    for (const len of lengths) {
      for (let i = 0; i < 48; i++) {
        const code = genFriendCode(len);
        if (!(await isFriendCodeTaken(code, { checkPresence: true }))) return code;
      }
    }
    // Last resort: time + random (still verified)
    for (let i = 0; i < 20; i++) {
      const code = (genFriendCode(6) + Date.now().toString(36).toUpperCase()).replace(/[^A-Z0-9]/g, '').slice(0, 10);
      if (!(await isFriendCodeTaken(code, { checkPresence: true }))) return code;
    }
    return genFriendCode(12);
  }

  /**
   * Prefer guest's existing friend code if it is not taken by another account.
   * Presence/profile under the same code is OK (this guest is claiming it).
   */
  async function resolveFriendCode(preferred) {
    const code = String(preferred || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (code && code.length >= 6) {
      try {
        const existing = await store.loadAccountByCode(code);
        if (!existing) return code.slice(0, 8); // free for this guest → keep
      } catch (_) {
        return code.slice(0, 8);
      }
    }
    return uniqueFriendCode();
  }

  function applyGuestProgressToAccount(acc, gp) {
    if (!acc || !gp || typeof gp !== 'object') return acc;
    try {
      if (typeof gp.trophies === 'number' && isFinite(gp.trophies)) {
        acc.trophies = Math.max(0, Math.min(999999, gp.trophies | 0));
      }
      if (typeof gp.diamonds === 'number' && isFinite(gp.diamonds)) {
        acc.diamonds = Math.max(0, Math.min(99999999, gp.diamonds | 0));
      }
      if (typeof gp.best === 'number' && isFinite(gp.best)) {
        acc.best = Math.max(0, Math.min(99999999, gp.best | 0));
      }
      if (Array.isArray(gp.ownedSkins) && gp.ownedSkins.length) {
        const free = ['default'];
        acc.ownedSkins = Array.from(new Set([...gp.ownedSkins.map(String).filter(Boolean), ...free])).slice(0, 64);
      }
      if (Array.isArray(gp.ownedBoards) && gp.ownedBoards.length) {
        const freeB = ['field_default'];
        acc.ownedBoards = Array.from(new Set([...gp.ownedBoards.map(String).filter(Boolean), ...freeB])).slice(0, 64);
      }
      if (gp.skinId) acc.skinId = String(gp.skinId).slice(0, 32);
      if (gp.boardId) acc.boardId = String(gp.boardId).slice(0, 32);
      // Nick is set at register (form nick || login) — never overwrite from guest.
      if (typeof gp.status === 'string') acc.status = String(gp.status).slice(0, 80);
      if (typeof gp.avatarId === 'string') acc.avatarId = String(gp.avatarId).slice(0, 32);
      if (typeof gp.avatarCustom === 'string') acc.avatarCustom = String(gp.avatarCustom).slice(0, 49152);
      if (Array.isArray(gp.friends) && gp.friends.length) {
        acc.friends = gp.friends.slice(0, 200);
      }
      if (Array.isArray(gp.history) && gp.history.length) {
        acc.history = gp.history.slice(0, 30);
      }
      if (gp.achievements && typeof gp.achievements === 'object') {
        acc.achievements = gp.achievements;
      }
      acc.updatedAt = Date.now();
    } catch (_) {}
    return acc;
  }

  async function register({ login, password, nick, guestProgress, preferredFriendCode }) {
    login = normalizeLogin(login);
    if (!validLogin(login)) {
      return { ok: false, error: 'bad_login', message: 'Логин: 3–24 символа (a-z, 0-9, _)' };
    }
    if (!validPassword(password)) {
      return { ok: false, error: 'bad_password', message: 'Пароль: минимум 6 символов' };
    }
    const taken = await store.loadAccountByLogin(login);
    if (taken) {
      return { ok: false, error: 'login_taken', message: 'Такой логин уже занят' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passHash = hashPassword(password, salt);
    const now = Date.now();
    // Keep guest friend code when free — friends list / presence stay linked
    const preferred = preferredFriendCode
      || (guestProgress && guestProgress.friendCode)
      || '';
    const friendCode = await resolveFriendCode(preferred);
    // Starter values only for pure new accounts (no guest to convert).
    // When converting a guest, guestProgress is the sole source of truth for progress.
    const hasGuest = !!(guestProgress && typeof guestProgress === 'object');
    let acc = {
      id: genId(),
      login,
      passSalt: salt,
      passHash,
      friendCode,
      nick: String(nick || login).slice(0, 24) || login,
      trophies: 0,
      diamonds: hasGuest ? 0 : 9999,
      best: 0,
      ownedSkins: ['default'],
      ownedBoards: ['field_default'],
      friends: [],
      history: [],
      achievements: {},
      avatarId: 'init',
      avatarCustom: '',
      status: '',
      skinId: 'default',
      boardId: 'field_default',
      createdAt: now,
      updatedAt: now
    };
    // Convert guest → registered: copy ALL progress fields from guest
    if (hasGuest) {
      acc = applyGuestProgressToAccount(acc, guestProgress);
      // Diamonds: use guest value when present (including 0). Starter 9999 only if field truly absent.
      if (typeof guestProgress.diamonds === 'number' && isFinite(guestProgress.diamonds)) {
        acc.diamonds = Math.max(0, Math.min(99999999, guestProgress.diamonds | 0));
      } else {
        // No diamond field in guest snapshot — starter pack once
        acc.diamonds = 9999;
      }
    }
    // Registration nick always wins: explicit form nick, otherwise login
    const regNick = String(nick || login).slice(0, 24) || login;
    acc.nick = regNick;
    await store.saveAccount(acc);
    const token = genSessionToken();
    await store.saveSession(token, acc.id, SESSION_TTL_SEC);
    return { ok: true, token, account: publicAccount(acc) };
  }

  async function login({ login, password }) {
    login = normalizeLogin(login);
    if (!validLogin(login) || !validPassword(password)) {
      return { ok: false, error: 'bad_credentials', message: 'Неверный логин или пароль' };
    }
    const acc = await store.loadAccountByLogin(login);
    if (!acc || !verifyPassword(password, acc.passSalt, acc.passHash)) {
      return { ok: false, error: 'bad_credentials', message: 'Неверный логин или пароль' };
    }
    const token = genSessionToken();
    await store.saveSession(token, acc.id, SESSION_TTL_SEC);
    return { ok: true, token, account: publicAccount(acc) };
  }

  async function logout(token) {
    if (token) await store.deleteSession(token);
    return { ok: true };
  }

  /**
   * Permanently delete account. Requires valid session AND password confirmation.
   * @param {string} token
   * @param {{ password?: string }} [opts]
   */
  async function deleteAccount(token, opts) {
    opts = opts || {};
    const acc = await resolveSession(token);
    if (!acc) {
      return { ok: false, error: 'unauthorized', message: 'Требуется вход' };
    }
    // Password is mandatory for irreversible account deletion
    const password = typeof opts.password === 'string' ? opts.password : '';
    if (!password.length) {
      return { ok: false, error: 'password_required', message: 'Введите пароль для удаления аккаунта' };
    }
    if (!verifyPassword(password, acc.passSalt, acc.passHash)) {
      return { ok: false, error: 'bad_password', message: 'Неверный пароль' };
    }
    const friendCode = acc.friendCode ? String(acc.friendCode).toUpperCase() : null;
    // Snapshot of this account's friends so server can notify them
    const hadFriends = Array.isArray(acc.friends)
      ? acc.friends.map((f) => String((f && f.code) || '').toUpperCase()).filter(Boolean)
      : [];
    if (typeof store.deleteAccount === 'function') {
      await store.deleteAccount(acc);
    }
    // Clean presence + cosmetics profile so the friend code does not linger
    try {
      if (friendCode && typeof store.deletePresence === 'function') {
        await store.deletePresence(friendCode);
      } else if (friendCode && typeof store.savePresence === 'function') {
        await store.savePresence(friendCode, {}, 1);
      }
    } catch (_) {}
    try {
      if (friendCode && typeof store.deleteProfile === 'function') {
        await store.deleteProfile(friendCode);
      } else if (friendCode && typeof store.saveProfile === 'function') {
        await store.saveProfile(friendCode, {}, 1);
      }
    } catch (_) {}
    // Remove this player from every other account's friends list
    let purgedFrom = 0;
    try {
      if (friendCode && typeof store.purgeFriendFromAllAccounts === 'function') {
        purgedFrom = await store.purgeFriendFromAllAccounts(friendCode) || 0;
      }
    } catch (_) {}
    if (token) await store.deleteSession(token);
    return {
      ok: true,
      deleted: true,
      id: acc.id,
      friendCode: friendCode || null,
      hadFriends,
      purgedFrom
    };
  }

  async function resolveSession(token) {
    if (!token) return null;
    const accountId = await store.loadSession(token);
    if (!accountId) return null;
    const acc = await store.loadAccountById(accountId);
    if (!acc) return null;
    return acc;
  }

  async function updateAccount(acc, patch) {
    if (!acc || !patch) return publicAccount(acc);
    if (typeof patch.nick === 'string') {
      const n = patch.nick.trim().slice(0, 24);
      if (n) acc.nick = n;
    }
    if (typeof patch.status === 'string') acc.status = patch.status.slice(0, 80);
    if (typeof patch.avatarId === 'string') acc.avatarId = patch.avatarId.slice(0, 32);
    if (typeof patch.avatarCustom === 'string') {
      acc.avatarCustom = patch.avatarCustom.slice(0, 49152);
    }
    if (typeof patch.skinId === 'string') acc.skinId = patch.skinId.slice(0, 32);
    if (typeof patch.boardId === 'string') acc.boardId = patch.boardId.slice(0, 32);
    if (typeof patch.trophies === 'number' && isFinite(patch.trophies)) {
      acc.trophies = Math.max(0, Math.min(999999, patch.trophies | 0));
    }
    if (typeof patch.diamonds === 'number' && isFinite(patch.diamonds)) {
      acc.diamonds = Math.max(0, Math.min(99999999, patch.diamonds | 0));
    }
    if (typeof patch.best === 'number' && isFinite(patch.best)) {
      acc.best = Math.max(0, Math.min(99999999, patch.best | 0));
    }
    if (Array.isArray(patch.ownedSkins)) {
      acc.ownedSkins = patch.ownedSkins.map(String).filter(Boolean).slice(0, 64);
    }
    if (Array.isArray(patch.ownedBoards)) {
      acc.ownedBoards = patch.ownedBoards.map(String).filter(Boolean).slice(0, 64);
    }
    if (Array.isArray(patch.friends)) {
      acc.friends = patch.friends.slice(0, 200).map((f) => ({
        code: String((f && f.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
        name: String((f && f.name) || '').slice(0, 24),
        trophies: (f && typeof f.trophies === 'number') ? Math.max(0, f.trophies | 0) : undefined,
        avatarId: (f && f.avatarId) ? String(f.avatarId).slice(0, 32) : undefined,
        avatarCustom: (f && typeof f.avatarCustom === 'string') ? f.avatarCustom.slice(0, 49152) : undefined,
        added: (f && f.added) || Date.now()
      })).filter((f) => f.code && f.code.length >= 4);
    }
    if (Array.isArray(patch.history)) {
      acc.history = patch.history.slice(0, 30).map(sanitizeHistoryEntry).filter(Boolean);
    }
    if (patch.achievements && typeof patch.achievements === 'object' && !Array.isArray(patch.achievements)) {
      const next = {};
      const keys = Object.keys(patch.achievements).slice(0, 250);
      for (const k of keys) {
        const v = patch.achievements[k];
        if (typeof v === 'number' && isFinite(v)) next[String(k).slice(0, 48)] = v;
        else if (typeof v === 'boolean') next[String(k).slice(0, 48)] = v ? 1 : 0;
        else if (typeof v === 'string') next[String(k).slice(0, 48)] = v.slice(0, 64);
      }
      acc.achievements = next;
    }
    acc.updatedAt = Date.now();
    await store.saveAccount(acc);
    return publicAccount(acc);
  }

  return {
    register,
    login,
    logout,
    deleteAccount,
    resolveSession,
    updateAccount,
    publicAccount,
    uniqueFriendCode,
    isFriendCodeTaken,
    resolveFriendCode,
    SESSION_TTL_SEC
  };
}

module.exports = {
  createAccounts,
  publicAccount,
  genFriendCode,
  normalizeLogin,
  validLogin,
  validPassword,
  SESSION_TTL_SEC
};
