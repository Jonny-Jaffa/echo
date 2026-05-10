const popup = document.querySelector("#message-popup");
const sourceLabel = document.querySelector("#message-popup-source");
const messageText = document.querySelector("#message-popup-text");
const alertAge = document.querySelector("#message-popup-age");
const alertCount = document.querySelector("#message-popup-count");
const dismissButton = document.querySelector("#message-popup-dismiss");
const messageButton = document.querySelector("#message-popup-message-icon");
const closeButton = document.querySelector("#message-popup-close");
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
  const start = hexToRgba(accentColor, 0.16);
  const end = hexToRgba(accentColor, 0.04);

  if (start && end) {
    return `linear-gradient(90deg, ${start}, ${end})`;
  }

  return `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 16%, transparent), color-mix(in srgb, ${accentColor} 4%, transparent))`;
}

function showPayload(payload = {}) {
  const kind = String(payload.kind || "message").trim().toLowerCase() === "alert"
    ? "alert"
    : "message";
  const accentColor = String(payload.accentColor || "#0f766e").trim() || "#0f766e";
  const label = String(payload.sourceLabel || "Msg").trim() || "Msg";
  const text = String(payload.text || "New message").trim() || "New message";
  const formattedTime = String(payload.formattedTime || "Just now").trim() || "Just now";
  const count = Math.max(1, Math.round(Number(payload.alertCount) || 1));
  currentPayload = { ...payload, kind };

  document.body.classList.remove("is-visible");
  popup?.setAttribute("data-popup-kind", kind);
  popup?.style.setProperty("--popup-accent", accentColor);
  popup?.style.setProperty("--popup-message-background", getMessageBackground(accentColor));

  if (sourceLabel) {
    sourceLabel.textContent = label.slice(0, 7);
  }

  if (messageText) {
    messageText.textContent = text;
  }

  if (alertAge) {
    alertAge.textContent = formattedTime;
  }

  if (alertCount) {
    alertCount.textContent = String(count);
    alertCount.setAttribute("aria-label", `${count} ${count === 1 ? "message" : "messages"}`);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add("is-visible");
    });
  });
}

window.pipMessagePopup?.onShow(showPayload);

closeButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  window.pipMessagePopup?.close?.();
});

dismissButton?.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const notificationId = String(currentPayload.notificationId || "").trim();

  if (notificationId) {
    await window.pipMessagePopup?.dismissAlert?.(notificationId).catch(() => {});
    return;
  }

  window.pipMessagePopup?.close?.();
});

messageButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  window.pipMessagePopup?.openMessage?.();
});

// Popup background click removed - only explicit button clicks trigger actions.
