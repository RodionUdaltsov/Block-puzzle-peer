/**
 * Block Puzzle — js/08-gameplay/01-screens.js
 * Screen navigation, screen loading, menu stats.
 * Shares the client bundle scope (order: public/js/modules.json).
 */

function showScreen(name, opts) {
  opts = opts || {};
  const isPlay = (name === 'classic' || name === 'versus');
  // Leaving match UI: clear stuck "Матч начинается" on Friends and loading flags
  try {
    if (!isPlay && (BPState.matchEnded || !(typeof vsActive !== 'undefined' && vsActive))) {
      if (typeof mpMatchStarting !== 'undefined' && mpMatchStarting) mpMatchStarting = false;
      try { mpLoading = false; } catch (_) {}
      try { vsIntroLock = false; } catch (_) {}
      try { BPState.matchAwaitingGo = false; } catch (_) {}
      if (name === 'friends' || name === 'menu') {
        try { if (typeof setMpStatus === 'function') setMpStatus(''); } catch (_) {}
      }
    }
  } catch (_) {}
  // Animated loader on EVERY non-play navigation (including Back → menu)
  // so tab switches never feel frozen. Skip only if caller already owns the loader.
  try {
    if (!opts.skipLoader && !isPlay) {
      const labels = {
        menu: (typeof globalThis.t === 'function' ? globalThis.t('menu.main', 'Меню') : 'Меню'),
        friends: (typeof globalThis.t === 'function' ? globalThis.t('menu.friends', 'Друзья') : 'Друзья'),
        achievements: (typeof globalThis.t === 'function' ? globalThis.t('menu.achievements', 'Награды') : 'Награды'),
        shop: (typeof globalThis.t === 'function' ? globalThis.t('menu.shop', 'Магазин') : 'Магазин'),
        inventory: (typeof globalThis.t === 'function' ? globalThis.t('menu.inventory', 'Инвентарь') : 'Инвентарь'),
        history: (typeof globalThis.t === 'function' ? globalThis.t('menu.history', 'История') : 'История'),
        settings: (typeof globalThis.t === 'function' ? globalThis.t('menu.settings', 'Настройки') : 'Настройки'),
        profile: (typeof globalThis.t === 'function' ? globalThis.t('menu.profile', 'Профиль') : 'Профиль'),
        compType: (typeof globalThis.t === 'function' ? globalThis.t('comp.title', 'Соревнование') : 'Соревнование'),
        difficulty: (typeof globalThis.t === 'function' ? globalThis.t('bots.title', 'Боты') : 'Боты'),
        duration: (typeof globalThis.t === 'function' ? globalThis.t('duration.title', 'Время') : 'Время'),
        match: (typeof globalThis.t === 'function' ? globalThis.t('match.searching', 'Матч') : 'Матч')
      };
      showScreenLoading(labels[name] || (typeof globalThis.t === 'function' ? globalThis.t('boot.loading', 'Загрузка…') : 'Загрузка…'));
      // Auto-hide after paint if caller does not use withScreenLoading
      if (!opts.keepLoader) {
        const gen = ++_screenLoadingGen;
        const t0 = performance.now();
        const MIN_MS = 200;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const left = Math.max(0, MIN_MS - (performance.now() - t0));
            setTimeout(() => {
              if (gen === _screenLoadingGen) hideScreenLoading();
            }, left);
          });
        });
      }
    }
  } catch (_) {}
  // Defer expensive leave-side cleanup so the new screen paints first
  const leaveCleanup = () => {
    try {
      if (name !== 'shop' && name !== 'inventory') {
        if (typeof shopMiniTimer !== 'undefined' && shopMiniTimer) {
          clearInterval(shopMiniTimer);
          shopMiniTimer = null;
        }
      }
    } catch (_) {}
    try {
      const achEl = screens.achievements;
      const leavingAch = achEl && achEl.classList.contains('active') && name !== 'achievements';
      if (leavingAch) closeAllAchTabs();
    } catch (_) {}
    try {
      if (name !== 'versus' && typeof replayMode !== 'undefined' && replayMode) {
        try { stopReplayPlay(); } catch (_) {}
        replayMode = false;
        document.body.classList.remove('replay-ui');
        document.body.classList.remove('replay-playing');
        try { hideReplayEndCard(); } catch (_) {}
        try {
          if (BPState.replaySkinBackup) {
            equippedSkinId = BPState.replaySkinBackup;
            applyEquippedSkin();
          }
          if (BPState.replayBoardBackup) {
            equippedBoardId = BPState.replayBoardBackup;
            applyEquippedBoard();
          }
          clearOppSkin();
          clearOppBoard();
          window.mpOppSkinId = null;
          window.mpOppBoardId = null;
          BPState.replaySkinBackup = null;
          BPState.replayBoardBackup = null;
        } catch (_) {}
        try {
          const rb = document.getElementById('reviewBar');
          if (rb) rb.classList.remove('visible', 'replay-dock');
        } catch (_) {}
        try {
          const scrub = document.getElementById('replayScrubBar');
          if (scrub) {
            scrub.style.display = 'none';
            scrub.setAttribute('aria-hidden', 'true');
          }
        } catch (_) {}
        try {
          const fb = document.getElementById('btnForfeit');
          if (fb) fb.style.display = '';
        } catch (_) {}
      }
    } catch (_) {}
    try {
      if (name !== 'classic' && name !== 'versus') {
        if (typeof isDragging !== 'undefined' && isDragging) {
          isDragging = false;
          selectedIdx = -1;
          dragPiece = null;
          placingLock = false;
          try { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } } catch (_) {}
          try {
            const g = document.getElementById('ghost');
            if (g) { g.style.display = 'none'; g.style.opacity = '0'; }
          } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      if (name !== 'versus' && !vsActive) {
        if (typeof aiInterval !== 'undefined' && aiInterval) {
          clearInterval(aiInterval);
          aiInterval = null;
        }
        aiBusy = false;
      }
    } catch (_) {}
  };
  // Fast path: only touch the previously active screen + target
  try {
    const prev = document.querySelector('.screen.active');
    if (prev && prev !== screens[name]) {
      prev.classList.remove('active', 'screen-enter', 'screen-enter-soft');
    }
  } catch (_) {
    try {
      Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active', 'screen-enter', 'screen-enter-soft');
      });
    } catch (_2) {}
  }
  if (screens[name]) {
    const el = screens[name];
    el.classList.remove('screen-enter', 'screen-enter-soft');
    el.classList.add('active');
    if (isPlay) {
      try { void el.offsetWidth; } catch (_) {}
      el.classList.add('screen-enter');
      clearTimeout(el._enterT);
      el._enterT = setTimeout(() => {
        try { el.classList.remove('screen-enter'); } catch (_) {}
      }, 500);
    } else {
      el.classList.add('screen-enter-soft');
      clearTimeout(el._enterT);
      el._enterT = setTimeout(() => {
        try { el.classList.remove('screen-enter', 'screen-enter-soft'); } catch (_) {}
      }, 220);
    }
  }
  mode = (name === 'classic' || name === 'versus') ? name : name;
  try {
    const prevAct = myActivity;
    detectMyActivity();
    if (myActivity !== prevAct) scheduleActivityBroadcast();
  } catch (_) {}
  const lock = (name === 'versus' || name === 'classic' || name === 'difficulty');
  setFitLock(lock);
  if (lock) {
    requestAnimationFrame(() => applyBoardScales());
  }
  if (name === 'classic' || name === 'versus') {
    try { applyEquippedBoard(); } catch (_) {}
    try { requestWakeLock(); } catch (_) {}
  } else {
    try { releaseWakeLock(); } catch (_) {}
  }
  // Defer leave-cleanup + music + rejoin so first paint is not blocked
  const screenName = name;
  requestAnimationFrame(() => {
    leaveCleanup();
    try { syncMusicToScreen(screenName); } catch (_) {}
    try {
      if (screenName === 'menu' || screenName === 'friends' || screenName === 'settings' || screenName === 'history') {
        if (!vsActive && !BPState.matchEnded && !BPState.mpRejoiningMatch) {
          const s = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
          if (s) {
            showMatchRejoinPanel(s);
            try { startRejoinPanelListen(s); } catch (_2) {}
          }
        }
      }
    } catch (_) {}
  });
}
/** Soft loading overlay for menu tabs / Back navigation. */
let _screenLoadingTimer = null;
let _screenLoadingGen = 0;
function showScreenLoading(label) {
  try {
    const el = document.getElementById('screenLoading');
    if (!el) return;
    const txt = document.getElementById('screenLoadingText');
    if (txt && label) txt.textContent = label;
    // Clear any failsafe inline styles that blocked the overlay
    try {
      el.style.display = 'flex';
      el.style.pointerEvents = 'auto';
      el.style.opacity = '';
      el.style.visibility = '';
    } catch (_) {}
    el.hidden = false;
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.setAttribute('aria-busy', 'true');
    // Force reflow so CSS transition plays
    try { void el.offsetWidth; } catch (_) {}
    el.classList.add('show');
    clearTimeout(_screenLoadingTimer);
    // Safety: never stick forever
    _screenLoadingTimer = setTimeout(() => { try { hideScreenLoading(); } catch (_) {} }, 5000);
  } catch (_) {}
}
function hideScreenLoading() {
  try {
    clearTimeout(_screenLoadingTimer);
    _screenLoadingTimer = null;
    const el = document.getElementById('screenLoading');
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-busy', 'false');
    setTimeout(() => {
      try {
        if (!el.classList.contains('show')) {
          el.hidden = true;
          el.setAttribute('hidden', '');
          el.style.display = '';
          el.style.pointerEvents = '';
        }
      } catch (_) {}
    }, 220);
  } catch (_) {}
}
/**
 * Run heavy DOM work after the new screen has painted.
 * Shows a soft spinner so tab switches feel responsive even on slow devices.
 */
function withScreenLoading(work, label) {
  const gen = ++_screenLoadingGen;
  const t0 = performance.now();
  const MIN_VISIBLE_MS = 220;
  showScreenLoading(label || (typeof globalThis.t === 'function' ? globalThis.t('boot.loading', 'Загрузка…') : 'Загрузка…'));
  // Double rAF: first paints the new screen + loader, second runs work without blocking the transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (typeof work === 'function') work();
      } catch (e) {
        try { console.warn('[screenLoading]', e); } catch (_) {}
      } finally {
        const finish = () => {
          if (gen === _screenLoadingGen) hideScreenLoading();
        };
        const elapsed = performance.now() - t0;
        if (elapsed < MIN_VISIBLE_MS) {
          setTimeout(finish, MIN_VISIBLE_MS - elapsed);
        } else {
          finish();
        }
      }
    });
  });
}
/**
 * Navigate to a screen with guaranteed loading overlay + deferred work.
 * Use for Back buttons and any tab that does extra work after paint.
 */
function navigateScreen(name, work, label) {
  showScreen(name, { keepLoader: true, skipLoader: false });
  withScreenLoading(() => {
    try {
      if (typeof work === 'function') work();
    } catch (e) {
      try { console.warn('[navigateScreen]', e); } catch (_) {}
    }
  }, label);
}
try { window.navigateScreen = navigateScreen; } catch (_) {}

/** Silver = each duration win (1/2/3 min). Gold = bot fully cleared (3/3). */
function totalSilverStars() {
  return totalBotStars();
}
function maxSilverStars() {
  return (BOTS && BOTS.length ? BOTS.length : 0) * 3;
}
function totalGoldStars() {
  let n = 0;
  if (!BOTS || !BOTS.length) return 0;
  for (const b of BOTS) {
    if (getBotStarCount(b.id) >= 3) n++;
  }
  return n;
}
function maxGoldStars() {
  return BOTS && BOTS.length ? BOTS.length : 0;
}
function updateMenuStats() {
  const tEl = document.getElementById('menuTrophies');
  const dEl = document.getElementById('menuDiamonds');
  const bEl = document.getElementById('menuBest');
  if (tEl) tEl.textContent = trophies;
  if (dEl) dEl.textContent = diamonds;
  if (bEl) bEl.textContent = best;
  const live = document.getElementById('trophiesLive');
  if (live) live.textContent = trophies;
  // Silver stars: collected / total (top bar)
  const silverEl = document.getElementById('menuSilverStars');
  if (silverEl) silverEl.textContent = totalSilverStars() + '/' + maxSilverStars();
  // Gold star counter only if element still exists somewhere
  const goldEl = document.getElementById('menuGoldStars');
  if (goldEl) goldEl.textContent = totalGoldStars() + '/' + maxGoldStars();
  const starsEl = document.getElementById('menuStars');
  if (starsEl) starsEl.textContent = totalSilverStars() + '/' + maxSilverStars();
  const rb = document.getElementById('menuRankedBest');
  if (rb) rb.textContent = rankedBest;
  const csh = document.getElementById('compSilverHint');
  if (csh) csh.textContent = totalSilverStars() + '/' + maxSilverStars();
  try { updateAchievementsButton(); } catch (_) {}
  try { refreshProfileUI(); } catch (_) {}
}
