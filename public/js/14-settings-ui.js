/**
 * Settings screen — tabs, volume, chips, back/reset.
 * Extracted from 11-private-rooms-ui.js so private rooms stay focused.
 * Runs in the shared IIFE scope (bundled after 11).
 */
document.getElementById('btnSettings')?.addEventListener('click', () => {
  navigateScreen('settings', () => { try { applySettings(); } catch (_) {} });
});

function switchSettingsTab(id) {
  const tabs = document.querySelectorAll('#settingsTabs .settings-tab');
  const secs = document.querySelectorAll('#screenSettings .settings-section[data-stab]');
  tabs.forEach(t => {
    const on = t.dataset.stab === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  secs.forEach(s => s.classList.toggle('active-tab', s.dataset.stab === id));
  const list = document.querySelector('#screenSettings .settings-list');
  if (list) list.scrollTop = 0;
  try { SFX.ui(); } catch (_) {}
}
document.getElementById('settingsTabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.settings-tab');
  if (!btn || !btn.dataset.stab) return;
  switchSettingsTab(btn.dataset.stab);
});

document.getElementById('btnSettingsBack')?.addEventListener('click', () => {
  navigateScreen('menu', () => {
    try { applySettings(); } catch (_) {}
    try { updateMenuStats(); } catch (_) {}
  });
});
document.getElementById('btnSettingsReset')?.addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  applySettings();
});
document.querySelectorAll('.set-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const key = chip.dataset.set;
    const val = chip.dataset.val;
    if (!key) return;
    settings[key] = val;
    saveSettings();
    applySettings();
    hapticTap(8);
    SFX.ui();
  });
});
function bindVolSlider(id, key, labelId) {
  const el = document.getElementById(id);
  if (!el) return;
  const applyVol = () => {
    settings[key] = String(el.value);
    saveSettings();
    const lab = document.getElementById(labelId);
    if (lab) lab.textContent = el.value + '%';
    if (key === 'musicVol' && musicMaster && musicCtx && settings.music === '1') {
      const volMul = Math.max(0, Math.min(1, parseInt(el.value, 10) / 100));
      const base = musicMode === 'battle' ? 0.22 : 0.16;
      try {
        musicMaster.gain.linearRampToValueAtTime(Math.max(0.0001, base * volMul), musicCtx.currentTime + 0.08);
      } catch (_) {}
    }
  };
  el.addEventListener('input', applyVol);
  el.addEventListener('change', applyVol);
}
bindVolSlider('musicVolSlider', 'musicVol', 'musicVolLabel');
bindVolSlider('voiceVolSlider', 'voiceVol', 'voiceVolLabel');
// Soft UI clicks + unlock AudioContext on first gesture
document.addEventListener('pointerdown', () => {
  try { ensureFriendPresence(); } catch (_) {}
  getSfxCtx();
  getMusicCtx();
  const active = document.querySelector('.screen.active');
  if (active && settings.music === '1') {
    const raw = (active.id || '').replace(/^screen/, '');
    const map = {
      Menu: 'menu', Classic: 'classic', Versus: 'versus', Settings: 'settings',
      Match: 'match', Friends: 'friends', History: 'history', Achievements: 'achievements',
      CompType: 'compType', Difficulty: 'difficulty', Duration: 'duration'
    };
    syncMusicToScreen(map[raw] || 'menu');
  }
}, { once: true, passive: true });
document.body.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('button, .menu-card, .bot-card, .history-item');
  if (btn) SFX.ui();
}, true);
applySettings();

