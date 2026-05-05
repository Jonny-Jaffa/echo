const roomSelect = document.querySelector("#room-select");
const serverInput = document.querySelector("#server-input");
const serverAccessKeyInput = document.querySelector("#server-access-key-input");
const setupServerInput = document.querySelector("#setup-server-input");
const setupServerAccessKeyInput = document.querySelector("#setup-server-access-key-input");
const setupRoomSelect = document.querySelector("#setup-room-select");
const setupConnectButton = document.querySelector("#setup-connect-button");
const setupSettingsButton = document.querySelector("#setup-settings-button");
const setupFeedback = document.querySelector("#setup-feedback");
const serverPanel = document.querySelector("#server-panel");
const serverToggleButton = document.querySelector("#server-toggle-button");
const panelMinimizeButton = document.querySelector("#panel-minimize-button");
const panelExpandButton = document.querySelector("#panel-expand-button");
const panelCloseButton = document.querySelector("#panel-close-button");
const quickActionsToggleButton = document.querySelector("#quick-actions-toggle-button");
const panelDisplayModeMenu = document.querySelector("#panel-display-mode-menu");
const quickActions = document.querySelector("#quick-actions");
const quickActionGrid = document.querySelector("#quick-action-grid");
const messageShell = document.querySelector(".message-shell");
const messageCollapseButton = document.querySelector("#message-collapse-button");
const messageContextLabel = document.querySelector("#message-context-label");
const messageThreadList = document.querySelector("#message-thread-list");
const messageThreadScrollLeft = document.querySelector("#message-thread-scroll-left");
const messageThreadScrollRight = document.querySelector("#message-thread-scroll-right");
const messageList = document.querySelector("#message-list");
const messageComposeInput = document.querySelector("#message-compose-input");
const messageSendButton = document.querySelector("#message-send-button");
const messageGroupList = document.querySelector("#message-group-list");
const addMessageGroupButton = document.querySelector("#add-message-group-button");
const buttonGrid = document.querySelector("#button-grid");
const statusDot = document.querySelector("#status-dot");
const statusIndicator = document.querySelector("#status-indicator");
const hardwareStatusLabel = document.querySelector("#hardware-status");
const waitingState = document.querySelector("#waiting-state");
const rolePanel = document.querySelector("#role-panel");
const roleOptionList = document.querySelector("#role-option-list");
const roleCurrentLabel = document.querySelector("#role-current-label");
const roleCloseButton = document.querySelector("#role-close-button");
const openRoleWindowButton = document.querySelector("#open-role-window-button");
const selectedDeviceRoleLabel = document.querySelector("#selected-device-role-label");
const receptionPingBanner = document.querySelector("#reception-ping-banner");
const receptionOfflineBanner = document.querySelector("#reception-offline-banner");
const launchAtStartupInput = document.querySelector("#launch-at-startup-input");
const showPanelAtStartupInput = document.querySelector("#show-panel-at-startup-input");
const alwaysOnTopInput = document.querySelector("#always-on-top-input");
const messageSoundInput = document.querySelector("#message-sound-input");
const messageSoundTestButton = document.querySelector("#message-sound-test-button");
const messageVolumeInput = document.querySelector("#message-volume-input");
const messageVolumeValue = document.querySelector("#message-volume-value");
const selectedRoomVolume = document.querySelector("#selected-room-volume");
const settingsRoomAlertSoundControls = document.querySelector("#settings-room-alert-sound-controls");
const settingsSidebarLinks = [...document.querySelectorAll("[data-settings-section-link]")];
const settingsTabSections = [...document.querySelectorAll("[data-settings-section]")];
const requestedWindowView = String(new URLSearchParams(window.location.search).get("view") || "").trim().toLowerCase();
const windowView = requestedWindowView === "settings"
  ? "settings"
  : requestedWindowView === "role"
    ? "role"
    : "main";
const isSettingsWindow = windowView === "settings";
const isRoleWindow = windowView === "role";

const STORAGE_KEY = "pip-panel";
const PANEL_DEVICE_ID_STORAGE_KEY = "pip-panel-device-id";
const LEGACY_STORAGE_KEY = "patient-ping-panel";
const LEGACY_PANEL_DEVICE_ID_STORAGE_KEY = "patient-ping-panel-device-id";
const MESSAGE_THREAD_ORDER_STORAGE_KEY = "pip-panel-message-thread-order";
const CONFIG_REFRESH_MS = 3000;
const DEFAULT_BUTTON_APPEARANCE = {
  defaultBackground: "#FDD905",
  defaultText: "#000000",
  activeBackground: "#000000",
  activeText: "#FFFFFF",
};
const BUTTON_SOLID_SWATCHES = [
  "#FDD905",
  "#000000",
  "#FFFFFF",
  "#D0069A",
  "#E07C0B",
  "#0BC120",
  "#1997E6",
  "#7C3AED",
  "#DC2626",
  "#0F766E",
  "#2563EB",
  "#9333EA",
  "#BE123C",
  "#047857",
  "#475569",
  "#0891B2",
  "#CA8A04",
  "#DB2777",
];
const BUTTON_GRADIENT_SWATCHES = [
  "linear-gradient(135deg, #FDD905 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #D0069A 0%, #7C3AED 100%)",
  "linear-gradient(135deg, #1997E6 0%, #0BC120 100%)",
  "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
  "linear-gradient(135deg, #2563EB 0%, #9333EA 100%)",
  "linear-gradient(135deg, #DC2626 0%, #F97316 100%)",
  "linear-gradient(135deg, #111827 0%, #475569 100%)",
  "linear-gradient(135deg, #BE123C 0%, #DB2777 100%)",
  "linear-gradient(135deg, #047857 0%, #84CC16 100%)",
  "linear-gradient(135deg, #0891B2 0%, #2563EB 100%)",
  "linear-gradient(135deg, #7C2D12 0%, #CA8A04 100%)",
  "linear-gradient(135deg, #FFFFFF 0%, #E5E7EB 100%)",
  "radial-gradient(circle at 30% 30%, #FDD905 0%, #E67E22 100%)",
  "radial-gradient(circle at 30% 30%, #D0069A 0%, #7C3AED 100%)",
  "radial-gradient(circle at 30% 30%, #34D399 0%, #059669 100%)",
  "radial-gradient(circle at 30% 30%, #2DD4BF 0%, #0F766E 100%)",
  "radial-gradient(circle at 30% 30%, #60A5FA 0%, #2563EB 100%)",
  "radial-gradient(circle at 30% 30%, #F87171 0%, #DC2626 100%)",
  "radial-gradient(circle at 30% 30%, #6B7280 0%, #111827 100%)",
  "radial-gradient(circle at 30% 30%, #FB7185 0%, #BE123C 100%)",
  "radial-gradient(circle at 30% 30%, #A3E635 0%, #4D7C0F 100%)",
  "radial-gradient(circle at 30% 30%, #22D3EE 0%, #0891B2 100%)",
  "radial-gradient(circle at 30% 30%, #FBBF24 0%, #B45309 100%)",
  "radial-gradient(circle at 30% 30%, #FFFFFF 0%, #D1D5DB 100%)",
];
const BUTTON_BACKGROUND_SWATCHES = [...BUTTON_SOLID_SWATCHES, ...BUTTON_GRADIENT_SWATCHES];
const BUTTON_TEXT_SWATCHES = ["#000000", "#FFFFFF"];
const DEFAULT_LEFT_AUX_SETTING = {
  enabled: true,
  mode: "party",
};
const DEFAULT_RIGHT_AUX_SETTING = {
  enabled: false,
  action: "none",
};
const ROOM_ACTION_BUTTON_COUNT = 8;
const DEFAULT_ROOM_ALERT_SOUND = "notification_sound_01";
const MAX_MESSAGE_GROUP_NAME_LENGTH = 24;
const DEFAULT_PINNED_MESSAGE_THREAD_KEYS = [];
const LEGACY_ROOM_ALERT_SOUND_ALIASES = {
  ping: "notification_sound_01",
  glass: "notification_sound_02",
  hero: "notification_sound_03",
  funk: "notification_sound_04",
  pop: "notification_sound_05",
};
const ROOM_ALERT_SOUND_FILE_MAP = Object.fromEntries(
  Array.from({ length: 17 }, (_value, index) => {
    const soundNumber = String(index + 1).padStart(2, "0");
    return [
      `notification_sound_${soundNumber}`,
      `Notification_sound_${soundNumber}.wav`,
    ];
  }),
);
const ROOM_ALERT_SOUND_OPTIONS = Array.from({ length: 17 }, (_value, index) => {
  const soundNumber = String(index + 1).padStart(2, "0");
  return {
    value: `notification_sound_${soundNumber}`,
    label: `Sound ${soundNumber}`,
  };
});
const ROOM_SETTINGS_INTERACTION_LOCK_MS = 8000;

function normalizePanelDisplayMode(mode) {
  const normalizedMode = String(mode || "messages").trim().toLowerCase();
  return ["messages", "buttons", "both"].includes(normalizedMode)
    ? normalizedMode
    : "messages";
}

let configState = null;
let socket = null;
let reconnectTimer = null;
let configRefreshTimer = null;
let configHash = "";
let panelDeviceId = "";
let isServerPanelVisible = false;
let manualPanelReveal = false;
let panelSettings = null;
let roomAlertVolumes = {};
let roomAlertSounds = {};
let roomButtonAppearances = {};
let roomLeftAuxSettings = {};
let roomRightAuxSettings = {};
let roomActionSettings = {};
let roomMessageGroups = {};
let roomPinnedMessageThreads = {};
let roomMessageThreadOrder = loadRoomMessageThreadOrder();
let preferredRoomId = "";
let roomSettingsInteractionLockUntil = 0;
let chatMessages = [];
let activeMessageThreadKey = "";
const unreadMessageThreadKeys = new Set();
let areQuickActionsVisible = false;
let isMessageThreadDrawerVisible = false;
let buttonAppearancePickerState = null;
let draggedMessageThreadKey = "";
let draggedMessageThreadSource = "";
let panelDisplayMode = "messages";
let isPanelDisplayModeMenuVisible = false;
let isEditingMessage = false;
let messageSound = DEFAULT_ROOM_ALERT_SOUND;
let messageVolume = 80;
const activeNotificationsByButtonId = new Map();
const activeLocalAlertPlayers = new Set();

function formatRuntimeRoleLabel(runtimeRole) {
  return runtimeRole === "reception" ? "Reception" : "Room";
}

function getRoomShortLabel(room) {
  return String(room?.shortName || room?.name || "").trim();
}

function getThreadDisplayLabel(thread) {
  return String(thread?.shortLabel || thread?.label || "").trim();
}

function getThreadFullLabel(thread) {
  if (!thread) {
    return "Reception";
  }

  if (thread.key === "all") {
    return "All Rooms";
  }

  return String(thread?.label || thread?.shortLabel || "").trim() || "Reception";
}

function getMessageThreadAccent(thread) {
  if (thread?.key === "all") {
    return "#879293";
  }

  const room = configState?.rooms?.find((item) => item.id === thread?.key);
  return room?.color || "var(--accent)";
}

function renderSelectedDeviceRole(settings = panelSettings) {
  if (!selectedDeviceRoleLabel) {
    return;
  }

  selectedDeviceRoleLabel.textContent = `Selected role: ${formatRuntimeRoleLabel(settings?.runtimeRole || "room")}`;
}

function renderRoleView(roleState = {}) {
  if (!roleOptionList) {
    return;
  }

  const runtimeRole = String(roleState.runtimeRole || "room").trim().toLowerCase();
  const nativeRuntimeRole = String(roleState.nativeRuntimeRole || "room").trim().toLowerCase();
  const isSupportedInThisBuild = roleState.isSupportedInThisBuild !== false;

  roleOptionList.querySelectorAll("[data-runtime-role]").forEach((option) => {
    option.classList.toggle(
      "is-active",
      String(option.getAttribute("data-runtime-role") || "").trim().toLowerCase() === runtimeRole,
    );
  });

  if (roleCurrentLabel) {
    roleCurrentLabel.textContent = isSupportedInThisBuild
      ? `Current saved role: ${formatRuntimeRoleLabel(runtimeRole)}`
      : `This Pip Surgery build supports ${formatRuntimeRoleLabel(nativeRuntimeRole)} only. Switch back to ${formatRuntimeRoleLabel(nativeRuntimeRole)} to continue using this install.`;
  }
}

function setPanelView(view) {
  document.body.dataset.view = view;
}

function loadSavedState() {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (savedState) {
      return JSON.parse(savedState);
    }

    const legacySavedState = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacySavedState) {
      localStorage.setItem(STORAGE_KEY, legacySavedState);
      return JSON.parse(legacySavedState);
    }

    return {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      serverUrl: serverInput.value.trim(),
      roomId: roomSelect.value,
    }),
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

function normalizeButtonBackground(value, fallback) {
  const normalized = String(value || "").trim();
  const paletteMatch = BUTTON_BACKGROUND_SWATCHES.find((swatch) => swatch.toLowerCase() === normalized.toLowerCase());

  if (paletteMatch) {
    return paletteMatch;
  }

  return normalizeHexColor(normalized, fallback);
}

function normalizeButtonTextColor(value, fallback) {
  const normalized = normalizeHexColor(value, fallback).toUpperCase();
  return normalized === "#FFFFFF" ? "#FFFFFF" : "#000000";
}

function normalizeButtonAppearance(buttonAppearance, fallbackAppearance = {}) {
  return {
    defaultBackground: normalizeButtonBackground(
      buttonAppearance?.defaultBackground,
      fallbackAppearance.defaultBackground || DEFAULT_BUTTON_APPEARANCE.defaultBackground,
    ),
    defaultText: normalizeButtonTextColor(
      buttonAppearance?.defaultText,
      fallbackAppearance.defaultText || DEFAULT_BUTTON_APPEARANCE.defaultText,
    ),
    activeBackground: normalizeButtonBackground(
      buttonAppearance?.activeBackground,
      fallbackAppearance.activeBackground || DEFAULT_BUTTON_APPEARANCE.activeBackground,
    ),
    activeText: normalizeButtonTextColor(
      buttonAppearance?.activeText,
      fallbackAppearance.activeText || DEFAULT_BUTTON_APPEARANCE.activeText,
    ),
  };
}

function normalizeRoomButtonAppearances(roomButtonAppearanceMap) {
  if (!roomButtonAppearanceMap || typeof roomButtonAppearanceMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomButtonAppearanceMap)
      .map(([roomId, buttonAppearance]) => [
        String(roomId || "").trim(),
        normalizeButtonAppearance(buttonAppearance),
      ])
      .filter(([roomId]) => roomId),
  );
}

function normalizeLeftAuxSetting(leftAuxSetting, fallbackSetting = {}) {
  const normalizedMode = String(
    leftAuxSetting?.mode || fallbackSetting.mode || DEFAULT_LEFT_AUX_SETTING.mode,
  )
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

function normalizeRoomLeftAuxSettings(roomLeftAuxSettingsMap) {
  if (!roomLeftAuxSettingsMap || typeof roomLeftAuxSettingsMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomLeftAuxSettingsMap)
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

function normalizeRoomRightAuxSettings(roomRightAuxSettingsMap) {
  if (!roomRightAuxSettingsMap || typeof roomRightAuxSettingsMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomRightAuxSettingsMap)
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
  const label = String(notification?.label || notification?.message || "").trim().slice(0, 21);

  if (!label) {
    return null;
  }

  return {
    id: String(notification?.id || `${roomId || "room"}-action-${deviceButton + 1}`).trim(),
    label,
    message: String(notification?.message || label || fallbackLabel).trim().slice(0, 21) || fallbackLabel,
    color: String(notification?.color || "#2563eb").trim(),
    icon: String(notification?.icon || "").trim().slice(0, 20),
    deviceButton,
  };
}

function normalizeRoomActionSettings(roomActionSettingsMap) {
  if (!roomActionSettingsMap || typeof roomActionSettingsMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomActionSettingsMap)
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
    id: String(messageGroup?.id || `${roomId || "room"}-group-${index + 1}`).trim(),
    name: normalizedName,
    roomIds,
  };
}

function normalizeRoomMessageGroups(roomMessageGroupsMap) {
  if (!roomMessageGroupsMap || typeof roomMessageGroupsMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomMessageGroupsMap)
      .map(([roomId, messageGroups]) => {
        const normalizedRoomId = String(roomId || "").trim();

        if (!normalizedRoomId) {
          return null;
        }

        return [
          normalizedRoomId,
          (Array.isArray(messageGroups) ? messageGroups : [])
            .map((messageGroup, index) =>
              normalizeRoomMessageGroup(messageGroup, index, normalizedRoomId))
            .filter(Boolean),
        ];
      })
      .filter(Boolean),
  );
}

function createMessageGroupThreadKey(participantRoomIds = []) {
  return [...new Set(
    participantRoomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean),
  )].sort().join("|");
}

function normalizeRoomPinnedMessageThreads(roomPinnedMessageThreadsMap) {
  if (!roomPinnedMessageThreadsMap || typeof roomPinnedMessageThreadsMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(roomPinnedMessageThreadsMap)
      .map(([roomId, threadKeys]) => {
        const normalizedRoomId = String(roomId || "").trim();

        if (!normalizedRoomId) {
          return null;
        }

        return [
          normalizedRoomId,
          [...new Set(
            Array.isArray(threadKeys)
              ? threadKeys.map((threadKey) => String(threadKey || "").trim()).filter(Boolean)
              : DEFAULT_PINNED_MESSAGE_THREAD_KEYS,
          )],
        ];
      })
      .filter(Boolean),
  );
}

function loadRoomMessageThreadOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MESSAGE_THREAD_ORDER_STORAGE_KEY) || "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([roomId, threadKeys]) => {
          const normalizedRoomId = String(roomId || "").trim();

          if (!normalizedRoomId) {
            return null;
          }

          return [
            normalizedRoomId,
            [...new Set(
              Array.isArray(threadKeys)
                ? threadKeys.map((threadKey) => String(threadKey || "").trim()).filter(Boolean)
                : [],
            )],
          ];
        })
        .filter(Boolean),
    );
  } catch {
    return {};
  }
}

function saveRoomMessageThreadOrder() {
  localStorage.setItem(
    MESSAGE_THREAD_ORDER_STORAGE_KEY,
    JSON.stringify(roomMessageThreadOrder || {}),
  );
}

function reorderIds(sourceIds = [], draggedId, targetId) {
  const ids = [...new Set(sourceIds)].filter(Boolean);
  const fromIndex = ids.indexOf(draggedId);
  const toIndex = ids.indexOf(targetId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return ids;
  }

  const [movedId] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, movedId);
  return ids;
}

function getPanelDeviceId() {
  const savedDeviceId =
    localStorage.getItem(PANEL_DEVICE_ID_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_PANEL_DEVICE_ID_STORAGE_KEY);

  if (savedDeviceId) {
    localStorage.setItem(PANEL_DEVICE_ID_STORAGE_KEY, savedDeviceId);
    return savedDeviceId;
  }

  const nextDeviceId = `panel-${createRandomId()}`;
  localStorage.setItem(PANEL_DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}

function createRandomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function setStatus(label, tone) {
  statusDot.dataset.tone = tone;
  if (statusIndicator) {
    statusIndicator.title = label;
    statusIndicator.setAttribute("aria-label", label);
  }
}

function syncSetupFieldsFromSettings() {
  if (setupServerInput && setupServerInput.value !== serverInput.value) {
    setupServerInput.value = serverInput.value;
  }

  if (setupServerAccessKeyInput && serverAccessKeyInput) {
    setupServerAccessKeyInput.value = serverAccessKeyInput.value;
  }

  if (setupRoomSelect && roomSelect.value) {
    setupRoomSelect.value = roomSelect.value;
  }
}

function syncSettingsFromSetupFields() {
  if (setupServerInput) {
    serverInput.value = setupServerInput.value.trim();
  }

  if (setupServerAccessKeyInput && serverAccessKeyInput) {
    serverAccessKeyInput.value = setupServerAccessKeyInput.value.trim();
  }

  if (setupRoomSelect?.value) {
    roomSelect.value = setupRoomSelect.value;
    preferredRoomId = setupRoomSelect.value;
  }
}

function setSetupFeedback(message, tone = "muted") {
  if (!setupFeedback) {
    return;
  }

  setupFeedback.textContent = message;
  setupFeedback.dataset.tone = tone;
}

function updateHardwareStatus(status = {}) {
  if (!hardwareStatusLabel) {
    return;
  }

  const state = String(status.state || "").trim().toLowerCase();
  const detail = String(status.detail || "").trim();
  const fallbackLabel =
    state === "connected"
      ? "Neo: Connected"
      : state === "waiting"
        ? "Neo: Waiting for device"
        : state === "busy"
          ? "Neo: In use by another app"
          : state === "error"
            ? "Neo: Error"
            : state === "stopped"
              ? "Neo: Stopped"
              : "Neo: Starting";

  hardwareStatusLabel.textContent = detail ? `Neo: ${detail}` : fallbackLabel;
}

function setServerPanelVisibility(visible) {
  isServerPanelVisible = isSettingsWindow ? true : Boolean(visible);
  serverPanel?.classList.toggle("hidden", !isServerPanelVisible);

  if (serverToggleButton && !isSettingsWindow) {
    serverToggleButton.setAttribute("aria-expanded", isServerPanelVisible ? "true" : "false");
    serverToggleButton.setAttribute(
      "aria-label",
      isServerPanelVisible ? "Hide settings" : "Show settings",
    );
    serverToggleButton.title = isServerPanelVisible ? "Hide settings" : "Settings";
  }
}

function setMessageThreadDrawerVisibility() {
  isMessageThreadDrawerVisible = false;
}

function setPanelDisplayModeMenuVisibility(visible) {
  isPanelDisplayModeMenuVisible = !isSettingsWindow && Boolean(visible);
  panelDisplayModeMenu?.classList.toggle("hidden", !isPanelDisplayModeMenuVisible);

  if (quickActionsToggleButton) {
    quickActionsToggleButton.setAttribute("aria-expanded", isPanelDisplayModeMenuVisible ? "true" : "false");
  }
}

function setActiveSettingsSidebarLink(sectionId) {
  const nextSectionId = sectionId || "settings-general";

  settingsSidebarLinks.forEach((link) => {
    link.classList.toggle(
      "is-active",
      String(link.getAttribute("data-settings-section-link") || "") === nextSectionId,
    );
  });

  settingsTabSections.forEach((section) => {
    section.hidden = String(section.getAttribute("data-settings-section") || "") !== nextSectionId;
  });
}

function renderPanelDisplayModeMenu() {
  panelDisplayModeMenu?.querySelectorAll("[data-panel-mode]").forEach((button) => {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    button.classList.toggle(
      "is-active",
      String(button.getAttribute("data-panel-mode") || "").trim() === panelDisplayMode,
    );
  });
}

async function setPanelDisplayMode(mode, options = {}) {
  const nextMode = normalizePanelDisplayMode(mode);
  const persist = options.persist !== false;
  const resize = options.resize !== false;

  panelDisplayMode = nextMode;
  areQuickActionsVisible = nextMode === "buttons" || nextMode === "both";
  const showMessages = nextMode === "messages" || nextMode === "both";

  document.body.dataset.panelMode = panelDisplayMode;
  document.body.dataset.quickActionsVisible = areQuickActionsVisible ? "true" : "false";
  quickActions?.classList.toggle("hidden", !areQuickActionsVisible);
  messageShell?.classList.toggle("hidden", !showMessages);

  if (!showMessages) {
    setMessageThreadDrawerVisibility(false);
  }

  updateMessageScrollbar();
  renderPanelDisplayModeMenu();

  if (!isSettingsWindow && resize) {
    await window.pipPanel
      .setSettingsExpanded?.({
        mode: panelDisplayMode,
        messageComposerHeightOffset: getMessageComposerHeightOffset(),
      })
      .catch(() => {});
  }

  if (!isSettingsWindow && persist) {
    await window.pipPanel.updateSettings({
      panelDisplayMode,
    }).catch(() => {});
  }
}

async function fetchConfig(options = {}) {
  const revealPanel = options.revealPanel !== false;
  const skipRenderIfUnchanged = options.skipRenderIfUnchanged !== false;
  const serverUrl = serverInput.value.trim();
  const selectedRoomId =
    preferredRoomId || roomSelect.value || window.pipPanel.defaultRoomId;
  const response = await fetch(`${serverUrl}/config`, {
    headers: buildAuthenticatedHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Unable to reach reception: ${response.status}`);
  }

  const nextConfig = await response.json();
  const nextHash = JSON.stringify(nextConfig);

  if (skipRenderIfUnchanged && nextHash === configHash && configState) {
    configState = nextConfig;
    return;
  }

  configState = nextConfig;
  configHash = nextHash;
  manualPanelReveal = false;
  if (revealPanel) {
    setPanelView("panel");
  }
  renderRooms(selectedRoomId);
  renderButtons();
  if (shouldRenderSelectedRoomVolumeControl()) {
    renderSelectedRoomVolumeControl();
  }
  if (shouldRenderMessageGroupSettings()) {
    renderMessageGroupSettings();
  }
  renderRoomAlertSoundControl();
  renderMessagingUi();
}

async function fetchChatMessages() {
  const serverUrl = serverInput.value.trim();

  if (!serverUrl) {
    return;
  }

  const response = await fetch(`${serverUrl}/chat/messages`, {
    headers: buildAuthenticatedHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Unable to load messages: ${response.status}`);
  }

  const messages = await response.json();
  chatMessages = Array.isArray(messages) ? messages : [];
  renderMessagingUi();
}

async function fetchRegisteredDevices() {
  const serverUrl = serverInput.value.trim();

  if (!serverUrl) {
    return [];
  }

  const response = await fetch(`${serverUrl}/devices`, {
    headers: buildAuthenticatedHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  const devices = await response.json();
  return Array.isArray(devices) ? devices : [];
}

async function findSelectedRoomConflict() {
  const selectedRoomId = roomSelect.value;

  if (!selectedRoomId) {
    return null;
  }

  const devices = await fetchRegisteredDevices().catch(() => []);
  return devices.find((device) => {
    const deviceRoomId = String(device?.roomId || "").trim();
    const deviceId = String(device?.deviceId || "").trim();

    return deviceRoomId === selectedRoomId && deviceId && deviceId !== panelDeviceId;
  }) || null;
}

async function refreshSetupRooms() {
  syncSettingsFromSetupFields();
  setStatus("Connecting", "pending");
  setSetupFeedback("Checking Reception details...");

  await fetchConfig({ revealPanel: false });
  syncSetupFieldsFromSettings();
  setSetupFeedback("Reception found. Choose this computer's room, then connect.", "success");
}

async function completeRoomSetup() {
  syncSettingsFromSetupFields();

  if (!serverInput.value.trim()) {
    setSetupFeedback("Enter the Reception address.", "error");
    return;
  }

  if (!getServerAccessKeyValue()) {
    setSetupFeedback("Enter the pairing code from Reception settings.", "error");
    return;
  }

  try {
    if (!configState || setupRoomSelect?.disabled) {
      await refreshSetupRooms();
    }

    syncSettingsFromSetupFields();

    if (!roomSelect.value) {
      setSetupFeedback("Choose this computer's room.", "error");
      return;
    }

    const roomConflict = await findSelectedRoomConflict();

    if (roomConflict) {
      const selectedRoomName = getSelectedRoom()?.name || roomSelect.value;
      const shouldContinue = window.confirm(
        `${selectedRoomName} already appears to be used by another computer. Continue only if you are replacing that machine.`,
      );

      if (!shouldContinue) {
        setSetupFeedback("Choose a different room to avoid duplicate alerts.", "error");
        return;
      }
    }

    await window.pipPanel.updateSettings({
      serverUrl: serverInput.value.trim(),
      serverAccessKey: getServerAccessKeyValue(),
      roomId: roomSelect.value,
    }).catch(() => {});
    saveState();
    await fetchConfig();
    connectSocket();
    startConfigRefresh();
    await fetchChatMessages().catch(() => {});
    setSetupFeedback("Connected.", "success");
  } catch (error) {
    setStatus("Offline", "offline");
    setPanelView("waiting");
    syncSetupFieldsFromSettings();
    setSetupFeedback(
      "Could not connect. Check the Reception address and pairing code.",
      "error",
    );
  }
}

function connectSocket() {
  const serverUrl = serverInput.value.trim();

  if (!serverUrl) {
    setStatus("Offline", "offline");
    if (!configState && !manualPanelReveal) {
      setPanelView("waiting");
    }
    return;
  }

  const wsUrl = serverUrl.replace(/^http/i, "ws");

  if (socket) {
    socket.close();
    socket = null;
  }

  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  setStatus("Connecting", "pending");
  socket = new WebSocket(buildAuthenticatedWebSocketUrl(wsUrl));

  socket.addEventListener("open", () => {
    setStatus("Connected", "online");
    hideReceptionOfflineBanner();
    sendIdentify();
    fetchChatMessages().catch(() => {});
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));

    if (message.type === "welcome") {
      if (Array.isArray(message.chatMessages)) {
        chatMessages = message.chatMessages;
        renderMessagingUi();
      }
      return;
    }

    if (
      message.type === "notification" &&
      message.payload?.roomId === roomSelect.value
    ) {
      handleNotificationActivated(message.payload);
      return;
    }

    if (
      message.type === "room:ping" &&
      message.payload?.roomId === roomSelect.value
    ) {
      playRoomAlertSound(message.payload.roomId).catch(() => {});
      showReceptionPingBanner();
      return;
    }

    if (message.type === "room:pingCleared") {
      hideReceptionPingBanner();
      return;
    }

    if (message.type === "notification:acknowledged") {
      handleNotificationResolution(message.payload);
      return;
    }

    if (message.type === "notification:cancelled") {
      handleNotificationResolution(message.payload);
      return;
    }

    if (message.type === "notifications:cleared") {
      if (
        !message.payload?.roomId ||
        String(message.payload.roomId) === roomSelect.value
      ) {
        clearAllPanelNotifications();
      }
    }

    if (message.type === "chat:message" && message.payload) {
      const threadKey = getIncomingMessageThreadKey(message.payload);

      if (threadKey && threadKey !== activeMessageThreadKey) {
        unreadMessageThreadKeys.add(threadKey);
      }

      if (shouldPlayIncomingChatSound(message.payload)) {
        playRoomMessageSound().catch(() => {});
      }
      chatMessages = [...chatMessages, message.payload].slice(-200);
      renderMessagingUi();
    }
  });

  socket.addEventListener("close", () => {
    setStatus("Offline", "offline");
    showReceptionOfflineBanner();
    if (!configState && !manualPanelReveal) {
      setPanelView("waiting");
    }
    reconnectTimer = window.setTimeout(() => {
      connectSocket();
    }, 2000);
  });

  socket.addEventListener("error", () => {
    setStatus("Offline", "offline");
    showReceptionOfflineBanner();
    if (!configState && !manualPanelReveal) {
      setPanelView("waiting");
    }
  });
}

function shouldPlayIncomingChatSound(message) {
  if (isSettingsWindow) {
    return false;
  }

  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId) {
    return false;
  }

  const senderRoomId = String(message?.senderRoomId || "").trim();
  const senderType = String(message?.senderType || "").trim();
  const recipientRoomIds = Array.isArray(message?.recipientRoomIds)
    ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim())
    : [];

  return recipientRoomIds.includes(currentRoomId) && (senderType !== "room" || senderRoomId !== currentRoomId);
}

function getIncomingMessageThreadKey(message) {
  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId || !isMessageInCurrentRoomContext(message, currentRoomId)) {
    return "";
  }

  const senderType = String(message?.senderType || "").trim();
  const senderRoomId = String(message?.senderRoomId || "").trim();

  if (isAllRoomsMessage(message)) {
    return "all";
  }

  if (senderType === "reception") {
    return "reception";
  }

  if (senderType === "room" && String(message?.messageGroupKey || "").trim()) {
    return `group:${String(message.messageGroupKey).trim()}`;
  }

  if (senderType === "room" && senderRoomId && senderRoomId !== currentRoomId && isAllRoomsMessage(message)) {
    return "all";
  }

  if (senderType === "room" && senderRoomId && senderRoomId !== currentRoomId) {
    return senderRoomId;
  }

  return "";
}

function sendIdentify() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "identify",
      deviceId: panelDeviceId,
      roomId: roomSelect.value,
      source: "client-panel",
    }),
  );
}

function renderRooms(preferredRoomId = "") {
  const currentValue =
    preferredRoomId || roomSelect.value || window.pipPanel.defaultRoomId;
  const roomOptions = (configState.rooms || [])
    .map(
      (room) => `
        <option value="${escapeHtml(room.id)}" ${room.id === currentValue ? "selected" : ""}>
          ${escapeHtml(room.name)}
        </option>
      `,
    )
    .join("");

  roomSelect.innerHTML = roomOptions;

  if (setupRoomSelect) {
    setupRoomSelect.innerHTML = roomOptions || '<option value="">No rooms found</option>';
    setupRoomSelect.disabled = !roomOptions;
  }

  if (![...roomSelect.options].some((option) => option.value === currentValue)) {
    roomSelect.value = configState.rooms?.[0]?.id || "";
  }

  preferredRoomId = roomSelect.value || currentValue || window.pipPanel.defaultRoomId;
  syncSetupFieldsFromSettings();

  sendIdentify();
}

function getCurrentMessageRoomId() {
  return roomSelect.value || getSelectedRoom()?.id || preferredRoomId || "";
}

function getCurrentMessageRoom() {
  const roomId = getCurrentMessageRoomId();
  return configState?.rooms?.find((room) => room.id === roomId) || null;
}

function getCurrentRoomMessageGroups() {
  const currentRoomId = getCurrentMessageRoomId();
  return currentRoomId ? roomMessageGroups?.[currentRoomId] || [] : [];
}

function getCurrentRoomPinnedThreadKeys() {
  const currentRoomId = getCurrentMessageRoomId();
  return currentRoomId ? roomPinnedMessageThreads?.[currentRoomId] || [] : [];
}

function getCurrentRoomMessageThreadOrder() {
  const currentRoomId = getCurrentMessageRoomId();
  return currentRoomId ? roomMessageThreadOrder?.[currentRoomId] || [] : [];
}

function orderMessageThreads(threads = []) {
  const order = getCurrentRoomMessageThreadOrder();
  const threadMap = new Map(threads.map((thread) => [thread.key, thread]));
  const orderedThreads = order
    .map((threadKey) => threadMap.get(threadKey))
    .filter(Boolean);
  const orderedThreadKeys = new Set(orderedThreads.map((thread) => thread.key));

  return [
    ...orderedThreads,
    ...threads.filter((thread) => !orderedThreadKeys.has(thread.key)),
  ];
}

function buildMessageGroupThread(group, currentRoomId) {
  if (!group?.id || !group?.name || !currentRoomId) {
    return null;
  }

  const participantRoomIds = [currentRoomId, ...(Array.isArray(group.roomIds) ? group.roomIds : [])];
  const messageGroupKey = createMessageGroupThreadKey(participantRoomIds);

  if (!messageGroupKey) {
    return null;
  }

  return {
    key: `group:${messageGroupKey}`,
    label: group.name,
    messageGroupKey,
    participantRoomIds: [...new Set(participantRoomIds)],
  };
}

function getConfiguredMessageGroupThreads(currentRoomId) {
  return getCurrentRoomMessageGroups()
    .map((group) => buildMessageGroupThread(group, currentRoomId))
    .filter(Boolean);
}

function getObservedMessageGroupThreads(currentRoomId) {
  const threadsByKey = new Map();

  chatMessages.forEach((message) => {
    if (!isMessageInCurrentRoomContext(message, currentRoomId)) {
      return;
    }

    const messageGroupKey = String(message?.messageGroupKey || "").trim();

    if (!messageGroupKey || isReceptionAllRoomsMessage(message)) {
      return;
    }

    const participantRoomIds = [...new Set(
      Array.isArray(message?.messageGroupParticipantRoomIds)
        ? message.messageGroupParticipantRoomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean)
        : [],
    )];

    if (!participantRoomIds.includes(currentRoomId)) {
      return;
    }

    threadsByKey.set(`group:${messageGroupKey}`, {
      key: `group:${messageGroupKey}`,
      label: String(message?.messageGroupLabel || "").trim() || "Group",
      messageGroupKey,
      participantRoomIds,
    });
  });

  return [...threadsByKey.values()];
}

function getMessageGroupThread(threadKey, currentRoomId) {
  return [
    ...getConfiguredMessageGroupThreads(currentRoomId),
    ...getObservedMessageGroupThreads(currentRoomId),
  ].find((thread) => thread.key === threadKey) || null;
}

function isMessageInCurrentRoomContext(message, currentRoomId) {
  const senderRoomId = String(message?.senderRoomId || "").trim();
  const recipientRoomIds = Array.isArray(message?.recipientRoomIds)
    ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim())
    : [];

  return senderRoomId === currentRoomId || recipientRoomIds.includes(currentRoomId);
}

function isAllRoomsMessage(message) {
  if (String(message?.senderType || "").trim() !== "room") {
    return isReceptionAllRoomsMessage(message);
  }

  const senderRoomId = String(message?.senderRoomId || "").trim();

  if (!senderRoomId) {
    return false;
  }

  const recipientRoomIds = [...new Set(
    Array.isArray(message?.recipientRoomIds)
      ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean)
      : [],
  )].sort();
  const allOtherRoomIds = (configState?.rooms || [])
    .map((room) => String(room?.id || "").trim())
    .filter((roomId) => roomId && roomId !== senderRoomId)
    .sort();

  return recipientRoomIds.join("|") === allOtherRoomIds.join("|");
}

function isReceptionAllRoomsMessage(message) {
  if (String(message?.senderType || "").trim() !== "reception") {
    return false;
  }

  if (String(message?.messageGroupKey || "").trim() === "reception-all-rooms") {
    return true;
  }

  const roomIds = (configState?.rooms || [])
    .map((room) => String(room?.id || "").trim())
    .filter(Boolean)
    .sort();
  const recipientRoomIds = [...new Set(
    Array.isArray(message?.recipientRoomIds)
      ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean)
      : [],
  )].sort();

  return (
    roomIds.length > 0 &&
    recipientRoomIds.length === roomIds.length &&
    roomIds.every((roomId) => recipientRoomIds.includes(roomId))
  );
}

function isMessageInThread(message, threadKey, currentRoomId) {
  if (!threadKey || !currentRoomId || !isMessageInCurrentRoomContext(message, currentRoomId)) {
    return false;
  }

  const senderType = String(message?.senderType || "").trim();
  const senderRoomId = String(message?.senderRoomId || "").trim();
  const recipientRoomIds = Array.isArray(message?.recipientRoomIds)
    ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim())
    : [];

  if (threadKey === "reception") {
    return !isAllRoomsMessage(message) && (senderType === "reception" || Boolean(message?.sendToReception));
  }

  if (threadKey.startsWith("group:")) {
    return `group:${String(message?.messageGroupKey || "").trim()}` === threadKey;
  }

  if (threadKey === "all") {
    return isAllRoomsMessage(message);
  }

  if (isAllRoomsMessage(message)) {
    return false;
  }

  return senderRoomId === threadKey || recipientRoomIds.includes(threadKey);
}

function getMessageThreadItems() {
  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId) {
    return [];
  }

  const rooms = (configState?.rooms || []).filter((room) => room.id !== currentRoomId);
  const configuredGroupThreads = getConfiguredMessageGroupThreads(currentRoomId);
  const observedGroupThreads = getObservedMessageGroupThreads(currentRoomId);
  const groupThreadsByKey = new Map();

  [...configuredGroupThreads, ...observedGroupThreads].forEach((thread) => {
    if (!thread?.key) {
      return;
    }

    if (!groupThreadsByKey.has(thread.key)) {
      groupThreadsByKey.set(thread.key, thread);
      return;
    }

    const existingThread = groupThreadsByKey.get(thread.key);
    groupThreadsByKey.set(thread.key, {
      ...existingThread,
      label: existingThread?.label || thread.label,
      participantRoomIds: existingThread?.participantRoomIds?.length
        ? existingThread.participantRoomIds
        : thread.participantRoomIds,
    });
  });
  const threads = [
    { key: "reception", label: "Reception", shortLabel: "Rec" },
    { key: "all", label: "All" },
    ...groupThreadsByKey.values(),
    ...rooms.map((room) => ({ key: room.id, label: room.name, shortLabel: getRoomShortLabel(room) })),
  ];

  return threads.map((thread) => {
    const threadMessages = chatMessages.filter((message) =>
      isMessageInThread(message, thread.key, currentRoomId),
    );
    const latestTimestamp = threadMessages.length > 0
      ? Math.max(...threadMessages.map((message) => new Date(message.timestamp || 0).getTime()))
      : 0;

    return {
      ...thread,
      hasMessages: threadMessages.length > 0,
      latestTimestamp,
      unread: unreadMessageThreadKeys.has(thread.key),
    };
  });
}

function ensureActiveMessageThread() {
  const threads = getMessageThreadItems();

  if (threads.some((thread) => thread.key === activeMessageThreadKey)) {
    return threads;
  }

  const latestThread = [...threads]
    .filter((thread) => thread.hasMessages)
    .sort((left, right) => right.latestTimestamp - left.latestTimestamp)[0];

  activeMessageThreadKey = latestThread?.key || "reception";
  unreadMessageThreadKeys.delete(activeMessageThreadKey);
  return threads;
}

function getVisibleChatMessages() {
  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId) {
    return [];
  }

  const threadKey = activeMessageThreadKey || "reception";
  return chatMessages.filter((message) => isMessageInThread(message, threadKey, currentRoomId));
}

function syncMessageThreadOrder(threads) {
  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId) {
    return;
  }

  const threadKeys = threads.map((thread) => thread.key);
  const currentOrder = getCurrentRoomMessageThreadOrder();
  roomMessageThreadOrder = {
    ...roomMessageThreadOrder,
    [currentRoomId]: [
      ...currentOrder.filter((threadKey) => threadKeys.includes(threadKey)),
      ...threadKeys.filter((threadKey) => !currentOrder.includes(threadKey)),
    ],
  };
  saveRoomMessageThreadOrder();
}

function renderMessageThreads() {
  if (!messageThreadList) {
    return;
  }

  const threads = ensureActiveMessageThread();
  syncMessageThreadOrder(threads);
  const orderedThreads = orderMessageThreads(threads);
  messageThreadList.closest(".message-thread-bar")?.classList.toggle("hidden", orderedThreads.length === 0);
  messageThreadList.innerHTML = orderedThreads
    .map((thread) => `
      <button
        class="message-thread-chip ${thread.key === activeMessageThreadKey ? "is-active" : ""} ${thread.key === "reception" ? "is-reception" : ""} ${thread.key === "all" ? "is-all-rooms" : ""}"
        style="--thread-accent: ${escapeHtml(getMessageThreadAccent(thread))};"
        data-message-thread-key="${escapeHtml(thread.key)}"
        data-message-thread-drag-source="threads"
        draggable="true"
        type="button"
        title="${escapeHtml(getThreadFullLabel(thread))}"
      >
        <span title="${escapeHtml(thread.label)}">${escapeHtml(getThreadDisplayLabel(thread))}</span>
        ${thread.unread ? '<span class="message-thread-dot" aria-hidden="true"></span>' : ""}
      </button>
    `)
    .join("");
  requestAnimationFrame(updateMessageThreadScrollButtons);
}

function updateMessageThreadScrollButtons() {
  if (!messageThreadList || !messageThreadScrollLeft || !messageThreadScrollRight) {
    return;
  }

  const hasOverflow = messageThreadList.scrollWidth > messageThreadList.clientWidth;
  const atStart = messageThreadList.scrollLeft <= 2;
  const atEnd = messageThreadList.scrollLeft + messageThreadList.clientWidth >= messageThreadList.scrollWidth - 2;

  messageThreadScrollLeft.hidden = !hasOverflow || atStart;
  messageThreadScrollRight.hidden = !hasOverflow || atEnd;
  messageThreadList.classList.toggle("has-overflow", hasOverflow);
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return `rgba(40, 143, 162, ${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function syncMessageContext() {
  if (!messageShell || !messageContextLabel) {
    return;
  }

  const threads = getMessageThreadItems();
  const activeThread = threads.find((thread) => thread.key === (activeMessageThreadKey || "reception"))
    || threads.find((thread) => thread.key === "reception")
    || null;
  const activeRoom = configState?.rooms?.find((room) => room.id === activeThread?.key);
  const isAllRoomsThread = activeThread?.key === "all";
  const accent = getMessageThreadAccent(activeThread);
  const labelColor = isAllRoomsThread ? "#3f4444" : activeRoom?.color || "var(--accent)";
  const iconColor = isAllRoomsThread ? "white" : "white";
  const listBackground = isAllRoomsThread
    ? "linear-gradient(90deg, #d5d9d9, #f5f6f6)"
    : activeRoom?.color
      ? `linear-gradient(90deg, ${hexToRgba(activeRoom.color, 0.16)}, ${hexToRgba(activeRoom.color, 0.04)})`
      : "linear-gradient(90deg, #d5d9d9, #f5f6f6)";
  const stripBackground = isAllRoomsThread
    ? "linear-gradient(90deg, #d0d4d4, #ffffff)"
    : activeRoom?.color
      ? `linear-gradient(90deg, ${hexToRgba(activeRoom.color, 0.16)}, #ffffff)`
      : "linear-gradient(90deg, #d0d4d4, #ffffff)";
  const fullLabel = getThreadFullLabel(activeThread);

  messageContextLabel.textContent = fullLabel;
  messageShell.style.setProperty("--active-room-accent", accent);
  messageShell.style.setProperty("--message-send-active-color", isAllRoomsThread ? "var(--text)" : accent);
  messageShell.style.setProperty("--message-context-label-color", labelColor);
  messageShell.style.setProperty("--message-context-short-label-color", iconColor);
  messageShell.style.setProperty("--message-context-strip-background", stripBackground);
  messageShell.style.setProperty("--message-list-background", listBackground);
  messageShell.style.setProperty("--message-bubble-incoming", accent);
  messageShell.style.setProperty("--message-bubble-text", isAllRoomsThread ? "var(--text)" : "white");
  messageShell.style.setProperty("--message-bubble-time", isAllRoomsThread ? "var(--muted)" : "#ededed");

  if (messageComposeInput) {
    messageComposeInput.placeholder = `message ${fullLabel.toLowerCase()}`;
  }
}

function syncMessageComposerState() {
  if (!messageSendButton || !messageComposeInput) {
    return;
  }

  const canSend =
    Boolean(activeMessageThreadKey || "reception") &&
    Boolean(String(messageComposeInput.value || "").trim()) &&
    Boolean(getCurrentMessageRoomId());

  messageSendButton.disabled = !canSend;
  messageSendButton.classList.toggle("is-ready-to-send", canSend);
}

function getIncomingMessageBubbleColor(message) {
  const senderType = String(message?.senderType || "").trim();

  if (senderType === "reception") {
    return "#000000";
  }

  const senderRoomId = String(message?.senderRoomId || "").trim();
  const senderRoom = configState?.rooms?.find((room) => room.id === senderRoomId);

  return senderRoom?.color || "#418191";
}

function renderChatMessages() {
  if (!messageList) {
    return;
  }

  // Don't re-render messages while an inline edit is in progress
  if (isEditingMessage) {
    return;
  }

  const wasPinnedToBottom =
    messageList.scrollHeight -
      messageList.scrollTop -
      messageList.clientHeight <
    24;
  const messages = getVisibleChatMessages();

  if (messages.length === 0) {
    messageList.innerHTML = "";
    updateMessageScrollbar();
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  messageList.innerHTML = messages
    .map((message) => {
      const isOutgoing = String(message?.senderRoomId || "").trim() === currentRoomId;
      const isDeleted = Boolean(message.deleted);
      const messageId = String(message.messageId || "").trim();
      const incomingStyle = isOutgoing
        ? ""
        : ` style="--message-bubble-incoming: ${escapeHtml(getIncomingMessageBubbleColor(message))}; --message-bubble-text: white; --message-bubble-time: #ededed;"`;

      if (isDeleted) {
        return `
          <article class="message-item ${isOutgoing ? "is-outgoing" : "is-incoming"} is-deleted"${incomingStyle}>
            <div class="message-bubble">
              <div class="message-bubble-body is-single-line">
                <p class="message-item-text message-item-text-deleted">Message deleted</p>
              </div>
            </div>
          </article>
        `;
      }

      const editedLabel = message.edited ? " <span class=\"message-item-edited\">(edited)</span>" : "";
      return `
        <article class="message-item ${isOutgoing ? "is-outgoing" : "is-incoming"}"${incomingStyle} data-message-id="${escapeHtml(messageId)}">
          <div class="message-bubble">
            <div class="message-bubble-body">
              <p class="message-item-text">${escapeHtml(message.text || "")}${editedLabel}</p>
              <span class="message-item-time">${escapeHtml(formatMessageTime(message.timestamp))}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  updateMessageBubbleLayouts();
  if (wasPinnedToBottom) {
    requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
      updateMessageScrollbar();
    });
  } else {
    requestAnimationFrame(updateMessageScrollbar);
  }
}

function updateMessageBubbleLayouts() {
  if (!messageList) {
    return;
  }

  messageList.querySelectorAll(".message-bubble-body").forEach((bubbleBody) => {
    if (!(bubbleBody instanceof HTMLElement)) {
      return;
    }

    const textElement = bubbleBody.querySelector(".message-item-text");

    if (!(textElement instanceof HTMLElement)) {
      return;
    }

    const computedStyle = window.getComputedStyle(textElement);
    const fontSize = Number.parseFloat(computedStyle.fontSize) || 13;
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || fontSize * 1.4;
    const isSingleLine = textElement.scrollHeight <= lineHeight * 1.5;

    bubbleBody.classList.toggle("is-single-line", isSingleLine);
    bubbleBody.classList.toggle("is-multi-line", !isSingleLine);
  });
}

function renderMessagingUi() {
  renderMessageThreads();
  syncMessageContext();
  renderChatMessages();
  syncMessageComposerState();
  updateMessageComposerHeight();
}

function updateMessageComposerHeight() {
  if (!messageComposeInput) {
    return;
  }

  messageComposeInput.style.height = "auto";
  messageComposeInput.style.height = `${Math.min(messageComposeInput.scrollHeight, 136)}px`;
  updateMessageComposerScrollbar();
}

function getMessageComposerHeightOffset() {
  if (!messageComposeInput || messageShell?.classList.contains("hidden")) {
    return 0;
  }

  const inputStyle = window.getComputedStyle(messageComposeInput);
  const minHeight = Number.parseFloat(inputStyle.minHeight) || 38;
  const currentHeight = Math.ceil(
    messageComposeInput.getBoundingClientRect().height || messageComposeInput.clientHeight || minHeight,
  );

  return Math.max(0, currentHeight - Math.ceil(minHeight));
}

function updateMessageComposerScrollbar() {
  if (!messageComposeInput) {
    return;
  }

  const compose = messageComposeInput.closest(".message-compose");

  if (!(compose instanceof HTMLElement)) {
    return;
  }

  const maxScroll = messageComposeInput.scrollHeight - messageComposeInput.clientHeight;
  const hasScrollbar = maxScroll > 1 && messageComposeInput.clientHeight > 0;
  compose.classList.toggle("has-compose-scrollbar", hasScrollbar);

  if (!hasScrollbar) {
    return;
  }

  const composeRect = compose.getBoundingClientRect();
  const inputRect = messageComposeInput.getBoundingClientRect();
  const inset = 17;
  const trackHeight = Math.max(1, messageComposeInput.clientHeight - inset * 2);
  const thumbHeight = Math.max(
    24,
    Math.round(trackHeight * (messageComposeInput.clientHeight / messageComposeInput.scrollHeight)),
  );
  const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll > 0 ? (messageComposeInput.scrollTop / maxScroll) * maxThumbOffset : 0;
  const thumbTop = inputRect.top - composeRect.top + inset + thumbOffset;
  const thumbLeft = inputRect.right - composeRect.left - 15;

  compose.style.setProperty("--compose-scrollbar-left", `${Math.round(thumbLeft)}px`);
  compose.style.setProperty("--compose-scrollbar-top", `${Math.round(thumbTop)}px`);
  compose.style.setProperty("--compose-scrollbar-thumb-height", `${Math.round(thumbHeight)}px`);
}

function updateMessageScrollbar() {
  if (!messageShell || !messageList) {
    return;
  }

  const maxScroll = messageList.scrollHeight - messageList.clientHeight;
  const hasScrollbar = maxScroll > 1 && messageList.clientHeight > 0;
  messageShell.classList.toggle("has-message-scrollbar", hasScrollbar);

  if (!hasScrollbar) {
    return;
  }

  const shellRect = messageShell.getBoundingClientRect();
  const listRect = messageList.getBoundingClientRect();
  const inset = 30;
  const trackHeight = Math.max(1, messageList.clientHeight - inset * 2);
  const thumbHeight = Math.max(
    34,
    Math.round(trackHeight * (messageList.clientHeight / messageList.scrollHeight)),
  );
  const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll > 0 ? (messageList.scrollTop / maxScroll) * maxThumbOffset : 0;
  const thumbTop = listRect.top - shellRect.top + inset + thumbOffset;

  messageShell.style.setProperty("--message-scrollbar-thumb-height", `${Math.round(thumbHeight)}px`);
  messageShell.style.setProperty("--message-scrollbar-thumb-top", `${Math.round(thumbTop)}px`);
}

function selectMessageThread(threadKey, { closeDrawer = false } = {}) {
  const normalizedThreadKey = String(threadKey || "").trim();

  if (!normalizedThreadKey) {
    return;
  }

  activeMessageThreadKey = normalizedThreadKey;
  unreadMessageThreadKeys.delete(normalizedThreadKey);

  if (closeDrawer) {
    setMessageThreadDrawerVisibility(false);
  }

  renderMessagingUi();
}

function renderButtons() {
  const buttons = getResolvedPanelButtons();

  if (buttonGrid) {
    buttonGrid.innerHTML = buttons.map((button) => renderButton(button, { interactive: false })).join("");
  }

  if (quickActionGrid) {
    quickActionGrid.innerHTML = buttons.map((button) => renderButton(button, { interactive: true })).join("");
  }
}

function getRoomButtonAppearance(roomId) {
  const legacyFallback = normalizeButtonAppearance(configState?.hardware?.buttonAppearance, {
    defaultBackground: DEFAULT_BUTTON_APPEARANCE.defaultBackground,
    defaultText: DEFAULT_BUTTON_APPEARANCE.defaultText,
    activeBackground: DEFAULT_BUTTON_APPEARANCE.activeBackground,
    activeText: DEFAULT_BUTTON_APPEARANCE.activeText,
  });
  const roomOverride = roomButtonAppearances?.[roomId];

  return normalizeButtonAppearance(roomOverride, legacyFallback);
}

function updateRoomButtonAppearance(roomId, key, value) {
  const currentAppearance = getRoomButtonAppearance(roomId);

  roomButtonAppearances = {
    ...roomButtonAppearances,
    [roomId]: normalizeButtonAppearance({
      ...currentAppearance,
      [key]: value,
    }),
  };
}

function getRoomButtonPreviewText(roomId) {
  const firstNotification = getResolvedRoomNotifications(roomId)[0];
  return String(
    firstNotification?.icon ||
      firstNotification?.label ||
      firstNotification?.message ||
      "15MIN",
  ).trim() || "15MIN";
}

function getButtonAppearanceModeKeys(mode) {
  return mode === "active"
    ? {
        background: "activeBackground",
        text: "activeText",
        title: "Active Button Style",
      }
    : {
        background: "defaultBackground",
        text: "defaultText",
        title: "Default Button Style",
      };
}

function renderButtonBackgroundSwatches(selectedBackground) {
  const normalizedSelected = String(selectedBackground || "").trim().toLowerCase();
  const renderSwatch = (background, index, type) => `
    <button
      class="button-style-swatch ${String(background).trim().toLowerCase() === normalizedSelected ? "is-selected" : ""}"
      data-button-style-background="${escapeHtml(background)}"
      data-button-style-swatch-type="${type.toLowerCase()}"
      data-button-style-swatch-index="${index}"
      type="button"
      aria-label="${type} style ${index + 1}"
      title="${type} style ${index + 1}"
      style="--swatch-background: ${escapeHtml(background)}"
    ></button>
  `;

  return `
    <div class="button-style-swatch-section">
      <span>Solid</span>
      <div class="button-style-swatch-grid is-solid">
        ${BUTTON_SOLID_SWATCHES.map((background, index) => renderSwatch(background, index, "Solid")).join("")}
      </div>
    </div>
    <div class="button-style-swatch-section">
      <span>Gradient</span>
      <div class="button-style-swatch-grid is-gradient">
        ${BUTTON_GRADIENT_SWATCHES.map((background, index) => renderSwatch(background, index, "Gradient")).join("")}
      </div>
    </div>
  `;
}

function renderButtonAppearanceSummary(roomId, mode) {
  const appearance = getRoomButtonAppearance(roomId);
  const modeKeys = getButtonAppearanceModeKeys(mode);
  const background = appearance[modeKeys.background];
  const textColour = appearance[modeKeys.text];
  const previewText = getRoomButtonPreviewText(roomId);

  return `
    <button
      class="button-style-trigger"
      data-room-appearance-id="${escapeHtml(roomId)}"
      data-button-style-mode="${escapeHtml(mode)}"
      type="button"
    >
      <span class="button-style-trigger-copy">
        <span class="selected-room-control-label">${escapeHtml(modeKeys.title)}</span>
        <span>${mode === "active" ? "Pressed state" : "Normal state"}</span>
      </span>
      <span
        class="button-style-trigger-preview"
        style="--button-background: ${escapeHtml(background)}; --button-text: ${escapeHtml(textColour)};"
      >
        ${escapeHtml(previewText)}
      </span>
    </button>
  `;
}

function renderButtonAppearancePicker() {
  const state = buttonAppearancePickerState;
  const pickerHost = selectedRoomVolume?.querySelector(".selected-room-button-appearance-grid");

  if (!pickerHost || !state) {
    return;
  }

  const room = configState?.rooms?.find((item) => item.id === state.roomId);

  if (!room) {
    buttonAppearancePickerState = null;
    selectedRoomVolume.querySelector(".button-style-popover")?.remove();
    return;
  }

  const appearance = getRoomButtonAppearance(room.id);
  const modeKeys = getButtonAppearanceModeKeys(state.mode);
  const background = appearance[modeKeys.background];
  const textColour = appearance[modeKeys.text];
  const previewText = getRoomButtonPreviewText(room.id);
  const existingPopover = pickerHost.querySelector(".button-style-popover");
  const popoverHtml = `
    <div class="button-style-popover" role="dialog" aria-label="${escapeHtml(modeKeys.title)}">
      <div class="button-style-popover-header">
        <div>
          <span class="selected-room-control-label">${escapeHtml(modeKeys.title)}</span>
          <strong>${escapeHtml(room.name)}</strong>
        </div>
        <button class="button-style-close" data-button-style-close="true" type="button" aria-label="Close style picker">Close</button>
      </div>
      <div class="button-style-popover-body">
        <div class="button-style-preview-wrap">
          <button
            class="panel-button is-preview button-style-live-preview"
            type="button"
            style="
              --button-background: ${escapeHtml(background)};
              --button-text: ${escapeHtml(textColour)};
            "
          >
            <span class="panel-button-text">${escapeHtml(previewText)}</span>
          </button>
        </div>
        <div class="button-style-controls">
          ${renderButtonBackgroundSwatches(background)}
          <div class="button-style-swatch-section">
            <span>Text</span>
            <div class="button-style-text-options">
              ${BUTTON_TEXT_SWATCHES.map((colour) => `
                <button
                  class="button-style-text-option ${colour === textColour ? "is-selected" : ""}"
                  data-button-style-text="${escapeHtml(colour)}"
                  type="button"
                >
                  ${colour === "#FFFFFF" ? "White" : "Black"}
                </button>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (existingPopover) {
    existingPopover.outerHTML = popoverHtml;
  } else {
    pickerHost.insertAdjacentHTML("beforeend", popoverHtml);
  }
}

function openButtonAppearancePicker(roomId, mode) {
  if (!roomId) {
    return;
  }

  buttonAppearancePickerState = {
    roomId,
    mode: mode === "active" ? "active" : "default",
  };
  renderButtonAppearancePicker();
}

function closeButtonAppearancePicker() {
  buttonAppearancePickerState = null;
  selectedRoomVolume?.querySelector(".button-style-popover")?.remove();
}

function getRoomLeftAuxSetting(roomId) {
  const legacyFallback = normalizeLeftAuxSetting(configState?.hardware?.leftAuxButton, {
    enabled: DEFAULT_LEFT_AUX_SETTING.enabled,
    mode: DEFAULT_LEFT_AUX_SETTING.mode,
  });
  const roomOverride = roomLeftAuxSettings?.[roomId];

  return normalizeLeftAuxSetting(roomOverride, legacyFallback);
}

function updateRoomLeftAuxSetting(roomId, key, value) {
  const currentSetting = getRoomLeftAuxSetting(roomId);

  roomLeftAuxSettings = {
    ...roomLeftAuxSettings,
    [roomId]: normalizeLeftAuxSetting({
      ...currentSetting,
      [key]: value,
    }),
  };
}

function getRoomRightAuxSetting(roomId) {
  const roomOverride = roomRightAuxSettings?.[roomId];
  return normalizeRightAuxSetting(roomOverride, DEFAULT_RIGHT_AUX_SETTING);
}

function updateRoomRightAuxSetting(roomId, key, value) {
  const currentSetting = getRoomRightAuxSetting(roomId);

  roomRightAuxSettings = {
    ...roomRightAuxSettings,
    [roomId]: normalizeRightAuxSetting({
      ...currentSetting,
      [key]: value,
    }),
  };
}

function getButtonAppearanceSettings() {
  return {
    ...getRoomButtonAppearance(getSelectedRoom()?.id),
  };
}

function getResolvedRoomNotifications(roomId) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    return [];
  }

  if (Object.prototype.hasOwnProperty.call(roomActionSettings, normalizedRoomId)) {
    return normalizeRoomActionSettings({
      [normalizedRoomId]: roomActionSettings[normalizedRoomId],
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

function getResolvedRoomAction(roomId, buttonIndex) {
  return getResolvedRoomNotifications(roomId).find(
    (item) => Number(item.deviceButton) === Number(buttonIndex),
  ) || null;
}

function getRoomActionEditorRows(roomId) {
  return Array.from({ length: ROOM_ACTION_BUTTON_COUNT }, (_value, index) => {
    const action = getResolvedRoomAction(roomId, index);

    return {
      id: action?.id || `${roomId}-action-${index + 1}`,
      buttonIndex: index,
      icon: action?.icon || "",
      label: action?.label || action?.message || "",
      message: action?.message || action?.label || "",
      enabled: Boolean(action),
    };
  });
}

function updateRoomActionSetting(roomId, buttonIndex, key, value) {
  const nextNotifications = getResolvedRoomNotifications(roomId).map((notification) => ({
    ...notification,
  }));
  const existingIndex = nextNotifications.findIndex(
    (notification) => Number(notification.deviceButton) === Number(buttonIndex),
  );
  const currentNotification =
    existingIndex >= 0
      ? nextNotifications[existingIndex]
      : {
          id: `${roomId}-action-${Number(buttonIndex) + 1}`,
          label: "",
          message: "",
          color: getSelectedRoom()?.color || "#2563eb",
          icon: "",
          deviceButton: Number(buttonIndex),
        };
  const normalizedValue = String(value ?? "").trim().slice(0, key === "icon" ? 20 : 21);
  const nextNotification = {
    ...currentNotification,
    [key]: normalizedValue,
  };

  if (key === "label" || key === "message") {
    nextNotification.label = normalizedValue;
    nextNotification.message = normalizedValue;
  }

  if (existingIndex >= 0) {
    nextNotifications.splice(existingIndex, 1, nextNotification);
  } else {
    nextNotifications.push(nextNotification);
  }

  roomActionSettings = {
    ...roomActionSettings,
    [roomId]: normalizeRoomActionSettings({
      [roomId]: nextNotifications,
    })[roomId] || [],
  };
}

function clearRoomActionSetting(roomId, buttonIndex) {
  roomActionSettings = {
    ...roomActionSettings,
    [roomId]: getResolvedRoomNotifications(roomId).filter(
      (notification) => Number(notification.deviceButton) !== Number(buttonIndex),
    ),
  };
}

function normalizeRoomAlertVolumes(volumes) {
  if (!volumes || typeof volumes !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(volumes).map(([roomId, value]) => {
      const parsed = Number(value);
      return [roomId, Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 100];
    }),
  );
}

function getRoomAlertVolume(roomId) {
  const parsed = Number(roomAlertVolumes?.[roomId]);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 100;
}

function normalizeRoomAlertSounds(sounds) {
  if (!sounds || typeof sounds !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(sounds).map(([roomId, value]) => [roomId, getValidatedRoomAlertSound(value)]),
  );
}

function getValidatedRoomAlertSound(value) {
  const normalized = String(value || DEFAULT_ROOM_ALERT_SOUND).trim().toLowerCase();
  const mapped = LEGACY_ROOM_ALERT_SOUND_ALIASES[normalized] || normalized;

  if (ROOM_ALERT_SOUND_OPTIONS.some((option) => option.value === normalized)) {
    return normalized;
  }

  if (ROOM_ALERT_SOUND_OPTIONS.some((option) => option.value === mapped)) {
    return mapped;
  }

  return DEFAULT_ROOM_ALERT_SOUND;
}

function getRoomAlertSound(roomId) {
  const localSound = roomAlertSounds?.[roomId];

  if (localSound) {
    return getValidatedRoomAlertSound(localSound);
  }

  const roomSound = configState?.rooms?.find((room) => room.id === roomId)?.receptionSound?.sound;
  return getValidatedRoomAlertSound(roomSound);
}

function resolveRoomAlertSoundUrl(sound) {
  const normalizedSound = getValidatedRoomAlertSound(sound);
  const fileName =
    ROOM_ALERT_SOUND_FILE_MAP[normalizedSound] ||
    ROOM_ALERT_SOUND_FILE_MAP[DEFAULT_ROOM_ALERT_SOUND];

  return new URL(`../assets/sounds/${fileName}`, import.meta.url).href;
}

async function playLocalAlertSound(options = {}) {
  const sound = getValidatedRoomAlertSound(options.sound);
  const parsedVolume = Number(options.volume);
  const volume = Number.isFinite(parsedVolume)
    ? Math.max(0, Math.min(100, Math.round(parsedVolume)))
    : 80;

  if (volume <= 0) {
    return;
  }

  const audio = new Audio(resolveRoomAlertSoundUrl(sound));
  const cleanup = () => {
    activeLocalAlertPlayers.delete(audio);
    audio.src = "";
  };

  activeLocalAlertPlayers.add(audio);
  audio.preload = "auto";
  audio.volume = volume / 100;
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });

  try {
    await audio.play();
  } catch (error) {
    cleanup();
    throw error;
  }
}

function renderRoomAlertSoundOptions(selectedValue) {
  return ROOM_ALERT_SOUND_OPTIONS
    .map(
      (option) => `
        <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>
          ${escapeHtml(option.label)}
        </option>
      `,
    )
    .join("");
}

function updateMessageVolumeLabel(value) {
  if (messageVolumeValue) {
    messageVolumeValue.textContent = `${value}%`;
  }
}

function normalizeMessageVolume(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 80;
}

function renderMessageSoundSettings() {
  if (messageSoundInput) {
    messageSoundInput.innerHTML = renderRoomAlertSoundOptions(messageSound);
  }

  if (messageVolumeInput) {
    messageVolumeInput.value = String(messageVolume);
  }

  updateMessageVolumeLabel(messageVolume);
}

function renderRoomAlertSoundControl() {
  if (!settingsRoomAlertSoundControls) {
    return;
  }

  const room = getSelectedRoom();

  if (!room?.id) {
    settingsRoomAlertSoundControls.innerHTML = '<p class="message-group-empty">Choose a room to configure alert sounds.</p>';
    return;
  }

  const volume = getRoomAlertVolume(room.id);
  const sound = getRoomAlertSound(room.id);

  settingsRoomAlertSoundControls.innerHTML = `
    <label class="selected-room-sound-field">
      <span class="selected-room-control-label">Select Sound</span>
      <div class="selected-room-sound-row">
        <select class="selected-room-sound-select" data-room-sound-id="${escapeHtml(room.id)}">
          ${renderRoomAlertSoundOptions(sound)}
        </select>
        <button
          class="selected-room-sound-test"
          data-room-sound-test-id="${escapeHtml(room.id)}"
          type="button"
          aria-label="Play sound"
          title="Play sound"
        >
          Play
        </button>
      </div>
    </label>
    <label class="selected-room-slider-field">
      <span class="selected-room-control-label">Volume</span>
      <div class="selected-room-slider-row">
        <input
          class="selected-room-volume-slider"
          data-room-volume-id="${escapeHtml(room.id)}"
          type="range"
          min="0"
          max="100"
          step="1"
          value="${volume}"
        />
        <span class="selected-room-volume-value" id="selected-room-volume-value">${volume}%</span>
      </div>
    </label>
  `;
}

function renderRoomActionRows(roomId) {
  return getRoomActionEditorRows(roomId)
    .map(
      (action) => `
        <div class="room-action-row">
          <div class="room-action-button-index">Button ${action.buttonIndex + 1}</div>
          <label class="room-action-field room-action-icon-field">
            <span class="selected-room-control-label">Button Label</span>
            <input
              class="room-action-input room-action-icon-input"
              data-room-action-id="${escapeHtml(roomId)}"
              data-room-action-button="${action.buttonIndex}"
              data-room-action-key="icon"
              type="text"
              maxlength="20"
              value="${escapeHtml(action.icon)}"
            />
          </label>
          <label class="room-action-field room-action-message-field">
            <span class="selected-room-control-label">Message</span>
            <input
              class="room-action-input"
              data-room-action-id="${escapeHtml(roomId)}"
              data-room-action-button="${action.buttonIndex}"
              data-room-action-key="message"
              type="text"
              maxlength="21"
              value="${escapeHtml(action.message)}"
            />
          </label>
          <button
            class="room-action-clear-button"
            data-room-action-clear-id="${escapeHtml(roomId)}"
            data-room-action-clear-button="${action.buttonIndex}"
            type="button"
            aria-label="Clear action"
            title="Clear action"
          >
            Clear
          </button>
        </div>
      `,
    )
    .join("");
}

function renderSelectedRoomVolumeControl() {
  if (!selectedRoomVolume) {
    return;
  }

  const room = getSelectedRoom();

  if (!room?.id) {
    selectedRoomVolume.innerHTML = "";
    selectedRoomVolume.dataset.roomSettingsId = "";
    selectedRoomVolume.classList.add("hidden");
    return;
  }

  const leftAuxSetting = getRoomLeftAuxSetting(room.id);
  const rightAuxSetting = getRoomRightAuxSetting(room.id);
  selectedRoomVolume.dataset.roomSettingsId = room.id;
  selectedRoomVolume.classList.remove("hidden");
  selectedRoomVolume.innerHTML = `
    <div class="selected-room-volume-card push-down">
      <div class="selected-room-action-card">
        <span class="selected-room-control-label">Actions</span>
        <div class="room-action-list">
          ${renderRoomActionRows(room.id)}
        </div>
      </div>
      <div class="selected-room-button-style-card">
        <div class="selected-room-volume-header">
          <div class="selected-room-volume-title">Button Style</div>
        </div>
        <div class="selected-room-button-appearance-grid">
          ${renderButtonAppearanceSummary(room.id, "default")}
          ${renderButtonAppearanceSummary(room.id, "active")}
        </div>
      </div>
      <div class="selected-room-additional-buttons-card">
        <div class="selected-room-volume-header">
          <div class="selected-room-volume-title">Additional Buttons</div>
        </div>
        <div class="selected-room-left-aux-card push-down">
          <div class="selected-room-left-aux-header">
            <span class="selected-room-control-label">Neo Left Button</span>
          </div>
          <div class="selected-room-left-aux-grid">
            <div class="selected-room-toggle-field">
              <span class="selected-room-control-label">Enable</span>
              <label class="checkbox-toggle">
                <input
                  data-room-left-aux-id="${escapeHtml(room.id)}"
                  data-left-aux-key="enabled"
                  type="checkbox"
                  ${leftAuxSetting.enabled ? "checked" : ""}
                />
                <span>Enabled</span>
              </label>
            </div>
            <label class="selected-room-mode-field">
              <span class="selected-room-control-label">Mode</span>
              <select
                class="selected-room-mode-select"
                data-room-left-aux-id="${escapeHtml(room.id)}"
                data-left-aux-key="mode"
              >
                <option value="party" ${leftAuxSetting.mode === "party" ? "selected" : ""}>Party Mode</option>
                <option value="cancel" ${leftAuxSetting.mode === "cancel" ? "selected" : ""}>Cancel Alert</option>
              </select>
            </label>
          </div>
        </div>
        <div class="selected-room-left-aux-card">
          <div class="selected-room-left-aux-header">
            <span class="selected-room-control-label">Neo Right Button</span>
          </div>
          <div class="selected-room-left-aux-grid">
            <div class="selected-room-toggle-field">
              <span class="selected-room-control-label">Enable</span>
              <label class="checkbox-toggle">
                <input
                  data-room-right-aux-id="${escapeHtml(room.id)}"
                  data-right-aux-key="enabled"
                  type="checkbox"
                  ${rightAuxSetting.enabled ? "checked" : ""}
                />
                <span>Enabled</span>
              </label>
            </div>
            <label class="selected-room-mode-field">
              <span class="selected-room-control-label">Mode</span>
              <select
                class="selected-room-mode-select"
                data-room-right-aux-id="${escapeHtml(room.id)}"
                data-right-aux-key="action"
              >
                <option value="none" ${rightAuxSetting.action === "none" ? "selected" : ""}>No action assigned</option>
                <option value="lucy" ${rightAuxSetting.action === "lucy" ? "selected" : ""}>Lucy Mode</option>
                <option value="cancel" ${rightAuxSetting.action === "cancel" ? "selected" : ""}>Cancel Alert</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

function lockRoomSettingsRefresh(durationMs = ROOM_SETTINGS_INTERACTION_LOCK_MS) {
  roomSettingsInteractionLockUntil = Math.max(
    roomSettingsInteractionLockUntil,
    Date.now() + durationMs,
  );
}

function isRoomSettingsRefreshLocked() {
  if (!selectedRoomVolume && !messageGroupList) {
    return false;
  }

  const activeElement = document.activeElement;
  const hasFocusedRoomSetting =
    activeElement instanceof Element && (
      selectedRoomVolume?.contains(activeElement) ||
      messageGroupList?.contains(activeElement)
    );

  return hasFocusedRoomSetting || Date.now() < roomSettingsInteractionLockUntil;
}

function shouldRenderSelectedRoomVolumeControl() {
  if (!selectedRoomVolume) {
    return false;
  }

  const selectedRoomId = getSelectedRoom()?.id || "";
  const renderedRoomId = String(selectedRoomVolume.dataset.roomSettingsId || "").trim();

  if (!selectedRoomVolume.innerHTML.trim()) {
    return true;
  }

  if (selectedRoomId !== renderedRoomId) {
    return true;
  }

  return !isRoomSettingsRefreshLocked();
}

function renderMessageGroupSettings() {
  if (!messageGroupList) {
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  messageGroupList.dataset.roomSettingsId = currentRoomId || "";
  const availableRooms = (configState?.rooms || []).filter((room) => room.id !== currentRoomId);
  const groups = currentRoomId ? roomMessageGroups?.[currentRoomId] || [] : [];

  if (!currentRoomId) {
    messageGroupList.innerHTML = '<p class="message-group-empty">Choose a room to configure message groups.</p>';
    return;
  }

  if (availableRooms.length === 0) {
    messageGroupList.innerHTML = '<p class="message-group-empty">No other rooms are available for group messaging yet.</p>';
    return;
  }

  if (groups.length === 0) {
    messageGroupList.innerHTML = '<p class="message-group-empty">No custom groups yet. Add one to start a shared room conversation.</p>';
    return;
  }

  messageGroupList.innerHTML = groups
    .map((group) => `
      <div class="message-group-card" data-message-group-id="${escapeHtml(group.id)}">
        <div class="message-group-head">
          <input
            class="message-group-name-input"
            data-message-group-name-id="${escapeHtml(group.id)}"
            type="text"
            maxlength="${MAX_MESSAGE_GROUP_NAME_LENGTH}"
            value="${escapeHtml(group.name)}"
            placeholder="Group name"
          />
          <button
            class="message-group-delete-button"
            data-delete-message-group-id="${escapeHtml(group.id)}"
            type="button"
            aria-label="Delete group"
            title="Delete group"
          >
            Delete
          </button>
        </div>
        <div class="message-group-rooms">
          ${availableRooms.map((room) => `
            <label class="message-group-room-chip">
              <input
                data-message-group-room-id="${escapeHtml(group.id)}"
                data-target-room-id="${escapeHtml(room.id)}"
                type="checkbox"
                ${group.roomIds.includes(room.id) ? "checked" : ""}
              />
              <span>${escapeHtml(room.name)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `)
    .join("");
}

function shouldRenderMessageGroupSettings() {
  if (!messageGroupList) {
    return false;
  }

  const selectedRoomId = getCurrentMessageRoomId();
  const renderedRoomId = String(messageGroupList.dataset.roomSettingsId || "").trim();

  if (!messageGroupList.innerHTML.trim()) {
    return true;
  }

  if (selectedRoomId !== renderedRoomId) {
    return true;
  }

  return !isRoomSettingsRefreshLocked();
}

function updateRoomMessageGroup(currentRoomId, groupId, updater) {
  const groups = roomMessageGroups?.[currentRoomId] || [];
  roomMessageGroups = {
    ...roomMessageGroups,
    [currentRoomId]: groups
      .map((group, index) => normalizeRoomMessageGroup(
        typeof updater === "function" && group.id === groupId ? updater(group) : group,
        index,
        currentRoomId,
      ))
      .filter(Boolean),
  };
}

function addRoomMessageGroup(currentRoomId) {
  const availableRooms = (configState?.rooms || []).filter((room) => room.id !== currentRoomId);
  const firstTargetRoom = availableRooms[0]?.id || "";

  if (!currentRoomId || !firstTargetRoom) {
    return;
  }

  roomMessageGroups = {
    ...roomMessageGroups,
    [currentRoomId]: [
      ...(roomMessageGroups?.[currentRoomId] || []),
      {
        id: `group-${createRandomId()}`,
        name: "New group",
        roomIds: [firstTargetRoom],
      },
    ],
  };
}

async function persistMessageGroups() {
  panelSettings = {
    ...(panelSettings || {}),
    roomMessageGroups: { ...roomMessageGroups },
  };

  await window.pipPanel.updateSettings({
    roomMessageGroups,
  }).catch(() => {});
}

async function persistPinnedMessageThreads() {
  panelSettings = {
    ...(panelSettings || {}),
    roomPinnedMessageThreads: { ...roomPinnedMessageThreads },
  };

  await window.pipPanel.updateSettings({
    roomPinnedMessageThreads,
  }).catch(() => {});
}

async function persistRoomSettings() {
  panelSettings = {
    ...(panelSettings || {}),
    roomAlertVolumes: { ...roomAlertVolumes },
    roomAlertSounds: { ...roomAlertSounds },
    roomButtonAppearances: { ...roomButtonAppearances },
    roomLeftAuxSettings: { ...roomLeftAuxSettings },
    roomRightAuxSettings: { ...roomRightAuxSettings },
    roomActionSettings: { ...roomActionSettings },
    roomMessageGroups: { ...roomMessageGroups },
    roomPinnedMessageThreads: { ...roomPinnedMessageThreads },
  };

  await window.pipPanel.updateSettings({
    roomAlertVolumes,
    roomAlertSounds,
    roomButtonAppearances,
    roomLeftAuxSettings,
    roomRightAuxSettings,
    roomActionSettings,
    roomMessageGroups,
    roomPinnedMessageThreads,
  }).catch(() => {});
}

async function persistMessageSoundSettings() {
  panelSettings = {
    ...(panelSettings || {}),
    messageSound,
    messageVolume,
  };

  await window.pipPanel.updateSettings({
    messageSound,
    messageVolume,
  }).catch(() => {});
}

function getServerAccessKeyValue() {
  return serverAccessKeyInput?.value.trim() || "";
}

function buildAuthenticatedHeaders() {
  const accessKey = getServerAccessKeyValue();

  return accessKey
    ? {
        "x-pip-key": accessKey,
      }
    : {};
}

function buildAuthenticatedWebSocketUrl(url) {
  const nextUrl = new URL(url);
  const accessKey = getServerAccessKeyValue();

  if (accessKey) {
    nextUrl.searchParams.set("accessKey", accessKey);
  } else {
    nextUrl.searchParams.delete("accessKey");
  }

  return nextUrl.toString();
}

async function playRoomAlertSound(roomId) {
  const sound = getRoomAlertSound(roomId);
  const volume = getRoomAlertVolume(roomId);

  if (volume <= 0) {
    return;
  }

  try {
    await playLocalAlertSound({
      sound,
      volume,
    });
  } catch {
    await window.pipPanel.playAlertSound?.({
      sound,
      volume,
    }).catch(() => {});
  }
}

async function playRoomMessageSound() {
  if (messageVolume <= 0) {
    return;
  }

  try {
    await playLocalAlertSound({
      sound: messageSound,
      volume: messageVolume,
    });
  } catch {
    await window.pipPanel.playAlertSound?.({
      sound: messageSound,
      volume: messageVolume,
    }).catch(() => {});
  }
}

function getResolvedPanelButtons() {
  const room = getSelectedRoom();
  const roomNotifications = getResolvedRoomNotifications(room?.id);
  const buttons = Array.from({ length: ROOM_ACTION_BUTTON_COUNT }, (_value, index) => {
    const notification = roomNotifications.find(
      (item) => Number(item.deviceButton) === index,
    );

    if (!notification) {
      return {
        id: "",
        label: "",
        icon: "",
        disabled: true,
      };
    }

    return {
      id: notification.id,
      label: notification.label || notification.message,
      buttonLabel: notification.icon || notification.label || String(index + 1),
      message: notification.message,
      color: notification.color || room?.color || "#2563eb",
      isActive: activeNotificationsByButtonId.has(notification.id),
      disabled: false,
    };
  });

  return buttons;
}

function renderButton(button, options = {}) {
  const interactive = options.interactive !== false;
  const buttonAppearance = getButtonAppearanceSettings();

  const attributes = [
    `class="panel-button ${button.isActive ? "is-active" : ""} ${interactive ? "" : "is-preview"}"`,
    `style="
        --button-background: ${escapeHtml(buttonAppearance.defaultBackground)};
        --button-active-background: ${escapeHtml(buttonAppearance.activeBackground)};
        --button-text: ${escapeHtml(buttonAppearance.defaultText)};
        --button-active-text: ${escapeHtml(buttonAppearance.activeText)};
      "`,
    'type="button"',
  ];

  if (interactive && !button.disabled) {
    attributes.push(`data-button-id="${escapeHtml(button.id)}"`);
  }

  if (button.disabled) {
    attributes.push("disabled");
  }

  return `
    <button
      ${attributes.join("\n      ")}
    >
      <span class="panel-button-text">${escapeHtml(button.buttonLabel || button.label || "")}</span>
    </button>
  `;
}

async function sendChatMessage() {
  const currentRoom = getCurrentMessageRoom();
  const text = String(messageComposeInput?.value || "").trim();
  const activeThreadKey = activeMessageThreadKey || "reception";

  if (!currentRoom?.id || !text || !activeThreadKey) {
    return;
  }

  const availableRoomIds = (configState?.rooms || [])
    .map((room) => room.id)
    .filter((roomId) => roomId !== currentRoom.id);
  const activeGroupThread = activeThreadKey.startsWith("group:")
    ? getMessageGroupThread(activeThreadKey, currentRoom.id)
    : null;
  const sendToReception = activeThreadKey === "reception" || activeThreadKey === "all";
  const recipientRoomIds =
    activeGroupThread
      ? (activeGroupThread.participantRoomIds || []).filter((roomId) => roomId !== currentRoom.id)
      : activeThreadKey === "all"
      ? availableRoomIds
      : sendToReception
        ? []
        : [activeThreadKey];

  const response = await fetch(`${serverInput.value.trim()}/chat/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthenticatedHeaders(),
    },
    body: JSON.stringify({
      senderType: "room",
      senderRoomId: currentRoom.id,
      recipientRoomIds,
      sendToReception,
      messageGroupKey: activeGroupThread?.messageGroupKey || "",
      messageGroupLabel: activeGroupThread?.label || "",
      messageGroupParticipantRoomIds: activeGroupThread?.participantRoomIds || [],
      text,
      source: "client-panel",
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result?.error || `Message send failed: ${response.status}`);
  }

  if (messageComposeInput) {
    messageComposeInput.value = "";
  }
  await fetchChatMessages().catch(() => {});
  updateMessageComposerHeight();
  syncMessageComposerState();
  setPanelDisplayMode(panelDisplayMode, { persist: false }).catch(() => {});
}

async function sendPanelAction(buttonId) {
  const room = getSelectedRoom();
  const roomId = room?.id || roomSelect.value;
  const action = getResolvedRoomNotifications(roomId).find((item) => item.id === buttonId);

  if (!room || !action) {
    return;
  }

  const existingNotification = activeNotificationsByButtonId.get(buttonId);

  if (existingNotification?.notificationId) {
    await cancelPanelAction(buttonId, existingNotification.notificationId);
    return;
  }

  const serverUrl = serverInput.value.trim();
  const payload = buildPanelNotificationPayload(room, action, {
    notificationId: createRandomId(),
    deviceId: panelDeviceId,
    deviceButton: Number.isFinite(Number(action.deviceButton)) ? Number(action.deviceButton) : null,
    source: "client-panel",
  });

  const response = await fetch(`${serverUrl}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthenticatedHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Send failed: ${response.status}`);
  }

  activeNotificationsByButtonId.set(buttonId, {
    notificationId: payload.notificationId,
    actionId: action.id,
  });
  renderButtons();
}

async function cancelPanelAction(buttonId, notificationId) {
  const serverUrl = serverInput.value.trim();
  const response = await fetch(`${serverUrl}/cancel-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthenticatedHeaders(),
    },
    body: JSON.stringify({
      notificationId,
      deviceId: panelDeviceId,
      roomId: roomSelect.value,
      source: "client-panel",
    }),
  });

  if (!response.ok) {
    throw new Error(`Cancel failed: ${response.status}`);
  }

  activeNotificationsByButtonId.delete(buttonId);
  renderButtons();
}

async function clearStartupNotifications() {
  const serverUrl = serverInput.value.trim();
  const response = await fetch(`${serverUrl}/clear-notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthenticatedHeaders(),
    },
    body: JSON.stringify({
      source: "client-panel-startup",
      deviceId: panelDeviceId,
      roomId: roomSelect.value,
    }),
  });

  if (!response.ok) {
    throw new Error(`Clear failed: ${response.status}`);
  }

  clearAllPanelNotifications();
}

function startConfigRefresh() {
  if (configRefreshTimer) {
    window.clearInterval(configRefreshTimer);
  }

  configRefreshTimer = window.setInterval(async () => {
    const wasUninitialized = !configState;

    try {
      await fetchConfig({ skipRenderIfUnchanged: true });
      await fetchChatMessages().catch(() => {});

      if (wasUninitialized) {
        await window.pipPanel.updateSettings({
          serverUrl: serverInput.value.trim(),
          serverAccessKey: getServerAccessKeyValue(),
          roomId: roomSelect.value,
        }).catch(() => {});
        saveState();
      }

      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connectSocket();
      }
    } catch {
      // Keep the existing UI state if the reception app is briefly unavailable.
    }
  }, CONFIG_REFRESH_MS);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatMessageTime(timestamp) {
  const sentAt = new Date(timestamp);

  if (Number.isNaN(sentAt.getTime())) {
    return "";
  }

  return `${sentAt.getHours()}:${String(sentAt.getMinutes()).padStart(2, "0")}`;
}

function buildPanelNotificationPayload(room, action, overrides = {}) {
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

function handleNotificationResolution(payload) {
  if (payload?.roomId && String(payload.roomId) !== roomSelect.value) {
    return;
  }

  const notificationId = String(payload?.notificationId || "").trim();

  if (notificationId) {
    for (const [buttonId, trackedNotification] of activeNotificationsByButtonId.entries()) {
      if (trackedNotification?.notificationId === notificationId) {
        activeNotificationsByButtonId.delete(buttonId);
        renderButtons();
        return;
      }
    }
  }

  const actionId = String(payload?.actionType || "").trim();

  if (!actionId) {
    return;
  }

  if (activeNotificationsByButtonId.has(actionId)) {
    activeNotificationsByButtonId.delete(actionId);
    renderButtons();
  }
}

function handleNotificationActivated(payload) {
  if (payload?.roomId && String(payload.roomId) !== roomSelect.value) {
    return;
  }

  const actionId = String(payload?.actionType || "").trim();

  if (!actionId) {
    return;
  }

  activeNotificationsByButtonId.set(actionId, {
    notificationId: String(payload?.notificationId || "").trim(),
    actionId,
  });
  renderButtons();
}

function clearAllPanelNotifications() {
  activeNotificationsByButtonId.clear();
  renderButtons();
}

function showReceptionPingBanner() {
  if (!receptionPingBanner) {
    return;
  }
  receptionPingBanner.classList.remove("hidden");
}

function hideReceptionPingBanner() {
  if (!receptionPingBanner) {
    return;
  }
  receptionPingBanner.classList.add("hidden");
}

function showReceptionOfflineBanner() {
  if (!receptionOfflineBanner) {
    return;
  }
  receptionOfflineBanner.classList.remove("hidden");
}

function hideReceptionOfflineBanner() {
  if (!receptionOfflineBanner) {
    return;
  }
  receptionOfflineBanner.classList.add("hidden");
}

function clearReceptionPing() {
  if (!receptionPingBanner || receptionPingBanner.classList.contains("hidden")) {
    return;
  }

  hideReceptionPingBanner();

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "room:pingCleared",
      roomId: roomSelect.value,
      deviceId: panelDeviceId,
    }),
  );
}

function getSelectedRoom() {
  return configState?.rooms?.find((item) => item.id === roomSelect.value) || null;
}

function applyPersistedSettings(nextSettings = {}) {
  panelSettings = nextSettings || {};
  renderSelectedDeviceRole(panelSettings);
  messageSound = getValidatedRoomAlertSound(panelSettings.messageSound);
  messageVolume = normalizeMessageVolume(panelSettings.messageVolume);
  roomAlertVolumes = normalizeRoomAlertVolumes(panelSettings.roomAlertVolumes);
  roomAlertSounds = normalizeRoomAlertSounds(panelSettings.roomAlertSounds);
  roomButtonAppearances = normalizeRoomButtonAppearances(panelSettings.roomButtonAppearances);
  roomLeftAuxSettings = normalizeRoomLeftAuxSettings(panelSettings.roomLeftAuxSettings);
  roomRightAuxSettings = normalizeRoomRightAuxSettings(panelSettings.roomRightAuxSettings);
  roomActionSettings = normalizeRoomActionSettings(panelSettings.roomActionSettings);
  roomMessageGroups = normalizeRoomMessageGroups(panelSettings.roomMessageGroups);
  roomPinnedMessageThreads = normalizeRoomPinnedMessageThreads(panelSettings.roomPinnedMessageThreads);
  panelDisplayMode = normalizePanelDisplayMode(panelSettings.panelDisplayMode);
  renderMessageSoundSettings();
}

async function init() {
  document.body.dataset.windowView = windowView;

  if (isRoleWindow) {
    rolePanel?.classList.remove("hidden");
    const roleState = await window.pipPanel.getRoleState?.().catch(() => null);
    renderRoleView(roleState || {});
    return;
  }

  const savedState = loadSavedState();
  const persistedSettings = await window.pipPanel.getSettings().catch(() => null);

  applyPersistedSettings(persistedSettings || {});
  panelDeviceId = getPanelDeviceId();
  setPanelView("waiting");
  setServerPanelVisibility(isSettingsWindow);
  setActiveSettingsSidebarLink("settings-general");
  await setPanelDisplayMode(panelDisplayMode, { persist: false, resize: false });
  setPanelDisplayModeMenuVisibility(false);
  setMessageThreadDrawerVisibility(false);
  const hardwareStatus = await window.pipPanel.getHardwareStatus?.().catch(() => null);
  preferredRoomId =
    persistedSettings?.roomId ||
    savedState.roomId ||
    window.pipPanel.defaultRoomId;
  serverInput.value =
    persistedSettings?.serverUrl ||
    savedState.serverUrl ||
    window.pipPanel.defaultServerUrl;
  if (serverAccessKeyInput) {
    serverAccessKeyInput.value =
      persistedSettings?.serverAccessKey ||
      window.pipPanel.defaultServerAccessKey ||
      "";
  }
  syncSetupFieldsFromSettings();
  setStatus("Connecting", "pending");
  updateHardwareStatus(hardwareStatus);
  if (launchAtStartupInput) {
    launchAtStartupInput.checked = Boolean(persistedSettings?.launchAtStartup);
  }
  if (showPanelAtStartupInput) {
    showPanelAtStartupInput.checked = Boolean(persistedSettings?.showPanelAtStartup);
  }
  if (alwaysOnTopInput) {
    alwaysOnTopInput.checked = Boolean(persistedSettings?.alwaysOnTop);
  }
  window.pipPanel.onHardwareStatus?.((nextStatus) => {
    updateHardwareStatus(nextStatus);
  });
  window.pipPanel.onSettingsUpdated?.((nextSettings) => {
    applyPersistedSettings(nextSettings || {});
    setPanelDisplayMode(panelDisplayMode, { persist: false, resize: false }).catch(() => {});
    renderButtons();
    renderSelectedRoomVolumeControl();
    renderButtonAppearancePicker();
    renderMessageGroupSettings();
    renderRoomAlertSoundControl();
    renderMessagingUi();
  });
  startConfigRefresh();

  try {
    await fetchConfig();
    renderButtons();
    renderSelectedRoomVolumeControl();
    renderMessagingUi();
    await fetchChatMessages().catch(() => {});
    await clearStartupNotifications();
    connectSocket();
    await window.pipPanel.updateSettings({
      serverUrl: serverInput.value.trim(),
      serverAccessKey: getServerAccessKeyValue(),
      roomId: roomSelect.value,
    }).catch(() => {});
    saveState();
  } catch (error) {
    setStatus("Offline", "offline");

    if (isSettingsWindow) {
      // In the settings window, show the settings panel with an inline connection error
      // rather than switching to the waiting/offline view.
      setPanelView("panel");
      setServerPanelVisibility(true);
      setActiveSettingsSidebarLink("settings-connection");
    } else {
      showReceptionOfflineBanner();
      setPanelView("waiting");
      syncSetupFieldsFromSettings();
      setSetupFeedback(
        getServerAccessKeyValue()
          ? "Reception is offline or the pairing details are incorrect."
          : "Enter the pairing code from Reception settings, then connect.",
        "error",
      );
    }
  }
}

quickActionGrid?.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("[data-button-id]");

  if (!button) {
    return;
  }

  try {
    await sendPanelAction(button.dataset.buttonId);
  } catch (error) {
    setStatus("Offline", "offline");
  }
});

quickActionsToggleButton?.addEventListener("click", async () => {
  setPanelDisplayModeMenuVisibility(!isPanelDisplayModeMenuVisible);
});

panelDisplayModeMenu?.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const option = target.closest("[data-panel-mode]");

  if (!option) {
    return;
  }

  const nextMode = String(option.getAttribute("data-panel-mode") || "").trim();

  if (!nextMode) {
    return;
  }

  await setPanelDisplayMode(nextMode);
  setPanelDisplayModeMenuVisibility(false);
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target;

  if (!(target instanceof Node) || !isPanelDisplayModeMenuVisible) {
    return;
  }

  if (
    panelDisplayModeMenu?.contains(target) ||
    quickActionsToggleButton?.contains?.(target)
  ) {
    return;
  }

  setPanelDisplayModeMenuVisibility(false);
});

document.addEventListener("pointerdown", () => {
  clearReceptionPing();
});

messageCollapseButton?.addEventListener("click", () => {
  setPanelDisplayMode("buttons").catch((error) => {
    console.error(error);
  });
});

messageComposeInput?.addEventListener("input", () => {
  updateMessageComposerHeight();
  syncMessageComposerState();
  setPanelDisplayMode(panelDisplayMode, { persist: false }).catch(() => {});
});

messageComposeInput?.addEventListener("scroll", updateMessageComposerScrollbar, { passive: true });

messageList?.addEventListener("scroll", updateMessageScrollbar, { passive: true });

// Right-click context menu for editing and deleting messages
messageList?.addEventListener("contextmenu", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const messageItem = target.closest(".message-item[data-message-id]");

  if (!messageItem) {
    return;
  }

  const messageId = String(messageItem.getAttribute("data-message-id") || "").trim();

  if (!messageId) {
    return;
  }

  // Only allow editing/deleting outgoing messages (sent by this room)
  if (!messageItem.classList.contains("is-outgoing")) {
    return;
  }

  event.preventDefault();

  // Remove any existing context menu
  document.querySelector(".message-context-menu")?.remove();

  const menu = document.createElement("div");
  menu.className = "message-context-menu";
  menu.innerHTML = `
    <button class="message-context-menu-item" data-action="edit-message" data-message-id="${escapeHtml(messageId)}" type="button">
      Edit message
    </button>
    <button class="message-context-menu-item is-danger" data-action="delete-message" data-message-id="${escapeHtml(messageId)}" type="button">
      Delete for everyone
    </button>
  `;

  // Position the menu near the click
  const messageListRect = messageList.getBoundingClientRect();
  const menuX = Math.min(event.clientX, messageListRect.right - 180);
  const menuY = Math.min(event.clientY, messageListRect.bottom - 60);

  menu.style.left = `${menuX}px`;
  menu.style.top = `${menuY}px`;
  document.body.appendChild(menu);

  // Handle edit click
  menu.querySelector("[data-action='edit-message']")?.addEventListener("click", () => {
    const id = String(menu.querySelector("[data-action='edit-message']")?.getAttribute("data-message-id") || "").trim();
    menu.remove();
    if (id) {
      startInlineEdit(id);
    }
  });

  // Handle delete click
  menu.querySelector("[data-action='delete-message']")?.addEventListener("click", async () => {
    const id = String(menu.querySelector("[data-action='delete-message']")?.getAttribute("data-message-id") || "").trim();
    if (id) {
      const serverUrl = serverInput.value.trim();
      if (serverUrl) {
        try {
          await fetch(`${serverUrl}/chat/messages`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              ...buildAuthenticatedHeaders(),
            },
            body: JSON.stringify({ messageId: id }),
          });
          await fetchChatMessages().catch(() => {});
        } catch {
          // Ignore delete errors
        }
      }
    }
    menu.remove();
  });
});

function startInlineEdit(messageId) {
  const messageItem = messageList?.querySelector(`.message-item[data-message-id="${escapeHtml(messageId)}"]`);

  if (!messageItem) {
    return;
  }

  const bubbleBody = messageItem.querySelector(".message-bubble-body");

  if (!bubbleBody) {
    return;
  }

  const textElement = bubbleBody.querySelector(".message-item-text");

  if (!textElement) {
    return;
  }

  const currentText = String(textElement.textContent || "").replace(/\s*\(edited\)\s*$/, "").trim();

  // Set flag to prevent re-render from destroying the edit UI
  isEditingMessage = true;

  // Add editing class to expand the bubble to max-width
  messageItem.classList.add("is-editing");

  // Replace the bubble content with an edit textarea
  bubbleBody.innerHTML = `
    <textarea class="message-edit-input" maxlength="500" rows="2">${escapeHtml(currentText)}</textarea>
    <div class="message-edit-actions">
      <button class="message-edit-save" type="button">Save</button>
      <button class="message-edit-cancel" type="button">Cancel</button>
    </div>
  `;

  const textarea = bubbleBody.querySelector(".message-edit-input");
  const saveButton = bubbleBody.querySelector(".message-edit-save");
  const cancelButton = bubbleBody.querySelector(".message-edit-cancel");

  if (!textarea || !saveButton || !cancelButton) {
    isEditingMessage = false;
    return;
  }

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const finishEdit = async (saved) => {
    // Clear the editing flag so re-renders can proceed
    isEditingMessage = false;

    if (saved) {
      const newText = String(textarea.value || "").trim();
      if (newText && newText !== currentText) {
        const serverUrl = serverInput.value.trim();
        if (serverUrl) {
          try {
            await fetch(`${serverUrl}/chat/messages`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...buildAuthenticatedHeaders(),
              },
              body: JSON.stringify({ messageId, text: newText }),
            });
            await fetchChatMessages().catch(() => {});
          } catch {
            // Ignore edit errors
          }
        }
      }
    }
    // Restore the original bubble content (will be re-rendered via chat:update)
    if (!saved) {
      bubbleBody.innerHTML = `
        <p class="message-item-text">${escapeHtml(currentText)}</p>
        <span class="message-item-time">${messageItem.querySelector(".message-item-time")?.textContent || ""}</span>
      `;
    }
  };

  saveButton.addEventListener("click", () => finishEdit(true));
  cancelButton.addEventListener("click", () => finishEdit(false));

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      finishEdit(true);
    }
    if (e.key === "Escape") {
      finishEdit(false);
    }
  });
}

// Dismiss context menu on click outside
document.body.addEventListener("click", (event) => {
  const contextMenu = document.querySelector(".message-context-menu");
  if (contextMenu && !(event.target instanceof HTMLElement && event.target.closest(".message-context-menu"))) {
    contextMenu.remove();
  }
});

messageSendButton?.addEventListener("click", async () => {
  try {
    await sendChatMessage();
  } catch (error) {
    console.error(error);
  }
});

roomSelect.addEventListener("change", async () => {
  preferredRoomId = roomSelect.value;
  if (setupRoomSelect) {
    setupRoomSelect.value = roomSelect.value;
  }
  activeMessageThreadKey = "";
  unreadMessageThreadKeys.clear();
  setMessageThreadDrawerVisibility(false);
  clearAllPanelNotifications();
  renderButtons();
  renderSelectedRoomVolumeControl();
  renderMessageGroupSettings();
  renderRoomAlertSoundControl();
  renderMessagingUi();
  await window.pipPanel.updateSettings({
    serverUrl: serverInput.value.trim(),
    serverAccessKey: getServerAccessKeyValue(),
    roomId: roomSelect.value,
  }).catch(() => {});
  saveState();
  sendIdentify();
});

setupRoomSelect?.addEventListener("change", () => {
  if (!setupRoomSelect.value) {
    return;
  }

  roomSelect.value = setupRoomSelect.value;
  preferredRoomId = setupRoomSelect.value;
  setSetupFeedback("Room selected. Click Connect to save it.", "success");
});

serverToggleButton?.addEventListener("click", () => {
  window.pipPanel.openSettingsWindow?.().catch(() => {});
});

panelMinimizeButton?.addEventListener("click", () => {
  window.pipPanel.minimizeWindow?.().catch(() => {});
});

panelExpandButton?.addEventListener("click", async () => {
  try {
    const result = await window.pipPanel.expandWindow?.();
    if (result?.isExpanded !== undefined) {
      panelExpandButton.classList.toggle("is-active", result.isExpanded);
      panelExpandButton.setAttribute(
        "aria-label",
        result.isExpanded ? "Collapse window" : "Expand window",
      );
      panelExpandButton.title = result.isExpanded ? "Collapse window" : "Expand window";
    }
  } catch {
    // Ignore expand errors
  }
});

panelCloseButton?.addEventListener("click", () => {
  if (isSettingsWindow) {
    window.close();
    return;
  }

  window.pipPanel.hideWindow?.().catch(() => {});
});

roleOptionList?.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const option = target.closest("[data-runtime-role]");

  if (!option) {
    return;
  }

  const runtimeRole = String(option.getAttribute("data-runtime-role") || "").trim().toLowerCase();

  if (!runtimeRole) {
    return;
  }

  const nextRoleState = await window.pipPanel.updateSettings({
    runtimeRole,
    runtimeRoleConfirmed: true,
  }).catch(() => null);

  renderRoleView(nextRoleState || { runtimeRole });
  await window.pipPanel.closeRoleWindow?.().catch(() => {});
});

roleCloseButton?.addEventListener("click", () => {
  window.pipPanel.closeRoleWindow?.().catch(() => {});
});

openRoleWindowButton?.addEventListener("click", () => {
  window.pipPanel.openRoleWindow?.().catch(() => {});
});

launchAtStartupInput?.addEventListener("change", async () => {
  await window.pipPanel.updateSettings({
    launchAtStartup: launchAtStartupInput.checked,
  }).catch(() => {});
});

showPanelAtStartupInput?.addEventListener("change", async () => {
  await window.pipPanel.updateSettings({
    showPanelAtStartup: showPanelAtStartupInput.checked,
  }).catch(() => {});
});

alwaysOnTopInput?.addEventListener("change", async () => {
  await window.pipPanel.updateSettings({
    alwaysOnTop: alwaysOnTopInput.checked,
  }).catch(() => {});
});

messageVolumeInput?.addEventListener("input", () => {
  const nextVolume = normalizeMessageVolume(messageVolumeInput.value);
  messageVolume = nextVolume;
  updateMessageVolumeLabel(nextVolume);
});

messageVolumeInput?.addEventListener("change", async () => {
  const nextVolume = normalizeMessageVolume(messageVolumeInput.value);
  messageVolume = nextVolume;
  updateMessageVolumeLabel(nextVolume);
  await persistMessageSoundSettings();
});

messageSoundInput?.addEventListener("change", async () => {
  messageSound = getValidatedRoomAlertSound(messageSoundInput.value);
  await persistMessageSoundSettings();
});

messageSoundTestButton?.addEventListener("click", async () => {
  await playRoomMessageSound().catch(() => {});
});

settingsSidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    setActiveSettingsSidebarLink(String(link.getAttribute("data-settings-section-link") || ""));
  });
});

addMessageGroupButton?.addEventListener("click", async () => {
  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId) {
    return;
  }

  addRoomMessageGroup(currentRoomId);
  renderMessageGroupSettings();
  renderMessagingUi();
  await persistMessageGroups();
});

messageGroupList?.addEventListener("input", (event) => {
  lockRoomSettingsRefresh();
  const target = event.target;

  if (!(target instanceof HTMLInputElement) || !target.dataset.messageGroupNameId) {
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  const groupId = String(target.dataset.messageGroupNameId || "").trim();

  if (!currentRoomId || !groupId) {
    return;
  }

  updateRoomMessageGroup(currentRoomId, groupId, (group) => ({
    ...group,
    name: target.value,
  }));
  renderMessagingUi();
});

messageGroupList?.addEventListener("change", async (event) => {
  lockRoomSettingsRefresh();
  const target = event.target;

  if (target instanceof HTMLInputElement && target.dataset.messageGroupNameId) {
    await persistMessageGroups();
    return;
  }

  if (!(target instanceof HTMLInputElement) || !target.dataset.messageGroupRoomId) {
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  const groupId = String(target.dataset.messageGroupRoomId || "").trim();
  const targetRoomId = String(target.dataset.targetRoomId || "").trim();

  if (!currentRoomId || !groupId || !targetRoomId) {
    return;
  }

  updateRoomMessageGroup(currentRoomId, groupId, (group) => ({
    ...group,
    roomIds: target.checked
      ? [...new Set([...(group.roomIds || []), targetRoomId])]
      : (group.roomIds || []).filter((roomId) => roomId !== targetRoomId),
  }));
  renderMessageGroupSettings();
  renderMessagingUi();
  await persistMessageGroups();
});

messageGroupList?.addEventListener("click", async (event) => {
  lockRoomSettingsRefresh();
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const deleteButton = target.closest("[data-delete-message-group-id]");

  if (!deleteButton) {
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  const groupId = String(deleteButton.getAttribute("data-delete-message-group-id") || "").trim();

  if (!currentRoomId || !groupId) {
    return;
  }

  roomMessageGroups = {
    ...roomMessageGroups,
    [currentRoomId]: (roomMessageGroups?.[currentRoomId] || []).filter((group) => group.id !== groupId),
  };
  renderMessageGroupSettings();
  renderMessagingUi();
  await persistMessageGroups();
});

messageGroupList?.addEventListener("focusin", () => {
  lockRoomSettingsRefresh();
});

messageGroupList?.addEventListener("pointerdown", () => {
  lockRoomSettingsRefresh();
});

selectedRoomVolume?.addEventListener("input", (event) => {
  lockRoomSettingsRefresh();
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.roomAppearanceId && target.dataset.appearanceKey) {
    const roomId = String(target.dataset.roomAppearanceId || "").trim();
    const appearanceKey = String(target.dataset.appearanceKey || "").trim();

    if (!roomId || !appearanceKey) {
      return;
    }

    updateRoomButtonAppearance(roomId, appearanceKey, target.value);
    renderButtons();
    return;
  }

  if (target.dataset.roomActionId && target.dataset.roomActionKey) {
    const roomId = String(target.dataset.roomActionId || "").trim();
    const roomActionKey = String(target.dataset.roomActionKey || "").trim();
    const buttonIndex = Number(target.dataset.roomActionButton);

    if (!roomId || !roomActionKey || !Number.isFinite(buttonIndex)) {
      return;
    }

    updateRoomActionSetting(roomId, buttonIndex, roomActionKey, target.value);

    if (roomId === getSelectedRoom()?.id) {
      renderButtons();
    }
    return;
  }

  const roomId = String(target.dataset.roomVolumeId || "").trim();

  if (!roomId) {
    return;
  }

  const nextVolume = Math.max(0, Math.min(100, Number(target.value) || 0));
  roomAlertVolumes = {
    ...roomAlertVolumes,
    [roomId]: nextVolume,
  };

  const volumeLabel = document.querySelector("#selected-room-volume-value");
  if (volumeLabel) {
    volumeLabel.textContent = `${nextVolume}%`;
  }
});

selectedRoomVolume?.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const styleTrigger = target.closest("[data-room-appearance-id][data-button-style-mode]");

  if (styleTrigger instanceof HTMLElement) {
    lockRoomSettingsRefresh();
    openButtonAppearancePicker(
      String(styleTrigger.dataset.roomAppearanceId || "").trim(),
      String(styleTrigger.dataset.buttonStyleMode || "").trim(),
    );
    return;
  }

  if (target.closest("[data-button-style-close]")) {
    closeButtonAppearancePicker();
    return;
  }

  if (!buttonAppearancePickerState) {
    return;
  }

  const backgroundSwatch = target.closest("[data-button-style-background]");

  if (backgroundSwatch instanceof HTMLElement) {
    const modeKeys = getButtonAppearanceModeKeys(buttonAppearancePickerState.mode);
    const swatchType = String(backgroundSwatch.dataset.buttonStyleSwatchType || "").trim();
    const swatchIndex = Number(backgroundSwatch.dataset.buttonStyleSwatchIndex);
    const indexedBackground = swatchType === "gradient"
      ? BUTTON_GRADIENT_SWATCHES[swatchIndex]
      : swatchType === "solid"
        ? BUTTON_SOLID_SWATCHES[swatchIndex]
        : "";
    updateRoomButtonAppearance(
      buttonAppearancePickerState.roomId,
      modeKeys.background,
      indexedBackground || String(backgroundSwatch.dataset.buttonStyleBackground || "").trim(),
    );
    renderButtons();
    renderSelectedRoomVolumeControl();
    renderButtonAppearancePicker();
    persistRoomSettings().catch(() => {});
    return;
  }

  const textOption = target.closest("[data-button-style-text]");

  if (textOption instanceof HTMLElement) {
    const modeKeys = getButtonAppearanceModeKeys(buttonAppearancePickerState.mode);
    updateRoomButtonAppearance(
      buttonAppearancePickerState.roomId,
      modeKeys.text,
      String(textOption.dataset.buttonStyleText || "").trim(),
    );
    renderButtons();
    renderSelectedRoomVolumeControl();
    renderButtonAppearancePicker();
    persistRoomSettings().catch(() => {});
  }
});

selectedRoomVolume?.addEventListener("change", async (event) => {
  lockRoomSettingsRefresh();
  const target = event.target;

  if (target instanceof HTMLInputElement && target.dataset.roomVolumeId) {
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.roomAppearanceId) {
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.roomActionId) {
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.roomLeftAuxId) {
    const roomId = String(target.dataset.roomLeftAuxId || "").trim();
    const leftAuxKey = String(target.dataset.leftAuxKey || "").trim();

    if (!roomId || !leftAuxKey) {
      return;
    }

    updateRoomLeftAuxSetting(roomId, leftAuxKey, target.checked);
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.roomRightAuxId) {
    const roomId = String(target.dataset.roomRightAuxId || "").trim();
    const rightAuxKey = String(target.dataset.rightAuxKey || "").trim();

    if (!roomId || !rightAuxKey) {
      return;
    }

    updateRoomRightAuxSetting(roomId, rightAuxKey, target.checked);
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLSelectElement && target.dataset.roomSoundId) {
    const roomId = String(target.dataset.roomSoundId || "").trim();

    if (!roomId) {
      return;
    }

    roomAlertSounds = {
      ...roomAlertSounds,
      [roomId]: getValidatedRoomAlertSound(target.value),
    };
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLSelectElement && target.dataset.roomLeftAuxId) {
    const roomId = String(target.dataset.roomLeftAuxId || "").trim();
    const leftAuxKey = String(target.dataset.leftAuxKey || "").trim();

    if (!roomId || !leftAuxKey) {
      return;
    }

    updateRoomLeftAuxSetting(roomId, leftAuxKey, target.value);
    await persistRoomSettings();
    return;
  }

  if (target instanceof HTMLSelectElement && target.dataset.roomRightAuxId) {
    const roomId = String(target.dataset.roomRightAuxId || "").trim();
    const rightAuxKey = String(target.dataset.rightAuxKey || "").trim();

    if (!roomId || !rightAuxKey) {
      return;
    }

    updateRoomRightAuxSetting(roomId, rightAuxKey, target.value);
    await persistRoomSettings();
  }
});

selectedRoomVolume?.addEventListener("focusin", () => {
  lockRoomSettingsRefresh();
});

selectedRoomVolume?.addEventListener("pointerdown", () => {
  lockRoomSettingsRefresh();
});

document.body.addEventListener("dragstart", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const dragItem = target.closest("[data-message-thread-drag-source][data-message-thread-key]");

  if (!dragItem) {
    return;
  }

  draggedMessageThreadKey = String(dragItem.getAttribute("data-message-thread-key") || "").trim();
  draggedMessageThreadSource = String(dragItem.getAttribute("data-message-thread-drag-source") || "").trim();

  if (!draggedMessageThreadKey || !draggedMessageThreadSource) {
    return;
  }

  dragItem.classList.add("is-dragging");
  event.dataTransfer?.setData("text/plain", draggedMessageThreadKey);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
});

document.body.addEventListener("dragend", () => {
  document.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => {
    item.classList.remove("is-dragging", "is-drag-over");
  });
  draggedMessageThreadKey = "";
  draggedMessageThreadSource = "";
});

document.body.addEventListener("dragover", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement) || !draggedMessageThreadKey) {
    return;
  }

  const dropItem = target.closest("[data-message-thread-drag-source][data-message-thread-key]");

  if (
    !dropItem ||
    String(dropItem.getAttribute("data-message-thread-drag-source") || "") !== draggedMessageThreadSource
  ) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dropItem.classList.add("is-drag-over");
});

document.body.addEventListener("dragleave", (event) => {
  const target = event.target;

  if (target instanceof HTMLElement) {
    target.closest("[data-message-thread-drag-source]")?.classList.remove("is-drag-over");
  }
});

document.body.addEventListener("drop", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement) || !draggedMessageThreadKey) {
    return;
  }

  const dropItem = target.closest("[data-message-thread-drag-source][data-message-thread-key]");
  const targetThreadKey = String(dropItem?.getAttribute("data-message-thread-key") || "").trim();
  const targetSource = String(dropItem?.getAttribute("data-message-thread-drag-source") || "").trim();
  const currentRoomId = getCurrentMessageRoomId();

  if (!currentRoomId || !targetThreadKey || targetSource !== draggedMessageThreadSource) {
    return;
  }

  event.preventDefault();

  if (draggedMessageThreadSource === "threads") {
    roomMessageThreadOrder = {
      ...roomMessageThreadOrder,
      [currentRoomId]: reorderIds(getCurrentRoomMessageThreadOrder(), draggedMessageThreadKey, targetThreadKey),
    };
    saveRoomMessageThreadOrder();
    renderMessagingUi();
  }
});

messageThreadList?.addEventListener("scroll", updateMessageThreadScrollButtons, { passive: true });

const messageThreadScrollObserver = new ResizeObserver(() => {
  requestAnimationFrame(updateMessageThreadScrollButtons);
});

if (messageThreadList) {
  messageThreadScrollObserver.observe(messageThreadList);
}

window.addEventListener("resize", () => {
  requestAnimationFrame(updateMessageThreadScrollButtons);
});

messageThreadScrollLeft?.addEventListener("click", () => {
  if (!messageThreadList) {
    return;
  }

  const scrollAmount = Math.max(120, messageThreadList.clientWidth * 0.5);
  messageThreadList.scrollBy({ left: -scrollAmount, behavior: "smooth" });
});

messageThreadScrollRight?.addEventListener("click", () => {
  if (!messageThreadList) {
    return;
  }

  const scrollAmount = Math.max(120, messageThreadList.clientWidth * 0.5);
  messageThreadList.scrollBy({ left: scrollAmount, behavior: "smooth" });
});

messageThreadList?.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const threadChip = target.closest("[data-message-thread-key]");

  if (!threadChip) {
    return;
  }

  const threadKey = String(threadChip.getAttribute("data-message-thread-key") || "").trim();

  if (!threadKey) {
    return;
  }

  selectMessageThread(threadKey);
});

selectedRoomVolume?.addEventListener("click", async (event) => {
  lockRoomSettingsRefresh();
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const playButton = target.closest("[data-room-sound-test-id]");

  if (playButton) {
    const roomId = String(playButton.getAttribute("data-room-sound-test-id") || "").trim();

    if (!roomId) {
      return;
    }

    await playRoomAlertSound(roomId).catch(() => {});
    return;
  }

  const clearButton = target.closest("[data-room-action-clear-id]");

  if (!clearButton) {
    return;
  }

  const roomId = String(clearButton.getAttribute("data-room-action-clear-id") || "").trim();
  const buttonIndex = Number(clearButton.getAttribute("data-room-action-clear-button"));

  if (!roomId || !Number.isFinite(buttonIndex)) {
    return;
  }

  clearRoomActionSetting(roomId, buttonIndex);
  renderButtons();
  renderSelectedRoomVolumeControl();
  await persistRoomSettings();
});

serverInput.addEventListener("change", async () => {
  if (setupServerInput) {
    setupServerInput.value = serverInput.value.trim();
  }
  await window.pipPanel.updateSettings({
    serverUrl: serverInput.value.trim(),
    serverAccessKey: getServerAccessKeyValue(),
    roomId: roomSelect.value,
  }).catch(() => {});
  saveState();
  setStatus("Connecting", "pending");
  try {
    await fetchConfig();
    connectSocket();
    startConfigRefresh();
    saveState();
  } catch (error) {
    setStatus("Offline", "offline");
    if (!configState && !manualPanelReveal) {
      setPanelView("waiting");
    }
  }
});

serverAccessKeyInput?.addEventListener("change", async () => {
  if (setupServerAccessKeyInput) {
    setupServerAccessKeyInput.value = serverAccessKeyInput.value.trim();
  }
  await window.pipPanel.updateSettings({
    serverUrl: serverInput.value.trim(),
    serverAccessKey: getServerAccessKeyValue(),
    roomId: roomSelect.value,
  }).catch(() => {});
  setStatus("Connecting", "pending");
  try {
    await fetchConfig();
    connectSocket();
    startConfigRefresh();
  } catch (error) {
    setStatus("Offline", "offline");
    if (!configState && !manualPanelReveal) {
      setPanelView("waiting");
    }
  }
});

setupConnectButton?.addEventListener("click", () => {
  completeRoomSetup();
});

setupSettingsButton?.addEventListener("click", () => {
  manualPanelReveal = true;
  setPanelView("panel");
  setServerPanelVisibility(true);
  setActiveSettingsSidebarLink("settings-connection");
});

setupServerInput?.addEventListener("change", () => {
  syncSettingsFromSetupFields();
  setSetupFeedback("Click Connect to check Reception.", "muted");
});

setupServerAccessKeyInput?.addEventListener("change", () => {
  syncSettingsFromSetupFields();
  setSetupFeedback("Click Connect to check Reception.", "muted");
});

setupServerInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    completeRoomSetup();
  }
});

setupServerAccessKeyInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    completeRoomSetup();
  }
});

window.addEventListener("focus", async () => {
  try {
    await fetchConfig();
    await fetchChatMessages();
  } catch {
    // Ignore refresh failures on focus and keep the current panel state visible.
  }
});

init();
