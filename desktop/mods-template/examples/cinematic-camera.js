/* Example mod: a slow cinematic orbit around the site. Press O to start or
 * stop it, and [ or ] to change its speed. Copy this file up one folder (into
 * "mods") to use it. */

const S = window.BuildingSim;
const controls = S.engine.controls;
let speed = 0.6;

window.addEventListener('keydown', (ev) => {
  if (ev.target.closest && ev.target.closest('input, textarea, select')) return;
  if (ev.key === 'o' || ev.key === 'O') {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = speed;
    S.hint(controls.autoRotate ? 'Cinematic orbit on — O to stop, [ ] for speed' : 'Cinematic orbit off');
  } else if ((ev.key === '[' || ev.key === ']') && controls.autoRotate) {
    speed = Math.max(0.1, Math.min(4, speed * (ev.key === ']' ? 1.4 : 1 / 1.4)));
    controls.autoRotateSpeed = speed;
    S.hint(`Orbit speed ${speed.toFixed(2)}`);
  }
});

// OrbitControls only turns on its own while the frame loop updates it, which
// the game does every frame in orbit mode, so nothing else is needed.
S.hint('Cinematic camera mod loaded — press O');
