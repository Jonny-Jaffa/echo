# Pip Dev Plan

Last updated: 2026-05-05

## Branding Note

- Effective 2026-04-26, the product name is `Pip`
- Future user-facing text should use `Pip` consistently
- This includes:
  - app window titles
  - tray labels and tooltips
  - installer product names
  - dialog copy
  - documentation headings and instructions
- Internal package names, folder names, and legacy identifiers may still temporarily use older naming where changing them would risk breaking workspace wiring; user-facing branding should still read `Pip`
- Windows installers should now ship as `Pip Reception` and `Pip Surgery` without any `Test` suffix in release filenames

## Current Phase

Phase 6: Unified Product and Role Selection

## Goals

- Establish a clean workspace for reception and surgery apps
- Create a shared config and message model
- Stand up a reception-side HTTP and WebSocket service on the LAN
- Build a minimal reception gadget window for incoming alerts
- Add a surgery client simulator that fetches config and sends sample notifications
- Keep project context documented for future development sessions

## Progress Snapshot

### Completed

- Project scaffold initialized
- Living dev documentation created
- Initial centralized config created
- Reception LAN HTTP/WebSocket service implemented
- Surgery client simulator implemented
- End-to-end notification flow validated in a headless smoke test
- Reception Electron app startup validated in this environment after clearing `ELECTRON_RUN_AS_NODE`
- Gadget queue handling implemented
- Gadget controls added for always-on-top, auto-hide, dismiss/next, and minimized mode
- In-app admin panel added to reception window
- Rooms, actions, button mappings, and display settings can now be edited from the app
- Shared config normalization and validation added before persistence
- Optional surgery-side on-screen control panel added
- Direct Elgato Stream Deck Neo integration added to the surgery client
- Surgery client now detects connected Stream Deck hardware and maps button presses through `buttonMappings`
- Neo USB detection verified on macOS in this environment
- Windows x64 installer packaging added for reception and surgery
- Surgery installs now persist room/device identity locally for multi-room LAN deployment
- Reception tray icon support and startup settings have been added for installed desktop use
- Surgery app now includes a full messaging-first desktop panel with:
  - live chat with reception and other rooms
  - message groups
  - pinned recipient threads
  - quick-action on-screen buttons
  - separate settings window
- Reception app now includes live chat UI and its own separate settings window
- Both apps now use coordinated frameless custom-window shells with tray/about support
- Surgery panel now supports persistent display modes:
  - `Messages`
  - `Buttons`
  - `Both`
- Role-unification direction has been assessed and agreed at a high level:
  - one product / one installer
  - two explicit runtime roles
  - no hard merge into one always-shared panel UI
- Hidden role-chooser renderer/window infrastructure has been added to both current apps as a migration foundation
- Current separate apps now enforce role-compatible startup instead of silently booting the wrong runtime
- A dedicated `apps/pip` unified bootstrap app scaffold now exists with:
  - its own Electron main/preload/renderer
  - persisted local role state
  - a visible role-selection shell for the future one-installer flow
  - transitional in-process role service startup:
    - reception LAN host
    - room hardware client
  - root launch scripts:
    - `npm run dev:pip`
    - `npm run start:pip`
- The unified bootstrap can now hand off from the selected saved role into the existing full role workspace:
  - `Reception` opens the current reception app
  - `Room` opens the current client panel
  - the transitional in-process runtime is stopped before handoff to avoid port/hardware conflicts
- Fixed blank settings panel when Reception is offline — now shows settings with Connection tab instead of waiting view
- Added persistent "Reception Offline" banner indicator in surgery app main panel

### In Progress

- Windows packaging hardening and installer validation
- Final multi-machine deployment validation on physical reception/surgery PCs
- Architecture planning for a single packaged `Pip` product with role-based startup
- Full direct in-app hosting of the role-specific Reception and Room windows from the future `Pip` app

### Next

- Test the current build with Reception offline to verify the banner and settings panel behavior
- Evaluate whether P2P room messaging (Future Feature) is worth implementing
- Design first-run role selection for a single packaged `Pip` app
- [x] Expose the role chooser from a deliberate settings/support path
- Decide whether the first unified build should reuse one renderer entrypoint or introduce a dedicated bootstrap main process
- Extract/share common shell, messaging, and settings-window pieces where it reduces duplication safely
- Keep reception server startup isolated behind `Reception` mode only
- Keep room/Neo startup isolated behind `Room` mode only
- Add icon upload or asset selection workflow
- Add safer network-port change handling and service restart flow
- Click-test real Neo button presses end to end against reception actions
- Validate the pairing-code rollout flow on a fresh reception install and a fresh room install
- Decide whether to keep direct Neo mode only or also ship an official Stream Deck plugin path
- Validate Windows installer and uninstaller behavior from a Windows-built release if NSIS issues continue

## Phase Breakdown

### Phase 1: Foundations

- [x] Create workspace structure
- [x] Define initial `config.json`
- [x] Implement reception HTTP API
- [x] Implement reception WebSocket broadcast/service
- [x] Implement minimal gadget UI
- [x] Implement surgery client simulation
- [x] Validate message flow with a headless smoke test

### Phase 2: Reception UI

- [x] Add gadget layout refinements
- [x] Add always-on and minimized behavior settings
- [x] Add dismiss and auto-hide controls
- [x] Add notification queue handling
 - [x] Add thread sidebar to Reception so non-room users can view and participate in message threads

### Phase 3: Config Panel

- [x] Build room management UI
- [x] Build button/action mapping editor
- [ ] Support icon upload or asset selection
- [x] Persist config edits safely
 - [x] Add `Hide from alert section` toggle in room/user setup and rename existing `Hide room from UI` → `Hide from entire UI`
 - [x] Enforce mutual exclusivity for `Hide from alert section` and `Hide from entire UI` at both UI and server/config validation layers
 - [x] Change label `Room` to `Room/User` across Reception settings and UIs to support non-room users
 - [x] Add config schema versioning and a migration to preserve and rename existing visibility settings

### Phase 4: Elgato Integration

- [x] Integrate Elgato Neo / Stream Deck library
- [x] Map physical buttons to action IDs
- [x] Sync labels/icons to device where supported
- [x] Test USB detection on macOS
- [ ] Test USB detection on Windows

### Phase 5: Client Sync and Deployment

- [x] Harden reconnect and retry behavior
- [x] Add status and diagnostics
- [x] Package reception app
- [x] Package surgery client
- [~] Validate multi-machine LAN flow
- [x] Add optional on-screen surgery control panel
- [x] Add background app-to-app pairing/authentication
- [x] Add audit logging and safer config writes

### Phase 6: Unified Product and Role Selection

- [ ] Add a persisted first-run role chooser
- [x] Add persisted runtime-role state and hidden chooser-shell foundation
- [x] Support guarded role-compatible startup in the current separate builds
- [x] Add a dedicated unified `apps/pip` bootstrap scaffold
- [x] Start the transitional role service stack from `apps/pip`
- [x] Add a transitional handoff from `apps/pip` to the existing full Reception/Room workspaces
- [ ] Support full explicit runtime modes from one packaged app:
  - `Reception`
  - `Room`
- [ ] Consolidate packaging into one installer/app identity
- [ ] Keep role-specific startup logic isolated per mode
- [ ] Reuse shared shell/messaging/settings primitives where safe
- [ ] Preserve existing messaging, room-action, and Neo workflows during the migration
 - [x] Update developer docs and acceptance criteria to include thread sidebar, newly-named `Room/User` label, and visibility-toggle migration
 - [x] Add automated tests for visibility toggles and server-side validation

## Working Assumptions

- Reception remains the source of truth for shared config and LAN coordination
- LAN installs are protected with a shared background pairing code rather than being fully trust-based
- `Reception` and `Room` are distinct runtime roles even if they eventually ship as one packaged app
- Role-specific service startup should stay isolated:
  - reception mode starts the local server/runtime
  - room mode starts the Neo/client/runtime
- UI should stay compact and low-noise on the reception desk
- The surgery app is now a primary end-user room UI, not only a background service helper

## Decision Notes

- Use npm workspaces for a simple multi-app repo layout
- Keep shared business rules in `packages/shared`
- Use HTTP for config/bootstrap and WebSocket for live events/status
- Keep the surgery side able to run without hardware, while using direct Neo integration when a device is present
- Do not hard-merge reception and surgery into one always-shared panel window
- Preferred consolidation path is one product with explicit role choice and role-specific windows/startup behavior

## Verification Notes

- Confirmed `/config`, `/register`, and WebSocket notification flow using a local Node-based smoke test
- Confirmed the client can fetch config, identify itself, and send a sample notification
- Confirmed the Electron reception app starts successfully once `ELECTRON_RUN_AS_NODE` is cleared from the launch environment
- Confirmed `POST /notify` can add additional alerts after startup, supporting queue-oriented gadget behavior
- Confirmed the Phase 3 code path still launches the reception app and accepts client notifications
- Confirmed the surgery client can detect and open a connected Stream Deck Neo directly on macOS
- Confirmed the surgery client can connect to reception, receive config, and sync Neo key colors from mapped actions
- Confirmed the surgery app now shows a "Reception Offline" banner when the WebSocket connection drops
- Confirmed the settings panel now shows settings (not waiting view) when Reception is offline
- Added Reception thread sidebar, Room/User visibility toggles, schema migration for `hideFromEntireUI`, and validation for mutually exclusive visibility settings
- A visual/manual review of the gadget window in the real desktop workflow is still recommended

## Future Features

### Peer-to-Peer Room Messaging (Optional)

**Status:** Deferred — not yet implemented

**Description:** Allow surgery apps to send chat messages directly to each other when the Reception app is not running, without requiring a central server.

**Why this matters:** Currently, when Reception is offline, surgery apps show a "Reception Offline" banner and messaging between rooms is unavailable. This feature would enable room-to-room messaging to continue working even without Reception, making the system more resilient.

**Proposed approach:** Lightweight peer-to-peer messaging layer that activates only when Reception is confirmed offline:

1. **Peer Discovery** — Extend the existing UDP discovery mechanism (`discoverReceptionServer()` in `panel-main.cjs`) so surgery apps can discover each other directly on the LAN when Reception doesn't respond.

2. **Peer Server** — Each surgery app runs a tiny HTTP server (a few routes) that:
   - Serves its room identity (name, color from local settings)
   - Accepts incoming chat messages from other surgery apps
   - Forwards messages to its own renderer via IPC

3. **Peer Client** — When Reception is offline, the surgery app:
   - Discovers other surgery apps via UDP broadcast
   - Connects to them directly via HTTP
   - Shows available rooms in the thread list
   - Sends messages directly to peer surgery apps

4. **Seamless Fallback** — When Reception comes back online, the app switches back to the normal Reception-based messaging path.

**Estimated scope:**
- New `PeerDiscovery` module (extends existing UDP discovery) — ~100 lines
- New `PeerServer` module (lightweight HTTP server for receiving messages) — ~100 lines
- New `PeerClient` module (HTTP client for sending messages to peers) — ~50 lines
- Integration in `panel-main.cjs` to start/stop the peer server — ~50 lines
- Integration in `panel.js` renderer to show peer rooms and handle fallback — ~100 lines
- **Total: ~400 lines of new code**

**What stays the same:**
- No changes to the Reception server
- No changes to the config structure
- No changes to the existing WebSocket messaging flow
- No changes to the database or persistence layer
- No changes to the shared packages

**Risks and considerations:**
- **Port conflicts:** Each surgery app needs a unique port. Can use `roomId` to derive a port (e.g., `3210 + roomIndex`) or use ephemeral ports broadcast via discovery.
- **Firewall/network isolation:** Direct machine-to-machine HTTP may be blocked on some networks. UDP discovery would fail gracefully, showing "no rooms available."
- **Message ordering:** Without a central server, messages between peers could arrive out of order. Each message would need a timestamp + sequence number.
- **Partial message history:** A surgery app that was offline won't have messages sent between other peers during that time. Acceptable — same as any messaging app being offline.
- **Authentication:** In P2P mode, skip the access key check (local network only). Minor security consideration.
- **No message persistence:** Messages are ephemeral in P2P mode (in-memory only). Full history is available again when Reception comes back online.

**Decision:** This feature adds meaningful resilience but also introduces complexity. It should be implemented only if users regularly need messaging when Reception is unavailable. The current "Reception Offline" banner provides clear feedback about the limitation.
