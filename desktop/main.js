// Desktop shell. The whole Control Center is the same page the web build
// serves; Electron just wraps it in a window and hands it real file dialogs so
// "open the exe, connect your franchise file" is one click each.

const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } = require('electron');
const fs = require('fs/promises');
const os = require('os');
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

/* ------------------------------------------------------------- save finder */

// Where Madden keeps its saves on a PC. Documents can be redirected into
// OneDrive, and people keep last year's copy around, so check all of it and
// let the list sort itself out by date.
const MADDEN_YEARS = ['26', '25', '24'];

function saveDirCandidates() {
  const home = os.homedir();
  const docRoots = [
    path.join(home, 'Documents'),
    path.join(home, 'OneDrive', 'Documents'),
    path.join(home, 'OneDrive - Personal', 'Documents'),
  ];
  const dirs = [];
  for (const root of docRoots) {
    for (const year of MADDEN_YEARS) {
      dirs.push({ dir: path.join(root, `Madden NFL ${year}`, 'settings'), label: `Madden NFL ${year}` });
      dirs.push({ dir: path.join(root, `Madden NFL ${year}`), label: `Madden NFL ${year}` });
    }
    dirs.push({ dir: path.join(root, 'Gridiron Control Center'), label: 'Control Center saves' });
  }
  dirs.push({ dir: path.join(home, 'Downloads'), label: 'Downloads' });
  dirs.push({ dir: path.join(home, 'Desktop'), label: 'Desktop' });
  return dirs;
}

// What kind of file this is, and whether this build can actually read it.
function classify(name) {
  const lower = name.toLowerCase();
  if (/^careersave/i.test(name)) return { kind: 'Franchise save', readable: false, binary: true };
  if (/^rostersave/i.test(name)) return { kind: 'Roster save', readable: false, binary: true };
  if (lower.endsWith('.json')) return { kind: 'Export (JSON)', readable: true, binary: false };
  if (lower.endsWith('.csv')) return { kind: 'Export (CSV)', readable: true, binary: false };
  return null;
}

// Only files that turned up in a scan, or in a folder the user picked, may be
// read — the page never gets to name an arbitrary path.
const allowedDirs = new Set();

async function scanDir({ dir, label }, { exportsOnly = false, limit = 40 } = {}) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }                       // folder isn't there: nothing to say
  allowedDirs.add(dir);
  const out = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const info = classify(entry.name);
    if (!info) continue;
    if (exportsOnly && info.binary) continue;
    const full = path.join(dir, entry.name);
    let stat;
    try { stat = await fs.stat(full); } catch { continue; }
    out.push({ ...info, name: entry.name, path: full, dir, label, size: stat.size, modified: stat.mtimeMs });
  }
  return out.sort((a, b) => b.modified - a.modified).slice(0, limit);
}

ipcMain.handle('saves:scan', async (_e, extraDirs = []) => {
  const candidates = [
    ...saveDirCandidates(),
    ...extraDirs.map((dir) => ({ dir, label: path.basename(dir) || dir })),
  ];
  const found = [];
  for (const c of candidates) {
    // Downloads and Desktop are somebody's whole life — only take exports there.
    const loose = /Downloads|Desktop/.test(c.label);
    found.push(...await scanDir(c, { exportsOnly: loose, limit: loose ? 15 : 40 }));
  }
  const seen = new Set();
  return found
    .filter((f) => (seen.has(f.path) ? false : seen.add(f.path)))
    .sort((a, b) => b.modified - a.modified);
});

ipcMain.handle('saves:read', async (_e, filePath) => {
  if (!allowedDirs.has(path.dirname(filePath))) return { error: 'That file is outside the folders this app scanned.' };
  const info = classify(path.basename(filePath));
  if (!info) return { error: 'Not a save or an export.' };
  const stat = await fs.stat(filePath);
  if (info.binary) {
    // Read the head so the app can say what it is, not so it can pretend to
    // understand it — the binary save format is not parsed in this build.
    const handle = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(16);
    await handle.read(buf, 0, 16, 0);
    await handle.close();
    return { binary: true, name: path.basename(filePath), size: stat.size, head: buf.toString('hex') };
  }
  return { binary: false, name: path.basename(filePath), size: stat.size, text: await fs.readFile(filePath, 'utf8') };
});

ipcMain.handle('saves:pickFolder', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Pick the folder your saves are in',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  allowedDirs.add(res.filePaths[0]);
  return res.filePaths[0];
});

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
