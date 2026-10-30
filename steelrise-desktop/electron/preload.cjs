// Narrow bridge between the game page and the file system (saves only).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("steelriseHost", {
  listSaves: () => ipcRenderer.invoke("save:list"),
  readSave: (name) => ipcRenderer.invoke("save:read", name),
  writeSave: (name, text) => ipcRenderer.invoke("save:write", name, text),
  quit: () => ipcRenderer.invoke("app:quit"),
  toggleFullscreen: () => ipcRenderer.invoke("app:fullscreen"),
  savePath: () => ipcRenderer.invoke("app:savePath"),
});
