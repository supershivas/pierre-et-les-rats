/* La scène : le sol, puis colonnes d'immeubles et personnages triés de
   l'arrière vers l'avant (somme des cases x + y). Partagée par le jeu et
   l'atelier. Coordonnées « écran monde » : x = wx − wy, y = (wx + wy) / 2. */
import { CELL } from './scale.js?v=1.0.1';
import { renderColumn } from './buildings.js?v=1.0.1';
import { makeGround } from './ground.js?v=1.0.1';

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
    const cells = [];
    for (let dy = -3; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) cells.push([i + dx, j + dy]);
    ground.paint(cells);
  }
  // Coin avant, au sol, d'une colonne, en écran monde
  const front = (i, j) => [(i - j) * CELL, (i + j + 2) * CELL / 2];

  /* Dessine la vue dont le coin haut-gauche est (camX, camY), de vw × vh px.
     sprites : [{ wx, wy, draw(ctx, sx, sy) }] ; fade(i, j) → opacité d'une colonne. */
  function draw(ctx, camX, camY, vw, vh, sprites = [], { fade } = {}) {
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
    items.sort((p, q) => p.k - q.k);
    for (const it of items) {
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

  // Écran monde → sol (z = 0)
  const toWorld = (sx, sy) => [sy + sx / 2, sy - sx / 2];
  // L'étendue du quartier, en écran monde
  const bounds = { left: -city.h * CELL, right: city.w * CELL, top: -7 * 60, bottom: (city.w + city.h) * CELL / 2 };

  return { city, ground, column, invalidate, draw, chimneys, front, toWorld, bounds };
}
