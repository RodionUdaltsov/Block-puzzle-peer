/**
 * LEGACY / DEV ONLY — not loaded by index.html in production.
 *
 * Production uses the classic IIFE bundle:
 *   node scripts/bundle-client.js  →  public/dist/client.bundle.js
 *
 * Native multi-file ESM is not used for 01–12 because those modules share a
 * large global call graph (circular). The bundler places them in one scope.
 *
 * This file exists so tooling/IDE can treat `public/js` as an ES module package
 * root and so `import '/js/main.js'` can load the prebuilt ESM bundle.
 */
import bundle from '../dist/client.bundle.mjs';

export const version = bundle.version;
export const hash = bundle.hash;
export default bundle;

if (typeof console !== 'undefined' && console.debug) {
  console.debug('[BP] ESM entry loaded', bundle.version, bundle.hash);
}
