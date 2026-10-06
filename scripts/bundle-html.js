/**
 * Block Puzzle — zero-dep HTML assembler.
 *
 * Concatenates the fragments listed in public/html/modules.json (document order)
 * into public/index.html and substitutes %%VERSION%% with the package.json version
 * (cache-busting query strings of styles.css / client bundle).
 *
 *   node scripts/bundle-html.js
 *
 * Edit public/html/*.html — NOT public/index.html (generated, overwritten on build).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'public', 'html', 'modules.json');
const OUT = path.join(ROOT, 'public', 'index.html');

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.0.0';
  } catch (_) {
    return '0.0.0';
  }
}

function build() {
  const { fragments } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const VERSION = readVersion();
  let html = '';
  for (const rel of fragments) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) throw new Error('[bundle-html] missing fragment ' + rel);
    html += fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  }
  html = html.replace(/%%VERSION%%/g, VERSION);
  fs.writeFileSync(OUT, html);
  console.log('[bundle-html] OK v' + VERSION + ' fragments=' + fragments.length + ' bytes=' + Buffer.byteLength(html));
  return { version: VERSION, fragments, bytes: Buffer.byteLength(html) };
}

if (require.main === module) build();

module.exports = { build, MANIFEST, OUT };
