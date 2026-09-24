'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const jsFiles = [
  'server.js',
  'shared/rules.js',
  'public/shared/rules.js',
  'public/match-client.js',
  ...fs.readdirSync(path.join(root, 'public/js'))
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => path.join('public/js', f))
];

for (const rel of jsFiles) {
  cp.execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'inherit' });
}

const a = fs.readFileSync(path.join(root, 'shared/rules.js'));
const b = fs.readFileSync(path.join(root, 'public/shared/rules.js'));
if (!a.equals(b)) throw new Error('shared/rules.js and public/shared/rules.js differ');

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (/data\.shape/.test(server)) throw new Error('server.js still trusts client-supplied shape data');
if (/data\.color/.test(server)) throw new Error('server.js still trusts client-supplied color data');
if (!server.includes("shared/skins")) {
  throw new Error('server.js must load shared/skins for palettes');
}
if (!fs.existsSync(path.join(root, 'shared', 'skins.js'))) {
  throw new Error('shared/skins.js missing');
}

const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'public/game.js'), 'utf8');
if (index.includes('06-peer-liveness.js') || game.includes('06-peer-liveness.js')) {
  throw new Error('legacy 06-peer-liveness.js reference remains');
}

console.log(`[check] OK — ${jsFiles.length} JavaScript files parsed; rules are synchronized; server move input is authoritative.`);

// Client bundle (ESM pipeline)
const distJs = path.join(root, 'public/dist/client.bundle.js');
const distMjs = path.join(root, 'public/dist/client.bundle.mjs');
if (!fs.existsSync(distJs) || !fs.existsSync(distMjs)) {
  console.warn('[check] dist bundle missing — run: npm run build');
  // auto-build once
  require(path.join(root, 'scripts/bundle-client.js')).build();
}
cp.execFileSync(process.execPath, ['--check', distJs], { stdio: 'inherit' });
const manPath = path.join(root, 'public/dist/manifest.json');
if (fs.existsSync(manPath)) {
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  console.log('[check] client bundle v' + man.version + ' hash=' + man.hash + ' modules=' + (man.modules && man.modules.length));
}
