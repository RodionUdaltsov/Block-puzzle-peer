    const SIZE = 8;
    const DEFAULT_COLORS = ['#00d4aa','#7c5cff','#ff5c7a','#ffb347','#4fc3f7','#ff6bcb','#a8e063','#ff8a65'];
    let COLORS = DEFAULT_COLORS.slice();

    // —— Piece skins (shop / inventory) ——
    // Free starters are always owned and never sold in the shop
    const FREE_SKIN_IDS = ['default', 'ocean', 'forest'];
    const SKIN_CATALOG = [
      {
        id: 'default', name: 'Классика', desc: 'Стандартная палитра', price: 0, rarity: 'common',
        colors: ['#00d4aa','#7c5cff','#ff5c7a','#ffb347','#4fc3f7','#ff6bcb','#a8e063','#ff8a65']
      },
      {
        id: 'ocean', name: 'Океан', desc: 'Глубокие синие тона', price: 0, rarity: 'common',
        colors: ['#00c2ff','#0077b6','#48cae4','#90e0ef','#023e8a','#0096c7','#ade8f4','#5ee7ff']
      },
      {
        id: 'forest', name: 'Лес', desc: 'Зелень и янтарь', price: 0, rarity: 'common',
        colors: ['#2d6a4f','#40916c','#52b788','#95d5b2','#d8f3dc','#b7e4c7','#74c69d','#ffb703']
      },
      {
        id: 'mono', name: 'Монохром', desc: 'Серо-стальная палитра', price: 45, rarity: 'common',
        colors: ['#e8eaed','#cfd8e3','#9aa0a6','#8b9bb0','#d7dee8','#b0b8c4','#6b7280','#a1a1aa']
      },
      {
        id: 'sunset', name: 'Закат', desc: 'Оранжевый и розовый', price: 120, rarity: 'rare',
        colors: ['#ff6b35','#f7c59f','#ef476f','#ffd166','#ff8fab','#ff9f1c','#e36414','#c9184a']
      },
      {
        id: 'neon', name: 'Неон', desc: 'Неоновая ночь', price: 150, rarity: 'rare',
        colors: ['#39ff14','#ff00ff','#00f5ff','#ffe600','#ff3d81','#7b61ff','#00ffc6','#ff9f1c']
      },
      {
        id: 'candy', name: 'Конфетти', desc: 'Пастельная сладость', price: 160, rarity: 'rare',
        colors: ['#ff8fab','#ffc2d1','#bde0fe','#a2d2ff','#cdb4db','#ffd6a5','#fdffb6','#caffbf']
      },
      {
        id: 'ice', name: 'Лёд', desc: 'Холодный кристалл', price: 180, rarity: 'rare',
        colors: ['#e0f7ff','#a5f3fc','#67e8f9','#22d3ee','#0891b2','#7dd3fc','#bae6fd','#38bdf8']
      },
      {
        id: 'lava', name: 'Лава', desc: 'Раскалённая магма', price: 280, rarity: 'epic',
        colors: ['#ff4500','#ff6a00','#ff8c00','#ffd166','#c1121f','#e85d04','#faa307','#9d0208']
      },
      {
        id: 'royal', name: 'Королевский', desc: 'Пурпур и золото', price: 300, rarity: 'epic',
        colors: ['#7b2cbf','#c77dff','#ffd700','#5a189a','#4cc9f0','#f72585','#4361ee','#f4a261']
      },
      {
        id: 'aurora', name: 'Аврора', desc: 'Северное сияние', price: 360, rarity: 'epic',
        colors: ['#00f5d4','#00bbf9','#9b5de5','#f15bb5','#fee440','#80ed99','#56cfe1','#7209b7']
      },
      {
        id: 'sakura', name: 'Сакура', desc: 'Цветение вишни', price: 320, rarity: 'epic',
        colors: ['#ffb7c5','#ff8fab','#ffc2d1','#fb6f92','#ffccd5','#e5989b','#ff99ac','#f7a1c4']
      },
      {
        id: 'cyber', name: 'Кибер', desc: 'Синтетика и матрица', price: 620, rarity: 'legendary',
        colors: ['#0aff99','#00ffc8','#7b2ff7','#f72585','#3a0ca3','#4cc9f0','#b8f2e6','#ff006e']
      },
      {
        id: 'midnight', name: 'Полночь', desc: 'Тёмная роскошь', price: 680, rarity: 'legendary',
        colors: ['#1b263b','#415a77','#778da9','#e0e1dd','#0d1b2a','#7c5cff','#5ee7ff','#c9ada7']
      },
      {
        id: 'gold', name: 'Золото', desc: 'Чистый блеск', price: 850, rarity: 'legendary',
        colors: ['#ffd700','#ffc300','#ffb703','#f4a261','#e9c46a','#daa520','#ffdb58','#ffe566']
      },
      {
        id: 'toxic', name: 'Токсин', desc: 'Ядовитое свечение', price: 340, rarity: 'epic',
        colors: ['#39ff14','#b8ff3c','#ccff00','#76ff03','#1b5e20','#00e676','#aeea00','#64dd17']
      }
    ];

    function loadOwnedSkins() {
      // TEST: unlock all skins for testing
      try {
        const all = SKIN_CATALOG.map(s => s.id);
        localStorage.setItem('bp_skins_owned', JSON.stringify(all));
        return all.slice();
      } catch (_) {
        return SKIN_CATALOG.map(s => s.id);
      }
    }
    let ownedSkins = loadOwnedSkins();
    let equippedSkinId = localStorage.getItem('bp_skin_equipped') || 'default';
    if (!ownedSkins.includes(equippedSkinId)) equippedSkinId = 'default';
    if (!SKIN_CATALOG.some(s => s.id === equippedSkinId)) equippedSkinId = 'default';

    function getSkinById(id) {
      return SKIN_CATALOG.find(s => s.id === id) || SKIN_CATALOG[0];
    }
    function skinFxClass(rarity) {
      if (rarity === 'legendary') return 'skin-fx-prism';
      if (rarity === 'epic') return 'skin-fx-gloss';
      return 'skin-fx-matte';
    }
    function paintCellColor(cell, col) {
      if (!cell) return;
      let c = (col && String(col).trim()) ? String(col).trim() : '#00d4aa';
      // Normalize hex case so tray/board/network always match
      if (/^#[0-9a-fA-F]{6}$/.test(c)) c = c.toLowerCase();
      cell.style.setProperty('--cell-base', c);
      cell.style.setProperty('--cell-glow', c);
      cell.style.backgroundImage = 'none';
      cell.style.backgroundColor = c;
      cell.style.background = c;
    }
    function applyEquippedSkin() {
      const skin = getSkinById(equippedSkinId);
      COLORS = (skin.colors && skin.colors.length) ? skin.colors.slice() : DEFAULT_COLORS.slice();
      const rar = skin.rarity || 'common';
      const fx = skinFxClass(rar);
      document.body.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
      document.body.classList.add(fx);
      if (rar === 'rare') document.body.classList.add('skin-fx-rare');
      try {
        document.body.dataset.skinId = skin.id || 'default';
        document.body.dataset.skinRarity = rar;
      } catch (_) {}
      // Refresh boards if present
      try {
        if (typeof boardEl !== 'undefined' && boardEl) renderGrid(grid, boardEl);
        if (typeof board !== 'undefined' && board) renderGrid(grid, board);
        if (typeof boardMe !== 'undefined' && boardMe) renderGrid(grid, boardMe);
        if (typeof boardOpp !== 'undefined' && boardOpp) renderGrid(oppGrid, boardOpp);
      } catch (_) {}
      // Re-tint live piece trays so colors match equipped skin immediately
      try {
        document.querySelectorAll('.piece-cell').forEach(pc => {
          const bg = pc.style.getPropertyValue('--cell-base') || pc.style.backgroundColor || pc.style.background;
          if (bg && bg !== 'none') {
            pc.style.setProperty('--cell-base', bg);
            pc.style.setProperty('--cell-glow', bg);
          }
        });
      } catch (_) {}
    }
    /** Apply opponent's equipped skin FX so gradient / shimmer / combo particles
     *  are visible on their board for the local player (and vice versa on their client). */
    function applyOppSkin(skinId) {
      const panel = document.querySelector('.player-panel.opp');
      if (!panel) return;
      const skin = getSkinById(skinId || 'default');
      const rar = skin.rarity || 'common';
      const fx = skinFxClass(rar);
      panel.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
      panel.classList.add(fx);
      if (rar === 'rare') panel.classList.add('skin-fx-rare');
      try {
        panel.dataset.oppSkin = skin.id || 'default';
        panel.dataset.oppRarity = rar;
      } catch (_) {}
      // Set CSS vars for legend palette on the panel
      const pal = {
        gold: ['#ffd700','#fff3a0','#ffb703','#ffe566'],
        cyber: ['#0aff99','#00f5ff','#7b2ff7','#ff006e'],
        midnight: ['#5ee7ff','#c9ada7','#7c5cff','#e0e1dd']
      };
      const p = pal[skin.id];
      if (p) {
        panel.style.setProperty('--legend-a', p[0]);
        panel.style.setProperty('--legend-b', p[1]);
        panel.style.setProperty('--legend-c', p[2]);
        panel.style.setProperty('--legend-d', p[3]);
      }
      try {
        if (typeof boardOpp !== 'undefined' && boardOpp && typeof oppGrid !== 'undefined')
          renderGrid(oppGrid, boardOpp);
      } catch (_) {}
    }
    function clearOppSkin() {
      const panel = document.querySelector('.player-panel.opp');
      if (!panel) return;
      panel.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
      panel.classList.add('skin-fx-matte');
      try {
        panel.dataset.oppSkin = 'default';
        panel.dataset.oppRarity = 'common';
      } catch (_) {}
      try {
        panel.style.removeProperty('--legend-a');
        panel.style.removeProperty('--legend-b');
        panel.style.removeProperty('--legend-c');
        panel.style.removeProperty('--legend-d');
      } catch (_) {}
    }
    /** Flying ghost must use the side's skin, not always the local player's body class */
    function setAiGhostSkin(side) {
      const g = document.getElementById('aiGhost');
      if (!g) return;
      g.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
      let fx = 'skin-fx-matte';
      let rare = false;
      try {
        if (side === 'opp') {
          if (document.body.classList.contains('vs-bots') || (typeof vsModeType !== 'undefined' && vsModeType === 'bots')) {
            fx = 'skin-fx-matte';
            rare = false;
          } else {
            const panel = document.querySelector('.player-panel.opp');
            if (panel) {
              if (panel.classList.contains('skin-fx-prism')) fx = 'skin-fx-prism';
              else if (panel.classList.contains('skin-fx-gloss')) fx = 'skin-fx-gloss';
              else if (panel.classList.contains('skin-fx-rare')) { fx = 'skin-fx-rare'; rare = true; }
              else if (panel.classList.contains('skin-fx-matte')) fx = 'skin-fx-matte';
            }
            if (fx === 'skin-fx-matte' && !rare) {
              const sid = window.mpOppSkinId || (replayData && replayData.oppSkinId) || null;
              if (sid && typeof getSkinById === 'function' && typeof skinFxClass === 'function') {
                const skin = getSkinById(sid);
                const rar = (skin && skin.rarity) || 'common';
                fx = skinFxClass(rar);
                if (rar === 'rare') rare = true;
              }
            }
          }
        } else {
          if (document.body.classList.contains('skin-fx-prism')) fx = 'skin-fx-prism';
          else if (document.body.classList.contains('skin-fx-gloss')) fx = 'skin-fx-gloss';
          else if (document.body.classList.contains('skin-fx-rare')) { fx = 'skin-fx-rare'; rare = true; }
          else fx = 'skin-fx-matte';
          // Fallback from equipped / replay skin
          if (fx === 'skin-fx-matte' && !rare) {
            const sid = (typeof equippedSkinId !== 'undefined' && equippedSkinId)
              || (replayData && replayData.mySkinId) || null;
            if (sid && typeof getSkinById === 'function' && typeof skinFxClass === 'function') {
              const skin = getSkinById(sid);
              const rar = (skin && skin.rarity) || 'common';
              fx = skinFxClass(rar);
              if (rar === 'rare') rare = true;
            }
          }
        }
      } catch (_) {}
      g.classList.add(fx);
      if (rare || fx === 'skin-fx-rare') g.classList.add('skin-fx-rare');
    }
    function applyOppBoard(boardId) {
      const id = boardId || window.mpOppBoardId || 'field_default';
      const board = (typeof getBoardById === 'function') ? getBoardById(id) : null;
      try { window.mpOppBoardId = (board && board.id) || id; } catch (_) {}
      const panel = document.querySelector('.player-panel.opp');
      if (!panel) return;
      try {
        panel.dataset.oppBoard = (board && board.id) || id;
        panel.dataset.oppBoardRarity = (board && board.rarity) || 'common';
      } catch (_) {}
      const wrap = panel.querySelector('.board-wrap');
      if (wrap && board && typeof applyBoardToWrap === 'function') {
        applyBoardToWrap(wrap, board);
      }
    }
    function clearOppBoard() {
      try { window.mpOppBoardId = null; } catch (_) {}
      const panel = document.querySelector('.player-panel.opp');
      if (!panel) return;
      try {
        delete panel.dataset.oppBoard;
        delete panel.dataset.oppBoardRarity;
      } catch (_) {}
      const wrap = panel.querySelector('.board-wrap');
      if (wrap && typeof applyBoardToWrap === 'function' && typeof getBoardById === 'function') {
        applyBoardToWrap(wrap, getBoardById('field_default'));
      }
    }
    function skinMetaForSide(side) {
      // side: 'me' | 'opp' | null (classic = me)
      if (side === 'opp') {
        const panel = document.querySelector('.player-panel.opp');
        const id = (panel && panel.dataset.oppSkin) || window.mpOppSkinId || 'default';
        const skin = getSkinById(id);
        return { id: skin.id, rarity: skin.rarity || 'common', skin };
      }
      const id = (document.body.dataset && document.body.dataset.skinId) || equippedSkinId || 'default';
      const skin = getSkinById(id);
      return { id: skin.id, rarity: skin.rarity || 'common', skin };
    }
    applyEquippedSkin();

    // —— Board fields (поля) ——
    const FREE_BOARD_IDS = ['field_default', 'field_slate', 'field_charcoal'];
    const BOARD_CATALOG = [
      {
        id: 'field_default', name: 'Стандарт', desc: 'Классическое поле без эффектов',
        price: 0, rarity: 'common', fx: 'none',
        empty: '#16191f', surface: '#1a1d24', surface2: '#242830', border: '#2e333d', accent: '#00d4aa'
      },
      {
        id: 'field_slate', name: 'Сланец', desc: 'Холодный серый камень',
        price: 0, rarity: 'common', fx: 'none',
        empty: '#1a1e24', surface: '#1c2128', surface2: '#262c34', border: '#343b46', accent: '#8b9bb0'
      },
      {
        id: 'field_charcoal', name: 'Уголь', desc: 'Тёплый угольный фон',
        price: 0, rarity: 'common', fx: 'none',
        empty: '#1c1816', surface: '#221c1a', surface2: '#2c2420', border: '#3a322c', accent: '#a8988c'
      },
      {
        id: 'field_graphite', name: 'Графит', desc: 'Строгий металлический тон',
        price: 40, rarity: 'common', fx: 'none',
        empty: '#181b20', surface: '#1e2228', surface2: '#282e36', border: '#3a4250', accent: '#cfd8e3'
      },
      {
        id: 'field_sand', name: 'Песок', desc: 'Сухая пустынная сетка',
        price: 50, rarity: 'common', fx: 'none',
        empty: '#1e1a14', surface: '#241e16', surface2: '#2e261c', border: '#3d3428', accent: '#d4a574'
      },
      {
        id: 'field_azure', name: 'Лазурь', desc: 'Мягкое голубое свечение',
        price: 130, rarity: 'rare', fx: 'soft',
        empty: '#101820', surface: '#142028', surface2: '#1a2a36', border: '#2a4a5a', accent: '#3dd6f5'
      },
      {
        id: 'field_violet', name: 'Фиолет', desc: 'Сумеречная аура',
        price: 150, rarity: 'rare', fx: 'soft',
        empty: '#16141f', surface: '#1c1830', surface2: '#261e40', border: '#3a2e5a', accent: '#9b7cff'
      },
      {
        id: 'field_jade', name: 'Нефрит', desc: 'Изумрудный контур',
        price: 160, rarity: 'rare', fx: 'soft',
        empty: '#0e1a16', surface: '#12221c', surface2: '#1a2e26', border: '#2a4a3c', accent: '#3dd9a0'
      },
      {
        id: 'field_crystal', name: 'Кристалл', desc: 'Пульсирующая грань',
        price: 290, rarity: 'epic', fx: 'pulse',
        empty: '#12101c', surface: '#1a1628', surface2: '#241e38', border: '#4a3a6a', accent: '#c77dff'
      },
      {
        id: 'field_magma', name: 'Магма', desc: 'Жар из глубины',
        price: 320, rarity: 'epic', fx: 'magma',
        empty: '#1c0e0a', surface: '#22100c', surface2: '#2e1610', border: '#5a3020', accent: '#ff6a30'
      },
      {
        id: 'field_neon_grid', name: 'Неон-сетка', desc: 'Световой импульс',
        price: 340, rarity: 'epic', fx: 'pulse',
        empty: '#0c1418', surface: '#101c22', surface2: '#182830', border: '#2a5a5a', accent: '#00f5d4'
      },
      {
        id: 'field_nebula', name: 'Туманность', desc: 'Звёзды и космическая дымка',
        price: 650, rarity: 'legendary', fx: 'nebula',
        empty: '#121428', surface: '#0c0e18', surface2: '#16122a', border: '#6a50c0', accent: '#a78bff'
      },
      {
        id: 'field_solar', name: 'Солнечный', desc: 'Лучи и раскалённое ядро',
        price: 700, rarity: 'legendary', fx: 'solar',
        empty: '#1c1408', surface: '#1a1208', surface2: '#2a1c0c', border: '#c09030', accent: '#ffc040'
      },
      {
        id: 'field_quantum', name: 'Квант', desc: 'Сканирующая матрица',
        price: 720, rarity: 'legendary', fx: 'quantum',
        empty: '#061814', surface: '#061412', surface2: '#0a2420', border: '#20a080', accent: '#00ffc8'
      },
      {
        id: 'field_abyss', name: 'Бездна', desc: 'Глубина и пузырьки света',
        price: 680, rarity: 'legendary', fx: 'abyss',
        empty: '#081420', surface: '#060e18', surface2: '#0a1c30', border: '#3080b0', accent: '#4fc3f7'
      },
      {
        id: 'field_prism', name: 'Призма', desc: 'Радужная решётка',
        price: 780, rarity: 'legendary', fx: 'prismfield',
        empty: '#14101c', surface: '#100e18', surface2: '#1c1428', border: '#a070d0', accent: '#ff9de2'
      }
    ];
    // fix typo solar accent if any


    function loadOwnedBoards() {
      // TEST: unlock all boards for testing
      try {
        const all = BOARD_CATALOG.map(b => b.id);
        localStorage.setItem('bp_boards_owned', JSON.stringify(all));
        return all.slice();
      } catch (_) {
        return BOARD_CATALOG.map(b => b.id);
      }
    }
    let ownedBoards = loadOwnedBoards();
    let equippedBoardId = localStorage.getItem('bp_board_equipped') || 'field_default';
    if (!ownedBoards.includes(equippedBoardId)) equippedBoardId = 'field_default';
    if (!BOARD_CATALOG.some(b => b.id === equippedBoardId)) equippedBoardId = 'field_default';

    function getBoardById(id) {
      return BOARD_CATALOG.find(b => b.id === id) || BOARD_CATALOG[0];
    }
    function saveBoardsState() {
      try {
        localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards));
        localStorage.setItem('bp_board_equipped', equippedBoardId);
      } catch (_) {}
    }
    const BOARD_FX_CLASSES = ['board-fx-none','board-fx-soft','board-fx-pulse','board-fx-nebula','board-fx-solar','board-fx-quantum','board-fx-abyss','board-fx-prismfield','board-fx-magma'];
    function applyBoardToWrap(wrap, board) {
      if (!wrap || !board) return;
      BOARD_FX_CLASSES.forEach(c => wrap.classList.remove(c));
      wrap.classList.add('board-fx-' + (board.fx || 'none'));
      wrap.dataset.board = board.id;
      wrap.dataset.boardRarity = board.rarity || 'common';
      const empty = board.empty || '#16191f';
      const accent = board.accent || '#00d4aa';
      wrap.style.setProperty('--field-empty', empty);
      wrap.style.setProperty('--cell-empty', empty);
      wrap.style.setProperty('--field-surface', board.surface || '#1a1d24');
      wrap.style.setProperty('--field-surface2', board.surface2 || '#242830');
      wrap.style.setProperty('--field-border', board.border || '#2e333d');
      wrap.style.setProperty('--field-accent', accent);
      // Paint empty cells immediately so change is visible without waiting for re-render
      try {
        const boardEl = wrap.querySelector('.board');
        if (boardEl) {
          BOARD_FX_CLASSES.forEach(c => boardEl.classList.remove(c));
          boardEl.classList.add('board-fx-' + (board.fx || 'none'));
          boardEl.style.setProperty('--field-empty', empty);
          boardEl.style.setProperty('--cell-empty', empty);
          boardEl.style.setProperty('--field-accent', accent);
          boardEl.querySelectorAll('.cell:not(.filled)').forEach(cell => {
            cell.style.background = '';
            cell.style.backgroundColor = '';
          });
        }
      } catch (_) {}
    }
    /** Only local player's board shows equipped field theme (same idea as piece skins). */
    function isLocalBoardWrap(wrap) {
      if (!wrap) return false;
      try {
        if (wrap.closest && wrap.closest('.player-panel.opp')) return false;
        // Opp board element itself
        if (wrap.id === 'boardOpp' || (wrap.querySelector && wrap.querySelector('#boardOpp'))) return false;
      } catch (_) {}
      return true;
    }
    function applyEquippedBoard() {
      const board = getBoardById(equippedBoardId);
      try {
        document.body.dataset.boardId = board.id;
        document.body.dataset.boardRarity = board.rarity || 'common';
      } catch (_) {}
      // Only local boards — opponent field is applied separately via applyOppBoard
      document.querySelectorAll('.board-wrap').forEach(w => {
        if (isLocalBoardWrap(w)) applyBoardToWrap(w, board);
      });
      const classicBoard = document.getElementById('board');
      if (classicBoard && !classicBoard.closest('.board-wrap')) {
        // no-op; usually inside wrap
      }
    }
    function buyBoard(id) {
      const board = getBoardById(id);
      if (!board || board.price <= 0) return false;
      if (ownedBoards.includes(id)) return false;
      if (diamonds < board.price) return false;
      diamonds -= board.price;
      try { localStorage.setItem('bp_diamonds', diamonds); } catch (_) {}
      ownedBoards.push(id);
      saveBoardsState();
      try {
        bumpAchStat('boardsBought', 1);
        if (board.rarity === 'legendary') setAchStat('boardsLegendary', Math.max(1, getAchStat('boardsLegendary')));
        checkNewAchievements();
      } catch (_) {}
      try { updateMenuStats(); } catch (_) {}
      return true;
    }
    function equipBoard(id) {
      if (!ownedBoards.includes(id)) return false;
      equippedBoardId = id;
      applyEquippedBoard();
      saveBoardsState();
      return true;
    }
    applyEquippedBoard();

    function fieldMiniPatternHTML(board) {
      // Decorative 6x6 pattern for shop cards
      const pattern = [
        0,1,1,0,0,1,
        1,1,0,0,1,1,
        0,0,1,1,0,0,
        0,1,1,1,1,0,
        1,0,0,0,0,1,
        0,1,0,0,1,0
      ];
      return pattern.map(on => on ? '<i class="on"></i>' : '<i></i>').join('');
    }
    function boardShopItemHTML(board) {
      const owned = ownedBoards.includes(board.id);
      const eq = equippedBoardId === board.id;
      const rar = board.rarity || 'common';
      let action;
      if (eq) action = `<span class="skin-action on">Надето</span>`;
      else if (owned) action = `<button type="button" class="skin-action primary" data-equip-board="${board.id}">Надеть</button>`;
      else {
        const can = diamonds >= board.price;
        action = `<button type="button" class="skin-action ${can ? 'primary' : 'muted'}" data-buy-board="${board.id}" ${can ? '' : 'disabled'}>💎 ${board.price}</button>`;
      }
      const fxClass = board.fx && board.fx !== 'none' ? ` fx-${board.fx}` : '';
      return `<div class="skin-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" role="listitem" data-board="${board.id}" data-rarity="${rar}"
        style="--field-empty:${board.empty};--field-surface:${board.surface};--field-accent:${board.accent}">
        <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
        <div class="skin-item-stage">
          <div class="field-mini${fxClass}" aria-hidden="true">${fieldMiniPatternHTML(board)}</div>
        </div>
        <div class="skin-item-meta">
          <div class="skin-name">${board.name}</div>
          ${action}
        </div>
      </div>`;
    }
    function boardInvItemHTML(board) {
      const eq = equippedBoardId === board.id;
      const rar = board.rarity || 'common';
      const action = eq
        ? `<span class="skin-action on">Надето</span>`
        : `<button type="button" class="skin-action primary" data-equip-board="${board.id}">Надеть</button>`;
      const fxClass = board.fx && board.fx !== 'none' ? ` fx-${board.fx}` : '';
      return `<div class="skin-item owned ${eq ? 'equipped' : ''}" role="listitem" data-board="${board.id}" data-rarity="${rar}"
        style="--field-empty:${board.empty};--field-surface:${board.surface};--field-accent:${board.accent}">
        <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
        <div class="skin-item-stage">
          <div class="field-mini${fxClass}" aria-hidden="true">${fieldMiniPatternHTML(board)}</div>
        </div>
        <div class="skin-item-meta">
          <div class="skin-name">${board.name}</div>
          ${action}
        </div>
      </div>`;
    }
    function sortBoardsByRarity(list) {
      const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      return list.slice().sort((a, b) => {
        const ra = order[a.rarity] ?? 9;
        const rb = order[b.rarity] ?? 9;
        if (ra !== rb) return ra - rb;
        return (b.price || 0) - (a.price || 0);
      });
    }


    function saveSkinsState() {
      try {
        localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins));
        localStorage.setItem('bp_skin_equipped', equippedSkinId);
      } catch (_) {}
    }
    function buySkin(id) {
      const skin = getSkinById(id);
      if (!skin || skin.price <= 0) return false;
      if (ownedSkins.includes(id)) return false;
      if (diamonds < skin.price) return false;
      diamonds -= skin.price;
      try { localStorage.setItem('bp_diamonds', diamonds); } catch (_) {}
      ownedSkins.push(id);
      saveSkinsState();
      try { updateMenuStats(); } catch (_) {}
      try { setAchStat('skinsOwned', ownedSkins.length); } catch (_) {}
      try { bumpAchStat('skinsBought', 1); } catch (_) {}
      return true;
    }
    function equipSkin(id) {
      if (!ownedSkins.includes(id)) return false;
      equippedSkinId = id;
      applyEquippedSkin();
      try { applyEquippedBoard(); } catch (_) {}
      saveSkinsState();
      // Retint ONLY local player tray — never opponent / bot pieces
      try {
        if (typeof pieces !== 'undefined' && pieces && pieces.length) {
          pieces.forEach(p => {
            if (p && !p.used) p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
          });
        }
        if (typeof renderPieces === 'function' && typeof piecesArea !== 'undefined' && piecesArea) {
          try { renderPieces(piecesArea); } catch (_) {}
        }
        const areaVs = document.getElementById('piecesAreaVs');
        if (areaVs && typeof renderPieces === 'function' && mode === 'versus') {
          try { renderPieces(areaVs); } catch (_) {}
        }
      } catch (_) {}
      return true;
    }
    function skinRarityLabel(r) {
      if (r === 'legendary') return 'Легенда';
      if (r === 'epic') return 'Эпик';
      if (r === 'rare') return 'Редкий';
      return 'Обычный';
    }
    function skinRarityRank(r) {
      if (r === 'legendary') return 0;
      if (r === 'epic') return 1;
      if (r === 'rare') return 2;
      return 3;
    }
    function sortSkinsByRarity(list) {
      return [...list].sort((a, b) => {
        const ra = skinRarityRank(a.rarity || 'common');
        const rb = skinRarityRank(b.rarity || 'common');
        if (ra !== rb) return ra - rb;
        const pa = a.price || 0, pb = b.price || 0;
        if (pb !== pa) return pb - pa;
        return (a.name || '').localeCompare(b.name || '', 'ru');
      });
    }
    /** First-row size for collapsed skin shelf (matches grid columns). */
    function skinPreviewRowCount() {
      try {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 480px)').matches) return 4;
      } catch (_) {}
      return 3;
    }
    function bindSkinScrollToggle(root, storageKey) {
      if (!root) return;
      root.querySelectorAll('[data-toggle-skin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle-skin');
          const box = root.querySelector(`.skin-scroll[data-skin-sec="${id}"]`);
          if (!box) return;
          const nowOpen = !box.classList.contains('open');
          box.classList.toggle('open', nowOpen);
          try {
            const map = JSON.parse(sessionStorage.getItem(storageKey) || '{}') || {};
            map[id] = nowOpen ? 1 : 0;
            sessionStorage.setItem(storageKey, JSON.stringify(map));
          } catch (_) {}
          try { SFX.ui(); } catch (_) {}
        });
      });
    }
    /** Collapse all shop/inventory shelves and clear remembered open state. */
    function closeShopInvSections() {
      try { sessionStorage.removeItem('bp_shop_open'); } catch (_) {}
      try { sessionStorage.removeItem('bp_inv_open'); } catch (_) {}
      try {
        document.querySelectorAll('#shopGrid .skin-scroll.open, #invGrid .skin-scroll.open').forEach(el => {
          el.classList.remove('open');
        });
      } catch (_) {}
      try {
        const sg = document.getElementById('shopGrid');
        if (sg) sg.scrollTop = 0;
        const ig = document.getElementById('invGrid');
        if (ig) ig.scrollTop = 0;
      } catch (_) {}
    }
    function skinShopItemHTML(skin) {
      const owned = ownedSkins.includes(skin.id);
      const eq = equippedSkinId === skin.id;
      const rar = skin.rarity || 'common';
      let action;
      if (eq) action = `<span class="skin-action on">Надето</span>`;
      else if (owned) action = `<button type="button" class="skin-action primary" data-equip="${skin.id}">Надеть</button>`;
      else {
        const can = diamonds >= skin.price;
        action = `<button type="button" class="skin-action ${can ? 'primary' : 'muted'}" data-buy="${skin.id}" ${can ? '' : 'disabled'}>💎 ${skin.price}</button>`;
      }
      return `<div class="skin-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" role="listitem" data-skin="${skin.id}" data-rarity="${rar}">
        <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
        <div class="skin-item-stage" data-preview="${skin.id}">
          <div class="skin-mini-board" data-mini="${skin.id}" aria-hidden="true">${Array.from({length:36},()=>'<i></i>').join('')}</div>
        </div>
        <div class="skin-item-meta">
          <div class="skin-name">${skin.name}</div>
          ${action}
        </div>
      </div>`;
    }
    function skinInvItemHTML(skin) {
      const eq = equippedSkinId === skin.id;
      const rar = skin.rarity || 'common';
      const action = eq
        ? `<span class="skin-action on">Надето</span>`
        : `<button type="button" class="skin-action primary" data-equip="${skin.id}">Надеть</button>`;
      // Same animated mini-board preview as shop
      return `<div class="skin-item owned ${eq ? 'equipped' : ''}" role="listitem" data-skin="${skin.id}" data-rarity="${rar}">
        <span class="skin-rarity ${rar}">${skinRarityLabel(rar)}</span>
        <div class="skin-item-stage" data-preview="${skin.id}">
          <div class="skin-mini-board" data-mini="${skin.id}" aria-hidden="true">${Array.from({length:36},()=>'<i></i>').join('')}</div>
        </div>
        <div class="skin-item-meta">
          <div class="skin-name">${skin.name}</div>
          ${action}
        </div>
      </div>`;
    }
    function skinCubeStackHTML(colors, rarity) {
      const c = (colors || []).slice(0, 6);
      const rar = rarity || 'common';
      return `<div class="skin-cubes">${c.map(col => {
        const style = rar === 'legendary'
          ? `background:linear-gradient(135deg,${col},${col});background-color:${col}`
          : `background:${col}`;
        return `<span class="skin-cube" style="${style}"></span>`;
      }).join('')}</div>`;
    }
    function renderShopGrid() {
      const grid = document.getElementById('shopGrid');
      const bal = document.getElementById('shopDiamonds');
      if (bal) bal.textContent = diamonds;
      if (!grid) return;
      const forSale = sortSkinsByRarity(SKIN_CATALOG.filter(s => s.price > 0));
      const boardsSale = sortBoardsByRarity(BOARD_CATALOG.filter(b => b.price > 0));
      if (!forSale.length && !boardsSale.length) {
        grid.innerHTML = '<div class="inv-empty">Пока нет товаров</div>';
        return;
      }
      const rowN = skinPreviewRowCount();
      let openMap = {};
      try { openMap = JSON.parse(sessionStorage.getItem('bp_shop_open') || '{}') || {}; } catch (_) { openMap = {}; }

      function shelfHTML(secId, ico, title, list, itemFn) {
        if (!list.length) return '';
        const top = list.slice(0, rowN);
        const rest = list.slice(rowN);
        const isOpen = openMap[secId] === 1;
        const hasMore = rest.length > 0;
        return `<div class="skin-scroll ${isOpen && hasMore ? 'open' : ''}" data-skin-sec="${secId}">
          <button type="button" class="skin-scroll-head" data-toggle-skin="${secId}" ${hasMore ? '' : 'disabled style="opacity:0.9;cursor:default"'}>
            <span class="skin-scroll-ico">${ico}</span>
            <span class="skin-scroll-title">${title}</span>
            <span class="skin-scroll-count">${list.length}</span>
            ${hasMore ? '<span class="skin-scroll-chev">▶</span>' : ''}
          </button>
          <div class="skin-scroll-preview">
            <div class="skin-shelf" role="list">${top.map(itemFn).join('')}</div>
          </div>
          ${hasMore ? `<div class="skin-scroll-body"><div class="skin-scroll-inner">
            <div class="skin-scroll-more-label">Ещё · ниже по редкости</div>
            <div class="skin-shelf" role="list">${rest.map(itemFn).join('')}</div>
          </div></div>` : ''}
        </div>`;
      }

      grid.innerHTML = `<div class="skin-shelf-wrap">
        ${shelfHTML('shop', '🛍️', 'Фигуры', forSale, skinShopItemHTML)}
        ${shelfHTML('shop_fields', '🟦', 'Поля', boardsSale, boardShopItemHTML)}
      </div>`;
      bindSkinScrollToggle(grid, 'bp_shop_open');
      grid.querySelectorAll('[data-buy]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-buy');
          if (buySkin(id)) {
            try { SFX.ui(); } catch (_) {}
            equipSkin(id);
            renderShopGrid();
            renderInvGrid();
          } else {
            alert('Не хватает алмазов');
          }
        });
      });
      grid.querySelectorAll('[data-equip]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          equipSkin(btn.getAttribute('data-equip'));
          try { SFX.ui(); } catch (_) {}
          renderShopGrid();
          renderInvGrid();
        });
      });
      grid.querySelectorAll('[data-buy-board]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-buy-board');
          if (buyBoard(id)) {
            try { SFX.ui(); } catch (_) {}
            equipBoard(id);
            renderShopGrid();
            renderInvGrid();
          } else {
            alert('Не хватает алмазов');
          }
        });
      });
      grid.querySelectorAll('[data-equip-board]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          equipBoard(btn.getAttribute('data-equip-board'));
          try { SFX.ui(); } catch (_) {}
          renderShopGrid();
          renderInvGrid();
        });
      });
      grid.querySelectorAll('.skin-item[data-board]').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target && e.target.closest && (e.target.closest('[data-buy-board]') || e.target.closest('[data-equip-board]'))) return;
          const id = item.getAttribute('data-board');
          if (!id || !ownedBoards.includes(id) || equippedBoardId === id) return;
          equipBoard(id);
          try { SFX.ui(); } catch (_) {}
          renderShopGrid();
          renderInvGrid();
        });
      });
      bindSkinPreviewClicks(grid);
      startShopMiniPreviews(grid);
    }

    let shopMiniTimer = null;
    function startShopMiniPreviews(root) {
      if (shopMiniTimer) { clearInterval(shopMiniTimer); shopMiniTimer = null; }
      if (!root) return;
      const boards = [...root.querySelectorAll('.skin-mini-board[data-mini]')];
      if (!boards.length) return;
      // Pattern frames: place shapes using skin colors
      const frames = [
        [0,1,6,7,12,13],
        [2,3,8,9,14,15,20],
        [4,5,10,11,16,17,22,23],
        [18,19,24,25,30,31],
        [21,26,27,32,33,34],
        [7,8,13,14,19,20,25],
        [1,2,7,12,13,18,24],
        [9,10,15,16,21,22,27,28]
      ];
      let fi = 0;
      const paint = () => {
        // Skip work when tab hidden
        try { if (document.hidden) { fi++; return; } } catch (_) {}
        const frame = frames[fi % frames.length];
        const on = new Set(frame);
        boards.forEach(board => {
          const id = board.getAttribute('data-mini');
          const skin = getSkinById(id);
          const cols = (skin && skin.colors) || ['#888'];
          const cells = board.children;
          const n = cells.length;
          for (let i = 0; i < n; i++) {
            const cell = cells[i];
            const shouldOn = on.has(i);
            const isOn = cell.classList.contains('on');
            if (shouldOn) {
              const col = cols[i % cols.length];
              if (!isOn || cell.style.getPropertyValue('--cell-base') !== col) {
                cell.style.background = col;
                cell.style.setProperty('--cell-base', col);
                cell.style.setProperty('--cell-glow', col);
                if (!isOn) cell.classList.add('on');
              }
            } else if (isOn) {
              cell.style.background = '';
              cell.style.removeProperty('--cell-base');
              cell.style.removeProperty('--cell-glow');
              cell.classList.remove('on');
            }
          }
        });
        fi++;
      };
      paint();
      shopMiniTimer = setInterval(paint, 900);
    }

    let skinPrevTimer = null;
    function closeSkinPreview() {
      const ov = document.getElementById('skinPreviewModal');
      if (ov) {
        ov.classList.remove('visible');
        ov.setAttribute('aria-hidden', 'true');
        if (ov._restoreFx) { try { ov._restoreFx(); } catch (_) {} }
      }
      if (skinPrevTimer) { clearTimeout(skinPrevTimer); skinPrevTimer = null; }
      document.body.classList.remove('skin-previewing');
      try { applyEquippedSkin(); } catch (_) {
        document.body.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
        try {
          const eqSkin = getSkinById(equippedSkinId);
          document.body.classList.add(skinFxClass(eqSkin.rarity || 'common'));
          if ((eqSkin.rarity || 'common') === 'rare') document.body.classList.add('skin-fx-rare');
        } catch (__) {}
      }
    }
    function openSkinPreview(skinId) {
      const skin = getSkinById(skinId);
      if (!skin) return;
      const ov = document.getElementById('skinPreviewModal');
      const boardEl = document.getElementById('skinPrevBoard');
      const title = document.getElementById('skinPrevTitle');
      const meta = document.getElementById('skinPrevMeta');
      const btn = document.getElementById('skinPrevAction');
      if (!ov || !boardEl) return;
      const rar = skin.rarity || 'common';
      title.textContent = skin.name;
      meta.textContent = (skin.desc || '') + ' · ' + skinRarityLabel(rar)
        + (rar === 'legendary' ? ' · перелив + особое комбо' : rar === 'epic' ? ' · глянец + яркое комбо' : rar === 'rare' ? ' · мягкое свечение' : ' · матовые кубики');
      const wrap = boardEl.parentElement;
      const modalInner = document.getElementById('skinPrevModalInner') || ov.querySelector('.modal');
      // Rarity frames
      [wrap, modalInner].forEach(el => {
        if (!el) return;
        el.classList.remove('rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary');
        el.classList.add('rarity-' + rar);
      });
      // Build empty 8x8
      boardEl.innerHTML = '';
      for (let i = 0; i < 64; i++) {
        const d = document.createElement('div');
        d.className = 'cell';
        boardEl.appendChild(d);
      }
      // Apply same body fx classes as in-game so preview cells match live board
      const prevFx = skinFxClass(rar);
      document.body.classList.add('skin-previewing');
      document.body.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism', 'skin-fx-rare');
      document.body.classList.add(prevFx);
      if (rar === 'rare') document.body.classList.add('skin-fx-rare');
      try {
        document.body.dataset.skinId = skin.id || 'default';
        document.body.dataset.skinRarity = rar;
      } catch (_) {}

      const owned = ownedSkins.includes(skin.id);
      const eq = equippedSkinId === skin.id;
      if (eq) {
        btn.textContent = 'Надето';
        btn.disabled = true;
        btn.className = 'primary';
        btn.onclick = null;
      } else if (owned) {
        btn.textContent = 'Надеть';
        btn.disabled = false;
        btn.className = 'primary';
        btn.onclick = () => { equipSkin(skin.id); closeSkinPreview(); renderShopGrid(); renderInvGrid(); };
      } else {
        const can = diamonds >= skin.price;
        btn.textContent = can ? `Купить · 💎 ${skin.price}` : `💎 ${skin.price}`;
        btn.disabled = !can;
        btn.className = can ? 'primary' : 'ghost';
        btn.onclick = () => {
          if (buySkin(skin.id)) {
            equipSkin(skin.id);
            closeSkinPreview();
            renderShopGrid();
            renderInvGrid();
          } else alert('Не хватает алмазов');
        };
      }
      ov.classList.add('visible');
      ov.setAttribute('aria-hidden', 'false');

      // Animate place → combo clear on a mini pattern
      const colors = skin.colors.slice();
      const pattern = [
        // soft blob then clear a row
        [0,0],[0,1],[0,2],[1,0],[1,1],[2,2],[2,3],[3,3],
        [4,1],[4,2],[4,3],[4,4],[5,4],[6,5],[7,5],[7,6]
      ];
      let step = 0;
      if (skinPrevTimer) clearTimeout(skinPrevTimer);
      const tick = () => {
        if (!ov.classList.contains('visible')) {
          // restore equipped fx
          document.body.classList.remove('skin-fx-matte', 'skin-fx-gloss', 'skin-fx-prism');
          const eqSkin = getSkinById(equippedSkinId);
          document.body.classList.add(skinFxClass(eqSkin.rarity || 'common'));
          return;
        }
        if (step < pattern.length) {
          const [r, c] = pattern[step];
          const cell = boardEl.children[r * 8 + c];
          const col = colors[step % colors.length];
          if (cell) {
            try { paintCellColor(cell, col); } catch (_) {
              cell.style.background = col;
              cell.style.setProperty('--cell-base', col);
              cell.style.setProperty('--cell-glow', col);
            }
            cell.classList.add('filled', 'placing');
            setTimeout(() => cell.classList.remove('placing'), 780);
          }
          step++;
          skinPrevTimer = setTimeout(tick, 90);
        } else {
          // clear middle row with combo flash
          const row = 4;
          for (let c = 0; c < 8; c++) {
            const cell = boardEl.children[row * 8 + c];
            if (cell && cell.classList.contains('filled')) {
              cell.classList.add('clearing');
            }
          }
          const banner = document.getElementById('skinPrevCombo');
          if (banner) {
            banner.textContent = rar === 'legendary' ? '×4' : rar === 'epic' ? '×3' : '×2';
            banner.classList.remove('show');
            void banner.offsetWidth;
            banner.classList.add('show');
          }
          setTimeout(() => {
            for (let c = 0; c < 8; c++) {
              const cell = boardEl.children[row * 8 + c];
              if (cell) {
                cell.classList.remove('filled', 'clearing');
                cell.style.background = '';
              }
            }
            // loop preview
            step = 0;
            // clear all and restart
            for (let i = 0; i < 64; i++) {
              const cell = boardEl.children[i];
              if (cell) {
                cell.classList.remove('filled', 'clearing', 'placing');
                cell.style.background = '';
                cell.style.backgroundColor = '';
                try {
                  cell.style.removeProperty('--cell-base');
                  cell.style.removeProperty('--cell-glow');
                } catch (_) {}
              }
            }
            skinPrevTimer = setTimeout(tick, 500);
          }, 420);
        }
      };
      skinPrevTimer = setTimeout(tick, 200);
      // restore fx when closed via other means handled in closeSkinPreview
      const restore = () => {
        document.body.classList.remove('skin-previewing');
        try { applyEquippedSkin(); } catch (_) {}
      };
      ov._restoreFx = restore;
    }
    function bindSkinPreviewClicks(root) {
      if (!root) return;
      root.querySelectorAll('[data-preview]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openSkinPreview(el.getAttribute('data-preview'));
        });
      });
    }

    function renderInvGrid() {
      const grid = document.getElementById('invGrid');
      if (!grid) return;
      const ownedList = sortSkinsByRarity(SKIN_CATALOG.filter(s => ownedSkins.includes(s.id)));
      const ownedBoardsList = sortBoardsByRarity(BOARD_CATALOG.filter(b => ownedBoards.includes(b.id)));
      const pill = document.getElementById('invCountPill');
      if (pill) pill.textContent = String(ownedList.length + ownedBoardsList.length);
      if (!ownedList.length && !ownedBoardsList.length) {
        grid.innerHTML = '<div class="inv-empty">Пусто · загляни в магазин</div>';
        return;
      }
      const rowN = skinPreviewRowCount();
      let openMap = {};
      try { openMap = JSON.parse(sessionStorage.getItem('bp_inv_open') || '{}') || {}; } catch (_) { openMap = {}; }

      function shelfHTML(secId, ico, title, list, itemFn) {
        if (!list.length) return '';
        const top = list.slice(0, rowN);
        const rest = list.slice(rowN);
        const isOpen = openMap[secId] === 1;
        const hasMore = rest.length > 0;
        return `<div class="skin-scroll ${isOpen && hasMore ? 'open' : ''}" data-skin-sec="${secId}">
          <button type="button" class="skin-scroll-head" data-toggle-skin="${secId}" ${hasMore ? '' : 'disabled style="opacity:0.9;cursor:default"'}>
            <span class="skin-scroll-ico">${ico}</span>
            <span class="skin-scroll-title">${title}</span>
            <span class="skin-scroll-count">${list.length}</span>
            ${hasMore ? '<span class="skin-scroll-chev">▶</span>' : ''}
          </button>
          <div class="skin-scroll-preview">
            <div class="skin-shelf" role="list">${top.map(itemFn).join('')}</div>
          </div>
          ${hasMore ? `<div class="skin-scroll-body"><div class="skin-scroll-inner">
            <div class="skin-scroll-more-label">Ещё · ниже по редкости</div>
            <div class="skin-shelf" role="list">${rest.map(itemFn).join('')}</div>
          </div></div>` : ''}
        </div>`;
      }

      grid.innerHTML = `<div class="skin-shelf-wrap">
        ${shelfHTML('inv', '🧩', 'Фигуры', ownedList, skinInvItemHTML)}
        ${shelfHTML('inv_fields', '🟦', 'Поля', ownedBoardsList, boardInvItemHTML)}
      </div>`;
      bindSkinScrollToggle(grid, 'bp_inv_open');
      grid.querySelectorAll('[data-equip]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          equipSkin(btn.getAttribute('data-equip'));
          try { SFX.ui(); } catch (_) {}
          renderInvGrid();
          renderShopGrid();
        });
      });
      grid.querySelectorAll('.skin-item[data-skin]').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target && e.target.closest && e.target.closest('[data-preview]')) return;
          if (e.target && e.target.closest && e.target.closest('[data-equip]')) return;
          const id = item.getAttribute('data-skin');
          if (!id || equippedSkinId === id) return;
          equipSkin(id);
          try { SFX.ui(); } catch (_) {}
          renderInvGrid();
          renderShopGrid();
        });
      });
      grid.querySelectorAll('[data-equip-board]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          equipBoard(btn.getAttribute('data-equip-board'));
          try { SFX.ui(); } catch (_) {}
          renderInvGrid();
          renderShopGrid();
        });
      });
      grid.querySelectorAll('.skin-item[data-board]').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target && e.target.closest && e.target.closest('[data-equip-board]')) return;
          const id = item.getAttribute('data-board');
          if (!id || equippedBoardId === id) return;
          equipBoard(id);
          try { SFX.ui(); } catch (_) {}
          renderInvGrid();
          renderShopGrid();
        });
      });
      bindSkinPreviewClicks(grid);
      startShopMiniPreviews(grid);
    }

    // Compact shapes only (speed + accuracy). Max span ~4, no bulky 1/4-board pieces.
    const SHAPES = [
      // 1
      [[0,0]],
      // 2
      [[0,0],[0,1]], [[0,0],[1,0]],
      // 3
      [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
      [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]],
      [[0,1],[1,0],[1,1]], [[0,0],[1,0],[1,1]],
      [[0,0],[1,0],[0,1]], // same family
      // 4 — lines & compact
      [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
      [[0,0],[0,1],[1,0],[1,1]], // square
      [[0,0],[1,0],[2,0],[2,1]], [[0,1],[1,1],[2,0],[2,1]],
      [[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[1,1],[1,2]],
      [[0,0],[0,1],[1,1],[2,1]], [[0,2],[1,0],[1,1],[1,2]],
      [[0,0],[1,0],[2,0],[1,1]], // T
      [[0,1],[1,0],[1,1],[1,2]],
      [[0,0],[0,1],[0,2],[1,1]],
      [[1,0],[0,1],[1,1],[2,1]],
      [[0,0],[0,1],[1,1],[1,2]], // Z
      [[0,1],[0,2],[1,0],[1,1]], // S
      [[0,0],[1,0],[1,1],[2,1]], // Z vert
      [[0,1],[1,0],[1,1],[2,0]], // S vert
    ];
    // Weighted: small pieces more often (index weights)
    const SHAPE_WEIGHTS = SHAPES.map(s => {
      const n = s.length;
      if (n === 1) return 8;
      if (n === 2) return 10;
      if (n === 3) return 9;
      return 5; // 4-cell
    });
    // 15 bots: trophies roughly map to strength
    // Unique bots — custom SVG avatars, cool names, Russian voice lines
    // av: [bg, skin, accent, eye] hex colors for procedural avatar
    const BOTS = [
      { id: 'nugget', name: 'Nugget', av: ['#6d4a18','#e6931f','#b5bd3e','#2c261e'], title: 'Новичок', trophies: 40, interval: 1771, skill: 0.224, mistake: 0.27, style: { clearBias: 0.176, risk: 0.759, speedJitter: 0.409, preferSmall: 1.177 },
        phrases: { start: ["Э-э… с какой стороны?", "Руки трясутся уже"], clear: ["Я это сделал?", "Случайно красиво"], lead: ["Это сон?", "Погоди, я впереди?"], behind: ["Снова в яме…", "Учитель, помогите", "Я стараюсь, честно"], stuck: ["Мозг выключен.", "Куда ставить-то?"], win: ["Это баг?", "Мама, я в телевизоре!", "Я… победил?"], lose: ["Норм, я всё равно милый", "Не плачу. Совсем.", "Реванш… когда-нибудь"] } },
      { id: 'stanza', name: 'Stanza', av: ['#3e1e44','#b913da','#831f64','#37263a'], title: 'Новичок', trophies: 46, interval: 1459, skill: 0.497, mistake: 0.167, style: { clearBias: 0.618, risk: 0.272, speedJitter: 0.116, preferSmall: 0.997 },
        phrases: { start: ["Рифмуй ходы", "Тишина перед строфой"], clear: ["Белый стих поля", "Рифма сошлась", "Строфа закрыта"], lead: ["Ты сбился с ритма", "Мой метр точнее", "Каденция победы"], behind: ["Муза не ушла", "Ещё черновик"], stuck: ["Творческий кризис", "Нужен эпитет"], win: ["Точка.", "Финал написан", "Аплодисменты залу"], lose: ["Твоя поэма сильнее", "Новая тетрадь"] } },
      { id: 'crisp', name: 'Crisp', av: ['#2b3f24','#55e528','#13ad38','#121910'], title: 'Новичок', trophies: 57, interval: 1446, skill: 0.43, mistake: 0.188, style: { clearBias: 0.579, risk: 0.446, speedJitter: 0.33, preferSmall: 1.0 },
        phrases: { start: ["Меню открыто", "Не подгори!"], clear: ["Готово к подаче", "Снял с огня"], lead: ["Шеф-счёт", "Мой рецепт лучше"], behind: ["Не пробуй рано", "Ещё томлюсь", "Добавлю огня"], stuck: ["Рецепт сломан", "Нужна новая сковорода", "Пригорело…"], win: ["Приятного аппетита… тебе нет", "Мишлен этого поля"], lose: ["Десерт — реванш", "Учись у шефа", "Пересолил стратегию"] } },
      { id: 'dash', name: 'Dash', av: ['#79162b','#e52b53','#a65d42','#3b282c'], title: 'Новичок', trophies: 69, interval: 1261, skill: 0.388, mistake: 0.252, style: { clearBias: 0.491, risk: 0.835, speedJitter: 0.634, preferSmall: 0.759 },
        phrases: { start: ["Скорость — мой допинг", "Не моргай!"], clear: ["Разряд!", "Искры!"], lead: ["Ты в отставании!", "Я уже на орбите", "Догони ток!"], behind: ["Сейчас рывок!", "Перегрузка… и вперёд"], stuck: ["Завис. Перезагрузка!", "Предохранитель!"], win: ["Рекорд скорости!", "Я — вспышка"], lose: ["Перезарядка", "Ладно, был шум"] } },
      { id: 'sauce', name: 'Sauce', av: ['#207362','#0ab996','#38748c','#101f1c'], title: 'Любитель', trophies: 83, interval: 1395, skill: 0.433, mistake: 0.179, style: { clearBias: 0.666, risk: 0.447, speedJitter: 0.151, preferSmall: 1.077 },
        phrases: { start: ["Меню открыто", "Соль по вкусу — и ходи"], clear: ["Хруст линий", "Готово к подаче"], lead: ["Ты недоварен", "Шеф-счёт"], behind: ["Не пробуй рано", "Ещё томлюсь"], stuck: ["Пригорело…", "Нужна новая сковорода", "Рецепт сломан"], win: ["Мишлен этого поля", "Приятного аппетита… тебе нет"], lose: ["Учись у шефа", "Десерт — реванш", "Пересолил стратегию"] } },
      { id: 'feline', name: 'Feline', av: ['#6a784a','#a8c85e','#649756','#252b16'], title: 'Любитель', trophies: 98, interval: 1568, skill: 0.313, mistake: 0.212, style: { clearBias: 0.35, risk: 0.631, speedJitter: 0.316, preferSmall: 1.165 },
        phrases: { start: ["Мрр. Не трогай хвост.", "Я здесь за рыбой и очками"], clear: ["Мур. Чистый пол.", "Как лапкой смахнул"], lead: ["Царапаю твой рейтинг", "Пуррр-имущество", "Лежу на первом месте"], behind: ["Ещё не всё молоко выпито", "Хвост дёргается — злюсь", "Подкрадусь"], stuck: ["Нужен открывашка", "Мяу. Тупик."], win: ["А теперь корми", "Домашние — на колени", "Пуррр-беда!"], lose: ["Фыр. Случайность.", "Укушу счёт"] } },
      { id: 'mimi', name: 'Mimi', av: ['#1d3f49','#3e9cb7','#415688','#1d282b'], title: 'Любитель', trophies: 115, interval: 1785, skill: 0.193, mistake: 0.262, style: { clearBias: 0.319, risk: 0.582, speedJitter: 0.324, preferSmall: 1.267 },
        phrases: { start: ["Руки трясутся уже", "Э-э… с какой стороны?"], clear: ["Ух…", "Случайно красиво"], lead: ["Запишите в историю", "Погоди, я впереди?", "Это сон?"], behind: ["Учитель, помогите", "Я стараюсь, честно"], stuck: ["Всё. Паника.", "Куда ставить-то?"], win: ["Это баг?", "Мама, я в телевизоре!", "Я… победил?"], lose: ["Не плачу. Совсем.", "Норм, я всё равно милый", "Реванш… когда-нибудь"] } },
      { id: 'thunder', name: 'Thunder', av: ['#3f2460','#845bb7','#ac1db7','#2d2438'], title: 'Любитель', trophies: 132, interval: 1276, skill: 0.415, mistake: 0.256, style: { clearBias: 0.467, risk: 0.839, speedJitter: 0.68, preferSmall: 0.631 },
        phrases: { start: ["Скорость — мой допинг", "3… 2… БАМ!"], clear: ["Искры!", "Комбо-взрыв!"], lead: ["Я уже на орбите", "Ты в отставании!", "Догони ток!"], behind: ["Не считай меня", "Перегрузка… и вперёд"], stuck: ["Где розетка?!", "Предохранитель!", "Завис. Перезагрузка!"], win: ["Я — вспышка", "Громче аплодисменты!", "Рекорд скорости!"], lose: ["Коротнуло…", "Перезарядка", "Ладно, был шум"] } },
      { id: 'ballad', name: 'Ballad', av: ['#3e6349','#64f48e','#4bb19a','#101e14'], title: 'Любитель', trophies: 150, interval: 1455, skill: 0.484, mistake: 0.139, style: { clearBias: 0.82, risk: 0.399, speedJitter: 0.272, preferSmall: 1.13 },
        phrases: { start: ["Тишина перед строфой", "Строка первой мысли"], clear: ["Рифма сошлась", "Белый стих поля"], lead: ["Мой метр точнее", "Каденция победы"], behind: ["Правлю строку", "Ещё черновик"], stuck: ["Пустая страница", "Нужен эпитет"], win: ["Аплодисменты залу", "Финал написан", "Точка."], lose: ["Новая тетрадь", "Твоя поэма сильнее"] } },
      { id: 'socks', name: 'Socks', av: ['#59351c','#ef9655','#897f21','#261f1a'], title: 'Любитель', trophies: 169, interval: 1612, skill: 0.311, mistake: 0.226, style: { clearBias: 0.356, risk: 0.56, speedJitter: 0.31, preferSmall: 1.195 },
        phrases: { start: ["Мрр. Не трогай хвост.", "Я здесь за рыбой и очками", "Котики иногда проигрывают"], clear: ["Как лапкой смахнул", "Погладь за комбо"], lead: ["Лежу на первом месте", "Царапаю твой рейтинг"], behind: ["Хвост дёргается — злюсь", "Подкрадусь", "Ещё не всё молоко выпито"], stuck: ["Нужен открывашка", "Застрял, как в коробке"], win: ["Пуррр-беда!", "А теперь корми", "Домашние — на колени"], lose: ["Укушу счёт", "Игнорирую результат"] } },
      { id: 'wok', name: 'Wok', av: ['#643b34','#b72d15','#a27d3f','#322725'], title: 'Любитель', trophies: 189, interval: 1421, skill: 0.463, mistake: 0.178, style: { clearBias: 0.614, risk: 0.487, speedJitter: 0.185, preferSmall: 1.042 },
        phrases: { start: ["Соль по вкусу — и ходи", "Меню открыто", "Не подгори!"], clear: ["Готово к подаче", "Хруст линий", "Снял с огня"], lead: ["Ты недоварен", "Шеф-счёт", "Мой рецепт лучше"], behind: ["Не пробуй рано", "Ещё томлюсь", "Добавлю огня"], stuck: ["Рецепт сломан", "Нужна новая сковорода", "Пригорело…"], win: ["Приятного аппетита… тебе нет", "На блюде — победа"], lose: ["Пересолил стратегию", "Десерт — реванш"] } },
      { id: 'broil', name: 'Broil', av: ['#405534','#78c94c','#297d34','#293224'], title: 'Клубный', trophies: 210, interval: 1365, skill: 0.446, mistake: 0.196, style: { clearBias: 0.725, risk: 0.493, speedJitter: 0.171, preferSmall: 1.006 },
        phrases: { start: ["Соль по вкусу — и ходи", "Не подгори!"], clear: ["Снял с огня", "Готово к подаче"], lead: ["Ты недоварен", "Мой рецепт лучше"], behind: ["Не пробуй рано", "Добавлю огня", "Ещё томлюсь"], stuck: ["Рецепт сломан", "Нужна новая сковорода", "Пригорело…"], win: ["На блюде — победа", "Приятного аппетита… тебе нет", "Мишлен этого поля"], lose: ["Десерт — реванш", "Учись у шефа", "Пересолил стратегию"] } },
      { id: 'mews', name: 'Mews', av: ['#722851','#d1609f','#80151d','#22181e'], title: 'Клубный', trophies: 231, interval: 1564, skill: 0.32, mistake: 0.202, style: { clearBias: 0.312, risk: 0.608, speedJitter: 0.308, preferSmall: 1.142 },
        phrases: { start: ["Я здесь за рыбой и очками", "Котики иногда проигрывают"], clear: ["Мур. Чистый пол.", "Погладь за комбо", "Как лапкой смахнул"], lead: ["Царапаю твой рейтинг", "Лежу на первом месте", "Пуррр-имущество"], behind: ["Подкрадусь", "Хвост дёргается — злюсь"], stuck: ["Застрял, как в коробке", "Нужен открывашка", "Мяу. Тупик."], win: ["Домашние — на колени", "Пуррр-беда!", "А теперь корми"], lose: ["Игнорирую результат", "Фыр. Случайность."] } },
      { id: 'pepper', name: 'Pepper', av: ['#787829','#ecec6a','#467b0e','#21211a'], title: 'Клубный', trophies: 253, interval: 1378, skill: 0.455, mistake: 0.203, style: { clearBias: 0.785, risk: 0.405, speedJitter: 0.317, preferSmall: 1.018 },
        phrases: { start: ["Не подгори!", "Меню открыто"], clear: ["Снял с огня", "Готово к подаче"], lead: ["Мой рецепт лучше", "Шеф-счёт"], behind: ["Не пробуй рано", "Ещё томлюсь"], stuck: ["Пригорело…", "Нужна новая сковорода"], win: ["Приятного аппетита… тебе нет", "Мишлен этого поля"], lose: ["Десерт — реванш", "Учись у шефа", "Пересолил стратегию"] } },
      { id: 'noodle', name: 'Noodle', av: ['#17357b','#4578ed','#3b2a8b','#2c313c'], title: 'Клубный', trophies: 275, interval: 1399, skill: 0.493, mistake: 0.175, style: { clearBias: 0.749, risk: 0.361, speedJitter: 0.289, preferSmall: 0.975 },
        phrases: { start: ["Соль по вкусу — и ходи", "Меню открыто"], clear: ["Снял с огня", "Хруст линий", "Готово к подаче"], lead: ["Шеф-счёт", "Ты недоварен"], behind: ["Добавлю огня", "Не пробуй рано"], stuck: ["Нужна новая сковорода", "Рецепт сломан"], win: ["Приятного аппетита… тебе нет", "Мишлен этого поля", "На блюде — победа"], lose: ["Десерт — реванш", "Учись у шефа"] } },
      { id: 'neon', name: 'Neon', av: ['#2e6323','#4fd036','#1f8c42','#152012'], title: 'Клубный', trophies: 298, interval: 1253, skill: 0.384, mistake: 0.235, style: { clearBias: 0.395, risk: 0.707, speedJitter: 0.655, preferSmall: 0.655 },
        phrases: { start: ["Скорость — мой допинг", "Не моргай!"], clear: ["БАХ — и чисто", "Комбо-взрыв!", "Искры!"], lead: ["Я уже на орбите", "Ты в отставании!"], behind: ["Сейчас рывок!", "Перегрузка… и вперёд"], stuck: ["Завис. Перезагрузка!", "Предохранитель!", "Где розетка?!"], win: ["Я — вспышка", "Громче аплодисменты!", "Рекорд скорости!"], lose: ["Коротнуло…", "Перезарядка", "Ладно, был шум"] } },
      { id: 'flash', name: 'Flash', av: ['#214d45','#75f5de','#4090b1','#101716'], title: 'Клубный', trophies: 321, interval: 1210, skill: 0.378, mistake: 0.223, style: { clearBias: 0.434, risk: 0.891, speedJitter: 0.456, preferSmall: 0.665 },
        phrases: { start: ["Скорость — мой допинг", "Поехалиооо!", "Не моргай!"], clear: ["Искры!", "Комбо-взрыв!"], lead: ["Догони ток!", "Ты в отставании!"], behind: ["Сейчас рывок!", "Не считай меня", "Перегрузка… и вперёд"], stuck: ["Предохранитель!", "Где розетка?!"], win: ["Рекорд скорости!", "Я — вспышка"], lose: ["Коротнуло…", "Перезарядка"] } },
      { id: 'ping', name: 'Ping', av: ['#1e5645','#5ae4bb','#258095','#233c35'], title: 'Клубный', trophies: 346, interval: 1042, skill: 0.616, mistake: 0.12, style: { clearBias: 0.606, risk: 0.698, speedJitter: 0.23, preferSmall: 0.991 },
        phrases: { start: ["Не AFK, обещаю", "Загрузка… 99%"], clear: ["Крит по линиям", "Лут чистоты", "Комбо-дроп!"], lead: ["Carry себя сам", "Diff огромный", "Ты в бронзе моего матча"], behind: ["Не токсик — факт", "Ещё не mid-game"], stuck: ["Баг карты?", "Застрял в туториале", "Нужен гайд"], win: ["GG EZ… почти", "Ранг up"], lose: ["GG WP", "Ремatch?"] } },
      { id: 'respawn', name: 'Respawn', av: ['#6b192b','#f91247','#873c23','#35292c'], title: 'Клубный', trophies: 370, interval: 1027, skill: 0.655, mistake: 0.151, style: { clearBias: 0.691, risk: 0.577, speedJitter: 0.427, preferSmall: 1.007 },
        phrases: { start: ["GG ещё не было", "Не AFK, обещаю"], clear: ["Лут чистоты", "Крит по линиям", "Комбо-дроп!"], lead: ["Ты в бронзе моего матча", "Carry себя сам"], behind: ["Сейчас камбек", "Не токсик — факт", "Ещё не mid-game"], stuck: ["Баг карты?", "Застрял в туториале"], win: ["Ранг up", "Попадание в хайлайт", "GG EZ… почти"], lose: ["GG WP", "Скилл issue… мой"] } },
      { id: 'rook', name: 'Rook', av: ['#225e65','#36a8b6','#3a557c','#29383a'], title: 'Клубный', trophies: 395, interval: 1130, skill: 0.543, mistake: 0.154, style: { clearBias: 0.467, risk: 0.559, speedJitter: 0.248, preferSmall: 0.723 },
        phrases: { start: ["Медленно, но тяжело", "Поле — моя берлога", "Р-р. Не буди."], clear: ["Смахнул лапой", "Тяжело — но чисто"], lead: ["Тяжесть победы", "Не толкай", "Сижу на горе очков"], behind: ["Ещё не рычал", "Зимняя спячка кончилась", "Разогреваюсь"], stuck: ["Нужен топор", "Грр… тупик"], win: ["Берлога защищена", "Рычание победы", "Можно спать"], lose: ["Осень пришла", "Уважаю силу", "Вернусь жирнее"] } },
      { id: 'bruno', name: 'Bruno', av: ['#155418','#72e677','#1c9f60','#223923'], title: 'Сильный', trophies: 421, interval: 1178, skill: 0.507, mistake: 0.142, style: { clearBias: 0.492, risk: 0.478, speedJitter: 0.153, preferSmall: 0.802 },
        phrases: { start: ["Р-р. Не буди.", "Медленно, но тяжело"], clear: ["Грр-комбо", "Смахнул лапой"], lead: ["Тяжесть победы", "Не толкай", "Сижу на горе очков"], behind: ["Разогреваюсь", "Ещё не рычал", "Зимняя спячка кончилась"], stuck: ["Грр… тупик", "Застрял в чащобе", "Нужен топор"], win: ["Можно спать", "Берлога защищена"], lose: ["Осень пришла", "Вернусь жирнее"] } },
      { id: 'tank', name: 'Tank', av: ['#450b38','#c51d9f','#912948','#221a20'], title: 'Сильный', trophies: 447, interval: 1172, skill: 0.536, mistake: 0.13, style: { clearBias: 0.425, risk: 0.633, speedJitter: 0.324, preferSmall: 0.945 },
        phrases: { start: ["Поле — моя берлога", "Медленно, но тяжело"], clear: ["Тяжело — но чисто", "Смахнул лапой"], lead: ["Тяжесть победы", "Не толкай", "Сижу на горе очков"], behind: ["Ещё не рычал", "Зимняя спячка кончилась", "Разогреваюсь"], stuck: ["Застрял в чащобе", "Нужен топор"], win: ["Рычание победы", "Берлога защищена"], lose: ["Уважаю силу", "Вернусь жирнее", "Осень пришла"] } },
      { id: 'quest', name: 'Quest', av: ['#6f4117','#f3a55f','#96924f','#1f1a16'], title: 'Сильный', trophies: 473, interval: 1036, skill: 0.647, mistake: 0.122, style: { clearBias: 0.766, risk: 0.655, speedJitter: 0.209, preferSmall: 0.817 },
        phrases: { start: ["GG ещё не было", "Не AFK, обещаю", "Загрузка… 99%"], clear: ["Лут чистоты", "Комбо-дроп!"], lead: ["Diff огромный", "Ты в бронзе моего матча", "Carry себя сам"], behind: ["Сейчас камбек", "Ещё не mid-game"], stuck: ["Нужен гайд", "Баг карты?", "Застрял в туториале"], win: ["GG EZ… почти", "Попадание в хайлайт"], lose: ["GG WP", "Скилл issue… мой"] } },
      { id: 'rocket', name: 'Rocket', av: ['#273573','#2749e1','#451da2','#191d30'], title: 'Сильный', trophies: 500, interval: 1188, skill: 0.436, mistake: 0.236, style: { clearBias: 0.41, risk: 0.786, speedJitter: 0.576, preferSmall: 0.792 },
        phrases: { start: ["Скорость — мой допинг", "Не моргай!", "Поехалиооо!"], clear: ["Комбо-взрыв!", "Искры!"], lead: ["Ты в отставании!", "Догони ток!"], behind: ["Не считай меня", "Перегрузка… и вперёд", "Сейчас рывок!"], stuck: ["Завис. Перезагрузка!", "Где розетка?!"], win: ["Громче аплодисменты!", "Рекорд скорости!", "Я — вспышка"], lose: ["Коротнуло…", "Перезарядка", "Ладно, был шум"] } },
      { id: 'hash', name: 'Hash', av: ['#440c48','#ad47b4','#9d1866','#1d0f1d'], title: 'Сильный', trophies: 527, interval: 1252, skill: 0.56, mistake: 0.126, style: { clearBias: 0.673, risk: 0.259, speedJitter: 0.162, preferSmall: 0.894 },
        phrases: { start: ["O(n) мыслей в голове", "Проверяю эвристику"], clear: ["GC прошёл", "Строки освобождены", "Чистота кода"], lead: ["Оптимальный путь", "Твой Elo падает", "Метрики зелёные"], behind: ["Рефакторю стратегию", "Ещё итерация", "Баг в оценке… чиню"], stuck: ["Exception: no moves", "Нужен stack overflow… шутка", "Deadlock"], win: ["Assert(win)", "Тест пройден", "Merged to main"], lose: ["Откат коммита", "Нужен post-mortem", "Regression"] } },
      { id: 'turbo', name: 'Turbo', av: ['#843d46','#b62636','#bc7c57','#381c20'], title: 'Сильный', trophies: 555, interval: 1200, skill: 0.44, mistake: 0.219, style: { clearBias: 0.335, risk: 0.937, speedJitter: 0.491, preferSmall: 0.748 },
        phrases: { start: ["Не моргай!", "Скорость — мой допинг"], clear: ["Комбо-взрыв!", "Искры!"], lead: ["Я уже на орбите", "Догони ток!", "Ты в отставании!"], behind: ["Не считай меня", "Сейчас рывок!", "Перегрузка… и вперёд"], stuck: ["Где розетка?!", "Предохранитель!", "Завис. Перезагрузка!"], win: ["Я — вспышка", "Рекорд скорости!"], lose: ["Перезарядка", "Коротнуло…"] } },
      { id: 'boom', name: 'Boom', av: ['#492925','#ba4639','#957954','#2e211f'], title: 'Сильный', trophies: 583, interval: 1166, skill: 0.425, mistake: 0.23, style: { clearBias: 0.497, risk: 0.761, speedJitter: 0.438, preferSmall: 0.769 },
        phrases: { start: ["Не моргай!", "Скорость — мой допинг"], clear: ["Искры!", "Комбо-взрыв!"], lead: ["Я уже на орбите", "Ты в отставании!"], behind: ["Сейчас рывок!", "Не считай меня", "Перегрузка… и вперёд"], stuck: ["Предохранитель!", "Завис. Перезагрузка!"], win: ["Громче аплодисменты!", "Я — вспышка"], lose: ["Ладно, был шум", "Перезарядка"] } },
      { id: 'bulwark', name: 'Bulwark', av: ['#135f3f','#1ace83','#20848a','#161f1b'], title: 'Сильный', trophies: 611, interval: 1156, skill: 0.528, mistake: 0.137, style: { clearBias: 0.532, risk: 0.565, speedJitter: 0.21, preferSmall: 0.861 },
        phrases: { start: ["Р-р. Не буди.", "Медленно, но тяжело"], clear: ["Тяжело — но чисто", "Смахнул лапой", "Грр-комбо"], lead: ["Сижу на горе очков", "Тяжесть победы", "Не толкай"], behind: ["Зимняя спячка кончилась", "Ещё не рычал"], stuck: ["Грр… тупик", "Нужен топор", "Застрял в чащобе"], win: ["Рычание победы", "Можно спать", "Берлога защищена"], lose: ["Вернусь жирнее", "Уважаю силу"] } },
      { id: 'petal', name: 'Petal', av: ['#791f8a','#c01dde','#742059','#341d38'], title: 'Сильный', trophies: 640, interval: 1449, skill: 0.471, mistake: 0.122, style: { clearBias: 0.573, risk: 0.169, speedJitter: 0.211, preferSmall: 1.062 },
        phrases: { start: ["Дыши. Ходи.", "Тихий старт"], clear: ["Красиво же?", "Гармония строк"], lead: ["Всё идёт своим путём", "Не завидуй — расти", "Тихая уверенность"], behind: ["Цветы не спешат", "Ещё поливаю шансы", "Корень крепкий"], stuck: ["Пауза. Вдох.", "Нужен садовник"], win: ["Букет победы… почти тебе", "Спасибо за танец"], lose: ["Ты расцвёл ярче", "Урок принят", "Завтра новый бутон"] } },
      { id: 'bit', name: 'Bit', av: ['#272961','#575be8','#6e5093','#232431'], title: 'Сильный', trophies: 669, interval: 1204, skill: 0.552, mistake: 0.127, style: { clearBias: 0.735, risk: 0.201, speedJitter: 0.18, preferSmall: 0.992 },
        phrases: { start: ["Инициализация… ок", "O(n) мыслей в голове", "Проверяю эвристику"], clear: ["Чистота кода", "GC прошёл"], lead: ["Твой Elo падает", "Оптимальный путь", "Метрики зелёные"], behind: ["Баг в оценке… чиню", "Ещё итерация"], stuck: ["Exception: no moves", "Deadlock", "Нужен stack overflow… шутка"], win: ["Assert(win)", "Merged to main"], lose: ["Откат коммита", "Нужен post-mortem"] } },
      { id: 'knuckle', name: 'Knuckle', av: ['#2a2048','#7d62c9','#7f20a2','#28213c'], title: 'Сильный', trophies: 698, interval: 1139, skill: 0.521, mistake: 0.127, style: { clearBias: 0.352, risk: 0.475, speedJitter: 0.192, preferSmall: 0.734 },
        phrases: { start: ["Медленно, но тяжело", "Поле — моя берлога", "Р-р. Не буди."], clear: ["Тяжело — но чисто", "Грр-комбо"], lead: ["Сижу на горе очков", "Не толкай"], behind: ["Ещё не рычал", "Разогреваюсь"], stuck: ["Нужен топор", "Застрял в чащобе"], win: ["Берлога защищена", "Рычание победы", "Можно спать"], lose: ["Вернусь жирнее", "Осень пришла", "Уважаю силу"] } },
      { id: 'hyper', name: 'Hyper', av: ['#4b1942','#d262bd','#873c55','#2a2128'], title: 'Кандидат', trophies: 728, interval: 1193, skill: 0.445, mistake: 0.211, style: { clearBias: 0.431, risk: 0.799, speedJitter: 0.493, preferSmall: 0.702 },
        phrases: { start: ["Не моргай!", "3… 2… БАМ!", "Скорость — мой допинг"], clear: ["БАХ — и чисто", "Искры!"], lead: ["Ты в отставании!", "Я уже на орбите"], behind: ["Перегрузка… и вперёд", "Сейчас рывок!"], stuck: ["Завис. Перезагрузка!", "Предохранитель!"], win: ["Громче аплодисменты!", "Я — вспышка"], lose: ["Ладно, был шум", "Перезарядка", "Коротнуло…"] } },
      { id: 'logic', name: 'Logic', av: ['#331543','#922bca','#9d4492','#1b151f'], title: 'Кандидат', trophies: 758, interval: 1238, skill: 0.573, mistake: 0.099, style: { clearBias: 0.669, risk: 0.373, speedJitter: 0.178, preferSmall: 1.004 },
        phrases: { start: ["Проверяю эвристику", "Инициализация… ок", "O(n) мыслей в голове"], clear: ["Строки освобождены", "Чистота кода"], lead: ["Метрики зелёные", "Твой Elo падает"], behind: ["Баг в оценке… чиню", "Рефакторю стратегию"], stuck: ["Deadlock", "Exception: no moves"], win: ["Тест пройден", "Assert(win)", "Merged to main"], lose: ["Откат коммита", "Нужен post-mortem", "Regression"] } },
      { id: 'lag', name: 'Lag', av: ['#171a6f','#2b2fbd','#7a55a7','#24253b'], title: 'Кандидат', trophies: 789, interval: 950, skill: 0.669, mistake: 0.123, style: { clearBias: 0.622, risk: 0.689, speedJitter: 0.375, preferSmall: 0.898 },
        phrases: { start: ["Загрузка… 99%", "Не AFK, обещаю"], clear: ["Комбо-дроп!", "Лут чистоты", "Крит по линиям"], lead: ["Diff огромный", "Ты в бронзе моего матча", "Carry себя сам"], behind: ["Ещё не mid-game", "Сейчас камбек"], stuck: ["Застрял в туториале", "Баг карты?", "Нужен гайд"], win: ["GG EZ… почти", "Попадание в хайлайт"], lose: ["Скилл issue… мой", "GG WP"] } },
      { id: 'clutch', name: 'Clutch', av: ['#327f67','#6ff3cb','#229cb6','#132620'], title: 'Кандидат', trophies: 820, interval: 992, skill: 0.654, mistake: 0.113, style: { clearBias: 0.839, risk: 0.564, speedJitter: 0.388, preferSmall: 0.996 },
        phrases: { start: ["Не AFK, обещаю", "GG ещё не было"], clear: ["Крит по линиям", "Комбо-дроп!", "Лут чистоты"], lead: ["Ты в бронзе моего матча", "Carry себя сам", "Diff огромный"], behind: ["Ещё не mid-game", "Не токсик — факт", "Сейчас камбек"], stuck: ["Застрял в туториале", "Нужен гайд", "Баг карты?"], win: ["Ранг up", "GG EZ… почти"], lose: ["GG WP", "Скилл issue… мой", "Ремatch?"] } },
      { id: 'boulder', name: 'Boulder', av: ['#18623f','#6df3b2','#227473','#131e19'], title: 'Кандидат', trophies: 851, interval: 1086, skill: 0.547, mistake: 0.123, style: { clearBias: 0.395, risk: 0.48, speedJitter: 0.17, preferSmall: 0.879 },
        phrases: { start: ["Р-р. Не буди.", "Поле — моя берлога", "Медленно, но тяжело"], clear: ["Тяжело — но чисто", "Смахнул лапой", "Грр-комбо"], lead: ["Тяжесть победы", "Сижу на горе очков", "Не толкай"], behind: ["Разогреваюсь", "Зимняя спячка кончилась"], stuck: ["Грр… тупик", "Нужен топор"], win: ["Рычание победы", "Берлога защищена"], lose: ["Уважаю силу", "Вернусь жирнее", "Осень пришла"] } },
      { id: 'willow', name: 'Willow', av: ['#4d1f25','#e56473','#75340f','#36282a'], title: 'Кандидат', trophies: 882, interval: 1380, skill: 0.452, mistake: 0.138, style: { clearBias: 0.654, risk: 0.283, speedJitter: 0.113, preferSmall: 1.095 },
        phrases: { start: ["Без грубости, ладно?", "Поле — как сад"], clear: ["Лепестки…", "Красиво же?", "Гармония строк"], lead: ["Всё идёт своим путём", "Не завидуй — расти", "Тихая уверенность"], behind: ["Цветы не спешат", "Ещё поливаю шансы"], stuck: ["Пауза. Вдох.", "Нужен садовник"], win: ["Букет победы… почти тебе", "Спасибо за танец"], lose: ["Завтра новый бутон", "Ты расцвёл ярче", "Урок принят"] } },
      { id: 'blitz', name: 'Blitz', av: ['#326131','#26be21','#389461','#233b22'], title: 'Кандидат', trophies: 914, interval: 1203, skill: 0.46, mistake: 0.217, style: { clearBias: 0.436, risk: 0.763, speedJitter: 0.626, preferSmall: 0.657 },
        phrases: { start: ["3… 2… БАМ!", "Скорость — мой допинг", "Не моргай!"], clear: ["Разряд!", "Искры!", "БАХ — и чисто"], lead: ["Я уже на орбите", "Догони ток!", "Ты в отставании!"], behind: ["Сейчас рывок!", "Перегрузка… и вперёд", "Не считай меня"], stuck: ["Завис. Перезагрузка!", "Где розетка?!", "Предохранитель!"], win: ["Громче аплодисменты!", "Я — вспышка", "Рекорд скорости!"], lose: ["Перезарядка", "Коротнуло…", "Ладно, был шум"] } },
      { id: 'captain', name: 'Captain', av: ['#5f7847','#83ce38','#2d862b','#22271c'], title: 'Кандидат', trophies: 946, interval: 1261, skill: 0.55, mistake: 0.164, style: { clearBias: 0.423, risk: 0.741, speedJitter: 0.341, preferSmall: 0.99 },
        phrases: { start: ["Йо-хо, на абордаж!", "Паруса подняты"], clear: ["Палуба чиста!", "Добыча!", "За борт лишний ряд"], lead: ["Курс на победу", "Трюм полон очков"], behind: ["Ещё не на мели", "Шторм временный", "Полный вперёд!"], stuck: ["Нужен ветер", "Карта врёт?", "На мели…"], win: ["Флаг над полем", "Сокровище моё!"], lose: ["В другой порт", "Реванш на волнах", "Потоп…"] } },
      { id: 'mayhem', name: 'Mayhem', av: ['#764f35','#cf753b','#9e923e','#221d1a'], title: 'Кандидат', trophies: 978, interval: 686, skill: 0.844, mistake: 0.131, style: { clearBias: 0.434, risk: 0.719, speedJitter: 0.393, preferSmall: 0.814 },
        phrases: { start: ["Держись за край", "Кручу реальность"], clear: ["Случайная красота", "Всё в воронку!", "Хаос подчистил"], lead: ["Ты в спирали", "Я — эпицентр", "Не ориентируйся"], behind: ["Буря ещё впереди", "Перемешаю снова"], stuck: ["Сам себя закрутил", "Где верх?"], win: ["Хаос победил", "Осколки — тебе"], lose: ["Перезапуск вихря", "Кто-то стабильнее…", "Редко, но бывает"] } },
      { id: 'drift', name: 'Drift', av: ['#82842c','#f0f455','#8eb468','#3d3d2f'], title: 'Кандидат', trophies: 1011, interval: 978, skill: 0.659, mistake: 0.095, style: { clearBias: 0.866, risk: 0.31, speedJitter: 0.188, preferSmall: 1.015 },
        phrases: { start: ["Просто играем", "Без пафоса."], clear: ["Ледяной срез", "Как по маслу"], lead: ["Ожидаемо", "Держу темп", "Не суетись"], behind: ["Корректирую", "Ещё не вечер"], stuck: ["Пересчёт", "Пауза."], win: ["Готово", "Без сюрпризов", "Закрыли тему"], lose: ["В следующий раз", "Принял"] } },
      { id: 'whirl', name: 'Whirl', av: ['#2a524a','#5ac7b1','#4287a1','#2a3936'], title: 'Кандидат', trophies: 1044, interval: 699, skill: 0.844, mistake: 0.121, style: { clearBias: 0.56, risk: 0.825, speedJitter: 0.507, preferSmall: 0.687 },
        phrases: { start: ["Кручу реальность", "Порядок — скука", "Держись за край"], clear: ["Хаос подчистил", "Всё в воронку!", "Случайная красота"], lead: ["Не ориентируйся", "Я — эпицентр"], behind: ["Энтропия растёт", "Буря ещё впереди", "Перемешаю снова"], stuck: ["Где верх?", "Нужен якорь"], win: ["Хаос победил", "Поле снесено", "Осколки — тебе"], lose: ["Редко, но бывает", "Кто-то стабильнее…"] } },
      { id: 'trick', name: 'Trick', av: ['#5b3321','#ce744c','#9c873a','#2f201a'], title: 'Кандидат', trophies: 1077, interval: 878, skill: 0.74, mistake: 0.102, style: { clearBias: 0.49, risk: 0.699, speedJitter: 0.293, preferSmall: 0.976 },
        phrases: { start: ["Ушки на макушке", "Хитрость > сила", "Не зевай, лиса рядом"], clear: ["Иллюзия чистоты", "Как фокус", "Хвост мелькнул"], lead: ["Ты в моей норе", "Лисий отрыв"], behind: ["Не верь счёту", "Сейчас развернусь", "Притворная слабость"], stuck: ["Запуталась в следах", "Нужен новый трюк"], win: ["Хвост трубой", "Урок хитрости"], lose: ["В другой раз", "Уважаю охотника", "Унесла опыт"] } },
      { id: 'chaos', name: 'Chaos', av: ['#15116c','#2920e6','#4b1d74','#29283e'], title: 'Мастер', trophies: 1111, interval: 691, skill: 0.814, mistake: 0.092, style: { clearBias: 0.647, risk: 0.839, speedJitter: 0.441, preferSmall: 0.643 },
        phrases: { start: ["Держись за край", "Порядок — скука", "Кручу реальность"], clear: ["Всё в воронку!", "Хаос подчистил"], lead: ["Я — эпицентр", "Не ориентируйся", "Ты в спирали"], behind: ["Энтропия растёт", "Перемешаю снова"], stuck: ["Где верх?", "Нужен якорь"], win: ["Осколки — тебе", "Хаос победил", "Поле снесено"], lose: ["Кто-то стабильнее…", "Редко, но бывает", "Перезапуск вихря"] } },
      { id: 'tornado', name: 'Tornado', av: ['#682b3b','#e23965','#a63a1b','#1f1115'], title: 'Мастер', trophies: 1144, interval: 672, skill: 0.851, mistake: 0.111, style: { clearBias: 0.557, risk: 0.855, speedJitter: 0.56, preferSmall: 0.644 },
        phrases: { start: ["Порядок — скука", "Держись за край"], clear: ["Всё в воронку!", "Хаос подчистил"], lead: ["Не ориентируйся", "Ты в спирали", "Я — эпицентр"], behind: ["Энтропия растёт", "Перемешаю снова"], stuck: ["Нужен якорь", "Сам себя закрутил"], win: ["Осколки — тебе", "Хаос победил"], lose: ["Перезапуск вихря", "Редко, но бывает", "Кто-то стабильнее…"] } },
      { id: 'jazz', name: 'Jazz', av: ['#476820','#75b626','#49a942','#303529'], title: 'Мастер', trophies: 1178, interval: 730, skill: 0.853, mistake: 0.066, style: { clearBias: 0.735, risk: 0.646, speedJitter: 0.354, preferSmall: 0.941 },
        phrases: { start: ["Не финти, играй", "Мяч у меня… почти", "С площадки — на поле"], clear: ["Чистая атака", "Слэм!", "В кольцо линий"], lead: ["Не догонишь", "Веду счёт", "Стрит-контроль"], behind: ["Сейчас прорыв", "Тайм-аут в голове"], stuck: ["Нужен пас… себе", "Фол ситуации", "Зажат в углу"], win: ["Игра сделана", "MVP матча"], lose: ["Жёсткий оппонент", "Реванш на улице", "В зал — тренироваться"] } },
      { id: 'velvet', name: 'Velvet', av: ['#663b58','#ec59ba','#aa4a5b','#331f2c'], title: 'Мастер', trophies: 1213, interval: 1006, skill: 0.698, mistake: 0.077, style: { clearBias: 0.876, risk: 0.295, speedJitter: 0.198, preferSmall: 1.013 },
        phrases: { start: ["Просто играем", "Холодно и точно", "Без пафоса."], clear: ["Ледяной срез", "Как по маслу"], lead: ["Ожидаемо", "Не суетись"], behind: ["Интересно…", "Корректирую"], stuck: ["Пауза.", "Пересчёт", "Редко, но бывает"], win: ["Без сюрпризов", "Готово"], lose: ["Урок записан", "В следующий раз", "Принял"] } },
      { id: 'noir', name: 'Noir', av: ['#868229','#e9e017','#6ea329','#242312'], title: 'Мастер', trophies: 1247, interval: 1012, skill: 0.688, mistake: 0.093, style: { clearBias: 0.735, risk: 0.371, speedJitter: 0.235, preferSmall: 1.024 },
        phrases: { start: ["Без пафоса.", "Просто играем", "Холодно и точно"], clear: ["Как по маслу", "Чисто. Дальше."], lead: ["Ожидаемо", "Держу темп", "Не суетись"], behind: ["Интересно…", "Корректирую", "Ещё не вечер"], stuck: ["Пересчёт", "Пауза.", "Редко, но бывает"], win: ["Закрыли тему", "Готово", "Без сюрпризов"], lose: ["Урок записан", "В следующий раз"] } },
      { id: 'ember', name: 'Ember', av: ['#1c4144','#44deec','#225391','#1d3234'], title: 'Мастер', trophies: 1282, interval: 886, skill: 0.749, mistake: 0.088, style: { clearBias: 0.697, risk: 0.543, speedJitter: 0.34, preferSmall: 0.983 },
        phrases: { start: ["Ушки на макушке", "Хитрость > сила"], clear: ["Как фокус", "Хвост мелькнул", "Иллюзия чистоты"], lead: ["Ты в моей норе", "Подловила"], behind: ["Притворная слабость", "Сейчас развернусь"], stuck: ["Запуталась в следах", "Ой.", "Нужен новый трюк"], win: ["Урок хитрости", "Хвост трубой"], lose: ["В другой раз", "Уважаю охотника"] } },
      { id: 'rift', name: 'Rift', av: ['#1b6051','#40c2a5','#2e6a7e','#2b3a37'], title: 'Мастер', trophies: 1317, interval: 652, skill: 0.815, mistake: 0.098, style: { clearBias: 0.649, risk: 0.934, speedJitter: 0.367, preferSmall: 0.88 },
        phrases: { start: ["Кручу реальность", "Держись за край"], clear: ["Всё в воронку!", "Хаос подчистил"], lead: ["Не ориентируйся", "Я — эпицентр", "Ты в спирали"], behind: ["Буря ещё впереди", "Перемешаю снова", "Энтропия растёт"], stuck: ["Сам себя закрутил", "Где верх?"], win: ["Осколки — тебе", "Поле снесено"], lose: ["Кто-то стабильнее…", "Редко, но бывает"] } },
      { id: 'wave', name: 'Wave', av: ['#406d28','#57bf20','#289d38','#1e231b'], title: 'Мастер', trophies: 1353, interval: 1006, skill: 0.693, mistake: 0.085, style: { clearBias: 0.877, risk: 0.203, speedJitter: 0.131, preferSmall: 0.915 },
        phrases: { start: ["Просто играем", "Без пафоса."], clear: ["Ледяной срез", "Как по маслу"], lead: ["Не суетись", "Ожидаемо", "Держу темп"], behind: ["Интересно…", "Корректирую"], stuck: ["Редко, но бывает", "Пересчёт"], win: ["Готово", "Без сюрпризов", "Закрыли тему"], lose: ["Урок записан", "В следующий раз"] } },
      { id: 'frame', name: 'Frame', av: ['#6b7720','#c0d434','#448c17','#13150a'], title: 'Мастер', trophies: 1388, interval: 651, skill: 0.85, mistake: 0.048, style: { clearBias: 0.873, risk: 0.16, speedJitter: 0.038, preferSmall: 1.031 },
        phrases: { start: ["Системы: ОК", "Калибровка завершена"], clear: ["Эффективность +1", "Сектор очищен"], lead: ["Твой KPI падает", "Преимущество подтверждено", "Оптимум достигнут"], behind: ["Пересчёт траектории", "Коррекция курса"], stuck: ["Заторможен", "Ошибка 404: ход", "Нужна диагностика"], win: ["Миссия выполнена", "Отключение эмоций… шутка", "Отчёт отправлен"], lose: ["Обновление прошивки", "Анализ поражения", "В следующий цикл"] } },
      { id: 'vixen', name: 'Vixen', av: ['#3e521e','#aff53e','#58ad4a','#2c3321'], title: 'Мастер', trophies: 1424, interval: 913, skill: 0.742, mistake: 0.097, style: { clearBias: 0.624, risk: 0.626, speedJitter: 0.279, preferSmall: 0.848 },
        phrases: { start: ["Не зевай, лиса рядом", "Хитрость > сила", "Ушки на макушке"], clear: ["Хвост мелькнул", "Как фокус", "Иллюзия чистоты"], lead: ["Лисий отрыв", "Ты в моей норе", "Подловила"], behind: ["Притворная слабость", "Сейчас развернусь", "Не верь счёту"], stuck: ["Запуталась в следах", "Ой.", "Нужен новый трюк"], win: ["Хвост трубой", "Урок хитрости"], lose: ["Уважаю охотника", "Унесла опыт", "В другой раз"] } },
      { id: 'circuit', name: 'Circuit', av: ['#542420','#b3160a','#a66a20','#3b2321'], title: 'Мастер', trophies: 1460, interval: 617, skill: 0.858, mistake: 0.055, style: { clearBias: 0.825, risk: 0.209, speedJitter: 0.038, preferSmall: 1.083 },
        phrases: { start: ["Цель: победа", "Системы: ОК"], clear: ["Мусор удалён", "Сектор очищен"], lead: ["Твой KPI падает", "Преимущество подтверждено"], behind: ["Коррекция курса", "Ещё цикл"], stuck: ["Ошибка 404: ход", "Нужна диагностика"], win: ["Миссия выполнена", "Отчёт отправлен", "Отключение эмоций… шутка"], lose: ["Анализ поражения", "Обновление прошивки"] } },
      { id: 'chill', name: 'Chill', av: ['#517417','#8dc530','#2ba717','#272b1f'], title: 'Мастер', trophies: 1496, interval: 985, skill: 0.681, mistake: 0.075, style: { clearBias: 0.75, risk: 0.271, speedJitter: 0.219, preferSmall: 0.912 },
        phrases: { start: ["Просто играем", "Без пафоса.", "Холодно и точно"], clear: ["Ледяной срез", "Как по маслу", "Чисто. Дальше."], lead: ["Не суетись", "Держу темп"], behind: ["Ещё не вечер", "Корректирую", "Интересно…"], stuck: ["Редко, но бывает", "Пауза."], win: ["Без сюрпризов", "Закрыли тему"], lose: ["В следующий раз", "Принял", "Урок записан"] } },
      { id: 'unit', name: 'Unit', av: ['#24404d','#309bcd','#1d3389','#111517'], title: 'Мастер', trophies: 1533, interval: 584, skill: 0.844, mistake: 0.059, style: { clearBias: 0.837, risk: 0.129, speedJitter: 0.102, preferSmall: 1.073 },
        phrases: { start: ["Калибровка завершена", "Системы: ОК"], clear: ["Мусор удалён", "Эффективность +1"], lead: ["Твой KPI падает", "Преимущество подтверждено", "Оптимум достигнут"], behind: ["Коррекция курса", "Ещё цикл", "Пересчёт траектории"], stuck: ["Ошибка 404: ход", "Нужна диагностика"], win: ["Отчёт отправлен", "Миссия выполнена", "Отключение эмоций… шутка"], lose: ["Обновление прошивки", "Анализ поражения", "В следующий цикл"] } },
      { id: 'ray', name: 'Ray', av: ['#332f54','#5447bc','#6d4687','#282636'], title: 'Мастер', trophies: 1570, interval: 793, skill: 0.775, mistake: 0.081, style: { clearBias: 0.778, risk: 0.322, speedJitter: 0.164, preferSmall: 0.991 },
        phrases: { start: ["Грею поле", "Не щурься — играй", "Свет включён"], clear: ["Вспышка линий", "Ярко и чисто"], lead: ["Тень — это ты", "Пик дня", "Сияю"], behind: ["Закат временный", "Ещё взойду"], stuck: ["Скоро прояснится", "Облака"], win: ["Полдень победы", "Ослепительно", "Свет мой"], lose: ["Зашло солнце", "Завтра снова", "Ночь учит"] } },
      { id: 'flare', name: 'Flare', av: ['#3a3388','#5142e5','#643489','#232137'], title: 'Гроссмейстер', trophies: 1607, interval: 818, skill: 0.81, mistake: 0.077, style: { clearBias: 0.823, risk: 0.342, speedJitter: 0.17, preferSmall: 0.851 },
        phrases: { start: ["Грею поле", "Не щурься — играй", "Свет включён"], clear: ["Солнечный удар", "Ярко и чисто", "Вспышка линий"], lead: ["Тень — это ты", "Сияю", "Пик дня"], behind: ["Закат временный", "Ещё взойду", "Сумерки лгут"], stuck: ["Скоро прояснится", "Облака", "Затмение…"], win: ["Ослепительно", "Свет мой", "Полдень победы"], lose: ["Зашло солнце", "Завтра снова", "Ночь учит"] } },
      { id: 'swipe', name: 'Swipe', av: ['#377a65','#32d6a0','#316a74','#1d2623'], title: 'Гроссмейстер', trophies: 1644, interval: 696, skill: 0.841, mistake: 0.073, style: { clearBias: 0.665, risk: 0.579, speedJitter: 0.358, preferSmall: 0.815 },
        phrases: { start: ["Мяч у меня… почти", "Не финти, играй", "С площадки — на поле"], clear: ["Чистая атака", "Слэм!"], lead: ["Веду счёт", "Не догонишь"], behind: ["Давление — топливо", "Тайм-аут в голове"], stuck: ["Нужен пас… себе", "Фол ситуации", "Зажат в углу"], win: ["Игра сделана", "MVP матча"], lose: ["Реванш на улице", "Жёсткий оппонент"] } },
      { id: 'frost', name: 'Frost', av: ['#565e1e','#d9f128','#5c9337','#1d1d17'], title: 'Гроссмейстер', trophies: 1681, interval: 952, skill: 0.706, mistake: 0.091, style: { clearBias: 0.769, risk: 0.357, speedJitter: 0.178, preferSmall: 0.952 },
        phrases: { start: ["Просто играем", "Холодно и точно"], clear: ["Как по маслу", "Чисто. Дальше.", "Ледяной срез"], lead: ["Ожидаемо", "Не суетись"], behind: ["Ещё не вечер", "Интересно…"], stuck: ["Редко, но бывает", "Пауза."], win: ["Без сюрпризов", "Закрыли тему"], lose: ["Принял", "Урок записан", "В следующий раз"] } },
      { id: 'opal', name: 'Opal', av: ['#365d49','#5ddf9f','#29a4a2','#162c21'], title: 'Гроссмейстер', trophies: 1719, interval: 556, skill: 0.908, mistake: 0.025, style: { clearBias: 0.924, risk: 0.187, speedJitter: 0.119, preferSmall: 1.019 },
        phrases: { start: ["Шахматы… почти", "Покажи культуру игры", "Изящно, без суеты"], clear: ["Без лишнего шума", "Элегантный срез", "Как ноты"], lead: ["Ты чуть фальшивишь", "Темп мой", "Держу партитуру"], behind: ["Ещё не финал", "Интересный поворот", "Корректирую"], stuck: ["Пауза в такте", "Редкий диссонанс", "Нужна импровизация"], win: ["Браво… себе", "Занавес"], lose: ["Encore — в другой раз", "Спасибо за партию"] } },
      { id: 'cyber', name: 'Cyber', av: ['#216379','#3a9fc2','#425eab','#121c1f'], title: 'Гроссмейстер', trophies: 1757, interval: 517, skill: 0.898, mistake: 0.03, style: { clearBias: 0.857, risk: 0.172, speedJitter: 0.051, preferSmall: 0.97 },
        phrases: { start: ["Latency минимальна", "Сканирую поле", "Нейросеть online"], clear: ["Синхрон линий", "Оптимум", "Паттерн найден"], lead: ["Преимущество вычислено", "Прогноз: победа"], behind: ["Апдейт весов", "Переобучаюсь"], stuck: ["Локальный минимум", "Нужен escape", "Редкий fail"], win: ["Model deployed", "Accuracy 100%", "Inference complete"], lose: ["Retrain required", "Данные сохранены"] } },
      { id: 'aegis', name: 'Aegis', av: ['#527f25','#83e223','#3a9e38','#20261b'], title: 'Гроссмейстер', trophies: 1795, interval: 724, skill: 0.811, mistake: 0.066, style: { clearBias: 0.962, risk: 0.118, speedJitter: 0.131, preferSmall: 1.031 },
        phrases: { start: ["Только точные ходы", "Проверка доступа", "Замок закрыт"], clear: ["Запечатано", "Ноль утечек"], lead: ["Не взломать", "Ключ у меня"], behind: ["Пересчёт замков", "Временная щель", "Усиливаю защиту"], stuck: ["Нужна отмычка", "Редкий сбой", "Заело…"], win: ["Доступ запрещён тебе", "Запечатано. Конец."], lose: ["Урок безопасности", "Кто-то нашёл ключ", "Уязвимость закрыта… позже"] } },
      { id: 'neuron', name: 'Neuron', av: ['#4b140e','#f95a49','#be8d49','#3a211e'], title: 'Гроссмейстер', trophies: 1833, interval: 484, skill: 0.928, mistake: 0.052, style: { clearBias: 0.917, risk: 0.156, speedJitter: 0.144, preferSmall: 1.005 },
        phrases: { start: ["Сканирую поле", "Нейросеть online", "Latency минимальна"], clear: ["Оптимум", "Синхрон линий", "Паттерн найден"], lead: ["Преимущество вычислено", "Твой rank падает", "Прогноз: победа"], behind: ["Апдейт весов", "Ещё эпоха", "Переобучаюсь"], stuck: ["Редкий fail", "Локальный минимум", "Нужен escape"], win: ["Model deployed", "Inference complete", "Accuracy 100%"], lose: ["Данные сохранены", "Retrain required"] } },
      { id: 'vera', name: 'Vera', av: ['#472e11','#c78a42','#afb048','#302519'], title: 'Гроссмейстер', trophies: 1872, interval: 546, skill: 0.915, mistake: 0.056, style: { clearBias: 0.822, risk: 0.166, speedJitter: 0.16, preferSmall: 1.047 },
        phrases: { start: ["Покажи культуру игры", "Шахматы… почти"], clear: ["Элегантный срез", "Как ноты"], lead: ["Держу партитуру", "Темп мой"], behind: ["Интересный поворот", "Ещё не финал", "Корректирую"], stuck: ["Пауза в такте", "Редкий диссонанс", "Нужна импровизация"], win: ["Занавес", "Браво… себе"], lose: ["Достойный партнёр", "Encore — в другой раз", "Спасибо за партию"] } },
      { id: 'rune', name: 'Rune', av: ['#424e1b','#bde048','#4caf24','#22251b'], title: 'Гроссмейстер', trophies: 1911, interval: 457, skill: 0.924, mistake: 0.025, style: { clearBias: 0.871, risk: 0.176, speedJitter: 0.071, preferSmall: 1.062 },
        phrases: { start: ["Не спорь с судьбой… шутка", "Чувствую узор", "Карты уже легли"], clear: ["Знак принят", "Магия линий"], lead: ["Звёзды за меня", "Твоя нить тоньше"], behind: ["Ещё не всё прочитано", "Меняю расклад", "Затмение временное"], stuck: ["Нужен новый ритуал", "Туман…"], win: ["Свечи гасну", "Судьба закрыта"], lose: ["Урок смирения", "Редкое затмение"] } },
      { id: 'alpha', name: 'Alpha', av: ['#44797d','#35c4ce','#326cb2','#0d1617'], title: 'Гроссмейстер', trophies: 1950, interval: 629, skill: 0.89, mistake: 0.037, style: { clearBias: 0.553, risk: 0.422, speedJitter: 0.197, preferSmall: 0.827 },
        phrases: { start: ["Охота началась", "Ррр. Мелкий?", "Не беги — всё равно догоню"], clear: ["Раздавил линию", "Апетит растёт"], lead: ["Ты — закуска", "Вершина цепи"], behind: ["Разгон…", "Не рано радуйся"], stuck: ["Ррр… застрял", "Нужна эволюция", "В яме смолы…"], win: ["Рёв победы", "Альфа подтверждён", "Кости врагов"], lose: ["Эволюция не остановится", "Уважаю сильного"] } },
      { id: 'aura', name: 'Aura', av: ['#251945','#633ccc','#84379e','#18151f'], title: 'Гроссмейстер', trophies: 1989, interval: 410, skill: 0.965, mistake: 0.035, style: { clearBias: 0.861, risk: 0.19, speedJitter: 0.095, preferSmall: 1.041 },
        phrases: { start: ["Не спорь с судьбой… шутка", "Карты уже легли", "Чувствую узор"], clear: ["Магия линий", "Знак принят"], lead: ["Предсказано", "Твоя нить тоньше"], behind: ["Меняю расклад", "Ещё не всё прочитано", "Затмение временное"], stuck: ["Туман…", "Нужен новый ритуал", "Редкий сбой чар"], win: ["Судьба закрыта", "Свечи гасну"], lose: ["Урок смирения", "Ты переписал знак", "Редкое затмение"] } },
      { id: 'clamp', name: 'Clamp', av: ['#633d47','#ee5982','#9d5644','#1d1718'], title: 'Гроссмейстер', trophies: 2028, interval: 763, skill: 0.843, mistake: 0.033, style: { clearBias: 0.85, risk: 0.229, speedJitter: 0.051, preferSmall: 1.007 },
        phrases: { start: ["Проверка доступа", "Замок закрыт", "Только точные ходы"], clear: ["Ноль утечек", "Шифр сошёлся"], lead: ["Ключ у меня", "Контроль полный"], behind: ["Пересчёт замков", "Усиливаю защиту", "Временная щель"], stuck: ["Редкий сбой", "Нужна отмычка"], win: ["Сейф цел", "Запечатано. Конец."], lose: ["Кто-то нашёл ключ", "Урок безопасности"] } },
      { id: 'irisx', name: 'IrisX', av: ['#752d59','#f852b8','#7a444b','#372a32'], title: 'Гроссмейстер', trophies: 2068, interval: 462, skill: 0.954, mistake: 0.018, style: { clearBias: 0.946, risk: 0.4, speedJitter: 0.173, preferSmall: 1.01 },
        phrases: { start: ["Разложу твою игру", "Не смотри прямо — ослепнешь"], clear: ["Спектр чист", "Радуга линий", "Грань за гранью"], lead: ["Преломляю шансы", "Ярче тебя"], behind: ["Угол атаки новый", "Ещё отражусь", "Тень на грани"], stuck: ["Редко тускнею", "Трещина…"], win: ["Ты в тени", "Сияние полное", "Грани победы"], lose: ["Кто-то ярче…", "Заточились", "Урок отражения"] } },
      { id: 'safe', name: 'Safe', av: ['#0f463a','#1bc8a2','#2781a0','#2a3936'], title: 'Гроссмейстер', trophies: 2107, interval: 776, skill: 0.839, mistake: 0.045, style: { clearBias: 0.881, risk: 0.139, speedJitter: 0.082, preferSmall: 1.12 },
        phrases: { start: ["Проверка доступа", "Только точные ходы", "Замок закрыт"], clear: ["Запечатано", "Ноль утечек"], lead: ["Не взломать", "Контроль полный"], behind: ["Временная щель", "Пересчёт замков"], stuck: ["Нужна отмычка", "Редкий сбой", "Заело…"], win: ["Сейф цел", "Доступ запрещён тебе"], lose: ["Уязвимость закрыта… позже", "Урок безопасности"] } },
      { id: 'dino', name: 'Dino', av: ['#794d80','#a319bb','#760f53','#241427'], title: 'Гроссмейстер', trophies: 2147, interval: 578, skill: 0.899, mistake: 0.07, style: { clearBias: 0.562, risk: 0.41, speedJitter: 0.273, preferSmall: 0.785 },
        phrases: { start: ["Охота началась", "Ррр. Мелкий?", "Не беги — всё равно догоню"], clear: ["Раздавил линию", "Апетит растёт", "Хруст комбо"], lead: ["Вершина цепи", "Доминирую"], behind: ["Разгон…", "Не рано радуйся"], stuck: ["Ррр… застрял", "В яме смолы…", "Нужна эволюция"], win: ["Рёв победы", "Альфа подтверждён"], lose: ["Следующий век — мой", "Эволюция не остановится"] } },
      { id: 'charm', name: 'Charm', av: ['#546d45','#a0ec73','#51b05a','#1c2317'], title: 'Гроссмейстер', trophies: 2188, interval: 431, skill: 0.953, mistake: 0.015, style: { clearBias: 0.896, risk: 0.265, speedJitter: 0.077, preferSmall: 1.017 },
        phrases: { start: ["Карты уже легли", "Не спорь с судьбой… шутка"], clear: ["Рунный срез", "Магия линий", "Знак принят"], lead: ["Предсказано", "Твоя нить тоньше"], behind: ["Затмение временное", "Ещё не всё прочитано", "Меняю расклад"], stuck: ["Редкий сбой чар", "Туман…"], win: ["Свечи гасну", "Судьба закрыта", "Как и гадала"], lose: ["Редкое затмение", "Урок смирения", "Ты переписал знак"] } },
      { id: 'chroma', name: 'Chroma', av: ['#592a24','#ec4a34','#806337','#3a2320'], title: 'Элита', trophies: 2228, interval: 478, skill: 0.97, mistake: 0.011, style: { clearBias: 0.84, risk: 0.363, speedJitter: 0.19, preferSmall: 0.908 },
        phrases: { start: ["Не смотри прямо — ослепнешь", "Цвета готовы"], clear: ["Спектр чист", "Радуга линий", "Грань за гранью"], lead: ["Полный спектр", "Преломляю шансы", "Ярче тебя"], behind: ["Угол атаки новый", "Тень на грани", "Ещё отражусь"], stuck: ["Редко тускнею", "Нужна полировка", "Трещина…"], win: ["Сияние полное", "Грани победы", "Ты в тени"], lose: ["Заточились", "Кто-то ярче…"] } },
      { id: 'locke', name: 'Locke', av: ['#5d1028','#f70d55','#a0695d','#3e2029'], title: 'Элита', trophies: 2269, interval: 701, skill: 0.818, mistake: 0.054, style: { clearBias: 0.864, risk: 0.179, speedJitter: 0.086, preferSmall: 1.011 },
        phrases: { start: ["Только точные ходы", "Замок закрыт", "Проверка доступа"], clear: ["Шифр сошёлся", "Запечатано", "Ноль утечек"], lead: ["Не взломать", "Ключ у меня", "Контроль полный"], behind: ["Пересчёт замков", "Усиливаю защиту"], stuck: ["Редкий сбой", "Заело…"], win: ["Доступ запрещён тебе", "Сейф цел", "Запечатано. Конец."], lose: ["Урок безопасности", "Кто-то нашёл ключ"] } },
      { id: 'titanlite', name: 'Titan-lite', av: ['#691b6b','#be1ec2','#af417e','#151015'], title: 'Элита', trophies: 2309, interval: 564, skill: 0.866, mistake: 0.049, style: { clearBias: 0.569, risk: 0.419, speedJitter: 0.198, preferSmall: 0.877 },
        phrases: { start: ["Не беги — всё равно догоню", "Охота началась"], clear: ["Раздавил линию", "Хруст комбо", "Апетит растёт"], lead: ["Доминирую", "Вершина цепи"], behind: ["Не рано радуйся", "Разгон…", "Хищник терпелив"], stuck: ["Нужна эволюция", "Ррр… застрял"], win: ["Рёв победы", "Кости врагов", "Альфа подтверждён"], lose: ["Эволюция не остановится", "Следующий век — мой", "Уважаю сильного"] } },
      { id: 'iris', name: 'Iris', av: ['#46352d','#df5c1c','#7a6b2b','#302723'], title: 'Элита', trophies: 2350, interval: 542, skill: 0.877, mistake: 0.022, style: { clearBias: 0.896, risk: 0.259, speedJitter: 0.188, preferSmall: 0.964 },
        phrases: { start: ["Шахматы… почти", "Изящно, без суеты", "Покажи культуру игры"], clear: ["Без лишнего шума", "Элегантный срез"], lead: ["Держу партитуру", "Темп мой"], behind: ["Интересный поворот", "Ещё не финал", "Корректирую"], stuck: ["Редкий диссонанс", "Нужна импровизация", "Пауза в такте"], win: ["Браво… себе", "Аплодисменты уместны"], lose: ["Encore — в другой раз", "Спасибо за партию", "Достойный партнёр"] } },
      { id: 'rivet', name: 'Rivet', av: ['#5f175c','#f03ee8','#b64279','#170f17'], title: 'Элита', trophies: 2391, interval: 715, skill: 0.864, mistake: 0.037, style: { clearBias: 0.914, risk: 0.199, speedJitter: 0.059, preferSmall: 1.082 },
        phrases: { start: ["Проверка доступа", "Только точные ходы"], clear: ["Запечатано", "Шифр сошёлся", "Ноль утечек"], lead: ["Ключ у меня", "Не взломать", "Контроль полный"], behind: ["Усиливаю защиту", "Временная щель"], stuck: ["Редкий сбой", "Заело…"], win: ["Сейф цел", "Доступ запрещён тебе"], lose: ["Урок безопасности", "Кто-то нашёл ключ", "Уязвимость закрыта… позже"] } },
      { id: 'zoya', name: 'Zoya', av: ['#542367','#a740d0','#9f5490','#35223d'], title: 'Элита', trophies: 2433, interval: 452, skill: 0.956, mistake: 0.035, style: { clearBias: 0.938, risk: 0.219, speedJitter: 0.062, preferSmall: 1.064 },
        phrases: { start: ["Карты уже легли", "Не спорь с судьбой… шутка"], clear: ["Знак принят", "Магия линий"], lead: ["Предсказано", "Твоя нить тоньше", "Звёзды за меня"], behind: ["Меняю расклад", "Ещё не всё прочитано"], stuck: ["Редкий сбой чар", "Туман…", "Нужен новый ритуал"], win: ["Свечи гасну", "Судьба закрыта", "Как и гадала"], lose: ["Урок смирения", "Редкое затмение", "Ты переписал знак"] } },
      { id: 'bolt', name: 'Bolt', av: ['#613a77','#862ab8','#b846aa','#241c29'], title: 'Элита', trophies: 2474, interval: 748, skill: 0.862, mistake: 0.055, style: { clearBias: 0.964, risk: 0.232, speedJitter: 0.076, preferSmall: 1.098 },
        phrases: { start: ["Замок закрыт", "Только точные ходы", "Проверка доступа"], clear: ["Запечатано", "Шифр сошёлся", "Ноль утечек"], lead: ["Ключ у меня", "Контроль полный", "Не взломать"], behind: ["Усиливаю защиту", "Пересчёт замков", "Временная щель"], stuck: ["Нужна отмычка", "Редкий сбой", "Заело…"], win: ["Сейф цел", "Запечатано. Конец.", "Доступ запрещён тебе"], lose: ["Уязвимость закрыта… позже", "Урок безопасности"] } },
      { id: 'facet', name: 'Facet', av: ['#692b3a','#ee5277','#b26a53','#151011'], title: 'Элита', trophies: 2516, interval: 425, skill: 0.964, mistake: 0.025, style: { clearBias: 0.847, risk: 0.301, speedJitter: 0.096, preferSmall: 1.028 },
        phrases: { start: ["Разложу твою игру", "Не смотри прямо — ослепнешь"], clear: ["Спектр чист", "Радуга линий"], lead: ["Преломляю шансы", "Ярче тебя"], behind: ["Угол атаки новый", "Тень на грани", "Ещё отражусь"], stuck: ["Нужна полировка", "Редко тускнею", "Трещина…"], win: ["Сияние полное", "Ты в тени"], lose: ["Заточились", "Урок отражения", "Кто-то ярче…"] } },
      { id: 'seal', name: 'Seal', av: ['#1e4155','#2895d4','#3a4687','#161c20'], title: 'Элита', trophies: 2558, interval: 691, skill: 0.869, mistake: 0.054, style: { clearBias: 0.879, risk: 0.134, speedJitter: 0.071, preferSmall: 1.098 },
        phrases: { start: ["Только точные ходы", "Замок закрыт"], clear: ["Запечатано", "Ноль утечек", "Шифр сошёлся"], lead: ["Ключ у меня", "Не взломать"], behind: ["Усиливаю защиту", "Пересчёт замков", "Временная щель"], stuck: ["Нужна отмычка", "Заело…", "Редкий сбой"], win: ["Сейф цел", "Доступ запрещён тебе", "Запечатано. Конец."], lose: ["Урок безопасности", "Уязвимость закрыта… позже"] } },
      { id: 'apexx', name: 'ApexX', av: ['#217768','#3cf3d3','#1786b7','#121e1b'], title: 'Элита', trophies: 2600, interval: 264, skill: 1.0, mistake: 0.009, style: { clearBias: 0.986, risk: 0.074, speedJitter: 0.013, preferSmall: 1.04 },
        phrases: { start: ["Аудиенция началась", "Вершина не для «старающихся»", "Кланяйся. Или не мешай."], clear: ["Корона не дрогнула", "Даже не разогрелся"], lead: ["Ты ещё здесь?", "Подданные отстают", "Естественно"], behind: ["Трон не шатается", "Временно. Как твоя надежда", "Забавно"], stuck: ["Редко досадно", "…неловко", "Кто допустил баг реальности?"], win: ["Можешь идти", "Урок окончен", "Корона на месте"], lose: ["Запомню имя. На минуту", "…Ты заслужил взгляд"] } },
      { id: 'crystal', name: 'Crystal', av: ['#363c54','#1e3cbe','#432198','#0d0f18'], title: 'Элита', trophies: 2642, interval: 437, skill: 0.942, mistake: 0.039, style: { clearBias: 0.888, risk: 0.293, speedJitter: 0.094, preferSmall: 0.908 },
        phrases: { start: ["Цвета готовы", "Разложу твою игру"], clear: ["Радуга линий", "Грань за гранью"], lead: ["Преломляю шансы", "Ярче тебя", "Полный спектр"], behind: ["Тень на грани", "Ещё отражусь"], stuck: ["Редко тускнею", "Нужна полировка", "Трещина…"], win: ["Грани победы", "Сияние полное", "Ты в тени"], lose: ["Урок отражения", "Кто-то ярче…", "Заточились"] } },
      { id: 'augur', name: 'Augur', av: ['#793132','#f3676a','#744116','#3f2e2e'], title: 'Элита', trophies: 2685, interval: 364, skill: 0.997, mistake: 0.001, style: { clearBias: 0.969, risk: 0.055, speedJitter: 0.032, preferSmall: 1.006 },
        phrases: { start: ["Страницы открыты", "Я уже видел конец"], clear: ["Знак выполнен", "Как в видении"], lead: ["Неизбежно", "Твоя глава короче"], behind: ["…неожиданный абзац", "Редко, очень редко", "Перечитаю"], stuck: ["Слепое пятно", "Аномалия судьбы", "Нужен новый свиток"], win: ["Книга закрыта", "Так было написано", "Оракул не ошибается"], lose: ["Новая пророчество… о тебе", "Ты переписал страницу", "Затмение века"] } },
      { id: 'prism', name: 'Prism', av: ['#1c2e5f','#1447d7','#3c2788','#171c29'], title: 'Элита', trophies: 2727, interval: 433, skill: 0.953, mistake: 0.009, style: { clearBias: 0.898, risk: 0.207, speedJitter: 0.185, preferSmall: 0.938 },
        phrases: { start: ["Не смотри прямо — ослепнешь", "Разложу твою игру"], clear: ["Радуга линий", "Спектр чист"], lead: ["Полный спектр", "Ярче тебя"], behind: ["Ещё отражусь", "Угол атаки новый", "Тень на грани"], stuck: ["Нужна полировка", "Трещина…", "Редко тускнею"], win: ["Ты в тени", "Грани победы"], lose: ["Заточились", "Урок отражения"] } },
      { id: 'destiny', name: 'Destiny', av: ['#5b1449','#d028a7','#b36178','#140b12'], title: 'Элита', trophies: 2770, interval: 363, skill: 1.0, mistake: 0.018, style: { clearBias: 0.968, risk: 0.103, speedJitter: 0.03, preferSmall: 1.018 },
        phrases: { start: ["Не удивляй — предсказано", "Страницы открыты"], clear: ["Как в видении", "Знак выполнен", "Нить обрезана чисто"], lead: ["Неизбежно", "Твоя глава короче"], behind: ["…неожиданный абзац", "Редко, очень редко"], stuck: ["Нужен новый свиток", "Слепое пятно"], win: ["Книга закрыта", "Так было написано", "Оракул не ошибается"], lose: ["Ты переписал страницу", "Новая пророчество… о тебе"] } },
      { id: 'quartz', name: 'Quartz', av: ['#35837b','#37b7aa','#1f5373','#172b29'], title: 'Легенда', trophies: 2813, interval: 471, skill: 0.958, mistake: 0.015, style: { clearBias: 0.943, risk: 0.254, speedJitter: 0.168, preferSmall: 0.956 },
        phrases: { start: ["Разложу твою игру", "Не смотри прямо — ослепнешь", "Цвета готовы"], clear: ["Грань за гранью", "Радуга линий", "Спектр чист"], lead: ["Преломляю шансы", "Ярче тебя", "Полный спектр"], behind: ["Угол атаки новый", "Тень на грани"], stuck: ["Трещина…", "Нужна полировка"], win: ["Грани победы", "Ты в тени", "Сияние полное"], lose: ["Урок отражения", "Кто-то ярче…", "Заточились"] } },
      { id: 'heir', name: 'Heir', av: ['#194637','#37c998','#1295ab','#1e2523'], title: 'Легенда', trophies: 2856, interval: 319, skill: 1.0, mistake: 0.0, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.027, preferSmall: 1.023 },
        phrases: { start: ["Аудиенция началась", "Кланяйся. Или не мешай.", "Вершина не для «старающихся»"], clear: ["Корона не дрогнула", "Даже не разогрелся", "Ожидаемо"], lead: ["Естественно", "Подданные отстают"], behind: ["Забавно", "Временно. Как твоя надежда", "Трон не шатается"], stuck: ["Кто допустил баг реальности?", "…неловко", "Редко досадно"], win: ["Корона на месте", "Можешь идти", "Урок окончен"], lose: ["…Ты заслужил взгляд", "Трон дрогнул. Один раз.", "Запомню имя. На минуту"] } },
      { id: 'signal', name: 'Signal', av: ['#766922','#deca64','#9cb95e','#28261b'], title: 'Легенда', trophies: 2899, interval: 485, skill: 0.94, mistake: 0.04, style: { clearBias: 1.0, risk: 0.128, speedJitter: 0.083, preferSmall: 1.034 },
        phrases: { start: ["Сканирую поле", "Latency минимальна", "Нейросеть online"], clear: ["Синхрон линий", "Оптимум"], lead: ["Прогноз: победа", "Твой rank падает", "Преимущество вычислено"], behind: ["Переобучаюсь", "Ещё эпоха"], stuck: ["Нужен escape", "Редкий fail"], win: ["Model deployed", "Accuracy 100%", "Inference complete"], lose: ["Outlier detected", "Retrain required"] } },
      { id: 'shard', name: 'Shard', av: ['#653f6d','#b515d7','#9c1b74','#312434'], title: 'Легенда', trophies: 2943, interval: 398, skill: 0.941, mistake: 0.031, style: { clearBias: 0.995, risk: 0.234, speedJitter: 0.057, preferSmall: 1.034 },
        phrases: { start: ["Не смотри прямо — ослепнешь", "Разложу твою игру", "Цвета готовы"], clear: ["Радуга линий", "Спектр чист"], lead: ["Полный спектр", "Преломляю шансы", "Ярче тебя"], behind: ["Угол атаки новый", "Тень на грани"], stuck: ["Нужна полировка", "Редко тускнею"], win: ["Ты в тени", "Сияние полное", "Грани победы"], lose: ["Урок отражения", "Заточились", "Кто-то ярче…"] } },
      { id: 'prophet', name: 'Prophet', av: ['#4a171c','#ea6e7a','#9c6b4d','#281b1c'], title: 'Легенда', trophies: 2986, interval: 303, skill: 0.973, mistake: 0.009, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.047, preferSmall: 1.026 },
        phrases: { start: ["Не удивляй — предсказано", "Страницы открыты"], clear: ["Нить обрезана чисто", "Знак выполнен"], lead: ["Пишу финал", "Твоя глава короче", "Неизбежно"], behind: ["Редко, очень редко", "…неожиданный абзац"], stuck: ["Нужен новый свиток", "Слепое пятно"], win: ["Так было написано", "Оракул не ошибается"], lose: ["Затмение века", "Ты переписал страницу"] } },
      { id: 'epoch', name: 'Epoch', av: ['#61673a','#c0d145','#497c28','#1e1f13'], title: 'Легенда', trophies: 3030, interval: 323, skill: 1.0, mistake: 0.014, style: { clearBias: 1.0, risk: 0.052, speedJitter: 0.041, preferSmall: 1.0 },
        phrases: { start: ["Страницы открыты", "Не удивляй — предсказано"], clear: ["Знак выполнен", "Нить обрезана чисто", "Как в видении"], lead: ["Пишу финал", "Твоя глава короче"], behind: ["Редко, очень редко", "Перечитаю"], stuck: ["Аномалия судьбы", "Нужен новый свиток"], win: ["Так было написано", "Оракул не ошибается"], lose: ["Затмение века", "Ты переписал страницу", "Новая пророчество… о тебе"] } },
      { id: 'novax', name: 'NovaX', av: ['#393884','#3431de','#5c14a6','#2a2a3c'], title: 'Легенда', trophies: 3074, interval: 347, skill: 0.986, mistake: 0.0, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.069, preferSmall: 1.012 },
        phrases: { start: ["Ты — спутник", "Космос не прощает спешки", "Гравитация включена"], clear: ["Вакуум порядка", "Сверхновая линий", "Орбита чиста"], lead: ["Масса победы", "Событие горизонта"], behind: ["Ещё не коллапс", "Корректирую курс", "Красное смещение…"], stuck: ["Чёрная дыра ходов", "Редкий парадокс", "Нужен warp"], win: ["Звезда погасла — твоя", "Вселенная на моей стороне", "Коллапс твоих шансов"], lose: ["Большой взрыв опыта", "Аномалия…", "Перепишу константы"] } },
      { id: 'grid', name: 'Grid', av: ['#4d362f','#b76046','#b88c22','#271e1b'], title: 'Легенда', trophies: 3118, interval: 413, skill: 0.926, mistake: 0.034, style: { clearBias: 1.0, risk: 0.154, speedJitter: 0.061, preferSmall: 1.026 },
        phrases: { start: ["Нейросеть online", "Сканирую поле", "Latency минимальна"], clear: ["Оптимум", "Паттерн найден", "Синхрон линий"], lead: ["Прогноз: победа", "Преимущество вычислено"], behind: ["Переобучаюсь", "Ещё эпоха"], stuck: ["Локальный минимум", "Редкий fail", "Нужен escape"], win: ["Model deployed", "Inference complete"], lose: ["Retrain required", "Данные сохранены"] } },
      { id: 'iron', name: 'Iron', av: ['#1b3a49','#6eb9dd','#3e56bb','#252f34'], title: 'Легенда', trophies: 3163, interval: 310, skill: 0.974, mistake: 0.003, style: { clearBias: 1.0, risk: 0.081, speedJitter: 0.021, preferSmall: 1.025 },
        phrases: { start: ["Не пытайся сдвинуть", "Гора не двигается первой"], clear: ["Как молот", "Пласт ушёл", "Тяжесть порядка"], lead: ["Фундамент мой", "Несокрушимо", "Ты под нами"], behind: ["Усиливаю", "Ещё не дрогнул", "Трещина? Нет."], stuck: ["…заклинило", "Редко", "Нужен рычаг"], win: ["Пыль — под ногами", "Стоял и стою", "Монумент победы"], lose: ["Перекую себя", "Уважение", "Кто-то тяжелее…"] } },
      { id: 'emperor', name: 'Emperor', av: ['#1d5746','#33daa9','#3a7c8a','#0d1412'], title: 'Легенда', trophies: 3207, interval: 302, skill: 0.981, mistake: 0.017, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.025, preferSmall: 0.998 },
        phrases: { start: ["Кланяйся. Или не мешай.", "Аудиенция началась"], clear: ["Корона не дрогнула", "Ожидаемо", "Даже не разогрелся"], lead: ["Ты ещё здесь?", "Естественно"], behind: ["Трон не шатается", "Забавно"], stuck: ["Кто допустил баг реальности?", "…неловко", "Редко досадно"], win: ["Урок окончен", "Корона на месте"], lose: ["Запомню имя. На минуту", "Трон дрогнул. Один раз."] } },
      { id: 'hue', name: 'Hue', av: ['#427a4d','#21c742','#38997a','#1c2a1f'], title: 'Легенда', trophies: 3252, interval: 404, skill: 0.967, mistake: 0.024, style: { clearBias: 0.954, risk: 0.236, speedJitter: 0.072, preferSmall: 0.972 },
        phrases: { start: ["Цвета готовы", "Не смотри прямо — ослепнешь", "Разложу твою игру"], clear: ["Спектр чист", "Радуга линий"], lead: ["Ярче тебя", "Полный спектр", "Преломляю шансы"], behind: ["Угол атаки новый", "Тень на грани"], stuck: ["Редко тускнею", "Трещина…"], win: ["Грани победы", "Сияние полное", "Ты в тени"], lose: ["Заточились", "Урок отражения", "Кто-то ярче…"] } },
      { id: 'throne', name: 'Throne', av: ['#693668','#e15edf','#a44475','#2a172a'], title: 'Легенда', trophies: 3296, interval: 281, skill: 1.0, mistake: 0.013, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.02, preferSmall: 0.993 },
        phrases: { start: ["Аудиенция началась", "Вершина не для «старающихся»"], clear: ["Ожидаемо", "Корона не дрогнула", "Даже не разогрелся"], lead: ["Естественно", "Ты ещё здесь?"], behind: ["Временно. Как твоя надежда", "Трон не шатается", "Забавно"], stuck: ["Кто допустил баг реальности?", "Редко досадно", "…неловко"], win: ["Корона на месте", "Урок окончен"], lose: ["Трон дрогнул. Один раз.", "Запомню имя. На минуту"] } },
      { id: 'goliath', name: 'Goliath', av: ['#6b4943','#df705f','#9e845c','#1f1918'], title: 'Легенда', trophies: 3341, interval: 364, skill: 0.988, mistake: 0.001, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.043, preferSmall: 1.0 },
        phrases: { start: ["Давление включено", "Гора не двигается первой"], clear: ["Пласт ушёл", "Тяжесть порядка"], lead: ["Несокрушимо", "Фундамент мой"], behind: ["Усиливаю", "Трещина? Нет."], stuck: ["Нужен рычаг", "Редко"], win: ["Стоял и стою", "Пыль — под ногами"], lose: ["Кто-то тяжелее…", "Перекую себя", "Уважение"] } },
      { id: 'opaline', name: 'Opaline', av: ['#4b1a4d','#d514dd','#9b1962','#180e18'], title: 'Легенда', trophies: 3387, interval: 378, skill: 0.961, mistake: 0.02, style: { clearBias: 1.0, risk: 0.232, speedJitter: 0.068, preferSmall: 0.913 },
        phrases: { start: ["Не смотри прямо — ослепнешь", "Цвета готовы", "Разложу твою игру"], clear: ["Спектр чист", "Грань за гранью"], lead: ["Полный спектр", "Ярче тебя"], behind: ["Тень на грани", "Ещё отражусь", "Угол атаки новый"], stuck: ["Трещина…", "Нужна полировка"], win: ["Сияние полное", "Грани победы", "Ты в тени"], lose: ["Заточились", "Урок отражения"] } },
      { id: 'scepter', name: 'Scepter', av: ['#244a4f','#1cbacf','#506b93','#131e1f'], title: 'Чемпион', trophies: 3432, interval: 240, skill: 1.0, mistake: 0.002, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.02, preferSmall: 1.009 },
        phrases: { start: ["Аудиенция началась", "Вершина не для «старающихся»"], clear: ["Даже не разогрелся", "Корона не дрогнула"], lead: ["Подданные отстают", "Естественно", "Ты ещё здесь?"], behind: ["Забавно", "Трон не шатается"], stuck: ["…неловко", "Кто допустил баг реальности?"], win: ["Урок окончен", "Корона на месте", "Можешь идти"], lose: ["Трон дрогнул. Один раз.", "…Ты заслужил взгляд"] } },
      { id: 'thread', name: 'Thread', av: ['#692d6d','#be5ac5','#a14279','#3b233c'], title: 'Чемпион', trophies: 3477, interval: 347, skill: 0.997, mistake: 0.007, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.032, preferSmall: 1.019 },
        phrases: { start: ["Страницы открыты", "Не удивляй — предсказано"], clear: ["Нить обрезана чисто", "Знак выполнен", "Как в видении"], lead: ["Пишу финал", "Неизбежно"], behind: ["Перечитаю", "…неожиданный абзац"], stuck: ["Слепое пятно", "Нужен новый свиток"], win: ["Так было написано", "Оракул не ошибается", "Книга закрыта"], lose: ["Новая пророчество… о тебе", "Ты переписал страницу", "Затмение века"] } },
      { id: 'peak', name: 'Peak', av: ['#362b46','#9758ed','#81148d','#171020'], title: 'Чемпион', trophies: 3523, interval: 365, skill: 0.997, mistake: 0.0, style: { clearBias: 1.0, risk: 0.088, speedJitter: 0.025, preferSmall: 0.999 },
        phrases: { start: ["Гора не двигается первой", "Давление включено"], clear: ["Пласт ушёл", "Как молот"], lead: ["Фундамент мой", "Несокрушимо"], behind: ["Трещина? Нет.", "Ещё не дрогнул", "Усиливаю"], stuck: ["Нужен рычаг", "Редко"], win: ["Пыль — под ногами", "Стоял и стою", "Монумент победы"], lose: ["Перекую себя", "Кто-то тяжелее…"] } },
      { id: 'oracle', name: 'Oracle', av: ['#185932','#2fbf68','#3a837a','#111c15'], title: 'Чемпион', trophies: 3569, interval: 265, skill: 0.991, mistake: 0.0, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.032, preferSmall: 1.015 },
        phrases: { start: ["Я уже видел конец", "Страницы открыты", "Не удивляй — предсказано"], clear: ["Нить обрезана чисто", "Знак выполнен", "Как в видении"], lead: ["Твоя глава короче", "Пишу финал", "Неизбежно"], behind: ["…неожиданный абзац", "Перечитаю", "Редко, очень редко"], stuck: ["Аномалия судьбы", "Слепое пятно", "Нужен новый свиток"], win: ["Книга закрыта", "Так было написано", "Оракул не ошибается"], lose: ["Ты переписал страницу", "Затмение века", "Новая пророчество… о тебе"] } },
      { id: 'royal', name: 'Royal', av: ['#3b7b87','#62bbcb','#1d52ae','#101819'], title: 'Чемпион', trophies: 3614, interval: 283, skill: 1.0, mistake: 0.0, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.02, preferSmall: 0.996 },
        phrases: { start: ["Аудиенция началась", "Вершина не для «старающихся»"], clear: ["Ожидаемо", "Корона не дрогнула"], lead: ["Подданные отстают", "Ты ещё здесь?"], behind: ["Трон не шатается", "Временно. Как твоя надежда"], stuck: ["Кто допустил баг реальности?", "Редко досадно", "…неловко"], win: ["Урок окончен", "Корона на месте", "Можешь идти"], lose: ["…Ты заслужил взгляд", "Трон дрогнул. Один раз.", "Запомню имя. На минуту"] } },
      { id: 'sybil', name: 'Sybil', av: ['#733081','#d361eb','#962273','#251e26'], title: 'Чемпион', trophies: 3660, interval: 317, skill: 0.983, mistake: 0.0, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.025, preferSmall: 1.04 },
        phrases: { start: ["Не удивляй — предсказано", "Страницы открыты"], clear: ["Нить обрезана чисто", "Знак выполнен"], lead: ["Твоя глава короче", "Неизбежно", "Пишу финал"], behind: ["…неожиданный абзац", "Перечитаю", "Редко, очень редко"], stuck: ["Нужен новый свиток", "Аномалия судьбы", "Слепое пятно"], win: ["Так было написано", "Оракул не ошибается"], lose: ["Ты переписал страницу", "Затмение века"] } },
      { id: 'gleam', name: 'Gleam', av: ['#552746','#bc288a','#b05b6a','#2f212a'], title: 'Чемпион', trophies: 3707, interval: 426, skill: 0.96, mistake: 0.024, style: { clearBias: 0.945, risk: 0.212, speedJitter: 0.089, preferSmall: 0.96 },
        phrases: { start: ["Разложу твою игру", "Не смотри прямо — ослепнешь"], clear: ["Грань за гранью", "Спектр чист", "Радуга линий"], lead: ["Преломляю шансы", "Полный спектр", "Ярче тебя"], behind: ["Ещё отражусь", "Тень на грани", "Угол атаки новый"], stuck: ["Нужна полировка", "Трещина…"], win: ["Ты в тени", "Грани победы"], lose: ["Заточились", "Урок отражения", "Кто-то ярче…"] } },
      { id: 'loom', name: 'Loom', av: ['#0a3e47','#28a3b8','#134290','#263234'], title: 'Чемпион', trophies: 3753, interval: 274, skill: 1.0, mistake: 0.0, style: { clearBias: 1.0, risk: 0.05, speedJitter: 0.022, preferSmall: 0.999 },
        phrases: { start: ["Страницы открыты", "Не удивляй — предсказано", "Я уже видел конец"], clear: ["Нить обрезана чисто", "Как в видении", "Знак выполнен"], lead: ["Неизбежно", "Пишу финал"], behind: ["Редко, очень редко", "…неожиданный абзац", "Перечитаю"], stuck: ["Нужен новый свиток", "Слепое пятно"], win: ["Оракул не ошибается", "Книга закрыта"], lose: ["Ты переписал страницу", "Затмение века"] } },
      { id: 'atlas', name: 'Atlas', av: ['#1a401d','#14f623','#297351','#162116'], title: 'Чемпион', trophies: 3800, interval: 282, skill: 0.968, mistake: 0.019, style: { clearBias: 1.0, risk: 0.1, speedJitter: 0.032, preferSmall: 0.998 },
        phrases: { start: ["Не пытайся сдвинуть", "Давление включено", "Гора не двигается первой"], clear: ["Как молот", "Тяжесть порядка"], lead: ["Фундамент мой", "Ты под нами", "Несокрушимо"], behind: ["Ещё не дрогнул", "Трещина? Нет.", "Усиливаю"], stuck: ["Нужен рычаг", "Редко", "…заклинило"], win: ["Монумент победы", "Стоял и стою", "Пыль — под ногами"], lose: ["Перекую себя", "Кто-то тяжелее…"] } }
    ];

    /** Unique hand-crafted SVG avatar per bot palette */
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

    const ACHIEVEMENTS = [
      // —— Классика —— (только после реальной игры)
      { id: 'c_score_500', section: 'classic', title: 'Разминка поля', desc: 'Набери 500 очков в классике', target: 500, reward: 1, type: 'classicBest' },
      { id: 'c_score_1k',  section: 'classic', title: 'Первые шаги', desc: 'Набери 1 000 очков в классике', target: 1000, reward: 1, type: 'classicBest' },
      { id: 'c_score_2k',  section: 'classic', title: 'Две тысячи', desc: 'Набери 2 000 очков в классике', target: 2000, reward: 1, type: 'classicBest' },
      { id: 'c_score_3k',  section: 'classic', title: 'Разгон', desc: 'Набери 3 000 очков в классике', target: 3000, reward: 2, type: 'classicBest' },
      { id: 'c_score_5k',  section: 'classic', title: 'Набирающий ход', desc: 'Набери 5 000 очков в классике', target: 5000, reward: 2, type: 'classicBest' },
      { id: 'c_score_8k',  section: 'classic', title: 'Восемь тысяч', desc: 'Набери 8 000 очков в классике', target: 8000, reward: 3, type: 'classicBest' },
      { id: 'c_score_10k', section: 'classic', title: 'Десятитысячник', desc: 'Набери 10 000 очков в классике', target: 10000, reward: 3, type: 'classicBest' },
      { id: 'c_score_15k', section: 'classic', title: 'Мастер классики', desc: 'Набери 15 000 очков в классике', target: 15000, reward: 4, type: 'classicBest' },
      { id: 'c_score_20k', section: 'classic', title: 'Двадцатка', desc: 'Набери 20 000 очков в классике', target: 20000, reward: 5, type: 'classicBest' },
      { id: 'c_score_25k', section: 'classic', title: 'Высокий полёт', desc: 'Набери 25 000 очков в классике', target: 25000, reward: 6, type: 'classicBest' },
      { id: 'c_score_30k', section: 'classic', title: 'Легенда поля', desc: 'Набери 30 000 очков в классике', target: 30000, reward: 7, type: 'classicBest' },
      { id: 'c_score_40k', section: 'classic', title: 'Сорок тысяч', desc: 'Набери 40 000 очков в классике', target: 40000, reward: 9, type: 'classicBest' },
      { id: 'c_score_50k', section: 'classic', title: 'Бесконечность', desc: 'Набери 50 000 очков в классике', target: 50000, reward: 10, type: 'classicBest' },
      { id: 'c_score_65k', section: 'classic', title: 'Небосвод', desc: 'Набери 65 000 очков в классике', target: 65000, reward: 9, type: 'classicBest' },
      { id: 'c_score_80k', section: 'classic', title: 'За гранью', desc: 'Набери 80 000 очков в классике', target: 80000, reward: 10, type: 'classicBest' },
      { id: 'c_score_100k', section: 'classic', title: 'Сто тысяч', desc: 'Набери 100 000 очков в классике', target: 100000, reward: 12, type: 'classicBest' },
      { id: 'c_score_120k', section: 'classic', title: 'Архитектор хаоса', desc: 'Набери 120 000 очков в классике', target: 120000, reward: 14, type: 'classicBest' },
      { id: 'c_score_150k', section: 'classic', title: 'Предел поля', desc: 'Набери 150 000 очков в классике', target: 150000, reward: 16, type: 'classicBest' },
      { id: 'combo_2',     section: 'classic', title: 'Двойной клир', desc: 'Сделай комбо ×2+ в классике', target: 1, reward: 1, type: 'combo2' },
      { id: 'combo_3',     section: 'classic', title: 'Тройной удар', desc: 'Сделай комбо ×3+ в классике', target: 1, reward: 1, type: 'combo3' },
      { id: 'combo_4',     section: 'classic', title: 'Мега-комбо', desc: 'Сделай комбо ×4+ в классике', target: 1, reward: 2, type: 'megaCombo' },
      { id: 'combo_5',     section: 'classic', title: 'Пента-шок', desc: 'Сделай комбо ×5+ в классике', target: 1, reward: 5, type: 'combo5' },
      { id: 'combo_6',     section: 'classic', title: 'Гекса-взрыв', desc: 'Сделай комбо ×6+ в классике', target: 1, reward: 8, type: 'combo6' },
      { id: 'combo_7',     section: 'classic', title: 'Семёрка хаоса', desc: 'Сделай комбо ×7+ в классике', target: 1, reward: 8, type: 'combo7' },
      { id: 'lines_10',    section: 'classic', title: 'Первая уборка', desc: 'Очисти 10 линий суммарно', target: 10, reward: 1, type: 'linesCleared' },
      { id: 'lines_25',    section: 'classic', title: 'Четверть сотни линий', desc: 'Очисти 25 линий суммарно', target: 25, reward: 1, type: 'linesCleared' },
      { id: 'lines_50',    section: 'classic', title: 'Чистильщик', desc: 'Очисти 50 линий суммарно', target: 50, reward: 2, type: 'linesCleared' },
      { id: 'lines_75',    section: 'classic', title: 'Семидесятник', desc: 'Очисти 75 линий суммарно', target: 75, reward: 2, type: 'linesCleared' },
      { id: 'lines_100',   section: 'classic', title: 'Сотня линий', desc: 'Очисти 100 линий суммарно', target: 100, reward: 3, type: 'linesCleared' },
      { id: 'lines_150',   section: 'classic', title: 'Полтораста', desc: 'Очисти 150 линий суммарно', target: 150, reward: 4, type: 'linesCleared' },
      { id: 'lines_200',   section: 'classic', title: 'Дворник сезона', desc: 'Очисти 200 линий суммарно', target: 200, reward: 5, type: 'linesCleared' },
      { id: 'lines_350',   section: 'classic', title: 'Линейный шторм', desc: 'Очисти 350 линий суммарно', target: 350, reward: 7, type: 'linesCleared' },
      { id: 'lines_500',   section: 'classic', title: 'Главный по линиям', desc: 'Очисти 500 линий суммарно', target: 500, reward: 7, type: 'linesCleared' },
      { id: 'lines_750',   section: 'classic', title: 'Семьсот пятьдесят', desc: 'Очисти 750 линий суммарно', target: 750, reward: 9, type: 'linesCleared' },
      { id: 'lines_1000',  section: 'classic', title: 'Тысяча клиров', desc: 'Очисти 1000 линий суммарно', target: 1000, reward: 11, type: 'linesCleared' },
      { id: 'lines_1500',  section: 'classic', title: 'Полторы тысячи', desc: 'Очисти 1500 линий суммарно', target: 1500, reward: 24, type: 'linesCleared' },
      { id: 'relief_1',    section: 'classic', title: 'Алмазная помощь', desc: 'Используй сброс за алмаз в классике', target: 1, reward: 1, type: 'reliefUsed' },
      { id: 'relief_3',    section: 'classic', title: 'Страховка', desc: 'Используй сброс за алмаз 3 раза', target: 3, reward: 2, type: 'reliefUsed' },
      { id: 'relief_5',    section: 'classic', title: 'Не тонет', desc: 'Используй сброс за алмаз 5 раз', target: 5, reward: 3, type: 'reliefUsed' },
      { id: 'relief_10',   section: 'classic', title: 'Алмазный спасатель', desc: 'Используй сброс за алмаз 10 раз', target: 10, reward: 5, type: 'reliefUsed' },
      // —— Победы ——
      { id: 'win_1',       section: 'wins', title: 'Первая победа', desc: 'Выиграй 1 матч (бот или игрок)', target: 1, reward: 1, type: 'wins' },
      { id: 'win_3',       section: 'wins', title: 'Триумвират', desc: 'Выиграй 3 матча', target: 3, reward: 1, type: 'wins' },
      { id: 'win_5',       section: 'wins', title: 'Серия побед', desc: 'Выиграй 5 матчей', target: 5, reward: 2, type: 'wins' },
      { id: 'win_10',      section: 'wins', title: 'Десятка', desc: 'Выиграй 10 матчей', target: 10, reward: 3, type: 'wins' },
      { id: 'win_15',      section: 'wins', title: 'Доминатор', desc: 'Выиграй 15 матчей', target: 15, reward: 4, type: 'wins' },
      { id: 'win_20',      section: 'wins', title: 'Двадцать побед', desc: 'Выиграй 20 матчей', target: 20, reward: 4, type: 'wins' },
      { id: 'win_25',      section: 'wins', title: 'Четверть сотни', desc: 'Выиграй 25 матчей', target: 25, reward: 5, type: 'wins' },
      { id: 'win_40',      section: 'wins', title: 'Неудержимый', desc: 'Выиграй 40 матчей', target: 40, reward: 8, type: 'wins' },
      { id: 'win_60',      section: 'wins', title: 'Шестьдесят', desc: 'Выиграй 60 матчей', target: 60, reward: 10, type: 'wins' },
      { id: 'win_75',      section: 'wins', title: 'Три четверти', desc: 'Выиграй 75 матчей', target: 75, reward: 12, type: 'wins' },
      { id: 'win_100',     section: 'wins', title: 'Сто побед', desc: 'Выиграй 100 матчей', target: 100, reward: 15, type: 'wins' },
      { id: 'win_150',     section: 'wins', title: 'Полтораста побед', desc: 'Выиграй 150 матчей', target: 150, reward: 18, type: 'wins' },
      { id: 'win_250',     section: 'wins', title: 'Империя побед', desc: 'Выиграй 250 матчей', target: 250, reward: 25, type: 'wins' },
      { id: 'win_400',     section: 'wins', title: 'Четыре сотни', desc: 'Выиграй 400 матчей', target: 400, reward: 32, type: 'wins' },
      { id: 'win_500',     section: 'wins', title: 'Полтысячи', desc: 'Выиграй 500 матчей', target: 500, reward: 40, type: 'wins' },
      { id: 'matches_5',   section: 'wins', title: 'Первые бои', desc: 'Сыграй 5 матчей в соревновании', target: 5, reward: 1, type: 'matchesPlayed' },
      { id: 'matches_10',  section: 'wins', title: 'Разогрев', desc: 'Сыграй 10 матчей в соревновании', target: 10, reward: 1, type: 'matchesPlayed' },
      { id: 'matches_20',  section: 'wins', title: 'Завсегдатай', desc: 'Сыграй 20 матчей в соревновании', target: 20, reward: 3, type: 'matchesPlayed' },
      { id: 'matches_35',  section: 'wins', title: 'В ритме арены', desc: 'Сыграй 35 матчей в соревновании', target: 35, reward: 4, type: 'matchesPlayed' },
      { id: 'matches_50',  section: 'wins', title: 'Ветеран арены', desc: 'Сыграй 50 матчей в соревновании', target: 50, reward: 6, type: 'matchesPlayed' },
      { id: 'matches_75',  section: 'wins', title: 'Семьдесят пять боёв', desc: 'Сыграй 75 матчей в соревновании', target: 75, reward: 8, type: 'matchesPlayed' },
      { id: 'matches_100', section: 'wins', title: 'Сто боёв', desc: 'Сыграй 100 матчей в соревновании', target: 100, reward: 12, type: 'matchesPlayed' },
      { id: 'matches_150', section: 'wins', title: 'Полтораста боёв', desc: 'Сыграй 150 матчей в соревновании', target: 150, reward: 15, type: 'matchesPlayed' },
      { id: 'matches_200', section: 'wins', title: 'Двести сражений', desc: 'Сыграй 200 матчей в соревновании', target: 200, reward: 20, type: 'matchesPlayed' },
      { id: 'matches_300', section: 'wins', title: 'Триста сражений', desc: 'Сыграй 300 матчей в соревновании', target: 300, reward: 28, type: 'matchesPlayed' },
      { id: 'perfect_win', section: 'wins', title: 'Сухая победа', desc: 'Выиграй матч с разницей ≥500 очков', target: 1, reward: 3, type: 'blowoutWin' },
      { id: 'perfect_3',   section: 'wins', title: 'Три разгрома', desc: 'Выиграй 3 матча с разницей ≥500', target: 3, reward: 5, type: 'blowoutWin' },
      { id: 'clutch_win',  section: 'wins', title: 'На волоске', desc: 'Выиграй матч с разницей ≤50 очков', target: 1, reward: 3, type: 'clutchWin' },
      { id: 'clutch_3',    section: 'wins', title: 'Мастер нервов', desc: 'Выиграй 3 матча с разницей ≤50', target: 3, reward: 5, type: 'clutchWin' },
      // —— Боты ——
      { id: 'bot_weak',    section: 'bots', title: 'Разминка', desc: 'Победи бота с ≤300 🏆', target: 1, reward: 1, type: 'beatBotMax' },
      { id: 'bot_mid',     section: 'bots', title: 'Уверенный удар', desc: 'Победи бота с ≥800 🏆', target: 800, reward: 2, type: 'beatBotMin' },
      { id: 'bot_expert',  section: 'bots', title: 'Экспертный рубеж', desc: 'Победи бота с ≥1200 🏆', target: 1200, reward: 3, type: 'beatBotMin' },
      { id: 'bot_strong',  section: 'bots', title: 'Охотник на титанов', desc: 'Победи бота с ≥2000 🏆', target: 2000, reward: 5, type: 'beatBotMin' },
      { id: 'bot_elite',   section: 'bots', title: 'Элитный рубеж', desc: 'Победи бота с ≥2500 🏆', target: 2500, reward: 7, type: 'beatBotMin' },
      { id: 'bot_seer',    section: 'bots', title: 'Обмануть оракула', desc: 'Победи Seer (2900 🏆)', target: 1, reward: 8, type: 'beatSeer' },
      { id: 'bot_crown',   section: 'bots', title: 'Свержение короны', desc: 'Победи Crown — чемпиона (3500 🏆)', target: 1, reward: 12, type: 'beatCrown' },
      { id: 'stars_1',     section: 'bots', title: 'Первая звезда', desc: 'Собери 1 серебряную звезду у ботов', target: 1, reward: 1, type: 'botStars' },
      { id: 'stars_3',     section: 'bots', title: 'Первые звёзды', desc: 'Собери 3 серебряные звезды у ботов', target: 3, reward: 2, type: 'botStars' },
      { id: 'stars_6',     section: 'bots', title: 'Малое созвездие', desc: 'Собери 6 серебряных звёзд у ботов', target: 6, reward: 3, type: 'botStars' },
      { id: 'stars_9',     section: 'bots', title: 'Девять огней', desc: 'Собери 9 серебряных звёзд у ботов', target: 9, reward: 4, type: 'botStars' },
      { id: 'stars_12',    section: 'bots', title: 'Созвездие', desc: 'Собери 12 серебряных звёзд у ботов', target: 12, reward: 6, type: 'botStars' },
      { id: 'stars_18',    section: 'bots', title: 'Восемнадцать', desc: 'Собери 18 серебряных звёзд у ботов', target: 18, reward: 8, type: 'botStars' },
      { id: 'stars_20',    section: 'bots', title: 'Звёздная карта', desc: 'Собери 20 серебряных звёзд у ботов', target: 20, reward: 10, type: 'botStars' },
      { id: 'stars_30',    section: 'bots', title: 'Звёздный каталог', desc: 'Собери 30 серебряных звёзд у ботов', target: 30, reward: 15, type: 'botStars' },
      { id: 'stars_40',    section: 'bots', title: 'Сорок звёзд', desc: 'Собери 40 серебряных звёзд у ботов', target: 40, reward: 18, type: 'botStars' },
      { id: 'stars_45',    section: 'bots', title: 'Галактика', desc: 'Собери 45 серебряных звёзд у ботов', target: 45, reward: 22, type: 'botStars' },
      { id: 'bot_wins_5',  section: 'bots', title: 'Тренировка', desc: 'Выиграй 5 матчей против ботов', target: 5, reward: 1, type: 'botWins' },
      { id: 'bot_wins_10', section: 'bots', title: 'Тренерский стаж', desc: 'Выиграй 10 матчей против ботов', target: 10, reward: 3, type: 'botWins' },
      { id: 'bot_wins_20', section: 'bots', title: 'Двадцать машин', desc: 'Выиграй 20 матчей против ботов', target: 20, reward: 5, type: 'botWins' },
      { id: 'bot_wins_30', section: 'bots', title: 'Бич машин', desc: 'Выиграй 30 матчей против ботов', target: 30, reward: 7, type: 'botWins' },
      { id: 'bot_wins_50', section: 'bots', title: 'Полсотни ботов', desc: 'Выиграй 50 матчей против ботов', target: 50, reward: 12, type: 'botWins' },
      { id: 'bot_wins_100',section: 'bots', title: 'Сто машин', desc: 'Выиграй 100 матчей против ботов', target: 100, reward: 12, type: 'botWins' },
      { id: 'dur_1m',      section: 'bots', title: 'Спринт', desc: 'Выиграй матч на 1 минуту', target: 1, reward: 1, type: 'winDur60' },
      { id: 'dur_1m_5',    section: 'bots', title: 'Спринтер', desc: 'Выиграй 5 матчей на 1 минуту', target: 5, reward: 3, type: 'winDur60' },
      { id: 'dur_2m',      section: 'bots', title: 'Стандарт', desc: 'Выиграй матч на 2 минуты', target: 1, reward: 1, type: 'winDur120' },
      { id: 'dur_2m_5',    section: 'bots', title: 'Стабильный', desc: 'Выиграй 5 матчей на 2 минуты', target: 5, reward: 3, type: 'winDur120' },
      { id: 'dur_3m',      section: 'bots', title: 'Марафон', desc: 'Выиграй матч на 3 минуты', target: 1, reward: 2, type: 'winDur180' },
      { id: 'dur_3m_5',    section: 'bots', title: 'Марафонец', desc: 'Выиграй 5 матчей на 3 минуты', target: 5, reward: 4, type: 'winDur180' },
      // —— Онлайн / рейтинг ——
      { id: 'online_1',    section: 'online', title: 'Первый онлайн', desc: 'Выиграй 1 матч против игрока', target: 1, reward: 2, type: 'onlineWins' },
      { id: 'online_3',    section: 'online', title: 'Среди игроков', desc: 'Выиграй 3 матча против игроков', target: 3, reward: 3, type: 'onlineWins' },
      { id: 'online_5',    section: 'online', title: 'Пятёрка сети', desc: 'Выиграй 5 матчей против игроков', target: 5, reward: 4, type: 'onlineWins' },
      { id: 'online_10',   section: 'online', title: 'Сетевой хищник', desc: 'Выиграй 10 матчей против игроков', target: 10, reward: 7, type: 'onlineWins' },
      { id: 'online_15',   section: 'online', title: 'Охотник лобби', desc: 'Выиграй 15 матчей против игроков', target: 15, reward: 10, type: 'onlineWins' },
      { id: 'online_25',   section: 'online', title: 'Король сети', desc: 'Выиграй 25 матчей против игроков', target: 25, reward: 14, type: 'onlineWins' },
      { id: 'online_40',   section: 'online', title: 'Сорок онлайн', desc: 'Выиграй 40 матчей против игроков', target: 40, reward: 18, type: 'onlineWins' },
      { id: 'online_50',   section: 'online', title: 'Император онлайн', desc: 'Выиграй 50 матчей против игроков', target: 50, reward: 15, type: 'onlineWins' },
      { id: 'online_75',   section: 'online', title: 'Сетевой ветеран', desc: 'Выиграй 75 матчей против игроков', target: 75, reward: 32, type: 'onlineWins' },
      { id: 'online_100',  section: 'online', title: 'Сто онлайн-побед', desc: 'Выиграй 100 матчей против игроков', target: 100, reward: 40, type: 'onlineWins' },
      { id: 'cup_25',      section: 'online', title: 'Бронзовый старт', desc: 'Набери 25 трофеев', target: 25, reward: 1, type: 'trophies' },
      { id: 'cup_50',      section: 'online', title: 'Первые кубки', desc: 'Набери 50 трофеев', target: 50, reward: 2, type: 'trophies' },
      { id: 'cup_100',     section: 'online', title: 'Сотня кубков', desc: 'Набери 100 трофеев', target: 100, reward: 3, type: 'trophies' },
      { id: 'cup_150',     section: 'online', title: 'Взлёт', desc: 'Набери 150 трофеев', target: 150, reward: 3, type: 'trophies' },
      { id: 'cup_200',     section: 'online', title: 'Двести кубков', desc: 'Набери 200 трофеев', target: 200, reward: 4, type: 'trophies' },
      { id: 'cup_300',     section: 'online', title: 'В топе двора', desc: 'Набери 300 трофеев', target: 300, reward: 5, type: 'trophies' },
      { id: 'cup_400',     section: 'online', title: 'Четыреста', desc: 'Набери 400 трофеев', target: 400, reward: 6, type: 'trophies' },
      { id: 'cup_500',     section: 'online', title: 'Элита', desc: 'Набери 500 трофеев', target: 500, reward: 8, type: 'trophies' },
      { id: 'cup_750',     section: 'online', title: 'Высшая лига', desc: 'Набери 750 трофеев', target: 750, reward: 12, type: 'trophies' },
      { id: 'cup_1000',    section: 'online', title: 'Тысячник', desc: 'Набери 1000 трофеев', target: 1000, reward: 15, type: 'trophies' },
      { id: 'cup_1250',    section: 'online', title: 'Двенадцать пятьдесят', desc: 'Набери 1250 трофеев', target: 1250, reward: 18, type: 'trophies' },
      { id: 'cup_1500',    section: 'online', title: 'Полуторный пик', desc: 'Набери 1500 трофеев', target: 1500, reward: 14, type: 'trophies' },
      { id: 'cup_2000',    section: 'online', title: 'Две тысячи кубков', desc: 'Набери 2000 трофеев', target: 2000, reward: 30, type: 'trophies' },
      { id: 'ranked_1k',   section: 'online', title: 'Рейтинг-проба', desc: 'Набери 1 000 очков в одном рейтинговом матче', target: 1000, reward: 2, type: 'rankedBest' },
      { id: 'ranked_2k',   section: 'online', title: 'Рейтинг-дебют', desc: 'Набери 2 000 очков в одном рейтинговом матче', target: 2000, reward: 3, type: 'rankedBest' },
      { id: 'ranked_3k',   section: 'online', title: 'Рейтинг-импульс', desc: 'Набери 3 000 очков в одном рейтинговом матче', target: 3000, reward: 5, type: 'rankedBest' },
      { id: 'ranked_4k',   section: 'online', title: 'Рейтинг-волна', desc: 'Набери 4 000 очков в одном рейтинговом матче', target: 4000, reward: 6, type: 'rankedBest' },
      { id: 'ranked_5k',   section: 'online', title: 'Рейтинг-огонь', desc: 'Набери 5 000 очков в одном рейтинговом матче', target: 5000, reward: 7, type: 'rankedBest' },
      { id: 'ranked_6k',   section: 'online', title: 'Рейтинг-буря', desc: 'Набери 6 000 очков в одном рейтинговом матче', target: 6000, reward: 9, type: 'rankedBest' },
      { id: 'ranked_8k',   section: 'online', title: 'Рейтинг-шторм', desc: 'Набери 8 000 очков в одном рейтинговом матче', target: 8000, reward: 12, type: 'rankedBest' },
      { id: 'ranked_10k',  section: 'online', title: 'Рейтинг-ураган', desc: 'Набери 10 000 очков в одном рейтинговом матче', target: 10000, reward: 10, type: 'rankedBest' },
      { id: 'friend_1',    section: 'online', title: 'Дружеский круг', desc: 'Добавь 1 друга', target: 1, reward: 1, type: 'friendsCount' },
      { id: 'friend_3',    section: 'online', title: 'Трое друзей', desc: 'Добавь 3 друзей', target: 3, reward: 2, type: 'friendsCount' },
      { id: 'friend_5',    section: 'online', title: 'Компания', desc: 'Добавь 5 друзей', target: 5, reward: 3, type: 'friendsCount' },
      { id: 'friend_10',   section: 'online', title: 'Десятка друзей', desc: 'Добавь 10 друзей', target: 10, reward: 5, type: 'friendsCount' },
      // —— Коллекция —— (НЕ награждать за стартовые 3 бесплатных скина)
      { id: 'buy_1',       section: 'collection', title: 'Первая покупка', desc: 'Купи 1 скин в магазине', target: 1, reward: 1, type: 'skinsBought' },
      { id: 'buy_2',       section: 'collection', title: 'Вторая витрина', desc: 'Купи 2 скина в магазине', target: 2, reward: 2, type: 'skinsBought' },
      { id: 'buy_3',       section: 'collection', title: 'Шопинг', desc: 'Купи 3 скина в магазине', target: 3, reward: 3, type: 'skinsBought' },
      { id: 'buy_5',       section: 'collection', title: 'Витринный охотник', desc: 'Купи 5 скинов в магазине', target: 5, reward: 5, type: 'skinsBought' },
      { id: 'buy_7',       section: 'collection', title: 'Семь покупок', desc: 'Купи 7 скинов в магазине', target: 7, reward: 7, type: 'skinsBought' },
      { id: 'buy_10',      section: 'collection', title: 'Десять покупок', desc: 'Купи 10 скинов в магазине', target: 10, reward: 10, type: 'skinsBought' },
      { id: 'buy_all',     section: 'collection', title: 'Выкупил витрину', desc: 'Купи все платные скины (13)', target: 13, reward: 15, type: 'skinsBought' },
      { id: 'skin_4',      section: 'collection', title: 'На полке', desc: 'Собери 4 скина (нужна 1 покупка)', target: 4, reward: 2, type: 'skinsOwned' },
      { id: 'skin_6',      section: 'collection', title: 'Растущая витрина', desc: 'Собери 6 скинов в инвентаре', target: 6, reward: 3, type: 'skinsOwned' },
      { id: 'skin_8',      section: 'collection', title: 'Коллекционер', desc: 'Собери 8 скинов в инвентаре', target: 8, reward: 5, type: 'skinsOwned' },
      { id: 'skin_10',     section: 'collection', title: 'Почти полка', desc: 'Собери 10 скинов в инвентаре', target: 10, reward: 7, type: 'skinsOwned' },
      { id: 'skin_12',     section: 'collection', title: 'Витрина мечты', desc: 'Собери 12 скинов в инвентаре', target: 12, reward: 10, type: 'skinsOwned' },
      { id: 'skin_14',     section: 'collection', title: 'Редкая коллекция', desc: 'Собери 14 скинов в инвентаре', target: 14, reward: 14, type: 'skinsOwned' },
      { id: 'skin_all',    section: 'collection', title: 'Полная полка', desc: 'Собери все скины из каталога', target: 16, reward: 20, type: 'skinsOwned' },
      { id: 'diamonds_10', section: 'collection', title: 'Запас алмазов', desc: 'Имей 10 алмазов одновременно', target: 10, reward: 2, type: 'diamondsHeld' },
      { id: 'diamonds_15', section: 'collection', title: 'Пятнадцать алмазов', desc: 'Имей 15 алмазов одновременно', target: 15, reward: 3, type: 'diamondsHeld' },
      { id: 'diamonds_25', section: 'collection', title: 'Алмазный запас', desc: 'Имей 25 алмазов одновременно', target: 25, reward: 4, type: 'diamondsHeld' },
      { id: 'diamonds_40', section: 'collection', title: 'Сорок алмазов', desc: 'Имей 40 алмазов одновременно', target: 40, reward: 6, type: 'diamondsHeld' },
      { id: 'diamonds_60', section: 'collection', title: 'Алмазная гора', desc: 'Имей 60 алмазов одновременно', target: 60, reward: 6, type: 'diamondsHeld' },
      { id: 'ach_5',       section: 'collection', title: 'Первые цели', desc: 'Получи 5 достижений', target: 5, reward: 2, type: 'achClaimed' },
      { id: 'ach_10',      section: 'collection', title: 'Охотник за целями', desc: 'Получи 10 достижений', target: 10, reward: 3, type: 'achClaimed' },
      { id: 'ach_20',      section: 'collection', title: 'Двадцать целей', desc: 'Получи 20 достижений', target: 20, reward: 5, type: 'achClaimed' },
      { id: 'ach_25',      section: 'collection', title: 'Архивариус', desc: 'Получи 25 достижений', target: 25, reward: 6, type: 'achClaimed' },
      { id: 'ach_40',      section: 'collection', title: 'Сорок целей', desc: 'Получи 40 достижений', target: 40, reward: 10, type: 'achClaimed' },
      { id: 'ach_50',      section: 'collection', title: 'Мастер списка', desc: 'Получи 50 достижений', target: 50, reward: 12, type: 'achClaimed' },
      { id: 'ach_75',      section: 'collection', title: 'Семьдесят пять', desc: 'Получи 75 достижений', target: 75, reward: 18, type: 'achClaimed' },
      { id: 'ach_100',     section: 'collection', title: 'Сотня достижений', desc: 'Получи 100 достижений', target: 100, reward: 15, type: 'achClaimed' },
      // —— Профиль и поля ——
      { id: 'prof_nick',   section: 'collection', title: 'Своё имя', desc: 'Смени никнейм в профиле', target: 1, reward: 1, type: 'profileNick' },
      { id: 'prof_av',     section: 'collection', title: 'Новое лицо', desc: 'Смени аватар в профиле', target: 1, reward: 1, type: 'profileAvatar' },
      { id: 'prof_photo',  section: 'collection', title: 'Свой портрет', desc: 'Загрузи свою аватарку', target: 1, reward: 2, type: 'profileCustom' },
      { id: 'prof_status', section: 'collection', title: 'Есть что сказать', desc: 'Укажи статус в профиле', target: 1, reward: 1, type: 'profileStatus' },
      { id: 'board_1',     section: 'collection', title: 'Новое поле', desc: 'Купи 1 поле в магазине', target: 1, reward: 2, type: 'boardsBought' },
      { id: 'board_3',     section: 'collection', title: 'Три арены', desc: 'Купи 3 поля в магазине', target: 3, reward: 4, type: 'boardsBought' },
      { id: 'board_5',     section: 'collection', title: 'Пять арен', desc: 'Купи 5 полей в магазине', target: 5, reward: 6, type: 'boardsBought' },
      { id: 'board_own_6', section: 'collection', title: 'Коллекция полей', desc: 'Имей 6 полей в инвентаре', target: 6, reward: 3, type: 'boardsOwned' },
      { id: 'board_own_10',section: 'collection', title: 'Галерея полей', desc: 'Имей 10 полей в инвентаре', target: 10, reward: 6, type: 'boardsOwned' },
      { id: 'board_legend',section: 'collection', title: 'Легендарная арена', desc: 'Купи легендарное поле', target: 1, reward: 5, type: 'boardsLegendary' },
      // —— Серии и стиль ——
      { id: 'streak_3',    section: 'wins', title: 'Три подряд', desc: 'Выиграй 3 матча подряд', target: 3, reward: 3, type: 'winStreak' },
      { id: 'streak_5',    section: 'wins', title: 'Пять подряд', desc: 'Выиграй 5 матчей подряд', target: 5, reward: 5, type: 'winStreak' },
      { id: 'streak_8',    section: 'wins', title: 'Несгибаемый', desc: 'Выиграй 8 матчей подряд', target: 8, reward: 10, type: 'winStreak' },
      { id: 'comeback_1',  section: 'wins', title: 'Камбэк', desc: 'Выиграй, отставая на ≥200 очков в середине матча', target: 1, reward: 4, type: 'comebackWin' },
      { id: 'rematch_1',   section: 'wins', title: 'Ещё раунд', desc: 'Сыграй реванш после матча', target: 1, reward: 1, type: 'rematchPlayed' },
      { id: 'rematch_5',   section: 'wins', title: 'Серия реваншей', desc: 'Сыграй 5 реваншей', target: 5, reward: 3, type: 'rematchPlayed' },
      // —— Экстрим (крайне тяжёлые) ——
      { id: 'x_score_200k', section: 'classic', title: 'Абсолют поля', desc: 'Набери 200 000 очков в одной классике', target: 200000, reward: 40, type: 'classicBest' },
      { id: 'x_score_300k', section: 'classic', title: 'Разрушитель лимита', desc: 'Набери 300 000 очков в одной классике', target: 300000, reward: 60, type: 'classicBest' },
      { id: 'x_score_500k', section: 'classic', title: 'Мифический счёт', desc: 'Набери 500 000 очков в одной классике', target: 500000, reward: 100, type: 'classicBest' },
      { id: 'x_combo_8',    section: 'classic', title: 'Окта-коллапс', desc: 'Сделай комбо ×8+ в классике', target: 1, reward: 25, type: 'combo8' },
      { id: 'x_combo_10',   section: 'classic', title: 'Дека-апокалипсис', desc: 'Сделай комбо ×10+ в классике', target: 1, reward: 50, type: 'combo10' },
      { id: 'x_lines_3k',   section: 'classic', title: 'Три тысячи клиров', desc: 'Очисти 3000 линий суммарно', target: 3000, reward: 35, type: 'linesCleared' },
      { id: 'x_lines_5k',   section: 'classic', title: 'Пять тысяч клиров', desc: 'Очисти 5000 линий суммарно', target: 5000, reward: 55, type: 'linesCleared' },
      { id: 'x_lines_10k',  section: 'classic', title: 'Десять тысяч клиров', desc: 'Очисти 10 000 линий суммарно', target: 10000, reward: 90, type: 'linesCleared' },
      { id: 'x_win_1k',     section: 'wins', title: 'Тысяча побед', desc: 'Выиграй 1000 матчей', target: 1000, reward: 80, type: 'wins' },
      { id: 'x_win_2k',     section: 'wins', title: 'Две тысячи побед', desc: 'Выиграй 2000 матчей', target: 2000, reward: 120, type: 'wins' },
      { id: 'x_streak_15',  section: 'wins', title: 'Пятнадцать без поражений', desc: 'Выиграй 15 матчей подряд', target: 15, reward: 30, type: 'winStreak' },
      { id: 'x_streak_25',  section: 'wins', title: 'Двадцать пять без поражений', desc: 'Выиграй 25 матчей подряд', target: 25, reward: 55, type: 'winStreak' },
      { id: 'x_streak_50',  section: 'wins', title: 'Полсотни без поражений', desc: 'Выиграй 50 матчей подряд', target: 50, reward: 100, type: 'winStreak' },
      { id: 'x_blowout_20', section: 'wins', title: 'Машина разгромов', desc: 'Выиграй 20 матчей с разницей ≥500', target: 20, reward: 25, type: 'blowoutWin' },
      { id: 'x_clutch_20',  section: 'wins', title: 'Железные нервы', desc: 'Выиграй 20 матчей с разницей ≤50', target: 20, reward: 25, type: 'clutchWin' },
      { id: 'x_matches_1k', section: 'wins', title: 'Тысяча боёв', desc: 'Сыграй 1000 матчей в соревновании', target: 1000, reward: 50, type: 'matchesPlayed' },
      { id: 'x_bot_wins_250', section: 'bots', title: 'Истребитель машин', desc: 'Выиграй 250 матчей против ботов', target: 250, reward: 40, type: 'botWins' },
      { id: 'x_bot_wins_500', section: 'bots', title: 'Война с кодом', desc: 'Выиграй 500 матчей против ботов', target: 500, reward: 70, type: 'botWins' },
      { id: 'x_stars_half', section: 'bots', title: 'Половина галактики', desc: 'Собери половину всех серебряных звёзд', target: 1, reward: 35, type: 'halfBotStars' },
      { id: 'x_stars_all',  section: 'bots', title: 'Полный звёздный атлас', desc: 'Собери все серебряные звёзды у ботов', target: 1, reward: 80, type: 'allBotStars' },
      { id: 'x_online_200', section: 'online', title: 'Сетевой титан', desc: 'Выиграй 200 матчей против игроков', target: 200, reward: 60, type: 'onlineWins' },
      { id: 'x_online_500', section: 'online', title: 'Повелитель сети', desc: 'Выиграй 500 матчей против игроков', target: 500, reward: 100, type: 'onlineWins' },
      { id: 'x_cup_3k',     section: 'online', title: 'Три тысячи кубков', desc: 'Набери 3000 трофеев', target: 3000, reward: 50, type: 'trophies' },
      { id: 'x_cup_5k',     section: 'online', title: 'Пять тысяч кубков', desc: 'Набери 5000 трофеев', target: 5000, reward: 80, type: 'trophies' },
      { id: 'x_ranked_15k', section: 'online', title: 'Рейтинг-катаклизм', desc: 'Набери 15 000 очков в одном рейтинговом матче', target: 15000, reward: 40, type: 'rankedBest' },
      { id: 'x_ranked_25k', section: 'online', title: 'Рейтинг-сингулярность', desc: 'Набери 25 000 очков в одном рейтинговом матче', target: 25000, reward: 70, type: 'rankedBest' },
      { id: 'x_ach_150',    section: 'collection', title: 'Завершитель архива', desc: 'Получи 150 достижений', target: 150, reward: 50, type: 'achClaimed' },
      { id: 'x_ach_200',    section: 'collection', title: 'Хранитель 200', desc: 'Получи 200 достижений', target: 200, reward: 80, type: 'achClaimed' },
      { id: 'x_diamond_100',section: 'collection', title: 'Сотня алмазов', desc: 'Имей 100 алмазов одновременно', target: 100, reward: 20, type: 'diamondsHeld' },
      { id: 'x_diamond_200',section: 'collection', title: 'Двести алмазов', desc: 'Имей 200 алмазов одновременно', target: 200, reward: 40, type: 'diamondsHeld' },
      { id: 'x_perfect_game', section: 'classic', title: 'Идеальная партия', desc: 'Набери 50 000+ в классике без сброса за алмаз в этой партии', target: 1, reward: 35, type: 'perfectClassic' },
      { id: 'x_comeback_10', section: 'wins', title: 'Король камбэков', desc: 'Сделай 10 камбэков (победа после −200)', target: 10, reward: 30, type: 'comebackWin' },
    ];
    const ACH_SECTIONS = [
      { id: 'classic', title: 'Классика', icon: '🧩' },
      { id: 'wins', title: 'Победы', icon: '⚔️' },
      { id: 'bots', title: 'Боты', icon: '🤖' },
      { id: 'online', title: 'Онлайн и рейтинг', icon: '🌐' },
      { id: 'collection', title: 'Коллекция', icon: '🎨' },
    ];

    const DEFAULT_SETTINGS = {
      classicScale: '1',
      versusScale: '1',
      theme: 'default',
      anim: 'full',
      floats: '1',
      speech: '1',
      voice: '1',
      haptics: '1',
      preview: '1',
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
      hiContrast: '0'
    };
    let settings = { ...DEFAULT_SETTINGS };
    try {
      const raw = JSON.parse(localStorage.getItem('bp_settings') || '{}');
      settings = { ...DEFAULT_SETTINGS, ...raw };
      delete settings.botSpeed;
    } catch (_) {}
    function saveSettings() {
      try { localStorage.setItem('bp_settings', JSON.stringify(settings)); } catch (_) {}
    }
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

      // Apply slot sizes via style on active trays (overrides fixed CSS)
      document.querySelectorAll('#screenClassic .piece-slot').forEach(s => {
        if (!s.classList.contains('used')) {
          s.style.width = classicSlot + 'px';
          s.style.height = classicSlot + 'px';
          s.style.minWidth = classicSlot + 'px';
        }
      });
      document.querySelectorAll('#screenVersus .pieces-area:not(.opp-pieces) .piece-slot').forEach(s => {
        if (!s.classList.contains('used')) {
          s.style.width = versusSlot + 'px';
          s.style.height = versusSlot + 'px';
          s.style.minWidth = versusSlot + 'px';
        }
      });
      document.querySelectorAll('#screenVersus .pieces-area.opp-pieces .piece-slot').forEach(s => {
        if (!s.classList.contains('used')) {
          s.style.width = oppSlot + 'px';
          s.style.height = oppSlot + 'px';
          s.style.minWidth = oppSlot + 'px';
        }
      });

      renderScalePreviews();
      try {
        if (typeof updateBoardMetrics === 'function') {
          if (typeof boardEl !== 'undefined' && boardEl) updateBoardMetrics(boardEl);
          if (typeof boardMe !== 'undefined' && boardMe) updateBoardMetrics(boardMe);
          if (typeof boardOpp !== 'undefined' && boardOpp) updateBoardMetrics(boardOpp);
        }
      } catch (_) {}
      // Re-render trays so cell pixels match new scale
      // CRITICAL: during replay never use live pieces/oppPieces — that wipes the match log hands
      try {
        if (typeof replayMode !== 'undefined' && replayMode) {
          if (typeof renderReplayTray === 'function') {
            const meA = document.getElementById('piecesAreaVs');
            const oppA = document.getElementById('piecesAreaOpp');
            if (meA && typeof replayMePieces !== 'undefined') renderReplayTray(meA, replayMePieces, false, false);
            if (oppA && typeof replayOppPieces !== 'undefined') renderReplayTray(oppA, replayOppPieces, true, false);
          }
        } else {
          if (typeof renderPieces === 'function' && typeof pieces !== 'undefined' && pieces && pieces.length) {
            const area = (typeof mode !== 'undefined' && mode === 'versus')
              ? document.getElementById('piecesAreaVs')
              : document.getElementById('piecesArea');
            if (area && document.querySelector('.screen.active') &&
                (document.getElementById('screenClassic')?.classList.contains('active') ||
                 document.getElementById('screenVersus')?.classList.contains('active'))) {
              renderPieces(area);
            }
          }
          if (typeof renderOppPieces === 'function' && typeof oppPieces !== 'undefined' && oppPieces && oppPieces.length) {
            if (document.getElementById('screenVersus')?.classList.contains('active')) {
              renderOppPieces();
            }
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
      document.body.classList.remove('theme-ocean', 'theme-sunset', 'theme-mono', 'anim-off', 'anim-soft', 'no-floats', 'no-preview', 'big-text', 'hi-contrast');
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
      if (settings.preview === '0') {
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
        if (navigator.vibrate) navigator.vibrate(ms || 12);
      } catch (_) {}
    }

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

    // —— Profile (guest) ——
    const AVATAR_PRESETS = [
      { id: 'init', kind: 'initials', bg: 'linear-gradient(135deg,#00d4aa,#7c5cff)' },
      { id: 'init2', kind: 'initials', bg: 'linear-gradient(135deg,#ff9f43,#ff5c7a)' },
      { id: 'init3', kind: 'initials', bg: 'linear-gradient(135deg,#4fc3f7,#7c5cff)' },
      { id: 'init4', kind: 'initials', bg: 'linear-gradient(135deg,#ffd666,#ff9f43)' },
      { id: 'init5', kind: 'initials', bg: 'linear-gradient(135deg,#c77dff,#5ee7ff)' },
      { id: 'e1', kind: 'emoji', emoji: '😎', bg: 'linear-gradient(145deg,#1a2a36,#0f1820)' },
      { id: 'e2', kind: 'emoji', emoji: '🔥', bg: 'linear-gradient(145deg,#2a1810,#1a0e08)' },
      { id: 'e3', kind: 'emoji', emoji: '💎', bg: 'linear-gradient(145deg,#0e2430,#081820)' },
      { id: 'e4', kind: 'emoji', emoji: '🎮', bg: 'linear-gradient(145deg,#1a1830,#100e20)' },
      { id: 'e5', kind: 'emoji', emoji: '⚡', bg: 'linear-gradient(145deg,#242010,#181408)' },
      { id: 'e6', kind: 'emoji', emoji: '🦊', bg: 'linear-gradient(145deg,#2a1c14,#1a1008)' },
      { id: 'e7', kind: 'emoji', emoji: '🐱', bg: 'linear-gradient(145deg,#221a20,#140e14)' },
      { id: 'e8', kind: 'emoji', emoji: '🚀', bg: 'linear-gradient(145deg,#101828,#0a1018)' },
      { id: 'e9', kind: 'emoji', emoji: '🌟', bg: 'linear-gradient(145deg,#242018,#141008)' },
      { id: 'e10', kind: 'emoji', emoji: '🧊', bg: 'linear-gradient(145deg,#0e2030,#081018)' },
      { id: 'e11', kind: 'emoji', emoji: '🎯', bg: 'linear-gradient(145deg,#201018,#14080c)' },
      { id: 'e12', kind: 'emoji', emoji: '🍀', bg: 'linear-gradient(145deg,#102018,#081210)' },
      { id: 'e13', kind: 'emoji', emoji: '🦄', bg: 'linear-gradient(145deg,#241428,#140c18)' },
      { id: 'e14', kind: 'emoji', emoji: '👾', bg: 'linear-gradient(145deg,#1a1430,#0c0a18)' },
      { id: 'e15', kind: 'emoji', emoji: '👑', bg: 'linear-gradient(145deg,#2a2410,#181408)' },
    ];
    let myAvatarId = localStorage.getItem('bp_avatar') || 'init';
    let myStatus = '';
    try { myStatus = localStorage.getItem('bp_status') || ''; } catch (_) { myStatus = ''; }
    let profileDraft = { nick: myNickname, avatarId: myAvatarId, status: myStatus };

    function getAvatarPreset(id) {
      return AVATAR_PRESETS.find(a => a.id === id) || AVATAR_PRESETS[0];
    }
    function profileInitials(name) {
      const n = String(name || 'Гость').trim();
      if (!n) return '?';
      const parts = n.split(/\s+/).filter(Boolean);
      let s;
      if (parts.length >= 2) s = (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
      else s = n.slice(0, 2).toUpperCase();
      // Pure digits look broken in avatar grid — mix in a letter
      if (/^\d+$/.test(s)) {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        let h = 0;
        for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
        s = letters[Math.abs(h) % letters.length] + s[0];
      }
      return s;
    }
    let myAvatarCustom = '';
    try { myAvatarCustom = localStorage.getItem('bp_avatar_custom') || ''; } catch (_) { myAvatarCustom = ''; }

    function renderAvatarInto(el, opts) {
      if (!el) return;
      opts = opts || {};
      const id = opts.avatarId || myAvatarId;
      const nick = opts.nick != null ? opts.nick : myNickname;
      const customUrl = (opts.custom != null) ? opts.custom : myAvatarCustom;
      el.innerHTML = '';
      el.classList.remove('has-photo');
      // Reset previous photo/gradient so switching presets is clean
      el.style.background = '';
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.style.backgroundPosition = '';
      el.style.backgroundRepeat = '';
      el.style.backgroundColor = '';
      if (id === 'custom' && customUrl) {
        el.style.backgroundColor = 'transparent';
        el.style.backgroundImage = 'url(' + JSON.stringify(customUrl) + ')';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.color = 'transparent';
        el.textContent = '';
        el.classList.add('has-photo');
        return;
      }
      const preset = getAvatarPreset(id);
      // Gradient must be set via background (shorthand) and NOT cleared with backgroundImage='none'
      el.style.background = preset.bg;
      if (preset.kind === 'emoji') {
        el.textContent = preset.emoji;
        el.style.fontSize = opts.big ? '1.85rem' : (opts.size === 'duel' ? '1.45rem' : '1rem');
        el.style.color = '#fff';
      } else {
        el.textContent = profileInitials(nick);
        el.style.fontSize = opts.big ? '1.55rem' : (opts.size === 'duel' ? '1.1rem' : '0.85rem');
        el.style.color = '#04120e';
      }
    }

    function compressAvatarFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
          reject(new Error('Нужно изображение'));
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          reject(new Error('Файл слишком большой (макс. 8 МБ)'));
          return;
        }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          try {
            const max = 160;
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            const scale = Math.min(1, max / Math.max(w, h));
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            let data = c.toDataURL('image/jpeg', 0.82);
            // shrink if still huge
            if (data.length > 180000) data = c.toDataURL('image/jpeg', 0.65);
            if (data.length > 220000) data = c.toDataURL('image/jpeg', 0.5);
            URL.revokeObjectURL(url);
            resolve(data);
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать фото')); };
        img.src = url;
      });
    }
    function sanitizeNick(raw) {
      let s = String(raw || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
      if (s.length > 7) s = s.slice(0, 7);
      return s;
    }
    function saveProfile(data) {
      const nick = sanitizeNick(data.nick);
      if (nick.length < 2) return { ok: false, err: 'Ник слишком короткий (мин. 2)' };
      const prevNick = myNickname;
      const prevAv = myAvatarId;
      const prevStatus = myStatus;
      myNickname = nick;
      myAvatarId = data.avatarId || myAvatarId;
      myStatus = String(data.status || '').slice(0, 48);
      if (data.custom != null) myAvatarCustom = data.custom;
      try {
        if (myNickname && myNickname !== prevNick && !/^Player/i.test(myNickname)) setAchStat('profileNick', 1);
        if (myAvatarId && myAvatarId !== prevAv) setAchStat('profileAvatar', 1);
        if (myAvatarId === 'custom' && myAvatarCustom) setAchStat('profileCustom', 1);
        if (myStatus && myStatus !== prevStatus) setAchStat('profileStatus', 1);
        checkNewAchievements();
      } catch (_) {}
      try {
        localStorage.setItem('bp_nickname', myNickname);
        localStorage.setItem('bp_avatar', myAvatarId);
        localStorage.setItem('bp_status', myStatus);
        if (myAvatarId === 'custom' && myAvatarCustom) {
          localStorage.setItem('bp_avatar_custom', myAvatarCustom);
        }
      } catch (e) {
        if (myAvatarId === 'custom') {
          return { ok: false, err: 'Не хватило места для фото — выбери пресет' };
        }
      }
      refreshProfileUI();
      try { updateMenuStats(); } catch (_) {}
      return { ok: true };
    }
    function refreshProfileUI() {
      renderAvatarInto(document.getElementById('homeProfileAv'), { avatarId: myAvatarId, nick: myNickname });
      const hn = document.getElementById('homeProfileName');
      if (hn) hn.textContent = myNickname || 'Гость';
      renderAvatarInto(document.getElementById('profileAvBig'), { avatarId: myAvatarId, nick: myNickname, big: true });
      const heroN = document.getElementById('profileHeroName');
      if (heroN) heroN.textContent = myNickname || 'Гость';
      const prev = document.getElementById('profileStatusPreview');
      if (prev) prev.textContent = myStatus || '';
      const codeEl = document.getElementById('profileFriendCode');
      if (codeEl) codeEl.textContent = myFriendCode;
      const stT = document.getElementById('profStatTrophies');
      const stD = document.getElementById('profStatDiamonds');
      const stB = document.getElementById('profStatBest');
      const stS = document.getElementById('profStatStars');
      if (stT) stT.textContent = typeof trophies === 'number' ? trophies : 0;
      if (stD) stD.textContent = typeof diamonds === 'number' ? diamonds : 0;
      if (stB) stB.textContent = typeof best === 'number' ? best : 0;
      try { if (stS) stS.textContent = totalSilverStars() + '/' + maxSilverStars(); } catch (_) {}
      // Sync duel avatar if present
      try {
        const avMe = document.getElementById('duelAvMeInner');
        if (avMe) renderAvatarInto(avMe, { avatarId: myAvatarId, nick: myNickname, size: 'duel' });
      } catch (_) {}
    }
    function renderProfileAvatarGrid() {
      const grid = document.getElementById('profileAvatarGrid');
      if (!grid) return;
      const selected = profileDraft.avatarId || myAvatarId;
      const customUrl = profileDraft.custom != null ? profileDraft.custom : myAvatarCustom;
      const customSel = selected === 'custom' ? ' selected' : '';
      let html = '';
      // upload / custom slot first
      if (customUrl) {
        html += `<button type="button" class="profile-av-opt custom-upload${customSel}" data-av="custom" role="option" aria-selected="${selected === 'custom'}" title="Своё фото"></button>`;
      } else {
        html += `<button type="button" class="profile-av-opt custom-upload${customSel}" data-av="upload" role="option" title="Загрузить фото">＋</button>`;
      }
      html += AVATAR_PRESETS.map(p => {
        const sel = p.id === selected ? ' selected' : '';
        let content;
        if (p.kind === 'emoji') {
          content = p.emoji || '⭐';
        } else {
          // Always show nickname initials on every initials skin (different gradient only)
          content = profileInitials(profileDraft.nick || myNickname);
        }
        const emojiCls = p.kind === 'emoji' ? ' is-emoji' : ' is-initials';
        return `<button type="button" class="profile-av-opt${emojiCls}${sel}" data-av="${p.id}" role="option" aria-selected="${p.id === selected}" style="background:${p.bg}">${content}</button>`;
      }).join('');
      grid.innerHTML = html;
      const customBtn = grid.querySelector('[data-av="custom"]');
      if (customBtn && customUrl) {
        customBtn.style.backgroundImage = 'url("' + customUrl.replace(/"/g, '%22') + '")';
        customBtn.style.backgroundSize = 'cover';
        customBtn.style.backgroundPosition = 'center';
        customBtn.textContent = '';
      }
      grid.querySelectorAll('.profile-av-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const av = btn.dataset.av;
          if (av === 'upload') {
            const fi = document.getElementById('profileAvatarFile');
            if (fi) fi.click();
            return;
          }
          if (av === 'custom') {
            profileDraft.avatarId = 'custom';
            renderProfileAvatarGrid();
            renderAvatarInto(document.getElementById('profileAvBig'), {
              avatarId: 'custom',
              nick: profileDraft.nick || myNickname,
              custom: customUrl,
              big: true
            });
            try { SFX.ui(); } catch (_) {}
            return;
          }
          profileDraft.avatarId = av;
          renderProfileAvatarGrid();
          renderAvatarInto(document.getElementById('profileAvBig'), {
            avatarId: profileDraft.avatarId,
            nick: profileDraft.nick || myNickname,
            big: true
          });
          try { SFX.ui(); } catch (_) {}
        });
      });
    }
    function openProfileScreen() {
      profileDraft = { nick: myNickname, avatarId: myAvatarId, status: myStatus, custom: myAvatarCustom };
      const nickIn = document.getElementById('profileNickInput');
      const stIn = document.getElementById('profileStatusInput');
      if (nickIn) nickIn.value = myNickname;
      if (stIn) stIn.value = myStatus;
      renderProfileAvatarGrid();
      refreshProfileUI();
      renderAvatarInto(document.getElementById('profileAvBig'), {
        avatarId: profileDraft.avatarId,
        nick: profileDraft.nick,
        big: true
      });
      showScreen('profile');
    }

    let friends = [];
    try { friends = JSON.parse(localStorage.getItem('bp_friends') || '[]'); } catch (_) { friends = []; }
    function saveFriends() { localStorage.setItem('bp_friends', JSON.stringify(friends)); }

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

    // —— Friend presence (PeerJS): real lookup + friend requests ——
    function friendPeerId(code) {
      return 'bpfr4-' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    let frPeer = null;
    let frPeerReady = false;
    let frIncoming = []; // { code, name, trophies, conn, ts }
    let frSearchBusy = false;
    let frActiveToast = null; // current toast request
    let frOutgoingConn = null;
    let frOutgoingPeer = null;
    let frOutgoingTimer = null;
    /** Outgoing friend requests awaiting accept/decline: { code, name, ts } */
    let frOutgoingPending = [];
    /** code -> 'online' | 'offline' | 'checking' */
    let friendPresence = {};
    let friendPresenceBusy = false;
    let friendPresenceTimer = null;
    /** code -> activity string from last pong/ping */
    let friendActivity = {};
    /** Local activity broadcast to friends */
    let myActivity = 'menu';
    function activityLabel(act) {
      const a = String(act || '').toLowerCase();
      if (a === 'classic') return 'Классика';
      if (a === 'versus_bots' || a === 'training') return 'Тренировка';
      if (a === 'versus' || a === 'online' || a === 'match') return 'Соревнование';
      if (a === 'shop' || a === 'inventory') return 'Магазин';
      if (a === 'settings') return 'Настройки';
      if (a === 'friends') return 'Друзья';
      if (a === 'history') return 'История';
      if (a === 'achievements') return 'Достижения';
      if (a === 'difficulty' || a === 'duration' || a === 'comptype') return 'Соревнование';
      return 'В меню';
    }
    function detectMyActivity() {
      try {
        const active = document.querySelector('.screen.active');
        const id = (active && active.id) || '';
        const raw = id.replace(/^screen/, '');
        const map = {
          Menu: 'menu', Classic: 'classic', Versus: 'versus', Settings: 'settings',
          Match: 'match', Friends: 'friends', History: 'history', Achievements: 'achievements',
          CompType: 'compType', Difficulty: 'difficulty', Duration: 'duration',
          Shop: 'shop', Inventory: 'inventory'
        };
        let act = map[raw] || 'menu';
        if (act === 'versus') {
          if (vsModeType === 'bots' || currentBot) act = 'versus_bots';
          else if (vsModeType === 'online' || mpMode) act = 'versus';
        }
        if (act === 'match') act = 'match';
        myActivity = act;
        return act;
      } catch (_) {
        return myActivity || 'menu';
      }
    }
    function getFriendActivity(code) {
      code = normalizeFriendCode(code);
      return friendActivity[code] || null;
    }
    function setFriendActivity(code, act) {
      code = normalizeFriendCode(code);
      if (!code) return;
      const next = act ? String(act) : null;
      const prev = friendActivity[code] || null;
      if (next) friendActivity[code] = next;
      else delete friendActivity[code];
      if (prev !== next) {
        // Live update status line without leaving the Friends tab
        try { paintFriendStatusLine(code); } catch (_) {}
      }
    }
    try {
      frOutgoingPending = JSON.parse(localStorage.getItem('bp_fr_out') || '[]') || [];
      if (!Array.isArray(frOutgoingPending)) frOutgoingPending = [];
    } catch (_) { frOutgoingPending = []; }

    function saveOutgoingPending() {
      try { localStorage.setItem('bp_fr_out', JSON.stringify(frOutgoingPending.slice(0, 20))); } catch (_) {}
    }
    function addOutgoingPending(code, name) {
      code = normalizeFriendCode(code);
      if (!code) return;
      frOutgoingPending = frOutgoingPending.filter(p => p.code !== code);
      // Prefer real nickname; never display raw code as the title (avoids code→name flicker)
      let displayName = (name || '').toString().trim().slice(0, 20);
      if (!displayName || displayName.toUpperCase() === code) {
        displayName = 'Игрок';
      }
      frOutgoingPending.unshift({
        code,
        name: displayName,
        namePending: displayName === 'Игрок',
        ts: Date.now()
      });
      saveOutgoingPending();
      renderOutgoingPending(true);
    }

    /** Update outgoing card name in-place (no full re-render / no flash) */
    function updateOutgoingPendingName(code, name) {
      code = normalizeFriendCode(code);
      const p = frOutgoingPending.find(x => x.code === code);
      if (!p) return;
      const n = String(name || '').trim().slice(0, 20);
      if (!n) return;
      p.name = n;
      p.namePending = false;
      saveOutgoingPending();
      const list = document.getElementById('friendOutList');
      if (!list) return;
      const card = list.querySelector('.friend-req-card[data-code="' + code + '"]');
      if (!card) {
        renderOutgoingPending(false);
        return;
      }
      const nameEl = card.querySelector('.f-name');
      const av = card.querySelector('.f-av');
      if (nameEl) nameEl.textContent = n;
      if (av) {
        // keep only initials text node; preserve structure
        const initials = n.slice(0, 2).toUpperCase();
        // replace first text content carefully
        let replaced = false;
        av.childNodes.forEach(node => {
          if (node.nodeType === 3 && node.textContent.trim()) {
            node.textContent = initials;
            replaced = true;
          }
        });
        if (!replaced) {
          // prepend text
          av.insertBefore(document.createTextNode(initials), av.firstChild);
        }
      }
    }
    function removeOutgoingPending(code) {
      code = normalizeFriendCode(code);
      frOutgoingPending = frOutgoingPending.filter(p => p.code !== code);
      saveOutgoingPending();
      renderOutgoingPending(false);
      updateFriendsSectionCounts();
    }

    /** Notify recipient that we cancelled the friend request */
    function notifyFriendReqCancel(targetCode) {
      targetCode = normalizeFriendCode(targetCode);
      if (!targetCode || typeof Peer === 'undefined') return;
      openGamePeer(null, { attempts: 2, timeoutMs: 6000 })
        .then((peer) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            try { peer.destroy(); } catch (_) {}
          };
          setTimeout(finish, 5000);
          let conn;
          try {
            conn = peer.connect(friendPeerId(targetCode), { reliable: true });
          } catch (_) {
            finish();
            return;
          }
          conn.on('open', () => {
            try {
              conn.send({
                type: 'friend_req_cancel',
                code: myFriendCode,
                name: myNickname
              });
            } catch (_) {}
            setTimeout(finish, 400);
          });
          conn.on('error', finish);
          peer.on('error', finish);
        })
        .catch(() => {});
    }

    function cancelOutgoingRequest(code) {
      code = normalizeFriendCode(code);
      if (!code) return;
      const list = document.getElementById('friendOutList');
      const card = list && (
        list.querySelector('.friend-req-card[data-code="' + code + '"]') ||
        (list.querySelector('.fr-out-cancel[data-code="' + code + '"]') &&
          list.querySelector('.fr-out-cancel[data-code="' + code + '"]').closest('.friend-req-card'))
      );
      const finish = () => {
        removeOutgoingPending(code);
        try {
          if (frOutgoingConn) frOutgoingConn.close();
          if (frOutgoingPeer) frOutgoingPeer.destroy();
        } catch (_) {}
        frOutgoingConn = null;
        frOutgoingPeer = null;
        if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
        frSearchBusy = false;
        notifyFriendReqCancel(code);
        setFriendAddStatus('Заявка отменена', 'ok');
        try { SFX.ui(); } catch (_) {}
      };
      if (card) {
        card.classList.add('friend-exit');
        setTimeout(finish, 360);
      } else {
        finish();
      }
    }

    function updateFriendsSectionCounts() {
      let reqN = (frIncoming ? frIncoming.length : 0) + (frOutgoingPending ? frOutgoingPending.length : 0);
      try {
        if (mpPendingJoin && mpRoomCode) reqN += 1;
        if (typeof chPending !== 'undefined' && chPending && chPending.room) reqN += 1;
      } catch (_) {}
      const reqCount = document.getElementById('friendsReqCount');
      const listCount = document.getElementById('friendsListCount');
      const empty = document.getElementById('friendsReqEmpty');
      if (reqCount) reqCount.textContent = String(reqN);
      if (listCount) listCount.textContent = String(friends ? friends.length : 0);
      if (empty) empty.style.display = reqN ? 'none' : '';
    }

    function renderOutgoingPending(animateEnter) {
      const list = document.getElementById('friendOutList');
      if (!list) return;
      // drop stale (>7 days)
      const week = 7 * 24 * 3600 * 1000;
      frOutgoingPending = frOutgoingPending.filter(p => p && p.code && (Date.now() - (p.ts || 0)) < week);
      saveOutgoingPending();
      if (!frOutgoingPending.length) {
        list.innerHTML = '';
        updateFriendsSectionCounts();
        return;
      }
      // Preserve existing cards that already match — only add missing / remove gone (no flicker)
      const existing = new Map();
      list.querySelectorAll('.friend-req-card[data-code]').forEach(el => {
        existing.set(el.getAttribute('data-code'), el);
      });
      const keepCodes = new Set(frOutgoingPending.map(p => p.code));
      // Remove cards no longer pending (without anim here — callers animate first)
      existing.forEach((el, code) => {
        if (!keepCodes.has(code) && !el.classList.contains('friend-exit')) {
          el.remove();
        }
      });
      frOutgoingPending.forEach((p, i) => {
        let card = existing.get(p.code);
        const t = p.ts ? new Date(p.ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const label = (p.name && p.name.toUpperCase() !== p.code) ? p.name : 'Игрок';
        if (card) {
          // Update text in place — never re-run enter animation
          const nameEl = card.querySelector('.f-name');
          const metaEl = card.querySelector('.f-meta');
          const av = card.querySelector('.f-av');
          if (nameEl && nameEl.textContent !== label) nameEl.textContent = label;
          if (metaEl) metaEl.textContent = 'Исходящая · ' + p.code + (t ? ' · ' + t : '');
          if (av) {
            const initials = label.slice(0, 2).toUpperCase();
            av.childNodes.forEach(node => {
              if (node.nodeType === 3 && node.textContent.trim()) node.textContent = initials;
            });
          }
          return;
        }
        // New card
        card = document.createElement('div');
        card.className = 'friend-req-card' + (animateEnter ? ' friend-enter' : '');
        card.setAttribute('data-code', p.code);
        card.style.opacity = '0.95';
        card.innerHTML =
          '<div class="f-av">' + label.slice(0, 2).toUpperCase() + '</div>' +
          '<div class="f-info">' +
            '<div class="f-name">' + label + '</div>' +
            '<div class="f-meta">Исходящая · ' + p.code + (t ? ' · ' + t : '') + '</div>' +
          '</div>' +
          '<div class="f-actions">' +
            '<button type="button" class="ghost fr-out-cancel" data-code="' + p.code + '">Отменить</button>' +
          '</div>';
        list.appendChild(card);
        const btn = card.querySelector('.fr-out-cancel');
        if (btn) btn.addEventListener('click', () => cancelOutgoingRequest(btn.dataset.code));
      });
      // Re-bind cancel on any card that lost listeners (safety)
      list.querySelectorAll('.fr-out-cancel').forEach(btn => {
        if (btn._bpBound) return;
        btn._bpBound = true;
        btn.addEventListener('click', () => cancelOutgoingRequest(btn.dataset.code));
      });
      updateFriendsSectionCounts();
    }

    function setFriendAddStatus(msg, kind) {
      const el = document.getElementById('friendAddStatus');
      if (el) {
        // Keep inline status minimal / empty — primary feedback is top-right toast
        el.textContent = '';
        el.className = 'friend-add-status';
      }
      if (!msg) return;
      const label = kind === 'err' ? 'Ошибка'
        : kind === 'ok' ? 'Готово'
        : kind === 'wait' ? 'Ожидание'
        : 'Друзья';
      const toastKind = kind === 'err' ? 'bad' : (kind === 'ok' ? 'ok' : '');
      try { showInfoToast(label, String(msg), toastKind); } catch (_) {}
    }

    /** Connect to peer presence and send a one-shot message (accept/decline/sync). */
    function deliverPeerMessage(code, payload, opts) {
      opts = opts || {};
      code = normalizeFriendCode(code);
      if (!code || typeof Peer === 'undefined') return Promise.resolve(false);
      const timeoutMs = opts.timeoutMs || 7000;
      return new Promise((resolve) => {
        let settled = false;
        let peer = null;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try { if (peer) peer.destroy(); } catch (_) {}
          resolve(!!ok);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        openGamePeer(null, { attempts: 2, timeoutMs: Math.min(5000, timeoutMs - 500) })
          .then((p) => {
            peer = p;
            if (settled) { try { p.destroy(); } catch (_) {} return; }
            let conn;
            try {
              conn = p.connect(friendPeerId(code), { reliable: true });
            } catch (_) {
              finish(false);
              return;
            }
            conn.on('open', () => {
              try {
                const body = Object.assign({}, payload, {
                  code: myFriendCode,
                  name: myNickname,
                  trophies: typeof trophies === 'number' ? trophies : 0,
                  activity: detectMyActivity()
                });
                conn.send(body);
              } catch (_) {}
              setTimeout(() => finish(true), 120);
            });
            conn.on('error', () => finish(false));
            p.on('error', () => finish(false));
          })
          .catch(() => finish(false));
      });
    }

    function applyIncomingFriendAccept(data) {
      const code = normalizeFriendCode(data && data.code);
      if (!code || code === myFriendCode) return;
      const theirName = (data.name || ('Игрок ' + code.slice(0, 3))).toString().slice(0, 20);
      if (typeof data.activity === 'string') setFriendActivity(code, data.activity);
      const wasPending = frOutgoingPending.some(p => p.code === code);
      const added = addFriendRecord(code, theirName, { trophies: data.trophies });
      removeOutgoingPending(code);
      try { setFriendPresence(code, 'online'); } catch (_) {}
      try { renderFriends(!!(added || wasPending)); } catch (_) {}
      try { renderOutgoingPending(false); } catch (_) {}
      try { updateFriendsSectionCounts(); } catch (_) {}
      if (wasPending || added) {
        try {
          setFriendAddStatus('✓ ' + theirName + ' принял(а) заявку!', 'ok');
        } catch (_) {}
        try { SFX.win && SFX.win(); } catch (_) {}
      }
    }

    function applyIncomingFriendDecline(data) {
      const code = normalizeFriendCode(data && data.code);
      if (!code) return;
      const wasPending = frOutgoingPending.some(p => p.code === code);
      removeOutgoingPending(code);
      if (wasPending) {
        try { setFriendAddStatus('Заявка отклонена', 'err'); } catch (_) {}
        try { SFX.bad && SFX.bad(); } catch (_) {}
      }
      try { renderOutgoingPending(false); } catch (_) {}
      try { updateFriendsSectionCounts(); } catch (_) {}
    }

    function ensureFriendPresence() {
      if (typeof Peer === 'undefined') return;
      if (frPeer && !frPeer.destroyed && frPeerReady) return;
      if (ensureFriendPresence._busy) return;
      ensureFriendPresence._busy = true;

      if (frPeer) {
        try { frPeer.destroy(); } catch (_) {}
        frPeer = null;
        frPeerReady = false;
      }

      openGamePeer(friendPeerId(myFriendCode), { attempts: 4, timeoutMs: 12000 })
        .then((peer) => {
          frPeer = peer;
          frPeerReady = true;
          ensureFriendPresence._busy = false;
          try { setNetStatus(true); } catch (_) {}
          peer.on('connection', (conn) => {
            conn.on('open', () => {});
            conn.on('data', (data) => {
              if (!data || typeof data !== 'object') return;
              if (data.type === 'friend_req') {
                handleIncomingFriendReq(data, conn);
              } else if (data.type === 'friend_req_cancel') {
                const c = normalizeFriendCode(data.code);
                if (c) {
                  frIncoming = frIncoming.filter(r => r.code !== c);
                  if (frActiveToast && frActiveToast.code === c) dismissFrToast(true);
                  renderFriendRequests();
                  updateFriendsSectionCounts();
                }
              } else if (data.type === 'friend_remove') {
                applyRemoteFriendRemove(data);
                // Ack so sender knows delivery succeeded
                try {
                  conn.send({ type: 'friend_remove_ack', code: myFriendCode });
                } catch (_) {}
              } else if (data.type === 'challenge') {
                handleIncomingChallenge(data, conn);
              } else if (data.type === 'challenge_cancel') {
                try {
                  const room = String(data.room || '').toUpperCase();
                  const match = chPending && (
                    !room || String(chPending.room || '').toUpperCase() === room ||
                    (data.code && normalizeFriendCode(chPending.code) === normalizeFriendCode(data.code))
                  );
                  if (match) {
                    chPending = null;
                    hideChToast(true);
                    renderFriendRequests();
                    updateFriendsSectionCounts();
                  }
                } catch (_) {}
              } else if (data.type === 'challenge_decline') {
                try {
                  clearLobbyInviteWait(data.code, data.room);
                  if (data.code) {
                    const c = normalizeFriendCode(data.code);
                    if (c && lobbyInviteWait[c]) delete lobbyInviteWait[c];
                  }
                } catch (_) {}
                const who = (data.name || data.code || 'Игрок').toString().slice(0, 20);
                try {
                  setMpStatus(who + ' отклонил приглашение в лобби');
                  showInfoToast('Приглашение отклонено', who + ' не принял вызов в комнату', 'bad');
                  SFX.bad && SFX.bad();
                  hapticTap(12);
                } catch (_) {}
                try { renderLobbyInviteList(); } catch (_) {}
              } else if (data.type === 'challenge_accept') {
                try {
                  clearLobbyInviteWait(data.code, data.room);
                  if (data.code) {
                    const c = normalizeFriendCode(data.code);
                    if (c && lobbyInviteWait[c]) delete lobbyInviteWait[c];
                  }
                } catch (_) {}
                try {
                  setMpStatus((data.name || 'Друг') + ' принял приглашение — ждём в лобби');
                } catch (_) {}
                try { renderLobbyInviteList(); } catch (_) {}
              } else if (data.type === 'activity_update') {
                const fromCode = normalizeFriendCode(data.code);
                if (fromCode) {
                  try { setFriendPresence(fromCode, 'online'); } catch (_) {}
                  if (typeof data.activity === 'string') setFriendActivity(fromCode, data.activity);
                  if (typeof data.trophies === 'number') {
                    const f = friends.find(x => x.code === fromCode);
                    if (f) { f.trophies = data.trophies; try { saveFriends(); } catch (_) {} }
                  }
                }
              } else if (data.type === 'friend_accept') {
                applyIncomingFriendAccept(data);
              } else if (data.type === 'friend_decline') {
                applyIncomingFriendDecline(data);
              } else if (data.type === 'friend_ping') {
                const fromCode = normalizeFriendCode(data.code);
                if (typeof data.activity === 'string' && fromCode) {
                  setFriendActivity(fromCode, data.activity);
                }
                try {
                  conn.send({
                    type: 'friend_pong',
                    code: myFriendCode,
                    name: myNickname,
                    trophies: typeof trophies === 'number' ? trophies : 0,
                    activity: detectMyActivity()
                  });
                } catch (_) {}
                // If we are already friends, tell them so their outgoing pending clears
                if (fromCode && friends.some(f => f.code === fromCode)) {
                  try {
                    conn.send({
                      type: 'friend_accept',
                      code: myFriendCode,
                      name: myNickname,
                      trophies: typeof trophies === 'number' ? trophies : 0,
                      already: true,
                      activity: detectMyActivity()
                    });
                  } catch (_) {}
                }
                // If they are in our outgoing pending and we somehow both wait — mutual
                if (fromCode && frOutgoingPending.some(p => p.code === fromCode)) {
                  // keep waiting for their accept; just refresh UI activity
                  try { renderFriends(); } catch (_) {}
                }
              } else if (data.type === 'friend_pong') {
                const fromCode = normalizeFriendCode(data.code);
                if (fromCode) {
                  try { setFriendPresence(fromCode, 'online'); } catch (_) {}
                  if (typeof data.activity === 'string') setFriendActivity(fromCode, data.activity);
                  if (typeof data.trophies === 'number') {
                    const f = friends.find(x => x.code === fromCode);
                    if (f) { f.trophies = data.trophies; try { saveFriends(); } catch (_) {} }
                  }
                  try { renderFriends(); } catch (_) {}
                }
              }
            });
            conn.on('close', () => {
              // Keep pending friend requests even if signaling drops — user can still accept later
              frIncoming.forEach(r => {
                if (r.conn === conn) r.conn = null;
              });
              renderFriendRequests();
              // Do not auto-hide toast on brief disconnect
            });
            conn.on('error', () => {});
          });
          peer.on('error', (err) => {
            frPeerReady = false;
            if (err && err.type === 'unavailable-id') {
              try { peer.destroy(); } catch (_) {}
              frPeer = null;
              ensureFriendPresence._busy = false;
              return;
            }
            if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) {
              try { peer.destroy(); } catch (_) {}
              frPeer = null;
              ensureFriendPresence._busy = false;
              setTimeout(() => { try { ensureFriendPresence(); } catch (_) {} }, 2500);
            }
          });
          peer.on('disconnected', () => {
            frPeerReady = false;
            try { if (peer && !peer.destroyed) peer.reconnect(); } catch (_) {}
          });
        })
        .catch(() => {
          ensureFriendPresence._busy = false;
          frPeer = null;
          frPeerReady = false;
          try { setNetStatus(false, 'peer'); } catch (_) {}
          setTimeout(() => { try { ensureFriendPresence(); } catch (_) {} }, 5000);
        });
    }

    function normalizeFriendCode(raw) {
      return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    }

    function clearFriendRequestState(code) {
      code = normalizeFriendCode(code);
      if (!code) return;
      frIncoming = frIncoming.filter(r => r.code !== code);
      if (frActiveToast && frActiveToast.code === code) dismissFrToast(false);
      frOutgoingPending = frOutgoingPending.filter(p => p.code !== code);
      saveOutgoingPending();
    }

    function addFriendRecord(code, name, extra) {
      code = normalizeFriendCode(code);
      if (!code || code === myFriendCode) return false;
      // Becoming friends clears any mutual hanging requests both ways locally
      clearFriendRequestState(code);
      if (friends.some(f => f.code === code)) {
        // update name if empty
        const f = friends.find(x => x.code === code);
        if (f && name && (!f.name || f.name.startsWith('Friend'))) f.name = name;
        saveFriends();
        try { renderFriendRequests(); renderOutgoingPending(); updateFriendsSectionCounts(); } catch (_) {}
        return false;
      }
      friends.unshift({
        code,
        name: (name || ('Игрок ' + code.slice(0, 3))).trim().slice(0, 20),
        added: Date.now(),
        trophies: extra && typeof extra.trophies === 'number' ? extra.trophies : undefined
      });
      saveFriends();
      try { renderFriendRequests(); renderOutgoingPending(); updateFriendsSectionCounts(); } catch (_) {}
      return true;
    }

    function handleIncomingFriendReq(data, conn) {
      const code = normalizeFriendCode(data.code);
      if (!code || code === myFriendCode) {
        try { conn.send({ type: 'friend_decline', reason: 'invalid' }); } catch (_) {}
        return;
      }
      // Always ack so sender sees «на рассмотрении»
      try {
        if (conn && conn.open) {
          conn.send({
            type: 'friend_req_ack',
            code: myFriendCode,
            name: myNickname
          });
        }
      } catch (_) {}
      if (friends.some(f => f.code === code)) {
        const accPayload = {
          type: 'friend_accept',
          code: myFriendCode,
          name: myNickname,
          trophies: typeof trophies === 'number' ? trophies : 0,
          already: true,
          activity: detectMyActivity()
        };
        try { conn.send(accPayload); } catch (_) {}
        try { deliverPeerMessage(code, accPayload); } catch (_) {}
        clearFriendRequestState(code);
        renderFriendRequests();
        renderOutgoingPending();
        return;
      }
      // Mutual: we already sent them a request — auto-accept both sides
      const hadOutgoing = frOutgoingPending.some(p => p.code === code);
      if (hadOutgoing) {
        const accPayload = {
          type: 'friend_accept',
          code: myFriendCode,
          name: myNickname,
          trophies: typeof trophies === 'number' ? trophies : 0,
          activity: detectMyActivity()
        };
        try { conn.send(accPayload); } catch (_) {}
        try { deliverPeerMessage(code, accPayload); } catch (_) {}
        addFriendRecord(code, data.name, { trophies: data.trophies });
        setFriendAddStatus('Вы теперь друзья с ' + ((data.name || code).toString().slice(0, 20)), 'ok');
        renderFriends();
        try { SFX.win && SFX.win(); } catch (_) {}
        return;
      }
      // Deduplicate by code
      frIncoming = frIncoming.filter(r => r.code !== code);
      const req = {
        code,
        name: (data.name || ('Игрок ' + code.slice(0, 3))).toString().slice(0, 20),
        trophies: typeof data.trophies === 'number' ? data.trophies : null,
        conn,
        ts: Date.now()
      };
      frIncoming.unshift(req);
      renderFriendRequests();
      showFrToast(req);
      try { SFX.ui(); } catch (_) {}
      try { hapticTap(12); } catch (_) {}
    }

    let frToastHideTimer = null;
    let frToastCountTimer = null;
    function clearFrToastHideTimer() {
      if (frToastHideTimer) { clearTimeout(frToastHideTimer); frToastHideTimer = null; }
      if (frToastCountTimer) { clearInterval(frToastCountTimer); frToastCountTimer = null; }
    }
    function startToastCountdown(elId, seconds, onZero) {
      const el = document.getElementById(elId);
      let left = Math.max(1, seconds | 0);
      const paint = () => {
        if (el) el.textContent = 'Скроется через ' + left + ' с';
      };
      paint();
      const tickId = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(tickId);
          if (el) el.textContent = 'Скроется…';
          if (onZero) onZero();
          return;
        }
        paint();
      }, 1000);
      return tickId;
    }
    function showFrToast(req) {
      const toast = document.getElementById('frToast');
      if (!toast || !req) return;
      frActiveToast = req;
      clearFrToastHideTimer();
      const av = document.getElementById('frToastAv');
      const name = document.getElementById('frToastName');
      const meta = document.getElementById('frToastMeta');
      if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
      if (name) name.textContent = req.name || req.code;
      if (meta) {
        const parts = ['код ' + req.code];
        if (req.trophies != null) parts.push('🏆 ' + req.trophies);
        meta.textContent = parts.join(' · ');
      }
      toast.style.transform = '';
      toast.style.opacity = '';
      toast.classList.remove('out', 'dragging');
      void toast.offsetWidth;
      toast.classList.add('visible');
      frToastCountTimer = startToastCountdown('frToastCountdown', 5, null);
      frToastHideTimer = setTimeout(() => {
        frToastHideTimer = null;
        if (frActiveToast === req) dismissFrToast(true);
      }, 5000);
    }

    /** Hide toast only — request stays in frIncoming / «Друзья» */
    function dismissFrToast(animate) {
      const toast = document.getElementById('frToast');
      if (!toast) return;
      clearFrToastHideTimer();
      frActiveToast = null;
      toast.style.transform = '';
      toast.style.opacity = '';
      toast.classList.remove('dragging');
      if (animate === false) {
        toast.classList.remove('visible', 'out');
        return;
      }
      toast.classList.add('out');
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.remove('out'), 400);
    }

    function hideFrToast(animate) {
      // backward-compatible alias: hide UI only, keep pending request
      dismissFrToast(animate);
    }

    function respondFriendReq(req, accept) {
      if (!req) return;
      const payload = accept ? {
        type: 'friend_accept',
        code: myFriendCode,
        name: myNickname,
        trophies: typeof trophies === 'number' ? trophies : 0,
        activity: detectMyActivity()
      } : {
        type: 'friend_decline',
        code: myFriendCode,
        reason: 'declined'
      };
      try {
        if (req.conn && req.conn.open) {
          req.conn.send(payload);
        }
      } catch (_) {}
      // Always deliver via presence peer so sender clears outgoing even if original conn died
      try {
        deliverPeerMessage(req.code, payload).then((ok) => {
          if (accept && !ok) {
            // Retry once after short delay
            setTimeout(() => {
              try { deliverPeerMessage(req.code, payload); } catch (_) {}
            }, 2000);
          }
        });
      } catch (_) {}
      const finishResp = () => {
        if (accept) {
          addFriendRecord(req.code, req.name, { trophies: req.trophies });
          try { SFX.win && SFX.win(); } catch (_) {}
          setFriendAddStatus('Вы теперь друзья с ' + (req.name || req.code), 'ok');
        } else {
          clearFriendRequestState(req.code);
          setFriendAddStatus('Запрос отклонён', 'err');
        }
        frIncoming = frIncoming.filter(r => r !== req && r.code !== req.code);
        if (frActiveToast === req) dismissFrToast(true);
        renderFriendRequests();
        renderFriends(!!accept);
        renderOutgoingPending(false);
        updateFriendsSectionCounts();
      };
      // Animate card out if visible in list
      try {
        const list = document.getElementById('friendReqList');
        const cards = list ? list.querySelectorAll('.friend-req-card') : [];
        let card = null;
        cards.forEach(c => {
          const meta = c.querySelector('.f-meta');
          if (meta && meta.textContent && meta.textContent.indexOf(req.code) >= 0) card = c;
        });
        if (card) {
          card.classList.add('friend-exit');
          setTimeout(finishResp, 360);
          return;
        }
      } catch (_) {}
      finishResp();
      try {
        if (req.conn) setTimeout(() => { try { req.conn.close(); } catch (_) {} }, 400);
      } catch (_) {}
    }

    // Swipe right / up to dismiss friend-request toast (request stays pending)
    (function bindFrToastSwipe() {
      const toast = document.getElementById('frToast');
      if (!toast || toast._bpSwipe) return;
      toast._bpSwipe = true;
      let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
      const onStart = (e) => {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        const t = e.touches ? e.touches[0] : e;
        startY = t.clientY;
        startX = t.clientX;
        dy = 0; dx = 0;
        dragging = true;
        toast.classList.add('dragging');
      };
      const onMove = (e) => {
        if (!dragging) return;
        const t = e.touches ? e.touches[0] : e;
        dy = t.clientY - startY;
        dx = t.clientX - startX;
        if (dx > 8 || dy < -8) {
          if (e.cancelable) e.preventDefault();
          const distX = Math.max(0, Math.min(dx, 200));
          const distY = Math.min(0, Math.max(dy, -120));
          toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
          toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
        }
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        toast.classList.remove('dragging');
        if (dx > 64 || dy < -56) {
          dismissFrToast(true);
          try { setFriendAddStatus('Заявка сохранена', 'ok'); } catch (_) {}
        } else {
          toast.style.transform = '';
          toast.style.opacity = '';
        }
        dy = 0; dx = 0;
      };
      toast.addEventListener('touchstart', onStart, { passive: true });
      toast.addEventListener('touchmove', onMove, { passive: false });
      toast.addEventListener('touchend', onEnd, { passive: true });
      toast.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
    })();

    function renderFriendRequests() {
      const list = document.getElementById('friendReqList');
      if (!list) return;
      try {
        if (mpPendingJoin) {
          const roomDead = !mpRoomCode || !mpPeer || (mpPeer && mpPeer.destroyed);
          const full = !!mpOppConnected || !!vsActive;
          if (roomDead || full) {
            const pend = mpPendingJoin;
            mpPendingJoin = null;
            try { hideRjToast(false); } catch (_) {}
            try {
              if (pend.conn && pend.conn.open) {
                pend.conn.send({ type: 'join_decline', reason: full ? 'full' : 'closed' });
              }
            } catch (_) {}
            setTimeout(() => { try { if (pend.conn) pend.conn.close(); } catch (_) {} }, 150);
          }
        }
      } catch (_) {}

      const parts = [];
      frIncoming.forEach((r, i) => {
        const initials = (r.name || r.code || '?').slice(0, 2).toUpperCase();
        const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
        parts.push(`<div class="friend-req-card friend-only-card" data-ri="${i}">
          <div class="f-av">${initials}</div>
          <div class="f-info">
            <div class="f-name">${r.name || 'Игрок'}</div>
            <div class="f-meta"><span class="req-badge">Друзья</span>${r.code}${cups}</div>
          </div>
          <div class="f-actions">
            <button class="primary fr-acc" data-ri="${i}">✓</button>
            <button class="ghost fr-dec" data-ri="${i}">✕</button>
          </div>
        </div>`);
      });
      if (mpPendingJoin && mpRoomCode) {
        const r = mpPendingJoin;
        const initials = (r.name || r.code || '?').slice(0, 2).toUpperCase();
        const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
        parts.push(`<div class="friend-req-card lobby-join-card" data-join="1">
          <div class="f-av">${initials}</div>
          <div class="f-info">
            <div class="f-name">${r.name || 'Игрок'}</div>
            <div class="f-meta"><span class="req-badge">Вход</span>комната ${mpRoomCode}${r.code ? ' · ' + r.code : ''}${cups}</div>
          </div>
          <div class="f-actions">
            <button class="primary" id="frJoinAcc">✓</button>
            <button class="ghost" id="frJoinDec">✕</button>
          </div>
        </div>`);
      }
      if (typeof chPending !== 'undefined' && chPending && chPending.room) {
        const r = chPending;
        const initials = (r.name || r.code || '?').slice(0, 2).toUpperCase();
        const cups = r.trophies != null ? ` · 🏆 ${r.trophies}` : '';
        const mid = vsActive ? ' · матч идёт' : '';
        parts.push(`<div class="friend-req-card lobby-ch-card" data-ch="1">
          <div class="f-av">${initials}</div>
          <div class="f-info">
            <div class="f-name">${r.name || 'Игрок'}</div>
            <div class="f-meta"><span class="req-badge">Лобби</span>${r.room}${mid}${cups}</div>
          </div>
          <div class="f-actions">
            <button class="primary" id="frChAcc">✓</button>
            <button class="ghost" id="frChDec">✕</button>
          </div>
        </div>`);
      }

      list.innerHTML = parts.join('');
      list.querySelectorAll('.fr-acc').forEach(btn => {
        btn.addEventListener('click', () => {
          const r = frIncoming[parseInt(btn.dataset.ri, 10)];
          respondFriendReq(r, true);
        });
      });
      list.querySelectorAll('.fr-dec').forEach(btn => {
        btn.addEventListener('click', () => {
          const r = frIncoming[parseInt(btn.dataset.ri, 10)];
          respondFriendReq(r, false);
        });
      });
      const ja = document.getElementById('frJoinAcc');
      const jd = document.getElementById('frJoinDec');
      if (ja) ja.addEventListener('click', () => { try { acceptPendingJoin(); } catch (_) {} });
      if (jd) jd.addEventListener('click', () => { try { declinePendingJoin('declined'); } catch (_) {} });
      const ca = document.getElementById('frChAcc');
      const cd = document.getElementById('frChDec');
      if (ca) ca.addEventListener('click', () => { try { acceptChallenge(); } catch (_) {} });
      if (cd) cd.addEventListener('click', () => { try { declineChallenge(); } catch (_) {} });
      updateFriendsSectionCounts();
    }


    function getFriendPresence(code) {
      code = normalizeFriendCode(code);
      return friendPresence[code] || 'checking';
    }

    function paintFriendStatusLine(code, state) {
      code = normalizeFriendCode(code);
      if (!code) return;
      const pres = state || getFriendPresence(code);
      const act = getFriendActivity(code);
      let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
      if (pres === 'online' && act) stText = activityLabel(act);
      try {
        document.querySelectorAll('.friend-card[data-code="' + code + '"], .lobby-invite-item[data-code="' + code + '"]').forEach(card => {
          const dot = card.querySelector('.f-online-dot');
          const st = card.querySelector('.f-status-line');
          if (dot) {
            dot.classList.remove('on', 'off', 'checking');
            dot.classList.add(pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking');
          }
          if (st) {
            st.classList.remove('on', 'off');
            if (pres === 'online') st.classList.add('on');
            else if (pres === 'offline') st.classList.add('off');
            st.textContent = stText;
          }
        });
      } catch (_) {}
    }

    function setFriendPresence(code, state) {
      code = normalizeFriendCode(code);
      if (!code) return;
      const prev = friendPresence[code];
      if (prev === state) {
        // Still refresh label (activity may have changed)
        if (state === 'online') paintFriendStatusLine(code, state);
        return;
      }
      friendPresence[code] = state;
      paintFriendStatusLine(code, state);
    }

    function probeFriendOnline(code) {
      code = normalizeFriendCode(code);
      if (!code || typeof Peer === 'undefined') {
        setFriendPresence(code, 'offline');
        return Promise.resolve(false);
      }
      setFriendPresence(code, 'checking');
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          setFriendPresence(code, ok ? 'online' : 'offline');
          try { peer.destroy(); } catch (_) {}
          resolve(!!ok);
        };
        let peer = null;
        const timer = setTimeout(() => finish(false), 5500);
        openGamePeer(null, { attempts: 2, timeoutMs: 4500 })
          .then((p) => {
            peer = p;
            if (settled) { try { p.destroy(); } catch (_) {} return; }
            let conn;
            try {
              conn = p.connect(friendPeerId(code), { reliable: true });
            } catch (_) {
              clearTimeout(timer);
              finish(false);
              return;
            }
            conn.on('open', () => {
              try {
                conn.send({
                  type: 'friend_ping',
                  code: myFriendCode,
                  name: myNickname,
                  trophies: typeof trophies === 'number' ? trophies : 0,
                  activity: detectMyActivity()
                });
              } catch (_) {}
              // Listen briefly for pong (activity) / accept (clear outgoing)
              const onData = (data) => {
                if (!data || typeof data !== 'object') return;
                if (data.type === 'friend_pong') {
                  if (typeof data.activity === 'string') setFriendActivity(code, data.activity);
                  if (typeof data.trophies === 'number') {
                    const f = friends.find(x => x.code === code);
                    if (f) { f.trophies = data.trophies; try { saveFriends(); } catch (_) {} }
                  }
                } else if (data.type === 'friend_accept') {
                  applyIncomingFriendAccept(data);
                } else if (data.type === 'friend_decline') {
                  applyIncomingFriendDecline(data);
                }
              };
              try { conn.on('data', onData); } catch (_) {}
              // connection open = presence peer is registered → online
              clearTimeout(timer);
              // Keep open a bit longer to receive pong/activity
              setTimeout(() => {
                finish(true);
                setTimeout(() => { try { conn.close(); } catch (_) {} }, 80);
              }, 450);
            });
            conn.on('error', () => {
              clearTimeout(timer);
              finish(false);
            });
            p.on('error', () => {
              clearTimeout(timer);
              finish(false);
            });
          })
          .catch(() => {
            clearTimeout(timer);
            finish(false);
          });
      });
    }

    async function refreshFriendsPresence() {
      if (friendPresenceBusy) return;
      if (!friends || !friends.length) return;
      if (typeof Peer === 'undefined') return;
      friendPresenceBusy = true;
      try {
        // Probe sequentially with small gaps to avoid PeerJS spam
        for (const f of friends.slice(0, 30)) {
          const c = normalizeFriendCode(f.code);
          if (!c) continue;
          await probeFriendOnline(c);
          await new Promise(r => setTimeout(r, 180));
        }
      } catch (_) {}
      friendPresenceBusy = false;
    }

    function scheduleFriendsPresence() {
      try { refreshFriendsPresence(); } catch (_) {}
      if (friendPresenceTimer) clearInterval(friendPresenceTimer);
      friendPresenceTimer = setInterval(() => {
        const scr = document.getElementById('screenFriends');
        const inv = document.getElementById('lobbyInviteModal');
        if ((scr && scr.classList.contains('active')) || (inv && inv.classList.contains('visible'))) {
          try { refreshFriendsPresence(); } catch (_) {}
        }
      }, 10000);
    }

    let activityBroadcastTimer = null;
    let lastBroadcastActivity = null;
    function broadcastMyActivity(force) {
      try {
        const act = detectMyActivity();
        if (!force && act === lastBroadcastActivity) return;
        lastBroadcastActivity = act;
        if (!friends || !friends.length || typeof Peer === 'undefined') return;
        // Push activity to friends we already know are online (cheap sequential)
        const targets = friends.filter(f => getFriendPresence(f.code) === 'online').slice(0, 12);
        if (!targets.length) return;
        let i = 0;
        const step = () => {
          if (i >= targets.length) return;
          const f = targets[i++];
          deliverPeerMessage(f.code, {
            type: 'activity_update',
            activity: act,
            name: myNickname,
            trophies: typeof trophies === 'number' ? trophies : 0
          }, { timeoutMs: 4500 }).finally(() => {
            setTimeout(step, 120);
          });
        };
        step();
      } catch (_) {}
    }
    function scheduleActivityBroadcast() {
      if (activityBroadcastTimer) clearTimeout(activityBroadcastTimer);
      activityBroadcastTimer = setTimeout(() => {
        activityBroadcastTimer = null;
        try { broadcastMyActivity(false); } catch (_) {}
      }, 400);
    }

    function getFriendSearchQuery() {
      const el = document.getElementById('friendSearchInput');
      return el ? (el.value || '').trim().toLowerCase() : '';
    }

    function renderFriends(highlightNew) {
      const codeEl = document.getElementById('myFriendCode');
      if (codeEl) codeEl.textContent = myFriendCode;
      renderFriendRequests();
      renderOutgoingPending();
      const list = document.getElementById('friendList');
      if (!list) return;
      if (!friends.length) {
        list.innerHTML = '<div class="friends-section-empty">Пока нет друзей — добавьте по коду выше</div>';
        updateFriendsSectionCounts();
        return;
      }
      const q = getFriendSearchQuery();
      const indexed = friends.map((f, i) => ({ f, i })).filter(({ f }) => {
        if (!q) return true;
        const name = (f.name || '').toLowerCase();
        const code = (f.code || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      });
      if (!indexed.length) {
        list.innerHTML = '<div class="friends-section-empty">Никого не найдено по «' +
          (getFriendSearchQuery().replace(/[<>&]/g, '') || '…') + '»</div>';
        updateFriendsSectionCounts();
        return;
      }
      list.innerHTML = indexed.map(({ f, i }, visIdx) => {
        const initials = (f.name || f.code || '?').slice(0, 2).toUpperCase();
        const cups = (typeof f.trophies === 'number') ? ` · 🏆 ${f.trophies}` : '';
        // Animate only on first paint of the screen (or new friend) — not on presence refresh
        const scr = document.getElementById('screenFriends');
        const alreadyOpen = !!(scr && scr.classList.contains('active'));
        const anim = (highlightNew && i === 0)
          ? ' friend-added'
          : (!alreadyOpen && visIdx < 8 ? ' friend-enter' : '');
        const delay = (!alreadyOpen && visIdx < 8) ? ` style="animation-delay:${visIdx * 0.04}s"` : '';
        const pres = getFriendPresence(f.code);
        const act = getFriendActivity(f.code);
        const dotCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking';
        let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
        if (pres === 'online' && act) stText = activityLabel(act);
        const stCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : '';
        return `<div class="friend-card${anim}" data-fi="${i}" data-code="${f.code}"${delay}>
          <div class="f-av">${initials}<span class="f-online-dot ${dotCls}"></span></div>
          <div class="f-info">
            <div class="f-name">${f.name || 'Друг'}</div>
            <div class="f-code">${f.code}${cups} · <span class="f-status-line ${stCls}" style="display:inline">${stText}</span></div>
          </div>
          <div class="f-actions">
            <button type="button" class="primary f-challenge" data-fi="${i}">Вызов</button>
            <button type="button" class="ghost f-remove" data-fi="${i}">✕</button>
          </div>
        </div>`;
      }).join('');
      list.querySelectorAll('.f-challenge').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          challengeFriend(friends[parseInt(btn.dataset.fi, 10)]);
        });
      });
      list.querySelectorAll('.f-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btn.dataset.fi, 10);
          if (confirm('Удалить из друзей? Вы также пропадёте у него в списке.')) {
            removeFriendAt(idx);
          }
        });
      });
      updateFriendsSectionCounts();
    }

    // Event delegation backup for friend actions (touch / re-renders)
    (function bindFriendListDelegation() {
      const list = document.getElementById('friendList');
      if (!list || list._bpFriendDel) return;
      list._bpFriendDel = true;
      list.addEventListener('click', (e) => {
        const rm = e.target.closest && e.target.closest('.f-remove');
        const ch = e.target.closest && e.target.closest('.f-challenge');
        if (rm) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(rm.dataset.fi, 10);
          if (!isNaN(idx) && confirm('Удалить из друзей? Вы также пропадёте у него в списке.')) {
            removeFriendAt(idx);
          }
        } else if (ch) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(ch.dataset.fi, 10);
          if (!isNaN(idx)) challengeFriend(friends[idx]);
        }
      });
    })();


    function cleanupOutgoingSearch() {
      if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
      try { if (frOutgoingConn) frOutgoingConn.close(); } catch (_) {}
      try { if (frOutgoingPeer) frOutgoingPeer.destroy(); } catch (_) {}
      frOutgoingConn = null;
      frOutgoingPeer = null;
      frSearchBusy = false;
    }

    function addFriendByCode(code) {
      code = normalizeFriendCode(code);
      const input = document.getElementById('friendCodeInput');
      if (input) input.value = code;

      if (code.length !== 6) {
        setFriendAddStatus('Код должен быть из 6 символов (A–Z, 2–9)', 'err');
        return;
      }
      if (code === myFriendCode) {
        setFriendAddStatus('Это твой собственный код', 'err');
        return;
      }
      if (friends.some(f => f.code === code)) {
        setFriendAddStatus('Уже в списке друзей', 'err');
        return;
      }
      if (frOutgoingPending.some(p => p.code === code)) {
        renderOutgoingPending();
        setFriendAddStatus('Заявка уже отправлена', 'wait');
        return;
      }
      if (typeof Peer === 'undefined') {
        setFriendAddStatus('Нужен интернет (PeerJS не загрузился)', 'err');
        return;
      }
      if (!checkCrossPlatformReady()) return;
      if (frSearchBusy) {
        setFriendAddStatus('Подождите, проверяем предыдущий код…', 'wait');
        return;
      }

      // Verify peer exists (online presence) before keeping the request
      frSearchBusy = true;
      setFriendAddStatus('Проверяем код…', 'wait');
      try { SFX.ui(); } catch (_) {}
      try { ensureFriendPresence(); } catch (_) {}

      let finished = false;
      let delivered = false;
      const failNotFound = () => {
        if (finished) return;
        finished = true;
        removeOutgoingPending(code);
        setFriendAddStatus('Игрок с таким кодом не найден или не в сети', 'err');
        try { if (frOutgoingConn) frOutgoingConn.close(); } catch (_) {}
        try { if (frOutgoingPeer) frOutgoingPeer.destroy(); } catch (_) {}
        frOutgoingConn = null;
        frOutgoingPeer = null;
        if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
        frSearchBusy = false;
        try { SFX.bad && SFX.bad(); } catch (_) {}
      };
      const doneSoft = () => {
        // Keep pending after successful delivery; only release peer resources
        try { if (frOutgoingConn) frOutgoingConn.close(); } catch (_) {}
        try { if (frOutgoingPeer) frOutgoingPeer.destroy(); } catch (_) {}
        frOutgoingConn = null;
        frOutgoingPeer = null;
        if (frOutgoingTimer) { clearTimeout(frOutgoingTimer); frOutgoingTimer = null; }
        frSearchBusy = false;
      };

      // Must open connection within this window or code is considered missing/offline
      frOutgoingTimer = setTimeout(() => {
        if (!delivered) failNotFound();
        else doneSoft();
      }, 10000);

      openGamePeer(null, { attempts: 3, timeoutMs: 8000 })
        .then((peer) => {
          if (finished) {
            try { peer.destroy(); } catch (_) {}
            return;
          }
          frOutgoingPeer = peer;
          let conn;
          try {
            conn = peer.connect(friendPeerId(code), { reliable: true });
          } catch (_) {
            failNotFound();
            return;
          }
          frOutgoingConn = conn;
          conn.on('open', () => {
            if (finished) return;
            delivered = true;
            // Peer is online — only now register outgoing request
            if (!frOutgoingPending.some(p => p.code === code)) {
              addOutgoingPending(code, 'Игрок');
            }
            if (input) input.value = '';
            setFriendAddStatus('Заявка отправлена', 'ok');
            try {
              conn.send({
                type: 'friend_req',
                code: myFriendCode,
                name: myNickname,
                trophies: typeof trophies === 'number' ? trophies : 0
              });
            } catch (_) {}
            // Card is already shown once via addOutgoingPending — no second enter animation
          });
          conn.on('data', (data) => {
            if (finished || !data || typeof data !== 'object') return;
            if (data.type === 'friend_accept') {
              finished = true;
              const theirName = (data.name || ('Игрок ' + code.slice(0, 3))).toString().slice(0, 20);
              removeOutgoingPending(code);
              addFriendRecord(code, theirName, { trophies: data.trophies });
              setFriendAddStatus('✓ ' + theirName + ' принял(а) заявку!', 'ok');
              renderFriends(true);
              try { SFX.win && SFX.win(); } catch (_) {}
              try { hapticTap(16); } catch (_) {}
              doneSoft();
            } else if (data.type === 'friend_decline') {
              finished = true;
              // animate remove outgoing
              animateRemoveOutgoing(code, () => {
                removeOutgoingPending(code);
                setFriendAddStatus('Заявка отклонена', 'err');
              });
              doneSoft();
            } else if (data.type === 'friend_req_ack' && data.name) {
              updateOutgoingPendingName(code, data.name);
            }
          });
          conn.on('error', () => {
            if (!delivered) failNotFound();
          });
          conn.on('close', () => {
            if (!delivered && !finished) failNotFound();
          });
          peer.on('error', () => {
            if (!delivered) failNotFound();
          });
        })
        .catch(() => {
          failNotFound();
        });
    }

    function animateRemoveOutgoing(code, after) {
      const list = document.getElementById('friendOutList');
      if (!list) { if (after) after(); return; }
      const card = list.querySelector('.friend-req-card[data-code="' + code + '"]')
        || (list.querySelector('.fr-out-cancel[data-code="' + code + '"]') || {}).closest?.('.friend-req-card');
      if (!card) { if (after) after(); return; }
      card.classList.add('friend-exit');
      setTimeout(() => { if (after) after(); }, 360);
    }

    // Bind toast buttons once DOM ready (script at end of body)
    (function bindFrToast() {
      const acc = document.getElementById('frToastAccept');
      const dec = document.getElementById('frToastDecline');
      const dis = document.getElementById('frToastDismiss');
      if (acc) acc.addEventListener('click', () => {
        if (frActiveToast) respondFriendReq(frActiveToast, true);
      });
      if (dec) dec.addEventListener('click', () => {
        if (frActiveToast) respondFriendReq(frActiveToast, false);
      });
      if (dis) dis.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissFrToast(true);
        try { setFriendAddStatus('Заявка сохранена', 'ok'); } catch (_) {}
      });
    })();

    // Start presence when possible
    setTimeout(() => {
      try { checkCrossPlatformReady(); } catch (_) {}
      try {
        openGamePeer(null, { attempts: 2, timeoutMs: 10000 }).then((p) => {
          setNetStatus(true);
          try { p.destroy(); } catch (_) {}
        }).catch(() => setNetStatus(false, 'peer'));
      } catch (_) {}
    }, 800);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        try { ensureFriendPresence(); } catch (_) {}
        // Both left → one rejoined already: other must still see rejoin toast on return
        try {
          if (!vsActive && !window._matchEnded && !window._mpRejoiningMatch) {
            const s = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
            if (s) {
              showMatchRejoinPanel(s);
              try { startRejoinPanelListen(s); } catch (_2) {}
            }
          }
        } catch (_) {}
      }
    });

    const LIVE_MATCH_KEY = 'bp_live_match';
    function persistLiveMatch(opts) {
      try {
        opts = opts || {};
        const resultUp = (() => {
          try {
            const r = document.getElementById('versusResult');
            return !!(r && r.classList.contains('visible'));
          } catch (_) { return false; }
        })();
        // Never DELETE the snapshot here — only skip writing.
        // Deleting on !vsActive wiped rejoin ability when both players left.
        if (resultUp || window._matchEnded) return;
        if (!opts.forceLeave && (!vsActive || !mpMode)) return;
        if (!mpMode && !opts.forceLeave) return;

        const nowTs = Date.now();
        // leftAt only when the player actually left (myDcAt set by notifyLeavingMatch)
        const leftAtVal = (typeof myDcAt === 'number' && myDcAt > 0) ? myDcAt : null;
        const oppLeftVal = (typeof oppDcAt === 'number' && oppDcAt > 0) ? oppDcAt : 0;
        const snap = {
          t: nowTs,
          leftAt: leftAtVal || nowTs,
          oppLeftAt: oppLeftVal,
          oppDcDeadline: (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) ? dcDeadlineTs : 0,
          bothAway: !!(leftAtVal && oppLeftVal),
          role: mpRole,
          room: mpRoomCode,
          remotePeer: mpRemotePeerId,
          selfPeerId: (mpPeer && !mpPeer.destroyed && mpPeer.id) ? mpPeer.id : null,
          fromMM: !!mpFromMatchmaking,
          score: score,
          oppScore: oppScore,
          vsTimeLeft: vsTimeLeft,
          // Wall-clock match end — keeps ticking while both players are offline
          clockEndTs: (function () {
            try {
              if (typeof window._matchClockEndTs === 'number' && window._matchClockEndTs > 0) {
                return window._matchClockEndTs;
              }
              const prev = JSON.parse(localStorage.getItem(LIVE_MATCH_KEY) || 'null');
              if (prev && typeof prev.clockEndTs === 'number' && prev.clockEndTs > 0) {
                window._matchClockEndTs = prev.clockEndTs;
                return prev.clockEndTs;
              }
            } catch (_) {}
            const end = Date.now() + Math.max(0, vsTimeLeft || 0) * 1000;
            window._matchClockEndTs = end;
            return end;
          })(),
          vsDuration: vsDuration,
          oppName: oppName || mpOppName,
          myBoardId: equippedBoardId,
          oppBoardId: window.mpOppBoardId || null,
          mySkinId: equippedSkinId,
          oppSkinId: window.mpOppSkinId || null,
          ranked: !!mpFromMatchmaking,
          grid: (typeof grid !== 'undefined' && Array.isArray(grid)) ? grid : null,
          oppGrid: (typeof oppGrid !== 'undefined' && Array.isArray(oppGrid)) ? oppGrid : null,
          pieces: (typeof pieces !== 'undefined' && Array.isArray(pieces)) ? pieces.map(p => ({
            shape: (p.shape || []).map(c => c.slice()), color: p.color, used: !!p.used
          })) : null,
          oppPieces: (typeof oppPieces !== 'undefined' && Array.isArray(oppPieces)) ? oppPieces.map(p => ({
            shape: (p.shape || []).map(c => c.slice()), color: p.color, used: !!p.used
          })) : null,
          // Replay log so expired dual-away matches still appear in history
          moves: (typeof matchLog !== 'undefined' && Array.isArray(matchLog)) ? matchLog.slice() : null,
          matchStartTs: (typeof matchStartTs === 'number') ? matchStartTs : null
        };
        // Preserve prior leave stamps if this is a mid-match autosave without leave
        // Critical: while solo-rejoin / opponent still offline, never rewrite leftAt to "now"
        // (that freezes the reconnect countdown for both clients).
        if (!leftAtVal) {
          try {
            const prev = JSON.parse(localStorage.getItem(LIVE_MATCH_KEY) || 'null');
            const solo = !!(typeof window !== 'undefined' && window._soloRejoinActive);
            const waitingOpp = !!(typeof oppDisconnected !== 'undefined' && oppDisconnected);
            if (prev && typeof prev.leftAt === 'number' && prev.leftAt > 0 && (prev.bothAway || solo || waitingOpp)) {
              snap.leftAt = prev.leftAt;
              snap.bothAway = !!(prev.bothAway || solo);
              if (typeof prev.oppLeftAt === 'number' && prev.oppLeftAt > 0 && !snap.oppLeftAt) {
                snap.oppLeftAt = prev.oppLeftAt;
              }
              if (typeof prev.oppDcDeadline === 'number' && prev.oppDcDeadline > 0 && !snap.oppDcDeadline) {
                snap.oppDcDeadline = prev.oppDcDeadline;
              }
            } else if (solo || waitingOpp) {
              // Keep absolute deadline already in memory
              if (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) {
                snap.oppDcDeadline = dcDeadlineTs;
                // Reconstruct a stable leftAt so panel countdown keeps ticking
                const winMs = (typeof reconnectWindowMs === 'function' && prev)
                  ? reconnectWindowMs(prev) : 60000;
                snap.leftAt = Math.max(0, dcDeadlineTs - winMs);
              } else if (prev && typeof prev.leftAt === 'number' && prev.leftAt > 0) {
                snap.leftAt = prev.leftAt;
              }
              snap.bothAway = true;
            } else {
              // Active match save — leftAt = t means "last seen alive", not a leave
              snap.leftAt = nowTs;
              snap.bothAway = false;
            }
          } catch (_) {}
        }
        localStorage.setItem(LIVE_MATCH_KEY, JSON.stringify(snap));
      } catch (_) {}
    }
    function clearLiveMatch() {
      try { localStorage.removeItem(LIVE_MATCH_KEY); } catch (_) {}
      try { hideMatchRejoinPanel(); } catch (_) {}
      try { window._rejoinStateApplied = false; } catch (_) {}
      try { window._rejoinPanelListening = false; } catch (_) {}
      try {
        if (window._rejoinPanelDialIv) {
          clearInterval(window._rejoinPanelDialIv);
          window._rejoinPanelDialIv = null;
        }
      } catch (_) {}
    }
    /** Sync vsTimeLeft from wall-clock end; start 1s tick. Time runs even if peer is gone. */
    function startMatchWallClock(endTs) {
      try {
        if (typeof endTs === 'number' && endTs > 0) {
          window._matchClockEndTs = endTs;
        } else if (!(typeof window._matchClockEndTs === 'number' && window._matchClockEndTs > 0)) {
          window._matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
        }
        vsTimeLeft = Math.max(0, Math.ceil((window._matchClockEndTs - Date.now()) / 1000));
        try { updateTimerDisplay(); } catch (_) {}
        if (vsTimerId) { try { clearInterval(vsTimerId); } catch (_) {} vsTimerId = null; }
        vsTimerId = setInterval(() => {
          if (!vsActive || window._matchEnded) return;
          vsTimeLeft = Math.max(0, Math.ceil((window._matchClockEndTs - Date.now()) / 1000));
          try { updateTimerDisplay(); } catch (_) {}
          if (vsTimeLeft <= 0) {
            try { endVersus(); } catch (_) {}
          }
        }, 250);
      } catch (_) {}
    }
    /** Restart wall clock if interval was killed but match is still live. */
    function ensureMatchClockRunning() {
      try {
        if (!vsActive || window._matchEnded || replayMode) return;
        if (vsTimerId) return;
        const end = (typeof window._matchClockEndTs === 'number' && window._matchClockEndTs > 0)
          ? window._matchClockEndTs
          : (Date.now() + Math.max(0, vsTimeLeft || 0) * 1000);
        startMatchWallClock(end);
      } catch (_) {}
    }
    /** Drop input locks if match is live (recovers from stuck rejoin overlay). */
    function ensurePlayableIfLive() {
      try {
        if (!vsActive || window._matchEnded || replayMode) return;
        // Overlay must not stick forever
        if (window._rejoinLoading || window._rejoinInputLock) {
          const el = document.getElementById('rejoinLoading');
          const shown = el && el.classList.contains('show');
          // If overlay not visible, force-clear locks
          if (!shown) {
            window._rejoinLoading = false;
            window._rejoinInputLock = false;
            placingLock = false;
            window._mpRejoiningMatch = false;
          }
        }
        if (placingLock && !isDragging && !window._rejoinLoading) {
          placingLock = false;
        }
        ensureMatchClockRunning();
      } catch (_) {}
    }
    /** Absolute wall-clock end of match timer (ms). Time keeps running while both are away. */
    function getSnapClockEndTs(snap) {
      if (!snap) return 0;
      if (typeof snap.clockEndTs === 'number' && snap.clockEndTs > 0) return snap.clockEndTs;
      const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
      const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft
        : (typeof snap.vsDuration === 'number' ? snap.vsDuration : 120);
      return leftAt + Math.max(0, leftSec) * 1000;
    }
    /** Remaining match seconds from wall clock (0 if time already up). */
    function remainingMatchSecFromSnap(snap) {
      const end = getSnapClockEndTs(snap);
      return Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }
    /** Reconnect window: min(60s from leave, remaining match time at leave). */
    function reconnectWindowMs(snap) {
      if (!snap) return 60000;
      const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
      const end = getSnapClockEndTs(snap);
      // How much match time was left when they left
      const matchLeftAtLeave = Math.max(0, end - leftAt);
      return Math.min(60000, matchLeftAtLeave);
    }
    function reconnectDeadlineTs(snap) {
      const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
      return leftAt + reconnectWindowMs(snap);
    }
    function readLiveMatch() {
      try {
        const raw = localStorage.getItem(LIVE_MATCH_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !s.t) return null;
        const now = Date.now();
        // Hard expire after 10 minutes wall-clock (safety)
        if (now - s.t > 10 * 60 * 1000) {
          localStorage.removeItem(LIVE_MATCH_KEY);
          return null;
        }
        const leftAt = (typeof s.leftAt === 'number' && s.leftAt > 0) ? s.leftAt : s.t;
        const age = now - leftAt;
        const reconnectMs = reconnectWindowMs(s);
        // Full reconnect window for both players even if both left
        if (age > reconnectMs + 3000) {
          localStorage.removeItem(LIVE_MATCH_KEY);
          return null;
        }
        // Match clock already ended while away — still return snap so caller can resolve by score
        return s;
      } catch (_) { return null; }
    }
    function resolveRejoinAwait(payload) {
      try {
        const fn = window._rejoinAwait;
        window._rejoinAwait = null;
        if (typeof fn === 'function') fn(payload);
      } catch (_) {}
    }
    /** Quiet probe: if peer says match ended (or unreachable), drop rejoin toast. */
    async function probeAndCleanLiveMatch() {
      const snap = readLiveMatch();
      if (!snap) {
        try { hideMatchRejoinPanel(); } catch (_) {}
        return false;
      }
      if (vsActive || window._mpRejoiningMatch) return true;
      let target = null;
      try {
        target = snap.remotePeer || (snap.room && typeof roomPeerId === 'function' ? roomPeerId(snap.room) : null);
      } catch (_) { target = snap.remotePeer || null; }
      if (!target) {
        clearLiveMatch();
        return false;
      }
      let peer = null;
      let conn = null;
      try {
        peer = await openGamePeer(null, { attempts: 1, timeoutMs: 6000 });
        conn = peer.connect(target, { reliable: true });
        await new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('timeout')), 7000);
          conn.on('open', () => { clearTimeout(t); resolve(); });
          conn.on('error', (e) => { clearTimeout(t); reject(e); });
        });
        const result = await new Promise((resolve) => {
          const t = setTimeout(() => resolve({ stillLive: false, _timeout: true }), 5000);
          window._rejoinAwait = (payload) => {
            clearTimeout(t);
            resolve(payload || { stillLive: false });
          };
          try {
            conn.send({
              type: 'match_rejoin',
              name: (typeof myNickname === 'string' ? myNickname : 'Player'),
              score: snap.score || 0,
              oppScore: snap.oppScore || 0,
              vsTimeLeft: snap.vsTimeLeft,
              probe: true
            });
          } catch (_) {
            clearTimeout(t);
            resolve({ stillLive: false });
          }
        });
        try { conn.close(); } catch (_) {}
        try { peer.destroy(); } catch (_) {}
        // Only clear when peer explicitly ends the match (not on timeout)
        if (result && result.stillLive === false && !result._timeout) {
          clearLiveMatch();
          return false;
        }
        return true;
      } catch (_) {
        try { if (conn) conn.close(); } catch (_) {}
        try { if (peer) peer.destroy(); } catch (_) {}
        // Unreachable: keep toast — match may still be live
        return true;
      }
    }
    function notifyLeavingMatch() {
      if (!mpMode) return;
      // Allow leave stamp even if vsActive just flipped — still need rejoin snapshot
      if (!vsActive && !readLiveMatch()) return;
      try {
        if (!myDcAt) myDcAt = Date.now();
      } catch (_) { myDcAt = Date.now(); }
      try {
        if (oppDcAt > 0) bothAwayMode = true;
      } catch (_) {}
      try { persistLiveMatch({ forceLeave: true }); } catch (_) {}
      try {
        mpSend({
          type: 'leaving',
          score: score,
          oppScore: oppScore,
          vsTimeLeft: vsTimeLeft,
          leftAt: myDcAt || Date.now()
        });
      } catch (_) {}
      try { if (mpConn && mpConn.open) mpConn.close(); } catch (_) {}
      // Force flush storage for mobile webviews
      try { localStorage.setItem(LIVE_MATCH_KEY, localStorage.getItem(LIVE_MATCH_KEY) || ''); } catch (_) {}
    }
    window.addEventListener('pagehide', () => { try { notifyLeavingMatch(); } catch (_) {} });
    window.addEventListener('beforeunload', () => { try { notifyLeavingMatch(); } catch (_) {} });

    function showMatchRejoinPanel(snap) {
      const el = document.getElementById('matchRejoinPanel');
      if (!el) return;
      const sub = document.getElementById('matchRejoinSub');
      if (sub && snap) {
        const opp = snap.oppName || 'соперником';
        let leftSec = 0;
        try {
          const la = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
          const rm = (typeof reconnectWindowMs === 'function') ? reconnectWindowMs(snap) : 60000;
          leftSec = Math.max(0, Math.ceil((la + rm - Date.now()) / 1000));
        } catch (_) {}
        sub.textContent = leftSec > 0
          ? ('Матч с ' + opp + ' · переподключение ещё ' + leftSec + ' сек')
          : ('Матч с ' + opp + ' · можно вернуться или сдаться');
      }
      el.classList.add('show');
      // Refresh countdown every second while panel is visible
      try {
        if (window._rejoinPanelTick) clearInterval(window._rejoinPanelTick);
        window._rejoinPanelTick = setInterval(() => {
          try {
            if (!el.classList.contains('show')) {
              clearInterval(window._rejoinPanelTick);
              window._rejoinPanelTick = null;
              return;
            }
            const s = readLiveMatch();
            if (!s) {
              clearInterval(window._rejoinPanelTick);
              window._rejoinPanelTick = null;
              hideMatchRejoinPanel();
              return;
            }
            let left;
            if (typeof s.oppDcDeadline === 'number' && s.oppDcDeadline > 0) {
              left = Math.max(0, Math.ceil((s.oppDcDeadline - Date.now()) / 1000));
            } else {
              const la = (typeof s.leftAt === 'number' && s.leftAt > 0) ? s.leftAt : s.t;
              const rm = (typeof reconnectWindowMs === 'function') ? reconnectWindowMs(s) : 60000;
              left = Math.max(0, Math.ceil((la + rm - Date.now()) / 1000));
            }
            const subEl = document.getElementById('matchRejoinSub');
            if (subEl) {
              const opp = s.oppName || 'соперником';
              subEl.textContent = left > 0
                ? ('Матч с ' + opp + ' · переподключение ещё ' + left + ' сек')
                : ('Матч с ' + opp + ' · окно истекло');
            }
            if (left <= 0) {
              clearInterval(window._rejoinPanelTick);
              window._rejoinPanelTick = null;
              try {
                if (!window._matchEnded && !window._mpRejoiningMatch) {
                  let expired = s;
                  try {
                    const r = localStorage.getItem(LIVE_MATCH_KEY);
                    if (r) expired = JSON.parse(r) || s;
                  } catch (_) {}
                  if (typeof resolveBothAwayFromSnap === 'function') {
                    resolveBothAwayFromSnap(expired, true);
                  }
                }
              } catch (_) {}
            }
          } catch (_) {}
        }, 1000);
      } catch (_) {}
    }
    function hideMatchRejoinPanel() {
      const el = document.getElementById('matchRejoinPanel');
      if (el) el.classList.remove('show');
    }
    function showRejoinLoading(msg) {
      window._rejoinLoading = true;
      window._rejoinInputLock = true;
      placingLock = true;
      try { cancelActivePieceDrag(); } catch (_) {}
      try { document.body.classList.add('rejoin-loading'); } catch (_) {}
      const el = document.getElementById('rejoinLoading');
      if (el) {
        const sub = document.getElementById('rejoinLoadingSub');
        if (sub) sub.textContent = msg || 'Синхронизация поля и фигур';
        el.classList.add('show');
      }
    }
    function hideRejoinLoading() {
      window._rejoinLoading = false;
      try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
      const el = document.getElementById('rejoinLoading');
      if (el) el.classList.remove('show');
    }
    function finishRejoinLoading() {
      // Brief lock + overlay, then unlock for play
      showRejoinLoading('Синхронизация завершена…');
      if (window._rejoinUnlockTimer) {
        try { clearTimeout(window._rejoinUnlockTimer); } catch (_) {}
      }
      const unlockNow = () => {
        try {
          cancelActivePieceDrag();
          hideRejoinLoading();
          window._rejoinLoading = false;
          window._rejoinInputLock = false;
          window._mpRejoiningMatch = false;
          placingLock = false;
          try { ensureMatchClockRunning(); } catch (_) {}
          try { ensurePlayableIfLive(); } catch (_) {}
        } catch (_) {
          hideRejoinLoading();
          window._rejoinLoading = false;
          window._rejoinInputLock = false;
          window._mpRejoiningMatch = false;
          placingLock = false;
        }
        window._rejoinUnlockTimer = null;
      };
      window._rejoinUnlockTimer = setTimeout(() => {
        showRejoinLoading('Можно играть…');
        window._rejoinUnlockTimer = setTimeout(unlockNow, 400);
      }, 350);
      // Hard safety: never leave locks on longer than 2.5s
      setTimeout(() => {
        if (window._rejoinLoading || window._rejoinInputLock || placingLock) {
          unlockNow();
        }
      }, 2500);
    }

    // Capture-phase: swallow tray/board input while rejoin lock is on
    (function rejoinInputCaptureBlock() {
      const block = (e) => {
        if (!window._rejoinLoading && !window._rejoinInputLock) return;
        try {
          const t = e.target;
          if (t && t.closest && (t.closest('#screenVersus .pieces-area') || t.closest('#screenVersus .board-wrap') || t.closest('#screenVersus .piece-slot'))) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          }
        } catch (_) {}
      };
      ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => {
        document.addEventListener(ev, block, true);
      });
    })();

    /**
     * One player rejoins while the other is still offline.
     * Match UI + wall-clock timer run; peer keeps listening / retrying dial.
     */
    /** While rejoin panel is open, stay reachable so opponent «Сдаться» arrives as quiet win. */
    async function startRejoinPanelListen(snap) {
      if (!snap || window._matchEnded || vsActive) return;
      if (window._rejoinPanelListening) return;
      const role = snap.role || 'guest';
      window._rejoinPanelListening = true;
      try {
        let peer = mpPeer;
        if (!peer || peer.destroyed) {
          if (role === 'host' && snap.room) {
            peer = await openGamePeer(roomPeerId(snap.room), { attempts: 2, timeoutMs: 8000 });
          } else {
            peer = await openGamePeer(undefined, { attempts: 2, timeoutMs: 8000 });
          }
          mpPeer = peer;
        }
        mpMode = true;
        mpRole = role;
        mpRoomCode = snap.room || null;
        mpRemotePeerId = snap.remotePeer || null;

        const wire = (conn) => {
          try {
            const onOpen = () => {
              try {
                mpConn = conn;
                conn._bpWired = true;
                conn.on('data', (data) => {
                  try { onMpMessage(data); } catch (_) {}
                });
              } catch (_) {}
            };
            if (conn.open) onOpen();
            else conn.on('open', onOpen);
          } catch (_) {}
        };
        peer.on('connection', wire);

        // Guest (and host with remote id): dial so we can receive forfeit packets
        const dialTarget = (role === 'guest' && snap.room)
          ? roomPeerId(snap.room)
          : (snap.remotePeer || null);
        if (dialTarget) {
          if (window._rejoinPanelDialIv) {
            try { clearInterval(window._rejoinPanelDialIv); } catch (_) {}
          }
          const dial = () => {
            try {
              if (window._matchEnded || vsActive || !window._rejoinPanelListening) {
                clearInterval(window._rejoinPanelDialIv);
                window._rejoinPanelDialIv = null;
                return;
              }
              if (!mpPeer || mpPeer.destroyed) return;
              if (mpConn && mpConn.open) return;
              const c = mpPeer.connect(dialTarget, { reliable: true });
              if (c) wire(c);
            } catch (_) {}
          };
          dial();
          window._rejoinPanelDialIv = setInterval(dial, 4000);
        }
      } catch (e) {
        console.warn('rejoin panel listen', e);
        window._rejoinPanelListening = false;
      }
    }

    async function enterSoloRejoinWait(snap, existingPeer) {

      if (!snap || window._matchEnded) throw new Error('no-snap');
      const remainSec = remainingMatchSecFromSnap(snap);
      if (remainSec <= 0) {
        try { resolveBothAwayFromSnap(snap, true); } catch (_) {}
        return;
      }
      let deadline = reconnectDeadlineTs(snap);
      if (Date.now() > deadline + 3000) {
        try { resolveBothAwayFromSnap(snap, true); } catch (_) {}
        return;
      }

      mpMode = true;
      mode = 'versus';
      vsModeType = 'online';
      vsActive = true;
      window._matchEnded = false;
      // Networking may still be reconciling, but the local player must be able to play
      window._mpRejoiningMatch = false;
      window._soloRejoinActive = true;
      window._rejoinLoading = false;
      window._rejoinInputLock = false;
      placingLock = false;
      try { hideRejoinLoading(); } catch (_) {}

      try { restoreSnapState(snap); } catch (_) {}
      try {
        if (typeof snap.clockEndTs === 'number') window._matchClockEndTs = snap.clockEndTs;
        vsTimeLeft = remainingMatchSecFromSnap(snap);
      } catch (_) {}

      showScreen('versus');
      try { closeRoomLobby(); } catch (_) {}
      document.body.classList.remove('replay-ui');
      try {
        document.getElementById('versusResult').classList.remove('visible');
        document.getElementById('myScore').textContent = String(score);
        document.getElementById('oppScore').textContent = String(oppScore);
      } catch (_) {}
      try {
        if (typeof boardMe !== 'undefined' && boardMe) {
          if (!boardMe.children || boardMe.children.length !== SIZE * SIZE) createBoardDOM(boardMe);
          renderGrid(grid, boardMe);
        }
        if (typeof boardOpp !== 'undefined' && boardOpp) {
          if (!boardOpp.children || boardOpp.children.length !== SIZE * SIZE) createBoardDOM(boardOpp);
          renderGrid(oppGrid, boardOpp);
        }
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof renderPieces === 'function') renderPieces(area);
        if (typeof renderOppPieces === 'function') renderOppPieces();
        try { applyMatchCosmetics(); } catch (_) {
          try { applyEquippedBoard(); applyEquippedSkin(); } catch (_2) {}
          try {
            if (window.mpOppBoardId) applyOppBoard(window.mpOppBoardId);
            if (window.mpOppSkinId) applyOppSkin(window.mpOppSkinId);
          } catch (_2) {}
        }
        try { applyBoardScales(); } catch (_) {}
        setTimeout(() => {
          try { applyMatchCosmetics(); } catch (_) {}
        }, 180);
      } catch (_) {}

      startMatchWallClock(window._matchClockEndTs || getSnapClockEndTs(snap));
      // Solo wait: opponent is offline — do NOT run AFK (would fire false 15s loss/win)
      try { if (typeof stopAfkWatch === 'function') stopAfkWatch(); } catch (_) {}

      // Player is back in the match; opponent still away
      myDcAt = 0;
      bothAwayMode = false;
      oppDisconnected = true;
      window._soloRejoinActive = true;
      // Drop stale PeerJS links from a previous session — open flag would freeze the countdown
      try {
        if (mpConn && (!mpConn.open || mpConn.peer !== (mpRemotePeerId || mpConn.peer))) {
          try { mpConn.close(); } catch (_c) {}
          mpConn = null;
        }
      } catch (_) { try { mpConn = null; } catch (_2) {} }
      // Keep real opp leave time if known — never stamp "now" (that inverted win/loss)
      if (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) {
        oppDcAt = snap.oppLeftAt;
      } else if (typeof snap.leftAt === 'number' && snap.leftAt > 0) {
        // Both left: treat opponent leave as the shared leave stamp
        oppDcAt = snap.leftAt;
      }
      // Prefer stored absolute deadline so countdown continues from where it should
      if (typeof snap.oppDcDeadline === 'number' && snap.oppDcDeadline > Date.now()) {
        // use the later of snap deadline vs computed (never extend past match clock already handled)
      }
      // I returned alone → if opp never comes back, I win (not dual-away score loss)
      window._soloRejoinActive = true;
      // Absolute wall deadline — must not be rewritten on each persist tick
      let effectiveDeadline = deadline;
      try {
        if (typeof snap.oppDcDeadline === 'number' && snap.oppDcDeadline > 0) {
          // Use the earliest positive deadline so we never give extra free time
          effectiveDeadline = Math.min(deadline, snap.oppDcDeadline);
          if (effectiveDeadline < Date.now() + 500) effectiveDeadline = deadline;
        }
      } catch (_) {}
      const waitLeft = Math.max(1, Math.ceil((effectiveDeadline - Date.now()) / 1000));
      dcDeadlineTs = effectiveDeadline;
      deadline = effectiveDeadline; // keep local binding in sync for timers below
      try { showBoardDisconnectOverlay(waitLeft); } catch (_) {}
      try { showDisconnectBanner(waitLeft, 'dc'); } catch (_) {}
      try { hideRejoinLoading(); } catch (_) {}
      setMpStatus('Ожидание соперника…');
      try {
        showInfoToast('Связь', 'Вы в матче. Ожидание соперника…', 'ok');
      } catch (_) {}

      // Peer: host listens; guest retries dial in background
      let peer = existingPeer;
      try {
        if (!peer || peer.destroyed) {
          if (mpRole === 'host') {
            const hostId = mpRoomCode ? roomPeerId(mpRoomCode) : (snap.selfPeerId || null);
            peer = await openGamePeer(hostId || undefined, { attempts: 3, timeoutMs: 10000 });
          } else {
            peer = await openGamePeer(undefined, { attempts: 3, timeoutMs: 10000 });
          }
        }
        mpPeer = peer;
        try { ensureLiveMatchAccept(); } catch (_) {}
        if (mpRole === 'host') {
          try {
            peer.on('connection', (c) => {
              try {
                if (mpMode && (vsActive || window._mpRejoiningMatch) && !window._matchEnded) {
                  acceptLiveMatchReconnect(c);
                }
              } catch (_) {}
            });
          } catch (_) {}
        }
      } catch (pe) {
        console.warn('solo peer', pe);
      }

      // Background dial + deadline watch
      if (window._soloDialIv) { try { clearInterval(window._soloDialIv); } catch (_) {} }
      if (window._soloDeadlineTimer) { try { clearTimeout(window._soloDeadlineTimer); } catch (_) {} }

      const tryDialOpp = () => {
        try {
          if (!vsActive || window._matchEnded || (mpConn && mpConn.open)) return;
          if (!mpPeer || mpPeer.destroyed) return;
          const target = (mpRole === 'guest')
            ? (mpRoomCode ? roomPeerId(mpRoomCode) : mpRemotePeerId)
            : mpRemotePeerId;
          if (!target) return;
          const c = mpPeer.connect(target, { reliable: true });
          if (!c) return;
          c.on('open', () => {
            try {
              mpConn = c;
              mpOppConnected = true;
              noteMpRemotePeer(c);
              c._bpWired = true;
              c.on('data', (data) => {
                try { mpOppConnected = true; } catch (_) {}
                try { onMpMessage(data); } catch (_) {}
              });
              c.on('close', () => {
                mpOppConnected = false;
                if (vsActive && mpMode) handleOpponentDisconnect();
              });
              try { wireMpConnResume(c); } catch (_) {}
              // Request state sync
              try {
                mpSend({
                  type: 'match_rejoin',
                  name: myNickname,
                  score: score,
                  oppScore: oppScore,
                  vsTimeLeft: vsTimeLeft,
                  boardId: equippedBoardId,
                  skinId: equippedSkinId
                });
              } catch (_) {}
              try { clearDisconnectTimer(); } catch (_) {}
              try { hideBoardDisconnectOverlay(); } catch (_) {}
              try { hideDisconnectBanner(); } catch (_) {}
              try {
                if (window._soloOverlayIv) { clearInterval(window._soloOverlayIv); window._soloOverlayIv = null; }
              } catch (_) {}
              try {
                if (window._soloDeadlineTimer) { clearTimeout(window._soloDeadlineTimer); window._soloDeadlineTimer = null; }
              } catch (_) {}
              window._mpRejoiningMatch = false;
              window._soloRejoinActive = false;
              oppDisconnected = false;
              try { lastOppActionTs = Date.now(); lastMyActionTs = Date.now(); } catch (_) {}
              try { if (typeof startAfkWatch === 'function') startAfkWatch(); } catch (_) {}
              setMpStatus('Связь восстановлена');
              try { showInfoToast('Связь', 'Соперник подключился', 'ok'); } catch (_) {}
              if (window._soloDialIv) { clearInterval(window._soloDialIv); window._soloDialIv = null; }
            } catch (_) {}
          });
        } catch (_) {}
      };
      tryDialOpp();
      window._soloDialIv = setInterval(tryDialOpp, 3000);

      // When reconnect window ends and opp still gone — dual-away / disconnect rules
      const msLeft = Math.max(500, deadline - Date.now());
      window._soloDeadlineTimer = setTimeout(() => {
        window._soloDeadlineTimer = null;
        if (window._soloDialIv) { try { clearInterval(window._soloDialIv); } catch (_) {} window._soloDialIv = null; }
        if (!vsActive || window._matchEnded) return;
        if (mpConn && mpConn.open) return;
        // Opponent never returned — player who came back wins
        try {
          window._soloRejoinActive = false;
          endVersus({ forceWin: true, reason: 'disconnect', silent: true });
        } catch (_) {
          try { resolveDisconnectWin(); } catch (_2) {}
        }
      }, msLeft);

      // Overlay + banner countdown while waiting (must keep ticking every tick)
      if (window._soloOverlayIv) { try { clearInterval(window._soloOverlayIv); } catch (_) {} }
      window._soloOverlayIv = setInterval(() => {
        // Stop only when match ended, solo wait finished, or opponent truly online again
        if (!vsActive || window._matchEnded || !window._soloRejoinActive || !oppDisconnected) {
          try { clearInterval(window._soloOverlayIv); } catch (_) {}
          window._soloOverlayIv = null;
          return;
        }
        // Do NOT stop merely because mpConn.open — brief/false opens froze the countdown
        const endTs = (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) ? dcDeadlineTs : deadline;
        const left = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
        try { showBoardDisconnectOverlay(left); } catch (_) {}
        try { showDisconnectBanner(left, 'dc'); } catch (_) {}
        if (left <= 0) {
          try { clearInterval(window._soloOverlayIv); } catch (_) {}
          window._soloOverlayIv = null;
        }
      }, 250);

      try { persistLiveMatch(); } catch (_) {}
      window._mpRejoiningMatch = false; // allow play while waiting for opp
      window._rejoinInputLock = false;
      window._rejoinLoading = false;
      placingLock = false;
      try { hideRejoinLoading(); } catch (_) {}
      // Force disconnect UI (opponent still offline)
      try {
        oppDisconnected = true;
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        showBoardDisconnectOverlay(left);
        showDisconnectBanner(left, 'dc');
      } catch (_) {}
      // Restore trays and force interactive slots
      try {
        recoverHandsFromMatchLog && recoverHandsFromMatchLog();
      } catch (_) {}
      try {
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof renderPieces === 'function') renderPieces(area);
        if (typeof renderOppPieces === 'function') renderOppPieces();
        document.querySelectorAll('#piecesAreaVs .piece-slot:not(.used)').forEach(s => {
          s.classList.add('show');
          s.style.opacity = '1';
          s.style.transform = 'none';
          s.style.pointerEvents = '';
        });
      } catch (_) {}
      // Reset action timestamps so AFK does not instantly fire if later re-enabled
      try { lastMyActionTs = Date.now(); lastOppActionTs = Date.now(); } catch (_) {}
    }

    async function attemptMatchRejoin() {

      const snap = readLiveMatch();
      if (!snap) {
        hideMatchRejoinPanel();
        return;
      }
      const btn = document.getElementById('btnMatchRejoin');
      if (btn) { btn.disabled = true; btn.textContent = '…'; }
      window._mpRejoiningMatch = true;
      window._rejoinStateApplied = false;
      placingLock = true;
      try {
        try { closeRoomLobby(); } catch (_) {}
        hideMatchRejoinPanel();
        showRejoinLoading('Подключение к сопернику…');
        setMpStatus('Переподключение к матчу…');
        mpMode = true;
        mpRole = snap.role || 'guest';
        mpRoomCode = snap.room || null;
        mpFromMatchmaking = !!snap.fromMM;
        mpRemotePeerId = snap.remotePeer || null;
        mpOppName = snap.oppName || 'Соперник';
        oppName = mpOppName;
        vsDuration = snap.vsDuration || 120;
        // Wall-clock remaining: time kept running while both were offline
        try {
          if (typeof snap.clockEndTs === 'number' && snap.clockEndTs > 0) {
            window._matchClockEndTs = snap.clockEndTs;
          } else {
            const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
            const leftSec = typeof snap.vsTimeLeft === 'number' ? snap.vsTimeLeft : vsDuration;
            window._matchClockEndTs = leftAt + leftSec * 1000;
          }
          vsTimeLeft = Math.max(0, Math.ceil((window._matchClockEndTs - Date.now()) / 1000));
        } catch (_) {
          vsTimeLeft = typeof snap.vsTimeLeft === 'number' ? snap.vsTimeLeft : vsDuration;
        }
        score = typeof snap.score === 'number' ? snap.score : 0;
        oppScore = typeof snap.oppScore === 'number' ? snap.oppScore : 0;
        mode = 'versus';
        vsModeType = 'online';

        try { restoreSnapState(snap); } catch (_) {}
        // restoreSnapState may overwrite vsTimeLeft from snap — re-apply wall clock
        try {
          if (window._matchClockEndTs) {
            vsTimeLeft = Math.max(0, Math.ceil((window._matchClockEndTs - Date.now()) / 1000));
          }
        } catch (_) {}
        if (!grid || !grid.length) {
          try { grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); } catch (_) {}
        }
        if (!oppGrid || !oppGrid.length) {
          try { oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); } catch (_) {}
        }
        if (!Array.isArray(pieces)) pieces = [];
        if (!Array.isArray(oppPieces)) oppPieces = [];

        // Restore versus UI before connecting
        showRejoinLoading('Загрузка поля…');
        showScreen('versus');
        try { closeRoomLobby(); } catch (_) {}
        document.body.classList.remove('replay-ui');
        const fb = document.getElementById('btnForfeit');
        if (fb) fb.style.display = '';
        try {
          document.getElementById('versusResult').classList.remove('visible');
        } catch (_) {}
        try {
          document.getElementById('myScore').textContent = String(score);
          document.getElementById('oppScore').textContent = String(oppScore);
        } catch (_) {}
        try {
          if (typeof boardMe !== 'undefined' && boardMe) createBoardDOM(boardMe);
          if (typeof boardOpp !== 'undefined' && boardOpp) createBoardDOM(boardOpp);
          applyEquippedBoard();
          if (snap.oppBoardId && typeof applyOppBoard === 'function') applyOppBoard(snap.oppBoardId);
          renderGrid(grid || Array.from({length: SIZE}, () => Array(SIZE).fill(null)), boardMe);
          renderGrid(oppGrid || Array.from({length: SIZE}, () => Array(SIZE).fill(null)), boardOpp);
          const area0 = document.getElementById('piecesAreaVs');
          if (area0 && typeof renderPieces === 'function') renderPieces(area0);
          if (typeof renderOppPieces === 'function') renderOppPieces();
          try { applyBoardScales(); } catch (_) {}
        } catch (_) {}

        // Mark match live BEFORE peer handshake so mutual rejoin
        // (both left) does not reply stillLive:false to each other
        vsActive = true;
        window._matchEnded = false;
        mpMode = true;
        mode = 'versus';
        vsModeType = 'online';

        // Match clock already expired while away → finish by score, no peer needed
        if (vsTimeLeft <= 0) {
          try { hideRejoinLoading(); } catch (_) {}
          try { resolveBothAwayFromSnap(snap, true); } catch (_) {
            try { endVersus({ reason: 'disconnect', silent: true }); } catch (_2) {}
          }
          return;
        }

        showRejoinLoading('Установка связи…');
        // Remaining reconnect window (both players keep full window even if both left)
        const leftAt0 = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
        const reconnectMs0 = (typeof reconnectWindowMs === 'function')
          ? reconnectWindowMs(snap)
          : Math.min(60000, Math.max(0, (snap.vsTimeLeft || 120) * 1000));
        const windowEnd0 = leftAt0 + reconnectMs0;
        const remainWindowMs = Math.max(4000, windowEnd0 - Date.now());

        let peer;
        // Host must reclaim the same PeerJS id so the opponent can find us again
        if (mpRole === 'host') {
          const hostId = mpRoomCode
            ? roomPeerId(mpRoomCode)
            : (snap.selfPeerId || null);
          peer = await openGamePeer(hostId || undefined, { attempts: 4, timeoutMs: 12000 });
        } else {
          peer = await openGamePeer(undefined, { attempts: 4, timeoutMs: 12000 });
        }
        mpPeer = peer;

        // Wait briefly for peer; if alone, enter solo wait quickly (independent rejoin)
        // When BOTH left, guest's old peer id is dead — host must accept inbound.
        const waitMs = Math.min(remainWindowMs, 5000);
        const conn = await new Promise((resolve, reject) => {
          let settled = false;
          let dialIv = null;
          const done = (c, err) => {
            if (settled) return;
            settled = true;
            try { clearTimeout(timer); } catch (_) {}
            try { if (dialIv) clearInterval(dialIv); } catch (_) {}
            if (c) resolve(c);
            else reject(err || new Error('timeout'));
          };
          const timer = setTimeout(() => done(null, new Error('timeout')), waitMs);

          const wireAndDone = (c) => {
            if (!c || settled) return;
            const finish = () => {
              if (settled) return;
              try {
                c._bpWired = true;
                c.on('data', (data) => {
                  try { mpOppConnected = true; } catch (_) {}
                  try { onMpMessage(data); } catch (_) {}
                });
                c.on('close', () => {
                  mpOppConnected = false;
                  if (vsActive && mpMode) handleOpponentDisconnect();
                });
                try { wireMpConnResume(c); } catch (_) {}
              } catch (_) {}
              done(c);
            };
            if (c.open) finish();
            else {
              c.on('open', finish);
              c.on('error', () => {});
            }
          };

          // Host: accept inbound (guest dials stable room id after both left)
          if (mpRole === 'host') {
            try {
              peer.on('connection', (c) => {
                try { handleHostIncomingConn(c); } catch (_) {}
                wireAndDone(c);
              });
            } catch (_) {}
          }

          // Outbound dial: guest → host room id; host only dials last known guest id
          // (never dial own room id — when both left, host relies on inbound)
          const target = (mpRole === 'guest')
            ? (mpRoomCode ? roomPeerId(mpRoomCode) : (mpRemotePeerId || null))
            : (mpRemotePeerId || null);

          if (!target && mpRole !== 'host') {
            done(null, new Error('no-peer'));
            return;
          }

          const tryDial = () => {
            if (settled || !target) return;
            try {
              if (!peer || peer.destroyed) return;
              const c = peer.connect(target, { reliable: true });
              if (!c) return;
              c.on('open', () => wireAndDone(c));
              c.on('error', () => {});
            } catch (_) {}
          };
          tryDial();
          // Retry dial while waiting — opponent may come online mid-window
          dialIv = setInterval(tryDial, 2500);
        });

        mpConn = conn;
        mpOppConnected = true;
        try { noteMpRemotePeer(conn); } catch (_) {}

        showRejoinLoading('Синхронизация матча…');
        // Must get explicit stillLive:true from opponent — never invent a live match
        const syncWait = Math.min(6000, Math.max(3500, Math.min(remainWindowMs, 8000)));
        const livePayload = await new Promise((resolve) => {
          const t = setTimeout(() => resolve({ stillLive: false, _timeout: true }), syncWait);
          window._rejoinAwait = (payload) => {
            clearTimeout(t);
            resolve(payload || { stillLive: false });
          };
          const sendJoin = () => {
            try {
              mpSend({
                type: 'match_rejoin',
                name: myNickname,
                score: score,
                oppScore: oppScore,
                vsTimeLeft: vsTimeLeft,
                boardId: equippedBoardId,
                skinId: equippedSkinId
              });
            } catch (_) {}
          };
          sendJoin();
          setTimeout(sendJoin, 250);
          setTimeout(sendJoin, 700);
          setTimeout(sendJoin, 1600);
        });

        if (!livePayload || livePayload.stillLive !== true) {
          const ended = livePayload && livePayload.stillLive === false && !livePayload._timeout;
          if (ended) {
            // Peer explicitly said match is over — but if our snapshot is still valid,
            // prefer finishing via local rules rather than silent discard
            vsActive = false;
            try { killAllMatchTimers(); } catch (_) {}
            try { if (mpConn) mpConn.close(); } catch (_) {}
            try { destroyMp(); } catch (_) {}
            try { hideRejoinLoading(); } catch (_) {}
            placingLock = false;
            try {
              if (snap && remainingMatchSecFromSnap(snap) > 0 && Date.now() < reconnectDeadlineTs(snap) + 2000) {
                // Opponent may have resolved early; enter solo so we can still play out / win by disconnect
                await enterSoloRejoinWait(snap, null);
                return;
              }
            } catch (_) {}
            try {
              if (snap) resolveBothAwayFromSnap(snap, true);
              else {
                clearLiveMatch();
                hideMatchRejoinPanel();
                showScreen('menu');
                updateMenuStats();
                showInfoToast('Матч', 'Матч завершён', 'bad');
              }
            } catch (_) {
              clearLiveMatch();
              hideMatchRejoinPanel();
            }
            return;
          }
          // Opponent offline — enter solo wait: match stays live, clock runs, peer listens
          try {
            await enterSoloRejoinWait(snap, peer);
          } catch (soloErr) {
            console.warn('solo rejoin wait', soloErr);
            vsActive = false;
            try { hideRejoinLoading(); } catch (_) {}
            try { destroyMp(); } catch (_) {}
            try { persistLiveMatch({ forceLeave: true }); } catch (_) {}
            try { showScreen('menu'); updateMenuStats(); } catch (_) {}
            try { showMatchRejoinPanel(snap); } catch (_) {}
          }
          return;
        }

        vsActive = true;
        const peerAlreadySynced = !!window._rejoinStateApplied;
        if (!window._rejoinStateApplied) window._rejoinStateApplied = true;
        // Brief lock so a second match_rejoin_ok cannot wipe a piece mid-grab
        placingLock = true;
        try {
          if (typeof boardMe !== 'undefined' && boardMe) {
            if (!boardMe.children || boardMe.children.length !== SIZE * SIZE) createBoardDOM(boardMe);
            renderGrid(grid, boardMe);
          }
          if (typeof boardOpp !== 'undefined' && boardOpp) {
            if (!boardOpp.children || boardOpp.children.length !== SIZE * SIZE) createBoardDOM(boardOpp);
            renderGrid(oppGrid, boardOpp);
          }
          // If match_rejoin_ok already painted trays, skip — prevents 2nd/3rd refresh that drops a piece
          if (!peerAlreadySynced) {
            const area = document.getElementById('piecesAreaVs');
            if (area && typeof renderPieces === 'function') renderPieces(area);
            if (typeof renderOppPieces === 'function') renderOppPieces();
          } else {
            // Ensure trays exist if peer packet had empty hands and local recover filled them
            const area = document.getElementById('piecesAreaVs');
            if (area && (!area.querySelector('.piece-slot')) && pieces && pieces.length && typeof renderPieces === 'function') {
              renderPieces(area);
            }
            const oppArea = document.getElementById('piecesAreaOpp');
            if (oppArea && (!oppArea.querySelector('.piece-slot')) && oppPieces && oppPieces.length && typeof renderOppPieces === 'function') {
              renderOppPieces();
            }
          }
          try { applyMatchCosmetics(); } catch (_) {
            try { applyEquippedBoard(); applyEquippedSkin(); } catch (_2) {}
            try {
              if (window.mpOppBoardId) applyOppBoard(window.mpOppBoardId);
              if (window.mpOppSkinId) applyOppSkin(window.mpOppSkinId);
            } catch (_2) {}
          }
          try { applyBoardScales(); } catch (_) {}
          document.getElementById('myScore').textContent = String(score);
          document.getElementById('oppScore').textContent = String(oppScore);
        } catch (e) { console.warn('rejoin paint', e); }
        try { if (typeof startAfkWatch === 'function') startAfkWatch(); } catch (_) {}
        try {
          const endTs = (snap && typeof snap.clockEndTs === 'number')
            ? snap.clockEndTs
            : (window._matchClockEndTs || (Date.now() + (vsTimeLeft || 0) * 1000));
          startMatchWallClock(endTs);
        } catch (_) {}

        hideMatchRejoinPanel();
        try { closeRoomLobby(); } catch (_) {}
        try { ensureLiveMatchAccept(); } catch (_) {}
        persistLiveMatch();
        setMpStatus('Связь восстановлена');
        finishRejoinLoading();
        // Second-pass cosmetics only — do NOT re-render trays (causes triple flicker + lost piece)
        setTimeout(() => {
          try { applyMatchCosmetics(); } catch (_) {}
        }, 180);
      } catch (e) {
        console.warn('rejoin failed', e);
        // One player can resume alone while the other is still offline
        let soloOk = false;
        try {
          if (snap && !window._matchEnded && remainingMatchSecFromSnap(snap) > 0) {
            const deadline = reconnectDeadlineTs(snap);
            if (Date.now() < deadline + 2000) {
              soloOk = true;
              await enterSoloRejoinWait(snap, mpPeer || null);
            }
          }
        } catch (soloErr) {
          console.warn('solo rejoin from catch', soloErr);
          soloOk = false;
        }
        if (!soloOk) {
          vsActive = false;
          placingLock = false;
          try { hideRejoinLoading(); } catch (_) {}
          try { if (mpConn) mpConn.close(); } catch (_) {}
          try { destroyMp(); } catch (_) {}
          try { persistLiveMatch({ forceLeave: true }); } catch (_) {}
          try { showScreen('menu'); updateMenuStats(); } catch (_) {}
          try { showMatchRejoinPanel(snap); } catch (_) {}
          setMpStatus('Ожидание соперника…');
          try {
            const la = (snap && typeof snap.leftAt === 'number') ? snap.leftAt : (snap && snap.t);
            const rm = (typeof reconnectWindowMs === 'function' && snap) ? reconnectWindowMs(snap) : 60000;
            const leftSec = Math.max(1, Math.ceil((la + rm - Date.now()) / 1000));
            showInfoToast('Связь', 'Соперник не в сети. Окно переподключения: ещё ' + leftSec + ' сек.', 'bad');
          } catch (_) {
            try { showInfoToast('Связь', 'Не удалось переподключиться. Попробуй ещё раз.', 'bad'); } catch (_2) {}
          }
        }
      } finally {
        window._rejoinAwait = null;
        if (btn) { btn.disabled = false; btn.textContent = 'Переподключиться'; }
        try { closeRoomLobby(); } catch (_) {}
        // Success path: finishRejoinLoading clears flags after insurance delay
        // Failure path: unlock immediately
        if (!vsActive) {
          window._mpRejoiningMatch = false;
          window._rejoinInputLock = false;
          placingLock = false;
          try { hideRejoinLoading(); } catch (_) {}
        }
      }
    }

        function killAllMatchTimers() {
      try { stopAfkWatch(); } catch (_) {}
      try { clearDisconnectTimer(); } catch (_) {}
      try { hideBoardDisconnectOverlay(); } catch (_) {}
      try { hideDisconnectBanner(); } catch (_) {}
      try { hideMatchRejoinPanel(); } catch (_) {}
      if (typeof vsTimerId !== 'undefined' && vsTimerId) {
        try { clearInterval(vsTimerId); } catch (_) {}
        vsTimerId = null;
      }
      if (typeof aiInterval !== 'undefined' && aiInterval) {
        try { clearInterval(aiInterval); } catch (_) {}
        aiInterval = null;
      }
      if (typeof mpDisconnectTimer !== 'undefined' && mpDisconnectTimer) {
        try { clearInterval(mpDisconnectTimer); } catch (_) {}
        mpDisconnectTimer = null;
      }
      try { oppDisconnected = false; } catch (_) {}
      try { dcDeadlineTs = 0; } catch (_) {}
    }

    function restoreSnapState(snap) {
      if (!snap) return;
      if (typeof snap.score === 'number') score = snap.score;
      if (typeof snap.oppScore === 'number') oppScore = snap.oppScore;
      if (typeof snap.vsTimeLeft === 'number') vsTimeLeft = snap.vsTimeLeft;
      if (snap.vsDuration) vsDuration = snap.vsDuration;
      if (snap.oppName) { oppName = snap.oppName; mpOppName = snap.oppName; }
      if (snap.role) mpRole = snap.role;
      if (snap.room) mpRoomCode = snap.room;
      if (snap.remotePeer) mpRemotePeerId = snap.remotePeer;
      mpFromMatchmaking = !!snap.fromMM;
      // Cosmetics from snapshot — critical for rejoin so opp skins/boards reappear
      try {
        if (typeof snap.oppSkinId === 'string' && snap.oppSkinId) {
          window.mpOppSkinId = snap.oppSkinId;
        }
        if (typeof snap.oppBoardId === 'string' && snap.oppBoardId) {
          window.mpOppBoardId = snap.oppBoardId;
        }
        // Prefer current equipped, but fall back to match-time skin if local state was wiped
        if ((!equippedSkinId || equippedSkinId === 'default') && typeof snap.mySkinId === 'string' && snap.mySkinId) {
          equippedSkinId = snap.mySkinId;
        }
        if ((!equippedBoardId || equippedBoardId === 'field_default') && typeof snap.myBoardId === 'string' && snap.myBoardId) {
          equippedBoardId = snap.myBoardId;
        }
      } catch (_) {}
      if (Array.isArray(snap.grid)) {
        grid = snap.grid.map(row => Array.isArray(row) ? row.slice() : row);
      }
      if (Array.isArray(snap.oppGrid)) {
        oppGrid = snap.oppGrid.map(row => Array.isArray(row) ? row.slice() : row);
      }
      if (Array.isArray(snap.pieces)) {
        pieces = snap.pieces.map(p => ({
          shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
          color: p.color,
          used: !!p.used
        }));
      }
      if (Array.isArray(snap.oppPieces)) {
        oppPieces = snap.oppPieces.map(p => ({
          shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
          color: p.color,
          used: !!p.used
        }));
      }
      if (Array.isArray(snap.moves)) {
        try { matchLog = snap.moves.slice(); } catch (_) { matchLog = snap.moves; }
      }
      if (typeof snap.matchStartTs === 'number') {
        try { matchStartTs = snap.matchStartTs; } catch (_) {}
      }
      try { recoverHandsFromMatchLog(); } catch (_) {}
    }
    /** Apply my + opponent cosmetics after restore / rejoin paint. Safe no-op if IDs missing. */
    function applyMatchCosmetics() {
      try { applyEquippedBoard(); } catch (_) {}
      try { applyEquippedSkin(); } catch (_) {}
      try {
        if (window.mpOppBoardId && typeof applyOppBoard === 'function') {
          applyOppBoard(window.mpOppBoardId);
        }
      } catch (_) {}
      try {
        if (window.mpOppSkinId && typeof applyOppSkin === 'function') {
          applyOppSkin(window.mpOppSkinId);
        }
      } catch (_) {}
    }
    function countUnusedHand(arr) {
      if (!Array.isArray(arr) || !arr.length) return 0;
      let n = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && !arr[i].used) n++;
      }
      return n;
    }
    /** Clone hand from network/snap payload. */
    function cloneHandPayload(arr) {
      if (!Array.isArray(arr)) return null;
      return arr.map(p => ({
        shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p && p.color,
        used: !!(p && p.used)
      }));
    }
    /**
     * Prefer the richer hand during rejoin so a partial peer snapshot cannot erase
     * a local piece the opponent still sees (or vice versa).
     * Keep local if it has more unused pieces, or remote is empty while local is not.
     */
    function preferHand(localArr, remoteArr) {
      const remote = cloneHandPayload(remoteArr);
      if (!remote || !remote.length) {
        return Array.isArray(localArr) && localArr.length ? localArr : (remote || localArr || []);
      }
      if (!Array.isArray(localArr) || !localArr.length) return remote;
      const lu = countUnusedHand(localArr);
      const ru = countUnusedHand(remote);
      // Remote strictly richer → take remote; otherwise keep local (avoids flicker + lost piece)
      if (ru > lu) return remote;
      return localArr;
    }
    function recoverHandsFromMatchLog() {
      const log = (typeof matchLog !== 'undefined' && Array.isArray(matchLog)) ? matchLog : null;
      if (!log || !log.length) return;
      const needMe = !Array.isArray(pieces) || !pieces.length;
      const needOpp = !Array.isArray(oppPieces) || !oppPieces.length;
      // Even if hands exist, we may need to mark used flags from places after last deal
      let lastMeIdx = -1, lastOppIdx = -1;
      for (let i = log.length - 1; i >= 0; i--) {
        const ev = log[i];
        if (!ev || (ev.type !== 'deal' && ev.type !== 'Deal')) continue;
        if (ev.side === 'opp') {
          if (lastOppIdx < 0 && Array.isArray(ev.pieces) && ev.pieces.length) lastOppIdx = i;
        } else {
          if (lastMeIdx < 0 && Array.isArray(ev.pieces) && ev.pieces.length) lastMeIdx = i;
        }
        if (lastMeIdx >= 0 && lastOppIdx >= 0) break;
      }
      const mapDeal = (ev) => (ev.pieces || []).map(p => ({
        shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
        color: (p && p.color) ? p.color : '#7c5cff',
        used: !!(p && p.used)
      }));
      if (needMe && lastMeIdx >= 0) pieces = mapDeal(log[lastMeIdx]);
      if (needOpp && lastOppIdx >= 0) oppPieces = mapDeal(log[lastOppIdx]);
      // Mark pieces used according to place events after the last deal for each side
      const markUsedAfterDeal = (side, dealIdx, hand) => {
        if (!Array.isArray(hand) || !hand.length || dealIdx < 0) return;
        for (let i = dealIdx + 1; i < log.length; i++) {
          const ev = log[i];
          if (!ev) continue;
          if ((ev.type === 'deal' || ev.type === 'Deal') && (ev.side === side || (side !== 'opp' && ev.side !== 'opp'))) break;
          if (ev.type !== 'place' && !ev.shape) continue;
          const evSide = ev.side === 'opp' ? 'opp' : 'me';
          if (evSide !== side) continue;
          let marked = false;
          if (typeof ev.pieceIdx === 'number' && ev.pieceIdx >= 0 && hand[ev.pieceIdx] && !hand[ev.pieceIdx].used) {
            hand[ev.pieceIdx].used = true;
            marked = true;
          }
          if (!marked && Array.isArray(ev.shape) && ev.shape.length) {
            try {
              const sk = (typeof shapeKey === 'function') ? shapeKey(ev.shape) : '';
              const ck = (typeof colorKey === 'function') ? colorKey(ev.color) : String(ev.color || '').toLowerCase();
              for (const p of hand) {
                if (!p || p.used || !p.shape) continue;
                if (sk && typeof shapeKey === 'function' && shapeKey(p.shape) !== sk) continue;
                const pck = (typeof colorKey === 'function') ? colorKey(p.color) : String(p.color || '').toLowerCase();
                if (!ck || pck === ck) { p.used = true; marked = true; break; }
              }
              if (!marked) {
                for (const p of hand) {
                  if (!p || p.used || !p.shape) continue;
                  if (typeof shapeKey === 'function' && shapeKey(p.shape) === sk) { p.used = true; break; }
                }
              }
            } catch (_) {}
          }
        }
      };
      try {
        if (Array.isArray(pieces) && pieces.length) markUsedAfterDeal('me', lastMeIdx, pieces);
        if (Array.isArray(oppPieces) && oppPieces.length) markUsedAfterDeal('opp', lastOppIdx, oppPieces);
      } catch (_) {}
    }

    function forceShowForfeitLoss(myScoreNow, oppScoreNow) {
      try {
        document.getElementById('vsTitle').textContent = 'Поражение · сдача';
        document.getElementById('vsMyScore').textContent = myScoreNow;
        document.getElementById('vsOppScore').textContent = oppScoreNow;
        const lab = document.getElementById('vsOppLabel');
        if (lab) lab.textContent = oppName || mpOppName || 'Соперник';
        const deltaEl = document.getElementById('vsTrophyDelta');
        if (deltaEl) deltaEl.innerHTML = '<span class="muted">Сдача</span>';
        const timeInfo = document.getElementById('vsTimeLeftInfo');
        if (timeInfo) timeInfo.textContent = '';
      } catch (_) {}
      try {
        lastMatchResult = {
          result: 'Поражение', won: false, draw: false,
          my: myScoreNow, opp: oppScoreNow, oppName: oppName || 'Соперник',
          delta: 0, timeLeft: vsTimeLeft, duration: vsDuration,
          mode: vsModeType, botId: null, date: Date.now()
        };
      } catch (_) {}
      try { showScreen('versus'); } catch (_) {}
      try {
        document.getElementById('versusResult').classList.add('visible');
      } catch (_) {}
      try { configurePostMatchButtons(); } catch (_) {}
    }

    function surrenderLiveMatch() {
      // Idempotent — second click does nothing harmful
      if (window._matchEnded) {
        try { hideMatchRejoinPanel(); } catch (_) {}
        return;
      }
      window._matchEnded = true;

      const snap = readLiveMatch();
      killAllMatchTimers();
      try { clearLiveMatch(); } catch (_) {}
      restoreSnapState(snap);

      mpMode = true;
      mode = 'versus';
      vsModeType = 'online';

      const myScoreNow = Math.max(0, typeof score === 'number' ? score : 0);
      const oppScoreNow = Math.max(0, typeof oppScore === 'number' ? oppScore : 0);

      const payload = {
        type: 'end',
        reason: 'forfeit',
        youWin: true,
        youLose: false,
        myScore: myScoreNow,
        oppScore: oppScoreNow
      };
      const overMsg = { type: 'match_over', reason: 'forfeit' };
      function blastForfeit(conn) {
        const send = (c) => {
          try {
            if (c && c.open) {
              c.send(payload);
              c.send(overMsg);
            } else if (mpConn && mpConn.open) {
              mpSend(payload);
              mpSend(overMsg);
            }
          } catch (_) {}
        };
        send(conn);
        setTimeout(() => send(conn), 120);
        setTimeout(() => send(conn), 350);
        setTimeout(() => send(conn), 700);
      }
      try {
        if (mpConn && mpConn.open) blastForfeit(mpConn);
      } catch (_) {}
      // Dedicated notify so opponent ends even if we only had the toast (not full rejoin)
      (async () => {
        try {
          if (!snap) return;
          const target = snap.remotePeer || (snap.room ? roomPeerId(snap.room) : null);
          if (!target) return;
          let peer;
          if (snap.role === 'host' && snap.room) {
            peer = await openGamePeer(roomPeerId(snap.room), { attempts: 3, timeoutMs: 5000 });
          } else {
            peer = await openGamePeer(undefined, { attempts: 3, timeoutMs: 5000 });
          }
          const conn = peer.connect(target, { reliable: true });
          await new Promise((resolve) => {
            const t = setTimeout(resolve, 4500);
            const onOpen = () => {
              setTimeout(() => {
                blastForfeit(conn);
                clearTimeout(t);
                setTimeout(resolve, 900);
              }, 80);
            };
            if (conn.open) onOpen();
            else conn.on('open', onOpen);
            conn.on('error', () => { clearTimeout(t); resolve(); });
          });
          try { peer.destroy(); } catch (_) {}
        } catch (_) {}
      })();

      // Quiet loss for the player who surrendered (toast only, no duel / modal)
      try {
        if (Array.isArray(snap && snap.moves) && (!matchLog || !matchLog.length)) {
          matchLog = snap.moves.slice();
        }
      } catch (_) {}
      vsActive = true;
      try {
        endVersus({ forceLoss: true, reason: 'forfeit', silent: true, quiet: true });
      } catch (e) {
        console.warn('surrender endVersus', e);
        try {
          showInfoToast('Матч завершён', 'Поражение', 'bad');
          showScreen('menu');
          updateMenuStats();
        } catch (_) {}
      }
      vsActive = false;
      killAllMatchTimers();
      window._matchEnded = true;
      try { hideMatchRejoinPanel(); } catch (_) {}
    }

    function bindMatchRejoinUI() {
      const a = document.getElementById('btnMatchRejoin');
      const b = document.getElementById('btnMatchSurrender');
      if (a) {
        a.onclick = (e) => { e.preventDefault(); attemptMatchRejoin(); };
      }
      if (b) {
        b.onclick = (e) => { e.preventDefault(); surrenderLiveMatch(); };
      }
      try {
        // Raw snap (may be expired by readLiveMatch) — if expired, try dual-away resolve
        let rawSnap = null;
        try {
          const raw = localStorage.getItem(LIVE_MATCH_KEY);
          if (raw) rawSnap = JSON.parse(raw);
        } catch (_) {}
        const snap = readLiveMatch();
        const resultUp = (() => {
          try {
            const r = document.getElementById('versusResult');
            return !!(r && r.classList.contains('visible'));
          } catch (_) { return false; }
        })();
        if (!snap && rawSnap && !vsActive && !resultUp && !window._matchEnded) {
          // Reconnect window already elapsed → finish match + history + toast
          try {
            if (typeof resolveBothAwayFromSnap === 'function' && resolveBothAwayFromSnap(rawSnap, true)) {
              return;
            }
          } catch (_) {}
          try { clearLiveMatch(); } catch (_) {}
          hideMatchRejoinPanel();
          return;
        }
        if (snap && !vsActive && !resultUp) {
          // Restore leave stamps for dual-away if user retries rejoin
          try {
            if (typeof snap.leftAt === 'number') myDcAt = snap.leftAt;
            if (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) oppDcAt = snap.oppLeftAt;
            if (myDcAt && oppDcAt) bothAwayMode = true;
          } catch (_) {}
          showMatchRejoinPanel(snap);
          // Host: listen for opponent surrender while on rejoin toast
          try { startRejoinPanelListen(snap); } catch (_) {}
          // Schedule auto-resolve when this client's 1-min (or match-left) window ends
          try {
            const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
            const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft : 120;
            const reconnectMs = Math.min(60000, Math.max(0, leftSec) * 1000);
            const remain = Math.max(0, leftAt + reconnectMs - Date.now());
            if (window._bothAwayResolveTimer) {
              try { clearTimeout(window._bothAwayResolveTimer); } catch (_) {}
            }
            window._bothAwayResolveTimer = setTimeout(() => {
              window._bothAwayResolveTimer = null;
              if (window._matchEnded) return;
              // If user is mid-rejoin attempt, let it finish; otherwise end the match
              if (window._mpRejoiningMatch && vsActive) return;
              try {
                let expired = null;
                try {
                  const r = localStorage.getItem(LIVE_MATCH_KEY);
                  if (r) expired = JSON.parse(r);
                } catch (_) {}
                if (!expired) {
                  try { hideMatchRejoinPanel(); } catch (_) {}
                  try { showInfoToast('Матч', 'Матч завершён', 'bad'); } catch (_) {}
                  return;
                }
                if (typeof resolveBothAwayFromSnap === 'function') {
                  resolveBothAwayFromSnap(expired, true);
                }
              } catch (_) {}
            }, remain + 400);
          } catch (_) {}
          // Do not auto-probe: connecting briefly would steal the host's live link
        } else if (!snap || resultUp) {
          hideMatchRejoinPanel();
        }
      } catch (_) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindMatchRejoinUI);
    } else {
      setTimeout(bindMatchRejoinUI, 0);
    }
    window.addEventListener('load', () => { try { bindMatchRejoinUI(); } catch (_) {} });
    setTimeout(() => { try { bindMatchRejoinUI(); } catch (_) {} }, 800);
    setTimeout(() => { try { bindMatchRejoinUI(); } catch (_) {} }, 2000);

    function copyText(t) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
      } else fallbackCopy(t);
    }
    function fallbackCopy(t) {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }


    // ========== P2P Multiplayer (PeerJS) ==========
    let mpMode = false;
    let mpRole = null; // 'host' | 'guest'
    let mpRoomCode = null;
    let mpPeer = null;
    let mpConn = null;
    let mpOppName = 'Соперник';
    try { window.mpOppAvatarId = window.mpOppAvatarId || null; } catch (_) {}
    let mpReady = false;
    let mpOppReady = false;
    let mpOppConnected = false;
    let mpLobbyDuration = 120;
    let mpMatchStarting = false;
    let vsIntroLock = false;
    let mpJoinTimer = null;
    let oppDisconnected = false;
    let mpDisconnectTimer = null;
    let rematchPending = false;
    let mpFromMatchmaking = false;
    /** 'ranked' | 'lobby' | null */
    let mpGameSource = null;
    let rematchIWant = false;
    let rematchTheyWant = false;
    /** Queued rematch offer while score-duel overlay is still covering the UI */
    let pendingRematchOfferName = null;
    /** Keep P2P link after match so rematch works from menu / delayed result UI */
    let postMatchOnlineEligible = false;
    /** Remote PeerJS id for post-match reconnect */
    let mpRemotePeerId = null;

    function setMpStatus(t) {
      const el = document.getElementById('mpStatus');
      if (el) el.textContent = t || '';
    }

    function clearMpJoinTimer() {
      if (mpJoinTimer) {
        clearTimeout(mpJoinTimer);
        mpJoinTimer = null;
      }
    }

    function failJoinRoom(reason, silentAlert) {
      clearMpJoinTimer();
      closeRoomLobby();
      hideRjToast(false);
      mpPendingJoin = null;
      // Room gone / full — drop pending lobby invite for this room
      try {
        if (chPending && chPending.room) {
          const closed = String(chPending.room).toUpperCase();
          const tried = String(mpRoomCode || '').toUpperCase();
          if (!tried || closed === tried || (reason && /занят|не найден|отклон|закрыт|full|closed/i.test(String(reason)))) {
            chPending = null;
            try { hideChToast(false); } catch (_) {}
          }
        }
      } catch (_) {}
      const modal = document.getElementById('joinRoomModal');
      if (modal) modal.classList.remove('visible');
      const msg = reason || 'Комната не найдена';
      setMpStatus(msg);
      try { if (mpConn) mpConn.close(); } catch (_) {}
      try { if (mpPeer) mpPeer.destroy(); } catch (_) {}
      mpConn = null;
      mpPeer = null;
      mpMode = false;
      mpRole = null;
      mpRoomCode = null;
      mpReady = false;
      mpOppReady = false;
      mpOppConnected = false;
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
      if (!silentAlert) {
        try { SFX.bad && SFX.bad(); } catch (_) {}
      }
    }

    function mpIsLinked() {
      return !!(mpConn && mpConn.open);
    }

    function mpSend(obj) {
      if (mpConn && mpConn.open) {
        try { mpConn.send(obj); } catch (e) { console.warn('mp send', e); }
      }
    }

    function destroyMp() {
      clearMpJoinTimer();
      const closedRoom = mpRoomCode;
      try { stopLobbyPing(); } catch (_) {}
      try {
        if (closedRoom) notifyChallengeCancelled(closedRoom, 'closed');
      } catch (_) {
        try { clearLobbyInviteWait(null, closedRoom); } catch (_) {}
      }
      try { if (mpConn) mpConn.close(); } catch (_) {}
      try { if (mpPeer) mpPeer.destroy(); } catch (_) {}
      mpConn = null; mpPeer = null; mpMode = false; mpRole = null;
      mpRoomCode = null; mpReady = false; mpOppReady = false;
      mpOppConnected = false; mpMatchStarting = false;
      mpFromMatchmaking = false;
      mpGameSource = null;
      postMatchOnlineEligible = false;
      mpRemotePeerId = null;
      try { stopMatchmaking(true); } catch (_) {}
      try { mmFound = false; mmActive = false; } catch (_) {}
      vsIntroLock = false;
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      pendingRematchOfferName = null;
      try { hideRmToast(false); } catch (_) {}
      mpPendingJoin = null;
      mpExpectedJoinCode = null;
      try { hideRjToast(false); } catch (_) {}
      setMpStatus('');
      closeRoomLobby();
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
    }

    function roomPeerId(code) {
      return 'bpv3-' + String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    /**
     * СВОЙ Peer-сервер (не PeerJS Cloud).
     * Для локальных тестов оставь host 127.0.0.1 и secure: false.
     * Если выставил игру/сервер через Cloudflare Tunnel (HTTPS) — поменяй:
     *   host: 'xxxx.trycloudflare.com',  port: 443,  secure: true
     * URL-параметры ?peerHost=... по-прежнему перекрывают эти значения.
     */
    const SELF_PEER = {
      enabled: true,
      host: 'block-puzzle-peer.onrender.com',
      port: 443,
      path: '/peerjs',
      key: 'peerjs',
      secure: true
    };

    function peerBrokerFromUrl() {
      try {
        const q = new URLSearchParams(location.search);
        const host = q.get('peerHost');
        if (!host) return null;
        return {
          host,
          port: parseInt(q.get('peerPort') || (q.get('peerSecure') === '0' ? '9000' : '443'), 10) || 443,
          path: q.get('peerPath') || '/',
          key: q.get('peerKey') || 'peerjs',
          secure: q.get('peerSecure') !== '0'
        };
      } catch (_) {
        return null;
      }
    }

    function peerIceServers() {
      // STUN/TURN только помогают пробить NAT; signaling идёт на SELF_PEER
      return [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.nextcloud.com:3478' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.sipgate.net:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: [
            'turn:openrelay.metered.ca:80?transport=tcp',
            'turns:openrelay.metered.ca:443'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ];
    }

    function peerJsOpts(extra) {
      const opts = {
        debug: 0,
        pingInterval: 10000,
        config: {
          iceServers: peerIceServers(),
          sdpSemantics: 'unified-plan',
          iceTransportPolicy: 'all',
          iceCandidatePoolSize: 2
        }
      };
      // 1) Свой сервер по умолчанию
      if (SELF_PEER && SELF_PEER.enabled && SELF_PEER.host) {
        opts.host = SELF_PEER.host;
        opts.port = SELF_PEER.port;
        opts.path = SELF_PEER.path || '/';
        opts.key = SELF_PEER.key || 'peerjs';
        opts.secure = !!SELF_PEER.secure;
      }
      // 2) Переопределение из URL (?peerHost=...)
      const custom = peerBrokerFromUrl();
      if (custom) {
        opts.host = custom.host;
        opts.port = custom.port;
        opts.path = custom.path;
        opts.key = custom.key;
        opts.secure = custom.secure;
      }
      if (extra && typeof extra === 'object') {
        const { config: cfg2, ...rest } = extra;
        Object.assign(opts, rest);
        if (cfg2) opts.config = Object.assign({}, opts.config, cfg2);
      }
      return opts;
    }

    /** Create Peer. Empty id → random. Never recurse. */
    function createGamePeer(idOrUndef) {
      if (typeof Peer === 'undefined') throw new Error('PeerJS missing');
      const opts = peerJsOpts();
      if (idOrUndef === undefined || idOrUndef === null || idOrUndef === '') {
        return new Peer(opts);
      }
      return new Peer(String(idOrUndef), opts);
    }

    let peerOpenSerial = Promise.resolve();

    /**
     * Serialize peer opens — free cloud rate-limits parallel handshakes
     * (friends presence + room + MM at once → "network").
     */
    function openGamePeer(idOrUndef, options) {
      const maxAttempts = (options && options.attempts) || 5;
      const perTryMs = (options && options.timeoutMs) || 12000;

      const run = () => new Promise((resolve, reject) => {
        let attempt = 0;
        const tryOnce = () => {
          attempt++;
          let peer = null;
          let settled = false;
          let timer = null;
          const cleanup = () => { if (timer) { clearTimeout(timer); timer = null; } };

          const fail = (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            try { if (peer) peer.destroy(); } catch (_) {}
            peer = null;
            const t = (err && err.type) || '';
            if (attempt >= maxAttempts) {
              reject(err || new Error('peer-open-failed'));
              return;
            }
            // Longer backoff on network — cloud recovery
            const wait = (t === 'network' || t === 'server-error' || t === 'socket-error')
              ? 1200 + attempt * 900 + Math.random() * 500
              : 400 + attempt * 350;
            setTimeout(tryOnce, wait);
          };

          const ok = () => {
            if (settled) return;
            settled = true;
            cleanup();
            setNetStatus(true);
            resolve(peer);
          };

          try {
            peer = createGamePeer(idOrUndef);
          } catch (e) {
            fail(e);
            return;
          }

          timer = setTimeout(() => fail({ type: 'timeout', message: 'Peer open timeout' }), perTryMs);
          peer.on('open', () => ok());
          peer.on('error', (err) => {
            const t = (err && err.type) || '';
            // After our peer is open, peer-unavailable = remote offline (not our network down)
            if (settled) {
              if (t === 'peer-unavailable') return;
              // soft: do not destroy an already-open peer used for outbound connect
              return;
            }
            if (t === 'unavailable-id') {
              settled = true;
              cleanup();
              reject(err);
              return;
            }
            if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
              setNetStatus(false, t);
            }
            fail(err || { type: 'network' });
          });
        };
        tryOnce();
      });

      // Queue opens so only one handshake hits the cloud at a time
      const p = peerOpenSerial.then(run, run);
      peerOpenSerial = p.catch(() => {});
      return p;
    }

    let _netOk = null;
    function setNetStatus(ok, detail) {
      _netOk = !!ok;
      const el = document.getElementById('netStatusPill');
      if (!el) return;
      if (ok) {
        // Online — no indicator
        el.textContent = '';
        el.title = '';
        el.removeAttribute('aria-label');
        el.className = 'net-status-pill ok';
      } else {
        const map = {
          'peer-unavailable': 'друг оффлайн',
          'network': 'нет связи',
          'server-error': 'ошибка сервера',
          'socket-error': 'ошибка сокета',
          'timeout': 'таймаут сети',
          'peer': 'нет связи',
          'disconnected': 'отключение',
          'webrtc': 'WebRTC недоступен'
        };
        const label = detail ? (map[detail] || String(detail)) : 'оффлайн';
        // Visual: red ring only; error name in tooltip
        el.textContent = '';
        el.title = label;
        el.setAttribute('aria-label', 'Сеть: ' + label);
        el.className = 'net-status-pill bad';
      }
    }

    function isWebRtcSupported() {
      return !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);
    }

    function isSecureOk() {
      // localhost / file / https are fine; plain http on LAN phone often blocks WebRTC
      if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
      const p = location.protocol;
      return p === 'https:' || p === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    }

    function showNetBanner(html, opts) {
      let el = document.getElementById('netBanner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'netBanner';
        el.className = 'net-banner';
        el.innerHTML = '<div class="nb-text"></div><div class="nb-actions"></div>';
        document.body.appendChild(el);
      }
      el.querySelector('.nb-text').innerHTML = html;
      const actions = el.querySelector('.nb-actions');
      actions.innerHTML = '';
      const dismiss = document.createElement('button');
      dismiss.className = 'ghost';
      dismiss.textContent = 'Понятно';
      dismiss.onclick = () => el.classList.remove('visible');
      actions.appendChild(dismiss);
      if (opts && opts.copyUrl) {
        const b = document.createElement('button');
        b.className = 'primary';
        b.textContent = 'Скопировать ссылку';
        b.onclick = () => {
          try {
            copyText(location.href.split('#')[0]);
            b.textContent = 'Скопировано';
          } catch (_) {}
        };
        actions.appendChild(b);
      }
      el.classList.add('visible');
    }

    function checkCrossPlatformReady() {
      if (!isSecureOk()) {
        showNetBanner(
          '<strong>Нужен HTTPS</strong><br/>Онлайн работает по <b>https://</b>.',
          { copyUrl: true }
        );
        return false;
      }
      if (typeof Peer === 'undefined') {
        showNetBanner('<strong>PeerJS не загрузился</strong><br/>Проверь интернет и обнови страницу.');
        return false;
      }
      return true;
    }

    // iOS Safari: prevent pinch-zoom / double-tap zoom during play
    (function iosGestureGuards() {
      document.addEventListener('gesturestart', (e) => { e.preventDefault(); }, { passive: false });
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
      }, { passive: false });
    })();

    function delayMs(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    let mpCreateGen = 0;
    let mpJoinGen = 0;
    let mpPendingJoin = null; // { conn, name, code, trophies }
    /** Friend code expected after challenge — auto-admit without host toast */
    let mpExpectedJoinCode = null;

    let rjToastHideTimer = null;
    let rjToastCountTimer = null;
    function clearRjToastHideTimer() {
      if (rjToastHideTimer) { clearTimeout(rjToastHideTimer); rjToastHideTimer = null; }
      if (rjToastCountTimer) { clearInterval(rjToastCountTimer); rjToastCountTimer = null; }
    }
    function hideRjToast(animate) {
      const toast = document.getElementById('rjToast');
      if (!toast) return;
      clearRjToastHideTimer();
      if (animate === false) {
        toast.classList.remove('visible', 'out');
        return;
      }
      toast.classList.add('out');
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.remove('out'), 400);
    }

    function showRjToast(req) {
      const toast = document.getElementById('rjToast');
      if (!toast || !req) return;
      clearRjToastHideTimer();
      const av = document.getElementById('rjToastAv');
      const name = document.getElementById('rjToastName');
      const meta = document.getElementById('rjToastMeta');
      if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
      if (name) name.textContent = req.name || 'Игрок';
      if (meta) {
        const parts = [];
        if (req.code) parts.push('код ' + req.code);
        if (req.trophies != null) parts.push('🏆 ' + req.trophies);
        parts.push('хочет войти');
        meta.textContent = parts.join(' · ');
      }
      toast.classList.remove('out');
      void toast.offsetWidth;
      toast.classList.add('visible');
      try { SFX.ui(); } catch (_) {}
      try { hapticTap(12); } catch (_) {}
      rjToastCountTimer = startToastCountdown('rjToastCountdown', 5, null);
      try { renderFriendRequests(); } catch (_) {}
      rjToastHideTimer = setTimeout(() => {
        rjToastHideTimer = null;
        if (mpPendingJoin && mpPendingJoin === req) {
          try { declinePendingJoin('timeout'); } catch (_) { hideRjToast(true); }
        } else {
          hideRjToast(true);
        }
      }, 5000);
    }

    function declinePendingJoin(reason) {
      const pend = mpPendingJoin;
      mpPendingJoin = null;
      if (rjExpireTimer) { clearTimeout(rjExpireTimer); rjExpireTimer = null; }
      hideRjToast(true);
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
      if (!pend || !pend.conn) return;
      try {
        if (pend.conn.open) {
          pend.conn.send({ type: 'join_decline', reason: reason || 'declined' });
        }
      } catch (_) {}
      setTimeout(() => { try { pend.conn.close(); } catch (_) {} }, 250);
    }

    
    function acceptPendingJoin() {
      const pend = mpPendingJoin;
      if (!pend || !pend.conn) return;
      if (pend.dead && !pend.conn.open) {
        setMpStatus('Связь потеряна — попроси игрока войти снова');
        mpPendingJoin = null;
        if (rjExpireTimer) { clearTimeout(rjExpireTimer); rjExpireTimer = null; }
        hideRjToast(true);
        return;
      }
      mpPendingJoin = null;
      if (rjExpireTimer) { clearTimeout(rjExpireTimer); rjExpireTimer = null; }
      hideRjToast(true);
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
      if (mpOppConnected) {
        try { pend.conn.send({ type: 'join_decline', reason: 'full' }); } catch (_) {}
        setTimeout(() => { try { pend.conn.close(); } catch (_) {} }, 200);
        return;
      }
      mpOppName = pend.name || 'Соперник';
      if (typeof pend.trophies === 'number') mpOppTrophies = pend.trophies;
      try {
        pend.conn.send({
          type: 'join_accept',
          name: myNickname,
          code: myFriendCode,
          trophies: typeof trophies === 'number' ? trophies : 0,
          duration: mpLobbyDuration
        });
      } catch (_) {}
      wireMpConnection(pend.conn, true);
      setMpStatus('Игрок в лобби ✓');
    }

    (function bindRjToast() {
      const acc = document.getElementById('rjToastAccept');
      const dec = document.getElementById('rjToastDecline');
      if (acc) acc.addEventListener('click', () => acceptPendingJoin());
      if (dec) dec.addEventListener('click', () => declinePendingJoin('declined'));
    })();
    (function bindRjToastSwipe() {
      const toast = document.getElementById('rjToast');
      if (!toast || toast._bpSwipe) return;
      toast._bpSwipe = true;
      let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
      const onStart = (e) => {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        const t = e.touches ? e.touches[0] : e;
        startY = t.clientY; startX = t.clientX; dy = 0; dx = 0;
        dragging = true;
        toast.classList.add('dragging');
      };
      const onMove = (e) => {
        if (!dragging) return;
        const t = e.touches ? e.touches[0] : e;
        dy = t.clientY - startY; dx = t.clientX - startX;
        if (dx > 8 || dy < -8) {
          if (e.cancelable) e.preventDefault();
          const distX = Math.max(0, Math.min(dx, 200));
          const distY = Math.min(0, Math.max(dy, -120));
          toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
          toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
        }
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        toast.classList.remove('dragging');
        if (dx > 64 || dy < -56) {
          try { declinePendingJoin('declined'); } catch (_) { hideRjToast(true); }
        } else {
          toast.style.transform = '';
          toast.style.opacity = '';
        }
        dy = 0; dx = 0;
      };
      toast.addEventListener('touchstart', onStart, { passive: true });
      toast.addEventListener('touchmove', onMove, { passive: false });
      toast.addEventListener('touchend', onEnd);
      toast.addEventListener('touchcancel', onEnd);
    })();

    (function bindChToast() {
      const a = document.getElementById('chBtnAccept');
      const d = document.getElementById('chBtnDecline');
      if (a) a.addEventListener('click', () => acceptChallenge());
      if (d) d.addEventListener('click', () => declineChallenge());
    })();

    function openRoomLobby() {
      const el = document.getElementById('roomLobby');
      if (!el) return;
      document.getElementById('lobbyCode').textContent = mpRoomCode || '————';
      document.getElementById('lobbyTitle').textContent = mpRole === 'host' ? 'Твоя комната' : 'Комната';
      document.getElementById('lobbyMeName').textContent = myNickname + (mpRole === 'host' ? ' (хост)' : '');
      updateLobbyUI();
      el.classList.add('visible');
      if (mpOppConnected) startLobbyPing();
    }

    function closeRoomLobby() {
      const el = document.getElementById('roomLobby');
      if (el) el.classList.remove('visible');
      stopLobbyPing();
    }

    function updateLobbyUI() {
      const meState = document.getElementById('lobbyMeState');
      const meSlot = document.getElementById('lobbySlotMe');
      const oppName = document.getElementById('lobbyOppName');
      const oppState = document.getElementById('lobbyOppState');
      const oppSlot = document.getElementById('lobbySlotOpp');
      const readyBtn = document.getElementById('btnLobbyReady');
      const inviteBtn = document.getElementById('btnLobbyInvite');
      const hint = document.getElementById('lobbyHint');

      if (meState) meState.textContent = mpReady ? 'Готов ✓' : 'Не готов';
      if (meSlot) meSlot.classList.toggle('ready', !!mpReady);
      if (readyBtn) {
        readyBtn.textContent = mpReady ? 'Не готов' : 'Готов';
        readyBtn.classList.toggle('is-ready', !!mpReady);
      }

      if (mpOppConnected) {
        if (oppName) oppName.textContent = mpOppName || 'Соперник';
        if (oppState) oppState.textContent = mpOppReady ? 'Готов ✓' : 'Не готов';
        if (oppSlot) {
          oppSlot.classList.remove('empty');
          oppSlot.classList.toggle('ready', !!mpOppReady);
        }
        // Room is full (2/2) — no more invites
        if (inviteBtn) inviteBtn.style.display = 'none';
        try { closeLobbyInviteModal(); } catch (_) {}
        try { updateLobbyPingUI(); } catch (_) {}
      } else {
        if (oppName) oppName.textContent = 'Ожидание игрока…';
        if (oppState) oppState.textContent = '—';
        if (oppSlot) {
          oppSlot.classList.add('empty');
          oppSlot.classList.remove('ready');
        }
        if (inviteBtn) inviteBtn.style.display = '';
        try {
          const op = document.getElementById('lobbyOppPing');
          const mp = document.getElementById('lobbyMePing');
          if (op) { op.textContent = ''; op.className = 'lobby-ping'; }
          if (mp) { mp.textContent = ''; mp.className = 'lobby-ping'; }
        } catch (_) {}
      }

      if (hint) {
        if (!mpOppConnected) {
          hint.textContent = 'Нажми «Пригласить» или скажи другу код комнаты';
        } else if (!mpReady || !mpOppReady) {
          hint.textContent = 'Оба игрока должны нажать «Готов»';
        } else {
          hint.textContent = 'Оба готовы — старт…';
        }
      }

      // Sync duration button selection
      document.querySelectorAll('.lobby-dur').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.sec, 10) === mpLobbyDuration);
      });

      tryStartMpMatch();
    }

    function tryStartMpMatch() {
      if (mpMatchStarting || !mpOppConnected || !mpReady || !mpOppReady) return;
      if (!mpConn || !mpConn.open) return;
      if (mmActive || mmFound) return;
      if (mpRole !== 'host') return;
      if (!mpRoomCode) return;
      mpMatchStarting = true;
      vsDuration = mpLobbyDuration;
      vsModeType = 'online';
      mpMode = true;
      mpFromMatchmaking = false;
      mpGameSource = 'lobby';
      currentBot = null;
      oppName = mpOppName || 'Соперник';
      mpSend({
        type: 'start',
        duration: vsDuration,
        boardId: equippedBoardId,
        skinId: equippedSkinId,
        hostName: myNickname,
        trophies,
        lobby: true
      });
      closeRoomLobby();
      try { beginVersusMatchMp(true); } catch (_) {}
    }

    function wireMpConnection(conn, alreadyOpen) {
      if (!conn) return;
      mpConn = conn;
      try { noteMpRemotePeer(conn); } catch (_) {}
      // Avoid stacking data/close/error handlers on the same DataConnection
      if (conn._bpWired) {
        try {
          if (alreadyOpen || conn.open) {
            // still refresh lobby/match handshake if already open
            if (vsActive || window._mpRejoiningMatch) {
              try { startLobbyPing(); } catch (_) {}
            }
          }
        } catch (_) {}
        return;
      }
      conn._bpWired = true;
      const onOpen = () => {
        clearMpJoinTimer();
        const wasConnected = mpOppConnected;
        mpOppConnected = true;
        try {
          if (mpRoomCode && mpRole === 'host') {
            notifyChallengeCancelled(mpRoomCode, 'full');
          } else if (mpRoomCode) {
            clearLobbyInviteWait(null, mpRoomCode);
          }
          renderLobbyInviteList();
        } catch (_) {}
        setMpStatus('Связь установлена ✓');
        if (!wasConnected) {
          try {
            const who = mpOppName || 'Игрок';
            showInfoToast('Игрок подключился', who + ' успешно вошёл в лобби', 'ok');
            SFX.ui && SFX.ui();
          } catch (_) {}
        }
        // Never open lobby while match is live or we are rejoining a fight
        if (vsActive || window._mpRejoiningMatch) {
          startLobbyPing();
          try { closeRoomLobby(); } catch (_) {}
          mpSend({
            type: 'hello',
            name: myNickname,
            code: myFriendCode,
            trophies,
            avatarId: myAvatarId,
            skinId: equippedSkinId,
            boardId: equippedBoardId,
            matchReconnect: true,
            vsActive: !!vsActive
          });
          return;
        }
        startLobbyPing();
        openRoomLobby();
        mpSend({
          type: 'hello',
          name: myNickname,
          code: myFriendCode,
          trophies,
          avatarId: myAvatarId,
          skinId: equippedSkinId,
          boardId: equippedBoardId,
          ready: mpReady,
          duration: mpLobbyDuration
        });
        updateLobbyUI();
      };
      if (alreadyOpen || conn.open) {
        // open may have already fired before accept
        setTimeout(onOpen, 0);
      } else {
        conn.on('open', onOpen);
      }
      conn.on('data', (data) => onMpMessage(data));
      conn.on('close', () => {
        if (mpPendingJoin && mpPendingJoin.conn === conn) {
          mpPendingJoin = null;
          hideRjToast(true);
        }
        if (mpRole === 'guest' && !mpOppConnected && !vsActive && !isMatchLoadActive() && !mpLoading) {
          failJoinRoom('Комната не найдена или хост вышел.', true);
          return;
        }
        mpOppConnected = false;
        mpOppReady = false;
        // During match loading (friendly or ranked) — cancel, do not treat as in-game DC
        if ((isMatchLoadActive() || mpLoading) && !vsActive) {
          try { abortPreMatchMissingPeer('Соперник отключился при загрузке'); } catch (_) {}
          return;
        }
        if (vsActive) setMpStatus('Соперник отключился');
        try { if (!vsActive) updateLobbyUI(); } catch (_) {}
        if (vsActive && mpMode) handleOpponentDisconnect();
        else {
          if (postMatchOnlineEligible && !vsActive) {
            try {
              hideRematchWait();
              rematchPending = false;
            } catch (_) {}
          }
          updateLobbyUI();
        }
      });
      conn.on('error', (err) => {
        const t = (err && err.type) || 'unknown';
        if (mpRole === 'guest' && !mpOppConnected) {
          failJoinRoom('Не удалось подключиться (' + t + '). Комната не найдена.', true);
        } else {
          setMpStatus('Ошибка связи: ' + t);
          if (vsActive && mpMode) handleOpponentDisconnect();
        }
      });
    }

    let rjExpireTimer = null;

    /** While a live online match is running, accept opponent reconnect on ANY role. */
    function acceptLiveMatchReconnect(conn) {
      // Allow while either still in a live match OR actively rejoining (both left case)
      if (!conn || !mpMode) return false;
      if (!vsActive && !window._mpRejoiningMatch) return false;
      if (window._matchEnded) return false;
      const onOpen = () => {
        try {
          try { if (mpConn && mpConn !== conn && mpConn.open) mpConn.close(); } catch (_) {}
          mpConn = conn;
          mpOppConnected = true;
          noteMpRemotePeer(conn);
          conn._bpWired = true;
          if (!conn._bpLiveData) {
            conn._bpLiveData = true;
            conn.on('data', (data) => {
              try {
                if (data && data.type === 'match_rejoin' && data.probe) {
                  try { conn.send({ type: 'match_rejoin_ok', stillLive: true, probe: true }); } catch (_) {}
                  return;
                }
              } catch (_) {}
              try { mpOppConnected = true; } catch (_) {}
              try { onMpMessage(data); } catch (_) {}
            });
            conn.on('close', () => {
              try {
                if (mpConn === conn) {
                  mpOppConnected = false;
                  if (vsActive && mpMode) handleOpponentDisconnect();
                }
              } catch (_) {}
            });
          }
          try { wireMpConnResume(conn); } catch (_) {}
          try { handleOpponentReconnectSignal(); } catch (_) {}
          try {
            const packPieces = (arr) => (arr || []).map(p => ({
              shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
              color: p && p.color,
              used: !!(p && p.used)
            }));
            const payload = {
              type: 'match_rejoin_ok',
              stillLive: true,
              name: myNickname,
              score: score,
              oppScore: oppScore,
              vsTimeLeft: vsTimeLeft,
              grid: grid,
              oppGrid: oppGrid,
              pieces: packPieces(pieces),
              oppPieces: packPieces(oppPieces),
              boardId: equippedBoardId,
              skinId: equippedSkinId
            };
            try { conn.send(payload); } catch (_) { mpSend(payload); }
            // Second copy a bit later (rejoiner may attach data handler late)
            setTimeout(() => {
              try { if (conn.open) conn.send(payload); } catch (_) {}
            }, 200);
          } catch (_) {}
        } catch (_) {}
      };
      if (conn.open) onOpen();
      else conn.on('open', onOpen);
      return true;
    }

    /** Register once: any incoming peer during live match is treated as rejoin. */
    function ensureLiveMatchAccept() {
      try {
        if (!mpPeer || mpPeer.destroyed) return;
        if (mpPeer._bpLiveAccept) return;
        mpPeer._bpLiveAccept = true;
        mpPeer.on('connection', (conn) => {
          try {
            if (mpMode && (vsActive || window._mpRejoiningMatch) && !window._matchEnded) {
              acceptLiveMatchReconnect(conn);
              return;
            }
          } catch (_) {}
        });
      } catch (_) {}
    }

        function handleHostIncomingConn(conn) {
      if (!conn) return;
      // Post-match: opponent re-linking for rematch (same room peer)
      if (postMatchOnlineEligible && !vsActive) {
        try { noteMpRemotePeer(conn); } catch (_) {}
        const onOpen = () => {
          try {
            mpConn = conn;
            mpMode = true;
            mpOppConnected = true;
            wireMpConnLifetime(conn);
            try { wireMpConnection(conn, true); } catch (_) {}
            mpSend({
              type: 'hello',
              name: myNickname,
              code: myFriendCode,
              trophies,
              avatarId: myAvatarId,
              skinId: equippedSkinId,
              boardId: equippedBoardId,
              rematchReconnect: true
            });
          } catch (_) {}
        };
        if (conn.open) onOpen();
        else conn.on('open', onOpen);
        return;
      }
      // Mid-match or mutual rejoin (both players left and are coming back)
      if (mpMode && (vsActive || window._mpRejoiningMatch) && !window._matchEnded) {
        acceptLiveMatchReconnect(conn);
        return;
      }
      // Room lobby: already has a player
      // Room lobby: already has a player
      if (mpOppConnected || (mpPendingJoin && mpPendingJoin.conn !== conn && !mpPendingJoin.dead)) {
        conn.on('open', () => {
          try { conn.send({ type: 'join_decline', reason: 'full' }); } catch (_) {}
          setTimeout(() => { try { conn.close(); } catch (_) {} }, 200);
        });
        return;
      }
      let gotReq = false;
      const reqTimer = setTimeout(() => {
        if (gotReq || mpOppConnected) return;
        try { conn.close(); } catch (_) {}
      }, 20000);

      conn.on('data', (data) => {
        if (!data || typeof data !== 'object') return;
        if (conn._bpWired) return;
        if (data.type === 'join_req') {
          gotReq = true;
          clearTimeout(reqTimer);
          if (mpOppConnected || vsActive) {
            try { conn.send({ type: 'join_decline', reason: 'full' }); } catch (_) {}
            setTimeout(() => { try { conn.close(); } catch (_) {} }, 200);
            return;
          }
          const joinCode = normalizeFriendCode(data.code || '');
          const autoAdmit = !!(
            data.fromChallenge ||
            (mpExpectedJoinCode && joinCode && joinCode === mpExpectedJoinCode)
          );
          if (mpPendingJoin && mpPendingJoin.conn !== conn) {
            declinePendingJoin('busy');
          }
          mpPendingJoin = {
            conn,
            name: (data.name || 'Игрок').toString().slice(0, 20),
            code: data.code || '',
            trophies: typeof data.trophies === 'number' ? data.trophies : null,
            dead: false
          };
          // Challenged friend joins automatically — no host approval toast
          if (autoAdmit) {
            mpExpectedJoinCode = null;
            setMpStatus('Друг принял вызов — вход…');
            acceptPendingJoin();
            return;
          }
          showRjToast(mpPendingJoin);
          setMpStatus('Запрос на вход от ' + mpPendingJoin.name);
          if (rjExpireTimer) clearTimeout(rjExpireTimer);
          // Align with toast auto-hide (5s)
          rjExpireTimer = setTimeout(() => {
            if (mpPendingJoin && mpPendingJoin.conn === conn) {
              try { if (conn.open) conn.send({ type: 'join_decline', reason: 'timeout' }); } catch (_) {}
              mpPendingJoin = null;
              hideRjToast(true);
              setMpStatus('Запрос истёк · комната ' + (mpRoomCode || ''));
            }
          }, 5000);
          return;
        }
        if (mpConn === conn && mpOppConnected) onMpMessage(data);
      });
      conn.on('close', () => {
        clearTimeout(reqTimer);
        // Do NOT hide toast immediately — ICE can flap; user still needs Accept/Decline
        if (mpPendingJoin && mpPendingJoin.conn === conn) {
          mpPendingJoin.dead = true;
          setMpStatus('Связь с ' + (mpPendingJoin.name || 'игроком') + ' нестабильна — нажми «Пустить» быстрее');
        }
      });
      conn.on('error', () => {
        clearTimeout(reqTimer);
      });
    }

    /* ========== Disconnect + AFK (time-first, no stalling) ==========
       AFK: 15s idle → bottom warn (15s left) → 30s total → AFK loss
       Disconnect: center overlay on opp board; wait min(60s, vsTimeLeft)
       If already AFK when disconnect → AFK loss immediately
       Reconnect does NOT reset timers until a real move (place)
    */
    const AFK_WARN_MS = 15000;   // show bottom warning
    const AFK_LIMIT_MS = 30000;  // auto-loss
    const DC_LIMIT_MS = 60000;   // full disconnect wait when not AFK

    let lastMyActionTs = 0;
    let lastOppActionTs = 0;
    let afkCheckTimer = null;
    let afkBannerKind = null; // 'opp' | 'me' | null

    // oppDisconnected / mpDisconnectTimer declared once above with other mp state
    let dcDeadlineTs = 0;       // absolute end time for disconnect wait (opponent)
    let dcWasAfk = false;       // disconnected while already AFK
    let dcPausedByReconnect = false; // linked again but no move yet
    let oppDcAt = 0;            // when opponent left (wall clock)
    let myDcAt = 0;             // when I left (wall clock)
    let bothAwayMode = false;   // both players currently away from the match

    function showDisconnectBanner(sec, kind) {
      const el = document.getElementById('disconnectBanner');
      if (!el) return;
      el.style.display = 'block';
      if (kind === 'afk') {
        el.textContent = sec > 0
          ? ('⏱ АФК соперника — автопобеда через ' + sec + ' сек')
          : '⏱ АФК соперника…';
      } else if (kind === 'afk-me') {
        el.textContent = sec > 0
          ? ('⏱ Вы АФК — автопоражение через ' + sec + ' сек')
          : '⏱ Вы АФК…';
      } else {
        el.textContent = sec > 0
          ? ('📡 Отсоединение… ' + sec + ' сек')
          : '📡 Отсоединение…';
      }
    }
    function hideDisconnectBanner() {
      const el = document.getElementById('disconnectBanner');
      if (el) el.style.display = 'none';
    }

    function ensureBoardDcOverlay(which) {
      const board = which === 'me'
        ? ((typeof boardMe !== 'undefined' && boardMe) || document.getElementById('boardMe'))
        : ((typeof boardOpp !== 'undefined' && boardOpp) || document.getElementById('boardOpp'));
      if (!board) return null;
      const wrap = board.parentElement;
      if (!wrap) return null;
      let ov = wrap.querySelector('.board-dc-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'board-dc-overlay';
        ov.innerHTML = '<div class="dc-card"><div class="dc-title">📡 Отсоединение…</div><div class="dc-sub"></div></div>';
        wrap.appendChild(ov);
      }
      return ov;
    }
    function showBoardDisconnectOverlay(sec, which) {
      const side = which || 'opp';
      const ov = ensureBoardDcOverlay(side);
      if (!ov) return;
      const title = ov.querySelector('.dc-title');
      const sub = ov.querySelector('.dc-sub');
      if (side === 'me') {
        if (title) title.textContent = '⏱ АФК — автопоражение';
        if (sub) sub.textContent = sec > 0 ? ('Осталось ' + sec + ' сек') : '…';
      } else {
        if (title) title.textContent = '📡 Отсоединение…';
        if (sub) {
          sub.textContent = sec > 0
            ? ('Ожидание ' + sec + ' сек · иначе победа')
            : 'Ожидание…';
        }
      }
      ov.classList.add('show');
    }
    function hideBoardDisconnectOverlay(which) {
      try {
        if (which === 'me' || which === 'opp') {
          const ov = ensureBoardDcOverlay(which);
          if (ov) ov.classList.remove('show');
        } else {
          document.querySelectorAll('.board-dc-overlay').forEach(el => el.classList.remove('show'));
        }
      } catch (_) {}
    }

    function clearDisconnectTimer() {
      if (mpDisconnectTimer) {
        clearInterval(mpDisconnectTimer);
        mpDisconnectTimer = null;
      }
      try {
        if (window._soloOverlayIv) { clearInterval(window._soloOverlayIv); window._soloOverlayIv = null; }
      } catch (_) {}
      try {
        if (window._soloDeadlineTimer) { clearTimeout(window._soloDeadlineTimer); window._soloDeadlineTimer = null; }
      } catch (_) {}
      try {
        if (window._soloDialIv) { clearInterval(window._soloDialIv); window._soloDialIv = null; }
      } catch (_) {}
      oppDisconnected = false;
      dcDeadlineTs = 0;
      dcWasAfk = false;
      dcPausedByReconnect = false;
      oppDcAt = 0;
      myDcAt = 0;
      bothAwayMode = false;
      try { window._soloRejoinActive = false; } catch (_) {}
      hideDisconnectBanner();
      hideBoardDisconnectOverlay();
    }

    /** Resolve when disconnect wait ends. Supports dual-away score/timer rules. */
    function resolveDisconnectWin() {
      if (!vsActive || !mpMode) return;
      const wasAfk = dcWasAfk;
      const soloBack = !!window._soloRejoinActive;
      const bothAway = !soloBack && (bothAwayMode || (myDcAt > 0 && oppDcAt > 0));
      const myLeft = myDcAt || 0;
      const oppLeft = oppDcAt || 0;
      clearDisconnectTimer();
      stopAfkWatch();
      window._soloRejoinActive = false;
      const reason = wasAfk ? 'afk' : 'disconnect';

      // I returned to the match alone and opponent never came back → I win
      if (soloBack || !bothAway || !myLeft || !oppLeft) {
        endVersus({ forceWin: true, reason });
        return;
      }

      // Both still offline (snapshot resolve): simultaneous (±2s) → score; else earlier leave loses
      const SIMUL_MS = 2000;
      const leftDiff = Math.abs(myLeft - oppLeft);
      if (leftDiff <= SIMUL_MS) {
        if (score > oppScore) endVersus({ forceWin: true, reason });
        else if (score < oppScore) endVersus({ forceLoss: true, reason });
        else endVersus({ reason }); // draw
        return;
      }
      if (myLeft < oppLeft) {
        endVersus({ forceLoss: true, reason });
      } else {
        endVersus({ forceWin: true, reason });
      }
    }

    /** Offline resolve when rejoin window expired (both away / no peer).
     *  force=true skips the "window still open" guard (used by expiry timer). */
    function resolveBothAwayFromSnap(snap, force) {
      if (!snap || window._matchEnded) return false;
      const myLeft = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : snap.t;
      const oppLeft = (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) ? snap.oppLeftAt : 0;
      const myScore = (typeof snap.score === 'number') ? snap.score : 0;
      const oScore = (typeof snap.oppScore === 'number') ? snap.oppScore : 0;
      const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft : 120;
      const reconnectMs = Math.min(60000, Math.max(0, leftSec) * 1000);
      const now = Date.now();
      // My window still open → not yet time to auto-resolve (unless forced by timer)
      if (!force && (now - myLeft < reconnectMs)) return false;

      try { hideMatchRejoinPanel(); } catch (_) {}
      try {
        if (window._rejoinPanelTick) {
          clearInterval(window._rejoinPanelTick);
          window._rejoinPanelTick = null;
        }
      } catch (_) {}
      try {
        if (window._bothAwayResolveTimer) {
          clearTimeout(window._bothAwayResolveTimer);
          window._bothAwayResolveTimer = null;
        }
      } catch (_) {}

      // Restore boards + replay log before endVersus writes history
      try { restoreSnapState(snap); } catch (_) {}
      try {
        score = myScore;
        oppScore = oScore;
        vsTimeLeft = leftSec;
        vsDuration = snap.vsDuration || 120;
        oppName = snap.oppName || 'Соперник';
        mpMode = true;
        mode = 'versus';
        vsModeType = 'online';
        mpFromMatchmaking = !!snap.fromMM || !!snap.ranked;
        if (Array.isArray(snap.moves) && (!matchLog || !matchLog.length)) {
          matchLog = snap.moves.slice();
        }
      } catch (_) {}

      const reason = 'disconnect';
      vsActive = true;
      window._mpRejoiningMatch = false;
      window._soloRejoinActive = false;
      try {
        // Quiet: history + toast with result, no duel animation / result modal
        const q = { reason, silent: true, quiet: true };
        const byScore = () => {
          if (myScore > oScore) endVersus({ forceWin: true, ...q });
          else if (myScore < oScore) endVersus({ forceLoss: true, ...q });
          else endVersus({ ...q }); // draw
        };
        if (!oppLeft) {
          byScore();
        } else {
          const SIMUL_MS = 2000;
          if (Math.abs(myLeft - oppLeft) <= SIMUL_MS) {
            byScore();
          } else if (myLeft < oppLeft) {
            endVersus({ forceLoss: true, ...q });
          } else {
            endVersus({ forceWin: true, ...q });
          }
        }
      } catch (e) {
        console.warn('resolveBothAwayFromSnap', e);
      }
      try { clearLiveMatch(); } catch (_) {}
      return true;
    }

    function handleOpponentDisconnect() {
      if (window._matchEnded || !vsActive || !mpMode) return;
      // Already counting down disconnect — keep deadline (no reset / no extend)
      if (oppDisconnected && dcDeadlineTs) {
        oppDisconnected = true;
        dcPausedByReconnect = false;
        const left = Math.max(1, Math.ceil((dcDeadlineTs - Date.now()) / 1000));
        showBoardDisconnectOverlay(left);
        return;
      }
      if (oppDisconnected) return;

      const now = Date.now();
      const oppIdle = now - (lastOppActionTs || now);
      // If already in AFK window (idle ≥ warn), disconnect is AFK — no free extra minute
      const alreadyAfk = oppIdle >= AFK_WARN_MS;
      dcWasAfk = alreadyAfk;

      let waitMs;
      if (alreadyAfk) {
        // Finish remaining AFK time only (≤ 15s typically), capped by match clock
        const afkLeft = Math.max(0, AFK_LIMIT_MS - oppIdle);
        waitMs = Math.min(afkLeft, Math.max(0, (vsTimeLeft || 0) * 1000));
        // If essentially already timed out — resolve immediately
        if (waitMs < 500) {
          oppDisconnected = true;
          resolveDisconnectWin();
          return;
        }
      } else {
        // Clean disconnect while active: up to 60s, but never more than match time left
        waitMs = Math.min(DC_LIMIT_MS, Math.max(0, (vsTimeLeft || 0) * 1000));
        if (waitMs < 500) {
          oppDisconnected = true;
          resolveDisconnectWin();
          return;
        }
      }

      oppDisconnected = true;
      dcPausedByReconnect = false;
      oppDcAt = now;
      // If I already left (tab background / pending leave), this is both-away
      if (myDcAt > 0) bothAwayMode = true;
      dcDeadlineTs = now + waitMs;
      hideDisconnectBanner(); // bottom banner free for AFK self-warn; DC uses center
      const left = Math.ceil(waitMs / 1000);
      showBoardDisconnectOverlay(left);
      try { ensureLiveMatchAccept(); } catch (_) {}
      try { persistLiveMatch(); } catch (_) {}

      // Periodically dial opponent — catches them when they restore the same peer id
      let dcDialTick = 0;
      const tryDialRemote = () => {
        try {
          if (!vsActive || !mpMode || !oppDisconnected) return;
          if (mpConn && mpConn.open) return;
          if (!mpPeer || mpPeer.destroyed || !mpRemotePeerId) return;
          const c = mpPeer.connect(mpRemotePeerId, { reliable: true });
          if (!c) return;
          c.on('open', () => {
            try { acceptLiveMatchReconnect(c); } catch (_) {}
          });
        } catch (_) {}
      };

      if (mpDisconnectTimer) clearInterval(mpDisconnectTimer);
      mpDisconnectTimer = setInterval(() => {
        if (!vsActive || !mpMode) {
          clearDisconnectTimer();
          return;
        }
        const leftMs = dcDeadlineTs - Date.now();
        const leftSec = Math.ceil(leftMs / 1000);
        if (leftMs <= 0) {
          resolveDisconnectWin();
          return;
        }
        showBoardDisconnectOverlay(leftSec);
        dcDialTick++;
        if (dcDialTick % 8 === 0) tryDialRemote(); // ~ every 2s
      }, 250);
      setTimeout(tryDialRemote, 400);
    }

    function handleOpponentReconnectSignal() {
      if (!oppDisconnected) return;
      // Soft reconnect: keep deadline, stop showing as "offline" only after they PLACE
      dcPausedByReconnect = true;
      // Keep overlay visible with remaining time — timer does not reset
      const left = Math.max(0, Math.ceil((dcDeadlineTs - Date.now()) / 1000));
      if (left <= 0) {
        resolveDisconnectWin();
        return;
      }
      showBoardDisconnectOverlay(left);
      // Overlay title stays "Отсоединение" until first move clears it via noteOppAction
    }

    function noteMyAction() {
      lastMyActionTs = Date.now();
      if (afkBannerKind === 'me') {
        afkBannerKind = null;
        hideDisconnectBanner();
        hideBoardDisconnectOverlay('me');
      }
    }
    function noteOppAction() {
      lastOppActionTs = Date.now();
      // Real move ends disconnect / AFK wait
      if (oppDisconnected || dcDeadlineTs) {
        clearDisconnectTimer();
      }
      if (afkBannerKind === 'opp') {
        afkBannerKind = null;
        hideDisconnectBanner();
      }
    }

    function startAfkWatch() {
      stopAfkWatch();
      const now = Date.now();
      lastMyActionTs = now;
      lastOppActionTs = now;
      afkBannerKind = null;
      afkCheckTimer = setInterval(() => {
        if (window._matchEnded || !vsActive || !mpMode || replayMode) return;
        try { ensurePlayableIfLive(); } catch (_) {}
        // While opponent is offline / reconnecting, do not AFK-punish either side
        if (oppDisconnected && !dcPausedByReconnect) {
          try { lastMyActionTs = Date.now(); } catch (_) {}
          try { lastOppActionTs = Date.now(); } catch (_) {}
          return;
        }

        const now = Date.now();
        // No moves left = not AFK (waiting for opponent is legitimate)
        let myNoMoves = false, oppNoMoves = false;
        try {
          myNoMoves = !!playerStuck || (typeof playerHasMoves === 'function' && !playerHasMoves());
        } catch (_) {}
        try {
          oppNoMoves = !!aiStuck;
        } catch (_) {}
        // Freeze idle clocks while stuck so reconnect/wait does not punish
        if (myNoMoves) lastMyActionTs = now;
        if (oppNoMoves) lastOppActionTs = now;

        const myIdle = now - lastMyActionTs;
        const oppIdle = now - lastOppActionTs;

        // AFK is a real idle limit and must not shrink with the remaining match clock.
        // Otherwise, e.g. 5 seconds left in a 2-minute match could turn a normal idle
        // interval into a false AFK loss.
        const oppAfkLimit = AFK_LIMIT_MS;
        const myAfkLimit = AFK_LIMIT_MS;

        // While opponent is disconnected / solo rejoin wait — AFK does not apply to them
        const oppAfkDone = !oppDisconnected && !window._soloRejoinActive
          && !oppNoMoves && oppIdle >= oppAfkLimit && oppAfkLimit > 0;
        const myAfkDone = !myNoMoves && myIdle >= myAfkLimit && myAfkLimit > 0;
        // Both AFK: decide by score (0-0 → draw; higher score wins)
        if (oppAfkDone && myAfkDone) {
          afkBannerKind = null;
          hideDisconnectBanner();
          stopAfkWatch();
          clearDisconnectTimer();
          if (score > oppScore) endVersus({ forceWin: true, reason: 'afk' });
          else if (score < oppScore) endVersus({ forceLoss: true, reason: 'afk' });
          else endVersus({ reason: 'afk' }); // draw
          return;
        }
        if (oppAfkDone) {
          afkBannerKind = null;
          hideDisconnectBanner();
          stopAfkWatch();
          clearDisconnectTimer();
          endVersus({ forceWin: true, reason: 'afk' });
          return;
        }
        if (myAfkDone) {
          afkBannerKind = null;
          hideDisconnectBanner();
          stopAfkWatch();
          clearDisconnectTimer();
          endVersus({ forceLoss: true, reason: 'afk' });
          return;
        }

        // Bottom AFK warnings (not center). Skip if disconnect overlay is primary.
        if (!oppDisconnected) {
          if (!oppNoMoves && oppIdle >= AFK_WARN_MS && oppAfkLimit > AFK_WARN_MS) {
            afkBannerKind = 'opp';
            const left = Math.ceil((oppAfkLimit - oppIdle) / 1000);
            showDisconnectBanner(Math.max(1, left), 'afk');
          } else if (!myNoMoves && myIdle >= AFK_WARN_MS && myAfkLimit > AFK_WARN_MS) {
            afkBannerKind = 'me';
            const left = Math.ceil((myAfkLimit - myIdle) / 1000);
            // Only bottom banner — board stays fully visible (player may be thinking)
            showDisconnectBanner(Math.max(1, left), 'afk-me');
            try { hideBoardDisconnectOverlay('me'); } catch (_) {}
          } else if (afkBannerKind && (myNoMoves || oppNoMoves || (oppIdle < AFK_WARN_MS && myIdle < AFK_WARN_MS))) {
            afkBannerKind = null;
            hideDisconnectBanner();
            try { hideBoardDisconnectOverlay('me'); } catch (_) {}
          }
        }
      }, 500);
    }
    function stopAfkWatch() {
      if (afkCheckTimer) {
        clearInterval(afkCheckTimer);
        afkCheckTimer = null;
      }
      afkBannerKind = null;
    }

    function onMpMessage(data) {
      if (!data || !data.type) return;
      switch (data.type) {
        case 'hello':
          mpOppName = data.name || 'Соперник';
          mpOppConnected = true;
          if (data.rematchReconnect) {
            try { postMatchOnlineEligible = true; } catch (_) {}
          }
          if (typeof data.trophies === 'number') mpOppTrophies = data.trophies;
          if (data.avatarId && typeof data.avatarId === 'string') {
            try { window.mpOppAvatarId = data.avatarId; } catch (_) {}
          }
          try { updateVersusNameLabels(); } catch (_) {}
          if (typeof data.ready === 'boolean') mpOppReady = data.ready;
          if (typeof data.duration === 'number' && mpRole === 'guest') {
            mpLobbyDuration = data.duration;
            if (!vsDuration) vsDuration = data.duration;
          }
          // Opponent equipped skin + board field (visible on their side for us)
          if (data.skinId && typeof data.skinId === 'string') {
            try {
              window.mpOppSkinId = data.skinId;
              applyOppSkin(data.skinId);
            } catch (_) {}
          }
          if (data.boardId && typeof data.boardId === 'string') {
            try {
              window.mpOppBoardId = data.boardId;
              applyOppBoard(data.boardId);
            } catch (_) {}
          }
          // Rating gate handled in MM connect handshake; keep trophies for Elo
          if (data.mm && typeof data.trophies === 'number') {
            mpOppTrophies = data.trophies;
          }
          updateLobbyUI();
          if (document.getElementById('mmName') && mpOppName) {
            document.getElementById('mmName').textContent =
              mpOppName + (mpOppTrophies != null ? ' · 🏆 ' + mpOppTrophies : '');
          }
          break;
        case 'mm_reject':
          // Guest rejected by host rating — should be handled in mmTryJoinBucket
          break;
        case 'ready':
          mpOppReady = !!data.ready;
          updateLobbyUI();
          break;
        case 'duration':
          if (typeof data.duration === 'number') {
            mpLobbyDuration = data.duration;
            updateLobbyUI();
          }
          break;
        case 'match_load_begin':
          try { onMatchLoadBegin(data); } catch (_) {}
          break;
        case 'match_load_here':
          try { onMatchLoadHere(data); } catch (_) {}
          break;
        case 'match_load_bound':
          try { onMatchLoadBound(data); } catch (_) {}
          break;
        case 'match_load_go':
          try { onMatchLoadGo(data); } catch (_) {}
          break;
        case 'match_load_abort':
          try { onMatchLoadAbort(data); } catch (_) {}
          break;
        case 'pre_match_ping':
        case 'pre_match_pong':
          // legacy no-op
          break;
        case 'start_req':
          // Guest did not receive start — host re-sends if still in ranked handshake / lobby
          if (mpRole === 'host' && mpMode && !vsActive && !window._matchEnded) {
            try {
              mpSend({
                type: 'start',
                duration: vsDuration || (data && data.duration) || 120,
                boardId: equippedBoardId,
                skinId: equippedSkinId,
                hostName: myNickname,
                trophies
              });
            } catch (_) {}
            if (!vsActive && mpFromMatchmaking) {
              try { beginVersusMatchMp(true); } catch (_) {}
            }
          }
          break;
        case 'start':
          vsDuration = (data.duration === 60 || data.duration === 120 || data.duration === 180) ? data.duration : (mpLobbyDuration || 120);
          vsTimeLeft = vsDuration;
          vsModeType = 'online';
          mpMode = true;
          currentBot = null;
          oppName = data.hostName || mpOppName;
          if (typeof data.trophies === 'number') mpOppTrophies = data.trophies;
          if (data.boardId && typeof data.boardId === 'string') {
            try { window.mpOppBoardId = data.boardId; } catch (_) {}
          }
          if (data.skinId && typeof data.skinId === 'string') {
            try { window.mpOppSkinId = data.skinId; } catch (_) {}
          }
          if (data.lobby || mpRoomCode) {
            mpFromMatchmaking = false;
            mpGameSource = 'lobby';
          } else if (data.mm || mpGameSource === 'ranked') {
            mpFromMatchmaking = true;
            mpGameSource = 'ranked';
          }
          mpMatchStarting = true;
          closeRoomLobby();
          if (!mpLoading && !isMatchLoadActive()) {
            setTimeout(() => {
              try { beginVersusMatchMp(false); } catch (_) {}
            }, 100);
          }
          break;
        case 'place':
          if (replayMode || !vsActive) break;
          applyOppRemotePlace(data);
          break;
        case 'deal':
          if (replayMode || !vsActive) break;
          applyOppRemoteDeal(data);
          break;
        case 'stuck':
          setAiStuck(!!data.stuck);
          break;
        case 'leaving':
          // Peer closed tab / left intentionally
          if (vsActive && mpMode) {
            try {
              if (typeof data.score === 'number') oppScore = data.score;
              if (typeof data.vsTimeLeft === 'number') {
                // optional soft sync — do not extend our clock
              }
              if (typeof data.leftAt === 'number' && data.leftAt > 0) {
                oppDcAt = data.leftAt;
              }
            } catch (_) {}
            handleOpponentDisconnect();
            try {
              // Stamp known leave times into live snapshot for dual-away rejoin
              if (typeof persistLiveMatch === 'function') persistLiveMatch();
            } catch (_) {}
          }
          break;
        case 'match_rejoin':
          {
            // Live match OR both sides rejoining after dual leave
            const rejoinOk = mpMode && !window._matchEnded && (
              vsActive ||
              window._mpRejoiningMatch ||
              (typeof readLiveMatch === 'function' && !!readLiveMatch())
            );
            if (rejoinOk) {
              try {
                mpOppConnected = true;
                if (typeof data.score === 'number') oppScore = data.score;
                if (data.name) { mpOppName = data.name; oppName = data.name; }
                try { handleOpponentReconnectSignal(); } catch (_) {}
                // Send FULL state so rejoiner sees boards + trays
                const packPieces = (arr) => (arr || []).map(p => ({
                  shape: (p.shape || []).map(c => c.slice()),
                  color: p.color,
                  used: !!p.used
                }));
                const payload = {
                  type: 'match_rejoin_ok',
                  stillLive: true,
                  name: myNickname,
                  // local = sender; peer maps inverted
                  score: score,
                  oppScore: oppScore,
                  vsTimeLeft: vsTimeLeft,
                  grid: grid,
                  oppGrid: oppGrid,
                  pieces: packPieces(pieces),
                  oppPieces: packPieces(oppPieces),
                  boardId: equippedBoardId,
                  skinId: equippedSkinId
                };
                mpSend(payload);
                // Peer may still be wiring handlers — resend
                setTimeout(() => { try { mpSend(payload); } catch (_) {} }, 200);
              } catch (_) {}
            } else {
              try {
                mpSend({ type: 'match_over', reason: 'ended' });
                mpSend({ type: 'match_rejoin_ok', stillLive: false });
              } catch (_) {}
            }
          }
          break;
        case 'match_rejoin_ok':
          try {
            try { resolveRejoinAwait(data); } catch (_) {}
            // Probe replies are status-only
            if (data.probe) break;
            if (data.stillLive === false) {
              clearLiveMatch();
              hideMatchRejoinPanel();
              window._mpRejoiningMatch = false;
              try {
                if (vsActive) {
                  vsActive = false;
                  try { killAllMatchTimers(); } catch (_) {}
                  try { showScreen('menu'); updateMenuStats(); } catch (_) {}
                }
              } catch (_) {}
              setMpStatus('Матч уже завершён');
              try { showInfoToast('Матч', 'Матч уже завершён', 'bad'); } catch (_) {}
              break;
            }
            mpOppConnected = true;
            // Invert scores/boards/trays: sender's "me" is our "opp"
            if (typeof data.score === 'number') oppScore = data.score;
            if (typeof data.oppScore === 'number') score = data.oppScore;
            if (typeof data.vsTimeLeft === 'number') {
              vsTimeLeft = data.vsTimeLeft;
              try { updateTimerDisplay(); } catch (_) {}
            }
            try {
              document.getElementById('myScore').textContent = score;
              document.getElementById('oppScore').textContent = oppScore;
            } catch (_) {}

            // Do not wipe boards/trays while the player is dragging, or after we already
            // applied a full sync and they may have placed a piece.
            const dragging = !!(typeof isDragging !== 'undefined' && isDragging);
            const alreadySynced = !!window._rejoinStateApplied;
            // Apply full boards/trays only once — later packets must not wipe a just-placed piece
            const allowBoardSync = !dragging && !alreadySynced;

            let handsChanged = false;
            if (allowBoardSync) {
              if (Array.isArray(data.oppGrid)) {
                grid = data.oppGrid.map(row => row.slice());
                try { renderGrid(grid, boardMe); } catch (_) {}
              }
              if (Array.isArray(data.grid)) {
                oppGrid = data.grid.map(row => row.slice());
                try { renderGrid(oppGrid, boardOpp); } catch (_) {}
              }
              // Prefer richer hand — never let a thinner peer snapshot erase a local piece
              if (Array.isArray(data.oppPieces) && data.oppPieces.length) {
                const next = preferHand(pieces, data.oppPieces);
                if (next !== pieces) { pieces = next; handsChanged = true; }
              }
              if (Array.isArray(data.pieces) && data.pieces.length) {
                const nextOpp = preferHand(oppPieces, data.pieces);
                if (nextOpp !== oppPieces) { oppPieces = nextOpp; handsChanged = true; }
              }
              window._rejoinStateApplied = true;
            }
            // Cosmetics always — even if boards were already synced (fixes missing opp skins on rejoin)
            if (data.boardId && typeof applyOppBoard === 'function') {
              window.mpOppBoardId = data.boardId;
              try { applyOppBoard(data.boardId); } catch (_) {}
            }
            if (data.skinId && typeof applyOppSkin === 'function') {
              window.mpOppSkinId = data.skinId;
              try { applyOppSkin(data.skinId); } catch (_) {}
            }
            // Only recover from log if a side is still completely empty
            try {
              if ((!pieces || !pieces.length) || (!oppPieces || !oppPieces.length)) {
                const beforeMe = countUnusedHand(pieces);
                const beforeOpp = countUnusedHand(oppPieces);
                recoverHandsFromMatchLog();
                if (countUnusedHand(pieces) !== beforeMe || countUnusedHand(oppPieces) !== beforeOpp) {
                  handsChanged = true;
                }
              }
            } catch (_) {}

            handleOpponentReconnectSignal();
            try {
              // Full tray redraw only when hands actually changed or first sync
              if (allowBoardSync || handsChanged) {
                if (typeof boardMe !== 'undefined' && boardMe) renderGrid(grid, boardMe);
                if (typeof boardOpp !== 'undefined' && boardOpp) renderGrid(oppGrid, boardOpp);
                const area = document.getElementById('piecesAreaVs');
                if (area && typeof renderPieces === 'function') renderPieces(area);
                if (typeof renderOppPieces === 'function') renderOppPieces();
                try { applyBoardScales(); } catch (_) {}
              } else {
                // Repeat packets: cosmetics only — avoid flickering trays / losing a piece
                try { applyMatchCosmetics(); } catch (_) {}
              }
              if (allowBoardSync || handsChanged) {
                try { applyMatchCosmetics(); } catch (_) {}
              }
            } catch (_) {}
            if (vsActive || window._mpRejoiningMatch) persistLiveMatch();
            setMpStatus('Связь восстановлена');
            try { ensureMatchClockRunning(); } catch (_) {}
            try { ensurePlayableIfLive(); } catch (_) {}
          } catch (_) {}
          break;
        case 'match_over':
          try {
            const why = (data && data.reason) || 'forfeit';
            hideMatchRejoinPanel();
            if (!window._matchEnded) {
              const quiet = (typeof shouldQuietMatchEnd === 'function')
                ? shouldQuietMatchEnd()
                : !vsActive;
              try {
                const snap = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
                if (snap) {
                  try { restoreSnapState(snap); } catch (_) {}
                  if (Array.isArray(snap.moves) && (!matchLog || !matchLog.length)) {
                    try { matchLog = snap.moves.slice(); } catch (_) {}
                  }
                }
              } catch (_) {}
              if (!quiet) {
                vsActive = true;
                mpMode = true;
                mode = 'versus';
                vsModeType = 'online';
              }
              endVersus({ forceWin: true, reason: why, silent: true, quiet: quiet });
            } else {
              try { clearLiveMatch(); } catch (_) {}
            }
          } catch (_) {}
          break;
        case 'score':
          if (typeof data.score === 'number') {
            oppScore = data.score;
            document.getElementById('oppScore').textContent = oppScore;
          }
          break;
        case 'clear_fx':
          try {
            const cleared = typeof data.cleared === 'number' ? data.cleared : 0;
            if (cleared <= 0) break;
            if (typeof data.chain === 'number') oppClearChain = data.chain;
            else oppClearChain = (oppClearChain || 0) + 1;
            const bonus = typeof data.bonus === 'number'
              ? data.bonus
              : (bonusFor(cleared) + chainBonusFor(oppClearChain));
            const baseBonus = typeof data.baseBonus === 'number' ? data.baseBonus : bonusFor(cleared);
            const chainExtra = typeof data.chainExtra === 'number'
              ? data.chainExtra
              : chainBonusFor(oppClearChain);
            const rows = Array.isArray(data.rows) ? data.rows : [];
            const cols = Array.isArray(data.cols) ? data.cols : [];
            // Persist clear stats on last opp place for accurate replay score FX
            try {
              for (let i = matchLog.length - 1; i >= 0; i--) {
                const e = matchLog[i];
                if (e && e.type === 'place' && e.side === 'opp') {
                  e.cleared = cleared;
                  e.bonus = bonus;
                  e.baseBonus = baseBonus;
                  e.chainExtra = chainExtra;
                  e.chain = oppClearChain;
                  e.rows = rows.slice();
                  e.cols = cols.slice();
                  if (typeof data.score === 'number') e.oppScore = data.score;
                  else if (typeof oppScore === 'number') e.oppScore = oppScore;
                  e.myScore = score;
                  break;
                }
              }
            } catch (_) {}
            // Slight delay so place animation can finish; banner always on opp board
            setTimeout(() => {
              try {
                const _lp = window._lastOppPlace;
                const placeAnchor = _lp ? {
                  baseR: _lp.r, baseC: _lp.c,
                  centerR: _lp.r + ((_lp.maxR || 0) / 2),
                  centerC: _lp.c + ((_lp.maxC || 0) / 2)
                } : null;
                const positions = getClearFloatPositions(boardOpp, rows, cols, placeAnchor);
                const oppBanner = document.getElementById('comboBannerOpp')
                  || (boardOpp && boardOpp.parentElement && boardOpp.parentElement.querySelector('.combo-banner'));
                showCombo(oppBanner, cleared, bonus, boardOpp && boardOpp.parentElement, 'opp', {
                  chain: oppClearChain,
                  positions,
                  baseBonus,
                  chainExtra
                });
              } catch (_) {}
            }, 120);
          } catch (_) {}
          break;
        case 'end':
          {
            // Versus screen → full animation; menu / toast panel → quiet toast only
            const quiet = (typeof shouldQuietMatchEnd === 'function')
              ? shouldQuietMatchEnd()
              : !vsActive;
            const applyEnd = () => {
              try {
                if (typeof data.myScore === 'number') oppScore = Math.max(0, data.myScore);
                if (typeof data.oppScore === 'number') score = Math.max(0, data.oppScore);
                const myEl = document.getElementById('myScore');
                const oppEl = document.getElementById('oppScore');
                if (myEl) myEl.textContent = score;
                if (oppEl) oppEl.textContent = oppScore;
              } catch (_) {}
              if (window._matchEnded) return;
              const opts = {
                silent: true,
                quiet: quiet,
                reason: data.reason || 'disconnect'
              };
              if (data.youLose) endVersus({ forceLoss: true, ...opts });
              else if (data.youWin) endVersus({ forceWin: true, ...opts });
              else endVersus({ ...opts });
            };
            if (vsActive || isOnVersusScreen()) {
              if (data.youLose || data.youWin) applyEnd();
              else endVersus({ silent: true, quiet: quiet });
            } else if (!window._matchEnded && (data.youWin || data.youLose)) {
              // Menu / rejoin panel — toast only, stay where we are
              try {
                const snap = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
                if (snap) {
                  try { restoreSnapState(snap); } catch (_) {}
                }
              } catch (_) {}
              // Do NOT force vsActive/screen for quiet menu toast
              if (quiet) {
                applyEnd();
              } else {
                vsActive = true;
                mpMode = true;
                mode = 'versus';
                vsModeType = 'online';
                applyEnd();
              }
            }
          }
          break;
        case 'ping':
          handleOpponentReconnectSignal();
          mpSend({ type: 'pong', t: data.t });
          break;
        case 'pong':
          handleOpponentReconnectSignal();
          try {
            if (typeof data.t === 'number') {
              mpLastRtt = Math.max(1, Date.now() - data.t);
            } else if (mpPingSentAt) {
              mpLastRtt = Math.max(1, Date.now() - mpPingSentAt);
            }
            mpPingSentAt = 0;
            updateLobbyPingUI();
          } catch (_) {}
          break;
        case 'rematch_probe':
          // Pre-check: online + not busy before opponent sends invite
          try {
            mpSend({
              type: 'rematch_probe_reply',
              ok: true,
              busy: isRematchBusyLocal(),
              activity: (typeof detectMyActivity === 'function') ? detectMyActivity() : 'menu',
              name: myNickname
            });
          } catch (_) {}
          break;
        case 'rematch_probe_reply':
          try {
            if (typeof rematchProbeResolve === 'function') {
              const fn = rematchProbeResolve;
              rematchProbeResolve = null;
              fn({
                ok: !!(data && data.ok !== false),
                busy: !!(data && data.busy),
                activity: (data && data.activity) || null,
                name: (data && data.name) || null
              });
            }
          } catch (_) {}
          break;
        case 'ranked_search_start':
          // Opponent has chosen a fresh ranked search instead of a rematch.
          try {
            postMatchOnlineEligible = false;
            rematchPending = false;
            rematchIWant = false;
            rematchTheyWant = false;
            pendingRematchOfferName = null;
            hideRematchOffer();
            hideRematchWait();
          } catch (_) {}
          break;
        case 'rematch_invite':
          // If we are busy (new match / search), auto-decline
          if (isRematchBusyLocal()) {
            try {
              mpSend({ type: 'rematch_decline', name: myNickname, reason: 'busy' });
            } catch (_) {}
            break;
          }
          rematchTheyWant = true;
          if (rematchIWant) {
            // Both offered rematch → start with same timer
            pendingRematchOfferName = null;
            hideRematchOffer();
            hideRematchWait();
            try { mpSend({ type: 'rematch_accept', name: myNickname }); } catch (_) {}
            startRematchMatch();
          } else {
            const name = data.name || mpOppName || 'Соперник';
            // Always remember + try show; retry while UI is busy (score duel etc.)
            pendingRematchOfferName = name;
            tryShowPendingRematchOffer();
          }
          break;
        case 'rematch_accept':
          // Opponent accepted our invite
          rematchPending = false;
          rematchIWant = false;
          rematchTheyWant = false;
          startRematchMatch();
          break;
        case 'rematch_decline':
          {
            const reason = data && data.reason;
            let msg = null;
            if (reason === 'busy') msg = (data.name || 'Соперник') + ' занят';
            else if (reason === 'timeout') msg = 'Время предложения истекло';
            else if (data && data.name) msg = data.name + ' отклонил реванш';
            leaveAfterRematchDecline(msg);
          }
          break;
        case 'chat':
          showRemotePhrase(data.text);
          break;
      }
    }


    function updateVersusNameLabels() {
      const nick = (typeof myNickname === 'string' && myNickname.trim()) ? myNickname.trim() : 'Гость';
      const t = (typeof trophies === 'number') ? trophies : 0;
      const me = document.getElementById('myNameLabel');
      if (me) {
        me.innerHTML =
          '<span class="vs-me-av" id="vsMeAv"></span>' +
          '<span class="vs-me-nick" id="vsMeNick"></span>' +
          '<span id="vsMeCups" style="opacity:0.9;font-weight:700;font-size:0.72rem;margin-left:2px;color:var(--trophy);white-space:nowrap;flex-shrink:0">🏆 ' + t + '</span>';
        me.classList.add('vs-me-name', 'name');
        const avEl = document.getElementById('vsMeAv');
        const nickEl = document.getElementById('vsMeNick');
        if (nickEl) nickEl.textContent = nick;
        if (avEl) {
          try { renderAvatarInto(avEl, { avatarId: myAvatarId, nick: nick }); }
          catch (_) { avEl.textContent = (nick[0] || '?').toUpperCase(); }
        }
      }
      const opp = document.getElementById('oppName');
      if (!opp) return;
      if (currentBot && !mpMode) {
        // bot path: keep bot avatar HTML if already set; ensure cups visible
        return;
      }
      const nm = (oppName || mpOppName || 'Соперник').toString().slice(0, 20);
      let cups = null;
      if (typeof mpOppTrophies === 'number') cups = mpOppTrophies;
      else if (currentBot && typeof currentBot.trophies === 'number') cups = currentBot.trophies;
      const avId = window.mpOppAvatarId || 'init';
      opp.classList.add('vs-opp-name', 'name');
      opp.innerHTML =
        '<span class="vs-opp-av" id="vsOppAv"></span>' +
        '<span class="vs-opp-nick" id="vsOppNick"></span>' +
        (cups != null
          ? '<span style="opacity:0.9;font-weight:700;font-size:0.72rem;margin-left:2px;color:var(--trophy);white-space:nowrap;flex-shrink:0">🏆 ' + cups + '</span>'
          : '');
      const on = document.getElementById('vsOppNick');
      if (on) on.textContent = nm;
      const oa = document.getElementById('vsOppAv');
      if (oa) {
        try { renderAvatarInto(oa, { avatarId: avId, nick: nm }); }
        catch (_) { oa.textContent = (nm[0] || '?').toUpperCase(); }
      }
    }


    function leaveAfterRematchDecline(msg) {
      // Only dismiss rematch UI — result modal / field review stay open
      rematchPending = false;
      rematchIWant = false;
      rematchTheyWant = false;
      pendingRematchOfferName = null;
      const offer = document.getElementById('rematchOffer');
      const wait = document.getElementById('rematchWait');
      [offer, wait].forEach((el) => {
        if (!el || !el.classList.contains('visible')) return;
        el.classList.add('rematch-decline-out');
        setTimeout(() => {
          el.classList.remove('visible', 'rematch-decline-out');
        }, 280);
      });
      try { hideRmToast(true); } catch (_) {}
      // if neither visible, still clear
      setTimeout(() => {
        hideRematchOffer();
        hideRematchWait();
      }, 300);
      if (msg) {
        try { showInfoToast('Реванш', msg, 'bad'); } catch (_) {}
      }
    }

    
    let rematchClickCount = 0;
    const REMATCH_MAX_CLICKS = 2;

    function configurePostMatchButtons() {
      const btnR = document.getElementById('btnVsRematch');
      const btnA = document.getElementById('btnVsAgain');
      if (!btnR || !btnA) return;
      // Fresh result screen — allow up to 2 rematch requests
      rematchClickCount = 0;
      btnR.disabled = false;
      btnR.style.opacity = '';
      // Online match: always offer «Реванш» while post-match session is eligible
      // (even if peer briefly disconnected — requestRematch checks live link)
      const ranked = !!(
        mpGameSource === 'ranked' ||
        (lastMatchResult && lastMatchResult.ranked) ||
        (mpFromMatchmaking && mpGameSource !== 'lobby')
      );
      const onlineMatch = !!(postMatchOnlineEligible || (mpMode && vsModeType === 'online') || ranked ||
        (lastMatchResult && (lastMatchResult.mode === 'online' || lastMatchResult.mode === 'friendly')));
      const isBotMatch = vsModeType === 'bots' || (!!currentBot && !onlineMatch);
      if (onlineMatch && ranked) {
        btnR.style.display = '';
        btnR.textContent = 'Реванш';
        btnA.style.display = '';
        btnA.textContent = 'Ещё матч';
      } else if (onlineMatch) {
        btnR.style.display = '';
        btnR.textContent = 'Реванш';
        btnA.style.display = 'none';
      } else if (isBotMatch) {
        // Bot: rematch same bot immediately; other button picks another
        btnR.style.display = '';
        btnR.textContent = 'Реванш';
        btnA.style.display = '';
        btnA.textContent = 'Другой бот';
      } else {
        btnR.style.display = 'none';
        btnA.style.display = '';
        btnA.textContent = 'Ещё матч';
      }
    }

    function isScoreDuelVisible() {
      const duel = document.getElementById('scoreDuelOverlay');
      return !!(duel && duel.classList.contains('visible'));
    }

    let rematchOfferRetryTimer = null;
    function tryShowPendingRematchOffer() {
      if (!pendingRematchOfferName) return false;
      // Don't cover the score duel — wait until it is dismissed
      if (isScoreDuelVisible()) {
        if (rematchOfferRetryTimer) clearTimeout(rematchOfferRetryTimer);
        rematchOfferRetryTimer = setTimeout(() => {
          rematchOfferRetryTimer = null;
          tryShowPendingRematchOffer();
        }, 280);
        return false;
      }
      const name = pendingRematchOfferName;
      // Keep name until accepted/declined so retries work
      showRematchOffer(name);
      return true;
    }

    let rmToastHideTimer = null;
    let rmToastCountTimer = null;
    const REMATCH_TOAST_SEC = 15;
    /** Pending resolve for rematch_probe_reply */
    let rematchProbeResolve = null;
    let rematchProbeBusy = false;

    function noteMpRemotePeer(conn) {
      try {
        if (conn && conn.peer) mpRemotePeerId = conn.peer;
      } catch (_) {}
    }

    /** Wire data/close for an already-open match connection (MM or room). */
    function wireMpConnLifetime(conn) {
      if (!conn || conn._bpRematchWired) return;
      conn._bpRematchWired = true;
      noteMpRemotePeer(conn);
      conn.on('data', (data) => {
        try { mpOppConnected = true; } catch (_) {}
        try { onMpMessage(data); } catch (_) {}
      });
      conn.on('close', () => {
        try {
          if (mpConn === conn) {
            mpOppConnected = false;
          }
        } catch (_) {}
        if (vsActive && mpMode) {
          try { handleOpponentDisconnect(); } catch (_) {}
        } else if (mpMode && !vsActive && (isMatchLoadActive() || vsIntroLock || mode === 'versus' || mpLoading)) {
          try { abortPreMatchMissingPeer('Соперник отключился до старта'); } catch (_) {}
        } else if (postMatchOnlineEligible && !vsActive) {
          // Soft disconnect — do not destroy peer; opponent may return
          try {
            hideRematchWait();
            rematchPending = false;
            rematchIWant = false;
          } catch (_) {}
        }
      });
      try {
        if (conn.open) mpOppConnected = true;
      } catch (_) {}
    }

    /** Host: accept post-match reconnects on the existing peer. */
    function ensurePostMatchHostAccept() {
      if (!mpPeer || mpPeer.destroyed) return;
      if (mpPeer._bpPostMatchAccept) return;
      mpPeer._bpPostMatchAccept = true;
      mpPeer.on('connection', (conn) => {
        // Only for post-match rematch window — ignore during live search/match
        if (!postMatchOnlineEligible || vsActive || mmActive) return;
        noteMpRemotePeer(conn);
        const onOpen = () => {
          try {
            mpConn = conn;
            mpMode = true;
            mpOppConnected = true;
            wireMpConnLifetime(conn);
            mpSend({
              type: 'hello',
              name: myNickname,
              code: myFriendCode,
              trophies,
              avatarId: myAvatarId,
              skinId: equippedSkinId,
              boardId: equippedBoardId,
              rematchReconnect: true
            });
          } catch (_) {}
        };
        if (conn.open) onOpen();
        else conn.on('open', onOpen);
      });
    }

    /**
     * Ensure P2P link is alive before rematch probe.
     * If the data channel dropped but both peers are still in the game, reconnect.
     */
    function ensurePostMatchLink(timeoutMs) {
      timeoutMs = timeoutMs || 4500;
      if (mpIsLinked()) return Promise.resolve(true);
      if (!postMatchOnlineEligible && !(mpMode && vsModeType === 'online')) {
        return Promise.resolve(false);
      }
      // Need our peer + remote id to dial
      if (!mpPeer || mpPeer.destroyed || !mpRemotePeerId) {
        return Promise.resolve(false);
      }
      ensurePostMatchHostAccept();
      return new Promise((resolve) => {
        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          try { clearTimeout(timer); } catch (_) {}
          resolve(!!ok);
        };
        const timer = setTimeout(() => done(mpIsLinked()), timeoutMs);
        try {
          const conn = mpPeer.connect(mpRemotePeerId, { reliable: true });
          if (!conn) { done(false); return; }
          const onOpen = () => {
            try {
              mpConn = conn;
              mpMode = true;
              mpOppConnected = true;
              wireMpConnLifetime(conn);
              mpSend({
                type: 'hello',
                name: myNickname,
                code: myFriendCode,
                trophies,
                avatarId: myAvatarId,
                skinId: equippedSkinId,
                boardId: equippedBoardId,
                rematchReconnect: true
              });
            } catch (_) {}
            done(true);
          };
          if (conn.open) onOpen();
          else {
            conn.on('open', onOpen);
            conn.on('error', () => done(mpIsLinked()));
          }
        } catch (_) {
          done(false);
        }
      });
    }

        /** True if local player cannot accept a rematch right now.
     *  Busy ONLY when: searching for a match, in a live battle, in a room lobby,
     *  or training vs bots. Result screen / menu / shop / etc. = free. */
    function isRematchBusyLocal() {
      try {
        // 1) Live battle (online or vs bots)
        if (vsActive) return true;

        // 2) Searching for a fight (ranked matchmaking)
        if (typeof mmActive !== 'undefined' && mmActive) return true;
        const matchScreen = document.getElementById('screenMatch');
        if (matchScreen && matchScreen.classList.contains('active')) return true;

        // 3) In a multiplayer room / lobby
        const lobby = document.getElementById('roomLobby');
        if (lobby && lobby.classList.contains('visible')) return true;

        // 4) Training with bots — on bot pick / duration for bots, or bot versus screen
        //    (not post-match result / review of an online game)
        const onResult = (() => {
          const r = document.getElementById('versusResult');
          return !!(r && r.classList.contains('visible'));
        })();
        const onReview = document.body.classList.contains('replay-ui');
        if (!onResult && !onReview && !postMatchOnlineEligible) {
          const diff = document.getElementById('screenDifficulty');
          if (diff && diff.classList.contains('active')) return true;
          // Duration screen only counts as busy on the bots path
          if (vsModeType === 'bots' || currentBot) {
            const dur = document.getElementById('screenDuration');
            if (dur && dur.classList.contains('active')) return true;
            const vs = document.getElementById('screenVersus');
            if (vs && vs.classList.contains('active')) return true;
          }
        }
      } catch (_) {}
      return false;
    }

    function probeOpponentForRematch(timeoutMs) {
      timeoutMs = timeoutMs || 2500;
      return new Promise((resolve) => {
        if (!mpIsLinked()) {
          resolve({ ok: false, busy: false, offline: true });
          return;
        }
        // Clear any previous waiter
        if (typeof rematchProbeResolve === 'function') {
          try { rematchProbeResolve({ ok: false, busy: false, offline: true, cancelled: true }); } catch (_) {}
        }
        let settled = false;
        const done = (res) => {
          if (settled) return;
          settled = true;
          rematchProbeResolve = null;
          clearTimeout(timer);
          resolve(res);
        };
        rematchProbeResolve = (res) => done(res || { ok: false, busy: false });
        const timer = setTimeout(() => {
          done({ ok: false, busy: false, offline: true, timeout: true });
        }, timeoutMs);
        try {
          mpSend({ type: 'rematch_probe', name: myNickname });
        } catch (_) {
          done({ ok: false, busy: false, offline: true });
        }
      });
    }

    function clearRmToastTimers() {
      if (rmToastHideTimer) { clearTimeout(rmToastHideTimer); rmToastHideTimer = null; }
      if (rmToastCountTimer) { clearInterval(rmToastCountTimer); rmToastCountTimer = null; }
    }

    function hideRmToast(animate) {
      const toast = document.getElementById('rmToast');
      if (!toast) return;
      clearRmToastTimers();
      toast.style.transform = '';
      toast.style.opacity = '';
      if (animate === false) {
        toast.classList.remove('visible', 'out');
        return;
      }
      if (!toast.classList.contains('visible')) {
        toast.classList.remove('out');
        return;
      }
      toast.classList.add('out');
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.remove('out'), 400);
    }
    function showRmToast(fromName) {
      const toast = document.getElementById('rmToast');
      if (!toast) return;
      const nameEl = document.getElementById('rmToastName');
      const metaEl = document.getElementById('rmToastMeta');
      const avEl = document.getElementById('rmToastAv');
      const nm = (fromName || mpOppName || 'Соперник').toString();
      if (nameEl) nameEl.textContent = nm;
      if (metaEl) metaEl.textContent = 'Предлагает ещё один матч';
      if (avEl) {
        try {
          renderAvatarInto(avEl, {
            avatarId: window.mpOppAvatarId || null,
            nick: nm
          });
        } catch (_) {
          avEl.textContent = (nm.charAt(0) || '↻').toUpperCase();
        }
      }
      clearRmToastTimers();
      toast.classList.remove('out');
      void toast.offsetWidth;
      toast.classList.add('visible');
      // 15s auto-hide with live countdown; on expiry auto-decline
      rmToastCountTimer = startToastCountdown('rmToastCountdown', REMATCH_TOAST_SEC, null);
      rmToastHideTimer = setTimeout(() => {
        rmToastHideTimer = null;
        // Time expired — decline so requester is notified
        if (pendingRematchOfferName || rematchTheyWant) {
          pendingRematchOfferName = null;
          try {
            if (mpIsLinked()) mpSend({ type: 'rematch_decline', name: myNickname, reason: 'timeout' });
          } catch (_) {}
          rematchTheyWant = false;
        }
        hideRmToast(true);
      }, REMATCH_TOAST_SEC * 1000);
      try { SFX.ui && SFX.ui(); } catch (_) {}
      try { hapticTap(12); } catch (_) {}
    }
    function showRematchOffer(fromName) {
      // Always use top-right toast (works on result screen, menu, or next flow)
      showRmToast(fromName);
      // Keep legacy modal hidden — toast is the single UX
      try {
        const el = document.getElementById('rematchOffer');
        if (el) el.classList.remove('visible', 'rematch-decline-out', 'out');
      } catch (_) {}
    }
    function hideRematchOffer() {
      hideRmToast(false);
      const el = document.getElementById('rematchOffer');
      if (el) el.classList.remove('visible', 'rematch-decline-out', 'out');
    }
    function showRematchWait() {
      const el = document.getElementById('rematchWait');
      if (el) {
        el.classList.remove('rematch-decline-out', 'out');
        void el.offsetWidth;
        el.classList.add('visible');
      }
    }
    function hideRematchWait() {
      const el = document.getElementById('rematchWait');
      if (el) el.classList.remove('visible', 'rematch-decline-out', 'out');
    }
    async function requestRematch() {
      // Bot rematch: restart same bot immediately (no network)
      if (vsModeType === 'bots' || (currentBot && !(mpMode && mpConn && mpConn.open))) {
        document.getElementById('versusResult').classList.remove('visible');
        document.getElementById('reviewBar').classList.remove('visible');
        hideRematchOffer();
        hideRematchWait();
        beginVersusMatch();
        return;
      }
      if (rematchProbeBusy) return;
      if (rematchClickCount >= REMATCH_MAX_CLICKS) {
        const btnR = document.getElementById('btnVsRematch');
        if (btnR) {
          btnR.disabled = true;
          btnR.style.opacity = '0.45';
          btnR.textContent = 'Лимит реванша';
        }
        return;
      }
      // Probe: online + not busy — only then send invite
      rematchProbeBusy = true;
      const btnR0 = document.getElementById('btnVsRematch');
      const prevLabel = btnR0 ? btnR0.textContent : '';
      try {
        if (btnR0) {
          btnR0.disabled = true;
          btnR0.textContent = 'Проверка…';
        }
        // Re-establish data channel if opponent is back but link dropped
        try { ensurePostMatchHostAccept(); } catch (_) {}
        if (!mpIsLinked()) {
          const linked = await ensurePostMatchLink(4500);
          if (!linked || !mpIsLinked()) {
            try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
            return;
          }
        }
        const probe = await probeOpponentForRematch(2500);
        if (!probe || probe.offline || !probe.ok) {
          // One more reconnect attempt then re-probe
          let linked2 = mpIsLinked();
          if (!linked2) linked2 = await ensurePostMatchLink(3500);
          if (!linked2 || !mpIsLinked()) {
            try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
            return;
          }
          const probe2 = await probeOpponentForRematch(2500);
          if (!probe2 || probe2.offline || !probe2.ok) {
            try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
            return;
          }
          if (probe2.busy) {
            try { showInfoToast('Реванш', 'Соперник занят', 'bad'); } catch (_) {}
            return;
          }
          // fall through using probe2 success — set probe-like path
          rematchClickCount++;
          rematchIWant = true;
          rematchPending = true;
          mpSend({ type: 'rematch_invite', name: myNickname });
          showRematchWait();
          if (rematchTheyWant) {
            try { mpSend({ type: 'rematch_accept', name: myNickname }); } catch (_) {}
            startRematchMatch();
          }
          return;
        }
        if (probe.busy) {
          try { showInfoToast('Реванш', 'Соперник занят', 'bad'); } catch (_) {}
          return;
        }
        // Link may have dropped during probe
        if (!mpIsLinked()) {
          try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
          return;
        }
        rematchClickCount++;
        rematchIWant = true;
        rematchPending = true;
        mpSend({ type: 'rematch_invite', name: myNickname });
        // Do not close result / review — wait overlay is on top
        showRematchWait();
        if (rematchTheyWant) {
          try { mpSend({ type: 'rematch_accept', name: myNickname }); } catch (_) {}
          startRematchMatch();
        } else if (rematchClickCount >= REMATCH_MAX_CLICKS) {
          if (btnR0) {
            btnR0.disabled = true;
            btnR0.style.opacity = '0.45';
            btnR0.textContent = 'Лимит реванша';
          }
        }
      } finally {
        rematchProbeBusy = false;
        if (btnR0 && rematchClickCount < REMATCH_MAX_CLICKS && !rematchPending) {
          btnR0.disabled = false;
          btnR0.textContent = prevLabel || 'Реванш';
          btnR0.style.opacity = '';
        } else if (btnR0 && rematchPending && rematchClickCount < REMATCH_MAX_CLICKS) {
          btnR0.disabled = false;
          btnR0.textContent = prevLabel || 'Реванш';
          btnR0.style.opacity = '';
        }
      }
    }
    function startRematchMatch() {
      try { bumpAchStat('rematchPlayed', 1); } catch (_) {}
      hideRematchOffer();
      hideRematchWait();
      try { hideRmToast(false); } catch (_) {}
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      rematchClickCount = 0;
      pendingRematchOfferName = null;
      postMatchOnlineEligible = false; // in-match again; endVersus will re-arm
      try { if (mpMode) startAfkWatch(); } catch (_) {}
      try { dismissPostMatchResult(); } catch (_) {
        try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
        try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
      }
      clearDisconnectTimer();
      mpMatchStarting = false;
      vsIntroLock = false;
      currentBot = null;
      vsModeType = 'online';
      mpMode = true;
      // Host re-sends start so clocks sync
      if (mpRole === 'host') {
        mpSend({
          type: 'start',
          duration: vsDuration,
          boardId: equippedBoardId,
          skinId: equippedSkinId,
          hostName: myNickname,
          trophies
        });
        beginVersusMatchMp(true);
      }
      // guest waits for start message
    }

    function showRemotePhrase(text) {
      const el = document.getElementById('botSpeech');
      if (!el) return;
      const nameEl = el.querySelector('.bot-speech-name');
      const textEl = el.querySelector('.bot-speech-text');
      if (nameEl) nameEl.textContent = (mpOppName || 'Соперник') + ':';
      if (textEl) textEl.textContent = ' ' + text;
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 2800);
    }

    async function createMpRoom() {
      if (typeof Peer === 'undefined') {
        setMpStatus('PeerJS не загрузился. Нужен интернет.');
        return;
      }
      try { stopMatchmaking(true); } catch (_) {}
      try { closeRoomLobby(); } catch (_) {}
      const myGen = ++mpCreateGen;
      destroyMp();
      hideRjToast(false);
      mpPendingJoin = null;
      mpFromMatchmaking = false;
      mpGameSource = 'lobby';
      vsModeType = 'online';
      await delayMs(300);
      if (myGen !== mpCreateGen) return;

      const tryCreate = async (attempt) => {
        if (myGen !== mpCreateGen) return;
        const code = genCode(5);
        mpRoomCode = code;
        mpRole = 'host';
        mpMode = true;
        mpReady = false;
        mpOppReady = false;
        mpOppConnected = false;
        mpLobbyDuration = 120;
        mpMatchStarting = false;
        mpFromMatchmaking = false;
        mpGameSource = 'lobby';
        setMpStatus(attempt > 1 ? ('Повтор ' + attempt + '…') : 'Создаю комнату…');

        try {
          const peer = await openGamePeer(roomPeerId(code), { attempts: 4, timeoutMs: 12000 });
          if (myGen !== mpCreateGen) {
            try { peer.destroy(); } catch (_) {}
            return;
          }
          mpPeer = peer;
          setMpStatus('Комната ' + code + ' · ждут игрока');
          openRoomLobby();
          try { SFX.ui(); } catch (_) {}
          peer.on('connection', (conn) => {
            if (myGen !== mpCreateGen) {
              try { conn.close(); } catch (_) {}
              return;
            }
            handleHostIncomingConn(conn);
          });
          peer.on('error', (err) => {
            if (myGen !== mpCreateGen) return;
            const t = (err && err.type) || '';
            if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
              setMpStatus('Сбой (' + t + ') — повтор…');
              try { peer.destroy(); } catch (_) {}
              mpPeer = null;
              if (attempt < 5) setTimeout(() => tryCreate(attempt + 1), 900);
            }
          });
          peer.on('disconnected', () => {
            if (!mmGenAlive(gen)) return;
            try { if (peer && !peer.destroyed) peer.reconnect(); } catch (_) {}
          });
        } catch (err) {
          if (myGen !== mpCreateGen) return;
          const t = (err && err.type) || '';
          if (t === 'unavailable-id') {
            if (attempt < 6) setTimeout(() => tryCreate(attempt + 1), 250);
            return;
          }
          setMpStatus('Сеть: ' + (t || 'ошибка') + ' — повтор…');
          if (attempt < 5) setTimeout(() => tryCreate(attempt + 1), 800 + attempt * 400);
          else setMpStatus('Не удалось создать комнату. Обнови страницу.');
        }
      };
      tryCreate(1);
    }

    function joinMpRoom(code, opts) {
      opts = opts || {};
      const fromChallenge = !!opts.fromChallenge;
      if (typeof Peer === 'undefined') {
        setMpStatus('PeerJS не загрузился. Нужен интернет.');
        return;
      }
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 4) {
        setMpStatus('Введи код комнаты (5 символов)');
        return;
      }
      const myGen = ++mpJoinGen;
      destroyMp();
      hideRjToast(false);
      mpPendingJoin = null;

      mpRoomCode = code;
      mpRole = 'guest';
      mpMode = true;
      mpFromMatchmaking = false;
      mpGameSource = 'lobby';
      postMatchOnlineEligible = false;
      mmActive = false;
      mmFound = false;
      try { stopMatchmaking(true); } catch (_) {}
      try {
        document.getElementById('versusResult')?.classList.remove('visible');
      } catch (_) {}
      try { showScreen('friends'); } catch (_) {}
      mpReady = false;
      mpOppReady = false;
      mpOppConnected = false;
      mpLobbyDuration = 120;
      mpMatchStarting = false;
      mpFromMatchmaking = false;
      setMpStatus(fromChallenge ? ('Входим в комнату вызова ' + code + '…') : ('Ищем комнату ' + code + '…'));

      let settled = false;
      const fail = (msg) => {
        if (settled || myGen !== mpJoinGen) return;
        settled = true;
        failJoinRoom(msg, true);
      };

      delayMs(250).then(() => openGamePeer(null, { attempts: 4, timeoutMs: 12000 }))
        .then((peer) => {
          if (settled || myGen !== mpJoinGen) {
            try { peer.destroy(); } catch (_) {}
            return;
          }
          mpPeer = peer;
          setMpStatus('Подключаемся к ' + code + '…');
          let conn;
          try {
            conn = peer.connect(roomPeerId(code), { reliable: true });
          } catch (e) {
            fail('Комната «' + code + '» не найдена');
            return;
          }
          mpConn = conn;
          clearMpJoinTimer();
          mpJoinTimer = setTimeout(() => {
            if (!settled && !mpOppConnected) {
              fail('Комната не найдена или хост оффлайн.');
            }
          }, 16000);

          conn.on('open', () => {
            if (settled || myGen !== mpJoinGen) return;
            setMpStatus(fromChallenge ? 'Вход по вызову…' : 'Запрос хосту…');
            try {
              conn.send({
                type: 'join_req',
                name: myNickname,
                code: myFriendCode,
                trophies: typeof trophies === 'number' ? trophies : 0,
                fromChallenge: fromChallenge
              });
            } catch (_) {
              fail('Не удалось отправить запрос');
            }
          });
          conn.on('data', (data) => {
            if (conn._bpWired) return;
            if (settled || myGen !== mpJoinGen || !data || typeof data !== 'object') return;
            if (data.type === 'join_accept') {
              settled = true;
              clearMpJoinTimer();
              if (data.name) mpOppName = data.name;
              if (typeof data.trophies === 'number') mpOppTrophies = data.trophies;
              if (typeof data.duration === 'number') mpLobbyDuration = data.duration;
              setMpStatus(fromChallenge ? 'Вы в лобби ✓' : 'Хост пустил ✓');
              try {
                if (fromChallenge && chPending && String(chPending.room).toUpperCase() === String(code).toUpperCase()) {
                  chPending = null;
                  hideChToast(false);
                  renderFriendRequests();
                  updateFriendsSectionCounts();
                }
              } catch (_) {}
              wireMpConnection(conn, true);
              try { SFX.ui(); } catch (_) {}
            } else if (data.type === 'join_decline') {
              fail(data.reason === 'full' ? 'Комната занята' : 'Хост отклонил вход');
            }
          });
          conn.on('error', () => { if (!settled) fail('Комната не найдена'); });
          conn.on('close', () => {
            if (!settled && !mpOppConnected) fail('Комната не найдена или хост вышел');
          });
        })
        .catch(() => fail('Не удалось подключиться к сети. Проверь интернет.'));
    }

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
      theirCode = normalizeFriendCode(theirCode);
      if (!theirCode || typeof Peer === 'undefined') return;
      const payload = {
        type: 'friend_remove',
        code: myFriendCode,
        from: myFriendCode,
        name: myNickname,
        ts: Date.now()
      };
      let attempt = 0;
      const maxAttempts = 3;
      const tryOnce = () => {
        attempt++;
        openGamePeer(null, { attempts: 2, timeoutMs: 9000 }).then((peer) => {
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            try { peer.destroy(); } catch (_) {}
            // Retry later if peer was unavailable / no ack
            if (attempt < maxAttempts) {
              setTimeout(tryOnce, 1800 * attempt);
            }
          };
          const hardTimeout = setTimeout(finish, 7000);
          try {
            const conn = peer.connect(friendPeerId(theirCode), { reliable: true });
            conn.on('open', () => {
              try {
                conn.send(payload);
                // second packet shortly after — PeerJS occasionally drops first data
                setTimeout(() => {
                  try { if (conn.open) conn.send(payload); } catch (_) {}
                }, 180);
              } catch (_) {}
              // Keep link open briefly for ack
              setTimeout(() => {
                clearTimeout(hardTimeout);
                finish();
              }, 900);
            });
            conn.on('data', (data) => {
              if (data && data.type === 'friend_remove_ack') {
                // Delivered — stop further retries
                attempt = maxAttempts;
                clearTimeout(hardTimeout);
                finish();
              }
            });
            conn.on('error', () => { /* wait for timeout / retry */ });
            peer.on('error', (err) => {
              if (err && err.type === 'peer-unavailable') {
                clearTimeout(hardTimeout);
                finish();
              }
            });
          } catch (_) {
            clearTimeout(hardTimeout);
            finish();
          }
        }).catch(() => {
          if (attempt < maxAttempts) setTimeout(tryOnce, 2000 * attempt);
        });
      };
      tryOnce();
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

    let chPending = null; // { conn, room, name, code, trophies }
    let chHideTimer = null;
    let chCountTimer = null;
    let leaveMatchChallengeReq = null;

    // Lobby RTT
    let mpLastRtt = null;
    let mpPingTimer = null;
    let mpPingSentAt = 0;
    function stopLobbyPing() {
      if (mpPingTimer) { clearInterval(mpPingTimer); mpPingTimer = null; }
      mpPingSentAt = 0;
      mpLastRtt = null;
    }
    function startLobbyPing() {
      stopLobbyPing();
      if (!mpOppConnected) return;
      const tick = () => {
        if (!mpIsLinked() || !mpOppConnected) return;
        mpPingSentAt = Date.now();
        try { mpSend({ type: 'ping', t: mpPingSentAt }); } catch (_) {}
      };
      tick();
      mpPingTimer = setInterval(tick, 2000);
    }
    function updateLobbyPingUI() {
      const apply = (id, ms) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (ms == null || !mpOppConnected) {
          el.textContent = '';
          el.className = 'lobby-ping';
          return;
        }
        el.textContent = ms + ' мс';
        el.className = 'lobby-ping ' + (ms < 80 ? 'good' : ms < 160 ? 'mid' : 'bad');
      };
      apply('lobbyOppPing', mpLastRtt);
      apply('lobbyMePing', mpLastRtt);
    }

    // Compact top-right info toast (2s, swipe to dismiss)
    let infoHideTimer = null;
    function hideInfoToast(animate) {
      const toast = document.getElementById('infoToast');
      if (!toast) return;
      if (infoHideTimer) { clearTimeout(infoHideTimer); infoHideTimer = null; }
      toast.style.transform = '';
      toast.style.opacity = '';
      toast.classList.remove('dragging');
      if (animate === false) {
        toast.classList.remove('visible', 'out', 'ok', 'bad');
        return;
      }
      toast.classList.add('out');
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.remove('out', 'ok', 'bad'), 380);
    }
    function showInfoToast(label, text, kind) {
      const toast = document.getElementById('infoToast');
      if (!toast) return;
      const lab = document.getElementById('infoToastLabel');
      const tx = document.getElementById('infoToastText');
      if (lab) lab.textContent = label || '';
      if (tx) tx.textContent = text || '';
      toast.classList.remove('out', 'dragging', 'ok', 'bad');
      if (kind === 'ok') toast.classList.add('ok');
      else if (kind === 'bad') toast.classList.add('bad');
      toast.style.transform = '';
      toast.style.opacity = '';
      void toast.offsetWidth;
      toast.classList.add('visible');
      if (infoHideTimer) clearTimeout(infoHideTimer);
      infoHideTimer = setTimeout(() => {
        infoHideTimer = null;
        hideInfoToast(true);
      }, 2000);
    }
    (function bindInfoToastSwipe() {
      const toast = document.getElementById('infoToast');
      if (!toast) return;
      let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
      const onStart = (e) => {
        if (!toast.classList.contains('visible')) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        dragging = true;
        sx = t.clientX; sy = t.clientY; dx = 0; dy = 0;
        toast.classList.add('dragging');
      };
      const onMove = (e) => {
        if (!dragging) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        dx = t.clientX - sx;
        dy = t.clientY - sy;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) e.preventDefault();
        const x = Math.max(0, dx);
        const y = Math.min(0, dy);
        toast.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        toast.style.opacity = String(Math.max(0.25, 1 - Math.max(x, -y) / 120));
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        toast.classList.remove('dragging');
        if (dx > 56 || dy < -48) hideInfoToast(true);
        else {
          toast.style.transform = '';
          toast.style.opacity = '';
        }
        dx = 0; dy = 0;
      };
      toast.addEventListener('touchstart', onStart, { passive: true });
      toast.addEventListener('touchmove', onMove, { passive: false });
      toast.addEventListener('touchend', onEnd);
      toast.addEventListener('touchcancel', onEnd);
    })();

    function clearChHideTimer() {
      if (chHideTimer) { clearTimeout(chHideTimer); chHideTimer = null; }
      if (chCountTimer) { clearInterval(chCountTimer); chCountTimer = null; }
    }

    function hideChToast(animate) {
      const toast = document.getElementById('chToast');
      if (!toast) return;
      clearChHideTimer();
      toast.style.transform = '';
      toast.style.opacity = '';
      toast.classList.remove('dragging');
      if (animate === false) {
        toast.classList.remove('visible', 'out');
        return;
      }
      toast.classList.add('out');
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.remove('out'), 400);
    }

    let lastChToastKey = '';
    let lastChToastAt = 0;
    function showChToast(req) {
      const toast = document.getElementById('chToast');
      if (!toast || !req) return;
      const roomKey = String(req.room || '').toUpperCase();
      const inviterKey = normalizeFriendCode(req.code || '');
      const toastKey = roomKey + '|' + inviterKey;
      const samePending = chPending && String(chPending.room || '').toUpperCase() === roomKey;
      chPending = req;
      const av = document.getElementById('chToastAv');
      const name = document.getElementById('chToastName');
      const meta = document.getElementById('chToastMeta');
      if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
      if (name) name.textContent = req.name || 'Игрок';
      if (meta) {
        const parts = [];
        if (req.trophies != null) parts.push('🏆 ' + req.trophies);
        parts.push(vsActive ? 'зовёт в лобби (идёт матч)' : 'приглашает в лобби');
        if (req.room) parts.push('комната ' + req.room);
        meta.textContent = parts.join(' · ');
      }
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
      // Suppress double flash: same invite within 10s, or toast already visible for same room
      const recentlyShown = (toastKey === lastChToastKey && (Date.now() - lastChToastAt) < 10000);
      if ((samePending && toast.classList.contains('visible')) || recentlyShown) {
        return;
      }
      lastChToastKey = toastKey;
      lastChToastAt = Date.now();
      toast.style.transform = '';
      toast.style.opacity = '';
      toast.classList.remove('out', 'dragging');
      void toast.offsetWidth;
      toast.classList.add('visible');
      try { SFX.ui && SFX.ui(); } catch (_) {}
      try { hapticTap(18); } catch (_) {}
      clearChHideTimer();
      chCountTimer = startToastCountdown('chToastCountdown', 5, null);
      // Toast only — заявка остаётся в «Заявках» до отклонения / заполнения / удаления лобби
      chHideTimer = setTimeout(() => {
        chHideTimer = null;
        hideChToast(true);
      }, 5000);
    }

    function handleIncomingChallenge(data, conn) {
      if (!data || !data.room) return;
      const room = String(data.room).toUpperCase();
      if (mpOppConnected && !vsActive) {
        try { conn.send({ type: 'challenge_decline', reason: 'busy' }); } catch (_) {}
        return;
      }
      // Same room already pending — refresh conn only, no second toast/flash
      if (chPending && String(chPending.room || '').toUpperCase() === room) {
        chPending.conn = conn || chPending.conn;
        if (data.name) chPending.name = (data.name || chPending.name).toString().slice(0, 20);
        if (data.code) chPending.code = data.code;
        if (typeof data.trophies === 'number') chPending.trophies = data.trophies;
        try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
        return;
      }
      showChToast({
        conn,
        room,
        name: (data.name || 'Игрок').toString().slice(0, 20),
        code: data.code || '',
        trophies: typeof data.trophies === 'number' ? data.trophies : null
      });
    }

    function doAcceptChallengeJoin(req) {
      if (!req || !req.room) return;
      // Accepting a friend challenge must leave ranked search / post-match ranked session
      try { stopMatchmaking(true); } catch (_) {}
      mmActive = false;
      mmFound = false;
      postMatchOnlineEligible = false;
      mpFromMatchmaking = false;
      mpGameSource = 'lobby';
      try {
        document.getElementById('versusResult')?.classList.remove('visible');
        document.getElementById('reviewBar')?.classList.remove('visible');
      } catch (_) {}
      try {
        if (req.conn && req.conn.open) {
          req.conn.send({ type: 'challenge_accept', code: myFriendCode, name: myNickname, room: req.room });
        }
      } catch (_) {}
      joinMpRoom(req.room, { fromChallenge: true });
    }

    let pendingJoinAfterForfeit = null;

    function forfeitCurrentMatchForLobby() {
      if (!vsActive) return;
      try {
        if (mpMode) {
          try { mpSend({ type: 'end', reason: 'leave_for_lobby', youWin: true, youLose: false }); } catch (_) {}
        }
        endVersus({ forceLoss: true, reason: 'leave_for_lobby', silent: !!mpMode });
      } catch (_) {
        try { vsActive = false; } catch (_) {}
      }
    }

    function openLeaveMatchConfirm(req) {
      leaveMatchChallengeReq = req;
      const ov = document.getElementById('leaveMatchConfirm');
      const msg = document.getElementById('leaveMatchConfirmMsg');
      if (msg) {
        const who = (req && req.name) ? req.name : 'игроку';
        msg.textContent = 'Сейчас идёт матч. Если принять приглашение от «' + who +
          '», текущий матч будет засчитан как поражение. Точно присоединиться?';
      }
      if (ov) ov.classList.add('visible');
    }

    function closeLeaveMatchConfirm() {
      const ov = document.getElementById('leaveMatchConfirm');
      if (ov) ov.classList.remove('visible');
      leaveMatchChallengeReq = null;
    }

    function acceptChallenge() {
      const req = chPending;
      if (!req || !req.room) return;
      if (vsActive) {
        openLeaveMatchConfirm(req);
        return;
      }
      chPending = null;
      hideChToast(true);
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
      doAcceptChallengeJoin(req);
    }

    function declineChallenge() {
      const req = chPending;
      chPending = null;
      hideChToast(true);
      try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
      const payload = {
        type: 'challenge_decline',
        code: myFriendCode,
        name: myNickname,
        room: req && req.room
      };
      try {
        if (req && req.conn && req.conn.open) req.conn.send(payload);
      } catch (_) {}
      // Host's invite connection is short-lived — also deliver via their friend peer
      if (req && req.code) {
        (async () => {
          try {
            const client = await openGamePeer(null, { attempts: 2, timeoutMs: 6000 });
            let conn;
            try { conn = client.connect(friendPeerId(req.code), { reliable: true }); } catch (_) {
              try { client.destroy(); } catch (_) {}
              return;
            }
            const done = () => { try { client.destroy(); } catch (_) {} };
            const t = setTimeout(done, 5000);
            conn.on('open', () => {
              try { conn.send(payload); } catch (_) {}
              clearTimeout(t);
              setTimeout(done, 400);
            });
            conn.on('error', () => { clearTimeout(t); done(); });
            client.on('error', () => { clearTimeout(t); done(); });
          } catch (_) {}
        })();
      }
    }

    (function bindLeaveMatchConfirm() {
      const y = document.getElementById('btnLeaveMatchYes');
      const n = document.getElementById('btnLeaveMatchNo');
      if (y) y.addEventListener('click', () => {
        const req = leaveMatchChallengeReq || chPending;
        closeLeaveMatchConfirm();
        if (!req || !req.room) return;
        chPending = null;
        hideChToast(true);
        try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
        pendingJoinAfterForfeit = req;
        forfeitCurrentMatchForLobby();
      });
      if (n) n.addEventListener('click', () => {
        closeLeaveMatchConfirm();
        // stay in match, keep invite in list (don't decline) — user only cancelled leave
        // actually previous behavior declined; keep decline to free host "Ожидание"
        declineChallenge();
      });
    })();

    (function bindChToastSwipe() {
      const toast = document.getElementById('chToast');
      if (!toast || toast._bpSwipe) return;
      toast._bpSwipe = true;
      let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
      const onStart = (e) => {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        const t = e.touches ? e.touches[0] : e;
        startY = t.clientY;
        startX = t.clientX;
        dy = 0; dx = 0;
        dragging = true;
        toast.classList.add('dragging');
      };
      const onMove = (e) => {
        if (!dragging) return;
        const t = e.touches ? e.touches[0] : e;
        dy = t.clientY - startY;
        dx = t.clientX - startX;
        if (dx > 8 || dy < -8) {
          if (e.cancelable) e.preventDefault();
          const distX = Math.max(0, Math.min(dx, 200));
          const distY = Math.min(0, Math.max(dy, -120));
          toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
          toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
        }
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        toast.classList.remove('dragging');
        if (dx > 64 || dy < -56) {
          // Только скрыть тост — заявка остаётся в списке «Заявки»
          hideChToast(true);
        } else {
          toast.style.transform = '';
          toast.style.opacity = '';
        }
        dy = 0; dx = 0;
      };
      toast.addEventListener('touchstart', onStart, { passive: true });
      toast.addEventListener('touchmove', onMove, { passive: false });
      toast.addEventListener('touchend', onEnd);
      toast.addEventListener('touchcancel', onEnd);
    })();

    // Outgoing lobby invites: friendCode -> roomCode (host side)
    let lobbyInviteWait = {};
    function markLobbyInviteWait(friendCode, room) {
      const c = normalizeFriendCode(friendCode);
      const r = String(room || '').toUpperCase();
      if (!c || !r) return;
      lobbyInviteWait[c] = r;
    }
    function clearLobbyInviteWait(friendCode, room) {
      const c = normalizeFriendCode(friendCode || '');
      if (c && lobbyInviteWait[c]) {
        if (!room || String(lobbyInviteWait[c]).toUpperCase() === String(room).toUpperCase()) {
          delete lobbyInviteWait[c];
        }
        return;
      }
      if (room) {
        const ru = String(room).toUpperCase();
        Object.keys(lobbyInviteWait).forEach(k => {
          if (String(lobbyInviteWait[k]).toUpperCase() === ru) delete lobbyInviteWait[k];
        });
      }
    }
    function isLobbyInviteWaiting(friendCode, room) {
      const c = normalizeFriendCode(friendCode);
      if (!c || !lobbyInviteWait[c]) return false;
      if (room) return String(lobbyInviteWait[c]).toUpperCase() === String(room).toUpperCase();
      return true;
    }

    /** Host: tell pending invitees that lobby is gone / full */
    function notifyChallengeCancelled(room, reason) {
      const ru = String(room || '').toUpperCase();
      if (!ru) return;
      let targets = [];
      try {
        targets = Object.keys(lobbyInviteWait || {}).filter(
          k => String(lobbyInviteWait[k]).toUpperCase() === ru
        );
      } catch (_) { targets = []; }
      targets.forEach((friendCode) => {
        (async () => {
          try {
            const client = await openGamePeer(null, { attempts: 2, timeoutMs: 5000 });
            let conn;
            try { conn = client.connect(friendPeerId(friendCode), { reliable: true }); } catch (_) {
              try { client.destroy(); } catch (_) {}
              return;
            }
            const done = () => { try { client.destroy(); } catch (_) {} };
            const t = setTimeout(done, 4000);
            conn.on('open', () => {
              try {
                conn.send({
                  type: 'challenge_cancel',
                  room: ru,
                  reason: reason || 'closed',
                  code: myFriendCode,
                  name: myNickname
                });
              } catch (_) {}
              clearTimeout(t);
              setTimeout(done, 350);
            });
            conn.on('error', () => { clearTimeout(t); done(); });
            client.on('error', () => { clearTimeout(t); done(); });
          } catch (_) {}
        })();
      });
      try { clearLobbyInviteWait(null, ru); } catch (_) {}
      try { renderLobbyInviteList(); } catch (_) {}
    }

    async function challengeFriend(friend) {
      if (!friend || !friend.code) return;
      if (typeof Peer === 'undefined') {
        alert('Нужен интернет');
        return;
      }
      ensureFriendPresence();
      try { setFriendAddStatus('Создаём комнату для вызова…', 'wait'); } catch (_) {}

      // Drop ranked / post-match / search completely — challenge is always a private lobby
      try { stopMatchmaking(true); } catch (_) {}
      try { closeRoomLobby(); } catch (_) {}
      try {
        document.getElementById('versusResult')?.classList.remove('visible');
        document.getElementById('reviewBar')?.classList.remove('visible');
      } catch (_) {}
      const myGen = ++mpCreateGen;
      destroyMp();
      hideRjToast(false);
      mpPendingJoin = null;
      postMatchOnlineEligible = false;
      mpFromMatchmaking = false;
      mpGameSource = 'lobby';
      vsModeType = 'online';
      mmActive = false;
      mmFound = false;
      try { showScreen('friends'); } catch (_) {}
      await delayMs(200);
      if (myGen !== mpCreateGen) return;

      const code = genCode(5);
      mpRoomCode = code;
      mpRole = 'host';
      mpMode = true;
      mpReady = false;
      mpOppReady = false;
      mpOppConnected = false;
      mpLobbyDuration = 120;
      mpMatchStarting = false;
      mpFromMatchmaking = false;
      mpGameSource = 'lobby';
      mpExpectedJoinCode = normalizeFriendCode(friend.code);
      setMpStatus('Создаю комнату для вызова…');

      try {
        const peer = await openGamePeer(roomPeerId(code), { attempts: 4, timeoutMs: 12000 });
        if (myGen !== mpCreateGen) {
          try { peer.destroy(); } catch (_) {}
          return;
        }
        mpPeer = peer;
        setMpStatus('Комната ' + code + ' · зовём друга…');
        openRoomLobby();
        peer.on('connection', (conn) => {
          if (myGen !== mpCreateGen) {
            try { conn.close(); } catch (_) {}
            return;
          }
          handleHostIncomingConn(conn);
        });
        peer.on('error', (err) => {
          if (err && (err.type === 'network' || err.type === 'server-error')) {
            setMpStatus('Сбой сети комнаты');
          }
        });

        // Send challenge to friend presence
        const client = await openGamePeer(null, { attempts: 3, timeoutMs: 10000 });
        let sent = false;
        const done = () => {
          try { client.destroy(); } catch (_) {}
        };
        setTimeout(done, 12000);
        try {
          const conn = client.connect(friendPeerId(friend.code), { reliable: true });
          conn.on('open', () => {
            try {
              conn.send({
                type: 'challenge',
                room: code,
                name: myNickname,
                code: myFriendCode,
                trophies: typeof trophies === 'number' ? trophies : 0
              });
              sent = true;
              try { markLobbyInviteWait(friend.code, code); } catch (_) {}
              setMpStatus('Комната ' + code + ' · приглашение отправлено');
              try { setFriendAddStatus('Вызов отправлен — ждём ответа…', 'ok'); } catch (_) {}
            } catch (_) {}
            setTimeout(done, 800);
          });
          conn.on('data', (data) => {
            if (!data || typeof data !== 'object') return;
            if (data.type === 'challenge_decline') {
              try { clearLobbyInviteWait(friend.code, code); } catch (_) {}
              const who = (friend && friend.name) || friend.code || 'Друг';
              setMpStatus(who + ' отклонил вызов. Комната ' + code + ' всё ещё открыта.');
              try {
                showInfoToast('Приглашение отклонено', who + ' не принял вызов в комнату', 'bad');
                SFX.bad && SFX.bad();
              } catch (_) {}
              try { renderLobbyInviteList(); } catch (_) {}
            }
          });
          conn.on('error', done);
          client.on('error', (err) => {
            if (err && err.type === 'peer-unavailable') {
              setMpStatus((friend.name || friend.code) + ' не в сети. Комната ' + code + ' создана — можно пригласить другого.');
              try { setFriendPresence(friend.code, 'offline'); } catch (_) {}
              try { setFriendAddStatus((friend && friend.name ? friend.name + ' не в сети' : 'Друг не в сети'), 'err'); } catch (_) {}
              done();
            }
          });
        } catch (_) {
          done();
        }
      } catch (e) {
        setMpStatus('Не удалось создать комнату для вызова');
        try { setFriendAddStatus('Ошибка создания комнаты', 'err'); } catch (_) {}
      }
    }

    

    function toggleLobbyReady() {
      if (!mpRoomCode) return;
      mpReady = !mpReady;
      mpSend({ type: 'ready', ready: mpReady });
      updateLobbyUI();
    }

    function closeLobbyInviteModal() {
      const m = document.getElementById('lobbyInviteModal');
      if (m) m.classList.remove('visible');
    }

    function getLobbyInviteSearchQuery() {
      const el = document.getElementById('lobbyInviteSearch');
      return el ? (el.value || '').trim().toLowerCase() : '';
    }

    function renderLobbyInviteList() {
      const list = document.getElementById('lobbyInviteList');
      if (!list) return;
      if (!friends || !friends.length) {
        list.innerHTML = '<div class="lobby-invite-empty">Нет друзей — добавьте их во вкладке «Друзья»</div>';
        return;
      }
      const q = getLobbyInviteSearchQuery();
      const indexed = friends.map((f, i) => ({ f, i })).filter(({ f }) => {
        if (!q) return true;
        const name = (f.name || '').toLowerCase();
        const code = (f.code || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      });
      if (!indexed.length) {
        list.innerHTML = '<div class="lobby-invite-empty">Никого не найдено</div>';
        return;
      }
      list.innerHTML = indexed.map(({ f, i }) => {
        const initials = (f.name || f.code || '?').slice(0, 2).toUpperCase();
        const pres = getFriendPresence(f.code);
        const act = getFriendActivity(f.code);
        const dotCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking';
        let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
        if (pres === 'online' && act) stText = activityLabel(act);
        const stCls = pres === 'online' ? 'on' : '';
        const waiting = isLobbyInviteWaiting(f.code, mpRoomCode);
        const btnLabel = waiting ? 'Ожидание...' : 'Пригласить';
        const btnCls = waiting ? 'primary lobby-inv-btn waiting' : 'primary lobby-inv-btn';
        const btnDis = waiting ? ' disabled' : '';
        return `<div class="lobby-invite-item" data-code="${f.code}" data-fi="${i}">
          <div class="f-av">${initials}<span class="f-online-dot ${dotCls}"></span></div>
          <div class="f-info">
            <div class="f-name">${f.name || 'Друг'}</div>
            <div class="f-meta">${f.code} · <span class="f-status-line ${stCls}" style="display:inline">${stText}</span></div>
          </div>
          <button type="button" class="${btnCls}" data-fi="${i}"${btnDis}>${btnLabel}</button>
        </div>`;
      }).join('');
      list.querySelectorAll('.lobby-inv-btn:not(.waiting)').forEach(btn => {
        btn.addEventListener('click', () => {
          const f = friends[parseInt(btn.dataset.fi, 10)];
          if (f) inviteFriendToCurrentLobby(f, btn);
        });
      });
      try { refreshFriendsPresence(); } catch (_) {}
    }

    function openLobbyInviteModal() {
      if (!mpRoomCode) return;
      if (mpOppConnected) {
        // Room already full
        try { closeLobbyInviteModal(); } catch (_) {}
        return;
      }
      const search = document.getElementById('lobbyInviteSearch');
      if (search) search.value = '';
      renderLobbyInviteList();
      const m = document.getElementById('lobbyInviteModal');
      if (m) m.classList.add('visible');
      if (search) setTimeout(() => { try { search.focus(); } catch (_) {} }, 120);
    }

    function inviteFromLobby() {
      openLobbyInviteModal();
    }

    async function inviteFriendToCurrentLobby(friend, btnEl) {
      if (!friend || !friend.code || !mpRoomCode) return;
      if (typeof Peer === 'undefined') {
        setMpStatus('Нужен интернет');
        return;
      }
      const code = normalizeFriendCode(friend.code);
      if (isLobbyInviteWaiting(code, mpRoomCode)) {
        if (btnEl) {
          btnEl.disabled = true;
          btnEl.textContent = 'Ожидание...';
          btnEl.classList.add('waiting');
        }
        setMpStatus('Уже ждём ответ от ' + (friend.name || code));
        return;
      }
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '…';
      }
      setMpStatus('Приглашаем ' + (friend.name || code) + '…');
      try {
        const client = await openGamePeer(null, { attempts: 3, timeoutMs: 8000 });
        let sent = false;
        await new Promise((resolve) => {
          const finish = () => {
            try { client.destroy(); } catch (_) {}
            resolve();
          };
          const t = setTimeout(finish, 9000);
          let conn;
          try {
            conn = client.connect(friendPeerId(code), { reliable: true });
          } catch (_) {
            clearTimeout(t);
            finish();
            return;
          }
          conn.on('open', () => {
            try {
              conn.send({
                type: 'challenge',
                room: mpRoomCode,
                name: myNickname,
                code: myFriendCode,
                trophies: typeof trophies === 'number' ? trophies : 0
              });
              sent = true;
              setFriendPresence(code, 'online');
            } catch (_) {}
            clearTimeout(t);
            setTimeout(finish, 400);
          });
          conn.on('data', (data) => {
            if (!data || typeof data !== 'object') return;
            if (data.type === 'challenge_decline') {
              clearLobbyInviteWait(code, mpRoomCode);
              const who = friend.name || code;
              setMpStatus(who + ' отклонил приглашение');
              try {
                showInfoToast('Приглашение отклонено', who + ' не принял вызов в комнату', 'bad');
                SFX.bad && SFX.bad();
              } catch (_) {}
              try { renderLobbyInviteList(); } catch (_) {}
            } else if (data.type === 'challenge_accept') {
              clearLobbyInviteWait(code, mpRoomCode);
              setMpStatus((friend.name || code) + ' принял — ждём в лобби');
              try { renderLobbyInviteList(); } catch (_) {}
            }
          });
          conn.on('error', () => { clearTimeout(t); finish(); });
          client.on('error', () => { clearTimeout(t); finish(); });
        });
        if (sent) {
          markLobbyInviteWait(code, mpRoomCode);
          setMpStatus('Приглашение отправлено · ' + (friend.name || code));
          if (btnEl) {
            btnEl.textContent = 'Ожидание...';
            btnEl.disabled = true;
            btnEl.classList.add('waiting');
          }
          try { renderLobbyInviteList(); } catch (_) {}
          // keep modal open so host sees waiting state
        } else {
          setFriendPresence(code, 'offline');
          setMpStatus((friend.name || code) + ' сейчас не в сети');
          if (btnEl) { btnEl.textContent = 'Офлайн'; btnEl.disabled = false; btnEl.classList.remove('waiting'); }
        }
      } catch (_) {
        setMpStatus('Не удалось отправить приглашение');
        if (btnEl) { btnEl.textContent = 'Пригласить'; btnEl.disabled = false; btnEl.classList.remove('waiting'); }
      }
    }

    function joinRoomFlow() {
      const modal = document.getElementById('joinRoomModal');
      const input = document.getElementById('joinRoomInput');
      if (modal) modal.classList.add('visible');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
      }
    }
    function submitJoinRoom() {
      const input = document.getElementById('joinRoomInput');
      const code = (input && input.value || '').trim();
      if (!code) {
        alert('Введи код комнаты');
        return;
      }
      const modal = document.getElementById('joinRoomModal');
      if (modal) modal.classList.remove('visible');
      joinMpRoom(code);
    }

    /** Start versus for multiplayer (no AI) */
    // —— Match loading: presence + board bind before fight is live ——
    // Until loading finishes, exit = cancel match (no AFK, no history).
    let mpLoading = false;
    let _matchLoad = null; // state object

    function showMatchLoading(label, title, sub) {
      const el = document.getElementById('matchIntro');
      if (!el) return;
      const lab = document.getElementById('miLabel');
      const tit = document.getElementById('miTitle');
      const su = document.getElementById('miSub');
      if (lab) lab.textContent = label || 'Загрузка';
      if (tit) tit.textContent = title || 'Подключение…';
      if (su) su.textContent = sub || 'Проверяем, что оба игрока на месте';
      el.classList.remove('mi-go');
      el.classList.add('visible');
      el.setAttribute('aria-hidden', 'false');
      // Block interaction with boards underneath
      try { el.style.pointerEvents = 'auto'; } catch (_) {}
    }

    function updateMatchLoading(title, sub) {
      try {
        const tit = document.getElementById('miTitle');
        const su = document.getElementById('miSub');
        if (tit && title != null) tit.textContent = title;
        if (su && sub != null) su.textContent = sub;
      } catch (_) {}
    }

    function hideMatchLoading() {
      const el = document.getElementById('matchIntro');
      if (!el) return;
      el.classList.remove('visible', 'mi-go');
      el.setAttribute('aria-hidden', 'true');
    }

    function clearMatchLoadState() {
      try {
        if (_matchLoad) {
          if (_matchLoad.timer) clearTimeout(_matchLoad.timer);
          if (_matchLoad.hb) clearInterval(_matchLoad.hb);
          if (_matchLoad.retry) clearInterval(_matchLoad.retry);
        }
      } catch (_) {}
      _matchLoad = null;
      mpLoading = false;
    }

    function isMatchLoadActive() {
      return !!(mpLoading || (_matchLoad && !_matchLoad.finished));
    }

    /**
     * Online-only: show Загрузка, verify peer presence, prepare boards,
     * wait until BOTH sides report bound, then go live (vsActive + AFK/DC).
     * If peer leaves during this phase → cancel (ranked→search, friendly→lobby).
     */
    function beginVersusMatchMp(isHost) {
      try { document.body.classList.remove('vs-bots'); } catch (_) {}
      // Single-flight: never run loading twice for the same match
      if (mpLoading || isMatchLoadActive()) return;
      if (vsActive && mpMode) return;
      if (window._matchLoadCooldown && Date.now() < window._matchLoadCooldown) return;
      if (vsIntroLock && !mpLoading) return;
      vsIntroLock = true;
      try {
        window._matchEnded = false;
        window._rankedDeltaApplied = false;
        window._preMatchAborting = false;
        window._pendingIntroOppDeal = null;
      } catch (_) {}
      try { ensureLiveMatchAccept(); } catch (_) {}
      try { clearBoardScoreFX(); } catch (_) {}
      if (vsTimerId) clearInterval(vsTimerId);
      if (aiInterval) clearInterval(aiInterval);
      aiInterval = null;
      clearDisconnectTimer();
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      pendingRematchOfferName = null;
      rematchClickCount = 0;
      hideRematchOffer();
      hideRematchWait();
      document.body.classList.remove('replay-ui');
      const fbLive = document.getElementById('btnForfeit');
      if (fbLive) fbLive.style.display = '';

      // Offline / bots path should not use this function; still guard
      if (!mpMode) {
        _beginVersusMatchMpBody(isHost, { skipLoad: true });
        return;
      }

      // Must have a live data channel
      if (!mpConn || !mpConn.open) {
        vsIntroLock = false;
        abortPreMatchMissingPeer('Нет связи с соперником');
        return;
      }

      clearMatchLoadState();
      mpLoading = true;
      const ranked = !!mpFromMatchmaking;
      const loadId = 'ml_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      _matchLoad = {
        id: loadId,
        isHost: !!isHost,
        ranked,
        finished: false,
        peerHere: false,
        peerBound: false,
        meBound: false,
        goSent: false,
        goRecv: false,
        timer: null,
        hb: null,
        retry: null
      };

      // Stay on match/friends UI under the overlay — do NOT open versus yet
      try {
        if (ranked) {
          showScreen('match');
          mmSetStatus('Загрузка матча…', 'Проверка связи');
        }
      } catch (_) {}

      showMatchLoading(
        'Загрузка',
        'Подключение игроков…',
        ranked ? 'Рейтинговый матч' : 'Товарищеский матч'
      );

      // Notify peer we entered loading (covers race if only one side called begin)
      try {
        mpSend({
          type: 'match_load_begin',
          id: loadId,
          name: myNickname,
          trophies,
          ranked,
          duration: vsDuration,
          skinId: equippedSkinId,
          boardId: equippedBoardId,
          host: !!isHost
        });
      } catch (_) {}

      // Heartbeat while loading — if peer stops answering, cancel
      let missed = 0;
      const sendHere = () => {
        try {
          mpSend({
            type: 'match_load_here',
            id: loadId,
            name: myNickname,
            t: Date.now()
          });
        } catch (_) {}
      };
      sendHere();
      _matchLoad.hb = setInterval(() => {
        if (!_matchLoad || _matchLoad.finished) return;
        if (!mpConn || !mpConn.open) {
          abortPreMatchMissingPeer('Соперник отключился при загрузке');
          return;
        }
        sendHere();
        if (_matchLoad.peerHere) {
          missed = 0;
        } else {
          missed++;
          if (missed >= 6) {
            updateMatchLoading('Нет ответа…', 'Соперник не подтвердил присутствие');
          }
          if (missed >= 14) {
            abortPreMatchMissingPeer('Соперник не ответил при загрузке');
          }
        }
        // Peer was here but channel died
        if (_matchLoad.peerHere && (!mpConn || !mpConn.open)) {
          abortPreMatchMissingPeer('Соперник отключился при загрузке');
        }
      }, 500);

      // Absolute timeout for whole loading phase
      _matchLoad.timer = setTimeout(() => {
        if (!_matchLoad || _matchLoad.finished) return;
        abortPreMatchMissingPeer('Время загрузки истекло');
      }, 20000);

      // Wire close during load
      try {
        if (mpConn && !mpConn._bpLoadClose) {
          mpConn._bpLoadClose = true;
          mpConn.on('close', () => {
            if (isMatchLoadActive() && !vsActive) {
              abortPreMatchMissingPeer('Соперник отключился при загрузке');
            }
          });
        }
      } catch (_) {}

      // After short delay: if peer is here, prepare boards under the overlay
      const tryBind = () => {
        if (!_matchLoad || _matchLoad.finished || _matchLoad.meBound) return;
        if (!mpConn || !mpConn.open) {
          abortPreMatchMissingPeer('Соперник отключился при загрузке');
          return;
        }
        // Wait until peer confirmed presence (heartbeat / load_begin)
        if (!_matchLoad.peerHere) return;
        try {
          _prepareVersusBoardsUnderLoad();
          _matchLoad.meBound = true;
          mpSend({
            type: 'match_load_bound',
            id: loadId,
            name: myNickname,
            skinId: equippedSkinId,
            boardId: equippedBoardId
          });
        } catch (e) {
          console.warn('bind boards', e);
          abortPreMatchMissingPeer('Ошибка подготовки поля');
          return;
        }
        maybeFinishMatchLoad();
      };

      // Poll bind until peer here
      _matchLoad.retry = setInterval(() => {
        if (!_matchLoad || _matchLoad.finished) return;
        tryBind();
      }, 400);
      // First attempt soon
      setTimeout(tryBind, 350);
    }

    function _prepareVersusBoardsUnderLoad() {
      mode = 'versus';
      // Prepare DOM but keep loading overlay on top — player must not interact
      showScreen('versus');
      score = 0; oppScore = 0;
      vsTimeLeft = vsDuration;
      vsActive = false;
      placingLock = true; // lock until go
      aiBusy = false;
      playerStuck = false; aiStuck = false;
      clearChain = 0; oppClearChain = 0;
      matchLog = [];
      matchStartTs = Date.now();
      replayMode = false;

      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      createBoardDOM(boardMe);
      createBoardDOM(boardOpp);
      applyBoardScales();
      try {
        if (window.mpOppSkinId) applyOppSkin(window.mpOppSkinId);
        else clearOppSkin();
      } catch (_) {}
      try { applyEquippedBoard(); } catch (_) {}
      try {
        if (window.mpOppBoardId) applyOppBoard(window.mpOppBoardId);
        else clearOppBoard();
      } catch (_) {}
      renderGrid(grid, boardMe);
      renderGrid(oppGrid, boardOpp);

      document.getElementById('myScore').textContent = '0';
      document.getElementById('oppScore').textContent = '0';
      oppName = oppName || mpOppName || 'Соперник';
      try { updateVersusNameLabels(); } catch (_) {}
      document.getElementById('trophiesLive').textContent = trophies;
      document.getElementById('stuckWait').style.display = 'none';
      document.getElementById('oppStuckWait').style.display = 'none';
      document.getElementById('vsLiveControls').style.display = '';
      document.getElementById('vsFooter').style.display = '';
      const piecesEl = document.getElementById('piecesAreaVs');
      if (piecesEl) {
        piecesEl.style.opacity = '1';
        piecesEl.style.pointerEvents = 'none'; // locked until live
      }
      document.getElementById('botSpeech')?.classList.remove('visible');

      generatePieces(piecesEl);
      oppPieces = [];
      const oa = document.getElementById('piecesAreaOpp');
      if (oa) oa.innerHTML = '';
      updateBoardMetrics(boardMe);
      updateTimerDisplay();
      // Keep the same loading overlay — no second flash
      showMatchLoading(
        'Загрузка',
        'Подключение игроков…',
        rankedLabel()
      );
    }

    function rankedLabel() {
      try {
        if (_matchLoad && _matchLoad.ranked) return 'Рейтинговый матч';
        if (mpFromMatchmaking) return 'Рейтинговый матч';
      } catch (_) {}
      return 'Товарищеский матч';
    }

    function maybeFinishMatchLoad() {
      if (!_matchLoad || _matchLoad.finished) return;
      if (!_matchLoad.meBound || !_matchLoad.peerBound) return;
      if (!mpConn || !mpConn.open) {
        abortPreMatchMissingPeer('Соперник отключился при загрузке');
        return;
      }
      if (!_matchLoad.goSent) {
        _matchLoad.goSent = true;
        try {
          mpSend({
            type: 'match_load_go',
            id: _matchLoad.id,
            name: myNickname,
            duration: vsDuration
          });
        } catch (_) {}
      }
      _finishMatchLoadAndGoLive();
    }

    function _finishMatchLoadAndGoLive() {
      if (!_matchLoad || _matchLoad.finished) return;
      if (!_matchLoad.meBound || !_matchLoad.peerBound) return;
      if (!mpConn || !mpConn.open) {
        abortPreMatchMissingPeer('Соперник отключился перед стартом');
        return;
      }
      // Lock immediately so match_load_go cannot re-enter
      _matchLoad.finished = true;
      const loadSnap = _matchLoad;
      clearMatchLoadState();
      mpLoading = false;
      // Prevent a second loading sequence from late start / load_begin
      window._matchLoadCooldown = Date.now() + 5000;

      showMatchLoading('Загрузка', 'Старт!', rankedLabel());
      setTimeout(() => {
        hideMatchLoading();
        if (!mpConn || !mpConn.open) {
          abortPreMatchMissingPeer('Соперник отключился перед стартом');
          return;
        }
        window._matchEnded = false;
        vsActive = true;
        placingLock = false;
        matchStartTs = Date.now();
        const piecesEl = document.getElementById('piecesAreaVs');
        if (piecesEl) piecesEl.style.pointerEvents = '';
        try { startAfkWatch(); } catch (_) {}
        try { ensureLiveMatchAccept(); } catch (_) {}
        try {
          if (window._pendingIntroOppDeal) {
            const d = window._pendingIntroOppDeal;
            window._pendingIntroOppDeal = null;
            applyOppRemoteDeal(d);
          }
        } catch (_) {}
        try {
          if (pieces && pieces.length) {
            logDeal('me', pieces);
            mpSend({
              type: 'deal',
              pieces: pieces.map(p => {
                let sh = (p.shape || []).map(c => c.slice());
                try {
                  if (typeof normalize === 'function' && sh.length) sh = normalize(sh.map(c => c.slice()));
                } catch (_) {}
                return { shape: sh, color: p.color, used: false };
              })
            });
          }
        } catch (_) {}
        window._matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
        try { startMatchWallClock(window._matchClockEndTs); } catch (_) {}
        vsIntroLock = false;
        try { mpMatchStarting = false; } catch (_) {}
      }, 500);
    }

    /** Peer left during loading / before vsActive — cancel, no AFK, no history */
    function abortPreMatchMissingPeer(reason) {
      if (window._preMatchAborting) return;
      // Only cancel if fight has not become live yet
      if (vsActive && !mpLoading) return;
      window._preMatchAborting = true;
      clearMatchLoadState();
      try { hideMatchLoading(); } catch (_) {}
      try { vsIntroLock = false; } catch (_) {}
      try { vsActive = false; } catch (_) {}
      try { placingLock = false; } catch (_) {}
      try { mode = null; } catch (_) {}
      try { mpMatchStarting = false; } catch (_) {}
      try { window._matchLoadCooldown = 0; } catch (_) {}
      try { window._matchEnded = true; } catch (_) {}
      try { window._pendingIntroOppDeal = null; } catch (_) {}
      try {
        if (vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
        if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
      } catch (_) {}
      try { stopAfkWatch(); } catch (_) {}
      try { clearDisconnectTimer(); } catch (_) {}
      try { hideBoardDisconnectOverlay(); } catch (_) {}
      try { hideDisconnectBanner(); } catch (_) {}
      try { hideMatchRejoinPanel(); } catch (_) {}

      const ranked = !!mpFromMatchmaking;
      const room = mpRoomCode;

      // Tell peer we aborted (best-effort)
      try {
        if (mpConn && mpConn.open) {
          mpSend({ type: 'match_load_abort', reason: reason || 'abort' });
        }
      } catch (_) {}

      try {
        const t = document.getElementById('infoToast');
        if (t) {
          const lab = document.getElementById('infoToastLabel');
          const tx = document.getElementById('infoToastText');
          if (lab) lab.textContent = 'Матч отменён';
          if (tx) tx.textContent = reason || (ranked
            ? 'Соперник не подключился — новый поиск'
            : 'Соперник не подключился — возврат в комнату');
          t.classList.add('visible');
          clearTimeout(t._hide);
          t._hide = setTimeout(() => t.classList.remove('visible'), 2800);
        }
      } catch (_) {}

      if (ranked) {
        try { destroyMp(); } catch (_) {}
        mmFound = false;
        mmActive = false;
        try {
          window._preMatchAborting = false;
          startOnlineMatchmaking();
          mmSetStatus('Соперник не подключился', 'Ищем снова…');
        } catch (_) {
          window._preMatchAborting = false;
          try {
            showScreen('duration');
            mmSetStatus('Соперник не подключился', 'Попробуй поиск снова');
          } catch (_2) {}
        }
        return;
      }

      // Friendly: back to room lobby if possible
      try { showScreen('friends'); } catch (_) {}
      try {
        if (room) {
          const el = document.getElementById('roomLobby');
          if (el) el.classList.add('visible');
          mpReady = false;
          mpOppReady = false;
          try { mpSend({ type: 'ready', ready: false }); } catch (_) {}
          try { updateLobbyUI(); } catch (_) {}
        } else {
          try { destroyMp(); } catch (_) {}
        }
      } catch (_) {
        try { destroyMp(); } catch (_2) {}
      }
      window._preMatchAborting = false;
    }

    // Message handlers for loading protocol
    function onMatchLoadBegin(data) {
      if (!mpMode) return;
      if (data) {
        if (typeof data.duration === 'number') vsDuration = data.duration;
        if (typeof data.trophies === 'number') mpOppTrophies = data.trophies;
        if (data.name) { mpOppName = data.name; oppName = data.name; }
        if (data.skinId) try { window.mpOppSkinId = data.skinId; } catch (_) {}
        if (data.boardId) try { window.mpOppBoardId = data.boardId; } catch (_) {}
      }
      // Already loading — just mark peer present
      if (_matchLoad && !_matchLoad.finished) {
        _matchLoad.peerHere = true;
        try {
          mpSend({ type: 'match_load_here', id: _matchLoad.id, name: myNickname, t: Date.now(), ack: true });
        } catch (_) {}
        return;
      }
      // Join loading only once if peer started and we have not
      if (!vsActive && !window._matchEnded && !(window._matchLoadCooldown && Date.now() < window._matchLoadCooldown)) {
        if (!mpLoading && !vsIntroLock) {
          try { beginVersusMatchMp(false); } catch (_) {}
        }
      }
    }

    function onMatchLoadHere(data) {
      if (!_matchLoad || _matchLoad.finished) return;
      _matchLoad.peerHere = true;
      // Only reply to non-ack heartbeats to avoid infinite ping-pong
      if (data && data.ack) return;
      try {
        mpSend({
          type: 'match_load_here',
          id: _matchLoad.id,
          name: myNickname,
          t: Date.now(),
          ack: true
        });
      } catch (_) {}
    }

    function onMatchLoadBound(data) {
      if (!_matchLoad || _matchLoad.finished) return;
      _matchLoad.peerBound = true;
      _matchLoad.peerHere = true;
      if (data) {
        if (data.skinId) try { window.mpOppSkinId = data.skinId; applyOppSkin(data.skinId); } catch (_) {}
        if (data.boardId) try { window.mpOppBoardId = data.boardId; applyOppBoard(data.boardId); } catch (_) {}
        if (data.name) { mpOppName = data.name; oppName = data.name; try { updateVersusNameLabels(); } catch (_) {} }
      }
      maybeFinishMatchLoad();
    }

    function onMatchLoadGo(data) {
      if (!_matchLoad || _matchLoad.finished) return;
      _matchLoad.goRecv = true;
      _matchLoad.peerBound = true; // go implies peer is ready
      _matchLoad.peerHere = true;
      maybeFinishMatchLoad();
    }

    function onMatchLoadAbort(data) {
      if (vsActive && !mpLoading) return;
      try {
        abortPreMatchMissingPeer((data && data.reason) || 'Соперник отменил загрузку');
      } catch (_) {}
    }

    // Legacy stub — bots / non-mp still call body path through beginVersusMatchMp
    function _beginVersusMatchMpBody(isHost, opts) {
      opts = opts || {};
      // Used only for safety fallback (no mpMode)
      mode = 'versus';
      showScreen('versus');
      score = 0; oppScore = 0;
      vsTimeLeft = vsDuration;
      vsActive = false;
      placingLock = false;
      matchLog = [];
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      createBoardDOM(boardMe);
      createBoardDOM(boardOpp);
      applyBoardScales();
      renderGrid(grid, boardMe);
      renderGrid(oppGrid, boardOpp);
      generatePieces(document.getElementById('piecesAreaVs'));
      vsActive = true;
      vsIntroLock = false;
      try { startMatchWallClock(Date.now() + (vsDuration || 120) * 1000); } catch (_) {}
    }

    // Opp place anim in flight — queue places + deals so every move is shown in order
    let _oppPlaceAnimBusy = false;
    let _pendingOppDeal = null;
    let _pendingOppPlaces = [];

    function applyOppRemoteDeal(data) {
      if (!data || !data.pieces) return;
      if (typeof replayMode !== 'undefined' && replayMode) return;
      if (!vsActive) {
        if (mode === 'versus' && mpMode) {
          try { window._pendingIntroOppDeal = data; } catch (_) {}
        }
        return;
      }
      // Wait until current opp place is logged + tray collapse done
      if (_oppPlaceAnimBusy) {
        _pendingOppDeal = data;
        return;
      }
      oppPieces = data.pieces.map(p => {
        let sh = [[0, 0]];
        try {
          sh = (typeof cloneShapeCells === 'function')
            ? cloneShapeCells(p && p.shape)
            : (Array.isArray(p && p.shape) ? p.shape.map(c => Array.isArray(c) ? [+c[0] || 0, +c[1] || 0] : [0, 0]) : [[0, 0]]);
          if (typeof normalize === 'function' && sh.length) sh = normalize(sh.map(c => c.slice()));
        } catch (_) {
          sh = [[0, 0]];
        }
        if (!sh.length) sh = [[0, 0]];
        return {
          shape: sh,
          color: (p && p.color) ? String(p.color) : '#7c5cff',
          used: !!(p && p.used)
        };
      });
      renderOppPieces();
      if (vsActive) logDeal('opp', oppPieces);
    }

    function flushPendingOppDeal() {
      _oppPlaceAnimBusy = false;
      // Prefer queued places so each move anim plays in order
      if (_pendingOppPlaces && _pendingOppPlaces.length) {
        const next = _pendingOppPlaces.shift();
        try { applyOppRemotePlace(next); } catch (_) {}
        return;
      }
      if (!_pendingOppDeal) return;
      const d = _pendingOppDeal;
      _pendingOppDeal = null;
      try { applyOppRemoteDeal(d); } catch (_) {}
    }

    function applyOppRemotePlace(data) {
      if (!vsActive || !data.shape) return;
      // Queue while a previous fly is on screen — never skip a move
      if (_oppPlaceAnimBusy) {
        if (!_pendingOppPlaces) _pendingOppPlaces = [];
        _pendingOppPlaces.push(data);
        return;
      }
      // Lock immediately so concurrent messages cannot start a second fly
      _oppPlaceAnimBusy = true;
      try { if (typeof noteOppAction === 'function') noteOppAction(); } catch (_) {}
      // Keep opponent field theme in sync so clear FX match their equipped board
      try {
        if (data.boardId && data.boardId !== window.mpOppBoardId) {
          window.mpOppBoardId = data.boardId;
          if (typeof applyOppBoard === 'function') applyOppBoard(data.boardId);
        }
      } catch (_) {}
      // Normalize shape cells (PeerJS / JSON may alter numbers; keep same key as tray deals)
      let shape = [];
      try {
        const raw = Array.isArray(data.shape) ? data.shape : [];
        for (let i = 0; i < raw.length; i++) {
          const cell = raw[i];
          if (Array.isArray(cell) && cell.length >= 2) shape.push([+cell[0] || 0, +cell[1] || 0]);
        }
        if (typeof normalize === 'function' && shape.length) shape = normalize(shape);
      } catch (_) {
        shape = Array.isArray(data.shape) ? data.shape : [];
      }
      if (!shape.length) {
        _oppPlaceAnimBusy = false;
        try { flushPendingOppDeal(); } catch (_) {}
        return;
      }
      const color = data.color;
      const r = data.r, c = data.c;

      // Visual: lift matching slot → smooth fly to board (no tray rebuild flicker)
      const board = boardOpp;
      const boardRect = board.getBoundingClientRect();
      const gapSz = 2.5;
      const step = (boardRect.width - gapSz * (SIZE - 1)) / SIZE;
      const maxR = Math.max(...shape.map(s => s[0]));
      const maxC = Math.max(...shape.map(s => s[1]));
      const targetX = boardRect.left + (c + maxC / 2) * (step + gapSz) + step / 2;
      const targetY = boardRect.top + (r + maxR / 2) * (step + gapSz) + step / 2;

      let startX = targetX, startY = boardRect.bottom + 10;
      const tray = document.getElementById('piecesAreaOpp');
      let slotEl = null;
      // Prefer explicit pieceIdx from peer (same order as their deal); fallback to shape match
      let usedIdx = -1;
      if (typeof data.pieceIdx === 'number' && data.pieceIdx >= 0 &&
          oppPieces[data.pieceIdx] && !oppPieces[data.pieceIdx].used) {
        usedIdx = data.pieceIdx;
      } else {
        usedIdx = findOppTrayIdx(shape, color);
      }
      if (usedIdx >= 0 && tray) {
        slotEl = tray.querySelector('.piece-slot[data-opp-idx="' + usedIdx + '"]');
      }
      if (slotEl) {
        const sr = slotEl.getBoundingClientRect();
        startX = sr.left + sr.width / 2;
        startY = sr.top + sr.height / 2;
        slotEl.classList.add('lifting');
      } else if (tray) {
        const tr = tray.getBoundingClientRect();
        startX = tr.left + tr.width / 2;
        startY = tr.top + tr.height / 2;
      }

      // CRITICAL: log place + mark used IMMEDIATELY (before anim / before next deal arrives).
      // Previously matchLog.push ran after 520ms — new deal often logged first → broken replay hands.
      if (usedIdx >= 0 && oppPieces[usedIdx]) {
        oppPieces[usedIdx].used = true;
      } else if (oppPieces.length) {
        const u = oppPieces.find(p => p && !p.used);
        if (u) {
          u.used = true;
          if (usedIdx < 0) usedIdx = oppPieces.indexOf(u);
        }
      }
      if (typeof data.score === 'number') {
        oppScore = data.score;
        try { document.getElementById('oppScore').textContent = oppScore; } catch (_) {}
      }
      try {
        let logShape = shape.map(p => p.slice());
        if (typeof normalize === 'function') logShape = normalize(logShape.map(p => p.slice()));
        const placePts = (typeof data.placePts === 'number')
          ? data.placePts
          : (shape.length * 10);
        matchLog.push({
          type: 'place', side: 'opp', t: Date.now() - matchStartTs,
          shape: logShape,
          color, r, c,
          myScore: score, oppScore,
          pieceIdx: (typeof usedIdx === 'number' && usedIdx >= 0) ? usedIdx : -1,
          placePts,
          legendFx: !!(data && data.legendFx),
          skinId: (data && data.skinId) || window.mpOppSkinId || null
        });
      } catch (_) {}

      const ghost = document.getElementById('aiGhost');
      try { setAiGhostSkin('opp'); } catch (_) {}
      {
        const m = getBoardCellMetrics(board);
        ghost.innerHTML = buildPieceGhostHTML({ shape, color }, m.px, m.gap);
      }
      ghost.style.transition = 'none';
      ghost.style.left = startX + 'px';
      ghost.style.top = startY + 'px';
      ghost.style.display = 'block';
      ghost.style.opacity = '1';
      ghost.style.visibility = 'visible';
      ghost.style.zIndex = '50';
      void ghost.offsetWidth;
      ghost.style.transition =
        'left 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ghost.style.left = targetX + 'px';
          ghost.style.top = targetY + 'px';
        });
      });

      try {
        window._lastOppPlace = { r, c, maxR, maxC };
      } catch (_) {}
      setTimeout(() => {
        for (const [dr, dc] of shape) {
          if (oppGrid[r + dr]) oppGrid[r + dr][c + dc] = color;
          const cell = board.children[(r + dr) * SIZE + (c + dc)];
          if (cell) {
            paintCellColor(cell, color);
            cell.classList.add('filled', 'placing');
            setTimeout(() => cell.classList.remove('placing'), 780);
          }
        }
        // Legendary place sparks — must be visible on this client when opponent places
        try {
          const wantSpark = !!(data && data.legendFx) ||
            (document.querySelector('.player-panel.opp') &&
              document.querySelector('.player-panel.opp').classList.contains('skin-fx-prism'));
          if (wantSpark && typeof spawnLegendSparks === 'function') {
            const wrap = board.parentElement;
            const maxR = Math.max(...shape.map(s => s[0]));
            const maxC = Math.max(...shape.map(s => s[1]));
            const cell0 = board.children[r * SIZE + c];
            let origin = null;
            if (cell0 && wrap) {
              const cr = cell0.getBoundingClientRect();
              const wr = wrap.getBoundingClientRect();
              origin = {
                left: cr.left - wr.left + cr.width * (0.5 + maxC / 2),
                top: cr.top - wr.top + cr.height * (0.5 + maxR / 2)
              };
            }
            const skinForFx = (data && data.skinId) || window.mpOppSkinId || 'gold';
            spawnLegendSparks(wrap, 6 + shape.length, skinForFx, origin);
          }
        } catch (_) {}
        ghost.style.opacity = '0';
        setTimeout(() => { ghost.style.display = 'none'; }, 160);

        // Soft collapse matching tray slot — no full re-render (avoids flicker)
        if (slotEl) {
          slotEl.classList.remove('lifting', 'show');
          void slotEl.offsetWidth;
          slotEl.classList.add('used');
          try {
            slotEl.style.width = '0';
            slotEl.style.minWidth = '0';
            slotEl.style.maxWidth = '0';
            slotEl.style.height = '0';
            slotEl.style.opacity = '0';
            slotEl.style.margin = '0';
            slotEl.style.padding = '0';
            slotEl.style.border = 'none';
            slotEl.style.background = 'transparent';
            slotEl.style.boxShadow = 'none';
            slotEl.style.pointerEvents = 'none';
            setTimeout(() => { try { slotEl.innerHTML = ''; } catch (_) {} }, 280);
          } catch (_) {}
        } else if (tray) {
          try { renderOppPieces(); } catch (_) {}
        }

        // Clear in the same tick the piece lands on the board
        const clearInfo = clearLinesOn(oppGrid, boardOpp);
        if (!(clearInfo.count > 0)) {
          oppClearChain = 0;
          // Do NOT renderGrid here — cells already painted + placing anim must stay visible
        }
        onAiScoreChanged();
        flushPendingOppDeal();
      }, 400);
    }

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

    function totalBotStars() {
      let n = 0;
      try {
        for (const id of Object.keys(botStars || {})) n += getBotStarCount(id);
      } catch (_) {}
      return n;
    }
    function achCurrentValue(ach) {
      switch (ach.type) {
        case 'classicBest': return best;
        case 'wins': return getAchStat('wins');
        case 'onlineWins': return getAchStat('onlineWins');
        case 'trophies': return trophies;
        case 'beatBotMax': return getAchStat('beatWeak');
        case 'beatBotMin': return getAchStat('beatBotHighest');
        case 'beatCrown': return Math.max(getAchStat('beatCrown'), getAchStat('beatApex')); // legacy apex
        case 'beatSeer': return getAchStat('beatSeer');
        case 'megaCombo': return getAchStat('megaCombo');
        case 'combo2': return getAchStat('combo2');
        case 'combo3': return getAchStat('combo3');
        case 'combo5': return getAchStat('combo5');
        case 'combo6': return getAchStat('combo6');
        case 'combo7': return getAchStat('combo7');
        case 'combo8': return getAchStat('combo8');
        case 'combo10': return getAchStat('combo10');
        case 'linesCleared': return getAchStat('linesCleared');
        case 'matchesPlayed': return getAchStat('matchesPlayed');
        case 'botStars': return totalBotStars();
        case 'rankedBest': return (typeof rankedBest === 'number' ? rankedBest : 0);
        case 'skinsOwned': return (ownedSkins && ownedSkins.length) ? ownedSkins.length : getAchStat('skinsOwned');
        case 'skinsBought': return getAchStat('skinsBought');
        case 'reliefUsed': return getAchStat('reliefUsed');
        case 'blowoutWin': return getAchStat('blowoutWin');
        case 'clutchWin': return getAchStat('clutchWin');
        case 'botWins': return getAchStat('botWins');
        case 'winDur60': return getAchStat('winDur60');
        case 'winDur120': return getAchStat('winDur120');
        case 'winDur180': return getAchStat('winDur180');
        case 'friendsCount':
          try { return (typeof friends !== 'undefined' && Array.isArray(friends)) ? friends.length : getAchStat('friendsCount'); } catch (_) { return getAchStat('friendsCount'); }
        case 'diamondsHeld': return (typeof diamonds === 'number') ? diamonds : 0;
        case 'achClaimed':
          return ACHIEVEMENTS.filter(a => achProgress['claimed_' + a.id]).length;
        case 'profileNick': return getAchStat('profileNick');
        case 'profileAvatar': return getAchStat('profileAvatar');
        case 'profileCustom': return getAchStat('profileCustom');
        case 'profileStatus': return getAchStat('profileStatus');
        case 'boardsBought': return getAchStat('boardsBought');
        case 'boardsOwned':
          try { return (ownedBoards && ownedBoards.length) ? ownedBoards.length : getAchStat('boardsOwned'); } catch (_) { return getAchStat('boardsOwned'); }
        case 'boardsLegendary': return getAchStat('boardsLegendary');
        case 'winStreak': return Math.max(getAchStat('winStreak'), getAchStat('winStreakBest'));
        case 'comebackWin': return getAchStat('comebackWin');
        case 'rematchPlayed': return getAchStat('rematchPlayed');
                case 'allBotStars':
          try {
            const maxS = maxSilverStars();
            return (maxS > 0 && totalSilverStars() >= maxS) ? 1 : 0;
          } catch (_) { return 0; }
        case 'halfBotStars':
          try {
            const maxS = maxSilverStars();
            return (maxS > 0 && totalSilverStars() >= Math.ceil(maxS / 2)) ? 1 : 0;
          } catch (_) { return 0; }
        case 'perfectClassic': return getAchStat('perfectClassic');
        default: return 0;
      }
    }

    function achIsDone(ach) {
      if (ach.type === 'beatBotMax') return getAchStat('beatWeak') >= 1;
      if (ach.type === 'beatBotMin') return getAchStat('beatBotHighest') >= ach.target;
      if (ach.type === 'beatCrown') return getAchStat('beatCrown') >= 1 || getAchStat('beatApex') >= 1;
      if (ach.type === 'beatSeer') return getAchStat('beatSeer') >= 1;
      return achCurrentValue(ach) >= ach.target;
    }

    function achReadyToClaim(ach) {
      if (achProgress['claimed_' + ach.id]) return false;
      return achIsDone(ach);
    }

    function flashDiamonds(amount, nearEl) {
      // legacy no-op kept for safety; claim uses showAchClaimCeremony
    }

    let achClaimTimers = [];
    let achClaimOpen = false;
    function clearAchClaimTimers() {
      achClaimTimers.forEach(t => clearTimeout(t));
      achClaimTimers = [];
    }
    function closeAchClaim() {
      const ov = document.getElementById('achClaimOverlay');
      if (!ov) return;
      ov.classList.remove('visible', 'reward-in', 'burst', 'multi');
      ov.setAttribute('aria-hidden', 'true');
      achClaimOpen = false;
      clearAchClaimTimers();
    }
    function showAchClaimCeremony(ach, multiList) {
      const ov = document.getElementById('achClaimOverlay');
      if (!ov) return;
      const isMulti = Array.isArray(multiList) && multiList.length > 0;
      if (!isMulti && !ach) return;
      clearAchClaimTimers();
      ov.classList.remove('visible', 'reward-in', 'burst', 'multi');
      void ov.offsetWidth;

      const labelEl = document.getElementById('achClaimLabel');
      const titleEl = document.getElementById('achClaimTitle');
      const descEl = document.getElementById('achClaimDesc');
      const rewardEl = document.getElementById('achClaimReward');
      const listEl = document.getElementById('achClaimList');
      const countEl = document.getElementById('achClaimCount');
      const badgeEl = document.getElementById('achClaimBadge');

      if (isMulti) {
        ov.classList.add('multi');
        const total = multiList.reduce((s, a) => s + (a.reward || 0), 0);
        if (labelEl) labelEl.textContent = 'Награды собраны';
        if (badgeEl) badgeEl.textContent = '✨';
        if (titleEl) titleEl.textContent = multiList.length === 1
          ? (multiList[0].title || 'Достижение')
          : `${multiList.length} достижений`;
        if (descEl) {
          descEl.textContent = multiList.length > 1
            ? 'Все готовые награды зачислены'
            : (multiList[0].desc || '');
        }
        if (countEl) {
          countEl.style.display = '';
          countEl.textContent = `🏅 ${multiList.length} · итог`;
        }
        if (listEl) {
          listEl.style.display = multiList.length > 1 ? '' : 'none';
          listEl.innerHTML = multiList.map((a, i) => {
            const ico = (ACH_SECTIONS.find(s => s.id === a.section) || {}).icon || '🏅';
            return `<div class="ach-claim-list-item" style="animation-delay:${0.08 + i * 0.045}s">
              <span class="ai-ico">${ico}</span>
              <span>${a.title || 'Достижение'}</span>
              <span class="ai-reward">+${a.reward} 💎</span>
            </div>`;
          }).join('');
        }
        if (rewardEl) rewardEl.textContent = `+${total} 💎`;
      } else {
        if (labelEl) labelEl.textContent = 'Достижение получено';
        if (badgeEl) badgeEl.textContent = '✓';
        if (titleEl) titleEl.textContent = ach.title || 'Достижение';
        if (descEl) descEl.textContent = ach.desc || '';
        if (countEl) { countEl.style.display = 'none'; countEl.textContent = ''; }
        if (listEl) { listEl.style.display = 'none'; listEl.innerHTML = ''; }
        if (rewardEl) rewardEl.textContent = `+${ach.reward} 💎`;
      }

      const parts = document.getElementById('achClaimParticles');
      if (parts) {
        parts.innerHTML = '';
        const n = isMulti ? Math.min(28, 12 + multiList.length * 2) : 14;
        for (let i = 0; i < n; i++) {
          const s = document.createElement('span');
          const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
          const dist = 48 + Math.random() * (isMulti ? 90 : 70);
          s.style.left = '50%';
          s.style.top = '42%';
          s.style.setProperty('--tx', Math.cos(ang) * dist + 'px');
          s.style.setProperty('--ty', Math.sin(ang) * dist + 'px');
          s.style.animationDelay = (0.35 + Math.random() * 0.2) + 's';
          s.style.background = i % 3 === 0 ? 'var(--accent)' : (i % 3 === 1 ? 'var(--diamond)' : 'var(--trophy)');
          if (isMulti) {
            s.style.width = (5 + Math.random() * 4) + 'px';
            s.style.height = s.style.width;
          }
          parts.appendChild(s);
        }
      }
      ov.classList.add('visible');
      ov.setAttribute('aria-hidden', 'false');
      achClaimOpen = true;
      try { SFX.combo(); hapticTap(isMulti ? 22 : 18); } catch (_) {}
      achClaimTimers.push(setTimeout(() => {
        ov.classList.add('reward-in', 'burst');
        try { SFX.ui(); hapticTap(12); } catch (_) {}
      }, isMulti ? 480 : 380));
      achClaimTimers.push(setTimeout(() => {
        if (achClaimOpen) closeAchClaim();
      }, isMulti ? 5200 : 2800));
    }

    let claimAllBusy = false;
    function claimAllAchievements() {
      if (claimAllBusy || achClaimOpen) return;
      // Snapshot only currently claimable; each id granted at most once
      const ready = ACHIEVEMENTS.filter(a => achReadyToClaim(a));
      if (!ready.length) return;
      claimAllBusy = true;
      try {
        const btn = document.getElementById('btnClaimAllAch');
        if (btn) btn.disabled = true;

        const granted = [];
        let total = 0;
        const seen = new Set();
        for (const ach of ready) {
          if (!ach || !ach.id) continue;
          if (seen.has(ach.id)) continue;
          if (achProgress['claimed_' + ach.id]) continue;
          if (!achIsDone(ach)) continue;
          seen.add(ach.id);
          achProgress['claimed_' + ach.id] = 1;
          const reward = Math.max(0, parseInt(ach.reward, 10) || 0);
          total += reward;
          granted.push(ach);
        }
        if (!granted.length) {
          claimAllBusy = false;
          if (btn) btn.disabled = false;
          updateClaimAllButton();
          return;
        }
        diamonds = Math.max(0, (parseInt(diamonds, 10) || 0) + total);
        saveAch();
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
        updateMenuStats();
        try { if (diamondsEl) diamondsEl.textContent = diamonds; } catch (_) {}
        showAchClaimCeremony(null, granted);
        renderAchievements();
        updateAchievementsButton();
        updateClaimAllButton();
      } finally {
        // unlock after ceremony can be reopened (avoid double-tap race)
        setTimeout(() => {
          claimAllBusy = false;
          const btn = document.getElementById('btnClaimAllAch');
          if (btn) btn.disabled = false;
          try { updateClaimAllButton(); } catch (_) {}
        }, 600);
      }
    }

    function updateClaimAllButton() {
      const btn = document.getElementById('btnClaimAllAch');
      const meta = document.getElementById('achClaimAllMeta');
      const spacer = document.getElementById('achTopSpacer');
      if (!btn) return;
      const ready = ACHIEVEMENTS.filter(a => achReadyToClaim(a));
      if (!ready.length) {
        btn.style.display = 'none';
        if (spacer) spacer.style.display = '';
        return;
      }
      btn.style.display = '';
      if (spacer) spacer.style.display = 'none';
      const total = ready.reduce((s, a) => s + (a.reward || 0), 0);
      if (meta) meta.textContent = `+${total} 💎`;
      btn.title = ready.length === 1
        ? `Собрать 1 награду · +${total} 💎`
        : `Собрать все (${ready.length}) · +${total} 💎`;
    }
    document.getElementById('achClaimOverlay')?.addEventListener('click', () => {
      if (achClaimOpen) closeAchClaim();
    });

    function claimAchievement(achId, btnEl) {
      if (claimAllBusy || achClaimOpen) return;
      const ach = ACHIEVEMENTS.find(a => a.id === achId);
      if (!ach || achProgress['claimed_' + ach.id] || !achIsDone(ach)) return;
      achProgress['claimed_' + ach.id] = 1;
      const reward = Math.max(0, parseInt(ach.reward, 10) || 0);
      diamonds = Math.max(0, (parseInt(diamonds, 10) || 0) + reward);
      saveAch();
      try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
      updateMenuStats();
      try { if (diamondsEl) diamondsEl.textContent = diamonds; } catch(_){}
      showAchClaimCeremony(ach);
      renderAchievements();
      updateAchievementsButton();
      try { updateClaimAllButton(); } catch (_) {}
    }

    // —— Match end freeze (pause before score duel) ——
    let matchEndFreezeTimer = null;
    let matchEndFreezeResolve = null;
    function hideMatchEndFreeze() {
      const el = document.getElementById('matchEndFreeze');
      if (matchEndFreezeTimer) {
        try { clearTimeout(matchEndFreezeTimer); } catch (_) {}
        matchEndFreezeTimer = null;
      }
      try { document.body.classList.remove('match-ending'); } catch (_) {}
      if (el) {
        el.classList.remove('visible', 'mef-out', 'mef-time', 'mef-lose', 'mef-win', 'mef-draw');
        el.setAttribute('aria-hidden', 'true');
      }
      const r = matchEndFreezeResolve;
      matchEndFreezeResolve = null;
      if (r) {
        try { r(); } catch (_) {}
      }
    }
    /**
     * Freeze the board briefly so both players register that the match stopped.
     * Then score duel / result modal can play.
     */
    function showMatchEndFreeze(opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        try {
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            resolve();
            return;
          }
        } catch (_) {}
        // Skip only when user disabled match intro (same "cinematic" preference)
        try {
          if (settings && settings.matchIntro === '0') { resolve(); return; }
        } catch (_) {}

        const el = document.getElementById('matchEndFreeze');
        if (!el) { resolve(); return; }

        // Cancel any previous freeze
        if (matchEndFreezeTimer) {
          try { clearTimeout(matchEndFreezeTimer); } catch (_) {}
          matchEndFreezeTimer = null;
        }
        if (matchEndFreezeResolve) {
          const prev = matchEndFreezeResolve;
          matchEndFreezeResolve = null;
          try { prev(); } catch (_) {}
        }
        matchEndFreezeResolve = resolve;

        const reason = (opts.reason || 'normal') + '';
        const timeUp = !!opts.timeUp || (typeof opts.timeLeft === 'number' && opts.timeLeft <= 0);
        const my = Math.max(0, opts.my | 0);
        const opp = Math.max(0, opts.opp | 0);
        const won = !!opts.won;
        const draw = !!opts.draw;

        let label = 'Матч';
        let title = 'Конец';
        let sub = 'Игра остановлена';
        el.classList.remove('mef-time', 'mef-lose', 'mef-win', 'mef-draw');

        if (reason === 'forfeit') {
          title = 'Сдача';
          sub = won ? 'Соперник сдался' : 'Ты сдался';
          if (!won) el.classList.add('mef-lose');
          else el.classList.add('mef-win');
        } else if (reason === 'disconnect') {
          title = 'Обрыв связи';
          sub = won ? 'Соперник отключился' : 'Соединение потеряно';
        } else if (reason === 'afk') {
          title = 'АФК';
          sub = 'Ход не сделан вовремя';
        } else if (timeUp) {
          title = 'Время!';
          sub = 'Время матча истекло';
          el.classList.add('mef-time');
          label = 'Таймер';
        } else {
          title = 'Конец';
          sub = 'Больше нет ходов';
        }

        if (draw) el.classList.add('mef-draw');
        else if (won) el.classList.add('mef-win');
        else if (reason !== 'forfeit' || !won) {
          if (!won && reason !== 'disconnect') el.classList.add('mef-lose');
        }

        const labEl = document.getElementById('mefLabel');
        const titleEl = document.getElementById('mefTitle');
        const subEl = document.getElementById('mefSub');
        const scMe = document.getElementById('mefScoreMe');
        const scOpp = document.getElementById('mefScoreOpp');
        if (labEl) labEl.textContent = label;
        if (titleEl) titleEl.textContent = title;
        if (subEl) subEl.textContent = sub;
        if (scMe) scMe.textContent = String(my);
        if (scOpp) scOpp.textContent = String(opp);

        try { document.body.classList.add('match-ending'); } catch (_) {}
        el.classList.remove('mef-out');
        el.classList.add('visible');
        el.setAttribute('aria-hidden', 'false');
        try { hapticTap(16); } catch (_) {}
        try { SFX.ui && SFX.ui(); } catch (_) {}

        const hold = Math.min(2400, Math.max(1400, opts.ms || 1750));
        matchEndFreezeTimer = setTimeout(() => {
          matchEndFreezeTimer = null;
          el.classList.add('mef-out');
          setTimeout(() => {
            try { document.body.classList.remove('match-ending'); } catch (_) {}
            el.classList.remove('visible', 'mef-out', 'mef-time', 'mef-lose', 'mef-win', 'mef-draw');
            el.setAttribute('aria-hidden', 'true');
            const r = matchEndFreezeResolve;
            matchEndFreezeResolve = null;
            if (r) {
              try { r(); } catch (_) {}
            }
          }, 320);
        }, hold);
      });
    }

    // —— Score duel after match ——
    let scoreDuelTimers = [];
    let scoreDuelResolve = null;
    let scoreDuelSkippable = false;
    // Guards against late showResultModal after user already left (menu / again)
    let resultModalEpoch = 0;
    let resultModalSafetyTimer = null;
    window._resultDismissed = false;
    function clearScoreDuelTimers() {
      scoreDuelTimers.forEach(t => clearTimeout(t));
      scoreDuelTimers = [];
    }
    /** Cancel pending result modal + score duel (user went to menu / started new match). */
    function dismissPostMatchResult() {
      window._resultDismissed = true;
      resultModalEpoch++;
      if (resultModalSafetyTimer) {
        try { clearTimeout(resultModalSafetyTimer); } catch (_) {}
        resultModalSafetyTimer = null;
      }
      try { hideMatchEndFreeze(); } catch (_) {}
      try {
        const ov = document.getElementById('scoreDuelOverlay');
        if (ov) {
          ov.classList.remove('visible', 'show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
          ov.setAttribute('aria-hidden', 'true');
        }
      } catch (_) {}
      clearScoreDuelTimers();
      scoreDuelSkippable = false;
      const r = scoreDuelResolve;
      scoreDuelResolve = null;
      // Resolve after epoch bump so any .then(showResultModal) is a no-op
      if (r) {
        try { r(); } catch (_) {}
      }
      try {
        document.getElementById('versusResult').classList.remove('visible');
      } catch (_) {}
      try {
        document.getElementById('reviewBar').classList.remove('visible');
      } catch (_) {}
    }
    function finishScoreDuel() {
      const ov = document.getElementById('scoreDuelOverlay');
      if (ov) {
        ov.classList.remove('visible', 'show-verdict');
        ov.setAttribute('aria-hidden', 'true');
      }
      clearScoreDuelTimers();
      scoreDuelSkippable = false;
      const r = scoreDuelResolve;
      scoreDuelResolve = null;
      if (r) r();
      // After duel closes, surface any rematch invite that arrived during it
      setTimeout(() => {
        try { tryShowPendingRematchOffer(); } catch (_) {}
      }, 50);
    }
    function animateCount(el, to, ms) {
      if (!el) return;
      const start = performance.now();
      const from = 0;
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from + (to - from) * ease);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = to;
      };
      requestAnimationFrame(step);
    }

    function spawnDuelConfetti(ov) {
      if (!ov) return;
      try { if (settings && settings.confetti === '0') return; } catch (_) {}
      let box = ov.querySelector('.score-duel-confetti');
      if (!box) {
        box = document.createElement('div');
        box.className = 'score-duel-confetti';
        ov.appendChild(box);
      }
      box.innerHTML = '';
      const colors = ['#00d4aa','#7c5cff','#ffd666','#5ee7ff','#ff5c7a','#ff9f43','#c77dff'];
      for (let i = 0; i < 28; i++) {
        const b = document.createElement('b');
        b.style.left = (8 + Math.random() * 84) + '%';
        b.style.background = colors[i % colors.length];
        b.style.width = (6 + Math.random() * 6) + 'px';
        b.style.height = (6 + Math.random() * 8) + 'px';
        b.style.animationDelay = (Math.random() * 0.35) + 's';
        b.style.animationDuration = (1.1 + Math.random() * 0.7) + 's';
        b.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        box.appendChild(b);
      }
      setTimeout(() => { try { box.innerHTML = ''; } catch (_) {} }, 2200);
    }

    function showScoreDuel(my, opp, won, draw, oppLabel, bot) {
      return new Promise((resolve) => {
        try {
          if (settings && settings.scoreDuel === '0') { resolve(); return; }
        } catch (_) {}
        const ov = document.getElementById('scoreDuelOverlay');
        if (!ov) { resolve(); return; }
        clearScoreDuelTimers();
        scoreDuelResolve = resolve;
        scoreDuelSkippable = false;

        const sideMe = document.getElementById('duelSideMe');
        const sideOpp = document.getElementById('duelSideOpp');
        sideMe.className = 'score-duel-side me';
        sideOpp.className = 'score-duel-side opp';
        ov.classList.remove('show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
        try {
          const cf = ov.querySelector('.score-duel-confetti');
          if (cf) cf.innerHTML = '';
        } catch (_) {}

        document.getElementById('duelNameMe').textContent = (typeof myNickname === 'string' && myNickname) ? myNickname : 'Ты';
        document.getElementById('duelNameOpp').textContent = oppLabel || 'Соперник';
        document.getElementById('duelScoreMe').textContent = '0';
        document.getElementById('duelScoreOpp').textContent = '0';

        const avMeInner = document.getElementById('duelAvMeInner');
        const avOppInner = document.getElementById('duelAvOppInner');
        if (avMeInner) {
          try {
            renderAvatarInto(avMeInner, { avatarId: myAvatarId, nick: myNickname, size: 'duel' });
          } catch (_) {
            const initials = ((typeof myNickname === 'string' && myNickname) ? myNickname : 'Ты').slice(0, 2).toUpperCase();
            avMeInner.textContent = initials;
          }
          avMeInner.style.display = '';
        }
        if (avOppInner) {
          if (bot) {
            avOppInner.innerHTML = botAvatarSVG(bot, 64);
            avOppInner.style.display = 'block';
          } else {
            const ini = (oppLabel || 'С').slice(0, 2).toUpperCase();
            avOppInner.textContent = ini;
            avOppInner.style.display = '';
          }
        }

        ov.classList.add('visible');
        ov.setAttribute('aria-hidden', 'false');

        // Count-up scores
        scoreDuelTimers.push(setTimeout(() => {
          animateCount(document.getElementById('duelScoreMe'), my, 700);
          animateCount(document.getElementById('duelScoreOpp'), opp, 700);
        }, 180));

        // Reveal winner/loser + verdict (stronger, slightly longer)
        scoreDuelTimers.push(setTimeout(() => {
          ov.classList.remove('duel-win', 'duel-lose', 'duel-draw');
          if (draw) {
            sideMe.classList.add('draw');
            sideOpp.classList.add('draw');
            ov.classList.add('duel-draw');
          } else if (won) {
            sideMe.classList.add('winner');
            sideOpp.classList.add('loser');
            ov.classList.add('duel-win');
            try { spawnDuelConfetti(ov); } catch (_) {}
          } else {
            sideOpp.classList.add('winner');
            sideMe.classList.add('loser');
            ov.classList.add('duel-lose');
          }
          const verd = document.getElementById('duelVerdict');
          verd.className = 'score-duel-verdict ' + (draw ? 'draw' : won ? 'win' : 'lose');
          verd.textContent = draw ? 'Ничья' : won ? 'Победа!' : 'Поражение';
          ov.classList.add('show-verdict');
          try { hapticTap(18); } catch (_) {}
        }, 1000));

        // Allow tap after verdict has time to land
        scoreDuelTimers.push(setTimeout(() => { scoreDuelSkippable = true; }, 1250));
      });
    }
    document.getElementById('scoreDuelOverlay')?.addEventListener('click', () => {
      if (scoreDuelSkippable) finishScoreDuel();
    });

    function closeAllAchTabs() {
      try { sessionStorage.removeItem('bp_ach_open'); } catch (_) {}
      const list = document.getElementById('achList');
      if (!list) return;
      list.querySelectorAll('.ach-scroll').forEach(el => {
        el.classList.remove('open', 'ach-rise', 'ach-flip');
        el.style.transition = '';
        el.style.transform = '';
      });
    }

    function renderAchievements() {
      const list = document.getElementById('achList');
      if (!list) return;
      let openMap = {};
      try { openMap = JSON.parse(sessionStorage.getItem('bp_ach_open') || '{}') || {}; } catch (_) { openMap = {}; }
      // Only one section may be open
      const openId = Object.keys(openMap).find(k => openMap[k] === 1) || null;

      const cardHTML = (ach) => {
        const claimed = !!achProgress['claimed_' + ach.id];
        const ready = achReadyToClaim(ach);
        const cur = achCurrentValue(ach);
        const pct = Math.min(100, Math.round((cur / Math.max(1, ach.target)) * 100));
        let status = `${Math.min(cur, ach.target)} / ${ach.target}`;
        let claimBtn = '';
        if (claimed) status = '✓';
        else if (ready) {
          claimBtn = `<button type="button" class="ach-claim-btn" data-ach="${ach.id}">+${ach.reward} 💎</button>`;
          status = 'Готово';
        }
        return `<div class="ach-card ${claimed ? 'done' : ''} ${ready ? 'ready' : ''}">
          <div class="ach-top">
            <div class="ach-title">${ach.title}</div>
            <div class="ach-reward">+${ach.reward} 💎</div>
          </div>
          <div class="ach-desc">${ach.desc}</div>
          <div class="ach-progress"><div style="width:${claimed || ready ? 100 : pct}%"></div></div>
          <div class="ach-status">${status}</div>
          ${claimBtn}
        </div>`;
      };

      // Build sections; ready-to-claim stay INSIDE their tabs (sorted to top)
      const sectionNodes = [];
      for (const sec of ACH_SECTIONS) {
        const items = ACHIEVEMENTS.filter(a => (a.section || 'classic') === sec.id);
        if (!items.length) continue;
        const doneN = items.filter(a => achIsDone(a) || achProgress['claimed_' + a.id]).length;
        const readyN = items.filter(a => achReadyToClaim(a)).length;
        const isOpen = openId === sec.id;
        const bodyItems = [...items].sort((a, b) => {
          // Ready to claim first → in progress → claimed last
          const rank = (x) => {
            if (achReadyToClaim(x)) return 0;
            if (achProgress['claimed_' + x.id]) return 2;
            return 1;
          };
          const ra = rank(a), rb = rank(b);
          if (ra !== rb) return ra - rb;
          return (achCurrentValue(b) / Math.max(1, b.target)) - (achCurrentValue(a) / Math.max(1, a.target));
        });
        sectionNodes.push({
          id: sec.id,
          isOpen,
          html: `<div class="ach-scroll ${isOpen ? 'open' : ''}" data-sec="${sec.id}">
          <button type="button" class="ach-scroll-head" data-toggle-sec="${sec.id}">
            <span class="ach-scroll-ico">${sec.icon || '📜'}</span>
            <span class="ach-scroll-title">${sec.title}</span>
            ${readyN ? `<span class="ach-scroll-ready-dot" title="Можно забрать: ${readyN}"></span>` : ''}
            <span class="ach-scroll-count ${doneN >= items.length ? 'done-all' : ''}">${doneN}/${items.length}</span>
            <span class="ach-scroll-chev">▶</span>
          </button>
          <div class="ach-scroll-body"><div class="ach-scroll-inner">${bodyItems.map(cardHTML).join('') || '<div class="ach-desc" style="padding:4px 6px">Все выполнены</div>'}</div></div>
        </div>`
        });
      }

      // Open section goes first (visual order matches accordion state)
      if (openId) {
        sectionNodes.sort((a, b) => (a.id === openId ? -1 : b.id === openId ? 1 : 0));
      }

      let html = sectionNodes.map(s => s.html).join('');
      if (!html) html = '<div class="history-empty">Пока нет достижений</div>';
      list.innerHTML = html;

      try { updateClaimAllButton(); } catch (_) {}
      list.querySelectorAll('.ach-claim-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          claimAchievement(btn.dataset.ach, btn);
        });
      });

      list.querySelectorAll('[data-toggle-sec]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle-sec');
          const box = list.querySelector(`.ach-scroll[data-sec="${id}"]`);
          if (!box) return;
          const wasOpen = box.classList.contains('open');
          const tabs = [...list.querySelectorAll('.ach-scroll')];

          // FLIP: capture positions before layout change
          const firstRects = new Map();
          tabs.forEach(el => {
            firstRects.set(el, el.getBoundingClientRect());
            el.classList.remove('ach-flip');
            el.style.transition = 'none';
            el.style.transform = '';
          });

          // Close every section
          tabs.forEach(el => el.classList.remove('open'));
          openMap = {};

          if (!wasOpen) {
            // Move chosen tab to top, then open
            const first = list.querySelector('.ach-scroll');
            if (first && first !== box) {
              list.insertBefore(box, first);
            }
            box.classList.add('open');
            openMap[id] = 1;

            // Invert → play (smooth flow of all tabs)
            requestAnimationFrame(() => {
              const moving = [...list.querySelectorAll('.ach-scroll')];
              moving.forEach(el => {
                const f = firstRects.get(el);
                if (!f) return;
                const last = el.getBoundingClientRect();
                const dx = f.left - last.left;
                const dy = f.top - last.top;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                  el.style.transition = '';
                  el.style.transform = '';
                  return;
                }
                el.classList.add('ach-flip');
                el.style.transform = `translate(${dx}px, ${dy}px)`;
              });
              // Next frame: animate to natural positions
              requestAnimationFrame(() => {
                moving.forEach(el => {
                  if (!el.classList.contains('ach-flip')) return;
                  el.style.transition = 'transform 0.48s cubic-bezier(0.22, 1.05, 0.36, 1)';
                  el.style.transform = 'translate(0, 0)';
                });
                const clearFlip = (el) => {
                  el.classList.remove('ach-flip');
                  el.style.transition = '';
                  el.style.transform = '';
                  el.removeEventListener('transitionend', el._flipClear);
                };
                moving.forEach(el => {
                  if (!el.classList.contains('ach-flip')) return;
                  clearTimeout(el._flipT);
                  el._flipClear = (e) => {
                    if (e && e.propertyName && e.propertyName !== 'transform') return;
                    clearFlip(el);
                  };
                  el.addEventListener('transitionend', el._flipClear);
                  el._flipT = setTimeout(() => clearFlip(el), 560);
                });
              });
            });

            // Keep opened tab visible at top of scroll area
            try {
              requestAnimationFrame(() => {
                const listTop = list.getBoundingClientRect().top;
                const boxTop = box.getBoundingClientRect().top;
                if (Math.abs(boxTop - listTop) > 12) {
                  list.scrollTo({ top: list.scrollTop + (boxTop - listTop) - 4, behavior: 'smooth' });
                }
              });
            } catch (_) {}
          } else {
            // Closing only — soft settle
            tabs.forEach(el => {
              el.style.transition = '';
              el.style.transform = '';
            });
          }

          try { sessionStorage.setItem('bp_ach_open', JSON.stringify(openMap)); } catch (_) {}
        });
      });
      updateAchievementsButton();
    }

    function trackMatchAchievements(won) {
      bumpAchStat('matchesPlayed', 1);
      if (won) {
        const streak = (getAchStat('winStreak') || 0) + 1;
        setAchStat('winStreak', streak);
        setAchStat('winStreakBest', Math.max(getAchStat('winStreakBest') || 0, streak));
        bumpAchStat('wins', 1);
        if (vsModeType === 'online' || mpMode) bumpAchStat('onlineWins', 1);
        if (vsModeType === 'bots' || currentBot) bumpAchStat('botWins', 1);
        const dur = vsDuration || 120;
        if (dur <= 60) bumpAchStat('winDur60', 1);
        else if (dur >= 180) bumpAchStat('winDur180', 1);
        else bumpAchStat('winDur120', 1);
        try {
          const diff = Math.abs((score || 0) - (oppScore || 0));
          if (diff >= 500) bumpAchStat('blowoutWin', 1);
          if (diff <= 50) bumpAchStat('clutchWin', 1);
        } catch (_) {}
        if (currentBot) {
          if (currentBot.trophies <= 300) setAchStat('beatWeak', Math.max(1, getAchStat('beatWeak')));
          setAchStat('beatBotHighest', Math.max(getAchStat('beatBotHighest'), currentBot.trophies));
          if (currentBot.id === 'apex') {
            setAchStat('beatCrown', 1);
            setAchStat('beatApex', 1);
          }
          if (currentBot.id === 'oracle') setAchStat('beatSeer', 1);
        }
        // Comeback: was behind by 200+ at some point (flag set during match)
        try {
          if (window._matchWasBehind200) bumpAchStat('comebackWin', 1);
        } catch (_) {}
      } else {
        setAchStat('winStreak', 0);
      }
      try { window._matchWasBehind200 = false; } catch (_) {}
    }

    function renderOppPieces() {
      // Never overwrite replay trays with live hand
      if (typeof replayMode !== 'undefined' && replayMode) return;
      const area = document.getElementById('piecesAreaOpp');
      if (!area) return;
      area.innerHTML = '';
      if (!oppPieces || !oppPieces.length) {
        // Online: never invent a fake hand — wait for deal / rejoin sync
        if (vsModeType === 'online' || mpMode) {
          try { recoverHandsFromMatchLog(); } catch (_) {}
        }
        if (!oppPieces || !oppPieces.length) {
          if (vsModeType === 'bots' || currentBot) {
            const mk = randomBotPiece;
            oppPieces = [mk(), mk(), mk()];
          } else if (!(vsModeType === 'online' || mpMode)) {
            // Classic / non-online fallback only
            oppPieces = [randomPiece(DEFAULT_COLORS), randomPiece(DEFAULT_COLORS), randomPiece(DEFAULT_COLORS)];
          } else {
            // Online with empty hand: leave tray empty (will fill on deal / rejoin_ok)
            return;
          }
        }
      }
      let cellPx = 10;
      let slotPx = 44;
      try {
        const board = document.getElementById('boardOpp');
        if (board) {
          const w = board.getBoundingClientRect().width;
          if (w > 40) {
            const boardCell = w / SIZE;
            cellPx = Math.max(7, Math.min(12, Math.round(boardCell * 0.32)));
            slotPx = Math.max(36, Math.min(56, cellPx * 4 + 8));
          }
        } else {
          const cs = getComputedStyle(document.documentElement);
          const v = parseFloat(cs.getPropertyValue('--opp-piece'));
          if (Number.isFinite(v) && v > 0) cellPx = v;
          const s = parseFloat(cs.getPropertyValue('--opp-slot'));
          if (Number.isFinite(s) && s > 0) slotPx = s;
        }
      } catch (_) {}
      oppPieces.forEach((p, idx) => {
        const slot = document.createElement('div');
        slot.className = 'piece-slot';
        slot.dataset.oppIdx = idx;
        if (p.used) {
          slot.classList.add('used');
          area.appendChild(slot);
          return;
        }
        slot.style.width = slotPx + 'px';
        slot.style.height = slotPx + 'px';
        slot.style.minWidth = slotPx + 'px';
        const maxR = Math.max(...p.shape.map(s => s[0]));
        const maxC = Math.max(...p.shape.map(s => s[1]));
        const gridEl = document.createElement('div');
        gridEl.className = 'piece-grid';
        gridEl.style.gridTemplateColumns = `repeat(${maxC + 1}, ${cellPx}px)`;
        gridEl.style.gridTemplateRows = `repeat(${maxR + 1}, ${cellPx}px)`;
        gridEl.style.gap = '1px';
        const occ = new Set(p.shape.map(([r, c]) => r + ',' + c));
        for (let r = 0; r <= maxR; r++) {
          for (let c = 0; c <= maxC; c++) {
            const cell = document.createElement('div');
            if (occ.has(r + ',' + c)) {
              cell.className = 'piece-cell';
              try { paintCellColor(cell, p.color); } catch (_) {
                cell.style.background = p.color;
                cell.style.backgroundColor = p.color;
                cell.style.setProperty('--cell-base', p.color);
                cell.style.setProperty('--cell-glow', p.color);
              }
              cell.style.width = cellPx + 'px';
              cell.style.height = cellPx + 'px';
            }
            gridEl.appendChild(cell);
          }
        }
        slot.appendChild(gridEl);
        area.appendChild(slot);
        // Soft appear; force show even if timer is throttled in background tabs
        const delay = 30 + idx * 55;
        setTimeout(() => slot.classList.add('show'), delay);
        // Safety: never leave opp tray invisible
        setTimeout(() => { if (slot && !slot.classList.contains('used')) slot.classList.add('show'); }, delay + 200);
      });
    }
    const boardEl = document.getElementById('board');
    const boardMe = document.getElementById('boardMe');
    const boardOpp = document.getElementById('boardOpp');
    const piecesArea = document.getElementById('piecesArea');
    const piecesAreaVs = document.getElementById('piecesAreaVs');
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    const diamondsEl = document.getElementById('diamonds');
    const ghost = document.getElementById('ghost');
    const comboBanner = document.getElementById('comboBanner');
    const comboBannerMe = document.getElementById('comboBannerMe');
    const timerEl = document.getElementById('timer');
    const gameOverEl = document.getElementById('gameOver');
    const stuckOfferEl = document.getElementById('stuckOffer');

    function showScreen(name) {
      // Shop mini-previews: only run while shop/inventory is visible
      try {
        if (name !== 'shop' && name !== 'inventory') {
          if (typeof shopMiniTimer !== 'undefined' && shopMiniTimer) {
            clearInterval(shopMiniTimer);
            shopMiniTimer = null;
          }
        }
      } catch (_) {}
      // Leaving achievements → collapse all tabs to default order
      try {
        const achEl = screens.achievements;
        const leavingAch = achEl && achEl.classList.contains('active') && name !== 'achievements';
        if (leavingAch) {
          closeAllAchTabs();
          // Re-render so section order resets to default next visit
          try { renderAchievements(); } catch (_) {}
        }
      } catch (_) {}
      // Leave replay safely when navigating away from versus
      try {
        if (name !== 'versus' && typeof replayMode !== 'undefined' && replayMode) {
          try { stopReplayPlay(); } catch (_) {}
          replayMode = false;
          document.body.classList.remove('replay-ui');
          try { hideReplayEndCard(); } catch (_) {}
          try {
            if (window._replaySkinBackup) {
              equippedSkinId = window._replaySkinBackup;
              applyEquippedSkin();
            }
            if (window._replayBoardBackup) {
              equippedBoardId = window._replayBoardBackup;
              applyEquippedBoard();
            }
            clearOppSkin();
            clearOppBoard();
            window.mpOppSkinId = null;
            window.mpOppBoardId = null;
            window._replaySkinBackup = null;
            window._replayBoardBackup = null;
          } catch (_) {}
          try {
            const rb = document.getElementById('reviewBar');
            if (rb) {
              rb.classList.remove('visible', 'replay-dock');
            }
          } catch (_) {}
          try {
            const scrub = document.getElementById('replayScrubBar');
            if (scrub) {
              scrub.style.display = 'none';
              scrub.setAttribute('aria-hidden', 'true');
            }
          } catch (_) {}
          try {
            const fb = document.getElementById('btnForfeit');
            if (fb) fb.style.display = '';
          } catch (_) {}
        }
      } catch (_) {}
      // Cancel in-progress drag when leaving play screens
      try {
        if (name !== 'classic' && name !== 'versus') {
          if (typeof isDragging !== 'undefined' && isDragging) {
            isDragging = false;
            selectedIdx = -1;
            dragPiece = null;
            placingLock = false;
            try { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } } catch (_) {}
            try {
              const g = document.getElementById('ghost');
              if (g) { g.style.display = 'none'; g.style.opacity = '0'; }
            } catch (_) {}
          }
        }
      } catch (_) {}
      // If leaving versus while a bot AI tick is still scheduled, stop it
      try {
        if (name !== 'versus' && !vsActive) {
          if (typeof aiInterval !== 'undefined' && aiInterval) {
            clearInterval(aiInterval);
            aiInterval = null;
          }
          aiBusy = false;
        }
      } catch (_) {}
      Object.values(screens).forEach(s => {
        s.classList.remove('active', 'screen-enter');
      });
      if (screens[name]) {
        const el = screens[name];
        // Force reflow so entrance animation always replays
        el.classList.remove('active', 'screen-enter');
        void el.offsetWidth;
        el.classList.add('active', 'screen-enter');
        // Drop enter class after anim so nested dynamic content is not stuck mid-anim
        clearTimeout(el._enterT);
        el._enterT = setTimeout(() => {
          try { el.classList.remove('screen-enter'); } catch (_) {}
        }, 700);
      }
      mode = (name === 'classic' || name === 'versus') ? name : name;
      try {
        const prevAct = myActivity;
        detectMyActivity();
        if (myActivity !== prevAct) scheduleActivityBroadcast();
      } catch (_) {}
      const lock = (name === 'versus' || name === 'classic' || name === 'difficulty' || name === 'history' || name === 'achievements');
      setFitLock(lock);
      if (lock) {
        requestAnimationFrame(() => applyBoardScales());
      }
      if (name === 'classic' || name === 'versus') {
        try { applyEquippedBoard(); } catch (_) {}
        try { requestWakeLock(); } catch (_) {}
      } else {
        try { releaseWakeLock(); } catch (_) {}
      }
      syncMusicToScreen(name);
      // If a live match snapshot exists and we are not in versus, surface rejoin toast
      // (covers: both left, one already back in match — the other must still see the panel)
      try {
        if (name === 'menu' || name === 'friends' || name === 'settings' || name === 'history') {
          if (!vsActive && !window._matchEnded && !window._mpRejoiningMatch) {
            const s = (typeof readLiveMatch === 'function') ? readLiveMatch() : null;
            if (s) {
              showMatchRejoinPanel(s);
              try { startRejoinPanelListen(s); } catch (_2) {}
            }
          }
        }
      } catch (_) {}
    }
    /** Silver = each duration win (1/2/3 min). Gold = bot fully cleared (3/3). */
    function totalSilverStars() {
      return totalBotStars();
    }
    function maxSilverStars() {
      return (BOTS && BOTS.length ? BOTS.length : 0) * 3;
    }
    function totalGoldStars() {
      let n = 0;
      if (!BOTS || !BOTS.length) return 0;
      for (const b of BOTS) {
        if (getBotStarCount(b.id) >= 3) n++;
      }
      return n;
    }
    function maxGoldStars() {
      return BOTS && BOTS.length ? BOTS.length : 0;
    }
    function updateMenuStats() {
      const tEl = document.getElementById('menuTrophies');
      const dEl = document.getElementById('menuDiamonds');
      const bEl = document.getElementById('menuBest');
      if (tEl) tEl.textContent = trophies;
      if (dEl) dEl.textContent = diamonds;
      if (bEl) bEl.textContent = best;
      const live = document.getElementById('trophiesLive');
      if (live) live.textContent = trophies;
      // Silver stars: collected / total (top bar)
      const silverEl = document.getElementById('menuSilverStars');
      if (silverEl) silverEl.textContent = totalSilverStars() + '/' + maxSilverStars();
      // Gold star counter only if element still exists somewhere
      const goldEl = document.getElementById('menuGoldStars');
      if (goldEl) goldEl.textContent = totalGoldStars() + '/' + maxGoldStars();
      const starsEl = document.getElementById('menuStars');
      if (starsEl) starsEl.textContent = totalSilverStars() + '/' + maxSilverStars();
      const rb = document.getElementById('menuRankedBest');
      if (rb) rb.textContent = rankedBest;
      const csh = document.getElementById('compSilverHint');
      if (csh) csh.textContent = totalSilverStars() + '/' + maxSilverStars();
      try { updateAchievementsButton(); } catch (_) {}
      try { refreshProfileUI(); } catch (_) {}
    }

    function normalize(shape) {
      const minR = Math.min(...shape.map(p => p[0]));
      const minC = Math.min(...shape.map(p => p[1]));
      return shape.map(([r,c]) => [r-minR, c-minC]);
    }
    function randomPiece(palette) {
      const cols = (palette && palette.length) ? palette : COLORS;
      const total = SHAPE_WEIGHTS.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < SHAPE_WEIGHTS.length; i++) {
        r -= SHAPE_WEIGHTS[i];
        if (r <= 0) { idx = i; break; }
      }
      return {
        shape: normalize(SHAPES[idx]),
        color: cols[Math.floor(Math.random() * cols.length)],
        used: false
      };
    }
    /** Bot / classic opponent palette — always default, never player legendary colors */
    function randomBotPiece() {
      return randomPiece(DEFAULT_COLORS);
    }
    function isCellEmpty(g, r, c) {
      // Treat null/undefined/'' as empty — avoids false "occupied" from sparse values
      return r >= 0 && r < SIZE && c >= 0 && c < SIZE && !g[r][c];
    }
    function canPlaceOn(g, shape, baseR, baseC) {
      for (const [dr, dc] of shape) {
        const r = baseR + dr, c = baseC + dc;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || g[r][c]) return false;
      }
      return true;
    }
    function findAllPlacements(g, shape) {
      if (!shape || !shape.length) return [];
      const maxR = Math.max(...shape.map(s => s[0]));
      const maxC = Math.max(...shape.map(s => s[1]));
      const candidates = [];
      for (let r = 0; r <= SIZE - 1 - maxR; r++) {
        for (let c = 0; c <= SIZE - 1 - maxC; c++) {
          if (canPlaceOn(g, shape, r, c)) candidates.push({ r, c });
        }
      }
      return candidates;
    }
    /** True only if every remaining piece has zero legal cells */
    function piecesTrulyUnplayable(g, pieceArr) {
      const left = (pieceArr || []).filter(p => p && !p.used && p.shape && p.shape.length);
      if (!left.length) return false; // empty tray = deal pending, NOT stuck
      // Must have zero legal cells for EVERY remaining piece
      for (const p of left) {
        if (findAllPlacements(g, p.shape).length > 0) return false;
      }
      return true;
    }
    function pieceIsPlayable(g, piece) {
      if (!piece || piece.used || !piece.shape) return false;
      return findAllPlacements(g, piece.shape).length > 0;
    }
    function scorePlacement(g, shape, pos) {
      const test = g.map(row => row.slice());
      for (const [dr, dc] of shape) test[pos.r + dr][pos.c + dc] = '#';
      let lines = 0;
      for (let r = 0; r < SIZE; r++) if (test[r].every(x => x !== null)) lines++;
      for (let c = 0; c < SIZE; c++) if (test.every(row => row[c] !== null)) lines++;

      // Neighbour contact — prefer snug fits
      let contacts = 0;
      let edges = 0;
      for (const [dr, dc] of shape) {
        const r = pos.r + dr, c = pos.c + dc;
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        for (const [rr, cc] of dirs) {
          const nr = r + rr, nc = c + cc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) edges++;
          else if (g[nr][nc] !== null) contacts++;
        }
      }

      // How full rows/cols become after place (progress toward clear)
      let progress = 0;
      for (let r = 0; r < SIZE; r++) {
        const fill = test[r].filter(x => x !== null).length;
        if (fill >= 5) progress += fill;
      }
      for (let c = 0; c < SIZE; c++) {
        let fill = 0;
        for (let r = 0; r < SIZE; r++) if (test[r][c] !== null) fill++;
        if (fill >= 5) progress += fill;
      }

      // Penalize isolated holes created nearby (rough)
      let holes = 0;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (test[r][c] !== null) continue;
          let blocked = 0;
          if (r === 0 || test[r-1][c] !== null) blocked++;
          if (r === SIZE-1 || test[r+1][c] !== null) blocked++;
          if (c === 0 || test[r][c-1] !== null) blocked++;
          if (c === SIZE-1 || test[r][c+1] !== null) blocked++;
          if (blocked >= 3) holes++;
        }
      }

      const st = (currentBot && currentBot.style) || { clearBias: 0.7, risk: 0.4, preferSmall: 1 };
      const clearW = 350 + 550 * (st.clearBias || 0.7);
      const holePen = 3 + 12 * (1 - (st.risk || 0.4));
      const contactW = 2 + 4 * (1 - (st.risk || 0.4));
      const sizePref = (st.preferSmall || 1) * (5 - Math.min(4, shape.length));
      return lines * clearW + progress * 3 + contacts * contactW + edges * 1.2 - holes * holePen + sizePref * 3;
    }

    function findPlacement(g, shape, skill = 1) {
      const candidates = findAllPlacements(g, shape);
      if (!candidates.length) return null;
      candidates.sort((a, b) => scorePlacement(g, shape, b) - scorePlacement(g, shape, a));
      if (Math.random() < skill) return candidates[0];
      // Weaker bots: pick from top half randomly
      const pool = Math.max(1, Math.ceil(candidates.length * (1 - skill * 0.7)));
      return candidates[Math.floor(Math.random() * pool)];
    }

    /** Evaluate all available pieces, return best {piece, idx, pos, score} */
    function findBestMove(g, piecesArr, skill) {
      let best = null;
      piecesArr.forEach((piece, idx) => {
        if (piece.used) return;
        // Exhaustive legal placements — never miss a valid cell
        const all = findAllPlacements(g, piece.shape);
        if (!all.length) return;
        all.sort((a, b) => scorePlacement(g, piece.shape, b) - scorePlacement(g, piece.shape, a));
        const pos = (Math.random() < skill) ? all[0]
          : all[Math.floor(Math.random() * Math.max(1, Math.ceil(all.length * (1 - skill * 0.7))))];
        const sc = scorePlacement(g, piece.shape, pos);
        if (!best || sc > best.sc) best = { piece, idx, pos, sc };
      });
      return best;
    }
    /** Clear anim from equipped FIELD only (not piece skin). Duration FIXED for fair play. */
    const CLEAR_ANIM_MS = 110;
    function getClearAnimMeta(boardDOM) {
      let fx = 'none';
      let boardId = '';
      try {
        const wrap = boardDOM && boardDOM.closest && boardDOM.closest('.board-wrap');
        if (wrap) {
          boardId = wrap.dataset.board || '';
          const hit = [...wrap.classList].find(c => c.startsWith('board-fx-'));
          if (hit) fx = hit.slice('board-fx-'.length);
        }
        // Always prefer catalog entry for this board id (reliable, independent of skins)
        if (typeof getBoardById === 'function') {
          const isOpp = boardDOM && (boardDOM.id === 'boardOpp' ||
            (boardDOM.closest && boardDOM.closest('.player-panel.opp')));
          const id = boardId || (!isOpp ? equippedBoardId : (window.mpOppBoardId || 'field_default'));
          const b = getBoardById(id);
          if (b && b.fx) fx = b.fx;
        }
      } catch (_) {}
      // Same ms everywhere — look differs by field theme / id
      if (fx === 'nebula') return { cls: 'clearing-nebula', name: 'clearNebula', beam: 'nebula', ms: CLEAR_ANIM_MS };
      if (fx === 'solar') return { cls: 'clearing-solar', name: 'clearSolar', beam: 'solar', ms: CLEAR_ANIM_MS };
      if (fx === 'quantum') return { cls: 'clearing-quantum', name: 'clearQuantum', beam: 'quantum', ms: CLEAR_ANIM_MS };
      if (fx === 'abyss') return { cls: 'clearing-abyss', name: 'clearAbyss', beam: 'abyss', ms: CLEAR_ANIM_MS };
      if (fx === 'prismfield') return { cls: 'clearing-prism', name: 'clearPrism', beam: 'prism', ms: CLEAR_ANIM_MS };
      if (fx === 'magma') return { cls: 'clearing-magma', name: 'clearMagma', beam: 'magma', ms: CLEAR_ANIM_MS };
      // Epic pulse fields: crystal vs neon_grid by board id
      if (fx === 'pulse') {
        if (boardId === 'field_neon_grid') return { cls: 'clearing-neon', name: 'clearNeon', beam: 'neon', ms: CLEAR_ANIM_MS };
        return { cls: 'clearing-epic', name: 'clearEpic', beam: 'epic', ms: CLEAR_ANIM_MS };
      }
      // Rare soft fields: unique per board
      if (fx === 'soft') {
        if (boardId === 'field_violet') return { cls: 'clearing-rare-violet', name: 'clearRareViolet', beam: 'rare-violet', ms: CLEAR_ANIM_MS };
        if (boardId === 'field_jade') return { cls: 'clearing-rare-jade', name: 'clearRareJade', beam: 'rare-jade', ms: CLEAR_ANIM_MS };
        return { cls: 'clearing-rare-azure', name: 'clearRareAzure', beam: 'rare-azure', ms: CLEAR_ANIM_MS };
      }
      return { cls: 'clearing-common', name: 'clearCommon', beam: null, ms: CLEAR_ANIM_MS };
    }
    const CLEARING_CLASSES = [
      'clearing', 'clearing-common',
      'clearing-rare', 'clearing-rare-azure', 'clearing-rare-violet', 'clearing-rare-jade',
      'clearing-epic', 'clearing-neon', 'clearing-magma',
      'clearing-nebula', 'clearing-solar', 'clearing-quantum', 'clearing-abyss', 'clearing-prism'
    ];
    /** Visible line sweep on rare+ fields — makes clear unmistakably themed */
    function spawnClearBeams(boardDOM, rows, cols, beamTheme) {
      if (!boardDOM || !beamTheme || settings.anim === 'off') return;
      const wrap = boardDOM.parentElement;
      if (!wrap) return;
      try {
        const boardRect = boardDOM.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const step = boardRect.height / SIZE;
        const paint = (isRow, index) => {
          const el = document.createElement('div');
          el.className = `clear-beam ${isRow ? 'row' : 'col'} ${beamTheme}`;
          if (isRow) {
            el.style.top = (boardRect.top - wrapRect.top + step * (index + 0.5)) + 'px';
            el.style.left = (boardRect.left - wrapRect.left) + 'px';
            el.style.width = boardRect.width + 'px';
          } else {
            el.style.left = (boardRect.left - wrapRect.left + step * (index + 0.5)) + 'px';
            el.style.top = (boardRect.top - wrapRect.top) + 'px';
            el.style.height = boardRect.height + 'px';
          }
          wrap.appendChild(el);
          setTimeout(() => { try { el.remove(); } catch (_) {} }, CLEAR_ANIM_MS + 40);
        };
        (rows || []).forEach(r => paint(true, r));
        (cols || []).forEach(c => paint(false, c));
      } catch (_) {}
    }
    /** Legendary-only: maximally distinct debris per field */
    function spawnClearDebris(boardDOM, cellIndices, theme) {
      if (!boardDOM || !theme || settings.anim === 'off') return;
      const wrap = boardDOM.parentElement;
      if (!wrap) return;
      const themed = ['solar', 'abyss', 'nebula', 'quantum', 'prism',
        'magma', 'epic', 'neon', 'rare-azure', 'rare-violet', 'rare-jade', 'rare'];
      if (!themed.includes(theme)) return;
      try {
        const boardRect = boardDOM.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const cellW = boardRect.width / SIZE;
        const cellH = boardRect.height / SIZE;
        const rand = (a, b) => a + Math.random() * (b - a);
        const add = (cls, x, y, dx, dy, rot, extraStyle) => {
          const el = document.createElement('div');
          el.className = 'clear-debris ' + cls;
          el.style.left = x + 'px';
          el.style.top = y + 'px';
          el.style.setProperty('--dx', dx.toFixed(1) + 'px');
          el.style.setProperty('--dy', dy.toFixed(1) + 'px');
          el.style.setProperty('--rot', (rot || 0) + 'deg');
          if (extraStyle) Object.assign(el.style, extraStyle);
          wrap.appendChild(el);
          setTimeout(() => { try { el.remove(); } catch (_) {} }, 400);
        };
        // Cap debris on big multi-line clears for performance
        const indices = cellIndices.length > 16
          ? cellIndices.filter((_, i) => i % 2 === 0)
          : cellIndices;
        indices.forEach(idx => {
          const r = (idx / SIZE) | 0;
          const c = idx % SIZE;
          const cx = boardRect.left - wrapRect.left + (c + 0.5) * cellW;
          const cy = boardRect.top - wrapRect.top + (r + 0.5) * cellH;

          if (theme === 'solar') {
            // Explosion upward + outward (sun pieces)
            for (let i = 0; i < 4; i++) {
              const ang = rand(-Math.PI * 0.9, -Math.PI * 0.1); // mostly upward
              const dist = rand(22, 52);
              add('solar-shard', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, rand(-200, 200));
            }
            for (let i = 0; i < 3; i++) {
              const ang = rand(0, Math.PI * 2);
              const dist = rand(14, 36);
              add('solar-ember', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist - rand(8, 20), 0);
            }
          } else if (theme === 'abyss') {
            // ONLY vertical: drops sink hard, bubbles rise
            for (let i = 0; i < 3; i++) {
              add('abyss-drop', cx + rand(-8, 8), cy, 0, rand(20, 48), 0);
            }
            for (let i = 0; i < 3; i++) {
              add('abyss-bubble', cx + rand(-10, 10), cy + rand(0, 6), rand(-12, 12), rand(-28, -12), 0);
            }
          } else if (theme === 'nebula') {
            // Soft radial drift — slower, floaty
            for (let i = 0; i < 3; i++) {
              const ang = rand(0, Math.PI * 2);
              const dist = rand(16, 40);
              add('nebula-star', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, rand(-40, 40));
            }
            for (let i = 0; i < 4; i++) {
              const ang = rand(0, Math.PI * 2);
              const dist = rand(10, 32);
              add('nebula-dust', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            }
          } else if (theme === 'quantum') {
            // Cardinal directions only + scan blips (robotic)
            const dirs = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]];
            dirs.forEach((d, i) => {
              const dist = 14 + (i % 4) * 6;
              add('quantum-bit', cx, cy, d[0] * dist, d[1] * dist, 0);
            });
            add('quantum-scan', cx, cy, rand(20, 36) * (Math.random() < 0.5 ? 1 : -1), 0, 0);
          } else if (theme === 'prism') {
            // Spectrum chips: 2–3 per cell, short travel — stays near the cleared line
            const hues = ['#ff6b81', '#ffd666', '#5ee7ff', '#c77dff', '#ff9de2'];
            const n = 2 + (Math.random() < 0.35 ? 1 : 0);
            for (let i = 0; i < n; i++) {
              const ang = (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
              const dist = rand(8, 18);
              add('prism-shard', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, rand(-90, 90), {
                background: hues[i % hues.length],
                boxShadow: '0 0 3px ' + hues[i % hues.length]
              });
            }
          } else if (theme === 'magma') {
            for (let i = 0; i < 4; i++) {
              const ang = rand(-Math.PI * 0.85, -Math.PI * 0.15);
              const dist = rand(14, 34);
              add('magma-ember', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            }
          } else if (theme === 'epic') {
            for (let i = 0; i < 4; i++) {
              const ang = rand(0, Math.PI * 2);
              const dist = rand(12, 30);
              add('epic-spark', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            }
          } else if (theme === 'neon') {
            for (let i = 0; i < 4; i++) {
              const ang = (i / 4) * Math.PI * 2;
              const dist = rand(12, 28);
              add('neon-bit', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            }
          } else if (theme === 'rare-azure' || theme === 'rare-violet' || theme === 'rare-jade' || theme === 'rare') {
            const col = theme === 'rare-violet' ? '#b388ff' : theme === 'rare-jade' ? '#2dd4a8' : '#5ac8ff';
            for (let i = 0; i < 3; i++) {
              const ang = rand(0, Math.PI * 2);
              const dist = rand(8, 22);
              add('rare-spark', cx, cy, Math.cos(ang) * dist, Math.sin(ang) * dist, 0, {
                background: col,
                boxShadow: '0 0 6px ' + col
              });
            }
          }
        });
      } catch (_) {}
    }
    function clearLinesOn(g, boardDOM) {
      const rows=[], cols=[];
      for (let r=0;r<SIZE;r++) if (g[r].every(c => !!c)) rows.push(r);
      for (let c=0;c<SIZE;c++) if (g.every(row => !!row[c])) cols.push(c);
      if (!rows.length && !cols.length) return { count: 0, rows: [], cols: [] };
      const toAnim = new Set();
      rows.forEach(r => { for(let c=0;c<SIZE;c++) toAnim.add(r*SIZE+c); });
      cols.forEach(c => { for(let r=0;r<SIZE;r++) toAnim.add(r*SIZE+c); });
      const meta = getClearAnimMeta(boardDOM);
      const animCss = `${meta.name} ${meta.ms}ms ease-out forwards`;
      if (boardDOM) {
        toAnim.forEach(idx => {
          const cell = boardDOM.children[idx];
          if (!cell) return;
          CLEARING_CLASSES.forEach(c => cell.classList.remove(c));
          cell.style.setProperty('animation', 'none', 'important');
          void cell.offsetWidth;
          cell.classList.add(meta.cls);
          cell.style.setProperty('animation', animCss, 'important');
          cell.style.setProperty('transition', 'none', 'important');
          cell.style.setProperty('overflow', 'hidden', 'important');
        });
        if (meta.beam) spawnClearBeams(boardDOM, rows, cols, meta.beam);
        // Legendary debris from each cleared cell
        if (meta.beam) {
          spawnClearDebris(boardDOM, [...toAnim], meta.beam);
        }
      }
      rows.forEach(r => { for(let c=0;c<SIZE;c++) g[r][c]=null; });
      cols.forEach(c => { for(let r=0;r<SIZE;r++) g[r][c]=null; });
      setTimeout(() => {
        if (boardDOM) renderGrid(g, boardDOM);
      }, meta.ms);
      return { count: rows.length + cols.length, rows, cols };
    }

    /** Centers of cleared rows/cols relative to board-wrap for score floats */
    /** Pixel position inside board-wrap for a cell (or fractional cell). */
    function cellToWrapPos(boardDOM, r, c) {
      if (!boardDOM) return null;
      const wrap = boardDOM.parentElement;
      if (!wrap) return null;
      const wrapRect = wrap.getBoundingClientRect();
      const rr = Math.max(0, Math.min(SIZE - 1, Math.round(r)));
      const cc = Math.max(0, Math.min(SIZE - 1, Math.round(c)));
      const cell = boardDOM.children[rr * SIZE + cc];
      if (!cell) return null;
      const cr = cell.getBoundingClientRect();
      // Sub-cell offset when r/c are fractional (piece center)
      const fr = r - rr;
      const fc = c - cc;
      return {
        left: cr.left + cr.width * (0.5 + fc) - wrapRect.left,
        top: cr.top + cr.height * (0.5 + fr) - wrapRect.top
      };
    }
    /**
     * Float positions for clear bonus.
     * Prefer the placed piece center (where the combo came from) — never force board center.
     * Optional: also mark midpoints of cleared rows/cols near the piece.
     */
    function getClearFloatPositions(boardDOM, rows, cols, placeAnchor) {
      if (!boardDOM) return [];
      const pts = [];
      // Primary: where the piece was dropped
      if (placeAnchor && typeof placeAnchor.centerR === 'number' && typeof placeAnchor.centerC === 'number') {
        const p = cellToWrapPos(boardDOM, placeAnchor.centerR, placeAnchor.centerC);
        if (p) pts.push({ left: p.left, top: p.top, kind: 'place' });
      } else if (placeAnchor && typeof placeAnchor.baseR === 'number') {
        const p = cellToWrapPos(boardDOM, placeAnchor.baseR, placeAnchor.baseC);
        if (p) pts.push({ left: p.left, top: p.top, kind: 'place' });
      }
      // If we have a place anchor, one float at the piece is enough (full bonus shown there)
      if (pts.length) return pts;
      // Fallback without anchor: centers of cleared lines (not whole-board center unless line is middle)
      const wrap = boardDOM.parentElement;
      if (!wrap) return pts;
      const wrapRect = wrap.getBoundingClientRect();
      (rows || []).forEach(r => {
        // Center of the cleared row horizontally among filled span — use mid of board only as row midpoint
        const cell = boardDOM.children[r * SIZE + Math.floor((SIZE - 1) / 2)];
        if (!cell) return;
        const cr = cell.getBoundingClientRect();
        pts.push({
          left: cr.left + cr.width / 2 - wrapRect.left,
          top: cr.top + cr.height / 2 - wrapRect.top,
          kind: 'row'
        });
      });
      (cols || []).forEach(c => {
        const cell = boardDOM.children[Math.floor((SIZE - 1) / 2) * SIZE + c];
        if (!cell) return;
        const cr = cell.getBoundingClientRect();
        pts.push({
          left: cr.left + cr.width / 2 - wrapRect.left,
          top: cr.top + cr.height / 2 - wrapRect.top,
          kind: 'col'
        });
      });
      return pts;
    }
    function renderGrid(g, boardDOM) {
      for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
        const cell = boardDOM.children[r*SIZE+c];
        if (!cell) continue;
        const val = g[r][c];
        if (val) {
          const prev = cell.style.getPropertyValue('--cell-base');
          // Keep in-flight placeSoft visible even if renderGrid runs mid-settle
          const already = cell.classList.contains('filled') && prev === val &&
            !cell.classList.contains('preview-ok') && !cell.classList.contains('preview-bad');
          if (already) {
            let clearing = false;
            for (let k=0;k<CLEARING_CLASSES.length;k++) {
              if (cell.classList.contains(CLEARING_CLASSES[k])) { clearing = true; break; }
            }
            // Skip thrash — preserves .placing animation
            if (!clearing) continue;
          }
          if (prev !== val) paintCellColor(cell, val);
          if (!cell.classList.contains('filled')) cell.classList.add('filled');
          CLEARING_CLASSES.forEach(cl => cell.classList.remove(cl));
          cell.classList.remove('preview-ok','preview-bad');
          // Only kill place anim when color/value actually changed
          if (prev !== val) {
            cell.classList.remove('placing');
            cell.style.removeProperty('animation');
            cell.style.removeProperty('transition');
            cell.style.removeProperty('transform');
            cell.style.removeProperty('opacity');
            cell.style.removeProperty('filter');
            cell.style.removeProperty('box-shadow');
            cell.style.removeProperty('clip-path');
          }
        } else {
          const wasClearing = CLEARING_CLASSES.some(cl => cell.classList.contains(cl));
          if (cell.classList.contains('filled') || cell.classList.contains('preview-ok') || cell.classList.contains('preview-bad') || wasClearing || cell.classList.contains('placing')) {
            // Kill any in-flight clear anim without a flash-back
            cell.style.setProperty('transition', 'none', 'important');
            cell.style.setProperty('animation', 'none', 'important');
            cell.style.background = '';
            cell.style.backgroundColor = '';
            cell.style.backgroundImage = '';
            cell.style.removeProperty('--cell-base');
            cell.style.removeProperty('--cell-glow');
            cell.style.removeProperty('transform');
            cell.style.removeProperty('opacity');
            cell.style.removeProperty('filter');
            cell.style.removeProperty('box-shadow');
            cell.style.removeProperty('clip-path');
            CLEARING_CLASSES.forEach(cl => cell.classList.remove(cl));
            cell.classList.remove('filled','preview-ok','preview-bad','placing');
            // Restore default transition on next frame
            requestAnimationFrame(() => {
              if (!cell.classList.contains('filled')) {
                cell.style.removeProperty('transition');
                cell.style.removeProperty('animation');
              }
            });
          }
        }
      }
    }
    function createBoardDOM(el) {
      el.innerHTML = '';
      for (let i=0;i<SIZE*SIZE;i++) {
        const cell = document.createElement('div');
        cell.className = 'cell'; cell.dataset.idx = i;
        el.appendChild(cell);
      }
      try {
        const wrap = el && el.closest && el.closest('.board-wrap');
        if (wrap && typeof getBoardById === 'function') {
          const isOpp = (el && el.id === 'boardOpp') || (wrap.closest && wrap.closest('.player-panel.opp'));
          const b = getBoardById(isOpp ? 'field_default' : equippedBoardId);
          applyBoardToWrap(wrap, b);
        }
      } catch (_) {}
    }
    function bonusFor(cleared) {
      return [0,100,300,600,1000,1500,2200,3000,4000][cleared] || 4000;
    }
    /** Extra points for consecutive clears (chain): 2nd clear +50, 3rd +100, … */
    function chainBonusFor(chain) {
      if (chain < 2) return 0;
      return Math.min(800, (chain - 1) * 50);
    }

    function saveClassicState() {
      if (mode !== 'classic') return;
      try {
        const payload = {
          grid,
          score,
          diamonds,
          pieces: (pieces || []).map(p => ({
            shape: p.shape.map(c => c.slice()),
            color: p.color,
            used: !!p.used
          }))
        };
        localStorage.setItem('bp_classic_save', JSON.stringify(payload));
      } catch (_) {}
    }
    function clearClassicSave() {
      try { localStorage.removeItem('bp_classic_save'); } catch (_) {}
    }
    function loadClassicState() {
      try {
        const raw = localStorage.getItem('bp_classic_save');
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.grid) || data.grid.length !== SIZE) return null;
        return data;
      } catch (_) {
        return null;
      }
    }

    function clearBoardScoreFX() {
      try {
        document.querySelectorAll('.score-float').forEach(el => el.remove());
        document.querySelectorAll('.combo-banner').forEach(b => {
          b.classList.remove('show');
          b.textContent = '';
          try {
            b.style.opacity = '';
            b.style.left = '';
            b.style.top = '';
          } catch (_) {}
        });
        window._lastPlaceAnchor = null;
      } catch (_) {}
    }
    function startClassic(forceNew) {
      const run = () => {
      // Hard-stop any leftover versus / AI clocks before classic board opens
      try {
        if (typeof vsTimerId !== 'undefined' && vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
        if (typeof aiInterval !== 'undefined' && aiInterval) { clearInterval(aiInterval); aiInterval = null; }
        if (typeof replayTimer !== 'undefined' && replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
        vsActive = false;
        replayMode = false;
        document.body.classList.remove('replay-ui');
      } catch (_) {}
      showScreen('classic');
      mode = 'classic';
      try { clearBoardScoreFX(); } catch (_) {}
      gameOverEl.classList.remove('visible');
      stuckOfferEl.classList.remove('visible');
      selectedIdx = -1; placingLock = false;

      const saved = (!forceNew) ? loadClassicState() : null;
      if (saved) {
        grid = saved.grid.map(row => row.map(c => c));
        score = typeof saved.score === 'number' ? saved.score : 0;
        if (typeof saved.diamonds === 'number') diamonds = saved.diamonds;
        if (diamonds < 0) diamonds = 0;
        pieces = Array.isArray(saved.pieces) && saved.pieces.length
          ? saved.pieces.map(p => ({
              shape: (p.shape || []).map(c => c.slice()),
              color: p.color || COLORS[0],
              used: !!p.used
            }))
          : [randomPiece(), randomPiece(), randomPiece()];
      } else {
        grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        score = 0;
        if (diamonds < 1) diamonds = 3;
        pieces = [randomPiece(), randomPiece(), randomPiece()];
      }
      clearChain = 0;

      updateClassicUI();
      createBoardDOM(boardEl);
      applyBoardScales();
      renderGrid(grid, boardEl);
      renderPieces(piecesArea);
      // If all pieces used, deal new set
      if (pieces.every(p => p.used)) generatePieces(piecesArea);
      updateBoardMetrics(boardEl);
      saveClassicState();
      };
      // Short prep intro then open board
      showMatchIntro({
        label: 'Классика',
        title: 'Собери поле',
        sub: forceNew ? 'Новая партия' : 'Продолжение',
        goText: 'Играй!',
        ms: 1200
      }).then(run);
    }
    function updateClassicUI() {
      scoreEl.textContent = score; bestEl.textContent = best; diamondsEl.textContent = diamonds;
      localStorage.setItem('bp_diamonds', diamonds);
      document.getElementById('btnRelief').disabled = diamonds < 1;
      if (score > best) {
        best = score;
        bestEl.textContent = best;
        localStorage.setItem('bp_best', best);
      }
      try {
        if (mode === 'classic' && score >= 50000 && !window._classicUsedRelief) {
          setAchStat('perfectClassic', 1);
        }
      } catch (_) {}
      saveClassicState();
    }
    function generatePieces(areaEl) {
      pieces = [randomPiece(), randomPiece(), randomPiece()];
      renderPieces(areaEl);
      if (mode === 'versus' && vsActive) {
        logDeal('me', pieces);
        if (mpMode) {
          mpSend({
            type: 'deal',
            pieces: pieces.map(p => {
              let sh = (p.shape || []).map(c => c.slice());
              try {
                if (typeof normalize === 'function' && sh.length) sh = normalize(sh.map(c => c.slice()));
              } catch (_) {}
              return { shape: sh, color: p.color, used: !!p.used };
            })
          });
        }
      }
      if (mode === 'classic') saveClassicState();
    }
    function getPieceCellPx(isVs) {
      // Prefer live board cell so tray pieces stay proportional after any scale
      try {
        const board = isVs ? document.getElementById('boardMe') : document.getElementById('board');
        if (board) {
          const w = board.getBoundingClientRect().width;
          if (w > 40) {
            const boardCell = w / SIZE;
            return Math.max(isVs ? 8 : 9, Math.min(isVs ? 16 : 22, Math.round(boardCell * 0.42)));
          }
        }
      } catch (_) {}
      const cs = getComputedStyle(document.documentElement);
      if (isVs) {
        const v = parseFloat(cs.getPropertyValue('--versus-piece'));
        return Number.isFinite(v) && v > 0 ? v : 12;
      }
      const v = parseFloat(cs.getPropertyValue('--classic-piece'));
      return Number.isFinite(v) && v > 0 ? v : 16;
    }
    function getPieceSlotPx(isVs) {
      const cell = getPieceCellPx(isVs);
      return Math.max(isVs ? 44 : 56, Math.min(isVs ? 78 : 110, cell * 5 + (isVs ? 8 : 12)));
    }
    function renderPieces(areaEl) {
      // Never overwrite replay trays with live hand
      if (typeof replayMode !== 'undefined' && replayMode) return;
      // Rejoin / desync safety: try restore own hand from match log if empty
      try {
        if ((!pieces || !pieces.length) && (vsModeType === 'online' || mpMode || mode === 'versus')) {
          recoverHandsFromMatchLog();
        }
      } catch (_) {}
      areaEl.innerHTML = '';
      const isVs = mode === 'versus' || (areaEl && areaEl.id === 'piecesAreaVs');
      const cellPx = getPieceCellPx(isVs);
      const slotPx = getPieceSlotPx(isVs);
      if (!pieces || !pieces.length) return;
      pieces.forEach((p, idx) => {
        const slot = document.createElement('div');
        slot.className = 'piece-slot'; slot.dataset.idx = idx;
        if (p.used) { slot.classList.add('used'); areaEl.appendChild(slot); return; }
        slot.style.width = slotPx + 'px';
        slot.style.height = slotPx + 'px';
        slot.style.minWidth = slotPx + 'px';
        const maxR = Math.max(...p.shape.map(s=>s[0])), maxC = Math.max(...p.shape.map(s=>s[1]));
        const gridEl = document.createElement('div');
        gridEl.className = 'piece-grid';
        gridEl.style.gridTemplateColumns = `repeat(${maxC+1},${cellPx}px)`;
        gridEl.style.gridTemplateRows = `repeat(${maxR+1},${cellPx}px)`;
        gridEl.style.gap = isVs ? '1px' : '1.5px';
        const occ = new Set(p.shape.map(([r,c])=>r+','+c));
        for (let r=0;r<=maxR;r++) for (let c=0;c<=maxC;c++) {
          const cell = document.createElement('div');
          if (occ.has(r+','+c)) {
            cell.className='piece-cell';
            paintCellColor(cell, p.color);
            cell.style.width=cellPx+'px';
            cell.style.height=cellPx+'px';
          }
          gridEl.appendChild(cell);
        }
        slot.appendChild(gridEl); areaEl.appendChild(slot);
        setTimeout(() => slot.classList.add('show'), 30+idx*55);
        const startHandler = e => startDrag(e, idx, areaEl);
        if (window.PointerEvent) {
          slot.addEventListener('pointerdown', startHandler, { passive: false });
        } else {
          slot.addEventListener('touchstart', startHandler, { passive: false });
          slot.addEventListener('mousedown', startHandler, { passive: false });
        }
      });
    }
    function markPieceUsed(idx, areaEl) {
      // Never skip marking used — locks only block NEW input, not finishing a placed piece
      if (!pieces[idx]) return;
      pieces[idx].used = true;
      const slot = areaEl && areaEl.querySelector(`.piece-slot[data-idx="${idx}"]`);
      if (!slot) return;
      slot.classList.remove('lifting','show');
      slot.classList.add('used');
      try {
        slot.style.width = '0';
        slot.style.minWidth = '0';
        slot.style.opacity = '0';
        slot.innerHTML = '';
      } catch (_) {}
    }

    function getActiveBoard() { return mode==='versus' ? boardMe : boardEl; }
    function getActiveGrid() { return grid; }
    function getActivePiecesArea() { return mode==='versus' ? piecesAreaVs : piecesArea; }
    function getActiveBanner() { return mode==='versus' ? comboBannerMe : comboBanner; }

    let _metricsDirty = true;
    let _finePointerCached = null;
    function invalidateBoardMetrics() { _metricsDirty = true; }
    function updateBoardMetrics(el) {
      const target = el || getActiveBoard();
      if (!target) return;
      boardRect = target.getBoundingClientRect();
      // Uniform step across the board — robust under any CSS scale/gap
      const step = boardRect.width / SIZE;
      gap = 0;
      cellSize = step;
      // Refine with real first-cell size when available (for visual lift only)
      const c0 = target.children[0];
      if (c0) {
        const r0 = c0.getBoundingClientRect();
        if (r0.width > 4) cellSize = r0.width;
      }
      _metricsDirty = false;
    }
    function ensureBoardMetrics() {
      if (_metricsDirty || !boardRect || boardRect.width < 8) updateBoardMetrics();
    }
    function isFinePointer() {
      if (_finePointerCached != null) return _finePointerCached;
      try {
        _finePointerCached = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
      } catch (_) { _finePointerCached = false; }
      return _finePointerCached;
    }
    /** Finger → board aim point. No magnet — 1:1 with finger, piece lifted above. */
    function aimFromPointer(clientX, clientY) {
      ensureBoardMetrics();
      // Keep aim almost under the finger/cursor — ghost sits just above the contact point
      const fine = isFinePointer();
      const base = cellSize > 4 ? cellSize : 24;
      const lift = fine
        ? Math.max(6, Math.min(18, base * 0.35))
        : Math.max(18, Math.min(36, base * 0.95));
      return { x: clientX, y: clientY - lift, lift };
    }

    function eventClientXY(e) {
      if (!e) return { x: 0, y: 0 };
      if (typeof e.clientX === 'number' && (e.touches === undefined || !e.touches.length)) {
        return { x: e.clientX, y: e.clientY };
      }
      const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      if (t) return { x: t.clientX, y: t.clientY };
      if (typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
      return { x: 0, y: 0 };
    }
    let activeDragPointerId = null;
    function clearAllLifting(areaEl) {
      try {
        const root = areaEl || document;
        root.querySelectorAll('.piece-slot.lifting').forEach(s => {
          if (!s.classList.contains('used')) {
            s.classList.remove('lifting');
            s.classList.add('show');
          }
        });
      } catch (_) {}
    }
    /** Abort any in-progress piece drag (used during rejoin load). */
    function cancelActivePieceDrag() {
      try {
        isDragging = false;
        activeDragPointerId = null;
        dragPiece = null;
        selectedIdx = -1;
        lastPreview = null;
        if (typeof rafId !== 'undefined' && rafId) {
          try { cancelAnimationFrame(rafId); } catch (_) {}
          rafId = 0;
        }
        try { clearPreview(); } catch (_) {}
        try { hideGhost(); } catch (_) {}
        try {
          if (ghost) {
            ghost.classList.remove('visible');
            ghost.style.display = 'none';
          }
        } catch (_) {}
        try { clearAllLifting(); } catch (_) {}
        // Strip document-level drag listeners that may still be attached
        try {
          const noop = () => {};
          document.removeEventListener('pointermove', noop);
          // Named handlers are scoped inside startDrag — force visual restore via re-render
        } catch (_) {}
      } catch (_) {}
    }
    function startDrag(e, idx, areaEl) {
      // Solo rejoin wait is playable — only hard-block during loading overlay
      if (window._rejoinLoading || window._rejoinInputLock || placingLock) return;
      if (!pieces[idx] || pieces[idx].used) return;
      if (mode==='versus' && !vsActive) return;
      // One piece at a time — ignore second finger / multi-touch
      if (isDragging) return;
      if (e && e.pointerId != null && activeDragPointerId != null && e.pointerId !== activeDragPointerId) return;
      // Never hard-lock on playerStuck: if this piece fits, unstick and allow
      if (mode === 'versus' && playerStuck) {
        if (pieceIsPlayable(grid, pieces[idx])) {
          playerStuck = false;
          const w = document.getElementById('stuckWait');
          if (w) w.style.display = 'none';
          if (mpMode) mpSend({ type: 'stuck', stuck: false });
        } else {
          return; // this specific piece can't place
        }
      }
      e.preventDefault(); e.stopPropagation();
      selectedIdx = idx; dragPiece = pieces[idx]; isDragging = true;
      activeDragPointerId = (e && e.pointerId != null) ? e.pointerId : 'mouse';
      SFX.pick();
      const xy0 = eventClientXY(e);
      pointerX = xy0.x; pointerY = xy0.y;
      updateBoardMetrics();
      const slot = e.currentTarget;
      // Ensure no other slot is stuck in lifting from a previous multi-touch
      clearAllLifting(areaEl);
      slot.classList.add('lifting');
      showGhost(dragPiece);
      const slotRect = slot.getBoundingClientRect();
      ghost.classList.add('no-glide');
      invalidateBoardMetrics();
      updateBoardMetrics();
      moveGhost(slotRect.left + slotRect.width / 2, slotRect.top + slotRect.height / 2);
      ghost.style.display = 'block';
      requestAnimationFrame(() => {
        ghost.classList.add('visible');
        const aim = aimFromPointer(pointerX, pointerY);
        updatePreview(aim.x, aim.y);
        // First frame: jump to aim without lag (no-glide already on)
        moveGhost(aim.x, aim.y);
        requestAnimationFrame(() => {
          // Keep no-glide until cell snap decides cell-glide in dragFrame
          _ghostCellKey = '';
          if (isDragging) dragFrame();
        });
      });
      try {
        if (e.pointerId != null && slot.setPointerCapture) slot.setPointerCapture(e.pointerId);
      } catch(_){}
      const onMove = ev => {
        if (!isDragging) return;
        const xy = eventClientXY(ev);
        pointerX = xy.x; pointerY = xy.y;
        if (ev.cancelable && ev.type && ev.type.indexOf('touch') === 0) {
          try { ev.preventDefault(); } catch (_) {}
        }
        if (!rafId) rafId = requestAnimationFrame(dragFrame);
      };
      const unbind = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        document.removeEventListener('touchcancel', onUp);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      const onUp = ev => {
        if (!isDragging) return;
        // Ignore pointerup from a different finger
        if (ev && ev.pointerId != null && activeDragPointerId != null &&
            activeDragPointerId !== 'mouse' && ev.pointerId !== activeDragPointerId) {
          return;
        }
        // Rejoin loading overlay only — solo wait / peer rejoin flag must still allow play
        if (window._rejoinLoading || window._rejoinInputLock || placingLock) {
          isDragging = false;
          activeDragPointerId = null;
          if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
          try {
            if (e.pointerId != null && slot.releasePointerCapture) slot.releasePointerCapture(e.pointerId);
          } catch (_) {}
          try { ghost.classList.remove('visible'); hideGhost(); } catch (_) {}
          try { slot.classList.remove('lifting'); slot.classList.add('show'); } catch (_) {}
          try { clearAllLifting(areaEl); } catch (_) {}
          try { clearPreview(); } catch (_) {}
          lastPreview = null;
          dragPiece = null;
          unbind();
          return;
        }
        isDragging = false;
        activeDragPointerId = null;
        if (rafId) { cancelAnimationFrame(rafId); rafId=0; }
        try {
          if (e.pointerId != null && slot.releasePointerCapture) slot.releasePointerCapture(e.pointerId);
        } catch(_){}
        const xy = eventClientXY(ev);
        pointerX = xy.x; pointerY = xy.y;
        updateBoardMetrics();
        const aim = aimFromPointer(pointerX, pointerY);
        let placed = false;
        if (lastPreview && lastPreview.valid && dragPiece) {
          const pos = getGridPos(aim.x, aim.y);
          if (pos) {
            const maxR = Math.max(...dragPiece.shape.map(s => s[0]));
            const maxC = Math.max(...dragPiece.shape.map(s => s[1]));
            const expectR = pos.r - Math.floor(maxR / 2);
            const expectC = pos.c - Math.floor(maxC / 2);
            if (Math.abs(lastPreview.baseR - expectR) <= 1 && Math.abs(lastPreview.baseC - expectC) <= 1) {
              placed = tryPlaceAt(aim.x, aim.y, lastPreview);
            }
          }
        }
        if (!placed) placed = tryPlaceAt(aim.x, aim.y);
        // Soft lock: settle ghost onto board center before fade (desktop-like, no hard snap)
        try {
          if (placed && lastPreview && lastPreview.valid && dragPiece) {
            const center = placementWorldCenter(lastPreview, dragPiece.shape);
            if (center) {
              ghost.classList.remove('no-glide');
              ghost.classList.add('cell-glide');
              moveGhost(center.x, center.y);
            }
          }
        } catch (_) {}
        ghost.classList.remove('visible');
        setTimeout(hideGhost, placed ? 160 : 100);
        if (placed) markPieceUsed(idx, areaEl);
        else { SFX.bad(); slot.classList.remove('lifting'); slot.classList.add('show'); }
        // Always clear any stuck lifting slots (multi-touch recovery)
        clearAllLifting(areaEl);
        // clearPreview after place must not rewrite filled cells (see clearPreview guard)
        clearPreview(); lastPreview = null;
        dragPiece = null;
        unbind();
      };
      if (window.PointerEvent) {
        document.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      } else {
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
        document.addEventListener('touchcancel', onUp);
        document.addEventListener('mousemove', onMove, { passive: true });
        document.addEventListener('mouseup', onUp);
      }
    }

    /** World center of a placement so the ghost sits flush on those cells */
    function placementWorldCenter(result, shape) {
      if (!boardRect || !result || !shape) return null;
      const step = boardRect.width / SIZE;
      const maxR = Math.max(...shape.map(s => s[0]));
      const maxC = Math.max(...shape.map(s => s[1]));
      const cx = boardRect.left + (result.baseC + (maxC + 1) / 2) * step;
      const cy = boardRect.top + (result.baseR + (maxR + 1) / 2) * step;
      return { x: cx, y: cy };
    }
    let _ghostCellKey = '';
    function dragFrame() {
      rafId = 0; if (!isDragging) return;
      // Cache board rect for the whole drag — measuring every frame forces layout on mobile
      ensureBoardMetrics();
      const aim = aimFromPointer(pointerX, pointerY);
      updatePreview(aim.x, aim.y);
      // Soft cell lock: ghost snaps/glides to placement grid center
      if (lastPreview && dragPiece && boardRect && boardRect.width > 8) {
        const key = lastPreview.baseR + ',' + lastPreview.baseC + ',' + (lastPreview.valid ? 1 : 0);
        const center = placementWorldCenter(lastPreview, dragPiece.shape);
        if (center) {
          if (key !== _ghostCellKey) {
            _ghostCellKey = key;
            ghost.classList.remove('no-glide');
            ghost.classList.add('cell-glide');
          }
          moveGhost(center.x, center.y);
          return;
        }
      }
      // Off-board / free finger: 1:1 follow — no CSS transition lag
      _ghostCellKey = '';
      ghost.classList.add('no-glide');
      ghost.classList.remove('cell-glide');
      moveGhost(aim.x, aim.y);
    }
    function showGhost(piece) {
      ghost.innerHTML = ''; ghost.classList.remove('visible');
      invalidateBoardMetrics();
      updateBoardMetrics();
      let px = 24;
      let gapPx = 2;
      if (boardRect && boardRect.width > 40) {
        const step = boardRect.width / SIZE;
        if (cellSize > 4 && cellSize <= step) {
          px = Math.round(cellSize);
          gapPx = Math.max(1, Math.round(step - cellSize));
        } else {
          px = Math.max(12, Math.min(48, Math.round(step * 0.9)));
          gapPx = Math.max(1, Math.round(step - px));
        }
      }
      const maxR = Math.max(...piece.shape.map(s => s[0]));
      const maxC = Math.max(...piece.shape.map(s => s[1]));
      const gridEl = document.createElement('div');
      gridEl.className = 'piece-grid';
      gridEl.style.gridTemplateColumns = `repeat(${maxC + 1}, ${px}px)`;
      gridEl.style.gridTemplateRows = `repeat(${maxR + 1}, ${px}px)`;
      gridEl.style.gap = gapPx + 'px';
      const occ = new Set(piece.shape.map(([r, c]) => r + ',' + c));
      for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
        const cell = document.createElement('div');
        if (occ.has(r + ',' + c)) {
          cell.className = 'piece-cell';
          paintCellColor(cell, piece.color);
          cell.style.width = px + 'px';
          cell.style.height = px + 'px';
          cell.style.borderRadius = Math.max(3, Math.round(px * 0.18)) + 'px';
        }
        gridEl.appendChild(cell);
      }
      ghost.appendChild(gridEl);
      _ghostCellKey = '';
    }
    function moveGhost(x, y) {
      // Compositor path: --gx/--gy drive translate3d (see #ghost CSS)
      ghost.style.setProperty('--gx', x + 'px');
      ghost.style.setProperty('--gy', y + 'px');
      const scale = ghost.classList.contains('visible') ? 1 : 0.7;
      ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) scale(' + scale + ')';
    }
    function hideGhost() {
      ghost.style.display = 'none';
      ghost.classList.remove('visible', 'cell-glide', 'no-glide');
    }

    function getGridPos(clientX, clientY) {
      ensureBoardMetrics();
      const x = clientX - boardRect.left;
      const y = clientY - boardRect.top;
      const step = boardRect.width / SIZE;
      // Modest pad — stay on the board, less aggressive edge snap
      const pad = step * 0.45;
      if (x < -pad || y < -pad || x > boardRect.width + pad || y > boardRect.height + pad) return null;
      // Nearest cell by center — stable and predictable
      let c = Math.round((x - step / 2) / step);
      let r = Math.round((y - step / 2) / step);
      c = Math.max(0, Math.min(SIZE - 1, c));
      r = Math.max(0, Math.min(SIZE - 1, r));
      return { r, c };
    }
    function findBestPlacement(shape, hintR, hintC) {
      const maxR = Math.max(...shape.map(s => s[0]));
      const maxC = Math.max(...shape.map(s => s[1]));
      // Align piece bbox center under the aim cell (matches ghost -50%/-50%)
      const aimR = hintR - Math.floor(maxR / 2);
      const aimC = hintC - Math.floor(maxC / 2);
      const g = getActiveGrid();

      // Soft assist: only nearest neighbour (radius 1) — less aggressive hop between slots
      const radius = 1;
      let best = null;
      let bestScore = Infinity;
      for (let or = -radius; or <= radius; or++) {
        for (let oc = -radius; oc <= radius; oc++) {
          const r = aimR + or;
          const c = aimC + oc;
          if (!canPlaceOn(g, shape, r, c)) continue;
          const manh = Math.abs(or) + Math.abs(oc);
          // Prefer exact aim strongly; diagonal slightly penalized
          const score = manh * 1.35 + (or !== 0 && oc !== 0 ? 0.35 : 0);
          if (score < bestScore) {
            bestScore = score;
            best = { baseR: r, baseC: c, valid: true };
          }
        }
      }
      // Exact aim wins when valid
      if (canPlaceOn(g, shape, aimR, aimC)) {
        return { baseR: aimR, baseC: aimC, valid: true };
      }
      if (best) return best;

      return {
        baseR: Math.max(0, Math.min(SIZE - 1 - maxR, aimR)),
        baseC: Math.max(0, Math.min(SIZE - 1 - maxC, aimC)),
        valid: false
      };
    }

    // Track only cells currently in preview — avoid scanning the whole board each move
    let _previewCells = [];
    function updatePreview(x,y) {
      const pos = getGridPos(x,y); const board = getActiveBoard();
      if (!pos||!dragPiece) { clearPreview(); lastPreview=null; return; }
      const result = findBestPlacement(dragPiece.shape, pos.r, pos.c);
      // Always keep placement aim for drop accuracy, even when visual preview is off
      if (lastPreview && lastPreview.baseR===result.baseR && lastPreview.baseC===result.baseC && lastPreview.valid===result.valid) {
        return;
      }
      clearPreview();
      lastPreview = result;
      // Visual highlight disabled in settings — do not paint cells (avoids blink via opacity transition)
      if (settings.preview === '0' || document.body.classList.contains('no-preview')) {
        return;
      }
      const cls = result.valid ? 'preview-ok' : 'preview-bad';
      const g = getActiveGrid();
      const color = dragPiece.color;
      _previewCells = [];
      for (const [dr,dc] of dragPiece.shape) {
        const r=result.baseR+dr, c=result.baseC+dc;
        if (r<0||r>=SIZE||c<0||c>=SIZE) continue;
        const cell = board.children[r*SIZE+c];
        if (!cell) continue;
        if (g[r][c]) continue;
        cell.classList.add(cls);
        cell.style.background = color;
        _previewCells.push(cell);
      }
    }
    function clearPreview() {
      const g = getActiveGrid();
      const scrub = (cell, r, col) => {
        if (!cell) return;
        cell.classList.remove('preview-ok', 'preview-bad');
        // CRITICAL: if this cell is now a real filled piece (or mid place anim),
        // do NOT rewrite background/styles — that cancels placeSoft/legendPlace on mobile
        if (cell.classList.contains('filled') || cell.classList.contains('placing')) return;
        if (r >= 0 && g[r] && g[r][col]) {
          cell.style.background = g[r][col];
        } else {
          cell.style.removeProperty('background');
          cell.style.removeProperty('background-color');
          cell.style.removeProperty('background-image');
        }
      };
      if (!_previewCells.length) {
        const board = getActiveBoard();
        if (!board) return;
        for (let i = 0; i < board.children.length; i++) {
          const cell = board.children[i];
          if (!cell.classList.contains('preview-ok') && !cell.classList.contains('preview-bad')) continue;
          scrub(cell, Math.floor(i / SIZE), i % SIZE);
        }
        return;
      }
      for (let i = 0; i < _previewCells.length; i++) {
        const cell = _previewCells[i];
        if (!cell) continue;
        const idx = cell.dataset.idx != null ? parseInt(cell.dataset.idx, 10) : -1;
        const r = idx >= 0 ? Math.floor(idx / SIZE) : -1;
        const col = idx >= 0 ? idx % SIZE : -1;
        scrub(cell, r, col);
      }
      _previewCells = [];
    }


    /** Diamonds from multi-clears: classic and all versus modes (bots, ranked, friends). */
    function canEarnClearDiamonds() {
      return mode === 'classic' || mode === 'versus';
    }
    function tryPlaceAt(x, y, forcedResult) {
      // Only hard rejoin overlay blocks; _mpRejoiningMatch alone must not freeze the player
      if (window._rejoinLoading || window._rejoinInputLock || placingLock) return false;
      const pos = getGridPos(x, y);
      if (!pos || selectedIdx < 0 || !dragPiece) return false;
      const result = (forcedResult && forcedResult.valid) ? forcedResult : findBestPlacement(dragPiece.shape, pos.r, pos.c);
      if (!result.valid) return false;
      placingLock = true;
      hapticTap(14);
      SFX.place();
      const color = dragPiece.color, shape = dragPiece.shape;
      const placedIdx = selectedIdx;
      const board = getActiveBoard(), g = getActiveGrid(), areaEl = getActivePiecesArea(), banner = getActiveBanner();
      for (const [dr,dc] of shape) g[result.baseR+dr][result.baseC+dc] = color;
      pieces[placedIdx].used = true; selectedIdx = -1;
      // Unlock immediately so the next piece can be grabbed without waiting for anim
      placingLock = false;
      // Visual: promote preview cells → filled + restart place anim so mobile sees full soft settle
      const placeCells = [];
      for (const [dr,dc] of shape) {
        const cell = board.children[(result.baseR+dr)*SIZE+(result.baseC+dc)];
        if (!cell) continue;
        // Drop preview classes without wiping paint (avoids A→D skip of placeSoft)
        cell.classList.remove('preview-ok', 'preview-bad');
        paintCellColor(cell, color);
        cell.classList.add('filled');
        cell.classList.remove('placing');
        // Clear any leftover inline anim kills from clear/render paths
        cell.style.removeProperty('animation');
        cell.style.removeProperty('transition');
        cell.style.removeProperty('transform');
        cell.style.removeProperty('opacity');
        placeCells.push(cell);
      }
      // Detach from preview tracking so later clearPreview won't touch these cells
      try {
        if (_previewCells && _previewCells.length) {
          const set = new Set(placeCells);
          _previewCells = _previewCells.filter(c => !set.has(c));
        }
      } catch (_) {}
      // Double-rAF: let the browser commit filled state, then start placeSoft/legendPlace
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          for (let i = 0; i < placeCells.length; i++) {
            const cell = placeCells[i];
            if (!cell || !cell.classList.contains('filled')) continue;
            cell.classList.add('placing');
          }
        });
      });
      const isLegendPlace = document.body.classList.contains('skin-fx-prism');
      try {
        const _mr = Math.max(...shape.map(s => s[0]));
        const _mc = Math.max(...shape.map(s => s[1]));
        window._lastPlaceAnchor = {
          baseR: result.baseR,
          baseC: result.baseC,
          centerR: result.baseR + _mr / 2,
          centerC: result.baseC + _mc / 2
        };
        // Legendary place: soft spark burst at piece center (local)
        if (isLegendPlace && typeof spawnLegendSparks === 'function') {
          const wrap = board.parentElement;
          const cell0 = board.children[result.baseR * SIZE + result.baseC];
          let origin = null;
          if (cell0) {
            const cr = cell0.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            origin = {
              left: cr.left - wr.left + cr.width * (0.5 + _mc / 2),
              top: cr.top - wr.top + cr.height * (0.5 + _mr / 2)
            };
          }
          spawnLegendSparks(wrap, 6 + shape.length, document.body.dataset.skinId, origin);
        }
      } catch (_) {}
      const placePts = shape.length * 10;
      score += placePts;
      if (mode==='versus') {
        matchLog.push({
          type: 'place',
          side: 'me',
          t: Date.now() - matchStartTs,
          shape: (typeof normalize === 'function' ? normalize(shape.map(p => p.slice())) : shape.map(p => p.slice())),
          color,
          r: result.baseR,
          c: result.baseC,
          myScore: score,
          oppScore,
          pieceIdx: (typeof placedIdx === 'number' && placedIdx >= 0) ? placedIdx : -1,
          placePts,
          legendFx: !!isLegendPlace,
          skinId: isLegendPlace ? (document.body.dataset.skinId || equippedSkinId || null) : null
        });
        document.getElementById('myScore').textContent = score;
        try { if (typeof noteMyAction === 'function') noteMyAction(); } catch (_) {}
        try { persistLiveMatch(); } catch (_) {}
        if (mpMode) {
          let netShape = shape.map(p => p.slice());
          try {
            if (typeof normalize === 'function') netShape = normalize(netShape.map(p => p.slice()));
          } catch (_) {}
          mpSend({
            type: 'place',
            shape: netShape,
            color,
            r: result.baseR,
            c: result.baseC,
            score,
            placePts,
            // Exact tray index — opponent must not guess by shape (fixes broken opp tray / replay)
            pieceIdx: (typeof placedIdx === 'number' && placedIdx >= 0) ? placedIdx : -1,
            // Opponent must know our field for matching clear FX
            boardId: equippedBoardId || null,
            // So opponent sees legendary place sparks on their screen
            legendFx: !!isLegendPlace,
            skinId: isLegendPlace ? (document.body.dataset.skinId || equippedSkinId || null) : null
          });
        }
        if (aiStuck && score > oppScore) { endVersus(); return true; }
      } else updateClassicUI();
      // Clear immediately when the piece is placed (classic + versus)
      const runPlaceClear = () => {
        if (!vsActive && mode==='versus') { placingLock = false; return; }
        // Keep .placing so placeSoft is visible even on rapid successive places;
        // clearLinesOn overrides anim only on cells that actually clear.
        const clearInfo = clearLinesOn(g, board);
        const cleared = clearInfo.count || 0;
        if (cleared > 0) {
          clearChain = (clearChain || 0) + 1;
          bumpAchStat('linesCleared', cleared);
          const baseBonus = bonusFor(cleared);
          const chainExtra = chainBonusFor(clearChain);
          const bonus = baseBonus + chainExtra;
          score += bonus;
          if (cleared >= 3 || clearChain >= 2) SFX.combo();
          else SFX.clear(cleared);
          const wrap = board.parentElement;
          const maxR = Math.max(...shape.map(s => s[0]));
          const maxC = Math.max(...shape.map(s => s[1]));
          const placeAnchor = {
            baseR: result.baseR,
            baseC: result.baseC,
            centerR: result.baseR + maxR / 2,
            centerC: result.baseC + maxC / 2
          };
          const positions = getClearFloatPositions(board, clearInfo.rows, clearInfo.cols, placeAnchor);
          showCombo(banner, cleared, bonus, wrap, 'me', {
            chain: clearChain,
            positions,
            baseBonus,
            chainExtra,
            placeAnchor
          });
          // Achievements (classic tracking)
          if (mode === 'classic') {
            const cmax = Math.max(cleared || 0, clearChain || 0);
            if (cmax >= 2) setAchStat('combo2', 1);
            if (cmax >= 3) setAchStat('combo3', 1);
            if (cmax >= 4) setAchStat('megaCombo', 1);
            if (cmax >= 5) setAchStat('combo5', 1);
            if (cmax >= 6) setAchStat('combo6', 1);
            if (cmax >= 7) setAchStat('combo7', 1);
            if (cmax >= 8) setAchStat('combo8', 1);
            if (cmax >= 10) setAchStat('combo10', 1);
          }
          // Diamonds for ×4+ clears: classic, bots, ranked online — NOT friend/lobby matches
          if (cleared >= 4 && canEarnClearDiamonds()) {
            diamonds += cleared >= 6 ? 2 : 1;
            try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
            if (mode === 'classic') updateClassicUI();
            else {
              try {
                const dEl = document.getElementById('diamonds');
                if (dEl) dEl.textContent = diamonds;
                updateMenuStats();
              } catch (_) {}
            }
          } else if (mode === 'classic') {
            updateClassicUI();
          }
          if (mode==='versus') {
            document.getElementById('myScore').textContent = score;
            if (matchLog.length) {
              const last = matchLog[matchLog.length - 1];
              if (last && last.type === 'place' && last.side === 'me') {
                last.myScore = score;
                last.oppScore = oppScore;
                last.cleared = cleared;
                last.bonus = bonus;
                last.baseBonus = baseBonus;
                last.chainExtra = chainExtra;
                last.chain = clearChain;
                last.rows = clearInfo.rows ? clearInfo.rows.slice() : [];
                last.cols = clearInfo.cols ? clearInfo.cols.slice() : [];
              }
            }
            if (mpMode) {
              mpSend({ type: 'score', score });
              mpSend({
                type: 'clear_fx',
                cleared,
                chain: clearChain,
                bonus,
                baseBonus,
                chainExtra,
                rows: clearInfo.rows,
                cols: clearInfo.cols
              });
            }
            if (aiStuck && score > oppScore) { placingLock = false; endVersus(); return; }
          } else updateClassicUI();
        } else {
          clearChain = 0;
        }
        if (mode==='classic') updateClassicUI();
        placingLock = false;
        if (pieces.every(p=>p.used)) {
          setTimeout(() => {
            generatePieces(areaEl);
            if (mode==='classic') setTimeout(checkStuck, 100);
            if (mode==='versus') {
              setPlayerStuck(false);
              // Wait until new pieces painted + board settled
              setTimeout(checkVersusStuck, 400);
            }
          }, 200);
        } else {
          if (mode==='classic') setTimeout(checkStuck, 100);
          // After clearLinesOn (grid already updated) give a beat before stuck check
          if (mode==='versus') setTimeout(checkVersusStuck, 280);
        }
      };
      // Clear fires in the same turn as the place — only yield so the filled paint commits
      requestAnimationFrame(runPlaceClear);
      return true;
    }
    function legendSparkPalette(skinId) {
      const id = skinId || (document.body.dataset && document.body.dataset.skinId) || '';
      if (id === 'cyber') return ['#0aff99', '#00f5ff', '#7b2ff7', '#ff006e', '#4cc9f0', '#b8f2e6'];
      if (id === 'midnight') return ['#5ee7ff', '#7c5cff', '#c9ada7', '#e0e1dd', '#415a77', '#778da9'];
      if (id === 'gold') return ['#ffd700', '#fff3a0', '#ffb703', '#ffe566', '#f4a261', '#ffdb58'];
      return ['#ffd666', '#fff6c8', '#c77dff', '#5ee7ff', '#ff9ecd', '#ffe566'];
    }

    function applyParticleOrigin(el, origin) {
      if (!el) return;
      if (origin && origin.left != null && origin.top != null) {
        el.style.left = origin.left + 'px';
        el.style.top = origin.top + 'px';
        el.style.marginLeft = '0';
        el.style.marginTop = '0';
        el.style.transform = 'translate(-50%, -50%)';
      }
    }
    function spawnLegendSparks(boardWrap, count, skinId, origin) {
      if (!boardWrap || settings.anim === 'off') return;
      const n = Math.max(6, Math.min(18, count || 10));
      const palette = legendSparkPalette(skinId);
      boardWrap.style.position = boardWrap.style.position || 'relative';
      for (let i = 0; i < n; i++) {
        const sp = document.createElement('div');
        const isRing = i % 5 === 0;
        sp.className = 'legend-spark' + (isRing ? ' ring' : '');
        applyParticleOrigin(sp, origin);
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.35;
        const dist = 40 + Math.random() * 85;
        sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
        sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
        const col = palette[i % palette.length];
        if (!isRing) sp.style.background = col;
        sp.style.color = col;
        sp.style.animationDelay = (Math.random() * 0.1) + 's';
        boardWrap.appendChild(sp);
        setTimeout(() => { try { sp.remove(); } catch (_) {} }, 1100);
      }
    }

    function spawnEpicSparks(boardWrap, count, origin) {
      if (!boardWrap || settings.anim === 'off') return;
      const n = Math.max(4, Math.min(12, count || 6));
      const palette = ['#c77dff', '#ffd666', '#5ee7ff', '#ff8fab', '#a78bfa'];
      boardWrap.style.position = boardWrap.style.position || 'relative';
      for (let i = 0; i < n; i++) {
        const sp = document.createElement('div');
        sp.className = 'epic-spark';
        applyParticleOrigin(sp, origin);
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const dist = 28 + Math.random() * 48;
        sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
        sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
        sp.style.background = palette[i % palette.length];
        sp.style.color = palette[i % palette.length];
        boardWrap.appendChild(sp);
        setTimeout(() => { try { sp.remove(); } catch (_) {} }, 900);
      }
    }

    function spawnThemedParticles(boardWrap, skinId, rarity, nLines, origin) {
      if (!boardWrap || settings.anim === 'off') return;
      if (rarity === 'common' || !rarity) return; // common: no FX
      // Intensity by rarity: rare modest, epic medium, legend strong
      let base, mult, distMax, life;
      if (rarity === 'legendary') { base = 10; mult = 4; distMax = 100; life = 1500; }
      else if (rarity === 'epic') { base = 7; mult = 3; distMax = 78; life = 1300; }
      else { base = 4; mult = 2; distMax = 52; life = 1050; } // rare
      const n = Math.max(base, Math.min(base + 12, base + (nLines || 1) * mult));
      boardWrap.style.position = boardWrap.style.position || 'relative';
      const id = skinId || 'default';
      const clsMap = {
        gold: 'gold-shard',
        sakura: 'sakura-petal',
        cyber: 'cyber-bit',
        lava: 'lava-ember',
        toxic: 'toxic-drop',
        ice: 'ice-flake',
        aurora: 'aurora-wisp',
        neon: 'neon-spark',
        royal: 'royal-gem',
        midnight: 'midnight-star',
        candy: 'candy-spark',
        sunset: 'sunset-spark'
      };
      let pclass = clsMap[id];
      if (!pclass) {
        if (rarity === 'legendary') pclass = 'gold-shard';
        else if (rarity === 'epic') pclass = 'royal-gem';
        else if (rarity === 'rare') pclass = 'neon-spark';
        else return;
      }
      const neonCols = ['#39ff14','#ff00ff','#00f5ff','#ffe600','#ff3d81'];
      const sunsetCols = ['#ff6b35','#ffd166','#ef476f','#f4a261'];
      const candyCols = ['#ff8fab','#bde0fe','#ffc8dd','#a2d2ff','#cdb4db'];
      for (let i = 0; i < n; i++) {
        const sp = document.createElement('div');
        sp.className = 'skin-particle ' + pclass;
        if (pclass === 'cyber-bit' && i % 2) sp.classList.add('alt');
        if (pclass === 'neon-spark') {
          const c = neonCols[i % neonCols.length];
          sp.style.background = c;
          sp.style.color = c;
          sp.style.boxShadow = '0 0 10px ' + c + ', 0 0 18px ' + c;
        }
        if (pclass === 'sunset-spark') {
          const c = sunsetCols[i % sunsetCols.length];
          sp.style.background = c;
          sp.style.boxShadow = '0 0 8px ' + c;
        }
        if (pclass === 'candy-spark') {
          const c = candyCols[i % candyCols.length];
          sp.style.background = c;
          sp.style.boxShadow = '0 0 8px ' + c;
        }
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.55;
        const dist = 24 + Math.random() * distMax;
        sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
        sp.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
        sp.style.setProperty('--rot', (120 + Math.random() * 280) + 'deg');
        sp.style.animationDelay = (Math.random() * 0.1) + 's';
        applyParticleOrigin(sp, origin);
        boardWrap.appendChild(sp);
        setTimeout(() => { try { sp.remove(); } catch (_) {} }, life);
      }
    }

    function resolveFloatAnchor(wrap, opts) {
      opts = opts || {};
      // 1) explicit pixel positions
      if (opts.positions && opts.positions.length) {
        const p = opts.positions.find(x => x && x.left != null && x.top != null);
        if (p) return { left: p.left, top: p.top };
      }
      // 2) placeAnchor → measure on board inside wrap
      const board = wrap && wrap.querySelector && wrap.querySelector('.board');
      const a = opts.placeAnchor || window._lastPlaceAnchor;
      if (board && a) {
        if (typeof a.centerR === 'number' && typeof a.centerC === 'number') {
          const p = cellToWrapPos(board, a.centerR, a.centerC);
          if (p) return p;
        }
        if (typeof a.baseR === 'number' && typeof a.baseC === 'number') {
          const p = cellToWrapPos(board, a.baseR, a.baseC);
          if (p) return p;
        }
      }
      return null;
    }
    function showCombo(banner, n, bonus, boardWrap, side, opts) {
      opts = opts || {};
      // Combo labels always run unless animations fully disabled
      if (settings.anim === 'off') return;
      const chain = opts.chain || 0;
      const isCombo = n >= 2 || chain >= 2;
      const wrap = boardWrap || (banner && banner.parentElement);
      if (!banner && wrap) banner = wrap.querySelector('.combo-banner');
      if (!banner && side === 'opp') banner = document.getElementById('comboBannerOpp');
      if (!banner && (side === 'me' || !side)) {
        banner = document.getElementById('comboBannerMe') || document.getElementById('comboBanner');
      }
      let sideKey = side;
      if (!sideKey && wrap) {
        if (wrap.closest && wrap.closest('.player-panel.opp')) sideKey = 'opp';
        else sideKey = 'me';
      }
      if (!sideKey) sideKey = 'me';
      let meta = { id: 'default', rarity: 'common' };
      try { meta = skinMetaForSide(sideKey) || meta; } catch (_) {}

      // Always resolve anchor near last placed piece
      let anchor = resolveFloatAnchor(wrap, opts);
      if (!anchor && opts.positions && opts.positions[0]) anchor = opts.positions[0];
      const positions = (anchor && anchor.left != null)
        ? [{ left: anchor.left, top: anchor.top, kind: 'place' }]
        : (opts.positions || []).filter(p => p && p.left != null);

      if (banner && (n >= 1 || chain >= 2 || bonus > 0)) {
        let label;
        if (chain >= 2 && n >= 2) label = `×${n} · COMBO ×${chain}`;
        else if (chain >= 2) label = `COMBO ×${chain}`;
        else if (n >= 2) label = `×${n}`;
        else label = `+${bonus || 0}`;
        banner.textContent = label;
        // Full class reset so animation always restarts
        banner.className = 'combo-banner';
        try {
          const sf = scoreFloatSkinClass(meta.id, meta.rarity);
          const cb = sf ? sf.replace(/^sf-/, 'cb-') : '';
          if (cb) banner.classList.add(cb);
        } catch (_) {}
        // Pin banner to piece location (not board center)
        if (anchor && anchor.left != null && anchor.top != null) {
          banner.style.left = anchor.left + 'px';
          banner.style.top = anchor.top + 'px';
        } else {
          banner.style.left = '50%';
          banner.style.top = '50%';
        }
        // Force reflow then show — CSS handles fade; auto-clear after anim
        void banner.offsetWidth;
        banner.classList.add('show');
        try {
          clearTimeout(banner._hideT);
          banner._hideT = setTimeout(() => {
            try {
              banner.classList.remove('show');
              banner.textContent = '';
              banner.style.left = '';
              banner.style.top = '';
              banner.style.opacity = '';
            } catch (__) {}
          }, 900);
        } catch (_) {}
      }
      if (wrap && settings.floats !== '0' && bonus) {
        spawnScoreFloat(wrap, bonus, isCombo, meta.rarity, meta.id, positions, chain);
      }
      try {
        if (!wrap || n < 1) return;
        const rar = meta.rarity || 'common';
        if (rar === 'common') return;
        const intensity = Math.max(n || 1, chain || 0);
        if (rar === 'legendary') {
          wrap.classList.remove('legend-combo-flash');
          void wrap.offsetWidth;
          if (anchor && anchor.left != null) {
            wrap.style.setProperty('--flash-x', anchor.left + 'px');
            wrap.style.setProperty('--flash-y', anchor.top + 'px');
          }
          wrap.classList.add('legend-combo-flash');
          setTimeout(() => { try { wrap.classList.remove('legend-combo-flash'); } catch (_) {} }, 650);
          spawnLegendSparks(wrap, 10 + intensity * 3, meta.id, anchor);
          spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
        } else if (rar === 'epic') {
          spawnEpicSparks(wrap, 4 + intensity * 2, anchor);
          spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
        } else if (rar === 'rare') {
          spawnThemedParticles(wrap, meta.id, rar, intensity, anchor);
        }
      } catch (_) {}
    }

    function scoreFloatSkinClass(skinId, rarity) {
      const id = skinId || '';
      if (rarity === 'rare') {
        if (id === 'neon') return 'sf-rare-neon';
        if (id === 'ice') return 'sf-rare-ice';
        if (id === 'sunset') return 'sf-rare-sunset';
        if (id === 'candy') return 'sf-rare-candy';
        return 'sf-rare';
      }
      if (rarity === 'epic') {
        if (id === 'lava') return 'sf-epic-lava';
        if (id === 'royal') return 'sf-epic-royal';
        if (id === 'aurora') return 'sf-epic-aurora';
        if (id === 'sakura') return 'sf-epic-sakura';
        if (id === 'toxic') return 'sf-epic-toxic';
        return 'sf-epic';
      }
      if (rarity === 'legendary') {
        if (id === 'cyber') return 'sf-legend-cyber';
        if (id === 'midnight') return 'sf-legend-midnight';
        if (id === 'gold') return 'sf-legend-gold';
        return 'sf-legend';
      }
      return ''; // common: no special float FX
    }

    function spawnScoreFloat(boardWrap, amount, isCombo, rarityHint, skinId, positions, chain) {
      if (!boardWrap || !amount || settings.floats === '0') return;
      boardWrap.style.position = boardWrap.style.position || 'relative';
      const rar = rarityHint || (document.body.dataset && document.body.dataset.skinRarity) || 'common';
      const skinCls = scoreFloatSkinClass(skinId, rar);
      const life = rar === 'legendary' ? 1400 : rar === 'epic' ? 1200 : rar === 'rare' ? 1250 : 1000;
      let pts = (positions && positions.length)
        ? positions.filter(p => p && p.left != null && p.top != null)
        : [];
      // Fallback: last placed piece on this board
      if (!pts.length) {
        const fb = resolveFloatAnchor(boardWrap, { placeAnchor: window._lastPlaceAnchor });
        if (fb) pts = [fb];
      }
      if (!pts.length) return;
      // One float at placement (or first clear point) with full bonus amount
      const showPts = pts.slice(0, 1);
      showPts.forEach((pt, i) => {
        const el = document.createElement('div');
        el.className = 'score-float'
          + (isCombo ? ' combo' : '')
          + (skinCls ? ' ' + skinCls : '')
          + (chain >= 2 ? ' chain' : '');
        el.textContent = `+${amount}`;
        el.style.left = pt.left + 'px';
        el.style.top = pt.top + 'px';
        el.style.animationDelay = (i * 0.05) + 's';
        boardWrap.appendChild(el);
        setTimeout(() => { try { el.remove(); } catch (_) {} }, life + i * 40);
      });
      // Chain tag near the same place as the score (not board center)
      if (chain >= 2) {
        const base = showPts[0];
        const ch = document.createElement('div');
        ch.className = 'score-float combo chain-tag' + (skinCls ? ' ' + skinCls : '');
        ch.textContent = `×${chain}`;
        ch.style.left = (base.left) + 'px';
        ch.style.top = Math.max(8, base.top - 22) + 'px';
        boardWrap.appendChild(ch);
        setTimeout(() => { try { ch.remove(); } catch (_) {} }, life + 80);
      }
    }
    function checkStuck() {
      if (mode!=='classic') return;
      const available = pieces.filter(p=>!p.used);
      if (!available.length) return;
      if (!available.some(p => findAllPlacements(grid, p.shape).length > 0)) {
        if (diamonds>=1) stuckOfferEl.classList.add('visible');
        else {
          document.getElementById('finalScore').textContent = score;
          const msg = document.getElementById('gameOverMsg');
          if (msg) msg.textContent = 'Места больше нет';
          clearClassicSave();
          gameOverEl.classList.add('visible');
        }
      }
    }
    function doRelief() {
      if (diamonds<1||mode!=='classic') return;
      diamonds--;
      try { bumpAchStat('reliefUsed', 1); } catch (_) {}
      try { if (mode === 'classic') window._classicUsedRelief = true; } catch (_) {} updateClassicUI(); stuckOfferEl.classList.remove('visible');
      let bestR=0,bestRF=0,bestC=0,bestCF=0;
      for (let r=0;r<SIZE;r++) { const f=grid[r].filter(x=>x).length; if(f>bestRF){bestRF=f;bestR=r;} }
      for (let c=0;c<SIZE;c++) { const f=grid.filter(row=>row[c]).length; if(f>bestCF){bestCF=f;bestC=c;} }
      const toClear = new Set();
      if (bestRF>=2) for(let c=0;c<SIZE;c++) if(grid[bestR][c]) toClear.add(bestR*SIZE+c);
      if (bestCF>=2) for(let r=0;r<SIZE;r++) if(grid[r][bestC]) toClear.add(r*SIZE+bestC);
      if (!toClear.size) {
        const filled=[]; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(grid[r][c]) filled.push(r*SIZE+c);
        filled.sort(()=>Math.random()-0.5).slice(0,8).forEach(i=>toClear.add(i));
      }
      const reliefMeta = getClearAnimMeta(boardEl);
      toClear.forEach(idx => {
        const cell = boardEl.children[idx];
        if (!cell) return;
        CLEARING_CLASSES.forEach(c => cell.classList.remove(c));
        cell.classList.add(reliefMeta.cls);
      });
      setTimeout(() => {
        let sumR = 0, sumC = 0, nC = 0;
        toClear.forEach(idx => {
          const r=Math.floor(idx/SIZE),c=idx%SIZE;
          grid[r][c]=null;
          sumR += r; sumC += c; nC++;
        });
        score += toClear.size*15+30; updateClassicUI(); renderGrid(grid, boardEl);
        pieces.forEach(p=>p.used=true); generatePieces(piecesArea);
        const placeAnchor = nC ? { centerR: sumR / nC, centerC: sumC / nC } : null;
        const positions = getClearFloatPositions(boardEl, [], [], placeAnchor);
        showCombo(comboBanner, 0, toClear.size*15+30, boardEl.parentElement, 'me', { positions, placeAnchor });
        setTimeout(checkStuck, 150);
      }, reliefMeta.ms);
    }

    function startVersusFlow() { showScreen('compType'); }

    // —— Offline mode: classic + bots only ——
    function isAppOnline() {
      try {
        if (typeof navigator.onLine === 'boolean') return navigator.onLine;
      } catch (_) {}
      return true;
    }
    function applyOfflineMode(online) {
      const on = !!online;
      try {
        document.body.classList.toggle('is-offline', !on);
      } catch (_) {}
      try { setNetStatus(on, on ? null : 'network'); } catch (_) {}
      const chip = document.getElementById('offlineChip');
      if (chip) chip.style.display = on ? 'none' : '';
      // Soft-disable online entry points
      const card = document.getElementById('cardOnline');
      if (card) {
        card.setAttribute('aria-disabled', on ? 'false' : 'true');
        card.title = on ? '' : 'Нужен интернет для рейтинговых матчей';
      }
    }
    function requireOnline(actionLabel) {
      if (isAppOnline() && typeof Peer !== 'undefined') return true;
      const msg = !isAppOnline()
        ? 'Нет сети. Доступны классика и боты.'
        : 'Онлайн-модуль не загрузился. Можно играть в классику и с ботами.';
      try {
        const t = document.getElementById('infoToast');
        if (t) {
          const lab = document.getElementById('infoToastLabel');
          const tx = document.getElementById('infoToastText');
          if (lab) lab.textContent = actionLabel || 'Оффлайн';
          if (tx) tx.textContent = msg;
          t.classList.add('visible');
          clearTimeout(t._hide);
          t._hide = setTimeout(() => t.classList.remove('visible'), 2800);
        } else {
          showNetBanner('<strong>Оффлайн</strong><br/>' + msg);
        }
      } catch (_) {
        try { showNetBanner('<strong>Оффлайн</strong><br/>' + msg); } catch (__) {}
      }
      return false;
    }
    window.addEventListener('online', () => applyOfflineMode(true));
    window.addEventListener('offline', () => applyOfflineMode(false));
    // Initial state after DOM
    try { applyOfflineMode(isAppOnline()); } catch (_) {}

    function goDurationFromOnline() {
      if (!requireOnline('Рейтинг')) return;
      try { closeRoomLobby(); } catch (_) {}
      try { destroyMp(); } catch (_) {}
      try { stopMatchmaking(true); } catch (_) {}
      mpMode = false;
      mpFromMatchmaking = false;
      mpGameSource = null;
      postMatchOnlineEligible = false;
      currentBot = null;
      vsModeType = 'online';
      showScreen('duration');
    }
    function goDifficulty() {
      try { destroyMp(); } catch (_) {}
      mpMode = false;
      vsModeType = 'bots';
      currentBot = null;
      renderBotList();
      showScreen('difficulty');
    }
    function pickOnlineOpponent() {
      const target = trophies;
      const sorted = [...BOTS].sort((a, b) =>
        Math.abs(a.trophies - target - 80) - Math.abs(b.trophies - target - 80)
      );
      const pool = sorted.slice(0, 5);
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // —— Real online matchmaking (PeerJS queue by trophy bucket ±100) ——
    let mmActive = false;
    let mmPeer = null;
    let mmFound = false;
    let mmHostMode = false;
    let mmDotsTimer = null;
    let mmTimeout = null;
    let mmTryIndex = 0;
    let mmExpandLevel = 0;
    let mmHostBucket = null;
    let mmSearchGen = 0;
    let mmExpandTimers = [];

    // Every ranked-search run gets its own generation. Late PeerJS promises from an
    // older search must never attach themselves to a newer queue.
    function mmGenAlive(gen) {
      return gen === mmSearchGen && mmActive && !mmFound;
    }

    // Skill-based queue: trophy buckets, rating check, expand gap over time
    function mmTrophyBucket(t) {
      return Math.floor(Math.max(0, t) / 50) * 50;
    }
    function mmQueueId(bucket) {
      // Separate queues per match duration + trophy band
      return 'bpmmq6-d' + (vsDuration || 120) + '-b' + bucket;
    }
    /** Allowed trophy gap grows while searching */
    function mmMaxGap() {
      // ±75 → ±100 → ±150 → ±220
      return [75, 100, 150, 220][Math.min(mmExpandLevel, 3)];
    }
    function mmBucketsAround() {
      const b = mmTrophyBucket(trophies);
      const gap = mmMaxGap();
      const set = new Set([b]);
      for (let step = 50; step <= gap + 25; step += 50) {
        if (b - step >= 0) set.add(b - step);
        set.add(b + step);
      }
      // Own skill band first, then nearest bands
      const list = [b];
      for (const x of [...set].sort((a, c) => Math.abs(a - b) - Math.abs(c - b) || a - c)) {
        if (x !== b) list.push(x);
      }
      return list;
    }
    function mmRatingOk(theirT) {
      // Missing/invalid trophies = reject (no open skill gate)
      if (typeof theirT !== 'number' || !Number.isFinite(theirT) || theirT < 0) return false;
      return Math.abs(theirT - trophies) <= mmMaxGap();
    }
    /** Same account / same device probing its own host seat */
    function mmIsSelfHello(data) {
      try {
        if (!data || typeof data !== 'object') return false;
        if (data.code && myFriendCode) {
          if (normalizeFriendCode(data.code) === normalizeFriendCode(myFriendCode)) return true;
        }
        // Fallback: identical nick + trophies while we are hosting (weak but helps)
        if (data.name && data.name === myNickname && typeof data.trophies === 'number' && data.trophies === trophies) {
          if (mmHostMode) return true;
        }
      } catch (_) {}
      return false;
    }
    function mmOwnSeatId() {
      return mmQueueId(mmTrophyBucket(trophies));
    }
    /** Queue peer IDs ordered by skill proximity (optionally skip our hosted seat) */
    function mmSearchTargets() {
      const own = mmOwnSeatId();
      return mmBucketsAround().map(b => mmQueueId(b)).filter(id => {
        // Never dial our own host seat while we hold it — that is self-match
        if (mmHostMode && mmPeer && !mmPeer.destroyed && (id === mmHostBucket || id === own)) return false;
        return true;
      });
    }

    function stopMatchmaking(silent) {
      mmActive = false;
      clearInterval(mmDotsTimer); mmDotsTimer = null;
      clearTimeout(mmTimeout); mmTimeout = null;
      (mmExpandTimers || []).forEach(clearTimeout);
      mmExpandTimers = [];
      if (!mmFound) {
        try { if (mmPeer) mmPeer.destroy(); } catch (_) {}
        mmPeer = null;
      }
      if (!silent) setMpStatus('');
    }

    function mmSetStatus(s, name) {
      const st = document.getElementById('mmStatus');
      const nm = document.getElementById('mmName');
      const box = document.getElementById('mmBox');
      if (st) st.textContent = s;
      if (nm && name !== undefined) nm.textContent = name;
      if (box) {
        const found = /найден|начина|синхрон|Матч/i.test(String(s || ''));
        box.classList.toggle('mm-found', found);
      }
    }

    function mmDurationLabel() {
      const d = vsDuration || 120;
      if (d <= 60) return '1 мин';
      if (d >= 180) return '3 мин';
      return '2 мин';
    }
    function mmUpdateHint() {
      const hint = document.getElementById('mmHint');
      if (!hint) return;
      const g = mmMaxGap();
      const lo = Math.max(0, trophies - g);
      const hi = trophies + g;
      hint.textContent = mmDurationLabel() + ' · уровень 🏆 ' + lo + '–' + hi +
        (mmExpandLevel > 0 ? ' · расширяем' : '');
    }

    /**
     * Elo-style trophy change for real online matches.
     * Win vs higher rating → more cups; win vs lower → fewer.
     * Loss vs higher → fewer cups lost; loss vs lower → more lost.
     */
    function calcOnlineTrophyDelta(won, draw, myT, oppT, duration) {
      if (draw) return 0;
      const K = duration <= 60 ? 24 : duration <= 120 ? 32 : 40;
      const me = Math.max(0, myT | 0);
      const opp = (typeof oppT === 'number') ? Math.max(0, oppT) : me;
      const expected = 1 / (1 + Math.pow(10, (opp - me) / 400));
      if (won) {
        return Math.max(8, Math.min(52, Math.round(K * (1 - expected))));
      }
      // loss: -K * expected  (stronger opp → smaller expected → smaller loss)
      return -Math.max(6, Math.min(42, Math.round(K * expected)));
    }

    function mmAcceptOpponent(conn, role, gen) {
      if (gen == null) gen = mmSearchGen;
      if (gen !== mmSearchGen) { try { conn && conn.close(); } catch (_) {} return; }
      if (mmFound || !mmActive) return;
      mmFound = true;
      mmActive = false;
      clearTimeout(mmTimeout);
      clearInterval(mmDotsTimer);

      mpMode = true;
      mpFromMatchmaking = true;
      mpGameSource = 'ranked';
      mpRole = role;
      mpPeer = mmPeer;
      mmPeer = null;
      mpConn = conn;
      mpOppConnected = true;
      mpReady = true;
      mpOppReady = true;
      currentBot = null;
      vsModeType = 'online';
      try { noteMpRemotePeer(conn); } catch (_) {}

      if (!conn._bpMmDataWired) {
        conn._bpMmDataWired = true;
        conn.on('data', (data) => {
          try { mpOppConnected = true; } catch (_) {}
          onMpMessage(data);
        });
        conn.on('close', () => {
          try { mpOppConnected = false; } catch (_) {}
          if (vsActive && mpMode) handleOpponentDisconnect();
          else if (mpMode && !vsActive && (isMatchLoadActive() || vsIntroLock || mode === 'versus' || mpLoading || mmFound)) {
            // Peer left during handshake / intro — cancel, no AFK
            try { abortPreMatchMissingPeer('Соперник отключился до старта'); } catch (_) {}
          } else if (postMatchOnlineEligible && !vsActive) {
            try {
              hideRematchWait();
              rematchPending = false;
              rematchIWant = false;
            } catch (_) {}
          }
        });
      }
      try { conn._bpRematchWired = true; } catch (_) {}

      try {
        conn.send({
          type: 'hello',
          name: myNickname,
          code: myFriendCode,
          trophies,
          avatarId: myAvatarId,
          skinId: equippedSkinId,
          boardId: equippedBoardId,
          ready: true,
          duration: vsDuration,
          mm: true
        });
      } catch (_) {}

      mmSetStatus('Соперник найден!', 'Синхронизация…');

      let started = false;
      let guestStartWatch = null;
      const startNow = () => {
        if (started) return;
        started = true;
        if (guestStartWatch) { try { clearTimeout(guestStartWatch); } catch (_) {} guestStartWatch = null; }
        oppName = mpOppName || 'Игрок';
        mmSetStatus(
          'Матч начинается',
          oppName + ' · 🏆 ' + (typeof mpOppTrophies === 'number' ? mpOppTrophies : '—')
        );
        setTimeout(() => {
          if (role === 'host') {
            try {
              conn.send({
                type: 'start',
                duration: vsDuration,
                boardId: equippedBoardId,
                skinId: equippedSkinId,
                hostName: myNickname,
                trophies,
                mm: true
              });
            } catch (_) {}
            beginVersusMatchMp(true);
          }
        }, 700);
      };
      setTimeout(startNow, 1100);

      // Guest: if host never sends start, retry once then abort so we do not hang on "Синхронизация"
      if (role === 'guest') {
        guestStartWatch = setTimeout(() => {
          if (started || vsActive || mode === 'versus') return;
          try {
            if (conn && conn.open) {
              conn.send({ type: 'start_req', name: myNickname, trophies, duration: vsDuration });
            }
          } catch (_) {}
          guestStartWatch = setTimeout(() => {
            if (started || vsActive || mode === 'versus') return;
            try {
              mmSetStatus('Соперник не ответил', 'Попробуй поиск снова');
              if (conn) conn.close();
            } catch (_) {}
            try {
              stopMatchmaking(true);
              destroyMp();
            } catch (_) {}
            mmFound = false;
            mmActive = false;
            setTimeout(() => {
              try {
                if (mode !== 'versus' && !vsActive) {
                  showScreen('duration');
                  mmSetStatus('Ищем соперника...', '—');
                }
              } catch (_) {}
            }, 1800);
          }, 2500);
        }, 3500);
      }
    }

    let mpOppTrophies = null;

    /** Host: wait for guest hello, check rating, then accept or reject */
    function mmWireHost(peer, gen) {
      if (gen == null) gen = mmSearchGen;
      if (!mmGenAlive(gen)) { try { peer && peer.destroy(); } catch (_) {} return; }
      peer.on('connection', (conn) => {
        // After the match: allow opponent to re-link for rematch
        if (postMatchOnlineEligible && !vsActive && !mmActive) {
          try { noteMpRemotePeer(conn); } catch (_) {}
          const onOpen = () => {
            try {
              mpConn = conn;
              mpMode = true;
              mpOppConnected = true;
              wireMpConnLifetime(conn);
              mpSend({
                type: 'hello',
                name: myNickname,
                code: myFriendCode,
                trophies,
                avatarId: myAvatarId,
                skinId: equippedSkinId,
                boardId: equippedBoardId,
                rematchReconnect: true
              });
            } catch (_) {}
          };
          if (conn.open) onOpen();
          else conn.on('open', onOpen);
          return;
        }
        // Mid ranked match: shared live accept
        if (vsActive && mpMode) {
          acceptLiveMatchReconnect(conn);
          return;
        }

        if (mmFound || !mmActive) {
          try { conn.close(); } catch (_) {}
          return;
        }
        let decided = false;
        const timeout = setTimeout(() => {
          if (decided) return;
          decided = true;
          try { conn.close(); } catch (_) {}
        }, 12000);

        const tryAccept = (data) => {
          if (decided || mmFound || !mmActive) return;
          // Self-match: our second PeerJS client connected to our own queue seat
          if (mmIsSelfHello(data)) {
            try { conn.send({ type: 'mm_reject', reason: 'self' }); } catch (_) {}
            setTimeout(() => { try { conn.close(); } catch (_) {} }, 80);
            return; // keep seat open for real opponents
          }
          const theirT = data && typeof data.trophies === 'number' ? data.trophies : null;
          // Skill gate: require valid trophies within current window (missing = reject)
          if (!mmRatingOk(theirT)) {
            try {
              conn.send({ type: 'mm_reject', reason: 'rating', myTrophies: trophies });
            } catch (_) {}
            setTimeout(() => { try { conn.close(); } catch (_) {} }, 150);
            mmSetStatus('Рейтинг не подошёл, ждём…', '🏆 ' + trophies + ' ±' + mmMaxGap());
            return; // keep listening for another guest in range
          }
          decided = true;
          clearTimeout(timeout);
          mpOppName = (data && data.name) || 'Игрок';
          if (theirT != null) mpOppTrophies = theirT;
          mmAcceptOpponent(conn, 'host', gen);
        };

        conn.on('data', (data) => {
          if (decided || mmFound || !mmActive) return;
          if (!data || data.type !== 'hello') return;
          tryAccept(data);
        });
        conn.on('open', () => {
          // Announce ourselves so guest can pair even if our hello arrives first
          try {
            conn.send({
              type: 'hello',
              name: myNickname,
              code: myFriendCode,
              trophies,
              skinId: equippedSkinId,
          boardId: equippedBoardId,
              ready: true,
              duration: vsDuration,
              mm: true
            });
          } catch (_) {}
        });
        conn.on('close', () => { clearTimeout(timeout); });
        conn.on('error', () => { clearTimeout(timeout); });
      });
    }

    function mmTryJoinPeerId(peerId, onFail, gen) {
      if (gen == null) gen = mmSearchGen;
      if (!mmGenAlive(gen)) { onFail && onFail(); return; }
      if (!mmActive || mmFound) return;
      // Never dial the seat we ourselves are hosting
      if (mmHostMode && mmPeer && !mmPeer.destroyed && (peerId === mmHostBucket || peerId === mmOwnSeatId())) {
        onFail && onFail();
        return;
      }
      // peerId encodes duration + trophy band; surface skill window to the user
      mmSetStatus('Поиск · ' + mmDurationLabel(), '🏆 ' + trophies + ' ±' + mmMaxGap());
      let settled = false;
      let client = null;
      const fail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { if (client) client.destroy(); } catch (_) {}
        client = null;
        onFail && onFail();
      };
      // Short probe — empty seats fail fast; live hosts answer quickly
      const timer = setTimeout(fail, 4500);
      openGamePeer(null, { attempts: 3, timeoutMs: 7000 }).then((p) => {
        client = p;
        if (settled || mmFound || !mmActive) {
          fail();
          return;
        }
        try { client.on('error', () => { if (!settled) fail(); }); } catch (_) {}
        let conn;
        try {
          conn = client.connect(peerId, { reliable: true });
        } catch (e) {
          fail();
          return;
        }
        conn.on('open', () => {
          if (settled || mmFound || !mmActive) {
            try { conn.close(); client.destroy(); } catch (_) {}
            return;
          }
          try {
            conn.send({
              type: 'hello',
              name: myNickname,
              code: myFriendCode,
              trophies,
              skinId: equippedSkinId,
          boardId: equippedBoardId,
              ready: true,
              duration: vsDuration,
              mm: true
            });
          } catch (_) {}
          mmSetStatus('Нашли очередь — синхронизация…', '');
        });
        conn.on('data', (data) => {
          if (settled || !mmActive || mmFound) return;
          if (!data || typeof data !== 'object') return;
          if (data.type === 'mm_reject') {
            settled = true;
            clearTimeout(timer);
            try { conn.close(); client.destroy(); } catch (_) {}
            mmSetStatus('Ищем дальше…', '');
            onFail && onFail();
            return;
          }
          if (data.type === 'hello' || data.type === 'start') {
            const theirT = typeof data.trophies === 'number' ? data.trophies : null;
            if (mmIsSelfHello(data)) {
              // Connected to our own host seat — drop and keep searching
              settled = true;
              clearTimeout(timer);
              try { conn.close(); client.destroy(); } catch (_) {}
              onFail && onFail();
              return;
            }
            if (!mmRatingOk(theirT)) {
              settled = true;
              clearTimeout(timer);
              try { conn.send({ type: 'mm_reject', reason: 'rating' }); } catch (_) {}
              try { conn.close(); client.destroy(); } catch (_) {}
              onFail && onFail();
              return;
            }
            settled = true;
            clearTimeout(timer);
            // Leave our host seat so others can claim the queue id
            try { if (mmPeer && mmPeer !== client) mmPeer.destroy(); } catch (_) {}
            mmHostMode = false;
            mmPeer = client;
            if (theirT != null) mpOppTrophies = theirT;
            if (data.name) mpOppName = data.name;
            if (data.hostName) mpOppName = data.hostName;
            mmAcceptOpponent(conn, 'guest', gen);
            if (data.type === 'start') {
              // Host already started — apply start payload
              setTimeout(() => {
                try { onMpMessage(data); } catch (_) {}
              }, 50);
            }
          }
        });
        conn.on('error', fail);
        conn.on('close', () => {
          if (!settled) fail();
        });
      }).catch(() => fail());
    }

    function mmBecomeHost(peerId, gen) {
      if (gen == null) gen = mmSearchGen;
      if (!mmGenAlive(gen)) return;
      if (!mmActive || mmFound) return;
      mmHostBucket = peerId;
      mmHostMode = true;
      const g = mmMaxGap();
      mmSetStatus('Очередь · ' + mmDurationLabel(), '🏆 ' + trophies + ' ±' + g);
      mmUpdateHint();
      try { if (mmPeer) mmPeer.destroy(); } catch (_) {}
      mmPeer = null;

      openGamePeer(peerId, { attempts: 4, timeoutMs: 12000 })
        .then((peer) => {
          if (!mmGenAlive(gen)) {
            try { peer.destroy(); } catch (_) {}
            return;
          }
          mmPeer = peer;
          mmWireHost(peer, gen);
          mmSetStatus('Ждём соперника · ' + mmDurationLabel(), '🏆 ' + trophies + ' ±' + g);
          peer.on('error', (err) => {
            if (!mmGenAlive(gen)) { try { peer.destroy(); } catch (_) {} return; }
            if (err && err.type === 'unavailable-id') {
              try { peer.destroy(); } catch (_) {}
              mmPeer = null;
              mmHostMode = false;
              // Someone else hosts — join them
              mmTryJoinPeerId(peerId, () => {
                if (!mmGenAlive(gen)) return;
                mmRunSearchStep(gen);
              }, gen);
            } else if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) {
              try { peer.destroy(); } catch (_) {}
              mmPeer = null;
              mmHostMode = false;
              setTimeout(() => {
                if (mmGenAlive(gen)) mmBecomeHost(peerId, gen);
              }, 1200);
            }
          });
          peer.on('disconnected', () => {
            if (!mmGenAlive(gen)) return;
            try { if (peer && !peer.destroyed) peer.reconnect(); } catch (_) {}
          });
        })
        .catch((err) => {
          if (!mmGenAlive(gen)) return;
          if (err && err.type === 'unavailable-id') {
            mmHostMode = false;
            mmTryJoinPeerId(peerId, () => {
              if (!mmGenAlive(gen)) return;
              mmRunSearchStep(gen);
            }, gen);
            return;
          }
          mmHostMode = false;
          setTimeout(() => {
            if (mmGenAlive(gen)) mmBecomeHost(peerId, gen);
          }, 1500);
        });
    }

    function mmRunSearchStep(gen) {
      if (gen == null) gen = mmSearchGen;
      if (!mmGenAlive(gen)) return;
      const targets = mmSearchTargets();
      if (mmTryIndex < targets.length) {
        const id = targets[mmTryIndex++];
        // Already hosting this seat — skip self-join
        if (mmHostMode && mmPeer && !mmPeer.destroyed && id === mmHostBucket) {
          mmRunSearchStep(gen);
          return;
        }
        mmTryJoinPeerId(id, () => {
          if (!mmGenAlive(gen)) return;
          mmRunSearchStep(gen);
        }, gen);
      } else {
        // Finished a probe pass
        if (!mmHostMode || !mmPeer || mmPeer.destroyed) {
          mmBecomeHost(mmQueueId(mmTrophyBucket(trophies)), gen);
        }
        // Keep scanning nearby seats while we wait as host
        setTimeout(() => {
          if (!mmGenAlive(gen)) return;
          mmTryIndex = 0;
          mmRunSearchStep(gen);
        }, 2800);
      }
    }

    function startOnlineMatchmaking() {
      try { document.body.classList.remove('vs-bots'); } catch (_) {}
      if (!checkCrossPlatformReady()) return;
      if (typeof Peer === 'undefined') {
        alert('Нужен интернет для поиска игроков.');
        return;
      }
      // New queue generation: stale PeerJS promises from the previous queue are invalid.
      const searchGen = ++mmSearchGen;
      const selectedDuration = (vsDuration === 60 || vsDuration === 120 || vsDuration === 180) ? vsDuration : 120;
      vsDuration = selectedDuration;
      vsTimeLeft = selectedDuration;
      // Tell the old post-match opponent that this player is entering a fresh ranked queue.
      // This prevents a simultaneous rematch click from racing the old connection teardown.
      try {
        if (postMatchOnlineEligible && mpConn && mpConn.open) {
          mpConn.send({ type: 'ranked_search_start' });
        }
      } catch (_) {}
      // Tear down any previous room / friendly / rematch link so we never re-pair the same foe
      try { closeRoomLobby(); } catch (_) {}
      try { destroyMp(); } catch (_) {}
      stopMatchmaking(true);
      mmActive = true;
      mmFound = false;
      mmHostMode = false;
      mmTryIndex = 0;
      mmExpandLevel = 0;
      try { window._matchEnded = false; window._rankedDeltaApplied = false; window._preMatchAborting = false; } catch (_) {}
      mpOppTrophies = null;
      mpOppName = 'Соперник';
      currentBot = null;
      postMatchOnlineEligible = false;
      mpFromMatchmaking = true;
      mpGameSource = 'ranked';
      mpRemotePeerId = null;
      vsModeType = 'online';
      showScreen('match');
      mmSetStatus('Ищем игроков в очереди…', '');
      mmUpdateHint();

      let dots = 0;
      mmDotsTimer = setInterval(() => {
        if (mmFound) return;
        dots = (dots + 1) % 4;
        const nm = document.getElementById('mmName');
        if (nm && !mmHostMode) nm.textContent = 'Очередь' + '.'.repeat(dots);
      }, 400);

      // Widen skill window over time. If still probing (not hosting), re-scan.
      // If already hosting own band — keep the seat so guests can still connect.
      mmExpandTimers = [15000, 30000, 50000].map((ms, i) => setTimeout(() => {
        if (!mmGenAlive(searchGen)) return;
        mmExpandLevel = i + 1;
        mmUpdateHint();
        const durLabel = (vsDuration === 60 ? '1' : vsDuration === 180 ? '3' : '2') + ' мин';
        mmSetStatus('Расширяем подбор · ' + durLabel, '🏆 ±' + mmMaxGap());
        if (mmHostMode && mmPeer && !mmPeer.destroyed) {
          // Stay in queue as host; wider gap only affects who we accept
          mmSetStatus('В очереди · ' + durLabel, '🏆 ' + trophies + ' ±' + mmMaxGap());
          return;
        }
        mmTryIndex = 0;
        mmRunSearchStep(searchGen);
      }, ms));

      mmTimeout = setTimeout(() => {
        (mmExpandTimers || []).forEach(clearTimeout);
        mmExpandTimers = [];
        if (mmFound || !mmActive) return;
        stopMatchmaking(true);
        mmSetStatus('Нет игроков вашего уровня', 'Попробуй ещё или комнату с другом');
      }, 90000);

      // Parallel: claim our seat ASAP, probe OTHER seats after host is likely registered
      const ownSeat = mmOwnSeatId();
      setTimeout(() => {
        if (!mmGenAlive(searchGen)) return;
        mmBecomeHost(ownSeat, searchGen);
      }, 60 + Math.random() * 400);
      setTimeout(() => {
        if (!mmGenAlive(searchGen)) return;
        mmTryIndex = 0;
        mmRunSearchStep(searchGen);
      }, 900 + Math.random() * 600);
    }

    function startMatchFlow() {
      const lobbyEl = document.getElementById('roomLobby');
      const lobbyOpen = !!(lobbyEl && lobbyEl.classList.contains('visible'));
      const inLobbySession = !!(mpRoomCode || mpGameSource === 'lobby' || lobbyOpen);

      // Private room / challenge lobby — never ranked search
      if (inLobbySession && mpMode && mpRole === 'host' && mpConn && mpConn.open && !mmActive) {
        if (lobbyOpen || mpOppConnected) {
          postMatchOnlineEligible = false;
          oppName = mpOppName || 'Соперник';
          currentBot = null;
          mpFromMatchmaking = false;
          mpGameSource = 'lobby';
          mpSend({
            type: 'start',
            duration: vsDuration || mpLobbyDuration || 120,
            boardId: equippedBoardId,
            skinId: equippedSkinId,
            hostName: myNickname,
            trophies,
            lobby: true
          });
          beginVersusMatchMp(true);
          return;
        }
        // Lobby exists but opponent not ready — do not start ranked
        return;
      }
      if (inLobbySession) return; // guest / incomplete lobby: stay put

      // Ranked only when not in a private room
      if (vsModeType === 'online' && mpGameSource !== 'lobby' && !mpRoomCode) {
        startOnlineMatchmaking();
        return;
      }
      // Bots (default when vsModeType === 'bots')
      currentBot = BOTS.find(b => b.id === selectedBotId) || BOTS[5] || BOTS[0];
      oppName = currentBot ? currentBot.name : 'Бот';
      vsModeType = 'bots';
      mpMode = false;
      beginVersusMatch();
    }
    function beginVersusMatch() {
      try { clearBoardScoreFX(); } catch (_) {}
      // Bot match must not inherit leftover multiplayer flags from a previous online game
      try {
        // Soft-clear MP without relying on async peer teardown
        clearMpJoinTimer();
        try { if (mpConn) mpConn.close(); } catch (_) {}
        try { if (mpPeer) mpPeer.destroy(); } catch (_) {}
      } catch (_) {}
      mpConn = null;
      mpPeer = null;
      mpMode = false;
      mpRole = null;
      mpRoomCode = null;
      mpReady = false;
      mpOppReady = false;
      mpOppConnected = false;
      mpMatchStarting = false;
      mpFromMatchmaking = false;
      mpPendingJoin = null;
      mpExpectedJoinCode = null;
      try { window._matchEnded = false; window._rankedDeltaApplied = false; } catch (_) {}
      vsModeType = 'bots';
      mode = 'versus';
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      pendingRematchOfferName = null;
      if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }

      showScreen('versus');
      document.body.classList.remove('replay-ui');
      const fb = document.getElementById('btnForfeit');
      if (fb) fb.style.display = '';
      grid = Array.from({length:SIZE},()=>Array(SIZE).fill(null));
      oppGrid = Array.from({length:SIZE},()=>Array(SIZE).fill(null));
      score = 0; oppScore = 0; vsTimeLeft = vsDuration;
      window._matchEnded = false;
      vsActive = true; placingLock = false; aiBusy = false;
      playerStuck = false; aiStuck = false;
      clearChain = 0; oppClearChain = 0;
      oppPieces = [];
      matchLog = [];
      matchStartTs = Date.now();
      replayMode = false;
      if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
      const waitEl = document.getElementById('stuckWait');
      if (waitEl) waitEl.style.display = 'none';
      const oppWait = document.getElementById('oppStuckWait');
      if (oppWait) oppWait.style.display = 'none';
      const reviewBar = document.getElementById('reviewBar');
      if (reviewBar) reviewBar.classList.remove('visible');
      const liveCtrl = document.getElementById('vsLiveControls');
      if (liveCtrl) liveCtrl.style.display = '';
      const footer = document.getElementById('vsFooter');
      if (footer) footer.style.display = '';
      const piecesVs = document.getElementById('piecesAreaVs');
      if (piecesVs) { piecesVs.style.opacity = '1'; piecesVs.style.pointerEvents = ''; }
      document.getElementById('versusResult').classList.remove('visible');
      hideRematchOffer();
      hideRematchWait();
      try { closeRoomLobby(); } catch (_) {}
      createBoardDOM(boardMe); createBoardDOM(boardOpp);
      applyBoardScales();
      try { window.mpOppSkinId = null; } catch (_) {}
      try { document.body.classList.add('vs-bots'); } catch (_) {}
      try { clearOppSkin(); } catch (_) {}
      try { applyOppSkin('default'); } catch (_) {}
      try { applyEquippedBoard(); } catch (_) {}
      try {
        window.mpOppBoardId = 'field_default';
        applyOppBoard('field_default');
      } catch (_) {}
      renderGrid(grid, boardMe); renderGrid(oppGrid, boardOpp);
      document.getElementById('myScore').textContent = '0';
      document.getElementById('oppScore').textContent = '0';
      if (!currentBot) currentBot = BOTS.find(b => b.id === selectedBotId) || BOTS[0] || BOTS[5];
      if (!currentBot && BOTS.length) currentBot = BOTS[0];
      oppName = (currentBot && currentBot.name) || 'Бот';
      document.getElementById('oppName').innerHTML =
        `${botAvatarHTML(currentBot, 24)} <span>${oppName}</span>` +
        (currentBot && typeof currentBot.trophies === 'number'
          ? `<span style="opacity:0.85;font-weight:700;font-size:0.72rem;margin-left:5px;color:var(--trophy);flex-shrink:0;white-space:nowrap">🏆 ${currentBot.trophies}</span>`
          : '');
      try { updateVersusNameLabels(); } catch (_) {}
      document.getElementById('trophiesLive').textContent = trophies;
      const speechEl = document.getElementById('botSpeech');
      if (speechEl) speechEl.classList.remove('visible');
      updateTimerDisplay();
      generatePieces(piecesAreaVs || piecesVs);
      // generatePieces already logs deal('me') when vsActive — do not double-log
      if (!matchLog.some(e => e && e.type === 'deal' && e.side === 'me')) {
        try { logDeal('me', pieces); } catch (_) {}
      }
      oppPieces = [randomBotPiece(), randomBotPiece(), randomBotPiece()];
      renderOppPieces();
      logDeal('opp', oppPieces);
      updateBoardMetrics(boardMe);
      // Pause clocks until intro finishes
      vsActive = false;
      if (vsTimerId) clearInterval(vsTimerId);
      if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
      const botLabel = (currentBot && currentBot.name) ? currentBot.name : 'Бот';
      const durLabel = vsDuration === 60 ? '1 мин' : vsDuration === 180 ? '3 мин' : '2 мин';
      showMatchIntro({
        label: 'Versus · боты',
        title: 'Бой',
        sub: botLabel + ' · ' + durLabel,
        goText: 'Вперёд!',
        ms: 1500
      }).then(() => {
        if (mode !== 'versus') return;
        vsActive = true;
        window._matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
        startMatchWallClock(window._matchClockEndTs);
        const base = (currentBot && currentBot.interval) || 900;
        const jitter = (currentBot && currentBot.style && currentBot.style.speedJitter) || 0.25;
        const tickMs = Math.max(400, base + Math.random() * (base * jitter));
        aiBusy = false;
        aiInterval = setInterval(() => {
          try { aiTick(); } catch (e) { console.warn('aiTick', e); aiBusy = false; }
        }, tickMs);
        setTimeout(() => { try { aiTick(); } catch (_) {} }, 450);
        setTimeout(() => showBotPhrase('start'), 600);
      });
    }
    function updateTimerDisplay() {
      const m = Math.floor(vsTimeLeft/60), s = vsTimeLeft%60;
      timerEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      timerEl.classList.toggle('urgent', vsTimeLeft<=15);
      if (vsActive && vsTimeLeft > 0 && vsTimeLeft <= 10) SFX.tick();
    }
    function getBoardCellMetrics(boardEl) {
      try {
        const el = boardEl || boardOpp || boardMe || boardEl;
        if (!el) return { px: 18, gap: 2 };
        const rect = el.getBoundingClientRect();
        if (rect.width < 40) return { px: 18, gap: 2 };
        const step = rect.width / SIZE;
        const gap = Math.max(1, Math.min(4, step * 0.08));
        const px = Math.max(10, Math.round(step - gap));
        return { px, gap: Math.max(1, Math.round(gap)) };
      } catch (_) {
        return { px: 18, gap: 2 };
      }
    }
    function buildPieceGhostHTML(piece, cellPx, gapPx) {
      const maxR = Math.max(...piece.shape.map(s=>s[0]));
      const maxC = Math.max(...piece.shape.map(s=>s[1]));
      const occ = new Set(piece.shape.map(([r,c])=>r+','+c));
      const col = (piece.color && String(piece.color).trim()) ? String(piece.color).trim() : '#00d4aa';
      const px = Math.max(8, Math.round(cellPx || 18));
      const gap = (gapPx != null) ? gapPx : Math.max(1, Math.round(px * 0.08));
      const rad = Math.max(3, Math.round(px * 0.18));
      // Same paint vars as board cells so every rarity looks identical in flight
      const cellStyle = `width:${px}px;height:${px}px;border-radius:${rad}px;background:${col};background-color:${col};background-image:none;--cell-base:${col};--cell-glow:${col}`;
      let html = `<div class="piece-grid" style="grid-template-columns:repeat(${maxC+1},${px}px);grid-template-rows:repeat(${maxR+1},${px}px);gap:${gap}px">`;
      for (let r=0;r<=maxR;r++) for (let c=0;c<=maxC;c++) {
        if (occ.has(r+','+c)) html += `<div class="piece-cell" style="${cellStyle}"></div>`;
        else html += `<div></div>`;
      }
      return html + '</div>';
    }

    function shapeKey(shape) {
      try {
        if (!Array.isArray(shape) || !shape.length) return '';
        let cells = shape.map(p => [p[0]|0, p[1]|0]);
        try {
          if (typeof normalize === 'function') cells = normalize(cells);
        } catch (_) {}
        return cells.map(p => p[0] + ',' + p[1]).sort().join('|');
      } catch (_) { return ''; }
    }
    function colorKey(c) {
      return String(c || '').trim().toLowerCase();
    }
    /** Find unused opp tray index matching placed shape (and color when possible) */
    function findOppTrayIdx(shape, color) {
      if (!oppPieces || !oppPieces.length) return -1;
      const sk = shapeKey(shape);
      const ck = colorKey(color);
      let shapeOnly = -1;
      for (let i = 0; i < oppPieces.length; i++) {
        const p = oppPieces[i];
        if (!p || p.used || !p.shape) continue;
        if (shapeKey(p.shape) !== sk) continue;
        if (ck && colorKey(p.color) === ck) return i;
        if (shapeOnly < 0) shapeOnly = i;
      }
      return shapeOnly;
    }

    function aiTick() {
      // Bot AI only — ignore leftover mpMode from previous online matches
      if (!vsActive || aiBusy) return;
      if (vsModeType !== 'bots') return;
      if (!currentBot && BOTS && BOTS.length) currentBot = BOTS[0];
      const profile = currentBot || (BOTS && BOTS[5]) || { skill: 0.5, mistake: 0.2, interval: 1000 };

      // New set if empty or all used
      if (!oppPieces.length || oppPieces.every(p => p.used)) {
        oppPieces = [randomBotPiece(), randomBotPiece(), randomBotPiece()];
        renderOppPieces();
        logDeal('opp', oppPieces);
        if (piecesTrulyUnplayable(oppGrid, oppPieces)) {
          setAiStuck(true);
          evaluateMatchEnd();
          return;
        }
        setAiStuck(false);
      }

      // Re-verify stuck each tick — recover if a piece actually fits (fixes false positives)
      if (aiStuck) {
        if (!piecesTrulyUnplayable(oppGrid, oppPieces)) {
          setAiStuck(false);
        } else {
          evaluateMatchEnd();
          return;
        }
      }

      const available = oppPieces.filter(p => !p.used);
      if (!available.length) {
        // Force deal next tick
        oppPieces = [];
        return;
      }

      // Rare soft hesitation — never skip more than once in a row (prevents frozen bots)
      if (!aiTick._skip && Math.random() < (profile.mistake || 0) * 0.12) {
        aiTick._skip = true;
        return;
      }
      aiTick._skip = false;

      // Always search exhaustively for ANY legal move first (skill only picks among legal)
      let move = findBestMove(oppGrid, oppPieces, profile.skill);
      if (move && Math.random() > profile.skill) {
        const playable = [];
        oppPieces.forEach((piece, idx) => {
          if (piece.used) return;
          const all = findAllPlacements(oppGrid, piece.shape);
          if (all.length) {
            const pos = all[Math.floor(Math.random() * all.length)];
            playable.push({ piece, idx, pos, sc: 0 });
          }
        });
        if (playable.length) move = playable[Math.floor(Math.random() * playable.length)];
      }

      if (!move) {
        // Hard check: only stuck if zero legal placements remain
        if (piecesTrulyUnplayable(oppGrid, oppPieces)) {
          setAiStuck(true);
          evaluateMatchEnd();
        }
        return;
      }
      setAiStuck(false);

      const chosen = move.piece;
      const pos = move.pos;
      const chosenIdx = move.idx;

      aiBusy = true;
      // Resolve tray index before marking used (DOM still has the piece)
      let resolvedIdx = (typeof chosenIdx === 'number') ? chosenIdx : -1;
      if (resolvedIdx < 0 || !oppPieces[resolvedIdx] || oppPieces[resolvedIdx] !== chosen) {
        resolvedIdx = findOppTrayIdx(chosen.shape, chosen.color);
      }
      chosen.used = true;

      // Lift visual on opponent piece slot
      const oppArea = document.getElementById('piecesAreaOpp');
      let slotEl = oppArea && resolvedIdx >= 0
        ? oppArea.querySelector(`.piece-slot[data-opp-idx="${resolvedIdx}"]`)
        : null;
      if (!slotEl && oppArea) {
        // fallback: first non-used visible slot
        slotEl = oppArea.querySelector('.piece-slot:not(.used)');
      }
      if (slotEl) slotEl.classList.add('lifting');

      // Animate piece from slot → board cell
      const aiGhost = document.getElementById('aiGhost');
      const oppRect = boardOpp.getBoundingClientRect();
      const step = (oppRect.width - 2.5 * (SIZE - 1)) / SIZE;
      const maxR = Math.max(...chosen.shape.map(s => s[0]));
      const maxC = Math.max(...chosen.shape.map(s => s[1]));
      const targetX = oppRect.left + (pos.c + maxC / 2) * (step + 2.5) + step / 2;
      const targetY = oppRect.top + (pos.r + maxR / 2) * (step + 2.5) + step / 2;

      let startX = oppRect.left + oppRect.width / 2;
      let startY = oppRect.bottom + 20;
      if (slotEl) {
        const sr = slotEl.getBoundingClientRect();
        startX = sr.left + sr.width / 2;
        startY = sr.top + sr.height / 2;
      }

      try { setAiGhostSkin('opp'); } catch (_) {}
      {
        const m = getBoardCellMetrics(boardOpp);
        aiGhost.innerHTML = buildPieceGhostHTML(chosen, m.px, m.gap);
      }
      aiGhost.style.transition = 'none';
      aiGhost.style.left = startX + 'px';
      aiGhost.style.top = startY + 'px';
      aiGhost.style.display = 'block';
      aiGhost.style.opacity = '1';
      aiGhost.style.visibility = 'visible';
      aiGhost.style.zIndex = '50';
      void aiGhost.offsetWidth;
      aiGhost.style.transition = 'left 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          aiGhost.style.left = targetX + 'px';
          aiGhost.style.top = targetY + 'px';
        });
      });

      setTimeout(() => {
        if (!vsActive) { aiBusy = false; aiGhost.style.display = 'none'; return; }

        // Actually place on grid
        for (const [dr, dc] of chosen.shape) {
          oppGrid[pos.r + dr][pos.c + dc] = chosen.color;
        }
        oppScore += chosen.shape.length * 10;
        let _botIdx = -1;
        try {
          if (oppPieces && chosen) {
            for (let i = 0; i < oppPieces.length; i++) {
              if (oppPieces[i] === chosen) { _botIdx = i; break; }
            }
          }
        } catch (_) {}
        matchLog.push({
          type: 'place',
          side: 'opp',
          t: Date.now() - matchStartTs,
          shape: (typeof normalize === 'function'
            ? normalize(chosen.shape.map(p => p.slice()))
            : chosen.shape.map(p => p.slice())),
          color: chosen.color,
          r: pos.r,
          c: pos.c,
          myScore: score,
          oppScore,
          pieceIdx: _botIdx,
          placePts: chosen.shape.length * 10
        });

        for (const [dr, dc] of chosen.shape) {
          const cell = boardOpp.children[(pos.r + dr) * SIZE + (pos.c + dc)];
          if (cell) {
            paintCellColor(cell, chosen.color);
            cell.classList.add('filled', 'placing');
            setTimeout(() => cell.classList.remove('placing'), 780);
          }
        }

        aiGhost.style.opacity = '0';
        setTimeout(() => { aiGhost.style.display = 'none'; }, 150);

        // Collapse used piece in opponent tray (same as live player UX)
        if (slotEl) {
          slotEl.classList.remove('lifting');
          slotEl.classList.add('used');
        }

        setTimeout(() => {
          if (!vsActive) { aiBusy = false; return; }
          const clearInfo = clearLinesOn(oppGrid, boardOpp);
          const cleared = clearInfo.count || 0;
          if (cleared > 0) {
            oppClearChain = (oppClearChain || 0) + 1;
            const bonus = bonusFor(cleared) + chainBonusFor(oppClearChain);
            oppScore += bonus;
            const maxRa = Math.max(...chosen.shape.map(s => s[0]));
            const maxCa = Math.max(...chosen.shape.map(s => s[1]));
            const placeAnchor = {
              baseR: pos.r, baseC: pos.c,
              centerR: pos.r + maxRa / 2,
              centerC: pos.c + maxCa / 2
            };
            const positions = getClearFloatPositions(boardOpp, clearInfo.rows, clearInfo.cols, placeAnchor);
            const oppBanner = document.getElementById('comboBannerOpp');
            showCombo(oppBanner, cleared, bonus, boardOpp.parentElement, 'opp', {
              chain: oppClearChain,
              positions,
              placeAnchor
            });
            if ((cleared >= 3 || oppClearChain >= 2) && Math.random() < 0.35) showBotPhrase('clear');
            else if (cleared >= 2 && Math.random() < 0.18) showBotPhrase('clear');
          } else {
            oppClearChain = 0;
          }
          // Occasional lead/behind comments
          if (Math.random() < 0.12) {
            if (oppScore > score + 250 && Math.random() < 0.28) showBotPhrase('lead');
            else if (score > oppScore + 250 && Math.random() < 0.28) showBotPhrase('behind');
          }
          document.getElementById('oppScore').textContent = oppScore;
          if (matchLog.length && matchLog[matchLog.length - 1].side === 'opp') {
            const last = matchLog[matchLog.length - 1];
            last.oppScore = oppScore;
            last.myScore = score;
            if (cleared > 0) {
              const bb = bonusFor(cleared);
              const ce = chainBonusFor(oppClearChain);
              last.cleared = cleared;
              last.bonus = bb + ce;
              last.baseBonus = bb;
              last.chainExtra = ce;
              last.chain = oppClearChain;
              last.rows = clearInfo.rows ? clearInfo.rows.slice() : [];
              last.cols = clearInfo.cols ? clearInfo.cols.slice() : [];
            }
          }
          // Skip renderGrid when nothing cleared — preserves placeSoft on just-landed cells

          // New set only here — always log for replay chronology
          if (oppPieces.every(p => p.used)) {
            oppPieces = [randomBotPiece(), randomBotPiece(), randomBotPiece()];
            renderOppPieces();
            logDeal('opp', oppPieces);
          }
          aiBusy = false;
          onAiScoreChanged();
        }, 0);

        document.getElementById('oppScore').textContent = oppScore;
        onAiScoreChanged();
      }, 400);
    }

    function playerHasMoves() {
      const available = pieces.filter(p => !p.used);
      if (!available.length) return true;
      return !piecesTrulyUnplayable(grid, pieces);
    }
    function aiHasMoves() {
      if (!oppPieces.length) return true;
      const available = oppPieces.filter(p => !p.used);
      if (!available.length) return true;
      return !piecesTrulyUnplayable(oppGrid, oppPieces);
    }
    function confirmPlayerStuck() {
      if (placingLock) return false;
      return piecesTrulyUnplayable(grid, pieces);
    }
    function confirmAiStuck() {
      if (aiBusy) return aiStuck; // keep state during animation
      const left = oppPieces.filter(p => p && !p.used);
      if (!left.length) return aiStuck; // transitional (deal pending)
      return piecesTrulyUnplayable(oppGrid, oppPieces);
    }

    function setAiStuck(value) {
      if (aiStuck === value) {
        updateStuckBanners();
        return;
      }
      aiStuck = value;
      updateStuckBanners();
      if (value && Math.random() < 0.4) showBotPhrase('stuck');
    }

    function updateStuckBanners() {
      updateOppStuckBanner();
      if (playerStuck) showPlayerStuckBanner();
    }

    function updateOppStuckBanner() {
      const el = document.getElementById('oppStuckWait');
      if (!el) return;
      // Only while AI is stuck and player still has a chance to play
      if (aiStuck && vsActive && !playerStuck) {
        el.style.display = 'block';
        el.textContent = oppScore >= score
          ? 'Соперник без ходов — доигрывай и постарайся обогнать!'
          : 'Соперник без ходов — доигрывай!';
      } else {
        el.style.display = 'none';
      }
    }

    let stuckCheckTimer = null;
    let stuckConfirmTimer = null;
    let stuckEndTimer = null;
    let stuckWatchId = null;

    function setPlayerStuck(value) {
      if (playerStuck === value) {
        if (value) {
          showPlayerStuckBanner();
          updateOppStuckBanner();
        }
        return;
      }
      playerStuck = value;
      if (!value) {
        const waitEl = document.getElementById('stuckWait');
        if (waitEl) waitEl.style.display = 'none';
        if (stuckConfirmTimer) { clearTimeout(stuckConfirmTimer); stuckConfirmTimer = null; }
        // don't clear stuckEndTimer here if ending
      } else {
        showPlayerStuckBanner();
      }
      updateOppStuckBanner();
      if (mpMode) mpSend({ type: 'stuck', stuck: !!value });
    }

    function showPlayerStuckBanner() {
      const waitEl = document.getElementById('stuckWait');
      if (!waitEl || !vsActive) return;
      waitEl.style.display = 'block';
      waitEl.textContent = score > oppScore
        ? 'Нет ходов — ожидай соперника...'
        : score < oppScore
          ? 'Нет ходов — соперник впереди...'
          : 'Нет ходов — ничья, пока соперник может выйти вперёд...';
    }

    function sideHasPlayable(g, pieceArr) {
      const left = (pieceArr || []).filter(p => p && !p.used && p.shape && p.shape.length);
      if (!left.length) return null; // unknown / tray empty (deal pending)
      for (const p of left) {
        if (findAllPlacements(g, p.shape).length > 0) return true;
      }
      return false;
    }

    function scheduleMatchEnd(delay) {
      if (stuckEndTimer) clearTimeout(stuckEndTimer);
      stuckEndTimer = setTimeout(() => {
        stuckEndTimer = null;
        if (!vsActive) return;
        // Final hard check: only cancel end if player clearly can still move AND is not forced-loss
        const myPlay = sideHasPlayable(grid, pieces);
        const oppPlay = sideHasPlayable(oppGrid, oppPieces);
        // Player has no moves and is behind or tied while opp also stuck → end
        if (myPlay === false && score < oppScore) {
          endVersus();
          return;
        }
        if (myPlay === false && oppPlay === false) {
          endVersus();
          return;
        }
        if (oppPlay === false && score > oppScore && myPlay !== false) {
          // only end if player is not also without moves waiting — actually opp behind + stuck means player wins if player can still play OR both stuck
          if (myPlay === false || myPlay === true) {
            // if player can play, keep going; if player also stuck, ended above
            if (myPlay === false) endVersus();
          }
          return;
        }
        // Opp stuck and behind
        if (oppPlay === false && oppScore < score) {
          endVersus();
          return;
        }
        // Re-sync flags
        if (myPlay === true) setPlayerStuck(false);
        if (oppPlay === true) setAiStuck(false);
        if (myPlay === false) setPlayerStuck(true);
        if (oppPlay === false) setAiStuck(true);
      }, delay);
    }

    function evaluateMatchEnd() {
      if (!vsActive || mode !== 'versus') return;

      const myPlay = sideHasPlayable(grid, pieces);
      const oppPlay = sideHasPlayable(oppGrid, oppPieces);

      // Sync flags from board truth (null = tray empty, leave flag alone)
      if (myPlay === true) setPlayerStuck(false);
      else if (myPlay === false) {
        if (!playerStuck) setPlayerStuck(true);
        else showPlayerStuckBanner();
      }

      if (oppPlay === true) setAiStuck(false);
      else if (oppPlay === false) {
        if (!aiStuck) setAiStuck(true);
      }

      updateStuckBanners();

      // 1) Player cannot move and is behind → loss (no reason to wait)
      if (myPlay === false && score < oppScore) {
        scheduleMatchEnd(350);
        return;
      }

      // 2) Both sides have pieces but neither can place → end by score
      if (myPlay === false && oppPlay === false) {
        scheduleMatchEnd(350);
        return;
      }

      // 3) Player stuck (ahead or tie) — wait only while opponent can still play
      if (myPlay === false && oppPlay === true) {
        showPlayerStuckBanner();
        return;
      }

      // 4) Opponent stuck and behind → player wins
      if (oppPlay === false && oppScore < score && myPlay !== false) {
        scheduleMatchEnd(350);
        return;
      }

      // 5) Opponent stuck, player still playing and not ahead yet
      if (oppPlay === false && myPlay === true) {
        updateOppStuckBanner();
      }
    }

    function checkVersusStuck() {
      if (mode !== 'versus' || !vsActive) return;
      if (stuckConfirmTimer) clearTimeout(stuckConfirmTimer);
      stuckConfirmTimer = setTimeout(() => {
        if (!vsActive) return;
        // Double-sample to avoid mid-animation false stuck
        const first = sideHasPlayable(grid, pieces);
        stuckConfirmTimer = setTimeout(() => {
          if (!vsActive) return;
          const second = sideHasPlayable(grid, pieces);
          if (second === false && first === false) {
            setPlayerStuck(true);
            evaluateMatchEnd();
          } else if (second === true) {
            setPlayerStuck(false);
            evaluateMatchEnd();
          } else {
            evaluateMatchEnd();
          }
        }, 200);
      }, 120);
    }

    // Watchdog: while either side is stuck, re-check every 1.2s so match cannot hang
    function ensureStuckWatch() {
      if (stuckWatchId) return;
      stuckWatchId = setInterval(() => {
        if (!vsActive || mode !== 'versus') return;
        if (playerStuck || aiStuck) evaluateMatchEnd();
      }, 1800);
    }
    ensureStuckWatch();

    // Pause expensive holo spins when tab is in background (big win in versus)
    try {
      document.addEventListener('visibilitychange', () => {
        document.body.classList.toggle('holo-paused', document.hidden);
      });
    } catch (_) {}

    function onAiScoreChanged() {
      try {
        if (vsActive && (oppScore - score) >= 200) window._matchWasBehind200 = true;
      } catch (_) {}
      evaluateMatchEnd();
    }

    function clonePieceForLog(p) {
      // Deep-copy shape cells; tolerate array pairs OR {r,c}/{0,1} from PeerJS/JSON quirks
      let norm = [[0, 0]];
      try {
        if (typeof cloneShapeCells === 'function') {
          norm = cloneShapeCells(p && p.shape);
        } else {
          const shape = [];
          const src = (p && p.shape) ? p.shape : [];
          for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (Array.isArray(c) && c.length >= 2) shape.push([+c[0] || 0, +c[1] || 0]);
            else if (c && typeof c === 'object') {
              const r = c.r != null ? c.r : (c[0] != null ? c[0] : 0);
              const col = c.c != null ? c.c : (c[1] != null ? c[1] : 0);
              shape.push([+r || 0, +col || 0]);
            }
          }
          norm = shape.length ? shape : [[0, 0]];
        }
        if (typeof normalize === 'function' && norm.length) norm = normalize(norm.map(c => c.slice()));
      } catch (_) {}
      return {
        shape: norm.map(c => [+c[0] || 0, +c[1] || 0]),
        color: (p && p.color) ? String(p.color) : '#7c5cff',
        used: false
      };
    }
    function logDeal(side, pieceArr) {
      if (mode !== 'versus') return;
      if (!Array.isArray(pieceArr) || !pieceArr.length) return;
      // Only log after the fight is live — loading-phase deals are incomplete / duplicated
      if (!vsActive) return;
      // Skip deals that are clearly empty placeholders (all single dummy cells) only if every piece is [[0,0]] and length 1 cell — still log real singles
      try {
        const pieces = pieceArr.map(clonePieceForLog);
        // Reject completely empty hands
        if (!pieces.length) return;
        matchLog.push({
          type: 'deal',
          side: side === 'opp' ? 'opp' : 'me',
          t: Math.max(0, Date.now() - (matchStartTs || Date.now())),
          pieces
        });
      } catch (_) {}
    }
    let lastMatchResult = null;


    function isOnVersusScreen() {
      try {
        const vs = document.getElementById('screenVersus');
        return !!(vs && vs.classList.contains('active'));
      } catch (_) { return false; }
    }
    /** Full end animation only when player is actually looking at versus; otherwise toast-only */
    function shouldQuietMatchEnd() {
      try {
        if (isOnVersusScreen() && (vsActive || window._mpRejoiningMatch || window._soloRejoinActive)) return false;
        if (isOnVersusScreen() && document.getElementById('versusResult') &&
            document.getElementById('versusResult').classList.contains('visible')) return false;
        // Menu / friends / shop / etc.
        return true;
      } catch (_) { return !vsActive; }
    }

    function formatTimeLeft(sec) {
      const m = Math.floor(Math.max(0, sec) / 60);
      const s = Math.max(0, sec) % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function endVersus(opts) {
      opts = opts || {};
      try { window._matchClockEndTs = 0; } catch (_) {}
      try { window._soloRejoinActive = false; } catch (_) {}
      try {
        if (window._soloDialIv) { clearInterval(window._soloDialIv); window._soloDialIv = null; }
        if (window._soloDeadlineTimer) { clearTimeout(window._soloDeadlineTimer); window._soloDeadlineTimer = null; }
        if (window._soloOverlayIv) { clearInterval(window._soloOverlayIv); window._soloOverlayIv = null; }
      } catch (_) {}
      try { stopAfkWatch(); } catch (_) {}
      try { clearLiveMatch(); } catch (_) {}
      try { hideMatchRejoinPanel(); } catch (_) {}
      try { hideBoardDisconnectOverlay(); } catch (_) {}
      try { hideDisconnectBanner(); } catch (_) {}
      // Hard stop clocks even if we early-return later
      try {
        if (vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
        if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
        if (typeof clearDisconnectTimer === 'function') clearDisconnectTimer();
      } catch (_) {}
      if (!vsActive && document.getElementById('versusResult').classList.contains('visible')) {
        window._matchEnded = true;
        return;
      }
      // Prevent double end (disconnect + timer race) from applying trophies twice
      if (window._matchEnded && window._rankedDeltaApplied) {
        return;
      }
      window._matchEnded = true;
      if (vsActive && mpMode && !opts.silent) {
        try {
          mpSend({
            type: 'end',
            reason: opts.reason || 'normal',
            youLose: !!opts.forceWin,
            youWin: !!opts.forceLoss,
            // Real scores so both clients show the same numbers on forfeit/end
            myScore: Math.max(0, score),
            oppScore: Math.max(0, oppScore)
          });
          mpSend({ type: 'match_over', reason: opts.reason || 'normal' });
        } catch (_) {}
      }
      vsActive = false;
      try {
        _oppPlaceAnimBusy = false;
        _pendingOppDeal = null;
        _pendingOppPlaces = [];
      } catch (_) {}
      try { mpMatchStarting = false; } catch (_) {}
      try { vsIntroLock = false; } catch (_) {}
      clearDisconnectTimer();
      if (vsTimerId) clearInterval(vsTimerId);
      if (aiInterval) clearInterval(aiInterval);
      const waitEl = document.getElementById('stuckWait');
      if (waitEl) waitEl.style.display = 'none';
      const oppWait = document.getElementById('oppStuckWait');
      if (oppWait) oppWait.style.display = 'none';
      hideDisconnectBanner();

      // Freeze timer display
      updateTimerDisplay();
      timerEl.classList.remove('urgent');

      const my = Math.max(0, score), opp = oppScore;
      let won, draw;
      if (opts.forceWin) {
        won = true; draw = false;
      } else if (opts.forceLoss) {
        won = false; draw = false;
      } else {
        won = my > opp;
        draw = my === opp;
      }
      if (!opts.quiet) {
        if (won) SFX.win();
        else if (!draw) SFX.lose();
        if (!draw && currentBot) showBotPhrase(won ? 'lose' : 'win');
      }
      const trophiesBefore = trophies;
      let delta = 0;
      // Keep P2P session eligible for rematch (menu / delayed result still works)
      if (vsModeType === 'online' && mpMode) {
        postMatchOnlineEligible = true;
        try {
          if (mpConn) noteMpRemotePeer(mpConn);
          ensurePostMatchHostAccept();
          wireMpConnLifetime(mpConn);
        } catch (_) {}
      } else {
        postMatchOnlineEligible = false;
      }
      // Trophies ONLY in ranked matchmaking — not bots, not lobby/friendly rooms
      const isRankedOnline = (vsModeType === 'online' && mpMode && (mpGameSource === 'ranked' || (!!mpFromMatchmaking && mpGameSource !== 'lobby')));
      let actualDelta = 0;
      if (window._rankedDeltaApplied) {
        // Already applied this match — keep displayed delta from lastMatchResult if any
        actualDelta = (lastMatchResult && typeof lastMatchResult.delta === 'number') ? lastMatchResult.delta : 0;
        delta = actualDelta;
      } else if (isRankedOnline) {
        const oppT = (typeof mpOppTrophies === 'number')
          ? mpOppTrophies
          : (lastMatchResult && typeof lastMatchResult.oppTrophies === 'number'
              ? lastMatchResult.oppTrophies : trophiesBefore);
        delta = calcOnlineTrophyDelta(won, draw, trophiesBefore, oppT, vsDuration);
        // Can't go below 0
        actualDelta = delta >= 0 ? delta : -Math.min(trophiesBefore, Math.abs(delta));
        trophies = Math.max(0, trophiesBefore + actualDelta);
        try { localStorage.setItem('bp_trophies', String(trophies)); } catch (_) {}
        window._rankedDeltaApplied = true;
        // Ranked score record (best points in a single ranked match)
        if (my > rankedBest) {
          rankedBest = my;
          try { localStorage.setItem('bp_ranked_best', String(rankedBest)); } catch (_) {}
        }
        updateMenuStats();
      } else {
        actualDelta = 0;
        delta = 0;
      }

      trackMatchAchievements(won);

      // Stars for beating bots on each match duration
      let newStar = false;
      if (won && vsModeType === 'bots' && currentBot) {
        newStar = awardBotStar(currentBot.id, vsDuration);
      }

      const resultLabel = draw ? 'Ничья' : won ? 'Победа' : 'Поражение';
      const botCups = currentBot ? currentBot.trophies : 0;
      const wasRanked = !!(mpGameSource === 'ranked' || (mpFromMatchmaking && mpGameSource !== 'lobby'));
      lastMatchResult = {
        result: resultLabel, won, draw, my, opp, oppName,
        delta: actualDelta, timeLeft: vsTimeLeft, duration: vsDuration,
        mode: wasRanked ? 'online' : (vsModeType === 'online' && mpMode ? 'friendly' : vsModeType),
        ranked: wasRanked,
        botId: currentBot && currentBot.id, date: Date.now(),
        oppTrophies: typeof mpOppTrophies === 'number' ? mpOppTrophies : null,
        moves: matchLog.slice(),
        mySkinId: equippedSkinId || 'default',
        myBoardId: equippedBoardId || 'field_default',
        oppSkinId: (typeof window.mpOppSkinId === 'string' && window.mpOppSkinId) ? window.mpOppSkinId : null,
        oppBoardId: (typeof window.mpOppBoardId === 'string' && window.mpOppBoardId) ? window.mpOppBoardId : null,
        oppScore: opp,
        reason: (opts && opts.reason) ? String(opts.reason) : 'normal'
      };
      if (wasRanked) mpGameSource = 'ranked';
      else if (vsModeType === 'online' && mpMode) mpGameSource = 'lobby';

      matchHistory.unshift({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        opp: oppName,
        oppName,
        botId: currentBot ? currentBot.id : null,
        mySkinId: equippedSkinId || 'default',
        myBoardId: equippedBoardId || 'field_default',
        oppSkinId: (typeof window.mpOppSkinId === 'string' && window.mpOppSkinId) ? window.mpOppSkinId : null,
        oppBoardId: (typeof window.mpOppBoardId === 'string' && window.mpOppBoardId) ? window.mpOppBoardId : null,
        my, oppScore: opp, result: resultLabel, delta: actualDelta,
        mode: isRankedOnline ? 'online' : (vsModeType === 'online' && mpMode ? 'friendly' : vsModeType),
        difficulty: currentBot ? currentBot.name : '',
        duration: vsDuration, timeLeft: vsTimeLeft, date: Date.now(),
        reason: (opts && opts.reason) ? String(opts.reason) : 'normal',
        moves: (typeof normalizeMatchLogDealOrder === 'function') ? normalizeMatchLogDealOrder(matchLog.slice()) : matchLog.slice()
      });
      // Keep last 30 matches (replays can be large)
      if (matchHistory.length > 30) matchHistory = matchHistory.slice(0, 30);
      try {
        localStorage.setItem('bp_history', JSON.stringify(matchHistory));
      } catch (e) {
        // Storage full — drop oldest replays
        matchHistory = matchHistory.slice(0, 15).map((h, i) => i < 10 ? h : { ...h, moves: [] });
        try { localStorage.setItem('bp_history', JSON.stringify(matchHistory)); } catch (_) {}
      }

      // Quiet end: toast only — never force navigation away from current screen
      if (opts.quiet) {
        try {
          const resLine = draw ? 'Ничья' : won ? 'Победа' : 'Поражение';
          const kind = won ? 'ok' : (draw ? undefined : 'bad');
          showInfoToast('Матч завершён', resLine, kind);
        } catch (_) {}
        try {
          window._resultDismissed = true;
          document.getElementById('versusResult').classList.remove('visible');
        } catch (_) {}
        try { document.body.classList.remove('replay-ui'); } catch (_) {}
        try { updateMenuStats(); } catch (_) {}
        return;
      }

      let titleText = draw ? 'Ничья!' : won ? 'Победа!' : 'Поражение';
      if (opts.reason === 'disconnect' && won) titleText = 'Победа · соперник отключился';
      if (opts.reason === 'disconnect' && !won) titleText = 'Поражение · отключение';
      if (opts.reason === 'forfeit' && !won) titleText = 'Поражение · сдача';
      if (opts.reason === 'forfeit' && won) titleText = 'Победа · соперник сдался';
      if (opts.reason === 'afk' && draw) titleText = 'Ничья · АФК';
      if (opts.reason === 'afk' && !draw && !won) titleText = 'Поражение · АФК';
      if (opts.reason === 'afk' && !draw && won) titleText = 'Победа · соперник АФК';
      document.getElementById('vsTitle').textContent = titleText;
      document.getElementById('vsMyScore').textContent = my;
      document.getElementById('vsOppScore').textContent = opp;
      document.getElementById('vsOppLabel').textContent = oppName;
      const deltaEl = document.getElementById('vsTrophyDelta');
      deltaEl.className = 'trophy-line';
      if (vsModeType !== 'online') {
        if (won && currentBot) {
          const n = getBotStarCount(currentBot.id);
          const starRow = [60, 120, 180].map(sec =>
            botHasStar(currentBot.id, sec) ? '★' : '☆'
          ).join(' ');
          deltaEl.innerHTML = newStar
            ? `<span style="color:var(--trophy)">Новая звезда! ${starRow}</span><br><span class="muted" style="font-size:0.78rem">${n}/3 · ${currentBot.name}</span>`
            : `<span style="color:var(--text-dim)">${starRow}</span><br><span class="muted" style="font-size:0.78rem">${n}/3 · тренировка</span>`;
        } else {
          deltaEl.innerHTML = `<span class="muted">Тренировка · без трофеев</span>`;
        }
      } else if (!isRankedOnline) {
        deltaEl.innerHTML = `<span class="muted">Товарищеский матч · без трофеев</span>`;
      } else {
        const sign = actualDelta > 0 ? '+' : actualDelta < 0 ? '−' : '+';
        const abs = Math.abs(actualDelta);
        const color = actualDelta > 0 ? 'var(--trophy)' : actualDelta < 0 ? 'var(--danger)' : 'var(--text-dim)';
        const oppTShow = typeof mpOppTrophies === 'number' ? mpOppTrophies : '—';
        deltaEl.innerHTML = `🏆 ${trophiesBefore} <span style="color:${color}">${sign} ${abs}</span> → <strong>${trophies}</strong>` +
          `<div class="muted" style="font-size:0.75rem;margin-top:4px">соперник 🏆 ${oppTShow}</div>`;
      }

      const timeInfo = document.getElementById('vsTimeLeftInfo');
      if (vsTimeLeft <= 0) timeInfo.textContent = 'Время вышло';
      else timeInfo.textContent = `Осталось времени: ${formatTimeLeft(vsTimeLeft)}`;

      // Prepare review bar
      const reviewTitle = document.getElementById('reviewTitle');
      const reviewMeta = document.getElementById('reviewMeta');
      reviewTitle.textContent = resultLabel + (delta ? ` · ${delta > 0 ? '+' : ''}${delta} 🏆` : '');
      reviewMeta.textContent = `Ты ${my} — ${opp} ${oppName} · осталось ${formatTimeLeft(vsTimeLeft)}`;

      const liveCtrl = document.getElementById('vsLiveControls');
      const footer = document.getElementById('vsFooter');
      const piecesVs = document.getElementById('piecesAreaVs');
      if (liveCtrl) liveCtrl.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (piecesVs) { piecesVs.style.opacity = '0.35'; piecesVs.style.pointerEvents = 'none'; }
      document.body.classList.add('replay-ui');
      const fbEnd = document.getElementById('btnForfeit');
      if (fbEnd) fbEnd.style.display = 'none';

      // Do NOT clear rematchTheyWant / pending offer here — invite may already be in flight
      rematchIWant = false;
      rematchPending = false;

      // 1) Freeze overlay so players see the match stopped
      // 2) Score duel count-up
      // 3) Result modal
      // (lobby invite accepted mid-match: join only after player goes to main menu)
      window._resultDismissed = false;
      const resultEpoch = ++resultModalEpoch;
      if (resultModalSafetyTimer) {
        try { clearTimeout(resultModalSafetyTimer); } catch (_) {}
        resultModalSafetyTimer = null;
      }
      const showResultModal = () => {
        // User already closed result / left to menu — do not re-open
        if (resultEpoch !== resultModalEpoch || window._resultDismissed) return;
        try {
          const active = document.querySelector('.screen.active');
          // Only force-show while still on versus (or no active screen yet)
          if (active && active.id && active.id !== 'screenVersus') return;
        } catch (_) {}
        try { hideMatchEndFreeze(); } catch (_) {}
        try { configurePostMatchButtons(); } catch (_) {}
        document.getElementById('versusResult').classList.add('visible');
        // Flush rematch invite that arrived during score duel (or just before)
        try { tryShowPendingRematchOffer(); } catch (_) {}
      };
      const runScoreDuelThenResult = () => {
        if (resultEpoch !== resultModalEpoch || window._resultDismissed) return;
        try {
          const p = showScoreDuel(my, opp, won, draw, oppName, currentBot);
          if (p && typeof p.then === 'function') {
            p.then(showResultModal).catch(() => { showResultModal(); });
          } else {
            showResultModal();
          }
        } catch (_) {
          showResultModal();
        }
      };
      try {
        const freezeP = showMatchEndFreeze({
          reason: (opts && opts.reason) ? String(opts.reason) : 'normal',
          timeUp: vsTimeLeft <= 0,
          timeLeft: vsTimeLeft,
          my, opp, won, draw,
          ms: (opts && opts.reason === 'forfeit') ? 1500 : 1800
        });
        if (freezeP && typeof freezeP.then === 'function') {
          freezeP.then(runScoreDuelThenResult).catch(runScoreDuelThenResult);
        } else {
          runScoreDuelThenResult();
        }
        // Safety: freeze (~1.8s) + duel (~1.5s) — still show result if something hangs
        resultModalSafetyTimer = setTimeout(() => {
          resultModalSafetyTimer = null;
          try {
            if (resultEpoch !== resultModalEpoch || window._resultDismissed) return;
            const r = document.getElementById('versusResult');
            if (r && !r.classList.contains('visible') && window._matchEnded) showResultModal();
          } catch (_) {}
        }, 4800);
      } catch (_) {
        runScoreDuelThenResult();
      }
    }

    function enterReviewMode() {
      document.getElementById('versusResult').classList.remove('visible');
      const reviewBar = document.getElementById('reviewBar');
      reviewBar.classList.add('replay-dock');
      reviewBar.classList.add('visible');
      document.getElementById('reviewTitle').textContent = '';
      document.getElementById('reviewMeta').textContent = '';
      reviewBar.querySelector('.controls').innerHTML = `
        <button type="button" class="primary" data-review-action="result" title="Результат">🏆</button>
        <button type="button" class="ghost" data-review-action="again" title="Ещё матч">↻</button>
        <button type="button" class="ghost" data-review-action="menu" title="В меню">☰</button>
      `;
      document.body.classList.add('replay-ui');
      const fb = document.getElementById('btnForfeit');
      if (fb) fb.style.display = 'none';
      showScreen('versus');
      // Rebuild boards so cells are never empty after forfeit/reload
      try {
        if (!grid || !grid.length) grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        if (!oppGrid || !oppGrid.length) oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        if (typeof boardMe !== 'undefined' && boardMe) {
          if (!boardMe.children || boardMe.children.length !== SIZE * SIZE) createBoardDOM(boardMe);
          renderGrid(grid, boardMe);
        }
        if (typeof boardOpp !== 'undefined' && boardOpp) {
          if (!boardOpp.children || boardOpp.children.length !== SIZE * SIZE) createBoardDOM(boardOpp);
          renderGrid(oppGrid, boardOpp);
        }
        try {
          const area = document.getElementById('piecesAreaVs');
          if (area && pieces && pieces.length && typeof renderPieces === 'function') renderPieces(area);
        } catch (_) {}
        try {
          if (oppPieces && oppPieces.length && typeof renderOppPieces === 'function') renderOppPieces();
        } catch (_) {}
        applyEquippedBoard();
        applyEquippedSkin();
        if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
        if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
        applyBoardScales();
        requestAnimationFrame(() => { try { applyBoardScales(); } catch (_) {} });
      } catch (e) {
        console.warn('enterReviewMode boards', e);
      }
    }

    function renderHistory() {
      const list = document.getElementById('historyList');
      if (!list) return;
      if (!matchHistory.length) {
        list.innerHTML = '<div class="history-empty">Пока нет матчей. Сыграй в соревновании!</div>';
        return;
      }
      list.innerHTML = matchHistory.map((h, idx) => {
        const d = new Date(h.date);
        const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) +
          ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const isOnline = h.mode === 'online';
        const isFriendly = h.mode === 'friendly';
        const modeStr = isOnline ? '🌐 Рейтинг' : isFriendly ? '🤝 Товарищеский' : `🤖 ${h.difficulty || h.oppName || 'Бот'}`;
        const durStr = h.duration === 60 ? '1м' : h.duration === 180 ? '3м' : '2м';
        const cls = h.result === 'Победа' ? 'win' : h.result === 'Поражение' ? 'lose' : 'draw';
        const hasReplay = h.moves && h.moves.length;
        const bot = h.botId ? BOTS.find(b => b.id === h.botId) : null;
        const av = bot ? botAvatarHTML(bot, 22) : '';
        // Strip trophy suffixes from stored names (legacy)
        const oppLabel = (h.oppName || h.opp || 'Соперник').toString()
          .replace(/\s*\(\s*\d+\s*🏆\s*\)\s*/g, '')
          .replace(/\s*\d+\s*🏆\s*/g, '')
          .trim() || 'Соперник';
        let rightExtra = '';
        const deltaN = (typeof h.delta === 'number') ? h.delta : 0;
        // Ranked online: show trophy gains and losses
        if (isOnline && deltaN !== 0) {
          if (deltaN > 0) {
            rightExtra = `<span class="hi-delta up">🏆 +${deltaN}</span>`;
          } else {
            rightExtra = `<span class="hi-delta down">🏆 −${Math.abs(deltaN)}</span>`;
          }
        } else if (bot) {
          const st = botStars[bot.id] || {};
          rightExtra = '<span class="hi-stars" title="Серебряные звёзды 1/2/3 мин">' +
            [60, 120, 180].map(sec =>
              `<span class="${st[String(sec)] ? 'on' : ''}">☆</span>`
            ).join('') + '</span>';
        } else {
          // Friendly / zero-delta ranked: no trophy line
          rightExtra = '';
        }
        return `<div class="history-item" data-hist="${idx}">
          <div class="hi-left">
            <div class="hi-opp" style="display:flex;align-items:center;gap:6px">${av}<span>vs ${oppLabel}</span></div>
            <div class="hi-meta">${modeStr} · ${durStr} · ${h.my}:${h.oppScore} · ${dateStr}</div>
            ${hasReplay ? '<div class="hi-replay">▶ Смотреть повтор</div>' : '<div class="hi-meta">Повтор недоступен</div>'}
          </div>
          <div class="hi-result ${cls}">${h.result}<br>${rightExtra}</div>
        </div>`;
      }).join('');
      list.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          const h = matchHistory[parseInt(item.dataset.hist, 10)];
          if (h && h.moves && h.moves.length) startReplay(h, { from: 'history' });
          else {
            try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
          }
        });
      });
    }

    function clearLinesSilent(g) {
      const rows = [], cols = [];
      for (let r = 0; r < SIZE; r++) if (g[r].every(c => c !== null)) rows.push(r);
      for (let c = 0; c < SIZE; c++) if (g.every(row => row[c] !== null)) cols.push(c);
      rows.forEach(r => { for (let c = 0; c < SIZE; c++) g[r][c] = null; });
      cols.forEach(c => { for (let r = 0; r < SIZE; r++) g[r][c] = null; });
      return rows.length + cols.length;
    }

    function clearReplayEffects() {
      document.querySelectorAll('.score-float').forEach(el => el.remove());
      [comboBanner, comboBannerMe, document.getElementById('comboBannerOpp')].forEach(b => {
        if (!b) return;
        b.classList.remove('show');
        b.textContent = '';
      });
      const g = document.getElementById('aiGhost');
      if (g) { g.style.display = 'none'; g.style.opacity = '0'; g.innerHTML = ''; }
    }

    function startReplay(match, opts) {
      opts = opts || {};
      if (!match || !match.moves || !match.moves.length) {
        try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
        return;
      }
      if (opts.from === 'result' || opts.from === 'history' || opts.from === 'menu') {
        replayReturnTo = opts.from;
      } else {
        replayReturnTo = 'history';
      }
      try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
      if (vsTimerId) clearInterval(vsTimerId);
      if (aiInterval) clearInterval(aiInterval);
      if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
      vsActive = false;
      replayMode = true;
      document.body.classList.add('replay-ui');
      window._repChainMe = 0;
      window._repChainOpp = 0;
      // Backup current cosmetics; restore when leaving replay
      try {
        window._replaySkinBackup = equippedSkinId;
        window._replayBoardBackup = equippedBoardId;
      } catch (_) {}
      // My skins/fields from that match
      try {
        if (match && match.mySkinId) {
          equippedSkinId = match.mySkinId;
          applyEquippedSkin();
        }
        if (match && match.myBoardId) {
          equippedBoardId = match.myBoardId;
          applyEquippedBoard();
        }
      } catch (_) {}
      // Opponent cosmetics
      try {
        if (match && match.oppSkinId) {
          window.mpOppSkinId = match.oppSkinId;
          applyOppSkin(match.oppSkinId);
        } else {
          clearOppSkin();
          window.mpOppSkinId = null;
        }
        if (match && match.oppBoardId) {
          window.mpOppBoardId = match.oppBoardId;
          applyOppBoard(match.oppBoardId);
        } else {
          clearOppBoard();
          window.mpOppBoardId = null;
        }
      } catch (_) {}
      const fb = document.getElementById('btnForfeit');
      if (fb) fb.style.display = 'none';
      // Fix deal/place order from online races (deal logged after first place)
      try {
        if (match.moves && match.moves.length) {
          match = Object.assign({}, match, { moves: normalizeMatchLogDealOrder(match.moves) });
        }
      } catch (_) {}
      replayData = match;
      replayIndex = 0;
      replayBusy = false;
      stopReplayPlay();

      showScreen('versus');
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      createBoardDOM(boardMe);
      createBoardDOM(boardOpp);
      try { applyEquippedBoard(); } catch (_) {}
      try { if (window.mpOppBoardId) applyOppBoard(window.mpOppBoardId); } catch (_) {}
      try { applyEquippedSkin(); } catch (_) {}
      try { if (window.mpOppSkinId) applyOppSkin(window.mpOppSkinId); } catch (_) {}
      renderGrid(grid, boardMe);
      renderGrid(oppGrid, boardOpp);
      clearReplayEffects();

      document.getElementById('myScore').textContent = '0';
      document.getElementById('oppScore').textContent = '0';
      {
        const bot = match.botId ? BOTS.find(b => b.id === match.botId) : null;
        document.getElementById('oppName').innerHTML = bot
          ? `${botAvatarHTML(bot, 24)} <span>${match.oppName || match.opp}</span>`
          : `<span>${match.oppName || match.opp}</span>`;
      }
      timerEl.classList.remove('urgent');

      document.getElementById('stuckWait').style.display = 'none';
      document.getElementById('oppStuckWait').style.display = 'none';
      document.getElementById('vsLiveControls').style.display = 'none';
      document.getElementById('vsFooter').style.display = 'none';
      const piecesVs = document.getElementById('piecesAreaVs');
      if (piecesVs) {
        piecesVs.style.opacity = '1';
        piecesVs.style.visibility = 'visible';
        piecesVs.style.pointerEvents = 'none';
        piecesVs.style.display = 'flex';
        piecesVs.innerHTML = '';
      }
      const oppArea = document.getElementById('piecesAreaOpp');
      if (oppArea) {
        oppArea.style.opacity = '1';
        oppArea.style.visibility = 'visible';
        oppArea.style.pointerEvents = 'none';
        oppArea.style.display = 'flex';
        oppArea.innerHTML = '';
      }
      // Clear live hands so accidental live re-render cannot show wrong pieces
      try { pieces = []; } catch (_) {}
      try { oppPieces = []; } catch (_) {}

      // Opening hands: deals + align shapes to the places that will actually be played
      replayMePieces = [];
      replayOppPieces = [];
      try { applyOpeningReplayHands(match.moves, false); } catch (_) {}
      // Cursor after opening deals (both sides) so seek/reset never drops trays
      replayIndex = (typeof replayMinIndex === 'function')
        ? replayMinIndex(match.moves)
        : leadingDealCount(match.moves);
      // Force tray silhouettes to match the next places (deal log can be the wrong hand on races)
      try { rebuildReplayTraysFromMoves(match.moves, replayIndex); } catch (_) {}
      clearReplayEffects();
      // Paint trays from match log, then scale (applyBoardScales respects replayMode)
      try {
        renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
        renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
      } catch (_) {}
      requestAnimationFrame(() => {
        try { applyBoardScales(); } catch (_) {}
        try {
          renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
          renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
        } catch (_) {}
      });

      const reviewBar = document.getElementById('reviewBar');
      reviewBar.classList.add('visible');
      document.getElementById('reviewTitle').textContent = `Повтор · ${match.result}`;
      document.getElementById('reviewMeta').textContent = `Событие ${replayIndex} / ${match.moves.length} · 0:0`;
      replaySpeed = 1;
      replayClockMs = 0;
      if (match.duration) timerEl.textContent = formatReplayClock(match.duration * 1000);
      else timerEl.textContent = '0:00';
      reviewBar.classList.add('replay-dock');
      applyBoardScales();
      hideReplayEndCard();
      // Full-width scrubber under boards
      try {
        const scrub = document.getElementById('replayScrubBar');
        if (scrub) {
          scrub.style.display = 'flex';
          scrub.setAttribute('aria-hidden', 'false');
        }
        const slider = document.getElementById('replayProgress');
        if (slider) {
          slider.max = String(match.moves.length || 0);
          slider.value = String(replayIndex);
          if (!slider._bpBound) {
            slider._bpBound = true;
            let seekTimer = null;
            const doSeek = () => {
              seekTimer = null;
              const v = parseInt(slider.value, 10);
              if (!Number.isFinite(v)) return;
              hideReplayEndCard();
              seekReplayTo(v, { force: true });
            };
            slider.addEventListener('input', () => {
              stopReplayPlay();
              hideReplayEndCard();
              const lab = document.getElementById('replayProgressLabel');
              // Use live replayData — handler is bound once; match from first open would be stale
              const total = (replayData && replayData.moves) ? replayData.moves.length : 0;
              if (lab) lab.textContent = slider.value + '/' + total;
              if (seekTimer) clearTimeout(seekTimer);
              seekTimer = setTimeout(doSeek, 70);
            });
            slider.addEventListener('change', () => {
              if (seekTimer) { clearTimeout(seekTimer); seekTimer = null; }
              doSeek();
            });
          }
        }
      } catch (_) {}
      reviewBar.querySelector('.controls').innerHTML = `
        <button class="primary" id="btnReplayPlay" title="Пуск">▶</button>
        <button class="ghost" id="btnReplayBackStep" title="Назад">◀</button>
        <button class="ghost" id="btnReplayStep" title="Вперёд">▶▶</button>
        <button class="ghost" id="btnReplaySpeed" title="Скорость">1x</button>
        <button class="ghost" id="btnReplayResult" title="Результат матча">🏆</button>
        <button class="ghost" id="btnReplayReset" title="Сначала">↺</button>
        <button class="ghost" id="btnReplayBack" title="Закрыть повтор">✕</button>
      `;
      document.getElementById('btnReplayPlay').addEventListener('click', toggleReplayPlay);
      document.getElementById('btnReplayStep').addEventListener('click', () => {
        stopReplayPlay();
        if (replayBusy) return;
        hideReplayEndCard();
        if (replayIndex >= match.moves.length) {
          showReplayResult();
          return;
        }
        if (replayIndex < match.moves.length) {
          replayClockMs = getEventTime(match.moves[replayIndex], replayIndex);
          updateReplayClockDisplay();
        }
        replayStep(() => { updateReplayProgressUI(); }, Math.max(1.25, replaySpeed));
      });
      document.getElementById('btnReplayBackStep').addEventListener('click', () => {
        stopReplayPlay();
        if (replayBusy) return;
        hideReplayEndCard();
        const minIdx = (typeof replayMinIndex === 'function')
          ? replayMinIndex(match.moves)
          : leadingDealCount(match.moves);
        seekReplayTo(Math.max(minIdx, replayIndex - 1), { force: true });
      });
      document.getElementById('btnReplaySpeed').addEventListener('click', () => {
        const speeds = [1, 1.5, 2, 4, 8];
        let i = speeds.indexOf(replaySpeed);
        if (i < 0) {
          i = speeds.findIndex(s => s >= replaySpeed);
          if (i < 0) i = 0;
        }
        replaySpeed = speeds[(i + 1) % speeds.length];
        const lab = document.getElementById('btnReplaySpeed');
        if (lab) lab.textContent = replaySpeed === 1.5 ? '1.5x' : `${replaySpeed}x`;
        const curT = replayClockMs || 0;
        replayAbsBase = performance.now() - curT / replaySpeed;
      });
      document.getElementById('btnReplayResult')?.addEventListener('click', () => {
        stopReplayPlay();
        showReplayResult();
      });
      document.getElementById('btnReplayReset').addEventListener('click', () => {
        stopReplayPlay();
        hideReplayEndCard();
        try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
        resetReplay();
        updateReplayProgressUI();
      });
      updateReplayProgressUI();
      document.getElementById('btnReplayBack').addEventListener('click', () => {
        stopReplayPlay();
        replayMode = false;
        document.body.classList.remove('replay-ui');
        hideReplayEndCard();
        try {
          const scrub = document.getElementById('replayScrubBar');
          if (scrub) {
            scrub.style.display = 'none';
            scrub.setAttribute('aria-hidden', 'true');
          }
        } catch (_) {}
        // Restore cosmetics used outside of this replay
        try {
          if (window._replaySkinBackup) {
            equippedSkinId = window._replaySkinBackup;
            applyEquippedSkin();
          }
          if (window._replayBoardBackup) {
            equippedBoardId = window._replayBoardBackup;
            applyEquippedBoard();
          }
          clearOppSkin();
          clearOppBoard();
          window.mpOppSkinId = null;
          window.mpOppBoardId = null;
          window._replaySkinBackup = null;
          window._replayBoardBackup = null;
        } catch (_) {}
        applyBoardScales();
        const fb = document.getElementById('btnForfeit');
        if (fb) fb.style.display = '';
        reviewBar.classList.remove('visible');
        reviewBar.classList.remove('replay-dock');
        reviewBar.querySelector('.controls').innerHTML = `
          <button type="button" class="primary" data-review-action="result" title="Результат">🏆</button>
          <button type="button" class="ghost" data-review-action="again" title="Ещё матч">↻</button>
          <button type="button" class="ghost" data-review-action="menu" title="В меню">☰</button>
        `;
        // Return to where the replay was opened from
        const ret = replayReturnTo || 'history';
        if (ret === 'result') {
          try { showScreen('versus'); } catch (_) {}
          try { configurePostMatchButtons(); } catch (_) {}
          try { document.getElementById('versusResult').classList.add('visible'); } catch (_) {}
        } else if (ret === 'menu') {
          try { showScreen('menu'); updateMenuStats(); } catch (_) {}
        } else {
          try { renderHistory(); } catch (_) {}
          try { showScreen('history'); } catch (_) {}
        }
      });
    }

    let replayBusy = false;
    let replayPlaying = false;

    function stopReplayPlay() {
      replayPlaying = false;
      if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
      const btn = document.getElementById('btnReplayPlay');
      if (btn) btn.textContent = '▶';
    }

    function updateReplayProgressUI() {
      try {
        if (!replayData || !replayData.moves) return;
        const total = replayData.moves.length;
        const cur = Math.min(replayIndex, total);
        const slider = document.getElementById('replayProgress');
        if (slider) {
          slider.max = String(Math.max(0, total));
          slider.value = String(cur);
        }
        const lab = document.getElementById('replayProgressLabel');
        if (lab) lab.textContent = cur + '/' + total;
      } catch (_) {}
    }

    /** Human-readable end reason for a stored match */
    function formatMatchEndReason(match) {
      if (!match) return '';
      const reason = match.reason || 'normal';
      const res = match.result || '';
      const won = res === 'Победа';
      const draw = res === 'Ничья';
      if (reason === 'disconnect') {
        return won ? 'Соперник отключился' : 'Отключение';
      }
      if (reason === 'forfeit') {
        return won ? 'Соперник сдался' : 'Сдача';
      }
      if (reason === 'afk') {
        if (draw) return 'АФК обеих сторон';
        return won ? 'Соперник АФК' : 'АФК';
      }
      if (match.timeLeft != null && match.timeLeft <= 0) return 'Время вышло';
      if (draw) return 'Ничья по очкам';
      return won ? 'Победа по очкам' : 'Поражение по очкам';
    }

    function hideReplayEndCard() {
      try {
        const card = document.getElementById('replayEndCard');
        if (card) {
          card.classList.remove('visible');
          card.style.display = 'none';
          card.setAttribute('aria-hidden', 'true');
        }
        // Never leave the live result modal open during replay
        document.getElementById('versusResult')?.classList.remove('visible');
      } catch (_) {}
    }

    function showReplayResult() {
      if (!replayData) return;
      stopReplayPlay();
      try {
        const match = replayData;
        const my = typeof match.my === 'number' ? match.my : 0;
        const opp = typeof match.oppScore === 'number' ? match.oppScore : 0;
        const res = match.result || (my > opp ? 'Победа' : my < opp ? 'Поражение' : 'Ничья');
        const reasonLine = formatMatchEndReason(match);
        let titleText = res === 'Ничья' ? 'Ничья!' : res === 'Победа' ? 'Победа!' : 'Поражение';
        if (match.reason === 'disconnect' && res === 'Победа') titleText = 'Победа · соперник отключился';
        if (match.reason === 'disconnect' && res === 'Поражение') titleText = 'Поражение · отключение';
        if (match.reason === 'forfeit' && res === 'Поражение') titleText = 'Поражение · сдача';
        if (match.reason === 'forfeit' && res === 'Победа') titleText = 'Победа · соперник сдался';
        if (match.reason === 'afk' && res === 'Ничья') titleText = 'Ничья · АФК';
        if (match.reason === 'afk' && res === 'Поражение') titleText = 'Поражение · АФК';
        if (match.reason === 'afk' && res === 'Победа') titleText = 'Победа · соперник АФК';

        // Ensure modal stays closed — result is part of the replay UI
        try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}

        const card = document.getElementById('replayEndCard');
        const titleEl = document.getElementById('replayEndTitle');
        const myEl = document.getElementById('replayEndMy');
        const oppEl = document.getElementById('replayEndOpp');
        const oppLab = document.getElementById('replayEndOppLabel');
        const metaEl = document.getElementById('replayEndMeta');
        if (titleEl) titleEl.textContent = titleText;
        if (myEl) myEl.textContent = my;
        if (oppEl) oppEl.textContent = opp;
        if (oppLab) {
          oppLab.textContent =
            (match.oppName || match.opp || 'Соперник').toString().replace(/\s*\d+\s*🏆\s*/g, '').trim() || 'Соперник';
        }
        if (metaEl) {
          const parts = [];
          parts.push(reasonLine || '');
          if (match.mode === 'online' && typeof match.delta === 'number' && match.delta !== 0) {
            const sign = match.delta > 0 ? '+' : '−';
            parts.push('🏆 ' + sign + Math.abs(match.delta));
          } else if (match.mode === 'friendly') {
            parts.push('Товарищеский');
          } else if (match.botId || match.mode === 'bots') {
            parts.push('Тренировка');
          }
          if (match.timeLeft != null) {
            if (match.timeLeft <= 0) parts.push('Время вышло');
            else parts.push('Осталось ' + formatTimeLeft(match.timeLeft));
          }
          if (match.duration) {
            const dur = match.duration === 60 ? '1 мин' : match.duration === 180 ? '3 мин' : '2 мин';
            parts.push(dur);
          }
          metaEl.textContent = parts.filter(Boolean).join(' · ');
        }
        if (card) {
          card.style.display = 'block';
          card.classList.add('visible');
          card.setAttribute('aria-hidden', 'false');
        }
        // Close only
        const closeBtn = document.getElementById('btnReplayEndClose');
        if (closeBtn && !closeBtn._bpBound) {
          closeBtn._bpBound = true;
          closeBtn.addEventListener('click', () => {
            hideReplayEndCard();
          });
        }
        try {
          document.getElementById('reviewMeta').textContent =
            `Конец · ${res}` + (reasonLine ? ' · ' + reasonLine : '');
        } catch (_) {}
        updateReplayProgressUI();
      } catch (e) {
        console.warn('showReplayResult', e);
      }
    }

    function seekReplayTo(targetIdx, opts) {
      opts = opts || {};
      if (!replayData || !replayData.moves) return;
      stopReplayPlay();
      if (replayBusy && !opts.force) return;
      hideReplayEndCard();
      const minIdx = (typeof replayMinIndex === 'function')
        ? replayMinIndex(replayData.moves)
        : leadingDealCount(replayData.moves);
      const end = Math.max(minIdx, Math.min(targetIdx, replayData.moves.length));
      const vs = document.getElementById('screenVersus');
      if (vs) vs.classList.add('replay-seeking');
      rebuildReplayTo(end, false);
      updateReplayProgressUI();
      requestAnimationFrame(() => {
        setTimeout(() => {
          try { if (vs) vs.classList.remove('replay-seeking'); } catch (_) {}
        }, 160);
      });
    }

    function formatReplayClock(ms) {
      const totalSec = Math.floor(Math.max(0, ms) / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateReplayClockDisplay() {
      if (!replayData) return;
      // Show time remaining like live match if duration known
      if (replayData.duration) {
        const left = Math.max(0, replayData.duration * 1000 - replayClockMs);
        timerEl.textContent = formatReplayClock(left);
      } else {
        timerEl.textContent = formatReplayClock(replayClockMs);
      }
    }

    function getEventTime(ev, idx) {
      if (ev && typeof ev.t === 'number') return ev.t;
      // Legacy events without timestamps — approximate
      return idx * 600;
    }

    let replayAbsBase = 0; // performance.now() anchor for 1:1 timing

    function toggleReplayPlay() {
      if (replayPlaying) {
        stopReplayPlay();
        return;
      }
      if (!replayData || !replayData.moves || !replayData.moves.length) return;
      // Already at end → show result or restart from beginning
      if (replayIndex >= replayData.moves.length) {
        showReplayResult();
        return;
      }
      hideReplayEndCard();
      replayPlaying = true;
      const btn = document.getElementById('btnReplayPlay');
      if (btn) btn.textContent = '⏸';

      // Absolute timeline: 1x == real match pace (gaps already include think time)
      const nowT = replayIndex > 0
        ? getEventTime(replayData.moves[Math.max(0, replayIndex - 1)], Math.max(0, replayIndex - 1))
        : (replayData.moves[0] ? getEventTime(replayData.moves[0], 0) : 0);
      replayAbsBase = performance.now() - nowT / replaySpeed;

      const scheduleNext = () => {
        if (!replayPlaying || !replayMode || !replayData) { stopReplayPlay(); return; }
        if (replayIndex >= replayData.moves.length) {
          stopReplayPlay();
          // Brief pause so last place/clear anim settles, then show result
          setTimeout(() => {
            if (replayMode && replayData && replayIndex >= replayData.moves.length) {
              showReplayResult();
            }
          }, 480);
          return;
        }
        if (replayBusy) {
          replayTimer = setTimeout(scheduleNext, 28);
          return;
        }

        const nextT = getEventTime(replayData.moves[replayIndex], replayIndex);
        const prevT = replayIndex > 0
          ? getEventTime(replayData.moves[replayIndex - 1], replayIndex - 1)
          : 0;
        const gap = Math.max(0, nextT - prevT);
        // Cap long "think" gaps so scrubbing/playback feels continuous
        const maxGap = replaySpeed >= 4 ? 280 : replaySpeed >= 2 ? 520 : 900;
        const minGap = replaySpeed >= 4 ? 40 : 70;
        const cappedGap = Math.min(maxGap, Math.max(minGap, gap / replaySpeed));
        const targetWall = performance.now() + cappedGap;
        // Also respect absolute timeline when gaps are short
        const absWall = replayAbsBase + nextT / replaySpeed;
        const delay = Math.max(0, Math.min(cappedGap, Math.max(0, absWall - performance.now())));
        // Prefer capped gap for smoothness when think time is huge
        const finalDelay = gap / replaySpeed > maxGap ? cappedGap : Math.min(delay, maxGap);

        replayTimer = setTimeout(() => {
          if (!replayPlaying) return;
          replayClockMs = nextT;
          updateReplayClockDisplay();
          replayStep(() => {
            updateReplayProgressUI();
            if (replayPlaying) scheduleNext();
          }, replaySpeed);
        }, Math.max(0, finalDelay));
      };
      scheduleNext();
    }

    function replayTrayCellPx(small) {
      try {
        const cs = getComputedStyle(document.documentElement);
        const v = cs.getPropertyValue(small ? '--opp-piece' : '--versus-piece').trim();
        const n = parseFloat(v);
        if (n > 4) return n;
      } catch (_) {}
      // Fallback from board width
      try {
        const b = small ? boardOpp : boardMe;
        if (b) {
          const w = b.getBoundingClientRect().width;
          if (w > 40) return Math.max(7, Math.round(w / SIZE * (small ? 0.32 : 0.42)));
        }
      } catch (_) {}
      return small ? 10 : 12;
    }

    function cloneShapeCells(sh) {
      const out = [];
      if (!Array.isArray(sh)) return [[0, 0]];
      for (let i = 0; i < sh.length; i++) {
        const c = sh[i];
        if (Array.isArray(c) && c.length >= 2) {
          out.push([+c[0] || 0, +c[1] || 0]);
        } else if (c && typeof c === 'object') {
          // Rare: {r,c} / {0,1} from bad serialization
          const r = c.r != null ? c.r : (c[0] != null ? c[0] : 0);
          const col = c.c != null ? c.c : (c[1] != null ? c[1] : 0);
          out.push([+r || 0, +col || 0]);
        }
      }
      if (!out.length) return [[0, 0]];
      try {
        if (typeof normalize === 'function') return normalize(out);
      } catch (_) {}
      return out;
    }

    function renderReplayTray(areaEl, pieceArr, small, animateIn) {
      if (!areaEl) return;
      try {
        areaEl.style.opacity = '1';
        areaEl.style.visibility = 'visible';
        areaEl.style.pointerEvents = 'none';
        areaEl.style.display = 'flex';
      } catch (_) {}
      areaEl.innerHTML = '';
      const list = Array.isArray(pieceArr) ? pieceArr : [];
      let cellPx = 12;
      try {
        const v = replayTrayCellPx(!!small);
        if (v > 4) cellPx = v;
      } catch (_) {}
      if (!(cellPx > 4)) cellPx = small ? 10 : 12;
      cellPx = Math.max(small ? 8 : 10, cellPx);
      const gapPx = Math.max(1, Math.round(cellPx * 0.12));
      const slotPx = Math.max(small ? 36 : 44, Math.min(small ? 56 : 78, cellPx * 5 + 8));
      list.forEach((p, idx) => {
        const used = !!(p && p.used);
        const slot = document.createElement('div');
        slot.className = 'piece-slot' + (used ? ' used' : '');
        slot.dataset.replayIdx = String(idx);
        if (small) slot.dataset.oppIdx = String(idx);
        else slot.dataset.idx = String(idx);
        if (!used) {
          slot.style.width = slotPx + 'px';
          slot.style.height = slotPx + 'px';
          slot.style.minWidth = slotPx + 'px';
          slot.style.opacity = '1';
          slot.style.transform = 'none';
          const shape = cloneShapeCells(p && p.shape);
          const maxR = Math.max(0, ...shape.map(s => +s[0] || 0));
          const maxC = Math.max(0, ...shape.map(s => +s[1] || 0));
          const gridEl = document.createElement('div');
          gridEl.className = 'piece-grid';
          gridEl.style.gridTemplateColumns = 'repeat(' + (maxC + 1) + ', ' + cellPx + 'px)';
          gridEl.style.gridTemplateRows = 'repeat(' + (maxR + 1) + ', ' + cellPx + 'px)';
          gridEl.style.gap = gapPx + 'px';
          const occ = new Set(shape.map(([r, c]) => (+r || 0) + ',' + (+c || 0)));
          const col = (p && p.color) ? String(p.color) : '#7c5cff';
          for (let r = 0; r <= maxR; r++) {
            for (let c = 0; c <= maxC; c++) {
              const cell = document.createElement('div');
              // Size every cell so CSS grid never collapses (empty spacers included)
              cell.style.width = cellPx + 'px';
              cell.style.height = cellPx + 'px';
              cell.style.minWidth = cellPx + 'px';
              cell.style.minHeight = cellPx + 'px';
              if (occ.has(r + ',' + c)) {
                cell.className = 'piece-cell';
                try {
                  paintCellColor(cell, col);
                } catch (_) {
                  cell.style.background = col;
                  cell.style.backgroundColor = col;
                  cell.style.setProperty('--cell-base', col);
                  cell.style.setProperty('--cell-glow', col);
                }
              }
              gridEl.appendChild(cell);
            }
          }
          slot.appendChild(gridEl);
          slot.classList.add('show');
          if (animateIn) {
            slot.style.opacity = '0';
            slot.style.transform = 'scale(0.6) translateY(8px)';
            const delay = 30 + idx * 45;
            setTimeout(() => {
              try {
                slot.style.transition = 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.22,1.1,0.36,1)';
                slot.style.opacity = '1';
                slot.style.visibility = 'visible';
                slot.style.transform = 'scale(1) translateY(0)';
              } catch (_) {}
            }, delay);
            // Safety: never leave refill hand invisible if timeouts were cleared mid-seek
            setTimeout(() => {
              try {
                if (slot && !slot.classList.contains('used')) {
                  slot.style.opacity = '1';
                  slot.style.visibility = 'visible';
                  slot.style.transform = 'none';
                }
              } catch (_) {}
            }, delay + 400);
          } else {
            slot.style.opacity = '1';
            slot.style.visibility = 'visible';
            slot.style.transform = 'none';
          }
        }
        areaEl.appendChild(slot);
      });
    }

    function applyReplayDeal(ev, animateIn) {
      if (!ev || !Array.isArray(ev.pieces)) return;
      // Exact hand from the match log — never invent/pad fake shapes
      const arr = ev.pieces.map(p => ({
        shape: cloneShapeCells(p && p.shape),
        color: (p && p.color) ? String(p.color) : '#7c5cff',
        used: false
      }));
      // Soft appear only for true opening deals; refills always paint solid (avoids invisible 2nd hand)
      const softIn = !!animateIn;
      if (ev.side === 'opp') {
        replayOppPieces = arr;
        const el = document.getElementById('piecesAreaOpp');
        renderReplayTray(el, replayOppPieces, true, softIn);
        try {
          if (el) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.querySelectorAll('.piece-slot:not(.used)').forEach(s => {
              s.style.opacity = '1';
              s.style.visibility = 'visible';
              s.style.transform = 'none';
            });
          }
        } catch (_) {}
      } else {
        replayMePieces = arr;
        const el = document.getElementById('piecesAreaVs');
        renderReplayTray(el, replayMePieces, false, softIn);
        try {
          if (el) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.querySelectorAll('.piece-slot:not(.used)').forEach(s => {
              s.style.opacity = '1';
              s.style.visibility = 'visible';
              s.style.transform = 'none';
            });
          }
        } catch (_) {}
      }
    }

    function findReplaySlot(side, shape, color, pieceIdx) {
      const arr = side === 'me' ? replayMePieces : replayOppPieces;
      const area = document.getElementById(side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
      if (!area || !arr) return { slot: null, idx: -1 };
      let shapeNorm = shape;
      try {
        if (Array.isArray(shape) && typeof normalize === 'function') {
          shapeNorm = normalize(shape.map(c => Array.isArray(c) ? c.slice() : c));
        }
      } catch (_) {}
      const sk = (typeof shapeKey === 'function') ? shapeKey(shapeNorm) : '';
      const ck = (typeof colorKey === 'function') ? colorKey(color) : String(color || '').toLowerCase();
      let shapeOnly = -1;
      let anyUnused = -1;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (!p || p.used || !p.shape) continue;
        if (anyUnused < 0) anyUnused = i;
        let psk = '';
        try {
          const ps = (typeof normalize === 'function')
            ? normalize((p.shape || []).map(c => Array.isArray(c) ? c.slice() : c))
            : p.shape;
          psk = (typeof shapeKey === 'function') ? shapeKey(ps) : '';
        } catch (_) {
          psk = (typeof shapeKey === 'function') ? shapeKey(p.shape) : '';
        }
        if (!sk || psk !== sk) continue;
        const pck = (typeof colorKey === 'function') ? colorKey(p.color) : String(p.color || '').toLowerCase();
        if (ck && pck === ck) {
          return { slot: area.querySelector('.piece-slot[data-replay-idx="' + i + '"]'), idx: i };
        }
        if (shapeOnly < 0) shapeOnly = i;
      }
      if (shapeOnly >= 0) {
        return { slot: area.querySelector('.piece-slot[data-replay-idx="' + shapeOnly + '"]'), idx: shapeOnly };
      }
      // pieceIdx only after shape — avoids collapsing the wrong silhouette
      if (typeof pieceIdx === 'number' && pieceIdx >= 0 && pieceIdx < arr.length &&
          arr[pieceIdx] && !arr[pieceIdx].used) {
        try {
          if (shapeNorm && shapeNorm.length) {
            arr[pieceIdx].shape = (typeof cloneShapeCells === 'function')
              ? cloneShapeCells(shapeNorm) : shapeNorm.map(c => [+c[0]||0, +c[1]||0]);
          }
          if (color) arr[pieceIdx].color = String(color);
          if (typeof renderReplayTray === 'function') {
            renderReplayTray(area, arr, side === 'opp', false);
          }
        } catch (_) {}
        return {
          slot: area.querySelector('.piece-slot[data-replay-idx="' + pieceIdx + '"]'),
          idx: pieceIdx
        };
      }
      // Last resort: first unused slot so tray still collapses
      if (anyUnused >= 0) {
        try {
          if (shapeNorm && shapeNorm.length && arr[anyUnused]) {
            arr[anyUnused].shape = (typeof cloneShapeCells === 'function')
              ? cloneShapeCells(shapeNorm) : shapeNorm.map(c => [+c[0]||0, +c[1]||0]);
            if (color) arr[anyUnused].color = String(color);
            if (typeof renderReplayTray === 'function') {
              renderReplayTray(area, arr, side === 'opp', false);
            }
          }
        } catch (_) {}
        return { slot: area.querySelector('.piece-slot[data-replay-idx="' + anyUnused + '"]'), idx: anyUnused };
      }
      return { slot: null, idx: -1 };
    }

    function markReplayPieceUsed(side, idx) {
      const arr = side === 'me' ? replayMePieces : replayOppPieces;
      const area = document.getElementById(side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
      if (idx >= 0 && arr[idx]) arr[idx].used = true;
      else {
        const u = arr.find(p => !p.used);
        if (u) u.used = true;
      }
      // Soft collapse existing DOM node — no full re-render (avoids flicker)
      if (area && idx >= 0) {
        const slot = area.querySelector(`.piece-slot[data-replay-idx="${idx}"]`);
        if (slot) {
          slot.classList.remove('lifting', 'show');
          slot.classList.add('used');
          try {
            slot.style.width = '0';
            slot.style.minWidth = '0';
            slot.style.maxWidth = '0';
            slot.style.height = '0';
            slot.style.opacity = '0';
            slot.style.margin = '0';
            slot.style.padding = '0';
            slot.style.border = 'none';
            slot.style.background = 'transparent';
            slot.style.boxShadow = 'none';
            slot.innerHTML = '';
          } catch (_) {}
        }
      }
    }

    function isReplayDealEv(ev) {
      if (!ev) return false;
      const t = ev.type;
      return t === 'deal' || t === 'Deal';
    }

    function leadingDealCount(moves) {
      let n = 0;
      while (n < moves.length && isReplayDealEv(moves[n])) n++;
      return n;
    }

    /** Index of the first deal event for a side (me|opp), or -1 */
    function firstDealIndex(moves, side) {
      if (!moves || !moves.length) return -1;
      const wantOpp = side === 'opp';
      for (let i = 0; i < moves.length; i++) {
        const ev = moves[i];
        if (!isReplayDealEv(ev)) continue;
        const isOpp = ev.side === 'opp';
        if (isOpp === wantOpp) return i;
      }
      return -1;
    }

    /**
     * Hands at the true start of the match: first deal for each side.
     * Opp's first deal may appear AFTER the player's first place when the player moved first —
     * still use that deal as the opening tray (not only consecutive leading deals).
     */

    /**
     * Rebuild tray arrays from the move log so shapes always match what is placed.
     * Deals define hand slots; each place overwrites that slot's shape/color from the place event.
     * Fixes opp-moved-first races where the logged deal is the wrong/refill hand.
     */
    function rebuildReplayTraysFromMoves(moves, endIdx) {
      const end = Math.max(0, Math.min(endIdx == null ? (moves ? moves.length : 0) : endIdx, moves ? moves.length : 0));
      let me = [];
      let opp = [];
      const cloneSh = (sh) => {
        try {
          if (typeof cloneShapeCells === 'function') return cloneShapeCells(sh);
        } catch (_) {}
        if (!Array.isArray(sh)) return [[0, 0]];
        return sh.map(c => Array.isArray(c) ? [+c[0] || 0, +c[1] || 0] : [0, 0]);
      };
      const freshDeal = (ev) => {
        if (!ev || !Array.isArray(ev.pieces)) return [];
        return ev.pieces.map(p => ({
          shape: cloneSh(p && p.shape),
          color: (p && p.color) ? String(p.color) : '#7c5cff',
          used: false
        }));
      };
      const emptyHand = () => ([
        { shape: [[0, 0]], color: '#7c5cff', used: false },
        { shape: [[0, 0]], color: '#7c5cff', used: false },
        { shape: [[0, 0]], color: '#7c5cff', used: false }
      ]);
      const markPlace = (arr, m) => {
        // Implicit refill when the logged deal is late/missing
        if (!arr.length || arr.every(p => p && p.used)) arr = emptyHand();
        const placeShape = cloneSh(m.shape);
        const sk = (typeof shapeKey === 'function') ? shapeKey(placeShape) : '';
        const ck = (typeof colorKey === 'function') ? colorKey(m.color) : '';
        let idx = -1;
        // 1) shape (+color) among unused — tray must match what lands on the board
        for (let j = 0; j < arr.length; j++) {
          if (!arr[j] || arr[j].used) continue;
          let psk = '';
          try { psk = shapeKey(arr[j].shape); } catch (_) {}
          if (sk && psk === sk) {
            if (!ck || colorKey(arr[j].color) === ck) { idx = j; break; }
            if (idx < 0) idx = j;
          }
        }
        // 2) pieceIdx only if that slot is still free
        if (idx < 0 && typeof m.pieceIdx === 'number' && m.pieceIdx >= 0 &&
            m.pieceIdx < arr.length && arr[m.pieceIdx] && !arr[m.pieceIdx].used) {
          idx = m.pieceIdx;
        }
        // 3) first unused
        if (idx < 0) {
          for (let j = 0; j < arr.length; j++) {
            if (arr[j] && !arr[j].used) { idx = j; break; }
          }
        }
        if (idx < 0) {
          arr = emptyHand();
          idx = 0;
        }
        arr[idx].shape = placeShape;
        if (m.color) arr[idx].color = String(m.color);
        arr[idx].used = true;
        return arr;
      };
      for (let i = 0; i < end; i++) {
        const m = moves[i];
        if (!m) continue;
        if (m.type === 'deal' || m.type === 'Deal') {
          if (m.side === 'opp') opp = freshDeal(m);
          else me = freshDeal(m);
          continue;
        }
        if (!(m.type === 'place' || m.shape)) continue;
        if (m.side === 'opp') opp = markPlace(opp, m);
        else me = markPlace(me, m);
      }
      // If a side still has no hand, synthesize from its places in the full log (opening race)
      const synthFromPlaces = (side) => {
        const hand = emptyHand();
        let n = 0;
        for (let i = 0; i < moves.length && n < 3; i++) {
          const m = moves[i];
          if (!m || !(m.type === 'place' || m.shape)) continue;
          if ((m.side === 'opp') !== (side === 'opp')) continue;
          const idx = (typeof m.pieceIdx === 'number' && m.pieceIdx >= 0 && m.pieceIdx < 3)
            ? m.pieceIdx : n;
          hand[idx].shape = cloneSh(m.shape);
          if (m.color) hand[idx].color = String(m.color);
          hand[idx].used = false;
          n++;
        }
        return hand;
      };
      if (!me.length) me = synthFromPlaces('me');
      if (!opp.length) opp = synthFromPlaces('opp');
      // Align unused opening slots with the next places of that side (deal may be wrong hand)
      const alignUnused = (arr, side) => {
        if (!arr || !arr.length) return arr;
        const unusedIdx = [];
        for (let j = 0; j < arr.length; j++) if (arr[j] && !arr[j].used) unusedIdx.push(j);
        if (!unusedIdx.length) return arr;
        const upcoming = [];
        for (let i = end; i < moves.length && upcoming.length < unusedIdx.length; i++) {
          const m = moves[i];
          if (!m) continue;
          if ((m.type === 'deal' || m.type === 'Deal') && ((m.side === 'opp') === (side === 'opp'))) {
            // next hand starts — do not pull shapes from a later deal's places
            if (upcoming.length) break;
            continue;
          }
          if (!(m.type === 'place' || m.shape)) continue;
          if ((m.side === 'opp') !== (side === 'opp')) continue;
          upcoming.push(m);
        }
        // Also collect places already consumed to fix used slots that were mismatch-marked
        // Prefer mapping upcoming free slots by pieceIdx then order
        for (let k = 0; k < upcoming.length && k < unusedIdx.length; k++) {
          const m = upcoming[k];
          let slot = unusedIdx[k];
          if (typeof m.pieceIdx === 'number' && m.pieceIdx >= 0 && m.pieceIdx < arr.length &&
              arr[m.pieceIdx] && !arr[m.pieceIdx].used) {
            slot = m.pieceIdx;
          }
          arr[slot].shape = cloneSh(m.shape);
          if (m.color) arr[slot].color = String(m.color);
        }
        return arr;
      };
      me = alignUnused(me, 'me');
      opp = alignUnused(opp, 'opp');
      replayMePieces = me;
      replayOppPieces = opp;
    }

    function applyOpeningReplayHands(moves, animateIn) {
      const mi = firstDealIndex(moves, 'me');
      const oi = firstDealIndex(moves, 'opp');
      if (mi >= 0) applyReplayDeal(moves[mi], !!animateIn);
      else replayMePieces = [];
      if (oi >= 0) applyReplayDeal(moves[oi], !!animateIn);
      else replayOppPieces = [];
    }

    /** Deal active just before index: last deal < beforeIdx, else first deal in log (late-logged opening hand) */
    function dealIndexForSideBefore(moves, side, beforeIdx) {
      if (!moves || !moves.length) return -1;
      const wantOpp = side === 'opp';
      let last = -1;
      const limit = Math.max(0, beforeIdx | 0);
      for (let i = 0; i < moves.length; i++) {
        const ev = moves[i];
        if (!isReplayDealEv(ev)) continue;
        if ((ev.side === 'opp') !== wantOpp) continue;
        if (i < limit) last = i;
        else {
          if (last < 0) return i;
          break;
        }
      }
      return last;
    }

    function ensureReplayHandBefore(side, beforeIdx) {
      if (!replayData || !replayData.moves) return;
      const arr = side === 'opp' ? replayOppPieces : replayMePieces;
      const hasUnused = !!(arr && arr.some(p => p && !p.used));
      if (hasUnused) return;

      const wantOpp = side === 'opp';
      const limit = Math.max(0, beforeIdx | 0);
      let di = dealIndexForSideBefore(replayData.moves, side, beforeIdx);
      if (di < 0) di = firstDealIndex(replayData.moves, side);

      // Hand exhausted: prefer a later deal for this side still before the place,
      // or the next deal at/after the place (online race: places logged before refill deal)
      if (arr && arr.length && arr.every(p => p && p.used)) {
        let nextBefore = -1;
        for (let i = (di >= 0 ? di + 1 : 0); i < limit; i++) {
          const ev = replayData.moves[i];
          if (!isReplayDealEv(ev)) continue;
          if ((ev.side === 'opp') === wantOpp) nextBefore = i;
        }
        if (nextBefore >= 0) {
          di = nextBefore;
        } else {
          for (let i = limit; i < replayData.moves.length; i++) {
            const ev = replayData.moves[i];
            if (!isReplayDealEv(ev)) continue;
            if ((ev.side === 'opp') === wantOpp) { di = i; break; }
          }
        }
      }

      if (di >= 0) {
        applyReplayDeal(replayData.moves[di], false);
        return;
      }
      // No deal in log for refill — synthesize next hand from the next places of this side
      const places = [];
      for (let i = limit; i < replayData.moves.length && places.length < 3; i++) {
        const ev = replayData.moves[i];
        if (!ev) continue;
        if ((ev.type === 'deal' || ev.type === 'Deal') && ((ev.side === 'opp') === wantOpp)) break;
        if (!(ev.type === 'place' || ev.shape)) continue;
        if ((ev.side === 'opp') !== wantOpp) continue;
        places.push(ev);
      }
      if (!places.length) return;
      const hand = places.map(p => ({
        shape: (typeof cloneShapeCells === 'function') ? cloneShapeCells(p.shape) : (p.shape || [[0,0]]).map(c => [+c[0]||0, +c[1]||0]),
        color: p.color ? String(p.color) : '#7c5cff',
        used: false
      }));
      while (hand.length < 3) hand.push({ shape: [[0,0]], color: '#7c5cff', used: true });
      if (wantOpp) {
        replayOppPieces = hand;
        try { renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, true); } catch (_) {}
      } else {
        replayMePieces = hand;
        try { renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, true); } catch (_) {}
      }
    }

    /**
     * Move each side's first deal before their first place (online race often logs deal after place).
     */
    function normalizeMatchLogDealOrder(moves) {
      if (!Array.isArray(moves) || moves.length < 2) return moves;
      try {
        const out = moves.slice();
        const pull = (side) => {
          const wantOpp = side === 'opp';
          let di = -1;
          for (let i = 0; i < out.length; i++) {
            if (!isReplayDealEv(out[i])) continue;
            if ((out[i].side === 'opp') === wantOpp) { di = i; break; }
          }
          if (di < 0) return;
          let firstPlace = -1;
          for (let i = 0; i < out.length; i++) {
            const m = out[i];
            if (!m || isReplayDealEv(m)) continue;
            if (m.type === 'place' || (m.shape && m.type !== 'deal' && m.type !== 'Deal')) {
              if (wantOpp ? m.side === 'opp' : m.side !== 'opp') { firstPlace = i; break; }
            }
          }
          if (firstPlace < 0 || di < firstPlace) return;
          const deal = out.splice(di, 1)[0];
          // Insert among leading deals, always before this side's first place
          let insertAt = 0;
          while (insertAt < out.length && isReplayDealEv(out[insertAt])) insertAt++;
          const fp = firstPlace > di ? firstPlace - 1 : firstPlace;
          insertAt = Math.min(insertAt, Math.max(0, fp));
          out.splice(insertAt, 0, deal);
        };
        // Opp first: when they moved first their deal is often after their place
        pull('opp');
        pull('me');
        // Second pass in case pulling one shifted the other
        pull('opp');
        pull('me');
        return out;
      } catch (_) {
        return moves;
      }
    }

    /** Min seek index after consecutive leading deals + first deal of each side */
    function replayBootstrapIndex(moves) {
      if (!moves || !moves.length) return 0;
      let n = leadingDealCount(moves);
      const mi = firstDealIndex(moves, 'me');
      const oi = firstDealIndex(moves, 'opp');
      let firstPlace = -1;
      for (let i = 0; i < moves.length; i++) {
        const ev = moves[i];
        if (!ev) continue;
        if (ev.type === 'place' || (ev.shape && ev.type !== 'deal' && ev.type !== 'Deal')) {
          firstPlace = i;
          break;
        }
      }
      const candidates = [n];
      // Always include opening deal of each side in the "start" cursor when it appears before any place
      if (mi >= 0 && (firstPlace < 0 || mi < firstPlace)) candidates.push(mi + 1);
      if (oi >= 0 && (firstPlace < 0 || oi < firstPlace)) candidates.push(oi + 1);
      // When a side's first deal is still after the first place (race), still advance past
      // consecutive leading deals only — applyOpeningReplayHands paints the late opening hand.
      return Math.max.apply(null, candidates);
    }

    /** Safe min index for seek/reset — never before both opening hands are accounted for */
    function replayMinIndex(moves) {
      if (!moves || !moves.length) return 0;
      try {
        return Math.max(leadingDealCount(moves), replayBootstrapIndex(moves));
      } catch (_) {
        return leadingDealCount(moves);
      }
    }

    function resetReplay() {
      if (!replayData) return;
      stopReplayPlay();
      rebuildReplayTo(replayMinIndex(replayData.moves), true);
    }

    /** Rebuild state after applying events [0 .. end) */
    function rebuildReplayTo(end, animateDeals = false) {
      if (!replayData) return;
      replayBusy = false;
      clearReplayEffects();

      const minIdx = replayMinIndex(replayData.moves);
      end = Math.max(minIdx, Math.min(end, replayData.moves.length));

      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      createBoardDOM(boardMe);
      createBoardDOM(boardOpp);

      replayMePieces = [];
      replayOppPieces = [];
      document.getElementById('piecesAreaVs').innerHTML = '';
      const oa = document.getElementById('piecesAreaOpp');
      if (oa) oa.innerHTML = '';

      // Trays from deals + place shapes (place wins) — fixes wrong first hands when opp moved first
      try { rebuildReplayTraysFromMoves(replayData.moves, end); } catch (_) {
        try { applyOpeningReplayHands(replayData.moves, false); } catch (_) {}
      }

      let my = 0, opp = 0;
      for (let i = 0; i < end; i++) {
        const m = replayData.moves[i];
        if (!m) continue;
        if (m.type === 'deal' || m.type === 'Deal') {
          // Tray already built by rebuildReplayTraysFromMoves; optional soft anim on bootstrap deals
          if (animateDeals && i < minIdx) {
            try {
              if (m.side === 'opp') renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, true);
              else renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, true);
            } catch (_) {}
          }
        } else if (m.type === 'place' || m.shape) {
          const placeSide = m.side === 'opp' ? 'opp' : 'me';
          const g = placeSide === 'me' ? grid : oppGrid;
          const placeShape = Array.isArray(m.shape) ? m.shape : [];
          for (const cell of placeShape) {
            if (!Array.isArray(cell) || cell.length < 2) continue;
            const dr = +cell[0] || 0, dc = +cell[1] || 0;
            if (g[m.r + dr]) g[m.r + dr][m.c + dc] = m.color;
          }
          clearLinesSilent(g);
          if (typeof m.myScore === 'number') my = m.myScore;
          if (typeof m.oppScore === 'number') opp = m.oppScore;
        }
      }

      // Fallback empty trays
      try {
        if (!replayMePieces.length) {
          let di = dealIndexForSideBefore(replayData.moves, 'me', end);
          if (di < 0) di = firstDealIndex(replayData.moves, 'me');
          if (di >= 0) applyReplayDeal(replayData.moves[di], false);
        }
        if (!replayOppPieces.length) {
          let di = dealIndexForSideBefore(replayData.moves, 'opp', end);
          if (di < 0) di = firstDealIndex(replayData.moves, 'opp');
          if (di >= 0) applyReplayDeal(replayData.moves[di], false);
        }
      } catch (_) {}

      renderGrid(grid, boardMe);
      renderGrid(oppGrid, boardOpp);
      renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
      renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
      document.getElementById('myScore').textContent = my;
      document.getElementById('oppScore').textContent = opp;
      clearReplayEffects();

      // Re-apply cosmetics after createBoardDOM — otherwise opp field/skin resets on step-back
      try {
        if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
        if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
        if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
        else if (replayData && replayData.oppBoardId && typeof applyOppBoard === 'function') {
          window.mpOppBoardId = replayData.oppBoardId;
          applyOppBoard(replayData.oppBoardId);
        }
        if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
        else if (replayData && replayData.oppSkinId && typeof applyOppSkin === 'function') {
          window.mpOppSkinId = replayData.oppSkinId;
          applyOppSkin(replayData.oppSkinId);
        }
      } catch (_) {}

      replayIndex = end;
      replayClockMs = end > 0 ? getEventTime(replayData.moves[end - 1], end - 1) : 0;
      updateReplayClockDisplay();
      document.getElementById('reviewMeta').textContent =
        `Событие ${replayIndex} / ${replayData.moves.length} · ${my}:${opp}`;
      try { updateReplayProgressUI(); } catch (_) {}
    }

    function replayStepBack() {
      if (!replayData || replayBusy) return;
      const minIdx = (typeof replayMinIndex === 'function')
        ? replayMinIndex(replayData.moves)
        : leadingDealCount(replayData.moves);
      const target = Math.max(minIdx, replayIndex - 1);
      if (target === replayIndex) return;
      seekReplayTo(target, { force: true });
    }

    function replayStep(onDone, speed = 1) {
      if (!replayData || replayIndex >= replayData.moves.length || replayBusy) {
        if (onDone) onDone();
        return false;
      }
      const m = replayData.moves[replayIndex];
      // Visual timing scales with speed, but 1x matches live feel
      const s = Math.max(1, speed || 1);
      // Softer flight + land (slightly longer at 1x, still snappy when sped up)
      const tFly = Math.max(120, 380 / s);
      const tClear = Math.max(50, 120 / s);
      const tDeal = Math.max(110, 320 / s);
      const tLift = Math.max(50, 100 / s);

      // Deal — soft staggered appear, same as live
      if (m.type === 'deal' || m.type === 'Deal') {
        replayBusy = true;
        applyReplayDeal(m, true);
        replayIndex++;
        document.getElementById('reviewMeta').textContent =
          `Событие ${replayIndex} / ${replayData.moves.length} · раздача (${m.side === 'me' ? 'ты' : 'соперник'})`;
        try { updateReplayProgressUI(); } catch (_) {}
        setTimeout(() => {
          replayBusy = false;
          if (onDone) onDone();
        }, tDeal);
        return true;
      }

      // Place — mirror live: lift → fly → land → collapse → clear + combo floats
      replayBusy = true;
      try {
        ensureReplayHandBefore(m.side === 'opp' ? 'opp' : 'me', replayIndex);
      } catch (_) {}
      const g = m.side === 'me' ? grid : oppGrid;
      const board = m.side === 'me' ? boardMe : boardOpp;
      const boardRect = board.getBoundingClientRect();
      const gapSz = 2.5;
      const step = (boardRect.width - gapSz * (SIZE - 1)) / SIZE;
      const maxR = Math.max(...m.shape.map(s => s[0]));
      const maxC = Math.max(...m.shape.map(s => s[1]));
      const targetX = boardRect.left + (m.c + maxC / 2) * (step + gapSz) + step / 2;
      const targetY = boardRect.top + (m.r + maxR / 2) * (step + gapSz) + step / 2;

      const found = findReplaySlot(m.side, m.shape, m.color, m.pieceIdx);
      let startX, startY;
      if (found.slot) {
        const sr = found.slot.getBoundingClientRect();
        startX = sr.left + sr.width / 2;
        startY = sr.top + sr.height / 2;
        found.slot.classList.add('lifting');
      } else {
        const trayEl = document.getElementById(m.side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
        if (trayEl) {
          const tr = trayEl.getBoundingClientRect();
          startX = tr.left + tr.width / 2;
          startY = tr.top + tr.height / 2;
        } else {
          startX = boardRect.left + boardRect.width / 2;
          startY = boardRect.bottom + 20;
        }
      }

      const ghost = document.getElementById('aiGhost');
      // Apply the same skin FX as the tray / board for this side (legendary prism, epic gloss, …)
      try { setAiGhostSkin(m.side === 'opp' ? 'opp' : 'me'); } catch (_) {}
      let cellPx = Math.max(10, Math.round(step * 0.92));
      let gapPx = Math.max(1, Math.round(step - cellPx));
      try {
        const c0 = board.children[0];
        if (c0) {
          const rw = c0.getBoundingClientRect().width;
          if (rw > 4) { cellPx = Math.round(rw); gapPx = Math.max(1, Math.round(step - cellPx)); }
        }
      } catch (_) {}
      // Normalize shape for ghost grid
      let flyShape = m.shape;
      try { if (typeof normalize === 'function') flyShape = normalize(m.shape.map(c => c.slice())); } catch (_) {}
      ghost.innerHTML = buildPieceGhostHTML({ shape: flyShape, color: m.color }, cellPx, gapPx);
      ghost.style.transition = 'none';
      ghost.style.transform = 'translate(-50%,-50%) scale(0.82)';
      ghost.style.left = startX + 'px';
      ghost.style.top = startY + 'px';
      ghost.style.display = 'block';
      ghost.style.opacity = '0';
      void ghost.offsetWidth;
      // Pickup: fade+scale up in tray, then soft fly + settle onto board
      ghost.style.transition =
        `opacity ${tLift}ms ease, transform ${tLift}ms cubic-bezier(0.33, 0.0, 0.25, 1)`;
      requestAnimationFrame(() => {
        ghost.style.opacity = '1';
        ghost.style.transform = 'translate(-50%,-50%) scale(1.03)';
      });
      setTimeout(() => {
        ghost.style.transition =
          `left ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease, transform ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        requestAnimationFrame(() => {
          ghost.style.left = targetX + 'px';
          ghost.style.top = targetY + 'px';
          ghost.style.transform = 'translate(-50%,-50%) scale(1)';
        });
      }, tLift);

      setTimeout(() => {
        for (const [dr, dc] of m.shape) {
          if (!g[m.r + dr]) continue;
          g[m.r + dr][m.c + dc] = m.color;
          const cell = board.children[(m.r + dr) * SIZE + (m.c + dc)];
          if (cell) {
            paintCellColor(cell, m.color);
            cell.classList.add('filled', 'placing');
            setTimeout(() => cell.classList.remove('placing'), Math.max(400, 900 / s));
          }
        }
        // Legendary placement sparks (same as live)
        try {
          const wantLegend = !!(m.legendFx) ||
            (m.side === 'me' && document.body.classList.contains('skin-fx-prism')) ||
            (m.side === 'opp' && document.querySelector('.player-panel.opp') &&
              document.querySelector('.player-panel.opp').classList.contains('skin-fx-prism'));
          if (wantLegend && typeof spawnLegendSparks === 'function') {
            const wrap = board.parentElement;
            const maxRr0 = Math.max(...(m.shape || [[0, 0]]).map(s => s[0]));
            const maxCr0 = Math.max(...(m.shape || [[0, 0]]).map(s => s[1]));
            const cell0 = board.children[m.r * SIZE + m.c];
            let origin = null;
            if (cell0 && wrap) {
              const cr = cell0.getBoundingClientRect();
              const wr = wrap.getBoundingClientRect();
              origin = {
                left: cr.left - wr.left + cr.width * (0.5 + maxCr0 / 2),
                top: cr.top - wr.top + cr.height * (0.5 + maxRr0 / 2)
              };
            }
            const skinForFx = m.skinId ||
              (m.side === 'opp' ? window.mpOppSkinId : (document.body.dataset.skinId || equippedSkinId)) ||
              'gold';
            spawnLegendSparks(wrap, 6 + (m.shape ? m.shape.length : 4), skinForFx, origin);
          }
        } catch (_) {}
        ghost.style.opacity = '0';
        setTimeout(() => {
          ghost.style.display = 'none';
          ghost.style.transform = 'translate(-50%,-50%) scale(1)';
        }, 150);

        markReplayPieceUsed(m.side, found.idx);
        // Show place points first, then full score after clear (mirrors live feel)
        try {
          const placePts = (typeof m.placePts === 'number')
            ? m.placePts
            : (Array.isArray(m.shape) ? m.shape.length * 10 : 0);
          const clearedN = m.cleared || 0;
          const bonusN = m.bonus || 0;
          if (m.side === 'me') {
            const beforeClear = (typeof m.myScore === 'number')
              ? Math.max(0, m.myScore - (clearedN > 0 ? bonusN : 0))
              : null;
            if (beforeClear != null) document.getElementById('myScore').textContent = beforeClear;
            else if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
            if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
          } else {
            const beforeClear = (typeof m.oppScore === 'number')
              ? Math.max(0, m.oppScore - (clearedN > 0 ? bonusN : 0))
              : null;
            if (beforeClear != null) document.getElementById('oppScore').textContent = beforeClear;
            else if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
            if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
          }
          // Brief +N float for place points
          if (placePts > 0 && settings.anim !== 'off' && !document.body.classList.contains('no-floats')) {
            const wrap = board.parentElement;
            if (wrap) {
              const maxRr = Math.max(...(m.shape || [[0, 0]]).map(s => s[0]));
              const maxCr = Math.max(...(m.shape || [[0, 0]]).map(s => s[1]));
              const cell0 = board.children[(m.r + Math.floor(maxRr / 2)) * SIZE + (m.c + Math.floor(maxCr / 2))]
                || board.children[m.r * SIZE + m.c];
              if (cell0) {
                const cr = cell0.getBoundingClientRect();
                const wr = wrap.getBoundingClientRect();
                const fl = document.createElement('div');
                fl.className = 'score-float';
                fl.textContent = '+' + placePts;
                fl.style.left = (cr.left - wr.left + cr.width / 2) + 'px';
                fl.style.top = (cr.top - wr.top) + 'px';
                wrap.appendChild(fl);
                setTimeout(() => { try { fl.remove(); } catch (_) {} }, Math.max(600, 1100 / s));
              }
            }
          }
        } catch (_) {
          try {
            document.getElementById('myScore').textContent = m.myScore;
            document.getElementById('oppScore').textContent = m.oppScore;
          } catch (_2) {}
        }

        setTimeout(() => {
          // Animated clear + same combo/float as live
          let cleared = m.cleared || 0;
          let bonus = m.bonus || 0;
          let rows = Array.isArray(m.rows) ? m.rows.slice() : [];
          let cols = Array.isArray(m.cols) ? m.cols.slice() : [];
          if (!cleared) {
            rows = []; cols = [];
            for (let r = 0; r < SIZE; r++) if (g[r].every(c => c !== null)) rows.push(r);
            for (let c = 0; c < SIZE; c++) if (g.every(row => row[c] !== null)) cols.push(c);
            cleared = rows.length + cols.length;
            if (cleared) bonus = bonusFor(cleared);
          }
          if (cleared > 0) {
            if (m.side === 'me') {
              window._repChainMe = (typeof m.chain === 'number' && m.chain > 0)
                ? m.chain
                : ((window._repChainMe || 0) + 1);
              window._repChainOpp = 0;
            } else {
              window._repChainOpp = (typeof m.chain === 'number' && m.chain > 0)
                ? m.chain
                : ((window._repChainOpp || 0) + 1);
              window._repChainMe = 0;
            }
            const chain = (typeof m.chain === 'number' && m.chain > 0)
              ? m.chain
              : (m.side === 'me' ? window._repChainMe : window._repChainOpp);
            const info = clearLinesOn(g, board);
            rows = info.rows.length ? info.rows : rows;
            cols = info.cols.length ? info.cols : cols;
            const banner = m.side === 'me'
              ? document.getElementById('comboBannerMe')
              : document.getElementById('comboBannerOpp');
            const maxRr = Math.max(...(m.shape || [[0,0]]).map(s => s[0]));
            const maxCr = Math.max(...(m.shape || [[0,0]]).map(s => s[1]));
            const placeAnchor = (typeof m.r === 'number') ? {
              baseR: m.r, baseC: m.c,
              centerR: m.r + maxRr / 2,
              centerC: m.c + maxCr / 2
            } : null;
            const positions = getClearFloatPositions(board, rows, cols, placeAnchor);
            const wrap = board.parentElement;
            const baseBonus = (typeof m.baseBonus === 'number') ? m.baseBonus : bonusFor(cleared);
            const chainExtra = (typeof m.chainExtra === 'number') ? m.chainExtra : (bonus - baseBonus);
            showCombo(
              banner || (wrap && wrap.querySelector('.combo-banner')),
              cleared,
              bonus || bonusFor(cleared),
              wrap,
              m.side === 'me' ? 'me' : 'opp',
              { chain, positions, placeAnchor, baseBonus, chainExtra }
            );
            // Final scores after clear bonus
            try {
              if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
              if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
            } catch (_) {}
          } else {
            if (m.side === 'me') window._repChainMe = 0;
            else window._repChainOpp = 0;
            clearLinesSilent(g);
            renderGrid(g, board);
            try {
              if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
              if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
            } catch (_) {}
          }

          replayIndex++;
          document.getElementById('reviewMeta').textContent =
            `Событие ${replayIndex} / ${replayData.moves.length} · ${m.side === 'me' ? 'Ты' : 'Соперник'} · ${m.myScore}:${m.oppScore}`;
          try { updateReplayProgressUI(); } catch (_) {}
          setTimeout(() => {
            replayBusy = false;
            if (onDone) onDone();
            // Manual step landed on last event → offer result after a beat
            if (!replayPlaying && replayData && replayIndex >= replayData.moves.length) {
              setTimeout(() => {
                if (replayMode && !replayPlaying && replayIndex >= replayData.moves.length) {
                  try { showReplayResult(); } catch (_) {}
                }
              }, 420);
            }
          }, tClear);
        }, Math.max(60, 160 / s));
      }, tFly + Math.max(80, 160 / s));

      return true;
    }

    document.getElementById('cardClassic').addEventListener('click', () => startClassic(false));
    document.getElementById('cardVersus').addEventListener('click', startVersusFlow);
    ['cardClassic', 'cardVersus'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });
    document.getElementById('btnBackFromComp').addEventListener('click', () => { showScreen('menu'); updateMenuStats(); });
    document.getElementById('cardOnline').addEventListener('click', goDurationFromOnline);
    document.getElementById('cardBots').addEventListener('click', goDifficulty);
    ['cardOnline', 'cardBots'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });
    document.getElementById('btnDiffNext').addEventListener('click', () => showScreen('duration'));

    let botPickBusy = false;
    function showBotPickOverlay(bot, phase) {
      const ov = document.getElementById('botPickOverlay');
      const av = document.getElementById('botPickAvatar');
      const name = document.getElementById('botPickName');
      const meta = document.getElementById('botPickMeta');
      const stars = document.getElementById('botPickStars');
      const label = document.getElementById('botPickLabel');
      if (!ov || !bot) return;
      av.innerHTML = botAvatarSVG(bot, 72);
      name.textContent = bot.name;
      meta.textContent = `🏆 ${bot.trophies} · ${bot.title || botTierLabel(bot.trophies)}`;
      const st = botStars[bot.id] || {};
      stars.innerHTML = [60, 120, 180].map(sec =>
        `<span style="opacity:${st[String(sec)] ? 1 : 0.25}">★</span>`
      ).join('');
      if (phase === 'spin') {
        label.textContent = 'Выбор соперника…';
        av.classList.add('spin');
      } else {
        label.textContent = 'Твой соперник';
        av.classList.remove('spin');
      }
      ov.classList.add('visible');
      ov.setAttribute('aria-hidden', 'false');
    }
    function hideBotPickOverlay() {
      const ov = document.getElementById('botPickOverlay');
      if (!ov) return;
      ov.classList.remove('visible');
      ov.setAttribute('aria-hidden', 'true');
      const av = document.getElementById('botPickAvatar');
      if (av) av.classList.remove('spin');
    }
    function startRandomBotPick() {
      if (botPickBusy) return;
      if (!BOTS.length) return;
      botPickBusy = true;
      SFX.ui();
      hapticTap(10);
      const sorted = [...BOTS];
      let ticks = 0;
      const totalTicks = 14 + Math.floor(Math.random() * 6);
      let delay = 55;
      const finalBot = sorted[Math.floor(Math.random() * sorted.length)];

      const tick = () => {
        ticks++;
        const show = ticks >= totalTicks
          ? finalBot
          : sorted[Math.floor(Math.random() * sorted.length)];
        showBotPickOverlay(show, ticks >= totalTicks ? 'final' : 'spin');
        if (ticks < totalTicks) {
          delay = Math.min(160, delay + 8);
          setTimeout(tick, delay);
        } else {
          selectedBotId = finalBot.id;
          currentBot = finalBot;
          renderBotList();
          // scroll selected into view
          const card = document.querySelector(`.bot-card[data-bot="${finalBot.id}"]`);
          if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          SFX.ui();
          hapticTap(16);
          setTimeout(() => {
            hideBotPickOverlay();
            botPickBusy = false;
            showScreen('duration');
          }, 900);
        }
      };
      tick();
    }
    document.getElementById('btnRandomBot').addEventListener('click', startRandomBotPick);
    document.getElementById('btnBackDiff').addEventListener('click', () => showScreen('compType'));
    document.getElementById('btnBackMenu').addEventListener('click', () => {
      if (vsModeType === 'bots') showScreen('difficulty');
      else showScreen('compType');
    });
    document.getElementById('btnClassicMenu').addEventListener('click', () => { showScreen('menu'); updateMenuStats(); });
    document.querySelectorAll('#screenDuration .dur-card').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#screenDuration .dur-card').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        vsDuration = parseInt(btn.dataset.sec, 10);
      });
    });
    document.getElementById('btnStartMatch').addEventListener('click', startMatchFlow);
    document.getElementById('btnCancelSearch').addEventListener('click', () => {
      stopMatchmaking(true);
      mmFound = false;
      showScreen('duration');
      mmSetStatus('Ищем соперника...', '—');
    });
    
    (function bindSkinPreviewModal() {
      const close = document.getElementById('skinPrevClose');
      const ov = document.getElementById('skinPreviewModal');
      if (close) close.addEventListener('click', closeSkinPreview);
      if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) closeSkinPreview(); });
    })();

    document.getElementById('btnShop').addEventListener('click', () => {
      renderShopGrid();
      showScreen('shop');
    });
    document.getElementById('btnInventory').addEventListener('click', () => {
      renderInvGrid();
      showScreen('inventory');
    });
    document.getElementById('btnShopBack').addEventListener('click', () => {
      try { closeShopInvSections(); } catch (_) {}
      showScreen('menu');
      updateMenuStats();
    });
    document.getElementById('btnInvBack').addEventListener('click', () => {
      try { closeShopInvSections(); } catch (_) {}
      showScreen('menu');
      updateMenuStats();
    });
    // Shop & Inventory are separate screens (no cross-tabs)
    const _shopToInv = document.getElementById('btnShopToInv');
    if (_shopToInv) _shopToInv.addEventListener('click', () => {
      try { closeShopInvSections(); } catch (_) {}
      renderInvGrid();
      showScreen('inventory');
    });
    const _invToShop = document.getElementById('btnInvToShop');
    if (_invToShop) _invToShop.addEventListener('click', () => {
      try { closeShopInvSections(); } catch (_) {}
      renderShopGrid();
      showScreen('shop');
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
            document.getElementById('infoToastLabel').textContent = 'Аватар';
            document.getElementById('infoToastText').textContent = (err && err.message) || 'Ошибка загрузки';
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
      showScreen('menu');
      updateMenuStats();
      refreshProfileUI();
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
            document.getElementById('infoToastLabel').textContent = 'Профиль';
            document.getElementById('infoToastText').textContent = res.err || 'Ошибка';
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
          document.getElementById('infoToastLabel').textContent = 'Профиль';
          document.getElementById('infoToastText').textContent = 'Сохранено';
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
          document.getElementById('infoToastLabel').textContent = 'Код';
          document.getElementById('infoToastText').textContent = 'Скопирован';
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

    document.getElementById('btnSettings').addEventListener('click', () => {
      applySettings();
      showScreen('settings');
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

    document.getElementById('btnSettingsBack').addEventListener('click', () => {
      applySettings();
      showScreen('menu');
      updateMenuStats();
    });
    document.getElementById('btnSettingsReset').addEventListener('click', () => {
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

    document.getElementById('btnAchievements').addEventListener('click', () => {
      renderAchievements();
      try { updateClaimAllButton(); } catch (_) {}
      showScreen('achievements');
    });
    document.getElementById('btnClaimAllAch')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (claimAllBusy || achClaimOpen) return;
      try { SFX.ui(); hapticTap(14); } catch (_) {}
      claimAllAchievements();
    });
    try { updateAchievementsButton(); } catch (_) {}
    document.getElementById('btnAchBack').addEventListener('click', () => {
      showScreen('menu');
      updateMenuStats();
    });
    document.getElementById('btnNew').addEventListener('click', () => { clearClassicSave(); startClassic(true); });
    document.getElementById('btnRestart').addEventListener('click', () => { clearClassicSave(); startClassic(true); });
    document.getElementById('btnOverMenu').addEventListener('click', () => {
      gameOverEl.classList.remove('visible'); showScreen('menu'); updateMenuStats();
    });
    document.getElementById('btnRelief').addEventListener('click', doRelief);
    document.getElementById('btnUseDiamond').addEventListener('click', doRelief);
    document.getElementById('btnGiveUp').addEventListener('click', () => {
      stuckOfferEl.classList.remove('visible');
      document.getElementById('finalScore').textContent = score;
      const msg = document.getElementById('gameOverMsg');
      if (msg) msg.textContent = 'Места больше нет';
      clearClassicSave();
      gameOverEl.classList.add('visible');
    });
    let forfeitLock = false;
    function openForfeitConfirm() {
      if (!vsActive || forfeitLock) return;
      try {
        if (settings && settings.confirmForfeit === '0') {
          confirmForfeit();
          return;
        }
      } catch (_) {}
      const el = document.getElementById('forfeitConfirm');
      if (el) el.classList.add('visible');
    }
    function closeForfeitConfirm() {
      const el = document.getElementById('forfeitConfirm');
      if (el) el.classList.remove('visible');
    }
    function confirmForfeit() {
      if (!vsActive || forfeitLock) return;
      closeForfeitConfirm();
      forfeitLock = true;
      const flag = document.getElementById('flagBreak');
      const btn = document.getElementById('btnForfeit');
      if (btn) {
        btn.style.visibility = 'hidden';
        btn.disabled = true;
      }
      if (flag) {
        flag.classList.remove('play');
        void flag.offsetWidth;
        flag.classList.add('play');
      }
      setTimeout(() => {
        // Keep real scores — forfeit only forces loss, does not rewrite points
        endVersus({ forceLoss: true, reason: 'forfeit' });
        forfeitLock = false;
        if (btn) {
          btn.style.visibility = '';
          btn.disabled = false;
        }
        if (flag) flag.classList.remove('play');
      }, 900);
    }
    document.getElementById('btnForfeit').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openForfeitConfirm();
    });
    document.getElementById('btnForfeitYes').addEventListener('click', (e) => {
      e.preventDefault();
      confirmForfeit();
    });
    document.getElementById('btnForfeitNo').addEventListener('click', (e) => {
      e.preventDefault();
      closeForfeitConfirm();
    });
    document.getElementById('btnVsRematch').addEventListener('click', () => {
      requestRematch();
    });
    document.getElementById('btnVsAgain').addEventListener('click', () => {
      // «Ещё матч» / «Другой бот»: new opponent — not same-bot rematch
      try { dismissPostMatchResult(); } catch (_) {
        try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
        try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
      }
      hideRematchOffer();
      hideRematchWait();
      rematchIWant = false;
      rematchTheyWant = false;
      pendingRematchOfferName = null;
      pendingJoinAfterForfeit = null;
      if (mpMode && mpFromMatchmaking) {
        // startOnlineMatchmaking() performs the single authoritative teardown.
        vsModeType = 'online';
        startOnlineMatchmaking();
        return;
      }
      if (mpMode && vsModeType === 'online') {
        try { destroyMp(); } catch (_) {}
        showScreen('menu');
        return;
      }
      // Bot path: pick another bot
      try { destroyMp(); } catch (_) {}
      mpMode = false;
      vsModeType = 'bots';
      renderBotList();
      showScreen('difficulty');
    });
    document.getElementById('btnVsMenu').addEventListener('click', () => {
      try { dismissPostMatchResult(); } catch (_) {
        try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
        try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
      }
      hideRematchOffer();
      hideRematchWait();
      rematchIWant = false;
      // Keep rematchTheyWant / pending offer — opponent may still send invite while we are in menu
      // Do not clear pendingRematchOfferName if invite already queued
      const lobbyJoin = pendingJoinAfterForfeit;
      pendingJoinAfterForfeit = null;
      // Keep P2P link after online match so opponent can still offer/accept rematch from menu.
      // Destroy only when not in a post-match online session (or transferring to friend lobby).
      if (!vsActive && !lobbyJoin && !postMatchOnlineEligible) {
        try { destroyMp(); } catch (_) {}
      }
      showScreen('menu');
      updateMenuStats();
      // If rematch invite arrived during score duel / result, surface toast on menu
      try { tryShowPendingRematchOffer(); } catch (_) {}
      if (lobbyJoin && lobbyJoin.room) {
        setTimeout(() => {
          try { doAcceptChallengeJoin(lobbyJoin); } catch (_) {}
        }, 280);
      }
    });
    document.getElementById('btnVsReview').addEventListener('click', () => {
      const match = getMatchForPostResultReplay();
      if (!match) {
        try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
        return;
      }
      startReplay(match, { from: 'result' });
    });

    function getMatchForPostResultReplay() {
      // Prefer newest history entry with moves (written in endVersus)
      try {
        if (matchHistory && matchHistory.length) {
          const h = matchHistory[0];
          if (h && h.moves && h.moves.length) {
            // Sanity: same scores as last result when available
            if (!lastMatchResult) return h;
            const sameMy = typeof lastMatchResult.my === 'number' ? lastMatchResult.my === h.my : true;
            const sameOpp = typeof lastMatchResult.opp === 'number' ? lastMatchResult.opp === h.oppScore : true;
            if (sameMy && sameOpp) return h;
            // Still return newest if dates are close
            if (lastMatchResult.date && h.date && Math.abs(h.date - lastMatchResult.date) < 60000) return h;
            return h;
          }
        }
      } catch (_) {}
      try {
        if (lastMatchResult && lastMatchResult.moves && lastMatchResult.moves.length) return lastMatchResult;
      } catch (_) {}
      return null;
    }
    // Single delegated handler for review-bar actions (survives innerHTML rebuilds; no duplicate IDs)
    (function bindReviewBarActions() {
      const bar = document.getElementById('reviewBar');
      if (!bar || bar._reviewBound) return;
      bar._reviewBound = true;
      bar.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest('[data-review-action]');
        if (!btn || !bar.contains(btn)) return;
        const act = btn.getAttribute('data-review-action');
        if (act === 'result') {
          bar.classList.remove('visible');
          try { document.getElementById('versusResult').classList.add('visible'); } catch (_) {}
          return;
        }
        if (act === 'again') {
          if ((postMatchOnlineEligible || (mpMode && vsModeType === 'online')) && typeof mpIsLinked === 'function' && mpIsLinked()) {
            try { requestRematch(); } catch (_) {}
            return;
          }
          if (postMatchOnlineEligible || (mpMode && vsModeType === 'online')) {
            try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
            return;
          }
          bar.classList.remove('visible');
          try {
            const br = document.getElementById('btnVsRematch');
            if (br && br.style.display !== 'none') { br.click(); return; }
          } catch (_) {}
          if (vsModeType === 'bots' || currentBot) {
            try { beginVersusMatch(); } catch (_) {}
          } else if (vsModeType === 'online') {
            try { startMatchFlow(); } catch (_) {}
          } else {
            try {
              const again = document.getElementById('btnVsAgain');
              if (again) again.click();
              else beginVersusMatch();
            } catch (_) {
              try { beginVersusMatch(); } catch (_2) {}
            }
          }
          return;
        }
        if (act === 'menu') {
          bar.classList.remove('visible');
          try {
            const menuBtn = document.getElementById('btnVsMenu');
            if (menuBtn) menuBtn.click();
            else { showScreen('menu'); updateMenuStats(); }
          } catch (_) {
            try { showScreen('menu'); updateMenuStats(); } catch (_2) {}
          }
        }
      });
    })();
    function acceptRematchInvite() {
      rematchIWant = true;
      pendingRematchOfferName = null;
      if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }
      hideRematchOffer();
      hideRmToast(false);
      if (!mpIsLinked()) {
        try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
        rematchIWant = false;
        return;
      }
      try { mpSend({ type: 'rematch_accept', name: myNickname }); } catch (_) {}
      // Both agreed — start (same duration via startRematchMatch)
      startRematchMatch();
    }
    function declineRematchInvite() {
      pendingRematchOfferName = null;
      if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }
      try { if (mpIsLinked()) mpSend({ type: 'rematch_decline', name: myNickname }); } catch (_) {}
      leaveAfterRematchDecline();
    }
    document.getElementById('btnRematchAccept').addEventListener('click', () => {
      acceptRematchInvite();
    });
    document.getElementById('btnRematchDecline').addEventListener('click', () => {
      declineRematchInvite();
    });
    document.getElementById('btnRematchCancel').addEventListener('click', () => {
      pendingRematchOfferName = null;
      if (rematchOfferRetryTimer) { clearTimeout(rematchOfferRetryTimer); rematchOfferRetryTimer = null; }
      try { if (mpIsLinked()) mpSend({ type: 'rematch_decline', name: myNickname }); } catch (_) {}
      leaveAfterRematchDecline();
    });
    document.getElementById('rmBtnAccept')?.addEventListener('click', () => {
      acceptRematchInvite();
    });
    document.getElementById('rmBtnDecline')?.addEventListener('click', () => {
      declineRematchInvite();
    });
    document.getElementById('btnHistory').addEventListener('click', () => {
      renderHistory();
      showScreen('history');
    });
    document.getElementById('btnHistoryBack').addEventListener('click', () => {
      showScreen('menu');
      updateMenuStats();
    });
    document.getElementById('btnHistoryClear').addEventListener('click', () => {
      if (confirm('Очистить всю историю матчей?')) {
        matchHistory = [];
        localStorage.setItem('bp_history', '[]');
        renderHistory();
      }
    });
    document.getElementById('btnFriends').addEventListener('click', () => {
      if (!requireOnline('Друзья')) return;
      try { ensureFriendPresence(); } catch (_) {}
      renderFriends();
      renderFriendRequests();
      renderOutgoingPending();
      showScreen('friends');
      setFriendAddStatus('');
      try { scheduleFriendsPresence(); } catch (_) {}
    });
    (function bindLobbyInviteModal() {
      const closeBtn = document.getElementById('btnLobbyInviteClose');
      const modal = document.getElementById('lobbyInviteModal');
      if (closeBtn) closeBtn.addEventListener('click', closeLobbyInviteModal);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeLobbyInviteModal();
        });
      }
      const search = document.getElementById('lobbyInviteSearch');
      if (search && !search._bpBound) {
        search._bpBound = true;
        let t = null;
        search.addEventListener('input', () => {
          if (t) clearTimeout(t);
          t = setTimeout(() => renderLobbyInviteList(), 100);
        });
        search.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            search.value = '';
            renderLobbyInviteList();
          }
        });
      }
    })();
    (function bindFriendSearch() {
      const el = document.getElementById('friendSearchInput');
      if (!el || el._bpBound) return;
      el._bpBound = true;
      let t = null;
      el.addEventListener('input', () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => renderFriends(), 120);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          el.value = '';
          renderFriends();
        }
      });
    })();
    document.getElementById('btnFriendsBack').addEventListener('click', () => {
      try { closeRoomLobby(); } catch (_) {}
      if (mpRoomCode || (mpMode && !mmActive && mpGameSource !== 'ranked')) {
        try { destroyMp(); } catch (_) {}
        try { setMpStatus(''); } catch (_) {}
      }
      showScreen('menu');
      updateMenuStats();
    });
    document.getElementById('btnAddFriend').addEventListener('click', () => {
      addFriendByCode(document.getElementById('friendCodeInput').value);
    });
    document.getElementById('friendCodeInput').addEventListener('input', (e) => {
      const el = e.target;
      const cur = el.value;
      const clean = normalizeFriendCode(cur);
      if (cur !== clean) {
        const pos = el.selectionStart;
        el.value = clean;
        try { el.setSelectionRange(Math.min(pos, clean.length), Math.min(pos, clean.length)); } catch (_) {}
      }
      if (document.getElementById('friendAddStatus')) {
        const st = document.getElementById('friendAddStatus');
        if (st && !frSearchBusy && st.classList.contains('err')) setFriendAddStatus('');
      }
    });
    document.getElementById('friendCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFriendByCode(document.getElementById('friendCodeInput').value);
      }
    });
    document.getElementById('btnCopyCode').addEventListener('click', () => {
      copyText(myFriendCode);
      setFriendAddStatus('Код скопирован', 'ok');
      try { SFX.ui(); } catch (_) {}
    });
    document.getElementById('btnShareCode').addEventListener('click', () => {
      const msg = `Добавь меня в Block Puzzle!\nМой код: ${myFriendCode}`;
      if (navigator.share) {
        navigator.share({ title: 'Block Puzzle', text: msg }).then(() => {
          setFriendAddStatus('Отправлено', 'ok');
        }).catch(() => {
          // User cancelled share sheet — silent, no popup
        });
      } else {
        copyText(msg);
        setFriendAddStatus('Код скопирован', 'ok');
        try { SFX.ui(); } catch (_) {}
      }
    });
    document.getElementById('btnJoinRoom').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!requireOnline('Комната')) return;
      joinRoomFlow();
    });
    document.getElementById('btnJoinRoomGo').addEventListener('click', (e) => {
      e.preventDefault();
      submitJoinRoom();
    });
    document.getElementById('btnJoinRoomCancel').addEventListener('click', () => {
      document.getElementById('joinRoomModal').classList.remove('visible');
    });
    document.getElementById('joinRoomInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitJoinRoom();
    });
    document.getElementById('btnCreateRoom').addEventListener('click', () => { if (!requireOnline('Комната')) return; createMpRoom(); });
    document.getElementById('btnLobbyReady').addEventListener('click', toggleLobbyReady);
    document.getElementById('btnLobbyInvite').addEventListener('click', inviteFromLobby);
    document.getElementById('btnLobbyLeave').addEventListener('click', () => {
      const room = mpRoomCode;
      try { if (room) notifyChallengeCancelled(room, 'closed'); } catch (_) {}
      destroyMp();
      setMpStatus('');
    });
    document.querySelectorAll('.lobby-dur').forEach(btn => {
      btn.addEventListener('click', () => {
        mpLobbyDuration = parseInt(btn.dataset.sec, 10) || 120;
        mpSend({ type: 'duration', duration: mpLobbyDuration });
        // Changing duration resets ready so both re-confirm
        if (mpReady) {
          mpReady = false;
          mpSend({ type: 'ready', ready: false });
        }
        updateLobbyUI();
      });
    });

    // —— Boot loader: hide when ready ——
    (function initBootLoader() {
      const hide = () => {
        const el = document.getElementById('bootLoader');
        if (!el || el.classList.contains('hide')) return;
        el.classList.add('hide');
        setTimeout(() => { try { el.remove(); } catch (_) {} }, 600);
      };
      const ready = () => {
        // Min ~1.1s so animation reads well; max 5s safety
        const t0 = performance.now();
        const finish = () => {
          const left = Math.max(0, 1100 - (performance.now() - t0));
          setTimeout(hide, left);
        };
        if (document.readyState === 'complete') finish();
        else window.addEventListener('load', finish, { once: true });
        setTimeout(hide, 5000);
      };
      ready();
    })();

    // —— Match intro (classic / versus) ——
    let matchIntroTimer = null;
    function showMatchIntro(opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        try {
          if (settings && settings.matchIntro === '0') { resolve(); return; }
        } catch (_) {}
        const el = document.getElementById('matchIntro');
        if (!el) { resolve(); return; }
        // Already showing — do not restart the animation
        if (el.classList.contains('visible') && matchIntroTimer) {
          const wait = setInterval(() => {
            if (!el.classList.contains('visible')) {
              clearInterval(wait);
              resolve();
            }
          }, 80);
          setTimeout(() => { clearInterval(wait); resolve(); }, 3500);
          return;
        }
        try {
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            resolve(); return;
          }
        } catch (_) {}
        const label = document.getElementById('miLabel');
        const title = document.getElementById('miTitle');
        const sub = document.getElementById('miSub');
        if (label) label.textContent = opts.label || 'Подготовка';
        if (title) title.textContent = opts.title || 'Старт';
        if (sub) sub.textContent = opts.sub || '';
        el.classList.remove('mi-go');
        el.classList.add('visible');
        el.setAttribute('aria-hidden', 'false');
        if (matchIntroTimer) clearTimeout(matchIntroTimer);
        const total = Math.min(2400, Math.max(1100, opts.ms || 1600));
        matchIntroTimer = setTimeout(() => {
          el.classList.add('mi-go');
          if (title) title.textContent = opts.goText || 'Вперёд!';
          if (sub) sub.textContent = '';
          matchIntroTimer = setTimeout(() => {
            el.classList.remove('visible', 'mi-go');
            el.setAttribute('aria-hidden', 'true');
            matchIntroTimer = null;
            resolve();
          }, 920);
        }, Math.max(400, total - 920));
      });
    }

    window.addEventListener('resize', () => { invalidateBoardMetrics(); updateBoardMetrics(); _finePointerCached = null; });
    updateMenuStats();
    try { refreshProfileUI(); } catch (_) {}
    bestEl.textContent = best;
