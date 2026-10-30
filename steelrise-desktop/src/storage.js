// Saves and settings. In the desktop app they are JSON files in the user's
// app-data folder (%APPDATA%/STEELRISE/saves on Windows); in a plain browser
// (tests) they fall back to localStorage.
//   meta.json   settings, favourites, slot summaries, last slot
//   slot0.json  autosave, slot1..3.json manual saves

import { Config } from "./core/config.js";

const host = typeof window !== "undefined" ? window.steelriseHost : null;

async function readRaw(name) {
  try {
    if (host) return await host.readSave(name);
    return localStorage.getItem("steelrise:" + name);
  } catch (e) {
    console.warn("[STEELRISE] read failed", name, e);
    return null;
  }
}
async function writeRaw(name, text) {
  if (host) return host.writeSave(name, text);
  localStorage.setItem("steelrise:" + name, text);
  return true;
}

function withDefaults(t, d) {
  const out = t && typeof t === "object" ? { ...t } : {};
  for (const k in d) {
    if (out[k] === undefined) out[k] = JSON.parse(JSON.stringify(d[k]));
    else if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k]) && typeof out[k] === "object") out[k] = withDefaults(out[k], d[k]);
  }
  return out;
}

export const Storage = {
  meta: null,
  persistent: !!host,

  async loadMeta() {
    let data = null;
    const raw = await readRaw("meta");
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }
    this.meta = withDefaults(data, { settings: Config.DefaultSettings, favorites: {}, slots: {}, lastSlot: -1 });
    return this.meta;
  },
  async saveMeta() {
    if (this.meta) await writeRaw("meta", JSON.stringify(this.meta));
  },

  async saveSlot(slot, data) {
    await writeRaw("slot" + slot, JSON.stringify(data));
    this.meta.slots[slot] = { site: data.site, savedAt: data.savedAt, installed: data.installed || 0, components: data.components.length };
    this.meta.lastSlot = slot;
    await this.saveMeta();
    return true;
  },
  async loadSlot(slot) {
    const raw = await readRaw("slot" + slot);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      return d && d.site ? d : null;
    } catch {
      return null;
    }
  },
  async savePath() {
    try {
      return host ? await host.savePath() : "browser storage";
    } catch {
      return "";
    }
  },
};
