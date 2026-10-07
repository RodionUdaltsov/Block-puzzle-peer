/**
 * Block Puzzle — 02-bots-achievements-settings/04-settings.js
 * Settings, board scales, wake lock, haptics (+ touch-UI detection).
 * Shares one IIFE scope with the other public/js modules (see modules.json; ORDER MATTERS).
 */
'use strict';

function isTouchUiClient() {
  try {
    return !!(document.body && document.body.classList.contains('touch-ui'));
  } catch (_) { return false; }
}


const DEFAULT_SETTINGS = {
  classicScale: '1',
  versusScale: '1',
  theme: 'default',
  anim: 'full',
  floats: '1',
  speech: '1',
  voice: '1',
  haptics: '1',
  preview: '0',
  sfx: '1',
  music: '1',
  musicVol: '50',
  voiceVol: '70',
  matchIntro: '1',
  scoreDuel: '1',
  confetti: '1',
  confirmForfeit: '1',
  keepAwake: '0',
  bigText: '0',
  hiContrast: '0',
  // Graphics (see 13-performance.js). 'auto' = detect device + adapt to real frame pacing.
  gfx: 'auto',
  gfxSkin: 'auto',
  gfxField: 'auto',
  gfxFx: 'auto',
  gfxGlow: 'auto',
  gfxFps: '0'
};
let settings = { ...DEFAULT_SETTINGS };
try {
  const raw = JSON.parse(localStorage.getItem('bp_settings') || '{}');
  settings = { ...DEFAULT_SETTINGS, ...raw };
  delete settings.botSpeed;
  settings.preview = '0'; // permanently disabled
} catch (_) {}
function saveSettings() {
  try { localStorage.setItem('bp_settings', JSON.stringify(settings)); } catch (_) {}
}

// Mobile / touch: mark for CSS perf helpers only — keep same anim quality as desktop
(function initTouchUi() {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches
      || window.matchMedia('(hover: none)').matches
      || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    if (coarse) {
      document.body.classList.add('touch-ui');
      // Do NOT force anim=soft — mobile must match PC placeSoft / clear timings
    }
  } catch (_) {}
})();

function renderScalePreviews() {
  const cs = parseFloat(settings.classicScale) || 1;
  const vs = parseFloat(settings.versusScale) || 1;
  const pattern = [0,1,8,9,18,19,27,28,29,36,37];
  const classicOpts = [
    { v: 0.85, label: 'S' },
    { v: 1, label: 'M' },
    { v: 1.12, label: 'L' },
    { v: 1.18, label: 'XL' }
  ];
  const versusOpts = [
    { v: 0.85, label: 'S' },
    { v: 1, label: 'M' },
    { v: 1.12, label: 'L' }
  ];
  const buildRow = (rowEl, opts, current, key, base) => {
    if (!rowEl) return;
    rowEl.innerHTML = opts.map(o => {
      const w = Math.round(base * o.v);
      const sel = Math.abs(current - o.v) < 0.01;
      const cells = Array.from({ length: 64 }, (_, i) =>
        `<span class="${pattern.includes(i) ? 'on' : ''}"></span>`
      ).join('');
      return `<div class="scale-preview-item${sel ? ' selected' : ''}" data-set="${key}" data-val="${o.v}">
        <div class="scale-preview${sel ? ' active' : ''}" style="width:${w}px;height:${w}px">${cells}</div>
        <div class="scale-preview-label">${o.label}${sel ? ' · сейчас' : ''}</div>
      </div>`;
    }).join('');
    rowEl.querySelectorAll('.scale-preview-item').forEach(item => {
      item.addEventListener('click', () => {
        settings[key] = item.dataset.val;
        saveSettings();
        applySettings();
        hapticTap(8);
      });
    });
  };
  buildRow(document.getElementById('previewClassicRow'), classicOpts, cs, 'classicScale', 48);
  buildRow(document.getElementById('previewVersusRow'), versusOpts, vs, 'versusScale', 44);
}
function fitBoardSizeForVersus() {
  // Always stacked (opp top, you bottom) — same geometry phone and PC
  const vh = window.innerHeight || 640;
  const vw = window.innerWidth || 360;
  const scale = parseFloat(settings.versusScale) || 1;
  let factor = 0.85;
  if (scale <= 0.9) factor = 0.7;
  else if (scale >= 1.08) factor = 1.0;

  // Chrome: header + labels + opp tray + player tray + banners
  const chrome = vw >= 700
    ? 48 + 28 + 28 + 72 + 88 + 28
    : 40 + 20 + 20 + 58 + 62 + 24 + 14;
  const forBoards = Math.max(220, vh - chrome);
  const each = Math.floor(forBoards / 2) - 6;
  const maxByW = vw >= 700 ? Math.min(vw - 80, 300) : Math.min(vw - 28, 250);
  const maxFit = Math.max(140, Math.min(each, maxByW));
  return Math.max(120, Math.round(maxFit * factor));
}
function fitBoardSizeForClassic() {
  const vh = window.innerHeight || 640;
  const vw = window.innerWidth || 360;
  const chrome = 52 + 90 + 56 + 40;
  const maxFit = Math.max(160, Math.min(vh - chrome, vw - 36, 340));
  const scale = parseFloat(settings.classicScale) || 1;
  // 0.85 → smaller, 1.18 XL → full maxFit
  const t = Math.max(0, Math.min(1, (scale - 0.85) / (1.18 - 0.85)));
  const factor = 0.8 + 0.2 * t;
  return Math.round(maxFit * factor);
}
function applyBoardScales() {
  const cs = parseFloat(settings.classicScale) || 1;
  const vs = parseFloat(settings.versusScale) || 1;
  document.documentElement.style.setProperty('--classic-scale', String(cs));
  document.documentElement.style.setProperty('--versus-scale', String(vs));

  const classicW = fitBoardSizeForClassic();
  const versusW = fitBoardSizeForVersus();

  document.querySelectorAll('#screenClassic .board').forEach(b => {
    b.style.setProperty('width', classicW + 'px', 'important');
    b.style.setProperty('max-width', 'calc(100vw - 32px)', 'important');
  });
  document.querySelectorAll('#screenVersus .player-panel .board').forEach(b => {
    b.style.setProperty('width', versusW + 'px', 'important');
    b.style.setProperty('max-width', 'min(92vw, 320px)', 'important');
  });
  // Label lives inside board-wrap — keep panel tight to board width
  document.querySelectorAll('#screenVersus .player-panel').forEach(panel => {
    const board = panel.querySelector('.board');
    const wrap = panel.querySelector('.board-wrap');
    if (board) {
      const w = versusW + 'px';
      board.style.setProperty('width', w, 'important');
      if (wrap) {
        wrap.style.width = 'fit-content';
        wrap.style.maxWidth = '100%';
      }
      panel.style.width = 'fit-content';
      panel.style.maxWidth = '100%';
      panel.style.gap = '2px';
    }
  });

  // Scale piece trays proportionally to board cell size
  // Board cell ≈ width/8; tray cells ~42% of board cell so shapes match visually
  const classicCell = classicW / SIZE;
  const versusCell = versusW / SIZE;
  const classicPiece = Math.max(9, Math.min(22, Math.round(classicCell * 0.42)));
  const versusPiece = Math.max(8, Math.min(16, Math.round(versusCell * 0.42)));
  const classicSlot = Math.max(56, Math.min(110, classicPiece * 5 + 12));
  const versusSlot = Math.max(44, Math.min(78, versusPiece * 5 + 8));
  const oppPiece = Math.max(7, Math.min(12, Math.round(versusCell * 0.32)));
  const oppSlot = Math.max(36, Math.min(56, oppPiece * 4 + 8));

  document.documentElement.style.setProperty('--classic-piece', classicPiece + 'px');
  document.documentElement.style.setProperty('--classic-slot', classicSlot + 'px');
  document.documentElement.style.setProperty('--versus-piece', versusPiece + 'px');
  document.documentElement.style.setProperty('--versus-slot', versusSlot + 'px');
  document.documentElement.style.setProperty('--opp-piece', oppPiece + 'px');
  document.documentElement.style.setProperty('--opp-slot', oppSlot + 'px');

  // Apply slot sizes via style on active trays (overrides fixed CSS).
  // Only touch dimensions — never wipe/rebuild hand DOM here (that caused
  // unstable figures in classic + bot matches on every scale/resize pass).
  function _resizeTraySlots(selector, slotPx, cellPx) {
    document.querySelectorAll(selector).forEach(s => {
      if (s.classList.contains('used') || s.classList.contains('lifting')) return;
      s.style.width = slotPx + 'px';
      s.style.height = slotPx + 'px';
      s.style.minWidth = slotPx + 'px';
      // Scale inner piece-grid cells without full rebuild
      try {
        const grid = s.querySelector('.piece-grid');
        if (grid && cellPx > 0) {
          const cols = grid.style.gridTemplateColumns;
          if (cols && cols.indexOf('repeat') !== -1) {
            const m = cols.match(/repeat\((\d+)/);
            if (m) {
              grid.style.gridTemplateColumns = `repeat(${m[1]},${cellPx}px)`;
              grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace(/[\d.]+px/g, cellPx + 'px') ||
                `repeat(${m[1]},${cellPx}px)`;
            }
          }
          grid.querySelectorAll('.piece-cell').forEach(pc => {
            pc.style.width = cellPx + 'px';
            pc.style.height = cellPx + 'px';
          });
        }
      } catch (_) {}
    });
  }
  _resizeTraySlots('#screenClassic .piece-slot', classicSlot, classicPiece);
  _resizeTraySlots('#screenVersus .pieces-area:not(.opp-pieces) .piece-slot', versusSlot, versusPiece);
  _resizeTraySlots('#screenVersus .pieces-area.opp-pieces .piece-slot', oppSlot, oppPiece);

  renderScalePreviews();
  try {
    if (typeof updateBoardMetrics === 'function') {
      if (typeof boardEl !== 'undefined' && boardEl) updateBoardMetrics(boardEl);
      if (typeof boardMe !== 'undefined' && boardMe) updateBoardMetrics(boardMe);
      if (typeof boardOpp !== 'undefined' && boardOpp) updateBoardMetrics(boardOpp);
    }
  } catch (_) {}
  // Replay only: rebuild trays from match log. Live hands stay stable.
  try {
    if (typeof replayMode !== 'undefined' && replayMode) {
      if (typeof renderReplayTray === 'function') {
        const meA = document.getElementById('piecesAreaVs');
        const oppA = document.getElementById('piecesAreaOpp');
        if (meA && typeof replayMePieces !== 'undefined') renderReplayTray(meA, replayMePieces, false, false);
        if (oppA && typeof replayOppPieces !== 'undefined') renderReplayTray(oppA, replayOppPieces, true, false);
      }
    }
  } catch (_) {}
}
function setFitLock(on) {
  document.body.classList.toggle('fit-lock', !!on);
  if (on) applyBoardScales();
}
window.addEventListener('resize', () => {
  if (document.body.classList.contains('fit-lock')) applyBoardScales();
});
function applySettings() {
  applyBoardScales();
  const keepTouch = document.body.classList.contains('touch-ui');
  document.body.classList.remove('theme-ocean', 'theme-sunset', 'theme-mono', 'anim-off', 'anim-soft', 'no-floats', 'no-preview', 'big-text', 'hi-contrast');
  if (keepTouch) document.body.classList.add('touch-ui');
  if (settings.theme === 'ocean') document.body.classList.add('theme-ocean');
  if (settings.theme === 'sunset') document.body.classList.add('theme-sunset');
  if (settings.theme === 'mono') document.body.classList.add('theme-mono');
  if (settings.bigText === '1') document.body.classList.add('big-text');
  if (settings.hiContrast === '1') document.body.classList.add('hi-contrast');
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0f1115';
      meta.setAttribute('content', bg);
    }
  } catch (_) {}
  if (settings.anim === 'off') document.body.classList.add('anim-off');
  if (settings.anim === 'soft') document.body.classList.add('anim-soft');
  if (settings.floats === '0') document.body.classList.add('no-floats');
  // Placement preview removed from game
  document.body.classList.add('no-preview');
  if (false && settings.preview === '0') {
    document.body.classList.add('no-preview');
    try { clearPreview(); } catch (_) {}
  }
  if (settings.voice === '0' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }
  if (settings.music === '0') stopMusic(true);
  else {
    const active = document.querySelector('.screen.active');
    const id = active && active.id ? active.id.replace(/^screen/, '') : 'menu';
    const map = {
      Menu: 'menu', Classic: 'classic', Versus: 'versus', Settings: 'settings',
      Match: 'match', Friends: 'friends', History: 'history', Achievements: 'achievements',
      CompType: 'compType', Difficulty: 'difficulty', Duration: 'duration'
    };
    syncMusicToScreen(map[id] || 'menu');
    if (musicMaster && musicCtx) {
      const volMul = Math.max(0, Math.min(1, (parseInt(settings.musicVol, 10) || 50) / 100));
      const base = musicMode === 'battle' ? 0.22 : 0.16;
      try {
        musicMaster.gain.linearRampToValueAtTime(Math.max(0.0001, base * volMul), musicCtx.currentTime + 0.15);
      } catch (_) {}
    }
  }
  document.querySelectorAll('.set-chip').forEach(chip => {
    const key = chip.dataset.set;
    const val = chip.dataset.val;
    chip.classList.toggle('on', String(settings[key]) === String(val));
  });
  // Sync volume sliders
  const mv = parseInt(settings.musicVol, 10);
  const vv = parseInt(settings.voiceVol, 10);
  const mSlider = document.getElementById('musicVolSlider');
  const vSlider = document.getElementById('voiceVolSlider');
  const mLab = document.getElementById('musicVolLabel');
  const vLab = document.getElementById('voiceVolLabel');
  if (mSlider && !Number.isNaN(mv)) mSlider.value = String(mv);
  if (vSlider && !Number.isNaN(vv)) vSlider.value = String(vv);
  if (mLab) mLab.textContent = (Number.isNaN(mv) ? 50 : mv) + '%';
  if (vLab) vLab.textContent = (Number.isNaN(vv) ? 70 : vv) + '%';
}
// Warm up TTS voices (needed on some browsers)
if (window.speechSynthesis) {
  try { window.speechSynthesis.getVoices(); } catch (_) {}
  window.speechSynthesis.onvoiceschanged = () => {
    try { window.speechSynthesis.getVoices(); } catch (_) {}
  };
}

let _wakeLock = null;
async function requestWakeLock() {
  try {
    if (!settings || settings.keepAwake !== '1') return;
    if (!('wakeLock' in navigator)) return;
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => { _wakeLock = null; });
  } catch (_) { _wakeLock = null; }
}
async function releaseWakeLock() {
  try {
    if (_wakeLock) { await _wakeLock.release(); _wakeLock = null; }
  } catch (_) { _wakeLock = null; }
}

function hapticTap(ms) {
  if (settings.haptics !== '1') return;
  try {
    if (!navigator.vibrate) return;
    let d = ms || 12;
    // Phones: shorter pulses — long vibrate feels harsh
    if (document.body.classList.contains('touch-ui')) {
      d = Math.min(Math.max(4, Math.round(d * 0.45)), 10);
    }
    navigator.vibrate(d);
  } catch (_) {}
}
