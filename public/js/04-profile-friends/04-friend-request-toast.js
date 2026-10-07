/**
 * Block Puzzle — js/04-profile-friends/04-friend-request-toast.js
 * Friend-request toast, respond flow and request list rendering.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
let frToastHideTimer = null;
let frToastCountTimer = null;
function clearFrToastHideTimer() {
  if (frToastHideTimer) { clearTimeout(frToastHideTimer); frToastHideTimer = null; }
  if (frToastCountTimer) { clearInterval(frToastCountTimer); frToastCountTimer = null; }
}
function startToastCountdown(elId, seconds, onZero) {
  const el = document.getElementById(elId);
  let left = Math.max(1, seconds | 0);
  const paint = () => {
    if (el) el.textContent = (typeof globalThis.t==='function'?globalThis.t('js.hideIn','Скроется через {n} с',{n:left}):('Скроется через '+left+' с'));
  };
  paint();
  const tickId = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(tickId);
      if (el) el.textContent = (typeof globalThis.t==='function'?globalThis.t('js.hiding','Скроется…'):'Скроется…');
      if (onZero) onZero();
      return;
    }
    paint();
  }, 1000);
  return tickId;
}
function showFrToast(req) {
  const toast = document.getElementById('frToast');
  if (!toast || !req) return;
  frActiveToast = req;
  clearFrToastHideTimer();
  const av = document.getElementById('frToastAv');
  const name = document.getElementById('frToastName');
  const meta = document.getElementById('frToastMeta');
  if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
  if (name) name.textContent = req.name || req.code;
  if (meta) {
    const parts = ['код ' + req.code];
    if (req.trophies != null) parts.push('🏆 ' + req.trophies);
    meta.textContent = parts.join(' · ');
  }
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('out', 'dragging');
  void toast.offsetWidth;
  toast.classList.add('visible');
  frToastCountTimer = startToastCountdown('frToastCountdown', 15, null);
  frToastHideTimer = setTimeout(() => {
    frToastHideTimer = null;
    if (frActiveToast === req) dismissFrToast(true);
  }, 15000);
}

/** Hide toast only — request stays in frIncoming / «Друзья» */
function dismissFrToast(animate) {
  const toast = document.getElementById('frToast');
  if (!toast) return;
  clearFrToastHideTimer();
  frActiveToast = null;
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('dragging');
  if (animate === false) {
    toast.classList.remove('visible', 'out');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out'), 400);
}

function hideFrToast(animate) {
  // backward-compatible alias: hide UI only, keep pending request
  dismissFrToast(animate);
}

function respondFriendReq(req, accept) {
  if (!req) return;
  const payload = accept ? {
    type: 'friend_accept',
    code: myFriendCode,
    name: myNickname,
    trophies: typeof trophies === 'number' ? trophies : 0,
    activity: detectMyActivity()
  } : {
    type: 'friend_decline',
    code: myFriendCode,
    reason: 'declined'
  };
  try {
    if (req.conn && req.conn.open) {
      req.conn.send(payload);
    }
  } catch (_) {}
  // Always deliver via presence relay so sender clears outgoing even if original conn died
  try {
    deliverSocialMessage(req.code, payload).then((ok) => {
      if (accept && !ok) {
        // Retry once after short delay
        setTimeout(() => {
          try { deliverSocialMessage(req.code, payload); } catch (_) {}
        }, 2000);
      }
    });
  } catch (_) {}
  const finishResp = () => {
    if (accept) {
      addFriendRecord(req.code, req.name, { trophies: req.trophies });
      try { SFX.win && SFX.win(); } catch (_) {}
      setFriendAddStatus('Вы теперь друзья с ' + (req.name || req.code), 'ok');
    } else {
      clearFriendRequestState(req.code);
      setFriendAddStatus('Запрос отклонён', 'err');
    }
    frIncoming = frIncoming.filter(r => r !== req && r.code !== req.code);
    if (frActiveToast === req) dismissFrToast(true);
    renderFriendRequests();
    renderFriends(!!accept);
    renderOutgoingPending(false);
    updateFriendsSectionCounts();
  };
  // Animate card out if visible in list
  try {
    const list = document.getElementById('friendReqList');
    const cards = list ? list.querySelectorAll('.friend-req-card') : [];
    let card = null;
    cards.forEach(c => {
      const meta = c.querySelector('.f-meta');
      if (meta && meta.textContent && meta.textContent.indexOf(req.code) >= 0) card = c;
    });
    if (card) {
      card.classList.add('friend-exit');
      setTimeout(finishResp, 360);
      return;
    }
  } catch (_) {}
  finishResp();
  try {
    if (req.conn) setTimeout(() => { try { req.conn.close(); } catch (_) {} }, 400);
  } catch (_) {}
}


(function bindFrToastButtons() {
  if (window._bpFrToastBtns) return;
  window._bpFrToastBtns = true;
  const acc = document.getElementById('frToastAccept');
  const dec = document.getElementById('frToastDecline');
  const dis = document.getElementById('frToastDismiss');
  if (acc) {
    acc.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const req = frActiveToast;
      if (!req) return;
      try { respondFriendReq(req, true); } catch (err) { console.warn('fr toast accept', err); }
    });
  }
  if (dec) {
    dec.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const req = frActiveToast;
      if (!req) return;
      try { respondFriendReq(req, false); } catch (err) { console.warn('fr toast decline', err); }
    });
  }
  if (dis) {
    dis.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { dismissFrToast(true); } catch (_) {}
    });
  }
})();

// Swipe right / up to dismiss friend-request toast (request stays pending)
(function bindFrToastSwipe() {
  const toast = document.getElementById('frToast');
  if (!toast || toast._bpSwipe) return;
  toast._bpSwipe = true;
  let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
  const onStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY;
    startX = t.clientX;
    dy = 0; dx = 0;
    dragging = true;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY;
    dx = t.clientX - startX;
    if (dx > 8 || dy < -8) {
      if (e.cancelable) e.preventDefault();
      const distX = Math.max(0, Math.min(dx, 200));
      const distY = Math.min(0, Math.max(dy, -120));
      toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
      toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
    }
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove('dragging');
    if (dx > 64 || dy < -56) {
      dismissFrToast(true);
      try { setFriendAddStatus('Заявка сохранена', 'ok'); } catch (_) {}
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
    dy = 0; dx = 0;
  };
  toast.addEventListener('touchstart', onStart, { passive: true });
  toast.addEventListener('touchmove', onMove, { passive: false });
  toast.addEventListener('touchend', onEnd, { passive: true });
  toast.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
})();

function renderFriendRequests() {
  const list = document.getElementById('friendReqList');
  if (!list) return;
  try {
    if (null) {
      const roomDead = !mpRoomCode && !(typeof MatchClient !== "undefined" && MatchClient.matchId);
      const full = !!mpOppConnected || !!vsActive;
      if (roomDead || full) {
        const pend = null;
        mpPendingJoin = null;
        try { hideRjToast(false); } catch (_) {}
        try {
          if (pend.conn && pend.conn.open) {
            pend.conn.send({ type: 'join_decline', reason: full ? 'full' : 'closed' });
          }
        } catch (_) {}
        setTimeout(() => { try { if (pend.conn) pend.conn.close(); } catch (_) {} }, 150);
      }
    }
  } catch (_) {}

  const parts = [];
  frIncoming.forEach((r, i) => {
    const initials = escapeHtmlLobby((r.name || r.code || '?').slice(0, 2).toUpperCase());
    const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
    const nm = escapeHtmlLobby((r.name || r.code || 'Игрок').toString());
    parts.push(`<div class="friend-req-card" data-code="${escapeHtmlLobby(r.code)}">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${nm}</div>
        <div class="f-meta"><span class="req-badge">Заявка</span>${escapeHtmlLobby(r.code)}${cups}</div>
      </div>
      <div class="f-actions">
        <button class="primary fr-acc" data-ri="${i}">✓</button>
        <button class="ghost fr-dec" data-ri="${i}">✕</button>
      </div>
    </div>`);
  });

  if (null && mpRoomCode) {
    const r = null;
    const initials = escapeHtmlLobby((r.name || r.code || '?').slice(0, 2).toUpperCase());
    const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
    parts.push(`<div class="friend-req-card lobby-join-card" data-join="1">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${escapeHtmlLobby(r.name || 'Игрок')}</div>
        <div class="f-meta"><span class="req-badge">Вход</span>комната ${escapeHtmlLobby(mpRoomCode)}${r.code ? ' · ' + escapeHtmlLobby(r.code) : ''}${cups}</div>
      </div>
      <div class="f-actions">
        <button class="primary" id="frJoinAcc">✓</button>
        <button class="ghost" id="frJoinDec">✕</button>
      </div>
    </div>`);
  }
  if (typeof chPending !== 'undefined' && chPending && chPending.room) {
    const r = chPending;
    const initials = escapeHtmlLobby((r.name || r.code || '?').slice(0, 2).toUpperCase());
    const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
    const mid = vsActive ? ' · матч идёт' : '';
    parts.push(`<div class="friend-req-card lobby-ch-card" data-ch="1">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${escapeHtmlLobby(r.name || 'Игрок')}</div>
        <div class="f-meta"><span class="req-badge">Лобби</span>${escapeHtmlLobby(r.room)}${mid}${cups}</div>
      </div>
      <div class="f-actions">
        <button class="primary" id="frChAcc">✓</button>
        <button class="ghost" id="frChDec">✕</button>
      </div>
    </div>`);
  }
  if (typeof rmPending !== 'undefined' && rmPending) {
    const r = rmPending;
    const initials = escapeHtmlLobby((r.name || '?').slice(0, 2).toUpperCase());
    parts.push(`<div class="friend-req-card lobby-rm-card" data-rm="1">
      <div class="f-av">${initials}</div>
      <div class="f-info">
        <div class="f-name">${escapeHtmlLobby(r.name || 'Соперник')}</div>
        <div class="f-meta"><span class="req-badge">Реванш</span>предлагает ещё матч</div>
      </div>
      <div class="f-actions">
        <button class="primary" id="frRmAcc">✓</button>
        <button class="ghost" id="frRmDec">✕</button>
      </div>
    </div>`);
  }

  list.innerHTML = parts.join('');
  list.querySelectorAll('.fr-acc').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = frIncoming[parseInt(btn.dataset.ri, 10)];
      respondFriendReq(r, true);
    });
  });
  list.querySelectorAll('.fr-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = frIncoming[parseInt(btn.dataset.ri, 10)];
      respondFriendReq(r, false);
    });
  });
  const ja = document.getElementById('frJoinAcc');
  const jd = document.getElementById('frJoinDec');
  if (ja) ja.addEventListener('click', () => {  });
  if (jd) jd.addEventListener('click', () => {  });
  const ca = document.getElementById('frChAcc');
  const cd = document.getElementById('frChDec');
  if (ca) ca.addEventListener('click', () => { try { acceptChallenge(); } catch (_) {} });
  if (cd) cd.addEventListener('click', () => { try { declineChallenge(); } catch (_) {} });
  const ra = document.getElementById('frRmAcc');
  const rd = document.getElementById('frRmDec');
  if (ra) ra.addEventListener('click', () => { try { acceptRematchInvite(); } catch (_) {} });
  if (rd) rd.addEventListener('click', () => { try { declineRematchInvite(); } catch (_) {} });
  updateFriendsSectionCounts();
}

