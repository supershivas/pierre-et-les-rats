/* Le sol : la neige des rues, peinte une fois pour tout le quartier dans une
   grande image (une case = un losange de 120 × 60 px). Les traces de pas s'y
   impriment pixel par pixel ; la neige qui tombe les recouvre peu à peu
   (on repeint la couleur d'origine, que `colorAt` sait retrouver). */
import { RGB, PAL } from './palette.js?v=2.2.0';
import { CELL, FLOOR } from './scale.js?v=2.2.0';
import { hash3 } from './city.js?v=2.2.0';

/* La couleur du sol en un point (coordonnées monde, z = 0), par la clé de
   PAL. Le moteur 3D l'appelle pour chaque pixel de sa grande texture : tout
   ce qui dépend de la case (voisins, ombres, mobilier) est calculé une fois
   par case. quayWalls: false : les murs de quai y sont de vraies faces, pas
   peints ; pits : un carré de terre sombre au pied des arbres. */
export function makeGroundColor(city, { quayWalls = true, pits: withPits = false } = {}) {
  const W = city.w;
  const watery = (x, y) => { const k = city.kind(x, y); return k === '~' || k === '='; };
  const isBridge = (x, y) => city.kind(x, y) === '=';
  const grates = new Set(city.grates.map(([gx, gy]) => gy * W + gx));
  const pits = new Map();
  for (const [type, px, py] of withPits ? city.props : []) {
    if (type !== 'tree') continue;
    const key = Math.floor(py / CELL) * W + Math.floor(px / CELL);
    if (!pits.has(key)) pits.set(key, []);
    pits.get(key).push([px, py]);
  }
  // une case d'avenue : trottoir (contre un mur, l'eau) ou chaussée
  const sidewalkCell = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !city.walk(x + dx, y + dy));
  const roadCell = (x, y) => city.kind(x, y) === 'B' && city.at(x, y) === 0 && !sidewalkCell(x, y);
  const cache = new Array(W * city.h);
  function cellInfo(cx, cy) {
    const k = cy * W + cx;
    let c = cache[k];
    if (c) return c;
    const bld = (x, y) => city.at(x, y) > 0;
    // l'ombre portée des maisons (la lumière vient du côté +y)
    let shadow = 0;
    for (let q = 1; q <= 2; q++) {
      const h2 = city.at(cx, cy + q);
      if (h2 > 0) { shadow = { y: (cy + q) * CELL, reach: h2 * FLOOR * 0.32 }; break; }
      if (h2 !== 0) break;
    }
    c = cache[k] = {
      hgt: city.at(cx, cy), kd: city.kind(cx, cy), shadow,
      bN: bld(cx, cy - 1), bS: bld(cx, cy + 1), bW: bld(cx - 1, cy), bE: bld(cx + 1, cy),
      wN: watery(cx, cy - 1), wW: watery(cx - 1, cy),
      brN: isBridge(cx, cy - 1), brS: isBridge(cx, cy + 1), brW: isBridge(cx - 1, cy), brE: isBridge(cx + 1, cy),
      grate: grates.has(k), pit: pits.get(k) || null,
      road: roadCell(cx, cy), rN: roadCell(cx, cy - 1), rS: roadCell(cx, cy + 1), rW: roadCell(cx - 1, cy), rE: roadCell(cx + 1, cy),
    };
    return c;
  }
  return function colorAt(wx, wy) {
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
    if (city.at(cx, cy) < 0) return null;
    const c = cellInfo(cx, cy), kd = c.kd;
    const a = wx - cx * CELL, b = wy - cy * CELL;
    const n = hash3(Math.floor(wx), Math.floor(wy), 3);
    if (kd === '~' || kd === '=') {
      // le mur du quai, au fond (côtés −y et −x, tournés vers nous)
      if (quayWalls && !c.wN && b < 7) return b < 1 ? 'neige' : b > 5 ? 'nuit2' : 'pierreL';
      if (quayWalls && !c.wW && a < 7) return a < 1 ? 'neige' : a > 5 ? 'nuit2' : 'pierre';
      if (kd === '=') {
        // le pont : un tablier sous la neige ; un parapet sur les bords (pas entre deux cases de pont)
        const edge = Math.min(c.brN ? 99 : b, c.brS ? 99 : CELL - b, c.brW ? 99 : a, c.brE ? 99 : CELL - a);
        if (edge < 4) return edge < 1 ? 'pierreS' : 'pierreL';
        return n < 0.05 ? 'neigeO' : 'neigeM';
      }
      // l'eau noire, des glaçons qui dérivent
      const fx = Math.floor(wx / 9), fy = Math.floor(wy / 6);
      if (hash3(fx, fy, 7) < (quayWalls ? 0.33 : 0.2)) {
        // un glaçon : blanc dessus, un bord sombre du côté de l'eau (plus rares et plus sombres en 3D, où l'on voit loin)
        const edge = (wx % 9) < 1 || (wy % 6) < 1;
        return edge ? 'neigeO' : n < 0.15 ? 'neigeM' : quayWalls || n < 0.4 ? 'neige' : 'neigeM';
      }
      return n < 0.06 ? 'ardoise' : 'nuit2';
    }
    if (c.hgt > 0) return 'neigeO'; // sous une maison (ne se voit qu'à travers une maison estompée)
    // Bouche d'égout, au milieu de sa case
    if (c.grate && a > 24 && a < 36 && b > 26 && b < 34) {
      if (a < 25 || a > 35 || b < 27 || b > 33) return 'pierreS';
      return Math.floor(a) % 3 === 0 ? 'pierreS' : 'nuit';
    }
    // le pied d'un arbre
    if (c.pit && c.pit.some(([px, py]) => Math.abs(wx - px) < 7 && Math.abs(wy - py) < 7)) return Math.abs(wx - c.pit[0][0]) < 2 && Math.abs(wy - c.pit[0][1]) < 2 ? 'nuit' : 'nuit2';

    if (kd === 'B') {
      if (c.road) {
        // la chaussée d'une avenue : neige tassée, une ligne médiane en tirets
        if (((c.rS && b > CELL - 1) || (c.rN && b < 1)) && Math.floor(a / 6) % 2 === 0 && (c.rW || c.rE)) return 'neigeM';
        if (((c.rE && a > CELL - 1) || (c.rW && a < 1)) && Math.floor(b / 6) % 2 === 0 && (c.rN || c.rS)) return 'neigeM';
        return n < 0.04 ? 'neigeM' : 'neigeO';
      }
      // le trottoir : sa bordure du côté de la chaussée, une ombre sous les hautes façades, des dalles
      if ((c.rN && b < 2) || (c.rS && CELL - b < 2) || (c.rW && a < 2) || (c.rE && CELL - a < 2)) return 'pierreS';
      if (c.shadow && c.shadow.y - wy < c.shadow.reach) return 'neigeO';
      return (Math.floor(wx / 15) + Math.floor(wy / 15)) % 2 === 0 && n < 0.06 ? 'neigeO' : 'neigeM';
    }
    // Le trottoir le long des maisons, sa bordure, puis la chaussée
    const d = Math.min(c.bN ? b : 99, c.bS ? CELL - b : 99, c.bW ? a : 99, c.bE ? CELL - a : 99);
    const walk = d < 9 ? (d >= 8 ? 'curb' : 'side') : 'road';
    if (walk === 'curb') return 'pierreS';
    if (c.shadow && c.shadow.y - wy < c.shadow.reach) return walk === 'side' || ((Math.floor(wx) + Math.floor(wy)) & 1) ? 'neigeO' : 'nuit2';
    if (walk === 'side') return 'neigeM';
    // la chaussée : la neige tassée, quelques pavés
    return n < 0.03 ? 'neigeM' : 'neigeO';
  };
}

export function makeGround(city) {
  const W = (city.w + city.h) * CELL, H = (city.w + city.h) * CELL / 2 + 2;
  const ox = city.h * CELL; // x de l'image = x écran + ox
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorAt = makeGroundColor(city);

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
