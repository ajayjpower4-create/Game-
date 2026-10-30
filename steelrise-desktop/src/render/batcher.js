// Instanced rendering for everything that is standing still. Each (item
// variant, surface bucket) pair is one InstancedMesh, so a tower with
// thousands of identical columns, beams and deck sheets stays at a few
// hundred draw calls.

import * as THREE from "three";

const _m = new THREE.Matrix4();
const WHITE = new THREE.Color(1, 1, 1);

class Pool {
  constructor(scene, bucket) {
    this.scene = scene;
    this.bucket = bucket;
    this.capacity = 0;
    this.count = 0;
    this.owners = [];
    this.mesh = null;
    this.grow(8);
  }
  grow(cap) {
    const old = this.mesh;
    const mesh = new THREE.InstancedMesh(this.bucket.geometry, this.bucket.material, cap);
    mesh.castShadow = this.bucket.castShadow;
    mesh.receiveShadow = !this.bucket.transparent;
    mesh.frustumCulled = false;
    if (this.bucket.transparent) mesh.renderOrder = 2;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    if (old) {
      mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.count * 16));
      mesh.instanceColor.array.set(old.instanceColor.array.subarray(0, this.count * 3));
      this.scene.remove(old);
      old.dispose();
    }
    mesh.count = this.count;
    this.scene.add(mesh);
    this.mesh = mesh;
    this.capacity = cap;
  }
  add(owner, matrix, color) {
    if (this.count >= this.capacity) this.grow(this.capacity * 2);
    const i = this.count++;
    this.mesh.setMatrixAt(i, matrix);
    this.mesh.setColorAt(i, color || WHITE);
    this.owners[i] = owner;
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    return i;
  }
  remove(i) {
    const last = this.count - 1;
    if (i !== last) {
      this.mesh.getMatrixAt(last, _m);
      this.mesh.setMatrixAt(i, _m);
      const c = this.mesh.instanceColor.array;
      c[i * 3] = c[last * 3];
      c[i * 3 + 1] = c[last * 3 + 1];
      c[i * 3 + 2] = c[last * 3 + 2];
      const moved = this.owners[last];
      this.owners[i] = moved;
      moved.slots.get(this).index = i;
    }
    this.owners.length = last;
    this.count = last;
    this.mesh.count = last;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Batcher {
  constructor(scene) {
    this.scene = scene;
    this.pools = new Map();
  }
  pool(key, bucket) {
    let p = this.pools.get(key);
    if (!p) {
      p = new Pool(this.scene, bucket);
      this.pools.set(key, p);
    }
    return p;
  }
  // variant: { key, buckets }; returns a handle
  add(variant, cf, opts = {}) {
    const h = { variant, slots: new Map(), lensOn: !!opts.lensOn, color: opts.color };
    cf.toMatrix4(_m);
    for (const b of variant.buckets) {
      const p = this.pool(variant.key + "#" + b.key, b);
      const color = b.lens ? lensColor(h.lensOn) : opts.color;
      h.slots.set(p, { index: p.add(h, _m, color), lens: b.lens });
    }
    return h;
  }
  move(h, cf) {
    cf.toMatrix4(_m);
    for (const [p, s] of h.slots) {
      p.mesh.setMatrixAt(s.index, _m);
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  setLens(h, on) {
    h.lensOn = on;
    for (const [p, s] of h.slots) {
      if (s.lens) {
        p.mesh.setColorAt(s.index, lensColor(on));
        p.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  remove(h) {
    for (const [p, s] of h.slots) p.remove(s.index);
    h.slots.clear();
  }
  clear() {
    for (const p of this.pools.values()) {
      this.scene.remove(p.mesh);
      p.mesh.dispose();
    }
    this.pools.clear();
  }
  stats() {
    let draws = 0, inst = 0;
    for (const p of this.pools.values()) if (p.count) { draws++; inst += p.count; }
    return { draws, instances: inst };
  }
}

const LENS_ON = new THREE.Color(1.6, 1.6, 1.6);
const LENS_OFF = new THREE.Color(0.28, 0.28, 0.28);
export function lensColor(on) {
  return on ? LENS_ON : LENS_OFF;
}
