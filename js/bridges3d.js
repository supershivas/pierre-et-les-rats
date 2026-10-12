/* Les ponts en 3D (v2.2.0), d'après le Pont Neuf : des arches en plein cintre,
   des piles à avant-bec coiffées d'un petit toit, une corniche, un parapet de
   pierre, et au-dessus de chaque pile une demi-lune (un balcon rond).
   Trois sortes, selon la largeur et la portée du pont sur la grille :
     neuf    un grand pont de pierre (largeur ≥ 3 cases, portée ≥ 5) : 5 à 7
             arches en plein cintre, demi-lunes ;
     court   un pont de pierre plus modeste (largeur ≥ 3, portée courte) : des
             arches surbaissées, parapet plein ;
     fonte   une passerelle (largeur ≤ 2) : un tablier sur des arcs de fonte,
             des piles de pierre fines, un garde-corps à barreaux.
   Un pont est un rectangle de cases « = » ; l'axe est celui qui touche la terre
   à ses deux bouts. Repère local : a le long du pont, b en travers, y vers le haut. */
import { CELL } from './scale.js?v=2.3.0';
import { TONES } from './geo.js?v=2.3.0';
import { hash } from './city.js?v=2.3.0';

// Les rectangles de cases « = » (un pont large = un seul rectangle)
export function findBridges(city) {
  const taken = new Set(), out = [];
  const isBr = (x, y) => city.kind(x, y) === '=' && !taken.has(y * city.w + x);
  const land = (x, y) => { const k = city.kind(x, y); return k !== '~' && k !== '=' && k !== '#'; };
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) {
    if (!isBr(x, y)) continue;
    let x1 = x; while (isBr(x1 + 1, y)) x1++;
    let y1 = y;
    for (;;) { let full = true; for (let xx = x; xx <= x1; xx++) if (!isBr(xx, y1 + 1)) { full = false; break; } if (!full) break; y1++; }
    for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) taken.add(yy * city.w + xx);
    const cw = x1 - x + 1, ch = y1 - y + 1;
    let landZ = 0, landX = 0;
    for (let xx = x; xx <= x1; xx++) { landZ += land(xx, y - 1) + land(xx, y1 + 1); }
    for (let yy = y; yy <= y1; yy++) { landX += land(x - 1, yy) + land(x1 + 1, yy); }
    const axis = landZ > landX ? 'z' : landX > landZ ? 'x' : (ch >= cw ? 'z' : 'x');
    const len = axis === 'z' ? ch : cw, wid = axis === 'z' ? cw : ch;
    const kind = wid <= 2 ? 'fonte' : len >= 5 ? 'neuf' : 'court';
    const arches = kind === 'neuf' ? Math.min(7, len) : kind === 'court' ? Math.max(1, len) : Math.max(1, Math.round(len * CELL / 140));
    out.push({ x0: x, y0: y, len, wid, axis, kind, arches, variant: hash(x, y, city.seed, 71) });
  }
  return out;
}

export function addBridge(m, br, waterY) {
  const L = br.len * CELL, W = br.wid * CELL, OX = br.x0 * CELL, OZ = br.y0 * CELL;
  const P = (a, b, y) => (br.axis === 'z' ? [OX + b, y, OZ + a] : [OX + a, y, OZ + b]);
  const quad = (A, B, C, D, tones, over) => { m.tri(A, B, C, tones, over); m.tri(A, C, D, tones, over); };
  // une boîte alignée sur le pont : a0..a1, b0..b1, y0..y1
  const box = (a0, a1, b0, b1, y0, y1, tones, over) => {
    const [cx, , cz] = P((a0 + a1) / 2, (b0 + b1) / 2, 0);
    if (br.axis === 'z') m.box(cx, y0, cz, b1 - b0, y1 - y0, a1 - a0, tones, over);
    else m.box(cx, y0, cz, a1 - a0, y1 - y0, b1 - b0, tones, over);
  };
  const SIDES = [0, 1];
  if (br.kind === 'fonte') return iron();
  return stone();

  // ─── un pont de pierre ───
  function stone() {
    const neuf = br.kind === 'neuf', n = br.arches, s = L / n, tp = Math.min(18, s * 0.27);
    const ow = s - tp, r = ow / 2, ecc = neuf ? 1 : 0.62;
    const yc = -9, ys = yc - r * ecc, yTop = -3;
    const inside = P(L / 2, W / 2, -20);
    // les piles, de l'eau au haut du mur ; les avant-becs, coiffés d'un petit toit
    for (let k = 0; k <= n; k++) {
      const ak = k * s, a0 = Math.max(0, ak - tp / 2), a1 = Math.min(L, ak + tp / 2);
      box(a0, a1, 0, W, waterY, yTop, TONES.stone);
      if (k === 0 || k === n) continue;
      const R = tp * 0.58;
      for (const side of SIDES) {
        const b = side ? W + R / 2 : -R / 2, [cx, , cz] = P(ak, b, 0);
        const ry = br.axis === 'z' ? (side ? Math.PI / 2 : -Math.PI / 2) : (side ? 0 : Math.PI);
        m.cyl(cx, waterY, cz, R, R, ys - waterY, 3, TONES.stone, {}, 0, Math.PI * 2, ry);
        m.cone(cx, ys, cz, R * 1.04, 16, 3, TONES.stone, { up: 'neige', snow: 0.4 }, 0, Math.PI * 2, ry);
      }
    }
    // les arches : le mur (de l'arc au haut du mur) sur les deux faces, et l'intrados
    const SEG = 12;
    for (let k = 0; k < n; k++) {
      const am = (k + 0.5) * s;
      const arc = i => { const th = Math.PI - Math.PI * i / SEG; return [am + r * Math.cos(th), ys + r * ecc * Math.sin(th)]; };
      for (let i = 0; i < SEG; i++) {
        const [a0, y0] = arc(i), [a1, y1] = arc(i + 1);
        for (const side of SIDES) {
          const b = side ? W : 0;
          quad(P(a0, b, y0), P(a1, b, y1), P(a1, b, yTop), P(a0, b, yTop), TONES.stone, { out: inside });
        }
        // l'intrados, tourné vers l'axe de l'arche
        const cm = [(a0 + a1) / 2, (y0 + y1) / 2];
        const out = P(cm[0] + (cm[0] - am) * 0.5, W / 2, cm[1] + (cm[1] - ys) * 0.5 + 1);
        quad(P(a0, 0, y0), P(a1, 0, y1), P(a1, W, y1), P(a0, W, y0), TONES.black, { out });
      }
      // la clef de voûte : un mascaron
      for (const side of SIDES) { const b = side ? W : 0, e = side ? 0.5 : -0.5; box(am - 2.6, am + 2.6, Math.min(b, b + e), Math.max(b, b + e) + (side ? 0.3 : 0), yc - 1, yTop, TONES.black, { fixed: 'nuit' }); }
    }
    // la corniche, le parapet, ses évidements, les piliers d'angle
    for (const side of SIDES) {
      const b0 = side ? W - 2.2 : -1.2, b1 = side ? W + 1.2 : 2.2;
      box(0, L, b0, b1, yTop, 0.2, TONES.stone, { up: 'neige' });
      const p0 = side ? W - 5 : 0.4, p1 = side ? W - 0.4 : 5;
      box(0, L, p0, p1, 0.2, 10, TONES.stone);
      box(0, L, side ? W - 6 : -1, side ? W + 1 : 6, 10, 12.4, TONES.stone, { up: 'neige' });
      const face = side ? W - 5 : 5;
      for (let a = 7; a < L - 5; a += neuf ? 9 : 12) box(a - 2.2, a + 2.2, Math.min(face, face + (side ? 0.15 : -0.15)) - (side ? 0.05 : 0.15), Math.max(face, face + (side ? 0.15 : -0.15)) + (side ? 0.15 : 0.05), 2.2, 8.2, TONES.black, { fixed: 'nuit' });
      for (const a of [0, L - 7]) box(a, a + 7, side ? W - 7 : -1, side ? W + 1 : 7, 0.2, 17, TONES.stone, { up: 'neige' });
    }
    // des demi-lunes sur chaque pile : un balcon rond, son parapet
    if (neuf) {
      for (let k = 1; k < n; k++) for (const side of SIDES) {
        const ak = k * s, R = Math.min(15, tp * 0.95 + 2), sg = side ? 1 : -1, b0 = side ? W : 0;
        const [cx, , cz] = P(ak, b0 + sg * 0.5, 0);
        const a0 = br.axis === 'z' ? (side ? 0 : -Math.PI) : (side ? -Math.PI / 2 : Math.PI / 2);
        m.cyl(cx, -3, cz, R, R, 3.2, 10, TONES.stone, { up: 'neige' }, a0, Math.PI);
        const N = 7;
        for (let i = 0; i < N; i++) {
          const ph0 = -Math.PI / 2 + Math.PI * i / N, ph1 = -Math.PI / 2 + Math.PI * (i + 1) / N, rr = R - 2;
          const A = P(ak + rr * Math.sin(ph0), b0 + sg * (0.5 + rr * Math.cos(ph0)), 0), B = P(ak + rr * Math.sin(ph1), b0 + sg * (0.5 + rr * Math.cos(ph1)), 0);
          const dx = B[0] - A[0], dz = B[2] - A[2];
          m.box((A[0] + B[0]) / 2, 0.2, (A[2] + B[2]) / 2, 3.4, 9, Math.hypot(dx, dz) + 0.6, TONES.stone, { up: 'neige' }, Math.atan2(dx, dz));
          m.box((A[0] + B[0]) / 2, 9, (A[2] + B[2]) / 2, 4.6, 2, Math.hypot(dx, dz) + 0.8, TONES.stone, { up: 'neige' }, Math.atan2(dx, dz));
        }
      }
    }
  }

  // ─── une passerelle de fonte ───
  function iron() {
    const n = br.arches, s = L / n, tp = 8, yc = -5.3, rise = Math.min(34, 8 + s * 0.2), ys = yc - rise;
    box(0, L, 0, W, yc - 1, -0.3, TONES.iron);                       // le tablier
    for (const [a0, a1] of [[0, 4], [L - 4, L]]) box(a0, a1, 0, W, waterY, yc - 0.5, TONES.stone);   // les culées
    for (let k = 1; k < n; k++) for (const b of [2, W - 2 - tp]) box(k * s - tp / 2, k * s + tp / 2, b, b + tp, waterY, ys + 2, TONES.stone, { up: 'neige' });
    const yArch = (k, a) => { const t = (a - (k + 0.5) * s) / (s / 2); return yc - rise * (1 - t * t); };
    for (let k = 0; k < n; k++) {
      for (const b of [4, W - 4]) {
        const SEG = 10;
        for (let i = 0; i < SEG; i++) {
          const a0 = k * s + s * i / SEG, a1 = k * s + s * (i + 1) / SEG, A = P(a0, b, yArch(k, a0)), B = P(a1, b, yArch(k, a1));
          m.limb(A[0], A[1], A[2], B[0], B[1], B[2], 1.5, 1.5, 4, TONES.iron, {});
        }
        for (let a = k * s + 10; a < (k + 1) * s - 6; a += 12) box(a - 0.7, a + 0.7, b - 0.7, b + 0.7, yArch(k, a), yc, TONES.iron);
      }
    }
    // le garde-corps : deux lisses, des barreaux, des poteaux ; un lampadaire à chaque pile
    for (const side of SIDES) {
      const b0 = side ? W - 2.6 : 0.6, b1 = b0 + 2;
      box(0, L, b0, b1, 10.4, 11.8, TONES.iron, { up: 'neige' });
      box(0, L, b0 + 0.3, b1 - 0.3, 5, 6.2, TONES.iron);
      for (let a = 3; a < L - 2; a += 5) box(a - 0.6, a + 0.6, b0 + 0.4, b1 - 0.4, 0, 10.4, TONES.black, { fixed: 'nuit' });
      for (let a = 0; a <= L; a += 24) box(Math.max(0, a - 1.5), Math.min(L, a + 1.5), b0 - 0.6, b1 + 0.6, 0, 13.5, TONES.iron, { up: 'neige' });
    }
  }
}
