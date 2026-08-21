const { contextBridge, ipcRenderer } = require("electron");

// Same locked-down pattern as the main window's preload: the dialog page
// gets exactly two calls, nothing else from Node/Electron.
contextBridge.exposeInMainWorld("dialogAPI", {
  onInit: (callback) => ipcRenderer.on("dialog-init", (_event, data) => callback(data)),
  respond: (index) => ipcRenderer.send("dialog-response", index),
});
