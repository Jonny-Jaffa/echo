const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { exec } = require("node:child_process");
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog } = require("electron");
const { createReceptionServer } = require("./server.js");

const RUNTIME_ROLE_RECEPTION = "reception";
const RUNTIME_ROLE_ROOM = "room";
const CURRENT_APP_RUNTIME_ROLE = RUNTIME_ROLE_RECEPTION;

let mainWindow;
let settingsWindow = null;
let roleWindow = null;
let tray;
let formatTimeFn = (value) => value;
let loadConfigFn = null;
let saveConfigFn = null;
let configState = null;
let notificationQueue = [];
let activeNotification = null;
let chatMessages = [];
let measuredGadgetHeight = null;
let saveWindowPositionTimer = null;
let preExpandWindowPosition = null;
let restorePositionOnNextGadgetHeight = null;
let isProgrammaticWindowMove = false;
let aboutWindow = null;
let messagePopupWindow = null;
let latestMessagePopupPayload = null;
let localAppState = {
  runtimeRole: RUNTIME_ROLE_RECEPTION,
  runtimeRoleConfirmed: true,
};
let serviceState = {
  host: null,
  port: null,
  connectedClients: 0,
  notificationCount: 0,
};

const WINDOW_WIDTH = 460;
const WINDOW_EXPANDED_WIDTH = 800;
const WINDOW_MINIMIZED_HEIGHT = 96;
const WINDOW_ADMIN_WIDTH = 780;
const WINDOW_ADMIN_HEIGHT = 800;
const GADGET_HEADER_HEIGHT = 0;
const GADGET_ROW_HEIGHT = 40;
const GADGET_FRAME_PADDING = 7;
const GADGET_WINDOW_HEIGHT_TRIM = process.platform === "win32" ? 0 : 0;
const GADGET_HIDDEN_MESSAGES_HEIGHT_TRIM = 5;
const GADGET_COMPACT_HIDDEN_MESSAGES_HEIGHT_TRIM = 12;
const RECEPTION_MAIN_WINDOW_IS_TRANSPARENT = true;
const RECEPTION_MAIN_WINDOW_BACKGROUND = "#00000000";
const MESSAGE_POPUP_WIDTH = 380;
const ALERT_POPUP_WIDTH = 460;
const MESSAGE_POPUP_MIN_HEIGHT = 48;
const MESSAGE_POPUP_MAX_HEIGHT = 172;
const ALERT_POPUP_HEIGHT = 48;
const MESSAGE_POPUP_MARGIN = 18;
const STARTUP_LOG_PATH = path.join(os.tmpdir(), "pip-reception.log");
const DEFAULT_RECEPTION_SOUND = "notification_sound_01";
const RECEPTION_SOUND_FILE_MAP = Object.fromEntries(
  Array.from({ length: 17 }, (_value, index) => {
    const soundNumber = String(index + 1).padStart(2, "0");
    return [
      `notification_sound_${soundNumber}`,
      `Notification_sound_${soundNumber}.wav`,
    ];
  }),
);
const LEGACY_RECEPTION_SOUND_ALIASES = {
  ping: "notification_sound_01",
  glass: "notification_sound_02",
  hero: "notification_sound_03",
  funk: "notification_sound_04",
  pop: "notification_sound_05",
};

fs.appendFileSync(
  STARTUP_LOG_PATH,
  `[${new Date().toISOString()}] reception main module loaded\n`,
);

function logStartup(message, details = null) {
  const lines = [`[${new Date().toISOString()}] ${message}`];

  if (details) {
    lines.push(typeof details === "string" ? details : JSON.stringify(details, null, 2));
  }

  fs.appendFileSync(STARTUP_LOG_PATH, `${lines.join("\n")}\n`);
}

function getAuditLogPath() {
  return path.join(app.getPath("userData"), "audit.log");
}

function getLocalAppStatePath() {
  return path.join(app.getPath("userData"), "app-state.json");
}

function getLegacyUserDataPaths() {
  return [
    path.join(app.getPath("appData"), "@patient-ping", "reception"),
    path.join(app.getPath("appData"), "Echo Reception"),
  ];
}

function normalizeRuntimeRole(runtimeRole, fallback = RUNTIME_ROLE_RECEPTION) {
  const normalizedRuntimeRole = String(runtimeRole || "").trim().toLowerCase();

  return [RUNTIME_ROLE_RECEPTION, RUNTIME_ROLE_ROOM].includes(normalizedRuntimeRole)
    ? normalizedRuntimeRole
    : fallback;
}

function isCurrentRuntimeRoleSupported() {
  return normalizeRuntimeRole(localAppState.runtimeRole, CURRENT_APP_RUNTIME_ROLE) === CURRENT_APP_RUNTIME_ROLE;
}

function shouldOpenRoleWindowOnLaunch() {
  return (
    process.argv.includes("--choose-role") ||
    localAppState.runtimeRoleConfirmed === false ||
    !isCurrentRuntimeRoleSupported()
  );
}

function loadLocalAppState() {
  const localAppStatePath = getLocalAppStatePath();
  const resolvedAppStatePath = fs.existsSync(localAppStatePath)
    ? localAppStatePath
    : getLegacyUserDataPaths()
      .map((legacyPath) => path.join(legacyPath, "app-state.json"))
      .find((legacyPath) => fs.existsSync(legacyPath));

  if (!resolvedAppStatePath) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolvedAppStatePath, "utf8"));
    if (resolvedAppStatePath !== localAppStatePath) {
      fs.mkdirSync(path.dirname(localAppStatePath), { recursive: true });
      fs.copyFileSync(resolvedAppStatePath, localAppStatePath);
    }
    localAppState = {
      ...localAppState,
      runtimeRole: normalizeRuntimeRole(parsed.runtimeRole, RUNTIME_ROLE_RECEPTION),
      runtimeRoleConfirmed:
        typeof parsed.runtimeRoleConfirmed === "boolean"
          ? parsed.runtimeRoleConfirmed
          : localAppState.runtimeRoleConfirmed,
    };
  } catch {
    // Ignore corrupt local app state and fall back to defaults.
  }
}

function saveLocalAppState() {
  const localAppStatePath = getLocalAppStatePath();
  fs.mkdirSync(path.dirname(localAppStatePath), { recursive: true });
  fs.writeFileSync(localAppStatePath, JSON.stringify(localAppState, null, 2));
}

const DEFAULT_PAIRING_CODE = "1234";

function ensureReceptionAccessKey(config) {
  const currentAccessKey = String(config?.auth?.accessKey || "").trim();

  if (currentAccessKey) {
    return config;
  }

  return {
    ...config,
    auth: {
      ...(config?.auth || {}),
      accessKey: DEFAULT_PAIRING_CODE,
    },
  };
}

function appendAuditEntry(entry = {}) {
  const auditLogPath = getAuditLogPath();
  const nextEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
  fs.appendFileSync(auditLogPath, `${JSON.stringify(nextEntry)}\n`);
}

function createWindow(config) {
  const bounds = getWindowBounds(config);
  const appIcon = getAppIcon();
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    resizable: false,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_MINIMIZED_HEIGHT,
    frame: false,
    transparent: RECEPTION_MAIN_WINDOW_IS_TRANSPARENT,
    backgroundColor: RECEPTION_MAIN_WINDOW_BACKGROUND,
    hasShadow: false,
    thickFrame: false,
    alwaysOnTop: config.display.alwaysOnTop,
    skipTaskbar: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (typeof mainWindow.setHasShadow === "function") {
    mainWindow.setHasShadow(false);
  }

  mainWindow.setPosition(bounds.x, bounds.y);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.executeJavaScript(
      `document.body.dataset.platform = ${JSON.stringify(process.platform)};`,
      true,
    ).catch(() => {});
  });
  mainWindow.once("ready-to-show", () => {
    if (typeof mainWindow?.setHasShadow === "function") {
      mainWindow.setHasShadow(false);
    }
    refreshTransparentWindowChrome(mainWindow);
    emitState();
  });
  mainWindow.on("move", () => {
    scheduleWindowPositionSave();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("focus", () => {
    closeMessagePopup();
    refreshTransparentWindowChrome(mainWindow);
  });
  mainWindow.on("blur", () => {
    refreshTransparentWindowChrome(mainWindow);
  });
  mainWindow.on("show", () => {
    refreshTransparentWindowChrome(mainWindow);
  });
}

function refreshTransparentWindowChrome(targetWindow = mainWindow) {
  if (
    process.platform !== "win32" ||
    !RECEPTION_MAIN_WINDOW_IS_TRANSPARENT ||
    !targetWindow ||
    targetWindow.isDestroyed() ||
    typeof targetWindow.setIgnoreMouseEvents !== "function"
  ) {
    return;
  }

  if (typeof targetWindow.setHasShadow === "function") {
    targetWindow.setHasShadow(false);
  }

  targetWindow.setIgnoreMouseEvents(true);
  setTimeout(() => {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.setIgnoreMouseEvents(false);
    }
  }, 30);
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const appIcon = getAppIcon();
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;

  settingsWindow = new BrowserWindow({
    width: WINDOW_ADMIN_WIDTH,
    height: WINDOW_ADMIN_HEIGHT,
    minWidth: WINDOW_ADMIN_WIDTH,
    minHeight: WINDOW_ADMIN_HEIGHT,
    resizable: true,
    frame: false,
    transparent: false,
    autoHideMenuBar: true,
    center: true,
    show: false,
    parent: mainWindow || undefined,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  settingsWindow.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: { view: "settings" },
  });
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
    settingsWindow?.focus();
    settingsWindow?.center();
    settingsWindow?.webContents.send("state:update", buildAppState());
    settingsWindow?.webContents.send("chat:update", chatMessages);
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

function createRoleWindow() {
  if (roleWindow && !roleWindow.isDestroyed()) {
    roleWindow.show();
    roleWindow.focus();
    return roleWindow;
  }

  const appIcon = getAppIcon();
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;

  roleWindow = new BrowserWindow({
    width: 420,
    height: 420,
    minWidth: 420,
    minHeight: 420,
    resizable: false,
    frame: false,
    transparent: false,
    autoHideMenuBar: true,
    center: true,
    show: false,
    parent: mainWindow || undefined,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  roleWindow.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: { view: "role" },
  });
  roleWindow.once("ready-to-show", () => {
    roleWindow?.show();
    roleWindow?.focus();
    roleWindow?.center();
    roleWindow?.webContents.send("state:update", buildAppState());
  });
  roleWindow.on("closed", () => {
    roleWindow = null;
  });

  return roleWindow;
}

function destroyMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const targetWindow = mainWindow;
  mainWindow = null;
  targetWindow.close();
}

function getMainProcessRoomShortLabel(room) {
  return String(room?.shortName || room?.name || "Room").trim().slice(0, 7) || "Room";
}

function formatRelativeAlertTime(timestamp) {
  const sentAt = new Date(timestamp).getTime();
  const diffMs = Math.max(0, Date.now() - sentAt);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes === 1) {
    return "1 min ago";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} mins ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours === 1) {
    return "1 hr ago";
  }

  if (diffHours < 24) {
    return `${diffHours} hrs ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return "1 day ago";
  }

  return `${diffDays} days ago`;
}

function getMessagePopupBounds(options = {}) {
  const popupWidth = Math.max(260, Math.round(Number(options.width) || MESSAGE_POPUP_WIDTH));
  const popupHeight = Math.max(48, Math.round(Number(options.height) || MESSAGE_POPUP_MIN_HEIGHT));
  const referenceBounds =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.getBounds()
      : null;
  const targetDisplay = referenceBounds
    ? screen.getDisplayMatching(referenceBounds)
    : screen.getPrimaryDisplay();
  const screenBounds = targetDisplay.bounds;
  return {
    x: screenBounds.x + Math.max(0, Math.round((screenBounds.width - popupWidth) / 2)),
    y: screenBounds.y,
    width: popupWidth,
    height: popupHeight,
  };
}

function estimateMessagePopupHeight(text = "") {
  const normalizedText = String(text || "").trim();
  const explicitLineCount = normalizedText
    ? normalizedText.split(/\r?\n/).length
    : 1;
  const wrappedLineCount = Math.ceil(normalizedText.length / 18) || 1;
  const lineCount = Math.max(explicitLineCount, wrappedLineCount);

  return Math.min(
    MESSAGE_POPUP_MAX_HEIGHT,
    MESSAGE_POPUP_MIN_HEIGHT + Math.max(0, lineCount - 1) * 20,
  );
}

function createMessagePopupWindow() {
  if (messagePopupWindow && !messagePopupWindow.isDestroyed()) {
    return messagePopupWindow;
  }

  messagePopupWindow = new BrowserWindow({
    ...getMessagePopupBounds(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    type: process.platform === "darwin" ? "panel" : undefined,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "message-popup-preload.js"),
    },
  });

  messagePopupWindow.loadFile(path.join(__dirname, "renderer", "message-popup.html"));
  refreshTransparentWindowChrome(messagePopupWindow);
  messagePopupWindow.on("show", () => refreshTransparentWindowChrome(messagePopupWindow));
  messagePopupWindow.on("focus", () => refreshTransparentWindowChrome(messagePopupWindow));
  messagePopupWindow.on("blur", () => refreshTransparentWindowChrome(messagePopupWindow));
  messagePopupWindow.on("closed", () => {
    messagePopupWindow = null;
  });

  return messagePopupWindow;
}

function sendMessagePopupPayload(payload) {
  if (!messagePopupWindow || messagePopupWindow.isDestroyed()) {
    return;
  }

  const sendPayload = () => {
    if (messagePopupWindow && !messagePopupWindow.isDestroyed()) {
      messagePopupWindow.webContents.send("message-popup:show", payload);
    }
  };

  if (messagePopupWindow.webContents.isLoading()) {
    messagePopupWindow.webContents.once("did-finish-load", sendPayload);
    return;
  }

  sendPayload();
}

function closeMessagePopup() {
  if (!messagePopupWindow || messagePopupWindow.isDestroyed()) {
    messagePopupWindow = null;
    return;
  }

  messagePopupWindow.close();
}

function shouldShowPopup(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true;
  }

  const includeMessagesVisibility = Boolean(options.includeMessagesVisibility);

  return (
    !mainWindow.isVisible() ||
    mainWindow.isMinimized() ||
    !mainWindow.isFocused() ||
    Boolean(configState?.display?.minimized) ||
    (includeMessagesVisibility && !Boolean(configState?.display?.messagesVisible))
  );
}

function showMessagePopup(payload = {}) {
  if (!shouldShowPopup({ includeMessagesVisibility: true })) {
    return;
  }

  latestMessagePopupPayload = {
    kind: "message",
    ...payload,
  };
  const popupWindow = createMessagePopupWindow();
  popupWindow.setBounds(getMessagePopupBounds({
    height: estimateMessagePopupHeight(latestMessagePopupPayload.text),
  }), false);
  popupWindow.showInactive();
  refreshTransparentWindowChrome(popupWindow);
  sendMessagePopupPayload(latestMessagePopupPayload);
}

function getRoomAlertNotifications(roomId) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    return [];
  }

  return [
    ...(activeNotification ? [activeNotification] : []),
    ...notificationQueue,
  ].filter((notification) => notification.roomId === normalizedRoomId);
}

function getReceptionMessagePopupPayload(message = {}) {
  if (
    String(message?.senderType || "").trim() !== "room" ||
    !message?.sendToReception
  ) {
    return null;
  }

  const senderRoomId = String(message.senderRoomId || "").trim();
  const room = (configState?.rooms || []).find((item) => item.id === senderRoomId) || null;

  return {
    messageId: String(message.messageId || "").trim(),
    kind: "message",
    roomId: senderRoomId,
    sourceLabel: String(message.senderShortLabel || getMainProcessRoomShortLabel(room)).trim(),
    text: String(message.text || "New message").trim(),
    accentColor: String(room?.color || "#0f766e").trim(),
  };
}

function showAlertPopup(notification = {}) {
  if (!shouldShowPopup()) {
    return false;
  }

  const roomId = String(notification.roomId || "").trim();
  const room = (configState?.rooms || []).find((item) => item.id === roomId) || null;
  const alertCount =
    (activeNotification?.roomId === roomId ? 1 : 0) +
    notificationQueue.filter((queuedNotification) => queuedNotification.roomId === roomId).length +
    1;
  const payload = buildAlertPopupPayload(notification, alertCount, room);

  latestMessagePopupPayload = payload;
  const popupWindow = createMessagePopupWindow();
  popupWindow.setBounds(getMessagePopupBounds({
    width: ALERT_POPUP_WIDTH,
    height: ALERT_POPUP_HEIGHT,
  }), false);
  popupWindow.showInactive();
  refreshTransparentWindowChrome(popupWindow);
  sendMessagePopupPayload(payload);
  return true;
}

function buildAlertPopupPayload(notification = {}, alertCount = 1, room = null) {
  return {
    kind: "alert",
    notificationId: String(notification.notificationId || "").trim(),
    roomId: String(notification.roomId || "").trim(),
    sourceLabel: String(notification.roomShortName || getMainProcessRoomShortLabel(room)).trim(),
    text: String(notification.message || "New alert").trim() || "New alert",
    formattedTime: formatRelativeAlertTime(notification.timestamp),
    alertCount: Math.max(1, Math.round(Number(alertCount) || 1)),
    accentColor: String(notification.roomColor || room?.color || "#0f766e").trim(),
  };
}

function syncAlertPopupForRoom(roomId) {
  if (
    latestMessagePopupPayload?.kind !== "alert" ||
    latestMessagePopupPayload.roomId !== roomId ||
    !messagePopupWindow ||
    messagePopupWindow.isDestroyed()
  ) {
    return;
  }

  const alerts = getRoomAlertNotifications(roomId);

  if (alerts.length === 0) {
    closeMessagePopup();
    return;
  }

  const room = (configState?.rooms || []).find((item) => item.id === roomId) || null;
  latestMessagePopupPayload = buildAlertPopupPayload(alerts[0], alerts.length, room);
  sendMessagePopupPayload(latestMessagePopupPayload);
}

async function showMainWindowFromMessagePopup(options = {}) {
  const popupPayload = latestMessagePopupPayload;
  const shouldOpenMessage = Boolean(options.openMessage);
  closeMessagePopup();

  if (configState?.display) {
    const displayPatch =
      popupPayload?.kind === "alert" && !shouldOpenMessage
        ? { minimized: false }
        : { minimized: false, messagesVisible: true };

    await updateDisplaySettings({
      ...displayPatch,
    }).catch((error) => {
      logStartup("Failed to expand reception window from message popup", {
        message: error.message,
      });
    });
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createRoleWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.setAlwaysOnTop(true);
  mainWindow.moveTop();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(Boolean(configState?.display?.alwaysOnTop));
  if (popupPayload?.kind === "message" || shouldOpenMessage) {
    mainWindow.webContents.send("message-popup:open", popupPayload);
  }
}

function loadIconFromPaths(iconPaths) {
  for (const iconPath of iconPaths) {
    const icon = nativeImage.createFromPath(iconPath);

    if (!icon.isEmpty()) {
      return icon;
    }
  }

  return nativeImage.createEmpty();
}

function getAppIcon() {
  return loadIconFromPaths([
    path.join(__dirname, "assets", "tray-icon.ico"),
    path.join(__dirname, "assets", "tray-icon.png"),
  ]);
}

function getBrandLogoDataUrl() {
  const logoPath = path.join(__dirname, "assets", "tray-icon.png");

  if (!fs.existsSync(logoPath)) {
    return "";
  }

  return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
}

function getTrayIcon() {
  const icon = getAppIcon();

  if (!icon.isEmpty()) {
    return icon.resize({ width: 16, height: 16 });
  }

  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="16" fill="#0f766e"/>
      <circle cx="32" cy="32" r="14" fill="#ffffff"/>
      <circle cx="32" cy="32" r="7" fill="#0f766e"/>
    </svg>
  `;
  const fallbackIcon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString("base64")}`,
  );
  return fallbackIcon.resize({ width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip("Pip Reception");
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    createRoleWindow();
  });
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    createRoleWindow();
  });
  refreshTrayMenu();
}

function configureAboutPanel() {
  app.setAboutPanelOptions({
    applicationName: "Pip (Reception)",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    credits: "Developed by Blackworks",
    authors: ["Blackworks"],
    copyright: "Blackworks",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function showAboutDialog() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }

  const appName = "Pip (Reception)";
  const appVersion = app.getVersion();
  const brandLogoDataUrl = getBrandLogoDataUrl();
  const appIcon = getAppIcon();
  const parentWindow = mainWindow && mainWindow.isVisible() ? mainWindow : null;
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;

  aboutWindow = new BrowserWindow({
    width: 360,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: false,
    backgroundColor: "#FFFFFF",
    hasShadow: false,
    title: `About ${appName}`,
    icon: windowIcon,
    webPreferences: {
      sandbox: false,
    },
  });
  aboutWindow.removeMenu?.();

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>About ${escapeHtml(appName)}</title>
      <style>
        :root {
          color-scheme: light;
          --bg: #f4f7f5;
          --panel: #ffffff;
          --text: #10231f;
          --muted: #5f726c;
          --line: rgba(16, 35, 31, 0.10);
          --accent: #0f766e;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          border-radius: 24px;
          background: #ffffff;
          color: var(--text);
          font-family: "Roboto", "Avenir Next", "Segoe UI", sans-serif;
        }

        .about-card {
          position: relative;
          width: 100vw;
          height: 100vh;
          padding: 28px 26px 22px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background: #ffffff;
          text-align: center;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .about-logo {
          display: block;
          width: 104px;
          height: 104px;
          margin: 0 auto 22px;
          object-fit: contain;
          filter: grayscale(1);
        }

        .about-title {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }

        .about-version,
        .about-line {
          margin: 10px 0 0;
          font-size: 14px;
        }

        .about-version {
          font-weight: 700;
        }

        .about-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 999px;
          padding: 0;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          overflow: hidden;
          text-indent: -9999px;
        }

        .about-close::before,
        .about-close::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 15px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
        }

        .about-close::before {
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .about-close::after {
          transform: translate(-50%, -50%) rotate(-45deg);
        }

        .about-close:hover {
          background: rgba(16, 35, 31, 0.08);
        }
      </style>
    </head>
    <body>
      <main class="about-card">
        ${brandLogoDataUrl ? `<img class="about-logo" src="${brandLogoDataUrl}" alt="Pip" />` : ""}
        <h1 class="about-title">${escapeHtml(appName)}</h1>
        <p class="about-version">Version ${escapeHtml(appVersion)}</p>
        <p class="about-line">Developed by Blackworks</p>
        <p class="about-line">2026 &copy; Copyright | All Rights Reserved</p>
        <button class="about-close" type="button" onclick="window.close()" aria-label="Close">Close</button>
      </main>
    </body>
  </html>`;

  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  aboutWindow.once("ready-to-show", () => {
    aboutWindow?.show();
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const hasSupportedMainWindow = Boolean(mainWindow);

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Always on top",
        type: "checkbox",
        checked: Boolean(configState?.display?.alwaysOnTop),
        click: (menuItem) => {
          updateDisplaySettings({
            alwaysOnTop: menuItem.checked,
          });
        },
      },
      {
        label: "Minimise at startup",
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
          }
        },
      },
      {
        label: "Run at startup",
        type: "checkbox",
        checked: configState?.display?.launchAtStartup !== false,
        click: (menuItem) => {
          updateDisplaySettings({
            launchAtStartup: menuItem.checked,
          });
        },
      },
      {
        type: "separator",
      },
      {
        label: "About",
        click: () => {
          showAboutDialog();
        },
      },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]),
  );
}

function setLaunchAtStartup(enabled) {
  const shouldLaunchAtStartup = Boolean(enabled);
  app.setLoginItemSettings({
    openAtLogin: shouldLaunchAtStartup,
    openAsHidden: false,
  });
}

function playReceptionNotificationSound(notification) {
  const masterVolume = clampReceptionVolume(configState?.audio?.masterVolume);
  const selectedSound = normalizeBundledReceptionSound(
    String(
      configState?.audio?.notificationSound ||
        configState?.rooms?.find((item) => item.id === notification?.roomId)?.receptionSound?.sound ||
        DEFAULT_RECEPTION_SOUND,
    ),
  );

  if (masterVolume <= 0) {
    return;
  }

  const command = buildReceptionSoundCommand(selectedSound, masterVolume);

  if (!command) {
    return;
  }

  exec(command, (error) => {
    if (error) {
      logStartup("Reception sound playback failed", {
        roomId: notification?.roomId || null,
        sound: selectedSound,
        message: error.message,
      });
    }
  });
}

function playReceptionChatSound(message) {
  if (!message?.sendToReception || message?.senderType !== "room") {
    return;
  }

  const messageVolume = clampReceptionVolume(configState?.audio?.messageVolume);
  const selectedSound = normalizeBundledReceptionSound(
    String(configState?.audio?.messageSound || DEFAULT_RECEPTION_SOUND),
  );

  if (messageVolume <= 0) {
    return;
  }

  const command = buildReceptionSoundCommand(selectedSound, messageVolume);

  if (!command) {
    return;
  }

  exec(command, (error) => {
    if (error) {
      logStartup("Reception message sound playback failed", {
        roomId: message.senderRoomId || null,
        sound: selectedSound,
        message: error.message,
      });
    }
  });
}

function clampReceptionVolume(volume) {
  const parsed = Number(volume);

  if (!Number.isFinite(parsed)) {
    return 80;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function buildReceptionSoundCommand(sound, masterVolume) {
  const selectedSound = normalizeBundledReceptionSound(sound);
  const soundPath = resolveReceptionSoundPath(selectedSound);
  const platform = process.platform;

  if (platform === "darwin") {
    const volume = Math.max(0, Math.min(1, masterVolume / 100)).toFixed(2);
    return `afplay -v ${volume} "${escapeDoubleQuotedPath(soundPath)}"`;
  }

  if (platform === "win32") {
    return `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer '${escapePowerShellPath(soundPath)}').PlaySync()"`;
  }

  return "printf '\\a'";
}

function normalizeBundledReceptionSound(sound) {
  const normalized = String(sound || DEFAULT_RECEPTION_SOUND)
    .trim()
    .toLowerCase();
  const mapped = LEGACY_RECEPTION_SOUND_ALIASES[normalized] || normalized;
  return RECEPTION_SOUND_FILE_MAP[mapped] ? mapped : DEFAULT_RECEPTION_SOUND;
}

function resolveReceptionSoundPath(sound) {
  const soundFileName = RECEPTION_SOUND_FILE_MAP[sound] || RECEPTION_SOUND_FILE_MAP[DEFAULT_RECEPTION_SOUND];
  const candidates = [
    path.join(process.resourcesPath || "", "app.asar.unpacked", "src", "assets", "sounds", soundFileName),
    path.join(__dirname, "assets", "sounds", soundFileName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[candidates.length - 1];
}

function escapeDoubleQuotedPath(value) {
  return String(value || "").replace(/(["\\$`])/g, "\\$1");
}

function escapePowerShellPath(value) {
  return String(value || "").replace(/'/g, "''");
}

function pushNotification(notification) {
  playReceptionNotificationSound(notification);
  showAlertPopup(notification);
  notificationQueue.push(notification);

  if (!activeNotification) {
    activeNotification = notificationQueue.shift() || null;
    emitNotification(activeNotification);
  }

  emitState();
}

function dismissActiveNotification() {
  const dismissedNotification = activeNotification;
  activeNotification = notificationQueue.shift() || null;

  if (activeNotification) {
    emitNotification(activeNotification);
  }

  emitState();
  syncAlertPopupForRoom(dismissedNotification?.roomId || "");
  return dismissedNotification;
}

function dismissNotificationById(notificationId) {
  if (!notificationId) {
    return null;
  }

  if (activeNotification?.notificationId === notificationId) {
    return dismissActiveNotification();
  }

  const queuedIndex = notificationQueue.findIndex(
    (notification) => notification.notificationId === notificationId,
  );

  if (queuedIndex === -1) {
    return null;
  }

  const [dismissedNotification] = notificationQueue.splice(queuedIndex, 1);
  emitState();
  syncAlertPopupForRoom(dismissedNotification?.roomId || "");
  return dismissedNotification || null;
}

function clearNotificationsByIds(notificationIds = []) {
  const idsToClear = new Set(
    notificationIds
      .map((notificationId) => String(notificationId || "").trim())
      .filter(Boolean),
  );

  if (idsToClear.size === 0) {
    return;
  }

  const affectedRoomIds = new Set(
    [
      ...(activeNotification?.notificationId && idsToClear.has(activeNotification.notificationId)
        ? [activeNotification.roomId]
        : []),
      ...notificationQueue
        .filter((notification) => idsToClear.has(notification.notificationId))
        .map((notification) => notification.roomId),
    ].filter(Boolean),
  );

  if (activeNotification?.notificationId && idsToClear.has(activeNotification.notificationId)) {
    activeNotification = notificationQueue.shift() || null;
  }

  notificationQueue = notificationQueue.filter(
    (notification) => !idsToClear.has(notification.notificationId),
  );

  if (!activeNotification && notificationQueue.length > 0) {
    activeNotification = notificationQueue.shift() || null;
  }

  emitState();
  affectedRoomIds.forEach((roomId) => syncAlertPopupForRoom(roomId));
}

function pingRoomById(roomId) {
  return configState.rooms.find((room) => room.id === roomId) || null;
}

function emitNotification(notification) {
  if (!mainWindow) {
    return;
  }

  const shouldKeepMainWindowHidden = shouldShowPopup();

  mainWindow.webContents.send("notification:update", {
    ...notification,
    formattedTime: formatTimeFn(notification.timestamp),
    autoHideMs: configState.display.autoHideMs,
    pendingCount: notificationQueue.length,
  });

  if (!shouldKeepMainWindowHidden) {
    mainWindow.showInactive();
  }
}

function buildAppState() {
  return {
    app: localAppState,
    config: configState,
    activeNotification,
    queuedNotifications: notificationQueue,
    pendingNotifications: notificationQueue.length,
    chatMessages,
    service: serviceState,
  };
}

function emitState() {
  if (mainWindow) {
    mainWindow.webContents.send("state:update", buildAppState());
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("state:update", buildAppState());
  }

  if (roleWindow && !roleWindow.isDestroyed()) {
    roleWindow.webContents.send("state:update", buildAppState());
  }
}

function emitChatMessages() {
  if (mainWindow) {
    mainWindow.webContents.send("chat:update", chatMessages);
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("chat:update", chatMessages);
  }
}

function resizeForDisplayMode(options = {}) {
  if (!mainWindow || !configState) {
    return;
  }

  const bounds = getWindowBounds(configState, mainWindow.getBounds(), options);

  mainWindow.setAlwaysOnTop(Boolean(configState.display.alwaysOnTop));
  mainWindow.setResizable(false);
  mainWindow.setMinimumSize(WINDOW_WIDTH, WINDOW_MINIMIZED_HEIGHT);
  isProgrammaticWindowMove = true;
  mainWindow.setBounds(bounds, true);
  setTimeout(() => {
    isProgrammaticWindowMove = false;
  }, 250);
}

function getWindowBounds(config, currentBounds = null, options = {}) {
  const savedWindowPosition = getSavedWindowPosition(config);
  const referenceBounds = currentBounds || (
    savedWindowPosition
      ? {
          x: savedWindowPosition.x,
          y: savedWindowPosition.y,
          width: WINDOW_WIDTH,
          height: WINDOW_MINIMIZED_HEIGHT,
        }
      : null
  );
  const targetDisplay = referenceBounds
    ? screen.getDisplayMatching(referenceBounds)
    : screen.getPrimaryDisplay();
  const workArea = targetDisplay.workArea;
  const isExpanded = Boolean(config.display.expanded);
  const desiredWidth = isExpanded ? WINDOW_EXPANDED_WIDTH : WINDOW_WIDTH;
  const desiredHeight = config.display.minimized
    ? WINDOW_MINIMIZED_HEIGHT
    : getGadgetHeight(config);

  const width = Math.min(desiredWidth, workArea.width);
  const height = Math.min(desiredHeight, workArea.height);
  const defaultX = workArea.x + Math.max(0, Math.round((workArea.width - width) / 2));
  const defaultY = workArea.y + Math.max(0, Math.round((workArea.height - height) / 2));

  if (!referenceBounds) {
    return {
      x: defaultX,
      y: defaultY,
      width,
      height,
    };
  }

  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  if (isExpanded) {
    return {
      x: defaultX,
      y: defaultY,
      width,
      height,
    };
  }

  if (options.overridePosition) {
    return {
      x: Math.min(Math.max(options.overridePosition.x, workArea.x), Math.max(workArea.x, maxX)),
      y: Math.min(Math.max(options.overridePosition.y, workArea.y), Math.max(workArea.y, maxY)),
      width,
      height,
    };
  }

  const preferredY =
    options.preserveBottom && !config.display.minimized
      ? referenceBounds.y + referenceBounds.height - height
      : referenceBounds.y;

  return {
    x: Math.min(Math.max(referenceBounds.x, workArea.x), Math.max(workArea.x, maxX)),
    y: Math.min(Math.max(preferredY, workArea.y), Math.max(workArea.y, maxY)),
    width,
    height,
  };
}

function getSavedWindowPosition(config) {
  const x = Number(config?.display?.windowPosition?.x);
  const y = Number(config?.display?.windowPosition?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function scheduleWindowPositionSave() {
  if (!mainWindow || !configState || !saveConfigFn) {
    return;
  }

  if (isProgrammaticWindowMove || configState.display?.expanded) {
    return;
  }

  if (saveWindowPositionTimer) {
    clearTimeout(saveWindowPositionTimer);
  }

  saveWindowPositionTimer = setTimeout(() => {
    saveWindowPositionTimer = null;
    persistWindowPosition();
  }, 180);
}

function persistWindowPosition() {
  if (!mainWindow || !configState || !saveConfigFn) {
    return;
  }

  const [x, y] = mainWindow.getPosition();
  const nextDisplay = {
    ...configState.display,
    windowPosition: {
      x,
      y,
    },
  };

  configState = saveConfigFn({
    ...configState,
    display: nextDisplay,
  });
}

function getGadgetHeight(config) {
  const hiddenMessagesTrim =
    config?.display?.messagesVisible
      ? 0
      : config?.display?.minimized
        ? GADGET_COMPACT_HIDDEN_MESSAGES_HEIGHT_TRIM
        : GADGET_HIDDEN_MESSAGES_HEIGHT_TRIM;

  if (Number.isFinite(measuredGadgetHeight) && measuredGadgetHeight > 0) {
    return Math.max(
      WINDOW_MINIMIZED_HEIGHT,
      Math.ceil(measuredGadgetHeight) - GADGET_WINDOW_HEIGHT_TRIM - hiddenMessagesTrim,
    );
  }

  const roomCount = Math.max(1, config.rooms?.length || 0);
  return GADGET_HEADER_HEIGHT
    + roomCount * GADGET_ROW_HEIGHT
    + GADGET_FRAME_PADDING
    + 60
    - GADGET_WINDOW_HEIGHT_TRIM
    - hiddenMessagesTrim;
}

function initializeConfigPath() {
  const userConfigPath = path.join(app.getPath("userData"), "config.json");
  logStartup("Initializing config path", {
    userConfigPath,
    resourcesPath: process.resourcesPath,
  });

  if (fs.existsSync(userConfigPath)) {
    process.env.PIP_CONFIG_PATH = userConfigPath;
    logStartup("Using existing user config", userConfigPath);
    return userConfigPath;
  }

  const legacyConfigPath = getLegacyUserDataPaths()
    .map((legacyPath) => path.join(legacyPath, "config.json"))
    .find((legacyPath) => fs.existsSync(legacyPath));

  if (legacyConfigPath) {
    fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
    fs.copyFileSync(legacyConfigPath, userConfigPath);
    process.env.PIP_CONFIG_PATH = userConfigPath;
    logStartup("Migrated legacy user config", {
      legacyConfigPath,
      userConfigPath,
    });
    return userConfigPath;
  }

  const bundledCandidates = [
    path.join(process.resourcesPath, "config", "config.json"),
    path.resolve(process.cwd(), "config", "config.json"),
    path.resolve(__dirname, "..", "..", "..", "config", "config.json"),
  ];

  const bundledConfigPath = bundledCandidates.find((candidate) => fs.existsSync(candidate));
  logStartup("Resolved bundled config candidate", {
    bundledCandidates,
    bundledConfigPath: bundledConfigPath || null,
  });

  fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });

  if (bundledConfigPath) {
    fs.copyFileSync(bundledConfigPath, userConfigPath);
    logStartup("Copied bundled config to user data", userConfigPath);
  }

  process.env.PIP_CONFIG_PATH = userConfigPath;
  return userConfigPath;
}

async function updateDisplaySettings(patch) {
  const wasExpanded = Boolean(configState.display.expanded);
  const willBeExpanded = typeof patch.expanded === "boolean" ? patch.expanded : wasExpanded;

  if (!wasExpanded && willBeExpanded && mainWindow && !mainWindow.isDestroyed()) {
    const { x, y } = mainWindow.getBounds();
    preExpandWindowPosition = { x, y };
  }

  const restoredWindowPosition =
    wasExpanded && !willBeExpanded && preExpandWindowPosition
      ? preExpandWindowPosition
      : null;

  configState = {
    ...configState,
    display: {
      ...configState.display,
      ...patch,
      ...(restoredWindowPosition
        ? {
            windowPosition: {
              x: restoredWindowPosition.x,
              y: restoredWindowPosition.y,
            },
          }
        : {}),
    },
  };

  configState = saveConfigFn(configState);
  setLaunchAtStartup(configState.display.launchAtStartup);

  const resizeOptions = {};
  if (restoredWindowPosition) {
    resizeOptions.overridePosition = restoredWindowPosition;
    restorePositionOnNextGadgetHeight = restoredWindowPosition;
  }
  resizeForDisplayMode(resizeOptions);

  if (wasExpanded && !willBeExpanded) {
    preExpandWindowPosition = null;
  }

  refreshTrayMenu();
  emitState();

  return configState.display;
}

app.whenReady().then(async () => {
  logStartup("App ready");
  configureAboutPanel();
  loadLocalAppState();
  saveLocalAppState();
  initializeConfigPath();

  const { loadConfig, saveConfig, formatTime, normalizeConfig, validateConfig } = await import("@pip/shared");
  loadConfigFn = loadConfig;
  saveConfigFn = saveConfig;
  formatTimeFn = formatTime;
  configState = normalizeConfig(loadConfigFn());
  if (!String(configState?.attachments?.rootPath || "").trim()) {
    configState = {
      ...configState,
      attachments: {
        ...(configState.attachments || {}),
        rootPath: path.join(app.getPath("userData"), "attachments"),
      },
    };
  }

  if (!String(configState?.auth?.accessKey || "").trim()) {
    configState = saveConfigFn(ensureReceptionAccessKey(configState));
  }
  setLaunchAtStartup(configState.display.launchAtStartup);
  let server = null;

  const startReceptionRuntime = async () => {
    if (server) {
      return server;
    }

    server = await createReceptionServer({
      config: () => configState,
      onNotification: (notification) => {
        pushNotification(notification);
        serviceState = server.getStatus();
        emitState();
      },
      onNotificationCancelled: (notificationId) => {
        const cancelledNotification = dismissNotificationById(notificationId);
        serviceState = server.getStatus();
        emitState();
        return cancelledNotification;
      },
      onNotificationsCleared: ({ clearedNotificationIds } = {}) => {
        clearNotificationsByIds(clearedNotificationIds);
        serviceState = server.getStatus();
        emitState();
      },
      onPingCleared: (payload) => {
        mainWindow?.webContents.send("room:pingCleared", payload);
      },
      onChatMessage: (message) => {
        chatMessages = server.getChatMessages();
        playReceptionChatSound(message);
        const popupPayload = getReceptionMessagePopupPayload(message);
        if (popupPayload) {
          showMessagePopup(popupPayload);
        }
        emitChatMessages();
        emitState();
      },
      onChatDeleted: () => {
        chatMessages = server.getChatMessages();
        emitChatMessages();
        emitState();
      },
      onChatEdited: () => {
        chatMessages = server.getChatMessages();
        emitChatMessages();
        emitState();
      },
      onAuditEvent: (entry) => {
        appendAuditEntry(entry);
      },
    });

    serviceState = server.getStatus();
    chatMessages = server.getChatMessages();
    logStartup("Started reception server", serviceState);
    logStartup("Audit log ready", getAuditLogPath());
    emitChatMessages();
    emitState();
    return server;
  };

  const stopReceptionRuntime = async () => {
    if (!server) {
      return;
    }

    server.close();
    server = null;
    serviceState = {
      host: null,
      port: null,
      connectedClients: 0,
      notificationCount: 0,
    };
    emitState();
  };

  ipcMain.handle("app:getStatus", () => {
    if (server) {
      serviceState = server.getStatus();
    }
    return buildAppState();
  });
  ipcMain.handle("app:openSettingsWindow", () => {
    createSettingsWindow();
    return { ok: true };
  });
  ipcMain.handle("app:openRoleWindow", () => {
    createRoleWindow();
    return { ok: true };
  });
  ipcMain.handle("app:getRoleState", () => ({
    runtimeRole: localAppState.runtimeRole,
    runtimeRoleConfirmed: Boolean(localAppState.runtimeRoleConfirmed),
    supportedRoles: [RUNTIME_ROLE_RECEPTION, RUNTIME_ROLE_ROOM],
    nativeRuntimeRole: CURRENT_APP_RUNTIME_ROLE,
    isSupportedInThisBuild: isCurrentRuntimeRoleSupported(),
    requiresRestartAfterChange: false,
  }));
  ipcMain.handle("app:updateRoleState", (_event, patch = {}) => {
    const previousRuntimeRole = localAppState.runtimeRole;
    localAppState = {
      ...localAppState,
      runtimeRole:
        typeof patch.runtimeRole === "string"
          ? normalizeRuntimeRole(patch.runtimeRole, localAppState.runtimeRole)
          : localAppState.runtimeRole,
      runtimeRoleConfirmed:
        typeof patch.runtimeRoleConfirmed === "boolean"
          ? patch.runtimeRoleConfirmed
          : localAppState.runtimeRoleConfirmed,
    };
    saveLocalAppState();
    const nextRoleState = {
      runtimeRole: localAppState.runtimeRole,
      runtimeRoleConfirmed: Boolean(localAppState.runtimeRoleConfirmed),
      supportedRoles: [RUNTIME_ROLE_RECEPTION, RUNTIME_ROLE_ROOM],
      nativeRuntimeRole: CURRENT_APP_RUNTIME_ROLE,
      isSupportedInThisBuild: isCurrentRuntimeRoleSupported(),
      requiresRestartAfterChange: false,
    };
    emitState();

    return (async () => {
      if (localAppState.runtimeRole !== previousRuntimeRole) {
        if (isCurrentRuntimeRoleSupported()) {
          if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow(configState);
          }
          await startReceptionRuntime();
        } else {
          await stopReceptionRuntime();
          destroyMainWindow();
          createRoleWindow();
        }

        refreshTrayMenu();
      }

      return nextRoleState;
    })();
  });
  ipcMain.handle("app:closeRoleWindow", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.close();
    }

    return { ok: true };
  });

  ipcMain.handle("message-popup:close", () => {
    closeMessagePopup();
    return { ok: true };
  });

  ipcMain.handle("message-popup:openMain", async () => {
    await showMainWindowFromMessagePopup();
    return { ok: true };
  });

  ipcMain.handle("message-popup:openMessage", async () => {
    await showMainWindowFromMessagePopup({ openMessage: true });
    return { ok: true };
  });

  ipcMain.handle("app:minimizeWindow", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.minimize();
    }

    return { ok: true };
  });

  ipcMain.handle("config:get", () => configState);
  ipcMain.handle("audio:playReceptionTestSound", (_event, options = {}) => {
    const command = buildReceptionSoundCommand(options.sound, options.volume);

    if (!command || clampReceptionVolume(options.volume) <= 0) {
      return { ok: true };
    }

    exec(command, () => {});
    return { ok: true };
  });

  ipcMain.handle("config:save", (_event, nextConfig) => {
    const result = validateConfig(nextConfig);

    if (!result.valid) {
      return {
        ok: false,
        errors: result.errors,
      };
    }

    const nextDisplay = {
      ...configState.display,
      ...result.normalized.display,
    };
    const nextAuth = {
      ...configState.auth,
      ...result.normalized.auth,
      accessKey:
        String(result.normalized.auth?.accessKey || "").trim() ||
        String(configState.auth?.accessKey || "").trim(),
    };

    configState = saveConfigFn(ensureReceptionAccessKey({
      ...result.normalized,
      auth: nextAuth,
      display: nextDisplay,
    }));

    setLaunchAtStartup(configState.display.launchAtStartup);
    resizeForDisplayMode();
    refreshTrayMenu();
    emitState();

    return {
      ok: true,
      config: configState,
      errors: [],
    };
  });

  ipcMain.handle("notification:dismiss", () => {
    const dismissedNotification = dismissActiveNotification();
    if (dismissedNotification) {
      server?.acknowledgeNotification(dismissedNotification);
    }
    return { ok: true, pendingNotifications: notificationQueue.length };
  });

  ipcMain.handle("notification:dismissById", (_event, notificationId) => {
    const dismissedNotification = dismissNotificationById(notificationId);
    if (dismissedNotification) {
      server?.acknowledgeNotification(dismissedNotification);
    }
    return {
      ok: Boolean(dismissedNotification),
      pendingNotifications: notificationQueue.length,
    };
  });

  ipcMain.handle("notification:next", () => {
    const dismissedNotification = dismissActiveNotification();
    if (dismissedNotification) {
      server?.acknowledgeNotification(dismissedNotification);
    }
    return { ok: true, pendingNotifications: notificationQueue.length };
  });

  ipcMain.handle("room:ping", (_event, roomId) => {
    const room = pingRoomById(roomId);
    if (room) {
      server.pingRoom(room);
    }
    return { ok: Boolean(room) };
  });

  ipcMain.handle("room:clearPing", (_event, roomId) => {
    const room = pingRoomById(roomId);
    if (room) {
      server.clearRoomPing(room);
    }
    return { ok: Boolean(room) };
  });

  ipcMain.handle("chat:send", (_event, payload = {}) => {
    try {
      const message = server.sendChatMessage({
        senderType: "reception",
        senderRoomId: null,
        recipientRoomIds: Array.isArray(payload.recipientRoomIds) ? payload.recipientRoomIds : [],
        sendToReception: false,
        messageGroupKey: payload.messageGroupKey,
        messageGroupLabel: payload.messageGroupLabel,
        messageGroupParticipantRoomIds: payload.messageGroupParticipantRoomIds,
        text: payload.text,
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        source: "reception-ui",
      }, {
        transport: "local",
      });
      chatMessages = server.getChatMessages();
      emitChatMessages();
      emitState();
      return {
        ok: true,
        payload: message,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle("chat:delete", (_event, messageId) => {
    try {
      const deleted = server.deleteChatMessage(messageId, {
        transport: "local",
      });
      chatMessages = server.getChatMessages();
      emitChatMessages();
      emitState();
      return {
        ok: deleted,
        messageId,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle("chat:edit", (_event, messageId, text) => {
    try {
      const edited = server.editChatMessage(messageId, text, {
        transport: "local",
      });
      chatMessages = server.getChatMessages();
      emitChatMessages();
      emitState();
      return {
        ok: edited,
        messageId,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle("display:update", async (_event, patch) => {
    const nextPatch = {};

    if (typeof patch.alwaysOnTop === "boolean") {
      nextPatch.alwaysOnTop = patch.alwaysOnTop;
    }

    if (typeof patch.minimized === "boolean") {
      nextPatch.minimized = patch.minimized;
    }

    if (typeof patch.autoHideMs === "number" && patch.autoHideMs >= 0) {
      nextPatch.autoHideMs = patch.autoHideMs;
    }

    if (typeof patch.compactMode === "boolean") {
      nextPatch.compactMode = patch.compactMode;
    }

    if (typeof patch.messagesVisible === "boolean") {
      nextPatch.messagesVisible = patch.messagesVisible;
    }

    if (typeof patch.expanded === "boolean") {
      nextPatch.expanded = patch.expanded;
    }

    return updateDisplaySettings(nextPatch);
  });

  ipcMain.handle("display:updateGadgetHeight", async (_event, height) => {
    if (!configState || configState.display.minimized) {
      return { ok: false };
    }

    const nextHeight = Number(height);

    if (!Number.isFinite(nextHeight) || nextHeight <= 0) {
      return { ok: false };
    }

    measuredGadgetHeight = nextHeight;
    if (restorePositionOnNextGadgetHeight) {
      resizeForDisplayMode({ overridePosition: restorePositionOnNextGadgetHeight });
      restorePositionOnNextGadgetHeight = null;
    } else {
      resizeForDisplayMode({ preserveBottom: true });
    }

    return { ok: true, height: measuredGadgetHeight };
  });

  ipcMain.handle("app:confirmQuit", async () => {
    const response = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Cancel", "Quit"],
      defaultId: 1,
      cancelId: 0,
      title: "Quit Pip",
      message: "Do you want to quit Pip?",
      detail: "Stopping Pip will end the messaging service between rooms.",
      noLink: true,
    });

    if (response.response === 1) {
      app.quit();
      return { ok: true, quit: true };
    }

    return { ok: true, quit: false };
  });

  createTray();
  logStartup("Created tray");

  if (isCurrentRuntimeRoleSupported()) {
    createWindow(configState);
    logStartup("Created main window");
  }

  if (shouldOpenRoleWindowOnLaunch()) {
    createRoleWindow();
  }
  if (isCurrentRuntimeRoleSupported()) {
    await startReceptionRuntime();
  } else {
    logStartup(
      `startup blocked because saved runtimeRole=${localAppState.runtimeRole} is not supported by this build`,
    );
  }

  app.on("activate", () => {
    if (!isCurrentRuntimeRoleSupported()) {
      createRoleWindow();
      return;
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(configState);
    } else {
      mainWindow?.show();
    }
  });
}).catch((error) => {
  logStartup("Startup failed", {
    message: error.message,
    stack: error.stack,
  });
  throw error;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (saveWindowPositionTimer) {
    clearTimeout(saveWindowPositionTimer);
    saveWindowPositionTimer = null;
  }
  persistWindowPosition();
});
