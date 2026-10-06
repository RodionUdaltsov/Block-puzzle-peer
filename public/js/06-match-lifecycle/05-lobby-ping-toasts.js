/**
 * Block Puzzle — js/06-match-lifecycle/05-lobby-ping-toasts.js
 * Lobby ping and info/challenge toasts.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
let chPending = null; // { conn, room, name, code, trophies }
let chHideTimer = null;
let chCountTimer = null;
let leaveMatchChallengeReq = null;

// Lobby RTT
let mpLastRtt = null;
let mpPingTimer = null;
let mpPingSentAt = 0;
function stopLobbyPing() {
  if (mpPingTimer) { clearInterval(mpPingTimer); mpPingTimer = null; }
  mpPingSentAt = 0;
  mpLastRtt = null;
}
function _smoothLobbyRtt(sample) {
  // Ignore tab-throttle / clock-skew outliers (often 2000–5000ms after background)
  if (typeof sample !== 'number' || sample < 0 || sample > 900) return mpLastRtt;
  if (typeof mpLastRtt !== 'number') {
    mpLastRtt = sample;
    return sample;
  }
  // EMA — damp spikes
  mpLastRtt = Math.round(mpLastRtt * 0.65 + sample * 0.35);
  return mpLastRtt;
}
function startLobbyPing() {
  stopLobbyPing();
  const tick = () => {
    try {
      if (typeof MatchClient === 'undefined' || !MatchClient.connected) return;
      const raw = (typeof MatchClient.lastRtt === 'number') ? MatchClient.lastRtt : null;
      if (typeof raw === 'number') {
        const smooth = _smoothLobbyRtt(raw);
        if (typeof smooth === 'number') {
          window._lobbyMeRtt = smooth;
          try {
            MatchClient.send({ type: 'lobby_ping', rtt: smooth | 0 });
          } catch (_) {}
        }
      }
      try { updateLobbyPingUI(); } catch (_) {}
    } catch (_) {}
  };
  tick();
  mpPingTimer = setInterval(tick, 2500);
  try {
    if (typeof MatchClient !== 'undefined' && !window._lobbyRttBound) {
      window._lobbyRttBound = true;
      MatchClient.on('rtt', (data) => {
        try {
          if (data && typeof data.rtt === 'number') {
            const smooth = _smoothLobbyRtt(data.rtt);
            if (typeof smooth === 'number') {
              window._lobbyMeRtt = smooth;
              updateLobbyPingUI();
            }
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
}
function updateLobbyPingUI() {
  const apply = (id, ms) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (ms == null || ms < 0) {
      el.textContent = '';
      el.className = 'lobby-ping';
      return;
    }
    // Cap display so 3000ms spikes never show
    const shown = Math.min(999, ms | 0);
    el.textContent = shown + ' мс';
    el.className = 'lobby-ping ' + (shown < 80 ? 'good' : shown < 160 ? 'mid' : 'bad');
  };
  const meRtt = (typeof window._lobbyMeRtt === 'number')
    ? window._lobbyMeRtt
    : (typeof mpLastRtt === 'number' ? mpLastRtt : null);
  let oppRtt = (typeof window._lobbyOppRtt === 'number') ? window._lobbyOppRtt : null;
  // Cap opp samples from server too
  if (typeof oppRtt === 'number' && oppRtt > 900) oppRtt = Math.min(999, oppRtt);
  apply('lobbyMePing', meRtt);
  apply('lobbyOppPing', mpOppConnected ? oppRtt : null);
}

// Compact top-right info toast (2s, swipe to dismiss)
let infoHideTimer = null;
function hideInfoToast(animate) {
  const toast = document.getElementById('infoToast');
  if (!toast) return;
  if (infoHideTimer) { clearTimeout(infoHideTimer); infoHideTimer = null; }
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('dragging');
  if (animate === false) {
    toast.classList.remove('visible', 'out', 'ok', 'bad');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out', 'ok', 'bad'), 380);
}
function showInfoToast(label, text, kind) {
  const toast = document.getElementById('infoToast');
  if (!toast) return;
  const lab = document.getElementById('infoToastLabel');
  const tx = document.getElementById('infoToastText');
  if (lab) lab.textContent = label || '';
  if (tx) tx.textContent = text || '';
  toast.classList.remove('out', 'dragging', 'ok', 'bad');
  // aliases: info/ok → ok; warn/error/bad → bad
  if (kind === 'ok' || kind === 'info') toast.classList.add('ok');
  else if (kind === 'bad' || kind === 'error' || kind === 'warn') toast.classList.add('bad');
  toast.style.transform = '';
  toast.style.opacity = '';
  void toast.offsetWidth;
  toast.classList.add('visible');
  if (infoHideTimer) clearTimeout(infoHideTimer);
  infoHideTimer = setTimeout(() => {
    infoHideTimer = null;
    hideInfoToast(true);
  }, 2000);
}
(function bindInfoToastSwipe() {
  const toast = document.getElementById('infoToast');
  if (!toast) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
  const onStart = (e) => {
    if (!toast.classList.contains('visible')) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    dragging = true;
    sx = t.clientX; sy = t.clientY; dx = 0; dy = 0;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    dx = t.clientX - sx;
    dy = t.clientY - sy;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) e.preventDefault();
    const x = Math.max(0, dx);
    const y = Math.min(0, dy);
    toast.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    toast.style.opacity = String(Math.max(0.25, 1 - Math.max(x, -y) / 120));
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove('dragging');
    if (dx > 56 || dy < -48) hideInfoToast(true);
    else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
    dx = 0; dy = 0;
  };
  toast.addEventListener('touchstart', onStart, { passive: true });
  toast.addEventListener('touchmove', onMove, { passive: false });
  toast.addEventListener('touchend', onEnd);
  toast.addEventListener('touchcancel', onEnd);
})();

function clearChHideTimer() {
  if (chHideTimer) { clearTimeout(chHideTimer); chHideTimer = null; }
  if (chCountTimer) { clearInterval(chCountTimer); chCountTimer = null; }
}

function hideChToast(animate) {
  const toast = document.getElementById('chToast');
  if (!toast) return;
  clearChHideTimer();
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

let lastChToastKey = '';
let lastChToastAt = 0;
function showChToast(req) {
  const toast = document.getElementById('chToast');
  if (!toast || !req) return;
  const roomKey = String(req.room || '').toUpperCase();
  const inviterKey = normalizeFriendCode(req.code || '');
  const toastKey = roomKey + '|' + inviterKey;
  chPending = req;
  const av = document.getElementById('chToastAv');
  const name = document.getElementById('chToastName');
  const meta = document.getElementById('chToastMeta');
  if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
  if (name) name.textContent = req.name || 'Игрок';
  if (meta) {
    const parts = [];
    if (req.trophies != null) parts.push('🏆 ' + req.trophies);
    parts.push(vsActive ? 'зовёт в лобби (идёт матч)' : 'приглашает в лобби');
    if (req.room) parts.push('комната ' + req.room);
    meta.textContent = parts.join(' · ');
  }
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
  // If toast is already on screen for this invite — only refresh content, no re-animation
  if (toast.classList.contains('visible') && toastKey === lastChToastKey) {
    clearChHideTimer();
    chCountTimer = startToastCountdown('chToastCountdown', 5, null);
    chHideTimer = setTimeout(() => {
      chHideTimer = null;
      hideChToast(true);
    }, 5000);
    return;
  }
  // Always surface the toast when it is not visible (repeat invite / after auto-hide / after cancel)
  lastChToastKey = toastKey;
  lastChToastAt = Date.now();
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('out', 'dragging');
  void toast.offsetWidth;
  toast.classList.add('visible');
  try { SFX.ui && SFX.ui(); } catch (_) {}
  try { hapticTap(18); } catch (_) {}
  clearChHideTimer();
  chCountTimer = startToastCountdown('chToastCountdown', 5, null);
  // Toast only — заявка остаётся в «Заявках» до отклонения / заполнения / удаления лобби
  chHideTimer = setTimeout(() => {
    chHideTimer = null;
    hideChToast(true);
  }, 5000);
}
