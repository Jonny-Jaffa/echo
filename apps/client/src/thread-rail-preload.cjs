const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pipThreadRail", {
  selectThread: (threadKey) => ipcRenderer.invoke("threadRail:selectThread", threadKey),
  onUpdate: (callback) => {
    const listener = (_event, payload) => {
      if (typeof callback === "function") {
        callback(payload);
      }
    };

    ipcRenderer.on("threadRail:update", listener);
    return () => {
      ipcRenderer.removeListener("threadRail:update", listener);
    };
  },
});
