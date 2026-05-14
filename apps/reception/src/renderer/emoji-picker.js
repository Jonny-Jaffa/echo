/**
 * Emoji picker UI component.
 * Provides a popup emoji picker that can be attached to any textarea.
 */

import { EMOJI_CATEGORIES } from "./emojis.js";

/**
 * Create an emoji picker instance attached to a trigger button and textarea.
 *
 * @param {object} options
 * @param {HTMLElement} options.triggerButton - The button that toggles the picker
 * @param {HTMLTextAreaElement} options.textarea - The textarea to insert emojis into
 * @param {HTMLElement} options.pickerElement - The picker container element (with .emoji-picker class)
 * @returns {{ destroy: () => void }} - Cleanup function
 */
export function createEmojiPicker({ triggerButton, textarea, pickerElement }) {
  let isOpen = false;

  function positionPicker() {
    const messageShell = pickerElement.closest(".message-shell");
    const messageList = messageShell?.querySelector(".message-list");

    if (!messageShell || !messageList) {
      pickerElement.style.removeProperty("--emoji-picker-top");
      pickerElement.style.removeProperty("--emoji-picker-height");
      return;
    }

    const shellRect = messageShell.getBoundingClientRect();
    const listRect = messageList.getBoundingClientRect();
    const pickerWidth = Math.min(360, Math.max(260, Math.round(listRect.width - 24)));
    const pickerHeight = 230;
    const top = Math.max(0, Math.round(listRect.top - shellRect.top + 12));
    const left = Math.max(0, Math.round(listRect.left - shellRect.left + 12));

    pickerElement.style.setProperty("--emoji-picker-top", `${top}px`);
    pickerElement.style.setProperty("--emoji-picker-left", `${left}px`);
    pickerElement.style.setProperty("--emoji-picker-width", `${pickerWidth}px`);
    pickerElement.style.setProperty("--emoji-picker-height", `${pickerHeight}px`);
  }

  function buildPicker() {
    // Build category tabs
    const tabsContainer = document.createElement("div");
    tabsContainer.className = "emoji-picker-categories";

    const gridContainer = document.createElement("div");
    gridContainer.className = "emoji-picker-grid";

    let activeCategoryIndex = 0;

    function renderCategory(index) {
      const category = EMOJI_CATEGORIES[index];
      if (!category) return;

      gridContainer.innerHTML = "";

      for (const emoji of category.emojis) {
        const button = document.createElement("button");
        button.className = "emoji-picker-item";
        button.type = "button";
        button.textContent = emoji.char;
        button.title = emoji.name;
        button.addEventListener("click", () => {
          insertEmoji(emoji.char);
        });
        gridContainer.appendChild(button);
      }
    }

    function buildTabs() {
      tabsContainer.innerHTML = "";

      EMOJI_CATEGORIES.forEach((category, index) => {
        const tab = document.createElement("button");
        tab.className = "emoji-picker-category-tab";
        tab.type = "button";
        tab.textContent = category.label;
        if (index === activeCategoryIndex) {
          tab.classList.add("is-active");
        }
        tab.addEventListener("click", () => {
          activeCategoryIndex = index;
          tabsContainer.querySelectorAll(".emoji-picker-category-tab").forEach((t) => t.classList.remove("is-active"));
          tab.classList.add("is-active");
          renderCategory(index);
        });
        tabsContainer.appendChild(tab);
      });
    }

    buildTabs();
    renderCategory(0);

    pickerElement.innerHTML = "";
    pickerElement.appendChild(tabsContainer);
    pickerElement.appendChild(gridContainer);
  }

  function insertEmoji(char) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    textarea.value = before + char + after;
    textarea.selectionStart = textarea.selectionEnd = start + char.length;
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    closePicker();
  }

  function togglePicker() {
    if (isOpen) {
      closePicker();
    } else {
      openPicker();
    }
  }

  function openPicker() {
    if (isOpen) return;
    isOpen = true;
    triggerButton.classList.add("is-active");
    positionPicker();
    pickerElement.classList.remove("hidden");
    buildPicker();
  }

  function closePicker() {
    if (!isOpen) return;
    isOpen = false;
    triggerButton.classList.remove("is-active");
    pickerElement.classList.add("hidden");
  }

  function handleClickOutside(event) {
    if (!isOpen) return;
    if (
      !pickerElement.contains(event.target) &&
      !triggerButton.contains(event.target)
    ) {
      closePicker();
    }
  }

  function handleEscape(event) {
    if (event.key === "Escape" && isOpen) {
      closePicker();
      textarea.focus();
    }
  }

  // Attach event listeners
  triggerButton.addEventListener("click", togglePicker);
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleEscape);
  window.addEventListener("resize", positionPicker);

  return {
    destroy() {
      triggerButton.removeEventListener("click", togglePicker);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", positionPicker);
    },
    open() {
      openPicker();
    },
    close() {
      closePicker();
    },
  };
}
