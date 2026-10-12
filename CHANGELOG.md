# Historique

## 2.2.0 — 2026-10-12
- Une carte organique, tracée à la main d'après le plan de Paris : la Seine serpente, l'île de la Cité (avec Notre-Dame sur son parvis) et l'île Saint-Louis ont leur forme d'amande, et la grille de la ville est déformée : quais, boulevards et îlots courbes, immeubles un peu de travers
- Des ponts inspirés du Pont Neuf : de grands ponts de pierre (5 à 7 arches en plein cintre, piles à avant-bec, demi-lunes au-dessus des piles, corniche, parapet), des ponts de pierre plus courts aux arches surbaissées, des passerelles de fonte à garde-corps de barreaux
- La Seine se partage en deux bras autour de la Cité, avec un chenal entre les deux îles ; cinq boulevards est-ouest et cinq nord-sud, trois squares (Tuileries, Luxembourg, Jardin des Plantes)
- Pierre marche à la même vitesse partout, malgré la déformation ; la caméra, les lumières et la coupe des immeubles suivent le monde déformé
- Correction : un immeuble collé à la caméra (un coin passe derrière elle) se baisse de nouveau quand il cache Pierre

## 2.1.0 — 2026-10-12
- Une ville près de quatre fois plus grande (88 × 72 cases) : quatre boulevards est-ouest, trois nord-sud, des rues, des squares, six ponts
- La Seine fait sept cases de large, traverse toute la carte sans être coupée et coule à 3,5 m sous les quais ; des piles sous les ponts, des garde-corps sur les quais
- De vrais halos de lumière, doux et vacillants, autour des réverbères (ils éclairent le sol, l'eau et les façades)
- Un flou de profondeur autour de Pierre (une case à cocher dans les réglages)
- Dès le 3e étage, les façades sont noires (sauf les fenêtres éclairées)
- Les immeubles ne se baissent que s'ils cachent vraiment Pierre ou son armée à l'écran (silhouette exacte)

## 2.0.1 — 2026-10-12
- Les immeubles ne se baissent plus que s'ils cachent vraiment Pierre à l'écran (plus de maisons coupées hors du champ)
- La souris dirige Pierre : un clic droit perdu ne fait plus tourner la vue à la place
- Plus de lumière : ombres tramées, façades moins noires la nuit, larges halos de réverbère
- La Seine coule (glaçons et rides animés) ; des garde-corps de fonte sur les ponts
- Un pont débouche toujours sur une rue (le générateur et l'atelier rasent les maisons à ses bouts)
- Pierre tient sa flûte à deux mains devant la bouche

## 2.0.0 — 2026-10-12
- Le jeu passe en vraie 3D (three.js) : la caméra se fait tourner librement autour de Pierre (J et L, deux boutons à l'écran, le bouton droit ou deux doigts ; la molette ou le pincement zooment)
- Une ville refaite : de grands boulevards droits plantés d'arbres, de réverbères et de bancs, des ruelles de maisons basses, la Seine d'un bout à l'autre de la carte avec cinq ponts, Notre-Dame d'un seul bloc sur son île
- Les arbres, bancs, colonnes Morris, bornes et réverbères sont en 3D ; les immeubles entre la caméra et Pierre se coupent en muret, et Pierre comme les rats restent visibles à travers les murs ; les rats perdus sont recollés à l'armée
- L'atelier : un outil Avenue ; Notre-Dame est un seul bloc de cases ; le Labo montre le jeu 3D et l'ancien moteur 2D, qui reste le moteur de secours sans WebGL

## 1.4.1 — 2026-10-12
- Le Labo : un sujet « Moteur » pour comparer en direct le jeu d'aujourd'hui (canvas 2D) et un prototype three.js du même quartier et de la même nuée, en isométrique pixel, à hauteur d'enfant et en vue libre

## 1.4.0 — 2026-10-12
- On change d'époque : Paris en janvier 1871, l'hiver du siège, juste avant la Commune
- La Seine traverse le quartier, se partage autour de l'île de la Cité où se dresse Notre-Dame ; des quais, des ponts, des trottoirs, des passages sous les immeubles
- Les maisons basses sont de vieilles maisons parisiennes ; les immeubles haussmanniens ont plusieurs rez-de-chaussée (boutique, porte cochère, café, porte), des balcons au 2e et au 5e, une à trois cheminées
- Le monde à hauteur d'enfant : plus de vue large ; la nuit tombe du ciel et des étages, et les maisons devant Pierre se coupent au rez-de-chaussée pour qu'on voie la rue
- L'atelier : une vue de dessus (le nombre d'étages sur chaque case) et un outil Terrain (Seine, pont, passage, Notre-Dame)
- Le Labo : des scénarios de la Commune, des personnages, des objets, des bâtiments et des idées d'urbanisme

## 1.3.0 — 2026-10-11
- Le Labo (lien dans les réglages) : dix idées pour la suite, du conte de Hamelin à l'épopée de 1815, chacune avec une vignette animée
- Le décor (rues, immeubles, mobilier) est pré-calculé en une seule image : le jeu est plus fluide
- Le zoom ne recule qu'à partir d'une trentaine de rats, jamais deux paliers de suite, et le travelling dure cinq secondes

## 1.2.0 — 2026-10-11
- Le zoom suit l'armée : tout près de Pierre quand il est seul, de plus en plus loin à mesure que les rats arrivent (un travelling doux)
- Des immeubles haussmanniens, sans détails de plus : rez-de-chaussée à refends et arcades, hautes portes-fenêtres alignées, balcons filants au 2e et au 5e, corniche, comble à la Mansart et ses lucarnes, la même hauteur le long d'un îlot
- Du mobilier urbain : réverbères (qui éclairent la nuit), arbres nus, bancs, colonnes Morris, bornes ; l'atelier a un outil « Mobilier » pour les poser, et « Démolir » les retire
- On voit les rats à travers les maisons estompées, et Pierre part d'un coin dégagé de la place

## 1.1.0 — 2026-10-11
- Une vraie nuée : les rats grouillent sans arrêt, vont dans tous les sens, se dressent, sautent, se retournent, se lèchent et se montent dessus
- La nuée tient des milliers de rats (essayé jusqu'à 4 000) ; ils sortent des égouts par groupes de plus en plus gros
- Pierre n'est plus qu'une petite silhouette noire, et on voit bien plus loin autour de lui

## 1.0.2 — 2026-10-11
- Il fait nuit : le quartier s'enfonce dans le noir, seule une lueur entoure Pierre

## 1.0.1 — 2026-10-11
- Le jeu passe à la nuit : bleu nuit, blanc et noir
- Moins de maisons, plus basses, et beaucoup moins de détails sur les façades (ni volets, ni boutiques, ni lucarnes)

## 1.0.0 — 2026-10-11
- Première version : Pierre marche dans le Paris enneigé de 1815, joue de la flûte et appelle les rats, qui le suivent en laissant de légères traces
- Générateur de maisons et d'immeubles en 3D isométrique, et un atelier pour bâtir le quartier (étages ajoutés ou retirés, publication)
- Planche d'échelle des premiers éléments (1 pixel = 5 cm)
