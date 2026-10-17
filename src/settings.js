// Todas as configurações do jogo: valores padrão, presets, schema da tela de
// configurações e persistência em localStorage.

const STORAGE_KEY = 'fpvsim.settings.v1';

// ---------------------------------------------------------------------------
// Presets de drone (física). Valores típicos de drones reais.
// ---------------------------------------------------------------------------
export const DRONE_PRESETS = {
  whoop: {
    label: 'Tiny Whoop 65mm (1S)',
    mass: 0.032, armLength: 0.032, maxThrust: 0.30, motorTauUp: 0.018, motorTauDown: 0.028,
    yawTorqueRatio: 0.012, propPitchSpeed: 16, propRadius: 0.0155,
    inertiaPitch: 1.6e-5, inertiaRoll: 1.5e-5, inertiaYaw: 2.8e-5,
    cdaFront: 0.0016, cdaSide: 0.0018, cdaTop: 0.0045, rotorDrag: 0.010, angularDrag: 2e-7,
    size: 0.04, cells: 1, capacity: 300, internalResistance: 0.09, motorMaxCurrent: 2.2,
  },
  cinewhoop: {
    label: 'Cinewhoop 3" (4S)',
    mass: 0.36, armLength: 0.065, maxThrust: 4.2, motorTauUp: 0.025, motorTauDown: 0.04,
    yawTorqueRatio: 0.014, propPitchSpeed: 32, propRadius: 0.038,
    inertiaPitch: 6.5e-4, inertiaRoll: 6.0e-4, inertiaYaw: 1.1e-3,
    cdaFront: 0.010, cdaSide: 0.011, cdaTop: 0.032, rotorDrag: 0.07, angularDrag: 8e-6,
    size: 0.085, cells: 4, capacity: 650, internalResistance: 0.05, motorMaxCurrent: 18,
  },
  freestyle5: {
    label: 'Freestyle 5" (6S)',
    mass: 0.65, armLength: 0.11, maxThrust: 13, motorTauUp: 0.028, motorTauDown: 0.045,
    yawTorqueRatio: 0.018, propPitchSpeed: 55, propRadius: 0.0635,
    inertiaPitch: 1.8e-3, inertiaRoll: 1.5e-3, inertiaYaw: 3.0e-3,
    cdaFront: 0.012, cdaSide: 0.014, cdaTop: 0.035, rotorDrag: 0.12, angularDrag: 3e-5,
    size: 0.115, cells: 6, capacity: 1100, internalResistance: 0.04, motorMaxCurrent: 30,
  },
  racer5: {
    label: 'Racer 5" leve (6S)',
    mass: 0.52, armLength: 0.105, maxThrust: 14.5, motorTauUp: 0.022, motorTauDown: 0.035,
    yawTorqueRatio: 0.018, propPitchSpeed: 62, propRadius: 0.0635,
    inertiaPitch: 1.3e-3, inertiaRoll: 1.1e-3, inertiaYaw: 2.2e-3,
    cdaFront: 0.010, cdaSide: 0.012, cdaTop: 0.030, rotorDrag: 0.11, angularDrag: 3e-5,
    size: 0.11, cells: 6, capacity: 1000, internalResistance: 0.04, motorMaxCurrent: 34,
  },
  longrange7: {
    label: 'Long Range 7" (6S)',
    mass: 0.95, armLength: 0.16, maxThrust: 16, motorTauUp: 0.04, motorTauDown: 0.065,
    yawTorqueRatio: 0.02, propPitchSpeed: 58, propRadius: 0.089,
    inertiaPitch: 5.0e-3, inertiaRoll: 4.5e-3, inertiaYaw: 9.0e-3,
    cdaFront: 0.016, cdaSide: 0.018, cdaTop: 0.06, rotorDrag: 0.16, angularDrag: 6e-5,
    size: 0.16, cells: 6, capacity: 3000, internalResistance: 0.03, motorMaxCurrent: 25,
  },
};

// ---------------------------------------------------------------------------
// Presets de gráfico. Vídeo integrado antigo roda bem no "medium".
// ---------------------------------------------------------------------------
export const GRAPHICS_PRESETS = {
  potato: { label: 'Muito baixo', renderScale: 0.5, shadows: 0, pbr: false, normalMaps: false, viewDistance: 220, vegetation: 0.35, grass: false, anisotropy: 1, msaa: false, terrainDetail: 0.5 },
  low:    { label: 'Baixo',       renderScale: 0.7, shadows: 0, pbr: false, normalMaps: false, viewDistance: 380, vegetation: 0.6, grass: false, anisotropy: 2, msaa: false, terrainDetail: 0.7 },
  medium: { label: 'Médio',       renderScale: 0.85, shadows: 1024, pbr: false, normalMaps: false, viewDistance: 500, vegetation: 0.8, grass: true, anisotropy: 4, msaa: false, terrainDetail: 0.85 },
  high:   { label: 'Alto',        renderScale: 1.0, shadows: 2048, pbr: true, normalMaps: true, viewDistance: 700, vegetation: 1.0, grass: true, anisotropy: 8, msaa: true, terrainDetail: 1.0 },
  ultra:  { label: 'Ultra',       renderScale: 1.0, shadows: 4096, pbr: true, normalMaps: true, viewDistance: 1000, vegetation: 1.3, grass: true, anisotropy: 16, msaa: true, terrainDetail: 1.3 },
};

// Layouts prontos de controle.
// Controles (mapeamento "standard" da Gamepad API — PS3/PS4/PS5, Xbox, Switch Pro):
//   eixos 0=LX 1=LY 2=RX 3=RY · botões 0=✕/A 1=○/B 2=□/X 3=△/Y 4=L1/LB 5=R1/RB 6=L2/LT 7=R2/RT
//   8=Share/View 9=Options/Menu 12-15=D-pad
// Rádios FPV em modo joystick USB (EdgeTX/OpenTX): cada canal vira um eixo (CH1 = eixo 0…),
// e as chaves (CH5–CH8) viram os eixos 4–7.
const PAD_BUTTONS = { arm: 5, reset: 3, camera: 2, mode: 4, pause: 9, turtle: 0, tiltUp: 12, tiltDown: 13, fovDown: 14, fovUp: 15 };
const RADIO_BUTTONS = { arm: 'a4+', reset: -1, camera: -1, mode: 'a5+', pause: -1, turtle: 'a6+', tiltUp: -1, tiltDown: -1, fovDown: -1, fovUp: -1 };
const PAD_EXTRA = { throttleMode: 'full', deadband: 0.04, armSwitch: false, buttons: PAD_BUTTONS };
const RADIO_EXTRA = { throttleMode: 'full', deadband: 0.01, armSwitch: true, buttons: RADIO_BUTTONS };
export const CONTROL_LAYOUTS = {
  mode2: { label: 'Controle · Modo 2 (padrão)', throttle: { type: 'axis', index: 1, invert: true }, yaw: { type: 'axis', index: 0, invert: false }, pitch: { type: 'axis', index: 3, invert: true }, roll: { type: 'axis', index: 2, invert: false }, extra: PAD_EXTRA },
  mode1: { label: 'Controle · Modo 1', throttle: { type: 'axis', index: 3, invert: true }, yaw: { type: 'axis', index: 0, invert: false }, pitch: { type: 'axis', index: 1, invert: true }, roll: { type: 'axis', index: 2, invert: false }, extra: PAD_EXTRA },
  mode2r2: { label: 'Controle · Modo 2 + throttle no gatilho R2/RT', throttle: { type: 'button', index: 7, invert: false }, yaw: { type: 'axis', index: 0, invert: false }, pitch: { type: 'axis', index: 3, invert: true }, roll: { type: 'axis', index: 2, invert: false }, extra: PAD_EXTRA },
  radioAETR: { label: 'Rádio FPV · AETR (EdgeTX/OpenTX padrão)', roll: { type: 'axis', index: 0, invert: false }, pitch: { type: 'axis', index: 1, invert: false }, throttle: { type: 'axis', index: 2, invert: false }, yaw: { type: 'axis', index: 3, invert: false }, extra: RADIO_EXTRA },
  radioTAER: { label: 'Rádio FPV · TAER (Spektrum/FrSky antigo)', throttle: { type: 'axis', index: 0, invert: false }, roll: { type: 'axis', index: 1, invert: false }, pitch: { type: 'axis', index: 2, invert: false }, yaw: { type: 'axis', index: 3, invert: false }, extra: RADIO_EXTRA },
};
// O que fica salvo por controle (cada controle/rádio lembra o próprio mapeamento)
export const PROFILE_KEYS = ['layout', 'throttle', 'yaw', 'pitch', 'roll', 'throttleMode', 'deadband', 'throttleDeadband', 'calib', 'buttons', 'armSwitch'];

const d5 = DRONE_PRESETS.freestyle5;

export const DEFAULTS = {
  drone: { preset: 'freestyle5', power: 1, ...stripLabel(d5) },
  battery: { simulate: true, resetOnRespawn: true },
  world: {
    gravity: 9.81, airDensity: 1.225, windSpeed: 1.5, windDir: 45, gustStrength: 0.35,
    propwash: 1.0, groundEffect: true, crashMode: 'disarm', crashThreshold: 7,
    restitution: 0.25, friction: 0.6, physicsHz: 500, timeScale: 1.0, videoRange: 700,
  },
  fc: {
    mode: 'acro', airmode: true, motorIdle: 0.055,
    pRP: 45, iRP: 80, dRP: 32, ffRP: 100, pYaw: 70, iYaw: 80, dYaw: 45, ffYaw: 100,
    dtermLpf: 110, rcSmoothing: 30, angleLimit: 55, angleStrength: 6, gyroNoise: 0.15,
  },
  rates: {
    type: 'betaflight',
    rollRc: 1.0, rollSuper: 0.70, rollExpo: 0.0,
    pitchRc: 1.0, pitchSuper: 0.70, pitchExpo: 0.0,
    yawRc: 1.0, yawSuper: 0.70, yawExpo: 0.0,
    rollCenter: 70, rollMax: 670, rollActExpo: 0.54,
    pitchCenter: 70, pitchMax: 670, pitchActExpo: 0.54,
    yawCenter: 70, yawMax: 670, yawActExpo: 0.54,
    throttleMid: 0.5, throttleExpo: 0.0, throttleLimit: 1.0,
  },
  input: {
    layout: 'mode2',
    throttle: { ...CONTROL_LAYOUTS.mode2.throttle },
    yaw: { ...CONTROL_LAYOUTS.mode2.yaw },
    pitch: { ...CONTROL_LAYOUTS.mode2.pitch },
    roll: { ...CONTROL_LAYOUTS.mode2.roll },
    throttleMode: 'full', deadband: 0.04, throttleDeadband: 0.0,
    calib: {},
    buttons: { ...PAD_BUTTONS },
    armSafety: true, armSwitch: false, gamepadIndex: -1,
    haptics: true, hapticStrength: 0.8, hapticContinuous: false,
    profiles: {},
  },
  camera: {
    mode: 'fpv', uptilt: 25, fov: 118, fisheye: 0.35, fx: 'analog', fxStrength: 0.6,
    chaseDist: 2.4, chaseHeight: 0.7, chaseSmooth: 7, losHeight: 1.7, losZoom: true, shake: 0.4,
  },
  graphics: {
    preset: 'medium', ...stripLabel(GRAPHICS_PRESETS.medium),
    dynamicRes: true, targetFps: 50, fpsCap: 0, showFps: true, fog: true,
  },
  audio: { volume: 0.5, motor: true, wind: true },
  game: { osd: true, showSticks: true, scene: 'fields', bestLaps: {} },
};

function stripLabel(o) { const { label, ...rest } = o; return rest; }

// ---------------------------------------------------------------------------
// Schema da tela de configurações (gera a UI automaticamente).
// ---------------------------------------------------------------------------
const pct = { unit: '%', scale: 100 };
export const SCHEMA = [
  { tab: 'Controle', id: 'controls', groups: [
    { title: 'Layout', fields: [
      { path: 'input.layout', label: 'Layout', type: 'select', options: Object.fromEntries(Object.entries(CONTROL_LAYOUTS).map(([k, v]) => [k, v.label])), help: 'Modo 2: esquerdo = throttle/yaw, direito = pitch/roll. Rádios FPV em modo joystick USB costumam usar AETR.' },
      { path: 'input.throttleMode', label: 'Curso do throttle', type: 'select', options: { full: 'Stick inteiro (centro = 50% no controle)', half: 'Só metade de cima (centro = 0%)' }, help: 'O stick de um controle de videogame volta ao centro sozinho. Num rádio FPV use "Stick inteiro".' },
      { path: 'input.deadband', label: 'Deadband (pitch/roll/yaw)', type: 'range', min: 0, max: 0.2, step: 0.005, ...pct },
      { path: 'input.throttleDeadband', label: 'Deadband do throttle', type: 'range', min: 0, max: 0.15, step: 0.005, ...pct },
      { path: 'input.armSafety', label: 'Só armar com throttle baixo', type: 'toggle' },
      { path: 'input.armSwitch', label: 'Armar por chave (mantida)', type: 'toggle', help: 'Ligado: armado enquanto a chave/botão estiver ativo, como num rádio com Betaflight. Desligado: cada toque alterna armar/desarmar.' },
    ] },
    { title: 'Controle detectado', custom: 'gamepadMonitor' },
    { title: 'Canais', custom: 'channels' },
    { title: 'Botões e chaves', custom: 'buttons' },
    { title: 'Vibração (haptics)', fields: [
      { path: 'input.haptics', label: 'Vibrar em batidas e crashes', type: 'toggle', help: 'Funciona no Chrome, Edge e Safari 16.4+ com controles que vibram (PS4, PS5, Xbox, Switch Pro). No Chrome/Edge o controle de Xbox também vibra os gatilhos.' },
      { path: 'input.hapticStrength', label: 'Intensidade da vibração', type: 'range', min: 0.1, max: 1, step: 0.05, ...pct },
      { path: 'input.hapticContinuous', label: 'Vibração contínua (motores + propwash)', type: 'toggle' },
    ] },
    { title: '', custom: 'hapticsTest' },
  ] },
  { tab: 'Rates', id: 'rates', groups: [
    { title: 'Tipo', fields: [
      { path: 'rates.type', label: 'Fórmula de rates', type: 'select', options: { betaflight: 'Betaflight (RC rate / Super / Expo)', actual: 'Actual (Center / Max / Expo)' } },
    ] },
    { title: 'Curvas', custom: 'rateCurves' },
    { title: 'Betaflight', when: s => s.rates.type === 'betaflight', fields: [
      { path: 'rates.rollRc', label: 'Roll · RC Rate', type: 'range', min: 0.1, max: 2.55, step: 0.01 },
      { path: 'rates.rollSuper', label: 'Roll · Super Rate', type: 'range', min: 0, max: 0.95, step: 0.01 },
      { path: 'rates.rollExpo', label: 'Roll · Expo', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'rates.pitchRc', label: 'Pitch · RC Rate', type: 'range', min: 0.1, max: 2.55, step: 0.01 },
      { path: 'rates.pitchSuper', label: 'Pitch · Super Rate', type: 'range', min: 0, max: 0.95, step: 0.01 },
      { path: 'rates.pitchExpo', label: 'Pitch · Expo', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'rates.yawRc', label: 'Yaw · RC Rate', type: 'range', min: 0.1, max: 2.55, step: 0.01 },
      { path: 'rates.yawSuper', label: 'Yaw · Super Rate', type: 'range', min: 0, max: 0.95, step: 0.01 },
      { path: 'rates.yawExpo', label: 'Yaw · Expo', type: 'range', min: 0, max: 1, step: 0.01 },
    ] },
    { title: 'Actual', when: s => s.rates.type === 'actual', fields: [
      { path: 'rates.rollCenter', label: 'Roll · Center sensitivity', type: 'range', min: 10, max: 400, step: 5, unit: '°/s' },
      { path: 'rates.rollMax', label: 'Roll · Max rate', type: 'range', min: 100, max: 1800, step: 10, unit: '°/s' },
      { path: 'rates.rollActExpo', label: 'Roll · Expo', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'rates.pitchCenter', label: 'Pitch · Center sensitivity', type: 'range', min: 10, max: 400, step: 5, unit: '°/s' },
      { path: 'rates.pitchMax', label: 'Pitch · Max rate', type: 'range', min: 100, max: 1800, step: 10, unit: '°/s' },
      { path: 'rates.pitchActExpo', label: 'Pitch · Expo', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'rates.yawCenter', label: 'Yaw · Center sensitivity', type: 'range', min: 10, max: 400, step: 5, unit: '°/s' },
      { path: 'rates.yawMax', label: 'Yaw · Max rate', type: 'range', min: 100, max: 1800, step: 10, unit: '°/s' },
      { path: 'rates.yawActExpo', label: 'Yaw · Expo', type: 'range', min: 0, max: 1, step: 0.01 },
    ] },
    { title: 'Throttle', fields: [
      { path: 'rates.throttleMid', label: 'Throttle mid', type: 'range', min: 0.1, max: 0.9, step: 0.01 },
      { path: 'rates.throttleExpo', label: 'Throttle expo', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'rates.throttleLimit', label: 'Limite de throttle', type: 'range', min: 0.3, max: 1, step: 0.01, ...pct },
    ] },
  ] },
  { tab: 'Física', id: 'physics', groups: [
    { title: 'Potência e velocidade', fields: [
      { path: 'drone.power', label: 'Potência', type: 'range', min: 0.3, max: 3, step: 0.05, unit: '%', scale: 100, help: 'Multiplica a força dos motores. 100% = o drone do preset; 200% = o dobro de empuxo (mais aceleração e subida).' },
    ] },
    { title: '', custom: 'speedControl' },
    { title: 'Drone', fields: [
      { path: 'drone.preset', label: 'Preset de drone', type: 'select', options: Object.fromEntries(Object.entries(DRONE_PRESETS).map(([k, v]) => [k, v.label])), help: 'Carrega todos os parâmetros abaixo. Depois você pode ajustar cada um.' },
      { path: 'drone.mass', label: 'Massa (com bateria)', type: 'range', min: 0.02, max: 2, step: 0.005, unit: 'kg' },
      { path: 'drone.maxThrust', label: 'Empuxo máx. por motor', type: 'range', min: 0.1, max: 30, step: 0.1, unit: 'N' },
      { path: 'drone.armLength', label: 'Distância centro→motor', type: 'range', min: 0.02, max: 0.3, step: 0.002, unit: 'm' },
      { path: 'drone.motorTauUp', label: 'Tempo de resposta do motor (subida)', type: 'range', min: 0.005, max: 0.15, step: 0.001, unit: 's' },
      { path: 'drone.motorTauDown', label: 'Tempo de resposta do motor (descida)', type: 'range', min: 0.005, max: 0.2, step: 0.001, unit: 's' },
      { path: 'drone.propPitchSpeed', label: 'Velocidade de passo da hélice', type: 'range', min: 3, max: 200, step: 0.5, unit: 'm/s', help: 'Empuxo cai conforme o ar entra rápido na hélice: limita a velocidade máxima.' },
      { path: 'drone.yawTorqueRatio', label: 'Torque de yaw / empuxo', type: 'range', min: 0.002, max: 0.05, step: 0.001, unit: 'm' },
      { path: 'drone.propRadius', label: 'Raio da hélice', type: 'range', min: 0.01, max: 0.12, step: 0.001, unit: 'm' },
      { path: 'drone.size', label: 'Tamanho da colisão (meia largura)', type: 'range', min: 0.02, max: 0.25, step: 0.005, unit: 'm' },
    ] },
    { title: 'Inércia', fields: [
      { path: 'drone.inertiaPitch', label: 'Inércia pitch', type: 'range', min: 5e-6, max: 0.02, step: 1e-5, unit: 'kg·m²', digits: 5 },
      { path: 'drone.inertiaRoll', label: 'Inércia roll', type: 'range', min: 5e-6, max: 0.02, step: 1e-5, unit: 'kg·m²', digits: 5 },
      { path: 'drone.inertiaYaw', label: 'Inércia yaw', type: 'range', min: 5e-6, max: 0.03, step: 1e-5, unit: 'kg·m²', digits: 5 },
    ] },
    { title: 'Aerodinâmica', fields: [
      { path: 'drone.cdaFront', label: 'Arrasto frontal (Cd·A)', type: 'range', min: 0, max: 0.08, step: 0.0005, unit: 'm²', digits: 4 },
      { path: 'drone.cdaSide', label: 'Arrasto lateral (Cd·A)', type: 'range', min: 0, max: 0.08, step: 0.0005, unit: 'm²', digits: 4 },
      { path: 'drone.cdaTop', label: 'Arrasto superior (Cd·A)', type: 'range', min: 0, max: 0.15, step: 0.0005, unit: 'm²', digits: 4 },
      { path: 'drone.rotorDrag', label: 'Arrasto linear dos rotores', type: 'range', min: 0, max: 0.5, step: 0.005, unit: 'N·s/m' },
      { path: 'drone.angularDrag', label: 'Arrasto angular', type: 'range', min: 0, max: 0.0005, step: 0.000001, digits: 6 },
      { path: 'world.airDensity', label: 'Densidade do ar', type: 'range', min: 0.5, max: 1.4, step: 0.005, unit: 'kg/m³' },
      { path: 'world.gravity', label: 'Gravidade', type: 'range', min: 1, max: 20, step: 0.01, unit: 'm/s²' },
      { path: 'world.propwash', label: 'Intensidade do propwash', type: 'range', min: 0, max: 3, step: 0.05 },
      { path: 'world.groundEffect', label: 'Efeito solo', type: 'toggle' },
    ] },
    { title: 'Vento', fields: [
      { path: 'world.windSpeed', label: 'Velocidade do vento', type: 'range', min: 0, max: 15, step: 0.1, unit: 'm/s' },
      { path: 'world.windDir', label: 'Direção do vento', type: 'range', min: 0, max: 359, step: 1, unit: '°' },
      { path: 'world.gustStrength', label: 'Rajadas', type: 'range', min: 0, max: 1.5, step: 0.05 },
    ] },
    { title: 'Bateria', fields: [
      { path: 'battery.simulate', label: 'Simular bateria (voltage sag)', type: 'toggle' },
      { path: 'battery.resetOnRespawn', label: 'Bateria cheia ao resetar', type: 'toggle' },
      { path: 'drone.cells', label: 'Células (S)', type: 'range', min: 1, max: 8, step: 1, unit: 'S' },
      { path: 'drone.capacity', label: 'Capacidade', type: 'range', min: 100, max: 6000, step: 50, unit: 'mAh' },
      { path: 'drone.internalResistance', label: 'Resistência interna', type: 'range', min: 0, max: 0.2, step: 0.002, unit: 'Ω' },
      { path: 'drone.motorMaxCurrent', label: 'Corrente máx. por motor', type: 'range', min: 1, max: 80, step: 0.5, unit: 'A' },
    ] },
    { title: 'Colisões', fields: [
      { path: 'world.crashMode', label: 'Ao bater forte', type: 'select', options: { disarm: 'Desarma (realista)', reset: 'Reset automático', none: 'Indestrutível' } },
      { path: 'world.crashThreshold', label: 'Impacto para crash', type: 'range', min: 2, max: 30, step: 0.5, unit: 'm/s' },
      { path: 'world.restitution', label: 'Quique (restituição)', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'world.friction', label: 'Atrito', type: 'range', min: 0, max: 1.5, step: 0.01 },
    ] },
    { title: 'Simulação', fields: [
      { path: 'world.physicsHz', label: 'Frequência da física', type: 'select', options: { 250: '250 Hz', 333: '333 Hz', 500: '500 Hz', 1000: '1000 Hz (pesado)' }, numeric: true },
      { path: 'world.timeScale', label: 'Velocidade do tempo', type: 'range', min: 0.1, max: 1.5, step: 0.05, unit: '×' },
      { path: 'world.videoRange', label: 'Alcance do vídeo', type: 'range', min: 100, max: 3000, step: 50, unit: 'm' },
    ] },
  ] },
  { tab: 'Controladora', id: 'fc', groups: [
    { title: 'Modo de voo', fields: [
      { path: 'fc.mode', label: 'Modo', type: 'select', options: { acro: 'Acro (rate)', angle: 'Angle (auto-nivelado)', horizon: 'Horizon (misto)' } },
      { path: 'fc.airmode', label: 'Airmode', type: 'toggle', help: 'Mantém autoridade de controle com throttle zerado (essencial para freestyle).' },
      { path: 'fc.motorIdle', label: 'Idle do motor', type: 'range', min: 0, max: 0.15, step: 0.005, ...pct },
      { path: 'fc.angleLimit', label: 'Ângulo máx. (Angle)', type: 'range', min: 10, max: 85, step: 1, unit: '°' },
      { path: 'fc.angleStrength', label: 'Força do nivelamento', type: 'range', min: 1, max: 15, step: 0.5 },
    ] },
    { title: 'PID (normalizado — o drone já vem "tunado")', fields: [
      { path: 'fc.pRP', label: 'Roll/Pitch · P', type: 'range', min: 5, max: 150, step: 1 },
      { path: 'fc.iRP', label: 'Roll/Pitch · I', type: 'range', min: 0, max: 200, step: 1 },
      { path: 'fc.dRP', label: 'Roll/Pitch · D', type: 'range', min: 0, max: 100, step: 1 },
      { path: 'fc.ffRP', label: 'Roll/Pitch · Feedforward', type: 'range', min: 0, max: 250, step: 1 },
      { path: 'fc.pYaw', label: 'Yaw · P', type: 'range', min: 5, max: 150, step: 1 },
      { path: 'fc.iYaw', label: 'Yaw · I', type: 'range', min: 0, max: 200, step: 1 },
      { path: 'fc.dYaw', label: 'Yaw · D', type: 'range', min: 0, max: 100, step: 1 },
      { path: 'fc.ffYaw', label: 'Yaw · Feedforward', type: 'range', min: 0, max: 250, step: 1 },
      { path: 'fc.dtermLpf', label: 'Filtro do D-term', type: 'range', min: 20, max: 250, step: 1, unit: 'Hz' },
      { path: 'fc.rcSmoothing', label: 'RC smoothing', type: 'range', min: 5, max: 100, step: 1, unit: 'Hz' },
      { path: 'fc.gyroNoise', label: 'Ruído/vibração do gyro', type: 'range', min: 0, max: 1, step: 0.01 },
    ] },
  ] },
  { tab: 'Câmera', id: 'camera', groups: [
    { title: 'Câmera FPV', fields: [
      { path: 'camera.mode', label: 'Câmera', type: 'select', options: { fpv: 'FPV (primeira pessoa)', chase: 'Terceira pessoa', los: 'Linha de visada (do chão)' } },
      { path: 'camera.uptilt', label: 'Ângulo da câmera (uptilt)', type: 'range', min: -10, max: 70, step: 1, unit: '°', help: 'Também ajustável em voo pelo D-pad ↑/↓.' },
      { path: 'camera.fov', label: 'FOV horizontal', type: 'range', min: 60, max: 160, step: 1, unit: '°', help: 'D-pad ←/→ em voo.' },
      { path: 'camera.fisheye', label: 'Distorção fisheye', type: 'range', min: 0, max: 0.8, step: 0.01 },
      { path: 'camera.fx', label: 'Sinal de vídeo', type: 'select', options: { analog: 'Analógico (ruído, estática)', digital: 'Digital (HD limpo)', off: 'Sem efeito (mais leve)' } },
      { path: 'camera.fxStrength', label: 'Intensidade do efeito', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'camera.shake', label: 'Vibração da câmera', type: 'range', min: 0, max: 1, step: 0.01 },
    ] },
    { title: 'Terceira pessoa / Linha de visada', fields: [
      { path: 'camera.chaseDist', label: 'Distância', type: 'range', min: 0.5, max: 10, step: 0.1, unit: 'm' },
      { path: 'camera.chaseHeight', label: 'Altura', type: 'range', min: -1, max: 5, step: 0.1, unit: 'm' },
      { path: 'camera.chaseSmooth', label: 'Suavização', type: 'range', min: 1, max: 30, step: 0.5 },
      { path: 'camera.losHeight', label: 'Altura do piloto', type: 'range', min: 0.5, max: 10, step: 0.1, unit: 'm' },
      { path: 'camera.losZoom', label: 'Zoom automático (linha de visada)', type: 'toggle' },
    ] },
  ] },
  { tab: 'Gráficos', id: 'graphics', groups: [
    { title: 'Qualidade', fields: [
      { path: 'graphics.preset', label: 'Preset', type: 'select', options: Object.fromEntries(Object.entries(GRAPHICS_PRESETS).map(([k, v]) => [k, v.label])) },
      { path: 'graphics.renderScale', label: 'Escala de resolução', type: 'range', min: 0.35, max: 1.5, step: 0.05, ...pct },
      { path: 'graphics.dynamicRes', label: 'Resolução dinâmica', type: 'toggle', help: 'Baixa a resolução sozinho quando o FPS cai.' },
      { path: 'graphics.targetFps', label: 'FPS alvo (resolução dinâmica)', type: 'range', min: 25, max: 60, step: 1 },
      { path: 'graphics.fpsCap', label: 'Limite de FPS', type: 'select', options: { 0: 'Sem limite (vsync)', 30: '30', 45: '45', 60: '60' }, numeric: true },
      { path: 'graphics.viewDistance', label: 'Distância de visão', type: 'range', min: 100, max: 1500, step: 10, unit: 'm' },
      { path: 'graphics.fog', label: 'Neblina atmosférica', type: 'toggle' },
      { path: 'graphics.showFps', label: 'Mostrar FPS', type: 'toggle' },
    ] },
    { title: 'Requer recarregar o cenário', fields: [
      { path: 'graphics.shadows', label: 'Sombras', type: 'select', options: { 0: 'Desligadas', 1024: 'Baixa (1024)', 2048: 'Média (2048)', 4096: 'Alta (4096)' }, numeric: true, reload: true },
      { path: 'graphics.pbr', label: 'Materiais PBR (reflexos do céu)', type: 'toggle', reload: true },
      { path: 'graphics.normalMaps', label: 'Normal maps (relevo)', type: 'toggle', reload: true },
      { path: 'graphics.vegetation', label: 'Densidade de vegetação', type: 'range', min: 0.1, max: 1.5, step: 0.05, ...pct, reload: true },
      { path: 'graphics.grass', label: 'Tufos de grama', type: 'toggle', reload: true },
      { path: 'graphics.terrainDetail', label: 'Detalhe do terreno', type: 'range', min: 0.3, max: 1.5, step: 0.05, ...pct, reload: true },
      { path: 'graphics.anisotropy', label: 'Filtro anisotrópico', type: 'select', options: { 1: 'Desligado', 2: '2×', 4: '4×', 8: '8×', 16: '16×' }, numeric: true, reload: true },
      { path: 'graphics.msaa', label: 'Anti-aliasing (MSAA)', type: 'toggle', reload: 'page' },
    ] },
  ] },
  { tab: 'Áudio / Jogo', id: 'game', groups: [
    { title: 'Áudio', fields: [
      { path: 'audio.volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.01, ...pct },
      { path: 'audio.motor', label: 'Som dos motores', type: 'toggle' },
      { path: 'audio.wind', label: 'Som do vento', type: 'toggle' },
    ] },
    { title: 'Interface', fields: [
      { path: 'game.osd', label: 'OSD (informações na tela)', type: 'toggle' },
      { path: 'game.showSticks', label: 'Mostrar posição dos sticks', type: 'toggle' },
    ] },
    { title: 'Dados', custom: 'dataTools' },
  ] },
];

// ---------------------------------------------------------------------------
// Persistência e acesso por caminho ("fc.pRP").
// ---------------------------------------------------------------------------
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= {};
  o[keys[keys.length - 1]] = value;
}

function deepMerge(base, over) {
  if (over == null || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? deepMerge(base[k], v) : v;
  }
  return out;
}

export class Settings {
  constructor() {
    this.listeners = new Set();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { saved = null; }
    this.data = deepMerge(structuredClone(DEFAULTS), saved || {});
  }

  get(path) { return getPath(this.data, path); }

  set(path, value, { silent = false } = {}) {
    const prevLayout = this.data.input?.layout;
    setPath(this.data, path, value);
    // Efeitos colaterais de presets
    if (path === 'drone.preset' && DRONE_PRESETS[value]) Object.assign(this.data.drone, stripLabel(DRONE_PRESETS[value]), { preset: value, power: 1 });
    if (path === 'graphics.preset' && GRAPHICS_PRESETS[value]) Object.assign(this.data.graphics, stripLabel(GRAPHICS_PRESETS[value]), { preset: value });
    if (path === 'input.layout' && CONTROL_LAYOUTS[value]) {
      const L = CONTROL_LAYOUTS[value];
      for (const ch of ['throttle', 'yaw', 'pitch', 'roll']) this.data.input[ch] = { ...L[ch] };
      // trocar de família (controle ↔ rádio) também troca botões/chaves e deadband
      if (String(prevLayout).startsWith('radio') !== value.startsWith('radio')) Object.assign(this.data.input, structuredClone(L.extra));
    }
    this.save();
    if (!silent) for (const fn of this.listeners) fn(path, value);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* modo privado */ }
  }

  resetSection(section) {
    this.data[section] = structuredClone(DEFAULTS[section]);
    this.save();
    for (const fn of this.listeners) fn(section, this.data[section]);
  }

  resetAll() {
    const bestLaps = this.data.game.bestLaps;
    this.data = structuredClone(DEFAULTS);
    this.data.game.bestLaps = bestLaps;
    this.save();
    for (const fn of this.listeners) fn('*', null);
  }

  exportJSON() { return JSON.stringify(this.data, null, 2); }

  importJSON(text) {
    const parsed = JSON.parse(text);
    this.data = deepMerge(structuredClone(DEFAULTS), parsed);
    this.save();
    for (const fn of this.listeners) fn('*', null);
  }
}
