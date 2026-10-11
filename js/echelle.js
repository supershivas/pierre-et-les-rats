/* La planche d'échelle : les premiers éléments du jeu, côte à côte puis un par
   un, dessinés par le même code que le jeu (sprites.js, buildings.js). */
import { makeCity, hash } from './city.js?v=1.0.1';
import { renderColumn } from './buildings.js?v=1.0.1';
import { drawPierre, drawRat, drawNote } from './sprites.js?v=1.0.1';
import { PAL } from './palette.js?v=1.0.1';
import { CELL, FLOOR, ROOF, PIERRE, RAT, NOTE, WINDOW, DOOR, toMeters } from './scale.js?v=1.0.1';

const $ = id => document.getElementById(id);
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Une maison seule au milieu de la rue, avec une porte et une fenêtre au premier
function house(floors) {
  let seed = 1;
  for (; seed < 5000; seed++) {
    const door = hash(1, 1, 0, 1, seed) < 0.5;
    const win = hash(1, 1, 1, 1, seed) < 0.55;
    const lit = hash(1, 1, 1, 5, seed) < 0.22;
    if (door && win && !lit) break;
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
  g.fillStyle = PAL.neige; g.fillRect(0, 0, w, h);
  g.fillStyle = PAL.neigeM;
  for (let k = 0; k < w * h / 14; k++) g.fillRect(Math.floor(hash(k, 1) * w), Math.floor(hash(k, 2) * h), 1, 1);
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

const house1 = house(1), house4 = house(4);
const elev = elevation(house4, 4);
const door = crop(elev, 18, elev.height - 48, 24, 48);
const win = crop(elev, 11, elev.height - FLOOR - 48, 38, 48);

const sprite = (w, h, draw) => { const c = canvasOf(w, h); draw(c.getContext('2d')); return c; };
const pierreStand = sprite(18, 28, g => drawPierre(g, 8, 27, { shadow: false }));
const pierreWalk = sprite(18, 28, g => drawPierre(g, 8, 27, { pose: 'walk', t: 0.01, shadow: false }));
const pierrePlay = sprite(22, 28, g => drawPierre(g, 8, 27, { pose: 'play', shadow: false }));
const rat = sprite(12, 6, g => drawRat(g, 6, 5, { moving: true }));
const ratSit = sprite(12, 6, g => drawRat(g, 6, 5, {}));
const note = sprite(6, 8, g => drawNote(g, 1, 1, 0));
const ratTraces = snow(24, 10, g => { g.fillStyle = PAL.neigeM; for (let k = 0; k < 5; k++) g.fillRect(2 + k * 4, 4 + (k % 2 ? 1 : -1), 1, 1); });
const pierreTraces = snow(30, 12, g => { g.fillStyle = PAL.neigeO; for (let k = 0; k < 4; k++) g.fillRect(3 + k * 7, 5 + (k % 2 ? 2 : -2), 2, 1); });

const CARDS = [
  { title: 'Trace de rat', art: [ratTraces], dims: '1 × 1 px', real: '5 cm', about: 'Un pixel, plus sombre que la neige, tous les 5 px de course, en quinconce. La neige qui tombe les recouvre en deux à trois minutes.' },
  { title: 'Traces de Pierre', art: [pierreTraces], dims: '2 × 1 px', real: '10 × 5 cm', about: 'Une empreinte de chaussure d\'enfant tous les 8 px, gauche, droite.' },
  { title: 'Rat', art: [rat, ratSit], dims: `${RAT.w} × ${RAT.h} px`, real: `${toMeters(RAT.w)} m, queue comprise`, about: 'Deux temps de course et une pose arrêtée. Une petite ombre noire, le dos à peine plus clair.' },
  { title: 'Note de musique', art: [note], dims: `${NOTE.w} × ${NOTE.h} px`, real: '—', about: 'Sort de la flûte à chaque note jouée, monte en ondulant et se trame en s\'effaçant.' },
  { title: 'Pierre', art: [pierreStand, pierreWalk, pierrePlay], dims: `${PIERRE.w} × ${PIERRE.h} px`, real: `${toMeters(PIERRE.h)} m`, about: 'Un enfant de dix ans, en noir, le visage blanc dans la nuit. Debout, en marche, et jouant de la flûte (qui dépasse de 4 px).' },
  { title: 'Fenêtre', art: [win], dims: `${WINDOW.w} × ${WINDOW.h} px`, real: `${toMeters(WINDOW.w)} × ${toMeters(WINDOW.h)} m`, about: 'Un cadre, une vitre noire, un liseré de neige dessus. Une sur cinq environ est éclairée : blanche, avec sa croisée.' },
  { title: 'Porte', art: [door], dims: `${DOOR.w} × ${DOOR.h} px`, real: `${toMeters(DOOR.w)} × ${toMeters(DOOR.h)} m`, about: 'Un rectangle noir au ras de la neige.' },
  { title: 'Module d\'immeuble', art: [house1.canvas], dims: `${CELL} × ${CELL} × ${FLOOR} px`, real: `${toMeters(CELL)} m de côté, un étage`, about: 'La brique du générateur : un étage sur une case. L\'atelier les empile (jusqu\'à 6) et le toit suit.' },
  { title: 'Maison de quatre étages', art: [house4.canvas], dims: `${CELL * 2 + 1} × ${house4.h} px à l'écran`, real: `${toMeters(4 * FLOOR + ROOF)} m au faîtage`, about: 'Rez-de-chaussée et trois étages, comble à la Mansart : le brisis d\'ardoise, le dessus sous la neige.' },
];

function lineup(z) {
  const base = 6, items = [house4.canvas, door, pierreStand, pierrePlay, rat, ratSit, note];
  const gap = 10;
  const w = 24 + items.reduce((s, c) => s + c.width + gap, 0);
  const h = Math.max(...items.map(c => c.height)) + base + 4;
  const c = canvasOf(w, h), g = c.getContext('2d');
  g.fillStyle = PAL.nuit; g.fillRect(0, 0, w, h);
  g.fillStyle = PAL.neige; g.fillRect(0, h - base, w, base);
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
