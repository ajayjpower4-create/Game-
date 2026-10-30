// Headless checks run before every Windows build: every catalog item builds
// valid geometry, every site loads, and the core construction loop works end
// to end (unstrap, rig with the crane, land on a footing, bolt, unhook,
// save and restore).

import { Registry } from "../src/data/items.js";
import { Builder } from "../src/world/builder.js";
import { CF, V3, v } from "../src/core/math.js";
import { Config } from "../src/core/config.js";
import { Game } from "../src/sim/game.js";
import { SiteOrder } from "../src/data/sites.js";
import * as CM from "../src/sim/craneMath.js";
import { bus } from "../src/core/events.js";

let failures = 0;
const check = (cond, msg) => {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
};
const fin = (n) => typeof n === "number" && Number.isFinite(n);
const okV = (p) => p instanceof V3 && fin(p.x) && fin(p.y) && fin(p.z);
const okC = (c) => c instanceof CF && fin(c.x) && fin(c.y) && fin(c.z) && c.r.every(fin);

// 1. catalog
const counts = Registry.count();
check(counts.total >= 500, "catalog has 500+ items (" + counts.total + ")");
let parts = 0;
for (const def of Registry.list) {
  check(okV(def.sizeM), def.id + " size");
  for (const s of [...def.plugs, ...def.sockets]) check(okC(s.cf), def.id + " socket " + s.type);
  for (const f of def.fasteners) check(okV(f.pos), def.id + " fastener");
  for (const opts of [{}, { installed: true }]) {
    const b = new Builder(opts);
    try {
      def.build(b, def, opts);
    } catch (e) {
      check(false, def.id + " build: " + e.message);
      continue;
    }
    check(b.parts.length > 0, def.id + " has parts");
    for (const p of b.parts) {
      parts++;
      if (!okV(p.size) || !okC(p.cf)) {
        check(false, def.id + " part " + p.name);
        break;
      }
    }
  }
}
console.log(`catalog: ${counts.total} items (${counts.Installable} installable, ${counts.Equipment} equipment, ${counts.Decorative} props, ${counts.Tool} tools), ${parts} parts`);

// 2. every site loads
const g = new Game();
for (const id of SiteOrder) {
  const r = g.loadSite(id);
  check(r.ok && r.failures.length === 0, id + " loads: " + JSON.stringify(r.failures));
  check(g.delivery.trailers.size >= 1, id + " has a starter delivery");
  console.log(`site ${id}: ${g.world.records().length} components, ${g.world.physics.count} colliders`);
}

// 3. core loop on Office 1
const notes = [];
bus.on("notify", (t) => notes.push(t));
g.loadSite("Office1");
const t = [...g.delivery.trailers.values()][0];
for (const s of t.straps) {
  const p = g.delivery.bedFrame(t).point(v(s.x, 0, t.bedWidthM / 2 + 1));
  g.player.teleport(v(p.x, 0, p.z));
  check(g.delivery.releaseStrap(s, t).ok, "release strap");
}
const col = g.world.records().filter((c) => c.def.id.startsWith("COL-") && c.trailerId === t.id).sort((a, b) => b.cf.y - a.cf.y)[0];
check(col && col.state === "Loose", "column is loose after straps");
g.components.equip("TL-REMOTE");
const crane = g.crane;
check(crane.enter("Remote").ok, "enter crane by remote");
const setHook = (p) => {
  const d = p.sub(crane.cfg.pivot);
  Object.assign(crane.st, { slew: Math.atan2(-d.z, d.x), trolley: Math.hypot(d.x, d.z), hoist: crane.cfg.pivot.y + CM.TrolleyY - p.y, swingX: 0, swingZ: 0 });
  crane.sv = { x: 0, z: 0 };
  CM.sanitize(crane.cfg, crane.st);
};
setHook(col.cf.point(CM.liftCentre(col.def)).add(v(0, Config.Crane.SlingDrop, 0)));
check(crane.hookOrRelease().ok, "attach column");
for (let i = 0; i < 120; i++) g.update(1 / 60, {});
const entry = g.site.progress.nextEntry;
setHook(entry.cf.pos.add(v(0, Config.Crane.SlingDrop + col.def.lengthM / 2 + 0.1 + 0.2, 0)));
for (let i = 0; i < 30; i++) g.update(1 / 60, {});
const land = crane.landNow();
check(land.ok, "land column: " + land.msg);
g.components.equip("TL-IMPACT");
g.player.teleport(v(entry.cf.x + 1, 0, entry.cf.z));
col.def.fasteners.forEach((f, i) => check(g.components.fasten(col, i).ok, "fasten bolt " + i));
check(col.state === "Installed", "column installed");
check(crane.hookOrRelease().ok, "unhook");
check(g.site.progress.installed === 25, "progress counts the column (" + g.site.progress.installed + ")");
const save = JSON.parse(JSON.stringify(g.site.serialize()));
const g2 = new Game();
g2.loadSite(save.site, save);
check(g2.world.records().length === g.world.records().length, "save restores every component");
check(g2.site.progress.installed === 25, "save restores progress");

// 4. slab-on-grade between the footings
import * as Rules from "../src/sim/buildRules.js";
{
  const gr = g.siteDef.grid;
  const p = v(gr.originM.x + gr.bayX * 1.5, 0, gr.originM.z + gr.bayZ * 0.5);
  const s = Rules.solveSlab(g.world, { point: p, hit: { terrain: true, pos: p } });
  check(s.def && s.def.id.startsWith("SL-SOG-"), "slab-on-grade solves for a bay");
  g.components.equip("TL-POUR");
  g.player.teleport(p.add(v(1, 0, 1)));
  check(g.components.pour(s.def, s.cf).ok, "pour slab-on-grade");
  const slab = g.world.records().find((c) => c.def.id === s.def.id);
  g.components.equip("TL-TROWEL");
  slab.def.fasteners.forEach((f, i) => g.components.fasten(slab, i));
  check(slab.state === "Installed", "slab-on-grade finishes with the trowel");
}

// 5. telehandler: pick up, lift, drive, set down
{
  const t = g.telehandler;
  check(t && !t.blocked(t.frame()), "telehandler parks clear");
  if (g.crane.operating) g.crane.exit();
  check(t.enter().ok, "climb into the telehandler");
  const item = g.world.records().find((c) => c.state === "Loose" && c.def.weightKg < 1000);
  item.cf = g.components.restingPose(item, t.frame().point(v(3.6, 0, 0)), 0);
  g.components.move(item, item.cf);
  check(t.pickUp().ok, "telehandler picks up a load");
  for (let i = 0; i < 120; i++) g.update(1 / 60, {}, { boomUp: true });
  check(item.cf.y > 1, "load lifts on the forks");
  for (let i = 0; i < 240; i++) g.update(1 / 60, {}, { boomDown: true });
  check(t.setDown().ok, "telehandler sets the load down");
  check(item.state === "Loose", "load is loose again");
  check(t.exit().ok, "leave the telehandler");
}

// 6. delivery ordering
check(g.delivery.request("BM-W18x35-7500", 4).ok, "order beams by truck");
g.loadSite("Office4");
check(g.delivery.request("BM-W21x44-9000", 6, "rail").ok, "order beams by rail");

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
