/**
 * Block Puzzle — authoritative match rooms (no P2P)
 *
 * Ranked:  join_queue → match_found → room is source of truth
 * Private: create_private / join_private → ready → match_found
 * Reconnect: rejoin { matchId, token } → full state snapshot
 */
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 9000;
const PUBLIC = path.join(__dirname, 'public');

const app = express();
app.use(cors({ origin: true }));
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'block-puzzle',
    rooms: rooms.size,
    queue: totalQueued(),
    privateLobbies: privateLobbies.size,
    uptime: Math.floor(process.uptime())
  });
});

app.use(express.static(PUBLIC, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

const server = http.createServer(app);

// ─── Match rooms (authoritative) ───────────────────────────────────────────

/** @type {Map<string, MatchRoom>} */
const rooms = new Map();
/** queue key → waiting players */
const queues = new Map();
/** Private lobby code → lobby state */
const privateLobbies = new Map();
/** friendCode → presence entry */
const presence = new Map();

function totalQueued() {
  let n = 0;
  for (const q of queues.values()) n += q.length;
  return n;
}

function uid(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

function emptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

// ─── Authoritative puzzle rules (ported from client) ───────────────────────
const SIZE = 8;
const DEFAULT_COLORS = ['#00d4aa','#7c5cff','#ff5c7a','#ffb347','#4fc3f7','#ff6bcb','#a8e063','#ff8a65'];
const SHAPES = [
  [[0,0]],
  [[0,0],[0,1]], [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]],
  [[0,1],[1,0],[1,1]], [[0,0],[1,0],[1,1]],
  [[0,0],[1,0],[0,1]],
  [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[1,0],[2,0],[2,1]], [[0,1],[1,1],[2,0],[2,1]],
  [[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[1,1],[2,1]], [[0,2],[1,0],[1,1],[1,2]],
  [[0,0],[1,0],[2,0],[1,1]],
  [[0,1],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[0,2],[1,1]],
  [[1,0],[0,1],[1,1],[2,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]],
  [[0,1],[1,0],[1,1],[2,0]],
];
const SHAPE_WEIGHTS = SHAPES.map(s => {
  const n = s.length;
  if (n === 1) return 8;
  if (n === 2) return 10;
  if (n === 3) return 9;
  return 5;
});

function normalizeShape(shape) {
  if (!Array.isArray(shape) || !shape.length) return [];
  const cells = shape.map(p => [p[0] | 0, p[1] | 0]);
  const minR = Math.min(...cells.map(p => p[0]));
  const minC = Math.min(...cells.map(p => p[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

function shapeKey(shape) {
  return normalizeShape(shape).map(([r, c]) => r + ',' + c).sort().join(';');
}

function shapesEqual(a, b) {
  return shapeKey(a) === shapeKey(b);
}

function randomPiece() {
  const total = SHAPE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let idx = 0;
  for (let i = 0; i < SHAPE_WEIGHTS.length; i++) {
    r -= SHAPE_WEIGHTS[i];
    if (r <= 0) { idx = i; break; }
  }
  return {
    shape: normalizeShape(SHAPES[idx]),
    color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
    used: false
  };
}

function dealThree() {
  return [randomPiece(), randomPiece(), randomPiece()];
}

function cloneGrid(g) {
  return g.map(row => row.slice());
}

function canPlaceOn(g, shape, baseR, baseC) {
  for (const [dr, dc] of shape) {
    const r = baseR + dr;
    const c = baseC + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || g[r][c]) return false;
  }
  return true;
}

function clearLinesOnGrid(g) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r++) if (g[r].every(c => !!c)) rows.push(r);
  for (let c = 0; c < SIZE; c++) if (g.every(row => !!row[c])) cols.push(c);
  if (!rows.length && !cols.length) return { count: 0, rows: [], cols: [] };
  rows.forEach(r => { for (let c = 0; c < SIZE; c++) g[r][c] = null; });
  cols.forEach(c => { for (let r = 0; r < SIZE; r++) g[r][c] = null; });
  return { count: rows.length + cols.length, rows, cols };
}

function bonusFor(cleared) {
  return [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000][cleared] || 4000;
}

function chainBonusFor(chain) {
  if (chain < 2) return 0;
  return Math.min(800, (chain - 1) * 50);
}

function serializePieces(pieces) {
  return (pieces || []).map(p => ({
    shape: (p.shape || []).map(c => c.slice()),
    color: p.color,
    used: !!p.used
  }));
}

function findAllPlacements(g, shape) {
  if (!shape || !shape.length) return [];
  const maxR = Math.max(...shape.map(s => s[0]));
  const maxC = Math.max(...shape.map(s => s[1]));
  const candidates = [];
  for (let r = 0; r <= SIZE - 1 - maxR; r++) {
    for (let c = 0; c <= SIZE - 1 - maxC; c++) {
      if (canPlaceOn(g, shape, r, c)) candidates.push({ r, c });
    }
  }
  return candidates;
}

/** true = can play, false = stuck (has pieces, none fit), null = tray empty / deal pending */
function sideHasPlayable(g, pieceArr) {
  const left = (pieceArr || []).filter(p => p && !p.used && p.shape && p.shape.length);
  if (!left.length) return null;
  for (const p of left) {
    if (findAllPlacements(g, p.shape).length > 0) return true;
  }
  return false;
}

// Anti-spam: minimum ms between accepted places per seat
const MIN_PLACE_INTERVAL_MS = 120;
const PLACE_BURST_WINDOW_MS = 1000;
const PLACE_BURST_MAX = 8;

function queueKey(duration, trophies) {
  const bucket = Math.floor(Math.max(0, trophies) / 50) * 50;
  return 'd' + duration + '-b' + bucket;
}

function nearbyQueueKeys(duration, trophies, gap) {
  const base = Math.floor(Math.max(0, trophies) / 50) * 50;
  const keys = [];
  for (let b = base - gap; b <= base + gap; b += 50) {
    if (b < 0) continue;
    keys.push(queueKey(duration, b));
  }
  return keys;
}

class MatchRoom {
  constructor(p1, p2, duration) {
    this.id = uid('m');
    this.duration = duration || 120;
    this.size = 8;
    this.createdAt = Date.now();
    this.clockEndTs = Date.now() + this.duration * 1000;
    this.status = 'live'; // live | ended
    this.endedReason = null;

    this.players = {
      [p1.token]: this._makePlayer(p1, 'a'),
      [p2.token]: this._makePlayer(p2, 'b')
    };
    this.seatOf = {
      a: p1.token,
      b: p2.token
    };

    // Shared authoritative state (server is source of truth)
    this.state = {
      a: {
        score: 0,
        grid: emptyGrid(this.size),
        pieces: dealThree(),
        clearChain: 0,
        stuck: false,
        lastPlaceAt: 0,
        placeTimes: [],
        name: p1.name || 'Игрок',
        trophies: p1.trophies | 0,
        online: true,
        lastSeen: Date.now()
      },
      b: {
        score: 0,
        grid: emptyGrid(this.size),
        pieces: dealThree(),
        clearChain: 0,
        stuck: false,
        lastPlaceAt: 0,
        placeTimes: [],
        name: p2.name || 'Игрок',
        trophies: p2.trophies | 0,
        online: true,
        lastSeen: Date.now()
      },
      moves: []
    };

    rooms.set(this.id, this);
    this._clockTimer = setInterval(() => this._tick(), 1000);
  }

  _makePlayer(info, seat) {
    return {
      token: info.token,
      seat,
      name: info.name || 'Игрок',
      trophies: info.trophies | 0,
      ws: info.ws || null,
      online: true,
      lastSeen: Date.now()
    };
  }

  getPlayer(token) {
    return this.players[token] || null;
  }

  otherSeat(seat) {
    return seat === 'a' ? 'b' : 'a';
  }

  attach(token, ws) {
    const p = this.players[token];
    if (!p || this.status === 'ended') return false;
    p.ws = ws;
    p.online = true;
    p.lastSeen = Date.now();
    this.state[p.seat].online = true;
    this.state[p.seat].lastSeen = Date.now();
    ws._matchId = this.id;
    ws._token = token;
    return true;
  }

  detach(token) {
    const p = this.players[token];
    if (!p) return;
    p.ws = null;
    p.online = false;
    p.lastSeen = Date.now();
    this.state[p.seat].online = false;
    this.state[p.seat].lastSeen = Date.now();
    this.broadcast({
      type: 'peer_status',
      seat: p.seat,
      online: false,
      clockEndTs: this.clockEndTs,
      vsTimeLeft: this.timeLeft()
    }, token);
  }

  timeLeft() {
    return Math.max(0, Math.ceil((this.clockEndTs - Date.now()) / 1000));
  }

  /** Snapshot for a given player (their seat = "me") */
  snapshotFor(token) {
    const p = this.players[token];
    if (!p) return null;
    const me = p.seat;
    const opp = this.otherSeat(me);
    return {
      type: 'state',
      matchId: this.id,
      token,
      seat: me,
      status: this.status,
      endedReason: this.endedReason,
      duration: this.duration,
      clockEndTs: this.clockEndTs,
      vsTimeLeft: this.timeLeft(),
      me: {
        score: this.state[me].score,
        grid: this.state[me].grid,
        pieces: this.state[me].pieces,
        name: this.state[me].name,
        online: this.state[me].online
      },
      opp: {
        score: this.state[opp].score,
        grid: this.state[opp].grid,
        pieces: this.state[opp].pieces,
        name: this.state[opp].name,
        trophies: this.state[opp].trophies,
        online: this.state[opp].online
      },
      moves: this.state.moves.slice(-80)
    };
  }

  send(token, msg) {
    const p = this.players[token];
    if (!p || !p.ws || p.ws.readyState !== 1) return;
    try { p.ws.send(JSON.stringify(msg)); } catch (_) {}
  }

  broadcast(msg, exceptToken) {
    for (const token of Object.keys(this.players)) {
      if (exceptToken && token === exceptToken) continue;
      this.send(token, msg);
    }
  }

  broadcastState() {
    for (const token of Object.keys(this.players)) {
      const snap = this.snapshotFor(token);
      if (snap) this.send(token, snap);
    }
  }

  applyPlace(token, data) {
    if (this.status !== 'live') return;
    const p = this.players[token];
    if (!p) return;
    const seat = p.seat;
    const st = this.state[seat];
    const reject = (reason) => {
      this.send(token, {
        type: 'place_reject',
        reason: reason || 'invalid',
        score: st.score,
        grid: cloneGrid(st.grid),
        pieces: serializePieces(st.pieces),
        vsTimeLeft: this.timeLeft(),
        clockEndTs: this.clockEndTs
      });
    };

    // Rate limit / anti-spam
    const now = Date.now();
    if (st.lastPlaceAt && (now - st.lastPlaceAt) < MIN_PLACE_INTERVAL_MS) {
      return reject('rate_limit');
    }
    st.placeTimes = (st.placeTimes || []).filter(t => now - t < PLACE_BURST_WINDOW_MS);
    if (st.placeTimes.length >= PLACE_BURST_MAX) {
      return reject('rate_limit');
    }

    const pieceIdx = data.pieceIdx | 0;
    if (pieceIdx < 0 || pieceIdx >= st.pieces.length) return reject('bad_piece_idx');
    const handPiece = st.pieces[pieceIdx];
    if (!handPiece || handPiece.used) return reject('piece_used');

    const shape = normalizeShape(data.shape || handPiece.shape);
    if (!shape.length || !shapesEqual(shape, handPiece.shape)) return reject('shape_mismatch');

    const r = data.r | 0;
    const c = data.c | 0;
    if (!canPlaceOn(st.grid, shape, r, c)) return reject('cannot_place');

    // Apply cells
    const color = handPiece.color || data.color || DEFAULT_COLORS[0];
    for (const [dr, dc] of shape) {
      st.grid[r + dr][c + dc] = color;
    }
    handPiece.used = true;
    st.lastPlaceAt = now;
    st.placeTimes.push(now);
    st.stuck = false;

    const placePts = shape.length * 10;
    let scoreDelta = placePts;
    const clearInfo = clearLinesOnGrid(st.grid);
    const cleared = clearInfo.count || 0;
    let bonus = 0;
    let chainExtra = 0;
    if (cleared > 0) {
      st.clearChain = (st.clearChain || 0) + 1;
      const baseBonus = bonusFor(cleared);
      chainExtra = chainBonusFor(st.clearChain);
      bonus = baseBonus + chainExtra;
      scoreDelta += bonus;
    } else {
      st.clearChain = 0;
    }
    st.score = Math.max(0, (st.score | 0) + scoreDelta);

    // Auto-deal when hand exhausted
    let newDeal = null;
    if (st.pieces.every(pc => pc && pc.used)) {
      st.pieces = dealThree();
      newDeal = serializePieces(st.pieces);
    }

    this.state.moves.push({
      type: 'place',
      seat,
      t: Date.now() - this.createdAt,
      r,
      c,
      pieceIdx,
      shape: shape.map(s => s.slice()),
      color,
      placePts,
      cleared,
      bonus,
      chain: st.clearChain,
      score: st.score
    });
    if (this.state.moves.length > 200) this.state.moves = this.state.moves.slice(-120);

    const oppToken = this.seatOf[this.otherSeat(seat)];
    this.send(oppToken, {
      type: 'opp_place',
      r,
      c,
      pieceIdx,
      shape: shape.map(s => s.slice()),
      color,
      score: st.score,
      placePts,
      cleared,
      bonus,
      chain: st.clearChain,
      grid: cloneGrid(st.grid),
      pieces: serializePieces(st.pieces),
      vsTimeLeft: this.timeLeft(),
      clockEndTs: this.clockEndTs
    });
    if (newDeal) {
      this.send(oppToken, {
        type: 'opp_deal',
        pieces: newDeal,
        vsTimeLeft: this.timeLeft()
      });
    }

    this.send(token, {
      type: 'place_ok',
      score: st.score,
      placePts,
      cleared,
      bonus,
      chain: st.clearChain,
      grid: cloneGrid(st.grid),
      pieces: serializePieces(st.pieces),
      deal: newDeal,
      vsTimeLeft: this.timeLeft(),
      clockEndTs: this.clockEndTs
    });

    // Server-side stuck resolution (authoritative end conditions)
    this.evaluateStuck();
  }

  /**
   * Recompute stuck flags for both seats and end the match when rules say so:
   *  - stuck + behind → loss
   *  - both stuck → end by score
   *  - stuck + ahead while opp can still play → wait
   */
  evaluateStuck() {
    if (this.status !== 'live') return;
    const aPlay = sideHasPlayable(this.state.a.grid, this.state.a.pieces);
    const bPlay = sideHasPlayable(this.state.b.grid, this.state.b.pieces);

    const prevA = !!this.state.a.stuck;
    const prevB = !!this.state.b.stuck;
    if (aPlay === true) this.state.a.stuck = false;
    else if (aPlay === false) this.state.a.stuck = true;
    if (bPlay === true) this.state.b.stuck = false;
    else if (bPlay === false) this.state.b.stuck = true;

    if (prevA !== this.state.a.stuck || prevB !== this.state.b.stuck) {
      this.broadcast({
        type: 'stuck_status',
        a: this.state.a.stuck,
        b: this.state.b.stuck,
        aScore: this.state.a.score | 0,
        bScore: this.state.b.score | 0,
        vsTimeLeft: this.timeLeft()
      });
    }

    const aScore = this.state.a.score | 0;
    const bScore = this.state.b.score | 0;
    const aStuck = aPlay === false;
    const bStuck = bPlay === false;

    // Both truly stuck → end by score
    if (aStuck && bStuck) {
      let winner = null;
      if (aScore > bScore) winner = 'a';
      else if (bScore > aScore) winner = 'b';
      this.end('stuck', winner);
      return;
    }
    // One stuck and behind → immediate loss
    if (aStuck && aScore < bScore) {
      this.end('stuck', 'b');
      return;
    }
    if (bStuck && bScore < aScore) {
      this.end('stuck', 'a');
      return;
    }
  }

  /** Client-requested deal is ignored in room mode — server owns the RNG. */
  applyDeal(token, data) {
    if (this.status !== 'live') return;
    const p = this.players[token];
    if (!p) return;
    // Authoritative: do not accept client pieces. Re-send current hand so client can resync.
    const seat = p.seat;
    this.send(token, {
      type: 'deal',
      pieces: serializePieces(this.state[seat].pieces),
      vsTimeLeft: this.timeLeft()
    });
  }

  applySync(token, data) {
    if (this.status !== 'live') return;
    const p = this.players[token];
    if (!p) return;
    // Rejoin / soft resync only: push authoritative snapshot, ignore client scores/grids
    this.send(token, this.snapshotFor(token));
  }

  forfeit(token) {
    if (this.status !== 'live') return;
    const p = this.players[token];
    if (!p) return;
    const loser = p.seat;
    const winner = this.otherSeat(loser);
    this.end('forfeit', winner);
  }

  end(reason, winnerSeat) {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.endedReason = reason || 'time';
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
    const payload = {
      type: 'match_end',
      reason: this.endedReason,
      winnerSeat: winnerSeat || null,
      clockEndTs: this.clockEndTs,
      a: { score: this.state.a.score, name: this.state.a.name },
      b: { score: this.state.b.score, name: this.state.b.name }
    };
    this.broadcast(payload);
    // Keep room briefly for late rejoin to see result
    setTimeout(() => {
      rooms.delete(this.id);
    }, 120000);
  }

  _tick() {
    if (this.status !== 'live') return;
    const left = this.timeLeft();
    if (left <= 0) {
      const a = this.state.a.score | 0;
      const b = this.state.b.score | 0;
      let winner = null;
      if (a > b) winner = 'a';
      else if (b > a) winner = 'b';
      this.end('time', winner);
      return;
    }
    // Re-check stuck every second so match cannot hang if a client desyncs
    if (this.state.a.stuck || this.state.b.stuck || left % 3 === 0) {
      this.evaluateStuck();
    }
    // Soft clock pulse every 5s
    if (left % 5 === 0) {
      this.broadcast({
        type: 'clock',
        vsTimeLeft: left,
        clockEndTs: this.clockEndTs,
        aOnline: this.state.a.online,
        bOnline: this.state.b.online,
        aStuck: !!this.state.a.stuck,
        bStuck: !!this.state.b.stuck
      });
    }
  }
}

function findMatch(player) {
  const duration = player.duration || 120;
  const gapSteps = [75, 100, 150, 220];
  const gap = gapSteps[Math.min(player.expandLevel | 0, gapSteps.length - 1)];
  const keys = nearbyQueueKeys(duration, player.trophies | 0, gap);

  for (const key of keys) {
    const q = queues.get(key);
    if (!q || !q.length) continue;
    // Find compatible opponent
    for (let i = 0; i < q.length; i++) {
      const other = q[i];
      if (!other.ws || other.ws.readyState !== 1) {
        q.splice(i, 1); i--; continue;
      }
      if (other.token === player.token) continue;
      if (other.clientId && player.clientId && other.clientId === player.clientId) continue;
      const dt = Math.abs((other.trophies | 0) - (player.trophies | 0));
      if (dt > gap) continue;
      q.splice(i, 1);
      return other;
    }
  }
  return null;
}

function enqueue(player) {
  const duration = player.duration || 120;
  const key = queueKey(duration, player.trophies | 0);
  if (!queues.has(key)) queues.set(key, []);
  // Remove duplicates for same token
  for (const [k, q] of queues) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === player.token) q.splice(i, 1);
    }
  }
  queues.get(key).push(player);
}

function dequeueToken(token) {
  for (const q of queues.values()) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === token) q.splice(i, 1);
    }
  }
}

function startRoom(p1, p2, meta) {
  meta = meta || {};
  const duration = p1.duration || p2.duration || 120;
  const room = new MatchRoom(p1, p2, duration);
  room.source = meta.source || 'ranked';
  room.privateCode = meta.code || null;
  room.attach(p1.token, p1.ws);
  room.attach(p2.token, p2.ws);

  for (const token of [p1.token, p2.token]) {
    const snap = room.snapshotFor(token);
    room.send(token, {
      type: 'match_found',
      matchId: room.id,
      token,
      duration: room.duration,
      clockEndTs: room.clockEndTs,
      vsTimeLeft: room.timeLeft(),
      me: snap.me,
      opp: snap.opp,
      seat: snap.seat,
      source: room.source,
      privateCode: room.privateCode
    });
  }
  return room;
}

function genPrivateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function leavePrivateLobby(token) {
  for (const [code, lobby] of privateLobbies) {
    if (lobby.host && lobby.host.token === token) {
      if (lobby.guest && lobby.guest.ws) {
        send(lobby.guest.ws, { type: 'private_closed', code, reason: 'host_left' });
      }
      privateLobbies.delete(code);
      return code;
    }
    if (lobby.guest && lobby.guest.token === token) {
      lobby.guest = null;
      lobby.hostReady = false;
      lobby.guestReady = false;
      if (lobby.host && lobby.host.ws) {
        send(lobby.host.ws, {
          type: 'private_lobby',
          code,
          role: 'host',
          duration: lobby.duration,
          hostReady: false,
          guestReady: false,
          opp: null
        });
      }
      return code;
    }
  }
  return null;
}

function lobbySnapshot(lobby, role) {
  const opp = role === 'host' ? lobby.guest : lobby.host;
  return {
    type: 'private_lobby',
    code: lobby.code,
    role,
    duration: lobby.duration,
    hostReady: !!lobby.hostReady,
    guestReady: !!lobby.guestReady,
    opp: opp ? {
      name: opp.name,
      trophies: opp.trophies | 0,
      friendCode: opp.friendCode || null
    } : null
  };
}

function tryStartPrivate(lobby) {
  if (!lobby || !lobby.host || !lobby.guest) return false;
  if (!lobby.hostReady || !lobby.guestReady) return false;
  const code = lobby.code;
  privateLobbies.delete(code);
  const p1 = {
    token: lobby.host.token,
    ws: lobby.host.ws,
    name: lobby.host.name,
    trophies: lobby.host.trophies | 0,
    duration: lobby.duration
  };
  const p2 = {
    token: lobby.guest.token,
    ws: lobby.guest.ws,
    name: lobby.guest.name,
    trophies: lobby.guest.trophies | 0,
    duration: lobby.duration
  };
  // Bind duration onto both
  p1.duration = lobby.duration;
  p2.duration = lobby.duration;
  startRoom(p1, p2, { source: 'lobby', code });
  return true;
}

// ─── WebSocket ─────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, msg) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(msg)); } catch (_) {}
}

wss.on('connection', (ws) => {
  ws._token = uid('t');
  ws._matchId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  send(ws, { type: 'hello', token: ws._token });

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(String(raw)); } catch (_) { return; }
    if (!data || typeof data !== 'object') return;
    const type = data.type;

    if (type === 'join_queue') {
      dequeueToken(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        // Already in a match — ignore queue
        const room = rooms.get(ws._matchId);
        const snap = room.snapshotFor(ws._token);
        if (snap) send(ws, snap);
        return;
      }
      const player = {
        token: ws._token,
        ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
        expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
        clientId: data.clientId ? String(data.clientId).slice(0, 64) : null
      };
      const opp = findMatch(player);
      if (opp) {
        dequeueToken(opp.token);
        startRoom(opp, player);
      } else {
        enqueue(player);
        send(ws, { type: 'queued', duration: player.duration, trophies: player.trophies });
      }
      return;
    }

    if (type === 'leave_queue') {
      dequeueToken(ws._token);
      send(ws, { type: 'queue_left' });
      return;
    }

    if (type === 'expand_queue') {
      // Re-queue with wider gap
      dequeueToken(ws._token);
      const player = {
        token: ws._token,
        ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
        expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
        clientId: data.clientId ? String(data.clientId).slice(0, 64) : null
      };
      const opp = findMatch(player);
      if (opp) {
        dequeueToken(opp.token);
        startRoom(opp, player);
      } else {
        enqueue(player);
        send(ws, { type: 'queued', expandLevel: player.expandLevel });
      }
      return;
    }

    if (type === 'rejoin') {
      const matchId = data.matchId;
      const token = data.token || ws._token;
      const room = matchId ? rooms.get(matchId) : null;
      if (!room || !room.getPlayer(token)) {
        send(ws, { type: 'rejoin_fail', reason: 'not_found' });
        return;
      }
      // Allow reclaiming token on new socket
      ws._token = token;
      room.attach(token, ws);
      const snap = room.snapshotFor(token);
      if (snap) {
        snap.type = 'rejoin_ok';
        send(ws, snap);
      }
      room.broadcast({
        type: 'peer_status',
        seat: room.getPlayer(token).seat,
        online: true,
        vsTimeLeft: room.timeLeft(),
        clockEndTs: room.clockEndTs
      }, token);
      return;
    }

    // ─── Private lobby (friendly rooms, no P2P) ───────────────────────────
    if (type === 'create_private') {
      dequeueToken(ws._token);
      leavePrivateLobby(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        send(ws, { type: 'private_error', reason: 'in_match' });
        return;
      }
      let code = genPrivateCode();
      let guard = 0;
      while (privateLobbies.has(code) && guard++ < 20) code = genPrivateCode();
      const duration = (data.duration === 60 || data.duration === 180) ? data.duration : 120;
      const lobby = {
        code,
        duration,
        hostReady: false,
        guestReady: false,
        createdAt: Date.now(),
        host: {
          token: ws._token,
          ws,
          name: String(data.name || 'Игрок').slice(0, 24),
          trophies: Math.max(0, data.trophies | 0),
          friendCode: data.friendCode ? String(data.friendCode).slice(0, 16) : null
        },
        guest: null
      };
      privateLobbies.set(code, lobby);
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'host'));
      return;
    }

    if (type === 'join_private') {
      dequeueToken(ws._token);
      leavePrivateLobby(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        send(ws, { type: 'private_error', reason: 'in_match' });
        return;
      }
      const code = String(data.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const lobby = privateLobbies.get(code);
      if (!lobby || !lobby.host) {
        send(ws, { type: 'private_error', reason: 'not_found', code });
        return;
      }
      if (lobby.guest) {
        send(ws, { type: 'private_error', reason: 'full', code });
        return;
      }
      if (lobby.host.token === ws._token) {
        send(ws, { type: 'private_error', reason: 'self', code });
        return;
      }
      lobby.guest = {
        token: ws._token,
        ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        friendCode: data.friendCode ? String(data.friendCode).slice(0, 16) : null
      };
      lobby.hostReady = false;
      lobby.guestReady = false;
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'guest'));
      send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      return;
    }

    if (type === 'leave_private') {
      const code = leavePrivateLobby(ws._token);
      ws._privateCode = null;
      send(ws, { type: 'private_left', code: code || null });
      return;
    }

    if (type === 'private_ready') {
      const code = ws._privateCode || String(data.code || '').toUpperCase();
      const lobby = privateLobbies.get(code);
      if (!lobby) {
        send(ws, { type: 'private_error', reason: 'not_found' });
        return;
      }
      const ready = !!data.ready;
      if (lobby.host && lobby.host.token === ws._token) lobby.hostReady = ready;
      else if (lobby.guest && lobby.guest.token === ws._token) lobby.guestReady = ready;
      else {
        send(ws, { type: 'private_error', reason: 'not_in_lobby' });
        return;
      }
      if (lobby.host && lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
      tryStartPrivate(lobby);
      return;
    }

    if (type === 'private_duration') {
      const code = ws._privateCode || String(data.code || '').toUpperCase();
      const lobby = privateLobbies.get(code);
      if (!lobby || !lobby.host || lobby.host.token !== ws._token) return;
      const duration = (data.duration === 60 || data.duration === 180) ? data.duration : 120;
      lobby.duration = duration;
      lobby.hostReady = false;
      lobby.guestReady = false;
      if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
      return;
    }

    // ─── Presence (friends online without PeerJS) ─────────────────────────
    if (type === 'presence_register') {
      const code = String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!code) return;
      presence.set(code, {
        token: ws._token,
        ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        activity: String(data.activity || 'online').slice(0, 32),
        trophies: Math.max(0, data.trophies | 0),
        ts: Date.now()
      });
      ws._friendCode = code;
      send(ws, { type: 'presence_ok', friendCode: code });
      return;
    }

    if (type === 'presence_query') {
      const codes = Array.isArray(data.codes) ? data.codes : [];
      const result = {};
      for (const raw of codes.slice(0, 40)) {
        const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        if (!code) continue;
        const p = presence.get(code);
        if (p && p.ws && p.ws.readyState === 1) {
          result[code] = {
            online: true,
            name: p.name,
            activity: p.activity,
            trophies: p.trophies | 0
          };
        } else {
          result[code] = { online: false };
        }
      }
      send(ws, { type: 'presence_state', friends: result });
      return;
    }

    if (type === 'presence_activity') {
      if (ws._friendCode && presence.has(ws._friendCode)) {
        const p = presence.get(ws._friendCode);
        p.activity = String(data.activity || 'online').slice(0, 32);
        p.ts = Date.now();
      }
      return;
    }

    // Relay social messages to an online friend by friendCode (replaces PeerJS)
    // payload types: friend_req, friend_req_cancel, friend_req_ack, friend_remove,
    // challenge, challenge_cancel, challenge_decline, challenge_accept, ...
    if (type === 'social_send') {
      const to = String(data.to || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!to) {
        send(ws, { type: 'social_result', ok: false, reason: 'bad_target' });
        return;
      }
      const target = presence.get(to);
      if (!target || !target.ws || target.ws.readyState !== 1) {
        send(ws, { type: 'social_result', ok: false, reason: 'offline', to });
        return;
      }
      const fromCode = ws._friendCode || String(data.from || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      const msgType = String(data.msgType || data.socialType || 'message').slice(0, 40);
      const payload = (data.payload && typeof data.payload === 'object') ? data.payload : {};
      const out = Object.assign({}, payload, {
        type: msgType,
        code: fromCode,
        from: fromCode,
        name: String(data.name || payload.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, (data.trophies != null ? data.trophies : payload.trophies) | 0),
        activity: String(data.activity || payload.activity || 'online').slice(0, 32),
        via: 'ws'
      });
      // Allow room code in challenges
      if (payload.room) out.room = String(payload.room).slice(0, 12);
      if (payload.reason) out.reason = String(payload.reason).slice(0, 40);
      send(target.ws, { type: 'social_msg', msg: out });
      send(ws, { type: 'social_result', ok: true, to, msgType });
      return;
    }

    if (type === 'place') {
      const room = rooms.get(ws._matchId);
      if (room) room.applyPlace(ws._token, data);
      return;
    }
    if (type === 'deal') {
      const room = rooms.get(ws._matchId);
      if (room) room.applyDeal(ws._token, data);
      return;
    }
    if (type === 'sync') {
      const room = rooms.get(ws._matchId);
      if (room) room.applySync(ws._token, data);
      return;
    }
    if (type === 'forfeit') {
      const room = rooms.get(ws._matchId);
      if (room) room.forfeit(ws._token);
      return;
    }
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
            room.broadcast({
              type: 'peer_status',
              seat: p.seat,
              online: true,
              vsTimeLeft: room.timeLeft()
            }, ws._token);
          }
        }
      }
      return;
    }
    if (type === 'leave_match') {
      const room = rooms.get(ws._matchId);
      if (room) room.detach(ws._token);
      return;
    }
  });

  ws.on('close', () => {
    dequeueToken(ws._token);
    leavePrivateLobby(ws._token);
    if (ws._friendCode && presence.has(ws._friendCode)) {
      const p = presence.get(ws._friendCode);
      if (p && p.token === ws._token) presence.delete(ws._friendCode);
    }
    if (ws._matchId && rooms.has(ws._matchId)) {
      rooms.get(ws._matchId).detach(ws._token);
    }
  });
});

// Heartbeat: drop dead sockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch (_) {}
      return;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 25000);

// Periodic matchmaking expand: try wider bands for long waiters
setInterval(() => {
  // no-op: clients send expand_queue; server matches on enqueue
}, 10000);

app.get('*', (req, res, next) => {
  if (req.path === '/health' || req.path === '/ws') return next();
  res.sendFile(path.join(PUBLIC, 'index.html'), (err) => {
    if (err) next(err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Block Puzzle authoritative rooms on', PORT, '| ws /ws');
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
