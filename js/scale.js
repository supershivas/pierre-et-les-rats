/* L'échelle du jeu : 1 pixel = 5 cm. Tout le monde (jeu, atelier, planche
   d'échelle) lit ces nombres ; la planche (echelle.html) les montre côte à côte. */
export const CM_PER_PX = 5;

export const CELL = 60;       // un module d'immeuble : 3 m de côté
export const FLOOR = 60;      // un étage : 3 m
export const ROOF = 34;       // hauteur du toit au faîtage : 1,70 m
export const MAX_FLOORS = 8;  // rez-de-chaussée compris (Haussmann : RDC + 5 ou 6 ; les tours de Notre-Dame : 8)

export const PIERRE = { w: 13, h: 26 };   // un enfant de 1,30 m
export const RAT = { w: 10, h: 4 };        // 25 cm de corps et tête, 25 cm de queue
export const NOTE = { w: 4, h: 6 };
export const WINDOW = { w: 12, h: 40 };    // porte-fenêtre : 0,60 × 2 m
export const DOOR = { w: 28, h: 48 };      // arcade du rez-de-chaussée : 1,40 × 2,40 m

export const toMeters = px => (px * CM_PER_PX / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
