# Pip

Pip is a lightweight LAN-based notification system for surgeries and reception desks. This repository currently contains:

- `apps/reception`: Electron reception app with gadget window, settings window, messaging UI, and local HTTP/WebSocket service
- `apps/client`: Electron client/room app with messaging-first panel, Neo integration, quick actions, and separate settings window
- `packages/shared`: shared config and event helpers
- `docs/DEV_PLAN.md`: living development plan
- `docs/DEV_LOG.md`: chronological development log

## Current Product Shape

- `Pip Reception` is currently the LAN host/server role
- `Pip Client` is currently the room/client role
- Both roles now support live messaging
- The product is currently distributed as two separate installers:
  - `Pip Reception`
  - `Pip Client`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the reception app:

```bash
npm run dev:reception
```

3. In another terminal, start the client/room panel:

```bash
npm run dev:client-panel
```

The room panel will fetch config from reception, connect over LAN, and expose the client-side desktop UI/runtime.

For background-service-only testing, `npm run dev:client` starts the room client without the desktop panel.
