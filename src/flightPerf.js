// Estimativas de desempenho do drone a partir dos parâmetros físicos (as mesmas fórmulas de
// drone.js): empuxo/peso, throttle de hover e velocidade máxima em voo nivelado.

/** Empuxo máximo de um motor já com o multiplicador de potência. */
export function thrustMax(p) { return p.maxThrust * (p.power ?? 1); }

export function thrustToWeight(p, g = 9.81) { return (thrustMax(p) * 4) / (p.mass * g); }

/** Posição do stick de throttle (0..1) para pairar. Empuxo ∝ rpm², rpm ∝ comando. */
export function hoverThrottle(p, g = 9.81, idle = 0.055) {
  const frac = (p.mass * g) / (thrustMax(p) * 4);
  if (frac >= 1) return null;
  return Math.max(0, (Math.sqrt(frac) - idle) / (1 - idle));
}

/**
 * Velocidade máxima (m/s) em voo nivelado com throttle cheio: para cada velocidade acha a
 * inclinação que sustenta o peso e verifica se ainda sobra força para frente.
 */
/** Fator de empuxo com a bateria cedendo sob throttle cheio (mesmo modelo de drone.js). */
export function sagFactor(p, w) {
  if (w.batterySim === false) return 1;
  const cells = Math.max(1, Math.round(p.cells));
  const I = 0.4 + 4 * p.motorMaxCurrent;
  const V = cells * 4.1 - I * p.internalResistance;
  return Math.min(1.08, Math.max(0.2, (V / (cells * 3.95)) ** 2));
}

export function estimateTopSpeed(p, w, pitchSpeed = p.propPitchSpeed) {
  const T = thrustMax(p) * 4 * sagFactor(p, w);
  const rho = w.airDensity, mg = p.mass * w.gravity;
  const rotorK = p.rotorDrag * 1.5;
  if (T <= mg) return 0;
  const forces = (v, th) => {
    const s = Math.sin(th), c = Math.cos(th);
    const inflow = Math.min(1.2, Math.max(0, 1 - (v * s) / pitchSpeed));
    const F = T * inflow;
    const dTop = 0.5 * rho * p.cdaTop * (v * s) * (v * s);
    const dFront = 0.5 * rho * p.cdaFront * (v * c) * (v * c) + rotorK * v * c;
    return { h: F * s - dTop * s - dFront * c, y: F * c - dTop * c + dFront * s - mg };
  };
  const tiltFor = v => { // inclinação que mantém altitude (vertical = 0)
    if (forces(v, 0).y < 0) return null;
    let lo = 0, hi = 1.55;
    if (forces(v, hi).y > 0) return hi;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (forces(v, m).y > 0) lo = m; else hi = m; }
    return lo;
  };
  let last = 0;
  for (let v = 1; v < 200; v += 1) {
    const th = tiltFor(v);
    if (th == null || forces(v, th).h <= 0) {
      // refina entre a última velocidade boa e esta
      let lo = last, hi = v;
      for (let i = 0; i < 20; i++) {
        const m = (lo + hi) / 2, t = tiltFor(m);
        if (t != null && forces(m, t).h > 0) lo = m; else hi = m;
      }
      return lo;
    }
    last = v;
  }
  return 200;
}

/**
 * Passo de hélice (m/s) que faz a velocidade máxima ficar próxima de `target` (m/s).
 * Retorna { pitchSpeed, reached } — reached=false quando nem com hélice extrema dá (falta potência).
 */
export function solvePitchSpeed(p, w, target) {
  let lo = 3, hi = 400;
  if (estimateTopSpeed(p, w, hi) < target) return { pitchSpeed: hi, reached: false };
  if (estimateTopSpeed(p, w, lo) > target) return { pitchSpeed: lo, reached: false };
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (estimateTopSpeed(p, w, m) < target) lo = m; else hi = m;
  }
  return { pitchSpeed: (lo + hi) / 2, reached: true };
}

/**
 * Ajusta o drone para a velocidade máxima `target` (m/s): primeiro pelo passo da hélice (até
 * 150 m/s, já extremo); se não bastar, reduz o arrasto (frame mais aerodinâmico).
 * Retorna { pitchSpeed, dragMul, reached }.
 */
export function tuneTopSpeed(p, w, target) {
  const r = solvePitchSpeed(p, w, target);
  if (r.reached && r.pitchSpeed <= 150) return { pitchSpeed: r.pitchSpeed, dragMul: 1, reached: true };
  if (!r.reached && r.pitchSpeed < 10) return { pitchSpeed: r.pitchSpeed, dragMul: 1, reached: false };
  const scaled = m => ({ ...p, cdaFront: p.cdaFront * m, cdaTop: p.cdaTop * m, rotorDrag: p.rotorDrag * m });
  if (estimateTopSpeed(scaled(0.05), w, 150) < target) return { pitchSpeed: 150, dragMul: 0.05, reached: false };
  let lo = 0.05, hi = 1;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (estimateTopSpeed(scaled(m), w, 150) < target) hi = m; else lo = m;
  }
  return { pitchSpeed: 150, dragMul: (lo + hi) / 2, reached: true };
}
