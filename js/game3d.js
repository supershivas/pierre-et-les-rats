/* Le jeu, en 3D (v2.0.0) : Pierre marche dans le Paris enneigé de 1871, joue
   de la flûte, les rats sortent des bouches d'égout et le suivent. Plus il
   joue, plus l'armée grossit. La même simulation que le moteur 2D (swarm.js),
   mais rendue par three.js, avec une caméra libre qu'on fait tourner autour
   de Pierre.

   Coordonnées monde en pixels du jeu (1 px = 5 cm, une case = 60 px) : x vers
   l'est, y (ici z pour three.js) vers le sud, le haut est y pour three.js.
   L'image est calculée en petite résolution (environ 250 px de haut) puis
   agrandie d'un facteur entier sans lissage : pixels nets, palette exacte. */
import { PAL, PALETTE, PAL_INDEX } from './palette.js?v=2.0.0';
import { CELL } from './scale.js?v=2.0.0';
import { loadThree } from './three-lib.js?v=2.0.0';
import { buildWorld, tick } from './world3d.js?v=2.0.0';
import { createSwarm, ST } from './swarm.js?v=2.0.0';
import { PROP_TYPES } from './props.js?v=2.0.0';
import { makeGroundColor } from './ground.js?v=2.0.0';
import { hash } from './city.js?v=2.0.0';
import { drawNote } from './sprites.js?v=2.0.0';

const WALK = 34, RUN = 64;            // px/s : 1,7 m/s et 3,2 m/s
const PIERRE_R = 5;
const MAX_RATS = 4000;                // au-delà, l'armée est comptée mais pas toute simulée
const TRACE_LIFE = 150;               // s : la neige recouvre les traces
const TRACE_CAP = 60000;              // traces gardées au plus (tampon circulaire)
const VIEW_H = 250;                   // hauteur de la vue, en pixels du jeu
const FOV = 36;                       // degrés : un téléobjectif, pour rester proche de l'isométrique
const PITCH_MIN = 0.28, PITCH_MAX = 1.25;
const PPU_MIN = 0.4, PPU_MAX = 2.4;   // pixels d'écran par pixel du monde (le zoom)
const FLAKES = 2400;

export async function createGame3D({ canvas, city, save = null, onRats = () => {}, onMessage = () => {}, onProgress = () => {}, testRats = 0, sandbox = false }) {
  const THREE = await loadThree();

  // ─── Le rendu : petite résolution, agrandie sans lissage ───
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  renderer.setClearColor(new THREE.Color(PAL.nuit), 1);
  const ghostScene = new THREE.Scene();           // ce qui se voit à travers les murs, tramé
  const actors = new THREE.Scene();               // Pierre, les rats, les notes : dessinés après le décor et son double tramé
  const world = await buildWorld(THREE, city, { onProgress });
  scene.add(world.root);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 4, 4000);
  const palSample = key => PAL_INDEX[key];

  let vw = 320, vh = 240, factor = 3, zoomPref = 0;
  let ppu = 1.1;               // le zoom : pixels d'écran par pixel du monde
  const cam = { yaw: Math.PI / 4, pitch: 0.62, tx: 0, tz: 0, ty: 14 };

  // ─── État ───
  const start = save && Number.isFinite(save.x) ? [save.x, save.y] : [(city.start[0] + 0.5) * CELL, (city.start[1] + 0.5) * CELL];
  const pierre = { x: start[0], y: start[1], vx: 0, vy: 0, heading: Math.PI / 2, moving: false, running: false, t: 0, stride: 0, foot: 0 };
  if (solid(pierre.x, pierre.y)) Object.assign(pierre, nearestStreet(pierre.x, pierre.y));
  if (save && Number.isFinite(save.yaw)) cam.yaw = save.yaw;
  let army = save?.rats || 0;
  let playing = false, playTime = save?.playSeconds || 0, callTimer = 1.2;
  let time = 0, paused = true, attract = false, attractT = 0;
  const input = { up: 0, down: 0, left: 0, right: 0, run: false, target: null, hold: false, rotate: 0 };
  cam.tx = pierre.x; cam.tz = pierre.y;

  // ─── Le sol et les obstacles ───
  function solid(wx, wy) { return !city.walk(Math.floor(wx / CELL), Math.floor(wy / CELL)); }
  function blocked(x, y, r) {
    if (solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r)) return true;
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
  function move(o, dx, dy, r) {
    if (!blocked(o.x + dx, o.y, r)) o.x += dx;
    if (!blocked(o.x, o.y + dy, r)) o.y += dy;
  }

  // ─── Les traces dans la neige : des points sur le sol, qui s'effacent d'eux-mêmes ───
  const groundColor = makeGroundColor(city, { quayWalls: false, pits: true });
  const palUniform = { value: world.palTex };
  const trPos = new Float32Array(TRACE_CAP * 3), trBorn = new Float32Array(TRACE_CAP).fill(-1), trTone = new Float32Array(TRACE_CAP);
  let trHead = 0, trLen = 0;
  const trGeo = new THREE.BufferGeometry();
  const trPosAttr = new THREE.BufferAttribute(trPos, 3), trBornAttr = new THREE.BufferAttribute(trBorn, 1), trToneAttr = new THREE.BufferAttribute(trTone, 1);
  for (const a of [trPosAttr, trBornAttr, trToneAttr]) a.setUsage(THREE.DynamicDrawUsage);
  trGeo.setAttribute('position', trPosAttr); trGeo.setAttribute('born', trBornAttr); trGeo.setAttribute('tone', trToneAttr);
  const trMat = new THREE.ShaderMaterial({
    uniforms: { now: { value: 0 }, life: { value: TRACE_LIFE }, size: { value: 1 }, pal: palUniform, palN: { value: PALETTE.length } },
    vertexShader: `
      attribute float born; attribute float tone;
      uniform float now; uniform float life; uniform float size;
      varying float vTone;
      void main() {
        vTone = tone;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size;
        float lim = life * (0.6 + 0.4 * fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453));
        if (born < 0.0 || now - born > lim) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D pal; uniform float palN; varying float vTone;
      void main() { gl_FragColor = vec4(texture2D(pal, vec2((vTone + 0.5) / palN, 0.5)).rgb, 1.0); }`,
  });
  const traces = new THREE.Points(trGeo, trMat);
  traces.frustumCulled = false;
  scene.add(traces);
  let dirtyFrom = -1, dirtyTo = -1, dirtyAll = false;
  function trace(wx, wy, key) {
    if (Math.abs(wx - pierre.x) > 600 || Math.abs(wy - pierre.y) > 600) return;       // seulement ce qu'on voit
    const at = groundColor(wx, wy);
    if (!at || at === 'nuit2' && key === 'nuit2') return;
    const ink = at === 'neigeM' ? key : at === 'neigeO' ? 'nuit2' : 'nuit';
    if (city.kind(Math.floor(wx / CELL), Math.floor(wy / CELL)) === 'P') return;
    const k = (trHead + trLen) % TRACE_CAP;
    if (trLen === TRACE_CAP) trHead = (trHead + 1) % TRACE_CAP; else trLen++;
    trPos[k * 3] = Math.round(wx) + 0.5; trPos[k * 3 + 1] = 0.35; trPos[k * 3 + 2] = Math.round(wy) + 0.5;
    trBorn[k] = time; trTone[k] = palSample(ink);
    if (dirtyFrom < 0) { dirtyFrom = dirtyTo = k; } else if (k === dirtyTo + 1) dirtyTo = k; else if (k >= dirtyFrom && k <= dirtyTo) { /* déjà couvert */ } else dirtyAll = true;
  }
  function flushTraces() {
    if (dirtyFrom < 0) return;
    for (const a of [trPosAttr, trBornAttr, trToneAttr]) {
      a.clearUpdateRanges();
      if (!dirtyAll) { const c = a.itemSize; a.addUpdateRange(dirtyFrom * c, (dirtyTo - dirtyFrom + 1) * c); }
      a.needsUpdate = true;
    }
    dirtyFrom = dirtyTo = -1; dirtyAll = false;
  }

  // ─── La nuée ───
  const swarm = createSwarm({ city, capacity: MAX_RATS, onTrace: (wx, wy) => trace(wx, wy, 'neigeO') });
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
  if (testRats > army) army = testRats;
  for (let k = 0; k < Math.min(army, MAX_RATS); k++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.sqrt(k) * 3 * Math.random();
    let px = pierre.x + Math.cos(a) * r, py = pierre.y + Math.sin(a) * r;
    if (blocked(px, py, 2)) { px = pierre.x; py = pierre.y; }
    swarm.add(px, py);
  }

  // ─── Les rats : une seule géométrie, instanciée ───
  const ratGeo = (() => {
    const pos = [], col = [];
    const c = key => { const h = PAL[key]; return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; };
    const part = (w, h, d, x, y, z, key) => {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
      const a = g.attributes.position.array, cc = c(key);
      for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); col.push(...cc); }
    };
    part(6, 3, 3.6, 0, 1.9, 0, 'nuit');          // le corps
    part(3, 2.4, 2.6, 4.2, 1.8, 0, 'nuit');      // la tête
    part(1, 1, 1, 6, 2.2, 0.9, 'nuit');          // le museau et l'oreille
    part(4, 0.8, 2.2, -0.4, 3.5, 0, 'pierreL');  // le dos, plus clair
    part(6, 0.6, 0.6, -5.6, 0.7, 0, 'nuit2');    // la queue
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  })();
  const ratMesh = new THREE.InstancedMesh(ratGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_RATS);
  ratMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ratMesh.frustumCulled = false; ratMesh.count = 0;
  actors.add(ratMesh);
  // les rats derrière un mur, près de Pierre : des points clairs, tramés
  const DITHER = `if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) > 0.5) discard;`;
  const ghostRatMat = new THREE.ShaderMaterial({
    uniforms: { uP: { value: new THREE.Vector2() }, uR: { value: 260 }, uColor: { value: new THREE.Color(PAL.neigeM) } },
    vertexShader: `uniform vec2 uP; uniform float uR; void main() {
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * wp;
      if (distance(wp.xz, uP) > uR) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }`,
    fragmentShader: `uniform vec3 uColor; void main() { ${DITHER} gl_FragColor = vec4(uColor, 1.0); }`,
    depthFunc: THREE.GreaterDepth, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const ghostRats = new THREE.InstancedMesh(ratGeo, ghostRatMat, MAX_RATS);
  ghostRats.instanceMatrix = ratMesh.instanceMatrix;
  ghostRats.frustumCulled = false; ghostRats.count = 0;
  ghostScene.add(ghostRats);
  function updateRatMatrices() {
    const s = swarm.state, n = swarm.count, m = ratMesh.instanceMatrix.array;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(s.vy[i], s.vx[i]), th = -a, rear = s.st[i] === ST.REAR;
      const ct = Math.cos(th), st = Math.sin(th), ph = rear ? 1.1 : 0, cp = Math.cos(ph), sp = Math.sin(ph);
      const o = i * 16;
      m[o] = cp * ct; m[o + 1] = sp; m[o + 2] = -cp * st; m[o + 3] = 0;
      m[o + 4] = -sp * ct; m[o + 5] = cp; m[o + 6] = sp * st; m[o + 7] = 0;
      m[o + 8] = st; m[o + 9] = 0; m[o + 10] = ct; m[o + 11] = 0;
      m[o + 12] = s.x[i]; m[o + 13] = s.z[i] + Math.abs(Math.sin(s.ph[i] * 3)) * 0.8 + (rear ? 0.4 : 0); m[o + 14] = s.y[i]; m[o + 15] = 1;
    }
    ratMesh.count = n; ghostRats.count = n;
    ratMesh.instanceMatrix.clearUpdateRanges();
    ratMesh.instanceMatrix.addUpdateRange(0, n * 16);
    ratMesh.instanceMatrix.needsUpdate = true;
  }

  // ─── Pierre : une silhouette noire, en volumes simples ───
  function makePierre(matBody, matCoat, matFlute) {
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, mat, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const limb = (x, y, w, h, mat) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); g.add(pivot); box(w, h, w * 1.1, 0, -h / 2, 0, mat, pivot); return pivot; };
    const legL = limb(-1.9, 11, 3, 11, matBody), legR = limb(1.9, 11, 3, 11, matBody);
    const torso = box(7.4, 10, 4.4, 0, 16, 0, matCoat);
    const armL = limb(-4.6, 20.4, 2.2, 9, matCoat), armR = limb(4.6, 20.4, 2.2, 9, matCoat);
    const head = new THREE.Group(); head.position.set(0, 21, 0); g.add(head);
    box(4.8, 4.8, 4.8, 0, 2.4, 0, matBody, head);
    box(5.8, 2.2, 5.8, 0, 5.4, 0, matBody, head);        // le bonnet
    box(2.2, 1.2, 2.2, 0, 6.9, 0, matBody, head);
    const flute = box(0.9, 0.9, 9, 1.4, 1.6, 4.6, matFlute, head);   // la flûte, devant la bouche
    flute.rotation.y = 0.35;
    return { g, legL, legR, armL, armR, torso, head, flute };
  }
  const mBody = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.nuit) });
  const mCoat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.nuit2) });
  const mFlute = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.neige) });
  const ghostPierreMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(PAL.ocre) } },
    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; void main() { ${DITHER} gl_FragColor = vec4(uColor, 1.0); }`,
    depthFunc: THREE.GreaterDepth, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const body = makePierre(mBody, mCoat, mFlute), ghost = makePierre(ghostPierreMat, ghostPierreMat, ghostPierreMat);
  actors.add(body.g); ghostScene.add(ghost.g);
  function posePierre(p, t, playingNow) {
    const walk = pierre.moving ? Math.sin(pierre.t * 9) : 0;
    p.g.position.set(pierre.x, 0, pierre.y);
    p.g.rotation.y = pierre.heading;
    p.legL.rotation.x = walk * 0.75; p.legR.rotation.x = -walk * 0.75;
    p.torso.position.y = 16 + (pierre.moving ? Math.abs(walk) * 0.7 : 0);
    if (playingNow) {
      // les deux bras levés vers la flûte, qui tressaute au rythme de l'air
      p.armL.rotation.set(-2.1, 0, -0.5); p.armR.rotation.set(-2.2, 0, 0.5);
      p.head.rotation.x = Math.sin(t * 7) * 0.06; p.head.position.y = 21 + Math.sin(t * 7) * 0.3;
    } else {
      p.armL.rotation.set(-walk * 0.6, 0, 0.06); p.armR.rotation.set(walk * 0.6, 0, -0.06);
      p.head.rotation.x = 0; p.head.position.y = 21;
    }
    p.flute.visible = playingNow;
  }

  // ─── Notes de musique, fumées, neige ───
  const noteTex = [];                                  // [kind][fade 0|1|2]
  for (let kind = 0; kind < 2; kind++) {
    noteTex[kind] = [0, 0.6, 0.9].map(f => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 6;
      drawNote(c.getContext('2d'), 0, 0, kind, f);
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      return t;
    });
  }
  const notes = [];
  const NOTE_POOL = 20;
  const noteSprites = Array.from({ length: NOTE_POOL }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex[0][0], alphaTest: 0.5, depthTest: false }));
    s.scale.set(4, 6, 1); s.visible = false; s.renderOrder = 20;
    actors.add(s);
    return s;
  });
  function emitNote() {
    if (notes.length >= NOTE_POOL) return;
    const ang = pierre.heading;
    notes.push({ x: pierre.x + Math.sin(ang) * 7, y: 29, z: pierre.y + Math.cos(ang) * 7, t: 0, life: 2.2 + Math.random(), kind: Math.random() < 0.3 ? 1 : 0, vx: (Math.random() - 0.5) * 8, vz: (Math.random() - 0.5) * 8, ph: Math.random() * 6 });
  }
  function updateNotes(dt) {
    for (const n of notes) { n.t += dt; n.y += 14 * dt; n.x += n.vx * dt + Math.sin(n.t * 3 + n.ph) * 0.15; n.z += n.vz * dt; }
    while (notes.length && notes[0].t > notes[0].life) notes.shift();
    noteSprites.forEach((s, k) => {
      const n = notes[k];
      s.visible = !!n;
      if (!n) return;
      const f = Math.max(0, (n.t - n.life * 0.55) / (n.life * 0.45));
      s.material.map = noteTex[n.kind][f > 0.8 ? 2 : f > 0.5 ? 1 : 0];
      s.position.set(n.x, n.y, n.z);
    });
  }
  // La fumée des cheminées proches
  const SMOKE = 120;
  const smoke = [];
  const smPos = new Float32Array(SMOKE * 3), smTone = new Float32Array(SMOKE).fill(-1);
  const smGeo = new THREE.BufferGeometry();
  smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3));
  smGeo.setAttribute('tone', new THREE.BufferAttribute(smTone, 1));
  const smMat = new THREE.ShaderMaterial({
    uniforms: { pal: palUniform, palN: { value: PALETTE.length }, size: { value: 2 } },
    vertexShader: `attribute float tone; uniform float size; varying float vTone; void main() { vTone = tone; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = size; if (tone < 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
    fragmentShader: `uniform sampler2D pal; uniform float palN; varying float vTone; void main() { ${DITHER} gl_FragColor = vec4(texture2D(pal, vec2((vTone + 0.5) / palN, 0.5)).rgb, 1.0); }`,
  });
  const smokePoints = new THREE.Points(smGeo, smMat);
  smokePoints.frustumCulled = false;
  scene.add(smokePoints);
  function updateSmoke(dt) {
    if (Math.random() < dt * 8 && smoke.length < SMOKE) {
      const near = world.chimneys.filter(([x, , z]) => Math.abs(x - cam.tx) < 420 && Math.abs(z - cam.tz) < 420);
      if (near.length) {
        const [x, y, z, id] = near[Math.floor(Math.random() * near.length)];
        if (hash(id, 77) < 0.6) smoke.push({ x, y, z, t: 0, life: 3 + Math.random() * 3, id });
      }
    }
    for (const s of smoke) { s.t += dt; s.x += (5 + s.t * 3) * dt; s.y += 9 * dt; s.z += Math.sin(s.t * 1.3 + s.id) * 2 * dt; }
    for (let k = smoke.length - 1; k >= 0; k--) if (smoke[k].t > smoke[k].life) smoke.splice(k, 1);
    for (let k = 0; k < SMOKE; k++) {
      const s = smoke[k];
      if (!s) { smTone[k] = -1; continue; }
      smPos[k * 3] = s.x; smPos[k * 3 + 1] = s.y; smPos[k * 3 + 2] = s.z;
      smTone[k] = palSample(s.t / s.life < 0.4 ? 'neigeM' : 'neigeO');
    }
    smGeo.attributes.position.needsUpdate = true; smGeo.attributes.tone.needsUpdate = true;
  }
  // La neige qui tombe : des points qui tournent autour de la caméra, entièrement dans le shader
  const flPos = new Float32Array(FLAKES * 3), flAux = new Float32Array(FLAKES * 2);
  for (let k = 0; k < FLAKES; k++) {
    flPos[k * 3] = Math.random() * 480; flPos[k * 3 + 1] = Math.random() * 330; flPos[k * 3 + 2] = Math.random() * 480;
    flAux[k * 2] = 10 + Math.random() * 16; flAux[k * 2 + 1] = Math.random() > 0.94 ? 2 : 1;
  }
  const flGeo = new THREE.BufferGeometry();
  flGeo.setAttribute('position', new THREE.BufferAttribute(flPos, 3));
  flGeo.setAttribute('aux', new THREE.BufferAttribute(flAux, 2));
  const flMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Vector3() }, uT: { value: 0 }, uColor: { value: new THREE.Color(PAL.neige) } },
    vertexShader: `attribute vec2 aux; uniform vec3 uC; uniform float uT; void main() {
      vec3 p = position;
      p.y = mod(p.y - uT * aux.x, 330.0);
      p.x += sin(uT * 0.7 + position.z * 0.1) * 5.0 + uT * 3.0;
      vec3 w = vec3(uC.x - 240.0 + mod(p.x - uC.x + 240.0, 480.0), p.y, uC.z - 240.0 + mod(p.z - uC.z + 240.0, 480.0));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
      gl_PointSize = aux.y;
    }`,
    fragmentShader: `uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  });
  const flakes = new THREE.Points(flGeo, flMat);
  flakes.frustumCulled = false;
  scene.add(flakes);

  // ─── Pierre qui marche ───
  function updatePierre(dt) {
    let mx = input.right - input.left, my = input.up - input.down;       // écran : droite, avant
    const fx = -Math.cos(cam.yaw), fz = -Math.sin(cam.yaw);              // vers le fond de la vue, au sol
    let vx = 0, vy = 0;
    if (input.target) {
      const [tx, ty] = input.target;
      const dx = tx - pierre.x, dy = ty - pierre.y, d = Math.hypot(dx, dy);
      if (d < 3) { if (!input.hold) input.target = null; }
      else { vx = dx / d; vy = dy / d; }
    } else if (mx || my) {
      const l = Math.hypot(mx, my); mx /= l; my /= l;
      vx = fx * my - fz * mx; vy = fz * my + fx * mx;
    }
    const speed = (input.run ? RUN : WALK) * (playing ? 0.55 : 1);
    pierre.vx = vx; pierre.vy = vy;
    const ox = pierre.x, oy = pierre.y;
    if (vx || vy) move(pierre, vx * speed * dt, vy * speed * dt, PIERRE_R);
    const moved = Math.hypot(pierre.x - ox, pierre.y - oy);
    pierre.moving = moved > 0.01;
    if (pierre.moving) {
      // il se tourne vers où il va, en douceur
      const want = Math.atan2(vx, vy);
      let d = want - pierre.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      pierre.heading += d * Math.min(1, dt * 12);
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

  // ─── La caméra : libre, autour de Pierre ───
  function placeCamera(dt) {
    cam.yaw += input.rotate * dt * 1.7;
    const tx = attract ? attractPoint.x : pierre.x, tz = attract ? attractPoint.z : pierre.y;
    const k = 1 - Math.exp(-dt * (attract ? 2 : 6));
    cam.tx += (tx - cam.tx) * k; cam.tz += (tz - cam.tz) * k;
    // le zoom et l'inclinaison s'ajustent en douceur (l'accueil prend du recul)
    const kz = 1 - Math.exp(-dt * 3);
    view.ppu += ((attract ? 0.75 : ppu) - view.ppu) * (dt ? kz : 1);
    view.pitch += ((attract ? 0.6 : cam.pitch) - view.pitch) * (dt ? kz : 1);
    // la distance qui donne ppu pixels d'écran par pixel du monde au point visé
    const d = (vh / 2) / (Math.tan(FOV * Math.PI / 360) * view.ppu);
    const cp = Math.cos(view.pitch);
    camera.position.set(cam.tx + Math.cos(cam.yaw) * cp * d, cam.ty + Math.sin(view.pitch) * d, cam.tz + Math.sin(cam.yaw) * cp * d);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.updateMatrixWorld();
    trMat.uniforms.size.value = Math.max(1, Math.round(view.ppu));
    smMat.uniforms.size.value = Math.max(2, Math.round(view.ppu * 2));
  }
  const attractPoint = { x: 0, z: 0 };
  const view = { ppu, pitch: cam.pitch };

  // ─── La boucle ───
  function update(dt) {
    time += dt;
    if (attract) {
      attractT += dt;
      cam.yaw += dt * 0.045;
      const R = CELL * 5, cx = city.w * CELL / 2, cz = city.h * CELL / 2;
      attractPoint.x = cx + Math.cos(attractT * 0.035) * R * 1.6; attractPoint.z = cz + Math.sin(attractT * 0.035 * 0.8) * R;
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
      swarm.update(dt, { x: pierre.x, y: pierre.y, vx: pierre.vx || 0, vy: pierre.vy || 0, playing }, time, 300);
    }
    updateNotes(dt);
    updateSmoke(dt);
  }

  let last = 0, raf = 0;
  const perf = { update: 0, render: 0, rats: 0, cuts: 0, paint: 0 };
  function render(dt) {
    placeCamera(dt);
    let t0 = performance.now();
    world.paintSome(attract ? 5 : 3, attract ? attractPoint.x : pierre.x, attract ? attractPoint.z : pierre.y);
    perf.paint += (performance.now() - t0 - perf.paint) * 0.05; t0 = performance.now();
    const disc = 9 + Math.sqrt(swarm.count * 9 / Math.PI);
    world.updateCuts(camera, attract ? attractPoint.x : pierre.x, attract ? attractPoint.z : pierre.y, Math.max(90, disc * 1.2 + 30), dt, !attract && !sandbox);
    perf.cuts += (performance.now() - t0 - perf.cuts) * 0.05; t0 = performance.now();
    if (!attract) {
      posePierre(body, playing ? time : pierre.t, playing);
      posePierre(ghost, playing ? time : pierre.t, playing);
      updateRatMatrices();
    }
    perf.rats += (performance.now() - t0 - perf.rats) * 0.05;
    body.g.visible = ghost.g.visible = !attract;
    ratMesh.visible = ghostRats.visible = !attract;
    ghostRatMat.uniforms.uP.value.set(pierre.x, pierre.y);
    trMat.uniforms.now.value = time;
    flMat.uniforms.uT.value = time; flMat.uniforms.uC.value.set(cam.tx, 0, cam.tz);
    flushTraces();
    renderer.clear();
    renderer.render(scene, camera);                  // le décor
    if (!attract) renderer.render(ghostScene, camera);   // Pierre et les rats, tramés là où le décor les cache
    renderer.render(actors, camera);                 // Pierre, les rats, les notes
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (paused) return;
    const t0 = performance.now();
    update(dt);
    const t1 = performance.now();
    render(dt);
    perf.update += (t1 - t0 - perf.update) * 0.05;
    perf.render += (performance.now() - t1 - perf.render) * 0.05;
  }

  function factorFor(dw, dh) {
    const auto = Math.max(1, Math.floor(Math.min(dh / VIEW_H, dw / (VIEW_H * 0.66))));
    return Math.max(1, auto + zoomPref);
  }
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const host = canvas.parentElement;
    const cw = host.clientWidth, ch = host.clientHeight;
    const dw = cw * dpr, dh = ch * dpr;
    factor = factorFor(dw, dh);
    vw = Math.max(1, Math.ceil(dw / factor)); vh = Math.max(1, Math.ceil(dh / factor));
    renderer.setSize(vw, vh, false);
    canvas.style.width = (vw * factor / dpr) + 'px';
    canvas.style.height = (vh * factor / dpr) + 'px';
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    if (!paused) render(0);
  }

  // Écran (pixels CSS dans le canvas) → le sol (y = 0), en [x, y] du monde
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function screenToWorld(px, py) {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y > -0.02) return [pierre.x + d.x * 400, pierre.y + d.z * 400];     // au-dessus de l'horizon : au loin
    const t = -o.y / d.y;
    return [o.x + d.x * t, o.z + d.z * t];
  }

  // Une nouvelle partie, ou une partie reprise : le monde reste, Pierre et l'armée repartent
  function reload(fromSave, rats = 0) {
    const s = fromSave && Number.isFinite(fromSave.x) ? [fromSave.x, fromSave.y] : [(city.start[0] + 0.5) * CELL, (city.start[1] + 0.5) * CELL];
    Object.assign(pierre, { x: s[0], y: s[1], vx: 0, vy: 0, heading: Math.PI / 2, moving: false, t: 0, stride: 0 });
    if (solid(pierre.x, pierre.y)) Object.assign(pierre, nearestStreet(pierre.x, pierre.y));
    cam.yaw = fromSave && Number.isFinite(fromSave.yaw) ? fromSave.yaw : Math.PI / 4;
    cam.tx = pierre.x; cam.tz = pierre.y;
    army = fromSave?.rats || 0; playTime = fromSave?.playSeconds || 0; playing = false; callTimer = 1.2;
    input.target = null; input.hold = false;
    swarm.clear(); notes.length = 0; smoke.length = 0;
    trBorn.fill(-1); trHead = 0; trLen = 0; dirtyAll = true; dirtyFrom = 0;
    if (rats > army) army = rats;
    for (let k = 0; k < Math.min(army, MAX_RATS); k++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.sqrt(k) * 3 * Math.random();
      let px = pierre.x + Math.cos(a) * r, py = pierre.y + Math.sin(a) * r;
      if (blocked(px, py, 2)) { px = pierre.x; py = pierre.y; }
      swarm.add(px, py);
    }
    onRats(army);
  }

  resize();
  raf = requestAnimationFrame(frame);
  onProgress('');

  return {
    input, resize, screenToWorld, reload,
    canRotate: true,
    setZoom(z) { zoomPref = z; resize(); },
    orbit(dyaw, dpitch = 0) { cam.yaw += dyaw; cam.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch + dpitch)); },
    zoomBy(k) { ppu = Math.max(PPU_MIN, Math.min(PPU_MAX, ppu * k)); },
    setPlaying(on) {
      if (on && !playing) { emitNote(); if (callTimer > 1.5) callTimer = 1.2; }
      playing = on;
    },
    note: emitNote,
    get playing() { return playing; },
    get army() { return army; },
    get stats() { return { simulated: swarm.count, visible: swarm.count, traces: trLen, ms: { ...perf } }; },
    pause() { paused = true; },
    resume() { paused = false; last = 0; },
    get paused() { return paused; },
    setAttract(on) { attract = on; if (!on) { cam.tx = pierre.x; cam.tz = pierre.y; } },
    snapshot: () => ({ x: Math.round(pierre.x * 10) / 10, y: Math.round(pierre.y * 10) / 10, dir: 1, rats: army, playSeconds: Math.round(playTime), yaw: Math.round(cam.yaw * 100) / 100 }),
    world, renderer, camera, cam, pierre, swarm, city,
    setPpu(v) { ppu = v; },            // pour les essais (hors des bornes du zoom)
    destroy() { cancelAnimationFrame(raf); world.dispose(); renderer.dispose(); },
  };
}
export { tick };
