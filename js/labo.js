/* Le labo : des pistes pour la suite (Paris, la Commune), à comparer une à une. Chaque sujet
   commence par A, ce que le jeu fait aujourd'hui ; les autres lettres sont
   des idées, chacune avec une vignette animée (dans la palette du jeu) et
   ce qu'elle changerait. Rien n'est lu ni écrit dans le navigateur.

   Ajouter une idée = ajouter une entrée dans TOPICS (et sa vignette). */
import { PAL } from './palette.js?v=1.4.0';
import { drawPierre, drawNote } from './sprites.js?v=1.4.0';
import { ATLAS, POSE_ROWS } from './rat-sprites.js?v=1.4.0';
import { hash } from './city.js?v=1.4.0';

const W = 320, H = 180;

// ─── Petits outils de dessin (vue de face, comme une scène de théâtre) ───
const px = (g, x, y, key, w = 1, h = 1) => { g.fillStyle = PAL[key]; g.fillRect(Math.round(x), Math.round(y), w, h); };
function night(g, t) {
  px(g, 0, 0, 'nuit', W, H);
  for (let k = 0; k < 70; k++) {
    const x = (hash(k, 1) * W + t * (4 + hash(k, 2) * 6)) % W, y = (hash(k, 3) * H + t * (8 + hash(k, 4) * 10)) % H;
    px(g, x, y, 'neige');
  }
}
// Une rangée de façades haussmanniennes, de face : refends, fenêtres alignées, comble
function facades(g, y0, seed = 1, litBy = null) {
  let x = -10;
  while (x < W) {
    const w = 52 + Math.floor(hash(x, seed) * 20), floors = 4 + Math.floor(hash(x, seed, 2) * 2);
    const top = y0 - floors * 16;
    px(g, x, top, 'pierreL', w, y0 - top);
    px(g, x, top - 10, 'ardoise', w, 10);          // le comble
    px(g, x, top - 11, 'neige', w, 2);
    for (let b = 0; b < w - 10; b += 12) px(g, x + 6 + b, top - 8, 'nuit', 4, 5); // lucarnes
    for (let f = 0; f < floors; f++) {
      const fy = top + f * 16;
      if (f === 1 || f === floors - 1) px(g, x, fy + 14, 'nuit', w, 1); // balcons filants
      for (let b = 0; b < w - 10; b += 12) {
        const lit = litBy ? litBy(x + 6 + b, f) : hash(x, b, f, seed) < 0.18;
        px(g, x + 6 + b, fy + 3, lit ? 'ocre' : 'nuit', 5, 10);
      }
    }
    px(g, x, y0 - 14, 'pierre', w, 14);           // le rez-de-chaussée
    for (let r = y0 - 12; r < y0; r += 4) px(g, x, r, 'pierreS', w, 1);
    for (let b = 8; b < w - 14; b += 20) px(g, x + b, y0 - 12, 'nuit', 10, 12);
    x += w + 1;
  }
}
const groundBand = (g, y0, key = 'neigeM') => px(g, 0, y0, key, W, H - y0);
const pierre = (g, x, y, pose = 'play', t = 0, dir = 1) => drawPierre(g, x, y, { pose, t, dir, shadow: false, silhouette: true });
function rat(g, x, y, t, dir = 1, k = 0, pose = null) {
  const set = pose ? ATLAS[pose] : ATLAS.side;
  const s = set[((t * 10 + k) | 0) % set.length][dir < 0 ? 1 : 0];
  g.drawImage(s.c, Math.round(x - s.ax), Math.round(y - s.ay));
}
// Un rat d'une autre couleur (la colonie rivale)
function paleRat(g, x, y, t, dir, k) {
  const rows = POSE_ROWS.side[((t * 10 + k) | 0) % 3], w = rows[0].length;
  for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < w; xx++) {
    if (rows[yy][xx] === '.') continue;
    px(g, x - 5 + (dir < 0 ? w - 1 - xx : xx), y - rows.length + yy, rows[yy][xx] === 'c' ? 'neige' : 'neigeO');
  }
}
// Une nuée qui grouille autour d'un point
function swarm(g, cx, cy, n, t, rx = 30, ry = 10, seed = 0) {
  for (let k = 0; k < n; k++) {
    const a = hash(k, seed) * 6.28 + t * (0.4 + hash(k, 5) * 0.8) * (k % 2 ? 1 : -1);
    const r = Math.sqrt(hash(k, 6, seed));
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    const pose = hash(k, 7) < 0.08 ? 'rear' : null;
    rat(g, x, y, t, Math.sin(a) > 0 ? -1 : 1, k, pose);
  }
}
function notes(g, x, y, t) {
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.6 + k / 4) % 1;
    drawNote(g, x + p * 14 + Math.sin(p * 8 + k) * 3, y - p * 34, k % 2, p > 0.7 ? (p - 0.7) * 3 : 0);
  }
}

// ─── Les vignettes ───
const ART = {
  now(g, t) {
    night(g, t); facades(g, 110, 3); groundBand(g, 110);
    swarm(g, 160, 150, 40, t, 70, 16);
    pierre(g, 160, 150, 'play', t); notes(g, 168, 126, t);
  },
  // ─ Scénarios ─
  siege(g, t) {
    night(g, t); facades(g, 110, 21); groundBand(g, 110);
    // l'étal du marchand : des rats pendus sous l'enseigne
    px(g, 60, 70, 'neige', 50, 8); px(g, 64, 72, 'nuit', 42, 4);
    for (let k = 0; k < 6; k++) { px(g, 64 + k * 8, 78, 'nuit', 1, 6); rat(g, 64 + k * 8, 92, 0, 1, 0, 'rear'); }
    // le chasseur et son filet
    const hx = 190 + Math.sin(t * 0.8) * 30;
    px(g, hx, 126, 'nuit', 8, 26); px(g, hx - 2, 122, 'nuit', 12, 5);
    for (let k = 0; k < 7; k++) px(g, hx + 8 + k * 2, 124 - k * 3, 'neigeO', 1, 1);
    // la nuée file se cacher dans la bouche d'égout
    px(g, 250, 156, 'nuit', 14, 3);
    for (let k = 0; k < 18; k++) { const p = (t * 0.4 + k / 18) % 1; rat(g, 120 + p * 130, 156 + Math.sin(k) * 4, t, 1, k); }
    pierre(g, 110, 150, 'stand', t);
  },
  canons(g, t) {
    night(g, t);
    // la butte Montmartre, les canons sur la crête
    for (let x = 0; x < W; x++) { const y = 70 + Math.pow((x - 220) / 120, 2) * 70; px(g, x, Math.min(H, y), 'neigeM', 1, H - y); }
    for (const cx of [190, 225, 260]) { px(g, cx - 10, 66, 'nuit', 20, 4); px(g, cx - 6, 70, 'nuit', 4, 6); px(g, cx + 2, 70, 'nuit', 4, 6); px(g, cx + 8, 62, 'nuit', 14, 3); }
    // les soldats reculent, la foule et les rats montent
    for (let k = 0; k < 40; k++) { const p = (t * 0.15 + k / 40) % 1; rat(g, 40 + p * 140, 150 - p * 70 + Math.sin(k) * 4, t, 1, k); }
    for (let k = 0; k < 5; k++) { const x = 30 + k * 18 + (t * 8) % 18; pierre(g, x, 160 - k * 2, 'walk', t + k); }
    notes(g, 40, 130, t);
  },
  semaine(g, t) {
    night(g, t);
    // les façades en feu : des fenêtres qui vacillent
    facades(g, 110, 23, (x, f) => hash(x, f, Math.floor(t * 6)) < 0.35);
    groundBand(g, 110);
    // la barricade : pavés, tonneaux, une roue ; un drapeau qui claque au-dessus
    for (let k = 0; k < 60; k++) px(g, 120 + hash(k, 1) * 80, 138 + hash(k, 2) * 18 - Math.sin((hash(k, 1)) * 3.14) * 18, 'pierreL', 5, 3);
    px(g, 150, 100, 'nuit', 1, 30);
    for (let y = 0; y < 10; y++) px(g, 151, 100 + y, 'ocre', 14 + Math.round(Math.sin(t * 6 + y * 0.6) * 2), 1);
    // les rats passent sous la barricade, Pierre les attend de l'autre côté
    for (let k = 0; k < 20; k++) { const p = (t * 0.3 + k / 20) % 1; rat(g, 40 + p * 240, 165 + Math.sin(k) * 3, t, 1, k); }
    pierre(g, 260, 162, 'play', t); notes(g, 268, 138, t);
  },
  hamelin(g, t) { ART.prefet(g, t); },
  prefet(g, t) {
    night(g, t); facades(g, 110, 5); groundBand(g, 110);
    px(g, 228, 70, 'pierreL', 70, 40); px(g, 252, 80, 'ocre', 22, 30);
    px(g, 259, 86, 'nuit', 8, 24); px(g, 256, 82, 'nuit', 14, 4);
    const k = (t * 0.25) % 1, bx = 250 - Math.min(1, k * 2) * 30 + Math.max(0, k * 2 - 1) * 30;
    px(g, bx, 100, 'neige', 6, 6); px(g, bx + 2, 98, 'neige', 2, 2);
    swarm(g, 110, 150, 28, t, 50, 12);
    pierre(g, 150, 150, 'stand', t);
  },
  // ─ Personnages ─
  louise(g, t) {
    night(g, t); facades(g, 110, 25); groundBand(g, 110);
    // des affiches collées au mur
    for (let k = 0; k < 4; k++) { px(g, 40 + k * 22, 84, 'neige', 16, 20); for (let l = 0; l < 5; l++) px(g, 42 + k * 22, 87 + l * 3, 'neigeO', 12, 1); }
    // Louise : longue robe, un livre sous le bras, elle montre une affiche
    const lx = 170;
    px(g, lx, 112, 'nuit', 10, 8); px(g, lx - 2, 120, 'nuit', 14, 32); px(g, lx - 4, 140, 'nuit', 18, 12);
    px(g, lx + 2, 104, 'nuit', 6, 8); px(g, lx + 10, 122, 'neige', 6, 4);
    px(g, lx - 6, 118 + Math.round(Math.sin(t * 2)), 'nuit', 8, 2);
    pierre(g, 210, 152, 'stand', t, -1);
    swarm(g, 250, 160, 12, t, 30, 6);
  },
  gavroche(g, t) {
    night(g, t); facades(g, 110, 27); groundBand(g, 110);
    // Victor court, une miche sous le bras ; Pierre et les rats derrière lui
    const run = (t * 60) % 400 - 40;
    g.save(); g.translate(run, 156); g.scale(0.85, 0.85); pierre(g, 0, 0, 'walk', t * 2); g.restore();
    px(g, run + 3, 140, 'neige', 5, 3);
    pierre(g, run - 50, 156, 'walk', t * 1.5);
    for (let k = 0; k < 14; k++) rat(g, run - 70 - k * 9, 160 + Math.sin(k + t * 4) * 3, t * 2, 1, k);
  },
  marchand(g, t) {
    night(g, t); facades(g, 110, 29); groundBand(g, 110);
    // les cages empilées, un rat dans chacune ; le marchand en tablier
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = 60 + c * 22, y = 100 + r * 20;
      px(g, x, y, 'pierreL', 20, 18);
      rat(g, x + 10, y + 16, t, 1, r * 4 + c, (r + c) % 2 ? 'rear' : null);
      for (let b = 0; b < 20; b += 3) px(g, x + b, y, 'nuit', 1, 18);
    }
    px(g, 170, 116, 'nuit', 12, 36); px(g, 168, 108, 'nuit', 14, 8); px(g, 172, 126, 'neigeM', 8, 20);
    // une cage ouverte : un rat s'échappe vers Pierre
    const p = (t * 0.3) % 1;
    rat(g, 150 + p * 100, 164, t, 1, 3);
    pierre(g, 260, 162, 'play', t); notes(g, 268, 138, t);
  },
  aeronaute(g, t) {
    night(g, t); facades(g, 140, 31); groundBand(g, 140);
    // le ballon monté s'élève au-dessus des toits
    const y = 90 - ((t * 6) % 60);
    for (let dy = -30; dy <= 30; dy++) { const w = Math.round(Math.sqrt(900 - dy * dy)); px(g, 160 - w, y + dy, 'neige', w * 2, 1); }
    for (let k = -2; k <= 2; k++) px(g, 160 + k * 10, y - 10, 'neigeO', 1, 40);
    px(g, 150, y + 45, 'nuit', 20, 10); px(g, 152, y + 38, 'nuit', 1, 8); px(g, 167, y + 38, 'nuit', 1, 8);
    // des pigeons voyageurs autour
    for (let k = 0; k < 5; k++) px(g, 120 + ((t * 30 + k * 40) % 120), y - 20 + k * 6 + Math.sin(t * 8 + k) * 2, 'neige', 2, 1);
    pierre(g, 70, 172, 'stand', t);
  },
  // ─ Objets ─
  barricades(g, t) { ART.semaine(g, t); },
  ballon(g, t) {
    night(g, t);
    // Paris vu du ballon : les îlots, la Seine, l'ombre du ballon qui glisse
    for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) {
      const water = j === 5;
      px(g, 8 + i * 19, 8 + j * 19, water ? 'nuit2' : hash(i, j, 9) < 0.35 ? 'neigeM' : 'pierreL', 18, 18);
    }
    const bx = (t * 20) % 340 - 20;
    for (let dy = -6; dy <= 6; dy++) { const w = Math.round(Math.sqrt(36 - dy * dy)); px(g, bx - w, 100 + dy, 'nuit', w * 2, 1); }
  },
  marmite(g, t) {
    night(g, t); facades(g, 110, 33); groundBand(g, 110);
    // la marmite de la cantine, sa vapeur ; la queue des affamés ; la carte de rationnement
    px(g, 140, 140, 'nuit', 30, 18); px(g, 136, 138, 'nuit', 38, 3);
    for (let k = 0; k < 6; k++) { const p = (t * 0.5 + k / 6) % 1; px(g, 148 + Math.sin(p * 9 + k) * 6, 134 - p * 40, p > 0.6 ? 'neigeO' : 'neigeM', 3, 3); }
    for (let k = 0; k < 6; k++) { px(g, 190 + k * 18, 128, 'nuit', 8, 26); px(g, 191 + k * 18, 122, 'nuit', 6, 6); }
    px(g, 30, 30, 'neige', 60, 36); for (let l = 0; l < 6; l++) px(g, 34, 36 + l * 5, l % 2 ? 'neigeO' : 'nuit2', 52, 2);
    swarm(g, 100, 162, 10, t, 30, 5);
  },
  partitions(g, t) {
    night(g, t); groundBand(g, 70);
    const phase = Math.floor(t / 3) % 3, k0 = (t % 3) / 3;
    const ease = Math.min(1, k0 * 2.5);
    const shape = (s, k, n) => {
      const a = k / n * 6.28;
      if (s === 0) return [160 + Math.cos(a) * 60, 125 + Math.sin(a) * 30];
      if (s === 1) return [40 + k / n * 240, 125];
      const r = k / n; return [100 + r * 140, 125 + (r < 0.5 ? -1 : 1) * (Math.abs(r - 0.5) * 2 - 1) * 30 * (k % 2 ? 1 : -1)];
    };
    const n = 48;
    for (let k = 0; k < n; k++) {
      const [x0, y0] = shape((phase + 2) % 3, k, n), [x1, y1] = shape(phase, k, n);
      rat(g, x0 + (x1 - x0) * ease, y0 + (y1 - y0) * ease, t, x1 >= x0 ? 1 : -1, k);
    }
    for (let k = 0; k < 3; k++) drawNote(g, 130 + k * 22, 20 + ((phase + k) % 3) * 6, (phase + k) % 2);
    pierre(g, 160, 128, 'play', t);
  },
  // ─ Bâtiments ─
  hotelville(g, t) {
    night(g, t);
    // l'Hôtel de Ville : un long palais, ses pavillons, le beffroi ; le feu aux fenêtres
    px(g, 30, 60, 'pierreL', 260, 90); px(g, 30, 50, 'ardoise', 50, 10); px(g, 240, 50, 'ardoise', 50, 10);
    px(g, 145, 26, 'pierreL', 30, 34); px(g, 150, 14, 'ardoise', 20, 12);
    for (let f = 0; f < 4; f++) for (let c = 0; c < 18; c++) {
      const fire = hash(c, f, Math.floor(t * 8)) < 0.5;
      px(g, 40 + c * 14, 68 + f * 20, fire ? 'ocre' : 'nuit', 6, 12);
    }
    for (let k = 0; k < 30; k++) { const p = (t * 0.4 + k / 30) % 1; px(g, 40 + hash(k, 1) * 240, 60 - p * 60, p > 0.5 ? 'neigeO' : 'neigeM', 4, 4); }
    groundBand(g, 150);
    swarm(g, 160, 168, 20, t, 120, 6);
  },
  halles(g, t) {
    night(g, t); groundBand(g, 130);
    // les pavillons de fer et de verre, éclairés de l'intérieur
    for (const x of [20, 120, 220]) {
      px(g, x, 60, 'nuit', 80, 70);
      for (let c = 0; c < 80; c += 8) px(g, x + c, 70, 'ocre', 6, 50);
      for (let c = 0; c < 80; c += 8) px(g, x + c, 60, 'pierreS', 2, 70);
      for (let y = 0; y < 14; y++) px(g, x + y * 3, 46 + y, 'neige', 80 - y * 6, 1);
    }
    swarm(g, 160, 150, 40, t, 140, 12);
  },
  vendome(g, t) {
    night(g, t); facades(g, 140, 35); groundBand(g, 140);
    // la colonne s'abat, l'Empereur en tête
    const a = Math.min(1.45, ((t * 0.4) % 2.4) * 1.0);
    g.save(); g.translate(160, 150); g.rotate(-a);
    px(g, -6, -120, 'pierreL', 12, 120); for (let y = -120; y < 0; y += 10) px(g, -6, y, 'pierreS', 12, 2);
    px(g, -3, -132, 'nuit', 6, 12); g.restore();
    px(g, 140, 150, 'pierre', 40, 10);
    swarm(g, 230, 162, 24, t, 60, 8);
  },
  couvert(g, t) {
    px(g, 0, 0, 'nuit', W, H);
    // un passage couvert : la verrière, les boutiques éclairées des deux côtés, les dalles
    for (let y = 0; y < 40; y++) px(g, 160 - (40 - y) * 4, y, y % 6 === 0 ? 'pierreS' : 'neigeO', (40 - y) * 8, 1);
    for (let k = 0; k < 5; k++) {
      const d = k * 26, w = 40 - k * 6;
      px(g, 20 + d * 0.9, 50 + k * 4, 'ocre', w, 70 - k * 10); px(g, 300 - d * 0.9 - w, 50 + k * 4, 'ocre', w, 70 - k * 10);
      px(g, 20 + d * 0.9, 46 + k * 4, 'nuit2', w, 4); px(g, 300 - d * 0.9 - w, 46 + k * 4, 'nuit2', w, 4);
    }
    for (let y = 120; y < H; y += 6) px(g, 0, y, 'pierreL', W, 3);
    swarm(g, 160, 160, 20, t, 60, 10);
    pierre(g, 160, 150, 'walk', t);
  },
  // ─ Urbanisme ─
  egouts(g, t) {
    night(g, t);
    facades(g, 60, 15);
    px(g, 0, 60, 'neigeM', W, 18);
    px(g, 0, 78, 'nuit2', W, H - 78);
    px(g, 0, 118, 'neigeO', W, 34);
    px(g, 0, 116, 'pierreS', W, 2); px(g, 0, 152, 'pierreS', W, 2);
    for (const gx of [60, 250]) { px(g, gx, 76, 'nuit', 14, 2); px(g, gx + 4, 78, 'nuit', 6, 40); }
    for (let k = 0; k < 40; k++) {
      const p = (t * 0.25 + k / 40) % 1;
      let x, y;
      if (p < 0.15) { x = 66; y = 78 + p / 0.15 * 66; }
      else if (p < 0.85) { x = 66 + (p - 0.15) / 0.7 * 190; y = 146; }
      else { x = 256; y = 146 - (p - 0.85) / 0.15 * 70; }
      rat(g, x + Math.sin(k) * 3, y, t, 1, k, p < 0.15 ? 'down' : p >= 0.85 ? 'up' : null);
    }
    pierre(g, 30, 74, 'play', t); notes(g, 38, 50, t);
  },
  toits(g, t) {
    night(g, t);
    // une mer de toits de zinc, de cheminées ; Pierre marche sur le faîte
    for (let k = 0; k < 6; k++) {
      const x = k * 60 - 20, y = 90 + (k % 2) * 12;
      for (let r = 0; r < 30; r++) px(g, x + r, y + 30 - r, 'neigeM', 60 - r * 2 > 0 ? 60 : 0, 1);
      px(g, x, y + 30, 'pierreL', 64, 60);
      for (let c = 0; c < 3; c++) { px(g, x + 8 + c * 18, y - 4, 'pierreL', 6, 14); px(g, x + 8 + c * 18, y - 5, 'neige', 6, 1); }
    }
    const wx = (t * 25) % 360 - 20;
    pierre(g, wx, 96, 'walk', t);
    for (let k = 0; k < 10; k++) rat(g, wx - 16 - k * 9, 98, t, 1, k);
  },
  percee(g, t) {
    px(g, 0, 0, 'nuit', W, H);
    // vu de dessus : le vieux Paris en lacis, la percée droite du boulevard
    for (let j = 0; j < 18; j++) for (let i = 0; i < 32; i++) {
      const boul = Math.abs(j - 9 - (i - 16) * 0.2) < 1.2;
      const lane = hash(i, j, 3) < 0.28;
      px(g, i * 10, j * 10, boul ? 'neigeM' : lane ? 'neigeO' : 'pierreL', 9, 9);
    }
    const p = (t * 0.1) % 1;
    for (let k = 0; k < 20; k++) { const q = (p + k / 20) % 1; rat(g, q * 320, 92 + (q * 320 - 160) * 0.2, t, 1, k); }
  },
  seine(g, t) {
    night(g, t); facades(g, 72, 7);
    px(g, 0, 72, 'neigeO', W, 14);
    px(g, 0, 86, 'neigeO', W, H - 86);
    for (let k = 0; k < 40; k++) px(g, hash(k, 9) * W, 90 + hash(k, 10) * 80, 'neigeM', 8 + hash(k, 11) * 20, 1);
    const n = 60;
    for (let k = 0; k < n; k++) {
      const x = ((k * 9 + t * 22) % (W + 60)) - 30, y = 128 + Math.sin(k * 1.7) * 8;
      rat(g, x, y, t, 1, k);
    }
    const c = (t * 0.2) % 1;
    let x = 200, y = 100;
    for (let s = 0; s < c * 90; s++) { x += hash(s, 1) * 3 - 0.6; y += hash(s, 2) * 2 - 0.5; px(g, x, y, 'nuit', 2, 1); if (s % 9 === 0) px(g, x, y + 1, 'nuit', 1, 3); }
    pierre(g, 40, 84, 'play', t); notes(g, 48, 60, t);
  },
};

// ─── Les sujets et leurs variantes (A : le jeu d'aujourd'hui) ───
const NOW = {
  title: 'Aujourd\'hui : l\'hiver du siège, on erre', pitch: 'Paris, janvier 1871. Pierre marche dans les rues, au bord de la Seine, joue, et les rats sortent des égouts pour le suivre. Pas encore de but : c\'est la base sur laquelle bâtir.',
  art: 'now', tag: 'actuelle',
  cols: ['Une ambiance : la nuit, la neige, Paris assiégé ; le monde à hauteur d\'enfant.', 'Marcher, jouer, regarder la nuée grossir et grouiller.', 'Rien : c\'est l\'état du jeu (v1.4.0).'],
};
const TOPICS = [
  {
    id: 'scenarios', icon: 'ti-flag', title: 'Scénarios : la Commune',
    variants: [
      NOW,
      { title: 'Le siège', art: 'siege', pitch: 'Janvier 1871 : la ville affamée mange ses rats. Les chasseurs posent des pièges, les marchands vendent le rat au poids. Pierre doit cacher son armée, ou la nourrir avant qu\'on ne la mange.',
        cols: ['Le vrai Paris du siège : boucheries de rats, éléphants du Jardin des plantes mangés, la peur de la faim. Pierre protège ce que tous veulent manger.', 'Furtivité : éviter chasseurs et pièges, passer par les égouts ; chaque rat perdu est un rat mangé.', 'Des chasseurs (petite IA), des pièges, des cachettes. La nuée et les égouts servent déjà.'] },
      { title: 'Le 18 mars : les canons de Montmartre', art: 'canons', pitch: 'À l\'aube, l\'armée vient reprendre les canons de la butte. Les femmes de Montmartre s\'interposent… et les rats de Pierre font cabrer les chevaux. La Commune commence.',
        cols: ['Le premier jour de la Commune, vu par un enfant : une foule, des soldats qui fraternisent, des canons qu\'on garde.', 'Un niveau de foule : diriger la nuée contre les attelages, sans blesser personne ; un chrono jusqu\'au lever du jour.', 'Une butte (relief), des canons, des chevaux, une foule. Coût moyen.'] },
      { title: 'La Semaine sanglante', art: 'semaine', pitch: 'Mai 1871 : les Versaillais reprennent Paris rue par rue. Barricades, incendies. Pierre guide des fugitifs par les égouts, ses rats en éclaireurs.',
        cols: ['La fin tragique de la Commune, à hauteur d\'enfant : se cacher, sauver qui on peut. Une fin grave.', 'Escorte et repérage : la nuée part devant, signale les patrouilles, ouvre les passages.', 'Des barricades, des incendies, des fugitifs à guider. Le plus ambitieux.'] },
      { title: 'Le joueur de flûte de la Commune', art: 'hamelin', pitch: 'Le conte de Hamelin rejoué : la Commune promet du pain à qui délivrera les quartiers des rats. Pierre les mène hors de Paris… et la promesse n\'est pas tenue. Que fait-il de sa colère ?',
        cols: ['Le conte, fidèle et sombre : la promesse, l\'exode, la trahison, puis un choix.', 'Rassembler les rats de chaque quartier, puis les conduire hors des murs (la Seine gelée ?).', 'Des personnages, quelques dialogues, une fin. Peu de nouvelles mécaniques.'] },
    ],
  },
  {
    id: 'personnages', icon: 'ti-users', title: 'Personnages secondaires',
    variants: [
      NOW,
      { title: 'Louise, l\'institutrice', art: 'louise', pitch: 'Inspirée de Louise Michel : elle apprend à Pierre à lire les affiches, soigne sur les barricades, et lui confie des messages à porter là où les adultes ne passent pas.',
        cols: ['Une figure de la Commune, généreuse et têtue, qui prend Pierre sous son aile.', 'Une donneuse de quêtes : lire une affiche, porter un pli, trouver un enfant perdu.', 'Un personnage, des dialogues, des affiches lisibles.'] },
      { title: 'Victor, le gamin des rues', art: 'gavroche', pitch: 'Un Gavroche de douze ans, voleur de pain, rapide comme un rat. Rival au début (il chasse les rats pour les vendre), allié ensuite.',
        cols: ['Un double de Pierre, plus dur, plus drôle. Leur amitié est le cœur du récit.', 'Des courses-poursuites dans les ruelles ; plus tard, il ouvre des portes que Pierre ne sait pas ouvrir.', 'Un personnage qui court, une petite IA de poursuite.'] },
      { title: 'Le marchand de rats', art: 'marchand', pitch: 'Il achète les rats au poids et les revend aux affamés. Ses cages s\'empilent derrière l\'étal. L\'adversaire du siège : libérer ses prisonniers grossit l\'armée.',
        cols: ['Un antagoniste humain, pas méchant : la faim le pousse. On peut le convaincre, ou le ruiner.', 'Des cages à ouvrir sans se faire voir ; la nuée libérée rejoint Pierre d\'un coup.', 'Un étal, des cages, un personnage qui surveille.'] },
      { title: 'L\'aéronaute', art: 'aeronaute', pitch: 'Pendant le siège, des ballons montés quittent Paris avec le courrier et des pigeons. L\'aéronaute cherche un mousse… et des rats pour ronger les cordes d\'un rival ?',
        cols: ['La part de rêve du siège : s\'envoler au-dessus des lignes prussiennes.', 'Une mission spéciale qui mène à la vue de dessus de Paris (le plan de l\'atelier, en jeu).', 'Un ballon, une scène en l\'air, la carte de Paris vue d\'en haut.'] },
    ],
  },
  {
    id: 'objets', icon: 'ti-backpack', title: 'Objets',
    variants: [
      NOW,
      { title: 'Les barricades', art: 'barricades', pitch: 'Pavés, tonneaux, charrettes renversées : les barricades ferment les rues. Pierre passe par-dessous avec les rats, ou les aide à en bâtir… ou à en défaire.',
        cols: ['Le paysage de la Commune : la rue qui se ferme, se défend, s\'ouvre.', 'Des obstacles qui changent la carte ; la nuée peut creuser sous les pavés.', 'Un objet de mobilier qui bloque une rue, posé dans l\'atelier.'] },
      { title: 'Le ballon monté', art: 'ballon', pitch: 'Un ballon qui s\'élève au-dessus de Paris : la ville vue d\'en haut, ses îlots, la Seine. Un moment de calme, et une carte.',
        cols: ['Le seul moment où l\'enfant voit la ville entière : une respiration.', 'La carte de Paris : choisir le prochain quartier, voir où sont les rats.', 'La vue de dessus de l\'atelier, en jeu ; un petit vol.'] },
      { title: 'La marmite et la carte de rationnement', art: 'marmite', pitch: 'La cantine municipale, la queue des affamés, la carte de rationnement. Ce que mange Pierre, ce que mangent les rats : une économie de la faim.',
        cols: ['La faim du siège, concrète : une louche de soupe, un morceau de pain noir.', 'Une ressource : nourrir l\'armée ou soi-même ; sans pain, des rats désertent.', 'Une jauge, des cantines dans le quartier, une carte à remplir.'] },
      { title: 'Les airs de la flûte', art: 'partitions', pitch: 'Chaque petit air de trois notes est un ordre : venir, attendre, encercler, foncer, se disperser. On les joue au clavier ou au pouce, en rythme.',
        cols: ['La flûte n\'est plus un simple appel : c\'est la langue de Pierre avec ses rats.', 'Composer des ordres en rythme ; la nuée prend des formes. Se marie avec toutes les idées.', 'Un lecteur de séquences, des buts de formation dans la simulation.'] },
    ],
  },
  {
    id: 'batiments', icon: 'ti-building', title: 'Bâtiments',
    variants: [
      { ...NOW, title: 'Aujourd\'hui : immeubles, maisons, Notre-Dame', pitch: 'Le générateur fait déjà des immeubles haussmanniens (boutiques, portes cochères, cafés, balcons au 2e et au 5e), de vieilles maisons parisiennes, Notre-Dame sur l\'île de la Cité, des passages.' },
      { title: 'L\'Hôtel de Ville en flammes', art: 'hotelville', pitch: 'Le 24 mai 1871, l\'Hôtel de Ville brûle. Un monument immense, ses pavillons, son beffroi, le feu à toutes les fenêtres : le décor de la fin.',
        cols: ['L\'image la plus forte de la Semaine sanglante, vue d\'en bas.', 'Un lieu à traverser pendant l\'incendie, ou à fuir.', 'Un monument sur plusieurs cases (comme Notre-Dame), un feu animé.'] },
      { title: 'Les Halles de Baltard', art: 'halles', pitch: 'Les pavillons de fer et de verre du « ventre de Paris », éclairés la nuit. Pendant le siège, presque vides ; pour les rats, un paradis.',
        cols: ['Le marché de Zola, en hiver de famine.', 'Un lieu de nourriture, plein de cachettes, de rats rivaux ?', 'Un bâtiment de verre et de fonte : un nouveau style au générateur.'] },
      { title: 'La colonne Vendôme abattue', art: 'vendome', pitch: 'Le 16 mai 1871, la Commune abat la colonne de l\'Empereur sur un lit de fumier. La foule regarde ; les rats aussi.',
        cols: ['Un événement réel, spectaculaire, symbolique.', 'Une scène : un attroupement, un fracas, une course.', 'Une colonne, une animation de chute, une foule.'] },
      { title: 'Le passage couvert', art: 'couvert', pitch: 'Plus qu\'une arche : une galerie sous verrière, bordée de boutiques éclairées. Un abri contre la neige, un raccourci, un repaire.',
        cols: ['Le Paris des passages (Choiseul, Panoramas) : la ville a des intérieurs.', 'Un intérieur à traverser, chaud et lumineux, qui coupe un îlot.', 'Un nouveau rendu : intérieur vu en coupe. Coût moyen.'] },
    ],
  },
  {
    id: 'urbanisme', icon: 'ti-map', title: 'Urbanisme',
    variants: [
      NOW,
      { title: 'Les égouts de Belgrand', art: 'egouts', pitch: 'Sous la ville neuve, le réseau d\'égouts de Belgrand : galeries, puits, raccourcis. La nuée y passe et ressort trois rues plus loin ; Pierre, lui, fait le tour.',
        cols: ['Le Paris souterrain, le royaume des rats ; un refuge pendant la Semaine sanglante.', 'Un réseau à maîtriser : envoyer la nuée dessous, la rappeler ailleurs.', 'Une seconde grille (les égouts), un rendu en coupe ou un calque. Coût moyen à fort.'] },
      { title: 'Les toits de Paris', art: 'toits', pitch: 'Par une lucarne, Pierre monte sur les toits : le zinc, les cheminées, les rues en contrebas. Un autre chemin, loin des patrouilles.',
        cols: ['L\'enfant sur les toits : le seul endroit où l\'on voit loin.', 'Un deuxième niveau de déplacement, au-dessus des barricades.', 'Les faîtages comme chemins ; la nuit des étages s\'ouvre quand on y monte.'] },
      { title: 'Percée et vieux Paris', art: 'percee', pitch: 'Le boulevard haussmannien tranche le vieux quartier : d\'un côté la ligne droite, éclairée, surveillée ; de l\'autre le lacis de ruelles où l\'on se cache.',
        cols: ['Le Paris de 1871 est un chantier : la ville neuve et l\'ancienne se touchent.', 'Deux façons de passer : vite et à découvert, ou lentement et caché.', 'Le générateur sait déjà faire des maisons anciennes ; ajouter un boulevard droit et large.'] },
      { title: 'La Seine gelée', art: 'seine', pitch: 'L\'hiver 1870-1871 est terrible : la Seine charrie des glaçons. Faire passer l\'armée sur la glace, qui craque si la nuée s\'agglutine.',
        cols: ['La Seine est déjà là, avec ses quais et ses ponts : l\'hiver la change en piège.', 'Un niveau d\'adresse : étirer la nuée en file, ne jamais la laisser se masser.', 'De la glace praticable sur certaines cases, un poids de la nuée par case.'] },
    ],
  },
];

// ─── Navigation : sujet ouvert, lettre active, adresse #sujet-C ───
const $ = id => document.getElementById(id);
const LETTERS = 'ABCDEFGH';
let topic = 0, variant = 0;

function readHash() {
  const m = location.hash.slice(1).match(/^([a-z]+)-([A-Z])$/);
  if (!m) return;
  const t = TOPICS.findIndex(x => x.id === m[1]);
  if (t < 0) return;
  topic = t; variant = Math.max(0, Math.min(TOPICS[t].variants.length - 1, LETTERS.indexOf(m[2])));
}
function writeHash() { history.replaceState(null, '', `#${TOPICS[topic].id}-${LETTERS[variant]}`); }

function renderMenu() {
  $('menu').innerHTML = TOPICS.map((t, ti) => `
    <button class="topic${ti === topic ? ' on' : ''}" type="button" data-topic="${ti}">
      <i class="ti ${t.icon}" aria-hidden="true"></i><span>${t.title}</span><span class="count">${t.variants.length}</span>
    </button>
    ${ti === topic ? `<ul class="variants">${t.variants.map((v, vi) => `
      <li><button class="variant${vi === variant ? ' on' : ''}" type="button" data-variant="${vi}" aria-current="${vi === variant}">
        <span class="letter">${LETTERS[vi]}</span><span>${v.title}</span></button></li>`).join('')}</ul>` : ''}`).join('');
  $('chips').innerHTML = TOPICS.map((t, ti) => `<button class="chip${ti === topic ? ' on' : ''}" type="button" data-topic="${ti}"><i class="ti ${t.icon}" aria-hidden="true"></i>${t.title}</button>`).join('');
  const vs = TOPICS[topic].variants;
  $('bottom').innerHTML = `
    <button class="bottom-nav" type="button" data-step="-1" aria-label="Variante précédente"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
    <div class="bottom-letters">${vs.map((v, vi) => `<button class="bottom-letter${vi === variant ? ' on' : ''}" type="button" data-variant="${vi}" aria-label="${LETTERS[vi]} : ${v.title}">${LETTERS[vi]}</button>`).join('')}</div>
    <span class="bottom-title">${vs[variant].title}</span>
    <button class="bottom-nav" type="button" data-step="1" aria-label="Variante suivante"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`;
}

let artCanvas = null, artFn = null, t0 = 0;
function renderView() {
  const v = TOPICS[topic].variants[variant];
  $('view').innerHTML = `
    <div class="v-head"><span class="letter">${LETTERS[variant]}</span><h1>${v.title}</h1>${v.tag ? `<span class="v-tag">${v.tag}</span>` : ''}</div>
    <p class="v-pitch">${v.pitch}</p>
    <div class="v-art"><canvas width="${W}" height="${H}" aria-hidden="true"></canvas></div>
    <div class="v-cols">
      <section class="v-col"><h2>Le récit</h2><p>${v.cols[0]}</p></section>
      <section class="v-col"><h2>Le jeu</h2><p>${v.cols[1]}</p></section>
      <section class="v-col"><h2>Ce que ça demande</h2><p>${v.cols[2]}</p></section>
    </div>
    <p class="v-hint">Flèches ← → pour changer de variante, ↑ ↓ pour changer de sujet${matchMedia('(hover: none)').matches ? ' ; balayer sur mobile' : ''}.</p>`;
  artCanvas = $('view').querySelector('canvas');
  artFn = ART[v.art];
  t0 = performance.now();
  $('view').scrollTop = 0;
}
function show() { renderMenu(); renderView(); writeHash(); }
function go(t, v) {
  topic = (t + TOPICS.length) % TOPICS.length;
  const n = TOPICS[topic].variants.length;
  variant = ((v % n) + n) % n;
  show();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-topic], [data-variant], [data-step]');
  if (!b) return;
  if (b.dataset.topic !== undefined) go(+b.dataset.topic, 0);
  else if (b.dataset.variant !== undefined) go(topic, +b.dataset.variant);
  else go(topic, variant + +b.dataset.step);
});
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight') { go(topic, variant + 1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { go(topic, variant - 1); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { go(topic + 1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { go(topic - 1, 0); e.preventDefault(); }
});
// Balayer horizontalement (mobile)
let touchX = null, touchY = null;
$('view').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
$('view').addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(topic, variant + (dx < 0 ? 1 : -1));
  touchX = null;
});
addEventListener('hashchange', () => { readHash(); renderMenu(); renderView(); });

// La vignette de la variante ouverte, animée
(function loop(now) {
  requestAnimationFrame(loop);
  if (!artCanvas || !artFn) return;
  const g = artCanvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  artFn(g, Math.max(0, (now - t0) / 1000));
})(0);

readHash();
show();
