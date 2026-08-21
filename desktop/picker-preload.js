const { contextBridge, ipcRenderer } = require("electron");

// Same locked-down pattern as the other preload scripts: this page gets
// exactly the calls it needs, nothing else from Node/Electron.
contextBridge.exposeInMainWorld("pickerAPI", {
  onSources: (callback) => ipcRenderer.on("picker-sources", (_event, sources) => callback(sources)),
  choose: (id) => ipcRenderer.send("picker-response", id),
  cancel: () => ipcRenderer.send("picker-response", null),
});
