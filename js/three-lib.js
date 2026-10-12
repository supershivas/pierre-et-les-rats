/* three.js 0.170.0, copié dans vendor/ (le jeu ne dépend d'aucun CDN) et
   chargé à la demande. Les couleurs sont passées telles quelles : la gestion
   des couleurs de three.js est coupée et la sortie est linéaire, pour que ce
   qui s'affiche soit exactement la palette du jeu (palette.js). */
let promise = null;
export function loadThree() {
  if (!promise) {
    promise = import('../vendor/three.module.min.js?v=170').then(THREE => {
      THREE.ColorManagement.enabled = false;
      return THREE;
    });
  }
  return promise;
}
