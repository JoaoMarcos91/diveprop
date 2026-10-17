// Cenário: Pista de Corrida — parque com portões, bandeiras, cronômetro de volta e melhor volta.
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, scatter } from './common.js';
import { buildRaceTrack } from './raceTrack.js';

// x, z, altura da base, largura interna, altura interna, cor
// portões grandes (3,3 × 3 m): mais fáceis de passar em alta velocidade
const PAD = 0.32;
const GATES = [
  [0, 20, 0, 3.3, 3.0, 'gateOrange'],     // largada/chegada
  [0, -25, 0, 3.3, 3.0, 'gateBlue'],
  [30, -60, 0, 3.3, 3.0, 'gateOrange'],
  [70, -45, 4, 3.6, 3.3, 'gateBlue'],     // portão elevado
  [85, 0, 0, 3.3, 3.0, 'gateOrange'],
  [60, 40, 0, 3.3, 3.0, 'gateBlue'],
  [60, 40, 3.0 + PAD * 2 + 0.05, 3.3, 3.0, 'gateOrange', { noSupport: true, yawFrom: 5 }],  // "escada" (em cima do anterior)
  [20, 70, 8, 3.9, 3.6, 'gateBlue'],      // dive gate na torre
  [-35, 60, 0, 3.3, 3.0, 'gateOrange'],
  [-70, 15, 0, 3.3, 3.0, 'gateBlue'],
  [-45, -30, 0, 3.3, 3.0, 'gateOrange'],
];
// a "escada" (índice 6) é decorativa: não entra na sequência
const SEQ = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10];

export function buildRace(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;
  const height = (x, z) => {
    const d = Math.hypot(x, z);
    return fbm(x / 200, z / 200, 3, 41) * 16 * smooth(110, 240, d) + fbm(x / 50, z / 50, 2, 3) * 0.5;
  };
  kit.terrain({
    size: 900, res: 150, height,
    splat: (x, z) => Math.max(0, fbm(x / 18, z / 18, 3, 6) - 0.32) * 1.6,
    tint: (x, z) => 0.92 + 0.12 * Math.sin(x * 0.35) * smooth(150, 0, Math.hypot(x, z)) * 0 + 0.18 * fbm(x / 70, z / 70, 2, 8),
    texA: 'grass', texB: 'dirt',
  });
  const H = kit.heightAt;

  const track = buildRaceTrack(kit, settings, {
    gates: GATES.map(([x, z, base, w, h, mat, extra]) => ({ x, z, base, w, h, mat, ...extra })),
    seq: SEQ, key: 'race', groundAt: H, pad: PAD,
  });
  const gates = track.gates;

  // pórtico de largada
  {
    const g = gates[0];
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), g.yaw);
    for (const s of [-1, 1]) {
      const p = V(s * 6, 0, 0).applyQuaternion(q);
      kit.box('steel', g.x + p.x, g.y + 3, g.z + p.z, 0.3, 6, 0.3, { ry: g.yaw });
    }
    kit.box('gateGreen', g.x, g.y + 6, g.z, 12.4, 0.9, 0.2, { ry: g.yaw });
  }
  // bandeiras nas curvas
  const flags = [[45, -70], [95, -25], [90, 30], [35, 65], [-10, 80], [-60, 50], [-80, -10], [-25, -50], [15, -40]];
  for (const [x, z] of flags) {
    const gy = H(x, z);
    kit.cyl('paintWhite', x, gy + 2.75, z, 0.06, 0.07, 5.5, { seg: 6 });
    kit.box(R() < 0.5 ? 'gateOrange' : 'gateBlue', x + 0.55, gy + 4.4, z, 1.1, 2.1, 0.04, { collide: false });
  }
  // tendas e arquibancada
  for (const [x, z, c] of [[-20, 32, 'gateBlue'], [-12, 34, 'gateOrange']]) {
    const gy = H(x, z);
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.4, 1.4]) kit.cyl('steel', x + sx, gy + 1.2, z + sz, 0.03, 0.03, 2.4, { seg: 5 });
    kit.box(c, x, gy + 2.5, z, 3, 0.15, 3);
    kit.box('wood', x, gy + 0.8, z, 1.8, 0.06, 0.8);
  }
  for (let r = 0; r < 4; r++) kit.box('wood', 14, H(14, 34) + 0.3 + r * 0.45, 34 + r * 0.8, 10, 0.12, 0.7);

  // ---------------------------------------------------------------- vegetação
  const trees = [];
  for (const p of scatter(R, Math.round(520 * veg), -430, -430, 430, 430, (x, z) => Math.hypot(x, z * 1.15) > 125)) trees.push({ ...p, s: 0.8 + R() * 0.8, type: R() < 0.6 ? 'oak' : R() < 0.7 ? 'pine' : 'bush' });
  // árvores dentro da pista (obstáculos)
  trees.push({ x: 40, z: -10, s: 1.3, type: 'oak' }, { x: -30, z: 10, s: 1.1, type: 'oak' }, { x: 25, z: 30, s: 1.0, type: 'pine' }, { x: -55, z: -55, s: 1.4, type: 'oak' });
  for (const p of scatter(R, Math.round(40 * veg), -100, -90, 110, 100, (x, z) => gates.every(g => Math.hypot(x - g.x, z - g.z) > 9) && Math.hypot(x, z - 24) > 12)) trees.push({ ...p, s: 0.6 + R() * 0.7, type: 'bush' });
  kit.trees(trees);
  if (settings.get('graphics.grass')) {
    kit.grass(scatter(R, Math.round(5500 * veg), -110, -100, 110, 100, (x, z) => gates.every(g => Math.hypot(x - g.x, z - g.z) > 2.5)).map(p => ({ ...p, s: 0.7 + R() * 0.6 })));
  }

  const start = track.startPoint(14);
  kit.box('concrete', start.pos.x, start.pos.y - 0.2, start.pos.z, 2.4, 0.12, 2.4);
  return {
    spawn: start,
    pilot: V(start.pos.x + 4, 0, start.pos.z + 3),
    orbit: 60,
    update: track.update, onRespawn: track.onRespawn, dispose: track.dispose,
  };
}
