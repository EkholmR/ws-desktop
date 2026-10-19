const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password })
});