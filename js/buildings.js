/* Le générateur de maisons et d'immeubles en 3D isométrique.

   Chaque colonne du quartier (city.js) est peinte pixel par pixel dans sa
   propre image, une fois, puis posée telle quelle dans la scène. Les morceaux
   s'adaptent à leurs voisins, à la façon de Townscaper :
   - une face cachée par un voisin aussi haut n'est pas peinte ;
   - au rez-de-chaussée, une face sur rue reçoit une ouverture tirée au sort
     (boutique, porte cochère, café, porte), une face sur cour des fenêtres
     basses ; un passage (terrain P) ouvre une arche de part en part ;
   - le toit prend le sens des voisins de même hauteur pour que les faîtages
     se raccordent ; un pignon ferme le bout quand le voisin est plus bas ;
   - fenêtres éclairées, cheminées (0 à 3), variantes : tirées au sort par
     cellule (toujours le même tirage pour la même case).

   Trois styles :
   - l'immeuble haussmannien (4 niveaux et plus) : RDC à refends, entresol,
     hautes portes-fenêtres alignées, fronton au 2e, balcons filants au 2e et
     au 5e, balconnets ailleurs, corniche, comble à la Mansart et lucarnes ;
   - la vieille maison parisienne (3 niveaux et moins) : enduit, fenêtres
     plus petites et pas tout à fait alignées, volets, devanture en bois,
     toit à deux pans raide, lucarne à poulie ;
   - Notre-Dame (terrain N) : la nef (contreforts, lancettes, toit très
     raide) et les tours (portail, galerie des rois, rose, abat-sons,
     balustrade).

   La nuit (option night) : vue à hauteur d'enfant, on ne voit bien que les
   premiers étages ; au-dessus, la façade s'enfonce dans le noir (trame de
   Bayer selon la hauteur), sauf les fenêtres éclairées.

   Options : night (la nuit des étages) ; all (peindre aussi les faces cachées par
   un voisin : le moteur 3D, où un voisin peut être coupé) ; roof (false : sans
   toit) ; raw (rendre { data, w, h } sans canvas).

   Projection (pixels du jeu, 1 px = 5 cm) : x écran = a − b, y écran =
   (a + b) / 2 − z. Dans l'image d'une colonne, le coin avant au sol est en
   (CELL, H − 1). Face A : le mur du côté +y (à gauche à l'écran, éclairé) ;
   face B : le mur du côté +x (à droite, à l'ombre). */
import { RGB } from './palette.js?v=2.2.0';
import { CELL, FLOOR, ROOF } from './scale.js?v=2.2.0';
import { hash } from './city.js?v=2.2.0';

const CHIMNEY_H = 16;
export const COLUMN_W = CELL * 2 + 1;
export const columnHeight = floors => CELL / 2 + floors * FLOOR + ROOF + 30 + CHIMNEY_H + 6;

// Profils de toit : le comble à la Mansart (brisis raide, terrasson doux),
// le toit à deux pans des vieilles maisons, la nef de la cathédrale
export const roofZ = d => (d < 10 ? d * 2.2 : 22 + (d - 10) * 0.6);
const gableZ = d => d * 1.2;
const naveZ = d => d * 2;

// La nuit qui tombe des étages : claire jusqu'à NIGHT_Z0, noire vers NIGHT_Z1
const NIGHT_Z0 = 110, NIGHT_Z1 = 180;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Tons par face : A éclairée, B à l'ombre
const TONES = {
  A: { wall: 'pierreL', mid: 'pierre', dark: 'pierreS', snow: 'neige', snowS: 'neigeM', frame: 'pierreL' },
  B: { wall: 'pierre', mid: 'pierreS', dark: 'pierreS', snow: 'neigeM', snowS: 'neigeO', frame: 'pierreL' },
};

function canvasFor(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* Peint la colonne (i, j). Rend { canvas, w, h, chimneys: [[lx, ly]], lit } :
   l'image, et les sommets de cheminée (pour la fumée), en pixels de l'image. */
export function renderColumn(city, i, j, { night = false, all = false, roof = true, raw = false } = {}) {
  const n = city.at(i, j);
  const kind = city.kind(i, j);
  const style = kind === 'N' ? (n >= 7 ? 'tower' : 'nave') : n <= 3 ? 'old' : 'haussmann';
  const W = COLUMN_W, H = columnHeight(n);
  const img = new ImageData(W, H);
  const data = img.data;
  const seed = city.seed;
  // put : un pixel ; z sert à la nuit qui tombe des étages
  const put = (x, y, key, z = 0) => {
    if (x < 0 || y < 0 || x >= W || y >= H || !key) return;
    if (night && key !== 'ocre' && z > NIGHT_Z0) {
      const t = Math.min(1, (z - NIGHT_Z0) / (NIGHT_Z1 - NIGHT_Z0));
      if (t * 16 > BAYER[(z & 3) * 4 + (x & 3)]) key = 'nuit';
    }
    const o = (y * W + x) * 4, c = RGB[key];
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  };
  const base = H - 1;
  const project = (a, b, z) => [CELL + Math.round(a - b), base + Math.floor((Math.round(a) + Math.round(b) - 2 * CELL) / 2) - Math.round(z)];
  const putAt = (a, b, z, key) => { const [x, y] = project(a, b, z); put(x, y, key, z); };
  // Faces : u le long du mur (de gauche à droite à l'écran), z la hauteur
  const faceA = (u, z, key) => put(u, base + Math.floor((u - CELL) / 2) - z, key, z);
  const faceB = (u, z, key) => put(CELL + u, base + Math.floor(-u / 2) - z, key, z);

  const hVariant = hash(i, j, 77, seed);                 // une famille de fenêtres par immeuble
  const lit = [];
  for (let k = 0; k < n; k++) {
    if (all || city.at(i, j + 1) <= k) paintFloor('A', k);
    if (all || city.at(i + 1, j) <= k) paintFloor('B', k);
  }

  function paintFloor(face, k) {
    const T = TONES[face];
    const put2 = face === 'A' ? faceA : faceB;
    const ni = face === 'A' ? i : i + 1, nj = face === 'A' ? j + 1 : j;
    const neighbour = city.at(ni, nj);
    const onStreet = (neighbour === 0 && !city.isWater(ni, nj)) || city.kind(ni, nj) === '=';
    const fid = face === 'A' ? 1 : 2;
    const R = (...a) => hash(i, j, k, fid, ...a, seed);
    let pix;
    if (style === 'haussmann') pix = haussmannFloor(face, k, onStreet, R, T);
    else if (style === 'old') pix = oldFloor(face, k, onStreet, R, T);
    else pix = cathedralFloor(face, k, R, T);
    if (pix.lit && face === 'A') lit.push(k);
    const passage = kind === 'P' && k === 0;
    for (let u = 0; u < CELL; u++) {
      const drift = k === 0 && neighbour !== -1 ? 2 + Math.round(Math.sin(u * 0.2 + i * 3 + j)) : 0;
      for (let v = 0; v < FLOOR; v++) {
        let key = pix.at(u, v) || T.wall;
        if (passage) key = passagePixel(u, v, T) || key;
        if (v < drift && !(passage && u > 12 && u < 47)) key = T.snow;
        put2(u, k * FLOOR + v, key);
      }
    }
  }

  // ─── L'immeuble haussmannien ───
  function haussmannFloor(face, k, onStreet, R, T) {
    const triple = hVariant < 0.3;
    const wins = triple ? [[5, 13], [25, 33], [45, 53]] : [[8, 19], [40, 51]];
    const litWin = wins.map((_, w) => R(5 + w) < 0.16);
    const balcony = k === 2 || k === 5;
    const top = k === n - 1;
    if (k === 0) {
      const r = R(1);
      const type = !onStreet ? 'court' : r < 0.32 ? 'boutique' : r < 0.52 ? 'cochere' : r < 0.7 ? 'cafe' : 'porte';
      const shopLit = R(7) < 0.35;
      return {
        lit: shopLit && (type === 'boutique' || type === 'cafe'),
        at: (u, v) => {
          const key = v % 6 === 5 ? T.mid : null;                       // les refends
          if (type === 'court') return windowAt(u, v, wins, [false, false, false], T, 18, 14) || key;
          if (type === 'boutique') return arcadePixel(u, v, T, shopLit) || key;
          if (type === 'cochere') return cocherePixel(u, v, T) || key;
          if (type === 'cafe') return cafePixel(u, v, T, shopLit) || key;
          return doorPixel(u, v, T, R(8) < 0.4) || key;
        },
      };
    }
    // l'entresol : des fenêtres plus basses
    const h = k === 1 ? 28 : 40, y0 = k === 1 ? 12 : 6;
    return {
      lit: litWin.some(Boolean),
      at: (u, v) => {
        let key = windowAt(u, v, wins, litWin, T, h, y0);
        // le fronton au-dessus des fenêtres du 2e
        if (!key && k === 2) for (const [x0, x1] of wins) {
          const c = (x0 + x1) / 2;
          if (Math.abs(u - c) <= x1 - c + 1 && v === y0 + h + 3 - Math.floor(Math.abs(u - c) / 2)) key = T.frame;
        }
        if (balcony) key = balconyPixel(u, v, T) || key;
        else if (k >= 3 && v <= 4) {
          // un balconnet sous chaque fenêtre
          for (const [x0, x1] of wins) if (u >= x0 - 1 && u <= x1 + 1) key = v === 0 ? T.dark : v === 4 ? T.snow : (u % 2 ? 'nuit' : key);
        }
        if (!top && v === FLOOR - 1) key = T.snowS;
        if (top && v >= 53) key = v === 53 ? T.dark : v === FLOOR - 1 ? T.snow : T.frame;
        return key;
      },
    };
  }

  // ─── La vieille maison parisienne ───
  function oldFloor(face, k, onStreet, R, T) {
    // une ou deux fenêtres, pas tout à fait à leur place d'un étage à l'autre
    const count = hash(i, j, face === 'A' ? 31 : 32, seed) < 0.5 ? 1 : 2;
    const wins = (count === 1 ? [25] : [11, 38]).map((x, w) => x + Math.floor(R(11 + w) * 6) - 3);
    const litWin = wins.map((_, w) => R(5 + w) < 0.2);
    if (k === 0) {
      const shop = onStreet && R(1) < 0.55, shopLit = R(7) < 0.4;
      return {
        lit: shop && shopLit,
        at: (u, v) => {
          if (shop) return devanturePixel(u, v, T, shopLit);
          if (onStreet && u >= 24 && u <= 35 && v <= 38) return v > 35 && (u < 26 || u > 33) ? null : v < 2 ? T.snow : 'nuit'; // la porte basse
          return windowAt(u, v, wins.map(x => [x, x + 9]), [false, false], T, 16, 16);
        },
      };
    }
    return {
      lit: litWin.some(Boolean),
      at: (u, v) => {
        for (let w = 0; w < wins.length; w++) {
          const x0 = wins[w], x1 = x0 + 9;
          const key = windowAt(u, v, [[x0, x1]], [litWin[w]], T, 20, 14);
          if (key) return key;
          // les volets, rabattus de chaque côté
          if (v >= 14 && v <= 33 && ((u >= x0 - 5 && u < x0) || (u > x1 && u <= x1 + 5))) return v % 3 === 0 ? 'nuit2' : 'ardoise';
        }
        if (v === FLOOR - 1) return T.mid;          // un cordon d'étage, sans plus
        return null;
      },
    };
  }

  // ─── Notre-Dame ───
  // La rose, à cheval sur les deux tours : au bord commun des deux cases
  // (face B : u = 0 côté +y, u = 60 côté −y)
  function roseCenter() {
    if (city.kind(i, j - 1) === 'N' && city.at(i, j - 1) >= 7) return CELL;
    if (city.kind(i, j + 1) === 'N' && city.at(i, j + 1) >= 7) return 0;
    return 30;
  }
  function cathedralFloor(face, k, R, T) {
    const tower = style === 'tower';
    const rose = roseCenter();
    return {
      lit: false,
      at: (u, v) => {
        const z = k * FLOOR + v;
        // les contreforts, aux deux bords
        if (u < 4 || u > 55) return (z % 24) < 2 ? T.snow : T.dark;
        if (!tower) {
          // la nef : de hautes lancettes à partir du 2e niveau
          if (k >= 1 && k < n - 1 && u >= 24 && u <= 35) {
            const top = 50 - Math.abs(u - 29.5) * 2;
            if (v >= 6 && v <= top) return u === 24 || u === 35 ? T.dark : ((u + v) % 7 === 0 ? 'nuit2' : 'nuit');
          }
          return k === n - 1 && v >= 54 ? (v === 54 ? T.dark : T.frame) : null;
        }
        if (face === 'B') {
          // le portail
          if (k === 0 && u >= 14 && u <= 45 && v <= 52) {
            if (v > 52 - Math.abs(u - 29.5) * 1.6) return null;
            return v < 2 ? T.snow : (u - 14) % 5 === 0 || v % 10 === 9 ? T.dark : 'nuit';
          }
          if (k === 1 && v >= 40 && v <= 52) return (u % 6 < 3) ? 'nuit' : T.frame;  // la galerie des rois
          if (k === 2 || k === 3) {
            // la rose, éclairée par les cierges
            const dz = z - 170, du = u - rose, d = Math.hypot(du, dz);
            if (d <= 18) return d > 16 ? T.dark : ((Math.round(Math.atan2(dz, du) * 4) & 1) === 0 ? 'ocre' : 'nuit');
          }
        }
        // les hautes baies à abat-sons, en haut des tours
        if (k >= 5 && k < n - 1 && u >= 18 && u <= 41 && v >= 4) {
          if (v <= 56 - Math.abs(u - 29.5) * 0.8) return v % 4 === 0 ? T.frame : 'nuit';
        }
        // la balustrade du sommet
        if (k === n - 1 && v >= 50) return v === 50 ? T.dark : (u % 3 === 0 ? T.frame : null);
        return null;
      },
    };
  }

  // ─── Le toit ───
  const chimneys = [];
  if (n > 0 && roof) {
    const same = (x, y) => city.at(x, y) === n && city.kind(x, y) === kind;
    const alongX = (same(i - 1, j) + same(i + 1, j)) >= (same(i, j - 1) + same(i, j + 1));
    const zb = n * FLOOR;
    const prof = style === 'old' ? gableZ : style === 'nave' ? naveZ : roofZ;
    if (style !== 'tower') {
      const dOf = (a, b) => (alongX ? Math.min(b, CELL - b) : Math.min(a, CELL - a));
      for (let b = 0; b <= CELL; b += 0.25) {
        for (let a = 0; a <= CELL; a += 0.25) {
          const d = dOf(a, b);
          const near = alongX ? b > CELL / 2 : a > CELL / 2;
          const litSide = alongX && near;
          const along = alongX ? a : b;
          let key;
          if (d < 1) key = 'nuit';
          else if (style === 'haussmann') {
            // les lucarnes : deux par module, sur le brisis tourné vers nous
            const dormer = near && d >= 2 && d < 9 && ((along >= 11 && along <= 19) || (along >= 41 && along <= 49));
            if (dormer) key = d >= 8 ? 'neige' : (along === 11 || along === 19 || along === 41 || along === 49) ? 'pierreL' : 'nuit';
            else if (d < 10) key = near ? 'ardoise' : 'nuit2';
            else key = litSide ? 'neige' : near ? 'neigeM' : 'neigeO';
          } else if (style === 'old') {
            // la lucarne à poulie, au milieu du versant
            const dormer = near && hash(i, j, 33, seed) < 0.5 && d >= 3 && d < 14 && along >= 24 && along <= 36;
            if (dormer) key = d >= 13 ? 'neige' : along === 24 || along === 36 ? 'pierreL' : 'nuit';
            else key = d < 4 ? (near ? 'ardoise' : 'nuit2') : litSide ? 'neige' : near ? 'neigeM' : 'neigeO';
          } else {
            key = d > 28 ? 'neige' : near ? 'ardoise' : 'nuit2';  // la nef : ardoise, un liseré de neige au faîte
          }
          putAt(a, b, zb + prof(d), key);
        }
      }
      // le pignon, quand le voisin au bout du faîtage est plus bas
      if (alongX && city.at(i + 1, j) < n) {
        for (let u = 0; u <= CELL; u++) {
          const b = CELL - u, zr = Math.floor(prof(Math.min(b, CELL - b)));
          for (let v = 0; v <= zr; v++) faceB(u, zb + v, v >= zr - 1 ? 'neigeM' : 'pierre');
        }
      }
      if (!alongX && city.at(i, j + 1) < n) {
        for (let u = 0; u <= CELL; u++) {
          const zr = Math.floor(prof(Math.min(u, CELL - u)));
          for (let v = 0; v <= zr; v++) faceA(u, zb + v, v >= zr - 1 ? 'neige' : 'pierreL');
        }
      }
    } else {
      // le sommet plat des tours, sous la neige
      for (let b = 0; b <= CELL; b += 0.5) for (let a = 0; a <= CELL; a += 0.5) putAt(a, b, zb, a < 3 || b < 3 || a > 57 || b > 57 ? 'pierreL' : 'neige');
    }
    // les cheminées : de 0 à 3 souches le long du faîtage
    const r = hash(i, j, 41, seed);
    const nCh = style === 'nave' || style === 'tower' ? 0 : r < 0.25 ? 0 : r < 0.6 ? 1 : r < 0.85 ? 2 : 3;
    const slots = [6, 26, 46].sort((p, q) => hash(i, j, p, seed) - hash(i, j, q, seed));
    for (let c = 0; c < nCh; c++) {
      const along = slots[c];
      const zr = zb + prof(CELL / 2) - 6, top = zr + CHIMNEY_H + Math.floor(hash(i, j, c, 44, seed) * 6);
      for (let s = 0; s < 8; s++) for (let z = zr; z < top; z++) {
        const cap = z >= top - 2;
        const [ax, ay] = alongX ? project(along + s, 34, z) : project(34, along + 8 - s, z);
        put(ax, ay, cap ? 'pierreL' : (z - zr) % 5 === 4 ? 'pierre' : 'pierreL', z);
      }
      for (let s = 0; s < 6; s++) for (let z = zr; z < top; z++) {
        const cap = z >= top - 2;
        const [bx, by] = alongX ? project(along + 8, 34 - s, z) : project(34 - s, along + 8, z);
        put(bx, by, cap ? 'pierre' : (z - zr) % 5 === 4 ? 'pierreS' : 'pierre', z);
      }
      for (let p = 0; p <= 8; p += 0.5) for (let q = 0; q <= 6; q += 0.5) {
        const [tx, ty] = alongX ? project(along + p, 28 + q, top) : project(28 + q, along + p, top);
        put(tx, ty, p > 1.5 && p < 6.5 && q > 1.5 && q < 4.5 ? 'nuit' : 'neige', top);
      }
      const [cx, cy] = alongX ? project(along + 4, 31, top) : project(31, along + 4, top);
      chimneys.push([cx, cy]);
    }
  }

  if (raw) return { data, w: W, h: H, chimneys, lit };
  const canvas = canvasFor(W, H);
  canvas.getContext('2d').putImageData(img, 0, 0);
  return { canvas, w: W, h: H, chimneys, lit };
}

// Des fenêtres [x0, x1] de hauteur h (à partir de y0) : cadre, vitre noire,
// ou blanche et sa croisée si elle est éclairée
function windowAt(u, v, wins, litWin, T, h = 40, y0 = 6) {
  for (let w = 0; w < wins.length; w++) {
    const [x0, x1] = wins[w], y1 = y0 + h - 1;
    if (u < x0 || u > x1 || v < y0 || v > y1) continue;
    if (u === x0 || u === x1 || v === y1) return T.dark;
    if (v === y0) return T.snow;
    if (litWin[w]) return u === Math.floor((x0 + x1) / 2) || v === y0 + Math.floor(h * 0.7) ? T.dark : 'ocre';
    return 'nuit';
  }
  return null;
}

// Le balcon filant : une dalle, une rambarde à barreaux, la neige sur la main courante
function balconyPixel(u, v, T) {
  if (v === 0) return T.dark;
  if (v >= 1 && v <= 4) return u % 2 === 0 || v === 4 ? 'nuit' : null;
  if (v === 5) return T.snow;
  return null;
}

// L'arcade de boutique : une grande baie cintrée
function arcadePixel(u, v, T, isLit) {
  const cx = 29.5, half = 13, top = 46;
  const dx = Math.abs(u - cx);
  if (dx > half + 1 || v > top + 1) return null;
  const inside = v < top - 8 || (dx / half) ** 2 + ((v - (top - 8)) / 8) ** 2 <= 1;
  const rim = !inside && (dx / (half + 1)) ** 2 + ((v - (top - 8)) / 9) ** 2 <= 1;
  if (rim || (inside && dx > half)) return T.dark;
  if (!inside) return null;
  if (v < 2) return T.snow;
  if (isLit) return dx < 1 || v === 30 ? T.dark : 'ocre';
  return 'nuit';
}

// La porte cochère : deux grands battants de bois sous un arc
function cocherePixel(u, v, T) {
  const cx = 29.5, half = 16, top = 54;
  const dx = Math.abs(u - cx);
  if (dx > half + 1 || v > top + 1) return null;
  const inside = v < top - 10 || (dx / half) ** 2 + ((v - (top - 10)) / 10) ** 2 <= 1;
  if (!inside) return (dx / (half + 1)) ** 2 + ((v - (top - 10)) / 11) ** 2 <= 1 ? T.dark : null;
  if (dx < 1) return 'nuit';
  if (v < 2) return T.snow;
  return v % 12 === 0 || Math.abs(dx - 8) < 0.6 ? 'nuit' : 'nuit2';
}

// Le café : une large vitrine, un store de toile à festons
function cafePixel(u, v, T, isLit) {
  if (u < 4 || u > 55 || v > 47) return null;
  if (v >= 40) return v === 47 ? T.snow : (Math.floor(u / 4) % 2 ? 'neigeO' : 'neigeM');   // le store rayé
  if (v === 39) return u % 4 === 0 ? 'neigeO' : null;                                        // ses festons
  if (u === 4 || u === 55 || v <= 2) return v < 2 ? T.snow : 'nuit2';
  if ((u - 4) % 9 === 0 || v === 3) return 'nuit2';
  return isLit ? (v > 30 ? 'ocreS' : 'ocre') : 'nuit';
}

// La porte d'entrée : deux battants, une imposte vitrée au-dessus
function doorPixel(u, v, T, impLit) {
  if (u < 22 || u > 37 || v > 46) return null;
  if (u === 22 || u === 37 || v === 46) return T.dark;
  if (v >= 38) return v === 38 ? T.dark : impLit ? 'ocre' : 'nuit';    // l'imposte
  if (u === 29 || u === 30) return 'nuit';
  return v < 2 ? T.snow : (v % 9 === 0 ? 'nuit' : 'nuit2');
}

// La devanture de bois des vieilles boutiques : panneaux, vitrine, enseigne
function devanturePixel(u, v, T, isLit) {
  if (u < 5 || u > 54 || v > 46) return null;
  if (v >= 40) return v === 46 ? T.snow : v === 40 ? 'nuit' : 'nuit2';          // l'enseigne
  if (u === 5 || u === 54 || v < 4) return v < 2 ? T.snow : 'nuit2';
  if (u >= 26 && u <= 33) return u === 26 || u === 33 ? 'nuit2' : 'nuit';         // la porte
  if (v < 12) return v % 4 === 0 ? 'nuit' : 'nuit2';                              // le soubassement
  if ((u - 5) % 7 === 0 || v === 25) return 'nuit2';
  return isLit ? 'ocre' : 'nuit';
}

// Le passage : une haute arche qui traverse l'immeuble, une lanterne en haut
function passagePixel(u, v, T) {
  const cx = 29.5, half = 17, top = 56;
  const dx = Math.abs(u - cx);
  if (dx > half + 1 || v > top) return null;
  const inside = v < top - 12 || (dx / half) ** 2 + ((v - (top - 12)) / 12) ** 2 <= 1;
  if (!inside) return (dx / (half + 1)) ** 2 + ((v - (top - 12)) / 13) ** 2 <= 1 ? T.dark : null;
  if (dx < 2 && v >= 38 && v <= 41) return 'ocre';                                 // la lanterne du passage
  return v < 1 ? 'neigeO' : 'nuit';
}
