// OSD estilo Betaflight feito com elementos HTML.
// (Um canvas 2D redesenhado a cada frame custava ~11 FPS num notebook antigo; com DOM só
// os textos que mudam são repintados, e no máximo ~15 vezes por segundo.)
// Nos óculos VR o OSD ganha uma cópia: uma em cada metade da tela, alinhada com a imagem.
import { t } from './i18n.js';

const MARKUP = `
  <div class="osd-cross"></div>
  <div class="osd-tl"><b data-k="arm"></b><span data-k="mode"></span><span data-k="turtle"></span></div>
  <div class="osd-tc"><span data-k="timer"></span><span data-k="lap" class="lap"></span></div>
  <div class="osd-tr"><span data-k="lq"></span><span data-k="cam" class="dim"></span></div>
  <div class="osd-bl"><b data-k="volt"></b><span data-k="mah"></span></div>
  <div class="osd-bc"><span data-k="thr"></span></div>
  <div class="osd-br"><b data-k="speed"></b><span data-k="alt"></span></div>
  <div class="osd-fps" data-k="fps"></div>
  <div class="osd-msgs"></div>
  <div class="osd-stick l"><i></i></div><div class="osd-stick r"><i></i></div>`;

/** Monta o OSD dentro de `root` e devolve os elementos que ele atualiza. */
function buildPart(root) {
  root.innerHTML = MARKUP;
  const el = {};
  for (const e of root.querySelectorAll('[data-k]')) el[e.dataset.k] = e;
  const sticks = [...root.querySelectorAll('.osd-stick')];
  return { root, el, msgBox: root.querySelector('.osd-msgs'), cross: root.querySelector('.osd-cross'), sticks, dots: sticks.map(s => s.querySelector('i')) };
}

export class OSD {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.messages = [];
    this.last = {};
    this.lastText = 0;
    this.parts = [buildPart(root)];
    this.vrKey = '';
  }

  /** Óculos VR: duas cópias do OSD, cada uma sobre a imagem de um olho. */
  setVR(on, scale = 1, shift = 0) {
    const key = on ? `${scale}|${shift}` : '';
    if (key === this.vrKey) return;
    this.vrKey = key;
    if (on && this.parts.length < 2) {
      const r2 = document.createElement('div');
      r2.id = 'osd-r';
      r2.className = this.root.className;
      this.root.after(r2);
      this.parts.push(buildPart(r2));
      this.last = {}; // a cópia nova ainda está vazia: reescreve tudo
      this.msgKey = null;
    }
    document.body.classList.toggle('vr-on', on);
    this.parts.forEach((p, i) => {
      p.root.style.transform = on ? `translateX(${((i ? -1 : 1) * shift * 50).toFixed(2)}vw) scale(${scale})` : '';
      if (i) p.root.hidden = !on;
    });
  }

  set(k, text, color) {
    const ck = k + ':c';
    const newText = this.last[k] !== text, newColor = color !== undefined && this.last[ck] !== color;
    if (!newText && !newColor) return;
    for (const p of this.parts) {
      const e = p.el[k];
      if (newText) e.textContent = text;
      if (newColor) e.style.color = color;
    }
    if (newText) this.last[k] = text;
    if (newColor) this.last[ck] = color;
  }

  flash(text, seconds = 1.6, color = '#ffffff') {
    this.messages = this.messages.filter(m => m.text !== text);
    this.messages.push({ text, until: performance.now() + seconds * 1000, color });
    this.renderMessages();
  }

  renderMessages() {
    const now = performance.now();
    this.messages = this.messages.filter(m => m.until > now);
    const key = this.messages.map(m => m.text + m.color).join('|');
    if (key === this.msgKey) return;
    this.msgKey = key;
    for (const p of this.parts) {
      p.msgBox.innerHTML = '';
      for (const m of this.messages) {
        const d = document.createElement('div');
        d.textContent = m.text;
        d.style.color = m.color;
        p.msgBox.appendChild(d);
      }
    }
  }

  draw(st) {
    const set = this.settings.data;
    const flying = !!st.drone && set.game.osd;
    const showSticks = flying && set.game.showSticks;
    const s = st.sticks;
    for (const p of this.parts) {
      p.root.classList.toggle('on', flying);
      p.cross.style.display = flying && set.camera.mode === 'fpv' ? '' : 'none';
      p.sticks.forEach(el => { el.style.display = showSticks ? '' : 'none'; });
      if (showSticks) {
        p.dots[0].style.transform = `translate(${(s.yaw * 3.3).toFixed(2)}vh, ${(-(s.throttle * 2 - 1) * 3.3).toFixed(2)}vh)`;
        p.dots[1].style.transform = `translate(${(s.roll * 3.3).toFixed(2)}vh, ${(-s.pitch * 3.3).toFixed(2)}vh)`;
      }
    }
    const now = performance.now();
    if (now - this.lastText < 66) return;
    this.lastText = now;
    this.renderMessages();
    this.set('fps', set.graphics.showFps && st.fps ? `${Math.round(st.fps)} FPS · ${Math.round(st.renderScale * 100)}%` : '');
    if (!flying) return;
    const d = st.drone;
    this.set('arm', d.armed ? t('ARMADO') : (d.crashed ? 'CRASH' : t('DESARMADO')), d.armed ? '#7dff7a' : (d.crashed ? '#ff5c5c' : '#ffd24a'));
    this.set('mode', { acro: 'ACRO', angle: 'ANGLE', horizon: 'HOR' }[set.fc.mode] + (set.fc.airmode ? ' AIR' : ''));
    this.set('turtle', st.turtle ? 'TURTLE' : '');
    const ft = d.flightTime;
    this.set('timer', `${String(Math.floor(ft / 60)).padStart(2, '0')}:${String(Math.floor(ft % 60)).padStart(2, '0')}`);
    this.set('lap', st.lap || '');
    const lq = Math.round(st.signal * 100);
    this.set('lq', `LQ ${lq}`, lq < 30 ? '#ff5c5c' : '#ffffff');
    this.set('cam', `${set.camera.uptilt}° · ${set.camera.fov}°`);
    const cells = Math.max(1, Math.round(d.p.cells));
    const low = set.battery.simulate && d.voltage / cells < 3.5;
    this.set('volt', `${d.voltage.toFixed(1)}V`, low ? '#ff5c5c' : '#ffffff');
    this.set('mah', set.battery.simulate ? `${Math.round(d.mAhUsed)}mAh  ${d.current.toFixed(0)}A` : '');
    this.set('thr', `THR ${Math.round(st.throttle * 100)}%`);
    this.set('speed', `${Math.round(st.speed * 3.6)} km/h`);
    this.set('alt', `ALT ${st.alt.toFixed(1)}m`);
    if (low && !this.messages.some(m => m.text === t('BATERIA FRACA'))) this.flash(t('BATERIA FRACA'), 1, '#ff5c5c');
  }
}
