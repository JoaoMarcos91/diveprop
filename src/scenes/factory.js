// Cenário: Fábrica Abandonada ("bando") — galpão de tijolos com janelas quebradas, treliças,
// telhado com buracos, mezanino, escritório em ruínas, contêineres, tanques e uma chaminé oca
// (dá para mergulhar dentro dela e sair pela porta da base).
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, wall, gableEnd, container, rubble, scatter } from './common.js';

export function buildFactory(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;
  const YARD = { x0: -85, x1: 85, z0: -60, z1: 70 };
  const inYard = (x, z, m = 0) => x > YARD.x0 - m && x < YARD.x1 + m && z > YARD.z0 - m && z < YARD.z1 + m;

  const height = (x, z) => {
    const dx = Math.max(YARD.x0 - x, 0, x - YARD.x1), dz = Math.max(YARD.z0 - z, 0, z - YARD.z1);
    const d = Math.hypot(dx, dz);
    return (fbm(x / 160, z / 160, 4, 5) * 14 + fbm(x / 30, z / 30, 2, 8) * 1.2) * smooth(5, 60, d) - 0.05;
  };
  kit.terrain({
    size: 900, res: 150, height,
    splat: (x, z) => Math.min(1, Math.max(0, fbm(x / 30, z / 30, 3, 2) * 1.2 + 0.25)),
    tint: (x, z) => 0.8 + 0.25 * fbm(x / 60, z / 60, 2, 3),
    texA: 'grass', texB: 'dirt',
  });
  const H = kit.heightAt;

  // pátio de concreto rachado (placas com pequenas diferenças de altura)
  for (let x = YARD.x0; x < YARD.x1; x += 20) {
    for (let z = YARD.z0; z < YARD.z1; z += 20) {
      kit.box('concreteFloor', x + 10, -0.08 + R() * 0.05, z + 10, 19.85, 0.2, 19.85);
    }
  }

  // ---------------------------------------------------------------- galpão principal 60 x 30
  const HX = 30, HZ = 15, EAVE = 11, RISE = 3.5;
  const winRows = [[2.6, 5.6], [7.0, 9.6]];
  wall(kit, 'brick', V(-HX, 0, -HZ), V(HX, 0, -HZ), { h: EAVE, t: 0.45, bay: 6, pillar: 1.4, windows: winRows, ruin: 0.18 });
  wall(kit, 'brick', V(-HX, 0, HZ), V(HX, 0, HZ), { h: EAVE, t: 0.45, bay: 6, pillar: 1.4, windows: winRows, ruin: 0.25, door: { bays: [4], h: 4.5 } });
  wall(kit, 'brick', V(-HX, 0, -HZ), V(-HX, 0, HZ), { h: EAVE, t: 0.45, bay: 7.5, pillar: 1.4, windows: [[7.0, 9.6]], door: { bays: [1, 2], h: 6.5 } });
  wall(kit, 'brick', V(HX, 0, -HZ), V(HX, 0, HZ), { h: EAVE, t: 0.45, bay: 7.5, pillar: 1.4, windows: winRows, door: { bays: [2], h: 5 }, ruin: 0.3 });
  gableEnd(kit, 'brick', -HX, 0, HZ * 2, EAVE, RISE, { t: 0.45, ry: Math.PI / 2 });
  gableEnd(kit, 'brick', HX, 0, HZ * 2, EAVE, RISE, { t: 0.45, ry: Math.PI / 2 });
  // portões de enrolar meio abertos
  kit.box('shutter', -HX - 0.3, 5.2, 0, 0.12, 2.6, 14, { collide: true });

  // treliças a cada 6 m (cumeeira ao longo de X)
  const ang = Math.atan2(RISE, HZ);
  const slopeLen = Math.hypot(HZ, RISE);
  for (let x = -HX + 6; x < HX; x += 6) {
    kit.box('steelRust', x, EAVE, 0, 0.25, 0.3, HZ * 2);                    // banzo inferior
    for (const s of [-1, 1]) {
      kit.box('steelRust', x, EAVE + RISE / 2, s * HZ / 2, 0.25, 0.3, slopeLen, { rx: s * ang }); // banzos superiores
      for (let k = 1; k < 4; k++) {
        const zz = s * HZ * (1 - k / 4);
        const hh = RISE * k / 4;
        kit.box('steelRust', x, EAVE + hh / 2, zz, 0.12, hh, 0.12, { collide: hh > 1 });
      }
    }
  }
  // terças e telhas (com buracos)
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const t = (k + 0.5) / 5;
      const zz = s * HZ * (1 - t), yy = EAVE + RISE * t + 0.3;
      kit.box('steelRust', 0, yy, zz, HX * 2, 0.15, 0.12);
    }
    for (let x = -HX; x < HX; x += 6) {
      for (let k = 0; k < 3; k++) {
        if (R() < 0.32) continue; // buraco no telhado
        const t0 = k / 3, t1 = (k + 1) / 3, tm = (t0 + t1) / 2;
        kit.box('corrugatedRust', x + 3, EAVE + RISE * tm + 0.45, s * HZ * (1 - tm), 6, 0.06, slopeLen / 3, { rx: s * ang, collide: true });
      }
    }
  }
  // pilares internos de aço
  for (let x = -HX + 6; x < HX; x += 12) for (const z of [-5, 5]) kit.box('steel', x, EAVE / 2, z, 0.35, EAVE, 0.35);

  // mezanino (lado leste) com escada e guarda-corpo
  kit.box('concrete', 21, 4.2, 0, 17, 0.35, HZ * 2 - 1);
  for (let x = 13.5; x < 29; x += 5) for (const z of [-7, 7]) kit.box('steel', x, 2.0, z, 0.3, 4.0, 0.3);
  for (let i = 0; i < 12; i++) kit.box('steelRust', 6.2 + i * 0.55, 0.18 + i * 0.35, -12, 0.55, 0.08, 2.0);
  kit.beam('steelRust', V(5.9, 0, -13), V(12.4, 4.1, -13), 0.06);
  kit.beam('steelRust', V(5.9, 0, -11), V(12.4, 4.1, -11), 0.06);
  for (let z = -14; z <= 14; z += 2) kit.box('paintYellow', 12.55, 5.0, z, 0.06, 0.06, 2.0, { collide: false });
  kit.box('paintYellow', 12.55, 5.35, 0, 0.08, 0.08, 29, { collide: true });

  // máquinas, tambores, paletes, pontes rolantes
  for (const [x, z, w, h, d] of [[-18, -6, 4, 2.5, 2.5], [-10, 7, 6, 3.2, 2.2], [-22, 8, 3, 1.8, 3], [2, -8, 5, 2.2, 3]]) {
    kit.box('steelRust', x, h / 2, z, w, h, d);
    kit.box('steel', x, h + 0.25, z, w * 0.6, 0.5, d * 0.5);
  }
  for (let i = 0; i < 14; i++) {
    const x = -28 + R() * 40, z = -13 + R() * 26;
    if (R() < 0.5) kit.cyl('rust', x, 0.45, z, 0.3, 0.3, 0.9, { seg: 10 });
    else kit.cyl('rust', x, 0.3, z, 0.3, 0.3, 0.9, { rz: Math.PI / 2, ry: R() * 3, seg: 10 });
  }
  for (let i = 0; i < 8; i++) kit.box('wood', -6 + R() * 12, 0.08 + (i % 3) * 0.16, -4 + R() * 8, 1.2, 0.14, 1.0, { ry: R() * 0.4 });
  kit.box('paintYellow', 0, EAVE - 1.2, -11, HX * 2 - 2, 0.6, 0.5);   // trilho da ponte rolante
  kit.box('paintYellow', 0, EAVE - 1.2, 11, HX * 2 - 2, 0.6, 0.5);
  kit.box('paintYellow', -8, EAVE - 0.9, 0, 0.8, 0.9, 22);              // ponte rolante
  kit.beam('black', V(-8, EAVE - 1.4, 0), V(-8, 3.5, 0), 0.03);        // cabo
  kit.box('steel', -8, 3.3, 0, 0.5, 0.5, 0.5);                          // gancho

  rubble(kit, -6, HZ + 2.5, 5, 26, () => 0);
  rubble(kit, 18, -HZ - 2.5, 4, 18, () => 0);
  rubble(kit, HX + 2.5, 6, 4, 16, () => 0);
  rubble(kit, 4, 2, 3, 12, () => 0, ['concrete']);

  // ---------------------------------------------------------------- escritório (2 andares) em ruína
  {
    const cx = 52, cz = -12, w = 16, d = 11, fh = 3.6;
    for (let f = 0; f < 2; f++) {
      const y0 = f * fh;
      const opt = { y0, h: fh, t: 0.3, bay: 4, pillar: 1.0, windows: [[0.9, 2.6]], winWidth: 0.7, ruin: f === 1 ? 0.35 : 0.1 };
      wall(kit, 'plasterDamaged', V(cx - w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz - d / 2), opt);
      wall(kit, 'plasterDamaged', V(cx - w / 2, 0, cz + d / 2), V(cx + w / 2, 0, cz + d / 2), { ...opt, door: f === 0 ? { bays: [1], h: 2.4 } : null });
      wall(kit, 'plasterDamaged', V(cx - w / 2, 0, cz - d / 2), V(cx - w / 2, 0, cz + d / 2), opt);
      wall(kit, 'plasterDamaged', V(cx + w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz + d / 2), opt);
      // laje com buraco
      const sy = y0 + fh;
      if (f === 0) {
        kit.box('concrete', cx - 3, sy, cz, w - 6, 0.25, d);
        kit.box('concrete', cx + w / 2 - 1.5, sy, cz - 2.5, 3, 0.25, d - 5);
      }
    }
    wall(kit, 'plasterDamaged', V(cx, 0, cz - d / 2), V(cx, 0, cz + d / 2), { h: fh, t: 0.2, bay: 5.5, pillar: 0.8, door: { bays: [0, 1], h: 2.2 } });
    rubble(kit, cx + 4, cz + 2, 3, 14, () => 0.0, ['concrete', 'plasterDamaged']);
  }

  // ---------------------------------------------------------------- contêineres empilhados
  const colors = ['containerRed', 'containerBlue', 'containerGreen', 'containerOrange'];
  const cBase = [[-58, 22, 0], [-58, 25, 0], [-58, 28, 0], [-50, 36, Math.PI / 2], [-66, 40, 0.15], [-40, 48, 1.2]];
  cBase.forEach(([x, z, ry], i) => {
    container(kit, x, 0, z, ry, colors[i % 4]);
    if (i < 3 && i !== 1) container(kit, x + 0.2, 2.6, z, ry, colors[(i + 2) % 4]);
  });
  container(kit, -58, 5.2, 22, 0, 'containerBlue');

  // ---------------------------------------------------------------- tanques
  for (const z of [-34, -42]) {
    kit.cyl('rust', -10, 2.5, z, 2.0, 2.0, 10, { rz: Math.PI / 2, seg: 16 });
    for (const x of [-14, -6]) kit.box('concrete', x, 0.6, z, 0.8, 1.2, 3.2);
  }
  kit.cyl('rust', 22, 6, -38, 4, 4, 12, { seg: 20 });
  kit.cyl('rust', 22, 12.4, -38, 0.5, 4.1, 1.4, { seg: 20 });
  for (let i = 0; i < 12; i++) kit.box('steel', 26.1, 0.5 + i, -38, 0.05, 0.05, 0.7, { collide: false });
  kit.beam('steelRust', V(18, 9, -38), V(-6, 9, -16), 0.25);            // tubulação aérea
  kit.beam('steelRust', V(-6, 9, -16), V(-6, 0, -16), 0.25);

  // ---------------------------------------------------------------- chaminé de tijolos OCA (50 m)
  // Dá para entrar por cima, mergulhar por dentro e sair pela porta da base (virada para o galpão).
  {
    const CH = { x: -42, z: -36, h: 50, r0: 4.4, r1: 3.2, t: 0.45, doorH: 4.2 };
    const doorAngle = Math.atan2(-CH.z, -CH.x); // aponta para o centro da fábrica
    hollowChimney(kit, CH.x, CH.z, { ...CH, seg: 28, doorAngle, doorSegs: 3 });
    const rAt = y => CH.r0 + (CH.r1 - CH.r0) * y / CH.h;
    // cinta de concreto no topo e cintas de ferro ao longo do fuste
    kit.cyl('concrete', CH.x, CH.h - 0.35, CH.z, CH.r1 + 0.18, rAt(CH.h - 0.7) + 0.18, 0.7, { seg: 28, open: true, collide: false });
    for (let y = 9; y < CH.h - 3; y += 8.5) {
      kit.cyl('steelRust', CH.x, y, CH.z, rAt(y + 0.15) + 0.04, rAt(y - 0.15) + 0.04, 0.3, { seg: 28, open: true, collide: false });
    }
    // para-raios do lado oposto à porta
    const back = doorAngle + Math.PI;
    const bx = Math.cos(back), bz = Math.sin(back);
    kit.beam('steelRust', V(CH.x + bx * (CH.r0 + 0.08), 0.2, CH.z + bz * (CH.r0 + 0.08)), V(CH.x + bx * (CH.r1 + 0.08), CH.h + 1.6, CH.z + bz * (CH.r1 + 0.08)), 0.05, { collide: false });
    // degraus de ferro por dentro (escada de manutenção)
    for (let y = 2; y < CH.h - 1; y += 1.2) {
      const r = rAt(y) - CH.t - 0.12;
      kit.box('steelRust', CH.x + bx * r, y, CH.z + bz * r, 0.06, 0.05, 0.5, { ry: -back, collide: false });
    }
    // tijolos caídos no fundo, longe da porta
    rubble(kit, CH.x + bx * 1.8, CH.z + bz * 1.8, 1.6, 9, () => 0, ['brick']);
  }

  // ---------------------------------------------------------------- muro e postes
  for (const [a, b] of [[V(-85, 0, -60), V(85, 0, -60)], [V(-85, 0, -60), V(-85, 0, 70)], [V(85, 0, -60), V(85, 0, 25)]]) {
    wall(kit, 'concrete', a, b, { h: 2.4, t: 0.25, bay: 6, pillar: 0.5, ruin: 0.2 });
  }
  for (const [x, z] of [[-70, 0], [70, 30], [0, 55], [-30, -50], [40, -50]]) {
    kit.cyl('steel', x, 4.5, z, 0.1, 0.14, 9, { seg: 7 });
    kit.box('steel', x + 0.8, 8.9, z, 1.8, 0.15, 0.3);
  }

  // ---------------------------------------------------------------- vegetação tomando conta
  const trees = [];
  for (const p of scatter(R, Math.round(420 * veg), -450, -450, 450, 450, (x, z) => !inYard(x, z, 6))) trees.push({ ...p, s: 0.8 + R() * 0.7, type: R() < 0.55 ? 'oak' : R() < 0.6 ? 'pine' : 'bush' });
  for (const p of scatter(R, Math.round(70 * veg), YARD.x0, YARD.z0, YARD.x1, YARD.z1, (x, z) => !(Math.abs(x) < HX + 3 && Math.abs(z) < HZ + 3) && !(x > 40 && x < 62 && z > -20 && z < -4) && Math.hypot(x, z - 42) > 10 && Math.hypot(x + 42, z + 36) > 7)) {
    trees.push({ ...p, y: 0, s: 0.5 + R() * 0.7, type: 'bush' });
  }
  trees.push({ x: -20, z: 2, y: 0, s: 0.9, type: 'oak' }, { x: 8, z: 46, y: 0, s: 1.1, type: 'oak' }, { x: -74, z: -20, y: 0, s: 1.2, type: 'oak' });
  kit.trees(trees);
  if (settings.get('graphics.grass')) {
    const pts = scatter(R, Math.round(4000 * veg), -100, -80, 100, 90, (x, z) => !(Math.abs(x) < HX && Math.abs(z) < HZ) && !(x > 42 && x < 62 && z > -19 && z < -5))
      .map(p => ({ ...p, y: inYard(p.x, p.z) ? 0.02 : undefined, s: 0.6 + R() * 0.6 }));
    kit.grass(pts, { dry: 0.6 });
  }

  return {
    spawn: { pos: V(0, 0.25, 42), yaw: 0 },
    pilot: V(4, 0, 46),
    orbit: 55,
  };
}

/**
 * Chaminé tronco-cônica oca: casca externa de tijolo, casca interna com fuligem, borda no topo
 * e uma porta na base (batentes e verga). A mesma geometria vira colisão, então o drone pode
 * cair por dentro e sair pela porta.
 */
function hollowChimney(kit, cx, cz, o) {
  const { h, r0, r1, t, seg, doorAngle, doorSegs, doorH } = o;
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
    kit.addGeometry(g.key, geo, new THREE.Matrix4());
    kit.collider({ type: 'tris', geometry: geo }, 0, 0, 0, null);
  }
}
