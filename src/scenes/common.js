// Peças de construção reutilizadas pelos cenários.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export { V };

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Parede reta de a até b (no plano XZ) dividida em vãos, com janelas, porta e ruína opcional.
 * windows: [[yBase, yTopo], ...] relativos a y0. door: { bays: [i...], h } . ruin: 0..1
 */
export function wall(kit, mat, a, b, o) {
  const { y0 = 0, h, t = 0.35, bay = 6, pillar = 1.2, windows = [], door = null, ruin = 0, rand = kit.rand, collide = true, winFrac = 1 } = o;
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L, ry = Math.atan2(-dz, dx);
  const nb = Math.max(1, Math.round(L / bay)), bw = L / nb;
  const piece = (s0, s1, yA, yB) => {
    if (s1 - s0 < 0.05 || yB - yA < 0.05) return;
    const sm = (s0 + s1) / 2;
    kit.box(mat, a.x + ux * sm, y0 + (yA + yB) / 2, a.z + uz * sm, s1 - s0, yB - yA, t, { ry, collide });
  };
  for (let i = 0; i < nb; i++) {
    const s0 = i * bw, s1 = (i + 1) * bw;
    const ruined = ruin > 0 && rand() < ruin;
    const top = ruined ? h * (0.3 + rand() * 0.5) : h;
    const pTopA = ruined ? Math.min(h, top + rand() * 2) : h;
    const pTopB = ruined ? Math.min(h, top + rand() * 2) : h;
    const p = Math.min(pillar, bw * 0.45);
    piece(s0, s0 + p / 2, 0, pTopA);
    piece(s1 - p / 2, s1, 0, pTopB);
    const o0 = s0 + p / 2, o1 = s1 - p / 2;
    const isDoor = door && door.bays.includes(i);
    let holes = isDoor ? [[0, door.h]] : windows.filter(() => rand() < winFrac);
    // janela mais estreita que o vão: laterais sólidas
    const ww = isDoor ? (o1 - o0) : (o1 - o0) * (o.winWidth ?? 0.75);
    const w0 = (o0 + o1) / 2 - ww / 2, w1 = (o0 + o1) / 2 + ww / 2;
    holes = holes.map(([y1, y2]) => [Math.max(0, y1), Math.min(top, y2)]).filter(([y1, y2]) => y2 > y1);
    // faixas verticais (abaixo/entre/acima das janelas)
    let y = 0;
    for (const [hy0, hy1] of holes) {
      piece(o0, o1, y, hy0);
      piece(o0, w0, hy0, hy1);
      piece(w1, o1, hy0, hy1);
      y = hy1;
    }
    if (ruined) {
      // topo irregular em degraus
      const steps = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < steps; k++) {
        const a0 = o0 + (o1 - o0) * k / steps, a1 = o0 + (o1 - o0) * (k + 1) / steps;
        piece(a0, a1, y, Math.max(y, top - rand() * 1.8));
      }
    } else piece(o0, o1, y, top);
  }
}

/** Telhado de duas águas com a cumeeira ao longo de Z. */
export function gableRoof(kit, mat, cx, cz, w, d, eaveY, rise, o = {}) {
  const { t = 0.15, over = 0.5, holes = 0, segs = 1, rand = kit.rand, collide = true } = o;
  const half = w / 2 + over;
  const ang = Math.atan2(rise, w / 2);
  const len = half / Math.cos(ang);
  const segD = (d + over * 2) / segs;
  const yc = eaveY + (rise - over * Math.tan(ang)) / 2 + t / 2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < segs; i++) {
      if (holes > 0 && rand() < holes) continue;
      const z = cz - d / 2 - over + segD * (i + 0.5);
      kit.box(mat, cx + side * half / 2, yc, z, len, t, segD - 0.02, { rz: -side * ang, collide });
    }
  }
}

/** Oitão (triângulo da parede sob o telhado de duas águas). Plano do triângulo ⟂ Z quando ry=0. */
export function gableEnd(kit, mat, cx, cz, w, eaveY, rise, o = {}) {
  const { t = 0.3, ry = 0 } = o;
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2);
  const k = 1 / kit.lib.tile(mat);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry);
  kit.addGeometry(mat, geo, new THREE.Matrix4().compose(V(cx, eaveY, cz), q, V(1, 1, 1)));
  kit.collider({ type: 'tris', geometry: geo }, cx, eaveY, cz, q);
}

/** Contêiner marítimo de 20 pés. */
export function container(kit, x, y, z, ry, colorKey) {
  kit.box(colorKey, x, y + 1.3, z, 6.06, 2.59, 2.44, { ry });
  // reforços das pontas
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const e of [-1, 1]) kit.box('steel', x + c * e * 3.0, y + 1.3, z - s * e * 3.0, 0.1, 2.62, 2.5, { ry, collide: false });
}

export function car(kit, x, y, z, ry, colorKey) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const off = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
  kit.box(colorKey, x, y + 0.62, z, 4.3, 0.75, 1.8, { ry });
  const [cx, cz] = off(-0.2, 0);
  kit.box('glass', cx, y + 1.25, cz, 2.3, 0.6, 1.62, { ry, collide: true });
  for (const [lx, lz] of [[1.35, 0.85], [1.35, -0.85], [-1.35, 0.85], [-1.35, -0.85]]) {
    const [wx, wz] = off(lx, lz);
    kit.cyl('rubber', wx, y + 0.34, wz, 0.34, 0.34, 0.22, { rx: Math.PI / 2, ry, seg: 10, collide: false });
  }
}

export function fence(kit, a, b, heightAt, o = {}) {
  const { spacing = 2.5, h = 1.3, mat = 'wood', rails = 2 } = o;
  const L = a.distanceTo(b);
  const n = Math.max(1, Math.round(L / spacing));
  const dir = V(b.x - a.x, 0, b.z - a.z).normalize();
  const ry = Math.atan2(-dir.z, dir.x);
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    const gy = heightAt(p.x, p.z);
    kit.box(mat, p.x, gy + h / 2, p.z, 0.12, h, 0.12, { collide: true });
    if (i < n) {
      const q = a.clone().lerp(b, (i + 0.5) / n);
      const gq = heightAt(q.x, q.z);
      for (let r = 0; r < rails; r++) kit.box(mat, q.x, gq + h * (0.4 + r * 0.45), q.z, L / n, 0.08, 0.04, { ry, collide: true });
    }
  }
}

/** Linha de transmissão: postes + 3 fios com catenária (fios têm colisão!). */
export function powerLine(kit, pts, heightAt, o = {}) {
  const { h = 10, sag = 1.6, segs = 8 } = o;
  const tops = [];
  pts.forEach((p, i) => {
    const gy = heightAt(p.x, p.z);
    kit.cyl('wood', p.x, gy + h / 2, p.z, 0.13, 0.17, h, { seg: 7 });
    const next = pts[i + 1] || pts[i - 1];
    const dir = V(next.x - p.x, 0, next.z - p.z).normalize();
    const side = V(-dir.z, 0, dir.x);
    const ry = Math.atan2(-side.z, side.x);
    kit.box('wood', p.x, gy + h - 0.4, p.z, 2.4, 0.14, 0.14, { ry });
    tops.push([-1, 0, 1].map(k => V(p.x + side.x * k * 1.05, gy + h - 0.25, p.z + side.z * k * 1.05)));
  });
  for (let i = 0; i < tops.length - 1; i++) {
    for (let k = 0; k < 3; k++) {
      const A = tops[i][k], B = tops[i + 1][k];
      let prev = A;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const p = A.clone().lerp(B, t);
        p.y -= sag * 4 * t * (1 - t);
        kit.beam('black', prev, p, 0.025, { seg: 4, collide: true });
        prev = p;
      }
    }
  }
}

/** Monte de entulho (caixas tombadas). */
export function rubble(kit, cx, cz, radius, count, heightAt, mats = ['concrete', 'brick']) {
  const r = kit.rand;
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const s = 0.25 + r() * 0.9 * (1 - d / radius * 0.6);
    const gy = heightAt(x, z);
    kit.box(mats[Math.floor(r() * mats.length)], x, gy + s * 0.3, z, s * (1 + r()), s * 0.6, s * (1 + r()), {
      rx: (r() - 0.5) * 0.8, ry: r() * Math.PI, rz: (r() - 0.5) * 0.8, collide: s > 0.5,
    });
  }
}

/** Espalha pontos aceitos por `ok(x,z)` dentro de um retângulo. */
export function scatter(rand, n, x0, z0, x1, z1, ok = () => true, maxTry = 6) {
  const out = [];
  for (let i = 0; i < n * maxTry && out.length < n; i++) {
    const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
    if (ok(x, z)) out.push({ x, z });
  }
  return out;
}

/** Distância de um ponto a um segmento (XZ). */
export function distSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}

export function treeLine(rand, a, b, spacing, jitter, types) {
  const out = [];
  const L = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.floor(L / spacing));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const type = types[Math.floor(rand() * types.length)];
    out.push({
      x: a.x + (b.x - a.x) * t + (rand() - 0.5) * jitter,
      z: a.z + (b.z - a.z) * t + (rand() - 0.5) * jitter,
      s: type === 'bush' ? 1.0 + rand() * 1.2 : 0.8 + rand() * 0.6, type,
    });
  }
  return out;
}

/**
 * Chaminé tronco-cônica oca: casca externa de tijolo, casca interna com fuligem, borda no topo
 * e uma porta na base (batentes e verga). A mesma geometria vira colisão, então o drone pode
 * cair por dentro e sair pela porta.
 */
export function hollowChimney(kit, cx, cz, o) {
  const { h, r0, r1, t, seg, doorAngle, doorSegs, doorH, y0: base = 0 } = o;
  const step = (Math.PI * 2) / seg;
  const d0 = ((Math.round(doorAngle / step - doorSegs / 2) % seg) + seg) % seg;
  const isDoor = i => ((i - d0) % seg + seg) % seg < doorSegs;
  const ys = [0, doorH, h * 0.35, h * 0.7, h];
  const rAt = (y, inner) => r0 + (r1 - r0) * y / h - (inner ? t : 0);
  const slope = (r0 - r1) / h;
  const P = (a, y, inner) => { const r = rAt(y, inner); return new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r); };

  const mk = (key) => ({ key, k: 1 / kit.lib.tile(key), pos: [], nor: [], uv: [], idx: [] });
  const outer = mk('brick'), inner = mk('brickSoot');
  // quadrilátero com normal por vértice; a ordem dos triângulos é corrigida pela normal da face
  const quad = (g, pts, norms, uvs, faceN) => {
    const [a, b, c] = pts;
    const cross = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const order = cross.dot(faceN) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const base = g.pos.length / 3;
    pts.forEach((p, i) => { g.pos.push(p.x, p.y, p.z); g.nor.push(norms[i].x, norms[i].y, norms[i].z); g.uv.push(uvs[i][0] * g.k, uvs[i][1] * g.k); });
    for (const i of order) g.idx.push(base + i);
  };
  const radial = (a, sign) => new THREE.Vector3(Math.cos(a), slope, Math.sin(a)).normalize().multiplyScalar(sign);

  for (let i = 0; i < seg; i++) {
    const a0 = i * step, a1 = (i + 1) * step;
    for (let j = 0; j < ys.length - 1; j++) {
      if (j === 0 && isDoor(i)) continue;
      const y0 = ys[j], y1 = ys[j + 1];
      for (const [g, inn, sign] of [[outer, false, 1], [inner, true, -1]]) {
        const n0 = radial(a0, sign), n1 = radial(a1, sign);
        const pts = [P(a0, y0, inn), P(a1, y0, inn), P(a1, y1, inn), P(a0, y1, inn)];
        const r = rAt(0, inn);
        quad(g, pts, [n0, n1, n1, n0], [[a0 * r, y0], [a1 * r, y0], [a1 * r, y1], [a0 * r, y1]], radial((a0 + a1) / 2, sign));
      }
    }
    // borda do topo
    const up = new THREE.Vector3(0, 1, 0);
    quad(inner, [P(a0, h, false), P(a1, h, false), P(a1, h, true), P(a0, h, true)], [up, up, up, up],
      [[a0 * r1, 0], [a1 * r1, 0], [a1 * r1, t], [a0 * r1, t]], up);
    // verga (parte de baixo da parede acima da porta)
    if (isDoor(i)) {
      const dn = new THREE.Vector3(0, -1, 0);
      quad(inner, [P(a0, doorH, false), P(a1, doorH, false), P(a1, doorH, true), P(a0, doorH, true)], [dn, dn, dn, dn],
        [[a0 * r0, 0], [a1 * r0, 0], [a1 * r0, t], [a0 * r0, t]], dn);
    }
  }
  // batentes da porta
  for (const [a, dir] of [[d0 * step, 1], [(d0 + doorSegs) * step, -1]]) {
    const n = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(dir);
    quad(inner, [P(a, 0, false), P(a, doorH, false), P(a, doorH, true), P(a, 0, true)], [n, n, n, n],
      [[0, 0], [0, doorH], [t, doorH], [t, 0]], n);
  }

  for (const g of [outer, inner]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setIndex(g.idx);
    kit.addGeometry(g.key, geo, new THREE.Matrix4().makeTranslation(0, base, 0));
    kit.collider({ type: 'tris', geometry: geo }, 0, base, 0, null);
  }
}

/**
 * Chaminé de tijolos completa: casca oca com porta, cinta de concreto no topo, cintas de ferro,
 * para-raios, escada de manutenção por dentro e tijolos caídos no fundo.
 */
export function brickChimney(kit, cx, cz, { h, r0, r1, t = 0.45, doorH = 4.2, doorAngle = 0, y0 = 0, seg = 28 }) {
  hollowChimney(kit, cx, cz, { h, r0, r1, t, seg, doorAngle, doorSegs: 3, doorH, y0 });
  const rAt = y => r0 + (r1 - r0) * y / h;
  kit.cyl('concrete', cx, y0 + h - 0.35, cz, r1 + 0.18, rAt(h - 0.7) + 0.18, 0.7, { seg, open: true, collide: false });
  for (let y = 9; y < h - 3; y += 8.5) {
    kit.cyl('steelRust', cx, y0 + y, cz, rAt(y + 0.15) + 0.04, rAt(y - 0.15) + 0.04, 0.3, { seg, open: true, collide: false });
  }
  const back = doorAngle + Math.PI;
  const bx = Math.cos(back), bz = Math.sin(back);
  kit.beam('steelRust', V(cx + bx * (r0 + 0.08), y0 + 0.2, cz + bz * (r0 + 0.08)), V(cx + bx * (r1 + 0.08), y0 + h + 1.6, cz + bz * (r1 + 0.08)), 0.05, { collide: false });
  for (let y = 2; y < h - 1; y += 1.2) {
    const r = rAt(y) - t - 0.12;
    kit.box('steelRust', cx + bx * r, y0 + y, cz + bz * r, 0.06, 0.05, 0.5, { ry: -back, collide: false });
  }
  rubble(kit, cx + bx * 1.8, cz + bz * 1.8, 1.6, 9, () => y0, ['brick']);
}
