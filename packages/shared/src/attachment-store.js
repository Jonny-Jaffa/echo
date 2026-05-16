import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

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

const metadataCache = new Map();
let activeConfig = normalizeAttachmentConfig();

export function initAttachments(config = {}) {
  activeConfig = normalizeAttachmentConfig(config);
  fs.mkdirSync(activeConfig.rootPath, { recursive: true });
  return {
    config: activeConfig,
    saveFile,
    getFilePath,
    getThumbnailPath,
    getMetadata,
  };
}

export function normalizeAttachmentConfig(config = {}) {
  const rootPath = String(config.rootPath || "").trim() || path.resolve(process.cwd(), "data", "attachments");
  const whitelistMimeTypes = Array.isArray(config.whitelistMimeTypes) && config.whitelistMimeTypes.length > 0
    ? config.whitelistMimeTypes
    : DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES;

  return {
    enabled: config.enabled !== false,
    rootPath: path.resolve(rootPath),
    maxFileSizeBytes: Math.max(
      1,
      Number(config.maxFileSizeBytes) || DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES,
    ),
    maxFilesPerMessage: Math.max(
      1,
      Number(config.maxFilesPerMessage) || DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE,
    ),
    whitelistMimeTypes: whitelistMimeTypes.map((mime) => String(mime || "").trim().toLowerCase()).filter(Boolean),
    cloud: {
      enabled: Boolean(config.cloud?.enabled),
      provider: String(config.cloud?.provider || "").trim(),
    },
  };
}

export async function saveFile(input, filename, mime, options = {}) {
  const config = options.config ? normalizeAttachmentConfig(options.config) : activeConfig;
  const normalizedMime = normalizeMime(mime);
  const safeFilename = sanitizeFilename(filename);

  if (!config.enabled) {
    throw createAttachmentError("ATTACHMENTS_DISABLED", "Attachments are disabled.");
  }

  if (!config.whitelistMimeTypes.includes(normalizedMime)) {
    throw createAttachmentError("UNSUPPORTED_TYPE", `Unsupported attachment type: ${normalizedMime}`);
  }

  const id = createAttachmentId();
  const shard = id.slice(0, 2);
  const directory = path.join(config.rootPath, shard, id);
  const filePath = path.join(directory, safeFilename);
  const metadataPath = path.join(directory, "metadata.json");

  fs.mkdirSync(directory, { recursive: true });

  let size = 0;

  try {
    const source = await createReadable(input);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(filePath, { mode: 0o600 });
      let settled = false;

      const settle = (error) => {
        if (settled) {
          return;
        }

        settled = true;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      source.on("data", (chunk) => {
        size += chunk.length;
        if (size > config.maxFileSizeBytes) {
          const error = createAttachmentError(
            "FILE_TOO_LARGE",
            `Attachment exceeds ${config.maxFileSizeBytes} bytes.`,
          );
          source.destroy(error);
          output.destroy(error);
        }
      });
      source.on("error", settle);
      output.on("error", settle);
      output.on("finish", () => settle());
      source.pipe(output);
    });
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }

  const metadata = {
    id,
    filename: safeFilename,
    mime: normalizedMime,
    size,
    url: `/attachments/${encodeURIComponent(id)}/content`,
    thumbnailUrl: normalizedMime.startsWith("image/")
      ? `/attachments/${encodeURIComponent(id)}/thumbnail`
      : undefined,
    path: filePath,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  metadataCache.set(id, metadata);

  return toPublicMetadata(metadata);
}

export function getFilePath(id) {
  return getMetadata(id)?.path || null;
}

export function getThumbnailPath(id) {
  const metadata = getMetadata(id);
  return metadata?.mime?.startsWith("image/") ? metadata.path : null;
}

export function getMetadata(id) {
  const normalizedId = normalizeAttachmentId(id);

  if (!normalizedId) {
    return null;
  }

  const cached = metadataCache.get(normalizedId);

  if (cached) {
    return cached;
  }

  const metadataPath = path.join(activeConfig.rootPath, normalizedId.slice(0, 2), normalizedId, "metadata.json");

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    if (metadata?.id === normalizedId && metadata?.path) {
      metadataCache.set(normalizedId, metadata);
      return metadata;
    }
  } catch {
    return null;
  }

  return null;
}

export function toPublicMetadata(metadata) {
  return {
    id: metadata.id,
    filename: metadata.filename,
    mime: metadata.mime,
    size: metadata.size,
    url: metadata.url,
    ...(metadata.thumbnailUrl ? { thumbnailUrl: metadata.thumbnailUrl } : {}),
  };
}

export function sanitizeFilename(filename) {
  const basename = path.basename(String(filename || "attachment").trim() || "attachment");
  const sanitized = basename
    .replace(/[^\w .()[\]-]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return sanitized || "attachment";
}

function normalizeMime(mime) {
  return String(mime || "application/octet-stream").trim().toLowerCase();
}

function normalizeAttachmentId(id) {
  const normalized = String(id || "").trim();
  return /^[a-f0-9-]{20,80}$/i.test(normalized) ? normalized : "";
}

function createAttachmentId() {
  return crypto.randomUUID();
}

function createAttachmentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function createReadable(input) {
  if (input instanceof Readable) {
    return input;
  }

  if (input instanceof Uint8Array || Buffer.isBuffer(input)) {
    return Readable.from(Buffer.from(input));
  }

  if (typeof input === "string") {
    return fs.createReadStream(input);
  }

  if (input?.pipe && typeof input.pipe === "function") {
    return input;
  }

  throw createAttachmentError("INVALID_INPUT", "Attachment input must be a stream, buffer, or file path.");
}
