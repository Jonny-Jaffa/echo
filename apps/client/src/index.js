import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocket } from "ws";
import { listStreamDecks, openStreamDeck } from "@elgato-stream-deck/node";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_RUNTIME_SETTINGS = {
  serverUrl: process.env.PIP_SERVER || "http://127.0.0.1:3210",
  serverAccessKey: process.env.PIP_ACCESS_KEY || "",
  roomId: process.env.PIP_ROOM_ID || "surgery-1",
  deviceId:
    process.env.PIP_DEVICE_ID ||
    `${os.hostname()}-${process.env.PIP_ROOM_ID || "surgery-1"}`,
  streamDeckSerial: process.env.PIP_STREAMDECK_SERIAL || "",
  playPingAudio: true,
  roomButtonAppearances: {},
  roomLeftAuxSettings: {},
  roomRightAuxSettings: {},
  roomActionSettings: {},
};
const CONFIG_REFRESH_MS = 15000;
const LCD_CLOCK_REFRESH_MS = 30000;
const LCD_FLASH_INTERVAL_MS = 900;
const PARTY_MODE_INTERVAL_MS = 260;
const PARTY_LCD_FLASH_FRAME_WINDOW = 2;
const LUCY_MODE_INTERVAL_MS = 900;
const NEO_LEFT_AUX_BUTTON_INDEX = 8;
const NEO_RIGHT_AUX_BUTTON_INDEX = 9;
const DEFAULT_BUTTON_BACKGROUND_HEX = "#FDD905";
const DEFAULT_BUTTON_TEXT_HEX = "#000000";
const DEFAULT_ACTIVE_BUTTON_BACKGROUND_HEX = "#000000";
const DEFAULT_ACTIVE_BUTTON_TEXT_HEX = "#FFFFFF";
const LUCY_MODE_ACCENT_HEX = "#FFD400";
const LUCY_TOP_ROW_LABELS = ["L", "U", "C", "Y"];
const DEFAULT_LEFT_AUX_SETTING = {
  enabled: true,
  mode: "party",
};
const DEFAULT_RIGHT_AUX_SETTING = {
  enabled: false,
  action: "none",
};
const ROOM_ACTION_BUTTON_COUNT = 8;
const PARTY_LCD_HEADLINE = "LETS PARTY!";
const DEFAULT_SURGERY_SOUND = "notification_sound_01";
const SURGERY_SOUND_FILE_MAP = Object.fromEntries(
  Array.from({ length: 17 }, (_value, index) => {
    const soundNumber = String(index + 1).padStart(2, "0");
    return [
      `notification_sound_${soundNumber}`,
      `Notification_sound_${soundNumber}.wav`,
    ];
  }),
);

let configState = null;
let socket = null;
let socketReconnectTimer = null;
let configRefreshTimer = null;
let streamDeck = null;
let streamDeckInfo = null;
let streamDeckReconnectTimer = null;
let lcdClockTimer = null;
let lcdFlashTimer = null;
let lcdFlashVisible = false;
let lcdFlashHex = null;
let partyModeActive = false;
let partyModeTimer = null;
let partyModeFrame = 0;
let lucyModeActive = false;
let lucyModeTimer = null;
let lucyRevealStep = 0;
let lucyHeartsVisible = false;
let svgRendererInitPromise = null;
let runtimeSettings = { ...DEFAULT_RUNTIME_SETTINGS };
let serviceRunning = false;
let shutdownHandlersBound = false;
let runtimeCallbacks = {
  onLog: null,
  onStatus: null,
};
let hardwareStatus = {
  state: "starting",
  detail: "Starting Stream Deck service",
  updatedAt: new Date().toISOString(),
};
let activeRenderer = "unknown";
let electronNativeImage = null;
let electronNativeImageLoaded = false;
let electronBrowserWindow = null;
let electronBrowserWindowLoaded = false;
let neoCanvasWindow = null;
let neoCanvasWindowPromise = null;
const pendingAcknowledgementButtons = new Set();
const activeNotificationsByButton = new Map();
let trackedNotificationSequence = 0;
const BITMAP_FONT_5X7 = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00001", "00001", "00001", "00001", "10001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  ":": ["0", "1", "0", "0", "1", "0", "0"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "-": ["000", "000", "000", "111", "000", "000", "000"],
  ".": ["0", "0", "0", "0", "0", "1", "0"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};

function getServerUrl() {
  return runtimeSettings.serverUrl;
}

function getServerAccessKey() {
  return runtimeSettings.serverAccessKey;
}

function getRoomId() {
  return runtimeSettings.roomId;
}

function getDeviceId() {
  return runtimeSettings.deviceId;
}

function getStreamDeckSerial() {
  return runtimeSettings.streamDeckSerial;
}

function applyRuntimeSettings(nextSettings = {}) {
  runtimeSettings = {
    ...runtimeSettings,
    serverUrl:
      String(nextSettings.serverUrl || runtimeSettings.serverUrl || "").trim() ||
      DEFAULT_RUNTIME_SETTINGS.serverUrl,
    serverAccessKey: String(
      nextSettings.serverAccessKey ?? runtimeSettings.serverAccessKey ?? "",
    ).trim(),
    roomId:
      String(nextSettings.roomId || runtimeSettings.roomId || "").trim() ||
      DEFAULT_RUNTIME_SETTINGS.roomId,
    deviceId:
      String(nextSettings.deviceId || runtimeSettings.deviceId || "").trim() ||
      DEFAULT_RUNTIME_SETTINGS.deviceId,
    streamDeckSerial: String(
      nextSettings.streamDeckSerial ?? runtimeSettings.streamDeckSerial ?? "",
    ).trim(),
    playPingAudio:
      typeof nextSettings.playPingAudio === "boolean"
        ? nextSettings.playPingAudio
        : runtimeSettings.playPingAudio,
    roomButtonAppearances: normalizeRoomButtonAppearances(
      nextSettings.roomButtonAppearances ?? runtimeSettings.roomButtonAppearances,
    ),
    roomLeftAuxSettings: normalizeRoomLeftAuxSettings(
      nextSettings.roomLeftAuxSettings ?? runtimeSettings.roomLeftAuxSettings,
    ),
    roomRightAuxSettings: normalizeRoomRightAuxSettings(
      nextSettings.roomRightAuxSettings ?? runtimeSettings.roomRightAuxSettings,
    ),
    roomActionSettings: normalizeRoomActionSettings(
      nextSettings.roomActionSettings ?? runtimeSettings.roomActionSettings,
    ),
  };
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

function normalizeButtonAppearance(buttonAppearance, fallbackAppearance = {}) {
  return {
    defaultBackground: normalizeCssBackground(
      buttonAppearance?.defaultBackground,
      fallbackAppearance.defaultBackground || DEFAULT_BUTTON_BACKGROUND_HEX,
    ),
    defaultText: normalizeHexColor(
      buttonAppearance?.defaultText,
      fallbackAppearance.defaultText || DEFAULT_BUTTON_TEXT_HEX,
    ),
    activeBackground: normalizeCssBackground(
      buttonAppearance?.activeBackground,
      fallbackAppearance.activeBackground || DEFAULT_ACTIVE_BUTTON_BACKGROUND_HEX,
    ),
    activeText: normalizeHexColor(
      buttonAppearance?.activeText,
      fallbackAppearance.activeText || DEFAULT_ACTIVE_BUTTON_TEXT_HEX,
    ),
  };
}

function normalizeRoomButtonAppearances(roomButtonAppearances) {
  if (!roomButtonAppearances || typeof roomButtonAppearances !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomButtonAppearances)
      .map(([roomId, buttonAppearance]) => [
        String(roomId || "").trim(),
        normalizeButtonAppearance(buttonAppearance),
      ])
      .filter(([roomId]) => roomId),
  );
}

function normalizeLeftAuxSetting(leftAuxSetting, fallbackSetting = {}) {
  const normalizedMode = String(leftAuxSetting?.mode || fallbackSetting.mode || DEFAULT_LEFT_AUX_SETTING.mode)
    .trim()
    .toLowerCase();

  return {
    enabled:
      typeof leftAuxSetting?.enabled === "boolean"
        ? leftAuxSetting.enabled
        : typeof fallbackSetting.enabled === "boolean"
          ? fallbackSetting.enabled
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

function normalizeRightAuxSetting(rightAuxSetting, fallbackSetting = {}) {
  const normalizedAction = String(
    rightAuxSetting?.action || fallbackSetting.action || DEFAULT_RIGHT_AUX_SETTING.action,
  )
    .trim()
    .toLowerCase();

  return {
    enabled:
      typeof rightAuxSetting?.enabled === "boolean"
        ? rightAuxSetting.enabled
        : typeof fallbackSetting.enabled === "boolean"
          ? fallbackSetting.enabled
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
    icon: String(notification?.icon || "").trim().slice(0, 20),
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

function formatErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }

  return error?.stack || error?.message || String(error);
}

function logClient(level, message, error = null) {
  const suffix = error ? ` ${formatErrorMessage(error)}` : "";
  const line = `[client] ${message}${suffix}`;

  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }

  try {
    runtimeCallbacks.onLog?.(line);
  } catch {
    // Ignore logger callback failures to keep the hardware service alive.
  }
}

function setHardwareStatus(state, detail) {
  hardwareStatus = {
    state,
    detail,
    updatedAt: new Date().toISOString(),
  };

  try {
    runtimeCallbacks.onStatus?.(hardwareStatus);
  } catch {
    // Ignore status callback failures to keep the hardware service alive.
  }
}

function getElectronNativeImage() {
  if (electronNativeImageLoaded) {
    return electronNativeImage;
  }

  electronNativeImageLoaded = true;

  if (!process.versions?.electron) {
    electronNativeImage = null;
    return electronNativeImage;
  }

  try {
    ({ nativeImage: electronNativeImage } = require("electron"));
  } catch {
    electronNativeImage = null;
  }

  return electronNativeImage;
}

function getElectronBrowserWindow() {
  if (electronBrowserWindowLoaded) {
    return electronBrowserWindow;
  }

  electronBrowserWindowLoaded = true;

  if (!process.versions?.electron) {
    electronBrowserWindow = null;
    return electronBrowserWindow;
  }

  try {
    ({ BrowserWindow: electronBrowserWindow } = require("electron"));
  } catch {
    electronBrowserWindow = null;
  }

  return electronBrowserWindow;
}

async function ensureNeoCanvasWindow() {
  if (neoCanvasWindow && !neoCanvasWindow.isDestroyed()) {
    return neoCanvasWindow;
  }

  if (neoCanvasWindowPromise) {
    return neoCanvasWindowPromise;
  }

  const BrowserWindow = getElectronBrowserWindow();

  if (!BrowserWindow) {
    return null;
  }

  neoCanvasWindowPromise = (async () => {
    const canvasWindow = new BrowserWindow({
      show: false,
      width: 320,
      height: 240,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
      },
    });

    canvasWindow.on("closed", () => {
      if (neoCanvasWindow === canvasWindow) {
        neoCanvasWindow = null;
      }
    });

    await canvasWindow.loadURL(
      "data:text/html;charset=UTF-8," +
        encodeURIComponent("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>"),
    );

    neoCanvasWindow = canvasWindow;
    return canvasWindow;
  })()
    .catch((error) => {
      neoCanvasWindowPromise = null;
      throw error;
    })
    .finally(() => {
      neoCanvasWindowPromise = null;
    });

  return neoCanvasWindowPromise;
}

async function closeNeoCanvasWindow() {
  if (!neoCanvasWindow || neoCanvasWindow.isDestroyed()) {
    neoCanvasWindow = null;
    return;
  }

  try {
    neoCanvasWindow.destroy();
  } catch {
    // Ignore renderer cleanup failures during shutdown.
  } finally {
    neoCanvasWindow = null;
  }
}

function closeSocketSafely(targetSocket) {
  if (!targetSocket) {
    return;
  }

  try {
    if (targetSocket.readyState === WebSocket.CONNECTING) {
      targetSocket.terminate?.();
      return;
    }

    if (
      targetSocket.readyState === WebSocket.OPEN ||
      targetSocket.readyState === WebSocket.CLOSING
    ) {
      targetSocket.close();
    }
  } catch {
    // Ignore socket close failures during reconnect/shutdown.
  }
}

function classifyStreamDeckOpenError(error) {
  const normalizedMessage = formatErrorMessage(error).toLowerCase();

  if (
    normalizedMessage.includes("access denied") ||
    normalizedMessage.includes("busy") ||
    normalizedMessage.includes("cannot open") ||
    normalizedMessage.includes("failed to open")
  ) {
    return {
      state: "busy",
      detail: "Stream Deck is busy or in use by another app",
    };
  }

  return {
    state: "error",
    detail: "Stream Deck connection failed",
  };
}

async function main() {
  setHardwareStatus("starting", "Starting Stream Deck service");

  // Retry initial HTTP requests to the reception server with backoff,
  // in case the server hasn't finished starting up yet (e.g. at boot).
  const maxRetries = 10;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      configState = await fetchConfig();
      await clearStartupNotifications();
      await registerClient();
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      logClient("warn", `reception server not ready (attempt ${attempt}/${maxRetries})`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  if (lastError) {
    logClient("error", "reception server unreachable after retries", lastError);
    setHardwareStatus("waiting", "Reception server unreachable, will retry");
    // Keep retrying the server connection in the background so we can
    // connect even if the reception server starts up much later.
    scheduleServerRetry();
    return;
  }

  connectSocket();
  await connectStreamDeck().catch((error) => {
    logClient("error", "initial stream deck connect failed", error);
    scheduleStreamDeckReconnect();
  });
  startConfigRefresh();
}

let serverRetryTimer = null;

function scheduleServerRetry() {
  if (!serviceRunning) {
    return;
  }

  if (serverRetryTimer) {
    return;
  }

  serverRetryTimer = setTimeout(async () => {
    serverRetryTimer = null;

    if (!serviceRunning) {
      return;
    }

    try {
      configState = await fetchConfig();
      await clearStartupNotifications();
      await registerClient();
    } catch (error) {
      logClient("warn", "reception server still unreachable, will retry later", error);
      scheduleServerRetry();
      return;
    }

    logClient("info", "reception server reached, completing startup");
    connectSocket();
    await connectStreamDeck().catch((error) => {
      logClient("error", "stream deck connect failed after server retry", error);
      scheduleStreamDeckReconnect();
    });
    startConfigRefresh();
  }, 10000);
}

async function fetchConfig() {
  return fetchJson(`${getServerUrl()}/config`);
}

async function clearStartupNotifications() {
  await postJson(`${getServerUrl()}/clear-notifications`, {
    source: "client-hardware-startup",
    deviceId: getDeviceId(),
    roomId: getRoomId(),
  });
  clearAllTrackedNotifications();
}

async function registerClient() {
  await postJson(`${getServerUrl()}/register`, {
    deviceId: getDeviceId(),
    roomId: getRoomId(),
    deviceName: os.hostname(),
    startedAt: new Date().toISOString(),
    source: "client-hardware",
  });
}

function connectSocket() {
  if (!serviceRunning) {
    return;
  }

  const wsUrl = getServerUrl().replace("http", "ws");

  if (socket) {
    socket.removeAllListeners();
    closeSocketSafely(socket);
    socket = null;
  }

  if (socketReconnectTimer) {
    clearTimeout(socketReconnectTimer);
    socketReconnectTimer = null;
  }

  socket = new WebSocket(buildAuthenticatedWebSocketUrl(wsUrl));

  socket.on("open", () => {
    console.log(`[client] connected to ${wsUrl}`);
    socket.send(
      JSON.stringify({
        type: "identify",
        deviceId: getDeviceId(),
        roomId: getRoomId(),
        deviceName: os.hostname(),
        source: "client-hardware",
      }),
    );
  });

  socket.on("message", async (rawData) => {
    const message = JSON.parse(String(rawData));

    if (message.type === "welcome" && message.config) {
      configState = message.config;
      console.log("[client] config received from reception");
      await syncStreamDeckButtons().catch((error) => {
        console.error("[client] stream deck sync failed", error.message);
      });
      return;
    }

    if (
      message.type === "room:ping" &&
      message.payload?.roomId === getRoomId()
    ) {
      console.log("[client] reception ping", message.payload);
      if (runtimeSettings.playPingAudio) {
        playPingSound();
      }
      startLcdPingFlash("#16a34a");
      return;
    }

    if (
      message.type === "notification" &&
      message.payload?.roomId === getRoomId()
    ) {
      await handleNotificationActivated(message.payload).catch((error) => {
        console.error("[client] notification activation handling failed", error.message);
      });
      return;
    }

    if (
      message.type === "notification:acknowledged" &&
      message.payload?.roomId === getRoomId()
    ) {
      await handleAcknowledgement(message.payload).catch((error) => {
        console.error("[client] acknowledgement handling failed", error.message);
      });
      return;
    }

    if (
      message.type === "notification:cancelled" &&
      message.payload?.roomId === getRoomId()
    ) {
      await handleCancellation(message.payload).catch((error) => {
        console.error("[client] cancellation handling failed", error.message);
      });
      return;
    }

    if (message.type === "notifications:cleared") {
      await handleNotificationsCleared(message.payload).catch((error) => {
        console.error("[client] notification reset handling failed", error.message);
      });
      return;
    }

    if (
      message.type === "room:pingCleared" &&
      message.payload?.roomId === getRoomId()
    ) {
      stopLcdPingFlash();
      return;
    }

    console.log("[client] message", message);
  });

  socket.on("close", () => {
    console.log("[client] disconnected");
    if (!serviceRunning) {
      return;
    }
    socketReconnectTimer = setTimeout(() => {
      connectSocket();
    }, 2000);
  });

  socket.on("error", (error) => {
    console.error("[client] websocket error", error.message);
  });
}

async function connectStreamDeck() {
  if (!serviceRunning) {
    return null;
  }

  if (streamDeck) {
    return streamDeck;
  }

  const devices = await listStreamDecks();

  if (devices.length === 0) {
    setHardwareStatus("waiting", "No Stream Deck detected");
    logClient("info", "no Stream Deck detected, running without hardware buttons");
    scheduleStreamDeckReconnect();
    return null;
  }

  const streamDeckSerial = getStreamDeckSerial();
  const nextDevice = streamDeckSerial
    ? devices.find((device) => device.serialNumber === streamDeckSerial)
    : devices.find((device) => device.model === "neo") || devices[0];

  if (!nextDevice) {
    setHardwareStatus("waiting", `No Stream Deck matched serial ${streamDeckSerial}`);
    logClient(
      "info",
      `no Stream Deck matched serial ${streamDeckSerial}, running without hardware buttons`,
    );
    scheduleStreamDeckReconnect();
    return null;
  }

  streamDeckInfo = nextDevice;
  try {
    streamDeck = await openStreamDeck(nextDevice.path, {
      resetToLogoOnClose: false,
    });
  } catch (error) {
    const classifiedError = classifyStreamDeckOpenError(error);
    setHardwareStatus(classifiedError.state, classifiedError.detail);
    logClient("error", "stream deck open failed", error);
    streamDeck = null;
    throw error;
  }

  setHardwareStatus(
    "connected",
    `Connected ${nextDevice.model} (${nextDevice.serialNumber || "no serial"})`,
  );
  logClient(
    "info",
    `connected Stream Deck ${nextDevice.model} (${nextDevice.serialNumber})`,
  );

  streamDeck.on("down", async (control) => {
    if (control.type !== "button") {
      return;
    }

    if (control.index === NEO_LEFT_AUX_BUTTON_INDEX) {
      await toggleLeftAuxMode().catch((error) => {
        console.error("[client] left auxiliary button handling failed", error.message);
      });
      return;
    }

    if (control.index === NEO_RIGHT_AUX_BUTTON_INDEX) {
      if (lcdFlashHex) {
        stopLcdPingFlash();
        sendPingCleared();
        console.log("[client] cleared lcd ping flash from right auxiliary button");
        return;
      }

      await toggleRightAuxMode().catch((error) => {
        console.error("[client] right auxiliary button handling failed", error.message);
      });
      return;
    }

    await handleDeviceButton(control.index).catch((error) => {
      console.error("[client] button handling failed", error.message);
    });
  });

  streamDeck.on("error", (error) => {
    setHardwareStatus("error", "Stream Deck disconnected");
    logClient("error", "stream deck error", error);
    scheduleStreamDeckReconnect();
  });

  await syncStreamDeckButtons();
  await renderLcdClock();
  startLcdClockUpdates();
  setHardwareStatus(
    "connected",
    `Connected ${nextDevice.model} (${nextDevice.serialNumber || "no serial"}) using ${activeRenderer}`,
  );
  return streamDeck;
}

async function syncStreamDeckButtons() {
  if (!streamDeck || !configState) {
    return;
  }

  if (partyModeActive) {
    await renderPartyModeFrame();
    await streamDeck.setBrightness(40);
    return;
  }

  if (lucyModeActive) {
    await renderLucyModeFrame();
    await streamDeck.setBrightness(40);
    return;
  }

  const room = resolveRoomConfig();
  const roomNotifications = resolveRoomNotifications();
  const buttonControls = streamDeck.CONTROLS.filter((control) => control.type === "button");
  await streamDeck.setBrightness(40);

  for (const control of buttonControls) {
    const action = roomNotifications.find((item) => Number(item.deviceButton) === control.index);

    try {
      if (control.feedbackType === "lcd") {
        const imageBuffer = await renderNeoButtonImage(action, control.index);
        await streamDeck.fillKeyBuffer(control.index, imageBuffer, {
          format: "rgba",
        });
        continue;
      }

      const [r, g, b] = parseHexColor(action?.color || "#d1d5db");
      await streamDeck.fillKeyColor(control.index, r, g, b);
    } catch (error) {
      logClient("error", `button render failed for control ${control.index}`, error);

      if (control.feedbackType === "lcd") {
        const fallbackBuffer = renderNeoButtonFallbackImage(action, control.index);
        await streamDeck.fillKeyBuffer(control.index, fallbackBuffer, {
          format: "rgba",
        });
        setHardwareStatus("connected", "Stream Deck connected using fallback button artwork");
        continue;
      }

      throw error;
    }
  }

  await streamDeck.setBrightness(40);
}

async function handleDeviceButton(buttonIndex) {
  if (partyModeActive || lucyModeActive) {
    return;
  }

  if (!configState) {
    configState = await fetchConfig();
  }

  const room = resolveRoomConfig();
  const action = resolveRoomActionByButtonIndex(buttonIndex);

  if (!action) {
    console.log(`[client] button ${buttonIndex} is not mapped`);
    return;
  }

  if (activeNotificationsByButton.has(Number(buttonIndex))) {
    await cancelActiveNotification(buttonIndex);
    return;
  }

  const payload = buildRoomNotificationPayload(room, action, {
    notificationId: randomUUID(),
    source: "client-streamdeck",
    deviceId: getDeviceId(),
    deviceButton: Number(buttonIndex),
    deviceSerialNumber: streamDeckInfo?.serialNumber || null,
  });

  await sendNotification(payload);
  activeNotificationsByButton.set(Number(buttonIndex), {
    notificationId: payload.notificationId,
    actionId: String(action.id || "").trim(),
    sequence: trackedNotificationSequence + 1,
  });
  trackedNotificationSequence += 1;
  pendingAcknowledgementButtons.add(Number(buttonIndex));
  await syncStreamDeckButtons();
  stopLcdPingFlash();
  console.log(
    `[client] sent notification from button ${buttonIndex}: ${payload.message}`,
  );
}

async function handleAcknowledgement(payload) {
  if (payload?.roomId && String(payload.roomId) !== getRoomId()) {
    return;
  }

  const acknowledgedButtonIndex = resolveTrackedButtonIndex(payload);

  if (!Number.isFinite(acknowledgedButtonIndex)) {
    return;
  }

  clearTrackedButtonState(acknowledgedButtonIndex);
  await syncStreamDeckButtons();
}

async function handleCancellation(payload) {
  if (payload?.roomId && String(payload.roomId) !== getRoomId()) {
    return;
  }

  const cancelledButtonIndex = resolveTrackedButtonIndex(payload);

  if (!Number.isFinite(cancelledButtonIndex)) {
    return;
  }

  clearTrackedButtonState(cancelledButtonIndex);
  await syncStreamDeckButtons();
}

async function handleNotificationsCleared(payload = {}) {
  if (payload?.roomId && String(payload.roomId) !== getRoomId()) {
    return;
  }

  clearAllTrackedNotifications();
  stopLcdPingFlash();
  await syncStreamDeckButtons();
}

async function handleNotificationActivated(payload) {
  if (payload?.roomId && String(payload.roomId) !== getRoomId()) {
    return;
  }

  const activatedButtonIndex = resolveTrackedButtonIndex(payload);

  if (!Number.isFinite(activatedButtonIndex)) {
    return;
  }

  activeNotificationsByButton.set(Number(activatedButtonIndex), {
    notificationId: String(payload?.notificationId || "").trim(),
    actionId: String(payload?.actionType || "").trim(),
    sequence: trackedNotificationSequence + 1,
  });
  trackedNotificationSequence += 1;
  pendingAcknowledgementButtons.add(Number(activatedButtonIndex));
  await syncStreamDeckButtons();
}

async function sendNotification(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "notification",
        payload,
      }),
    );
    return;
  }

  await postJson(`${getServerUrl()}/notify`, payload);
}

async function sendNotificationCancellation(notificationId) {
  const payload = {
    notificationId,
    deviceId: getDeviceId(),
    roomId: getRoomId(),
    source: "client-streamdeck",
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "notification:cancel",
        ...payload,
      }),
    );
    return;
  }

  await postJson(`${getServerUrl()}/cancel-notification`, payload);
}

async function cancelActiveNotification(buttonIndex) {
  const trackedNotification = activeNotificationsByButton.get(Number(buttonIndex));

  if (!trackedNotification?.notificationId) {
    return;
  }

  await sendNotificationCancellation(trackedNotification.notificationId);
  clearTrackedButtonState(buttonIndex);
  await syncStreamDeckButtons();
  stopLcdPingFlash();
  console.log(
    `[client] cancelled notification from button ${buttonIndex}: ${trackedNotification.notificationId}`,
  );
}

function resolveDisplayedRoomAlert() {
  let selectedEntry = null;

  for (const [buttonIndex, trackedNotification] of activeNotificationsByButton.entries()) {
    if (!trackedNotification?.notificationId) {
      continue;
    }

    if (
      !selectedEntry ||
      Number(trackedNotification.sequence ?? Number.MAX_SAFE_INTEGER)
        < Number(selectedEntry.trackedNotification.sequence ?? Number.MAX_SAFE_INTEGER)
    ) {
      selectedEntry = {
        buttonIndex,
        trackedNotification,
      };
    }
  }

  return selectedEntry;
}

async function cancelDisplayedRoomAlert(sourceLabel = "auxiliary") {
  const displayedAlert = resolveDisplayedRoomAlert();

  if (!displayedAlert?.trackedNotification?.notificationId) {
    return;
  }

  await sendNotificationCancellation(displayedAlert.trackedNotification.notificationId);
  clearTrackedButtonState(displayedAlert.buttonIndex);
  await syncStreamDeckButtons();
  stopLcdPingFlash();
  console.log(
    `[client] cancelled displayed room alert from ${sourceLabel}: ${displayedAlert.trackedNotification.notificationId}`,
  );
}

function clearTrackedButtonState(buttonIndex) {
  pendingAcknowledgementButtons.delete(Number(buttonIndex));
  activeNotificationsByButton.delete(Number(buttonIndex));
}

function clearAllTrackedNotifications() {
  pendingAcknowledgementButtons.clear();
  activeNotificationsByButton.clear();
  trackedNotificationSequence = 0;
}

function resolveTrackedButtonIndex(payload) {
  const explicitButtonIndex = Number(payload?.deviceButton);

  if (Number.isFinite(explicitButtonIndex)) {
    return explicitButtonIndex;
  }

  const notificationId = String(payload?.notificationId || "").trim();

  if (notificationId) {
    for (const [buttonIndex, trackedNotification] of activeNotificationsByButton.entries()) {
      if (trackedNotification?.notificationId === notificationId) {
        return buttonIndex;
      }
    }
  }

  const trackedActionId = String(payload?.actionType || "").trim();

  if (!trackedActionId) {
    return null;
  }

  for (const [buttonIndex, trackedNotification] of activeNotificationsByButton.entries()) {
    if (trackedNotification?.actionId === trackedActionId) {
      return buttonIndex;
    }
  }

  if (!configState) {
    return null;
  }

  const action = resolveRoomNotifications().find(
    (item) => String(item.id || "").trim() === trackedActionId,
  );

  if (!action) {
    return null;
  }

  const mappedButtonIndex = Number(action.deviceButton);
  return Number.isFinite(mappedButtonIndex) ? mappedButtonIndex : null;
}

function sendPingCleared() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "room:pingCleared",
        roomId: getRoomId(),
        deviceId: getDeviceId(),
      }),
    );
  }
}

function startConfigRefresh() {
  if (configRefreshTimer) {
    clearInterval(configRefreshTimer);
  }

  configRefreshTimer = setInterval(async () => {
    try {
      configState = await fetchConfig();
      if (partyModeActive && !isLeftAuxPartyModeEnabled()) {
        await stopPartyMode();
      }
      await syncStreamDeckButtons();
      await renderLcdClockIfIdle();
    } catch (error) {
      console.error("[client] config refresh failed", error.message);
    }
  }, CONFIG_REFRESH_MS);
}

function scheduleStreamDeckReconnect() {
  if (!serviceRunning) {
    return;
  }

  if (streamDeckReconnectTimer) {
    return;
  }

  streamDeckReconnectTimer = setTimeout(async () => {
    streamDeckReconnectTimer = null;

    try {
      await closeStreamDeck();
      await connectStreamDeck();
    } catch (error) {
      logClient("error", "stream deck reconnect failed", error);
      scheduleStreamDeckReconnect();
    }
  }, 3000);
}

async function closeStreamDeck() {
  if (!streamDeck) {
    return;
  }

  const currentDeck = streamDeck;
  streamDeck = null;
  streamDeckInfo = null;

  try {
    stopLcdPingFlash();
    stopLcdClockUpdates();
    await currentDeck.close();
    setHardwareStatus("waiting", "Stream Deck disconnected");
  } catch {
    // Ignore close failures during reconnect/shutdown.
  }
}

async function shutdownService({ exitProcess = false } = {}) {
  serviceRunning = false;

  if (configRefreshTimer) {
    clearInterval(configRefreshTimer);
    configRefreshTimer = null;
  }

  stopLcdPingFlash();
  stopPartyModeTimer();
  stopLucyModeTimer();
  stopLcdClockUpdates();

  if (socketReconnectTimer) {
    clearTimeout(socketReconnectTimer);
    socketReconnectTimer = null;
  }

  if (streamDeckReconnectTimer) {
    clearTimeout(streamDeckReconnectTimer);
    streamDeckReconnectTimer = null;
  }

  if (serverRetryTimer) {
    clearTimeout(serverRetryTimer);
    serverRetryTimer = null;
  }

  if (socket) {
    socket.removeAllListeners();
    closeSocketSafely(socket);
    socket = null;
  }

  await closeStreamDeck();
  await closeNeoCanvasWindow();
  clearAllTrackedNotifications();
  configState = null;
  setHardwareStatus("stopped", "Stream Deck service stopped");

  if (exitProcess) {
    process.exit(0);
  }
}

function bindShutdownHandlers() {
  if (shutdownHandlersBound) {
    return;
  }

  const shutdown = async () => {
    await shutdownService({ exitProcess: true });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  shutdownHandlersBound = true;
}

function parseHexColor(hex) {
  const normalized = String(hex || "")
    .trim()
    .replace(/^#/, "");

  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return [31, 41, 55];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function parseNeoIconLines(icon) {
  return String(icon || "")
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function mixHexColors(primaryHex, secondaryHex, secondaryWeight = 0.5) {
  const [r1, g1, b1] = parseHexColor(primaryHex);
  const [r2, g2, b2] = parseHexColor(secondaryHex);
  const weight = Math.max(0, Math.min(1, Number(secondaryWeight)));
  const primaryWeight = 1 - weight;
  const toHex = (value) =>
    Math.round(value)
      .toString(16)
      .padStart(2, "0");

  const red = r1 * primaryWeight + r2 * weight;
  const green = g1 * primaryWeight + g2 * weight;
  const blue = b1 * primaryWeight + b2 * weight;

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function isLeftAuxPartyModeEnabled() {
  const leftAuxSetting = getCurrentLeftAuxSetting();
  return leftAuxSetting.enabled && leftAuxSetting.mode === "party";
}

function isLeftAuxCancelAlertEnabled() {
  const leftAuxSetting = getCurrentLeftAuxSetting();
  return leftAuxSetting.enabled && leftAuxSetting.mode === "cancel";
}

function getCurrentLeftAuxSetting() {
  const legacyFallback = normalizeLeftAuxSetting(configState?.hardware?.leftAuxButton, {
    enabled: DEFAULT_LEFT_AUX_SETTING.enabled,
    mode: DEFAULT_LEFT_AUX_SETTING.mode,
  });
  const roomOverride = runtimeSettings.roomLeftAuxSettings?.[getRoomId()];

  return normalizeLeftAuxSetting(roomOverride, legacyFallback);
}

function getCurrentRightAuxSetting() {
  const legacyFallback = normalizeRightAuxSetting(configState?.hardware?.rightAuxButton, {
    enabled: DEFAULT_RIGHT_AUX_SETTING.enabled,
    action: DEFAULT_RIGHT_AUX_SETTING.action,
  });
  const roomOverride = runtimeSettings.roomRightAuxSettings?.[getRoomId()];

  return normalizeRightAuxSetting(roomOverride, legacyFallback);
}

function isRightAuxLucyEnabled() {
  const rightAuxSetting = getCurrentRightAuxSetting();
  return rightAuxSetting.enabled && rightAuxSetting.action === "lucy";
}

function isRightAuxCancelAlertEnabled() {
  const rightAuxSetting = getCurrentRightAuxSetting();
  return rightAuxSetting.enabled && rightAuxSetting.action === "cancel";
}

async function toggleLeftAuxMode() {
  if (isLeftAuxCancelAlertEnabled()) {
    await cancelDisplayedRoomAlert("left auxiliary");
    return;
  }

  if (!isLeftAuxPartyModeEnabled()) {
    return;
  }

  if (partyModeActive) {
    await stopPartyMode();
    return;
  }

  await startPartyMode();
}

async function toggleRightAuxMode() {
  if (isRightAuxCancelAlertEnabled()) {
    await cancelDisplayedRoomAlert("right auxiliary");
    return;
  }

  if (!isRightAuxLucyEnabled()) {
    return;
  }

  if (lucyModeActive) {
    await stopLucyMode();
    return;
  }

  await startLucyMode();
}

function resetPartyModeState() {
  partyModeActive = false;
  partyModeFrame = 0;
  stopPartyModeTimer();
}

function resetLucyModeState() {
  lucyModeActive = false;
  lucyRevealStep = 0;
  lucyHeartsVisible = false;
  stopLucyModeTimer();
}

async function startPartyMode() {
  if (!streamDeck || partyModeActive) {
    return;
  }

  if (lucyModeActive) {
    resetLucyModeState();
  }

  partyModeActive = true;
  partyModeFrame = 0;
  stopLcdPingFlash();
  await renderPartyModeFrame();
  await renderLcdPartyFrame();
  stopPartyModeTimer();
  partyModeTimer = setInterval(() => {
    Promise.all([renderPartyModeFrame(), renderLcdPartyFrame()]).catch((error) => {
      console.error("[client] party mode render failed", error.message);
    });
  }, PARTY_MODE_INTERVAL_MS);
}

async function stopPartyMode() {
  if (!partyModeActive) {
    return;
  }

  resetPartyModeState();
  await syncStreamDeckButtons();
  await renderLcdClockIfIdle();
}

function stopPartyModeTimer() {
  if (partyModeTimer) {
    clearInterval(partyModeTimer);
    partyModeTimer = null;
  }
}

async function startLucyMode() {
  if (!streamDeck || lucyModeActive || !isRightAuxLucyEnabled()) {
    return;
  }

  if (partyModeActive) {
    resetPartyModeState();
    await renderLcdClockIfIdle();
  }

  lucyModeActive = true;
  lucyRevealStep = 0;
  lucyHeartsVisible = false;
  await renderLucyModeFrame();
  stopLucyModeTimer();
  lucyModeTimer = setInterval(() => {
    advanceLucyModeFrame().catch((error) => {
      console.error("[client] lucy mode render failed", error.message);
    });
  }, LUCY_MODE_INTERVAL_MS);
}

async function stopLucyMode() {
  if (!lucyModeActive) {
    return;
  }

  resetLucyModeState();
  await syncStreamDeckButtons();
}

function stopLucyModeTimer() {
  if (lucyModeTimer) {
    clearInterval(lucyModeTimer);
    lucyModeTimer = null;
  }
}

async function advanceLucyModeFrame() {
  if (!streamDeck || !lucyModeActive) {
    return;
  }

  if (lucyRevealStep < 5) {
    lucyRevealStep += 1;
    lucyHeartsVisible = lucyRevealStep >= 5;
  } else {
    lucyHeartsVisible = !lucyHeartsVisible;
  }

  await renderLucyModeFrame();
}

function getLucyButtonState(buttonIndex) {
  const normalizedIndex = Number(buttonIndex);
  const revealCount = Math.max(0, Math.min(lucyRevealStep, LUCY_TOP_ROW_LABELS.length));
  const topRowLetter =
    normalizedIndex >= 0 && normalizedIndex < LUCY_TOP_ROW_LABELS.length
      ? normalizedIndex < revealCount
        ? LUCY_TOP_ROW_LABELS[normalizedIndex]
        : ""
      : "";
  const heartVisible =
    normalizedIndex >= 4 && normalizedIndex < 8 && lucyRevealStep >= 5 && lucyHeartsVisible;

  return {
    letter: topRowLetter,
    heartVisible,
  };
}

async function renderLucyModeFrame() {
  if (!streamDeck || !lucyModeActive) {
    return;
  }

  const mainButtons = streamDeck.CONTROLS.filter(
    (control) =>
      control.type === "button" &&
      control.index !== NEO_LEFT_AUX_BUTTON_INDEX &&
      control.index !== NEO_RIGHT_AUX_BUTTON_INDEX,
  );

  for (const control of mainButtons) {
    const lucyState = getLucyButtonState(control.index);

    if (control.feedbackType !== "lcd") {
      const [r, g, b] = parseHexColor("#050607");
      await streamDeck.fillKeyColor(control.index, r, g, b);
      continue;
    }

    const imageBuffer = await renderLucyButtonImage(lucyState);
    await streamDeck.fillKeyBuffer(control.index, imageBuffer, {
      format: "rgba",
    });
  }
}

async function renderPartyModeFrame() {
  if (!streamDeck || !partyModeActive) {
    return;
  }

  const mainButtons = streamDeck.CONTROLS.filter(
    (control) =>
      control.type === "button" &&
      control.index !== NEO_LEFT_AUX_BUTTON_INDEX &&
      control.index !== NEO_RIGHT_AUX_BUTTON_INDEX,
  );
  const palette = buildPartyPalette(partyModeFrame);
  partyModeFrame += 1;

  for (const control of mainButtons) {
    const imageBuffer = await renderPartyButtonImage(palette[control.index % palette.length]);
    await streamDeck.fillKeyBuffer(control.index, imageBuffer, {
      format: "rgba",
    });
  }
}

function buildPartyPalette(frame) {
  const baseHue = (frame * 18) % 360;
  return Array.from({ length: 8 }, (_item, index) => {
    const hue = (baseHue + index * 32 + (index % 2 === 0 ? 0 : 14)) % 360;
    const saturation = 92;
    const lightness = 54 + ((frame + index) % 3) * 6;
    return hslToHex(hue, saturation, lightness);
  });
}

function hslToHex(h, s, l) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const match = lightness - chroma / 2;
  const toHex = (value) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

async function renderNeoButtonImage(action, buttonIndex) {
  const canvasBuffer = await renderNeoButtonCanvasImage(action, buttonIndex);

  if (canvasBuffer) {
    activeRenderer = "electron-canvas";
    return canvasBuffer;
  }

  const width = 96;
  const height = 96;
  const isMapped = Boolean(action);
  const isAwaitingAcknowledgement = pendingAcknowledgementButtons.has(Number(buttonIndex));
  const icon = action?.icon || "";
  const iconMarkup = buildNeoIconMarkup(icon);
  const buttonAppearance = getNeoButtonAppearance();
  const backgroundColor = isAwaitingAcknowledgement
    ? buttonAppearance.activeBackground
    : isMapped
      ? buttonAppearance.defaultBackground
      : "#08090b";
  const textColor = isAwaitingAcknowledgement
    ? buttonAppearance.activeText
    : isMapped
      ? buttonAppearance.defaultText
      : "#f8fafc";

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="${backgroundColor}" />
      ${iconMarkup.replaceAll("__TEXT_COLOR__", textColor)}
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

async function renderLucyButtonImage(lucyState) {
  const canvasBuffer = await renderNeoCanvasImage({
    kind: "lucy-button",
    width: 96,
    height: 96,
    accentColor: LUCY_MODE_ACCENT_HEX,
    letter: lucyState.letter,
    heartVisible: lucyState.heartVisible,
  });

  if (canvasBuffer) {
    activeRenderer = "electron-canvas";
    return canvasBuffer;
  }

  const width = 96;
  const height = 96;
  const letter = String(lucyState?.letter || "").trim().slice(0, 1);
  const heartMarkup = lucyState?.heartVisible
    ? `<path d="M48 76 C28 61 18 50 18 35 C18 24 26 16 37 16 C44 16 49 20 52 27 C55 20 60 16 67 16 C78 16 86 24 86 35 C86 50 68 61 48 76 Z" fill="${LUCY_MODE_ACCENT_HEX}" />`
    : "";
  const letterMarkup = letter
    ? `<text x="48" y="52" text-anchor="middle" dominant-baseline="middle" fill="${LUCY_MODE_ACCENT_HEX}" font-family="'Segoe UI', 'Avenir Next', Arial, sans-serif" font-size="50" font-weight="800">${escapeXml(letter)}</text>`
    : "";
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#050607" />
      ${heartMarkup || letterMarkup}
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

async function renderNeoButtonCanvasImage(action, buttonIndex) {
  const isMapped = Boolean(action);
  const isAwaitingAcknowledgement = pendingAcknowledgementButtons.has(Number(buttonIndex));
  const buttonAppearance = getNeoButtonAppearance();

  return renderNeoCanvasImage({
    kind: "button",
    width: 96,
    height: 96,
    backgroundColor: isAwaitingAcknowledgement
      ? buttonAppearance.activeBackground
      : isMapped
        ? buttonAppearance.defaultBackground
        : "#08090b",
    textColor: isAwaitingAcknowledgement
      ? buttonAppearance.activeText
      : isMapped
        ? buttonAppearance.defaultText
        : "#f8fafc",
    lines: parseNeoIconLines(isMapped ? action?.icon || "" : String(Number(buttonIndex) + 1)),
  });
}

function renderNeoButtonFallbackImage(action, buttonIndex) {
  const width = 96;
  const height = 96;
  const isMapped = Boolean(action);
  const isAwaitingAcknowledgement = pendingAcknowledgementButtons.has(Number(buttonIndex));
  const buttonAppearance = getNeoButtonAppearance();
  const backgroundColor = isAwaitingAcknowledgement
    ? buttonAppearance.activeBackground
    : isMapped
      ? buttonAppearance.defaultBackground
      : "#08090b";
  const textHex = isAwaitingAcknowledgement
    ? buttonAppearance.activeText
    : isMapped
      ? buttonAppearance.defaultText
      : "#f8fafc";
  const fallbackLabel = isMapped
    ? action?.icon || ""
    : String(Number(buttonIndex) + 1);
  const imageBuffer = createVerticalGradientBuffer({
    width,
    height,
    startHex: backgroundColor,
    endHex: backgroundColor,
  });

  drawBitmapTextLines(imageBuffer, width, height, parseNeoIconLines(fallbackLabel), textHex);
  return imageBuffer;
}

async function renderPartyButtonImage(color) {
  const width = 96;
  const height = 96;
  const [r, g, b] = parseHexColor(color);
  const centerGlow = `rgba(${r}, ${g}, ${b}, 0.98)`;
  const midGlow = `rgba(${r}, ${g}, ${b}, 0.64)`;
  const outerGlow = `rgba(${r}, ${g}, ${b}, 0.18)`;
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="partyGlow" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stop-color="${centerGlow}" />
          <stop offset="46%" stop-color="${midGlow}" />
          <stop offset="100%" stop-color="${outerGlow}" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#050607" />
      <circle cx="${width / 2}" cy="${height / 2}" r="37" fill="url(#partyGlow)" />
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

function buildNeoIconMarkup(icon) {
  const iconLines = parseNeoIconLines(icon);

  if (iconLines.length === 0) {
    return "";
  }

  const longestLineLength = Math.max(...iconLines.map((line) => line.length));

  if (iconLines.length === 1) {
    const safeLine = escapeXml(iconLines[0]);
    const fontSize =
      longestLineLength <= 2 ? 42 : longestLineLength <= 4 ? 30 : longestLineLength <= 8 ? 22 : 16;

    return `
      <text
        x="48"
        y="47"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Avenir Next, Segoe UI, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="__TEXT_COLOR__"
      >${safeLine}</text>
    `;
  }

  const fontSize =
    longestLineLength <= 4 ? 20 : longestLineLength <= 7 ? 16 : 13;
  const safeLines = iconLines.map((line) => escapeXml(line));

  return `
    <text
      x="48"
      y="34"
      text-anchor="middle"
      font-family="Avenir Next, Segoe UI, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="700"
      fill="__TEXT_COLOR__"
    >
      <tspan x="48" dy="0">${safeLines[0]}</tspan>
      <tspan x="48" dy="${fontSize + 6}">${safeLines[1]}</tspan>
    </text>
  `;
}

function drawBitmapTextLines(buffer, width, height, lines, colorHex) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return;
  }

  const normalizedLines = lines
    .map((line) => String(line || "").trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 2);

  if (normalizedLines.length === 0) {
    return;
  }

  const maxColumns = Math.max(...normalizedLines.map(getBitmapTextColumns));
  const availableWidth = width - 16;
  const availableHeight = normalizedLines.length === 1 ? 54 : 46;
  const lineGapUnits = normalizedLines.length === 1 ? 0 : 2;
  const verticalUnits = normalizedLines.length * 7 + (normalizedLines.length - 1) * lineGapUnits;
  const scale = Math.max(
    1,
    Math.min(
      6,
      Math.floor(availableWidth / Math.max(maxColumns, 1)),
      Math.floor(availableHeight / Math.max(verticalUnits, 1)),
    ),
  );
  const totalHeight = verticalUnits * scale;
  let currentY = Math.round((height - totalHeight) / 2) + (normalizedLines.length === 1 ? 3 : 6);

  for (const line of normalizedLines) {
    const lineWidth = getBitmapTextColumns(line) * scale;
    const startX = Math.round((width - lineWidth) / 2);
    drawBitmapText(buffer, width, height, line, startX, currentY, scale, colorHex);
    currentY += (7 + lineGapUnits) * scale;
  }
}

function getBitmapTextColumns(text) {
  return text
    .split("")
    .reduce((total, character, index) => {
      const glyph = BITMAP_FONT_5X7[character] || BITMAP_FONT_5X7[" "];
      const glyphWidth = glyph[0]?.length || 3;
      return total + glyphWidth + (index < text.length - 1 ? 1 : 0);
    }, 0);
}

function drawBitmapText(buffer, width, height, text, originX, originY, scale, colorHex) {
  const [red, green, blue] = parseHexColor(colorHex);
  let cursorX = originX;

  for (const character of text) {
    const glyph = BITMAP_FONT_5X7[character] || BITMAP_FONT_5X7[" "];
    const glyphWidth = glyph[0]?.length || 3;

    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") {
          continue;
        }

        fillBitmapRect(
          buffer,
          width,
          height,
          cursorX + column * scale,
          originY + row * scale,
          scale,
          scale,
          red,
          green,
          blue,
        );
      }
    }

    cursorX += (glyphWidth + 1) * scale;
  }
}

function fillBitmapRect(buffer, width, height, startX, startY, rectWidth, rectHeight, red, green, blue) {
  for (let y = 0; y < rectHeight; y += 1) {
    const pixelY = startY + y;

    if (pixelY < 0 || pixelY >= height) {
      continue;
    }

    for (let x = 0; x < rectWidth; x += 1) {
      const pixelX = startX + x;

      if (pixelX < 0 || pixelX >= width) {
        continue;
      }

      const offset = (pixelY * width + pixelX) * 4;
      buffer[offset] = red;
      buffer[offset + 1] = green;
      buffer[offset + 2] = blue;
      buffer[offset + 3] = 255;
    }
  }
}

function startLcdClockUpdates() {
  if (lcdClockTimer) {
    clearInterval(lcdClockTimer);
  }

  lcdClockTimer = setInterval(() => {
    renderLcdClockIfIdle().catch((error) => {
      console.error("[client] lcd clock refresh failed", error.message);
    });
  }, LCD_CLOCK_REFRESH_MS);
}

function stopLcdClockUpdates() {
  if (lcdClockTimer) {
    clearInterval(lcdClockTimer);
    lcdClockTimer = null;
  }
}

function startLcdPingFlash(hexColor) {
  lcdFlashHex = hexColor;
  lcdFlashVisible = true;

  if (lcdFlashTimer) {
    clearInterval(lcdFlashTimer);
    lcdFlashTimer = null;
  }

  renderLcdFlashFrame(true).catch((error) => {
    console.error("[client] lcd ping flash failed", error.message);
  });

  lcdFlashTimer = setInterval(() => {
    lcdFlashVisible = !lcdFlashVisible;
    renderLcdFlashFrame(lcdFlashVisible).catch((error) => {
      console.error("[client] lcd ping flash failed", error.message);
    });
  }, LCD_FLASH_INTERVAL_MS);
}

function stopLcdPingFlash() {
  lcdFlashHex = null;
  lcdFlashVisible = false;

  if (lcdFlashTimer) {
    clearInterval(lcdFlashTimer);
    lcdFlashTimer = null;
  }

  renderLcdClockIfIdle().catch((error) => {
    console.error("[client] lcd clock restore failed", error.message);
  });
}

async function renderLcdClockIfIdle() {
  if (lcdFlashHex) {
    return;
  }

  if (partyModeActive) {
    await renderLcdPartyFrame();
    return;
  }

  await renderLcdClock();
}

async function renderLcdClock() {
  if (!streamDeck) {
    return;
  }

  const lcdControl = streamDeck.CONTROLS.find((control) => control.type === "lcd-segment");

  if (!lcdControl) {
    return;
  }

  let imageBuffer;

  try {
    imageBuffer = await renderNeoLcdClockImage();
  } catch (error) {
    logClient("error", "lcd clock render failed", error);
    imageBuffer = renderNeoLcdFallbackClockImage();
    setHardwareStatus("connected", "Stream Deck connected using fallback LCD artwork");
  }

  await streamDeck.fillLcd(lcdControl.id, imageBuffer, {
    format: "rgba",
  });
}

async function renderLcdFlashFrame(isVisible) {
  if (!streamDeck) {
    return;
  }

  const lcdControl = streamDeck.CONTROLS.find((control) => control.type === "lcd-segment");

  if (!lcdControl) {
    return;
  }

  let imageBuffer;

  try {
    imageBuffer = isVisible
      ? await renderNeoLcdFlashImage(lcdFlashHex || "#16a34a")
      : await renderNeoLcdBlankImage();
  } catch (error) {
    logClient("error", "lcd flash render failed", error);
    imageBuffer = isVisible
      ? renderNeoLcdFallbackImage(lcdFlashHex || "#16a34a")
      : renderNeoLcdFallbackImage("#050608");
  }

  await streamDeck.fillLcd(lcdControl.id, imageBuffer, {
    format: "rgba",
  });
}

async function renderNeoLcdClockImage() {
  const canvasBuffer = await renderNeoCanvasImage({
    kind: "lcd-clock",
    width: 248,
    height: 58,
    day: new Date().toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase(),
    date: new Date().toLocaleDateString("en-GB"),
    time: new Date().toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  });

  if (canvasBuffer) {
    activeRenderer = "electron-canvas";
    return canvasBuffer;
  }

  const width = 248;
  const height = 58;
  const now = new Date();
  const day = now.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const [timeText, meridiem = ""] = time.split(" ");

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#050608" />
      <text x="14" y="22" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#f8fafc">${escapeXml(day)}</text>
      <text x="14" y="40" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-size="10" font-weight="600" fill="#d1d5db">${escapeXml(date)}</text>
      <text x="146" y="40" text-anchor="middle" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-size="31" font-weight="700" fill="#ffffff">${escapeXml(timeText)}</text>
      <text x="208" y="40" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-size="12" font-weight="800" fill="#ef4444">${escapeXml(meridiem)}</text>
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

async function renderNeoLcdFlashImage(hexColor) {
  const canvasBuffer = await renderNeoCanvasImage({
    kind: "lcd-flash",
    width: 248,
    height: 58,
    accentHex: hexColor || "#0f766e",
    label: "RECEPTION",
  });

  if (canvasBuffer) {
    activeRenderer = "electron-canvas";
    return canvasBuffer;
  }

  const width = 248;
  const height = 58;
  const accent = hexColor || "#0f766e";

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="${accent}" />
      <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="8" fill="#07110f" opacity="0.18" />
      <text x="124" y="29" text-anchor="middle" dominant-baseline="middle" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#ffffff">RECEPTION</text>
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

async function renderLcdPartyFrame() {
  if (!streamDeck || !partyModeActive) {
    return;
  }

  const lcdControl = streamDeck.CONTROLS.find((control) => control.type === "lcd-segment");

  if (!lcdControl) {
    return;
  }

  let imageBuffer;

  try {
    imageBuffer = await renderNeoLcdPartyImage();
  } catch (error) {
    logClient("error", "lcd party render failed", error);
    imageBuffer = renderNeoLcdFallbackImage(buildPartyPalette(partyModeFrame + 2)[0] || "#2563eb");
  }

  await streamDeck.fillLcd(lcdControl.id, imageBuffer, {
    format: "rgba",
  });
}

async function renderNeoLcdPartyImage() {
  const width = 248;
  const height = 58;
  const colors = buildPartyPalette(partyModeFrame + 2);
  const headline = PARTY_LCD_HEADLINE;
  const flashVisible =
    Math.floor((partyModeFrame + 2) / PARTY_LCD_FLASH_FRAME_WINDOW) % 2 === 0;
  const canvasBuffer = await renderNeoCanvasImage({
    kind: "lcd-party",
    width,
    height,
    colors,
    headline,
    flashVisible,
  });

  if (canvasBuffer) {
    activeRenderer = "electron-canvas";
    return canvasBuffer;
  }

  const headlineWidth = 170;
  const startX = (width - headlineWidth) / 2;
  const letterSpacing = headlineWidth / Math.max(headline.length - 1, 1);
  const textMarkup = flashVisible
    ? headline
      .split("")
      .map((character, index) => {
        const fill = character === " " ? "#ffffff" : colors[index % colors.length];
        const x = startX + index * letterSpacing;
        return `<tspan x="${x.toFixed(1)}" y="37" fill="${fill}">${escapeXml(character)}</tspan>`;
      })
      .join("")
    : "";

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#050608" />
      <text text-anchor="start" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-size="18" font-weight="800">
        ${textMarkup}
      </text>
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

async function renderNeoLcdBlankImage() {
  const width = 248;
  const height = 58;

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#050608" />
    </svg>
  `;

  return renderSvgToRawBuffer(svg, width, height);
}

function renderNeoLcdFallbackImage(backgroundHex) {
  return createVerticalGradientBuffer({
    width: 248,
    height: 58,
    startHex: backgroundHex,
    endHex: mixHexColors(backgroundHex, "#050608", 0.16),
  });
}

function renderNeoLcdFallbackClockImage() {
  const width = 248;
  const height = 58;
  const now = new Date();
  const day = now.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();
  const imageBuffer = renderNeoLcdFallbackImage("#050608");

  drawBitmapText(imageBuffer, width, height, day, 12, 10, 2, "#f8fafc");
  drawBitmapText(imageBuffer, width, height, date, 12, 28, 2, "#d1d5db");
  drawBitmapText(
    imageBuffer,
    width,
    height,
    time,
    width - getBitmapTextColumns(time) * 3 - 16,
    17,
    3,
    "#ffffff",
  );

  return imageBuffer;
}

function getNeoButtonAppearance() {
  const legacyFallback = normalizeButtonAppearance(configState?.hardware?.buttonAppearance, {
    defaultBackground: DEFAULT_BUTTON_BACKGROUND_HEX,
    defaultText: DEFAULT_BUTTON_TEXT_HEX,
    activeBackground: DEFAULT_ACTIVE_BUTTON_BACKGROUND_HEX,
    activeText: DEFAULT_ACTIVE_BUTTON_TEXT_HEX,
  });
  const roomOverride = runtimeSettings.roomButtonAppearances?.[getRoomId()];

  return normalizeButtonAppearance(roomOverride, legacyFallback);
}

async function renderNeoCanvasImage(payload) {
  const renderWindow = await ensureNeoCanvasWindow();
  const nativeImage = getElectronNativeImage();

  if (!renderWindow || !nativeImage) {
    return null;
  }

  const script = `
    (() => {
      const payload = ${JSON.stringify(payload)};
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: true });

      canvas.width = payload.width;
      canvas.height = payload.height;

      if (!ctx) {
        return null;
      }

      const parseHex = (hex) => {
        const normalized = String(hex || "").trim().replace(/^#/, "");
        const expanded = normalized.length === 3
          ? normalized.split("").map((char) => char + char).join("")
          : normalized.padEnd(6, "0").slice(0, 6);

        return [
          Number.parseInt(expanded.slice(0, 2), 16),
          Number.parseInt(expanded.slice(2, 4), 16),
          Number.parseInt(expanded.slice(4, 6), 16),
        ];
      };

      const mixHex = (primaryHex, secondaryHex, secondaryWeight = 0.5) => {
        const [r1, g1, b1] = parseHex(primaryHex);
        const [r2, g2, b2] = parseHex(secondaryHex);
        const primaryWeight = 1 - secondaryWeight;
        return "rgb(" + [
          Math.round(r1 * primaryWeight + r2 * secondaryWeight),
          Math.round(g1 * primaryWeight + g2 * secondaryWeight),
          Math.round(b1 * primaryWeight + b2 * secondaryWeight),
        ].join(",") + ")";
      };

      const roundRect = (x, y, width, height, radius) => {
        const safeRadius = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + safeRadius, y);
        ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
        ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
        ctx.arcTo(x, y + height, x, y, safeRadius);
        ctx.arcTo(x, y, x + width, y, safeRadius);
        ctx.closePath();
      };

      const createBackgroundFill = (background, width, height) => {
        const normalized = String(background || "").trim();
        const linearMatch = normalized.match(/^linear-gradient\\((\\d+)deg,\\s*(#[0-9a-fA-F]{6})\\s+(\\d+)%,\\s*(#[0-9a-fA-F]{6})\\s+(\\d+)%\\)$/);

        if (linearMatch) {
          const gradient = ctx.createLinearGradient(0, 0, width, height);
          gradient.addColorStop(Math.max(0, Math.min(1, Number(linearMatch[3]) / 100)), linearMatch[2]);
          gradient.addColorStop(Math.max(0, Math.min(1, Number(linearMatch[5]) / 100)), linearMatch[4]);
          return gradient;
        }

        const radialMatch = normalized.match(/^radial-gradient\\(circle\\s+at\\s+(\\d+)%\\s+(\\d+)%,\\s*(#[0-9a-fA-F]{6})\\s+(\\d+)%,\\s*(#[0-9a-fA-F]{6})\\s+(\\d+)%\\)$/);

        if (radialMatch) {
          const centerX = width * (Number(radialMatch[1]) / 100);
          const centerY = height * (Number(radialMatch[2]) / 100);
          const radius = Math.max(width, height) * 0.7;
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(Math.max(0, Math.min(1, Number(radialMatch[4]) / 100)), radialMatch[3]);
          gradient.addColorStop(Math.max(0, Math.min(1, Number(radialMatch[6]) / 100)), radialMatch[5]);
          return gradient;
        }

        return normalized || "#08090b";
      };

      const drawHeart = (centerX, centerY, size, fillStyle) => {
        const halfSize = size / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + halfSize * 0.82);
        ctx.bezierCurveTo(
          centerX + halfSize * 1.15,
          centerY + halfSize * 0.15,
          centerX + halfSize * 1.15,
          centerY - halfSize * 0.78,
          centerX,
          centerY - halfSize * 0.28,
        );
        ctx.bezierCurveTo(
          centerX - halfSize * 1.15,
          centerY - halfSize * 0.78,
          centerX - halfSize * 1.15,
          centerY + halfSize * 0.15,
          centerX,
          centerY + halfSize * 0.82,
        );
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
      };

      if (payload.kind === "button") {
        roundRect(0, 0, payload.width, payload.height, 18);
        ctx.fillStyle = createBackgroundFill(payload.backgroundColor, payload.width, payload.height);
        ctx.fill();

        const lines = Array.isArray(payload.lines) ? payload.lines.filter(Boolean).slice(0, 2) : [];

        if (lines.length === 1) {
          const line = String(lines[0]);
          const fontSize = line.length <= 2 ? 42 : line.length <= 4 ? 30 : line.length <= 8 ? 22 : 16;
          ctx.fillStyle = payload.textColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "700 " + fontSize + "px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
          ctx.fillText(line, payload.width / 2, payload.height / 2 - 1);
        } else if (lines.length > 1) {
          const longest = Math.max(...lines.map((line) => String(line).length));
          const fontSize = longest <= 4 ? 20 : longest <= 7 ? 16 : 13;
          ctx.fillStyle = payload.textColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "700 " + fontSize + "px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
          const firstY = 34;
          ctx.fillText(String(lines[0]), payload.width / 2, firstY);
          ctx.fillText(String(lines[1]), payload.width / 2, firstY + fontSize + 6);
        }
      } else if (payload.kind === "lucy-button") {
        roundRect(0, 0, payload.width, payload.height, 18);
        ctx.fillStyle = "#050607";
        ctx.fill();

        if (payload.heartVisible) {
          ctx.shadowColor = mixHex(payload.accentColor, "#ffffff", 0.24);
          ctx.shadowBlur = 14;
          drawHeart(payload.width / 2, payload.height / 2 + 2, 44, payload.accentColor);
          ctx.shadowBlur = 0;
        } else if (payload.letter) {
          ctx.fillStyle = payload.accentColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "800 50px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
          ctx.fillText(String(payload.letter).slice(0, 1), payload.width / 2, payload.height / 2 + 1);
        }
      } else if (payload.kind === "lcd-clock") {
        roundRect(0, 0, payload.width, payload.height, 10);
        ctx.fillStyle = "#050608";
        ctx.fill();
        const timeParts = String(payload.time || "").split(" ");
        const timeText = timeParts[0] || "";
        const meridiem = timeParts[1] || "";

        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillStyle = "#f8fafc";
        ctx.font = "700 10px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
        ctx.fillText(String(payload.day || ""), 14, 22);

        ctx.fillStyle = "#d1d5db";
        ctx.font = "600 10px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
        ctx.fillText(String(payload.date || ""), 14, 40);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 31px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
        ctx.fillText(timeText, 146, 40);

        ctx.textAlign = "left";
        ctx.fillStyle = "#ef4444";
        ctx.font = "800 12px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
        ctx.fillText(meridiem, 208, 40);
      } else if (payload.kind === "lcd-flash") {
        roundRect(0, 0, payload.width, payload.height, 10);
        ctx.fillStyle = payload.accentHex;
        ctx.fill();
        roundRect(4, 4, payload.width - 8, payload.height - 8, 8);
        ctx.fillStyle = "rgba(7, 17, 15, 0.18)";
        ctx.fill();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 22px 'Segoe UI', 'Avenir Next', Arial, sans-serif";
        ctx.fillText(String(payload.label || ""), payload.width / 2, payload.height / 2);
      } else if (payload.kind === "lcd-party") {
        const colors = Array.isArray(payload.colors) ? payload.colors.filter(Boolean) : [];
        const headline = String(payload.headline || "");
        const flashVisible = payload.flashVisible !== false;

        roundRect(0, 0, payload.width, payload.height, 10);
        ctx.fillStyle = "#050608";
        ctx.fill();

        if (flashVisible && colors.length > 0) {
          const stripeWidth = payload.width / colors.length;
          ctx.globalAlpha = 0.16;

          colors.forEach((color, index) => {
            ctx.fillStyle = color;
            ctx.fillRect(index * stripeWidth, 0, stripeWidth + 2, payload.height);
          });

          ctx.globalAlpha = 1;
          roundRect(4, 4, payload.width - 8, payload.height - 8, 8);
          ctx.fillStyle = "rgba(5, 6, 8, 0.86)";
          ctx.fill();

          const headlineWidth = 170;
          const startX = (payload.width - headlineWidth) / 2;
          const letterSpacing = headlineWidth / Math.max(headline.length - 1, 1);

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "800 18px 'Segoe UI', 'Avenir Next', Arial, sans-serif";

          headline.split("").forEach((character, index) => {
            if (character === " ") {
              return;
            }

            const color = colors[index % colors.length] || "#ffffff";
            const x = startX + index * letterSpacing;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fillText(character, x, payload.height / 2 + 6);
          });

          ctx.shadowBlur = 0;
        }
      } else {
        return null;
      }

      return canvas.toDataURL("image/png");
    })();
  `;

  const dataUrl = await renderWindow.webContents.executeJavaScript(script, true);

  if (!dataUrl) {
    return null;
  }

  let image = nativeImage.createFromDataURL(dataUrl);

  if (image.isEmpty()) {
    return null;
  }

  const imageSize = image.getSize();

  if (imageSize.width !== payload.width || imageSize.height !== payload.height) {
    image = image.resize({ width: payload.width, height: payload.height, quality: "best" });
  }

  const bitmapBuffer = image.toBitmap();
  const expectedLength = payload.width * payload.height * 4;

  if (bitmapBuffer.length !== expectedLength) {
    return null;
  }

  return convertBitmapBgraToRgba(bitmapBuffer);
}

async function ensureSvgRenderer() {
  if (!svgRendererInitPromise) {
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    svgRendererInitPromise = initWasm(readFile(wasmPath)).catch((error) => {
      svgRendererInitPromise = null;
      throw error;
    });
  }

  await svgRendererInitPromise;
}

function convertBitmapBgraToRgba(bitmapBuffer) {
  const rgbaBuffer = Buffer.allocUnsafe(bitmapBuffer.length);

  for (let offset = 0; offset < bitmapBuffer.length; offset += 4) {
    rgbaBuffer[offset] = bitmapBuffer[offset + 2];
    rgbaBuffer[offset + 1] = bitmapBuffer[offset + 1];
    rgbaBuffer[offset + 2] = bitmapBuffer[offset];
    rgbaBuffer[offset + 3] = bitmapBuffer[offset + 3];
  }

  return rgbaBuffer;
}

function renderSvgToRawBufferWithElectron(svg, width, height) {
  const nativeImage = getElectronNativeImage();

  if (!nativeImage) {
    return null;
  }

  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  let image = nativeImage.createFromDataURL(svgDataUrl);

  if (image.isEmpty()) {
    throw new Error("Electron nativeImage returned an empty SVG render");
  }

  const imageSize = image.getSize();

  if (imageSize.width !== width || imageSize.height !== height) {
    image = image.resize({ width, height, quality: "best" });
  }

  const bitmapBuffer = image.toBitmap();
  const expectedLength = width * height * 4;

  if (bitmapBuffer.length !== expectedLength) {
    throw new Error(
      `Electron bitmap render length mismatch: expected ${expectedLength}, got ${bitmapBuffer.length}`,
    );
  }

  activeRenderer = "electron-native";
  return convertBitmapBgraToRgba(bitmapBuffer);
}

function createVerticalGradientBuffer({
  width,
  height,
  startHex,
  endHex,
  accentHex = "",
  accentHeight = 0,
}) {
  const buffer = Buffer.alloc(width * height * 4);
  const [startR, startG, startB] = parseHexColor(startHex);
  const [endR, endG, endB] = parseHexColor(endHex);
  const [accentR, accentG, accentB] = accentHex ? parseHexColor(accentHex) : [0, 0, 0];

  for (let y = 0; y < height; y += 1) {
    const blend = height <= 1 ? 0 : y / (height - 1);
    const rowR = Math.round(startR + (endR - startR) * blend);
    const rowG = Math.round(startG + (endG - startG) * blend);
    const rowB = Math.round(startB + (endB - startB) * blend);

    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const useAccent = accentHeight > 0 && y < accentHeight;
      buffer[offset] = useAccent ? accentR : rowR;
      buffer[offset + 1] = useAccent ? accentG : rowG;
      buffer[offset + 2] = useAccent ? accentB : rowB;
      buffer[offset + 3] = 255;
    }
  }

  return buffer;
}

async function renderSvgToRawBuffer(svg, width, height) {
  try {
    await ensureSvgRenderer();
    const renderedImage = new Resvg(svg).render();
    activeRenderer = "resvg-wasm";
    return Buffer.from(renderedImage.pixels);
  } catch (error) {
    logClient("error", "resvg SVG renderer failed, falling back to electron", error);
  }

  const electronBuffer = renderSvgToRawBufferWithElectron(svg, width, height);

  if (!electronBuffer) {
    throw new Error("No SVG renderer was available for the Stream Deck artwork");
  }

  return electronBuffer;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;");
}

function resolveRoomName() {
  return resolveRoomConfig()?.name || "Surgery";
}

function resolveRoomConfig() {
  return configState?.rooms?.find((room) => room.id === getRoomId()) || null;
}

function resolveRoomNotifications(roomId = getRoomId()) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    return [];
  }

  if (Object.prototype.hasOwnProperty.call(runtimeSettings.roomActionSettings, normalizedRoomId)) {
    return normalizeRoomActionSettings({
      [normalizedRoomId]: runtimeSettings.roomActionSettings[normalizedRoomId],
    })[normalizedRoomId] || [];
  }

  const room = configState?.rooms?.find((item) => item.id === normalizedRoomId);

  if (!room) {
    return [];
  }

  const notificationsByButton = new Map();

  if (Array.isArray(room.notifications)) {
    room.notifications.forEach((notification, index) => {
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

  return [...notificationsByButton.values()].sort(
    (left, right) => left.deviceButton - right.deviceButton,
  );
}

function resolveRoomActionByButtonIndex(buttonIndex, roomId = getRoomId()) {
  return resolveRoomNotifications(roomId).find(
    (item) => Number(item.deviceButton) === Number(buttonIndex),
  ) || null;
}

function buildRoomNotificationPayload(room, action, overrides = {}) {
  if (!room?.id) {
    throw new Error("Unknown room");
  }

  if (!action?.id) {
    throw new Error(`Unknown room action for ${room.id}`);
  }

  return {
    type: "notification",
    roomId: room.id,
    roomName: room.name,
    roomShortName: room.shortName,
    actionType: action.id,
    message: action.message,
    roomColor: room.color,
    icon: room.icon || action.icon || "",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function playPingSound() {
  const platform = process.platform;
  const soundPath = resolveBundledSurgerySoundPath(DEFAULT_SURGERY_SOUND);
  const command =
    platform === "darwin"
      ? `afplay "${escapeDoubleQuotedPath(soundPath)}"`
      : platform === "win32"
        ? `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer '${escapePowerShellPath(soundPath)}').PlaySync()"`
        : "printf '\\a'";

  exec(command, (error) => {
    if (error) {
      process.stdout.write("\u0007");
    }
  });
}

function resolveBundledSurgerySoundPath(sound) {
  const soundFileName = SURGERY_SOUND_FILE_MAP[sound] || SURGERY_SOUND_FILE_MAP[DEFAULT_SURGERY_SOUND];
  const candidates = [
    path.join(process.resourcesPath || "", "app.asar.unpacked", "src", "assets", "sounds", soundFileName),
    path.join(__dirname, "assets", "sounds", soundFileName),
  ];

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  return candidates[candidates.length - 1];
}

function escapeDoubleQuotedPath(value) {
  return String(value || "").replace(/(["\\$`])/g, "\\$1");
}

function escapePowerShellPath(value) {
  return String(value || "").replace(/'/g, "''");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: buildAuthenticatedHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthenticatedHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function buildAuthenticatedHeaders() {
  const serverAccessKey = getServerAccessKey();

  return serverAccessKey
    ? {
        "x-pip-key": serverAccessKey,
      }
    : {};
}

function buildAuthenticatedWebSocketUrl(url) {
  const nextUrl = new URL(url);
  const serverAccessKey = getServerAccessKey();

  if (serverAccessKey) {
    nextUrl.searchParams.set("accessKey", serverAccessKey);
  } else {
    nextUrl.searchParams.delete("accessKey");
  }

  return nextUrl.toString();
}

export async function startClientHardwareService(options = {}) {
  if (serviceRunning) {
    await shutdownService();
  }

  runtimeCallbacks = {
    onLog: typeof options.onLog === "function" ? options.onLog : null,
    onStatus: typeof options.onStatus === "function" ? options.onStatus : null,
  };
  applyRuntimeSettings(options);
  serviceRunning = true;
  setHardwareStatus("starting", "Starting Stream Deck service");
  try {
    await main();
  } catch (error) {
    await shutdownService();
    throw error;
  }
  return {
    roomId: getRoomId(),
    deviceId: getDeviceId(),
    serverUrl: getServerUrl(),
    playPingAudio: runtimeSettings.playPingAudio,
  };
}

export async function stopClientHardwareService() {
  await shutdownService();
}

export function getClientHardwareStatus() {
  return hardwareStatus;
}

export async function updateClientHardwareServiceSettings(options = {}) {
  applyRuntimeSettings(options);

  if (partyModeActive && !isLeftAuxPartyModeEnabled()) {
    await stopPartyMode();
  }

  if (lucyModeActive && !isRightAuxLucyEnabled()) {
    await stopLucyMode();
  }

  if (!serviceRunning || !streamDeck) {
      return {
        roomId: getRoomId(),
        roomButtonAppearances: runtimeSettings.roomButtonAppearances,
        roomLeftAuxSettings: runtimeSettings.roomLeftAuxSettings,
        roomRightAuxSettings: runtimeSettings.roomRightAuxSettings,
        roomActionSettings: runtimeSettings.roomActionSettings,
      };
  }

  await syncStreamDeckButtons();

  return {
    roomId: getRoomId(),
    roomButtonAppearances: runtimeSettings.roomButtonAppearances,
    roomLeftAuxSettings: runtimeSettings.roomLeftAuxSettings,
    roomRightAuxSettings: runtimeSettings.roomRightAuxSettings,
    roomActionSettings: runtimeSettings.roomActionSettings,
  };
}

const isStandaloneEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isStandaloneEntryPoint) {
  bindShutdownHandlers();
  startClientHardwareService().catch((error) => {
    console.error("[client] fatal error", error);
    process.exitCode = 1;
  });
}
