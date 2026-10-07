/**
 * Block Puzzle — lib/ws/handlers/match.js
 * In-match messages: ready, place, deal, sync, forfeit, rematch.
 * Multi-instance: if the room lives on another Node, forward the action via Redis.
 */
'use strict';
const { wsMatchesPlayerSync } = require('../identity');

const MATCH_TYPES = new Set([
  'match_ready', 'place', 'deal', 'sync', 'forfeit',
  'rematch_offer', 'rematch_accept', 'rematch_decline', 'rematch_cancel'
]);

/**
 * When resolveMatchCtx fails, try forwarding to the room-owner instance.
 * Returns true if the message was consumed (forwarded or rejected).
 */
function tryForwardRemote(type, ws, data, shared) {
  const { coord, send } = shared;
  if (!coord || !coord.enabled) return false;
  const matchId = (data && data.matchId) ? String(data.matchId) : (ws._matchId || null);
  const token = (data && data.token) ? String(data.token) : (ws._token || null);
  if (!matchId || !token) return false;

  // Fire-and-forget: look up owner and publish
  Promise.resolve(coord.roomOwner(matchId)).then((owner) => {
    if (!owner || owner === coord.instanceId) {
      // Owner is us but room missing → reject
      if (type === 'place') send(ws, { type: 'place_reject', reason: 'no_match' });
      else if (type === 'match_ready') send(ws, { type: 'match_ready_ack', ok: false, reason: 'no_match' });
      else if (type === 'rematch_offer' || type === 'rematch_accept') {
        send(ws, { type: 'rematch_decline', reason: 'not_found' });
      }
      return;
    }
    // Remember local routing so replies come back
    try {
      ws._matchId = matchId;
      ws._token = token;
      if (typeof coord.bindToken === 'function') {
        coord.bindToken(token, { ws, friendCode: ws._friendCode || '' }).catch(() => {});
      } else if (coord.trackLocal) {
        coord.trackLocal(token, ws);
      }
    } catch (_) {}
    return coord.publishRoomForward(owner, {
      matchId,
      token,
      data: Object.assign({}, data, { type })
    });
  }).catch(() => {
    if (type === 'place') send(ws, { type: 'place_reject', reason: 'no_match' });
  });
  return true;
}

function handleMatch(type, ws, data, shared) {
  if (!MATCH_TYPES.has(type)) return false;

  const {
    resolveMatchCtx,
    rooms,
    send
  } = shared;

  if (type === 'match_ready') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) return tryForwardRemote(type, ws, data, shared) || (
      send(ws, { type: 'match_ready_ack', ok: false, reason: 'no_match' }), true
    );
    ctx.room.markReady(ctx.token);
    return true;
  }
  if (type === 'place') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) return tryForwardRemote(type, ws, data, shared) || (
      send(ws, { type: 'place_reject', reason: 'no_match' }), true
    );
    ctx.room.applyPlace(ctx.token, data);
    return true;
  }
  if (type === 'deal') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) return tryForwardRemote(type, ws, data, shared) || true;
    ctx.room.applyDeal(ctx.token, data);
    return true;
  }
  if (type === 'sync') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) return tryForwardRemote(type, ws, data, shared) || true;
    ctx.room.applySync(ctx.token, data);
    return true;
  }
  if (type === 'forfeit') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) return tryForwardRemote(type, ws, data, shared) || true;
    ctx.room.forfeit(ctx.token);
    return true;
  }
  if (type === 'rematch_offer' || type === 'rematch_accept' ||
      type === 'rematch_decline' || type === 'rematch_cancel') {
    const matchId = data.matchId || ws._matchId;
    const room = matchId ? rooms.get(matchId) : null;
    const token = data.token || ws._token;
    if (!room || !room.getPlayer(token)) {
      // Try remote owner before declining
      if (tryForwardRemote(type, ws, data, shared)) return true;
      if (type === 'rematch_offer' || type === 'rematch_accept') send(ws, { type: 'rematch_decline', reason: 'not_found' });
      return true;
    }
    if (room.players[token].ws !== ws) {
      if (!wsMatchesPlayerSync(ws, room.players[token])) {
        if (type === 'rematch_offer' || type === 'rematch_accept') send(ws, { type: 'rematch_decline', reason: 'not_found' });
        return true;
      }
      room.attach(token, ws);
    }
    ws._token = token;
    ws._matchId = room.id;
    if (type === 'rematch_offer') room.offerRematch(token);
    else if (type === 'rematch_accept') room.acceptRematch(token);
    else if (type === 'rematch_decline') room.declineRematch(token);
    else if (type === 'rematch_cancel') room.cancelRematch(token);
    return true;
  }

  return false;
}

module.exports = { handleMatch };
