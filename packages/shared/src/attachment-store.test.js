import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initAttachments, saveFile } from "./attachment-store.js";

test("saveFile rejects unsupported MIME types", async () => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "pip-attachments-"));
  initAttachments({
    rootPath,
    whitelistMimeTypes: ["image/png"],
    maxFileSizeBytes: 1024,
  });

  await assert.rejects(
    () => saveFile(Buffer.from("hello"), "hello.exe", "application/x-msdownload"),
    /Unsupported attachment type/,
  );

  fs.rmSync(rootPath, { recursive: true, force: true });
});

test("saveFile rejects oversized files", async () => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "pip-attachments-"));
  initAttachments({
    rootPath,
    whitelistMimeTypes: ["text/plain"],
    maxFileSizeBytes: 4,
  });

  await assert.rejects(
    () => saveFile(Buffer.from("too large"), "note.txt", "text/plain"),
    /exceeds 4 bytes/,
  );

  fs.rmSync(rootPath, { recursive: true, force: true });
});

test("saveFile stores metadata for supported files", async () => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "pip-attachments-"));
  initAttachments({
    rootPath,
    whitelistMimeTypes: ["text/plain"],
    maxFileSizeBytes: 1024,
  });

  const metadata = await saveFile(Buffer.from("ok"), "../note.txt", "text/plain");

  assert.equal(metadata.filename, "note.txt");
  assert.equal(metadata.mime, "text/plain");
  assert.equal(metadata.size, 2);
  assert.match(metadata.url, /^\/attachments\/.+\/content$/);

  fs.rmSync(rootPath, { recursive: true, force: true });
});
