/* Le sol : la neige des rues, peinte une fois pour tout le quartier dans une
   grande image (une case = un losange de 120 × 60 px). Les traces de pas s'y
   impriment pixel par pixel ; la neige qui tombe les recouvre peu à peu
   (on repeint la couleur d'origine, que `colorAt` sait retrouver). */
import { RGB, PAL } from './palette.js?v=1.4.1';
import { CELL, FLOOR } from './scale.js?v=1.4.1';
import { hash } from './city.js?v=1.4.1';

export function makeGround(city) {
  const W = (city.w + city.h) * CELL, H = (city.w + city.h) * CELL / 2 + 2;
  const ox = city.h * CELL; // x de l'image = x écran + ox
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // La couleur du sol en un point (coordonnées monde, z = 0)
  const watery = (x, y) => { const k = city.kind(x, y); return k === '~' || k === '='; };
  function colorAt(wx, wy) {
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
    const hgt = city.at(cx, cy);
    if (hgt < 0) return null;
    const kd = city.kind(cx, cy);
    const a = wx - cx * CELL, b = wy - cy * CELL;
    const n = hash(Math.floor(wx), Math.floor(wy), 3);
    if (kd === '~' || kd === '=') {
      // le mur du quai, au fond (côtés −y et −x, tournés vers nous)
      if (!watery(cx, cy - 1) && b < 7) return b < 1 ? 'neige' : b > 5 ? 'nuit2' : 'pierreL';
      if (!watery(cx - 1, cy) && a < 7) return a < 1 ? 'neige' : a > 5 ? 'nuit2' : 'pierre';
      if (kd === '=') {
        // le pont : un tablier sous la neige, un parapet de chaque côté
        const alongX = watery(cx - 1, cy) && city.kind(cx - 1, cy) === '=' || city.kind(cx + 1, cy) === '=';
        const side = alongX ? b : a;
        if (side < 4 || side > CELL - 4) return side < 1 || side > CELL - 1 ? 'pierreS' : 'pierreL';
        return n < 0.05 ? 'neigeO' : 'neigeM';
      }
      // l'eau noire, des glaçons qui dérivent
      const fx = Math.floor(wx / 9), fy = Math.floor(wy / 6);
      if (hash(fx, fy, 7) < 0.33) {
        // un glaçon : blanc dessus, un bord sombre du côté de l'eau
        const edge = (wx % 9) < 1 || (wy % 6) < 1;
        return edge ? 'neigeO' : n < 0.15 ? 'neigeM' : 'neige';
      }
      return n < 0.06 ? 'ardoise' : 'nuit2';
    }
    if (hgt > 0) return 'neigeO'; // sous une maison (ne se voit qu'à travers une maison estompée)
    // Bouche d'égout, au milieu de sa case
    if (city.grates.some(([gx, gy]) => gx === cx && gy === cy) && a > 24 && a < 36 && b > 26 && b < 34) {
      if (a < 25 || a > 35 || b < 27 || b > 33) return 'pierreS';
      return Math.floor(a) % 3 === 0 ? 'pierreS' : 'nuit';
    }
    // Le trottoir le long des maisons, sa bordure, puis la chaussée
    const bld = (x, y) => city.at(x, y) > 0;
    const d = Math.min(bld(cx, cy - 1) ? b : 99, bld(cx, cy + 1) ? CELL - b : 99, bld(cx - 1, cy) ? a : 99, bld(cx + 1, cy) ? CELL - a : 99);
    const walk = d < 9 ? (d >= 8 ? 'curb' : 'side') : 'road';
    if (walk === 'curb') return 'pierreS';
    // L'ombre portée des maisons (la lumière vient du côté +y)
    for (let k = 1; k <= 2; k++) {
      const h2 = city.at(cx, cy + k);
      if (h2 > 0) {
        const dist = (cy + k) * CELL - wy;
        if (dist < h2 * FLOOR * 0.32) return walk === 'side' ? 'neigeO' : 'nuit2';
        break;
      }
      if (h2 !== 0) break;
    }
    if (walk === 'side') return 'neigeM';
    // la chaussée : la neige tassée, deux ornières, quelques pavés
    return n < 0.03 ? 'neigeM' : 'neigeO';
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
    const ci = Math.floor(wx / CELL), cj = Math.floor(wy / CELL);
    if (!city.walk(ci, cj) || city.kind(ci, cj) === 'P') return null;
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
