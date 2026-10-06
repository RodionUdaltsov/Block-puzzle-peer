/**
 * Block Puzzle — js/01-cosmetics/03-skin-shop-actions.js
 * Skin buy/equip actions, purchase loading, rarity sort, shop/inventory item HTML.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function saveSkinsState() {
  try {
    localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins));
    localStorage.setItem('bp_skin_equipped', equippedSkinId);
  } catch (_) {}
}
/** Soft loading overlay while shop purchase is confirmed by the server. */
let _purchaseLoadTimer = null;
function showPurchaseLoading(kind, id) {
  try {
    let el = document.getElementById('bpPurchaseLoading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bpPurchaseLoading';
      el.setAttribute('aria-live', 'polite');
      el.innerHTML =
        '<div class="bp-buy-load-card">' +
        '<div class="bp-buy-load-spin" aria-hidden="true"></div>' +
        '<div class="bp-buy-load-title" id="bpBuyLoadTitle">Покупка…</div>' +
        '<div class="bp-buy-load-sub" id="bpBuyLoadSub">Сохраняем на сервере</div>' +
        '</div>';
      document.body.appendChild(el);
      if (!document.getElementById('bpPurchaseLoadingStyle')) {
        const st = document.createElement('style');
        st.id = 'bpPurchaseLoadingStyle';
        st.textContent =
          '#bpPurchaseLoading{position:fixed;inset:0;z-index:100060;display:flex;align-items:center;justify-content:center;' +
          'background:rgba(4,12,10,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;' +
          'transition:opacity .22s ease;pointer-events:none}' +
          '#bpPurchaseLoading.visible{opacity:1;pointer-events:auto}' +
          '.bp-buy-load-card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:26px 30px;border-radius:18px;' +
          'background:linear-gradient(160deg,rgba(20,40,36,.97),rgba(10,22,20,.97));border:1px solid rgba(0,212,170,.3);' +
          'box-shadow:0 18px 50px rgba(0,0,0,.5);min-width:220px}' +
          '.bp-buy-load-spin{width:40px;height:40px;border-radius:50%;border:3px solid rgba(0,212,170,.18);border-top-color:#00d4aa;' +
          'animation:bpBuySpin .7s linear infinite}' +
          '@keyframes bpBuySpin{to{transform:rotate(360deg)}}' +
          '.bp-buy-load-title{font-weight:800;font-size:1.02rem;color:#e8fff8;text-align:center}' +
          '.bp-buy-load-sub{font-size:.78rem;opacity:.72;color:#b8e8d8;text-align:center}';
        document.head.appendChild(st);
      }
    }
    const title = document.getElementById('bpBuyLoadTitle');
    const sub = document.getElementById('bpBuyLoadSub');
    if (title) title.textContent = kind === 'board' ? 'Покупка поля…' : 'Покупка скина…';
    if (sub) sub.textContent = id ? ('«' + String(id) + '» · синхронизация') : 'Сохраняем на сервере';
    el.style.display = 'flex';
    try { void el.offsetWidth; } catch (_) {}
    el.classList.add('visible');
    if (_purchaseLoadTimer) clearTimeout(_purchaseLoadTimer);
    // Safety timeout so overlay never sticks forever (also clears _bpBuyInFlight)
    _purchaseLoadTimer = setTimeout(function () { hidePurchaseLoading(); }, 5000);
  } catch (_) {}
}
function hidePurchaseLoading() {
  try {
    if (_purchaseLoadTimer) { clearTimeout(_purchaseLoadTimer); _purchaseLoadTimer = null; }
    try { window._bpBuyInFlight = false; } catch (_) {}
    const el = document.getElementById('bpPurchaseLoading');
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(function () {
      try { el.style.display = 'none'; } catch (_) {}
    }, 180);
  } catch (_) {}
}
try { window.showPurchaseLoading = showPurchaseLoading; window.hidePurchaseLoading = hidePurchaseLoading; } catch (_) {}

/** @returns {'ok'|'funds'|'owned'|'busy'|'bad'} */
function buySkin(id) {
  const skin = getSkinById(id);
  if (!skin || skin.price <= 0) return 'bad';
  if (ownedSkins.includes(id)) return 'owned';
  if (diamonds < skin.price) return 'funds';
  if (window._bpBuyInFlight) return 'busy';
  const online = !!(typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.cosmeticsBuy === 'function');
  try { window._bpBuyInFlight = true; } catch (_) {}
  try { showPurchaseLoading('skin', skin.name || id); } catch (_) {}
  // Snapshot for possible rollback if server rejects
  try {
    window._bpBuySnapshot = {
      diamonds: diamonds + skin.price,
      ownedSkins: ownedSkins.slice(),
      equippedSkinId: equippedSkinId
    };
  } catch (_) {}
  // Optimistic UI; server cosmetics_buy_result is source of truth
  diamonds -= skin.price;
  try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
  if (!ownedSkins.includes(id)) ownedSkins.push(id);
  equippedSkinId = id;
  try { applyEquippedSkin(); } catch (_) {}
  try { saveSkinsState(); } catch (_) {}
  try { updateMenuStats(); } catch (_) {}
  if (online) {
    try { MatchClient.cosmeticsBuy('skin', id); } catch (_) {
      try { hidePurchaseLoading(); } catch (_2) {}
    }
  } else {
    try {
      if (typeof syncGuestProgressToServer === 'function' && !(typeof authToken !== 'undefined' && authToken)) {
        syncGuestProgressToServer({ force: true }).catch(function () {});
      }
    } catch (_) {}
    try { setAchStat('skinsOwned', ownedSkins.length); } catch (_) {}
    try { bumpAchStat('skinsBought', 1); } catch (_) {}
    try { hidePurchaseLoading(); } catch (_) {}
    try { playPurchaseFx('skin', id); } catch (_) {}
  }
  return 'ok';
}
function equipSkin(id) {
  if (!ownedSkins.includes(id)) return false;
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.cosmeticsEquip === 'function') {
      MatchClient.cosmeticsEquip('skin', id);
    }
  } catch (_) {}
  equippedSkinId = id;
  applyEquippedSkin();
  saveSkinsState();
  // Retint ONLY local player tray — never opponent / bot pieces
  try {
    if (typeof pieces !== 'undefined' && pieces && pieces.length) {
      pieces.forEach(p => {
        if (p && !p.used) p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      });
    }
    if (typeof renderPieces === 'function' && typeof piecesArea !== 'undefined' && piecesArea) {
      try { renderPieces(piecesArea); } catch (_) {}
    }
    const areaVs = document.getElementById('piecesAreaVs');
    if (areaVs && typeof renderPieces === 'function' && mode === 'versus') {
      try { renderPieces(areaVs); } catch (_) {}
    }
  } catch (_) {}
  return true;
}
function skinRarityLabel(r) {
  if (r === 'legendary') return 'Легенда';
  if (r === 'epic') return 'Эпик';
  if (r === 'rare') return 'Редкий';
  return 'Обычный';
}
function skinRarityRank(r) {
  if (r === 'legendary') return 0;
  if (r === 'epic') return 1;
  if (r === 'rare') return 2;
  return 3;
}
function sortSkinsByRarity(list) {
  return [...list].sort((a, b) => {
    const ra = skinRarityRank(a.rarity || 'common');
    const rb = skinRarityRank(b.rarity || 'common');
    if (ra !== rb) return ra - rb;
    const pa = a.price || 0, pb = b.price || 0;
    if (pb !== pa) return pb - pa;
    return (a.name || '').localeCompare(b.name || '', 'ru');
  });
}
/** First-row size for collapsed skin shelf (matches grid columns). */
function skinPreviewRowCount() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 480px)').matches) return 4;
  } catch (_) {}
  return 3;
}
function bindSkinScrollToggle(root, storageKey) {
  if (!root) return;
  root.querySelectorAll('[data-toggle-skin]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-skin');
      const box = root.querySelector(`.skin-scroll[data-skin-sec="${id}"]`);
      if (!box) return;
      const nowOpen = !box.classList.contains('open');
      box.classList.toggle('open', nowOpen);
      try {
        const map = JSON.parse(sessionStorage.getItem(storageKey) || '{}') || {};
        map[id] = nowOpen ? 1 : 0;
        sessionStorage.setItem(storageKey, JSON.stringify(map));
      } catch (_) {}
      try { SFX.ui(); } catch (_) {}
    });
  });
}
/** Collapse all shop/inventory shelves and clear remembered open state. */
function closeShopInvSections() {
  try { sessionStorage.removeItem('bp_shop_open'); } catch (_) {}
  try { sessionStorage.removeItem('bp_inv_open'); } catch (_) {}
  try {
    document.querySelectorAll('#shopGrid .skin-scroll.open, #invGrid .skin-scroll.open').forEach(el => {
      el.classList.remove('open');
    });
  } catch (_) {}
  try {
    const sg = document.getElementById('shopGrid');
    if (sg) sg.scrollTop = 0;
    const ig = document.getElementById('invGrid');
    if (ig) ig.scrollTop = 0;
  } catch (_) {}
}
function skinShopItemHTML(skin) {
  const owned = ownedSkins.includes(skin.id);
  const eq = equippedSkinId === skin.id;
  const rar = skin.rarity || 'common';
  let action;
  if (eq) action = `<span class="skin-action on">Надето</span>`;
  else if (owned) action = `<button type="button" class="skin-action primary" data-equip="${skin.id}">Надеть</button>`;
  else {
    const can = diamonds >= skin.price;
    action = `<button type="button" class="skin-action ${can ? 'primary' : 'muted'}" data-buy="${skin.id}" ${can ? '' : 'disabled'}>💎 ${skin.price}</button>`;
  }
  return `<div class="skin-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" role="listitem" data-skin="${skin.id}" data-rarity="${rar}">
    <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
    <div class="skin-item-stage" data-preview="${skin.id}">
      <div class="skin-mini-board" data-mini="${skin.id}" aria-hidden="true">${Array.from({length:36},()=>'<i></i>').join('')}</div>
    </div>
    <div class="skin-item-meta">
      <div class="skin-name">${locCosName(skin)}</div>
      ${action}
    </div>
  </div>`;
}
function skinInvItemHTML(skin) {
  const eq = equippedSkinId === skin.id;
  const rar = skin.rarity || 'common';
  const action = eq
    ? `<span class="skin-action on">Надето</span>`
    : `<button type="button" class="skin-action primary" data-equip="${skin.id}">Надеть</button>`;
  // Same animated mini-board preview as shop
  return `<div class="skin-item owned ${eq ? 'equipped' : ''}" role="listitem" data-skin="${skin.id}" data-rarity="${rar}">
    <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
    <div class="skin-item-stage" data-preview="${skin.id}">
      <div class="skin-mini-board" data-mini="${skin.id}" aria-hidden="true">${Array.from({length:36},()=>'<i></i>').join('')}</div>
    </div>
    <div class="skin-item-meta">
      <div class="skin-name">${locCosName(skin)}</div>
      ${action}
    </div>
  </div>`;
}
function skinCubeStackHTML(colors, rarity) {
  const c = (colors || []).slice(0, 6);
  const rar = rarity || 'common';
  return `<div class="skin-cubes">${c.map(col => {
    const style = rar === 'legendary'
      ? `background:linear-gradient(135deg,${col},${col});background-color:${col}`
      : `background:${col}`;
    return `<span class="skin-cube" style="${style}"></span>`;
  }).join('')}</div>`;
}
