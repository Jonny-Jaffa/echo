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
let aboutWindow = null;
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

const WINDOW_WIDTH = 456;
const WINDOW_MINIMIZED_HEIGHT = 96;
const WINDOW_ADMIN_WIDTH = WINDOW_WIDTH;
const WINDOW_ADMIN_HEIGHT = 600;
const GADGET_HEADER_HEIGHT = 0;
const GADGET_ROW_HEIGHT = 40;
const GADGET_FRAME_PADDING = 7;
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

  if (!fs.existsSync(localAppStatePath)) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(localAppStatePath, "utf8"));
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
    transparent: false,
    alwaysOnTop: config.display.alwaysOnTop,
    skipTaskbar: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.setPosition(bounds.x, bounds.y);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => {
    emitState();
  });
  mainWindow.on("move", () => {
    scheduleWindowPositionSave();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
  const logoPath = path.join(__dirname, "assets", "patient-pip-logo-colour.png");

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
    applicationName: "Patient Pip",
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

  const appName = "Patient Pip";
  const appVersion = app.getVersion();
  const brandLogoDataUrl = getBrandLogoDataUrl();
  const appIcon = getAppIcon();
  const parentWindow = mainWindow && mainWindow.isVisible() ? mainWindow : null;
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;

  aboutWindow = new BrowserWindow({
    width: 420,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: `About ${appName}`,
    parent: parentWindow || undefined,
    modal: Boolean(parentWindow),
    backgroundColor: "#F4F7F5",
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
          --panel: rgba(255, 255, 255, 0.96);
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
          min-height: 100vh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 38%),
            linear-gradient(145deg, #edf7f3, #fbfcfc);
          color: var(--text);
          font-family: "Avenir Next", "Segoe UI", sans-serif;
        }

        .about-card {
          width: calc(100vw - 32px);
          max-width: 360px;
          padding: 28px 26px 22px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background: var(--panel);
          text-align: center;
          box-shadow: 0 24px 50px rgba(16, 35, 31, 0.14);
        }

        .about-logo {
          display: block;
          width: min(220px, 100%);
          height: auto;
          margin: 0 auto 22px;
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
          color: var(--muted);
        }

        .about-version {
          color: var(--accent);
          font-weight: 700;
        }

        .about-close {
          margin-top: 22px;
          min-width: 116px;
          border: 0;
          border-radius: 999px;
          padding: 11px 18px;
          background: var(--accent);
          color: white;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <main class="about-card">
        ${brandLogoDataUrl ? `<img class="about-logo" src="${brandLogoDataUrl}" alt="Patient Pip" />` : ""}
        <h1 class="about-title">${escapeHtml(appName)}</h1>
        <p class="about-version">Version ${escapeHtml(appVersion)}</p>
        <p class="about-line">Developed by Blackworks</p>
        <p class="about-line">2026 &copy; Copyright | All Rights Reserved</p>
        <button class="about-close" type="button" onclick="window.close()">Close</button>
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
        label: hasSupportedMainWindow ? "Show Pip Reception" : "Choose device role",
        click: () => {
          if (hasSupportedMainWindow) {
            mainWindow?.show();
            return;
          }

          createRoleWindow();
        },
      },
      {
        label: configState?.display?.minimized ? "Expand Pip Reception" : "Minimize Pip Reception",
        click: () => updateDisplaySettings({
          minimized: !configState.display.minimized,
        }),
      },
      {
        label: configState?.display?.alwaysOnTop ? "Disable Always On Top" : "Enable Always On Top",
        click: () => updateDisplaySettings({
          alwaysOnTop: !configState.display.alwaysOnTop,
        }),
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
}

function pingRoomById(roomId) {
  return configState.rooms.find((room) => room.id === roomId) || null;
}

function emitNotification(notification) {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send("notification:update", {
    ...notification,
    formattedTime: formatTimeFn(notification.timestamp),
    autoHideMs: configState.display.autoHideMs,
    pendingCount: notificationQueue.length,
  });

  mainWindow.showInactive();
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

function resizeForDisplayMode() {
  if (!mainWindow || !configState) {
    return;
  }

  const bounds = getWindowBounds(configState, mainWindow.getBounds());

  mainWindow.setAlwaysOnTop(Boolean(configState.display.alwaysOnTop));
  mainWindow.setResizable(false);
  mainWindow.setMinimumSize(WINDOW_WIDTH, WINDOW_MINIMIZED_HEIGHT);
  mainWindow.setBounds(bounds, true);
}

function getWindowBounds(config, currentBounds = null) {
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
  const desiredWidth = WINDOW_WIDTH;
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

  return {
    x: Math.min(Math.max(referenceBounds.x, workArea.x), Math.max(workArea.x, maxX)),
    y: Math.min(Math.max(referenceBounds.y, workArea.y), Math.max(workArea.y, maxY)),
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
  if (Number.isFinite(measuredGadgetHeight) && measuredGadgetHeight > 0) {
    return Math.max(WINDOW_MINIMIZED_HEIGHT, Math.ceil(measuredGadgetHeight));
  }

  const roomCount = Math.max(1, config.rooms?.length || 0);
  return GADGET_HEADER_HEIGHT + roomCount * GADGET_ROW_HEIGHT + GADGET_FRAME_PADDING + 60;
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
  configState = {
    ...configState,
    display: {
      ...configState.display,
      ...patch,
    },
  };

  configState = saveConfigFn(configState);
  setLaunchAtStartup(configState.display.launchAtStartup);
  resizeForDisplayMode();
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
        text: payload.text,
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
    resizeForDisplayMode();

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
      detail: "The reception gadget and local network service will stop running.",
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
