// Electron entry point: starts the local server, opens the window, and gives
// the page a native "pick a franchise file" dialog.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

let serverInfo = null;
let mainWindow = null;

function maddenSettingsDir() {
  const docs = path.join(os.homedir(), 'Documents');
  for (const name of ['Madden NFL 26', 'Madden NFL 27', 'Madden NFL 25']) {
    const p = path.join(docs, name, 'settings');
    if (fs.existsSync(p)) return p;
  }
  return docs;
}

async function startBackend() {
  process.env.M26FC_VERSION = app.getVersion();
  if (!process.env.M26FC_DATA_DIR) process.env.M26FC_DATA_DIR = path.join(app.getPath('userData'), 'data');
  const { startServer } = await import('../src/server/start.js');
  const { Store } = await import('../src/core/store.js');
  const store = new Store(process.env.M26FC_DATA_DIR);
  const port = Number(store.getSettings().port) || 3826;
  try {
    serverInfo = await startServer({ port, host: '0.0.0.0', dataDir: process.env.M26FC_DATA_DIR, log: (...a) => console.log(...a) });
  } catch (e) {
    // Port busy: fall back to any free port so the app still opens.
    serverInfo = await startServer({ port: 0, host: '0.0.0.0', dataDir: process.env.M26FC_DATA_DIR, log: (...a) => console.log(...a) });
  }
  return serverInfo;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: 'Madden 26 Franchise Control',
    backgroundColor: '#0f1115',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(`http://127.0.0.1:${serverInfo.port}/`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ label: 'Open Franchise File…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu:open-file') }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [{ label: 'Show data folder', click: () => shell.openPath(process.env.M26FC_DATA_DIR) }] },
  ]));
}

ipcMain.handle('pick-franchise-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open a Madden NFL 26 franchise file',
    defaultPath: maddenSettingsDir(),
    properties: ['openFile'],
    filters: [{ name: 'Madden franchise files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
ipcMain.handle('server-info', () => ({ port: serverInfo.port, urls: serverInfo.urls, lan: serverInfo.lan, dataDir: process.env.M26FC_DATA_DIR, version: app.getVersion() }));
ipcMain.handle('open-path', (e, p) => shell.openPath(p));

app.whenReady().then(async () => {
  await startBackend();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
