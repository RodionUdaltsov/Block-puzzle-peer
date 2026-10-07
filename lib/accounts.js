/**
 * Account registry — zero-deps (Node crypto).
 * Passwords: scrypt. Sessions: opaque tokens in store.
 */
'use strict';
const { clock } = require('./clock');
const { withKeyLock, normKey } = require('./keyed-lock');

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
  len = len || 8; // canonical friend code length
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// scrypt runs on the libuv thread pool. Async (never scryptSync, which freezes
// the whole event loop ~50 ms per call) and capped so a login flood cannot
// starve file/DNS/Postgres I/O that shares the same pool.
const SCRYPT_MAX_PARALLEL = Math.max(1, Number(process.env.BP_SCRYPT_PARALLEL) || 2);
const SCRYPT_MAX_QUEUE = Math.max(8, Number(process.env.BP_SCRYPT_QUEUE) || 64);
let _scryptActive = 0;
/** @type {Array<() => void>} */
const _scryptWaiters = [];

function scryptRaw(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function scryptLimited(password, salt) {
  if (_scryptActive >= SCRYPT_MAX_PARALLEL) {
    if (_scryptWaiters.length >= SCRYPT_MAX_QUEUE) {
      const e = new Error('busy');
      e.code = 'busy';
      throw e;
    }
    await new Promise((resolve) => _scryptWaiters.push(resolve));
  } else {
    _scryptActive += 1;
  }
  try {
    return await scryptRaw(password, salt);
  } finally {
    const next = _scryptWaiters.shift();
    if (next) next(); // hand the slot over (active count unchanged)
    else _scryptActive -= 1;
  }
}

async function hashPassword(password, salt) {
  return (await scryptLimited(password, salt)).toString('hex');
}

async function verifyPassword(password, salt, hash) {
  try {
    const a = Buffer.from(await hashPassword(password, salt), 'hex');
    const b = Buffer.from(String(hash || ''), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    if (e && e.code === 'busy') throw e;
    return false;
  }
}

// Unknown login must cost the same as a wrong password, otherwise response
// time reveals which logins exist.
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = crypto.randomBytes(64).toString('hex');
async function burnPasswordCheck(password) {
  try { await verifyPassword(password, DUMMY_SALT, DUMMY_HASH); } catch (_) {}
}

const BUSY_RESULT = { ok: false, error: 'busy', message: 'Сервер перегружен, попробуйте через несколько секунд' };

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
  let botStars = {};
  try {
    if (acc.botStars && typeof acc.botStars === 'object' && !Array.isArray(acc.botStars)) {
      const ids = Object.keys(acc.botStars).slice(0, 200);
      for (const id of ids) {
        const bid = String(id).slice(0, 32);
        const st = acc.botStars[id];
        if (!st || typeof st !== 'object') continue;
        const entry = {};
        if (st['60']) entry['60'] = true;
        if (st['120']) entry['120'] = true;
        if (st['180']) entry['180'] = true;
        if (Object.keys(entry).length) botStars[bid] = entry;
      }
    }
  } catch (_) { botStars = {}; }
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
    classicSave: acc.classicSave && typeof acc.classicSave === 'object' ? acc.classicSave : null,
    ownedSkins,
    ownedBoards,
    friends,
    history,
    achievements,
    botStars,
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

/** Union two history lists by match id (incoming wins), newest first, capped at 30. */
function mergeHistory(existing, incoming) {
  const map = new Map();
  const put = (raw, tag, i) => {
    const h = sanitizeHistoryEntry(raw, 0);
    if (!h) return;
    const key = h.id || (tag + ':' + (h.date || 0) + ':' + h.oppName + ':' + h.my + ':' + h.oppScore + ':' + (h.id ? '' : i));
    map.set(key, h);
  };
  (Array.isArray(existing) ? existing : []).slice(0, 30).forEach((h, i) => put(h, 'e', 0));
  (Array.isArray(incoming) ? incoming : []).slice(0, 30).forEach((h, i) => put(h, 'e', 0));
  const dateNum = (h) => (typeof h.date === 'number' ? h.date : (Date.parse(h.date) || 0));
  return Array.from(map.values())
    .sort((a, b) => dateNum(b) - dateNum(a))
    .slice(0, 30)
    .map((h, idx) => sanitizeHistoryEntry(h, idx))
    .filter(Boolean);
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
    // Tombstoned codes are treated as taken until the tombstone expires
    try {
      if (typeof store.isDeletedCode === 'function') {
        if (await store.isDeletedCode(code)) return true;
      }
    } catch (_) {}
    try {
      const existing = await store.loadAccountByCode(code);
      if (existing) return true;
    } catch (_) {}
    // When generating a brand-new code, avoid colliding with truly active presence
    // or a registered profile. Stale presence (lastSeen > 24h / offline) must NOT
    // permanently block the code — that was causing "dead" codes that could never
    // be reassigned after a soft guest session.
    if (opts.checkPresence !== false) {
      try {
        if (typeof store.loadPresence === 'function') {
          const pres = await store.loadPresence(code);
          if (pres) {
            const now = clock.now();
            const last = Number(pres.lastSeen || pres.ts || 0) || 0;
            const online = !!(pres.online || pres.activity === 'online' || pres.activity === 'in_match');
            const recent = last && (now - last < 24 * 3600 * 1000);
            if (online || recent) return true;
          }
        }
      } catch (_) {}
      try {
        if (typeof store.loadProfile === 'function') {
          const prof = await store.loadProfile(code);
          // Only block if profile is tied to a registered account
          if (prof && (prof.registered || prof.accountId)) return true;
        }
      } catch (_) {}
      try {
        if (typeof store.loadGuestProgress === 'function') {
          const gp = await store.loadGuestProgress(code);
          if (gp) return true;
        }
      } catch (_) {}
    }
    return false;
  }

  async function uniqueFriendCode() {
    // Always exactly 8 characters
    for (let i = 0; i < 96; i++) {
      const code = genFriendCode(8);
      if (!(await isFriendCodeTaken(code, { checkPresence: true }))) return code;
    }
    // Last resort: mix time entropy, still 8 chars
    for (let i = 0; i < 32; i++) {
      const mix = (genFriendCode(6) + clock.now().toString(36).toUpperCase()).replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (mix.length === 8 && !(await isFriendCodeTaken(mix, { checkPresence: true }))) return mix;
    }
    return genFriendCode(8);
  }

  /**
   * Prefer guest's existing friend code if it is not taken by another account.
   * Presence/profile under the same code is OK (this guest is claiming it).
   */
  async function resolveFriendCode(preferred) {
    const code = String(preferred || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    // Only keep preferred if it is already a full 8-char code and free
    if (code && code.length === 8) {
      try {
        const existing = await store.loadAccountByCode(code);
        if (!existing) return code;
      } catch (_) {
        return code;
      }
    }
    return uniqueFriendCode();
  }

  function applyGuestProgressToAccount(acc, gp) {
    if (!acc || !gp || typeof gp !== 'object') return acc;
    try {
      // Economy fields must already be server-authored (guest_progress / device bind).
      // Never expand ownership beyond free defaults + what was stored server-side.
      if (typeof gp.trophies === 'number' && isFinite(gp.trophies)) {
        acc.trophies = Math.max(0, Math.min(999999, gp.trophies | 0));
      }
      if (typeof gp.diamonds === 'number' && isFinite(gp.diamonds)) {
        acc.diamonds = Math.max(0, Math.min(99999999, gp.diamonds | 0));
      }
      if (typeof gp.best === 'number' && isFinite(gp.best)) {
        acc.best = Math.max(0, Math.min(99999999, gp.best | 0));
      }
      const FREE_S = new Set(['default']);
      const FREE_B = new Set(['field_default']);
      if (Array.isArray(gp.ownedSkins) && gp.ownedSkins.length) {
        // Caller must pass server-filtered list; still clamp to known-ish ids length
        acc.ownedSkins = Array.from(new Set(
          gp.ownedSkins.map(String).filter(Boolean).concat(['default'])
        )).slice(0, 64);
      }
      if (Array.isArray(gp.ownedBoards) && gp.ownedBoards.length) {
        acc.ownedBoards = Array.from(new Set(
          gp.ownedBoards.map(String).filter(Boolean).concat(['field_default'])
        )).slice(0, 64);
      }
      const ownedS = Array.isArray(acc.ownedSkins) ? acc.ownedSkins.map(String) : ['default'];
      const ownedB = Array.isArray(acc.ownedBoards) ? acc.ownedBoards.map(String) : ['field_default'];
      if (gp.skinId && ownedS.indexOf(String(gp.skinId)) !== -1) acc.skinId = String(gp.skinId).slice(0, 32);
      else acc.skinId = 'default';
      if (gp.boardId && ownedB.indexOf(String(gp.boardId)) !== -1) acc.boardId = String(gp.boardId).slice(0, 32);
      else acc.boardId = 'field_default';
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
      if (gp.botStars && typeof gp.botStars === 'object' && !Array.isArray(gp.botStars)) {
        if (!acc.botStars || typeof acc.botStars !== 'object') acc.botStars = {};
        for (const id of Object.keys(gp.botStars).slice(0, 200)) {
          const bid = String(id).slice(0, 32);
          const st = gp.botStars[id];
          if (!st || typeof st !== 'object') continue;
          if (!acc.botStars[bid]) acc.botStars[bid] = {};
          if (st['60']) acc.botStars[bid]['60'] = true;
          if (st['120']) acc.botStars[bid]['120'] = true;
          if (st['180']) acc.botStars[bid]['180'] = true;
        }
      }
      if (gp.classicSave && typeof gp.classicSave === 'object' && Array.isArray(gp.classicSave.grid)) {
        acc.classicSave = gp.classicSave;
      }
      acc.updatedAt = clock.now();
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
    let passHash;
    try { passHash = await hashPassword(password, salt); }
    catch (e) { if (e && e.code === 'busy') return BUSY_RESULT; throw e; }
    const now = clock.now();
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
      diamonds: 9999,
      best: 0,
      ownedSkins: ['default'],
      ownedBoards: ['field_default'],
      friends: [],
      history: [],
      achievements: {},
      botStars: {},
      avatarId: 'init',
      avatarCustom: '',
      status: '',
      skinId: 'default',
      boardId: 'field_default',
      createdAt: now,
      updatedAt: now
    };
    // Convert guest → registered: copy progress 1:1 (diamonds/skins/etc.)
    if (hasGuest) {
      // Start from 0 so applyGuestProgress is pure copy, not max with starter
      acc.diamonds = 0;
      acc.trophies = 0;
      acc.best = 0;
      acc = applyGuestProgressToAccount(acc, guestProgress);
      // Diamonds/trophies already taken from server guest layers only (no client override).
      acc.diamonds = Math.max(0, acc.diamonds | 0);
      acc.trophies = Math.max(0, acc.trophies | 0);
    }
    // Registration nick always wins: explicit form nick, otherwise login
    const regNick = String(nick || login).slice(0, 24) || login;
    acc.nick = regNick;
    // Preferred friend code can race with another concurrent registration.
    // On unique violation (23505) regenerate a free code and retry once.
    try {
      await store.saveAccount(acc);
    } catch (e) {
      const code = e && (e.code || e.constraint);
      const isUnique = code === '23505' || (e && /unique|duplicate/i.test(String(e.message || '')));
      if (isUnique && preferred) {
        acc.friendCode = await uniqueFriendCode();
        try {
          await store.saveAccount(acc);
        } catch (e2) {
          return { ok: false, error: 'friend_code_taken', message: 'Код друга уже занят, попробуйте ещё раз' };
        }
      } else if (isUnique) {
        return { ok: false, error: 'friend_code_taken', message: 'Код друга уже занят, попробуйте ещё раз' };
      } else {
        throw e;
      }
    }
    const token = genSessionToken();
    await store.saveSession(token, acc.id, SESSION_TTL_SEC);
    return { ok: true, token, account: publicAccount(acc) };
  }

  /**
   * Verify login/password without creating a session or touching device/guest data.
   * Used before the "guest progress will be wiped" confirmation.
   */
  async function checkCredentials({ login, password }) {
    login = normalizeLogin(login);
    if (!validLogin(login) || !validPassword(password)) {
      return { ok: false, error: 'bad_credentials', message: 'Неверный логин или пароль' };
    }
    const acc = await store.loadAccountByLogin(login);
    let passOk = false;
    try {
      if (acc) passOk = await verifyPassword(password, acc.passSalt, acc.passHash);
      else await burnPasswordCheck(password);
    } catch (e) {
      if (e && e.code === 'busy') return BUSY_RESULT;
      throw e;
    }
    if (!acc || !passOk) {
      return { ok: false, error: 'bad_credentials', message: 'Неверный логин или пароль' };
    }
    return {
      ok: true,
      account: {
        login: acc.login,
        friendCode: acc.friendCode ? String(acc.friendCode).toUpperCase() : null,
        nick: acc.nick || acc.login
      }
    };
  }

  async function login({ login, password }) {
    login = normalizeLogin(login);
    if (!validLogin(login) || !validPassword(password)) {
      return { ok: false, error: 'bad_credentials', message: 'Неверный логин или пароль' };
    }
    const acc = await store.loadAccountByLogin(login);
    let passOk = false;
    try {
      if (acc) passOk = await verifyPassword(password, acc.passSalt, acc.passHash);
      else await burnPasswordCheck(password);
    } catch (e) {
      if (e && e.code === 'busy') return BUSY_RESULT;
      throw e;
    }
    if (!acc || !passOk) {
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
    let delOk = false;
    try { delOk = await verifyPassword(password, acc.passSalt, acc.passHash); }
    catch (e) { if (e && e.code === 'busy') return BUSY_RESULT; throw e; }
    if (!delOk) {
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
    if (!acc) {
      // Account wiped from DB — drop orphan session so all devices deauth
      try {
        if (typeof store.deleteSession === 'function') await store.deleteSession(token);
      } catch (_) {}
      return null;
    }
    // Sliding expiration: each authenticated request extends session
    try {
      if (typeof store.saveSession === 'function') {
        await store.saveSession(token, accountId, SESSION_TTL_SEC);
      }
    } catch (_) {}
    return acc;
  }

  // Serialised per identity and applied to a FRESH copy of the row, so a concurrent buy / trophy
  // award cannot be overwritten by a stale full-row save.
  async function updateAccount(acc, patch) {
    if (!acc || !patch) return publicAccount(acc);
    return withKeyLock(normKey(acc.friendCode || acc.id), async () => {
      // Row-locked read-modify-write in the store (works across server instances too).
      if (acc.friendCode && typeof store.atomicAccountUpdate === 'function') {
        const out = await store.atomicAccountUpdate(acc.friendCode, (fresh) => {
          applyAccountPatch(fresh, patch);
          fresh.updatedAt = clock.now();
        });
        if (out) return publicAccount(out.account);
      }
      let fresh = null;
      try {
        if (acc.friendCode && typeof store.loadAccountByCode === 'function') fresh = await store.loadAccountByCode(acc.friendCode);
      } catch (_) { fresh = null; }
      return updateAccountUnlocked(fresh || acc, patch);
    });
  }

  async function updateAccountUnlocked(acc, patch) {
    applyAccountPatch(acc, patch);
    acc.updatedAt = clock.now();
    await store.saveAccount(acc);
    return publicAccount(acc);
  }

  /** Pure, synchronous: applies the client patch onto `acc` (no I/O — may run under a row lock). */
  function applyAccountPatch(acc, patch) {
    if (typeof patch.nick === 'string') {
      const n = patch.nick.trim().slice(0, 24);
      if (n) acc.nick = n;
    }
    if (typeof patch.status === 'string') acc.status = patch.status.slice(0, 80);
    if (typeof patch.avatarId === 'string') acc.avatarId = patch.avatarId.slice(0, 32);
    if (typeof patch.avatarCustom === 'string') {
      acc.avatarCustom = patch.avatarCustom.slice(0, 49152);
    }
    // Equip hints from client: only accept if already owned on server
    if (typeof patch.skinId === 'string') {
      const sid = patch.skinId.slice(0, 32);
      const owned = Array.isArray(acc.ownedSkins) ? acc.ownedSkins.map(String) : [];
      if (sid === 'default' || owned.indexOf(sid) !== -1) acc.skinId = sid;
    }
    if (typeof patch.boardId === 'string') {
      const bid = patch.boardId.slice(0, 32);
      const ownedB = Array.isArray(acc.ownedBoards) ? acc.ownedBoards.map(String) : [];
      if (bid === 'field_default' || ownedB.indexOf(bid) !== -1) acc.boardId = bid;
    }
    // Trophies / diamonds / ownership: server-authoritative only.
    // Client PATCH cannot raise trophies, change diamonds, or grant skins/boards.
    // if (typeof patch.trophies === 'number') { ignored }
    // if (typeof patch.diamonds === 'number') { ignored }
    // if (Array.isArray(patch.ownedSkins)) { ignored }
    // if (Array.isArray(patch.ownedBoards)) { ignored }
    if (typeof patch.best === 'number' && isFinite(patch.best)) {
      // best score: only allow non-decreasing from client (anti-cheat soft)
      const cur = Math.max(0, acc.best | 0);
      const next = Math.max(0, Math.min(99999999, patch.best | 0));
      if (next > cur) acc.best = next;
    }
    if (Array.isArray(patch.friends)) {
      acc.friends = patch.friends.slice(0, 200).map((f) => ({
        code: String((f && f.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
        name: String((f && f.name) || '').slice(0, 24),
        trophies: (f && typeof f.trophies === 'number') ? Math.max(0, f.trophies | 0) : undefined,
        avatarId: (f && f.avatarId) ? String(f.avatarId).slice(0, 32) : undefined,
        avatarCustom: (f && typeof f.avatarCustom === 'string') ? f.avatarCustom.slice(0, 49152) : undefined,
        added: (f && f.added) || clock.now()
      })).filter((f) => f.code && f.code.length >= 4);
    }
    if (Array.isArray(patch.history)) {
      // Union by match id (never a blind replace): a stale / freshly-booted client sending an
      // empty or shorter list must not erase matches that are already stored on the account.
      acc.history = mergeHistory(acc.history, patch.history);
    }
    if (patch.achievements && typeof patch.achievements === 'object' && !Array.isArray(patch.achievements)) {
      // Start from what the account already has: keys missing from the patch are kept
      const next = {};
      if (acc.achievements && typeof acc.achievements === 'object' && !Array.isArray(acc.achievements)) {
        for (const k of Object.keys(acc.achievements).slice(0, 250)) next[k] = acc.achievements[k];
      }
      const keys = Object.keys(patch.achievements).slice(0, 250);
      for (const k of keys) {
        const v = patch.achievements[k];
        if (typeof v === 'number' && isFinite(v)) next[String(k).slice(0, 48)] = v;
        else if (typeof v === 'boolean') next[String(k).slice(0, 48)] = v ? 1 : 0;
        else if (typeof v === 'string') next[String(k).slice(0, 48)] = v.slice(0, 64);
      }
      acc.achievements = next;
    }
    if (patch.classicSave === null) {
      acc.classicSave = null;
    } else if (patch.classicSave && typeof patch.classicSave === 'object') {
      // Compact classic board snapshot (grid + pieces + score)
      try {
        const cs = patch.classicSave;
        const grid = Array.isArray(cs.grid) ? cs.grid.slice(0, 12) : null;
        if (grid && grid.length >= 8) {
          acc.classicSave = {
            grid: grid.map((row) => Array.isArray(row) ? row.slice(0, 12).map((c) => (c == null ? null : String(c).slice(0, 24))) : []),
            score: typeof cs.score === 'number' ? Math.max(0, cs.score | 0) : 0,
            diamonds: typeof cs.diamonds === 'number' ? Math.max(0, cs.diamonds | 0) : undefined,
            pieces: Array.isArray(cs.pieces) ? cs.pieces.slice(0, 6).map((p) => ({
              shape: Array.isArray(p && p.shape) ? p.shape.slice(0, 16).map((c) => Array.isArray(c) ? [c[0]|0, c[1]|0] : c) : [],
              color: p && p.color ? String(p.color).slice(0, 24) : '',
              used: !!(p && p.used)
            })) : [],
            t: clock.now()
          };
        }
      } catch (_) {}
    }
    if (patch.botStars && typeof patch.botStars === 'object' && !Array.isArray(patch.botStars)) {
      // Silver stars are monotonic (a won star is never taken back): union with what is stored
      const next = {};
      if (acc.botStars && typeof acc.botStars === 'object' && !Array.isArray(acc.botStars)) {
        for (const id of Object.keys(acc.botStars).slice(0, 200)) {
          const st = acc.botStars[id];
          if (!st || typeof st !== 'object') continue;
          const entry = {};
          if (st['60']) entry['60'] = true;
          if (st['120']) entry['120'] = true;
          if (st['180']) entry['180'] = true;
          if (Object.keys(entry).length) next[String(id).slice(0, 32)] = entry;
        }
      }
      const ids = Object.keys(patch.botStars).slice(0, 200);
      for (const id of ids) {
        const bid = String(id).slice(0, 32);
        const st = patch.botStars[id];
        if (!st || typeof st !== 'object') continue;
        const entry = Object.assign({}, next[bid] || {});
        if (st['60']) entry['60'] = true;
        if (st['120']) entry['120'] = true;
        if (st['180']) entry['180'] = true;
        if (Object.keys(entry).length) next[bid] = entry;
      }
      acc.botStars = next;
    }
  }

  return {
    register,
    login,
    checkCredentials,
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
  mergeHistory,
  publicAccount,
  genFriendCode,
  normalizeLogin,
  validLogin,
  validPassword,
  SESSION_TTL_SEC
};
