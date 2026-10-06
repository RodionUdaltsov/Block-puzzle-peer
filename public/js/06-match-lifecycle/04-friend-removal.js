/**
 * Block Puzzle — js/06-match-lifecycle/04-friend-removal.js
 * Remote friend removal and local removal.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function applyRemoteFriendRemove(data) {
  const code = normalizeFriendCode(
    (data && (data.code || data.from || data.remover || '')) || ''
  );
  if (!code || code === myFriendCode) return false;
  const before = friends.length;
  const stillHas = friends.some(f => normalizeFriendCode(f.code) === code);
  if (!stillHas) return false;

  const finish = () => {
    friends = friends.filter(f => normalizeFriendCode(f.code) !== code);
    if (friends.length === before) return false;
    saveFriends();
    try { renderFriends(); } catch (_) {}
    try {
      const who = data && data.name ? ' (' + data.name + ')' : '';
      setFriendAddStatus('Вас удалили из друзей' + who, 'err');
    } catch (_) {}
    return true;
  };

  // Animate the card out for the removed player (same as local delete)
  try {
    const list = document.getElementById('friendList');
    const card = list && list.querySelector('.friend-card[data-code="' + code + '"]');
    if (card && !card.classList.contains('friend-exit')) {
      void card.offsetWidth;
      card.classList.add('friend-exit');
      setTimeout(() => { finish(); }, 360);
      return true;
    }
  } catch (_) {}
  return finish();
}

/** Deliver friend_remove to peer presence; retries while they may be online */
function notifyFriendRemoved(theirCode) {
  try {
    if (typeof socialSend === "function") socialSend(theirCode, "friend_remove", {});
    else if (typeof MatchClient !== "undefined") MatchClient.socialSend(theirCode, "friend_remove", {});
  } catch (_) {}
}

function removeFriendAt(idx) {
  const f = friends[idx];
  if (!f) return;
  const theirCode = normalizeFriendCode(f.code);
  const list = document.getElementById('friendList');
  const card = list && list.querySelector('.friend-card[data-fi="' + idx + '"]');
  const finish = () => {
    friends.splice(idx, 1);
    saveFriends();
    try { scheduleFriendsSync(); } catch (_) {}
    renderFriends();
    setFriendAddStatus('Друг удалён', 'ok');
    try { SFX.ui(); } catch (_) {}
    if (theirCode) notifyFriendRemoved(theirCode);
  };
  if (card) {
    void card.offsetWidth;
    card.classList.add('friend-exit');
    setTimeout(finish, 360);
  } else {
    finish();
  }
}
