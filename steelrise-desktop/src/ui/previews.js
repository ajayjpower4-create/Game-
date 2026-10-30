// Off-screen renderer for catalog thumbnails and the 3D site previews in the
// menu. Item thumbnails are real renders of each item's model; site
// previews are built from the same layout data as the playable site.

import * as THREE from "three";
import { CF, v, Rng, hashString } from "../core/math.js";
import { Config } from "../core/config.js";
import { Registry } from "../data/items.js";
import { stageEntries, getSite } from "../data/sites.js";
import { itemVariant } from "../render/siteView.js";
import { groupFromBuckets, partRgb } from "../render/meshes.js";

let R = null;
let scene, cam, sun;
const thumbs = new Map();
const queue = [];

function init() {
  if (R) return;
  const canvas = document.createElement("canvas");
  R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2e32);
  cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 3000);
  sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(3, 5, 4);
  scene.add(sun, new THREE.HemisphereLight(0xd8e4f2, 0x3a3630, 1.4));
  const pm = new THREE.PMREMGenerator(R);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x8fa0b0);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0xb8c8d8, side: THREE.BackSide }));
  env.add(sky);
  scene.environment = pm.fromScene(env).texture;
}

function frame(obj, w, h, yaw = -0.7, pitch = 0.42, opts = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.length() / 2, 0.05);
  const d = (r / Math.sin((cam.fov * Math.PI) / 360)) * (opts.zoom || 1.02);
  cam.aspect = w / h;
  cam.near = d / 50;
  cam.far = d * 6;
  cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
  cam.lookAt(c);
  cam.updateProjectionMatrix();
}

function snapshot(obj, w, h, opts = {}) {
  init();
  R.setSize(w, h, false);
  scene.add(obj);
  frame(obj, w, h, opts.yaw, opts.pitch, opts);
  R.render(scene, cam);
  scene.remove(obj);
  return R.domElement.toDataURL("image/jpeg", 0.86);
}

export function itemThumb(id) {
  if (thumbs.has(id)) return thumbs.get(id);
  const def = Registry.get(id);
  if (!def) return "";
  const g = groupFromBuckets(itemVariant(def, true).buckets);
  const url = snapshot(g, 200, 150, { yaw: def.kind === "Tool" ? -1.2 : -0.75, pitch: def.kind === "Span" ? 0.5 : 0.38 });
  thumbs.set(id, url);
  return url;
}

// lazy thumbnails: images with data-thumb are filled a few per frame
export function requestThumb(img, id) {
  if (thumbs.has(id)) {
    img.src = thumbs.get(id);
    return;
  }
  queue.push({ img, id });
}
export function pumpThumbs(budgetMs = 6) {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < budgetMs) {
    const { img, id } = queue.shift();
    if (!img.isConnected) continue;
    img.src = itemThumb(id);
  }
}
export function clearThumbQueue() {
  queue.length = 0;
}

// --- site previews --------------------------------------------------------------
const GROUND = { Rural: 0x76684f, Suburban: 0x687056, Downtown: 0x606062, Waterfront: 0x6e6a64, Industrial: 0x66625c, CityCenter: 0x5c5e62, Residential: 0x6c6e5c, HighRise: 0x606264 };
const NEIGHBOUR_H = { Rural: [0, 0], Suburban: [7, 15], Downtown: [30, 73], Waterfront: [10, 27], Industrial: [10, 17], CityCenter: [50, 110], Residential: [8, 20], HighRise: [40, 100] };

const box = (w, h, d, color, x, y, z, opacity = 1) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, transparent: opacity < 1, opacity }));
  m.position.set(x, y, z);
  return m;
};

const siteGroups = new Map();
export function sitePreviewGroup(siteId) {
  if (siteGroups.has(siteId)) return siteGroups.get(siteId);
  const site = getSite(siteId);
  const g = new THREE.Group();
  const lot = site.lotM;
  g.add(box(lot.x, 0.3, lot.z, GROUND[site.style] || 0x6e6a5c, 0, -0.15, 0));
  g.add(box(lot.x + 20, 0.2, 13, 0x34363a, 0, -0.2, -lot.z / 2 - 6.7));
  for (const s of [-1, 1]) {
    g.add(box(lot.x, 2, 0.1, 0x3c5040, 0, 1, (s * lot.z) / 2, 0.5));
    g.add(box(0.1, 2, lot.z, 0x3c5040, (s * lot.x) / 2, 1, 0, 0.5));
  }
  // installed starting stage, one proxy per component, decks merged per bay
  const decks = new Map();
  const tmp = new THREE.Matrix4();
  const byColor = new Map();
  for (const e of stageEntries(site)) {
    const def = Registry.get(e.item);
    if (!def) continue;
    if (e.group) {
      if (!decks.has(e.group)) decks.set(e.group, { def, cfs: [] });
      decks.get(e.group).cfs.push(e.cf);
      continue;
    }
    const color = def.proxyColor || Config.Colors.Steel;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push(e.cf.mul(CF.from(def.boundsOffset)), def.size);
  }
  for (const [color, list] of byColor) {
    const n = list.length / 2;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...partRgb(color)), roughness: 0.6, metalness: 0.3 }), n);
    for (let i = 0; i < n; i++) {
      const cf = list[i * 2], s = list[i * 2 + 1];
      cf.toMatrix4(tmp);
      tmp.scale(new THREE.Vector3(s.x, s.y, s.z));
      mesh.setMatrixAt(i, tmp);
    }
    g.add(mesh);
  }
  for (const d of decks.values()) {
    const first = d.cfs[0].pos, last = d.cfs[d.cfs.length - 1].pos;
    const mid = first.add(last).mul(0.5);
    const width = last.dist(first) + Config.Geo.DeckWidth;
    g.add(box(d.def.size.x, 0.12, width, 0xa4a9ac, mid.x, mid.y + 0.06, mid.z));
  }
  // faint outline of the finished building
  if (site.grid) {
    const gr = site.grid;
    const w = gr.nx * gr.bayX, dp = gr.nz * gr.bayZ, h = gr.floors * gr.floorH;
    g.add(box(w, h, dp, 0x6eaaeb, gr.originM.x + w / 2, Config.Geo.FootingTop + h / 2, gr.originM.z + dp / 2, 0.14));
  }
  // crane silhouette
  const c = site.crane;
  const yellow = 0xf0b212;
  g.add(box(1.6, c.heightM, 1.6, yellow, c.posM.x, c.heightM / 2, c.posM.z));
  const slew = new THREE.Group();
  slew.position.set(c.posM.x, c.heightM + 1, c.posM.z);
  slew.rotation.y = ((c.slewDeg || 0) * Math.PI) / 180;
  slew.add(box(c.jibM, 1.3, 1.3, yellow, c.jibM / 2, 0, 0));
  slew.add(box(c.counterM, 1.3, 1.7, yellow, -c.counterM / 2, 0, 0));
  slew.add(box(2, 2, 2.7, 0x969692, -c.counterM + 1, -0.7, 0));
  g.add(slew);
  for (const b of site.bays) {
    const t = box(16, 1.4, 2.6, 0x464a50, 0, 0.8, 0);
    b.mul(CF.at(0, 0, 0)).toMatrix4(tmp);
    t.applyMatrix4(tmp);
    g.add(t);
  }
  const rng = new Rng(hashString(siteId));
  const [lo, hi] = NEIGHBOUR_H[site.style] || [0, 0];
  if (hi > 0) {
    for (let k = 1; k <= 10; k++) {
      const ang = (k / 10) * Math.PI * 2;
      const r = Math.max(lot.x, lot.z) / 2 + 20 + rng.num(0, 20);
      const bh = rng.num(lo, hi);
      const z = Math.sin(ang) * r;
      if (site.style === "Waterfront" && z > lot.z / 2) continue;
      g.add(box(rng.num(13, 27), bh, rng.num(13, 27), 0x787c82, Math.cos(ang) * r, bh / 2, z, 0.95));
    }
  }
  if (site.style === "Waterfront") g.add(box(lot.x + 130, 0.2, 100, 0x28465a, 0, -0.4, lot.z / 2 + 50));
  siteGroups.set(siteId, g);
  return g;
}

const siteShots = new Map();
export function siteSnapshot(siteId) {
  if (!siteShots.has(siteId)) siteShots.set(siteId, snapshot(sitePreviewGroup(siteId), 400, 225, { yaw: -0.6, pitch: 0.55, zoom: 0.62 }));
  return siteShots.get(siteId);
}

// live rotating preview into a 2D canvas
export function renderSiteInto(canvas, siteId, t) {
  init();
  const w = canvas.clientWidth || 640, h = canvas.clientHeight || 360;
  R.setSize(w, h, false);
  const g = sitePreviewGroup(siteId);
  scene.add(g);
  frame(g, w, h, -0.6 + t * 0.15, 0.55, { zoom: 0.62 });
  R.render(scene, cam);
  scene.remove(g);
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.getContext("2d").drawImage(R.domElement, 0, 0, w, h);
}
