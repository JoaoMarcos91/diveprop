// Controles na tela para celular e tablet: dois sticks (Modo 2) e botões.
// Usa Pointer Events, que valem para toque e para mouse (no computador, teste com ?touch=1).
// Stick esquerdo: ↕ throttle (fica onde você soltar, como num rádio) · ↔ yaw (volta ao centro).
// Stick direito: ↕ pitch · ↔ roll (voltam ao centro).

/** Aparelho só de toque (celular/tablet): tem tela de toque e nenhum mouse/trackpad. */
export const isTouchDevice = () =>
  (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && !matchMedia('(any-pointer: fine)').matches;

import { t } from './i18n.js';

const clamp1 = v => Math.max(-1, Math.min(1, v));

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.forced = /[?&]touch=1/.test(location.search);
    this.sticks = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    this.edges = [];       // ações tocadas desde o último frame (lidas pelo Input)
    this.visible = false;
    this.last = {};
    this.build();
  }

  enabled() {
    if (this.forced) return true;
    const m = this.game.settings.get('input.touch');
    return m === 'on' || (m === 'auto' && isTouchDevice());
  }

  build() {
    const root = this.root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="t-zone l"><div class="t-base"><div class="t-knob"></div></div><span class="t-label">throttle · yaw</span></div>
      <div class="t-zone r"><div class="t-base"><div class="t-knob"></div></div><span class="t-label">pitch · roll</span></div>
      <div class="t-btns l"><button data-a="arm" class="t-arm"></button><button data-a="mode"></button></div>
      <div class="t-btns r"><button data-a="camera"></button><button data-a="reset"></button></div>
      <button class="t-pause" data-a="pause">❚❚</button>
      <div class="t-rotate"><b>↻</b><p></p></div>`;
    document.body.appendChild(root);
    this.armBtn = root.querySelector('.t-arm');
    this.relang();

    const [left, right] = root.querySelectorAll('.t-zone');
    this.leftKnob = this.bindStick(left, (x, y) => {
      this.sticks.yaw = x;
      this.sticks.throttle = (1 - y) / 2;
    }, () => { this.sticks.yaw = 0; return [0, 1 - 2 * this.sticks.throttle]; });
    this.bindStick(right, (x, y) => {
      this.sticks.roll = x;
      this.sticks.pitch = -y;
    }, () => { this.sticks.roll = this.sticks.pitch = 0; return [0, 0]; });
    this.placeKnob(this.leftKnob, 0, 1);

    for (const b of root.querySelectorAll('button[data-a]')) {
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.game.audio.ensure();
        this.edges.push(b.dataset.a);
        b.classList.add('down');
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }
    // nada de rolar, dar zoom ou abrir menu de contexto em cima dos controles
    root.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  }

  /** Textos dos botões no idioma atual. */
  relang() {
    const q = s => this.root.querySelector(s);
    q('[data-a=mode]').textContent = t('MODO');
    q('[data-a=camera]').textContent = t('CÂM');
    q('[data-a=reset]').textContent = 'RESET';
    q('.t-pause').setAttribute('aria-label', t('Pausa'));
    q('.t-rotate p').textContent = t('Gire o celular para jogar na horizontal');
    this.last.armed = undefined; // o update() reescreve ARMAR/DESARMAR
    this.armBtn.textContent = t('ARMAR');
  }

  /** Um stick: o toque vira posição relativa ao centro da base (portão quadrado, −1…1). */
  bindStick(zone, onMove, onRelease) {
    const base = zone.querySelector('.t-base'), knob = zone.querySelector('.t-knob');
    let id = null;
    const move = e => {
      const r = base.getBoundingClientRect();
      const R = r.width / 2;
      const x = clamp1((e.clientX - r.left - R) / R), y = clamp1((e.clientY - r.top - R) / R);
      onMove(x, y);
      this.placeKnob(knob, x, y);
    };
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      try { zone.setPointerCapture(id); } catch { /* ponteiro sintético (testes) */ }
      this.game.audio.ensure();
      move(e);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null;
      const [x, y] = onRelease();
      this.placeKnob(knob, x, y);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    return knob;
  }

  placeKnob(knob, x, y) {
    // translate em % é do próprio knob, que tem 36% da base: meia base = 139% do knob
    knob.style.transform = `translate(${(x * 139).toFixed(1)}%, ${(y * 139).toFixed(1)}%)`;
  }

  /** Chamado a cada frame: mostra só voando, sem controle de videogame ligado. */
  update() {
    const g = this.game;
    const show = this.enabled() && g.state === 'flying' && (this.forced || !g.input.gamepad);
    if (show !== this.visible) {
      this.visible = show;
      this.root.classList.toggle('on', show);
      document.body.classList.toggle('touch-on', show);
      if (!show) this.edges.length = 0;
    }
    const size = g.settings.get('input.touchSize') ?? 1;
    if (size !== this.last.size) { this.root.style.setProperty('--ts', size); this.last.size = size; }
    if (!show) return;
    const armed = !!g.drone?.armed;
    if (armed !== this.last.armed) {
      this.last.armed = armed;
      this.armBtn.textContent = armed ? t('DESARMAR') : t('ARMAR');
      this.armBtn.classList.toggle('armed', armed);
    }
  }
}
