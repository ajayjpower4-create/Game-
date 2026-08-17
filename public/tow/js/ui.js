// All the DOM: the pre-shift setup screens, the HUD, the radio popup and the
// map. The 3D previews on the setup screens run on their own tiny renderer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHARACTER_OPTIONS, buildCharacter, defaultCharacter } from './character.js';
import { TRUCKS, LIVERIES, buildTowTruck, setELSMode, updateTruckLights, truckLayout } from './towtrucks.js';
import { WEATHERS } from './weather.js';
import { SCENE_TYPE_LABEL } from './jobs.js';
import { fmtMoney, fmtClock, clamp, TAU } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ------------------------------------------------------------- 3D previews */

class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2029);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(6, 10, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x30343a, 1.6));
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.3, 40),
      new THREE.MeshStandardMaterial({ color: 0x2b3139, roughness: 0.9 }));
    floor.position.y = -0.15; floor.receiveShadow = true;
    this.scene.add(floor);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.spin = 0;
    this.running = false;
  }

  show(object, { distance = 5, height = 1.2, spin = true } = {}) {
    this.pivot.clear();
    if (object) this.pivot.add(object);
    this.dist = distance; this.height = height; this.autoSpin = spin;
    this.render();
  }

  resize() {
    const w = this.canvas.clientWidth || 400, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt = 0.016) {
    if (this.autoSpin) this.spin += dt * 0.45;
    this.pivot.rotation.y = this.spin;
    this.camera.position.set(0, this.height + this.dist * 0.32, this.dist);
    this.camera.lookAt(0, this.height * 0.7, 0);
    this.resize();
    this.renderer.render(this.scene, this.camera);
  }
}

/* --------------------------------------------------------------- setup flow */

const SCREENS = ['title', 'character', 'clothes', 'truck', 'livery', 'weather', 'spawn'];

export class SetupUI {
  constructor(root, { onStart, city }) {
    this.root = root;
    this.onStart = onStart;
    this.city = city;
    this.cfg = {
      character: defaultCharacter(),
      truck: TRUCKS[0].id,
      livery: LIVERIES[0].id,
      weather: WEATHERS[0].id,
      spawn: city.spawnPoints[0].id,
    };
    this.screen = 'title';
    this.preview = new Preview($('#previewCanvas', root));
    this.build();
    this.setScreen('title');
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  build() {
    const r = this.root;

    /* character */
    const cs = $('#characterOptions', r);
    cs.append(
      this.optionRow('Skin tone', CHARACTER_OPTIONS.SKIN_TONES, 'skin', (o) => ({ swatch: o.hex, label: o.name })),
      this.optionRow('Face', CHARACTER_OPTIONS.FACES, 'face', (o) => ({ label: o.name })),
      this.optionRow('Hair', CHARACTER_OPTIONS.HAIR_STYLES, 'hair', (o) => ({ label: o.name })),
      this.optionRow('Hair colour', CHARACTER_OPTIONS.HAIR_COLORS, 'hairColor', (o) => ({ swatch: o.hex, label: o.id })),
      this.optionRow('Build', CHARACTER_OPTIONS.BUILDS, 'build', (o) => ({ label: o.name })),
      this.sliderRow('Height', 'height', 0.86, 1.16, 0.01, (v) => `${Math.round(150 + (v - 0.86) * 220)} cm`),
    );

    /* clothes */
    const cl = $('#clothesOptions', r);
    cl.append(
      this.optionRow('Shirt', CHARACTER_OPTIONS.SHIRTS, 'shirt', (o) => ({ swatch: o.hex, label: o.name })),
      this.optionRow('Trousers', CHARACTER_OPTIONS.PANTS, 'pants', (o) => ({ swatch: o.hex, label: o.name })),
      this.optionRow('Hi-vis vest', CHARACTER_OPTIONS.VESTS, 'vest', (o) => ({ swatch: o.hex, label: o.name })),
      this.optionRow('Hat', CHARACTER_OPTIONS.HATS, 'hat', (o) => ({ label: o.name })),
      this.toggleRow('Wear the vest', 'vestOn'),
      this.toggleRow('Work gloves', 'gloves'),
    );

    /* trucks */
    const tw = $('#truckOptions', r);
    TRUCKS.forEach((t) => {
      const card = el('button', 'card');
      card.append(el('h4', null, t.name));
      card.append(el('p', 'muted', t.blurb));
      const stats = el('div', 'stats');
      stats.append(el('span', null, `Deck ${(truckLayout(t).deckLength * 3.28).toFixed(0)} ft`));
      stats.append(el('span', null, `Capacity ${t.capacity.toLocaleString()} lb`));
      stats.append(el('span', null, `Top ${t.speed} km/h`));
      stats.append(el('span', null, `${t.boxes * 2} compartments`));
      card.append(stats);
      card.onclick = () => { this.cfg.truck = t.id; this.refresh(); };
      card.dataset.value = t.id;
      tw.append(card);
    });

    /* liveries */
    const lw = $('#liveryOptions', r);
    LIVERIES.forEach((l) => {
      const card = el('button', 'card');
      const sw = el('div', 'livery-swatch');
      sw.style.background = '#' + l.base.toString(16).padStart(6, '0');
      sw.style.color = l.text;
      sw.style.borderColor = '#' + l.accent.toString(16).padStart(6, '0');
      sw.append(el('strong', null, l.company));
      sw.append(el('span', null, l.address));
      sw.append(el('span', null, l.phone));
      card.append(sw);
      card.append(el('p', 'muted', `${l.textMode === 'white' ? 'White' : 'Black'} lettering · ${l.tagline}`));
      card.onclick = () => { this.cfg.livery = l.id; this.refresh(); };
      card.dataset.value = l.id;
      lw.append(card);
    });

    /* weather */
    const ww = $('#weatherOptions', r);
    WEATHERS.forEach((w) => {
      const card = el('button', 'card');
      card.append(el('h4', null, w.name));
      card.append(el('p', 'muted', w.blurb));
      const stats = el('div', 'stats');
      stats.append(el('span', null, `Starts ${fmtClock(w.hour * 60)}`));
      stats.append(el('span', null, `Grip ${Math.round(w.grip * 100)}%`));
      if (w.grip < 0.8) stats.append(el('span', 'warn', 'Hazard pay +20%'));
      card.append(stats);
      card.onclick = () => { this.cfg.weather = w.id; this.refresh(); };
      card.dataset.value = w.id;
      ww.append(card);
    });

    /* spawn */
    const sw = $('#spawnOptions', r);
    this.city.spawnPoints.forEach((s) => {
      const card = el('button', 'card');
      card.append(el('h4', null, s.name));
      card.append(el('p', 'muted', s.desc));
      card.onclick = () => { this.cfg.spawn = s.id; this.refresh(); };
      card.dataset.value = s.id;
      sw.append(card);
    });
    const mapC = $('#spawnMap', r);
    mapC.width = 420; mapC.height = 420;

    /* navigation */
    r.querySelectorAll('[data-goto]').forEach((b) => {
      b.onclick = () => this.setScreen(b.dataset.goto);
    });
    $('#startShift', r).onclick = () => {
      this.dispose();
      this.onStart(structuredClone(this.cfg));
    };
  }

  optionRow(label, options, key, render) {
    const row = el('div', 'optrow');
    row.append(el('label', null, label));
    const wrap = el('div', 'chips');
    options.forEach((o) => {
      const b = el('button', 'chip');
      const d = render(o);
      if (d.swatch != null) {
        const s = el('span', 'dot');
        s.style.background = '#' + d.swatch.toString(16).padStart(6, '0');
        b.append(s);
      }
      b.append(el('span', null, d.label));
      b.dataset.key = key; b.dataset.value = o.id;
      b.onclick = () => { this.cfg.character[key] = o.id; this.refresh(); };
      wrap.append(b);
    });
    row.append(wrap);
    return row;
  }

  sliderRow(label, key, min, max, step, fmt) {
    const row = el('div', 'optrow');
    row.append(el('label', null, label));
    const wrap = el('div', 'chips');
    const input = el('input', 'slider');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    input.value = this.cfg.character[key];
    const out = el('span', 'sliderval', fmt(Number(input.value)));
    input.oninput = () => {
      this.cfg.character[key] = Number(input.value);
      out.textContent = fmt(Number(input.value));
      this.refresh();
    };
    wrap.append(input, out);
    row.append(wrap);
    return row;
  }

  toggleRow(label, key) {
    const row = el('div', 'optrow');
    row.append(el('label', null, label));
    const wrap = el('div', 'chips');
    const b = el('button', 'chip');
    b.append(el('span', null, this.cfg.character[key] ? 'Yes' : 'No'));
    b.onclick = () => {
      this.cfg.character[key] = !this.cfg.character[key];
      b.firstChild.textContent = this.cfg.character[key] ? 'Yes' : 'No';
      b.classList.toggle('on', this.cfg.character[key]);
      this.refresh();
    };
    b.classList.toggle('on', this.cfg.character[key]);
    wrap.append(b);
    row.append(wrap);
    return row;
  }

  setScreen(name) {
    this.screen = name;
    this.root.querySelectorAll('section[data-screen]').forEach((s) => {
      s.classList.toggle('active', s.dataset.screen === name);
    });
    const step = SCREENS.indexOf(name);
    $('#setupProgress', this.root).style.width = `${(step / (SCREENS.length - 1)) * 100}%`;
    this.refresh();
  }

  refresh() {
    // Reflect selection state on every chip and card.
    const c = this.cfg.character;
    this.root.querySelectorAll('.chip[data-key]').forEach((b) => {
      b.classList.toggle('on', String(c[b.dataset.key]) === b.dataset.value);
    });
    for (const [wrap, val] of [['#truckOptions', this.cfg.truck], ['#liveryOptions', this.cfg.livery],
    ['#weatherOptions', this.cfg.weather], ['#spawnOptions', this.cfg.spawn]]) {
      this.root.querySelectorAll(`${wrap} .card`).forEach((card) => {
        card.classList.toggle('on', card.dataset.value === val);
      });
    }
    // Rebuild whichever preview this screen wants.
    const liv = LIVERIES.find((l) => l.id === this.cfg.livery);
    if (this.screen === 'character' || this.screen === 'clothes') {
      const ch = buildCharacter(this.cfg.character, { company: liv.company });
      this.preview.show(ch, { distance: 4.4, height: 1.0 });
      this.previewChar = ch;
    } else if (this.screen === 'truck' || this.screen === 'livery' || this.screen === 'weather') {
      const truck = buildTowTruck(this.cfg.truck, this.cfg.livery);
      setELSMode(truck, 2);
      this.previewTruck = truck;
      this.preview.show(truck, { distance: 15, height: 1.6 });
    } else if (this.screen === 'spawn') {
      const truck = buildTowTruck(this.cfg.truck, this.cfg.livery);
      setELSMode(truck, 2);
      this.previewTruck = truck;
      this.preview.show(truck, { distance: 15, height: 1.6 });
      this.drawSpawnMap();
    }
    $('#previewCaption', this.root).textContent = this.captionFor();
  }

  captionFor() {
    const liv = LIVERIES.find((l) => l.id === this.cfg.livery);
    const t = TRUCKS.find((t) => t.id === this.cfg.truck);
    switch (this.screen) {
      case 'character': case 'clothes': return `${liv.company} — driver`;
      case 'truck': return t.name;
      case 'livery': return `${liv.company} · ${liv.phone}`;
      case 'weather': return `${t.name} in ${WEATHERS.find((w) => w.id === this.cfg.weather).name.toLowerCase()}`;
      case 'spawn': return this.city.spawnPoints.find((s) => s.id === this.cfg.spawn)?.name || '';
      default: return 'Skyville, tonight';
    }
  }

  drawSpawnMap() {
    const cvs = $('#spawnMap', this.root);
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(this.city.mapCanvas, 0, 0, cvs.width, cvs.height);
    const S = cvs.width / (this.city.bounds * 2);
    for (const s of this.city.spawnPoints) {
      const x = (s.x + this.city.bounds) * S, y = (this.city.bounds - s.z) * S;
      const on = s.id === this.cfg.spawn;
      ctx.fillStyle = on ? '#ffb03a' : '#7d8794';
      ctx.beginPath(); ctx.arc(x, y, on ? 8 : 5, 0, TAU); ctx.fill();
      if (on) {
        ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(s.name, x, y - 20);
      }
    }
  }

  tick(t) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    if (this.previewTruck) updateTruckLights(this.previewTruck, t / 1000);
    this.preview.render(dt);
    requestAnimationFrame(this.tick);
  }

  dispose() {
    this.disposed = true;
    this.preview.renderer.dispose();
    this.root.classList.add('hidden');
  }
}

/* ---------------------------------------------------------------- game HUD */

export class HUD {
  constructor(root, city) {
    this.root = root;
    this.city = city;
    this.elSpeed = $('#speedValue', root);
    this.elGear = $('#gearValue', root);
    this.elEls = $('#elsValue', root);
    this.elMoney = $('#moneyValue', root);
    this.elClock = $('#clockValue', root);
    this.elPrompt = $('#prompt', root);
    this.elJob = $('#jobCard', root);
    this.elToasts = $('#toasts', root);
    this.elRadio = $('#radioCall', root);
    this.elMeter = $('#meter', root);
    this.elCarry = $('#carrying', root);
    this.map = $('#minimap', root);
    this.mapCtx = this.map.getContext('2d');
    this.bigMap = $('#bigMap', root);
    this.bigMapCtx = this.bigMap.getContext('2d');
    this.mapOpen = false;
    this.toasts = [];
  }

  toast(text, kind = '') {
    const n = el('div', 'toast ' + kind, text);
    this.elToasts.append(n);
    setTimeout(() => n.classList.add('in'), 10);
    setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, 4200);
  }

  setPrompt(list) {
    if (!list || !list.length) { this.elPrompt.classList.add('hidden'); return; }
    this.elPrompt.classList.remove('hidden');
    this.elPrompt.innerHTML = '';
    for (const p of list.slice(0, 4)) {
      const row = el('div', 'promptrow');
      row.append(el('kbd', null, p.key));
      row.append(el('span', null, p.label));
      this.elPrompt.append(row);
    }
  }

  setMeter(label, value) {
    if (value == null) { this.elMeter.classList.add('hidden'); return; }
    this.elMeter.classList.remove('hidden');
    this.elMeter.innerHTML = '';
    this.elMeter.append(el('span', 'meterlabel', label));
    const bar = el('div', 'meterbar');
    const fill = el('div', 'meterfill');
    fill.style.width = `${clamp(value, 0, 1) * 100}%`;
    bar.append(fill);
    this.elMeter.append(bar);
  }

  setStats({ speedMph, gear, els, money, minutes, carrying }) {
    this.elSpeed.textContent = Math.round(speedMph);
    this.elGear.textContent = gear;
    this.elEls.textContent = ['OFF', 'STEADY', 'FLASH'][els] || 'OFF';
    this.elEls.className = els ? 'els on' : 'els';
    this.elMoney.textContent = fmtMoney(money);
    this.elClock.textContent = fmtClock(minutes);
    this.elCarry.textContent = carrying ? `Carrying: ${carrying}` : '';
    this.elCarry.classList.toggle('hidden', !carrying);
  }

  setJob(job, distanceText) {
    if (!job) { this.elJob.classList.add('hidden'); return; }
    this.elJob.classList.remove('hidden');
    this.elJob.innerHTML = '';
    const head = el('div', 'jobhead');
    head.append(el('span', 'tag', SCENE_TYPE_LABEL[job.scene.type] || 'Call'));
    head.append(el('span', 'pay', fmtMoney(job.pay)));
    this.elJob.append(head);
    this.elJob.append(el('p', 'jobtext', job.scene.text));
    const meta = el('div', 'jobmeta');
    meta.append(el('span', null, `Caller: ${job.scene.caller}`));
    meta.append(el('span', null, `Deliver to: ${job.shop.name}`));
    if (distanceText) meta.append(el('span', 'dist', distanceText));
    this.elJob.append(meta);
    const ul = el('ul', 'steps');
    job.steps.forEach((s, i) => {
      const li = el('li', s.done ? 'done' : (i === job.stepIndex ? 'current' : ''));
      li.append(el('span', 'box', s.done ? '✓' : (i === job.stepIndex ? '▸' : '·')));
      li.append(el('span', null, s.text));
      ul.append(li);
    });
    this.elJob.append(ul);
  }

  showCall(offer, { distance }) {
    this.elRadio.classList.remove('hidden');
    this.elRadio.innerHTML = '';
    this.elRadio.append(el('div', 'radiohead', 'INCOMING CALL — DISPATCH'));
    this.elRadio.append(el('p', 'radioline', `${offer.opener} ${offer.scene.text}`));
    const meta = el('div', 'radiometa');
    meta.append(el('span', null, `${SCENE_TYPE_LABEL[offer.scene.type] || 'Call'}`));
    meta.append(el('span', null, `${offer.scene.caller}`));
    meta.append(el('span', null, `${offer.site.street}`));
    meta.append(el('span', null, `${(distance / 1000).toFixed(1)} km`));
    meta.append(el('span', 'pay', fmtMoney(offer.pay)));
    meta.append(el('span', null, `→ ${offer.shop.name}`));
    this.elRadio.append(meta);
    const btns = el('div', 'radiobtns');
    btns.append(el('span', 'accept', 'ACCEPT  [Y]'));
    btns.append(el('span', 'decline', 'DECLINE  [N]'));
    this.elRadio.append(btns);
  }

  hideCall() { this.elRadio.classList.add('hidden'); }

  toggleMap(force) {
    this.mapOpen = force ?? !this.mapOpen;
    this.bigMap.parentElement.classList.toggle('hidden', !this.mapOpen);
  }

  drawMap(player, waypoint, heading) {
    // Small corner map: north-up, panning with the player, ~300 m across.
    const c = this.mapCtx, size = this.map.width;
    const worldSpan = 300;
    const scale = this.city.mapCanvas.width / (this.city.bounds * 2);
    const view = worldSpan * scale;
    const zoom = size / view;
    c.save();
    c.clearRect(0, 0, size, size);
    c.beginPath(); c.arc(size / 2, size / 2, size / 2 - 1, 0, TAU); c.clip();
    const S = this.city.mapCanvas.width / (this.city.bounds * 2);
    const px = (player.x + this.city.bounds) * S;
    const pz = (this.city.bounds - player.z) * S;
    c.drawImage(this.city.mapCanvas, px - view / 2, pz - view / 2, view, view, 0, 0, size, size);
    // Waypoint marker (clamped to the edge of the disc).
    if (waypoint) {
      const wx = (waypoint.x - player.x) * S * zoom + size / 2;
      const wz = (player.z - waypoint.z) * S * zoom + size / 2;
      const dx = wx - size / 2, dz = wz - size / 2;
      const d = Math.hypot(dx, dz);
      const max = size / 2 - 12;
      const cx = d > max ? size / 2 + (dx / d) * max : wx;
      const cz = d > max ? size / 2 + (dz / d) * max : wz;
      c.fillStyle = '#ffb03a';
      c.beginPath(); c.arc(cx, cz, 6, 0, TAU); c.fill();
      c.strokeStyle = '#1a1d22'; c.lineWidth = 2; c.stroke();
    }
    // Player arrow.
    c.translate(size / 2, size / 2);
    c.rotate(-heading);
    c.fillStyle = '#e8f1ff';
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 4); c.lineTo(-6, 7); c.closePath(); c.fill();
    c.restore();
  }

  drawBigMap(player, waypoint, shops) {
    const c = this.bigMapCtx;
    const size = this.bigMap.width;
    c.clearRect(0, 0, size, size);
    c.drawImage(this.city.mapCanvas, 0, 0, size, size);
    const S = size / (this.city.bounds * 2);
    const tx = (x) => (x + this.city.bounds) * S;
    const tz = (z) => (this.city.bounds - z) * S;
    if (waypoint) {
      c.fillStyle = '#ffb03a';
      c.beginPath(); c.arc(tx(waypoint.x), tz(waypoint.z), 9, 0, TAU); c.fill();
      c.strokeStyle = '#1a1d22'; c.lineWidth = 3; c.stroke();
      c.setLineDash([8, 8]); c.strokeStyle = 'rgba(255,176,58,.7)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(tx(player.x), tz(player.z)); c.lineTo(tx(waypoint.x), tz(waypoint.z)); c.stroke();
      c.setLineDash([]);
    }
    c.fillStyle = '#e8f1ff';
    c.beginPath(); c.arc(tx(player.x), tz(player.z), 7, 0, TAU); c.fill();
    c.strokeStyle = '#12151a'; c.lineWidth = 2; c.stroke();
  }
}
