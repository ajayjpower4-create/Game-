// STEELRISE desktop entry point: boot, menus <-> play, the frame loop.

import * as THREE from "three";
import { v, clamp } from "./core/math.js";
import { Config } from "./core/config.js";
import { bus } from "./core/events.js";
import { input } from "./core/input.js";
import { Registry } from "./data/items.js";
import { Game } from "./sim/game.js";
import * as CM from "./sim/craneMath.js";
import { Renderer } from "./render/scene.js";
import { SiteView } from "./render/siteView.js";
import { FX } from "./render/fx.js";
import { Controller } from "./player/controller.js";
import { Interaction } from "./player/interaction.js";
import { CraneControl } from "./player/craneControl.js";
import { UI } from "./ui/ui.js";
import { Catalog } from "./ui/catalog.js";
import { Tutorial } from "./ui/tutorial.js";
import { pumpThumbs } from "./ui/previews.js";
import { Storage } from "./storage.js";
import * as Audio from "./audio/audio.js";

const host = window.steelriseHost;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

class App {
  constructor() {
    this.canvas = document.getElementById("view");
    this.ui = new UI(this);
    this.game = new Game();
    this.game.mode = "Loading";
    this.settings = this.game.settings;
    this.autosaveAcc = 0;
    this.dirty = false;
    this.loops = {};
    this.truckLoops = new Map();
  }

  async boot() {
    const ui = this.ui;
    try {
      ui.setLoading(0.05, "Reading settings…");
      await Storage.loadMeta();
      Object.assign(this.settings, Storage.meta.settings);
      // ?low forces the cheapest preset (software-GPU test runs)
      if (location.search.includes("low")) Object.assign(this.settings, { graphics: "Low", shadows: false, post: false });
      this.game.settings = this.settings;
      await nextFrame();
      ui.setLoading(0.15, "Starting renderer…");
      this.renderer = new Renderer(this.canvas);
      input.attach(this.canvas);
      await nextFrame();
      ui.setLoading(0.3, `Preparing ${Registry.list.length} catalog items…`);
      this.siteView = new SiteView(this.renderer, this.game);
      this.fx = new FX(this.renderer, this.game);
      this.controller = new Controller(this.game, this.renderer);
      this.interaction = new Interaction(this.game, this.renderer, this.controller);
      this.craneControl = new CraneControl(this.game, this.renderer, this.controller);
      this.catalog = new Catalog(ui);
      this.tutorial = new Tutorial(this);
      Audio.initAudio();
      this.applySettings(true);
      await nextFrame();
      ui.setLoading(0.55, "Building the site…");
      await nextFrame();
      this.game.loadSite(this.settings.lastSite || "EmptyLand");
      ui.setLoading(0.85, "Compiling materials…");
      await nextFrame();
      this.renderer.renderer.compile(this.renderer.scene, this.renderer.camera);
      ui.setLoading(1, "Ready");
      this.bindKeys();
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
      await nextFrame();
      ui.hideLoading();
      this.toMenu(true);
    } catch (e) {
      console.error(e);
      ui.setLoading(1, "Failed to start: " + (e && e.message ? e.message : e));
    }
    window.addEventListener("beforeunload", () => {
      if (this.game.mode === "Play") this.save(0, true);
    });
    // resume audio on the first user gesture
    const kick = () => Audio.resume();
    window.addEventListener("mousedown", kick);
    window.addEventListener("keydown", kick);
  }

  applySettings(initial) {
    const s = this.settings;
    this.renderer.setGraphics(s.graphics, s);
    this.renderer.camera.fov = s.fov;
    this.renderer.camera.updateProjectionMatrix();
    this.controller.thirdPerson = !!s.thirdPerson;
    this.fx.scale = s.particles ? this.renderer.preset.particles : 0;
    Audio.setVolumes(s.volumes);
    Storage.meta.settings = s;
    if (!initial) {
      clearTimeout(this.settingsTimer);
      this.settingsTimer = setTimeout(() => Storage.saveMeta(), 400);
    }
  }

  toggleFullscreen() {
    if (host) host.toggleFullscreen();
    else if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  // ---------------------------------------------------------------------------
  // Modes
  // ---------------------------------------------------------------------------
  async toMenu(first) {
    const g = this.game;
    if (g.mode === "Play" && !first) {
      if (g.crane && g.crane.operating) g.crane.exit();
      if (g.player.carrying) g.components.dropCarried(true);
      await this.save(0, true);
    }
    this.ui.hidePause();
    if (this.ui.catalog) this.ui.catalog.close();
    this.tutorial.finish(false);
    g.mode = "Menu";
    input.wantLock = false;
    input.unlock();
    input.blocked = true;
    this.menuT = 0;
    this.ui.showMenu();
  }

  async startSite(siteId, save) {
    const ui = this.ui;
    const g = this.game;
    ui.hideMenu();
    ui.hidePause();
    ui.setLoading(0.2, save ? "Loading your save…" : "Building " + (siteId || "") + "…");
    await nextFrame();
    await nextFrame();
    const r = g.loadSite(save ? save.site : siteId, save);
    if (!r.ok) {
      ui.hideLoading();
      ui.toast(r.msg, "warn");
      return this.toMenu(true);
    }
    ui.setLoading(0.9, "Getting your hard hat…");
    await nextFrame();
    ui.hideLoading();
    this.settings.lastSite = g.site.def.id;
    g.mode = "Play";
    ui.screen = "play";
    ui.showHud();
    input.blocked = false;
    input.wantLock = true;
    this.dirty = false;
    this.autosaveAcc = 0;
    g.components.equip(g.player.tool || "TL-HANDS");
    ui.setProgress(g.site.progress);
    ui.setCarry(null);
    if (r.failures && r.failures.length) ui.toast("Some of the site failed to build (the game still works): " + r.failures.join(" | "), "warn");
    if (!save && g.site.def.id === "EmptyLand" && this.settings.tutorialOn) this.tutorial.start();
    else this.tutorial.finish(false);
    ui.toast(save ? "Save loaded." : "Welcome to " + g.site.def.name + ". Tab opens the catalog, Esc the menu.", "info");
  }

  async continueSlot(n) {
    const data = await Storage.loadSlot(n);
    if (!data) return this.ui.toast("That save slot is empty or unreadable.", "warn");
    this.startSite(null, data);
  }

  async save(slot, silent) {
    const g = this.game;
    if (!g.world || g.mode !== "Play") return false;
    try {
      const data = g.site.serialize();
      await Storage.saveSlot(slot, data);
      if (!silent || slot === 0) this.ui.toast(slot === 0 ? "Autosaved" : `Saved to slot ${slot}`, "save");
      if (slot > 0) bus.emit("event", "Saved", {});
      this.dirty = false;
      return true;
    } catch (e) {
      console.error(e);
      this.ui.toast("Save failed: " + e.message, "warn");
      return false;
    }
  }

  async quit() {
    if (this.game.mode === "Play") await this.save(0, true);
    await Storage.saveMeta();
    if (host) host.quit();
    else window.close();
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  bindKeys() {
    bus.on("comp", () => (this.dirty = true));
    bus.on("key", (code) => {
      const g = this.game;
      if (g.mode !== "Play") return;
      if (code === "Escape") {
        if (performance.now() - (this.lockLostAt || 0) < 300) return;
        if (this.ui.catalog) return this.ui.catalog.close();
        if (this.ui.pause) return this.ui.hidePause();
        return this.ui.showPause();
      }
      if (code === "Tab" || code === "KeyB") {
        if (this.ui.pause) return;
        if (this.ui.catalog) return this.ui.catalog.close();
        return this.catalog.open();
      }
      if (input.blocked) return;
      const crane = g.crane;
      if (code.startsWith("Digit")) {
        const n = Number(code.slice(5));
        const id = Registry.ToolOrder[n - 1];
        if (id) this.selectTool(id);
      } else if (code === "KeyV" && !(crane && crane.operating)) {
        this.controller.thirdPerson = !this.controller.thirdPerson;
        this.settings.thirdPerson = this.controller.thirdPerson;
      }
    });
    bus.on("pointerlock", (locked) => {
      // Esc releases pointer lock in browsers; treat a lost lock as a pause
      if (!locked && this.game.mode === "Play" && !this.ui.pause && !this.ui.catalog && !input.blocked) {
        this.lockLostAt = performance.now();
        this.ui.showPause();
      }
    });
  }

  selectTool(id) {
    const g = this.game;
    const crane = g.crane;
    if (g.player.carrying && id !== "TL-HANDS") return this.ui.toast("Put down what you're carrying first.", "info");
    if (crane && crane.operating && crane.mode === "Cab") return;
    if (crane && crane.operating && crane.mode === "Remote" && id !== "TL-REMOTE") crane.exit();
    g.components.equip(id);
    if (id === "TL-REMOTE" && crane && !crane.operating) {
      const r = crane.enter("Remote");
      if (!r.ok) this.ui.toast(r.msg, "warn");
    } else if (id === "TL-REMOTE" && crane && crane.operating && crane.mode === "Remote") {
      crane.exit();
      g.components.equip("TL-HANDS");
    }
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    const g = this.game;
    const r = this.renderer;
    try {
      const mouse = input.takeMouse();
      if (g.mode === "Play") {
        if (!input.blocked) {
          const crane = g.crane;
          const camOwned = crane && crane.operating && crane.view !== "Player";
          if (!camOwned && (input.locked || input.button(2))) this.controller.look(mouse.dx, mouse.dy);
          if (!camOwned && mouse.wheel && this.controller.thirdPerson) this.controller.orbit = clamp(this.controller.orbit + mouse.wheel * 0.5, 1.5, 12);
        }
        this.controller.enabled = !input.blocked;
        // fixed-step simulation
        this.acc = Math.min((this.acc || 0) + dt, 0.25);
        const step = 1 / 60;
        while (this.acc >= step) {
          g.update(step, this.craneControl.inputState());
          this.controller.update(step);
          this.acc -= step;
        }
        this.interaction.update(dt);
        this.craneControl.update();
        if (!this.craneControl.updateCamera(dt, input.blocked ? { dx: 0, dy: 0, wheel: 0 } : mouse)) this.controller.updateCamera(dt);
        this.tutorial.update();
        this.ui.setStatus();
        this.autosaveAcc += dt;
        if (this.autosaveAcc > Config.Save.AutosaveInterval) {
          this.autosaveAcc = 0;
          if (this.dirty) this.save(0, true);
        }
      } else if (g.mode === "Menu" && g.world) {
        // slow orbit around the site as the menu backdrop
        g.update(dt, {});
        this.menuT = (this.menuT || 0) + dt;
        const c = g.siteDef.crane.posM;
        const R = Math.max(g.siteDef.lotM.x, g.siteDef.lotM.z) * 0.62;
        const a = this.menuT * 0.03 + 0.6;
        r.camera.position.set(c.x + Math.cos(a) * R, 18 + g.siteDef.crane.heightM * 0.35, c.z + Math.sin(a) * R);
        r.camera.lookAt(c.x, g.siteDef.crane.heightM * 0.35, c.z);
        this.ui.renderLivePreview();
      }
      this.siteView.update();
      this.fx.update(dt);
      this.updateAudio(dt);
      r.updateShadows(g.mode === "Play" ? new THREE.Vector3(g.player.pos.x, g.player.pos.y, g.player.pos.z) : r.camera.position.clone().setY(0));
      r.render();
      pumpThumbs(g.mode === "Play" && !this.ui.catalog ? 2 : 8);
    } catch (e) {
      console.error(e);
      if (!this.errorShown) {
        this.errorShown = true;
        this.ui.toast("Error: " + e.message, "warn");
        setTimeout(() => (this.errorShown = false), 5000);
      }
    }
  }

  updateAudio(dt) {
    const g = this.game, r = this.renderer;
    const cam = r.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    Audio.setListener(cam.position, fwd, up);
    if (!g.world || !Audio.running()) return;
    const L = this.loops;
    if (!L.amb) {
      L.amb = new Audio.Loop("Ambience", "Ambience");
      L.slew = new Audio.Loop("Slew");
      L.trolley = new Audio.Loop("Trolley");
      L.hoist = new Audio.Loop("Hoist");
      L.weld = new Audio.Loop("Weld", "Tools");
      L.impact = new Audio.Loop("Impact", "Tools");
      bus.on("tooluse", (type, on, pos) => {
        L.toolType = on ? type : null;
        L.toolPos = pos;
      });
    }
    L.amb.setPos(cam.position);
    L.amb.set(0.35 + g.site.wind.speed / 40, 0.8 + g.site.wind.speed / 30);
    const c = g.crane;
    if (c) {
      const s = c.speeds;
      L.slew.setPos(c.cfg.pivot);
      L.slew.set(s.slew, 0.8 + 0.3 * s.slew);
      L.trolley.setPos(CM.trolleyCf(c.cfg, c.st).pos);
      L.trolley.set(s.trolley, 0.85 + 0.25 * s.trolley);
      L.hoist.setPos(CM.slewCf(c.cfg, c.st.slew).point(v(-2.5, 1.4, 0.6)));
      L.hoist.set(s.hoist, 0.8 + 0.35 * s.hoist);
    }
    const tool = L.toolType;
    if (L.toolPos) {
      L.weld.setPos(L.toolPos);
      L.impact.setPos(L.toolPos);
    }
    L.weld.set(tool === "Weld" ? 1 : 0, 1 + Math.random() * 0.1);
    L.impact.set(tool === "Bolt" ? 1 : 0, 1);
    // truck engines
    const seen = new Set();
    for (const t of g.delivery.trailers.values()) {
      seen.add(t.id);
      let lp = this.truckLoops.get(t.id);
      if (!lp) this.truckLoops.set(t.id, (lp = new Audio.Loop("Engine")));
      const cf = g.delivery.vehicleCf(t).mul({ x: t.kind === "rail" ? -14 : -11, y: 1.2, z: 0, r: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
      lp.setPos(cf.pos);
      const e = t.engine ?? 0.45;
      const idleOff = t.kind === "rail" && !t.arriving && !t.departing ? 0.3 : 1;
      lp.set(e * 0.8 * idleOff, 0.85 + e * 0.35);
    }
    for (const [id, lp] of this.truckLoops) {
      if (!seen.has(id)) {
        lp.stop();
        this.truckLoops.delete(id);
      }
    }
  }
}

const app = new App();
window.steelrise = app;
app.boot();
