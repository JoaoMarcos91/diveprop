// Biblioteca de materiais (texturas CC0 da Poly Haven com reserva procedural) e céus HDRI.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { noiseTexture, windowFacadeTexture, stripeTexture } from './procTex.js';

const BASE = import.meta.env.BASE_URL + 'assets/';

// tile = metros por repetição da textura; tint multiplica a cor.
export const MATERIALS = {
  brick:          { tex: 'brick', tile: 2.5, fallback: '#8a4a3a' },
  brickSoot:      { tex: 'brick', tile: 2.5, tint: '#a39a94', fallback: '#4a3a32' },
  concrete:       { tex: 'concrete', tile: 4, fallback: '#8d8a84' },
  concreteForm:   { tex: 'concreteForm', tile: 3, fallback: '#9a9890' },
  concreteFloor:  { tex: 'concreteFloor', tile: 6, fallback: '#77746e' },
  rust:           { tex: 'rust', tile: 2.5, fallback: '#7a4a2a', metal: true },
  corrugatedRust: { tex: 'corrugatedRust', tile: 3, fallback: '#6e4630', metal: true },
  containerRed:   { tex: 'corrugated', tile: 2.6, tint: '#b04432', fallback: '#9a3a2a', metal: true },
  containerBlue:  { tex: 'corrugated', tile: 2.6, tint: '#3d6b9e', fallback: '#2f5d8a', metal: true },
  containerGreen: { tex: 'corrugated', tile: 2.6, tint: '#5d7f48', fallback: '#4b6e3a', metal: true },
  containerOrange:{ tex: 'corrugated', tile: 2.6, tint: '#c7782e', fallback: '#c06a20', metal: true },
  corrugated:     { tex: 'corrugated', tile: 3, fallback: '#8a8f94', metal: true },
  shutter:        { tex: 'shutter', tile: 3, fallback: '#55606a', metal: true },
  asphalt:        { tex: 'asphalt', tile: 5, fallback: '#3a3a3c' },
  roofTiles:      { tex: 'roofTiles', tile: 2.5, fallback: '#5a5a60' },
  wood:           { tex: 'wood', tile: 2, fallback: '#6b5038' },
  barnWood:       { tex: 'wood', tile: 2, tint: '#a8443a', fallback: '#8a3a2e' },
  plaster:        { tex: 'plaster', tile: 4, fallback: '#b8b2a6' },
  plasterDamaged: { tex: 'plasterDamaged', tile: 4, fallback: '#a8a296' },
  gravel:         { tex: 'gravel', tile: 4, fallback: '#7a7064' },
  dirt:           { tex: 'dirt', tile: 4, fallback: '#6e5a44' },
  forestFloor:    { tex: 'forestFloor', tile: 4, fallback: '#4a4030' },
  grass:          { tex: 'grass', tile: 4, mul: '#a7c27a', fallback: '#56702e' },
  barkBroad:      { tex: 'barkBroad', tile: 1.5, fallback: '#4a3a2c' },
  barkPine:       { tex: 'barkPine', tile: 1.5, fallback: '#4a3426' },
  steel:          { color: '#4a4e55', roughness: 0.45, metalness: 0.7 },
  steelRust:      { tex: 'rust', tile: 1.5, tint: '#8a8a8a', fallback: '#5a4030', metal: true },
  paintYellow:    { color: '#d8b02a', roughness: 0.6 },
  paintWhite:     { color: '#e8e8e4', roughness: 0.7 },
  black:          { color: '#141414', roughness: 0.8 },
  rubber:         { color: '#1c1c1c', roughness: 0.95 },
  glass:          { color: '#20303a', roughness: 0.08, metalness: 0.6 },
  hay:            { proc: () => noiseTexture('#c8a656', 60, 9, 6), tile: 1.5 },
  facadeA:        { proc: () => windowFacadeTexture(5, 0.12), tile: 16 },
  facadeB:        { proc: () => windowFacadeTexture(17, 0.2), tile: 16, tint: '#c9b8a0' },
  facadeC:        { proc: () => windowFacadeTexture(29, 0.08), tile: 16, tint: '#8f9aa6' },
  gateOrange:     { proc: () => stripeTexture('#ff7a1a', '#202020'), tile: 1, emissive: '#3a1400' },
  gateBlue:       { proc: () => stripeTexture('#1a8cff', '#f0f0f0'), tile: 1, emissive: '#001a3a' },
  gateGreen:      { proc: () => stripeTexture('#2bdc4a', '#101010'), tile: 1, emissive: '#04300a' },
  carRed:         { color: '#8e1b1b', roughness: 0.35, metalness: 0.5 },
  carGrey:        { color: '#7d8288', roughness: 0.35, metalness: 0.5 },
  carWhite:       { color: '#d8d8d8', roughness: 0.35, metalness: 0.4 },
  carBlue:        { color: '#1d3a6b', roughness: 0.35, metalness: 0.5 },
  water:          { color: '#2a3d40', roughness: 0.05, metalness: 0.2 },
  sand:           { tex: 'sand', tile: 4, mul: '#fff1d8', bright: 1.45, fallback: '#d8c49a' },
  rockGray:       { tex: 'boulder', tile: 3, mul: '#a29d95', fallback: '#77736c' },
  sandCoarse:     { tex: 'sandCoarse', tile: 4, fallback: '#a89070' },
  rock:           { tex: 'rock', tile: 4, fallback: '#7a7268' },
  rockyGround:    { tex: 'rockyGround', tile: 5, fallback: '#5d5a44' },
  quarry:         { tex: 'quarry', tile: 5, fallback: '#8a7c68' },
  boulder:        { tex: 'boulder', tile: 2.5, fallback: '#b8b2a6' },
  mudDry:         { tex: 'mudDry', tile: 4, fallback: '#8a6e50' },
  parquet:        { tex: 'parquet', tile: 3, fallback: '#b07a48' },
  paintedBrick:   { tex: 'paintedBrick', tile: 2.5, fallback: '#7a9aa8' },
  palmBark:       { tex: 'palmBark', tile: 1.2, fallback: '#7a6650' },
  hullWhite:      { color: '#e9ecef', roughness: 0.4 },
  hullBlue:       { color: '#24508a', roughness: 0.4 },
  hullRed:        { color: '#a8302a', roughness: 0.4 },
  canvasRed:      { color: '#c8402e', roughness: 0.9 },
  canvasYellow:   { color: '#e8b22a', roughness: 0.9 },
  canvasBlue:     { color: '#2f6fb0', roughness: 0.9 },
  courtLine:      { color: '#f2f2f0', roughness: 0.6 },
  courtBlue:      { color: '#2c5f9e', roughness: 0.55 },
  padBlue:        { color: '#1f4f8f', roughness: 0.8 },
  lampOn:         { color: '#fffaf0', emissive: '#fff6e0', roughness: 0.4 },
  lampRed:        { color: '#ff4a3a', emissive: '#ff2414', roughness: 0.4 },
  windowGlow:     { color: '#dfeefa', emissive: '#b8d4ea', roughness: 0.3 },
  steelBlue:      { color: '#2e4d6b', roughness: 0.5, metalness: 0.6 },
  belt:           { color: '#222222', roughness: 0.95 },
  coal:           { tex: 'gravel', tile: 2, tint: '#3c3c3e', fallback: '#202022' },
};

export class AssetLib {
  constructor(renderer, settings) {
    this.renderer = renderer;
    this.settings = settings;
    this.loader = new THREE.TextureLoader();
    this.texCache = new Map();
    this.pending = [];
    this.manifest = { textures: {}, hdris: {} };
  }

  async init() {
    try {
      const res = await fetch(BASE + 'manifest.json');
      if (res.ok) this.manifest = await res.json();
    } catch { /* sem assets: tudo procedural */ }
  }

  tile(key) { return MATERIALS[key]?.tile ?? 1; }

  loadTex(rel, srgb) {
    const k = rel + (srgb ? ':s' : ':l');
    if (this.texCache.has(k)) return this.texCache.get(k);
    let resolve;
    const p = new Promise(r => { resolve = r; setTimeout(r, 20000); });
    const tex = this.loader.load(BASE + rel, () => resolve(), undefined, () => { console.warn('textura ausente', rel); resolve(); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = Math.min(this.settings.get('graphics.anisotropy') || 1, this.renderer.capabilities.getMaxAnisotropy());
    this.pending.push(p);
    this.texCache.set(k, tex);
    return tex;
  }

  /** Cria um material novo para a chave (o cenário é dono e o descarta). */
  material(key, extra = {}) {
    const def = MATERIALS[key] || { color: '#ff00ff' };
    const g = this.settings.data.graphics;
    const pbr = g.pbr;
    const params = { color: new THREE.Color(def.tint || def.color || '#ffffff') };
    const files = def.tex ? this.manifest.textures?.[def.tex] : null;
    if (files?.diff) {
      params.map = this.loadTex(files.diff, true);
      if (pbr && g.normalMaps && files.nor) { params.normalMap = this.loadTex(files.nor, false); params.normalScale = new THREE.Vector2(1, 1); }
      if (pbr && files.arm) {
        const arm = this.loadTex(files.arm, false);
        params.roughnessMap = arm;
        params.aoMap = arm;
        params.aoMapIntensity = 0.7;
        // as texturas "arm" marcam quase tudo como metal; sem reflexos fortes do céu elas
        // ficam escuras demais, então usamos metal parcial fixo
        if (def.metal) params.metalness = 0.25;
      }
    } else if (def.tex) {
      params.map = noiseTexture(def.fallback || '#888', 40, key.length * 13);
      params.color = new THREE.Color(def.tint ? def.tint : '#ffffff');
      if (def.tint) params.color.multiplyScalar(1.3);
    } else if (def.proc) {
      params.map = def.proc();
    }
    if (params.map && def.tint && files?.diff) params.color = new THREE.Color(def.tint).multiplyScalar(1.6);
    if (def.mul && files?.diff) params.color = new THREE.Color(def.mul).multiplyScalar(def.bright ?? 1);
    if (def.emissive) params.emissive = new THREE.Color(def.emissive);
    Object.assign(params, extra);
    let mat;
    if (pbr) {
      mat = new THREE.MeshStandardMaterial({
        roughness: def.roughness ?? 1, metalness: def.metalness ?? 0, ...params,
      });
      if (params.roughnessMap) mat.roughness = 1;
    } else {
      const { normalMap, normalScale, roughnessMap, aoMap, aoMapIntensity, metalnessMap, metalness, roughness, ...lp } = params;
      mat = new THREE.MeshLambertMaterial(lp);
    }
    mat.name = key;
    return mat;
  }

  async ready(onProgress) {
    const all = this.pending.slice();
    let done = 0;
    await Promise.all(all.map(p => p.then(() => onProgress?.(++done / all.length))));
    this.pending = [];
  }

  // ------------------------------------------------------------------ céu
  async loadSky(key) {
    const info = this.manifest.hdris?.[key];
    if (!info) return this.fallbackSky();
    try {
      const tex = await new HDRLoader().loadAsync(BASE + info.file);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const analysis = analyzeHDR(tex);
      let env = null;
      if (this.settings.get('graphics.pbr')) {
        const pm = new THREE.PMREMGenerator(this.renderer);
        env = pm.fromEquirectangular(tex).texture;
        pm.dispose();
      }
      return { background: tex, env, ...analysis };
    } catch (e) {
      console.warn('Falha ao carregar HDRI', key, e);
      return this.fallbackSky();
    }
  }

  fallbackSky() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#3d6fb8'); grd.addColorStop(0.48, '#b9d3ea'); grd.addColorStop(0.52, '#9aa5ad'); grd.addColorStop(1, '#55595c');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return {
      background: tex, env: null,
      sunDir: new THREE.Vector3(0.4, 0.75, 0.3).normalize(), sunColor: new THREE.Color(1, 0.96, 0.9), sunIntensity: 4,
      skyColor: new THREE.Color(0.55, 0.7, 0.9), groundColor: new THREE.Color(0.35, 0.33, 0.3), fogColor: new THREE.Color(0.72, 0.8, 0.88), exposure: 1,
    };
  }
}

/**
 * Cor como ela aparece na tela depois do tone mapping ACES do three.js + sRGB.
 * (No three.js a neblina é aplicada DEPOIS do tone mapping, então precisa desta cor.)
 */
export function displayColor(c, exposure = 1) {
  const v = [c.r * exposure / 0.6, c.g * exposure / 0.6, c.b * exposure / 0.6];
  const inM = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
  const outM = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
  const mul = (m, x) => m.map(r => r[0] * x[0] + r[1] * x[1] + r[2] * x[2]);
  const fit = x => x.map(t => (t * (t + 0.0245786) - 0.000090537) / (t * (0.983729 * t + 0.4329510) + 0.238081));
  const o = mul(outM, fit(mul(inM, v))).map(t => Math.min(1, Math.max(0, t)));
  const srgb = t => (t <= 0.0031308 ? t * 12.92 : 1.055 * Math.pow(t, 1 / 2.4) - 0.055);
  return new THREE.Color(srgb(o[0]), srgb(o[1]), srgb(o[2]));
}

/** Acha o sol (pixel mais brilhante), a cor do céu e a cor do horizonte num HDRI equiretangular. */
function analyzeHDR(tex) {
  const { data, width: W, height: H } = tex.image;
  const half = data instanceof Uint16Array;
  const f = half ? THREE.DataUtils.fromHalfFloat : (x => x);
  let best = -1, bx = 0, by = 0;
  const sky = [0, 0, 0], hor = [0, 0, 0];
  let nSky = 0, nHor = 0;
  const step = 4;
  for (let y = 0; y < H; y += step) {
    const v = 1 - (y + 0.5) / H;
    const el = (v - 0.5) * Math.PI;
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      const r = f(data[i]), g = f(data[i + 1]), b = f(data[i + 2]);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > best && el > 0) { best = lum; bx = x; by = y; }
      if (el > 0.15) { sky[0] += Math.min(r, 8); sky[1] += Math.min(g, 8); sky[2] += Math.min(b, 8); nSky++; }
      if (el > 0.0 && el < 0.12) { hor[0] += Math.min(r, 8); hor[1] += Math.min(g, 8); hor[2] += Math.min(b, 8); nHor++; }
    }
  }
  const u = (bx + 0.5) / W;
  const v = 1 - (by + 0.5) / H;
  const phi = (u - 0.5) * Math.PI * 2;
  const el = (v - 0.5) * Math.PI;
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi)).normalize();
  if (sunDir.y < 0.12) { sunDir.y = 0.12; sunDir.normalize(); }
  const i = (by * W + bx) * 4;
  const sc = new THREE.Color(f(data[i]), f(data[i + 1]), f(data[i + 2]));
  const m = Math.max(sc.r, sc.g, sc.b) || 1;
  sc.multiplyScalar(1 / m);
  sc.lerp(new THREE.Color(1, 1, 1), 0.35);
  const skyColor = new THREE.Color(sky[0] / nSky, sky[1] / nSky, sky[2] / nSky);
  const fogColor = new THREE.Color(hor[0] / nHor, hor[1] / nHor, hor[2] / nHor);
  // exposição para deixar o céu médio por volta de ~0.8
  const skyLum = 0.2126 * skyColor.r + 0.7152 * skyColor.g + 0.0722 * skyColor.b;
  const exposure = THREE.MathUtils.clamp(0.62 / Math.max(skyLum, 0.05), 0.15, 3);
  // Iluminação fisicamente coerente (three.js r155+): luz hemisférica com intensidade π e cor =
  // radiância do céu reproduz um céu uniforme; o sol entra como múltiplo dessa irradiância.
  // Céu limpo (pico enorme no HDRI) → sol forte; nublado → quase só luz difusa.
  const sunRatio = THREE.MathUtils.clamp(Math.log10(Math.max(best * exposure, 1)) - 1.0, 0, 2.6);
  const sunIntensity = Math.max(0.25, Math.PI * 0.62 * sunRatio);
  const groundColor = new THREE.Color(0.36, 0.34, 0.28).multiplyScalar(skyLum * exposure);
  // neblina um pouco mais escura e azulada que o horizonte puro (que é quase branco)
  fogColor.lerp(skyColor, 0.35).multiplyScalar(0.92);
  return { sunDir, sunColor: sc, sunIntensity, skyColor: skyColor.multiplyScalar(exposure), groundColor, fogColor: fogColor.multiplyScalar(exposure), exposure, peak: best };
}
