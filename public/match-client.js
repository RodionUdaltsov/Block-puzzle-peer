/**
 * MatchClient — reliable WebSocket client for ranked, rooms, presence, social.
 */
(function (global) {
  'use strict';

  function saveMatchCreds(matchId, token, seat) {
    try {
      if (matchId) {
        sessionStorage.setItem('bp_match_id', matchId);
        localStorage.setItem('bp_match_id', matchId);
      }
      if (token) {
        sessionStorage.setItem('bp_match_token', token);
        localStorage.setItem('bp_match_token', token);
      }
      if (seat) {
        sessionStorage.setItem('bp_match_seat', seat);
        localStorage.setItem('bp_match_seat', seat);
      }
      localStorage.setItem('bp_match_saved_at', String(Date.now()));
    } catch (_) {}
  }
  function loadMatchCreds() {
    try {
      let mid = sessionStorage.getItem('bp_match_id') || localStorage.getItem('bp_match_id');
      let tok = sessionStorage.getItem('bp_match_token') || localStorage.getItem('bp_match_token');
      let seat = sessionStorage.getItem('bp_match_seat') || localStorage.getItem('bp_match_seat');
      const at = parseInt(localStorage.getItem('bp_match_saved_at') || '0', 10);
      // Expire after 30 minutes
      if (at && Date.now() - at > 30 * 60 * 1000) {
        clearMatchCreds();
        return null;
      }
      if (mid && tok) return { matchId: mid, token: tok, seat: seat || null };
    } catch (_) {}
    return null;
  }
  function clearMatchCreds() {
    try {
      sessionStorage.removeItem('bp_match_id');
      sessionStorage.removeItem('bp_match_token');
      sessionStorage.removeItem('bp_match_seat');
      localStorage.removeItem('bp_match_id');
      localStorage.removeItem('bp_match_token');
      localStorage.removeItem('bp_match_seat');
      localStorage.removeItem('bp_match_saved_at');
    } catch (_) {}
  }

  const MatchClient = {
    ws: null,
    token: null,
    matchId: null,
    seat: null,
    connected: false,
    handlers: {},
    _eventBuf: [],
    _handlersReady: false,
    _retry: 0,
    _wantQueue: null,
    _pending: [],
    _pingIv: null,
    lastRtt: null,
    _reconnectTimer: null,
    _wantClose: false,
    _openWaiters: [],
    _lastPresence: null,

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
      if (!arr.length && !this._handlersReady) {
        this._eventBuf.push({ type, data });
        if (this._eventBuf.length > 40) this._eventBuf.shift();
        return;
      }
      for (let i = 0; i < arr.length; i++) {
        try { arr[i](data); } catch (e) { console.warn('MatchClient', type, e); }
      }
      const any = this.handlers['*'] || [];
      for (let i = 0; i < any.length; i++) {
        try { any[i](type, data); } catch (_) {}
      }
    },
    markHandlersReady() {
      this._handlersReady = true;
      const buf = this._eventBuf.splice(0, this._eventBuf.length);
      for (let i = 0; i < buf.length; i++) {
        this._emit(buf[i].type, buf[i].data);
      }
    },

    url() {
      // Explicit override
      try {
        if (typeof window !== 'undefined' && window.BP_WS_URL) return String(window.BP_WS_URL);
      } catch (_) {}
      try {
        const meta = typeof document !== 'undefined' && document.querySelector('meta[name="bp-ws"]');
        if (meta && meta.content) return meta.content;
      } catch (_) {}
      try {
        // file:// or empty host → localhost server
        const host = (location && location.host) ? location.host : '';
        const proto = (location && location.protocol === 'https:') ? 'wss:' : 'ws:';
        if (!host || location.protocol === 'file:') {
          return 'ws://127.0.0.1:9000/ws';
        }
        return proto + '//' + host + '/ws';
      } catch (_) {
        return 'ws://127.0.0.1:9000/ws';
      }
    },

    waitForOpen(ms) {
      ms = ms || 8000;
      if (this.connected && this.ws && this.ws.readyState === 1) {
        return Promise.resolve(true);
      }
      this.connect();
      return new Promise((resolve) => {
        const t = setTimeout(() => {
          this._openWaiters = this._openWaiters.filter(w => w !== done);
          resolve(false);
        }, ms);
        const done = (ok) => {
          clearTimeout(t);
          resolve(!!ok);
        };
        this._openWaiters.push(done);
      });
    },


    detectClientPlatform() {
      let device = 'desktop';
      let os = 'unknown';
      try {
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const coarse = !!(window.matchMedia && (
          window.matchMedia('(pointer: coarse)').matches ||
          window.matchMedia('(hover: none)').matches
        ));
        const touch = ('ontouchstart' in window) && (navigator.maxTouchPoints > 0);
        if (/Android/i.test(ua)) os = 'android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios';
        else if (/Windows/i.test(ua)) os = 'windows';
        else if (/Mac OS|Macintosh/i.test(ua)) os = 'macos';
        else if (/Linux/i.test(ua)) os = 'linux';
        if (/iPad/i.test(ua) || (os === 'ios' && Math.min(screen.width, screen.height) >= 768)) device = 'tablet';
        else if (coarse || touch || /Android|iPhone|iPod/i.test(ua)) device = 'mobile';
        else device = 'desktop';
      } catch (_) {}
      return { platform: device, os: os };
    },

    sendClientInfo() {
      try {
        const info = this.detectClientPlatform();
        this._platform = info.platform;
        this._os = info.os;
        let proto = 1;
        try {
          if (typeof BPRules !== 'undefined' && BPRules.PROTOCOL_VERSION) proto = BPRules.PROTOCOL_VERSION;
        } catch (_) {}
        this.send({
          type: 'client_info',
          platform: info.platform,
          os: info.os,
          protocolVersion: proto,
          build: 'v3929m6'
        });
      } catch (_) {}
    },
    connect() {
      this._wantClose = false;
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
      const candidates = [];
      try { candidates.push(this.url()); } catch (_) {}
      // Fallbacks if primary fails later
      const seen = {};
      const add = (u) => { if (u && !seen[u]) { seen[u] = 1; candidates.push(u); } };
      try {
        const host = (location && location.hostname) ? location.hostname : '127.0.0.1';
        const isHttps = location && location.protocol === 'https:';
        add((isHttps ? 'wss:' : 'ws:') + '//' + host + ':9000/ws');
        add('ws://127.0.0.1:9000/ws');
        add('ws://localhost:9000/ws');
      } catch (_) {
        add('ws://127.0.0.1:9000/ws');
      }
      const tryUrl = candidates[this._retry % candidates.length] || candidates[0];
      let ws;
      try {
        ws = new WebSocket(tryUrl);
        this._lastUrl = tryUrl;
        console.log('[MatchClient] connecting', tryUrl);
      } catch (e) {
        console.warn('MatchClient connect fail', e);
        this._scheduleReconnect();
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        try { this.sendClientInfo(); } catch (_) {}
        this._retry = 0;
        console.log('[MatchClient] open', this._lastUrl || this.url());
        this._emit('open', {});
        const waiters = this._openWaiters.splice(0, this._openWaiters.length);
        for (let i = 0; i < waiters.length; i++) {
          try { waiters[i](true); } catch (_) {}
        }
        if (this._pingIv) clearInterval(this._pingIv);
        this._pingIv = setInterval(() => this.send({ type: 'ping', t: Date.now() }), 4000);

        // Flush queue
        const queued = this._pending.splice(0, this._pending.length);
        for (let i = 0; i < queued.length; i++) {
          try { ws.send(JSON.stringify(queued[i])); } catch (_) {}
        }

        // Re-register presence
        if (this._lastPresence) {
          try { ws.send(JSON.stringify(Object.assign({ type: 'presence_register' }, this._lastPresence))); } catch (_) {}
        }

        // Prefer in-memory, else sessionStorage (page refresh)
        try {
          if (!this.matchId || !this.token) {
            const creds = loadMatchCreds();
            if (creds) {
              this.matchId = creds.matchId;
              this.token = creds.token;
              if (creds.seat) this.seat = creds.seat;
            }
          }
        } catch (_) {}
        if (this.matchId && this.token && !this._skipAutoRejoin) {
          const now = Date.now();
          // Rapid refresh storm: at most 1 auto-rejoin / 2.5s
          if (!this._lastAutoRejoinAt || (now - this._lastAutoRejoinAt) > 2500) {
            this._lastAutoRejoinAt = now;
            console.log('[MatchClient] auto-rejoin', this.matchId);
            this.send({ type: 'rejoin', matchId: this.matchId, token: this.token });
          } else {
            console.log('[MatchClient] auto-rejoin skipped (storm)');
          }
        } else if (this._wantQueue) {
          this.send(Object.assign({ type: 'join_queue' }, this._wantQueue));
        }
        this._skipAutoRejoin = false;
      };
      ws.onclose = () => {
        this.connected = false;
        if (this._pingIv) { clearInterval(this._pingIv); this._pingIv = null; }
        this._emit('close', {});
        if (!this._wantClose) this._scheduleReconnect();
      };
      ws.onerror = () => {};
      ws.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch (_) { return; }
        if (!data || !data.type) return;
        if (data.type === 'hello' && data.token) {
          if (!this.matchId) this.token = data.token;
        }
        if (data.type === 'pong' && data.t) {
          const rtt = Math.max(0, Date.now() - (data.t | 0));
          // Background tab timers inflate RTT to 2–5s — ignore outliers
          if (rtt <= 900) {
            this.lastRtt = rtt;
            try { this._emit('rtt', { rtt }); } catch (_) {}
          }
        }
        if (data.type === 'match_found' || data.type === 'rejoin_ok') {
          if (data.matchId) this.matchId = data.matchId;
          if (data.token) this.token = data.token;
          if (data.seat) this.seat = data.seat;
          saveMatchCreds(this.matchId, this.token, this.seat);
          console.log('[MatchClient]', data.type, this.matchId, this.seat);
        }
        if (data.type === 'match_end') {
          // Keep matchId/token for rematch window (server keeps room ~3 min)
          // clearMatchCreds only after rematch starts (new match_found) or leave
          try {
            if (this.matchId) saveMatchCreds(this.matchId, this.token, this.seat);
          } catch (_) {}
        }
        if (data.type === 'rejoin_fail') {
          console.warn('[MatchClient] rejoin_fail', data.reason);
          // Keep creds if not_found might be race — only clear on ended
          if (data.reason === 'ended') {
            this.matchId = null;
            clearMatchCreds();
          }
        }
        this._emit(data.type, data);
      };
    },

    disconnect() {
      this._wantClose = true;
      if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
      if (this._pingIv) { clearInterval(this._pingIv); this._pingIv = null; }
      try { if (this.ws) this.ws.close(); } catch (_) {}
      this.ws = null;
      this.connected = false;
    },

    _scheduleReconnect() {
      if (this._reconnectTimer) return;
      if (this._retry > 50) return;
      const delay = Math.min(12000, 300 + this._retry * 300);
      this._retry++;
      this._reconnectTimer = setTimeout(() => {
        this._reconnectTimer = null;
        this.connect();
      }, delay);
    },

    send(obj) {
      if (!obj || typeof obj !== 'object') return false;
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send(JSON.stringify(obj));
          return true;
        } catch (_) {
          return false;
        }
      }
      this._pending.push(obj);
      if (this._pending.length > 50) this._pending.shift();
      this.connect();
      return true;
    },

    async sendWhenOpen(obj, waitMs) {
      const ok = await this.waitForOpen(waitMs || 8000);
      if (!ok) return false;
      return this.send(obj);
    },

    joinQueue(opts) {
      opts = opts || {};
      const plat = this.detectClientPlatform ? this.detectClientPlatform() : { platform: 'web', os: 'unknown' };
      this._wantQueue = {
        name: opts.name || 'Игрок',
        trophies: opts.trophies | 0,
        skinId: opts.skinId || 'default',
        boardId: opts.boardId || 'field_default',
        avatarId: opts.avatarId || 'init',
        avatarCustom: opts.avatarCustom || '',
        duration: opts.duration || 120,
        expandLevel: opts.expandLevel | 0,
        clientId: opts.clientId || null,
        platform: opts.platform || plat.platform,
        os: opts.os || plat.os,
        protocolVersion: (typeof BPRules !== 'undefined' && BPRules.PROTOCOL_VERSION) ? BPRules.PROTOCOL_VERSION : 1
      };
      this.connect();
      return this.send(Object.assign({ type: 'join_queue' }, this._wantQueue));
    },
    expandQueue(level) {
      if (!this._wantQueue) return false;
      this._wantQueue.expandLevel = level | 0;
      return this.send(Object.assign({ type: 'expand_queue' }, this._wantQueue));
    },
    leaveQueue() {
      this._wantQueue = null;
      return this.send({ type: 'leave_queue' });
    },
    rejoin(matchId, token) {
      this.matchId = matchId || this.matchId;
      this.token = token || this.token;
      if (!this.matchId || !this.token) return false;
      this.connect();
      // Prefer sendWhenOpen so rejoin is not lost while socket is connecting
      this.sendWhenOpen({ type: 'rejoin', matchId: this.matchId, token: this.token }, 8000);
      return true;
    },
    tryResumeFromStorage() {
      const creds = loadMatchCreds();
      if (creds) {
        this.matchId = creds.matchId;
        this.token = creds.token;
        if (creds.seat) this.seat = creds.seat;
        console.log('[MatchClient] resume', this.matchId);
        this.rejoin(this.matchId, this.token);
        return true;
      }
      return false;
    },
    matchReady() {
      const body = { type: 'match_ready' };
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    place(payload) {
      const body = Object.assign({ type: 'place' }, payload || {});
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    deal(payload) {
      const body = Object.assign({ type: 'deal' }, payload || {});
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    sync(payload) {
      const body = Object.assign({ type: 'sync' }, payload || {});
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    forfeit() {
      const body = { type: 'forfeit' };
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    rematchOffer() {
      const body = { type: 'rematch_offer' };
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    rematchAccept() {
      const body = { type: 'rematch_accept' };
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    rematchDecline() {
      const body = { type: 'rematch_decline' };
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    rematchCancel() {
      const body = { type: 'rematch_cancel' };
      if (this.matchId) body.matchId = this.matchId;
      if (this.token) body.token = this.token;
      return this.send(body);
    },
    leaveMatch() {
      try { this.send({ type: 'leave_match' }); } catch (_) {}
      try { this.send({ type: 'free_match' }); } catch (_) {}
      this.matchId = null;
      this.token = null;
      this.seat = null;
      clearMatchCreds();
    },
    freeMatch() {
      try { this.send({ type: 'free_match' }); } catch (_) {}
      this.matchId = null;
      this.token = null;
      this.seat = null;
      clearMatchCreds();
    },

    createPrivate(opts) {
      opts = opts || {};
      this.connect();
      const plat = this.detectClientPlatform ? this.detectClientPlatform() : { platform: 'web', os: 'unknown' };
      return this.send({
        type: 'create_private',
        name: opts.name || 'Игрок',
        trophies: opts.trophies | 0,
        skinId: opts.skinId || 'default',
        boardId: opts.boardId || 'field_default',
        avatarId: opts.avatarId || 'init',
        avatarCustom: opts.avatarCustom || '',
        duration: opts.duration || 120,
        friendCode: opts.friendCode || null,
        platform: plat.platform,
        os: plat.os,
        protocolVersion: 1
      });
    },
    joinPrivate(code, opts) {
      opts = opts || {};
      this.connect();
      const plat = this.detectClientPlatform ? this.detectClientPlatform() : { platform: 'web', os: 'unknown' };
      return this.send({
        type: 'join_private',
        code: String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
        name: opts.name || 'Игрок',
        trophies: opts.trophies | 0,
        skinId: opts.skinId || 'default',
        boardId: opts.boardId || 'field_default',
        avatarId: opts.avatarId || 'init',
        avatarCustom: opts.avatarCustom || '',
        friendCode: opts.friendCode || null,
        platform: plat.platform,
        os: plat.os,
        protocolVersion: 1
      });
    },
    leavePrivate() { return this.send({ type: 'leave_private' }); },
    privateReady(ready, code) {
      return this.send({ type: 'private_ready', ready: !!ready, code: code || null });
    },
    privateDuration(duration, code) {
      return this.send({ type: 'private_duration', duration: duration | 0, code: code || null });
    },

    registerPresence(opts) {
      opts = opts || {};
      this._lastPresence = {
        friendCode: opts.friendCode,
        name: opts.name || 'Игрок',
        activity: opts.activity || 'online',
        trophies: opts.trophies | 0
      };
      // One-time migration hint so server can seed ownership from localStorage
      if (opts.cosmeticsHint && typeof opts.cosmeticsHint === 'object') {
        this._lastPresence.cosmeticsHint = {
          diamonds: opts.cosmeticsHint.diamonds | 0,
          ownedSkins: Array.isArray(opts.cosmeticsHint.ownedSkins) ? opts.cosmeticsHint.ownedSkins.slice(0, 64) : undefined,
          ownedBoards: Array.isArray(opts.cosmeticsHint.ownedBoards) ? opts.cosmeticsHint.ownedBoards.slice(0, 64) : undefined,
          equippedSkin: opts.cosmeticsHint.equippedSkin || undefined,
          equippedBoard: opts.cosmeticsHint.equippedBoard || undefined
        };
      }
      this.connect();
      return this.send(Object.assign({ type: 'presence_register' }, this._lastPresence));
    },
    cosmeticsGet() {
      return this.send({ type: 'cosmetics_get' });
    },
    cosmeticsBuy(kind, id) {
      return this.send({ type: 'cosmetics_buy', kind: kind === 'board' ? 'board' : 'skin', id: String(id || '') });
    },
    cosmeticsEquip(kind, id) {
      return this.send({ type: 'cosmetics_equip', kind: kind === 'board' ? 'board' : 'skin', id: String(id || '') });
    },
    queryPresence(codes) {
      return this.send({ type: 'presence_query', codes: codes || [] });
    },
    /** Search online players by nickname or friend code (server presence). */
    presenceSearch(q) {
      return this.send({ type: 'presence_search', q: String(q || '').slice(0, 24) });
    },
    /** Check whether a 6-char friend code is known (online or recent presence). */
    friendCodeCheck(code) {
      return this.send({ type: 'friend_code_check', code: String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) });
    },
    setActivity(activity) {
      if (this._lastPresence) this._lastPresence.activity = activity || 'online';
      return this.send({ type: 'presence_activity', activity: activity || 'online' });
    },
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

  function boot() {
    try {
      // Restore match credentials BEFORE connect so onopen can rejoin immediately
      try {
        const creds = loadMatchCreds();
        if (creds) {
          MatchClient.matchId = creds.matchId;
          MatchClient.token = creds.token;
          if (creds.seat) MatchClient.seat = creds.seat;
        }
      } catch (_) {}
      MatchClient.connect();
      setTimeout(() => {
        try { MatchClient.tryResumeFromStorage(); } catch (_) {}
      }, 600);
      setTimeout(() => {
        try { MatchClient.tryResumeFromStorage(); } catch (_) {}
      }, 2000);
    } catch (_) {}
  }
  try {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
    }
  } catch (_) {}

  global.MatchClient = MatchClient;
})(typeof window !== 'undefined' ? window : global);
