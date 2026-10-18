// Contas: login só com nome de usuário e senha (sem e-mail, sem confirmação) que guarda as
// configurações e os presets na nuvem e os traz de volta em qualquer aparelho.
//
// Usa o Firebase (Authentication + Firestore, plano grátis) pela API REST. O Firebase só aceita
// login por e-mail, então o nome de usuário vira um endereço que não existe: "joao" →
// joao@diveprop.example.com. O domínio example.com é reservado e nunca recebe e-mail, então
// ninguém consegue pedir "esqueci a senha" de uma conta alheia.
// "Continuar com Google" usa o SDK do Firebase só para abrir a janela do Google (carregado
// quando a tela de conta abre); dali em diante a sessão segue pela mesma API REST.
//
// Sincronização: tudo menos os gráficos (cada aparelho tem o seu) e os controles de toque.
// Ao entrar, a nuvem manda; depois, cada mudança sobe sozinha alguns segundos depois.
import CONFIG from './cloud-config.js';
import { t } from './i18n.js';

const STORE = 'fpvsim.account.v1'; // nome antigo do jogo, mantido para não perder sessões
const USER_RE = /^[a-z0-9_.-]{3,20}$/;
const EMAIL_DOMAIN = 'diveprop.example.com';

export class CloudError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** Código de um erro qualquer: do Firebase/nosso, ou o tipo e o texto de um erro de JavaScript. */
function errorCode(e) {
  if (e?.code) return e.code;
  const text = String(e?.message || e || '');
  // página aberta antes de uma atualização do site: o pedaço do jogo com o login não existe mais
  if (/dynamically imported module|Importing a module script failed|error loading dynamically|Load failed/i.test(text)) return 'LOAD_FAILED';
  return `${e?.name || 'Error'}: ${text}`.slice(0, 120);
}

/** Mensagem para o jogador a partir do código de erro do Firebase (ou nosso). */
export function cloudMessage(e) {
  const code = errorCode(e);
  const map = {
    BAD_USERNAME: 'Nome de usuário: 3 a 20 letras, números, ponto, hífen ou _ (sem espaços nem acentos).',
    BAD_PASSWORD: 'A senha precisa ter pelo menos 6 caracteres.',
    EMAIL_EXISTS: 'Esse nome de usuário já existe. Escolha outro ou entre com a senha.',
    INVALID_LOGIN_CREDENTIALS: 'Usuário ou senha incorretos.',
    INVALID_PASSWORD: 'Usuário ou senha incorretos.',
    EMAIL_NOT_FOUND: 'Usuário ou senha incorretos.',
    WEAK_PASSWORD: 'A senha precisa ter pelo menos 6 caracteres.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    USER_DISABLED: 'Esta conta foi desativada.',
    OPERATION_NOT_ALLOWED: 'O login com senha não está ativado no Firebase (Authentication → E-mail/senha).',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Por segurança, saia e entre de novo antes de fazer isso.',
    SESSION_EXPIRED: 'Sua sessão expirou. Entre de novo.',
    PERMISSION_DENIED: 'O servidor recusou o acesso (confira as regras do Firestore).',
    NETWORK: 'Sem conexão com o servidor. Confira a internet.',
    LOAD_FAILED: 'Não deu para carregar o login do Google. Recarregue a página e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com o servidor. Confira a internet.',
    'auth/popup-closed-by-user': 'Login com Google cancelado.',
    'auth/cancelled-popup-request': 'Login com Google cancelado.',
    'auth/user-cancelled': 'Login com Google cancelado.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.',
    'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).',
    'auth/operation-not-allowed': 'O login com Google não está ativado no Firebase.',
    'auth/disallowed-useragent': 'O Google não deixa entrar por dentro de apps (Instagram, Facebook…). Abra o link no navegador.',
    'auth/web-storage-unsupported': 'Este navegador bloqueia o login com Google (cookies ou armazenamento desligados).',
    UNKNOWN: 'Erro inesperado ({code}).',
  };
  return t(map[code] || map.UNKNOWN, { code });
}

const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return h >>> 0; };

async function request(url, { method = 'POST', json, form, token } = {}) {
  const headers = {};
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(url, { method, headers, body }); } catch { throw new CloudError('NETWORK'); }
  if (res.status === 404 && method === 'GET') return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Auth: { error: { message: "WEAK_PASSWORD : Password should be…" } } · Firestore: { error: { status: "PERMISSION_DENIED" } }
    const raw = data?.error?.message || '';
    const code = /^[A-Z][A-Z_]+(\s|$)/.test(raw) ? raw.split(' ')[0] : (data?.error?.status || `HTTP_${res.status}`);
    throw new CloudError(code === 'INVALID_ID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'USER_NOT_FOUND' ? 'SESSION_EXPIRED' : code);
  }
  return data;
}

/** Firebase Authentication + Firestore pela API REST. */
class FirebaseBackend {
  constructor({ apiKey, projectId }) { this.key = apiKey; this.project = projectId; }

  auth(path, json) { return request(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${this.key}`, { json }); }

  static session(r, username) {
    return { uid: r.localId || r.user_id, username, idToken: r.idToken || r.id_token, refreshToken: r.refreshToken || r.refresh_token,
      expiresAt: Date.now() + (Number(r.expiresIn || r.expires_in) || 3600) * 1000 - 60000 };
  }

  async signUp(username, password) {
    return FirebaseBackend.session(await this.auth('signUp', { email: `${username}@${EMAIL_DOMAIN}`, password, returnSecureToken: true }), username);
  }

  async signIn(username, password) {
    return FirebaseBackend.session(await this.auth('signInWithPassword', { email: `${username}@${EMAIL_DOMAIN}`, password, returnSecureToken: true }), username);
  }

  async refresh(s) {
    const r = await request(`https://securetoken.googleapis.com/v1/token?key=${this.key}`, { form: { grant_type: 'refresh_token', refresh_token: s.refreshToken } });
    return { ...s, ...FirebaseBackend.session(r, s.username) };
  }

  async changePassword(s, password) {
    return { ...s, ...FirebaseBackend.session(await this.auth('update', { idToken: s.idToken, password, returnSecureToken: true }), s.username) };
  }

  deleteUser(s) { return this.auth('delete', { idToken: s.idToken }); }

  /** Carrega o SDK e prepara a janela do Google antes do clique (o Safari bloqueia pop-up atrasado). */
  prepareGoogle() {
    this.google ??= Promise.all([import('@firebase/app'), import('@firebase/auth')]).then(([F, A]) => {
      const app = F.getApps()[0] || F.initializeApp({ apiKey: this.key, projectId: this.project, authDomain: `${this.project}.firebaseapp.com` });
      // sem sessão própria do SDK: quem guarda a sessão é o Cloud (localStorage + REST)
      const auth = A.initializeAuth(app, { persistence: A.inMemoryPersistence, popupRedirectResolver: A.browserPopupRedirectResolver });
      return { A, auth };
    });
    this.google.catch(() => { this.google = null; });
    return this.google;
  }

  async googleSignIn() {
    let A, auth, cred;
    try { ({ A, auth } = await this.prepareGoogle()); } catch { throw new CloudError('LOAD_FAILED'); }
    try { cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider()); }
    catch (e) { console.error('[DiveProp] login com Google:', e); throw new CloudError(errorCode(e)); }
    const u = cred.user, r = await u.getIdTokenResult();
    const session = {
      uid: u.uid, provider: 'google', username: (u.displayName || u.email?.split('@')[0] || 'Google').slice(0, 20),
      idToken: r.token, refreshToken: u.refreshToken, expiresAt: Date.parse(r.expirationTime) - 60000,
    };
    await A.signOut(auth); // só limpa o SDK; a sessão continua valendo pelo refresh token
    return session;
  }

  doc(s) { return `https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents/users/${s.uid}`; }

  async getDoc(s) {
    const d = await request(this.doc(s), { method: 'GET', token: s.idToken });
    return d && { data: d.fields?.settings?.stringValue || '', updateTime: d.updateTime };
  }

  async putDoc(s, data) {
    const d = await request(this.doc(s), { method: 'PATCH', token: s.idToken, json: { fields: { username: { stringValue: s.username }, settings: { stringValue: data } } } });
    return d.updateTime;
  }

  deleteDoc(s) { return request(this.doc(s), { method: 'DELETE', token: s.idToken }); }
}

/** Servidor de mentira guardado no localStorage, para testar sem Firebase (?cloud=mock no `npm run dev`). */
class MockBackend {
  db() { try { return JSON.parse(localStorage.getItem('diveprop.mockserver') || '{"users":{},"docs":{}}'); } catch { return { users: {}, docs: {} }; } }
  put(db) { localStorage.setItem('diveprop.mockserver', JSON.stringify(db)); }
  async wait() { await new Promise(r => setTimeout(r, 120)); }
  session(username, uid) { return { uid, username, idToken: 'mock-' + uid, refreshToken: 'mock-r-' + uid, expiresAt: Date.now() + 3600e3 }; }
  async signUp(u, p) {
    await this.wait(); const db = this.db();
    if (db.users[u]) throw new CloudError('EMAIL_EXISTS');
    db.users[u] = { pass: hash(p + u), uid: 'u' + Date.now().toString(36) }; this.put(db);
    return this.session(u, db.users[u].uid);
  }
  async signIn(u, p) {
    await this.wait(); const rec = this.db().users[u];
    if (!rec || rec.pass !== hash(p + u)) throw new CloudError('INVALID_LOGIN_CREDENTIALS');
    return this.session(u, rec.uid);
  }
  async prepareGoogle() {}
  async googleSignIn() {
    await this.wait(); const db = this.db();
    db.users['google:teste'] ??= { pass: 0, uid: 'g' + Date.now().toString(36) }; this.put(db);
    return { ...this.session('Piloto Google', db.users['google:teste'].uid), provider: 'google' };
  }
  async refresh(s) { await this.wait(); if (!Object.values(this.db().users).some(r => r.uid === s.uid)) throw new CloudError('SESSION_EXPIRED'); return { ...s, expiresAt: Date.now() + 3600e3 }; }
  async changePassword(s, p) { await this.wait(); const db = this.db(); db.users[s.username].pass = hash(p + s.username); this.put(db); return s; }
  async deleteUser(s) { await this.wait(); const db = this.db(); delete db.users[s.username]; this.put(db); }
  async getDoc(s) { await this.wait(); return this.db().docs[s.uid] || null; }
  async putDoc(s, data) { await this.wait(); const db = this.db(); const updateTime = new Date().toISOString(); db.docs[s.uid] = { data, updateTime }; this.put(db); return updateTime; }
  async deleteDoc(s) { await this.wait(); const db = this.db(); delete db.docs[s.uid]; this.put(db); }
}

export class Cloud {
  constructor(settings) {
    this.settings = settings;
    const mock = (import.meta.env.DEV || import.meta.env.VITE_DEVBRIDGE) && /[?&]cloud=mock/.test(location.search);
    this.backend = mock ? new MockBackend() : CONFIG.apiKey && CONFIG.projectId ? new FirebaseBackend(CONFIG) : null;
    this.session = null;
    try { this.session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { /* sem sessão */ }
    this.status = this.session ? 'saved' : 'idle'; // idle · syncing · saved · error
    this.error = '';
    this.savedAt = null;
    this.listeners = new Set();
    this.timer = null;
    settings.onSaved = () => this.schedule();
  }

  configured() { return !!this.backend; }
  get user() { return this.session?.username || null; }
  onChange(fn) { this.listeners.add(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  persist() {
    if (!this.session) { localStorage.removeItem(STORE); return; }
    const { uid, username, provider, refreshToken, idToken, expiresAt, updateTime, hash: h } = this.session;
    try { localStorage.setItem(STORE, JSON.stringify({ uid, username, provider, refreshToken, idToken, expiresAt, updateTime, hash: h })); } catch { /* modo privado */ }
  }

  /** Sessão com token válido (renova o token de 1 hora quando precisa). */
  async live() {
    if (!this.session) throw new CloudError('SESSION_EXPIRED');
    if (!this.session.idToken || Date.now() > this.session.expiresAt) {
      try { this.session = await this.backend.refresh(this.session); }
      catch (e) { if (e.code === 'SESSION_EXPIRED') this.signOut(); throw e; }
      this.persist();
    }
    return this.session;
  }

  /** Chamada ao servidor com token; se o token venceu no meio do caminho, renova e repete. */
  async call(fn) {
    try { return await fn(await this.live()); }
    catch (e) {
      if (e.code !== 'UNAUTHENTICATED' || !this.session) throw e;
      this.session.idToken = null;
      return fn(await this.live());
    }
  }

  static clean(username, password) {
    const u = String(username || '').trim().toLowerCase();
    if (!USER_RE.test(u)) throw new CloudError('BAD_USERNAME');
    if (password != null && String(password).length < 6) throw new CloudError('BAD_PASSWORD');
    return u;
  }

  async signUp(username, password) {
    const u = Cloud.clean(username, password);
    this.session = await this.backend.signUp(u, password);
    this.persist();
    await this.push(true); // conta nova começa com as configurações deste aparelho
  }

  async signIn(username, password) {
    const u = Cloud.clean(username, password);
    this.session = await this.backend.signIn(u, password);
    this.persist();
    const had = await this.pull(false);
    if (!had) await this.push(true);
    return had;
  }

  /** Deixa a janela do Google pronta (chamado quando a tela de conta abre). */
  prepareGoogle() { this.backend?.prepareGoogle?.().catch(() => {}); }

  async signInWithGoogle() {
    this.session = await this.backend.googleSignIn();
    this.persist();
    const had = await this.pull(false);
    if (!had) await this.push(true);
    return had;
  }

  get google() { return this.session?.provider === 'google'; }

  /** Ao abrir o jogo com sessão salva: traz da nuvem o que mudou em outro aparelho. */
  async start() {
    if (!this.session || !this.backend) return;
    try { await this.pull(true); } catch (e) { this.fail(e); }
  }

  /** Baixa da nuvem e aplica. Devolve false se a conta ainda não tem nada salvo. */
  async pull(startup) {
    const doc = await this.call(s => this.backend.getDoc(s));
    const s = this.session;
    if (!doc || !doc.data) return false;
    if (startup && doc.updateTime === s.updateTime) {
      // a nuvem não mudou desde o último envio daqui: só sobe o que mudou offline
      this.schedule(500);
    } else {
      this.settings.applySynced(JSON.parse(doc.data));
      s.updateTime = doc.updateTime;
      s.hash = hash(JSON.stringify(this.settings.syncData()));
    }
    this.persist();
    this.status = 'saved'; this.error = ''; this.savedAt = Date.parse(doc.updateTime) || Date.now();
    this.emit();
    return true;
  }

  schedule(ms = 2500) {
    if (!this.session || !this.backend) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push().catch(e => this.fail(e)), ms);
  }

  /** Sobe as configurações (só se mudaram desde o último envio, a menos que force). */
  async push(force = false) {
    if (!this.session) return;
    const data = JSON.stringify(this.settings.syncData());
    const h = hash(data);
    if (!force && h === this.session.hash) return;
    this.status = 'syncing'; this.emit();
    const time = await this.call(s => this.backend.putDoc(s, data));
    const s = this.session;
    s.updateTime = time;
    s.hash = h;
    this.persist();
    this.status = 'saved'; this.error = ''; this.savedAt = Date.now();
    this.emit();
  }

  async syncNow() {
    try { const had = await this.pull(false); if (!had) await this.push(true); }
    catch (e) { this.fail(e); throw e; }
  }

  fail(e) {
    this.status = this.session ? 'error' : 'idle';
    this.error = cloudMessage(e);
    this.emit();
  }

  async changePassword(password) {
    if (String(password || '').length < 6) throw new CloudError('BAD_PASSWORD');
    this.session = await this.call(s => this.backend.changePassword(s, password));
    this.persist();
  }

  async deleteAccount() {
    await this.call(s => this.backend.deleteDoc(s));
    await this.call(s => this.backend.deleteUser(s));
    this.signOut();
  }

  /** Sai da conta; as configurações continuam neste aparelho. */
  signOut() {
    clearTimeout(this.timer);
    this.session = null;
    this.persist();
    this.status = 'idle'; this.error = '';
    this.emit();
  }
}
