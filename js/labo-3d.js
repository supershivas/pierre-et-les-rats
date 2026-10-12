/* Les moteurs, en direct dans le Labo : le jeu 3D d'aujourd'hui (three.js,
   caméra libre, depuis la v2.0.0) et l'ancien moteur 2D isométrique, avec le
   même quartier et la même nuée. Rien n'est lu ni écrit dans le navigateur. */
import { makeCity } from './city.js?v=2.0.1';
import { loadPublished } from './city-store.js?v=2.0.1';
import { attachPointer, attachKeys } from './controls.js?v=2.0.1';

/* Le jeu 3D : ZQSD (ou WASD) pour marcher, ou toucher le sol ; J et L, deux doigts
   ou le bouton droit pour tourner la vue ; la molette zoome. */
export async function mount3D(host, { rats = 300, onStats = () => {} } = {}) {
  const { createGame3D } = await import('./game3d.js?v=2.0.1');
  const city = makeCity(await loadPublished());
  const canvas = document.createElement('canvas');
  canvas.className = 'game';
  canvas.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;touch-action:none';
  host.style.position = 'relative';
  host.append(canvas);
  const game = await createGame3D({ canvas, city, testRats: rats });
  game.resume();
  const ro = new ResizeObserver(() => game.resize()); ro.observe(host);
  const detach = [attachPointer(canvas, game), attachKeys(game)];
  const timer = setInterval(() => { const st = game.stats; onStats({ fps: Math.round(1000 / Math.max(1, st.ms.update + st.ms.render)), rats: st.simulated, sim: st.ms.update, draw: st.ms.render }); }, 1000);
  return { dispose() { clearInterval(timer); detach.forEach(f => f()); ro.disconnect(); game.destroy(); canvas.remove(); }, game };
}

/* L'ancien moteur : le canvas 2D isométrique */
export async function mount2D(host, { rats = 300 } = {}) {
  const { createGame } = await import('./game.js?v=2.0.1');
  const city = makeCity(await loadPublished());
  const canvas = document.createElement('canvas');
  canvas.className = 'game';
  canvas.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated';
  host.style.position = 'relative';
  host.append(canvas);
  const game = createGame({ canvas, city, testRats: rats });
  game.setAttract(false);
  game.resume();
  const ro = new ResizeObserver(() => game.resize()); ro.observe(host);
  // ZQSD / WASD, ou toucher le sol
  const codes = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  const onKey = e => { if (codes[e.code]) { game.input[codes[e.code]] = e.type === 'keydown' ? 1 : 0; e.preventDefault(); } };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    game.input.target = game.screenToWorld(e.clientX - r.left, e.clientY - r.top);
  });
  return { dispose() { game.destroy(); ro.disconnect(); removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); canvas.remove(); }, game };
}
