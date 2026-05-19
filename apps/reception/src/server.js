const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const dgram = require("node:dgram");
const { randomUUID } = require("node:crypto");
const { Readable } = require("node:stream");
const { WebSocket, WebSocketServer } = require("ws");

const DISCOVERY_PORT = 3210;
const DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE = 5;
const DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];

async function createReceptionServer({
  config,
  onNotification,
  onNotificationCancelled,
  onNotificationsCleared,
  onPingCleared,
  onChatMessage,
  onChatDeleted,
  onChatEdited,
  onAuditEvent,
}) {
  const {
    parseJsonBody,
    buildNotificationPayload,
    initAttachments,
    getMetadata,
    getFilePath,
    getThumbnailPath,
    saveFile,
    toPublicMetadata,
  } = await import("@pip/shared");
  const clients = new Map();
  const notifications = [];
  const chatMessages = [];
  const registrations = new Map();
  const getConfig = typeof config === "function" ? config : () => config;
  let discoveryEnabled = false;
  const MAX_REQUEST_BODY_BYTES = 32 * 1024;
  const MAX_NOTIFICATIONS = 500;
  const MAX_CHAT_MESSAGES = 200;
  const MAX_CHAT_TEXT_LENGTH = 500;
  let notificationPruneTimer = null;

  initAttachments(getAttachmentConfig(getConfig()));

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

    if (req.method === "POST" && url.pathname === "/attachments/upload") {
      const attachmentConfig = getAttachmentConfig(getConfig());
      initAttachments(attachmentConfig);

      if (!attachmentConfig.enabled) {
        writeJson(res, 400, {
          ok: false,
          code: "ATTACHMENTS_DISABLED",
          error: "Attachments are disabled.",
        });
        return;
      }

      try {
        const files = await parseMultipartFiles(req, {
          maxBytes: attachmentConfig.maxFileSizeBytes * attachmentConfig.maxFilesPerMessage + 1024 * 64,
          maxFiles: attachmentConfig.maxFilesPerMessage,
        });

        if (files.length === 0) {
          writeJson(res, 400, {
            ok: false,
            error: "At least one file is required.",
          });
          return;
        }

        const uploaded = [];

        for (const file of files) {
          const metadata = await saveFile(
            Readable.from(file.buffer),
            file.filename,
            file.mime,
            { config: attachmentConfig },
          );
          uploaded.push(metadata);
        }

        onAuditEvent?.({
          type: "attachment.uploaded",
          transport: "http",
          remoteAddress: req.socket?.remoteAddress || null,
          attachmentIds: uploaded.map((item) => item.id),
        });

        writeJson(res, 200, uploaded.length === 1 ? uploaded[0] : { files: uploaded });
      } catch (error) {
        writeAttachmentError(res, error);
      }
      return;
    }

    const attachmentContentMatch = url.pathname.match(/^\/attachments\/([^/]+)\/content$/);
    if (req.method === "GET" && attachmentContentMatch) {
      initAttachments(getAttachmentConfig(getConfig()));
      const attachmentId = decodeURIComponent(attachmentContentMatch[1] || "");
      const metadata = getMetadata(attachmentId);
      const filePath = getFilePath(attachmentId);

      if (!metadata || !filePath || !fs.existsSync(filePath)) {
        writeJson(res, 404, {
          ok: false,
          error: "Attachment not found.",
        });
        return;
      }

      serveAttachmentFile(req, res, metadata, filePath);
      return;
    }

    const attachmentThumbnailMatch = url.pathname.match(/^\/attachments\/([^/]+)\/thumbnail$/);
    if (req.method === "GET" && attachmentThumbnailMatch) {
      initAttachments(getAttachmentConfig(getConfig()));
      const attachmentId = decodeURIComponent(attachmentThumbnailMatch[1] || "");
      const metadata = getMetadata(attachmentId);
      const thumbnailPath = getThumbnailPath(attachmentId);

      if (!metadata || !thumbnailPath || !fs.existsSync(thumbnailPath)) {
        writeJson(res, 404, {
          ok: false,
          error: "Attachment thumbnail not found.",
        });
        return;
      }

      serveAttachmentFile(req, res, {
        ...toPublicMetadata(metadata),
        filename: metadata.filename,
        mime: metadata.mime,
      }, thumbnailPath);
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
      while (notifications.length > MAX_NOTIFICATIONS) {
        notifications.shift();
      }
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

    if (req.method === "PATCH" && url.pathname === "/chat/messages") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      const messageId = String(body.messageId || "").trim();
      const newText = String(body.text || "").trim();

      if (!messageId) {
        writeJson(res, 400, {
          ok: false,
          error: "messageId is required.",
        });
        return;
      }

      if (!newText) {
        writeJson(res, 400, {
          ok: false,
          error: "Message text is required.",
        });
        return;
      }

      const edited = editChatMessage(messageId, newText, {
        transport: "http",
        remoteAddress: req.socket?.remoteAddress || null,
      });

      if (!edited) {
        writeJson(res, 404, {
          ok: false,
          error: "Message not found or cannot be edited.",
        });
        return;
      }

      writeJson(res, 200, {
        ok: true,
        messageId,
        text: newText,
      });
      return;
    }

    if (req.method === "DELETE" && url.pathname === "/chat/messages") {
      const body = await parseJsonBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES }).catch((error) => {
        writeBodyParseError(res, error);
        return null;
      });

      if (!body) {
        return;
      }

      const messageId = String(body.messageId || "").trim();

      if (!messageId) {
        writeJson(res, 400, {
          ok: false,
          error: "messageId is required.",
        });
        return;
      }

      const deleted = deleteChatMessage(messageId, {
        transport: "http",
        remoteAddress: req.socket?.remoteAddress || null,
      });

      if (!deleted) {
        writeJson(res, 404, {
          ok: false,
          error: "Message not found.",
        });
        return;
      }

      writeJson(res, 200, {
        ok: true,
        messageId,
      });
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
          while (notifications.length > MAX_NOTIFICATIONS) {
            notifications.shift();
          }
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

        if (message.type === "chat:delete") {
          const messageId = String(message.messageId || "").trim();
          if (messageId) {
            deleteChatMessage(messageId, {
              transport: "websocket",
              remoteAddress: request.socket?.remoteAddress || null,
            });
          }
        }

        if (message.type === "chat:edit") {
          const messageId = String(message.messageId || "").trim();
          const newText = String(message.text || "").trim();
          if (messageId && newText) {
            editChatMessage(messageId, newText, {
              transport: "websocket",
              remoteAddress: request.socket?.remoteAddress || null,
            });
          }
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

  startNotificationPruneTimer();

  function startNotificationPruneTimer() {
    stopNotificationPruneTimer();
    const currentConfig = getConfig();
    const retentionMinutes = Number(currentConfig?.display?.messageRetentionMinutes) || 540;
    const checkIntervalMs = Math.min(retentionMinutes * 60 * 1000, 5 * 60 * 1000);
    const retentionMs = retentionMinutes * 60 * 1000;

    notificationPruneTimer = setInterval(() => {
      const cutoff = Date.now() - retentionMs;
      const beforeCount = notifications.length;
      removeNotificationsFromHistory(notifications, (notification) => {
        const timestamp = new Date(notification.timestamp).getTime();
        return Number.isFinite(timestamp) && timestamp < cutoff;
      });
      const prunedCount = beforeCount - notifications.length;
      if (prunedCount > 0) {
        onAuditEvent?.({
          type: "notifications.pruned",
          count: prunedCount,
          retentionMinutes,
        });
      }
    }, checkIntervalMs);
    notificationPruneTimer.unref();
  }

  function stopNotificationPruneTimer() {
    if (notificationPruneTimer) {
      clearInterval(notificationPruneTimer);
      notificationPruneTimer = null;
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

      const currentConfig = getConfig();

      broadcast(clients, {
        type: "room:ping",
        payload: {
          roomId: room.id,
          roomName: room.name,
          roomShortName: room.shortName,
          message: String(currentConfig?.display?.receptionPingMessage || "Next Patient Waiting").trim() || "Next Patient Waiting",
          pingedAt: new Date().toISOString(),
        },
      });
      onAuditEvent?.({
        type: "room.pinged",
        transport: "local",
        roomId: room.id,
        roomName: room.name,
        roomShortName: room.shortName,
      });
    },
    clearRoomPing(room) {
      if (!room) {
        return;
      }

      const payload = {
        roomId: room.id,
        roomName: room.name,
        roomShortName: room.shortName,
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
        roomShortName: room.shortName,
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
    deleteChatMessage(messageId, metadata = {}) {
      return deleteChatMessage(messageId, metadata);
    },
    editChatMessage(messageId, newText, metadata = {}) {
      return editChatMessage(messageId, newText, metadata);
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
    const rooms = Array.isArray(currentConfig?.rooms)
      ? currentConfig.rooms.filter((room) => !room.hideFromEntireUI)
      : [];
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
    const attachmentConfig = getAttachmentConfig(currentConfig);
    const attachments = normalizeMessageAttachments(message.attachments, attachmentConfig);

    if (!normalizedText && attachments.length === 0) {
      throw new Error("Message text or attachment is required.");
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
        roomShortName: room.shortName,
      }));

    return {
      messageId: String(message.messageId || randomUUID()).trim(),
      text: normalizedText,
      timestamp: message.timestamp || new Date().toISOString(),
      senderType,
      senderRoomId: senderType === "room" ? senderRoomId : null,
      senderLabel: senderType === "room" ? senderRoom?.name || "Unknown Room" : "Reception",
      senderShortLabel: senderType === "room" ? senderRoom?.shortName || senderRoom?.name || "Room" : "Rec",
      recipientRoomIds: recipients.map((recipient) => recipient.roomId),
      recipientLabels: recipients.map((recipient) => recipient.roomName),
      recipientShortLabels: recipients.map((recipient) => recipient.roomShortName || recipient.roomName),
      sendToReception,
      messageGroupKey,
      messageGroupLabel,
      messageGroupParticipantRoomIds,
      attachments,
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

  function deleteChatMessage(messageId, metadata = {}) {
    const normalizedMessageId = String(messageId || "").trim();

    if (!normalizedMessageId) {
      return false;
    }

    const index = chatMessages.findIndex(
      (message) => String(message.messageId || "").trim() === normalizedMessageId,
    );

    if (index === -1) {
      return false;
    }

    const deletedMessage = chatMessages[index];
    chatMessages[index] = {
      ...deletedMessage,
      text: "",
      deleted: true,
      deletedAt: new Date().toISOString(),
    };

    broadcast(clients, {
      type: "chat:messageDeleted",
      payload: {
        messageId: normalizedMessageId,
        deletedAt: new Date().toISOString(),
      },
    });

    onChatDeleted?.({
      messageId: normalizedMessageId,
      deletedAt: new Date().toISOString(),
    });

    onAuditEvent?.({
      type: "chat.deleted",
      transport: metadata.transport || "server",
      remoteAddress: metadata.remoteAddress || null,
      messageId: normalizedMessageId,
      senderType: deletedMessage.senderType,
      senderRoomId: deletedMessage.senderRoomId,
    });

    return true;
  }

  function editChatMessage(messageId, newText, metadata = {}) {
    const normalizedMessageId = String(messageId || "").trim();
    const normalizedText = String(newText || "").trim().slice(0, MAX_CHAT_TEXT_LENGTH);

    if (!normalizedMessageId || !normalizedText) {
      return false;
    }

    const index = chatMessages.findIndex(
      (message) => String(message.messageId || "").trim() === normalizedMessageId,
    );

    if (index === -1) {
      return false;
    }

    const existingMessage = chatMessages[index];

    if (existingMessage.deleted) {
      return false;
    }

    chatMessages[index] = {
      ...existingMessage,
      text: normalizedText,
      edited: true,
      editedAt: new Date().toISOString(),
    };

    broadcast(clients, {
      type: "chat:messageEdited",
      payload: {
        messageId: normalizedMessageId,
        text: normalizedText,
        editedAt: new Date().toISOString(),
      },
    });

    onChatEdited?.({
      messageId: normalizedMessageId,
      text: normalizedText,
      editedAt: new Date().toISOString(),
    });

    onAuditEvent?.({
      type: "chat.edited",
      transport: metadata.transport || "server",
      remoteAddress: metadata.remoteAddress || null,
      messageId: normalizedMessageId,
      senderType: existingMessage.senderType,
      senderRoomId: existingMessage.senderRoomId,
    });

    return true;
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

function getAttachmentConfig(config) {
  const attachments = config?.attachments || {};
  const features = config?.features || {};
  const whitelistMimeTypes =
    Array.isArray(attachments.whitelistMimeTypes) && attachments.whitelistMimeTypes.length > 0
      ? attachments.whitelistMimeTypes
      : DEFAULT_ATTACHMENT_WHITELIST_MIME_TYPES;

  return {
    ...attachments,
    enabled: features.attachments?.enabled !== false,
    rootPath: String(attachments.rootPath || "").trim(),
    maxFileSizeBytes: Math.max(
      1,
      Number(attachments.maxFileSizeBytes) || DEFAULT_ATTACHMENT_MAX_FILE_SIZE_BYTES,
    ),
    maxFilesPerMessage: Math.max(
      1,
      Number(attachments.maxFilesPerMessage) || DEFAULT_ATTACHMENT_MAX_FILES_PER_MESSAGE,
    ),
    whitelistMimeTypes: whitelistMimeTypes
      .map((mime) => String(mime || "").trim().toLowerCase())
      .filter(Boolean),
    cloud: {
      enabled: Boolean(attachments.cloud?.enabled),
      provider: String(attachments.cloud?.provider || "").trim(),
    },
  };
}

function normalizeMessageAttachments(value, attachmentConfig) {
  if (!Array.isArray(value)) {
    return [];
  }

  if (!attachmentConfig.enabled) {
    return [];
  }

  return value
    .slice(0, attachmentConfig.maxFilesPerMessage)
    .map((attachment) => ({
      id: String(attachment?.id || "").trim(),
      filename: sanitizeAttachmentDisplayFilename(attachment?.filename),
      mime: String(attachment?.mime || "").trim().toLowerCase(),
      size: Math.max(0, Number(attachment?.size) || 0),
      url: String(attachment?.url || "").trim(),
      thumbnailUrl: String(attachment?.thumbnailUrl || "").trim(),
    }))
    .filter((attachment) =>
      attachment.id &&
      attachment.filename &&
      attachmentConfig.whitelistMimeTypes.includes(attachment.mime) &&
      attachment.size <= attachmentConfig.maxFileSizeBytes &&
      attachment.url.startsWith(`/attachments/${encodeURIComponent(attachment.id)}/`),
    );
}

function sanitizeAttachmentDisplayFilename(filename) {
  return String(filename || "attachment")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "attachment";
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

function parseMultipartFiles(req, options = {}) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2] || "";

  if (!boundary || !contentType.toLowerCase().includes("multipart/form-data")) {
    const error = new Error("Expected multipart/form-data.");
    error.code = "INVALID_MULTIPART";
    return Promise.reject(error);
  }

  return readRequestBuffer(req, options.maxBytes).then((body) => {
    const files = parseMultipartBuffer(body, boundary)
      .filter((part) => part.name === "file" && part.filename && part.buffer.length > 0)
      .map((part) => ({
        filename: part.filename,
        mime: part.mime || inferMimeFromFilename(part.filename) || "application/octet-stream",
        buffer: part.buffer,
      }));

    if (files.length > Math.max(1, Number(options.maxFiles) || 1)) {
      const error = new Error(`Upload supports up to ${options.maxFiles} files.`);
      error.code = "TOO_MANY_FILES";
      throw error;
    }

    return files;
  });
}

function readRequestBuffer(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) {
        return;
      }

      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        settled = true;
        const error = new Error(`Request body exceeds ${maxBytes} bytes.`);
        error.code = "FILE_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function parseMultipartBuffer(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = body.indexOf(delimiter);

  while (cursor !== -1) {
    cursor += delimiter.length;

    if (body[cursor] === 45 && body[cursor + 1] === 45) {
      break;
    }

    if (body[cursor] === 13 && body[cursor + 1] === 10) {
      cursor += 2;
    }

    const next = body.indexOf(delimiter, cursor);

    if (next === -1) {
      break;
    }

    let part = body.subarray(cursor, next);

    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));

    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString("utf8");
      const content = part.subarray(headerEnd + 4);
      const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
      const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
      const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
      const mime = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
      parts.push({ name, filename, mime, buffer: content });
    }

    cursor = next;
  }

  return parts;
}

function inferMimeFromFilename(filename) {
  const value = String(filename || "").trim().toLowerCase();

  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  if (value.endsWith(".png")) return "image/png";
  if (value.endsWith(".gif")) return "image/gif";
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".pdf")) return "application/pdf";
  if (value.endsWith(".txt")) return "text/plain";
  if (value.endsWith(".mp3")) return "audio/mpeg";
  if (value.endsWith(".wav")) return "audio/wav";
  if (value.endsWith(".ogg")) return "audio/ogg";

  return "";
}

function serveAttachmentFile(req, res, metadata, filePath) {
  const dispositionMode = new URL(req.url, `http://${req.headers.host}`).searchParams.get("download") === "1"
    ? "attachment"
    : "inline";
  const filename = sanitizeAttachmentDisplayFilename(metadata.filename);

  res.writeHead(200, {
    "Content-Type": metadata.mime || "application/octet-stream",
    "Content-Length": fs.statSync(filePath).size,
    "Content-Disposition": `${dispositionMode}; filename="${filename.replace(/"/g, "_")}"`,
    "Cache-Control": "private, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(filePath).pipe(res);
}

function writeAttachmentError(res, error) {
  const code = String(error?.code || "UPLOAD_FAILED");
  const statusCode =
    code === "FILE_TOO_LARGE" || code === "BODY_TOO_LARGE"
      ? 413
      : code === "UNSUPPORTED_TYPE"
        ? 415
        : code === "ATTACHMENTS_DISABLED" || code === "INVALID_MULTIPART" || code === "TOO_MANY_FILES"
          ? 400
          : 500;

  writeJson(res, statusCode, {
    ok: false,
    code,
    error: error?.message || "Attachment upload failed.",
  });
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
