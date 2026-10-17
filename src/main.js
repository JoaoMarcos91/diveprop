// FPVsim — laço principal do jogo.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';
import { Settings, CONTROL_LAYOUTS, PROFILE_KEYS } from './settings.js';
import { Haptics } from './haptics.js';
import { bindingName } from './controllers.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { AssetLib, displayColor } from './assets.js';
import { Kit } from './kit.js';
import { Drone } from './drone.js';
import { createDroneModel, animateDroneModel } from './droneModel.js';
import { CameraRig } from './camera.js';
import { GameAudio } from './audio.js';
import { OSD } from './osd.js';
import { UI } from './ui.js';
import { SCENES } from './scenes/index.js';

const MODES = ['acro', 'angle', 'horizon'];
const MODE_LABEL = { acro: 'ACRO', angle: 'ANGLE', horizon: 'HORIZON' };
const CAMS = ['fpv', 'chase', 'los'];
const CAM_LABEL = { fpv: 'Câmera FPV', chase: 'Terceira pessoa', los: 'Linha de visada' };

class Game {
  constructor() {
    this.settings = new Settings();
    this.state = 'boot';
    this.time = 0;
    this.acc = 0;
    this.fps = 60;
    this.signal = 1;
    this.signalTimer = 0;
    this.shotRequest = null;
    this.stats = { frameMs: 0, physMs: 0, steps: 0 };
  }

  async init() {
    const canvas = document.getElementById('game');
    this.r = new Renderer(canvas, this.settings);
    this.r.renderer.info.autoReset = false;
    this.camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 0.02, 1500);
    this.rig = new CameraRig(this.camera, this.settings);
    this.input = new Input(this.settings);
    this.haptics = new Haptics(this.settings, this.input);
    this.audio = new GameAudio(this.settings);
    this.osd = new OSD(document.getElementById('osd'), this.settings);
    this.ui = new UI(this);
    this.lib = new AssetLib(this.r.renderer, this.settings);
    this.ui.loading('Iniciando…', 0.05, 'Carregando motor de física');
    await Promise.all([RAPIER.init(), this.lib.init()]);

    this.input.onConnect = () => this.ui.updatePadStatus();
    this.input.onDisconnect = () => { this.ui.toast('Controle desconectado'); this.ui.updatePadStatus(); if (this.state === 'flying') this.pause(); };
    this.input.onPadChange = (gp, info) => this.onPadChange(gp, info);
    this.settings.onChange(path => this.onSetting(path));
    addEventListener('pointerdown', () => this.audio.ensure());
    addEventListener('keydown', () => this.audio.ensure());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'flying') this.pause(); });

    await this.loadScene(this.settings.get('game.scene'));
    this.state = 'menu';
    this.ui.show('main', { push: false });
    this.last = performance.now();
    this.lastRender = 0;
    requestAnimationFrame(t => this.frame(t));
    // canal de testes: só no `npm run dev` ou num build de teste feito com VITE_DEVBRIDGE=1
    if ((import.meta.env.DEV || import.meta.env.VITE_DEVBRIDGE) && location.search.includes('dev')) (await import('./dev.js')).startDev(this);
  }

  // ------------------------------------------------------------------ cenários
  async loadScene(id) {
    const def = SCENES.find(s => s.id === id) || SCENES[0];
    this.sceneDef = def;
    this.ui.loading(def.name, 0.1, def.desc);
    await new Promise(r => setTimeout(r, 30));

    // limpa o anterior
    this.info?.dispose?.();
    if (this.kit) this.kit.dispose();
    if (this.drone) this.drone = null;
    if (this.world) this.world.free();
    if (this.sky) { this.sky.background?.dispose?.(); this.sky.env?.dispose?.(); }

    const g = this.settings.data.graphics;
    const w = this.settings.data.world;
    this.world = new RAPIER.World({ x: 0, y: -w.gravity, z: 0 });
    this.world.timestep = 1 / w.physicsHz;
    const scene = this.scene = new THREE.Scene();

    this.ui.loading(def.name, 0.2, 'Céu e iluminação');
    const sky = this.sky = await this.lib.loadSky(def.sky);
    scene.background = sky.background;
    scene.backgroundIntensity = sky.exposure;
    if (sky.env) { scene.environment = sky.env; scene.environmentIntensity = sky.exposure * 0.9; }
    // com PBR o mapa de ambiente já dá a luz difusa do céu; sem ele, a hemisférica faz esse papel
    this.hemi = new THREE.HemisphereLight(sky.skyColor, sky.groundColor, g.pbr ? Math.PI * 0.2 : Math.PI * (def.ambient ?? 1));
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(sky.sunColor, sky.sunIntensity * (def.sunBoost ?? 1));
    this.sunDir = sky.sunDir.clone();
    scene.add(this.sun, this.sun.target);
    const shadows = g.shadows > 0;
    this.r.renderer.shadowMap.enabled = shadows;
    if (shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(g.shadows, g.shadows);
      const ext = g.shadows >= 4096 ? 70 : g.shadows >= 2048 ? 55 : 40;
      Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 600 });
      // sol baixo (fim de tarde) gera "shadow acne" em superfícies planas: bias maior
      const low = 1 - Math.min(1, this.sunDir.y / 0.5);
      this.sun.shadow.bias = -0.0004 - 0.0008 * low;
      this.sun.shadow.normalBias = 0.05 + 0.1 * low;
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    // neblina: cor linear (quando renderiza no render target do efeito FPV) e cor de tela (direto)
    if (def.indoor) {
      // cenário fechado: fundo neutro, luz das luminárias vindo de cima, ambiente forte
      scene.background = new THREE.Color(def.bg || '#1b1f24');
      scene.backgroundIntensity = 1;
      this.sunDir.set(0.22, 1, 0.12).normalize();
      this.sun.color.set('#fff3e0');
      this.sun.intensity = def.sunIntensity ?? 1.6;
      this.hemi.color.set('#d8d2c8');
      this.hemi.groundColor.set('#8a6a48');
      this.hemi.intensity = g.pbr ? Math.PI * 0.35 : Math.PI * (def.ambient ?? 0.9);
    }
    this.fogLinear = sky.fogColor.clone();
    this.fogDisplay = displayColor(sky.fogColor, 1);
    scene.fog = new THREE.Fog(this.fogDisplay.clone(), 50, 400);

    this.ui.loading(def.name, 0.35, 'Construindo o cenário');
    await new Promise(r => setTimeout(r, 20));
    const kit = this.kit = new Kit({ scene, world: this.world, lib: this.lib, settings: this.settings, seed: def.seed || 7, skyColor: sky.fogColor.clone().lerp(sky.skyColor, 0.5).multiplyScalar(0.85) });
    const info = this.info = def.build(kit, this.settings, THREE) || {};
    kit.flush();
    this.ui.loading(def.name, 0.55, `Texturas (${kit.colliderCount} colisores)`);
    await this.lib.ready(p => this.ui.loading(def.name, 0.55 + p * 0.35, 'Texturas'));

    // drone
    this.drone = new Drone(this.world, this.settings, info.spawn);
    this.pilotPos = info.pilot || info.spawn.pos.clone();
    this.model = createDroneModel(this.settings.get('drone.armLength'));
    this.modelArm = this.settings.get('drone.armLength');
    scene.add(this.model);
    this.rig.reset();
    this.world.step(); // inicializa broadphase

    this.ui.loading(def.name, 0.95, 'Compilando shaders');
    this.updateFog();
    this.syncModel();
    this.rig.update(0.016, this.drone, this.model, kit.heightAt, this.pilotPos, this.r.aspect);
    try { this.r.renderer.compile(scene, this.camera); } catch { /* opcional */ }
    this.settings.set('game.scene', def.id, { silent: true });
    this.lapInfo = null;
    this.r.resetDynamic();
  }

  async startScene(id) {
    this.audio.ensure();
    this.state = 'loading';
    await this.loadScene(id);
    this.ui.hide();
    this.state = 'flying';
    this.osd.flash(`${this.sceneDef.name}`, 2.5, '#ffe27a');
    this.osd.flash(`${this.actionLabel('arm', 'Espaço')} para armar`, 2.5);
    const sug = this.sceneDef.suggestDrone;
    if (sug && this.settings.get('drone.preset') !== sug) this.ui.toast(`Dica: este cenário foi feito para o ${this.sceneDef.suggestLabel} (Configurações → Física → Preset de drone)`, 6000);
  }

  async reloadScene() {
    this.lib.texCache.clear();
    const wasFlying = this.state === 'flying' || this.state === 'paused';
    this.state = 'loading';
    await this.loadScene(this.sceneDef.id);
    if (wasFlying) { this.state = 'paused'; this.ui.show('pause', { push: false }); }
    else { this.state = 'menu'; this.ui.show('main', { push: false }); }
  }

  /**
   * Cada controle/rádio tem o próprio perfil (layout, canais, botões, calibração). Na primeira
   * vez que aparece, recebe o layout da família: rádio → AETR com chaves; controle → Modo 2.
   */
  onPadChange(gp, info) {
    const s = this.settings;
    const prof = s.data.input.profiles?.[gp.id];
    this.loadingProfile = true;
    if (prof) {
      Object.assign(s.data.input, structuredClone(prof));
    } else {
      // controle novo: começa com os padrões da família dele
      const cur = s.data.input.layout;
      const want = info.family === 'radio' ? 'radioAETR' : (cur.startsWith('radio') ? 'mode2' : cur);
      const L = CONTROL_LAYOUTS[want];
      for (const ch of ['throttle', 'yaw', 'pitch', 'roll']) s.data.input[ch] = { ...L[ch] };
      Object.assign(s.data.input, structuredClone(L.extra), { layout: want, calib: {} });
    }
    s.save();
    this.loadingProfile = false;
    this.saveProfile();
    const hint = info.family === 'radio' ? ' · AETR, arme na chave CH5'
      : !info.standard ? ' · sem mapeamento padrão: confira em Configurações → Controle' : '';
    this.ui.toast(`${info.model} conectado${hint}`, 4000);
    this.ui.updatePadStatus();
    if (this.ui.current === 'settings') this.ui.renderSettings();
  }

  saveProfile() {
    const gp = this.input.gamepad;
    if (!gp || this.loadingProfile) return;
    const inp = this.settings.data.input;
    const prof = {};
    for (const k of PROFILE_KEYS) prof[k] = structuredClone(inp[k]);
    inp.profiles = { ...(inp.profiles || {}), [gp.id]: prof };
    this.settings.save();
  }

  /** Nome do botão/chave de uma ação, para as mensagens na tela. */
  actionLabel(action, fallback) {
    const name = bindingName(this.input.padInfo?.family || 'playstation', this.settings.data.input.buttons[action]);
    return !this.input.gamepad || name === '—' ? fallback : name;
  }

  pause() {
    if (this.state !== 'flying') return;
    this.haptics.stop();
    this.state = 'paused';
    this.ui.show('pause', { push: false });
  }

  resume() {
    this.ui.hide();
    this.state = 'flying';
    this.last = performance.now();
    this.acc = 0;
  }

  respawn() {
    this.drone.respawn();
    this.rig.reset();
    this.info.onRespawn?.();
  }

  toMainMenu() {
    this.drone.respawn();
    this.state = 'menu';
    this.ui.history = [];
    this.ui.show('main', { push: false });
  }

  onSetting(path) {
    if (path.startsWith('input.') && !path.startsWith('input.profiles') || path === 'input') this.saveProfile();
    if (!this.drone) return;
    if (path.startsWith('drone') || path.startsWith('world') || path === '*') {
      this.drone.refreshParams();
      this.world.gravity = { x: 0, y: -this.settings.get('world.gravity'), z: 0 };
      this.world.timestep = 1 / this.settings.get('world.physicsHz');
      if (Math.abs(this.modelArm - this.settings.get('drone.armLength')) > 1e-4) {
        this.scene.remove(this.model);
        this.model = createDroneModel(this.settings.get('drone.armLength'));
        this.modelArm = this.settings.get('drone.armLength');
        this.scene.add(this.model);
      }
    }
    if (path.startsWith('graphics') || path === '*') this.updateFog();
  }

  updateFog() {
    const g = this.settings.data.graphics;
    const f = this.scene.fog;
    if (this.sceneDef?.fog === false) { f.near = 1e5; f.far = 2e5; return; }
    f.near = g.fog ? g.viewDistance * 0.3 : 1e5;
    f.far = g.fog ? g.viewDistance * 1.15 : 2e5;
  }

  syncModel() {
    const t = this.drone.body.translation(), q = this.drone.body.rotation();
    this.model.position.set(t.x, t.y, t.z);
    this.model.quaternion.set(q.x, q.y, q.z, q.w);
  }

  // ------------------------------------------------------------------ laço
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    const cap = this.settings.data.graphics.fpsCap;
    if (cap > 0 && now - this.lastRender < 1000 / cap - 2) return;
    this.lastRender = now;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    const t0 = performance.now();
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;

    const input = this.input;
    this.onFrame?.(dt);
    const sticks = input.poll(dt);
    if (this.ui.isOpen()) this.ui.tick(dt, input);

    if (this.state === 'flying') this.handleActions(sticks);
    else if (this.state === 'paused' && !this.ui.isOpen()) this.state = 'flying';

    const drone = this.drone;
    if (!drone) return;

    if (this.state === 'flying') {
      const tp = performance.now();
      const w = this.settings.data.world;
      const h = 1 / w.physicsHz;
      this.acc += dt * w.timeScale;
      let steps = 0;
      const maxSteps = Math.ceil(0.05 / h);
      let tU = 0, tS = 0, tA = 0;
      while (this.acc >= h && steps < maxSteps) {
        const a0 = performance.now();
        drone.update(h, sticks, input.held);
        const a1 = performance.now();
        this.world.step();
        const a2 = performance.now();
        drone.afterStep(h);
        tA += performance.now() - a2; tS += a2 - a1; tU += a1 - a0;
        this.acc -= h;
        steps++;
      }
      this.stats.phys = { update: +tU.toFixed(2), step: +tS.toFixed(2), after: +tA.toFixed(2) };
      if (steps >= maxSteps) this.acc = 0;
      this.stats.physMs = performance.now() - tp;
      this.stats.steps = steps;
      this.afterPhysics(dt);
    } else if (this.state === 'menu') {
      // câmera orbitando o spawn atrás do menu
      const p = this.info.spawn.pos;
      const a = this.time * 0.05;
      const R = this.info.orbit ?? 30;
      this.camera.position.set(p.x + Math.cos(a) * R, p.y + R * 0.35 + 4, p.z + Math.sin(a) * R);
      this.camera.lookAt(p.x, p.y + 4, p.z);
      this.camera.fov = 60; this.camera.aspect = this.r.aspect; this.camera.far = 2000; this.camera.updateProjectionMatrix();
      this.model.visible = true;
    }

    if (this.state === 'flying' || this.state === 'paused') {
      this.syncModel();
      this.rig.update(dt, drone, this.model, this.kit.heightAt, this.pilotPos, this.r.aspect);
    }
    animateDroneModel(this.model, drone.motor, dt);
    this.kit.update(dt);
    this.kit.cull(this.camera.position, this.settings.data.graphics.viewDistance);
    this.updateSun();
    this.audio.update(drone, this.state !== 'flying');
    this.haptics.update(dt, drone, this.state === 'flying');

    // render
    const cam = this.settings.data.camera;
    const fpv = (this.state === 'flying' || this.state === 'paused') && cam.mode === 'fpv';
    const fxMode = { off: 0, analog: 1, digital: 2 }[cam.fx];
    const tr = performance.now();
    this.r.renderer.info.reset();
    // Sempre renderiza num render target (profundidade de 24 bits garantida) e depois aplica o
    // pós-processamento; fora da câmera FPV o passe é só uma cópia com tone mapping. Direto na
    // tela, alguns Safari usam profundidade de 16 bits e a água "briga" com o fundo raso.
    this.scene.fog.color.copy(this.fogLinear);
    this.r.render(this.scene, this.camera, fpv
      ? { active: true, fisheye: cam.fisheye, mode: fxMode, signal: this.signal, strength: cam.fxStrength, time: this.time, vignette: fxMode === 0 ? 0.15 : 0.4 }
      : { active: true, fisheye: 0, mode: 0, signal: 1, strength: 0, time: this.time, vignette: 0 });
    this.stats.renderMs = performance.now() - tr;
    if (this.shotRequest) { const fn = this.shotRequest; this.shotRequest = null; fn(this.r.dom); }

    const to = performance.now();
    const pos = drone.position(new THREE.Vector3());
    this.osd.draw({
      drone: (this.state === 'flying') ? drone : null,
      fps: this.fps, renderScale: this.r.scale, sticks, throttle: sticks.throttle,
      speed: drone.speed(), alt: pos.y - this.kit.heightAt(pos.x, pos.z) - 0.05,
      signal: this.signal, lap: this.lapInfo, turtle: drone.turtle,
    });
    this.stats.osdMs = performance.now() - to;
    this.r.dynamicResolution(dt);
    this.stats.frameMs = performance.now() - t0;
  }

  handleActions(sticks) {
    const input = this.input, drone = this.drone, s = this.settings;
    if (s.data.input.armSwitch && input.released.has('arm') && drone.armed) drone.tryArm(sticks.throttle); // desligou a chave
    for (const a of input.pressed) {
      switch (a) {
        case 'pause': this.pause(); return;
        case 'arm':
          // chave mantida (rádio): ligar = armar; teclado sempre alterna
          if (s.data.input.armSwitch && !input.keyActions.has('arm')) { if (!drone.armed) drone.tryArm(sticks.throttle); }
          else drone.tryArm(sticks.throttle);
          break;
        case 'reset': this.respawn(); break;
        case 'camera': {
          const m = CAMS[(CAMS.indexOf(s.get('camera.mode')) + 1) % CAMS.length];
          s.set('camera.mode', m);
          this.rig.reset();
          this.osd.flash(CAM_LABEL[m], 1.2);
          break;
        }
        case 'mode': {
          const m = MODES[(MODES.indexOf(s.get('fc.mode')) + 1) % MODES.length];
          s.set('fc.mode', m);
          this.osd.flash(MODE_LABEL[m], 1.2);
          break;
        }
        case 'tiltUp': s.set('camera.uptilt', Math.min(70, s.get('camera.uptilt') + 5)); this.osd.flash(`Câmera ${s.get('camera.uptilt')}°`, 0.8); break;
        case 'tiltDown': s.set('camera.uptilt', Math.max(-10, s.get('camera.uptilt') - 5)); this.osd.flash(`Câmera ${s.get('camera.uptilt')}°`, 0.8); break;
        case 'fovUp': s.set('camera.fov', Math.min(160, s.get('camera.fov') + 5)); this.osd.flash(`FOV ${s.get('camera.fov')}°`, 0.8); break;
        case 'fovDown': s.set('camera.fov', Math.max(60, s.get('camera.fov') - 5)); this.osd.flash(`FOV ${s.get('camera.fov')}°`, 0.8); break;
      }
    }
  }

  afterPhysics(dt) {
    const drone = this.drone;
    const pos = drone.position(new THREE.Vector3());
    // distância até o chão (efeito solo / vento)
    const ray = new RAPIER.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, 50, true, undefined, undefined, undefined, drone.body);
    drone.groundDist = hit ? hit.timeOfImpact : 50;
    drone.updateWind(dt, this.time);

    // sinal de vídeo: distância + obstáculos entre piloto e drone
    this.signalTimer -= dt;
    if (this.signalTimer <= 0) {
      this.signalTimer = 0.2;
      const pp = this.pilotPos;
      const from = { x: pp.x, y: this.kit.heightAt(pp.x, pp.z) + 2, z: pp.z };
      const dx = pos.x - from.x, dy = pos.y - from.y, dz = pos.z - from.z;
      const dist = Math.hypot(dx, dy, dz);
      let blocked = 0;
      if (dist > 1) {
        const r = new RAPIER.Ray(from, { x: dx / dist, y: dy / dist, z: dz / dist });
        const h = this.world.castRay(r, dist - 0.4, true, undefined, undefined, undefined, drone.body);
        if (h) blocked = THREE.MathUtils.clamp((dist - h.timeOfImpact) / 60, 0.12, 0.4);
      }
      const range = this.settings.get('world.videoRange');
      this.signalTarget = THREE.MathUtils.clamp(1 - Math.pow(dist / range, 2) - blocked, 0, 1);
    }
    this.signal += ((this.signalTarget ?? 1) - this.signal) * Math.min(1, dt * 4);

    // eventos do drone (várias batidas no mesmo frame viram uma só, com a maior intensidade)
    let bump = 0;
    for (const ev of drone.events.splice(0)) {
      if (ev === 'arm') { this.osd.flash('ARMADO', 1, '#7dff7a'); this.audio.beep(2000, 0.07, 2); this.haptics.tick('arm'); }
      else if (ev === 'disarm') { this.osd.flash('DESARMADO', 1, '#ffd24a'); this.audio.beep(1200, 0.12, 1); this.haptics.tick('disarm'); }
      else if (ev === 'armBlocked') { this.osd.flash('Abaixe o throttle para armar', 1.5, '#ffd24a'); this.audio.beep(600, 0.15, 1); }
      else if (ev === 'crash') {
        this.audio.crash(drone.lastImpact);
        this.haptics.crash();
        const mode = this.settings.get('world.crashMode');
        this.osd.flash(mode === 'reset' ? 'CRASH!' : `CRASH! ${this.actionLabel('reset', 'R')} para resetar`, 2.2, '#ff5c5c');
      } else if (ev?.type === 'hit') bump = Math.max(bump, ev.impact);
    }
    if (bump > 0 && !drone.crashed) { this.audio.crash(bump * 0.4); this.haptics.impact(bump); }
    if (drone.crashed) {
      drone.crashTime += dt;
      if (this.settings.get('world.crashMode') === 'reset' && drone.crashTime > 1.3) this.respawn();
    }
    // queda para fora do mapa
    if (pos.y < -50) this.respawn();

    if (this.info.update) this.lapInfo = this.info.update(dt, drone, pos, this) || null;
  }

  updateSun() {
    if (!this.sun) return;
    const target = this.state === 'menu' ? this.info.spawn.pos : this.camera.position;
    const snap = 4;
    const tx = Math.round(target.x / snap) * snap, tz = Math.round(target.z / snap) * snap;
    this.sun.target.position.set(tx, target.y, tz);
    this.sun.position.set(tx, target.y, tz).addScaledVector(this.sunDir, 250);
    this.sun.target.updateMatrixWorld();
  }
}

const game = new Game();
window.__fpv = game;
game.init().catch(err => {
  console.error(err);
  const el = document.getElementById('fatal');
  el.hidden = false;
  el.textContent = 'Erro ao iniciar: ' + (err?.message || err) + '\n\nO jogo precisa de WebGL2. Ative a aceleração de hardware do navegador ou tente outro navegador atualizado (Chrome, Edge, Firefox ou Safari). Em Macs antigos o Safari costuma funcionar melhor.';
});
