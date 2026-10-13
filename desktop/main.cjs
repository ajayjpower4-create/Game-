/* Building Design Simulator — the desktop (Windows .exe) build.
 *
 * Electron runs exactly the game the website serves, from files packed inside
 * the app, over a private app:// scheme (ES modules need a real origin, and
 * saves in localStorage stay put from one version to the next).
 *
 * Mods: a "mods" folder sits next to the .exe (and a second one in the
 * user's AppData folder). graphics.json in it overrides the graphics settings
 * (anything from shadow-map size to supersampling, past what the in-game
 * presets allow), and every .js file in it is loaded as a mod once the game
 * has started. See mods-template/README.txt. */

const { app, BrowserWindow, Menu, protocol, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const GAME_DIR = path.join(__dirname, 'app');
const TEMPLATE_DIR = path.join(__dirname, 'mods-template');
const SCHEME = 'app';
const HOME = `${SCHEME}://game/building/`;

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

/* ------------------------------------------------------------ mod folders */

/** Where the .exe really lives (a portable .exe runs from a temp copy). */
function exeDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  return app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
}

/** Every mods folder, most general first: AppData, then next to the .exe. */
function modDirs() {
  const dirs = [path.join(app.getPath('userData'), 'mods'), path.join(exeDir(), 'mods')];
  return [...new Set(dirs.map((d) => path.normalize(d)))];
}

/* Copy a folder file by file (plain reads and writes work from inside the
 * app's packed archive; fs.cp does not). */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (fs.statSync(src).isDirectory()) copyDir(src, dst);
    else fs.writeFileSync(dst, fs.readFileSync(src));
  }
}

/** Make a mods folder with the guide and examples in it, if there is none. */
function seedModsFolder(dir) {
  try {
    if (fs.existsSync(dir)) return true;
    copyDir(TEMPLATE_DIR, dir);
    return true;
  } catch {
    return false;   // read-only install location: the AppData folder still works
  }
}

/** The mods folder people should use: next to the .exe if we may write there, else AppData. */
function mainModsFolder() {
  const [userDir, exeMods] = modDirs();
  if (seedModsFolder(exeMods)) return exeMods;
  seedModsFolder(userDir);
  return userDir;
}

/** JSON that may have // comment lines in it, as people tend to add. */
function readJson(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return JSON.parse(text.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n'));
}

/** Read the mods folders: graphics overrides and the scripts to load. */
function scanMods() {
  const graphics = {};
  const scripts = [];
  const errors = [];
  const folders = [];
  modDirs().forEach((dir, i) => {
    if (!fs.existsSync(dir)) return;
    folders.push(dir);
    const gfx = path.join(dir, 'graphics.json');
    if (fs.existsSync(gfx)) {
      try { Object.assign(graphics, readJson(gfx)); } catch (e) { errors.push(`${gfx}: ${e.message}`); }
    }
    for (const name of fs.readdirSync(dir).sort()) {
      if (/\.m?js$/i.test(name) && fs.statSync(path.join(dir, name)).isFile()) {
        scripts.push(`${SCHEME}://game/mods/${i}/${encodeURIComponent(name)}`);
      }
    }
  });
  return { graphics, scripts, errors, folders, desktop: true, version: app.getVersion() };
}

/* Settings that have to be made before Electron starts: a graphics.json can
 * lift the frame-rate cap (vsync) for benchmarking. */
let bootGraphics = {};
try {
  for (const dir of modDirs()) {
    const f = path.join(dir, 'graphics.json');
    if (fs.existsSync(f)) Object.assign(bootGraphics, readJson(f));
  }
} catch { bootGraphics = {}; }
// Always ask for the fast GPU on laptops with two, and don't refuse WebGL on
// older drivers Chrome is wary of.
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (bootGraphics.uncapFps) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

/* ------------------------------------------------------------ the files */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};

function inside(base, rel) {
  const root = path.resolve(base);
  const file = path.resolve(root, `.${path.sep}${rel}`);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

function serve() {
  protocol.handle(SCHEME, async (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    let file = null;
    const mod = rel.match(/^\/mods\/(\d+)\/(.+)$/);
    if (mod) {
      const dir = modDirs()[+mod[1]];
      if (dir) file = inside(dir, mod[2]);
    } else {
      if (rel.endsWith('/')) rel += 'index.html';
      file = inside(GAME_DIR, rel);
    }
    if (!file) return new Response('Not found', { status: 404 });
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/* ------------------------------------------------------------ the window */

function openModsFolder() {
  shell.openPath(mainModsFolder());
}

function menu() {
  return Menu.buildFromTemplate([
    {
      label: 'Game',
      submenu: [
        { label: 'Open mods folder', click: openModsFolder },
        { label: 'Reload (re-reads mods)', accelerator: 'F5', click: (_, w) => w && w.reload() },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Developer tools (for modders)', accelerator: 'F12', click: (_, w) => w && w.webContents.toggleDevTools() },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Modding guide', click: () => shell.openPath(path.join(mainModsFolder(), 'README.txt')) },
        {
          label: 'About',
          click: (_, w) => dialog.showMessageBox(w, {
            type: 'info',
            title: 'Building Design Simulator',
            message: `Building Design Simulator ${app.getVersion()}`,
            detail: `Desktop build (Electron ${process.versions.electron}, Chrome ${process.versions.chrome}).\n\nMods folders:\n${modDirs().join('\n')}`,
          }),
        },
      ],
    },
  ]);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 940,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0e1420',
    title: 'Building Design Simulator',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep the world running at full speed when the window is behind another.
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // Links to the web open in the browser, never in the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (ev, url) => {
    if (!url.startsWith(`${SCHEME}://game/`)) { ev.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  win.loadURL(HOME);
  return win;
}

ipcMain.on('building-sim:mods', (ev) => {
  try { ev.returnValue = scanMods(); } catch (e) { ev.returnValue = { graphics: {}, scripts: [], errors: [String(e)], folders: [], desktop: true }; }
});

app.whenReady().then(() => {
  serve();
  // A first run puts a mods folder (guide and examples) next to the .exe.
  mainModsFolder();
  Menu.setApplicationMenu(menu());
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
