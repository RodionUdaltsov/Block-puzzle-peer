/**
 * Block Puzzle — js/01-cosmetics/04-shop-grid.js
 * Shop grid rendering and animated mini previews.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function renderShopGrid() {
  const grid = document.getElementById('shopGrid');
  const bal = document.getElementById('shopDiamonds');
  if (bal) bal.textContent = diamonds;
  if (!grid) return;
  const forSale = sortSkinsByRarity(SKIN_CATALOG.filter(s => s.price > 0));
  const boardsSale = sortBoardsByRarity(BOARD_CATALOG.filter(b => b.price > 0));
  if (!forSale.length && !boardsSale.length) {
    grid.innerHTML = '<div class="inv-empty">Пока нет товаров</div>';
    return;
  }
  const rowN = skinPreviewRowCount();
  let openMap = {};
  try { openMap = JSON.parse(sessionStorage.getItem('bp_shop_open') || '{}') || {}; } catch (_) { openMap = {}; }

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
    ${shelfHTML('shop', '🛍️', 'Фигуры', forSale, skinShopItemHTML)}
    ${shelfHTML('shop_fields', '🟦', 'Поля', boardsSale, boardShopItemHTML)}
  </div>`;
  bindSkinScrollToggle(grid, 'bp_shop_open');
  grid.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-buy');
      confirmGuestShopPurchase().then(function (ok) {
        if (!ok) return;
        const res = buySkin(id);
        if (res === 'ok') {
          try { SFX.ui(); } catch (_) {}
          try { renderShopGrid(); } catch (_) {}
          try { renderInvGrid(); } catch (_) {}
        } else if (res === 'funds') {
          try {
            if (typeof showInfoToast === 'function') showInfoToast('Магазин', 'Не хватает алмазов', 'bad');
          } catch (_) {}
        } else if (res === 'owned') {
          try {
            if (typeof showInfoToast === 'function') showInfoToast('Магазин', 'Уже куплено', 'ok');
          } catch (_) {}
        } else if (res === 'busy') {
          /* purchase in flight — ignore */
        }
      });
    });
  });
  grid.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      equipSkin(btn.getAttribute('data-equip'));
      try { SFX.ui(); } catch (_) {}
      renderShopGrid();
      renderInvGrid();
    });
  });
  grid.querySelectorAll('[data-buy-board]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-buy-board');
      confirmGuestShopPurchase().then(function (ok) {
        if (!ok) return;
        const res = buyBoard(id);
        if (res === 'ok') {
          try { SFX.ui(); } catch (_) {}
          try { renderShopGrid(); } catch (_) {}
          try { renderInvGrid(); } catch (_) {}
        } else if (res === 'funds') {
          try {
            if (typeof showInfoToast === 'function') showInfoToast('Магазин', 'Не хватает алмазов', 'bad');
          } catch (_) {}
        } else if (res === 'owned') {
          try {
            if (typeof showInfoToast === 'function') showInfoToast('Магазин', 'Уже куплено', 'ok');
          } catch (_) {}
        }
      });
    });
  });
  grid.querySelectorAll('[data-equip-board]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      equipBoard(btn.getAttribute('data-equip-board'));
      try { SFX.ui(); } catch (_) {}
      renderShopGrid();
      renderInvGrid();
    });
  });
  grid.querySelectorAll('.skin-item[data-board]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target && e.target.closest && (e.target.closest('[data-buy-board]') || e.target.closest('[data-equip-board]'))) return;
      const id = item.getAttribute('data-board');
      if (!id || !ownedBoards.includes(id) || equippedBoardId === id) return;
      equipBoard(id);
      try { SFX.ui(); } catch (_) {}
      renderShopGrid();
      renderInvGrid();
    });
  });
  bindSkinPreviewClicks(grid);
  startShopMiniPreviews(grid);
}

let shopMiniTimer = null;
function startShopMiniPreviews(root) {
  if (shopMiniTimer) { clearInterval(shopMiniTimer); shopMiniTimer = null; }
  if (!root) return;
  const boards = [...root.querySelectorAll('.skin-mini-board[data-mini]')];
  if (!boards.length) return;
  // Pattern frames: place shapes using skin colors
  const frames = [
    [0,1,6,7,12,13],
    [2,3,8,9,14,15,20],
    [4,5,10,11,16,17,22,23],
    [18,19,24,25,30,31],
    [21,26,27,32,33,34],
    [7,8,13,14,19,20,25],
    [1,2,7,12,13,18,24],
    [9,10,15,16,21,22,27,28]
  ];
  let fi = 0;
  const paint = () => {
    // Skip work when tab hidden OR when the shop/inventory isn't on screen
    // (the timer used to keep restyling every preview board in the background).
    try { if (document.hidden) { fi++; return; } } catch (_) {}
    try {
      if (!root.isConnected || root.offsetParent === null) return;
      const gfx = window.BPGfx && BPGfx.state;
      if (gfx && gfx.skin === 'off') return; // static previews in battery mode
    } catch (_) {}
    const frame = frames[fi % frames.length];
    const on = new Set(frame);
    boards.forEach(board => {
      const id = board.getAttribute('data-mini');
      const skin = getSkinById(id);
      const cols = (skin && skin.colors) || ['#888'];
      const cells = board.children;
      const n = cells.length;
      for (let i = 0; i < n; i++) {
        const cell = cells[i];
        const shouldOn = on.has(i);
        const isOn = cell.classList.contains('on');
        if (shouldOn) {
          const col = cols[i % cols.length];
          if (!isOn || cell.style.getPropertyValue('--cell-base') !== col) {
            try { paintCellColor(cell, col); } catch (_) {
              cell.style.background = col;
              cell.style.setProperty('--cell-base', col);
              cell.style.setProperty('--cell-glow', col);
            }
            if (!isOn) cell.classList.add('on');
          }
        } else if (isOn) {
          cell.style.background = '';
          cell.style.removeProperty('--cell-base');
          cell.style.removeProperty('--cell-glow');
          cell.classList.remove('on');
        }
      }
    });
    fi++;
  };
  paint();
  shopMiniTimer = setInterval(paint, (window.BPGfx && BPGfx.state.tier === 'high') ? 900 : 1500);
}
