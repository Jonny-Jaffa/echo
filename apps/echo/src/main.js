const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require("electron");
const { createReceptionServer } = require("../../reception/src/server.js");

const RUNTIME_ROLE_RECEPTION = "reception";
const RUNTIME_ROLE_ROOM = "room";
const ROLE_OPTIONS = [RUNTIME_ROLE_RECEPTION, RUNTIME_ROLE_ROOM];
const APP_NAME = "Echo";
const DEFAULT_PAIRING_CODE = "1234";
const WINDOW_WIDTH = 500;
const WINDOW_HEIGHT = 640;
const MIN_WINDOW_WIDTH = 500;
const MIN_WINDOW_HEIGHT = 640;
const DEFAULT_ROOM_RUNTIME_SETTINGS = {
  serverUrl: process.env.PATIENT_PING_SERVER || "http://127.0.0.1:3210",
  serverAccessKey: process.env.PATIENT_PING_ACCESS_KEY || "",
  roomId: process.env.PATIENT_PING_ROOM_ID || "surgery-1",
  deviceId:
    process.env.PATIENT_PING_DEVICE_ID ||
    `${os.hostname()}-${process.env.PATIENT_PING_ROOM_ID || "surgery-1"}`,
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let receptionServer = null;
let receptionConfigState = null;
let roomServiceModulePromise = null;
let bootstrapState = {
  runtimeRole: "",
  runtimeRoleConfirmed: false,
  lastUpdated: null,
  roomRuntimeSettings: { ...DEFAULT_ROOM_RUNTIME_SETTINGS },
};
let runtimeServiceState = {
  activeRole: "",
  state: "idle",
  detail: "Choose a role to begin",
  receptionStatus: null,
  roomStatus: null,
};

function normalizeRuntimeRole(runtimeRole, fallback = "") {
  const normalizedRuntimeRole = String(runtimeRole || "").trim().toLowerCase();
  return ROLE_OPTIONS.includes(normalizedRuntimeRole) ? normalizedRuntimeRole : fallback;
}

function getBootstrapStatePath() {
  return path.join(app.getPath("userData"), "bootstrap-state.json");
}

function loadBootstrapState() {
  const bootstrapStatePath = getBootstrapStatePath();

  if (!fs.existsSync(bootstrapStatePath)) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(bootstrapStatePath, "utf8"));
    bootstrapState = {
      runtimeRole: normalizeRuntimeRole(parsed.runtimeRole, ""),
      runtimeRoleConfirmed: Boolean(parsed.runtimeRoleConfirmed),
      lastUpdated:
        typeof parsed.lastUpdated === "string" && parsed.lastUpdated.trim()
          ? parsed.lastUpdated
          : null,
      roomRuntimeSettings: normalizeRoomRuntimeSettings(parsed.roomRuntimeSettings),
    };
  } catch {
    bootstrapState = {
      runtimeRole: "",
      runtimeRoleConfirmed: false,
      lastUpdated: null,
      roomRuntimeSettings: { ...DEFAULT_ROOM_RUNTIME_SETTINGS },
    };
  }
}

function normalizeRoomRuntimeSettings(roomRuntimeSettings = {}) {
  return {
    serverUrl:
      String(roomRuntimeSettings.serverUrl || DEFAULT_ROOM_RUNTIME_SETTINGS.serverUrl).trim() ||
      DEFAULT_ROOM_RUNTIME_SETTINGS.serverUrl,
    serverAccessKey: String(
      roomRuntimeSettings.serverAccessKey ?? DEFAULT_ROOM_RUNTIME_SETTINGS.serverAccessKey,
    ).trim(),
    roomId:
      String(roomRuntimeSettings.roomId || DEFAULT_ROOM_RUNTIME_SETTINGS.roomId).trim() ||
      DEFAULT_ROOM_RUNTIME_SETTINGS.roomId,
    deviceId:
      String(roomRuntimeSettings.deviceId || DEFAULT_ROOM_RUNTIME_SETTINGS.deviceId).trim() ||
      DEFAULT_ROOM_RUNTIME_SETTINGS.deviceId,
  };
}

function saveBootstrapState() {
  const bootstrapStatePath = getBootstrapStatePath();
  fs.mkdirSync(path.dirname(bootstrapStatePath), { recursive: true });
  fs.writeFileSync(bootstrapStatePath, JSON.stringify(bootstrapState, null, 2));
}

function buildBootstrapPayload() {
  return {
    appName: APP_NAME,
    runtimeRole: bootstrapState.runtimeRole,
    runtimeRoleConfirmed: Boolean(bootstrapState.runtimeRoleConfirmed),
    lastUpdated: bootstrapState.lastUpdated,
    supportedRoles: ROLE_OPTIONS,
    implementationStage: "runtime-handoff-foundation",
    roomRuntimeSettings: bootstrapState.roomRuntimeSettings,
    runtimeServiceState,
  };
}

function emitBootstrapState() {
  const payload = buildBootstrapPayload();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bootstrap:update", payload);
  }
}

function findAssetPath(fileName) {
  const candidates = [
    path.join(__dirname, "..", "..", "reception", "src", "assets", fileName),
    path.join(__dirname, "..", "..", "client", "src", "assets", fileName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
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
    findAssetPath("tray-icon.ico"),
    findAssetPath("tray-icon.png"),
  ]);
}

function getTrayIcon() {
  const icon = getAppIcon();

  if (!icon.isEmpty()) {
    return icon.resize({ width: 16, height: 16 });
  }

  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="16" fill="#1f8ca3"/>
      <circle cx="32" cy="32" r="14" fill="#ffffff"/>
      <circle cx="32" cy="32" r="7" fill="#1f8ca3"/>
    </svg>
  `;
  const fallbackIcon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString("base64")}`,
  );
  return fallbackIcon.resize({ width: 16, height: 16 });
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const appIcon = getAppIcon();
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    resizable: true,
    frame: false,
    transparent: false,
    autoHideMenuBar: true,
    center: true,
    show: false,
    skipTaskbar: false,
    icon: windowIcon,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
    emitBootstrapState();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function setRuntimeServiceState(nextState = {}) {
  runtimeServiceState = {
    ...runtimeServiceState,
    ...nextState,
  };
  emitBootstrapState();
}

async function loadSharedModule() {
  return import("@patient-ping/shared");
}

function loadRoomServiceModule() {
  if (!roomServiceModulePromise) {
    const roomServiceModuleUrl = pathToFileURL(
      path.join(__dirname, "..", "..", "client", "src", "index.js"),
    ).href;
    roomServiceModulePromise = import(roomServiceModuleUrl);
  }

  return roomServiceModulePromise;
}

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

async function stopReceptionRuntime() {
  if (!receptionServer) {
    return;
  }

  receptionServer.close();
  receptionServer = null;
  receptionConfigState = null;
}

async function stopRoomRuntime() {
  if (!roomServiceModulePromise) {
    return;
  }

  try {
    const roomServiceModule = await loadRoomServiceModule();
    await roomServiceModule.stopClientHardwareService?.();
  } catch {
    // Ignore room-service shutdown errors during role transitions.
  }
}

async function stopActiveRuntime() {
  const activeRole = runtimeServiceState.activeRole;

  if (activeRole === RUNTIME_ROLE_RECEPTION) {
    await stopReceptionRuntime();
  }

  if (activeRole === RUNTIME_ROLE_ROOM) {
    await stopRoomRuntime();
  }

  setRuntimeServiceState({
    activeRole: "",
    state: "idle",
    detail: bootstrapState.runtimeRoleConfirmed && bootstrapState.runtimeRole
      ? `${bootstrapState.runtimeRole === RUNTIME_ROLE_RECEPTION ? "Reception" : "Room"} role is saved but not started`
      : "Choose a role to begin",
    receptionStatus: null,
    roomStatus: null,
  });
}

async function startReceptionRuntime() {
  const { loadConfig, normalizeConfig, saveConfig } = await loadSharedModule();

  receptionConfigState = normalizeConfig(loadConfig());

  if (!String(receptionConfigState?.auth?.accessKey || "").trim()) {
    receptionConfigState = saveConfig(ensureReceptionAccessKey(receptionConfigState));
  }

  const refreshReceptionStatus = () => {
    if (!receptionServer) {
      return;
    }

    setRuntimeServiceState({
      activeRole: RUNTIME_ROLE_RECEPTION,
      state: "running",
      detail: "Reception LAN host is running",
      receptionStatus: {
        ...receptionServer.getStatus(),
        pairingCode: String(receptionConfigState?.auth?.accessKey || "").trim(),
      },
      roomStatus: null,
    });
  };

  receptionServer = await createReceptionServer({
    config: () => receptionConfigState,
    onNotification: refreshReceptionStatus,
    onNotificationCancelled: () => refreshReceptionStatus(),
    onNotificationsCleared: () => refreshReceptionStatus(),
    onPingCleared: () => refreshReceptionStatus(),
    onChatMessage: refreshReceptionStatus,
    onAuditEvent: () => {},
  });

  refreshReceptionStatus();
}

async function startRoomRuntime() {
  const roomServiceModule = await loadRoomServiceModule();

  await roomServiceModule.startClientHardwareService({
    ...bootstrapState.roomRuntimeSettings,
    playPingAudio: true,
    onStatus: (status) => {
      setRuntimeServiceState({
        activeRole: RUNTIME_ROLE_ROOM,
        state: status?.state === "error" ? "error" : "running",
        detail: status?.detail || "Room runtime is running",
        receptionStatus: null,
        roomStatus: {
          ...(roomServiceModule.getClientHardwareStatus?.() || status || {}),
          roomId: bootstrapState.roomRuntimeSettings.roomId,
          serverUrl: bootstrapState.roomRuntimeSettings.serverUrl,
          deviceId: bootstrapState.roomRuntimeSettings.deviceId,
        },
      });
    },
  });

  setRuntimeServiceState({
    activeRole: RUNTIME_ROLE_ROOM,
    state: "running",
    detail: "Room hardware client is running",
    receptionStatus: null,
    roomStatus: {
      ...(roomServiceModule.getClientHardwareStatus?.() || {}),
      roomId: bootstrapState.roomRuntimeSettings.roomId,
      serverUrl: bootstrapState.roomRuntimeSettings.serverUrl,
      deviceId: bootstrapState.roomRuntimeSettings.deviceId,
    },
  });
}

async function startSelectedRuntime() {
  const runtimeRole = normalizeRuntimeRole(bootstrapState.runtimeRole, "");

  if (!bootstrapState.runtimeRoleConfirmed || !runtimeRole) {
    await stopActiveRuntime();
    return buildBootstrapPayload();
  }

  setRuntimeServiceState({
    activeRole: runtimeRole,
    state: "starting",
    detail: runtimeRole === RUNTIME_ROLE_RECEPTION
      ? "Starting Reception LAN host"
      : "Starting Room hardware client",
    receptionStatus: runtimeRole === RUNTIME_ROLE_RECEPTION ? runtimeServiceState.receptionStatus : null,
    roomStatus: runtimeRole === RUNTIME_ROLE_ROOM ? runtimeServiceState.roomStatus : null,
  });

  await stopActiveRuntime();

  try {
    if (runtimeRole === RUNTIME_ROLE_RECEPTION) {
      await startReceptionRuntime();
    } else {
      await startRoomRuntime();
    }
  } catch (error) {
    setRuntimeServiceState({
      activeRole: runtimeRole,
      state: "error",
      detail: error?.message || "Runtime failed to start",
      receptionStatus: runtimeRole === RUNTIME_ROLE_RECEPTION ? null : runtimeServiceState.receptionStatus,
      roomStatus: runtimeRole === RUNTIME_ROLE_ROOM ? null : runtimeServiceState.roomStatus,
    });
  }

  return buildBootstrapPayload();
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: APP_NAME,
        enabled: false,
      },
      {
        label: "Open Echo",
        click: () => {
          const targetWindow = createMainWindow();
          targetWindow.show();
          targetWindow.focus();
        },
      },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    const targetWindow = createMainWindow();
    targetWindow.show();
    targetWindow.focus();
  });
  refreshTrayMenu();
}

function registerIpcHandlers() {
  ipcMain.handle("echo:getBootstrapState", () => buildBootstrapPayload());

  ipcMain.handle("echo:updateBootstrapState", async (_event, patch = {}) => {
    const previousRuntimeRole = bootstrapState.runtimeRole;
    bootstrapState = {
      runtimeRole:
        typeof patch.runtimeRole === "string"
          ? normalizeRuntimeRole(patch.runtimeRole, bootstrapState.runtimeRole)
          : bootstrapState.runtimeRole,
      runtimeRoleConfirmed:
        typeof patch.runtimeRoleConfirmed === "boolean"
          ? patch.runtimeRoleConfirmed
          : bootstrapState.runtimeRoleConfirmed,
      lastUpdated: new Date().toISOString(),
      roomRuntimeSettings:
        patch.roomRuntimeSettings && typeof patch.roomRuntimeSettings === "object"
          ? normalizeRoomRuntimeSettings({
            ...bootstrapState.roomRuntimeSettings,
            ...patch.roomRuntimeSettings,
          })
          : bootstrapState.roomRuntimeSettings,
    };
    saveBootstrapState();

    if (
      bootstrapState.runtimeRoleConfirmed &&
      bootstrapState.runtimeRole === RUNTIME_ROLE_ROOM &&
      runtimeServiceState.activeRole === RUNTIME_ROLE_ROOM &&
      patch.roomRuntimeSettings &&
      typeof patch.roomRuntimeSettings === "object"
    ) {
      try {
        const roomServiceModule = await loadRoomServiceModule();
        await roomServiceModule.updateClientHardwareServiceSettings?.({
          ...bootstrapState.roomRuntimeSettings,
        });
        setRuntimeServiceState({
          roomStatus: {
            ...(roomServiceModule.getClientHardwareStatus?.() || {}),
            roomId: bootstrapState.roomRuntimeSettings.roomId,
            serverUrl: bootstrapState.roomRuntimeSettings.serverUrl,
            deviceId: bootstrapState.roomRuntimeSettings.deviceId,
          },
          detail: "Room runtime settings updated",
        });
      } catch (error) {
        setRuntimeServiceState({
          state: "error",
          detail: error?.message || "Room runtime settings update failed",
        });
      }
    }

    if (
      bootstrapState.runtimeRole !== previousRuntimeRole ||
      typeof patch.runtimeRoleConfirmed === "boolean"
    ) {
      await startSelectedRuntime();
    } else {
      emitBootstrapState();
    }

    return buildBootstrapPayload();
  });

  ipcMain.handle("echo:minimizeWindow", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    targetWindow?.minimize();
  });

  ipcMain.handle("echo:confirmQuit", () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.handle("echo:startRuntime", async () => startSelectedRuntime());
  ipcMain.handle("echo:stopRuntime", async () => {
    await stopActiveRuntime();
    return buildBootstrapPayload();
  });
  ipcMain.handle("echo:restartRuntime", async () => {
    await stopActiveRuntime();
    return startSelectedRuntime();
  });
}

app.whenReady().then(() => {
  loadBootstrapState();
  registerIpcHandlers();
  createMainWindow();
  createTray();
  startSelectedRuntime().catch(() => {});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopActiveRuntime().catch(() => {});
});

app.on("browser-window-created", (_event, window) => {
  window.on("close", (event) => {
    if (isQuitting || process.platform === "darwin") {
      return;
    }

    event.preventDefault();
    window.hide();
  });
});
