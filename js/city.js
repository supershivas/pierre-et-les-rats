/* Le quartier : une grille de colonnes, chacune un nombre d'étages (0 = rue).
   C'est tout ce que l'atelier modifie, à la façon de Townscaper : on empile
   ou on retire des étages, et le rendu (buildings.js) adapte chaque morceau
   à ses voisins (portes sur rue, pignons, toits qui se raccordent).

   Format publié (data/ville.json) :
     { "w": 26, "h": 22, "seed": 1871, "start": [x, y],
       "rows": ["0023340…", …],   // un chiffre par colonne, 0 à 7
       "props": [["lamp", 315, 642, 0], …] }   // le mobilier : type, x, y (monde), variante */
import { MAX_FLOORS } from './scale.js?v=2.1.0';
import { generateProps } from './props.js?v=2.1.0';

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


/* Paris en 1871, au bord de la Seine (88 × 72 cases, v2.1.0) : le fleuve, large de
   7 cases, traverse tout le quartier d'ouest en est sans être coupé, à 70 px
   (3,5 m) sous les quais ; il se partage autour de l'île de la Cité (28 × 8
   cases), où Notre-Dame (un seul bloc, `N`) se dresse devant son parvis. Des
   quais plantés de chaque côté, six ponts.
   Quatre grands boulevards est-ouest et trois nord-sud, droits, de 4 cases
   (arbres, réverbères, bancs), bordés d'immeubles haussmanniens de 5 à 7
   niveaux ; des rues de 2 cases entre eux. Les îlots restants : haussmanniens
   autour d'une ruelle centrale (avec des passages couverts), ou « vieux
   quartier » de ruelles d'une case entre des maisons basses (1 à 4 niveaux).
   Quelques îlots deviennent squares. Puis le mobilier urbain (props.js). */
export function generateQuarter(seed = 1871, w = 88, h = 72) {
  w = Math.max(60, w); h = Math.max(56, h);
  const r = rng(seed);
  // g : niveaux (−1 : bâti à décider) ; k : terrain
  const g = Array.from({ length: h }, () => new Array(w).fill(-1));
  const k = Array.from({ length: h }, () => new Array(w).fill('.'));
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const put = (x, y, kind, floors = 0) => { if (inb(x, y)) { k[y][x] = kind; g[y][x] = floors; } };
  const free = (x, y) => inb(x, y) && g[y][x] === -1;

  const c = Math.round(h * 0.5);                          // l'axe de la Seine
  const hb = [0.09, 0.24, 0.68, 0.83].map(f => Math.round(h * f));        // les boulevards est-ouest (4 rangées)
  const vb = [0.18, 0.43, 0.76].map(f => Math.round(w * f));              // les boulevards nord-sud (4 colonnes)
  const ponts = [0.05, 0.34, 0.91].map(f => Math.round(w * f));           // des rues de 2 cases, avec un pont
  const ix0 = Math.round(w * 0.3), ix1 = ix0 + 27;        // l'île
  const onIsland = x => x >= ix0 && x <= ix1;
  const waterN = x => (onIsland(x) ? c - 7 : c - 3), waterS = x => (onIsland(x) ? c + 6 : c + 3);

  // ─ La Seine, l'île, les quais ─
  for (let x = 0; x < w; x++) for (let y = waterN(x); y <= waterS(x); y++) put(x, y, '~');
  for (let x = ix0; x <= ix1; x++) for (let y = c - 4; y <= c + 3; y++) { k[y][x] = '.'; g[y][x] = -1; }
  for (let x = 0; x < w; x++) {
    const xs = [Math.max(0, x - 1), x, Math.min(w - 1, x + 1)];
    const top = Math.min(...xs.map(waterN)), bottom = Math.max(...xs.map(waterS));
    for (let y = top - 3; y < waterN(x); y++) put(x, y, 'B');
    for (let y = waterS(x) + 1; y <= bottom + 3; y++) put(x, y, 'B');
  }
  // ─ Les boulevards, droits ─
  for (let x = 0; x < w; x++) for (const y0 of hb) for (let y = y0; y < y0 + 4; y++) if (k[y][x] !== '~') put(x, y, 'B');
  for (const x0 of vb) for (let x = x0; x < x0 + 4; x++) for (let y = 0; y < h; y++) {
    if (k[y][x] === '~') put(x, y, '='); else put(x, y, 'B');
  }
  // ─ Les rues de 2 cases : avec un pont, ou (dans les grands vides) sans ─
  const rue = (x0, bridge) => {
    for (let x = x0; x < x0 + 2; x++) for (let y = 0; y < h; y++) {
      if (k[y][x] === '~') { if (bridge) put(x, y, '='); continue; }
      if (!bridge && y > waterN(x) - 4 && y < waterS(x) + 4) continue;
      if (free(x, y)) put(x, y, '.');
    }
  };
  ponts.forEach(x0 => rue(x0, true));
  const cols = [[0, 0], ...vb.map(x => [x, x + 3]), ...ponts.map(x => [x, x + 1]), [w - 1, w - 1]].sort((p, q) => p[0] - q[0]);
  for (let i = 0; i + 1 < cols.length; i++) {
    const a = cols[i][1] + 1, b = cols[i + 1][0] - 1;
    if (b - a + 1 > 15) rue(Math.round((a + b) / 2) - 1, false);
  }

  // ─ Notre-Dame : un bloc de 8 × 4 cases sur l'île, la façade à l'ouest, sur son parvis ─
  const nd0 = ix1 - 7;
  for (let x = ix0; x <= ix1; x++) for (const y of [c - 4, c - 3, c + 2, c + 3]) put(x, y, '.');   // le tour de l'île
  for (let x = nd0 - 4; x < nd0; x++) for (let y = c - 4; y <= c + 3; y++) put(x, y, '.');          // le parvis
  for (let x = nd0; x <= ix1; x++) for (let y = c - 2; y <= c + 1; y++) put(x, y, 'N', 5);          // la nef et le chœur
  for (const y of [c - 2, c + 1]) put(nd0, y, 'N', 8);                                              // les tours
  for (const y of [c - 1, c]) put(nd0, y, 'N', 6);                                                  // entre elles, la rose

  // ─ Les îlots : ce qui reste à bâtir, par groupes de cases ─
  const blocks = [];
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
    blocks.push(b);
  }
  // les squares : trois îlots de taille moyenne, loin les uns des autres
  const gardenSet = new Set();
  const gardens = [];
  for (const [fx, fy] of [[0.5, 0.2], [0.25, 0.8], [0.82, 0.78]]) {
    const pick = blocks
      .filter(b => !gardenSet.has(b) && b.cells.length >= 30 && b.cells.length <= 150 && !b.cells.every(([x]) => onIsland(x)) && b.cells.every(([, y]) => y < c - 8 || y > c + 8))
      .sort((p, q) => Math.hypot((p.x0 + p.x1) / 2 - w * fx, (p.y0 + p.y1) / 2 - h * fy) - Math.hypot((q.x0 + q.x1) / 2 - w * fx, (q.y0 + q.y1) / 2 - h * fy))[0];
    if (pick) gardenSet.add(pick);
  }

  blocks.forEach((b, bi) => {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, minDim = Math.min(bw, bh);
    const mine = new Set(b.cells.map(([x, y]) => y * w + x));
    const inBlock = (x, y) => mine.has(y * w + x);
    if (gardenSet.has(b)) { for (const [x, y] of b.cells) put(x, y, '.'); gardens.push(b); return; }
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const old = b.cells.every(([x, y]) => onIsland(x) && y >= c - 4 && y <= c + 3) || (cx < w * 0.45 && cy > c) || (cx > w * 0.72 && cy < c * 0.6) || hash(bi, seed, 5) < 0.26;
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

  const rows = g.map(row => row.join('')), ground = k.map(row => row.join(''));
  const data = { w, h, seed, start: [vb[1] + 2, hb[1] + 2], rows, ground };
  data.props = generateProps(makeCity(data), { gardens: gardens.map(b => b.cells) });
  return data;
}
