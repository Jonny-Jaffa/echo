import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG_SCHEMA_VERSION, migrateConfig, normalizeConfig, validateConfig } from "./index.js";

function buildConfig(roomPatch = {}) {
  return {
    version: 1,
    network: {
      port: 3210,
    },
    hardware: {
      leftAuxButton: {
        mode: "party",
      },
    },
    audio: {
      masterVolume: 80,
      messageVolume: 80,
    },
    rooms: [
      {
        id: "room-1",
        name: "Room 1",
        shortName: "R1",
        color: "#0f766e",
        receptionSound: {
          enabled: false,
          sound: "notification_sound_01",
        },
        notifications: [
          {
            id: "action-1",
            label: "Ready",
            message: "Ready",
            color: "#2563eb",
            deviceButton: 0,
          },
        ],
        ...roomPatch,
      },
    ],
  };
}

test("migrateConfig renames hideRoomFromUI to hideFromEntireUI and defaults alert visibility", () => {
  const migrated = migrateConfig(buildConfig({ hideRoomFromUI: true }));

  assert.equal(migrated.version, CONFIG_SCHEMA_VERSION);
  assert.equal(migrated.rooms[0].hideFromEntireUI, true);
  assert.equal(migrated.rooms[0].hideFromAlertSection, false);
  assert.equal("hideRoomFromUI" in migrated.rooms[0], false);
});

test("normalizeConfig emits schema version and room/user visibility fields", () => {
  const normalized = normalizeConfig(buildConfig({ hideFromAlertSection: true }));

  assert.equal(normalized.version, CONFIG_SCHEMA_VERSION);
  assert.equal(normalized.rooms[0].hideFromAlertSection, true);
  assert.equal(normalized.rooms[0].hideFromEntireUI, false);
});

test("normalizeConfig defaults always on top to false while preserving saved choices", () => {
  const defaulted = normalizeConfig(buildConfig());
  const enabled = normalizeConfig({
    ...buildConfig(),
    display: {
      alwaysOnTop: true,
    },
  });

  assert.equal(defaulted.display.alwaysOnTop, false);
  assert.equal(enabled.display.alwaysOnTop, true);
});

test("validateConfig rejects mutually exclusive room/user visibility toggles", () => {
  const result = validateConfig(buildConfig({
    hideFromAlertSection: true,
    hideFromEntireUI: true,
  }));

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /cannot be hidden from both/);
});
