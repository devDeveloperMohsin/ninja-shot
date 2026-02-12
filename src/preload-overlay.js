const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  commitSelection: (bounds) => ipcRenderer.invoke('overlay:commit', bounds),
  cancel: () => ipcRenderer.invoke('overlay:cancel'),
  onClose: (fn) => {
    ipcRenderer.on('overlay:close', fn);
    return () => ipcRenderer.removeAllListeners('overlay:close');
  },
});
