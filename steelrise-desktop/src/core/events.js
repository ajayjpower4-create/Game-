// Minimal event bus shared by the simulation, renderer and UI.

export class Emitter {
  constructor() {
    this.handlers = new Map();
  }
  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
    return () => this.handlers.get(name).delete(fn);
  }
  emit(name, ...args) {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (e) {
        console.error(`[STEELRISE] handler for ${name} failed`, e);
      }
    }
  }
}

export const bus = new Emitter();

let uid = 0;
export function newId(prefix = "C") {
  uid = (uid + 1) % 1e9;
  return prefix + Date.now().toString(36).slice(-5) + (Math.random() * 1e8).toString(36).slice(0, 4) + uid.toString(36);
}
