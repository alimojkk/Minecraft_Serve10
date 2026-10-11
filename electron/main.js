/**
 * پیکربندی Electron — پنجرهٔ دسکتاپ مستقل «دستیار»
 * برنامهٔ Next.js را به صورت محلی اجرا و در پنجرهٔ Electron باز می‌کند
 */
const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("node:path");
const http = require("node:http");

const PORT = 3784;
const APP_URL = `http://localhost:${PORT}`;

let serverProcess = null;
let mainWindow = null;

/** صبر تا سرور برنامه آماده شود */
function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const check = (left) => {
      const req = http.get(APP_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (left <= 0) return reject(new Error("سرور برنامه آماده نشد."));
        setTimeout(() => check(left - 1), 1000);
      });
    };
    check(retries);
  });
}

/** اجرای سرور Next.js */
function startServer() {
  const isWin = process.platform === "win32";
  const npmCmd = isWin ? "npm.cmd" : "npm";

  // همگام‌سازی دیتابیس
  spawn(npmCmd, ["run", "db:sync"], { cwd: __dirname, stdio: "inherit", shell: true });

  serverProcess = spawn(npmCmd, ["run", "start"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error("سرور برنامه با کد", code, "بسته شد.");
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "دستیار",
    backgroundColor: "#070b14",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(APP_URL);

  // باز شدن لینک‌های خارجی در مرورگر پیش‌فرض
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer();
    createWindow();
  } catch (err) {
    console.error(err.message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
