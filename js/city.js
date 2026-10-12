/* Le quartier : une grille de colonnes, chacune un nombre d'étages (0 = rue).
   C'est tout ce que l'atelier modifie, à la façon de Townscaper : on empile
   ou on retire des étages, et le rendu (buildings.js) adapte chaque morceau
   à ses voisins (portes sur rue, pignons, toits qui se raccordent).

   Format publié (data/ville.json) :
     { "w": 26, "h": 22, "seed": 1871, "start": [x, y],
       "rows": ["0023340…", …],   // un chiffre par colonne, 0 à 7
       "props": [["lamp", 315, 642, 0], …] }   // le mobilier : type, x, y (monde), variante */
import { MAX_FLOORS } from './scale.js?v=2.3.0';
import { generateProps } from './props.js?v=2.3.0';

// Hasard déterministe : la même cellule donne toujours la même façade
export function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) { h ^= (v | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// La même chose que hash(a, b, c), sans tableau : pour le sol, appelée à chaque pixel
export function hash3(a, b, c) {
  let h = 2166136261 >>> 0;
  h ^= (a | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0;
  h ^= (b | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0;
  h ^= (c | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0;
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
     B  une avenue ou un quai plantés (arbres, réverbères, bancs)
     N  Notre-Dame : l'ensemble des cases N est un seul bloc (le jeu 3D le
        remplace par la cathédrale, `city.cathedral`) ; en 2D, des étages */
export const GROUND = { street: '.', boulevard: 'B', water: '~', bridge: '=', passage: 'P', cathedral: 'N' };

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
    // une rue ou une avenue (pour les bouches d'égout, le mobilier)
    isStreet(x, y) { return inside(x, y) && heights[y * w + x] === 0 && (ground[y * w + x] === '.' || ground[y * w + x] === 'B'); },
    isWater(x, y) { return inside(x, y) && ground[y * w + x] === '~'; },
  };
  city.reach = findReach(city);
  city.cathedral = findCathedral(city);
  city.grates = findGrates(city);
  return city;
}

// Les cases où l'on peut aller depuis le départ (les cours fermées n'en sont pas :
// ni bouche d'égout ni mobilier, et aucun rat n'y reste coincé)
function findReach(city) {
  const reach = new Uint8Array(city.w * city.h);
  let [sx, sy] = city.start;
  if (!city.walk(sx, sy)) {
    let best = Infinity;
    for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
      const d = Math.abs(x - sx) + Math.abs(y - sy);
      if (city.walk(x, y) && d < best) { best = d; sx = x; sy = y; }
    }
  }
  if (!city.walk(sx, sy)) return reach;
  const q = [sy * city.w + sx]; reach[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % city.w, y = (c - x) / city.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!city.walk(x + dx, y + dy)) continue;
      const m = (y + dy) * city.w + x + dx;
      if (!reach[m]) { reach[m] = 1; q.push(m); }
    }
  }
  return reach;
}

/* Notre-Dame : les cases N forment un seul bloc. Son rectangle englobant, et
   la façade (les tours) du côté où les cases sont les plus hautes ; à défaut,
   à l'ouest (ou au nord si le bloc est vertical), comme la vraie. facing :
   'W' (façade vers −x), 'E', 'N' (vers −y), 'S'. */
function findCathedral(city) {
  let i0 = 1e9, j0 = 1e9, i1 = -1, j1 = -1;
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
    if (city.ground[y * city.w + x] !== 'N') continue;
    i0 = Math.min(i0, x); i1 = Math.max(i1, x); j0 = Math.min(j0, y); j1 = Math.max(j1, y);
  }
  if (i1 < 0) return null;
  const w = i1 - i0 + 1, d = j1 - j0 + 1, alongX = w >= d;
  const tallest = (a, b, c, e) => { let m = 0; for (let y = c; y <= e; y++) for (let x = a; x <= b; x++) m = Math.max(m, city.heights[y * city.w + x]); return m; };
  const lo = alongX ? tallest(i0, i0, j0, j1) : tallest(i0, i1, j0, j0);
  const hi = alongX ? tallest(i1, i1, j0, j1) : tallest(i0, i1, j1, j1);
  const facing = alongX ? (hi > lo ? 'E' : 'W') : (hi > lo ? 'S' : 'N');
  return { i0, j0, w, d, facing };
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
    if (!city.isStreet(x, y) || !city.reach[y * city.w + x] || hash(x, y, city.seed, 7) > 0.12) continue;
    if (out.some(([gx, gy]) => Math.abs(gx - x) + Math.abs(gy - y) < 4)) continue;
    out.push([x, y]);
  }
  return out;
}


/* Paris en 1871, au bord de la Seine (88 × 72 cases ; tracé à la main d'après
   le plan, v2.2.0). Sur la grille, la Seine est une bande droite : c'est le
   moteur 3D qui la plie (warp.js). Le fleuve, large de 7 cases, traverse tout
   le quartier d'ouest en est, à 70 px (3,5 m) sous les quais, et se partage
   en deux bras autour de l'île de la Cité (en amande, bras nord de 5 cases,
   bras sud de 3) ; Notre-Dame, d'un seul bloc (`N`), se dresse à l'est de
   l'île devant son parvis. Plus à l'est, l'île Saint-Louis. Des quais plantés,
   quatre grands ponts de pierre (Royal, Neuf, au Change et Saint-Michel,
   Marie et la Tournelle, Austerlitz) sur les grands boulevards nord-sud, trois
   passerelles de fonte (des Arts, d'Arcole, Saint-Louis…).
   Cinq boulevards est-ouest de 4 cases (dont Rivoli, au nord du fleuve, et
   Saint-Germain, au sud), des rues de 2 cases, bordés d'immeubles
   haussmanniens de 5 à 7 niveaux ; le vieux quartier (ruelles d'une case,
   maisons basses) sur l'île, au sud-ouest (le Quartier latin) et au nord-est
   (le Marais). Trois squares (les Tuileries, le Luxembourg, le Jardin des
   Plantes). Puis le mobilier urbain (props.js). */
export function generateQuarter(seed = 1871, w = 88, h = 72) {
  w = Math.max(60, w); h = Math.max(56, h);
  const r = rng(seed);
  // g : niveaux (−1 : bâti à décider) ; k : terrain
  const g = Array.from({ length: h }, () => new Array(w).fill(-1));
  const k = Array.from({ length: h }, () => new Array(w).fill('.'));
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const put = (x, y, kind, floors = 0) => { if (inb(x, y)) { k[y][x] = kind; g[y][x] = floors; } };
  const free = (x, y) => inb(x, y) && g[y][x] === -1;
  const sx = f => Math.round(f * w / 88);                 // les repères sont donnés pour 88 colonnes
  const smooth = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };

  const c = Math.round(h * 0.5);                          // l'axe de la Seine
  const hb = [2, 10, 22, 55, 66].map(y => Math.round(y * h / 72));       // les boulevards est-ouest (4 rangées) : Rivoli, 3e
  const vb = [14, 25, 35, 58, 80].map(sx);                // les boulevards nord-sud (4 colonnes) : leurs ponts
  const ponts = [19, 41, 71].map(sx);                     // des rues de 2 cases, avec une passerelle
  // l'île de la Cité (en amande) et l'île Saint-Louis : le nombre de rangées de chaque colonne, collées au bras nord
  const cx0 = sx(23), cx1 = cx0 + 27, sl0 = cx1 + 5, sl1 = sl0 + 15;
  // sous un pont, la rive est droite : toutes les colonnes d'un pont ont la forme de la première
  const spans = [...vb.map(x => [x, x + 3]), ...ponts.map(x => [x, x + 1])];
  const snap = x => { for (const [a, b] of spans) if (x >= a && x <= b) return a; return x; };
  const nCite = x => { x = snap(x); return x < cx0 || x > cx1 ? 0 : 1 + Math.round(7 * smooth(0, 0.5, (x - cx0) / 27)); };
  const nSL = x => { x = snap(x); return x < sl0 || x > sl1 ? 0 : 3 + Math.round(3 * Math.sin(Math.PI * (x - sl0 + 0.5) / 16)); };
  const islandN = x => nCite(x) || nSL(x);
  const onIsland = x => islandN(x) > 0;
  // entre les deux îles, un chenal d'un bras à l'autre
  const nChan = x => (x > cx1 && x < sl0 ? Math.max(nCite(cx1), nSL(sl0)) : 0);
  // les berges ondulent un peu (d'une case ou deux), sauf sous un pont, où elles restent droites
  const wob = (x, amp, ph) => Math.round(amp * Math.sin(Math.PI * 2 * snap(x) / 37 + ph) + amp * 0.6 * Math.sin(Math.PI * 2 * snap(x) / 17 + ph * 2));
  const waterN = x => c - 3 + Math.max(-2, Math.min(1, wob(x, 1.3, 1)));
  const waterS = x => (onIsland(x) ? c + 4 + islandN(x) : nChan(x) ? c + 4 + nChan(x) : c + 3 + Math.max(-1, Math.min(2, wob(x, 1.4, 3.3))));
  const onCite = x => x >= cx0 && x <= cx1;

  // ─ La Seine, les îles, les quais ─
  for (let x = 0; x < w; x++) for (let y = waterN(x); y <= waterS(x); y++) put(x, y, '~');
  for (let x = 0; x < w; x++) for (let y = c + 2; y < c + 2 + islandN(x); y++) { k[y][x] = '.'; g[y][x] = -1; }
  for (let x = 0; x < w; x++) {
    const xs = [Math.max(0, x - 1), x, Math.min(w - 1, x + 1)];
    const top = Math.min(...xs.map(waterN)), bottom = Math.max(...xs.map(waterS));
    for (let y = top - 3; y < waterN(x); y++) put(x, y, 'B');
    for (let y = waterS(x) + 1; y <= bottom + 3; y++) put(x, y, 'B');
  }
  // ─ Les boulevards : droits au bord du fleuve (les ponts sont des rectangles), mais de loin en loin
  //   un jarret : entre deux boulevards, une avenue se décale de quelques cases (un carrefour en baïonnette) ─
  const zone = [hb[2], hb[3] + 3];                          // de Rivoli à Saint-Germain : tout est droit
  const bandOf = y => (y >= zone[0] && y <= zone[1] ? -1 : hb.filter(y0 => y >= y0 + 4).length);
  const jog = Array.from({ length: vb.length + ponts.length }, () => Array.from({ length: hb.length + 1 }, () => Math.round((r() - 0.5) * 4.4)));
  const colBand = x => vb.filter(x0 => x >= x0 + 4).length;   // la colonne de blocs entre deux avenues
  const rowJog = hb.map((_, i) => Array.from({ length: vb.length + 1 }, () => (i === 2 ? -Math.floor(r() * 2.4) : i === 3 ? Math.floor(r() * 2.4) : Math.round((r() - 0.5) * 2.4))));
  const hw = [2, 4, 4, 4, 2];                               // les deux boulevards des bords ne sont que des rues de 2 cases
  for (let x = 0; x < w; x++) hb.forEach((y0, i) => { const o = rowJog[i][colBand(x)]; for (let y = y0 + o + (4 - hw[i]) / 2; y < y0 + o + (4 + hw[i]) / 2; y++) if (k[y][x] !== '~') put(x, y, hw[i] === 4 ? 'B' : '.'); });
  vb.forEach((x0, vi) => { for (let y = 0; y < h; y++) {
    const o = bandOf(y) < 0 ? 0 : jog[vi][bandOf(y)];
    for (let x = x0 + o; x < x0 + o + 4; x++) { if (k[y][x] === '~') put(x, y, '='); else put(x, y, 'B'); }
  } });
  // ─ Les rues de 2 cases : avec une passerelle, ou (dans les grands vides) sans ─
  const rue = (x0, bridge, ji = -1) => {
    for (let y = 0; y < h; y++) {
      const o = bridge && bandOf(y) >= 0 ? jog[vb.length + ji][bandOf(y)] : 0;
      for (let x = x0 + o; x < x0 + o + 2; x++) {
        if (k[y][x] === '~') { if (bridge) put(x, y, '='); continue; }
        if (!bridge && y > waterN(x) - 4 && y < waterS(x) + 4) continue;
        if (free(x, y)) put(x, y, '.');
      }
    }
  };
  ponts.forEach((x0, pi) => rue(x0, true, pi));
  const cols = [[0, 0], ...vb.map(x => [x, x + 3]), ...ponts.map(x => [x, x + 1]), [w - 1, w - 1]].sort((p, q) => p[0] - q[0]);
  for (let i = 0; i + 1 < cols.length; i++) {
    const a = cols[i][1] + 1, b = cols[i + 1][0] - 1;
    if (b - a + 1 > 15) rue(Math.round((a + b) / 2) - 1, false);
  }
  // une rue est-ouest au milieu des grands îlots du sud, quand rien ne la coupe
  {
    const rows = [hb[2] + 4, hb[3]];                                     // entre Rivoli.. non : entre les quais et Saint-Germain
    void rows;
    const y0 = Math.round((c + 8 + hb[3] - 2) / 2) - 1;
    for (let y = y0; y < y0 + 2; y++) for (let x = 0; x < w; x++) if (free(x, y)) put(x, y, '.');
  }
  // le pont Saint-Louis : une passerelle d'une île à l'autre, d'est en ouest
  for (let x = cx1 + 1; x < sl0; x++) for (const y of [c + 2, c + 3]) put(x, y, '=');

  // ─ Notre-Dame : un bloc de 8 × 4 cases à l'est de l'île, la façade à l'ouest, sur son parvis ─
  const nd0 = cx1 - 7, ndTop = c + 4;
  for (let x = nd0 - 4; x <= cx1; x++) for (const y of [c + 2, c + 3, c + 8, c + 9]) if (k[y][x] !== 'B' && k[y][x] !== '=') put(x, y, '.');   // le tour de l'île
  for (let x = nd0 - 4; x < nd0; x++) for (let y = c + 2; y <= c + 9; y++) if (k[y][x] !== 'B' && k[y][x] !== '=') put(x, y, '.');             // le parvis
  for (let x = nd0; x <= cx1; x++) for (let y = ndTop; y < ndTop + 4; y++) put(x, y, 'N', 5);                 // la nef et le chœur
  for (const y of [ndTop, ndTop + 3]) put(nd0, y, 'N', 8);                                                    // les tours
  for (const y of [ndTop + 1, ndTop + 2]) put(nd0, y, 'N', 6);                                                // entre elles, la rose
  // le bord des îles : une ruelle sur les rives
  for (let x = 0; x < w; x++) if (onIsland(x)) for (const y of [c + 2, c + 1 + islandN(x)]) if (free(x, y)) put(x, y, '.');

  // ─ Les îlots : ce qui reste à bâtir, par groupes de cases ─
  const findBlocks = () => {
    const out = [];
    const seen = Array.from({ length: h }, () => new Array(w).fill(false));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!free(x, y) || seen[y][x]) continue;
      const cells = [[x, y]], b = { cells, x0: x, x1: x, y0: y, y1: y };
      seen[y][x] = true;
      for (let i = 0; i < cells.length; i++) {
        const [cx, cy] = cells[i];
        b.x0 = Math.min(b.x0, cx); b.x1 = Math.max(b.x1, cx); b.y0 = Math.min(b.y0, cy); b.y1 = Math.max(b.y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (free(cx + dx, cy + dy) && !seen[cy + dy][cx + dx]) { seen[cy + dy][cx + dx] = true; cells.push([cx + dx, cy + dy]); }
      }
      out.push(b);
    }
    return out;
  };
  // les grands îlots sont coupés par une rue de 2 cases, souvent de biais : de petites marches qui, une fois la grille déformée, font une rue en diagonale
  for (let pass = 0; pass < 2; pass++) for (const b of findBlocks()) {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    if (b.cells.some(([x, y]) => onIsland(x) && y > c && y < c + 12) || b.cells.length < 36 || hash(b.x0, b.y0, seed, 21 + pass) < 0.15) continue;
    const mine = new Set(b.cells.map(([x, y]) => y * w + x));
    if (bw >= 9 && bw >= bh * 0.8) {
      const base = b.x0 + Math.round(bw * (0.35 + r() * 0.3)), tilt = (r() - 0.5) * 0.9, yc = (b.y0 + b.y1) / 2;
      for (let y = b.y0; y <= b.y1; y++) for (let dx = 0; dx < 2; dx++) { const x = base + Math.round(tilt * (y - yc)) + dx; if (mine.has(y * w + x)) put(x, y, '.', 0); }
    } else if (bh >= 9) {
      const base = b.y0 + Math.round(bh * (0.35 + r() * 0.3)), tilt = (r() - 0.5) * 0.9, xc = (b.x0 + b.x1) / 2;
      for (let x = b.x0; x <= b.x1; x++) for (let dy = 0; dy < 2; dy++) { const y = base + Math.round(tilt * (x - xc)) + dy; if (mine.has(y * w + x)) put(x, y, '.', 0); }
    }
  }
  const blocks = findBlocks();
  // les squares : les Tuileries (nord-ouest), le Luxembourg (sud-ouest), le Jardin des Plantes (sud-est)
  const gardenSet = new Set();
  const gardens = [];
  for (const [fx, fy] of [[sx(7), c - 8], [sx(8), c + 17], [sx(74), c + 17]]) {
    const pick = blocks
      .filter(b => !gardenSet.has(b) && b.cells.length >= 24 && b.cells.length <= 180 && !b.cells.some(([x, y]) => onIsland(x) && y > c && y < c + 12))
      .sort((p, q) => Math.hypot((p.x0 + p.x1) / 2 - fx, (p.y0 + p.y1) / 2 - fy) - Math.hypot((q.x0 + q.x1) / 2 - fx, (q.y0 + q.y1) / 2 - fy))[0];
    if (pick) gardenSet.add(pick);
  }

  blocks.forEach((b, bi) => {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, minDim = Math.min(bw, bh);
    const mine = new Set(b.cells.map(([x, y]) => y * w + x));
    const inBlock = (x, y) => mine.has(y * w + x);
    if (gardenSet.has(b)) { for (const [x, y] of b.cells) put(x, y, '.'); gardens.push(b); return; }
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const old = b.cells.some(([x, y]) => onIsland(x) && y > c && y < c + 12) || (cx < w * 0.42 && cy > c) || (cx > w * 0.62 && cy < c) || hash(bi, seed, 5) < 0.2;
    // la distance de chaque case au bord de l'îlot (1 : contre une rue)
    const edge = new Map(), q = [];
    for (const [x, y] of b.cells) if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inBlock(x + dx, y + dy))) { edge.set(y * w + x, 1); q.push([x, y]); }
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i], d = edge.get(y * w + x);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inBlock(x + dx, y + dy) && !edge.has((y + dy) * w + x + dx)) { edge.set((y + dy) * w + x + dx, d + 1); q.push([x + dx, y + dy]); }
    }
    const carve = (x, y) => { if (inBlock(x, y)) put(x, y, '.', 0); };

    if (!old) {
      // haussmannien : 5 à 7 niveaux sur deux cases d'épaisseur, plus bas au cœur
      const base = r() < 0.6 ? 6 : r() < 0.6 ? 5 : 7;
      for (const [x, y] of b.cells) {
        const d = edge.get(y * w + x);
        put(x, y, '.', d <= 2 ? Math.max(5, Math.min(7, base + (hash(x >> 1, y >> 1, seed, 9) < 0.18 ? -1 : hash(x >> 1, y >> 1, seed, 10) < 0.1 ? 1 : 0))) : 3 + (hash(x, y, seed, 11) < 0.4 ? 1 : 0));
      }
      if (minDim >= 5) {
        // une ruelle au milieu, dans le sens de la longueur ; des passages couverts y mènent
        const alongX = bw >= bh;
        const lane = alongX ? Math.round(cy) : Math.round(cx);
        const cell = (t, s) => (alongX ? [b.x0 + t, s] : [s, b.y0 + t]);
        const len = alongX ? bw : bh;
        for (let t = 0; t < len; t++) { const [x, y] = cell(t, lane); if (inBlock(x, y)) carve(x, y); }
        const span = alongX ? [b.y0, b.y1] : [b.x0, b.x1];
        for (let t = 2; t < len - 2; t += 5 + Math.floor(r() * 3)) {
          for (const dir of [-1, 1]) {
            if (r() < 0.35) continue;
            // de la rue jusqu'à la ruelle, 2 cases ou plus de bâti : un passage couvert
            const path = [];
            let s = lane + dir;
            for (; s >= span[0] && s <= span[1]; s += dir) { const [x, y] = cell(t, s); if (g[y][x] > 0 && k[y][x] === '.') path.push([x, y]); else break; }
            const [ex, ey] = cell(t, s);
            const open = inb(ex, ey) && g[ey][ex] === 0 && (k[ey][ex] === '.' || k[ey][ex] === 'B');
            if (open && path.length >= 2) for (const [x, y] of path) put(x, y, 'P', g[y][x]);
          }
        }
      }
    } else {
      // le vieux quartier : des maisons basses, des ruelles d'une case
      let run = 0, floors = 2;
      for (const [x, y] of b.cells) {
        if (run-- <= 0) { run = 1 + Math.floor(r() * 3); const p = r(); floors = p < 0.07 ? 1 : p < 0.55 ? 2 : p < 0.9 ? 3 : 4; }
        put(x, y, '.', floors);
      }
      if (minDim >= 3 && b.cells.length >= 9) {
        const alongX = bw >= bh;
        const s0 = alongX ? b.y0 : b.x0, s1 = alongX ? b.y1 : b.x1, t0 = alongX ? b.x0 : b.y0, t1 = alongX ? b.x1 : b.y1;
        for (let p = s0 + 1 + (minDim >= 4 ? Math.floor(r() * 2) : 0); p <= s1 - 1; p += 3 + Math.floor(r() * 2)) {
          let s = p;
          for (let t = t0; t <= t1; t++) {
            const [x, y] = alongX ? [t, s] : [s, t];
            carve(x, y);
            if (r() < 0.1) { const ns = Math.max(s0 + 1, Math.min(s1 - 1, s + (r() < 0.5 ? -1 : 1))); if (ns !== s) { s = ns; const [x2, y2] = alongX ? [t, s] : [s, t]; carve(x2, y2); } }
          }
        }
        if (minDim >= 5) {
          for (let t = t0 + 2 + Math.floor(r() * 2); t <= t1 - 2; t += 5 + Math.floor(r() * 3)) for (let s = s0; s <= s1; s++) carve(...(alongX ? [t, s] : [s, t]));
        }
      }
    }
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] < 0) g[y][x] = 0;
  // un pont débouche toujours sur une rue : jamais de maison à ses deux bouts
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (k[y][x] !== '=') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (inb(nx, ny) && k[ny][nx] !== '~' && k[ny][nx] !== '=' && k[ny][nx] !== 'N' && g[ny][nx] > 0) { g[ny][nx] = 0; if (k[ny][nx] === 'P') k[ny][nx] = '.'; }
    }
  }
  void onCite;

  const rows = g.map(row => row.join('')), ground = k.map(row => row.join(''));
  const data = { w, h, seed, start: [vb[2] + 2, hb[2] + 2], rows, ground };
  data.props = generateProps(makeCity(data), { gardens: gardens.map(b => b.cells) });
  return data;
}
