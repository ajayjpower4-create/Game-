// Tests the drag-in-the-vehicle-zip flow of LiveryDesigner.html in Chromium.
//   node test_vehicle_zip.cjs <LiveryDesigner.html> <folder with cool_hauler.zip, pickup.zip, logo.png> <output folder>
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const [pagePath, assetsDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(outDir, { recursive: true });
const A = (f) => path.join(assetsDir, f);
const failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''));
  if (!ok) failures.push(name);
}
function py(code, ...args) { return JSON.parse(execFileSync('python3', ['-I', '-c', code, ...args]).toString()); }

(async () => {
  const browser = await playwright.chromium.launch();
  const errors = [];
  async function freshPage() {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + pagePath);
    await page.waitForTimeout(300);
    return page;
  }
  // Drag a file from disk and drop it on the app, like a user would.
  async function dropFile(page, file) {
    const b64 = fs.readFileSync(file).toString('base64');
    const dt = await page.evaluateHandle(({ b64, name }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const d = new DataTransfer();
      d.items.add(new File([bin], name, { type: name.endsWith('.zip') ? 'application/zip' : 'image/png' }));
      return d;
    }, { b64, name: path.basename(file) });
    await page.dispatchEvent('#canvaswrap', 'dragenter', { dataTransfer: dt });
    await page.dispatchEvent('#canvaswrap', 'dragover', { dataTransfer: dt });
    const overlay = await page.isVisible('#dropOverlay');
    await page.dispatchEvent('#canvaswrap', 'drop', { dataTransfer: dt });
    return overlay;
  }
  const askVisible = (page) => page.isVisible('#askModal');
  async function waitFor(page, fn, arg, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); }
    return false;
  }
  async function make(page, savePath) {
    await page.click('#btnExportTop');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnMake')]);
    await dl.saveAs(savePath);
    await page.waitForTimeout(200);
    const done = (await askVisible(page)) && /ready/.test(await page.textContent('#askTitle'));
    await page.click('#askBtns [data-i="0"]');
    return { name: dl.suggestedFilename(), done };
  }
  const state = (page) => page.evaluate(() => {
    const L = window.LiveryDesigner, P = L.project, V = L.vehicle, s = P.sheets[0];
    const t = s.template.assetId && L.assets.get(s.template.assetId);
    return {
      folder: P.vehicle.folder, slot: P.vehicle.slotType, name: V && V.niceName, kind: V && V.kind, mat: s.materials, w: s.width,
      tpl: t ? { zipRel: t.zipRel, hasData: !!t.url } : null, mode: L.makeMode(), layers: s.layers.map((l) => l.text || l.type),
    };
  });

  // ---------- 1. modded truck: drop the vehicle zip
  let page = await freshPage();
  check('welcome screen asks for the vehicle file', await page.isVisible('#welcome') && /Drag your vehicle/.test(await page.textContent('#welcome')));
  await page.screenshot({ path: path.join(outDir, 'v1-welcome.png') });
  const overlay = await dropFile(page, A('cool_hauler.zip'));
  check('dragging a file over the app shows the drop overlay', overlay);
  await waitFor(page, () => !!window.LiveryDesigner.vehicle);
  await page.waitForTimeout(300);
  let st = await state(page);
  check('vehicle is found inside the zip', st.folder === 'testtruck' && st.name === 'Testco Hauler', st);
  check('paint material is the one its skins use', JSON.stringify(st.mat) === '["testtruck_main"]', st.mat);
  check('slot type is read from its existing skins', st.slot === 'testtruck_skin', st.slot);
  check('UV template is picked from the zip', st.tpl && st.tpl.zipRel === 'vehicles/testtruck/testtruck_skin_UVs.png' && st.tpl.hasData, st.tpl);
  check('sheet takes the template size', st.w === 1024, st.w);
  check('modded vehicle defaults to putting the livery inside its file', st.mode === 'inside', st.mode);
  check('welcome screen goes away', !(await page.isVisible('#welcome')));
  check('top bar shows the vehicle', /Testco Hauler/.test(await page.textContent('#vehChip')));
  const picks = await page.$$eval('#tplPick option', (o) => o.map((x) => x.textContent));
  check('other template pictures from the vehicle can be picked', picks.includes('testtruck_main_b.color.png') && picks.includes('skin_fire/testtruck_skin_fire.color.dds'), picks);

  // design something on both sides
  await page.evaluate(() => {
    const L = window.LiveryDesigner;
    const t = L.makeText(330, 250, 'HAULER ONE');
    L.addLayer(t);
    L.mirrorSelected();
  });
  await page.click('#btnExportTop');
  await page.fill('#exName', 'Hauler One');
  await page.dispatchEvent('#exName', 'change');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'v2-export-inside.png') });
  const made1 = path.join(outDir, 'made1_cool_hauler.zip');
  const r1 = await make(page, made1);
  check('the new file keeps the vehicle file\'s name', r1.name === 'cool_hauler.zip', r1.name);
  check('the app says what to do next', r1.done);
  const cmpCode = `
import zipfile, json, sys
a = zipfile.ZipFile(sys.argv[1]); b = zipfile.ZipFile(sys.argv[2])
bad = b.testzip()
orig = a.namelist(); new = b.namelist()
same = all(a.read(n) == b.read(n) for n in orig)
added = [n for n in new if n not in orig]
d = "vehicles/testtruck/hauler_one/"
jb = json.loads(b.read(d + "testtruck_skin_hauler_one.jbeam"))["testtruck_skin_hauler_one"]
mt = json.loads(b.read(d + "skin.materials.json"))["testtruck_main.skin.hauler_one"]
lv = json.loads(b.read(d + "hauler_one.livery"))
print(json.dumps({"crcOk": bad is None, "allOriginal": set(orig) <= set(new) and same, "added": added, "dupes": len(new) - len(set(new)),
  "slot": jb["slotType"], "skin": jb["globalSkin"], "base": mt["Stages"][0]["baseColorMap"], "normal": mt["Stages"][0]["normalMap"],
  "tplInLivery": any(v for v in lv["assets"].values()), "zipAssets": list(lv["zipAssets"].values())}))`;
  let Z = py(cmpCode, A('cool_hauler.zip'), made1);
  check('every file in the new zip passes its checksum', Z.crcOk);
  check('everything from the original vehicle is still there, byte for byte', Z.allOriginal);
  check('the livery is added in the vehicle\'s folder', JSON.stringify(Z.added.sort()) === JSON.stringify([
    'vehicles/testtruck/hauler_one/hauler_one.livery', 'vehicles/testtruck/hauler_one/skin.materials.json',
    'vehicles/testtruck/hauler_one/testtruck_skin_hauler_one.color.png', 'vehicles/testtruck/hauler_one/testtruck_skin_hauler_one.jbeam']), Z.added);
  check('the livery uses the vehicle\'s own slot type', Z.slot === 'testtruck_skin' && Z.skin === 'hauler_one', Z);
  check('material points at the livery picture', Z.base === '/vehicles/testtruck/hauler_one/testtruck_skin_hauler_one.color.png', Z.base);
  check('relative texture paths in the vehicle material still work', Z.normal === '/vehicles/testtruck/testtruck_main_nm.normal.png', Z.normal);
  check('the saved design does not store the vehicle\'s template again', !Z.tplInLivery && Z.zipAssets.includes('vehicles/testtruck/testtruck_skin_UVs.png'), Z);

  // ---------- 2. drag the made file back in: the design comes back
  await page.waitForTimeout(1300);
  page = await freshPage();
  await dropFile(page, made1);
  await waitFor(page, () => !document.querySelector('#askModal').classList.contains('hidden'));
  const askTitle = await page.textContent('#askTitle');
  const askBtns = await page.$$eval('#askBtns button', (b) => b.map((x) => x.textContent));
  check('dropping the made file offers to keep editing', /Keep editing/.test(askTitle) && askBtns[0] === 'Edit "Hauler One"' && askBtns.includes('Make a new livery'), [askTitle, askBtns]);
  await page.click('#askBtns [data-i="0"]');
  await waitFor(page, () => !!window.LiveryDesigner.vehicle);
  await page.waitForTimeout(300);
  st = await state(page);
  check('the design comes back with both sides', JSON.stringify(st.layers) === '["HAULER ONE","HAULER ONE"]', st.layers);
  check('the template comes back from the vehicle zip', st.tpl && st.tpl.hasData, st.tpl);
  // change the text and make it again
  await page.evaluate(() => {
    const L = window.LiveryDesigner, P = L.project;
    const t = P.sheets[0].layers[0];
    L.select(t.id);
    t.text = 'HAULER TWO';
    L.syncTwin(t);
    L.pushHistory();
    L.refreshAll();
  });
  const made2 = path.join(outDir, 'made2_cool_hauler.zip');
  const r2 = await make(page, made2);
  Z = py(cmpCode, A('cool_hauler.zip'), made2);
  check('making it again replaces the livery instead of adding a second copy', Z.crcOk && Z.allOriginal && Z.dupes === 0 && Z.added.length === 4, Z);
  const txt = py(`
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1]); lv = json.loads(z.read("vehicles/testtruck/hauler_one/hauler_one.livery"))
print(json.dumps([l.get("text") for l in lv["sheets"][0]["layers"]]))`, made2);
  check('the new version has the changed text', JSON.stringify(txt) === '["HAULER TWO","HAULER TWO"]', txt);
  void r2;

  // ---------- 3. stock vehicle: separate livery file
  page = await freshPage();
  await dropFile(page, A('pickup.zip'));
  await waitFor(page, () => !!window.LiveryDesigner.vehicle);
  await page.waitForTimeout(300);
  st = await state(page);
  check('stock vehicle is recognized', st.kind === 'stock' && st.name === 'Gavril D-Series', st);
  check('stock vehicle defaults to a separate livery file', st.mode === 'separate', st.mode);
  await page.click('#btnExportTop');
  check('putting it inside a stock vehicle is not offered', await page.isDisabled('#mkInside'));
  await page.evaluate(() => { const L = window.LiveryDesigner; L.addLayer(L.makeText(300, 250, 'STOCK FUN')); });
  await page.fill('#exName', 'Stock Fun');
  await page.dispatchEvent('#exName', 'change');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'v3-export-stock.png') });
  const made3 = path.join(outDir, 'stock_livery.zip');
  const r3 = await make(page, made3);
  check('separate livery file is named after the livery', r3.name === 'stock_fun_pickup_livery.zip', r3.name);
  Z = py(`
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1])
print(json.dumps({"ok": z.testzip() is None, "names": sorted(z.namelist())}))`, made3);
  check('separate livery file has the skin, the design and a read-me', Z.ok && JSON.stringify(Z.names) === JSON.stringify([
    'INSTALL - READ ME.txt', 'vehicles/pickup/stock_fun/pickup_skin_stock_fun.color.png', 'vehicles/pickup/stock_fun/pickup_skin_stock_fun.jbeam',
    'vehicles/pickup/stock_fun/skin.materials.json', 'vehicles/pickup/stock_fun/stock_fun.livery']), Z.names);

  // ---------- 4. edit the separate livery file later, then bring the template back with the vehicle zip
  page = await freshPage();
  await dropFile(page, made3);
  await waitFor(page, () => !document.querySelector('#askModal').classList.contains('hidden'));
  const btns4 = await page.$$eval('#askBtns button', (b) => b.map((x) => x.textContent));
  check('a livery-only file offers just to edit it', JSON.stringify(btns4) === '["Edit \\"Stock Fun\\""]', btns4);
  await page.click('#askBtns [data-i="0"]');
  await page.waitForTimeout(500);
  st = await state(page);
  const msg = await page.textContent('#toast');
  check('the design comes back from the livery file', JSON.stringify(st.layers) === '["STOCK FUN"]' && st.tpl && !st.tpl.hasData, st);
  check('it asks for the vehicle zip to bring the template back', /Drag the vehicle/.test(msg), msg);
  await dropFile(page, A('pickup.zip'));
  await waitFor(page, () => !document.querySelector('#askModal').classList.contains('hidden'));
  const t5 = await page.textContent('#askTitle');
  check('dropping a vehicle with a design open asks what to do', /Use this vehicle/.test(t5), t5);
  await page.click('#askBtns [data-i="0"]');
  await waitFor(page, () => !!window.LiveryDesigner.vehicle);
  await page.waitForTimeout(300);
  st = await state(page);
  check('the design is kept and the template is back', JSON.stringify(st.layers) === '["STOCK FUN"]' && st.tpl && st.tpl.hasData, st);

  // ---------- 5. a picture dropped on an empty app
  page = await freshPage();
  await dropFile(page, A('pickup_skin_UVs.png'));
  await waitFor(page, () => !document.querySelector('#askModal').classList.contains('hidden'));
  check('a picture on an empty app asks if it is the template', /What is this picture/.test(await page.textContent('#askTitle')));
  await page.click('#askBtns [data-i="0"]');
  await page.waitForTimeout(500);
  st = await state(page);
  check('the picture becomes the template', st.tpl && st.tpl.hasData && st.w === 1024, st);

  // ---------- 6. autosave brings back the design and the vehicle's template after closing the app
  page = await freshPage();
  await dropFile(page, A('cool_hauler.zip'));
  await waitFor(page, () => !!window.LiveryDesigner.vehicle);
  await page.evaluate(() => { const L = window.LiveryDesigner; L.addLayer(L.makeText(300, 250, 'SAVED')); });
  await page.waitForTimeout(1600);
  await page.reload();
  await page.waitForTimeout(600);
  check('reopening offers to restore', await page.isVisible('#restorebar'));
  await page.click('#btnRestore');
  await page.waitForTimeout(800);
  st = await state(page);
  const msg6 = await page.textContent('#toast');
  check('restored design has its layers and template picture', JSON.stringify(st.layers) === '["SAVED"]' && st.tpl && st.tpl.hasData, st);
  check('it reminds you to drag the vehicle file in again', /cool_hauler\.zip/.test(msg6), msg6);

  // ---------- 7. a bus whose zip has big menu pictures (the bug from the photo)
  page = await freshPage();
  await dropFile(page, A('bus_bc7.zip'));
  await waitFor(page, () => !!window.LiveryDesigner.vehicle);
  await page.waitForTimeout(400);
  st = await state(page);
  check('menu pictures are never picked; the BC7 body texture is', st.tpl && st.tpl.zipRel === 'vehicles/heavystar/heavystar_body_d.dds' && st.tpl.hasData, st.tpl);
  check('the sheet is the texture\'s size, not the menu picture\'s', st.w === 1024, st.w);
  const opts7 = await page.$$eval('#tplQuick option', (o) => o.map((x) => x.textContent));
  check('the Template list above the canvas marks menu pictures', opts7.includes('default.jpg (menu picture)') && opts7.includes('pe_series.jpg (menu picture)'), opts7);
  const msg7 = await page.textContent('#toast');
  check('the app says which template it used', /Template: heavystar_body_d\.dds/.test(msg7), msg7);
  const px7 = await page.evaluate(async () => {
    const L = window.LiveryDesigner, s = L.project.sheets[0];
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = L.assets.get(s.template.assetId).url; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return [Array.from(x.getImageData(60, 120, 1, 1).data), Array.from(x.getImageData(500, 500, 1, 1).data)];
  });
  check('the BC7 texture decodes correctly', px7[0][0] < 90 && px7[1][0] > 200, px7);
  await page.screenshot({ path: path.join(outDir, 'v7-bus-bc7.png') });

  page = await freshPage();
  await dropFile(page, A('bus_model.zip'));
  await waitFor(page, () => !!window.LiveryDesigner.vehicle && !!window.LiveryDesigner.project.sheets[0].template.assetId, null, 15000);
  await page.waitForTimeout(500);
  st = await state(page);
  check('a blank texture is skipped and the template is drawn from the 3D model', st.tpl && st.tpl.zipRel === 'uv:heavystar_body@1024x1024' && st.tpl.hasData, st.tpl);
  const uvpx = await page.evaluate(async () => {
    const L = window.LiveryDesigner, s = L.project.sheets[0];
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = L.assets.get(s.template.assetId).url; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const at = (u, v) => Array.from(x.getImageData(Math.round(u * img.width), Math.round(v * img.height), 1, 1).data).slice(0, 3);
    return { size: [img.width, img.height], top: at(0.3, 0.2), diagonal: at(0.5, 0.25), tiled: at(0.5, 0.75), glass: at(0.5, 0.5), corner: at(0.03, 0.03), edge: at(0.1, 0.25) };
  });
  const gray = (p) => p[0] > 200 && p[0] < 245, white = (p) => p.every((v) => v > 250), dark = (p) => p[0] < 150;
  check('painted panels show up in the right place (V flipped like the texture)', gray(uvpx.top), uvpx);
  check('tiled UVs fold back onto the texture', gray(uvpx.tiled), uvpx);
  check('parts with other materials (glass) are left out', white(uvpx.glass) && white(uvpx.corner), uvpx);
  check('panel outlines are drawn', dark(uvpx.edge), uvpx);
  check('mesh lines inside a panel are faint, not dark', uvpx.diagonal[0] > 170, uvpx);
  await page.screenshot({ path: path.join(outDir, 'v8-bus-model.png') });
  // the drawn template is not stored in the mod; it is drawn again from the zip when reopened
  await page.evaluate(() => { const L = window.LiveryDesigner; L.addLayer(L.makeText(400, 250, 'BUS')); });
  await page.click('#btnExportTop');
  const made9 = path.join(outDir, 'made_bus.zip');
  await page.click('input[value=inside]');
  const r9 = await make(page, made9);
  const lv9 = py(`
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1])
n = [x for x in z.namelist() if x.endswith(".livery")][0]
d = json.loads(z.read(n))
print(json.dumps({"zipAssets": list(d["zipAssets"].values()), "stored": [k for k, v in d["assets"].items() if v]}))`, made9);
  check('the drawn template is not stored in the mod file', JSON.stringify(lv9.zipAssets) === '["uv:heavystar_body@1024x1024"]' && lv9.stored.length === 0, lv9);
  page = await freshPage();
  await dropFile(page, made9);
  await waitFor(page, () => !document.querySelector('#askModal').classList.contains('hidden'));
  await page.click('#askBtns [data-i="0"]');
  await waitFor(page, () => !!window.LiveryDesigner.vehicle, null, 15000);
  await page.waitForTimeout(500);
  st = await state(page);
  check('reopening the bus draws its template again', st.tpl && st.tpl.hasData && JSON.stringify(st.layers) === '["BUS"]', st);
  void r9;

  check('no errors at any point', errors.length === 0, errors);
  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILED: ' + failures.join(' | ') : '\nALL PASSED');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
