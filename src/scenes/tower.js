// Cenário: Prédio Inacabado — esqueleto de concreto de 12 andares, andaime, guindaste de torre,
// prédios vizinhos, ruas e estacionamento. Ótimo para "dives".
import { V, wall, car, scatter } from './common.js';

export function buildTower(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;

  kit.terrain({
    size: 800, res: 60, height: (x, z) => (Math.abs(x) > 180 || Math.abs(z) > 180 ? (Math.max(Math.abs(x), Math.abs(z)) - 180) * 0.08 : 0) - 0.05,
    splat: () => 0.25, tint: () => 0.95, texA: 'grass', texB: 'dirt',
  });
  const H = kit.heightAt;

  // ---------------------------------------------------------------- ruas, calçadas, estacionamento
  for (const [x, z, w, d] of [[0, 52, 360, 12], [0, -52, 360, 12], [-62, 0, 12, 360], [62, 0, 12, 360]]) kit.box('asphalt', x, 0.0, z, w, 0.12, d);
  for (const [x, z, w, d] of [[0, 45, 112, 2.5], [0, -45, 112, 2.5], [-55, 0, 2.5, 92], [55, 0, 2.5, 92]]) kit.box('concrete', x, 0.08, z, w, 0.2, d);
  kit.box('asphalt', 30, 0.02, 22, 40, 0.1, 30);                 // estacionamento
  for (let i = 0; i < 8; i++) kit.box('paintWhite', 13 + i * 4.8, 0.075, 30, 0.12, 0.02, 5, { collide: false });
  for (let i = 0; i < 8; i++) kit.box('paintWhite', 13 + i * 4.8, 0.075, 14, 0.12, 0.02, 5, { collide: false });
  const carColors = ['carRed', 'carGrey', 'carWhite', 'carBlue'];
  for (let i = 0; i < 7; i++) if (R() < 0.75) car(kit, 15.4 + i * 4.8, 0.05, 30, Math.PI / 2, carColors[i % 4]);
  for (let i = 0; i < 7; i++) if (R() < 0.6) car(kit, 15.4 + i * 4.8, 0.05, 14, -Math.PI / 2, carColors[(i + 1) % 4]);
  car(kit, -30, 0.05, 50, 0, 'carGrey');
  car(kit, 20, 0.05, -54, Math.PI, 'carWhite');

  // ---------------------------------------------------------------- esqueleto de concreto
  const FLOORS = 12, FH = 3.2;
  const xs = [-12, -4, 4, 12], zs = [-8, 0, 8];
  kit.box('concrete', 0, 0.1, 0, 26, 0.3, 18);
  for (let f = 1; f <= FLOORS; f++) {
    const y = f * FH;
    const partial = f >= FLOORS - 1;
    // laje com buraco da escada (x -4..0, z -8..-3)
    if (!partial) {
      kit.box('concreteForm', 2, y, 0, 20.4, 0.25, 16.4);
      kit.box('concreteForm', -8.1, y, 0, 8.2 - 0.2, 0.25, 16.4);
      kit.box('concreteForm', -2, y, 2.6, 4, 0.25, 11.2);
      kit.box('concreteForm', 0, y + 0.35, -8.2, 24.4, 0.45, 0.4);   // vigas de borda
      kit.box('concreteForm', 0, y + 0.35, 8.2, 24.4, 0.45, 0.4);
    } else if (f === FLOORS - 1) {
      kit.box('concreteForm', 6, y, 0, 12.4, 0.25, 16.4);
    }
    for (const x of xs) for (const z of zs) {
      if (f === FLOORS && x < 0) continue;
      const colH = f === FLOORS ? 1.4 : FH - 0.25;
      kit.box('concreteForm', x, y - FH + 0.125 + colH / 2 + 0.125, z, 0.5, colH, 0.5);
      if (f === FLOORS || (f === FLOORS - 1 && x < 0)) {
        // vergalhões espetados
        const top = y - FH + 0.25 + colH;
        for (const [ox, oz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
          kit.beam('steelRust', V(x + ox, top, z + oz), V(x + ox + (R() - 0.5) * 0.3, top + 1.0 + R() * 0.6, z + oz + (R() - 0.5) * 0.3), 0.012, { seg: 4, collide: false });
        }
      }
    }
  }
  // poço da escada
  for (let f = 0; f < FLOORS - 1; f++) {
    const y0 = f * FH + 0.25;
    wall(kit, 'concrete', V(-4.2, 0, -8.2), V(-4.2, 0, -2.8), { y0, h: FH - 0.25, t: 0.2, bay: 5.4, pillar: 0.6, door: f % 2 ? { bays: [0], h: 2.2 } : null });
    wall(kit, 'concrete', V(0.2, 0, -8.2), V(0.2, 0, -2.8), { y0, h: FH - 0.25, t: 0.2, bay: 5.4, pillar: 0.6 });
    for (let s = 0; s < 9; s++) kit.box('concrete', -2.0, y0 + s * (FH / 9), -7.6 + s * 0.52, 3.6, 0.2, 0.52);
  }
  // alvenaria nos primeiros andares
  for (let f = 0; f < 3; f++) {
    const y0 = f * FH + 0.25;
    wall(kit, 'brick', V(-12.3, 0, 8.3), V(12.3, 0, 8.3), { y0, h: FH - 0.5, t: 0.2, bay: 4, pillar: 0.6, windows: [[0.9, 2.2]], winWidth: 0.7, ruin: 0.15 });
    wall(kit, 'brick', V(12.3, 0, -8.3), V(12.3, 0, 8.3), { y0, h: FH - 0.5, t: 0.2, bay: 4, pillar: 0.6, windows: [[0.9, 2.2]], winWidth: 0.7 });
  }
  // andaime na fachada norte (z = -9.5)
  for (let x = -12; x <= 12; x += 3) kit.beam('steel', V(x, 0, -9.6), V(x, FH * 8, -9.6), 0.03, { seg: 5 });
  for (let x = -12; x <= 12; x += 3) kit.beam('steel', V(x, 0, -10.8), V(x, FH * 8, -10.8), 0.03, { seg: 5 });
  for (let f = 1; f <= 8; f++) {
    const y = f * FH - 0.6;
    kit.box('wood', 0, y, -10.2, 24.4, 0.06, 1.1);
    kit.beam('steel', V(-12, y + 1, -10.8), V(12, y + 1, -10.8), 0.025, { seg: 4 });
    if (f % 2) kit.beam('steel', V(-12, y - FH + 0.6, -10.8), V(-9, y, -10.8), 0.02, { seg: 4, collide: false });
  }
  // pilhas de material no térreo
  for (let i = 0; i < 6; i++) kit.box('wood', -18 + i * 0.1, 0.15 + i * 0.12, 12, 4, 0.12, 1.2);
  for (let i = 0; i < 3; i++) kit.cyl('concreteForm', 18, 0.6, -14 + i * 1.3, 0.6, 0.6, 1.0, { rz: Math.PI / 2, seg: 12 });
  kit.box('containerOrange', -20, 1.3, -16, 6.06, 2.59, 2.44);

  // ---------------------------------------------------------------- guindaste de torre
  {
    const cx = 22, cz = -4, top = 56, s = 0.9;
    const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
    for (const [ox, oz] of corners) kit.beam('paintYellow', V(cx + ox, 0, cz + oz), V(cx + ox, top, cz + oz), 0.07, { square: true });
    for (let y = 0; y < top; y += 2.5) {
      for (let k = 0; k < 4; k++) {
        const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
        kit.beam('paintYellow', V(cx + ax, y, cz + az), V(cx + bx, y + 2.5, cz + bz), 0.03, { square: true, collide: true });
      }
    }
    kit.box('concrete', cx, 0.6, cz, 4, 1.2, 4);
    kit.box('paintYellow', cx, top + 0.4, cz, 2.4, 0.8, 2.4);
    kit.box('glass', cx + 1.5, top - 1.2, cz + 0.4, 1.6, 2.0, 1.6);
    // lança (para -X, por cima do prédio) e contra-lança
    const jib = 46;
    for (const oz of [-0.6, 0.6]) kit.beam('paintYellow', V(cx, top + 0.8, cz + oz), V(cx - jib, top + 0.8, cz + oz), 0.05, { square: true });
    kit.beam('paintYellow', V(cx, top + 2.2, cz), V(cx - jib, top + 1.4, cz), 0.05, { square: true });
    for (let x = 0; x < jib; x += 2.5) {
      kit.beam('paintYellow', V(cx - x, top + 0.8, cz - 0.6), V(cx - x - 1.25, top + 2.2 - x * 0.017, cz), 0.02, { square: true, collide: false });
      kit.beam('paintYellow', V(cx - x, top + 0.8, cz + 0.6), V(cx - x - 1.25, top + 2.2 - x * 0.017, cz), 0.02, { square: true, collide: false });
    }
    for (const oz of [-0.6, 0.6]) kit.beam('paintYellow', V(cx, top + 0.8, cz + oz), V(cx + 14, top + 0.8, cz + oz), 0.06, { square: true });
    kit.box('concrete', cx + 12, top - 0.4, cz, 2.5, 2.4, 1.6);
    kit.box('paintYellow', cx, top + 4.5, cz, 0.6, 7, 0.6);
    kit.beam('black', V(cx, top + 8, cz), V(cx - jib, top + 1.6, cz), 0.025, { seg: 4 });
    kit.beam('black', V(cx, top + 8, cz), V(cx + 13, top + 1, cz), 0.025, { seg: 4 });
    // carrinho, cabo e gancho
    const hx = cx - 30;
    kit.box('steel', hx, top + 0.4, cz, 1.2, 0.5, 1.4);
    kit.beam('black', V(hx, top + 0.2, cz), V(hx, 14, cz), 0.03, { seg: 4 });
    kit.box('paintYellow', hx, 13.6, cz, 0.8, 0.8, 0.5);
  }

  // ---------------------------------------------------------------- vizinhos
  const blocks = [
    [-95, -95, 40, 26, 30, 'facadeA'], [-95, -20, 40, 38, 20, 'facadeB'], [-95, 60, 40, 30, 48, 'facadeC'],
    [95, -90, 40, 34, 22, 'facadeB'], [95, -10, 40, 30, 36, 'facadeA'], [95, 75, 40, 40, 16, 'facadeC'],
    [0, -100, 70, 34, 26, 'facadeC'], [-20, 100, 50, 34, 40, 'facadeA'], [45, 105, 30, 30, 18, 'facadeB'],
  ];
  for (const [x, z, w, d, h, mat] of blocks) {
    kit.box(mat, x, h / 2, z, w, h, d);
    kit.box('concrete', x, h + 0.4, z, w + 0.4, 0.8, d + 0.4);
    kit.box('steel', x + (R() - 0.5) * w * 0.5, h + 1.6, z + (R() - 0.5) * d * 0.5, 3, 1.6, 2);
  }
  // postes de luz
  for (let x = -50; x <= 50; x += 20) for (const z of [46.5, -46.5]) {
    kit.cyl('steel', x, 4, z, 0.08, 0.12, 8, { seg: 6 });
    kit.box('steel', x, 7.9, z + (z > 0 ? 0.8 : -0.8), 0.2, 0.15, 1.6);
  }

  // ---------------------------------------------------------------- vegetação
  const trees = [];
  for (let x = -48; x <= 48; x += 12) for (const z of [47.5, -47.5]) trees.push({ x: x + 6, z, y: 0.1, s: 0.75 + R() * 0.3, type: 'oak' });
  for (const p of scatter(R, Math.round(160 * veg), -380, -380, 380, 380, (x, z) => Math.abs(x) > 130 || Math.abs(z) > 130)) trees.push({ ...p, s: 0.9 + R() * 0.6, type: R() < 0.6 ? 'oak' : 'pine' });
  for (const p of scatter(R, Math.round(30 * veg), -50, -40, 50, 40, (x, z) => (Math.abs(x) > 16 || Math.abs(z) > 12) && !(x > 8 && x < 52 && z > 5 && z < 40) && Math.hypot(x - 22, z + 4) > 4)) trees.push({ ...p, y: 0, s: 0.5 + R() * 0.6, type: 'bush' });
  kit.trees(trees);
  if (settings.get('graphics.grass')) {
    const pts = scatter(R, Math.round(2500 * veg), -50, -42, 50, 42, (x, z) => (Math.abs(x) > 14 || Math.abs(z) > 10) && !(x > 9 && x < 51 && z > 6 && z < 38))
      .map(p => ({ ...p, y: 0, s: 0.6 + R() * 0.6 }));
    kit.grass(pts, { dry: 0.3 });
  }

  return {
    spawn: { pos: V(-20, 0.3, 28), yaw: 0.35 },
    pilot: V(-24, 0, 32),
    orbit: 70,
  };
}
