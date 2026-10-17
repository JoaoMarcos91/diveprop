// Identificação do controle (família / modelo), nomes de botões e suporte a vibração.
//
// Os navegadores entregam o nome do controle em formatos diferentes:
//   Chrome/Edge: "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)"
//   Firefox:     "054c-09cc-Wireless Controller"
//   Safari:      "DualSense Wireless Controller" (sem ids de fabricante)
// Por isso identificamos pelos ids USB quando existem e, senão, pelo nome.

const RADIO_RE = /radiomaster|edgetx|opentx|frsky|taranis|horus|jumper|t-?lite|t-?pro|t-?12|t-?16|tx1[26]|zorro|boxer|pocket|mambo|tango|tbs|betafpv|literadio|flysky|spektrum|futaba|ethos|joystick|simulator|fms|interlink|realflight|deviation/i;

const SONY_MODELS = {
  '0268': 'DualShock 3 (PS3)',
  '05c4': 'DualShock 4 (PS4)',
  '09cc': 'DualShock 4 (PS4)',
  '0ba0': 'DualShock 4 (PS4, adaptador sem fio)',
  '0ce6': 'DualSense (PS5)',
  '0df2': 'DualSense Edge (PS5)',
};

// Rótulos dos botões no mapeamento "standard" da Gamepad API (índices 0..17).
const LABELS = {
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS', 'Touchpad'],
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Xbox', 'Share'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home', 'Capture'],
};

export function parseIds(id = '') {
  let m = id.match(/Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i);
  if (m) return { vendor: m[1].toLowerCase(), product: m[2].toLowerCase() };
  m = id.match(/^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i);
  if (m) return { vendor: m[1].toLowerCase().padStart(4, '0'), product: m[2].toLowerCase().padStart(4, '0') };
  return { vendor: '', product: '' };
}

/** { family: 'playstation'|'xbox'|'nintendo'|'radio'|'generic', model, standard, vendor, product } */
export function identify(gp) {
  if (!gp) return null;
  const id = gp.id || '';
  const { vendor, product } = parseIds(id);
  const standard = gp.mapping === 'standard';
  const base = { standard, vendor, product };
  const isRadioId = (vendor === '1209' && product === '4f54') || (vendor === '0483' && product === '5710');
  if (isRadioId || (!standard && RADIO_RE.test(id)) || /edgetx|opentx|radiomaster|frsky|jumper/i.test(id)) {
    const name = (id.match(/radiomaster[^()]*|edgetx[^()]*|opentx[^()]*|frsky[^()]*|jumper[^()]*|tbs[^()]*|betafpv[^()]*/i) || [''])[0].trim();
    return { ...base, family: 'radio', model: name ? `Rádio ${name}` : 'Rádio FPV (modo joystick USB)' };
  }
  // Xbox e Switch antes da Sony: "Xbox Wireless Controller" também contém "Wireless Controller"
  if (vendor === '045e' || /xbox|xinput|x-box/i.test(id)) return { ...base, family: 'xbox', model: 'Controle Xbox' };
  if (vendor === '057e' || /pro controller|joy-?con|nintendo|switch/i.test(id)) return { ...base, family: 'nintendo', model: 'Nintendo Switch Pro' };
  if (vendor === '054c' || /dualsense|dualshock|playstation|ps[345]|wireless controller/i.test(id)) {
    let model = SONY_MODELS[product];
    if (!model) model = /dualsense|ps5/i.test(id) ? 'DualSense (PS5)' : /playstation\(r\)3|dualshock ?3|ps3/i.test(id) ? 'DualShock 3 (PS3)' : /dualshock ?4|ps4|wireless controller/i.test(id) ? 'DualShock 4 (PS4)' : 'Controle PlayStation';
    return { ...base, family: 'playstation', model };
  }
  return { ...base, family: 'generic', model: standard ? 'Controle genérico' : 'Controle/joystick genérico' };
}

export function buttonName(family, i) {
  if (i == null || i < 0) return '—';
  const l = LABELS[family] || (family === 'radio' ? null : LABELS.playstation);
  if (l && l[i]) return l[i];
  return family === 'radio' ? `Botão/chave ${i + 1}` : `Botão ${i}`;
}

/** Nome de um vínculo de ação: número = botão; 'a4+' / 'a4-' = eixo usado como chave. */
export function bindingName(family, b) {
  if (typeof b === 'string') {
    const m = b.match(/^a(\d+)([+-])$/);
    if (!m) return '—';
    const ax = Number(m[1]);
    const dir = m[2] === '+' ? '↑' : '↓';
    return family === 'radio' ? `Chave CH${ax + 1} ${dir}` : `Eixo ${ax} ${dir}`;
  }
  return buttonName(family, b);
}

export function axisName(family, i) {
  if (family === 'radio') return `Eixo ${i} (CH${i + 1})`;
  return ['Stick esq. X', 'Stick esq. Y', 'Stick dir. X', 'Stick dir. Y'][i] || `Eixo ${i}`;
}

/** Que tipo de vibração este controle + navegador aceitam. */
export function hapticsSupport(gp) {
  if (!gp) return null;
  const act = gp.vibrationActuator;
  if (act && typeof act.playEffect === 'function') {
    const fx = act.effects;
    if (Array.isArray(fx) && fx.includes('trigger-rumble')) return 'trigger-rumble';
    if (Array.isArray(fx) && !fx.includes('dual-rumble') && fx.length) return null;
    if (typeof act.canPlayEffectType === 'function' && !act.canPlayEffectType('dual-rumble')) return null;
    return 'dual-rumble';
  }
  if (gp.hapticActuators && gp.hapticActuators.length && typeof gp.hapticActuators[0].pulse === 'function') return 'pulse';
  return null;
}
