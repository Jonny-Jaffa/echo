/**
 * Curated emoji set for Patient Pip messaging.
 * Each emoji has: character, name, category, and hexcode (for SVG filename).
 */

const EMOJI_CATEGORIES = [
  {
    id: "medical",
    label: "Medical",
    emojis: [
      { char: "\u{1FA7A}", name: "Stethoscope", hex: "1fa7a" },
      { char: "\u{1F48A}", name: "Pill", hex: "1f48a" },
      { char: "\u{1F3E5}", name: "Hospital", hex: "1f3e5" },
      { char: "\u{1FA79}", name: "Adhesive Bandage", hex: "1fa79" },
      { char: "\u{1F9EC}", name: "DNA", hex: "1f9ec" },
      { char: "\u{1F9EA}", name: "Test Tube", hex: "1f9ea" },
      { char: "\u{1F52C}", name: "Microscope", hex: "1f52c" },
      { char: "\u{1F489}", name: "Syringe", hex: "1f489" },
      { char: "\u{1F9B7}", name: "Tooth", hex: "1f9b7" },
      { char: "\u{1F9E0}", name: "Brain", hex: "1f9e0" },
      { char: "\u2764\uFE0F", name: "Red Heart", hex: "2764-fe0f" },
      { char: "\u{1FAC0}", name: "Anatomical Heart", hex: "1fac0" },
      { char: "\u{1FAC1}", name: "Lungs", hex: "1fac1" },
      { char: "\u{1FA7B}", name: "X-Ray", hex: "1fa7b" },
      { char: "\u{1F9D1}\u200D\u2695\uFE0F", name: "Health Worker", hex: "1f9d1-200d-2695-fe0f" },
      { char: "\u{1F468}\u200D\u2695\uFE0F", name: "Male Health Worker", hex: "1f468-200d-2695-fe0f" },
      { char: "\u{1F469}\u200D\u2695\uFE0F", name: "Female Health Worker", hex: "1f469-200d-2695-fe0f" },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    emojis: [
      { char: "\u2705", name: "Check Mark", hex: "2705" },
      { char: "\u274C", name: "Cross Mark", hex: "274c" },
      { char: "\u23F0", name: "Alarm Clock", hex: "23f0" },
      { char: "\u{1F4CB}", name: "Clipboard", hex: "1f4cb" },
      { char: "\u{1F4DD}", name: "Memo", hex: "1f4dd" },
      { char: "\u270F\uFE0F", name: "Pencil", hex: "270f-fe0f" },
      { char: "\u{1F514}", name: "Bell", hex: "1f514" },
      { char: "\u{1F515}", name: "Bell with Slash", hex: "1f515" },
      { char: "\u{1F4CC}", name: "Pushpin", hex: "1f4cc" },
      { char: "\u{1F512}", name: "Lock", hex: "1f512" },
      { char: "\u{1F513}", name: "Unlock", hex: "1f513" },
      { char: "\u{1F504}", name: "Refresh", hex: "1f504" },
      { char: "\u23F8\uFE0F", name: "Pause", hex: "23f8-fe0f" },
      { char: "\u25B6\uFE0F", name: "Play", hex: "25b6-fe0f" },
      { char: "\u23F9\uFE0F", name: "Stop", hex: "23f9-fe0f" },
    ],
  },
  {
    id: "people",
    label: "People",
    emojis: [
      { char: "\u{1F44B}", name: "Wave", hex: "1f44b" },
      { char: "\u{1F60A}", name: "Smile", hex: "1f60a" },
      { char: "\u{1F44D}", name: "Thumbs Up", hex: "1f44d" },
      { char: "\u{1F44F}", name: "Clapping", hex: "1f44f" },
      { char: "\u{1F64C}", name: "Raising Hands", hex: "1f64c" },
      { char: "\u{1F91D}", name: "Handshake", hex: "1f91d" },
      { char: "\u{1F389}", name: "Party Popper", hex: "1f389" },
      { char: "\u2728", name: "Sparkles", hex: "2728" },
      { char: "\u{1F4AA}", name: "Flexed Biceps", hex: "1f4aa" },
      { char: "\u{1F440}", name: "Eyes", hex: "1f440" },
      { char: "\u{1F64F}", name: "Folded Hands", hex: "1f64f" },
      { char: "\u{1F914}", name: "Thinking Face", hex: "1f914" },
      { char: "\u{1F605}", name: "Grinning Face with Sweat", hex: "1f605" },
      { char: "\u{1F602}", name: "Face with Tears of Joy", hex: "1f602" },
      { char: "\u{1F60E}", name: "Smiling Face with Sunglasses", hex: "1f60e" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    emojis: [
      { char: "\u{1F4F1}", name: "Mobile Phone", hex: "1f4f1" },
      { char: "\u{1F4BB}", name: "Laptop", hex: "1f4bb" },
      { char: "\u{1F4E8}", name: "Incoming Envelope", hex: "1f4e8" },
      { char: "\u{1F4E9}", name: "Envelope with Arrow", hex: "1f4e9" },
      { char: "\u{1F4AC}", name: "Speech Balloon", hex: "1f4ac" },
      { char: "\u{1F5E8}\uFE0F", name: "Left Speech Bubble", hex: "1f5e8-fe0f" },
      { char: "\u{1F4E2}", name: "Loudspeaker", hex: "1f4e2" },
      { char: "\u{1F508}", name: "Speaker Low Volume", hex: "1f508" },
      { char: "\u{1F507}", name: "Muted Speaker", hex: "1f507" },
      { char: "\u{1F4DE}", name: "Telephone Receiver", hex: "1f4de" },
      { char: "\u{1F4E7}", name: "E-Mail", hex: "1f4e7" },
    ],
  },
  {
    id: "common",
    label: "Common",
    emojis: [
      { char: "\u2764\uFE0F", name: "Red Heart", hex: "2764-fe0f" },
      { char: "\u2B50", name: "Star", hex: "2b50" },
      { char: "\u{1F525}", name: "Fire", hex: "1f525" },
      { char: "\u26A0\uFE0F", name: "Warning", hex: "26a0-fe0f" },
      { char: "\u{1F6AB}", name: "Prohibited", hex: "1f6ab" },
      { char: "\u27A1\uFE0F", name: "Right Arrow", hex: "27a1-fe0f" },
      { char: "\u{1F3AF}", name: "Bullseye", hex: "1f3af" },
      { char: "\u{1F4A1}", name: "Light Bulb", hex: "1f4a1" },
      { char: "\u{1F3C6}", name: "Trophy", hex: "1f3c6" },
      { char: "\u{1F451}", name: "Crown", hex: "1f451" },
      { char: "\u{1F511}", name: "Key", hex: "1f511" },
      { char: "\u{1F4C5}", name: "Calendar", hex: "1f4c5" },
      { char: "\u{1F550}", name: "One O'Clock", hex: "1f550" },
      { char: "\u{1F4CD}", name: "Round Pushpin", hex: "1f4cd" },
      { char: "\u{1F3B5}", name: "Musical Note", hex: "1f3b5" },
    ],
  },
];

/**
 * Get all emojis as a flat array (deduplicated).
 */
function getAllEmojis() {
  const seen = new Set();
  const result = [];

  for (const category of EMOJI_CATEGORIES) {
    for (const emoji of category.emojis) {
      if (!seen.has(emoji.char)) {
        seen.add(emoji.char);
        result.push(emoji);
      }
    }
  }

  return result;
}

/**
 * Build a map of emoji character -> hex code for quick lookup.
 */
function buildEmojiHexMap() {
  const map = new Map();

  for (const category of EMOJI_CATEGORIES) {
    for (const emoji of category.emojis) {
      if (!map.has(emoji.char)) {
        map.set(emoji.char, emoji.hex);
      }
    }
  }

  return map;
}

const EMOJI_HEX_MAP = buildEmojiHexMap();

/**
 * Escape HTML special characters.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "\x26\x61\x6d\x70\x3b")
    .replace(/"/g, "\x26\x71\x75\x6f\x74\x3b")
    .replace(/</g, "\x26\x6c\x74\x3b")
    .replace(/>/g, "\x26\x67\x74\x3b");
}

/**
 * Render emoji characters in a text string as <img> tags using local SVG assets.
 *
 * @param {string} text - The text to render emojis in
 * @param {string} [assetsPath="emoji-assets/"] - Path to the emoji SVG assets directory
 * @returns {string} HTML string with emojis replaced by <img> tags
 */
function renderEmojis(text, assetsPath) {
  if (!text) {
    return "";
  }

  const normalizedPath = String(assetsPath || "emoji-assets/").replace(/\/?$/, "/");

  // Match emoji characters (including variation selectors and ZWJ sequences)
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji}(?:\u200D\p{Emoji})*)/gu;

  // First escape HTML, then replace emoji chars with <img> tags
  const escaped = escapeHtml(text);

  return escaped.replace(emojiRegex, function (match) {
    const hex = EMOJI_HEX_MAP.get(match);

    if (hex) {
      return '<img class="pip-emoji" src="' + escapeHtml(normalizedPath) + escapeHtml(hex) + '.svg" alt="' + escapeHtml(match) + '" loading="lazy" />';
    }

    // If we don't have a bundled SVG, render as native emoji text
    return match;
  });
}

/**
 * Render emoji characters in a text string as native Unicode (no images).
 * Useful for input fields and fallback rendering.
 */
function renderEmojisNative(text) {
  return String(text ?? "");
}

export {
  EMOJI_CATEGORIES,
  getAllEmojis,
  buildEmojiHexMap,
  EMOJI_HEX_MAP,
  renderEmojis,
  renderEmojisNative,
  escapeHtml,
};
