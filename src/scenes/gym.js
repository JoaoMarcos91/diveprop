// Cenário: Ginásio Indoor — quadra coberta com pista de tiny whoop (portões pequenos,
// cronômetro), arquibancada, cestas de basquete (passe pelo aro!), cordas e colchonetes.
import * as THREE from 'three';
import { V, wall } from './common.js';
import { buildRaceTrack } from './raceTrack.js';

const HX = 24, HZ = 15, WALL_H = 12;

// x, z, altura da base, largura, altura, cor
const GATES = [
  [0, 7, 0, 0.9, 0.9, 'gateOrange'],       // largada
  [-13, 6.5, 0, 0.9, 0.9, 'gateBlue'],
  [-20, -0.5, 0.6, 0.9, 0.9, 'gateOrange'],
  [-13, -9, 0, 0.9, 0.9, 'gateBlue'],
  [0, -11, 1.8, 1.0, 1.0, 'gateOrange'],   // portão alto
  [13, -9, 0, 0.9, 0.9, 'gateBlue'],
  [20, -0.5, 0.9, 0.9, 0.9, 'gateOrange'],
  [13, 6.5, 0, 0.9, 0.9, 'gateBlue'],
  [5, 12.9, 2.75, 1.0, 1.0, 'gateOrange'], // em cima da arquibancada
];
const SEQ = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function buildGym(kit, settings) {
  const R = kit.rand;
  const floor = () => 0;
  kit.heightAt = floor;

  // ---------------------------------------------------------------- piso e linhas da quadra
  kit.box('parquet', 0, -0.15, 0, HX * 2, 0.3, HZ * 2);
  const line = (x, z, w, d) => kit.box('courtLine', x, 0.004, z, w, 0.008, d, { collide: false });
  const CW = 28, CD = 15, t = 0.06;
  line(0, -CD / 2, CW, t); line(0, CD / 2, CW, t); line(-CW / 2, 0, t, CD); line(CW / 2, 0, t, CD); line(0, 0, t, CD);
  for (let a = 0; a < 32; a++) { const ang = a / 32 * Math.PI * 2; kit.box('courtLine', Math.cos(ang) * 1.8, 0.004, Math.sin(ang) * 1.8, 0.36, 0.008, t, { ry: -ang + Math.PI / 2, collide: false }); }
  for (const s of [-1, 1]) {
    kit.box('courtBlue', s * (CW / 2 - 2.9), 0.003, 0, 5.8, 0.006, 4.9, { collide: false });          // garrafão
    for (let a = -8; a <= 8; a++) {                                                                   // linha de 3 pontos
      const ang = a / 8 * 1.3;
      kit.box('courtLine', s * (CW / 2 - 1.6 - Math.cos(ang) * 6.75), 0.004, Math.sin(ang) * 6.75, 0.85, 0.008, t, { ry: s * ang + Math.PI / 2, collide: false });
    }
  }

  // ---------------------------------------------------------------- paredes com faixa de janelas altas
  const corners = [V(-HX, 0, -HZ), V(HX, 0, -HZ), V(HX, 0, HZ), V(-HX, 0, HZ)];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    wall(kit, 'paintedBrick', a, b, { h: WALL_H, t: 0.4, bay: 6, pillar: 0.9, windows: [[8.2, 11.2]], winWidth: 0.82 });
    // vidros (claros, com colisão) nas janelas
    const L = a.distanceTo(b), dir = V(b.x - a.x, 0, b.z - a.z).normalize();
    const ry = Math.atan2(-dir.z, dir.x);
    kit.box('windowGlow', (a.x + b.x) / 2, 9.7, (a.z + b.z) / 2, L, 3, 0.06, { ry });
  }
  // faixa de parede entre o topo das paredes e o telhado (fecha o ginásio)
  kit.box('paintedBrick', 0, WALL_H + 1.1, -HZ, HX * 2 + 0.4, 2.2, 0.4);
  kit.box('paintedBrick', 0, WALL_H + 1.1, HZ, HX * 2 + 0.4, 2.2, 0.4);
  kit.box('paintedBrick', -HX, WALL_H + 1.1, 0, 0.4, 2.2, HZ * 2);
  kit.box('paintedBrick', HX, WALL_H + 1.1, 0, 0.4, 2.2, HZ * 2);
  // porta de entrada (fechada)
  kit.box('shutter', 0, 1.6, -HZ + 0.25, 5, 3.2, 0.1);
  // placar
  kit.box('black', 0, 7, HZ - 0.3, 6, 2.2, 0.3);
  kit.box('lampOn', -1.5, 7.2, HZ - 0.5, 1.6, 0.9, 0.05, { collide: false });
  kit.box('canvasRed', 1.5, 7.2, HZ - 0.5, 1.6, 0.9, 0.05, { collide: false });

  // ---------------------------------------------------------------- telhado: treliças, cobertura e luminárias
  kit.batch('corrugated').cast = false;
  kit.batch('steelBlue').cast = false;
  kit.batch('lampOn').cast = false;
  kit.box('corrugated', 0, WALL_H + 2.2, 0, HX * 2 + 1, 0.2, HZ * 2 + 1);
  for (let x = -HX + 4; x < HX; x += 6) {
    kit.box('steelBlue', x, WALL_H, 0, 0.25, 0.35, HZ * 2);
    kit.box('steelBlue', x, WALL_H + 2, 0, 0.25, 0.3, HZ * 2);
    for (let z = -HZ + 2.5; z < HZ; z += 5) kit.beam('steelBlue', V(x, WALL_H, z), V(x, WALL_H + 2, z + 2.5), 0.06, { square: true });
  }
  for (let x = -18; x <= 18; x += 9) for (let z = -9; z <= 9; z += 6) {
    kit.beam('steel', V(x, WALL_H, z), V(x, 10.6, z), 0.015, { collide: false });
    kit.box('lampOn', x, 10.5, z, 1.4, 0.18, 0.5);
  }

  // ---------------------------------------------------------------- arquibancada
  for (let r = 0; r < 6; r++) {
    const h = 0.45 * (r + 1), z = HZ - 0.4 - (6 - r) * 0.8;
    kit.box('wood', 0, h / 2, z + 0.4, 36, h, 0.8);
  }
  kit.box('steel', 0, 2.7 + 1.0, HZ - 0.6, 36, 0.06, 0.06);
  for (let x = -18; x <= 18; x += 3) kit.box('steel', x, 2.7 + 0.5, HZ - 0.6, 0.05, 1.0, 0.05, { collide: false });

  // ---------------------------------------------------------------- cestas de basquete (aro vazado)
  for (const s of [-1, 1]) {
    const bx = s * (CW / 2 + 0.2);
    kit.box('steelBlue', s * (HX - 0.5), 4.2, 0, 0.3, 0.3, 0.3);
    kit.beam('steelBlue', V(s * (HX - 0.4), 4.2, 0), V(bx + s * 0.2, 3.6, 0), 0.08, { square: true });
    kit.box('hullWhite', bx, 3.6, 0, 0.05, 1.05, 1.8);
    kit.box('canvasRed', bx - s * 0.03, 3.4, 0, 0.02, 0.45, 0.59, { collide: false });
    const ring = new THREE.CylinderGeometry(0.23, 0.23, 0.035, 18, 1, true);
    const cx = bx - s * 0.38;
    kit.addGeometry('gateOrange', ring, new THREE.Matrix4().makeTranslation(cx, 3.05, 0));
    kit.collider({ type: 'tris', geometry: ring }, cx, 3.05, 0, null);
    kit.beam('hullWhite', V(cx - 0.18, 3.05, 0), V(cx - 0.12, 2.6, 0), 0.008, { collide: false });
    kit.beam('hullWhite', V(cx + 0.18, 3.05, 0), V(cx + 0.12, 2.6, 0), 0.008, { collide: false });
  }

  // ---------------------------------------------------------------- cordas, colchonetes, plinto
  for (const [x, z] of [[-6, -13.5], [-3, -13.5], [0, -13.5]]) kit.beam('wood', V(x, WALL_H, z), V(x + 0.2, 1.2, z + 0.1), 0.03, { seg: 6 });
  for (let i = 0; i < 4; i++) kit.box('padBlue', 18 + (i % 2) * 2.1, 0.12 + Math.floor(i / 2) * 0.25, -12.5, 2, 0.24, 1.2, { ry: R() * 0.1 });
  kit.box('wood', -18, 0.55, -12, 1.6, 1.1, 0.7);
  kit.box('padBlue', -16.8, 0.08, -12, 1.2, 0.16, 0.8, { rz: 0.15 });
  for (let i = 0; i < 6; i++) kit.cyl('canvasRed', -21 + i * 0.35, 0.12, 12 + (i % 2) * 0.3, 0.12, 0.12, 0.24, { seg: 10, collide: false }); // bolas

  // ---------------------------------------------------------------- pista de whoop
  const track = buildRaceTrack(kit, settings, {
    gates: GATES.map(([x, z, base, w, h, mat]) => ({ x, z, base, w, h, mat })),
    seq: SEQ, key: 'gym', groundAt: floor, pad: 0.06, supportMat: 'steel', deck: 'padBlue',
  });
  // bandeiras nas curvas
  for (const [x, z] of [[-19, 6], [-19, -7], [19, -7], [19, 6], [-6, -12.5], [8, -12]]) {
    kit.cyl('paintWhite', x, 0.9, z, 0.012, 0.015, 1.8, { seg: 5, collide: false });
    kit.box(R() < 0.5 ? 'gateOrange' : 'gateBlue', x + 0.12, 1.45, z, 0.24, 0.6, 0.01, { collide: false });
  }

  const start = track.startPoint(2.5, 0.08);
  kit.box('padBlue', start.pos.x, 0.01, start.pos.z, 0.6, 0.02, 0.6, { collide: false });
  return {
    spawn: start,
    pilot: V(start.pos.x + 1.5, 0, start.pos.z + 1.5),
    orbit: 16,
    update: track.update, onRespawn: track.onRespawn, dispose: track.dispose,
  };
}
