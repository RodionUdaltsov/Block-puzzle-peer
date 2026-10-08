/**
 * Block Puzzle — js/08-gameplay/09-fx-combo-stuck.js
 * Themed particles, combo, score floats, stuck/relief, versus flow.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function legendSparkPalette(skinId) {
  const id = skinId || (document.body.dataset && document.body.dataset.skinId) || '';
  if (id === 'cyber') return ['#0aff99', '#00f5ff', '#7b2ff7', '#ff006e', '#4cc9f0', '#b8f2e6'];
  if (id === 'midnight') return ['#5ee7ff', '#7c5cff', '#c9ada7', '#e0e1dd', '#415a77', '#778da9'];
  if (id === 'gold') return ['#ffd700', '#fff3a0', '#ffb703', '#ffe566', '#f4a261', '#ffdb58'];
  return ['#ffd666', '#fff6c8', '#c77dff', '#5ee7ff', '#ff9ecd', '#ffe566'];
}

function applyParticleOrigin(el, origin) {
  if (!el) return;
  if (origin && origin.left != null && origin.top != null) {
    el.style.left = origin.left + 'px';
    el.style.top = origin.top + 'px';
    el.style.marginLeft = '0';
    el.style.marginTop = '0';
    el.style.transform = 'translate(-50%, -50%)';
  }
}
function spawnLegendSparks(boardWrap, count, skinId, origin) {
  if (!boardWrap || settings.anim === 'off') return;
  const n = _fxCount(Math.max(6, Math.min(18, count || 10)), 3);
  if (!n) return;
  const palette = legendSparkPalette(skinId);
  boardWrap.style.position = boardWrap.style.position || 'relative';
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    const isRing = i % 5 === 0;
    sp.className = 'legend-spark' + (isRing ? ' ring' : '');
    applyParticleOrigin(sp, origin);
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.35;
    const dist = 40 + Math.random() * 85;
    sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
    const col = palette[i % palette.length];
    if (!isRing) sp.style.background = col;
    sp.style.color = col;
    sp.style.animationDelay = (Math.random() * 0.1) + 's';
    boardWrap.appendChild(sp);
    setTimeout(() => { try { sp.remove(); } catch (_) {} }, 1100);
  }
}

function spawnEpicSparks(boardWrap, count, origin) {
  if (!boardWrap || settings.anim === 'off') return;
  const n = _fxCount(Math.max(4, Math.min(12, count || 6)), 2);
  if (!n) return;
  const palette = ['#c77dff', '#ffd666', '#5ee7ff', '#ff8fab', '#a78bfa'];
  boardWrap.style.position = boardWrap.style.position || 'relative';
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    sp.className = 'epic-spark';
    applyParticleOrigin(sp, origin);
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 28 + Math.random() * 48;
    sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
    sp.style.background = palette[i % palette.length];
    sp.style.color = palette[i % palette.length];
    boardWrap.appendChild(sp);
    setTimeout(() => { try { sp.remove(); } catch (_) {} }, 900);
  }
}

function spawnThemedParticles(boardWrap, skinId, rarity, nLines, origin) {
  if (!boardWrap || settings.anim === 'off') return;
  if (rarity === 'common' || !rarity) return; // common: no FX
  // Intensity by rarity: rare modest, epic medium, legend strong
  let base, mult, distMax, life;
  if (rarity === 'legendary') { base = 10; mult = 4; distMax = 100; life = 1500; }
  else if (rarity === 'epic') { base = 7; mult = 3; distMax = 78; life = 1300; }
  else { base = 4; mult = 2; distMax = 52; life = 1050; } // rare
  const n = _fxCount(Math.max(base, Math.min(base + 12, base + (nLines || 1) * mult)), 2);
  if (!n) return;
  boardWrap.style.position = boardWrap.style.position || 'relative';
  const id = skinId || 'default';
  const clsMap = {
    gold: 'gold-shard',
    sakura: 'sakura-petal',
    cyber: 'cyber-bit',
    lava: 'lava-ember',
    toxic: 'toxic-drop',
    ice: 'ice-flake',
    aurora: 'aurora-wisp',
    neon: 'neon-spark',
    royal: 'royal-gem',
    midnight: 'midnight-star',
    candy: 'candy-spark',
    sunset: 'sunset-spark'
  };
  let pclass = clsMap[id];
  if (!pclass) {
    if (rarity === 'legendary') pclass = 'gold-shard';
    else if (rarity === 'epic') pclass = 'royal-gem';
    else if (rarity === 'rare') pclass = 'neon-spark';
    else return;
  }
  const neonCols = ['#39ff14','#ff00ff','#00f5ff','#ffe600','#ff3d81'];
  const sunsetCols = ['#ff6b35','#ffd166','#ef476f','#f4a261'];
  const candyCols = ['#ff8fab','#bde0fe','#ffc8dd','#a2d2ff','#cdb4db'];
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    sp.className = 'skin-particle ' + pclass;
    if (pclass === 'cyber-bit' && i % 2) sp.classList.add('alt');
    if (pclass === 'neon-spark') {
      const c = neonCols[i % neonCols.length];
      sp.style.background = c;
      sp.style.color = c;
      sp.style.boxShadow = '0 0 10px ' + c + ', 0 0 18px ' + c;
    }
    if (pclass === 'sunset-spark') {
      const c = sunsetCols[i % sunsetCols.length];
      sp.style.background = c;
      sp.style.boxShadow = '0 0 8px ' + c;
    }
    if (pclass === 'candy-spark') {
      const c = candyCols[i % candyCols.length];
      sp.style.background = c;
      sp.style.boxShadow = '0 0 8px ' + c;
    }
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.55;
    const dist = 24 + Math.random() * distMax;
    sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
    sp.style.setProperty('--rot', (120 + Math.random() * 280) + 'deg');
    sp.style.animationDelay = (Math.random() * 0.1) + 's';
    applyParticleOrigin(sp, origin);
    boardWrap.appendChild(sp);
    setTimeout(() => { try { sp.remove(); } catch (_) {} }, life);
  }
}

function resolveFloatAnchor(wrap, opts) {
  opts = opts || {};
  // 1) explicit pixel positions
  if (opts.positions && opts.positions.length) {
    const p = opts.positions.find(x => x && x.left != null && x.top != null);
    if (p) return { left: p.left, top: p.top };
  }
  // 2) placeAnchor → measure on board inside wrap
  const board = wrap && wrap.querySelector && wrap.querySelector('.board');
  const a = opts.placeAnchor || window._lastPlaceAnchor;
  if (board && a) {
    if (typeof a.centerR === 'number' && typeof a.centerC === 'number') {
      const p = cellToWrapPos(board, a.centerR, a.centerC);
      if (p) return p;
    }
    if (typeof a.baseR === 'number' && typeof a.baseC === 'number') {
      const p = cellToWrapPos(board, a.baseR, a.baseC);
      if (p) return p;
    }
  }
  return null;
}
function showCombo(banner, n, bonus, boardWrap, side, opts) {
  opts = opts || {};
  // Combo labels always run unless animations fully disabled
  if (settings.anim === 'off') return;
  const chain = opts.chain || 0;
  const isCombo = n >= 2 || chain >= 2;
  const wrap = boardWrap || (banner && banner.parentElement);
  if (!banner && wrap) banner = wrap.querySelector('.combo-banner');
  if (!banner && side === 'opp') banner = document.getElementById('comboBannerOpp');
  if (!banner && (side === 'me' || !side)) {
    banner = document.getElementById('comboBannerMe') || document.getElementById('comboBanner');
  }
  let sideKey = side;
  if (!sideKey && wrap) {
    if (wrap.closest && wrap.closest('.player-panel.opp')) sideKey = 'opp';
    else sideKey = 'me';
  }
  if (!sideKey) sideKey = 'me';
  let meta = { id: 'default', rarity: 'common' };
  try { meta = skinMetaForSide(sideKey) || meta; } catch (_) {}

  // Always resolve anchor near last placed piece
  let anchor = resolveFloatAnchor(wrap, opts);
  if (!anchor && opts.positions && opts.positions[0]) anchor = opts.positions[0];
  const positions = (anchor && anchor.left != null)
    ? [{ left: anchor.left, top: anchor.top, kind: 'place' }]
    : (opts.positions || []).filter(p => p && p.left != null);

  if (banner && (n >= 1 || chain >= 2 || bonus > 0)) {
    let label;
    if (chain >= 2 && n >= 2) label = `×${n} · COMBO ×${chain}`;
    else if (chain >= 2) label = `COMBO ×${chain}`;
    else if (n >= 2) label = `×${n}`;
    else label = `+${bonus || 0}`;
    banner.textContent = label;
    // Full class reset so animation always restarts
    banner.className = 'combo-banner';
    try {
      const sf = scoreFloatSkinClass(meta.id, meta.rarity);
      const cb = sf ? sf.replace(/^sf-/, 'cb-') : '';
      if (cb) banner.classList.add(cb);
    } catch (_) {}
    // Pin banner to piece location (not board center)
    if (anchor && anchor.left != null && anchor.top != null) {
      banner.style.left = anchor.left + 'px';
      banner.style.top = anchor.top + 'px';
    } else {
      banner.style.left = '50%';
      banner.style.top = '50%';
    }
    // Force reflow then show — CSS handles fade; auto-clear after anim
    void banner.offsetWidth;
    banner.classList.add('show');
    try {
      clearTimeout(banner._hideT);
      banner._hideT = setTimeout(() => {
        try {
          banner.classList.remove('show');
          banner.textContent = '';
          banner.style.left = '';
          banner.style.top = '';
          banner.style.opacity = '';
        } catch (__) {}
      }, 900);
    } catch (_) {}
  }
  if (wrap && settings.floats !== '0' && bonus) {
    spawnScoreFloat(wrap, bonus, isCombo, meta.rarity, meta.id, positions, chain);
  }
  try {
    if (!wrap || n < 1) return;
    const rar = meta.rarity || 'common';
    if (rar === 'common') return;
    const intensity = Math.max(n || 1, chain || 0);
    if (rar === 'legendary') {
      wrap.classList.remove('legend-combo-flash');
      void wrap.offsetWidth;
      if (anchor && anchor.left != null) {
        wrap.style.setProperty('--flash-x', anchor.left + 'px');
        wrap.style.setProperty('--flash-y', anchor.top + 'px');
      }
      wrap.classList.add('legend-combo-flash');
      setTimeout(() => { try { wrap.classList.remove('legend-combo-flash'); } catch (_) {} }, 650);
      spawnLegendSparks(wrap, 10 + intensity * 3, meta.id, anchor);
      spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
    } else if (rar === 'epic') {
      spawnEpicSparks(wrap, 4 + intensity * 2, anchor);
      spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
    } else if (rar === 'rare') {
      spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
    }
  } catch (_) {}
}

function scoreFloatSkinClass(skinId, rarity) {
  const id = skinId || '';
  if (rarity === 'rare') {
    if (id === 'neon') return 'sf-rare-neon';
    if (id === 'ice') return 'sf-rare-ice';
    if (id === 'sunset') return 'sf-rare-sunset';
    if (id === 'candy') return 'sf-rare-candy';
    return 'sf-rare';
  }
  if (rarity === 'epic') {
    if (id === 'lava') return 'sf-epic-lava';
    if (id === 'royal') return 'sf-epic-royal';
    if (id === 'aurora') return 'sf-epic-aurora';
    if (id === 'sakura') return 'sf-epic-sakura';
    if (id === 'toxic') return 'sf-epic-toxic';
    return 'sf-epic';
  }
  if (rarity === 'legendary') {
    if (id === 'cyber') return 'sf-legend-cyber';
    if (id === 'midnight') return 'sf-legend-midnight';
    if (id === 'gold') return 'sf-legend-gold';
    return 'sf-legend';
  }
  return ''; // common: no special float FX
}

function spawnScoreFloat(boardWrap, amount, isCombo, rarityHint, skinId, positions, chain) {
  if (!boardWrap || !amount || settings.floats === '0') return;
  boardWrap.style.position = boardWrap.style.position || 'relative';
  const rar = rarityHint || (document.body.dataset && document.body.dataset.skinRarity) || 'common';
  const skinCls = scoreFloatSkinClass(skinId, rar);
  const life = rar === 'legendary' ? 1400 : rar === 'epic' ? 1200 : rar === 'rare' ? 1250 : 1000;
  let pts = (positions && positions.length)
    ? positions.filter(p => p && p.left != null && p.top != null)
    : [];
  // Fallback: last placed piece on this board
  if (!pts.length) {
    const fb = resolveFloatAnchor(boardWrap, { placeAnchor: window._lastPlaceAnchor });
    if (fb) pts = [fb];
  }
  if (!pts.length) return;
  // One float at placement (or first clear point) with full bonus amount
  const showPts = pts.slice(0, 1);
  showPts.forEach((pt, i) => {
    const el = document.createElement('div');
    el.className = 'score-float'
      + (isCombo ? ' combo' : '')
      + (skinCls ? ' ' + skinCls : '')
      + (chain >= 2 ? ' chain' : '');
    el.textContent = `+${amount}`;
    el.style.left = pt.left + 'px';
    el.style.top = pt.top + 'px';
    el.style.animationDelay = (i * 0.05) + 's';
    boardWrap.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, life + i * 40);
  });
  // Chain tag near the same place as the score (not board center)
  if (chain >= 2) {
    const base = showPts[0];
    const ch = document.createElement('div');
    ch.className = 'score-float combo chain-tag' + (skinCls ? ' ' + skinCls : '');
    ch.textContent = `×${chain}`;
    ch.style.left = (base.left) + 'px';
    ch.style.top = Math.max(8, base.top - 22) + 'px';
    boardWrap.appendChild(ch);
    setTimeout(() => { try { ch.remove(); } catch (_) {} }, life + 80);
  }
}
function checkStuck() {
  if (mode!=='classic') return;
  const available = pieces.filter(p=>!p.used);
  if (!available.length) return;
  if (!available.some(p => findAllPlacements(grid, p.shape).length > 0)) {
    if (diamonds>=1) stuckOfferEl.classList.add('visible');
    else {
      document.getElementById('finalScore').textContent = score;
      const msg = document.getElementById('gameOverMsg');
      if (msg) msg.textContent = (typeof globalThis.t==='function'?globalThis.t('js.noSpace','Места больше нет'):'Места больше нет');
      clearClassicSave();
      gameOverEl.classList.add('visible');
    }
  }
}
function doRelief() {
  if (diamonds<1||mode!=='classic') return;
  if (!grid.some(row => row.some(x => x))) return; // empty board: nothing to clear, keep the diamond
  diamonds--;
  try { bumpAchStat('reliefUsed', 1); } catch (_) {}
  try { if (mode === 'classic') window._classicUsedRelief = true; } catch (_) {} updateClassicUI(); stuckOfferEl.classList.remove('visible');
  let bestR=0,bestRF=0,bestC=0,bestCF=0;
  for (let r=0;r<SIZE;r++) { const f=grid[r].filter(x=>x).length; if(f>bestRF){bestRF=f;bestR=r;} }
  for (let c=0;c<SIZE;c++) { const f=grid.filter(row=>row[c]).length; if(f>bestCF){bestCF=f;bestC=c;} }
  const toClear = new Set();
  if (bestRF>=2) for(let c=0;c<SIZE;c++) if(grid[bestR][c]) toClear.add(bestR*SIZE+c);
  if (bestCF>=2) for(let r=0;r<SIZE;r++) if(grid[r][bestC]) toClear.add(r*SIZE+bestC);
  if (!toClear.size) {
    const filled=[]; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(grid[r][c]) filled.push(r*SIZE+c);
    filled.sort(()=>Math.random()-0.5).slice(0,8).forEach(i=>toClear.add(i));
  }
  const reliefMeta = getClearAnimMeta(boardEl);
  toClear.forEach(idx => {
    const cell = boardEl.children[idx];
    if (!cell) return;
    CLEARING_CLASSES.forEach(c => cell.classList.remove(c));
    cell.classList.add(reliefMeta.cls);
  });
  setTimeout(() => {
    let sumR = 0, sumC = 0, nC = 0;
    toClear.forEach(idx => {
      const r=Math.floor(idx/SIZE),c=idx%SIZE;
      grid[r][c]=null;
      sumR += r; sumC += c; nC++;
    });
    score += toClear.size*15+30; updateClassicUI(); renderGrid(grid, boardEl);
    pieces.forEach(p=>p.used=true); generatePieces(piecesArea);
    const placeAnchor = nC ? { centerR: sumR / nC, centerC: sumC / nC } : null;
    const positions = getClearFloatPositions(boardEl, [], [], placeAnchor);
    showCombo(comboBanner, 0, toClear.size*15+30, boardEl.parentElement, 'me', { positions, placeAnchor });
    setTimeout(checkStuck, 150);
  }, reliefMeta.ms);
}

function startVersusFlow() { showScreen('compType'); }

