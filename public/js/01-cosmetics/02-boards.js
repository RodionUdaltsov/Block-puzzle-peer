/**
 * Block Puzzle — js/01-cosmetics/02-boards.js
 * Board fields: catalog, apply/equip, guest purchase guard, buy/equip board, board shop items.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
// —— Board fields (поля) ——
const FREE_BOARD_IDS = ['field_default'];
const BOARD_CATALOG = [
  {
    id: 'field_default', name: 'Стандарт', desc: 'Классическое поле без эффектов',
    price: 0, rarity: 'common', fx: 'none',
    empty: '#16191f', surface: '#1a1d24', surface2: '#242830', border: '#2e333d', accent: '#00d4aa'
  },
  {
    id: 'field_slate', name: 'Сланец', desc: 'Холодный серый камень',
    price: 25, rarity: 'common', fx: 'none',
    empty: '#1a1e24', surface: '#1c2128', surface2: '#262c34', border: '#343b46', accent: '#8b9bb0'
  },
  {
    id: 'field_charcoal', name: 'Уголь', desc: 'Тёплый угольный фон',
    price: 25, rarity: 'common', fx: 'none',
    empty: '#1c1816', surface: '#221c1a', surface2: '#2c2420', border: '#3a322c', accent: '#a8988c'
  },
  {
    id: 'field_graphite', name: 'Графит', desc: 'Строгий металлический тон',
    price: 40, rarity: 'common', fx: 'none',
    empty: '#181b20', surface: '#1e2228', surface2: '#282e36', border: '#3a4250', accent: '#cfd8e3'
  },
  {
    id: 'field_sand', name: 'Песок', desc: 'Сухая пустынная сетка',
    price: 50, rarity: 'common', fx: 'none',
    empty: '#1e1a14', surface: '#241e16', surface2: '#2e261c', border: '#3d3428', accent: '#d4a574'
  },
  {
    id: 'field_azure', name: 'Лазурь', desc: 'Мягкое голубое свечение',
    price: 130, rarity: 'rare', fx: 'soft',
    empty: '#101820', surface: '#142028', surface2: '#1a2a36', border: '#2a4a5a', accent: '#3dd6f5'
  },
  {
    id: 'field_violet', name: 'Фиолет', desc: 'Сумеречная аура',
    price: 150, rarity: 'rare', fx: 'soft',
    empty: '#16141f', surface: '#1c1830', surface2: '#261e40', border: '#3a2e5a', accent: '#9b7cff'
  },
  {
    id: 'field_jade', name: 'Нефрит', desc: 'Изумрудный контур',
    price: 160, rarity: 'rare', fx: 'soft',
    empty: '#0e1a16', surface: '#12221c', surface2: '#1a2e26', border: '#2a4a3c', accent: '#3dd9a0'
  },
  {
    id: 'field_crystal', name: 'Кристалл', desc: 'Пульсирующая грань',
    price: 290, rarity: 'epic', fx: 'pulse',
    empty: '#12101c', surface: '#1a1628', surface2: '#241e38', border: '#4a3a6a', accent: '#c77dff'
  },
  {
    id: 'field_magma', name: 'Магма', desc: 'Жар из глубины',
    price: 320, rarity: 'epic', fx: 'magma',
    empty: '#1c0e0a', surface: '#22100c', surface2: '#2e1610', border: '#5a3020', accent: '#ff6a30'
  },
  {
    id: 'field_neon_grid', name: 'Неон-сетка', desc: 'Световой импульс',
    price: 340, rarity: 'epic', fx: 'pulse',
    empty: '#0c1418', surface: '#101c22', surface2: '#182830', border: '#2a5a5a', accent: '#00f5d4'
  },
  {
    id: 'field_nebula', name: 'Туманность', desc: 'Звёзды и космическая дымка',
    price: 650, rarity: 'legendary', fx: 'nebula',
    empty: '#121428', surface: '#0c0e18', surface2: '#16122a', border: '#6a50c0', accent: '#a78bff'
  },
  {
    id: 'field_solar', name: 'Солнечный', desc: 'Лучи и раскалённое ядро',
    price: 700, rarity: 'legendary', fx: 'solar',
    empty: '#1c1408', surface: '#1a1208', surface2: '#2a1c0c', border: '#c09030', accent: '#ffc040'
  },
  {
    id: 'field_quantum', name: 'Квант', desc: 'Сканирующая матрица',
    price: 720, rarity: 'legendary', fx: 'quantum',
    empty: '#061814', surface: '#061412', surface2: '#0a2420', border: '#20a080', accent: '#00ffc8'
  },
  {
    id: 'field_abyss', name: 'Бездна', desc: 'Глубина и пузырьки света',
    price: 680, rarity: 'legendary', fx: 'abyss',
    empty: '#081420', surface: '#060e18', surface2: '#0a1c30', border: '#3080b0', accent: '#4fc3f7'
  },
  {
    id: 'field_prism', name: 'Призма', desc: 'Радужная решётка',
    price: 780, rarity: 'legendary', fx: 'prismfield',
    empty: '#14101c', surface: '#100e18', surface2: '#1c1428', border: '#a070d0', accent: '#ff9de2'
  }
];
// fix typo solar accent if any


function loadOwnedBoards() {
  try {
    const raw = localStorage.getItem('bp_boards_owned');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        const ids = parsed.map((id) => String(id)).filter((id) => BOARD_CATALOG.some((b) => b.id === id));
        for (const free of FREE_BOARD_IDS) {
          if (!ids.includes(free)) ids.push(free);
        }
        return ids;
      }
    }
  } catch (_) {}
  return FREE_BOARD_IDS.slice();
}
let ownedBoards = loadOwnedBoards();
let equippedBoardId = localStorage.getItem('bp_board_equipped') || 'field_default';
if (!ownedBoards.includes(equippedBoardId)) equippedBoardId = 'field_default';
if (!BOARD_CATALOG.some(b => b.id === equippedBoardId)) equippedBoardId = 'field_default';

function getBoardById(id) {
  return BOARD_CATALOG.find(b => b.id === id) || BOARD_CATALOG[0];
}
function saveBoardsState() {
  try {
    localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards));
    localStorage.setItem('bp_board_equipped', equippedBoardId);
  } catch (_) {}
}
const BOARD_FX_CLASSES = ['board-fx-none','board-fx-soft','board-fx-pulse','board-fx-nebula','board-fx-solar','board-fx-quantum','board-fx-abyss','board-fx-prismfield','board-fx-magma'];
function applyBoardToWrap(wrap, board) {
  if (!wrap || !board) return;
  BOARD_FX_CLASSES.forEach(c => wrap.classList.remove(c));
  wrap.classList.add('board-fx-' + (board.fx || 'none'));
  // Drop leftover compositor state after heavy fields (Solar rays etc.)
  // Critical on mobile: Solar filter/will-change layers used to stick after unequip
  try {
    wrap.style.removeProperty('filter');
    wrap.style.removeProperty('transform');
    wrap.style.removeProperty('will-change');
    wrap.style.removeProperty('animation');
    const boardEl = wrap.querySelector('.board');
    if (boardEl) {
      boardEl.style.removeProperty('filter');
      boardEl.style.removeProperty('animation');
      boardEl.style.removeProperty('will-change');
      boardEl.style.removeProperty('transform');
    }
    // Force style recalc so WebKit drops promoted layers from previous FX
    try { void wrap.offsetWidth; } catch (_) {}
    if (typeof scrubTransientFx === 'function') scrubTransientFx();
  } catch (_) {}
  wrap.dataset.board = board.id;
  wrap.dataset.boardRarity = board.rarity || 'common';
  const empty = board.empty || '#16191f';
  const accent = board.accent || '#00d4aa';
  wrap.style.setProperty('--field-empty', empty);
  wrap.style.setProperty('--cell-empty', empty);
  wrap.style.setProperty('--field-surface', board.surface || '#1a1d24');
  wrap.style.setProperty('--field-surface2', board.surface2 || '#242830');
  wrap.style.setProperty('--field-border', board.border || '#2e333d');
  wrap.style.setProperty('--field-accent', accent);
  // Paint empty cells immediately so change is visible without waiting for re-render
  try {
    const boardEl = wrap.querySelector('.board');
    if (boardEl) {
      BOARD_FX_CLASSES.forEach(c => boardEl.classList.remove(c));
      boardEl.classList.add('board-fx-' + (board.fx || 'none'));
      boardEl.style.setProperty('--field-empty', empty);
      boardEl.style.setProperty('--cell-empty', empty);
      boardEl.style.setProperty('--field-accent', accent);
      boardEl.querySelectorAll('.cell:not(.filled)').forEach(cell => {
        cell.style.background = '';
        cell.style.backgroundColor = '';
      });
    }
  } catch (_) {}
}
/** Only local player's board shows equipped field theme (same idea as piece skins). */
function isLocalBoardWrap(wrap) {
  if (!wrap) return false;
  try {
    if (wrap.closest && wrap.closest('.player-panel.opp')) return false;
    // Opp board element itself
    if (wrap.id === 'boardOpp' || (wrap.querySelector && wrap.querySelector('#boardOpp'))) return false;
  } catch (_) {}
  return true;
}
function applyEquippedBoard() {
  const board = getBoardById(equippedBoardId);
  try {
    document.body.dataset.boardId = board.id;
    document.body.dataset.boardRarity = board.rarity || 'common';
  } catch (_) {}
  // Only local boards — opponent field is applied separately via applyOppBoard
  document.querySelectorAll('.board-wrap').forEach(w => {
    // Never overwrite the shop/inventory preview modal field
    try {
      if (w.id === 'skinPrevWrap' || (w.closest && w.closest('#skinPreviewModal'))) return;
    } catch (_) {}
    if (isLocalBoardWrap(w)) applyBoardToWrap(w, board);
  });
  const classicBoard = document.getElementById('board');
  if (classicBoard && !classicBoard.closest('.board-wrap')) {
    // no-op; usually inside wrap
  }
}
/** Guest shop warning: purchases only persist on this device until registration. */
function isGuestShopper() {
  try {
    return !(typeof authToken !== 'undefined' && authToken && typeof authAccount !== 'undefined' && authAccount);
  } catch (_) {
    return true;
  }
}
/**
 * If guest — show one-shot (per session) warning before paid purchase.
 * Returns Promise<boolean> — true if user may proceed.
 */
function confirmGuestShopPurchase() {
  if (!isGuestShopper()) return Promise.resolve(true);
  let already = false;
  try { already = sessionStorage.getItem('bp_guest_shop_warned') === '1'; } catch (_) {}
  if (already) return Promise.resolve(true);
  const text =
    'Вы играете как гость.\n\n' +
    '• Если у вас уже есть аккаунт — сначала войдите: иначе покупки не попадут в аккаунт и пропадут при входе.\n' +
    '• Если аккаунта нет — покупки и прогресс сохранятся при регистрации на этом устройстве.\n\n' +
    'Гостевые данные на сервере живут около 48 часов.';
  const run = function () {
    if (typeof bpConfirm === 'function') {
      return bpConfirm({
        title: 'Покупка гостем',
        text: text,
        okLabel: 'Купить всё равно',
        cancelLabel: 'Отмена',
        danger: false
      }).then(function (ok) {
        if (ok) {
          try { sessionStorage.setItem('bp_guest_shop_warned', '1'); } catch (_) {}
        }
        return !!ok;
      });
    }
    const ok = window.confirm(text + '\n\nПродолжить покупку?');
    if (ok) {
      try { sessionStorage.setItem('bp_guest_shop_warned', '1'); } catch (_) {}
    }
    return Promise.resolve(!!ok);
  };
  return run();
}
try { window.confirmGuestShopPurchase = confirmGuestShopPurchase; window.isGuestShopper = isGuestShopper; } catch (_) {}


/** Purchase celebration: card pulse + full preview modal with real skin/board look. */
function playPurchaseFx(kind, id) {
  try {
    const root = document.getElementById('shopGrid') || document.getElementById('invGrid') || document;
    const sel = kind === 'board'
      ? '[data-board="' + id + '"]'
      : '[data-skin="' + id + '"]';
    const card = root.querySelector(sel);
    if (card) {
      card.classList.remove('purchase-fx');
      void card.offsetWidth;
      card.classList.add('purchase-fx');
      setTimeout(function () { try { card.classList.remove('purchase-fx'); } catch (_) {} }, 1000);
    }
  } catch (_) {}
  try { if (typeof SFX !== 'undefined' && SFX.ui) SFX.ui(); } catch (_) {}
  try { if (typeof hapticTap === 'function') hapticTap(18); } catch (_) {}
  // Open real preview celebration (auto-close)
  try {
    // Defer one frame so equipBoard/renderShop cannot overwrite the preview
    setTimeout(function () {
      try {
        if (kind === 'board') openBoardPreview(id, { celebrate: true });
        else openSkinPreview(id, { celebrate: true });
      } catch (_) {}
    }, 40);
  } catch (_) {}
}


/** @returns {'ok'|'funds'|'owned'|'busy'|'bad'} */
function buyBoard(id) {
  const board = getBoardById(id);
  if (!board || board.price <= 0) return 'bad';
  if (ownedBoards.includes(id)) return 'owned';
  if (diamonds < board.price) return 'funds';
  if (window._bpBuyInFlight) return 'busy';
  const online = !!(typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.cosmeticsBuy === 'function');
  try { window._bpBuyInFlight = true; } catch (_) {}
  try { showPurchaseLoading('board', board.name || id); } catch (_) {}
  diamonds -= board.price;
  try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
  if (!ownedBoards.includes(id)) ownedBoards.push(id);
  equippedBoardId = id;
  try { applyEquippedBoard(); } catch (_) {}
  try { saveBoardsState(); } catch (_) {}
  try { updateMenuStats(); } catch (_) {}
  if (online) {
    try { MatchClient.cosmeticsBuy('board', id); } catch (_) {
      try { hidePurchaseLoading(); } catch (_2) {}
    }
  } else {
    try {
      if (typeof syncGuestProgressToServer === 'function' && !(typeof authToken !== 'undefined' && authToken)) {
        syncGuestProgressToServer({ force: true }).catch(function () {});
      }
    } catch (_) {}
    try {
      bumpAchStat('boardsBought', 1);
      if (board.rarity === 'legendary') setAchStat('boardsLegendary', Math.max(1, getAchStat('boardsLegendary')));
      checkNewAchievements();
    } catch (_) {}
    try { hidePurchaseLoading(); } catch (_) {}
    try { playPurchaseFx('board', id); } catch (_) {}
  }
  return 'ok';
}
function equipBoard(id) {
  if (!ownedBoards.includes(id)) return false;
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.cosmeticsEquip === 'function') {
      MatchClient.cosmeticsEquip('board', id);
    }
  } catch (_) {}
  equippedBoardId = id;
  applyEquippedBoard();
  saveBoardsState();
  return true;
}
applyEquippedBoard();

function fieldMiniPatternHTML(board) {
  // Decorative 6x6 pattern for shop cards
  const pattern = [
    0,1,1,0,0,1,
    1,1,0,0,1,1,
    0,0,1,1,0,0,
    0,1,1,1,1,0,
    1,0,0,0,0,1,
    0,1,0,0,1,0
  ];
  return pattern.map(on => on ? '<i class="on"></i>' : '<i></i>').join('');
}
function boardShopItemHTML(board) {
  // preview via data-preview-board on stage

  const owned = ownedBoards.includes(board.id);
  const eq = equippedBoardId === board.id;
  const rar = board.rarity || 'common';
  let action;
  if (eq) action = `<span class="skin-action on">Надето</span>`;
  else if (owned) action = `<button type="button" class="skin-action primary" data-equip-board="${board.id}">Надеть</button>`;
  else {
    const can = diamonds >= board.price;
    action = `<button type="button" class="skin-action ${can ? 'primary' : 'muted'}" data-buy-board="${board.id}" ${can ? '' : 'disabled'}>💎 ${board.price}</button>`;
  }
  const fxClass = board.fx && board.fx !== 'none' ? ` fx-${board.fx}` : '';
  return `<div class="skin-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" role="listitem" data-board="${board.id}" data-rarity="${rar}"
    style="--field-empty:${board.empty};--field-surface:${board.surface};--field-accent:${board.accent}">
    <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
    <div class="skin-item-stage" data-preview-board="${board.id}" title="Превью поля">
      <div class="field-mini${fxClass}" aria-hidden="true">${fieldMiniPatternHTML(board)}</div>
    </div>
    <div class="skin-item-meta">
      <div class="skin-name">${locCosName(board)}</div>
      ${action}
    </div>
  </div>`;
}
function boardInvItemHTML(board) {
  const eq = equippedBoardId === board.id;
  const rar = board.rarity || 'common';
  const action = eq
    ? `<span class="skin-action on">Надето</span>`
    : `<button type="button" class="skin-action primary" data-equip-board="${board.id}">Надеть</button>`;
  const fxClass = board.fx && board.fx !== 'none' ? ` fx-${board.fx}` : '';
  return `<div class="skin-item owned ${eq ? 'equipped' : ''}" role="listitem" data-board="${board.id}" data-rarity="${rar}"
    style="--field-empty:${board.empty};--field-surface:${board.surface};--field-accent:${board.accent}">
    <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
    <div class="skin-item-stage">
      <div class="field-mini${fxClass}" aria-hidden="true">${fieldMiniPatternHTML(board)}</div>
    </div>
    <div class="skin-item-meta">
      <div class="skin-name">${locCosName(board)}</div>
      ${action}
    </div>
  </div>`;
}
function sortBoardsByRarity(list) {
  const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return list.slice().sort((a, b) => {
    const ra = order[a.rarity] ?? 9;
    const rb = order[b.rarity] ?? 9;
    if (ra !== rb) return ra - rb;
    return (b.price || 0) - (a.price || 0);
  });
}

