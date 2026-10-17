// Física do quadricóptero: rádio → controladora (PID de taxa) → mixer → motores →
// aerodinâmica → corpo rígido do Rapier.
//
// Eixos do corpo (convenção Three.js): +X direita, +Y cima, -Z frente.
// Rotação positiva em X = nariz pra cima; em Y = yaw pra esquerda; em Z = rolar pra esquerda.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { stickToRate, throttleCurve } from './rates.js';
import { thrustMax } from './flightPerf.js';

const DEG = Math.PI / 180;
// Quad X. spin +1 = anti-horário visto de cima.
const MOTORS = [
  { x: +1, z: -1, spin: +1 }, // frente direita
  { x: -1, z: -1, spin: -1 }, // frente esquerda
  { x: +1, z: +1, spin: -1 }, // trás direita
  { x: -1, z: +1, spin: +1 }, // trás esquerda
];

// Ganhos de referência (Freestyle 5"): permitem que o mesmo PID funcione em qualquer preset.
const REF_G_RP = 2245;
const REF_G_YAW = 312;
const KP = 0.00145, KI = 0.0025, KD = 0.0000287, KFF = 0.0000044;

const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _air = new THREE.Vector3();
const _f = new THREE.Vector3();
const _t = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _rt = new THREE.Vector3();

function lpfAlpha(hz, dt) { const rc = 1 / (2 * Math.PI * hz); return dt / (rc + dt); }

function cellVoltage(soc) {
  // curva de descarga típica de LiPo (sem carga)
  const pts = [[0, 3.3], [0.05, 3.5], [0.1, 3.6], [0.2, 3.7], [0.5, 3.82], [0.8, 4.0], [0.95, 4.12], [1, 4.2]];
  if (soc <= 0) return 3.3 + soc * 2;
  for (let i = 1; i < pts.length; i++) {
    if (soc <= pts[i][0]) {
      const [a, va] = pts[i - 1], [b, vb] = pts[i];
      return va + (vb - va) * (soc - a) / (b - a);
    }
  }
  return 4.2;
}

export class Drone {
  constructor(world, settings, spawn) {
    this.world = world;
    this.settings = settings;
    this.spawn = spawn; // { pos: Vector3, yaw }
    this.motor = [0, 0, 0, 0];   // estado de rotação (0..1)
    this.motorCmd = [0, 0, 0, 0];
    this.thrusts = [0, 0, 0, 0];
    this.integ = new THREE.Vector3();
    this.prevGyro = new THREE.Vector3();
    this.dFilt = new THREE.Vector3();
    this.setpoint = new THREE.Vector3();
    this.prevSetpoint = new THREE.Vector3();
    this.ffFilt = new THREE.Vector3();
    this.spLpf = new THREE.Vector3();
    this.rc = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
    this.noise = new THREE.Vector3();
    this.washNoise = new THREE.Vector3();
    this.gust = new THREE.Vector3();
    this.wind = new THREE.Vector3();
    this.armed = false;
    this.crashed = false;
    this.crashTime = 0;
    this.flightTime = 0;
    this.mAhUsed = 0;
    this.voltage = 0;
    this.current = 0;
    this.groundDist = 10;
    this.propwashLevel = 0;
    this.lastImpact = 0;
    this.lastForce = new THREE.Vector3();
    this.turtle = false;
    this.events = [];
    this.createBody();
    this.respawn();
  }

  get p() { return this.settings.data.drone; }

  createBody() {
    const p = this.p;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setCcdEnabled(true)
      .setLinearDamping(0)
      .setAngularDamping(0)
      .setCanSleep(false);
    this.body = this.world.createRigidBody(desc);
    this.applyMassProps();
    this.rebuildCollider();
    this.builtSize = p.size;
  }

  applyMassProps() {
    const p = this.p;
    this.body.setAdditionalMassProperties(
      p.mass, { x: 0, y: 0, z: 0 },
      { x: p.inertiaPitch, y: p.inertiaYaw, z: p.inertiaRoll },
      { x: 0, y: 0, z: 0, w: 1 }, true,
    );
  }

  rebuildCollider() {
    const p = this.p;
    const w = this.settings.data.world;
    if (this.collider) this.world.removeCollider(this.collider, false);
    const desc = RAPIER.ColliderDesc.cuboid(p.size, Math.max(0.012, p.size * 0.28), p.size)
      .setDensity(0)
      .setFriction(w.friction)
      .setRestitution(w.restitution);
    this.collider = this.world.createCollider(desc, this.body);
    this.builtSize = p.size;
  }

  /** Reaplica parâmetros que exigem mexer no Rapier (chamado quando configurações mudam). */
  refreshParams() {
    this.applyMassProps();
    if (this.builtSize !== this.p.size) this.rebuildCollider();
    const w = this.settings.data.world;
    this.collider.setFriction(w.friction);
    this.collider.setRestitution(w.restitution);
  }

  respawn() {
    const { pos, yaw } = this.spawn;
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.motor.fill(0);
    this.motorCmd.fill(0);
    this.integ.set(0, 0, 0);
    this.prevGyro.set(0, 0, 0);
    this.dFilt.set(0, 0, 0);
    this.prevSetpoint.set(0, 0, 0);
    this.ffFilt.set(0, 0, 0);
    this.spLpf.set(0, 0, 0);
    this.armed = false;
    this.crashed = false;
    this.flightTime = 0;
    if (this.settings.data.battery.resetOnRespawn || this.mAhUsed > this.p.capacity) this.mAhUsed = 0;
    this.events.push('respawn');
  }

  tryArm(throttle) {
    if (this.armed) { this.armed = false; this.events.push('disarm'); return true; }
    if (this.settings.data.input.armSafety && throttle > 0.06) { this.events.push('armBlocked'); return false; }
    this.armed = true;
    this.crashed = false;
    this.integ.set(0, 0, 0);
    this.events.push('arm');
    return true;
  }

  crash(impact) {
    const mode = this.settings.data.world.crashMode;
    if (mode === 'none') return;
    this.crashed = true;
    this.crashTime = 0;
    this.armed = false;
    this.events.push('crash');
    this.lastImpact = impact;
  }

  /** Um passo da controladora + motores + aerodinâmica; aplica forças no corpo. */
  update(h, sticks, held) {
    const p = this.p;
    const fc = this.settings.data.fc;
    const r = this.settings.data.rates;
    const w = this.settings.data.world;
    const b = this.body;

    const rot = b.rotation();
    _q.set(rot.x, rot.y, rot.z, rot.w);
    _qi.copy(_q).invert();
    const av = b.angvel();
    const gyro = _w.set(av.x, av.y, av.z).applyQuaternion(_qi); // rad/s no corpo
    if (fc.gyroNoise > 0) {
      const n = fc.gyroNoise * 0.6 * (0.2 + this.avgMotor());
      gyro.x += (Math.random() - 0.5) * n; gyro.y += (Math.random() - 0.5) * n; gyro.z += (Math.random() - 0.5) * n;
    }
    const lv = b.linvel();

    // --- RC smoothing ---------------------------------------------------
    const ra = lpfAlpha(fc.rcSmoothing, h);
    const rc = this.rc;
    rc.throttle += (sticks.throttle - rc.throttle) * ra;
    rc.roll += (sticks.roll - rc.roll) * ra;
    rc.pitch += (sticks.pitch - rc.pitch) * ra;
    rc.yaw += (sticks.yaw - rc.yaw) * ra;

    // --- Setpoint (rad/s no corpo) ---------------------------------------
    const rollRate = stickToRate(rc.roll, 'roll', r) * DEG;
    const pitchRate = stickToRate(rc.pitch, 'pitch', r) * DEG;
    const yawRate = stickToRate(rc.yaw, 'yaw', r) * DEG;
    const sp = this.setpoint.set(-pitchRate, -yawRate, -rollRate);

    if (fc.mode !== 'acro') {
      _up.set(0, 1, 0).applyQuaternion(_q);
      _fw.set(0, 0, -1).applyQuaternion(_q);
      _rt.set(1, 0, 0).applyQuaternion(_q);
      const pitchAng = Math.asin(THREE.MathUtils.clamp(_fw.y, -1, 1));      // nariz pra cima +
      const rollAng = -Math.asin(THREE.MathUtils.clamp(_rt.y, -1, 1));      // direita +
      const lim = fc.angleLimit * DEG;
      let tRoll = rc.roll * lim, tPitch = -rc.pitch * lim;
      let eRoll = tRoll - rollAng, ePitch = tPitch - pitchAng;
      if (_up.y < 0) { eRoll = Math.sign(eRoll || 1) * Math.PI * 0.5; } // de cabeça pra baixo: força a recuperar
      const lx = ePitch * fc.angleStrength, lz = -eRoll * fc.angleStrength;
      if (fc.mode === 'angle') { sp.x = lx; sp.z = lz; }
      else {
        const f = 1 - Math.min(1, Math.max(Math.abs(rc.roll), Math.abs(rc.pitch)));
        sp.x = sp.x * (1 - f) + lx * f; sp.z = sp.z * (1 - f) + lz * f;
      }
    }

    // --- PID --------------------------------------------------------------
    const kGrp = REF_G_RP / this.torqueGainRP();
    const kGy = REF_G_YAW / this.torqueGainYaw();
    const kp = [fc.pRP * KP * kGrp, fc.pYaw * KP * kGy, fc.pRP * KP * kGrp];
    const ki = [fc.iRP * KI * kGrp, fc.iYaw * KI * kGy, fc.iRP * KI * kGrp];
    const kd = [fc.dRP * KD * kGrp, (fc.dYaw ?? 0) * KD * kGy, fc.dRP * KD * kGrp];
    const kff = [fc.ffRP * KFF * kGrp, fc.ffYaw * KFF * kGy * 1.6, fc.ffRP * KFF * kGrp];
    const ra15 = lpfAlpha(15, h);
    const da = lpfAlpha(fc.dtermLpf, h);
    const fa = lpfAlpha(40, h);
    const u = _t; // reaproveita vetor
    const throttleIn = throttleCurve(rc.throttle, r.throttleMid, r.throttleExpo, r.throttleLimit);
    const integrate = this.armed && (fc.airmode || throttleIn > 0.1);
    const comps = ['x', 'y', 'z'];
    for (let i = 0; i < 3; i++) {
      const c = comps[i];
      const err = sp[c] - gyro[c];
      // I-term relax (como no Betaflight): não acumula integral enquanto o setpoint muda rápido
      this.spLpf[c] += (sp[c] - this.spLpf[c]) * ra15;
      const relax = Math.max(0, 1 - Math.abs(sp[c] - this.spLpf[c]) / 0.7);
      if (integrate) this.integ[c] = THREE.MathUtils.clamp(this.integ[c] + err * ki[i] * h * relax, -0.25, 0.25);
      else this.integ[c] *= 0.98;
      const dRaw = -(gyro[c] - this.prevGyro[c]) / h;
      this.dFilt[c] += (dRaw - this.dFilt[c]) * da;
      const ffRaw = (sp[c] - this.prevSetpoint[c]) / h;
      this.ffFilt[c] += (ffRaw - this.ffFilt[c]) * fa;
      u[c] = kp[i] * err + this.integ[c] + kd[i] * this.dFilt[c] + kff[i] * this.ffFilt[c];
    }
    this.prevGyro.copy(gyro);
    this.prevSetpoint.copy(sp);
    if (this.trace && this.trace.length < this.traceMax) {
      this.trace.push([+(sp.x * 57.3).toFixed(1), +(gyro.x * 57.3).toFixed(1), +(sp.y * 57.3).toFixed(1), +(gyro.y * 57.3).toFixed(1), +(sp.z * 57.3).toFixed(1), +(gyro.z * 57.3).toFixed(1)]);
    }

    // --- Mixer (espaço de empuxo, com saturação estilo airmode) -----------
    const mix = [0, 0, 0, 0];
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < 4; i++) {
      const m = MOTORS[i];
      // pitch: motores da frente (z<0) levantam o nariz; roll: motores da direita rolam pra esquerda
      mix[i] = u.x * (-m.z) + u.z * m.x + u.y * (-m.spin);
      mn = Math.min(mn, mix[i]); mx = Math.max(mx, mix[i]);
    }
    const range = mx - mn;
    if (range > 1) { for (let i = 0; i < 4; i++) mix[i] /= range; mn /= range; mx /= range; }
    const idle = fc.motorIdle;
    const thrCmd = idle + (1 - idle) * throttleIn;
    let base = thrCmd * thrCmd; // comando ~ rpm, empuxo ~ rpm²
    if (fc.airmode) base = THREE.MathUtils.clamp(base, Math.max(-mn, idle * idle), 1 - mx);
    else { const s = Math.min(1, throttleIn * 4); for (let i = 0; i < 4; i++) mix[i] *= s; }

    const turtle = this.turtle = !!held?.has('turtle') && !this.isFlying();
    for (let i = 0; i < 4; i++) {
      let cmd;
      if (!this.armed && !turtle) cmd = 0;
      else if (turtle) {
        const m = MOTORS[i];
        const dir = (sticks.roll * m.x - sticks.pitch * m.z);
        cmd = Math.max(0, dir) * 0.9;
      } else cmd = Math.sqrt(THREE.MathUtils.clamp(base + mix[i], 0, 1));
      this.motorCmd[i] = cmd;
      const tau = cmd > this.motor[i] ? p.motorTauUp : p.motorTauDown;
      this.motor[i] += (cmd - this.motor[i]) * (1 - Math.exp(-h / tau));
    }

    // --- Vento e ar relativo ----------------------------------------------
    _air.set(lv.x, lv.y, lv.z).sub(this.wind).applyQuaternion(_qi); // velocidade do ar no corpo
    const vAxial = _air.y;
    const horiz = Math.hypot(_air.x, _air.z);

    // --- Bateria -----------------------------------------------------------
    let battFactor = 1;
    const cells = Math.max(1, Math.round(p.cells));
    if (this.settings.data.battery.simulate) {
      let I = 0.4;
      for (let i = 0; i < 4; i++) I += p.motorMaxCurrent * Math.pow(this.motor[i], 2.5);
      const soc = 1 - this.mAhUsed / p.capacity;
      const ocv = cellVoltage(soc) * cells;
      const V = Math.max(ocv - I * p.internalResistance, cells * 2.8);
      this.current = I;
      this.voltage = V;
      this.mAhUsed += I * h / 3.6;
      battFactor = Math.min(1.08, Math.pow(V / (cells * 3.95), 2));
    } else {
      this.voltage = cells * 4.2; this.current = 0;
    }

    // --- Propwash / anel de vórtice ----------------------------------------
    const avg = this.avgMotor();
    const descent = THREE.MathUtils.smoothstep(-vAxial, 1.0, 5.0);
    const wash = descent * (1 - THREE.MathUtils.smoothstep(horiz, 3, 10)) * Math.min(1, avg * 2.2) * w.propwash;
    this.propwashLevel = wash;

    // --- Empuxo por motor -----------------------------------------------
    const ge = this.settings.data.world.groundEffect
      ? 1 / (1 - Math.min(0.25, Math.pow(p.propRadius / (4 * Math.max(this.groundDist, p.propRadius * 0.5)), 2)))
      : 1;
    const Tmax = thrustMax(p); // empuxo máximo por motor já com o multiplicador de potência
    const lever = p.armLength * Math.SQRT1_2;
    let total = 0;
    const torque = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      const m = MOTORS[i];
      const s = this.motor[i];
      const pitchSpeed = Math.max(p.propPitchSpeed * s, 0.5);
      const inflow = THREE.MathUtils.clamp(1 - vAxial / pitchSpeed, 0, 1.2);
      let F = Tmax * s * s * inflow * battFactor * ge * (1 - 0.25 * wash);
      if (turtle) F = -F * 0.6;
      this.thrusts[i] = F;
      total += F;
      torque.x += -m.z * lever * F;
      torque.z += m.x * lever * F;
      torque.y += -m.spin * p.yawTorqueRatio * Math.abs(F);
    }

    // turbulência do propwash (ruído correlacionado)
    if (wash > 0.01) {
      const k = 1 - Math.exp(-h * 40);
      this.washNoise.x += ((Math.random() - 0.5) * 2 - this.washNoise.x) * k;
      this.washNoise.y += ((Math.random() - 0.5) * 2 - this.washNoise.y) * k;
      this.washNoise.z += ((Math.random() - 0.5) * 2 - this.washNoise.z) * k;
      const amp = wash * Tmax * lever * 0.18;
      torque.x += this.washNoise.x * amp;
      torque.z += this.washNoise.z * amp;
      torque.y += this.washNoise.y * amp * 0.3;
    }
    torque.addScaledVector(gyro, -p.angularDrag);

    // --- Arrasto -------------------------------------------------------------
    const rho = w.airDensity;
    const force = _f.set(0, total, 0);
    force.x += -0.5 * rho * p.cdaSide * _air.x * Math.abs(_air.x);
    force.y += -0.5 * rho * p.cdaTop * _air.y * Math.abs(_air.y);
    force.z += -0.5 * rho * p.cdaFront * _air.z * Math.abs(_air.z);
    const rotorK = p.rotorDrag * Math.min(1.5, avg / 0.35);
    force.x += -rotorK * _air.x;
    force.z += -rotorK * _air.z;

    // --- Aplica no Rapier (mundo) ----------------------------------------
    force.applyQuaternion(_q);
    torque.applyQuaternion(_q);
    b.resetForces(true);
    b.resetTorques(true);
    b.addForce({ x: force.x, y: force.y, z: force.z }, true);
    b.addTorque({ x: torque.x, y: torque.y, z: torque.z }, true);
    this.lastForce.copy(force);
    this.preVel = _v.set(lv.x, lv.y, lv.z);
    this.preVelCopy = this.preVelCopy || new THREE.Vector3();
    this.preVelCopy.copy(this.preVel);
    if (this.armed) this.flightTime += h;
  }

  /** Depois do world.step(): detecta impactos comparando com a velocidade prevista. */
  afterStep(h) {
    const p = this.p;
    const g = this.settings.data.world.gravity;
    const lv = this.body.linvel();
    const pred = this.preVelCopy;
    const ex = pred.x + this.lastForce.x / p.mass * h;
    const ey = pred.y + (this.lastForce.y / p.mass - g) * h;
    const ez = pred.z + this.lastForce.z / p.mass * h;
    const impact = Math.hypot(lv.x - ex, lv.y - ey, lv.z - ez);
    if (impact > 1.2) this.events.push({ type: 'hit', impact });
    if (!this.crashed && impact > this.settings.data.world.crashThreshold && (this.armed || pred.length() > 3)) this.crash(impact);
  }

  updateWind(dt, time) {
    const w = this.settings.data.world;
    const dir = w.windDir * DEG;
    const base = _v.set(Math.sin(dir), 0, Math.cos(dir)).multiplyScalar(-w.windSpeed);
    const k = 1 - Math.exp(-dt * 0.8);
    const g = w.gustStrength * (w.windSpeed + 1);
    this.gust.x += ((Math.random() - 0.5) * 2 * g - this.gust.x) * k;
    this.gust.y += ((Math.random() - 0.5) * 0.6 * g - this.gust.y) * k;
    this.gust.z += ((Math.random() - 0.5) * 2 * g - this.gust.z) * k;
    // perto do chão o vento é mais fraco (camada limite)
    const hFactor = THREE.MathUtils.clamp(Math.log1p(Math.max(this.groundDist, 0)) / Math.log1p(20), 0.25, 1.2);
    this.wind.copy(base).add(this.gust).multiplyScalar(hFactor);
  }

  avgMotor() { return (this.motor[0] + this.motor[1] + this.motor[2] + this.motor[3]) * 0.25; }
  torqueGainRP() { const p = this.p; return 4 * p.armLength * Math.SQRT1_2 * thrustMax(p) / ((p.inertiaPitch + p.inertiaRoll) * 0.5); }
  torqueGainYaw() { const p = this.p; return 4 * p.yawTorqueRatio * thrustMax(p) / p.inertiaYaw; }
  speed() { const v = this.body.linvel(); return Math.hypot(v.x, v.y, v.z); }
  isFlying() { return this.speed() > 1.0 || this.avgMotor() > 0.3; }

  position(out) { const t = this.body.translation(); return out.set(t.x, t.y, t.z); }
  quaternion(out) { const r = this.body.rotation(); return out.set(r.x, r.y, r.z, r.w); }

  dispose() {
    this.world.removeRigidBody(this.body);
  }
}
