// GPS: A* over the road graph, turn-by-turn guidance and re-routing.
import * as THREE from 'three';
import { fmtDist } from './util.js';

function projectToSeg(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const L2 = abx * abx + abz * abz || 1;
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / L2;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + abx * t, z = a.z + abz * t, y = a.y + (b.y - a.y) * t;
  return { t, x, y, z, d: Math.hypot(p.x - x, p.z - z) + Math.abs((p.y ?? 0) - y) * 1.5 };
}

export class Nav {
  constructor(graph) {
    this.g = graph;
    this.route = null;     // { pts: [{x,y,z}], steps: [{at: index, text, kind}], dest }
    this.offTimer = 0;
  }

  // Nearest directed edge position; heading (radians, 0=+z) prefers edges going our way.
  nearest(p, heading = null) {
    let best = null;
    for (const e of this.g.edges) {
      for (let i = 0; i < e.pts.length - 1; i++) {
        const a = e.pts[i], b = e.pts[i + 1];
        const pr = projectToSeg(p, a, b);
        let score = pr.d;
        if (heading !== null) {
          const ex = b.x - a.x, ez = b.z - a.z;
          const dot = (Math.sin(heading) * ex + Math.cos(heading) * ez) / (Math.hypot(ex, ez) || 1);
          score += (1 - dot) * 6;
        }
        if (!best || score < best.score) best = { e, i, pr, score };
      }
    }
    return best;
  }

  astar(startNode, goalNode) {
    const N = this.g.nodes;
    const goal = N[goalNode];
    const h = (n) => Math.hypot(N[n].x - goal.x, N[n].z - goal.z) / 25;
    const open = new Map([[startNode, h(startNode)]]);
    const g = new Map([[startNode, 0]]);
    const came = new Map();
    while (open.size) {
      let cur = null, cf = Infinity;
      for (const [n, f] of open) if (f < cf) { cf = f; cur = n; }
      if (cur === goalNode) {
        const path = [];
        let c = cur;
        while (came.has(c)) { const e = came.get(c); path.unshift(e); c = this.g.edges[e].from; }
        return path;
      }
      open.delete(cur);
      for (const ei of N[cur].out) {
        const e = this.g.edges[ei];
        const cost = g.get(cur) + e.len / e.speed + 2;
        if (cost < (g.get(e.to) ?? Infinity)) {
          g.set(e.to, cost);
          came.set(e.to, ei);
          open.set(e.to, cost + h(e.to));
        }
      }
    }
    return null;
  }

  plan(from, heading, to, label = '') {
    const s = this.nearest(from, heading);
    const d = this.nearest(to, null);
    if (!s || !d) { this.route = null; return null; }
    const pts = [];
    pts.push({ x: s.pr.x, y: s.pr.y, z: s.pr.z });
    const edgesUsed = [];
    let path;
    if (s.e.id === d.e.id && (s.i < d.i || (s.i === d.i && s.pr.t <= d.pr.t))) {
      path = [];
      for (let i = s.i + 1; i <= d.i; i++) pts.push(s.e.pts[i]);
    } else {
      for (let i = s.i + 1; i < s.e.pts.length; i++) pts.push(s.e.pts[i]);
      path = this.astar(s.e.to, d.e.from) ?? [];
      edgesUsed.push(s.e);
      for (const ei of path) {
        const e = this.g.edges[ei];
        edgesUsed.push(e);
        for (let i = 1; i < e.pts.length; i++) pts.push(e.pts[i]);
      }
      edgesUsed.push(d.e);
      for (let i = 1; i <= d.i; i++) pts.push(d.e.pts[i]);
    }
    pts.push({ x: d.pr.x, y: d.pr.y, z: d.pr.z });
    pts.push({ x: to.x, y: to.y ?? 0, z: to.z });
    this.route = { pts, edges: edgesUsed, dest: to, label, steps: this.buildSteps(edgesUsed) };
    this.offTimer = 0;
    return this.route;
  }

  // Turn instructions at each edge change where the road name changes.
  buildSteps(edges) {
    const steps = [];
    for (let i = 1; i < edges.length; i++) {
      const a = edges[i - 1], b = edges[i];
      if (a.name === b.name && a.kind === b.kind) continue;
      const a0 = a.pts[a.pts.length - 2], a1 = a.pts[a.pts.length - 1];
      const b0 = b.pts[0], b1 = b.pts[1] ?? b.pts[0];
      const h1 = Math.atan2(a1.x - a0.x, a1.z - a0.z), h2 = Math.atan2(b1.x - b0.x, b1.z - b0.z);
      let turn = h2 - h1;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      let text;
      if (b.kind === 'ramp' && a.kind === 'highway') text = `Take ${b.name.replace(' ramp', '')}`;
      else if (b.kind === 'ramp') text = `Turn ${turn > 0 ? 'left' : 'right'} onto the ramp to ${b.name.replace('Ramp to ', '')}`;
      else if (b.kind === 'highway') text = `Merge onto ${b.name}`;
      else if (Math.abs(turn) < 0.35) text = `Continue onto ${b.name}`;
      else text = `Turn ${turn > 0 ? 'left' : 'right'} onto ${b.name}`;
      steps.push({ pos: { x: b0.x, y: b0.y, z: b0.z }, text, turn });
    }
    return steps;
  }

  // Progress along the route: remaining distance, next instruction, off-route detection.
  update(dt, pos, heading) {
    const r = this.route;
    if (!r) return null;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const pr = projectToSeg(pos, r.pts[i], r.pts[i + 1]);
      if (pr.d < bd) { bd = pr.d; bi = i; }
    }
    r.cursor = bi;
    let remain = 0;
    const pr = projectToSeg(pos, r.pts[bi], r.pts[bi + 1]);
    remain += Math.hypot(r.pts[bi + 1].x - pr.x, r.pts[bi + 1].z - pr.z);
    for (let i = bi + 1; i < r.pts.length - 1; i++) remain += Math.hypot(r.pts[i + 1].x - r.pts[i].x, r.pts[i + 1].z - r.pts[i].z);
    r.remain = remain;
    // Next step ahead of us.
    let next = null, nd = Infinity;
    for (const s of r.steps) {
      const d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
      // Only steps that are still ahead along the route.
      const idx = r.pts.findIndex((p) => Math.abs(p.x - s.pos.x) < 0.5 && Math.abs(p.z - s.pos.z) < 0.5);
      if (idx >= 0 && idx <= bi) continue;
      if (d < nd) { nd = d; next = s; }
    }
    r.next = next;
    r.nextDist = nd;
    const off = bd > 22;
    this.offTimer = off ? this.offTimer + dt : 0;
    return { remain, next, nextDist: nd, rerouteNeeded: this.offTimer > 2.5, arrived: remain < 25 };
  }

  instruction() {
    const r = this.route;
    if (!r) return '';
    if (r.remain < 60) return `Arriving: ${r.label}`;
    if (r.next && r.nextDist < 600) return `In ${fmtDist(r.nextDist)}: ${r.next.text}`;
    return `${r.label} — ${fmtDist(r.remain)}`;
  }

  clear() { this.route = null; }
}
