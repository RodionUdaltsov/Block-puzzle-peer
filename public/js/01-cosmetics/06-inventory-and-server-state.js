/**
 * Block Puzzle — js/01-cosmetics/06-inventory-and-server-state.js
 * Inventory grid, shape tables, applying cosmetics state from the server.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function renderInvGrid() {
  const grid = document.getElementById('invGrid');
  if (!grid) return;
  const ownedList = sortSkinsByRarity(SKIN_CATALOG.filter(s => ownedSkins.includes(s.id)));
  const ownedBoardsList = sortBoardsByRarity(BOARD_CATALOG.filter(b => ownedBoards.includes(b.id)));
  const pill = document.getElementById('invCountPill');
  if (pill) pill.textContent = String(ownedList.length + ownedBoardsList.length);
  if (!ownedList.length && !ownedBoardsList.length) {
    grid.innerHTML = '<div class="inv-empty">Пусто · загляни в магазин</div>';
    return;
  }
  const rowN = skinPreviewRowCount();
  let openMap = {};
  try { openMap = JSON.parse(sessionStorage.getItem('bp_inv_open') || '{}') || {}; } catch (_) { openMap = {}; }

  function shelfHTML(secId, ico, title, list, itemFn) {
    if (!list.length) return '';
    const top = list.slice(0, rowN);
    const rest = list.slice(rowN);
    const isOpen = openMap[secId] === 1;
    const hasMore = rest.length > 0;
    return `<div class="skin-scroll ${isOpen && hasMore ? 'open' : ''}" data-skin-sec="${secId}">
      <button type="button" class="skin-scroll-head" data-toggle-skin="${secId}" ${hasMore ? '' : 'disabled style="opacity:0.9;cursor:default"'}>
        <span class="skin-scroll-ico">${ico}</span>
        <span class="skin-scroll-title">${title}</span>
        <span class="skin-scroll-count">${list.length}</span>
        ${hasMore ? '<span class="skin-scroll-chev">▶</span>' : ''}
      </button>
      <div class="skin-scroll-preview">
        <div class="skin-shelf" role="list">${top.map(itemFn).join('')}</div>
      </div>
      ${hasMore ? `<div class="skin-scroll-body"><div class="skin-scroll-inner">
        <div class="skin-scroll-more-label">Ещё · ниже по редкости</div>
        <div class="skin-shelf" role="list">${rest.map(itemFn).join('')}</div>
      </div></div>` : ''}
    </div>`;
  }

  grid.innerHTML = `<div class="skin-shelf-wrap">
    ${shelfHTML('inv', '🧩', 'Фигуры', ownedList, skinInvItemHTML)}
    ${shelfHTML('inv_fields', '🟦', 'Поля', ownedBoardsList, boardInvItemHTML)}
  </div>`;
  bindSkinScrollToggle(grid, 'bp_inv_open');
  grid.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      equipSkin(btn.getAttribute('data-equip'));
      try { SFX.ui(); } catch (_) {}
      renderInvGrid();
      renderShopGrid();
    });
  });
  grid.querySelectorAll('.skin-item[data-skin]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-preview]')) return;
      if (e.target && e.target.closest && e.target.closest('[data-equip]')) return;
      const id = item.getAttribute('data-skin');
      if (!id || equippedSkinId === id) return;
      equipSkin(id);
      try { SFX.ui(); } catch (_) {}
      renderInvGrid();
      renderShopGrid();
    });
  });
  grid.querySelectorAll('[data-equip-board]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      equipBoard(btn.getAttribute('data-equip-board'));
      try { SFX.ui(); } catch (_) {}
      renderInvGrid();
      renderShopGrid();
    });
  });
  grid.querySelectorAll('.skin-item[data-board]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-equip-board]')) return;
      const id = item.getAttribute('data-board');
      if (!id || equippedBoardId === id) return;
      equipBoard(id);
      try { SFX.ui(); } catch (_) {}
      renderInvGrid();
      renderShopGrid();
    });
  });
  bindSkinPreviewClicks(grid);
  startShopMiniPreviews(grid);
}

// Compact shapes — from shared/rules.js when available (same as server)
const SHAPES = _R ? _R.SHAPES : [
  [[0,0]],
  [[0,0],[0,1]], [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]],
  [[0,1],[1,0],[1,1]], [[0,0],[1,0],[1,1]],
  [[0,0],[1,0],[0,1]],
  [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[1,0],[2,0],[2,1]], [[0,1],[1,1],[2,0],[2,1]],
  [[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[1,1],[2,1]], [[0,2],[1,0],[1,1],[1,2]],
  [[0,0],[1,0],[2,0],[1,1]],
  [[0,1],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[0,2],[1,1]],
  [[1,0],[0,1],[1,1],[2,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]],
  [[0,1],[1,0],[1,1],[2,0]]
];
const SHAPE_WEIGHTS = _R ? _R.SHAPE_WEIGHTS : SHAPES.map(s => {
  const n = s.length;
  if (n === 1) return 8;
  if (n === 2) return 10;
  if (n === 3) return 9;
  return 5;
});
// 15 bots: trophies roughly map to strength
// Unique bots — custom SVG avatars, cool names, Russian voice lines
// av: [bg, skin, accent, eye] hex colors for procedural avatar


/* —— Server-authoritative cosmetics sync —— */
window._bpServerCosmetics = false;
function applyCosmeticsStateFromServer(data) {
  if (!data || typeof data !== 'object') return;
  // Explicit failure / unbound profile — do not wipe local ownership
  if (data.ok === false || data.error === 'no_profile' || data.error === 'load_failed') return;
  try {
    // Server is sole authority for diamonds / ownership / equip.
    // Never prefer stale authAccount over a fresh cosmetics_* payload
    // (that caused diamonds to jump back after purchase).
    if (typeof data.diamonds === 'number' && data.diamonds >= 0) {
      const d = Math.max(0, data.diamonds | 0);
      diamonds = d;
      try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
      try {
        if (typeof authAccount !== 'undefined' && authAccount && typeof authAccount === 'object') {
          authAccount.diamonds = d;
        }
      } catch (_) {}
    }
    if (Array.isArray(data.ownedSkins)) {
      const incoming = data.ownedSkins.map(String).filter(Boolean);
      // Ignore empty/default-only payloads that would wipe purchases
      // (race: cosmetics_get before friendCode is bound returns defaultProfile).
      const paidIncoming = incoming.filter(function (id) {
        return FREE_SKIN_IDS.indexOf(id) === -1;
      });
      const paidLocal = (ownedSkins || []).filter(function (id) {
        return FREE_SKIN_IDS.indexOf(String(id)) === -1;
      });
      if (paidIncoming.length === 0 && paidLocal.length > 0) {
        // Keep local ownership; only free/default arrived — do not overwrite
      } else {
        const set = new Set();
        // Union: never lose items we already know about from /api/me or a prior buy
        (ownedSkins || []).forEach(function (id) { if (id) set.add(String(id)); });
        incoming.forEach(function (id) { if (id) set.add(String(id)); });
        for (const free of FREE_SKIN_IDS) set.add(free);
        ownedSkins = Array.from(set);
        try { localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins)); } catch (_) {}
        try {
          if (typeof authAccount !== 'undefined' && authAccount && typeof authAccount === 'object') {
            authAccount.ownedSkins = ownedSkins.slice();
          }
        } catch (_) {}
      }
    }
    if (Array.isArray(data.ownedBoards)) {
      const incomingB = data.ownedBoards.map(String).filter(Boolean);
      const paidIncomingB = incomingB.filter(function (id) {
        return FREE_BOARD_IDS.indexOf(id) === -1;
      });
      const paidLocalB = (ownedBoards || []).filter(function (id) {
        return FREE_BOARD_IDS.indexOf(String(id)) === -1;
      });
      if (paidIncomingB.length === 0 && paidLocalB.length > 0) {
        // keep local
      } else {
        const set = new Set();
        (ownedBoards || []).forEach(function (id) { if (id) set.add(String(id)); });
        incomingB.forEach(function (id) { if (id) set.add(String(id)); });
        for (const free of FREE_BOARD_IDS) set.add(free);
        ownedBoards = Array.from(set);
        try { localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards)); } catch (_) {}
        try {
          if (typeof authAccount !== 'undefined' && authAccount && typeof authAccount === 'object') {
            authAccount.ownedBoards = ownedBoards.slice();
          }
        } catch (_) {}
      }
    }
    // Skin and board equip are independent
    if (data.equippedSkin != null && data.equippedSkin !== '') {
      const sid = String(data.equippedSkin);
      if (ownedSkins.includes(sid)) {
        equippedSkinId = sid;
        // Do not thrash body FX / close celebrate while purchase preview is open
        let celebrateOpen = false;
        try {
          const ov = document.getElementById('skinPreviewModal');
          celebrateOpen = !!(ov && ov.classList.contains('visible') && ov.classList.contains('purchase-celebrate'));
        } catch (_) {}
        if (!celebrateOpen && !window._bpSkipPreviewClose) {
          try { applyEquippedSkin(); } catch (_) {}
        }
      }
    }
    if (data.equippedBoard != null && data.equippedBoard !== '') {
      const bid = String(data.equippedBoard);
      if (ownedBoards.includes(bid)) {
        equippedBoardId = bid;
        let celebrateOpen = false;
        try {
          const ov = document.getElementById('skinPreviewModal');
          celebrateOpen = !!(ov && ov.classList.contains('visible') && ov.classList.contains('purchase-celebrate'));
        } catch (_) {}
        if (!celebrateOpen && !window._bpSkipPreviewClose) {
          try { applyEquippedBoard(); } catch (_) {}
        }
      }
    }
    try { saveSkinsState(); } catch (_) {}
    try { saveBoardsState(); } catch (_) {}
    try { updateMenuStats(); } catch (_) {}
    try {
      if (typeof renderShopGrid === 'function') renderShopGrid();
      if (typeof renderInvGrid === 'function') renderInvGrid();
      if (typeof renderShop === 'function') renderShop();
      else if (typeof renderSkinShop === 'function') renderSkinShop();
    } catch (_) {}
    window._bpServerCosmetics = true;
  } catch (_) {}
}

(function wireCosmeticsWs() {
  function onState(data) { applyCosmeticsStateFromServer(data); }
  function onBuy(data) {
    try { window._bpBuyInFlight = false; } catch (_) {}
    try { hidePurchaseLoading(); } catch (_) {}
    if (data && data.ok) {
      // Apply economy/owned WITHOUT closing the celebrate preview
      try { window._bpSkipPreviewClose = true; } catch (_) {}
      try { applyCosmeticsStateFromServer(data); } catch (_) {}
      try { window._bpSkipPreviewClose = false; } catch (_) {}
      try {
        if (typeof renderShopGrid === 'function') renderShopGrid();
        if (typeof renderInvGrid === 'function') renderInvGrid();
      } catch (_) {}
      // Wait for load overlay fade (~180ms) then pop celebrate with entrance anim
      setTimeout(function () {
        try {
          if (data.id) {
            if (data.kind === 'board' && typeof openBoardPreview === 'function') {
              openBoardPreview(data.id, { celebrate: true });
            } else if (typeof openSkinPreview === 'function') {
              openSkinPreview(data.id, { celebrate: true });
            } else {
              playPurchaseFx(data.kind === 'board' ? 'board' : 'skin', data.id);
            }
          }
        } catch (_) {}
      }, 200);
      try {
        if (data.kind === 'board') {
          bumpAchStat('boardsBought', 1);
          const board = getBoardById(data.id);
          if (board && board.rarity === 'legendary') setAchStat('boardsLegendary', Math.max(1, getAchStat('boardsLegendary')));
          checkNewAchievements();
        } else {
          setAchStat('skinsOwned', ownedSkins.length);
          bumpAchStat('skinsBought', 1);
        }
      } catch (_) {}
    } else if (data) {
      // Revert optimistic UI using server state
      applyCosmeticsStateFromServer(data);
      try {
        if (typeof renderShopGrid === 'function') renderShopGrid();
        if (typeof renderInvGrid === 'function') renderInvGrid();
      } catch (_) {}
      try {
        if (data.error === 'funds' && typeof showInfoToast === 'function') {
          showInfoToast('Магазин', 'Недостаточно алмазов', 'bad');
        } else if (data.error === 'owned' && typeof showInfoToast === 'function') {
          showInfoToast('Магазин', 'Уже куплено', 'ok');
        }
      } catch (_) {}
    }
  }
  function onEquip(data) {
    if (data) applyCosmeticsStateFromServer(data);
  }
  function requestCosmeticsFromServer() {
    try {
      // Prefer known friendCode — without it server returns defaultProfile and
      // would wipe ownership if applied naively.
      let fc = '';
      try {
        if (typeof myFriendCode !== 'undefined' && myFriendCode) fc = String(myFriendCode);
        else if (MatchClient && MatchClient._lastPresence && MatchClient._lastPresence.friendCode) {
          fc = String(MatchClient._lastPresence.friendCode);
        }
      } catch (_) {}
      if (!fc) return;
      if (typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1) {
        if (typeof MatchClient.cosmeticsGet === 'function') MatchClient.cosmeticsGet();
        else if (typeof MatchClient.send === 'function') {
          MatchClient.send({ type: 'cosmetics_get', friendCode: fc });
        }
      }
    } catch (_) {}
  }
  function tryWire() {
    if (typeof MatchClient === 'undefined' || typeof MatchClient.on !== 'function') {
      setTimeout(tryWire, 400);
      return;
    }
    try { MatchClient.on('cosmetics_state', onState); } catch (_) {}
    try { MatchClient.on('cosmetics_buy_result', onBuy); } catch (_) {}
    try { MatchClient.on('cosmetics_equip_result', onEquip); } catch (_) {}
    // After presence/login, pull authoritative inventory (survives reload)
    try { MatchClient.on('presence_ok', function () { requestCosmeticsFromServer(); }); } catch (_) {}
    // Delay hello/open pulls so presence_register has time to bind friendCode
    try { MatchClient.on('hello', function () { setTimeout(requestCosmeticsFromServer, 600); }); } catch (_) {}
    try { MatchClient.on('open', function () { setTimeout(requestCosmeticsFromServer, 900); }); } catch (_) {}
    setTimeout(requestCosmeticsFromServer, 1200);
  }
  tryWire();
})();
