/* La déformation de la grille (v2.2.0). La logique du jeu (rues, immeubles,
   nuée, collisions, sauvegarde) reste sur la grille carrée ; seul le rendu 3D
   la plie : la Seine serpente, les rues et les îlots s'inclinent un peu, comme
   dans un vrai plan de Paris. Une même fonction, ici (JS) et dans les shaders
   (GLSL, `WARP_GLSL`) ; tout se compte en cases puis en pixels du monde.

     (u, v) cases logiques  →  (X, Y) cases du monde
       d = v − c                                  (c : l'axe de la Seine)
       méandre :  X = u − f'(u)·d·a(d),  Y = v + f(u)·a(d),  a(d) = exp(−(d/L)²)
       plus un champ lisse de petits déplacements (îlots irréguliers).

   Le méandre est une rotation autour de la ligne du fleuve, qui s'éteint avec
   la distance : les quais et les rues parallèles suivent la courbe, les rues
   en travers s'évasent. La déformation est lisse et conserve à peu près les
   surfaces (vitesse de Pierre, taille des rats). */
import { CELL } from './scale.js?v=2.2.0';

// Les ondes (en cases) : amplitude, longueur d'onde, phase
export const K = {
  A1: 4, L1: 92, P1: 0.6, A2: 1.2, L2: 41, P2: 2.4,   // le méandre de la Seine
  L: 20,                                                 // la portée du méandre, de part et d'autre
  B: 0.35,                                               // l'irrégularité des îlots
};
const TAU = Math.PI * 2;
// le champ lisse : [fréquence en u, en v, phase, poids] pour X puis pour Y
const NX = [[0.031, 0.047, 1.3, 1], [-0.043, 0.036, 4.1, 0.6], [0.083, -0.057, 2.0, 0.3]];
const NY = [[0.052, -0.026, 2.2, 1], [0.021, 0.058, 0.4, 0.6], [-0.071, 0.049, 5.0, 0.3]];

export function makeWarp(city) {
  // l'axe de la Seine : la rangée moyenne de ses cases d'eau (le milieu de la carte à défaut)
  let sum = 0, n = 0;
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x += 3) if (city.kind(x, y) === '~') { sum += y; n++; }
  const c = n ? sum / n : city.h / 2;
  const L1 = K.L1 * city.w / 88, L2 = K.L2 * city.w / 88;
  const a1 = TAU / L1, a2 = TAU / L2;
  // une petite carte (l'atelier) se plie moins : sinon la déformation se replierait sur elle-même
  const sc = Math.min(1, city.w / 88) ** 2, A1 = K.A1 * sc, A2 = K.A2 * sc;

  /* (x, y) en pixels logiques → [X, Y] et la jacobienne [Xx, Xy, Yx, Yy], dans `o` */
  function fwd(x, y, o = []) {
    const u = x / CELL, v = y / CELL, d = v - c;
    const s1 = Math.sin(a1 * u + K.P1), c1 = Math.cos(a1 * u + K.P1), s2 = Math.sin(a2 * u + K.P2), c2 = Math.cos(a2 * u + K.P2);
    const F = A1 * s1 + A2 * s2;
    const F1 = A1 * a1 * c1 + A2 * a2 * c2;
    const F2 = -A1 * a1 * a1 * s1 - A2 * a2 * a2 * s2;
    const t = d / K.L, a = Math.exp(-t * t), da = -2 * d / (K.L * K.L) * a;
    let X = u - F1 * d * a, Y = v + F * a;
    let Xu = 1 - F2 * d * a, Xv = -F1 * (a + d * da), Yu = F1 * a, Yv = 1 + F * da;
    for (let k = 0; k < 3; k++) {
      const [fu, fv, ph, w] = NX[k], ang = TAU * (fu * u + fv * v) + ph, B = K.B * w;
      X += B * Math.sin(ang); Xu += B * TAU * fu * Math.cos(ang); Xv += B * TAU * fv * Math.cos(ang);
      const [gu, gv, qh, q] = NY[k], bng = TAU * (gu * u + gv * v) + qh, Bq = K.B * q;
      Y += Bq * Math.sin(bng); Yu += Bq * TAU * gu * Math.cos(bng); Yv += Bq * TAU * gv * Math.cos(bng);
    }
    o[0] = X * CELL; o[1] = Y * CELL; o[2] = Xu; o[3] = Xv; o[4] = Yu; o[5] = Yv;
    return o;
  }
  const tmp = [];
  // (X, Y) du monde → (x, y) logiques, par Newton (la déformation est douce : 3 ou 4 tours)
  function inv(X, Y, o = []) {
    let x = X, y = Y;
    for (let k = 0; k < 6; k++) {
      fwd(x, y, tmp);
      const ex = X - tmp[0], ey = Y - tmp[1];
      if (Math.abs(ex) + Math.abs(ey) < 0.01) break;
      const det = tmp[2] * tmp[5] - tmp[3] * tmp[4];
      x += (tmp[5] * ex - tmp[3] * ey) / det;
      y += (-tmp[4] * ex + tmp[2] * ey) / det;
    }
    o[0] = x; o[1] = y;
    return o;
  }
  /* Le sens logique d'une direction du monde, en un point : (dx, dy) monde → logique */
  function dirToLogical(x, y, dx, dy, o = []) {
    fwd(x, y, tmp);
    const det = tmp[2] * tmp[5] - tmp[3] * tmp[4];
    o[0] = (tmp[5] * dx - tmp[3] * dy) / det; o[1] = (-tmp[4] * dx + tmp[2] * dy) / det;
    return o;
  }
  /* … et l'inverse : une direction logique → monde */
  function dirToWorld(x, y, dx, dy, o = []) {
    fwd(x, y, tmp);
    o[0] = tmp[2] * dx + tmp[3] * dy; o[1] = tmp[4] * dx + tmp[5] * dy;
    return o;
  }

  // Le même calcul dans les shaders : warp(vec2 logique en px) → vec2 monde en px
  const f = n => Number(n).toFixed(6);
  const WARP_GLSL = `
vec2 warp(vec2 p) {
  float u = p.x / ${f(CELL)}, v = p.y / ${f(CELL)}, d = v - ${f(c)};
  float F = ${f(A1)} * sin(${f(a1)} * u + ${f(K.P1)}) + ${f(A2)} * sin(${f(a2)} * u + ${f(K.P2)});
  float F1 = ${f(A1 * a1)} * cos(${f(a1)} * u + ${f(K.P1)}) + ${f(A2 * a2)} * cos(${f(a2)} * u + ${f(K.P2)});
  float t = d / ${f(K.L)}, a = exp(-t * t);
  float X = u - F1 * d * a, Y = v + F * a;
  ${NX.map(([fu, fv, ph, w]) => `X += ${f(K.B * w)} * sin(${f(TAU * fu)} * u + ${f(TAU * fv)} * v + ${f(ph)});`).join('\n  ')}
  ${NY.map(([fu, fv, ph, w]) => `Y += ${f(K.B * w)} * sin(${f(TAU * fu)} * u + ${f(TAU * fv)} * v + ${f(ph)});`).join('\n  ')}
  return vec2(X, Y) * ${f(CELL)};
}`;
  return { fwd, inv, dirToLogical, dirToWorld, axis: c, WARP_GLSL };
}
