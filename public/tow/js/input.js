// Keyboard + mouse with pointer lock. `pressed` / `released` are edge
// triggers cleared once per frame by endFrame().
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], wheel: 0 };
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 1;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (this.locked && ['Space', 'Tab', 'F1', 'KeyF'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = [false, false, false]; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.enabled && this.wantLock) { this.requestLock(); return; }
      this.mouse.down[e.button] = true;
      this.mouse.pressed[e.button] = true;
    });
    addEventListener('mouseup', (e) => {
      if (this.mouse.down[e.button]) this.mouse.released[e.button] = true;
      this.mouse.down[e.button] = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
  }
  requestLock() {
    try { const p = this.canvas.requestPointerLock({ unadjustedMovement: false }); p?.catch?.(() => this.canvas.requestPointerLock()); } catch { this.canvas.requestPointerLock(); }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  consumeMouse() {
    const d = { dx: this.mouse.dx * this.sensitivity, dy: this.mouse.dy * this.sensitivity };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return d;
  }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.pressed = [false, false, false];
    this.mouse.released = [false, false, false];
    this.mouse.wheel = 0;
  }
}
