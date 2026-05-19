# Pip Feature List

Pip is a lightweight LAN-based notification and messaging system for reception desks and client rooms. It is designed for teams that need fast, low-friction communication between a front desk and multiple rooms without relying on cloud services for day-to-day operation.

## Core Positioning

- Local network communication for reception-to-room workflows.
- Separate apps for front desk and client rooms: `Pip Reception` and `Pip Client`.
- Fast alerts, messaging, and status awareness in a compact desktop interface.
- Optional Stream Deck Neo integration for tactile room controls.
- Built for small teams that need simple, visible, reliable communication during live operations.

## Pip Reception

### Front Desk Alert Dashboard

- Compact reception window for monitoring room/user alerts.
- Alert rows with room/user labels, colours, and quick visual status.
- Support for multiple configured rooms/users.
- Clear visual separation between the alert area and the messaging area.
- Configurable room/user visibility so teams can choose what appears in the alert list.

### Alert Handling

- Receive notifications from connected Client apps.
- Display incoming room/user alerts in the Reception interface.
- Acknowledge alerts from Reception.
- Queue-oriented alert behavior so multiple alerts can be handled without losing track.
- Audio notification support with selectable sounds.
- Separate sound settings for alerts and messages.

### Live Messaging

- Built-in messaging interface for communicating with client rooms/users.
- Thread sidebar for switching between room/user conversations.
- Collapsible thread sidebar to keep the workspace compact.
- Thread visibility can include rooms/users that are hidden from the alert section, as long as they are not hidden from the whole UI.
- Reply and acknowledgement workflows from the message interface.

### Room/User Setup

- Room/User settings for managing names, short labels, colours, and visibility.
- Short labels for compact UI display.
- Dark colour swatches designed to work clearly in the app UI.
- Visibility controls:
  - Hide from alert section.
  - Hide from entire UI.
- Client-side and server-side validation to prevent incompatible visibility settings.

### Local Settings and Admin

- In-app settings for room/user configuration.
- Pairing code configuration for local network access.
- Reception server address display for setup.
- Always-on-top behavior can be configured and remembered.
- About window and tray support for installed desktop use.

## Pip Client

### Client Room Panel

- Compact desktop panel for room/user communication.
- Messaging-first interface designed for fast scanning.
- Persistent display modes:
  - Messages.
  - Buttons.
  - Both.
- Panel remembers user preferences between launches.
- Reception offline banner warns users when messages and alerts cannot be delivered.

### Quick Actions

- On-screen action buttons for sending common requests to Reception.
- Customisable button labels and messages.
- Quick action workflow supports both software interaction and hardware-triggered actions.
- Action button state is managed so stale active states can be cleared safely.

### Stream Deck Neo Integration

- Direct Elgato Stream Deck Neo support.
- Physical button presses can trigger configured room actions.
- Neo button colours and labels sync from local room settings.
- Hardware status is surfaced in the Client panel.
- Client app can still run without hardware connected.

### Client Messaging

- Live chat with Reception and other configured rooms/users.
- Pinned recipient threads for fast switching.
- Thread rail for navigating conversations.
- Reorderable thread chips.
- Message composer with compact desktop-friendly controls.
- Separate message sound and volume settings.

### Client Settings

- Separate settings window.
- Local room/user assignment.
- Local device identity for multi-room deployments.
- Alert sound and volume settings.
- Message sound and volume settings.
- Room action editing.
- Button appearance controls.
- Left/right Neo button settings.
- Always-on-top preference.

## Messaging and Threads

- Two-way messaging between Reception and Client apps.
- Threaded room/user conversations.
- Unread and selected-thread behavior for easier scanning.
- Shared message experience across Reception and Client.
- Configurable thread visibility based on room/user UI settings.
- Designed for quick operational messages rather than long-form chat.

## Sounds and Notifications

- Bundled local WAV sounds.
- Named notification sounds:
  - Ping
  - Glass
  - Hero
  - Funk
  - Pop
  - Chime
  - Bell
  - Ripple
  - Spark
  - Pulse
  - Echo
  - Drift
  - Flash
  - Wave
  - Ember
  - Beacon
  - Nova
- Separate alert and message sound controls.
- Volume controls for client-side alert and message sounds.
- Local playback with packaged app fallback support.

## Configuration and Deployment

- Reception acts as the local source of truth for shared configuration.
- Client apps fetch configuration from Reception over the LAN.
- Pairing code support for local access control.
- Config validation before persistence.
- Config migration support for renamed or added settings.
- Schema versioning for safer upgrades.
- Room/user visibility rules enforced in both UI and shared config validation.

## Desktop App Experience

- Separate Windows installers for Reception and Client.
- Frameless, compact desktop windows.
- Tray integration.
- About windows for both apps.
- Persistent local settings.
- Designed for repeated daily use rather than a browser-first workflow.

## Reliability and Offline Awareness

- Client reconnect behavior for Reception connection loss.
- Clear Reception offline banner in Client.
- Settings remain accessible when Reception is offline.
- Client app can launch before Reception and recover when Reception becomes available.
- Local device identity helps multiple Client machines coexist on the same LAN.

## Privacy and Network Model

- LAN-first architecture.
- Day-to-day app communication does not depend on a cloud-hosted service.
- Local pairing code for basic access control.
- Suitable for environments that prefer local operational tools.

## Customisation

- Room/user names.
- Short labels.
- Colours.
- Alert visibility.
- Entire UI visibility.
- Action button labels and messages.
- Neo button appearance.
- Alert sounds.
- Message sounds.
- Always-on-top preference.
- Display mode preference.

## Ideal Use Cases

- Reception desks coordinating with multiple rooms.
- Clinics, practices, salons, studios, or other multi-room workplaces.
- Teams that need quick front-desk-to-room alerts.
- Teams that want a physical button workflow using Stream Deck Neo.
- Small LAN-based deployments where cloud chat tools feel too broad or noisy.

## Potential Website Feature Categories

- Fast Front Desk Alerts.
- Room-to-Reception Messaging.
- Stream Deck Neo Room Controls.
- Local Network Operation.
- Custom Room/User Setup.
- Configurable Sounds and Notifications.
- Compact Desktop Workflow.
- Built for Multi-Room Teams.

## Short Marketing Phrases

- Fast room-to-reception communication, right on your local network.
- Keep the front desk and client rooms in sync.
- Send alerts, reply to messages, and trigger common requests in seconds.
- A compact desktop workflow for busy teams.
- Optional physical controls with Stream Deck Neo.
- Local-first communication for multi-room workplaces.

