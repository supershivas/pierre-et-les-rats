/* La planche d'échelle : les premiers éléments du jeu, côte à côte puis un par
   un, dessinés par le même code que le jeu (sprites.js, buildings.js). */
import { makeCity, hash } from './city.js?v=2.0.1';
import { renderColumn } from './buildings.js?v=2.0.1';
import { drawPierre, drawNote } from './sprites.js?v=2.0.1';
import { ATLAS } from './rat-sprites.js?v=2.0.1';
import { propSprite } from './props.js?v=2.0.1';
import { PAL } from './palette.js?v=2.0.1';
import { CELL, FLOOR, ROOF, PIERRE, RAT, NOTE, WINDOW, DOOR, toMeters } from './scale.js?v=2.0.1';

const $ = id => document.getElementById(id);
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Un immeuble seul au milieu de la rue, ses fenêtres éteintes
function house(floors) {
  let seed = 1;
  for (; seed < 5000; seed++) {
    // aucune fenêtre éclairée au premier, l'arcade éteinte
    const lit = [1, 2].some(f => hash(1, 1, 1, f, 5, seed) < 0.16 || hash(1, 1, 1, f, 6, seed) < 0.16);
    if (!lit && hash(1, 1, 1, 7, seed) >= 0.3) break;
  }
  const city = makeCity({ w: 3, h: 3, seed, start: [0, 0], rows: ['000', `0${floors}0`, '000'] });
  return renderColumn(city, 1, 1);
}
// La façade A redressée (sans la perspective), pour mesurer portes et fenêtres
function elevation(col, floors) {
  const H = floors * FLOOR;
  const out = canvasOf(CELL, H);
  const src = col.canvas.getContext('2d').getImageData(0, 0, col.w, col.h);
  const img = out.getContext('2d').createImageData(CELL, H);
  for (let u = 0; u < CELL; u++) for (let z = 0; z < H; z++) {
    const sy = col.h - 1 + Math.floor((u - CELL) / 2) - z;
    const so = (sy * col.w + u) * 4, o = ((H - 1 - z) * CELL + u) * 4;
    for (let k = 0; k < 4; k++) img.data[o + k] = src.data[so + k];
  }
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}
function crop(src, x, y, w, h) {
  const c = canvasOf(w, h);
  c.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}
// Un bout de neige, avec ce qu'on y dessine
function snow(w, h, paint) {
  const c = canvasOf(w, h), g = c.getContext('2d');
  g.fillStyle = PAL.neigeM; g.fillRect(0, 0, w, h);
  paint(g);
  return c;
}
// Affiche un canvas du jeu agrandi d'un facteur entier
function zoomed(src, z) {
  const c = canvasOf(src.width * z, src.height * z);
  c.className = 'px';
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const house1 = house(1), house3 = house(3), house6 = house(6);
const elev = elevation(house6, 6);
const door = crop(elev, 14, elev.height - 50, 32, 50);
const win = crop(elev, 5, elev.height - FLOOR - 50, 18, 50);

const sprite = (w, h, draw) => { const c = canvasOf(w, h); draw(c.getContext('2d')); return c; };
const pierreStand = sprite(18, 28, g => drawPierre(g, 8, 27, { shadow: false, silhouette: true }));
const pierreWalk = sprite(18, 28, g => drawPierre(g, 8, 27, { pose: 'walk', t: 0.01, shadow: false, silhouette: true }));
const pierrePlay = sprite(22, 28, g => drawPierre(g, 8, 27, { pose: 'play', shadow: false, silhouette: true }));
// Les poses des rats (rat-sprites.js) : galop, vers nous, de dos, dressé, saut, toilette
const RAT_POSES = [...ATLAS.side.map(f => f[0].c), ATLAS.down[0][0].c, ATLAS.up[0][0].c, ATLAS.rear[0][0].c, ATLAS.rear[1][0].c, ATLAS.jump[0][0].c, ATLAS.curl[0][0].c];
const rat = RAT_POSES[0], ratSit = ATLAS.rear[0][0].c;
const note = sprite(6, 8, g => drawNote(g, 1, 1, 0));
const ratTraces = snow(24, 10, g => { g.fillStyle = PAL.neigeO; for (let k = 0; k < 5; k++) g.fillRect(2 + k * 4, 4 + (k % 2 ? 1 : -1), 1, 1); });
const pierreTraces = snow(30, 12, g => { g.fillStyle = PAL.nuit2; for (let k = 0; k < 4; k++) g.fillRect(3 + k * 7, 5 + (k % 2 ? 2 : -2), 2, 1); });

const CARDS = [
  { title: 'Trace de rat', art: [ratTraces], dims: '1 × 1 px', real: '5 cm', about: 'Un pixel, plus sombre que la neige, tous les 5 px de course, en quinconce. La neige qui tombe les recouvre en deux à trois minutes.' },
  { title: 'Traces de Pierre', art: [pierreTraces], dims: '2 × 1 px', real: '10 × 5 cm', about: 'Une empreinte de chaussure d\'enfant tous les 8 px, gauche, droite.' },
  { title: 'Rat', art: RAT_POSES, dims: `${RAT.w} × ${RAT.h} px`, real: `${toMeters(RAT.w)} m, queue comprise`, about: 'Neuf poses : trois temps de galop de profil, vers nous, de dos, dressé (deux temps : il renifle), en plein saut, roulé en boule. La nuée en tire des milliers à la fois.' },
  { title: 'Note de musique', art: [note], dims: `${NOTE.w} × ${NOTE.h} px`, real: '—', about: 'Sort de la flûte à chaque note jouée, monte en ondulant et se trame en s\'effaçant.' },
  { title: 'Pierre', art: [pierreStand, pierreWalk, pierrePlay], dims: `${PIERRE.w} × ${PIERRE.h} px`, real: `${toMeters(PIERRE.h)} m`, about: 'Une silhouette noire, rien de plus : debout, en marche, jouant de la flûte. Dans le jeu, il est tout petit dans l\'écran (la vue montre environ 600 px de haut).' },
  { title: 'Porte-fenêtre', art: [win], dims: `${WINDOW.w} × ${WINDOW.h} px`, real: `${toMeters(WINDOW.w)} × ${toMeters(WINDOW.h)} m`, about: 'Deux par module et par étage, alignées d\'un étage à l\'autre : c\'est ce rythme qui fait l\'immeuble haussmannien. Une sur six environ est éclairée.' },
  { title: 'Rez-de-chaussée', art: [door], dims: `${DOOR.w} × ${DOOR.h} px`, real: `${toMeters(DOOR.w)} × ${toMeters(DOOR.h)} m`, about: 'Quatre ouvertures tirées au sort sur rue : l\'arcade de boutique, la porte cochère, le café et son store rayé, la porte à imposte. Sur cour, des fenêtres basses ; sous un passage, une arche de part en part.' },
  { title: 'Vieille maison parisienne', art: [house1.canvas, house3.canvas], dims: `${CELL} × ${CELL} px par case, ${FLOOR} px par étage`, real: `${toMeters(CELL)} m de côté, 1 à 3 étages`, about: 'Jusqu\'à trois niveaux, ce ne sont pas des immeubles haussmanniens : enduit, fenêtres plus petites et pas tout à fait alignées, volets, devanture de bois, toit à deux pans et lucarne à poulie.' },
  { title: 'Immeuble haussmannien', art: [house6.canvas], dims: `${CELL * 2 + 1} × ${house6.h} px à l\'écran`, real: `${toMeters(6 * FLOOR + ROOF)} m au faîtage`, about: 'À partir de quatre niveaux : refends et ouverture au rez-de-chaussée (boutique, porte cochère, café ou porte), entresol, fronton au 2e, balcons filants au 2e et au 5e, balconnets, corniche, comble à la Mansart, une à trois cheminées.' },
  { title: 'Mobilier urbain', art: ['lamp', 'tree', 'bench', 'colonne', 'borne'].map(t => propSprite(t, 0).c), dims: 'réverbère 11 × 70 px', real: 'réverbère 3,5 m, arbre 6 m, colonne 2,8 m', about: 'Réverbère (il éclaire la nuit), platane nu sous la neige, banc, colonne Morris, borne. Posé dans les rues avec l\'outil Mobilier de l\'atelier.' },
];

function lineup(z) {
  const base = 6, items = [house6.canvas, propSprite('lamp', 0).c, door, pierreStand, pierrePlay, rat, ratSit, note, propSprite('colonne', 0).c, propSprite('tree', 0).c];
  const gap = 10;
  const w = 24 + items.reduce((s, c) => s + c.width + gap, 0);
  const h = Math.max(...items.map(c => c.height)) + base + 4;
  const c = canvasOf(w, h), g = c.getContext('2d');
  g.fillStyle = PAL.neigeM; g.fillRect(0, 0, w, h);
  g.fillStyle = PAL.neigeO; g.fillRect(0, h - base, w, base);
  // La toise : un trait par mètre (20 px), un petit tous les 20 cm
  for (let y = 0; y < h - base; y++) {
    const m = (h - base - y);
    g.fillStyle = PAL.neigeO;
    if (m % 20 === 0) { g.fillStyle = PAL.ocre; g.fillRect(4, y, 9, 1); }
    else if (m % 4 === 0) g.fillRect(8, y, 5, 1);
  }
  g.fillStyle = PAL.neigeO; g.fillRect(12, 0, 1, h - base);
  let x = 22;
  for (const it of items) { g.drawImage(it, x, h - base - it.height); x += it.width + gap; }
  const out = $('lineup');
  out.width = w * z; out.height = h * z;
  const og = out.getContext('2d'); og.imageSmoothingEnabled = false;
  og.drawImage(c, 0, 0, out.width, out.height);
}

function cards(z) {
  $('cards').innerHTML = '';
  for (const card of CARDS) {
    const li = document.createElement('li'); li.className = 'card';
    const art = document.createElement('div'); art.className = 'card-art';
    for (const c of card.art) art.append(zoomed(c, card.art[0].height > 150 ? Math.max(1, z - 1) : z));
    li.append(art);
    li.insertAdjacentHTML('beforeend', `<h3>${card.title}</h3><p class="dims">${card.dims} · ${card.real}</p><p>${card.about}</p>`);
    $('cards').append(li);
  }
}

function draw() {
  const z = +$('zoom').value;
  lineup(z); cards(z);
}
$('zoom').addEventListener('change', draw);
draw();
