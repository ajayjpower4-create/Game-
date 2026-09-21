// Deterministic random numbers. Every reconstructed stat is seeded from the
// league, game and player it belongs to, so re-opening the tool always shows
// the same numbers for the same game.

export function hashString(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeRng(...seedParts) {
  let a = hashString(seedParts.join('|')) || 1;
  // mulberry32
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // Weighted pick: items is [{item, weight}]
    weighted(items) {
      let total = 0;
      for (const it of items) total += Math.max(0, it.weight);
      if (total <= 0) return items.length ? items[Math.floor(next() * items.length)].item : undefined;
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, it.weight);
        if (r <= 0) return it.item;
      }
      return items[items.length - 1].item;
    },
    // Binomial-ish sample: number of successes in n trials with probability p.
    binomial(n, p) {
      let k = 0;
      for (let i = 0; i < n; i++) if (next() < p) k++;
      return k;
    },
    gaussian(mean = 0, sd = 1) {
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return mean + sd * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },
  };
  return rng;
}

// Distribute `total` whole units among `weights` (array of non-negative
// numbers) proportionally, using the rng only to break rounding ties. Returns
// an array of integers that sums to `total`.
export function apportion(total, weights, rng) {
  const n = weights.length;
  const out = new Array(n).fill(0);
  if (n === 0 || total <= 0) return out;
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) {
    for (let i = 0; i < total; i++) out[rng ? rng.int(0, n - 1) : i % n]++;
    return out;
  }
  const exact = weights.map((w) => (Math.max(0, w) / sum) * total);
  let used = 0;
  for (let i = 0; i < n; i++) {
    out[i] = Math.floor(exact[i]);
    used += out[i];
  }
  let remaining = total - used;
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e), tie: rng ? rng.next() : 0 }))
    .sort((a, b) => b.frac - a.frac || b.tie - a.tie);
  for (let k = 0; remaining > 0 && k < order.length; k++, remaining--) out[order[k].i]++;
  return out;
}
