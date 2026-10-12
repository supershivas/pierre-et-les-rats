/* Le monde en 3D (three.js) : le sol, la Seine et ses quais, les ponts, les
   immeubles, Notre-Dame, le mobilier. Tout est en matériaux non éclairés et
   en couleurs de la palette (palette.js).

   - Le sol : une texture d'un octet par pixel du monde (indice de palette),
     lue par un petit shader qui retrouve la couleur exacte. L'eau est un peu
     plus bas que les rues, bordée de murs de quai.
   - Un immeuble : une géométrie (quatre murs, un toit à la Mansart ou à deux
     pans, des lucarnes, des cheminées) et une texture d'indices de 4 faces
     côte à côte, peinte par le générateur 2D (buildings.js) : les deux faces
     vues de l'isométrique directement, les deux autres en le faisant tourner
     d'un demi-tour. Un shader « coupe » : les étages au-dessus du rez-de-
     chaussée s'abaissent, pour voir la rue derrière un immeuble (maison de
     poupée).
   - Le mobilier : des instances de modèles (props3d.js).
   - Notre-Dame : un seul bloc (cathedral3d.js). */
import { PAL, PALETTE, PALETTE_RGB, PAL_INDEX } from './palette.js?v=2.1.0';
import { CELL, FLOOR } from './scale.js?v=2.1.0';
import { hash, hash3 } from './city.js?v=2.1.0';
import { renderColumn } from './buildings.js?v=2.1.0';
import { makeGroundColor } from './ground.js?v=2.1.0';
import { createMesher, TONES } from './geo.js?v=2.1.0';
import { buildPropGeometries } from './props3d.js?v=2.1.0';
import { buildCathedral } from './cathedral3d.js?v=2.1.0';
import { PROP_TYPES } from './props.js?v=2.1.0';

export const WATER_Y = -70;                    // la Seine, 3,5 m (plus d'un étage) sous les quais
const SLAB = 9;                                // l'épaisseur d'un tablier de pont
const MAX_CUT_DIST = 900;
const CUT_H = 24;                              // un immeuble coupé : un muret de 1,2 m, plus bas que Pierre


// La lumière des réverbères les plus proches (16 au plus, mise à jour par setLights) : un halo doux,
// pas tramé, qui éclaire le sol, l'eau et les façades
const LIGHT_GLSL = `
uniform vec4 uL[16];
vec3 lighten(vec3 c, vec3 p) {
  float k = 0.0;
  for (int i = 0; i < 16; i++) {
    vec4 l = uL[i];
    if (l.w > 0.0) { float t = clamp(1.0 - length(p - vec3(l.x, 62.0, l.y)) / l.z, 0.0, 1.0); k += l.w * t * t; }
  }
  k = min(k, 1.2);
  return min(vec3(1.0), c * (1.0 + 1.35 * k) + vec3(0.05, 0.06, 0.08) * k);
}`;

// ─── Les shaders : des indices de palette ───
const GROUND_VS = `
varying vec2 vUv; varying vec3 vP;
void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const INDEXED_FS = `
uniform sampler2D map; uniform sampler2D pal; uniform float palN;
${LIGHT_GLSL}
varying vec2 vUv; varying vec3 vP;
void main() {
  float i = floor(texture2D(map, vUv).r * 255.0 + 0.5);
  gl_FragColor = vec4(lighten(texture2D(pal, vec2((i + 0.5) / palN, 0.5)).rgb, vP), 1.0);
}`;
const BUILD_VS = `
attribute vec3 aCol; attribute float aMode; attribute float aRoof;
uniform float uCut; uniform float uH;
varying vec2 vUv; varying vec3 vCol; varying float vMode; varying vec3 vP;
void main() {
  vec3 p = position;
  // la coupe : au-dessus de CUT_H (un muret plus bas que Pierre), tout descend dessus
  float y2 = p.y <= ${CUT_H}.0 ? p.y : ${CUT_H}.0 + (p.y - ${CUT_H}.0) * (1.0 - uCut);
  if (aRoof > 0.5 && uCut > 0.999) y2 = -9999.0;
  if (aMode > 2.5) y2 += 0.1;                 // le liseré, juste au-dessus de la tranche
  p.y = y2;
  vUv = vec2(uv.x, y2 / uH);
  vCol = aCol; vMode = aMode; vP = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BUILD_FS = `
uniform sampler2D map; uniform sampler2D pal; uniform float palN; uniform float uCut; uniform vec3 uSlice;
${LIGHT_GLSL}
varying vec2 vUv; varying vec3 vCol; varying float vMode; varying vec3 vP;
void main() {
  vec3 c = vCol;
  if (vMode < 0.5) {
    float i = floor(texture2D(map, vUv).r * 255.0 + 0.5);
    if (i > 250.0) discard;
    c = texture2D(pal, vec2((i + 0.5) / palN, 0.5)).rgb;
  } else if (vMode > 1.5 && vMode < 2.5 && uCut > 0.02) c = uSlice;
  else if (vMode > 2.5 && uCut < 0.02) discard;
  gl_FragColor = vec4(lighten(c, vP), 1.0);
}`;

// Cède la main au navigateur de temps en temps (le chargement ne fige pas l'écran)
let lastYield = 0;
export async function tick(force = false) {
  const now = performance.now();
  if (force || now - lastYield > 40) { await new Promise(r => setTimeout(r, 0)); lastYield = performance.now(); }
}

export async function buildWorld(THREE, city, { onProgress = () => {} } = {}) {
  const root = new THREE.Group();
  const GW = city.w * CELL, GH = city.h * CELL;
  const nearest = tex => { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace; return tex; };

  // la palette, une texture de 9 × 1
  const palData = new Uint8Array(PALETTE.length * 4);
  PALETTE_RGB.forEach((c, i) => { palData.set([...c, 255], i * 4); });
  const palTex = nearest(new THREE.DataTexture(palData, PALETTE.length, 1, THREE.RGBAFormat));
  palTex.needsUpdate = true;
  const rgbKey = new Map(PALETTE_RGB.map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));
  const indexOfRGB = (r, g, b) => {
    const k = (r << 16) | (g << 8) | b, v = rgbKey.get(k);
    if (v !== undefined) return v;
    let best = 0, bd = Infinity;
    PALETTE_RGB.forEach((c, i) => { const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < bd) { bd = d; best = i; } });
    rgbKey.set(k, best);
    return best;
  };
  const byteTexture = (data, w, h) => {
    const t = nearest(new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType));
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    t.onUpdate = () => { t.image.data = null; };    // la mémoire du processeur est rendue une fois envoyée
    return t;
  };

  // en attendant sa façade, un immeuble est d'une seule pierre
  const flatTex = byteTexture(new Uint8Array([PAL_INDEX.pierre]), 1, 1);

  let waterMat = null;
  // ─── Le sol : une texture, un pixel par pixel du monde ───
  onProgress('Le sol…');
  const colorAt = makeGroundColor(city, { quayWalls: false, pits: true });
  const waterAt = (x, y) => city.kind(x, y) === '~';
  const gdata = new Uint8Array(GW * GH);
  const nuitIdx = PAL_INDEX.nuit;
  for (let y = 0; y < GH; y++) {
    const cj = (y / CELL) | 0;
    for (let x = 0; x < GW; x++) {
      const ci = (x / CELL) | 0;
      let key = colorAt(x + 0.5, y + 0.5);
      // un liseré de neige sur le bord du quai, côté eau
      if (key && city.kind(ci, cj) !== '~' && city.kind(ci, cj) !== '=') {
        const a = x - ci * CELL, b = y - cj * CELL;
        if ((a < 2 && waterAt(ci - 1, cj)) || (a >= CELL - 2 && waterAt(ci + 1, cj)) || (b < 2 && waterAt(ci, cj - 1)) || (b >= CELL - 2 && waterAt(ci, cj + 1))) key = 'neige';
      }
      gdata[y * GW + x] = key ? PAL_INDEX[key] : nuitIdx;
    }
    if ((y & 31) === 0) await tick();
  }
  const lightU = { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 1, 0)) };
  const groundMat = new THREE.ShaderMaterial({ uniforms: { map: { value: byteTexture(gdata, GW, GH) }, pal: { value: palTex }, palN: { value: PALETTE.length }, uL: lightU }, vertexShader: GROUND_VS, fragmentShader: INDEXED_FS });
  {
    const pos = [], uv = [];
    const quad = (x0, z0, y, u0, v0) => {
      const x1 = x0 + CELL, z1 = z0 + CELL, ua = u0 / GW, ub = (u0 + CELL) / GW, va = v0 / GH, vb = (v0 + CELL) / GH;
      pos.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      uv.push(ua, va, ua, vb, ub, va, ub, va, ua, vb, ub, vb);
    };
    const wpos = [];                                  // l'eau, à part
    const wquad = (x0, z0) => { const x1 = x0 + CELL, z1 = z0 + CELL, y = WATER_Y; wpos.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1); };
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      const k = city.kind(i, j);
      if (k === '~' || k === '=') wquad(i * CELL, j * CELL);   // (sous un pont aussi)
      if (k !== '~') quad(i * CELL, j * CELL, 0, i * CELL, j * CELL);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    const ground = new THREE.Mesh(g, groundMat);
    ground.frustumCulled = false;
    root.add(ground);
    root.userData.ground = ground;
    // La Seine : un petit motif qui se répète (glaçons, rides), lu en coordonnées du monde et
    // qui glisse vers l'est ; une seconde couche de rides, plus lente, en sens contraire
    const WW = 144, WH = 96, wd = new Uint8Array(WW * WH);
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const n = hash3(x, y, 3), fx = Math.floor(x / 9), fy = Math.floor(y / 6);
      let key;
      if (hash3(fx, fy, 7) < 0.2) { const edge = x % 9 < 1 || y % 6 < 1; key = edge ? 'neigeO' : n < 0.15 ? 'neigeM' : n < 0.4 ? 'neige' : 'neigeM'; }
      else key = n < 0.06 ? 'ardoise' : 'nuit2';
      wd[y * WW + x] = PAL_INDEX[key];
    }
    const wtex = byteTexture(wd, WW, WH);
    wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
    wtex.onUpdate = null;
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    waterMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: wtex }, pal: { value: palTex }, palN: { value: PALETTE.length }, uL: lightU, uT: { value: 0 }, uBase: { value: PAL_INDEX.nuit2 }, uFleck: { value: PAL_INDEX.neigeO } },
      vertexShader: `varying vec2 vW; varying vec3 vP; void main() { vW = position.xz; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D map; uniform sampler2D pal; uniform float palN; uniform float uT; uniform float uBase; uniform float uFleck;
        ${LIGHT_GLSL}
        varying vec2 vW; varying vec3 vP;
        void main() {
          vec2 sz = vec2(${WW}.0, ${WH}.0);
          float a = floor(texture2D(map, floor(vW + vec2(uT * 5.0, sin(uT * 0.4) * 2.0)) / sz).r * 255.0 + 0.5);
          float b = floor(texture2D(map, floor(vW * vec2(1.0, 1.3) + vec2(31.0 - uT * 3.0, 17.0 + uT * 1.5)) / sz).r * 255.0 + 0.5);
          // des rides qui luisent là où l'eau est nue
          if (abs(a - uBase) < 0.5 && abs(b - uBase) > 0.5 && abs(b - uFleck) > 0.5 && mod(floor(vW.x * 0.5 + vW.y + uT * 2.0), 7.0) < 1.0) a = uFleck;
          gl_FragColor = vec4(lighten(texture2D(pal, vec2((a + 0.5) / palN, 0.5)).rgb, vP), 1.0);
        }`,
    });
    const water = new THREE.Mesh(wg, waterMat);
    water.frustumCulled = false;
    root.add(water);
  }

  // ─── Les quais et les ponts ───
  {
    const m = createMesher(THREE);
    const kindIs = (x, y, kk) => city.kind(x, y) === kk;
    // un garde-corps de fonte sur un petit soubassement de pierre : des barreaux, deux lisses, la neige dessus
    const rail = (mm, ex, ez, dx, dz) => {
      mm.box(ex, 0, ez, dx ? 3.2 : CELL, 3, dz ? 3.2 : CELL, TONES.stone, { up: 'neige' });
      mm.box(ex, 11, ez, dx ? 1.6 : CELL, 1.4, dz ? 1.6 : CELL, TONES.iron, { up: 'neige' });
      mm.box(ex, 6, ez, dx ? 1 : CELL, 1, dz ? 1 : CELL, TONES.iron);
      for (let t = -27; t <= 27; t += 6) mm.box(ex + (dx ? 0 : t), 3, ez + (dz ? 0 : t), 1.2, t % 18 === 0 || Math.abs(t) === 27 ? 9 : 8, 1.2, TONES.black, { fixed: 'nuit' });
    };
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      const k = city.kind(i, j), cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
      if (k === '~') continue;
      // le mur du quai : contre l'eau, côté terre (sa face regarde l'eau)
      if (k !== '=') {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!waterAt(i + dx, j + dz)) continue;
          const bx = cx + dx * (CELL / 2 - 2), bz = cz + dz * (CELL / 2 - 2);
          m.box(bx, WATER_Y, bz, dx ? 4 : CELL, -WATER_Y - 0.4, dz ? 4 : CELL, TONES.stone);
          rail(m, bx, bz, dx, dz);
        }
        continue;
      }
      // le pont : un tablier, des parapets sur les bords qui dominent l'eau
      m.box(cx, -SLAB, cz, CELL, SLAB - 0.4, CELL, TONES.stone);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!waterAt(i + dx, j + dz)) continue;
        rail(m, cx + dx * (CELL / 2 - 2), cz + dz * (CELL / 2 - 2), dx, dz);
      }
      // des piles sous le tablier, toutes les trois cases, sur toute la largeur du pont
      const along = kindIs(i - 1, j, '=') || kindIs(i + 1, j, '=') ? i : j;
      if (along % 3 === 0) m.box(cx, WATER_Y, cz, kindIs(i - 1, j, '=') || kindIs(i + 1, j, '=') ? 12 : CELL, -WATER_Y - SLAB, kindIs(i - 1, j, '=') || kindIs(i + 1, j, '=') ? CELL : 12, TONES.stone);
    }
    const mesh = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    root.add(mesh);
  }

  // ─── Les immeubles ───
  const mats = { map: null };
  const rotated = {
    w: city.w, h: city.h, seed: city.seed,
    at: (x, y) => city.at(city.w - 1 - x, city.h - 1 - y),
    kind: (x, y) => city.kind(city.w - 1 - x, city.h - 1 - y),
    isWater: (x, y) => city.isWater(city.w - 1 - x, city.h - 1 - y),
  };
  const buildings = [];
  const chimneys = [];                                         // [x, y, z] du haut de chaque souche, pour la fumée
  const roofTones = { slate: ['ardoise', 'ardoise', 'nuit2'] };
  const TEX_W = CELL * 4;

  // une face de l'image isométrique, remise à plat dans la texture d'indices
  function fillFace(tex, H, face, col, which, openEnd) {
    const src = col.data, CW = col.w, base = col.h - 1;
    for (let u = 0; u < CELL; u++) {
      for (let z = 0; z < H; z++) {
        const sx = which === 'A' ? u : CELL + u;
        const sy = which === 'A' ? base + Math.floor((u - CELL) / 2) - z : base + Math.floor(-u / 2) - z;
        const o = (sy * CW + sx) * 4;
        let idx = src[o + 3] ? indexOfRGB(src[o], src[o + 1], src[o + 2]) : PAL_INDEX.pierreS;
        if (openEnd && z >= 1 && z < FLOOR) {
          // l'arche d'un passage : le vide, qu'on traverse
          const dx = Math.abs(u - 29.5);
          if (dx <= 17 && (z < 44 || (dx / 17) ** 2 + ((z - 44) / 12) ** 2 <= 1) && !(dx < 2 && z >= 38 && z <= 41)) idx = 255;
        }
        tex[z * TEX_W + face * CELL + u] = idx;
      }
    }
  }

  function buildBuilding(i, j, n) {
    const kind = city.kind(i, j), H = n * FLOOR, old = n <= 3;
    const ox = i * CELL, oz = j * CELL;
    const passage = kind === 'P';
    const ns = passage && city.walk(i, j - 1) && city.walk(i, j + 1);
    const ew = passage && !ns && city.walk(i - 1, j) && city.walk(i + 1, j);
    // la peinture des façades (le plus long) vient après, en deux temps (voir paintSome)
    let tex = null;
    const steps = [
      () => {
        tex = new Uint8Array(TEX_W * H);
        const col = renderColumn(city, i, j, { night: true, all: true, roof: false, raw: true });
        fillFace(tex, H, 0, col, 'A', ns); fillFace(tex, H, 1, col, 'B', ew);
      },
      () => {
        const colR = renderColumn(rotated, city.w - 1 - i, city.h - 1 - j, { night: true, all: true, roof: false, raw: true });
        fillFace(tex, H, 2, colR, 'A', ns); fillFace(tex, H, 3, colR, 'B', ew);
        mat.uniforms.map.value = byteTexture(tex, TEX_W, H);
      },
    ];

    const pos = [], uv = [], cols = [], mode = [], roofF = [];
    const vtx = (x, y, z, u, c, md, rf) => { pos.push(x, y, z); uv.push(u, 0); cols.push(c[0], c[1], c[2]); mode.push(md); roofF.push(rf); };
    const none = [0, 0, 0];
    // un mur : coins BL, BR (en bas), vus de l'extérieur, la texture de la face f
    const wall = (f, bl, br) => {
      const u0 = f * CELL / TEX_W, u1 = (f + 1) * CELL / TEX_W;
      vtx(bl[0], 0, bl[1], u0, none, 0, 0); vtx(br[0], 0, br[1], u1, none, 0, 0); vtx(br[0], H, br[1], u1, none, 0, 0);
      vtx(bl[0], 0, bl[1], u0, none, 0, 0); vtx(br[0], H, br[1], u1, none, 0, 0); vtx(bl[0], H, bl[1], u0, none, 0, 0);
    };
    wall(0, [0, CELL], [CELL, CELL]);        // +z
    wall(1, [CELL, CELL], [CELL, 0]);        // +x
    wall(2, [CELL, 0], [0, 0]);              // −z
    wall(3, [0, 0], [0, CELL]);              // −x
    const fixed = key => { const c = PAL[key]; return [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]; };
    // le dessus des murs : la neige, ou la tranche sombre quand l'immeuble est coupé
    const top = fixed('neige');
    vtx(0, H, 0, 0, top, 2, 0); vtx(0, H, CELL, 0, top, 2, 0); vtx(CELL, H, 0, 0, top, 2, 0);
    vtx(CELL, H, 0, 0, top, 2, 0); vtx(0, H, CELL, 0, top, 2, 0); vtx(CELL, H, CELL, 0, top, 2, 0);
    // un liseré de pierre sur le bord de la tranche (la dalle coupée), un peu en retrait
    {
      const rim = fixed('pierreL'), y = H + 0.05, e = 2.5;
      const q = (x0, z0, x1, z1) => { for (const p of [[x0, z0], [x0, z1], [x1, z0], [x1, z0], [x0, z1], [x1, z1]]) vtx(p[0], y, p[1], 0, rim, 3, 0); };
      q(0, 0, CELL, e); q(0, CELL - e, CELL, CELL); q(0, e, e, CELL - e); q(CELL - e, e, CELL, CELL - e);
    }
    if (passage) {
      // dans le passage : les murs, le plafond, sombres
      const dark = fixed('nuit2'), ceil = fixed('nuit');
      const q = (a, b, c, d, color) => { for (const p of [a, b, c, a, c, d]) vtx(p[0], p[1], p[2], 0, color, 1, 0); };
      if (ns) { q([2, 0, CELL], [2, 0, 0], [2, FLOOR, 0], [2, FLOOR, CELL], dark); q([CELL - 2, 0, 0], [CELL - 2, 0, CELL], [CELL - 2, FLOOR, CELL], [CELL - 2, FLOOR, 0], dark); }
      else if (ew) { q([CELL, 0, CELL - 2], [0, 0, CELL - 2], [0, FLOOR, CELL - 2], [CELL, FLOOR, CELL - 2], dark); q([0, 0, 2], [CELL, 0, 2], [CELL, FLOOR, 2], [0, FLOOR, 2], dark); }
      q([0, FLOOR, 0], [CELL, FLOOR, 0], [CELL, FLOOR, CELL], [0, FLOOR, CELL], ceil);
    }

    // le toit
    const m = createMesher(THREE);
    const same = (x, y) => city.at(x, y) === n && city.kind(x, y) === kind;
    const alongX = (same(i - 1, j) + same(i + 1, j)) >= (same(i, j - 1) + same(i, j + 1));
    const axis = alongX ? 'x' : 'z';
    const endA = alongX ? city.at(i - 1, j) : city.at(i, j - 1), endB = alongX ? city.at(i + 1, j) : city.at(i, j + 1);
    const ends = { a: endA < n, b: endB < n };
    const pg = (a, b) => a;  void pg;
    let ridge;
    if (!old) {
      ridge = 34;
      // le comble à la Mansart : le brisis raide, le terrasson doux
      const seg = (pts, tones, over) => m.prism(0, 0, axis, pts.map(([u, y]) => [u, H + y]), CELL, tones, over, {});
      seg([[0, 0], [10, 22]], roofTones.slate, {}); seg([[50, 22], [60, 0]], roofTones.slate, {});
      seg([[10, 22], [30, 34]], TONES.snow, {}); seg([[30, 34], [50, 22]], TONES.snow, {});
      if (ends.a || ends.b) m.prism(0, 0, axis, [[0, H], [10, H + 22], [30, H + 34], [50, H + 22], [60, H]], CELL, TONES.stone, { endKey: 'pierre' }, ends, false);
    } else {
      ridge = 36;
      m.prism(0, 0, axis, [[0, H], [30, H + 36], [60, H]], CELL, TONES.snow, { endKey: 'pierre' }, ends);
    }
    // les lucarnes, sur les deux versants
    const dormerChance = old ? 0.5 : 1;
    for (const side of [0, 1]) for (const along of old ? [30] : [15, 45]) {
      if (hash(i, j, 33 + side, along, city.seed) >= dormerChance * (old ? 0.5 : 0.85)) continue;
      const across = side ? CELL - 5 : 5, y0 = H + (old ? 8 : 7), h0 = old ? 14 : 12;
      const px = alongX ? along : across, pz = alongX ? across : along;
      const dw = alongX ? 9 : 6, dd = alongX ? 6 : 9;
      m.box(px, y0, pz, dw, h0, dd, TONES.stone, { up: 'neige' });
      // la vitre, sur la face qui regarde dehors
      const out = side ? 1 : -1;
      if (alongX) m.box(px, y0 + 2, pz + out * 3.1, 5, 7, 0.6, TONES.black, { fixed: 'nuit' });
      else m.box(px + out * 3.1, y0 + 2, pz, 0.6, 7, 5, TONES.black, { fixed: 'nuit' });
    }
    // les cheminées : de 0 à 3 souches le long du faîtage
    const r = hash(i, j, 41, city.seed), nCh = r < 0.25 ? 0 : r < 0.6 ? 1 : r < 0.85 ? 2 : 3;
    const slots = [10, 30, 50].sort((p, q) => hash(i, j, p, city.seed) - hash(i, j, q, city.seed));
    for (let c = 0; c < nCh; c++) {
      const along = slots[c], hh = 20 + Math.floor(hash(i, j, c, 44, city.seed) * 6);
      const px = alongX ? along : 31, pz = alongX ? 31 : along;
      m.box(px, H + ridge - 8, pz, 8, hh, 7, TONES.stone, { up: 'neige' }, 0);
      m.box(px, H + ridge - 8 + hh, pz, 5, 0.8, 4, TONES.black, { fixed: 'nuit' });
      chimneys.push([ox + px, H + ridge - 8 + hh + 1, oz + pz, i * 31 + j]);
    }
    const rg = m.geometry();
    const ra = rg.attributes.position.array, rc = rg.attributes.color.array;
    for (let v = 0; v < ra.length; v += 3) vtx(ra[v], ra[v + 1], ra[v + 2], 0, [rc[v], rc[v + 1], rc[v + 2]], 1, 1);
    rg.dispose();

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(cols, 3));
    g.setAttribute('aMode', new THREE.Float32BufferAttribute(mode, 1));
    g.setAttribute('aRoof', new THREE.Float32BufferAttribute(roofF, 1));
    g.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: flatTex }, pal: { value: palTex }, palN: { value: PALETTE.length }, uL: lightU, uCut: { value: 0 }, uH: { value: H }, uSlice: { value: new THREE.Color(PAL.nuit2) } },
      vertexShader: BUILD_VS, fragmentShader: BUILD_FS, side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(ox, 0, oz);
    root.add(mesh);
    // les huit coins de la boîte englobante (pour savoir si l'immeuble cache Pierre)
    const hTop = H + 36 + 24;
    const corners = [];
    for (const x of [ox, ox + CELL]) for (const z of [oz, oz + CELL]) for (const y of [0, hTop]) corners.push(x, y, z);
    const b = { i, j, n, top: hTop, mesh, mat, step: () => steps.shift()(), done: () => !steps.length, cut: 0, target: 0, cx: ox + CELL / 2, cz: oz + CELL / 2, corners };
    buildings.push(b);
    return b;
  }

  onProgress('Les immeubles…');
  let count = 0, total = 0;
  for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) if (city.at(i, j) > 0 && city.kind(i, j) !== 'N') total++;
  for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
    const n = city.at(i, j);
    if (n <= 0 || city.kind(i, j) === 'N') continue;
    buildBuilding(i, j, n);
    count++;
    if (count % 6 === 0) { onProgress(`Les immeubles… ${Math.round(count / total * 100)} %`); await tick(); }
  }

  // ─── Notre-Dame, d'un seul bloc ───
  if (city.cathedral) { onProgress('Notre-Dame…'); await tick(true); root.add(buildCathedral(THREE, city.cathedral)); }

  // ─── Le mobilier ───
  onProgress('Le mobilier…');
  await tick(true);
  const geos = buildPropGeometries(THREE);
  const propMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lamps = [];
  {
    const lists = {};
    for (const [type, px, py, variant, rot = 0] of city.props) {
      const key = type === 'tree' ? 'tree' + ((variant | 0) % 6) : type;
      (lists[key] ||= []).push([px, py, type === 'bench' ? rot * Math.PI / 2 : hash(px, py, 5) * Math.PI * 2]);
      if (PROP_TYPES[type]?.light) lamps.push([px, py]);
    }
    const dummy = new THREE.Object3D();
    for (const [key, list] of Object.entries(lists)) {
      const geo = key.startsWith('tree') ? geos.tree[+key.slice(4)] : geos[key];
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, propMat, list.length);
      list.forEach(([x, z, ry], k) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, ry, 0); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix); });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    }
  }
  void mats;

  // ─── La coupe : les immeubles qui cachent les abords de Pierre ───
  const vp = new THREE.Matrix4();
  // La silhouette projetée d'un immeuble (l'enveloppe convexe de ses 8 coins) touche-t-elle le rectangle ?
  function hullHits(b, c, x0, y0, x1, y1) {
    const e = vp.elements, pts = [];
    for (let k = 0; k < c.length; k += 3) {
      const w = e[3] * c[k] + e[7] * c[k + 1] + e[11] * c[k + 2] + e[15];
      pts.push([(e[0] * c[k] + e[4] * c[k + 1] + e[8] * c[k + 2] + e[12]) / w, (e[1] * c[k] + e[5] * c[k + 1] + e[9] * c[k + 2] + e[13]) / w]);
    }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, bb) => (a[0] - o[0]) * (bb[1] - o[1]) - (a[1] - o[1]) * (bb[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of [...pts].reverse()) { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    const hull = lo.slice(0, -1).concat(up.slice(0, -1));
    const rect = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], bb = hull[(i + 1) % hull.length], nx = bb[1] - a[1], ny = a[0] - bb[0];
      let hmin = Infinity, hmax = -Infinity, rmin = Infinity, rmax = -Infinity;
      for (const p of hull) { const d = p[0] * nx + p[1] * ny; hmin = Math.min(hmin, d); hmax = Math.max(hmax, d); }
      for (const p of rect) { const d = p[0] * nx + p[1] * ny; rmin = Math.min(rmin, d); rmax = Math.max(rmax, d); }
      if (rmax < hmin || rmin > hmax) return false;
    }
    return true;
  }
  /* Chaque image : un immeuble entre la caméra et Pierre, dont la silhouette
     (la boîte, projetée à l'écran) recouvre le disque de rayon `radius`
     autour de Pierre, est coupé au rez-de-chaussée. cutting : false rend tout. */
  function updateCuts(camera, px, pz, radius, dt, cutting = true) {
    camera.updateMatrixWorld();
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const e = vp.elements;
    const proj = (x, y, z, out) => {
      const w = e[3] * x + e[7] * y + e[11] * z + e[15];
      out[0] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w; out[1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w; out[2] = w;
    };
    const o = [0, 0, 0];
    // le disque autour de Pierre, à l'écran
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const [dx, dz, y] of [[-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 1, 0], [0, 0, 34]]) {
      proj(px + dx * radius, y, pz + dz * radius, o);
      if (o[2] <= 0.1) continue;
      x0 = Math.min(x0, o[0]); x1 = Math.max(x1, o[0]); y0 = Math.min(y0, o[1]); y1 = Math.max(y1, o[1]);
    }
    const cx = camera.position.x - px, cz = camera.position.z - pz, cl = Math.hypot(cx, cz) || 1, fx = cx / cl, fz = cz / cl;
    for (const b of buildings) {
      let want = 0;
      const dx = b.cx - px, dz = b.cz - pz;
      // la caméra dans (ou contre) un immeuble : il s'abaisse, sinon on ne voit plus rien
      if (cutting && (b.cx - camera.position.x) ** 2 + (b.cz - camera.position.z) ** 2 < 100 * 100 && camera.position.y < b.top + 10) want = 1;
      if (!want && cutting && dx * dx + dz * dz < MAX_CUT_DIST * MAX_CUT_DIST && dx * fx + dz * fz > -35) {
        // près de la droite caméra → Pierre (sinon il ne cache rien de ce qu'on regarde)
        const side = Math.abs(dx * fz - dz * fx);
        if (side < radius + 60) {
          let bx0 = 9, bx1 = -9, by0 = 9, by1 = -9, behind = false;
          const c = b.corners;
          for (let k = 0; k < c.length; k += 3) {
            proj(c[k], c[k + 1], c[k + 2], o);
            if (o[2] <= 0.1) { behind = true; break; }
            bx0 = Math.min(bx0, o[0]); bx1 = Math.max(bx1, o[0]); by0 = Math.min(by0, o[1]); by1 = Math.max(by1, o[1]);
          }
          // … et qui se voit à l'écran (un immeuble hors du champ ne baisse pas)
          if (!behind && bx0 < x1 && bx1 > x0 && by0 < y1 && by1 > y0 && bx1 > -1 && bx0 < 1 && by1 > -1 && by0 < 1 && hullHits(b, c, x0, y0, x1, y1)) want = 1;
        }
      }
      b.target = want;
      if (b.cut !== want) {
        b.cut += Math.sign(want - b.cut) * Math.min(Math.abs(want - b.cut), dt * 5);
        b.mat.uniforms.uCut.value = b.cut;
      }
    }
  }

  /* Peint les façades des immeubles, les plus proches de (px, pz) d'abord,
     pendant au plus budgetMs ; rend le nombre d'immeubles qui attendent. */
  let queue = buildings.slice(), sortedAt = null;
  function paintSome(budgetMs, px, pz) {
    if (!queue.length) return 0;
    if (!sortedAt || Math.hypot(px - sortedAt[0], pz - sortedAt[1]) > 240) {
      sortedAt = [px, pz];
      queue.sort((p, q) => ((q.cx - px) ** 2 + (q.cz - pz) ** 2) - ((p.cx - px) ** 2 + (p.cz - pz) ** 2));   // le plus proche en dernier
    }
    const t0 = performance.now();
    do {
      const b = queue[queue.length - 1];
      if ((b.cx - px) ** 2 + (b.cz - pz) ** 2 > 1700 * 1700) break;      // les lointains attendent qu'on s'en approche
      b.step();
      if (b.done()) queue.pop();
    } while (queue.length && performance.now() - t0 < budgetMs);
    return queue.length;
  }

  const dispose = () => {
    root.traverse(o => { o.geometry?.dispose?.(); if (o.material) { for (const mt of [].concat(o.material)) { for (const u of Object.values(mt.uniforms || {})) u.value?.dispose?.(); mt.map?.dispose?.(); mt.dispose(); } } });
  };
  const setTime = t => { if (waterMat) waterMat.uniforms.uT.value = t; };
  // Les 16 réverbères les plus proches de (x, z), qui vacillent un peu : une lumière dynamique
  let lightAt = -1;
  function setLights(x, z, t) {
    if (t - lightAt > 0.2) {
      lightAt = t;
      const near = lamps.map(([lx, lz], i) => [lx, lz, i, (lx - x) ** 2 + (lz - z) ** 2]).filter(l => l[3] < 700 * 700).sort((p, q) => p[3] - q[3]).slice(0, 16);
      lightU.value.forEach((v, k) => { const l = near[k]; if (l) v.set(l[0], l[1], 230, 1); else v.w = 0; });
      lightU.near = near;
    }
    (lightU.near || []).forEach((l, k) => { lightU.value[k].w = 0.9 + 0.1 * Math.sin(t * 7 + l[2] * 1.7) * Math.sin(t * 3.1 + l[2]); });
  }
  return { root, buildings, chimneys, lamps, palTex, indexOfRGB, updateCuts, paintSome, setTime, setLights, dispose };
}
