const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoBootstrap", {
  getBootstrapState: () => ipcRenderer.invoke("echo:getBootstrapState"),
  updateBootstrapState: (patch) => ipcRenderer.invoke("echo:updateBootstrapState", patch),
  startRuntime: () => ipcRenderer.invoke("echo:startRuntime"),
  stopRuntime: () => ipcRenderer.invoke("echo:stopRuntime"),
  restartRuntime: () => ipcRenderer.invoke("echo:restartRuntime"),
  openRoleExperience: () => ipcRenderer.invoke("echo:openRoleExperience"),
  stopRoleExperience: () => ipcRenderer.invoke("echo:stopRoleExperience"),
  minimizeWindow: () => ipcRenderer.invoke("echo:minimizeWindow"),
  confirmQuit: () => ipcRenderer.invoke("echo:confirmQuit"),
  onBootstrapUpdate: (callback) => {
    ipcRenderer.on("bootstrap:update", (_event, payload) => callback(payload));
  },
});
