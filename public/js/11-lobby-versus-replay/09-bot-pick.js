/**
 * Block Puzzle — js/11-lobby-versus-replay/09-bot-pick.js
 * Bot pick overlay.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
let botPickBusy = false;
function showBotPickOverlay(bot, phase) {
  const ov = document.getElementById('botPickOverlay');
  const av = document.getElementById('botPickAvatar');
  const name = document.getElementById('botPickName');
  const meta = document.getElementById('botPickMeta');
  const stars = document.getElementById('botPickStars');
  const label = document.getElementById('botPickLabel');
  if (!ov || !bot) return;
  // Restart reel animation each tick (translateY + fade)
  if (av) {
    av.classList.remove('spin', 'bot-pick-flash');
    void av.offsetWidth;
  }
  if (name) {
    name.classList.remove('bot-pick-name-spin', 'bot-pick-name-final');
    void name.offsetWidth;
  }
  av.innerHTML = botAvatarSVG(bot, 88);
  name.textContent = bot.name;
  const tier = (typeof botTierLabel === 'function')
    ? botTierLabel(bot.trophies)
    : (bot.title || '');
  meta.innerHTML =
    '<span class="bot-pick-cups">🏆 ' + (bot.trophies | 0) + '</span>' +
    (tier ? ('<span class="bot-pick-tier">' + tier + '</span>') : '');
  const st = (typeof botStars !== 'undefined' && botStars[bot.id]) ? botStars[bot.id] : {};
  stars.innerHTML = [60, 120, 180].map(sec =>
    '<span style="opacity:' + (st[String(sec)] ? 1 : 0.25) + '">★</span>'
  ).join('');
  if (phase === 'spin') {
    label.textContent = (typeof globalThis.t==='function'?globalThis.t('js.scrollOpps','Прокрутка соперников…'):'Прокрутка соперников…');
    av.classList.add('spin');
    name.classList.add('bot-pick-name-spin');
  } else {
    label.textContent = (typeof globalThis.t==='function'?globalThis.t('js.yourOpponent','Твой соперник'):'Твой соперник');
    av.classList.remove('spin');
    name.classList.remove('bot-pick-name-spin');
    void name.offsetWidth;
    name.classList.add('bot-pick-name-final');
  }
  ov.classList.add('visible');
  ov.setAttribute('aria-hidden', 'false');
}
function hideBotPickOverlay() {
  const ov = document.getElementById('botPickOverlay');
  if (!ov) return;
  ov.classList.remove('visible');
  ov.setAttribute('aria-hidden', 'true');
  const av = document.getElementById('botPickAvatar');
  if (av) av.classList.remove('spin');
}
function startRandomBotPick() {
  if (botPickBusy) return;
  if (!BOTS || !BOTS.length) return;
  botPickBusy = true;
  try { SFX.ui(); } catch (_) {}
  try { hapticTap(10); } catch (_) {}
  // Sort by trophies so the reel "climbs" visually at times
  const sorted = BOTS.slice().sort((a, b) => (a.trophies | 0) - (b.trophies | 0));
  let ticks = 0;
  const totalTicks = 22 + Math.floor(Math.random() * 10);
  let delay = 35;
  const finalBot = sorted[Math.floor(Math.random() * sorted.length)];
  let cursor = Math.floor(Math.random() * sorted.length);
  try {
    const ov = document.getElementById('botPickOverlay');
    if (ov) {
      ov.style.display = '';
      ov.style.pointerEvents = '';
      ov.style.opacity = '';
      ov.classList.add('visible');
      ov.setAttribute('aria-hidden', 'false');
    }
  } catch (_) {}

  const highlightList = (bot) => {
    try {
      document.querySelectorAll('.bot-card.pick-flash').forEach(c => c.classList.remove('pick-flash'));
      if (!bot) return;
      const card = document.querySelector('.bot-card[data-bot="' + bot.id + '"]');
      if (card) {
        card.classList.add('pick-flash');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } catch (_) {}
  };

  const tick = () => {
    ticks++;
    let show;
    if (ticks >= totalTicks) {
      show = finalBot;
    } else {
      // Mostly sequential reel with occasional jumps
      cursor = (cursor + 1 + (Math.random() < 0.18 ? Math.floor(Math.random() * 5) : 0)) % sorted.length;
      show = sorted[cursor];
    }
    showBotPickOverlay(show, ticks >= totalTicks ? 'final' : 'spin');
    highlightList(show);
    try { if (ticks % 2 === 0) SFX.ui(); } catch (_) {}
    if (ticks < totalTicks) {
      // Ease out: slow near the end
      const progress = ticks / totalTicks;
      delay = Math.round(35 + progress * progress * 200);
      setTimeout(tick, delay);
    } else {
      selectedBotId = finalBot.id;
      currentBot = finalBot;
      renderBotList();
      highlightList(finalBot);
      const card = document.querySelector('.bot-card[data-bot="' + finalBot.id + '"]');
      if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      try { SFX.ui(); } catch (_) {}
      try { hapticTap(18); } catch (_) {}
      setTimeout(() => {
        hideBotPickOverlay();
        botPickBusy = false;
        try {
          document.querySelectorAll('.bot-card.pick-flash').forEach(c => c.classList.remove('pick-flash'));
        } catch (_) {}
        showScreen('duration');
      }, 1200);
    }
  };
  tick();
}
document.getElementById('btnRandomBot')?.addEventListener('click', startRandomBotPick);
document.getElementById('btnBackDiff')?.addEventListener('click', () => {
  navigateScreen('compType');
});
document.getElementById('btnBackMenu')?.addEventListener('click', () => {
  if (vsModeType === 'bots') navigateScreen('difficulty');
  else navigateScreen('compType');
});
document.getElementById('btnClassicMenu')?.addEventListener('click', () => {
  navigateScreen('menu', () => { try { updateMenuStats(); } catch (_) {} });
});
document.querySelectorAll('#screenDuration .dur-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#screenDuration .dur-card').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    vsDuration = parseInt(btn.dataset.sec, 10);
  });
});
document.getElementById('btnStartMatch')?.addEventListener('click', startMatchFlow);
document.getElementById('btnCancelSearch')?.addEventListener('click', () => {
  stopMatchmaking(true);
  mmFound = false;
  showScreen('duration');
  mmSetStatus('Ищем соперника (кроссплей)…', '—');
});

(function bindSkinPreviewModal() {
  const close = document.getElementById('skinPrevClose');
  const ov = document.getElementById('skinPreviewModal');
  if (close) close.addEventListener('click', closeSkinPreview);
  if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) closeSkinPreview(); });
})();

document.getElementById('btnShop')?.addEventListener('click', () => {
  navigateScreen('shop', () => { try { renderShopGrid(); } catch (_) {} });
});
document.getElementById('btnInventory')?.addEventListener('click', () => {
  navigateScreen('inventory', () => { try { renderInvGrid(); } catch (_) {} });
});
document.getElementById('btnShopBack')?.addEventListener('click', () => {
  navigateScreen('menu', () => {
    try { closeShopInvSections(); } catch (_) {}
    try { updateMenuStats(); } catch (_) {}
  });
});
document.getElementById('btnInvBack')?.addEventListener('click', () => {
  navigateScreen('menu', () => {
    try { closeShopInvSections(); } catch (_) {}
    try { updateMenuStats(); } catch (_) {}
  });
});
