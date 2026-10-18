// Cenário: Usina Abandonada — termelétrica a carvão desativada com duas chaminés de tijolo ocas
// (85 e 100 m), torre de escada de 20 andares com poço central aberto para "ladder dive",
// galeria da esteira de carvão para voar por dentro, casa da caldeira, salão das turbinas,
// caixa d'água e subestação.
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, wall, gableEnd, rubble, scatter, brickChimney, powerLine, container } from './common.js';

const YARD = 140;                                                    // pátio plano: |x|, |z| < YARD
const CHIMNEYS = [[-70, -64, 100, 6.2, 4.2], [-30, -84, 85, 5.6, 3.8]]; // x, z, altura, raio base, raio topo
const BOILER = { x: -55, z: -18, w: 26, d: 22, h: 36 };
const HALL = { x: 18, z: -12, w: 66, d: 24, eave: 18, rise: 5 };
const STAIR = { x: 72, z: -14, floors: 20, fh: 3.2, well: 1.7, run: 1.6 };

export function buildPlant(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;

  const height = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) - YARD;
    return (fbm(x / 170, z / 170, 4, 19) * 18 + fbm(x / 35, z / 35, 2, 7) * 1.5 + 4) * smooth(0, 90, d) - 0.05;
  };
  kit.terrain({
    size: 900, res: 150, height,
    splat: (x, z) => Math.min(1, Math.max(0, fbm(x / 26, z / 26, 3, 3) * 1.3 + 0.3)),
    tint: (x, z) => 0.82 + 0.22 * fbm(x / 60, z / 60, 2, 5),
    texA: 'grass', texB: 'dirt',
  });

  // pátio de concreto em placas (algumas faltando: terra e mato aparecem)
  for (let x = -YARD; x < YARD; x += 20) for (let z = -YARD; z < YARD; z += 20) {
    if (R() < 0.12) continue;
    kit.box('concreteFloor', x + 10, -0.08 + R() * 0.04, z + 10, 19.85, 0.2, 19.85);
  }

  // ---------------------------------------------------------------- chaminés gêmeas (ocas, porta virada para a usina)
  for (const [x, z, h, r0, r1] of CHIMNEYS) {
    brickChimney(kit, x, z, { h, r0, r1, t: 0.5, doorH: 5, doorAngle: Math.atan2(-z - 20, -x), seg: 32 });
  }

  // ---------------------------------------------------------------- casa da caldeira + dutos de fumaça
  {
    const { x: cx, z: cz, w, d, h } = BOILER;
    const o = { h, t: 0.5, bay: 6.5, pillar: 1.6, windows: [[4, 9], [13, 18], [22, 27], [30, 33]] };
    wall(kit, 'brick', V(cx - w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz - d / 2), { ...o, ruin: 0.15 });
    wall(kit, 'brick', V(cx - w / 2, 0, cz + d / 2), V(cx + w / 2, 0, cz + d / 2), { ...o, door: { bays: [1, 2], h: 7 } });
    wall(kit, 'brick', V(cx - w / 2, 0, cz - d / 2), V(cx - w / 2, 0, cz + d / 2), { ...o, bay: 5.5, ruin: 0.2 });
    // parede leste sem ruína: a galeria da esteira chega na janela de 22–27 m do 3º vão
    wall(kit, 'brick', V(cx + w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz + d / 2), { ...o, bay: 5.5 });
    for (let x = cx - w / 2 + 3; x < cx + w / 2; x += 5) kit.box('steelRust', x, h, cz, 0.3, 0.6, d);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      if (R() < 0.35) continue; // buracos no telhado
      kit.box('corrugatedRust', cx - w / 2 + 3.25 + i * 6.5, h + 0.35, cz - d / 2 + 3.7 + j * 7.3, 6.4, 0.08, 7.2);
    }
    // caldeira (cilindro enorme) e passarelas
    kit.cyl('rust', cx, 14, cz - 1, 6, 6, 28, { seg: 20 });
    for (const y of [10, 20]) kit.box('steelRust', cx, y, cz + 7.5, w - 2, 0.15, 1.6);
    // dutos até as chaminés, sobre cavaletes (dá para passar por baixo)
    for (const [x, z, , r0] of CHIMNEYS) {
      const a = V(cx - w / 2 + 4, 14, cz - d / 2 + 2), b = V(x, 14, z);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length() - r0 + 0.3; dir.normalize();
      kit.beam('steelRust', a, a.clone().addScaledVector(dir, len), 1.6, { seg: 14 });
      for (let t = 8; t < len - 6; t += 9) {
        const p = a.clone().addScaledVector(dir, t);
        kit.box('steelRust', p.x, 6.2, p.z, 0.6, 12.4, 0.6);
      }
    }
  }

  // ---------------------------------------------------------------- salão das turbinas
  {
    const { x: cx, z: cz, w, d, eave, rise } = HALL;
    const o = { h: eave, t: 0.45, bay: 6, pillar: 1.4, windows: [[3, 8], [10, 15]] };
    wall(kit, 'plasterDamaged', V(cx - w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz - d / 2), { ...o, ruin: 0.12 });
    wall(kit, 'plasterDamaged', V(cx - w / 2, 0, cz + d / 2), V(cx + w / 2, 0, cz + d / 2), { ...o, door: { bays: [5], h: 9 }, ruin: 0.18 });
    wall(kit, 'plasterDamaged', V(cx - w / 2, 0, cz - d / 2), V(cx - w / 2, 0, cz + d / 2), { ...o, door: { bays: [1, 2], h: 8 } });
    wall(kit, 'plasterDamaged', V(cx + w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz + d / 2), o);
    gableEnd(kit, 'plasterDamaged', cx - w / 2, cz, d, eave, rise, { t: 0.45, ry: Math.PI / 2 });
    gableEnd(kit, 'plasterDamaged', cx + w / 2, cz, d, eave, rise, { t: 0.45, ry: Math.PI / 2 });
    // tesouras e telhado com buracos (cumeeira ao longo de X)
    const ang = Math.atan2(rise, d / 2), slope = Math.hypot(d / 2, rise);
    for (let x = cx - w / 2 + 6; x < cx + w / 2; x += 6) {
      kit.box('steelRust', x, eave, cz, 0.3, 0.4, d);
      for (const s of [-1, 1]) kit.box('steelRust', x, eave + rise / 2, cz + s * d / 4, 0.3, 0.35, slope, { rx: s * ang });
    }
    for (const s of [-1, 1]) for (let x = cx - w / 2; x < cx + w / 2 - 1; x += 6) for (let k = 0; k < 2; k++) {
      if (R() < 0.35) continue;
      const tm = (k + 0.5) / 2;
      kit.box('corrugatedRust', x + 3, eave + rise * tm + 0.22, cz + s * (d / 2) * (1 - tm), 6, 0.06, slope / 2, { rx: s * ang });
    }
    // turbinas, geradores e ponte rolante
    for (let i = 0; i < 3; i++) {
      const x = cx - 20 + i * 20;
      kit.box('concrete', x, 1.5, cz, 14, 3, 6);
      kit.cyl('steelBlue', x, 5, cz, 2.4, 2.4, 12, { rz: Math.PI / 2, seg: 16 });
      kit.cyl('steel', x + 7.5, 4.4, cz, 1.6, 1.6, 3, { rz: Math.PI / 2, seg: 14 });
    }
    kit.box('paintYellow', cx, eave - 1.5, cz - d / 2 + 1, w - 2, 0.6, 0.6);
    kit.box('paintYellow', cx, eave - 1.5, cz + d / 2 - 1, w - 2, 0.6, 0.6);
    kit.box('paintYellow', cx + 10, eave - 1.2, cz, 1, 1, d - 2);
    rubble(kit, cx - 10, cz + d / 2 + 3, 4, 18, () => 0);
  }

  // ---------------------------------------------------------------- torre de escada (ladder dive)
  stairTower(kit, STAIR);

  // ---------------------------------------------------------------- galeria da esteira: boca no chão, sai na caldeira
  {
    const a = V(78, 1.5, 70), b = V(BOILER.x + BOILER.w / 2, 24.5, -15.25); // janela de 22–27 m da parede leste
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const yaw = Math.atan2(-dir.z, dir.x);
    const pitch = Math.asin(dir.y / len);
    const e = new THREE.Euler(0, yaw, pitch, 'YXZ');
    const up = V(0, 1, 0).applyEuler(e), side = V(0, 0, 1).applyEuler(e);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const W = 3.4, Hh = 3.4;
    const at = (u, s) => mid.clone().addScaledVector(up, u).addScaledVector(side, s);
    const piece = (mat, p, sy, sz, o = {}) => kit.box(mat, p.x, p.y, p.z, len, sy, sz, { ry: yaw, rz: pitch, ...o });
    piece('steelRust', at(-Hh / 2, 0), 0.2, W + 0.4);
    piece('corrugatedRust', at(Hh / 2, 0), 0.15, W + 0.6);
    piece('corrugatedRust', at(0, -W / 2), Hh, 0.12);
    piece('corrugatedRust', at(0, W / 2), Hh, 0.12);
    piece('belt', at(-Hh / 2 + 0.3, -0.7), 0.1, 1.0, { collide: false });
    // cavaletes
    const n = Math.floor(len / 14);
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      const top = p.y - Hh / 2 - 0.2;
      if (top < 2) continue;
      for (const s of [-1, 1]) {
        const q = p.clone().addScaledVector(side, s * (W / 2 + 0.3));
        if (Math.abs(q.z - 28) < 2.5) continue; // não atravessar o rack de tubos
        kit.box('steelRust', q.x, top / 2, q.z, 0.4, top, 0.4);
      }
    }
  }
  // pilhas de carvão perto da boca da galeria
  for (const [x, z, h] of [[104, 96, 9], [118, 60, 7], [66, 104, 6]]) kit.cyl('coal', x, h / 2 - 0.2, z, 0.5, h * 1.3, h, { seg: 16 });

  // ---------------------------------------------------------------- caixa d'água, rack de tubos, subestação
  {
    const x = 104, z = -70;
    for (const [sx, sz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) kit.box('steelBlue', x + sx, 9, z + sz, 0.4, 18, 0.4);
    for (const y of [6, 12]) {
      kit.beam('steelBlue', V(x - 3, y, z - 3), V(x + 3, y, z + 3), 0.06, { square: true, collide: false });
      kit.beam('steelBlue', V(x + 3, y, z - 3), V(x - 3, y, z + 3), 0.06, { square: true, collide: false });
    }
    kit.cyl('steelBlue', x, 22, z, 5.5, 5.5, 8, { seg: 20 });
    kit.cyl('steelBlue', x, 26.8, z, 0.3, 5.8, 1.6, { seg: 20 });
  }
  for (let x = -40; x <= 60; x += 10) {
    for (const s of [-1.6, 1.6]) kit.box('steel', x, 3.5, 28 + s, 0.3, 7, 0.3);
    kit.box('steel', x, 7, 28, 0.3, 0.3, 3.6);
  }
  for (const [r, s] of [[0.5, -0.9], [0.35, 0.2], [0.3, 1.1]]) kit.cyl('rust', 10, 7.15 + r, 28 + s, r, r, 102, { rz: Math.PI / 2, seg: 10 });
  for (let i = 0; i < 6; i++) {
    const x = 98 + (i % 3) * 9, z = 2 + Math.floor(i / 3) * 10;
    kit.box('steelBlue', x, 2, z, 4, 4, 3);
    for (let k = 0; k < 3; k++) kit.cyl('paintWhite', x - 1.2 + k * 1.2, 5, z, 0.18, 0.25, 2, { seg: 8, collide: false });
  }
  powerLine(kit, [V(120, 0, 10), V(165, 0, 18), V(215, 0, 30), V(265, 0, 42), V(320, 0, 50), V(380, 0, 56)], kit.heightAt, { h: 14, sag: 2 });

  // ---------------------------------------------------------------- contêineres, entulho, muro
  container(kit, -30, 0, 55, 0.3, 'containerRed');
  container(kit, -23, 0, 52, -0.2, 'containerBlue');
  container(kit, -27, 2.6, 53.5, 0.1, 'containerGreen');
  rubble(kit, -10, 40, 5, 22, () => 0);
  rubble(kit, 85, -40, 4, 14, () => 0);
  for (const [a, b] of [[V(-YARD, 0, -YARD), V(YARD, 0, -YARD)], [V(-YARD, 0, YARD), V(YARD, 0, YARD)], [V(-YARD, 0, -YARD), V(-YARD, 0, YARD)], [V(YARD, 0, -YARD), V(YARD, 0, YARD)]]) {
    wall(kit, 'concrete', a, b, { h: 2.6, t: 0.3, bay: 7, pillar: 0.5, ruin: 0.25 });
  }

  // ---------------------------------------------------------------- vegetação
  const busy = (x, z) => CHIMNEYS.some(([cx, cz, , r0]) => Math.hypot(x - cx, z - cz) < r0 + 4)
    || (Math.abs(x - BOILER.x) < 16 && Math.abs(z - BOILER.z) < 14)
    || (Math.abs(x - HALL.x) < 36 && Math.abs(z - HALL.z) < 15)
    || (Math.abs(x - STAIR.x) < 9 && Math.abs(z - STAIR.z) < 9)
    || Math.hypot(x - 10, z - 60) < 14;
  const trees = [];
  for (const p of scatter(R, Math.round(380 * veg), -440, -440, 440, 440, (x, z) => Math.max(Math.abs(x), Math.abs(z)) > YARD + 6)) {
    trees.push({ ...p, s: 0.8 + R() * 0.7, type: R() < 0.5 ? 'oak' : R() < 0.7 ? 'pine' : 'bush' });
  }
  for (const p of scatter(R, Math.round(90 * veg), -YARD + 4, -YARD + 4, YARD - 4, YARD - 4, (x, z) => !busy(x, z))) {
    trees.push({ ...p, y: 0, s: 0.5 + R() * 0.8, type: R() < 0.8 ? 'bush' : 'oak' });
  }
  kit.trees(trees, { chunk: 140, maxDist: 450 });
  if (settings.get('graphics.grass')) {
    const pts = scatter(R, Math.round(5000 * veg), -150, -150, 150, 150, (x, z) => !busy(x, z));
    kit.grass(pts.map(p => ({ ...p, y: Math.max(Math.abs(p.x), Math.abs(p.z)) < YARD ? 0.02 : undefined, s: 0.6 + R() * 0.6 })), { dry: 0.5 });
  }

  kit.box('concrete', 10, 0.04, 60, 2.4, 0.12, 2.4);
  kit.stair = STAIR; // usado pelos testes (teleporte para o topo da torre)
  return {
    spawn: { pos: V(10, 0.3, 60), yaw: 0.25 },
    pilot: V(14, 0, 64),
    orbit: 110,
  };
}

/**
 * Torre de escada com poço central aberto (ladder dive). A escada sobe em caracol quadrado —
 * um lance em cada lado por andar, com patamar nos cantos — em volta de um poço vazio de
 * 2·well × 2·well, com guarda-corpo na beira. Telhado com abertura sobre o poço (entra por
 * cima), janelas em todo andar e uma porta larga no térreo, a oeste, por baixo do último lance
 * do térreo (sai por ela no fim do dive).
 */
function stairTower(kit, { x: cx, z: cz, floors, fh, well, run }) {
  const c = well + run / 2;             // eixo dos lances
  const inner = well + run;             // face interna das paredes
  const T = 0.3;
  const rise = fh / 4;
  const flightLen = Math.hypot(2 * well, rise), slope = Math.atan2(rise, 2 * well);
  const roofY = floors * fh + 2.6;
  // lado k: centro do lance, direção de subida, canto onde termina, beira do poço
  const SIDES = [
    { s: [0, -c], d: [1, 0], corner: [c, -c], edge: [0, -well] },
    { s: [c, 0], d: [0, 1], corner: [c, c], edge: [well, 0] },
    { s: [0, c], d: [-1, 0], corner: [-c, c], edge: [0, well] },
    { s: [-c, 0], d: [0, -1], corner: [-c, -c], edge: [-well, 0] },
  ];
  for (let f = 0; f < floors; f++) {
    SIDES.forEach(({ s, d, corner, edge }, k) => {
      const y0 = f * fh + k * rise, y1 = y0 + rise;
      const sx = cx + s[0], sz = cz + s[1];
      const ry = Math.atan2(-d[1], d[0]);
      kit.box('concreteForm', sx, (y0 + y1) / 2 - 0.12, sz, flightLen, 0.22, run, { ry, rz: slope });
      for (let i = 0; i < 5; i++) { // degraus (só visual)
        const t = (i + 0.5) / 5;
        kit.box('concrete', sx + d[0] * (t - 0.5) * 2 * well, y0 + rise * t + 0.02, sz + d[1] * (t - 0.5) * 2 * well, 2 * well / 5, 0.12, run, { ry, collide: false });
      }
      kit.box('concreteForm', cx + corner[0], y1 - 0.12, cz + corner[1], run, 0.24, run);
      // guarda-corpo na beira do poço: corrimão inclinado + montante no canto
      const ex = cx + edge[0], ez = cz + edge[1];
      const A = V(ex - d[0] * well, y0 + 1.0, ez - d[1] * well), B = V(ex + d[0] * well, y1 + 1.0, ez + d[1] * well);
      kit.beam('steelRust', A, B, 0.035, { seg: 5 });
      kit.beam('steelRust', V(B.x, y1, B.z), B, 0.03, { seg: 5, collide: false });
    });
  }
  // paredes externas (sul/norte cobrem os cantos), uma janela por andar; a oeste, só a porta
  const o = inner + T / 2;
  const wins = Array.from({ length: floors }, (_, f) => [f * fh + 1.1, f * fh + 2.3]);
  const sides = [[[-o - T / 2, -o], [o + T / 2, -o]], [[o, -o], [o, o]], [[o + T / 2, o], [-o - T / 2, o]], [[-o, o], [-o, -o]]];
  sides.forEach(([[ax, az], [bx, bz]], i) => {
    const a = V(cx + ax, 0, cz + az), b = V(cx + bx, 0, cz + bz);
    const o = { t: T, bay: 20, pillar: 1.3, winWidth: 0.5 };
    if (i !== 3) { wall(kit, 'concreteForm', a, b, { ...o, h: roofY + 1.1, windows: wins }); return; }
    // oeste: térreo com a porta, janelas dali para cima
    wall(kit, 'concreteForm', a, b, { ...o, h: fh, door: { bays: [0], h: 2.1 } });
    wall(kit, 'concreteForm', a, b, { ...o, y0: fh, h: roofY + 1.1 - fh, windows: wins.slice(0, floors - 1) });
  });
  // telhado: anel em volta da abertura do poço
  const ring = o + T / 2, ry = roofY + 0.12;
  kit.box('concrete', cx, ry, cz - (well + ring) / 2, 2 * ring, 0.25, ring - well);
  kit.box('concrete', cx, ry, cz + (well + ring) / 2, 2 * ring, 0.25, ring - well);
  kit.box('concrete', cx - (well + ring) / 2, ry, cz, ring - well, 0.25, 2 * well);
  kit.box('concrete', cx + (well + ring) / 2, ry, cz, ring - well, 0.25, 2 * well);
  // antena com luz vermelha
  kit.beam('steel', V(cx + inner - 0.5, ry, cz + inner - 0.5), V(cx + inner - 0.5, ry + 8, cz + inner - 0.5), 0.06, { seg: 5 });
  kit.box('lampRed', cx + inner - 0.5, ry + 8.1, cz + inner - 0.5, 0.3, 0.3, 0.3, { collide: false });
  // fundo do poço pintado de amarelo: o alvo do dive
  kit.box('paintYellow', cx, 0.03, cz, 2 * well, 0.06, 2 * well, { collide: false });
}
