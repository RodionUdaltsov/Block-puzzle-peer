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

const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'public/game.js'), 'utf8');
if (index.includes('06-peer-liveness.js') || game.includes('06-peer-liveness.js')) {
  throw new Error('legacy 06-peer-liveness.js reference remains');
}

console.log(`[check] OK — ${jsFiles.length} JavaScript files parsed; rules are synchronized; server move input is authoritative.`);
