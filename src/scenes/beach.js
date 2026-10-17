// Cenário: Praia — enseada com mar animado, espuma na beira, coqueiros, dunas, píer de
// madeira (voe entre os pilares), farol num promontório de pedras, barcos e quiosques.
import * as THREE from 'three';
import { fbm } from '../kit.js';
import { V, smooth, scatter, gableEnd } from './common.js';

const shoreZ = x => -20 + 14 * Math.sin(x / 95) + 6 * Math.sin(x / 31);
const HEAD = { x: 210, z: -40 }; // promontório do farol

export function buildBeach(kit, settings) {
  const veg = settings.get('graphics.vegetation');
  const R = kit.rand;

  const height = (x, z) => {
    const dz = z - shoreZ(x);
    let h;
    if (dz < 0) h = Math.max(-9, dz * 0.07);                       // fundo do mar
    else h = dz * 0.035 + smooth(45, 90, dz) * (2 + 2.5 * fbm(x / 40, z / 40, 3, 5))  // praia e dunas
      + smooth(90, 220, dz) * (10 + fbm(x / 150, z / 150, 4, 9) * 22);            // morros atrás
    // promontório rochoso entrando no mar
    const hd = Math.hypot(x - HEAD.x, (z - HEAD.z) * 1.3);
    h = Math.max(h, 24 * Math.exp(-(hd * hd) / (2 * 48 * 48)) + fbm(x / 12, z / 12, 2, 4) * 2 * smooth(70, 30, hd) - 2.5);
    return h;
  };
  const splat = (x, z) => {
    const dz = z - shoreZ(x);
    const hd = Math.hypot(x - HEAD.x, (z - HEAD.z) * 1.3);
    return Math.max(smooth(60, 100, dz) * (0.75 + 0.25 * fbm(x / 20, z / 20, 2, 7)), smooth(60, 35, hd) * 0.9);
  };
  const tint = (x, z) => {
    const dz = z - shoreZ(x);
    return 0.78 + 0.22 * smooth(-1, 7, dz) + 0.08 * fbm(x / 30, z / 30, 2, 3); // areia molhada mais escura
  };
  kit.terrain({ size: 1300, res: 210, height, splat, tint, texA: 'sand', texB: 'grass' });
  const H = kit.heightAt;

  // ---------------------------------------------------------------- mar + espuma
  kit.water({ w: 3200, d: 3200, y: 0, color: '#1e7d8c', opacity: 0.86, ripple: 9, speed: 1.2 });
  {
    // fita de espuma acompanhando a linha d'água, indo e voltando como onda
    const N = 260, x0 = -520, x1 = 520;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const x = x0 + (x1 - x0) * i / N;
      const zc = shoreZ(x);
      pos.push(x, 0.04, zc - 1.6, x, 0.04, zc + 1.1);
      uv.push(i / 4, 0, i / 4, 1);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const foamTex = foamTexture();
    const mat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.75, depthWrite: false, color: 0xffffff });
    const foam = new THREE.Mesh(geo, mat);
    kit.scene.add(foam);
    kit.meshes.push(foam);
    kit.materials.set('__foam', mat);
    let t = 0;
    kit.updaters.push(dt => { t += dt; foam.position.z = Math.sin(t * 0.7) * 0.9 - 0.3; foamTex.offset.x += dt * 0.05; mat.opacity = 0.55 + 0.25 * Math.sin(t * 0.7 + 1); });
  }

  // ---------------------------------------------------------------- píer de madeira
  {
    const px = -70, z0 = shoreZ(px) + 14, len = 95, deckY = 2.2;
    for (let i = 0; i < len; i += 4) {
      const z = z0 - i;
      kit.box('wood', px, deckY, z - 2, 4.2, 0.18, 4.05);
      for (const sx of [-1.9, 1.9]) {
        const gy = Math.min(H(px + sx, z - 2), 0.2);
        kit.cyl('wood', px + sx, (deckY + gy) / 2 - 0.1, z - 2, 0.16, 0.18, deckY - gy, { seg: 7 });
      }
      if (i % 8 === 0) for (const sx of [-2.05, 2.05]) kit.box('wood', px + sx, deckY + 0.55, z - 2, 0.08, 0.9, 0.1, { collide: false });
    }
    for (const sx of [-2.05, 2.05]) kit.box('wood', px + sx, deckY + 1.0, z0 - len / 2, 0.1, 0.08, len, { collide: true });
    // quiosque na ponta do píer
    const ez = z0 - len - 2;
    kit.box('wood', px, deckY, ez, 9, 0.2, 7);
    for (const [sx, sz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) kit.cyl('wood', px + sx, deckY - 1.5, ez + sz, 0.2, 0.22, 3.4, { seg: 7 });
    for (const [sx, sz] of [[-3.8, -2.8], [3.8, -2.8], [-3.8, 2.8], [3.8, 2.8]]) kit.cyl('wood', px + sx, deckY + 1.3, ez + sz, 0.08, 0.08, 2.4, { seg: 6 });
    kit.box('roofTiles', px, deckY + 2.65, ez, 9.4, 0.25, 7.4);
    kit.box('wood', px, deckY + 0.55, ez - 2.5, 5, 1, 0.6);
  }

  // ---------------------------------------------------------------- farol no promontório
  {
    const lx = HEAD.x + 6, lz = HEAD.z - 12, gy = H(lx, lz);
    kit.box('concrete', lx, gy + 0.5, lz, 7, 1.6, 7);
    for (let k = 0; k < 5; k++) {
      const y0 = gy + 1.2 + k * 4, r0 = 2.5 - k * 0.22, r1 = 2.5 - (k + 1) * 0.22;
      kit.cyl(k % 2 ? 'canvasRed' : 'paintWhite', lx, y0 + 2, lz, r1, r0, 4, { seg: 16 });
    }
    const top = gy + 21.2;
    kit.cyl('steel', lx, top + 0.15, lz, 2.4, 2.4, 0.3, { seg: 16 });
    kit.cyl('windowGlow', lx, top + 1.4, lz, 1.2, 1.2, 2.2, { seg: 12 });
    kit.cyl('canvasRed', lx, top + 3.0, lz, 0.2, 1.5, 1.2, { seg: 12 });
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      kit.box('steel', lx + Math.cos(ang) * 2.25, top + 0.85, lz + Math.sin(ang) * 2.25, 0.05, 1.1, 0.05, { collide: false });
    }
    kit.cyl('steel', lx, top + 1.35, lz, 2.3, 2.3, 0.06, { seg: 16, open: true, collide: false });
  }
  // pedras na base do promontório e espalhadas na praia
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, d = 40 + R() * 38;
    const x = HEAD.x + Math.cos(a) * d, z = HEAD.z + Math.sin(a) * d / 1.3;
    const s = 2 + R() * 6;
    kit.rock('rockGray', x, H(x, z) + s * 0.15, z, s * (1 + R() * 0.6), s * (0.6 + R() * 0.5), s * (0.8 + R() * 0.6));
  }
  for (const p of scatter(R, 14, -300, -60, 150, 30, (x, z) => { const dz = z - shoreZ(x); return dz > -6 && dz < 6 && Math.abs(x + 70) > 12; })) {
    const s = 0.8 + R() * 2;
    kit.rock('rockGray', p.x, H(p.x, p.z) + s * 0.1, p.z, s * 1.4, s, s * 1.2);
  }

  // ---------------------------------------------------------------- barcos ancorados
  for (const [bx, dz, ry, hull] of [[-150, -70, 0.4, 'hullWhite'], [-20, -95, -0.3, 'hullBlue'], [80, -60, 1.2, 'hullRed'], [140, -110, 0.1, 'hullWhite']]) {
    const bz = shoreZ(bx) + dz;
    kit.box(hull, bx, 0.35, bz, 7, 1.3, 2.4, { ry });
    kit.box('hullWhite', bx - Math.cos(ry) * 0.6, 1.3, bz + Math.sin(ry) * 0.6, 2.4, 0.9, 1.8, { ry });
    kit.cyl('steel', bx + Math.cos(ry) * 0.8, 5.3, bz - Math.sin(ry) * 0.8, 0.06, 0.08, 9.0, { seg: 6 });
    gableEnd(kit, 'hullWhite', bx + Math.cos(ry) * 0.8 - Math.cos(ry) * 1.6, bz - Math.sin(ry) * 0.8 + Math.sin(ry) * 1.6, 3.2, 1.6, 7.5, { t: 0.04, ry });
  }

  // ---------------------------------------------------------------- vida de praia
  const beachSpot = (x, dzMin, dzMax) => { const z = shoreZ(x) + dzMin + R() * (dzMax - dzMin); return V(x, H(x, z), z); };
  // guarda-sóis e cadeiras
  for (let i = 0; i < 22; i++) {
    const x = -260 + R() * 360;
    if (Math.abs(x + 70) < 10) continue;
    const p = beachSpot(x, 10, 34);
    kit.cyl('steel', p.x, p.y + 1.1, p.z, 0.03, 0.03, 2.2, { seg: 5, collide: false });
    kit.cyl(R() < 0.5 ? 'canvasRed' : (R() < 0.5 ? 'canvasYellow' : 'canvasBlue'), p.x, p.y + 2.25, p.z, 0.05, 1.35, 0.45, { seg: 10 });
    if (R() < 0.7) kit.box('hullWhite', p.x + 1.2, p.y + 0.25, p.z + 0.4, 0.7, 0.12, 1.8, { ry: R() * 0.5, rx: -0.15 });
  }
  // posto de salva-vidas
  {
    const p = beachSpot(25, 26, 26);
    for (const [sx, sz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) kit.cyl('wood', p.x + sx, p.y + 1.6, p.z + sz, 0.1, 0.1, 3.2, { seg: 6 });
    kit.box('wood', p.x, p.y + 3.25, p.z, 3, 0.15, 3);
    kit.box('canvasRed', p.x, p.y + 4.3, p.z + 0.4, 2.8, 2, 2.2);
    kit.box('canvasYellow', p.x, p.y + 5.4, p.z + 0.4, 3.2, 0.2, 2.6);
    for (let k = 0; k < 6; k++) kit.box('wood', p.x, p.y + 0.4 + k * 0.5, p.z - 2.0 - k * 0.15, 1, 0.06, 0.3, { collide: false });
  }
  // rede de vôlei
  {
    const p = beachSpot(-30, 22, 22);
    for (const s of [-4.5, 4.5]) kit.cyl('steel', p.x + s, p.y + 1.25, p.z, 0.05, 0.05, 2.5, { seg: 6 });
    kit.box('hullWhite', p.x, p.y + 2.1, p.z, 9, 0.9, 0.03);
  }
  // quiosques
  for (const x of [-200, -120, 60, 120]) {
    const p = beachSpot(x, 44, 44);
    kit.box('wood', p.x, p.y + 1.2, p.z, 4, 2.4, 3);
    kit.box('roofTiles', p.x, p.y + 2.6, p.z, 5, 0.25, 4, { rx: 0.08 });
    kit.box('canvasYellow', p.x, p.y + 1.6, p.z - 1.6, 3.8, 0.4, 0.2, { collide: false });
  }
  // calçadão com postes
  for (let x = -300; x <= 170; x += 4) {
    const z = shoreZ(x) + 52;
    kit.box('concrete', x + 2, H(x + 2, z) + 0.05, z, 4.05, 0.2, 6);
    if (x % 24 === 0) { const gy = H(x, z - 3); kit.cyl('steel', x, gy + 3, z - 3, 0.06, 0.08, 6, { seg: 6 }); kit.box('lampOn', x, gy + 6, z - 3.4, 0.3, 0.15, 0.8, { collide: false }); }
  }

  // ---------------------------------------------------------------- vegetação
  const trees = [];
  for (const p of scatter(R, Math.round(190 * veg), -500, -60, 420, 140, (x, z) => { const dz = z - shoreZ(x); return dz > 22 && dz < 85 && Math.abs(x + 70) > 8 && Math.hypot(x - HEAD.x, (z - HEAD.z) * 1.3) > 55; })) {
    trees.push({ ...p, s: 0.85 + R() * 0.45, type: 'palm' });
  }
  for (const p of scatter(R, Math.round(120 * veg), -550, -50, 550, 160, (x, z) => { const dz = z - shoreZ(x); return dz > 55 && dz < 110; })) trees.push({ ...p, s: 0.6 + R() * 0.7, type: 'bush' });
  for (const p of scatter(R, Math.round(260 * veg), -600, 0, 600, 600, (x, z) => z - shoreZ(x) > 105)) trees.push({ ...p, s: 0.9 + R() * 0.6, type: R() < 0.7 ? 'oak' : 'palm' });
  // coqueiros no promontório
  for (let i = 0; i < 8; i++) { const a = R() * 6.28, d = 8 + R() * 18; trees.push({ x: HEAD.x + Math.cos(a) * d, z: HEAD.z + 15 + Math.sin(a) * d * 0.6, s: 0.8 + R() * 0.3, type: 'palm' }); }
  kit.trees(trees);
  if (settings.get('graphics.grass')) {
    kit.grass(scatter(R, Math.round(4000 * veg), -320, -40, 200, 120, (x, z) => { const dz = z - shoreZ(x); return dz > 46 && dz < 100; }).map(p => ({ ...p, s: 0.6 + R() * 0.5 })), { dry: 0.4 });
  }

  const sx = -55, sz = shoreZ(-55) + 22;
  return {
    spawn: { pos: V(sx, H(sx, sz) + 0.25, sz), yaw: 0.25 },
    pilot: V(sx + 3, 0, sz + 4),
    orbit: 60,
  };
}

/** Espuma: manchas brancas suaves, repetível na horizontal. */
function foamTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 64);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 64, 2 + Math.random() * 7, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
