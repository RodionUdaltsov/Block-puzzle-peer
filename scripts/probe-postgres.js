'use strict';
/**
 * Exit 0 if DATABASE_URL (or default) accepts connections.
 * Exit 1 otherwise. Prints a one-line reason to stderr.
 */
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL ||
  'postgres://bp:bp@127.0.0.1:5432/blockpuzzle';

let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  console.error('pg package missing — run: npm install');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 4000,
  max: 1
});

pool.connect()
  .then(async (client) => {
    try {
      await client.query('SELECT 1');
      process.exitCode = 0;
    } finally {
      client.release();
      await pool.end().catch(() => {});
    }
  })
  .catch(async (err) => {
    console.error(err && err.message ? err.message : String(err));
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  });
