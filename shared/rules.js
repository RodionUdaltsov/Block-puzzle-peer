/**
 * Block Puzzle — shared authoritative rules (Node + browser).
 * Single source of truth for shapes, placement, clears, scoring, deal.
 *
 * Node:  const R = require('./shared/rules');
 * Browser: <script src="shared/rules.js"></script> → window.BPRules
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BPRules = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 8;
  const DEFAULT_COLORS = [
    '#00d4aa', '#7c5cff', '#ff5c7a', '#ffb347',
    '#4fc3f7', '#ff6bcb', '#a8e063', '#ff8a65'
  ];

  const SHAPES = [
    [[0, 0]],
    [[0, 0], [0, 1]], [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
    [[0, 1], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1]], [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 0]]
  ];

  const SHAPE_WEIGHTS = SHAPES.map(function (s) {
    const n = s.length;
    if (n === 1) return 8;
    if (n === 2) return 10;
    if (n === 3) return 9;
    return 5;
  });

  // Anti-spam (server)
  const MIN_PLACE_INTERVAL_MS = 120;
  const PLACE_BURST_WINDOW_MS = 1000;
  const PLACE_BURST_MAX = 8;

  // Disconnect / AFK (server)
  const DC_LIMIT_MS = 60000;
  const AFK_WARN_MS = 15000;
  const AFK_LIMIT_MS = 30000;

  function emptyGrid(size) {
    size = size || SIZE;
    return Array.from({ length: size }, function () {
      return Array(size).fill(null);
    });
  }

  function cloneGrid(g) {
    return g.map(function (row) { return row.slice(); });
  }

  function normalizeShape(shape) {
    if (!Array.isArray(shape) || !shape.length) return [];
    const cells = shape.map(function (p) { return [p[0] | 0, p[1] | 0]; });
    const minR = Math.min.apply(null, cells.map(function (p) { return p[0]; }));
    const minC = Math.min.apply(null, cells.map(function (p) { return p[1]; }));
    return cells.map(function (p) { return [p[0] - minR, p[1] - minC]; });
  }

  function shapeKey(shape) {
    return normalizeShape(shape)
      .map(function (p) { return p[0] + ',' + p[1]; })
      .sort()
      .join(';');
  }

  function shapesEqual(a, b) {
    return shapeKey(a) === shapeKey(b);
  }

  function randomPiece(palette) {
    const colors = (palette && palette.length) ? palette : DEFAULT_COLORS;
    const total = SHAPE_WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < SHAPE_WEIGHTS.length; i++) {
      r -= SHAPE_WEIGHTS[i];
      if (r <= 0) { idx = i; break; }
    }
    return {
      shape: normalizeShape(SHAPES[idx]),
      color: colors[Math.floor(Math.random() * colors.length)],
      used: false
    };
  }

  function dealThree(palette) {
    return [randomPiece(palette), randomPiece(palette), randomPiece(palette)];
  }

  function canPlaceOn(g, shape, baseR, baseC) {
    const size = (g && g.length) || SIZE;
    for (let i = 0; i < shape.length; i++) {
      const dr = shape[i][0];
      const dc = shape[i][1];
      const r = baseR + dr;
      const c = baseC + dc;
      if (r < 0 || r >= size || c < 0 || c >= size || g[r][c]) return false;
    }
    return true;
  }

  /**
   * Clear full rows/cols in place. Returns { count, rows, cols }.
   * Mutates g.
   */
  function clearLinesOnGrid(g) {
    const size = (g && g.length) || SIZE;
    const rows = [];
    const cols = [];
    for (let r = 0; r < size; r++) {
      if (g[r].every(function (c) { return !!c; })) rows.push(r);
    }
    for (let c = 0; c < size; c++) {
      if (g.every(function (row) { return !!row[c]; })) cols.push(c);
    }
    if (!rows.length && !cols.length) return { count: 0, rows: [], cols: [] };
    rows.forEach(function (r) {
      for (let c = 0; c < size; c++) g[r][c] = null;
    });
    cols.forEach(function (c) {
      for (let r = 0; r < size; r++) g[r][c] = null;
    });
    return { count: rows.length + cols.length, rows: rows, cols: cols };
  }

  /** Same as clearLinesOnGrid but returns only count (client silent helper). */
  function clearLinesSilent(g) {
    return clearLinesOnGrid(g).count;
  }

  function bonusFor(cleared) {
    return [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000][cleared] || 4000;
  }

  function chainBonusFor(chain) {
    if (chain < 2) return 0;
    return Math.min(800, (chain - 1) * 50);
  }

  function placePoints(shape) {
    return (shape && shape.length ? shape.length : 0) * 10;
  }

  function serializePieces(pieces) {
    return (pieces || []).map(function (p) {
      return {
        shape: (p.shape || []).map(function (c) { return c.slice(); }),
        color: p.color,
        used: !!p.used
      };
    });
  }

  function findAllPlacements(g, shape) {
    if (!shape || !shape.length) return [];
    const size = (g && g.length) || SIZE;
    const maxR = Math.max.apply(null, shape.map(function (s) { return s[0]; }));
    const maxC = Math.max.apply(null, shape.map(function (s) { return s[1]; }));
    const candidates = [];
    for (let r = 0; r <= size - 1 - maxR; r++) {
      for (let c = 0; c <= size - 1 - maxC; c++) {
        if (canPlaceOn(g, shape, r, c)) candidates.push({ r: r, c: c });
      }
    }
    return candidates;
  }

  /** true = can play, false = stuck, null = tray empty / deal pending */
  function sideHasPlayable(g, pieceArr) {
    const left = (pieceArr || []).filter(function (p) {
      return p && !p.used && p.shape && p.shape.length;
    });
    if (!left.length) return null;
    for (let i = 0; i < left.length; i++) {
      if (findAllPlacements(g, left[i].shape).length > 0) return true;
    }
    return false;
  }

  return {
    SIZE: SIZE,
    DEFAULT_COLORS: DEFAULT_COLORS,
    SHAPES: SHAPES,
    SHAPE_WEIGHTS: SHAPE_WEIGHTS,
    MIN_PLACE_INTERVAL_MS: MIN_PLACE_INTERVAL_MS,
    PLACE_BURST_WINDOW_MS: PLACE_BURST_WINDOW_MS,
    PLACE_BURST_MAX: PLACE_BURST_MAX,
    DC_LIMIT_MS: DC_LIMIT_MS,
    AFK_WARN_MS: AFK_WARN_MS,
    AFK_LIMIT_MS: AFK_LIMIT_MS,
    emptyGrid: emptyGrid,
    cloneGrid: cloneGrid,
    normalizeShape: normalizeShape,
    shapeKey: shapeKey,
    shapesEqual: shapesEqual,
    randomPiece: randomPiece,
    dealThree: dealThree,
    canPlaceOn: canPlaceOn,
    clearLinesOnGrid: clearLinesOnGrid,
    clearLinesSilent: clearLinesSilent,
    bonusFor: bonusFor,
    chainBonusFor: chainBonusFor,
    placePoints: placePoints,
    serializePieces: serializePieces,
    findAllPlacements: findAllPlacements,
    sideHasPlayable: sideHasPlayable
  };
});
