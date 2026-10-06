/**
 * Block Puzzle — js/07-match-flow/04-achievements-claim.js
 * Achievement progress and claim ceremony.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function totalBotStars() {
  let n = 0;
  try {
    for (const id of Object.keys(botStars || {})) n += getBotStarCount(id);
  } catch (_) {}
  return n;
}
function achCurrentValue(ach) {
  switch (ach.type) {
    case 'classicBest': return best;
    case 'wins': return getAchStat('wins');
    case 'onlineWins': return getAchStat('onlineWins');
    case 'trophies': return trophies;
    case 'beatBotMax': return getAchStat('beatWeak');
    case 'beatBotMin': return getAchStat('beatBotHighest');
    case 'beatCrown': return Math.max(getAchStat('beatCrown'), getAchStat('beatApex')); // legacy apex
    case 'beatSeer': return getAchStat('beatSeer');
    case 'megaCombo': return getAchStat('megaCombo');
    case 'combo2': return getAchStat('combo2');
    case 'combo3': return getAchStat('combo3');
    case 'combo5': return getAchStat('combo5');
    case 'combo6': return getAchStat('combo6');
    case 'combo7': return getAchStat('combo7');
    case 'combo8': return getAchStat('combo8');
    case 'combo10': return getAchStat('combo10');
    case 'linesCleared': return getAchStat('linesCleared');
    case 'matchesPlayed': return getAchStat('matchesPlayed');
    case 'botStars': return totalBotStars();
    case 'rankedBest': return (typeof rankedBest === 'number' ? rankedBest : 0);
    case 'skinsOwned': return (ownedSkins && ownedSkins.length) ? ownedSkins.length : getAchStat('skinsOwned');
    case 'skinsBought': return getAchStat('skinsBought');
    case 'reliefUsed': return getAchStat('reliefUsed');
    case 'blowoutWin': return getAchStat('blowoutWin');
    case 'clutchWin': return getAchStat('clutchWin');
    case 'botWins': return getAchStat('botWins');
    case 'winDur60': return getAchStat('winDur60');
    case 'winDur120': return getAchStat('winDur120');
    case 'winDur180': return getAchStat('winDur180');
    case 'friendsCount':
      try { return (typeof friends !== 'undefined' && Array.isArray(friends)) ? friends.length : getAchStat('friendsCount'); } catch (_) { return getAchStat('friendsCount'); }
    case 'diamondsHeld': return (typeof diamonds === 'number') ? diamonds : 0;
    case 'achClaimed':
      return ACHIEVEMENTS.filter(a => achProgress['claimed_' + a.id]).length;
    case 'profileNick': return getAchStat('profileNick');
    case 'profileAvatar': return getAchStat('profileAvatar');
    case 'profileCustom': return getAchStat('profileCustom');
    case 'profileStatus': return getAchStat('profileStatus');
    case 'boardsBought': return getAchStat('boardsBought');
    case 'boardsOwned':
      try { return (ownedBoards && ownedBoards.length) ? ownedBoards.length : getAchStat('boardsOwned'); } catch (_) { return getAchStat('boardsOwned'); }
    case 'boardsLegendary': return getAchStat('boardsLegendary');
    case 'winStreak': return Math.max(getAchStat('winStreak'), getAchStat('winStreakBest'));
    case 'comebackWin': return getAchStat('comebackWin');
    case 'rematchPlayed': return getAchStat('rematchPlayed');
            case 'allBotStars':
      try {
        const maxS = maxSilverStars();
        return (maxS > 0 && totalSilverStars() >= maxS) ? 1 : 0;
      } catch (_) { return 0; }
    case 'halfBotStars':
      try {
        const maxS = maxSilverStars();
        return (maxS > 0 && totalSilverStars() >= Math.ceil(maxS / 2)) ? 1 : 0;
      } catch (_) { return 0; }
    case 'perfectClassic': return getAchStat('perfectClassic');
    default: return 0;
  }
}

function achIsDone(ach) {
  if (ach.type === 'beatBotMax') return getAchStat('beatWeak') >= 1;
  if (ach.type === 'beatBotMin') return getAchStat('beatBotHighest') >= ach.target;
  if (ach.type === 'beatCrown') return getAchStat('beatCrown') >= 1 || getAchStat('beatApex') >= 1;
  if (ach.type === 'beatSeer') return getAchStat('beatSeer') >= 1;
  return achCurrentValue(ach) >= ach.target;
}

function achReadyToClaim(ach) {
  if (achProgress['claimed_' + ach.id]) return false;
  return achIsDone(ach);
}

function flashDiamonds(amount, nearEl) {
  // legacy no-op kept for safety; claim uses showAchClaimCeremony
}

let achClaimTimers = [];
let achClaimOpen = false;
function clearAchClaimTimers() {
  achClaimTimers.forEach(t => clearTimeout(t));
  achClaimTimers = [];
}
function closeAchClaim() {
  const ov = document.getElementById('achClaimOverlay');
  if (!ov) return;
  ov.classList.remove('visible', 'reward-in', 'burst', 'multi');
  ov.setAttribute('aria-hidden', 'true');
  achClaimOpen = false;
  clearAchClaimTimers();
}
function showAchClaimCeremony(ach, multiList) {
  const ov = document.getElementById('achClaimOverlay');
  if (!ov) return;
  const isMulti = Array.isArray(multiList) && multiList.length > 0;
  if (!isMulti && !ach) return;
  clearAchClaimTimers();
  ov.classList.remove('visible', 'reward-in', 'burst', 'multi');
  void ov.offsetWidth;

  const labelEl = document.getElementById('achClaimLabel');
  const titleEl = document.getElementById('achClaimTitle');
  const descEl = document.getElementById('achClaimDesc');
  const rewardEl = document.getElementById('achClaimReward');
  const listEl = document.getElementById('achClaimList');
  const countEl = document.getElementById('achClaimCount');
  const badgeEl = document.getElementById('achClaimBadge');

  if (isMulti) {
    ov.classList.add('multi');
    const total = multiList.reduce((s, a) => s + (a.reward || 0), 0);
    if (labelEl) labelEl.textContent = (typeof globalThis.t==='function'?globalThis.t('js.awardsCollected','Награды собраны'):'Награды собраны');
    if (badgeEl) badgeEl.textContent = '✨';
    if (titleEl) titleEl.textContent = multiList.length === 1
      ? (multiList[0].title || 'Достижение')
      : `${multiList.length} достижений`;
    if (descEl) {
      descEl.textContent = multiList.length > 1
        ? 'Все готовые награды зачислены'
        : (multiList[0].desc || '');
    }
    if (countEl) {
      countEl.style.display = '';
      countEl.textContent = `🏅 ${multiList.length} · итог`;
    }
    if (listEl) {
      listEl.style.display = multiList.length > 1 ? '' : 'none';
      listEl.innerHTML = multiList.map((a, i) => {
        const ico = (ACH_SECTIONS.find(s => s.id === a.section) || {}).icon || '🏅';
        return `<div class="ach-claim-list-item" style="animation-delay:${0.08 + i * 0.045}s">
          <span class="ai-ico">${ico}</span>
          <span>${a.title || 'Достижение'}</span>
          <span class="ai-reward">+${a.reward} 💎</span>
        </div>`;
      }).join('');
    }
    if (rewardEl) rewardEl.textContent = `+${total} 💎`;
  } else {
    if (labelEl) labelEl.textContent = (typeof globalThis.t==='function'?globalThis.t('js.achGot','Достижение получено'):'Достижение получено');
    if (badgeEl) badgeEl.textContent = '✓';
    if (titleEl) titleEl.textContent = ach.title || (typeof globalThis.t==='function'?globalThis.t('js.ach','Достижение'):'Достижение');
    if (descEl) descEl.textContent = ach.desc || '';
    if (countEl) { countEl.style.display = 'none'; countEl.textContent = ''; }
    if (listEl) { listEl.style.display = 'none'; listEl.innerHTML = ''; }
    if (rewardEl) rewardEl.textContent = `+${ach.reward} 💎`;
  }

  const parts = document.getElementById('achClaimParticles');
  if (parts) {
    parts.innerHTML = '';
    const n = isMulti ? Math.min(28, 12 + multiList.length * 2) : 14;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 48 + Math.random() * (isMulti ? 90 : 70);
      s.style.left = '50%';
      s.style.top = '42%';
      s.style.setProperty('--tx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--ty', Math.sin(ang) * dist + 'px');
      s.style.animationDelay = (0.35 + Math.random() * 0.2) + 's';
      s.style.background = i % 3 === 0 ? 'var(--accent)' : (i % 3 === 1 ? 'var(--diamond)' : 'var(--trophy)');
      if (isMulti) {
        s.style.width = (5 + Math.random() * 4) + 'px';
        s.style.height = s.style.width;
      }
      parts.appendChild(s);
    }
  }
  ov.classList.add('visible');
  ov.setAttribute('aria-hidden', 'false');
  achClaimOpen = true;
  try { SFX.combo(); hapticTap(isMulti ? 22 : 18); } catch (_) {}
  achClaimTimers.push(setTimeout(() => {
    ov.classList.add('reward-in', 'burst');
    try { SFX.ui(); hapticTap(12); } catch (_) {}
  }, isMulti ? 480 : 380));
  achClaimTimers.push(setTimeout(() => {
    if (achClaimOpen) closeAchClaim();
  }, isMulti ? 5200 : 2800));
}

let claimAllBusy = false;
function claimAllAchievements() {
  if (claimAllBusy || achClaimOpen) return;
  // Snapshot only currently claimable; each id granted at most once
  const ready = ACHIEVEMENTS.filter(a => achReadyToClaim(a));
  if (!ready.length) return;
  claimAllBusy = true;
  try {
    const btn = document.getElementById('btnClaimAllAch');
    if (btn) btn.disabled = true;

    const granted = [];
    let total = 0;
    const seen = new Set();
    for (const ach of ready) {
      if (!ach || !ach.id) continue;
      if (seen.has(ach.id)) continue;
      if (achProgress['claimed_' + ach.id]) continue;
      if (!achIsDone(ach)) continue;
      seen.add(ach.id);
      achProgress['claimed_' + ach.id] = 1;
      const reward = Math.max(0, parseInt(ach.reward, 10) || 0);
      total += reward;
      granted.push(ach);
    }
    if (!granted.length) {
      claimAllBusy = false;
      if (btn) btn.disabled = false;
      updateClaimAllButton();
      return;
    }
    diamonds = Math.max(0, (parseInt(diamonds, 10) || 0) + total);
    saveAch();
    try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
    updateMenuStats();
    try { if (diamondsEl) diamondsEl.textContent = diamonds; } catch (_) {}
    showAchClaimCeremony(null, granted);
    renderAchievements();
    updateAchievementsButton();
    updateClaimAllButton();
  } finally {
    // unlock after ceremony can be reopened (avoid double-tap race)
    setTimeout(() => {
      claimAllBusy = false;
      const btn = document.getElementById('btnClaimAllAch');
      if (btn) btn.disabled = false;
      try { updateClaimAllButton(); } catch (_) {}
    }, 600);
  }
}

function updateClaimAllButton() {
  const btn = document.getElementById('btnClaimAllAch');
  const meta = document.getElementById('achClaimAllMeta');
  const spacer = document.getElementById('achTopSpacer');
  if (!btn) return;
  const ready = ACHIEVEMENTS.filter(a => achReadyToClaim(a));
  if (!ready.length) {
    btn.style.display = 'none';
    if (spacer) spacer.style.display = '';
    return;
  }
  btn.style.display = '';
  if (spacer) spacer.style.display = 'none';
  const total = ready.reduce((s, a) => s + (a.reward || 0), 0);
  if (meta) meta.textContent = `+${total} 💎`;
  btn.title = ready.length === 1
    ? `Собрать 1 награду · +${total} 💎`
    : `Собрать все (${ready.length}) · +${total} 💎`;
}
document.getElementById('achClaimOverlay')?.addEventListener('click', () => {
  if (achClaimOpen) closeAchClaim();
});

function claimAchievement(achId, btnEl) {
  if (claimAllBusy || achClaimOpen) return;
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach || achProgress['claimed_' + ach.id] || !achIsDone(ach)) return;
  achProgress['claimed_' + ach.id] = 1;
  const reward = Math.max(0, parseInt(ach.reward, 10) || 0);
  diamonds = Math.max(0, (parseInt(diamonds, 10) || 0) + reward);
  saveAch();
  try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
  updateMenuStats();
  try { if (diamondsEl) diamondsEl.textContent = diamonds; } catch(_){}
  showAchClaimCeremony(ach);
  renderAchievements();
  updateAchievementsButton();
  try { updateClaimAllButton(); } catch (_) {}
}
