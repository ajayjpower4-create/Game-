// The only thing the page can reach in the main process: opening and saving a
// file the user picked in a dialog. No arbitrary paths, no node in the page.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gcc', {
  desktop: true,
  openFranchiseFile: () => ipcRenderer.invoke('file:open'),
  listSaves: (extraDirs) => ipcRenderer.invoke('saves:scan', extraDirs),
  readSave: (filePath) => ipcRenderer.invoke('saves:read', filePath),
  pickSaveFolder: () => ipcRenderer.invoke('saves:pickFolder'),
  searchSaves: (extraRoots) => ipcRenderer.invoke('saves:search', extraRoots),
  searchEverywhere: () => ipcRenderer.invoke('saves:searchEverywhere'),
  injuryList: () => ipcRenderer.invoke('franchise:injuries'),
  injurePlayer: (payload) => ipcRenderer.invoke('franchise:injure', payload),
  healPlayer: (playerRow) => ipcRenderer.invoke('franchise:heal', playerRow),
  reloadFranchise: () => ipcRenderer.invoke('franchise:reload'),
  saveFile: (name, text) => ipcRenderer.invoke('file:save', { name, text }),
  onMenu: (handler) => {
    for (const channel of ['menu:open', 'menu:save', 'menu:injury-script']) {
      ipcRenderer.on(channel, () => handler(channel.split(':')[1]));
    }
  },
});
