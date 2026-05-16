# Attachments Implementation Plan (developer-ready)

This document breaks the work into concrete implementation tasks so you or Codex can build the feature.

1) API contract (implement first)
  - POST /attachments/upload
    - Auth: existing Authorization header/cookie
    - Accept: multipart/form-data `file` (multiple allowed) OR single file per call
    - Response 200 JSON (single file):
      {
        "id":"<attachment-id>",
        "filename":"name.png",
        "mime":"image/png",
        "size":12345,
        "url":"/attachments/<id>/content",
        "thumbnailUrl":"/attachments/<id>/thumbnail"
      }
    - Errors: 400 for validation, 413 for too large, 415 for unsupported type, 401 for auth

  - GET /attachments/:id/content
    - Serves attachment bytes with `Content-Type` and `Content-Disposition: inline|attachment`

  - GET /attachments/:id/thumbnail
    - Optional: serve generated thumbnail or scaled image

2) Storage module (shared)
  - Create `packages/shared/src/attachments.js` (or `packages/shared/src/attachment-store.js`) with:
    - `initAttachments(opts)` — configure `rootPath`, `maxFileSizeBytes`, `whitelist`
    - `saveFile(fileStream, filename, mime)` -> returns metadata `{id, filename, mime, size, path}`
    - `getFilePath(id)` -> absolute path
    - `getThumbnailPath(id)` -> optional
  - Storage layout: `<rootPath>/<YYYY-MM-DD>/<id>` or `<rootPath>/<id[0:2]>/<id>` for sharding

3) Integrate server endpoints
  - Where: integrate into the app that already hosts HTTP for messages (e.g. `apps/reception/src/server.js` or app main process)
  - Add routes that call shared module `saveFile` and return JSON metadata
  - Ensure route is behind existing auth/IPC

4) Client helper (shared)
  - Create `packages/shared/src/attachment-client.js` with:
    - `uploadFile(file, onProgress) -> Promise<metadata>`
    - `downloadUrl(id)` -> returns absolute URL to `/attachments/:id/content`
  - Use `fetch` with `FormData` and `XMLHttpRequest`/`fetch` with `ReadableStream` for progress support

5) UI changes (client renderer)
  - Files to edit: `apps/client/src/renderer/panel.html` and `apps/client/src/renderer/panel.js` (or `panel-main.cjs` as needed)
  - HTML additions in `message-compose` (example):
    - Add hidden input and button:
      ```html
      <input id="attachment-input" type="file" multiple hidden />
      <button id="attachment-button" type="button" title="Attach file">Attach</button>
      <div id="attachment-list" class="attachment-list" aria-live="polite"></div>
      ```
  - CSS: add `.attachment-list` and lightweight thumbnails/rows in `panel.css` or `shared-panel.css`

6) Compose flow
  - When user picks files or drags them in:
    - Validate size and MIME on client (against config/whitelist)
    - For each file, call `uploadFile(file, onProgress)`; show upload progress UI in `attachment-list`
    - On success, receive metadata and attach to the outgoing message payload
    - When pressing Send, include `attachments` array with metadata in the message send payload

7) Message model changes
  - Message JSON schema: add `attachments: Attachment[]`
    - `Attachment = {id, filename, mime, size, url, thumbnailUrl}`
  - Persist attachments metadata with messages (where messages are saved currently)

8) Message rendering
  - When rendering messages in `message-list`:
    - Render attachments block under message text
    - For images: use thumbnail or scaled image tag and click-to-open full
    - For PDFs: embed `iframe` (or open new tab) with `download` fallback
    - For audio: use `<audio controls src="...">`
    - For other files: show file row with filename, size and download button

9) Security & validation
  - Server must re-validate MIME and size regardless of client checks
  - Sanitize `filename` for display only; store server-side using generated id
  - Set correct `Content-Type` when serving; use `Content-Disposition: attachment` for unknown binary types
  - Add rate-limiting per client and per-route

10) Tests and QA
  - Unit tests:
    - storage.saveFile rejects oversized and unsupported MIME
    - upload endpoint returns expected metadata
  - Integration test (manual/automated):
    - Upload image → Send message → Message view displays thumbnail and opens full image
  - Manual QA checklist: multiple files, large file rejection, offline/resume behaviour, thumbnails

11) Config & feature flag
  - Add config keys in `config/config.json` or existing app config:
    - `attachments.rootPath`
    - `attachments.maxFileSizeBytes` (default 8*1024*1024)
    - `attachments.maxFilesPerMessage` (default 5)
    - `attachments.whitelistMimeTypes`
    - `features.attachments.enabled` (feature flag)

12) Implementation notes for Codex
  - Keep server-side functions minimal and synchronous friendly (use streams where possible)
  - Prefer small helper first: implement single-file upload, then multi-file batching client-side
  - Add logs for upload success/failure to existing app logs

Files to create/update (suggested)
- `packages/shared/src/attachment-store.js`  (storage helpers)
- `packages/shared/src/attachment-client.js` (client helper)
- `apps/reception/src/server.js` (or equivalent) — add routes
- `apps/client/src/renderer/panel.html` — add file input/button/container
- `apps/client/src/renderer/panel.js` — add UI wiring + upload flow
- `apps/client/src/panel-main.cjs` or equivalent — ensure serving attachments endpoints if needed
- `docs/ATTACHMENTS_SPEC.md` (already added)
- `docs/ATTACHMENTS_IMPLEMENTATION_PLAN.md` (this file)

Estimated effort (rough)
- Draft API + shared storage: 4–6 hours
- Server routes: 1–2 hours
- Client UI + upload flow: 4–8 hours
- Message rendering + tests: 3–5 hours

Next actionable step for Codex
- Implement `packages/shared/src/attachment-store.js` and unit tests for saveFile/getFilePath.
- Then implement `POST /attachments/upload` in `apps/reception/src/server.js` wired to `attachment-store`.
