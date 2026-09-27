#!/usr/bin/env node
/**
 * One-shot migration: legacy file data/ → PostgreSQL.
 * Only needed if you still have old JSON data from a previous version.
 *
 *   DATABASE_URL=postgres://... node scripts/migrate-file-to-postgres.js
 */
'use strict';

const path = require('path');
const fs = require('fs');

const dryRun = process.argv.includes('--dry-run');
let dataDir = path.join(__dirname, '..', 'data');
const di = process.argv.indexOf('--data-dir');
if (di >= 0 && process.argv[di + 1]) dataDir = path.resolve(process.argv[di + 1]);

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.PG_URL) {
    console.error('Set DATABASE_URL before migration.');
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) {
    console.log('[migrate] no data dir at', dataDir, '— nothing to migrate');
    process.exit(0);
  }

  const { createPostgresStore } = require('../lib/postgres-store');
  const pg = await createPostgresStore();
  console.log('[migrate] postgres connected, source:', dataDir, 'dry-run:', dryRun);

  let stats = { accounts: 0, sessions: 0, profiles: 0, presence: 0, social: 0, rooms: 0, tokens: 0 };

  const accountsDir = path.join(dataDir, 'accounts');
  if (fs.existsSync(accountsDir)) {
    for (const f of fs.readdirSync(accountsDir).filter((x) => x.endsWith('.json') && x !== '_index.json')) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(accountsDir, f), 'utf8'));
        const acc = raw.id ? raw : (raw.data || raw);
        if (!acc || !acc.id) continue;
        if (!dryRun) await pg.saveAccount(acc);
        stats.accounts++;
      } catch (e) {
        console.warn('[migrate] account', f, e.message);
      }
    }
  }

  const sessionsPath = path.join(dataDir, 'sessions.json');
  if (fs.existsSync(sessionsPath)) {
    try {
      const map = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')) || {};
      for (const [token, e] of Object.entries(map)) {
        if (!e || !e.accountId) continue;
        if (e.exp && Date.now() > e.exp) continue;
        const ttl = e.exp ? Math.max(1, Math.ceil((e.exp - Date.now()) / 1000)) : 30 * 24 * 3600;
        if (!dryRun) await pg.saveSession(token, e.accountId, ttl);
        stats.sessions++;
      }
    } catch (_) {}
  }

  const profilesDir = path.join(dataDir, 'profiles');
  if (fs.existsSync(profilesDir)) {
    for (const f of fs.readdirSync(profilesDir).filter((x) => x.endsWith('.json'))) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(profilesDir, f), 'utf8'));
        const code = (raw.code || path.basename(f, '.json')).toUpperCase();
        const data = raw.data || raw;
        if (!data) continue;
        const ttl = raw.exp ? Math.max(1, Math.ceil((raw.exp - Date.now()) / 1000)) : undefined;
        if (!dryRun) await pg.saveProfile(code, data, ttl);
        stats.profiles++;
      } catch (_) {}
    }
  }

  const presenceDir = path.join(dataDir, 'presence');
  if (fs.existsSync(presenceDir)) {
    for (const f of fs.readdirSync(presenceDir).filter((x) => x.endsWith('.json'))) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(presenceDir, f), 'utf8'));
        const code = (raw.code || path.basename(f, '.json')).toUpperCase();
        const data = raw.data || raw;
        if (raw.exp && Date.now() > raw.exp) continue;
        const ttl = raw.exp ? Math.max(1, Math.ceil((raw.exp - Date.now()) / 1000)) : 7 * 24 * 3600;
        if (!dryRun) await pg.savePresence(code, data, ttl);
        stats.presence++;
      } catch (_) {}
    }
  }

  const socialPath = path.join(dataDir, 'social.json');
  if (fs.existsSync(socialPath)) {
    try {
      const map = JSON.parse(fs.readFileSync(socialPath, 'utf8')) || {};
      for (const [code, arr] of Object.entries(map)) {
        if (!Array.isArray(arr) || !arr.length) continue;
        if (!dryRun) await pg.setSocial(code, arr);
        stats.social++;
      }
    } catch (_) {}
  }

  console.log('[migrate] done', stats, dryRun ? '(dry-run)' : '');
  await pg.close();
}

main().catch((e) => {
  console.error('[migrate] failed:', e);
  process.exit(1);
});
