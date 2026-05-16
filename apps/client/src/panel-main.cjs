const path = require("node:path");
const fs = require("node:fs");
const dgram = require("node:dgram");
const { randomUUID } = require("node:crypto");
const { exec } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, dialog } = require("electron");

const DISCOVERY_PORT = 3210;
const SURGERY_PANEL_WIDTH = 373;
const SURGERY_THREAD_RAIL_WIDTH = 63;
const SURGERY_THREAD_RAIL_CHIP_SIZE = 42;
const SURGERY_THREAD_RAIL_CHIP_GAP = 10;
const SURGERY_THREAD_RAIL_TOP_BUFFER = 34;
const SURGERY_WINDOW_WIDTH = SURGERY_PANEL_WIDTH + SURGERY_THREAD_RAIL_WIDTH;
const SURGERY_WINDOW_EXPANDED_WIDTH = 780 + SURGERY_THREAD_RAIL_WIDTH;
const SURGERY_SETTINGS_WINDOW_WIDTH = 780;
const SURGERY_WINDOW_HEIGHT = 380;
const SURGERY_WINDOW_BUTTONS_HEIGHT = 232;
const SURGERY_WINDOW_BOTH_HEIGHT = 555;
const SURGERY_WINDOW_EXPANDED_HEIGHT_DELTA = 200;
const SURGERY_BANNER_HEIGHT = 50;
const SURGERY_OFFLINE_COMPACT_HEIGHT = 120;
const SURGERY_SETTINGS_WINDOW_HEIGHT = 800;
const DEFAULT_SURGERY_SOUND = "notification_sound_01";
const MESSAGE_POPUP_WIDTH = 380;
const RECEPTION_PING_POPUP_WIDTH = 352;
const MESSAGE_POPUP_MIN_HEIGHT = 48;
const MESSAGE_POPUP_MAX_HEIGHT = 172;
const RECEPTION_PING_POPUP_HEIGHT = 238;
const MESSAGE_POPUP_MARGIN = 18;
const SURGERY_SOUND_FILE_MAP = Object.fromEntries(
  Array.from({ length: 17 }, (_value, index) => {
    const soundNumber = String(index + 1).padStart(2, "0");
    return [
      `notification_sound_${soundNumber}`,
      `Notification_sound_${soundNumber}.wav`,
    ];
  }),
);
const LEGACY_SURGERY_SOUND_ALIASES = {
  ping: "notification_sound_01",
  glass: "notification_sound_02",
  hero: "notification_sound_03",
  funk: "notification_sound_04",
  pop: "notification_sound_05",
};
const DEFAULT_BUTTON_APPEARANCE = {
  defaultBackground: "#FDD905",
  defaultText: "#000000",
  activeBackground: "#000000",
  activeText: "#FFFFFF",
};
const DEFAULT_LEFT_AUX_SETTING = {
  enabled: true,
  mode: "party",
};
const DEFAULT_RIGHT_AUX_SETTING = {
  enabled: false,
  action: "none",
};
const ROOM_ACTION_BUTTON_COUNT = 8;
const NEO_BUTTON_LABEL_MAX_LENGTH = 7;
const MAX_MESSAGE_GROUP_NAME_LENGTH = 24;
const CONFIGURED_MESSAGE_GROUPS_ENABLED = false;
const DEFAULT_PINNED_MESSAGE_THREAD_KEYS = [];
const RUNTIME_ROLE_ROOM = "room";
const RUNTIME_ROLE_RECEPTION = "reception";
const CURRENT_APP_RUNTIME_ROLE = RUNTIME_ROLE_ROOM;
const USE_EXTERNAL_THREAD_RAIL = process.platform === "win32";
const SURGERY_MAIN_WINDOW_IS_TRANSPARENT = true;
const SURGERY_MAIN_WINDOW_BACKGROUND = "#00000000";
const SURGERY_PANEL_WINDOW_TITLE = process.platform === "win32" ? "\u200B" : "Pip Surgery";
let allowNativeMinimize = false;

function normalizePanelDisplayMode(mode) {
  const normalizedMode = String(mode || "messages").trim().toLowerCase();
  return ["messages", "buttons", "both"].includes(normalizedMode)
    ? normalizedMode
    : "messages";
}

function normalizePopupPosition(position) {
  const normalized = String(position || "bottomRight").trim().toLowerCase();
  return normalized === "topright" ? "topRight" : "bottomRight";
}

function getPanelDisplayModeHeight(mode) {
  const normalizedMode = normalizePanelDisplayMode(mode);

  return normalizedMode === "buttons"
    ? SURGERY_WINDOW_BUTTONS_HEIGHT
    : normalizedMode === "both"
      ? SURGERY_WINDOW_BOTH_HEIGHT
      : SURGERY_WINDOW_HEIGHT;
}

function getPanelDisplayModeWidth(mode) {
  const normalizedMode = normalizePanelDisplayMode(mode);

  if (normalizedMode === "buttons") {
    return SURGERY_PANEL_WIDTH;
  }

  if (USE_EXTERNAL_THREAD_RAIL) {
    return SURGERY_PANEL_WIDTH;
  }

  return SURGERY_WINDOW_WIDTH;
}

function getPanelExpandedWidth() {
  return USE_EXTERNAL_THREAD_RAIL
    ? SURGERY_WINDOW_EXPANDED_WIDTH - SURGERY_THREAD_RAIL_WIDTH
    : SURGERY_WINDOW_EXPANDED_WIDTH;
}

function clampWindowXToVisibleWidth(x, visibleWidth, workArea) {
  const maxX = workArea.x + workArea.width - visibleWidth;
  return Math.min(Math.max(x, workArea.x), Math.max(workArea.x, maxX));
}

function normalizeRuntimeRole(runtimeRole, fallback = RUNTIME_ROLE_ROOM) {
  const normalizedRuntimeRole = String(runtimeRole || "").trim().toLowerCase();

  return [RUNTIME_ROLE_RECEPTION, RUNTIME_ROLE_ROOM].includes(normalizedRuntimeRole)
    ? normalizedRuntimeRole
    : fallback;
}

function isCurrentRuntimeRoleSupported() {
  return normalizeRuntimeRole(clientSettings.runtimeRole, CURRENT_APP_RUNTIME_ROLE) === CURRENT_APP_RUNTIME_ROLE;
}

function shouldOpenRoleWindowOnLaunch() {
  return (
    process.argv.includes("--choose-role") ||
    clientSettings.runtimeRoleConfirmed === false ||
    !isCurrentRuntimeRoleSupported()
  );
}

let mainWindow = null;
let threadRailWindow = null;
let latestThreadRailPayload = null;
let settingsWindow = null;
let roleWindow = null;
let clientServiceModulePromise = null;
let clientServiceRunning = false;
let clientServiceLogPath = "";
let clientHardwareStatus = {
  state: "starting",
  detail: "Starting Stream Deck service",
  updatedAt: new Date().toISOString(),
};
let tray = null;
let aboutWindow = null;
let messagePopupWindow = null;
let latestMessagePopupPayload = null;
let isQuitting = false;
let isSettingsPanelExpanded = false;
let currentPanelDisplayMode = "messages";
let preExpandWindowPosition = null;
let clientSettings = {
  runtimeRole: RUNTIME_ROLE_ROOM,
  runtimeRoleConfirmed: true,
  serverUrl: process.env.PIP_SERVER || "http://127.0.0.1:3210",
  serverAccessKey: process.env.PIP_ACCESS_KEY || "",
  roomId: process.env.PIP_ROOM_ID || "surgery-1",
  deviceId: process.env.PIP_DEVICE_ID || randomUUID(),
  launchAtStartup: true,
  showPanelAtStartup: true,
  alwaysOnTop: true,
  messageSound: DEFAULT_SURGERY_SOUND,
  messageVolume: 80,
  roomAlertVolumes: {},
  roomAlertSounds: {},
  roomButtonAppearances: {},
  roomLeftAuxSettings: {},
  roomRightAuxSettings: {},
  roomActionSettings: {},
  roomMessageGroups: {},
  roomPinnedMessageThreads: {},
  panelDisplayMode: "messages",
  popupPosition: "bottomRight",
};

function normalizeRoomActionNotification(notification, index, roomId = "") {
  const parsedDeviceButton = Number(notification?.deviceButton);
  const deviceButton = Number.isFinite(parsedDeviceButton)
    ? Math.max(0, Math.min(ROOM_ACTION_BUTTON_COUNT - 1, Math.round(parsedDeviceButton)))
    : Math.max(0, Math.min(ROOM_ACTION_BUTTON_COUNT - 1, index));
  const fallbackLabel = `Action ${deviceButton + 1}`;
  const label = String(notification?.label || notification?.message || "").trim().slice(0, 20);

  if (!label) {
    return null;
  }

  return {
    id: String(notification?.id || `${roomId || "room"}-action-${deviceButton + 1}`).trim(),
    label,
    message: String(notification?.message || label || fallbackLabel).trim().slice(0, 20) || fallbackLabel,
    color: String(notification?.color || "#2563eb").trim(),
    icon: String(notification?.icon || "").trim().slice(0, NEO_BUTTON_LABEL_MAX_LENGTH),
    deviceButton,
  };
}

function normalizeRoomActionSettings(roomActionSettings) {
  if (!roomActionSettings || typeof roomActionSettings !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomActionSettings)
      .map(([roomId, notifications]) => {
        const normalizedRoomId = String(roomId || "").trim();

        if (!normalizedRoomId) {
          return null;
        }

        const notificationsByButton = new Map();

        if (Array.isArray(notifications)) {
          notifications.forEach((notification, index) => {
            const normalizedNotification = normalizeRoomActionNotification(
              notification,
              index,
              normalizedRoomId,
            );

            if (normalizedNotification) {
              notificationsByButton.set(
                normalizedNotification.deviceButton,
                normalizedNotification,
              );
            }
          });
        }

        return [
          normalizedRoomId,
          [...notificationsByButton.values()].sort(
            (left, right) => left.deviceButton - right.deviceButton,
          ),
        ];
      })
      .filter(Boolean),
  );
}

function normalizeRoomMessageGroup(messageGroup, index, roomId = "") {
  const normalizedName = String(messageGroup?.name || "").trim().slice(0, MAX_MESSAGE_GROUP_NAME_LENGTH);
  const roomIds = [...new Set(
    Array.isArray(messageGroup?.roomIds)
      ? messageGroup.roomIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
  )].filter((value) => value !== roomId);

  if (!normalizedName || roomIds.length === 0) {
    return null;
  }

  return {
    id: String(messageGroup?.id || randomUUID() || `${roomId || "room"}-group-${index + 1}`).trim(),
    name: normalizedName,
    roomIds,
  };
}

function normalizeRoomMessageGroups(roomMessageGroups) {
  if (!CONFIGURED_MESSAGE_GROUPS_ENABLED) {
    return {};
  }

  if (!roomMessageGroups || typeof roomMessageGroups !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomMessageGroups)
      .map(([roomId, messageGroups]) => {
        const normalizedRoomId = String(roomId || "").trim();

        if (!normalizedRoomId) {
          return null;
        }

        const groups = Array.isArray(messageGroups)
          ? messageGroups
            .map((messageGroup, index) =>
              normalizeRoomMessageGroup(messageGroup, index, normalizedRoomId))
            .filter(Boolean)
          : [];

        return [normalizedRoomId, groups];
      })
      .filter(Boolean),
  );
}

function hasConfiguredRoomMessageGroupSettings(roomMessageGroups) {
  return Boolean(
    roomMessageGroups &&
    typeof roomMessageGroups === "object" &&
    Object.keys(roomMessageGroups).length > 0
  );
}

function normalizeRoomPinnedMessageThreads(roomPinnedMessageThreads) {
  if (!roomPinnedMessageThreads || typeof roomPinnedMessageThreads !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomPinnedMessageThreads)
      .map(([roomId, threadKeys]) => {
        const normalizedRoomId = String(roomId || "").trim();

        if (!normalizedRoomId) {
          return null;
        }

        const normalizedThreadKeys = [...new Set(
          Array.isArray(threadKeys)
            ? threadKeys.map((threadKey) => String(threadKey || "").trim()).filter(Boolean)
            : DEFAULT_PINNED_MESSAGE_THREAD_KEYS,
        )];

        return [normalizedRoomId, normalizedThreadKeys];
      })
      .filter(Boolean),
  );
}

function normalizeHexColor(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .replace(/^#/, "");

  if (/^[\da-f]{3}$/i.test(normalized) || /^[\da-f]{6}$/i.test(normalized)) {
    return `#${normalized.toUpperCase()}`;
  }

  return fallback;
}

function normalizeCssBackground(value, fallback) {
  const normalized = String(value || "").trim();

  if (/^linear-gradient\(\d+deg,\s*#[0-9a-fA-F]{6}\s+\d+%,\s*#[0-9a-fA-F]{6}\s+\d+%\)$/.test(normalized)) {
    return normalized;
  }

  if (/^radial-gradient\(circle\s+at\s+\d+%\s+\d+%,\s*#[0-9a-fA-F]{6}\s+\d+%,\s*#[0-9a-fA-F]{6}\s+\d+%\)$/.test(normalized)) {
    return normalized;
  }

  return normalizeHexColor(normalized, fallback);
}

function normalizeButtonAppearance(buttonAppearance) {
  return {
    defaultBackground: normalizeCssBackground(
      buttonAppearance?.defaultBackground,
      DEFAULT_BUTTON_APPEARANCE.defaultBackground,
    ),
    defaultText: normalizeHexColor(
      buttonAppearance?.defaultText,
      DEFAULT_BUTTON_APPEARANCE.defaultText,
    ),
    activeBackground: normalizeCssBackground(
      buttonAppearance?.activeBackground,
      DEFAULT_BUTTON_APPEARANCE.activeBackground,
    ),
    activeText: normalizeHexColor(
      buttonAppearance?.activeText,
      DEFAULT_BUTTON_APPEARANCE.activeText,
    ),
  };
}

function normalizeRoomButtonAppearances(roomButtonAppearances) {
  if (!roomButtonAppearances || typeof roomButtonAppearances !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomButtonAppearances).map(([roomId, buttonAppearance]) => [
      String(roomId || "").trim(),
      normalizeButtonAppearance(buttonAppearance),
    ]).filter(([roomId]) => roomId),
  );
}

function normalizeLeftAuxSetting(leftAuxSetting) {
  const normalizedMode = String(leftAuxSetting?.mode || DEFAULT_LEFT_AUX_SETTING.mode)
    .trim()
    .toLowerCase();

  return {
    enabled:
      typeof leftAuxSetting?.enabled === "boolean"
        ? leftAuxSetting.enabled
        : DEFAULT_LEFT_AUX_SETTING.enabled,
    mode: ["party", "cancel"].includes(normalizedMode)
      ? normalizedMode
      : DEFAULT_LEFT_AUX_SETTING.mode,
  };
}

function normalizeRoomLeftAuxSettings(roomLeftAuxSettings) {
  if (!roomLeftAuxSettings || typeof roomLeftAuxSettings !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomLeftAuxSettings)
      .map(([roomId, leftAuxSetting]) => [
        String(roomId || "").trim(),
        normalizeLeftAuxSetting(leftAuxSetting),
      ])
      .filter(([roomId]) => roomId),
  );
}

function normalizeRightAuxSetting(rightAuxSetting) {
  const normalizedAction = String(rightAuxSetting?.action || DEFAULT_RIGHT_AUX_SETTING.action)
    .trim()
    .toLowerCase();

  return {
    enabled:
      typeof rightAuxSetting?.enabled === "boolean"
        ? rightAuxSetting.enabled
        : DEFAULT_RIGHT_AUX_SETTING.enabled,
    action: ["none", "lucy", "cancel"].includes(normalizedAction)
      ? normalizedAction
      : DEFAULT_RIGHT_AUX_SETTING.action,
  };
}

function normalizeRoomRightAuxSettings(roomRightAuxSettings) {
  if (!roomRightAuxSettings || typeof roomRightAuxSettings !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomRightAuxSettings)
      .map(([roomId, rightAuxSetting]) => [
        String(roomId || "").trim(),
        normalizeRightAuxSetting(rightAuxSetting),
      ])
      .filter(([roomId]) => roomId),
  );
}

function configureAboutPanel() {
  app.setAboutPanelOptions({
    applicationName: "Pip (Client)",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    credits: "Developed by Blackworks",
    authors: ["Blackworks"],
    copyright: "Blackworks",
  });
}

function createWindow({ showInitially = true } = {}) {
  const appIcon = getAppIcon();
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;
  mainWindow = new BrowserWindow({
    width: getPanelDisplayModeWidth(clientSettings.panelDisplayMode),
    height: getPanelDisplayModeHeight(clientSettings.panelDisplayMode),
    minWidth: getPanelDisplayModeWidth(clientSettings.panelDisplayMode),
    minHeight: getPanelDisplayModeHeight(clientSettings.panelDisplayMode),
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: false,
    frame: false,
    transparent: SURGERY_MAIN_WINDOW_IS_TRANSPARENT,
    backgroundColor: SURGERY_MAIN_WINDOW_BACKGROUND,
    hasShadow: false,
    thickFrame: false,
    alwaysOnTop: clientSettings.alwaysOnTop,
    title: SURGERY_PANEL_WINDOW_TITLE,
    icon: windowIcon,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "panel-preload.cjs"),
    },
  });

  if (typeof mainWindow.setHasShadow === "function") {
    mainWindow.setHasShadow(false);
  }

  mainWindow.loadFile(path.join(__dirname, "renderer", "panel.html"));

  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (process.platform === "win32") {
      mainWindow.setTitle("\u200B");
    }

    mainWindow.webContents.executeJavaScript(
      `document.body.dataset.platform = ${JSON.stringify(process.platform)};
       document.title = ${JSON.stringify(process.platform === "win32" ? "\u200B" : "Pip Surgery")};`,
      true,
    ).catch(() => {});
  });

  mainWindow.once("ready-to-show", () => {
    if (typeof mainWindow?.setHasShadow === "function") {
      mainWindow.setHasShadow(false);
    }
    mainWindow.webContents.send("panel:hardwareStatus", clientHardwareStatus);
    if (showInitially) {
      showMainWindow();
    } else {
      hideWindowToTray();
    }
  });

  mainWindow.on("minimize", (event) => {
    if (process.platform === "win32") {
      hideThreadRailWindow();
      refreshTrayMenu();
      return;
    }

    if (allowNativeMinimize) {
      allowNativeMinimize = false;
      refreshTrayMenu();
      return;
    }

    event.preventDefault();
    hideWindowToTray();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    // On Windows, when right-clicking the taskbar icon and selecting "Close",
    // or when pressing Alt+F4, we should quit the app instead of hiding to tray.
    if (process.platform === "win32" && mainWindow?.isVisible()) {
      isQuitting = true;
      app.quit();
      return;
    }

    event.preventDefault();
    hideWindowToTray();
  });

  mainWindow.on("closed", () => {
    destroyThreadRailWindow();
    mainWindow = null;
  });
  mainWindow.on("focus", () => {
    closeMessagePopup();
    refreshTransparentWindowChrome(mainWindow);
  });
  mainWindow.on("blur", () => {
    refreshTransparentWindowChrome(mainWindow);
  });
  mainWindow.on("move", positionThreadRailWindow);
  mainWindow.on("resize", positionThreadRailWindow);
  mainWindow.on("show", () => {
    refreshTransparentWindowChrome(mainWindow);
    positionThreadRailWindow();
    syncExternalThreadRailWindow();
  });
  mainWindow.on("hide", () => {
    hideThreadRailWindow();
  });
}

function refreshTransparentWindowChrome(targetWindow = mainWindow) {
  if (
    process.platform !== "win32" ||
    !SURGERY_MAIN_WINDOW_IS_TRANSPARENT ||
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

function getThreadRailWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const bounds = mainWindow.getBounds();
  const topOffset = Math.max(8, Math.round(Number(latestThreadRailPayload?.top) || 8));
  const threadCount = Array.isArray(latestThreadRailPayload?.threads)
    ? latestThreadRailPayload.threads.length
    : 0;
  const contentHeight = threadCount > 0
    ? threadCount * SURGERY_THREAD_RAIL_CHIP_SIZE
      + Math.max(0, threadCount - 1) * SURGERY_THREAD_RAIL_CHIP_GAP
      + SURGERY_THREAD_RAIL_TOP_BUFFER
    : bounds.height - topOffset;
  const height = Math.min(
    Math.max(84, contentHeight),
    Math.max(84, bounds.height - topOffset + SURGERY_THREAD_RAIL_TOP_BUFFER),
  );

  return {
    x: bounds.x - SURGERY_THREAD_RAIL_WIDTH,
    y: bounds.y + topOffset + 10 - SURGERY_THREAD_RAIL_TOP_BUFFER,
    width: SURGERY_THREAD_RAIL_WIDTH,
    height,
  };
}

function createThreadRailWindow() {
  if (!USE_EXTERNAL_THREAD_RAIL || !mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  if (threadRailWindow && !threadRailWindow.isDestroyed()) {
    return threadRailWindow;
  }

  threadRailWindow = new BrowserWindow({
    ...(getThreadRailWindowBounds() || {
      width: SURGERY_THREAD_RAIL_WIDTH,
      height: getPanelDisplayModeHeight(currentPanelDisplayMode),
    }),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    thickFrame: false,
    focusable: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: Boolean(clientSettings.alwaysOnTop),
    skipTaskbar: true,
    title: "\u200B",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "thread-rail-preload.cjs"),
    },
  });

  threadRailWindow.loadFile(path.join(__dirname, "renderer", "thread-rail.html"));
  threadRailWindow.once("ready-to-show", () => {
    positionThreadRailWindow();
    syncExternalThreadRailWindow();
  });
  threadRailWindow.on("closed", () => {
    threadRailWindow = null;
  });

  return threadRailWindow;
}

function destroyThreadRailWindow() {
  if (!threadRailWindow || threadRailWindow.isDestroyed()) {
    threadRailWindow = null;
    return;
  }

  threadRailWindow.close();
  threadRailWindow = null;
}

function hideThreadRailWindow() {
  if (threadRailWindow && !threadRailWindow.isDestroyed()) {
    threadRailWindow.hide();
  }
}

function positionThreadRailWindow() {
  if (!USE_EXTERNAL_THREAD_RAIL || !threadRailWindow || threadRailWindow.isDestroyed()) {
    return;
  }

  const bounds = getThreadRailWindowBounds();

  if (!bounds) {
    return;
  }

  threadRailWindow.setBounds(bounds, false);
  setThreadRailWindowShape(bounds);
  threadRailWindow.setAlwaysOnTop(Boolean(clientSettings.alwaysOnTop) && !settingsWindow?.isVisible());
}

function setThreadRailWindowShape(bounds) {
  if (!threadRailWindow || threadRailWindow.isDestroyed() || typeof threadRailWindow.setShape !== "function") {
    return;
  }

  const width = Math.max(1, Math.round(bounds?.width || SURGERY_THREAD_RAIL_WIDTH));
  const height = Math.max(1, Math.round(bounds?.height || 1));
  const threadCount = Array.isArray(latestThreadRailPayload?.threads)
    ? latestThreadRailPayload.threads.length
    : 0;

  if (!threadCount) {
    threadRailWindow.setShape([]);
    return;
  }

  threadRailWindow.setShape([{
    x: 0,
    y: SURGERY_THREAD_RAIL_TOP_BUFFER,
    width,
    height: Math.max(1, height - SURGERY_THREAD_RAIL_TOP_BUFFER),
  }]);
}

function syncExternalThreadRailWindow() {
  if (!USE_EXTERNAL_THREAD_RAIL) {
    return;
  }

  if (!latestThreadRailPayload?.visible || !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    hideThreadRailWindow();
    return;
  }

  const targetWindow = createThreadRailWindow();

  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  positionThreadRailWindow();
  const sendPayload = () => {
    if (!threadRailWindow || threadRailWindow.isDestroyed()) {
      return;
    }

    threadRailWindow.webContents.send("threadRail:update", latestThreadRailPayload);
    if (!threadRailWindow.isVisible()) {
      threadRailWindow.showInactive();
    }
  };

  if (targetWindow.webContents.isLoading()) {
    targetWindow.webContents.once("did-finish-load", sendPayload);
    return;
  }

  sendPayload();
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.setAlwaysOnTop(true);
    positionThreadRailWindow();
    settingsWindow.moveTop();
    settingsWindow.focus();
    return settingsWindow;
  }

  const appIcon = getAppIcon();
  const windowIcon = process.platform === "win32" && !appIcon.isEmpty()
    ? appIcon.resize({ width: 32, height: 32 })
    : undefined;

  settingsWindow = new BrowserWindow({
    width: SURGERY_SETTINGS_WINDOW_WIDTH,
    height: SURGERY_SETTINGS_WINDOW_HEIGHT,
    minWidth: SURGERY_SETTINGS_WINDOW_WIDTH,
    minHeight: 680,
    autoHideMenuBar: true,
    title: "Pip Surgery Settings",
    show: false,
    skipTaskbar: false,
    frame: false,
    transparent: false,
    center: true,
    parent: mainWindow || undefined,
    icon: windowIcon,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "panel-preload.cjs"),
    },
  });

  settingsWindow.loadFile(path.join(__dirname, "renderer", "panel.html"), {
    query: { view: "settings" },
  });

  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.webContents.send("panel:hardwareStatus", clientHardwareStatus);
    settingsWindow?.setAlwaysOnTop(true);
    settingsWindow?.show();
    positionThreadRailWindow();
    settingsWindow?.moveTop();
    settingsWindow?.focus();
    settingsWindow?.center();
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
    positionThreadRailWindow();
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
    autoHideMenuBar: true,
    title: "Pip Role",
    show: false,
    skipTaskbar: false,
    frame: false,
    transparent: false,
    center: true,
    parent: mainWindow || undefined,
    icon: windowIcon,
    webPreferences: {
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "panel-preload.cjs"),
    },
  });

  roleWindow.loadFile(path.join(__dirname, "renderer", "panel.html"), {
    query: { view: "role" },
  });

  roleWindow.once("ready-to-show", () => {
    roleWindow?.show();
    roleWindow?.focus();
    roleWindow?.center();
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
  destroyThreadRailWindow();
  targetWindow.removeAllListeners("minimize");
  targetWindow.removeAllListeners("close");
  targetWindow.close();
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "client-settings.json");
}

function getLegacySettingsPaths() {
  return [
    path.join(app.getPath("appData"), "@patient-ping", "client", "client-settings.json"),
    path.join(app.getPath("appData"), "Echo Surgery", "client-settings.json"),
  ];
}

function getClientServiceLogPath() {
  return path.join(app.getPath("userData"), "client-service.log");
}

function appendClientServiceLog(message) {
  try {
    if (!clientServiceLogPath) {
      clientServiceLogPath = getClientServiceLogPath();
    }

    fs.appendFileSync(
      clientServiceLogPath,
      `[${new Date().toISOString()}] ${String(message).trim()}\n`,
    );
  } catch {
    // Ignore logging failures so they do not affect the panel itself.
  }
}

function updateClientHardwareStatus(nextStatus = {}) {
  clientHardwareStatus = {
    ...clientHardwareStatus,
    ...nextStatus,
    updatedAt: nextStatus.updatedAt || new Date().toISOString(),
  };

  appendClientServiceLog(
    `hardware-status state=${clientHardwareStatus.state} detail=${clientHardwareStatus.detail}`,
  );

  if (mainWindow?.webContents) {
    mainWindow.webContents.send("panel:hardwareStatus", clientHardwareStatus);
  }

  if (settingsWindow?.webContents) {
    settingsWindow.webContents.send("panel:hardwareStatus", clientHardwareStatus);
  }
}

function broadcastPanelSettings() {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send("panel:settingsUpdated", clientSettings);
  }

  if (settingsWindow?.webContents) {
    settingsWindow.webContents.send("panel:settingsUpdated", clientSettings);
  }
}

function loadClientSettings() {
  const settingsPath = getSettingsPath();
  const resolvedSettingsPath = fs.existsSync(settingsPath)
    ? settingsPath
    : getLegacySettingsPaths().find((legacyPath) => fs.existsSync(legacyPath));

  if (!resolvedSettingsPath) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolvedSettingsPath, "utf8"));
    const shouldPurgeConfiguredMessageGroups =
      !CONFIGURED_MESSAGE_GROUPS_ENABLED &&
      hasConfiguredRoomMessageGroupSettings(parsed.roomMessageGroups);
    if (resolvedSettingsPath !== settingsPath) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.copyFileSync(resolvedSettingsPath, settingsPath);
    }
    clientSettings = {
      ...clientSettings,
      runtimeRole: normalizeRuntimeRole(parsed.runtimeRole, RUNTIME_ROLE_ROOM),
      runtimeRoleConfirmed:
        typeof parsed.runtimeRoleConfirmed === "boolean"
          ? parsed.runtimeRoleConfirmed
          : clientSettings.runtimeRoleConfirmed,
      serverUrl: parsed.serverUrl || clientSettings.serverUrl,
      serverAccessKey: String(parsed.serverAccessKey ?? clientSettings.serverAccessKey ?? "").trim(),
      roomId: parsed.roomId || clientSettings.roomId,
      deviceId: parsed.deviceId || clientSettings.deviceId,
      launchAtStartup:
        typeof parsed.launchAtStartup === "boolean"
          ? parsed.launchAtStartup
          : clientSettings.launchAtStartup,
      showPanelAtStartup:
        typeof parsed.showPanelAtStartup === "boolean"
          ? parsed.showPanelAtStartup
          : clientSettings.showPanelAtStartup,
      alwaysOnTop:
        typeof parsed.alwaysOnTop === "boolean"
          ? parsed.alwaysOnTop
          : clientSettings.alwaysOnTop,
      messageSound: normalizeSurgerySound(parsed.messageSound),
      messageVolume: clampSurgeryVolume(parsed.messageVolume, clientSettings.messageVolume),
      roomAlertVolumes:
        parsed.roomAlertVolumes && typeof parsed.roomAlertVolumes === "object"
          ? parsed.roomAlertVolumes
          : clientSettings.roomAlertVolumes,
      roomAlertSounds:
        parsed.roomAlertSounds && typeof parsed.roomAlertSounds === "object"
          ? parsed.roomAlertSounds
          : clientSettings.roomAlertSounds,
      roomButtonAppearances: normalizeRoomButtonAppearances(
        parsed.roomButtonAppearances,
      ),
      roomLeftAuxSettings: normalizeRoomLeftAuxSettings(parsed.roomLeftAuxSettings),
      roomRightAuxSettings: normalizeRoomRightAuxSettings(parsed.roomRightAuxSettings),
      roomActionSettings: normalizeRoomActionSettings(parsed.roomActionSettings),
      roomMessageGroups: normalizeRoomMessageGroups(parsed.roomMessageGroups),
      roomPinnedMessageThreads: normalizeRoomPinnedMessageThreads(parsed.roomPinnedMessageThreads),
      panelDisplayMode: normalizePanelDisplayMode(parsed.panelDisplayMode),
      popupPosition: normalizePopupPosition(parsed.popupPosition),
    };
    currentPanelDisplayMode = clientSettings.panelDisplayMode;
    if (shouldPurgeConfiguredMessageGroups) {
      saveClientSettings();
    }
  } catch {
    // Ignore corrupt settings and fall back to defaults/env.
  }
}

function saveClientSettings() {
  const settingsPath = getSettingsPath();
  fs.writeFileSync(settingsPath, JSON.stringify(clientSettings, null, 2));
}

function shouldAutoDiscoverServerUrl(serverUrl) {
  const normalized = String(serverUrl || "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized === "http://127.0.0.1:3210" ||
    normalized === "http://localhost:3210" ||
    normalized.startsWith("http://127.0.0.1:") ||
    normalized.startsWith("http://localhost:")
  );
}

function discoverReceptionServer(timeoutMs = 1800) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const discoveryPayload = Buffer.from(
      JSON.stringify({
        type: "pip-discovery",
        app: "pip-room",
      }),
    );

    const finish = (value = null) => {
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // Ignore close failures while resolving discovery.
      }
      resolve(value);
    };

    socket.on("message", (message) => {
      try {
        const payload = JSON.parse(String(message));

        if (
          payload?.type === "pip-discovery-response" &&
          typeof payload.serverUrl === "string" &&
          payload.serverUrl.trim()
        ) {
          appendClientServiceLog(`discovered reception server ${payload.serverUrl}`);
          finish(payload.serverUrl.trim());
        }
      } catch {
        // Ignore invalid discovery messages on the LAN.
      }
    });

    socket.on("error", (error) => {
      appendClientServiceLog(`discovery error ${error.message}`);
      finish(null);
    });

    const timeout = setTimeout(() => {
      appendClientServiceLog("discovery timed out");
      finish(null);
    }, timeoutMs);

    socket.bind(0, "0.0.0.0", () => {
      try {
        socket.setBroadcast(true);
        socket.send(discoveryPayload, DISCOVERY_PORT, "255.255.255.255");
      } catch (error) {
        appendClientServiceLog(`discovery send failed ${error.message}`);
        finish(null);
      }
    });
  });
}

async function autoDetectServerUrlIfNeeded() {
  if (!shouldAutoDiscoverServerUrl(clientSettings.serverUrl)) {
    return;
  }

  appendClientServiceLog(`attempting reception discovery from ${clientSettings.serverUrl}`);
  const discoveredServerUrl = await discoverReceptionServer();

  if (!discoveredServerUrl) {
    appendClientServiceLog("no reception server discovered");
    return;
  }

  clientSettings.serverUrl = discoveredServerUrl;
  saveClientSettings();
}

function loadClientServiceModule() {
  if (!clientServiceModulePromise) {
    const moduleUrl = pathToFileURL(path.join(__dirname, "index.js")).href;
    clientServiceModulePromise = import(moduleUrl);
  }

  return clientServiceModulePromise;
}

async function startClientService() {
  await stopClientService();

  appendClientServiceLog(
    `starting hardware service room=${clientSettings.roomId} device=${clientSettings.deviceId} server=${clientSettings.serverUrl}`,
  );

  try {
    const clientServiceModule = await loadClientServiceModule();
    await clientServiceModule.startClientHardwareService({
      serverUrl: clientSettings.serverUrl,
      serverAccessKey: clientSettings.serverAccessKey,
      roomId: clientSettings.roomId,
      deviceId: clientSettings.deviceId,
      playPingAudio: false,
      roomButtonAppearances: clientSettings.roomButtonAppearances,
      roomLeftAuxSettings: clientSettings.roomLeftAuxSettings,
      roomRightAuxSettings: clientSettings.roomRightAuxSettings,
      roomActionSettings: clientSettings.roomActionSettings,
      onLog: (line) => {
        appendClientServiceLog(line);
      },
      onStatus: (status) => {
        updateClientHardwareStatus(status);
      },
    });
    clientServiceRunning = true;
    appendClientServiceLog("hardware service started");
    updateClientHardwareStatus(
      clientServiceModule.getClientHardwareStatus?.() || {
        state: "starting",
        detail: "Starting Stream Deck service",
      },
    );
  } catch (error) {
    clientServiceRunning = false;
    appendClientServiceLog(`start failed ${error.stack || error.message}`);
    updateClientHardwareStatus({
      state: "error",
      detail: error.message || "Hardware service failed to start",
    });
  }
}

async function updateRunningClientServiceSettings(patch = {}) {
  if (!clientServiceRunning) {
    return;
  }

  try {
    const clientServiceModule = await loadClientServiceModule();
    await clientServiceModule.updateClientHardwareServiceSettings?.(patch);
  } catch (error) {
    appendClientServiceLog(`settings update failed ${error.stack || error.message}`);
  }
}

async function stopClientService() {
  if (!clientServiceRunning && !clientServiceModulePromise) {
    return;
  }

  try {
    const clientServiceModule = await loadClientServiceModule();
    await clientServiceModule.stopClientHardwareService();
    appendClientServiceLog("hardware service stopped");
  } catch (error) {
    appendClientServiceLog(`stop failed ${error.stack || error.message}`);
  } finally {
    clientServiceRunning = false;
  }
}

function shouldLaunchHidden() {
  if (process.argv.includes("--hidden") || process.argv.includes("--startup-tray")) {
    return true;
  }

  if (!app.isPackaged) {
    return false;
  }

  return false;
}

function showMainWindow() {
  if (!mainWindow) {
    if (shouldOpenRoleWindowOnLaunch()) {
      createRoleWindow();
    }
    return;
  }

  mainWindow.setSkipTaskbar(false);

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.setAlwaysOnTop(Boolean(clientSettings.alwaysOnTop));
  mainWindow.focus();
  positionThreadRailWindow();
  syncExternalThreadRailWindow();
  refreshTrayMenu();
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

function getMessagePopupBounds(options = {}) {
  const popupHeight = Math.max(
    MESSAGE_POPUP_MIN_HEIGHT,
    Math.round(Number(options.height) || MESSAGE_POPUP_MIN_HEIGHT),
  );
  const popupWidth = Math.max(260, Math.round(Number(options.width) || MESSAGE_POPUP_WIDTH));
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
      preload: path.join(__dirname, "message-popup-preload.cjs"),
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

function shouldShowMessagePopup() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true;
  }

  return (
    !mainWindow.isVisible() ||
    mainWindow.isMinimized() ||
    !mainWindow.isFocused() ||
    normalizePanelDisplayMode(currentPanelDisplayMode) === "buttons"
  );
}

function showMessagePopup(payload = {}) {
  if (!shouldShowMessagePopup()) {
    return;
  }

  const kind = String(payload.kind || "message").trim() || "message";

  latestMessagePopupPayload = {
    ...payload,
    kind,
    openMode: String(payload.openMode || "").trim(),
    messageId: String(payload.messageId || "").trim(),
    threadKey: String(payload.threadKey || "").trim(),
    sourceLabel: String(payload.sourceLabel || "Msg").trim().slice(0, 7) || "Msg",
    text: String(payload.text || "New message").trim() || "New message",
    accentColor: String(payload.accentColor || "#111111").trim() || "#111111",
  };

  const popupWindow = createMessagePopupWindow();
  popupWindow.setBounds(getMessagePopupBounds({
    width: kind === "receptionPing" ? RECEPTION_PING_POPUP_WIDTH : MESSAGE_POPUP_WIDTH,
    height: kind === "receptionPing"
      ? RECEPTION_PING_POPUP_HEIGHT
      : estimateMessagePopupHeight(latestMessagePopupPayload.text),
  }), false);
  popupWindow.showInactive();
  refreshTransparentWindowChrome(popupWindow);
  sendMessagePopupPayload(latestMessagePopupPayload);
}

function closeReceptionPingPopup() {
  if (latestMessagePopupPayload?.kind !== "receptionPing") {
    return;
  }

  latestMessagePopupPayload = null;
  closeMessagePopup();
}

function showMainWindowFromMessagePopup(options = {}) {
  const popupPayload = latestMessagePopupPayload;
  closeMessagePopup();
  showMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.moveTop();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(Boolean(clientSettings.alwaysOnTop));
    mainWindow.webContents.send("panel:messagePopupOpen", {
      ...popupPayload,
      ...options,
    });
  }
}

function hideWindowToTray() {
  if (!mainWindow) {
    return;
  }

  hideThreadRailWindow();
  mainWindow.hide();
  refreshTrayMenu();
}

function toggleMainWindowVisibility() {
  if (!mainWindow) {
    createRoleWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    hideWindowToTray();
    return;
  }

  showMainWindow();
}

function getTrayIcon() {
  const icon = getAppIcon();

  if (!icon.isEmpty()) {
    return icon.resize({ width: 16, height: 16 });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="16" fill="#0f766e"/>
      <circle cx="32" cy="32" r="12" fill="#ffffff"/>
      <circle cx="32" cy="32" r="6" fill="#0f766e"/>
    </svg>
  `;
  const fallbackIcon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );
  return fallbackIcon.resize({ width: 16, height: 16 });
}

function getAppIcon() {
  const iconPaths = [
    path.join(__dirname, "assets", "tray-icon.ico"),
  ];

  for (const iconPath of iconPaths) {
    const icon = nativeImage.createFromPath(iconPath);

    if (!icon.isEmpty()) {
      return icon;
    }
  }

  return nativeImage.createEmpty();
}

function getBrandLogoDataUrl() {
  const logoPath = path.join(__dirname, "assets", "tray-icon.png");

  if (!fs.existsSync(logoPath)) {
    return "";
  }

  return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
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

  const appName = "Pip (Client)";
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

function isOpenAtLoginEnabled() {
  return Boolean(app.getLoginItemSettings().openAtLogin);
}

function setOpenAtLogin(enabled) {
  clientSettings.launchAtStartup = Boolean(enabled);
  saveClientSettings();
  app.setLoginItemSettings({
    openAtLogin: clientSettings.launchAtStartup,
    openAsHidden: !clientSettings.showPanelAtStartup,
    args: clientSettings.showPanelAtStartup ? [] : ["--startup-tray"],
  });
  refreshTrayMenu();
}

function setWindowSettingsExpanded(details) {
  const mode = typeof details === "object" && details !== null
    ? typeof details.mode === "string"
      ? normalizePanelDisplayMode(details.mode)
      : typeof details.expanded === "boolean"
        ? details.expanded
          ? "both"
          : "messages"
        : "messages"
    : details
      ? "both"
      : "messages";
  currentPanelDisplayMode = mode;
  const messageComposerHeightOffset = typeof details === "object" && details !== null
    ? Math.min(220, Math.max(0, Math.round(Number(details.messageComposerHeightOffset) || 0)))
    : 0;
  const previousMode = typeof details === "object" && details !== null && typeof details.previousMode === "string"
    ? normalizePanelDisplayMode(details.previousMode)
    : normalizePanelDisplayMode(clientSettings.panelDisplayMode);
  const shouldAnimateResize = !(typeof details === "object" && details !== null && details.animate === false);
  isSettingsPanelExpanded = mode === "both";

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const bannerOffset = currentBannerVisible ? SURGERY_BANNER_HEIGHT : 0;
  const targetHeight =
    getPanelDisplayModeHeight(mode) + (mode === "buttons" ? 0 : messageComposerHeightOffset) + bannerOffset;
  const minimumHeight = targetHeight;
  const [currentX, currentY] = mainWindow.getPosition();
  const [currentWidth, currentHeight] = mainWindow.getSize();
  const targetWidth = getPanelDisplayModeWidth(mode);
  const previousVisibleWidth = getPanelDisplayModeWidth(previousMode);
  const currentRight = currentX + previousVisibleWidth;
  const nextY = currentY + currentHeight - targetHeight;
  const workArea = screen.getDisplayMatching({
    x: currentX,
    y: currentY,
    width: currentWidth,
    height: currentHeight,
  }).workArea;
  const nextX = clampWindowXToVisibleWidth(currentRight - targetWidth, targetWidth, workArea);

  mainWindow.setMinimumSize(targetWidth, minimumHeight);
  mainWindow.setBounds({
    x: nextX,
    y: nextY,
    width: targetWidth,
    height: targetHeight,
  }, shouldAnimateResize);
  positionThreadRailWindow();
  syncExternalThreadRailWindow();
}

let currentBannerVisible = false;

function setWindowBannerVisible(bannerVisible) {
  const isVisible = Boolean(bannerVisible);

  if (!mainWindow || mainWindow.isDestroyed() || isVisible === currentBannerVisible) {
    currentBannerVisible = isVisible;
    return;
  }

  currentBannerVisible = isVisible;

  const [currentX, currentY] = mainWindow.getPosition();
  const [currentWidth, currentHeight] = mainWindow.getSize();
  const heightDelta = isVisible ? SURGERY_BANNER_HEIGHT : -SURGERY_BANNER_HEIGHT;
  const targetHeight = currentHeight + heightDelta;
  const nextY = currentY - heightDelta; // Expand from bottom up (move Y up when adding height)

  mainWindow.setMinimumSize(currentWidth, targetHeight);
  mainWindow.setBounds({
    x: currentX,
    y: nextY,
    width: currentWidth,
    height: targetHeight,
  }, true);
  positionThreadRailWindow();
  syncExternalThreadRailWindow();
}

function setWindowOfflineCompact(isCompact) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const [currentX, currentY] = mainWindow.getPosition();
  const [currentWidth, currentHeight] = mainWindow.getSize();

  if (isCompact) {
    const targetHeight = SURGERY_OFFLINE_COMPACT_HEIGHT;
    const nextY = currentY + currentHeight - targetHeight;
    mainWindow.setMinimumSize(currentWidth, targetHeight);
    mainWindow.setBounds({
      x: currentX,
      y: nextY,
      width: currentWidth,
      height: targetHeight,
    }, true);
    positionThreadRailWindow();
    syncExternalThreadRailWindow();
  } else {
    // Restore to normal height based on current display mode
    const mode = currentPanelDisplayMode;
    const bannerOffset = currentBannerVisible ? SURGERY_BANNER_HEIGHT : 0;
    const targetHeight = getPanelDisplayModeHeight(mode) + bannerOffset;
    const nextY = currentY + currentHeight - targetHeight;
    mainWindow.setMinimumSize(currentWidth, targetHeight);
    mainWindow.setBounds({
      x: currentX,
      y: nextY,
      width: currentWidth,
      height: targetHeight,
    }, true);
    positionThreadRailWindow();
    syncExternalThreadRailWindow();
  }
}

function minimizeWindow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  if (targetWindow === mainWindow) {
    allowNativeMinimize = true;
    hideThreadRailWindow();
  }

  targetWindow.minimize();
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: "Always on top",
      type: "checkbox",
      checked: clientSettings.alwaysOnTop,
      click: (menuItem) => {
        clientSettings.alwaysOnTop = menuItem.checked;
        saveClientSettings();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(clientSettings.alwaysOnTop);
        }
        if (threadRailWindow && !threadRailWindow.isDestroyed()) {
          threadRailWindow.setAlwaysOnTop(Boolean(clientSettings.alwaysOnTop) && !settingsWindow?.isVisible());
        }
        refreshTrayMenu();
      },
    },
    {
      label: "Minimise at startup",
      type: "checkbox",
      checked: !clientSettings.showPanelAtStartup,
      click: (menuItem) => {
        clientSettings.showPanelAtStartup = !menuItem.checked;
        saveClientSettings();
        setOpenAtLogin(clientSettings.launchAtStartup);
      },
    },
    {
      label: "Run at startup",
      type: "checkbox",
      checked: clientSettings.launchAtStartup,
      click: (menuItem) => {
        setOpenAtLogin(menuItem.checked);
      },
    },
    { type: "separator" },
    {
      label: "About",
      click: () => {
        showAboutDialog();
      },
    },
    {
      label: "Quit",
      click: async () => {
        const response = await dialog.showMessageBox({
          type: "question",
          buttons: ["Cancel", "Quit"],
          defaultId: 1,
          cancelId: 0,
          title: "Quit Pip",
          message: "Do you want to quit Pip?",
          detail: "",
          noLink: true,
          parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
        });

        if (response.response === 1) {
          isQuitting = true;
          app.quit();
        }
      },
    },
  ]);

  tray.setToolTip("Pip Surgery");
  tray.setContextMenu(menu);
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(getTrayIcon());
  tray.on("click", () => {
    if (mainWindow) {
      toggleMainWindowVisibility();
      return;
    }

    createRoleWindow();
  });
  tray.on("double-click", () => {
    if (mainWindow) {
      showMainWindow();
      return;
    }

    createRoleWindow();
  });
  refreshTrayMenu();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, _argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  configureAboutPanel();
  clientServiceLogPath = getClientServiceLogPath();
  loadClientSettings();
  await autoDetectServerUrlIfNeeded();

  ipcMain.handle("panel:playAcknowledgementSound", async () => {
    await playAlertSound({ sound: "notification_sound_02", volume: 80 });
    return { ok: true };
  });
  ipcMain.handle("panel:playAlertSound", async (_event, options = {}) => {
    await playAlertSound(options);
    return { ok: true };
  });
  ipcMain.handle("panel:showMessagePopup", (_event, payload = {}) => {
    showMessagePopup(payload);
    return { ok: true };
  });
  ipcMain.handle("panel:closeReceptionPingPopup", () => {
    closeReceptionPingPopup();
    return { ok: true };
  });
  ipcMain.handle("panel:syncThreadRail", (_event, payload = {}) => {
    if (!USE_EXTERNAL_THREAD_RAIL) {
      return { ok: true, external: false };
    }

    latestThreadRailPayload = {
      visible: Boolean(payload.visible),
      collapsed: Boolean(payload.collapsed),
      top: Math.max(8, Math.round(Number(payload.top) || 8)),
      threads: Array.isArray(payload.threads) ? payload.threads : [],
    };
    syncExternalThreadRailWindow();
    return { ok: true, external: true };
  });
  ipcMain.handle("threadRail:selectThread", (_event, threadKey) => {
    const normalizedThreadKey = String(threadKey || "").trim();

    if (normalizedThreadKey && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("panel:threadRailSelect", normalizedThreadKey);
      showMainWindow();
    }

    return { ok: Boolean(normalizedThreadKey) };
  });
  ipcMain.handle("message-popup:close", () => {
    closeMessagePopup();
    return { ok: true };
  });
  ipcMain.handle("message-popup:openMain", (_event, options = {}) => {
    showMainWindowFromMessagePopup(options);
    return { ok: true };
  });
  ipcMain.handle("message-popup:dismissReceptionPing", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("panel:messagePopupDismissReceptionPing");
    }
    return { ok: true };
  });
  ipcMain.handle("message-popup:panelAction", (_event, buttonId = "") => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("panel:messagePopupPanelAction", {
        buttonId: String(buttonId || "").trim(),
      });
    }
    return { ok: true };
  });
  ipcMain.handle("panel:hideWindow", () => {
    hideWindowToTray();
    return { ok: true };
  });
  ipcMain.handle("panel:quitApp", async () => {
    const response = await dialog.showMessageBox({
      type: "question",
      buttons: ["Cancel", "Quit"],
      defaultId: 1,
      cancelId: 0,
      title: "Quit Pip",
      message: "Do you want to quit Pip?",
      detail: "",
      noLink: true,
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    });

    if (response.response === 1) {
      isQuitting = true;
      app.quit();
      return { ok: true, quit: true };
    }

    return { ok: true, quit: false };
  });
  ipcMain.handle("panel:minimizeWindow", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    minimizeWindow(targetWindow);
    return { ok: true };
  });
  ipcMain.handle("panel:expandWindow", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (!targetWindow || targetWindow.isDestroyed()) {
      return { ok: false, isExpanded: false };
    }

    const [currentX, currentY] = targetWindow.getPosition();
    const [currentWidth, currentHeight] = targetWindow.getSize();

    const collapsedWidth = getPanelDisplayModeWidth("messages");
    const expandedWidth = getPanelExpandedWidth();

    if (currentWidth >= expandedWidth) {
      // Collapse back to original width
      if (preExpandWindowPosition) {
        targetWindow.setBounds({
          x: preExpandWindowPosition.x,
          y: preExpandWindowPosition.y,
          width: collapsedWidth,
          height: preExpandWindowPosition.height,
        }, true);
        preExpandWindowPosition = null;
      } else {
        targetWindow.setBounds({
          x: currentX,
          y: currentY,
          width: collapsedWidth,
        }, true);
      }

      positionThreadRailWindow();

      return { ok: true, isExpanded: false };
    } else {
      // Save current position and collapse back
      preExpandWindowPosition = {
        x: currentX,
        y: currentY,
        width: collapsedWidth,
        height: currentHeight,
      };

      // Center the expanded window on the current display
      const display = require("electron").screen.getDisplayNearestPoint({
        x: currentX,
        y: currentY,
      });
      const workArea = display.workArea;
      const expandedHeight = Math.min(
        currentHeight + SURGERY_WINDOW_EXPANDED_HEIGHT_DELTA,
        workArea.height,
      );
      const expandedX = Math.round(
        workArea.x + (workArea.width - expandedWidth) / 2,
      );
      const expandedY = Math.round(
        workArea.y + (workArea.height - expandedHeight) / 2,
      );

      targetWindow.setBounds({
        x: expandedX,
        y: expandedY,
        width: expandedWidth,
        height: expandedHeight,
      }, true);
      positionThreadRailWindow();

      return { ok: true, isExpanded: true };
    }
  });
  ipcMain.handle("panel:openSettingsWindow", () => {
    createSettingsWindow();
    return { ok: true };
  });
  ipcMain.handle("panel:openRoleWindow", () => {
    createRoleWindow();
    return { ok: true };
  });

  ipcMain.handle("panel:getSettings", () => clientSettings);
  ipcMain.handle("panel:getRoleState", () => ({
    runtimeRole: clientSettings.runtimeRole,
    runtimeRoleConfirmed: Boolean(clientSettings.runtimeRoleConfirmed),
    supportedRoles: [RUNTIME_ROLE_RECEPTION, RUNTIME_ROLE_ROOM],
    nativeRuntimeRole: CURRENT_APP_RUNTIME_ROLE,
    isSupportedInThisBuild: isCurrentRuntimeRoleSupported(),
    requiresRestartAfterChange: false,
  }));
  ipcMain.handle("panel:getHardwareStatus", () => clientHardwareStatus);
  ipcMain.handle("panel:closeRoleWindow", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.close();
    }

    return { ok: true };
  });
  ipcMain.handle("panel:setSettingsExpanded", (_event, expanded) => {
    setWindowSettingsExpanded(expanded);
    return { ok: true };
  });
  ipcMain.handle("panel:setBannerVisible", (_event, bannerVisible) => {
    setWindowBannerVisible(bannerVisible);
    return { ok: true };
  });
  ipcMain.handle("panel:setOfflineCompact", (_event, isCompact) => {
    setWindowOfflineCompact(isCompact);
    return { ok: true };
  });
  ipcMain.handle("panel:updateSettings", async (_event, patch = {}) => {
    const previousRuntimeRole = clientSettings.runtimeRole;
    const previousServerUrl = clientSettings.serverUrl;
    const previousServerAccessKey = clientSettings.serverAccessKey;
    const previousRoomId = clientSettings.roomId;
    const previousRoomButtonAppearances = clientSettings.roomButtonAppearances;
    const previousRoomLeftAuxSettings = clientSettings.roomLeftAuxSettings;
    const previousRoomRightAuxSettings = clientSettings.roomRightAuxSettings;
    const previousRoomActionSettings = clientSettings.roomActionSettings;
    const previousRoomMessageGroups = clientSettings.roomMessageGroups;
    const previousPanelDisplayMode = clientSettings.panelDisplayMode;
    const roomPinnedMessageThreads = patch.roomPinnedMessageThreads && typeof patch.roomPinnedMessageThreads === "object"
      ? normalizeRoomPinnedMessageThreads(patch.roomPinnedMessageThreads)
      : clientSettings.roomPinnedMessageThreads;
    const roomButtonAppearances = patch.roomButtonAppearances && typeof patch.roomButtonAppearances === "object"
      ? normalizeRoomButtonAppearances(patch.roomButtonAppearances)
      : clientSettings.roomButtonAppearances;
    const roomLeftAuxSettings = patch.roomLeftAuxSettings && typeof patch.roomLeftAuxSettings === "object"
      ? normalizeRoomLeftAuxSettings(patch.roomLeftAuxSettings)
      : clientSettings.roomLeftAuxSettings;
    const roomRightAuxSettings = patch.roomRightAuxSettings && typeof patch.roomRightAuxSettings === "object"
      ? normalizeRoomRightAuxSettings(patch.roomRightAuxSettings)
      : clientSettings.roomRightAuxSettings;
    const roomActionSettings = patch.roomActionSettings && typeof patch.roomActionSettings === "object"
      ? normalizeRoomActionSettings(patch.roomActionSettings)
      : clientSettings.roomActionSettings;
    const roomMessageGroups = CONFIGURED_MESSAGE_GROUPS_ENABLED &&
      patch.roomMessageGroups && typeof patch.roomMessageGroups === "object"
      ? normalizeRoomMessageGroups(patch.roomMessageGroups)
      : clientSettings.roomMessageGroups;
    clientSettings = {
      ...clientSettings,
      runtimeRole:
        typeof patch.runtimeRole === "string"
          ? normalizeRuntimeRole(patch.runtimeRole, clientSettings.runtimeRole)
          : clientSettings.runtimeRole,
      runtimeRoleConfirmed:
        typeof patch.runtimeRoleConfirmed === "boolean"
          ? patch.runtimeRoleConfirmed
          : clientSettings.runtimeRoleConfirmed,
      serverUrl: patch.serverUrl || clientSettings.serverUrl,
      serverAccessKey:
        typeof patch.serverAccessKey === "string"
          ? patch.serverAccessKey.trim()
          : clientSettings.serverAccessKey,
      roomId: patch.roomId || clientSettings.roomId,
      launchAtStartup:
        typeof patch.launchAtStartup === "boolean"
          ? patch.launchAtStartup
          : clientSettings.launchAtStartup,
      showPanelAtStartup:
        typeof patch.showPanelAtStartup === "boolean"
          ? patch.showPanelAtStartup
          : clientSettings.showPanelAtStartup,
      alwaysOnTop:
        typeof patch.alwaysOnTop === "boolean"
          ? patch.alwaysOnTop
          : clientSettings.alwaysOnTop,
      messageSound:
        typeof patch.messageSound === "string"
          ? normalizeSurgerySound(patch.messageSound)
          : clientSettings.messageSound,
      messageVolume:
        typeof patch.messageVolume === "number" || typeof patch.messageVolume === "string"
          ? clampSurgeryVolume(patch.messageVolume, clientSettings.messageVolume)
          : clientSettings.messageVolume,
      roomAlertVolumes:
        patch.roomAlertVolumes && typeof patch.roomAlertVolumes === "object"
          ? patch.roomAlertVolumes
          : clientSettings.roomAlertVolumes,
      roomAlertSounds:
        patch.roomAlertSounds && typeof patch.roomAlertSounds === "object"
          ? patch.roomAlertSounds
          : clientSettings.roomAlertSounds,
      roomButtonAppearances,
      roomLeftAuxSettings,
      roomRightAuxSettings,
      roomActionSettings,
      roomMessageGroups,
      roomPinnedMessageThreads,
      panelDisplayMode:
        typeof patch.panelDisplayMode === "string"
          ? normalizePanelDisplayMode(patch.panelDisplayMode)
          : clientSettings.panelDisplayMode,
      popupPosition:
        typeof patch.popupPosition === "string"
          ? normalizePopupPosition(patch.popupPosition)
          : clientSettings.popupPosition,
    };
    currentPanelDisplayMode = clientSettings.panelDisplayMode;
    saveClientSettings();
    broadcastPanelSettings();

    if (clientSettings.runtimeRole !== previousRuntimeRole) {
      if (isCurrentRuntimeRoleSupported()) {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow({ showInitially: true });
        }
        await startClientService();
      } else {
        await stopClientService();
        destroyMainWindow();
        createRoleWindow();
      }

      refreshTrayMenu();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(Boolean(clientSettings.alwaysOnTop));
    }

    if (threadRailWindow && !threadRailWindow.isDestroyed()) {
      threadRailWindow.setAlwaysOnTop(Boolean(clientSettings.alwaysOnTop) && !settingsWindow?.isVisible());
    }

    if (messagePopupWindow && !messagePopupWindow.isDestroyed()) {
      messagePopupWindow.setBounds(getMessagePopupBounds());
    }

    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      clientSettings.panelDisplayMode !== previousPanelDisplayMode
    ) {
      setWindowSettingsExpanded({ mode: clientSettings.panelDisplayMode });
    }

    if (typeof patch.showPanelAtStartup === "boolean") {
      setOpenAtLogin(clientSettings.launchAtStartup);
    }

    if (
      clientSettings.serverUrl !== previousServerUrl ||
      clientSettings.serverAccessKey !== previousServerAccessKey ||
      clientSettings.roomId !== previousRoomId
    ) {
      await startClientService();
    } else if (
      roomButtonAppearances !== previousRoomButtonAppearances ||
      roomLeftAuxSettings !== previousRoomLeftAuxSettings ||
      roomRightAuxSettings !== previousRoomRightAuxSettings ||
      roomActionSettings !== previousRoomActionSettings ||
      roomMessageGroups !== previousRoomMessageGroups
    ) {
      await updateRunningClientServiceSettings({
        roomButtonAppearances: clientSettings.roomButtonAppearances,
        roomLeftAuxSettings: clientSettings.roomLeftAuxSettings,
        roomRightAuxSettings: clientSettings.roomRightAuxSettings,
        roomActionSettings: clientSettings.roomActionSettings,
      });
    }

    return clientSettings;
  });

  createTray();
  setOpenAtLogin(clientSettings.launchAtStartup);
  if (isCurrentRuntimeRoleSupported()) {
    createWindow({ showInitially: !shouldLaunchHidden() });
  }

  if (shouldOpenRoleWindowOnLaunch()) {
    createRoleWindow();
  }
  if (isCurrentRuntimeRoleSupported()) {
    startClientService().catch((error) => {
      appendClientServiceLog(`startup failed ${error.stack || error.message}`);
    });
  } else {
    appendClientServiceLog(
      `startup blocked because saved runtimeRole=${clientSettings.runtimeRole} is not supported by this build`,
    );
    updateClientHardwareStatus({
      state: "stopped",
      detail: "Saved role is not supported by this build",
    });
  }

  app.on("activate", () => {
    if (!isCurrentRuntimeRoleSupported()) {
      createRoleWindow();
      return;
    }

    if (!mainWindow) {
      createWindow({ showInitially: true });
      return;
    }

    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  // Keep the surgery service alive in the tray.
});

app.on("before-quit", () => {
  isQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("panel:appQuitting");
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("panel:appQuitting");
  }
  stopClientService().catch((error) => {
    appendClientServiceLog(`before-quit stop failed ${error.stack || error.message}`);
  });
});

function playAlertSound(options = {}) {
  return new Promise((resolve) => {
    const command = buildSurgeryAlertSoundCommand(options);

    exec(command, () => {
      resolve();
    });
  });
}

function buildSurgeryAlertSoundCommand(options = {}) {
  const sound = normalizeSurgerySound(options.sound);
  const parsedVolume = Number(options.volume);
  const volume = Number.isFinite(parsedVolume)
    ? Math.max(0, Math.min(100, Math.round(parsedVolume)))
    : 80;
  const soundPath = resolveSurgerySoundPath(sound);
  const platform = process.platform;

  if (platform === "darwin") {
    const normalizedVolume = Math.max(0, Math.min(1, volume / 100)).toFixed(2);
    return `afplay -v ${normalizedVolume} "${escapeDoubleQuotedPath(soundPath)}"`;
  }

  if (platform === "win32") {
    return `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer '${escapePowerShellPath(soundPath)}').PlaySync()"`;
  }

  return "printf '\\a'";
}

function normalizeSurgerySound(sound) {
  const normalized = String(sound || DEFAULT_SURGERY_SOUND)
    .trim()
    .toLowerCase();
  const mapped = LEGACY_SURGERY_SOUND_ALIASES[normalized] || normalized;
  return SURGERY_SOUND_FILE_MAP[mapped] ? mapped : DEFAULT_SURGERY_SOUND;
}

function clampSurgeryVolume(volume, fallback = 80) {
  const parsed = Number(volume);

  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.min(100, Math.round(Number(fallback) || 80)));
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function resolveSurgerySoundPath(sound) {
  const soundFileName = SURGERY_SOUND_FILE_MAP[sound] || SURGERY_SOUND_FILE_MAP[DEFAULT_SURGERY_SOUND];
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
