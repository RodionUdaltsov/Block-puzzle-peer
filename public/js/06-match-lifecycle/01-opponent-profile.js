/**
 * Block Puzzle — js/06-match-lifecycle/01-opponent-profile.js
 * Opponent profile/labels and post-match residue cleanup.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/**
 * Apply opponent identity from authoritative server payload (match_found / state / lobby).
 * Sets name, trophies, avatar, skin, board and refreshes versus labels.
 */
function applyOppProfileFromServer(opp, opts) {
  if (!opp || typeof opp !== 'object') return false;
  opts = opts || {};
  let changed = false;
  try {
    if (opp.name) {
      const nm = String(opp.name).slice(0, 24);
      if (mpOppName !== nm || oppName !== nm) {
        mpOppName = nm;
        oppName = nm;
        changed = true;
      }
    }
    if (typeof opp.trophies === 'number' && isFinite(opp.trophies)) {
      const t = Math.max(0, opp.trophies | 0);
      if (mpOppTrophies !== t) {
        mpOppTrophies = t;
        changed = true;
      }
    }
    // Avatar: always adopt when server sends a field (including 'init')
    if (opp.avatarId != null && opp.avatarId !== '') {
      const av = String(opp.avatarId).slice(0, 32);
      if (window.mpOppAvatarId !== av) {
        window.mpOppAvatarId = av;
        changed = true;
      }
    } else if (!window.mpOppAvatarId) {
      window.mpOppAvatarId = 'init';
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(opp, 'avatarCustom')) {
      const custom = (typeof opp.avatarCustom === 'string') ? opp.avatarCustom : '';
      if (window.mpOppAvatarCustom !== custom) {
        window.mpOppAvatarCustom = custom;
        changed = true;
      }
    }
    if (opp.skinId && typeof applyOppSkin === 'function') {
      if (window.mpOppSkinId !== opp.skinId) {
        window.mpOppSkinId = opp.skinId;
        try { applyOppSkin(opp.skinId); } catch (_) {}
        changed = true;
      }
    }
    if (opp.boardId && typeof applyOppBoard === 'function') {
      if (window.mpOppBoardId !== opp.boardId) {
        window.mpOppBoardId = opp.boardId;
        try { applyOppBoard(opp.boardId); } catch (_) {}
        changed = true;
      }
    }
  } catch (_) {}
  if (opts.forcePaint || changed || opts.alwaysPaint) {
    try { updateVersusNameLabels(); } catch (_) {}
    try {
      const live = document.getElementById('trophiesLive');
      if (live && typeof trophies === 'number') live.textContent = String(trophies);
    } catch (_) {}
  }
  return changed;
}

function updateVersusNameLabels() {
  const nick = (typeof myNickname === 'string' && myNickname.trim()) ? myNickname.trim() : 'Гость';
  const t = (typeof trophies === 'number') ? trophies : 0;
  const me = document.getElementById('myNameLabel');
  if (me) {
    me.innerHTML =
      '<span class="vs-me-av" id="vsMeAv"></span>' +
      '<span class="vs-me-nick" id="vsMeNick"></span>' +
      '<span id="vsMeCups" style="opacity:0.9;font-weight:700;font-size:0.72rem;margin-left:2px;color:var(--trophy);white-space:nowrap;flex-shrink:0">🏆 ' + t + '</span>';
    me.classList.add('vs-me-name', 'name');
    const avEl = document.getElementById('vsMeAv');
    const nickEl = document.getElementById('vsMeNick');
    if (nickEl) nickEl.textContent = nick;
    if (avEl) {
      try {
        renderAvatarInto(avEl, {
          avatarId: myAvatarId || 'init',
          nick: nick,
          custom: (myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : null
        });
      } catch (_) { avEl.textContent = (nick[0] || '?').toUpperCase(); }
    }
  }
  const opp = document.getElementById('oppName');
  if (!opp) return;

  const isOnline = !!(mpMode || roomMatchMode || BPState.roomMatchMode || vsModeType === 'online');
  // Online always paints human opponent — never keep leftover bot avatar/name
  if (!isOnline && currentBot) {
    // bot path: leave bot-specific HTML (painted by bot start)
    return;
  }

  const nm = (oppName || mpOppName || 'Соперник').toString().slice(0, 20);
  let cups = null;
  if (isOnline && typeof mpOppTrophies === 'number') cups = mpOppTrophies;
  else if (!isOnline && currentBot && typeof currentBot.trophies === 'number') cups = currentBot.trophies;
  else if (typeof mpOppTrophies === 'number') cups = mpOppTrophies;

  const avId = window.mpOppAvatarId || 'init';
  const avCustom = window.mpOppAvatarCustom || '';
  opp.classList.add('vs-opp-name', 'name');
  opp.innerHTML =
    '<span class="vs-opp-av" id="vsOppAv"></span>' +
    '<span class="vs-opp-nick" id="vsOppNick"></span>' +
    (cups != null
      ? '<span class="vs-opp-cups" style="opacity:0.9;font-weight:700;font-size:0.72rem;margin-left:2px;color:var(--trophy);white-space:nowrap;flex-shrink:0">🏆 ' + cups + '</span>'
      : '');
  const on = document.getElementById('vsOppNick');
  if (on) on.textContent = nm;
  const oa = document.getElementById('vsOppAv');
  if (oa) {
    try {
      renderAvatarInto(oa, {
        avatarId: avId,
        nick: nm,
        custom: (avId === 'custom' && avCustom) ? avCustom : null
      });
    } catch (_) { oa.textContent = (nm[0] || '?').toUpperCase(); }
  }
}

/** Clear bot match residue before online / ranked / private match. */
function clearBotMatchResidue() {
  try { currentBot = null; } catch (_) {}
  try { document.body.classList.remove('vs-bots'); } catch (_) {}
  try {
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
  } catch (_) {}
  try { aiBusy = false; aiStuck = false; } catch (_) {}
  try {
    const speech = document.querySelector('.bot-speech');
    if (speech) speech.classList.remove('visible');
  } catch (_) {}
  try {
    const ghost = document.getElementById('aiGhost');
    if (ghost) { ghost.style.display = 'none'; ghost.innerHTML = ''; }
  } catch (_) {}
  // Do NOT wipe mpOppAvatar* here — online match_found / applyOppProfileFromServer
  // re-applies from server. Clearing caused a flash of missing avatars.
}


/** Show post-match result only if the user is still on the versus screen.
 *  Never force-navigate from menu / friends / shop after a rematch decline. */
