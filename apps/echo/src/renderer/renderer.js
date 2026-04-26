const roleOptionList = document.querySelector("#role-option-list");
const savedRoleValue = document.querySelector("#saved-role-value");
const roleConfirmedValue = document.querySelector("#role-confirmed-value");
const lastUpdatedValue = document.querySelector("#last-updated-value");
const selectionFeedback = document.querySelector("#selection-feedback");
const minimizeWindowButton = document.querySelector("#minimize-window-button");
const quitAppButton = document.querySelector("#quit-app-button");
const runtimeStatePill = document.querySelector("#runtime-state-pill");
const runtimeDetail = document.querySelector("#runtime-detail");
const runtimeStatusGrid = document.querySelector("#runtime-status-grid");
const stopRuntimeButton = document.querySelector("#stop-runtime-button");
const restartRuntimeButton = document.querySelector("#restart-runtime-button");
const openRoleExperienceButton = document.querySelector("#open-role-experience-button");
const roleExperienceDetail = document.querySelector("#role-experience-detail");
const roomSettingsCard = document.querySelector("#room-settings-card");
const roomServerUrlInput = document.querySelector("#room-server-url-input");
const roomAccessKeyInput = document.querySelector("#room-access-key-input");
const roomIdInput = document.querySelector("#room-id-input");
const roomDeviceIdInput = document.querySelector("#room-device-id-input");
const roleHomeEyebrow = document.querySelector("#role-home-eyebrow");
const roleHomeTitle = document.querySelector("#role-home-title");
const roleHomeCopy = document.querySelector("#role-home-copy");
const roleChipPrimary = document.querySelector("#role-chip-primary");
const receptionCard = document.querySelector("#reception-card");
const roomCard = document.querySelector("#room-card");
const runtimeCardEyebrow = document.querySelector("#runtime-card-eyebrow");
const runtimeCardTitle = document.querySelector("#runtime-card-title");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatRuntimeRoleLabel(runtimeRole) {
  return runtimeRole === "reception" ? "Reception" : runtimeRole === "room" ? "Room" : "Not chosen yet";
}

function formatSavedAt(value) {
  if (!value) {
    return "Not saved yet";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function renderStatusRows(items = []) {
  return items
    .map(
      (item) => `
        <article class="status-tile">
          <span class="status-label">${escapeHtml(item.label)}</span>
          <strong class="status-value">${escapeHtml(item.value)}</strong>
        </article>
      `,
    )
    .join("");
}

function buildRuntimeStatusItems(state = {}) {
  const runtimeServiceState = state.runtimeServiceState || {};
  const activeRole = String(runtimeServiceState.activeRole || state.runtimeRole || "").trim().toLowerCase();

  if (activeRole === "reception" && runtimeServiceState.receptionStatus) {
    const receptionStatus = runtimeServiceState.receptionStatus;
    return [
      { label: "Server URL", value: receptionStatus.serverUrl || "Unavailable" },
      { label: "Port", value: String(receptionStatus.port || "3210") },
      { label: "Connected rooms", value: String(receptionStatus.connectedClients ?? 0) },
      { label: "Pairing code", value: receptionStatus.pairingCode || "Not set" },
    ];
  }

  if (activeRole === "room") {
    const roomStatus = runtimeServiceState.roomStatus || {};
    return [
      { label: "Reception Address", value: roomStatus.serverUrl || state.roomRuntimeSettings?.serverUrl || "Unavailable" },
      { label: "Room Id", value: roomStatus.roomId || state.roomRuntimeSettings?.roomId || "Not set" },
      { label: "Device Id", value: roomStatus.deviceId || state.roomRuntimeSettings?.deviceId || "Not set" },
      { label: "Hardware state", value: roomStatus.state || "Waiting" },
    ];
  }

  return [
    { label: "Saved role", value: formatRuntimeRoleLabel(state.runtimeRole) },
    { label: "Runtime status", value: runtimeServiceState.state || "idle" },
  ];
}

function renderBootstrapState(state = {}) {
  const runtimeRole = String(state.runtimeRole || "").trim().toLowerCase();
  const roleConfirmed = Boolean(state.runtimeRoleConfirmed);
  const roomRuntimeSettings = state.roomRuntimeSettings || {};
  const runtimeServiceState = state.runtimeServiceState || {};
  const activeRole = String(runtimeServiceState.activeRole || runtimeRole || "").trim().toLowerCase();

  savedRoleValue.textContent = formatRuntimeRoleLabel(runtimeRole);
  roleConfirmedValue.textContent = roleConfirmed ? "Yes" : "No";
  lastUpdatedValue.textContent = formatSavedAt(state.lastUpdated);

  roleOptionList?.querySelectorAll("[data-runtime-role]").forEach((option) => {
    option.classList.toggle(
      "is-active",
      String(option.getAttribute("data-runtime-role") || "").trim().toLowerCase() === runtimeRole,
    );
  });

  if (selectionFeedback) {
    selectionFeedback.textContent = runtimeRole
      ? `Saved role: ${formatRuntimeRoleLabel(runtimeRole)}. The unified Pip app now uses that saved role to start the matching transitional runtime service.`
      : "Pick the intended role now. The future unified runtime handoff will read this saved choice when the single-install Pip product is completed.";
  }

  if (roleHomeEyebrow) {
    roleHomeEyebrow.textContent = runtimeRole
      ? `${formatRuntimeRoleLabel(runtimeRole)} Workspace`
      : "Role Workspace";
  }

  if (roleHomeTitle) {
    roleHomeTitle.textContent = runtimeRole === "reception"
      ? "This computer is staged as a Reception workstation"
      : runtimeRole === "room"
        ? "This computer is staged as a Room workstation"
        : "Choose a role for this computer";
  }

  if (roleHomeCopy) {
    roleHomeCopy.textContent = runtimeRole === "reception"
      ? "Use this mode for the front desk machine that hosts the LAN service, pairing, queue state, and future unified reception workspace."
      : runtimeRole === "room"
        ? "Use this mode for a chairside computer that needs the room runtime, local device identity, and future unified room panel."
        : "Pick `Reception` or `Room` below to start shaping this machine into the right kind of Pip workstation.";
  }

  if (roleChipPrimary) {
    roleChipPrimary.textContent = roleConfirmed && runtimeRole
      ? `${formatRuntimeRoleLabel(runtimeRole)} selected`
      : "Not configured";
  }

  if (runtimeStatePill) {
    const runtimeState = String(runtimeServiceState.state || "idle").trim().toLowerCase();
    runtimeStatePill.textContent = runtimeState ? runtimeState[0].toUpperCase() + runtimeState.slice(1) : "Idle";
    runtimeStatePill.dataset.state = runtimeState || "idle";
  }

  if (runtimeCardEyebrow) {
    runtimeCardEyebrow.textContent = activeRole === "reception"
      ? "Reception Runtime"
      : activeRole === "room"
        ? "Room Runtime"
        : "Runtime";
  }

  if (runtimeCardTitle) {
    runtimeCardTitle.textContent = activeRole === "reception"
      ? "Front-desk host service"
      : activeRole === "room"
        ? "Chairside room service"
        : "Current role service";
  }

  if (runtimeDetail) {
    runtimeDetail.textContent = runtimeServiceState.detail || "Choose a role to begin";
  }

  if (roleExperienceDetail) {
    const roleExperienceState = state.roleExperienceState || {};
    roleExperienceDetail.textContent = roleExperienceState.detail || "Full role workspace has not been opened";
    roleExperienceDetail.dataset.state = String(roleExperienceState.state || "idle").trim().toLowerCase();
  }

  if (runtimeStatusGrid) {
    runtimeStatusGrid.innerHTML = renderStatusRows(buildRuntimeStatusItems(state));
  }

  if (roomSettingsCard) {
    roomSettingsCard.hidden = runtimeRole !== "room";
  }

  if (receptionCard) {
    receptionCard.hidden = runtimeRole !== "reception";
  }

  if (roomCard) {
    roomCard.hidden = runtimeRole !== "room";
  }

  if (roomServerUrlInput) {
    roomServerUrlInput.value = roomRuntimeSettings.serverUrl || "";
  }

  if (roomAccessKeyInput) {
    roomAccessKeyInput.value = roomRuntimeSettings.serverAccessKey || "";
  }

  if (roomIdInput) {
    roomIdInput.value = roomRuntimeSettings.roomId || "";
  }

  if (roomDeviceIdInput) {
    roomDeviceIdInput.value = roomRuntimeSettings.deviceId || "";
  }

  if (openRoleExperienceButton) {
    openRoleExperienceButton.disabled = !roleConfirmed || !runtimeRole;
    openRoleExperienceButton.textContent = runtimeRole
      ? `Open ${formatRuntimeRoleLabel(runtimeRole)} workspace`
      : "Open workspace";
  }
}

async function handleRoleSelection(event) {
  const option = event.target.closest("[data-runtime-role]");

  if (!option) {
    return;
  }

  const runtimeRole = String(option.getAttribute("data-runtime-role") || "").trim().toLowerCase();

  if (!runtimeRole) {
    return;
  }

  const nextState = await window.echoBootstrap.updateBootstrapState({
    runtimeRole,
    runtimeRoleConfirmed: true,
  });
  renderBootstrapState(nextState || { runtimeRole, runtimeRoleConfirmed: true });
}

roleOptionList?.addEventListener("click", handleRoleSelection);
roomServerUrlInput?.addEventListener("change", () => {
  window.echoBootstrap.updateBootstrapState?.({
    roomRuntimeSettings: {
      serverUrl: roomServerUrlInput.value,
    },
  }).catch(() => {});
});
roomAccessKeyInput?.addEventListener("change", () => {
  window.echoBootstrap.updateBootstrapState?.({
    roomRuntimeSettings: {
      serverAccessKey: roomAccessKeyInput.value,
    },
  }).catch(() => {});
});
roomIdInput?.addEventListener("change", () => {
  window.echoBootstrap.updateBootstrapState?.({
    roomRuntimeSettings: {
      roomId: roomIdInput.value,
    },
  }).catch(() => {});
});
roomDeviceIdInput?.addEventListener("change", () => {
  window.echoBootstrap.updateBootstrapState?.({
    roomRuntimeSettings: {
      deviceId: roomDeviceIdInput.value,
    },
  }).catch(() => {});
});
stopRuntimeButton?.addEventListener("click", () => {
  window.echoBootstrap.stopRuntime?.().catch(() => {});
});
restartRuntimeButton?.addEventListener("click", () => {
  window.echoBootstrap.restartRuntime?.().catch(() => {});
});
openRoleExperienceButton?.addEventListener("click", () => {
  window.echoBootstrap.openRoleExperience?.().catch(() => {});
});
minimizeWindowButton?.addEventListener("click", () => {
  window.echoBootstrap.minimizeWindow?.().catch(() => {});
});
quitAppButton?.addEventListener("click", () => {
  window.echoBootstrap.confirmQuit?.().catch(() => {});
});

window.echoBootstrap.onBootstrapUpdate?.((state) => {
  renderBootstrapState(state);
});

const initialBootstrapState = await window.echoBootstrap.getBootstrapState?.().catch(() => null);
renderBootstrapState(initialBootstrapState || {});
