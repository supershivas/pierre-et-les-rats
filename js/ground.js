/* Le sol : la neige des rues, peinte une fois pour tout le quartier dans une
   grande image (une case = un losange de 120 × 60 px). Les traces de pas s'y
   impriment pixel par pixel ; la neige qui tombe les recouvre peu à peu
   (on repeint la couleur d'origine, que `colorAt` sait retrouver). */
import { RGB, PAL } from './palette.js?v=1.3.0';
import { CELL, FLOOR } from './scale.js?v=1.3.0';
import { hash } from './city.js?v=1.3.0';

export function makeGround(city) {
  const W = (city.w + city.h) * CELL, H = (city.w + city.h) * CELL / 2 + 2;
  const ox = city.h * CELL; // x de l'image = x écran + ox
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // La couleur de la neige en un point du sol (coordonnées monde, z = 0)
  function colorAt(wx, wy) {
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
    const hgt = city.at(cx, cy);
    if (hgt < 0) return null;
    if (hgt > 0) return 'neigeO'; // sous une maison (ne se voit qu'à travers une maison estompée)
    const a = wx - cx * CELL, b = wy - cy * CELL;
    const n = hash(Math.floor(wx), Math.floor(wy), 3);
    // Bouche d'égout, au milieu de sa case
    if (city.grates.some(([gx, gy]) => gx === cx && gy === cy) && a > 24 && a < 36 && b > 26 && b < 34) {
      if (a < 25 || a > 35 || b < 27 || b > 33) return 'pierreS';
      return Math.floor(a) % 3 === 0 ? 'pierreS' : 'nuit';
    }
    // L'ombre portée des maisons (la lumière vient du côté +y)
    for (let k = 1; k <= 2; k++) {
      const h2 = city.at(cx, cy + k);
      if (h2 > 0) {
        const dist = (cy + k) * CELL - wy;
        const len = h2 * FLOOR * 0.32;
        if (dist < len) return 'neigeO';
        break;
      }
      if (h2 !== 0) break;
    }
    // Congère au pied des murs éclairés
    const back = city.at(cx, cy - 1) > 0 && b < 5 + 3 * hash(Math.floor(wx / 6), cy, 5);
    if (back) return 'neigeM';
    // Pavés qui affleurent là où la neige est tassée, au milieu des rues
    return 'neigeM';
  }

  // Coordonnées image → monde
  const toWorld = (gx, gy) => { const sx = gx - ox + 0.5, sy = gy + 0.5; return [sy + sx / 2, sy - sx / 2]; };

  // Repeint les losanges de quelques cases (toutes si `cells` est absent)
  function paint(cells) {
    const list = cells || (() => { const all = []; for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) all.push([x, y]); return all; })();
    for (const [cx, cy] of list) {
      if (cx < 0 || cy < 0 || cx >= city.w || cy >= city.h) continue;
      // Le losange de la case, dans l'image
      const left = (cx - cy - 1) * CELL + ox, top = (cx + cy) * CELL / 2;
      const img = ctx.getImageData(left, top, CELL * 2, CELL + 1);
      const d = img.data;
      for (let y = 0; y <= CELL; y++) for (let x = 0; x < CELL * 2; x++) {
        const [wx, wy] = toWorld(left + x, top + y);
        if (Math.floor(wx / CELL) !== cx || Math.floor(wy / CELL) !== cy) continue;
        const key = colorAt(wx, wy);
        const o = (y * CELL * 2 + x) * 4;
        if (!key) { d[o + 3] = 0; continue; }
        const c = RGB[key];
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      ctx.putImageData(img, left, top);
    }
  }

  // Une trace : un pixel plus sombre que la neige où il tombe
  function stamp(wx, wy, key) {
    const sx = Math.round(wx - wy) + ox, sy = Math.round((wx + wy) / 2);
    if (city.at(Math.floor(wx / CELL), Math.floor(wy / CELL)) !== 0) return null;
    ctx.fillStyle = PAL[key];
    ctx.fillRect(sx, sy, 1, 1);
    if (api.mirror) api.mirror(sx, sy, PAL[key]);
    return [sx, sy];
  }
  function restore(gx, gy) {
    const [wx, wy] = toWorld(gx, gy);
    const key = colorAt(wx, wy);
    if (!key) return;
    ctx.fillStyle = PAL[key];
    ctx.fillRect(gx, gy, 1, 1);
    if (api.mirror) api.mirror(gx, gy, PAL[key]);
  }

  paint();
  // mirror(gx, gy, couleur) : recopie une trace ailleurs (le décor pré-calculé, scene.js)
  const api = { canvas, ox, W, H, paint, stamp, restore, colorAt, mirror: null };
  return api;
}
