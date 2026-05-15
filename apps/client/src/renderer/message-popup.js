const popup = document.querySelector("#message-popup");
const sourceLabel = document.querySelector("#message-popup-source");
const messageText = document.querySelector("#message-popup-text");
const closeButton = document.querySelector("#message-popup-close");
const openMessageButton = document.querySelector("#message-popup-open-message");
const buttonGrid = document.querySelector("#message-popup-button-grid");

let currentPayload = {};

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return "";
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getMessageBackground(accentColor) {
  return `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 15%, white), color-mix(in srgb, ${accentColor} 8%, white))`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderReceptionPingButtons(payload = {}) {
  const buttons = Array.isArray(payload.buttons) ? payload.buttons : [];
  const appearance = payload.buttonAppearance || {};
  const maxLabelLength = Number(payload.maxLabelLength) || 7;

  if (!buttonGrid) {
    return;
  }

  buttonGrid.innerHTML = buttons.map((button) => {
    const label = String(button.buttonLabel || button.label || "").trim();
    const isDisabled = button.disabled || !button.id;
    const classes = [
      "message-popup-neo-button",
      button.isActive ? "is-active" : "",
      label.length >= maxLabelLength ? "has-compact-label" : "",
    ].filter(Boolean).join(" ");
    const attributes = [
      `class="${classes}"`,
      `style="
        --button-background: ${escapeHtml(appearance.defaultBackground || "#FDD905")};
        --button-active-background: ${escapeHtml(appearance.activeBackground || "#000000")};
        --button-text: ${escapeHtml(appearance.defaultText || "#000000")};
        --button-active-text: ${escapeHtml(appearance.activeText || "#FFFFFF")};
      "`,
      "type=\"button\"",
    ];

    if (!isDisabled) {
      attributes.push(`data-button-id="${escapeHtml(button.id)}"`);
    }

    if (isDisabled) {
      attributes.push("disabled");
    }

    return `
      <button ${attributes.join(" ")}>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }).join("");
}

function showPayload(payload = {}) {
  const accentColor = String(payload.accentColor || "#111111").trim() || "#111111";
  const label = String(payload.sourceLabel || "Msg").trim() || "Msg";
  const text = String(payload.text || "New message").trim() || "New message";
  const kind = String(payload.kind || "message").trim() || "message";
  const isRefreshingVisiblePopup =
    document.body.classList.contains("is-visible") &&
    String(currentPayload.kind || "message") === kind;

  currentPayload = payload;

  if (!isRefreshingVisiblePopup) {
    document.body.classList.remove("is-visible");
  }
  document.body.dataset.popupKind = kind;
  popup?.style.setProperty("--popup-accent", accentColor);
  popup?.style.setProperty("--popup-message-background", getMessageBackground(accentColor));

  if (sourceLabel) {
    sourceLabel.textContent = label.slice(0, 7);
  }

  if (messageText) {
    messageText.textContent = kind === "receptionPing" ? text.toUpperCase() : text;
  }

  renderReceptionPingButtons(payload);

  if (!isRefreshingVisiblePopup) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add("is-visible");
      });
    });
  }
}

window.pipMessagePopup?.onShow(showPayload);

closeButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  window.pipMessagePopup?.close?.();
});

openMessageButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (currentPayload.kind === "receptionPing") {
    window.pipMessagePopup?.dismissReceptionPing?.();
    window.pipMessagePopup?.openMain?.({
      openMode: "messages",
      kind: currentPayload.kind || "message",
    });
    return;
  }

  window.pipMessagePopup?.openMain?.({
    kind: currentPayload.kind || "message",
  });
});

buttonGrid?.addEventListener("click", (event) => {
  const button = event.target instanceof HTMLElement
    ? event.target.closest("[data-button-id]")
    : null;

  if (!button) {
    return;
  }

  event.stopPropagation();
  const buttonId = String(button.getAttribute("data-button-id") || "").trim();

  if (!buttonId) {
    return;
  }

  button.setAttribute("disabled", "disabled");
  Promise.resolve(window.pipMessagePopup?.sendPanelAction?.(buttonId)).finally(() => {
    button.removeAttribute("disabled");
  });
});

// Popup background click removed - only explicit button clicks trigger actions.
