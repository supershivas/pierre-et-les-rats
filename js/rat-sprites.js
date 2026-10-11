/* Les poses des rats, préparées une fois : en petits canvas (ATLAS, pour la
   planche d'échelle) et en listes de pixels (PIX : x, y, couleur sur 32 bits)
   que la nuée écrit directement dans un tampon, sans drawImage par rat.
   Légende : b corps (noir), c dos (bleu nuit clair), t queue.
   Toutes les poses regardent vers la droite ou vers le bas/haut de l'écran ;
   la gauche est le miroir de la droite. Ancre : milieu du bas. */
import { PAL, RGB } from './palette.js?v=1.3.0';

const KEYS = { b: 'brun', c: 'brunC', t: 'rose' };

const POSES = {
  // De profil, au galop : étiré, ramassé, entre les deux
  side: [
    ['......b...', '..cccbbb..', 'tbbbbbbbbb', 't..b...b..'],
    ['.....b....', '..ccccbb..', '.tbbbbbbbb', 'tt..bbb...'],
    ['......b...', '...cccbb..', 'tbbbbbbbbb', '.t..b.b...'],
  ],
  // Vers nous (le bas de l'écran) : la tête en bas, la queue derrière
  down: [
    ['..t.', '..t.', '.cc.', 'bccb', 'bbbb', 'bbbb', '.bb.'],
    ['.t..', '..t.', '.cc.', 'bccb', 'bbbb', 'bbbb', 'b..b'],
  ],
  // De dos (le haut de l'écran) : la tête en haut, la queue vers nous
  up: [
    ['b..b', '.bb.', 'bccb', 'bccb', 'bbbb', '.bb.', '..t.', '..t.'],
    ['b..b', '.bb.', 'bccb', 'bccb', 'bbbb', 'b..b', '.t..', '..t.'],
  ],
  // Dressé sur les pattes arrière, le nez en l'air ; deux temps (il renifle)
  rear: [
    ['..b.', '..bb', '.cbb', '.cb.', '.bb.', 'tbb.', 'tb.b'],
    ['.b..', '..bb', '.cbb', '.cbb', '.bb.', 'tbb.', 't.bb'],
  ],
  // En l'air : tout étiré, pattes écartées
  jump: [
    ['......b...', '.ccccbbbb.', 'tbbbbbbbbb', 'b.......b.'],
  ],
  // Il se lèche, roulé en boule
  curl: [
    ['.cc..', 'cbbb.', 'bbbbb', 'tbbb.'],
  ],
};

function render(rows, flip) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.') continue;
    g.fillStyle = PAL[KEYS[ch]];
    g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
  }
  return { c, ax: Math.floor(w / 2), ay: h };
}

// La couleur en entier 32 bits, dans l'ordre des octets d'un ImageData (petit-boutiste)
const u32 = key => { const [r, g, b] = RGB[KEYS[key]]; return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; };
function pixels(rows, flip) {
  const h = rows.length, w = rows[0].length, ax = Math.floor(w / 2), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.') continue;
    out.push((flip ? w - 1 - x : x) - ax, y - h, u32(ch));
  }
  return Uint32Array.from(out.map(v => v >>> 0));
}
// PIX[pose][frame][0 = droite, 1 = gauche] : triplets (dx, dy, couleur), dx et dy en complément à deux
export const PIX = Object.fromEntries(Object.entries(POSES).map(([k, frames]) => [k, frames.map(rows => [pixels(rows, false), pixels(rows, true)])]));

// ATLAS[pose][frame][0 = droite, 1 = gauche]
export const ATLAS = Object.fromEntries(Object.entries(POSES).map(([k, frames]) => [k, frames.map(rows => [render(rows, false), render(rows, true)])]));
export const POSE_ROWS = POSES;
