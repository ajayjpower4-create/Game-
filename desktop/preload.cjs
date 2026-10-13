/* Hands the game what is in the mods folders before any of its scripts run:
 * graphics overrides, the mod scripts to load, and any file that would not
 * parse. The game reads it as window.BUILDING_SIM_MODS. */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BUILDING_SIM_MODS', ipcRenderer.sendSync('building-sim:mods'));
