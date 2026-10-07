'use strict';
/**
 * Guards for the modular layout (see docs/ARCHITECTURE.md): manifests are the single source of
 * truth for load order, generated assets are in sync, and nothing grows back into a monolith.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const lineCount = (rel) => read(rel).split('\n').length;
const walk = (rel, ext) => fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(rel + '/' + e.name, ext) : (e.name.endsWith(ext) ? [rel + '/' + e.name] : []));

describe('modular layout', () => {
  it('client manifest lists every module exactly once and every file exists', () => {
    const { modules } = JSON.parse(read('public/js/modules.json'));
    assert.equal(new Set(modules).size, modules.length, 'duplicate entries');
    for (const m of modules) assert.ok(fs.existsSync(path.join(root, m)), 'missing ' + m);
    const listed = new Set(modules);
    for (const f of walk('public/js', '.js')) {
      if (f === 'public/js/main.js') continue; // legacy, unbundled
      assert.ok(listed.has(f), f + ' is not in public/js/modules.json');
    }
  });

  it('css manifest lists every module once, perf tier last', () => {
    const { modules } = JSON.parse(read('public/css/modules.json'));
    assert.equal(new Set(modules).size, modules.length);
    for (const m of modules) assert.ok(fs.existsSync(path.join(root, m)), 'missing ' + m);
    assert.equal(modules[modules.length - 1], 'public/css/styles-perf.css');
    for (const f of walk('public/css', '.css')) assert.ok(modules.includes(f), f + ' is not in public/css/modules.json');
  });

  it('public/index.html is exactly what the html fragments produce', () => {
    const { fragments } = JSON.parse(read('public/html/modules.json'));
    const version = JSON.parse(read('package.json')).version;
    const html = fragments.map((f) => read(f)).join('').replace(/%%VERSION%%/g, version);
    assert.equal(read('public/index.html'), html, 'run `npm run build:html`');
  });

  it('no client, css or server module grows back into a monolith', () => {
    const LIMITS = [['public/js', '.js', 1300], ['public/css', '.css', 1000], ['public/html', '.html', 400], ['lib', '.js', 700]];
    for (const [dir, ext, max] of LIMITS) {
      for (const f of walk(dir, ext)) {
        if (f.startsWith('public/js/MULTI')) continue;
        if (['lib/postgres-store.js', 'lib/accounts.js', 'lib/device.js'].includes(f)) continue; // single-responsibility, not yet split
        assert.ok(lineCount(f) <= max, f + ' has ' + lineCount(f) + ' lines (limit ' + max + ')');
      }
    }
  });

  it('server entry stays a composition root', () => {
    assert.ok(lineCount('server.js') <= 1250, 'server.js grew to ' + lineCount('server.js'));
  });
});
