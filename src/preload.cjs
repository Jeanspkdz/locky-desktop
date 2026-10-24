const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('locky', {
  getState: () => ipcRenderer.invoke('state:get'),
  addRule: rule => ipcRenderer.invoke('rules:add', rule),
  cancelRule: id => ipcRenderer.invoke('rules:cancel', id),
  refreshCandidates: () => ipcRenderer.invoke('candidates:refresh'),
  approveCandidates: () => ipcRenderer.invoke('candidates:approve'),
  closeBrowsers: () => ipcRenderer.invoke('browsers:close'),
  simulateBlockedAttempt: () => ipcRenderer.invoke('lock:demo'),
  onStateChanged: callback => ipcRenderer.on('state:changed', (_event, state) => callback(state)),
});
