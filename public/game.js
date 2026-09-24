/**
 * LEGACY — not used in production.
 *
 * Production loads only `dist/client.bundle.js` from index.html.
 * Kept for offline/dev fallback if the bundle is missing and modules are
 * included as separate <script> tags. Safe to delete once you no longer
 * need the unbundled multi-script load path.
 */
(function () {
  'use strict';
  if (window.__BP_MODULES_LOADED) return;
  if (document.querySelector('script[src*="js/01-cosmetics"]')) {
    window.__BP_MODULES_LOADED = true;
    return;
  }
  var scripts = [
    'js/01-cosmetics.js',
    'js/02-bots-achievements-settings.js',
    'js/03-audio.js',
    'js/04-profile-friends.js',
    'js/05-soft-render.js',
    'js/06-match-liveness.js',
    'js/07-match-flow-ui.js',
    'js/08-screens-gameplay.js',
    'js/09-offline-and-ranked.js',
    'js/10-match-handlers.js',
    'js/11-private-rooms-ui.js',
    'js/12-boot.js'
  ];
  var base = '';
  try {
    var cur = document.currentScript && document.currentScript.src;
    if (cur) base = cur.replace(/[^/]+$/, '');
  } catch (_) {}
  function loadNext(i) {
    if (i >= scripts.length) {
      window.__BP_MODULES_LOADED = true;
      return;
    }
    var s = document.createElement('script');
    s.src = base + scripts[i];
    s.async = false;
    s.onload = function () { loadNext(i + 1); };
    s.onerror = function () {
      console.error('[BP] module failed', scripts[i]);
      loadNext(i + 1);
    };
    (document.head || document.documentElement).appendChild(s);
  }
  loadNext(0);
})();
