/**
 * Block Puzzle — 02-bots-achievements-settings/02-bots-logic-avatars.js
 * Bot combat profile resolution and bot avatars.
 * Shares one IIFE scope with the other public/js modules (see modules.json; ORDER MATTERS).
 */
'use strict';

/** Unique hand-crafted SVG avatar per bot palette */

/**
 * Combat stats driven by trophies so higher-cup bots are consistently stronger.
 * Catalog skill/mistake/interval are display seeds; runtime uses this curve.
 * trophies ~40 → weak, ~3800 → near-perfect.
 */
function resolveBotCombat(bot) {
  const b = bot || {};
  const tMin = 40, tMax = 3800;
  let t = typeof b.trophies === 'number' ? b.trophies : 200;
  if (t < tMin) t = tMin;
  if (t > tMax) t = tMax;
  // Power curve (γ≈0.55): mid ranks (200→1000→2000) feel clearly different.
  // Smoothstep was almost flat below ~1500 trophies, so 200≈1000 in pace/skill.
  const x = (t - tMin) / (tMax - tMin);
  const n = Math.pow(x, 0.55);
  // Skill: novices often miss best cell; masters almost always take it
  const skill = Math.min(0.995, 0.10 + n * 0.89);         // ~0.10 → 0.99
  // Hesitation / soft skip chance (applied in aiTick)
  const mistake = Math.max(0.006, 0.42 * (1 - n * 0.98));  // ~0.42 → ~0.01
  // Think time between move starts (ms). Wider spread by rank:
  //   ~40→2100 | ~200→1750 | ~1000→1100 | ~2000→750 | ~3800→480
  const interval = Math.round(2100 - n * 1620);            // 2100 → 480
  // Stronger bots hunt clears harder and tolerate risk
  const clearBias = 0.18 + n * 0.78;
  const risk = Math.max(0.06, 0.82 - n * 0.72);
  // Weak bots jitter a lot; masters are steady
  const speedJitter = Math.max(0.04, 0.40 * (1 - n * 0.95));
  const preferSmall = 1.20 - n * 0.45;
  return {
    skill,
    mistake,
    interval,
    style: {
      clearBias,
      risk,
      speedJitter,
      preferSmall,
      ...(b.style || {})
    },
    // keep identity fields
    id: b.id,
    name: b.name,
    trophies: b.trophies,
    title: b.title,
    av: b.av,
    phrases: b.phrases
  };
}

function botAvatarSVG(bot, size = 48) {
  const [bg, skin, acc, eye] = bot.av || ['#333','#888','#666','#111'];
  // hash id for slight shape variety
  let h = 0;
  for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) | 0;
  const face = Math.abs(h) % 5;
  const eyeY = 20 + (Math.abs(h >> 3) % 3);
  const eyeGap = 6 + (Math.abs(h >> 5) % 3);
  const mouth = Math.abs(h >> 7) % 4;
  let mouthPath = '';
  if (mouth === 0) mouthPath = `<path d="M18 30 Q24 34 30 30" stroke="${eye}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  else if (mouth === 1) mouthPath = `<path d="M19 31 Q24 28 29 31" stroke="${eye}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  else if (mouth === 2) mouthPath = `<circle cx="24" cy="31" r="1.4" fill="${eye}"/>`;
  else mouthPath = `<path d="M20 30 H28" stroke="${eye}" stroke-width="1.5" stroke-linecap="round"/>`;

  let accessory = '';
  if (face === 0) accessory = `<path d="M12 14 Q24 6 36 14" stroke="${acc}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`; // brow arc
  else if (face === 1) accessory = `<rect x="14" y="8" width="20" height="5" rx="2" fill="${acc}"/>`; // headband
  else if (face === 2) accessory = `<circle cx="24" cy="9" r="3" fill="${acc}"/><circle cx="24" cy="9" r="1.2" fill="${bg}"/>`; // gem
  else if (face === 3) accessory = `<path d="M16 12 L24 7 L32 12" stroke="${acc}" stroke-width="2" fill="none" stroke-linejoin="round"/>`; // crown tip
  else accessory = `<rect x="15" y="16" width="18" height="3" rx="1" fill="${acc}" opacity="0.7"/>`; // visor

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">
    <rect width="48" height="48" rx="12" fill="${bg}"/>
    <circle cx="24" cy="24" r="14" fill="${skin}"/>
    ${accessory}
    <circle cx="${24 - eyeGap}" cy="${eyeY}" r="2.2" fill="${eye}"/>
    <circle cx="${24 + eyeGap}" cy="${eyeY}" r="2.2" fill="${eye}"/>
    <circle cx="${24 - eyeGap + 0.6}" cy="${eyeY - 0.5}" r="0.7" fill="#fff" opacity="0.85"/>
    <circle cx="${24 + eyeGap + 0.6}" cy="${eyeY - 0.5}" r="0.7" fill="#fff" opacity="0.85"/>
    ${mouthPath}
  </svg>`;
}

function botAvatarHTML(bot, size = 48) {
  return `<span class="bot-avatar" style="width:${size}px;height:${size}px;border-radius:${size > 40 ? 14 : 8}px">${botAvatarSVG(bot, size)}</span>`;
}
