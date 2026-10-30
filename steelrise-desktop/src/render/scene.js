// Renderer, sky, sun and post-processing. One WebGL renderer for the game;
// graphics presets switch shadows, ambient occlusion, bloom and resolution.

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Config } from "../core/config.js";
import { clamp } from "../core/math.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 2500);
    this.camera.position.set(0, 2, 10);

    // sky dome
    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    this.scene.add(this.sky);

    // stars for night
    this.stars = makeStars();
    this.scene.add(this.stars);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 900;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd2ee, 0x5a5244, 0.9);
    this.scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0xc7cfd8, 0.0018);
    this.scene.fog = this.fog;

    this.pmrem = new THREE.PMREMGenerator(r);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(100);
    this.envScene.add(this.envSky);
    this.envRT = null;

    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
    this.focus = new THREE.Vector3();
    this.shadowExtent = 70;
    this.preset = Config.Graphics.Presets.Balanced;
    this.composer = null;
    this.night = false;
    this.lightLevel = 1;
    this.applySize();
    window.addEventListener("resize", () => this.applySize());
  }

  applySize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    if (this.gtao) this.gtao.setSize(w, h);
  }

  setGraphics(name, settings = {}) {
    const p = { ...(Config.Graphics.Presets[name] || Config.Graphics.Presets.Balanced) };
    if (settings.shadows === false) p.shadows = false;
    if (settings.post === false) p.post = false;
    this.preset = p;
    this.presetName = name;
    const r = this.renderer;
    r.setPixelRatio(Math.min((window.devicePixelRatio || 1) * p.pixelRatio, 2));
    r.shadowMap.enabled = p.shadows;
    this.sun.castShadow = p.shadows;
    if (p.shadows) {
      this.sun.shadow.mapSize.set(p.shadowSize, p.shadowSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.shadowExtent = p.shadowSize >= 4096 ? 90 : 70;
    this.camera.far = Math.max(600, p.viewDistance * 1.6);
    this.camera.updateProjectionMatrix();
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    this.buildComposer();
  }

  buildComposer() {
    if (this.composer) {
      this.composer.dispose?.();
      this.composer = null;
      this.gtao = null;
    }
    if (!this.preset.post) return;
    const w = window.innerWidth, h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(this.renderer, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    if (this.presetName === "High" || this.presetName === "Ultra") {
      const ao = new GTAOPass(this.scene, this.camera, w, h);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1, samples: this.presetName === "Ultra" ? 16 : 10 });
      c.addPass(ao);
      this.gtao = ao;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.5, 0.92);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.composer = c;
  }

  // Sun position from local time and latitude (simple solar model).
  setTimeOfDay(clock, latitude = 40, tint = 0xfff8f0, haze = 1, density = 0.3) {
    const decl = 0.25; // late spring
    const lat = (latitude * Math.PI) / 180;
    const hourAngle = ((clock - 12) / 24) * Math.PI * 2;
    const elev = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle));
    const az = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
    // +X east, -Z north (sun in the south at noon)
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
    this.sunDir.copy(dir);
    this.elevation = elev;
    const day = clamp((elev + 0.1) / 0.35, 0, 1);
    this.night = elev < -0.05;
    this.lightLevel = day;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(dir);
    u.turbidity.value = 3 + haze * 2.5;
    u.rayleigh.value = elev < 0.2 ? 2.4 : 1.3;
    const warm = clamp(1 - elev / 0.45, 0, 1);
    const sunCol = new THREE.Color(tint).lerp(new THREE.Color(0xffa25a), warm * 0.75);
    this.sun.color.copy(sunCol);
    this.sun.intensity = 3.2 * day;
    this.hemi.intensity = 0.25 + 0.75 * day;
    this.hemi.color.set(0xbcd2ee).lerp(new THREE.Color(0x2a3550), 1 - day);
    this.hemi.groundColor.set(0x5a5244).lerp(new THREE.Color(0x14161a), 1 - day);
    this.stars.material.opacity = clamp(-elev * 6, 0, 1);
    this.stars.visible = this.stars.material.opacity > 0.01;
    // moonlight at night
    if (this.night) {
      this.sunDir.set(-0.3, 0.8, -0.4).normalize();
      this.sun.color.set(0x8aa0d0);
      this.sun.intensity = 0.35;
    }
    const fogDay = new THREE.Color(0xc4ccd6).lerp(new THREE.Color(0xe0b896), warm * 0.4);
    this.fog.color.copy(fogDay).lerp(new THREE.Color(0x0b0e14), 1 - day);
    this.fog.density = 0.0006 + density * 0.0032 * (0.6 + haze * 0.4);
    this.renderer.toneMappingExposure = 0.9 + (1 - day) * 0.5;
    this.updateEnvMap();
  }

  updateEnvMap() {
    const u = this.envSky.material.uniforms;
    const src = this.sky.material.uniforms;
    for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"]) u[k].value = src[k].value;
    u.sunPosition.value.copy(src.sunPosition.value);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.25 + 0.75 * this.lightLevel;
  }

  // Keep the shadow frustum centred on the player, snapped to texels.
  updateShadows(focus) {
    const ext = this.shadowExtent;
    const cam = this.sun.shadow.camera;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.updateProjectionMatrix();
    const texel = (ext * 2) / this.sun.shadow.mapSize.x;
    const f = focus.clone();
    f.x = Math.round(f.x / texel) * texel;
    f.z = Math.round(f.z / texel) * texel;
    this.sun.target.position.copy(f);
    this.sun.position.copy(f).addScaledVector(this.sunDir, 400);
    this.sun.target.updateMatrixWorld();
  }

  render() {
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    if (this.bloom) this.bloom.strength = this.night ? 0.8 : 0.28;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

function makeStars() {
  const n = 1800;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[i * 3] = r * Math.cos(th) * 1800;
    pos[i * 3 + 1] = Math.abs(u) * 1800;
    pos[i * 3 + 2] = r * Math.sin(th) * 1800;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}
