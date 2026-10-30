// Lays out a list of items on a rectangular bed (trailer deck or laydown
// yard) as stacked blocks on dunnage, the way steel is actually shipped: one
// block per item type, layers separated by timbers, straps over each block.
// Bed-local frame: X along the bed, Z across it, Y = 0 at the bed surface.

import { CF, V3, v } from "../core/math.js";
import { Registry } from "../data/items.js";

const DUNNAGE = 0.1;
const GAP = 0.08;

// Rotated bounding size and centre offset for an item in its transport pose.
export function transportBox(def) {
  const R = def.transport;
  const sx = def.size.x / 2, sy = def.size.y / 2, sz = def.size.z / 2;
  const rx = R.xVec, ry = R.yVec, rz = R.zVec;
  const hx = Math.abs(rx.x) * sx + Math.abs(ry.x) * sy + Math.abs(rz.x) * sz;
  const hy = Math.abs(rx.y) * sx + Math.abs(ry.y) * sy + Math.abs(rz.y) * sz;
  const hz = Math.abs(rx.z) * sx + Math.abs(ry.z) * sy + Math.abs(rz.z) * sz;
  return { box: v(hx * 2, hy * 2, hz * 2), offset: R.vecToWorld(def.boundsOffset) };
}

// requests: [{ id, qty }] -> { placed: [{ id, cf, group }], extras: { dunnage, straps }, leftovers, kg }
export function pack(requests, bedLength, bedWidth, maxHeight, opts = {}) {
  const placed = [], dunnage = [], straps = [], leftovers = [];
  let cursor = -bedLength / 2 + 0.3;
  let totalKg = 0;
  const maxKg = opts.maxKg || Infinity;
  let groupN = 0;
  // longest items first so long steel sits at the front of the bed
  const sorted = requests
    .map((r) => ({ def: Registry.get(r.id), qty: r.qty }))
    .filter((r) => r.def && r.qty > 0)
    .sort((a, b) => b.def.size.len - a.def.size.len);
  for (const req of sorted) {
    const def = req.def;
    let { box, offset } = transportBox(def);
    let rot = def.transport;
    let x = box.x, h = box.y, z = box.z;
    if (z > bedWidth && x <= bedWidth && z <= bedLength) {
      const q = CF.angles(0, Math.PI / 2, 0);
      rot = q.mul(rot);
      box = v(z, h, x);
      offset = q.vecToWorld(offset);
      x = box.x;
      z = box.z;
    }
    const across = Math.max(1, Math.floor((bedWidth + GAP) / (z + GAP)));
    const layers = h <= maxHeight / 2 ? Math.max(1, Math.floor((maxHeight + 0.001) / (h + DUNNAGE))) : 1;
    let remaining = req.qty;
    while (remaining > 0) {
      if (cursor + x > bedLength / 2 + 0.01) break;
      groupN++;
      const group = (opts.prefix || "G") + groupN;
      let inBlock = 0, topY = 0;
      const xc = cursor + x / 2;
      let full = false;
      for (let l = 0; l < layers && remaining > 0 && !full; l++) {
        const yBottom = DUNNAGE + l * (h + DUNNAGE);
        for (const fx of [-0.3, 0.3]) {
          dunnage.push({ cf: CF.at(xc + fx * x, yBottom - DUNNAGE / 2, 0), size: v(0.12, DUNNAGE, Math.min(bedWidth, across * (z + GAP))) });
        }
        for (let a = 0; a < across && remaining > 0; a++) {
          if (totalKg + def.weightKg > maxKg) break;
          const zc = -((across - 1) / 2) * (z + GAP) + a * (z + GAP);
          const centre = v(xc, yBottom + h / 2, zc);
          placed.push({ id: def.id, cf: CF.from(centre.sub(offset)).mul(rot), group });
          totalKg += def.weightKg;
          remaining--;
          inBlock++;
          topY = yBottom + h;
        }
        if (totalKg + def.weightKg > maxKg) full = true;
      }
      if (inBlock === 0) break;
      const strapXs = x > 3.5 ? [xc - x / 4, xc + x / 4] : [xc];
      for (const sx of strapXs) straps.push({ x: sx, top: topY, width: Math.min(bedWidth, across * (z + GAP)), group });
      cursor += x + GAP * 2;
      if (totalKg + def.weightKg > maxKg) break;
    }
    if (remaining > 0) leftovers.push({ id: def.id, qty: remaining });
  }
  return { placed, extras: { dunnage, straps }, leftovers, kg: totalKg };
}

export { V3 };
