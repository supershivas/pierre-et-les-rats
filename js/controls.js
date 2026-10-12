/* Les commandes de la vue 3D, au pouce ou à la souris, partagées par le jeu et
   le Labo :
   - un doigt ou le bouton gauche : Pierre marche vers le point touché (et le
     suit si on glisse) ;
   - le bouton droit ou du milieu qui glisse : la vue tourne (et s'incline) ;
   - deux doigts : la vue tourne, et pincer zoome ;
   - la molette zoome. */
export function attachPointer(canvas, game, { active = () => true } = {}) {
  const pointers = new Map();
  let walkPointer = null, pinch = null;
  const spread = () => { const [a, b] = [...pointers.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
  const aim = e => {
    const r = canvas.getBoundingClientRect();
    game.input.target = game.screenToWorld(e.clientX - r.left, e.clientY - r.top);
  };
  const down = e => {
    if (!active()) return;
    canvas.setPointerCapture(e.pointerId);
    // la souris n'a qu'un pointeur : un clic droit dont le relâchement s'est perdu ne doit pas
    // faire croire à deux doigts (la vue tournerait au lieu de diriger Pierre)
    if (e.pointerType === 'mouse') for (const id of [...pointers.keys()]) if (pointers.get(id).mouse) pointers.delete(id);
    if (e.pointerType === 'mouse') { walkPointer = null; pinch = null; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, orbit: e.button === 2 || e.button === 1, mouse: e.pointerType === 'mouse' });
    if (pointers.size >= 2 && game.canRotate) {
      walkPointer = null; game.input.hold = false; game.input.target = null;
      pinch = spread();
    } else if (!pointers.get(e.pointerId).orbit) {
      walkPointer = e.pointerId;
      aim(e);
      game.input.hold = true;
    }
  };
  const move = e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.mouse && e.buttons === 0) { pointers.delete(e.pointerId); if (e.pointerId === walkPointer) { walkPointer = null; game.input.hold = false; } return; }
    if (pointers.size >= 2 && pinch) {
      const now = spread();
      game.orbit?.((now.cx - pinch.cx) * 0.008, (now.cy - pinch.cy) * 0.004);
      game.zoomBy?.(now.d / pinch.d);
      pinch = now;
    } else if (p.orbit) game.orbit?.(dx * 0.008, dy * 0.005);
    else if (e.pointerId === walkPointer) aim(e);
  };
  const up = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.pointerId === walkPointer) { walkPointer = null; game.input.hold = false; }
  };
  const wheel = e => { if (active() && game.zoomBy) { e.preventDefault(); game.zoomBy(Math.exp(-e.deltaY * 0.0015)); } };
  const menu = e => e.preventDefault();
  const lost = e => up(e);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', lost);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', menu);
  return () => {
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', menu);
  };
}

// Le clavier du Labo (le jeu a le sien, avec la flûte) : ZQSD ou WASD, J et L pour tourner la vue
export function attachKeys(game) {
  const codes = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyZ: 'up', KeyQ: 'left' };
  const handler = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const down = e.type === 'keydown';
    if (codes[e.code]) { game.input[codes[e.code]] = down ? 1 : 0; e.preventDefault(); }
    else if (e.code === 'KeyJ') { game.input.rotate = down ? 1 : 0; e.preventDefault(); }
    else if (e.code === 'KeyL') { game.input.rotate = down ? -1 : 0; e.preventDefault(); }
  };
  addEventListener('keydown', handler); addEventListener('keyup', handler);
  return () => { removeEventListener('keydown', handler); removeEventListener('keyup', handler); };
}
