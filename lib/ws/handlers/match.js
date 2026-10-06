/**
 * Block Puzzle — lib/ws/handlers/match.js
 * In-match messages: ready, place, deal, sync, forfeit, rematch.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

function handleMatch(type, ws, data, shared) {
  const {
    resolveMatchCtx,
    rooms,
    send
  } = shared;

  if (type === 'match_ready') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) {
      send(ws, { type: 'match_ready_ack', ok: false, reason: 'no_match' });
      return true;
    }
    ctx.room.markReady(ctx.token);
    return true;
  }
  if (type === 'place') {
    const ctx = resolveMatchCtx(ws, data);
    if (!ctx) {
      send(ws, { type: 'place_reject', reason: 'no_match' });
      return true;
    }
    ctx.room.applyPlace(ctx.token, data);
    return true;
  }
  if (type === 'deal') {
    const ctx = resolveMatchCtx(ws, data);
    if (ctx) ctx.room.applyDeal(ctx.token, data);
    return true;
  }
  if (type === 'sync') {
    const ctx = resolveMatchCtx(ws, data);
    if (ctx) ctx.room.applySync(ctx.token, data);
    return true;
  }
  if (type === 'forfeit') {
    const ctx = resolveMatchCtx(ws, data);
    if (ctx) ctx.room.forfeit(ctx.token);
    return true;
  }
  if (type === 'rematch_offer' || type === 'rematch_accept') {
    const matchId = data.matchId || ws._matchId;
    const room = matchId ? rooms.get(matchId) : null;
    const token = data.token || ws._token;
    if (!room || !room.getPlayer(token)) {
      send(ws, { type: 'rematch_decline', reason: 'not_found' });
      return true;
    }
    ws._token = token;
    ws._matchId = room.id;
    // Re-bind socket if needed
    if (room.players[token].ws !== ws) room.attach(token, ws);
    if (type === 'rematch_offer') room.offerRematch(token);
    else room.acceptRematch(token);
    return true;
  }
  if (type === 'rematch_decline') {
    const matchId = data.matchId || ws._matchId;
    const token = data.token || ws._token;
    const room = matchId ? rooms.get(matchId) : null;
    if (room && room.getPlayer(token)) room.declineRematch(token);
    return true;
  }
  if (type === 'rematch_cancel') {
    const matchId = data.matchId || ws._matchId;
    const token = data.token || ws._token;
    const room = matchId ? rooms.get(matchId) : null;
    if (room && room.getPlayer(token)) room.cancelRematch(token);
    return true;
  }

  return false;
}

module.exports = { handleMatch };
