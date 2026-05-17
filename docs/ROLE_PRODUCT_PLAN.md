# Pip Role Product Plan

Last updated: 2026-04-26

## Goal

Move from two separately installed products:

- `Pip Reception`
- `Pip Surgery`

to one packaged `Pip` product with two explicit runtime roles:

- `Reception`
- `Room`

This should reduce installer/setup complexity without forcing the reception and room experiences into one overloaded window.

## Agreed Direction

Do **not** hard-merge the current reception and surgery UIs into one always-shared panel.

Instead:

1. Ship one installer / one app identity.
2. Ask for the device role on first launch.
3. Persist that role locally per computer.
4. Start only the runtime and UI that match that role.
5. Allow the role to be changed later from settings.

## Why This Approach

The current split is architectural, not just visual.

### Reception currently owns

- the local HTTP/WebSocket LAN server
- surgery/client registration tracking
- discovery responses
- the reception alert queue and gadget behavior
- reception-owned shared config editing
- reception-side alert/audio behavior

### Room currently owns

- local room identity and room-specific settings
- Stream Deck Neo integration
- local room action definitions
- local message groups and pinned message threads
- compact messaging/button panel behavior
- room-side sound and volume handling

Because of that, a direct UI merge would increase coupling and make setup/runtime errors more likely.

## Migration Principles

- Preserve current behavior before consolidating packaging.
- Keep shared visual primitives reusable, but keep role-specific startup isolated.
- Keep reception as the source of truth for shared LAN config.
- Keep room-local settings local to each machine.
- Do not break current messaging, Neo, or room-action workflows during migration.

## Recommended Phases

### Phase 1: Shared Role Model

- Add a shared concept of runtime role:
  - `reception`
  - `room`
- Add local role persistence per installation
- Default existing installs safely:
  - current reception installs remain `reception`
  - current surgery installs remain `room`

### Phase 2: Unified App Shell

- Introduce a single packaged Electron app identity: `Pip`
- Add a first-run role chooser window
- Add a safe way to reopen the role chooser later
- Keep current reception and room code paths available behind that shell

### Phase 3: Role-Based Startup

- If role is `reception`:
  - start the LAN server/runtime
  - open the reception UI
- If role is `room`:
  - start the room/Neo runtime
  - open the surgery/room UI

### Phase 4: Shared UI Extraction

- Extract and reuse safe shared pieces where it reduces duplication:
  - frameless header shell
  - tray/about helpers where appropriate
  - messaging primitives
  - settings-window framing/styling

Do **not** force role-specific panels into one giant conditional renderer if the resulting code becomes harder to reason about.

### Phase 5: Packaging Consolidation

- Replace separate setup outputs with one `Pip Setup ...`
- Keep role selection part of first-run onboarding
- Update install docs and support notes to describe role selection clearly

## Risks To Manage

### Role-switching risk

Changing a machine from `Room` to `Reception` or vice versa can invalidate local expectations around:

- room identity
- server settings
- startup behavior
- Neo hardware state
- tray behavior

Mitigation:

- treat role switching as a deliberate settings action
- confirm the switch clearly
- restart the app after switching roles

### Settings ownership risk

Reception shared config and room-local config must remain clearly separated.

Mitigation:

- keep shared LAN config reception-owned
- keep room-local state in per-machine local storage
- do not silently merge those stores

### Runtime-coupling risk

Starting both reception and room runtimes on the same machine unnecessarily could create conflicts or confusing behavior.

Mitigation:

- startup path should launch only the selected role runtime

## Near-Term Implementation Order

1. Add role-selection and local role persistence foundation.
2. Add a role chooser shell with no behavior change for current installs.
3. Route startup through role selection.
4. Repoint packaging toward one app identity once role routing is stable.

## Current Implementation Status

Completed so far:

- shared runtime-role vocabulary exists
- both current apps persist local runtime-role state
- both current apps have a hidden standalone role window / role renderer path
- both current apps support a manual `--choose-role` launch hook for testing
- both current separate apps now refuse to boot the wrong runtime for an unsupported saved role and fall back to the chooser instead
- a dedicated `apps/pip` bootstrap app now exists as the future unified single-installer entrypoint
- the bootstrap app can persist the local machine role and start the matching transitional runtime service in-process:
  - reception LAN host service
  - room hardware client service
- the bootstrap app can hand off from the selected role into the existing full role workspace:
  - `Reception` launches the current reception app
  - `Room` launches the current client panel
  - the transitional in-process runtime is stopped first to avoid port or hardware conflicts
- root workspace scripts now include:
  - `npm run dev:pip`
  - `npm run start:pip`

Still outstanding:

- the full reception and room window experiences are not yet directly hosted inside the `apps/pip` process
- the product is still packaged as separate reception and surgery installers
- shared assets and packaging still need to be consolidated around the new `Pip` bootstrap app

## Current Non-Goals

- Replacing the existing messaging UX
- Replacing the existing Neo integration model
- Converting reception shared config into a room-local settings model
- Running reception and room roles simultaneously inside one default UI
