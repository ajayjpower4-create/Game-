// Pre-shift setup: driver → clothes & vest → truck → livery → weather →
// spawn point, with a live 3D preview on the left.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildAvatar, defaultAppearance, SKIN_TONES, RACES, HAIR_STYLES, HAIR_COLORS, HAIR_COLOR_NAMES, EYE_COLORS, FACIAL_HAIR,
  FACES, BUILDS, SHIRTS, PANTS, BOOTS, HATS, GLOVES, VESTS, CLOTH_COLORS,
} from './character/avatar.js';
import { TRUCKS, buildTowTruck, poseBed } from './vehicles/towtruck.js';
import { LIVERIES, COMPANIES } from './vehicles/liveries.js';
import { WEATHERS } from './weather.js';
import { SPAWNS, GRID } from './city/layout.js';
import * as TX from './textures.js';
import { clamp, damp } from './util.js';

const $ = (id) => document.getElementById(id);
const STEPS = ['title', 'character', 'clothes', 'truck', 'livery', 'weather', 'spawn'];

export class Setup {
  constructor(game) {
    this.game = game;
    this.state = this.load() ?? {
      appearance: defaultAppearance(), truck: 'f550', livery: 0, weather: 'clear', spawn: { kind: 'preset', index: 0 },
    };
    this.step = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    const pm = new THREE.PMREMGenerator(game.renderer.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.cam = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
    const key = new THREE.DirectionalLight(0xfff2e0, 2.4);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2);
    rim.position.set(-5, 4, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xbfd2ee, 0x2a2622, 0.5));
    const fl = TX.cloneSet(TX.concrete(41, [1, 1, 1], 120), 6, 6);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ ...fl, roughness: 0.55, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.orbit = { yaw: 0.6, pitch: 0.12, dist: 4, target: new THREE.Vector3(0, 1, 0) };
    this.avatar = null;
    this.truckObj = null;
    this.bindPreviewControls();
  }

  // The last setup, checked field by field so an old or hand-edited save can't
  // pick a truck, livery, weather or spawn that doesn't exist.
  load() {
    let s;
    try { s = JSON.parse(localStorage.getItem('towsim.setup')); } catch { return null; }
    if (!s || typeof s !== 'object') return null;
    const truck = TRUCKS.some((t) => t.id === s.truck) ? s.truck : 'f550';
    const nLiv = LIVERIES[truck]?.length ?? 5;
    const spawn = s.spawn?.kind === 'custom' && Number.isFinite(s.spawn.x) && Number.isFinite(s.spawn.z) && Number.isInteger(s.spawn.edge)
      ? s.spawn
      : { kind: 'preset', index: Number.isInteger(s.spawn?.index) && s.spawn.index >= 0 && s.spawn.index < SPAWNS.length ? s.spawn.index : 0 };
    return {
      appearance: { ...defaultAppearance(), ...(s.appearance && typeof s.appearance === 'object' ? s.appearance : {}) },
      truck,
      livery: Number.isInteger(s.livery) && s.livery >= 0 && s.livery < nLiv ? s.livery : 0,
      weather: WEATHERS.some((w) => w.id === s.weather) ? s.weather : 'clear',
      spawn,
    };
  }
  save() { try { localStorage.setItem('towsim.setup', JSON.stringify(this.state)); } catch {} }

  open() {
    $('setup').classList.add('show');
    this.renderSteps();
    this.buildCharacterOptions();
    this.buildClothesOptions();
    this.buildTruckOptions();
    this.buildWeatherOptions();
    this.buildSpawnOptions();
    this.goto(0);
    for (const b of document.querySelectorAll('#setup [data-next]')) b.onclick = () => { this.game.audio.unlock(); this.goto(this.step + 1); };
    for (const b of document.querySelectorAll('#setup [data-back]')) b.onclick = () => this.goto(this.step - 1);
    $('startShift').onclick = () => this.finish();
    $('quickStart').style.display = this.load() ? '' : 'none';
    $('quickStart').onclick = () => { this.game.audio.unlock(); this.finish(); };
  }
  close() { $('setup').classList.remove('show'); }

  renderSteps() {
    $('steps').innerHTML = STEPS.slice(1).map(() => '<span></span>').join('');
  }

  goto(i) {
    this.step = clamp(i, 0, STEPS.length - 1);
    const name = STEPS[this.step];
    for (const s of document.querySelectorAll('#setup .step')) s.classList.toggle('active', s.dataset.step === name);
    [...$('steps').children].forEach((s, k) => s.classList.toggle('done', k < this.step));
    $('spawnMap').classList.toggle('hidden', name !== 'spawn');
    $('previewHint').style.display = name === 'spawn' ? 'none' : '';
    if (name === 'title' || name === 'character' || name === 'clothes') { this.showAvatar(); this.orbit.target.set(0, name === 'character' ? 1.45 * this.state.appearance.height / 178 : 1.0, 0); this.orbit.dist = name === 'character' ? 2.1 : 4.2; this.orbit.pitch = 0.08; }
    if (name === 'truck' || name === 'livery') { this.showTruck(); this.orbit.target.set(0, 1.2, -0.8); this.orbit.dist = 15; this.orbit.pitch = 0.2; }
    if (name === 'weather') this.game.previewWeather(this.state.weather);
    if (name === 'spawn') this.drawSpawnMap();
    if (name === 'livery') this.buildLiveryOptions();
  }

  get previewMode() {
    const name = STEPS[this.step];
    return name === 'weather' ? 'city' : name === 'spawn' ? 'map' : 'studio';
  }

  // ------------------------------------------------------------ preview
  showAvatar() {
    if (this.truckObj) { this.scene.remove(this.truckObj.root); this.truckObj = null; }
    if (this.avatar) this.scene.remove(this.avatar.root);
    this.avatar = buildAvatar(this.state.appearance);
    this.scene.add(this.avatar.root);
  }
  showTruck() {
    if (this.avatar) { this.scene.remove(this.avatar.root); this.avatar = null; }
    if (this.truckObj) this.scene.remove(this.truckObj.root);
    const t = TRUCKS.find((x) => x.id === this.state.truck);
    this.truckObj = buildTowTruck(t, this.state.livery);
    poseBed(this.truckObj, 0, 0);
    this.scene.add(this.truckObj.root);
    // A driver standing by the truck for scale.
    const av = buildAvatar(this.state.appearance);
    av.root.position.set(t.bed.width / 2 + 1.0, 0, t.controlZ - 0.4);
    av.root.rotation.y = -Math.PI / 2;
    this.truckObj.root.add(av.root);
    this.truckAvatar = av;
  }

  bindPreviewControls() {
    const cv = this.game.renderer.canvas;
    let drag = null;
    cv.addEventListener('mousedown', (e) => { if (this.active) { drag = { x: e.clientX, y: e.clientY }; this.dragging = true; } });
    addEventListener('mouseup', () => { drag = null; this.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!drag || !this.active) return;
      this.orbit.yaw -= (e.clientX - drag.x) * 0.008;
      this.orbit.pitch = clamp(this.orbit.pitch + (e.clientY - drag.y) * 0.005, -0.2, 0.9);
      drag = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('wheel', (e) => { if (this.active) this.orbit.dist = clamp(this.orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.2, 30); }, { passive: true });
  }

  update(dt) {
    this.t = (this.t ?? 0) + dt;
    const o = this.orbit;
    if (!this.dragging) o.yaw += dt * 0.08;
    const panel = document.querySelector('.setup-panel');
    const pw = panel ? panel.getBoundingClientRect().width : 0;
    const h = innerHeight;
    // Shift the view so the subject sits in the visible area left of the panel.
    if (innerWidth > 800) {
      this.cam.aspect = (innerWidth + pw) / h;
      this.cam.setViewOffset(innerWidth + pw, h, pw, 0, innerWidth, h);
    } else {
      this.cam.aspect = innerWidth / h;
      this.cam.clearViewOffset();
    }
    this.cam.updateProjectionMatrix();
    const p = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.dist).add(o.target);
    this.cam.position.copy(p);
    this.cam.lookAt(o.target);
    if (this.avatar) this.avatar.update(dt, { speed: 0 });
    if (this.truckAvatar) this.truckAvatar.update(dt, { speed: 0 });
    if (this.truckObj) {
      const E = this.truckObj.els;
      const ph = (this.t % 1.6) / 1.6;
      E.bankA.emissiveIntensity = ph < 0.5 ? 4 * Math.sin(ph * 2 * Math.PI) : 0;
      E.bankB.emissiveIntensity = ph >= 0.5 ? 4 * Math.sin((ph - 0.5) * 2 * Math.PI) : 0;
    }
  }

  // ------------------------------------------------------------ options
  chipRow(label, items, get, set, { swatch = false } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'opt';
    wrap.innerHTML = `<label class="lab">${label}</label>`;
    const row = document.createElement('div');
    row.className = swatch ? 'swatches' : 'chips';
    items.forEach(([value, text, color]) => {
      const b = document.createElement('button');
      b.className = swatch ? 'sw' : 'chip';
      if (swatch) { b.style.background = color; b.title = text; } else b.textContent = text;
      b.onclick = () => { set(value); [...row.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); this.changed(); };
      if (get() === value) b.classList.add('on');
      row.appendChild(b);
    });
    wrap.appendChild(row);
    return wrap;
  }
  changed() {
    this.save();
    const name = STEPS[this.step];
    if (name === 'character' || name === 'clothes') this.showAvatar();
    if (name === 'truck' || name === 'livery') this.showTruck();
  }

  buildCharacterOptions() {
    const a = this.state.appearance;
    const el = $('optCharacter');
    el.innerHTML = '';
    const name = document.createElement('div');
    name.className = 'opt';
    name.innerHTML = '<label class="lab">Name</label><input type="text" maxlength="20">';
    name.querySelector('input').value = a.name ?? 'Driver';
    name.querySelector('input').oninput = (e) => { a.name = e.target.value || 'Driver'; this.save(); };
    el.appendChild(name);
    el.appendChild(this.chipRow('Face', FACES.map((f, i) => [i, f.name]), () => a.face, (v) => { a.face = v; }));
    el.appendChild(this.chipRow('Race / ethnicity', RACES.map((r) => [r.id, r.name]), () => a.race, (v) => {
      const r = RACES.find((x) => x.id === v);
      Object.assign(a, { race: v, skin: r.skin, hair: r.hair, hairColor: r.hairColor, eyes: r.eyes });
      this.buildCharacterOptions();
    }));
    el.appendChild(this.chipRow('Skin tone', SKIN_TONES.map((s, i) => [i, s.name, s.hex]), () => a.skin, (v) => { a.skin = v; }, { swatch: true }));
    const h = document.createElement('div');
    h.className = 'opt';
    const ft = (cm) => { const inch = Math.round(cm / 2.54); return `${Math.floor(inch / 12)}′${inch % 12}″ (${cm} cm)`; };
    h.innerHTML = `<label class="lab">Height <span class="rangeval">${ft(a.height)}</span></label><input type="range" min="152" max="203" step="1" value="${a.height}">`;
    h.querySelector('input').oninput = (e) => { a.height = +e.target.value; h.querySelector('.rangeval').textContent = ft(a.height); this.orbit.target.y = 1.45 * a.height / 178; this.changed(); };
    el.appendChild(h);
    el.appendChild(this.chipRow('Body', [['masc', 'Masculine'], ['fem', 'Feminine']], () => a.body, (v) => { a.body = v; }));
    el.appendChild(this.chipRow('Build', BUILDS.map((b) => [b[0], b[1]]), () => a.build, (v) => { a.build = v; }));
    el.appendChild(this.chipRow('Hair', HAIR_STYLES, () => a.hair, (v) => { a.hair = v; }));
    el.appendChild(this.chipRow('Hair color', HAIR_COLORS.map((c, i) => [i, HAIR_COLOR_NAMES[i], c]), () => a.hairColor, (v) => { a.hairColor = v; }, { swatch: true }));
    el.appendChild(this.chipRow('Facial hair', FACIAL_HAIR, () => a.facialHair, (v) => { a.facialHair = v; }));
    el.appendChild(this.chipRow('Eyes', EYE_COLORS.map((e, i) => [i, e[0], e[1]]), () => a.eyes, (v) => { a.eyes = v; }, { swatch: true }));
  }

  buildClothesOptions() {
    const a = this.state.appearance;
    const el = $('optClothes');
    el.innerHTML = '';
    el.appendChild(this.chipRow('High-visibility vest', VESTS, () => a.vest, (v) => { a.vest = v; }));
    el.appendChild(this.chipRow('Shirt', SHIRTS, () => a.shirt, (v) => { a.shirt = v; }));
    el.appendChild(this.chipRow('Shirt color', CLOTH_COLORS.map((c, i) => [i, c, c]), () => a.shirtColor, (v) => { a.shirtColor = v; }, { swatch: true }));
    el.appendChild(this.chipRow('Pants', PANTS, () => a.pants, (v) => { a.pants = v; }));
    el.appendChild(this.chipRow('Pants color', CLOTH_COLORS.map((c, i) => [i, c, c]), () => a.pantsColor, (v) => { a.pantsColor = v; }, { swatch: true }));
    el.appendChild(this.chipRow('Boots', BOOTS, () => a.boots, (v) => { a.boots = v; }));
    el.appendChild(this.chipRow('Hat', HATS, () => a.hat, (v) => { a.hat = v; }));
    el.appendChild(this.chipRow('Hat color', CLOTH_COLORS.map((c, i) => [i, c, c]), () => a.hatColor, (v) => { a.hatColor = v; }, { swatch: true }));
    el.appendChild(this.chipRow('Gloves', GLOVES, () => a.gloves, (v) => { a.gloves = v; }));
  }

  buildTruckOptions() {
    const el = $('optTruck');
    el.innerHTML = '';
    for (const t of TRUCKS) {
      const b = document.createElement('button');
      b.className = 'card' + (t.id === this.state.truck ? ' on' : '');
      b.innerHTML = `<b>${t.name}</b><span>${t.blurb}</span>`;
      b.onclick = () => { this.state.truck = t.id; this.state.livery = 0; [...el.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); this.changed(); };
      el.appendChild(b);
    }
  }

  buildLiveryOptions() {
    const el = $('optLivery');
    el.innerHTML = '';
    LIVERIES[this.state.truck].forEach((liv, i) => {
      const c = COMPANIES[liv.company];
      const b = document.createElement('button');
      b.className = 'card' + (i === this.state.livery ? ' on' : '');
      const textName = liv.text === '#ffffff' ? 'White lettering' : 'Black lettering';
      b.innerHTML = `<div class="liv"><i style="background:${liv.cab}"><em style="position:absolute;left:4px;right:4px;top:10px;height:4px;background:${liv.text}"></em></i><div><b>${c.name}</b><span>${c.address} · ${c.phone} · ${textName}</span></div></div>`;
      b.onclick = () => { this.state.livery = i; [...el.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.changed(); };
      el.appendChild(b);
    });
  }

  buildWeatherOptions() {
    const el = $('optWeather');
    el.innerHTML = '';
    for (const w of WEATHERS) {
      const b = document.createElement('button');
      b.className = 'card' + (w.id === this.state.weather ? ' on' : '');
      b.innerHTML = `<b>${w.name}</b><span>${w.desc}</span>`;
      b.onclick = () => { this.state.weather = w.id; [...el.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); this.save(); this.game.previewWeather(w.id); };
      el.appendChild(b);
    }
  }

  buildSpawnOptions() {
    const el = $('optSpawn');
    el.innerHTML = '';
    SPAWNS.forEach((s, i) => {
      const b = document.createElement('button');
      const on = this.state.spawn.kind === 'preset' && this.state.spawn.index === i;
      b.className = 'card' + (on ? ' on' : '');
      b.innerHTML = `<b>${i + 1}. ${s.name}</b>`;
      b.onclick = () => { this.state.spawn = { kind: 'preset', index: i }; this.save(); this.buildSpawnOptions(); this.drawSpawnMap(); };
      el.appendChild(b);
    });
    if (this.state.spawn.kind === 'custom') {
      const b = document.createElement('button');
      b.className = 'card on';
      b.innerHTML = `<b>Custom spot</b><span>${this.state.spawn.label ?? 'Picked on the map'}</span>`;
      el.appendChild(b);
    }
  }

  drawSpawnMap() {
    const cv = $('spawnMap');
    const r = cv.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
    const g = cv.getContext('2d');
    const map = this.game.hud.map;
    const S = Math.min(cv.width, cv.height);
    const ox = (cv.width - S) / 2, oy = (cv.height - S) / 2;
    const span = 1600; // meters shown
    const k = S / span;
    const W = (x, z) => [ox + S / 2 + x * k, oy + S / 2 + z * k];
    g.fillStyle = '#0c1118'; g.fillRect(0, 0, cv.width, cv.height);
    if (map) {
      // The prerendered map covers ±1000 m.
      const mk = S / (span / 1.25);
      g.save();
      g.translate(ox + S / 2, oy + S / 2);
      g.scale(mk, mk);
      g.drawImage(map, -map.width / 2, -map.height / 2);
      g.restore();
    }
    g.font = `700 ${Math.round(13 * dpr)}px sans-serif`;
    g.textAlign = 'center';
    SPAWNS.forEach((s, i) => {
      const p = this.game.spawnPose(s);
      const [x, y] = W(p.x, p.z);
      const on = this.state.spawn.kind === 'preset' && this.state.spawn.index === i;
      g.fillStyle = on ? '#ffb000' : '#e9eef5';
      g.beginPath(); g.arc(x, y, (on ? 11 : 8) * dpr, 0, 7); g.fill();
      g.fillStyle = '#111'; g.fillText(String(i + 1), x, y + 4.5 * dpr);
    });
    if (this.state.spawn.kind === 'custom') {
      const [x, y] = W(this.state.spawn.x, this.state.spawn.z);
      g.fillStyle = '#ffb000'; g.beginPath(); g.arc(x, y, 11 * dpr, 0, 7); g.fill();
      g.fillStyle = '#111'; g.fillText('★', x, y + 5 * dpr);
    }
    cv.onclick = (e) => {
      const rr = cv.getBoundingClientRect();
      const px = (e.clientX - rr.left) * dpr, py = (e.clientY - rr.top) * dpr;
      const x = (px - ox - S / 2) / k, z = (py - oy - S / 2) / k;
      // Snap to a preset if close, else to the nearest road.
      const hitPreset = SPAWNS.findIndex((s) => { const p = this.game.spawnPose(s); return Math.hypot(p.x - x, p.z - z) < 30; });
      if (hitPreset >= 0) this.state.spawn = { kind: 'preset', index: hitPreset };
      else {
        const n = this.game.nav.nearest({ x, y: 0, z }, null);
        if (!n) return;
        const e2 = n.e;
        const label = `${e2.name} (picked on the map)`;
        this.state.spawn = { kind: 'custom', x: n.pr.x, y: n.pr.y, z: n.pr.z, edge: e2.id, seg: n.i, label };
      }
      this.save();
      this.buildSpawnOptions();
      this.drawSpawnMap();
    };
  }

  finish() {
    this.save();
    this.close();
    this.game.startShift(this.state);
  }

  get active() { return $('setup').classList.contains('show'); }
}
