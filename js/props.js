/* Le mobilier urbain : réverbères, arbres, bancs, colonnes Morris, bornes.
   Posés librement dans les rues (coordonnées monde en pixels), gardés dans
   data/ville.json (« props » : [type, x, y, variante]) et placés dans
   l'atelier. Chaque objet est dessiné une fois dans un petit canvas, dans la
   palette du jeu ; les réverbères éclairent la nuit (game.js). */
import { PAL } from './palette.js?v=1.3.0';
import { hash, rng } from './city.js?v=1.3.0';

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

// Le mobilier d'un quartier tiré au sort : réverbères le long des façades,
// arbres, bancs et une colonne sur la place
export function generateProps(city) {
  const out = [];
  const C = 60;
  const r = rng(city.seed * 7 + 3);
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
    if (city.at(x, y) !== 0) continue;
    const walls = [[0, -1], [-1, 0], [0, 1], [1, 0]].filter(([dx, dy]) => city.at(x + dx, y + dy) > 0);
    const openAround = [[0, -1], [-1, 0], [0, 1], [1, 0]].filter(([dx, dy]) => city.at(x + dx, y + dy) === 0).length;
    if (walls.length && hash(x, y, city.seed, 61) < 0.22) {
      // un réverbère contre le mur, à 40 cm
      const [dx, dy] = walls[0];
      const wx = (x + 0.5) * C + dx * 21, wy = (y + 0.5) * C + dy * 21;
      out.push(['lamp', Math.round(wx + (r() - 0.5) * 20 * Math.abs(dy)), Math.round(wy + (r() - 0.5) * 20 * Math.abs(dx)), 0]);
      if (r() < 0.25) out.push(['borne', Math.round(wx + 12 * (dy ? 1 : 0)), Math.round(wy + 12 * (dx ? 1 : 0)), 0]);
    } else if (openAround === 4 && hash(x, y, city.seed, 62) < 0.35) {
      // en plein espace (la place) : un arbre, parfois un banc ou une colonne
      out.push(['tree', Math.round((x + 0.3 + r() * 0.4) * C), Math.round((y + 0.3 + r() * 0.4) * C), Math.floor(r() * 6)]);
      if (r() < 0.35) out.push(['bench', Math.round((x + 0.5) * C + 14), Math.round((y + 0.5) * C - 6), Math.floor(r() * 2)]);
    } else if (openAround === 4 && hash(x, y, city.seed, 63) < 0.08) {
      out.push(['colonne', Math.round((x + 0.5) * C), Math.round((y + 0.5) * C), 0]);
    }
  }
  return out;
}
