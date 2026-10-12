/* La nuée de rats : une simulation de foule pensée pour des milliers
   d'individus (à la Plague Tale).

   - Données en tableaux typés (une « structure de tableaux ») : pas d'objet
     par rat, pas de ramasse-miettes, des boucles serrées.
   - Voisinage par grille spatiale (cases de GRID px), reconstruite à chaque
     image par tri par comptage : O(n), et chaque rat ne regarde que les
     quelques voisins des 3 × 3 cases autour de lui (MAX_NEIGH au plus).
   - Pilotage à la Reynolds : séparation, alignement, errance, plus un but :
     loin de Pierre, la pente d'une carte des distances calculée sur les
     cases de rue (un champ de vecteurs, recalculé seulement quand Pierre
     change de case) ; près de lui, une place dans un disque qui tourne
     autour de lui et se décale derrière quand il marche.
   - Une petite machine à états par rat : course, va-et-vient, dressé,
     saut, demi-tour, toilette. Les rats ne s'arrêtent presque jamais.
   - Là où la foule est dense, ils se montent dessus (une hauteur z).
   - Rendu : poses pré-rendues (rat-sprites.js), un drawImage par rat
     visible, rangés par diagonale pour s'intercaler entre les maisons.
     Les pixels des rats sont écrits directement dans un tampon (Uint32), puis
     envoyés d'un coup par diagonale (le rectangle qu'ils occupent) : aucun
     appel de dessin par rat. */
import { CELL } from './scale.js?v=1.4.1';
import { PIX } from './rat-sprites.js?v=1.4.1';

const GRID = 8;               // px : taille des cases de voisinage
const SEP_R = 5;              // px : distance de séparation
const ALIGN_R = 10;           // px : distance d'alignement
const MAX_NEIGH = 10;
const RAT_R = 1.5;
const GRAVITY = 340;

export const ST = { RUN: 0, MILL: 1, REAR: 2, JUMP: 3, TURN: 4, CURL: 5 };

export function createSwarm({ city, capacity = 4000, onTrace = () => {} }) {
  const W = city.w * CELL, H = city.h * CELL;
  const x = new Float32Array(capacity), y = new Float32Array(capacity);
  const vx = new Float32Array(capacity), vy = new Float32Array(capacity);
  const z = new Float32Array(capacity), vz = new Float32Array(capacity);
  const spd = new Float32Array(capacity), ph = new Float32Array(capacity);
  const rnd = new Float32Array(capacity), wa = new Float32Array(capacity);
  const tm = new Float32Array(capacity), stride = new Float32Array(capacity);
  const ring = new Float32Array(capacity);
  const st = new Uint8Array(capacity), face = new Int8Array(capacity), foot = new Uint8Array(capacity);
  const orbit = new Int8Array(capacity);
  let n = 0;

  // ─── La grille de voisinage ───
  const gw = Math.ceil(W / GRID), gh = Math.ceil(H / GRID);
  const cellCount = new Int32Array(gw * gh), cellStart = new Int32Array(gw * gh + 1);
  const sorted = new Int32Array(capacity), cellOf = new Int32Array(capacity);
  function buildGrid() {
    cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(gw - 1, Math.max(0, (x[i] / GRID) | 0));
      const cy = Math.min(gh - 1, Math.max(0, (y[i] / GRID) | 0));
      const c = cy * gw + cx;
      cellOf[i] = c; cellCount[c]++;
    }
    let s = 0;
    for (let c = 0; c < gw * gh; c++) { cellStart[c] = s; s += cellCount[c]; }
    cellStart[gw * gh] = s;
    cellCount.fill(0);
    for (let i = 0; i < n; i++) { const c = cellOf[i]; sorted[cellStart[c] + cellCount[c]++] = i; }
  }

  // ─── Le champ de vecteurs vers Pierre ───
  const cells = city.w * city.h;
  const dist = new Int16Array(cells), flowX = new Float32Array(cells), flowY = new Float32Array(cells);
  let flowFrom = -1;
  const open = (i, j) => city.walk(i, j);
  function updateFlow(px, py) {
    const pi = (px / CELL) | 0, pj = (py / CELL) | 0, k = pj * city.w + pi;
    if (k === flowFrom) return;
    flowFrom = k;
    dist.fill(-1);
    const q = [k]; dist[k] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], ci = c % city.w, cj = (c - ci) / city.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!open(ci + dx, cj + dy)) continue;
        const m = (cj + dy) * city.w + ci + dx;
        if (dist[m] >= 0) continue;
        dist[m] = dist[c] + 1; q.push(m);
      }
    }
    // Le vecteur de chaque case : vers les voisines plus proches de Pierre
    // (les diagonales seulement si les deux côtés sont ouverts, pour ne pas couper les coins)
    for (let c = 0; c < cells; c++) {
      flowX[c] = 0; flowY[c] = 0;
      const d = dist[c];
      if (d <= 0) continue;
      const ci = c % city.w, cj = (c - ci) / city.w;
      let sx = 0, sy = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!open(ci + dx, cj + dy)) continue;
        if (dx && dy && (!open(ci + dx, cj) || !open(ci, cj + dy))) continue;
        const nd = dist[(cj + dy) * city.w + ci + dx];
        if (nd < 0 || nd >= d) continue;
        const w = (d - nd) / Math.hypot(dx, dy);
        sx += dx * w; sy += dy * w;
      }
      const l = Math.hypot(sx, sy) || 1;
      flowX[c] = sx / l; flowY[c] = sy / l;
    }
  }

  const solid = (wx, wy) => !city.walk(Math.floor(wx / CELL), Math.floor(wy / CELL));
  const blocked = (px, py) => solid(px - RAT_R, py - RAT_R) || solid(px + RAT_R, py - RAT_R) || solid(px - RAT_R, py + RAT_R) || solid(px + RAT_R, py + RAT_R);

  function add(px, py) {
    if (n >= capacity) return false;
    const i = n++;
    x[i] = px; y[i] = py; vx[i] = 0; vy[i] = 0; z[i] = 0; vz[i] = 0;
    rnd[i] = Math.random();
    spd[i] = 48 + rnd[i] * 34;
    ph[i] = Math.random() * 10; wa[i] = Math.random() * Math.PI * 2;
    // une place dans le disque autour de Pierre : les derniers venus au bord
    ring[i] = 9 + Math.sqrt(i * 9 / Math.PI) * (0.85 + Math.random() * 0.3);
    st[i] = ST.RUN; tm[i] = 0; face[i] = Math.random() < 0.5 ? 1 : -1;
    orbit[i] = Math.random() < 0.5 ? 1 : -1;
    stride[i] = Math.random() * 5;
    return true;
  }

  /* Une image de simulation. p : { x, y, vx, vy, playing }, view : le
     rectangle visible en monde (pour ne laisser des traces que là). */
  function update(dt, p, time, traceBudget = 400) {
    if (!n) return;
    updateFlow(p.x, p.y);
    buildGrid();
    const pMoving = Math.hypot(p.vx, p.vy) > 0.1;
    // Le centre de la nuée : derrière Pierre quand il marche, sur lui quand il joue
    const disc = 9 + Math.sqrt(n * 9 / Math.PI);
    const back = pMoving && !p.playing ? disc * 0.55 + 10 : 0;
    const cx0 = p.x - p.vx * back, cy0 = p.y - p.vy * back;
    const squeeze = p.playing ? 0.8 : 1;
    let traces = 0;

    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i];
      // ─ Voisins ─
      let sepX = 0, sepY = 0, alX = 0, alY = 0, nAl = 0, close = 0, seen = 0;
      const gcx = cellOf[i] % gw, gcy = (cellOf[i] - gcx) / gw;
      for (let oy = -1; oy <= 1 && seen < MAX_NEIGH; oy++) {
        const yy = gcy + oy; if (yy < 0 || yy >= gh) continue;
        for (let ox = -1; ox <= 1 && seen < MAX_NEIGH; ox++) {
          const xx = gcx + ox; if (xx < 0 || xx >= gw) continue;
          const c = yy * gw + xx;
          for (let s = cellStart[c], e = cellStart[c + 1]; s < e && seen < MAX_NEIGH; s++) {
            const j = sorted[s]; if (j === i) continue;
            const dx = xi - x[j], dy = yi - y[j], d2 = dx * dx + dy * dy;
            if (d2 > ALIGN_R * ALIGN_R) continue;
            seen++;
            if (d2 < SEP_R * SEP_R) {
              const d = Math.sqrt(d2) || 0.01, k = (SEP_R - d) / SEP_R / d;
              sepX += dx * k; sepY += dy * k;
              if (d2 < 6.25) close++;
            }
            alX += vx[j]; alY += vy[j]; nAl++;
          }
        }
      }

      // ─ But ─
      const dxp = p.x - xi, dyp = p.y - yi, dp = Math.hypot(dxp, dyp) || 0.01;
      const ci = (xi / CELL) | 0, cj = (yi / CELL) | 0, cc = cj * city.w + ci;
      const fd = ci >= 0 && cj >= 0 && ci < city.w && cj < city.h ? dist[cc] : -1;
      let gx, gy;
      const far = dp > disc + 30 || fd < 0 || fd > Math.ceil((disc + 30) / CELL) + 1;
      if (far && fd > 0) { gx = flowX[cc]; gy = flowY[cc]; }
      else if (far) { gx = dxp / dp; gy = dyp / dp; }
      if (far) {
        if (st[i] === ST.MILL) st[i] = ST.RUN;
      } else {
        if (st[i] === ST.RUN) st[i] = ST.MILL;
        // une place dans le disque : on y tourne, on s'en écarte, on y revient
        const ex = cx0 - xi, ey = cy0 - yi, de = Math.hypot(ex, ey) || 0.01;
        const want = ring[i] * squeeze;
        const radial = Math.max(-1, Math.min(1, (de - want) / 8));
        const tang = 0.55 + 0.35 * Math.sin(time * 0.7 + rnd[i] * 20);
        gx = ex / de * radial + (-ey / de) * orbit[i] * tang;
        gy = ey / de * radial + (ex / de) * orbit[i] * tang;
      }

      // un cercle libre autour de Pierre, pour qu'on le voie dans la masse
      if (dp < 9) { gx -= dxp / dp * (9 - dp) * 0.6; gy -= dyp / dp * (9 - dp) * 0.6; }

      // ─ Errance : un cap qui dérive sans cesse ─
      wa[i] += (Math.sin(time * (1.3 + rnd[i]) + i) * 3 + (Math.random() - 0.5) * 4) * dt;
      const wanderW = st[i] === ST.RUN ? 0.35 : 0.8;

      // ─ États ─
      tm[i] -= dt;
      let s = st[i];
      if (s === ST.REAR || s === ST.CURL || s === ST.TURN) {
        if (tm[i] <= 0) s = st[i] = far ? ST.RUN : ST.MILL;
      }
      if (s === ST.MILL) {
        const r = Math.random();
        if (r < dt * 0.10) { st[i] = ST.REAR; tm[i] = 0.35 + Math.random() * 0.6; }
        else if (r < dt * 0.18) { st[i] = ST.JUMP; vz[i] = 45 + Math.random() * 30; }
        else if (r < dt * 0.33) { st[i] = ST.TURN; tm[i] = 0.25 + Math.random() * 0.35; }
        else if (r < dt * 0.35) { st[i] = ST.CURL; tm[i] = 0.4 + Math.random() * 0.5; }
      } else if (s === ST.RUN && Math.random() < dt * 0.06) { st[i] = ST.JUMP; vz[i] = 40 + Math.random() * 25; }
      s = st[i];

      // ─ Vitesse voulue ─
      let dx, dy;
      if (s === ST.REAR || s === ST.CURL) { dx = 0; dy = 0; }
      else {
        dx = gx * 1.0 + sepX * 2.4 + Math.cos(wa[i]) * wanderW;
        dy = gy * 1.0 + sepY * 2.4 + Math.sin(wa[i]) * wanderW;
        if (nAl) { dx += alX / nAl / 80 * 0.35; dy += alY / nAl / 80 * 0.35; }
        if (s === ST.TURN) { dx = -vx[i] - dx * 0.2; dy = -vy[i] - dy * 0.2; }
        const l = Math.hypot(dx, dy) || 1;
        // des à-coups : une course, un ralenti, une course
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(time * (2.2 + rnd[i] * 2.5) + rnd[i] * 9));
        const sp = spd[i] * (far ? 1.3 : 0.55 + 0.45 * pulse) * (s === ST.JUMP ? 1.2 : 1);
        dx = dx / l * sp; dy = dy / l * sp;
      }
      const k = Math.min(1, dt * (s === ST.TURN ? 12 : 7));
      vx[i] += (dx - vx[i]) * k; vy[i] += (dy - vy[i]) * k;

      // ─ Déplacement, en glissant le long des murs ─
      const mx = vx[i] * dt, my = vy[i] * dt;
      let nx = xi + mx, ny = yi + my, hit = 0;
      if (blocked(nx, yi)) { nx = xi; vx[i] *= -0.3; hit++; }
      if (blocked(nx, ny)) { ny = yi; vy[i] *= -0.3; hit++; }
      x[i] = nx; y[i] = ny;
      if (hit === 2 && s !== ST.TURN) { st[i] = ST.TURN; tm[i] = 0.3; }

      // ─ Hauteur : sauts, et la pile là où c'est serré ─
      const pile = Math.min(5, Math.max(0, close - 2) * 1.4);
      if (s === ST.JUMP) {
        vz[i] -= GRAVITY * dt; z[i] += vz[i] * dt;
        if (z[i] <= pile && vz[i] < 0) { z[i] = pile; st[i] = far ? ST.RUN : ST.MILL; }
      } else z[i] += (pile - z[i]) * Math.min(1, dt * 6);

      // ─ Animation et traces ─
      const moved = Math.hypot(nx - xi, ny - yi);
      ph[i] += moved * 0.22 + dt * 2;
      const svx = vx[i] - vy[i];
      if (svx > 4) face[i] = 1; else if (svx < -4) face[i] = -1;
      stride[i] += moved;
      if (stride[i] > 5 && z[i] < 0.5) {
        stride[i] = 0; foot[i] ^= 1;
        if (traces < traceBudget) {
          traces++;
          const l = moved || 1, side = foot[i] ? 1 : -1;
          onTrace(nx - (ny - yi) / l * side, ny + (nx - xi) / l * side);
        }
      }
    }
  }

  // ─── Rendu : tous les rats visibles, écrits pixel par pixel dans un tampon ───
  let rw = 0, rh = 0, rCanvas = null, rCtx = null, rImg = null, rBuf = null;
  function ensureRaster(vw, vh) {
    if (vw === rw && vh === rh) return;
    rw = vw; rh = vh;
    rCanvas = document.createElement('canvas'); rCanvas.width = vw; rCanvas.height = vh;
    rCtx = rCanvas.getContext('2d');
    rImg = rCtx.createImageData(vw, vh);
    rBuf = new Uint32Array(rImg.data.buffer);
  }
  function poseOf(i, time) {
    const f = face[i] < 0 ? 1 : 0, state = st[i];
    if (state === ST.REAR) return PIX.rear[((time * 5 + rnd[i] * 7) | 0) % 2][f];
    if (state === ST.CURL) return PIX.curl[0][f];
    if (state === ST.JUMP && z[i] > 1.5) return PIX.jump[0][f];
    const svx = vx[i] - vy[i], svy = (vx[i] + vy[i]) / 2, fr = ph[i] | 0;
    if (Math.abs(svy) > Math.abs(svx) * 1.1 && Math.abs(svy) > 3) return (svy > 0 ? PIX.down : PIX.up)[fr % 2][0];
    return PIX.side[fr % 3][f];
  }
  // L'ordre de dessin : de l'arrière vers l'avant (tri par comptage sur y écran),
  // ceux qui sont montés sur les autres un peu plus tard
  const rowCount = new Int32Array(4096), order = new Int32Array(capacity), keyOfRat = new Int32Array(capacity);
  let nVisible = 0;

  /* Dessine la nuée par-dessus la scène. occl : le tampon de profondeur des
     maisons (scene.depthMap) ; faded : les colonnes estompées (indice + 1),
     à travers lesquelles on voit les rats ; hole : la silhouette de Pierre
     ({ data, x, y, w, h, sy }), que les rats placés derrière lui ne
     recouvrent pas. */
  function draw(ctx, camX, camY, vw, vh, time, occl, hole, faded) {
    ensureRaster(vw, vh);
    nVisible = 0;
    rowCount.fill(0, 0, vh + 32);
    for (let i = 0; i < n; i++) {
      const sx = x[i] - y[i] - camX, sy = (x[i] + y[i]) / 2 - camY;
      if (sx < -8 || sx > vw + 8 || sy < -2 || sy > vh + 10) continue;
      const k = Math.max(0, Math.min(vh + 31, (sy + (z[i] >= 1 ? 2 : 0)) | 0));
      keyOfRat[i] = k; rowCount[k]++;
      visible[nVisible++] = i;
    }
    let acc = 0;
    for (let k = 0; k < vh + 32; k++) { const c = rowCount[k]; rowCount[k] = acc; acc += c; }
    for (let v = 0; v < nVisible; v++) { const i = visible[v]; order[rowCount[keyOfRat[i]]++] = i; }

    const { depth, diagOf, DX, DY, DW, DH } = occl;
    const ox = Math.round(camX) + DX, oy = Math.round(camY) + DY;
    let bx0 = rw, by0 = rh, bx1 = -1, by1 = -1;
    for (let v = 0; v < nVisible; v++) {
      const i = order[v];
      const d0 = ((x[i] / CELL) | 0) + ((y[i] / CELL) | 0);
      const fy = (x[i] + y[i]) / 2 - camY;
      const sx = Math.round(x[i] - y[i] - camX), sy = Math.round(fy - z[i]);
      const behind = hole && fy < hole.sy;
      const px = poseOf(i, time);
      for (let k = 0; k < px.length; k += 3) {
        const X = sx + (px[k] | 0), Y = sy + (px[k + 1] | 0);
        if (X < 0 || Y < 0 || X >= rw || Y >= rh) continue;
        // caché par une maison plus en avant ?
        const WX = X + ox, WY = Y + oy;
        if (WX >= 0 && WY >= 0 && WX < DW && WY < DH) {
          const id = depth[WY * DW + WX];
          if (id && diagOf[id] > d0 && !(faded && faded.has(id))) continue;
        }
        // derrière Pierre ?
        if (behind) {
          const hx = X - hole.x, hy = Y - hole.y;
          if (hx >= 0 && hy >= 0 && hx < hole.w && hy < hole.h && hole.data[(hy * hole.w + hx) * 4 + 3]) continue;
        }
        rBuf[Y * rw + X] = px[k + 2];
        if (X < bx0) bx0 = X; if (X > bx1) bx1 = X;
        if (Y < by0) by0 = Y; if (Y > by1) by1 = Y;
      }
    }
    if (bx1 < 0) return;
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    rCtx.putImageData(rImg, 0, 0, bx0, by0, bw, bh);
    ctx.drawImage(rCanvas, bx0, by0, bw, bh, bx0, by0, bw, bh);
    for (let Y = by0; Y <= by1; Y++) rBuf.fill(0, Y * rw + bx0, Y * rw + bx1 + 1);
  }
  const visible = new Int32Array(capacity);

  return {
    add, update, draw,
    get count() { return n; },
    // l'état brut, en lecture (le prototype 3D du labo dessine les rats lui-même)
    get state() { return { x, y, vx, vy, z, st, ph }; },
    get visibleCount() { return nVisible; },
    capacity,
  };
}
