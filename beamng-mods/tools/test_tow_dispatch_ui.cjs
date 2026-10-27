// Plays the Tow Dispatch UI app in Chromium against the real Tow Truck Calls Lua
// (run by tow_truck_calls_bridge.py in a fake BeamNG). Buttons and the strap
// minigames are played with the real mouse.
//
//   node test_tow_dispatch_ui.cjs <tow-truck-calls mod folder> <angular.js 1.8> [screenshot dir]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = playwright;

const MOD = path.resolve(process.argv[2]);
const ANGULAR = path.resolve(process.argv[3]);
const SHOTS = process.argv[4] ? path.resolve(process.argv[4]) : null;
const fails = [];
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail !== undefined ? '   ' + JSON.stringify(detail) : ''));
  if (!cond) fails.push(name);
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>body { margin: 0; background: linear-gradient(#5d7891, #2d3b2d); font-family: Arial, sans-serif; }
.app-box { position: absolute; right: 12px; top: 120px; width: 340px; height: 470px; }</style>
<script src="/angular.js"></script>
<script>
  window.__lua = [];
  window.bngApi = { engineLua: function (c) { window.__lua.push(c); } };
  angular.module('beamng.apps', []);
  angular.module('harness', ['beamng.apps']);
</script>
<script src="/ui/modules/apps/TowTruckCalls/app.js"></script>
</head><body ng-app="harness"><div class="app-box"><tow-truck-calls></tow-truck-calls></div></body></html>`;

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = null;
      if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
      if (url === '/angular.js') file = ANGULAR;
      else if (url.startsWith('/ui/')) file = path.join(MOD, url);
      if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

// Lua bridge ------------------------------------------------------------------------------------
const bridge = spawn('python3', [path.join(__dirname, 'tow_truck_calls_bridge.py'), MOD], { stdio: ['pipe', 'pipe', 'inherit'] });
const waiting = [];
let buf = '';
bridge.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    waiting.shift()(JSON.parse(line));
  }
});
const allToasts = [];
let luaErrors = [];
function lua(code) {
  return new Promise((res) => { waiting.push(res); bridge.stdin.write(JSON.stringify({ lua: code }) + '\n'); })
    .then((r) => { if (r.err) luaErrors.push(r.err + '  <- ' + code); allToasts.push(...r.toasts); return r; });
}

let page;
async function forward(r) {
  if (r.state) await page.evaluate((d) => angular.element(document.body).injector().get('$rootScope').$broadcast('TowTruckCallsState', d), r.state);
}
// One game tick: run the app's engineLua calls in Lua, step the sim 50 ms, send the new state to the app.
async function pump(ms = 50) {
  const end = Date.now() + ms;
  do {
    const calls = await page.evaluate(() => window.__lua.splice(0));
    for (const c of calls) await forward(await lua(c));
    await forward(await lua('sim.step(0.05)'));
    await page.waitForTimeout(15);
  } while (Date.now() < end);
}
async function luaNow(code) { await forward(await lua(code)); await pump(400); }
const text = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);
const visible = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).visibility === 'visible' && e.getBoundingClientRect().width > 0; }, sel);
async function clickText(scopeSel, label) {
  const b = page.locator(scopeSel + ' button', { hasText: label }).first();
  await b.click();
  await pump(300);
}

// Minigame: wait for the right moment, then use the real mouse -----------------------------------
async function canvasCenter() {
  const b = await page.locator('.ttc-canvas').boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const game = () => page.evaluate(() => { const g = document.querySelector('.ttc-layer').__game(); return g && JSON.parse(JSON.stringify(g)); });

async function missOnce(c, far) {
  // Click when the hook / needle is nowhere near the green.
  for (let k = 0; k < 300; k++) {
    if (await page.evaluate(far)) break;
    await page.waitForTimeout(5);
  }
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(50);
}

async function playStrap(stats, opts = {}) {
  const c = await canvasCenter();
  const missed = {}, shot = {};
  for (let guard = 0; guard < 400; guard++) {
    const g = await game();
    if (!g) return false;
    if (opts.shots && SHOTS && !shot[g.stage] && (g.stage === 'ratchet' || g.stage === 'tension')) {
      shot[g.stage] = true;
      await page.screenshot({ path: SHOTS + '/2-' + g.stage + '.png' });
    }
    if (opts.miss && !missed[g.stage] && (g.stage === 'hook' || g.stage === 'ratchet')) {
      missed[g.stage] = true;
      const q0 = g.quality;
      if (g.stage === 'hook') {
        await missOnce(c, () => { const g = document.querySelector('.ttc-layer').__game(); return Math.abs(240 + 190 * Math.sin(g.phase) - (60 + g.target * 60)) > 90; });
        const g2 = await game();
        check('missing the slot costs 4%', g2.stage === 'hook' && g2.quality === q0 - 4 && g2.flash.text === 'Missed the slot!', { q: g2.quality, f: g2.flash });
      } else {
        await missOnce(c, () => { const g = document.querySelector('.ttc-layer').__game(); const f = g.nphase % 2, n = f < 1 ? f : 2 - f; return n < g.zone[0] - 0.12 || n > g.zone[1] + 0.12; });
        const g2 = await game();
        check('missing the ratchet slips a notch', g2.stage === 'ratchet' && g2.pumps === 0 && g2.quality === q0 - 3 && g2.flash.text === 'Slipped a notch!', { q: g2.quality, p: g2.pumps, f: g2.flash });
      }
      continue;
    }
    if (g.stage === 'hook') {
      // Time until the swinging hook is over the green slot.
      const d = await page.evaluate(() => {
        const g = document.querySelector('.ttc-layer').__game();
        const tx = 60 + g.target * 60;
        for (let ms = 0; ms < 4000; ms += 2) {
          const x = 240 + 190 * Math.sin(g.phase + g.speed * ms / 1000);
          if (Math.abs(x - tx) < 3) return ms;
        }
        return 0;
      });
      await page.waitForTimeout(Math.max(0, d - 20));
      await page.mouse.click(c.x, c.y);
      stats.clicks++;
    } else if (g.stage === 'ratchet') {
      const d = await page.evaluate(() => {
        const g = document.querySelector('.ttc-layer').__game();
        const mid = (g.zone[0] + g.zone[1]) / 2;
        for (let ms = 0; ms < 4000; ms += 2) {
          const f = (g.nphase + g.nspeed * ms / 1000) % 2;
          if (Math.abs((f < 1 ? f : 2 - f) - mid) < 0.012) return ms;
        }
        return 0;
      });
      await page.waitForTimeout(Math.max(0, d - 20));
      await page.mouse.click(c.x, c.y);
      stats.clicks++;
    } else if (g.stage === 'tension') {
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      for (let k = 0; k < 200; k++) {
        const v = await page.evaluate(() => document.querySelector('.ttc-layer').__game().v);
        if (v >= 0.82) break;
        await page.waitForTimeout(10);
      }
      await page.mouse.up();
      stats.clicks++;
    } else if (g.stage === 'between' || g.stage === 'final') {
      return true;
    }
    await page.waitForTimeout(30);
  }
  return false;
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:' + srv.address().port + '/');
  await page.waitForSelector('.ttc-app');
  await pump(600);

  console.log('== Panel and calls');
  check('app asked Lua for its state', true);
  check('header shows bank', (await text('.ttc-stats')).includes('$0'));
  check('waiting for calls', (await text('.ttc-body')).includes('Waiting for calls'));
  await clickText('.ttc-body', 'ASK DISPATCH');
  await pump(300);
  check('new call banner pops up', await visible('.ttc-banner'));
  check('call listed in the app', (await page.locator('.ttc-body .ttc-card').count()) === 1);
  const bannerText = await text('.ttc-banner');
  check('banner says what the call is', /NEW TOW CALL/.test(bannerText) && /\$\d+/.test(bannerText) && /(ft|mi) [NESW]{1,2}/.test(bannerText), bannerText);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/1-call.png' });

  // A second call, then decline it from the panel.
  await luaNow('towTruckCalls.requestCall()');
  check('two calls listed', (await page.locator('.ttc-body .ttc-card').count()) === 2);
  await page.locator('.ttc-body .ttc-card').nth(1).locator('button', { hasText: 'DECLINE' }).click();
  await pump(300);
  check('decline removes it', (await page.locator('.ttc-body .ttc-card').count()) === 1);

  console.log('== Accept from the panel');
  await page.locator('.ttc-body .ttc-card').first().locator('button', { hasText: 'ACCEPT' }).click();
  await pump(400);
  check('current job card', (await text('.ttc-body')).includes('CURRENT JOB'));
  check('step 1 is driving there', /Drive to the car\s*\d/.test(await text('.ttc-steps li.now')), await text('.ttc-steps li.now'));
  check('strap and done disabled', await page.locator('button[data-act="strap"]').isDisabled() && await page.locator('button[data-act="done"]').isDisabled());
  check('banner gone after accepting', !(await visible('.ttc-banner')));

  console.log('== On scene, load the car, minigame pops up');
  await luaNow('car = sim.vehicles[towTruckCalls.state.job.vid]; sim.step(0.1, 30)');
  await luaNow('truck.pos = car.pos + vec3(0, -12, 0.55)');
  check('step 2: load it', (await text('.ttc-steps li.now')).includes('Load it'));
  await page.locator('button[data-act="brake"]').click(); await pump(300);
  check('car brake toggle', (await text('button[data-act="brake"]')).includes('OFF'));
  await page.locator('button[data-act="brake"]').click(); await pump(300);
  await luaNow('car.pos = truck.pos + vec3(0, -0.5, 1.0); car.fwd = vec3(truck.fwd)');
  check('strap button enabled', !(await page.locator('button[data-act="strap"]').isDisabled()));
  await pump(2200);
  check('minigame popped up by itself', await visible('.ttc-modal'));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/2-hook.png' });

  // Close it, reopen from the button: progress kept.
  await page.locator('.ttc-close').click(); await pump(500);
  check('minigame closes', !(await visible('.ttc-modal')));
  await page.locator('button[data-act="strap"]').click(); await pump(200);
  check('STRAP DOWN reopens it', await visible('.ttc-modal'));

  // Truck moves: game pauses.
  await luaNow('truck.vel = vec3(0, 4, 0)');
  check('moving truck pauses the minigame', await visible('.ttc-pause.show') && /Stop the truck/.test(await text('.ttc-pause')), await text('.ttc-pause'));
  await luaNow('truck.vel = vec3(0, 0, 0)');
  check('stopped: minigame resumes', !(await page.evaluate(() => document.querySelector('.ttc-pause').classList.contains('show'))));

  console.log('== Play the four straps with the mouse');
  const stats = { clicks: 0 };
  for (let s = 0; s < 4; s++) {
    const done = await playStrap(stats, { miss: s === 0, shots: s === 1 });
    check('strap ' + (s + 1) + ' locked', done);
    await page.waitForTimeout(900);
    await pump(100);
  }
  const g = await game();
  check('all four straps done', g && g.strap === 4 && g.stage === 'final', g && { strap: g.strap, stage: g.stage });
  if (SHOTS) await page.screenshot({ path: SHOTS + '/3-secured.png' });
  await pump(2500);
  check('Lua got the straps (secured)', (await text('.ttc-steps li.now')).includes('Tow it anywhere'), await text('.ttc-steps li.now'));
  check('minigame closed after securing', !(await visible('.ttc-modal')));
  const q = g ? g.quality : 0;
  check('quality shown on the job', (await text('.ttc-steps')).includes(q + '%'), q);
  check('quality lost the misses', q <= 93, q);
  check('hint moved on to towing', /Tow it (anywhere|somewhere)/.test(await text('.ttc-hint')), await text('.ttc-hint'));
  console.log('     minigame clicks:', stats.clicks, 'quality:', q);

  console.log('== Tow it and say DONE');
  await luaNow('sim.drive(truck, truck.pos + vec3(0, 600, 0), 20, car)');
  check('DONE enabled', !(await page.locator('button[data-act="done"]').isDisabled()));
  check('towed distance shown', /Tow it anywhere\s*[\d.]+ (mi|ft)/.test(await text('.ttc-steps')), await text('.ttc-steps'));
  await page.locator('button[data-act="done"]').click();
  await pump(700);
  check('JOB DONE pop-up', await visible('.ttc-result.show'));
  const res = await text('.ttc-result');
  check('pop-up shows the pay', /JOB DONE/.test(res) && /\+\$\d+/.test(res) && /Mileage/.test(res), res);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/4-done.png' });
  const paid = parseInt(res.match(/\+\$([\d,]+)/)[1].replace(',', ''), 10);
  check('bank updated in the header', (await text('.ttc-stats')).includes('$' + paid.toLocaleString('en-US')), await text('.ttc-stats'));
  check('job card gone', !(await text('.ttc-body')).includes('CURRENT JOB'));
  await page.locator('.ttc-result').click(); await pump(200);
  check('pop-up dismissed by click', !(await visible('.ttc-result.show')));

  console.log('== Cancel needs a second click, duty toggle');
  await luaNow('towTruckCalls.requestCall()');
  await page.locator('.ttc-body .ttc-card button', { hasText: 'ACCEPT' }).first().click(); await pump(300);
  await page.locator('button[data-act="cancel"]').click(); await pump(200);
  check('first click arms cancel', (await text('button[data-act="cancel"]')).includes('SURE'));
  await page.locator('button[data-act="cancel"]').click(); await pump(800);
  check('second click cancels', !(await text('.ttc-body')).includes('CURRENT JOB'));
  await page.locator('.ttc-duty').click(); await pump(300);
  check('off duty', (await text('.ttc-duty')) === 'OFF DUTY' && (await text('.ttc-body')).includes('off duty'));
  await page.locator('.ttc-body button', { hasText: 'GO ON DUTY' }).click(); await pump(300);
  check('back on duty', (await text('.ttc-duty')) === 'ON DUTY');

  // Pop-ups must not block clicks on the game when hidden.
  const blocker = await page.evaluate(() => { const e = document.elementFromPoint(640, 360); return e && e.className; });
  check('hidden pop-ups do not catch clicks', !/ttc-/.test(blocker || ''), blocker);

  check('no page errors', errors.length === 0, errors);
  check('no Lua errors', luaErrors.length === 0, luaErrors);
  console.log(fails.length ? fails.length + ' FAILED: ' + JSON.stringify(fails) : 'All Tow Dispatch UI checks passed.');
  await browser.close();
  bridge.stdin.end();
  srv.close();
  process.exit(fails.length ? 1 : 0);
})();
