// Sky, sun, fog and precipitation for the chosen weather.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeCanvas, canvasTexture, fbmTiling, mulberry32, clamp } from './util.js';

export const WEATHERS = [
  { id: 'clear', name: 'Sunny', desc: 'Blue sky, hard shadows, dry roads.', cloud: 0.06, sun: 2.6, hemi: 0.42, fog: 0.0007, exposure: 0.58, envI: 0.55, wet: 0, grip: 1, rain: 0, snow: 0, elev: 50, fogColor: 0xbfd2e6 },
  { id: 'partly', name: 'Partly Cloudy', desc: 'Puffy clouds drifting over the skyline.', cloud: 0.45, sun: 2.3, hemi: 0.48, fog: 0.0009, exposure: 0.6, envI: 0.55, wet: 0, grip: 1, rain: 0, snow: 0, elev: 45, fogColor: 0xc4d3e2 },
  { id: 'overcast', name: 'Overcast', desc: 'Flat gray light, soft shadows.', cloud: 0.92, sun: 0.55, hemi: 0.95, fog: 0.0015, exposure: 0.7, envI: 0.5, wet: 0.1, grip: 1, rain: 0, snow: 0, elev: 40, fogColor: 0xaeb5bd },
  { id: 'rain', name: 'Rain', desc: 'Steady rain, slick asphalt, longer stops.', cloud: 1, sun: 0.3, hemi: 0.85, fog: 0.0032, exposure: 0.72, envI: 0.5, wet: 1, grip: 0.82, rain: 1, snow: 0, elev: 38, fogColor: 0x8e979f },
  { id: 'storm', name: 'Thunderstorm', desc: 'Downpour, lightning, standing water.', cloud: 1, sun: 0.15, hemi: 0.65, fog: 0.0048, exposure: 0.76, envI: 0.45, wet: 1, grip: 0.75, rain: 1.8, snow: 0, elev: 35, fogColor: 0x6d757d, lightning: true },
  { id: 'fog', name: 'Fog', desc: 'Pea soup off the bay. Headlights on.', cloud: 0.95, sun: 0.35, hemi: 0.95, fog: 0.0125, exposure: 0.72, envI: 0.5, wet: 0.35, grip: 0.95, rain: 0, snow: 0, elev: 30, fogColor: 0xb4b8bb },
  { id: 'snow', name: 'Snow', desc: 'Snow coming down, slush in the lanes, low grip.', cloud: 1, sun: 0.4, hemi: 1.05, fog: 0.004, exposure: 0.68, envI: 0.55, wet: 0.5, grip: 0.58, rain: 0, snow: 1, elev: 32, fogColor: 0xc9ced3 },
];
export const WEATHER_BY_ID = Object.fromEntries(WEATHERS.map((w) => [w.id, w]));

function cloudTexture(seed = 5) {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const n = fbmTiling(seed, 4, 6);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = n(x / W, y / H);
    const i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = clamp((v - 0.45) * 4, 0, 1) * 255;
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c, { repeat: true });
}

export class Weather {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.sky = new Sky();
    this.sky.scale.setScalar(9000);
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xfff4e5, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const cam = this.sun.shadow.camera;
    cam.left = -95; cam.right = 95; cam.top = 95; cam.bottom = -95; cam.near = 1; cam.far = 600;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xc9dcf2, 0x5a5348, 0.8);
    scene.add(this.hemi);
    // Cloud dome.
    const ct = cloudTexture();
    ct.repeat.set(3, 1.5);
    this.cloudMat = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false, color: 0xffffff });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), this.cloudMat);
    this.clouds.renderOrder = -1;
    scene.add(this.clouds);
    this.overcast = new THREE.Mesh(new THREE.SphereGeometry(4800, 32, 16), new THREE.MeshBasicMaterial({ color: 0x9aa2aa, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(this.overcast);
    scene.fog = new THREE.FogExp2(0xbfd2e6, 0.001);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.rain = null;
    this.snow = null;
    this.flash = 0;
    this.nextFlash = 6;
    this.time = 0;
    this.def = WEATHERS[0];
    this.wetMats = [];
  }

  // Road/sidewalk materials get darker and glossier when wet.
  registerWet(materials) {
    this.wetMats = materials.map((m) => ({ m, rough: m.roughness, color: m.color.clone(), env: m.envMapIntensity }));
  }

  set(id) {
    const w = WEATHER_BY_ID[id] ?? WEATHERS[0];
    this.def = w;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 2 + w.cloud * 8;
    u.rayleigh.value = 1.2 + w.cloud * 1.5;
    u.mieCoefficient.value = 0.004 + w.cloud * 0.01;
    u.mieDirectionalG.value = 0.85;
    // The sun disc is ~1e7 bright; in half-float buffers that overflows to
    // Inf and turns the bloom and the baked reflections into NaN (black).
    u.showSunDisc.value = 0;
    // The sky shader draws its own clouds; coverage follows the weather.
    u.cloudCoverage.value = Math.min(0.95, w.cloud);
    u.cloudDensity.value = 0.35 + w.cloud * 0.5;
    u.cloudScale.value = 0.00022;
    u.cloudElevation.value = 0.55;
    const phi = THREE.MathUtils.degToRad(90 - w.elev), theta = THREE.MathUtils.degToRad(155);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);
    this.sun.intensity = w.sun;
    this.sun.color.set(w.cloud > 0.8 ? 0xe9eef2 : 0xfff2df);
    this.hemi.intensity = w.hemi;
    this.hemi.color.set(w.cloud > 0.8 ? 0xb9c2cb : 0xc9dcf2);
    this.clouds.visible = false;
    this.cloudMat.opacity = Math.min(1, w.cloud * 1.2);
    this.cloudMat.color.set(w.cloud > 0.8 ? 0x8c939a : 0xffffff);
    this.overcast.material.opacity = w.cloud > 0.8 ? 0.85 + (w.rain ? 0.1 : 0) : 0;
    this.overcast.material.color.set(w.fogColor);
    this.scene.fog.color.set(w.fogColor);
    this.scene.fog.density = w.fog;
    this.renderer.toneMappingExposure = w.exposure;
    this.sun.castShadow = w.sun > 0.5;
    // Wet surfaces.
    for (const { m, rough, color, env } of this.wetMats) {
      m.roughness = rough * (1 - w.wet * 0.55);
      m.color.copy(color).multiplyScalar(1 - w.wet * 0.25);
      if (w.snow) m.color.lerp(new THREE.Color(0xd9dde2), 0.25);
      m.envMapIntensity = env * (1 + w.wet * 1.4);
      m.needsUpdate = true;
    }
    this.setupPrecip(w);
    this.bakeEnvironment();
  }

  bakeEnvironment() {
    // Reflections come from the sky we just set up (plus clouds).
    const envScene = new THREE.Scene();
    const sky = new Sky();
    sky.scale.setScalar(1000);
    for (const k of Object.keys(this.sky.material.uniforms)) sky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    envScene.add(sky);
    if (this.overcast.material.opacity > 0) {
      const oc = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.MeshBasicMaterial({ color: this.def.fogColor, side: THREE.BackSide, transparent: true, opacity: this.overcast.material.opacity }));
      envScene.add(oc);
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshBasicMaterial({ color: 0x4a4a46 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    envScene.add(ground);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0.02, 0.1, 1200);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = this.def.envI ?? 0.55;
  }

  setupPrecip(w) {
    if (this.rain) { this.scene.remove(this.rain); this.rain.geometry.dispose(); this.rain = null; }
    if (this.snow) { this.scene.remove(this.snow); this.snow.geometry.dispose(); this.snow = null; }
    const rand = mulberry32(9);
    if (w.rain) {
      const N = Math.round(9000 * w.rain);
      const pos = new Float32Array(N * 6);
      this.rainData = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const x = (rand() - 0.5) * 80, y = rand() * 40, z = (rand() - 0.5) * 80;
        this.rainData.set([x, y, z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab4bf, transparent: true, opacity: 0.38, fog: true }));
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
    }
    if (w.snow) {
      const N = 7000;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) pos.set([(rand() - 0.5) * 90, rand() * 45, (rand() - 0.5) * 90], i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const c = makeCanvas(32, 32);
      const cg = c.getContext('2d');
      const grad = cg.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      cg.fillStyle = grad; cg.fillRect(0, 0, 32, 32);
      this.snow = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, map: canvasTexture(c), transparent: true, depthWrite: false, color: 0xffffff }));
      this.snow.frustumCulled = false;
      this.scene.add(this.snow);
    }
  }

  // Keeps the sun's shadow box and precipitation centered on the camera.
  update(dt, camera, focus) {
    this.time += dt;
    const f = focus ?? camera.position;
    const d = this.sunDir;
    // Snap the shadow camera to texel-sized steps to stop shimmering.
    const step = 0.5;
    const fx = Math.round(f.x / step) * step, fz = Math.round(f.z / step) * step;
    this.sun.position.set(fx + d.x * 250, f.y + d.y * 250, fz + d.z * 250);
    this.sun.target.position.set(fx, f.y, fz);
    this.clouds.position.copy(camera.position);
    this.overcast.position.copy(camera.position);
    this.sky.material.uniforms.time.value = this.time;
    const cp = camera.position;
    if (this.rain) {
      const pos = this.rain.geometry.attributes.position.array;
      const data = this.rainData;
      const speed = 22, len = 0.55;
      for (let i = 0; i < data.length / 3; i++) {
        let y = data[i * 3 + 1] - speed * dt;
        if (y < -2) y += 40;
        data[i * 3 + 1] = y;
        const x = cp.x + data[i * 3], z = cp.z + data[i * 3 + 2], yy = cp.y - 12 + y;
        pos[i * 6] = x; pos[i * 6 + 1] = yy; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + 0.06; pos[i * 6 + 4] = yy + len; pos[i * 6 + 5] = z + 0.03;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.snow) {
      const pos = this.snow.geometry.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        let y = pos[i * 3 + 1] - 1.4 * dt;
        if (y < 0) y += 45;
        pos[i * 3 + 1] = y;
        pos[i * 3] += Math.sin(this.time * 0.8 + i) * 0.3 * dt;
      }
      this.snow.position.set(Math.round(cp.x / 90) * 90 + 0, cp.y - 15, Math.round(cp.z / 90) * 90);
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
    // Lightning.
    if (this.def.lightning) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = 1;
        this.nextFlash = 5 + Math.random() * 14;
        this.onThunder?.(1 + Math.random() * 3);
      }
      if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 3.2);
        const k = this.flash > 0.5 ? (Math.random() < 0.5 ? 1 : 0.3) : this.flash;
        this.hemi.intensity = this.def.hemi + k * 4;
      } else this.hemi.intensity = this.def.hemi;
    }
  }

  get grip() { return this.def.grip; }
}
