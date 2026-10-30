// Runtime helpers for code ported from Luau, where +, -, * and / also work on
// vectors and frames. Plain numbers take the fast path.

import { V3, CF } from "./math.js";

export function $add(a, b) {
  if (typeof a === "number" && typeof b === "number") return a + b;
  if (a instanceof CF) return a.plus(b);
  return a.add(b);
}
export function $sub(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof CF) return a.plus(b.neg());
  return a.sub(b);
}
export function $mul(a, b) {
  if (typeof a === "number") return typeof b === "number" ? a * b : b.mul(a);
  if (a instanceof CF) return b instanceof CF ? a.mul(b) : a.point(b);
  return a.mul(b);
}
export function $div(a, b) {
  if (typeof a === "number") return a / b;
  return typeof b === "number" ? a.div(b) : new V3(a.x / b.x, a.y / b.y, a.z / b.z);
}
export function $unm(a) {
  return typeof a === "number" ? -a : a.neg();
}
export function $assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
  return cond;
}
// plain-text replacement (the ported code only uses literal patterns)
export function $gsub(s, pat, rep) {
  return String(s).split(pat).join(rep);
}

// Subset of string.format: %d %i %s %f %.Nf %Nd %0Nd %x %%
export function $fmt(fmt, ...args) {
  let i = 0;
  return fmt.replace(/%([-0]?)(\d*)(?:\.(\d+))?([disfx%])/g, (m, flag, width, prec, conv) => {
    if (conv === "%") return "%";
    const a = args[i++];
    let s;
    if (conv === "d" || conv === "i") s = String(Math.trunc(Number(a)));
    else if (conv === "f") s = Number(a).toFixed(prec === undefined ? 6 : Number(prec));
    else if (conv === "x") s = Math.trunc(Number(a)).toString(16);
    else s = String(a);
    if (width) {
      const w = Number(width);
      if (flag === "-") s = s.padEnd(w);
      else if (flag === "0") s = s.startsWith("-") ? "-" + s.slice(1).padStart(w - 1, "0") : s.padStart(w, "0");
      else s = s.padStart(w);
    }
    return s;
  });
}
