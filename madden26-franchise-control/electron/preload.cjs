const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('m26', {
  isElectron: true,
  pickFranchiseFile: () => ipcRenderer.invoke('pick-franchise-file'),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  serverInfo: () => ipcRenderer.invoke('server-info'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  onMenuOpenFile: (cb) => ipcRenderer.on('menu:open-file', cb),
});
