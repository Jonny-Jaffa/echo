export const DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE = 5;
export const DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES = [
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

let clientConfig = {
  baseUrl: "",
  accessKey: "",
  enabled: true,
  maxFileSizeBytes: DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES,
  maxFilesPerMessage: DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE,
  whitelistMimeTypes: DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES,
};

export function configureAttachmentClient(config = {}) {
  clientConfig = {
    ...clientConfig,
    ...config,
    baseUrl: String(config.baseUrl ?? clientConfig.baseUrl ?? "").replace(/\/+$/, ""),
    accessKey: String(config.accessKey ?? clientConfig.accessKey ?? "").trim(),
    enabled: config.enabled !== false,
    maxFileSizeBytes: Math.max(
      1,
      Number(config.maxFileSizeBytes) || clientConfig.maxFileSizeBytes || DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES,
    ),
    maxFilesPerMessage: Math.max(
      1,
      Number(config.maxFilesPerMessage) || clientConfig.maxFilesPerMessage || DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE,
    ),
    whitelistMimeTypes: Array.isArray(config.whitelistMimeTypes) && config.whitelistMimeTypes.length > 0
      ? config.whitelistMimeTypes.map((mime) => String(mime || "").trim().toLowerCase()).filter(Boolean)
      : clientConfig.whitelistMimeTypes,
  };

  return getAttachmentClientConfig();
}

export function getAttachmentClientConfig() {
  return {
    ...clientConfig,
    whitelistMimeTypes: [...clientConfig.whitelistMimeTypes],
  };
}

export function validateAttachmentFile(file, existingCount = 0) {
  if (!clientConfig.enabled) {
    throw createAttachmentClientError("ATTACHMENTS_DISABLED", "Attachments are disabled.");
  }

  if (existingCount >= clientConfig.maxFilesPerMessage) {
    throw createAttachmentClientError(
      "TOO_MANY_FILES",
      `You can attach up to ${clientConfig.maxFilesPerMessage} files per message.`,
    );
  }

  const mime = getFileMime(file);

  if (!clientConfig.whitelistMimeTypes.includes(mime)) {
    throw createAttachmentClientError("UNSUPPORTED_TYPE", "This file type is not supported.");
  }

  if (Number(file?.size || 0) > clientConfig.maxFileSizeBytes) {
    throw createAttachmentClientError(
      "FILE_TOO_LARGE",
      `Files must be ${formatBytes(clientConfig.maxFileSizeBytes)} or smaller.`,
    );
  }

  return true;
}

export function getFileMime(file) {
  const explicitMime = String(file?.type || "").trim().toLowerCase();

  if (explicitMime) {
    return explicitMime;
  }

  const filename = String(file?.name || "").trim().toLowerCase();

  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".gif")) return "image/gif";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".txt")) return "text/plain";
  if (filename.endsWith(".mp3")) return "audio/mpeg";
  if (filename.endsWith(".wav")) return "audio/wav";
  if (filename.endsWith(".ogg")) return "audio/ogg";

  return "";
}

export function uploadFile(file, onProgress) {
  validateAttachmentFile(file);

  if (!clientConfig.baseUrl) {
    return Promise.reject(createAttachmentClientError("MISSING_BASE_URL", "Attachment server is not configured."));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file, file.name || "attachment");

    xhr.open("POST", `${clientConfig.baseUrl}/attachments/upload`);

    if (clientConfig.accessKey) {
      xhr.setRequestHeader("Authorization", `Bearer ${clientConfig.accessKey}`);
      xhr.setRequestHeader("x-pip-key", clientConfig.accessKey);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => reject(createAttachmentClientError("UPLOAD_FAILED", "Attachment upload failed."));
    xhr.onload = () => {
      let result = null;

      try {
        result = JSON.parse(xhr.responseText || "{}");
      } catch {
        reject(createAttachmentClientError("INVALID_RESPONSE", "Attachment upload returned an invalid response."));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(result);
        return;
      }

      reject(createAttachmentClientError(result?.code || "UPLOAD_FAILED", result?.error || "Attachment upload failed."));
    };

    xhr.send(form);
  });
}

export function downloadUrl(id) {
  const attachmentId = encodeURIComponent(String(id || "").trim());
  return withAccessKey(`${clientConfig.baseUrl}/attachments/${attachmentId}/content`);
}

export function resolveAttachmentUrl(url) {
  const value = String(url || "").trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("file:") || value.startsWith("data:")) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return withAccessKey(value);
  }

  return withAccessKey(`${clientConfig.baseUrl}${value.startsWith("/") ? "" : "/"}${value}`);
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(value % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}

function createAttachmentClientError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function withAccessKey(url) {
  if (!clientConfig.accessKey) {
    return url;
  }

  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("accessKey", clientConfig.accessKey);
    return nextUrl.toString();
  } catch {
    return url;
  }
}
