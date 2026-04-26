const http = require("node:http");
const os = require("node:os");
const dgram = require("node:dgram");
const { randomUUID } = require("node:crypto");
const { WebSocket, WebSocketServer } = require("ws");

const DISCOVERY_PORT = 3210;

async function createReceptionServer({
  config,
  onNotification,
  onNotificationCancelled,
  onNotificationsCleared,
  onPingCleared,
  onChatMessage,
  onAuditEvent,
}) {
  const { parseJsonBody, buildNotificationPayload } = await import("@pip/shared");
  const clients = new Map();
  const notifications = [];
  const chatMessages = [];
  const registrations = new Map();
  const getConfig = typeof config === "function" ? config : () => config;
  let discoveryEnabled = false;
  const MAX_REQUEST_BODY_BYTES = 32 * 1024;
  const MAX_CHAT_MESSAGES = 200;
  const MAX_CHAT_TEXT_LENGTH = 500;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, {
        ok: true,
        service: "pip-reception",
        connectedClients: clients.size,
      });
      return;
    }

    if (!isAuthorizedRequest(req, url, getExpectedAccessKey(getConfig()))) {
      onAuditEvent?.({
        type: "auth.denied",
        transport: "http",
        path: url.pathname,
        remoteAddress: req.socket?.remoteAddress || null,
      });
      writeJson(res, 401, {
        ok: false,
        error: "Unauthorized",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/config") {
      writeJson(res, 200, sanitizeConfigForClient(getConfig()));
      return;
    }

    if (req.method === "GET" && url.pathname === "/notifications") {
      writeJson(res, 200, notifications.slice(-20));
      return;
    }

    if (req.method === "GET" && url.pathname === "/chat/messages") {
      writeJson(res, 200, chatMessages.slice(-MAX_CHAT_MESSAGES));
      return;
    }

    if (req.method === "GET" && url.pathname === "/devices") {
      writeJson(res, 200, Array.from(registrations.values()));
      return;
    }

    if (req.method === "POST" && url.pathname === "/register") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      const registration = upsertRegistration(registrations, {
        clientId: null,
        deviceId: body?.deviceId || null,
        roomId: body?.roomId || null,
        deviceName: body?.deviceName || null,
        source: body?.source || "client-hardware",
        startedAt: body?.startedAt || null,
      });
      onAuditEvent?.({
        type: "client.registered",
        transport: "http",
        remoteAddress: req.socket?.remoteAddress || null,
        deviceId: registration.deviceId,
        roomId: registration.roomId,
        deviceName: registration.deviceName,
        source: registration.source,
      });

      writeJson(res, 200, {
        ok: true,
        registeredAt: new Date().toISOString(),
        roomId: body?.roomId || null,
        deviceId: registration.deviceId,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/notify") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      const payload =
        body.roomName && body.message && body.timestamp
          ? withNotificationId({ type: "notification", ...body })
          : buildNotificationPayload(
              getConfig(),
              body.roomId,
              body.actionType || body.actionId,
              body,
            );

      notifications.push(payload);
      broadcast(clients, { type: "notification", payload });
      onAuditEvent?.({
        type: "notification.sent",
        transport: "http",
        remoteAddress: req.socket?.remoteAddress || null,
        notificationId: payload.notificationId || null,
        roomId: payload.roomId || null,
        roomName: payload.roomName || null,
        actionType: payload.actionType || null,
        message: payload.message || null,
        deviceId: payload.deviceId || null,
        source: payload.source || body?.source || "unknown",
      });
      onNotification(payload);

      writeJson(res, 202, {
        ok: true,
        payload,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/chat/messages") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      try {
        const payload = createChatMessagePayload(body);
        sendChatMessage(payload, {
          transport: "http",
          remoteAddress: req.socket?.remoteAddress || null,
        });
        writeJson(res, 202, {
          ok: true,
          payload,
        });
      } catch (error) {
        writeJson(res, 400, {
          ok: false,
          error: error.message,
        });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/cancel-notification") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      const cancelledNotification = cancelNotification(body.notificationId, {
        source: body.source || "client-hardware",
        deviceId: body.deviceId || null,
        roomId: body.roomId || null,
      });

      if (!cancelledNotification) {
        writeJson(res, 404, {
          ok: false,
          error: "Notification not found",
        });
        return;
      }

      writeJson(res, 200, {
        ok: true,
        payload: cancelledNotification,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/clear-notifications") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      const clearedCount = clearNotifications({
        source: body?.source || "manual",
        deviceId: body?.deviceId || null,
        roomId: body?.roomId || null,
      });

      writeJson(res, 200, {
        ok: true,
        clearedCount,
      });
      return;
    }

    writeJson(res, 404, {
      ok: false,
      error: "Not found",
    });
  });

  const discoverySocket = dgram.createSocket("udp4");

  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_REQUEST_BODY_BYTES,
  });

  wss.on("connection", (socket, request) => {
    const socketUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (!isAuthorizedRequest(request, socketUrl, getExpectedAccessKey(getConfig()))) {
      onAuditEvent?.({
        type: "auth.denied",
        transport: "websocket",
        path: socketUrl.pathname,
        remoteAddress: request.socket?.remoteAddress || null,
      });
      socket.close(4001, "Unauthorized");
      return;
    }

    const clientId = randomUUID();
    clients.set(clientId, socket);

    socket.send(
      JSON.stringify({
        type: "welcome",
        clientId,
        config: sanitizeConfigForClient(getConfig()),
        chatMessages: chatMessages.slice(-MAX_CHAT_MESSAGES),
        serverTime: new Date().toISOString(),
      }),
    );

    socket.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(String(rawMessage));

        if (message.type === "identify") {
          const registration = upsertRegistration(registrations, {
            clientId,
            deviceId: message.deviceId || null,
            roomId: message.roomId || null,
            deviceName: message.deviceName || null,
            source: message.source || "client-hardware",
          });
          onAuditEvent?.({
            type: "client.identified",
            transport: "websocket",
            remoteAddress: request.socket?.remoteAddress || null,
            deviceId: registration.deviceId,
            roomId: registration.roomId,
            deviceName: registration.deviceName,
            source: registration.source,
          });

          socket.send(
            JSON.stringify({
              type: "identified",
              clientId,
              deviceId: message.deviceId || null,
              roomId: message.roomId || null,
            }),
          );
        }

        if (message.type === "notification") {
          const payload = message.payload.roomName
            ? withNotificationId(message.payload)
            : buildNotificationPayload(
                getConfig(),
                message.payload.roomId,
                message.payload.actionType || message.payload.actionId,
                message.payload,
              );

          notifications.push(payload);
          broadcast(clients, { type: "notification", payload });
          onAuditEvent?.({
            type: "notification.sent",
            transport: "websocket",
            remoteAddress: request.socket?.remoteAddress || null,
            notificationId: payload.notificationId || null,
            roomId: payload.roomId || null,
            roomName: payload.roomName || null,
            actionType: payload.actionType || null,
            message: payload.message || null,
            deviceId: payload.deviceId || null,
            source: payload.source || message.source || "unknown",
          });
          onNotification(payload);
        }

        if (message.type === "chat:send") {
          const payload = createChatMessagePayload(message.payload || {});
          sendChatMessage(payload, {
            transport: "websocket",
            remoteAddress: request.socket?.remoteAddress || null,
          });
        }

        if (message.type === "notification:cancel") {
          cancelNotification(message.notificationId, {
            source: message.source || "client-hardware",
            deviceId: message.deviceId || null,
            roomId: message.roomId || null,
          });
        }

        if (message.type === "notifications:clearAll") {
          clearNotifications({
            source: message.source || "client-hardware",
            deviceId: message.deviceId || null,
            roomId: message.roomId || null,
          });
        }

        if (message.type === "room:pingCleared") {
          const payload = {
            roomId: message.roomId || null,
            deviceId: message.deviceId || null,
            clearedAt: new Date().toISOString(),
          };

          broadcast(clients, { type: "room:pingCleared", payload });
          onPingCleared?.(payload);
          onAuditEvent?.({
            type: "room.pingCleared",
            transport: "websocket",
            remoteAddress: request.socket?.remoteAddress || null,
            roomId: payload.roomId,
            deviceId: payload.deviceId,
          });
        }
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "error",
            error: error.message,
          }),
        );
      }
    });

    socket.on("close", () => {
      clients.delete(clientId);
      for (const registration of registrations.values()) {
        if (registration.clientId === clientId) {
          registration.clientId = null;
          registration.connected = false;
          registration.lastSeenAt = new Date().toISOString();
        }
      }
    });
  });

  await new Promise((resolve) => {
    const currentConfig = getConfig();
    server.listen(currentConfig.network.port, currentConfig.network.host, resolve);
  });

  discoverySocket.on("message", (message, remoteInfo) => {
    let payload = null;

    try {
      payload = JSON.parse(String(message));
    } catch {
      return;
    }

    if (payload?.type !== "pip-discovery") {
      return;
    }

    try {
      const currentConfig = getConfig();
      const advertisedHost = getAdvertisedHost(currentConfig);
      const response = Buffer.from(
        JSON.stringify({
          type: "pip-discovery-response",
          app: "pip-reception",
          host: advertisedHost,
          port: currentConfig.network.port,
          serverUrl: `http://${advertisedHost}:${currentConfig.network.port}`,
        }),
      );

      discoverySocket.send(response, remoteInfo.port, remoteInfo.address);
    } catch {
      // Ignore discovery response failures so they never break the reception app.
    }
  });

  try {
    await new Promise((resolve, reject) => {
      discoverySocket.once("error", reject);
      discoverySocket.bind(DISCOVERY_PORT, "0.0.0.0", () => {
        discoverySocket.removeListener("error", reject);
        resolve();
      });
    });
    discoveryEnabled = true;
  } catch {
    try {
      discoverySocket.close();
    } catch {
      // Ignore close failures after a bind error.
    }
  }

  return {
    getStatus() {
      const currentConfig = getConfig();
      const advertisedHost = getAdvertisedHost(currentConfig);
      return {
        host: currentConfig.network.host,
        advertisedHost,
        serverUrl: `http://${advertisedHost}:${currentConfig.network.port}`,
        port: currentConfig.network.port,
        authEnabled: Boolean(getExpectedAccessKey(currentConfig)),
        connectedClients: clients.size,
        notificationCount: notifications.length,
        registeredDevices: registrations.size,
        discoveryEnabled,
      };
    },
    acknowledgeNotification(notification) {
      if (!notification) {
        return;
      }

      removeNotificationFromHistory(notifications, notification.notificationId);

      broadcast(clients, {
        type: "notification:acknowledged",
        payload: {
          notificationId: notification.notificationId,
          deviceId: notification.deviceId || null,
          deviceButton: Number.isFinite(Number(notification.deviceButton))
            ? Number(notification.deviceButton)
            : null,
          roomId: notification.roomId,
          roomName: notification.roomName,
          actionType: notification.actionType,
          message: notification.message,
          timestamp: notification.timestamp,
          acknowledgedAt: new Date().toISOString(),
        },
      });
      onAuditEvent?.({
        type: "notification.acknowledged",
        transport: "local",
        notificationId: notification.notificationId || null,
        roomId: notification.roomId || null,
        roomName: notification.roomName || null,
        actionType: notification.actionType || null,
        message: notification.message || null,
        deviceId: notification.deviceId || null,
      });
    },
    pingRoom(room) {
      if (!room) {
        return;
      }

      broadcast(clients, {
        type: "room:ping",
        payload: {
          roomId: room.id,
          roomName: room.name,
          pingedAt: new Date().toISOString(),
        },
      });
      onAuditEvent?.({
        type: "room.pinged",
        transport: "local",
        roomId: room.id,
        roomName: room.name,
      });
    },
    clearRoomPing(room) {
      if (!room) {
        return;
      }

      const payload = {
        roomId: room.id,
        roomName: room.name,
        clearedAt: new Date().toISOString(),
      };

      broadcast(clients, {
        type: "room:pingCleared",
        payload,
      });
      onPingCleared?.(payload);
      onAuditEvent?.({
        type: "room.pingCleared",
        transport: "local",
        roomId: room.id,
        roomName: room.name,
      });
    },
    clearAllNotifications(metadata = {}) {
      return clearNotifications(metadata);
    },
    getChatMessages() {
      return chatMessages.slice(-MAX_CHAT_MESSAGES);
    },
    sendChatMessage(message, metadata = {}) {
      const payload = createChatMessagePayload(message);
      sendChatMessage(payload, metadata);
      return payload;
    },
    close() {
      if (discoveryEnabled) {
        discoverySocket.close();
      }
      wss.close();
      server.close();
    },
  };

  function cancelNotification(notificationId, metadata = {}) {
    const normalizedNotificationId = String(notificationId || "").trim();

    if (!normalizedNotificationId) {
      return null;
    }

    const cancelledNotification = onNotificationCancelled?.(normalizedNotificationId) || null;

    if (!cancelledNotification) {
      return null;
    }

    removeNotificationFromHistory(notifications, cancelledNotification.notificationId);

    broadcast(clients, {
      type: "notification:cancelled",
      payload: {
        notificationId: cancelledNotification.notificationId,
        deviceId: cancelledNotification.deviceId || metadata.deviceId || null,
        deviceButton: Number.isFinite(Number(cancelledNotification.deviceButton))
          ? Number(cancelledNotification.deviceButton)
          : null,
        roomId: cancelledNotification.roomId || metadata.roomId || null,
        roomName: cancelledNotification.roomName || null,
        actionType: cancelledNotification.actionType || null,
        message: cancelledNotification.message || null,
        timestamp: cancelledNotification.timestamp || null,
        cancelledAt: new Date().toISOString(),
        source: metadata.source || cancelledNotification.source || "client-hardware",
      },
    });
    onAuditEvent?.({
      type: "notification.cancelled",
      transport: "server",
      notificationId: cancelledNotification.notificationId || null,
      roomId: cancelledNotification.roomId || metadata.roomId || null,
      roomName: cancelledNotification.roomName || null,
      actionType: cancelledNotification.actionType || null,
      message: cancelledNotification.message || null,
      deviceId: cancelledNotification.deviceId || metadata.deviceId || null,
      source: metadata.source || cancelledNotification.source || "client-hardware",
    });

    return cancelledNotification;
  }

  function clearNotifications(metadata = {}) {
    const roomId = String(metadata.roomId || "").trim();
    const notificationsToClear = roomId
      ? notifications.filter((notification) => notification.roomId === roomId)
      : notifications.slice();
    const clearedNotificationIds = notificationsToClear
      .map((notification) => notification.notificationId)
      .filter(Boolean);
    const clearedCount = notificationsToClear.length;

    if (roomId) {
      removeNotificationsFromHistory(notifications, (notification) => notification.roomId === roomId);
    } else {
      notifications.length = 0;
    }

    onNotificationsCleared?.({
      roomId: roomId || null,
      clearedNotificationIds,
    });

    broadcast(clients, {
      type: "notifications:cleared",
      payload: {
        clearedAt: new Date().toISOString(),
        source: metadata.source || "manual",
        deviceId: metadata.deviceId || null,
        roomId: roomId || null,
        clearedNotificationIds,
      },
    });
    onAuditEvent?.({
      type: "notifications.cleared",
      transport: "server",
      roomId: roomId || null,
      deviceId: metadata.deviceId || null,
      source: metadata.source || "manual",
      clearedNotificationIds,
      clearedCount,
    });

    return clearedCount;
  }

  function createChatMessagePayload(message = {}) {
    const currentConfig = getConfig();
    const rooms = Array.isArray(currentConfig?.rooms) ? currentConfig.rooms : [];
    const normalizedText = String(message.text || "").trim().slice(0, MAX_CHAT_TEXT_LENGTH);
    const senderType = String(message.senderType || "").trim().toLowerCase();
    const senderRoomId = String(message.senderRoomId || "").trim();
    const sendToReception = Boolean(message.sendToReception);
    const messageGroupKey = String(message.messageGroupKey || "").trim();
    const messageGroupLabel = String(message.messageGroupLabel || "").trim().slice(0, 24);
    const recipientRoomIds = [...new Set(
      (Array.isArray(message.recipientRoomIds) ? message.recipientRoomIds : [])
        .map((roomId) => String(roomId || "").trim())
        .filter(Boolean),
    )].filter((roomId) => rooms.some((room) => room.id === roomId));
    const messageGroupParticipantRoomIds = [...new Set(
      (Array.isArray(message.messageGroupParticipantRoomIds) ? message.messageGroupParticipantRoomIds : [])
        .map((roomId) => String(roomId || "").trim())
        .filter(Boolean),
    )].filter((roomId) => rooms.some((room) => room.id === roomId));

    if (!normalizedText) {
      throw new Error("Message text is required.");
    }

    if (!["reception", "room"].includes(senderType)) {
      throw new Error("Sender type is invalid.");
    }

    if (senderType === "room" && !rooms.some((room) => room.id === senderRoomId)) {
      throw new Error("Sender room is invalid.");
    }

    const filteredRecipientRoomIds =
      senderType === "room"
        ? recipientRoomIds.filter((roomId) => roomId !== senderRoomId)
        : recipientRoomIds;

    if (!sendToReception && filteredRecipientRoomIds.length === 0) {
      throw new Error("Select at least one recipient.");
    }

    const senderRoom = rooms.find((room) => room.id === senderRoomId) || null;
    const recipients = filteredRecipientRoomIds
      .map((roomId) => rooms.find((room) => room.id === roomId))
      .filter(Boolean)
      .map((room) => ({
        roomId: room.id,
        roomName: room.name,
      }));

    return {
      messageId: String(message.messageId || randomUUID()).trim(),
      text: normalizedText,
      timestamp: message.timestamp || new Date().toISOString(),
      senderType,
      senderRoomId: senderType === "room" ? senderRoomId : null,
      senderLabel: senderType === "room" ? senderRoom?.name || "Unknown Room" : "Reception",
      recipientRoomIds: recipients.map((recipient) => recipient.roomId),
      recipientLabels: recipients.map((recipient) => recipient.roomName),
      sendToReception,
      messageGroupKey,
      messageGroupLabel,
      messageGroupParticipantRoomIds,
      source: String(message.source || "").trim() || (senderType === "reception" ? "reception-ui" : "client-panel"),
    };
  }

  function sendChatMessage(payload, metadata = {}) {
    chatMessages.push(payload);
    while (chatMessages.length > MAX_CHAT_MESSAGES) {
      chatMessages.shift();
    }

    broadcast(clients, { type: "chat:message", payload });
    onChatMessage?.(payload);
    onAuditEvent?.({
      type: "chat.sent",
      transport: metadata.transport || "server",
      remoteAddress: metadata.remoteAddress || null,
      messageId: payload.messageId,
      senderType: payload.senderType,
      senderRoomId: payload.senderRoomId,
      recipientRoomIds: payload.recipientRoomIds,
      sendToReception: payload.sendToReception,
      source: payload.source,
    });
  }
}

function writeBodyParseError(res, error) {
  if (error?.code === "BODY_TOO_LARGE") {
    writeJson(res, 413, {
      ok: false,
      error: "Request body too large",
    });
    return;
  }

  writeJson(res, 400, {
    ok: false,
    error: `Invalid JSON: ${error.message}`,
  });
}

function getExpectedAccessKey(config) {
  return String(config?.auth?.accessKey || "").trim();
}

function getProvidedAccessKey(req, url) {
  const headerKey = String(req.headers["x-pip-key"] || "").trim();

  if (headerKey) {
    return headerKey;
  }

  const authHeader = String(req.headers.authorization || "").trim();

  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return String(url.searchParams.get("accessKey") || "").trim();
}

function isAuthorizedRequest(req, url, expectedAccessKey) {
  if (!expectedAccessKey) {
    return true;
  }

  return getProvidedAccessKey(req, url) === expectedAccessKey;
}

function sanitizeConfigForClient(config) {
  return {
    ...config,
    auth: {
      ...(config?.auth || {}),
      accessKey: "",
    },
  };
}

function getAdvertisedHost(config) {
  const configuredHost = String(config?.network?.host || "").trim();

  if (
    configuredHost &&
    configuredHost !== "0.0.0.0" &&
    configuredHost !== "::" &&
    configuredHost !== "127.0.0.1" &&
    configuredHost.toLowerCase() !== "localhost"
  ) {
    return configuredHost;
  }

  return getPreferredLanAddress() || os.hostname() || "127.0.0.1";
}

function getPreferredLanAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      const isIpv4 = entry?.family === "IPv4" || entry?.family === 4;

      if (!entry || entry.internal || !isIpv4 || entry.address.startsWith("169.254.")) {
        continue;
      }

      addresses.push(entry.address);
    }
  }

  const scoreAddress = (address) => {
    if (address.startsWith("192.168.")) {
      return 4;
    }

    if (address.startsWith("10.")) {
      return 3;
    }

    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
      return 2;
    }

    return 1;
  };

  return addresses
    .sort((left, right) => scoreAddress(right) - scoreAddress(left))[0] || null;
}

function upsertRegistration(registrations, values) {
  const deviceId = String(values.deviceId || values.clientId || randomUUID());
  const existing = registrations.get(deviceId) || {
    deviceId,
    firstRegisteredAt: new Date().toISOString(),
  };

  const nextRegistration = {
    ...existing,
    clientId: values.clientId ?? existing.clientId ?? null,
    deviceId,
    roomId: values.roomId ?? existing.roomId ?? null,
    deviceName: values.deviceName ?? existing.deviceName ?? null,
    source: values.source ?? existing.source ?? null,
    startedAt: values.startedAt ?? existing.startedAt ?? null,
    connected: values.clientId ? true : existing.connected ?? false,
    lastSeenAt: new Date().toISOString(),
  };

  registrations.set(deviceId, nextRegistration);
  return nextRegistration;
}

function broadcast(clients, message) {
  const serialized = JSON.stringify(message);
  for (const socket of clients.values()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(serialized);
    }
  }
}

function writeJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
}

function withNotificationId(payload) {
  return {
    notificationId: payload.notificationId || randomUUID(),
    ...payload,
  };
}

function removeNotificationFromHistory(notifications, notificationId) {
  const index = notifications.findIndex(
    (notification) => notification.notificationId === notificationId,
  );

  if (index !== -1) {
    notifications.splice(index, 1);
  }
}

function removeNotificationsFromHistory(notifications, predicate) {
  for (let index = notifications.length - 1; index >= 0; index -= 1) {
    if (predicate(notifications[index])) {
      notifications.splice(index, 1);
    }
  }
}

module.exports = {
  createReceptionServer,
};
