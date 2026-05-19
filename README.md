# Pip

Pip is a lightweight LAN-based notification and messaging system for reception desks and client rooms.

## Product

- `Pip Reception`: the LAN host/server app for the front desk.
- `Pip Client`: the room/client app for alerts, messaging, quick actions, and Stream Deck Neo integration.

The product is currently distributed as two separate installers: one for Reception and one for Client.

## Repository Layout

- `apps/reception`: Electron Reception app, local HTTP/WebSocket service, settings, alerts, and messaging UI.
- `apps/client`: Electron Client app, room panel, messaging, quick actions, local settings, and Neo integration.
- `packages/shared`: shared config, validation, migration, attachment, and event helpers.
- `packages/shared-ui`: shared UI assets/styles used across app surfaces.
- `config`: default development config.
- `docs`: development notes, install notes, and implementation plans.
- `scripts`: local development helper scripts.

## Quick Start

Install dependencies:

```bash
npm install
```

Start Reception:

```bash
npm run dev:reception
```

In another terminal, start a Client panel:

```bash
npm run dev:client-panel
```

The Client panel fetches config from Reception, connects over LAN, and exposes the client-side desktop UI/runtime.

For quick single-machine UI testing, launch Reception and multiple Client panels together:

```bash
npm run dev:all-panels
```

## Common Scripts

- `npm run dev:reception`: start Reception from source.
- `npm run dev:client-panel`: start the main Client panel from source.
- `npm run dev:client-panel:room2`: start a second Client panel using `surgery-2` test identity.
- `npm run dev:all-panels`: start Reception plus multiple Client panels for local UI testing.
- `npm run dev:client`: start the Client background service without the desktop panel.
- `npm run dev:reception:about`: preview the Reception About window.
- `npm run dev:client:about`: preview the Client About window.
- `npm test`: run the automated test suite.

## Build Scripts

```bash
npm run build:reception:win
npm run build:client:win
npm run build:all:win
```

Windows installer outputs are written to `dist/reception` and `dist/client`.

## Documentation

- `docs/INSTALL.md`: install and setup notes.
- `docs/FEATURE_LIST.md`: product feature list for future sales and marketing material.
- `docs/DEV_PLAN.md`: current development plan and backlog.
- `docs/DEV_LOG.md`: chronological development log.
- `docs/ATTACHMENTS_SPEC.md`: attachment feature specification.
- `docs/ATTACHMENTS_IMPLEMENTATION_PLAN.md`: attachment implementation plan.
