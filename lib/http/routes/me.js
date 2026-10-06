/**
 * Block Puzzle — lib/http/routes/me.js
 * /api/me (GET profile, PATCH/POST update).
 * Extracted from the former monolithic lib/http-api.js — behaviour unchanged.
 * Contract: resolves true when the request was handled, false to fall through to the next route module.
 */
'use strict';

async function handleMeRoutes(req, res, ctx) {
  const {
    accountsApi,
    bearerToken,
    readJsonBody,
    sendJson,
    url
  } = ctx;

  if (url === '/api/me' && req.method === 'GET') {
    const token = bearerToken(req);
    const acc = await accountsApi.resolveSession(token);
    if (!acc) {
      return (sendJson(res, 401, {
        ok: false,
        error: 'unauthorized',
        accountDeleted: true,
        message: 'Требуется вход'
      }), true);
    }
    return (sendJson(res, 200, { ok: true, account: accountsApi.publicAccount(acc) }), true);
  }
  if (url === '/api/me' && (req.method === 'PATCH' || req.method === 'POST')) {
    const token = bearerToken(req);
    const acc = await accountsApi.resolveSession(token);
    if (!acc) return (sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Требуется вход' }), true);
    // Larger limit: history (with replays) + friends + cosmetics progress
    const body = await readJsonBody(req, 512 * 1024);
    const updated = await accountsApi.updateAccount(acc, body || {});
    return (sendJson(res, 200, { ok: true, account: updated }), true);
  }

  return false;
}

module.exports = { handleMeRoutes };
