// Tests "Change words already on the livery" in LiveryDesigner.html with Chromium.
//   node test_change_words.cjs <LiveryDesigner.html> <folder with delivery_van.zip, delivery_boxes.json> <output folder>
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const [pagePath, assetsDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(outDir, { recursive: true });
const A = (f) => path.join(assetsDir, f);
const boxes = JSON.parse(fs.readFileSync(A('delivery_boxes.json'), 'utf8'));
const failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''));
  if (!ok) failures.push(name);
}
const near = (hex, rgb, tol) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return v.every((x, i) => Math.abs(x - rgb[i]) <= tol); };

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto('file://' + pagePath);
  await page.waitForTimeout(300);
  console.log('page with the word reader opened in ' + (Date.now() - t0) + ' ms');
  check('the word reader is built into the page', await page.evaluate(() => window.LiveryDesigner.ocr.available()));

  // drop the delivery van
  const b64 = fs.readFileSync(A('delivery_van.zip')).toString('base64');
  const dt = await page.evaluateHandle((b) => {
    const bin = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
    const d = new DataTransfer();
    d.items.add(new File([bin], 'delivery_van.zip', { type: 'application/zip' }));
    return d;
  }, b64);
  await page.dispatchEvent('#canvaswrap', 'drop', { dataTransfer: dt });
  await page.waitForFunction(() => !!window.LiveryDesigner.vehicle && !!window.LiveryDesigner.project.sheets[0].template.assetId, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const tpl = await page.evaluate(() => { const L = window.LiveryDesigner; const s = L.project.sheets[0]; return { rel: L.assets.get(s.template.assetId).zipRel, mode: s.template.mode, mats: s.materials }; });
  check('the existing delivery livery is picked as the template', tpl.rel === 'vehicles/deliveryvan/skin_speedy/deliveryvan_skin_speedy.color.png', tpl);

  async function scr(x, y) {
    const b = await page.locator('#view').boundingBox();
    const vp = await page.evaluate(() => { const v = window.LiveryDesigner.state.vps[0]; return { ox: v.ox, oy: v.oy, s: v.scale }; });
    return { x: b.x + vp.ox + x * vp.s, y: b.y + vp.oy + y * vp.s };
  }
  async function dragBox(bb, pad) {
    await page.click('#tools [data-tool=retext]');
    const a = await scr(bb[0] - pad, bb[1] - pad), b = await scr(bb[2] + pad, bb[3] + pad);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6);
    await page.mouse.up();
  }
  const layers = () => page.evaluate(() => window.LiveryDesigner.project.sheets[0].layers.map((l) => ({
    id: l.id, type: l.type, name: l.name, text: l.text, font: l.font, bold: l.bold, size: l.size, sx: l.sx, x: l.x, y: l.y,
    flipX: l.flipX, fill: l.fill && l.fill.color, outline: l.outline && l.outline.width ? l.outline : null, visible: l.visible })));

  // ---------- 1. plain white words
  await dragBox(boxes.main, 14);
  await page.waitForSelector('#askModal:not(.hidden)', { timeout: 5000 });
  const askT = await page.textContent('#askTitle');
  check('it asks to make the picture the base of the livery', /Change the words/.test(askT), askT);
  const t1 = Date.now();
  await page.click('#askBtns [data-i="0"]');
  await page.waitForFunction(() => window.LiveryDesigner.project.sheets[0].layers.some((l) => l.type === 'text'), null, { timeout: 60000 });
  console.log('first box (starts the word reader) took ' + (Date.now() - t1) + ' ms');
  let L = await layers();
  let text = L.find((l) => l.type === 'text');
  const cover = L.find((l) => l.type === 'image');
  check('the old words are read', text && text.text === 'SPEEDY DELIVERY', text && text.text);
  check('the new text has the same color', text && near(text.fill, [255, 255, 255], 30), text && text.fill);
  check('a bold font is picked for bold words', text && (text.bold || text.font === 'Arial Black'), text && [text.font, text.bold]);
  check('the old words are covered by an erase layer', cover && /Erased: SPEEDY DELIVERY/.test(cover.name), cover && cover.name);
  const st = await page.evaluate(() => { const s = window.LiveryDesigner.project.sheets[0]; return { mode: s.template.mode, mats: s.materials }; });
  check('the picture becomes the base and its material is used', st.mode === 'background' && JSON.stringify(st.mats) === '["deliveryvan_main"]', st);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  check('the Text box is ready for the new words', focused === 'propText', focused);

  // where the new text's ink sits vs. where the old words were
  const measure = (bb, hideIds) => page.evaluate(({ bb, hideIds }) => {
    const L = window.LiveryDesigner, s = L.project.sheets[0];
    const saved = s.layers.map((l) => l.visible);
    s.layers.forEach((l) => { if (hideIds.includes(l.id)) l.visible = false; });
    const pad = 30, w = bb[2] - bb[0] + pad * 2, h = bb[3] - bb[1] + pad * 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.translate(-(bb[0] - pad), -(bb[1] - pad));
    window.LiveryDesigner.drawSheetForTest(x, s);
    s.layers.forEach((l, i) => { l.visible = saved[i]; });
    const d = x.getImageData(0, 0, w, h).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, white = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) { white++; x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
    }
    return { white, box: white ? [x0 + bb[0] - pad, y0 + bb[1] - pad, x1 + bb[0] - pad + 1, y1 + bb[1] - pad + 1] : null };
  }, { bb, hideIds });
  const erased = await measure(boxes.main, [text.id]);
  check('with the new text hidden, the old words are gone', erased.white < 30, erased);
  const redrawn = await measure(boxes.main, []);
  const diff = redrawn.box ? redrawn.box.map((v, i) => Math.abs(v - boxes.main[i])) : null;
  check('the new text sits where the old words were, at the same size', diff && Math.max(...diff) <= 8, { old: boxes.main, now: redrawn.box });

  // change the words
  await page.fill('#propText', 'FAST FOOD');
  await page.dispatchEvent('#propText', 'change');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'w1-changed.png') });

  // ---------- 2. words stored backwards (far side of the van)
  await dragBox(boxes.mirrored, 14);
  await page.waitForFunction((n) => window.LiveryDesigner.project.sheets[0].layers.filter((l) => l.type === 'text').length > n, 1, { timeout: 60000 });
  L = await layers();
  const back = L.filter((l) => l.type === 'text')[1];
  check('backwards words are read', back && back.text === 'SPEEDY DELIVERY', back && back.text);
  check('backwards words stay backwards (so they read right on the van)', back && back.flipX === true, back && back.flipX);
  const redrawnBack = await measure(boxes.mirrored, []);
  const diffBack = redrawnBack.box ? redrawnBack.box.map((v, i) => Math.abs(v - boxes.mirrored[i])) : null;
  check('the backwards text lines up with the old words', diffBack && Math.max(...diffBack) <= 8, { old: boxes.mirrored, now: redrawnBack.box });

  // ---------- 3. outlined words on a stripe
  await dragBox(boxes.phone, 10);
  await page.waitForFunction((n) => window.LiveryDesigner.project.sheets[0].layers.filter((l) => l.type === 'text').length > n, 2, { timeout: 60000 });
  L = await layers();
  const phone = L.filter((l) => l.type === 'text')[2];
  check('outlined words are read', phone && phone.text === 'CALL 555-0199', phone && phone.text);
  check('the fill color is kept (yellow)', phone && near(phone.fill, [255, 220, 0], 40), phone && phone.fill);
  check('the outline is kept (black)', phone && phone.outline && near(phone.outline.color, [0, 0, 0], 50) && phone.outline.width >= 2 && phone.outline.width <= 6, phone && phone.outline);
  await page.screenshot({ path: path.join(outDir, 'w2-all.png') });

  // ---------- 4. undo takes the change back in one step
  const before = (await layers()).length;
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  const after = (await layers()).length;
  check('one undo removes the erase layer and the text together', after === before - 2, [before, after]);
  await page.keyboard.press('Control+y');

  // ---------- 5. make the mod file: the livery keeps everything else from the original picture
  await page.click('#btnExportTop');
  await page.fill('#exName', 'Fast Food');
  await page.dispatchEvent('#exName', 'change');
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnMake')]);
  const made = path.join(outDir, dl.suggestedFilename());
  await dl.saveAs(made);
  await page.click('#askBtns [data-i="0"]');
  const res = JSON.parse(execFileSync('python3', ['-I', '-c', `
import zipfile, io, json, sys
from PIL import Image
z = zipfile.ZipFile(sys.argv[1])
d = "vehicles/deliveryvan/fast_food/"
im = Image.open(io.BytesIO(z.read(d + "deliveryvan_skin_fast_food.color.png"))).convert("RGB")
orig = Image.open(sys.argv[2]).convert("RGB")
mat = json.loads(z.read(d + "skin.materials.json"))
same_far = sum(1 for x in range(0, 1024, 16) for y in range(470, 550, 8) if im.getpixel((x, y)) == orig.getpixel((x, y)))
print(json.dumps({"size": im.size, "untouched_area_same": same_far, "stripe": im.getpixel((100, 380)), "panel": im.getpixel((60, 100)),
  "mats": list(mat.keys())}))`, made, A('delivery_skin.png')]).toString());
  check('the made livery keeps the original picture everywhere else', res.untouched_area_same === 640 && JSON.stringify(res.stripe) === '[200,20,30]', res);
  check('the made livery replaces the van\'s paint material', JSON.stringify(res.mats) === '["deliveryvan_main.skin.fast_food"]', res.mats);

  check('no errors at any point', errors.length === 0, errors);
  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILED: ' + failures.join(' | ') : '\nALL PASSED');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
