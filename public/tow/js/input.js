// Keyboard, mouse and pointer lock.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();     // edge-triggered, cleared every frame
  const mouse = { dx: 0, dy: 0, down: false, downEdge: false, upEdge: false, wheel: 0, held: 0 };
  let locked = false;
  let enabled = true;

  const CODE_ALIAS = {
    ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD',
  };

  function onKeyDown(e) {
    if (!enabled) return;
    const code = CODE_ALIAS[e.code] || e.code;
    if (!keys.has(code)) pressed.add(code);
    keys.add(code);
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab'].includes(code)) e.preventDefault();
  }
  function onKeyUp(e) {
    const code = CODE_ALIAS[e.code] || e.code;
    keys.delete(code);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!enabled) return;
    if (e.button === 0) { mouse.down = true; mouse.downEdge = true; mouse.held = 0; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { mouse.down = false; mouse.upEdge = true; }
  });
  canvas.addEventListener('mousemove', (e) => {
    if (locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  canvas.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('click', () => {
    if (enabled && !locked) canvas.requestPointerLock?.();
  });

  return {
    keys,
    mouse,
    get locked() { return locked; },
    setEnabled(v) {
      enabled = v;
      if (!v) { keys.clear(); mouse.down = false; if (locked) document.exitPointerLock?.(); }
    },
    lock() { canvas.requestPointerLock?.(); },
    unlock() { if (locked) document.exitPointerLock?.(); },
    down(code) { return keys.has(code); },
    justPressed(code) { return pressed.has(code); },
    axis(neg, pos) { return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0); },
    endFrame(dt) {
      pressed.clear();
      mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0;
      mouse.downEdge = false; mouse.upEdge = false;
      if (mouse.down) mouse.held += dt; else mouse.held = 0;
    },
  };
}
