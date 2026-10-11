/* La palette du jeu : la nuit d'hiver 1815, bleu nuit, blanc et noir.
   Les noms des clés viennent de la première palette (pierre, ocre…) et sont
   gardés pour ne pas toucher aux dessins. Restreinte et déclarée dans
   CLAUDE.md ; le canvas, le HUD (css/style.css, variables --g-*) et les
   commandes n'utilisent que ces couleurs. L'en-tête, les réglages et les
   modales gardent les tokens du design system. */
export const PAL = {
  nuit:    '#05070c', // le noir : vitres, portes, contours, le fond
  nuit2:   '#0d1426', // bleu nuit profond : ombres, manteau de Pierre
  ardoise: '#16203a', // toits d'ardoise
  neigeO:  '#2a3658', // neige dans l'ombre, traces de rats
  neigeM:  '#4f5f88', // la neige des rues, la nuit
  neige:   '#dfe6f1', // neige au clair de lune, sur les toits
  pierreS: '#0d1426', // murs : détails sombres
  pierre:  '#18223d', // murs : face à l'ombre
  pierreL: '#25314f', // murs : face éclairée par la lune
  brun:    '#05070c', // les rats, le bonnet de Pierre
  brunC:   '#25314f', // le dos des rats
  rose:    '#0d1426', // queues des rats
  peau:    '#dfe6f1', // le visage de Pierre
  rougeS:  '#05070c', // manteau de Pierre, ombre
  rouge:   '#0d1426', // manteau de Pierre
  ocreS:   '#dfe6f1', // la flûte
  ocre:    '#f4f7fb', // le blanc : fenêtres éclairées, notes
};

// Couleur en [r, g, b] (pour écrire dans un ImageData)
export const RGB = Object.fromEntries(Object.entries(PAL).map(([k, h]) => [k, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]));
