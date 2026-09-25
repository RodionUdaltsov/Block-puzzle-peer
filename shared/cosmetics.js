/**
 * Block Puzzle — shared cosmetics catalog (server + client).
 * Colors live in shared/skins.js; this file owns free IDs, prices, rarity, boards meta.
 * Client UI names/desc may still use local catalog for i18n; ids/prices must match.
 */
'use strict';

const FREE_SKIN_IDS = ['default'];
const FREE_BOARD_IDS = ['field_default'];

/** Skin shop meta (id → price/rarity). Colors: shared/skins.js */
const SKIN_META = {
  default: { price: 0, rarity: 'common' },
  ocean: { price: 30, rarity: 'common' },
  forest: { price: 30, rarity: 'common' },
  mono: { price: 45, rarity: 'common' },
  sunset: { price: 120, rarity: 'rare' },
  neon: { price: 150, rarity: 'rare' },
  candy: { price: 160, rarity: 'rare' },
  ice: { price: 180, rarity: 'rare' },
  lava: { price: 280, rarity: 'epic' },
  royal: { price: 300, rarity: 'epic' },
  aurora: { price: 360, rarity: 'epic' },
  sakura: { price: 320, rarity: 'epic' },
  cyber: { price: 620, rarity: 'legendary' },
  midnight: { price: 680, rarity: 'legendary' },
  gold: { price: 850, rarity: 'legendary' },
  toxic: { price: 340, rarity: 'epic' }
};

/** Board shop meta (id → price/rarity + css class suffix) */
const BOARD_META = {
  field_default: { price: 0, rarity: 'common', fx: 'default' },
  field_slate: { price: 25, rarity: 'common', fx: 'slate' },
  field_charcoal: { price: 25, rarity: 'common', fx: 'charcoal' },
  field_graphite: { price: 40, rarity: 'common', fx: 'graphite' },
  field_sand: { price: 55, rarity: 'common', fx: 'sand' },
  field_azure: { price: 120, rarity: 'rare', fx: 'azure' },
  field_violet: { price: 140, rarity: 'rare', fx: 'violet' },
  field_jade: { price: 160, rarity: 'rare', fx: 'jade' },
  field_crystal: { price: 280, rarity: 'epic', fx: 'crystal' },
  field_magma: { price: 300, rarity: 'epic', fx: 'magma' },
  field_neon_grid: { price: 340, rarity: 'epic', fx: 'neon_grid' },
  field_nebula: { price: 520, rarity: 'legendary', fx: 'nebula' },
  field_solar: { price: 560, rarity: 'legendary', fx: 'solar' },
  field_quantum: { price: 600, rarity: 'legendary', fx: 'quantum' },
  field_abyss: { price: 640, rarity: 'legendary', fx: 'abyss' },
  field_prism: { price: 720, rarity: 'legendary', fx: 'prism' }
};

function knownSkinIds() {
  return Object.keys(SKIN_META);
}

function knownBoardIds() {
  return Object.keys(BOARD_META);
}

function isKnownSkin(id) {
  return !!(id && SKIN_META[String(id)]);
}

function isKnownBoard(id) {
  return !!(id && BOARD_META[String(id)]);
}

function skinPrice(id) {
  const m = SKIN_META[String(id)];
  return m ? (m.price | 0) : -1;
}

function boardPrice(id) {
  const m = BOARD_META[String(id)];
  return m ? (m.price | 0) : -1;
}

function isFreeSkin(id) {
  return FREE_SKIN_IDS.indexOf(String(id)) !== -1;
}

function isFreeBoard(id) {
  return FREE_BOARD_IDS.indexOf(String(id)) !== -1;
}

/**
 * Normalize a cosmetics profile. Ensures free items, valid equipped, non-neg diamonds.
 */
function normalizeProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  let diamonds = parseInt(p.diamonds, 10);
  if (!Number.isFinite(diamonds) || diamonds < 0) diamonds = 0;
  // Cap absurd values (anti-abuse); migration can raise once
  if (diamonds > 999999) diamonds = 999999;

  const ownedSkins = Array.isArray(p.ownedSkins)
    ? p.ownedSkins.map(String).filter(isKnownSkin)
    : [];
  for (let i = 0; i < FREE_SKIN_IDS.length; i++) {
    if (ownedSkins.indexOf(FREE_SKIN_IDS[i]) === -1) ownedSkins.push(FREE_SKIN_IDS[i]);
  }

  const ownedBoards = Array.isArray(p.ownedBoards)
    ? p.ownedBoards.map(String).filter(isKnownBoard)
    : [];
  for (let i = 0; i < FREE_BOARD_IDS.length; i++) {
    if (ownedBoards.indexOf(FREE_BOARD_IDS[i]) === -1) ownedBoards.push(FREE_BOARD_IDS[i]);
  }

  let equippedSkin = p.equippedSkin ? String(p.equippedSkin) : 'default';
  if (!isKnownSkin(equippedSkin) || ownedSkins.indexOf(equippedSkin) === -1) {
    equippedSkin = 'default';
  }

  let equippedBoard = p.equippedBoard ? String(p.equippedBoard) : 'field_default';
  if (!isKnownBoard(equippedBoard) || ownedBoards.indexOf(equippedBoard) === -1) {
    equippedBoard = 'field_default';
  }

  return {
    diamonds,
    ownedSkins,
    ownedBoards,
    equippedSkin,
    equippedBoard,
    migrated: !!p.migrated,
    updatedAt: p.updatedAt || Date.now()
  };
}

function defaultProfile() {
  return normalizeProfile({
    diamonds: 0,
    ownedSkins: FREE_SKIN_IDS.slice(),
    ownedBoards: FREE_BOARD_IDS.slice(),
    equippedSkin: 'default',
    equippedBoard: 'field_default',
    migrated: false
  });
}

/**
 * Validate that skinId/boardId may be used by this profile (owned + known).
 * Returns { skinId, boardId } clamped to allowed values.
 */
function clampCosmetics(profile, skinId, boardId) {
  const p = normalizeProfile(profile);
  let s = skinId ? String(skinId).slice(0, 32) : p.equippedSkin;
  let b = boardId ? String(boardId).slice(0, 32) : p.equippedBoard;
  if (!isKnownSkin(s) || p.ownedSkins.indexOf(s) === -1) s = 'default';
  if (!isKnownBoard(b) || p.ownedBoards.indexOf(b) === -1) b = 'field_default';
  return { skinId: s, boardId: b };
}

/**
 * Attempt purchase. Returns { ok, profile, error }.
 */
function tryBuy(profile, kind, id) {
  const p = normalizeProfile(profile);
  const itemId = String(id || '');
  if (kind === 'skin') {
    if (!isKnownSkin(itemId)) return { ok: false, profile: p, error: 'unknown' };
    if (isFreeSkin(itemId) || p.ownedSkins.indexOf(itemId) !== -1) {
      return { ok: false, profile: p, error: 'owned' };
    }
    const price = skinPrice(itemId);
    if (price < 0) return { ok: false, profile: p, error: 'unknown' };
    if (p.diamonds < price) return { ok: false, profile: p, error: 'funds' };
    p.diamonds -= price;
    p.ownedSkins.push(itemId);
    p.updatedAt = Date.now();
    return { ok: true, profile: p, error: null };
  }
  if (kind === 'board') {
    if (!isKnownBoard(itemId)) return { ok: false, profile: p, error: 'unknown' };
    if (isFreeBoard(itemId) || p.ownedBoards.indexOf(itemId) !== -1) {
      return { ok: false, profile: p, error: 'owned' };
    }
    const price = boardPrice(itemId);
    if (price < 0) return { ok: false, profile: p, error: 'unknown' };
    if (p.diamonds < price) return { ok: false, profile: p, error: 'funds' };
    p.diamonds -= price;
    p.ownedBoards.push(itemId);
    p.updatedAt = Date.now();
    return { ok: true, profile: p, error: null };
  }
  return { ok: false, profile: p, error: 'kind' };
}

/**
 * Equip owned item. Returns { ok, profile, error }.
 */
function tryEquip(profile, kind, id) {
  const p = normalizeProfile(profile);
  const itemId = String(id || '');
  if (kind === 'skin') {
    if (!isKnownSkin(itemId) || p.ownedSkins.indexOf(itemId) === -1) {
      return { ok: false, profile: p, error: 'unowned' };
    }
    p.equippedSkin = itemId;
    p.updatedAt = Date.now();
    return { ok: true, profile: p, error: null };
  }
  if (kind === 'board') {
    if (!isKnownBoard(itemId) || p.ownedBoards.indexOf(itemId) === -1) {
      return { ok: false, profile: p, error: 'unowned' };
    }
    p.equippedBoard = itemId;
    p.updatedAt = Date.now();
    return { ok: true, profile: p, error: null };
  }
  return { ok: false, profile: p, error: 'kind' };
}

/**
 * One-time migration: take client-reported ownership if server profile not yet migrated.
 * Client values are clamped to known ids; diamonds capped.
 */
function migrateFromClient(serverProfile, clientHint) {
  const p = normalizeProfile(serverProfile);
  if (p.migrated) return p;
  const hint = clientHint && typeof clientHint === 'object' ? clientHint : {};
  let diamonds = parseInt(hint.diamonds, 10);
  if (Number.isFinite(diamonds) && diamonds > p.diamonds) {
    // Allow generous local test values once; still cap
    p.diamonds = Math.min(999999, Math.max(0, diamonds));
  }
  if (Array.isArray(hint.ownedSkins)) {
    for (let i = 0; i < hint.ownedSkins.length; i++) {
      const id = String(hint.ownedSkins[i]);
      if (isKnownSkin(id) && p.ownedSkins.indexOf(id) === -1) p.ownedSkins.push(id);
    }
  }
  if (Array.isArray(hint.ownedBoards)) {
    for (let i = 0; i < hint.ownedBoards.length; i++) {
      const id = String(hint.ownedBoards[i]);
      if (isKnownBoard(id) && p.ownedBoards.indexOf(id) === -1) p.ownedBoards.push(id);
    }
  }
  if (hint.equippedSkin && isKnownSkin(hint.equippedSkin) && p.ownedSkins.indexOf(String(hint.equippedSkin)) !== -1) {
    p.equippedSkin = String(hint.equippedSkin);
  }
  if (hint.equippedBoard && isKnownBoard(hint.equippedBoard) && p.ownedBoards.indexOf(String(hint.equippedBoard)) !== -1) {
    p.equippedBoard = String(hint.equippedBoard);
  }
  p.migrated = true;
  p.updatedAt = Date.now();
  return normalizeProfile(p);
}

function grantDiamonds(profile, amount) {
  const p = normalizeProfile(profile);
  const n = parseInt(amount, 10) || 0;
  if (n > 0) p.diamonds = Math.min(999999, p.diamonds + n);
  p.updatedAt = Date.now();
  return p;
}

const api = {
  FREE_SKIN_IDS,
  FREE_BOARD_IDS,
  SKIN_META,
  BOARD_META,
  knownSkinIds,
  knownBoardIds,
  isKnownSkin,
  isKnownBoard,
  skinPrice,
  boardPrice,
  isFreeSkin,
  isFreeBoard,
  normalizeProfile,
  defaultProfile,
  clampCosmetics,
  tryBuy,
  tryEquip,
  migrateFromClient,
  grantDiamonds
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.BPCosmetics = api;
}
