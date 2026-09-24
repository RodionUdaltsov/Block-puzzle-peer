/**
 * Behavioral tests for shared/rules.js
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/rules');

describe('BPRules — grid & placement', () => {
  it('emptyGrid is SIZE×SIZE falsy cells', () => {
    const g = R.emptyGrid();
    assert.equal(g.length, R.SIZE);
    assert.equal(g[0].length, R.SIZE);
    assert.ok(g.every((row) => row.every((c) => !c)));
  });

  it('canPlaceOn rejects out of bounds', () => {
    const g = R.emptyGrid();
    const shape = [[0, 0], [0, 1], [0, 2]];
    assert.equal(R.canPlaceOn(g, shape, 0, R.SIZE - 1), false);
  });

  it('canPlaceOn accepts empty cells', () => {
    const g = R.emptyGrid();
    const shape = [[0, 0], [1, 0]];
    assert.equal(R.canPlaceOn(g, shape, 3, 3), true);
  });

  it('canPlaceOn rejects occupied cells', () => {
    const g = R.emptyGrid();
    g[2][2] = '#ff0';
    const shape = [[0, 0]];
    assert.equal(R.canPlaceOn(g, shape, 2, 2), false);
  });

  it('clearLinesOnGrid clears full row and reports count', () => {
    const g = R.emptyGrid();
    for (let c = 0; c < R.SIZE; c++) g[0][c] = '#00d4aa';
    const result = R.clearLinesOnGrid(g);
    assert.equal(result.count, 1);
    assert.deepEqual(result.rows, [0]);
    assert.ok(g[0].every((c) => !c));
  });

  it('bonusFor increases with more lines', () => {
    const b1 = R.bonusFor(1);
    const b2 = R.bonusFor(2);
    const b3 = R.bonusFor(3);
    assert.ok(b2 >= b1);
    assert.ok(b3 >= b2);
  });

  it('bonusFor(0) is 0 (not 4000 via falsy || bug)', () => {
    assert.equal(R.bonusFor(0), 0);
    assert.equal(R.bonusFor(1), 100);
  });

  it('dealThree returns 3 pieces with shape+color', () => {
    const pieces = R.dealThree();
    assert.equal(pieces.length, 3);
    for (const p of pieces) {
      assert.ok(Array.isArray(p.shape));
      assert.ok(typeof p.color === 'string');
    }
  });

  it('normalizeShape is stable and origin-shifted', () => {
    const s = [[1, 1], [1, 2], [2, 1]];
    const n = R.normalizeShape(s);
    assert.ok(Array.isArray(n));
    assert.ok(n.length >= 1);
    const minR = Math.min(...n.map((c) => c[0]));
    const minC = Math.min(...n.map((c) => c[1]));
    assert.equal(minR, 0);
    assert.equal(minC, 0);
  });

  it('sideHasPlayable false on full board', () => {
    const g = R.emptyGrid();
    for (let r = 0; r < R.SIZE; r++) {
      for (let c = 0; c < R.SIZE; c++) g[r][c] = '#111';
    }
    const pieces = [{ shape: [[0, 0]], color: '#f00', used: false }];
    assert.equal(R.sideHasPlayable(g, pieces), false);
  });

  it('sideHasPlayable true on empty board', () => {
    const g = R.emptyGrid();
    const pieces = R.dealThree();
    assert.equal(R.sideHasPlayable(g, pieces), true);
  });

  it('anti-spam / liveness constants are consistent', () => {
    assert.ok(R.MIN_PLACE_INTERVAL_MS > 0);
    assert.ok(R.PLACE_BURST_MAX >= 1);
    assert.ok(R.DC_LIMIT_MS >= R.AFK_LIMIT_MS);
    assert.ok(R.AFK_LIMIT_MS > R.AFK_WARN_MS);
  });
});
