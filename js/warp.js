/* La déformation de la grille (v2.2.0, maillage irrégulier depuis la v2.3.0). La
   logique du jeu (rues, immeubles, nuée, collisions, sauvegarde) reste sur la
   grille carrée ; seul le rendu 3D la plie.

   Chaque sommet de la grille (u, v) a une position dans le monde : un grand
   déplacement lisse (un méandre de la Seine, des ondulations de plusieurs cases)
   plus une petite secousse propre au sommet. Une case devient un quadrilatère
   irrégulier, aux côtés droits, comme dans un plan relaxé ; à l'intérieur d'une
   case, la position est l'interpolation bilinéaire de ses quatre coins.
   Les positions sont gardées dans une texture flottante lue par les shaders
   (`warp()` en GLSL) et dans un tableau pour le JS (`fwd`, `inv`).

   Le déplacement lisse :  d = v − c (c : l'axe de la Seine)
     méandre :  X = u − f'(u)·d·a(d),  Y = v + f(u)·a(d),  a(d) = exp(−(d/L)²) */
import { CELL } from './scale.js?v=2.3.0';

// Les ondes (en cases) : le cap du fleuve φ(u) = P1·sin(2πu/L1 + a1) + P2·sin(2πu/L2 + a2) (en radians)
export const K = {
  P1: 0.26, L1: 80, a1: 0.5, P2: 0.07, L2: 40, a2: 2.4,
  D: 16,                                                 // jusqu'où la courbure agit de part et d'autre du fleuve (cases)
  B: 0.45,                                               // les ondulations des îlots
  J: 0.18,                                               // la secousse de chaque sommet (en cases)
};
const TAU = Math.PI * 2;
// le champ lisse : [fréquence en u, en v, phase, poids] pour X puis pour Y
const NX = [[0.031, 0.047, 1.3, 1], [-0.043, 0.036, 4.1, 0.6], [0.083, -0.057, 2.0, 0.3]];
const NY = [[0.052, -0.026, 2.2, 1], [0.021, 0.058, 0.4, 0.6], [-0.071, 0.049, 5.0, 0.3]];

export function makeWarp(city) {
  const w = city.w, h = city.h;
  // l'axe de la Seine : la rangée moyenne de ses cases d'eau (le milieu de la carte à défaut)
  let sum = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 3) if (city.kind(x, y) === '~') { sum += y; n++; }
  const c = n ? sum / n : h / 2;
  const k88 = w / 88;
  // une petite carte (l'atelier) se plie moins : sinon la déformation se replierait sur elle-même
  const sc = Math.min(1, w / 88) ** 2, B = K.B * Math.min(1, w / 88), J = K.J;
  const phi = u => sc * (K.P1 * Math.sin(TAU * u / (K.L1 * k88) + K.a1) + K.P2 * Math.sin(TAU * u / (K.L2 * k88) + K.a2));
  // la ligne du fleuve : on intègre son cap (u en cases = abscisse curviligne), centrée au milieu de la carte
  const STEP = 0.25, U0 = -8, NU = Math.ceil((w + 16) / STEP) + 1, cx = new Float64Array(NU), cy = new Float64Array(NU);
  for (let k = 1; k < NU; k++) {
    const ph = phi(U0 + (k - 0.5) * STEP);
    cx[k] = cx[k - 1] + Math.cos(ph) * STEP; cy[k] = cy[k - 1] + Math.sin(ph) * STEP;
  }
  const kMid = Math.round((w / 2 - U0) / STEP), ox = w / 2 - cx[kMid], oy = c - cy[kMid];
  // le déplacement lisse d'un point de la grille (en cases) → [X, Y] en cases : le fleuve courbé, les rangées le suivent
  function smooth(u, v) {
    const t = (u - U0) / STEP, k = Math.max(0, Math.min(NU - 2, Math.floor(t))), f = t - k;
    const px = cx[k] * (1 - f) + cx[k + 1] * f + ox, py = cy[k] * (1 - f) + cy[k + 1] * f + oy, ph = phi(u);
    const d = v - c, de = K.D * Math.tanh(d / K.D);
    let X = px - Math.sin(ph) * de, Y = py + Math.cos(ph) * de + (d - de) * 1;
    for (let q = 0; q < 3; q++) {
      X += B * NX[q][3] * Math.sin(TAU * (NX[q][0] * u + NX[q][1] * v) + NX[q][2]);
      Y += B * NY[q][3] * Math.sin(TAU * (NY[q][0] * u + NY[q][1] * v) + NY[q][2]);
    }
    return [X, Y];
  }
  // la grille des sommets : (w + 1) × (h + 1), RGBA flottant (X, Y en pixels du monde)
  const nx = w + 1, ny = h + 1, data = new Float32Array(nx * ny * 4);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const [X, Y] = smooth(i, j);
    // (hash3 vient de city.js : on ne l'importe pas ici, pour ne pas lier les deux modules)
    const jx = (rnd(i, j, 1) - 0.5) * 2 * J, jy = (rnd(i, j, 2) - 0.5) * 2 * J;
    const o = (j * nx + i) * 4;
    data[o] = (X + jx) * CELL; data[o + 1] = (Y + jy) * CELL; data[o + 3] = 1;
  }

  // un quadrilatère replié (ou presque) perd sa secousse : les cases restent convexes
  for (let pass = 0; pass < 3; pass++) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const P = k => { const o = ((j + (k >> 1)) * nx + i + (k & 1)) * 4; return [data[o], data[o + 1]]; };
    const [a, b, c2, d] = [P(0), P(1), P(2), P(3)];
    const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    if (Math.min(cr(a, b, c2), cr(b, d, a), cr(d, c2, b), cr(c2, a, d)) > 0.12 * CELL * CELL) continue;
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [X, Y] = smooth(i + di, j + dj), o = ((j + dj) * nx + i + di) * 4;
      data[o] = (X + (data[o] / CELL - X) * 0.4) * CELL; data[o + 1] = (Y + (data[o + 1] / CELL - Y) * 0.4) * CELL;
    }
  }

  /* (x, y) en pixels logiques → [X, Y] et la jacobienne [Xx, Xy, Yx, Yy], dans `o` */
  function fwd(x, y, o = []) {
    const u = x / CELL, v = y / CELL;
    const i = u < 0 ? 0 : u >= w ? w - 1 : Math.floor(u), j = v < 0 ? 0 : v >= h ? h - 1 : Math.floor(v);
    const fu = u - i, fv = v - j, p = (j * nx + i) * 4, q = p + nx * 4;
    const ax = data[p], ay = data[p + 1], bx = data[p + 4], by = data[p + 5], cx = data[q], cy = data[q + 1], dx = data[q + 4], dy = data[q + 5];
    o[0] = (ax * (1 - fu) + bx * fu) * (1 - fv) + (cx * (1 - fu) + dx * fu) * fv;
    o[1] = (ay * (1 - fu) + by * fu) * (1 - fv) + (cy * (1 - fu) + dy * fu) * fv;
    const k = 1 / CELL;
    o[2] = ((bx - ax) * (1 - fv) + (dx - cx) * fv) * k;      // dX/dx
    o[3] = ((cx - ax) * (1 - fu) + (dx - bx) * fu) * k;      // dX/dy
    o[4] = ((by - ay) * (1 - fv) + (dy - cy) * fv) * k;      // dY/dx
    o[5] = ((cy - ay) * (1 - fu) + (dy - by) * fu) * k;      // dY/dy
    return o;
  }
  const tmp = [];
  // (X, Y) du monde → (x, y) logiques : le sommet le plus proche, puis Newton
  function inv(X, Y, o = []) {
    let best = 0, bd = Infinity;
    for (let k = 0, m = nx * ny; k < m; k++) {
      const ex = data[k * 4] - X, ey = data[k * 4 + 1] - Y, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = k; }
    }
    let x = (best % nx) * CELL, y = Math.floor(best / nx) * CELL;
    for (let k = 0; k < 14; k++) {
      fwd(x, y, tmp);
      const ex = X - tmp[0], ey = Y - tmp[1];
      if (Math.abs(ex) + Math.abs(ey) < 0.02) break;
      const det = tmp[2] * tmp[5] - tmp[3] * tmp[4] || 1;
      x += (tmp[5] * ex - tmp[3] * ey) / det;
      y += (-tmp[4] * ex + tmp[2] * ey) / det;
    }
    o[0] = x; o[1] = y;
    return o;
  }
  /* Le sens logique d'une direction du monde, en un point : (dx, dy) monde → logique */
  function dirToLogical(x, y, dx, dy, o = []) {
    fwd(x, y, tmp);
    const det = tmp[2] * tmp[5] - tmp[3] * tmp[4] || 1;
    o[0] = (tmp[5] * dx - tmp[3] * dy) / det; o[1] = (-tmp[4] * dx + tmp[2] * dy) / det;
    return o;
  }
  /* … et l'inverse : une direction logique → monde */
  function dirToWorld(x, y, dx, dy, o = []) {
    fwd(x, y, tmp);
    o[0] = tmp[2] * dx + tmp[3] * dy; o[1] = tmp[4] * dx + tmp[5] * dy;
    return o;
  }

  // Le même calcul dans les shaders : warp(vec2 logique en px) → vec2 monde en px (uWarp : la texture des sommets)
  const WARP_GLSL = `
uniform sampler2D uWarp;
vec2 warp(vec2 p) {
  vec2 q = p / ${CELL}.0;
  ivec2 i = ivec2(clamp(floor(q), vec2(0.0), vec2(${w - 1}.0, ${h - 1}.0)));
  vec2 f = q - vec2(i);
  vec2 a = texelFetch(uWarp, i, 0).xy, b = texelFetch(uWarp, i + ivec2(1, 0), 0).xy;
  vec2 c = texelFetch(uWarp, i + ivec2(0, 1), 0).xy, d = texelFetch(uWarp, i + ivec2(1, 1), 0).xy;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`;
  return { fwd, inv, dirToLogical, dirToWorld, axis: c, WARP_GLSL, data, nx, ny };
}

// un hasard déterministe, propre à ce module
function rnd(a, b, c) {
  let t = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(c, 2147483647)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177); t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}
