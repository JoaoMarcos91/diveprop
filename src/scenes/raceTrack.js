// Pista de corrida reaproveitável: portões com colisão, anel verde no próximo portão,
// cronômetro de volta e melhor volta salva (por cenário).
import * as THREE from 'three';
import { V } from './common.js';

/**
 * gates: [{ x, z, base, w, h, mat, decorative?, noSupport? }] — base = altura do portão acima do chão
 * seq: ordem dos portões na volta (índices em gates); o primeiro é largada/chegada
 * key: nome usado para salvar a melhor volta
 */
export function buildRaceTrack(kit, settings, { gates: defs, seq, key, groundAt, pad = 0.22, supportMat = 'steel', deck = 'wood' }) {
  const gates = defs.map((d, i) => ({ ...d, i, y: groundAt(d.x, d.z) + (d.base || 0) }));
  // cada portão "olha" na direção da corrida (do anterior para o próximo)
  for (let k = 0; k < seq.length; k++) {
    const g = gates[seq[k]], prev = gates[seq[(k - 1 + seq.length) % seq.length]], next = gates[seq[(k + 1) % seq.length]];
    const dir = V(next.x - prev.x, 0, next.z - prev.z).normalize();
    g.yaw = Math.atan2(-dir.x, -dir.z);
  }
  for (const g of gates) if (g.yaw == null) g.yaw = g.yawFrom != null ? gates[g.yawFrom].yaw : 0;

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
    if (!g.base) place(0, -pad / 2 + 0.02, ow, pad * 0.5, pad, g.mat);
    else if (!g.noSupport) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = V(sx * (ow / 2), 0, sz * Math.min(0.8, g.w * 0.35)).applyQuaternion(q);
        const gy = groundAt(g.x + p.x, g.z + p.z);
        kit.beam(supportMat, V(g.x + p.x, gy, g.z + p.z), V(g.x + p.x, g.y, g.z + p.z), Math.max(0.015, pad * 0.22), { seg: 6 });
      }
      place(0, -0.05, ow + 0.4 * (g.w / 2.2), 0.1 * (g.w / 2.2), 2 * (g.w / 2.2), deck);
    }
  }

  // ---------------------------------------------------------------- anel do próximo portão
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5bff6a, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Group();
  kit.scene.add(ring);
  let ringFor = -1;
  const setRing = g => {
    if (ringFor === g.i) return;
    ringFor = g.i;
    ring.clear();
    const m = Math.max(0.15, g.w * 0.16);
    const w = g.w + m * 2, h = g.h + m * 2, t = Math.max(0.025, g.w * 0.03);
    const bar = (sx, sy, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, t), ringMat); b.position.set(x, y, 0); ring.add(b); };
    bar(w, t, 0, h - m);
    bar(w, t, 0, -m);
    bar(t, h, -w / 2, h / 2 - m);
    bar(t, h, w / 2, h / 2 - m);
    ring.position.set(g.x, g.y, g.z);
    ring.rotation.set(0, g.yaw, 0);
  };

  // ---------------------------------------------------------------- cronômetro
  const state = { next: 0, lap: 0, lapStart: 0, running: false, best: settings.get('game.bestLaps')?.[key] ?? null, prev: null, time: 0 };
  const local = new THREE.Vector3(), lp = new THREE.Vector3(), inv = new THREE.Quaternion(), gp = new THREE.Vector3();
  const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  setRing(gates[seq[0]]);

  const update = (dt, drone, pos, game) => {
    state.time += dt;
    if (state.prev) {
      const g = gates[seq[state.next]];
      gp.set(g.x, g.y, g.z);
      inv.setFromAxisAngle(V(0, 1, 0), -g.yaw);
      lp.copy(state.prev).sub(gp).applyQuaternion(inv);
      local.copy(pos).sub(gp).applyQuaternion(inv);
      if (lp.z > 0 && local.z <= 0) {
        const t = lp.z / (lp.z - local.z);
        const cx = lp.x + (local.x - lp.x) * t, cy = lp.y + (local.y - lp.y) * t;
        const tol = Math.max(0.05, g.w * 0.05);
        if (Math.abs(cx) < g.w / 2 + tol && cy > -tol && cy < g.h + tol) {
          if (state.next === 0) {
            if (state.running && state.lap > 0) {
              const lapT = state.time - state.lapStart;
              if (!state.best || lapT < state.best) {
                state.best = lapT;
                settings.set('game.bestLaps', { ...(settings.get('game.bestLaps') || {}), [key]: lapT }, { silent: true });
                game.osd.flash(`NOVO RECORDE ${fmt(lapT)}`, 3, '#7dff7a');
              } else game.osd.flash(`Volta ${fmt(lapT)}`, 2.5, '#ffe27a');
            } else game.osd.flash('VALENDO!', 1.2, '#7dff7a');
            state.running = true;
            state.lap++;
            state.lapStart = state.time;
          }
          game.audio.beep(state.next === 0 ? 2400 : 1600, 0.05, 1);
          game.haptics?.tick(state.next === 0 && state.lap > 1 ? 'lap' : 'gate');
          state.next = (state.next + 1) % seq.length;
          setRing(gates[seq[state.next]]);
        }
      }
    }
    state.prev = (state.prev || new THREE.Vector3()).copy(pos);
    const cur = state.running ? fmt(state.time - state.lapStart) : '--:--';
    return `VOLTA ${Math.max(1, state.lap)}  ${cur}  · PORTÃO ${state.next + 1}/${seq.length}` + (state.best ? `  · MELHOR ${fmt(state.best)}` : '');
  };

  const onRespawn = () => {
    state.next = 0; state.lap = 0; state.running = false; state.prev = null;
    setRing(gates[seq[0]]);
  };

  const dispose = () => { ring.clear(); kit.scene.remove(ring); ringMat.dispose(); };

  /** Ponto de largada: `dist` metros antes do primeiro portão, na direção da corrida. */
  const startPoint = (dist, lift = 0.25) => {
    const g0 = gates[seq[0]];
    const back = V(0, 0, dist).applyAxisAngle(V(0, 1, 0), g0.yaw);
    const p = V(g0.x + back.x, 0, g0.z + back.z);
    p.y = groundAt(p.x, p.z) + lift;
    return { pos: p, yaw: g0.yaw };
  };

  return { gates, update, onRespawn, dispose, startPoint };
}
