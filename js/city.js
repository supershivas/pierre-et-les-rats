/* Le quartier : une grille de colonnes, chacune un nombre d'étages (0 = rue).
   C'est tout ce que l'atelier modifie, à la façon de Townscaper : on empile
   ou on retire des étages, et le rendu (buildings.js) adapte chaque morceau
   à ses voisins (portes sur rue, pignons, toits qui se raccordent).

   Format publié (data/ville.json) :
     { "w": 26, "h": 22, "seed": 1871, "start": [x, y],
       "rows": ["0023340…", …],   // un chiffre par colonne, 0 à 7
       "props": [["lamp", 315, 642, 0], …] }   // le mobilier : type, x, y (monde), variante */
import { MAX_FLOORS } from './scale.js?v=1.4.0';
import { generateProps } from './props.js?v=1.4.0';

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

/* Le terrain de chaque case (rangées « ground », un caractère par case) :
     .  rue ou maison ordinaire          ~  la Seine (l'eau, les glaçons)
     =  un pont (on y marche)            P  un passage sous un immeuble
     N  Notre-Dame (nef, ou tour si 7 niveaux et plus) */
export const GROUND = { street: '.', water: '~', bridge: '=', passage: 'P', cathedral: 'N' };

export function makeCity(data) {
  const w = data.w, h = data.h;
  const heights = new Uint8Array(w * h);
  data.rows.forEach((row, y) => { for (let x = 0; x < w; x++) heights[y * w + x] = Math.min(MAX_FLOORS, +row[x] || 0); });
  const ground = new Array(w * h).fill('.');
  (data.ground || []).forEach((row, y) => { for (let x = 0; x < w; x++) ground[y * w + x] = row[x] || '.'; });
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const city = {
    w, h, seed: data.seed || 1871, heights, ground,
    start: data.start || [Math.floor(w / 2), Math.floor(h / 2)],
    props: (data.props || []).map(p => [...p]),
    at(x, y) { return inside(x, y) ? heights[y * w + x] : -1; },
    set(x, y, v) { if (inside(x, y)) heights[y * w + x] = Math.max(0, Math.min(MAX_FLOORS, v)); },
    kind(x, y) { return inside(x, y) ? ground[y * w + x] : '#'; },
    setKind(x, y, k) { if (inside(x, y)) ground[y * w + x] = k; },
    // une rue, un pont, un passage : là où Pierre et les rats marchent
    walk(x, y) {
      if (!inside(x, y)) return false;
      const k = ground[y * w + x];
      return k === 'P' || (heights[y * w + x] === 0 && k !== '~' && k !== 'N');
    },
    // une rue ordinaire (pour les bouches d'égout, le mobilier)
    isStreet(x, y) { return inside(x, y) && heights[y * w + x] === 0 && ground[y * w + x] === '.'; },
    isWater(x, y) { return inside(x, y) && ground[y * w + x] === '~'; },
  };
  city.grates = findGrates(city);
  return city;
}

export function cityToData(city) {
  const rows = [], ground = [];
  for (let y = 0; y < city.h; y++) {
    let r = '', g = '';
    for (let x = 0; x < city.w; x++) { r += city.heights[y * city.w + x]; g += city.ground[y * city.w + x]; }
    rows.push(r); ground.push(g);
  }
  return { w: city.w, h: city.h, seed: city.seed, start: city.start, rows, ground, props: city.props.map(p => [...p]) };
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

/* Paris en 1871, au bord de la Seine : le fleuve traverse le quartier
   d'ouest en est et se partage autour de l'île de la Cité, où se dresse
   Notre-Dame devant son parvis. Des quais le long de l'eau, des ponts, des
   rues un peu tordues ; au nord et au sud, des îlots d'immeubles
   haussmanniens (5 à 7 niveaux, la même corniche le long d'un îlot) ; sur
   l'île et dans le vieux quartier, d'anciennes maisons basses. Quelques
   passages sous les immeubles. Puis le mobilier urbain (props.js). */
export function generateQuarter(seed = 1871, w = 26, h = 22) {
  const r = rng(seed);
  const g = Array.from({ length: h }, () => new Array(w).fill(1));
  const k = Array.from({ length: h }, () => new Array(w).fill('.'));
  const inside = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
  const carve = (x, y) => { if (inside(x, y) && k[y][x] === '.') g[y][x] = 0; };
  const water = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) { g[y][x] = 0; k[y][x] = '~'; } };

  // ─ La Seine, et l'île de la Cité au milieu ─
  const isl0 = Math.floor(w * 0.3), isl1 = Math.floor(w * 0.72);
  const river = [];             // pour chaque x : [nord, sud] de l'eau, et l'île
  for (let x = 0; x < w; x++) {
    const c = Math.round(h * 0.6);
    if (x >= isl0 && x <= isl1) {
      // deux bras de deux cases, l'île de trois cases entre eux
      for (const y of [c - 3, c - 2, c + 2, c + 3]) water(x, y);
      river[x] = { n: c - 3, s: c + 3, island: [c - 1, c + 1] };
    } else {
      for (let y = c - 1; y <= c + 1; y++) water(x, y);
      river[x] = { n: c - 1, s: c + 1 };
    }
  }
  // les quais : une rue le long de chaque rive
  for (let x = 0; x < w; x++) { carve(x, river[x].n - 1); carve(x, river[x].s + 1); }

  // ─ Les rues des deux rives ─
  const lanes = (from, to, step) => { const out = []; let p = from + 2 + Math.floor(r() * 2); while (p < to - 1) { out.push(p); p += step + Math.floor(r() * 2); } return out; };
  const north = Math.min(...river.map(v => v.n)) - 2, south = Math.max(...river.map(v => v.s)) + 2;
  for (const y0 of [...lanes(0, north, 3), ...lanes(south, h, 3)]) {
    let y = y0;
    for (let x = 1; x < w - 1; x++) {
      carve(x, y);
      if (r() < 0.07) { const ny = y + (r() < 0.5 ? -1 : 1); if (k[ny]?.[x] === '.') { carve(x, ny); y = ny; } }
    }
  }
  // des rues nord-sud, qui descendent jusqu'aux quais ; un pont au bout de certaines
  const bridges = [];
  for (let x0 = 2 + Math.floor(r() * 2); x0 < w - 2; x0 += 4 + Math.floor(r() * 2)) {
    for (let y = 1; y < h - 1; y++) if (k[y][x0] === '.') carve(x0, y);
    if (r() < 0.75 || (x0 > isl0 && x0 < isl1)) bridges.push(x0);
  }
  const ndFrom = isl1 - 6, ndTo = isl1 - 2;
  for (const x of bridges) {
    if (x >= ndFrom && x <= ndTo) continue;
    const v = river[x];
    for (let y = v.n; y <= v.s; y++) {
      if (k[y][x] === '~') k[y][x] = '=';
      else if (v.island && y >= v.island[0] && y <= v.island[1]) { g[y][x] = 0; }
    }
  }

  // ─ L'île : de vieilles maisons à l'ouest, Notre-Dame à l'est, la façade
  //   (les tours) tournée vers l'est sur son parvis, pour qu'on la voie ─
  const nd0 = isl1 - 6;                       // le début de la nef
  for (let x = isl0; x <= isl1; x++) {
    const [a, b] = river[x].island;
    if (x < nd0 - 1 && r() < 0.3) carve(x, a + 1);
    if (x >= nd0 + 5) for (let y = a; y <= b; y++) carve(x, y);                     // le parvis
  }
  for (let x = nd0; x <= nd0 + 4; x++) {
    const [a] = river[x].island;
    for (let y = a; y <= a + 1; y++) { k[y][x] = 'N'; g[y][x] = x === nd0 + 4 ? 8 : 5; }  // la nef, puis les tours
    carve(x, a + 2);                                                                // la rue au sud
  }
  for (let x = nd0 - 1; x <= nd0 + 4; x++) if (k[river[x].island[0]][x] !== 'N') carve(x, river[x].island[0]);

  // ─ La place, au nord ─
  const px = Math.floor(w / 2 - 3 + r() * 2), py = Math.max(2, north - 5);
  for (let y = py; y < py + 4; y++) for (let x = px; x < px + 5; x++) carve(x, y);
  // des cours au cœur des îlots épais
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    let solid = true;
    for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] !== 1 || k[y + dy][x + dx] !== '.') { solid = false; break; }
    if (solid && r() < 0.3) carve(x, y);
  }

  // ─ Les hauteurs : haussmannien par îlots, vieilles maisons sur l'île et au sud-est ─
  const old = (x, y) => (river[x].island && y >= river[x].island[0] && y <= river[x].island[1]) || (y > south && x > w * 0.55);
  for (let y = 0; y < h; y++) {
    let x = 0, rowFloors = 0;
    while (x < w) {
      if (g[y][x] !== 1 || k[y][x] !== '.') { x++; rowFloors = 0; continue; }
      const len = 1 + Math.floor(r() * 3);
      const empty = inside(x, y) && r() < 0.12;
      if (rowFloors === 0) rowFloors = r() < 0.6 ? 6 : r() < 0.6 ? 5 : 7;
      const floors = empty ? 0 : old(x, y) || r() < 0.12 ? 2 + Math.floor(r() * 2) : rowFloors;
      for (let n = 0; n < len && x < w && g[y][x] === 1 && k[y][x] === '.'; n++, x++) g[y][x] = Math.min(MAX_FLOORS, floors);
    }
  }
  // ─ Des passages : sous un immeuble d'une case d'épaisseur, entre deux rues ─
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (g[y][x] < 4 || k[y][x] !== '.') continue;
    const ns = g[y - 1][x] === 0 && g[y + 1][x] === 0 && k[y - 1][x] === '.' && k[y + 1][x] === '.';
    const ew = g[y][x - 1] === 0 && g[y][x + 1] === 0 && k[y][x - 1] === '.' && k[y][x + 1] === '.';
    if ((ns || ew) && r() < 0.35) k[y][x] = 'P';
  }

  const rows = g.map(row => row.join('')), ground = k.map(row => row.join(''));
  // Le départ : la rue la plus dégagée vers l'avant (+x, +y), près de la place
  let start = [px + 2, py + 2], best = -1;
  for (let y = py; y < py + 4; y++) for (let x = px; x < px + 5; x++) {
    if (g[y][x] !== 0) continue;
    let score = 0;
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) if ((g[y + dy]?.[x + dx] ?? 1) === 0) score++;
    if (score > best) { best = score; start = [x, y]; }
  }
  const data = { w, h, seed, start, rows, ground };
  data.props = generateProps(makeCity(data));
  return data;
}
