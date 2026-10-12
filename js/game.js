/* Le jeu : Pierre marche dans les rues enneigées, joue de la flûte, et les
   rats sortent des bouches d'égout pour le rejoindre. Plus il joue, plus
   l'armée grossit ; elle le suit partout, en laissant de légères traces.

   Coordonnées monde en pixels du jeu (1 px = 5 cm, une case = 60 px). La
   vue est rendue en pixels du jeu dans un petit canvas, agrandi d'un
   facteur entier (pixels nets). */
import { PAL } from './palette.js?v=2.3.0';
import { CELL } from './scale.js?v=2.3.0';
import { makeScene } from './scene.js?v=2.3.0';
import { drawPierre, drawNote } from './sprites.js?v=2.3.0';
import { createSwarm } from './swarm.js?v=2.3.0';
import { PROP_TYPES, propSprite } from './props.js?v=2.3.0';
import { hash } from './city.js?v=2.3.0';

const WALK = 34, RUN = 64;            // px/s : 1,7 m/s et 3,2 m/s
const PIERRE_R = 5;
const MAX_RATS = 4000;                // au-delà, l'armée est comptée mais pas toute simulée
const TRACE_LIFE = 150;               // s : la neige recouvre les traces
const TRACE_CAP = 60000;              // traces gardées au plus (tampon circulaire)
// Hauteur de la vue, en pixels du jeu : le monde à hauteur d'enfant, toujours
// de près (environ 12 m de haut), quelle que soit la taille de l'armée
const VIEW_H = 250;

export function createGame({ canvas, city, save = null, onRats = () => {}, onMessage = () => {}, testRats = 0 }) {
  const scene = makeScene(city, { night: true });
  const occlusion = scene.depthMap();
  scene.buildDecor();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let vw = 320, vh = 240, factor = 3, zoomPref = 0;

  // ─── État ───
  const start = save && Number.isFinite(save.x) ? [save.x, save.y] : [(city.start[0] + 0.5) * CELL, (city.start[1] + 0.5) * CELL];
  const pierre = { x: start[0], y: start[1], dir: save?.dir || 1, moving: false, running: false, t: 0, stride: 0, foot: 0 };
  if (solid(pierre.x, pierre.y)) Object.assign(pierre, nearestStreet(pierre.x, pierre.y));
  let army = save?.rats || 0;            // le nombre de rats qui suivent Pierre
  const notes = [], smoke = [], flakes = [];
  let playing = false, playTime = save?.playSeconds || 0, callTimer = 1.2;
  let cam = { x: pierre.x - pierre.y, y: (pierre.x + pierre.y) / 2 };
  let time = 0, paused = true, attract = false, attractT = 0;
  const input = { up: 0, down: 0, left: 0, right: 0, run: false, target: null };

  // ─── Le sol et les obstacles ───
  function solid(wx, wy) {
    return !city.walk(Math.floor(wx / CELL), Math.floor(wy / CELL));
  }
  function blocked(x, y, r) {
    if (solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r)) return true;
    // le mobilier : un petit disque au pied de chaque objet
    for (const [type, px, py] of city.props) {
      const rr = PROP_TYPES[type].r + r, dx = x - px, dy = y - py;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }
  function nearestStreet(wx, wy) {
    let best = null, bd = Infinity;
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      if (!city.walk(i, j)) continue;
      const d = ((i + 0.5) * CELL - wx) ** 2 + ((j + 0.5) * CELL - wy) ** 2;
      if (d < bd) { bd = d; best = { x: (i + 0.5) * CELL, y: (j + 0.5) * CELL }; }
    }
    return best || { x: wx, y: wy };
  }
  // Avance en glissant le long des murs
  function move(o, dx, dy, r) {
    if (!blocked(o.x + dx, o.y, r)) o.x += dx;
    if (!blocked(o.x, o.y + dy, r)) o.y += dy;
  }

  // ─── La nuée ───
  const swarm = createSwarm({ city, capacity: MAX_RATS, onTrace: (wx, wy) => trace(wx, wy, 'neigeO') });
  // Les bouches d'égout entre 2 et 9 cases de Pierre (à vol d'oiseau, en cases)
  function spawnFromSewer() {
    const pi = Math.floor(pierre.x / CELL), pj = Math.floor(pierre.y / CELL);
    const near = city.grates.filter(([i, j]) => { const d = Math.abs(i - pi) + Math.abs(j - pj); return d >= 2 && d <= 9; });
    let x, y;
    if (near.length) {
      const [i, j] = near[Math.floor(Math.random() * near.length)];
      x = (i + 0.5) * CELL; y = (j + 0.5) * CELL;
    } else {
      const a = Math.random() * Math.PI * 2;
      const p = nearestStreet(pierre.x + Math.cos(a) * 240, pierre.y + Math.sin(a) * 240);
      x = p.x; y = p.y;
    }
    // ils sortent par petits groupes, de plus en plus gros avec l'armée
    const burst = Math.min(14, 1 + Math.floor(army / 40) + (Math.random() < 0.3 ? 1 : 0));
    for (let k = 0; k < burst; k++) {
      army++;
      swarm.add(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6);
      if ([1, 5, 10, 25, 50, 100, 200, 500, 1000, 2000].includes(army)) onMessage(milestone(army));
    }
    onRats(army);
  }
  function milestone(n) {
    return {
      1: 'Un premier rat sort de l\'égout.',
      5: 'Cinq rats. Ils ont froid, eux aussi.',
      10: 'Dix rats suivent Pierre.',
      25: 'Vingt-cinq. Les affamés les regardent passer.',
      50: 'Cinquante rats : une petite armée.',
      100: 'Cent rats. Paris commence à parler de Pierre.',
      200: 'Deux cents rats dans la neige.',
      500: 'Cinq cents. La nuit leur appartient.',
      1000: 'Mille rats. Plus que toute la Garde nationale.',
      2000: 'Deux mille. La neige est noire de rats.',
    }[n];
  }
  // Au chargement : l'armée revient autour de Pierre (et ?rats=N pour éprouver la nuée)
  if (testRats > army) army = testRats;
  for (let k = 0; k < Math.min(army, MAX_RATS); k++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.sqrt(k) * 3 * Math.random();
    let px = pierre.x + Math.cos(a) * r, py = pierre.y + Math.sin(a) * r;
    if (blocked(px, py, 2)) { px = pierre.x; py = pierre.y; }
    swarm.add(px, py);
  }

  // ─── Les traces dans la neige (tampon circulaire : pas d'objet par trace) ───
  const trX = new Int32Array(TRACE_CAP), trY = new Int32Array(TRACE_CAP), trT = new Float32Array(TRACE_CAP);
  let trHead = 0, trLen = 0;
  let viewL = 0, viewR = 0, viewT = 0, viewB = 0;
  function trace(wx, wy, key) {
    // seulement ce qu'on voit (les traces hors champ ne coûtent rien)
    const sx = wx - wy, sy = (wx + wy) / 2;
    if (sx < viewL || sx > viewR || sy < viewT || sy > viewB) return;
    const at = scene.ground.colorAt(wx, wy);
    if (!at) return;
    // une trace plus sombre que ce qu'elle foule
    const ink = at === 'neigeM' ? key : at === 'neigeO' ? 'nuit2' : 'nuit';
    const p = scene.ground.stamp(wx, wy, ink);
    if (!p) return;
    if (trLen === TRACE_CAP) { scene.ground.restore(trX[trHead], trY[trHead]); trHead = (trHead + 1) % TRACE_CAP; trLen--; }
    const k = (trHead + trLen) % TRACE_CAP;
    trX[k] = p[0]; trY[k] = p[1]; trT[k] = time; trLen++;
  }
  function fadeTraces() {
    // La neige qui tombe recouvre d'abord les plus vieilles
    let n = 0;
    while (trLen && time - trT[trHead] > TRACE_LIFE * (0.6 + 0.4 * hash(trX[trHead], trY[trHead])) && n++ < 600) {
      scene.ground.restore(trX[trHead], trY[trHead]);
      trHead = (trHead + 1) % TRACE_CAP; trLen--;
    }
  }

  // ─── Pierre ───
  function updatePierre(dt) {
    let mx = input.right - input.left, my = input.down - input.up;
    if (input.target) {
      const [tx, ty] = input.target;
      const sdx = (tx - ty) - (pierre.x - pierre.y), sdy = (tx + ty) / 2 - (pierre.x + pierre.y) / 2;
      const d = Math.hypot(sdx, sdy);
      if (d < 3) { if (!input.hold) input.target = null; mx = my = 0; }
      else { mx = sdx / d; my = sdy / d; }
    }
    // Les touches suivent l'écran : haut = vers le haut de l'écran
    let vx = 0, vy = 0;
    if (mx || my) {
      const l = Math.hypot(mx, my); mx /= l; my /= l;
      // écran (mx, my) → monde : x = my + mx/2, y = my − mx/2 (puis normalisé)
      vx = my + mx / 2; vy = my - mx / 2;
      const n = Math.hypot(vx, vy); vx /= n; vy /= n;
      if (Math.abs(mx) > 0.2) pierre.dir = mx > 0 ? 1 : -1;
    }
    const speed = (input.run ? RUN : WALK) * (playing ? 0.55 : 1);
    pierre.vx = vx; pierre.vy = vy;
    const ox = pierre.x, oy = pierre.y;
    if (vx || vy) move(pierre, vx * speed * dt, vy * speed * dt, PIERRE_R);
    const moved = Math.hypot(pierre.x - ox, pierre.y - oy);
    pierre.moving = moved > 0.01;
    if (pierre.moving) {
      pierre.t += dt * (input.run ? 1.7 : 1);
      pierre.stride += moved;
      if (pierre.stride > 8) {
        pierre.stride = 0; pierre.foot ^= 1;
        const nx = -vy, ny = vx, s = pierre.foot ? 2 : -2;
        trace(pierre.x + nx * s, pierre.y + ny * s, 'nuit2');
        trace(pierre.x + nx * s + vx, pierre.y + ny * s + vy, 'nuit2');
      }
    } else if (input.target && !input.hold) input.target = null;
  }

  // ─── Notes, fumées, neige ───
  function emitNote() {
    const sx = pierre.x - pierre.y + pierre.dir * 10, sy = (pierre.x + pierre.y) / 2 - 22;
    notes.push({ x: sx, y: sy, t: 0, life: 2.2 + Math.random(), kind: Math.random() < 0.3 ? 1 : 0, vx: pierre.dir * (4 + Math.random() * 6), ph: Math.random() * 6 });
  }
  function updateParticles(dt) {
    for (const n of notes) { n.t += dt; n.x += n.vx * dt; n.y -= 14 * dt; }
    while (notes.length && notes[0].t > notes[0].life) notes.shift();
    for (const s of smoke) { s.t += dt; s.x += (6 + s.t * 3) * dt; s.y -= 9 * dt; }
    while (smoke.length && smoke[0].t > smoke[0].life) smoke.shift();
    for (const f of flakes) {
      f.y += f.v * dt; f.x += (Math.sin(time * 0.7 + f.ph) * 4 + 3) * dt * f.z;
      if (f.y > vh) { f.y = -2; f.x = Math.random() * vw; }
      if (f.x > vw) f.x -= vw; else if (f.x < 0) f.x += vw;
    }
  }
  function resetFlakes() {
    flakes.length = 0;
    const n = Math.floor(vw * vh / 700);
    for (let k = 0; k < n; k++) {
      const z = Math.random();
      flakes.push({ x: Math.random() * vw, y: Math.random() * vh, z: 0.4 + z, v: 6 + z * 14, big: z > 0.93, ph: Math.random() * 6 });
    }
  }

  // ─── La boucle ───
  function update(dt) {
    time += dt;
    if (attract) {
      // L'écran d'accueil : la caméra flâne dans le quartier
      attractT += dt;
      const cx = city.w * CELL / 2, cy = city.h * CELL / 2;
      const ax = cx + Math.cos(attractT * 0.03) * CELL * 4, ay = cy + Math.sin(attractT * 0.03) * CELL * 4;
      cam.x = ax - ay - vw / 2; cam.y = (ax + ay) / 2 - vh / 2 - 40;
    } else {
      updatePierre(dt);
      if (playing) {
        playTime += dt;
        callTimer -= dt;
        if (callTimer <= 0) {
          spawnFromSewer();
          callTimer = Math.max(0.35, 1.6 - Math.sqrt(army) * 0.06) * (0.6 + Math.random() * 0.8);
        }
      }
      viewL = cam.x - 10; viewR = cam.x + vw + 10; viewT = cam.y - 10; viewB = cam.y + vh + 10;
      swarm.update(dt, { x: pierre.x, y: pierre.y, vx: pierre.vx || 0, vy: pierre.vy || 0, playing }, time, 300);
      // La caméra suit Pierre, en douceur
      const tx = pierre.x - pierre.y - vw / 2, ty = (pierre.x + pierre.y) / 2 - vh / 2 - 12;
      const k = 1 - Math.exp(-dt * 5);
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    }
    // La fumée des cheminées
    if (Math.random() < dt * 6) {
      const list = scene.chimneys(cam.x, cam.y, vw, vh);
      if (list.length) {
        const [x, y, id] = list[Math.floor(Math.random() * list.length)];
        if (hash(id, 77) < 0.6) smoke.push({ x, y: y - 2, t: 0, life: 3 + Math.random() * 3, id });
      }
    }
    updateParticles(dt);
    fadeTraces();
  }

  // Le point (x, y), relatif au coin avant d'une colonne de hauteur h, est-il
  // dans sa silhouette (un hexagone : le losange du sol monté de h) ?
  function hidesPoint(x, y, h) {
    if (x < -CELL || x > CELL || y > 0) return false;
    const ax = Math.abs(x);
    return y <= -ax / 2 && y >= -CELL + ax / 2 - h;
  }
  // Pierre caché par un mur : on le redessine tramé par-dessus, là où on ne le voit pas
  const xc = document.createElement('canvas'); xc.width = 24; xc.height = 30;
  const xg = xc.getContext('2d', { willReadFrequently: true });
  function renderPierreTo(g) {
    g.clearRect(0, 0, 24, 30);
    drawPierre(g, 12, 29, { pose: playing ? 'play' : pierre.moving ? 'walk' : 'stand', t: playing ? time : pierre.t, dir: pierre.dir, shadow: false, silhouette: true });
  }
  function xray(sx, sy) {
    renderPierreTo(xg);
    const x0 = sx - 12, y0 = sy - 29;
    if (x0 < 0 || y0 < 0 || x0 + 24 > vw || y0 + 30 > vh) return;
    const mine = xg.getImageData(0, 0, 24, 30).data, seen = ctx.getImageData(x0, y0, 24, 30).data;
    ctx.fillStyle = PAL.ocre;
    for (let y = 0; y < 30; y++) for (let x = 0; x < 24; x++) {
      const o = (y * 24 + x) * 4;
      if (!mine[o + 3]) continue;
      const hidden = mine[o] !== seen[o] || mine[o + 1] !== seen[o + 1] || mine[o + 2] !== seen[o + 2];
      if (hidden && (x + y) % 2 === 0) ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }

  function render() {
    ctx.fillStyle = PAL.nuit;
    ctx.fillRect(0, 0, vw, vh);
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    const sprites = [];
    if (!attract) {
      sprites.push({
        wx: pierre.x, wy: pierre.y,
        draw: (g, x, y) => drawPierre(g, x, y, { pose: playing ? 'play' : pierre.moving ? 'walk' : 'stand', t: playing ? time : pierre.t, dir: pierre.dir, silhouette: true }),
      });
    }
    // Le décor pré-calculé : une seule image pour le sol, les maisons, le mobilier
    scene.drawDecor(ctx, cx, cy, vw, vh);
    // Autour de Pierre, on redessine en détail (dans un rectangle) : lui, trié
    // parmi les maisons, et les maisons qui le cachent, estompées
    const psx = pierre.x - pierre.y, psy = (pierre.x + pierre.y) / 2 - 12;
    const pk = Math.floor(pierre.x / CELL) + Math.floor(pierre.y / CELL);
    const faded = new Set();
    if (!attract) {
      let rx0 = Math.floor(psx - cx) - 14, ry0 = Math.floor(psy - cy) - 22, rx1 = rx0 + 30, ry1 = ry0 + 40;
      // les maisons devant Pierre qui cachent les abords : on les coupe au
      // rez-de-chaussée (maison de poupée), pour voir la rue autour de lui
      const around = [];
      for (let ox = -90; ox <= 90; ox += 30) for (let oy = -40; oy <= 50; oy += 30) around.push([ox, oy]);
      for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
        const n = city.at(i, j);
        if (n <= 0 || i + j <= pk) continue;
        const [fx, fy] = scene.front(i, j);
        if (!around.some(([ox, oy]) => hidesPoint(psx + ox - fx, psy + oy - fy, n * 60 + 34))) continue;
        faded.add(j * city.w + i + 1);
        rx0 = Math.min(rx0, fx - CELL - cx); rx1 = Math.max(rx1, fx + CELL + 1 - cx);
        ry0 = Math.min(ry0, fy - CELL / 2 - n * 60 - 34 - 24 - cy); ry1 = Math.max(ry1, fy + 1 - cy);
      }
      rx0 = Math.max(0, rx0); ry0 = Math.max(0, ry0); rx1 = Math.min(vw, rx1); ry1 = Math.min(vh, ry1);
      if (rx1 > rx0 && ry1 > ry0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(rx0, ry0, rx1 - rx0, ry1 - ry0); ctx.clip();
        ctx.translate(rx0, ry0);
        scene.draw(ctx, cx + rx0, cy + ry0, rx1 - rx0, ry1 - ry0, sprites, { fade: (i, j) => (faded.has(j * city.w + i + 1) ? 'cut' : 1) });
        ctx.restore();
      }
    }
    // Pierre caché par une maison : sa silhouette tramée (avant les rats, qui ne comptent pas)
    if (!attract) xray(Math.round(pierre.x - pierre.y - cx), Math.round((pierre.x + pierre.y) / 2 - cy));
    if (!attract) {
      // La silhouette de Pierre, que les rats derrière lui ne recouvrent pas
      const psx0 = Math.round(pierre.x - pierre.y - cx), psy0 = Math.round((pierre.x + pierre.y) / 2 - cy);
      renderPierreTo(xg);
      const tr = performance.now();
      swarm.draw(ctx, cx, cy, vw, vh, time, occlusion, { data: xg.getImageData(0, 0, 24, 30).data, x: psx0 - 12, y: psy0 - 29, w: 24, h: 30, sy: (pierre.x + pierre.y) / 2 - cy }, faded);
      perf.rats += (performance.now() - tr - perf.rats) * 0.05;
    }
    // Fumées
    for (const s of smoke) {
      const a = s.t / s.life;
      const x = Math.round(s.x - cx + Math.sin(s.t * 2 + s.id) * 2), y = Math.round(s.y - cy);
      const size = 1 + Math.floor(a * 3);
      ctx.fillStyle = a < 0.4 ? PAL.neigeM : PAL.neigeO;
      for (let k = 0; k < size * size; k++) {
        const px = k % size, py = Math.floor(k / size);
        if ((px + py + Math.floor(s.t * 4)) % (a > 0.7 ? 3 : 2) === 0) ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
    // La nuit tombe du ciel et des étages (peinte dans les maisons, buildings.js) ;
    // au ras du sol on voit, et les réverbères gardent leur flamme vive
    ctx.fillStyle = PAL.ocre;
    for (const [type, px, py] of city.props) {
      if (!PROP_TYPES[type].light) continue;
      const spr = propSprite(type, 0);
      const hx = Math.round(px - py - cx) - spr.ax + spr.head[0], hy = Math.round((px + py) / 2 - cy) - spr.ay + spr.head[1];
      if (hx < -4 || hx > vw + 4 || hy < -4 || hy > vh + 4) continue;
      ctx.fillRect(hx - 2, hy - 2, 5, 5);
    }
    // Notes
    for (const n of notes) {
      const fadeN = Math.max(0, (n.t - n.life * 0.55) / (n.life * 0.45));
      drawNote(ctx, n.x - cx + Math.sin(n.t * 3 + n.ph) * 3, n.y - cy, n.kind, fadeN);
    }
    // Neige qui tombe
    ctx.fillStyle = PAL.neige;
    for (const f of flakes) ctx.fillRect(Math.round(f.x), Math.round(f.y), f.big ? 2 : 1, f.big ? 2 : 1);
  }

  let last = 0, raf = 0;
  const perf = { update: 0, render: 0, rats: 0 };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (paused) return;
    const t0 = performance.now();
    update(dt);
    const t1 = performance.now();
    render();
    // temps moyens (ms) de simulation et de rendu, lus par les essais de performance
    perf.update += (t1 - t0 - perf.update) * 0.05;
    perf.render += (performance.now() - t1 - perf.render) * 0.05;
  }

  function factorFor(dw, dh) {
    const auto = Math.max(1, Math.floor(Math.min(dh / VIEW_H, dw / (VIEW_H * 0.66))));
    return Math.max(1, auto + zoomPref);
  }

  // ─── Taille de la vue : un facteur entier, des pixels nets ───
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const host = canvas.parentElement;
    const cw = host.clientWidth, ch = host.clientHeight;
    const dw = cw * dpr, dh = ch * dpr;
    factor = factorFor(dw, dh);
    vw = Math.ceil(dw / factor); vh = Math.ceil(dh / factor);
    canvas.width = vw; canvas.height = vh;
    canvas.style.width = (vw * factor / dpr) + 'px';
    canvas.style.height = (vh * factor / dpr) + 'px';
    ctx.imageSmoothingEnabled = false;
    resetFlakes();
    if (!paused) render();
  }

  // Écran (pixels CSS dans le canvas) → monde
  function screenToWorld(px, py) {
    const dpr = window.devicePixelRatio || 1;
    const sx = px * dpr / factor + cam.x, sy = py * dpr / factor + cam.y;
    return scene.toWorld(sx, sy);
  }

  resize();
  raf = requestAnimationFrame(frame);

  return {
    input,
    resize,
    screenToWorld,
    setZoom(z) { zoomPref = z; resize(); },
    setPlaying(on) {
      if (on && !playing) { emitNote(); if (callTimer > 1.5) callTimer = 1.2; }
      playing = on;
    },
    note: emitNote,
    get playing() { return playing; },
    get army() { return army; },
    get stats() { return { simulated: swarm.count, visible: swarm.visibleCount, traces: trLen, ms: { ...perf } }; },
    pause() { paused = true; },
    resume() { paused = false; last = 0; },
    get paused() { return paused; },
    setAttract(on) { attract = on; if (!on) { cam = { x: pierre.x - pierre.y - vw / 2, y: (pierre.x + pierre.y) / 2 - vh / 2 - 12 }; } },
    snapshot: () => ({ x: Math.round(pierre.x * 10) / 10, y: Math.round(pierre.y * 10) / 10, dir: pierre.dir, rats: army, playSeconds: Math.round(playTime) }),
    scene,
    destroy() { cancelAnimationFrame(raf); },
  };
}
