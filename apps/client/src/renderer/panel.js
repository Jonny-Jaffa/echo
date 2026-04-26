const roomSelect = document.querySelector("#room-select");
const serverInput = document.querySelector("#server-input");
const serverAccessKeyInput = document.querySelector("#server-access-key-input");
const serverPanel = document.querySelector("#server-panel");
const serverToggleButton = document.querySelector("#server-toggle-button");
const panelMinimizeButton = document.querySelector("#panel-minimize-button");
const panelCloseButton = document.querySelector("#panel-close-button");
const quickActionsToggleButton = document.querySelector("#quick-actions-toggle-button");
const panelDisplayModeMenu = document.querySelector("#panel-display-mode-menu");
const quickActions = document.querySelector("#quick-actions");
const quickActionGrid = document.querySelector("#quick-action-grid");
const panelSectionDivider = document.querySelector("#panel-section-divider");
const messageThreadDrawerButton = document.querySelector("#message-thread-drawer-button");
const messageThreadDrawer = document.querySelector("#message-thread-drawer");
const messageThreadDrawerClose = document.querySelector("#message-thread-drawer-close");
const messageThreadDrawerList = document.querySelector("#message-thread-drawer-list");
const messageShell = document.querySelector(".message-shell");
const messageThreadList = document.querySelector("#message-thread-list");
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
const showPanelAtStartupInput = document.querySelector("#show-panel-at-startup-input");
const alwaysOnTopInput = document.querySelector("#always-on-top-input");
const selectedRoomVolume = document.querySelector("#selected-room-volume");
const requestedWindowView = String(new URLSearchParams(window.location.search).get("view") || "").trim().toLowerCase();
const windowView = requestedWindowView === "settings"
  ? "settings"
  : requestedWindowView === "role"
    ? "role"
    : "main";
const isSettingsWindow = windowView === "settings";
const isRoleWindow = windowView === "role";

const STORAGE_KEY = "patient-ping-panel";
const PANEL_DEVICE_ID_STORAGE_KEY = "patient-ping-panel-device-id";
const CONFIG_REFRESH_MS = 3000;
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
let roomActionSectionsExpanded = {};
let preferredRoomId = "";
let roomSettingsInteractionLockUntil = 0;
let chatMessages = [];
let activeMessageThreadKey = "";
const unreadMessageThreadKeys = new Set();
let areQuickActionsVisible = false;
let isMessageThreadDrawerVisible = false;
let panelDisplayMode = "messages";
let isPanelDisplayModeMenuVisible = false;
const activeNotificationsByButtonId = new Map();
const activeLocalAlertPlayers = new Set();

function formatRuntimeRoleLabel(runtimeRole) {
  return runtimeRole === "reception" ? "Reception" : "Room";
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
      : `This Echo Surgery build supports ${formatRuntimeRoleLabel(nativeRuntimeRole)} only. Switch back to ${formatRuntimeRoleLabel(nativeRuntimeRole)} to continue using this install.`;
  }
}

function setPanelView(view) {
  document.body.dataset.view = view;
}

function loadSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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

function normalizeButtonAppearance(buttonAppearance, fallbackAppearance = {}) {
  return {
    defaultBackground: normalizeHexColor(
      buttonAppearance?.defaultBackground,
      fallbackAppearance.defaultBackground || DEFAULT_BUTTON_APPEARANCE.defaultBackground,
    ),
    defaultText: normalizeHexColor(
      buttonAppearance?.defaultText,
      fallbackAppearance.defaultText || DEFAULT_BUTTON_APPEARANCE.defaultText,
    ),
    activeBackground: normalizeHexColor(
      buttonAppearance?.activeBackground,
      fallbackAppearance.activeBackground || DEFAULT_BUTTON_APPEARANCE.activeBackground,
    ),
    activeText: normalizeHexColor(
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

function getPanelDeviceId() {
  const savedDeviceId = localStorage.getItem(PANEL_DEVICE_ID_STORAGE_KEY);

  if (savedDeviceId) {
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

function setMessageThreadDrawerVisibility(visible) {
  isMessageThreadDrawerVisible = !isSettingsWindow && Boolean(visible);
  messageThreadDrawer?.classList.toggle("hidden", !isMessageThreadDrawerVisible);

  if (messageThreadDrawerButton) {
    messageThreadDrawerButton.setAttribute("aria-expanded", isMessageThreadDrawerVisible ? "true" : "false");
    messageThreadDrawerButton.title = isMessageThreadDrawerVisible ? "Hide recipients" : "Recipients";
  }
}

function setPanelDisplayModeMenuVisibility(visible) {
  isPanelDisplayModeMenuVisible = !isSettingsWindow && Boolean(visible);
  panelDisplayModeMenu?.classList.toggle("hidden", !isPanelDisplayModeMenuVisible);

  if (quickActionsToggleButton) {
    quickActionsToggleButton.setAttribute("aria-expanded", isPanelDisplayModeMenuVisible ? "true" : "false");
  }
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
  panelSectionDivider?.classList.toggle("hidden", panelDisplayMode !== "both");
  messageShell?.classList.toggle("hidden", !showMessages);

  if (!showMessages) {
    setMessageThreadDrawerVisibility(false);
  }

  renderPanelDisplayModeMenu();

  if (!isSettingsWindow && resize) {
    await window.patientPingPanel
      .setSettingsExpanded?.({
        mode: panelDisplayMode,
      })
      .catch(() => {});
  }

  if (!isSettingsWindow && persist) {
    await window.patientPingPanel.updateSettings({
      panelDisplayMode,
    }).catch(() => {});
  }
}

async function fetchConfig() {
  const serverUrl = serverInput.value.trim();
  const selectedRoomId =
    preferredRoomId || roomSelect.value || window.patientPingPanel.defaultRoomId;
  const response = await fetch(`${serverUrl}/config`, {
    headers: buildAuthenticatedHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Unable to reach reception: ${response.status}`);
  }

  configState = await response.json();
  manualPanelReveal = false;
  setPanelView("panel");
  renderRooms(selectedRoomId);
  renderButtons();
  if (shouldRenderSelectedRoomVolumeControl()) {
    renderSelectedRoomVolumeControl();
  }
  if (shouldRenderMessageGroupSettings()) {
    renderMessageGroupSettings();
  }
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
        playRoomAlertSound(getCurrentMessageRoomId()).catch(() => {});
      }
      chatMessages = [...chatMessages, message.payload].slice(-200);
      renderMessagingUi();
    }
  });

  socket.addEventListener("close", () => {
    setStatus("Offline", "offline");
    if (!configState && !manualPanelReveal) {
      setPanelView("waiting");
    }
    reconnectTimer = window.setTimeout(() => {
      connectSocket();
    }, 2000);
  });

  socket.addEventListener("error", () => {
    setStatus("Offline", "offline");
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
    preferredRoomId || roomSelect.value || window.patientPingPanel.defaultRoomId;

  roomSelect.innerHTML = (configState.rooms || [])
    .map(
      (room) => `
        <option value="${escapeHtml(room.id)}" ${room.id === currentValue ? "selected" : ""}>
          ${escapeHtml(room.name)}
        </option>
      `,
    )
    .join("");

  if (![...roomSelect.options].some((option) => option.value === currentValue)) {
    roomSelect.value = configState.rooms?.[0]?.id || "";
  }

  preferredRoomId = roomSelect.value || currentValue || window.patientPingPanel.defaultRoomId;

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

    if (!messageGroupKey) {
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
  if (String(message?.senderType || "").trim() !== "room" || Boolean(message?.sendToReception)) {
    return false;
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
    return senderType === "reception" || Boolean(message?.sendToReception);
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
    { key: "reception", label: "Reception" },
    { key: "all", label: "All" },
    ...groupThreadsByKey.values(),
    ...rooms.map((room) => ({ key: room.id, label: room.name })),
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

function getPinnedMessageThreads(threads) {
  const currentRoomId = getCurrentMessageRoomId();
  const pinnedThreadKeys = currentRoomId ? getCurrentRoomPinnedThreadKeys() : [];
  const pinnedThreads = [];

  pinnedThreadKeys.forEach((threadKey) => {
    const thread = threads.find((item) => item.key === threadKey);

    if (thread && !pinnedThreads.some((item) => item.key === thread.key)) {
      pinnedThreads.push(thread);
    }
  });

  if (
    activeMessageThreadKey &&
    !pinnedThreads.some((thread) => thread.key === activeMessageThreadKey)
  ) {
    const activeThread = threads.find((thread) => thread.key === activeMessageThreadKey);

    if (activeThread) {
      pinnedThreads.push(activeThread);
    }
  }

  return pinnedThreads;
}

function renderMessageThreadDrawer(threads) {
  if (!messageThreadDrawerList) {
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  const pinnedThreadKeys = currentRoomId ? getCurrentRoomPinnedThreadKeys() : [];
  messageThreadDrawerList.innerHTML = threads
    .map((thread) => {
      const isPinned = pinnedThreadKeys.includes(thread.key);

      return `
        <div class="message-thread-drawer-item ${thread.key === activeMessageThreadKey ? "is-active" : ""}">
          <button
            class="message-thread-drawer-select"
            data-message-thread-key="${escapeHtml(thread.key)}"
            type="button"
          >
            <span>${escapeHtml(thread.label)}</span>
            ${thread.unread ? '<span class="message-thread-dot" aria-hidden="true"></span>' : ""}
          </button>
          <button
            class="message-thread-pin-button ${isPinned ? "is-pinned" : ""}"
            data-pin-message-thread-key="${escapeHtml(thread.key)}"
            type="button"
            aria-label="${isPinned ? "Unpin recipient" : "Pin recipient"}"
            title="${isPinned ? "Unpin" : "Pin"}"
          >
            Pin
          </button>
        </div>
      `;
    })
    .join("");
}

function renderMessageThreads() {
  if (!messageThreadList) {
    return;
  }

  const threads = ensureActiveMessageThread();
  const pinnedThreads = getPinnedMessageThreads(threads);
  messageThreadList.innerHTML = pinnedThreads
    .map((thread) => `
      <button
        class="message-thread-chip ${thread.key === activeMessageThreadKey ? "is-active" : ""}"
        data-message-thread-key="${escapeHtml(thread.key)}"
        type="button"
      >
        <span>${escapeHtml(thread.label)}</span>
        ${thread.unread ? '<span class="message-thread-dot" aria-hidden="true"></span>' : ""}
      </button>
    `)
    .join("");
  renderMessageThreadDrawer(threads);
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
}

function renderChatMessages() {
  if (!messageList) {
    return;
  }

  const messages = getVisibleChatMessages();

  if (messages.length === 0) {
    messageList.innerHTML = "";
    return;
  }

  const currentRoomId = getCurrentMessageRoomId();
  messageList.innerHTML = messages
    .map((message) => {
      const isOutgoing = String(message?.senderRoomId || "").trim() === currentRoomId;

      return `
        <article class="message-item ${isOutgoing ? "is-outgoing" : "is-incoming"}">
          <div class="message-bubble">
            <div class="message-bubble-body">
              <p class="message-item-text">${escapeHtml(message.text || "")}</p>
              <span class="message-item-time">${escapeHtml(formatMessageTime(message.timestamp))}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  updateMessageBubbleLayouts();
  messageList.scrollTop = messageList.scrollHeight;
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
  renderChatMessages();
  syncMessageComposerState();
  updateMessageComposerHeight();
}

function updateMessageComposerHeight() {
  if (!messageComposeInput) {
    return;
  }

  messageComposeInput.style.height = "auto";
  messageComposeInput.style.height = `${Math.min(messageComposeInput.scrollHeight, 144)}px`;
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
  const normalizedValue = String(value ?? "").trim().slice(0, key === "icon" ? 20 : 20);
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
              maxlength="20"
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

function isRoomActionSectionExpanded(roomId) {
  return Boolean(roomActionSectionsExpanded[String(roomId || "").trim()]);
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

  const volume = getRoomAlertVolume(room.id);
  const sound = getRoomAlertSound(room.id);
  const buttonAppearance = getRoomButtonAppearance(room.id);
  const leftAuxSetting = getRoomLeftAuxSetting(room.id);
  const rightAuxSetting = getRoomRightAuxSetting(room.id);
  const roomActionsExpanded = isRoomActionSectionExpanded(room.id);
  selectedRoomVolume.dataset.roomSettingsId = room.id;
  selectedRoomVolume.classList.remove("hidden");
  selectedRoomVolume.innerHTML = `
    <div class="selected-room-volume-card push-down">
      <div class="selected-room-volume-header">
        <div class="selected-room-volume-title">Room Settings</div>
      </div>
      <div class="selected-room-action-card">
        <button
          class="selected-room-action-toggle"
          data-room-actions-toggle-id="${escapeHtml(room.id)}"
          type="button"
          aria-expanded="${roomActionsExpanded ? "true" : "false"}"
        >
          <span class="selected-room-control-label">Room Actions</span>
        </button>
        <div class="room-action-list ${roomActionsExpanded ? "" : "hidden"}">
          ${renderRoomActionRows(room.id)}
        </div>
      </div>
      <div class="selected-room-volume-controls">
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
      </div>
      <div class="selected-room-button-appearance-grid push-down">
        <label class="selected-room-colour-field">
          <span class="selected-room-control-label">Button Colour</span>
          <input
            class="selected-room-colour-picker"
            data-room-appearance-id="${escapeHtml(room.id)}"
            data-appearance-key="defaultBackground"
            type="color"
            value="${escapeHtml(buttonAppearance.defaultBackground)}"
          />
        </label>
        <label class="selected-room-colour-field">
          <span class="selected-room-control-label">Text Colour</span>
          <input
            class="selected-room-colour-picker"
            data-room-appearance-id="${escapeHtml(room.id)}"
            data-appearance-key="defaultText"
            type="color"
            value="${escapeHtml(buttonAppearance.defaultText)}"
          />
        </label>
        <label class="selected-room-colour-field">
          <span class="selected-room-control-label">Active Button Colour</span>
          <input
            class="selected-room-colour-picker"
            data-room-appearance-id="${escapeHtml(room.id)}"
            data-appearance-key="activeBackground"
            type="color"
            value="${escapeHtml(buttonAppearance.activeBackground)}"
          />
        </label>
        <label class="selected-room-colour-field">
          <span class="selected-room-control-label">Active Text Colour</span>
          <input
            class="selected-room-colour-picker"
            data-room-appearance-id="${escapeHtml(room.id)}"
            data-appearance-key="activeText"
            type="color"
            value="${escapeHtml(buttonAppearance.activeText)}"
          />
        </label>
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

  await window.patientPingPanel.updateSettings({
    roomMessageGroups,
  }).catch(() => {});
}

async function persistPinnedMessageThreads() {
  panelSettings = {
    ...(panelSettings || {}),
    roomPinnedMessageThreads: { ...roomPinnedMessageThreads },
  };

  await window.patientPingPanel.updateSettings({
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

  await window.patientPingPanel.updateSettings({
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

function getServerAccessKeyValue() {
  return serverAccessKeyInput?.value.trim() || "";
}

function buildAuthenticatedHeaders() {
  const accessKey = getServerAccessKeyValue();

  return accessKey
    ? {
        "x-patient-ping-key": accessKey,
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
    await window.patientPingPanel.playAlertSound?.({
      sound,
      volume,
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
  const sendToReception = activeThreadKey === "reception";
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
      await fetchConfig();
      await fetchChatMessages().catch(() => {});

      if (wasUninitialized) {
        await window.patientPingPanel.updateSettings({
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

function getSelectedRoom() {
  return configState?.rooms?.find((item) => item.id === roomSelect.value) || null;
}

function applyPersistedSettings(nextSettings = {}) {
  panelSettings = nextSettings || {};
  roomAlertVolumes = normalizeRoomAlertVolumes(panelSettings.roomAlertVolumes);
  roomAlertSounds = normalizeRoomAlertSounds(panelSettings.roomAlertSounds);
  roomButtonAppearances = normalizeRoomButtonAppearances(panelSettings.roomButtonAppearances);
  roomLeftAuxSettings = normalizeRoomLeftAuxSettings(panelSettings.roomLeftAuxSettings);
  roomRightAuxSettings = normalizeRoomRightAuxSettings(panelSettings.roomRightAuxSettings);
  roomActionSettings = normalizeRoomActionSettings(panelSettings.roomActionSettings);
  roomMessageGroups = normalizeRoomMessageGroups(panelSettings.roomMessageGroups);
  roomPinnedMessageThreads = normalizeRoomPinnedMessageThreads(panelSettings.roomPinnedMessageThreads);
  panelDisplayMode = normalizePanelDisplayMode(panelSettings.panelDisplayMode);
}

async function init() {
  document.body.dataset.windowView = windowView;

  if (isRoleWindow) {
    rolePanel?.classList.remove("hidden");
    const roleState = await window.patientPingPanel.getRoleState?.().catch(() => null);
    renderRoleView(roleState || {});
    return;
  }

  const savedState = loadSavedState();
  const persistedSettings = await window.patientPingPanel.getSettings().catch(() => null);

  applyPersistedSettings(persistedSettings || {});
  panelDeviceId = getPanelDeviceId();
  setPanelView("waiting");
  setServerPanelVisibility(isSettingsWindow);
  await setPanelDisplayMode(panelDisplayMode, { persist: false, resize: false });
  setPanelDisplayModeMenuVisibility(false);
  setMessageThreadDrawerVisibility(false);
  const hardwareStatus = await window.patientPingPanel.getHardwareStatus?.().catch(() => null);
  preferredRoomId =
    persistedSettings?.roomId ||
    savedState.roomId ||
    window.patientPingPanel.defaultRoomId;
  serverInput.value =
    persistedSettings?.serverUrl ||
    savedState.serverUrl ||
    window.patientPingPanel.defaultServerUrl;
  if (serverAccessKeyInput) {
    serverAccessKeyInput.value =
      persistedSettings?.serverAccessKey ||
      window.patientPingPanel.defaultServerAccessKey ||
      "";
  }
  setStatus("Connecting", "pending");
  updateHardwareStatus(hardwareStatus);
  if (showPanelAtStartupInput) {
    showPanelAtStartupInput.checked = Boolean(persistedSettings?.showPanelAtStartup);
  }
  if (alwaysOnTopInput) {
    alwaysOnTopInput.checked = Boolean(persistedSettings?.alwaysOnTop);
  }
  window.patientPingPanel.onHardwareStatus?.((nextStatus) => {
    updateHardwareStatus(nextStatus);
  });
  window.patientPingPanel.onSettingsUpdated?.((nextSettings) => {
    applyPersistedSettings(nextSettings || {});
    setPanelDisplayMode(panelDisplayMode, { persist: false, resize: false }).catch(() => {});
    renderButtons();
    renderSelectedRoomVolumeControl();
    renderMessageGroupSettings();
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
    await window.patientPingPanel.updateSettings({
      serverUrl: serverInput.value.trim(),
      serverAccessKey: getServerAccessKeyValue(),
      roomId: roomSelect.value,
    }).catch(() => {});
    saveState();
  } catch (error) {
    setStatus("Offline", "offline");
    setPanelView("waiting");
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

messageThreadDrawerButton?.addEventListener("click", () => {
  setMessageThreadDrawerVisibility(!isMessageThreadDrawerVisible);
});

messageThreadDrawerClose?.addEventListener("click", () => {
  setMessageThreadDrawerVisibility(false);
});

messageComposeInput?.addEventListener("input", () => {
  updateMessageComposerHeight();
  syncMessageComposerState();
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
  activeMessageThreadKey = "";
  unreadMessageThreadKeys.clear();
  setMessageThreadDrawerVisibility(false);
  clearAllPanelNotifications();
  renderButtons();
  renderSelectedRoomVolumeControl();
  renderMessageGroupSettings();
  renderMessagingUi();
  await window.patientPingPanel.updateSettings({
    serverUrl: serverInput.value.trim(),
    serverAccessKey: getServerAccessKeyValue(),
    roomId: roomSelect.value,
  }).catch(() => {});
  saveState();
  sendIdentify();
});

serverToggleButton?.addEventListener("click", () => {
  window.patientPingPanel.openSettingsWindow?.().catch(() => {});
});

panelMinimizeButton?.addEventListener("click", () => {
  window.patientPingPanel.minimizeWindow?.().catch(() => {});
});

panelCloseButton?.addEventListener("click", () => {
  if (isSettingsWindow) {
    window.close();
    return;
  }

  window.patientPingPanel.hideWindow?.().catch(() => {});
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

  const nextRoleState = await window.patientPingPanel.updateSettings({
    runtimeRole,
    runtimeRoleConfirmed: true,
  }).catch(() => null);

  renderRoleView(nextRoleState || { runtimeRole });
  await window.patientPingPanel.closeRoleWindow?.().catch(() => {});
});

roleCloseButton?.addEventListener("click", () => {
  window.patientPingPanel.closeRoleWindow?.().catch(() => {});
});

openRoleWindowButton?.addEventListener("click", () => {
  window.patientPingPanel.openRoleWindow?.().catch(() => {});
});

showPanelAtStartupInput?.addEventListener("change", async () => {
  await window.patientPingPanel.updateSettings({
    showPanelAtStartup: showPanelAtStartupInput.checked,
  }).catch(() => {});
});

alwaysOnTopInput?.addEventListener("change", async () => {
  await window.patientPingPanel.updateSettings({
    alwaysOnTop: alwaysOnTopInput.checked,
  }).catch(() => {});
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

messageThreadDrawerList?.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const pinButton = target.closest("[data-pin-message-thread-key]");

  if (pinButton) {
    const currentRoomId = getCurrentMessageRoomId();
    const threadKey = String(pinButton.getAttribute("data-pin-message-thread-key") || "").trim();

    if (!currentRoomId || !threadKey) {
      return;
    }

    const existingPinnedThreadKeys = getCurrentRoomPinnedThreadKeys();
    const nextPinnedThreadKeys = existingPinnedThreadKeys.includes(threadKey)
      ? existingPinnedThreadKeys.filter((value) => value !== threadKey)
      : [...existingPinnedThreadKeys, threadKey];

    roomPinnedMessageThreads = {
      ...roomPinnedMessageThreads,
      [currentRoomId]: nextPinnedThreadKeys,
    };
    renderMessagingUi();
    await persistPinnedMessageThreads();
    return;
  }

  const threadButton = target.closest("[data-message-thread-key]");

  if (!threadButton) {
    return;
  }

  const threadKey = String(threadButton.getAttribute("data-message-thread-key") || "").trim();

  if (!threadKey) {
    return;
  }

  selectMessageThread(threadKey, { closeDrawer: true });
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

  const roomActionsToggle = target.closest("[data-room-actions-toggle-id]");

  if (roomActionsToggle) {
    const roomId = String(roomActionsToggle.getAttribute("data-room-actions-toggle-id") || "").trim();

    if (!roomId) {
      return;
    }

    roomActionSectionsExpanded = {
      ...roomActionSectionsExpanded,
      [roomId]: !isRoomActionSectionExpanded(roomId),
    };
    renderSelectedRoomVolumeControl();
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
  await window.patientPingPanel.updateSettings({
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
  await window.patientPingPanel.updateSettings({
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

function openPanelFromWaitingState() {
  manualPanelReveal = true;
  setPanelView("panel");
  setServerPanelVisibility(true);
}

waitingState?.addEventListener("click", () => {
  openPanelFromWaitingState();
});

waitingState?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openPanelFromWaitingState();
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
