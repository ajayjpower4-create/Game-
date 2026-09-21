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
  require('./tracker.js').setBaseDir(app.getPath('userData'));
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
// Madden names its franchise saves CAREER-<something>: CAREER-SEP12-04h14m57p-AUTOSAVE,
// CAREER-EE-AUTOSAVE, CAREER-EE. Autosaves and manual saves both land here.
const CAREER_FILE = /^CAREER([-_.]|$)/i;

function classify(name, fullPath = '', size = Infinity) {
  const lower = name.toLowerCase();
  if (CAREER_FILE.test(name)) {
    return {
      kind: /autosave/i.test(name) ? 'Franchise autosave' : 'Franchise save',
      readable: true, madden: true, binary: true,
    };
  }
  if (/^rostersave/i.test(name) || /^roster([-_.]|$)/i.test(name)) {
    return { kind: 'Roster file', readable: false, binary: true };
  }
  // An export worth listing is a real one. The Game Pass folders are full of
  // half-kilobyte .json bookkeeping that is not anybody's franchise.
  if (lower.endsWith('.json') || lower.endsWith('.csv')) {
    if (size < 8 * 1024) return null;
    return { kind: lower.endsWith('.json') ? 'Export (JSON)' : 'Export (CSV)', readable: true, binary: false };
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
    const full = path.join(dir, entry.name);
    let stat;
    try { stat = await fs.stat(full); } catch { continue; }
    const info = classify(entry.name, full, stat.size);
    if (!info) continue;
    if (exportsOnly && info.binary) continue;
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
        let stat;
        try { stat = await fs.stat(full); } catch { continue; }
        const info = classify(entry.name, full, stat.size);
        if (!info) continue;
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
  const stat = await fs.stat(filePath);
  const info = classify(path.basename(filePath), filePath, stat.size);
  if (!info) return { error: 'Not a save or an export.' };
  if (info.madden) return openMaddenFile(filePath);
  if (info.binary) return { error: `${path.basename(filePath)} is a Madden file this app does not read.` };
  return { binary: false, name: path.basename(filePath), size: stat.size, text: await fs.readFile(filePath, 'utf8') };
});

/* ------------------------------------------------------- real franchise file */

// The franchise file currently open, kept so injuries can be written back to
// the same handle instead of reparsing 8 MB on every click.
let openFranchise = null;

async function openMaddenFile(filePath) {
  const { openFranchiseFile } = require('./madden-file.js');
  try {
    const result = await openFranchiseFile(filePath);
    openFranchise = { file: result.file, path: filePath, data: result.data };
    // Record this read into the tracker's own history before anything else
    // touches the file.
    try {
      const tracked = await trackFranchise(result);
      result.report.notes.push(`Tracker holds ${tracked.counts.games} games and ${tracked.counts.lines} player game lines.`);
    } catch (err) {
      result.report.notes.push(`Tracker could not record this read: ${err.message}`);
    }
    return {
      madden: true,
      name: path.basename(filePath),
      filePath,
      meta: result.meta,
      data: result.data,
      report: result.report,
    };
  } catch (err) {
    // Say what actually failed, and enough about the file to act on it.
    let detail = '';
    try {
      const stat = await fs.stat(filePath);
      const handle = await fs.open(filePath, 'r');
      const head = Buffer.alloc(8);
      await handle.read(head, 0, 8, 0);
      await handle.close();
      detail = ` (${path.basename(filePath)}, ${(stat.size / 1048576).toFixed(1)} MB, starts ${head.toString('hex')})`;
    } catch { /* the message alone will have to do */ }
    return { error: `Could not read that franchise file: ${err.message}${detail}` };
  }
}

// Every write is preceded by a copy of the save, named with the time, so a bad
// injury is never the end of somebody's franchise.
async function backupFranchise(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = `${filePath}.gcc-backup-${stamp}`;
  await fs.copyFile(filePath, backup);
  return backup;
}

/**
 * Read every per-game line out of the save and fold it into the tracker's
 * history. Madden ages games out of the file; the history does not.
 */
async function trackFranchise(result) {
  const { readGameLines, readTeamGameStats } = require('./madden-file.js');
  const tracker = require('./tracker.js');
  const { lines } = await readGameLines(result.file, result.data);
  const teamGames = await readTeamGameStats(result.file, result.data.teams);
  const history = await tracker.loadHistory(openFranchise.path);
  tracker.foldIn(history, { lines, teamGames, week: result.data.week, year: result.data.year });
  await tracker.saveHistory(openFranchise.path, history);
  return tracker.readOut(history);
}

ipcMain.handle('tracker:read', async () => {
  if (!openFranchise) return { error: 'No franchise file is open.' };
  const tracker = require('./tracker.js');
  return tracker.readOut(await tracker.loadHistory(openFranchise.path));
});

ipcMain.handle('franchise:injuries', async () => {
  const { INJURIES } = require('./madden-file.js');
  return INJURIES;
});

ipcMain.handle('franchise:injure', async (_e, payload) => {
  if (!openFranchise) return { error: 'No franchise file is open.' };
  const { writeInjury } = require('./madden-file.js');
  try {
    const backup = await backupFranchise(openFranchise.path);
    const result = await writeInjury(openFranchise.file, payload);
    return { ok: true, backup, ...result };
  } catch (err) {
    return { error: `Could not write that injury: ${err.message}` };
  }
});

ipcMain.handle('franchise:heal', async (_e, playerRow) => {
  if (!openFranchise) return { error: 'No franchise file is open.' };
  const { clearInjury } = require('./madden-file.js');
  try {
    const backup = await backupFranchise(openFranchise.path);
    await clearInjury(openFranchise.file, playerRow);
    return { ok: true, backup };
  } catch (err) {
    return { error: `Could not clear that injury: ${err.message}` };
  }
});

ipcMain.handle('franchise:reload', async () => {
  if (!openFranchise) return { error: 'No franchise file is open.' };
  return openMaddenFile(openFranchise.path);
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
    title: 'Open your franchise file',
    // Madden's saves have no extension at all, so All files comes first —
    // filtering by extension is exactly what hides CAREER-… from the picker.
    filters: [
      { name: 'All files', extensions: ['*'] },
      { name: 'Exports', extensions: ['json', 'csv', 'txt'] },
    ],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const file = res.filePaths[0];

  // Whatever it is called, try it as a franchise file first: a save the user
  // picked by hand is the one case where the name tells us nothing.
  const stat = await fs.stat(file);
  const info = classify(path.basename(file), file, stat.size);
  if (!info || info.madden || info.binary) {
    allowedDirs.add(path.dirname(file));
    const opened = await openMaddenFile(file);
    if (!opened.error) return opened;
    if (info && !info.binary) return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
    return opened;                                    // carries the reason it failed
  }
  return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
});

ipcMain.handle('file:save', async (_e, { name, text }) => {
  const res = await dialog.showSaveDialog(win, { title: 'Save', defaultPath: name });
  if (res.canceled || !res.filePath) return false;
  await fs.writeFile(res.filePath, text, 'utf8');
  return true;
});
