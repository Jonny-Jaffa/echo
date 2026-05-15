# Pip

Pip is a lightweight LAN-based notification system for surgeries and reception desks. This repository currently contains:

- `apps/echo`: future unified Pip bootstrap app for role selection and one-installer migration
- `apps/reception`: Electron reception app with gadget window, settings window, messaging UI, and local HTTP/WebSocket service
- `apps/client`: Electron surgery/room app with messaging-first panel, Neo integration, quick actions, and separate settings window
- `packages/shared`: shared config and event helpers
- `docs/DEV_PLAN.md`: living development plan
- `docs/DEV_LOG.md`: chronological development log
- `docs/ROLE_PRODUCT_PLAN.md`: migration plan for the future one-installer, two-role `Pip` product

## Current Product Shape

- `Pip Reception` is currently the LAN host/server role
- `Pip Surgery` is currently the room/client role
- `apps/echo` is the new unified bootstrap scaffold for the future single-installer product, and now starts the transitional reception or room service layer based on the saved role
- Both roles now support live messaging
- The agreed next architectural direction is:
  - one packaged `Pip` product / one installer
  - two explicit runtime roles:
    - `Reception`
    - `Room`
  - no hard merge into one always-shared panel UI

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the reception app:

```bash
npm run dev:reception
```

3. In another terminal, start the surgery/room panel:

```bash
npm run dev:client-panel
```

The room panel will fetch config from reception, connect over LAN, and expose the surgery-side desktop UI/runtime.

For background-service-only testing, `npm run dev:client` starts the room client without the desktop panel.

4. If you want to inspect the future unified bootstrap shell:

```bash
npm run dev:echo
```
