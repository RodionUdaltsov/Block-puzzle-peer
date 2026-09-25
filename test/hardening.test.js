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
  // Placement logic lives in lib/match-room.js (extracted from server.js)
  const files = ['server.js', 'lib/match-room.js'].map((rel) =>
    fs.readFileSync(path.join(root, rel), 'utf8')
  );
  for (const s of files) {
    assert.equal(/data\.shape/.test(s), false, 'must not trust data.shape');
    assert.equal(/data\.color/.test(s), false, 'must not trust data.color');
  }
  const room = files[1];
  assert.match(room, /const shape = normalizeShape\(handPiece\.shape\)/);
  assert.match(room, /const color = handPiece\.color \|\| DEFAULT_COLORS\[0\]/);
  assert.match(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), /lib\/match-room/);
});

test('legacy peer-liveness filename is gone from active loader/docs', () => {
  assert.equal(fs.existsSync(path.join(root, 'public/js/06-peer-liveness.js')), false);
  for (const rel of ['public/index.html', 'public/game.js', 'public/js/README.md']) {
    if (!fs.existsSync(path.join(root, rel))) continue;
    const s = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.equal(s.includes('06-peer-liveness.js'), false, rel);
  }
  assert.equal(fs.existsSync(path.join(root, 'public/js/06-match-liveness.js')), true);
});

test('shared skins module exists and server loads it', () => {
  assert.equal(fs.existsSync(path.join(root, 'shared/skins.js')), true);
  const skins = require(path.join(root, 'shared/skins.js'));
  assert.ok(skins.SKIN_PALETTES.default);
  assert.ok(Array.isArray(skins.paletteForSkin('ocean')));
  const s = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(s, /shared\/skins/);
});

test('performance module is in the client bundle pipeline', () => {
  const bundler = fs.readFileSync(path.join(root, 'scripts/bundle-client.js'), 'utf8');
  assert.match(bundler, /13-performance\.js/);
});




test('http-api module is used by server', () => {
  assert.equal(fs.existsSync(path.join(root, 'lib/http-api.js')), true);
  const s = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(s, /lib\/http-api/);
  assert.match(s, /createHttpHandler/);
  const api = fs.readFileSync(path.join(root, 'lib/http-api.js'), 'utf8');
  assert.match(api, /\/api\/auth\/delete/);
  assert.match(api, /\/health/);
  assert.match(api, /\/metrics/);
});

test('ws-handlers module is attached by server', () => {
  assert.equal(fs.existsSync(path.join(root, 'lib/ws-handlers.js')), true);
  const s = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(s, /lib\/ws-handlers/);
  assert.match(s, /attachWsHandlers/);
  // core match actions still authoritative in extracted module
  const ws = fs.readFileSync(path.join(root, 'lib/ws-handlers.js'), 'utf8');
  assert.match(ws, /type === 'place'/);
  assert.equal(/data\.shape/.test(ws), false);
});

test('matchmaking module is loaded by server', () => {
  assert.equal(fs.existsSync(path.join(root, 'lib/matchmaking.js')), true);
  const s = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(s, /lib\/matchmaking/);
  assert.match(s, /createMatchmaking/);
});


test('client core bundle includes primary UI handlers (04 + 11)', () => {
  const man = JSON.parse(fs.readFileSync(path.join(root, 'public/dist/manifest.json'), 'utf8'));
  assert.ok(man.modules.includes('public/js/04-profile-friends.js'));
  assert.ok(man.modules.includes('public/js/11-private-rooms-ui.js'));
  assert.ok(man.modules.includes('public/js/14-settings-ui.js'));
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(index, /client\.bundle\.js/);
  // Primary handlers must not live only in an optional deferred chunk
  assert.equal(index.includes('client.deferred.js'), false);
});

test('settings UI module is in the client bundle pipeline', () => {
  const bundler = fs.readFileSync(path.join(root, 'scripts/bundle-client.js'), 'utf8');
  assert.match(bundler, /14-settings-ui\.js/);
  assert.equal(fs.existsSync(path.join(root, 'public/js/14-settings-ui.js')), true);
});

test('all project JavaScript passes node --check', () => {
  const files = [
    'server.js', 'lib/match-room.js', 'lib/matchmaking.js', 'lib/ws-handlers.js', 'lib/http-api.js', 'shared/rules.js', 'public/shared/rules.js', 'public/match-client.js',
    ...fs.readdirSync(path.join(root, 'public/js')).filter(f => f.endsWith('.js')).map(f => path.join('public/js', f))
  ];
  for (const rel of files) cp.execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'pipe' });
});
