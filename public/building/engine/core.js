/* The engine: renderer, sky, sun, weather, post-processing and the camera.
 *
 * One WebGL scene in feet (x east, y up, z toward the street). The sun moves
 * with the clock and lights the site through a fitted shadow map; the sky is a
 * physical (Preetham) model with drifting clouds, and the same sky is baked
 * into an environment map so glass, paint and wet tarmac reflect it. After
 * dark, buildings glow from inside and a pool of real lights follows the
 * camera around the lamps nearest to it. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as M from './materials.js';
import { setAnisotropy, glowTexture } from './textures.js';

const DEG = Math.PI / 180;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

export const QUALITY = {
  low: { name: 'Low', ratio: 1, shadow: 2048, msaa: 0, ao: false, bloom: false, smaa: true, lights: 4 },
  medium: { name: 'Medium', ratio: 1.25, shadow: 2048, msaa: 4, ao: false, bloom: true, smaa: false, lights: 6 },
  high: { name: 'High', ratio: 1.5, shadow: 4096, msaa: 4, ao: true, bloom: true, smaa: false, lights: 8 },
  ultra: { name: 'Ultra', ratio: 2, shadow: 8192, msaa: 8, ao: true, bloom: true, smaa: false, lights: 12 },
};

export const WEATHER = {
  clear: { name: 'Clear', icon: '☀️', clouds: 0.12, density: 0.3, turbidity: 1.9, rayleigh: 1.7, mie: 0.004, fog: 0.00011, sun: 1, wet: 0, snow: 0, rain: 0, flakes: 0 },
  cloudy: { name: 'Fair weather cloud', icon: '⛅', clouds: 0.42, density: 0.55, turbidity: 2.8, rayleigh: 1.6, mie: 0.006, fog: 0.00014, sun: 0.85, wet: 0, snow: 0, rain: 0, flakes: 0 },
  overcast: { name: 'Overcast', icon: '☁️', clouds: 0.92, density: 0.95, turbidity: 9, rayleigh: 1.4, mie: 0.02, fog: 0.00022, sun: 0.1, wet: 0, snow: 0, rain: 0, flakes: 0 },
  rain: { name: 'Rain', icon: '🌧️', clouds: 1, density: 1, turbidity: 12, rayleigh: 1.4, mie: 0.03, fog: 0.00045, sun: 0.04, wet: 1, snow: 0, rain: 1, flakes: 0 },
  storm: { name: 'Thunderstorm', icon: '⛈️', clouds: 1, density: 1, turbidity: 16, rayleigh: 1.4, mie: 0.04, fog: 0.0006, sun: 0.02, wet: 1, snow: 0, rain: 1.8, flakes: 0, lightning: true },
  fog: { name: 'Fog', icon: '🌫️', clouds: 0.7, density: 0.7, turbidity: 14, rayleigh: 1.4, mie: 0.05, fog: 0.0024, sun: 0.2, wet: 0.35, snow: 0, rain: 0, flakes: 0 },
  snow: { name: 'Snow', icon: '🌨️', clouds: 0.95, density: 0.9, turbidity: 10, rayleigh: 1.4, mie: 0.03, fog: 0.00042, sun: 0.12, wet: 0, snow: 1, rain: 0, flakes: 1 },
};

export const CAMERA_MODES = ['orbit', 'drone', 'walk'];

/** Where the sun is at a given hour, as an elevation and a unit direction (toward the sun). */
export function sunAt(hour) {
  const t = (hour - 6) / 12;                       // 0 at sunrise, 1 at sunset
  const elev = 58 * Math.sin(Math.PI * t) - (t < 0 || t > 1 ? 6 : 0);
  const az = (90 + t * 180) * DEG;                 // east, south at noon, west
  const e = elev * DEG;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)).normalize();
  return { elev, dir };
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane();

export class Engine {
  constructor(host, { quality = 'high' } = {}) {
    this.host = host;
    this.quality = QUALITY[quality] ? quality : 'high';
    this.env = { hour: 15.5, weather: 'clear', season: 'summer' };
    this.mode = 'orbit';
    this.keys = new Set();
    this.tickers = [];
    this.lightSources = [];
    this.lot = { width: 600, depth: 440 };
    this.clock = new THREE.Timer();
    this.time = 0;
    this.flight = null;
    this.flash = 0;
    this.selectionObjects = [];
    this.fps = 60;
    this.paused = false;
    this.photo = false;
    // Adaptive resolution: the render scale drops when frames run long and
    // climbs back when there is headroom, so the view stays smooth.
    this.autoRes = true;
    this.res = { scale: 1, t: 0, n: 0, good: 0, slow: 0, trial: null, hold: 0 };
    this.shadowAt = -1;
    this.cullAt = 0;
    this.envAt = -9;
    this.envStale = false;

    /* ---- renderer ---- */
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    // Count the whole frame (every pass), not just the last one.
    r.info.autoReset = false;
    r.domElement.className = 'gl';
    r.domElement.tabIndex = 0;
    host.appendChild(r.domElement);
    setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    /* ---- scene ---- */
    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.FogExp2(0xb9c9db, 0.0001);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 16000);
    this.camera.position.set(300, 380, 900);

    this.sky = new Sky();
    this.sky.scale.setScalar(1000);   // the shader pins the sky to the far plane
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    s.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.35;
    this.sun.shadow.radius = 2.2;
    // Small things too far away to see are skipped by the camera (layer 1)
    // but still cast their shadows.
    this.sun.shadow.camera.layers.enable(1);
    s.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd3ee, 0x5a5246, 0.6);
    s.add(this.hemi);

    this.addStars();
    this.addMoon();
    this.addGlow();

    // Layers of the world. The game fills these.
    this.ground = new THREE.Group();
    this.objects = new THREE.Group();
    this.live = new THREE.Group();
    this.fx = new THREE.Group();
    this.helpers = new THREE.Group();
    this.ground.name = 'ground';
    this.objects.name = 'objects';
    s.add(this.ground, this.objects, this.live, this.fx, this.helpers);

    /* ---- night lights: a fixed pool, so shaders never recompile ---- */
    this.pool = [];
    this.buildLightPool();

    /* ---- environment ---- */
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(this.sky.geometry, this.sky.material);
    this.envSky.scale.setScalar(1000);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6f6a60 }));
    this.envGround.position.y = -20;
    this.envScene.add(this.envSky, this.envGround, this.envGlow, this.envDeck);
    this.envRT = null;
    this.envKey = '';

    /* ---- controls ---- */
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.085;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.minDistance = 6;
    c.maxDistance = 4200;
    c.maxPolarAngle = 88.5 * DEG;
    c.rotateSpeed = 0.55;
    c.zoomSpeed = 1.1;
    c.panSpeed = 1;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.target.set(300, 0, 220);
    c.addEventListener('change', () => { this.moved = true; });

    this.look = { yaw: 0, pitch: 0, speed: 40 };
    this.bindLook();
    this.bindKeys();

    /* ---- post ---- */
    this.buildComposer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.applyEnv(true);

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this.clock.reset?.(); this.res.t = 0; this.res.n = 0; }
    });
  }

  /* ================================================================ setup */

  addStars() {
    const n = 2200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rand();
      const v = rand() * 0.95 + 0.05;
      const th = u * Math.PI * 2;
      const ph = Math.acos(v);
      const R = 14000;
      pos.set([R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th)], i * 3);
      const b = 0.4 + rand() * 0.6;
      const warm = rand();
      col.set([b * (0.85 + warm * 0.15), b * 0.92, b * (1.05 - warm * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);
  }

  /** After dark the sky is not black: towns light the haze along the horizon. */
  addGlow() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { strength: { value: 0 }, horizon: { value: new THREE.Color('#3a4a6e') }, zenith: { value: new THREE.Color('#070b16') } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform float strength; uniform vec3 horizon; uniform vec3 zenith; varying vec3 vDir;
        void main() { float h = max(vDir.y, 0.0); vec3 c = mix(horizon, zenith, pow(h, 0.45)); gl_FragColor = vec4(c * strength, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, fog: false,
    });
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = -999;
    this.scene.add(this.glow);
    this.envGlow = new THREE.Mesh(this.glow.geometry, mat);

    // A grey cloud deck for overcast, rain and snow: the physical sky model
    // cannot do a dull sky without turning it pink.
    const deck = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 }, top: { value: new THREE.Color('#aab1b9') }, horizon: { value: new THREE.Color('#cdd1d6') }, t: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform float opacity; uniform vec3 top; uniform vec3 horizon; uniform float t; varying vec3 vDir;
        float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          float y = max(vDir.y, 0.0);
          vec2 uv = vDir.xz / (y + 0.12) * 1.6 + vec2(t * 0.02, t * 0.01);
          float c = n(uv) * 0.5 + n(uv * 2.3) * 0.3 + n(uv * 5.1) * 0.2;
          vec3 col = mix(horizon, top, pow(y, 0.6)) * (0.88 + c * 0.24);
          gl_FragColor = vec4(col, opacity * smoothstep(-0.25, 0.02, vDir.y + 0.1));
        }`,
      side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
    });
    this.deck = new THREE.Mesh(this.glow.geometry, deck);
    this.deck.frustumCulled = false;
    this.deck.renderOrder = -998;
    this.scene.add(this.deck);
    this.envDeck = new THREE.Mesh(this.glow.geometry, deck);
  }

  addMoon() {
    const disc = document.createElement('canvas');
    disc.width = disc.height = 128;
    const g = disc.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    grad.addColorStop(0, '#fbf8ef');
    grad.addColorStop(0.85, '#e9e4d6');
    grad.addColorStop(1, 'rgba(233,228,214,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(160,155,140,0.35)';
    for (const [x, y, rr] of [[48, 50, 12], [78, 70, 9], [60, 84, 7], [84, 44, 6]]) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
    const tex = new THREE.CanvasTexture(disc);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false, color: 0xffffff }));
    this.moon.scale.setScalar(300);
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x8ea6d8, opacity: 0.5 }));
    this.moonHalo.scale.setScalar(1700);
    this.scene.add(this.moon, this.moonHalo);
  }

  buildLightPool() {
    for (const l of this.pool) this.scene.remove(l, l.target);
    this.pool = [];
    const n = QUALITY[this.quality].lights;
    for (let i = 0; i < n; i++) {
      const l = new THREE.SpotLight(0xffd9a0, 0, 140, 62 * DEG, 0.55, 1.6);
      l.castShadow = false;
      this.scene.add(l, l.target);
      this.pool.push(l);
    }
  }

  buildComposer() {
    const q = QUALITY[this.quality];
    const r = this.renderer;
    if (this.composer) this.composer.dispose();
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x || 1, size.y || 1, { type: THREE.HalfFloatType, samples: q.msaa });
    const comp = this.composer = new EffectComposer(r, rt);
    comp.addPass(new RenderPass(this.scene, this.camera));
    this.aoPass = null;
    if (q.ao) {
      this.aoPass = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.aoPass.updateGtaoMaterial({ radius: 6, distanceExponent: 1.4, thickness: 2, scale: 1.15, samples: this.quality === 'ultra' ? 24 : 12, distanceFallOff: 1 });
      this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.aoPass.blendIntensity = 0.85;
      // The AO depth pass must not see the sky box, sprites, glows or ghosts.
      const ao = this.aoPass;
      ao._overrideVisibility = function hideForAO() {
        const cache = this._visibilityCache;
        this.scene.traverse((o) => {
          if (!o.visible) return;
          const m = o.material;
          if (o.isPoints || o.isLine || o.isSprite || o.isSky || o.userData.noAO || (m && !Array.isArray(m) && m.transparent)) {
            o.visible = false;
            cache.push(o);
          }
        });
      };
      comp.addPass(this.aoPass);
    }
    this.bloomPass = null;
    if (q.bloom) {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.55, 0.9);
      comp.addPass(this.bloomPass);
    }
    this.outline = new OutlinePass(new THREE.Vector2(size.x, size.y), this.scene, this.camera);
    this.outline.edgeStrength = 4;
    this.outline.edgeGlow = 0.4;
    this.outline.edgeThickness = 1.4;
    this.outline.visibleEdgeColor.set('#46b4ff');
    this.outline.hiddenEdgeColor.set('#1d5a8a');
    this.outline.selectedObjects = this.selectionObjects;
    this.outline.enabled = this.selectionObjects.length > 0;
    comp.addPass(this.outline);
    this.gradePass = new ShaderPass(GRADE);
    comp.addPass(this.gradePass);
    comp.addPass(new OutputPass());
    if (q.smaa) comp.addPass(new SMAAPass());
    this.applyShadowSize();
  }

  applyShadowSize() {
    const n = Math.min(QUALITY[this.quality].shadow, this.renderer.capabilities.maxTextureSize);
    const sh = this.sun.shadow;
    if (sh.mapSize.x !== n) {
      sh.mapSize.set(n, n);
      if (sh.map) { sh.map.dispose(); sh.map = null; }
    }
    // Coarser shadow maps need a bigger offset to stay clear of acne.
    sh.normalBias = 0.3 * Math.max(1, 4096 / n);
    this.shadowDirty = true;
  }

  /** The pixel ratio this quality level asks for, before any adaptive scaling. */
  get baseRatio() {
    return Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].ratio);
  }

  /** Watch the frame rate and trade resolution for smoothness. */
  adapt() {
    const a = this.res;
    const now = performance.now();
    a.n += 1;
    if (!a.t) a.t = now;
    // Real time, not the clamped frame step, so very slow frames count fully.
    if (now - a.t < 1500) return;
    // A window that spans a long stall (the first build, a big rebuild) says
    // nothing about steady frame rate.
    if (now - a.t > 5000) { a.t = now; a.n = 0; return; }
    const fps = (a.n * 1000) / (now - a.t);
    a.t = now;
    a.n = 0;
    if (!this.autoRes || this.photo) return;
    const min = 0.5;
    if (a.trial) {
      // A step down that bought nothing (a 30 fps battery-saver cap, or a slow
      // CPU rather than GPU) is undone, and not tried again for a while.
      if (fps < a.trial.fps * 1.08) {
        this.setRenderScale(a.trial.scale);
        a.hold = now + 30000;
      }
      a.trial = null;
      return;
    }
    if (fps < 42 && a.scale > min && !(now < a.hold)) {
      a.good = 0;
      a.trial = { fps, scale: a.scale };
      this.setRenderScale(Math.max(min, a.scale * 0.85));
    } else if (fps > 56 && a.scale < 1) {
      a.good += 1;
      if (a.good >= 3) { a.good = 0; this.setRenderScale(Math.min(1, a.scale * 1.12)); }
    } else a.good = 0;
    // Still slow at the lowest scale: tell the game once.
    a.slow = fps < 28 && (a.scale <= min + 0.01 || now < a.hold) ? a.slow + 1 : 0;
    if (a.slow === 4 && this.onSlow) this.onSlow(fps);
  }

  setRenderScale(scale) {
    if (Math.abs(scale - this.res.scale) < 0.01) return;
    this.res.scale = scale;
    this.resize();
  }

  setAutoRes(on) {
    this.autoRes = on;
    if (!on) this.setRenderScale(1);
  }

  /**
   * Things smaller than a few pixels on screen are not worth a draw call. The
   * game hands over every placed model with a size; this moves the far, tiny
   * ones to layer 1, which only the sun's shadow camera still renders.
   */
  cullSmall() {
    const items = this.cullItems;
    if (!items) return;
    const cam = this.camera;
    const k = (this.host.clientHeight / 2) / Math.tan((cam.fov * DEG) / 2);
    for (const it of items) {
      const g = it.group;
      let hide = false;
      if (it.radius && !this.selectionObjects.includes(g)) {
        const d = cam.position.distanceTo(it.centre);
        hide = (it.radius * k) / Math.max(1, d) < 2.2;
      }
      if (hide === !!it.hidden) continue;
      it.hidden = hide;
      g.traverse((o) => {
        if (!o.isMesh && !o.isLine && !o.isPoints) return;
        if (hide) { o.layers.disable(0); o.layers.enable(1); } else { o.layers.enable(0); o.layers.disable(1); }
      });
    }
  }

  setQuality(name) {
    if (!QUALITY[name] || name === this.quality) return;
    this.quality = name;
    this.buildLightPool();
    this.buildComposer();
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const ratio = this.baseRatio * this.res.scale;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    this.moved = true;
  }

  /* ======================================================= world & lighting */

  setLot(lot) {
    this.lot = { ...lot };
    const cx = lot.width / 2;
    const cz = lot.depth / 2;
    const R = Math.hypot(lot.width, lot.depth + 140) / 2 + 160;
    const cam = this.sun.shadow.camera;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.near = 10; cam.far = 6000;
    cam.updateProjectionMatrix();
    this.sun.target.position.set(cx, 0, cz + 40);
    this.shadowDirty = true;
    this.placeSun();
  }

  setEnv(env) {
    const before = JSON.stringify(this.env);
    this.env = { ...this.env, ...env };
    if (JSON.stringify(this.env) !== before) this.applyEnv();
  }

  placeSun() {
    const { dir } = this.sunDir || sunAt(this.env.hour);
    const lightDir = this.night > 0.5 ? this.moonDir : dir;
    const t = this.sun.target.position;
    this.sun.position.copy(t).addScaledVector(lightDir, 3000);
  }

  /** Recompute everything that follows the clock and the weather. */
  applyEnv(force = false) {
    const W = WEATHER[this.env.weather] || WEATHER.clear;
    this.W = W;
    const sun = this.sunDir = sunAt(this.env.hour);
    const e = sun.elev;
    const day = smooth(-5, 7, e);                  // 0 night, 1 day
    const golden = (1 - smooth(3, 24, e)) * smooth(-4, 1, e);
    const night = this.night = 1 - smooth(-7, 1, e);
    this.day = day;
    this.moonDir = new THREE.Vector3(-sun.dir.x, Math.max(0.42, -sun.dir.y), -sun.dir.z + 0.3).normalize();

    // Sky
    const u = this.sky.material.uniforms;
    u.turbidity.value = W.turbidity;
    u.rayleigh.value = lerp(W.rayleigh, W.rayleigh * 0.6, golden);
    u.mieCoefficient.value = W.mie;
    u.mieDirectionalG.value = 0.82;
    u.cloudCoverage.value = W.clouds;
    u.cloudDensity.value = W.density;
    u.cloudElevation.value = 0.55;
    u.sunPosition.value.copy(sun.dir).multiplyScalar(1000);

    // Sun or moon
    const warm = new THREE.Color('#fff2df').lerp(new THREE.Color('#ff9c55'), golden);
    if (night < 0.5) {
      this.sun.color.copy(warm);
      this.sun.intensity = 4.6 * W.sun * smooth(-2, 10, e);
    } else {
      this.sun.color.set('#9fb6e8');
      this.sun.intensity = 0.22 * night * (W.clouds > 0.85 ? 0.3 : 1);
    }
    this.sun.castShadow = this.sun.intensity > 0.05;

    // Sky light: brighter and more even under cloud.
    const overcast = 1 - W.sun;
    this.hemi.color.set('#26395f').lerp(new THREE.Color(overcast > 0.5 ? '#c3ccd6' : '#c4d3e4'), day);
    this.hemi.groundColor.set('#0b0d12').lerp(new THREE.Color('#6b6253'), day);
    const gloom = 1 - Math.min(0.5, (W.rain || 0) * 0.32);
    this.hemi.intensity = this.hemiBase = lerp(0.62, (0.16 + overcast * 0.85 + golden * 0.5 * W.sun) * gloom, day);
    // A hazy sky model is far brighter than a clear one; even it out.
    const skyGain = 1 / (1 + Math.max(0, W.turbidity - 2) * 0.3);
    this.skyGain = skyGain;
    this.scene.environmentIntensity = lerp(0.12, (0.3 + overcast * 0.5) * skyGain, day);

    // Fog takes the colour of the horizon.
    const fogDay = new THREE.Color(overcast > 0.5 ? '#aeb5bd' : '#b3c6dc');
    if (W.snow) fogDay.set('#c9d0d8');
    fogDay.lerp(new THREE.Color('#e3b48d'), golden * 0.55 * W.sun);
    this.scene.fog.color.set('#0a101c').lerp(fogDay, day);
    this.scene.fog.density = W.fog * (night > 0.5 && W.fog < 0.001 ? 0.8 : 1);
    this.envGround.material.color.set('#0c0d10').lerp(new THREE.Color(W.snow ? '#c9ced4' : '#6f6a60'), day);

    // Exposure and glow
    // Like a camera, open up as the light gets low.
    const lowSun = golden * W.sun * smooth(-4, 2, e);
    this.renderer.toneMappingExposure = lerp(1.25, 0.8, day) * (W.sun < 0.3 ? 1.35 : 1) * (1 + lowSun * 1.7) * (1 + 0.15 * W.snow * day);
    if (this.bloomPass) {
      // Bloom sees light before exposure: by day only the sun's glints bloom.
      this.bloomPass.strength = lerp(0.06, 0.7, night);
      this.bloomPass.threshold = lerp(4.5, 0.55, night);
      this.bloomPass.radius = lerp(0.35, 0.6, night);
    }
    this.stars.material.opacity = night * (W.clouds > 0.8 ? 0.08 : 1 - W.clouds * 0.7);
    this.glow.material.uniforms.strength.value = night * (W.clouds > 0.8 ? 1.4 : 1);
    const du = this.deck.material.uniforms;
    du.opacity.value = smooth(0.6, 0.95, W.clouds) * 0.96;
    const dark = Math.min(1, (W.rain || 0) * 0.6);
    du.top.value.set('#090c12').lerp(new THREE.Color('#b2b9c1').lerp(new THREE.Color('#6f7880'), dark), day);
    du.horizon.value.set('#10141b').lerp(new THREE.Color('#d2d6da').lerp(new THREE.Color('#9aa1a8'), dark), day);
    this.moon.material.opacity = night * (W.clouds > 0.85 ? 0.15 : 1);
    this.moonHalo.material.opacity = night * 0.35 * (W.clouds > 0.85 ? 0.3 : 1);

    // Materials across the world
    M.setNight(night);
    M.setWet(W.wet);
    M.setSnow(W.snow * 0.9);
    M.setSeason(W.snow ? 'winter' : this.env.season);

    this.placeSun();
    this.shadowDirty = true;
    this.moved = true;

    // The environment map only needs re-baking when the sky has really changed,
    // and while the clock runs (time-lapse especially) at most every second or
    // so; a bake that is skipped is picked up by the frame loop shortly after.
    const key = `${Math.round(this.env.hour * 4)}|${this.env.weather}`;
    const sameSky = this.envKey && this.envKey.split('|')[1] === this.env.weather;
    if (force || (key !== this.envKey && (!sameSky || this.time - this.envAt >= 1))) {
      this.envKey = key;
      this.envAt = this.time;
      this.envStale = false;
      this.bakeEnv();
    } else if (key !== this.envKey) this.envStale = true;
    M.setEnvMap(this.envRT.texture, lerp(0.12, 1, day) * this.skyGain);
  }

  bakeEnv() {
    const u = this.sky.material.uniforms;
    const disc = u.showSunDisc.value;
    u.showSunDisc.value = 0;
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 5000);
    u.showSunDisc.value = disc;
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  /** Lamps that should really light the ground when it is dark. */
  setLightSources(list) {
    this.lightSources = list;
    this.lightsDirty = true;
  }

  updatePool() {
    const n = this.pool.length;
    const on = this.night > 0.35 ? smooth(0.35, 0.8, this.night) : 0;
    if (!on) {
      for (const l of this.pool) l.intensity = 0;
      return;
    }
    const focus = this.mode === 'orbit' ? this.controls.target : this.camera.position;
    const ranked = this.lightSources
      .map((s) => ({ s, d: (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
    this.pool.forEach((l, i) => {
      const hit = ranked[i];
      if (!hit) { l.intensity = 0; return; }
      const s = hit.s;
      l.position.set(s.x, s.y, s.z);
      l.target.position.set(s.tx != null ? s.tx : s.x, 0, s.tz != null ? s.tz : s.z);
      l.target.updateMatrixWorld();
      l.color.set(s.color || '#ffd9a0');
      l.angle = (s.angle || 62) * DEG;
      l.distance = s.range || 140;
      l.intensity = (s.power || 900) * on * 0.45;
    });
  }

  /* ============================================================ selection */

  setSelection(objs) {
    this.selectionObjects.length = 0;
    for (const o of objs || []) if (o) this.selectionObjects.push(o);
    if (this.outline) {
      this.outline.selectedObjects = this.selectionObjects;
      this.outline.enabled = this.selectionObjects.length > 0;
    }
    this.moved = true;
    this.cullSmall();
  }

  /* =============================================================== picking */

  rayFrom(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    return _ray;
  }

  /** The thing under the pointer: the nearest object with pick data on it. */
  pick(ev, roots = [this.objects]) {
    const ray = this.rayFrom(ev);
    const hits = ray.intersectObjects(roots, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) return { ...o.userData.pick, point: h.point, normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null, object: o, mesh: h.object, distance: h.distance };
    }
    return null;
  }

  /** Where the pointer meets a horizontal plane at the given height, in plan feet. */
  groundAt(ev, height = 0) {
    const ray = this.rayFrom(ev);
    _plane.set(_v.set(0, 1, 0), -height);
    const hit = ray.ray.intersectPlane(_plane, _v2);
    if (!hit) return null;
    return { x: hit.x, y: hit.z };
  }

  /** Project a world point to screen pixels inside the host. */
  toScreen(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    return { x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h, behind: _v.z > 1 };
  }

  /* ================================================================ camera */

  setMode(mode) {
    if (!CAMERA_MODES.includes(mode) || mode === this.mode) return;
    const prev = this.mode;
    this.mode = mode;
    const cam = this.camera;
    if (mode === 'orbit') {
      if (document.pointerLockElement) document.exitPointerLock();
      // Put the orbit centre where we were looking.
      const dir = cam.getWorldDirection(_v);
      const t = dir.y < -0.05 ? cam.position.clone().addScaledVector(dir, -cam.position.y / dir.y) : cam.position.clone().addScaledVector(dir, 120);
      t.y = 0;
      this.controls.target.copy(t);
      if (cam.position.y < 30) {
        // Coming up from the ground: step back and up to a comfortable view.
        const back = _v2.set(-dir.x, 0, -dir.z).normalize().multiplyScalar(150);
        cam.position.set(t.x + back.x, 85, t.z + back.z);
      }
      this.controls.enabled = true;
      this.controls.update();
    } else {
      this.controls.enabled = false;
      const dir = cam.getWorldDirection(_v);
      this.look.yaw = Math.atan2(-dir.x, -dir.z);
      this.look.pitch = Math.asin(clamp(dir.y, -1, 1));
      if (mode === 'walk') {
        // From up high, come down to eye level a little short of the spot we
        // were looking at, facing it — and never outside the site.
        if (cam.position.y > 12) {
          const d = cam.getWorldDirection(new THREE.Vector3());
          const spot = prev === 'orbit'
            ? this.controls.target.clone()
            : d.y < -0.05 ? cam.position.clone().addScaledVector(d, -cam.position.y / d.y) : cam.position.clone().addScaledVector(d, 80);
          spot.x = clamp(spot.x, 10, this.lot.width - 10);
          spot.z = clamp(spot.z, 10, this.lot.depth + 30);
          const back = _v2.set(Math.sin(this.look.yaw), 0, Math.cos(this.look.yaw)).multiplyScalar(45);
          cam.position.set(clamp(spot.x + back.x, -150, this.lot.width + 150), 5.6, clamp(spot.z + back.z, -150, this.lot.depth + 100));
          this.look.pitch = -0.05;
          if (this.blocked && this.blocked(cam.position.x, cam.position.z)) cam.position.set(spot.x, 5.6, this.lot.depth + 6);
        }
        cam.position.y = 5.6;
        this.look.speed = 7;
      } else {
        this.look.speed = clamp(cam.position.y * 0.6, 20, 160);
      }
      this.applyLook();
    }
    this.flight = null;
    this.moved = true;
  }

  applyLook() {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  }

  bindLook() {
    const el = this.renderer.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    el.addEventListener('pointerdown', (ev) => {
      if (this.mode === 'orbit') return;
      if (this.mode === 'walk' && ev.button === 0 && !document.pointerLockElement && this.lockOnClick) {
        el.requestPointerLock?.();
      }
      if (ev.button === 2 || ev.button === 0) {
        dragging = ev.button === 2 || !this.lockOnClick;
        lx = ev.clientX;
        ly = ev.clientY;
      }
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (ev) => {
      if (this.mode === 'orbit') return;
      let dx = 0;
      let dy = 0;
      if (document.pointerLockElement === el) {
        dx = ev.movementX; dy = ev.movementY;
      } else if (dragging) {
        dx = ev.clientX - lx; dy = ev.clientY - ly;
        lx = ev.clientX; ly = ev.clientY;
      } else return;
      this.look.yaw -= dx * 0.0032;
      this.look.pitch = clamp(this.look.pitch - dy * 0.0032, -1.45, 1.45);
      this.applyLook();
      this.moved = true;
    });
    el.addEventListener('wheel', (ev) => {
      if (this.mode !== 'drone') return;
      ev.preventDefault();
      this.look.speed = clamp(this.look.speed * (ev.deltaY > 0 ? 0.85 : 1.18), 4, 600);
      this.onSpeed?.(this.look.speed);
    }, { passive: false });
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  bindKeys() {
    const typing = (ev) => {
      const t = ev.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    window.addEventListener('keydown', (ev) => {
      if (typing(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (['w', 'a', 's', 'd', 'q', 'e', ' ', 'c', 'Shift', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', '+', '=', '-'].includes(k)) {
        if (this.keyFilter && !this.keyFilter(k)) return;
        this.keys.add(k);
        if (k === ' ' || k.startsWith('Arrow') || k.startsWith('Page')) ev.preventDefault();
      }
    });
    window.addEventListener('keyup', (ev) => {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      this.keys.delete(k);
      if (k === 'Shift') this.keys.delete('Shift');
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Keyboard movement for whichever camera is active. */
  drive(dt) {
    const K = this.keys;
    if (!K.size) return;
    const fwd = (K.has('w') || K.has('ArrowUp') ? 1 : 0) - (K.has('s') || K.has('ArrowDown') ? 1 : 0);
    const side = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
    const fast = K.has('Shift') ? 3 : 1;
    const cam = this.camera;
    if (this.mode === 'orbit') {
      const c = this.controls;
      const dist = cam.position.distanceTo(c.target);
      const yaw = Math.atan2(cam.position.x - c.target.x, cam.position.z - c.target.z);
      const sp = dist * 0.9 * dt * fast;
      const mx = (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * sp;
      const mz = (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * sp;
      c.target.x += mx; c.target.z += mz;
      cam.position.x += mx; cam.position.z += mz;
      const turn = (K.has('q') ? 1 : 0) - (K.has('e') ? 1 : 0);
      if (turn) {
        const a = turn * 1.4 * dt;
        const ox = cam.position.x - c.target.x;
        const oz = cam.position.z - c.target.z;
        cam.position.x = c.target.x + ox * Math.cos(a) - oz * Math.sin(a);
        cam.position.z = c.target.z + ox * Math.sin(a) + oz * Math.cos(a);
      }
      const zoom = (K.has('PageDown') || K.has('-') ? 1 : 0) - (K.has('PageUp') || K.has('+') || K.has('=') ? 1 : 0);
      if (zoom) {
        const f = Math.exp(zoom * 1.6 * dt);
        const off = _v.copy(cam.position).sub(c.target).multiplyScalar(f);
        const len = clamp(off.length(), c.minDistance, c.maxDistance);
        cam.position.copy(c.target).add(off.setLength(len));
      }
      this.clampTarget();
      c.update();
      this.moved = true;
      return;
    }
    // Drone and walk: move where the camera faces.
    const yaw = this.look.yaw;
    const sp = this.look.speed * dt * fast;
    const dx = (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * sp;
    const dz = (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * sp;
    let up = 0;
    if (this.mode === 'drone') {
      up = ((K.has(' ') ? 1 : 0) - (K.has('c') ? 1 : 0)) * sp * 0.8;
      const turn = (K.has('q') ? 1 : 0) - (K.has('e') ? 1 : 0);
      if (turn) { this.look.yaw += turn * 1.3 * dt; this.applyLook(); }
    }
    const nx = cam.position.x + dx;
    const nz = cam.position.z + dz;
    if (this.mode === 'walk' && this.blocked) {
      // Slide along walls rather than stopping dead.
      if (!this.blocked(nx, cam.position.z)) cam.position.x = nx;
      if (!this.blocked(cam.position.x, nz)) cam.position.z = nz;
      this.stride = (this.stride || 0) + Math.hypot(dx, dz);
      cam.position.y = 5.6 + Math.sin(this.stride * 1.1) * 0.06;
    } else {
      cam.position.x = nx;
      cam.position.z = nz;
      cam.position.y = clamp(cam.position.y + up, 2.5, 3000);
    }
    this.moved = true;
  }

  clampTarget() {
    const t = this.controls.target;
    const m = 400;
    t.x = clamp(t.x, -m, this.lot.width + m);
    t.z = clamp(t.z, -m, this.lot.depth + m + 80);
    t.y = clamp(t.y, 0, 200);
  }

  /** Glide the orbit camera to look at a point from a given distance and angle. */
  flyTo({ x, y = 0, z, dist = null, yaw = null, pitch = null, ms = 900 }) {
    if (this.mode !== 'orbit') this.setMode('orbit');
    const cam = this.camera;
    const c = this.controls;
    const off = cam.position.clone().sub(c.target);
    const d0 = off.length();
    const yaw0 = Math.atan2(off.x, off.z);
    const pitch0 = Math.asin(clamp(off.y / d0, -1, 1));
    let yaw1 = yaw == null ? yaw0 : yaw;
    while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;
    this.flight = {
      t: 0, ms,
      from: { t: c.target.clone(), d: d0, yaw: yaw0, pitch: pitch0 },
      to: { t: new THREE.Vector3(x, y, z), d: dist == null ? d0 : dist, yaw: yaw1, pitch: pitch == null ? pitch0 : pitch },
    };
  }

  stepFlight(dt) {
    const f = this.flight;
    if (!f) return;
    f.t = Math.min(1, f.t + (dt * 1000) / f.ms);
    const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
    const c = this.controls;
    c.target.lerpVectors(f.from.t, f.to.t, k);
    const d = Math.exp(lerp(Math.log(f.from.d), Math.log(f.to.d), k));
    const yaw = lerp(f.from.yaw, f.to.yaw, k);
    const pitch = lerp(f.from.pitch, f.to.pitch, k);
    this.camera.position.set(
      c.target.x + Math.sin(yaw) * Math.cos(pitch) * d,
      c.target.y + Math.sin(pitch) * d,
      c.target.z + Math.cos(yaw) * Math.cos(pitch) * d,
    );
    c.update();
    this.moved = true;
    if (f.t >= 1) this.flight = null;
  }

  /** Named viewpoints around the lot. */
  view(name, focus = null) {
    const L = this.lot;
    const fx = focus ? focus.x : L.width / 2;
    const fz = focus ? focus.z : L.depth / 2;
    const size = focus ? focus.size : Math.max(L.width, L.depth);
    const d = size * 1.35 + 60;
    const views = {
      aerial: { yaw: 20 * DEG, pitch: 38 * DEG, dist: d },
      front: { yaw: 0, pitch: 16 * DEG, dist: d * 0.95 },
      back: { yaw: 180 * DEG, pitch: 22 * DEG, dist: d },
      left: { yaw: -90 * DEG, pitch: 22 * DEG, dist: d },
      right: { yaw: 90 * DEG, pitch: 22 * DEG, dist: d },
      top: { yaw: 0, pitch: 89 * DEG, dist: d * 1.1 },
      street: { yaw: -28 * DEG, pitch: 5 * DEG, dist: d * 0.55, fz: focus ? fz : L.depth * 0.8 },
      corner: { yaw: -42 * DEG, pitch: 26 * DEG, dist: d * 0.9 },
    };
    const v = views[name] || views.aerial;
    this.flyTo({ x: fx, y: 0, z: v.fz != null ? v.fz : fz, dist: v.dist, yaw: v.yaw, pitch: v.pitch });
  }

  /** Jump straight to a view with no flight (first load). */
  snapView(name) {
    this.view(name);
    if (this.flight) { this.flight.t = 0.999; this.stepFlight(1); }
  }

  get heading() {
    const dir = this.camera.getWorldDirection(_v);
    return Math.atan2(dir.x, -dir.z);  // 0 = looking north
  }

  /* ================================================================ frame */

  addTicker(fn) { this.tickers.push(fn); return () => { this.tickers = this.tickers.filter((f) => f !== fn); }; }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden || this.paused) return;
    this.clock.update();
    const dt = Math.min(0.1, this.clock.getDelta());
    this.time += dt;
    this.fps = lerp(this.fps, 1 / Math.max(dt, 1e-3), 0.05);
    this.adapt();

    this.stepFlight(dt);
    this.drive(dt);
    if (this.mode === 'orbit') {
      this.controls.update();
      this.clampTarget();
    }
    for (const fn of this.tickers) fn(dt, this.time);

    const cam = this.camera;
    // Keep depth precision where the camera is.
    const reach = this.mode === 'orbit' ? cam.position.distanceTo(this.controls.target) : cam.position.y;
    const near = clamp(reach * 0.0025, 0.25, 4);
    if (Math.abs(cam.near - near) > 0.05) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }

    // Sky, stars and moon travel with the camera.
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position);
    this.glow.position.copy(cam.position);
    this.deck.position.copy(cam.position);
    this.deck.material.uniforms.t.value = this.time;
    this.sky.material.uniforms.time.value = this.time;
    if (this.night > 0.02) {
      this.moon.position.copy(cam.position).addScaledVector(this.moonDir, 13500);
      this.moonHalo.position.copy(this.moon.position);
    }

    // Lightning
    if (this.W && this.W.lightning) {
      if (this.flash <= 0 && Math.random() < dt * 0.12) this.flash = 0.35;
      if (this.flash > 0) {
        this.flash -= dt;
        const on = this.flash > 0 && (this.flash > 0.25 || (this.flash > 0.1 && this.flash < 0.17)) ? 1 : 0;
        this.hemi.intensity = on ? 4 : this.hemiBase;
      }
    }

    if (this.lightsDirty || this.moved) {
      this.updatePool();
      this.lightsDirty = false;
    }
    // Shadows are re-drawn when something changes, but at most fifteen times a
    // second: dragging a trailer or running the clock no longer re-renders the
    // whole shadow map every frame.
    if (this.shadowDirty && this.time - this.shadowAt >= 1 / 15) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
      this.shadowAt = this.time;
    }
    if (this.envStale && this.time - this.envAt >= 1) {
      this.envStale = false;
      this.envKey = `${Math.round(this.env.hour * 4)}|${this.env.weather}`;
      this.envAt = this.time;
      this.bakeEnv();
      M.setEnvMap(this.envRT.texture, lerp(0.12, 1, this.day) * this.skyGain);
    }
    if (this.moved || this.time - this.cullAt > 0.5) {
      this.cullAt = this.time;
      this.cullSmall();
    }
    this.moved = false;
    this.renderer.info.reset();
    this.composer.render(dt);
  }

  /** Render once and hand back the image (for photos). */
  capture(type = 'image/png') {
    this.renderer.info.reset();
    this.composer.render(0);
    return this.renderer.domElement.toDataURL(type, 0.92);
  }

  /** Recolour a ghost so it reads as "can go here" or "blocked". */
  static ghostify(obj, ok) {
    const mat = ok ? GHOST_OK : GHOST_BAD;
    obj.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.material = mat;
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
  }

  get info() {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, fps: this.fps, scale: this.res.scale };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/* A light colour grade in linear light, before tone mapping: a touch less
 * saturation and a warm white balance (cameras do this; renderers do not),
 * and a soft vignette. */
const GRADE = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 0.9 },
    tint: { value: new THREE.Vector3(1.05, 1.0, 0.92) },
    vignette: { value: 0.22 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation; uniform vec3 tint; uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation) * tint;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.75, dot(d, d) * 2.0);
      gl_FragColor = c;
    }`,
};

const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x5fd08a, transparent: true, opacity: 0.42, depthWrite: false });
const GHOST_BAD = new THREE.MeshBasicMaterial({ color: 0xf0524d, transparent: true, opacity: 0.45, depthWrite: false });
