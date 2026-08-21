const { contextBridge, ipcRenderer } = require("electron");

// contextIsolation is on and nodeIntegration is off in main.js, so this is
// the only door between the page and Electron -- kept to exactly the two
// calls the injected update button (see createWindow in main.js) needs.
// The site itself never touches this; it doesn't know the API exists.
contextBridge.exposeInMainWorld("macacallUpdater", {
  onStatus: (callback) =>
    ipcRenderer.on("update-status", (_event, data) => callback(data)),
  triggerUpdate: () => ipcRenderer.send("trigger-update"),
});
