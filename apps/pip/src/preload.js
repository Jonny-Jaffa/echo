const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pipBootstrap", {
  getBootstrapState: () => ipcRenderer.invoke("pip:getBootstrapState"),
  updateBootstrapState: (patch) => ipcRenderer.invoke("pip:updateBootstrapState", patch),
  startRuntime: () => ipcRenderer.invoke("pip:startRuntime"),
  stopRuntime: () => ipcRenderer.invoke("pip:stopRuntime"),
  restartRuntime: () => ipcRenderer.invoke("pip:restartRuntime"),
  openRoleExperience: () => ipcRenderer.invoke("pip:openRoleExperience"),
  stopRoleExperience: () => ipcRenderer.invoke("pip:stopRoleExperience"),
  minimizeWindow: () => ipcRenderer.invoke("pip:minimizeWindow"),
  confirmQuit: () => ipcRenderer.invoke("pip:confirmQuit"),
  onBootstrapUpdate: (callback) => {
    ipcRenderer.on("bootstrap:update", (_event, payload) => callback(payload));
  },
});
