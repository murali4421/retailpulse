// Electron Preload script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  sendPrintTicket: (ticketData) => ipcRenderer.send('print-ticket', ticketData),
  onHardwareBarcode: (callback) => {
    ipcRenderer.on('barcode-scanned', (_event, value) => callback(value));
  }
});
