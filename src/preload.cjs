const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('locky', {
  isPackaged: () => ipcRenderer.invoke('runtime:is-packaged'),
  getState: () => ipcRenderer.invoke('state:get'),
  addRule: rule => ipcRenderer.invoke('rules:add', rule),
  cancelRule: id => ipcRenderer.invoke('rules:cancel', id),
  closeBrowsers: () => ipcRenderer.invoke('browsers:close'),
  simulateBlockedAttempt: () => ipcRenderer.invoke('lock:demo'),
  onStateChanged: callback => ipcRenderer.on('state:changed', (_event, state) => callback(state)),
  onLockRemaining: callback => ipcRenderer.on('lock:remaining', (_event, remainingMs) => callback(remainingMs)),
});
