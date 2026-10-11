/* CCTV cameras: bullet, dome, turret and PTZ heads, the brackets that hold
 * them, and the cone of ground each one watches.
 *
 * Everything is built in a mount frame: the origin is where the camera fixes
 * to its wall or pole, +z is the way the mount faces, y is up. Tilt points a
 * camera down from level, pan swings it left or right of straight out. */

import * as THREE from 'three';
import { Builder, cylGeo, boxGeo } from './builder.js';
import * as M from './materials.js';

const DEG = Math.PI / 180;

/** Point head-frame geometry (aimed down +z) the way the camera looks, then move it. */
function aim(g, tilt, pan, at) {
  g.rotateX(tilt * DEG);
  g.rotateY(pan * DEG);
  g.translate(at[0], at[1], at[2]);
  return g;
}

const along = (g, z) => g.rotateX(Math.PI / 2).translate(0, 0, z);

/** The lens end of a camera: dark glass, and an IR ring that glows at night. */
function lens(B, r, z, { tilt, pan, at, ir }) {
  if (ir) B.add(aim(along(cylGeo(r * 1.2, r * 1.2, 0.03, 16), z), tilt, pan, at), M.lamp('#ff2a1f', 1.4));
  B.add(aim(along(cylGeo(r, r, 0.05, 16), z + 0.02), tilt, pan, at), M.vehicleGlass());
}

/**
 * Add a camera to B in the mount frame. Returns where its lens is and, for a
 * PTZ, the group that pans (so the caller can animate it).
 */
export function cameraHead(B, kind, { color = '#f2f3f4', tilt = 25, pan = 0, ir = true, cover = false, range = 90, wall = true } = {}) {
  const body = M.painted(color, 0.38);
  const dark = M.painted('#2b2f34', 0.5);
  const o = { tilt, pan, ir };
  switch (kind) {
    case 'dome': {
      // An arm out from the wall, a cap, and the smoked dome hanging under it.
      const reach = wall ? 1.1 : 0;
      if (wall) {
        B.box(body, 0.5, 0.7, 0.12, 0, 0, 0.06);
        B.box(body, 0.32, 0.26, reach, 0, 0, reach / 2);
      }
      B.add(cylGeo(0.62, 0.62, 0.22, 20), body, { pos: [0, -0.12, reach] });
      const dome = new THREE.SphereGeometry(0.5, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI);
      B.add(dome, M.vehicleGlass(), { pos: [0, -0.24, reach] });
      if (ir) B.add(new THREE.TorusGeometry(0.56, 0.035, 6, 24).rotateX(Math.PI / 2), M.lamp('#ff2a1f', 1.2), { pos: [0, -0.24, reach] });
      const at = [0, -0.45, reach];
      if (cover) coverCone(B, range, tilt, pan, at, 50);
      return { lens: at, moving: null };
    }
    case 'turret': {
      // A base on the wall and an eyeball that can look anywhere.
      B.add(along(cylGeo(0.5, 0.5, 0.14, 20), 0.07), body);
      const at = [0, 0, 0.4];
      B.sphere(body, 0.36, ...at, { seg: 16 });
      B.add(aim(along(cylGeo(0.4, 0.4, 0.1, 20), 0.12), tilt, pan, at), body);
      lens(B, 0.17, 0.37, { ...o, at });
      if (cover) coverCone(B, range, tilt, pan, at, 40);
      return { lens: at, moving: null };
    }
    case 'ptz': {
      // A gooseneck pendant, then the pan unit and the ball that turns.
      const reach = wall ? 1.6 : 0;
      if (wall) {
        B.box(body, 0.6, 0.8, 0.12, 0, 0, 0.06);
        B.tube(body, [0, 0, 0.1], [0, 0, reach - 0.3], 0.13, 10);
        B.tube(body, [0, 0, reach - 0.3], [0, -0.25, reach], 0.13, 10);
      }
      B.add(cylGeo(0.14, 0.14, 0.4, 10), body, { pos: [0, -0.45, reach] });
      const head = new Builder();
      head.add(cylGeo(0.42, 0.46, 0.55, 20), body, { pos: [0, -0.3, 0] });
      head.sphere(body, 0.46, 0, -0.85, 0, { seg: 18 });
      head.add(aim(along(cylGeo(0.3, 0.3, 0.16, 18), 0.38), tilt, 0, [0, -0.85, 0]), dark);
      lens(head, 0.16, 0.46, { tilt, pan: 0, ir, at: [0, -0.85, 0] });
      if (cover) coverCone(head, range, tilt, 0, [0, -0.85, 0], 45);
      const g = head.finish(new THREE.Group());
      markCones(g);
      g.position.set(0, -0.65, reach);
      g.rotation.y = pan * DEG;
      // Patrol slowly back and forth around where it is pointed.
      g.userData.pan = { base: pan * DEG, range: 0.75, speed: 0.18, phase: (reach * 7 + tilt) % 6.28 };
      return { lens: [0, -1.5, reach], moving: g };
    }
    default: {
      // Bullet: a bracket, a swivel, the barrel and its sun shield.
      const reach = wall ? 0.9 : 0;
      if (wall) {
        B.box(body, 0.5, 0.6, 0.12, 0, 0, 0.06);
        B.box(body, 0.16, 0.16, reach, 0, 0, reach / 2);
      }
      const at = [0, 0, reach];
      B.sphere(body, 0.13, ...at, { seg: 10 });
      B.add(aim(along(cylGeo(0.28, 0.3, 1.45, 16), 0.72), tilt, pan, [at[0], at[1] + 0.25, at[2]]), body);
      B.add(aim(boxGeo(0.72, 0.05, 1.7).translate(0, 0.34, 0.8), tilt, pan, [at[0], at[1] + 0.25, at[2]]), body);
      lens(B, 0.21, 1.45, { ...o, at: [at[0], at[1] + 0.25, at[2]] });
      const lensAt = [at[0], at[1] + 0.25, at[2]];
      if (cover) coverCone(B, range, tilt, pan, lensAt, 38);
      return { lens: lensAt, moving: null };
    }
  }
}

/** The volume a camera sees: a see-through cone from the lens out to its range. */
export function coverCone(B, range, tilt, pan, at, halfAngle = 38) {
  const r = range * Math.tan(halfAngle * DEG);
  const g = new THREE.ConeGeometry(r, range, 28, 1, true);
  g.translate(0, -range / 2, 0);
  g.rotateX(-Math.PI / 2);
  g.scale(1, 0.62, 1);
  aim(g, tilt, pan, at);
  B.add(g, M.coverage());
}

/** Cones never block a click or count as part of what is selected. */
export function markCones(group) {
  const mat = M.coverage();
  group.traverse((o) => {
    if (o.isMesh && o.material === mat) {
      o.userData.noPick = true;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 3;
    }
  });
}
