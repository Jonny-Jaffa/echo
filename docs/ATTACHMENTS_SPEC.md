# Attachment feature specification

Summary
-------
Add first-class file and image attachments to messages across apps (client, reception, pip, surgery). Attachments must be uploadable from the compose UI, uploaded to the backend, and viewable/downloadable in message views.

Limits and defaults
-------------------
- Per-file max: 8 MB (default). Server-configurable via `attachments.maxFileSizeBytes`.
- Max files per message: 5.
- Max total per-message payload: 25 MB.
- Allowed default MIME / extensions (configurable whitelist):
  - Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
  - Documents: `application/pdf`, `text/plain` (txt)
  - Audio: `audio/mpeg` (mp3), `audio/wav`, `audio/ogg`
  - Optional later: video types (H264/mp4) behind feature flag.

Preview behaviour
-----------------
- Images: inline preview thumbnail in message; full preview opens in a modal or new window.
- PDFs: embed viewer (PDF.js or browser native) when possible, otherwise provide download.
- Audio: inline playback control.
- Other types: show file row with icon, filename, size and a download/open button.

API design (high-level)
-----------------------
- POST /attachments/upload
  - multipart/form-data or binary `file` field
  - request headers: `Authorization` as existing auth scheme
  - server validates size and mime, stores file, returns JSON metadata:
    {
      "id": "uuid-or-generated-id",
      "filename": "image.png",
      "mime": "image/png",
      "size": 12345,
      "url": "/attachments/:id/content",
      "thumbnailUrl": "/attachments/:id/thumbnail" // optional
    }

- GET /attachments/:id/content
  - serves raw file bytes with correct `Content-Type` and `Content-Disposition` when download requested

- GET /attachments/:id/thumbnail
  - serves a small image preview for non-image types or generated thumbnails for images (optional)

Message model extension
-----------------------
- Add `attachments` array to message objects:
  {
    "id": "msg-...",
    "text": "...",
    "attachments": [
      { "id":"att-...","filename":"x.png","mime":"image/png","size":12345,"url":"/attachments/att-.../content","thumbnailUrl":"/..." }
    ]
  }

Client flow (compose)
---------------------
- UI: add a file-picker button and drag/drop area to `message-compose` (compose row). Show selected file list with remove controls.
- Client-side validation: check size and mime against whitelist before upload; show immediate errors.
- Upload: call `POST /attachments/upload`, show per-file progress; on success receive metadata and attach to the outgoing message payload.
- Sending: include returned attachment metadata in the message object when sending via existing messaging channel.

Client flow (viewing)
---------------------
- When rendering messages, if `attachments` present, render an attachments block below message text with preview/controls according to `mime`.
- Images render `<img src="{thumbnailUrl||url}">` with click-to-open full view.
- PDFs render an `iframe` or open in new tab.

Storage and retention
---------------------
- Store files on disk under an attachments root with a directory sharding scheme (by date or id prefix).
- Store metadata in message store (existing DB or file) as lightweight references.
- Provide a cleanup/retention policy (e.g., purge attachments older than X days) configurable per deployment.

Security & validation
---------------------
- Enforce whitelist of MIME types and max size (both client and server).
- Sanitize filenames and never trust client-provided paths.
- Serve files with appropriate `Content-Type` and no executable permissions.
- Consider virus scanning on upload for production deployments.
- Rate-limit uploads per client to avoid abuse.

Testing & QA
----------
- Unit tests for upload endpoint validation and storage.
- Integration: upload → send message with attachments → render inline preview.
- Manual QA checklist: images, PDFs, audio, oversized file rejection, multiple attachments, interrupted upload recovery.

Rollout & config
----------------
- Feature-flag the UI and endpoints for staged rollout.
- Config knobs: `maxFileSizeBytes`, `maxFilesPerMessage`, `whitelistMimeTypes`, `retentionDays`, `enableThumbnails`.

Open decisions
--------------
- Exact whitelist (accept more/less file types?)
- Whether thumbnails are generated server-side or client-side.
- Whether to implement resumable uploads for large files (not required for 8 MB default).

Next steps
----------
- Confirm defaults (per-file 8 MB, allowed types). I'll then draft the API contract and server storage implementation tasks.
