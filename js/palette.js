/* La palette du jeu : hiver parisien 1815. Restreinte et déclarée dans
   CLAUDE.md ; le canvas, le HUD (css/style.css, variables --g-*) et les
   commandes n'utilisent que ces couleurs. L'en-tête, les réglages et les
   modales gardent les tokens du design system. */
export const PAL = {
  nuit:    '#1f2a44', // bleu nuit : vitres, fond, contours
  nuit2:   '#34405e', // ardoise d'ombre, pantalon
  ardoise: '#56627e', // toits
  neigeO:  '#9aabc4', // neige dans l'ombre, traces de Pierre
  neigeM:  '#cdd8e6', // neige mi-teinte, traces de rats
  neige:   '#eef3f8', // neige au clair
  pierreS: '#6f665a', // pierre de Paris, détails sombres
  pierre:  '#9d917c', // pierre de Paris, face à l'ombre
  pierreL: '#c9bda5', // pierre de Paris, face éclairée
  brun:    '#4e3a2e', // bois des portes, rats
  brunC:   '#7a5c45', // rats, au clair
  rose:    '#c98d84', // queues et oreilles des rats
  peau:    '#e0b494', // visage de Pierre
  rougeS:  '#7e2620', // manteau de Pierre, ombre
  rouge:   '#b5382c', // manteau de Pierre
  ocreS:   '#b9782f', // flûte, écharpe
  ocre:    '#e6b35a', // fenêtres éclairées, notes de musique
};

// Couleur en [r, g, b] (pour écrire dans un ImageData)
export const RGB = Object.fromEntries(Object.entries(PAL).map(([k, h]) => [k, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]));
