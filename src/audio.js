// Som sintetizado (WebAudio): zumbido dos motores ligado ao rpm, vento e efeitos.
export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
  }

  /** Precisa ser chamado num gesto do usuário (clique/botão) por causa das regras do navegador. */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // motores: 2 serras levemente desafinadas + harmônico quadrado, passando por um passa-baixa
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.Q.value = 2;
    this.motorFilter.connect(this.motorGain);
    this.motorGain.connect(this.master);
    this.oscs = [];
    for (const [type, mul, gain] of [['sawtooth', 1, 0.5], ['sawtooth', 1.013, 0.4], ['square', 0.5, 0.15], ['triangle', 2, 0.25]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 100;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.motorFilter);
      o.start();
      this.oscs.push({ o, mul });
    }
    // ruído (hélices + vento)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const mkNoise = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return { f, g };
    };
    this.prop = mkNoise('bandpass', 900, 0.8);
    this.wind = mkNoise('lowpass', 400, 0.5);
    this.noiseBuf = buf;
  }

  update(drone, paused) {
    if (!this.ctx) return;
    const a = this.settings.data.audio;
    const t = this.ctx.currentTime;
    const vol = paused ? 0 : a.volume;
    this.master.gain.setTargetAtTime(vol, t, 0.05);
    if (!drone) return;
    const s = drone.avgMotor();
    const spread = Math.max(...drone.motor) - Math.min(...drone.motor);
    const blades = 3;
    const rpmHz = (s * 32000 / 60) * blades * (drone.p.armLength > 0.14 ? 0.7 : drone.p.armLength < 0.05 ? 2.2 : 1);
    const f0 = 40 + rpmHz;
    for (const { o, mul } of this.oscs) o.frequency.setTargetAtTime(f0 * mul * (1 + spread * 0.08), t, 0.02);
    this.motorFilter.frequency.setTargetAtTime(400 + s * 5000, t, 0.03);
    const on = a.motor && s > 0.01;
    this.motorGain.gain.setTargetAtTime(on ? 0.05 + 0.22 * Math.min(1, s * 1.6) : 0, t, 0.03);
    this.prop.f.frequency.setTargetAtTime(500 + s * 2500, t, 0.05);
    this.prop.g.gain.setTargetAtTime(on ? 0.05 * s + 0.15 * drone.propwashLevel : 0, t, 0.05);
    const v = drone.speed();
    this.wind.f.frequency.setTargetAtTime(200 + v * 25, t, 0.1);
    this.wind.g.gain.setTargetAtTime(a.wind ? Math.min(0.35, v * v * 0.00035) : 0, t, 0.1);
  }

  beep(freq = 1800, dur = 0.08, count = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * dur * 1.6);
      g.gain.linearRampToValueAtTime(0.08, t + i * dur * 1.6 + 0.005);
      g.gain.linearRampToValueAtTime(0, t + i * dur * 1.6 + dur);
      o.connect(g).connect(this.master);
      o.start(t + i * dur * 1.6);
      o.stop(t + i * dur * 1.6 + dur + 0.02);
    }
  }

  crash(intensity = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.6, 0.15 + intensity * 0.03), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }
}
