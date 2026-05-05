const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pip", {
  getStatus: () => ipcRenderer.invoke("app:getStatus"),
  openSettingsWindow: () => ipcRenderer.invoke("app:openSettingsWindow"),
  openRoleWindow: () => ipcRenderer.invoke("app:openRoleWindow"),
  getRoleState: () => ipcRenderer.invoke("app:getRoleState"),
  updateRoleState: (patch) => ipcRenderer.invoke("app:updateRoleState", patch),
  closeRoleWindow: () => ipcRenderer.invoke("app:closeRoleWindow"),
  minimizeWindow: () => ipcRenderer.invoke("app:minimizeWindow"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  confirmQuit: () => ipcRenderer.invoke("app:confirmQuit"),
  pingRoom: (roomId) => ipcRenderer.invoke("room:ping", roomId),
  clearPing: (roomId) => ipcRenderer.invoke("room:clearPing", roomId),
  sendChatMessage: (payload) => ipcRenderer.invoke("chat:send", payload),
  deleteChatMessage: (messageId) => ipcRenderer.invoke("chat:delete", messageId),
  editChatMessage: (messageId, text) => ipcRenderer.invoke("chat:edit", messageId, text),
  dismissNotification: () => ipcRenderer.invoke("notification:dismiss"),
  dismissNotificationById: (notificationId) =>
    ipcRenderer.invoke("notification:dismissById", notificationId),
  showNextNotification: () => ipcRenderer.invoke("notification:next"),
  playReceptionTestSound: (options) => ipcRenderer.invoke("audio:playReceptionTestSound", options),
  updateDisplaySettings: (patch) => ipcRenderer.invoke("display:update", patch),
  updateGadgetHeight: (height) => ipcRenderer.invoke("display:updateGadgetHeight", height),
  onNotificationUpdate: (callback) => {
    ipcRenderer.on("notification:update", (_event, payload) => callback(payload));
  },
  onStateUpdate: (callback) => {
    ipcRenderer.on("state:update", (_event, payload) => callback(payload));
  },
  onChatUpdate: (callback) => {
    ipcRenderer.on("chat:update", (_event, payload) => callback(payload));
  },
  onPingCleared: (callback) => {
    ipcRenderer.on("room:pingCleared", (_event, payload) => callback(payload));
  },
});
