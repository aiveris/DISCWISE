const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    scanDirectory: (path) => ipcRenderer.invoke('scan-directory', path),
    deleteItem: (path) => ipcRenderer.invoke('delete-item', path),
    openItem: (path) => ipcRenderer.invoke('open-item', path),
    openItemLocation: (path) => ipcRenderer.invoke('open-item-location', path),
});
