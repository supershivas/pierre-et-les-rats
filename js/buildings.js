/* Le générateur de maisons et d'immeubles en 3D isométrique.

   Chaque colonne du quartier (city.js) est peinte pixel par pixel dans sa
   propre image, une fois, puis posée telle quelle dans la scène. Les morceaux
   s'adaptent à leurs voisins, à la façon de Townscaper :
   - une face cachée par un voisin aussi haut n'est pas peinte ;
   - au rez-de-chaussée, une face sur rue reçoit parfois une porte ;
   - le toit (un comble à la Mansart) prend le sens des voisins de même
     hauteur pour que les faîtages se raccordent ; un pignon ferme le bout
     quand le voisin est plus bas ;
   - fenêtres (une face sur deux), fenêtres éclairées et cheminées sont
     tirées au sort par cellule (toujours le même tirage pour la même case).
   Peu de détails, à dessein : des murs unis, des vitres noires, la neige.

   Projection (pixels du jeu, 1 px = 5 cm) : x écran = a − b, y écran =
   (a + b) / 2 − z. Dans l'image d'une colonne, le coin avant au sol est en
   (CELL, H − 1). Face A : le mur du côté +y (à gauche à l'écran, éclairé) ;
   face B : le mur du côté +x (à droite, à l'ombre). */
import { RGB } from './palette.js?v=1.0.2';
import { CELL, FLOOR, ROOF } from './scale.js?v=1.0.2';
import { hash } from './city.js?v=1.0.2';

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

  function paintFloor(face, k) {
    const T = TONES[face];
    const put2 = face === 'A' ? faceA : faceB;
    const neighbour = face === 'A' ? city.at(i, j + 1) : city.at(i + 1, j);
    const onStreet = neighbour === 0;
    const r = hash(i, j, k, face === 'A' ? 1 : 2, seed);
    // Ce qui perce le mur : une porte en bas sur la rue, sinon une fenêtre sur deux
    let opening = 'none';
    if (k === 0) opening = onStreet && r < 0.5 ? 'door' : 'none';
    else if (r < 0.55) opening = 'window';
    const isLit = opening === 'window' && hash(i, j, k, face === 'A' ? 5 : 6, seed) < 0.22;
    if (isLit && face === 'A') lit.push(k);

    for (let u = 0; u < CELL; u++) {
      // L'amas de neige au pied du mur
      const drift = k === 0 && neighbour !== -1 ? 2 + Math.round(Math.sin(u * 0.2 + i * 3 + j)) : 0;
      for (let v = 0; v < FLOOR; v++) {
        let key = T.wall;
        // une corniche simple entre les étages, et sous le toit
        if (v === FLOOR - 1) key = k < n - 1 ? T.snowS : T.dark;
        if (opening === 'window') key = windowPixel(u, v, isLit, T) || key;
        else if (opening === 'door') key = doorPixel(u, v, T) || key;
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
        if (d < 1) key = 'nuit';
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
    const nCh = hash(i, j, 41, seed) < 0.3 ? 1 : 0;
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

// Une fenêtre de 18 × 30 px : un cadre, une vitre noire (ou blanche si éclairée), une croisée
function windowPixel(u, v, isLit, T) {
  const x0 = 21, x1 = 38, y0 = 12, y1 = 41;
  if (u < x0 || u > x1 || v < y0 || v > y1) return v === y0 - 1 && u >= x0 - 1 && u <= x1 + 1 ? T.snow : null;
  if (u === x0 || u === x1 || v === y0 || v === y1) return T.dark;
  if (isLit) return u === 29 || v === 27 ? T.dark : 'ocre';
  return 'nuit';
}

// Une porte de 20 × 44 px, toute noire, sur une marche
function doorPixel(u, v, T) {
  if (u < 20 || u > 39 || v > 43) return null;
  return v < 2 ? T.snow : 'nuit';
}
