// Lista os textos em português que precisam de tradução e confere o dicionário inglês.
// Uso: node scripts/i18n-keys.mjs        → mostra as chaves que faltam em src/i18n-en.js
//      node scripts/i18n-keys.mjs --all  → mostra todas as chaves
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const keys = new Set();
const add = s => { if (s && /[A-Za-zÀ-ú]/.test(s)) keys.add(s); };
const unq = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

// 1) chamadas t('…') / te('…') no código
const files = ['src', 'src/scenes'].flatMap(d => readdirSync(d).filter(f => f.endsWith('.js')).map(f => join(d, f)));
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bte?\(\s*'((?:[^'\\]|\\.)*)'/g)) add(unq(m[1]));
  // t(cond ? '…' : '…')
  for (const m of src.matchAll(/\bte?\(\s*[^()]*?\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)) { add(unq(m[1])); add(unq(m[2])); }
}
// 2) textos que viram t() na hora de mostrar: schema, presets, cenários, nomes de ações
globalThis.navigator ??= { language: 'pt-BR' };
const S = await import('../src/settings.js');
for (const tab of S.SCHEMA) {
  add(tab.tab);
  for (const g of tab.groups) {
    add(g.title);
    for (const f of g.fields || []) { add(f.label); add(f.help); for (const o of Object.values(f.options || {})) add(String(o)); }
  }
}
const lit = (file, re) => { for (const m of readFileSync(file, 'utf8').matchAll(re)) add(unq(m[1])); };
lit('src/scenes/index.js', /(?:name|desc|tag): '((?:[^'\\]|\\.)*)'/g);
lit('src/ui.js', /const SPEED_HELP = '((?:[^'\\]|\\.)*)'/g);
const block = (file, start) => { const src = readFileSync(file, 'utf8'); const i = src.indexOf(start); return src.slice(i, src.indexOf('};', i)); };
for (const [file, start] of [['src/ui.js', 'const ACTION_NAMES'], ['src/ui.js', 'const HAPTICS_LABEL'], ['src/main.js', 'const CAM_LABEL'], ['src/controllers.js', 'const SONY_MODELS'], ['src/cloud.js', 'const map = {']]) {
  for (const m of block(file, start).matchAll(/: '((?:[^'\\]|\\.)*)'/g)) add(unq(m[1]));
}
for (const m of readFileSync('src/controllers.js', 'utf8').matchAll(/'(Stick (?:esq|dir)\. [XY])'/g)) add(m[1]);

const { default: EN } = await import('../src/i18n-en.js').catch(() => ({ default: {} }));
const all = process.argv.includes('--all');
const list = [...keys].filter(k => all || !(k in EN));
const extra = Object.keys(EN).filter(k => !keys.has(k));
console.log(JSON.stringify(list, null, 1));
console.error(`${keys.size} chaves · ${list.length} ${all ? 'listadas' : 'sem tradução'} · ${extra.length} sobrando no dicionário`);
if (extra.length) console.error('sobrando:', extra);
