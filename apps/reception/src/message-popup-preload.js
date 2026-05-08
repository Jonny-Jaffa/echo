const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pipMessagePopup", {
  close: () => ipcRenderer.invoke("message-popup:close"),
  dismissAlert: (notificationId) => ipcRenderer.invoke("notification:dismissById", notificationId),
  openMain: () => ipcRenderer.invoke("message-popup:openMain"),
  openMessage: () => ipcRenderer.invoke("message-popup:openMessage"),
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
