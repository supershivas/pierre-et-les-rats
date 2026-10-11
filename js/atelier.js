/* L'atelier : bâtir le quartier sur la grille isométrique. Chaque geste est
   enregistré tout de suite dans ce navigateur (le brouillon, que le jeu lit
   et signale), puis publié d'un geste dans le dépôt (data/ville.json, un
   commit sur main par l'API de GitHub, avec un jeton gardé ici). */
import { makeCity, cityToData, generateQuarter } from './city.js?v=1.0.1';
import { loadPublished, readDraft, writeDraft, sameCity, formatCity } from './city-store.js?v=1.0.1';
import { makeScene } from './scene.js?v=1.0.1';
import { CELL, ROOF } from './scale.js?v=1.0.1';
import { PAL } from './palette.js?v=1.0.1';
import { keyIs, stopTypeahead } from './keys.js?v=1.0.1';
import { drawPierre } from './sprites.js?v=1.0.1';

const REPO = 'supershivas/pierre-et-les-rats', BRANCH = 'main', PATH = 'data/ville.json';
const TOKEN_KEY = 'pierre:gh-token';
const $ = id => document.getElementById(id);
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t.trim()) : localStorage.removeItem(TOKEN_KEY); } catch { /* bloqué */ } };

let toastTimer = 0;
function toast(text, ms = 3500) {
  const el = $('toast'); el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

let published = await loadPublished();
let city, scene;
function useData(data) {
  city = makeCity(data);
  scene = makeScene(city);
}
useData(readDraft() || published);

const canvas = $('view'), ctx = canvas.getContext('2d');
let factor = 2, vw = 300, vh = 200, dirty = true;
let cam = { x: 0, y: 0 };
let tool = 'build', hover = null;
const history = [];

function centerOn(i, j) {
  const sx = (i - j) * CELL, sy = (i + j + 1) * CELL / 2;
  cam = { x: sx - vw / 2, y: sy - vh / 2 - 60 };
}

function resize() {
  const dpr = window.devicePixelRatio || 1, host = canvas.parentElement;
  const dw = host.clientWidth * dpr, dh = host.clientHeight * dpr;
  const cx = cam.x + vw / 2, cy = cam.y + vh / 2;
  vw = Math.ceil(dw / factor); vh = Math.ceil(dh / factor);
  canvas.width = vw; canvas.height = vh;
  canvas.style.width = (vw * factor / dpr) + 'px';
  canvas.style.height = (vh * factor / dpr) + 'px';
  ctx.imageSmoothingEnabled = false;
  cam = { x: cx - vw / 2, y: cy - vh / 2 };
  dirty = true;
}
function autoFactor() {
  const dpr = window.devicePixelRatio || 1;
  factor = Math.max(1, Math.round(dpr * 0.75));
}
autoFactor();
resize();
centerOn(city.w / 2, city.h / 2);

// ─── Dessin ───
function render() {
  ctx.fillStyle = PAL.nuit;
  ctx.fillRect(0, 0, vw, vh);
  const [si, sj] = city.start;
  const sprites = [{ wx: (si + 0.5) * CELL, wy: (sj + 0.5) * CELL, draw: (g, x, y) => drawPierre(g, x, y, {}) }];
  scene.draw(ctx, Math.round(cam.x), Math.round(cam.y), vw, vh, sprites);
  if (hover) outline(hover);
}
// Le contour de la case visée (au sol, ou au sommet de la colonne)
function outline([i, j]) {
  const n = Math.max(0, city.at(i, j));
  const [fx, fy] = scene.front(i, j);
  const z = n * 60 + (n ? ROOF : 0);
  const x = Math.round(fx - cam.x), y = Math.round(fy - cam.y - z);
  ctx.fillStyle = tool === 'raze' ? PAL.rouge : PAL.ocre;
  for (let u = 0; u <= CELL; u++) {
    const d = Math.floor(u / 2);
    for (const [px, py] of [[x - CELL + u, y - CELL / 2 + d], [x + u, y - d], [x - CELL + u, y - CELL / 2 - d], [x + u, y - CELL + d]]) {
      if (u % 2 === 0 || tool !== 'raze') ctx.fillRect(px, py, 1, 1);
    }
  }
}
(function loop() { if (dirty) { dirty = false; render(); } requestAnimationFrame(loop); })();

// ─── Viser une case : la colonne la plus proche de nous qui couvre le point ───
function pick(px, py) {
  const dpr = window.devicePixelRatio || 1;
  const sx = px * dpr / factor + cam.x, sy = py * dpr / factor + cam.y;
  let best = null;
  for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
    const n = city.at(i, j);
    if (n <= 0) continue;
    const [fx, fy] = scene.front(i, j);
    const x = sx - fx, y = sy - fy, ax = Math.abs(x);
    if (ax > CELL || y > -ax / 2 || y < -CELL + ax / 2 - n * 60 - ROOF) continue;
    if (!best || i + j > best[0] + best[1]) best = [i, j];
  }
  if (best) return best;
  const [wx, wy] = scene.toWorld(sx, sy);
  const i = Math.floor(wx / CELL), j = Math.floor(wy / CELL);
  return i >= 0 && j >= 0 && i < city.w && j < city.h ? [i, j] : null;
}

// ─── Modifier ───
function apply([i, j]) {
  const n = city.at(i, j);
  if (tool === 'start') {
    if (n !== 0) { toast('Pierre doit partir d\'une rue.'); return; }
    history.push({ start: [...city.start] });
    city.start = [i, j];
  } else {
    const next = tool === 'build' ? n + 1 : n - 1;
    if (next < 0 || next > 6 || next === n) return;
    if (next > 0 && city.start[0] === i && city.start[1] === j) { toast('Le point de départ de Pierre doit rester dans la rue.'); return; }
    history.push({ i, j, n });
    city.set(i, j, next);
    scene.invalidate(i, j);
  }
  saveDraft();
}
function undo() {
  const h = history.pop();
  if (!h) return;
  if (h.start) city.start = h.start;
  else { city.set(h.i, h.j, h.n); scene.invalidate(h.i, h.j); }
  saveDraft();
}
function saveDraft() {
  const data = cityToData(city);
  writeDraft(sameCity(data, published) ? null : data);
  refreshPending();
  dirty = true;
}
function refreshPending() {
  const data = cityToData(city);
  let n = 0;
  if (data.w === published.w && data.h === published.h) {
    const a = data.rows.join(''), b = published.rows.join('');
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) n++;
  } else n = data.w * data.h;
  const startMoved = String(data.start) !== String(published.start);
  const total = n + (startMoved ? 1 : 0);
  const el = $('pending');
  el.textContent = total ? `${total} à publier` : 'Rien à publier';
  el.classList.toggle('some', !!total);
  $('publish').disabled = !total;
}
refreshPending();

// ─── Pointeur : clic = outil, glisser = se déplacer ───
let drag = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, cam: { ...cam }, moved: false };
});
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved) {
      const k = (window.devicePixelRatio || 1) / factor;
      cam = { x: drag.cam.x - dx * k, y: drag.cam.y - dy * k };
      dirty = true;
      return;
    }
  }
  if (e.pointerType === 'mouse') {
    const h = pick(e.clientX - r.left, e.clientY - r.top);
    if (String(h) !== String(hover)) { hover = h; dirty = true; }
  }
});
canvas.addEventListener('pointerup', e => {
  if (drag && !drag.moved) {
    const r = canvas.getBoundingClientRect();
    const h = pick(e.clientX - r.left, e.clientY - r.top);
    if (h) apply(h);
    if (e.pointerType === 'mouse') { hover = pick(e.clientX - r.left, e.clientY - r.top); dirty = true; }
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; dirty = true; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam = { x: cam.x + e.deltaX / factor, y: cam.y + e.deltaY / factor };
  dirty = true;
}, { passive: false });
addEventListener('resize', resize);

// ─── Outils ───
function setTool(t) {
  tool = t;
  for (const b of document.querySelectorAll('[data-tool]')) {
    const on = b.dataset.tool === t;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  }
  dirty = true;
}
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
$('undo').addEventListener('click', undo);
$('zoom-in').addEventListener('click', () => { factor = Math.min(8, factor + 1); resize(); });
$('zoom-out').addEventListener('click', () => { factor = Math.max(1, factor - 1); resize(); });
function confirmTwice(btn, label, action) {
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      const span = btn.querySelector('span'); const old = span.textContent;
      span.textContent = label;
      setTimeout(() => { btn.classList.remove('confirm'); span.textContent = old; }, 3000);
      return;
    }
    btn.classList.remove('confirm');
    action();
  });
}
confirmTwice($('regen'), 'Sûr ? Tout sera remplacé', () => {
  const seed = 1 + Math.floor(Math.random() * 99999);
  useData(generateQuarter(seed, city.w, city.h));
  history.length = 0;
  saveDraft();
  toast(`Nouveau quartier (graine ${seed}).`);
});
confirmTwice($('revert'), 'Sûr ? Le brouillon sera perdu', () => {
  useData(published);
  history.length = 0;
  writeDraft(null);
  refreshPending();
  dirty = true;
  toast('Retour au quartier publié.');
});

stopTypeahead();
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select, dialog') || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (keyIs(e, 'b')) setTool('build');
  else if (keyIs(e, 'd')) setTool('raze');
  else if (keyIs(e, 'p')) setTool('start');
  else if (keyIs(e, 'u')) undo();
  const step = 40;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.code]) { cam = { x: cam.x + moves[e.code][0], y: cam.y + moves[e.code][1] }; dirty = true; e.preventDefault(); }
});

// ─── Jeton et publication ───
const tokenDialog = $('token-dialog');
$('token').addEventListener('click', () => { $('token-input').value = getToken(); tokenDialog.showModal(); });
tokenDialog.querySelector('[data-close]').addEventListener('click', () => tokenDialog.close());
tokenDialog.addEventListener('click', e => { if (e.target === tokenDialog) tokenDialog.close(); });
$('token-save').addEventListener('click', () => { setToken($('token-input').value); tokenDialog.close(); toast(getToken() ? 'Jeton enregistré dans ce navigateur.' : 'Pas de jeton.'); });
$('token-clear').addEventListener('click', () => { setToken(''); $('token-input').value = ''; tokenDialog.close(); toast('Jeton oublié.'); });

async function gh(token, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) throw new Error('Jeton refusé par GitHub : il est faux ou expiré.');
  if (res.status === 403 || (res.status === 404 && init.method)) throw new Error(`GitHub refuse l'écriture : le jeton doit avoir « Contents : Read and write » sur ${REPO}.`);
  if (res.status === 409) throw new Error('Le dépôt a changé pendant la publication : réessayez.');
  if (!res.ok && res.status !== 404) throw new Error(`GitHub a répondu ${res.status}.`);
  return res.status === 404 ? null : res.json();
}
const toBase64 = text => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

$('publish').addEventListener('click', async () => {
  const token = getToken();
  if (!token) { $('token').click(); return; }
  const btn = $('publish');
  btn.disabled = true;
  $('pending').textContent = 'Publication…';
  try {
    const data = cityToData(city);
    const current = await gh(token, `/contents/${PATH}?ref=${BRANCH}`);
    await gh(token, `/contents/${PATH}`, {
      method: 'PUT',
      body: { message: 'Publie le quartier depuis l\'atelier', content: toBase64(formatCity(data)), branch: BRANCH, ...(current ? { sha: current.sha } : {}) },
    });
    published = data;
    writeDraft(null);
    toast('Publié. Le jeu montrera ce quartier d\'ici une à deux minutes.', 5000);
  } catch (err) {
    toast(err.message, 6000);
  }
  refreshPending();
});
