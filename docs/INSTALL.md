# Pip Install Guide

Developer: `Blackworks`

## Installers

Use two separate installers:

- Reception computer:
  `dist/reception/Pip Reception Setup 0.2.1.exe`
- Surgery computers:
  `dist/surgery/Pip Surgery Setup 0.2.1.exe`

ZIP builds are also available in the same folders, but for normal Windows installation you should run the `Setup ... .exe` file directly. You do not need to unzip anything before running the installer.

For surgery computers, each installed `Pip Surgery` app includes a room selector. Choose the room for that specific computer on first launch and it will save that room assignment locally, along with a persistent device ID, so multiple surgery PCs and Elgato Neo devices can all connect to the same reception app on the same LAN without colliding.

## Windows installer note

The Windows builds in this repo are currently produced from the development Mac. Installation works, but if Windows uninstall still shows an NSIS integrity error, the most reliable next step is to generate the Windows NSIS installer on a Windows build machine.

This is a packaging-side issue rather than a room/device setup issue.

## Current macOS status

The packaged macOS reception app still needs proper Apple code signing and notarization for reliable click-to-open installs.

For now:

- `Pip Surgery` can continue to be tested from the packaged app if it opens correctly on your Mac
- `Pip Reception` should be run using the local Mac test launcher below during development

## Local Mac test launcher for Reception

From the repo root, run:

```bash
npm run start:reception:mac-test
```

This launches the reception gadget directly from source and avoids the current unsigned macOS installer issue.

## What goes where

- Install `Pip Reception` on the front desk / reception computer
- Install `Pip Surgery` on each surgery computer that will use:
  - the Elgato Stream Deck Neo
  - the optional on-screen surgery panel

## Reception setup

1. Open `Pip Reception`
2. Open `Settings`
3. Configure:
   - room names
   - room colours
   - notification icons/messages
   - connection settings, including the detected server address and pairing code
4. Leave the reception app running on the local network

## Surgery setup

1. Open `Pip Surgery`
2. Select the correct surgery room for that machine
3. Enter the reception server address if needed
4. Enter the same pairing code shown in reception
5. Connect the Elgato Neo by USB
6. Leave the surgery app running

The surgery app stores both a persistent `roomId` and a persistent `deviceId` locally, so each surgery computer keeps its own room assignment and device identity as a separate installation.

## Notes

- Each new setup/installer output should use a bumped app version rather than reusing the previous installer version number
- The current Windows installers built in this session are x64 builds for modern Windows PCs
- ZIP files are optional companion artifacts, not the primary installer
- The apps are not code-signed yet
- The current default reception pairing code is `1234` for new configs unless it has already been changed and saved
- If macOS warns about opening the app, you may need to allow it in System Settings > Privacy & Security
- Until Apple signing/notarization is added, use `npm run start:reception:mac-test` for the reception app on a development Mac
