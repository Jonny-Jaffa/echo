const threadRailList = document.querySelector("#thread-rail-list");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderThreadRail(payload = {}) {
  if (!threadRailList) {
    return;
  }

  const threads = Array.isArray(payload.threads) ? payload.threads : [];
  document.documentElement.style.setProperty(
    "--thread-rail-top",
    `${Math.max(8, Math.round(Number(payload.top) || 8))}px`,
  );

  threadRailList.innerHTML = threads.map((thread) => `
    <button
      class="thread-rail-chip ${thread.active ? "is-active" : ""} ${thread.key === "reception" ? "is-reception" : ""} ${thread.key === "all" ? "is-all-rooms" : ""} ${thread.unread ? "is-unread" : ""}"
      style="--thread-accent: ${escapeHtml(thread.accent || "#111111")};"
      data-thread-key="${escapeHtml(thread.key)}"
      title="${escapeHtml(thread.fullLabel || thread.label || thread.displayLabel || "")}"
      type="button"
    >
      <span>${escapeHtml(thread.displayLabel || thread.label || "")}</span>
      ${thread.unread ? '<span class="thread-rail-dot" aria-hidden="true"></span>' : ""}
    </button>
  `).join("");
}

window.pipThreadRail?.onUpdate?.(renderThreadRail);

threadRailList?.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("[data-thread-key]");
  const threadKey = String(button?.getAttribute("data-thread-key") || "").trim();

  if (threadKey) {
    window.pipThreadRail?.selectThread?.(threadKey);
  }
});
