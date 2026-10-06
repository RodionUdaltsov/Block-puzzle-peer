/**
 * Block Puzzle — js/08-gameplay/02-placement-helpers.js
 * Piece generation and placement search helpers.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function normalize(shape) {
  const minR = Math.min(...shape.map(p => p[0]));
  const minC = Math.min(...shape.map(p => p[1]));
  return shape.map(([r,c]) => [r-minR, c-minC]);
}
function randomPiece(palette) {
  if (_R) {
    const p = _R.randomPiece(palette && palette.length ? palette : COLORS);
    return p;
  }
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
  if (_R) return _R.canPlaceOn(g, shape, baseR, baseC);
  for (const [dr, dc] of shape) {
    const r = baseR + dr, c = baseC + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || g[r][c]) return false;
  }
  return true;
}
function findAllPlacements(g, shape) {
  if (_R) return _R.findAllPlacements(g, shape);
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
