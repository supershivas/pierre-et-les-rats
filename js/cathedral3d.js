/* Notre-Dame, d'un seul bloc : la cathédrale se pose sur son île (ses cases N,
   city.cathedral) et remplace ce qui s'y trouverait. Un modèle 3D sur mesure :
   la façade à deux tours et sa rose, la nef et ses bas-côtés, les arcs-boutants,
   le transept, la flèche, le chevet arrondi. Les murs, toits et contreforts
   sont une seule géométrie à couleurs de sommets ; les vitraux, portails et
   galeries sont peints dans de petites textures (palette du jeu) collées sur
   les murs.

   Repère du modèle : la façade à x = 0 (tournée vers −x), le chevet à
   x = L, la largeur le long de z ; y vers le haut. Puis tourné et posé selon
   `facing` (W, E, N, S : où regarde la façade). */
import { PAL } from './palette.js?v=2.1.0';
import { hash } from './city.js?v=2.1.0';
import { createMesher, TONES } from './geo.js?v=2.1.0';
import { CELL } from './scale.js?v=2.1.0';

const TOWER_H = 520, CENTER_H = 360, NAVE_H = 290, AISLE_H = 170, NAVE_RIDGE = 375, TRANSEPT_H = 250;

// ─── Les petites textures peintes (y compté depuis le bas) ───
function painter(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = (x, y, ww, hh, key) => { g.fillStyle = PAL[key]; g.fillRect(Math.round(x), Math.round(h - y - hh), Math.round(ww), Math.round(hh)); };
  const P = (x, y, key) => R(x, y, 1, 1, key);
  // une ogive : centre cx, du pied y0, demi-largeur hw, droite sur hs puis en pointe sur hp
  const ogive = (cx, y0, hw, hs, hp, key, inner = null) => {
    for (let x = -hw; x <= hw; x++) {
      const top = hs + hp * (1 - Math.pow(Math.abs(x) / (hw + 0.5), 1.7));
      R(cx + x, y0, 1, top, key);
    }
    return inner;
  };
  return { c, g, R, P, ogive, w, h };
}
const texture = (THREE, c) => {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
};

function rose(p, cx, cy, r) {
  const { P, R } = p;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r) continue;
    if (d > r - 2) P(cx + x, cy + y, 'pierreS');
    else if (d > r - 5) P(cx + x, cy + y, 'pierreL');
    else if (d < 4) P(cx + x, cy + y, 'ocre');
    else if (Math.abs(d - r * 0.5) < 0.7) P(cx + x, cy + y, 'pierreS');
    else P(cx + x, cy + y, (Math.round(Math.atan2(y, x) * 6 / Math.PI) & 1) === 0 ? (d < r * 0.55 ? 'ocre' : 'ocreS') : 'nuit');
  }
  void R;
}

function paintFacade(D) {
  const W = D, H = TOWER_H, tw = D / 3, p = painter(W, H), { R, P, ogive } = p;
  const body = (x, w, hh) => { R(x, 0, w, hh, 'pierre'); };
  body(0, tw, TOWER_H); body(tw, tw, CENTER_H); body(2 * tw, tw, TOWER_H);
  // du grain, deux tons de pierre
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x++) {
    const inside = (x < tw || x >= 2 * tw) || y < CENTER_H;
    if (inside && hash(x, y, 91) < 0.045) P(x, y, 'pierreL');
  }
  R(0, 0, W, 6, 'pierreS');                                   // le soubassement
  // les contreforts verticaux
  for (const x of [0, tw - 4, tw, 2 * tw - 4, 2 * tw, W - 4]) R(x, 6, 4, x === tw - 4 || x === 2 * tw ? CENTER_H : x === tw || x === 2 * tw - 4 ? CENTER_H : TOWER_H - 6, 'pierreL');
  for (const x of [tw - 4, 2 * tw]) R(x, CENTER_H, 4, TOWER_H - CENTER_H, 'pierreL');
  // les trois portails
  const portal = (cx, hw, hs, hp) => {
    ogive(cx, 6, hw + 5, hs + 4, hp + 4, 'pierreL');
    ogive(cx, 6, hw + 2, hs + 2, hp + 2, 'pierreS');
    ogive(cx, 6, hw, hs, hp, 'nuit');
    R(cx, 6, 1, hs, 'pierreS');                                // le trumeau
    R(cx - hw, 6 + hs - 6, hw * 2 + 1, 2, 'pierreS');          // le linteau
    for (let k = 0; k < 4; k++) ogive(cx, 6 + hs - 4, hw - 3 - k * 2, 2, hp - 2 - k * 3, k % 2 ? 'pierreS' : 'nuit2');  // le tympan
  };
  portal(W / 2, 20, 50, 34); portal(tw / 2, 14, 38, 26); portal(W - tw / 2, 14, 38, 26);
  // la galerie des rois : des niches en rang
  R(0, 112, W, 3, 'pierreL'); R(0, 113, W, 1, 'neige');
  R(0, 138, W, 3, 'pierreL'); R(0, 140, W, 1, 'neige');
  for (let x = 6; x < W - 6; x += 9) { R(x, 118, 5, 14, 'nuit'); R(x + 1, 132, 3, 2, 'nuit'); R(x + 2, 134, 1, 1, 'nuit'); }
  // la rose, et sa galerie
  rose(p, W / 2, 220, 36);
  R(tw + 6, 262, tw - 12, 2, 'pierreL');
  for (let x = tw + 8; x < 2 * tw - 8; x += 8) { ogive(x + 2, 266, 2, 20, 8, 'nuit'); }
  R(tw, 296, tw, 3, 'pierreL'); R(tw, 298, tw, 1, 'neige');
  // la balustrade ajourée au sommet de la partie centrale
  R(tw, CENTER_H - 10, tw, 3, 'pierreL');
  for (let x = tw; x < 2 * tw; x += 4) R(x, CENTER_H - 7, 2, 7, 'nuit2');
  R(tw, CENTER_H - 1, tw, 2, 'neige');
  // les tours : deux hautes baies à abat-sons, une corniche, une balustrade
  for (const t of [0, 2]) {
    const x0 = t * tw;
    R(x0 + 4, 296, tw - 8, 3, 'pierreL'); R(x0 + 4, 298, tw - 8, 1, 'neige');
    for (const cx of [x0 + tw * 0.3, x0 + tw * 0.7]) {
      ogive(cx, 316, 9, 96, 16, 'pierreL');
      ogive(cx, 318, 7, 94, 14, 'nuit');
      for (let y = 322; y < 420; y += 4) R(cx - 6, y, 13, 1, 'pierreS');          // les abat-sons
    }
    ogive(x0 + tw * 0.3, 190, 4, 40, 10, 'nuit'); ogive(x0 + tw * 0.7, 190, 4, 40, 10, 'nuit');   // de petites baies plus bas
    R(x0 + 4, 478, tw - 8, 4, 'pierreL'); for (let x = x0 + 5; x < x0 + tw - 5; x += 3) R(x, 482, 1, 3, 'pierreS');   // les corbeaux
    R(x0 + 4, TOWER_H - 14, tw - 8, 3, 'pierreL');
    for (let x = x0 + 6; x < x0 + tw - 6; x += 4) R(x, TOWER_H - 11, 2, 8, 'nuit2');
    R(x0, TOWER_H - 3, tw, 3, 'neige');
  }
  return p.c;
}

function paintTowerSide(tw) {
  const p = painter(tw, TOWER_H), { R, P, ogive } = p;
  R(0, 0, tw, TOWER_H, 'pierre');
  for (let y = 0; y < TOWER_H; y += 2) for (let x = 0; x < tw; x++) if (hash(x, y, 92) < 0.05) P(x, y, 'pierreL');
  R(0, 0, tw, 6, 'pierreS');
  R(0, 6, 4, TOWER_H - 6, 'pierreL'); R(tw - 4, 6, 4, TOWER_H - 6, 'pierreL');
  for (const y of [112, 296, 478]) { R(0, y, tw, 3, 'pierreL'); R(0, y + 2, tw, 1, 'neige'); }
  ogive(tw / 2, 130, 4, 70, 14, 'nuit');
  ogive(tw / 2, 316, 9, 96, 16, 'pierreL'); ogive(tw / 2, 318, 7, 94, 14, 'nuit');
  for (let y = 322; y < 420; y += 4) R(tw / 2 - 6, y, 13, 1, 'pierreS');
  R(0, TOWER_H - 14, tw, 3, 'pierreL');
  for (let x = 6; x < tw - 6; x += 4) R(x, TOWER_H - 11, 2, 8, 'nuit2');
  R(0, TOWER_H - 3, tw, 3, 'neige');
  return p.c;
}

// Les vitraux d'un mur à travées : une lancette par travée, quelques-unes éclairées
function paintBays(len, h, kind, seed) {
  const p = painter(len, h), { R, P, ogive } = p;
  const n = Math.max(3, Math.round(len / 46)), bay = len / n;
  R(0, 0, len, h, 'pierre');
  for (let y = 0; y < h; y += 2) for (let x = 0; x < len; x++) if (hash(x, y, 93, seed) < 0.05) P(x, y, 'pierreL');
  if (kind === 'aisle') R(0, 0, len, 5, 'pierreS');
  for (let k = 0; k < n; k++) {
    const x0 = k * bay, cx = Math.round(x0 + bay / 2), lit = hash(k, seed, 94) < 0.28;
    R(x0, kind === 'aisle' ? 5 : 0, 5, h, 'pierreL');                              // le contrefort
    if (kind === 'aisle') {
      ogive(cx, 24, 8, 62, 24, 'pierreL'); ogive(cx, 26, 6, 60, 22, lit ? 'ocre' : 'nuit');
      R(cx, 26, 1, 70, 'pierreS'); R(cx - 6, 70, 13, 1, 'pierreS');                 // le meneau et la traverse
      ogive(cx, 26, 3, 34, 12, lit ? 'ocreS' : 'nuit2');
    } else {
      ogive(cx, 6, 6, 40, 16, 'pierreL'); ogive(cx, 8, 4, 38, 14, lit ? 'ocre' : 'nuit');
      R(cx, 8, 1, 50, 'pierreS');
    }
  }
  R(len - 5, kind === 'aisle' ? 5 : 0, 5, h, 'pierreL');
  R(0, h - 8, len, 4, 'pierreL'); R(0, h - 5, len, 1, 'neige');                     // la corniche
  return p.c;
}

function paintTranseptEnd(w, h) {
  const p = painter(w, h), { R, P, ogive } = p;
  R(0, 0, w, h, 'pierre');
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x++) if (hash(x, y, 95) < 0.05) P(x, y, 'pierreL');
  R(0, 0, w, 6, 'pierreS'); R(0, 6, 4, h - 6, 'pierreL'); R(w - 4, 6, 4, h - 6, 'pierreL');
  rose(p, w / 2, 170, 25);
  for (const cx of [w * 0.22, w * 0.5, w * 0.78]) { ogive(Math.round(cx), 14, 5, 52, 18, 'pierreL'); ogive(Math.round(cx), 16, 3, 50, 16, 'nuit'); }
  R(0, 108, w, 3, 'pierreL'); R(0, 110, w, 1, 'neige');
  R(0, h - 4, w, 3, 'pierreL');
  return p.c;
}

// ─── Le modèle ───
export function buildCathedral(THREE, cat) {
  const alongX = cat.facing === 'W' || cat.facing === 'E';
  const L = (alongX ? cat.w : cat.d) * CELL - 4, D = (alongX ? cat.d : cat.w) * CELL - 4;
  const tw = D / 3, apseR = D * 0.4, xa = L - apseR;
  const zn0 = D * 0.29, zn1 = D * 0.71, za0 = D * 0.1, za1 = D * 0.9;
  const xt = tw + (xa - tw) * 0.55;
  const m = createMesher(THREE);

  // ─ les tours et la façade ─
  m.box(tw / 2, 0, tw / 2, tw, TOWER_H, tw, TONES.stone, { up: 'neige' });
  m.box(D - tw / 2, 0, D - tw / 2, tw, TOWER_H, tw, TONES.stone, { up: 'neige' });
  m.box(tw / 2, 0, D / 2, tw, CENTER_H, tw, TONES.stone, { up: 'neige' });
  for (const [cz] of [[tw / 2], [D - tw / 2]]) {          // des pinacles aux angles des tours
    for (const [sx, sz] of [[0, -1], [0, 1], [1, -1], [1, 1]]) m.box(sx * (tw - 4) + 2, TOWER_H, cz + sz * (tw / 2 - 2), 4, 12, 4, TONES.stone, { up: 'neige' });
  }
  // ─ la nef, ses bas-côtés, leurs toits ─
  m.box((tw + xa) / 2, 0, D / 2, xa - tw, NAVE_H, zn1 - zn0, TONES.stone);
  m.box((tw + xa) / 2, 0, (za0 + zn0) / 2, xa - tw, AISLE_H, zn0 - za0, TONES.stone);
  m.box((tw + xa) / 2, 0, (zn1 + za1) / 2, xa - tw, AISLE_H, za1 - zn1, TONES.stone);
  m.prism(tw, 0, 'x', [[zn0 - 6, NAVE_H], [D / 2, NAVE_RIDGE], [zn1 + 6, NAVE_H]], xa - tw, TONES.slate, {});
  m.box((tw + xa) / 2, NAVE_RIDGE - 1, D / 2, xa - tw, 3, 6, TONES.snow, { fixed: 'neige' });          // le faîte sous la neige
  m.prism(tw, 0, 'x', [[za0 - 5, AISLE_H], [zn0, AISLE_H + 52]], xa - tw, TONES.slate, { up: 'neige', snow: 0.5 });
  m.prism(tw, 0, 'x', [[zn1, AISLE_H + 52], [za1 + 5, AISLE_H]], xa - tw, TONES.slate, { up: 'neige', snow: 0.5 });
  // ─ les arcs-boutants, travée par travée ─
  const bays = Math.max(3, Math.round((xa - tw) / 46)), bayW = (xa - tw) / bays;
  for (let k = 0; k < bays; k++) {
    const xb = tw + bayW * k + bayW / 2 + bayW / 2 - 1;
    if (xb > xa - 6) continue;
    for (const side of [-1, 1]) {
      const zp = side < 0 ? za0 - 9 : za1 + 9, zw = side < 0 ? zn0 : zn1;
      m.box(xb, 0, zp, 8, AISLE_H + 36, 8, TONES.stone, { up: 'neige' });                      // la culée
      m.box(xb, AISLE_H + 36, zp, 5, 14, 5, TONES.stone, { up: 'neige' });                      // son pinacle
      const dz = Math.abs(zw - zp), dy = 44, len = Math.hypot(dz, dy), phi = Math.atan2(dy, dz);
      m.box(xb, AISLE_H + 42 + dy / 2 - 2.5, (zp + zw) / 2, 5, 5, len, TONES.stone, { up: 'neige', snow: 0.4 }, side < 0 ? 0 : Math.PI, -phi);
    }
  }
  // ─ le transept ─
  m.box(xt, 0, D / 2, 76, TRANSEPT_H, D * 0.94, TONES.stone);
  m.prism(0, D * 0.03, 'z', [[xt - 41, TRANSEPT_H], [xt, TRANSEPT_H + 70], [xt + 41, TRANSEPT_H]], D * 0.94, TONES.slate, { endKey: 'pierre' }, { a: true, b: true });
  m.box(xt, TRANSEPT_H + 69, D / 2, 6, 3, D * 0.94, TONES.snow, { fixed: 'neige' });
  // ─ le chevet : déambulatoire bas, chœur haut, en demi-polygones ─
  m.cyl(xa, 0, D / 2, apseR, apseR, AISLE_H, 6, TONES.stone, {}, 0, Math.PI);
  m.cone(xa, AISLE_H, D / 2, apseR + 6, 46, 6, TONES.slate, { up: 'neige', snow: 0.5 }, 0, Math.PI);
  m.cyl(xa, 0, D / 2, apseR * 0.56, apseR * 0.56, NAVE_H, 6, TONES.stone, {}, 0, Math.PI);
  m.cone(xa, NAVE_H, D / 2, apseR * 0.56 + 6, 86, 6, TONES.slate, {}, 0, Math.PI);
  m.box(xa - 1, 0, D / 2, 4, NAVE_H, zn1 - zn0, TONES.stone);
  // ─ la flèche, sur la croisée ─
  m.cyl(xt, NAVE_RIDGE - 14, D / 2, 17, 19, 34, 8, TONES.stone, { up: 'neige' });
  m.cone(xt, NAVE_RIDGE + 20, D / 2, 16, 170, 8, TONES.slate, {});
  m.cyl(xt, NAVE_RIDGE + 190, D / 2, 0.6, 0.6, 18, 4, TONES.black);
  m.box(xt, NAVE_RIDGE + 198, D / 2, 8, 1.4, 1.4, TONES.black);
  const body = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));

  // ─ les textures collées sur les murs ─
  const group = new THREE.Group();
  group.add(body);
  const decal = (canvas, w, h, x, y, z, ry) => {
    const mat = new THREE.MeshBasicMaterial({ map: texture(THREE, canvas), alphaTest: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y + h / 2, z); mesh.rotation.y = ry;
    group.add(mesh);
    return mesh;
  };
  decal(paintFacade(D), D, TOWER_H, -0.4, 0, D / 2, -Math.PI / 2);
  const side = paintTowerSide(tw);
  decal(side, tw, TOWER_H, tw / 2, 0, -0.4, Math.PI);
  decal(side, tw, TOWER_H, tw / 2, 0, D + 0.4, 0);
  decal(side, tw, TOWER_H, tw + 0.4, 0, tw / 2, Math.PI / 2);
  decal(side, tw, TOWER_H, tw + 0.4, 0, D - tw / 2, Math.PI / 2);
  const La = xa - tw;
  decal(paintBays(La, AISLE_H, 'aisle', 1), La, AISLE_H, (tw + xa) / 2, 0, za0 - 0.4, Math.PI);
  decal(paintBays(La, AISLE_H, 'aisle', 2), La, AISLE_H, (tw + xa) / 2, 0, za1 + 0.4, 0);
  const cl = NAVE_H - (AISLE_H + 52);
  decal(paintBays(La, cl, 'clere', 3), La, cl, (tw + xa) / 2, AISLE_H + 52, zn0 - 0.4, Math.PI);
  decal(paintBays(La, cl, 'clere', 4), La, cl, (tw + xa) / 2, AISLE_H + 52, zn1 + 0.4, 0);
  const te = paintTranseptEnd(76, TRANSEPT_H);
  decal(te, 76, TRANSEPT_H, xt, 0, D * 0.03 - 0.4, Math.PI);
  decal(te, 76, TRANSEPT_H, xt, 0, D * 0.97 + 0.4, 0);

  // ─ posé sur l'île, tourné vers son parvis ─
  const inner = new THREE.Group();
  inner.add(group);
  inner.position.set(-L / 2, 0, -D / 2);
  const outer = new THREE.Group();
  outer.add(inner);
  outer.rotation.y = { W: 0, E: Math.PI, N: -Math.PI / 2, S: Math.PI / 2 }[cat.facing];
  outer.position.set((cat.i0 + cat.w / 2) * CELL, 0, (cat.j0 + cat.d / 2) * CELL);
  return outer;
}
