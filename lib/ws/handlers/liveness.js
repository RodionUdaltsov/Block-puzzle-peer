/**
 * Block Puzzle — lib/ws/handlers/liveness.js
 * ping, lobby_ping, free_match, leave_match.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

function handleLiveness(type, ws, data, shared) {
  const {
    lobbySnapshot,
    privateLobbies,
    rooms,
    send
  } = shared;

  if (type === 'ping') {
    send(ws, { type: 'pong', t: data.t || Date.now() });
    const room = rooms.get(ws._matchId);
    if (room) {
      const p = room.getPlayer(ws._token);
      if (p) {
        p.lastSeen = Date.now();
        room.state[p.seat].lastSeen = Date.now();
        if (!p.online) {
          p.online = true;
          room.state[p.seat].online = true;
          room.broadcast({ type: 'player_status', seat: p.seat, online: true, vsTimeLeft: room.timeLeft() }, ws._token);
        }
      }
    }
    return true;
  }
  if (type === 'lobby_ping') {
    const code = ws._privateCode;
    if (!code || !privateLobbies.has(code)) return true;
    const lobby = privateLobbies.get(code);
    const rtt = Math.max(0, Math.min(900, (data.rtt | 0))); // clamp tab-throttle spikes
    if (lobby.host && lobby.host.token === ws._token) lobby.host.rtt = rtt;
    else if (lobby.guest && lobby.guest.token === ws._token) lobby.guest.rtt = rtt;
    // Push updated lobby to both so each sees both pings + host
    try {
      if (lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1) {
        send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      }
      if (lobby.guest && lobby.guest.ws && lobby.guest.ws.readyState === 1) {
        send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
      }
    } catch (_) {}
    return true;
  }
  if (type === 'free_match') {
    // Client left rematch UI / went to menu — free socket without DC forfeit if already ended
    const mid = ws._matchId;
    const room = mid ? rooms.get(mid) : null;
    if (room && room.status === 'live') {
      try { room.detach(ws._token); } catch (_) {}
    }
    ws._matchId = null;
    return true;
  }
  if (type === 'leave_match') {
    const mid = ws._matchId;
    const room = mid ? rooms.get(mid) : null;
    if (room && room.status === 'live') {
      try { room.detach(ws._token); } catch (_) {}
    }
    // Always free socket from ended/rematch rooms so create_private works
    ws._matchId = null;
    return true;
  }

  return false;
}

module.exports = { handleLiveness };
