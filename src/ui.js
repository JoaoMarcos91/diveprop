// Menus, tela de configurações (gerada a partir do SCHEMA), calibração e navegação pelo controle.
import { SCHEMA, getPath } from './settings.js';
import { stickToRate } from './rates.js';
import { SCENES } from './scenes/index.js';
import { buttonName, bindingName, axisName, hapticsSupport } from './controllers.js';
import { estimateTopSpeed, tuneTopSpeed, thrustToWeight, hoverThrottle } from './flightPerf.js';
import { t, getLang, LANGS } from './i18n.js';
import { cloudMessage } from './cloud.js';

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
const te = (s, v) => esc(t(s, v));

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
    this.root.addEventListener('click', e => {
      const el = e.target.closest('[data-act],[data-scene],[data-tab]');
      if (!el) return;
      this.game.audio.ensure();
      if (el.dataset.scene) return this.game.startScene(el.dataset.scene);
      if (el.dataset.tab) { this.tab = el.dataset.tab; return this.renderSettings(); }
      this.action(el.dataset.act);
    });
    this.settings.onChange((path) => this.onSettingChanged(path));
  }

  /** Troca de idioma: refaz as telas e volta para a que estava aberta. */
  relang() {
    const cur = this.current, hist = this.history;
    this.build();
    if (cur) { this.show(cur, { push: false }); this.history = hist; }
  }

  build() {
    const other = getLang() === 'en' ? 'pt' : 'en';
    this.root.innerHTML = `
      <div class="screen" id="scr-main">
        <div class="brand"><h1>Dive<span>Prop</span></h1><p>${te('Simulador de drone FPV · física realista')}</p></div>
        <div class="menu-list">
          <button data-act="fly" class="primary">${te('Voar')}</button>
          <button data-act="settings">${te('Configurações')}</button>
          <button data-act="help">${te('Controles')}</button>
          <button data-act="account" data-account-btn hidden></button>
        </div>
        <div class="pad-status" data-pad></div>
        <div class="menu-foot"><button data-act="share" class="small">${te('Compartilhar com amigos')}</button><button data-act="lang" class="small" lang="${other}">${esc(LANGS[other])}</button><a href="https://github.com/JoaoMarcos91/diveprop" target="_blank" rel="noopener">${te('Grátis e de código aberto · GitHub')}</a></div>
      </div>
      <div class="screen" id="scr-scenes">
        <h2>${te('Escolha o cenário')}</h2>
        <div class="cards">${SCENES.map(s => `
          <button class="card" data-scene="${s.id}">
            <div class="card-art art-${s.id}"><img src="${import.meta.env.BASE_URL}assets/thumbs/${s.id}.jpg" alt="" loading="lazy" onerror="this.remove()"></div>
            <div class="card-body"><h3>${te(s.name)}</h3><p>${te(s.desc)}</p><span class="tag">${te(s.tag)}</span></div>
          </button>`).join('')}
        </div>
        <div class="bar"><button data-act="back">${te('Voltar')}</button></div>
      </div>
      <div class="screen" id="scr-pause">
        <h2>${te('Pausado')}</h2>
        <div class="menu-list">
          <button data-act="resume" class="primary">${te('Continuar')}</button>
          <button data-act="respawn">${te('Resetar drone')}</button>
          <button data-act="settings">${te('Configurações')}</button>
          <button data-act="fly">${te('Trocar cenário')}</button>
          <button data-act="help">${te('Controles')}</button>
          <button data-act="mainmenu">${te('Menu principal')}</button>
        </div>
        <div class="pad-status" data-pad></div>
      </div>
      <div class="screen wide" id="scr-settings">
        <div class="settings-head"><h2>${te('Configurações')}</h2><div class="tabs">${SCHEMA.map(tb => `<button data-tab="${tb.id}">${te(tb.tab)}</button>`).join('')}</div></div>
        <div class="reload-bar" hidden><span></span><button data-act="apply-reload" class="primary">${te('Aplicar agora')}</button></div>
        <div class="settings-body"></div>
        <div class="bar"><button data-act="reset-tab">${te('Restaurar padrão desta aba')}</button><button data-act="back" class="primary">${te('Voltar')}</button></div>
      </div>
      <div class="screen" id="scr-help">
        <h2>${te('Controles')}</h2>
        <div class="help">
          <div><h3>${te('Controle (PS3/PS4/PS5, Xbox, Switch) · Modo 2')}</h3><ul>
            <li>${t('<b>Stick esquerdo</b> ↕ throttle · ↔ yaw')}</li>
            <li>${t('<b>Stick direito</b> ↕ pitch · ↔ roll')}</li>
            <li>${t('<b>R1 / RB</b> armar / desarmar (throttle embaixo)')}</li>
            <li>${t('<b>△ / Y</b> resetar drone · <b>□ / X</b> trocar câmera')}</li>
            <li>${t('<b>L1 / LB</b> modo de voo (Acro / Angle / Horizon)')}</li>
            <li>${t('<b>✕ / A segurado</b> turtle mode (desvirar)')}</li>
            <li>${t('<b>D-pad ↑↓</b> ângulo da câmera · <b>←→</b> FOV')}</li>
            <li>${t('<b>Options / Menu</b> pausa · nos menus: D-pad + ✕/A e ○/B')}</li>
          </ul><p class="hint">${te('Conecte o controle (USB ou Bluetooth) e aperte qualquer botão para o navegador reconhecer. Controles que vibram (PS4, PS5, Xbox…) tremem nas batidas.')}</p>
          <h3>${te('Rádio FPV (EdgeTX / OpenTX)')}</h3><ul>
            <li>${t('Ligue o rádio no USB em modo <b>Joystick (HID)</b>')}</li>
            <li>${t('Layout AETR automático · <b>CH5</b> arma (chave mantida) · <b>CH6</b> modo · <b>CH7</b> turtle')}</li>
            <li>${te('Ajuste canais, chaves e calibração em Configurações → Controle')}</li>
          </ul></div>
          <div><h3>${te('Teclado (reserva)')}</h3><ul>
            <li>${t('<b>W / S</b> throttle · <b>X</b> corta')}</li>
            <li>${t('<b>A / D</b> yaw · <b>setas</b> pitch / roll')}</li>
            <li>${t('<b>Espaço</b> armar · <b>R</b> reset · <b>C</b> câmera')}</li>
            <li>${t('<b>M</b> modo · <b>T</b> turtle · <b>Esc</b> pausa')}</li>
            <li>${t('<b>[ ]</b> ângulo da câmera · <b>, .</b> FOV')}</li>
          </ul>
          <h3>${te('Celular e tablet (toque)')}</h3><ul>
            <li>${t('<b>Stick esquerdo</b> ↕ throttle (fica onde você soltar) · ↔ yaw')}</li>
            <li>${t('<b>Stick direito</b> ↕ pitch · ↔ roll')}</li>
            <li>${t('<b>ARMAR</b> com o throttle embaixo · <b>MODO</b> Acro/Angle/Horizon · <b>CÂM</b> câmera · <b>RESET</b>')}</li>
            <li>${te('Jogue com o celular deitado. No Android, "Adicionar à tela inicial" abre em tela cheia')}</li>
          </ul><p class="hint">${t('Dica: comece em <b>Angle</b> (L1, M ou MODO) se nunca voou FPV. Em <b>Acro</b> o drone não se nivela sozinho — é assim que drones reais de freestyle voam.')}</p></div>
        </div>
        <div class="bar"><button data-act="back" class="primary">${te('Voltar')}</button></div>
      </div>
      <div class="screen" id="scr-account">
        <h2>${te('Conta')}</h2>
        <div data-account></div>
        <div class="bar"><button data-act="back">${te('Voltar')}</button></div>
      </div>
      <div class="screen" id="scr-loading">
        <h2 data-loading-title>${te('Carregando…')}</h2>
        <div class="progress"><div></div></div>
        <p class="hint" data-loading-hint></p>
      </div>
      <div class="toast" hidden></div>`;
  }

  action(act) {
    const g = this.game;
    switch (act) {
      case 'fly': this.show('scenes'); break;
      case 'settings': this.show('settings'); break;
      case 'help': this.show('help'); break;
      case 'share': this.share(); break;
      case 'account': this.show('account'); break;
      case 'lang': this.settings.set('game.lang', getLang() === 'en' ? 'pt' : 'en'); break;
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
    if (name === 'account') this.renderAccount();
    this.updatePadStatus();
    this.updateAccountButton();
    requestAnimationFrame(() => {
      const first = this.root.querySelector(`#scr-${name} .primary, #scr-${name} button`);
      first?.focus({ preventScroll: true });
    });
  }

  /** Compartilhar o site: menu do sistema no celular, senão copia o link. */
  async share() {
    const url = 'https://joaomarcos91.github.io/diveprop/';
    const data = { title: 'DiveProp', text: t('Simulador de drone FPV grátis no navegador, com física realista. Dá para jogar com controle de PS4/PS5/Xbox, rádio FPV ou no celular:'), url };
    try {
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(`${data.text} ${url}`);
      this.toast(t('Link copiado — é só colar no WhatsApp, Discord…'), 3500);
    } catch (e) {
      if (e?.name !== 'AbortError') this.toast(url, 8000);
    }
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
        ? `<span class="dot ok"></span>${te('Conectado: {model}', { model: this.game.input.padInfo?.model || gp.id.replace(/\(.*?Vendor.*?\)/i, '').trim().slice(0, 48) })}`
        : this.game.touch?.enabled()
          ? `<span class="dot ok"></span>${te('Controles na tela (toque) · também dá para conectar um controle Bluetooth')}`
          : `<span class="dot"></span>${te('Nenhum controle — conecte um controle ou rádio FPV e aperte um botão (ou use o teclado)')}`;
    }
  }

  // ------------------------------------------------------------------ conta
  updateAccountButton() {
    const cloud = this.game.cloud, btn = this.root.querySelector('[data-account-btn]');
    if (!btn) return;
    btn.hidden = !cloud?.configured();
    btn.textContent = cloud?.user ? t('Conta: {user}', { user: cloud.user }) : t('Entrar / criar conta');
  }

  /** Chamado quando a conta muda (entrou, saiu, salvou…). */
  onCloud() {
    this.updateAccountButton();
    if (this.current === 'account') this.renderAccountStatus();
    if (this.current === 'settings' && this.tab === 'presets') this.renderSettings();
  }

  cloudStatusText() {
    const c = this.game.cloud;
    if (!c?.user) return '';
    if (c.status === 'syncing') return t('Salvando na nuvem…');
    if (c.status === 'error') return t('Não deu para sincronizar: {msg}', { msg: c.error });
    if (c.savedAt) return t('Tudo salvo na nuvem ✓ ({time})', { time: new Date(c.savedAt).toLocaleTimeString(getLang() === 'en' ? 'en' : 'pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    return t('Conectado');
  }

  renderAccountStatus() {
    const el = this.root.querySelector('[data-cloud-status]');
    if (el) { el.textContent = this.cloudStatusText(); el.classList.toggle('err', this.game.cloud.status === 'error'); }
    else this.renderAccount();
  }

  renderAccount() {
    const box = this.root.querySelector('[data-account]');
    const cloud = this.game.cloud;
    if (!box || !cloud) return;
    if (!cloud.configured()) { box.innerHTML = `<p class="hint">${te('As contas ainda não foram ativadas neste site.')}</p>`; return; }
    // botões ocupados durante a conversa com o servidor; mensagem embaixo
    const run = async (fn, ok) => {
      const before = cloud.user;
      box.querySelectorAll('button').forEach(b => { b.disabled = true; });
      box.querySelector('[data-msg]').className = 'form-msg';
      box.querySelector('[data-msg]').textContent = t('Aguarde…');
      try {
        const r = await fn();
        if (ok) this.toast(typeof ok === 'function' ? ok(r) : ok, 3500);
        this.renderAccount();
      } catch (e) {
        // entrou mas a sincronização falhou (ou saiu): mostra a tela certa com o erro
        if (cloud.user !== before) this.renderAccount();
        box.querySelectorAll('button').forEach(b => { b.disabled = false; });
        const msg = box.querySelector('[data-msg]');
        msg.className = 'form-msg err';
        msg.textContent = cloudMessage(e);
      }
    };
    if (!cloud.user) {
      box.innerHTML = `
        <form class="account-form" data-login>
          <p class="hint">${te('Salve suas configurações e presets na conta e use em qualquer computador ou celular. Sem e-mail: só nome de usuário e senha.')}</p>
          <label>${te('Nome de usuário')}<input name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" required></label>
          <label>${te('Senha')}<input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
          <div class="bar-inline"><button type="submit" class="primary">${te('Entrar')}</button><button type="button" data-signup>${te('Criar conta')}</button></div>
          <p class="hint">${te('Guarde bem a senha: sem e-mail não dá para recuperar a conta.')}</p>
          <p class="form-msg" data-msg></p>
        </form>`;
      const form = box.querySelector('form');
      const vals = () => [form.username.value, form.password.value];
      form.addEventListener('submit', e => {
        e.preventDefault();
        run(() => cloud.signIn(...vals()), had => had ? t('Configurações da conta carregadas') : t('Conectado — configurações deste aparelho salvas na conta'));
      });
      box.querySelector('[data-signup]').addEventListener('click', () => {
        form.password.autocomplete = 'new-password';
        run(() => cloud.signUp(...vals()), t('Conta criada! Suas configurações agora ficam salvas nela.'));
      });
      return;
    }
    box.innerHTML = `
      <p>${t('Conectado como <b>{user}</b>', { user: esc(cloud.user) })}</p>
      <p class="hint" data-cloud-status></p>
      <p class="hint">${te('Configurações, presets, rates, controles e melhores voltas ficam salvos na conta. Os gráficos ficam em cada aparelho.')}</p>
      <div class="bar-inline"><button data-sync>${te('Sincronizar agora')}</button><button data-logout>${te('Sair da conta')}</button></div>
      <details class="account-more"><summary>${te('Trocar senha ou excluir conta')}</summary>
        <form class="bar-inline" data-pw><input type="password" name="password" autocomplete="new-password" minlength="6" required placeholder="${te('Nova senha')}"><button type="submit" class="small">${te('Trocar senha')}</button></form>
        <button class="small danger" data-delete>${te('Excluir conta')}</button>
      </details>
      <p class="form-msg" data-msg></p>`;
    this.renderAccountStatus();
    box.querySelector('[data-sync]').addEventListener('click', () => run(() => cloud.syncNow(), t('Sincronizado ✓')));
    box.querySelector('[data-logout]').addEventListener('click', () => { cloud.signOut(); this.toast(t('Você saiu da conta. As configurações continuam neste aparelho.'), 3500); this.renderAccount(); });
    const pw = box.querySelector('[data-pw]');
    pw.addEventListener('submit', e => { e.preventDefault(); run(() => cloud.changePassword(pw.password.value), t('Senha trocada')); });
    box.querySelector('[data-delete]').addEventListener('click', () => {
      if (!confirm(t('Excluir a conta "{user}" e tudo que está salvo nela? Não dá para desfazer.', { user: cloud.user }))) return;
      run(() => cloud.deleteAccount(), t('Conta excluída'));
    });
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
      if (grp.title) sec.innerHTML = `<h3>${te(grp.title)}</h3>`;
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
    const help = f.help ? `<i class="help-i" title="${te(f.help)}">?</i>` : '';
    const reload = f.reload ? '<em class="reload-tag">↻</em>' : '';
    let control = '';
    if (f.type === 'range') control = `<input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">`;
    else if (f.type === 'select') control = `<select>${Object.entries(f.options).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${te(l)}</option>`).join('')}</select>`;
    else if (f.type === 'toggle') control = `<input type="checkbox" ${v ? 'checked' : ''}>`;
    row.innerHTML = `<label class="lbl">${te(f.label)} ${help}${reload}</label><div class="ctl">${control}<span class="val"></span></div>`;
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
    const rerender = path === '*' || path === 'presets' || /preset$|layout$|rates\.type|input\.(throttle|yaw|pitch|roll|buttons|calib)/.test(path) || path === 'input' || path === 'graphics' || path === 'drone';
    if (rerender) this.renderSettings();
    if (path.startsWith('rates')) this.drawRates?.();
    this.updateReloadBar();
  }

  updateReloadBar() {
    const bar = this.root.querySelector('.reload-bar');
    bar.hidden = !this.pendingReload;
    if (this.pendingReload) bar.querySelector('span').textContent = this.pendingReload === 'page'
      ? t('Anti-aliasing só muda reiniciando o jogo.')
      : t('Algumas mudanças gráficas precisam recarregar o cenário.');
  }

  resetTab() {
    const map = { controls: ['input'], rates: ['rates'], physics: ['drone', 'world', 'battery'], fc: ['fc'], camera: ['camera'], graphics: ['graphics'], game: ['audio'], presets: [] };
    for (const s of map[this.tab] || []) this.settings.resetSection(s);
    if (this.tab === 'graphics') this.pendingReload = 'scene';
    this.renderSettings();
    this.toast(t('Padrões restaurados'));
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
        + [6, 7].map(i => `<option value="button:${i}" ${m.type === 'button' && m.index === i ? 'selected' : ''}>${te('Gatilho {b}', { b: buttonName(fam, i) })}</option>`).join('');
      row.innerHTML = `<label class="lbl">${CHANNEL_NAMES[ch]}</label>
        <div class="ctl"><select>${opts}</select>
        <label class="inv"><input type="checkbox" ${m.invert ? 'checked' : ''}> ${te('inverter')}</label>
        <div class="meter"><div></div></div>
        <button class="small" data-detect>${te('Detectar')}</button></div>`;
      const [sel, inv] = [row.querySelector('select'), row.querySelector('input')];
      const update = () => {
        const [type, idx] = sel.value.split(':');
        this.settings.set('input.' + ch, { type, index: Number(idx), invert: inv.checked });
      };
      sel.addEventListener('change', update);
      inv.addEventListener('change', update);
      row.querySelector('[data-detect]').addEventListener('click', () => {
        const gp = this.game.input.findGamepad();
        if (!gp) return this.toast(t('Conecte o controle e aperte um botão primeiro'));
        this.detect = { channel: ch, base: [...gp.axes], btnBase: gp.buttons.map(b => b.value) };
        this.toast(t(ch === 'throttle' || ch === 'pitch' ? 'Mova o stick de {ch} para CIMA…' : 'Mova o stick de {ch} para a DIREITA…', { ch: CHANNEL_NAMES[ch] }), 4000);
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
      row.innerHTML = `<label class="lbl">${te(name)}</label><div class="ctl"><span class="btn-chip">${esc(bindingName(fam, b[act]))}</span><button class="small" data-set>${te('Mudar')}</button><button class="small" data-clear title="${te('Sem botão')}">×</button></div>`;
      row.querySelector('[data-set]').addEventListener('click', () => {
        const gp = this.game.input.findGamepad();
        if (!gp) return this.toast(t('Conecte o controle e aperte um botão primeiro'));
        this.remap = { action: act, base: [...gp.axes] };
        row.querySelector('.btn-chip').textContent = t('aperte…');
        this.toast(t('Aperte o botão (ou mude a chave do rádio) para "{name}"', { name: t(name) }), 4000);
      });
      row.querySelector('[data-clear]').addEventListener('click', () => {
        this.settings.set('input.buttons.' + act, -1);
        this.renderSettings();
      });
      sec.appendChild(row);
    }
  }

  /** Velocidade máxima direta: o jogo ajusta o passo da hélice (e, se preciso, o arrasto). */
  custom_speedControl(sec) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="row"><label class="lbl">${te('Velocidade máxima')} <i class="help-i" title="${te('Escolha a velocidade final e o jogo ajusta o passo da hélice (e, acima de certo ponto, o arrasto) para o drone chegar perto disso voando nivelado com throttle cheio e bateria cheia. Mergulhando ele passa disso; com a bateria acabando, fica abaixo.')}">?</i></label>
        <div class="ctl"><input type="range" min="20" max="300" step="5"><span class="val"></span></div></div>
      <p class="hint" data-perf></p>`;
    const input = div.querySelector('input'), val = div.querySelector('.val'), info = div.querySelector('[data-perf]');
    let dragging = false, sig = '';
    const refresh = () => {
      const d = this.settings.data.drone, w = { ...this.settings.data.world, batterySim: this.settings.data.battery.simulate };
      const key = JSON.stringify([d, w.airDensity, w.gravity, w.batterySim]);
      if (key === sig || dragging) return;
      sig = key;
      const v = estimateTopSpeed(d, w) * 3.6;
      input.value = Math.round(v / 5) * 5;
      val.textContent = `${Math.round(v)} km/h`;
      const hov = hoverThrottle(d, w.gravity, this.settings.data.fc.motorIdle);
      info.textContent = t('Empuxo/peso {tw}:1 · paira com {hov} · passo da hélice {pitch} m/s', {
        tw: thrustToWeight(d, w.gravity).toFixed(1),
        hov: hov == null ? t('— (não decola!)') : t('{p}% de throttle', { p: Math.round(hov * 100) }),
        pitch: Math.round(d.propPitchSpeed),
      });
    };
    input.addEventListener('input', () => { dragging = true; val.textContent = `${input.value} km/h`; });
    input.addEventListener('change', () => {
      dragging = false;
      const d = this.settings.data.drone, w = { ...this.settings.data.world, batterySim: this.settings.data.battery.simulate };
      const r = tuneTopSpeed(d, w, Number(input.value) / 3.6);
      if (r.dragMul < 1) {
        for (const k of ['cdaFront', 'cdaTop', 'cdaSide', 'rotorDrag']) this.settings.set('drone.' + k, d[k] * r.dragMul, { silent: true });
      }
      this.settings.set('drone.propPitchSpeed', Math.round(r.pitchSpeed * 10) / 10);
      if (!r.reached) this.toast(t('Para passar de {v} km/h, aumente a Potência', { v: Math.round(estimateTopSpeed(this.settings.data.drone, w) * 3.6) }), 4000);
      sig = '';
      this.renderSettings();
    });
    this.live.push(refresh);
    refresh();
    sec.appendChild(div);
  }

  custom_hapticsTest(sec) {
    const div = document.createElement('div');
    div.className = 'bar-inline';
    div.innerHTML = `<button class="small" data-test>${te('Testar vibração')}</button><span class="hint" data-hstatus></span>`;
    const status = div.querySelector('[data-hstatus]');
    div.querySelector('[data-test]').addEventListener('click', () => {
      const ok = this.game.haptics.play(1, 1, 450, { triggers: 1, force: true });
      if (!ok) this.toast(t('Este controle/navegador não aceita vibração'));
    });
    this.live.push(() => {
      const gp = this.game.input.gamepad;
      const kind = hapticsSupport(gp);
      const txt = !gp ? t('Nenhum controle conectado.') : kind ? t('Suporte: {kind}.', { kind: t(HAPTICS_LABEL[kind]) }) : t('Este controle/navegador não informa suporte a vibração (rádios FPV não vibram; no Firefox costuma vir desligado).');
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
      <div class="row"><label class="lbl">${te('Controle usado')}</label><div class="ctl"><select data-pad-sel>
        <option value="-1">${te('Automático (o último que você mexer)')}</option>
        ${pads.map(p => `<option value="${p.index}" ${want === p.index ? 'selected' : ''}>${esc(p.id.slice(0, 60))}</option>`).join('')}
      </select></div></div>
      <p class="hint" data-pad-info></p>
      <div class="axes"></div><div class="btns"></div>
      <div class="bar-inline"><button class="small" data-cal>${te('Calibrar sticks')}</button><button class="small" data-cal-reset>${te('Zerar calibração')}</button></div>
      <p class="hint" data-cal-msg></p>`;
    div.querySelector('[data-pad-sel]').addEventListener('change', e => this.settings.set('input.gamepadIndex', Number(e.target.value)));
    div.querySelector('[data-cal]').addEventListener('click', () => {
      if (!this.game.input.findGamepad()) return this.toast(t('Conecte o controle primeiro'));
      this.calib = { phase: 'range', t: 0, min: [1, 1, 1, 1], max: [-1, -1, -1, -1], center: [0, 0, 0, 0], n: 0 };
    });
    div.querySelector('[data-cal-reset]').addEventListener('click', () => {
      this.settings.set('input.calib', {});
      this.toast(t('Calibração zerada'));
    });
    const axesEl = div.querySelector('.axes'), btnsEl = div.querySelector('.btns'), info = div.querySelector('[data-pad-info]'), calMsg = div.querySelector('[data-cal-msg]');
    let built = 0;
    this.live.push(() => {
      const gp = this.game.input.findGamepad();
      if (!gp) { info.textContent = t('Nenhum controle detectado. Conecte via USB e aperte qualquer botão.'); return; }
      const pi = this.game.input.padInfo;
      const txt = `${pi?.model || t('Controle')} · ${gp.mapping === 'standard' ? t('mapeamento padrão') : t('mapeamento próprio — confira os canais com "Detectar"')} · ${gp.id}`;
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
          calMsg.textContent = t('Gire os DOIS sticks em círculos, até o limite, por 4 segundos…');
          for (let i = 0; i < 4; i++) { c.min[i] = Math.min(c.min[i], gp.axes[i] ?? 0); c.max[i] = Math.max(c.max[i], gp.axes[i] ?? 0); }
          if (c.t > 4) { c.phase = 'center'; c.t = 0; }
        } else {
          calMsg.textContent = t('Agora SOLTE os sticks…');
          if (c.t > 1) { for (let i = 0; i < 4; i++) c.center[i] += gp.axes[i] ?? 0; c.n++; }
          if (c.t > 2.2) {
            const cal = {};
            for (let i = 0; i < 4; i++) {
              const ctr = c.n ? c.center[i] / c.n : 0;
              cal[i] = [Math.min(c.min[i], -0.5), Math.abs(ctr) < 0.25 ? ctr : 0, Math.max(c.max[i], 0.5)];
            }
            this.settings.set('input.calib', cal);
            this.calib = null;
            calMsg.textContent = t('Calibração salva ✓');
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
      g.fillText(t('°/s vs. deflexão do stick'), 8, 16);
      maxEl.innerHTML = axes.map(([a, col], i) => `<span style="color:${col}">${te('{axis} máx {v}°/s', { axis: a, v: Math.round(maxes[i]) })}</span>`).join(' · ');
    };
    requestAnimationFrame(() => this.drawRates());
  }

  custom_userPresets(sec) {
    const list = this.settings.data.presets || [];
    const cloud = this.game.cloud;
    const div = document.createElement('div');
    div.className = 'presets';
    const where = cloud?.user ? t('Ficam salvos na sua conta ({user}).', { user: cloud.user })
      : cloud?.configured() ? t('Ficam salvos neste navegador. Entre numa conta (menu principal) para levar para outros aparelhos.')
        : t('Ficam salvos neste navegador.');
    div.innerHTML = `
      <p class="hint">${te('Um preset guarda o drone (física e bateria), os rates, a controladora (PIDs e modo de voo) e a câmera. {where}', { where })}</p>
      <form class="bar-inline" data-new><input type="text" name="name" maxlength="40" required placeholder="${te('Nome (ex.: meu 5 polegadas)')}"><button class="small primary" type="submit">${te('Salvar configuração atual')}</button></form>
      ${list.length ? list.map((p, i) => `
        <div class="row"><label class="lbl">${esc(p.name)} <span class="hint">${esc(new Date(p.savedAt).toLocaleDateString(getLang() === 'en' ? 'en' : 'pt-BR'))}</span></label>
          <div class="ctl"><button class="small" data-load="${i}">${te('Carregar')}</button><button class="small danger" data-del="${i}">${te('Excluir')}</button></div></div>`).join('')
        : `<p class="hint">${te('Nenhum preset salvo ainda.')}</p>`}`;
    const form = div.querySelector('[data-new]');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      const existed = list.some(p => p.name === name);
      this.settings.savePreset(name);
      this.toast(existed ? t('Preset "{name}" atualizado', { name }) : t('Preset "{name}" salvo', { name }));
    });
    for (const b of div.querySelectorAll('[data-load]')) b.addEventListener('click', () => {
      const p = list[Number(b.dataset.load)];
      if (this.settings.loadPreset(p.name)) this.toast(t('Preset "{name}" carregado', { name: p.name }));
    });
    for (const b of div.querySelectorAll('[data-del]')) b.addEventListener('click', () => {
      const p = list[Number(b.dataset.del)];
      if (confirm(t('Excluir o preset "{name}"?', { name: p.name }))) this.settings.deletePreset(p.name);
    });
    sec.appendChild(div);
  }

  custom_dataTools(sec) {
    const div = document.createElement('div');
    div.className = 'data-tools';
    div.innerHTML = `
      <div class="bar-inline"><button class="small" data-exp>${te('Exportar configurações (.json)')}</button>
      <button class="small" data-imp>${te('Importar do texto abaixo')}</button>
      <button class="small danger" data-all>${te('Restaurar TUDO')}</button></div>
      <textarea rows="4" placeholder="${te('Cole aqui um JSON de configurações para importar')}"></textarea>`;
    div.querySelector('[data-exp]').addEventListener('click', () => {
      const blob = new Blob([this.settings.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'diveprop-config.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    div.querySelector('[data-imp]').addEventListener('click', () => {
      try { this.settings.importJSON(div.querySelector('textarea').value); this.toast(t('Configurações importadas')); this.pendingReload = 'scene'; this.renderSettings(); }
      catch { this.toast(t('JSON inválido')); }
    });
    div.querySelector('[data-all]').addEventListener('click', () => {
      if (!confirm(t('Restaurar todas as configurações para o padrão?'))) return;
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
        this.toast(`${CHANNEL_NAMES[d.channel]} → ${axisName(this.family(), best)}${bestV < 0 ? t(' (invertido)') : ''}`);
        this.detect = null;
      } else {
        for (const i of [6, 7]) {
          if ((gp.buttons[i]?.value ?? 0) - (d.btnBase[i] ?? 0) > 0.6) {
            this.settings.set('input.' + d.channel, { type: 'button', index: i, invert: false });
            this.toast(`${CHANNEL_NAMES[d.channel]} → ${t('gatilho {b}', { b: buttonName(this.family(), i) })}`);
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
        this.toast(`${t(ACTION_NAMES[this.remap.action])} → ${bindingName(this.family(), b)}`);
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
