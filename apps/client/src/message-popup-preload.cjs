const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pipMessagePopup", {
  close: () => ipcRenderer.invoke("message-popup:close"),
  openMain: (options) => ipcRenderer.invoke("message-popup:openMain", options),
  dismissReceptionPing: () => ipcRenderer.invoke("message-popup:dismissReceptionPing"),
  sendPanelAction: (buttonId) => ipcRenderer.invoke("message-popup:panelAction", buttonId),
  onShow: (callback) => {
    const listener = (_event, payload) => {
      if (typeof callback === "function") {
        callback(payload);
      }
    };

    ipcRenderer.on("message-popup:show", listener);
    return () => {
      ipcRenderer.removeListener("message-popup:show", listener);
    };
  },
});
