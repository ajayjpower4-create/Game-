// The Tab catalog: every item with a rendered thumbnail, search, categories,
// favourites, details and ordering (truck, or rail where the site has a
// siding). Ordered pieces arrive physically on the vehicle.

import { fmtKg } from "../core/math.js";
import { Registry } from "../data/items.js";
import { Storage } from "../storage.js";
import { input } from "../core/input.js";
import { requestThumb, itemThumb, clearThumbQueue } from "./previews.js";
import { play } from "../audio/audio.js";

const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const CLASS_TAG = { Installable: "", Equipment: "EQUIP", Decorative: "PROP", Tool: "TOOL" };

export class Catalog {
  constructor(ui) {
    this.ui = ui;
    this.app = ui.app;
    this.category = "All";
    this.query = "";
    this.favOnly = false;
    this.selected = null;
    this.qty = 1;
  }

  open() {
    const ui = this.ui;
    input.blocked = true;
    input.unlock();
    ui.catalog = this;
    this.root = el(`<div id="catalog" class="overlay screen"><div class="panel">
      <div class="top"><h2>CATALOG</h2><input type="search" placeholder="Search ${Registry.list.length} items — name, size, profile…"><button class="btn ghost small fav">★ Favourites</button><button class="btn ghost small close">Close (Tab)</button></div>
      <div class="cats"></div><div class="grid"></div><div class="detail"></div></div></div>`);
    ui.root.appendChild(this.root);
    const search = this.root.querySelector("input");
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.renderGrid();
    };
    search.addEventListener("keydown", (e) => {
      if (e.code === "Tab" || e.code === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    this.root.querySelector(".close").onclick = () => this.close();
    const favBtn = this.root.querySelector(".fav");
    favBtn.classList.toggle("on", this.favOnly);
    favBtn.onclick = () => {
      this.favOnly = !this.favOnly;
      favBtn.style.borderColor = this.favOnly ? "var(--safety)" : "";
      this.renderGrid();
    };
    this.renderCats();
    this.renderGrid();
    this.renderDetail();
    setTimeout(() => search.focus(), 0);
  }

  close() {
    clearThumbQueue();
    if (this.root) this.root.remove();
    this.root = null;
    this.ui.catalog = null;
    input.blocked = !!this.ui.pause;
    this.ui.updateClickHint();
  }

  favs() {
    return Storage.meta.favorites;
  }

  renderCats() {
    const box = this.root.querySelector(".cats");
    box.innerHTML = "";
    const counts = {};
    for (const d of Registry.list) counts[d.category] = (counts[d.category] || 0) + 1;
    for (const c of ["All", ...Registry.Categories]) {
      const b = el(`<button>${esc(c)}<span>${c === "All" ? Registry.list.length : counts[c] || 0}</span></button>`);
      b.classList.toggle("on", c === this.category);
      b.onclick = () => {
        play("UIClick");
        this.category = c;
        this.renderCats();
        this.renderGrid();
      };
      box.appendChild(b);
    }
  }

  renderGrid() {
    clearThumbQueue();
    const grid = this.root.querySelector(".grid");
    grid.innerHTML = "";
    const list = Registry.search(this.query, this.category, this.favs(), this.favOnly);
    if (!list.length) grid.appendChild(el(`<div style="color:var(--muted);padding:20px">Nothing matches.</div>`));
    const frag = document.createDocumentFragment();
    for (const def of list) {
      const card = el(`<div class="card"><img class="th" alt=""><div class="nm">${esc(def.name)}</div>${CLASS_TAG[def.class] ? `<span class="cls">${CLASS_TAG[def.class]}</span>` : ""}${this.favs()[def.id] ? `<span class="fav">★</span>` : ""}</div>`);
      card.classList.toggle("on", this.selected === def.id);
      card.onclick = () => {
        play("UIClick");
        this.selected = def.id;
        this.qty = 1;
        grid.querySelectorAll(".card").forEach((c) => c.classList.toggle("on", c === card));
        this.renderDetail();
      };
      card.ondblclick = () => this.order("truck");
      frag.appendChild(card);
      requestThumb(card.querySelector("img"), def.id);
    }
    grid.appendChild(frag);
  }

  renderDetail() {
    const box = this.root.querySelector(".detail");
    const def = this.selected && Registry.get(this.selected);
    const g = this.app.game;
    const trucks = [...g.delivery.trailers.values()];
    const truckInfo = `<div class="trucks"><b style="color:var(--text)">Unloading bays</b><br>${trucks.length ? trucks.map((t) => `${t.kind === "rail" ? "Siding" : "Bay"} ${t.bay}: ${t.remaining} piece${t.remaining === 1 ? "" : "s"}${t.empty ? " — empty, release it at the cab (E)" : ""}`).join("<br>") : "All bays free"}</div>`;
    if (!def) {
      box.innerHTML = `<p style="color:var(--muted)">Select an item to see its details and order it. Heavy pieces arrive strapped on a flatbed in an unloading bay; light pieces can be carried by hand.</p>${truckInfo}`;
      return;
    }
    const s = def.sizeM;
    const fav = !!this.favs()[def.id];
    const rail = (g.siteDef.railSpots || []).length > 0;
    box.innerHTML = `<img class="th" src="${itemThumb(def.id)}" alt="">
      <h3>${esc(def.name)}</h3>
      <div class="kv"><span>Category</span><span>${esc(def.category)}</span><span>Type</span><span>${esc(Registry.Classes[def.class])}</span>
      <span>Size</span><span>${s.x.toFixed(2)} × ${s.z.toFixed(2)} × ${s.y.toFixed(2)} m</span><span>Weight</span><span>${fmtKg(def.weightKg)}</span>
      <span>Handling</span><span>${esc(def.handling)}</span>${def.fasteners.length ? `<span>Connections</span><span>${def.fasteners.length} × ${esc(def.fasteners[0].type.toLowerCase())}</span>` : ""}</div>
      <p>${esc(def.description)}</p>
      ${def.deliverable ? `<div class="order"><div class="qty"><button class="m">−</button><span>${this.qty}</span><button class="p">+</button></div><button class="btn small truck">ORDER BY TRUCK</button>${rail ? `<button class="btn ghost small rail">BY RAIL</button>` : ""}</div>` : def.kind === "Tool" ? `<p style="color:var(--safety)">Hand tool — select it on the hotbar (${def.hotkey}).</p>` : `<p style="color:var(--safety)">Made on site (pour with the pump hose).</p>`}
      <div class="order"><button class="btn ghost small favb">${fav ? "★ Remove favourite" : "☆ Add favourite"}</button></div>${truckInfo}`;
    const maxQty = def.weightClass === "Light" ? 40 : def.weightClass === "Medium" ? 16 : 10;
    const q = box.querySelector(".qty span");
    box.querySelector(".m")?.addEventListener("click", () => ((this.qty = Math.max(1, this.qty - 1)), (q.textContent = this.qty)));
    box.querySelector(".p")?.addEventListener("click", () => ((this.qty = Math.min(maxQty, this.qty + 1)), (q.textContent = this.qty)));
    box.querySelector(".truck")?.addEventListener("click", () => this.order("truck"));
    box.querySelector(".rail")?.addEventListener("click", () => this.order("rail"));
    box.querySelector(".favb").onclick = async () => {
      if (fav) delete this.favs()[def.id];
      else this.favs()[def.id] = true;
      await Storage.saveMeta();
      this.renderDetail();
      this.renderGrid();
    };
  }

  order(mode) {
    if (!this.selected) return;
    const r = this.app.game.delivery.request(this.selected, this.qty, mode);
    play("UIClick");
    this.ui.toast(r.msg, r.ok ? "success" : "warn");
    if (r.ok) this.close();
  }
}
