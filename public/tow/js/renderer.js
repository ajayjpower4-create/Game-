// Renderer, post-processing and quality presets.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

export const QUALITY = {
  low: { pixelRatio: 0.65, shadows: false, shadowSize: 1024, bloom: false, smaa: false, ao: false, drawDist: 380, traffic: 0.5 },
  medium: { pixelRatio: 0.85, shadows: true, shadowSize: 2048, bloom: true, smaa: false, ao: false, drawDist: 600, traffic: 0.8 },
  high: { pixelRatio: 1, shadows: true, shadowSize: 4096, bloom: true, smaa: true, ao: false, drawDist: 900, traffic: 1 },
  ultra: { pixelRatio: 1.25, shadows: true, shadowSize: 4096, bloom: true, smaa: true, ao: true, drawDist: 1400, traffic: 1 },
};

export class Renderer {
  constructor(canvas, qualityName = 'high') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.composer = null;
    this.scene = null;
    this.camera = null;
    this.setQuality(qualityName);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'high';
    this.q = QUALITY[this.qualityName];
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.renderer.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1) * this.q.pixelRatio));
    this.resize();
    if (this.scene) this.buildComposer(this.scene, this.camera);
  }

  buildComposer(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    if (this.composer) this.composer.dispose?.();
    const q = this.q;
    if (!q.bloom && !q.smaa && !q.ao) { this.composer = null; return; }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.smaa ? 0 : 4 });
    const c = new EffectComposer(this.renderer, target);
    c.addPass(new RenderPass(scene, camera));
    if (q.ao) {
      const ao = new GTAOPass(scene, camera, size.x, size.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1 });
      c.addPass(ao);
    }
    if (q.bloom) {
      // Threshold is in linear HDR (before exposure): sunlit pavement stays
      // below it, lamps, LEDs and specular glints go over.
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.45, 2.0);
      c.addPass(this.bloom);
    }
    c.addPass(new OutputPass());
    if (q.smaa) c.addPass(new SMAAPass(size.x, size.y));
    this.composer = c;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  render(scene, camera) {
    if (this.composer && this.scene === scene && this.camera === camera) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
