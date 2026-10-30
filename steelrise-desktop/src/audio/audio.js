// Procedural sound: every effect is synthesised with Web Audio at runtime
// (no audio files ship with the game). One-shots are positional; machinery
// runs as loops whose level and pitch follow the simulation.

import { Config } from "../core/config.js";
import { bus } from "../core/events.js";

let ctx = null;
const groups = {};
let master = null;
let noiseBuf = null;
let listener = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  for (const g of Config.AudioGroups) {
    if (g === "Master") continue;
    groups[g] = ctx.createGain();
    groups[g].connect(master);
  }
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  listener = ctx.listener;
  return ctx;
}

export function setVolumes(vol) {
  if (!ensure()) return;
  master.gain.value = vol.Master ?? 0.8;
  for (const k in groups) groups[k].gain.value = vol[k] ?? 0.8;
}

export function running() {
  return !!ctx && ctx.state === "running";
}

export function resume() {
  if (ensure() && ctx.state !== "running") ctx.resume();
}

export function setListener(pos, fwd, up) {
  if (!ctx) return;
  const L = listener;
  if (L.positionX) {
    L.positionX.value = pos.x;
    L.positionY.value = pos.y;
    L.positionZ.value = pos.z;
    L.forwardX.value = fwd.x;
    L.forwardY.value = fwd.y;
    L.forwardZ.value = fwd.z;
    L.upX.value = up.x;
    L.upY.value = up.y;
    L.upZ.value = up.z;
  } else {
    L.setPosition(pos.x, pos.y, pos.z);
    L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
  }
}

function out(group, pos, ref = 6) {
  const g = groups[group] || master;
  if (!pos) return g;
  const p = ctx.createPanner();
  p.panningModel = "HRTF";
  p.distanceModel = "inverse";
  p.refDistance = ref;
  p.maxDistance = 400;
  p.rolloffFactor = 1.1;
  p.positionX.value = pos.x;
  p.positionY.value = pos.y;
  p.positionZ.value = pos.z;
  p.connect(g);
  return p;
}

function noise(dest, t0, dur, { type = "bandpass", freq = 1000, q = 1, gain = 0.5, attack = 0.005, decay = null, freqEnd = null } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + (decay ?? dur));
  src.connect(f).connect(g).connect(dest);
  src.start(t0, Math.random());
  src.stop(t0 + dur + 0.05);
}

function tone(dest, t0, dur, { type = "sine", freq = 440, freqEnd = null, gain = 0.3, attack = 0.002 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// metallic strike: inharmonic partials
function clang(dest, t0, base, gain, dur) {
  for (const [r, a] of [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.93, 0.18]]) tone(dest, t0, dur / r ** 0.3, { freq: base * r, gain: gain * a, type: "sine" });
  noise(dest, t0, 0.05, { freq: base * 4, q: 0.7, gain: gain * 0.6 });
}

const SOUNDS = {
  UIClick: (d, t) => tone(d, t, 0.06, { freq: 1600, freqEnd: 900, gain: 0.12, type: "triangle" }),
  UIHover: (d, t) => tone(d, t, 0.03, { freq: 2200, gain: 0.04, type: "sine" }),
  Notify: (d, t) => { tone(d, t, 0.12, { freq: 880, gain: 0.08 }); tone(d, t + 0.08, 0.16, { freq: 1320, gain: 0.07 }); },
  Warn: (d, t) => { tone(d, t, 0.14, { freq: 330, gain: 0.1, type: "square" }); },
  Step_Ground: (d, t) => noise(d, t, 0.12, { type: "lowpass", freq: 700, gain: 0.35, decay: 0.1 }),
  Step_Concrete: (d, t) => noise(d, t, 0.08, { freq: 1800, q: 0.8, gain: 0.3, decay: 0.07 }),
  Step_Metal: (d, t) => { noise(d, t, 0.07, { freq: 2600, q: 1.5, gain: 0.25 }); clang(d, t, 380 + Math.random() * 60, 0.06, 0.25); },
  Jump: (d, t) => noise(d, t, 0.1, { type: "lowpass", freq: 500, gain: 0.2 }),
  Land: (d, t) => noise(d, t, 0.25, { type: "lowpass", freq: 300, gain: 0.6 }),
  PickUp: (d, t) => { noise(d, t, 0.15, { freq: 900, gain: 0.3 }); clang(d, t + 0.02, 300, 0.06, 0.3); },
  Pickup: (d, t) => SOUNDS.PickUp(d, t),
  Drop: (d, t) => { noise(d, t, 0.3, { type: "lowpass", freq: 400, gain: 0.7 }); clang(d, t, 140, 0.15, 0.6); },
  Set: (d, t) => { noise(d, t, 0.35, { type: "lowpass", freq: 350, gain: 0.8 }); clang(d, t, 110, 0.2, 0.9); },
  Dismantle: (d, t) => { clang(d, t, 520, 0.12, 0.4); noise(d, t, 0.2, { freq: 3000, gain: 0.2 }); },
  Bolt: (d, t) => { // impact wrench final hammering
    for (let i = 0; i < 6; i++) noise(d, t + i * 0.035, 0.03, { freq: 2400, q: 2, gain: 0.35 });
    clang(d, t + 0.22, 900, 0.08, 0.2);
  },
  Wedge: (d, t) => clang(d, t, 760, 0.25, 0.5),
  Weld: (d, t) => noise(d, t, 0.25, { type: "highpass", freq: 3000, gain: 0.2 }),
  Screed: (d, t) => noise(d, t, 0.35, { type: "lowpass", freq: 900, gain: 0.25, attack: 0.08 }),
  Strap: (d, t) => { for (let i = 0; i < 5; i++) noise(d, t + i * 0.05, 0.04, { freq: 3200, q: 3, gain: 0.25 }); noise(d, t + 0.25, 0.3, { type: "bandpass", freq: 600, freqEnd: 200, gain: 0.3 }); },
  Rig: (d, t) => { for (let i = 0; i < 7; i++) clang(d, t + i * 0.06 + Math.random() * 0.02, 1400 + Math.random() * 600, 0.05, 0.12); },
  SlingRattle: (d, t) => SOUNDS.Rig(d, t),
  Unhook: (d, t) => { clang(d, t, 1100, 0.08, 0.2); clang(d, t + 0.08, 1300, 0.05, 0.2); },
  CraneBrake: (d, t) => { noise(d, t, 0.25, { type: "lowpass", freq: 250, gain: 0.5 }); clang(d, t, 90, 0.2, 0.4); },
  ContactLight: (d, t) => clang(d, t, 600, 0.25, 0.6),
  ContactHeavy: (d, t) => { clang(d, t, 180, 0.4, 1.2); noise(d, t, 0.3, { type: "lowpass", freq: 300, gain: 0.6 }); },
  AirBrake: (d, t) => noise(d, t, 0.9, { type: "highpass", freq: 2500, freqEnd: 5000, gain: 0.25, attack: 0.02 }),
  TruckArrive: (d, t) => tone(d, t, 0.5, { freq: 300, gain: 0.0001 }),
  Pour: (d, t) => noise(d, t, 1.5, { type: "lowpass", freq: 260, gain: 0.5, attack: 0.2 }),
  PourStart: (d, t) => noise(d, t, 2.5, { type: "lowpass", freq: 300, gain: 0.45, attack: 0.3 }),
  Toggle: (d, t) => { clang(d, t, 1800, 0.05, 0.08); noise(d, t, 0.05, { freq: 2000, gain: 0.1 }); },
};

export function play(name, pos, vol = 1) {
  if (!ensure() || ctx.state !== "running") return;
  const fn = SOUNDS[name];
  if (!fn) return;
  const group = name.startsWith("UI") || name === "Notify" || name === "Warn" ? "UI" : name.startsWith("Step") || name === "Jump" || name === "Land" ? "Footsteps" : ["Bolt", "Wedge", "Weld", "Screed"].includes(name) ? "Tools" : ["CraneBrake", "AirBrake", "Pour", "PourStart", "TruckArrive"].includes(name) ? "Machinery" : "Impacts";
  const dest = ctx.createGain();
  dest.gain.value = vol;
  dest.connect(out(group, pos));
  fn(dest, ctx.currentTime + 0.005);
}

// --- machinery loops ------------------------------------------------------------
// A loop: oscillators + filtered noise through a gain; set(level, pitch)
export class Loop {
  constructor(kind, group = "Machinery") {
    this.ok = !!ensure();
    if (!this.ok) return;
    this.level = 0;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.out = out(group, { x: 0, y: 0, z: 0 }, kind === "Ambience" ? 1000 : 10);
    this.panner = this.out.positionX ? this.out : null;
    this.gain.connect(this.out);
    this.nodes = [];
    const spec = LOOPS[kind];
    this.base = spec.base;
    for (const o of spec.osc || []) {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.value = spec.base * o.r;
      const g = ctx.createGain();
      g.gain.value = o.g;
      osc.connect(g).connect(this.gain);
      osc.start();
      this.nodes.push({ osc, r: o.r });
    }
    for (const n of spec.noise || []) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = n.type;
      f.frequency.value = n.freq;
      f.Q.value = n.q || 1;
      const g = ctx.createGain();
      g.gain.value = n.g;
      src.connect(f).connect(g).connect(this.gain);
      src.start(0, Math.random() * 1.5);
      this.nodes.push({ filter: f, fr: n.freq, src });
    }
    this.maxGain = spec.gain;
  }
  setPos(p) {
    if (this.panner) {
      this.panner.positionX.value = p.x;
      this.panner.positionY.value = p.y;
      this.panner.positionZ.value = p.z;
    }
  }
  set(level, pitch = 1) {
    if (!this.ok) return;
    level = Math.max(0, Math.min(1, level));
    const t = ctx.currentTime;
    this.gain.gain.setTargetAtTime(level * this.maxGain, t, 0.08);
    for (const n of this.nodes) {
      if (n.osc) n.osc.frequency.setTargetAtTime(this.base * n.r * pitch, t, 0.1);
      if (n.filter) n.filter.frequency.setTargetAtTime(n.fr * pitch, t, 0.1);
    }
  }
  stop() {
    if (!this.ok) return;
    this.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => {
      for (const n of this.nodes) {
        try {
          (n.osc || n.src).stop();
        } catch {}
      }
      this.gain.disconnect();
    }, 400);
  }
}

const LOOPS = {
  Slew: { base: 95, gain: 0.25, osc: [{ type: "sawtooth", r: 1, g: 0.25 }, { type: "sine", r: 2, g: 0.2 }], noise: [{ type: "bandpass", freq: 900, g: 0.25 }] },
  Trolley: { base: 140, gain: 0.2, osc: [{ type: "triangle", r: 1, g: 0.3 }, { type: "square", r: 3, g: 0.03 }], noise: [{ type: "bandpass", freq: 1500, g: 0.2 }] },
  Hoist: { base: 70, gain: 0.32, osc: [{ type: "sawtooth", r: 1, g: 0.3 }, { type: "sine", r: 4.1, g: 0.08 }], noise: [{ type: "lowpass", freq: 600, g: 0.4 }] },
  Engine: { base: 38, gain: 0.45, osc: [{ type: "sawtooth", r: 1, g: 0.4 }, { type: "square", r: 0.5, g: 0.2 }, { type: "sine", r: 2, g: 0.2 }], noise: [{ type: "lowpass", freq: 220, g: 0.5 }] },
  Generator: { base: 50, gain: 0.3, osc: [{ type: "sawtooth", r: 1, g: 0.3 }, { type: "sine", r: 3, g: 0.1 }], noise: [{ type: "lowpass", freq: 400, g: 0.3 }] },
  Weld: { base: 120, gain: 0.25, osc: [{ type: "sine", r: 1, g: 0.05 }], noise: [{ type: "highpass", freq: 2500, g: 0.6 }, { type: "bandpass", freq: 6000, g: 0.4, q: 2 }] },
  Impact: { base: 26, gain: 0.35, osc: [{ type: "square", r: 1, g: 0.2 }], noise: [{ type: "bandpass", freq: 2200, g: 0.6, q: 1.5 }] },
  Ambience: { base: 60, gain: 0.25, osc: [], noise: [{ type: "lowpass", freq: 380, g: 0.6 }, { type: "bandpass", freq: 900, g: 0.08, q: 0.5 }] },
};

// play one-shots from simulation events
export function initAudio() {
  bus.on("fx", (kind, pos) => {
    const map = { Pickup: "PickUp", Rig: "Rig", Set: "Set", Drop: "Drop", Dismantle: "Dismantle", Bolt: "Bolt", Wedge: "Wedge", Weld: "Weld", Screed: "Screed", Strap: "Strap", Unhook: "Unhook", CraneBrake: "CraneBrake", ContactLight: "ContactLight", ContactHeavy: "ContactHeavy", AirBrake: "AirBrake", Pour: "Pour", PourStart: "PourStart", Toggle: "Toggle", SlingRattle: "SlingRattle", Jump: "Jump", Land: "Land" };
    if (map[kind]) play(map[kind], pos);
  });
  bus.on("footstep", (pos, surface) => play("Step_" + (surface || "Ground"), pos, 0.8));
  bus.on("sfx", (name, pos) => play(name, pos));
  bus.on("notify", (text, kind) => play(kind === "warn" ? "Warn" : "Notify"));
}
