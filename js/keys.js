/* Le clavier (convention du design system) : les déplacements par la touche
   physique (`e.code` : ZQSD en AZERTY, WASD en QWERTY, flèches) ; une
   commande par sa lettre (`e.key`), repli sur la touche physique quand la
   lettre n'est pas latine. Jamais de Ctrl, Cmd ni Alt. */
export const keyIs = (e, letter) => !e.ctrlKey && !e.metaKey && !e.altKey
  && (/^[a-z]$/i.test(e.key) ? e.key.toLowerCase() === letter : e.code === `Key${letter.toUpperCase()}`);

export const MOVE = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

// Firefox cherche dans la page dès qu'on tape une lettre : hors des champs de
// saisie, une touche imprimable ne va pas au navigateur
export function stopTypeahead(target = window) {
  target.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable]')) return;
    if ((e.key === ' ' || e.key === 'Enter') && t.closest?.('button, a, summary')) return;
    e.preventDefault();
  });
}
