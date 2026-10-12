@.claude/conventions.md

# Pierre et les rats

## Description

Jeu en pixel art 3D (v2.0.0 : three.js, caméra libre ; avant, isométrique en
canvas 2D), dans la lignée graphique de Kingvi mais plus détaillé (niveau de
détail de *Kingdom*). On incarne Pierre, un enfant qui joue de la flûte dans
**le Paris de la Commune** (v1.4.0 ; avant : 1815) : janvier 1871, l'hiver du
siège, où l'on mange les rats. Des notes sortent de la flûte ; les rats
sortent des bouches d'égout, le rejoignent et le suivent en laissant de
légères traces dans la neige. L'armée grossit à mesure qu'il joue. Le monde
est vu **à hauteur d'enfant**, de près, la caméra tourne librement autour de
Pierre.

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
La vue est de près : environ 250 px du jeu en hauteur (`VIEW_H`), calculée en
petite résolution puis agrandie d'un facteur entier sans lissage. Pas de zoom
qui recule avec l'armée (retiré en v1.4.0) ; en 3D le joueur zoome à la main
(molette, pincer ; `ppu` : 0,4 à 2,4 pixels d'écran par pixel du monde).
Pierre n'est qu'**une silhouette noire** (un petit modèle de boîtes noires en
3D ; `silhouette: true` de `drawPierre` en 2D).
En 3D, les murs d'immeuble font 1 étage = 60 px de haut ; un immeuble « coupé »
(entre la caméra et Pierre) tombe à un muret de 24 px (`CUT_H`).

### Palette du jeu (js/palette.js, variables --g-* de css/style.css)

La nuit d'hiver (1871 ; 1815 avant la v1.4.0) : **bleu nuit, blanc et noir** seulement (demande de
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

- Vanilla JS (modules ES), aucun build. Le jeu est rendu par **three.js 0.170.0**
  (v2.0.0, accord de Jérôme), **copié dans `vendor/`** : aucun CDN, aucun
  `npm`. `js/three-lib.js` le charge à la demande. Le canvas 2D reste pour
  l'atelier, la planche d'échelle et l'ancien moteur (secours : navigateur sans
  WebGL, ou `?moteur=2d` dans l'adresse).
- Hébergement : GitHub Pages, depuis `main`, racine (`.nojekyll` pour que
  `CHANGELOG.md` soit servi tel quel).
- Données : locales. Partie dans `localStorage` (`pierre:partie`), réglages
  (`pierre:prefs`), brouillon de l'atelier (`pierre:ville-brouillon`), jeton
  GitHub de l'atelier (`pierre:gh-token`, jamais exporté). Export JSON dans
  les réglages (partie, réglages, brouillon).
- Le quartier publié vit dans `data/ville.json` (source de vérité), écrit par
  l'atelier via l'API GitHub (un commit sur `main`).

## Structure

**Moteur 3D (v2.0.0, celui du jeu ; grille déformée depuis la v2.2.0)**

- `js/game3d.js` : `createGame3D` (même interface que `createGame` de game.js :
  `input`, `screenToWorld`, `setPlaying`, `snapshot`, `reload`, `stats`…, plus
  `orbit`, `zoomBy`). La boucle, Pierre (modèle de boîtes noires animé), la
  nuée (swarm.js, rendue en `InstancedMesh`), les traces (un `Points` dont le
  shader efface les plus vieilles), les notes (sprites), la fumée des
  cheminées, la neige (entièrement dans le shader), la caméra libre (yaw,
  tangage, `ppu`), rendu en trois passes : décor, puis Pierre et rats
  **tramés là où le décor les cache** (`GreaterDepth`, damier de 1 px), puis
  Pierre et rats. `?rats=2000` charge une nuée d'essai ; `pierreStats()` donne
  les temps (ms).
- `js/warp.js` : **la grille déformée** (v2.2.0). La logique (rues, immeubles, nuée,
  collisions, traces, sauvegarde) reste sur la grille carrée ; seul le rendu la
  plie : un méandre de la Seine (rotation autour du fleuve, qui s'éteint avec la
  distance) plus un champ lisse d'irrégularités, pour que quais et îlots ne soient
  pas droits. `makeWarp(city)` : `fwd(x, y)` → [X, Y, jacobienne], `inv`,
  `dirToLogical` / `dirToWorld`, et `WARP_GLSL` (la même fonction pour les shaders).
  **Règle** : sol, eau, immeubles, mobilier, ponts, cathédrale, traces et fumée
  passent par `warp()` dans leur shader vertex (les matériaux de base de three.js
  par `warped()` de world3d.js) ; Pierre, les rats, les notes, la caméra, les
  lumières et la coupe des immeubles sont calculés en CPU avec `fwd` (monde déformé).
  Pierre marche à vitesse égale dans le monde déformé. Ne pas toucher aux
  constantes sans refaire l'essai du déterminant (il doit rester entre 0,55 et 1,5,
  sinon la grille se replie).
- `js/bridges3d.js` : les ponts (v2.2.0), d'après le Pont Neuf : `findBridges` (les
  rectangles de cases `=`, leur axe, leur sorte), `addBridge`. `neuf` : largeur ≥ 3
  cases, portée ≥ 5 : 5 à 7 arches en plein cintre, piles à avant-bec, corniche,
  parapet, demi-lunes ; `court` : pierre, arches surbaissées ; `fonte` (largeur ≤ 2) :
  passerelle, arcs de fonte sous un tablier, garde-corps à barreaux.
- `js/world3d.js` : le monde. **Le sol** : une texture d'un octet par pixel
  (indice de palette) lue par un shader qui lit la palette dans une texture de
  9 × 1 ; l'eau à −70 px (3,5 m ; un maillage à part : un motif de 144 × 96 qui se répète, lu en coordonnées de la grille, avec un décalage dans le temps : la Seine coule le long du fleuve), des murs de quai, des ponts (bridges3d.js). Un pont débouche toujours sur une rue (générateur et atelier). **Un immeuble** =
  une géométrie (4 murs, toit à la Mansart ou à deux pans selon les voisins,
  lucarnes, cheminées) + une texture d'indices de 4 faces côte à côte, peinte par
  `renderColumn` (buildings.js) : deux faces telles quelles, les deux autres en
  faisant tourner la ville d'un demi-tour (`rotated`). Les façades se peignent
  **après le démarrage, les plus proches de Pierre d'abord** (`paintSome`, un
  budget de quelques ms par image, en deux temps par immeuble). **La coupe** :
  chaque image, un immeuble entre la caméra et Pierre dont la boîte, projetée
  à l'écran (et visible à l'écran), recouvre le disque autour de lui, et qui est près de la droite caméra → Pierre (plus : celui où la caméra entre, ou dont un coin passe derrière la caméra), tombe à `CUT_H` (le shader
  rabat tout ce qui est au-dessus, en 0,2 s). Les passages (`P`) sont de vrais
  tunnels (l'arche est du vide : l'indice 255 est jeté par le shader).
  **Lumière** : les 16 réverbères les plus proches de la caméra (`setLights`, vacillants) éclairent sol, eau et façades par un halo doux calculé dans les shaders (`LIGHT_GLSL`, hors palette assumé). **Flou de profondeur** (game3d.js) : le monde est rendu dans une texture couleur + profondeur, un plan la relit en floutant selon l'écart à la distance de Pierre ; réglage « Flou de profondeur » (`prefs.blur`). Les façades ne se peignent que dans 1 700 px autour de Pierre.
- `js/cathedral3d.js` : Notre-Dame, **un seul bloc** : tours, façade peinte,
  nef, bas-côtés, arcs-boutants, transept, flèche, chevet ; posé sur le rectangle
  des cases `N` (`city.cathedral`, façade du côté des cases les plus hautes).
- `js/props3d.js` : réverbère, arbre nu (6 variantes, branches tirées au sort,
  neige sur les branches qui s'y prêtent), banc, colonne Morris, borne : des
  géométries à couleurs de sommets, instanciées.
- `js/geo.js` : le `Mesher` (boîtes, cylindres, cônes, prismes, branches ;
  chaque triangle prend un des trois tons de sa teinte d'après son orientation,
  la neige sur le dessus : tout reste dans la palette).
- `js/controls.js` : les commandes au pouce/souris (marcher vers le point
  touché ; clic droit ou deux doigts pour tourner, pincer/molette pour zoomer),
  partagées avec le Labo. Le clavier du jeu est dans main.js (J et L font
  tourner la vue ; deux boutons à l'écran aussi).
- `js/three-lib.js`, `vendor/` : three.js. Les couleurs sont passées telles
  quelles (`ColorManagement` coupé, sortie linéaire) : la palette est exacte.

**Moteur 2D (ancien ; secours, atelier, labo)**

- `index.html`, `js/main.js` : en-tête, accueil (le quartier défile derrière
  le titre), prologue, HUD, commandes, réglages, sauvegarde, mise à jour.
- `js/game.js` : l'ancienne boucle 2D (Pierre, appel des rats, traces dans un tampon
  circulaire typé, notes, fumées, neige, nuit, estompage des maisons qui
  cachent Pierre, silhouette tramée quand il est caché). `?rats=2000` dans
  l'adresse charge une nuée d'essai ; `window.pierreStats()` donne les
  temps moyens (ms) de simulation et de rendu.
- `js/swarm.js` : **la nuée** (commune aux deux moteurs), pensée pour des milliers de rats (4 000
  simulés au plus, `MAX_RATS` dans game.js ; au-delà, l'armée est comptée).
  Tableaux typés, grille de voisinage reconstruite par tri par comptage,
  pilotage à la Reynolds (séparation, alignement, errance) plus un but :
  champ de vecteurs vers Pierre (carte des distances sur les rues), puis
  une place dans un disque qui tourne autour de lui. Machine à états :
  course, va-et-vient, dressé, saut, demi-tour, toilette ; pile (z) là où
  c'est serré. **Un rat perdu** (sans chemin jusqu'à Pierre) **ou pris dans un
  mur** est recollé près de lui au bout de 1,5 s (`rescue`). Rendu 2D : pixels
  écrits dans un tampon Uint32, masqués par le tampon de profondeur des maisons.
- `js/rat-sprites.js` : les poses des rats (galop ×3, vers nous, de dos,
  dressé ×2, saut, en boule), en listes de pixels et en petits canvas.
- `js/city.js` : le modèle du quartier : une hauteur par case (« rows »,
  0 = rien de bâti) et un terrain par case (« ground » : `.` rue ou maison,
  `B` avenue ou quai plantés, `~` Seine, `=` pont, `P` passage sous un
  immeuble, `N` Notre-Dame : **toutes les cases N forment un seul bloc**, en 2D
  des étages, en 3D la cathédrale). `city.walk(i, j)` dit où l'on marche (rue,
  avenue, pont, passage) : c'est la seule règle de passage, utilisée partout.
  `city.reach` : les cases joignables depuis le départ (bouches d'égout et
  mobilier n'y vont que là). `city.cathedral` : { i0, j0, w, d, facing }.
  Le hasard déterministe `hash` (et `hash3`), le générateur `generateQuarter`
  (**88 × 72**, tracé à la main d'après le plan de Paris, v2.2.0 ; sur la grille la
  Seine est une bande droite, c'est warp.js qui la plie) : le fleuve, large de 7
  cases, d'ouest en est ; il se partage autour de l'**île de la Cité** (en amande,
  28 colonnes, bras nord de 5 cases, bras sud de 3 ; vieilles maisons à l'ouest,
  parvis, **Notre-Dame 8 × 4 cases à l'est, façade à l'ouest**), puis de l'**île
  Saint-Louis**, reliée à la Cité par une passerelle d'est en ouest ; quais de 3
  cases ; cinq boulevards est-ouest et cinq nord-sud de 4 cases, droits (dont ceux
  qui portent les grands ponts) ; des rues de 2 cases (passerelles) ; trois
  squares (les Tuileries, le Luxembourg, le Jardin des Plantes) ; puis les îlots
  restants : haussmanniens (deux cases d'épaisseur, 5 à 7 niveaux, une ruelle
  centrale avec des passages couverts) ou vieux quartier (ruelles d'une case,
  maisons de 1 à 4 niveaux : les îles, le Quartier latin au sud-ouest, le Marais au
  nord-est). Sous un pont, la rive est droite (les colonnes d'un pont ont la forme
  de la première), pour que chaque pont soit un rectangle de cases `=`. Les
  repères du générateur sont des colonnes et des rangées données pour 88 × 72.
- `js/props.js` : le mobilier urbain (réverbère, arbre, banc, colonne Morris,
  borne), tiré au sort par `generateProps`, gardé dans `data/ville.json`
  (« props » : type, x, y en monde, variante, **quart de tour** du banc ; les
  anciennes données à 4 valeurs marchent). Avenues et quais : un arbre toutes
  les 3 cases sur chaque trottoir, un réverbère entre deux arbres, des bancs,
  une colonne Morris de loin en loin (détectés dans les cases B). Pierre bute
  dessus ; les rats non. Les dessins 2D (sprites) servent l'atelier et la
  planche d'échelle ; les modèles 3D sont dans props3d.js.
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
  Option `night` (le jeu) : de 110 à 180 px (3e étage) la façade s'enfonce dans le
  noir (trame de Bayer selon la hauteur, `NIGHT_Z0`, `NIGHT_Z1`), sauf les
  fenêtres éclairées ; l'atelier dessine sans la nuit.
- `js/ground.js` : le sol (2D : une grande image ; `makeGroundColor` donne la couleur de chaque pixel, aussi pour la texture 3D) : chaussée, trottoirs et leur
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
  pont, passage, avenue, Notre-Dame — les cases N, un seul bloc, remplacent ce
  qu'elles couvrent ; nouveau quartier, publier). Il reste en vue iso 2D. Bouton « Plan »
  (touche V) : la vue de dessus, une case par carré, le nombre d'étages
  écrit dessus, pour atteindre les maisons cachées derrière les autres.
- `echelle.html`, `js/echelle.js` : la planche d'échelle.
- `labo.html`, `js/labo.js`, `css/labo.css` : le Labo (créé à la demande de
  Jérôme, v1.3.0 ; refait pour la Commune en v1.4.0). Cinq sujets
  (scénarios de la Commune, personnages secondaires, objets, bâtiments,
  urbanisme) et le moteur ; A = le jeu d'aujourd'hui. Chaque idée : un titre, une phrase, une
  vignette animée (vue de face, palette du jeu, fonctions de `ART`) et trois
  colonnes (le récit, le jeu, ce que ça demande). Ajouter une idée = une
  entrée dans `TOPICS` et sa vignette. Lien « Labo » (fiole) dans les
  réglages et dans l'en-tête de l'atelier.
- `js/labo-3d.js` : le sujet « Moteur » du Labo, en direct : `mount3D` monte le
  jeu 3D (A, actuelle), `mount2D` l'ancien moteur 2D (B, ancienne).
- `scripts/stamp-version.mjs` : estampille `?v=` sur imports et feuilles de
  style ; **à lancer après chaque changement de `version.json`** (GitHub
  Pages garde 10 min de cache).
- `data/ville.json` : régénérer le quartier par défaut avec
  `generateQuarter(1871)` puis `formatCity` (city-store.js) ; vérifier que
  « ground » y figure. (Le générateur importe props.js, qui ne touche au DOM
  qu'à la demande : il tourne sous Node.)

## Exceptions aux conventions

- L'Atelier publie avec l'API « contents » de GitHub (un seul fichier,
  `data/ville.json`), pas l'API des arbres comme Kingvi.
- three.js (une dépendance, acceptée par Jérôme pour la v2) est **copié dans
  `vendor/`** (MIT, `vendor/LICENSE-three`) : pas de CDN. `scripts/stamp-version.mjs`
  ne touche pas à `vendor/` (son `?v=170` est celui de three.js).
- (v2.0.0 a été poussée sur `main` ; la session imposait une branche, Jérôme veut toujours `main`.)

## Pièges connus

- **Moteur 3D** : les textures sont des octets d'indice de palette
  (`PAL_INDEX`) : jamais de mipmaps ni de filtrage linéaire (moyenner des
  indices ferait n'importe quoi) ; limiter le dézoom (`PPU_MIN`). Toute couleur
  nouvelle va dans `palette.js`, et alors dans `PALETTE` (maintenant 9
  couleurs distinctes). Les passes de rendu comptent : le double tramé de
  Pierre et des rats se dessine **avant** eux (sinon il traverse leurs propres
  membres). Les points (traces, neige, fumée) ont une taille en pixels de
  l'écran réduit, pas en unités du monde.
- Un rat « qui disparaît dans une rue étroite » n'était pas perdu : c'était
  l'occultation par les maisons de devant (2D comme 3D). En 3D : la coupe des
  immeubles, plus le double tramé des rats à moins de 260 px de Pierre. Le vrai
  bug (rats hors de portée ou dans un mur) est réparé dans swarm.js.
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
- Performances 3D (Chromium sans carte graphique, vue 1280 × 760, v2.0.0) :
  3 000 rats → simulation ~5 ms ; les matrices des rats ~0,5 ms ; la coupe
  des immeubles ~0,2 ms ; 650 immeubles ≈ 650 appels de dessin (le
  rendu logiciel est lent, une vraie carte graphique non mesurée). Au
  démarrage : ~1,3 s (le sol, les géométries), puis les façades se peignent en
  fond (~7 ms par immeuble, 3 ms par image). Mémoire : ~45 Mo de textures d'indices
  pour les façades, 6 Mo pour le sol. Un `renderColumn` coûte 3 à 6 ms : ne pas
  repeindre pendant le jeu.
- **Déformation** (v2.2.0) : deux systèmes de coordonnées. La simulation, `city`,
  `solid()`, `swarm`, la sauvegarde sont en coordonnées de la grille ; ce que voit la
  caméra est déformé. Toute nouvelle géométrie 3D doit passer par `warp()` (shader)
  ou `warped(matériau)` ; tout nouvel acteur doit convertir sa position (`W.fwd`) et
  son cap (`W.dirToWorld`). `screenToWorld` rend des coordonnées de la grille.
- **Le moteur 2D (secours, Labo B) est lourd sur la grande carte** : sur 88 × 72 le
  décor précalculé fait ~9 600 × 4 800 px ; en rendu logiciel (Chromium sans carte
  graphique) la page ne répond plus pendant plus de 30 s (déjà vrai en v2.1.0). À
  réduire si ce moteur doit servir pour de bon.
- Le titre utilise IM Fell English (Google Fonts), propre au jeu.
