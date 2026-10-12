/* Le prototype three.js du labo : le même quartier, la même nuée, rendus en
   vraie 3D (WebGL), pour juger si le pixel art tient. Rien ne change dans le
   jeu tant qu'une variante n'est pas retenue.

   Pour garder le pixel art :
   - l'image est calculée en petite résolution (un pixel du jeu ≈ un pixel
     rendu) puis agrandie sans lissage ;
   - tout est en matériaux non éclairés (MeshBasicMaterial) avec des textures
     en filtrage « nearest » : les couleurs à l'écran sont exactement celles
     de la palette ; la nuit des étages est déjà peinte dans les façades ;
   - les façades viennent du générateur actuel (buildings.js), redressées.

   Trois caméras : isométrique (orthographique, 30° d'élévation), à hauteur
   d'enfant (en perspective, derrière Pierre), libre (on la fait tourner).
   three.js est chargé à la demande depuis le CDN, version figée. */
import { makeCity } from './city.js?v=1.4.1';
import { loadPublished } from './city-store.js?v=1.4.1';
import { renderColumn } from './buildings.js?v=1.4.1';
import { makeGround } from './ground.js?v=1.4.1';
import { createSwarm, ST } from './swarm.js?v=1.4.1';
import { propSprite, PROP_TYPES } from './props.js?v=1.4.1';
import { drawPierre } from './sprites.js?v=1.4.1';
import { PAL } from './palette.js?v=1.4.1';
import { CELL, FLOOR } from './scale.js?v=1.4.1';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const VIEW_H = 250;           // hauteur visée de la vue, en pixels du jeu (comme le jeu 2D)

export async function mount3D(host, { mode = 'iso', rats = 300, onStats = () => {} } = {}) {
  const THREE = await import(THREE_URL);
  const city = makeCity(await loadPublished());

  // ─── Le rendu basse résolution, agrandi sans lissage ───
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none';
  host.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.nuit);

  const tex = c => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const flat = key => new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL[key]) });

  // ─── Le sol : une texture vue de dessus, un pixel par pixel du monde ───
  const ground = makeGround(city);
  const GW = city.w * CELL, GH = city.h * CELL;
  const gc = document.createElement('canvas'); gc.width = GW; gc.height = GH;
  const gctx = gc.getContext('2d'), gimg = gctx.createImageData(GW, GH);
  const rgbOf = {};
  for (const [k, hex] of Object.entries(PAL)) rgbOf[k] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const key = ground.colorAt(x + 0.5, y + 0.5) || 'nuit';
    const c = rgbOf[key], o = (y * GW + x) * 4;
    gimg.data[o] = c[0]; gimg.data[o + 1] = c[1]; gimg.data[o + 2] = c[2]; gimg.data[o + 3] = 255;
  }
  gctx.putImageData(gimg, 0, 0);
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), new THREE.MeshBasicMaterial({ map: tex(gc) }));
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(GW / 2, 0, GH / 2);
  scene.add(groundMesh);

  // ─── Les maisons : des boîtes, habillées des façades du générateur ───
  // Une face de l'image isométrique, redressée en texture plate (u, hauteur)
  function faceCanvas(col, face, n) {
    const H = n * FLOOR, out = document.createElement('canvas');
    out.width = CELL; out.height = H;
    const src = col.canvas.getContext('2d').getImageData(0, 0, col.w, col.h).data;
    const g = out.getContext('2d'), img = g.createImageData(CELL, H);
    const base = col.h - 1;
    for (let u = 0; u < CELL; u++) for (let z = 0; z < H; z++) {
      const sx = face === 'A' ? u : CELL + u;
      const sy = face === 'A' ? base + Math.floor((u - CELL) / 2) - z : base + Math.floor(-u / 2) - z;
      const so = (sy * col.w + sx) * 4, o = ((H - 1 - z) * CELL + u) * 4;
      const a = src[so + 3];
      // un trou (la face était cachée par un voisin) : un mur sombre
      img.data[o] = a ? src[so] : 13; img.data[o + 1] = a ? src[so + 1] : 20; img.data[o + 2] = a ? src[so + 2] : 38; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return out;
  }
  const roofTop = flat('neige'), roofSide = flat('ardoise'), gable = flat('pierre'), dark = flat('nuit2');
  const buildings = [];   // { i, j, n, box, roof: [], maps: [A, B] } : pour la coupe autour de Pierre
  for (let j = 0; j < city.h; j++) for (let i = 0; i < city.w; i++) {
    const n = city.at(i, j);
    if (n <= 0) continue;
    const col = renderColumn(city, i, j, { night: true });
    const A = new THREE.MeshBasicMaterial({ map: tex(faceCanvas(col, 'A', n)) });
    const B = new THREE.MeshBasicMaterial({ map: tex(faceCanvas(col, 'B', n)) });
    const box = new THREE.Mesh(new THREE.BoxGeometry(CELL, n * FLOOR, CELL), [B, B, dark, dark, A, A]);
    box.position.set(i * CELL + CELL / 2, n * FLOOR / 2, j * CELL + CELL / 2);
    scene.add(box);
    const b = { i, j, n, box, roof: [], maps: [A.map, B.map], cut: false };
    buildings.push(b);
    // le toit : comble à la Mansart (brisis puis terrasson), deux pans pour les
    // vieilles maisons, rien pour les tours de Notre-Dame
    const style = city.kind(i, j) === 'N' ? (n >= 7 ? 'tower' : 'nave') : n <= 3 ? 'old' : 'haussmann';
    const top = n * FLOOR;
    if (style === 'haussmann') {
      const brisis = new THREE.Mesh(new THREE.BoxGeometry(CELL - 4, 22, CELL - 4), [roofSide, roofSide, roofTop, dark, roofSide, roofSide]);
      brisis.position.set(i * CELL + CELL / 2, top + 11, j * CELL + CELL / 2);
      const terrasson = new THREE.Mesh(new THREE.BoxGeometry(CELL - 24, 10, CELL - 24), roofTop);
      terrasson.position.set(i * CELL + CELL / 2, top + 27, j * CELL + CELL / 2);
      scene.add(brisis, terrasson); b.roof.push(brisis, terrasson);
    } else if (style === 'old' || style === 'nave') {
      const same = (x, y) => city.at(x, y) === n;
      const alongX = (same(i - 1, j) + same(i + 1, j)) >= (same(i, j - 1) + same(i, j + 1));
      const h = style === 'nave' ? 60 : 36;
      const shape = new THREE.Shape([new THREE.Vector2(-CELL / 2, 0), new THREE.Vector2(CELL / 2, 0), new THREE.Vector2(0, h)]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: CELL, bevelEnabled: false });
      const prism = new THREE.Mesh(geo, [gable, style === 'nave' ? roofSide : roofTop]);
      prism.position.set(i * CELL + CELL / 2, top, j * CELL + CELL / 2);
      if (alongX) { prism.rotation.y = Math.PI / 2; prism.position.x -= CELL / 2; } else prism.position.z -= CELL / 2;
      scene.add(prism); b.roof.push(prism);
    }
  }
  /* La coupe (maison de poupée), en 3D : les maisons entre la caméra et
     Pierre, près de lui, ne gardent que leur rez-de-chaussée (la boîte
     ramenée à un étage, la texture au rez-de-chaussée, le toit caché). */
  function setCut(b, on) {
    if (b.cut === on) return;
    b.cut = on;
    b.box.scale.y = on ? 1 / b.n : 1;
    b.box.position.y = (on ? FLOOR : b.n * FLOOR) / 2;
    for (const m of b.maps) { m.repeat.set(1, on ? 1 / b.n : 1); m.needsUpdate = true; }
    for (const r of b.roof) r.visible = !on;
  }
  function updateCuts() {
    if (mode === 'child') return;
    const cx = camera.position.x - pierre.x, cz = camera.position.z - pierre.y, cl = Math.hypot(cx, cz) || 1;
    const fx = cx / cl, fz = cz / cl;           // vers la caméra, au sol
    for (const b of buildings) {
      const dx = (b.i + 0.5) * CELL - pierre.x, dz = (b.j + 0.5) * CELL - pierre.y;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      setCut(b, along > -20 && along < 700 && side < 200 + along * 0.35);
    }
  }

  // ─── Le mobilier : des panneaux tournés vers la caméra (les sprites 2D) ───
  const lamps = [];
  for (const [type, px, py, v] of city.props) {
    const spr = propSprite(type, v);
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(spr.c), alphaTest: 0.5 }));
    m.center.set(spr.ax / spr.c.width, 1 - spr.ay / spr.c.height);
    m.scale.set(spr.c.width, spr.c.height, 1);
    m.position.set(px, 0, py);
    scene.add(m);
    if (PROP_TYPES[type].light) lamps.push([px, py]);
  }
  // le rond de lumière d'un réverbère, tramé, posé sur le sol
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const pool = document.createElement('canvas'); pool.width = pool.height = 128;
  const pg = pool.getContext('2d');
  pg.fillStyle = PAL.neigeM;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const t = Math.max(0, 1 - Math.hypot(x - 64, y - 64) / 64) * 1.4;
    if (t * 16 > BAYER[(y % 4) * 4 + (x % 4)] + 4) pg.fillRect(x, y, 1, 1);
  }
  const poolMat = new THREE.MeshBasicMaterial({ map: tex(pool), transparent: true, alphaTest: 0.5, depthWrite: false });
  for (const [px, py] of lamps) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(128, 128), poolMat);
    p.rotation.x = -Math.PI / 2; p.position.set(px, 0.3, py);
    scene.add(p);
  }

  // ─── Pierre : une silhouette sur un panneau ───
  const poses = {};
  for (const [name, pose, t] of [['stand', 'stand', 0], ['w0', 'walk', 0], ['w1', 'walk', 0.13], ['w2', 'walk', 0.26], ['w3', 'walk', 0.39], ['play', 'play', 0]]) {
    for (const dir of [1, -1]) {
      const c = document.createElement('canvas'); c.width = 24; c.height = 28;
      drawPierre(c.getContext('2d'), 12, 27, { pose, t, dir, shadow: false, silhouette: true });
      poses[name + dir] = tex(c);
    }
  }
  const pierreMat = new THREE.SpriteMaterial({ map: poses.stand1, alphaTest: 0.5 });
  const pierreSprite = new THREE.Sprite(pierreMat);
  pierreSprite.center.set(0.5, 1 / 28);
  pierreSprite.scale.set(24, 28, 1);
  scene.add(pierreSprite);
  // derrière un mur, Pierre se voit tramé en blanc, par-dessus tout (comme xray en 2D)
  const ghostTex = {};
  for (const [k, t] of Object.entries(poses)) {
    const c = document.createElement('canvas'); c.width = 24; c.height = 28;
    const g = c.getContext('2d'), src = t.image.getContext('2d').getImageData(0, 0, 24, 28).data;
    g.fillStyle = PAL.ocre;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 24; x++) if (src[(y * 24 + x) * 4 + 3] && (x + y) % 2 === 0) g.fillRect(x, y, 1, 1);
    ghostTex[k] = tex(c);
  }
  const ghostMat = new THREE.SpriteMaterial({ map: ghostTex.stand1, alphaTest: 0.5, depthTest: false });
  const ghost = new THREE.Sprite(ghostMat);
  ghost.center.copy(pierreSprite.center); ghost.scale.copy(pierreSprite.scale);
  ghost.renderOrder = 10;
  scene.add(ghost);
  const pierre = { x: (city.start[0] + 0.5) * CELL, y: (city.start[1] + 0.5) * CELL, vx: 0, vy: 0, dir: 1, head: 0, t: 0, playing: true };

  // ─── La nuée : la même simulation, des rats en boîtes noires instanciées ───
  const swarm = createSwarm({ city, capacity: 4000 });
  for (let k = 0; k < rats; k++) {
    const a = Math.random() * 6.28, r = 8 + Math.sqrt(k) * 3 * Math.random();
    swarm.add(pierre.x + Math.cos(a) * r, pierre.y + Math.sin(a) * r);
  }
  // un rat : un corps, une tête plus étroite, une longue queue (fusionnés en une géométrie)
  const part = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); return g.attributes.position.array; };
  const parts = [part(6, 3, 4, 0, 1.8, 0), part(3, 2.2, 2.6, 4.2, 1.6, 0), part(1, 1, 1, 6, 2.2, 0.9), part(6, 0.6, 0.6, -5.6, 0.6, 0)];
  const ratPos = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let off = 0; for (const a of parts) { ratPos.set(a, off); off += a.length; }
  const ratGeo = new THREE.BufferGeometry();
  ratGeo.setAttribute('position', new THREE.BufferAttribute(ratPos, 3));
  const ratMesh = new THREE.InstancedMesh(ratGeo, flat('nuit'), 4000);
  ratMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(ratMesh);
  const dummy = new THREE.Object3D();

  // ─── La neige qui tombe ───
  const FLAKES = 1500;
  const flakePos = new Float32Array(FLAKES * 3);
  for (let k = 0; k < FLAKES; k++) { flakePos[k * 3] = Math.random() * 400 - 200; flakePos[k * 3 + 1] = Math.random() * 300; flakePos[k * 3 + 2] = Math.random() * 400 - 200; }
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
  const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ color: new THREE.Color(PAL.neige), size: 1, sizeAttenuation: false }));
  scene.add(flakes);

  // ─── Les caméras ───
  let camera, yaw = Math.PI / 4, dist = 300;
  function makeCamera() {
    const w = canvas.width, h = canvas.height, aspect = w / h;
    // en isométrique, un pixel rendu = un pixel du jeu : les textures restent nettes
    if (mode === 'iso') camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -2000, 4000);
    else camera = new THREE.PerspectiveCamera(mode === 'child' ? 62 : 45, aspect, 1, 3000);
  }
  function placeCamera(dt) {
    const tx = pierre.x, tz = pierre.y;
    if (mode === 'iso') {
      // 30° d'élévation, vue depuis +x +z : on voit les faces A et B comme en 2D
      const e = Math.PI / 6, d = 1000;
      camera.position.set(tx + Math.cos(e) * Math.cos(Math.PI / 4) * d, Math.sin(e) * d, tz + Math.cos(e) * Math.sin(Math.PI / 4) * d);
      camera.lookAt(tx, 10, tz);
    } else if (mode === 'child') {
      // derrière Pierre, par-dessus son épaule (un peu plus haut qu'un enfant,
      // pour que la nuée à ses pieds ne bouche pas la vue)
      const back = 64, hx = Math.cos(pierre.head), hz = Math.sin(pierre.head);
      const want = new THREE.Vector3(tx - hx * back, 42, tz - hz * back);
      camera.position.lerp(want, Math.min(1, dt * 4));
      camera.lookAt(tx + hx * 60, 24, tz + hz * 60);
    } else {
      const e = 0.6;
      camera.position.set(tx + Math.cos(e) * Math.cos(yaw) * dist, Math.sin(e) * dist, tz + Math.cos(e) * Math.sin(yaw) * dist);
      camera.lookAt(tx, 10, tz);
    }
  }
  function resize() {
    // un facteur entier, pour environ VIEW_H pixels du jeu en hauteur
    const k = Math.max(1, Math.floor(host.clientHeight / VIEW_H));
    const w = Math.max(1, Math.floor(host.clientWidth / k)), h = Math.max(1, Math.floor(host.clientHeight / k));
    renderer.setSize(w, h, false);
    makeCamera();
    if (mode === 'child') camera.position.set(pierre.x - 70, 30, pierre.y);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);

  // ─── Commandes : ZQSD / WASD, ou toucher le sol pour y aller ───
  const keys = {};
  const onKey = e => {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
    keys[e.code] = e.type === 'keydown';
    e.preventDefault();
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  let target = null, dragging = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    dragging = { x: e.clientX, yaw, moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - dragging.x) > 6) dragging.moved = true;
    if (mode === 'free' && dragging.moved) yaw = dragging.yaw - (e.clientX - dragging.x) * 0.01;
  });
  canvas.addEventListener('pointerup', e => {
    if (dragging && !dragging.moved) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(groundMesh)[0];
      if (hit) target = [hit.point.x, hit.point.z];
    }
    dragging = null;
  });
  canvas.addEventListener('wheel', e => { if (mode === 'free') { e.preventDefault(); dist = Math.max(80, Math.min(900, dist + e.deltaY * 0.5)); } }, { passive: false });

  const walk = (x, y) => city.walk(Math.floor(x / CELL), Math.floor(y / CELL));
  function updatePierre(dt) {
    let mx = 0, my = 0;
    if (mode === 'child') {
      // à hauteur d'enfant : Q/D tournent, Z/S avancent et reculent
      if (keys.KeyA) pierre.head -= dt * 2.2;
      if (keys.KeyD) pierre.head += dt * 2.2;
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
      mx = Math.cos(pierre.head) * f; my = Math.sin(pierre.head) * f;
    } else {
      // l'écran : haut = vers le fond de la vue
      const fx = -Math.cos(mode === 'iso' ? Math.PI / 4 : yaw), fz = -Math.sin(mode === 'iso' ? Math.PI / 4 : yaw);
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      mx = fx * f - fz * s; my = fz * f + fx * s;
    }
    if (target && !mx && !my) {
      const dx = target[0] - pierre.x, dy = target[1] - pierre.y, d = Math.hypot(dx, dy);
      if (d < 3) target = null; else { mx = dx / d; my = dy / d; }
    }
    const l = Math.hypot(mx, my);
    pierre.vx = l ? mx / l : 0; pierre.vy = l ? my / l : 0;
    if (l) {
      const sp = 34 * dt;
      const nx = pierre.x + pierre.vx * sp, ny = pierre.y + pierre.vy * sp;
      if (walk(nx, pierre.y)) pierre.x = nx;
      if (walk(pierre.x, ny)) pierre.y = ny;
      pierre.t += dt;
      if (mode !== 'child') pierre.head = Math.atan2(pierre.vy, pierre.vx);
    }
    pierre.moving = !!l;
  }

  // ─── La boucle ───
  let raf = 0, last = 0, time = 0, frames = 0, fpsT = 0;
  const perf = { sim: 0, draw: 0 };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; time += dt;
    const t0 = performance.now();
    updatePierre(dt);
    swarm.update(dt, { x: pierre.x, y: pierre.y, vx: pierre.vx, vy: pierre.vy, playing: !pierre.moving }, time, 0);
    // les rats : position, cap, une pose dressée, un petit trot
    const s = swarm.state;
    const camX = camera.position.x, camZ = camera.position.z;
    for (let i = 0; i < swarm.count; i++) {
      const rear = s.st[i] === ST.REAR;
      if (mode === 'child' && (s.x[i] - camX) ** 2 + (s.y[i] - camZ) ** 2 < 58 * 58) { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); ratMesh.setMatrixAt(i, dummy.matrix); continue; }
      dummy.scale.set(1, 1, 1);
      dummy.position.set(s.x[i], s.z[i] + Math.abs(Math.sin(s.ph[i] * 3)) * 0.8, s.y[i]);
      dummy.rotation.set(0, -Math.atan2(s.vy[i], s.vx[i]), rear ? 1.1 : 0);
      dummy.updateMatrix();
      ratMesh.setMatrixAt(i, dummy.matrix);
    }
    ratMesh.count = swarm.count;
    ratMesh.instanceMatrix.needsUpdate = true;
    // Pierre : la pose, tournée vers l'écran
    const sideways = mode === 'child' ? 1 : Math.sign(pierre.vx - pierre.vy) || pierre.dir;
    pierre.dir = sideways;
    const pose = pierre.moving ? 'w' + (Math.floor(pierre.t * 8) % 4) : 'play';
    pierreMat.map = poses[pose + (pierre.dir < 0 ? -1 : 1)];
    ghostMat.map = ghostTex[pose + (pierre.dir < 0 ? -1 : 1)];
    pierreSprite.position.set(pierre.x, 0, pierre.y);
    ghost.position.copy(pierreSprite.position);
    ghost.visible = mode !== 'child';
    // la neige suit la caméra
    for (let k = 0; k < FLAKES; k++) {
      flakePos[k * 3 + 1] -= dt * (10 + (k % 7) * 3);
      if (flakePos[k * 3 + 1] < 0) flakePos[k * 3 + 1] = 300;
    }
    flakes.position.set(pierre.x, 0, pierre.y);
    flakeGeo.attributes.position.needsUpdate = true;
    placeCamera(dt);
    updateCuts();
    const t1 = performance.now();
    renderer.render(scene, camera);
    const t2 = performance.now();
    perf.sim += (t1 - t0 - perf.sim) * 0.05; perf.draw += (t2 - t1 - perf.draw) * 0.05;
    frames++; fpsT += dt;
    if (fpsT > 1) { onStats({ fps: Math.round(frames / fpsT), rats: swarm.count, sim: perf.sim, draw: perf.draw }); frames = 0; fpsT = 0; }
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKey);
      renderer.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      canvas.remove();
    },
  };
}

/* La variante A : le moteur 2D d'aujourd'hui, en direct, avec la même nuée */
export async function mount2D(host, { rats = 300 } = {}) {
  const { createGame } = await import('./game.js?v=1.4.1');
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
