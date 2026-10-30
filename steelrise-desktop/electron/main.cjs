// STEELRISE desktop shell: one window, no menu bar, saves in the user's
// app-data folder (%APPDATA%/STEELRISE on Windows).
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const saveDir = () => path.join(app.getPath("userData"), "saves");
const safeName = (name) => String(name).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#181a1d",
    title: "STEELRISE: Construction Simulator",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.once("ready-to-show", () => {
    win.maximize();
    win.show();
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  win.loadFile(path.join(__dirname, "..", "build", "index.html"));
}

ipcMain.handle("save:list", () => {
  fs.mkdirSync(saveDir(), { recursive: true });
  return fs.readdirSync(saveDir()).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
});
ipcMain.handle("save:read", (_e, name) => {
  const file = path.join(saveDir(), safeName(name) + ".json");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
});
ipcMain.handle("save:write", (_e, name, text) => {
  fs.mkdirSync(saveDir(), { recursive: true });
  const file = path.join(saveDir(), safeName(name) + ".json");
  fs.writeFileSync(file + ".tmp", String(text));
  fs.renameSync(file + ".tmp", file);
  return true;
});
ipcMain.handle("app:quit", () => app.quit());
ipcMain.handle("app:fullscreen", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
ipcMain.handle("app:savePath", () => saveDir());

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
