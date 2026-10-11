/* La scène : le sol, puis colonnes d'immeubles et personnages triés de
   l'arrière vers l'avant (somme des cases x + y). Partagée par le jeu et
   l'atelier. Coordonnées « écran monde » : x = wx − wy, y = (wx + wy) / 2. */
import { CELL, FLOOR } from './scale.js?v=1.1.0';
import { renderColumn } from './buildings.js?v=1.1.0';
import { makeGround } from './ground.js?v=1.1.0';

export function makeScene(city) {
  const ground = makeGround(city);
  const cache = new Map();
  const keyOf = (i, j) => j * city.w + i;

  function column(i, j) {
    const k = keyOf(i, j);
    let c = cache.get(k);
    if (!c) { c = renderColumn(city, i, j); cache.set(k, c); }
    return c;
  }
  // Après une modification de hauteur : la colonne et ses voisines changent d'aspect
  function invalidate(i, j) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cache.delete(keyOf(i + dx, j + dy));
    occlusion = null;
    const cells = [];
    for (let dy = -3; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) cells.push([i + dx, j + dy]);
    ground.paint(cells);
  }
  // Coin avant, au sol, d'une colonne, en écran monde
  const front = (i, j) => [(i - j) * CELL, (i + j + 2) * CELL / 2];

  /* Dessine la vue dont le coin haut-gauche est (camX, camY), de vw × vh px.
     sprites : [{ wx, wy, draw(ctx, sx, sy) }] ; fade(i, j) → opacité d'une colonne ;
     onDiagonal(d) : dessine ce qui est sur la diagonale d (la nuée de rats),
     après les maisons de cette diagonale et avant celles de la suivante. */
  function draw(ctx, camX, camY, vw, vh, sprites = [], { fade, onDiagonal } = {}) {
    ctx.drawImage(ground.canvas, Math.round(-ground.ox - camX), Math.round(-camY));
    const items = [];
    // Les colonnes visibles : on balaye les diagonales qui touchent la vue
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      const n = city.at(i, j);
      if (n <= 0) continue;
      const [fx, fy] = front(i, j);
      const x = fx - CELL - camX;
      if (x > vw || x + CELL * 2 < 0) continue;
      if (fy - camY < 0 || fy - camY - n * 60 - 120 > vh) continue;
      items.push({ k: i + j, i, j, fx, fy });
    }
    for (const s of sprites) items.push({ k: Math.floor(s.wx / CELL) + Math.floor(s.wy / CELL) + 0.5 + (s.wx + s.wy) / 1e6, s });
    if (onDiagonal) for (let d = 0; d <= city.w + city.h; d++) items.push({ k: d + 0.4, diag: d });
    items.sort((p, q) => p.k - q.k);
    for (const it of items) {
      if (it.diag !== undefined) { onDiagonal(it.diag); continue; }
      if (it.s) {
        const sx = Math.round(it.s.wx - it.s.wy - camX), sy = Math.round((it.s.wx + it.s.wy) / 2 - camY);
        it.s.draw(ctx, sx, sy);
        continue;
      }
      const c = column(it.i, it.j);
      const a = fade ? fade(it.i, it.j) : 1;
      if (a < 1) ctx.globalAlpha = a;
      ctx.drawImage(c.canvas, Math.round(it.fx - CELL - camX), Math.round(it.fy - c.h + 1 - camY));
      if (a < 1) ctx.globalAlpha = 1;
    }
    return items;
  }

  // Les sommets de cheminée visibles, en écran monde
  function chimneys(camX, camY, vw, vh) {
    const out = [];
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      if (city.at(i, j) <= 0) continue;
      const [fx, fy] = front(i, j);
      if (fx - CELL - camX > vw || fx + CELL - camX < 0) continue;
      const c = cache.get(keyOf(i, j));
      if (!c) continue;
      for (const [lx, ly] of c.chimneys) {
        const x = fx - CELL + lx, y = fy - c.h + 1 + ly;
        if (y - camY > -20 && y - camY < vh) out.push([x, y, i * 31 + j]);
      }
    }
    return out;
  }

  /* Le tampon de profondeur des maisons, en écran monde, calculé une fois :
     pour chaque pixel, 1 + la diagonale (i + j) de la maison la plus en
     avant qui le couvre (0 : aucune). Un rat de la diagonale d est caché là
     où la valeur dépasse d + 1. La silhouette d'une colonne : le losange du
     sol monté jusqu'au haut du brisis du toit. */
  let occlusion = null;
  function depthMap() {
    if (occlusion) return occlusion;
    const DX = city.h * CELL, DY = 8 * FLOOR, DW = (city.w + city.h) * CELL + 1, DH = (city.w + city.h) * CELL / 2 + DY + 2;
    const depth = new Uint8Array(DW * DH);
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      const n = city.at(i, j);
      if (n <= 0) continue;
      const [fx, fy] = front(i, j), hc = n * FLOOR + 22, key = i + j + 1;
      for (let x = -CELL; x <= CELL; x++) {
        const ax = Math.abs(x), X = fx + x + DX;
        if (X < 0 || X >= DW) continue;
        const y0 = Math.max(0, Math.ceil(fy - CELL + ax / 2 - hc) + DY), y1 = Math.min(DH - 1, Math.floor(fy - ax / 2) + DY);
        for (let Y = y0; Y <= y1; Y++) { const o = Y * DW + X; if (depth[o] < key) depth[o] = key; }
      }
    }
    occlusion = { depth, DX, DY, DW, DH };
    return occlusion;
  }

  // Écran monde → sol (z = 0)
  const toWorld = (sx, sy) => [sy + sx / 2, sy - sx / 2];
  // L'étendue du quartier, en écran monde
  const bounds = { left: -city.h * CELL, right: city.w * CELL, top: -7 * 60, bottom: (city.w + city.h) * CELL / 2 };

  return { city, ground, column, invalidate, draw, chimneys, front, toWorld, bounds, depthMap };
}
