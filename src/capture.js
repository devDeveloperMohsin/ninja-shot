const screenshot = require('screenshot-desktop');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const isLinux = process.platform === 'linux';

const SCROT_INSTALL_MSG = 'Scrot is required on Linux (X11). Install it: sudo apt-get install scrot';
const GRIM_INSTALL_MSG = 'Grim is required on Wayland. Install it: sudo apt-get install grim (or: grim and slurp for region)';
const GNOME_SCREENSHOT_MSG = 'On GNOME Wayland install: sudo apt-get install gnome-screenshot (often pre-installed)';

/** True if compositor doesn't support grim (e.g. GNOME uses a different protocol). */
function isGrimUnsupportedError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  return /wlr-screencopy|doesn't support|compositor doesn't support/i.test(msg);
}

function isWayland() {
  return process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;
}

/** Return true if grim is available (Wayland screenshot tool, works on Sway/wlroots). */
function isGrimAvailable() {
  try {
    execSync('which grim', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (_) {}
  return fs.existsSync('/usr/bin/grim');
}

/** Return true if gnome-screenshot is available (GNOME Wayland fallback when grim doesn't work). */
function isGnomeScreenshotAvailable() {
  try {
    execSync('which gnome-screenshot', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (_) {}
  return fs.existsSync('/usr/bin/gnome-screenshot');
}

/** Return true only when we know scrot is not installed. */
function isScrotMissing() {
  try {
    execSync('which scrot', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return false;
  } catch (_) {}
  return !fs.existsSync('/usr/bin/scrot') && !fs.existsSync('/usr/local/bin/scrot');
}

const envPath = { env: { ...process.env, PATH: '/usr/bin:/usr/local/bin:' + (process.env.PATH || '') } };

/**
 * Capture full screen on Wayland using grim (scrot gives black screen on Wayland).
 * @returns {Promise<Buffer>} PNG buffer.
 */
function captureFullScreenGrim() {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `ninja-shot-${Date.now()}.png`);
    const proc = spawn('grim', [tmpFile], { ...envPath, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        return reject(new Error(stderr || `grim exited with code ${code}`));
      }
      try {
        const buf = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(buf);
      } catch (err) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        reject(err);
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      reject(err);
    });
  });
}

/**
 * Capture full screen on GNOME Wayland using gnome-screenshot (fallback when grim fails with wlr-screencopy).
 * @returns {Promise<Buffer>} PNG buffer.
 */
function captureFullScreenGnomeScreenshot() {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `ninja-shot-${Date.now()}.png`);
    const proc = spawn('gnome-screenshot', ['-f', tmpFile], { ...envPath, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        return reject(new Error(stderr || `gnome-screenshot exited with code ${code}`));
      }
      try {
        const buf = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(buf);
      } catch (err) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        reject(err);
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      reject(err);
    });
  });
}

/**
 * Capture full screen on X11 using scrot.
 * @returns {Promise<Buffer>} PNG buffer.
 */
function captureFullScreenScrot() {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `ninja-shot-${Date.now()}.png`);
    const proc = spawn('scrot', [tmpFile], { ...envPath, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        return reject(new Error(stderr || `scrot exited with code ${code}`));
      }
      try {
        const buf = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(buf);
      } catch (err) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        reject(err);
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      reject(err);
    });
  });
}

/**
 * Capture full screen as PNG buffer.
 * On Linux Wayland: try grim first; if compositor doesn't support wlr-screencopy (e.g. GNOME), use gnome-screenshot.
 * On Linux X11: use scrot.
 * @param {number} [screenIndex] - Optional display index (ignored on Linux).
 * @returns {Promise<Buffer>} PNG buffer.
 */
async function captureFullScreen(screenIndex) {
  if (isLinux) {
    if (isWayland()) {
      if (isGrimAvailable()) {
        try {
          return await captureFullScreenGrim();
        } catch (err) {
          if (isGrimUnsupportedError(err) && isGnomeScreenshotAvailable()) {
            return captureFullScreenGnomeScreenshot();
          }
          throw err;
        }
      }
      if (isGnomeScreenshotAvailable()) {
        return captureFullScreenGnomeScreenshot();
      }
      throw new Error(GRIM_INSTALL_MSG + ' Or on GNOME: ' + GNOME_SCREENSHOT_MSG);
    }
    if (isScrotMissing()) {
      throw new Error(SCROT_INSTALL_MSG);
    }
    return captureFullScreenScrot();
  }
  const options = { format: 'png' };
  if (screenIndex != null) {
    const displays = await screenshot.listDisplays();
    if (displays[screenIndex]) {
      options.screen = displays[screenIndex].id;
    }
  }
  return screenshot(options);
}

/**
 * Capture a region on Wayland using grim -g "x,y WxH".
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @returns {Promise<Buffer>} PNG buffer.
 */
function captureRegionGrim(bounds) {
  const x = Math.round(bounds.x);
  const y = Math.round(bounds.y);
  const w = Math.round(bounds.width);
  const h = Math.round(bounds.height);
  const geom = `${x},${y} ${w}x${h}`;
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `ninja-shot-${Date.now()}.png`);
    const proc = spawn('grim', ['-g', geom, tmpFile], { ...envPath, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        return reject(new Error(stderr || `grim -g exited with code ${code}`));
      }
      try {
        const buf = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(buf);
      } catch (err) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        reject(err);
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      reject(err);
    });
  });
}

/**
 * Crop a PNG buffer to the given rectangle. Uses sharp if available, otherwise pngjs (pure JS, no Jimp bitmap.data type issues).
 * @param {Buffer} fullPng - Full PNG buffer.
 * @param {{ x: number, y: number, width: number, height: number }} bounds - Region to extract.
 * @returns {Promise<Buffer>} PNG buffer of cropped region.
 */
async function cropPngBuffer(fullPng, bounds) {
  const buf = Buffer.isBuffer(fullPng) ? fullPng : Buffer.from(fullPng);
  const { x, y, width, height } = bounds;
  const left = Math.round(x);
  const top = Math.round(y);
  const w = Math.round(width);
  const h = Math.round(height);

  try {
    const sharp = require('sharp');
    return sharp(buf)
      .extract({ left, top, width: w, height: h })
      .png()
      .toBuffer();
  } catch (_) {
    const PNG = require('pngjs').PNG;
    const parsed = PNG.sync.read(buf);
    const fullW = parsed.width;
    const fullH = parsed.height;
    const clampLeft = Math.max(0, Math.min(left, fullW - 1));
    const clampTop = Math.max(0, Math.min(top, fullH - 1));
    const clampW = Math.min(w, fullW - clampLeft);
    const clampH = Math.min(h, fullH - clampTop);
    if (clampW <= 0 || clampH <= 0) {
      return buf;
    }
    const croppedData = Buffer.alloc(clampW * clampH * 4);
    const src = parsed.data;
    for (let row = 0; row < clampH; row++) {
      for (let col = 0; col < clampW; col++) {
        const srcIdx = ((clampTop + row) * fullW + (clampLeft + col)) << 2;
        const dstIdx = (row * clampW + col) << 2;
        croppedData[dstIdx] = src[srcIdx];
        croppedData[dstIdx + 1] = src[srcIdx + 1];
        croppedData[dstIdx + 2] = src[srcIdx + 2];
        croppedData[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    return PNG.sync.write({
      width: clampW,
      height: clampH,
      data: croppedData,
      gamma: parsed.gamma,
    });
  }
}

/**
 * Capture a region of the screen by capturing full screen then cropping.
 * On Wayland with grim (wlroots): uses grim -g for direct region capture.
 * On GNOME Wayland (grim unsupported): full screen + crop using gnome-screenshot.
 * @param {{ x: number, y: number, width: number, height: number }} bounds - Region in screen coordinates.
 * @param {number} [screenIndex] - Optional display index.
 * @returns {Promise<Buffer>} PNG buffer of cropped region.
 */
async function captureRegion(bounds, screenIndex) {
  if (isLinux && isWayland() && isGrimAvailable()) {
    try {
      return await captureRegionGrim(bounds);
    } catch (err) {
      if (isGrimUnsupportedError(err)) {
        const full = await captureFullScreen(screenIndex);
        return cropPngBuffer(full, bounds);
      }
      throw err;
    }
  }
  const full = await captureFullScreen(screenIndex);
  return cropPngBuffer(full, bounds);
}

/**
 * List available displays (for multi-monitor support).
 * @returns {Promise<Array<{ id: number, name: string }>>}
 */
async function listDisplays() {
  if (isLinux) {
    const { screen } = require('electron');
    return screen.getAllDisplays().map((d, i) => ({ id: i, name: d.label || `Display ${i + 1}` }));
  }
  return screenshot.listDisplays();
}

module.exports = {
  captureFullScreen,
  captureRegion,
  listDisplays,
};
