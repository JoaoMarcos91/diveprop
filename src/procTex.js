// Texturas geradas por código (folhagem com transparência e reservas para assets ausentes).
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * Cadeia de mipmaps feita à mão para folhagem com alpha-test: a cada nível o alfa é reforçado,
 * senão as copas "somem" à distância (a média do alfa cai abaixo do limiar de corte).
 */
function foliageMips(c) {
  const mips = [c];
  let prev = c, level = 0;
  while (prev.width > 1 || prev.height > 1) {
    level++;
    const w = Math.max(1, prev.width >> 1), h = Math.max(1, prev.height >> 1);
    const n = document.createElement('canvas');
    n.width = w; n.height = h;
    const g = n.getContext('2d');
    g.drawImage(prev, 0, 0, w, h);
    try {
      const img = g.getImageData(0, 0, w, h);
      const d = img.data;
      const boost = 1 + 0.45 * level;
      for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, d[i] * boost);
      g.putImageData(img, 0, 0);
    } catch { /* sem acesso aos pixels: usa o mip simples */ }
    mips.push(n);
    prev = n;
  }
  return mips;
}

function toTexture(c, { srgb = true, repeat = true, foliage = false } = {}) {
  if (foliage) {
    const t = new THREE.Texture();
    t.image = c;
    t.mipmaps = foliageMips(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Aglomerado de folhas (árvore frondosa) com canal alfa. */
export function leafClusterTexture(seed = 7, hue = 0.27) {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < 420; i++) {
    const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * S * 0.44;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad;
    const depth = 1 - rad / (S * 0.5);
    const l = 0.16 + 0.22 * r() + 0.12 * depth;
    g.fillStyle = `hsl(${(hue + (r() - 0.5) * 0.06) * 360}, ${45 + r() * 25}%, ${l * 100}%)`;
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI * 2);
    g.beginPath();
    g.ellipse(0, 0, 4 + r() * 6, 2 + r() * 3, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // galhinhos
  g.strokeStyle = 'rgba(60,45,30,0.8)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    g.beginPath(); g.moveTo(S / 2, S / 2);
    g.lineTo(S / 2 + (r() - 0.5) * S * 0.7, S / 2 + (r() - 0.5) * S * 0.7); g.stroke();
  }
  return toTexture(c, { repeat: false, foliage: true });
}

/** Galhos de pinheiro (agulhas) para os cones. */
export function pineTexture(seed = 3) {
  const W = 256, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(seed);
  for (let row = 0; row < 9; row++) {
    const y0 = (row + 0.5) * H / 9;
    for (let k = 0; k < 7; k++) {
      const x0 = (k + r() * 0.5) * W / 7;
      g.strokeStyle = 'rgba(70,50,35,0.9)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y0 - 10); g.lineTo(x0 + (r() - 0.5) * 8, y0 + 14); g.stroke();
      for (let n = 0; n < 80; n++) {
        const t = r();
        const px = x0 + (r() - 0.5) * 6, py = y0 - 10 + t * 24;
        const a = (r() - 0.5) * 2.4 + Math.PI / 2;
        const len = 8 + r() * 12;
        g.strokeStyle = `hsl(${120 + r() * 30}, ${30 + r() * 25}%, ${14 + r() * 18}%)`;
        g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len * 0.6); g.stroke();
      }
    }
  }
  return toTexture(c, { foliage: true });
}

/** Tufo de grama (lâminas) com alfa. */
export function grassTuftTexture(seed = 11, dry = 0) {
  const W = 128, H = 128;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const x = 8 + r() * (W - 16);
    const h = H * (0.35 + r() * 0.6);
    const bend = (r() - 0.5) * 30;
    const hue = 72 + r() * 24 - dry * 26;
    g.strokeStyle = `hsl(${hue}, ${28 + r() * 18 - dry * 10}%, ${22 + r() * 16 + dry * 10}%)`;
    g.lineWidth = 1.2 + r() * 1.6;
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + bend * 0.3, H - h * 0.6, x + bend, H - h);
    g.stroke();
  }
  return toTexture(c, { repeat: false, foliage: true });
}

/** Ruído simples como reserva para texturas que não foram baixadas. */
export function noiseTexture(base = '#888888', variance = 30, seed = 1, scale = 4) {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const r = rng(seed);
  for (let o = 0; o < 4; o++) {
    const n = 300 * (o + 1) * scale;
    const sz = (S / (4 << o));
    for (let i = 0; i < n; i++) {
      const v = (r() - 0.5) * variance;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
      g.fillRect(r() * S, r() * S, sz * r() + 1, sz * r() + 1);
    }
  }
  return toTexture(c);
}

/** Bandeira/padding listrado para os portões de corrida. */
export function stripeTexture(c1, c2) {
  const c = canvas(64, 64), g = c.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, 64, 64);
  g.fillStyle = c2;
  for (let i = -64; i < 64; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 80, 64); g.lineTo(i + 64, 64); g.fill(); }
  return toTexture(c);
}

/** Fachada de janelas (prédios vizinhos), barata: 1 textura em vez de milhares de caixas. */
export function windowFacadeTexture(seed = 5, lit = 0.15) {
  const W = 256, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#9a958c'; g.fillRect(0, 0, W, H);
  // 4 colunas x 4 andares por tile
  for (let fy = 0; fy < 4; fy++) {
    for (let fx = 0; fx < 4; fx++) {
      const x = fx * 64 + 12, y = fy * 64 + 14;
      const on = r() < lit;
      g.fillStyle = on ? `hsl(45, 70%, ${55 + r() * 20}%)` : `hsl(210, 15%, ${12 + r() * 14}%)`;
      g.fillRect(x, y, 40, 36);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x, y, 40, 4);
      g.fillStyle = '#6d6a64';
      g.fillRect(x + 19, y, 2, 36);
      g.fillStyle = '#b5b0a6';
      g.fillRect(x - 3, y + 36, 46, 4);
    }
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    g.fillRect(r() * W, r() * H, 3, 3);
  }
  return toTexture(c);
}
