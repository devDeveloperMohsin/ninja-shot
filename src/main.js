const { app, BrowserWindow, ipcMain, globalShortcut, clipboard, dialog, Menu, session } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { spawn } = require('node:child_process');
const { captureFullScreen, captureRegion, listDisplays } = require('./capture');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
let overlayWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createOverlayWindow() {
  if (overlayWindow) return overlayWindow;

  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  const { x, y } = primary.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: OVERLAY_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Required for transparent overlay: set background to fully transparent
  overlayWindow.setBackgroundColor('#00000000');
  // Use setBounds to cover screen instead of setFullScreen so transparency works on Linux
  overlayWindow.setBounds({ x, y, width, height });
  overlayWindow.loadURL(OVERLAY_WEBPACK_ENTRY);
  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function closeOverlay() {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

// IPC: capture full screen (returns base64 PNG)
ipcMain.handle('capture:fullScreen', async (_event, screenIndex) => {
  try {
    const buffer = await captureFullScreen(screenIndex);
    return { ok: true, data: buffer.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: capture region (bounds = { x, y, width, height })
ipcMain.handle('capture:region', async (_event, bounds, screenIndex) => {
  try {
    const buffer = await captureRegion(bounds, screenIndex);
    return { ok: true, data: buffer.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: list displays (multi-monitor)
ipcMain.handle('capture:listDisplays', async () => {
  try {
    const displays = await listDisplays();
    return { ok: true, displays };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: show overlay for region selection
ipcMain.handle('overlay:show', () => {
  createOverlayWindow();
  return { ok: true };
});

// IPC: overlay committed selection (bounds) -> capture region and send to main window
ipcMain.handle('overlay:commit', async (_event, bounds) => {
  try {
    const buffer = await captureRegion(bounds);
    const data = buffer.toString('base64');
    closeOverlay();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('capture:result', { ok: true, data });
    }
    return { ok: true };
  } catch (err) {
    closeOverlay();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('capture:result', { ok: false, error: err.message });
    }
    return { ok: false, error: err.message };
  }
});

// IPC: overlay cancelled
ipcMain.handle('overlay:cancel', () => {
  closeOverlay();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  return { ok: true };
});

// IPC: copy PNG (base64) to clipboard
ipcMain.handle('clipboard:writeImage', async (_event, base64Png) => {
  try {
    const buffer = Buffer.from(base64Png, 'base64');
    const { nativeImage } = require('electron');
    clipboard.writeImage(nativeImage.createFromBuffer(buffer));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: get default screenshots directory (create if needed; fallback if Pictures missing)
function getDefaultScreenshotsPath() {
  let baseDir;
  try {
    baseDir = app.getPath('pictures');
  } catch (_) {
    baseDir = app.getPath('userData');
  }
  const screenshotsDir = path.join(baseDir, 'Screenshots');
  try {
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  } catch (e) {
    console.error('[Ninja Shot] Could not create Screenshots dir:', screenshotsDir, e.message);
  }
  return screenshotsDir;
}

ipcMain.handle('save:defaultPath', () => {
  return { ok: true, path: getDefaultScreenshotsPath() };
});

// IPC: save image to file
ipcMain.handle('save:image', async (_event, base64Png, defaultPath) => {
  try {
    const dir = defaultPath && typeof defaultPath === 'string' ? defaultPath : getDefaultScreenshotsPath();
    const name = `ninja-shot-${Date.now()}.png`;
    const filePath = path.join(dir, name);
    const buffer = Buffer.from(base64Png, 'base64');
    if (!buffer.length) {
      throw new Error('Image data is empty');
    }
    fs.writeFileSync(filePath, buffer);
    console.log('[Ninja Shot] Saved:', filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('[Ninja Shot] Save error:', err.message);
    return { ok: false, error: err.message };
  }
});

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function getConfig() {
  try {
    const data = fs.readFileSync(configPath(), 'utf8');
    return { ...{ shortcutAction: 'fullScreen' }, ...JSON.parse(data) };
  } catch (_) {
    return { shortcutAction: 'fullScreen' };
  }
}

function setConfig(updates) {
  try {
    const current = getConfig();
    const next = { ...current, ...updates };
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  } catch (_) {}
}

ipcMain.handle('config:get', () => getConfig());
ipcMain.handle('config:set', (_event, updates) => {
  setConfig(updates);
  return { ok: true };
});

// Linux: try to install scrot via system package manager (pkexec will prompt for password)
ipcMain.handle('install:scrot', () => {
  if (process.platform !== 'linux') {
    return Promise.resolve({ ok: false, error: 'Only supported on Linux' });
  }
  return new Promise((resolve) => {
    const tryApt = () => {
      const child = spawn('pkexec', ['apt-get', 'install', '-y', 'scrot'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0) return resolve({ ok: true });
        tryDnf();
      });
      child.on('error', () => tryDnf());
    };
    const tryDnf = () => {
      const child = spawn('pkexec', ['dnf', 'install', '-y', 'scrot'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0) return resolve({ ok: true });
        tryZypper();
      });
      child.on('error', () => tryZypper());
    };
    const tryZypper = () => {
      const child = spawn('pkexec', ['zypper', 'install', '-y', 'scrot'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0) return resolve({ ok: true });
        resolve({ ok: false, error: 'Could not install scrot. Try: sudo apt-get install scrot' });
      });
      child.on('error', () => {
        resolve({ ok: false, error: 'Could not install scrot. Try: sudo apt-get install scrot' });
      });
    };
    tryApt();
  });
});

// Linux Wayland: install grim (screenshot tool for Wayland)
ipcMain.handle('install:grim', () => {
  if (process.platform !== 'linux') {
    return Promise.resolve({ ok: false, error: 'Only supported on Linux' });
  }
  return new Promise((resolve) => {
    const tryApt = () => {
      const child = spawn('pkexec', ['apt-get', 'install', '-y', 'grim'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.on('close', (code) => {
        if (code === 0) return resolve({ ok: true });
        tryDnf();
      });
      child.on('error', () => tryDnf());
    };
    const tryDnf = () => {
      const child = spawn('pkexec', ['dnf', 'install', '-y', 'grim'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.on('close', (code) => {
        if (code === 0) return resolve({ ok: true });
        resolve({ ok: false, error: 'Could not install grim. Try: sudo apt-get install grim' });
      });
      child.on('error', () => resolve({ ok: false, error: 'Try: sudo apt-get install grim' }));
    };
    tryApt();
  });
});

// Linux GNOME Wayland: install gnome-screenshot (fallback when grim doesn't work)
ipcMain.handle('install:gnome-screenshot', () => {
  if (process.platform !== 'linux') {
    return Promise.resolve({ ok: false, error: 'Only supported on Linux' });
  }
  return new Promise((resolve) => {
    const tryApt = () => {
      const child = spawn('pkexec', ['apt-get', 'install', '-y', 'gnome-screenshot'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.on('close', (code) => {
        if (code === 0) return resolve({ ok: true });
        resolve({ ok: false, error: 'Could not install. Try: sudo apt-get install gnome-screenshot' });
      });
      child.on('error', () => resolve({ ok: false, error: 'Try: sudo apt-get install gnome-screenshot' }));
    };
    tryApt();
  });
});

app.whenReady().then(() => {
  // Apply strict CSP only when packaged (production). In dev, webpack-dev-server uses eval.
  if (app.isPackaged) {
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'";
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      });
    });
  }

  createWindow();

  // Application menu
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New screenshot', accelerator: 'CmdOrCtrl+N', click: () => mainWindow && mainWindow.webContents.send('menu:new') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow && mainWindow.webContents.send('menu:save') },
        { label: 'Copy to clipboard', accelerator: 'CmdOrCtrl+Shift+C', click: () => mainWindow && mainWindow.webContents.send('menu:copy') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Capture',
      submenu: [
        { label: 'Full screen', click: () => mainWindow && mainWindow.webContents.send('menu:captureFull') },
        { label: 'Select region', click: () => mainWindow && mainWindow.webContents.send('menu:captureRegion') },
      ],
    },
    {
      label: 'Options',
      submenu: [
        { label: 'Settings', click: () => mainWindow && mainWindow.webContents.send('menu:settings') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Print Screen global shortcut
  function onPrintScreen() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const config = getConfig();
    if (config.shortcutAction === 'region') {
      createOverlayWindow();
    } else {
      captureFullScreen()
        .then((buffer) => {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('capture:result', { ok: true, data: buffer.toString('base64') });
        })
        .catch((err) => {
          mainWindow.webContents.send('capture:result', { ok: false, error: err.message });
        });
    }
  }
  try {
    globalShortcut.register('PrintScreen', onPrintScreen);
  } catch (_) {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
