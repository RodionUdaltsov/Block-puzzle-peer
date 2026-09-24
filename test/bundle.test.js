'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, MODULES } = require('../scripts/bundle-client');

describe('client bundler', () => {
  it('builds classic + esm outputs', () => {
    const man = build();
    assert.ok(man.hash);
    assert.ok(man.modules.length >= 14);
    const classic = path.join(__dirname, '../public/dist/client.bundle.js');
    const esm = path.join(__dirname, '../public/dist/client.bundle.mjs');
    assert.ok(fs.existsSync(classic));
    assert.ok(fs.existsSync(esm));
    const body = fs.readFileSync(classic, 'utf8');
    assert.ok(body.includes('BPRules') || body.includes('softRenderGrid') || body.includes('BPState'));
    assert.ok(body.includes('BP_VERSION') === false); // classic has version in banner only
    assert.ok(body.includes('Block Puzzle client bundle'));
    const esmBody = fs.readFileSync(esm, 'utf8');
    assert.ok(esmBody.includes('export const BP_VERSION'));
  });

  it('module list covers state, perf, soft-render, handlers', () => {
    const joined = MODULES.join(' ');
    assert.ok(joined.includes('00-state'));
    assert.ok(joined.includes('00-perf'));
    assert.ok(joined.includes('05-soft-render'));
    assert.ok(joined.includes('10-match-handlers'));
    assert.ok(joined.includes('shared/rules'));
  });
});
