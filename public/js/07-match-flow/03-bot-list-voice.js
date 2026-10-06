/**
 * Block Puzzle — js/07-match-flow/03-bot-list-voice.js
 * Bot list and bot speech/voice.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function botTierLabel(t) {
  if (t < 200) return 'Новичок';
  if (t < 500) return 'Любитель';
  if (t < 1000) return 'Клубный';
  if (t < 1500) return 'Сильный / Эксперт';
  if (t < 2200) return 'Мастер';
  if (t < 3000) return 'Гроссмейстер';
  return 'Чемпион';
}

function renderBotList() {
  const list = document.getElementById('botList');
  const sorted = [...BOTS].sort((a, b) => a.trophies - b.trophies);
  // Soft stagger — ~5 cols, cap so last visible rows don't wait too long
  const maxI = 20;
  list.innerHTML = sorted.map((b, i) => `
    <div class="bot-card ${b.id === selectedBotId ? 'selected' : ''}" data-bot="${b.id}" style="--bot-i:${Math.min(i, maxI)}">
      <div class="bot-name">${b.name}</div>
      <div class="bot-icon">${botAvatarSVG(b, 44)}</div>
      <div class="bot-cups">🏆 ${b.trophies}</div>
      <div class="bot-title">${b.title || botTierLabel(b.trophies)}</div>
      ${botStarsHTML(b.id)}
    </div>
  `).join('');
  list.querySelectorAll('.bot-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedBotId = card.dataset.bot;
      currentBot = BOTS.find(b => b.id === selectedBotId);
      renderBotList();
    });
  });
}

let speechTimer = null;
let lastPhraseAt = 0;
let lastPhraseKind = '';
const PHRASE_COOLDOWN_MS = 9000; // rarer lines
function botVoiceProfile(bot) {
  // gender: 'f' | 'm' — slower rates so speech is clear
  const id = (bot && bot.id) || '';
  const map = {
    nugget:  { gender: 'm', rate: 0.78, pitch: 1.15, volume: 0.9 },
    pawz:    { gender: 'f', rate: 0.8,  pitch: 1.28, volume: 0.88 },
    spark:   { gender: 'm', rate: 0.88, pitch: 1.12, volume: 0.9 },
    bloom:   { gender: 'f', rate: 0.76, pitch: 1.18, volume: 0.86 },
    glitch:  { gender: 'm', rate: 0.85, pitch: 0.88, volume: 0.84 },
    brutus:  { gender: 'm', rate: 0.72, pitch: 0.72, volume: 0.92 },
    nova:    { gender: 'f', rate: 0.82, pitch: 1.12, volume: 0.88 },
    hex:     { gender: 'm', rate: 0.8,  pitch: 0.95, volume: 0.86 },
    drift:   { gender: 'm', rate: 0.84, pitch: 1.0,  volume: 0.87 },
    pulse:   { gender: 'f', rate: 0.86, pitch: 1.08, volume: 0.88 },
    vortex:  { gender: 'm', rate: 0.8,  pitch: 0.88, volume: 0.86 },
    ember:   { gender: 'f', rate: 0.8,  pitch: 1.1,  volume: 0.9 },
    aurora:  { gender: 'f', rate: 0.76, pitch: 1.2,  volume: 0.85 },
    gravity: { gender: 'm', rate: 0.7,  pitch: 0.68, volume: 0.9 },
    obelisk: { gender: 'm', rate: 0.68, pitch: 0.62, volume: 0.9 },
    oracle:  { gender: 'f', rate: 0.74, pitch: 0.98, volume: 0.85 },
    apex:    { gender: 'm', rate: 0.75, pitch: 0.78, volume: 0.92 }
  };
  return map[id] || { gender: 'm', rate: 0.8, pitch: 1.0, volume: 0.88 };
}
function polishRussianSpeech(text) {
  // ё helps stress; combining accents often BREAK iOS/Android TTS — strip them
  let out = String(text).replace(/\u0301/g, '');
  // Strip symbols TTS would pronounce awkwardly (/, (), =, >, <, :, etc.)
  out = out
    .replace(/[\/\\|]/g, ' ')
    .replace(/[()\[\]{}<>]/g, ' ')
    .replace(/[=+*_#@&:;]/g, ' ')
    .replace(/\b(vs)\b/gi, 'против')
    .replace(/\b(null|true|false)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fixes = [
    [/еще\b/gi, 'ещё'], [/ее\b/gi, 'её'], [/счет/gi, 'счёт'],
    [/пойдет/gi, 'пойдёт'], [/придет/gi, 'придёт'], [/ждет/gi, 'ждёт'],
    [/начнет/gi, 'начнёт'], [/взлет/gi, 'взлёт'], [/тверд/gi, 'твёрд'],
    [/черн/gi, 'чёрн'], [/тяжел/gi, 'тяжёл']
  ];
  fixes.forEach(([re, rep]) => { out = out.replace(re, rep); });
  return out;
}
function classifyVoiceGender(v) {
  const n = ((v && v.name) || '') + ' ' + ((v && v.voiceURI) || '');
  if (/female|woman|girl|женск|milena|katya|katia|irina|tanya|tatyana|elena|oksana|samantha|karen|moira|fiona|victoria|zira|susan|hannah|allison|ava|serena|microsoft.*(irina|elena)/i.test(n)) return 'f';
  if (/male|man|boy|мужск|yuri|yury|yuriy|dmitri|dmitry|pavel|alexander|aleksandr|ivan|nikolai|sergey|microsoft.*(pavel|dmitri)|daniel|thomas|alex|aaron|jorge|diego|fred|bruce/i.test(n)) return 'm';
  return 'u';
}
function pickVoiceForGender(gender) {
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const ru = voices.filter(v => /ru(-|_|$)/i.test(v.lang) || /russian|русский/i.test(v.name || ''));
  const tagged = (ru.length ? ru : voices).map(v => ({ v, g: classifyVoiceGender(v) }));
  const exact = tagged.filter(t => t.g === gender).map(t => t.v);
  if (exact.length) return exact[0];
  // Prefer any non-opposite gender if possible
  if (gender === 'm') {
    const notF = tagged.filter(t => t.g !== 'f').map(t => t.v);
    if (notF.length) return notF[0];
  }
  return (ru[0] || voices[0] || null);
}
function speakBotText(text) {
  if (settings.voice === '0') return;
  if (!window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const spoken = polishRussianSpeech(String(text))
      .replace(/…/g, '... ')
      .replace(/—/g, ', ')
      .replace(/([.!?])\s*/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();
    const u = new SpeechSynthesisUtterance(spoken);
    const prof = botVoiceProfile(currentBot);
    const gender = prof.gender === 'f' ? 'f' : 'm';
    const voice = pickVoiceForGender(gender);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'ru-RU';
    } else {
      u.lang = 'ru-RU';
    }
    // iPhone often has only Milena (female). Simulate male with very low pitch.
    if (gender === 'm') {
      u.rate = Math.max(0.55, Math.min(0.88, (prof.rate || 0.78) * 0.92));
      u.pitch = Math.max(0.1, Math.min(0.7, (prof.pitch || 0.75) * 0.55));
    } else {
      u.rate = Math.max(0.6, Math.min(0.95, prof.rate || 0.8));
      u.pitch = Math.max(1.1, Math.min(1.6, Math.max(prof.pitch || 1.15, 1.15)));
    }
    const vMul = Math.max(0, Math.min(1, (parseInt(settings.voiceVol, 10) || 70) / 100));
    u.volume = Math.max(0.05, Math.min(1, (prof.volume || 0.9) * vMul));
    window.speechSynthesis.speak(u);
  } catch (_) {}
}
function showBotPhrase(kind, force) {
  if (settings.speech === '0' && settings.voice === '0') return;
  if (!currentBot || !currentBot.phrases) return;
  const list = currentBot.phrases[kind];
  if (!list || !list.length) return;
  const now = Date.now();
  // Always allow start/win/lose; throttle mid-game chatter
  const important = kind === 'start' || kind === 'win' || kind === 'lose';
  if (!force && !important) {
    if (now - lastPhraseAt < PHRASE_COOLDOWN_MS) return;
    if (kind === lastPhraseKind && now - lastPhraseAt < PHRASE_COOLDOWN_MS * 1.5) return;
  }
  lastPhraseAt = now;
  lastPhraseKind = kind;
  const text = list[Math.floor(Math.random() * list.length)];
  if (settings.speech !== '0') {
    const el = document.getElementById('botSpeech');
    if (el) {
      const nameEl = el.querySelector('.bot-speech-name');
      const textEl = el.querySelector('.bot-speech-text');
      if (nameEl) nameEl.textContent = currentBot.name + ':';
      if (textEl) textEl.textContent = ' ' + text;
      el.classList.add('visible');
      if (speechTimer) clearTimeout(speechTimer);
      speechTimer = setTimeout(() => el.classList.remove('visible'), 2600);
    }
  }
  speakBotText(text);
}
