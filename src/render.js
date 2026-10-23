// Renderizador WebGL2 + passe de pós-processamento FPV (fisheye, vídeo analógico/digital)
// + resolução dinâmica + tela dividida para óculos VR (celular numa VR box).
import * as THREE from 'three';

const FX_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FX_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 res;
uniform float aspect, fisheye, time, signal, strength, mode, vignette;
uniform float vrScale, vrShift, vrK;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 tm(vec3 c) {
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  return c;
}
vec3 sampleScene(vec2 uv) { return tm(texture2D(tDiffuse, uv).rgb); }
void main() {
  // óculos VR: cada olho recebe a imagem encolhida, deslocada para o centro da lente e com
  // distorção de barril (a lente da VR box aplica a inversa). Fora do VR: 1, 0, 0 = sem efeito.
  vec2 q = (vUv - 0.5 - vec2(vrShift, 0.0)) / vrScale;
  vec2 qa = q * vec2(aspect, 1.0);
  q *= 1.0 + vrK * dot(qa, qa) * 2.0;
  vec2 p = q + 0.5;
  bool outside = p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0;
  vec2 d = (p - 0.5) * vec2(aspect, 1.0);
  float rmax = length(vec2(aspect, 1.0) * 0.5);
  float r = length(d) / rmax;
  float a = 1.0 - fisheye;
  vec2 uv = d * (a + (1.0 - a) * r * r) / vec2(aspect, 1.0) + 0.5;
  // sinal bom (>~0.65) praticamente não gera ruído; abaixo disso degrada rápido
  float bad = clamp(smoothstep(0.65, 0.0, signal) * (0.5 + strength), 0.0, 1.0);
  vec3 col;
  if (mode < 0.5) {
    col = sampleScene(uv);
  } else if (mode < 1.5) {
    // ---- analógico
    float line = floor(vUv.y * res.y * 0.5);
    float tear = (hash(vec2(line, floor(time * 30.0))) - 0.5) * 0.03 * bad * bad;
    float roll = (hash(vec2(floor(time * 9.0), 3.0)) - 0.5) * 0.004 * bad;
    uv.x += tear + roll;
    float ca = 0.0012 + 0.0025 * strength;
    col = tm(vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b));
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 0.82 - 0.3 * bad);
    float n = hash(vUv * res + fract(time * 7.13) * 91.0);
    col = mix(col, vec3(n), clamp(0.035 * strength + bad * bad * 0.85, 0.0, 0.92));
    col *= 0.93 + 0.07 * sin(vUv.y * res.y * 3.14159);
    float bar = hash(vec2(floor(vUv.y * 14.0 + time * 3.0), floor(time * 12.0)));
    if (bad > 0.55 && bar > 1.45 - bad) col = vec3(hash(vUv * res + time));
    col *= 1.0 - 0.6 * smoothstep(0.85, 1.0, bad);
  } else {
    // ---- digital: blocos quando o sinal piora
    if (bad > 0.35) {
      float bs = floor(2.0 + (bad - 0.35) * 40.0);
      uv = (floor(uv * res / bs) + 0.5) * bs / res;
    }
    col = sampleScene(uv);
    if (bad > 0.92) col *= 0.2;
  }
  // borda preta fora da imagem (fisheye forte)
  if (outside || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  col *= 1.0 - vignette * smoothstep(0.55, 1.15, r);
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}`;

export class Renderer {
  constructor(canvas, settings) {
    this.settings = settings;
    const g = settings.data.graphics;
    // stencil: true força um buffer de profundidade de 24 bits; sem ele alguns Safari/GPUs usam
    // 16 bits, e água sobre fundo raso "briga" com o terreno (listras de z-fighting)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !!g.msaa, powerPreference: 'high-performance', stencil: true });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = true;
    this.scale = g.renderScale;
    this.dyn = { acc: 0, frames: 0, good: 0, bad: 0 };
    this.halfFloat = r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float');

    this.fxMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, aspect: { value: 1 }, fisheye: { value: 0 },
        time: { value: 0 }, signal: { value: 1 }, strength: { value: 0.5 }, mode: { value: 1 }, vignette: { value: 0.35 },
        vrScale: { value: 1 }, vrShift: { value: 0 }, vrK: { value: 0 },
      },
      vertexShader: FX_VERT, fragmentShader: FX_FRAG, depthTest: false, depthWrite: false,
    });
    this.fxScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fxMat);
    quad.frustumCulled = false;
    this.fxScene.add(quad);
    this.fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rt = null;
    this.vr = false;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  get dom() { return this.renderer.domElement; }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(this.scale * (devicePixelRatio || 1), 2));
    this.renderer.setSize(w, h, true);
    const size = this.rtSize();
    if (this.rt) this.rt.setSize(size.x, size.y);
    this.fxMat.uniforms.res.value.copy(size);
    // no VR a câmera tem o formato de um olho (meia tela) e a cena é desenhada uma vez só,
    // com metade dos pixels: os dois olhos mostram a mesma imagem, como nos óculos FPV
    this.aspect = (this.vr ? w / 2 : w) / h;
    this.fxMat.uniforms.aspect.value = this.aspect;
  }

  rtSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.vr) size.x = Math.max(1, Math.round(size.x / 2));
    return size;
  }

  setVR(on) {
    if (on === this.vr) return;
    this.vr = on;
    this.resize();
  }

  ensureRT() {
    if (this.rt) return this.rt;
    const size = this.rtSize();
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: this.halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: this.settings.get('graphics.msaa') ? 4 : 0,
      depthBuffer: true,
    });
    return this.rt;
  }

  setScale(s) {
    s = Math.round(s * 100) / 100;
    if (Math.abs(s - this.scale) < 0.001) return;
    this.scale = s;
    this.resize();
  }

  /** fx: { active, fisheye, mode(0 off,1 analog,2 digital), signal, strength, time, vr: { scale, shift, distort } } */
  render(scene, camera, fx) {
    const r = this.renderer;
    if (!fx || !fx.active) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    const rt = this.ensureRT();
    r.setRenderTarget(rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    const u = this.fxMat.uniforms;
    u.tDiffuse.value = rt.texture;
    u.fisheye.value = fx.fisheye;
    u.mode.value = fx.mode;
    u.signal.value = fx.signal;
    u.strength.value = fx.strength;
    u.time.value = fx.time;
    u.vignette.value = fx.vignette ?? (fx.mode === 0 ? 0.15 : 0.4);
    if (!this.vr) {
      u.vrScale.value = 1; u.vrShift.value = 0; u.vrK.value = 0;
      r.render(this.fxScene, this.fxCam);
      return;
    }
    // tela dividida: o mesmo quadro em cada metade, deslocado para o centro de cada lente
    const v = fx.vr || {}, w = innerWidth, h = innerHeight, half = w / 2;
    r.setScissorTest(true);
    for (const eye of [0, 1]) {
      r.setViewport(eye * half, 0, half, h);
      r.setScissor(eye * half, 0, half, h);
      u.vrScale.value = v.scale ?? 0.9;
      u.vrShift.value = (eye ? -1 : 1) * (v.shift ?? 0);
      u.vrK.value = v.distort ?? 0.2;
      r.render(this.fxScene, this.fxCam);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
  }

  /** Volta para a resolução configurada e ignora os primeiros segundos (depois de carregar). */
  resetDynamic(seconds = 2.5) {
    this.dyn = { acc: 0, frames: 0, good: 0, bad: 0, hold: seconds };
    this.setScale(this.settings.get('graphics.renderScale'));
  }

  /** Ajusta a escala de resolução para manter o FPS alvo. */
  dynamicResolution(dt) {
    const g = this.settings.data.graphics;
    if (!g.dynamicRes) { if (Math.abs(this.scale - g.renderScale) > 0.001) this.setScale(g.renderScale); return; }
    const d = this.dyn;
    // logo após carregar um cenário há engasgos (upload de texturas): não conta esses frames
    if (d.hold > 0) { d.hold -= dt; return; }
    d.acc += dt; d.frames++;
    if (d.acc < 0.5) return;
    const fps = d.frames / d.acc;
    d.acc = 0; d.frames = 0;
    const max = g.renderScale, min = Math.min(0.4, max);
    if (fps < g.targetFps - 4) { d.bad++; d.good = 0; } else if (fps > g.targetFps + 6 || fps > 57) { d.good++; d.bad = 0; } else { d.good = 0; d.bad = 0; }
    if (d.bad >= 2 && this.scale > min) { this.setScale(Math.max(min, this.scale - 0.07)); d.bad = 0; }
    if (d.good >= 4 && this.scale < max) { this.setScale(Math.min(max, this.scale + 0.05)); d.good = 0; }
  }
}
