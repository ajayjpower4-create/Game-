// Desktop shell. The whole Control Center is the same page the web build
// serves; Electron just wraps it in a window and hands it real file dialogs so
// "open the exe, connect your franchise file" is one click each.

const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');

let win = null;

const UI_DIR = path.join(__dirname, 'ui');

// The UI is ES modules, and Chromium refuses to load those over file:// — so
// the app serves itself over its own scheme instead of loadFile().
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function serveUi() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.join(UI_DIR, rel);
    // Never serve anything outside ui/, whatever the URL asks for.
    if (!file.startsWith(UI_DIR + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    backgroundColor: '#0a0e17',
    title: 'Gridiron Control Center',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL('app://local/index.html');

  // Links to anything outside the app open in the real browser, not in here.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

const menu = Menu.buildFromTemplate([
  {
    label: 'Franchise',
    submenu: [
      { label: 'Connect franchise file…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu:open') },
      { label: 'Save franchise…', accelerator: 'CmdOrCtrl+S', click: () => win && win.webContents.send('menu:save') },
      { label: 'Export injury script…', click: () => win && win.webContents.send('menu:injury-script') },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
]);

app.whenReady().then(() => {
  serveUi();
  Menu.setApplicationMenu(menu);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ------------------------------------------------------------- file bridge */

ipcMain.handle('file:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Connect your franchise file',
    filters: [
      { name: 'Franchise exports', extensions: ['json', 'csv', 'txt'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const file = res.filePaths[0];
  return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
});

ipcMain.handle('file:save', async (_e, { name, text }) => {
  const res = await dialog.showSaveDialog(win, { title: 'Save', defaultPath: name });
  if (res.canceled || !res.filePath) return false;
  await fs.writeFile(res.filePath, text, 'utf8');
  return true;
});
