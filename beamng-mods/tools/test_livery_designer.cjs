// Drives LiveryDesigner.html in Chromium like a user would and checks the result.
//   node test_livery_designer.cjs <LiveryDesigner.html> <test assets folder> <output folder>
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const [page_, assetsDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(outDir, { recursive: true });
const A = (f) => path.join(assetsDir, f);
const failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''));
  if (!ok) failures.push(name);
}

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + page_);
  await page.waitForTimeout(300);

  const LD = (fn, arg) => page.evaluate(fn, arg);
  const proj = () => LD(() => JSON.parse(JSON.stringify(window.LiveryDesigner.project)));
  async function choose(selector, file) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(selector)]);
    await fc.setFiles(file);
    await page.waitForTimeout(400);
  }
  async function canvasBox() { return page.locator('#view').boundingBox(); }
  // sheet pixel -> page pixel for the first viewport
  async function scr(x, y, vpIndex = 0) {
    const b = await canvasBox();
    const vp = await LD((i) => { const v = window.LiveryDesigner.state.vps[i]; return { ox: v.ox, oy: v.oy, s: v.scale }; }, vpIndex);
    return { x: b.x + vp.ox + x * vp.s, y: b.y + vp.oy + y * vp.s };
  }
  async function drag(a, b, opts = {}) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
    await page.mouse.up();
    await page.waitForTimeout(80);
  }

  check('page loads without errors', errors.length === 0, errors);
  await page.screenshot({ path: path.join(outDir, '01-start.png') });

  // --- template + materials
  await page.click('#paneltabs [data-pane=sheet]');
  await choose('#btnLoadTpl', A('pickup_skin_UVs.png'));
  let P = await proj();
  check('template loads and sheet takes its size', P.sheets[0].template.assetId && P.sheets[0].width === 1024 && P.sheets[0].height === 1024, [P.sheets[0].width, P.sheets[0].height]);
  await choose('#btnLoadMat', A('main.materials.json'));
  P = await proj();
  check('materials file with comments / trailing commas is read', Object.keys(P.materialLib).length === 3, Object.keys(P.materialLib));
  check('paintable body material is picked automatically', JSON.stringify(P.sheets[0].materials) === '["pickup_main"]', P.sheets[0].materials);
  check('vehicle folder is guessed from the texture paths', P.vehicle.folder === 'pickup', P.vehicle.folder);
  const matInfo = await page.textContent('#matInfo');
  check('existing skins are noticed', /1 existing skin,/.test(matInfo), matInfo);

  // --- DDS templates
  for (const f of ['pickup_template.dds', 'pickup_template_dxt5.dds']) {
    const res = await page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const t = DDS.decode(bin.buffer);
      const px = (x, y) => Array.from(t.data.slice((y * t.width + x) * 4, (y * t.width + x) * 4 + 4));
      return { w: t.width, h: t.height, bg: px(5, 5), line: px(64, 300), blue: px(30, 25) };
    }, fs.readFileSync(A(f)).toString('base64'));
    const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
    check('DDS decode ' + f, res.w === 1024 && res.h === 1024 && near(res.bg, [235, 235, 235, 255], 12) && near(res.line, [200, 200, 200, 255], 20), res);
  }

  // --- side areas: drag the right zone down a bit in "Set side areas"
  await page.click('#btnZones');
  await page.waitForTimeout(100);
  const z0 = (await proj()).sheets[0].zones.right;
  await drag(await scr(z0.x + z0.w / 2, z0.y + z0.h / 2), await scr(z0.x + z0.w / 2, z0.y + z0.h / 2 + 20));
  const z1 = (await proj()).sheets[0].zones.right;
  check('right side area can be dragged', Math.abs(z1.y - z0.y - 20) <= 2, [z0.y, z1.y]);
  await page.screenshot({ path: path.join(outDir, '02-side-areas.png') });
  // put the zones exactly over the two drawn sides for the rest of the test
  await LD(() => { const z = window.LiveryDesigner.project.sheets[0].zones; Object.assign(z.left, { x: 60, y: 100, w: 920, h: 330 }); Object.assign(z.right, { x: 44, y: 600, w: 920, h: 330 }); window.LiveryDesigner.state.cams = {}; window.LiveryDesigner.pushHistory(); window.LiveryDesigner.refreshAll(); });

  // --- text on the left side
  await page.click('#viewseg [data-view=left]');
  await page.waitForTimeout(100);
  await page.click('#tools [data-tool=text]');
  const tp = await scr(330, 250);
  await page.mouse.click(tp.x, tp.y);
  await page.waitForTimeout(150);
  const focused = await LD(() => document.activeElement && document.activeElement.id);
  check('new text is ready to type into', focused === 'propText', focused);
  await page.keyboard.type('SPEED DEMON');
  await page.waitForTimeout(100);
  P = await proj();
  let t = P.sheets[0].layers.find((l) => l.type === 'text');
  check('text is typed in', t && t.text === 'SPEED DEMON', t && t.text);
  await page.selectOption('#props select[data-prop=font]', 'Impact');
  await page.fill('#props input[data-prop="outline.width"]', '6');
  await page.dispatchEvent('#props input[data-prop="outline.width"]', 'change');
  await page.fill('#props input[data-prop="size"]', '80');
  await page.dispatchEvent('#props input[data-prop="size"]', 'change');
  P = await proj();
  t = P.sheets[0].layers.find((l) => l.type === 'text');
  check('font, outline and size change', t.font === 'Impact' && t.outline.width === 6 && t.size === 80, [t.font, t.outline.width, t.size]);

  // --- mirror it to the right side
  await page.click('#lyMirror');
  await page.waitForTimeout(150);
  P = await proj();
  const texts = P.sheets[0].layers.filter((l) => l.type === 'text');
  const left = texts.find((l) => l.side === 'left'), right = texts.find((l) => l.side === 'right');
  check('mirror makes a linked copy on the right side', texts.length === 2 && left && right && left.twin === right.id && right.linked);
  const z = P.sheets[0].zones;
  const expX = z.right.x + (1 - (left.x - z.left.x) / z.left.w) * z.right.w;
  const expY = z.right.y + ((left.y - z.left.y) / z.left.h) * z.right.h;
  check('copy lands in the mirrored spot', Math.abs(right.x - expX) < 0.5 && Math.abs(right.y - expY) < 0.5, [right.x, expX, right.y, expY]);
  check('mirrored text still reads forwards', right.flipX === false);
  const view = await LD(() => window.LiveryDesigner.state.view);
  check('view switches to both sides after mirroring', view === 'both', view);
  // edit the text on the left; the right copy follows
  await LD((id) => window.LiveryDesigner.select(id), left.id);
  await page.fill('#propText', 'TEAM BEAMNG\nRACING');
  await page.dispatchEvent('#propText', 'change');
  P = await proj();
  const right2 = P.sheets[0].layers.find((l) => l.id === right.id);
  check('editing one side updates the other', right2.text === 'TEAM BEAMNG\nRACING', right2.text);
  await page.screenshot({ path: path.join(outDir, '03-both-sides.png') });

  // move the left text by dragging on the canvas; twin follows mirrored
  const L1 = P.sheets[0].layers.find((l) => l.id === left.id);
  const a = await scr(L1.x, L1.y, 0);
  await page.click('#tools [data-tool=select]');
  await drag(a, { x: a.x + 40, y: a.y + 10 });
  P = await proj();
  const L2 = P.sheets[0].layers.find((l) => l.id === left.id), R2 = P.sheets[0].layers.find((l) => l.id === right.id);
  check('dragging moves the text', L2.x > L1.x + 5, [L1.x, L2.x]);
  check('the linked copy moves the mirrored way', R2.x < right2.x - 5, [right2.x, R2.x]);

  // rotate with the round handle
  await LD((id) => window.LiveryDesigner.select(id), left.id);
  const handle = await LD(() => { const S = window.LiveryDesigner.state; const vp = S.vps[0]; const P = window.LiveryDesigner.project; const L = P.sheets[0].layers.find((l) => l.id === S.sel); return { L: { x: L.x, y: L.y } }; });
  await page.waitForTimeout(50);
  const rotInfo = await page.evaluate(() => {
    const S = window.LiveryDesigner.state; const vp = S.vps[0];
    const L = window.LiveryDesigner.project.sheets[0].layers.find((l) => l.id === S.sel);
    return { vp: { ox: vp.ox, oy: vp.oy, s: vp.scale } };
  });
  void handle; void rotInfo;

  // --- shapes, stripe, brush and image
  await page.click('#viewseg [data-view=full]');
  await page.waitForTimeout(100);
  await page.click('#tools [data-tool=shape]');
  await page.selectOption('#toShape', 'star');
  await drag(await scr(700, 150), await scr(820, 260));
  await page.click('#tools [data-tool=stripe]');
  await drag(await scr(100, 420), await scr(950, 380));
  await page.click('#tools [data-tool=brush]');
  await drag(await scr(150, 700), await scr(400, 760));
  await page.click('#tools [data-tool=image]').catch(() => {});
  P = await proj();
  const types = P.sheets[0].layers.map((l) => l.type + (l.shape ? ':' + l.shape : ''));
  check('star, stripe and brush layers are made', types.includes('shape:star') && types.filter((x) => x === 'shape:rect').length === 1 && types.includes('brush'), types);
  const stripe = P.sheets[0].layers.find((l) => l.name === 'Stripe');
  check('stripe follows the drag angle', stripe && stripe.rotation < -1 && stripe.rotation > -5 && stripe.w > 800, stripe && [stripe.rotation, stripe.w]);
  const brush = P.sheets[0].layers.find((l) => l.type === 'brush');
  check('brush stroke recorded', brush && brush.strokes.length === 1 && brush.strokes[0].pts.length >= 6, brush && brush.strokes[0].pts.length);
  // the image tool opened a file chooser when clicked; add the logo through the toolbar button
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#toImage')]);
  await fc.setFiles(A('logo.png'));
  await page.waitForTimeout(400);
  P = await proj();
  const imgL = P.sheets[0].layers.find((l) => l.type === 'image');
  check('logo image added', imgL && Math.abs(imgL.w / imgL.h - 2) < 0.01, imgL && [imgL.w, imgL.h]);

  // resize the star by its bottom-right corner (keeps proportions)
  const star = P.sheets[0].layers.find((l) => l.shape === 'star');
  await LD((id) => window.LiveryDesigner.select(id), star.id);
  await page.click('#tools [data-tool=select]');
  await drag(await scr(star.x + star.w / 2, star.y + star.h / 2), await scr(star.x + star.w / 2 + 60, star.y + star.h / 2 + 60));
  P = await proj();
  const star2 = P.sheets[0].layers.find((l) => l.id === star.id);
  check('corner handle resizes and keeps the shape', star2.w > star.w + 30 && Math.abs(star2.w / star2.h - star.w / star.h) < 0.02, [star.w, star2.w, star2.h]);

  // undo / redo
  const before = (await proj()).sheets[0].layers.length;
  await page.keyboard.press('Delete');
  const afterDel = (await proj()).sheets[0].layers.length;
  await page.keyboard.press('Control+z');
  const afterUndo = (await proj()).sheets[0].layers.length;
  await page.keyboard.press('Control+y');
  const afterRedo = (await proj()).sheets[0].layers.length;
  check('delete, undo and redo work', afterDel === before - 1 && afterUndo === before && afterRedo === before - 1, [before, afterDel, afterUndo, afterRedo]);
  await page.keyboard.press('Control+z');

  await page.screenshot({ path: path.join(outDir, '04-design.png') });

  // --- export
  await page.click('#paneltabs [data-pane=export]');
  await page.fill('#exName', 'Speed Demon Racing');
  await page.dispatchEvent('#exName', 'change');
  await page.waitForTimeout(400);
  const jbeamText = await page.inputValue('#exJbeam');
  const matText = await page.inputValue('#exMat');
  let jb, mt;
  try { jb = JSON.parse(jbeamText); mt = JSON.parse(matText); } catch (e) { /* checked below */ }
  check('jbeam text is valid JSON', !!jb, jbeamText.slice(0, 80));
  check('materials text is valid JSON', !!mt, matText.slice(0, 80));
  const part = jb && jb.pickup_skin_speed_demon_racing;
  check('jbeam part has the paint_design slot and skin id', part && part.slotType === 'paint_design' && part.globalSkin === 'speed_demon_racing' && part.information.name === 'Speed Demon Racing', part);
  const mat = mt && mt['pickup_main.skin.speed_demon_racing'];
  check('skin material is named <material>.skin.<id>', mat && mat.name === 'pickup_main.skin.speed_demon_racing' && mat.mapTo === mat.name);
  check('skin material keeps the vehicle\'s own maps', mat && mat.Stages[0].ambientOcclusionMap === 'vehicles/pickup/pickup_main_ao.data.png' && mat.version === 1.5);
  check('relative texture paths are fixed', mat && mat.Stages[0].normalMap === '/vehicles/pickup/pickup_main_nm.normal.png', mat && mat.Stages[0].normalMap);
  check('livery texture is plugged into the paint layer', mat && mat.Stages[0].baseColorMap === '/vehicles/pickup/speed_demon_racing/pickup_skin_speed_demon_racing.color.png' && mat.Stages[0].instanceDiffuse === false, mat && mat.Stages[0]);
  check('persistentId is not copied', mat && !('persistentId' in mat));

  // slot type from an existing skin jbeam
  await page.fill('#exSlot', 'something_else');
  await page.dispatchEvent('#exSlot', 'input');
  await choose('#btnReadJbeam', A('pickup_skin_police.jbeam'));
  check('slot type is read from a skin .jbeam', (await proj()).vehicle.slotType === 'paint_design');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnZip')]);
  const zipPath = path.join(outDir, dl.suggestedFilename());
  await dl.saveAs(zipPath);
  check('ZIP downloads with a clear name', dl.suggestedFilename() === 'speed_demon_racing_pickup_livery.zip', dl.suggestedFilename());
  const listing = execFileSync('python3', ['-I', '-c', `
import zipfile, json, sys, io
from PIL import Image
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
names = z.namelist()
out = {"names": names}
d = "vehicles/pickup/speed_demon_racing/"
out["jbeam"] = json.loads(z.read(d + "pickup_skin_speed_demon_racing.jbeam"))
out["mat"] = json.loads(z.read(d + "skin.materials.json"))
im = Image.open(io.BytesIO(z.read(d + "pickup_skin_speed_demon_racing.color.png"))).convert("RGBA")
out["size"] = im.size
out["corner"] = im.getpixel((2, 2))
out["readme"] = z.read("INSTALL - READ ME.txt").decode()[:60]
# Text pixels exist on both sides: count dark/outline pixels in each text box
def count(box):
    c = 0
    for x in range(box[0], box[2], 2):
        for y in range(box[1], box[3], 2):
            r, g, b, a = im.getpixel((x, y))
            if r < 60 and g < 60 and b < 60: c += 1
    return c
out["leftInk"] = count((150, 180, 600, 330))
out["rightInk"] = count((400, 680, 900, 830))
print(json.dumps(out))
`, zipPath]).toString();
  const Z = JSON.parse(listing);
  check('ZIP has the BeamNG folder layout', JSON.stringify(Z.names) === JSON.stringify([
    'vehicles/pickup/speed_demon_racing/pickup_skin_speed_demon_racing.jbeam',
    'vehicles/pickup/speed_demon_racing/skin.materials.json',
    'vehicles/pickup/speed_demon_racing/pickup_skin_speed_demon_racing.color.png',
    'INSTALL - READ ME.txt']), Z.names);
  check('texture is full size', Z.size[0] === 1024 && Z.size[1] === 1024, Z.size);
  check('template guide lines are not baked into the livery', JSON.stringify(Z.corner) === '[255,255,255,255]', Z.corner);
  check('text is painted on the left side', Z.leftInk > 40, Z.leftInk);
  check('text is painted on the right side too', Z.rightInk > 40, Z.rightInk);
  check('material in ZIP points at the PNG in the ZIP', Z.mat['pickup_main.skin.speed_demon_racing'].Stages[0].baseColorMap === '/' + Z.names[2]);

  // paint-through mode adds a palette map
  await page.click('#paneltabs [data-pane=sheet]');
  await page.check('#bgPaint');
  await page.click('#paneltabs [data-pane=export]');
  await page.waitForTimeout(400);
  const mt2 = JSON.parse(await page.inputValue('#exMat'))['pickup_main.skin.speed_demon_racing'];
  check('paint mode uses a palette map and keeps the paint color on', mt2.Stages[0].colorPaletteMap === '/vehicles/pickup/speed_demon_racing/pickup_skin_speed_demon_racing_palette.data.png' && mt2.Stages[0].instanceDiffuse === true, mt2.Stages[0]);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btnZip')]);
  const zip2 = path.join(outDir, 'paint_' + dl2.suggestedFilename());
  await dl2.saveAs(zip2);
  const pal = JSON.parse(execFileSync('python3', ['-I', '-c', `
import zipfile, json, sys, io
from PIL import Image
z = zipfile.ZipFile(sys.argv[1])
d = "vehicles/pickup/speed_demon_racing/"
pal = Image.open(io.BytesIO(z.read(d + "pickup_skin_speed_demon_racing_palette.data.png"))).convert("RGBA")
col = Image.open(io.BytesIO(z.read(d + "pickup_skin_speed_demon_racing.color.png"))).convert("RGBA")
print(json.dumps({"emptyPal": pal.getpixel((2, 2)), "emptyCol": col.getpixel((2, 2)), "names": z.namelist()}))
`, zip2]).toString());
  check('empty areas are paint color 1 in the palette', JSON.stringify(pal.emptyPal) === '[255,0,0,255]' && JSON.stringify(pal.emptyCol) === '[255,255,255,255]', pal);
  await page.click('#paneltabs [data-pane=sheet]');
  await page.uncheck('#bgPaint');

  // --- save project, reload, open again
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#btnSave')]);
  const projPath = path.join(outDir, dl3.suggestedFilename());
  await dl3.saveAs(projPath);
  const layerCount = (await proj()).sheets[0].layers.length;
  await page.waitForTimeout(1500); // let the autosave land
  await page.reload();
  await page.waitForTimeout(800);
  const restoreShown = await page.isVisible('#restorebar');
  check('after reload the app offers to restore the last design', restoreShown);
  await page.click('#btnNoRestore');
  await choose('#btnOpen', projPath);
  P = await proj();
  check('saved project opens with every layer', P.sheets[0].layers.length === layerCount && P.sheets[0].layers.some((l) => l.text === 'TEAM BEAMNG\nRACING'), [P.sheets[0].layers.length, layerCount]);
  check('template comes back with the project', !!P.sheets[0].template.assetId && (await LD(() => window.LiveryDesigner.assets.size)) >= 2);
  await page.click('#viewseg [data-view=both]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '05-reopened-both.png') });
  await page.click('#btnGuide');
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, '06-guide.png') });
  await page.click('#guideModal [data-close]');

  check('no errors at any point', errors.length === 0, errors);
  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILED: ' + failures.join(' | ') : '\nALL PASSED');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
