// Keyboard / mouse state with pointer lock. Gameplay modules poll held keys
// and subscribe to presses; UI panels set `blocked` to take the input over.

import { bus } from "./events.js";

class Input {
  constructor() {
    this.down = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, buttons: new Set() };
    this.blocked = false;
    this.locked = false;
    this.canvas = null;
    this.wantLock = false;
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const code = e.code;
      if (["Tab", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "F1", "F5"].includes(code)) e.preventDefault();
      if (!this.down.has(code)) {
        this.down.add(code);
        bus.emit("key", code, e);
      }
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      bus.emit("keyup", e.code, e);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.mouse.buttons.clear();
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.wantLock && !this.locked && !this.blocked) this.lock();
      this.mouse.buttons.add(e.button);
      bus.emit("mouse", e.button, e);
    });
    window.addEventListener("mouseup", (e) => {
      this.mouse.buttons.delete(e.button);
      bus.emit("mouseup", e.button, e);
    });
    window.addEventListener("mousemove", (e) => {
      if (this.locked || this.mouse.buttons.has(2)) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    canvas.addEventListener("wheel", (e) => {
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      bus.emit("pointerlock", this.locked);
    });
  }

  lock() {
    if (!this.canvas || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
    } catch {
      this.canvas.requestPointerLock();
    }
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  held(code) {
    return !this.blocked && this.down.has(code);
  }
  button(b) {
    return !this.blocked && this.mouse.buttons.has(b);
  }
  takeMouse() {
    const d = { dx: this.mouse.dx, dy: this.mouse.dy, wheel: this.mouse.wheel };
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
    return d;
  }
}

export const input = new Input();
