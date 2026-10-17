// Ferramentas para montar cenários: caixas/cilindros agrupados por material (poucos draw
// calls), colisores do Rapier, terreno com mistura de texturas, árvores e grama instanciadas.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { leafClusterTexture, pineTexture, grassTuftTexture, palmFrondTexture, rippleNormalTexture } from './procTex.js';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// Ruído de valor 2D suave + fbm (determinístico)
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, y, oct = 4, seed = 0) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f, seed + i * 17); a *= 0.5; f *= 2.03; }
  return s;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

const geoCache = new Map();

/** Ponto do eixo do tronco do coqueiro em t ∈ [0,1] (altura 8 m, inclina até 1,6 m em +X). */
function palmTop(t) { return new THREE.Vector3(1.6 * t * t, 8 * t, 0); }

export class Kit {
  constructor({ scene, world, lib, settings, seed = 1, skyColor = null }) {
    this.skyColor = skyColor || new THREE.Color(0.55, 0.65, 0.75);
    this.scene = scene;
    this.world = world;
    this.lib = lib;
    this.settings = settings;
    this.rand = rng(seed);
    this.batches = new Map();
    this.materials = new Map();
    this.meshes = [];
    this.chunks = [];       // { mesh, center, radius, maxDist }
    this.updaters = [];
    this.staticBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.colliderCount = 0;
    this.colPos = [];
    this.colIdx = [];
    this.heightAt = () => 0;
  }

  mat(key, extra) {
    const id = key + (extra ? JSON.stringify(Object.keys(extra)) : '');
    if (!this.materials.has(id)) this.materials.set(id, this.lib.material(key, extra));
    return this.materials.get(id);
  }

  batch(key) {
    if (!this.batches.has(key)) this.batches.set(key, { pos: [], nor: [], uv: [], idx: [], cast: true });
    return this.batches.get(key);
  }

  // ------------------------------------------------------------ colisores
  // IMPORTANTE: o custo do world.step() do Rapier cresce com o NÚMERO de colisores, mesmo
  // estáticos (3000 colisores ≈ 2–4 ms por passo). Por isso todas as formas estáticas são
  // trianguladas e fundidas num único trimesh no flush() (≈ 0,1 ms por passo).
  collider(shape, x, y, z, quat) {
    let geo;
    switch (shape.type) {
      case 'cuboid': geo = new THREE.BoxGeometry(shape.hx * 2, shape.hy * 2, shape.hz * 2); break;
      case 'cylinder': geo = new THREE.CylinderGeometry(shape.r, shape.r, shape.hh * 2, shape.seg || 8); break;
      case 'cone': geo = new THREE.ConeGeometry(shape.r, shape.hh * 2, shape.seg || 8); break;
      case 'capsule': geo = new THREE.CylinderGeometry(shape.r, shape.r, (shape.hh + shape.r) * 2, 6); break;
      case 'ball': geo = new THREE.IcosahedronGeometry(shape.r * 1.08, 0); break;
      case 'tris': geo = shape.geometry; break;
      default: return;
    }
    _m.compose(_p.set(x, y, z), quat || _q.identity(), _s.set(1, 1, 1));
    const pos = geo.attributes.position;
    const base = this.colPos.length / 3;
    for (let i = 0; i < pos.count; i++) {
      _n.fromBufferAttribute(pos, i).applyMatrix4(_m);
      this.colPos.push(_n.x, _n.y, _n.z);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.colIdx.push(base + geo.index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.colIdx.push(base + i);
    this.colliderCount++;
  }

  finalizeColliders() {
    if (!this.colIdx.length) return;
    const desc = RAPIER.ColliderDesc.trimesh(new Float32Array(this.colPos), new Uint32Array(this.colIdx));
    this.world.createCollider(desc, this.staticBody);
    this.colTris = this.colIdx.length / 3;
    this.colPos = []; this.colIdx = [];
  }

  // ------------------------------------------------------------ primitivas
  /** Caixa centrada em (x,y,z) com tamanho (sx,sy,sz). UVs em metros (textura sem esticar). */
  box(key, x, y, z, sx, sy, sz, o = {}) {
    const { rx = 0, ry = 0, rz = 0, collide = true } = o;
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
    _nm.getNormalMatrix(_m);
    const b = this.batch(key);
    const k = 1 / this.lib.tile(key);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const ou = this.rand() * 4, ov = this.rand() * 4;
    // 6 faces: normal, eixo u, eixo v
    const faces = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0], sz, sy, hx],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0], sz, sy, hx],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1], sx, sz, hy],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1], sx, sz, hy],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0], sx, sy, hz],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0], sx, sy, hz],
    ];
    for (const [nrm, uAx, vAx, w, h, d] of faces) {
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      _n.set(nrm[0], nrm[1], nrm[2]).applyMatrix3(_nm).normalize();
      const base = b.pos.length / 3;
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      for (const [cu, cv] of corners) {
        const px = nrm[0] * d + uAx[0] * cu * w / 2 + vAx[0] * cv * h / 2;
        const py = nrm[1] * d + uAx[1] * cu * w / 2 + vAx[1] * cv * h / 2;
        const pz = nrm[2] * d + uAx[2] * cu * w / 2 + vAx[2] * cv * h / 2;
        _p.set(px, py, pz).applyMatrix4(_m);
        b.pos.push(_p.x, _p.y, _p.z);
        b.nor.push(_n.x, _n.y, _n.z);
        b.uv.push(((cu + 1) / 2 * w) * k + ou, ((cv + 1) / 2 * h) * k + ov);
      }
    }
    if (collide) this.collider({ type: 'cuboid', hx, hy, hz }, x, y, z, _q.clone());
  }

  /** Cilindro/cone vertical (ou girado) centrado em (x,y,z). */
  cyl(key, x, y, z, rTop, rBot, h, o = {}) {
    const { rx = 0, ry = 0, rz = 0, seg = 10, collide = true, open = false } = o;
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
    const k = 1 / this.lib.tile(key);
    const uv = geo.attributes.uv;
    const circ = Math.PI * (rTop + rBot);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ * k, uv.getY(i) * h * k);
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
    this.addGeometry(key, geo, _m);
    if (collide) {
      const r = Math.max(rTop, rBot);
      const isCone = Math.min(rTop, rBot) < r * 0.6;
      const desc = { type: isCone ? 'cone' : 'cylinder', hh: h / 2, r, seg: Math.min(seg, 12) };
      const q = _q.clone();
      if (isCone && rTop > rBot) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
      this.collider(desc, x, y, z, q);
    }
  }

  /** Viga/cilindro ligando dois pontos (cabos, treliças, vergalhões). */
  beam(key, a, b, radius, o = {}) {
    const { seg = 6, collide = true, square = false } = o;
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const geo = square ? new THREE.BoxGeometry(radius * 2, len, radius * 2) : new THREE.CylinderGeometry(radius, radius, len, seg, 1, true);
    const k = 1 / this.lib.tile(key);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * radius * 6 * k, uv.getY(i) * len * k);
    _m.compose(mid, q, _s.set(1, 1, 1));
    this.addGeometry(key, geo, _m);
    if (collide) {
      // fios finos ganham um colisor um pouco mais grosso (evita atravessar em alta velocidade)
      const desc = square ? { type: 'cuboid', hx: radius, hy: len / 2, hz: radius } : { type: 'capsule', hh: len / 2, r: Math.max(radius, 0.04) };
      this.collider(desc, mid.x, mid.y, mid.z, q);
    }
  }

  addGeometry(key, geo, matrix) {
    const b = this.batch(key);
    const g = geo;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const base = b.pos.length / 3;
    if (g.index) for (let i = 0; i < g.index.count; i++) b.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
    _nm.getNormalMatrix(matrix);
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      b.pos.push(_p.x, _p.y, _p.z);
      _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      b.nor.push(_n.x, _n.y, _n.z);
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
  }

  /** Converte os lotes em meshes (1 draw call por material). */
  flush() {
    const shadows = this.settings.get('graphics.shadows') > 0;
    for (const [key, b] of this.batches) {
      if (!b.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      // IMPORTANTE: geometria sempre indexada. No Safari + GPU Intel antiga (ANGLE/Metal),
      // drawArrays (não indexado) chega a ser 100× mais lento que drawElements.
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(b.idx), 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.mat(key));
      mesh.castShadow = shadows && b.cast;
      mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.batches.clear();
    this.finalizeColliders();
  }

  // ------------------------------------------------------------ terreno
  /**
   * Terreno quadrado de lado `size` centrado na origem.
   * height(x,z) → altura; splat(x,z) → 0..1 (mistura texA→texB); tint(x,z) → brilho 0.7..1.2
   */
  terrain({ size, res, height, splat = () => 0, tint = () => 1, texA = 'grass', texB = 'dirt' }) {
    const detail = this.settings.get('graphics.terrainDetail') || 1;
    const N = Math.max(32, Math.round(res * detail));
    const step = size / N;
    const verts = (N + 1) * (N + 1);
    const pos = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const sp = new Float32Array(verts);
    const col = new Float32Array(verts * 3);
    const heights = new Float32Array(verts);
    const k = 1 / this.lib.tile(texA);
    for (let j = 0, i = 0; j <= N; j++) {
      for (let x = 0; x <= N; x++, i++) {
        const wx = -size / 2 + x * step, wz = -size / 2 + j * step;
        const h = height(wx, wz);
        heights[i] = h;
        pos.set([wx, h, wz], i * 3);
        uv.set([wx * k, wz * k], i * 2);
        sp[i] = splat(wx, wz);
        const t = tint(wx, wz);
        col.set([t, t, t], i * 3);
      }
    }
    const idx = new Uint32Array(N * N * 6);
    for (let j = 0, n = 0; j < N; j++) {
      for (let x = 0; x < N; x++) {
        const a = j * (N + 1) + x, b = a + 1, c = a + N + 1, d = c + 1;
        idx.set([a, c, b, b, c, d], n); n += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('splat', new THREE.BufferAttribute(sp, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = this.lib.material(texA, { vertexColors: true });
    const matB = this.lib.material(texB);
    const map2 = matB.map;
    const uvMul2 = this.lib.tile(texA) / this.lib.tile(texB);
    mat.onBeforeCompile = shader => {
      shader.uniforms.map2 = { value: map2 };
      shader.uniforms.uvMul2 = { value: uvMul2 };
      shader.vertexShader = 'attribute float splat;\nvarying float vSplat;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvSplat = splat;');
      shader.fragmentShader = 'uniform sampler2D map2;\nuniform float uvMul2;\nvarying float vSplat;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 c1 = mix(texture2D(map, vMapUv), texture2D(map, vMapUv * 0.137 + 0.31), 0.42);
  vec2 uv2 = vMapUv * uvMul2;
  vec4 c2 = mix(texture2D(map2, uv2), texture2D(map2, uv2 * 0.21 + 0.17), 0.4);
  diffuseColor *= mix(c1, c2, smoothstep(0.05, 0.95, vSplat));
#endif`);
    };
    mat.customProgramCacheKey = () => 'terrain-splat';
    this.materials.set('__terrainB', matB);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = this.settings.get('graphics.shadows') > 0;
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.materials.set('__terrain', mat);

    this.world.createCollider(RAPIER.ColliderDesc.trimesh(pos, idx), this.staticBody);

    this.heightAt = (x, z) => {
      const fx = (x + size / 2) / step, fz = (z + size / 2) / step;
      const ix = Math.max(0, Math.min(N - 1, Math.floor(fx))), iz = Math.max(0, Math.min(N - 1, Math.floor(fz)));
      const tx = Math.min(1, Math.max(0, fx - ix)), tz = Math.min(1, Math.max(0, fz - iz));
      const a = heights[iz * (N + 1) + ix], b = heights[iz * (N + 1) + ix + 1];
      const c = heights[(iz + 1) * (N + 1) + ix], d = heights[(iz + 1) * (N + 1) + ix + 1];
      // mesma triangulação do mesh
      if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
      return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
    };
    return mesh;
  }

  // ------------------------------------------------------------ vegetação
  treeGeometries(type) {
    if (geoCache.has(type)) return geoCache.get(type);
    const r = rng(type.length * 99 + 7);
    let trunk, canopy;
    const merge = (parts) => {
      let n = 0; parts.forEach(p => { n += p.attributes.position.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      const idx = [];
      let o = 0;
      for (const p of parts) {
        pos.set(p.attributes.position.array, o * 3);
        nor.set(p.attributes.normal.array, o * 3);
        uv.set(p.attributes.uv.array, o * 2);
        if (p.index) for (let i = 0; i < p.index.count; i++) idx.push(o + p.index.getX(i));
        else for (let i = 0; i < p.attributes.position.count; i++) idx.push(o + i);
        o += p.attributes.position.count;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    };
    const scaleUV = (g, su, sv) => { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * su, a.getY(i) * sv); return g; };
    const cards = (n, center, radii, size) => {
      const list = [];
      for (let i = 0; i < n; i++) {
        const g = new THREE.PlaneGeometry(size, size);
        const p = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2);
        if (p.length() > 1) p.normalize();
        p.multiply(radii).add(center);
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI)));
        g.translate(p.x, p.y, p.z);
        // normais "esféricas" = sombreamento arredondado da copa
        const pa = g.attributes.position, na = g.attributes.normal;
        for (let k = 0; k < pa.count; k++) {
          _n.set(pa.getX(k) - center.x, (pa.getY(k) - center.y) * 1.2 + radii.y * 0.3, pa.getZ(k) - center.z).normalize();
          na.setXYZ(k, _n.x, _n.y, _n.z);
        }
        list.push(g);
      }
      return merge(list);
    };
    if (type === 'oak') {
      const parts = [scaleUV(new THREE.CylinderGeometry(0.17, 0.3, 4.2, 7, 1, true).translate(0, 2.1, 0), 1.2, 3)];
      for (let i = 0; i < 4; i++) {
        const b = new THREE.CylinderGeometry(0.06, 0.12, 2.2, 5, 1, true);
        b.translate(0, 1.1, 0);
        b.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.7 + r() * 0.4, (i / 4) * Math.PI * 2 + r(), 0, 'YXZ')));
        b.translate(0, 3.2 + r() * 0.6, 0);
        parts.push(scaleUV(b, 0.5, 1.5));
      }
      trunk = merge(parts);
      canopy = cards(22, new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(2.4, 1.8, 2.4), 2.8);
    } else if (type === 'pine') {
      trunk = merge([scaleUV(new THREE.CylinderGeometry(0.1, 0.26, 10, 7, 1, true).translate(0, 5, 0), 1, 6)]);
      const tiers = [];
      const n = 6;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const rad = 2.7 * (1 - t) + 0.5;
        const h = 2.8 - t * 0.9;
        const c = new THREE.ConeGeometry(rad, h, 9, 1, true);
        c.rotateY(r() * Math.PI);
        c.translate(0, 2.4 + t * 8.2 + h / 2, 0);
        scaleUV(c, 3 + rad, 1);
        tiers.push(c);
      }
      canopy = merge(tiers);
    } else if (type === 'palm') {
      // coqueiro: tronco curvo (inclina para +X) e folhas caídas em volta da copa
      const top = palmTop(1);
      const segs = [];
      for (let i = 0; i < 8; i++) {
        const a = palmTop(i / 8), b = palmTop((i + 1) / 8);
        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length();
        const c = new THREE.CylinderGeometry(0.2 - i * 0.008 - 0.008, 0.2 - i * 0.008, len * 1.04, 7, 1, true);
        scaleUV(c, 1.3, len / 1.2);
        c.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1)));
        segs.push(c);
      }
      trunk = merge(segs);
      const fronds = [];
      for (let k = 0; k < 11; k++) {
        const f = new THREE.PlaneGeometry(1.1, 3.8, 1, 6);
        f.translate(0, 1.9, 0);
        f.rotateX(-Math.PI / 2); // comprimento ao longo de -Z
        const pa = f.attributes.position, na = f.attributes.normal;
        const lift = 0.35 + r() * 0.35;
        for (let i = 0; i < pa.count; i++) {
          const d = -pa.getZ(i);
          pa.setY(i, d * lift - 0.11 * d * d);
          na.setXYZ(i, 0, 1, 0);
        }
        f.rotateY((k / 11) * Math.PI * 2 + r() * 0.4);
        f.translate(top.x, top.y, top.z);
        fronds.push(f);
      }
      canopy = merge(fronds);
    } else { // bush
      trunk = null;
      canopy = cards(12, new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(1.1, 0.7, 1.1), 1.5);
    }
    const out = { trunk, canopy };
    geoCache.set(type, out);
    return out;
  }

  foliageMaterial(type) {
    const id = 'foliage-' + type;
    if (this.materials.has(id)) return this.materials.get(id);
    const tex = type === 'pine' ? pineTexture(5) : type === 'palm' ? palmFrondTexture(13) : leafClusterTexture(type === 'bush' ? 21 : 7, type === 'bush' ? 0.25 : 0.27);
    if (type === 'pine') tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const pbr = this.settings.get('graphics.pbr');
    const params = { map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xffffff };
    const m = pbr ? new THREE.MeshStandardMaterial({ ...params, roughness: 0.85, metalness: 0 }) : new THREE.MeshLambertMaterial(params);
    this.materials.set(id, m);
    return m;
  }

  /**
   * Árvores instanciadas por pedaços (culling por distância). list: [{x,z,s,type,y?}]
   */
  trees(list, { chunk = 128, collide = true, maxDist = Infinity } = {}) {
    const shadows = this.settings.get('graphics.shadows') > 0;
    const byType = new Map();
    for (const t of list) {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type).push(t);
    }
    for (const [type, items] of byType) {
      const geos = this.treeGeometries(type);
      const barkKey = type === 'pine' ? 'barkPine' : type === 'palm' ? 'palmBark' : 'barkBroad';
      const cells = new Map();
      for (const t of items) {
        const key = Math.floor(t.x / chunk) + ',' + Math.floor(t.z / chunk);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(t);
        if (t.y == null) t.y = this.heightAt(t.x, t.z) - 0.15;
        if (t.rot == null) t.rot = this.rand() * Math.PI * 2;
        if (collide) {
          const s = t.s;
          if (type === 'palm') {
            // tronco inclinado: um cilindro do pé até a copa, girado como a instância
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
            const top = palmTop(1).multiplyScalar(s).applyQuaternion(q);
            const dir = top.clone().normalize();
            const qc = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            this.collider({ type: 'cylinder', hh: top.length() / 2, r: 0.22 * s, seg: 6 }, t.x + top.x / 2, t.y + top.y / 2, t.z + top.z / 2, qc);
            this.collider({ type: 'ball', r: 1.4 * s }, t.x + top.x, t.y + top.y + 0.2 * s, t.z + top.z);
          } else if (type === 'oak') {
            this.collider({ type: 'cylinder', hh: 2.3 * s, r: 0.28 * s, seg: 6 }, t.x, t.y + 2.3 * s, t.z);
            this.collider({ type: 'ball', r: 1.9 * s }, t.x, t.y + 5.5 * s, t.z);
          } else if (type === 'pine') {
            this.collider({ type: 'cylinder', hh: 5 * s, r: 0.24 * s, seg: 6 }, t.x, t.y + 5 * s, t.z);
            this.collider({ type: 'cone', hh: 4.4 * s, r: 2.3 * s, seg: 8 }, t.x, t.y + 6.6 * s, t.z);
          } else {
            this.collider({ type: 'ball', r: 0.85 * s }, t.x, t.y + 0.7 * s, t.z);
          }
        }
      }
      const leafMat = this.foliageMaterial(type);
      const barkMat = geos.trunk ? this.mat(barkKey) : null;
      const color = new THREE.Color();
      for (const [, arr] of cells) {
        const parts = [[geos.canopy, leafMat, true]];
        if (geos.trunk) parts.push([geos.trunk, barkMat, false]);
        for (const [geo, mat, tinted] of parts) {
          const im = new THREE.InstancedMesh(geo, mat, arr.length);
          arr.forEach((t, i) => {
            _e.set(0, t.rot, 0);
            _q.setFromEuler(_e);
            const sy = t.s * (t.sy ?? 1);
            _m.compose(_p.set(t.x, t.y, t.z), _q, _s.set(t.s, sy, t.s));
            im.setMatrixAt(i, _m);
            if (tinted) {
              const v = 0.75 + this.rand() * 0.4;
              color.setRGB(v * (0.95 + this.rand() * 0.1), v, v * (0.85 + this.rand() * 0.15));
              im.setColorAt(i, color);
            }
          });
          im.computeBoundingSphere();
          im.castShadow = shadows;
          im.receiveShadow = shadows;
          this.scene.add(im);
          this.meshes.push(im);
          const bs = im.boundingSphere;
          this.chunks.push({ mesh: im, center: bs.center.clone(), radius: bs.radius, maxDist, cast: im.castShadow });
        }
      }
    }
  }

  /** Tufos de grama instanciados (sem colisão). points: [{x,z,s}] */
  grass(points, { chunk = 32, dist = 75, dry = 0 } = {}) {
    if (!points.length) return;
    let geo = geoCache.get('grass');
    if (!geo) {
      const a = new THREE.PlaneGeometry(0.7, 0.36).translate(0, 0.18, 0);
      const b = a.clone().rotateY(Math.PI / 2);
      const pos = new Float32Array(24), nor = new Float32Array(24), uv = new Float32Array(16);
      pos.set(a.attributes.position.array, 0); pos.set(b.attributes.position.array, 12);
      uv.set(a.attributes.uv.array, 0); uv.set(b.attributes.uv.array, 8);
      for (let i = 0; i < 8; i++) nor.set([0, 1, 0], i * 3);
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]);
      geoCache.set('grass', geo);
    }
    const id = 'grass-' + dry;
    if (!this.materials.has(id)) {
      this.materials.set(id, new THREE.MeshLambertMaterial({ map: grassTuftTexture(11, dry), alphaTest: 0.5, side: THREE.DoubleSide }));
    }
    const mat = this.materials.get(id);
    const cells = new Map();
    for (const p of points) {
      const key = Math.floor(p.x / chunk) + ',' + Math.floor(p.z / chunk);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(p);
    }
    const color = new THREE.Color();
    for (const [, arr] of cells) {
      const im = new THREE.InstancedMesh(geo, mat, arr.length);
      arr.forEach((p, i) => {
        _e.set(0, this.rand() * Math.PI, 0);
        _q.setFromEuler(_e);
        const y = p.y ?? this.heightAt(p.x, p.z);
        _m.compose(_p.set(p.x, y - 0.03, p.z), _q, _s.set(p.s, p.s * (0.7 + this.rand() * 0.6), p.s));
        im.setMatrixAt(i, _m);
        const v = 0.7 + this.rand() * 0.45;
        color.setRGB(v, v, v * 0.9);
        im.setColorAt(i, color);
      });
      im.computeBoundingSphere();
      this.scene.add(im);
      this.meshes.push(im);
      const bs = im.boundingSphere;
      this.chunks.push({ mesh: im, center: bs.center.clone(), radius: bs.radius, maxDist: dist });
    }
  }

  /**
   * Rocha: icosaedro deformado por ruído, com tamanho (sx,sy,sz). A própria malha vira colisão.
   */
  rock(key, x, y, z, sx, sy, sz, o = {}) {
    const { rx = 0, ry = this.rand() * Math.PI * 2, rz = 0, detail = 1, rough = 0.42, collide = true } = o;
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    const pos = g.attributes.position;
    const sd = this.rand() * 100;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = noise2(vx * 1.6 + sd, vy * 1.6 + vz * 1.1) * 0.55 + noise2(vz * 3.1 + sd, vx * 3.1 - vy) * 0.3 + noise2(vx * 6 - sd, vz * 6 + vy) * 0.15;
      const k = 1 + rough * n;
      pos.setXYZ(i, vx * k * sx / 2, Math.max(vy * k, -0.6) * sy / 2, vz * k * sz / 2);
    }
    g.computeVertexNormals();
    const t = 1 / this.lib.tile(key);
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + pos.getZ(i) * 0.7) * t; uv[i * 2 + 1] = (pos.getY(i) + pos.getZ(i) * 0.3) * t; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    _e.set(rx, ry, rz, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(_e);
    this.addGeometry(key, g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)));
    if (collide) this.collider({ type: 'tris', geometry: g }, x, y, z, q);
  }

  /** Superfície de água (mar, lago, rio) com ondulação animada. Sem colisão: o fundo é o terreno. */
  water({ x = 0, z = 0, w, d, y = 0, color = '#1d5866', opacity = 0.86, speed = 1, ripple = 8, radius = 0 }) {
    if (radius) { w = d = radius * 2; }
    const geo = (radius ? new THREE.CircleGeometry(radius, 48) : new THREE.PlaneGeometry(w, d)).rotateX(-Math.PI / 2);
    let nrm = geoCache.get('ripple');
    if (!nrm) { nrm = rippleNormalTexture(3); geoCache.set('ripple', nrm); }
    const tex = nrm.clone();
    tex.needsUpdate = true;
    tex.repeat.set(w / ripple, d / ripple);
    // polygonOffset: onde a margem fica quase na altura da água, a água vence o empate de
    // profundidade (sem o "piscar" de z-fighting na linha d'água vista de longe)
    const params = { color: new THREE.Color(color), transparent: opacity < 1, opacity, normalMap: tex, normalScale: new THREE.Vector2(0.55, 0.55),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
    let mat;
    if (this.settings.get('graphics.pbr')) mat = new THREE.MeshStandardMaterial({ ...params, roughness: 0.1, metalness: 0.05 });
    else {
      // sem mapa de ambiente: reflexo do céu aproximado por Fresnel (água clareia em ângulo raso)
      mat = new THREE.MeshPhongMaterial({ ...params, shininess: 90, specular: new THREE.Color(0x667788) });
      const sky = this.skyColor.clone();
      mat.onBeforeCompile = shader => {
        shader.uniforms.uSky = { value: sky };
        shader.fragmentShader = 'uniform vec3 uSky;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
  float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 5.0);
  outgoingLight = mix(outgoingLight, uSky, clamp(fres * 0.75, 0.0, 0.55));
  #include <opaque_fragment>`);
      };
      mat.customProgramCacheKey = () => 'water-fresnel';
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = false; // superfície plana: receber sombra gera listras ("shadow acne")
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.materials.set('__water' + this.materials.size, mat);
    this.updaters.push(dt => { tex.offset.x += dt * 0.018 * speed; tex.offset.y += dt * 0.011 * speed; });
    return mesh;
  }

  /** Animações do cenário (água, cachoeira…), chamado a cada frame. */
  update(dt) { for (const fn of this.updaters) fn(dt); }

  /** Esconde pedaços de vegetação além da distância de visão. */
  cull(camPos, viewDist) {
    for (const c of this.chunks) {
      const d = c.center.distanceTo(camPos) - c.radius;
      c.mesh.visible = d < Math.min(viewDist, c.maxDist);
      // só pedaços perto da câmera projetam sombra: o mapa de sombras cobre poucas dezenas
      // de metros, e desenhar uma floresta inteira nele custava metade do FPS
      if (c.cast) c.mesh.castShadow = d < 50;
    }
  }

  dispose() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      if (!(m.isInstancedMesh && [...geoCache.values()].some(g => g === m.geometry || g.trunk === m.geometry || g.canopy === m.geometry))) m.geometry.dispose();
      if (m.isInstancedMesh) m.dispose();
    }
    for (const mat of this.materials.values()) {
      for (const k of ['map']) if (mat[k] && mat[k].isCanvasTexture) mat[k].dispose();
      mat.dispose();
    }
    this.meshes = [];
    this.chunks = [];
    this.materials.clear();
  }
}
