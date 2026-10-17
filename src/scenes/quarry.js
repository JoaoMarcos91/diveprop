// Cenário: Pedreira — cava em bancadas com lago no fundo, britador elevado, esteiras
// transportadoras longas (passe por baixo), pilhas de brita, silos, caminhões e escavadeira.
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, scatter } from './common.js';

const PIT_R = 150;     // raio da borda da cava
const BENCH = 18;      // largura de cada degrau (face + piso)
const DROP = 9;        // altura de cada degrau
const LEVELS = 5;
const PLANT = { x: 205, z: 20 };

export function buildQuarry(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;

  const pitR = (x, z) => PIT_R + fbm(x / 70, z / 70, 2, 3) * 18; // borda irregular
  const height = (x, z) => {
    const r = Math.hypot(x, z * 1.15);
    const rr = pitR(x, z);
    const outside = 2 + fbm(x / 160, z / 160, 3, 7) * 9 * smooth(rr + 20, rr + 160, r);
    if (r >= rr) return outside;
    // degraus: cada um tem uma face íngreme (4 m) e um piso quase plano
    // borda de cada bancada ondulada e irregular (rocha de verdade não é um círculo perfeito)
    const depth = rr - r + fbm(x / 22, z / 22, 3, 13) * 5;
    const lvl = Math.min(LEVELS, depth / BENCH);
    const k = Math.floor(lvl), f = lvl - k;
    const step = k + smooth(0, 0.55, f); // face larga (~10 m): sem serrilhado na malha
    let h = outside * (1 - smooth(0, 0.6, lvl)) - Math.min(step, LEVELS) * DROP;
    h -= smooth(0, 45, depth - LEVELS * BENCH) * 7;   // fundo em bacia (lago com margem natural)
    h += fbm(x / 9, z / 9, 2, 9) * 0.5;
    return h;
  };
  const splat = (x, z) => {
    const slope = Math.abs(height(x + 1.5, z) - height(x - 1.5, z)) + Math.abs(height(x, z + 1.5) - height(x, z - 1.5));
    return Math.min(1, smooth(2.2, 0.9, slope) * 0.9 + 0.1); // pisos = terra, faces = rocha
  };
  const tint = (x, z) => 0.88 + 0.16 * fbm(x / 40, z / 40, 2, 5);
  kit.terrain({ size: 760, res: 300, height, splat, tint, texA: 'quarry', texB: 'mudDry' });
  const H = kit.heightAt;
  const bottom = -LEVELS * DROP;

  // lago verde no fundo da cava
  kit.water({ x: 0, z: 0, w: 280, d: 250, y: bottom - 2.5, color: '#3f7a5e', opacity: 0.92, ripple: 6, speed: 0.6 });

  // ---------------------------------------------------------------- usina: britador, peneira, silos
  const P = PLANT, gy = H(P.x, P.z);
  // britador primário sobre pernas (prédio de chapa enferrujada)
  for (const [sx, sz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) kit.box('steelRust', P.x + sx, gy + 6, P.z + sz, 0.6, 12, 0.6);
  kit.box('corrugatedRust', P.x, gy + 18, P.z, 13, 12, 13);
  kit.box('steelRust', P.x, gy + 12.2, P.z, 13.4, 0.4, 13.4);
  kit.cyl('steel', P.x, gy + 9.5, P.z, 2.4, 0.8, 5, { seg: 10 });            // funil
  kit.box('corrugatedRust', P.x, gy + 25, P.z + 2, 6, 3, 6);
  // peneira vibratória e torre
  const S = { x: P.x - 10, z: P.z + 55 };
  for (const [sx, sz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) kit.box('steelRust', S.x + sx, H(S.x, S.z) + 5, S.z + sz, 0.4, 10, 0.4);
  kit.box('corrugated', S.x, H(S.x, S.z) + 12, S.z, 8, 4, 8);
  // silos
  for (let i = 0; i < 3; i++) {
    const x = P.x + 30, z = P.z - 22 + i * 11, g = H(x, z);
    for (const a of [0, 1.57, 3.14, 4.71]) kit.cyl('steel', x + Math.cos(a) * 3.6, g + 3, z + Math.sin(a) * 3.6, 0.2, 0.2, 6, { seg: 5 });
    kit.cyl('corrugated', x, g + 13, z, 4, 4, 14, { seg: 16 });
    kit.cyl('steel', x, g + 5.0, z, 0.6, 4, 2.2, { seg: 16 });
    kit.cyl('steel', x, g + 20.6, z, 0.5, 4.1, 1.2, { seg: 16 });
  }
  // escritório de contêineres e tanque de diesel
  for (let i = 0; i < 3; i++) kit.box(i % 2 ? 'containerBlue' : 'containerOrange', P.x + 45 + i * 0.2, H(P.x + 45, P.z + 30) + 1.3 + (i === 2 ? 2.6 : 0), P.z + 30 + (i % 2) * 2.6, 6.06, 2.59, 2.44);
  kit.cyl('paintWhite', P.x + 52, H(P.x + 52, P.z - 30) + 1.8, P.z - 30, 1.6, 1.6, 6, { rz: Math.PI / 2, seg: 14 });

  // ---------------------------------------------------------------- esteiras transportadoras
  const conveyor = (a, b, w = 1.2) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    const pitch = Math.asin(dir.y / len);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    // treliça: duas longarinas + esteira
    const side = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(w / 2 + 0.1);
    for (const sgn of [-1, 1]) kit.beam('steelRust', a.clone().addScaledVector(side, sgn), b.clone().addScaledVector(side, sgn), 0.12, { square: true });
    kit.box('belt', mid.x, mid.y + 0.15, mid.z, len, 0.12, w, { ry: yaw, rz: pitch, collide: true });
    // telhadinho e pernas a cada 12 m
    const n = Math.floor(len / 12);
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      const g = H(p.x, p.z);
      if (p.y - g > 1.5) for (const sgn of [-1, 1]) kit.beam('steelRust', V(p.x + side.x * sgn, g, p.z + side.z * sgn), V(p.x + side.x * sgn, p.y, p.z + side.z * sgn), 0.1, { square: true });
      kit.beam('steelRust', p.clone().addScaledVector(side, -1), p.clone().addScaledVector(side, 1), 0.06, { square: true, collide: false });
    }
  };
  // do fundo da cava até o britador (longa, passa sobre as bancadas)
  conveyor(V(-20, bottom + 4, 30), V(P.x - 7, gy + 14, P.z));
  // do britador até a peneira e às pilhas
  conveyor(V(P.x, gy + 13, P.z + 6), V(S.x, H(S.x, S.z) + 13, S.z - 3));
  const piles = [[S.x - 30, S.z + 25, 12], [S.x + 5, S.z + 45, 14], [S.x + 35, S.z + 22, 10]];
  for (const [x, z, h] of piles) {
    conveyor(V(S.x, H(S.x, S.z) + 12, S.z), V(x, H(x, z) + h + 1, z), 0.9);
    kit.cyl('gravel', x, H(x, z) + h / 2 - 0.3, z, 0.4, h * 1.25, h, { seg: 16 });
  }

  // ---------------------------------------------------------------- máquinas
  const truck = (x, z, ry) => {
    const g = H(x, z);
    const c = Math.cos(ry), s = Math.sin(ry);
    const off = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    kit.box('paintYellow', x, g + 2.2, z, 9, 1.4, 4.4, { ry });                       // chassi
    const [bx, bz] = off(-1.2, 0);
    kit.box('paintYellow', bx, g + 3.7, bz, 6.4, 1.8, 4.6, { ry, rz: 0.06 });          // caçamba
    const [cx, cz] = off(3.4, -1.2);
    kit.box('paintYellow', cx, g + 3.6, cz, 1.8, 1.6, 1.8, { ry });                    // cabine
    kit.box('glass', cx + c * 0.1, g + 3.9, cz - s * 0.1, 1.9, 0.7, 1.6, { ry, collide: false });
    for (const [lx, lz] of [[3, 2.1], [3, -2.1], [-2.6, 2.1], [-2.6, -2.1]]) {
      const [wx, wz] = off(lx, lz);
      kit.cyl('rubber', wx, g + 1.35, wz, 1.35, 1.35, 1.1, { rx: Math.PI / 2, ry, seg: 12 });
    }
  };
  truck(-60, 95, 0.6);
  truck(70, -60, 2.4);
  truck(P.x - 25, P.z - 30, 1.2);
  // escavadeira na bancada
  {
    const x = -95, z = -40, g = H(x, z);
    for (const sz of [-1.6, 1.6]) kit.box('black', x, g + 0.6, z + sz, 5.5, 1.2, 1.0);
    kit.box('paintYellow', x, g + 2.0, z, 4.4, 1.6, 3.4);
    kit.box('paintYellow', x + 1.2, g + 3.2, z - 1.0, 1.6, 1.6, 1.4);
    kit.beam('paintYellow', V(x + 1.6, g + 2.6, z), V(x + 6.5, g + 6.5, z), 0.35, { square: true });
    kit.beam('paintYellow', V(x + 6.5, g + 6.5, z), V(x + 9.5, g + 1.8, z), 0.28, { square: true });
    kit.box('steel', x + 9.6, g + 1.2, z, 1.4, 1.2, 1.6);
  }
  // perfuratriz
  {
    const x = 40, z = 120, g = H(x, z);
    kit.box('steelBlue', x, g + 1.4, z, 5, 2, 2.6);
    kit.box('steelBlue', x + 2.6, g + 7.5, z, 0.5, 13, 0.5);
  }
  // blocos de rocha espalhados nas bancadas
  for (const p of scatter(R, 60, -170, -170, 170, 170, (x, z) => { const r = Math.hypot(x, z * 1.15); return r < pitR(x, z) - 6 && r > 40; })) {
    const s = 1.2 + R() * 3.5;
    kit.rock('boulder', p.x, H(p.x, p.z) + s * 0.25, p.z, s * 1.3, s * 0.9, s, { rough: 0.18 });
  }

  // ---------------------------------------------------------------- postes e vegetação ao redor
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
    const x = Math.cos(a) * 200, z = Math.sin(a) * 175, g = H(x, z);
    kit.cyl('wood', x, g + 5, z, 0.12, 0.16, 10, { seg: 6 });
    kit.box('lampOn', x - Math.cos(a) * 0.8, g + 9.6, z - Math.sin(a) * 0.8, 0.6, 0.3, 0.6, { collide: false });
  }
  const trees = [];
  for (const p of scatter(R, Math.round(240 * veg), -370, -370, 370, 370, (x, z) => Math.hypot(x, z * 1.15) > pitR(x, z) + 35 && Math.hypot(x - P.x, z - P.z - 30) > 90)) {
    trees.push({ ...p, s: 0.8 + R() * 0.7, type: R() < 0.55 ? 'pine' : R() < 0.7 ? 'oak' : 'bush' });
  }
  kit.trees(trees);
  if (settings.get('graphics.grass')) {
    kit.grass(scatter(R, Math.round(2500 * veg), -260, -260, 260, 260, (x, z) => Math.hypot(x, z * 1.15) > pitR(x, z) + 25).map(p => ({ ...p, s: 0.5 + R() * 0.5 })), { dry: 0.7 });
  }

  // pad de decolagem na borda, olhando para a cava
  const sx = 175, sz = -35, sg = H(sx, sz);
  kit.box('concrete', sx, sg + 0.02, sz, 2.4, 0.12, 2.4);
  return {
    spawn: { pos: V(sx, sg + 0.25, sz), yaw: Math.atan2(sx, sz) },
    pilot: V(sx + 3, 0, sz - 3),
    orbit: 120,
  };
}
