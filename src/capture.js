const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const isLinux = process.platform === 'linux';

const SCROT_INSTALL_MSG = 'Scrot is required on Linux. Install it: sudo apt-get install scrot';

/** Return true only when we know scrot is not installed (not in PATH and not in common paths). */
function isScrotMissing() {
  const { execSync } = require('child_process');
  try {
    execSync('which scrot', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return false;
  } catch (_) {}
  const commonPaths = ['/usr/bin/scrot', '/usr/local/bin/scrot'];
  for (const p of commonPaths) {
    try {
      if (fs.existsSync(p)) return false;
    } catch (_) {}
  }
  return true;
}

/**
 * Capture full screen on Linux using scrot with a temp file.
 * Avoids screenshot-desktop's broken stdout invocation (scrot -e /dev/stdout fails in Electron).
 * @returns {Promise<Buffer>} PNG buffer.
 */
function captureFullScreenLinux() {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `ninja-shot-${Date.now()}.png`);
    const proc = spawn('scrot', [tmpFile], {
      env: { ...process.env, PATH: '/usr/bin:/usr/local/bin:' + (process.env.PATH || '') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
 * On Linux: use our own scrot + temp file (screenshot-desktop's scrot stdout mode fails in Electron).
 * @param {number} [screenIndex] - Optional display index (ignored when using scrot on Linux).
 * @returns {Promise<Buffer>} PNG buffer.
 */
async function captureFullScreen(screenIndex) {
  if (isLinux) {
    if (isScrotMissing()) {
      throw new Error(SCROT_INSTALL_MSG);
    }
    return captureFullScreenLinux();
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
 * Capture a region of the screen by capturing full screen then cropping.
 * @param {{ x: number, y: number, width: number, height: number }} bounds - Region in screen coordinates.
 * @param {number} [screenIndex] - Optional display index.
 * @returns {Promise<Buffer>} PNG buffer of cropped region.
 */
async function captureRegion(bounds, screenIndex) {
  const full = await captureFullScreen(screenIndex);
  const { x, y, width, height } = bounds;
  return sharp(full)
    .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
    .png()
    .toBuffer();
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
