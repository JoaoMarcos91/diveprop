// Idiomas. O texto em português escrito no código é a própria chave: t('Voar') devolve
// "Fly" em inglês. Partes variáveis vão como {nome}: t('Volta {t}', { t: '0:42.10' }).
import EN from './i18n-en.js';

export const LANGS = { pt: 'Português', en: 'English' };

let lang = 'pt';
const missing = new Set(); // chaves sem tradução (o canal de testes lista)

/** Português para quem usa o navegador em português; inglês para o resto do mundo. */
export function detectLang() {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  return /^pt\b/i.test(list[0] || '') ? 'pt' : 'en';
}

/** 'auto' | 'pt' | 'en' → idioma efetivo. */
export function resolveLang(pref) { return pref === 'pt' || pref === 'en' ? pref : detectLang(); }

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'pt';
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.title = lang === 'en' ? 'DiveProp — free FPV drone simulator in your browser' : 'DiveProp — simulador de drone FPV grátis no navegador';
  document.getElementById('fs')?.setAttribute('title', lang === 'en' ? 'Fullscreen' : 'Tela cheia');
}

export function getLang() { return lang; }

export function t(s, vars) {
  if (s == null || !/[A-Za-zÀ-ú]/.test(s)) return s; // números e símbolos ("60", "2×") não traduzem
  let out = s;
  if (lang === 'en') {
    out = EN[s];
    if (out == null) { missing.add(s); out = s; }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : out;
}

export function missingKeys() { return [...missing]; }
