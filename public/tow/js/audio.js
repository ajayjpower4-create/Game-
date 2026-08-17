// Everything you hear is synthesised — no asset downloads, no CDN.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let rainNode = null;
  let enabled = true;
  let started = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.2, sweep = 0, delay = 0 } = {}) {
    if (!enabled) return;
    ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { gain = 0.2, filter = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
    if (!enabled) return;
    ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = type; bp.frequency.value = filter; bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
  }

  const api = {
    resume,
    get started() { return started; },
    setVolume(v) { ensure(); if (master) master.gain.value = v; },
    startEngine() {
      ensure(); if (!ctx || engine) return;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 27;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = 0.0;
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
      o1.start(); o2.start();
      engine = { o1, o2, g, lp };
    },
    stopEngine() {
      if (!engine) return;
      engine.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    engineState(rpm, load) {
      if (!engine || !ctx) return;
      const f = 32 + rpm * 78;
      engine.o1.frequency.setTargetAtTime(f, ctx.currentTime, 0.06);
      engine.o2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.06);
      engine.lp.frequency.setTargetAtTime(240 + rpm * 900, ctx.currentTime, 0.1);
      engine.g.gain.setTargetAtTime(0.045 + load * 0.05, ctx.currentTime, 0.15);
    },
    startRain(intensity) {
      ensure(); if (!ctx || rainNode) return;
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0.02 * intensity;
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start();
      rainNode = { src, g };
    },
    stopRain() { if (rainNode) { rainNode.g.gain.value = 0; rainNode.src.stop(); rainNode = null; } },
    beep() { tone(880, 0.09, { type: 'square', gain: 0.12 }); },
    call() {
      tone(660, 0.13, { type: 'square', gain: 0.14 });
      tone(880, 0.13, { type: 'square', gain: 0.14, delay: 0.16 });
      tone(1100, 0.2, { type: 'square', gain: 0.14, delay: 0.32 });
    },
    accept() { tone(520, 0.1, { gain: 0.16 }); tone(780, 0.16, { gain: 0.16, delay: 0.1 }); },
    deny() { tone(220, 0.22, { type: 'sawtooth', gain: 0.12, sweep: -80 }); },
    click() { noise(0.03, { gain: 0.25, filter: 2600, q: 2 }); },
    ratchet() { noise(0.05, { gain: 0.3, filter: 1800, q: 6 }); },
    winch(on) {
      if (on) tone(180, 0.35, { type: 'sawtooth', gain: 0.06, sweep: 20 });
    },
    hydraulic() { noise(0.5, { gain: 0.12, filter: 500, q: 0.7 }); },
    thud() { noise(0.25, { gain: 0.35, filter: 140, q: 1, type: 'lowpass' }); tone(70, 0.2, { type: 'sine', gain: 0.25 }); },
    clunk() { noise(0.12, { gain: 0.3, filter: 320, q: 2 }); },
    crunch() { noise(0.18, { gain: 0.22, filter: 3200, q: 1.2 }); },
    drill(on) { if (on) tone(420, 0.2, { type: 'square', gain: 0.05, sweep: 60 }); },
    jumpstart() {
      noise(0.4, { gain: 0.2, filter: 200, q: 1 });
      tone(90, 0.6, { type: 'sawtooth', gain: 0.1, sweep: 240, delay: 0.2 });
    },
    horn() { tone(370, 0.5, { type: 'sawtooth', gain: 0.2 }); tone(440, 0.5, { type: 'sawtooth', gain: 0.16 }); },
    cash() {
      [660, 880, 1320].forEach((f, i) => tone(f, 0.14, { gain: 0.14, delay: i * 0.09 }));
    },
    thunder() { noise(1.6, { gain: 0.3, filter: 160, q: 0.6, type: 'lowpass' }); },
  };
  return api;
}
