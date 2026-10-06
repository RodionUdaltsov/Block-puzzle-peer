/**
 * Block Puzzle — js/01-cosmetics/05-preview-modals.js
 * Skin / board preview modals.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
let skinPrevTimer = null;

const PREVIEW_FX_CLASSES = ['skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare'];

/** Apply skin material FX only on the preview modal (independent of equipped skin / body). */
function setPreviewModalSkinFx(skinOrRarity) {
  const ov = document.getElementById('skinPreviewModal');
  if (!ov) return '';
  let rar = 'common';
  try {
    if (skinOrRarity && typeof skinOrRarity === 'object') rar = skinOrRarity.rarity || 'common';
    else if (typeof skinOrRarity === 'string') rar = skinOrRarity;
  } catch (_) {}
  const fx = skinFxClass(rar);
  PREVIEW_FX_CLASSES.forEach(function (c) { ov.classList.remove(c); });
  ov.classList.add(fx);
  if (rar === 'rare') ov.classList.add('skin-fx-rare');
  // Also stamp on wrap for any wrap-scoped CSS
  try {
    const wrap = document.getElementById('skinPrevWrap');
    if (wrap) {
      PREVIEW_FX_CLASSES.forEach(function (c) { wrap.classList.remove(c); });
      wrap.classList.add(fx);
      if (rar === 'rare') wrap.classList.add('skin-fx-rare');
    }
  } catch (_) {}
  return fx;
}

function clearPreviewModalSkinFx() {
  const ov = document.getElementById('skinPreviewModal');
  if (ov) PREVIEW_FX_CLASSES.forEach(function (c) { ov.classList.remove(c); });
  try {
    const wrap = document.getElementById('skinPrevWrap');
    if (wrap) PREVIEW_FX_CLASSES.forEach(function (c) { wrap.classList.remove(c); });
  } catch (_) {}
}

function closeSkinPreview() {
  if (skinPrevTimer) { clearTimeout(skinPrevTimer); skinPrevTimer = null; }
  const ov = document.getElementById('skinPreviewModal');
  if (ov) {
    ov.classList.remove('visible', 'purchase-celebrate', 'bp-prev-enter');
    ov.setAttribute('aria-hidden', 'true');
    if (ov._restoreFx) { try { ov._restoreFx(); } catch (_) {} }
  }
  try {
    const combo = document.getElementById('skinPrevCombo');
    setSkinPrevBoughtBadge(combo, false);
  } catch (_) {}
  try { clearPreviewModalSkinFx(); } catch (_) {}
  document.body.classList.remove('skin-previewing');
  // Restore GAME body FX only after modal is closed — never while preview is open
  try { applyEquippedSkin(); } catch (_) {
    document.body.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
    try {
      const eqSkin = getSkinById(equippedSkinId);
      document.body.classList.add(skinFxClass(eqSkin.rarity || 'common'));
      if ((eqSkin.rarity || 'common') === 'rare') document.body.classList.add('skin-fx-rare');
    } catch (__) {}
  }
}



/** Sample tetromino-like shapes for skin preview (matches in-game cell look). */
function _previewSampleShapes() {
  try {
    if (typeof SHAPES !== 'undefined' && Array.isArray(SHAPES) && SHAPES.length) {
      // Pick a few distinct shapes (prefer multi-cell)
      const picks = [];
      for (let i = 0; i < SHAPES.length && picks.length < 5; i++) {
        const s = SHAPES[i];
        if (Array.isArray(s) && s.length >= 3) picks.push(s);
      }
      if (picks.length) return picks;
    }
  } catch (_) {}
  return [
    [[0,0],[0,1],[0,2],[1,0]],           // Г
    [[0,0],[0,1],[0,2],[1,1]],           // Т
    [[0,0],[0,1],[1,0],[1,1]],           // O
    [[0,0],[1,0],[2,0],[2,1]],           // L
    [[0,1],[1,0],[1,1],[1,2]]            // T up
  ];
}

function _buildPreviewBoardEl(boardEl, size) {
  size = size || 8;
  boardEl.innerHTML = '';
  boardEl.className = 'board skin-prev-board';
  boardEl.style.display = 'grid';
  boardEl.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
  boardEl.style.gridTemplateRows = 'repeat(' + size + ', 1fr)';
  boardEl.style.gap = '2px';
  boardEl.style.width = 'min(72vw, 280px)';
  boardEl.style.aspectRatio = '1';
  for (let i = 0; i < size * size; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    boardEl.appendChild(d);
  }
  return size;
}


/** Build a real in-game board grid inside the preview modal (SIZE×SIZE .cell). */
function buildPreviewBoardGrid(boardEl) {
  if (!boardEl) return;
  boardEl.innerHTML = '';
  boardEl.className = 'board skin-prev-board';
  const n = (typeof SIZE === 'number' && SIZE > 0) ? SIZE : 8;
  for (let i = 0; i < n * n; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    boardEl.appendChild(d);
  }
  return n;
}

/** Centered animated «Куплено» badge on the skin/board preview. */
function setSkinPrevBoughtBadge(combo, celebrate) {
  if (!combo) return;
  try {
    combo.classList.remove('show');
    if (!celebrate) {
      combo.innerHTML = '';
      combo.setAttribute('aria-hidden', 'true');
      return;
    }
    combo.innerHTML =
      '<span class="bp-bought-check" aria-hidden="true">✓</span>' +
      '<span class="bp-bought-text">Куплено</span>';
    combo.setAttribute('aria-hidden', 'false');
    // Retrigger CSS animation
    try { void combo.offsetWidth; } catch (_) {}
    combo.classList.add('show');
  } catch (_) {
    try { combo.textContent = celebrate ? '✓ Куплено' : ''; } catch (_2) {}
  }
}

function openBoardPreview(boardId, opts) {
  opts = opts || {};
  const board = getBoardById(boardId);
  if (!board) return;
  const ov = document.getElementById('skinPreviewModal');
  if (!ov) return;
  const title = document.getElementById('skinPrevTitle');
  const meta = document.getElementById('skinPrevMeta');
  const boardEl = document.getElementById('skinPrevBoard');
  const combo = document.getElementById('skinPrevCombo');
  const btn = document.getElementById('skinPrevAction');
  const wrap = document.getElementById('skinPrevWrap');
  if (skinPrevTimer) { clearTimeout(skinPrevTimer); skinPrevTimer = null; }

  if (title) title.textContent = (typeof locCosName === 'function' ? locCosName(board) : null) || board.name || board.id;
  if (meta) {
    meta.textContent = skinRarityLabel(board.rarity || 'common')
      + (board.price > 0 ? ' · 💎 ' + board.price : '');
  }
  setSkinPrevBoughtBadge(combo, !!opts.celebrate);

  // Always the requested board — same before and after purchase
  if (wrap) {
    wrap.classList.add('board-wrap', 'skin-prev-board-wrap');
    wrap.style.overflow = 'hidden';
    wrap.style.position = 'relative';
    wrap.style.isolation = 'isolate';
    wrap.style.width = 'min(72vw, 280px)';
    wrap.style.margin = '10px auto';
  }
  const n = buildPreviewBoardGrid(boardEl) || 8;
  if (boardEl) {
    boardEl.style.width = '100%';
    boardEl.style.aspectRatio = '1';
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
    boardEl.style.gridTemplateRows = 'repeat(' + n + ', 1fr)';
  }
  try {
    if (wrap) applyBoardToWrap(wrap, board);
  } catch (e) {
    try { console.warn('[preview] applyBoard', e); } catch (_) {}
  }

  // Sample pieces so empty + filled look match a real match
  if (boardEl) {
    const sample = [
      [1, 1], [1, 2], [1, 3], [2, 3],
      [3, 5], [4, 5], [5, 5], [5, 4],
      [6, 1], [6, 2], [7, 2]
    ];
    const sampleCols = ['#00d4aa', '#7c5cff', '#ff5c7a', '#ffb347', '#4fc3f7'];
    sample.forEach(function (rc, i) {
      const r = rc[0], c = rc[1];
      if (r >= n || c >= n) return;
      const cell = boardEl.children[r * n + c];
      if (!cell) return;
      const col = sampleCols[i % sampleCols.length];
      try { paintCellColor(cell, col); } catch (_) { cell.style.background = col; }
      cell.classList.add('filled');
    });
  }

  const owned = ownedBoards.includes(board.id);
  const eq = equippedBoardId === board.id;
  if (btn) {
    btn.hidden = false;
    if (opts.celebrate) {
      btn.textContent = 'Отлично!';
      btn.disabled = false;
      btn.className = 'primary';
      btn.onclick = function () { closeSkinPreview(); };
    } else if (eq) {
      btn.textContent = 'Надето';
      btn.disabled = true;
      btn.className = 'primary';
      btn.onclick = null;
    } else if (owned) {
      btn.textContent = 'Надеть';
      btn.disabled = false;
      btn.className = 'primary';
      btn.onclick = function () {
        equipBoard(board.id);
        try { renderShopGrid(); } catch (_) {}
        try { renderInvGrid(); } catch (_) {}
        closeSkinPreview();
      };
    } else {
      const can = diamonds >= board.price;
      btn.textContent = can ? ('Купить · 💎 ' + board.price) : ('💎 ' + board.price);
      btn.disabled = !can;
      btn.className = can ? 'primary' : 'ghost';
      btn.onclick = function () {
        confirmGuestShopPurchase().then(function (ok) {
          if (!ok) return;
          const res = buyBoard(board.id);
          if (res === 'ok') {
            // Server cosmetics_buy_result opens celebrate; just refresh lists
            try { renderShopGrid(); } catch (_) {}
            try { renderInvGrid(); } catch (_) {}
          } else if (res === 'funds' && typeof showInfoToast === 'function') {
            showInfoToast('Магазин', 'Не хватает алмазов', 'bad');
          }
        });
      };
    }
  }

  ov.classList.add('visible');
  ov.setAttribute('aria-hidden', 'false');
  if (opts.celebrate) ov.classList.add('purchase-celebrate');
  // Pin field again after equip/layout so celebrate cannot show default
  try {
    if (wrap) applyBoardToWrap(wrap, board);
  } catch (_) {}
}

function openSkinPreview(skinId, opts) {
  opts = opts || {};
  const skin = getSkinById(skinId);
  if (!skin) return;
  const ov = document.getElementById('skinPreviewModal');
  if (!ov) return;
  const title = document.getElementById('skinPrevTitle');
  const meta = document.getElementById('skinPrevMeta');
  const boardEl = document.getElementById('skinPrevBoard');
  const combo = document.getElementById('skinPrevCombo');
  const btn = document.getElementById('skinPrevAction');
  const wrap = document.getElementById('skinPrevWrap');
  if (skinPrevTimer) { clearTimeout(skinPrevTimer); skinPrevTimer = null; }

  if (title) title.textContent = (typeof locCosName === 'function' ? locCosName(skin) : null) || skin.name || skin.id;
  if (meta) {
    meta.textContent = skinRarityLabel(skin.rarity || 'common')
      + (skin.price > 0 ? ' · 💎 ' + skin.price : '');
  }
  setSkinPrevBoughtBadge(combo, !!opts.celebrate);

  // Preview FX are isolated on the modal — do NOT change body (keeps game + other previews independent)
  const rar = skin.rarity || 'common';
  document.body.classList.add('skin-previewing');
  try { setPreviewModalSkinFx(skin); } catch (_) {}

  // Neutral default field under pieces
  if (wrap) {
    wrap.classList.add('board-wrap', 'skin-prev-board-wrap');
    wrap.style.overflow = 'hidden';
    wrap.style.position = 'relative';
    wrap.style.isolation = 'isolate';
    wrap.style.width = 'min(72vw, 280px)';
    wrap.style.margin = '10px auto';
    try { applyBoardToWrap(wrap, getBoardById('field_default')); } catch (_) {}
  }
  const n = buildPreviewBoardGrid(boardEl) || 8;
  if (boardEl) {
    boardEl.style.width = '100%';
    boardEl.style.aspectRatio = '1';
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
    boardEl.style.gridTemplateRows = 'repeat(' + n + ', 1fr)';
    boardEl.style.minHeight = '160px';
  }

  const colors = (skin.colors && skin.colors.length) ? skin.colors.slice() : ['#00d4aa'];
  const shapes = [
    { cells: [[0,0],[0,1],[0,2],[1,1]], origin: [1, 2] },
    { cells: [[0,0],[1,0],[2,0],[2,1]], origin: [2, 0] },
    { cells: [[0,0],[0,1],[0,2],[0,3]], origin: [4, 1] },
    { cells: [[0,0],[0,1],[1,0],[1,1]], origin: [5, 5] },
    { cells: [[0,1],[1,0],[1,1],[1,2]], origin: [2, 4] }
  ];

  function clearBoard() {
    if (!boardEl) return;
    for (let i = 0; i < boardEl.children.length; i++) {
      const cell = boardEl.children[i];
      cell.classList.remove('filled', 'placing', 'clearing');
      cell.style.background = '';
      cell.style.backgroundColor = '';
      cell.style.backgroundImage = '';
      cell.style.removeProperty('--cell-base');
      cell.style.removeProperty('--cell-glow');
    }
  }

  function placeShape(sh, col, animate) {
    if (!boardEl || !sh) return;
    sh.cells.forEach(function (rc) {
      const r = sh.origin[0] + rc[0];
      const c = sh.origin[1] + rc[1];
      if (r < 0 || c < 0 || r >= n || c >= n) return;
      const cell = boardEl.children[r * n + c];
      if (!cell) return;
      try { paintCellColor(cell, col); } catch (_) {
        cell.style.background = col;
        cell.style.setProperty('--cell-base', col);
      }
      cell.classList.add('filled');
      if (animate) {
        cell.classList.add('placing');
        setTimeout(function () { try { cell.classList.remove('placing'); } catch (_) {} }, 450);
      }
    });
  }

  // Immediate paint so the preview is never blank
  clearBoard();
  shapes.forEach(function (sh, i) {
    placeShape(sh, colors[i % colors.length], !!opts.celebrate);
  });

  // Soft loop only when browsing (not after purchase)
  if (!opts.celebrate) {
    let step = 0;
    const tick = function () {
      if (!ov.classList.contains('visible')) {
        return;
      }
      // Keep modal FX pinned every frame so equip/purchase cannot strip holo
      try { setPreviewModalSkinFx(skin); } catch (_) {}
      clearBoard();
      const sh = shapes[step % shapes.length];
      placeShape(sh, colors[step % colors.length], true);
      // also show previous shapes static for denser look
      for (let j = 0; j < shapes.length; j++) {
        if (j === (step % shapes.length)) continue;
        placeShape(shapes[j], colors[j % colors.length], false);
      }
      step++;
      skinPrevTimer = setTimeout(tick, 1400);
    };
    skinPrevTimer = setTimeout(tick, 1600);
  }

  const owned = ownedSkins.includes(skin.id);
  const eq = equippedSkinId === skin.id;
  if (btn) {
    btn.hidden = false;
    if (opts.celebrate) {
      btn.textContent = 'Отлично!';
      btn.disabled = false;
      btn.className = 'primary';
      btn.onclick = function () { closeSkinPreview(); };
    } else if (eq) {
      btn.textContent = 'Надето';
      btn.disabled = true;
      btn.className = 'primary';
      btn.onclick = null;
    } else if (owned) {
      btn.textContent = 'Надеть';
      btn.disabled = false;
      btn.className = 'primary';
      btn.onclick = function () {
        equipSkin(skin.id);
        closeSkinPreview();
        try { renderShopGrid(); } catch (_) {}
        try { renderInvGrid(); } catch (_) {}
      };
    } else {
      const can = diamonds >= skin.price;
      btn.textContent = can ? ('Купить · 💎 ' + skin.price) : ('💎 ' + skin.price);
      btn.disabled = !can;
      btn.className = can ? 'primary' : 'ghost';
      btn.onclick = function () {
        confirmGuestShopPurchase().then(function (ok) {
          if (!ok) return;
          const res = buySkin(skin.id);
          if (res === 'ok') {
            try { renderShopGrid(); } catch (_) {}
            try { renderInvGrid(); } catch (_) {}
          } else if (res === 'funds' && typeof showInfoToast === 'function') {
            showInfoToast('Магазин', 'Не хватает алмазов', 'bad');
          }
        });
      };
    }
  }

  try { setPreviewModalSkinFx(skin); } catch (_) {}
  // Entrance animation (especially after purchase)
  try {
    ov.classList.remove('bp-prev-enter');
    if (opts.celebrate) {
      if (!document.getElementById('bpPreviewEnterStyle')) {
        const st = document.createElement('style');
        st.id = 'bpPreviewEnterStyle';
        st.textContent =
          '#skinPreviewModal.bp-prev-enter #skinPrevModalInner{' +
          'animation:bpPrevPop .42s cubic-bezier(.22,1.2,.36,1) both}' +
          '@keyframes bpPrevPop{0%{opacity:0;transform:scale(.86) translateY(18px)}' +
          '70%{opacity:1;transform:scale(1.04) translateY(-2px)}' +
          '100%{opacity:1;transform:scale(1) translateY(0)}}';
        document.head.appendChild(st);
      }
      void ov.offsetWidth;
      ov.classList.add('bp-prev-enter');
    }
  } catch (_) {}
  ov.classList.add('visible');
  ov.setAttribute('aria-hidden', 'false');
  if (opts.celebrate) ov.classList.add('purchase-celebrate');
  setTimeout(function () { try { setPreviewModalSkinFx(skin); } catch (_) {} }, 50);
  setTimeout(function () { try { setPreviewModalSkinFx(skin); } catch (_) {} }, 250);
}

function bindSkinPreviewClicks(root) {
  if (!root) return;
  root.querySelectorAll('[data-preview]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openSkinPreview(el.getAttribute('data-preview'));
    });
  });
  root.querySelectorAll('[data-preview-board]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openBoardPreview === 'function') openBoardPreview(el.getAttribute('data-preview-board'));
    });
  });
}
