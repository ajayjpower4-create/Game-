// Particle effects: welding sparks (restrained), dust puffs when loads touch
// down, concrete splash while pouring, grinding sparks from the impact wrench.

import * as THREE from "three";
import { bus } from "../core/events.js";

const MAX = 3000;

export class FX {
  constructor(renderer, game) {
    this.r = renderer;
    this.g = game;
    this.scale = 1;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geo = geo;
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.points.frustumCulled = false;
    renderer.scene.add(this.points);
    const dgeo = new THREE.BufferGeometry();
    this.dpos = new Float32Array(MAX * 3);
    dgeo.setAttribute("position", new THREE.BufferAttribute(this.dpos, 3));
    this.dgeo = dgeo;
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ size: 0.5, color: 0x9a9284, transparent: true, opacity: 0.35, depthWrite: false }));
    this.dust.frustumCulled = false;
    renderer.scene.add(this.dust);
    this.sparks = [];
    this.dusts = [];
    this.weldAt = null;
    this.pourAt = null;
    this.light = new THREE.PointLight(0x9fc4ff, 0, 6, 2);
    renderer.scene.add(this.light);
    bus.on("fx", (kind, pos, extra) => this.onFx(kind, pos, extra));
    bus.on("tooluse", (type, on, pos) => {
      this.weldAt = on && type === "Weld" ? pos : null;
      this.grindAt = on && type === "Bolt" ? pos : null;
    });
  }

  spark(p, n, speed, color = [1, 0.75, 0.3], life = 0.6) {
    n = Math.round(n * this.scale);
    for (let i = 0; i < n && this.sparks.length < MAX; i++) {
      const th = Math.random() * Math.PI * 2, u = Math.random();
      this.sparks.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(th) * speed * u, vy: speed * (0.3 + Math.random()), vz: Math.sin(th) * speed * u, life: life * (0.5 + Math.random()), c: color });
    }
  }
  puff(p, n, spread = 1) {
    n = Math.round(n * this.scale);
    for (let i = 0; i < n && this.dusts.length < MAX; i++) {
      const th = Math.random() * Math.PI * 2;
      this.dusts.push({ x: p.x + Math.cos(th) * spread * Math.random(), y: p.y + 0.1, z: p.z + Math.sin(th) * spread * Math.random(), vx: Math.cos(th) * 0.8, vy: 0.3 + Math.random() * 0.4, vz: Math.sin(th) * 0.8, life: 1.2 + Math.random() });
    }
  }

  onFx(kind, pos, extra) {
    if (!pos) return;
    if (kind === "Weld") this.spark(pos, 40, 2.5);
    else if (kind === "Bolt") this.spark(pos, 6, 1, [1, 0.6, 0.2], 0.3);
    else if (kind === "Wedge") this.spark(pos, 8, 1.5, [1, 0.8, 0.4], 0.25);
    else if (kind === "Set" || kind === "Drop") this.puff(pos, 24, 1.2);
    else if (kind === "Land" && extra > 2) this.puff(pos, 10, 0.4);
    else if (kind === "Pour") this.puff(pos, 60, 3);
    else if (kind === "ContactHeavy" || kind === "ContactLight") this.spark(pos, 20, 2);
    else if (kind === "PourStart") this.pourAt = { pos, until: this.g.time + 2.5 };
  }

  update(dt) {
    if (this.weldAt) {
      this.spark(this.weldAt, 6, 2.2);
      this.light.position.set(this.weldAt.x, this.weldAt.y + 0.2, this.weldAt.z);
      this.light.intensity = 3 + Math.random() * 4;
    } else this.light.intensity = 0;
    if (this.grindAt && Math.random() < 0.3) this.spark(this.grindAt, 1, 0.8, [1, 0.6, 0.2], 0.2);
    if (this.pourAt) {
      if (this.g.time > this.pourAt.until) this.pourAt = null;
      else this.puff(this.pourAt.pos, 2, 2.5);
    }
    let n = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      s.vy -= 9.8 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const f = Math.min(1, s.life * 2);
      this.pos[n * 3] = s.x;
      this.pos[n * 3 + 1] = s.y;
      this.pos[n * 3 + 2] = s.z;
      this.col[n * 3] = s.c[0] * 2 * f;
      this.col[n * 3 + 1] = s.c[1] * 2 * f;
      this.col[n * 3 + 2] = s.c[2] * 2 * f;
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    let m = 0;
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const d = this.dusts[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.dusts[i] = this.dusts[this.dusts.length - 1];
        this.dusts.pop();
        continue;
      }
      d.vx *= 0.97;
      d.vz *= 0.97;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      this.dpos[m * 3] = d.x;
      this.dpos[m * 3 + 1] = d.y;
      this.dpos[m * 3 + 2] = d.z;
      m++;
    }
    this.dgeo.setDrawRange(0, m);
    this.dgeo.attributes.position.needsUpdate = true;
  }
}
