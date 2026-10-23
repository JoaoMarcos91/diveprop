// Leitura dos controles (Gamepad API) e do teclado.
// Funciona com controles de PS3/PS4/PS5, Xbox, Switch Pro e rádios FPV em modo joystick USB
// (EdgeTX/OpenTX). Ações podem ser ligadas a botões (número) ou a eixos usados como chave
// ("a4+" = eixo 4 acima de +0,5; "a4-" = abaixo de −0,5), como as chaves de um rádio.
import { applyDeadband } from './rates.js';
import { identify } from './controllers.js';

export const ACTIONS = ['arm', 'reset', 'camera', 'mode', 'pause', 'turtle', 'tiltUp', 'tiltDown', 'fovDown', 'fovUp'];

export function bindingActive(gp, b) {
  if (b == null || b === -1) return false;
  if (typeof b === 'number') { const btn = gp.buttons[b]; return !!btn && (btn.pressed || btn.value > 0.5); }
  const m = /^a(\d+)([+-])$/.exec(b);
  if (!m) return false;
  const v = gp.axes[Number(m[1])] ?? 0;
  return m[2] === '+' ? v > 0.5 : v < -0.5;
}

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.gamepad = null;
    this.padInfo = null;
    this.activeId = null;      // controle em uso (o último que se mexeu)
    this.prevButtons = [];
    this.prevAxes = new Map(); // id → últimos eixos (para detectar atividade)
    this.prevActions = new Set();
    this.pressed = new Set();   // ações que começaram neste frame
    this.released = new Set();  // ações que terminaram neste frame
    this.keyActions = new Set(); // ações vindas do teclado neste frame
    this.held = new Set();      // ações ativas
    this.rawButtonsPressed = []; // botões que acabaram de ser apertados (menus/remapeamento)
    this.sticks = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    this.keys = new Set();
    this.keyThrottle = 0;
    this.lastSource = 'none';
    this.override = null; // usado pelo piloto automático de testes
    this.touch = null;    // controles na tela (TouchControls)
    this.keyEdges = [];

    addEventListener('keydown', e => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (!this.keys.has(e.code)) this.keyEdges.push(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('gamepadconnected', e => { this.onConnect?.(e.gamepad); });
    addEventListener('gamepaddisconnected', e => {
      if (e.gamepad.id === this.activeId) this.activeId = null;
      this.onDisconnect?.(e.gamepad);
    });
  }

  listGamepads() {
    // alguns sistemas (Linux/Android) listam os sensores de movimento e o touchpad do
    // DualShock/DualSense como "controles" separados: não são controles de verdade
    return navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && !/motion sensors|touchpad/i.test(g.id)) : [];
  }

  /** Controle escolhido nas configurações, senão o último que teve atividade. */
  findGamepad() {
    const pads = this.listGamepads();
    if (!pads.length) return null;
    const want = this.settings.get('input.gamepadIndex');
    if (want >= 0) { const p = pads.find(g => g.index === want); if (p) return p; }
    return pads.find(g => g.id === this.activeId) || pads.find(g => g.mapping === 'standard') || pads[0];
  }

  /** Marca como ativo o controle que acabou de se mexer (só no poll, uma vez por frame). */
  trackActivity() {
    const pads = this.listGamepads();
    // eixo mexendo só troca de controle se for um controle padrão (ou não houver nenhum):
    // um acessório com eixos "nervosos" não rouba o controle ativo; botão sempre vale
    const hasStandard = pads.some(g => g.mapping === 'standard');
    for (const gp of pads) {
      const prev = this.prevAxes.get(gp.id);
      const moved = prev && gp.axes.some((a, i) => Math.abs(a - (prev[i] ?? a)) > 0.25);
      this.prevAxes.set(gp.id, [...gp.axes]);
      if ((moved && (!hasStandard || gp.mapping === 'standard')) || gp.buttons.some(b => b.pressed)) this.activeId = gp.id;
    }
  }

  axisValue(gp, index) {
    const raw = gp.axes[index] ?? 0;
    const cal = this.settings.get('input.calib')?.[index] || [-1, 0, 1];
    const [mn, ct, mx] = cal;
    const v = raw >= ct ? (raw - ct) / Math.max(mx - ct, 1e-3) : (raw - ct) / Math.max(ct - mn, 1e-3);
    return Math.max(-1, Math.min(1, v));
  }

  channel(gp, name) {
    const m = this.settings.get('input.' + name);
    if (!m) return 0;
    if (m.type === 'button') {
      const v = gp.buttons[m.index]?.value ?? 0;
      return m.invert ? 1 - v : v;
    }
    const v = this.axisValue(gp, m.index);
    return m.invert ? -v : v;
  }

  poll(dt) {
    const s = this.settings.data.input;
    this.pressed.clear();
    this.released.clear();
    this.keyActions.clear();
    this.rawButtonsPressed = [];
    this.trackActivity();
    const gp = this.findGamepad();
    const changed = gp?.id !== this.gamepad?.id;
    this.gamepad = gp;
    if (changed) {
      this.padInfo = identify(gp);
      this.prevButtons = gp ? gp.buttons.map(b => b.pressed || b.value > 0.5) : [];
      if (gp) this.onPadChange?.(gp, this.padInfo);
    }

    const active = new Set();
    if (gp) {
      const buttons = gp.buttons.map(b => b.pressed || b.value > 0.5);
      buttons.forEach((b, i) => { if (b && !this.prevButtons[i]) this.rawButtonsPressed.push(i); });
      this.prevButtons = buttons;
      for (const a of ACTIONS) if (bindingActive(gp, s.buttons[a])) active.add(a);

      const thrRaw = this.channel(gp, 'throttle');
      let thr;
      if (s.throttle.type === 'button') thr = thrRaw;
      else if (s.throttleMode === 'half') thr = Math.max(0, thrRaw);
      else thr = (thrRaw + 1) / 2;
      thr = thr <= s.throttleDeadband ? 0 : (thr - s.throttleDeadband) / (1 - s.throttleDeadband);
      if (gp.id === this.activeId || buttons.some(Boolean)) this.lastSource = 'gamepad';
      if (this.lastSource === 'gamepad' || !this.keys.size) {
        this.sticks.throttle = Math.min(1, Math.max(0, thr));
        this.sticks.yaw = applyDeadband(this.channel(gp, 'yaw'), s.deadband);
        this.sticks.pitch = applyDeadband(this.channel(gp, 'pitch'), s.deadband);
        this.sticks.roll = applyDeadband(this.channel(gp, 'roll'), s.deadband);
      }
    } else {
      this.prevButtons = [];
    }

    // Teclado (reserva / testes)
    if (this.keys.size) this.lastSource = 'keyboard';
    for (const code of this.keyEdges) {
      const map = { Space: 'arm', KeyR: 'reset', KeyC: 'camera', KeyM: 'mode', Escape: 'pause', KeyP: 'pause', BracketRight: 'tiltUp', BracketLeft: 'tiltDown', Comma: 'fovDown', Period: 'fovUp', KeyV: 'vr' };
      if (map[code]) { this.pressed.add(map[code]); this.keyActions.add(map[code]); }
    }
    this.keyEdges = [];
    if (this.keys.has('KeyT')) active.add('turtle');
    if (this.lastSource === 'keyboard') {
      const k = c => (this.keys.has(c) ? 1 : 0);
      this.keyThrottle = Math.max(0, Math.min(1, this.keyThrottle + (k('KeyW') - k('KeyS')) * dt * 0.8));
      if (this.keys.has('KeyX')) this.keyThrottle = 0;
      this.sticks.throttle = this.keyThrottle;
      this.sticks.yaw = k('KeyD') - k('KeyA');
      this.sticks.pitch = k('ArrowUp') - k('ArrowDown');
      this.sticks.roll = k('ArrowRight') - k('ArrowLeft');
    }

    // Controles na tela (celular/tablet): mandam nos sticks enquanto aparecem, a menos que o
    // teclado esteja em uso; os botões viram bordas como as teclas (armar alterna)
    const t = this.touch;
    if (t?.visible && !this.keys.size) {
      this.lastSource = 'touch';
      Object.assign(this.sticks, t.sticks);
      for (const a of t.edges) { this.pressed.add(a); this.keyActions.add(a); }
    }
    if (t) t.edges.length = 0;

    // no frame em que o controle muda não há bordas: uma chave de armar já ligada não arma
    // sozinha (igual ao Betaflight, que exige desligar e ligar a chave de novo)
    if (!changed) {
      for (const a of active) if (!this.prevActions.has(a)) this.pressed.add(a);
      for (const a of this.prevActions) if (!active.has(a)) this.released.add(a);
    }
    this.prevActions = active;
    this.held = active;

    if (this.override) Object.assign(this.sticks, this.override);
    return this.sticks;
  }

  connected() { return !!this.gamepad; }
}
