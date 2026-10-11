/* Le générateur de maisons et d'immeubles en 3D isométrique.

   Chaque colonne du quartier (city.js) est peinte pixel par pixel dans sa
   propre image, une fois, puis posée telle quelle dans la scène. Les morceaux
   s'adaptent à leurs voisins, à la façon de Townscaper :
   - une face cachée par un voisin aussi haut n'est pas peinte ;
   - au rez-de-chaussée, une face sur rue reçoit une porte, une boutique ou
     une fenêtre grillée ; un mur sur cour ou mitoyen reste aveugle ;
   - le toit (un comble à la Mansart) prend le sens des voisins de même
     hauteur pour que les faîtages se raccordent ; un pignon ferme le bout
     quand le voisin est plus bas ;
   - lucarnes, cheminées, volets, fenêtres éclairées sont tirés au sort par
     cellule (toujours le même tirage pour la même case).

   Projection (pixels du jeu, 1 px = 5 cm) : x écran = a − b, y écran =
   (a + b) / 2 − z. Dans l'image d'une colonne, le coin avant au sol est en
   (CELL, H − 1). Face A : le mur du côté +y (à gauche à l'écran, éclairé) ;
   face B : le mur du côté +x (à droite, à l'ombre). */
import { RGB } from './palette.js?v=1.0.0';
import { CELL, FLOOR, ROOF } from './scale.js?v=1.0.0';
import { hash } from './city.js?v=1.0.0';

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
    const top = k === n - 1;
    const r = hash(i, j, k, face === 'A' ? 1 : 2, seed);
    const r2 = hash(i, j, k, face === 'A' ? 3 : 4, seed);
    // Les coins du bâtiment (chaînes d'angle) : là où le mur tourne
    const cornerL = face === 'A' ? city.at(i - 1, j) <= k : city.at(i, j + 1) <= k;
    const cornerR = face === 'A' ? city.at(i + 1, j) <= k : city.at(i, j - 1) <= k;

    // Ce qui perce le mur à cet étage
    let opening = 'window';
    if (k === 0) {
      if (!onStreet) opening = r < 0.5 ? 'blind' : 'barred';
      else opening = r < 0.42 ? 'door' : r < 0.7 ? 'shop' : r < 0.78 ? 'cochere' : 'barred';
    } else if (!onStreet && neighbour !== -1 && r < 0.25) opening = 'blind';
    const shutters = r2 < 0.75 ? (r2 < 0.18 ? 'closed' : 'open') : 'none';
    const isLit = opening !== 'blind' && hash(i, j, k, face === 'A' ? 5 : 6, seed) < (opening === 'shop' ? 0.75 : 0.2);
    if (isLit && face === 'A') lit.push(k);

    for (let u = 0; u < CELL; u++) {
      // L'amas de neige au pied du mur, en vagues irrégulières
      const drift = k === 0 && neighbour !== -1 ? 1 + Math.floor(1.5 + 1.5 * Math.sin(u * 0.37 + i * 3 + j) + hash(u, i, j, 9) * 1.4) : 0;
      for (let v = 0; v < FLOOR; v++) {
        const z = k * FLOOR + v;
        let key = T.wall;
        const noise = hash(i * 61 + u, j * 67 + z, face === 'A' ? 11 : 12);
        if (noise < 0.07) key = T.mid;
        else if (noise > 0.985) key = T.dark;
        // Traînées de suie sous les fenêtres
        if (opening === 'window' && u > 22 && u < 37 && v < 9 && hash(u, i, j, k, 13) < 0.25 * (1 - v / 9)) key = T.mid;

        // Chaînes d'angle : pierres alternées le long des coins
        const block = Math.floor(z / 7) % 2;
        if ((cornerL && u < (block ? 4 : 6)) || (cornerR && u >= CELL - (block ? 4 : 6))) {
          key = z % 7 === 6 ? T.mid : (face === 'A' ? 'pierreL' : 'pierre');
          if (face === 'A' && noise < 0.2) key = 'neigeM';
        }

        // Bandeau d'étage : une corniche fine, de la neige dessus
        if (k < n - 1) {
          if (v === 55) key = T.dark;
          else if (v === 56 || v === 57) key = T.frame;
          else if (v === 58) key = T.snow;
        } else {
          // Corniche sous le toit, et des glaçons qui pendent
          if (v >= 54) key = v === 54 ? T.dark : T.frame;
          const ice = hash(u, i, j, 21);
          if (v < 54 && v >= 54 - Math.floor(ice * 5) && ice < 0.3) key = v === 54 - Math.floor(ice * 5) ? T.snowS : T.snow;
        }

        // Soubassement
        if (k === 0 && v < 5) key = noise < 0.3 ? T.dark : T.mid;

        const o = opening;
        if (o === 'window' || o === 'barred') key = windowPixel(u, v, key, T, shutters, isLit, o === 'barred', face) || key;
        else if (o === 'door') key = doorPixel(u, v, key, T, face) || key;
        else if (o === 'cochere') key = cocherePixel(u, v, key, T, face) || key;
        else if (o === 'shop') key = shopPixel(u, v, key, T, isLit, hash(i, j, k, 15, seed), face) || key;

        if (v < drift) key = v === drift - 1 && hash(u, v, i, j, 17) < 0.4 ? T.snowS : T.snow;
        put2(u, z, key);
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
    for (let b = 0; b <= CELL; b += 0.5) {
      for (let a = 0; a <= CELL; a += 0.5) {
        const d = dOf(a, b);
        const zr = roofZ(d);
        const [x, y] = project(a, b, zb + zr);
        // Le versant tourné vers nous (côté +y si le faîtage suit x, sinon +x)
        const near = alongX ? b > CELL / 2 : a > CELL / 2;
        const litSide = alongX && near;
        const t = hash(Math.round(a * 2) + i * 131, Math.round(b * 2) + j * 137, 23);
        let key;
        if (d < 1) key = 'nuit2'; // la gouttière
        else if (d < 10) {
          // Le brisis : des rangs d'ardoise, un liseré de neige sur chacun
          const row = Math.floor(d) % 3;
          key = row === 2 ? (litSide ? 'neige' : 'neigeM') : row === 0 ? 'nuit2' : 'ardoise';
          if (row === 1 && t < 0.1) key = 'nuit2';
          if (!near) key = row === 2 ? 'neigeO' : 'nuit2';
        } else {
          // Le terrasson, sous la neige
          key = litSide ? (t < 0.08 ? 'neigeM' : 'neige') : near ? (t < 0.12 ? 'neigeO' : 'neigeM') : 'neigeO';
          if (d > 29.4) key = 'neige';
        }
        put(x, y, key);
      }
    }
    // Le pignon, quand le voisin au bout du faîtage est plus bas
    if (alongX && city.at(i + 1, j) < n) {
      for (let u = 0; u <= CELL; u++) {
        const b = CELL - u, zr = Math.floor(roofZ(Math.min(b, CELL - b)));
        for (let v = 0; v <= zr; v++) faceB(u, zb + v, v >= zr - 1 ? 'neigeM' : hash(u, v, i, j, 25) < 0.06 ? 'pierreS' : 'pierre');
      }
    }
    if (!alongX && city.at(i, j + 1) < n) {
      for (let u = 0; u <= CELL; u++) {
        const zr = Math.floor(roofZ(Math.min(u, CELL - u)));
        for (let v = 0; v <= zr; v++) faceA(u, zb + v, v >= zr - 1 ? 'neige' : hash(u, v, i, j, 26) < 0.06 ? 'pierre' : 'pierreL');
      }
    }
    // La lucarne, sur le versant tourné vers nous
    if (hash(i, j, 31, seed) < 0.65) {
      const litDormer = hash(i, j, 32, seed) < 0.22;
      const dz = zb + roofZ(10) - 4;
      for (let s = 0; s < 14; s++) {
        for (let v = 0; v < 18; v++) {
          const inGlass = s >= 3 && s <= 10 && v >= 3 && v <= 12;
          let key = inGlass ? (litDormer ? (v < 5 ? 'ocreS' : 'ocre') : 'nuit') : 'pierreL';
          if (inGlass && (s === 6 || s === 7 || v === 8)) key = 'pierreL';
          if (v >= 14) key = v === 14 ? 'nuit2' : 'neige'; // le chapeau de neige
          if (v >= 15 && (s < 1 + (v - 15) || s > 12 - (v - 15))) continue;
          if (alongX) { const a = 23 + s, b = CELL - 9; const [x, y] = project(a, b, dz + v); put(x, y, key); }
          else { const a = CELL - 9, b = 37 - s; const [x, y] = project(a, b, dz + v); put(x, y, key === 'pierreL' ? 'pierre' : key); }
        }
      }
    }
    // Les cheminées, sur le faîtage
    const nCh = hash(i, j, 41, seed) < 0.5 ? 1 : 0;
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

// Une fenêtre de 18 × 30 px, volets, appui et linteau, de la neige sur l'appui
function windowPixel(u, v, key, T, shutters, isLit, barred, face) {
  const x0 = 21, x1 = 38, y0 = 12, y1 = 41;
  if (barred) { if (v < 14 || v > 34) return null; }
  const vy0 = barred ? 16 : y0, vy1 = barred ? 34 : y1;
  if (u >= x0 && u <= x1 && v >= vy0 && v <= vy1) {
    if (shutters === 'closed' && !barred) return (v % 2 ? 'nuit2' : (face === 'A' ? 'ardoise' : 'nuit2'));
    if (u === x0 || u === x1 || v === vy0 || v === vy1) return T.frame;
    if (barred && u % 4 === 1) return 'nuit2';
    if (u === 29 || u === 30 || v === 22 || v === 32) return isLit ? 'ocreS' : T.frame;
    if (isLit) return v < vy0 + 3 ? 'ocreS' : 'ocre';
    return (u + v) % 11 === 0 ? 'nuit2' : 'nuit';
  }
  if (!barred && shutters === 'open' && v >= y0 && v <= y1 && ((u >= 13 && u <= 20) || (u >= 39 && u <= 46))) {
    return v % 2 ? 'nuit2' : (face === 'A' ? 'ardoise' : 'nuit2');
  }
  // l'appui, la neige dessus ; le linteau, la neige dessus
  if (u >= 19 && u <= 40) {
    if (v === vy0 - 3) return T.dark;
    if (v === vy0 - 2) return T.frame;
    if (v === vy0 - 1 && !(barred)) return T.snow;
    if (v === vy1 + 1) return T.mid;
    if (v === vy1 + 2 && u >= 20 && u <= 39) return T.snow;
  }
  return null;
}

// Une porte de 20 × 44 px, cintrée, sur une marche
function doorPixel(u, v, key, T, face) {
  const x0 = 20, x1 = 39;
  if (v < 3 && u >= 17 && u <= 42) return v === 2 ? T.snow : T.dark;
  if (u < x0 - 1 || u > x1 + 1 || v > 47) return null;
  const arch = v >= 44 && (u - x0 < v - 44 || x1 - u < v - 44);
  if (u === x0 - 1 || u === x1 + 1 || v === 47 || (v >= 43 && arch)) return T.dark;
  if (arch) return null;
  if (u === 29 || u === 30) return 'nuit';
  if (u === 33 && v === 22) return 'ocreS'; // le heurtoir
  const inPanel = ((u > 21 && u < 28) || (u > 31 && u < 38)) && ((v > 6 && v < 22) || (v > 25 && v < 40));
  const edge = ((u === 22 || u === 27 || u === 32 || u === 37) && ((v > 6 && v < 22) || (v > 25 && v < 40)))
    || ((v === 7 || v === 21 || v === 26 || v === 39) && ((u > 21 && u < 28) || (u > 31 && u < 38)));
  if (edge) return face === 'A' ? 'brunC' : 'brun';
  return inPanel ? 'brun' : (face === 'A' ? 'brun' : 'nuit2');
}

// La porte cochère : 32 × 50 px, un arc, deux battants
function cocherePixel(u, v, key, T, face) {
  const x0 = 14, x1 = 45, top = 50;
  if (u < x0 - 1 || u > x1 + 1 || v > top + 1) return null;
  const cx = 29.5, rx = 16.5, dy = v - 38;
  const inArch = dy <= 0 || ((u - cx) / rx) ** 2 + (dy / 12) ** 2 <= 1;
  const onRim = !inArch && (((u - cx) / (rx + 1.2)) ** 2 + (dy / 13.2) ** 2 <= 1);
  if (onRim || (inArch && (u === x0 - 1 || u === x1 + 1))) return T.dark;
  if (!inArch) return null;
  if (u === 29 || u === 30) return 'nuit';
  if (v < 2) return T.snow;
  if ((u - x0) % 4 === 0) return 'nuit2';
  return face === 'A' ? 'brun' : 'nuit2';
}

// La boutique : une devanture en bois, des petits carreaux, l'enseigne
function shopPixel(u, v, key, T, isLit, r, face) {
  if (u < 5 || u > 54 || v > 50) return null;
  if (v >= 43) {
    if (v === 50) return T.snow;
    if (v === 43 || v === 49) return 'nuit2';
    // des lettres d'enseigne, pixels d'ocre
    if (v >= 45 && v <= 47 && u > 9 && u < 50 && hash(u, v, Math.floor(r * 1000), 51) < 0.45) return 'ocreS';
    return 'brun';
  }
  if (v < 4) return v === 3 ? T.snow : 'brun';
  if (u === 5 || u === 54 || v === 4 || v === 42) return 'brun';
  // la porte de la boutique, au milieu
  if (u >= 26 && u <= 33) return u === 26 || u === 33 ? 'brun' : (v > 8 && isLit ? 'ocreS' : 'nuit');
  if ((u - 5) % 7 === 0 || (v - 4) % 10 === 0) return face === 'A' ? 'brunC' : 'brun';
  if (v < 12) return 'brun';
  return isLit ? (v > 36 ? 'ocreS' : 'ocre') : 'nuit';
}
