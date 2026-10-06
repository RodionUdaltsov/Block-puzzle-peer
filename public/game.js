/**
 * LEGACY / DEV ONLY — not used in production.
 *
 * Production loads only `dist/client.bundle.js` from index.html.
 * This loader pulls the same modules unbundled (handy for debugging with
 * readable stack traces). The load order comes from `js/modules.json`, the
 * single source of truth shared with scripts/bundle-client.js.
 *
 * Usage (temporary, dev): replace the bundle <script> in index.html with
 *   <script src="game.js"></script>
 */
(function () {
  'use strict';
  if (window.__BP_MODULES_LOADED) return;
  if (document.querySelector('script[src*="dist/client.bundle"]')) {
    window.__BP_MODULES_LOADED = true;
    return;
  }
  var base = '';
  try {
    var cur = document.currentScript && document.currentScript.src;
    if (cur) base = cur.replace(/[^/]+$/, '');
  } catch (_) {}

  function loadNext(list, i) {
    if (i >= list.length) {
      window.__BP_MODULES_LOADED = true;
      return;
    }
    var s = document.createElement('script');
    s.src = base + list[i];
    s.async = false;
    s.onload = function () { loadNext(list, i + 1); };
    s.onerror = function () {
      console.error('[BP] module failed', list[i]);
      loadNext(list, i + 1);
    };
    (document.head || document.documentElement).appendChild(s);
  }

  fetch(base + 'js/modules.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (man) {
      // Manifest paths are repo-relative ("public/js/..."); the site root is public/.
      var list = (man.modules || []).map(function (m) { return m.replace(/^public\//, ''); });
      loadNext(list, 0);
    })
    .catch(function (e) { console.error('[BP] cannot load js/modules.json', e); });
})();
