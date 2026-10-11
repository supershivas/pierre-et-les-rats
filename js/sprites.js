/* Les personnages, dessinés pixel par pixel, tournés vers la droite (on les
   retourne pour la gauche). Ancre : le milieu du bas, sous les pieds.
   Légende : n nuit, t nuit2, b brun, c brunC, p peau, r rouge, R rougeS,
   o ocreS, O ocre, s neigeM, q rose.
   Dans le jeu, Pierre n'est qu'une silhouette (option silhouette : tout en
   noir) ; les couleurs servent à la planche d'échelle. */
import { PAL } from './palette.js?v=1.2.0';

const KEYS = { n: 'nuit', t: 'nuit2', b: 'brun', c: 'brunC', p: 'peau', r: 'rouge', R: 'rougeS', o: 'ocreS', O: 'ocre', s: 'neigeM', w: 'neige', q: 'rose', a: 'ardoise' };

// Pierre : 13 × 26 px (1,30 m). Le haut du corps, commun à toutes les poses
const PIERRE_TOP = [
  '....bbbb.....',
  '...bbbbbb....',
  '..bbbbbbbb...',
  '..cbbbbbbbb..',
  '..ccpppppp...',
  '..ccppnpppp..',
  '..cppppppppp.',
  '...pppppp....',
  '..ooooooo....',
  '.oorrrrroo...',
  '.o.rrrrrrr...',
  '..rRrrrrrrr..',
  '..rRrrrrrrr..',
  '..rRrrrrrrr..',
  '..rRrrrrrrr..',
  '..rRrrrrrrr..',
  '..rRrnnrrrr..',
  '..RRrrrrrrr..',
  '..RRrrrrrrR..',
  '...RRrrrrRR..',
];
// Les jambes : debout, puis les quatre temps de la marche
const PIERRE_LEGS = {
  stand: ['....tt.tt....', '....tt.tt....', '....tt.tt....', '....bb.bbb...', '...bbb.bbbb..', '.............'],
  walk0: ['...tt...tt...', '...tt...tt...', '..tt.....tt..', '..bb.....bbb.', '.bbb......bb.', '.............'],
  walk1: ['....tt.tt....', '....tt.tt....', '....ttbtt....', '....bbbbb....', '....bbbbbb...', '.............'],
  walk2: ['....tt..tt...', '...tt...tt...', '...tt....tt..', '..bbb....bbb.', '..bb......bb.', '.............'],
};
// Le bras le long du corps, ou levé pour tenir la flûte (au-delà du cadre, à droite)
const ARM_DOWN = [[7, 11, 'R'], [7, 12, 'R'], [7, 13, 'R'], [7, 14, 'R'], [7, 15, 'R'], [7, 16, 'R'], [7, 17, 'p']];
const ARM_PLAY = [
  [7, 11, 'R'], [8, 10, 'R'], [9, 9, 'R'], [10, 8, 'p'], [12, 8, 'p'],
  [8, 7, 'o'], [9, 7, 'o'], [10, 7, 'o'], [11, 7, 'o'], [12, 7, 'o'], [13, 7, 'o'], [14, 7, 'o'], [15, 7, 'o'], [16, 7, 'O'],
  [11, 7, 'n'], [13, 7, 'n'],
];

function blit(ctx, rows, x0, y0, flip, w, ink) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = ink || PAL[KEYS[ch]];
      ctx.fillRect(flip ? x0 + w - 1 - x : x0 + x, y0 + y, 1, 1);
    }
  }
}
function dots(ctx, list, x0, y0, flip, w, ink) {
  for (const [x, y, ch] of list) {
    ctx.fillStyle = ink || PAL[KEYS[ch]];
    ctx.fillRect(flip ? x0 + w - 1 - x : x0 + x, y0 + y, 1, 1);
  }
}

// Une ombre tramée sous les pieds
export function drawShadow(ctx, x, y, w) {
  ctx.fillStyle = PAL.neigeO;
  for (let i = -w; i <= w; i++) {
    if ((i + x) % 2 === 0) ctx.fillRect(x + i, y, 1, 1);
    if (Math.abs(i) < w - 1 && (i + x) % 2 !== 0) ctx.fillRect(x + i, y + 1, 1, 1);
  }
}

/* Pierre en (x, y) écran (sous les pieds). pose : 'stand' | 'walk' | 'play' ;
   t : le temps, pour l'animation ; dir : 1 droite, −1 gauche. */
export function drawPierre(ctx, x, y, { pose = 'stand', t = 0, dir = 1, shadow = true, silhouette = false } = {}) {
  const ink = silhouette ? PAL.nuit : null;
  const flip = dir < 0, w = 13;
  const x0 = Math.round(x) - 6, y0 = Math.round(y) - 26;
  if (shadow) drawShadow(ctx, Math.round(x), Math.round(y) - 1, 5);
  let legs = 'stand', bob = 0;
  if (pose === 'walk') {
    const f = Math.floor(t * 8) % 4;
    legs = ['walk0', 'walk1', 'walk2', 'walk1'][f];
    bob = f % 2 ? -1 : 0;
  }
  // Quand il joue : il se balance un peu, la tête suit la mélodie
  if (pose === 'play') bob = Math.floor(t * 3) % 2 ? -1 : 0;
  blit(ctx, PIERRE_TOP, x0, y0 + bob, flip, w, ink);
  blit(ctx, PIERRE_LEGS[legs], x0, y0 + 20, flip, w, ink);
  dots(ctx, pose === 'play' ? ARM_PLAY : ARM_DOWN, x0, y0 + bob, flip, w, ink);
}

// Une note de musique : 4 × 6 px (croche), ou deux croches liées
const NOTES = [
  ['..O.', '..OO', '..O.', '..O.', 'OOO.', 'OO..'],
  ['OOOO', 'O..O', 'O..O', 'O..O', 'OOOO', 'OO.O'],
];
export function drawNote(ctx, x, y, kind = 0, fade = 0) {
  const rows = NOTES[kind % 2];
  for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < 4; xx++) {
    if (rows[yy][xx] === '.') continue;
    // en s'effaçant, la note se trame
    if (fade > 0.5 && (xx + yy) % 2 === 0) continue;
    if (fade > 0.8 && (xx + yy) % 3 !== 0) continue;
    ctx.fillStyle = PAL.ocre;
    ctx.fillRect(Math.round(x) + xx, Math.round(y) + yy, 1, 1);
  }
}
