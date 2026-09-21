/**
 * Block Puzzle — 03-audio.js
 * Procedural SFX and background music
 * Lines ~1987-2455 from legacy game.js monolith (refactored).
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

// —— Varied short procedural SFX ——
let sfxCtx = null;
const sfxRand = (a, b) => a + Math.random() * (b - a);
function getSfxCtx() {
  if (settings.sfx !== '1') return null;
  try {
    if (!sfxCtx) sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (sfxCtx.state === 'suspended') sfxCtx.resume();
    return sfxCtx;
  } catch (_) {
    return null;
  }
}
function sfxTone(freq, dur, type, vol, slideTo, delay) {
  const ctx = getSfxCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = sfxRand(2800, 5200);
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  const v = (vol == null ? 0.04 : vol);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}
function sfxNoise(dur, vol, freq, q) {
  const ctx = getSfxCtx();
  if (!ctx) return;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq || sfxRand(900, 1800);
  filter.Q.value = q == null ? 0.9 : q;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime;
  const v = vol == null ? 0.03 : vol;
  gain.gain.setValueAtTime(v, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}
let placeVariant = 0;
const SFX = {
  ui() {
    const f = sfxRand(520, 780);
    sfxTone(f, 0.028, Math.random() < 0.5 ? 'triangle' : 'sine', 0.022, f * sfxRand(1.05, 1.2));
  },
  pick() {
    const f = sfxRand(360, 480);
    sfxTone(f, 0.035, 'sine', 0.028, f * sfxRand(1.15, 1.35));
    sfxTone(f * 1.5, 0.025, 'triangle', 0.012, null, 0.012);
  },
  place() {
    placeVariant = (placeVariant + 1) % 4;
    const bases = [160, 190, 210, 175];
    const f = bases[placeVariant] * sfxRand(0.96, 1.06);
    sfxTone(f, 0.045, 'triangle', 0.032, f * 0.7);
    sfxTone(f * 2.1, 0.03, 'sine', 0.012, null, 0.01);
    sfxNoise(0.028, 0.016, sfxRand(700, 1400), 0.7);
  },
  bad() {
    sfxTone(sfxRand(110, 150), 0.07, 'sine', 0.022, sfxRand(70, 100));
    sfxNoise(0.04, 0.012, 400, 0.5);
  },
  clear(n) {
    const steps = Math.min(4, Math.max(1, n || 1));
    const root = sfxRand(480, 560);
    for (let i = 0; i < steps; i++) {
      sfxTone(root + i * sfxRand(70, 100), 0.045, i % 2 ? 'triangle' : 'sine', 0.026, null, i * 0.03);
    }
    sfxNoise(0.05 + steps * 0.01, 0.02, sfxRand(1100, 2000), 1.1);
  },
  combo() {
    const root = sfxRand(600, 700);
    sfxTone(root, 0.05, 'triangle', 0.03, root * 1.3);
    sfxTone(root * 1.25, 0.06, 'sine', 0.024, root * 1.5, 0.04);
    sfxTone(root * 1.5, 0.07, 'sine', 0.02, root * 1.8, 0.09);
    sfxNoise(0.06, 0.018, 1600, 1.2);
  },
  win() {
    const notes = [523, 659, 784, 1046].map(n => n * sfxRand(0.99, 1.01));
    notes.forEach((f, i) => sfxTone(f, 0.09, i % 2 ? 'triangle' : 'sine', 0.028 - i * 0.003, null, i * 0.07));
  },
  lose() {
    sfxTone(sfxRand(280, 320), 0.12, 'triangle', 0.03, sfxRand(120, 160));
    sfxTone(sfxRand(200, 240), 0.1, 'sine', 0.018, 100, 0.05);
  },
  tick() {
    sfxTone(sfxRand(820, 940), 0.022, Math.random() < 0.4 ? 'square' : 'triangle', 0.011);
  }
};

// —— Soft background music (procedural, no files) ——
let musicCtx = null;
let musicMode = null; // 'calm' | 'battle' | null
let musicTimer = null;
let musicMaster = null;
let musicStep = 0;

function getMusicCtx() {
  if (settings.music !== '1') return null;
  try {
    if (!musicCtx) musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (musicCtx.state === 'suspended') musicCtx.resume();
    return musicCtx;
  } catch (_) {
    return null;
  }
}
function stopMusic(fade) {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicMaster && musicCtx) {
    try {
      const t = musicCtx.currentTime;
      musicMaster.gain.cancelScheduledValues(t);
      musicMaster.gain.setValueAtTime(musicMaster.gain.value, t);
      musicMaster.gain.linearRampToValueAtTime(0.0001, t + (fade ? 0.4 : 0.05));
    } catch (_) {}
  }
  musicMode = null;
  musicStep = 0;
}
function musicNote(freq, dur, type, vol, t0) {
  const ctx = musicCtx;
  if (!ctx || !musicMaster) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = type === 'square' ? 1200 : 2400;
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const v = vol || 0.06;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(v, t0 + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(musicMaster);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
function startMusic(modeName) {
  if (settings.music !== '1') {
    stopMusic(true);
    return;
  }
  if (musicMode === modeName && musicTimer) return;
  stopMusic(false);
  const ctx = getMusicCtx();
  if (!ctx) return;
  musicMode = modeName;
  musicMaster = ctx.createGain();
  musicMaster.gain.value = 0.0001;
  musicMaster.connect(ctx.destination);
  const volMul = Math.max(0, Math.min(1, (parseInt(settings.musicVol, 10) || 50) / 100));
  const targetVol = (modeName === 'battle' ? 0.22 : 0.16) * volMul;
  musicMaster.gain.linearRampToValueAtTime(Math.max(0.0001, targetVol), ctx.currentTime + 0.6);

  // Calm: soft major/pentatonic pad loop
  // Battle: minor pulse, slightly more rhythmic
  const calmNotes = [196, 220, 247, 294, 330, 392, 440]; // G A B D E G A
  const battleNotes = [165, 196, 208, 247, 262, 311, 330]; // E G Ab B C Eb E
  const interval = modeName === 'battle' ? 420 : 520;

  musicTimer = setInterval(() => {
    if (settings.music !== '1' || !musicCtx || !musicMaster) return;
    const t0 = musicCtx.currentTime;
    const scale = modeName === 'battle' ? battleNotes : calmNotes;
    if (modeName === 'calm') {
      // ambient chords + soft melody
      const root = scale[musicStep % 4];
      musicNote(root, 1.4, 'sine', 0.055, t0);
      musicNote(root * 1.5, 1.2, 'triangle', 0.028, t0 + 0.05);
      if (musicStep % 2 === 0) {
        const m = scale[3 + (musicStep % 4)];
        musicNote(m, 0.7, 'sine', 0.032, t0 + 0.15);
      }
    } else {
      // battle: low pulse + sparse tense motif
      const root = scale[musicStep % 3];
      musicNote(root * 0.5, 0.35, 'triangle', 0.06, t0);
      musicNote(root, 0.28, 'sine', 0.04, t0);
      if (musicStep % 2 === 1) {
        musicNote(scale[(musicStep + 2) % scale.length], 0.25, 'triangle', 0.036, t0 + 0.12);
      }
      if (musicStep % 4 === 0) {
        musicNote(scale[5] * 0.5, 0.5, 'sine', 0.044, t0);
      }
    }
    musicStep++;
  }, interval);
}
function syncMusicToScreen(name) {
  if (settings.music !== '1') {
    stopMusic(true);
    return;
  }
  if (name === 'versus' || name === 'match') startMusic('battle');
  else if (name === 'classic' || name === 'menu' || name === 'settings' || name === 'achievements' ||
           name === 'history' || name === 'friends' || name === 'compType' || name === 'difficulty' ||
           name === 'duration') startMusic('calm');
  else startMusic('calm');
}

let mode = 'menu';
let grid = [], score = 0;
let best = parseInt(localStorage.getItem('bp_best')||'0',10); if (!Number.isFinite(best) || best < 0) best = 0;
let rankedBest = parseInt(localStorage.getItem('bp_ranked_best')||'0',10); if (!Number.isFinite(rankedBest) || rankedBest < 0) rankedBest = 0;
// TEST: plenty of diamonds for testing
let diamonds = parseInt(localStorage.getItem('bp_diamonds')||'9999',10); if (!Number.isFinite(diamonds) || diamonds < 0) diamonds = 9999;
if (diamonds < 9999) { diamonds = 9999; try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {} }
let trophies = parseInt(localStorage.getItem('bp_trophies')||'0',10); if (!Number.isFinite(trophies) || trophies < 0) trophies = 0;
let pieces = [], selectedIdx = -1, dragPiece = null, isDragging = false;
let lastPreview = null, boardRect = null, cellSize = 0, gap = 3;
let rafId = 0, pointerX = 0, pointerY = 0, placingLock = false;
let vsDuration = 120, vsTimeLeft = 120, vsTimerId = null;
let oppGrid = [], oppScore = 0, oppName = 'Соперник', oppPieces = [];
let aiInterval = null, vsActive = false, aiBusy = false;
let clearChain = 0;      // consecutive clears by local player
let oppClearChain = 0;   // consecutive clears by opponent / bot
let selectedBotId = 'nova';
// bot stars: { botId: { '60': true, '120': true, '180': true } }
let botStars = {};
try { botStars = JSON.parse(localStorage.getItem('bp_bot_stars') || '{}'); } catch (_) { botStars = {}; }
function saveBotStars() {
  try { localStorage.setItem('bp_bot_stars', JSON.stringify(botStars)); } catch (_) {}
}
function starKeyForDuration(sec) {
  const s = parseInt(sec, 10) || 120;
  if (s <= 60) return '60';
  if (s <= 120) return '120';
  return '180';
}
function getBotStarCount(botId) {
  const st = botStars[botId] || {};
  return (st['60'] ? 1 : 0) + (st['120'] ? 1 : 0) + (st['180'] ? 1 : 0);
}
function botHasStar(botId, sec) {
  const st = botStars[botId] || {};
  return !!st[starKeyForDuration(sec)];
}
function awardBotStar(botId, sec) {
  if (!botId) return false;
  const key = starKeyForDuration(sec);
  if (!botStars[botId]) botStars[botId] = {};
  if (botStars[botId][key]) return false;
  botStars[botId][key] = true;
  saveBotStars();
  try { checkNewAchievements(); } catch (_) {}
  return true;
}
function botStarsHTML(botId) {
  const st = botStars[botId] || {};
  const slots = [
    { k: '60', title: '1 мин' },
    { k: '120', title: '2 мин' },
    { k: '180', title: '3 мин' }
  ];
  return '<div class="bot-stars" title="☆ серебряная звезда за победу на 1, 2 или 3 мин">' +
    slots.map(s => `<span class="${st[s.k] ? 'on' : ''}" title="${s.title}">☆</span>`).join('') +
    '</div>';
}
let currentBot = BOTS.find(b => b.id === 'nova');
let vsModeType = 'online'; // online | bots
let playerStuck = false, aiStuck = false;
let matchLog = []; // deal | place events with t (ms from match start)
let matchStartTs = 0;
let replayMode = false;
/** 'history' | 'result' | 'menu' */
let replayReturnTo = 'history';
let replayData = null;
let replayIndex = 0;
let replayTimer = null;
let replayMePieces = [];
let replayOppPieces = [];
let replaySpeed = 1;
let replayClockMs = 0;

// Persistent achievement progress
let achProgress = {};
try { achProgress = JSON.parse(localStorage.getItem('bp_ach') || '{}'); } catch (_) { achProgress = {}; }
function saveAch() { localStorage.setItem('bp_ach', JSON.stringify(achProgress)); }
function getAchStat(key) { return achProgress[key] || 0; }
function setAchStat(key, val) { achProgress[key] = val; saveAch(); checkNewAchievements(); }
function bumpAchStat(key, by = 1) {
  achProgress[key] = (achProgress[key] || 0) + by;
  saveAch();
  checkNewAchievements();
}
function countClaimableAchievements() {
  return ACHIEVEMENTS.filter(a => achReadyToClaim(a)).length;
}
function updateAchievementsButton() {
  const btn = document.getElementById('btnAchievements');
  if (!btn) return;
  const n = countClaimableAchievements();
  let badge = btn.querySelector('.ach-badge');
  if (n > 0) {
    btn.classList.add('has-claim');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'ach-badge';
      btn.appendChild(badge);
    }
    badge.textContent = n > 9 ? '9+' : String(n);
  } else {
    btn.classList.remove('has-claim');
    if (badge) badge.remove();
  }
}
let achToastTimers = [];
let achToastQueue = [];
let achToastBusy = false;

function clearAchToastTimers() {
  achToastTimers.forEach(t => clearTimeout(t));
  achToastTimers = [];
}
function scheduleAch(fn, ms) {
  const id = setTimeout(fn, ms);
  achToastTimers.push(id);
  return id;
}

function ensureAchToastEl() {
  let el = document.getElementById('achToast');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'achToast';
  el.className = 'ach-toast';
  el.innerHTML = `
    <div class="ach-toast-head">
      <span class="ach-toast-label">Достижение</span>
      <span class="ach-toast-reward"></span>
    </div>
    <div class="ach-toast-title"></div>
    <div class="ach-toast-desc"></div>
    <div class="ach-toast-bar"><i></i></div>
    <div class="ach-toast-status"><span class="pop">✓</span><span class="msg">Выполняется…</span></div>
  `;
  document.body.appendChild(el);
  return el;
}

function runAchievementToast(ach) {
  const el = ensureAchToastEl();
  clearAchToastTimers();
  el.classList.remove('in', 'out', 'complete', 'shine');
  void el.offsetWidth;

  el.querySelector('.ach-toast-title').textContent = ach ? ach.title : 'Достижение';
  el.querySelector('.ach-toast-desc').textContent = ach ? (ach.desc || '') : '';
  el.querySelector('.ach-toast-reward').textContent = ach ? `+${ach.reward} 💎` : '';
  el.querySelector('.ach-toast-status .msg').textContent = 'Выполняется…';
  const bar = el.querySelector('.ach-toast-bar > i');
  bar.style.transition = 'none';
  bar.style.width = '12%';
  void bar.offsetWidth;
  bar.style.transition = '';

  // 1) Slide in from the right
  el.classList.add('in');
  try { SFX.ui(); hapticTap(10); } catch (_) {}

  // 2) Fill progress → complete state
  scheduleAch(() => {
    bar.style.width = '100%';
  }, 280);
  scheduleAch(() => {
    el.classList.add('complete', 'shine');
    el.querySelector('.ach-toast-status .msg').textContent = 'Выполнено · забери награду';
    try { hapticTap(16); } catch (_) {}
  }, 950);

  // 3) Hold, then slide out
  scheduleAch(() => {
    el.classList.remove('in');
    el.classList.add('out');
  }, 2600);
  scheduleAch(() => {
    el.classList.remove('out', 'complete', 'shine', 'in');
    bar.style.width = '0%';
    achToastBusy = false;
    playNextAchToast();
  }, 3050);
}

function playNextAchToast() {
  if (achToastBusy) return;
  const next = achToastQueue.shift();
  if (!next) {
    updateAchievementsButton();
    return;
  }
  achToastBusy = true;
  runAchievementToast(next);
}

function showAchievementToast(ach) {
  achToastQueue.push(ach);
  updateAchievementsButton();
  playNextAchToast();
}

function checkNewAchievements() {
  let any = false;
  for (const ach of ACHIEVEMENTS) {
    if (achProgress['claimed_' + ach.id]) continue;
    if (!achIsDone(ach)) continue;
    const flag = 'notified_' + ach.id;
    if (achProgress[flag]) continue;
    achProgress[flag] = 1;
    any = true;
    showAchievementToast(ach);
  }
  if (any) saveAch();
  else updateAchievementsButton();
}

let matchHistory = [];
try { matchHistory = JSON.parse(localStorage.getItem('bp_history') || '[]'); } catch (_) { matchHistory = []; }
// Backfill ranked score record from past online matches
try {
  let maxR = rankedBest | 0;
  (matchHistory || []).forEach(h => {
    if (h && h.mode === 'online' && typeof h.my === 'number' && h.my > maxR) maxR = h.my;
  });
  if (maxR > rankedBest) {
    rankedBest = maxR;
    localStorage.setItem('bp_ranked_best', String(rankedBest));
  }
} catch (_) {}

// Friends system
function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
let myFriendCode = localStorage.getItem('bp_my_code');
if (!myFriendCode) {
  myFriendCode = genCode(6);
  localStorage.setItem('bp_my_code', myFriendCode);
}
let myNickname = localStorage.getItem('bp_nickname') || ('Player' + myFriendCode.slice(0, 3));

