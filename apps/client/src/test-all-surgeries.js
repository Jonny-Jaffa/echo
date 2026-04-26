import { buildNotificationPayload } from "@pip/shared";

const DEFAULT_SERVER_URL = process.env.PIP_SERVER || "http://127.0.0.1:3210";
const DEFAULT_ACTION_ID = process.env.PIP_ACTION_ID || "send-next-patient";
const DELAY_MS = Number(process.env.PIP_TEST_DELAY_MS || 1200);

async function main() {
  const config = await fetchJson(`${DEFAULT_SERVER_URL}/config`);
  const rooms = config.rooms || [];

  if (rooms.length === 0) {
    throw new Error("No rooms found in config.");
  }

  console.log(
    `[test] sending ${rooms.length} sample alerts to ${DEFAULT_SERVER_URL} using action "${DEFAULT_ACTION_ID}"`,
  );

  for (const [index, room] of rooms.entries()) {
    const payload = buildNotificationPayload(config, room.id, DEFAULT_ACTION_ID, {
      source: "multi-surgery-test",
      testSequence: index + 1,
    });

    await postJson(`${DEFAULT_SERVER_URL}/notify`, payload);
    console.log(
      `[test] queued ${room.name}: ${payload.message} (${index + 1}/${rooms.length})`,
    );

    if (index < rooms.length - 1 && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  console.log("[test] done");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error("[test] fatal error", error);
  process.exitCode = 1;
});
