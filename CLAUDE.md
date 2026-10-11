@.claude/conventions.md

# Pierre et les rats

## Description

Jeu en pixel art isométrique, dans la lignée graphique de Kingvi mais plus
détaillé (niveau de détail de *Kingdom*). On incarne Pierre, un enfant qui
joue de la flûte dans le Paris de la fin de l'époque napoléonienne, l'hiver
très rigoureux de 1815. Des notes sortent de la flûte ; les rats sortent des
bouches d'égout, le rejoignent et le suivent en laissant de légères traces
dans la neige. L'armée grossit à mesure qu'il joue.

- **Production** : https://supershivas.github.io/pierre-et-les-rats/
- **Catégorie** : secondaire (socle obligatoire ; fonctionnalités avancées
  seulement sur demande).
- **Cible** : mobile et bureau.
- Jeu : pas de sous-titre (section 8 bis des conventions).

### Échelle (js/scale.js, montrée par echelle.html)

1 pixel = 5 cm. Trace de rat : 1 px. Traces de Pierre : 2 × 1 px. Rat :
10 × 4 px, queue comprise. Note : 4 × 6 px. Pierre : 13 × 26 px (1,30 m).
Fenêtre : 18 × 30 px. Porte : 20 × 44 px. Module d'immeuble : une case de
60 × 60 px, un étage de 60 px (3 m), comble de 34 px, 6 étages au plus.
La vue montre environ 600 px du jeu en hauteur (v1.1.0), agrandis d'un
facteur entier : Pierre y est petit, comme le viking de Kingvi, et n'est
qu'**une silhouette noire** (`silhouette: true` de `drawPierre`).

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
- `js/city.js` : le modèle du quartier (une hauteur par case, 0 = rue), le
  hasard déterministe `hash`, le générateur de quartier `generateQuarter`
  (clairsemé : maisons basses, terrains vagues, environ 45 % de cases bâties).
- `js/buildings.js` : **le générateur d'immeubles iso**. Chaque colonne est
  peinte pixel par pixel une fois ; faces, ouvertures, toit, pignons,
  cheminées s'adaptent aux voisins (façon Townscaper). **Peu de détails, à
  dessein** (v1.0.1) : murs unis, une fenêtre sur deux, portes noires, pas
  de volets, boutiques ni lucarnes.
- `js/ground.js` : la neige des rues (une grande image), ombres portées,
  congères, bouches d'égout ; traces imprimées et effacées.
- `js/scene.js` : tri arrière → avant des colonnes et des sprites, partagé
  par le jeu et l'atelier ; `depthMap()`, le tampon de profondeur des
  maisons en écran monde (calculé une fois) qui cache les rats.
- `js/sprites.js` : Pierre, rat, notes, en tableaux de pixels.
- `js/audio.js` : la flûte (WebAudio) et son air.
- `js/city-store.js` : chargement du quartier publié et du brouillon.
- `atelier.html`, `js/atelier.js`, `css/atelier.css` : l'Atelier (bâtir,
  démolir, point de départ, nouveau quartier, publier).
- `echelle.html`, `js/echelle.js` : la planche d'échelle.
- `scripts/stamp-version.mjs` : estampille `?v=` sur imports et feuilles de
  style ; **à lancer après chaque changement de `version.json`** (GitHub
  Pages garde 10 min de cache).

## Exceptions aux conventions

- Atelier sans Labo : l'app n'a pas de Labo (app secondaire), donc pas
  d'icône fiole dans l'en-tête de l'atelier.
- L'Atelier publie avec l'API « contents » de GitHub (un seul fichier,
  `data/ville.json`), pas l'API des arbres comme Kingvi.

## Pièges connus

- Les immeubles de devant cachent les rues : on estompe (opacité 0,45) les
  colonnes dont la silhouette couvre Pierre, et on redessine Pierre tramé
  en ocre là où il reste caché (`xray` dans game.js).
- Modifier une hauteur change l'aspect des voisines : `scene.invalidate`
  efface le cache des 3 × 3 colonnes et repeint le sol alentour.
- La nuit (v1.0.2) : un masque de noir tramé (Bayer 4 × 4) posé sur la
  scène, clair autour de Pierre puis de plus en plus dense (`NIGHT`,
  `buildDarkness` dans game.js) ; les notes, la neige qui tombe et la
  silhouette de Pierre sont dessinées par-dessus.
- Performances (Chromium sans carte graphique, vue 1280 × 760) : 3 000
  rats → simulation 4,4 ms, rendu 9,7 ms (7,8 ms sans rats). Un drawImage
  par rat coûtait 12 ms de plus ; un envoi du tampon par diagonale, encore
  plus. Ne pas revenir en arrière.
- Le titre utilise IM Fell English (Google Fonts), propre au jeu.
