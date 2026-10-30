// All screens and the HUD, as HTML over the 3D view: loading, main menu
// (play / continue / site selection / settings / controls / credits),
// pause menu with saves, blueprint and time of day, and the in-game HUD.

import { Config } from "../core/config.js";
import { fmtKg } from "../core/math.js";
import { $fmt } from "../core/lua.js";
import { bus } from "../core/events.js";
import { input } from "../core/input.js";
import { Registry } from "../data/items.js";
import { SiteOrder, getSite } from "../data/sites.js";
import { Storage } from "../storage.js";
import { siteSnapshot, renderSiteInto, requestThumb, itemThumb } from "./previews.js";
import { play } from "../audio/audio.js";

const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtDate = (t) => (t ? new Date(t).toLocaleString() : "");

const TIPS = [
  "Release every ratchet strap on a stack before you rig or carry its pieces.",
  "Shift gives fine control on every crane motion — use it for the last metre of a landing.",
  "The load chart is real: capacity falls off past the full-capacity radius. Trolley in for heavy picks.",
  "Columns need four anchor bolts; beams need two at each end before the crane can let go.",
  "Wind above 15 m/s stops new lifts. Watch the wind readout in the crane panel.",
  "Scaffold uprights sit on base jacks, ledgers lock into rosettes — drive the wedges with the hammer (3).",
  "Hold Y at the crane controls to recover a stuck load back to the laydown yard.",
];

const CONTROLS = [
  ["On foot", [["Move", "W A S D"], ["Sprint", "Shift"], ["Jump / let go of a ladder", "Space"], ["Look", "Mouse"], ["Interact / pick up / release strap", "E"], ["Switch equipment on/off", "F"], ["Fasten (hold on a marker)", "LMB"], ["Dismantle (hold)", "X"], ["Tools", "1 – 7"], ["First / third person", "V"], ["Catalog & deliveries", "Tab"], ["Pause / save", "Esc"]]],
  ["Carrying", [["Place piece", "LMB"], ["Rotate 90°", "R"], ["Fine rotate", "Z / C"], ["Free placement (props)", "T"], ["Nudge (free placement)", "Arrows"], ["Drop", "G"]]],
  ["Tower crane", [["Slew left / right", "A / D"], ["Trolley out / in", "W / S"], ["Lower / raise hook", "F / R"], ["Rotate load", "Z / C"], ["Fine control", "Shift"], ["Hook / unhook / set down", "G"], ["Land on connection", "Enter"], ["Alignment assist", "H"], ["Camera (cab / hook / exterior)", "V"], ["Recover load (hold)", "Y"], ["Leave controls", "X"]]],
];

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById("ui");
    this.toasts = [];
    this.screen = "loading";
    this.selectedSite = "EmptyLand";
    this.catalog = null;
    this.buildLoading();
    this.buildHud();
    bus.on("notify", (t, k) => this.toast(t, k));
    bus.on("prompt", (list) => this.setPrompt(list));
    bus.on("hold", (a) => this.setHold(a));
    bus.on("placement", (d) => this.setPlacement(d));
    bus.on("craneHud", (d) => this.setCrane(d));
    bus.on("progress", (p) => this.setProgress(p));
    bus.on("tool", (id) => this.setTool(id));
    bus.on("carry", (c) => this.setCarry(c));
    bus.on("pointerlock", (locked) => this.updateClickHint());
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  buildLoading() {
    this.loading = el(`<div id="loading" class="screen">
      <div class="logo">STEEL<b>RISE</b></div><div class="logo-sub">CONSTRUCTION SIMULATOR</div>
      <div class="hazard"></div><div class="bar"><div></div></div><div class="status"></div>
      <div class="tip"></div></div>`);
    this.root.appendChild(this.loading);
    this.loading.querySelector(".tip").textContent = "TIP · " + TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  setLoading(frac, text) {
    if (!this.loading) return;
    this.loading.classList.remove("hidden");
    this.loading.querySelector(".bar div").style.width = Math.round(frac * 100) + "%";
    this.loading.querySelector(".status").textContent = text || "";
  }
  hideLoading() {
    this.loading.classList.add("hidden");
  }

  // ---------------------------------------------------------------------------
  // Main menu
  // ---------------------------------------------------------------------------
  showMenu(panel) {
    this.screen = "menu";
    this.hideHud();
    if (!this.menu) {
      this.menu = el(`<div id="menu" class="screen">
        <div class="side">
          <div class="logo">STEEL<b>RISE</b></div><div class="logo-sub">CONSTRUCTION SIMULATOR</div>
          <nav>
            <button class="navbtn" data-p="play">PLAY<small>Start the selected site</small></button>
            <button class="navbtn" data-p="continue">CONTINUE<small>Load a save</small></button>
            <button class="navbtn" data-p="sites">SITE SELECTION<small>Eight sites, empty lot to high-rise</small></button>
            <button class="navbtn" data-p="settings">SETTINGS</button>
            <button class="navbtn" data-p="controls">CONTROLS</button>
            <button class="navbtn" data-p="credits">CREDITS</button>
            <button class="navbtn" data-p="quit">QUIT</button>
          </nav>
          <div class="foot"></div>
        </div>
        <div class="panelwrap hidden"><div class="panel"></div></div></div>`);
      this.root.appendChild(this.menu);
      this.menu.querySelectorAll(".navbtn").forEach((b) =>
        b.addEventListener("click", () => {
          play("UIClick");
          this.menuPanel(b.dataset.p);
        }),
      );
      this.menu.querySelectorAll(".navbtn").forEach((b) => b.addEventListener("mouseenter", () => play("UIHover")));
    }
    this.menu.classList.remove("hidden");
    this.menu.querySelector(".foot").innerHTML = `v${Config.version} · ${Registry.list.length} catalog items<br>Saves: ${esc(this.savePath || "")}`;
    Storage.savePath().then((p) => {
      this.savePath = p;
      if (this.menu) this.menu.querySelector(".foot").innerHTML = `v${Config.version} · ${Registry.list.length} catalog items<br>Saves: ${esc(p)}`;
    });
    const hasSave = Object.keys(Storage.meta.slots || {}).length > 0;
    this.menu.querySelector('[data-p="continue"]').disabled = !hasSave;
    this.menuPanel(panel || null);
  }
  hideMenu() {
    if (this.menu) this.menu.classList.add("hidden");
    this.livePreview = null;
  }

  menuPanel(p) {
    const wrap = this.menu.querySelector(".panelwrap");
    const panel = wrap.querySelector(".panel");
    this.menu.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("on", b.dataset.p === p));
    this.livePreview = null;
    if (!p) {
      wrap.classList.add("hidden");
      return;
    }
    if (p === "play") return this.app.startSite(this.selectedSite, null);
    if (p === "quit") return this.app.quit();
    wrap.classList.remove("hidden");
    panel.innerHTML = "";
    if (p === "sites") this.buildSites(panel);
    else if (p === "continue") this.buildSlots(panel, "load");
    else if (p === "settings") this.buildSettings(panel);
    else if (p === "controls") this.buildControls(panel);
    else if (p === "credits") this.buildCredits(panel);
  }

  buildSites(panel) {
    panel.appendChild(el(`<h2>SITE SELECTION</h2>`));
    const detail = el(`<div class="sitedetail"><canvas></canvas><div class="info"></div></div>`);
    panel.appendChild(detail);
    const grid = el(`<div class="sites"></div>`);
    panel.appendChild(grid);
    const showDetail = (id) => {
      this.selectedSite = id;
      const s = getSite(id);
      grid.querySelectorAll(".sitecard").forEach((c) => c.classList.toggle("on", c.dataset.id === id));
      detail.querySelector(".info").innerHTML = `
        <h3 style="margin-top:0;color:var(--text);font-size:20px;letter-spacing:0">${esc(s.name)} <span class="diff ${s.difficulty}">${s.difficulty.toUpperCase()}</span></h3>
        <p>${esc(s.description)}</p>
        <div class="kv"><span>Starting stage</span><span>${esc(s.stageText)}</span><span>Lot</span><span>${s.lotM.x} × ${s.lotM.z} m</span>
        <span>Building</span><span>${s.grid ? `${s.grid.nx} × ${s.grid.nz} bays, ${s.grid.floors} floor${s.grid.floors > 1 ? "s" : ""}` : "Free build (blueprints available)"}</span></div>
        <ul>${s.equipment.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        <button class="btn">START NEW GAME</button>`;
      detail.querySelector(".btn").onclick = () => {
        play("UIClick");
        this.app.startSite(id, null);
      };
      this.livePreview = { canvas: detail.querySelector("canvas"), id, t0: performance.now() };
    };
    for (const id of SiteOrder) {
      const s = getSite(id);
      const card = el(`<div class="sitecard" data-id="${id}"><div class="ph"></div><div class="t">${esc(s.name)}</div><div class="s">${esc(s.subtitle)} · ${esc(s.stageText)}</div></div>`);
      card.onclick = () => {
        play("UIClick");
        showDetail(id);
      };
      grid.appendChild(card);
      // snapshots are generated after the panel is on screen
      setTimeout(() => {
        const img = document.createElement("img");
        img.src = siteSnapshot(id);
        card.replaceChild(img, card.querySelector(".ph"));
      }, 30);
    }
    showDetail(this.selectedSite);
  }

  renderLivePreview() {
    const lp = this.livePreview;
    if (!lp || !lp.canvas.isConnected) return;
    renderSiteInto(lp.canvas, lp.id, (performance.now() - lp.t0) / 1000);
  }

  // mode: "load" (menu continue / pause load) or "save"
  buildSlots(panel, mode) {
    panel.appendChild(el(`<h2>${mode === "save" ? "SAVE GAME" : "CONTINUE"}</h2>`));
    const list = el(`<div class="slots"></div>`);
    panel.appendChild(list);
    const slots = mode === "save" ? [1, 2, 3] : [0, 1, 2, 3];
    for (const n of slots) {
      const m = Storage.meta.slots[n];
      const name = n === 0 ? "AUTOSAVE" : "SLOT " + n;
      const s = m && getSite(m.site);
      const row = el(`<div class="slot"><div class="n">${name}</div><div class="d">${m ? `${esc(s ? s.name : m.site)}<small>${fmtDate(m.savedAt)} · ${m.installed} installed · ${m.components} pieces on site</small>` : `<span style="color:var(--muted)">Empty</span>`}</div></div>`);
      const btn = el(`<button class="btn small">${mode === "save" ? (m ? "OVERWRITE" : "SAVE") : "LOAD"}</button>`);
      btn.disabled = mode === "load" && !m;
      btn.onclick = async () => {
        play("UIClick");
        if (mode === "save") {
          await this.app.save(n);
          panel.innerHTML = "";
          this.buildSlots(panel, "save");
        } else this.app.continueSlot(n);
      };
      row.appendChild(btn);
      list.appendChild(row);
    }
    if (!Storage.persistent) panel.appendChild(el(`<p style="color:var(--muted);font-size:12px;margin-top:14px">Running outside the desktop app — saves go to browser storage.</p>`));
  }

  buildSettings(panel) {
    const s = this.app.settings;
    panel.appendChild(el(`<h2>SETTINGS</h2>`));
    const changed = () => this.app.applySettings();
    const seg = (label, key, options) => {
      const row = el(`<div class="setrow"><span>${label}</span><div class="seg"></div><span class="val"></span></div>`);
      for (const o of options) {
        const b = el(`<button>${o}</button>`);
        b.classList.toggle("on", s[key] === o);
        b.onclick = () => {
          s[key] = o;
          row.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
          play("UIClick");
          changed();
        };
        row.querySelector(".seg").appendChild(b);
      }
      panel.appendChild(row);
    };
    const toggle = (label, key) => {
      const row = el(`<div class="setrow"><span>${label}</span><div class="seg"><button>On</button><button>Off</button></div><span class="val"></span></div>`);
      const [on, off] = row.querySelectorAll("button");
      const sync = () => {
        on.classList.toggle("on", !!s[key]);
        off.classList.toggle("on", !s[key]);
      };
      on.onclick = () => ((s[key] = true), sync(), play("UIClick"), changed());
      off.onclick = () => ((s[key] = false), sync(), play("UIClick"), changed());
      sync();
      panel.appendChild(row);
    };
    const slider = (label, get, set, min, max, step, fmt) => {
      const row = el(`<div class="setrow"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span></div>`);
      const r = row.querySelector("input");
      r.value = get();
      const show = () => (row.querySelector(".val").textContent = fmt(Number(r.value)));
      r.oninput = () => {
        set(Number(r.value));
        show();
        changed();
      };
      show();
      panel.appendChild(row);
    };
    panel.appendChild(el(`<h3>GRAPHICS</h3>`));
    seg("Quality preset", "graphics", Config.Graphics.Order);
    toggle("Shadows", "shadows");
    toggle("Post-processing (AO, bloom)", "post");
    toggle("Particles", "particles");
    slider("Field of view", () => s.fov, (v) => (s.fov = v), 55, 100, 1, (v) => v + "°");
    const fs = el(`<div class="setrow"><span>Display</span><div class="seg"><button>Toggle fullscreen (F11)</button></div><span class="val"></span></div>`);
    fs.querySelector("button").onclick = () => this.app.toggleFullscreen();
    panel.appendChild(fs);
    panel.appendChild(el(`<h3>CONTROLS</h3>`));
    slider("Mouse sensitivity", () => s.mouseSensitivity, (v) => (s.mouseSensitivity = v), 0.2, 3, 0.05, (v) => v.toFixed(2));
    toggle("Third-person camera", "thirdPerson");
    toggle("Crane alignment assist", "assist");
    toggle("Tutorial on Empty Land", "tutorialOn");
    panel.appendChild(el(`<h3>AUDIO</h3>`));
    for (const g of Config.AudioGroups) slider(g, () => s.volumes[g], (v) => (s.volumes[g] = v), 0, 1, 0.01, (v) => Math.round(v * 100) + "%");
  }

  buildControls(panel) {
    panel.appendChild(el(`<h2>CONTROLS</h2>`));
    for (const [title, rows] of CONTROLS) {
      panel.appendChild(el(`<h3>${title.toUpperCase()}</h3>`));
      const g = el(`<div class="keys"></div>`);
      for (const [a, k] of rows) g.appendChild(el(`<div><span>${a}</span><span>${k.split(" ").map((x) => (x.length <= 6 && x !== "/" && x !== "–" ? `<kbd>${x}</kbd>` : x)).join(" ")}</span></div>`));
      panel.appendChild(g);
    }
  }

  buildCredits(panel) {
    panel.appendChild(el(`<div class="credits"><h2>CREDITS</h2>
      <p><b>STEELRISE: Construction Simulator</b> — design, programming, models and sound.</p>
      <p>Every model in the game is built procedurally from code at load time: ${Registry.list.length} catalog items, the flat-top tower crane, delivery trucks, rail flatcars and the locomotive, and eight site environments. Textures are painted procedurally at startup and every sound is synthesised live with Web Audio — the game ships no third-party art, audio or fonts.</p>
      <p>Steel sections follow published AISC W-shape and HSS dimensions; crane behaviour (load chart, slew/trolley/hoist speeds, pendulum sway, wind limits) is modelled on modern 8–10 t flat-top city cranes.</p>
      <h3>BUILT WITH</h3><p>three.js (MIT) · Electron (MIT) · esbuild (MIT)</p>
      <h3>SAFETY NOTE</h3><p>This is a game. Real lifting operations need a qualified crane operator, a lift plan and a signaller.</p></div>`));
  }

  // ---------------------------------------------------------------------------
  // Pause menu
  // ---------------------------------------------------------------------------
  showPause() {
    if (this.pause) this.pause.remove();
    input.blocked = true;
    input.unlock();
    this.pause = el(`<div id="pause" class="overlay screen"><div class="panel"><div class="pausegrid"><nav>
      <button class="navbtn" data-p="resume">RESUME</button>
      <button class="navbtn" data-p="save">SAVE</button>
      <button class="navbtn" data-p="load">LOAD</button>
      <button class="navbtn" data-p="site">SITE & BLUEPRINT</button>
      <button class="navbtn" data-p="settings">SETTINGS</button>
      <button class="navbtn" data-p="controls">CONTROLS</button>
      <button class="navbtn" data-p="menu">MAIN MENU</button>
      <button class="navbtn" data-p="quit">QUIT TO DESKTOP</button>
      </nav><div class="body"></div></div></div></div>`);
    this.root.appendChild(this.pause);
    const body = this.pause.querySelector(".body");
    const open = (p) => {
      play("UIClick");
      this.pause.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("on", b.dataset.p === p));
      body.innerHTML = "";
      if (p === "resume") return this.hidePause();
      if (p === "menu") return this.app.toMenu();
      if (p === "quit") return this.app.quit();
      if (p === "save") this.buildSlots(body, "save");
      else if (p === "load") this.buildSlots(body, "load");
      else if (p === "settings") this.buildSettings(body);
      else if (p === "controls") this.buildControls(body);
      else if (p === "site") this.buildSitePanel(body);
    };
    this.pause.querySelectorAll(".navbtn").forEach((b) => (b.onclick = () => open(b.dataset.p)));
    open("site");
  }
  hidePause() {
    if (this.pause) this.pause.remove();
    this.pause = null;
    input.blocked = !!this.catalog;
    this.updateClickHint();
  }

  buildSitePanel(body) {
    const g = this.app.game;
    const site = g.site;
    const def = site.def;
    body.appendChild(el(`<h2>${esc(def.name)}</h2>`));
    body.appendChild(el(`<h3>BLUEPRINT</h3>`));
    const seg = el(`<div class="seg" style="flex-wrap:wrap"></div>`);
    const options = [];
    if (def.grid) options.push(["Site", "Site building"]);
    for (const bp of def.blueprints || []) options.push([bp.id, bp.name]);
    options.push([null, "None (free build)"]);
    for (const [id, name] of options) {
      const b = el(`<button>${esc(name)}</button>`);
      b.classList.toggle("on", (site.blueprint || null) === id);
      b.onclick = () => {
        site.setBlueprint(id);
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      };
      seg.appendChild(b);
    }
    body.appendChild(seg);
    body.appendChild(el(`<h3>TIME OF DAY</h3>`));
    const row = el(`<div class="setrow"><span>Clock</span><input type="range" min="0" max="24" step="0.1"><span class="val"></span></div>`);
    const r = row.querySelector("input");
    r.value = site.clock;
    const show = () => {
      const h = Math.floor(r.value), m = Math.round((r.value - h) * 60);
      row.querySelector(".val").textContent = `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    };
    r.oninput = () => {
      site.setClock(Number(r.value));
      show();
    };
    show();
    body.appendChild(row);
    body.appendChild(el(`<h3>DELIVERIES ON SITE</h3>`));
    const trucks = [...g.delivery.trailers.values()];
    if (!trucks.length) body.appendChild(el(`<p style="color:var(--muted);font-size:13px">No vehicles in the bays. Order materials from the catalog (Tab).</p>`));
    for (const t of trucks) {
      body.appendChild(el(`<div class="slot"><div class="n">${t.kind === "rail" ? "SIDING" : "BAY"} ${t.bay}</div><div class="d">${t.remaining} pieces<small>${t.manifest.map((m) => m.qty + " × " + esc(m.name)).join(" · ") || "Empty — walk up to the cab and press E to release it"}</small></div></div>`));
    }
    body.appendChild(el(`<h3>CRANE</h3>`));
    const rec = el(`<button class="btn ghost small">Recover crane hook / load</button>`);
    rec.onclick = () => {
      const res = g.crane.recover();
      this.toast(res.msg, res.ok ? "info" : "warn");
    };
    body.appendChild(rec);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  buildHud() {
    this.hud = el(`<div id="hud" class="hidden">
      <div id="task"><div class="site"></div><div class="next"></div><div class="bp"></div><div class="prog"><div></div></div></div>
      <div id="status"></div>
      <div id="crosshair"></div>
      <svg id="hold" class="hidden" viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="5"/><circle class="arc" cx="23" cy="23" r="19" fill="none" stroke="#ffc20e" stroke-width="5" stroke-dasharray="119.4" stroke-dashoffset="119.4" transform="rotate(-90 23 23)"/></svg>
      <div id="prompt"></div>
      <div id="placement" class="hidden"><div class="t"></div><div class="r"></div><div class="h"></div></div>
      <div id="carry" class="hidden"></div>
      <div id="hotbar"></div>
      <div id="cranehud" class="hidden"></div>
      <div id="flash" class="hidden"></div>
      <div id="tutorial" class="hidden interactive"><div class="h"><span class="step"></span><button>Skip tutorial</button></div><div class="tx"></div></div>
      <div id="clickhint" class="hidden">Click to look around · Esc for menu</div>
      <div id="toasts"></div></div>`);
    this.root.appendChild(this.hud);
    const bar = this.hud.querySelector("#hotbar");
    for (const id of Registry.ToolOrder) {
      const def = Registry.get(id);
      const b = el(`<div class="slotb" data-id="${id}"><span class="num">${def.hotkey}</span><img alt=""><span>${esc(def.name.replace("Gloved ", "").replace("Stick Welder ", "").replace("Concrete Pump ", "").replace("Crane Radio ", "").replace('1" ', ""))}</span></div>`);
      bar.appendChild(b);
    }
    this.hud.querySelector("#tutorial button").onclick = () => bus.emit("tutorialSkip");
  }
  showHud() {
    this.hud.classList.remove("hidden");
    this.hud.querySelectorAll(".slotb img").forEach((img) => {
      if (!img.src) img.src = itemThumb(img.parentElement.dataset.id);
    });
    this.updateClickHint();
  }
  hideHud() {
    this.hud.classList.add("hidden");
  }
  updateClickHint() {
    const show = this.screen === "play" && !input.locked && !this.pause && !this.catalog;
    this.hud.querySelector("#clickhint").classList.toggle("hidden", !show);
  }

  toast(text, kind = "info") {
    if (!text) return;
    const box = this.hud.querySelector("#toasts");
    // repeat of the newest message: just refresh it
    const last = this.toasts[this.toasts.length - 1];
    if (last && last.text === text && last.el.isConnected) {
      clearTimeout(last.timer);
      last.timer = setTimeout(() => last.el.remove(), 3800);
      return;
    }
    const t = el(`<div class="toast ${kind}"></div>`);
    t.textContent = text;
    box.appendChild(t);
    const rec = { text, el: t, timer: setTimeout(() => t.remove(), kind === "warn" ? 4500 : 3800) };
    this.toasts.push(rec);
    while (box.children.length > 4) box.firstChild.remove();
    if (this.toasts.length > 20) this.toasts.shift();
    if (this.screen !== "play" && this.hud.classList.contains("hidden")) {
      // menus: show toasts anyway
      this.hud.classList.remove("hidden");
      this.hud.querySelectorAll("#task,#status,#crosshair,#hotbar,#prompt").forEach((e) => e.classList.add("hidden"));
      setTimeout(() => {
        if (this.screen !== "play") {
          this.hud.classList.add("hidden");
          this.hud.querySelectorAll("#task,#status,#crosshair,#hotbar,#prompt").forEach((e) => e.classList.remove("hidden"));
        }
      }, 4000);
    }
  }

  setPrompt(list) {
    const box = this.hud.querySelector("#prompt");
    const key = JSON.stringify(list);
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    box.innerHTML = "";
    for (const p of list || []) {
      box.appendChild(el(`<div class="pr ${p.disabled ? "dis" : ""}">${p.key ? `<span class="k">${esc(p.key)}</span>` : ""}<div>${esc(p.text)}${p.sub ? `<small class="${p.warn ? "warn" : ""}">${esc(p.sub)}</small>` : ""}</div></div>`));
    }
  }
  setHold(a) {
    const svg = this.hud.querySelector("#hold");
    if (a === null || a === undefined) {
      svg.classList.add("hidden");
      return;
    }
    svg.classList.remove("hidden");
    svg.querySelector(".arc").setAttribute("stroke-dashoffset", String(119.4 * (1 - Math.min(1, a))));
  }
  setPlacement(d) {
    const p = this.hud.querySelector("#placement");
    if (!d) return p.classList.add("hidden");
    p.classList.remove("hidden");
    p.classList.toggle("ok", !!d.valid);
    p.querySelector(".t").textContent = d.title;
    p.querySelector(".r").textContent = d.valid ? d.okText || "✓ Valid — click to place" : "✕ " + (d.reason || "Can't place here.");
    p.querySelector(".h").textContent = d.hints || "";
  }
  setTool(id) {
    this.hud.querySelectorAll(".slotb").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  }
  setCarry(c) {
    const e = this.hud.querySelector("#carry");
    if (!c) return e.classList.add("hidden");
    e.classList.remove("hidden");
    e.textContent = `Carrying ${c.def.name} · ${fmtKg(c.def.weightKg)} · ${c.def.handling}`;
  }
  setProgress(p) {
    const g = this.app.game;
    if (!g.site.def) return;
    const t = this.hud.querySelector("#task");
    t.querySelector(".site").textContent = g.site.def.name.toUpperCase();
    t.querySelector(".next").textContent = p.next;
    const bpName = g.site.blueprint === "Site" ? "Site building" : (g.site.def.blueprints || []).find((b) => b.id === g.site.blueprint)?.name;
    t.querySelector(".bp").textContent = p.total ? `${bpName || "Blueprint"} · ${p.installed} / ${p.total} installed` : "No blueprint";
    t.querySelector(".prog div").style.width = p.total ? (100 * p.installed) / p.total + "%" : "0";
  }
  setStatus() {
    const g = this.app.game;
    const s = g.site;
    if (!s.def) return;
    const h = Math.floor(s.clock), m = Math.floor((s.clock - h) * 60);
    const wind = s.wind.speed;
    const windCol = wind > Config.Crane.WindStopMs ? "var(--invalid)" : wind > Config.Crane.WindWarnMs ? "var(--safety)" : "#fff";
    const html = `<b>${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}</b> · ${s.isNight() ? "Night" : "Day"}<br>Wind <span style="color:${windCol}">${wind.toFixed(1)} m/s</span><br>${g.delivery.trailers.size} vehicle${g.delivery.trailers.size === 1 ? "" : "s"} on site`;
    const st = this.hud.querySelector("#status");
    if (st.innerHTML !== html) st.innerHTML = html;
  }
  setCrane(d) {
    const c = this.hud.querySelector("#cranehud");
    const flash = this.hud.querySelector("#flash");
    this.hud.querySelector("#crosshair").classList.toggle("hidden", !!d && d.view !== "Player");
    if (!d) {
      c.classList.add("hidden");
      flash.classList.add("hidden");
      return;
    }
    c.classList.remove("hidden");
    const lmi = Math.min(d.lmi, 1.2);
    const col = d.lmi > 0.9 ? "var(--invalid)" : d.lmi > 0.75 ? "var(--safety)" : "var(--valid)";
    const windCol = d.windMs > Config.Crane.WindStopMs ? "var(--invalid)" : d.windMs > Config.Crane.WindWarnMs ? "var(--safety)" : "#fff";
    c.innerHTML = `<div class="title">TOWER CRANE · ${d.mode === "Cab" ? "CAB" : "RADIO REMOTE"} · ${d.view.toUpperCase()} VIEW${d.precision ? " · FINE" : ""}</div>
      <div class="row"><span>Radius</span><span>${d.radiusM.toFixed(1)} m</span></div>
      <div class="row"><span>Hook height</span><span>${d.heightM.toFixed(1)} m</span></div>
      <div class="row"><span>Slew</span><span>${((d.slewDeg + 360) % 360).toFixed(0)}°</span></div>
      <div class="row"><span>Load</span><span>${d.loadName ? esc(d.loadName.length > 30 ? d.loadName.slice(0, 29) + "…" : d.loadName) : "—"}</span></div>
      <div class="row"><span>Weight / capacity</span><span>${fmtKg(d.loadKg)} / ${fmtKg(d.capKg)}</span></div>
      <div class="lmi"><div style="width:${Math.min(100, lmi * 100)}%;background:${col}"></div></div>
      <div class="row"><span>Wind</span><span style="color:${windCol}">${d.windMs.toFixed(1)} m/s${d.windMs > Config.Crane.WindStopMs ? " — STOP" : ""}</span></div>
      <div class="row"><span>Assist</span><span>${d.assist ? "ON" : "OFF"}</span></div>
      <div class="guide ${d.guideReady ? "ready" : ""}">${esc(d.guide || "")}</div><div class="hint">${esc(d.hint)}</div>`;
    flash.classList.toggle("hidden", !d.flash);
    if (d.flash) flash.textContent = d.flash;
  }
  setTutorial(text, index, total) {
    const t = this.hud.querySelector("#tutorial");
    if (!text) return t.classList.add("hidden");
    t.classList.remove("hidden");
    t.querySelector(".step").textContent = `TUTORIAL ${index} / ${total}`;
    t.querySelector(".tx").textContent = text;
  }
}
