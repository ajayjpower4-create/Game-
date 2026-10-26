// Every sound is synthesized with WebAudio: no audio files to load.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.8;
    this.loops = {};
  }
  // Browsers only allow audio after a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.noiseBuf = this.makeNoise(2);
    this.brownBuf = this.makeNoise(4, true);
    this.buildEngine();
    this.buildLoops();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  makeNoise(seconds, brown = false) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  noise(brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brownBuf : this.noiseBuf;
    s.loop = true;
    return s;
  }

  // Diesel engine: two detuned pulse-ish oscillators + rumble noise through a lowpass.
  buildEngine() {
    const c = this.ctx;
    const e = {};
    e.gain = c.createGain(); e.gain.gain.value = 0;
    e.filter = c.createBiquadFilter(); e.filter.type = 'lowpass'; e.filter.frequency.value = 400; e.filter.Q.value = 1.5;
    e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
    e.o2 = c.createOscillator(); e.o2.type = 'square';
    e.g1 = c.createGain(); e.g1.gain.value = 0.32;
    e.g2 = c.createGain(); e.g2.gain.value = 0.16;
    e.n = this.noise(true);
    e.ng = c.createGain(); e.ng.gain.value = 0.5;
    e.o1.connect(e.g1).connect(e.filter);
    e.o2.connect(e.g2).connect(e.filter);
    e.n.connect(e.ng).connect(e.filter);
    e.filter.connect(e.gain).connect(this.master);
    e.o1.start(); e.o2.start(); e.n.start();
    this.engine = e;
  }
  // rpm 600..3200, load 0..1, kind 'diesel'|'car'
  setEngine(on, rpm = 700, load = 0, kind = 'diesel', vol = 1) {
    if (!this.ctx) return;
    const e = this.engine, t = this.ctx.currentTime;
    const base = kind === 'diesel' ? rpm / 60 * 3 : rpm / 60 * 2;
    e.o1.frequency.setTargetAtTime(base, t, 0.05);
    e.o2.frequency.setTargetAtTime(base * (kind === 'diesel' ? 0.5 : 1.01), t, 0.05);
    e.filter.frequency.setTargetAtTime((kind === 'diesel' ? 220 : 500) + load * 900 + rpm * 0.12, t, 0.08);
    e.gain.gain.setTargetAtTime(on ? (0.11 + load * 0.12) * vol : 0, t, 0.1);
  }

  buildLoops() {
    const c = this.ctx;
    const mk = (name, src, filterType, freq, q, vol) => {
      const g = c.createGain(); g.gain.value = 0;
      const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      src.connect(f).connect(g).connect(this.master);
      src.start?.();
      this.loops[name] = { g, f, src, vol };
    };
    mk('rain', this.noise(), 'highpass', 900, 0.3, 0.16);
    mk('wind', this.noise(true), 'lowpass', 500, 0.5, 0.2);
    mk('city', this.noise(true), 'lowpass', 260, 0.4, 0.12);
    const hyd = c.createOscillator(); hyd.type = 'sawtooth'; hyd.frequency.value = 95;
    mk('hydraulic', hyd, 'lowpass', 600, 2, 0.08);
    const hydN = this.noise(); mk('hydraulicHiss', hydN, 'bandpass', 2500, 1, 0.05);
    const winch = c.createOscillator(); winch.type = 'sawtooth'; winch.frequency.value = 160;
    mk('winch', winch, 'bandpass', 900, 3, 0.09);
    const drill = c.createOscillator(); drill.type = 'square'; drill.frequency.value = 38;
    mk('drill', drill, 'lowpass', 1800, 1, 0.12);
    const strain = this.noise(true); mk('strain', strain, 'lowpass', 180, 1, 0.3);
  }
  setLoop(name, level, freq) {
    if (!this.ctx || !this.loops[name]) return;
    const l = this.loops[name], t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(level * l.vol, t, 0.08);
    if (freq !== undefined) {
      if (l.src.frequency) l.src.frequency.setTargetAtTime(freq, t, 0.05);
      else l.f.frequency.setTargetAtTime(freq, t, 0.05);
    }
  }

  // ------------------------------------------------------- one-shots
  tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.005, release = 0.05, at = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  burst(dur, { freq = 2000, type = 'bandpass', q = 1, vol = 0.3, at = 0, decay = true } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = dur > 1.5;   // the buffer is 2 s long
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    if (decay) g.gain.exponentialRampToValueAtTime(0.001, t + dur); else g.gain.setValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  thump(vol = 0.5, freq = 70) { this.tone(freq, 0.18, { type: 'sine', vol, slide: -30 }); this.burst(0.08, { freq: 400, type: 'lowpass', vol: vol * 0.5 }); }
  click() { this.burst(0.03, { freq: 3500, q: 4, vol: 0.25 }); }
  button() { this.tone(1800, 0.04, { type: 'square', vol: 0.05 }); this.burst(0.02, { freq: 4000, vol: 0.1 }); }
  ratchet() {
    for (let i = 0; i < 3; i++) this.burst(0.025, { freq: 3000 + i * 400, q: 6, vol: 0.35, at: i * 0.045 });
    this.tone(220, 0.08, { type: 'triangle', vol: 0.08, at: 0.12 });
  }
  crunch() {
    for (let i = 0; i < 5; i++) this.burst(0.04 + Math.random() * 0.03, { freq: 1500 + Math.random() * 3000, q: 0.8, vol: 0.25, at: i * 0.06 + Math.random() * 0.03 });
  }
  bagRustle() { for (let i = 0; i < 4; i++) this.burst(0.08, { freq: 5000, type: 'highpass', vol: 0.12, at: i * 0.07 }); }
  dispatch() {
    this.tone(880, 0.16, { type: 'square', vol: 0.08 });
    this.tone(1320, 0.22, { type: 'square', vol: 0.08, at: 0.18 });
    this.tone(880, 0.16, { type: 'square', vol: 0.08, at: 0.45 });
    this.tone(1320, 0.22, { type: 'square', vol: 0.08, at: 0.63 });
    this.burst(0.5, { freq: 1500, q: 0.5, vol: 0.05, at: 0.9, decay: false });
  }
  radioChatter(dur = 1.4) {
    if (!this.ctx) return;
    for (let t = 0; t < dur; t += 0.09) this.burst(0.08, { freq: 900 + Math.random() * 1400, q: 2, vol: 0.06 + Math.random() * 0.05, at: t });
    this.tone(1000, 0.05, { type: 'square', vol: 0.05, at: dur + 0.05 });
  }
  beep() { this.tone(1046, 0.38, { type: 'square', vol: 0.07 }); }
  horn(on) {
    if (!this.ctx) return;
    if (on && !this.hornNodes) {
      const c = this.ctx;
      const g = c.createGain(); g.gain.value = 0.12;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 311;
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 370;
      o1.connect(f); o2.connect(f); f.connect(g).connect(this.master);
      o1.start(); o2.start();
      this.hornNodes = { o1, o2, g };
    } else if (!on && this.hornNodes) {
      const { o1, o2, g } = this.hornNodes;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      o1.stop(this.ctx.currentTime + 0.2); o2.stop(this.ctx.currentTime + 0.2);
      this.hornNodes = null;
    }
  }
  thunder(delay = 1) {
    if (!this.ctx) return;
    this.burst(3.5, { freq: 120, type: 'lowpass', q: 0.7, vol: 0.9, at: delay });
    this.burst(1.2, { freq: 400, type: 'lowpass', vol: 0.4, at: delay });
  }
  starter() {
    for (let i = 0; i < 6; i++) this.tone(55 + (i % 2) * 8, 0.12, { type: 'sawtooth', vol: 0.12, at: i * 0.13 });
  }
  clank() { this.tone(240, 0.25, { type: 'triangle', vol: 0.15, slide: -60 }); this.burst(0.05, { freq: 2500, q: 3, vol: 0.2 }); }
  pop() { this.tone(180, 0.1, { type: 'sine', vol: 0.25, slide: -100 }); this.burst(0.06, { freq: 900, vol: 0.2 }); }
  cash() { this.tone(1568, 0.08, { type: 'square', vol: 0.06 }); this.tone(2093, 0.25, { type: 'square', vol: 0.06, at: 0.08 }); }
  tick() { this.burst(0.015, { freq: 2500, q: 5, vol: 0.18 }); }
}
