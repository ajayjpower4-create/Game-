// Draws the running site from the simulation: ground, environment, crane,
// vehicles, every component (instanced), fasteners, equipment lights.

import * as THREE from "three";
import { CF, v, VY } from "../core/math.js";
import { Config } from "../core/config.js";
import { bus } from "../core/events.js";
import { bucketize, groupFromBuckets, signMeshes, partRgb } from "./meshes.js";
import { Batcher } from "./batcher.js";
import { getMaterial } from "./materials.js";
import { itemParts } from "../sim/components.js";
import * as CM from "../sim/craneMath.js";
import { ROPE_COLOR } from "../world/craneModel.js";

const _m = new THREE.Matrix4();
const variants = new Map();

// cached render buckets for an item variant
export function itemVariant(def, installed) {
  const key = def.id + (installed ? "|i" : "|l");
  let vnt = variants.get(key);
  if (!vnt) {
    const p = itemParts(def, installed);
    vnt = { key, buckets: bucketize(p.parts), signs: p.signs, lights: p.lights };
    variants.set(key, vnt);
  }
  return vnt;
}

function cfToObject(obj, cf) {
  cf.toMatrix4(obj.matrix);
  obj.matrixAutoUpdate = false;
  obj.matrixWorldNeedsUpdate = true;
}

// Static Node tree -> THREE.Group (children keep their own frames)
export function nodeToGroup(node) {
  const g = groupFromBuckets(bucketize(node.b.parts), signMeshes(node.b.signs));
  g.name = node.name;
  cfToObject(g, node.cf);
  node.object = g;
  for (const c of node.children) g.add(nodeToGroup(c));
  return g;
}

// soft irregular blob used for mud patches on the graded lot
let splat = null;
function splatTexture() {
  if (splat) return splat;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = x / 128 - 1, dy = y / 128 - 1;
      const a = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy) / (0.78 + 0.12 * Math.sin(a * 3 + 1) + 0.07 * Math.sin(a * 7));
      const v = Math.max(0, Math.min(1, (1 - r) * 4)) * 255;
      const i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  splat = new THREE.CanvasTexture(c);
  return splat;
}

const FASTENER_GEOM = {
  Bolt: () => new THREE.CylinderGeometry(0.03, 0.03, 0.045, 6).rotateX(Math.PI / 2),
  Weld: () => new THREE.BoxGeometry(0.055, 0.055, 0.02),
  Wedge: () => new THREE.BoxGeometry(0.02, 0.075, 0.04),
  Screed: () => new THREE.CylinderGeometry(0.75, 0.75, 0.008, 24).rotateX(Math.PI / 2),
};
const FASTENER_COLOR = { Bolt: 0x3e4042, Weld: 0x3a3836, Wedge: 0x464a4f, Screed: 0xc4c2bc };

export class SiteView {
  constructor(renderer, game) {
    this.r = renderer;
    this.g = game;
    this.scene = renderer.scene;
    this.root = new THREE.Group();
    this.root.name = "Site";
    this.scene.add(this.root);
    this.batcher = new Batcher(this.root);
    this.handles = new Map(); // comp id -> { h, variantKey, fast: [] }
    this.fastPools = {};
    this.trailerViews = new Map();
    this.compLights = new Map();
    this.streetLights = [];
    bus.on("site", (kind) => {
      if (kind === "loaded") this.build();
      else if (kind === "unload") this.clear();
      else if (kind === "clock") this.applyClock();
      else if (kind === "dunnage") this.addDunnage();
    });
    bus.on("comp", (kind, comp) => this.onComp(kind, comp));
    bus.on("trailer", (kind, t) => this.onTrailer(kind, t));
  }

  clear() {
    this.batcher.clear();
    this.handles.clear();
    for (const p of Object.values(this.fastPools)) {
      this.root.remove(p.mesh);
      p.mesh.dispose();
    }
    this.fastPools = {};
    for (const tv of this.trailerViews.values()) this.root.remove(tv.group);
    this.trailerViews.clear();
    for (const l of this.compLights.values()) this.root.remove(l);
    this.compLights.clear();
    this.streetLights = [];
    while (this.root.children.length) {
      const c = this.root.children[0];
      this.root.remove(c);
      c.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      });
    }
    this.crane = null;
    this.machine = null;
    this.dunnageGroup = null;
  }

  build() {
    this.clear();
    const g = this.g;
    const site = g.site;
    const env = site.env;
    if (env) {
      this.root.add(this.terrainMesh(env.terrain));
      const e = groupFromBuckets(bucketize(env.env.b.parts), signMeshes(env.env.b.signs));
      e.name = "Environment";
      this.root.add(e);
      const s = groupFromBuckets(bucketize(env.surroundings.b.parts, { opaqueGlass: true }), signMeshes(env.surroundings.b.signs));
      s.name = "Surroundings";
      this.root.add(s);
      // street lights (switched with the time of day)
      for (const l of env.lights) {
        const sl = new THREE.SpotLight(l.color, 0, l.range * 1.4, (l.angle / 2) * (Math.PI / 180), 0.6, 1.4);
        sl.position.set(l.pos.x, l.pos.y, l.pos.z);
        sl.target.position.set(l.pos.x, 0, l.pos.z);
        this.root.add(sl, sl.target);
        this.streetLights.push(sl);
      }
    }
    if (site.laydownDunnage) this.addDunnage();
    if (g.crane) this.buildCrane(g.crane);
    if (g.telehandler) this.buildMachine(g.telehandler);
    for (const t of g.delivery.trailers.values()) this.onTrailer("spawn", t);
    for (const c of g.world.records()) this.syncComp(c);
    this.applyClock();
  }

  addDunnage() {
    const parts = this.g.site.laydownDunnage;
    if (!parts || this.dunnageGroup) return;
    this.dunnageGroup = groupFromBuckets(bucketize(parts));
    this.root.add(this.dunnageGroup);
  }

  terrainMesh(terrain) {
    const group = new THREE.Group();
    group.name = "Terrain";
    terrain.patches.forEach((p, i) => {
      const geo = new THREE.PlaneGeometry(p.sx, p.sz, 1, 1).rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      const tile = 3;
      if (p.mat !== "Mud") for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * p.sx) / tile, (uv.getY(k) * p.sz) / tile);
      const base = getMaterial(p.mat, 0, 0).clone();
      if (p.mat === "Mud") {
        base.alphaMap = splatTexture();
        base.transparent = true;
        base.depthWrite = false;
      }
      base.vertexColors = false;
      base.color = new THREE.Color().setRGB(...partRgb(p.color));
      base.polygonOffset = true;
      base.polygonOffsetFactor = -i * 2;
      base.polygonOffsetUnits = -i * 4;
      const m = new THREE.Mesh(geo, base);
      m.receiveShadow = true;
      cfToObject(m, p.cf);
      m.renderOrder = i;
      group.add(m);
    });
    if (terrain.water) {
      const w = terrain.water;
      const geo = new THREE.PlaneGeometry(w.width, 600).rotateX(-Math.PI / 2);
      const mat = getMaterial("Water");
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, w.y, w.minZ + 300);
      group.add(m);
      // quay face below the edge
      const q = new THREE.Mesh(new THREE.BoxGeometry(w.width, 3, 0.5), getMaterial("Concrete").clone());
      q.material.vertexColors = false;
      q.material.color.setRGB(...partRgb(0x96928a));
      q.position.set(0, -1.5, w.minZ);
      group.add(q);
    }
    return group;
  }

  // ---------------------------------------------------------------------------
  // Components
  // ---------------------------------------------------------------------------
  onComp(kind, comp) {
    if (kind === "remove") {
      const h = this.handles.get(comp.id);
      if (h) {
        this.batcher.remove(h.h);
        this.clearFasteners(h);
        this.handles.delete(comp.id);
      }
      this.setCompLight(comp, false);
      return;
    }
    if (kind === "move") {
      const h = this.handles.get(comp.id);
      if (h) {
        this.batcher.move(h.h, comp.cf);
        if (h.fast.length) this.syncFasteners(comp, h);
        const l = this.compLights.get(comp.id);
        if (l) this.placeCompLight(comp, l);
        return;
      }
    }
    this.syncComp(comp);
  }

  syncComp(comp) {
    let h = this.handles.get(comp.id);
    const vnt = itemVariant(comp.def, comp.installedLook);
    const tint = new THREE.Color(1 + comp.tint, 1 + comp.tint, 1 + comp.tint);
    if (!h || h.variantKey !== vnt.key) {
      if (h) {
        this.batcher.remove(h.h);
        this.clearFasteners(h);
      }
      h = { h: this.batcher.add(vnt, comp.cf, { color: tint, lensOn: comp.on }), variantKey: vnt.key, fast: [], mask: null };
      this.handles.set(comp.id, h);
    } else {
      this.batcher.move(h.h, comp.cf);
    }
    this.batcher.setLens(h.h, !!comp.on);
    this.syncFasteners(comp, h);
    this.setCompLight(comp, !!comp.on && comp.lights && comp.lights.length > 0);
  }

  fastPool(type) {
    let p = this.fastPools[type];
    if (!p) {
      const geo = FASTENER_GEOM[type] ? FASTENER_GEOM[type]() : FASTENER_GEOM.Bolt();
      const mat = new THREE.MeshStandardMaterial({ color: FASTENER_COLOR[type] || 0x404244, metalness: type === "Screed" ? 0 : 0.6, roughness: type === "Screed" ? 0.35 : 0.45, polygonOffset: type === "Screed", polygonOffsetFactor: -2 });
      const mesh = new THREE.InstancedMesh(geo, mat, 4096);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = type !== "Screed";
      mesh.receiveShadow = true;
      this.root.add(mesh);
      p = this.fastPools[type] = { mesh, owners: [] };
    }
    return p;
  }

  clearFasteners(h) {
    for (const f of h.fast) this.removeFast(f);
    h.fast = [];
    h.mask = null;
  }
  removeFast(f) {
    const p = this.fastPools[f.type];
    const last = p.mesh.count - 1;
    if (f.index !== last) {
      p.mesh.getMatrixAt(last, _m);
      p.mesh.setMatrixAt(f.index, _m);
      const moved = p.owners[last];
      p.owners[f.index] = moved;
      moved.index = f.index;
    }
    p.owners.length = last;
    p.mesh.count = last;
    p.mesh.instanceMatrix.needsUpdate = true;
  }

  // visible nuts / welds / wedges for every fastener made
  syncFasteners(comp, h) {
    const def = comp.def;
    const show = comp.state === "Placed" || comp.state === "Installed";
    const mask = show ? comp.fastened : "";
    if (h.mask !== mask) {
      this.clearFasteners(h);
      h.mask = mask;
      def.fasteners.forEach((f, i) => {
        if (mask[i] !== "1") return;
        const p = this.fastPool(f.type);
        if (p.mesh.count >= 4096) return;
        const rec = { type: f.type, index: p.mesh.count, f };
        p.owners[rec.index] = rec;
        p.mesh.count++;
        h.fast.push(rec);
      });
    }
    for (const rec of h.fast) {
      const f = rec.f;
      const cf = comp.cf.mul(CF.lookAlong(f.pos, f.normal || v(0, 0, 1)));
      cf.toMatrix4(_m);
      const p = this.fastPools[rec.type];
      p.mesh.setMatrixAt(rec.index, _m);
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setCompLight(comp, on) {
    const cur = this.compLights.get(comp.id);
    if (!on) {
      if (cur) {
        this.root.remove(cur);
        this.compLights.delete(comp.id);
      }
      return;
    }
    if (cur) return this.placeCompLight(comp, cur);
    const L = comp.lights[0];
    let light;
    if (L.type === "spot") {
      light = new THREE.SpotLight(L.color, 60 * L.brightness, L.range * 1.5, ((L.angle || 60) / 2) * (Math.PI / 180), 0.5, 1.2);
      light.castShadow = !!L.shadows && this.r.preset.shadows;
      light.shadow.mapSize.set(512, 512);
      this.root.add(light.target);
    } else {
      light = new THREE.PointLight(L.color, 6 * L.brightness, L.range * 2, 1.4);
    }
    light.userData.def = L;
    this.root.add(light);
    this.compLights.set(comp.id, light);
    this.placeCompLight(comp, light);
  }
  placeCompLight(comp, light) {
    const L = light.userData.def;
    const cf = comp.cf.mul(L.part.cf);
    light.position.set(cf.x, cf.y, cf.z);
    if (light.isSpotLight) {
      const t = cf.point(v(0, 0, -10));
      light.target.position.set(t.x, t.y, t.z);
      light.target.updateMatrixWorld();
    }
  }

  // ---------------------------------------------------------------------------
  // Trailers
  // ---------------------------------------------------------------------------
  onTrailer(kind, t) {
    if (kind === "remove") {
      const tv = this.trailerViews.get(t.id);
      if (tv) this.root.remove(tv.group);
      this.trailerViews.delete(t.id);
      return;
    }
    if (kind === "spawn" && !this.trailerViews.has(t.id)) {
      const group = nodeToGroup(t.model);
      this.root.add(group);
      const wheels = [];
      t.model.find("Wheels")?.children.forEach((w) => wheels.push({ obj: w.object, base: w.cf.clone ? w.cf : w.cf, r: w.attrs.radius || 0.5 }));
      if (t.loco) t.loco.find("Wheels")?.children.forEach((w) => wheels.push({ obj: w.object, base: w.cf, r: w.attrs.radius || 0.5 }));
      this.trailerViews.set(t.id, { group, wheels, version: t.version, strapsObj: group.children.find((c) => c.name === "Straps") });
    }
    if (kind === "strap" || kind === "spawn") {
      const tv = this.trailerViews.get(t.id);
      if (tv && tv.version !== t.version) {
        if (tv.strapsObj) tv.group.remove(tv.strapsObj);
        const node = t.model.children.find((c) => c.name === "Straps");
        tv.strapsObj = node ? nodeToGroup(node) : null;
        if (tv.strapsObj) tv.group.add(tv.strapsObj);
        tv.version = t.version;
      }
    }
  }

  updateTrailers() {
    for (const t of this.g.delivery.trailers.values()) {
      const tv = this.trailerViews.get(t.id);
      if (!tv) continue;
      cfToObject(tv.group, this.g.delivery.vehicleCf(t));
      const travel = t.wheelTravel || 0;
      for (const w of tv.wheels) cfToObject(w.obj, w.base.mul(CF.angles(-travel / w.r, 0, 0)));
    }
  }

  // ---------------------------------------------------------------------------
  // Crane
  // ---------------------------------------------------------------------------
  buildCrane(crane) {
    const n = crane.nodes;
    const st = nodeToGroup(n.static);
    const slew = nodeToGroup(n.slew);
    const trolley = nodeToGroup(n.trolley);
    const hook = nodeToGroup(n.hook);
    this.root.add(st, slew, trolley, hook);
    const ropeMat = new THREE.MeshStandardMaterial({ color: ROPE_COLOR, metalness: 0.6, roughness: 0.5 });
    const slingMat = new THREE.MeshStandardMaterial({ color: 0xe6781e, roughness: 0.9 });
    const mk = (mat, d) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, 1, 8, 1), mat);
      m.castShadow = true;
      m.matrixAutoUpdate = false;
      this.root.add(m);
      return m;
    };
    this.crane = {
      c: crane,
      slew,
      trolley,
      hook,
      falls: [mk(ropeMat, 0.033), mk(ropeMat, 0.033)],
      slings: [mk(slingMat, 0.04), mk(slingMat, 0.04)],
      beacon: null,
    };
    // red aviation lights glow at night
    this.crane.aviation = [];
    slew.traverse((o) => {
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial) this.crane.aviation.push(o);
    });
  }

  placeCyl(mesh, a, b) {
    const d = b.sub(a);
    const len = d.len;
    if (len < 0.01) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    // cylinder axis is Y
    const cf = CF.lookAlong(a.add(b).mul(0.5), d).mul(CF.angles(Math.PI / 2, 0, 0));
    cf.toMatrix4(mesh.matrix);
    mesh.matrix.scale(new THREE.Vector3(1, len, 1));
    mesh.matrixWorldNeedsUpdate = true;
  }

  updateCrane() {
    const v3 = this.crane;
    if (!v3) return;
    const c = v3.c, cfg = c.cfg, st = c.st;
    cfToObject(v3.slew, CM.slewCf(cfg, st.slew));
    const tcf = CM.trolleyCf(cfg, st);
    cfToObject(v3.trolley, tcf);
    const bcf = CM.blockCf(cfg, st);
    cfToObject(v3.hook, bcf);
    this.placeCyl(v3.falls[0], tcf.point(v(-0.15, 0.067, 0)), bcf.point(v(-0.15, 0.967, 0)));
    this.placeCyl(v3.falls[1], tcf.point(v(0.15, 0.067, 0)), bcf.point(v(0.15, 0.967, 0)));
    const load = c.load();
    for (let i = 0; i < 2; i++) {
      const lp = load && load.def.liftPoints[i];
      if (lp) this.placeCyl(v3.slings[i], bcf.pos, load.cf.point(lp));
      else v3.slings[i].visible = false;
    }
  }

  applyClock() {
    const site = this.g.site;
    if (!site.def) return;
    const L = site.def.lighting;
    this.r.setTimeOfDay(site.clock, L.latitude, L.tint, L.haze, L.density);
    const night = site.isNight();
    for (const sl of this.streetLights) sl.intensity = night ? 120 : 0;
  }

  buildMachine(m) {
    const group = nodeToGroup(m.model);
    this.root.add(group);
    const wheels = m.model.find("Wheels").children.map((w) => ({ obj: w.object, base: w.cf, r: w.attrs.radius, front: w.attrs.front }));
    this.machine = { m, group, wheels, boom: m.model.find("Boom").object, inner: m.model.find("Inner").object, carriage: m.model.find("Carriage").object };
  }

  updateMachine() {
    const mv = this.machine;
    if (!mv) return;
    const m = mv.m;
    cfToObject(mv.group, m.frame());
    cfToObject(mv.boom, m.boomCf());
    cfToObject(mv.inner, CF.at(m.ext, 0, 0));
    cfToObject(mv.carriage, m.forkLocal());
    for (const w of mv.wheels) cfToObject(w.obj, CF.at(w.base.x, w.base.y, w.base.z).mul(CF.angles(0, w.front ? m.steer : 0, 0)).mul(w.base.rot).mul(CF.angles(-m.wheelTravel / w.r, 0, 0)));
  }

  update() {
    this.updateTrailers();
    this.updateCrane();
    this.updateMachine();
  }
}
