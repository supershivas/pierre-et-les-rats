/* L'atelier : bâtir le quartier sur la grille isométrique. Chaque geste est
   enregistré tout de suite dans ce navigateur (le brouillon, que le jeu lit
   et signale), puis publié d'un geste dans le dépôt (data/ville.json, un
   commit sur main par l'API de GitHub, avec un jeton gardé ici). */
import { makeCity, cityToData, generateQuarter } from './city.js?v=2.3.0';
import { loadPublished, readDraft, writeDraft, sameCity, formatCity } from './city-store.js?v=2.3.0';
import { makeScene } from './scene.js?v=2.3.0';
import { CELL, ROOF, MAX_FLOORS } from './scale.js?v=2.3.0';
import { PROP_TYPES, propSprite } from './props.js?v=2.3.0';
import { PAL } from './palette.js?v=2.3.0';
import { keyIs, stopTypeahead } from './keys.js?v=2.3.0';
import { drawPierre } from './sprites.js?v=2.3.0';

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
let tool = 'build', hover = null, propKind = 'lamp', terrainKind = 'water';
// La vue : en perspective (iso) ou de dessus (plan : une case = planS px CSS)
let mode = 'iso', planS = 30, planCam = { x: 20, y: 20 };
const TERRAIN = {
  water: { label: 'Seine', icon: 'ti-ripple', about: 'L\'eau (un second clic rend la rue)' },
  bridge: { label: 'Pont', icon: 'ti-building-bridge-2', about: 'Un pont sur la Seine' },
  passage: { label: 'Passage', icon: 'ti-building-arch', about: 'Un passage sous un immeuble' },
  boulevard: { label: 'Avenue', icon: 'ti-road', about: 'Une avenue ou un quai : trottoirs plantés d\'arbres, de réverbères, de bancs (un second clic rend la rue)' },
  cathedral: { label: 'Notre-Dame', icon: 'ti-building-church', about: 'Notre-Dame : toutes les cases N forment un seul bloc, tourné vers le côté des cases les plus hautes ; il remplace ce qui est là' },
};
const history = [];

function centerOn(i, j) {
  const sx = (i - j) * CELL, sy = (i + j + 1) * CELL / 2;
  cam = { x: sx - vw / 2, y: sy - vh / 2 - 60 };
}

function resize() {
  const dpr = window.devicePixelRatio || 1, host = canvas.parentElement;
  const dw = host.clientWidth * dpr, dh = host.clientHeight * dpr;
  if (mode === 'plan') {
    canvas.width = dw; canvas.height = dh;
    canvas.style.width = host.clientWidth + 'px'; canvas.style.height = host.clientHeight + 'px';
    dirty = true;
    return;
  }
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
// ─── La vue de dessus : chaque case, sa hauteur écrite dessus ───
function renderPlan() {
  const dpr = window.devicePixelRatio || 1, S = planS;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAL.nuit; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.max(9, Math.round(S * 0.42))}px Inter, sans-serif`;
  for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
    const x = planCam.x + i * S, y = planCam.y + j * S, n = city.at(i, j), k = city.kind(i, j);
    let fill;
    // les couleurs du jeu : rue, Seine, pont, vieille maison (claire), immeuble, Notre-Dame
    if (k === '~') fill = PAL.nuit2;
    else if (k === '=') fill = PAL.neigeO;
    else if (n === 0) fill = PAL.neigeM;
    else if (k === 'N') fill = PAL.ardoise;
    else fill = n <= 3 ? PAL.neige : PAL.pierreL;
    ctx.fillStyle = fill; ctx.fillRect(x, y, S - 1, S - 1);
    if (k === '~') { ctx.fillStyle = PAL.neigeO; ctx.fillRect(x + S * 0.2, y + S * 0.45, S * 0.6, 1); }
    if (k === '=') { ctx.fillStyle = PAL.pierreS; ctx.fillRect(x, y + 2, S - 1, 2); ctx.fillRect(x, y + S - 5, S - 1, 2); }
    if (k === 'P') { ctx.strokeStyle = PAL.neige; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 3, y + 3, S - 7, S - 7); ctx.setLineDash([]); }
    if (n > 0) {
      ctx.fillStyle = n <= 3 && k !== 'N' ? PAL.nuit : PAL.ocre;
      ctx.fillText(String(n), x + S / 2, y + S / 2 + 1);
      if (k === 'N') { ctx.fillStyle = PAL.ocre; ctx.fillRect(x + 2, y + 2, S - 5, 2); }   // Notre-Dame : un liseré
    }
  }
  // le mobilier : un point par objet
  for (const [type, px, py] of city.props) {
    const x = planCam.x + px / CELL * S, y = planCam.y + py / CELL * S;
    ctx.fillStyle = type === 'lamp' ? PAL.ocre : type === 'tree' ? PAL.nuit : PAL.pierreS;
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, S * 0.09), 0, Math.PI * 2); ctx.fill();
  }
  // le départ de Pierre
  const [si, sj] = city.start;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || PAL.rouge;
  ctx.beginPath(); ctx.arc(planCam.x + (si + 0.5) * S, planCam.y + (sj + 0.5) * S, S * 0.22, 0, Math.PI * 2); ctx.fill();
  if (hover) { const [i, j] = hover; ctx.strokeStyle = tool === 'raze' ? PAL.nuit : PAL.ocre; ctx.lineWidth = 2; ctx.strokeRect(planCam.x + i * S + 1, planCam.y + j * S + 1, S - 3, S - 3); ctx.lineWidth = 1; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function render() {
  if (mode === 'plan') { renderPlan(); return; }
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
  if (mode === 'plan') {
    const i = Math.floor((px - planCam.x) / planS), j = Math.floor((py - planCam.y) / planS);
    return i >= 0 && j >= 0 && i < city.w && j < city.h ? [i, j] : null;
  }
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
// Écran (pixels CSS dans le canvas) → écran monde
function toScreenWorld(px, py) {
  const dpr = window.devicePixelRatio || 1;
  return [px * dpr / factor + cam.x, py * dpr / factor + cam.y];
}
// L'objet sous le pointeur (le plus en avant), ou -1
function pickProp(sx, sy) {
  let best = -1, bk = -Infinity;
  city.props.forEach(([type, x, y, v], k) => {
    const spr = propSprite(type, v), ox = x - y - spr.ax, oy = (x + y) / 2 - spr.ay;
    if (sx < ox - 2 || sx > ox + spr.c.width + 2 || sy < oy - 2 || sy > oy + spr.c.height + 2) return;
    if (x + y > bk) { bk = x + y; best = k; }
  });
  return best;
}
// Un geste à l'endroit touché : poser ou retirer un objet, sinon agir sur la case
function applyAt(px, py) {
  const [sx, sy] = toScreenWorld(px, py);
  // en plan : le point du sol touché, en monde
  const planWorld = () => [(px - planCam.x) / planS * CELL, (py - planCam.y) / planS * CELL];
  if (tool === 'raze') {
    let k = -1;
    if (mode === 'plan') {
      const [wx, wy] = planWorld();
      city.props.forEach(([, x, y], n) => { if (Math.hypot(x - wx, y - wy) < CELL * 0.18) k = n; });
    } else k = pickProp(sx, sy);
    if (k >= 0) { history.push({ propDel: city.props[k], at: k }); city.props.splice(k, 1); saveDraft(); return; }
  }
  if (tool === 'prop') {
    const [wx, wy] = mode === 'plan' ? planWorld() : scene.toWorld(sx, sy);
    if (!city.isStreet(Math.floor(wx / CELL), Math.floor(wy / CELL)) && city.kind(Math.floor(wx / CELL), Math.floor(wy / CELL)) !== '=') { toast('Le mobilier se pose dans la rue.'); return; }
    const variant = propKind === 'tree' ? Math.floor(Math.random() * 6) : propKind === 'bench' ? Math.floor(Math.random() * 2) : 0;
    city.props.push([propKind, Math.round(wx), Math.round(wy), variant]);
    history.push({ propAdd: true });
    saveDraft();
    return;
  }
  const h = pick(px, py);
  if (h) apply(h);
}

function apply([i, j]) {
  const n = city.at(i, j), k = city.kind(i, j);
  if (tool === 'terrain') {
    let next = null, height = n;
    if (terrainKind === 'water') {
      if (city.start[0] === i && city.start[1] === j) { toast('Pierre ne part pas de l\'eau.'); return; }
      if (k === '~' || k === '=') next = '.'; else { next = '~'; height = 0; }
    } else if (terrainKind === 'bridge') {
      if (k === '~') {
        next = '=';
        // une rue en face de chaque entrée : les maisons au bout du pont sont rasées
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + dx, nj = j + dy, nk = city.kind(ni, nj);
          if (nk !== '~' && nk !== '=' && nk !== 'N' && nk !== '#' && city.at(ni, nj) > 0) { history.push({ i: ni, j: nj, n: city.at(ni, nj), kind: nk }); city.set(ni, nj, 0); if (nk === 'P') city.setKind(ni, nj, '.'); scene.invalidate(ni, nj); }
        }
      } else if (k === '=') next = '~'; else { toast('Un pont se pose sur la Seine.'); return; }
    } else if (terrainKind === 'passage') {
      if (k === 'P') next = '.'; else if (n > 0 && k === '.') next = 'P'; else { toast('Un passage se creuse sous un immeuble.'); return; }
    } else if (terrainKind === 'boulevard') {
      if (k === 'B') next = '.'; else if (k === '.' && n === 0) next = 'B'; else { toast('Une avenue se trace sur une rue (ou un quai).'); return; }
    } else if (terrainKind === 'cathedral') {
      if (k === 'N') next = '.';
      else if (k === '.' || k === 'B' || k === 'P') {
        if (city.start[0] === i && city.start[1] === j) { toast('Pierre ne part pas de la cathédrale.'); return; }
        next = 'N'; height = n > 0 ? n : 5;     // elle remplace ce qui était là (7 étages et plus : une tour)
      } else { toast('Notre-Dame se bâtit sur la terre ferme.'); return; }
    }
    history.push({ i, j, n, kind: k });
    city.setKind(i, j, next); city.set(i, j, height);
    scene.invalidate(i, j);
    saveDraft();
    return;
  }
  if (tool !== 'start' && (k === '~' || k === '=')) { toast('On ne bâtit pas sur la Seine : outil Terrain pour la rendre à la rue.'); return; }
  if (tool === 'build' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => city.kind(i + dx, j + dy) === '=')) { toast('Un pont débouche sur une rue : on n\'y bâtit pas.'); return; }
  if (tool === 'start') {
    if (!city.walk(i, j) || k === 'P') { toast('Pierre doit partir d\'une rue.'); return; }
    history.push({ start: [...city.start] });
    city.start = [i, j];
  } else {
    const next = tool === 'build' ? n + 1 : n - 1;
    if (next < 0 || next > MAX_FLOORS || next === n) return;
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
  if (h.propAdd) city.props.pop();
  else if (h.propDel) city.props.splice(h.at, 0, h.propDel);
  else if (h.start) city.start = h.start;
  else { city.set(h.i, h.j, h.n); if (h.kind) city.setKind(h.i, h.j, h.kind); scene.invalidate(h.i, h.j); }
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
    const ga = (data.ground || []).join(''), gb = (published.ground || []).join('') || '.'.repeat(a.length);
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k] || ga[k] !== gb[k]) n++;
  } else n = data.w * data.h;
  const startMoved = String(data.start) !== String(published.start);
  const mine = new Set((data.props || []).map(p => JSON.stringify(p))), theirs = new Set((published.props || []).map(p => JSON.stringify(p)));
  let props = 0;
  for (const p of mine) if (!theirs.has(p)) props++;
  for (const p of theirs) if (!mine.has(p)) props++;
  const total = n + props + (startMoved ? 1 : 0);
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
  drag = { x: e.clientX, y: e.clientY, cam: { ...cam }, plan: { ...planCam }, moved: false };
});
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved) {
      const k = (window.devicePixelRatio || 1) / factor;
      if (mode === 'plan') planCam = { x: drag.plan.x + dx, y: drag.plan.y + dy };
      else cam = { x: drag.cam.x - dx * k, y: drag.cam.y - dy * k };
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
    applyAt(e.clientX - r.left, e.clientY - r.top);
    if (e.pointerType === 'mouse') { hover = pick(e.clientX - r.left, e.clientY - r.top); dirty = true; }
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; dirty = true; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (mode === 'plan') planCam = { x: planCam.x - e.deltaX, y: planCam.y - e.deltaY };
  else cam = { x: cam.x + e.deltaX / factor, y: cam.y + e.deltaY / factor };
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
  kinds.hidden = t !== 'prop';
  terrainKinds.hidden = t !== 'terrain';
  dirty = true;
}
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
// Les objets qu'on peut poser (outil Mobilier)
const kinds = $('prop-kinds');
for (const [k, t] of Object.entries(PROP_TYPES)) {
  const b = document.createElement('button');
  b.className = 'tool' + (k === propKind ? ' on' : '');
  b.type = 'button'; b.dataset.prop = k; b.title = t.label;
  b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === propKind)); b.setAttribute('aria-label', t.label);
  b.innerHTML = `<i class="ti ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>`;
  b.addEventListener('click', () => {
    propKind = k;
    for (const o of kinds.children) { const on = o.dataset.prop === k; o.classList.toggle('on', on); o.setAttribute('aria-checked', String(on)); }
  });
  kinds.append(b);
}
// Les terrains (outil Terrain)
const terrainKinds = $('terrain-kinds');
for (const [k, t] of Object.entries(TERRAIN)) {
  const b = document.createElement('button');
  b.className = 'tool' + (k === terrainKind ? ' on' : '');
  b.type = 'button'; b.dataset.terrain = k; b.title = t.about;
  b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === terrainKind)); b.setAttribute('aria-label', t.label);
  b.innerHTML = `<i class="ti ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>`;
  b.addEventListener('click', () => {
    terrainKind = k;
    for (const o of terrainKinds.children) { const on = o.dataset.terrain === k; o.classList.toggle('on', on); o.setAttribute('aria-checked', String(on)); }
  });
  terrainKinds.append(b);
}
// La vue de dessus, pour atteindre les maisons cachées derrière les autres
function setMode(m) {
  mode = m;
  const b = $('view-mode');
  b.querySelector('span').textContent = m === 'plan' ? 'Perspective' : 'Plan';
  b.querySelector('i').className = `ti ${m === 'plan' ? 'ti-box' : 'ti-layout-grid'}`;
  b.title = m === 'plan' ? 'Revenir à la perspective (V)' : 'Passer à la vue de dessus (V)';
  b.setAttribute('aria-label', m === 'plan' ? 'Perspective' : 'Vue de dessus');
  b.classList.toggle('on', m === 'plan');
  canvas.classList.toggle('plan', m === 'plan');
  if (m === 'plan') {
    const host = canvas.parentElement;
    planS = Math.max(16, Math.min(40, Math.floor(Math.min(host.clientWidth / city.w, host.clientHeight / city.h))));
    planCam = { x: Math.round((host.clientWidth - planS * city.w) / 2), y: Math.round((host.clientHeight - planS * city.h) / 2) };
  } else ctx.setTransform(1, 0, 0, 1, 0, 0);
  hover = null;
  resize();
}
$('view-mode').addEventListener('click', () => setMode(mode === 'plan' ? 'iso' : 'plan'));
$('undo').addEventListener('click', undo);
$('zoom-in').addEventListener('click', () => { if (mode === 'plan') { planS = Math.min(80, planS + 6); dirty = true; } else { factor = Math.min(8, factor + 1); resize(); } });
$('zoom-out').addEventListener('click', () => { if (mode === 'plan') { planS = Math.max(10, planS - 6); dirty = true; } else { factor = Math.max(1, factor - 1); resize(); } });
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
  else if (keyIs(e, 'm')) setTool('prop');
  else if (keyIs(e, 't')) setTool('terrain');
  else if (keyIs(e, 'v')) setMode(mode === 'plan' ? 'iso' : 'plan');
  else if (keyIs(e, 'u')) undo();
  const step = 40;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.code]) {
    if (mode === 'plan') planCam = { x: planCam.x - moves[e.code][0], y: planCam.y - moves[e.code][1] };
    else cam = { x: cam.x + moves[e.code][0], y: cam.y + moves[e.code][1] };
    dirty = true; e.preventDefault();
  }
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
