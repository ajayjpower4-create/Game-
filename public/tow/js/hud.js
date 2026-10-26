// On-screen HUD: prompts, toasts, the dispatch popup, dialog, objectives,
// rotating minimap with the GPS route, the full map, and the dash readout.
import { GRID, halfWidthAt, ringPoint, RING_LEN, parkwayPoint, PARKWAY_LEN, PARKWAY, SHOPS, INTERCHANGES, interchangeWorld, NS_NAMES, EW_NAMES, BAY_X, rampWorld, PLACES } from './city/layout.js';
import { makeCanvas, fmtMoney, fmtDist, clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const EXT = 1000, MPP = 1.25;           // map covers ±1000 m at 1.25 m per pixel
const toPx = (v) => (v + EXT) / MPP;

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    this.toastEl = $('toast');
    this.prompt = $('prompt');
    this.cross = $('crosshair');
    this.mini = $('minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.map = null;
    this.dialogState = null;
    this.helpOn = true;
    $('dialog').addEventListener('click', () => this.advanceDialog());
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  // ---------------------------------------------------------- city map
  buildMap(city) {
    const N = Math.round((EXT * 2) / MPP);
    const c = makeCanvas(N, N);
    const g = c.getContext('2d');
    g.fillStyle = '#18241b'; g.fillRect(0, 0, N, N);
    g.fillStyle = '#0f2a3a'; g.fillRect(toPx(BAY_X), 0, N, N);
    // Blocks (sidewalk slabs).
    g.fillStyle = '#262c33';
    for (const b of city.blocks) g.fillRect(toPx(b.x0), toPx(b.z0), (b.x1 - b.x0) / MPP, (b.z1 - b.z0) / MPP);
    // Parks.
    g.fillStyle = '#1f3a24';
    for (const p of PLACES.filter((p) => p.kind === 'park')) g.fillRect(toPx(p.x - 50), toPx(p.z - 50), 100 / MPP, 100 / MPP);
    // Buildings.
    for (const s of city.solids) {
      g.fillStyle = s.shop ? (SHOPS.find((x) => x.id === s.shop)?.color ?? '#555') : s.h > 40 ? '#4a5260' : '#3a414c';
      g.fillRect(toPx(s.x0), toPx(s.z0), (s.x1 - s.x0) / MPP, (s.z1 - s.z0) / MPP);
    }
    // Streets.
    g.strokeStyle = '#5c636e';
    g.lineCap = 'butt';
    for (const cc of GRID) {
      const hw = halfWidthAt(cc);
      const e = (cc === -240 || cc === 240) ? PARKWAY.half : 486;
      g.lineWidth = (hw * 2) / MPP;
      g.beginPath(); g.moveTo(toPx(cc), toPx(-e)); g.lineTo(toPx(cc), toPx(e)); g.stroke();
      g.beginPath(); g.moveTo(toPx(-e), toPx(cc)); g.lineTo(toPx(e), toPx(cc)); g.stroke();
    }
    g.lineWidth = (PARKWAY.hw * 2) / MPP;
    g.beginPath();
    for (let s = 0; s <= PARKWAY_LEN; s += 10) { const p = parkwayPoint(s); s ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z)); }
    g.closePath(); g.stroke();
    // Ramps and the ring.
    g.strokeStyle = '#8c7a4e';
    g.lineWidth = 6.2 / MPP;
    for (const ic of INTERCHANGES) for (const d of [1, -1]) for (const k of ['off', 'on']) {
      const pts = rampWorld(ic, d, k);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z)))); g.stroke();
    }
    g.strokeStyle = '#b4934a';
    g.lineWidth = 25 / MPP;
    g.beginPath();
    for (let s = 0; s <= RING_LEN; s += 8) { const p = ringPoint(s); s ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z)); }
    g.closePath(); g.stroke();
    g.strokeStyle = '#6b5626'; g.lineWidth = 1;
    g.stroke();
    this.map = c;
  }

  // ------------------------------------------------------------- frame
  update(dt) {
    const g = this.game;
    // Prompt.
    const t = g.interact.target;
    const e = g.eAction;
    const parts = [];
    const kb = (s) => s.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
    if (g.jobs.job?.canDrop) parts.push(`<kbd>F</kbd>Drop off the ${g.jobs.job.vehicleName} at ${g.jobs.job.shop.short}`);
    if (t?.label) parts.push(kb(t.label.startsWith('[') ? t.label : `[LMB] ${t.label}`));
    if (e) parts.push(`<kbd>E</kbd>${e.label}`);
    if (parts.length) {
      const html = parts.join('<span style="opacity:.5"> &nbsp;·&nbsp; </span>');
      if (html !== this.lastPrompt) { this.prompt.innerHTML = html; this.lastPrompt = html; }
      this.prompt.classList.remove('hidden');
    } else this.prompt.classList.add('hidden');
    this.cross.classList.toggle('active', !!t);
    this.cross.style.display = g.mode === 'truck' && g.camRig.mode === 'chase' || g.mode === 'car' ? 'none' : '';
    // Top bar.
    $('money').textContent = fmtMoney(g.money);
    $('clock').textContent = g.clock();
    $('location').textContent = g.locationName();
    // Dash.
    const v = g.vehicle;
    $('dash').style.display = v ? '' : 'none';
    if (v) {
      $('speedVal').textContent = Math.round(Math.abs(v.speed) * 2.237);
      $('gear').textContent = v.parkingBrake ? 'P' : v.engineOn ? v.gear : '—';
      const tr = g.truck;
      $('pbrake').classList.toggle('on', !!v.parkingBrake);
      $('pbrake').style.display = v === tr ? '' : 'none';
      $('elsInd').style.display = $('bedInd').style.display = v === tr ? '' : 'none';
      $('elsInd').textContent = tr.els === 'slow' ? 'ELS SLOW' : tr.els === 'steady' ? 'ELS STEADY' : 'ELS OFF';
      $('elsInd').className = 'ind' + (tr.els !== 'off' ? ' amber' : '');
      $('bedInd').textContent = tr.bed.tilt > 0 ? `BED ${Math.round((tr.bed.tilt / tr.bed.maxTilt) * 50 + (tr.bed.slide / tr.bed.slideMax) * 50)}%` : 'BED ⇣';
    }
    const T = g.tools;
    $('handInd').textContent = T.hand ? `In hand: ${T.handName()}${T.pendingStrap ? ' (one strap over a tire — hook it to the bed)' : ''}  ·  G: put down` : '';
    if (!v) { $('dash').style.display = ''; $('speed').style.display = 'none'; $('dashRow').style.display = 'none'; } else { $('speed').style.display = ''; $('dashRow').style.display = ''; }
    // Job panel.
    const job = g.jobs.job;
    $('jobPanel').classList.toggle('hidden', !job);
    if (job) {
      $('jobTitle').textContent = `${job.title} · ${fmtMoney(job.pay)}`;
      const steps = g.jobs.objectives();
      const firstOpen = steps.findIndex((s) => !s.done && !s.optional);
      $('jobSteps').innerHTML = steps.map((s, i) => `<li class="${s.done ? 'done' : i === firstOpen ? 'cur' : ''}${s.optional && !s.done ? ' opt' : ''}">${s.text}</li>`).join('');
    }
    // GPS line.
    const gps = g.nav.route ? g.nav.instruction() : '';
    $('gps').classList.toggle('hidden', !gps);
    $('gps').textContent = gps;
    this.drawMinimap();
    // Help card for the first minute.
    const help = $('help');
    if (this.helpOn) {
      help.classList.remove('hidden');
      help.innerHTML = g.mode === 'truck'
        ? '<div><b>W/S</b> drive · <b>A/D</b> steer · <b>Space</b> brake</div><div><b>Mouse</b> look around the cab · <b>Click</b> buttons</div><div><b>P</b> parking brake · <b>1/2/3</b> ELS slow/steady/off · <b>L</b> lights</div><div><b>C</b> cab / chase cam · <b>E</b> get out · <b>M</b> map · <b>Esc</b> menu · <b>F1</b> hide help</div>'
        : g.mode === 'car'
          ? '<div><b>W/S</b> drive · <b>A/D</b> steer · <b>Space</b> brake · <b>E</b> get out</div>'
          : '<div><b>WASD</b> walk · <b>Shift</b> run · <b>Mouse</b> look · <b>Click</b> use · <b>E</b> doors/talk</div><div><b>G</b> put down what you hold · <b>V</b> first person · <b>M</b> map · <b>F1</b> hide help</div>';
    } else help.classList.add('hidden');
  }

  drawMinimap() {
    const g = this.game;
    const ctx = this.miniCtx;
    const W = this.mini.width;
    ctx.fillStyle = '#0e131a';
    ctx.fillRect(0, 0, W, W);
    if (!this.map) return;
    const focus = g.focus();
    const yaw = g.headingYaw();
    const speed = Math.abs(g.vehicle?.speed ?? 0);
    const zoom = clamp(1.3 - speed / 40, 0.55, 1.3) * (1 / MPP) * 1.6; // px per map-px
    const rot = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    ctx.save();
    ctx.translate(W / 2, W / 2 + 30);
    ctx.rotate(rot);
    ctx.scale(zoom, zoom);
    ctx.translate(-toPx(focus.x), -toPx(focus.z));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.map, 0, 0);
    // Route.
    const r = g.nav.route;
    if (r) {
      ctx.strokeStyle = '#38c6ff';
      ctx.lineWidth = 7 / zoom;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const start = Math.max(0, (r.cursor ?? 0));
      ctx.moveTo(toPx(focus.x), toPx(focus.z));
      for (let i = start + 1; i < r.pts.length; i++) ctx.lineTo(toPx(r.pts[i].x), toPx(r.pts[i].z));
      ctx.stroke();
    }
    // Markers: job car, shop, truck (when on foot).
    const mark = (x, z, col, size = 8) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(toPx(x), toPx(z), size / zoom, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2 / zoom; ctx.strokeStyle = '#000'; ctx.stroke();
    };
    const j = g.jobs.job;
    if (j) {
      if (!j.flags.loaded) mark(j.car.curPos.x, j.car.curPos.z, '#ffb000', 7);
      if (j.told) mark(j.shop.drop.x, j.shop.drop.z, '#36d36a', 8);
    } else if (g.jobs.offer) {
      mark(g.jobs.offer.spot.x, g.jobs.offer.spot.z, (performance.now() % 600) < 300 ? '#ffb000' : '#7a5500', 7);
    }
    if (g.mode !== 'truck' && g.truck) mark(g.truck.curPos.x, g.truck.curPos.z, '#ff6a3a', 6);
    ctx.restore();
    // North marker on the rim.
    const na = rot - Math.PI / 2;
    ctx.fillStyle = '#ffb000';
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nr = W / 2 - 12;
    ctx.fillText('N', W / 2 + Math.cos(na) * nr, W / 2 + 30 + Math.sin(na) * nr);
    // Player arrow.
    ctx.save();
    ctx.translate(W / 2, W / 2 + 30);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ----------------------------------------------------------- big map
  openBigMap(on) {
    const scr = $('bigmap');
    scr.classList.toggle('show', on);
    if (!on) return;
    const cv = $('bigmapCanvas');
    const S = Math.min(innerWidth, innerHeight) * 0.92 * (devicePixelRatio || 1);
    cv.width = cv.height = Math.round(S);
    const ctx = cv.getContext('2d');
    const view = this.bigView ||= { cx: 0, cz: 0, span: 1700 };
    const draw = () => {
      const k = S / (view.span / MPP);
      ctx.fillStyle = '#0e131a'; ctx.fillRect(0, 0, S, S);
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.scale(k, k);
      ctx.translate(-toPx(view.cx), -toPx(view.cz));
      ctx.drawImage(this.map, 0, 0);
      const r = this.game.nav.route;
      if (r) {
        ctx.strokeStyle = '#38c6ff'; ctx.lineWidth = 6 / k; ctx.beginPath();
        r.pts.forEach((p, i) => (i ? ctx.lineTo(toPx(p.x), toPx(p.z)) : ctx.moveTo(toPx(p.x), toPx(p.z)))); ctx.stroke();
      }
      ctx.restore();
      const W2 = (x, z) => [S / 2 + (toPx(x) - toPx(view.cx)) * k, S / 2 + (toPx(z) - toPx(view.cz)) * k];
      ctx.font = `600 ${Math.round(12 * (devicePixelRatio || 1))}px sans-serif`;
      ctx.textAlign = 'center';
      for (let i = 0; i < GRID.length; i++) {
        let [x, y] = W2(GRID[i], -495); ctx.fillStyle = '#9fb0c4'; ctx.fillText(NS_NAMES[i], x, y);
        [x, y] = W2(-500, GRID[i]); ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); ctx.fillText(EW_NAMES[i], 0, 0); ctx.restore();
      }
      for (const ic of INTERCHANGES) { const p = interchangeWorld(ic); const [x, y] = W2(p.x, p.z); ctx.fillStyle = '#ffcc55'; ctx.fillText(`EXIT ${ic.exit}`, x, y); }
      for (const s of SHOPS) {
        const [x, y] = W2(s.x, s.z);
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, 7 * (devicePixelRatio || 1), 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText('🔧 ' + s.name, x, y - 12 * (devicePixelRatio || 1));
      }
      const f = this.game.focus();
      const [px, py] = W2(f.x, f.z);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 7 * (devicePixelRatio || 1), 0, 7); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      const j = this.game.jobs.job ?? this.game.jobs.offer;
      if (j) { const [jx, jy] = W2(j.spot.x, j.spot.z); ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(jx, jy, 8 * (devicePixelRatio || 1), 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(16 * (devicePixelRatio || 1))}px sans-serif`;
      ctx.fillText('I-671 SKYVILLE BELTWAY', S / 2, 26 * (devicePixelRatio || 1));
    };
    draw();
    if (!this.bigBound) {
      this.bigBound = true;
      cv.addEventListener('wheel', (e) => { view.span = clamp(view.span * (e.deltaY > 0 ? 1.15 : 0.87), 250, 2000); draw(); });
      let drag = null;
      cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz }; });
      addEventListener('mouseup', () => { drag = null; });
      addEventListener('mousemove', (e) => {
        if (!drag) return;
        const k = cv.clientWidth / view.span;
        view.cx = drag.cx - (e.clientX - drag.x) / k;
        view.cz = drag.cz - (e.clientY - drag.y) / k;
        draw();
      });
      this.redrawBig = draw;
    }
  }

  // ----------------------------------------------------------- popups
  toast(msg, secs = 3.5) {
    const d = document.createElement('div');
    d.className = 't';
    d.textContent = msg;
    this.toastEl.appendChild(d);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
    setTimeout(() => d.remove(), secs * 1000);
  }
  radio(offer, dist) {
    $('radio').classList.remove('hidden');
    $('radioTitle').textContent = offer.title;
    $('radioBody').innerHTML = `${offer.vehicleName} · ${offer.spot.near}<br>${offer.sc.issue}<br>${fmtDist(dist)} away · pays about ${fmtMoney(offer.pay)}`;
  }
  closeRadio() { $('radio').classList.add('hidden'); }
  dialog(name, lines, done) {
    this.dialogState = { name, lines, i: 0, done };
    $('dialog').classList.remove('hidden');
    $('dialogName').textContent = name;
    $('dialogText').textContent = lines[0];
  }
  advanceDialog() {
    const d = this.dialogState;
    if (!d) return false;
    d.i++;
    if (d.i >= d.lines.length) {
      $('dialog').classList.add('hidden');
      this.dialogState = null;
      d.done?.();
    } else $('dialogText').textContent = d.lines[d.i];
    return true;
  }
  fade() {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 650);
  }
}
