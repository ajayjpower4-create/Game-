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

// Where Madden saves end up on a PC. Documents is only one of them: with EA's
// cloud saves the copy on disk lives in the EA app's sync cache, Steam keeps
// its own cloud mirror, and the Game Pass build hides saves under a folder of
// GUIDs. So check all of it, and when that still comes up empty, search.
const MADDEN_YEARS = ['26', '25', '24'];

function saveDirCandidates() {
  const home = os.homedir();
  const env = process.env;
  const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const dirs = [];

  const docRoots = [
    path.join(home, 'Documents'),
    path.join(home, 'OneDrive', 'Documents'),
    path.join(home, 'OneDrive - Personal', 'Documents'),
  ];
  for (const root of docRoots) {
    for (const year of MADDEN_YEARS) {
      dirs.push({ dir: path.join(root, `Madden NFL ${year}`, 'settings'), label: `Madden NFL ${year}` });
      dirs.push({ dir: path.join(root, `Madden NFL ${year}`), label: `Madden NFL ${year}` });
    }
    dirs.push({ dir: path.join(root, 'Gridiron Control Center'), label: 'Control Center saves' });
  }

  // EA cloud sync — the EA app and, on older installs, Origin.
  dirs.push({ dir: path.join(localAppData, 'Electronic Arts', 'EA Desktop', 'CloudSyncCache'), label: 'EA cloud sync' });
  dirs.push({ dir: path.join(appData, 'Electronic Arts', 'EA Desktop', 'CloudSyncCache'), label: 'EA cloud sync' });
  dirs.push({ dir: path.join(localAppData, 'Origin', 'CloudSync'), label: 'Origin cloud sync' });
  dirs.push({ dir: path.join(appData, 'Origin', 'LocalContent'), label: 'Origin' });
  dirs.push({ dir: path.join(home, 'Saved Games'), label: 'Saved Games' });

  dirs.push({ dir: path.join(home, 'Downloads'), label: 'Downloads' });
  dirs.push({ dir: path.join(home, 'Desktop'), label: 'Desktop' });
  return dirs;
}

// Roots worth walking when the known folders come up empty. Ordered: the
// likely places first, so a time-limited search spends its budget well.
function searchRoots() {
  const home = os.homedir();
  const env = process.env;
  const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const roots = [
    { dir: path.join(localAppData, 'Electronic Arts'), label: 'EA app', depth: 7 },
    { dir: path.join(appData, 'Electronic Arts'), label: 'EA app', depth: 7 },
    { dir: path.join(localAppData, 'Origin'), label: 'Origin', depth: 7 },
    { dir: path.join(localAppData, 'Packages'), label: 'Game Pass / Xbox app', depth: 8 },
    { dir: path.join(home, 'Documents'), label: 'Documents', depth: 5 },
    { dir: path.join(home, 'OneDrive'), label: 'OneDrive', depth: 6 },
    { dir: path.join(home, 'Saved Games'), label: 'Saved Games', depth: 5 },
    { dir: path.join(home, 'Downloads'), label: 'Downloads', depth: 3 },
  ];
  // Steam's cloud mirror, on whatever drive Steam landed on.
  for (const drive of ['C:', 'D:', 'E:', 'F:']) {
    roots.push({ dir: path.join(drive + path.sep, 'Program Files (x86)', 'Steam', 'userdata'), label: 'Steam cloud', depth: 6 });
    roots.push({ dir: path.join(drive + path.sep, 'Steam', 'userdata'), label: 'Steam cloud', depth: 6 });
    roots.push({ dir: path.join(drive + path.sep, 'SteamLibrary', 'userdata'), label: 'Steam cloud', depth: 6 });
  }
  return roots;
}

// Folders that never hold a save and cost real time to walk.
const SKIP_DIRS = /^(windows|\$recycle\.bin|system volume information|node_modules|program files|programdata|temp|tmp|cache2|inetcache|webcache|\.git)$/i;

// What kind of file this is, and whether this build can actually read it.
function classify(name, fullPath = '') {
  const lower = name.toLowerCase();
  if (/^careersave/i.test(name)) return { kind: 'Franchise save', readable: false, binary: true };
  if (/^rostersave/i.test(name)) return { kind: 'Roster save', readable: false, binary: true };
  if (lower.endsWith('.json')) return { kind: 'Export (JSON)', readable: true, binary: false };
  if (lower.endsWith('.csv')) return { kind: 'Export (CSV)', readable: true, binary: false };
  // Game Pass and the cloud caches rename saves to GUIDs, so in those folders
  // judge by where the file is rather than what it's called.
  const p = fullPath.toLowerCase();
  if (/[\\/]wgs[\\/]/.test(p) || p.includes('cloudsynccache') || p.includes('cloudsync')) {
    return { kind: 'Possible cloud save', readable: false, binary: true, guess: true };
  }
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
    const info = classify(entry.name, path.join(dir, entry.name));
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

/**
 * Walk the likely roots looking for saves. Bounded by a clock and a folder
 * budget rather than by faith in any one path, because where EA puts a cloud
 * save moves around between the EA app, Steam and Game Pass.
 */
async function deepSearch({ roots, budgetMs = 25000, maxDirs = 20000, minSize = 64 * 1024 }) {
  const deadline = Date.now() + budgetMs;
  const found = [];
  const seenDirs = new Set();
  let dirsWalked = 0;
  let stoppedEarly = false;

  for (const root of roots) {
    // Breadth-first per root, so the shallow, likely folders come first.
    let queue = [{ dir: root.dir, depth: 0 }];
    while (queue.length) {
      if (Date.now() > deadline || dirsWalked >= maxDirs) { stoppedEarly = true; break; }
      const { dir, depth } = queue.shift();
      const key = dir.toLowerCase();
      if (seenDirs.has(key)) continue;
      seenDirs.add(key);

      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); }
      catch { continue; }                   // no permission, or gone: move on
      dirsWalked++;

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (depth >= root.depth || SKIP_DIRS.test(entry.name)) continue;
          queue.push({ dir: full, depth: depth + 1 });
          continue;
        }
        if (!entry.isFile()) continue;
        const info = classify(entry.name, full);
        if (!info) continue;
        let stat;
        try { stat = await fs.stat(full); } catch { continue; }
        // A franchise is megabytes. Anything tiny in a cloud cache is
        // bookkeeping, not a save.
        if (info.guess && stat.size < minSize) continue;
        allowedDirs.add(dir);
        found.push({ ...info, name: entry.name, path: full, dir, label: root.label, size: stat.size, modified: stat.mtimeMs });
      }
    }
    if (Date.now() > deadline || dirsWalked >= maxDirs) { stoppedEarly = true; break; }
  }

  const seen = new Set();
  return {
    stoppedEarly,
    dirsWalked,
    files: found
      .filter((f) => (seen.has(f.path) ? false : seen.add(f.path)))
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 200),
  };
}

ipcMain.handle('saves:search', async (_e, extraRoots = []) => {
  const roots = [
    ...searchRoots(),
    ...extraRoots.map((dir) => ({ dir, label: path.basename(dir) || dir, depth: 6 })),
  ];
  return deepSearch({ roots });
});

// Every drive on the machine, walked shallowly. This is the last resort, and
// it is slow, so the page only offers it after the targeted search finds
// nothing.
ipcMain.handle('saves:searchEverywhere', async () => {
  const drives = [];
  for (const letter of 'CDEFGHIJ') {
    const dir = `${letter}:${path.sep}`;
    try { await fs.access(dir); drives.push({ dir, label: `${letter}: drive`, depth: 6 }); }
    catch { /* no such drive */ }
  }
  return deepSearch({ roots: drives, budgetMs: 90000, maxDirs: 120000 });
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
