/* L'échelle du jeu : 1 pixel = 5 cm. Tout le monde (jeu, atelier, planche
   d'échelle) lit ces nombres ; la planche (echelle.html) les montre côte à côte. */
export const CM_PER_PX = 5;

export const CELL = 60;       // un module d'immeuble : 3 m de côté
export const FLOOR = 60;      // un étage : 3 m
export const ROOF = 34;       // hauteur du toit au faîtage : 1,70 m
export const MAX_FLOORS = 6;  // rez-de-chaussée compris

export const PIERRE = { w: 13, h: 26 };   // un enfant de 1,30 m
export const RAT = { w: 10, h: 4 };        // 25 cm de corps et tête, 25 cm de queue
export const NOTE = { w: 4, h: 6 };
export const WINDOW = { w: 18, h: 30 };    // 0,90 × 1,50 m
export const DOOR = { w: 20, h: 44 };      // 1 × 2,20 m

export const toMeters = px => (px * CM_PER_PX / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
