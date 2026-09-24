/**
 * BPState — central mirror of hot match flags (v3.9.30+)
 *
 * Installs getters/setters on window._* for listed keys so existing code and
 * BPState stay in sync. Prefer BPState.set / BPState.field in new code.
 */
(function (global) {
  'use strict';

  var KEYS = [
    'roomMatchMode',
    'matchEnded',
    'matchClockEndTs',
    'quietPieceRender',
    'rejoinLoading',
    'rejoinInputLock',
    'pendingServerPlace',
    'animateDealIn',
    'mpRejoiningMatch',
    'matchGoFallbackTimer',
    'roomExpandIv',
    'matchStartPhase',
    'matchGoFinishing',
    'matchAwaitingGo',
    'matchIntroSeqRunning',
    'preMatchAborting',
    'pendingPlaceTimer',
    'matchStartLocked',
    'matchIntroTimer',
    'matchHadAnyPlace',
    'lastOppPacketAt',
    'soloRejoinActive',
    'introStartShownForId',
    'serverAuthSyncIv',
    'resultDismissed',
    'replaySkinBackup',
    'replayBoardBackup',
    'matchIntroSeqDone',
    'matchIntroSafetyTimer',
    'leftForRankedSearch',
    'forceCancelPreMoveLock',
    'bothAwayResolveTimer',
    'paintFrozen',
    'rankedDeltaApplied',
    'repChainMe',
    'repChainOpp',
    'soloDeadlineTimer',
    'soloDialIv',
    'soloOverlayIv'
  ];

  var store = Object.create(null);
  KEYS.forEach(function (k) { store[k] = undefined; });

  var BPState = {};

  KEYS.forEach(function (k) {
    Object.defineProperty(BPState, k, {
      configurable: true,
      enumerable: true,
      get: function () { return store[k]; },
      set: function (v) {
        store[k] = v;
        // keep plain alias if defineProperty on window failed
        try {
          if (!Object.getOwnPropertyDescriptor(global, '_' + k) ||
              Object.getOwnPropertyDescriptor(global, '_' + k).set) {
            /* window proxy handles it */
          }
        } catch (_) {}
      }
    });
  });

  KEYS.forEach(function (k) {
    var prop = '_' + k;
    var prev;
    try { prev = global[prop]; } catch (_) { prev = undefined; }
    if (prev !== undefined) store[k] = prev;
    try {
      Object.defineProperty(global, prop, {
        configurable: true,
        enumerable: false,
        get: function () { return store[k]; },
        set: function (v) { store[k] = v; }
      });
    } catch (_) {
      // non-configurable pre-existing prop — leave as-is
    }
  });

  BPState.set = function (key, value) {
    store[key] = value;
    return value;
  };

  BPState.get = function (key) {
    return store[key];
  };

  BPState.keys = KEYS.slice();

  BPState.syncFromWindow = function () {
    KEYS.forEach(function (k) {
      try {
        var d = Object.getOwnPropertyDescriptor(global, '_' + k);
        if (d && !d.get && global['_' + k] !== undefined) store[k] = global['_' + k];
      } catch (_) {}
    });
  };

  BPState.snapshot = function () {
    var out = {};
    KEYS.forEach(function (k) { out[k] = store[k]; });
    return out;
  };

  global.BPState = BPState;
  if (!global.BP) global.BP = {};
  global.BP.state = BPState;
  global.BP.version = '3.9.30';
})(typeof window !== 'undefined' ? window : this);
