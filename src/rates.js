// Fórmulas de rates idênticas às do Betaflight (rc_rates / actual) e curva de throttle.

const RC_RATE_INCREMENTAL = 14.54;

export function betaflightRate(rc, rcRate, superRate, expo) {
  const abs = Math.min(Math.abs(rc), 1);
  if (expo) rc = rc * abs * abs * abs * expo + rc * (1 - expo);
  let rate = rcRate > 2 ? rcRate + (rcRate - 2) * RC_RATE_INCREMENTAL : rcRate;
  let angleRate = 200 * rate * rc;
  if (superRate) angleRate *= 1 / Math.min(Math.max(1 - abs * superRate, 0.01), 1);
  return angleRate; // graus/s
}

export function actualRate(rc, center, max, expo) {
  const abs = Math.min(Math.abs(rc), 1);
  const rc5 = rc * abs * abs * abs * abs;
  const expof = abs * (rc5 * expo + rc * (1 - expo));
  const stickMovement = Math.max(0, max - center);
  return rc * center + stickMovement * expof; // graus/s
}

/** stick em [-1,1] → graus/s para o eixo ('roll' | 'pitch' | 'yaw') */
export function stickToRate(stick, axis, r) {
  if (r.type === 'actual') return actualRate(stick, r[axis + 'Center'], r[axis + 'Max'], r[axis + 'ActExpo']);
  return betaflightRate(stick, r[axis + 'Rc'], r[axis + 'Super'], r[axis + 'Expo']);
}

/** throttle 0..1 → 0..1 com mid/expo (mesma ideia do thrMid/thrExpo do Betaflight) */
export function throttleCurve(t, mid, expo, limit) {
  t = Math.min(Math.max(t, 0), 1);
  const tmp = t - mid;
  const y = tmp > 0 ? 1 - mid : mid; // normalização dos dois lados do mid
  const norm = y ? tmp / y : 0;
  const curved = mid + tmp * (1 - expo + expo * norm * norm);
  return Math.min(Math.max(curved, 0), 1) * limit;
}

export function applyDeadband(v, db) {
  const a = Math.abs(v);
  if (a <= db) return 0;
  return Math.sign(v) * (a - db) / (1 - db);
}
