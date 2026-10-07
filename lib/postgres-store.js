/**
 * PostgreSQL store for Block Puzzle — production durable backend.
 *
 * Implements the same interface as MemoryStore / FileStore / RedisStore.
 * Env: DATABASE_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
 *
 * Ephemeral data (rooms, tokens, queue, live presence) can still use Redis
 * in hybrid mode; this store is the source of truth for accounts, sessions,
 * cosmetics profiles, social, and long-lived presence.
 */
'use strict';

const { clock } = require('./clock');
const ROOM_TTL_LIVE = 60 * 60;
const ROOM_TTL_ENDED = 180;
const TOKEN_TTL = 60 * 60;
const QUEUE_TTL = 2 * 60;
const PRESENCE_TTL = 7 * 24 * 3600;
const PROFILE_TTL = 365 * 24 * 3600;
const SESSION_TTL_DEFAULT = 30 * 24 * 3600;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id             TEXT PRIMARY KEY,
  login          TEXT NOT NULL UNIQUE,
  pass_salt      TEXT NOT NULL,
  pass_hash      TEXT NOT NULL,
  friend_code    TEXT NOT NULL UNIQUE,
  nick           TEXT NOT NULL DEFAULT '',
  trophies       INTEGER NOT NULL DEFAULT 0,
  diamonds       INTEGER NOT NULL DEFAULT 0,
  best           INTEGER NOT NULL DEFAULT 0,
  owned_skins    JSONB NOT NULL DEFAULT '["default"]'::jsonb,
  owned_boards   JSONB NOT NULL DEFAULT '["field_default"]'::jsonb,
  friends        JSONB NOT NULL DEFAULT '[]'::jsonb,
  history        JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements   JSONB NOT NULL DEFAULT '{}'::jsonb,
  bot_stars      JSONB NOT NULL DEFAULT '{}'::jsonb,
  avatar_id      TEXT NOT NULL DEFAULT 'init',
  avatar_custom  TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT '',
  skin_id        TEXT NOT NULL DEFAULT 'default',
  board_id       TEXT NOT NULL DEFAULT 'field_default',
  classic_save   JSONB,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_login_lower ON accounts (lower(login));
CREATE INDEX IF NOT EXISTS idx_accounts_friend_code ON accounts (friend_code);
CREATE INDEX IF NOT EXISTS idx_accounts_nick_lower ON accounts (lower(nick));

CREATE TABLE IF NOT EXISTS sessions (
  token        TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  exp          BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions (exp);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions (account_id);

CREATE TABLE IF NOT EXISTS profiles (
  friend_code     TEXT PRIMARY KEY,
  diamonds        INTEGER NOT NULL DEFAULT 9999,
  owned_skins     JSONB NOT NULL DEFAULT '["default"]'::jsonb,
  owned_boards    JSONB NOT NULL DEFAULT '["field_default"]'::jsonb,
  equipped_skin   TEXT NOT NULL DEFAULT 'default',
  equipped_board  TEXT NOT NULL DEFAULT 'field_default',
  migrated        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      BIGINT NOT NULL,
  exp             BIGINT
);
CREATE INDEX IF NOT EXISTS idx_profiles_exp ON profiles (exp) WHERE exp IS NOT NULL;

CREATE TABLE IF NOT EXISTS guest_progress (
  friend_code   TEXT PRIMARY KEY,
  data          JSONB NOT NULL,
  updated_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS presence (
  friend_code   TEXT PRIMARY KEY,
  data          JSONB NOT NULL,
  exp           BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presence_exp ON presence (exp);

CREATE TABLE IF NOT EXISTS social (
  friend_code   TEXT PRIMARY KEY,
  messages      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  data          JSONB NOT NULL,
  exp           BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rooms_exp ON rooms (exp);

CREATE TABLE IF NOT EXISTS tokens (
  token         TEXT PRIMARY KEY,
  match_id      TEXT NOT NULL,
  exp           BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_exp ON tokens (exp);

CREATE TABLE IF NOT EXISTS queue (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  entries       JSONB NOT NULL DEFAULT '[]'::jsonb,
  exp           BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_binds (
  device_id       TEXT PRIMARY KEY,
  account_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
  guest_progress  JSONB,
  updated_at      BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_binds_updated ON device_binds (updated_at);

CREATE TABLE IF NOT EXISTS deleted_codes (
  friend_code   TEXT PRIMARY KEY,
  reason        TEXT NOT NULL DEFAULT 'account_deleted',
  deleted_at    BIGINT NOT NULL,
  exp           BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deleted_codes_exp ON deleted_codes (exp);
`;

function nowMs() {
  return clock.now();
}

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

function normalizeDeviceId(raw) {
  const s = String(raw || '').trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(s)) return '';
  return s;
}

function profileFromRow(r) {
  return {
    diamonds: r.diamonds | 0,
    ownedSkins: Array.isArray(r.owned_skins) ? r.owned_skins : [],
    ownedBoards: Array.isArray(r.owned_boards) ? r.owned_boards : [],
    equippedSkin: r.equipped_skin || 'default',
    equippedBoard: r.equipped_board || 'field_default',
    migrated: !!r.migrated,
    updatedAt: Number(r.updated_at) || 0
  };
}

function rowToAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    login: row.login,
    passSalt: row.pass_salt,
    passHash: row.pass_hash,
    friendCode: row.friend_code,
    nick: row.nick || '',
    trophies: row.trophies | 0,
    diamonds: row.diamonds | 0,
    best: row.best | 0,
    ownedSkins: Array.isArray(row.owned_skins) ? row.owned_skins : (row.owned_skins || []),
    ownedBoards: Array.isArray(row.owned_boards) ? row.owned_boards : (row.owned_boards || []),
    friends: Array.isArray(row.friends) ? row.friends : (row.friends || []),
    history: Array.isArray(row.history) ? row.history : (row.history || []),
    achievements: row.achievements && typeof row.achievements === 'object' ? row.achievements : {},
    botStars: row.bot_stars && typeof row.bot_stars === 'object' ? row.bot_stars : {},
    avatarId: row.avatar_id || 'init',
    avatarCustom: row.avatar_custom || '',
    status: row.status || '',
    skinId: row.skin_id || 'default',
    boardId: row.board_id || 'field_default',
    classicSave: row.classic_save && typeof row.classic_save === 'object' ? row.classic_save : null,
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0
  };
}

class PostgresStore {
  constructor(pool) {
    this.kind = 'postgres';
    this.pool = pool;
    this._cleanupTimer = null;
  }

  async init() {
    const client = await this.pool.connect();
    try {
      await client.query(SCHEMA_SQL);
      // Soft migrate: add bot_stars if upgrading from older schema
      try {
        await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bot_stars JSONB NOT NULL DEFAULT '{}'::jsonb");
      } catch (_) {}
      try {
        await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS classic_save JSONB");
      } catch (_) {}
      // Safety net: even a buggy code path cannot persist a negative balance.
      for (const [tbl, col] of [['accounts', 'diamonds'], ['accounts', 'trophies'], ['profiles', 'diamonds']]) {
        try {
          const name = tbl + '_' + col + '_nonneg';
          await client.query('UPDATE ' + tbl + ' SET ' + col + ' = 0 WHERE ' + col + ' < 0');
          await client.query(
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '" + name + "') THEN " +
            'ALTER TABLE ' + tbl + ' ADD CONSTRAINT ' + name + ' CHECK (' + col + ' >= 0); END IF; END $$'
          );
        } catch (_) {}
      }
      try {
        await client.query(`CREATE TABLE IF NOT EXISTS device_binds (
          device_id       TEXT PRIMARY KEY,
          account_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
          guest_progress  JSONB,
          updated_at      BIGINT NOT NULL
        )`);
        await client.query('CREATE INDEX IF NOT EXISTS idx_device_binds_updated ON device_binds (updated_at)');
      } catch (_) {}
    } finally {
      client.release();
    }
    // Periodic TTL cleanup (rooms, tokens, sessions, presence, profiles)
    this._cleanupTimer = clock.setInterval(() => {
      this._purgeExpired().catch(() => {});
    }, 60 * 1000);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    return this;
  }

  async _purgeExpired() {
    const t = nowMs();
    await this.pool.query('DELETE FROM rooms WHERE exp < $1', [t]);
    await this.pool.query('DELETE FROM tokens WHERE exp < $1', [t]);
    await this.pool.query('DELETE FROM sessions WHERE exp < $1', [t]);
    await this.pool.query('DELETE FROM presence WHERE exp < $1', [t]);
    await this.pool.query('DELETE FROM profiles WHERE exp IS NOT NULL AND exp < $1', [t]);
    await this.pool.query('DELETE FROM queue WHERE exp < $1', [t]);
  }

  // ── Rooms ──────────────────────────────────────────────────────────
  async saveRoom(id, data, ttlSec) {
    if (!id) return;
    const exp = nowMs() + (ttlSec || ROOM_TTL_LIVE) * 1000;
    await this.pool.query(
      `INSERT INTO rooms (id, data, exp) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, exp = EXCLUDED.exp`,
      [String(id), JSON.stringify(data), exp]
    );
  }

  async loadRoom(id) {
    if (!id) return null;
    const { rows } = await this.pool.query(
      'SELECT data, exp FROM rooms WHERE id = $1',
      [String(id)]
    );
    if (!rows[0]) return null;
    if (rows[0].exp && nowMs() > Number(rows[0].exp)) {
      await this.deleteRoom(id);
      return null;
    }
    return rows[0].data;
  }

  async deleteRoom(id) {
    if (!id) return;
    await this.pool.query('DELETE FROM rooms WHERE id = $1', [String(id)]);
  }

  async listRoomIds() {
    const t = nowMs();
    const { rows } = await this.pool.query(
      'SELECT id FROM rooms WHERE exp >= $1',
      [t]
    );
    return rows.map((r) => r.id);
  }

  // ── Tokens ─────────────────────────────────────────────────────────
  async bindToken(token, matchId, ttlSec) {
    if (!token || !matchId) return;
    const exp = nowMs() + (ttlSec || TOKEN_TTL) * 1000;
    await this.pool.query(
      `INSERT INTO tokens (token, match_id, exp) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET match_id = EXCLUDED.match_id, exp = EXCLUDED.exp`,
      [String(token), String(matchId), exp]
    );
  }

  async unbindToken(token) {
    if (!token) return;
    await this.pool.query('DELETE FROM tokens WHERE token = $1', [String(token)]);
  }

  async tokenMatch(token) {
    if (!token) return null;
    const { rows } = await this.pool.query(
      'SELECT match_id, exp FROM tokens WHERE token = $1',
      [String(token)]
    );
    if (!rows[0]) return null;
    if (rows[0].exp && nowMs() > Number(rows[0].exp)) {
      await this.unbindToken(token);
      return null;
    }
    return rows[0].match_id;
  }

  // ── Social ─────────────────────────────────────────────────────────
  async getSocial(code) {
    const c = normalizeCode(code);
    if (!c) return [];
    const { rows } = await this.pool.query(
      'SELECT messages FROM social WHERE friend_code = $1',
      [c]
    );
    if (!rows[0]) return [];
    const arr = rows[0].messages;
    return Array.isArray(arr) ? arr : [];
  }

  async setSocial(code, arr) {
    const c = normalizeCode(code);
    if (!c) return;
    if (!arr || !arr.length) {
      await this.pool.query('DELETE FROM social WHERE friend_code = $1', [c]);
      return;
    }
    const sliced = arr.slice(-50);
    await this.pool.query(
      `INSERT INTO social (friend_code, messages, updated_at) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (friend_code) DO UPDATE SET messages = EXCLUDED.messages, updated_at = EXCLUDED.updated_at`,
      [c, JSON.stringify(sliced), nowMs()]
    );
  }

  // ── Queue ──────────────────────────────────────────────────────────
  async saveQueue(entries, ttlSec) {
    const exp = nowMs() + (ttlSec || QUEUE_TTL) * 1000;
    const list = Array.isArray(entries) ? entries : [];
    await this.pool.query(
      `INSERT INTO queue (id, entries, exp) VALUES (1, $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET entries = EXCLUDED.entries, exp = EXCLUDED.exp`,
      [JSON.stringify(list), exp]
    );
  }

  async loadQueue() {
    const { rows } = await this.pool.query('SELECT entries, exp FROM queue WHERE id = 1');
    if (!rows[0]) return [];
    if (rows[0].exp && nowMs() > Number(rows[0].exp)) {
      await this.pool.query('DELETE FROM queue WHERE id = 1');
      return [];
    }
    const arr = rows[0].entries;
    return Array.isArray(arr) ? arr.slice() : [];
  }

  // ── Presence ───────────────────────────────────────────────────────
  async savePresence(code, data, ttlSec) {
    const c = normalizeCode(code);
    if (!c) return;
    const exp = nowMs() + (ttlSec || PRESENCE_TTL) * 1000;
    await this.pool.query(
      `INSERT INTO presence (friend_code, data, exp) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (friend_code) DO UPDATE SET data = EXCLUDED.data, exp = EXCLUDED.exp`,
      [c, JSON.stringify(data || {}), exp]
    );
  }

  async loadPresence(code) {
    const c = normalizeCode(code);
    if (!c) return null;
    const { rows } = await this.pool.query(
      'SELECT data, exp FROM presence WHERE friend_code = $1',
      [c]
    );
    if (!rows[0]) return null;
    if (rows[0].exp && nowMs() > Number(rows[0].exp)) {
      await this.deletePresence(c);
      return null;
    }
    return rows[0].data;
  }

  async listPresenceCodes() {
    const t = nowMs();
    const { rows } = await this.pool.query(
      'SELECT friend_code FROM presence WHERE exp >= $1',
      [t]
    );
    return rows.map((r) => r.friend_code);
  }

  async deletePresence(code) {
    const c = normalizeCode(code);
    if (!c) return;
    await this.pool.query('DELETE FROM presence WHERE friend_code = $1', [c]);
  }

  // ── Cosmetics profiles ─────────────────────────────────────────────
  async saveProfile(code, data, ttlSec) {
    const c = normalizeCode(code);
    if (!c || !data) return;
    if (await this.isDeletedCode(c)) return; // never resurrect a deleted identity's profile
    await this._upsertProfile(this.pool, c, data, ttlSec);
  }

  /** `q` is the pool or a transaction client. */
  async _upsertProfile(q, c, data, ttlSec) {
    const exp = ttlSec != null ? nowMs() + ttlSec * 1000 : null;
    const diamonds = Math.max(0, Math.min(999999, (data.diamonds | 0) || 0));
    const ownedSkins = Array.isArray(data.ownedSkins) ? data.ownedSkins : [];
    const ownedBoards = Array.isArray(data.ownedBoards) ? data.ownedBoards : [];
    const equippedSkin = data.equippedSkin || 'default';
    const equippedBoard = data.equippedBoard || 'field_default';
    const migrated = !!data.migrated;
    const updatedAt = data.updatedAt || nowMs();
    await q.query(
      `INSERT INTO profiles
         (friend_code, diamonds, owned_skins, owned_boards, equipped_skin, equipped_board, migrated, updated_at, exp)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9)
       ON CONFLICT (friend_code) DO UPDATE SET
         diamonds = EXCLUDED.diamonds,
         owned_skins = EXCLUDED.owned_skins,
         owned_boards = EXCLUDED.owned_boards,
         equipped_skin = EXCLUDED.equipped_skin,
         equipped_board = EXCLUDED.equipped_board,
         migrated = EXCLUDED.migrated,
         updated_at = EXCLUDED.updated_at,
         exp = EXCLUDED.exp`,
      [c, diamonds, JSON.stringify(ownedSkins), JSON.stringify(ownedBoards),
        String(equippedSkin), String(equippedBoard), migrated, updatedAt, exp]
    );
  }

  async loadProfile(code) {
    const c = normalizeCode(code);
    if (!c) return null;
    const { rows } = await this.pool.query(
      'SELECT * FROM profiles WHERE friend_code = $1',
      [c]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    if (r.exp != null && nowMs() > Number(r.exp)) {
      await this.deleteProfile(c);
      return null;
    }
    return profileFromRow(r);
  }

  async deleteProfile(code) {
    const c = normalizeCode(code);
    if (!c) return;
    await this.pool.query('DELETE FROM profiles WHERE friend_code = $1', [c]);
  }

  async purgeGuestProfiles(maxAgeMs) {
    const t = nowMs();
    // Delete expired by TTL
    await this.pool.query(
      'DELETE FROM profiles WHERE exp IS NOT NULL AND exp < $1',
      [t]
    );
    if (!maxAgeMs) return 0;
    // Delete old profiles that are not linked to registered accounts
    const { rowCount } = await this.pool.query(
      `DELETE FROM profiles p
       WHERE p.updated_at < $1
         AND NOT EXISTS (
           SELECT 1 FROM accounts a WHERE a.friend_code = p.friend_code
         )`,
      [t - maxAgeMs]
    );
    // Also purge abandoned guest_progress so friend codes can be reused.
    // Without this, a one-time guest could permanently occupy a code.
    let gpCount = 0;
    try {
      const gp = await this.pool.query(
        `DELETE FROM guest_progress g
         WHERE g.updated_at < $1
           AND NOT EXISTS (
             SELECT 1 FROM accounts a WHERE a.friend_code = g.friend_code
           )`,
        [t - maxAgeMs]
      );
      gpCount = gp.rowCount || 0;
    } catch (_) {}
    return (rowCount || 0) + gpCount;
  }

  // ── Guest progress ─────────────────────────────────────────────────
  async saveGuestProgress(code, data) {
    const c = normalizeCode(code);
    if (!c || !data) return;
    // Tombstoned identity (deleted by admin / user): never resurrect its guest row
    if (await this.isDeletedCode(c)) return;
    await this.pool.query(
      `INSERT INTO guest_progress (friend_code, data, updated_at) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (friend_code) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [c, JSON.stringify(data), nowMs()]
    );
  }

  async loadGuestProgress(code) {
    const c = normalizeCode(code);
    if (!c) return null;
    const { rows } = await this.pool.query(
      'SELECT data FROM guest_progress WHERE friend_code = $1',
      [c]
    );
    return rows[0] ? rows[0].data : null;
  }

  async deleteGuestProgress(code) {
    const c = normalizeCode(code);
    if (!c) return;
    await this.pool.query('DELETE FROM guest_progress WHERE friend_code = $1', [c]);
  }

  // ── Deleted code tombstones (anti-resurrection) ────────────────────
  async markDeletedCode(code, reason, ttlSec) {
    const c = normalizeCode(code);
    if (!c) return;
    const now = nowMs();
    const ttl = typeof ttlSec === 'number' && ttlSec > 0 ? ttlSec : 30 * 24 * 3600; // 30 days
    await this.pool.query(
      `INSERT INTO deleted_codes (friend_code, reason, deleted_at, exp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (friend_code) DO UPDATE SET
         reason = EXCLUDED.reason,
         deleted_at = EXCLUDED.deleted_at,
         exp = EXCLUDED.exp`,
      [c, String(reason || 'account_deleted').slice(0, 64), now, now + ttl * 1000]
    );
  }

  async isDeletedCode(code) {
    const c = normalizeCode(code);
    if (!c) return false;
    const now = nowMs();
    const { rows } = await this.pool.query(
      'SELECT 1 FROM deleted_codes WHERE friend_code = $1 AND exp > $2 LIMIT 1',
      [c, now]
    );
    return !!(rows && rows[0]);
  }

  async unmarkDeletedCode(code) {
    const c = normalizeCode(code);
    if (!c) return;
    await this.pool.query('DELETE FROM deleted_codes WHERE friend_code = $1', [c]);
  }

  async listDeletedCodes() {
    const now = nowMs();
    // Opportunistic cleanup of expired
    try { await this.pool.query('DELETE FROM deleted_codes WHERE exp <= $1', [now]); } catch (_) {}
    const { rows } = await this.pool.query(
      'SELECT friend_code, reason, deleted_at, exp FROM deleted_codes WHERE exp > $1',
      [now]
    );
    return (rows || []).map((r) => ({
      code: r.friend_code,
      reason: r.reason,
      deletedAt: Number(r.deleted_at) || 0,
      exp: Number(r.exp) || 0
    }));
  }

  // ── Accounts ───────────────────────────────────────────────────────
  /**
   * Legacy / unlocked write (registration, other non-economy flows). On conflict it NEVER touches the
   * economy columns (trophies, diamonds, owned_*, skin_id, board_id): a stale in-memory copy could
   * otherwise silently undo a purchase or a trophy award made by another request or instance.
   * Economy changes go through atomicAccountUpdate / atomicEconomyUpdate / adjustAccountCounters.
   */
  async saveAccount(acc) {
    return this._upsertAccount(this.pool, acc, false);
  }

  /** `q` is the pool or a transaction client; `economy` also overwrites the economy columns. */
  async _upsertAccount(q, acc, economy) {
    if (!acc || !acc.id) return;
    const login = String(acc.login || '').toLowerCase();
    const friendCode = normalizeCode(acc.friendCode);
    const econSet = economy ? `
         trophies = EXCLUDED.trophies,
         diamonds = EXCLUDED.diamonds,
         owned_skins = EXCLUDED.owned_skins,
         owned_boards = EXCLUDED.owned_boards,
         skin_id = EXCLUDED.skin_id,
         board_id = EXCLUDED.board_id,` : '';
    await q.query(
      `INSERT INTO accounts (
         id, login, pass_salt, pass_hash, friend_code, nick,
         trophies, diamonds, best,
         owned_skins, owned_boards, friends, history, achievements, bot_stars,
         avatar_id, avatar_custom, status, skin_id, board_id, classic_save,
         created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,
         $10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
         $16,$17,$18,$19,$20,$21::jsonb,
         $22,$23
       )
       ON CONFLICT (id) DO UPDATE SET${econSet}
         login = EXCLUDED.login,
         pass_salt = EXCLUDED.pass_salt,
         pass_hash = EXCLUDED.pass_hash,
         friend_code = EXCLUDED.friend_code,
         nick = EXCLUDED.nick,
         best = EXCLUDED.best,
         friends = EXCLUDED.friends,
         history = EXCLUDED.history,
         achievements = EXCLUDED.achievements,
         bot_stars = EXCLUDED.bot_stars,
         avatar_id = EXCLUDED.avatar_id,
         avatar_custom = EXCLUDED.avatar_custom,
         status = EXCLUDED.status,
         classic_save = EXCLUDED.classic_save,
         updated_at = EXCLUDED.updated_at`,
      [
        acc.id,
        login,
        acc.passSalt || '',
        acc.passHash || '',
        friendCode,
        String(acc.nick || login).slice(0, 24),
        acc.trophies | 0,
        acc.diamonds | 0,
        acc.best | 0,
        JSON.stringify(Array.isArray(acc.ownedSkins) ? acc.ownedSkins : ['default']),
        JSON.stringify(Array.isArray(acc.ownedBoards) ? acc.ownedBoards : ['field_default']),
        JSON.stringify(Array.isArray(acc.friends) ? acc.friends : []),
        JSON.stringify(Array.isArray(acc.history) ? acc.history : []),
        JSON.stringify(acc.achievements && typeof acc.achievements === 'object' ? acc.achievements : {}),
        JSON.stringify(acc.botStars && typeof acc.botStars === 'object' ? acc.botStars : {}),
        acc.avatarId || 'init',
        typeof acc.avatarCustom === 'string' ? acc.avatarCustom : '',
        acc.status || '',
        acc.skinId || 'default',
        acc.boardId || 'field_default',
        acc.classicSave ? JSON.stringify(acc.classicSave) : null,
        acc.createdAt || nowMs(),
        acc.updatedAt || nowMs()
      ]
    );
  }

  // ── Atomic economy (safe across several server instances) ─────────────
  /**
   * Run fn(client) in one transaction. fn returns { commit, value }: commit=false rolls back.
   * Any throw rolls back and rethrows. The connection is always released.
   */
  async _tx(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let out;
      try {
        out = await fn(client);
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw e;
      }
      if (out && out.commit) {
        try { await client.query('COMMIT'); } catch (e) {
          try { await client.query('ROLLBACK'); } catch (_) {}
          throw e;
        }
      } else {
        await client.query('ROLLBACK');
      }
      return out ? out.value : undefined;
    } finally {
      client.release();
    }
  }

  /**
   * Read-modify-write one account under a row lock (SELECT ... FOR UPDATE).
   * fn(account) MUST be synchronous and do no I/O (it runs while the row is locked); it mutates
   * `account` in place. Returns { account, result } or null when the account does not exist.
   */
  async atomicAccountUpdate(code, fn) {
    const c = normalizeCode(code);
    if (!c) return null;
    return this._tx(async (client) => {
      const { rows } = await client.query('SELECT * FROM accounts WHERE friend_code = $1 FOR UPDATE', [c]);
      const account = rowToAccount(rows[0]);
      if (!account) return { commit: false, value: null };
      const result = fn(account);
      if (result && typeof result.then === 'function') throw new Error('atomic mutator must be synchronous');
      await this._upsertAccount(client, account, true);
      return { commit: true, value: { account, result } };
    });
  }

  /**
   * Buy / equip: lock the account row and the profile row of one identity together.
   * A per-identity advisory transaction lock first serialises every economy transaction of that code even
   * when no profile row exists yet (two instances racing on a first purchase). Lock order is always
   * advisory -> accounts -> profiles, and atomicAccountUpdate only takes the account row, so no cycle.
   *
   * fn({ account|null, profile|null, deleted }) is synchronous and returns
   *   { commit:false, result }  -> nothing written (rollback), or
   *   { commit:true, result, account?, profile?, profileTtlSec? } -> written in the same transaction.
   * Returns fn's `result`.
   */
  async atomicEconomyUpdate(code, fn) {
    const c = normalizeCode(code);
    if (!c) return null;
    return this._tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['econ:' + c]);
      const a = await client.query('SELECT * FROM accounts WHERE friend_code = $1 FOR UPDATE', [c]);
      const p = await client.query('SELECT * FROM profiles WHERE friend_code = $1 FOR UPDATE', [c]);
      const d = await client.query('SELECT 1 FROM deleted_codes WHERE friend_code = $1 AND exp > $2', [c, nowMs()]);
      const account = rowToAccount(a.rows[0]);
      const pr = p.rows[0];
      const profile = pr && !(pr.exp != null && nowMs() > Number(pr.exp)) ? profileFromRow(pr) : null;
      const out = fn({ account, profile, deleted: d.rows.length > 0 });
      if (out && typeof out.then === 'function') throw new Error('atomic mutator must be synchronous');
      if (!out || !out.commit) return { commit: false, value: out ? out.result : undefined };
      if (out.account && account) await this._upsertAccount(client, out.account, true);
      if (out.profile) await this._upsertProfile(client, c, out.profile, out.profileTtlSec);
      return { commit: true, value: out.result };
    });
  }

  /**
   * Single-statement atomic counter change (no transaction needed): the arithmetic and the clamp happen
   * inside the database. Returns the new trophy count, or null when no account has that friend code.
   */
  async adjustAccountCounters(code, delta) {
    const c = normalizeCode(code);
    if (!c) return null;
    const t = (delta && delta.trophies) | 0;
    const { rows } = await this.pool.query(
      `UPDATE accounts
          SET trophies = GREATEST(0, LEAST(999999, trophies + $2)), updated_at = $3
        WHERE friend_code = $1
        RETURNING trophies`,
      [c, t, nowMs()]
    );
    return rows[0] ? (rows[0].trophies | 0) : null;
  }

  async loadAccountById(id) {
    if (!id) return null;
    const { rows } = await this.pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [String(id)]
    );
    return rowToAccount(rows[0]);
  }

  async loadAccountByLogin(login) {
    if (!login) return null;
    const { rows } = await this.pool.query(
      'SELECT * FROM accounts WHERE lower(login) = lower($1)',
      [String(login).trim()]
    );
    return rowToAccount(rows[0]);
  }

  async loadAccountByCode(code) {
    const c = normalizeCode(code);
    if (!c) return null;
    const { rows } = await this.pool.query(
      'SELECT * FROM accounts WHERE friend_code = $1',
      [c]
    );
    return rowToAccount(rows[0]);
  }

  async searchAccounts(q, limit) {
    limit = Math.min(50, Math.max(1, limit | 0) || 20);
    if (!q) return [];
    const qL = String(q).toLowerCase().trim();
    const qCode = normalizeCode(q);
    if (qL.length < 1 && qCode.length < 1) return [];

    const { rows } = await this.pool.query(
      `SELECT * FROM accounts
       WHERE ($1 <> '' AND length($1) >= 2 AND (lower(login) LIKE '%' || $1 || '%' OR lower(nick) LIKE '%' || $1 || '%'))
          OR ($2 <> '' AND length($2) >= 2 AND friend_code LIKE $2 || '%')
       LIMIT $3`,
      [qL, qCode, limit]
    );
    return rows.map(rowToAccount).filter(Boolean);
  }

  async deleteAccount(acc) {
    if (!acc || !acc.id) return false;
    await this.pool.query('DELETE FROM sessions WHERE account_id = $1', [acc.id]);
    await this.pool.query('DELETE FROM accounts WHERE id = $1', [acc.id]);
    if (acc.friendCode) {
      try { await this.deleteProfile(acc.friendCode); } catch (_) {}
      try { await this.deletePresence(acc.friendCode); } catch (_) {}
      try { await this.deleteGuestProgress(acc.friendCode); } catch (_) {}
    }
    return true;
  }

  async purgeFriendFromAllAccounts(friendCode) {
    const code = normalizeCode(friendCode);
    if (!code) return 0;
    // Use jsonb_agg / filter to remove friend entries
    const { rows } = await this.pool.query(
      `UPDATE accounts
       SET friends = (
         SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
         FROM jsonb_array_elements(friends) AS elem
         WHERE upper(elem->>'code') <> $1
       ),
       updated_at = $2
       WHERE friends @> $3::jsonb
       RETURNING id`,
      [code, nowMs(), JSON.stringify([{ code }])]
    );
    // Fallback broader scan if containment index miss (code case)
    if (!rows.length) {
      const all = await this.pool.query(
        `SELECT id, friends FROM accounts WHERE friends::text ILIKE $1`,
        ['%' + code + '%']
      );
      let n = 0;
      for (const row of all.rows) {
        const friends = Array.isArray(row.friends) ? row.friends : [];
        const next = friends.filter((f) => normalizeCode(f && f.code) !== code);
        if (next.length !== friends.length) {
          await this.pool.query(
            'UPDATE accounts SET friends = $1::jsonb, updated_at = $2 WHERE id = $3',
            [JSON.stringify(next), nowMs(), row.id]
          );
          n++;
        }
      }
      return n;
    }
    return rows.length;
  }

  /**
   * Remove a friend code from EVERY friends list (accounts, guest_progress, device_binds).
   * Returns the friend codes of the owners whose list changed (so they can be notified).
   */
  async purgeFriendReferences(friendCode) {
    const code = normalizeCode(friendCode);
    if (!code) return [];
    const owners = new Set();
    const now = nowMs();
    const filterExpr = (col) => `COALESCE((
         SELECT jsonb_agg(e) FROM jsonb_array_elements(${col}) AS e
         WHERE upper(COALESCE(e->>'code', '')) <> $1), '[]'::jsonb)`;
    const hasExpr = (col) => `jsonb_typeof(${col}) = 'array' AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(${col}) AS e WHERE upper(COALESCE(e->>'code', '')) = $1)`;
    try {
      const r = await this.pool.query(
        `UPDATE accounts SET friends = ${filterExpr('friends')}, updated_at = $2
         WHERE ${hasExpr('friends')} RETURNING friend_code`,
        [code, now]
      );
      r.rows.forEach((x) => { if (x.friend_code) owners.add(normalizeCode(x.friend_code)); });
    } catch (_) {}
    try {
      const r = await this.pool.query(
        `UPDATE guest_progress
         SET data = jsonb_set(data, '{friends}', ${filterExpr("data->'friends'")}), updated_at = $2
         WHERE ${hasExpr("data->'friends'")} RETURNING friend_code`,
        [code, now]
      );
      r.rows.forEach((x) => { if (x.friend_code) owners.add(normalizeCode(x.friend_code)); });
    } catch (_) {}
    try {
      const r = await this.pool.query(
        `UPDATE device_binds
         SET guest_progress = jsonb_set(guest_progress, '{friends}', ${filterExpr("guest_progress->'friends'")}),
             updated_at = $2
         WHERE ${hasExpr("guest_progress->'friends'")} RETURNING guest_progress->>'friendCode' AS fc`,
        [code, now]
      );
      r.rows.forEach((x) => { if (x.fc) owners.add(normalizeCode(x.fc)); });
    } catch (_) {}
    owners.delete(code);
    return Array.from(owners);
  }

  // ── Sessions ───────────────────────────────────────────────────────
  async saveSession(token, accountId, ttlSec) {
    if (!token || !accountId) return;
    const exp = nowMs() + (ttlSec || SESSION_TTL_DEFAULT) * 1000;
    await this.pool.query(
      `INSERT INTO sessions (token, account_id, exp) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET account_id = EXCLUDED.account_id, exp = EXCLUDED.exp`,
      [String(token), String(accountId), exp]
    );
  }

  async loadSession(token) {
    if (!token) return null;
    const { rows } = await this.pool.query(
      'SELECT account_id, exp FROM sessions WHERE token = $1',
      [String(token)]
    );
    if (!rows[0]) return null;
    if (rows[0].exp && nowMs() > Number(rows[0].exp)) {
      await this.deleteSession(token);
      return null;
    }
    return rows[0].account_id;
  }

  async deleteSession(token) {
    if (!token) return;
    await this.pool.query('DELETE FROM sessions WHERE token = $1', [String(token)]);
  }


  // ── Device binds (replaces IP JSON file) ─────────────────────────
  async loadDeviceBind(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!id) return null;
    const { rows } = await this.pool.query(
      'SELECT device_id, account_ids, guest_progress, updated_at FROM device_binds WHERE device_id = $1',
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    let ids = r.account_ids;
    if (!Array.isArray(ids)) ids = [];
    return {
      deviceId: r.device_id,
      accountIds: ids.map(String),
      guestProgress: r.guest_progress && typeof r.guest_progress === 'object' ? r.guest_progress : null,
      updatedAt: Number(r.updated_at) || 0
    };
  }

  async saveDeviceBind(deviceId, data) {
    const id = normalizeDeviceId(deviceId);
    if (!id || !data) return;
    const accountIds = Array.isArray(data.accountIds)
      ? data.accountIds.map(String).filter(Boolean).slice(-32)
      : [];
    const gp = data.guestProgress && typeof data.guestProgress === 'object'
      ? data.guestProgress
      : null;
    const updatedAt = data.updatedAt || nowMs();
    await this.pool.query(
      `INSERT INTO device_binds (device_id, account_ids, guest_progress, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4)
       ON CONFLICT (device_id) DO UPDATE SET
         account_ids = EXCLUDED.account_ids,
         guest_progress = EXCLUDED.guest_progress,
         updated_at = EXCLUDED.updated_at`,
      [id, JSON.stringify(accountIds), gp ? JSON.stringify(gp) : null, updatedAt]
    );
  }

  /**
   * Atomic read-modify-write for a device_binds row under SELECT ... FOR UPDATE.
   * fn(rec) is synchronous and mutates/returns the record to write.
   * Returns fn's result, or null if deviceId invalid.
   *
   * First-create race: SELECT FOR UPDATE does not lock a missing row.
   * We INSERT a placeholder (ON CONFLICT DO NOTHING) so concurrent transactions
   * serialise on the same physical row before the mutator runs.
   */
  async atomicDeviceBindUpdate(deviceId, fn) {
    const id = normalizeDeviceId(deviceId);
    if (!id || typeof fn !== 'function') return null;
    return this._tx(async (client) => {
      // Ensure a lockable row exists (placeholder). Concurrent creators both
      // insert-or-skip, then block on FOR UPDATE of the same row.
      await client.query(
        `INSERT INTO device_binds (device_id, account_ids, guest_progress, updated_at)
         VALUES ($1, '[]'::jsonb, NULL, $2)
         ON CONFLICT (device_id) DO NOTHING`,
        [id, nowMs()]
      );
      const { rows } = await client.query(
        'SELECT device_id, account_ids, guest_progress, updated_at FROM device_binds WHERE device_id = $1 FOR UPDATE',
        [id]
      );
      const r = rows[0];
      let ids = r && r.account_ids;
      if (!Array.isArray(ids)) ids = [];
      const rec = {
        deviceId: id,
        accountIds: ids.map(String),
        guestProgress: r && r.guest_progress && typeof r.guest_progress === 'object' ? r.guest_progress : null,
        updatedAt: r ? (Number(r.updated_at) || 0) : 0
      };
      const out = fn(rec);
      if (out && typeof out.then === 'function') throw new Error('atomicDeviceBindUpdate mutator must be synchronous');
      if (out && out.commit === false) return { commit: false, value: out.result };
      const accountIds = Array.isArray(rec.accountIds)
        ? rec.accountIds.map(String).filter(Boolean).slice(-32)
        : [];
      const gp = rec.guestProgress && typeof rec.guestProgress === 'object'
        ? rec.guestProgress
        : null;
      const updatedAt = nowMs();
      await client.query(
        `UPDATE device_binds
            SET account_ids = $2::jsonb,
                guest_progress = $3::jsonb,
                updated_at = $4
          WHERE device_id = $1`,
        [id, JSON.stringify(accountIds), gp ? JSON.stringify(gp) : null, updatedAt]
      );
      return { commit: true, value: out && 'result' in out ? out.result : out };
    });
  }

  async deleteDeviceBind(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!id) return;
    await this.pool.query('DELETE FROM device_binds WHERE device_id = $1', [id]);
  }

  async unbindAccountFromDevices(accountId) {
    if (!accountId) return;
    const aid = String(accountId);
    const HAD = '__had_account__';
    const { rows } = await this.pool.query(
      `SELECT device_id, account_ids, guest_progress FROM device_binds
       WHERE account_ids @> $1::jsonb`,
      [JSON.stringify([aid])]
    );
    for (const r of rows) {
      let ids = Array.isArray(r.account_ids) ? r.account_ids.map(String) : [];
      ids = ids.filter((x) => x !== aid && x !== '__guest__');
      // Device once had a real account → never allow a fresh guest farm
      if (ids.indexOf(HAD) === -1) ids.push(HAD);
      await this.pool.query(
        `UPDATE device_binds SET account_ids = $2::jsonb, guest_progress = NULL, updated_at = $3 WHERE device_id = $1`,
        [r.device_id, JSON.stringify(ids), nowMs()]
      );
    }
  }

  async close() {
    if (this._cleanupTimer) {
      clock.clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

/**
 * Create a pg Pool from env / URL.
 * Requires the `pg` package.
 */
function createPoolFromEnv() {
  let Pool;
  try {
    Pool = require('pg').Pool;
  } catch (e) {
    throw new Error(
      'PostgreSQL store requires the "pg" package. Run: npm install pg'
    );
  }

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL || '';
  if (url) {
    return new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX) || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }

  return new Pool({
    host: process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT) || 5432,
    user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'blockpuzzle',
    max: Number(process.env.PG_POOL_MAX) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
}

async function createPostgresStore() {
  const pool = createPoolFromEnv();
  // Verify connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  const store = new PostgresStore(pool);
  await store.init();
  return store;
}

module.exports = {
  PostgresStore,
  createPostgresStore,
  createPoolFromEnv,
  ROOM_TTL_LIVE,
  ROOM_TTL_ENDED,
  TOKEN_TTL,
  QUEUE_TTL,
  PRESENCE_TTL,
  PROFILE_TTL,
  SESSION_TTL_DEFAULT
};
