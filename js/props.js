/* Le mobilier urbain : réverbères, arbres, bancs, colonnes Morris, bornes.
   Posés librement dans les rues (coordonnées monde en pixels), gardés dans
   data/ville.json (« props » : [type, x, y, variante]) et placés dans
   l'atelier. Chaque objet est dessiné une fois dans un petit canvas, dans la
   palette du jeu ; les réverbères éclairent la nuit (game.js). */
import { PAL } from './palette.js?v=2.0.1';
import { hash, rng } from './city.js?v=2.0.1';

export const PROP_TYPES = {
  lamp:    { label: 'Réverbère', icon: 'ti-bulb', r: 2, light: true },
  tree:    { label: 'Arbre', icon: 'ti-tree', r: 4 },
  bench:   { label: 'Banc', icon: 'ti-armchair', r: 5 },
  colonne: { label: 'Colonne Morris', icon: 'ti-cylinder', r: 7 },
  borne:   { label: 'Borne', icon: 'ti-point', r: 2 },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const px = (g, x, y, key, w = 1, h = 1) => { g.fillStyle = PAL[key]; g.fillRect(x, y, w, h); };

// Le réverbère : un fût de fonte, une lanterne vitrée, un chapeau de neige (3,4 m)
function drawLamp() {
  const c = canvas(11, 70), g = c.getContext('2d');
  px(g, 3, 66, 'nuit', 5, 4);          // le socle
  px(g, 4, 62, 'nuit', 3, 4);
  px(g, 5, 14, 'nuit', 1, 48);         // le fût
  px(g, 4, 18, 'nuit', 3, 1);          // une bague
  px(g, 3, 12, 'nuit', 5, 2);          // la console
  px(g, 2, 4, 'nuit', 7, 8);           // la lanterne
  px(g, 3, 5, 'ocre', 5, 6);           // la vitre allumée
  px(g, 5, 5, 'nuit', 1, 6);           // un montant
  px(g, 1, 2, 'nuit', 9, 2);           // le chapeau
  px(g, 2, 1, 'neige', 7, 1);
  px(g, 4, 0, 'neige', 3, 1);
  return { c, ax: 5, ay: 69, head: [5, 7] };
}

// L'arbre nu (un platane l'hiver) : des branches qui se partagent, de la neige dessus
function drawTree(variant) {
  const W = 70, H = 120, c = canvas(W, H), g = c.getContext('2d');
  const r = rng(1000 + variant);
  const seg = (x0, y0, ang, len, thick, depth) => {
    const steps = Math.max(1, Math.round(len));
    let x = x0, y = y0;
    for (let s = 0; s < steps; s++) {
      x += Math.cos(ang); y += Math.sin(ang);
      px(g, Math.round(x - thick / 2), Math.round(y), 'nuit', Math.max(1, Math.round(thick)), 1);
      // de la neige sur le dessus des branches presque horizontales
      if (Math.abs(Math.sin(ang)) < 0.75 && r() < 0.45) px(g, Math.round(x), Math.round(y) - 1, 'neige');
      ang += (r() - 0.5) * 0.25;
    }
    if (depth <= 0 || len < 4) return;
    const kids = 2 + (r() < 0.3 ? 1 : 0);
    for (let k = 0; k < kids; k++) seg(x, y, ang + (r() - 0.5) * 1.5, len * (0.62 + r() * 0.15), Math.max(1, thick * 0.6), depth - 1);
  };
  px(g, W / 2 - 2, H - 3, 'nuit', 5, 3); // le pied
  seg(W / 2, H - 2, -Math.PI / 2 + (r() - 0.5) * 0.1, 38 + r() * 10, 4, 5);
  return { c, ax: W / 2, ay: H - 1 };
}

// Le banc : deux pieds de fonte, l'assise et le dossier couverts de neige, vu en biais
function drawBench(variant) {
  const c = canvas(34, 22), g = c.getContext('2d');
  const flip = variant % 2;
  const P = (x, y, key, w = 1, h = 1) => px(g, flip ? 34 - x - w : x, y, key, w, h);
  for (let x = 0; x < 30; x++) {
    const y = 12 - Math.floor(x / 2);
    P(x + 2, y + 6, 'nuit');           // l'assise
    P(x + 2, y + 5, 'neige');          // la neige dessus
    P(x + 2, y, 'nuit');               // le dossier
    P(x + 2, y - 1, 'neigeM');
    if (x % 3 === 0) P(x + 2, y + 1, 'nuit', 1, 4); // les lattes du dossier
  }
  for (const x of [3, 29]) { const y = 12 - Math.floor((x - 2) / 2); P(x, y + 6, 'nuit', 1, 6); }
  return { c, ax: 17, ay: 21 };
}

// La colonne Morris : un cylindre d'affiches, un petit dôme sous la neige (2,6 m)
function drawColonne() {
  const c = canvas(17, 56), g = c.getContext('2d');
  px(g, 2, 50, 'nuit', 13, 6);         // le socle
  for (let x = 3; x < 14; x++) {
    const lit = x < 8 ? 'pierreL' : x < 11 ? 'pierre' : 'pierreS';
    px(g, x, 14, lit, 1, 36);          // le fût, ombré
  }
  px(g, 3, 22, 'nuit', 11, 1);         // la bande d'affiches
  px(g, 3, 40, 'nuit', 11, 1);
  px(g, 2, 10, 'nuit', 13, 4);         // la corniche
  px(g, 4, 6, 'ardoise', 9, 4);        // le dôme
  px(g, 3, 9, 'neige', 11, 1);
  px(g, 5, 5, 'neige', 7, 1);
  px(g, 7, 2, 'nuit', 3, 3);           // le lanternon
  px(g, 7, 1, 'neige', 3, 1);
  return { c, ax: 8, ay: 55 };
}

// La borne : une pierre ronde au bord de la rue (60 cm)
function drawBorne() {
  const c = canvas(6, 14), g = c.getContext('2d');
  px(g, 1, 3, 'pierreL', 2, 11);
  px(g, 3, 3, 'pierre', 2, 11);
  px(g, 1, 1, 'neige', 4, 2);
  px(g, 2, 0, 'neige', 2, 1);
  return { c, ax: 3, ay: 13 };
}

const cache = new Map();
export function propSprite(type, variant = 0) {
  const k = `${type}:${variant}`;
  let s = cache.get(k);
  if (!s) {
    s = type === 'lamp' ? drawLamp() : type === 'tree' ? drawTree(variant) : type === 'bench' ? drawBench(variant)
      : type === 'colonne' ? drawColonne() : drawBorne();
    cache.set(k, s);
  }
  return s;
}

/* Le mobilier d'un quartier : le long des avenues et des quais (cases B),
   en rangées droites : un arbre toutes les 3 cases sur chaque trottoir, un
   réverbère entre deux arbres, des bancs, une colonne Morris de loin en
   loin ; sur les places et dans le square, des arbres et des bancs ; dans les
   ruelles, des réverbères contre les murs et quelques bornes.
   Chaque objet : [type, x, y, variante, quart de tour] (le quart de tour dit
   où regarde un banc : 0 vers +y, 1 vers +x, 2 vers −y, 3 vers −x). */
export function generateProps(city, { gardens = [] } = {}) {
  const out = [];
  const C = 60;
  const r = rng(city.seed * 7 + 3);
  const isB = (x, y) => city.kind(x, y) === 'B' && city.at(x, y) === 0;
  const reach = (x, y) => city.reach[y * city.w + x] === 1;
  // la longueur d'une rangée de cases B, et le rang de la case dedans
  const run = (x, y, dx, dy) => {
    let a = 0, b = 0;
    while (isB(x - dx * (a + 1), y - dy * (a + 1))) a++;
    while (isB(x + dx * (b + 1), y + dy * (b + 1))) b++;
    return { before: a, len: a + b + 1 };
  };
  const quarter = (dx, dy) => (dy > 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3);
  const bandOf = [];
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
    if (!isB(x, y) || !reach(x, y)) continue;
    const across = { h: run(x, y, 0, 1), v: run(x, y, 1, 0) };    // h : à travers une avenue est-ouest
    // l'avenue est-ouest : étroite en y, longue en x ; l'autre l'inverse ; un carrefour : ni l'une ni l'autre
    const horiz = across.h.len <= 6 && across.v.len > across.h.len + 2;
    const vert = across.v.len <= 6 && across.h.len > across.v.len + 2;
    if (!horiz && !vert) continue;
    const a = horiz ? across.h : across.v;
    if (a.before !== 0 && a.before !== a.len - 1) continue;       // seulement les deux trottoirs
    const side = a.before === 0 ? -1 : 1;                           // −1 : le bord nord (ou ouest)
    const along = horiz ? x : y;
    const nx = horiz ? 0 : side, ny = horiz ? side : 0;             // vers l'extérieur de l'avenue
    // du côté de l'eau ?
    const waterSide = city.isWater(x + nx, y + ny);
    const px = (u, v) => horiz ? [(x + u) * C, (y + v) * C] : [(x + v) * C, (y + u) * C];
    // u : le long de l'avenue (0..1 dans la case), v : en travers (0 au bord extérieur, 1 côté chaussée)
    const at = (u, v) => { const vv = side < 0 ? v : 1 - v; return px(u, vv); };
    const slot = ((along % 3) + 3) % 3;
    if (slot === 0) {
      // un arbre au milieu du trottoir (ou une colonne Morris de loin en loin)
      const [wx, wy] = at(0.5, 0.5);
      if (along % 15 === 6 && !waterSide && side < 0) out.push(['colonne', Math.round(wx), Math.round(wy), 0, 0]);
      else out.push(['tree', Math.round(wx), Math.round(wy), Math.floor(r() * 6), 0]);
    } else if (slot === 1) {
      const [wx, wy] = at(0.5, 0.86);                                // au bord de la chaussée
      out.push(['lamp', Math.round(wx), Math.round(wy), 0, 0]);
    } else if (hash(x, y, city.seed, 64) < 0.4) {
      // un banc contre le mur (ou le parapet du quai), tourné vers la chaussée ou vers l'eau
      const [wx, wy] = at(0.5, waterSide ? 0.25 : 0.2);
      out.push(['bench', Math.round(wx), Math.round(wy), Math.floor(r() * 2), quarter(-nx, -ny)]);
    }
  }
  // Les places et le square : des arbres épars, un banc, une colonne
  for (const cells of gardens) {
    for (const [x, y] of cells) {
      if (hash(x, y, city.seed, 65) < 0.45) out.push(['tree', Math.round((x + 0.3 + r() * 0.4) * C), Math.round((y + 0.3 + r() * 0.4) * C), Math.floor(r() * 6), 0]);
      else if (hash(x, y, city.seed, 66) < 0.14) out.push(['bench', Math.round((x + 0.5) * C), Math.round((y + 0.5) * C), Math.floor(r() * 2), Math.floor(r() * 4)]);
    }
    const [mx, my] = cells[Math.floor(cells.length / 2)];
    out.push(['colonne', Math.round((mx + 0.5) * C), Math.round((my + 0.5) * C), 0, 0]);
  }
  // Les ruelles et les rues : des réverbères contre les murs, parfois une borne
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
    if (city.kind(x, y) !== '.' || !city.isStreet(x, y) || !reach(x, y)) continue;
    if (gardens.some(cells => cells.some(([gx, gy]) => gx === x && gy === y))) continue;
    const walls = [[0, -1], [-1, 0], [0, 1], [1, 0]].filter(([dx, dy]) => city.at(x + dx, y + dy) > 0);
    if (walls.length && hash(x, y, city.seed, 61) < 0.2) {
      const [dx, dy] = walls[0];
      const wx = (x + 0.5) * C + dx * 21, wy = (y + 0.5) * C + dy * 21;
      out.push(['lamp', Math.round(wx + (r() - 0.5) * 20 * Math.abs(dy)), Math.round(wy + (r() - 0.5) * 20 * Math.abs(dx)), 0, 0]);
      if (r() < 0.25) out.push(['borne', Math.round(wx + 12 * (dy ? 1 : 0)), Math.round(wy + 12 * (dx ? 1 : 0)), 0, 0]);
    }
  }
  return out;
}
