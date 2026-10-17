// Menus, tela de configurações (gerada a partir do SCHEMA), calibração e navegação pelo controle.
import { SCHEMA, getPath } from './settings.js';
import { stickToRate } from './rates.js';
import { SCENES } from './scenes/index.js';
import { buttonName, bindingName, axisName, hapticsSupport } from './controllers.js';

const ACTION_NAMES = {
  arm: 'Armar / desarmar', reset: 'Resetar drone', camera: 'Trocar câmera', mode: 'Modo de voo', pause: 'Pausa / menu',
  turtle: 'Turtle mode (segurar)', tiltUp: 'Câmera ↑ (uptilt +)', tiltDown: 'Câmera ↓ (uptilt −)', fovDown: 'FOV −', fovUp: 'FOV +',
};
const CHANNEL_NAMES = { throttle: 'Throttle', yaw: 'Yaw', pitch: 'Pitch', roll: 'Roll' };

const HAPTICS_LABEL = {
  'trigger-rumble': 'vibração completa (motores + gatilhos)',
  'dual-rumble': 'vibração (dois motores)',
  pulse: 'vibração simples',
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.settings = game.settings;
    this.root = document.getElementById('ui');
    this.current = null;
    this.history = [];
    this.tab = 'controls';
    this.pendingReload = null;
    this.detect = null;   // { channel, base }
    this.remap = null;    // { action, base }
    this.calib = null;
    this.live = [];       // funções atualizadas a cada frame
    this.build();
    this.settings.onChange((path) => this.onSettingChanged(path));
  }

  build() {
    this.root.innerHTML = `
      <div class="screen" id="scr-main">
        <div class="brand"><h1>FPV<span>sim</span></h1><p>Simulador de drone FPV · física realista</p></div>
        <div class="menu-list">
          <button data-act="fly" class="primary">Voar</button>
          <button data-act="settings">Configurações</button>
          <button data-act="help">Controles</button>
        </div>
        <div class="pad-status" data-pad></div>
      </div>
      <div class="screen" id="scr-scenes">
        <h2>Escolha o cenário</h2>
        <div class="cards">${SCENES.map(s => `
          <button class="card" data-scene="${s.id}">
            <div class="card-art art-${s.id}"></div>
            <div class="card-body"><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><span class="tag">${esc(s.tag)}</span></div>
          </button>`).join('')}
        </div>
        <div class="bar"><button data-act="back">Voltar</button></div>
      </div>
      <div class="screen" id="scr-pause">
        <h2>Pausado</h2>
        <div class="menu-list">
          <button data-act="resume" class="primary">Continuar</button>
          <button data-act="respawn">Resetar drone</button>
          <button data-act="settings">Configurações</button>
          <button data-act="fly">Trocar cenário</button>
          <button data-act="help">Controles</button>
          <button data-act="mainmenu">Menu principal</button>
        </div>
        <div class="pad-status" data-pad></div>
      </div>
      <div class="screen wide" id="scr-settings">
        <div class="settings-head"><h2>Configurações</h2><div class="tabs">${SCHEMA.map(t => `<button data-tab="${t.id}">${esc(t.tab)}</button>`).join('')}</div></div>
        <div class="reload-bar" hidden><span></span><button data-act="apply-reload" class="primary">Aplicar agora</button></div>
        <div class="settings-body"></div>
        <div class="bar"><button data-act="reset-tab">Restaurar padrão desta aba</button><button data-act="back" class="primary">Voltar</button></div>
      </div>
      <div class="screen" id="scr-help">
        <h2>Controles</h2>
        <div class="help">
          <div><h3>Controle (PS3/PS4/PS5, Xbox, Switch) · Modo 2</h3><ul>
            <li><b>Stick esquerdo</b> ↕ throttle · ↔ yaw</li>
            <li><b>Stick direito</b> ↕ pitch · ↔ roll</li>
            <li><b>R1 / RB</b> armar / desarmar (throttle embaixo)</li>
            <li><b>△ / Y</b> resetar drone · <b>□ / X</b> trocar câmera</li>
            <li><b>L1 / LB</b> modo de voo (Acro / Angle / Horizon)</li>
            <li><b>✕ / A segurado</b> turtle mode (desvirar)</li>
            <li><b>D-pad ↑↓</b> ângulo da câmera · <b>←→</b> FOV</li>
            <li><b>Options / Menu</b> pausa · nos menus: D-pad + ✕/A e ○/B</li>
          </ul><p class="hint">Conecte o controle (USB ou Bluetooth) e aperte qualquer botão para o navegador reconhecer. Controles que vibram (PS4, PS5, Xbox…) tremem nas batidas.</p>
          <h3>Rádio FPV (EdgeTX / OpenTX)</h3><ul>
            <li>Ligue o rádio no USB em modo <b>Joystick (HID)</b></li>
            <li>Layout AETR automático · <b>CH5</b> arma (chave mantida) · <b>CH6</b> modo · <b>CH7</b> turtle</li>
            <li>Ajuste canais, chaves e calibração em Configurações → Controle</li>
          </ul></div>
          <div><h3>Teclado (reserva)</h3><ul>
            <li><b>W / S</b> throttle · <b>X</b> corta</li>
            <li><b>A / D</b> yaw · <b>setas</b> pitch / roll</li>
            <li><b>Espaço</b> armar · <b>R</b> reset · <b>C</b> câmera</li>
            <li><b>M</b> modo · <b>T</b> turtle · <b>Esc</b> pausa</li>
            <li><b>[ ]</b> ângulo da câmera · <b>, .</b> FOV</li>
          </ul><p class="hint">Dica: comece em <b>Angle</b> (L1) se nunca voou FPV. Em <b>Acro</b> o drone não se nivela sozinho — é assim que drones reais de freestyle voam.</p></div>
        </div>
        <div class="bar"><button data-act="back" class="primary">Voltar</button></div>
      </div>
      <div class="screen" id="scr-loading">
        <h2 data-loading-title>Carregando…</h2>
        <div class="progress"><div></div></div>
        <p class="hint" data-loading-hint></p>
      </div>
      <div class="toast" hidden></div>`;

    this.root.addEventListener('click', e => {
      const el = e.target.closest('[data-act],[data-scene],[data-tab]');
      if (!el) return;
      this.game.audio.ensure();
      if (el.dataset.scene) return this.game.startScene(el.dataset.scene);
      if (el.dataset.tab) { this.tab = el.dataset.tab; return this.renderSettings(); }
      this.action(el.dataset.act);
    });
  }

  action(act) {
    const g = this.game;
    switch (act) {
      case 'fly': this.show('scenes'); break;
      case 'settings': this.show('settings'); break;
      case 'help': this.show('help'); break;
      case 'back': this.back(); break;
      case 'resume': g.resume(); break;
      case 'respawn': g.respawn(); g.resume(); break;
      case 'mainmenu': g.toMainMenu(); break;
      case 'reset-tab': this.resetTab(); break;
      case 'apply-reload':
        if (this.pendingReload === 'page') { location.reload(); return; }
        this.pendingReload = null;
        g.reloadScene();
        break;
    }
  }

  show(name, { push = true } = {}) {
    if (push && this.current && this.current !== name && this.current !== 'loading') this.history.push(this.current);
    this.current = name;
    this.root.classList.add('open');
    for (const s of this.root.querySelectorAll('.screen')) s.classList.toggle('active', s.id === 'scr-' + name);
    if (name === 'settings') this.renderSettings();
    this.updatePadStatus();
    requestAnimationFrame(() => {
      const first = this.root.querySelector(`#scr-${name} .primary, #scr-${name} button`);
      first?.focus({ preventScroll: true });
    });
  }

  hide() {
    this.current = null;
    this.history = [];
    this.root.classList.remove('open');
    for (const s of this.root.querySelectorAll('.screen')) s.classList.remove('active');
    this.detect = this.remap = this.calib = null;
  }

  isOpen() { return !!this.current; }

  /** Família do controle em uso: decide os nomes dos botões (✕○□△, A B X Y, chaves do rádio…). */
  family() { return this.game.input.padInfo?.family || 'playstation'; }

  back() {
    this.detect = this.remap = this.calib = null;
    if (this.current === 'pause') return this.game.resume();
    const prev = this.history.pop();
    if (prev) this.show(prev, { push: false });
    else if (this.game.state === 'paused') this.show('pause', { push: false });
    else this.show('main', { push: false });
  }

  loading(title, progress, hint = '') {
    if (this.current !== 'loading') this.show('loading', { push: false });
    this.root.querySelector('[data-loading-title]').textContent = title;
    this.root.querySelector('.progress > div').style.width = Math.round(progress * 100) + '%';
    this.root.querySelector('[data-loading-hint]').textContent = hint;
  }

  toast(text, ms = 2500) {
    const t = this.root.querySelector('.toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  updatePadStatus() {
    const gp = this.game.input.gamepad || this.game.input.findGamepad();
    for (const el of this.root.querySelectorAll('[data-pad]')) {
      el.innerHTML = gp
        ? `<span class="dot ok"></span>Conectado: ${esc(this.game.input.padInfo?.model || gp.id.replace(/\(.*?Vendor.*?\)/i, '').trim().slice(0, 48))}`
        : `<span class="dot"></span>Nenhum controle — conecte um controle ou rádio FPV e aperte um botão (ou use o teclado)`;
    }
  }

  // ------------------------------------------------------------------ configurações
  renderSettings() {
    const body = this.root.querySelector('.settings-body');
    const scroll = body.scrollTop;
    this.live = [];
    for (const b of this.root.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === this.tab);
    const tab = SCHEMA.find(t => t.id === this.tab) || SCHEMA[0];
    const data = this.settings.data;
    body.innerHTML = '';
    for (const grp of tab.groups) {
      if (grp.when && !grp.when(data)) continue;
      const sec = document.createElement('section');
      if (grp.title) sec.innerHTML = `<h3>${esc(grp.title)}</h3>`;
      if (grp.custom) this['custom_' + grp.custom](sec);
      else for (const f of grp.fields) sec.appendChild(this.fieldRow(f));
      body.appendChild(sec);
    }
    body.scrollTop = scroll;
    this.updateReloadBar();
  }

  fieldRow(f) {
    const row = document.createElement('div');
    row.className = 'row';
    const v = this.settings.get(f.path);
    const help = f.help ? `<i class="help-i" title="${esc(f.help)}">?</i>` : '';
    const reload = f.reload ? '<em class="reload-tag">↻</em>' : '';
    let control = '';
    if (f.type === 'range') control = `<input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">`;
    else if (f.type === 'select') control = `<select>${Object.entries(f.options).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (f.type === 'toggle') control = `<input type="checkbox" ${v ? 'checked' : ''}>`;
    row.innerHTML = `<label class="lbl">${esc(f.label)} ${help}${reload}</label><div class="ctl">${control}<span class="val"></span></div>`;
    const input = row.querySelector('input,select');
    const val = row.querySelector('.val');
    const fmt = x => {
      if (f.type !== 'range') return '';
      const n = Number(x) * (f.scale || 1);
      const digits = f.digits ?? (f.step * (f.scale || 1) < 0.01 ? 3 : f.step * (f.scale || 1) < 1 ? 2 : 0);
      return n.toFixed(digits) + (f.unit ? ' ' + f.unit : '');
    };
    val.textContent = fmt(v);
    const commit = () => {
      let nv = f.type === 'toggle' ? input.checked : input.value;
      if (f.type === 'range' || f.numeric) nv = Number(nv);
      val.textContent = fmt(nv);
      if (f.reload) this.pendingReload = f.reload === 'page' ? 'page' : (this.pendingReload || 'scene');
      this.settings.set(f.path, nv);
    };
    input.addEventListener('input', commit);
    input.addEventListener('change', commit);
    return row;
  }

  onSettingChanged(path) {
    if (this.current !== 'settings') return;
    const rerender = path === '*' || /preset$|layout$|rates\.type|input\.(throttle|yaw|pitch|roll|buttons|calib)/.test(path) || path === 'input' || path === 'graphics' || path === 'drone';
    if (rerender) this.renderSettings();
    if (path.startsWith('rates')) this.drawRates?.();
    this.updateReloadBar();
  }

  updateReloadBar() {
    const bar = this.root.querySelector('.reload-bar');
    bar.hidden = !this.pendingReload;
    if (this.pendingReload) bar.querySelector('span').textContent = this.pendingReload === 'page'
      ? 'Anti-aliasing só muda reiniciando o jogo.'
      : 'Algumas mudanças gráficas precisam recarregar o cenário.';
  }

  resetTab() {
    const map = { controls: ['input'], rates: ['rates'], physics: ['drone', 'world', 'battery'], fc: ['fc'], camera: ['camera'], graphics: ['graphics'], game: ['audio'] };
    for (const s of map[this.tab] || []) this.settings.resetSection(s);
    if (this.tab === 'graphics') this.pendingReload = 'scene';
    this.renderSettings();
    this.toast('Padrões restaurados');
  }

  // ---- widgets personalizados
  custom_channels(sec) {
    const wrap = document.createElement('div');
    wrap.className = 'channels';
    const inp = this.settings.data.input;
    for (const ch of Object.keys(CHANNEL_NAMES)) {
      const m = inp[ch];
      const row = document.createElement('div');
      row.className = 'row';
      const fam = this.family();
      const nAxes = Math.max(8, this.game.input.gamepad?.axes.length || 0);
      const opts = Array.from({ length: nAxes }, (_, i) => `<option value="axis:${i}" ${m.type === 'axis' && m.index === i ? 'selected' : ''}>${esc(axisName(fam, i))}</option>`).join('')
        + [6, 7].map(i => `<option value="button:${i}" ${m.type === 'button' && m.index === i ? 'selected' : ''}>Gatilho ${esc(buttonName(fam, i))}</option>`).join('');
      row.innerHTML = `<label class="lbl">${CHANNEL_NAMES[ch]}</label>
        <div class="ctl"><select>${opts}</select>
        <label class="inv"><input type="checkbox" ${m.invert ? 'checked' : ''}> inverter</label>
        <div class="meter"><div></div></div>
        <button class="small" data-detect>Detectar</button></div>`;
      const [sel, inv] = [row.querySelector('select'), row.querySelector('input')];
      const update = () => {
        const [type, idx] = sel.value.split(':');
        this.settings.set('input.' + ch, { type, index: Number(idx), invert: inv.checked });
      };
      sel.addEventListener('change', update);
      inv.addEventListener('change', update);
      row.querySelector('[data-detect]').addEventListener('click', () => {
        const gp = this.game.input.findGamepad();
        if (!gp) return this.toast('Conecte o controle e aperte um botão primeiro');
        this.detect = { channel: ch, base: [...gp.axes], btnBase: gp.buttons.map(b => b.value) };
        this.toast(`Mova o stick de ${CHANNEL_NAMES[ch]} para ${ch === 'throttle' || ch === 'pitch' ? 'CIMA' : 'a DIREITA'}…`, 4000);
      });
      const bar = row.querySelector('.meter > div');
      this.live.push(() => {
        const s = this.game.input.sticks[ch];
        if (ch === 'throttle') { bar.style.left = '0'; bar.style.width = (s * 100) + '%'; }
        else { bar.style.left = (50 + Math.min(0, s) * 50) + '%'; bar.style.width = (Math.abs(s) * 50) + '%'; }
      });
      wrap.appendChild(row);
    }
    sec.appendChild(wrap);
  }

  custom_buttons(sec) {
    const b = this.settings.data.input.buttons;
    const fam = this.family();
    for (const [act, name] of Object.entries(ACTION_NAMES)) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label class="lbl">${name}</label><div class="ctl"><span class="btn-chip">${esc(bindingName(fam, b[act]))}</span><button class="small" data-set>Mudar</button><button class="small" data-clear title="Sem botão">×</button></div>`;
      row.querySelector('[data-set]').addEventListener('click', () => {
        const gp = this.game.input.findGamepad();
        if (!gp) return this.toast('Conecte o controle e aperte um botão primeiro');
        this.remap = { action: act, base: [...gp.axes] };
        row.querySelector('.btn-chip').textContent = 'aperte…';
        this.toast(`Aperte o botão (ou mude a chave do rádio) para "${name}"`, 4000);
      });
      row.querySelector('[data-clear]').addEventListener('click', () => {
        this.settings.set('input.buttons.' + act, -1);
        this.renderSettings();
      });
      sec.appendChild(row);
    }
  }

  custom_hapticsTest(sec) {
    const div = document.createElement('div');
    div.className = 'bar-inline';
    div.innerHTML = '<button class="small" data-test>Testar vibração</button><span class="hint" data-hstatus></span>';
    const status = div.querySelector('[data-hstatus]');
    div.querySelector('[data-test]').addEventListener('click', () => {
      const ok = this.game.haptics.play(1, 1, 450, { triggers: 1, force: true });
      if (!ok) this.toast('Este controle/navegador não aceita vibração');
    });
    this.live.push(() => {
      const gp = this.game.input.gamepad;
      const kind = hapticsSupport(gp);
      const txt = !gp ? 'Nenhum controle conectado.' : kind ? `Suporte: ${HAPTICS_LABEL[kind]}.` : 'Este controle/navegador não informa suporte a vibração (rádios FPV não vibram; no Firefox costuma vir desligado).';
      if (status.textContent !== txt) status.textContent = txt;
    });
    sec.appendChild(div);
  }

  custom_gamepadMonitor(sec) {
    const div = document.createElement('div');
    div.className = 'monitor';
    const pads = this.game.input.listGamepads();
    const want = this.settings.get('input.gamepadIndex');
    div.innerHTML = `
      <div class="row"><label class="lbl">Controle usado</label><div class="ctl"><select data-pad-sel>
        <option value="-1">Automático (o último que você mexer)</option>
        ${pads.map(p => `<option value="${p.index}" ${want === p.index ? 'selected' : ''}>${esc(p.id.slice(0, 60))}</option>`).join('')}
      </select></div></div>
      <p class="hint" data-pad-info></p>
      <div class="axes"></div><div class="btns"></div>
      <div class="bar-inline"><button class="small" data-cal>Calibrar sticks</button><button class="small" data-cal-reset>Zerar calibração</button></div>
      <p class="hint" data-cal-msg></p>`;
    div.querySelector('[data-pad-sel]').addEventListener('change', e => this.settings.set('input.gamepadIndex', Number(e.target.value)));
    div.querySelector('[data-cal]').addEventListener('click', () => {
      if (!this.game.input.findGamepad()) return this.toast('Conecte o controle primeiro');
      this.calib = { phase: 'range', t: 0, min: [1, 1, 1, 1], max: [-1, -1, -1, -1], center: [0, 0, 0, 0], n: 0 };
    });
    div.querySelector('[data-cal-reset]').addEventListener('click', () => {
      this.settings.set('input.calib', {});
      this.toast('Calibração zerada');
    });
    const axesEl = div.querySelector('.axes'), btnsEl = div.querySelector('.btns'), info = div.querySelector('[data-pad-info]'), calMsg = div.querySelector('[data-cal-msg]');
    let built = 0;
    this.live.push(() => {
      const gp = this.game.input.findGamepad();
      if (!gp) { info.textContent = 'Nenhum controle detectado. Conecte via USB e aperte qualquer botão.'; return; }
      const pi = this.game.input.padInfo;
      const txt = `${pi?.model || 'Controle'} · ${gp.mapping === 'standard' ? 'mapeamento padrão' : 'mapeamento próprio — confira os canais com "Detectar"'} · ${gp.id}`;
      if (info.textContent !== txt) info.textContent = txt;
      const key = gp.id + gp.axes.length + ':' + gp.buttons.length;
      if (built !== key) {
        built = key;
        const fam = this.family();
        axesEl.innerHTML = gp.axes.map((_, i) => `<div class="axis"><span>${esc(axisName(fam, i))}</span><div class="meter"><div></div></div><em></em></div>`).join('');
        btnsEl.innerHTML = gp.buttons.map((_, i) => `<span class="chip">${esc(buttonName(fam, i))}</span>`).join('');
      }
      gp.axes.forEach((a, i) => {
        const el = axesEl.children[i]; if (!el) return;
        const bar = el.querySelector('.meter > div');
        bar.style.left = (50 + Math.min(0, a) * 50) + '%';
        bar.style.width = (Math.abs(a) * 50) + '%';
        el.querySelector('em').textContent = a.toFixed(2);
      });
      gp.buttons.forEach((b, i) => btnsEl.children[i]?.classList.toggle('on', b.pressed || b.value > 0.5));
      if (this.calib) {
        const c = this.calib;
        if (c.phase === 'range') {
          calMsg.textContent = 'Gire os DOIS sticks em círculos, até o limite, por 4 segundos…';
          for (let i = 0; i < 4; i++) { c.min[i] = Math.min(c.min[i], gp.axes[i] ?? 0); c.max[i] = Math.max(c.max[i], gp.axes[i] ?? 0); }
          if (c.t > 4) { c.phase = 'center'; c.t = 0; }
        } else {
          calMsg.textContent = 'Agora SOLTE os sticks…';
          if (c.t > 1) { for (let i = 0; i < 4; i++) c.center[i] += gp.axes[i] ?? 0; c.n++; }
          if (c.t > 2.2) {
            const cal = {};
            for (let i = 0; i < 4; i++) {
              const ctr = c.n ? c.center[i] / c.n : 0;
              cal[i] = [Math.min(c.min[i], -0.5), Math.abs(ctr) < 0.25 ? ctr : 0, Math.max(c.max[i], 0.5)];
            }
            this.settings.set('input.calib', cal);
            this.calib = null;
            calMsg.textContent = 'Calibração salva ✓';
          }
        }
      }
    });
    sec.appendChild(div);
  }

  custom_rateCurves(sec) {
    const div = document.createElement('div');
    div.className = 'rates-preview';
    div.innerHTML = '<canvas width="560" height="220"></canvas><div class="rate-max"></div>';
    sec.appendChild(div);
    const cv = div.querySelector('canvas');
    const g = cv.getContext('2d');
    const maxEl = div.querySelector('.rate-max');
    this.drawRates = () => {
      if (!cv.isConnected) return;
      const r = this.settings.data.rates;
      const W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H);
      const axes = [['roll', '#ff6b5c'], ['pitch', '#5cc8ff'], ['yaw', '#ffd24a']];
      const maxes = axes.map(([a]) => stickToRate(1, a, r));
      const top = Math.max(200, ...maxes) * 1.1;
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 1;
      for (let d = 0; d <= top; d += 200) { const y = H - d / top * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (const [a, col] of axes) {
        g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath();
        for (let x = 0; x <= W; x += 2) { const v = stickToRate(x / W, a, r); const y = H - v / top * H; x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = '12px sans-serif';
      g.fillText('°/s vs. deflexão do stick', 8, 16);
      maxEl.innerHTML = axes.map(([a, col], i) => `<span style="color:${col}">${a} máx ${Math.round(maxes[i])}°/s</span>`).join(' · ');
    };
    requestAnimationFrame(() => this.drawRates());
  }

  custom_dataTools(sec) {
    const div = document.createElement('div');
    div.className = 'data-tools';
    div.innerHTML = `
      <div class="bar-inline"><button class="small" data-exp>Exportar configurações (.json)</button>
      <button class="small" data-imp>Importar do texto abaixo</button>
      <button class="small danger" data-all>Restaurar TUDO</button></div>
      <textarea rows="4" placeholder="Cole aqui um JSON de configurações para importar"></textarea>`;
    div.querySelector('[data-exp]').addEventListener('click', () => {
      const blob = new Blob([this.settings.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fpvsim-config.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    div.querySelector('[data-imp]').addEventListener('click', () => {
      try { this.settings.importJSON(div.querySelector('textarea').value); this.toast('Configurações importadas'); this.pendingReload = 'scene'; this.renderSettings(); }
      catch { this.toast('JSON inválido'); }
    });
    div.querySelector('[data-all]').addEventListener('click', () => {
      if (!confirm('Restaurar todas as configurações para o padrão?')) return;
      this.settings.resetAll();
      this.pendingReload = 'scene';
      this.renderSettings();
    });
    sec.appendChild(div);
  }

  // ------------------------------------------------------------------ por frame
  tick(dt, input) {
    if (!this.current) return;
    if (this.calib) this.calib.t += dt;
    for (const fn of this.live) fn();
    const gp = input.gamepad;
    if (this.detect && gp) {
      const d = this.detect;
      let best = -1, bestV = 0;
      gp.axes.forEach((a, i) => { const dv = a - (d.base[i] ?? 0); if (Math.abs(dv) > 0.55 && Math.abs(dv) > Math.abs(bestV)) { best = i; bestV = dv; } });
      if (best >= 0) {
        this.settings.set('input.' + d.channel, { type: 'axis', index: best, invert: bestV < 0 });
        this.toast(`${CHANNEL_NAMES[d.channel]} → ${axisName(this.family(), best)}${bestV < 0 ? ' (invertido)' : ''}`);
        this.detect = null;
      } else {
        for (const i of [6, 7]) {
          if ((gp.buttons[i]?.value ?? 0) - (d.btnBase[i] ?? 0) > 0.6) {
            this.settings.set('input.' + d.channel, { type: 'button', index: i, invert: false });
            this.toast(`${CHANNEL_NAMES[d.channel]} → gatilho ${buttonName(this.family(), i)}`);
            this.detect = null;
            break;
          }
        }
      }
      return;
    }
    if (this.remap && gp) {
      // botão apertado, ou eixo que mudou muito (chave de rádio) → vira "aN+" / "aN-"
      let b = input.rawButtonsPressed[0];
      if (b == null) {
        gp.axes.forEach((a, i) => {
          if (b == null && Math.abs(a - (this.remap.base[i] ?? a)) > 0.8 && Math.abs(a) > 0.5) b = `a${i}${a > 0 ? '+' : '-'}`;
        });
      }
      if (b != null) {
        this.settings.set('input.buttons.' + this.remap.action, b);
        this.toast(`${ACTION_NAMES[this.remap.action]} → ${bindingName(this.family(), b)}`);
        this.remap = null;
        this.renderSettings();
      }
      return;
    }
    if (this.calib) return;
    this.gamepadNav(input.rawButtonsPressed);
  }

  gamepadNav(pressed) {
    if (!pressed.length) return;
    const scr = this.root.querySelector('.screen.active');
    if (!scr) return;
    const items = [...scr.querySelectorAll('button, input, select')].filter(el => el.offsetParent !== null && !el.disabled);
    const active = document.activeElement;
    let i = items.indexOf(active);
    for (const b of pressed) {
      if (b === 12 || b === 13) {
        i = i < 0 ? 0 : (i + (b === 13 ? 1 : -1) + items.length) % items.length;
        items[i]?.focus();
        items[i]?.scrollIntoView({ block: 'nearest' });
      } else if (b === 14 || b === 15) {
        const dir = b === 15 ? 1 : -1;
        if (active?.type === 'range') {
          const step = Number(active.step) || 1;
          active.value = Math.min(Number(active.max), Math.max(Number(active.min), Number(active.value) + dir * step * Math.max(1, Math.round((active.max - active.min) / step / 50))));
          active.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (active?.tagName === 'SELECT') {
          active.selectedIndex = Math.min(active.options.length - 1, Math.max(0, active.selectedIndex + dir));
          active.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (this.current === 'settings') {
          const tabs = SCHEMA.map(t => t.id);
          this.tab = tabs[(tabs.indexOf(this.tab) + dir + tabs.length) % tabs.length];
          this.renderSettings();
        } else {
          i = i < 0 ? 0 : (i + dir + items.length) % items.length;
          items[i]?.focus();
        }
      } else if (b === 0) {
        if (active && items.includes(active)) active.click();
        else items[0]?.focus();
      } else if (b === 1) {
        this.back();
        return;
      } else if (b === 9 && this.current === 'pause') {
        this.game.resume();
        return;
      }
    }
  }
}
