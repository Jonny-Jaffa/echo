const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pipPanel", {
  defaultServerUrl: process.env.PIP_SERVER || "http://127.0.0.1:3210",
  defaultServerAccessKey: process.env.PIP_ACCESS_KEY || "",
  defaultRoomId: process.env.PIP_ROOM_ID || "surgery-1",
  hideWindow: () => ipcRenderer.invoke("panel:hideWindow"),
  minimizeWindow: () => ipcRenderer.invoke("panel:minimizeWindow"),
  openSettingsWindow: () => ipcRenderer.invoke("panel:openSettingsWindow"),
  openRoleWindow: () => ipcRenderer.invoke("panel:openRoleWindow"),
  closeRoleWindow: () => ipcRenderer.invoke("panel:closeRoleWindow"),
  playAcknowledgementSound: () => ipcRenderer.invoke("panel:playAcknowledgementSound"),
  playAlertSound: (options) => ipcRenderer.invoke("panel:playAlertSound", options),
  getSettings: () => ipcRenderer.invoke("panel:getSettings"),
  getRoleState: () => ipcRenderer.invoke("panel:getRoleState"),
  getHardwareStatus: () => ipcRenderer.invoke("panel:getHardwareStatus"),
  setSettingsExpanded: (expanded) => ipcRenderer.invoke("panel:setSettingsExpanded", expanded),
  onHardwareStatus: (callback) => {
    const listener = (_event, status) => {
      if (typeof callback === "function") {
        callback(status);
      }
    };

    ipcRenderer.on("panel:hardwareStatus", listener);
    return () => {
      ipcRenderer.removeListener("panel:hardwareStatus", listener);
    };
  },
  onSettingsUpdated: (callback) => {
    const listener = (_event, settings) => {
      if (typeof callback === "function") {
        callback(settings);
      }
    };

    ipcRenderer.on("panel:settingsUpdated", listener);
    return () => {
      ipcRenderer.removeListener("panel:settingsUpdated", listener);
    };
  },
  updateSettings: (patch) => ipcRenderer.invoke("panel:updateSettings", patch),
});
