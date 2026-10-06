/**
 * WebSocket connection + message dispatch.
 *
 * Layout (was a single 1450-line closure):
 *   lib/ws/context.js            shared deps + late-bound hook aliases
 *   lib/ws/handlers/*.js         one module per message domain
 *   lib/ws-handlers.js           (this file) connection lifecycle + ordered dispatch
 *
 * Each handler module exports `(type, ws, data, shared) => boolean`; the first one that returns
 * true consumes the message. Order matches the original if-chain (types are mutually exclusive,
 * the cosmetics bind-guard stays directly in front of the cosmetics handlers).
 */
'use strict';

const { createWsContext } = require('./ws/context');
const { handleMatchmaking } = require('./ws/handlers/matchmaking');
const { handlePrivateLobby } = require('./ws/handlers/private-lobby');
const { handlePresenceSocial } = require('./ws/handlers/presence-social');
const { handleMatch } = require('./ws/handlers/match');
const { handleSessionCosmetics } = require('./ws/handlers/session-cosmetics');
const { handleLiveness } = require('./ws/handlers/liveness');

const HANDLERS = [
  handleMatchmaking,
  handlePrivateLobby,
  handlePresenceSocial,
  handleMatch,
  handleSessionCosmetics,
  handleLiveness
];

function attachWsHandlers(wss, deps) {
  const shared = createWsContext(deps);
  const {
    allowWsMessage,
    dequeueToken,
    hooks,
    leavePrivateLobby,
    lobbySnapshot,
    log,
    send,
    uid
  } = shared;

  wss.on('connection', (ws) => {
    // Mutable server state is read once per connection (same as before the split)
    const conn = Object.assign({}, shared, {
      store: hooks.store,
      accountsApi: hooks.accountsApi,
      presence: hooks.presence,
      pendingSocial: hooks.pendingSocial,
      privateLobbies: hooks.privateLobbies,
      rooms: hooks.rooms,
      queues: hooks.queues,
      pendingQueueIntents: hooks.pendingQueueIntents
    });
    const {
      presence,
      privateLobbies,
      rooms
    } = conn;

    ws._token = uid('t');
    ws._matchId = null;
    ws.isAlive = true;
    ws._msgWindow = null;
    // Prevent unhandled 'error' (e.g. max payload) from crashing the process
    ws.on('error', (err) => {
      try {
        log('warn', 'ws error', {
          code: err && err.code,
          message: err && err.message,
          token: ws._token || null
        });
      } catch (_) {}
    });
    ws.on('pong', () => { ws.isAlive = true; });
    send(ws, {
      type: 'hello',
      token: ws._token,
      protocolVersion: 1,
      crossplay: true,
      // Explicit: one queue for phone + PC + any OS
      platforms: ['mobile', 'desktop', 'tablet', 'web']
    });

    ws.on('message', (raw) => {
      if (!allowWsMessage(ws)) return;
      let data;
      try { data = JSON.parse(String(raw)); } catch (_) { return; }
      if (!data || typeof data !== 'object') return;
      const type = data.type;

      for (let i = 0; i < HANDLERS.length; i++) {
        if (HANDLERS[i](type, ws, data, conn)) return;
      }
    });

    ws.on('close', () => {
      dequeueToken(ws._token);
      if (ws._privateCode && privateLobbies.has(ws._privateCode)) {
        const lobby = privateLobbies.get(ws._privateCode);
        const code = ws._privateCode;
        if (lobby.host && lobby.host.token === ws._token) {
          lobby.host.ws = null;
          setTimeout(() => {
            const L = privateLobbies.get(code);
            if (L && L.host && L.host.token === ws._token && (!L.host.ws || L.host.ws.readyState !== 1)) {
              leavePrivateLobby(ws._token);
            }
          }, 90000);
        } else if (lobby.guest && lobby.guest.token === ws._token) {
          lobby.guest = null;
          lobby.hostReady = false;
          lobby.guestReady = false;
          if (lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1) {
            send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
          }
        }
      }
      if (ws._friendCode && presence.has(ws._friendCode)) {
        const p = presence.get(ws._friendCode);
        if (p && p.token === ws._token) presence.delete(ws._friendCode);
      }
      if (ws._matchId && rooms.has(ws._matchId)) {
        rooms.get(ws._matchId).detach(ws._token, ws);
      }
    });
  });
}

module.exports = { attachWsHandlers };
