// Cenário: Pista de Corrida — parque com portões, bandeiras, cronômetro de volta e melhor volta.
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, scatter } from './common.js';

// x, z, altura da base, largura interna, altura interna, cor
const GATES = [
  [0, 20, 0, 2.2, 2.0, 'gateOrange'],     // largada/chegada
  [0, -25, 0, 2.2, 2.0, 'gateBlue'],
  [30, -60, 0, 2.2, 2.0, 'gateOrange'],
  [70, -45, 3.5, 2.4, 2.2, 'gateBlue'],   // portão elevado
  [85, 0, 0, 2.2, 2.0, 'gateOrange'],
  [60, 40, 0, 2.2, 2.0, 'gateBlue'],
  [60, 40, 2.4, 2.2, 2.0, 'gateOrange'],  // "escada" (acima do anterior) — pula
  [20, 70, 7, 2.6, 2.4, 'gateBlue'],      // dive gate na torre
  [-35, 60, 0, 2.2, 2.0, 'gateOrange'],
  [-70, 15, 0, 2.2, 2.0, 'gateBlue'],
  [-45, -30, 0, 2.2, 2.0, 'gateOrange'],
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

  // ordem e orientação: cada portão "olha" para o próximo da sequência
  const gates = GATES.map(([x, z, base, w, h, mat], i) => ({ x, z, base, w, h, mat, i, y: H(x, z) + base }));
  for (let k = 0; k < SEQ.length; k++) {
    const g = gates[SEQ[k]], prev = gates[SEQ[(k - 1 + SEQ.length) % SEQ.length]], next = gates[SEQ[(k + 1) % SEQ.length]];
    const dir = V(next.x - prev.x, 0, next.z - prev.z).normalize();
    g.yaw = Math.atan2(-dir.x, -dir.z); // -Z local aponta para a direção de corrida
  }
  gates[6].yaw = gates[5].yaw;

  const pad = 0.22;
  for (const g of gates) {
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), g.yaw);
    const place = (lx, ly, sx, sy, sz, mat, collide = true) => {
      const p = V(lx, ly, 0).applyQuaternion(q);
      kit.box(mat, g.x + p.x, g.y + p.y, g.z + p.z, sx, sy, sz, { ry: g.yaw, collide });
    };
    const ow = g.w + pad * 2;
    place(-(g.w / 2 + pad / 2), g.h / 2, pad, g.h + pad * 2, pad, g.mat);
    place(g.w / 2 + pad / 2, g.h / 2, pad, g.h + pad * 2, pad, g.mat);
    place(0, g.h + pad / 2, ow, pad, pad, g.mat);
    if (g.base === 0) place(0, -pad / 2 + 0.02, ow, pad * 0.5, pad, g.mat);
    else if (g.i !== 6) {
      // torre/andaime de suporte
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = V(sx * (ow / 2), 0, sz * 0.8).applyQuaternion(q);
        const gy = H(g.x + p.x, g.z + p.z);
        kit.beam('steel', V(g.x + p.x, gy, g.z + p.z), V(g.x + p.x, g.y, g.z + p.z), 0.05, { seg: 6 });
      }
      place(0, -0.05, ow + 0.4, 0.1, 2, 'wood');
    }
  }
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
    kit.cyl('paintWhite', x, gy + 2, z, 0.04, 0.05, 4, { seg: 6 });
    kit.box(R() < 0.5 ? 'gateOrange' : 'gateBlue', x + 0.35, gy + 3.2, z, 0.7, 1.4, 0.03, { collide: false });
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

  // ---------------------------------------------------------------- cronometragem
  // anel verde que marca o próximo portão
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5bff6a, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Group();
  const bar = (sx, sy, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.06), ringMat); m.position.set(x, y, 0); ring.add(m); };
  kit.scene.add(ring);
  kit.meshes.push(...[]);
  const ringParts = ring;
  let ringFor = -1;
  const setRing = (g) => {
    if (ringFor === g.i) return;
    ringFor = g.i;
    ringParts.clear();
    const w = g.w + 0.7, h = g.h + 0.7;
    bar(w, 0.07, 0, h - 0.35 + 0.035);
    bar(w, 0.07, 0, -0.35 + 0.035);
    bar(0.07, h, -w / 2, h / 2 - 0.35);
    bar(0.07, h, w / 2, h / 2 - 0.35);
    ring.position.set(g.x, g.y, g.z);
    ring.rotation.set(0, g.yaw, 0);
  };

  const state = { next: 0, lap: 0, lapStart: 0, running: false, last: null, best: settings.get('game.bestLaps')?.race ?? null, prev: null, time: 0, msg: null };
  const local = new THREE.Vector3();
  const lp = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  setRing(gates[SEQ[0]]);

  const update = (dt, drone, pos, game) => {
    state.time += dt;
    if (state.prev) {
      const g = gates[SEQ[state.next]];
      inv.setFromAxisAngle(V(0, 1, 0), -g.yaw);
      lp.copy(state.prev).sub(V(g.x, g.y, g.z)).applyQuaternion(inv);
      local.copy(pos).sub(V(g.x, g.y, g.z)).applyQuaternion(inv);
      if (lp.z > 0 && local.z <= 0) {
        const t = lp.z / (lp.z - local.z);
        const cx = lp.x + (local.x - lp.x) * t, cy = lp.y + (local.y - lp.y) * t;
        if (Math.abs(cx) < g.w / 2 + 0.1 && cy > -0.1 && cy < g.h + 0.1) {
          if (state.next === 0) {
            if (state.running && state.lap > 0) {
              const lapT = state.time - state.lapStart;
              state.last = lapT;
              if (!state.best || lapT < state.best) {
                state.best = lapT;
                const best = { ...(settings.get('game.bestLaps') || {}), race: lapT };
                settings.set('game.bestLaps', best, { silent: true });
                game.osd.flash(`NOVO RECORDE ${fmt(lapT)}`, 3, '#7dff7a');
              } else game.osd.flash(`Volta ${fmt(lapT)}`, 2.5, '#ffe27a');
            } else game.osd.flash('VALENDO!', 1.2, '#7dff7a');
            state.running = true;
            state.lap++;
            state.lapStart = state.time;
          }
          game.audio.beep(state.next === 0 ? 2400 : 1600, 0.05, 1);
          game.haptics?.tick(state.next === 0 && state.lap > 1 ? 'lap' : 'gate');
          state.next = (state.next + 1) % SEQ.length;
          setRing(gates[SEQ[state.next]]);
        }
      }
    }
    state.prev = (state.prev || new THREE.Vector3()).copy(pos);
    ring.visible = true;
    const cur = state.running ? fmt(state.time - state.lapStart) : '--:--';
    return `VOLTA ${Math.max(1, state.lap)}  ${cur}  · PORTÃO ${state.next + 1}/${SEQ.length}` + (state.best ? `  · MELHOR ${fmt(state.best)}` : '');
  };

  const onRespawn = () => {
    state.next = 0; state.lap = 0; state.running = false; state.prev = null;
    setRing(gates[SEQ[0]]);
  };

  const g0 = gates[0];
  const back = V(0, 0, 12).applyAxisAngle(V(0, 1, 0), g0.yaw);
  const sp = V(g0.x + back.x, 0, g0.z + back.z);
  sp.y = H(sp.x, sp.z) + 0.25;
  kit.box('concrete', sp.x, sp.y - 0.2, sp.z, 2.4, 0.12, 2.4);
  return {
    spawn: { pos: sp, yaw: g0.yaw },
    pilot: V(sp.x + 4, 0, sp.z + 3),
    orbit: 60,
    update, onRespawn,
    dispose: () => { ring.clear(); kit.scene.remove(ring); ringMat.dispose(); },
  };
}
