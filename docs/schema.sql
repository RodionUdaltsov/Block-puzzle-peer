-- Block Puzzle — PostgreSQL schema (production)
-- Compatible with lib/postgres-store.js
-- Apply once: psql $DATABASE_URL -f docs/schema.sql

BEGIN;

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

-- Device binding (replaces former IP-based JSON file store)
-- Survives browser wipe; not bypassable via VPN.
CREATE TABLE IF NOT EXISTS device_binds (
  device_id       TEXT PRIMARY KEY,
  account_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
  guest_progress  JSONB,
  updated_at      BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_binds_updated ON device_binds (updated_at);

COMMIT;
