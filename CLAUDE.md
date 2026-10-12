@.claude/conventions.md

# Pierre et les rats

## Description

Jeu en pixel art isométrique, dans la lignée graphique de Kingvi mais plus
détaillé (niveau de détail de *Kingdom*). On incarne Pierre, un enfant qui
joue de la flûte dans **le Paris de la Commune** (v1.4.0 ; avant : 1815) :
janvier 1871, l'hiver du siège, où l'on mange les rats. Des notes sortent
de la flûte ; les rats sortent des bouches d'égout, le rejoignent et le
suivent en laissant de légères traces dans la neige. L'armée grossit à
mesure qu'il joue. Le monde est vu **à hauteur d'enfant**.

- **Production** : https://supershivas.github.io/pierre-et-les-rats/
- **Catégorie** : secondaire (socle obligatoire ; fonctionnalités avancées
  seulement sur demande).
- **Cible** : mobile et bureau.
- Jeu : pas de sous-titre (section 8 bis des conventions).

### Échelle (js/scale.js, montrée par echelle.html)

1 pixel = 5 cm. Trace de rat : 1 px. Traces de Pierre : 2 × 1 px. Rat :
10 × 4 px, queue comprise. Note : 4 × 6 px. Pierre : 13 × 26 px (1,30 m).
Porte-fenêtre : 12 × 40 px. Arcade du rez-de-chaussée : 28 × 48 px. Module
d'immeuble : une case de 60 × 60 px, un étage de 60 px (3 m), comble de
34 px, 7 niveaux au plus. Réverbère : 11 × 70 px (3,5 m).
La vue est fixe, de près : environ 250 px du jeu en hauteur (`VIEW_H` dans
game.js), agrandie d'un facteur entier. Plus de zoom qui recule avec
l'armée (retiré en v1.4.0 : « on vit le monde à hauteur d'enfant »).
Pierre n'est qu'**une silhouette noire** (`silhouette: true` de `drawPierre`).

### Palette du jeu (js/palette.js, variables --g-* de css/style.css)

La nuit d'hiver 1815 : **bleu nuit, blanc et noir** seulement (demande de
Jérôme, v1.0.1). Restreinte, identique entre canvas, HUD et commandes. Les
clés gardent leurs noms d'origine (pierre, ocre…) pour ne pas toucher aux
dessins : nuit `#05070c` (le noir), nuit2 `#0d1426`, ardoise `#16203a`,
neigeO `#2a3658`, neigeM `#4f5f88` (neige des rues), neige `#dfe6f1`
(neige des toits), pierreS `#0d1426`, pierre `#18223d`, pierreL `#25314f`
(murs), brun `#05070c`, brunC `#25314f`, rose `#0d1426`, peau `#dfe6f1`,
rougeS `#05070c`, rouge `#0d1426` (manteau de Pierre), ocreS `#dfe6f1`,
ocre `#f4f7fb` (le blanc : fenêtres éclairées, notes).
Aucune autre couleur dans le jeu. L'en-tête, les réglages, l'atelier et la
planche gardent les tokens du design system.

## Stack

- Vanilla JS (modules ES), canvas 2D, aucune dépendance, aucun build.
- Hébergement : GitHub Pages, depuis `main`, racine (`.nojekyll` pour que
  `CHANGELOG.md` soit servi tel quel).
- Données : locales. Partie dans `localStorage` (`pierre:partie`), réglages
  (`pierre:prefs`), brouillon de l'atelier (`pierre:ville-brouillon`), jeton
  GitHub de l'atelier (`pierre:gh-token`, jamais exporté). Export JSON dans
  les réglages (partie, réglages, brouillon).
- Le quartier publié vit dans `data/ville.json` (source de vérité), écrit par
  l'atelier via l'API GitHub (un commit sur `main`).

## Structure

- `index.html`, `js/main.js` : en-tête, accueil (le quartier défile derrière
  le titre), prologue, HUD, commandes, réglages, sauvegarde, mise à jour.
- `js/game.js` : la boucle (Pierre, appel des rats, traces dans un tampon
  circulaire typé, notes, fumées, neige, nuit, estompage des maisons qui
  cachent Pierre, silhouette tramée quand il est caché). `?rats=2000` dans
  l'adresse charge une nuée d'essai ; `window.pierreStats()` donne les
  temps moyens (ms) de simulation et de rendu.
- `js/swarm.js` : **la nuée**, pensée pour des milliers de rats (4 000
  simulés au plus, `MAX_RATS` dans game.js ; au-delà, l'armée est comptée).
  Tableaux typés, grille de voisinage reconstruite par tri par comptage,
  pilotage à la Reynolds (séparation, alignement, errance) plus un but :
  champ de vecteurs vers Pierre (carte des distances sur les rues), puis
  une place dans un disque qui tourne autour de lui. Machine à états :
  course, va-et-vient, dressé, saut, demi-tour, toilette ; pile (z) là où
  c'est serré. Rendu : pixels écrits dans un tampon Uint32, masqués par le
  tampon de profondeur des maisons, un seul envoi par image.
- `js/rat-sprites.js` : les poses des rats (galop ×3, vers nous, de dos,
  dressé ×2, saut, en boule), en listes de pixels et en petits canvas.
- `js/city.js` : le modèle du quartier : une hauteur par case (« rows »,
  0 = rien de bâti) et un terrain par case (« ground » : `.` rue ou maison,
  `~` Seine, `=` pont, `P` passage sous un immeuble, `N` Notre-Dame, tour
  à partir de 7 niveaux). `city.walk(i, j)` dit où l'on marche (rue, pont,
  passage) : c'est la seule règle de passage, utilisée partout. Le hasard
  déterministe `hash`, le générateur `generateQuarter` (26 × 22) : la Seine
  d'ouest en est, partagée autour de l'île de la Cité (Notre-Dame à l'est,
  façade et rose tournées vers +x pour être vues, parvis devant), quais,
  ponts, rues des deux rives, îlots haussmanniens de 5 à 7 niveaux, vieilles
  maisons sur l'île et au sud-est, passages, départ sur la place.
- `js/props.js` : le mobilier urbain (réverbère, arbre, banc, colonne
  Morris, borne), dessiné une fois par type, tiré au sort par
  `generateProps`, gardé dans `data/ville.json` (« props » : type, x, y en
  monde, variante). Pierre bute dessus ; les rats non. Les réverbères
  percent la nuit (une ellipse tramée en `destination-out` sur la couche de
  nuit, seulement s'il y en a un à l'écran).
- `js/buildings.js` : **le générateur d'immeubles iso**. Chaque colonne est
  peinte pixel par pixel une fois ; faces, ouvertures, toit, pignons,
  cheminées (0 à 3) s'adaptent aux voisins (façon Townscaper). **Peu de
  détails, à dessein** : murs unis, vitres noires. Trois styles :
  haussmannien (4 niveaux et plus : RDC à refends avec boutique, porte
  cochère, café ou porte ; entresol ; fronton au 2e ; balcons filants au 2e
  et au 5e ; balconnets ; corniche ; Mansart et lucarnes ; deux ou trois
  fenêtres par module), **vieille maison parisienne** (3 niveaux et moins :
  fenêtres irrégulières à volets, devanture de bois, toit à deux pans,
  lucarne à poulie), Notre-Dame (nef : contreforts, lancettes, toit raide ;
  tours : portail, galerie des rois, rose éclairée, abat-sons, balustrade).
  Option `night` (le jeu) : au-dessus de 3,75 m la façade s'enfonce dans le
  noir (trame de Bayer selon la hauteur, `NIGHT_Z0`, `NIGHT_Z1`), sauf les
  fenêtres éclairées ; l'atelier dessine sans la nuit.
- `js/ground.js` : le sol (une grande image) : chaussée, trottoirs et leur
  bordure le long des maisons, ombres portées, bouches d'égout ; la Seine
  (eau noire, glaçons), les murs de quai, les ponts et leurs parapets ;
  traces imprimées et effacées.
- `js/scene.js` : tri arrière → avant des colonnes et des sprites, partagé
  par le jeu et l'atelier ; **le décor pré-calculé** (v1.3.0, `buildDecor`,
  `drawDecor`) : sol, maisons et mobilier dans une seule image (en
  coordonnées du tampon de profondeur), où les traces se recopient
  (`ground.mirror`, sauf sous une maison : masque `covered`). Le jeu ne
  redessine en détail qu'un rectangle autour de Pierre (lui, trié parmi
  les maisons, et celles qui le cachent, estompées) ; l'atelier garde le
  dessin colonne par colonne ; `depthMap()`, le tampon de profondeur des
  maisons en écran monde (calculé une fois : l'indice de la colonne la plus
  en avant par pixel) qui cache les rats, sauf derrière une maison estompée.
- `js/sprites.js` : Pierre, rat, notes, en tableaux de pixels.
- `js/audio.js` : la flûte (WebAudio) et son air.
- `js/city-store.js` : chargement du quartier publié et du brouillon.
- `atelier.html`, `js/atelier.js`, `css/atelier.css` : l'Atelier (bâtir,
  démolir un étage ou un objet, point de départ, mobilier, terrain : Seine,
  pont, passage, Notre-Dame ; nouveau quartier, publier). Bouton « Plan »
  (touche V) : la vue de dessus, une case par carré, le nombre d'étages
  écrit dessus, pour atteindre les maisons cachées derrière les autres.
- `echelle.html`, `js/echelle.js` : la planche d'échelle.
- `labo.html`, `js/labo.js`, `css/labo.css` : le Labo (créé à la demande de
  Jérôme, v1.3.0 ; refait pour la Commune en v1.4.0). Cinq sujets
  (scénarios de la Commune, personnages secondaires, objets, bâtiments,
  urbanisme), quatre idées chacun ; A = le jeu d'aujourd'hui. Chaque idée : un titre, une phrase, une
  vignette animée (vue de face, palette du jeu, fonctions de `ART`) et trois
  colonnes (le récit, le jeu, ce que ça demande). Ajouter une idée = une
  entrée dans `TOPICS` et sa vignette. Lien « Labo » (fiole) dans les
  réglages et dans l'en-tête de l'atelier.
- `js/labo-3d.js` : **le prototype three.js** (v1.4.1, sujet « Moteur » du
  Labo, en direct). three.js **0.170.0**, chargé à la demande depuis
  jsDelivr par le Labo seulement (accord de Jérôme ; le jeu n'en dépend
  pas). Même quartier, mêmes façades (renderColumn redressé en textures),
  même nuée (`swarm.state`), rendu basse résolution agrandi sans lissage,
  matériaux non éclairés en filtrage « nearest » : la palette reste exacte.
  Trois caméras (`mode` : `iso` orthographique 1:1, `child` derrière Pierre,
  `free` qui tourne). Coupe autour de Pierre (`setCut`), silhouette tramée à
  travers les murs. `mount2D` monte le jeu 2D actuel pour comparer.
- `scripts/stamp-version.mjs` : estampille `?v=` sur imports et feuilles de
  style ; **à lancer après chaque changement de `version.json`** (GitHub
  Pages garde 10 min de cache).
- `data/ville.json` : régénérer le quartier par défaut avec
  `generateQuarter(1871)` puis `formatCity` (city-store.js) ; vérifier que
  « ground » y figure.

## Exceptions aux conventions

- L'Atelier publie avec l'API « contents » de GitHub (un seul fichier,
  `data/ville.json`), pas l'API des arbres comme Kingvi.

## Pièges connus

- Les immeubles de devant cachent les rues (et la Seine) : autour de Pierre,
  les colonnes plus en avant qui couvrent ses abords sont **coupées au
  rez-de-chaussée** (maison de poupée, `'cut'` dans `scene.draw`,
  `drawCut`), dans le rectangle redessiné en détail ; les rats s'y voient.
  Pierre reste tramé en ocre là où il serait encore caché (`xray`).
- Modifier une hauteur change l'aspect des voisines : `scene.invalidate`
  efface le cache des 3 × 3 colonnes et repeint le sol alentour.
- La nuit vient du ciel et des étages (v1.4.0), peinte dans les maisons
  (`night` de buildings.js) ; plus de masque rond autour de Pierre. Les
  réverbères gardent une flamme vive.
- Performances (Chromium sans carte graphique, vue 1280 × 760) : 3 000
  rats → simulation 4,4 ms, rendu 9,7 ms (7,8 ms sans rats). Un drawImage
  par rat coûtait 12 ms de plus ; un envoi du tampon par diagonale, encore
  plus. Ne pas revenir en arrière. v1.3.0, décor pré-calculé : rendu
  ~3,7 ms avec peu de rats (9,7 avant), ~10,7 ms à 3 000 rats (13 avant) ;
  la nuée elle-même ~2 ms (`pierreStats().ms.rats`). Mémoire : le décor
  (~2 640 × 1 860 px) plus le masque et le tampon de profondeur.
- Le titre utilise IM Fell English (Google Fonts), propre au jeu.
