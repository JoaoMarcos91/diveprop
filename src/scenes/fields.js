// Cenário: Campos e Árvores — fazenda, sebes, floresta de pinheiros, estrada de terra,
// celeiro vazado, silo, fardos de feno, linha de transmissão e um lago.
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, wall, gableRoof, gableEnd, fence, powerLine, scatter, distSeg, treeLine } from './common.js';

const roadZ = x => 32 + 38 * Math.sin(x / 140) + 10 * Math.sin(x / 47);
const POND = { x: 150, z: 110, r: 28 };
const FOREST = { x: -230, z: -170, r: 150 };

export function buildFields(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;

  const height = (x, z) => {
    let h = fbm(x / 280, z / 280, 4, 3) * 30 + fbm(x / 70, z / 70, 3, 9) * 3;
    const d = Math.hypot(x, z);
    h *= smooth(70, 200, d);                         // fazenda plana no centro
    h += Math.max(0, fbm(x / 400, z / 400, 2, 21)) * 25 * smooth(250, 450, d); // morros ao longe
    const rd = Math.abs(z - roadZ(x));
    h = THREE.MathUtils.lerp(h * 0.85, h, smooth(3, 14, rd));
    const pd = Math.hypot(x - POND.x, z - POND.z);
    h -= 2.2 * (1 - smooth(POND.r * 0.6, POND.r * 1.15, pd));
    return h;
  };
  const splat = (x, z) => {
    const rd = Math.abs(z - roadZ(x));
    let s = 1 - smooth(2.6, 4.2, rd);
    // campo arado
    if (x > 70 && x < 270 && z > -230 && z < -60) s = Math.max(s, 0.55 + 0.35 * Math.sin(x * 1.3) ** 2);
    // terra batida na fazenda
    const fd = Math.hypot(x - 5, z + 8);
    s = Math.max(s, (1 - smooth(14, 26, fd)) * 0.85);
    s = Math.max(s, Math.max(0, fbm(x / 25, z / 25, 3, 4) - 0.25) * 1.4);
    const pd = Math.hypot(x - POND.x, z - POND.z);
    s = Math.max(s, (1 - smooth(POND.r * 0.9, POND.r * 1.3, pd)) * 0.9);
    return Math.min(1, s);
  };
  const tint = (x, z) => 0.82 + 0.3 * fbm(x / 90, z / 90, 3, 12) + 0.1 * fbm(x / 9, z / 9, 2, 13);

  kit.terrain({ size: 1400, res: 230, height, splat, tint, texA: 'grass', texB: 'dirt' });
  const H = kit.heightAt;

  // ---------------------------------------------------------------- fazenda
  // casa: 12 x 9 m, 2 andares
  {
    const cx = -28, cz = -12, w = 12, d = 9, eave = 6.2;
    const gy = H(cx, cz);
    kit.box('concrete', cx, gy + 0.15, cz, w + 0.6, 0.5, d + 0.6);
    const y0 = gy + 0.4;
    const wins = [[1.0, 2.3], [4.0, 5.3]];
    wall(kit, 'plaster', V(cx - w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz - d / 2), { y0, h: eave - 0.4, t: 0.3, bay: 3, pillar: 1.1, windows: wins, winWidth: 0.6, door: { bays: [1], h: 2.2 } });
    wall(kit, 'plaster', V(cx - w / 2, 0, cz + d / 2), V(cx + w / 2, 0, cz + d / 2), { y0, h: eave - 0.4, t: 0.3, bay: 3, pillar: 1.1, windows: wins, winWidth: 0.6 });
    wall(kit, 'plaster', V(cx - w / 2, 0, cz - d / 2), V(cx - w / 2, 0, cz + d / 2), { y0, h: eave - 0.4, t: 0.3, bay: 3, pillar: 1.1, windows: wins, winWidth: 0.6 });
    wall(kit, 'plaster', V(cx + w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz + d / 2), { y0, h: eave - 0.4, t: 0.3, bay: 3, pillar: 1.1, windows: wins, winWidth: 0.6 });
    kit.box('wood', cx, y0 + 3.0, cz, w - 0.4, 0.2, d - 0.4);           // piso do 2º andar
    kit.box('wood', cx, gy + eave, cz, w - 0.2, 0.15, d - 0.2);         // forro
    gableRoof(kit, 'roofTiles', cx, cz, w, d, gy + eave, 3.2, { over: 0.6 });
    gableEnd(kit, 'plaster', cx, cz - d / 2, w, gy + eave, 3.2, { t: 0.3 });
    gableEnd(kit, 'plaster', cx, cz + d / 2, w, gy + eave, 3.2, { t: 0.3 });
    kit.box('plaster', cx + 3.5, gy + eave + 2.4, cz + 1.5, 0.9, 2.6, 0.9);  // chaminé
    // vidros escuros nas janelas
    kit.box('glass', cx, y0 + 1.65, cz - d / 2, w - 1, 1.3, 0.05, { collide: false });
    kit.box('glass', cx, y0 + 4.65, cz - d / 2, w - 1, 1.3, 0.05, { collide: false });
    kit.box('glass', cx, y0 + 1.65, cz + d / 2, w - 1, 1.3, 0.05, { collide: false });
    kit.box('glass', cx, y0 + 4.65, cz + d / 2, w - 1, 1.3, 0.05, { collide: false });
  }
  // celeiro vazado: 22 x 13 m, portões abertos nas duas pontas
  {
    const cx = 22, cz = -30, w = 13, d = 22, eave = 6.5, rise = 4.5;
    const gy = H(cx, cz);
    kit.box('concreteFloor', cx, gy - 0.05, cz, w + 1, 0.3, d + 1);
    const y0 = gy + 0.1;
    wall(kit, 'barnWood', V(cx - w / 2, 0, cz - d / 2), V(cx - w / 2, 0, cz + d / 2), { y0, h: eave, t: 0.25, bay: 5.5, pillar: 0.5, windows: [[3.2, 4.4]], winWidth: 0.4 });
    wall(kit, 'barnWood', V(cx + w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz + d / 2), { y0, h: eave, t: 0.25, bay: 5.5, pillar: 0.5, windows: [[3.2, 4.4]], winWidth: 0.4 });
    for (const ez of [cz - d / 2, cz + d / 2]) {
      wall(kit, 'barnWood', V(cx - w / 2, 0, ez), V(cx + w / 2, 0, ez), { y0, h: eave, t: 0.25, bay: w / 3, pillar: 0.4, door: { bays: [1], h: 5.2 } });
      gableEnd(kit, 'barnWood', cx, ez, w, y0 + eave, rise, { t: 0.25 });
    }
    // gableEnd tem buraco? deixa um vão triangular pequeno: o "palheiro"
    gableRoof(kit, 'corrugatedRust', cx, cz, w, d, y0 + eave, rise, { over: 0.5, segs: 6, holes: 0.12 });
    for (let i = 0; i < 4; i++) kit.box('wood', cx, y0 + eave - 0.1, cz - d / 2 + 3 + i * 5.3, w - 0.4, 0.25, 0.25); // vigas
    // fardos dentro
    for (let i = 0; i < 6; i++) kit.cyl('hay', cx - 4 + (i % 3) * 1.6, y0 + 0.75 + Math.floor(i / 3) * 1.5, cz + 6, 0.75, 0.75, 1.2, { rz: Math.PI / 2, seg: 12 });
  }
  // silo
  {
    const cx = 36, cz = -14, gy = H(36, -14);
    kit.cyl('corrugated', cx, gy + 8, cz, 3.2, 3.2, 16, { seg: 18 });
    kit.cyl('rust', cx, gy + 17.2, cz, 0.4, 3.4, 2.4, { seg: 18 });
    for (let i = 0; i < 16; i++) kit.box('steel', cx + 3.35, gy + 0.6 + i, cz, 0.05, 0.05, 0.6, { collide: false });
  }
  // cercas do curral
  fence(kit, V(-10, 0, 12), V(40, 0, 12), H);
  fence(kit, V(40, 0, 12), V(40, 0, -48), H);
  fence(kit, V(-48, 0, -48), V(40, 0, -48), H);
  // fardos de feno espalhados no campo
  for (const p of scatter(R, 26, 60, -50, 200, 10, (x, z) => Math.abs(z - roadZ(x)) > 10)) {
    kit.cyl('hay', p.x, H(p.x, p.z) + 0.72, p.z, 0.75, 0.75, 1.25, { rz: Math.PI / 2, ry: R() * Math.PI, seg: 12 });
  }
  // trator velho (caixas)
  {
    const x = 52, z = -2, gy = H(52, -2);
    kit.box('containerRed', x, gy + 1.3, z, 3.2, 1.2, 1.6);
    kit.box('containerRed', x - 0.7, gy + 2.4, z, 1.4, 1.2, 1.4);
    kit.cyl('rubber', x - 1.1, gy + 0.85, z + 1.0, 0.85, 0.85, 0.5, { rx: Math.PI / 2, seg: 12 });
    kit.cyl('rubber', x - 1.1, gy + 0.85, z - 1.0, 0.85, 0.85, 0.5, { rx: Math.PI / 2, seg: 12 });
    kit.cyl('rubber', x + 1.2, gy + 0.5, z + 0.9, 0.5, 0.5, 0.35, { rx: Math.PI / 2, seg: 10 });
    kit.cyl('rubber', x + 1.2, gy + 0.5, z - 0.9, 0.5, 0.5, 0.35, { rx: Math.PI / 2, seg: 10 });
  }

  // ---------------------------------------------------------------- linha de transmissão ao longo da estrada
  const poles = [];
  for (let x = -420; x <= 420; x += 46) poles.push(V(x, 0, roadZ(x) - 8));
  powerLine(kit, poles, H, { h: 10, sag: 1.4 });

  // ---------------------------------------------------------------- lago
  {
    const wy = H(POND.x, POND.z) + 1.4;
    const geo = new THREE.CircleGeometry(POND.r * 1.05, 40).rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, kit.mat('water', { transparent: true, opacity: 0.88 }));
    water.position.set(POND.x, wy, POND.z);
    kit.scene.add(water);
    kit.meshes.push(water);
  }
  // cais de madeira no lago
  {
    const gy = H(POND.x - 30, POND.z);
    for (let i = 0; i < 6; i++) kit.box('wood', POND.x - 29 + i * 2, Math.max(gy, H(POND.x, POND.z) + 1.4) + 0.5, POND.z, 2, 0.12, 2.2);
  }

  // ---------------------------------------------------------------- vegetação
  const trees = [];
  const notRoad = (x, z, m = 7) => Math.abs(z - roadZ(x)) > m;
  const notFarm = (x, z) => !(x > -60 && x < 60 && z > -60 && z < 25);
  const notPond = (x, z) => Math.hypot(x - POND.x, z - POND.z) > POND.r + 4;
  const notSpawn = (x, z) => Math.hypot(x - 5, z - 18) > 18;
  // sebes ao redor dos campos
  const hedges = [
    [V(65, 0, -55), V(275, 0, -55)], [V(65, 0, -235), V(275, 0, -235)], [V(65, 0, -235), V(65, 0, -55)], [V(275, 0, -235), V(275, 0, -55)],
    [V(-60, 0, 70), V(-300, 0, 90)], [V(-60, 0, 70), V(-70, 0, 300)], [V(70, 0, 80), V(320, 0, 60)], [V(320, 0, 60), V(330, 0, 300)],
  ];
  for (const [a, b] of hedges) trees.push(...treeLine(R, a, b, 4.5 / Math.sqrt(veg), 2.5, ['bush', 'bush', 'oak']));
  // floresta de pinheiros
  const nForest = Math.round(650 * veg);
  for (const p of scatter(R, nForest, FOREST.x - FOREST.r, FOREST.z - FOREST.r, FOREST.x + FOREST.r, FOREST.z + FOREST.r,
    (x, z) => { const d = Math.hypot(x - FOREST.x, z - FOREST.z); return d < FOREST.r * (0.8 + 0.25 * fbm(x / 40, z / 40, 2, 3)) && Math.hypot(x - FOREST.x - 30, z - FOREST.z) > 22 && notRoad(x, z); })) {
    trees.push({ ...p, s: 0.8 + R() * 0.7, type: R() < 0.85 ? 'pine' : 'oak' });
  }
  // árvores soltas
  for (const p of scatter(R, Math.round(140 * veg), -650, -650, 650, 650, (x, z) => notRoad(x, z) && notFarm(x, z) && notPond(x, z) && notSpawn(x, z) && Math.hypot(x - FOREST.x, z - FOREST.z) > FOREST.r)) {
    trees.push({ ...p, s: 0.9 + R() * 0.8, type: R() < 0.75 ? 'oak' : 'pine' });
  }
  // árvores grandes perto do spawn (para passar entre os galhos)
  trees.push({ x: -8, z: 40, s: 1.9, type: 'oak' }, { x: 26, z: 52, s: 1.5, type: 'oak' }, { x: -40, z: 30, s: 1.4, type: 'oak' });
  // bosque ao lado da casa
  for (const p of scatter(R, Math.round(30 * veg), -75, -55, -45, 10, () => true)) trees.push({ ...p, s: 0.8 + R() * 0.6, type: R() < 0.5 ? 'oak' : 'bush' });
  kit.trees(trees);

  if (settings.get('graphics.grass')) {
    const pts = scatter(R, Math.round(9000 * veg), -150, -150, 170, 170, (x, z) => R() < 1 - smooth(70, 150, Math.hypot(x - 10, z - 10)) && notRoad(x, z, 4) && notPond(x, z) && !(x > 8 && x < 36 && z > -42 && z < -18) && !(x > -36 && x < -20 && z > -18 && z < -6) && splat(x, z) < 0.5)
      .map(p => ({ ...p, s: 0.8 + R() * 0.7 }));
    kit.grass(pts);
  }

  // pad de decolagem
  const sy = H(5, 18);
  kit.box('concrete', 5, sy + 0.02, 18, 2.4, 0.12, 2.4);
  return {
    spawn: { pos: V(5, sy + 0.2, 18), yaw: 0 },
    pilot: V(9, 0, 22),
    orbit: 40,
  };
}
