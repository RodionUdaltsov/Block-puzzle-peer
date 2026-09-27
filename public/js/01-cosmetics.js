/**
 * Block Puzzle — 01-cosmetics.js
 * Skins, boards, shop/inventory UI helpers
 * Lines ~1-1159 from legacy game.js monolith (refactored).
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

/** Localized cosmetic name/desc (falls back to catalog string). */
function locCosName(item) {
  if (!item) return '';
  var prefix = (item.id && String(item.id).indexOf('field_') === 0) ? 'board.' : 'skin.';
  return (typeof globalThis.t === 'function') ? t(prefix + item.id + '.name', item.name) : item.name;
}
function locCosDesc(item) {
  if (!item) return '';
  var prefix = (item.id && String(item.id).indexOf('field_') === 0) ? 'board.' : 'skin.';
  return (typeof globalThis.t === 'function') ? t(prefix + item.id + '.desc', item.desc || '') : (item.desc || '');
}

/* Online multiplayer: MatchClient WebSocket (server-authoritative). */
/* Shared rules: window.BPRules (public/shared/rules.js) — same as server */
const _R = (typeof BPRules !== 'undefined' && BPRules) ? BPRules : null;
const SIZE = _R ? _R.SIZE : 8;
const DEFAULT_COLORS = _R
  ? _R.DEFAULT_COLORS.slice()
  : ['#00d4aa','#7c5cff','#ff5c7a','#ffb347','#4fc3f7','#ff6bcb','#a8e063','#ff8a65'];
let COLORS = DEFAULT_COLORS.slice();

// —— Piece skins (shop / inventory) ——
// Only the base skin is free; everything else is bought (sync-test friendly)
const FREE_SKIN_IDS = ['default'];
const SKIN_CATALOG = [
  {
    id: 'default', name: 'Классика', desc: 'Стандартная палитра', price: 0, rarity: 'common',
    colors: ['#00d4aa','#7c5cff','#ff5c7a','#ffb347','#4fc3f7','#ff6bcb','#a8e063','#ff8a65']
  },
  {
    id: 'ocean', name: 'Океан', desc: 'Глубокие синие тона', price: 30, rarity: 'common',
    colors: ['#00c2ff','#0077b6','#48cae4','#90e0ef','#023e8a','#0096c7','#ade8f4','#5ee7ff']
  },
  {
    id: 'forest', name: 'Лес', desc: 'Зелень и янтарь', price: 30, rarity: 'common',
    colors: ['#2d6a4f','#40916c','#52b788','#95d5b2','#d8f3dc','#b7e4c7','#74c69d','#ffb703']
  },
  {
    id: 'mono', name: 'Монохром', desc: 'Серо-стальная палитра', price: 45, rarity: 'common',
    colors: ['#e8eaed','#cfd8e3','#9aa0a6','#8b9bb0','#d7dee8','#b0b8c4','#6b7280','#a1a1aa']
  },
  {
    id: 'sunset', name: 'Закат', desc: 'Оранжевый и розовый', price: 120, rarity: 'rare',
    colors: ['#ff6b35','#f7c59f','#ef476f','#ffd166','#ff8fab','#ff9f1c','#e36414','#c9184a']
  },
  {
    id: 'neon', name: 'Неон', desc: 'Неоновая ночь', price: 150, rarity: 'rare',
    colors: ['#39ff14','#ff00ff','#00f5ff','#ffe600','#ff3d81','#7b61ff','#00ffc6','#ff9f1c']
  },
  {
    id: 'candy', name: 'Конфетти', desc: 'Пастельная сладость', price: 160, rarity: 'rare',
    colors: ['#ff8fab','#ffc2d1','#bde0fe','#a2d2ff','#cdb4db','#ffd6a5','#fdffb6','#caffbf']
  },
  {
    id: 'ice', name: 'Лёд', desc: 'Холодный кристалл', price: 180, rarity: 'rare',
    colors: ['#e0f7ff','#a5f3fc','#67e8f9','#22d3ee','#0891b2','#7dd3fc','#bae6fd','#38bdf8']
  },
  {
    id: 'lava', name: 'Лава', desc: 'Раскалённая магма', price: 280, rarity: 'epic',
    colors: ['#ff4500','#ff6a00','#ff8c00','#ffd166','#c1121f','#e85d04','#faa307','#9d0208']
  },
  {
    id: 'royal', name: 'Королевский', desc: 'Пурпур и золото', price: 300, rarity: 'epic',
    colors: ['#7b2cbf','#c77dff','#ffd700','#5a189a','#4cc9f0','#f72585','#4361ee','#f4a261']
  },
  {
    id: 'aurora', name: 'Аврора', desc: 'Северное сияние', price: 360, rarity: 'epic',
    colors: ['#00f5d4','#00bbf9','#9b5de5','#f15bb5','#fee440','#80ed99','#56cfe1','#7209b7']
  },
  {
    id: 'sakura', name: 'Сакура', desc: 'Цветение вишни', price: 320, rarity: 'epic',
    colors: ['#ffb7c5','#ff8fab','#ffc2d1','#fb6f92','#ffccd5','#e5989b','#ff99ac','#f7a1c4']
  },
  {
    id: 'cyber', name: 'Кибер', desc: 'Синтетика и матрица', price: 620, rarity: 'legendary',
    colors: ['#0aff99','#00ffc8','#7b2ff7','#f72585','#3a0ca3','#4cc9f0','#b8f2e6','#ff006e']
  },
  {
    id: 'midnight', name: 'Полночь', desc: 'Тёмная роскошь', price: 680, rarity: 'legendary',
    colors: ['#1b263b','#415a77','#778da9','#e0e1dd','#0d1b2a','#7c5cff','#5ee7ff','#c9ada7']
  },
  {
    id: 'gold', name: 'Золото', desc: 'Чистый блеск', price: 850, rarity: 'legendary',
    colors: ['#ffd700','#ffc300','#ffb703','#f4a261','#e9c46a','#daa520','#ffdb58','#ffe566']
  },
  {
    id: 'toxic', name: 'Токсин', desc: 'Ядовитое свечение', price: 340, rarity: 'epic',
    colors: ['#39ff14','#b8ff3c','#ccff00','#76ff03','#1b5e20','#00e676','#aeea00','#64dd17']
  }
];

function loadOwnedSkins() {
  try {
    const raw = localStorage.getItem('bp_skins_owned');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        const ids = parsed.map((id) => String(id)).filter((id) => SKIN_CATALOG.some((s) => s.id === id));
        // Only ensure the base free skin is present
        for (const free of FREE_SKIN_IDS) {
          if (!ids.includes(free)) ids.push(free);
        }
        return ids;
      }
    }
  } catch (_) {}
  return FREE_SKIN_IDS.slice();
}
let ownedSkins = loadOwnedSkins();
let equippedSkinId = localStorage.getItem('bp_skin_equipped') || 'default';
if (!ownedSkins.includes(equippedSkinId)) equippedSkinId = 'default';
if (!SKIN_CATALOG.some(s => s.id === equippedSkinId)) equippedSkinId = 'default';

function getSkinById(id) {
  return SKIN_CATALOG.find(s => s.id === id) || SKIN_CATALOG[0];
}
function skinFxClass(rarity) {
  if (rarity === 'legendary') return 'skin-fx-prism';
  if (rarity === 'epic') return 'skin-fx-gloss';
  return 'skin-fx-matte';
}
function paintCellColor(cell, col) {
  if (!cell) return;
  let c = (col && String(col).trim()) ? String(col).trim() : '#00d4aa';
  // Normalize hex case so tray/board/network always match
  if (/^#[0-9a-fA-F]{6}$/.test(c)) c = c.toLowerCase();
  cell.style.setProperty('--cell-base', c);
  cell.style.setProperty('--cell-glow', c);
  cell.style.backgroundImage = 'none';
  cell.style.backgroundColor = c;
  cell.style.background = c;
}
function applyEquippedSkin() {
  const skin = getSkinById(equippedSkinId);
  COLORS = (skin.colors && skin.colors.length) ? skin.colors.slice() : DEFAULT_COLORS.slice();
  const rar = skin.rarity || 'common';
  const fx = skinFxClass(rar);
  document.body.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
  document.body.classList.add(fx);
  if (rar === 'rare') document.body.classList.add('skin-fx-rare');
  try {
    document.body.dataset.skinId = skin.id || 'default';
    document.body.dataset.skinRarity = rar;
  } catch (_) {}
  // Refresh boards if present
  try {
    if (typeof boardEl !== 'undefined' && boardEl) renderGrid(grid, boardEl);
    if (typeof board !== 'undefined' && board) renderGrid(grid, board);
    if (typeof boardMe !== 'undefined' && boardMe) renderGrid(grid, boardMe);
    if (typeof boardOpp !== 'undefined' && boardOpp) renderGrid(oppGrid, boardOpp);
  } catch (_) {}
  // Re-tint live piece trays so colors match equipped skin immediately
  try {
    document.querySelectorAll('.piece-cell').forEach(pc => {
      const bg = pc.style.getPropertyValue('--cell-base') || pc.style.backgroundColor || pc.style.background;
      if (bg && bg !== 'none') {
        pc.style.setProperty('--cell-base', bg);
        pc.style.setProperty('--cell-glow', bg);
      }
    });
  } catch (_) {}
}
/** Apply opponent's equipped skin FX so gradient / shimmer / combo particles
 *  are visible on their board for the local player (and vice versa on their client). */
function applyOppSkin(skinId) {
  const id = skinId || window.mpOppSkinId || 'default';
  try { window.mpOppSkinId = id; } catch (_) {}
  const skin = getSkinById(id);
  const rar = skin.rarity || 'common';
  const fx = skinFxClass(rar);
  // Prefer vs panel; fall back to any .player-panel.opp
  const panel = document.querySelector('#screenVersus .player-panel.opp')
    || document.querySelector('.player-panel.opp');
  if (!panel) {
    // Screen not mounted yet — retry shortly (match loading → versus)
    try {
      if (!window._oppSkinRetry) {
        window._oppSkinRetry = setTimeout(() => {
          window._oppSkinRetry = null;
          try { applyOppSkin(window.mpOppSkinId); } catch (_) {}
        }, 200);
      }
    } catch (_) {}
    return;
  }
  panel.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
  panel.classList.add(fx);
  if (rar === 'rare') panel.classList.add('skin-fx-rare');
  try {
    panel.dataset.oppSkin = skin.id || 'default';
    panel.dataset.oppRarity = rar;
  } catch (_) {}
  // CSS vars for legend particle palette
  const pal = {
    gold: ['#ffd700','#fff3a0','#ffb703','#ffe566'],
    cyber: ['#0aff99','#00f5ff','#7b2ff7','#ff006e'],
    midnight: ['#5ee7ff','#c9ada7','#7c5cff','#e0e1dd']
  };
  const p = pal[skin.id];
  if (p) {
    panel.style.setProperty('--legend-a', p[0]);
    panel.style.setProperty('--legend-b', p[1]);
    panel.style.setProperty('--legend-c', p[2]);
    panel.style.setProperty('--legend-d', p[3]);
  } else {
    try {
      panel.style.removeProperty('--legend-a');
      panel.style.removeProperty('--legend-b');
      panel.style.removeProperty('--legend-c');
      panel.style.removeProperty('--legend-d');
    } catch (_) {}
  }
  // Re-paint opp board/hand so FX classes attach to live cells
  try {
    if (typeof boardOpp !== 'undefined' && boardOpp && typeof oppGrid !== 'undefined') {
      if (typeof softRenderGrid === 'function') softRenderGrid(oppGrid, boardOpp);
      else if (typeof renderGrid === 'function') renderGrid(oppGrid, boardOpp);
    }
  } catch (_) {}
  try {
    if (typeof softRenderOppPieces === 'function') softRenderOppPieces();
    else if (typeof renderOppPieces === 'function') renderOppPieces();
  } catch (_) {}
}
function clearOppSkin() {
  const panel = document.querySelector('.player-panel.opp');
  if (!panel) return;
  panel.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
  panel.classList.add('skin-fx-matte');
  try {
    panel.dataset.oppSkin = 'default';
    panel.dataset.oppRarity = 'common';
  } catch (_) {}
  try {
    panel.style.removeProperty('--legend-a');
    panel.style.removeProperty('--legend-b');
    panel.style.removeProperty('--legend-c');
    panel.style.removeProperty('--legend-d');
  } catch (_) {}
}
/** Flying ghost must use the side's skin, not always the local player's body class */
function setAiGhostSkin(side) {
  const g = document.getElementById('aiGhost');
  if (!g) return;
  g.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
  let fx = 'skin-fx-matte';
  let rare = false;
  try {
    if (side === 'opp') {
      if (document.body.classList.contains('vs-bots') || (typeof vsModeType !== 'undefined' && vsModeType === 'bots')) {
        fx = 'skin-fx-matte';
        rare = false;
      } else {
        const panel = document.querySelector('.player-panel.opp');
        if (panel) {
          if (panel.classList.contains('skin-fx-prism')) fx = 'skin-fx-prism';
          else if (panel.classList.contains('skin-fx-gloss')) fx = 'skin-fx-gloss';
          else if (panel.classList.contains('skin-fx-rare')) { fx = 'skin-fx-rare'; rare = true; }
          else if (panel.classList.contains('skin-fx-matte')) fx = 'skin-fx-matte';
        }
        if (fx === 'skin-fx-matte' && !rare) {
          const sid = window.mpOppSkinId || (replayData && replayData.oppSkinId) || null;
          if (sid && typeof getSkinById === 'function' && typeof skinFxClass === 'function') {
            const skin = getSkinById(sid);
            const rar = (skin && skin.rarity) || 'common';
            fx = skinFxClass(rar);
            if (rar === 'rare') rare = true;
          }
        }
      }
    } else {
      if (document.body.classList.contains('skin-fx-prism')) fx = 'skin-fx-prism';
      else if (document.body.classList.contains('skin-fx-gloss')) fx = 'skin-fx-gloss';
      else if (document.body.classList.contains('skin-fx-rare')) { fx = 'skin-fx-rare'; rare = true; }
      else fx = 'skin-fx-matte';
      // Fallback from equipped / replay skin
      if (fx === 'skin-fx-matte' && !rare) {
        const sid = (typeof equippedSkinId !== 'undefined' && equippedSkinId)
          || (replayData && replayData.mySkinId) || null;
        if (sid && typeof getSkinById === 'function' && typeof skinFxClass === 'function') {
          const skin = getSkinById(sid);
          const rar = (skin && skin.rarity) || 'common';
          fx = skinFxClass(rar);
          if (rar === 'rare') rare = true;
        }
      }
    }
  } catch (_) {}
  g.classList.add(fx);
  if (rare || fx === 'skin-fx-rare') g.classList.add('skin-fx-rare');
}
function applyOppBoard(boardId) {
  const id = boardId || window.mpOppBoardId || 'field_default';
  const board = (typeof getBoardById === 'function') ? getBoardById(id) : null;
  try { window.mpOppBoardId = (board && board.id) || id; } catch (_) {}
  const panel = document.querySelector('#screenVersus .player-panel.opp')
    || document.querySelector('.player-panel.opp');
  if (!panel) {
    try {
      if (!window._oppBoardRetry) {
        window._oppBoardRetry = setTimeout(() => {
          window._oppBoardRetry = null;
          try { applyOppBoard(window.mpOppBoardId); } catch (_) {}
        }, 200);
      }
    } catch (_) {}
    return;
  }
  try {
    panel.dataset.oppBoard = (board && board.id) || id;
    panel.dataset.oppBoardRarity = (board && board.rarity) || 'common';
  } catch (_) {}
  const wrap = panel.querySelector('.board-wrap');
  if (wrap && board && typeof applyBoardToWrap === 'function') {
    applyBoardToWrap(wrap, board);
  }
}
function clearOppBoard() {
  try { window.mpOppBoardId = null; } catch (_) {}
  const panel = document.querySelector('.player-panel.opp');
  if (!panel) return;
  try {
    delete panel.dataset.oppBoard;
    delete panel.dataset.oppBoardRarity;
  } catch (_) {}
  const wrap = panel.querySelector('.board-wrap');
  if (wrap && typeof applyBoardToWrap === 'function' && typeof getBoardById === 'function') {
    applyBoardToWrap(wrap, getBoardById('field_default'));
  }
}
function skinMetaForSide(side) {
  // side: 'me' | 'opp' | null (classic = me)
  if (side === 'opp') {
    const panel = document.querySelector('.player-panel.opp');
    const id = (panel && panel.dataset.oppSkin) || window.mpOppSkinId || 'default';
    const skin = getSkinById(id);
    return { id: skin.id, rarity: skin.rarity || 'common', skin };
  }
  const id = (document.body.dataset && document.body.dataset.skinId) || equippedSkinId || 'default';
  const skin = getSkinById(id);
  return { id: skin.id, rarity: skin.rarity || 'common', skin };
}
applyEquippedSkin();

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


function buyBoard(id) {
  const board = getBoardById(id);
  if (!board || board.price <= 0) return false;
  if (ownedBoards.includes(id)) return false;
  if (diamonds < board.price) return false;
  diamonds -= board.price;
  try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
  if (!ownedBoards.includes(id)) ownedBoards.push(id);
  try { saveBoardsState(); } catch (_) {}
  try { updateMenuStats(); } catch (_) {}
  try { playPurchaseFx('board', id); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.cosmeticsBuy === 'function') {
      MatchClient.cosmeticsBuy('board', id);
    } else if (typeof syncGuestProgressToServer === 'function' && !(typeof authToken !== 'undefined' && authToken)) {
      syncGuestProgressToServer({ force: true }).catch(function () {});
    }
  } catch (_) {}
  try {
    bumpAchStat('boardsBought', 1);
    if (board.rarity === 'legendary') setAchStat('boardsLegendary', Math.max(1, getAchStat('boardsLegendary')));
    checkNewAchievements();
  } catch (_) {}
  return true;
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


function saveSkinsState() {
  try {
    localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins));
    localStorage.setItem('bp_skin_equipped', equippedSkinId);
  } catch (_) {}
}
function buySkin(id) {
  const skin = getSkinById(id);
  if (!skin || skin.price <= 0) return false;
  if (ownedSkins.includes(id)) return false;
  if (diamonds < skin.price) return false;
  diamonds -= skin.price;
  try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
  if (!ownedSkins.includes(id)) ownedSkins.push(id);
  try { saveSkinsState(); } catch (_) {}
  try { updateMenuStats(); } catch (_) {}
  try { playPurchaseFx('skin', id); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.cosmeticsBuy === 'function') {
      MatchClient.cosmeticsBuy('skin', id);
    } else if (typeof syncGuestProgressToServer === 'function' && !(typeof authToken !== 'undefined' && authToken)) {
      syncGuestProgressToServer({ force: true }).catch(function () {});
    }
  } catch (_) {}
  try { setAchStat('skinsOwned', ownedSkins.length); } catch (_) {}
  try { bumpAchStat('skinsBought', 1); } catch (_) {}
  return true;
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
  try { applyEquippedBoard(); } catch (_) {}
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
        if (buySkin(id)) {
          try { SFX.ui(); } catch (_) {}
          equipSkin(id);
          renderShopGrid();
          renderInvGrid();
        } else {
          try {
            if (typeof showInfoToast === 'function') showInfoToast('Магазин', 'Не хватает алмазов', 'bad');
            else alert('Не хватает алмазов');
          } catch (_) { alert('Не хватает алмазов'); }
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
        if (buyBoard(id)) {
          try { SFX.ui(); } catch (_) {}
          equipBoard(id);
          renderShopGrid();
          renderInvGrid();
        } else {
          try {
            if (typeof showInfoToast === 'function') showInfoToast('Магазин', 'Не хватает алмазов', 'bad');
            else alert('Не хватает алмазов');
          } catch (_) { alert('Не хватает алмазов'); }
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
    // Skip work when tab hidden
    try { if (document.hidden) { fi++; return; } } catch (_) {}
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
  shopMiniTimer = setInterval(paint, 900);
}

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
    ov.classList.remove('visible', 'purchase-celebrate');
    ov.setAttribute('aria-hidden', 'true');
    if (ov._restoreFx) { try { ov._restoreFx(); } catch (_) {} }
  }
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
  if (combo) combo.textContent = opts.celebrate ? '✓ Куплено!' : '';

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
          if (buyBoard(board.id)) {
            // Re-open same preview with celebrate (identical look)
            try { equipBoard(board.id); } catch (_) {}
            try { renderShopGrid(); } catch (_) {}
            try { renderInvGrid(); } catch (_) {}
            openBoardPreview(board.id, { celebrate: true });
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
  if (combo) combo.textContent = opts.celebrate ? '✓ Куплено!' : '';

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
          if (buySkin(skin.id)) {
            try { equipSkin(skin.id); } catch (_) {}
            try { renderShopGrid(); } catch (_) {}
            try { renderInvGrid(); } catch (_) {}
            openSkinPreview(skin.id, { celebrate: true });
          }
        });
      };
    }
  }

  try { setPreviewModalSkinFx(skin); } catch (_) {}
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
  try {
    if (typeof data.diamonds === 'number' && data.diamonds >= 0) {
      // Cosmetics profile diamonds — but registered account is higher authority
      let d = Math.max(0, data.diamonds | 0);
      try {
        if (typeof authToken !== 'undefined' && authToken && typeof authAccount !== 'undefined'
            && authAccount && typeof authAccount.diamonds === 'number') {
          const ad = Math.max(0, authAccount.diamonds | 0);
          // Never let a stale profile default (9999) overwrite real account balance
          if (d === 9999 && ad !== 9999) d = ad;
          else if (ad >= 0 && ad !== d) {
            // Prefer account row for logged-in users (donation currency lives on accounts)
            d = ad;
          }
        }
      } catch (_) {}
      diamonds = d;
      try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
      try {
        const loggedIn = !!(typeof authToken !== 'undefined' && authToken);
        if (!loggedIn && typeof syncGuestProgressToServer === 'function') {
          syncGuestProgressToServer({ force: true }).catch(function () {});
        }
      } catch (_) {}
    }
    if (Array.isArray(data.ownedSkins) && data.ownedSkins.length) {
      // Union with local ownership so migration is not wiped
      const set = new Set((Array.isArray(ownedSkins) ? ownedSkins : []).map(String));
      data.ownedSkins.forEach((id) => { if (id) set.add(String(id)); });
      ownedSkins = Array.from(set);
      for (const free of FREE_SKIN_IDS) {
        if (!ownedSkins.includes(free)) ownedSkins.push(free);
      }
    }
    if (Array.isArray(data.ownedBoards) && data.ownedBoards.length) {
      const set = new Set((Array.isArray(ownedBoards) ? ownedBoards : []).map(String));
      data.ownedBoards.forEach((id) => { if (id) set.add(String(id)); });
      ownedBoards = Array.from(set);
      for (const free of FREE_BOARD_IDS) {
        if (!ownedBoards.includes(free)) ownedBoards.push(free);
      }
    }
    if (data.equippedSkin && ownedSkins.includes(String(data.equippedSkin))) {
      equippedSkinId = String(data.equippedSkin);
      try { applyEquippedSkin(); } catch (_) {}
    }
    if (data.equippedBoard && ownedBoards.includes(String(data.equippedBoard))) {
      equippedBoardId = String(data.equippedBoard);
      try { applyEquippedBoard(); } catch (_) {}
    }
    try { saveSkinsState(); } catch (_) {}
    try { saveBoardsState(); } catch (_) {}
    try { updateMenuStats(); } catch (_) {}
    try {
      if (typeof renderShop === 'function') renderShop();
      else if (typeof renderSkinShop === 'function') renderSkinShop();
    } catch (_) {}
    window._bpServerCosmetics = true;
  } catch (_) {}
}

(function wireCosmeticsWs() {
  function onState(data) { applyCosmeticsStateFromServer(data); }
  function onBuy(data) {
    if (data && data.ok) {
      applyCosmeticsStateFromServer(data);
      try {
        if (data.id) playPurchaseFx(data.kind === 'board' ? 'board' : 'skin', data.id);
      } catch (_) {}
      try {
        if (typeof renderShopGrid === 'function') renderShopGrid();
        if (typeof renderInvGrid === 'function') renderInvGrid();
      } catch (_) {}
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
      applyCosmeticsStateFromServer(data);
      try {
        if (typeof renderShopGrid === 'function') renderShopGrid();
      } catch (_) {}
    }
  }
  function onEquip(data) {
    if (data) applyCosmeticsStateFromServer(data);
  }
  function tryWire() {
    if (typeof MatchClient === 'undefined' || typeof MatchClient.on !== 'function') {
      setTimeout(tryWire, 400);
      return;
    }
    try { MatchClient.on('cosmetics_state', onState); } catch (_) {}
    try { MatchClient.on('cosmetics_buy_result', onBuy); } catch (_) {}
    try { MatchClient.on('cosmetics_equip_result', onEquip); } catch (_) {}
  }
  tryWire();
})();
