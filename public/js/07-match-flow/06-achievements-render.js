/**
 * Block Puzzle — js/07-match-flow/06-achievements-render.js
 * Achievements rendering and tracking.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function closeAllAchTabs() {
  try { sessionStorage.removeItem('bp_ach_open'); } catch (_) {}
  const list = document.getElementById('achList');
  if (!list) return;
  list.querySelectorAll('.ach-scroll').forEach(el => {
    el.classList.remove('open', 'ach-rise', 'ach-flip');
    el.style.transition = '';
    el.style.transform = '';
  });
}

function renderAchievements() {
  const list = document.getElementById('achList');
  if (!list) return;
  let openMap = {};
  try { openMap = JSON.parse(sessionStorage.getItem('bp_ach_open') || '{}') || {}; } catch (_) { openMap = {}; }
  // Only one section may be open
  const openId = Object.keys(openMap).find(k => openMap[k] === 1) || null;

  const cardHTML = (ach) => {
    const claimed = !!achProgress['claimed_' + ach.id];
    const ready = achReadyToClaim(ach);
    const cur = achCurrentValue(ach);
    const pct = Math.min(100, Math.round((cur / Math.max(1, ach.target)) * 100));
    let status = `${Math.min(cur, ach.target)} / ${ach.target}`;
    let claimBtn = '';
    if (claimed) status = '✓';
    else if (ready) {
      claimBtn = `<button type="button" class="ach-claim-btn" data-ach="${ach.id}">+${ach.reward} 💎</button>`;
      status = 'Готово';
    }
    return `<div class="ach-card ${claimed ? 'done' : ''} ${ready ? 'ready' : ''}">
      <div class="ach-top">
        <div class="ach-title">${ach.title}</div>
        <div class="ach-reward">+${ach.reward} 💎</div>
      </div>
      <div class="ach-desc">${ach.desc}</div>
      <div class="ach-progress"><div style="width:${claimed || ready ? 100 : pct}%"></div></div>
      <div class="ach-status">${status}</div>
      ${claimBtn}
    </div>`;
  };

  // Build sections; ready-to-claim stay INSIDE their tabs (sorted to top)
  const sectionNodes = [];
  for (const sec of ACH_SECTIONS) {
    const items = ACHIEVEMENTS.filter(a => (a.section || 'classic') === sec.id);
    if (!items.length) continue;
    const doneN = items.filter(a => achIsDone(a) || achProgress['claimed_' + a.id]).length;
    const readyN = items.filter(a => achReadyToClaim(a)).length;
    const isOpen = openId === sec.id;
    const bodyItems = [...items].sort((a, b) => {
      // Ready to claim first → in progress → claimed last
      const rank = (x) => {
        if (achReadyToClaim(x)) return 0;
        if (achProgress['claimed_' + x.id]) return 2;
        return 1;
      };
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (achCurrentValue(b) / Math.max(1, b.target)) - (achCurrentValue(a) / Math.max(1, a.target));
    });
    sectionNodes.push({
      id: sec.id,
      isOpen,
      html: `<div class="ach-scroll ${isOpen ? 'open' : ''}" data-sec="${sec.id}">
      <button type="button" class="ach-scroll-head" data-toggle-sec="${sec.id}">
        <span class="ach-scroll-ico">${sec.icon || '📜'}</span>
        <span class="ach-scroll-title">${sec.title}</span>
        ${readyN ? `<span class="ach-scroll-ready-dot" title="Можно забрать: ${readyN}"></span>` : ''}
        <span class="ach-scroll-count ${doneN >= items.length ? 'done-all' : ''}">${doneN}/${items.length}</span>
        <span class="ach-scroll-chev">▶</span>
      </button>
      <div class="ach-scroll-body"><div class="ach-scroll-inner">${bodyItems.map(cardHTML).join('') || '<div class="ach-desc" style="padding:4px 6px">Все выполнены</div>'}</div></div>
    </div>`
    });
  }

  // Open section goes first (visual order matches accordion state)
  if (openId) {
    sectionNodes.sort((a, b) => (a.id === openId ? -1 : b.id === openId ? 1 : 0));
  }

  let html = sectionNodes.map(s => s.html).join('');
  if (!html) html = '<div class="history-empty">Пока нет достижений</div>';
  list.innerHTML = html;

  try { updateClaimAllButton(); } catch (_) {}
  list.querySelectorAll('.ach-claim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      claimAchievement(btn.dataset.ach, btn);
    });
  });

  list.querySelectorAll('[data-toggle-sec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-sec');
      const box = list.querySelector(`.ach-scroll[data-sec="${id}"]`);
      if (!box) return;
      const wasOpen = box.classList.contains('open');
      const tabs = [...list.querySelectorAll('.ach-scroll')];

      // FLIP: capture positions before layout change
      const firstRects = new Map();
      tabs.forEach(el => {
        firstRects.set(el, el.getBoundingClientRect());
        el.classList.remove('ach-flip');
        el.style.transition = 'none';
        el.style.transform = '';
      });

      // Close every section
      tabs.forEach(el => el.classList.remove('open'));
      openMap = {};

      if (!wasOpen) {
        // Move chosen tab to top, then open
        const first = list.querySelector('.ach-scroll');
        if (first && first !== box) {
          list.insertBefore(box, first);
        }
        box.classList.add('open');
        openMap[id] = 1;

        // Invert → play (smooth flow of all tabs)
        requestAnimationFrame(() => {
          const moving = [...list.querySelectorAll('.ach-scroll')];
          moving.forEach(el => {
            const f = firstRects.get(el);
            if (!f) return;
            const last = el.getBoundingClientRect();
            const dx = f.left - last.left;
            const dy = f.top - last.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
              el.style.transition = '';
              el.style.transform = '';
              return;
            }
            el.classList.add('ach-flip');
            el.style.transform = `translate(${dx}px, ${dy}px)`;
          });
          // Next frame: animate to natural positions
          requestAnimationFrame(() => {
            moving.forEach(el => {
              if (!el.classList.contains('ach-flip')) return;
              el.style.transition = 'transform 0.48s cubic-bezier(0.22, 1.05, 0.36, 1)';
              el.style.transform = 'translate(0, 0)';
            });
            const clearFlip = (el) => {
              el.classList.remove('ach-flip');
              el.style.transition = '';
              el.style.transform = '';
              el.removeEventListener('transitionend', el._flipClear);
            };
            moving.forEach(el => {
              if (!el.classList.contains('ach-flip')) return;
              clearTimeout(el._flipT);
              el._flipClear = (e) => {
                if (e && e.propertyName && e.propertyName !== 'transform') return;
                clearFlip(el);
              };
              el.addEventListener('transitionend', el._flipClear);
              el._flipT = setTimeout(() => clearFlip(el), 560);
            });
          });
        });

        // Keep opened tab visible at top of scroll area
        try {
          requestAnimationFrame(() => {
            const listTop = list.getBoundingClientRect().top;
            const boxTop = box.getBoundingClientRect().top;
            if (Math.abs(boxTop - listTop) > 12) {
              list.scrollTo({ top: list.scrollTop + (boxTop - listTop) - 4, behavior: 'smooth' });
            }
          });
        } catch (_) {}
      } else {
        // Closing only — soft settle
        tabs.forEach(el => {
          el.style.transition = '';
          el.style.transform = '';
        });
      }

      try { sessionStorage.setItem('bp_ach_open', JSON.stringify(openMap)); } catch (_) {}
    });
  });
  updateAchievementsButton();
}

function trackMatchAchievements(won) {
  bumpAchStat('matchesPlayed', 1);
  if (won) {
    const streak = (getAchStat('winStreak') || 0) + 1;
    setAchStat('winStreak', streak);
    setAchStat('winStreakBest', Math.max(getAchStat('winStreakBest') || 0, streak));
    bumpAchStat('wins', 1);
    if (vsModeType === 'online' || mpMode) bumpAchStat('onlineWins', 1);
    if (vsModeType === 'bots' || currentBot) bumpAchStat('botWins', 1);
    const dur = vsDuration || 120;
    if (dur <= 60) bumpAchStat('winDur60', 1);
    else if (dur >= 180) bumpAchStat('winDur180', 1);
    else bumpAchStat('winDur120', 1);
    try {
      const diff = Math.abs((score || 0) - (oppScore || 0));
      if (diff >= 500) bumpAchStat('blowoutWin', 1);
      if (diff <= 50) bumpAchStat('clutchWin', 1);
    } catch (_) {}
    if (currentBot) {
      if (currentBot.trophies <= 300) setAchStat('beatWeak', Math.max(1, getAchStat('beatWeak')));
      setAchStat('beatBotHighest', Math.max(getAchStat('beatBotHighest'), currentBot.trophies));
      if (currentBot.id === 'apex') {
        setAchStat('beatCrown', 1);
        setAchStat('beatApex', 1);
      }
      if (currentBot.id === 'oracle') setAchStat('beatSeer', 1);
    }
    // Comeback: was behind by 200+ at some point (flag set during match)
    try {
      if (window._matchWasBehind200) bumpAchStat('comebackWin', 1);
    } catch (_) {}
  } else {
    setAchStat('winStreak', 0);
  }
  try { window._matchWasBehind200 = false; } catch (_) {}
}
