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
  return {
    id: acc.id,
    login: acc.login,
    friendCode: acc.friendCode,
    nick: acc.nick || 'Игрок',
    trophies: Math.max(0, acc.trophies | 0),
    avatarId: acc.avatarId || 'init',
    avatarCustom: typeof acc.avatarCustom === 'string' ? acc.avatarCustom : '',
    status: acc.status || '',
    skinId: acc.skinId || 'default',
    boardId: acc.boardId || 'field_default',
    createdAt: acc.createdAt || null,
    updatedAt: acc.updatedAt || null
  };
}

/**
 * @param {import('./store').FileStore|import('./store').MemoryStore|import('./store').RedisStore} store
 */
function createAccounts(store) {
  if (!store) throw new Error('accounts: store required');

  async function uniqueFriendCode() {
    for (let i = 0; i < 40; i++) {
      const code = genFriendCode(6);
      const existing = await store.loadAccountByCode(code);
      if (!existing) return code;
    }
    return genFriendCode(8);
  }

  async function register({ login, password, nick }) {
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
    const friendCode = await uniqueFriendCode();
    const acc = {
      id: genId(),
      login,
      passSalt: salt,
      passHash,
      friendCode,
      nick: String(nick || login).slice(0, 24) || login,
      trophies: 0,
      avatarId: 'init',
      avatarCustom: '',
      status: '',
      skinId: 'default',
      boardId: 'field_default',
      createdAt: now,
      updatedAt: now
    };
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
    acc.updatedAt = Date.now();
    await store.saveAccount(acc);
    return publicAccount(acc);
  }

  return {
    register,
    login,
    logout,
    resolveSession,
    updateAccount,
    publicAccount,
    SESSION_TTL_SEC
  };
}

module.exports = {
  createAccounts,
  publicAccount,
  normalizeLogin,
  validLogin,
  validPassword,
  SESSION_TTL_SEC
};
