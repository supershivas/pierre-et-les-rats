/* La scène : le sol, puis colonnes d'immeubles et personnages triés de
   l'arrière vers l'avant (somme des cases x + y). Partagée par le jeu et
   l'atelier. Coordonnées « écran monde » : x = wx − wy, y = (wx + wy) / 2. */
import { CELL, FLOOR } from './scale.js?v=2.2.0';
import { renderColumn } from './buildings.js?v=2.2.0';
import { makeGround } from './ground.js?v=2.2.0';
import { propSprite } from './props.js?v=2.2.0';
import { PAL } from './palette.js?v=2.2.0';

export function makeScene(city, { night = false } = {}) {
  const ground = makeGround(city);
  const cache = new Map();
  const keyOf = (i, j) => j * city.w + i;

  // Le cache des colonnes peintes ; borné une fois le décor pré-calculé
  // (on ne redessine alors en détail que les colonnes autour de Pierre)
  let cacheMax = Infinity;
  function column(i, j) {
    const k = keyOf(i, j);
    let c = cache.get(k);
    if (!c) {
      c = renderColumn(city, i, j, { night }); cache.set(k, c);
      if (cache.size > cacheMax) cache.delete(cache.keys().next().value);
    }
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
  function draw(ctx, camX, camY, vw, vh, sprites = [], { fade, onDiagonal, noGround } = {}) {
    if (!noGround) ctx.drawImage(ground.canvas, Math.round(-ground.ox - camX), Math.round(-camY));
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
    // Le mobilier urbain, trié avec le reste
    for (const [type, px, py, v] of city.props) {
      const spr = propSprite(type, v);
      const sx = px - py - camX, sy = (px + py) / 2 - camY;
      if (sx + spr.c.width < 0 || sx - spr.c.width > vw || sy < -4 || sy - spr.ay > vh) continue;
      items.push({ k: Math.floor(px / CELL) + Math.floor(py / CELL) + 0.5 + (px + py) / 1e6, s: { wx: px, wy: py, draw: (g, x, y) => g.drawImage(spr.c, x - spr.ax, y - spr.ay) } });
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
      const x0 = Math.round(it.fx - CELL - camX), y0 = Math.round(it.fy - c.h + 1 - camY);
      if (a === 'cut') { drawCut(ctx, c, x0, y0); continue; }
      if (a < 1) ctx.globalAlpha = a;
      ctx.drawImage(c.canvas, x0, y0);
      if (a < 1) ctx.globalAlpha = 1;
    }
    return items;
  }

  /* La coupe (maison de poupée) : on ne garde que le rez-de-chaussée d'une
     colonne, tranchée net au-dessus ; la tranche est un losange sombre. */
  function drawCut(ctx, c, x0, y0) {
    const H = c.h, top = H - 1 - FLOOR;           // le haut du rez-de-chaussée au coin avant
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + top - CELL / 2); ctx.lineTo(x0 + CELL, y0 + top); ctx.lineTo(x0 + CELL * 2 + 1, y0 + top - CELL / 2);
    ctx.lineTo(x0 + CELL * 2 + 1, y0 + H); ctx.lineTo(x0, y0 + H);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(c.canvas, x0, y0);
    ctx.restore();
    // la tranche : le dessus du rez-de-chaussée, comme un plancher coupé
    ctx.fillStyle = PAL.nuit2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + top - CELL / 2); ctx.lineTo(x0 + CELL, y0 + top - CELL); ctx.lineTo(x0 + CELL * 2, y0 + top - CELL / 2); ctx.lineTo(x0 + CELL, y0 + top);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAL.pierreS;
    for (let u = 0; u <= CELL; u++) { ctx.fillRect(x0 + u, y0 + top - CELL / 2 + Math.floor(u / 2), 1, 1); ctx.fillRect(x0 + CELL + u, y0 + top - Math.floor(u / 2), 1, 1); }
  }

  // Les sommets de cheminée visibles, en écran monde
  function chimneys(camX, camY, vw, vh) {
    if (chimneyList) return chimneyList.filter(([x, y]) => x - camX > -10 && x - camX < vw + 10 && y - camY > -20 && y - camY < vh);
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
     pour chaque pixel, 1 + l'indice (j × w + i) de la colonne la plus en
     avant qui le couvre (0 : aucune). Un rat de la diagonale d est caché là
     où cette colonne a une diagonale i + j plus grande que d (sauf si elle
     est estompée). La silhouette d'une colonne : le losange du sol monté
     jusqu'au haut du brisis du toit. */
  let occlusion = null;
  function depthMap() {
    if (occlusion) return occlusion;
    const DX = city.h * CELL, DY = 9 * FLOOR, DW = (city.w + city.h) * CELL + 1, DH = (city.w + city.h) * CELL / 2 + DY + 2;
    const depth = new Uint16Array(DW * DH);
    const diagOf = new Int16Array(city.w * city.h + 1); // diagonale de chaque colonne (indice + 1)
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      const n = city.at(i, j);
      if (n <= 0) continue;
      const id = j * city.w + i + 1, key = i + j;
      diagOf[id] = key;
      const [fx, fy] = front(i, j), hc = n * FLOOR + 22;
      for (let x = -CELL; x <= CELL; x++) {
        const ax = Math.abs(x), X = fx + x + DX;
        if (X < 0 || X >= DW) continue;
        const y0 = Math.max(0, Math.ceil(fy - CELL + ax / 2 - hc) + DY), y1 = Math.min(DH - 1, Math.floor(fy - ax / 2) + DY);
        for (let Y = y0; Y <= y1; Y++) {
          const o = Y * DW + X, cur = depth[o];
          if (!cur || diagOf[cur] < key) depth[o] = id;
        }
      }
    }
    occlusion = { depth, diagOf, DX, DY, DW, DH };
    return occlusion;
  }

  /* Le décor pré-calculé (le jeu) : le sol, toutes les maisons et le mobilier
     dans une seule grande image, en écran monde décalé de (DX, DY) comme le
     tampon de profondeur. Une image par vue au lieu de centaines. Les traces
     s'y recopient (ground.mirror), sauf là où une maison ou un objet couvre
     le sol (le masque `covered`). */
  let decor = null, chimneyList = null;
  function buildDecor() {
    if (decor) return decor;
    const { DX, DY, DW, DH } = depthMap();
    // 1. les maisons et le mobilier seuls, pour savoir quels pixels ils couvrent
    const over = document.createElement('canvas');
    over.width = DW; over.height = DH;
    const og = over.getContext('2d', { willReadFrequently: true });
    draw(og, -DX, -DY, DW, DH, [], { noGround: true });
    const alpha = og.getImageData(0, 0, DW, DH).data;
    const covered = new Uint8Array(DW * DH);
    for (let k = 0; k < covered.length; k++) covered[k] = alpha[k * 4 + 3] > 0 ? 1 : 0;
    // 2. le sol dessous, les maisons dessus
    const canvas = document.createElement('canvas');
    canvas.width = DW; canvas.height = DH;
    const g = canvas.getContext('2d');
    g.drawImage(ground.canvas, DX - ground.ox, DY);
    g.drawImage(over, 0, 0);
    // les cheminées, une fois pour toutes (pour la fumée)
    chimneyList = [];
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      if (city.at(i, j) <= 0) continue;
      const c = column(i, j), [fx, fy] = front(i, j);
      for (const [lx, ly] of c.chimneys) chimneyList.push([fx - CELL + lx, fy - c.h + 1 + ly, i * 31 + j]);
    }
    cache.clear(); cacheMax = 60;
    ground.mirror = (gx, gy, color) => {
      const X = gx - ground.ox + DX, Y = gy + DY;
      if (X < 0 || Y < 0 || X >= DW || Y >= DH || covered[Y * DW + X]) return;
      g.fillStyle = color; g.fillRect(X, Y, 1, 1);
    };
    decor = { canvas, DX, DY, DW, DH };
    return decor;
  }
  // Pose le décor sur la vue (coin haut-gauche camX, camY)
  function drawDecor(ctx, camX, camY, vw, vh) {
    const { canvas, DX, DY, DW, DH } = buildDecor();
    let sx = Math.round(camX) + DX, sy = Math.round(camY) + DY, dx = 0, dy = 0, w = vw, h = vh;
    if (sx < 0) { dx = -sx; w += sx; sx = 0; }
    if (sy < 0) { dy = -sy; h += sy; sy = 0; }
    w = Math.min(w, DW - sx); h = Math.min(h, DH - sy);
    if (w > 0 && h > 0) ctx.drawImage(canvas, sx, sy, w, h, dx, dy, w, h);
  }

  // Écran monde → sol (z = 0)
  const toWorld = (sx, sy) => [sy + sx / 2, sy - sx / 2];
  // L'étendue du quartier, en écran monde
  const bounds = { left: -city.h * CELL, right: city.w * CELL, top: -7 * 60, bottom: (city.w + city.h) * CELL / 2 };

  return { city, ground, column, invalidate, draw, chimneys, front, toWorld, bounds, depthMap, buildDecor, drawDecor };
}
