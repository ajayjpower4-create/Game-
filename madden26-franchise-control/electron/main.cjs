// Electron entry point: starts the local server, opens the window, gives the
// page native file dialogs, and hosts the EA sign-in window.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, safeStorage } = require('electron');
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
  // The EA sign-in is sealed with the operating system keychain before it is saved.
  const secretBox = {
    available: safeStorage.isEncryptionAvailable(),
    encrypt: (str) => safeStorage.encryptString(str).toString('base64'),
    decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
  };
  const options = { host: '0.0.0.0', dataDir: process.env.M26FC_DATA_DIR, secretBox, log: (...a) => console.log(...a) };
  try {
    serverInfo = await startServer({ port, ...options });
  } catch (e) {
    // Port busy: fall back to any free port so the app still opens.
    serverInfo = await startServer({ port: 0, ...options });
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

// Opens EA's own sign-in page in its own window. When EA finishes, it sends the
// browser to a local address that nothing listens on; this window catches that
// address and hands it to the page. The password is typed on EA's page only.
const EA_DONE_PREFIX = 'http://127.0.0.1/success';
ipcMain.handle('ea-login', (event, url) => new Promise((resolve) => {
  const win = new BrowserWindow({
    width: 560,
    height: 760,
    parent: mainWindow,
    title: 'Sign in with EA',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'persist:ea-login' },
  });
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    resolve(result);
    if (!win.isDestroyed()) win.close();
  };
  const isDone = (u) => typeof u === 'string' && u.startsWith(EA_DONE_PREFIX);
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    if (isDone(details.url)) { callback({ cancel: true }); finish({ url: details.url }); return; }
    callback({});
  });
  win.webContents.on('will-redirect', (e, u) => { if (isDone(u)) { e.preventDefault(); finish({ url: u }); } });
  win.webContents.on('will-navigate', (e, u) => { if (isDone(u)) { e.preventDefault(); finish({ url: u }); } });
  win.webContents.on('did-fail-load', (e, code, desc, u) => { if (isDone(u)) finish({ url: u }); });
  win.on('closed', () => finish({ canceled: true }));
  win.loadURL(url);
}));

ipcMain.handle('server-info', () => ({ port: serverInfo.port, urls: serverInfo.urls, lan: serverInfo.lan, dataDir: process.env.M26FC_DATA_DIR, version: app.getVersion() }));
ipcMain.handle('open-path', (e, p) => shell.openPath(p));

app.whenReady().then(async () => {
  await startBackend();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
