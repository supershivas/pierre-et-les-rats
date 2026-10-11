/* Le générateur de maisons et d'immeubles en 3D isométrique.

   Chaque colonne du quartier (city.js) est peinte pixel par pixel dans sa
   propre image, une fois, puis posée telle quelle dans la scène. Les morceaux
   s'adaptent à leurs voisins, à la façon de Townscaper :
   - une face cachée par un voisin aussi haut n'est pas peinte ;
   - au rez-de-chaussée, une face sur rue reçoit une arcade (porte ou
     boutique), une face sur cour des fenêtres basses ;
   - le toit (un comble à la Mansart) prend le sens des voisins de même
     hauteur pour que les faîtages se raccordent ; un pignon ferme le bout
     quand le voisin est plus bas ;
   - façades haussmanniennes (voir paintFloor) ; fenêtres éclairées et
     cheminées tirées au sort par cellule (même tirage pour la même case).
   Peu de détails, à dessein : des murs unis, des vitres noires, la neige.

   Projection (pixels du jeu, 1 px = 5 cm) : x écran = a − b, y écran =
   (a + b) / 2 − z. Dans l'image d'une colonne, le coin avant au sol est en
   (CELL, H − 1). Face A : le mur du côté +y (à gauche à l'écran, éclairé) ;
   face B : le mur du côté +x (à droite, à l'ombre). */
import { RGB } from './palette.js?v=1.3.0';
import { CELL, FLOOR, ROOF } from './scale.js?v=1.3.0';
import { hash } from './city.js?v=1.3.0';

const CHIMNEY_H = 16;
export const COLUMN_W = CELL * 2 + 1;
export const columnHeight = floors => CELL / 2 + floors * FLOOR + ROOF + CHIMNEY_H + 6;

// Profil du comble : un brisis raide sur 10 px, puis un terrasson doux
export const roofZ = d => (d < 10 ? d * 2.2 : 22 + (d - 10) * 0.6);

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
export function renderColumn(city, i, j) {
  const n = city.at(i, j);
  const W = COLUMN_W, H = columnHeight(n);
  const img = new ImageData(W, H);
  const data = img.data;
  const seed = city.seed;
  const put = (x, y, key) => {
    if (x < 0 || y < 0 || x >= W || y >= H || !key) return;
    const o = (y * W + x) * 4, c = RGB[key];
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  };
  const base = H - 1;
  // Un point (a, b, z) du volume de la colonne, en pixels de l'image
  const project = (a, b, z) => [CELL + Math.round(a - b), base + Math.floor((Math.round(a) + Math.round(b) - 2 * CELL) / 2) - Math.round(z)];
  // Faces : u le long du mur (de gauche à droite à l'écran), z la hauteur
  const faceA = (u, z, key) => put(u, base + Math.floor((u - CELL) / 2) - z, key);
  const faceB = (u, z, key) => put(CELL + u, base + Math.floor(-u / 2) - z, key);

  const lit = [];
  for (let k = 0; k < n; k++) {
    if (city.at(i, j + 1) <= k) paintFloor('A', k);
    if (city.at(i + 1, j) <= k) paintFloor('B', k);
  }

  /* Un étage de façade haussmannienne, sans détail superflu : ce qui la
     fait reconnaître, c'est le rythme. Rez-de-chaussée à refends (bossages
     horizontaux) et grandes arcades ; au-dessus, deux hautes portes-fenêtres
     par module, alignées d'un étage à l'autre ; balcons filants au 2e et au
     dernier étage ; une corniche épaisse sous le comble. */
  function paintFloor(face, k) {
    const T = TONES[face];
    const put2 = face === 'A' ? faceA : faceB;
    const neighbour = face === 'A' ? city.at(i, j + 1) : city.at(i + 1, j);
    const onStreet = neighbour === 0;
    const balcony = k > 0 && ((k === 2 && n >= 4) || (k === n - 1 && n >= 5));
    const fid = face === 'A' ? 1 : 2;
    const litWin = [hash(i, j, k, fid, 5, seed) < 0.16, hash(i, j, k, fid, 6, seed) < 0.16];
    const arcadeLit = hash(i, j, fid, 7, seed) < 0.3;
    if ((litWin[0] || litWin[1]) && face === 'A') lit.push(k);

    for (let u = 0; u < CELL; u++) {
      const drift = k === 0 && neighbour !== -1 ? 2 + Math.round(Math.sin(u * 0.2 + i * 3 + j)) : 0;
      for (let v = 0; v < FLOOR; v++) {
        let key = T.wall;
        if (k === 0) {
          // les refends du rez-de-chaussée
          if (v % 6 === 5) key = T.mid;
          if (onStreet) key = arcadePixel(u, v, T, arcadeLit) || key;
          else key = windowPixel(u, v, false, T, 22) || key;
        } else {
          key = windowPixel(u, v, litWin[u < CELL / 2 ? 0 : 1], T) || key;
          if (balcony) key = balconyPixel(u, v, T) || key;
          else if (v === 4 && ((u >= 7 && u <= 20) || (u >= 39 && u <= 52))) key = T.snow; // appuis
        }
        // corniches : un trait entre les étages, une épaisse sous le comble
        if (k < n - 1 && v === FLOOR - 1) key = T.snowS;
        if (k === n - 1 && v >= 53) key = v === 53 ? T.dark : v === FLOOR - 1 ? T.snow : T.frame;
        if (v < drift) key = T.snow;
        put2(u, k * FLOOR + v, key);
      }
    }
  }

  // ─── Le toit ───
  const chimneys = [];
  if (n > 0) {
    const same = (x, y) => city.at(x, y) === n;
    const alongX = (same(i - 1, j) + same(i + 1, j)) >= (same(i, j - 1) + same(i, j + 1));
    const zb = n * FLOOR;
    const dOf = (a, b) => (alongX ? Math.min(b, CELL - b) : Math.min(a, CELL - a));
    // pas de 0,25 px : plus serré, aucun versant arrière ne transparaît en rayures
    for (let b = 0; b <= CELL; b += 0.25) {
      for (let a = 0; a <= CELL; a += 0.25) {
        const d = dOf(a, b);
        const zr = roofZ(d);
        const [x, y] = project(a, b, zb + zr);
        // Le versant tourné vers nous (côté +y si le faîtage suit x, sinon +x)
        const near = alongX ? b > CELL / 2 : a > CELL / 2;
        const litSide = alongX && near;
                let key;
        // les lucarnes : deux par module, sur le brisis tourné vers nous
        const along = alongX ? a : b;
        const dormer = near && d >= 2 && d < 9 && ((along >= 11 && along <= 19) || (along >= 41 && along <= 49));
        if (d < 1) key = 'nuit';
        else if (dormer) key = d >= 8 ? 'neige' : (along === 11 || along === 19 || along === 41 || along === 49) ? 'pierreL' : 'nuit';
        else if (d < 10) key = near ? 'ardoise' : 'nuit2';
        else key = litSide ? 'neige' : near ? 'neigeM' : 'neigeO';
        put(x, y, key);
      }
    }
    // Le pignon, quand le voisin au bout du faîtage est plus bas
    if (alongX && city.at(i + 1, j) < n) {
      for (let u = 0; u <= CELL; u++) {
        const b = CELL - u, zr = Math.floor(roofZ(Math.min(b, CELL - b)));
        for (let v = 0; v <= zr; v++) faceB(u, zb + v, v >= zr - 1 ? 'neigeM' : 'pierre');
      }
    }
    if (!alongX && city.at(i, j + 1) < n) {
      for (let u = 0; u <= CELL; u++) {
        const zr = Math.floor(roofZ(Math.min(u, CELL - u)));
        for (let v = 0; v <= zr; v++) faceA(u, zb + v, v >= zr - 1 ? 'neige' : 'pierreL');
      }
    }
    // Les cheminées, sur le faîtage
    const nCh = hash(i, j, 41, seed) < 0.55 ? 1 : 0;
    for (let c = 0; c < nCh; c++) {
      const along = hash(i, j, 42 + c, seed) < 0.5 ? 9 : 43;
      const zr = zb + ROOF - 6;
      const top = zr + CHIMNEY_H;
      // deux faces visibles et le dessus
      for (let s = 0; s < 8; s++) for (let z = zr; z < top; z++) {
        const cap = z >= top - 2;
        const [ax, ay] = alongX ? project(along + s, 34, z) : project(34, along + 8 - s, z);
        put(ax, ay, cap ? 'pierreL' : (z - zr) % 5 === 4 ? 'pierre' : 'pierreL');
      }
      for (let s = 0; s < 6; s++) for (let z = zr; z < top; z++) {
        const cap = z >= top - 2;
        const [bx, by] = alongX ? project(along + 8, 34 - s, z) : project(34 - s, along + 8, z);
        put(bx, by, cap ? 'pierre' : (z - zr) % 5 === 4 ? 'pierreS' : 'pierre');
      }
      for (let p = 0; p <= 8; p += 0.5) for (let q = 0; q <= 6; q += 0.5) {
        const [tx, ty] = alongX ? project(along + p, 28 + q, top) : project(28 + q, along + p, top);
        put(tx, ty, p > 1.5 && p < 6.5 && q > 1.5 && q < 4.5 ? 'nuit' : 'neige');
      }
      const [cx, cy] = alongX ? project(along + 4, 31, top) : project(31, along + 4, top);
      chimneys.push([cx, cy]);
    }
  }

  const canvas = canvasFor(W, H);
  canvas.getContext('2d').putImageData(img, 0, 0);
  return { canvas, w: W, h: H, chimneys, lit };
}

// Deux portes-fenêtres de 12 × 40 px par module, alignées d'un étage à l'autre
// (au rez-de-chaussée sur cour : plus basses, h)
function windowPixel(u, v, isLit, T, h = 40) {
  const x0 = u < CELL / 2 ? 8 : 40, x1 = x0 + 11, y0 = 6, y1 = y0 + h - 1;
  if (u < x0 || u > x1 || v < y0 || v > y1) return null;
  if (u === x0 || u === x1 || v === y1) return T.dark;
  if (isLit) return u === x0 + 6 || v === y0 + 28 ? T.dark : 'ocre';
  return 'nuit';
}

// Le balcon filant : une dalle, une rambarde à barreaux, la neige sur la main courante
function balconyPixel(u, v, T) {
  if (v === 0) return T.dark;
  if (v >= 1 && v <= 4) return u % 2 === 0 || v === 4 ? 'nuit' : null;
  if (v === 5) return T.snow;
  return null;
}

// L'arcade du rez-de-chaussée : une grande baie cintrée (porte ou boutique)
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
