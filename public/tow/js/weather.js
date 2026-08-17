// Weather is chosen once, before the shift starts, and then it runs all day.
import * as THREE from 'three';
import { makeCanvas, canvasTexture } from './util.js';

export const WEATHERS = [
  {
    id: 'clear', name: 'Clear and cold', blurb: 'Hard sun, dry pavement, easy straps.',
    sky: 0x8fc3ea, horizon: 0xd7e7f2, fog: 0xcfe0ec, fogDensity: 0.00035,
    sun: 3.0, ambient: 0.8, hour: 9, wet: 0, particles: null, grip: 1.0,
  },
  {
    id: 'overcast', name: 'Overcast', blurb: 'Flat grey light. Nothing dramatic.',
    sky: 0x9aa4ad, horizon: 0xc3c9cf, fog: 0xb4bcc3, fogDensity: 0.0007,
    sun: 1.5, ambient: 1.1, hour: 11, wet: 0.15, particles: null, grip: 0.97,
  },
  {
    id: 'rain', name: 'Steady rain', blurb: 'Wet decks, slick ramps, busy phone.',
    sky: 0x59636d, horizon: 0x7b858e, fog: 0x6e777f, fogDensity: 0.0016,
    sun: 0.9, ambient: 1.0, hour: 14, wet: 1, particles: 'rain', grip: 0.78,
  },
  {
    id: 'storm', name: 'Thunderstorm', blurb: 'Sideways rain and lightning. Pays well.',
    sky: 0x39424c, horizon: 0x515c66, fog: 0x454e57, fogDensity: 0.0028,
    sun: 0.6, ambient: 0.85, hour: 17, wet: 1, particles: 'rain', lightning: true, grip: 0.68,
  },
  {
    id: 'fog', name: 'Harbor fog', blurb: 'You will not see the guardrail. Sorry.',
    sky: 0xb9bfc4, horizon: 0xcdd2d6, fog: 0xc2c7cb, fogDensity: 0.009,
    sun: 0.8, ambient: 1.2, hour: 7, wet: 0.4, particles: null, grip: 0.9,
  },
  {
    id: 'snow', name: 'Snow', blurb: 'Everything slides. Everything calls.',
    sky: 0x93a1ad, horizon: 0xdfe6ec, fog: 0xc9d3db, fogDensity: 0.0022,
    sun: 1.1, ambient: 1.15, hour: 10, wet: 0.6, particles: 'snow', snowCover: true, grip: 0.55,
  },
  {
    id: 'dusk', name: 'Golden hour', blurb: 'Long shadows, rush hour fender benders.',
    sky: 0xe8935a, horizon: 0xf7c98a, fog: 0xe0a473, fogDensity: 0.0009,
    sun: 2.2, ambient: 0.9, hour: 19, wet: 0.1, particles: null, grip: 0.98,
  },
  {
    id: 'night', name: 'Night shift', blurb: 'Amber lights on, everybody drunk.',
    sky: 0x0d1420, horizon: 0x1b2735, fog: 0x141c28, fogDensity: 0.0014,
    sun: 0.25, ambient: 0.42, hour: 1, wet: 0.35, particles: null, night: true, grip: 0.92,
  },
];

export const WEATHER_BY_ID = Object.fromEntries(WEATHERS.map((w) => [w.id, w]));

function skyTexture(top, bottom) {
  const c = makeCanvas(8, 256);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
  g.addColorStop(0.55, '#' + bottom.toString(16).padStart(6, '0'));
  g.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  x.fillStyle = g; x.fillRect(0, 0, 8, 256);
  return canvasTexture(c);
}

export function createWeather(scene, renderer) {
  const sun = new THREE.DirectionalLight(0xfff2dd, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  const d = 70;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xdfe9f2, 0x4a4a42, 1);
  scene.add(hemi);

  const skyGeo = new THREE.SphereGeometry(1500, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // Cloud slabs drifting overhead — cheap, but the sky stops looking empty.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const w = 120 + Math.random() * 260;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.45), cloudMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((Math.random() - 0.5) * 2400, 220 + Math.random() * 90, (Math.random() - 0.5) * 2400);
    clouds.add(m);
  }
  scene.add(clouds);

  // Precipitation: one Points cloud that follows the camera.
  const COUNT = 4200;
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 90;
    pos[i * 3 + 1] = Math.random() * 45;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    vel[i] = 0.6 + Math.random() * 0.6;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xcfe3f2, size: 0.16, transparent: true, opacity: 0.75, depthWrite: false });
  const precip = new THREE.Points(pGeo, pMat);
  precip.frustumCulled = false;
  precip.visible = false;
  scene.add(precip);

  const state = {
    current: WEATHERS[0], time: 0, flash: 0, sun, hemi, precip, clouds,
  };

  function apply(idOrDef) {
    const w = typeof idOrDef === 'string' ? (WEATHER_BY_ID[idOrDef] || WEATHERS[0]) : idOrDef;
    state.current = w;
    skyMat.map = skyTexture(w.sky, w.horizon);
    skyMat.needsUpdate = true;
    scene.fog = new THREE.FogExp2(w.fog, w.fogDensity);
    sun.intensity = w.sun;
    hemi.intensity = w.ambient;
    hemi.color.setHex(w.night ? 0x2a3a4e : 0xdfe9f2);
    renderer.toneMappingExposure = w.night ? 1.25 : 1.0;
    cloudMat.opacity = w.id === 'clear' ? 0.32 : w.night ? 0.2 : 0.55;
    cloudMat.color.setHex(w.night ? 0x2b3646 : w.id === 'storm' ? 0x555f69 : 0xffffff);
    precip.visible = !!w.particles;
    if (w.particles === 'snow') {
      pMat.size = 0.28; pMat.color.setHex(0xffffff); pMat.opacity = 0.95;
    } else {
      pMat.size = 0.12; pMat.color.setHex(0xbcd6ea); pMat.opacity = 0.6;
    }
    // Sun angle from the hour of day.
    const t = ((w.hour - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(t) * 120, Math.max(18, Math.sin(t) * 150), 60);
    sun.color.setHex(w.night ? 0x9fb6d8 : w.hour >= 17 ? 0xffcf9a : 0xfff2dd);
    return w;
  }

  function update(dt, camera) {
    const w = state.current;
    state.time += dt;
    sky.position.copy(camera.position);
    clouds.position.set(camera.position.x, 0, camera.position.z);
    clouds.rotation.y += dt * 0.004;
    // Shadow camera rides with the player so the map size stays small.
    sun.target.position.set(camera.position.x, 0, camera.position.z);
    sun.position.set(camera.position.x + Math.cos(((w.hour - 6) / 12) * Math.PI) * 90,
      Math.max(30, Math.sin(((w.hour - 6) / 12) * Math.PI) * 120), camera.position.z + 50);

    if (w.particles) {
      const p = precip.geometry.attributes.position;
      const fall = w.particles === 'snow' ? 6 : 42;
      const drift = w.id === 'storm' ? 9 : w.particles === 'snow' ? 1.6 : 2.2;
      for (let i = 0; i < COUNT; i++) {
        let y = p.getY(i) - fall * vel[i] * dt;
        let x = p.getX(i) + drift * dt * (0.4 + vel[i]);
        if (y < -6) { y = 44; x = (Math.random() - 0.5) * 90; }
        if (x > 45) x -= 90;
        p.setXYZ(i, x, y, p.getZ(i));
      }
      p.needsUpdate = true;
      precip.position.set(camera.position.x, camera.position.y, camera.position.z);
    }
    if (w.lightning) {
      state.flash -= dt;
      if (state.flash < -0.1 && Math.random() < dt * 0.12) state.flash = 0.22;
      const on = state.flash > 0;
      hemi.intensity = on ? 4.2 : w.ambient;
      sun.intensity = on ? 3.4 : w.sun;
    }
  }

  apply(WEATHERS[0]);
  return { apply, update, state, get current() { return state.current; } };
}
