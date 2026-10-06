/**
 * Block Puzzle — js/04-profile-friends/06-friends-list-ui.js
 * Friends list UI, add by code, nickname search.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function getFriendSearchQuery() {
  const el = document.getElementById('friendSearchInput');
  return el ? (el.value || '').trim().toLowerCase() : '';
}

function renderFriends(highlightNew) {
  const codeEl = document.getElementById('myFriendCode');
  if (codeEl) codeEl.textContent = myFriendCode;
  renderFriendRequests();
  renderOutgoingPending();
  const list = document.getElementById('friendList');
  if (!list) return;
  if (!friends.length) {
    list.innerHTML = '<div class="friends-section-empty">Пока нет друзей — добавьте по коду выше</div>';
    updateFriendsSectionCounts();
    return;
  }
  const q = getFriendSearchQuery();
  const indexed = friends.map((f, i) => ({ f, i })).filter(({ f }) => {
    if (!q) return true;
    const name = (f.name || '').toLowerCase();
    const code = (f.code || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });
  if (!indexed.length) {
    list.innerHTML = '';
    updateFriendsSectionCounts();
    return;
  }
  list.innerHTML = indexed.map(({ f, i }, visIdx) => {
    const initials = (f.name || f.code || '?').slice(0, 2).toUpperCase();
    const cups = (typeof f.trophies === 'number') ? ` · 🏆 ${f.trophies}` : '';
    // Animate only on first paint of the screen (or new friend) — not on presence refresh
    const scr = document.getElementById('screenFriends');
    const alreadyOpen = !!(scr && scr.classList.contains('active'));
    const anim = (highlightNew && i === 0)
      ? ' friend-added'
      : (!alreadyOpen && visIdx < 8 ? ' friend-enter' : '');
    const delay = (!alreadyOpen && visIdx < 8) ? ` style="animation-delay:${visIdx * 0.04}s"` : '';
    const pres = getFriendPresence(f.code);
    const act = getFriendActivity(f.code);
    const dotCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking';
    let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
    if (pres === 'online' && act) stText = activityLabel(act);
    const stCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : '';
    return `<div class="friend-card${anim}" data-fi="${i}" data-code="${f.code}"${delay}>
      <div class="f-av" data-av-fi="${i}">${initials}<span class="f-online-dot ${dotCls}"></span></div>
      <div class="f-info">
        <div class="f-name">${f.name || 'Друг'}</div>
        <div class="f-code">${f.code}${cups} · <span class="f-status-line ${stCls}" style="display:inline">${stText}</span></div>
      </div>
      <div class="f-actions">
        <button type="button" class="primary f-challenge" data-fi="${i}">Вызов</button>
        <button type="button" class="ghost f-remove" data-fi="${i}">✕</button>
      </div>
    </div>`;
  }).join('');
  // Paint real avatars into friend cards + open mini profile on click
  try {
    list.querySelectorAll('.f-av[data-av-fi]').forEach((avEl) => {
      const fi = parseInt(avEl.getAttribute('data-av-fi'), 10);
      const f = friends[fi];
      if (!f) return;
      const dot = avEl.querySelector('.f-online-dot');
      try {
        renderAvatarInto(avEl, {
          avatarId: f.avatarId || 'init',
          nick: f.name || f.code,
          custom: (f.avatarId === 'custom' && f.avatarCustom) ? f.avatarCustom : null
        });
      } catch (_) {}
      if (dot) {
        try { avEl.appendChild(dot); } catch (_) {
          const d = document.createElement('span');
          d.className = 'f-online-dot ' + (getFriendPresence(f.code) === 'online' ? 'on' : getFriendPresence(f.code) === 'offline' ? 'off' : 'checking');
          avEl.appendChild(d);
        }
      }
      avEl.style.cursor = 'pointer';
      avEl.title = 'Профиль';
      avEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { openFriendMiniProfile(f); } catch (_) {}
      });
    });
  } catch (_) {}
  list.querySelectorAll('.f-challenge').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      challengeFriend(friends[parseInt(btn.dataset.fi, 10)]);
    });
  });
  list.querySelectorAll('.f-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(btn.dataset.fi, 10);
      bpConfirm({
        title: 'Удалить из друзей?',
        text: 'Вы также пропадёте у него в списке.',
        okLabel: 'Удалить',
        danger: true
      }).then(function (ok) { if (ok) removeFriendAt(idx); });
    });
  });
  updateFriendsSectionCounts();
}

// Event delegation backup for friend actions (touch / re-renders)
(function bindFriendListDelegation() {
  const list = document.getElementById('friendList');
  if (!list || list._bpFriendDel) return;
  list._bpFriendDel = true;
  list.addEventListener('click', (e) => {
    const rm = e.target.closest && e.target.closest('.f-remove');
    const ch = e.target.closest && e.target.closest('.f-challenge');
    if (rm) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(rm.dataset.fi, 10);
      if (!isNaN(idx)) {
        bpConfirm({
          title: 'Удалить из друзей?',
          text: 'Вы также пропадёте у него в списке.',
          okLabel: 'Удалить',
          danger: true
        }).then(function (ok) { if (ok) removeFriendAt(idx); });
      }
    } else if (ch) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(ch.dataset.fi, 10);
      if (!isNaN(idx)) challengeFriend(friends[idx]);
    }
  });
})();


function cleanupOutgoingSearch() {
  if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
  frSearchBusy = false;
}

function sendFriendRequestToCode(code, displayName, opts) {
  opts = opts || {};
  code = normalizeFriendCode(code);
  if (!code || code.length < 8) {
    setFriendAddStatus('Нужен код из 8 символов', 'err');
    return;
  }
  if (code === myFriendCode) {
    setFriendAddStatus('Это твой собственный код', 'err');
    return;
  }
  if (friends.some(f => f.code === code)) {
    setFriendAddStatus('Уже в списке друзей', 'err');
    return;
  }
  if (frOutgoingPending.some(p => p.code === code)) {
    renderOutgoingPending();
    setFriendAddStatus('Заявка уже отправлена', 'wait');
    return;
  }
  if (typeof MatchClient === 'undefined') {
    setFriendAddStatus('Сервер недоступен. Обнови страницу.', 'err');
    return;
  }
  if (!checkCrossPlatformReady()) return;
  if (frSearchBusy) {
    setFriendAddStatus('Подождите…', 'wait');
    return;
  }

  // Mandatory existence check (unless already verified, e.g. from nick search pick)
  if (!opts.skipCheck) {
    frSearchBusy = true;
    setFriendAddStatus((typeof globalThis.t==='function'?globalThis.t('friends.codeChecking','Проверяем код…'):'Проверяем код…'), 'wait');
    try { ensureFriendPresence(); } catch (_) {}
    try { MatchClient.connect(); } catch (_) {}
    let settled = false;
    const onCheck = (data) => {
      if (settled) return;
      if (!data || String(data.code || '').toUpperCase() !== code) return;
      settled = true;
      try { MatchClient.off('friend_code_check_result', onCheck); } catch (_) {}
      frSearchBusy = false;
      if (!data.ok) {
        const reason = data.reason || 'not_found';
        if (reason === 'self') setFriendAddStatus('Это твой собственный код', 'err');
        else setFriendAddStatus((typeof globalThis.t==='function'?globalThis.t('friends.codeNotFound','Такого кода нет'):'Такого кода нет'), 'err');
        return;
      }
      sendFriendRequestToCode(code, data.name || displayName, { skipCheck: true });
    };
    try { MatchClient.on('friend_code_check_result', onCheck); } catch (_) {}
    try { MatchClient.friendCodeCheck(code); } catch (_) {}
    setTimeout(() => {
      if (settled) return;
      settled = true;
      try { MatchClient.off('friend_code_check_result', onCheck); } catch (_) {}
      frSearchBusy = false;
      setFriendAddStatus((typeof globalThis.t==='function'?globalThis.t('friends.codeNotFound','Такого кода нет'):'Такого кода нет'), 'err');
    }, 8000);
    return;
  }

  frSearchBusy = true;
  setFriendAddStatus('Отправляем заявку…', 'wait');
  try { SFX.ui(); } catch (_) {}
  try { ensureFriendPresence(); } catch (_) {}

  try {
    if (!frOutgoingPending.some(p => p.code === code)) {
      frOutgoingPending.unshift({
        code,
        name: (displayName || '').toString().trim().slice(0, 20) || null,
        ts: Date.now()
      });
      saveOutgoingPending();
      renderOutgoingPending(true);
    } else if (displayName) {
      updateOutgoingPendingName(code, displayName);
    }
  } catch (_) {}

  deliverSocialMessage(code, {
    type: 'friend_req',
    code: myFriendCode,
    name: myNickname,
    trophies: trophies | 0
  }, { timeoutMs: 10000 }).then((ok) => {
    frSearchBusy = false;
    if (!ok) {
      setFriendAddStatus('Заявка сохранена. Друг получит её, когда зайдёт в игру', 'ok');
      try {
        _friendFindCache = (_friendFindCache || []).filter(r => normalizeFriendCode(r.code) !== code);
      } catch (_) {}
      try { renderOutgoingPending(false); } catch (_) {}
      try { refreshFriendFindCards(); } catch (_) {}
      return;
    }
    setFriendAddStatus('Заявка отправлена — ждём ответа', 'ok');
    try {
      _friendFindCache = (_friendFindCache || []).filter(r => normalizeFriendCode(r.code) !== code);
    } catch (_) {}
    try { renderOutgoingPending(false); } catch (_) {}
    try { refreshFriendFindCards(); } catch (_) {}
  });
}

/** Add friend by 8-char code (existence checked on server). Nickname search uses the modal. */
function addFriendByCode(raw) {
  const input = document.getElementById('friendCodeInput');
  const typed = String(raw != null ? raw : (input && input.value) || '').trim();
  if (input) input.value = typed;

  if (!typed) {
    setFriendAddStatus('Введи код друга из 8 символов', 'err');
    return;
  }

  const asCode = normalizeFriendCode(typed);
  if (asCode.length >= 8) {
    sendFriendRequestToCode(asCode);
    return;
  }

  // Incomplete code — nick search is a separate button/modal
  setFriendAddStatus('Нужен код из 8 символов. Поиск по нику — кнопка ниже.', 'err');
}

/** Last successful presence_search results (kept when input is cleared). */
let _friendFindCache = [];

function activityFindLabel(act) {
  const a = String(act || 'online');
  if (a === 'match' || a === 'versus' || a === 'ranked') return 'В матче';
  if (a === 'lobby' || a === 'room') return 'В комнате';
  if (a === 'menu' || a === 'online') return 'В меню';
  return a;
}


function openNickSearchModal(prefill) {
  const modal = document.getElementById('nickSearchModal');
  const input = document.getElementById('nickSearchInput');
  const results = document.getElementById('nickSearchResults');
  const empty = document.getElementById('nickSearchEmpty');
  if (!modal) return;
  if (results) results.innerHTML = '';
  if (empty) empty.style.display = 'none';
  if (input) input.value = prefill ? String(prefill).slice(0, 11) : '';
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  try { if (input) input.focus(); } catch (_) {}
}

function closeNickSearchModal() {
  const modal = document.getElementById('nickSearchModal');
  if (!modal) return;
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

function runNickSearchFromModal() {
  const input = document.getElementById('nickSearchInput');
  const resultsEl = document.getElementById('nickSearchResults');
  const empty = document.getElementById('nickSearchEmpty');
  const q = String((input && input.value) || '').trim();
  if (q.length < 2) {
    if (empty) { empty.style.display = ''; empty.textContent = 'Введите минимум 2 символа'; }
    return;
  }
  if (typeof MatchClient === 'undefined') {
    if (empty) { empty.style.display = ''; empty.textContent = 'Сервер недоступен'; }
    return;
  }
  if (resultsEl) resultsEl.innerHTML = '';
  if (empty) { empty.style.display = ''; empty.textContent = 'Ищем…'; }
  try { ensureFriendPresence(); } catch (_) {}
  try { MatchClient.connect(); } catch (_) {}
  let settled = false;
  const onRes = (data) => {
    if (settled || !data) return;
    settled = true;
    try { MatchClient.off('presence_search_result', onRes); } catch (_) {}
    renderNickSearchResults(Array.isArray(data.results) ? data.results : [], q);
  };
  try { MatchClient.on('presence_search_result', onRes); } catch (_) {}
  try { MatchClient.presenceSearch(q); } catch (_) {}
  setTimeout(() => {
    if (settled) return;
    settled = true;
    try { MatchClient.off('presence_search_result', onRes); } catch (_) {}
    if (empty) {
      empty.style.display = '';
      empty.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.notFoundNick','Никого не нашли'):'Никого не нашли');
    }
  }, 8000);
}

function renderNickSearchResults(results, q) {
  const list = document.getElementById('nickSearchResults');
  const empty = document.getElementById('nickSearchEmpty');
  if (!list) return;
  list.innerHTML = '';
  results = Array.isArray(results) ? results : [];
  if (!results.length) {
    if (empty) {
      empty.style.display = '';
      empty.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.notFoundNick','Никого не нашли'):'Никого не нашли')
        + (q ? (' · «' + String(q).slice(0, 20) + '»') : '');
    }
    return;
  }
  if (empty) empty.style.display = 'none';
  for (const r of results) {
    const code = normalizeFriendCode(r.code);
    if (!code) continue;
    const name = String(r.name || code).slice(0, 20);
    const isOnline = r.online !== false && String(r.activity || '') !== 'offline';
    const statusLabel = isOnline
      ? activityFindLabel(r.activity)
      : (typeof globalThis.t === 'function' ? globalThis.t('friends.offline', 'Не в сети') : 'Не в сети');
    const card = document.createElement('div');
    card.className = 'friend-req-card';
    card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;margin-bottom:6px;border-radius:12px;background:var(--surface2)';
    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;flex:1';
    const av = document.createElement('div');
    av.className = 'f-av';
    av.style.cssText = 'width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden';
    try {
      renderAvatarInto(av, {
        avatarId: r.avatarId || 'init',
        nick: name,
        custom: (r.avatarId === 'custom' && r.avatarCustom) ? r.avatarCustom : null
      });
    } catch (_) {
      av.textContent = name.slice(0, 2).toUpperCase();
    }
    const info = document.createElement('div');
    info.style.minWidth = '0';
    info.innerHTML =
      '<div style="font-weight:800">' + name.replace(/</g, '') +
      (isOnline ? ' <span style="color:#3dce6a;font-size:0.7rem">●</span>' : ' <span style="opacity:0.45;font-size:0.7rem">○</span>') +
      '</div>' +
      '<div style="font-size:0.75rem;opacity:0.7">' + code +
      (r.trophies != null ? ' · 🏆 ' + (r.trophies | 0) : '') +
      ' · ' + statusLabel +
      '</div>';
    left.appendChild(av);
    left.appendChild(info);
    card.appendChild(left);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    btn.textContent = (typeof globalThis.t==='function'?globalThis.t('friends.add','Добавить'):'Добавить');
    btn.addEventListener('click', () => {
      closeNickSearchModal();
      const mainIn = document.getElementById('friendCodeInput');
      if (mainIn) mainIn.value = code;
      // Only send invitation — do NOT add to friends until they accept
      sendFriendRequestToCode(code, name, { skipCheck: true });
    });
    card.appendChild(btn);
    list.appendChild(card);
  }
}

function syncFindByNickButton() {
  const btn = document.getElementById('btnFindByNick');
  if (btn) btn.style.display = '';
}


function refreshFriendFindCards() { /* online find list removed */ }

function renderFriendFindResults(results, q, opts) { /* online find list removed */ }

function runFriendFind(q) { /* online find list removed */ }

function bindFriendFindUI() {
  if (window._friendFindBound) return;
  window._friendFindBound = true;
  const input = document.getElementById('friendSearchInput');
  if (input) {
    input.addEventListener('input', () => {
      try { renderFriends(false); } catch (_) {}
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        try { renderFriends(false); } catch (_) {}
      }
    });
  }
}
try { bindFriendFindUI(); } catch (_) {}

// Start presence when possible (WebSocket, no server)
setTimeout(() => {
  try { checkCrossPlatformReady(); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient.connect();
      ensureFriendPresence();
      setNetStatus(true);
    }
  } catch (_) { try { setNetStatus(false, 'ws'); } catch (_) {} }
}, 800);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Opera/Chromium: tab hide often fires before pagehide; send leave while channel is still open
    try {
      if (mpMode && !BPState.matchEnded && (typeof isPreStartOrEmptyMatchLeave === 'function')
        && isPreStartOrEmptyMatchLeave()) {
        
        
      }
    } catch (_) {}
  } else {
    try { ensureFriendPresence(); } catch (_) {}
    // Both left → one rejoined already: other must still see rejoin toast on return
    try {
      if (!vsActive && !BPState.matchEnded && !BPState.mpRejoiningMatch) {
        const s = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
        if (s) {
          showMatchRejoinPanel(s);
          try { startRejoinPanelListen(s); } catch (_2) {}
        }
      }
    } catch (_) {}
  }
});
