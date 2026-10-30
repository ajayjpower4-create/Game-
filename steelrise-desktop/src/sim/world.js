// The running site: components, collision world and the queries the build
// rules need (records, ray casts, overlaps). Everything that physically
// exists on site registers colliders here with an owner describing it.

import { CF, V3, v } from "../core/math.js";
import { Physics, collidersFor, makeCollider } from "../world/physics.js";
import { siteBounds } from "../data/sites.js";
import { bus } from "../core/events.js";

// owner kinds: comp (component record), env (site equipment, fences),
// sur (neighbourhood), trailer, crane, strap
export class World {
  constructor(site) {
    this.site = site;
    this.physics = new Physics();
    this.comps = new Map();
    this.dirty = true;
    this._index = null;
    this._bounds = siteBounds(site);
  }

  bounds() {
    return this._bounds;
  }
  markDirty() {
    this.dirty = true;
  }
  records() {
    return [...this.comps.values()];
  }
  get(id) {
    return this.comps.get(id) || null;
  }

  // component record behind a ray hit (or collider owner)
  record(hit) {
    const owner = hit && (hit.owner || hit);
    return owner && owner.kind === "comp" ? owner : null;
  }

  // Ray against components, site equipment and the ground (what the build
  // rules see). excludeIds: Set of component ids to ignore.
  raycast(origin, dir, excludeIds, opts = {}) {
    return this.physics.raycast(
      origin,
      dir,
      (c) => {
        const o = c.owner;
        if (!o) return false;
        if (o.kind === "comp") return !(excludeIds && excludeIds.has(o.id)) && o.state !== "Carried" && !c.fastener;
        if (o.kind === "env") return true;
        return !!opts.all && o.kind !== "strap";
      },
      opts,
    );
  }

  // Everything solid overlapping an oriented box (placement checks).
  overlap(cf, size, excludeIds) {
    const out = [];
    for (const c of this.physics.overlapBox(cf, size, (c) => c.solid)) {
      const o = c.owner;
      if (!o) continue;
      if (o.kind === "comp") {
        if (excludeIds && excludeIds.has(o.id)) continue;
        if (o.state === "Carried") continue;
        out.push({ comp: o, fastener: !!c.fastener });
      } else if (o.kind === "env") {
        out.push({ env: o.name || c.name || "equipment" });
      }
    }
    return out;
  }

  // --- component colliders -------------------------------------------------
  attachColliders(comp) {
    this.detachColliders(comp);
    if (comp.state === "Carried") return;
    comp.colliders = collidersFor(comp.parts, comp.cf, comp);
    this.physics.addAll(comp.colliders);
  }
  detachColliders(comp) {
    if (comp.colliders) this.physics.removeAll(comp.colliders);
    comp.colliders = null;
  }
  moveColliders(comp) {
    if (!comp.colliders) return this.attachColliders(comp);
    for (const c of comp.colliders) this.physics.move(c, comp.cf.mul(c.local));
  }

  // --- static colliders ------------------------------------------------------
  addStatic(parts, worldCf, owner) {
    const cols = collidersFor(parts, worldCf, owner);
    this.physics.addAll(cols);
    return cols;
  }
  addBox(cf, size, owner, flags) {
    const c = makeCollider(cf, size, owner, flags);
    this.physics.add(c);
    return c;
  }
  removeColliders(list) {
    if (list) this.physics.removeAll(list);
  }

  changed(kind, comp) {
    this.dirty = true;
    bus.emit("comp", kind, comp);
  }
}

export { CF, V3, v };
