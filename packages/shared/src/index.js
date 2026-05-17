import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export * from "./attachment-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const RUNTIME_ROLE_RECEPTION = "reception";
export const RUNTIME_ROLE_ROOM = "room";
export const RUNTIME_ROLE_OPTIONS = [
  RUNTIME_ROLE_RECEPTION,
  RUNTIME_ROLE_ROOM,
];
export const CONFIG_SCHEMA_VERSION = 2;

// Keep config-path resolution lazy so packaged surgery clients can import
// shared helpers without requiring a local writable config file.
export const DEFAULT_CONFIG_PATH = null;
const DEFAULT_BUTTON_APPEARANCE = {
  defaultBackground: "#FDD905",
  activeBackground: "#000000",
};
const ROOM_SHORT_NAME_MAX_LENGTH = 7;
const DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE = 5;
const DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];

export function normalizeRuntimeRole(
  runtimeRole,
  fallback = RUNTIME_ROLE_ROOM,
) {
  const normalizedRuntimeRole = String(runtimeRole || "")
    .trim()
    .toLowerCase();

  return RUNTIME_ROLE_OPTIONS.includes(normalizedRuntimeRole)
    ? normalizedRuntimeRole
    : fallback;
}

export function resolveConfigPath() {
  const envConfigPath = process.env.PIP_CONFIG_PATH;

  if (envConfigPath && fs.existsSync(envConfigPath)) {
    return envConfigPath;
  }

  const candidates = [
    path.resolve(process.resourcesPath || "", "config", "config.json"),
    path.resolve(process.cwd(), "config", "config.json"),
    path.resolve(process.cwd(), "..", "config", "config.json"),
    path.resolve(process.cwd(), "..", "..", "config", "config.json"),
    path.resolve(__dirname, "..", "..", "..", "config", "config.json"),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));

  if (!match) {
    throw new Error(
      `Unable to locate config.json. Checked: ${candidates.join(", ")}`,
    );
  }

  return match;
}

export function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const resolvedConfigPath = configPath || resolveConfigPath();
  const raw = fs.readFileSync(resolvedConfigPath, "utf8");
  return JSON.parse(raw);
}

export function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  const resolvedConfigPath = configPath || resolveConfigPath();
  const nextConfig = {
    ...normalizeConfig(config),
    lastUpdated: new Date().toISOString(),
  };
  const serializedConfig = JSON.stringify(nextConfig, null, 2);
  const configDirectory = path.dirname(resolvedConfigPath);
  const tempConfigPath = path.join(
    configDirectory,
    `${path.basename(resolvedConfigPath)}.${process.pid}.tmp`,
  );
  const backupConfigPath = `${resolvedConfigPath}.bak`;

  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(tempConfigPath, serializedConfig);

  if (fs.existsSync(resolvedConfigPath)) {
    fs.copyFileSync(resolvedConfigPath, backupConfigPath);
  }

  try {
    fs.renameSync(tempConfigPath, resolvedConfigPath);
  } catch {
    fs.copyFileSync(tempConfigPath, resolvedConfigPath);
    fs.unlinkSync(tempConfigPath);
  }

  return nextConfig;
}

export function buildNotificationPayload(config, roomId, actionId, overrides = {}) {
  const room = config.rooms.find((item) => item.id === roomId);
  const action = room?.notifications?.find((item) => item.id === actionId);

  if (!room) {
    throw new Error(`Unknown roomId: ${roomId}`);
  }

  if (!action) {
    throw new Error(`Unknown actionId: ${actionId}`);
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

export function parseJsonBody(req, options = {}) {
  const maxBytes = Math.max(1024, Number(options.maxBytes) || 32 * 1024);

  return new Promise((resolve, reject) => {
    let body = "";
    let bodyBytes = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) {
        return;
      }

      bodyBytes += Buffer.byteLength(chunk);

      if (bodyBytes > maxBytes) {
        const error = new Error(`Request body exceeds ${maxBytes} bytes`);
        error.code = "BODY_TOO_LARGE";
        settled = true;
        reject(error);
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      if (settled) {
        return;
      }

      if (!body) {
        settled = true;
        resolve({});
        return;
      }

      try {
        settled = true;
        resolve(JSON.parse(body));
      } catch (error) {
        settled = true;
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

export function formatTime(isoString) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(isoString));
}

export function normalizeConfig(config = {}) {
  const migratedConfig = migrateConfig(config || {});
  const normalizedActions = normalizeLegacyActions(migratedConfig.actions);
  const normalizedMappings = normalizeLegacyMappings(migratedConfig.buttonMappings);
  const fallbackNotifications = buildFallbackNotifications(normalizedActions, normalizedMappings);
  const normalizedRooms = Array.isArray(migratedConfig.rooms)
    ? migratedConfig.rooms.map((room, index) => ({
        id: String(room.id || `room-${index + 1}`).trim(),
        name: String(room.name || `Room ${index + 1}`).trim().slice(0, 10),
        shortName: normalizeRoomShortName(room.shortName, room.name, room.id, index),
        color: String(room.color || "#0f766e").trim(),
        icon: String(room.icon || "").trim(),
        hideFromAlertSection: Boolean(room.hideFromAlertSection),
        hideFromEntireUI: Boolean(room.hideFromEntireUI),
        receptionSound: normalizeReceptionSound(room.receptionSound),
        notifications: normalizeNotifications(
          Array.isArray(room.notifications) ? room.notifications : fallbackNotifications,
        ),
      }))
    : [];

  const legacyCompatibleNotifications =
    normalizedRooms[0]?.notifications?.length > 0
      ? normalizedRooms[0].notifications
      : fallbackNotifications;

  return {
    version: CONFIG_SCHEMA_VERSION,
    lastUpdated: migratedConfig.lastUpdated || new Date().toISOString(),
    network: {
      host: migratedConfig.network?.host || "0.0.0.0",
      port: Number(migratedConfig.network?.port) || 3210,
    },
    auth: {
      accessKey: normalizeAccessKey(migratedConfig.auth?.accessKey),
    },
    display: {
      alwaysOnTop:
        typeof migratedConfig.display?.alwaysOnTop === "boolean"
          ? migratedConfig.display.alwaysOnTop
          : true,
      autoHideMs: Math.max(0, Number(migratedConfig.display?.autoHideMs) || 0),
      compactMode: migratedConfig.display?.compactMode !== false,
      expanded: Boolean(migratedConfig.display?.expanded),
      messagesVisible: Boolean(migratedConfig.display?.messagesVisible),
      minimized: Boolean(migratedConfig.display?.minimized),
      adminMode: Boolean(migratedConfig.display?.adminMode),
      launchAtStartup:
        typeof migratedConfig.display?.launchAtStartup === "boolean"
          ? migratedConfig.display.launchAtStartup
          : true,
      messageRetentionMinutes: Math.max(1, Number(migratedConfig.display?.messageRetentionMinutes) || 60),
      popupPosition: normalizePopupPosition(migratedConfig.display?.popupPosition),
      receptionPingMessage: normalizeReceptionPingMessage(migratedConfig.display?.receptionPingMessage),
      windowPosition: normalizeWindowPosition(migratedConfig.display?.windowPosition),
    },
    hardware: {
      leftAuxButton: {
        enabled: migratedConfig.hardware?.leftAuxButton?.enabled !== false,
        mode:
          String(migratedConfig.hardware?.leftAuxButton?.mode || "party")
            .trim()
            .toLowerCase() || "party",
      },
      buttonAppearance: normalizeButtonAppearance(migratedConfig.hardware?.buttonAppearance),
    },
    audio: {
      masterVolume: clampVolume(migratedConfig.audio?.masterVolume),
      notificationSound: normalizeAudioNotificationSound(
        migratedConfig.audio?.notificationSound ?? migratedConfig.rooms?.[0]?.receptionSound?.sound,
      ),
      messageVolume: clampVolume(migratedConfig.audio?.messageVolume),
      messageSound: normalizeAudioNotificationSound(migratedConfig.audio?.messageSound),
    },
    features: {
      ...(migratedConfig.features || {}),
      attachments: {
        enabled: migratedConfig.features?.attachments?.enabled !== false,
      },
    },
    attachments: {
      ...(migratedConfig.attachments || {}),
      rootPath: String(migratedConfig.attachments?.rootPath || "").trim(),
      maxFileSizeBytes: Math.max(
        1,
        Number(migratedConfig.attachments?.maxFileSizeBytes) || DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES,
      ),
      maxFilesPerMessage: Math.max(
        1,
        Number(migratedConfig.attachments?.maxFilesPerMessage) || DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE,
      ),
      whitelistMimeTypes:
        Array.isArray(migratedConfig.attachments?.whitelistMimeTypes) && migratedConfig.attachments.whitelistMimeTypes.length > 0
          ? migratedConfig.attachments.whitelistMimeTypes.map((mime) => String(mime || "").trim().toLowerCase()).filter(Boolean)
          : DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES,
      cloud: {
        enabled: Boolean(migratedConfig.attachments?.cloud?.enabled),
        provider: String(migratedConfig.attachments?.cloud?.provider || "").trim(),
      },
    },
    updates: {
      ...(migratedConfig.updates || {}),
      manualDownloadUrl: String(
        migratedConfig.updates?.manualDownloadUrl ||
          migratedConfig.updates?.downloadUrl ||
          migratedConfig.updates?.url ||
          "",
      ).trim(),
    },
    rooms: normalizedRooms,
    actions: legacyCompatibleNotifications.map(stripNotificationToAction),
    buttonMappings: legacyCompatibleNotifications.map((notification, index) => ({
      deviceButton: Number.isFinite(Number(notification.deviceButton))
        ? Number(notification.deviceButton)
        : index,
      actionId: notification.id,
    })),
  };
}

export function migrateConfig(config = {}) {
  return {
    ...config,
    version: CONFIG_SCHEMA_VERSION,
    rooms: Array.isArray(config.rooms)
      ? config.rooms.map((room) => {
          const hideFromEntireUI = Boolean(
            room.hideFromEntireUI ?? room.hideRoomFromUI ?? room.hidden,
          );

          const nextRoom = {
            ...room,
            hideFromAlertSection: Boolean(room.hideFromAlertSection),
            hideFromEntireUI,
          };

          delete nextRoom.hideRoomFromUI;
          delete nextRoom.hidden;
          return nextRoom;
        })
      : [],
  };
}

function normalizeReceptionPingMessage(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return normalized || "Next Patient Waiting";
}

export function normalizeRoomShortName(value, roomName = "", roomId = "", index = 0) {
  const explicitValue = String(value || "").trim();

  if (explicitValue) {
    return explicitValue.slice(0, ROOM_SHORT_NAME_MAX_LENGTH);
  }

  return buildDefaultRoomShortName(roomName, roomId, index);
}

export function buildDefaultRoomShortName(roomName = "", roomId = "", index = 0) {
  const labelSource = `${roomName || ""} ${roomId || ""}`.trim();
  const surgeryMatch = labelSource.match(/surg(?:ery)?[\s-]*(\d+)/i);

  if (surgeryMatch?.[1]) {
    return `S${surgeryMatch[1]}`.slice(0, ROOM_SHORT_NAME_MAX_LENGTH);
  }

  const roomMatch = labelSource.match(/room[\s-]*(\d+)/i);

  if (roomMatch?.[1]) {
    return `R${roomMatch[1]}`.slice(0, ROOM_SHORT_NAME_MAX_LENGTH);
  }

  const words = String(roomName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words.map((word) => word[0]).join("").slice(0, ROOM_SHORT_NAME_MAX_LENGTH).toUpperCase();
  }

  if (words[0]) {
    return words[0].slice(0, 3);
  }

  return `R${index + 1}`;
}

function normalizeButtonAppearance(buttonAppearance) {
  return {
    defaultBackground: normalizeCssBackground(
      buttonAppearance?.defaultBackground,
      DEFAULT_BUTTON_APPEARANCE.defaultBackground,
    ),
    activeBackground: normalizeCssBackground(
      buttonAppearance?.activeBackground,
      DEFAULT_BUTTON_APPEARANCE.activeBackground,
    ),
  };
}

function normalizeAccessKey(accessKey) {
  return String(accessKey || "").trim();
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

  return normalizeHexColor(normalized, fallback);
}

function normalizePopupPosition(popupPosition) {
  const normalized = String(popupPosition || "").trim().toLowerCase();
  return normalized === "topright" ? "topRight" : "bottomRight";
}

function normalizeWindowPosition(windowPosition) {
  const x = Number(windowPosition?.x);
  const y = Number(windowPosition?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

export function validateConfig(config) {
  const normalized = normalizeConfig(config);
  const errors = [];
  const roomIds = new Set();

  if (normalized.rooms.length === 0) {
    errors.push("At least one room is required.");
  }

  for (const room of normalized.rooms) {
    if (!room.id) {
      errors.push("Each room needs an ID.");
    } else if (roomIds.has(room.id)) {
      errors.push(`Duplicate room ID: ${room.id}`);
    } else {
      roomIds.add(room.id);
    }

    if (!room.name) {
      errors.push("Each surgery room needs a name.");
    }

    if (room.hideFromAlertSection && room.hideFromEntireUI) {
      errors.push(`Room/User "${room.name}" cannot be hidden from both the alert section and the entire UI.`);
    }

    if (!VALID_RECEPTION_SOUNDS.has(room.receptionSound?.sound)) {
      errors.push(`Room "${room.name}" has an invalid reception sound.`);
    }

    if (!Array.isArray(room.notifications) || room.notifications.length === 0) {
      errors.push(`Room "${room.name}" needs at least one notification.`);
      continue;
    }

    const notificationIds = new Set();
    const deviceButtons = new Set();

    for (const notification of room.notifications) {
      if (!notification.id) {
        errors.push(`Each notification in "${room.name}" needs an ID.`);
      } else if (notificationIds.has(notification.id)) {
        errors.push(`Duplicate notification ID in "${room.name}": ${notification.id}`);
      } else {
        notificationIds.add(notification.id);
      }

      if (!notification.label) {
        errors.push(`Each notification in "${room.name}" needs a message.`);
      }

      if (!Number.isFinite(Number(notification.deviceButton))) {
        errors.push(`Each notification in "${room.name}" needs a button number.`);
      } else if (deviceButtons.has(Number(notification.deviceButton))) {
        errors.push(
          `Duplicate button ${notification.deviceButton} in "${room.name}".`,
        );
      } else {
        deviceButtons.add(Number(notification.deviceButton));
      }
    }
  }

  if (!normalized.hardware?.leftAuxButton?.mode) {
    errors.push("The auxiliary button mode is required.");
  }

  if (!["party", "cancel"].includes(normalized.hardware?.leftAuxButton?.mode)) {
    errors.push("The auxiliary button mode is invalid.");
  }

  if (!Number.isFinite(Number(normalized.audio?.masterVolume))) {
    errors.push("The master volume is invalid.");
  }

  if (!Number.isFinite(Number(normalized.audio?.messageVolume))) {
    errors.push("The message volume is invalid.");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

function normalizeLegacyActions(actions) {
  return Array.isArray(actions)
    ? actions.map((action, index) => {
        const fallbackLabel = `Action ${index + 1}`;
        const label = String(action.label || action.message || fallbackLabel).trim();

        return {
          id: String(action.id || `action-${index + 1}`).trim(),
          label,
          message: String(action.message || label || fallbackLabel).trim(),
          color: String(action.color || "#2563eb").trim(),
          icon: String(action.icon || "").trim(),
        };
      })
    : [];
}

function normalizeLegacyMappings(buttonMappings) {
  return Array.isArray(buttonMappings)
    ? buttonMappings.map((mapping, index) => ({
        deviceButton: Number.isFinite(Number(mapping.deviceButton))
          ? Number(mapping.deviceButton)
          : index,
        actionId: String(mapping.actionId || "").trim(),
      }))
    : [];
}

function buildFallbackNotifications(actions, buttonMappings) {
  return actions.map((action, index) => {
    const mapping = buttonMappings.find((item) => item.actionId === action.id);

    return normalizeNotification(
      {
        ...action,
        deviceButton: Number.isFinite(Number(mapping?.deviceButton))
          ? Number(mapping.deviceButton)
          : index,
      },
      index,
    );
  });
}

function normalizeNotifications(notifications) {
  return Array.isArray(notifications)
    ? notifications.map((notification, index) => normalizeNotification(notification, index))
    : [];
}

function normalizeNotification(notification, index) {
  const fallbackLabel = `Action ${index + 1}`;
  const label = String(notification.label || notification.message || fallbackLabel).trim();

  return {
    id: String(notification.id || `action-${index + 1}`).trim(),
    label,
    message: String(notification.message || label || fallbackLabel).trim(),
    color: String(notification.color || "#2563eb").trim(),
    icon: String(notification.icon || "").trim(),
    deviceButton: Number.isFinite(Number(notification.deviceButton))
      ? Number(notification.deviceButton)
      : index,
  };
}

export const DEFAULT_RECEPTION_SOUND = "notification_sound_01";
export const RECEPTION_SOUND_OPTIONS = Array.from({ length: 17 }, (_value, index) => {
  const soundNumber = String(index + 1).padStart(2, "0");
  return {
    value: `notification_sound_${soundNumber}`,
    label: `Sound ${soundNumber}`,
    fileName: `Notification_sound_${soundNumber}.wav`,
  };
});

const LEGACY_RECEPTION_SOUND_ALIASES = new Map([
  ["ping", "notification_sound_01"],
  ["glass", "notification_sound_02"],
  ["hero", "notification_sound_03"],
  ["funk", "notification_sound_04"],
  ["pop", "notification_sound_05"],
]);
const VALID_RECEPTION_SOUNDS = new Set(RECEPTION_SOUND_OPTIONS.map((option) => option.value));

function normalizeReceptionSoundValue(value) {
  const normalized = String(value || DEFAULT_RECEPTION_SOUND)
    .trim()
    .toLowerCase();
  const mapped = LEGACY_RECEPTION_SOUND_ALIASES.get(normalized) || normalized;
  return VALID_RECEPTION_SOUNDS.has(mapped) ? mapped : DEFAULT_RECEPTION_SOUND;
}

function normalizeReceptionSound(receptionSound) {
  return {
    enabled: Boolean(receptionSound?.enabled),
    sound: normalizeReceptionSoundValue(receptionSound?.sound),
  };
}

function normalizeAudioNotificationSound(value) {
  return normalizeReceptionSoundValue(value);
}

function clampVolume(volume) {
  const parsed = Number(volume);

  if (!Number.isFinite(parsed)) {
    return 80;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function stripNotificationToAction(notification) {
  return {
    id: notification.id,
    label: notification.label,
    message: notification.message,
    color: notification.color,
    icon: notification.icon,
  };
}
