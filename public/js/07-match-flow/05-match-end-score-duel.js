/**
 * Block Puzzle — js/07-match-flow/05-match-end-score-duel.js
 * Match-end freeze and score duel.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
// —— Match end freeze (pause before score duel) ——
let matchEndFreezeTimer = null;
let matchEndFreezeResolve = null;
function hideMatchEndFreeze() {
  const el = document.getElementById('matchEndFreeze');
  if (matchEndFreezeTimer) {
    try { clearTimeout(matchEndFreezeTimer); } catch (_) {}
    matchEndFreezeTimer = null;
  }
  try { document.body.classList.remove('match-ending'); } catch (_) {}
  if (el) {
    el.classList.remove('visible', 'mef-out', 'mef-time', 'mef-lose', 'mef-win', 'mef-draw');
    el.setAttribute('aria-hidden', 'true');
    // Do NOT set display:none inline — that blocks future .visible
    try { el.style.display = ''; el.style.pointerEvents = ''; } catch (_) {}
  }
  const r = matchEndFreezeResolve;
  matchEndFreezeResolve = null;
  if (r) {
    try { r(); } catch (_) {}
  }
}
/**
 * Freeze the board briefly so both players register that the match stopped.
 * Then score duel / result modal can play.
 */
function showMatchEndFreeze(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    // Always show end sequence (user-requested cinematic)

    const el = document.getElementById('matchEndFreeze');
    if (!el) { resolve(); return; }
    // Clear any inline display:none left by boot failsafe
    try {
      el.style.display = '';
      el.style.pointerEvents = '';
      el.style.opacity = '';
      el.style.visibility = '';
    } catch (_) {}

    // Cancel any previous freeze
    if (matchEndFreezeTimer) {
      try { clearTimeout(matchEndFreezeTimer); } catch (_) {}
      matchEndFreezeTimer = null;
    }
    if (matchEndFreezeResolve) {
      const prev = matchEndFreezeResolve;
      matchEndFreezeResolve = null;
      try { prev(); } catch (_) {}
    }
    matchEndFreezeResolve = resolve;

    const reason = (opts.reason || 'normal') + '';
    const timeUp = !!opts.timeUp || (typeof opts.timeLeft === 'number' && opts.timeLeft <= 0);
    const my = Math.max(0, opts.my | 0);
    const opp = Math.max(0, opts.opp | 0);
    const won = !!opts.won;
    const draw = !!opts.draw;

    let label = 'Versus';
    let title = 'Матч окончен';
    let sub = 'Подсчёт результатов…';
    el.classList.remove('mef-time', 'mef-lose', 'mef-win', 'mef-draw');

    if (reason === 'forfeit') {
      title = 'Матч окончен';
      sub = won ? 'Соперник сдался · подсчёт…' : 'Вы сдались · подсчёт…';
      if (!won) el.classList.add('mef-lose');
      else el.classList.add('mef-win');
    } else if (reason === 'disconnect') {
      title = 'Матч окончен';
      sub = won ? 'Соперник отключился · подсчёт…' : 'Обрыв связи · подсчёт…';
    } else if (reason === 'afk') {
      title = 'Матч окончен';
      sub = 'АФК · подсчёт результатов…';
    } else if (timeUp) {
      title = 'Матч окончен';
      sub = 'Время вышло · подсчёт…';
      el.classList.add('mef-time');
      label = 'Таймер';
    } else {
      title = 'Матч окончен';
      sub = 'Подсчёт результатов…';
    }

    if (draw) el.classList.add('mef-draw');
    else if (won) el.classList.add('mef-win');
    else if (reason !== 'forfeit' || !won) {
      if (!won && reason !== 'disconnect') el.classList.add('mef-lose');
    }

    const labEl = document.getElementById('mefLabel');
    const titleEl = document.getElementById('mefTitle');
    const subEl = document.getElementById('mefSub');
    const scMe = document.getElementById('mefScoreMe');
    const scOpp = document.getElementById('mefScoreOpp');
    if (labEl) labEl.textContent = label;
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
    if (scMe) scMe.textContent = '0';
    if (scOpp) scOpp.textContent = '0';
    // Reveal scores block and count up during freeze
    try {
      const scWrap = document.getElementById('mefScores');
      if (scWrap) {
        scWrap.style.display = 'flex';
        scWrap.setAttribute('aria-hidden', 'false');
      }
    } catch (_) {}
    // Animate count-up during freeze
    try {
      const dur = 900;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        if (scMe) scMe.textContent = String(Math.round(my * e));
        if (scOpp) scOpp.textContent = String(Math.round(opp * e));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch (_) {
      if (scMe) scMe.textContent = String(my);
      if (scOpp) scOpp.textContent = String(opp);
    }

    try { document.body.classList.add('match-ending'); } catch (_) {}
    el.classList.remove('mef-out');
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    try { hapticTap(16); } catch (_) {}
    try { SFX.ui && SFX.ui(); } catch (_) {}

    const hold = Math.min(3200, Math.max(1800, opts.ms || 2400));
    matchEndFreezeTimer = setTimeout(() => {
      matchEndFreezeTimer = null;
      el.classList.add('mef-out');
      setTimeout(() => {
        try { document.body.classList.remove('match-ending'); } catch (_) {}
        el.classList.remove('visible', 'mef-out', 'mef-time', 'mef-lose', 'mef-win', 'mef-draw');
        el.setAttribute('aria-hidden', 'true');
        const r = matchEndFreezeResolve;
        matchEndFreezeResolve = null;
        if (r) {
          try { r(); } catch (_) {}
        }
      }, 320);
    }, hold);
  });
}

// —— Score duel after match ——
let scoreDuelTimers = [];
let scoreDuelResolve = null;
let scoreDuelSkippable = false;
// Guards against late showResultModal after user already left (menu / again)
let resultModalEpoch = 0;
let resultModalSafetyTimer = null;
BPState.resultDismissed = false;
function clearScoreDuelTimers() {
  scoreDuelTimers.forEach(t => clearTimeout(t));
  scoreDuelTimers = [];
}
/** Cancel pending result modal + score duel (user went to menu / started new match). */
function dismissPostMatchResult() {
  BPState.resultDismissed = true;
  resultModalEpoch++;
  if (resultModalSafetyTimer) {
    try { clearTimeout(resultModalSafetyTimer); } catch (_) {}
    resultModalSafetyTimer = null;
  }
  try { hideMatchEndFreeze(); } catch (_) {}
  try {
    const ov = document.getElementById('scoreDuelOverlay');
    if (ov) {
      ov.classList.remove('visible', 'show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
      ov.setAttribute('aria-hidden', 'true');
    }
  } catch (_) {}
  clearScoreDuelTimers();
  scoreDuelSkippable = false;
  const r = scoreDuelResolve;
  scoreDuelResolve = null;
  // Resolve after epoch bump so any .then(showResultModal) is a no-op
  if (r) {
    try { r(); } catch (_) {}
  }
  try {
    document.getElementById('versusResult').classList.remove('visible');
  } catch (_) {}
  try {
    document.getElementById('reviewBar').classList.remove('visible');
  } catch (_) {}
}
function finishScoreDuel() {
  const ov = document.getElementById('scoreDuelOverlay');
  if (ov) {
    ov.classList.remove('visible', 'show-verdict');
    ov.setAttribute('aria-hidden', 'true');
  }
  clearScoreDuelTimers();
  scoreDuelSkippable = false;
  const r = scoreDuelResolve;
  scoreDuelResolve = null;
  if (r) r();
  // After duel closes, surface any rematch invite that arrived during it
  setTimeout(() => {
    try { tryShowPendingRematchOffer(); } catch (_) {}
  }, 50);
}
function animateCount(el, to, ms) {
  if (!el) return;
  const start = performance.now();
  const from = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = to;
  };
  requestAnimationFrame(step);
}

function spawnDuelConfetti(ov) {
  if (!ov) return;
  try { if (settings && settings.confetti === '0') return; } catch (_) {}
  let box = ov.querySelector('.score-duel-confetti');
  if (!box) {
    box = document.createElement('div');
    box.className = 'score-duel-confetti';
    ov.appendChild(box);
  }
  box.innerHTML = '';
  const colors = ['#00d4aa','#7c5cff','#ffd666','#5ee7ff','#ff5c7a','#ff9f43','#c77dff'];
  for (let i = 0; i < 28; i++) {
    const b = document.createElement('b');
    b.style.left = (8 + Math.random() * 84) + '%';
    b.style.background = colors[i % colors.length];
    b.style.width = (6 + Math.random() * 6) + 'px';
    b.style.height = (6 + Math.random() * 8) + 'px';
    b.style.animationDelay = (Math.random() * 0.35) + 's';
    b.style.animationDuration = (1.1 + Math.random() * 0.7) + 's';
    b.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    box.appendChild(b);
  }
  setTimeout(() => { try { box.innerHTML = ''; } catch (_) {} }, 2200);
}

function showScoreDuel(my, opp, won, draw, oppLabel, bot) {
  return new Promise((resolve) => {
    try {
      if (settings && settings.scoreDuel === '0') { resolve(); return; }
    } catch (_) {}
    const ov = document.getElementById('scoreDuelOverlay');
    if (!ov) { resolve(); return; }
    try {
      ov.style.display = '';
      ov.style.pointerEvents = '';
      ov.style.opacity = '';
    } catch (_) {}
    clearScoreDuelTimers();
    scoreDuelResolve = resolve;
    scoreDuelSkippable = false;

    const sideMe = document.getElementById('duelSideMe');
    const sideOpp = document.getElementById('duelSideOpp');
    sideMe.className = 'score-duel-side me';
    sideOpp.className = 'score-duel-side opp';
    ov.classList.remove('show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
    try {
      const cf = ov.querySelector('.score-duel-confetti');
      if (cf) cf.innerHTML = '';
    } catch (_) {}

    document.getElementById('duelNameMe').textContent = (typeof myNickname === 'string' && myNickname) ? myNickname : (typeof globalThis.t==='function'?globalThis.t('js.you','Ты'):'Ты');
    document.getElementById('duelNameOpp').textContent = oppLabel || (typeof globalThis.t==='function'?globalThis.t('js.opp','Соперник'):'Соперник');
    document.getElementById('duelScoreMe').textContent = '0';
    document.getElementById('duelScoreOpp').textContent = '0';

    // Paint into outer .score-duel-av (crown is a sibling outside, not clipped)
    const avMe = document.getElementById('duelAvMe');
    const avOpp = document.getElementById('duelAvOpp');
    if (avMe) {
      try {
        renderAvatarInto(avMe, {
          avatarId: myAvatarId,
          nick: myNickname,
          custom: (myAvatarId === 'custom' && typeof myAvatarCustom === 'string') ? myAvatarCustom : null,
          size: 'duel',
          eager: true
        });
      } catch (_) {
        const initials = ((typeof myNickname === 'string' && myNickname) ? myNickname : 'Ты').slice(0, 2).toUpperCase();
        avMe.textContent = initials;
      }
    }
    if (avOpp) {
      if (bot) {
        avOpp.innerHTML = botAvatarSVG(bot, 64);
      } else {
        try {
          renderAvatarInto(avOpp, {
            avatarId: window.mpOppAvatarId || 'init',
            nick: oppLabel || mpOppName || 'Соперник',
            custom: (window.mpOppAvatarId === 'custom' && window.mpOppAvatarCustom) ? window.mpOppAvatarCustom : null,
            size: 'duel',
            eager: true
          });
        } catch (_) {
          avOpp.textContent = (oppLabel || 'С').slice(0, 2).toUpperCase();
        }
      }
    }

    ov.classList.add('visible');
    ov.setAttribute('aria-hidden', 'false');

    // Count-up scores
    scoreDuelTimers.push(setTimeout(() => {
      animateCount(document.getElementById('duelScoreMe'), my, 700);
      animateCount(document.getElementById('duelScoreOpp'), opp, 700);
    }, 180));

    // Reveal winner/loser + verdict (stronger, slightly longer)
    scoreDuelTimers.push(setTimeout(() => {
      ov.classList.remove('duel-win', 'duel-lose', 'duel-draw');
      if (draw) {
        sideMe.classList.add('draw');
        sideOpp.classList.add('draw');
        ov.classList.add('duel-draw');
      } else if (won) {
        sideMe.classList.add('winner');
        sideOpp.classList.add('loser');
        ov.classList.add('duel-win');
        try { spawnDuelConfetti(ov); } catch (_) {}
      } else {
        sideOpp.classList.add('winner');
        sideMe.classList.add('loser');
        ov.classList.add('duel-lose');
      }
      const verd = document.getElementById('duelVerdict');
      verd.className = 'score-duel-verdict ' + (draw ? 'draw' : won ? 'win' : 'lose');
      verd.textContent = draw ? (typeof globalThis.t==='function'?globalThis.t('js.draw','Ничья'):'Ничья') : won ? (typeof globalThis.t==='function'?globalThis.t('js.victory','Победа!'):'Победа!') : (typeof globalThis.t==='function'?globalThis.t('js.defeat','Поражение'):'Поражение');
      ov.classList.add('show-verdict');
      try { hapticTap(18); } catch (_) {}
    }, 1000));

    // Allow tap after verdict has time to land
    scoreDuelTimers.push(setTimeout(() => { scoreDuelSkippable = true; }, 1250));
  });
}
document.getElementById('scoreDuelOverlay')?.addEventListener('click', () => {
  if (scoreDuelSkippable) finishScoreDuel();
});
