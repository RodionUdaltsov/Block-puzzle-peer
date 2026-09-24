/**
 * Block Puzzle — shared skin palettes (server + client source of truth for colors).
 * Client UI catalog (names, prices) lives in public/js/01-cosmetics.js and must
 * keep the same id → colors mapping.
 */
'use strict';

const SKIN_PALETTES = {
  default: ['#00d4aa', '#7c5cff', '#ff5c7a', '#ffb347', '#4fc3f7', '#ff6bcb', '#a8e063', '#ff8a65'],
  ocean: ['#00c2ff', '#0077b6', '#48cae4', '#90e0ef', '#023e8a', '#0096c7', '#ade8f4', '#5ee7ff'],
  forest: ['#2d6a4f', '#40916c', '#52b788', '#95d5b2', '#d8f3dc', '#b7e4c7', '#74c69d', '#ffb703'],
  mono: ['#e8eaed', '#cfd8e3', '#9aa0a6', '#8b9bb0', '#d7dee8', '#b0b8c4', '#6b7280', '#a1a1aa'],
  sunset: ['#ff6b35', '#f7c59f', '#ef476f', '#ffd166', '#ff8fab', '#ff9f1c', '#e36414', '#c9184a'],
  neon: ['#39ff14', '#ff00ff', '#00f5ff', '#ffe600', '#ff3d81', '#7b61ff', '#00ffc6', '#ff9f1c'],
  candy: ['#ff8fab', '#ffc2d1', '#bde0fe', '#a2d2ff', '#cdb4db', '#ffd6a5', '#fdffb6', '#caffbf'],
  ice: ['#e0f7ff', '#a5f3fc', '#67e8f9', '#22d3ee', '#0891b2', '#7dd3fc', '#bae6fd', '#38bdf8'],
  lava: ['#ff4500', '#ff6a00', '#ff8c00', '#ffd166', '#c1121f', '#e85d04', '#faa307', '#9d0208'],
  royal: ['#7b2cbf', '#c77dff', '#ffd700', '#5a189a', '#4cc9f0', '#f72585', '#4361ee', '#f4a261'],
  aurora: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440', '#80ed99', '#56cfe1', '#7209b7'],
  sakura: ['#ffb7c5', '#ff8fab', '#ffc2d1', '#fb6f92', '#ffccd5', '#e5989b', '#ff99ac', '#f7a1c4'],
  cyber: ['#0aff99', '#00ffc8', '#7b2ff7', '#f72585', '#3a0ca3', '#4cc9f0', '#b8f2e6', '#ff006e'],
  midnight: ['#1b263b', '#415a77', '#778da9', '#e0e1dd', '#0d1b2a', '#7c5cff', '#5ee7ff', '#c9ada7'],
  gold: ['#ffd700', '#ffc300', '#ffb703', '#f4a261', '#e9c46a', '#daa520', '#ffdb58', '#ffe566'],
  toxic: ['#39ff14', '#b8ff3c', '#ccff00', '#76ff03', '#1b5e20', '#00e676', '#aeea00', '#64dd17']
};

function paletteForSkin(skinId) {
  const id = skinId ? String(skinId) : 'default';
  return SKIN_PALETTES[id] || SKIN_PALETTES.default;
}

function knownSkinIds() {
  return Object.keys(SKIN_PALETTES);
}

module.exports = { SKIN_PALETTES, paletteForSkin, knownSkinIds };
