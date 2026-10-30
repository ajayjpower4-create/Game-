// First-time tutorial on Empty Land: truck, straps, crane, footing, column,
// bolting, scaffold and saving. Each step advances on a real game event.

import { bus } from "../core/events.js";

const pre = (p) => (d) => d && typeof d.item === "string" && d.item.startsWith(p);

const STEPS = [
  { text: "Welcome to STEELRISE. Walk to the flatbed truck parked in unloading bay 1.", check: (g) => [...g.delivery.trailers.values()].some((t) => t.bayCf.pos.dist(g.player.pos) < 12) },
  { text: "Every stack is strapped down. Aim at an orange ratchet strap and press E to release it.", event: "StrapReleased" },
  { text: "Take the crane: equip the radio remote (5) to work from the ground, or press E at the yellow access gate at the base of the mast to sit in the cab.", event: "CraneEntered" },
  { text: "Fly the hook over a precast footing — A/D slew, W/S trolley, R/F hoist, Shift for fine control. When the crane panel says “G — hook”, press G.", event: "Rigged", match: pre("FT-") },
  { text: "Lift it clear (R), swing it over open ground near the blueprint and lower it (F). Assist (H) shows a target ghost and directions. Press ENTER when it reads ALIGNED, or G to set it down on the ground.", event: "Landed", match: pre("FT-"), alt: "Unhooked" },
  { text: "Footings are grouted, not bolted — press G to unhook.", event: "Unhooked" },
  { text: "Next, a column. It is lifted by its top lug so it hangs plumb. Hook one and land it on the footing (ENTER).", event: "Landed", match: pre("COL-") },
  { text: "The crane holds it while you bolt it down. Leave the controls (X), equip the impact wrench (2) and hold the left mouse button on each yellow anchor nut.", event: "Installed", match: pre("COL-") },
  { text: "Column is fastened. Take the controls again (5 or the cab) and unhook it with G.", event: "Unhooked" },
  { text: "Scaffold time. In the laydown yard, pick up a base jack (E) and place it on the ground next to the frame (left click).", event: "Placed", match: pre("SC-BASEJACK") },
  { text: "Good. Keep building: uprights on jacks, ledgers between rosettes (hammer them tight with 3), then a platform deck. Press Esc and save to a slot to finish the tutorial.", event: "Saved" },
];

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.index = -1;
    bus.on("event", (kind, data) => this.onEvent(kind, data));
    bus.on("tutorialSkip", () => this.finish());
  }
  start() {
    this.index = 0;
    this.show();
  }
  active() {
    return this.index >= 0;
  }
  show() {
    const s = STEPS[this.index];
    this.app.ui.setTutorial(s ? s.text : null, this.index + 1, STEPS.length);
  }
  advance() {
    this.index++;
    if (this.index >= STEPS.length) return this.finish(true);
    bus.emit("sfx", "Notify");
    this.show();
  }
  finish(done) {
    this.index = -1;
    this.app.ui.setTutorial(null);
    this.app.settings.tutorialOn = false;
    this.app.applySettings();
    if (done) bus.emit("notify", "Tutorial complete — the site is yours.", "success");
  }
  onEvent(kind, data) {
    const s = STEPS[this.index];
    if (!s) return;
    if ((s.event === kind && (!s.match || s.match(data))) || s.alt === kind) {
      // setting a footing down on the ground skips the unhook step
      if (s.alt === kind) this.index++;
      this.advance();
    }
  }
  update() {
    const s = STEPS[this.index];
    if (s && s.check && this.app.game.world && s.check(this.app.game)) this.advance();
  }
}
