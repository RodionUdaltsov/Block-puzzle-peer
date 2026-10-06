/**
 * Block Puzzle — js/11-lobby-versus-replay/10-shop-inventory-screens.js
 * Shop and inventory screens.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
// Shop & Inventory are separate screens (no cross-tabs)
const _shopToInv = document.getElementById('btnShopToInv');
if (_shopToInv) _shopToInv.addEventListener('click', () => {
  navigateScreen('inventory', () => {
    try { closeShopInvSections(); } catch (_) {}
    try { renderInvGrid(); } catch (_) {}
  });
});
const _invToShop = document.getElementById('btnInvToShop');
if (_invToShop) _invToShop.addEventListener('click', () => {
  navigateScreen('shop', () => {
    try { closeShopInvSections(); } catch (_) {}
    try { renderShopGrid(); } catch (_) {}
  });
});


document.getElementById('profileAvatarFile')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = await compressAvatarFile(file);
    profileDraft.custom = data;
    profileDraft.avatarId = 'custom';
    renderProfileAvatarGrid();
    renderAvatarInto(document.getElementById('profileAvBig'), {
      avatarId: 'custom',
      nick: profileDraft.nick || myNickname,
      custom: data,
      big: true
    });
    try { SFX.ui(); hapticTap(10); } catch (_) {}
  } catch (err) {
    try {
      const t = document.getElementById('infoToast');
      if (t) {
        document.getElementById('infoToastLabel').textContent = (typeof globalThis.t==='function'?globalThis.t('js.avatar','Аватар'):'Аватар');
        document.getElementById('infoToastText').textContent = (err && err.message) || (typeof globalThis.t==='function'?globalThis.t('js.loadError','Ошибка загрузки'):'Ошибка загрузки');
        t.classList.add('visible');
        clearTimeout(t._hide);
        t._hide = setTimeout(() => t.classList.remove('visible'), 2600);
      }
    } catch (_) {}
  }
});

document.getElementById('btnHomeProfile')?.addEventListener('click', () => {
  try { SFX.ui(); } catch (_) {}
  openProfileScreen();
});
document.getElementById('btnProfileBack')?.addEventListener('click', () => {
  navigateScreen('menu', () => {
    try { updateMenuStats(); } catch (_) {}
    try { refreshProfileUI(); } catch (_) {}
  });
});
document.getElementById('btnProfileSave')?.addEventListener('click', () => {
  const nickIn = document.getElementById('profileNickInput');
  const stIn = document.getElementById('profileStatusInput');
  profileDraft.nick = nickIn ? nickIn.value : myNickname;
  profileDraft.status = stIn ? stIn.value : myStatus;
  const res = saveProfile({
    nick: profileDraft.nick,
    avatarId: profileDraft.avatarId,
    status: profileDraft.status,
    custom: profileDraft.custom != null ? profileDraft.custom : myAvatarCustom
  });
  if (!res.ok) {
    try {
      const t = document.getElementById('infoToast');
      if (t) {
        document.getElementById('infoToastLabel').textContent = (typeof globalThis.t==='function'?globalThis.t('js.profile','Профиль'):'Профиль');
        document.getElementById('infoToastText').textContent = res.err || (typeof globalThis.t==='function'?globalThis.t('js.error','Ошибка'):'Ошибка');
        t.classList.add('visible');
        clearTimeout(t._hide);
        t._hide = setTimeout(() => t.classList.remove('visible'), 2400);
      }
    } catch (_) {}
    return;
  }
  try { SFX.ui(); hapticTap(12); } catch (_) {}
  try {
    const t = document.getElementById('infoToast');
    if (t) {
      document.getElementById('infoToastLabel').textContent = (typeof globalThis.t==='function'?globalThis.t('js.profile','Профиль'):'Профиль');
      document.getElementById('infoToastText').textContent = (typeof globalThis.t==='function'?globalThis.t('js.saved','Сохранено'):'Сохранено');
      t.classList.add('visible');
      clearTimeout(t._hide);
      t._hide = setTimeout(() => t.classList.remove('visible'), 1800);
    }
  } catch (_) {}
});
document.getElementById('btnProfileCopyCode')?.addEventListener('click', () => {
  try { copyText(myFriendCode); } catch (_) {}
  try { SFX.ui(); } catch (_) {}
  try {
    const t = document.getElementById('infoToast');
    if (t) {
      document.getElementById('infoToastLabel').textContent = (typeof globalThis.t==='function'?globalThis.t('js.code','Код'):'Код');
      document.getElementById('infoToastText').textContent = (typeof globalThis.t==='function'?globalThis.t('js.codeCopied','Скопирован'):'Скопирован');
      t.classList.add('visible');
      clearTimeout(t._hide);
      t._hide = setTimeout(() => t.classList.remove('visible'), 1600);
    }
  } catch (_) {}
});
document.getElementById('profileNickInput')?.addEventListener('input', (e) => {
  profileDraft.nick = e.target.value;
  const clean = sanitizeNick(profileDraft.nick) || myNickname;
  const hn = document.getElementById('profileHeroName');
  if (hn) hn.textContent = clean;
  renderAvatarInto(document.getElementById('profileAvBig'), {
    avatarId: profileDraft.avatarId,
    nick: clean,
    custom: profileDraft.custom,
    big: true
  });
  // refresh initials on grid
  const grid = document.getElementById('profileAvatarGrid');
  if (grid) {
    grid.querySelectorAll('.profile-av-opt').forEach(btn => {
      const p = getAvatarPreset(btn.dataset.av);
      if (p.kind === 'initials') btn.textContent = profileInitials(sanitizeNick(profileDraft.nick) || myNickname);
    });
  }
});

/* Settings UI bindings moved to public/js/14-settings-ui.js (bundle includes it after this file). */

document.getElementById('btnAchievements')?.addEventListener('click', () => {
  navigateScreen('achievements', () => {
    try { renderAchievements(); } catch (_) {}
    try { updateClaimAllButton(); } catch (_) {}
  });
});
document.getElementById('btnClaimAllAch')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (claimAllBusy || achClaimOpen) return;
  try { SFX.ui(); hapticTap(14); } catch (_) {}
  claimAllAchievements();
});
try { updateAchievementsButton(); } catch (_) {}
document.getElementById('btnAchBack')?.addEventListener('click', () => {
  navigateScreen('menu', () => { try { updateMenuStats(); } catch (_) {} });
});
document.getElementById('btnNew')?.addEventListener('click', () => { clearClassicSave(); startClassic(true); });
document.getElementById('btnRestart')?.addEventListener('click', () => { clearClassicSave(); startClassic(true); });
document.getElementById('btnOverMenu')?.addEventListener('click', () => {
  gameOverEl.classList.remove('visible');
  navigateScreen('menu', () => { try { updateMenuStats(); } catch (_) {} });
});
document.getElementById('btnRelief')?.addEventListener('click', doRelief);
document.getElementById('btnUseDiamond')?.addEventListener('click', doRelief);
document.getElementById('btnGiveUp')?.addEventListener('click', () => {
  stuckOfferEl.classList.remove('visible');
  document.getElementById('finalScore').textContent = score;
  const msg = document.getElementById('gameOverMsg');
  if (msg) msg.textContent = (typeof globalThis.t==='function'?globalThis.t('js.noSpace','Места больше нет'):'Места больше нет');
  clearClassicSave();
  gameOverEl.classList.add('visible');
});
