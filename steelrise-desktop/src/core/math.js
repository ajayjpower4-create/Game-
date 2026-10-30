// Small immutable vector and rigid-frame types. World units are metres,
// +Y is up and "look" is -Z (the same convention as three.js cameras).

export class V3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  add(o) { return new V3(this.x + o.x, this.y + o.y, this.z + o.z); }
  sub(o) { return new V3(this.x - o.x, this.y - o.y, this.z - o.z); }
  mul(s) { return typeof s === "number" ? new V3(this.x * s, this.y * s, this.z * s) : new V3(this.x * s.x, this.y * s.y, this.z * s.z); }
  div(s) { return new V3(this.x / s, this.y / s, this.z / s); }
  neg() { return new V3(-this.x, -this.y, -this.z); }
  dot(o) { return this.x * o.x + this.y * o.y + this.z * o.z; }
  cross(o) { return new V3(this.y * o.z - this.z * o.y, this.z * o.x - this.x * o.z, this.x * o.y - this.y * o.x); }
  get len() { return Math.hypot(this.x, this.y, this.z); }
  unit() { const l = this.len; return l > 1e-12 ? this.div(l) : new V3(0, 0, 0); }
  lerp(o, t) { return new V3(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t, this.z + (o.z - this.z) * t); }
  dist(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
  flat() { return new V3(this.x, 0, this.z); }
  abs() { return new V3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); }
  toArray() { return [this.x, this.y, this.z]; }
  toString() { return `${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)}`; }
}

export const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
export const V0 = new V3(0, 0, 0);
export const VX = new V3(1, 0, 0);
export const VY = new V3(0, 1, 0);
export const VZ = new V3(0, 0, 1);

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mmul(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      c[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return c;
}
function mv(r, x, y, z) {
  return [r[0] * x + r[1] * y + r[2] * z, r[3] * x + r[4] * y + r[5] * z, r[6] * x + r[7] * y + r[8] * z];
}
function tr(r) {
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
}

// Rigid transform: position p and row-major rotation matrix r.
export class CF {
  constructor(x = 0, y = 0, z = 0, r = I3) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.r = r;
  }
  static at(x, y, z) { return typeof x === "object" ? new CF(x.x, x.y, x.z) : new CF(x, y, z); }
  static from(p) { return new CF(p.x, p.y, p.z); }
  // Rx * Ry * Rz (same order as Roblox CFrame.Angles)
  static angles(ax = 0, ay = 0, az = 0) {
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    const rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
    const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
    return new CF(0, 0, 0, mmul(mmul(rx, ry), rz));
  }
  static fromMatrix(p, vx, vy, vz) {
    vz = vz || vx.cross(vy);
    return new CF(p.x, p.y, p.z, [vx.x, vy.x, vz.x, vx.y, vy.y, vz.y, vx.z, vy.z, vz.z]);
  }
  static lookAt(at, target, up = VY) {
    const look = target.sub(at).unit();
    let right = look.cross(up);
    right = right.len < 1e-6 ? VX : right.unit();
    const upv = right.cross(look);
    return CF.fromMatrix(at, right, upv, look.neg());
  }
  // lookAt with a safe up vector for (near) vertical directions
  static lookAlong(pos, dir) {
    const d = dir.unit();
    const up = Math.abs(d.y) > 0.98 ? VX : VY;
    return CF.lookAt(pos, pos.add(d), up);
  }
  static fromArray(a) { return new CF(a[0], a[1], a[2], a.slice(3, 12)); }

  get pos() { return new V3(this.x, this.y, this.z); }
  get rot() { return new CF(0, 0, 0, this.r); }
  get xVec() { return new V3(this.r[0], this.r[3], this.r[6]); }
  get yVec() { return new V3(this.r[1], this.r[4], this.r[7]); }
  get zVec() { return new V3(this.r[2], this.r[5], this.r[8]); }
  get look() { return new V3(-this.r[2], -this.r[5], -this.r[8]); }

  mul(o) {
    const [x, y, z] = mv(this.r, o.x, o.y, o.z);
    return new CF(this.x + x, this.y + y, this.z + z, mmul(this.r, o.r));
  }
  point(p) {
    const [x, y, z] = mv(this.r, p.x, p.y, p.z);
    return new V3(this.x + x, this.y + y, this.z + z);
  }
  vecToWorld(p) { const [x, y, z] = mv(this.r, p.x, p.y, p.z); return new V3(x, y, z); }
  vecToObj(p) { const [x, y, z] = mv(tr(this.r), p.x, p.y, p.z); return new V3(x, y, z); }
  pointToObj(p) { return this.vecToObj(p.sub(this.pos)); }
  inverse() {
    const t = tr(this.r);
    const [x, y, z] = mv(t, -this.x, -this.y, -this.z);
    return new CF(x, y, z, t);
  }
  plus(d) { return new CF(this.x + d.x, this.y + d.y, this.z + d.z, this.r); }
  withPos(p) { return new CF(p.x, p.y, p.z, this.r); }
  toArray() {
    const out = [this.x, this.y, this.z, ...this.r];
    return out.map((n) => Math.round(n * 10000) / 10000);
  }
  toQuat() {
    const m = this.r;
    const m00 = m[0], m01 = m[1], m02 = m[2], m10 = m[3], m11 = m[4], m12 = m[5], m20 = m[6], m21 = m[7], m22 = m[8];
    const tr0 = m00 + m11 + m22;
    let x, y, z, w;
    if (tr0 > 0) {
      const s = 0.5 / Math.sqrt(tr0 + 1);
      w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
      const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
      w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
      w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
      w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
    }
    return [x, y, z, w];
  }
  static fromQuat(px, py, pz, q) {
    const [x, y, z, w] = q;
    return new CF(px, py, pz, [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    ]);
  }
  lerp(o, t) {
    let a = this.toQuat(), b = o.toQuat();
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map((n) => -n); d = -d; }
    let q;
    if (d > 0.9995) {
      q = a.map((n, i) => n + (b[i] - n) * t);
    } else {
      const th = Math.acos(d), s = Math.sin(th);
      const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      q = a.map((n, i) => n * wa + b[i] * wb);
    }
    const l = Math.hypot(...q);
    q = q.map((n) => n / l);
    return CF.fromQuat(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t, this.z + (o.z - this.z) * t, q);
  }
  // write into a THREE.Matrix4 (column-major)
  toMatrix4(m) {
    const r = this.r;
    m.set(r[0], r[1], r[2], this.x, r[3], r[4], r[5], this.y, r[6], r[7], r[8], this.z, 0, 0, 0, 1);
    return m;
  }
}

export const CF0 = new CF();

export function angleBetween(a, b) {
  const rel = mmul(tr(a.r), b.r);
  const c = Math.max(-1, Math.min(1, (rel[0] + rel[4] + rel[8] - 1) / 2));
  return Math.acos(c);
}

export function yawOf(cf) {
  const l = cf.look;
  return Math.atan2(-l.x, -l.z);
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const round = (x, step = 1) => Math.round(x / step) * step;
export const approach = (cur, target, maxDelta) => (cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target));
export function rampVelocity(vel, target, accel, brake, dt) {
  const slowing = Math.abs(target) < Math.abs(vel) || target * vel < 0;
  return approach(vel, target, (slowing ? brake : accel) * dt);
}
export const wrapAngle = (a) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

export function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) % 2147483647;
  return h;
}

// Deterministic PRNG (Park–Miller) so sites look the same every time.
export class Rng {
  constructor(seed = 1) { this.s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; }
  next() { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
  num(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.next()); }
}

export function fmtKg(kg) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}
