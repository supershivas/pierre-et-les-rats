/* Le mobilier urbain en 3D : réverbère, arbre nu (six variantes), banc,
   colonne Morris, borne. Chaque modèle est une seule géométrie à couleurs de
   sommets (geo.js), en pixels du jeu (1 px = 5 cm), posée sur le sol à
   l'origine ; le banc regarde vers +z. Les couleurs viennent du ton de la
   face (lune, mi-ombre, ombre) et de la neige sur le dessus des branches. */
import { createMesher, TONES } from './geo.js?v=2.3.0';
import { rng } from './city.js?v=2.3.0';

// Le réverbère : un fût de fonte, une lanterne vitrée, un chapeau de neige (3,5 m)
function lamp(m) {
  m.cyl(0, 0, 0, 2.6, 3.8, 9, 8, TONES.iron);               // le socle
  m.cyl(0, 9, 0, 3.2, 2.6, 2, 8, TONES.iron);               // sa bague
  m.cyl(0, 11, 0, 1.3, 1.7, 40, 6, TONES.iron);             // le fût
  m.cyl(0, 24, 0, 2.3, 2.3, 1.6, 8, TONES.iron);            // un collier
  m.cyl(0, 51, 0, 2.6, 1.5, 3, 8, TONES.iron);              // la console
  m.box(0, 54, 0, 7, 1.4, 7, TONES.iron);
  m.box(0, 55.4, 0, 5.2, 8, 5.2, TONES.stone, { fixed: 'ocre' });   // la vitre allumée
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(sx * 2.7, 55.4, sz * 2.7, 1.2, 8, 1.2, TONES.black);
  m.box(0, 63.4, 0, 7.6, 1.2, 7.6, TONES.iron);
  m.cone(0, 64.6, 0, 6.4, 5, 4, TONES.iron, { fixed: 'neige' }, 0, Math.PI * 2, Math.PI / 4);   // le chapeau sous la neige
  m.box(0, 69.4, 0, 1.4, 1.2, 1.4, TONES.snow, { fixed: 'neige' });
}

// L'arbre nu (un platane l'hiver) : un tronc, des branches qui se partagent, de la neige dessus
function tree(m, variant) {
  const r = rng(1000 + variant);
  const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const branch = (x, y, z, d, len, rad, depth) => {
    const ex = x + d[0] * len, ey = y + d[1] * len, ez = z + d[2] * len;
    m.limb(x, y, z, ex, ey, ez, rad, Math.max(0.45, rad * 0.72), 5, TONES.iron, { up: 'neige', snow: 0.5 });
    if (depth <= 0 || len < 5) return;
    const kids = 2 + (r() < 0.35 ? 1 : 0);
    const helper = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const p1 = unit(...cross(d, helper)), p2 = cross(d, p1);
    const az0 = r() * 6.28;
    for (let k = 0; k < kids; k++) {
      const az = az0 + (k / kids) * 6.28 + (r() - 0.5) * 0.8, ang = 0.45 + r() * 0.55;
      const u = [p1[0] * Math.cos(az) + p2[0] * Math.sin(az), p1[1] * Math.cos(az) + p2[1] * Math.sin(az), p1[2] * Math.cos(az) + p2[2] * Math.sin(az)];
      const nd = unit(d[0] * Math.cos(ang) + u[0] * Math.sin(ang), d[1] * Math.cos(ang) + u[1] * Math.sin(ang) + 0.18, d[2] * Math.cos(ang) + u[2] * Math.sin(ang));
      branch(ex, ey, ez, nd, len * (0.66 + r() * 0.14), rad * 0.64, depth - 1);
    }
  };
  m.cyl(0, 0, 0, 3.6, 4.4, 3, 6, TONES.stone);               // la grille au pied
  branch(0, 2, 0, unit((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12), 30 + r() * 8, 3.3, 4);
}

// Le banc de fonte et de lattes, sous la neige (1,5 m) ; il regarde vers +z
function bench(m) {
  for (const s of [-1, 1]) {
    m.box(s * 13.2, 0, 0, 1.8, 8.6, 12, TONES.iron);          // le pied
    m.box(s * 13.2, 8.6, -5.6, 1.8, 10, 1.8, TONES.iron, {}, 0, -0.2);   // le montant du dossier
    m.box(s * 13.2, 8.6, 2, 1.8, 1.6, 8, TONES.iron);         // l'accoudoir
  }
  for (let k = 0; k < 3; k++) m.box(0, 8.6, -4.4 + k * 4.2, 28.4, 1.3, 3.4, TONES.wood);              // l'assise
  for (let k = 0; k < 3; k++) m.box(0, 11.4 + k * 3.6, -6.4 - k * 0.6, 28.4, 2.6, 1.1, TONES.wood, {}, 0, -0.2);   // le dossier
  m.box(0, 9.9, 0.2, 27, 1.1, 11.6, TONES.snow, { fixed: 'neige' });                                   // la neige dessus
  m.box(0, 20.6, -8.5, 28, 1, 1.6, TONES.snow, { fixed: 'neigeM' });
}

// La colonne Morris : un fût d'affiches, un dôme sous la neige (2,8 m)
function colonne(m) {
  m.cyl(0, 0, 0, 7.4, 8.2, 6, 14, TONES.stone);                // le socle
  m.cyl(0, 6, 0, 6.4, 6.4, 34, 16, TONES.stone);               // le fût
  for (const [a0, a1, y, hh] of [[0.2, 1.5, 9, 9], [2.0, 3.6, 11, 11], [4.2, 5.5, 8, 10], [0.3, 1.6, 24, 8], [3.2, 4.4, 22, 11], [5.0, 6.2, 25, 7]]) {
    m.cyl(0, y + 6, 0, 6.5, 6.5, hh, 16, TONES.snow, { fixed: 'neigeO' }, a0, a1 - a0);               // des affiches collées
  }
  m.cyl(0, 22, 0, 6.6, 6.6, 1.1, 16, TONES.black);              // une bande sombre
  m.cyl(0, 38, 0, 6.6, 6.6, 1.1, 16, TONES.black);
  m.cyl(0, 40, 0, 7.8, 7.8, 3, 16, TONES.stone);               // la corniche
  m.cyl(0, 43, 0, 6.2, 3.4, 4, 16, TONES.slate, { up: 'neige' });   // le dôme
  m.cone(0, 47, 0, 3.4, 3.4, 16, TONES.slate, { up: 'neige' });
  m.cyl(0, 50.4, 0, 1.3, 1.3, 3, 8, TONES.black);              // le lanternon
  m.cone(0, 53.4, 0, 1.8, 1.8, 8, TONES.snow, { fixed: 'neige' });
}

// La borne de pierre au bord de la rue (60 cm)
function borne(m) {
  m.cyl(0, 0, 0, 2.2, 2.7, 10, 8, TONES.stone);
  m.cyl(0, 10, 0, 1.9, 2.2, 2, 8, TONES.stone, { fixed: 'neige' });
  m.cone(0, 12, 0, 1.9, 1.6, 8, TONES.snow, { fixed: 'neige' });
}

/* Les géométries de chaque modèle : { lamp, tree: [6], bench, colonne, borne } */
export function buildPropGeometries(THREE) {
  const make = fn => { const m = createMesher(THREE); fn(m); return m.geometry(); };
  return {
    lamp: make(lamp),
    tree: [0, 1, 2, 3, 4, 5].map(v => make(m => tree(m, v))),
    bench: make(bench),
    colonne: make(colonne),
    borne: make(borne),
  };
}
