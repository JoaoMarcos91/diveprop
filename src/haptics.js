// Vibração do controle (haptics) pela Gamepad API.
//   'dual-rumble'    → Chrome, Edge, Safari 16.4+ (PS4, PS5, Xbox, Switch Pro…)
//   'trigger-rumble' → Chrome/Edge 126+ com controle de Xbox (motores nos gatilhos)
//   pulse()          → Firefox (API antiga hapticActuators)
// Controles ou navegadores sem suporte simplesmente não vibram.
import { hapticsSupport } from './controllers.js';

const clamp01 = v => Math.max(0, Math.min(1, v));

export class Haptics {
  constructor(settings, input) {
    this.settings = settings;
    this.input = input;
    this.busyUntil = 0;   // um impacto forte não é interrompido pela vibração contínua
    this.lastPulse = 0;
    this.contTimer = 0;
  }

  get cfg() { return this.settings.data.input; }

  /** strong = motor grave (pesado), weak = motor agudo (zumbido). ms = duração. */
  play(strong, weak, ms, { triggers = 0, force = false } = {}) {
    const gp = this.input.gamepad;
    if (!gp || (!this.cfg.haptics && !force)) return false;
    const k = force ? 1 : this.cfg.hapticStrength;
    strong = clamp01(strong * k);
    weak = clamp01(weak * k);
    ms = Math.round(Math.max(16, Math.min(ms, 2000)));
    const kind = hapticsSupport(gp);
    try {
      if (kind === 'trigger-rumble') {
        const t = clamp01(triggers * k);
        gp.vibrationActuator.playEffect('trigger-rumble', { duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak, leftTrigger: t, rightTrigger: t })?.catch?.(() => {});
      } else if (kind === 'dual-rumble') {
        gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => {});
      } else if (kind === 'pulse') {
        gp.hapticActuators[0].pulse(Math.max(strong, weak), ms)?.catch?.(() => {});
      } else return false;
    } catch { return false; }
    return true;
  }

  /** Batida: intensidade proporcional à variação brusca de velocidade (m/s). */
  impact(dv) {
    const now = performance.now();
    if (dv < 1.2 || now - this.lastPulse < 50) return;
    this.lastPulse = now;
    const x = clamp01((dv - 1.2) / 9);
    const ms = 70 + x * 230;
    this.busyUntil = now + ms;
    this.play(0.25 + 0.75 * x, 0.35 + 0.65 * x, ms, { triggers: x });
  }

  crash() {
    this.busyUntil = performance.now() + 420;
    this.play(1, 1, 420, { triggers: 1 });
  }

  tick(kind) { // 'arm' | 'disarm' | 'gate' | 'lap'
    const p = { arm: [0.15, 0.6, 60], disarm: [0.0, 0.4, 45], gate: [0.0, 0.35, 40], lap: [0.4, 0.8, 160] }[kind];
    if (p) this.play(p[0], p[1], p[2]);
  }

  /** Vibração contínua opcional: zumbido dos motores + turbulência do propwash. */
  update(dt, drone, flying) {
    if (!this.cfg.haptics || !this.cfg.hapticContinuous || !flying || !drone?.armed) return;
    this.contTimer -= dt;
    if (this.contTimer > 0 || performance.now() < this.busyUntil) return;
    this.contTimer = 0.1;
    const weak = 0.04 + 0.22 * drone.avgMotor();
    const strong = 0.65 * drone.propwashLevel;
    this.play(strong, weak, 130);
  }

  stop() {
    const act = this.input.gamepad?.vibrationActuator;
    try { act?.reset?.()?.catch?.(() => {}); } catch { /* ignora */ }
  }
}
