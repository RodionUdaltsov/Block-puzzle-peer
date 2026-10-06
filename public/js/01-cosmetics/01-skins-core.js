/**
 * Block Puzzle — js/01-cosmetics/01-skins-core.js
 * Cosmetic constants, skin catalog, equip/apply skins (self, opponent, AI).
 * Shares the client bundle scope (order: public/js/modules.json).
 */

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
