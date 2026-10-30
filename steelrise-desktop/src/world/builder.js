// Records the parts of a model as plain specs (shape, size, local frame,
// colour, material, flags). The same specs drive rendering (merged meshes)
// and collision (oriented boxes), so what you see is what you bump into.

import { CF, V3, v, VX, VY } from "../core/math.js";
import { Config, rgb } from "../core/config.js";

const C = Config.Colors;

export class Builder {
  constructor(opts = {}) {
    this.parts = [];
    this.lights = [];
    this.signs = [];
    this.opts = opts;
    this.tint = opts.tint || 0;
  }

  // flags: nc (no collide), ns (no shadow), tr (transparency), refl,
  //        nq (not aimable), climb (ladder volume), lens (functional lamp glass)
  box(name, size, cf, color = C.MillSteel, mat = "Metal", flags = {}) {
    const p = { name, shape: "box", size: new V3(Math.max(size.x, 0.004), Math.max(size.y, 0.004), Math.max(size.z, 0.004)), cf, color: this._tint(color), mat: mat || "Metal", ...flags };
    this.parts.push(p);
    return p;
  }
  wedge(name, size, cf, color, mat, flags = {}) {
    const p = this.box(name, size, cf, color, mat, flags);
    p.shape = "wedge";
    return p;
  }
  // cylinder along local X of cf
  cylX(name, length, dia, cf, color, mat, flags = {}) {
    const p = this.box(name, v(length, dia, dia), cf, color, mat, flags);
    p.shape = "cyl";
    return p;
  }
  cylY(name, length, dia, pos, color, mat, flags) {
    return this.cylX(name, length, dia, CF.from(pos).mul(CF.angles(0, 0, Math.PI / 2)), color, mat, flags);
  }
  cylZ(name, length, dia, pos, color, mat, flags) {
    return this.cylX(name, length, dia, CF.from(pos).mul(CF.angles(0, Math.PI / 2, 0)), color, mat, flags);
  }
  sphere(name, dia, pos, color, mat, flags = {}) {
    const p = this.box(name, v(dia, dia, dia), CF.from(pos), color, mat, flags);
    p.shape = "ball";
    return p;
  }
  tube(name, a, b, dia, color, mat, flags) {
    const d = b.sub(a);
    return this.cylX(name, d.len, dia, CF.lookAlong(a.add(b).mul(0.5), d).mul(CF.angles(0, Math.PI / 2, 0)), color, mat, flags);
  }
  bar(name, a, b, w, h, color, mat, flags) {
    const d = b.sub(a);
    return this.box(name, v(w, h, d.len), CF.lookAlong(a.add(b).mul(0.5), d), color, mat, flags);
  }
  // wide-flange: axis "X" (beam) or "Y" (column, flanges facing ±X)
  wShape(prefix, length, p, cf, color, mat) {
    const { d, bf, tf, tw } = p;
    if (p.axis === "Y") {
      this.box(prefix + "FlangeA", v(tf, length, bf), cf.mul(CF.at(d / 2 - tf / 2, 0, 0)), color, mat);
      this.box(prefix + "FlangeB", v(tf, length, bf), cf.mul(CF.at(-d / 2 + tf / 2, 0, 0)), color, mat);
      this.box(prefix + "Web", v(d - 2 * tf, length, tw), cf, color, mat);
    } else {
      this.box(prefix + "TopFlange", v(length, tf, bf), cf.mul(CF.at(0, d / 2 - tf / 2, 0)), color, mat);
      this.box(prefix + "BottomFlange", v(length, tf, bf), cf.mul(CF.at(0, -d / 2 + tf / 2, 0)), color, mat);
      this.box(prefix + "Web", v(length, d - 2 * tf, tw), cf, color, mat);
    }
  }
  hss(prefix, length, w, t, cf, color, mat) {
    this.box(prefix + "T", v(length, t, w), cf.mul(CF.at(0, w / 2 - t / 2, 0)), color, mat);
    this.box(prefix + "B", v(length, t, w), cf.mul(CF.at(0, -w / 2 + t / 2, 0)), color, mat);
    this.box(prefix + "L", v(length, w - 2 * t, t), cf.mul(CF.at(0, 0, w / 2 - t / 2)), color, mat);
    this.box(prefix + "R", v(length, w - 2 * t, t), cf.mul(CF.at(0, 0, -w / 2 + t / 2)), color, mat);
  }
  stencil(cf, w, h) {
    return this.box("Stencil", v(w, h, 0.002), cf, C.OffWhite, "SmoothPlastic", { nc: true, ns: true });
  }
  // invisible climbable volume (ladders)
  climb(name, size, cf) {
    return this.box(name, size, cf, 0, "SmoothPlastic", { tr: 1, climb: true, ns: true, nq: true });
  }
  light(part, def) {
    this.lights.push({ part, ...def });
  }
  // face: "front" (-Z, default) or "back" (+Z)
  sign(part, text, bg, fg, face = "front") {
    this.signs.push({ part, text, bg, fg, face });
  }
  _tint(color) {
    if (!this.tint) return color;
    const f = 1 + this.tint;
    const r = Math.min(255, ((color >> 16) & 255) * f), g = Math.min(255, ((color >> 8) & 255) * f), b = Math.min(255, (color & 255) * f);
    return rgb(r | 0, g | 0, b | 0);
  }
}

export { CF, V3, v, VX, VY, rgb };
