// Cenário: Vale nas Montanhas — montanhas altas, rio sinuoso, lago com cachoeira saindo de um
// penhasco, ponte de concreto com pilares altos (voe por baixo), cabana e floresta de pinheiros.
import * as THREE from 'three';
import { fbm, noise2 } from '../kit.js';
import { V, smooth, scatter, gableRoof, gableEnd, wall } from './common.js';
import { waterfallTexture } from '../procTex.js';

const riverZ = x => 55 * Math.sin(x / 240) + 18 * Math.sin(x / 83);
const LAKE = { x: -260, r: 75 };
const CLIFF_X = -335;           // penhasco da cachoeira (planalto a oeste)
const PLATEAU = 34;
const BRIDGE_X = 140;

function ridged(x, z) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 5; i++) { const n = 1 - Math.abs(noise2(x * f, z * f, 31 + i * 7)); s += a * n * n; a *= 0.5; f *= 2.1; }
  return s;
}

export function buildValley(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;
  const rz0 = riverZ(LAKE.x);

  const rawHeight = (x, z) => {
    const rz = riverZ(x);
    const d = Math.abs(z - rz);
    // montanhas de até ~400 m (dives longos), com encostas largas para não virarem paredões
    const mount = ridged(x / 260, z / 260) * 450 + fbm(x / 60, z / 60, 3, 4) * 12;
    let floor = 2.2 + fbm(x / 80, z / 80, 3, 11) * 0.8;
    // leito do rio (fundo e com margens bem definidas, sem "listras" na linha d'água)
    floor = THREE.MathUtils.lerp(-3.2, floor, smooth(14, 19, d));
    // lago
    const ld = Math.hypot(x - LAKE.x, (z - rz0) * 0.9);
    floor = Math.min(floor, THREE.MathUtils.lerp(-4, floor, smooth(LAKE.r * 0.7, LAKE.r * 1.05, ld)));
    let h = THREE.MathUtils.lerp(floor, mount, smooth(30, 240, Math.min(d, ld)));
    // planalto do penhasco, a oeste do lago (degrau íngreme e irregular)
    const cx = CLIFF_X + fbm(z / 30, 3.3, 2, 17) * 10 * smooth(4, 20, Math.abs(z - rz0));
    const cliff = smooth(cx + 6, cx - 6, x);
    // planalto sempre ≥ PLATEAU: a água do poço (PLATEAU − 1,4) nunca fica rente ao chão
    h = Math.max(h, cliff * (PLATEAU + Math.abs(fbm(x / 40, z / 40, 2, 5)) * 2));
    return h;
  };
  // pico para dives: o ponto mais alto perto do vale tem a ponta aparada num platô, onde fica
  // a plataforma (assim nenhuma agulha de rocha fica acima dela)
  let peak = null;
  for (let x = -240; x <= 240; x += 6) for (let z = -400; z <= 400; z += 6) {
    const d = Math.abs(z - riverZ(x));
    if (d < 60 || d > 280) continue;
    const h = rawHeight(x, z);
    if (!peak || h > peak.h) peak = { x, z, h };
  }
  for (let x = peak.x - 6; x <= peak.x + 6; x++) for (let z = peak.z - 6; z <= peak.z + 6; z++) {
    const h = rawHeight(x, z);
    if (h > peak.h) peak = { x, z, h };
  }
  const padY = peak.h - 3;
  const height = (x, z) => {
    const h = rawHeight(x, z);
    const dd = Math.hypot(x - peak.x, z - peak.z);
    return dd < 16 ? Math.min(h, THREE.MathUtils.lerp(padY, h + 50, smooth(7, 16, dd))) : h;
  };
  const splat = (x, z) => {
    const h = height(x, z);
    const slope = Math.abs(height(x + 2, z) - height(x - 2, z)) + Math.abs(height(x, z + 2) - height(x, z - 2));
    return Math.min(1, smooth(1.4, 3.4, slope) + smooth(170, 260, h) + smooth(2.0, 0.5, h) * 0.6);
  };
  const tint = (x, z) => 0.85 + 0.2 * fbm(x / 70, z / 70, 2, 13);
  kit.terrain({ size: 1300, res: 300, height, splat, tint, texA: 'grass', texB: 'rock' });
  const H = kit.heightAt;

  // ---------------------------------------------------------------- água: rio + lago, e o poço no planalto
  kit.water({ w: 1400, d: 1400, y: 0, color: '#2b6c73', opacity: 0.96, ripple: 7, speed: 1.6 });

  // ---------------------------------------------------------------- cachoeira
  {
    const tex = waterfallTexture(8);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 3);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff });
    // a cortina d'água desce da beira do penhasco até o lago, um pouco à frente da rocha
    const top = V(CLIFF_X - 5, PLATEAU - 0.5, rz0), bot = V(CLIFF_X + 10, 0.2, rz0);
    const len = top.distanceTo(bot);
    const geo = new THREE.PlaneGeometry(6, len).rotateY(Math.PI / 2).rotateZ(Math.atan2(-(top.x - bot.x), top.y - bot.y));
    const curtain = new THREE.Mesh(geo, mat);
    curtain.position.copy(top).add(bot).multiplyScalar(0.5);
    kit.scene.add(curtain);
    kit.meshes.push(curtain);
    kit.materials.set('__fall', mat);
    // névoa na base: bolhas macias que pulsam
    const mistMat = new THREE.MeshBasicMaterial({ map: mistTexture(), transparent: true, opacity: 0.55, depthWrite: false, color: 0xffffff, side: THREE.DoubleSide });
    const mists = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), mistMat);
      m.position.set(CLIFF_X + 8 + R() * 4, 2.5 + R() * 2, rz0 + (R() - 0.5) * 8);
      m.rotation.y = R() * Math.PI;
      kit.scene.add(m);
      kit.meshes.push(m);
      mists.push(m);
    }
    kit.materials.set('__mist', mistMat);
    let t = 0;
    kit.updaters.push(dt => {
      t += dt;
      tex.offset.y += dt * 1.4;
      mists.forEach((m, i) => { m.rotation.y += dt * (0.1 + i * 0.03); m.scale.setScalar(1 + 0.12 * Math.sin(t * 1.3 + i)); });
    });
    // pedras na borda do penhasco, de onde a água sai
    for (let i = 0; i < 7; i++) {
      const s = 1.2 + R() * 2;
      const z = rz0 + (i - 3) * 1.6 + (R() - 0.5);
      if (Math.abs(z - rz0) < 2.5) continue;
      kit.rock('rockGray', CLIFF_X - 6 - R() * 3, PLATEAU + s * 0.2, z, s * 1.3, s, s * 1.2);
    }
    for (let i = 0; i < 10; i++) {
      const s = 1.5 + R() * 3;
      kit.rock('rockGray', CLIFF_X + 9 + R() * 10, s * 0.2, rz0 + (R() - 0.5) * 22, s * 1.4, s, s * 1.2);
    }
  }

  // ---------------------------------------------------------------- ponte de concreto
  {
    const bx = BRIDGE_X, rz = riverZ(bx), deckY = 26;
    const half = 120;
    kit.box('concrete', bx, deckY, rz, 9, 1.4, half * 2);
    kit.box('asphalt', bx, deckY + 0.72, rz, 7, 0.05, half * 2, { collide: false });
    for (const sx of [-4.3, 4.3]) kit.box('concreteForm', bx + sx, deckY + 1.25, rz, 0.4, 1.1, half * 2);
    for (const pz of [-46, -15, 15, 46]) {
      const z = rz + pz;
      const gy = Math.min(H(bx, z), 0);
      kit.box('concreteForm', bx, (deckY + gy) / 2 - 0.5, z, 6, deckY - gy, 2.6);
      kit.box('concreteForm', bx, deckY - 1.6, z, 9.6, 1.6, 3.2);
    }
    for (let z = -half; z <= half; z += 30) { kit.cyl('steel', bx + 4.2, deckY + 4, rz + z, 0.08, 0.1, 6, { seg: 6 }); kit.box('lampOn', bx + 3.5, deckY + 6.9, rz + z, 1.4, 0.15, 0.3, { collide: false }); }
  }

  // ---------------------------------------------------------------- cabana com deque
  {
    const cx = 30, cz = riverZ(30) + 48, gy = H(cx, cz);
    const w = 8, d = 6, eave = 3;
    kit.box('concrete', cx, gy + 0.2, cz, w + 0.6, 0.8, d + 0.6);
    const y0 = gy + 0.6;
    wall(kit, 'wood', V(cx - w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz - d / 2), { y0, h: eave, t: 0.25, bay: 2.7, pillar: 0.6, windows: [[1, 2]], winWidth: 0.6, door: { bays: [1], h: 2.1 } });
    wall(kit, 'wood', V(cx - w / 2, 0, cz + d / 2), V(cx + w / 2, 0, cz + d / 2), { y0, h: eave, t: 0.25, bay: 2.7, pillar: 0.6, windows: [[1, 2]], winWidth: 0.6 });
    wall(kit, 'wood', V(cx - w / 2, 0, cz - d / 2), V(cx - w / 2, 0, cz + d / 2), { y0, h: eave, t: 0.25, bay: 3, pillar: 0.6 });
    wall(kit, 'wood', V(cx + w / 2, 0, cz - d / 2), V(cx + w / 2, 0, cz + d / 2), { y0, h: eave, t: 0.25, bay: 3, pillar: 0.6 });
    gableRoof(kit, 'roofTiles', cx, cz, w, d, y0 + eave, 2.6, { over: 0.5 });
    gableEnd(kit, 'wood', cx, cz - d / 2, w, y0 + eave, 2.6, { t: 0.25 });
    gableEnd(kit, 'wood', cx, cz + d / 2, w, y0 + eave, 2.6, { t: 0.25 });
    kit.box('rock', cx + 2.5, y0 + eave + 2.2, cz + 1, 0.8, 2.4, 0.8);
    // deque sobre o rio
    const dz = riverZ(30) + 14;
    for (let z = cz - d / 2 - 1; z > dz; z -= 2) kit.box('wood', cx, Math.max(H(cx, z), 0.3) + 0.5, z, 2.2, 0.12, 2.05);
    for (let i = 0; i < 3; i++) kit.box('wood', cx + (i - 1) * 3, 0.5, dz - 2, 3, 0.12, 4);
  }

  // ---------------------------------------------------------------- pedras no rio e na encosta
  for (let i = 0; i < 40; i++) {
    const x = -220 + R() * 520, z = riverZ(x) + (R() - 0.5) * 40;
    const s = 0.8 + R() * 3.2;
    kit.rock('rockGray', x, H(x, z) + s * 0.15, z, s * 1.4, s, s * 1.2);
  }
  for (const p of scatter(R, 40, -600, -600, 600, 600, (x, z) => { const h = H(x, z); return h > 40 && h < 280; })) {
    const s = 4 + R() * 9;
    kit.rock('rockGray', p.x, H(p.x, p.z) + s * 0.1, p.z, s * 1.3, s * 0.8, s, { detail: 1 });
  }

  // ---------------------------------------------------------------- floresta
  const trees = [];
  const okTree = (x, z) => {
    const h = H(x, z);
    if (h < 1.5 || h > 230) return false;
    const slope = Math.abs(H(x + 3, z) - H(x - 3, z)) + Math.abs(H(x, z + 3) - H(x, z - 3));
    return slope < 11 && Math.abs(x - BRIDGE_X) > 8 && Math.hypot(x - 30, z - riverZ(30) - 48) > 9;
  };
  for (const p of scatter(R, Math.round(700 * veg), -620, -620, 620, 620, (x, z) => okTree(x, z) && fbm(x / 120, z / 120, 2, 21) > -0.15)) {
    trees.push({ ...p, s: 0.8 + R() * 0.8, type: R() < 0.82 ? 'pine' : 'oak' });
  }
  for (const p of scatter(R, Math.round(140 * veg), -400, -200, 400, 200, (x, z) => { const d = Math.abs(z - riverZ(x)); return d > 24 && d < 70 && okTree(x, z); })) trees.push({ ...p, s: 0.6 + R() * 0.7, type: 'bush' });
  kit.trees(trees, { chunk: 160, maxDist: 420 });
  if (settings.get('graphics.grass')) {
    kit.grass(scatter(R, Math.round(6000 * veg), -200, -200, 260, 200, (x, z) => { const d = Math.abs(z - riverZ(x)); const h = H(x, z); return d > 20 && h > 0.8 && h < 18; }).map(p => ({ ...p, s: 0.6 + R() * 0.6 })));
  }

  // ---------------------------------------------------------------- plataforma do pico (dives)
  const relays = [];
  {
    const { x, z } = peak;
    kit.box('concrete', x, padY - 1.75, z, 4.4, 4, 4.4);
    kit.cyl('paintWhite', x + 1.7, padY + 3, z + 1.7, 0.06, 0.08, 6, { seg: 6 });
    kit.box('gateOrange', x + 2.4, padY + 5.2, z + 1.7, 1.4, 1.4, 0.04, { collide: false });
    // repetidora de vídeo: mastro com antenas e caixa (o sinal vale a partir daqui também)
    kit.cyl('steel', x - 1.6, padY + 3.5, z - 1.6, 0.05, 0.07, 7, { seg: 6 });
    kit.box('paintWhite', x - 1.6, padY + 1.4, z - 1.25, 0.5, 0.6, 0.25);
    for (const a of [0, 2.1, 4.2]) kit.box('paintWhite', x - 1.6 + Math.cos(a) * 0.2, padY + 6.6, z - 1.6 + Math.sin(a) * 0.2, 0.08, 0.9, 0.08, { collide: false });
    kit.box('lampRed', x - 1.6, padY + 7.1, z - 1.6, 0.14, 0.14, 0.14, { collide: false });
    kit.summit = { x, z, h: padY + 0.25 };
    relays.push({ x: x - 1.6, y: padY + 7.6, z: z - 1.6 });
  }

  const sx = -20, sz = riverZ(-20) + 32;
  return {
    spawn: { pos: V(sx, H(sx, sz) + 0.25, sz), yaw: Math.PI * 0.5 },
    pilot: V(sx + 3, 0, sz + 3),
    relays,
    orbit: 80,
  };
}

/** Névoa: mancha branca radial e irregular. */
function mistTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 40, r = 18 + Math.random() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
