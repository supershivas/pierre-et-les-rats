/* Le jeu : Pierre marche dans les rues enneigées, joue de la flûte, et les
   rats sortent des bouches d'égout pour le rejoindre. Plus il joue, plus
   l'armée grossit ; elle le suit partout, en laissant de légères traces.

   Coordonnées monde en pixels du jeu (1 px = 5 cm, une case = 60 px). La
   vue est rendue en pixels du jeu dans un petit canvas, agrandi d'un
   facteur entier (pixels nets). */
import { PAL } from './palette.js?v=1.0.0';
import { CELL } from './scale.js?v=1.0.0';
import { makeScene } from './scene.js?v=1.0.0';
import { drawPierre, drawRat, drawNote } from './sprites.js?v=1.0.0';
import { hash } from './city.js?v=1.0.0';

const WALK = 34, RUN = 64;            // px/s : 1,7 m/s et 3,2 m/s
const RAT_SPEED = 70;
const PIERRE_R = 5, RAT_R = 2;
const MAX_RATS = 600;                 // au-delà, l'armée est comptée mais pas toute simulée
const TRACE_LIFE = 150;               // s : la neige recouvre les traces
const VIEW_H = 240;                   // hauteur visée de la vue, en pixels du jeu

export function createGame({ canvas, city, save = null, onRats = () => {}, onMessage = () => {} }) {
  const scene = makeScene(city);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let vw = 320, vh = 240, factor = 3, zoomPref = 0;

  // ─── État ───
  const start = save && Number.isFinite(save.x) ? [save.x, save.y] : [(city.start[0] + 0.5) * CELL, (city.start[1] + 0.5) * CELL];
  const pierre = { x: start[0], y: start[1], dir: save?.dir || 1, moving: false, running: false, t: 0, stride: 0, foot: 0 };
  if (solid(pierre.x, pierre.y)) Object.assign(pierre, nearestStreet(pierre.x, pierre.y));
  let army = save?.rats || 0;            // le nombre de rats qui suivent Pierre
  const rats = [];
  const notes = [], smoke = [], flakes = [];
  const traces = [];
  let playing = false, playTime = save?.playSeconds || 0, callTimer = 1.2;
  let cam = { x: pierre.x - pierre.y, y: (pierre.x + pierre.y) / 2 };
  let time = 0, paused = true, attract = false, attractT = 0;
  const input = { up: 0, down: 0, left: 0, right: 0, run: false, target: null };

  // ─── Le sol et les obstacles ───
  function solid(wx, wy) {
    return city.at(Math.floor(wx / CELL), Math.floor(wy / CELL)) !== 0;
  }
  function blocked(x, y, r) {
    return solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r);
  }
  function nearestStreet(wx, wy) {
    let best = null, bd = Infinity;
    for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
      if (city.at(i, j) !== 0) continue;
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

  // ─── Le chemin vers Pierre : une carte des distances, case par case ───
  let flow = new Int16Array(city.w * city.h), flowCell = -1;
  function updateFlow() {
    const ci = Math.floor(pierre.x / CELL), cj = Math.floor(pierre.y / CELL);
    const k = cj * city.w + ci;
    if (k === flowCell) return;
    flowCell = k;
    flow.fill(-1);
    const q = [k]; flow[k] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % city.w, y = (c - x) / city.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (city.at(nx, ny) !== 0) continue;
        const n = ny * city.w + nx;
        if (flow[n] >= 0) continue;
        flow[n] = flow[c] + 1;
        q.push(n);
      }
    }
  }
  const distOf = (i, j) => (i < 0 || j < 0 || i >= city.w || j >= city.h ? -1 : flow[j * city.w + i]);

  // ─── Les rats ───
  function addRat(x, y, arrived = false) {
    const k = rats.length;
    // Une place à lui dans la nuée, derrière Pierre ; l'anneau s'élargit avec l'armée
    const ring = Math.sqrt(k + 1) * 3.2 + 7;
    rats.push({
      x, y, dir: 1, t: Math.random() * 3, moving: false,
      ang: hash(k, 3) * Math.PI * 2, ring: ring * (0.7 + hash(k, 4) * 0.5),
      burst: 0, rest: Math.random(), stride: 0, foot: 0, arrived,
    });
  }
  function spawnFromSewer() {
    updateFlow();
    const far = city.grates.filter(([i, j]) => { const d = distOf(i, j); return d >= 2 && d <= 9; });
    let x, y;
    if (far.length) {
      const [i, j] = far[Math.floor(Math.random() * far.length)];
      x = (i + 0.5) * CELL; y = (j + 0.5) * CELL;
    } else {
      const a = Math.random() * Math.PI * 2;
      const p = nearestStreet(pierre.x + Math.cos(a) * 240, pierre.y + Math.sin(a) * 240);
      x = p.x; y = p.y;
    }
    army++;
    if (rats.length < MAX_RATS) addRat(x, y);
    onRats(army);
    if ([1, 5, 10, 25, 50, 100, 200, 500, 1000].includes(army)) onMessage(milestone(army));
  }
  function milestone(n) {
    return {
      1: 'Un premier rat sort de l\'égout.',
      5: 'Cinq rats. Ils ont froid, eux aussi.',
      10: 'Dix rats suivent Pierre.',
      25: 'Vingt-cinq. Les passants se signent.',
      50: 'Cinquante rats : une petite armée.',
      100: 'Cent rats. Paris commence à parler de Pierre.',
      200: 'Deux cents rats dans la neige.',
      500: 'Cinq cents. La nuit leur appartient.',
      1000: 'Mille rats. L\'Empereur en avait moins à Waterloo.',
    }[n];
  }
  // Au chargement : l'armée revient autour de Pierre
  for (let k = 0; k < Math.min(army, MAX_RATS); k++) {
    const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 30;
    const p = { x: pierre.x + Math.cos(a) * r, y: pierre.y + Math.sin(a) * r };
    if (blocked(p.x, p.y, RAT_R)) { p.x = pierre.x; p.y = pierre.y; }
    addRat(p.x, p.y, true);
  }

  function updateRats(dt) {
    updateFlow();
    const pi = Math.floor(pierre.x / CELL), pj = Math.floor(pierre.y / CELL);
    const back = Math.atan2(-pierre.vy || 0, -pierre.vx || -pierre.dir);
    for (let idx = 0; idx < rats.length; idx++) {
      const r = rats[idx];
      r.t += dt;
      let tx, ty;
      const ci = Math.floor(r.x / CELL), cj = Math.floor(r.y / CELL);
      const d = distOf(ci, cj);
      const far = (r.x - pierre.x) ** 2 + (r.y - pierre.y) ** 2 > (CELL * 1.2) ** 2;
      if (d > 0 && far) {
        // Suivre la pente des distances vers la case de Pierre
        let best = null, bd = d;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nd = distOf(ci + dx, cj + dy);
          if (nd >= 0 && nd < bd) { bd = nd; best = [ci + dx, cj + dy]; }
        }
        if (best) { tx = (best[0] + 0.5) * CELL + (hash(idx, 5) - 0.5) * 30; ty = (best[1] + 0.5) * CELL + (hash(idx, 6) - 0.5) * 30; }
        else { tx = pierre.x; ty = pierre.y; }
      } else {
        // Sa place dans la nuée, plutôt derrière Pierre ; quand il joue, ils se pressent autour
        const spread = playing ? 0.75 : 1;
        const a = back + (r.ang - Math.PI) * (playing ? 1 : 0.55);
        tx = pierre.x + Math.cos(a) * r.ring * spread;
        ty = pierre.y + Math.sin(a) * r.ring * spread;
        if (pi !== ci || pj !== cj) { if (blocked(tx, ty, RAT_R)) { tx = pierre.x; ty = pierre.y; } }
      }
      const dx = tx - r.x, dy = ty - r.y, dist = Math.hypot(dx, dy);
      // Les rats courent par à-coups : une course, un arrêt, on renifle
      r.rest -= dt;
      if (dist > 4 && r.rest <= 0) {
        const sp = RAT_SPEED * (far ? 1.15 : 0.8 + hash(r.ang * 100, 7) * 0.5);
        const step = Math.min(dist, sp * dt);
        const ox = r.x, oy = r.y;
        move(r, dx / dist * step, dy / dist * step, RAT_R);
        const moved = Math.hypot(r.x - ox, r.y - oy);
        r.moving = moved > 0.01;
        if (Math.abs(r.x - ox - (r.y - oy)) > 0.05) r.dir = r.x - ox - (r.y - oy) > 0 ? 1 : -1;
        r.burst += dt;
        if (!far && r.burst > 0.4 + Math.random() * 0.6) { r.burst = 0; r.rest = 0.1 + Math.random() * 0.5; }
        // Une trace d'un pixel tous les 5 px, en quinconce
        r.stride += moved;
        if (r.stride > 5) {
          r.stride = 0; r.foot ^= 1;
          const nx = -dy / dist, ny = dx / dist, s = r.foot ? 1 : -1;
          trace(r.x + nx * s, r.y + ny * s, 'neigeM');
        }
      } else r.moving = false;
    }
  }

  // ─── Les traces dans la neige ───
  function trace(wx, wy, key) {
    const at = scene.ground.colorAt(wx, wy);
    if (!at) return;
    const ink = at === 'neige' ? key : 'neigeO';
    const p = scene.ground.stamp(wx, wy, ink);
    if (p) traces.push([p[0], p[1], time]);
  }
  function fadeTraces() {
    // La neige qui tombe recouvre d'abord les plus vieilles
    let n = 0;
    while (traces.length && time - traces[0][2] > TRACE_LIFE * (0.6 + 0.4 * hash(traces[0][0], traces[0][1]))) {
      const [gx, gy] = traces.shift();
      scene.ground.restore(gx, gy);
      if (++n > 200) break;
    }
    if (traces.length > 40000) { const [gx, gy] = traces.shift(); scene.ground.restore(gx, gy); }
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
        trace(pierre.x + nx * s, pierre.y + ny * s, 'neigeO');
        trace(pierre.x + nx * s + vx, pierre.y + ny * s + vy, 'neigeO');
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
          callTimer = Math.max(0.3, 1.6 - Math.sqrt(army) * 0.08) * (0.6 + Math.random() * 0.8);
        }
      }
      updateRats(dt);
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
  const xg = xc.getContext('2d');
  function xray(sx, sy) {
    xg.clearRect(0, 0, 24, 30);
    drawPierre(xg, 12, 29, { pose: playing ? 'play' : pierre.moving ? 'walk' : 'stand', t: playing ? time : pierre.t, dir: pierre.dir, shadow: false });
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
      for (const r of rats) sprites.push({ wx: r.x, wy: r.y, draw: (g, x, y) => drawRat(g, x, y, r) });
      sprites.push({
        wx: pierre.x, wy: pierre.y,
        draw: (g, x, y) => drawPierre(g, x, y, { pose: playing ? 'play' : pierre.moving ? 'walk' : 'stand', t: playing ? time : pierre.t, dir: pierre.dir }),
      });
    }
    // Une maison qui cache Pierre s'efface à moitié
    const psx = pierre.x - pierre.y, psy = (pierre.x + pierre.y) / 2 - 12;
    const pk = Math.floor(pierre.x / CELL) + Math.floor(pierre.y / CELL);
    const fade = attract ? null : (i, j) => {
      if (i + j <= pk) return 1;
      const [fx, fy] = scene.front(i, j);
      return hidesPoint(psx - fx, psy - fy, city.at(i, j) * 60 + 34) ? 0.45 : 1;
    };
    scene.draw(ctx, cx, cy, vw, vh, sprites, { fade });
    if (!attract) xray(Math.round(pierre.x - pierre.y - cx), Math.round((pierre.x + pierre.y) / 2 - cy));
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
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (paused) return;
    update(dt);
    render();
  }

  // ─── Taille de la vue : un facteur entier, des pixels nets ───
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const host = canvas.parentElement;
    const cw = host.clientWidth, ch = host.clientHeight;
    const dw = cw * dpr, dh = ch * dpr;
    // facteur automatique : environ VIEW_H pixels du jeu en hauteur, au moins 320 de large
    const auto = Math.max(1, Math.floor(Math.min(dh / VIEW_H, dw / 320)));
    factor = Math.max(1, auto + zoomPref);
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
    pause() { paused = true; },
    resume() { paused = false; last = 0; },
    get paused() { return paused; },
    setAttract(on) { attract = on; if (!on) { cam = { x: pierre.x - pierre.y - vw / 2, y: (pierre.x + pierre.y) / 2 - vh / 2 - 12 }; } },
    snapshot: () => ({ x: Math.round(pierre.x * 10) / 10, y: Math.round(pierre.y * 10) / 10, dir: pierre.dir, rats: army, playSeconds: Math.round(playTime) }),
    scene,
    destroy() { cancelAnimationFrame(raf); },
  };
}
