'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');

/** Recursively list *.js files (client modules live in feature sub-folders). */
function walkJs(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJs(full));
    else if (ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}
const jsFiles = [
  'server.js',
  'shared/rules.js',
  'public/shared/rules.js',
  'public/match-client.js',
  ...walkJs(path.join(root, 'lib')).map(f => path.relative(root, f)),
  ...fs.readdirSync(path.join(root, 'scripts')).filter(f => f.endsWith('.js')).sort().map(f => path.join('scripts', f)),
  ...walkJs(path.join(root, 'public/js')).map(f => path.relative(root, f))
];

for (const rel of jsFiles) {
  cp.execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'inherit' });
}

const a = fs.readFileSync(path.join(root, 'shared/rules.js'));
const b = fs.readFileSync(path.join(root, 'public/shared/rules.js'));
if (!a.equals(b)) throw new Error('shared/rules.js and public/shared/rules.js differ');

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
for (const rel of ['server.js', ...walkJs(path.join(root, 'lib')).map(f => path.relative(root, f).split(path.sep).join('/'))]) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  if (/data\.shape/.test(src)) throw new Error(rel + ' still trusts client-supplied shape data');
  if (/data\.color/.test(src)) throw new Error(rel + ' still trusts client-supplied color data');
}
if (!server.includes("shared/skins")) {
  throw new Error('server.js must load shared/skins for palettes');
}
if (!fs.existsSync(path.join(root, 'shared', 'skins.js'))) {
  throw new Error('shared/skins.js missing');
}

// Client module manifest: every listed file exists, no duplicates, no orphan modules.
{
  const { modules } = JSON.parse(fs.readFileSync(path.join(root, 'public/js/modules.json'), 'utf8'));
  const seen = new Set();
  for (const m of modules) {
    if (seen.has(m)) throw new Error('modules.json lists ' + m + ' twice');
    seen.add(m);
    if (!fs.existsSync(path.join(root, m))) throw new Error('modules.json lists missing file ' + m);
  }
  const LEGACY_UNBUNDLED = new Set(['public/js/main.js']);
  for (const abs of walkJs(path.join(root, 'public/js'))) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (!seen.has(rel) && !LEGACY_UNBUNDLED.has(rel)) throw new Error(rel + ' is not listed in public/js/modules.json');
  }
  const MAX_LINES = 1300;
  for (const m of modules) {
    if (m.startsWith('public/js/')) {
      const n = fs.readFileSync(path.join(root, m), 'utf8').split('\n').length;
      if (n > MAX_LINES) throw new Error(m + ' has ' + n + ' lines (> ' + MAX_LINES + ') — split it by responsibility');
    }
  }
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
