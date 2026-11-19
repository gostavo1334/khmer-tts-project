const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// safe electron APIs
contextBridge.exposeInMainWorld('electron', {
  isDesktop: true,
  platform: process.platform,
});
