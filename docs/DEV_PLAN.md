# Echo Dev Plan

Last updated: 2026-04-26

## Branding Note

- Effective 2026-04-20, the product name is `Echo`
- Future user-facing text should use `Echo` consistently
- This includes:
  - app window titles
  - tray labels and tooltips
  - installer product names
  - dialog copy
  - documentation headings and instructions
- Internal package names, folder names, and legacy identifiers may still temporarily use older naming where changing them would risk breaking workspace wiring; user-facing branding should still read `Echo`
- Windows installers should now ship as `Echo Reception` and `Echo Surgery` without any `Test` suffix in release filenames

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
- A dedicated `apps/echo` unified bootstrap app scaffold now exists with:
  - its own Electron main/preload/renderer
  - persisted local role state
  - a visible role-selection shell for the future one-installer flow
  - transitional in-process role service startup:
    - reception LAN host
    - room hardware client
  - root launch scripts:
    - `npm run dev:echo`
    - `npm run start:echo`
- The unified bootstrap can now hand off from the selected saved role into the existing full role workspace:
  - `Reception` opens the current reception app
  - `Room` opens the current client panel
  - the transitional in-process runtime is stopped before handoff to avoid port/hardware conflicts

### In Progress

- Windows packaging hardening and installer validation
- Final multi-machine deployment validation on physical reception/surgery PCs
- Architecture planning for a single packaged `Echo` product with role-based startup
- Full direct in-app hosting of the role-specific Reception and Room windows from the future `Echo` app

### Next

- Design first-run role selection for a single packaged `Echo` app
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
- Validate Windows installer and uninstaller behavior from a Windows-built release if NSIS issues persist

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

### Phase 3: Config Panel

- [x] Build room management UI
- [x] Build button/action mapping editor
- [ ] Support icon upload or asset selection
- [x] Persist config edits safely

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
- [x] Add a dedicated unified `apps/echo` bootstrap scaffold
- [x] Start the transitional role service stack from `apps/echo`
- [x] Add a transitional handoff from `apps/echo` to the existing full Reception/Room workspaces
- [ ] Support full explicit runtime modes from one packaged app:
  - `Reception`
  - `Room`
- [ ] Consolidate packaging into one installer/app identity
- [ ] Keep role-specific startup logic isolated per mode
- [ ] Reuse shared shell/messaging/settings primitives where safe
- [ ] Preserve existing messaging, room-action, and Neo workflows during the migration

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
- A visual/manual review of the gadget window in the real desktop workflow is still recommended
