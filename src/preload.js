const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ninjaShot', {
  captureFullScreen: (screenIndex) => ipcRenderer.invoke('capture:fullScreen', screenIndex),
  captureRegion: (bounds, screenIndex) => ipcRenderer.invoke('capture:region', bounds, screenIndex),
  listDisplays: () => ipcRenderer.invoke('capture:listDisplays'),
  showOverlay: () => ipcRenderer.invoke('overlay:show'),
  onCaptureResult: (fn) => {
    ipcRenderer.on('capture:result', (_event, payload) => fn(payload));
    return () => ipcRenderer.removeAllListeners('capture:result');
  },
  copyImageToClipboard: (base64Png) => ipcRenderer.invoke('clipboard:writeImage', base64Png),
  saveImage: (base64Png, defaultPath) => ipcRenderer.invoke('save:image', base64Png, defaultPath),
  getDefaultScreenshotsPath: () => ipcRenderer.invoke('save:defaultPath'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (updates) => ipcRenderer.invoke('config:set', updates),
  onMenu: (channel, fn) => {
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeAllListeners(channel);
  },
  installScrot: () => ipcRenderer.invoke('install:scrot'),
  installGrim: () => ipcRenderer.invoke('install:grim'),
  installGnomeScreenshot: () => ipcRenderer.invoke('install:gnome-screenshot'),
});
