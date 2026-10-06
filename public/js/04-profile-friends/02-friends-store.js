/**
 * Block Puzzle — js/04-profile-friends/02-friends-store.js
 * Friends list persistence and server sync.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
let friends = [];
try { friends = JSON.parse(localStorage.getItem('bp_friends') || '[]'); } catch (_) { friends = []; }
let _friendsSyncTimer = null;
function saveFriends() {
  try { localStorage.setItem('bp_friends', JSON.stringify(friends)); } catch (_) {}
  try { scheduleFriendsSync(); } catch (_) {}
}
function scheduleFriendsSync() {
  if (!authToken) return;
  if (_friendsSyncTimer) clearTimeout(_friendsSyncTimer);
  _friendsSyncTimer = setTimeout(() => {
    _friendsSyncTimer = null;
    try { syncFriendsToServer(); } catch (_) {}
  }, 800);
}
async function syncFriendsToServer() {
  if (!authToken) return;
  try {
    const payload = (friends || []).slice(0, 200).map((f) => ({
      code: f.code,
      name: f.name,
      trophies: f.trophies,
      avatarId: f.avatarId,
      avatarCustom: f.avatarCustom,
      added: f.added
    }));
    await apiFetch('/api/me', { method: 'PATCH', body: { friends: payload } });
  } catch (_) {}
}
function mergeFriendsFromServer(serverFriends) {
  if (!Array.isArray(serverFriends) || !serverFriends.length) return;
  const byCode = new Map();
  for (const f of friends) {
    if (f && f.code) byCode.set(normalizeFriendCode(f.code), f);
  }
  for (const sf of serverFriends) {
    if (!sf || !sf.code) continue;
    const code = normalizeFriendCode(sf.code);
    if (!code) continue;
    const existing = byCode.get(code);
    if (existing) {
      if (sf.name && (!existing.name || existing.name.startsWith('Игрок'))) existing.name = sf.name;
      if (sf.avatarId) existing.avatarId = sf.avatarId;
      if (sf.avatarCustom) existing.avatarCustom = sf.avatarCustom;
      if (typeof sf.trophies === 'number') existing.trophies = sf.trophies;
    } else {
      const rec = {
        code,
        name: (sf.name || ('Игрок ' + code.slice(0, 3))).slice(0, 20),
        added: sf.added || Date.now(),
        trophies: typeof sf.trophies === 'number' ? sf.trophies : undefined,
        avatarId: sf.avatarId,
        avatarCustom: sf.avatarCustom
      };
      friends.push(rec);
      byCode.set(code, rec);
    }
  }
  try { localStorage.setItem('bp_friends', JSON.stringify(friends)); } catch (_) {}
}

const screens = {
  menu: document.getElementById('screenMenu'),
  settings: document.getElementById('screenSettings'),
  history: document.getElementById('screenHistory'),
  friends: document.getElementById('screenFriends'),
  compType: document.getElementById('screenCompType'),
  difficulty: document.getElementById('screenDifficulty'),
  achievements: document.getElementById('screenAchievements'),
  duration: document.getElementById('screenDuration'),
  match: document.getElementById('screenMatch'),
  classic: document.getElementById('screenClassic'),
  versus: document.getElementById('screenVersus'),
  shop: document.getElementById('screenShop'),
  inventory: document.getElementById('screenInventory'),
  profile: document.getElementById('screenProfile'),
};
