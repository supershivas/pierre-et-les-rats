/* Le quartier : une grille de colonnes, chacune un nombre d'étages (0 = rue).
   C'est tout ce que l'atelier modifie, à la façon de Townscaper : on empile
   ou on retire des étages, et le rendu (buildings.js) adapte chaque morceau
   à ses voisins (portes sur rue, pignons, toits qui se raccordent).

   Format publié (data/ville.json) :
     { "w": 22, "h": 22, "seed": 1815, "start": [x, y],
       "rows": ["0023340…", …] }   // un chiffre par colonne, 0 à 6 */
import { MAX_FLOORS } from './scale.js?v=1.0.0';

// Hasard déterministe : la même cellule donne toujours la même façade
export function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) { h ^= (v | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeCity(data) {
  const w = data.w, h = data.h;
  const heights = new Uint8Array(w * h);
  data.rows.forEach((row, y) => { for (let x = 0; x < w; x++) heights[y * w + x] = Math.min(MAX_FLOORS, +row[x] || 0); });
  const city = {
    w, h, seed: data.seed || 1815, heights,
    start: data.start || [Math.floor(w / 2), Math.floor(h / 2)],
    at(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? -1 : heights[y * w + x]; },
    set(x, y, v) { if (x >= 0 && y >= 0 && x < w && y < h) heights[y * w + x] = Math.max(0, Math.min(MAX_FLOORS, v)); },
    isStreet(x, y) { return city.at(x, y) === 0; },
  };
  city.grates = findGrates(city);
  return city;
}

export function cityToData(city) {
  const rows = [];
  for (let y = 0; y < city.h; y++) {
    let r = '';
    for (let x = 0; x < city.w; x++) r += city.heights[y * city.w + x];
    rows.push(r);
  }
  return { w: city.w, h: city.h, seed: city.seed, start: city.start, rows };
}

// Les bouches d'égout, d'où sortent les rats : dans la rue, loin les unes des autres
function findGrates(city) {
  const out = [];
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
    if (!city.isStreet(x, y) || hash(x, y, city.seed, 7) > 0.16) continue;
    if (out.some(([gx, gy]) => Math.abs(gx - x) + Math.abs(gy - y) < 4)) continue;
    out.push([x, y]);
  }
  return out;
}

/* Un quartier de Paris en 1815, d'avant Haussmann : des rues étroites et un
   peu tordues, des îlots denses de maisons de 2 à 5 étages par parcelles,
   des cours, une petite place où commence Pierre. */
export function generateQuarter(seed = 1815, w = 22, h = 22) {
  const r = rng(seed);
  const g = Array.from({ length: h }, () => new Array(w).fill(1));
  const carve = (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) g[y][x] = 0; };

  // Rues le long de x, qui se décalent d'une case de temps en temps
  const lanes = (len, cross) => {
    const out = [];
    let p = 2 + Math.floor(r() * 2);
    while (p < cross - 2) { out.push(p); p += 4 + Math.floor(r() * 3); }
    return out;
  };
  for (const y0 of lanes(w, h)) {
    let y = y0; const wide = r() < 0.3;
    for (let x = 1; x < w - 1; x++) {
      carve(x, y); if (wide) carve(x, y + 1);
      if (r() < 0.08) { const ny = Math.max(1, Math.min(h - 2, y + (r() < 0.5 ? -1 : 1))); carve(x, ny); y = ny; }
    }
  }
  for (const x0 of lanes(h, w)) {
    let x = x0;
    const from = 1 + Math.floor(r() * 3), to = h - 2 - Math.floor(r() * 3);
    for (let y = from; y <= to; y++) {
      carve(x, y);
      if (r() < 0.07) { const nx = Math.max(1, Math.min(w - 2, x + (r() < 0.5 ? -1 : 1))); carve(nx, y); x = nx; }
    }
  }
  // La place
  const px = Math.floor(w / 2 - 2 + r() * 2), py = Math.floor(h / 2 - 2 + r() * 2);
  for (let y = py; y < py + 4; y++) for (let x = px; x < px + 5; x++) carve(x, y);
  // Des cours au cœur des îlots épais
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    let solid = true;
    for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1; dx++) if (!g[y + dy][x + dx]) { solid = false; break; }
    if (solid && r() < 0.18) carve(x, y);
  }
  // Les hauteurs, par parcelles de 1 à 3 cases le long de x
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!g[y][x]) { x++; continue; }
      const len = 1 + Math.floor(r() * 3);
      const floors = 2 + Math.floor(r() * r() * 4) + (r() < 0.15 ? 1 : 0);
      for (let k = 0; k < len && x < w && g[y][x]; k++, x++) g[y][x] = Math.min(MAX_FLOORS, floors);
    }
  }
  const rows = g.map(row => row.join(''));
  return { w, h, seed, start: [px + 2, py + 2], rows };
}
