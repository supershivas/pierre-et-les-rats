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
La vue montre environ 240 px du jeu en hauteur, agrandis d'un facteur entier.

### Palette du jeu (js/palette.js, variables --g-* de css/style.css)

Hiver parisien 1815, restreinte, identique entre canvas, HUD et commandes :
nuit `#1f2a44`, nuit2 `#34405e`, ardoise `#56627e`, neigeO `#9aabc4`,
neigeM `#cdd8e6`, neige `#eef3f8`, pierreS `#6f665a`, pierre `#9d917c`,
pierreL `#c9bda5`, brun `#4e3a2e`, brunC `#7a5c45`, rose `#c98d84`,
peau `#e0b494`, rougeS `#7e2620`, rouge `#b5382c` (manteau de Pierre),
ocreS `#b9782f`, ocre `#e6b35a` (fenêtres éclairées, notes).
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
- `js/game.js` : simulation et rendu (Pierre, rats, carte des distances
  pour les guider dans les rues, traces, notes, fumées, neige, estompage
  des maisons qui cachent Pierre, silhouette tramée quand il est caché).
- `js/city.js` : le modèle du quartier (une hauteur par case, 0 = rue), le
  hasard déterministe `hash`, le générateur de quartier `generateQuarter`.
- `js/buildings.js` : **le générateur d'immeubles iso**. Chaque colonne est
  peinte pixel par pixel une fois ; faces, ouvertures, toit, pignons,
  lucarnes, cheminées s'adaptent aux voisins (façon Townscaper).
- `js/ground.js` : la neige des rues (une grande image), ombres portées,
  congères, bouches d'égout ; traces imprimées et effacées.
- `js/scene.js` : tri arrière → avant des colonnes et des sprites, partagé
  par le jeu et l'atelier.
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
- Le titre utilise IM Fell English (Google Fonts), propre au jeu.
