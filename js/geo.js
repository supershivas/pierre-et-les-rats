/* De quoi bâtir des objets 3D à la main, en pixels du jeu (1 px = 5 cm), qui
   restent dans la palette : un Mesher accumule des boîtes, des cylindres, des
   cônes, des prismes, et colore chaque triangle d'après son orientation (trois
   tons : éclairé par la lune, mi-ombre, ombre ; le dessus peut être sous la
   neige). Le résultat est une seule géométrie à couleurs de sommets. */
import { PAL } from './palette.js?v=2.1.0';

// d'où vient la lumière : du ciel, un peu du côté +z (le sud, comme dans le dessin 2D)
const LIGHT = (() => { const l = [-0.3, 0.7, 0.65], n = Math.hypot(...l); return l.map(v => v / n); })();
export const toneOf = (tones, nx, ny, nz) => {
  const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return d > 0.45 ? tones[0] : d > -0.15 ? tones[1] : tones[2];
};

// Des jeux de tons [éclairé, mi-ombre, ombre] (clés de PAL)
export const TONES = {
  stone: ['pierreL', 'pierre', 'pierreS'],
  iron: ['ardoise', 'nuit2', 'nuit'],
  slate: ['pierreL', 'ardoise', 'nuit2'],
  wood: ['neigeO', 'ardoise', 'nuit2'],
  snow: ['neige', 'neigeM', 'neigeO'],
  black: ['nuit', 'nuit', 'nuit'],
};

export function createMesher(THREE) {
  const pos = [], col = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const rgb = {};
  const color = key => rgb[key] || (rgb[key] = new THREE.Color(PAL[key]));

  /* Ajoute une géométrie three.js transformée. over : { up: clé de couleur du
     dessus (normale vers le haut), fixed: une seule clé, snow: la pente
     minimale (ny) pour porter la neige, 0.55 par défaut si `up` est donné } */
  function add(geo, matrix, tones = TONES.stone, over = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const a = g.attributes.position.array;
    const upMin = over.snow ?? 0.55;
    for (let i = 0; i < a.length; i += 9) {
      const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], uz = a[i + 5] - a[i + 2];
      const vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], vz = a[i + 8] - a[i + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let flip = false;
      if (over.out) {
        // la face doit regarder vers l'extérieur du solide (over.out : un point à l'intérieur)
        const cx = (a[i] + a[i + 3] + a[i + 6]) / 3 - over.out[0], cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3 - over.out[1], cz = (a[i + 2] + a[i + 5] + a[i + 8]) / 3 - over.out[2];
        if (nx * cx + ny * cy + nz * cz < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
      }
      const key = over.fixed || (over.up && ny > upMin ? over.up : toneOf(tones, nx, ny, nz));
      const c = color(key);
      for (const k of flip ? [0, 2, 1] : [0, 1, 2]) { pos.push(a[i + k * 3], a[i + k * 3 + 1], a[i + k * 3 + 2]); col.push(c.r, c.g, c.b); }
    }
    g.dispose();
  }
  const place = (x, y, z, rx = 0, ry = 0, rz = 0) => { e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); p.set(x, y, z); return m4.compose(p, q, s).clone(); };
  const api = {
    add,
    // une boîte posée sur (x, y, z) = le centre de sa base
    box(x, y, z, w, h, d, tones, over, ry = 0, rx = 0, rz = 0) {
      add(new THREE.BoxGeometry(w, h, d), place(x, y + h / 2, z, rx, ry, rz), tones, over);
    },
    // un cylindre (ou un tronc de cône), posé sur sa base
    cyl(x, y, z, rTop, rBottom, h, seg, tones, over, thetaStart = 0, thetaLength = Math.PI * 2, ry = 0) {
      add(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, false, thetaStart, thetaLength), place(x, y + h / 2, z, 0, ry, 0), tones, over);
    },
    cone(x, y, z, r, h, seg, tones, over, thetaStart = 0, thetaLength = Math.PI * 2, ry = 0) {
      add(new THREE.ConeGeometry(r, h, seg, 1, false, thetaStart, thetaLength), place(x, y + h / 2, z, 0, ry, 0), tones, over);
    },
    // une branche : un tronc de cône du point a vers le point b
    limb(ax, ay, az, bx, by, bz, r0, r1, seg, tones, over) {
      const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 1;
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
      const mat = new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), quat, new THREE.Vector3(1, 1, 1));
      add(new THREE.CylinderGeometry(r1, r0, len, seg, 1, true), mat, tones, over);
    },
    // un profil [[u, y], …] extrudé sur la longueur len, le long de x (u = z) ou de z (u = x),
    // à partir du point (x, z) ; les segments du profil sont les pentes (la base n'est pas
    // dessinée ; slopes: false pour ne dessiner que les pignons), ends : fermer le bout a
    // (t = 0) et/ou le bout b (t = len) par un pignon
    prism(x, z, axis, profile, len, tones, over = {}, ends = {}, slopes = true) {
      const v = (u, y, t) => (axis === 'x' ? [x + t, y, z + u] : [x + u, y, z + t]);
      const mid = v(profile.reduce((s2, q2) => s2 + q2[0], 0) / profile.length, Math.max(...profile.map(q2 => q2[1])) / 2, len / 2);
      const ov = { ...over, out: mid };
      const tri = (A, B, C, tn, o) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C], 3));
        add(g, new THREE.Matrix4(), tn, o);
      };
      for (let i = 0; slopes && i < profile.length - 1; i++) {
        const [u0, y0] = profile[i], [u1, y1] = profile[i + 1];
        const A = v(u0, y0, 0), B = v(u1, y1, 0), C = v(u1, y1, len), D = v(u0, y0, len);
        tri(A, B, C, tones, ov); tri(A, C, D, tones, ov);
      }
      const cap = t => {
        const pts = profile.map(([u, yy]) => v(u, yy, t));
        for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1], tones, { ...ov, fixed: over.endKey || 'pierre' });
      };
      if (ends.a) cap(0);
      if (ends.b) cap(len);
    },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeBoundingSphere();
      return g;
    },
    get triangles() { return pos.length / 9; },
  };
  return api;
}

// Fusionne des géométries à couleurs de sommets, chacune déplacée par une matrice
export function mergeColored(THREE, items) {
  let n = 0;
  for (const [g] of items) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const [g, m] of items) {
    const c = g.clone(); c.applyMatrix4(m);
    pos.set(c.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count; c.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
