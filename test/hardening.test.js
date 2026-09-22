'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');

test('canonical rules are byte-identical on server and client', () => {
  const a = fs.readFileSync(path.join(root, 'shared/rules.js'));
  const b = fs.readFileSync(path.join(root, 'public/shared/rules.js'));
  assert.deepEqual(b, a);
});

test('server never uses client shape or color for authoritative placement', () => {
  const s = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.equal(/data\.shape/.test(s), false);
  assert.equal(/data\.color/.test(s), false);
  assert.match(s, /const shape = normalizeShape\(handPiece\.shape\)/);
  assert.match(s, /const color = handPiece\.color \|\| DEFAULT_COLORS\[0\]/);
});

test('legacy peer-liveness filename is gone from active loader/docs', () => {
  assert.equal(fs.existsSync(path.join(root, 'public/js/06-peer-liveness.js')), false);
  for (const rel of ['public/index.html', 'public/game.js', 'public/js/README.md']) {
    const s = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.equal(s.includes('06-peer-liveness.js'), false, rel);
  }
  assert.equal(fs.existsSync(path.join(root, 'public/js/06-match-liveness.js')), true);
});

test('all project JavaScript passes node --check', () => {
  const files = [
    'server.js', 'shared/rules.js', 'public/shared/rules.js', 'public/match-client.js',
    ...fs.readdirSync(path.join(root, 'public/js')).filter(f => f.endsWith('.js')).map(f => path.join('public/js', f))
  ];
  for (const rel of files) cp.execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'pipe' });
});
