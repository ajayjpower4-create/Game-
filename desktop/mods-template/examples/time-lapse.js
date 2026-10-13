/* Example mod: a time-lapse. Press H to run the clock at an hour every two
 * seconds and watch the light change; press H again to stop. Copy this file
 * up one folder (into "mods") to use it. */

const S = window.BuildingSim;
let on = false;

window.addEventListener('keydown', (ev) => {
  if (ev.target.closest && ev.target.closest('input, textarea, select')) return;
  if (ev.key === 'h' || ev.key === 'H') {
    on = !on;
    S.hint(on ? 'Time-lapse on — H to stop' : 'Time-lapse off');
  }
});

S.onTick((dt) => {
  if (!on) return;
  const env = S.state.env;
  env.hour = (env.hour + dt * 0.5) % 24;
  S.engine.setEnv({ hour: env.hour });
});
