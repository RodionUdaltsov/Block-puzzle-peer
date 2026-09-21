/**
 * MatchClient — WebSocket client for ranked, private lobbies, presence & social relay.
 * All multiplayer goes through the server. No PeerJS.
 */
(function (global) {
  'use strict';

  const MatchClient = {
    ws: null,
    token: null,
    matchId: null,
    seat: null,
    connected: false,
    handlers: {},
    _retry: 0,
    _wantQueue: null,
    _pingIv: null,

    on(type, fn) {
      if (!this.handlers[type]) this.handlers[type] = [];
      this.handlers[type].push(fn);
    },
    off(type, fn) {
      const arr = this.handlers[type];
      if (!arr) return;
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    _emit(type, data) {
      const arr = this.handlers[type] || [];
      for (let i = 0; i < arr.length; i++) {
        try { arr[i](data); } catch (e) { console.warn('MatchClient handler', type, e); }
      }
      const any = this.handlers['*'] || [];
      for (let i = 0; i < any.length; i++) {
        try { any[i](type, data); } catch (_) {}
      }
    },

    url() {
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return proto + '//' + location.host + '/ws';
      } catch (_) {
        return 'ws://localhost:9000/ws';
      }
    },

    connect() {
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
      let ws;
      try {
        ws = new WebSocket(this.url());
      } catch (e) {
        console.warn('MatchClient connect fail', e);
        this._scheduleReconnect();
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this._retry = 0;
        this._emit('open', {});
        if (this._pingIv) clearInterval(this._pingIv);
        this._pingIv = setInterval(() => this.send({ type: 'ping', t: Date.now() }), 8000);
        // Resume queue or match
        if (this.matchId && this.token) {
          this.send({ type: 'rejoin', matchId: this.matchId, token: this.token });
        } else if (this._wantQueue) {
          this.send(Object.assign({ type: 'join_queue' }, this._wantQueue));
        }
      };
      ws.onclose = () => {
        this.connected = false;
        if (this._pingIv) { clearInterval(this._pingIv); this._pingIv = null; }
        this._emit('close', {});
        this._scheduleReconnect();
      };
      ws.onerror = () => {};
      ws.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch (_) { return; }
        if (!data || !data.type) return;
        if (data.type === 'hello' && data.token) {
          // Only set token if we don't already have a match token
          if (!this.matchId) this.token = data.token;
        }
        if (data.type === 'match_found' || data.type === 'rejoin_ok') {
          if (data.matchId) this.matchId = data.matchId;
          if (data.token) this.token = data.token;
          if (data.seat) this.seat = data.seat;
          try {
            sessionStorage.setItem('bp_match_id', this.matchId || '');
            sessionStorage.setItem('bp_match_token', this.token || '');
          } catch (_) {}
        }
        if (data.type === 'match_end') {
          try {
            sessionStorage.removeItem('bp_match_id');
            sessionStorage.removeItem('bp_match_token');
          } catch (_) {}
        }
        if (data.type === 'rejoin_fail') {
          this.matchId = null;
          try {
            sessionStorage.removeItem('bp_match_id');
            sessionStorage.removeItem('bp_match_token');
          } catch (_) {}
        }
        this._emit(data.type, data);
      };
    },

    _scheduleReconnect() {
      if (this._retry > 30) return;
      const delay = Math.min(8000, 500 + this._retry * 400);
      this._retry++;
      setTimeout(() => this.connect(), delay);
    },

    send(obj) {
      if (!this.ws || this.ws.readyState !== 1) return false;
      try {
        this.ws.send(JSON.stringify(obj));
        return true;
      } catch (_) { return false; }
    },

    joinQueue(opts) {
      opts = opts || {};
      this._wantQueue = {
        name: opts.name || 'Игрок',
        trophies: opts.trophies | 0,
        duration: opts.duration || 120,
        expandLevel: opts.expandLevel | 0,
        clientId: opts.clientId || null
      };
      this.connect();
      if (this.connected) {
        this.send(Object.assign({ type: 'join_queue' }, this._wantQueue));
      }
    },

    expandQueue(level) {
      if (!this._wantQueue) return;
      this._wantQueue.expandLevel = level | 0;
      this.send(Object.assign({ type: 'expand_queue' }, this._wantQueue));
    },

    leaveQueue() {
      this._wantQueue = null;
      this.send({ type: 'leave_queue' });
    },

    rejoin(matchId, token) {
      this.matchId = matchId || this.matchId;
      this.token = token || this.token;
      this.connect();
      if (this.connected && this.matchId && this.token) {
        this.send({ type: 'rejoin', matchId: this.matchId, token: this.token });
      }
    },

    tryResumeFromStorage() {
      try {
        const mid = sessionStorage.getItem('bp_match_id');
        const tok = sessionStorage.getItem('bp_match_token');
        if (mid && tok) {
          this.rejoin(mid, tok);
          return true;
        }
      } catch (_) {}
      return false;
    },

    place(payload) {
      return this.send(Object.assign({ type: 'place' }, payload || {}));
    },
    deal(payload) {
      return this.send(Object.assign({ type: 'deal' }, payload || {}));
    },
    sync(payload) {
      return this.send(Object.assign({ type: 'sync' }, payload || {}));
    },
    forfeit() {
      return this.send({ type: 'forfeit' });
    },
    leaveMatch() {
      this.send({ type: 'leave_match' });
      this.matchId = null;
      try {
        sessionStorage.removeItem('bp_match_id');
        sessionStorage.removeItem('bp_match_token');
      } catch (_) {}
    },

    // ─── Private lobby (friendly rooms) ───────────────────────────────────
    createPrivate(opts) {
      opts = opts || {};
      this.connect();
      return this.send({
        type: 'create_private',
        name: opts.name || 'Игрок',
        trophies: opts.trophies | 0,
        duration: opts.duration || 120,
        friendCode: opts.friendCode || null
      });
    },
    joinPrivate(code, opts) {
      opts = opts || {};
      this.connect();
      return this.send({
        type: 'join_private',
        code: String(code || '').toUpperCase(),
        name: opts.name || 'Игрок',
        trophies: opts.trophies | 0,
        friendCode: opts.friendCode || null
      });
    },
    leavePrivate() {
      return this.send({ type: 'leave_private' });
    },
    privateReady(ready, code) {
      return this.send({ type: 'private_ready', ready: !!ready, code: code || null });
    },
    privateDuration(duration, code) {
      return this.send({ type: 'private_duration', duration: duration | 0, code: code || null });
    },

    // ─── Presence ─────────────────────────────────────────────────────────
    registerPresence(opts) {
      opts = opts || {};
      this.connect();
      return this.send({
        type: 'presence_register',
        friendCode: opts.friendCode,
        name: opts.name || 'Игрок',
        activity: opts.activity || 'online',
        trophies: opts.trophies | 0
      });
    },
    queryPresence(codes) {
      return this.send({ type: 'presence_query', codes: codes || [] });
    },
    setActivity(activity) {
      return this.send({ type: 'presence_activity', activity: activity || 'online' });
    },

    /**
     * Deliver a social message to a friend by friendCode via server relay.
     * Returns true if the send was queued on the socket (not necessarily delivered).
     * Listen for social_result for delivery ack.
     */
    socialSend(to, msgType, payload, extra) {
      extra = extra || {};
      payload = payload || {};
      return this.send({
        type: 'social_send',
        to: String(to || '').toUpperCase(),
        msgType: msgType,
        payload: payload,
        name: extra.name,
        trophies: extra.trophies,
        activity: extra.activity,
        from: extra.from
      });
    }
  };

  // Auto-resume match after refresh
  try {
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', () => {
        MatchClient.connect();
        setTimeout(() => MatchClient.tryResumeFromStorage(), 200);
      });
    }
  } catch (_) {}

  global.MatchClient = MatchClient;
})(typeof window !== 'undefined' ? window : global);
