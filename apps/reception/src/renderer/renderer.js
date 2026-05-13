import { renderEmojis } from "./emojis.js";
import { createEmojiPicker } from "./emoji-picker.js";

const card = document.querySelector("#notification-card");
const alertList = document.querySelector("#alert-list");
const rolePanel = document.querySelector("#role-panel");
const roleOptionList = document.querySelector("#role-option-list");
const roleCurrentLabel = document.querySelector("#role-current-label");
const roleCloseButton = document.querySelector("#role-close-button");
const openRoleWindowButton = document.querySelector("#open-role-window-button");
const adminPanel = document.querySelector("#admin-panel");
const gadgetPanel = document.querySelector(".gadget-panel");
const chatCard = document.querySelector("#chat-card");
const chatRecipientList = document.querySelector("#chat-recipient-list");
const chatRecipientDrawerButton = document.querySelector("#chat-recipient-drawer-button");
const chatRecipientDrawer = document.querySelector("#chat-recipient-drawer");
const chatRecipientDrawerClose = document.querySelector("#chat-recipient-drawer-close");
const chatRecipientDrawerList = document.querySelector("#chat-recipient-drawer-list");
const chatContextLabel = document.querySelector("#chat-context-label");
const chatAllRoomsButton = document.querySelector("#chat-all-rooms-button");
const chatAllHeaderButton = document.querySelector("#chat-all-header-button");
const chatCollapseButton = document.querySelector("#chat-collapse-button");
const chatMessageList = document.querySelector("#chat-message-list");
const chatComposeInput = document.querySelector("#chat-compose-input");
const chatSendButton = document.querySelector("#chat-send-button");
const chatEmojiButton = document.querySelector("#chat-emoji-button");
const chatEmojiPicker = document.querySelector("#chat-emoji-picker");
const settingsSidebarLinks = [...document.querySelectorAll("[data-settings-section-link]")];
const settingsTabSections = [...document.querySelectorAll("[data-settings-section]")];
const adminFeedback = document.querySelector("#admin-feedback");
const adminModeButton = document.querySelector("#admin-mode-button");
const compactModeButton = document.querySelector("#compact-mode-button");
const compactModeMenu = document.querySelector("#compact-mode-menu");
const compactModeOptions = document.querySelectorAll(".compact-mode-option");
const expandWindowButton = document.querySelector("#expand-window-button");
const expandAdminButton = document.querySelector("#expand-admin-button");
const minimizeWindowButton = document.querySelector("#minimize-window-button");
const minimizeAdminButton = document.querySelector("#minimize-admin-button");
const quitAppButton = document.querySelector("#quit-app-button");
const closeAdminButton = document.querySelector("#close-admin-button");
const saveConfigButton = document.querySelector("#save-config-button");
const addRoomButton = document.querySelector("#add-room-button");
const roomsEditor = document.querySelector("#rooms-editor");
const networkPortInput = document.querySelector("#network-port-input");
const authAccessKeyInput = document.querySelector("#auth-access-key-input");
const detectedServerAddressOutput = document.querySelector("#detected-server-address");
const selectedDeviceRoleLabel = document.querySelector("#selected-device-role-label");
const launchAtStartupInput = document.querySelector("#launch-at-startup-input");
const alwaysOnTopInput = document.querySelector("#always-on-top-input");
const popupPositionInput = document.querySelector("#popup-position-input");
const messageRetentionInput = document.querySelector("#message-retention-input");
const receptionPingMessageInput = document.querySelector("#reception-ping-message-input");
const audioNotificationSoundInput = document.querySelector("#audio-notification-sound-input");
const audioPlayTestButton = document.querySelector("#audio-play-test-button");
const audioMasterVolumeInput = document.querySelector("#audio-master-volume-input");
const audioMasterVolumeValue = document.querySelector("#audio-master-volume-value");
const audioMessageSoundInput = document.querySelector("#audio-message-sound-input");
const audioMessagePlayTestButton = document.querySelector("#audio-message-play-test-button");
const audioMessageVolumeInput = document.querySelector("#audio-message-volume-input");
const audioMessageVolumeValue = document.querySelector("#audio-message-volume-value");
const requestedWindowView = String(new URLSearchParams(window.location.search).get("view") || "").trim().toLowerCase();
const windowView = requestedWindowView === "settings"
  ? "settings"
  : requestedWindowView === "role"
    ? "role"
    : "main";
const isSettingsWindow = windowView === "settings";
const isRoleWindow = windowView === "role";
const DEFAULT_RECEPTION_SOUND = "notification_sound_01";
const LEGACY_RECEPTION_SOUND_ALIASES = {
  ping: "notification_sound_01",
  glass: "notification_sound_02",
  hero: "notification_sound_03",
  funk: "notification_sound_04",
  pop: "notification_sound_05",
};
const RECEPTION_SOUND_OPTIONS = Array.from({ length: 17 }, (_value, index) => {
  const soundNumber = String(index + 1).padStart(2, "0");
  return {
    value: `notification_sound_${soundNumber}`,
    label: `Sound ${soundNumber}`,
  };
});
const PINNED_CHAT_ROOMS_STORAGE_KEY = "pip-reception-pinned-chat-rooms";
const CHAT_ROOM_ORDER_STORAGE_KEY = "pip-reception-chat-room-order";
const RECEPTION_ALL_ROOMS_MESSAGE_GROUP_KEY = "reception-all-rooms";
const ROOM_SHORT_NAME_MAX_LENGTH = 7;
const NEUTRAL_MESSAGE_STRIP_BACKGROUND =
  "linear-gradient(90deg, rgba(135, 146, 147, 0.16), rgba(255, 255, 255, 0.86))";
const ROOM_COLOUR_PALETTE = [
  "#d0069a",
  "#e07c0b",
  "#0bc120",
  "#1997e6",
  "#7c3aed",
  "#dc2626",
  "#0f766e",
  "#2563eb",
  "#9333ea",
  "#be123c",
  "#047857",
  "#475569",
];

function normalizeReceptionPingMessage(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return normalized || "Reception";
}

let appState = null;
let draftConfig = null;
let lastReportedGadgetHeight = 0;
const pendingPingRooms = new Map();
const visibleAlertCountsByRoom = new Map();
const selectedChatRoomIds = new Set();
const unreadChatRoomIds = new Set();
let hasUnreadAllRoomsMessage = false;
let isAllChatRoomsThreadSelected = false;
let pinnedChatRoomIds = loadPinnedChatRoomIds();
let chatRoomOrderIds = loadChatRoomOrderIds();
let isChatRecipientDrawerVisible = false;
let isMessageSectionVisible = false;
let hasRestoredMessageSectionVisibility = false;
let draggedChatRoomId = "";
let draggedChatRoomSource = "";

function formatRuntimeRoleLabel(runtimeRole) {
  return runtimeRole === "room" ? "Room" : "Reception";
}

function getRoomShortLabel(room) {
  return String(room?.shortName || room?.name || "").trim();
}

function getDefaultRoomShortLabel(roomName = "", roomId = "", index = 0) {
  const labelSource = `${roomName || ""} ${roomId || ""}`.trim();
  const surgeryMatch = labelSource.match(/surg(?:ery)?[\s-]*(\d+)/i);

  if (surgeryMatch?.[1]) {
    return `S${surgeryMatch[1]}`.slice(0, ROOM_SHORT_NAME_MAX_LENGTH);
  }

  const roomMatch = labelSource.match(/room[\s-]*(\d+)/i);

  if (roomMatch?.[1]) {
    return `R${roomMatch[1]}`.slice(0, ROOM_SHORT_NAME_MAX_LENGTH);
  }

  const words = String(roomName || "").trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return words.map((word) => word[0]).join("").slice(0, ROOM_SHORT_NAME_MAX_LENGTH).toUpperCase();
  }

  return words[0]?.slice(0, 3) || `R${index + 1}`;
}

function getRoomById(roomId, state = appState) {
  return (state?.config?.rooms || []).find((room) => room.id === roomId) || null;
}

function getVisibleRooms(state = appState) {
  return (state?.config?.rooms || []).filter((room) => !room.hidden);
}

function canUseAllRoomsThread(state = appState) {
  return getVisibleRooms(state).length > 1;
}

function renderSelectedDeviceRole(roleState = appState?.app) {
  if (!selectedDeviceRoleLabel) {
    return;
  }

  selectedDeviceRoleLabel.textContent = `Selected role: ${formatRuntimeRoleLabel(roleState?.runtimeRole || "reception")}`;
}

function renderRoleView(roleState = {}) {
  if (!roleOptionList) {
    return;
  }

  const runtimeRole = String(roleState.runtimeRole || "reception").trim().toLowerCase();
  const nativeRuntimeRole = String(roleState.nativeRuntimeRole || "reception").trim().toLowerCase();
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
      : `This Pip Reception build supports ${formatRuntimeRoleLabel(nativeRuntimeRole)} only. Switch back to ${formatRuntimeRoleLabel(nativeRuntimeRole)} to continue using this install.`;
  }
}
function clearNotification() {
  alertList.innerHTML = "";
}

function loadPinnedChatRoomIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_CHAT_ROOMS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((roomId) => String(roomId || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function loadChatRoomOrderIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_ROOM_ORDER_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((roomId) => String(roomId || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function savePinnedChatRoomIds() {
  localStorage.setItem(
    PINNED_CHAT_ROOMS_STORAGE_KEY,
    JSON.stringify([...new Set(pinnedChatRoomIds)].filter(Boolean)),
  );
}

function saveChatRoomOrderIds() {
  localStorage.setItem(
    CHAT_ROOM_ORDER_STORAGE_KEY,
    JSON.stringify([...new Set(chatRoomOrderIds)].filter(Boolean)),
  );
}

function orderRoomsByIds(rooms = [], roomOrderIds = []) {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const orderedRooms = roomOrderIds
    .map((roomId) => roomMap.get(roomId))
    .filter(Boolean);
  const orderedRoomIds = new Set(orderedRooms.map((room) => room.id));

  return [
    ...orderedRooms,
    ...rooms.filter((room) => !orderedRoomIds.has(room.id)),
  ];
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

function setChatRecipientDrawerVisibility(isVisible) {
  isChatRecipientDrawerVisible = Boolean(isVisible);
  chatRecipientDrawer?.classList.toggle("hidden", !isChatRecipientDrawerVisible);
  chatRecipientDrawerButton?.setAttribute("aria-expanded", isChatRecipientDrawerVisible ? "true" : "false");
  if (chatRecipientDrawerButton) {
    chatRecipientDrawerButton.title = isChatRecipientDrawerVisible ? "Hide recipients" : "Recipients";
  }
}

function setActiveSettingsSection(sectionId = "reception-settings-general") {
  settingsSidebarLinks.forEach((link) => {
    const isActive = String(link.getAttribute("data-settings-section-link") || "") === sectionId;
    link.classList.toggle("is-active", isActive);
  });

  settingsTabSections.forEach((section) => {
    section.hidden = String(section.getAttribute("data-settings-section") || "") !== sectionId;
  });
}

function normalizeReceptionSound(value) {
  const normalized = String(value || DEFAULT_RECEPTION_SOUND).trim().toLowerCase();
  const mapped = LEGACY_RECEPTION_SOUND_ALIASES[normalized] || normalized;
  return RECEPTION_SOUND_OPTIONS.some((option) => option.value === mapped)
    ? mapped
    : DEFAULT_RECEPTION_SOUND;
}

function renderReceptionSoundOptions(selectedValue) {
  return RECEPTION_SOUND_OPTIONS
    .map(
      (option) => `
        <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>
          ${escapeHtml(option.label)}
        </option>
      `,
    )
    .join("");
}

function populateReceptionSoundSelectOptions(selectedValue) {
  if (!audioNotificationSoundInput) {
    return;
  }

  audioNotificationSoundInput.innerHTML = renderReceptionSoundOptions(
    normalizeReceptionSound(selectedValue),
  );
}

function populateMessageSoundSelectOptions(selectedValue) {
  if (!audioMessageSoundInput) {
    return;
  }

  audioMessageSoundInput.innerHTML = renderReceptionSoundOptions(
    normalizeReceptionSound(selectedValue),
  );
}

function shouldAnimateVisibleAlert(roomId, alertCount) {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedAlertCount = Math.max(0, Math.round(Number(alertCount) || 0));

  if (!normalizedRoomId) {
    return false;
  }

  const previousState = visibleAlertCountsByRoom.get(normalizedRoomId);
  const previousAlertCount =
    typeof previousState === "object" && previousState !== null
      ? Math.max(0, Math.round(Number(previousState.count) || 0))
      : Math.max(0, Math.round(Number(previousState) || 0));
  const shouldRepeatInitialAnimation =
    Boolean(previousState?.repeatInitialAnimation) &&
    previousAlertCount === normalizedAlertCount &&
    normalizedAlertCount > 0;
  const shouldStartInitialAnimation = previousAlertCount === 0 && normalizedAlertCount > 0;

  visibleAlertCountsByRoom.set(normalizedRoomId, {
    count: normalizedAlertCount,
    repeatInitialAnimation: shouldStartInitialAnimation,
  });

  return shouldStartInitialAnimation || shouldRepeatInitialAnimation;
}

function renderAlertList(state) {
  const alerts = [
    ...(state.activeNotification ? [state.activeNotification] : []),
    ...(state.queuedNotifications || []),
  ];
  const rooms = getVisibleRooms(state);

  if (state.config?.display?.compactMode) {
    alertList.innerHTML = renderCompactAlertList(state, rooms, alerts);
    return;
  }

  alertList.innerHTML = rooms
    .map((room) => {
      const roomAlerts = alerts.filter((alert) => alert.roomId === room.id);
      const roomAlertCount = roomAlerts.length;
      const alert = roomAlerts[0];
      const isActive = Boolean(
        alert &&
          state.activeNotification &&
          alert.notificationId === state.activeNotification.notificationId,
      );
      const shouldAnimateAlert = shouldAnimateVisibleAlert(room.id, roomAlertCount);
      const formattedTime = alert ? formatRelativeTime(alert.timestamp) : "";
      const rowMessage = alert ? alert.message : "";
      const isWaitingForReply = pendingPingRooms.has(room.id);

      return `
        <article
          class="alert-row ${alert ? (isActive ? "is-active" : "is-queued") : "is-idle"} ${shouldAnimateAlert ? "is-new-alert" : ""}"
          style="--row-accent: ${escapeHtml(room.color || "#0f766e")}"
        >
          <div class="alert-copy">
            <div class="alert-main-line">
              <h2 class="alert-room" title="${escapeHtml(room.name)}">${escapeHtml(getRoomShortLabel(room))}</h2>
              <p class="alert-message ${alert ? "" : "is-empty"}">${escapeHtml(rowMessage)}</p>
            </div>
          </div>
          <div class="action-row">
            <div class="action-slot age-slot">
              ${alert ? `<span class="meta alert-age">${formattedTime}</span>` : `<span class="meta alert-age is-placeholder">Just now</span>`}
            </div>
            <div class="action-slot icon-slot">
              ${
                alert
                  ? `<div class="confirm-cluster">
                      <span class="room-alert-count" aria-label="${roomAlertCount} ${roomAlertCount === 1 ? "message" : "messages"}">${roomAlertCount}</span>
                      <button class="dismiss icon-confirm" data-action="${isActive ? "dismiss" : "dismiss-row"}" data-notification-id="${escapeHtml(alert.notificationId)}" type="button" aria-label="Confirm" title="Confirm">Confirm</button>
                    </div>`
                  : `<span class="slot-placeholder" aria-hidden="true"></span>`
              }
            </div>
            <div class="action-slot icon-slot">
              <button class="dismiss secondary ping-button ${isWaitingForReply ? "is-pinging" : ""}" data-action="ping-room" data-room-id="${escapeHtml(room.id)}" type="button" aria-label="Ping room" title="Ping room">Ping</button>
            </div>
            <div class="action-slot icon-slot">
              <button class="dismiss secondary message-room-button ${unreadChatRoomIds.has(room.id) ? "is-unread" : ""}" data-action="message-room" data-room-id="${escapeHtml(room.id)}" type="button" aria-label="Message ${escapeHtml(room.name)}" title="Message ${escapeHtml(room.name)}">Message</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompactAlertList(state, rooms, alerts) {
  const compactRoomControls = rooms
    .map((room) => {
      const isWaitingForReply = pendingPingRooms.has(room.id);

      return `
        <article class="compact-room-card" style="--row-accent: ${escapeHtml(room.color || "#0f766e")}">
          <h3 class="compact-room-title" title="${escapeHtml(room.name)}">${escapeHtml(getRoomShortLabel(room))}</h3>
          <div class="compact-room-actions">
            <button
              class="dismiss secondary ping-button compact-room-alert-button ${isWaitingForReply ? "is-pinging" : ""}"
              data-action="ping-room"
              data-room-id="${escapeHtml(room.id)}"
              type="button"
              aria-label="${isWaitingForReply ? "Clear room alert" : "Alert room"}"
              title="${isWaitingForReply ? "Clear room alert" : "Alert room"}"
            >
              Ping
            </button>
            <button
              class="dismiss secondary message-room-button compact-room-message-button ${unreadChatRoomIds.has(room.id) ? "is-unread" : ""}"
              data-action="message-room"
              data-room-id="${escapeHtml(room.id)}"
              type="button"
              aria-label="Message ${escapeHtml(room.name)}"
              title="Message ${escapeHtml(room.name)}"
            >
              Message
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  const activeMessageRows = rooms
    .map((room) => {
      const roomAlerts = alerts.filter((alert) => alert.roomId === room.id);
      const roomAlertCount = roomAlerts.length;
      const alert = roomAlerts[0];
      const shouldAnimateAlert = shouldAnimateVisibleAlert(room.id, roomAlertCount);

      if (!alert) {
        return "";
      }

      const isActive = Boolean(
        state.activeNotification &&
          alert.notificationId === state.activeNotification.notificationId,
      );
      const formattedTime = alert ? formatRelativeTime(alert.timestamp) : "";
      const isWaitingForReply = pendingPingRooms.has(room.id);

      return `
        <article
          class="compact-message-row ${isActive ? "is-active" : "is-queued"} ${shouldAnimateAlert ? "is-new-alert" : ""}"
          style="--row-accent: ${escapeHtml(room.color || "#0f766e")}"
        >
          <div class="alert-copy">
            <div class="alert-main-line">
              <h2 class="alert-room" title="${escapeHtml(room.name)}">${escapeHtml(getRoomShortLabel(room))}</h2>
              <p class="alert-message">${escapeHtml(alert.message || "")}</p>
            </div>
          </div>
          <div class="action-row">
            <div class="action-slot age-slot">
              <span class="meta alert-age">${formattedTime}</span>
            </div>
            <div class="action-slot icon-slot">
              <div class="confirm-cluster">
                <span class="room-alert-count" aria-label="${roomAlertCount} ${roomAlertCount === 1 ? "message" : "messages"}">${roomAlertCount}</span>
                <button class="dismiss icon-confirm" data-action="${isActive ? "dismiss" : "dismiss-row"}" data-notification-id="${escapeHtml(alert.notificationId)}" type="button" aria-label="Confirm" title="Confirm">Confirm</button>
              </div>
            </div>
            <div class="action-slot icon-slot">
              <button class="dismiss secondary message-room-button ${unreadChatRoomIds.has(room.id) ? "is-unread" : ""}" data-action="message-room" data-room-id="${escapeHtml(room.id)}" type="button" aria-label="Message ${escapeHtml(room.name)}" title="Message ${escapeHtml(room.name)}">Message</button>
            </div>
          </div>
        </article>
      `;
    })
    .filter(Boolean)
    .join("");

  return `
    <section class="compact-layout">
      <div class="compact-room-grid-container">
        <div
          class="compact-room-grid ${rooms.length <= 4 ? "is-centered" : ""}"
          style="--compact-room-columns: ${Math.max(1, Math.min(rooms.length, 4))}"
        >${compactRoomControls}</div>
      </div>
      ${activeMessageRows ? `<div class="compact-message-list">${activeMessageRows}</div>` : ""}
    </section>
  `;
}

function getRelevantChatMessages(state) {
  const messages = (state?.chatMessages || []).filter(
    (message) => message?.senderType === "reception" || message?.sendToReception,
  );

  if (isAllChatRoomsThreadSelected) {
    return messages.filter((message) =>
      isReceptionAllRoomsMessage(message, state) || isRoomAllRoomsMessage(message, state),
    );
  }

  if (selectedChatRoomIds.size === 0) {
    return [];
  }

  return messages.filter((message) => {
    if (message?.senderType === "reception") {
      if (isReceptionAllRoomsMessage(message, state)) {
        return false;
      }

      const recipientRoomIds = Array.isArray(message?.recipientRoomIds)
        ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim())
        : [];

      return recipientRoomIds.some((roomId) => selectedChatRoomIds.has(roomId));
    }

    return !isRoomAllRoomsMessage(message, state) &&
      selectedChatRoomIds.has(String(message?.senderRoomId || "").trim());
  });
}

function isReceptionAllRoomsMessage(message, state = appState) {
  if (!canUseAllRoomsThread(state)) {
    return false;
  }

  if (String(message?.senderType || "").trim() !== "reception") {
    return false;
  }

  if (String(message?.messageGroupKey || "").trim() === RECEPTION_ALL_ROOMS_MESSAGE_GROUP_KEY) {
    return true;
  }

  const roomIds = getVisibleRooms(state).map((room) => String(room.id || "").trim()).filter(Boolean);
  const recipientRoomIds = [...new Set(
    Array.isArray(message?.recipientRoomIds)
      ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean)
      : [],
  )];

  return (
    roomIds.length > 1 &&
    recipientRoomIds.length === roomIds.length &&
    roomIds.every((roomId) => recipientRoomIds.includes(roomId))
  );
}

function isRoomAllRoomsMessage(message, state = appState) {
  if (!canUseAllRoomsThread(state)) {
    return false;
  }

  if (String(message?.senderType || "").trim() !== "room" || !message?.sendToReception) {
    return false;
  }

  const senderRoomId = String(message?.senderRoomId || "").trim();

  if (!senderRoomId) {
    return false;
  }

  const allOtherRoomIds = getVisibleRooms(state)
    .map((room) => String(room.id || "").trim())
    .filter((roomId) => roomId && roomId !== senderRoomId)
    .sort();
  const recipientRoomIds = [...new Set(
    Array.isArray(message?.recipientRoomIds)
      ? message.recipientRoomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean)
      : [],
  )].sort();

  return (
    allOtherRoomIds.length > 0 &&
    recipientRoomIds.length === allOtherRoomIds.length &&
    allOtherRoomIds.every((roomId) => recipientRoomIds.includes(roomId))
  );
}

function areAllRoomsSelected(state = appState) {
  return isAllChatRoomsThreadSelected && canUseAllRoomsThread(state);
}

function getActiveSingleChatRoom(state = appState) {
  if (selectedChatRoomIds.size !== 1) {
    return null;
  }

  return getRoomById([...selectedChatRoomIds][0], state);
}

function selectChatRoom(roomId) {
  if (!roomId) {
    return;
  }

  isAllChatRoomsThreadSelected = false;
  selectedChatRoomIds.clear();
  selectedChatRoomIds.add(roomId);
  unreadChatRoomIds.delete(roomId);
}

function selectAllChatRooms(state = appState) {
  isAllChatRoomsThreadSelected = canUseAllRoomsThread(state);
  selectedChatRoomIds.clear();
  hasUnreadAllRoomsMessage = false;
}

function selectHeaderMessageTarget(state = appState) {
  const rooms = getVisibleRooms(state);

  if (rooms.length === 1) {
    selectChatRoom(rooms[0].id);
    return;
  }

  selectAllChatRooms(state);
}

function persistMessageSectionVisibility() {
  if (!appState || isSettingsWindow || isRoleWindow) {
    return;
  }

  window.pip.updateDisplaySettings?.({
    messagesVisible: isMessageSectionVisible,
  }).catch(() => {});
}

function showMessageSection(options = {}) {
  isMessageSectionVisible = true;
  document.body.dataset.messagesHidden = "false";
  if (options.persist) {
    persistMessageSectionVisibility();
  }
}

function hideMessageSection(options = {}) {
  isMessageSectionVisible = false;
  document.body.dataset.messagesHidden = "true";
  if (options.persist) {
    persistMessageSectionVisibility();
  }
}

function syncMessageSectionVisibility() {
  document.body.dataset.messagesHidden = isMessageSectionVisible ? "false" : "true";
}

function syncMessageContext(state = appState) {
  const activeRoom = getActiveSingleChatRoom(state);
  const isAllRoomsSelected = areAllRoomsSelected(state);
  const canShowAllRoomsThread = canUseAllRoomsThread(state);
  const accent = isAllRoomsSelected ? "#879293" : activeRoom?.color || "var(--accent)";
  const label = isAllRoomsSelected
    ? "All Rooms"
    : activeRoom
      ? activeRoom.name
      : "Select a room";
  const shortLabel = isAllRoomsSelected
    ? "All"
    : activeRoom
      ? getRoomShortLabel(activeRoom)
      : "";

  if (chatContextLabel) {
    chatContextLabel.textContent = label;
    chatContextLabel.dataset.shortLabel = shortLabel;
  }

  chatAllRoomsButton?.classList.toggle("is-active", isAllRoomsSelected);
  chatAllRoomsButton?.classList.toggle("is-hidden", !canShowAllRoomsThread || isAllRoomsSelected);
  chatAllRoomsButton?.classList.toggle("is-unread", canShowAllRoomsThread && hasUnreadAllRoomsMessage && !isAllRoomsSelected);
  chatAllHeaderButton?.classList.toggle("is-unread", canShowAllRoomsThread && hasUnreadAllRoomsMessage && !isAllRoomsSelected);
  if (chatAllHeaderButton) {
    const singleRoom = getVisibleRooms(state)[0] || null;
    const headerLabel = canShowAllRoomsThread
      ? "Message All Rooms"
      : singleRoom
        ? `Message ${singleRoom.name}`
        : "Message rooms";
    chatAllHeaderButton.setAttribute("aria-label", headerLabel);
    chatAllHeaderButton.setAttribute("title", headerLabel);
  }

  if (!chatCard) {
    return;
  }

  chatCard.style.setProperty("--active-room-accent", accent);
  chatCard.style.setProperty("--message-send-active-color", isAllRoomsSelected ? "var(--text)" : accent);
  chatCard.style.setProperty("--message-context-label-color", isAllRoomsSelected ? "#3f4444" : accent);
  chatCard.style.setProperty("--message-context-short-label-color", isAllRoomsSelected ? "#3f4444" : accent);
  const messageStripBackground = isAllRoomsSelected
    ? NEUTRAL_MESSAGE_STRIP_BACKGROUND
    : activeRoom
      ? `linear-gradient(90deg, color-mix(in srgb, ${accent} 15%, white), color-mix(in srgb, ${accent} 4%, white) 72%, #ffffff)`
      : NEUTRAL_MESSAGE_STRIP_BACKGROUND;
  chatCard.style.setProperty("--message-context-strip-background", messageStripBackground);
  chatCard.style.setProperty("--message-list-background", messageStripBackground);
  chatCard.style.setProperty("--message-bubble-incoming", activeRoom?.color || "#418191");
}

function getIncomingChatRoomId(message) {
  if (String(message?.senderType || "").trim() !== "room" || !message?.sendToReception) {
    return "";
  }

  return String(message?.senderRoomId || "").trim();
}

function getChatMessageKey(message) {
  return String(
    message?.messageId ||
      [
        message?.senderType,
        message?.senderRoomId,
        message?.timestamp,
        message?.text,
      ].join("|"),
  );
}

function reconcileIncomingChatMessages(nextMessages = [], previousMessages = []) {
  const previousMessageKeys = new Set(previousMessages.map(getChatMessageKey));
  const previousIncomingMessages = previousMessages.filter((message) => getIncomingChatRoomId(message));
  const newMessages = nextMessages.filter((message) => !previousMessageKeys.has(getChatMessageKey(message)));
  const hasNewAllRoomsMessage = newMessages.some((message) => isRoomAllRoomsMessage(message, appState));
  const newIncomingRoomIds = newMessages
    .filter((message) => !isRoomAllRoomsMessage(message, appState))
    .map(getIncomingChatRoomId)
    .filter(Boolean);

  if (!hasNewAllRoomsMessage && newIncomingRoomIds.length === 0) {
    return [];
  }

  const hasActiveThread =
    isAllChatRoomsThreadSelected ||
    selectedChatRoomIds.size > 0 ||
    Boolean(String(chatComposeInput?.value || "").trim());
  const shouldAutoSelectFirstRoom =
    newIncomingRoomIds.length > 0 &&
    previousIncomingMessages.length === 0 &&
    !hasActiveThread;

  if (shouldAutoSelectFirstRoom) {
    isAllChatRoomsThreadSelected = false;
    selectedChatRoomIds.clear();
    selectedChatRoomIds.add(newIncomingRoomIds[0]);
  }

  if (hasNewAllRoomsMessage) {
    if (isAllChatRoomsThreadSelected) {
      hasUnreadAllRoomsMessage = false;
    } else {
      hasUnreadAllRoomsMessage = true;
    }
  }

  newIncomingRoomIds.forEach((roomId) => {
    if (!isAllChatRoomsThreadSelected && selectedChatRoomIds.has(roomId)) {
      unreadChatRoomIds.delete(roomId);
      return;
    }

    unreadChatRoomIds.add(roomId);
  });

  return hasNewAllRoomsMessage ? [...newIncomingRoomIds, RECEPTION_ALL_ROOMS_MESSAGE_GROUP_KEY] : newIncomingRoomIds;
}

function renderChatRecipients(state) {
  const rooms = getVisibleRooms(state);
  const roomIds = rooms.map((room) => room.id);
  for (const roomId of [...selectedChatRoomIds]) {
    if (!rooms.some((room) => room.id === roomId)) {
      selectedChatRoomIds.delete(roomId);
    }
  }
  if (rooms.length === 0) {
    isAllChatRoomsThreadSelected = false;
  } else if (!canUseAllRoomsThread(state) && isAllChatRoomsThreadSelected) {
    selectChatRoom(rooms[0].id);
  }
  pinnedChatRoomIds = pinnedChatRoomIds.filter((roomId) => roomIds.includes(roomId));
  chatRoomOrderIds = [
    ...chatRoomOrderIds.filter((roomId) => roomIds.includes(roomId)),
    ...roomIds.filter((roomId) => !chatRoomOrderIds.includes(roomId)),
  ];
  savePinnedChatRoomIds();
  saveChatRoomOrderIds();

  const allRoomsSelected = areAllRoomsSelected(state);
  const canShowAllRoomsThread = canUseAllRoomsThread(state);
  const orderedRooms = orderRoomsByIds(rooms, chatRoomOrderIds);
  const visibleRoomIds = [
    ...pinnedChatRoomIds,
    ...[...selectedChatRoomIds].filter((roomId) => !pinnedChatRoomIds.includes(roomId)),
  ];
  const visibleRooms = visibleRoomIds
    .map((roomId) => rooms.find((room) => room.id === roomId))
    .filter(Boolean);

  if (chatRecipientList) {
    chatRecipientList.innerHTML = visibleRooms
      .map((room) => {
        const isUnread =
          unreadChatRoomIds.has(room.id) &&
          !isAllChatRoomsThreadSelected &&
          !selectedChatRoomIds.has(room.id);

        return `
          <button
            class="message-recipient-chip ${!isAllChatRoomsThreadSelected && selectedChatRoomIds.has(room.id) ? "is-selected" : ""} ${isUnread ? "is-unread" : ""}"
            data-chat-room-id="${escapeHtml(room.id)}"
            data-chat-drag-source="pinned"
            draggable="true"
            style="--thread-accent: ${escapeHtml(room.color || "#0f766e")};"
            type="button"
          >
            <span title="${escapeHtml(room.name)}">${escapeHtml(getRoomShortLabel(room))}</span>
            ${isUnread ? '<span class="message-recipient-dot" aria-hidden="true"></span>' : ""}
          </button>
        `;
      })
      .join("");
  }

  if (chatRecipientDrawerList) {
    chatRecipientDrawerList.innerHTML = `
      ${canShowAllRoomsThread
        ? `<div class="message-thread-drawer-item ${allRoomsSelected ? "is-active" : ""}">
            <button
              class="message-thread-drawer-select"
              data-chat-all="true"
              style="--thread-accent: #879293;"
              type="button"
            >
              All Rooms
            </button>
            <span></span>
          </div>`
        : ""}
      ${orderedRooms.map((room) => {
        const isPinned = pinnedChatRoomIds.includes(room.id);
        const isUnread =
          unreadChatRoomIds.has(room.id) &&
          !isAllChatRoomsThreadSelected &&
          !selectedChatRoomIds.has(room.id);
        return `
          <div
            class="message-thread-drawer-item ${!isAllChatRoomsThreadSelected && selectedChatRoomIds.has(room.id) ? "is-active" : ""} ${isUnread ? "is-unread" : ""}"
            data-chat-room-id="${escapeHtml(room.id)}"
            data-chat-drag-source="drawer"
            draggable="true"
          >
            <button
              class="message-thread-drawer-select"
              data-chat-room-id="${escapeHtml(room.id)}"
              style="--thread-accent: ${escapeHtml(room.color || "#0f766e")};"
              type="button"
            >
              <span title="${escapeHtml(room.name)}">${escapeHtml(getRoomShortLabel(room))}</span>
              ${isUnread ? '<span class="message-recipient-dot" aria-hidden="true"></span>' : ""}
            </button>
            <button
              class="message-thread-pin-button ${isPinned ? "is-pinned" : ""}"
              data-pin-chat-room-id="${escapeHtml(room.id)}"
              type="button"
              aria-label="${isPinned ? "Unpin room" : "Pin room"}"
              title="${isPinned ? "Unpin" : "Pin"}"
            >
              ${isPinned ? "Unpin" : "Pin"}
            </button>
          </div>
        `;
      }).join("")}
    `;
  }

  syncMessageContext(state);
}

function renderChatMessages(state) {
  if (!chatMessageList) {
    return;
  }

  const wasPinnedToBottom =
    chatMessageList.scrollHeight -
      chatMessageList.scrollTop -
      chatMessageList.clientHeight <
    24;
  const messages = getRelevantChatMessages(state);

  if (messages.length === 0) {
    chatMessageList.innerHTML = "";
    updateChatScrollbar();
    return;
  }

  chatMessageList.innerHTML = messages
    .map((message) => {
      const isOutgoing = message.senderType === "reception";
      const senderRoom = getRoomById(String(message.senderRoomId || "").trim(), state);
      const text = String(message.text || "");
      const timestamp = formatMessageTime(message.timestamp);
      const isSingleLine = text.length <= 34 && !text.includes("\n");
      const isDeleted = Boolean(message.deleted);
      const messageId = String(message.messageId || "").trim();

      if (isDeleted) {
        return `
          <article class="message-item ${isOutgoing ? "is-outgoing" : "is-incoming"} is-deleted" style="--message-bubble-incoming: ${escapeHtml(senderRoom?.color || "#418191")}">
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
        <article class="message-item ${isOutgoing ? "is-outgoing" : "is-incoming"}" style="--message-bubble-incoming: ${escapeHtml(senderRoom?.color || "#418191")}" data-message-id="${escapeHtml(messageId)}">
          <div class="message-bubble">
            <div class="message-bubble-body ${isSingleLine ? "is-single-line" : "is-multi-line"}">
              <p class="message-item-text">${renderEmojis(text)}${editedLabel}</p>
              <span class="message-item-time">${escapeHtml(timestamp)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  if (wasPinnedToBottom) {
    requestAnimationFrame(() => {
      chatMessageList.scrollTop = chatMessageList.scrollHeight;
      updateChatScrollbar();
    });
  } else {
    requestAnimationFrame(updateChatScrollbar);
  }
}

function updateChatScrollbar() {
  if (!chatCard || !chatMessageList) {
    return;
  }

  const maxScroll = chatMessageList.scrollHeight - chatMessageList.clientHeight;
  const hasScrollbar = maxScroll > 1 && chatMessageList.clientHeight > 0;
  chatCard.classList.toggle("has-message-scrollbar", hasScrollbar);

  if (!hasScrollbar) {
    return;
  }

  const shellRect = chatCard.getBoundingClientRect();
  const listRect = chatMessageList.getBoundingClientRect();
  const inset = 30;
  const trackHeight = Math.max(1, chatMessageList.clientHeight - inset * 2);
  const thumbHeight = Math.max(
    34,
    Math.round(trackHeight * (chatMessageList.clientHeight / chatMessageList.scrollHeight))
  );
  const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll > 0 ? (chatMessageList.scrollTop / maxScroll) * maxThumbOffset : 0;
  const thumbTop = listRect.top - shellRect.top + inset + thumbOffset;

  chatCard.style.setProperty("--message-scrollbar-thumb-height", `${Math.round(thumbHeight)}px`);
  chatCard.style.setProperty("--message-scrollbar-thumb-top", `${Math.round(thumbTop)}px`);
}

function syncChatComposerState() {
  if (!chatSendButton || !chatComposeInput) {
    return;
  }

  const canSend = !(
    (!isAllChatRoomsThreadSelected && selectedChatRoomIds.size === 0) ||
    !String(chatComposeInput.value || "").trim()
  );

  chatSendButton.disabled = !canSend;
  chatSendButton.classList.toggle("is-ready-to-send", canSend);
  chatComposeInput.placeholder = areAllRoomsSelected()
    ? "message all rooms"
    : getActiveSingleChatRoom()?.name
      ? `message ${getActiveSingleChatRoom().name.toLowerCase()}`
      : "select a room";
}

function updateChatComposerHeight() {
  if (!chatComposeInput) {
    return;
  }

  chatComposeInput.style.height = "auto";
  chatComposeInput.style.height = `${Math.min(chatComposeInput.scrollHeight, 136)}px`;
  updateChatComposerScrollbar();
}

function updateChatComposerScrollbar() {
  if (!chatComposeInput) {
    return;
  }

  const compose = chatComposeInput.closest(".message-compose");

  if (!(compose instanceof HTMLElement)) {
    return;
  }

  const maxScroll = chatComposeInput.scrollHeight - chatComposeInput.clientHeight;
  const hasScrollbar = maxScroll > 1 && chatComposeInput.clientHeight > 0;
  compose.classList.toggle("has-compose-scrollbar", hasScrollbar);

  if (!hasScrollbar) {
    return;
  }

  const composeRect = compose.getBoundingClientRect();
  const inputRect = chatComposeInput.getBoundingClientRect();
  const inset = 17;
  const trackHeight = Math.max(1, chatComposeInput.clientHeight - inset * 2);
  const thumbHeight = Math.max(
    24,
    Math.round(trackHeight * (chatComposeInput.clientHeight / chatComposeInput.scrollHeight)),
  );
  const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll > 0 ? (chatComposeInput.scrollTop / maxScroll) * maxThumbOffset : 0;
  const thumbTop = inputRect.top - composeRect.top + inset + thumbOffset;
  const thumbLeft = inputRect.right - composeRect.left - 15;

  compose.style.setProperty("--compose-scrollbar-left", `${Math.round(thumbLeft)}px`);
  compose.style.setProperty("--compose-scrollbar-top", `${Math.round(thumbTop)}px`);
  compose.style.setProperty("--compose-scrollbar-thumb-height", `${Math.round(thumbHeight)}px`);
}

function focusChatComposer() {
  if (!chatComposeInput || !isMessageSectionVisible) {
    return;
  }

  chatComposeInput.focus({ preventScroll: true });
  const textLength = chatComposeInput.value.length;
  chatComposeInput.setSelectionRange(textLength, textLength);
}

function applyState(state) {
  appState = state;

  if (isRoleWindow) {
    renderRoleView(state?.app || {});
    return;
  }

  renderSelectedDeviceRole(state?.app || {});
  if (!hasRestoredMessageSectionVisibility) {
    isMessageSectionVisible = Boolean(state.config?.display?.messagesVisible);
    hasRestoredMessageSectionVisibility = true;

    if (isMessageSectionVisible && selectedChatRoomIds.size === 0 && !isAllChatRoomsThreadSelected) {
      const rooms = getVisibleRooms(state);
      const firstRoom = rooms[0];

      if (firstRoom?.id) {
        selectedChatRoomIds.add(firstRoom.id);
      }
    }
  }
  syncPendingPingRooms(state);
  adminModeButton?.setAttribute("aria-label", "Open settings");
  if (adminModeButton) {
    adminModeButton.title = "Settings";
  }
  compactModeButton?.setAttribute(
    "aria-label",
    state.config.display.compactMode ? "Disable compact view" : "Enable compact view",
  );
  if (compactModeButton) {
    compactModeButton.title = state.config.display.compactMode ? "Disable compact view" : "Enable compact view";
    compactModeButton.classList.toggle("is-active", Boolean(state.config.display.compactMode));
  }
  compactModeOptions.forEach((option) => {
    const isActive = option.getAttribute("data-compact-mode") === String(state.config.display.compactMode);
    option.classList.toggle("is-active", isActive);
  });
  document.body.dataset.windowView = windowView;
  document.body.dataset.minimized = !isSettingsWindow && state.config.display.minimized ? "true" : "false";
  document.body.dataset.adminMode = isSettingsWindow ? "true" : "false";
  document.body.dataset.compactMode = !isSettingsWindow && state.config.display.compactMode ? "true" : "false";
  document.body.dataset.expanded = !isSettingsWindow && state.config.display.expanded ? "true" : "false";
  expandWindowButton?.classList.toggle("is-active", Boolean(state.config.display.expanded));
  expandAdminButton?.classList.toggle("is-active", Boolean(state.config.display.expanded));
  if (expandWindowButton) {
    expandWindowButton.title = state.config.display.expanded ? "Collapse window" : "Expand window";
    expandWindowButton.setAttribute("aria-label", state.config.display.expanded ? "Collapse window" : "Expand window");
  }
  if (expandAdminButton) {
    expandAdminButton.title = state.config.display.expanded ? "Collapse window" : "Expand window";
    expandAdminButton.setAttribute("aria-label", state.config.display.expanded ? "Collapse window" : "Expand window");
  }
  syncMessageSectionVisibility();
  adminPanel.classList.toggle("hidden", !isSettingsWindow);

  if (!draftConfig) {
    draftConfig = structuredClone(state.config);
    populateEditor(draftConfig);
  }

  updateDetectedServerAddress(state);
  renderAlertList(state);
  renderChatRecipients(state);
  renderChatMessages(state);
  updateChatComposerHeight();
  syncChatComposerState();
  reportGadgetHeight();
  if (!isSettingsWindow) {
    scheduleGadgetHeightReport();
  }
}

function updateDetectedServerAddress(state) {
  if (!detectedServerAddressOutput) {
    return;
  }

  const detectedServerAddress =
    state?.service?.serverUrl ||
    (state?.service?.advertisedHost && state?.service?.port
      ? `http://${state.service.advertisedHost}:${state.service.port}`
      : "");

  detectedServerAddressOutput.textContent = detectedServerAddress || "Unavailable";
}

function reportGadgetHeight() {
  if (!gadgetPanel || !appState || isSettingsWindow || appState.config.display.minimized) {
    return;
  }

  const shellStyles = window.getComputedStyle(document.querySelector(".shell"));
  const shellVerticalPadding =
    parseFloat(shellStyles.paddingTop || "0") + parseFloat(shellStyles.paddingBottom || "0");
  const measuredPanelHeight = Math.max(
    gadgetPanel.scrollHeight,
    Math.ceil(gadgetPanel.getBoundingClientRect().height),
  );
  const windowsHeightAllowance = document.body.dataset.platform === "win32" ? 8 : 0;
  const nextHeight = Math.ceil(measuredPanelHeight + shellVerticalPadding + windowsHeightAllowance);

  if (!Number.isFinite(nextHeight) || nextHeight <= 0 || nextHeight === lastReportedGadgetHeight) {
    return;
  }

  lastReportedGadgetHeight = nextHeight;
  window.pip.updateGadgetHeight(nextHeight).catch(() => {});
}

function scheduleGadgetHeightReport() {
  lastReportedGadgetHeight = 0;

  window.requestAnimationFrame(() => {
    reportGadgetHeight();
    window.requestAnimationFrame(() => {
      reportGadgetHeight();
    });
  });

  window.setTimeout(() => {
    reportGadgetHeight();
  }, 60);
}

function syncPendingPingRooms(state) {
  const latestNotificationIdsByRoom = new Map();
  const alerts = [
    ...(state.activeNotification ? [state.activeNotification] : []),
    ...(state.queuedNotifications || []),
  ];

  for (const alert of alerts) {
    if (!latestNotificationIdsByRoom.has(alert.roomId)) {
      latestNotificationIdsByRoom.set(alert.roomId, alert.notificationId || null);
    }
  }

  for (const [roomId, previousLatestId] of pendingPingRooms.entries()) {
    const currentLatestId = latestNotificationIdsByRoom.get(roomId) ?? null;

    if (currentLatestId !== previousLatestId) {
      pendingPingRooms.delete(roomId);
    }
  }
}

function populateEditor(config) {
  draftConfig = structuredClone(config);
  networkPortInput.value = draftConfig.network.port ?? 3210;
  authAccessKeyInput.value = draftConfig.auth?.accessKey || "";
  launchAtStartupInput.checked = draftConfig.display?.launchAtStartup !== false;
  alwaysOnTopInput.checked = Boolean(draftConfig.display.alwaysOnTop);
  if (popupPositionInput) {
    popupPositionInput.value = draftConfig.display?.popupPosition || "bottomRight";
  }
  if (messageRetentionInput) {
    messageRetentionInput.value = String(draftConfig.display?.messageRetentionMinutes ?? 60);
  }
  if (receptionPingMessageInput) {
    receptionPingMessageInput.value = normalizeReceptionPingMessage(draftConfig.display?.receptionPingMessage);
  }
  populateReceptionSoundSelectOptions(draftConfig.audio?.notificationSound);
  populateMessageSoundSelectOptions(draftConfig.audio?.messageSound);
  audioMasterVolumeInput.value = String(draftConfig.audio?.masterVolume ?? 80);
  updateMasterVolumeLabel(audioMasterVolumeInput.value);
  audioMessageVolumeInput.value = String(draftConfig.audio?.messageVolume ?? 80);
  updateMessageVolumeLabel(audioMessageVolumeInput.value);
  syncRoomNotifications();
  renderRooms();
}

function showFeedback(message, tone = "success") {
  adminFeedback.textContent = message;
  adminFeedback.dataset.tone = tone;
  adminFeedback.classList.remove("hidden");
}

function clearFeedback() {
  adminFeedback.classList.add("hidden");
  adminFeedback.textContent = "";
  delete adminFeedback.dataset.tone;
}

function renderRooms() {
  roomsEditor.innerHTML = draftConfig.rooms
    .map(
      (room, index) => `
        <article class="editor-item">
          <div class="item-grid room-grid">
            <label class="field">
              <span>Name</span>
              <input data-entity="room" data-index="${index}" data-key="name" type="text" maxlength="10" value="${escapeHtml(room.name)}" />
            </label>
            <label class="field">
              <span>Short label</span>
              <input data-entity="room" data-index="${index}" data-key="shortName" type="text" maxlength="${ROOM_SHORT_NAME_MAX_LENGTH}" value="${escapeHtml(room.shortName || getDefaultRoomShortLabel(room.name, room.id, index))}" />
            </label>
            <label class="field checkbox-field room-visibility-field">
              <input data-entity="room" data-index="${index}" data-key="hidden" type="checkbox" ${room.hidden ? "checked" : ""} />
              <span>Hide from UI</span>
            </label>
            <div class="field room-remove-field">
              <span>&nbsp;</span>
              <div class="room-remove-wrap">
                <button class="danger-button inline-remove-button" data-remove="room" data-index="${index}" type="button">Remove</button>
              </div>
            </div>
            <label class="field colour-field room-colour-field">
              <span>Colour</span>
              <div class="room-colour-picker" role="group" aria-label="Colour for ${escapeHtml(room.name)}">
                ${renderRoomColourSwatches(room, index)}
              </div>
              <small class="room-colour-help">Dot means already used by another room.</small>
            </label>
          </div>
        </article>
      `,
    )
    .join("");
}

function syncRoomNotifications() {
  draftConfig.rooms = draftConfig.rooms.map((room, roomIndex) => {
    const notifications = Array.isArray(room.notifications)
      ? room.notifications
      : buildFallbackNotificationsForRoom(roomIndex);

    return {
      ...room,
      notifications: notifications.map((notification, notificationIndex) => ({
        id: String(notification.id || `room-${roomIndex + 1}-action-${notificationIndex + 1}`).trim(),
        label: String(notification.label || notification.message || `Action ${notificationIndex + 1}`).trim(),
        message: String(notification.message || notification.label || `Action ${notificationIndex + 1}`).trim(),
        color: String(notification.color || "#2563eb").trim(),
        icon: String(notification.icon || "").trim(),
        deviceButton: Number.isFinite(Number(notification.deviceButton))
          ? Number(notification.deviceButton)
          : notificationIndex,
      })),
    };
  });
}

function buildFallbackNotificationsForRoom(roomIndex) {
  return (draftConfig.actions || []).map((action, actionIndex) => {
    const mapping = draftConfig.buttonMappings.find((item) => item.actionId === action.id);

    return {
      id: String(action.id || `room-${roomIndex + 1}-action-${actionIndex + 1}`).trim(),
      label: String(action.label || action.message || `Action ${actionIndex + 1}`).trim(),
      message: String(action.message || action.label || `Action ${actionIndex + 1}`).trim(),
      color: String(action.color || "#2563eb").trim(),
      icon: String(action.icon || "").trim(),
      deviceButton: Number.isFinite(Number(mapping?.deviceButton))
        ? Number(mapping.deviceButton)
        : actionIndex,
    };
  });
}

function updateMasterVolumeLabel(value) {
  audioMasterVolumeValue.textContent = `${value}%`;
}

function updateMessageVolumeLabel(value) {
  audioMessageVolumeValue.textContent = `${value}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeHexColour(value, fallback = "#0f766e") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function getRoomColourUsage(colour, currentRoomIndex) {
  const normalizedColour = normalizeHexColour(colour);
  return (draftConfig?.rooms || [])
    .map((room, index) => ({
      index,
      name: String(room.name || `Room ${index + 1}`).trim(),
      colour: normalizeHexColour(room.color),
    }))
    .filter((room) => room.index !== currentRoomIndex && room.colour === normalizedColour);
}

function getNextRoomColour() {
  const usedColours = new Set(
    (draftConfig?.rooms || []).map((room) => normalizeHexColour(room.color)),
  );
  return ROOM_COLOUR_PALETTE.find((colour) => !usedColours.has(colour)) || ROOM_COLOUR_PALETTE[0];
}

function renderRoomColourSwatches(room, index) {
  const selectedColour = normalizeHexColour(room.color);
  const palette = ROOM_COLOUR_PALETTE.includes(selectedColour)
    ? ROOM_COLOUR_PALETTE
    : [selectedColour, ...ROOM_COLOUR_PALETTE];

  return palette.map((colour) => {
    const isSelected = colour === selectedColour;
    const usedBy = getRoomColourUsage(colour, index);
    const usedLabel = usedBy.map((item) => item.name).join(", ");
    const title = usedBy.length > 0
      ? `${colour} currently used by ${usedLabel}`
      : colour;

    return `
      <button
        class="room-colour-swatch ${isSelected ? "is-selected" : ""} ${usedBy.length > 0 ? "is-used" : ""}"
        data-room-colour-index="${index}"
        data-room-colour="${escapeHtml(colour)}"
        type="button"
        title="${escapeHtml(title)}"
        aria-label="${escapeHtml(title)}"
        style="--swatch-colour: ${escapeHtml(colour)}"
      >
        <span class="room-colour-swatch-mark" aria-hidden="true"></span>
        ${usedBy.length > 0 ? '<span class="room-colour-swatch-used" aria-hidden="true"></span>' : ""}
      </button>
    `;
  }).join("");
}

function formatMessageTime(timestamp) {
  const sentAt = new Date(timestamp);

  if (Number.isNaN(sentAt.getTime())) {
    return "";
  }

  return `${sentAt.getHours()}:${String(sentAt.getMinutes()).padStart(2, "0")}`;
}

function formatRelativeTime(timestamp) {
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

function updateDraftField(target) {
  const entity = target.dataset.entity;
  const index = Number(target.dataset.index);
  const key = target.dataset.key;

  if (entity === "room") {
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      draftConfig.rooms[index][key] = target.checked;
      return;
    }

    const maxLength = key === "name" ? 10 : key === "shortName" ? ROOM_SHORT_NAME_MAX_LENGTH : Infinity;
    draftConfig.rooms[index][key] = Number.isFinite(maxLength)
      ? target.value.slice(0, maxLength)
      : target.value;

    if (key === "name" || key === "shortName") {
      target.value = draftConfig.rooms[index][key];
    }
  }

}

function removeItem(type, index) {
  if (type === "room") {
    draftConfig.rooms.splice(index, 1);
    renderRooms();
  }
}

function buildConfigFromForm() {
  const preservedNetworkHost = String(draftConfig?.network?.host || "0.0.0.0").trim() || "0.0.0.0";

  return {
    ...draftConfig,
    network: {
      host: preservedNetworkHost,
      port: Number(networkPortInput.value),
    },
    auth: {
      ...(draftConfig.auth || {}),
      accessKey: authAccessKeyInput.value.trim(),
    },
    display: {
      ...draftConfig.display,
      launchAtStartup: launchAtStartupInput.checked,
      alwaysOnTop: alwaysOnTopInput.checked,
      popupPosition: popupPositionInput?.value || "bottomRight",
      messageRetentionMinutes: Number(messageRetentionInput?.value) || 60,
      receptionPingMessage: normalizeReceptionPingMessage(receptionPingMessageInput?.value),
      adminMode: false,
    },
    audio: {
      notificationSound:
        normalizeReceptionSound(audioNotificationSoundInput.value),
      masterVolume: Number(audioMasterVolumeInput.value),
      messageSound: normalizeReceptionSound(audioMessageSoundInput.value),
      messageVolume: Number(audioMessageVolumeInput.value),
    },
    hardware: {
      ...draftConfig.hardware,
    },
  };
}

async function init() {
  document.body.dataset.windowView = windowView;

  if (isRoleWindow) {
    rolePanel?.classList.remove("hidden");
    const roleState = await window.pip.getRoleState?.().catch(() => null);
    renderRoleView(roleState || {});
    return;
  }

  const status = await window.pip.getStatus();
  const config = await window.pip.getConfig();
  draftConfig = structuredClone(config);
  populateEditor(draftConfig);
  setActiveSettingsSection("reception-settings-general");
  applyState(status);
}

alertList?.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.action === "dismiss") {
    await window.pip.dismissNotification();
  }

  if (target.dataset.action === "dismiss-row") {
    await window.pip.dismissNotificationById(
      target.dataset.notificationId,
    );
  }

  if (target.dataset.action === "ping-room") {
    const roomId = target.dataset.roomId;
    if (pendingPingRooms.has(roomId)) {
      pendingPingRooms.delete(roomId);
      await window.pip.clearPing(roomId);
      renderAlertList(appState);
      return;
    }

    const alerts = [
      ...(appState?.activeNotification ? [appState.activeNotification] : []),
      ...(appState?.queuedNotifications || []),
    ];
    const latestAlertForRoom = alerts.find((alert) => alert.roomId === roomId) || null;
    pendingPingRooms.set(roomId, latestAlertForRoom?.notificationId || null);
    await window.pip.pingRoom(roomId);
    renderAlertList(appState);
  }

  if (target.dataset.action === "message-room") {
    const roomId = String(target.dataset.roomId || "").trim();

    if (!roomId) {
      return;
    }

    if (
      isMessageSectionVisible &&
      selectedChatRoomIds.size === 1 &&
      selectedChatRoomIds.has(roomId)
    ) {
      hideMessageSection({ persist: true });
      renderAlertList(appState);
      reportGadgetHeight();
      return;
    }

    selectChatRoom(roomId);
    showMessageSection({ persist: true });
    renderAlertList(appState);
    renderChatRecipients(appState);
    renderChatMessages(appState);
    syncChatComposerState();
    reportGadgetHeight();
    requestAnimationFrame(focusChatComposer);
  }

});

adminModeButton?.addEventListener("click", async () => {
  clearFeedback();
  await window.pip.openSettingsWindow?.().catch(() => {});
});

compactModeButton?.addEventListener("click", () => {
  const isOpen = compactModeButton.getAttribute("aria-expanded") === "true";
  compactModeButton.setAttribute("aria-expanded", !isOpen);
  compactModeMenu?.classList.toggle("hidden", isOpen);
});

compactModeOptions.forEach((option) => {
  option.addEventListener("click", async () => {
    const compactMode = option.getAttribute("data-compact-mode") === "true";
    await window.pip.updateDisplaySettings({ compactMode });
    compactModeButton.setAttribute("aria-expanded", "false");
    compactModeMenu?.classList.add("hidden");
  });
});

document.addEventListener("pointerdown", (event) => {
  const dropdown = document.querySelector(".compact-mode-dropdown");

  if (!(event.target instanceof Node) || !dropdown || dropdown.contains(event.target)) {
    return;
  }

  compactModeButton?.setAttribute("aria-expanded", "false");
  compactModeMenu?.classList.add("hidden");
});

document.body.addEventListener("dragstart", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const dragItem = target.closest("[data-chat-drag-source][data-chat-room-id]");

  if (!dragItem) {
    return;
  }

  draggedChatRoomId = String(dragItem.getAttribute("data-chat-room-id") || "").trim();
  draggedChatRoomSource = String(dragItem.getAttribute("data-chat-drag-source") || "").trim();

  if (!draggedChatRoomId || !draggedChatRoomSource) {
    return;
  }

  dragItem.classList.add("is-dragging");
  event.dataTransfer?.setData("text/plain", draggedChatRoomId);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
});

document.body.addEventListener("dragend", () => {
  document.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => {
    item.classList.remove("is-dragging", "is-drag-over");
  });
  draggedChatRoomId = "";
  draggedChatRoomSource = "";
});

document.body.addEventListener("dragover", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement) || !draggedChatRoomId) {
    return;
  }

  const dropItem = target.closest("[data-chat-drag-source][data-chat-room-id]");

  if (
    !dropItem ||
    String(dropItem.getAttribute("data-chat-drag-source") || "") !== draggedChatRoomSource
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
    target.closest("[data-chat-drag-source]")?.classList.remove("is-drag-over");
  }
});

document.body.addEventListener("drop", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement) || !draggedChatRoomId) {
    return;
  }

  const dropItem = target.closest("[data-chat-drag-source][data-chat-room-id]");
  const targetRoomId = String(dropItem?.getAttribute("data-chat-room-id") || "").trim();
  const targetSource = String(dropItem?.getAttribute("data-chat-drag-source") || "").trim();

  if (!targetRoomId || targetSource !== draggedChatRoomSource) {
    return;
  }

  event.preventDefault();

  if (draggedChatRoomSource === "pinned") {
    pinnedChatRoomIds = reorderIds(pinnedChatRoomIds, draggedChatRoomId, targetRoomId);
    savePinnedChatRoomIds();
  } else if (draggedChatRoomSource === "drawer") {
    chatRoomOrderIds = reorderIds(chatRoomOrderIds, draggedChatRoomId, targetRoomId);
    saveChatRoomOrderIds();
  }

  renderChatRecipients(appState);
});

async function toggleExpandWindow() {
  const isExpanded = document.body.dataset.expanded === "true";
  const nextExpanded = !isExpanded;
  document.body.dataset.expanded = nextExpanded ? "true" : "false";
  expandWindowButton?.classList.toggle("is-active", nextExpanded);
  expandAdminButton?.classList.toggle("is-active", nextExpanded);
  if (expandWindowButton) {
    expandWindowButton.title = nextExpanded ? "Collapse window" : "Expand window";
    expandWindowButton.setAttribute("aria-label", nextExpanded ? "Collapse window" : "Expand window");
  }
  if (expandAdminButton) {
    expandAdminButton.title = nextExpanded ? "Collapse window" : "Expand window";
    expandAdminButton.setAttribute("aria-label", nextExpanded ? "Collapse window" : "Expand window");
  }
  await window.pip.updateDisplaySettings({
    expanded: nextExpanded,
  });
  reportGadgetHeight();
}

expandWindowButton?.addEventListener("click", toggleExpandWindow);
expandAdminButton?.addEventListener("click", toggleExpandWindow);

minimizeWindowButton?.addEventListener("click", async () => {
  await window.pip.minimizeWindow?.().catch(() => {});
});

minimizeAdminButton?.addEventListener("click", async () => {
  await window.pip.minimizeWindow?.().catch(() => {});
});

quitAppButton?.addEventListener("click", async () => {
  await window.pip.confirmQuit();
});

closeAdminButton?.addEventListener("click", async () => {
  clearFeedback();
  window.close();
});

saveConfigButton?.addEventListener("click", async () => {
  clearFeedback();
  const nextConfig = buildConfigFromForm();
  const result = await window.pip.saveConfig(nextConfig);

  if (!result.ok) {
    showFeedback(result.errors.join(" "), "error");
    return;
  }

  draftConfig = structuredClone(result.config);
  populateEditor(draftConfig);
  showFeedback("Config saved successfully.", "success");
});

addRoomButton?.addEventListener("click", () => {
  const nextRoomNumber = draftConfig.rooms.length + 1;
  const lastRoom = draftConfig.rooms[draftConfig.rooms.length - 1];
  const baseRoom = lastRoom
    ? structuredClone(lastRoom)
    : {
        color: getNextRoomColour(),
        icon: "",
        receptionSound: {
          enabled: false,
          sound: DEFAULT_RECEPTION_SOUND,
        },
        notifications: [],
      };

  draftConfig.rooms.push({
    ...baseRoom,
    color: getNextRoomColour(),
    id: `room-${nextRoomNumber}`,
    name: `Room ${nextRoomNumber}`,
    shortName: getDefaultRoomShortLabel(`Room ${nextRoomNumber}`, `room-${nextRoomNumber}`, nextRoomNumber - 1),
    hidden: false,
    notifications: (baseRoom.notifications || []).map((notification, notificationIndex) => ({
      ...notification,
      id: `room-${nextRoomNumber}-action-${notificationIndex + 1}`,
    })),
  });
  renderRooms();
});

document.body.addEventListener("input", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  if (target === audioMasterVolumeInput) {
    updateMasterVolumeLabel(target.value);
  }

  if (target === audioMessageVolumeInput) {
    updateMessageVolumeLabel(target.value);
  }

  if (target.dataset.entity) {
    updateDraftField(target);
  }
});

roomsEditor?.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const swatch = target.closest("[data-room-colour-index][data-room-colour]");

  if (!(swatch instanceof HTMLElement)) {
    return;
  }

  const index = Number(swatch.dataset.roomColourIndex);
  const colour = normalizeHexColour(swatch.dataset.roomColour);

  if (!Number.isInteger(index) || !draftConfig?.rooms?.[index]) {
    return;
  }

  draftConfig.rooms[index].color = colour;
  renderRooms();
});

audioPlayTestButton?.addEventListener("click", async () => {
  await window.pip.playReceptionTestSound({
    sound: normalizeReceptionSound(audioNotificationSoundInput.value),
    volume: Number(audioMasterVolumeInput.value),
  }).catch(() => {});
});

audioMessagePlayTestButton?.addEventListener("click", async () => {
  await window.pip.playReceptionTestSound({
    sound: normalizeReceptionSound(audioMessageSoundInput.value),
    volume: Number(audioMessageVolumeInput.value),
  }).catch(() => {});
});

chatComposeInput?.addEventListener("input", () => {
  updateChatComposerHeight();
  syncChatComposerState();
  reportGadgetHeight();
});

chatComposeInput?.addEventListener("scroll", updateChatComposerScrollbar, { passive: true });

chatMessageList?.addEventListener("scroll", updateChatScrollbar, { passive: true });

chatAllHeaderButton?.addEventListener("click", () => {
  const visibleRooms = getVisibleRooms(appState);
  const isSingleRoomSelected =
    visibleRooms.length === 1 &&
    !isAllChatRoomsThreadSelected &&
    selectedChatRoomIds.size === 1 &&
    selectedChatRoomIds.has(visibleRooms[0].id);

  if (isMessageSectionVisible && (areAllRoomsSelected(appState) || isSingleRoomSelected)) {
    hideMessageSection({ persist: true });
    renderAlertList(appState);
    reportGadgetHeight();
    return;
  }

  selectHeaderMessageTarget(appState);
  showMessageSection({ persist: true });
  renderAlertList(appState);
  renderChatRecipients(appState);
  renderChatMessages(appState);
  syncChatComposerState();
  reportGadgetHeight();
  requestAnimationFrame(focusChatComposer);
});

chatCollapseButton?.addEventListener("click", () => {
  hideMessageSection({ persist: true });
  renderAlertList(appState);
  reportGadgetHeight();
});

chatAllRoomsButton?.addEventListener("click", () => {
  if (!canUseAllRoomsThread(appState)) {
    selectHeaderMessageTarget(appState);
    showMessageSection({ persist: true });
    renderAlertList(appState);
    renderChatRecipients(appState);
    renderChatMessages(appState);
    syncChatComposerState();
    reportGadgetHeight();
    requestAnimationFrame(focusChatComposer);
    return;
  }

  selectAllChatRooms(appState);
  showMessageSection({ persist: true });
  renderAlertList(appState);
  renderChatRecipients(appState);
  renderChatMessages(appState);
  syncChatComposerState();
  reportGadgetHeight();
  requestAnimationFrame(focusChatComposer);
});

chatSendButton?.addEventListener("click", async () => {
  const text = String(chatComposeInput?.value || "").trim();
  const recipientRoomIds = isAllChatRoomsThreadSelected
    ? getVisibleRooms(appState).map((room) => room.id)
    : [...selectedChatRoomIds];

  if (!text || recipientRoomIds.length === 0) {
    syncChatComposerState();
    return;
  }

  const result = await window.pip.sendChatMessage({
    recipientRoomIds,
    messageGroupKey: isAllChatRoomsThreadSelected ? RECEPTION_ALL_ROOMS_MESSAGE_GROUP_KEY : "",
    messageGroupLabel: isAllChatRoomsThreadSelected ? "All Rooms" : "",
    messageGroupParticipantRoomIds: isAllChatRoomsThreadSelected ? recipientRoomIds : [],
    text,
  });

  if (!result?.ok) {
    showFeedback(result?.error || "Unable to send message.", "error");
    return;
  }

  if (chatComposeInput) {
    chatComposeInput.value = "";
  }
  updateChatComposerHeight();
  syncChatComposerState();
  reportGadgetHeight();
});

document.body.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const pinButton = target.closest("[data-pin-chat-room-id]");

  if (pinButton) {
    const roomId = String(pinButton.getAttribute("data-pin-chat-room-id") || "").trim();

    if (!roomId) {
      return;
    }

    pinnedChatRoomIds = pinnedChatRoomIds.includes(roomId)
      ? pinnedChatRoomIds.filter((value) => value !== roomId)
      : [...pinnedChatRoomIds, roomId];
    savePinnedChatRoomIds();
    renderChatRecipients(appState);
    return;
  }

  const chatAllChip = target.closest("[data-chat-all]");

  if (chatAllChip) {
    if (!canUseAllRoomsThread(appState)) {
      return;
    }

    if (isAllChatRoomsThreadSelected) {
      isAllChatRoomsThreadSelected = false;
      selectedChatRoomIds.clear();
    } else {
      selectAllChatRooms(appState);
    }

    renderChatRecipients(appState);
    renderChatMessages(appState);
    syncChatComposerState();
    return;
  }

  const chatRoomChip = target.closest("[data-chat-room-id]");

  if (chatRoomChip) {
    const roomId = String(chatRoomChip.getAttribute("data-chat-room-id") || "").trim();

    if (!roomId) {
      return;
    }

    isAllChatRoomsThreadSelected = false;
    if (selectedChatRoomIds.has(roomId)) {
      selectedChatRoomIds.delete(roomId);
    } else {
      selectedChatRoomIds.add(roomId);
      unreadChatRoomIds.delete(roomId);
    }

    renderChatRecipients(appState);
    renderChatMessages(appState);
    syncChatComposerState();
    return;
  }

  const removeType = target.dataset.remove;

  if (removeType) {
    removeItem(removeType, Number(target.dataset.index));
  }

  // Dismiss context menu on click outside
  const contextMenu = document.querySelector(".message-context-menu");
  if (contextMenu && !target.closest(".message-context-menu")) {
    contextMenu.remove();
  }
});

// Right-click context menu for editing and deleting messages
chatMessageList?.addEventListener("contextmenu", (event) => {
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

  // Only allow editing/deleting outgoing (reception) messages
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
  const rect = messageItem.getBoundingClientRect();
  const chatListRect = chatMessageList.getBoundingClientRect();
  const menuX = Math.min(event.clientX, chatListRect.right - 180);
  const menuY = Math.min(event.clientY, chatListRect.bottom - 60);

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
      await window.pip.deleteChatMessage(id).catch(() => {});
    }
    menu.remove();
  });
});

function startInlineEdit(messageId) {
  const messageItem = chatMessageList?.querySelector(`.message-item[data-message-id="${escapeHtml(messageId)}"]`);

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
    return;
  }

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const finishEdit = (saved) => {
    if (saved) {
      const newText = String(textarea.value || "").trim();
      if (newText && newText !== currentText) {
        window.pip.editChatMessage(messageId, newText).catch(() => {});
      }
    }
    // Restore the original bubble content (will be re-rendered via chat:update)
    // For immediate feedback, we can update the text locally
    if (!saved) {
      bubbleBody.innerHTML = `
        <p class="message-item-text">${renderEmojis(currentText)}</p>
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

chatRecipientDrawerButton?.addEventListener("click", () => {
  setChatRecipientDrawerVisibility(!isChatRecipientDrawerVisible);
});

chatRecipientDrawerClose?.addEventListener("click", () => {
  setChatRecipientDrawerVisibility(false);
});

settingsSidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    setActiveSettingsSection(String(link.getAttribute("data-settings-section-link") || ""));
  });
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

  const nextRoleState = await window.pip.updateRoleState({
    runtimeRole,
    runtimeRoleConfirmed: true,
  }).catch(() => null);

  renderRoleView(nextRoleState || { runtimeRole });
  await window.pip.closeRoleWindow?.().catch(() => {});
});

roleCloseButton?.addEventListener("click", async () => {
  await window.pip.closeRoleWindow?.().catch(() => {});
});

openRoleWindowButton?.addEventListener("click", async () => {
  await window.pip.openRoleWindow?.().catch(() => {});
});

window.pip.onStateUpdate(applyState);
window.pip.onMessagePopupOpen?.((payload = {}) => {
  if (!appState) {
    return;
  }

  const roomId = String(payload.roomId || "").trim();

  if (roomId) {
    selectChatRoom(roomId);
  }

  showMessageSection({ persist: true });
  renderAlertList(appState);
  renderChatRecipients(appState);
  renderChatMessages(appState);
  syncChatComposerState();
  reportGadgetHeight();
  requestAnimationFrame(focusChatComposer);
});
window.pip.onChatUpdate((messages) => {
  if (!appState) {
    return;
  }

  const previousMessages = Array.isArray(appState.chatMessages) ? appState.chatMessages : [];
  const nextMessages = Array.isArray(messages) ? messages : [];
  const newIncomingRoomIds = reconcileIncomingChatMessages(nextMessages, previousMessages);

  if (newIncomingRoomIds.length > 0) {
    showMessageSection();
  }

  appState = {
    ...appState,
    chatMessages: nextMessages,
  };
  renderAlertList(appState);
  renderChatRecipients(appState);
  renderChatMessages(appState);
  syncChatComposerState();
  reportGadgetHeight();
});
window.pip.onPingCleared((payload) => {
  if (payload?.roomId) {
    pendingPingRooms.delete(payload.roomId);
    if (appState) {
      renderAlertList(appState);
      reportGadgetHeight();
    }
  }
});

window.addEventListener("resize", () => {
  updateChatScrollbar();
  reportGadgetHeight();
});

init();

// Initialize emoji picker
if (chatEmojiButton && chatComposeInput && chatEmojiPicker) {
  createEmojiPicker({
    triggerButton: chatEmojiButton,
    textarea: chatComposeInput,
    pickerElement: chatEmojiPicker,
  });
}
