const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pipPanel", {
  defaultServerUrl: process.env.PIP_SERVER || "http://127.0.0.1:3210",
  defaultServerAccessKey: process.env.PIP_ACCESS_KEY || "",
  defaultRoomId: process.env.PIP_ROOM_ID || "surgery-1",
  hideWindow: () => ipcRenderer.invoke("panel:hideWindow"),
  quitApp: () => ipcRenderer.invoke("panel:quitApp"),
  minimizeWindow: () => ipcRenderer.invoke("panel:minimizeWindow"),
  expandWindow: () => ipcRenderer.invoke("panel:expandWindow"),
  openSettingsWindow: () => ipcRenderer.invoke("panel:openSettingsWindow"),
  openRoleWindow: () => ipcRenderer.invoke("panel:openRoleWindow"),
  closeRoleWindow: () => ipcRenderer.invoke("panel:closeRoleWindow"),
  playAcknowledgementSound: () => ipcRenderer.invoke("panel:playAcknowledgementSound"),
  playAlertSound: (options) => ipcRenderer.invoke("panel:playAlertSound", options),
  showMessagePopup: (payload) => ipcRenderer.invoke("panel:showMessagePopup", payload),
  closeReceptionPingPopup: () => ipcRenderer.invoke("panel:closeReceptionPingPopup"),
  syncThreadRail: (payload) => ipcRenderer.invoke("panel:syncThreadRail", payload),
  getSettings: () => ipcRenderer.invoke("panel:getSettings"),
  getRoleState: () => ipcRenderer.invoke("panel:getRoleState"),
  getHardwareStatus: () => ipcRenderer.invoke("panel:getHardwareStatus"),
  setSettingsExpanded: (expanded) => ipcRenderer.invoke("panel:setSettingsExpanded", expanded),
  setBannerVisible: (bannerVisible) => ipcRenderer.invoke("panel:setBannerVisible", bannerVisible),
  setOfflineCompact: (isCompact) => ipcRenderer.invoke("panel:setOfflineCompact", isCompact),
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
  onMessagePopupOpen: (callback) => {
    const listener = (_event, payload) => {
      if (typeof callback === "function") {
        callback(payload);
      }
    };

    ipcRenderer.on("panel:messagePopupOpen", listener);
    return () => {
      ipcRenderer.removeListener("panel:messagePopupOpen", listener);
    };
  },
  onMessagePopupPanelAction: (callback) => {
    const listener = (_event, payload) => {
      if (typeof callback === "function") {
        callback(payload);
      }
    };

    ipcRenderer.on("panel:messagePopupPanelAction", listener);
    return () => {
      ipcRenderer.removeListener("panel:messagePopupPanelAction", listener);
    };
  },
  onMessagePopupDismissReceptionPing: (callback) => {
    const listener = () => {
      if (typeof callback === "function") {
        callback();
      }
    };

    ipcRenderer.on("panel:messagePopupDismissReceptionPing", listener);
    return () => {
      ipcRenderer.removeListener("panel:messagePopupDismissReceptionPing", listener);
    };
  },
  onThreadRailSelect: (callback) => {
    const listener = (_event, threadKey) => {
      if (typeof callback === "function") {
        callback(threadKey);
      }
    };

    ipcRenderer.on("panel:threadRailSelect", listener);
    return () => {
      ipcRenderer.removeListener("panel:threadRailSelect", listener);
    };
  },
  updateSettings: (patch) => ipcRenderer.invoke("panel:updateSettings", patch),
  onAppQuitting: (callback) => {
    const listener = () => {
      if (typeof callback === "function") {
        callback();
      }
    };

    ipcRenderer.on("panel:appQuitting", listener);
    return () => {
      ipcRenderer.removeListener("panel:appQuitting", listener);
    };
  },
});
