# Pip Dev Log

## 2026-04-16

### Session 1

- Created initial repository structure for `apps/reception`, `apps/client`, `packages/shared`, `config`, and `docs`
- Added living documentation:
  - `docs/DEV_PLAN.md`
  - `docs/DEV_LOG.md`
- Added initial centralized `config/config.json`
- Planned first working foundation:
  - Reception Electron gadget window
  - Reception HTTP/WebSocket service
  - Shared message/config utilities
  - Surgery client simulator with config sync
- Installed workspace dependencies with npm workspaces
- Implemented reception service endpoints:
  - `GET /health`
  - `GET /config`
  - `GET /notifications`
  - `POST /register`
  - `POST /notify`
- Implemented WebSocket welcome, identify, and notification handling
- Implemented a minimal reception gadget renderer for room, message, timestamp, and dismiss flow
- Implemented a Node-based surgery client simulator that:
  - fetches config
  - registers with reception
  - opens a WebSocket connection
  - sends a sample notification payload
- Verified end-to-end notification flow locally in a headless smoke test
- Diagnosed Electron startup issue caused by `ELECTRON_RUN_AS_NODE=1` in the environment
- Updated reception launch scripts to clear `ELECTRON_RUN_AS_NODE`
- Fixed workspace-relative config path resolution so reception can find `config/config.json` when launched from its app directory
- Validated that the Electron reception app now starts and accepts client notifications without runtime errors
- Began Phase 2 reception UI work
- Moved active-notification and pending-queue state into the Electron main process
- Added reception gadget controls for:
  - always-on-top
  - auto-hide toggle
  - minimized mode
  - dismiss and next-in-queue handling
- Updated the gadget layout to show pending queue counts and compact minimized rendering
- Persisted display setting changes back to `config/config.json`
- Verified Phase 2 service flow by sending multiple alerts and confirming they were retained in the notification list
- Began Phase 3 config panel work
- Added shared config normalization and validation helpers before saving
- Updated the reception server to read the current config state dynamically
- Added renderer-accessible config IPC methods for load/save flows
- Built an in-app admin panel for:
  - room management
  - action management
  - device button mapping management
  - network and display settings
- Added admin mode window resizing so the reception app can switch between compact gadget and wider editor layouts
- Verified the reception app still launches and accepts live client notifications after the Phase 3 changes
- Fixed admin mode usability issue where the frameless window could not be dragged and could expand off-screen
- Constrained admin-mode window sizing to the active display work area and added draggable header regions plus scrollable admin content
- Added acknowledgement broadcast flow so dismissing an alert at reception notifies the matching surgery client
- Added client-side local acknowledgement sound playback using OS-native commands without extra dependencies
- Added an optional Electron-based surgery control panel with 8 on-screen buttons
- Added requested top-row panel icons: `15`, `30`, calendar, and heart
- Added launch scripts for the optional surgery panel from the root workspace

### Notes

- The workspace started empty and not yet under git
- Initial implementation focuses on proving end-to-end LAN event flow before admin tooling or Elgato hardware integration
- One npm audit warning remains after install and has not been addressed yet
- The gadget still deserves a visual/manual desktop review even though launch and notification delivery are now working
- The admin panel save flow is implemented, but it still deserves a manual click-through in the real Electron window for UX validation

### Next Checkpoint

- Confirm reception Electron app launches cleanly on desktop
- Confirm gadget and admin panel visually render as expected
- Click-test save flows for rooms, actions, mappings, and display settings
- Start Elgato Neo integration spike

## 2026-04-18

### Session 2

- Confirmed macOS can see the connected Elgato Stream Deck Neo over USB
  - Product: `Stream Deck Neo`
  - Vendor: `Elgato`
  - Vendor ID: `4057`
  - Product ID: `154`
- Reviewed direct-hardware and official Stream Deck SDK options
- Chose direct hardware integration for Phase 4 so the app can use the Neo without requiring a custom Stream Deck plugin workflow
- Added `@elgato-stream-deck/node` to the surgery client workspace
- Reworked `apps/client/src/index.js` from a sample-only simulator into a real surgery client service that:
  - fetches and refreshes config from reception
  - registers and identifies with reception over WebSocket
  - listens for reception `room:ping` events and plays the existing local sound
  - detects and opens a connected Stream Deck Neo
  - maps Neo button presses through `config.buttonMappings`
  - sends the matching configured notification payload for the selected surgery room
  - colors mapped hardware keys using the configured action colors
  - reconnects when the WebSocket drops
  - retries hardware detection when no Stream Deck is connected yet
- Verified locally that the surgery client can:
  - connect to the reception server
  - receive live config
  - detect and open the connected Stream Deck Neo
  - sync mapped key colors to the Neo
- Added macOS packaging for the reception and surgery apps using `electron-builder`
- Added installer documentation in `docs/INSTALL.md`
- Fixed reception packaged-config handling so the installed reception app seeds a writable `config.json` into the app's user-data folder on first launch
- Confirmed the packaged reception app bundle now includes the default config as an extra resource at `Contents/Resources/config/config.json`
- Diagnosed the remaining macOS reception-launch blocker as app-bundle launch/security behavior:
  - the packaged app is being rejected by `spctl` as an ad-hoc signed build
  - the process exits before Electron reaches the reception `main.js` entrypoint
  - a proper signed/notarized macOS build is still required for reliable launch outside local development
- Added a dedicated local Mac reception test launcher:
  - `npm run start:reception:mac-test`
  - `scripts/run-reception-mac-test.sh`
- Updated install docs so the reception Mac testing path is explicit while Apple signing/notarization is still pending

### Notes

- Current Phase 4 implementation uses direct hardware access, not the official Elgato plugin SDK
- This means the Neo can be used directly without building a custom Stream Deck plugin, but richer on-device artwork/text sync is still pending
- Windows hardware verification is still outstanding
- For local Mac testing, the development launch path remains the reliable way to run the reception app until Apple signing/notarization is added

## 2026-04-19

### Session 1

- Added LAN auto-discovery support so surgery installs can find the reception machine more easily on the local network
- Added persistent surgery-side room/device identity so multiple surgery PCs can coexist on the same LAN without collisions
- Added reception startup support and persisted gadget window position
- Added a visible read-only detected server address field in reception settings
- Added reception tray icon support using a generated branded icon instead of an empty image
- Bumped workspace/app versions from `0.1.0` to `0.1.1`
- Switched default Windows build scripts to explicit x64 targets to reduce installer mismatch on Windows 11 systems
- Updated install documentation for the current Windows installer flow
- Added a dedicated packaged tray/app icon asset for reception and switched the reception tray to load from that asset
- Renamed the reception Windows install identity to a temporary test package name and app ID so uninstall behavior can be tested separately from the earlier install

### Notes

- Repeated Windows uninstall failures after a fresh reinstall point more strongly to the generated NSIS uninstaller than to stale registry state
- There is prior electron-builder issue history for NSIS uninstall failures when Windows installers are produced from macOS
- If the rebuilt `0.1.1` Windows installers still uninstall badly, the next step should be to generate the NSIS installers on Windows rather than macOS

## 2026-04-20

### Session 1

- Added a persistent branding note to the dev plan so future sessions treat `Pip` as the canonical product name
- Began project-wide user-facing rename to `Pip`
- Confirmed the rename should cover app titles, UI labels, tray text, installer product names, dialog copy, and documentation
- Promoted the temporary reception test installer identity into the proper release branding:
  - `Pip Reception`
  - `Pip Surgery`
- Aligned workspace package versions for the next Windows release build

### Notes

- For stability, internal package/folder identifiers may temporarily retain older names where they are not user-facing
- User-facing branding should now consistently read `Pip`

### Session 2

- Investigated Windows-installed surgery app issue where the Stream Deck Neo remained visually blank even though surgery-to-reception messaging still worked
- Reworked surgery-side Neo rendering to prefer Electron's built-in SVG rasterization in the installed app, while retaining `resvg-wasm` as a fallback renderer
- Added defensive Neo rendering fallbacks so button/LCD sync can still paint simple fallback artwork instead of aborting the entire render pass
- Added surgery hardware status reporting from the background hardware service into the panel UI and the hardware log
- Surfaced a visible `Neo:` status line in the surgery panel so installed Windows machines can show whether the device is connected, waiting, busy, stopped, or erroring
- Bumped workspace/app versions from `0.1.3` to `0.1.4` for the next installer output

### Session 3

- Diagnosed the packaged surgery startup failure shown in the panel status as a shared-package import problem rather than a Stream Deck problem
- Fixed `@pip/shared` so config-path resolution is lazy and only happens when `loadConfig()` or `saveConfig()` are actually called
- Removed the packaged surgery app's accidental requirement for a local bundled `config.json` just to import `buildNotificationPayload()`
- Bumped workspace/app versions from `0.1.4` to `0.1.5` for the next installer output

### Session 4

- Added a dedicated surgery-panel startup waiting state for the case where the surgery computer is running before reception is available
- The waiting state now shows only the Pip logo, an offline indicator, and the message `Waiting to connect to reception`
- Fixed the Neo fallback button renderer so fallback mode still paints button labels instead of blank lit buttons
- Increased the reception gadget alert icon size
- Bumped workspace/app versions from `0.1.5` to `0.1.6` for the next installer output

### Session 5

- Diagnosed the remaining Windows Neo issue as a text-rendering problem rather than a button mapping problem, because button presses, state colours, and flash behaviour were already working
- Changed the surgery Neo button artwork to draw labels directly with the built-in bitmap font instead of relying on SVG text rendering
- Changed the Neo LCD clock artwork to draw the day, date, and time directly with the bitmap font so the clock strip no longer depends on SVG font support
- Added bitmap glyphs for punctuation used by the LCD clock, including `:`, `/`, `-`, and `.`
- Changed the Neo LCD flash banner to render `RECEPTION ALERT` using the same bitmap text path for consistency on Windows
- Bumped workspace/app versions from `0.1.6` to `0.1.7` for the next installer output

### Session 6

- Compared the current Neo renderer with the user-provided `old version` prototype to recover the cleaner text rendering path
- Confirmed the old prototype used SVG text with the `Avenir Next, Segoe UI, Arial, sans-serif` font stack for the Neo button labels and LCD display, rasterized through `resvg-wasm`
- Restored that SVG text rendering method for the Neo main buttons, LCD clock, and LCD alert banner in the current surgery app
- Kept the bitmap artwork functions in place as fallback helpers so the app still has a backup path if SVG rendering fails again
- Bumped workspace/app versions from `0.1.7` to `0.1.8` for the next installer output

### Session 7

- Confirmed the restored SVG-font Neo approach still does not render text on the packaged Windows surgery build, even though button state colours and button presses still work
- Added safe WebSocket shutdown handling so closing the surgery app before reception connection is established no longer throws `WebSocket was closed before the connection was established`
- Added a hidden Electron canvas renderer for Neo button labels and LCD text so the packaged surgery app can use Chromium text rendering instead of SVG font resolution
- Kept the bitmap artwork functions as the final fallback path if both canvas and SVG-based rendering fail
- Built a surgery-only release and bumped the surgery/shared workspace versions from `0.1.8` to `0.1.9`
- Confirmed on the user-tested `0.1.9` surgery build that the hidden Electron canvas renderer displays Neo button text and LCD text correctly on the packaged Windows app

### Notes

- From this point forward, every newly generated installer/setup build must use a bumped version number instead of overwriting the previous release number

## 2026-04-22

### Session 1

- Replaced the old reception/surgery alert sounds with bundled per-app WAV assets so both apps now use the same local sound files instead of mixed OS/synth playback paths
- Added support for `Notification_sound_17.wav` across both apps and kept the sound selector lists in sync
- Changed the Neo LCD reception alert banner text from `Reception Alert` to `Reception` and vertically centered it
- Increased the surgery app window height and kept the expanded settings height in sync
- Fixed the surgery panel startup flow so it can recover from `Offline` to online automatically when reception starts later, without adding an aggressive retry loop
- Moved button colour settings from reception into the surgery app on a per-room basis, including default/active text colours
- Moved Neo left-button customisation from reception into the surgery app on a per-room basis
- Added a per-room Neo right-button settings section in the surgery app as the future expansion point for new right-button modes
- Refined the surgery settings layout:
  - button/text colour pickers now render in two-column rows
  - left-button toggle/dropdown now render in two columns
  - surgery dropdown text and checkbox labels now use `12px`
  - the surgery sound `Play` button now matches the reception button styling
- Simplified the reception connection UI:
  - removed the editable host field
  - kept the port field
  - moved port, detected server address, and pairing code into a dedicated `Connection` section
  - renamed `Clinic Pairing Code` to `Pairing Code`
  - removed the copy-details button
  - set the default pairing code for new reception configs to `1234`
- Added background app-to-app pairing/authentication using the shared pairing code rather than a user login flow
- Added reception-side audit logging for registrations, alerts, acknowledgements, cancellations, clears, and ping-related events
- Added request-body size limits and safer atomic config writes with backup handling in the shared config helpers
- Renamed the security field wording in the UI to friendlier pairing language aimed at non-technical staff
- Added a new right Neo button mode called `Lucy`:
  - selectable per room in the surgery app
  - triggered by the physical right auxiliary Neo button
  - reveals `L`, `U`, `C`, `Y` across the top row one button at a time in vibrant yellow
  - then shows yellow hearts across the bottom row and slowly flashes the hearts
  - designed to be mutually exclusive with party mode so the animations do not clash
- Bumped workspace/app versions to `0.2.1`
- Built fresh Windows installers and ZIPs for both apps:
  - `dist/reception/Pip Reception Setup 0.2.1.exe`
  - `dist/surgery/Pip Surgery Setup 0.2.1.exe`

### Notes

- The current docs/install flow should assume a one-time pairing-code setup, not a user login

## 2026-04-26

### Session 1

- Initialized a new Git repository for the working Pip folder after the previous session crash
- Added a `.gitignore` that keeps generated dependencies, build outputs, local backup folders, and OS metadata out of source control
- Created and pushed the initial working baseline to `git@github.com:Jonny-Jaffa/echo.git`
- Corrected the README quick start to use the confirmed local desktop smoke-test pair:
  - `npm run dev:reception`
  - `npm run dev:client-panel`
- Refreshed the npm workspace install so the new `apps/echo` workspace can resolve the root Electron binary
- Confirmed `npm run dev:echo` now launches instead of failing with `env: electron: No such file or directory`
- Added the first transitional unified-app handoff from `apps/echo`:
  - selected `Reception` role can open the existing full reception app
  - selected `Room` role can open the existing full room/client panel
  - the in-process transitional runtime stops before handoff so it does not conflict with the full app over LAN ports or Neo hardware

### Notes

- The handoff still launches the trusted existing role apps as separate development processes
- The next migration step is to host the full role-specific windows directly from the unified `apps/echo` process, then consolidate packaging around one `Pip` app identity

### Session 2

- Fixed the surgery panel `Both` display mode so the message section matches the `Messages` view height without adding excess space between buttons and messages
- Added separate message sound settings from action/reception-alert sound settings:
  - Reception settings now include a dedicated `Message Sound` selector and volume slider
  - Surgery settings now include a dedicated `Message Sound` selector and volume slider
  - Existing surgery room sound controls are labelled as alert sound/volume to distinguish action/reception-alert audio from message audio
  - Incoming chat messages now use the message sound settings, while action buttons and reception alerts continue using the alert sound settings

## 2026-04-25

### Session 1

- Reworked the surgery app into a messaging-first panel with a separate centered settings window
- Added surgery-side live chat with:
  - reception-to-room messaging
  - room-to-reception messaging
  - room-to-room messaging
  - `All` broadcast messaging
  - custom surgery-defined message groups
- Added surgery-side pinned recipient threads plus a recipient drawer for larger recipient/group lists
- Added unread indicators and chat-thread filtering so the surgery panel behaves more like a standard messaging app
- Added WhatsApp-style message bubbles in the surgery panel:
  - left/right bubble layout
  - 24-hour `H:MM` timestamps
  - single-line and multi-line timestamp placement rules
- Added surgery panel display modes:
  - `Messages`
  - `Buttons`
  - `Both`
- Persisted the surgery panel display mode per machine and fixed launch-time resize jitter so the panel now opens directly in the saved mode
- Changed surgery panel resizing so height changes anchor from the bottom edge instead of pushing the composer out of view
- Added a quick-action toggle in the surgery header so Neo-style action buttons can be triggered directly from the computer as well as from the hardware device
- Added a separator line between quick actions and messaging that only appears in `Both` mode
- Moved room action editing from reception into the surgery app so each room now controls its own button labels/messages/colours locally
- Added surgery-side room button colour, left/right Neo button, sound, and room-action configuration persistence
- Added surgery-side `Always on top` setting and local settings sync
- Added separate framed About windows and branded tray-menu updates for both apps
- Updated both apps to use a coordinated frameless window style with custom minimize/close controls
- Added reception-side messaging UI so reception and surgery now share the same chat feature set end to end
- Fixed reception and surgery input/drag-region issues that were blocking text entry and scrolling in the frameless windows
- Fixed surgery settings auto-refresh interruptions so message-group inputs and toggles no longer lose focus after a few seconds
- Reused the existing per-app sound and volume configuration for incoming chat-message alert playback
- Confirmed the surgery app now acts as a full desktop room panel rather than only a background/hardware helper

### Session 2

- Assessed whether reception and surgery should be hard-merged into one always-shared panel UI
- Decided against a direct hard merge because the current split is architectural as well as visual:
  - reception currently owns the local HTTP/WebSocket server, queue, registrations, and reception-specific settings/state
  - surgery currently owns room-local settings, Neo integration, room actions, and compact room-panel behavior
- Agreed the better next direction is:
  - one installer / one product identity
  - two explicit runtime roles:
    - `Reception`
    - `Room`
  - first-run role selection plus the ability to change role later
  - shared branding, messaging, and common shell pieces where practical
  - separate role-specific startup logic and windows behind that role choice

### Session 3

- Added shared runtime-role vocabulary to `packages/shared`
- Added persisted local runtime-role state to both current apps:
  - surgery app local settings now include `runtimeRole` and `runtimeRoleConfirmed`
  - reception app now keeps a separate local `app-state.json` with `runtimeRole` and `runtimeRoleConfirmed`
- Added hidden role-chooser window infrastructure to both apps:
  - standalone `view=role` renderer path
  - role save/close IPC methods
  - optional `--choose-role` launch hook for manual testing
- Kept current behavior unchanged for normal use:
  - the separate reception installer still behaves as reception
  - the separate surgery installer still behaves as room
- Intentionally did not expose the role chooser from the normal UI yet, because current separate installers are still role-specific and a visible chooser would be misleading before startup is role-driven

### Session 4

- Added role-aware startup gating to both current apps
- The surgery build now:
  - starts normally only when the saved role is `Room`
  - does not start the room/Neo runtime if the saved role is `Reception`
  - opens the role chooser instead when the saved role is unsupported by the current build
- The reception build now:
  - starts normally only when the saved role is `Reception`
  - does not start the reception LAN server/runtime if the saved role is `Room`
  - opens the role chooser instead when the saved role is unsupported by the current build
- Updated tray behavior in both apps so when there is no supported main window available, tray open actions lead to the role chooser instead of doing nothing
- Added chooser copy that explicitly tells the user when the currently installed build only supports one role
- Kept the current separate installers intact:
  - no unified installer yet
  - no visible role chooser in the normal settings/menu flow yet

### Session 5

- Added a deliberate settings/support path to open the role chooser in both current apps
- Surgery settings now include a `Change device role` action in the `General` section
- Reception settings now include a matching `Change device role` action in the `General` section
- This exposes role switching intentionally without changing the normal launch flow of the current separate installers

### Session 6

- Added a dedicated unified bootstrap workspace at `apps/echo`
- Added a new Electron bootstrap app shell with:
  - its own `main.js`
  - its own preload bridge
  - its own renderer and styling
  - persisted local bootstrap role state
- Added a visible role-selection experience in the new bootstrap app so the future single-installer product has a clean place to start from
- Kept the bootstrap app intentionally honest:
  - it stores the chosen role
  - it explains the current migration stage
  - it does not yet pretend to fully hand off into the reception or room runtimes
- Added root workspace launch scripts for the new unified bootstrap app:
  - `npm run dev:echo`
  - `npm run start:echo`
- Verified syntax for:
  - `apps/echo/src/main.js`
  - `apps/echo/src/preload.js`
  - `apps/echo/src/renderer/renderer.js`

### Session 7

- Upgraded the new `apps/echo` bootstrap app from a passive role chooser into a real transitional runtime host
- `apps/echo` now starts the matching in-process role service based on the saved role:
  - `Reception` starts the modular LAN host service from the reception codebase
  - `Room` starts the modular hardware client service from the surgery codebase
- Added a runtime status panel to the unified bootstrap UI so the current role service can be monitored and restarted/stopped
- Added local room runtime settings to the unified bootstrap UI:
  - reception address
  - pairing code
  - room id
  - device id
- Kept the limitation explicit:
  - the full reception window and full room window are still separate
  - the unified app is currently hosting the role services first, before the full role-specific UIs are consolidated
- Added role-aware workspace sections to the unified app so the window now feels distinct in `Reception` and `Room` mode instead of remaining a fully generic migration page
- Re-verified syntax for the updated bootstrap app after the runtime handoff changes

### Notes

- The current surgery app should now be treated as a primary end-user desktop UI, not just a control-panel add-on
- Messaging, message groups, and pinned-thread behavior are now meaningful state that future role-unification work must preserve
- The agreed architectural direction is a unified product with explicit runtime roles, not a single window trying to be reception and surgery simultaneously

### Next Checkpoint

- Document and implement a role-selection model for a unified `Pip` installer/app
- Identify what can be shared between reception and room modes without coupling the startup logic too tightly
- Keep the reception server/runtime responsibilities isolated even if both roles eventually live inside one packaged Electron product
- The pairing code is stored locally in each app config; new reception installs default to `1234` unless that value has already been changed and saved
- The surgery/right-button Lucy mode parses cleanly and is wired into the hardware service, but it still needs a live physical Neo click-test to confirm the animation timing feels right on-device
- The highest-value remaining real-world checks are:
  - fresh reception + fresh surgery pairing on a real LAN
  - real Neo button press smoke test for normal alerts, party mode, and Lucy mode
  - Windows install/uninstall validation from a Windows machine if NSIS issues continue
