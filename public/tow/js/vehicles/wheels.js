// Wheels: a revolved tire with tread and lettered sidewalls, an extruded
// alloy or steel rim with real spoke windows, lug nuts, a brake disc and a
// caliper. Geometry is cached per size/style and shared by every instance.
import * as THREE from 'three';
import * as M from '../materials.js';

const geoCache = new Map();
const cachedGeo = (key, fn) => {
  if (!geoCache.has(key)) {
    const g = fn();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return geoCache.get(key);
};

// Revolves a profile of [radius, axial] points around the X axis.
// uvMode 'wrap' maps u around the circumference; 'polar' maps a disc.
function revolve(profile, segments, { uvMode = 'wrap', repeatU = 1, polarR = 1 } = {}) {
  const pos = [], uv = [], idx = [];
  const rows = profile.length;
  let total = 0;
  const cum = [0];
  for (let i = 1; i < rows; i++) {
    total += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
    cum.push(total);
  }
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    const c = Math.cos(a), sn = Math.sin(a);
    for (let i = 0; i < rows; i++) {
      const [r, x] = profile[i];
      pos.push(x, r * c, r * sn);
      if (uvMode === 'wrap') uv.push((s / segments) * repeatU, cum[i] / (total || 1));
      else uv.push(0.5 + (r / polarR) * 0.5 * c, 0.5 + (r / polarR) * 0.5 * sn);
    }
  }
  for (let s = 0; s < segments; s++) {
    for (let i = 0; i < rows - 1; i++) {
      const a = s * rows + i, b = (s + 1) * rows + i;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function tireGeos(R, W, rimR) {
  const key = `tire${R}|${W}|${rimR}`;
  return {
    tread: cachedGeo(key + 't', () => {
      const p = [];
      const hw = W / 2;
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = -hw + 0.018 + t * (W - 0.036);
        const crown = 0.006 * (1 - Math.pow((t - 0.5) * 2, 2));
        p.push([R - 0.006 + crown, x]);
      }
      // Shoulders rolling into the sidewalls.
      p.unshift([R - 0.022, -hw + 0.002], [R - 0.012, -hw + 0.008]);
      p.push([R - 0.012, hw - 0.008], [R - 0.022, hw - 0.002]);
      return revolve(p, 64, { repeatU: 9 });
    }),
    sideOut: cachedGeo(key + 'so', () => {
      const p = [];
      const hw = W / 2;
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = rimR + 0.004 + t * (R - 0.022 - rimR - 0.004);
        const bulge = Math.sin(t * Math.PI) * 0.014;
        p.push([r, hw - 0.002 + bulge - t * 0.0]);
      }
      return revolve(p.reverse(), 64, { uvMode: 'polar', polarR: R });
    }),
    sideIn: cachedGeo(key + 'si', () => {
      const p = [];
      const hw = W / 2;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const r = rimR + 0.004 + t * (R - 0.022 - rimR - 0.004);
        p.push([r, -hw + 0.002 - Math.sin(t * Math.PI) * 0.014]);
      }
      return revolve(p, 64, { uvMode: 'polar', polarR: R });
    }),
  };
}

// Spoke-window rim face. Windows have parallel sides so spokes keep their width.
function rimFaceGeo(style, rimR, depth) {
  return cachedGeo(`rimface${style}|${rimR}`, () => {
    const outer = rimR - 0.012;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const addWindow = (a0, a1, rIn, rOut, spokeHalf) => {
      const path = new THREE.Path();
      const pts = [];
      const N = 10;
      // Outer arc, clipped so the spoke edges stay parallel.
      const offOut = Math.asin(Math.min(0.95, spokeHalf / rOut));
      const offIn = Math.asin(Math.min(0.95, spokeHalf / rIn));
      for (let i = 0; i <= N; i++) {
        const a = a0 + offOut + (a1 - a0 - 2 * offOut) * (i / N);
        pts.push(new THREE.Vector2(Math.cos(a) * rOut, Math.sin(a) * rOut));
      }
      for (let i = N; i >= 0; i--) {
        const a = a0 + offIn + Math.max(0.0, (a1 - a0 - 2 * offIn)) * (i / N);
        pts.push(new THREE.Vector2(Math.cos(a) * rIn, Math.sin(a) * rIn));
      }
      path.setFromPoints(pts);
      shape.holes.push(path);
    };
    const hub = 0.085 * (rimR / 0.23);
    if (style === 'spoke5' || style === 'spoke6') {
      const n = style === 'spoke5' ? 5 : 6;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        addWindow(a0, a1, hub, outer - 0.03, 0.03 * (rimR / 0.23));
      }
    } else if (style === 'split5') {
      for (let i = 0; i < 10; i++) {
        const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2;
        if (i % 2 === 0) addWindow(a0, a1, hub + 0.03, outer - 0.03, 0.012 * (rimR / 0.23));
        else addWindow(a0, a1, hub + 0.01, outer - 0.03, 0.022 * (rimR / 0.23));
      }
    } else if (style === 'multi') {
      for (let i = 0; i < 14; i++) {
        const a0 = (i / 14) * Math.PI * 2, a1 = ((i + 1) / 14) * Math.PI * 2;
        addWindow(a0, a1, hub + 0.02, outer - 0.025, 0.011 * (rimR / 0.23));
      }
    } else if (style === 'steel' || style === 'truck') {
      // Pressed steel: a ring of small round vent holes.
      const n = style === 'truck' ? 10 : 8;
      const rr = outer * 0.62;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const h = new THREE.Path();
        h.absellipse(Math.cos(a) * rr, Math.sin(a) * rr, 0.028 * (rimR / 0.23), 0.02 * (rimR / 0.23), 0, Math.PI * 2, false, a);
        shape.holes.push(h);
      }
    } else if (style === 'mesh') {
      for (let ring = 0; ring < 2; ring++) {
        const n = ring ? 16 : 10;
        const rIn = ring ? outer * 0.62 : hub + 0.015;
        const rOut = ring ? outer - 0.025 : outer * 0.56;
        for (let i = 0; i < n; i++) {
          const a0 = ((i + ring * 0.5) / n) * Math.PI * 2, a1 = ((i + 1 + ring * 0.5) / n) * Math.PI * 2;
          addWindow(a0, a1, rIn, rOut, 0.008);
        }
      }
    }
    const steel = style === 'steel' || style === 'truck';
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: steel ? 0.004 : 0.01, bevelSize: steel ? 0.004 : 0.008,
      bevelSegments: 3, curveSegments: 40,
    });
    // Face out along +X.
    g.rotateY(Math.PI / 2);
    return g;
  });
}

function rimBarrelGeo(rimR, W) {
  return cachedGeo(`barrel${rimR}|${W}`, () => {
    const p = [
      [rimR - 0.004, W / 2 - 0.004],
      [rimR + 0.006, W / 2 - 0.012],
      [rimR - 0.01, W / 2 - 0.03],
      [rimR - 0.018, W / 2 - 0.06],
      [rimR - 0.018, -W / 2 + 0.04],
      [rimR - 0.004, -W / 2 + 0.01],
    ];
    const g = revolve(p, 48);
    return g;
  });
}

function lugGeo() {
  return cachedGeo('lug', () => {
    const g = new THREE.CylinderGeometry(0.0115, 0.0115, 0.026, 6);
    g.rotateZ(Math.PI / 2);
    const cap = new THREE.SphereGeometry(0.0105, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.rotateZ(-Math.PI / 2);
    cap.translate(0.013, 0, 0);
    const merged = mergeSimple([g, cap]);
    return merged;
  });
}

// Minimal merge for non-indexed + indexed mixes (positions/normals/uvs).
export function mergeSimple(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const pos = [], nor = [], uv = [];
  for (const g of parts) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array);
    else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

function discGeo(r, t) {
  return cachedGeo(`disc${r}|${t}`, () => {
    const g = new THREE.CylinderGeometry(r, r, t, 40, 1, false);
    g.rotateZ(Math.PI / 2);
    return g;
  });
}

function caliperGeo(r) {
  return cachedGeo(`cal${r}`, () => {
    const shape = new THREE.Shape();
    const a0 = -0.55, a1 = 0.55, r0 = r - 0.05, r1 = r + 0.012;
    shape.absarc(0, 0, r1, a0, a1, false);
    shape.absarc(0, 0, r0, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 12 });
    g.translate(0, 0, -0.025);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

/**
 * Builds a wheel. Returns { pivot, spin, lugs[], tire } where `pivot` is
 * steered (rotate about Y) and `spin` rolls (rotate about X).
 * `side` is +1 for the right side of the car, -1 for the left.
 */
export function buildWheel(opts, side = 1) {
  const {
    tireR = 0.33, tireW = 0.225, rimR = 0.23, style = 'spoke5', rimColor = 0xc9ccd1,
    rimRough = 0.28, caliper = 0x2a2a2c, tread = 0, lugs = 5, dual = false,
  } = opts;
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);
  const facing = new THREE.Group(); // flips so the rim face looks outward
  if (side < 0) facing.rotation.y = Math.PI;
  spin.add(facing);

  const tg = tireGeos(tireR, tireW, rimR);
  const tire = new THREE.Mesh(tg.tread, M.tireRubber(tread));
  const sOut = new THREE.Mesh(tg.sideOut, M.sidewall());
  const sIn = new THREE.Mesh(tg.sideIn, M.rubber());
  facing.add(tire, sOut, sIn);

  const steel = style === 'steel' || style === 'truck';
  const rimMat = M.alloy(rimColor, steel ? 0.45 : rimRough);
  const face = new THREE.Mesh(rimFaceGeo(style, rimR, steel ? 0.006 : 0.022), rimMat);
  face.position.x = tireW / 2 - (steel ? 0.05 : 0.035);
  const barrel = new THREE.Mesh(rimBarrelGeo(rimR, tireW), M.alloy(steel ? rimColor : 0x9a9da3, 0.4));
  facing.add(face, barrel);

  // Hub, center cap and lug nuts.
  const hubR = 0.075 * (rimR / 0.23);
  const hub = new THREE.Mesh(discGeo(hubR, 0.03), steel ? rimMat : M.alloy(0x2a2b2e, 0.3));
  hub.position.x = face.position.x + 0.008;
  facing.add(hub);
  const lugMeshes = [];
  const lg = lugGeo();
  const nLugs = steel && style === 'truck' ? 8 : lugs;
  for (let i = 0; i < nLugs; i++) {
    const a = (i / nLugs) * Math.PI * 2;
    const lug = new THREE.Mesh(lg, M.chrome());
    const lr = hubR * 0.72;
    lug.position.set(face.position.x + 0.022, Math.cos(a) * lr, Math.sin(a) * lr);
    facing.add(lug);
    lugMeshes.push(lug);
  }
  const cap = new THREE.Mesh(discGeo(hubR * 0.42, 0.012), M.chrome());
  cap.position.x = face.position.x + 0.03;
  facing.add(cap);

  // Brake disc spins; the caliper is bolted to the knuckle so it steers but doesn't spin.
  const disc = new THREE.Mesh(discGeo(rimR - 0.045, 0.026), M.brakeDisc());
  disc.position.x = (tireW / 2 - 0.1) * (side < 0 ? -1 : 1);
  spin.add(disc);
  const cal = new THREE.Mesh(caliperGeo(rimR - 0.045), M.caliper(caliper));
  cal.position.x = disc.position.x;
  cal.rotation.x = side < 0 ? Math.PI * 0.85 : Math.PI * 0.15;
  pivot.add(cal);

  if (dual) {
    // Inner tire of a dual-rear-wheel set, mounted on the inboard side.
    const inner = new THREE.Group();
    inner.position.x = -tireW - 0.02;
    const t2 = new THREE.Mesh(tg.tread, M.tireRubber(tread));
    const s2 = new THREE.Mesh(tg.sideIn, M.rubber());
    const s3 = new THREE.Mesh(tg.sideOut, M.rubber());
    inner.add(t2, s2, s3);
    facing.add(inner);
  }

  for (const o of [tire, sOut, sIn, face, barrel]) { o.castShadow = true; o.receiveShadow = true; }
  pivot.userData.wheel = { tireR, tireW, rimR };
  return { pivot, spin, lugs: lugMeshes, tire, face, facing };
}
