/* Le labo : dix pistes pour la suite, à comparer une à une. Chaque sujet
   commence par A, ce que le jeu fait aujourd'hui ; les autres lettres sont
   des idées, chacune avec une vignette animée (dans la palette du jeu) et
   ce qu'elle changerait. Rien n'est lu ni écrit dans le navigateur.

   Ajouter une idée = ajouter une entrée dans TOPICS (et sa vignette). */
import { PAL } from './palette.js?v=1.3.0';
import { drawPierre, drawNote } from './sprites.js?v=1.3.0';
import { ATLAS, POSE_ROWS } from './rat-sprites.js?v=1.3.0';
import { hash } from './city.js?v=1.3.0';

const W = 320, H = 180;

// ─── Petits outils de dessin (vue de face, comme une scène de théâtre) ───
const px = (g, x, y, key, w = 1, h = 1) => { g.fillStyle = PAL[key]; g.fillRect(Math.round(x), Math.round(y), w, h); };
function night(g, t) {
  px(g, 0, 0, 'nuit', W, H);
  for (let k = 0; k < 70; k++) {
    const x = (hash(k, 1) * W + t * (4 + hash(k, 2) * 6)) % W, y = (hash(k, 3) * H + t * (8 + hash(k, 4) * 10)) % H;
    px(g, x, y, 'neige');
  }
}
// Une rangée de façades haussmanniennes, de face : refends, fenêtres alignées, comble
function facades(g, y0, seed = 1, litBy = null) {
  let x = -10;
  while (x < W) {
    const w = 52 + Math.floor(hash(x, seed) * 20), floors = 4 + Math.floor(hash(x, seed, 2) * 2);
    const top = y0 - floors * 16;
    px(g, x, top, 'pierreL', w, y0 - top);
    px(g, x, top - 10, 'ardoise', w, 10);          // le comble
    px(g, x, top - 11, 'neige', w, 2);
    for (let b = 0; b < w - 10; b += 12) px(g, x + 6 + b, top - 8, 'nuit', 4, 5); // lucarnes
    for (let f = 0; f < floors; f++) {
      const fy = top + f * 16;
      if (f === 1 || f === floors - 1) px(g, x, fy + 14, 'nuit', w, 1); // balcons filants
      for (let b = 0; b < w - 10; b += 12) {
        const lit = litBy ? litBy(x + 6 + b, f) : hash(x, b, f, seed) < 0.18;
        px(g, x + 6 + b, fy + 3, lit ? 'ocre' : 'nuit', 5, 10);
      }
    }
    px(g, x, y0 - 14, 'pierre', w, 14);           // le rez-de-chaussée
    for (let r = y0 - 12; r < y0; r += 4) px(g, x, r, 'pierreS', w, 1);
    for (let b = 8; b < w - 14; b += 20) px(g, x + b, y0 - 12, 'nuit', 10, 12);
    x += w + 1;
  }
}
const groundBand = (g, y0, key = 'neigeM') => px(g, 0, y0, key, W, H - y0);
const pierre = (g, x, y, pose = 'play', t = 0, dir = 1) => drawPierre(g, x, y, { pose, t, dir, shadow: false, silhouette: true });
function rat(g, x, y, t, dir = 1, k = 0, pose = null) {
  const set = pose ? ATLAS[pose] : ATLAS.side;
  const s = set[((t * 10 + k) | 0) % set.length][dir < 0 ? 1 : 0];
  g.drawImage(s.c, Math.round(x - s.ax), Math.round(y - s.ay));
}
// Un rat d'une autre couleur (la colonie rivale)
function paleRat(g, x, y, t, dir, k) {
  const rows = POSE_ROWS.side[((t * 10 + k) | 0) % 3], w = rows[0].length;
  for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < w; xx++) {
    if (rows[yy][xx] === '.') continue;
    px(g, x - 5 + (dir < 0 ? w - 1 - xx : xx), y - rows.length + yy, rows[yy][xx] === 'c' ? 'neige' : 'neigeO');
  }
}
// Une nuée qui grouille autour d'un point
function swarm(g, cx, cy, n, t, rx = 30, ry = 10, seed = 0) {
  for (let k = 0; k < n; k++) {
    const a = hash(k, seed) * 6.28 + t * (0.4 + hash(k, 5) * 0.8) * (k % 2 ? 1 : -1);
    const r = Math.sqrt(hash(k, 6, seed));
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    const pose = hash(k, 7) < 0.08 ? 'rear' : null;
    rat(g, x, y, t, Math.sin(a) > 0 ? -1 : 1, k, pose);
  }
}
function notes(g, x, y, t) {
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.6 + k / 4) % 1;
    drawNote(g, x + p * 14 + Math.sin(p * 8 + k) * 3, y - p * 34, k % 2, p > 0.7 ? (p - 0.7) * 3 : 0);
  }
}

// ─── Les vignettes ───
const ART = {
  now(g, t) {
    night(g, t); facades(g, 110, 3); groundBand(g, 110);
    swarm(g, 160, 150, 40, t, 70, 16);
    pierre(g, 160, 150, 'play', t); notes(g, 168, 126, t);
  },
  prefet(g, t) {
    night(g, t); facades(g, 110, 5); groundBand(g, 110);
    // la préfecture : une grande porte éclairée, le préfet en bicorne
    px(g, 228, 70, 'pierreL', 70, 40); px(g, 252, 80, 'ocre', 22, 30);
    px(g, 259, 86, 'nuit', 8, 24); px(g, 256, 82, 'nuit', 14, 4); // le préfet et son bicorne
    // la bourse, tendue puis retirée
    const k = (t * 0.25) % 1, bx = 250 - Math.min(1, k * 2) * 30 + Math.max(0, k * 2 - 1) * 30;
    px(g, bx, 100, 'neige', 6, 6); px(g, bx + 2, 98, 'neige', 2, 2);
    swarm(g, 110, 150, 28, t, 50, 12);
    pierre(g, 150, 150, 'stand', t);
  },
  seine(g, t) {
    night(g, t); facades(g, 72, 7);
    px(g, 0, 72, 'neigeO', W, 14);                // le quai
    px(g, 0, 86, 'neigeO', W, H - 86);            // la Seine gelée
    for (let k = 0; k < 40; k++) px(g, hash(k, 9) * W, 90 + hash(k, 10) * 80, 'neigeM', 8 + hash(k, 11) * 20, 1);
    // les rats marchent sur la glace en longue file
    const n = 60;
    for (let k = 0; k < n; k++) {
      const x = ((k * 9 + t * 22) % (W + 60)) - 30, y = 128 + Math.sin(k * 1.7) * 8;
      rat(g, x, y, t, 1, k);
    }
    // la glace craque, de plus en plus
    const c = (t * 0.2) % 1;
    let x = 200, y = 100;
    for (let s = 0; s < c * 90; s++) { x += hash(s, 1) * 3 - 0.6; y += hash(s, 2) * 2 - 0.5; px(g, x, y, 'nuit', 2, 1); if (s % 9 === 0) px(g, x, y + 1, 'nuit', 1, 3); }
    pierre(g, 40, 84, 'play', t); notes(g, 48, 60, t);
  },
  enfants(g, t) {
    night(g, t); facades(g, 110, 9); groundBand(g, 110);
    const walk = (t * 18) % 60;
    pierre(g, 210 + walk * 0.2, 150, 'play', t); notes(g, 218 + walk * 0.2, 126, t);
    // les gamins des rues, à la file, un peu plus petits
    for (let k = 0; k < 6; k++) {
      const x = 186 - k * 22 + walk * 0.2, y = 152 + (k % 2) * 4;
      g.save(); g.translate(x, y); g.scale(0.8, 0.8); pierre(g, 0, 0, 'walk', t + k * 0.3); g.restore();
    }
    swarm(g, 120, 168, 14, t, 90, 4, 3);
  },
  centjours(g, t) {
    night(g, t);
    // le plan de Paris en losanges : les quartiers ralliés s'allument un à un
    const order = 20, lit = Math.floor((t * 1.5) % (order + 4));
    let n = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) {
      const cx = 170 + (i - j) * 28, cy = 50 + (i + j) * 14;
      const on = n++ < lit;
      for (let y = -12; y <= 12; y++) {
        const w = 24 - Math.abs(y) * 2;
        px(g, cx - w, cy + y, on ? 'neigeM' : 'nuit2', w * 2, 1);
      }
      if (on) px(g, cx - 1, cy - 2, 'ocre', 3, 3);
    }
    // l'Aigle : un bicorne au-dessus du plan
    px(g, 20, 20, 'neige', 26, 6); px(g, 26, 14, 'neige', 14, 6);
    pierre(g, 34, 170, 'play', t); notes(g, 42, 146, t);
  },
  corps(g, t) {
    night(g, t); facades(g, 90, 11); groundBand(g, 90);
    // éclaireurs : une ligne rapide qui file en avant
    for (let k = 0; k < 10; k++) rat(g, ((k * 18 + t * 90) % 360) - 20, 104, t * 2, 1, k);
    // grenadiers : un carré serré qui avance au pas
    for (let k = 0; k < 30; k++) rat(g, 120 + (k % 6) * 9 + Math.sin(t * 3) * 2, 132 + Math.floor(k / 6) * 5, t * 0.6, 1, k);
    // sapeurs : ils creusent au pied d'un mur, la terre vole
    px(g, 240, 70, 'pierreL', 60, 90);
    for (let k = 0; k < 8; k++) rat(g, 236 - (k % 3) * 8, 156 - Math.floor(k / 3) * 4, t, 1, k, 'rear');
    for (let k = 0; k < 6; k++) { const p = (t * 1.3 + k / 6) % 1; px(g, 238 - p * 20, 150 - Math.sin(p * 3.14) * 18, 'neigeO', 2, 2); }
    pierre(g, 60, 150, 'play', t); notes(g, 68, 126, t);
  },
  waterloo(g, t) {
    px(g, 0, 0, 'nuit', W, H);
    // la voûte d'un égout
    for (let x = 0; x < W; x++) { const y = 40 - Math.sqrt(Math.max(0, 1 - ((x - 160) / 170) ** 2)) * 30; px(g, x, y, 'pierreS', 1, 3); }
    px(g, 0, 96, 'neigeO', W, 60);                // le radier, où l'on se bat
    px(g, 0, 156, 'nuit2', W, 24); px(g, 0, 160, 'ardoise', W, 6); // l'eau gelée au fond
    // deux nuées qui se jettent l'une sur l'autre ; au contact, ça saute
    const meet = 160 + Math.sin(t * 0.7) * 20;
    for (let k = 0; k < 45; k++) {
      const x = meet - 8 - hash(k, 1) * 140 + Math.sin(t * 3 + k) * 3, y = 120 + hash(k, 2) * 24;
      const jump = x > meet - 20 && hash(k, 3) < 0.3 ? Math.abs(Math.sin(t * 6 + k)) * 8 : 0;
      rat(g, x, y - jump, t, 1, k, jump > 2 ? 'jump' : null);
    }
    for (let k = 0; k < 45; k++) {
      const x = meet + 8 + hash(k, 4) * 140 + Math.sin(t * 3 + k) * 3, y = 120 + hash(k, 5) * 24;
      paleRat(g, x, y, t, -1, k);
    }
  },
  faim(g, t) {
    night(g, t); facades(g, 100, 13); groundBand(g, 100);
    // un sac de grain éventré, qui se vide
    const left = 1 - ((t * 0.12) % 1);
    const sh = Math.round(10 + 20 * left);
    px(g, 150, 150 - sh, 'neige', 30, sh); px(g, 172, 150 - sh, 'neigeO', 8, sh); px(g, 152, 150 - sh - 3, 'neigeO', 26, 3);
    for (let k = 0; k < 20; k++) px(g, 140 + hash(k, 1) * 50, 150 + hash(k, 2) * 8, 'neige');
    swarm(g, 165, 150, 50, t, 50, 12, 7);
    // la jauge de faim de l'armée
    px(g, 20, 20, 'nuit2', 100, 6); px(g, 20, 20, 'neige', Math.round(100 * left), 6);
    pierre(g, 250, 150, 'stand', t);
  },
  egouts(g, t) {
    night(g, t);
    facades(g, 60, 15);
    px(g, 0, 60, 'neigeM', W, 18);                // la rue
    px(g, 0, 78, 'nuit2', W, H - 78);             // la terre
    px(g, 0, 118, 'neigeO', W, 34);               // la galerie
    px(g, 0, 116, 'pierreS', W, 2); px(g, 0, 152, 'pierreS', W, 2);
    // deux bouches d'égout reliées par un puits
    for (const gx of [60, 250]) { px(g, gx, 76, 'nuit', 14, 2); px(g, gx + 4, 78, 'nuit', 6, 40); }
    // les rats descendent, filent sous la ville, ressortent plus loin
    for (let k = 0; k < 40; k++) {
      const p = (t * 0.25 + k / 40) % 1;
      let x, y;
      if (p < 0.15) { x = 66; y = 78 + p / 0.15 * 66; }
      else if (p < 0.85) { x = 66 + (p - 0.15) / 0.7 * 190; y = 146; }
      else { x = 256; y = 146 - (p - 0.85) / 0.15 * 70; }
      rat(g, x + Math.sin(k) * 3, y, t, 1, k, p < 0.15 ? 'down' : p >= 0.85 ? 'up' : null);
    }
    pierre(g, 30, 74, 'play', t); notes(g, 38, 50, t);
  },
  peur(g, t) {
    night(g, t);
    const front = (t * 30) % (W + 100) - 50;
    // les fenêtres s'éteignent quand la nuée passe dessous
    facades(g, 110, 17, (x, f) => x > front + 20 && hash(x, f, 3) < 0.6);
    groundBand(g, 110);
    swarm(g, front, 150, 40, t, 60, 14);
    pierre(g, front + 10, 150, 'play', t);
    // un gendarme et sa lanterne attendent au coin
    px(g, 290, 124, 'nuit', 8, 26); px(g, 288, 120, 'nuit', 12, 5); px(g, 299, 134, 'ocre', 3, 4);
  },
  partitions(g, t) {
    night(g, t); groundBand(g, 70);
    // trois ordres, trois formes : un cercle, une ligne, une flèche
    const phase = Math.floor(t / 3) % 3, k0 = (t % 3) / 3;
    const ease = Math.min(1, k0 * 2.5);
    const shape = (s, k, n) => {
      const a = k / n * 6.28;
      if (s === 0) return [160 + Math.cos(a) * 60, 125 + Math.sin(a) * 30];
      if (s === 1) return [40 + k / n * 240, 125];
      const r = k / n; return [100 + r * 140, 125 + (r < 0.5 ? -1 : 1) * (Math.abs(r - 0.5) * 2 - 1) * 30 * (k % 2 ? 1 : -1)];
    };
    const n = 48;
    for (let k = 0; k < n; k++) {
      const [x0, y0] = shape((phase + 2) % 3, k, n), [x1, y1] = shape(phase, k, n);
      rat(g, x0 + (x1 - x0) * ease, y0 + (y1 - y0) * ease, t, x1 >= x0 ? 1 : -1, k);
    }
    // la phrase jouée : trois notes en haut
    for (let k = 0; k < 3; k++) drawNote(g, 130 + k * 22, 20 + ((phase + k) % 3) * 6, (phase + k) % 2);
    pierre(g, 160, 128, 'play', t);
  },
};

// ─── Les sujets et leurs variantes (A : le jeu d'aujourd'hui) ───
const NOW = {
  title: 'Aujourd\'hui : on erre, l\'armée grossit', pitch: 'Pierre marche dans le quartier, joue, et les rats sortent des égouts pour le suivre. Pas encore de but : c\'est la base sur laquelle bâtir.',
  art: 'now', tag: 'actuelle',
  cols: ['Une ambiance : la nuit, la neige, Paris.', 'Marcher, jouer, regarder la nuée grossir et grouiller.', 'Rien : c\'est l\'état du jeu (v1.3.0).'],
};
const TOPICS = [
  {
    id: 'hamelin', icon: 'ti-book', title: 'Le conte de Hamelin',
    variants: [
      NOW,
      { title: 'Le marché du préfet', art: 'prefet', pitch: 'Le préfet de police promet une bourse à qui délivrera Paris des rats. Pierre les mène hors de la ville… et le préfet refuse de payer. On rejoue la fin du conte : que fait Pierre de sa colère ?',
        cols: ['Un récit en trois actes, fidèle au conte : la promesse, l\'exode des rats, la trahison. Une fin morale, sombre, que le joueur choisit.', 'Un objectif clair (rassembler les rats du quartier, puis les conduire jusqu\'à la Seine) et un choix final.', 'Des personnages (le préfet), quelques dialogues, une fin. Peu de nouvelles mécaniques.'] },
      { title: 'La Seine gelée', art: 'seine', pitch: 'Pour se débarrasser des rats, il faut les conduire sur la Seine gelée. Plus l\'armée est nombreuse, plus la glace craque : il faut l\'étirer en file, ne jamais la laisser s\'agglutiner.',
        cols: ['L\'image du conte (les rats noyés dans la Weser) devient une scène de Paris en 1815 : l\'hiver où la Seine a gelé.', 'Un niveau d\'adresse : diriger la forme de la nuée, pas seulement sa direction. La glace se fend sous le poids.', 'Une nouvelle zone (les quais, le fleuve) et un poids de la nuée par case. Simulation déjà prête.'] },
      { title: 'Les enfants de Paris', art: 'enfants', pitch: 'Un autre air attire les gamins des rues. Une seconde troupe, humaine, plus lente, qu\'il faut nourrir, réchauffer et protéger… des rats eux-mêmes.',
        cols: ['La part la plus inquiétante du conte, retournée : Pierre n\'enlève pas les enfants, il les sauve de l\'hiver. Ou pas.', 'Deux troupes à mener avec deux airs ; tension entre les deux (les rats effraient les enfants).', 'Des enfants (sprites, une petite simulation de file), un deuxième air.'] },
    ],
  },
  {
    id: 'empire', icon: 'ti-crown', title: 'L\'Empereur des rats',
    variants: [
      NOW,
      { title: 'Les Cent-Jours', art: 'centjours', pitch: 'Mars 1815 : l\'Empereur revient de l\'île d\'Elbe et rallie la France sans tirer un coup de feu. Pierre fait de même avec Paris : chaque égout gagné rallie un quartier, jusqu\'aux Tuileries.',
        cols: ['L\'année même du jeu. Pierre, enfant de la Grande Armée (un père mort en Russie ?), rejoue l\'épopée à sa façon.', 'Une carte de Paris en quartiers à rallier ; chaque quartier a ses rats, ses dangers, sa bouche d\'égout maîtresse.', 'Plusieurs quartiers générés (le générateur sait faire), une carte, une progression.'] },
      { title: 'Les corps d\'armée', art: 'corps', pitch: 'La nuée se divise en corps : éclaireurs rapides, grenadiers serrés qui renversent tout, sapeurs qui creusent sous les murs. Chaque corps répond à son air.',
        cols: ['Pierre devient un petit général : on parle de régiments, de colonnes, de manœuvres.', 'De la stratégie légère : envoyer les éclaireurs en avant, les sapeurs ouvrir un passage, garder les grenadiers.', 'Des groupes dans la simulation (un but par groupe), des comportements propres. Coût moyen.'] },
      { title: 'Waterloo sous les pavés', art: 'waterloo', pitch: 'Une autre colonie tient les égouts : les rats gris du Roi. Bataille de masses dans les galeries, où l\'on peut tout perdre en une charge.',
        cols: ['Juin 1815 : Waterloo. Une défaite possible, un exil (Sainte-Hélène : une île de la Seine ?).', 'Des affrontements de foules : effectifs, moral, terrain (galeries étroites). Perdre fait partie du jeu.', 'Une seconde nuée et des règles de combat simples. La simulation tient déjà des milliers de rats.'] },
    ],
  },
  {
    id: 'paris', icon: 'ti-snowflake', title: 'Paris, hiver 1815',
    variants: [
      NOW,
      { title: 'La faim', art: 'faim', pitch: 'L\'armée mange. Halles, greniers, boulangeries : sans grain, les rats désertent. Une seule ressource, qui oblige à bouger et à choisir ses rues.',
        cols: ['L\'hiver de misère : la ville a faim, les rats aussi. Voler du grain, c\'est prendre aux Parisiens.', 'Une jauge, des lieux à piller, des rats qui s\'en vont si on traîne. Simple et lisible.', 'Des lieux de nourriture dans le quartier (l\'atelier peut les placer), une jauge.'] },
      { title: 'Les égouts', art: 'egouts', pitch: 'Un second niveau sous la ville : galeries, puits, raccourcis. L\'armée y passe et ressort trois rues plus loin ; Pierre, lui, doit faire le tour.',
        cols: ['Le Paris souterrain, le royaume des rats. Pierre n\'y est pas chez lui.', 'Un réseau à maîtriser : envoyer la nuée par-dessous, la rappeler ailleurs ; Pierre et son armée séparés.', 'Une carte des égouts (une seconde grille), un rendu en coupe ou un calque. Coût moyen à fort.'] },
      { title: 'La peur', art: 'peur', pitch: 'La ville réagit : volets qui claquent, lumières qui s\'éteignent, gendarmes à lanterne, chats. Une rumeur qui enfle avec la taille de l\'armée.',
        cols: ['Pierre devient une légende noire de Paris. Les Parisiens le craignent, puis le chassent.', 'Furtivité : rester petit pour passer, grossir pour s\'imposer. Des patrouilles à éviter ou à submerger.', 'Des fenêtres qui changent d\'état, des gendarmes (une petite IA), une jauge de rumeur.'] },
    ],
  },
  {
    id: 'musique', icon: 'ti-music', title: 'Les airs de la flûte',
    variants: [
      NOW,
      { title: 'Partitions', art: 'partitions', pitch: 'Chaque petit air de trois notes est un ordre : venir, attendre, encercler, foncer, se disperser. On les joue au clavier ou au pouce, en rythme.',
        cols: ['La flûte n\'est plus un simple appel : c\'est la langue de Pierre avec ses rats.', 'Composer des ordres en rythme (comme Patapon) ; la nuée prend des formes. Se marie avec toutes les autres idées.', 'Un lecteur de séquences, des buts de formation dans la simulation. Coût moyen, gros gain.'] },
    ],
  },
];

// ─── Navigation : sujet ouvert, lettre active, adresse #sujet-C ───
const $ = id => document.getElementById(id);
const LETTERS = 'ABCDEFGH';
let topic = 0, variant = 0;

function readHash() {
  const m = location.hash.slice(1).match(/^([a-z]+)-([A-Z])$/);
  if (!m) return;
  const t = TOPICS.findIndex(x => x.id === m[1]);
  if (t < 0) return;
  topic = t; variant = Math.max(0, Math.min(TOPICS[t].variants.length - 1, LETTERS.indexOf(m[2])));
}
function writeHash() { history.replaceState(null, '', `#${TOPICS[topic].id}-${LETTERS[variant]}`); }

function renderMenu() {
  $('menu').innerHTML = TOPICS.map((t, ti) => `
    <button class="topic${ti === topic ? ' on' : ''}" type="button" data-topic="${ti}">
      <i class="ti ${t.icon}" aria-hidden="true"></i><span>${t.title}</span><span class="count">${t.variants.length}</span>
    </button>
    ${ti === topic ? `<ul class="variants">${t.variants.map((v, vi) => `
      <li><button class="variant${vi === variant ? ' on' : ''}" type="button" data-variant="${vi}" aria-current="${vi === variant}">
        <span class="letter">${LETTERS[vi]}</span><span>${v.title}</span></button></li>`).join('')}</ul>` : ''}`).join('');
  $('chips').innerHTML = TOPICS.map((t, ti) => `<button class="chip${ti === topic ? ' on' : ''}" type="button" data-topic="${ti}"><i class="ti ${t.icon}" aria-hidden="true"></i>${t.title}</button>`).join('');
  const vs = TOPICS[topic].variants;
  $('bottom').innerHTML = `
    <button class="bottom-nav" type="button" data-step="-1" aria-label="Variante précédente"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
    <div class="bottom-letters">${vs.map((v, vi) => `<button class="bottom-letter${vi === variant ? ' on' : ''}" type="button" data-variant="${vi}" aria-label="${LETTERS[vi]} : ${v.title}">${LETTERS[vi]}</button>`).join('')}</div>
    <span class="bottom-title">${vs[variant].title}</span>
    <button class="bottom-nav" type="button" data-step="1" aria-label="Variante suivante"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`;
}

let artCanvas = null, artFn = null, t0 = 0;
function renderView() {
  const v = TOPICS[topic].variants[variant];
  $('view').innerHTML = `
    <div class="v-head"><span class="letter">${LETTERS[variant]}</span><h1>${v.title}</h1>${v.tag ? `<span class="v-tag">${v.tag}</span>` : ''}</div>
    <p class="v-pitch">${v.pitch}</p>
    <div class="v-art"><canvas width="${W}" height="${H}" aria-hidden="true"></canvas></div>
    <div class="v-cols">
      <section class="v-col"><h2>Le récit</h2><p>${v.cols[0]}</p></section>
      <section class="v-col"><h2>Le jeu</h2><p>${v.cols[1]}</p></section>
      <section class="v-col"><h2>Ce que ça demande</h2><p>${v.cols[2]}</p></section>
    </div>
    <p class="v-hint">Flèches ← → pour changer de variante, ↑ ↓ pour changer de sujet${matchMedia('(hover: none)').matches ? ' ; balayer sur mobile' : ''}.</p>`;
  artCanvas = $('view').querySelector('canvas');
  artFn = ART[v.art];
  t0 = performance.now();
  $('view').scrollTop = 0;
}
function show() { renderMenu(); renderView(); writeHash(); }
function go(t, v) {
  topic = (t + TOPICS.length) % TOPICS.length;
  const n = TOPICS[topic].variants.length;
  variant = ((v % n) + n) % n;
  show();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-topic], [data-variant], [data-step]');
  if (!b) return;
  if (b.dataset.topic !== undefined) go(+b.dataset.topic, 0);
  else if (b.dataset.variant !== undefined) go(topic, +b.dataset.variant);
  else go(topic, variant + +b.dataset.step);
});
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight') { go(topic, variant + 1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { go(topic, variant - 1); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { go(topic + 1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { go(topic - 1, 0); e.preventDefault(); }
});
// Balayer horizontalement (mobile)
let touchX = null, touchY = null;
$('view').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
$('view').addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(topic, variant + (dx < 0 ? 1 : -1));
  touchX = null;
});
addEventListener('hashchange', () => { readHash(); renderMenu(); renderView(); });

// La vignette de la variante ouverte, animée
(function loop(now) {
  requestAnimationFrame(loop);
  if (!artCanvas || !artFn) return;
  const g = artCanvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  artFn(g, Math.max(0, (now - t0) / 1000));
})(0);

readHash();
show();
