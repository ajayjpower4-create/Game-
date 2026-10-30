// A scene-graph node made of Builder parts: vehicles, the crane assemblies,
// wheels. `cf` is the node frame relative to its parent; parts are in the
// node's local frame.

import { CF } from "../core/math.js";
import { Builder } from "./builder.js";

export class Node {
  constructor(name, cf = new CF()) {
    this.name = name;
    this.cf = cf;
    this.b = new Builder();
    this.children = [];
    this.attrs = {};
    this.parent = null;
  }
  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  find(name) {
    if (this.name === name) return this;
    for (const c of this.children) {
      const f = c.find(name);
      if (f) return f;
    }
    return null;
  }
  // world frame given the root's world frame
  worldCf(rootCf) {
    const chain = [];
    for (let n = this; n; n = n.parent) chain.unshift(n);
    let cf = rootCf || new CF();
    for (let i = 1; i < chain.length; i++) cf = cf.mul(chain[i].cf);
    return cf;
  }
  // all parts with frames relative to this node (flattened)
  flatParts(prefix = new CF(), out = []) {
    for (const p of this.b.parts) out.push({ ...p, cf: prefix.mul(p.cf) });
    for (const c of this.children) c.flatParts(prefix.mul(c.cf), out);
    return out;
  }
}

// Builder-style helper used by the ported vehicle / crane code: parts are
// given in the model frame and land in `parent` (a child node) converted to
// that node's local frame.
export function partMaker(root) {
  const local = (node, cf) => (node && node !== root ? node.worldCf(new CF()).inverse().mul(cf) : cf);
  const target = (node) => (node || root).b;
  const flagsOf = (flags = {}) => {
    const f = {};
    if (flags.nc) f.nc = true;
    if (flags.ns) f.ns = true;
    if (flags.nq) f.nq = true;
    if (flags.tr) f.tr = flags.tr;
    if (flags.refl) f.refl = flags.refl;
    return f;
  };
  const api = {
    part(name, size, cf, color, material, flags = {}, parent) {
      const b = target(parent);
      const p = b.box(name, size, local(parent, cf), color, material || "SmoothPlastic", flagsOf(flags));
      if (flags.wedge) p.shape = "wedge";
      else if (flags.cyl) p.shape = "cyl";
      else if (flags.ball) p.shape = "ball";
      return p;
    },
    cylX(name, length, dia, cf, color, material, flags = {}, parent) {
      return api.part(name, { x: length, y: dia, z: dia }, cf, color, material, { ...flags, cyl: true }, parent);
    },
    cylY(name, length, dia, pos, color, material, flags, parent) {
      return api.cylX(name, length, dia, CF.from(pos).mul(CF.angles(0, 0, Math.PI / 2)), color, material, flags, parent);
    },
    cylZ(name, length, dia, pos, color, material, flags, parent) {
      return api.cylX(name, length, dia, CF.from(pos).mul(CF.angles(0, Math.PI / 2, 0)), color, material, flags, parent);
    },
  };
  return api;
}
