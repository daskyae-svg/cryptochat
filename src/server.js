require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const { initDatabase, getDb, closeDatabase } = require("./db");
const {
  generateSalt,
  hashPassword,
  safeCompareHex,
  encryptMessage,
  decryptMessage,
} = require("./cryptoUtils");

const SERVER_PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const HOST = "0.0.0.0";
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || "";
const TENOR_API_KEY = process.env.TENOR_API_KEY || "LIVDSRZULELA";
const TENOR_CLIENT_KEY = process.env.TENOR_CLIENT_KEY || "cryptochat";
const DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
];
const STUN_URLS = String(process.env.STUN_URLS || "").trim();
const TURN_URLS = String(process.env.TURN_URLS || "").trim();
const TURN_URL = String(process.env.TURN_URL || "").trim();
const TURN_USERNAME = String(process.env.TURN_USERNAME || "").trim();
const TURN_PASSWORD = String(process.env.TURN_PASSWORD || "").trim();
const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
const TWILIO_NTS_TTL = Number(process.env.TWILIO_NTS_TTL || 3600);
const USE_OPENRELAY_FALLBACK = String(process.env.USE_OPENRELAY_FALLBACK || "true")
  .trim()
  .toLowerCase() !== "false";
const DEFAULT_OPENRELAY_TURN_SERVERS = [
  {
    urls: "turn:openrelay.metered.ca:3478",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:3478?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turns:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
const ICE_TRANSPORT_POLICY = String(process.env.ICE_TRANSPORT_POLICY || "all")
  .trim()
  .toLowerCase();
const ICE_CANDIDATE_POOL_SIZE = Number(process.env.ICE_CANDIDATE_POOL_SIZE || 4);
const MAX_MEDIA_URL_LENGTH = 2_500_000;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_GROUP_NAME_LENGTH = 80;
const MIN_GROUP_MEMBER_COUNT = 2;

const primaryClientDir = path.resolve(__dirname, "..", "server", "client");
const fallbackClientDir = path.resolve(__dirname, "..", "client");
const clientDir = fs.existsSync(primaryClientDir)
  ? primaryClientDir
  : fallbackClientDir;
const indexFilePath = path.join(clientDir, "index.html");

const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  GIF: "gif",
  CALL: "call",
  DELETED: "deleted",
};

const ALLOWED_OUTGOING_TYPES = new Set([MESSAGE_TYPES.TEXT, MESSAGE_TYPES.IMAGE, MESSAGE_TYPES.GIF]);
const ALL_DB_TYPES = new Set([
  MESSAGE_TYPES.TEXT,
  MESSAGE_TYPES.IMAGE,
  MESSAGE_TYPES.GIF,
  MESSAGE_TYPES.CALL,
  MESSAGE_TYPES.DELETED,
]);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

const onlineUsers = new Map();
let isShuttingDown = false;
let hasStarted = false;

app.set("trust proxy", 1);
app.use(
  cors({
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
  })
);
app.use(express.json({ limit: "4mb" }));
app.use(express.static(clientDir));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/webrtc-config", async (_req, res) => {
  try {
    const config = await getWebRtcConfigForRequest();
    res.json(config);
  } catch (error) {
    console.error("[webrtc-config] failed, using static fallback:", error);
    res.json(getWebRtcConfig());
  }
});

app.get("/", (_req, res) => {
  res.sendFile(indexFilePath);
});

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function normalizeUsername(rawValue) {
  return String(rawValue || "").trim();
}

function validateUsername(username) {
  if (!username) {
    return "Username is required.";
  }
  if (username.length < 3) {
    return "Username must be at least 3 characters long.";
  }
  if (username.length > 50) {
    return "Username must be less than or equal to 50 characters.";
  }
  if (!/^[A-Za-z0-9_ ]+$/.test(username)) {
    return "Username can only contain letters, numbers, spaces, and underscores.";
  }
  return null;
}

function normalizeGroupName(rawValue) {
  return String(rawValue || "").trim();
}

function validateGroupName(groupName) {
  if (!groupName) {
    return "Group name is required.";
  }
  if (groupName.length < 2) {
    return "Group name must be at least 2 characters long.";
  }
  if (groupName.length > MAX_GROUP_NAME_LENGTH) {
    return `Group name must be less than or equal to ${MAX_GROUP_NAME_LENGTH} characters.`;
  }
  return null;
}

function normalizeMessageType(rawType) {
  const type = String(rawType || MESSAGE_TYPES.TEXT).toLowerCase().trim();
  if (!ALL_DB_TYPES.has(type)) {
    return MESSAGE_TYPES.TEXT;
  }
  return type;
}

function uniquePositiveInts(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => toPositiveInt(value))
        .filter(Boolean)
    )
  );
}

function isUserOnline(userId) {
  const sockets = onlineUsers.get(String(userId));
  return Boolean(sockets && sockets.size > 0);
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeDecrypt(encryptedMessage, iv) {
  try {
    return decryptMessage(encryptedMessage, iv);
  } catch (error) {
    return "[Unable to decrypt message]";
  }
}

function toPreviewText(message, maxLength = 45) {
  const singleLine = String(message || "").replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1)}...`;
}

function messagePreviewFromType(messageType, messageText) {
  if (messageType === MESSAGE_TYPES.DELETED) {
    return "Message deleted";
  }
  if (messageType === MESSAGE_TYPES.CALL) {
    return "Voice call";
  }
  if (messageType === MESSAGE_TYPES.IMAGE) {
    return messageText ? `Photo: ${toPreviewText(messageText, 36)}` : "Photo";
  }
  if (messageType === MESSAGE_TYPES.GIF) {
    return messageText ? `GIF: ${toPreviewText(messageText, 36)}` : "GIF";
  }
  return toPreviewText(messageText, 45);
}

function encodeGroupMessagePayload({ messageText, messageType, mediaUrl }) {
  return JSON.stringify({
    message: String(messageText || ""),
    messageType: normalizeMessageType(messageType),
    mediaUrl: mediaUrl || null,
  });
}

function decodeGroupMessagePayload(rawPayload) {
  try {
    const parsed = JSON.parse(String(rawPayload || ""));
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid group message payload.");
    }

    return {
      message: String(parsed.message || ""),
      messageType: normalizeMessageType(parsed.messageType || MESSAGE_TYPES.TEXT),
      mediaUrl: parsed.mediaUrl ? String(parsed.mediaUrl) : null,
    };
  } catch (_error) {
    return {
      message: String(rawPayload || ""),
      messageType: MESSAGE_TYPES.TEXT,
      mediaUrl: null,
    };
  }
}

function parseUrlList(rawValue) {
  return String(rawValue || "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function getConfiguredStunUrls() {
  const urls = uniqueList(parseUrlList(STUN_URLS));
  return urls.length > 0 ? urls : DEFAULT_STUN_URLS;
}

function getConfiguredTurnUrls() {
  return uniqueList([
    ...parseUrlList(TURN_URLS),
    ...parseUrlList(TURN_URL),
  ]);
}

function getIceTransportPolicy() {
  return ICE_TRANSPORT_POLICY === "relay" ? "relay" : "all";
}

function getIceCandidatePoolSize() {
  if (!Number.isInteger(ICE_CANDIDATE_POOL_SIZE) || ICE_CANDIDATE_POOL_SIZE < 0) {
    return 4;
  }
  return Math.min(ICE_CANDIDATE_POOL_SIZE, 16);
}

function getWebRtcIceServers() {
  const servers = [];
  if (getIceTransportPolicy() !== "relay") {
    servers.push({ urls: getConfiguredStunUrls() });
  }
  const turnUrls = getConfiguredTurnUrls();

  if (turnUrls.length > 0 && TURN_USERNAME && TURN_PASSWORD) {
    servers.push({
      urls: turnUrls,
      username: TURN_USERNAME,
      credential: TURN_PASSWORD,
    });
  }

  if (USE_OPENRELAY_FALLBACK) {
    servers.push(...DEFAULT_OPENRELAY_TURN_SERVERS);
  }

  return servers;
}

function normalizeIceServerEntry(server) {
  if (!server || typeof server !== "object") {
    return null;
  }

  const rawUrls = server.urls;
  const urls = Array.isArray(rawUrls)
    ? rawUrls.map((item) => String(item || "").trim()).filter(Boolean)
    : [String(rawUrls || "").trim()].filter(Boolean);

  if (!urls.length) {
    return null;
  }

  const normalized = { urls };
  const username = String(server.username || "").trim();
  const credential = String(server.credential || "").trim();

  if (username) {
    normalized.username = username;
  }
  if (credential) {
    normalized.credential = credential;
  }

  return normalized;
}

function uniqueIceServers(servers) {
  const deduped = [];
  const seen = new Set();

  for (const server of servers) {
    const normalized = normalizeIceServerEntry(server);
    if (!normalized) {
      continue;
    }

    const key = JSON.stringify({
      urls: normalized.urls,
      username: normalized.username || "",
      credential: normalized.credential || "",
    });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

function hasTurnServer(servers) {
  return servers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => String(url || "").trim().toLowerCase().startsWith("turn"));
  });
}

function getTwilioTokenTtl() {
  if (!Number.isFinite(TWILIO_NTS_TTL)) {
    return 3600;
  }
  return Math.min(Math.max(Math.floor(TWILIO_NTS_TTL), 60), 86400);
}

function hasTwilioCredentials() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

async function fetchTwilioIceServers() {
  if (!hasTwilioCredentials() || typeof fetch !== "function") {
    return [];
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({ Ttl: String(getTwilioTokenTtl()) });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Twilio token request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const servers = Array.isArray(payload && payload.ice_servers) ? payload.ice_servers : [];
  return uniqueIceServers(servers);
}

function buildWebRtcConfig(iceServers) {
  const normalizedServers = uniqueIceServers(iceServers);
  const requestedPolicy = getIceTransportPolicy();
  const effectivePolicy =
    requestedPolicy === "relay" && !hasTurnServer(normalizedServers) ? "all" : requestedPolicy;

  return {
    iceServers: normalizedServers,
    iceTransportPolicy: effectivePolicy,
    iceCandidatePoolSize: getIceCandidatePoolSize(),
  };
}

function getWebRtcConfig() {
  return buildWebRtcConfig(getWebRtcIceServers());
}

async function getWebRtcConfigForRequest() {
  const fallbackServers = getWebRtcIceServers();

  if (!hasTwilioCredentials()) {
    return buildWebRtcConfig(fallbackServers);
  }

  try {
    const twilioServers = await fetchTwilioIceServers();
    if (!twilioServers.length) {
      return buildWebRtcConfig(fallbackServers);
    }

    const mergedServers = USE_OPENRELAY_FALLBACK
      ? [...twilioServers, ...fallbackServers]
      : twilioServers;

    return buildWebRtcConfig(mergedServers);
  } catch (error) {
    console.error("[webrtc-config] Twilio ICE fetch failed, using fallback servers:", error);
    return buildWebRtcConfig(fallbackServers);
  }
}

function mapMessageRow(row, currentUserId) {
  const messageType = normalizeMessageType(row.message_type);
  const decryptedMessage =
    messageType === MESSAGE_TYPES.DELETED
      ? "This message was deleted."
      : safeDecrypt(row.message_encrypted, row.iv);

  const message = {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    messageType,
    message: decryptedMessage,
    mediaUrl: row.media_url || null,
    createdAt: toIsoString(row.created_at),
    deletedAt: row.deleted_at ? toIsoString(row.deleted_at) : null,
    status: null,
  };

  if (currentUserId && row.sender_id === currentUserId && messageType !== MESSAGE_TYPES.DELETED) {
    message.status = "sent";
  }

  return message;
}

function mapGroupMessageRow(row, currentUserId) {
  const decodedPayload = decodeGroupMessagePayload(
    safeDecrypt(row.message_encrypted, row.iv)
  );

  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username || null,
    senderAvatarUrl: row.sender_avatar_url || null,
    messageType: decodedPayload.messageType,
    message: decodedPayload.message,
    mediaUrl: decodedPayload.mediaUrl || null,
    createdAt: toIsoString(row.created_at),
    status: row.sender_id === currentUserId ? "sent" : null,
  };
}

function groupConversationPreview(message, currentUserId) {
  if (!message) {
    return "No messages yet";
  }

  const authorLabel =
    message.senderId === currentUserId
      ? "You"
      : message.senderUsername || `User ${message.senderId}`;

  return `${authorLabel}: ${messagePreviewFromType(message.messageType, message.message)}`;
}

function getGroupRoomName(groupId) {
  return `group_${groupId}`;
}

function buildDirectPairKey(userIdA, userIdB) {
  const left = Math.min(Number(userIdA) || 0, Number(userIdB) || 0);
  const right = Math.max(Number(userIdA) || 0, Number(userIdB) || 0);
  return `${left}:${right}`;
}

async function getDirectInviteByPair(userIdA, userIdB) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT id, sender_id, receiver_id, status, created_at, responded_at
    FROM direct_invites
    WHERE pair_key = ?
    LIMIT 1
    `,
    [buildDirectPairKey(userIdA, userIdB)]
  );

  return rows[0] || null;
}

async function getDirectInviteById(inviteId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT id, sender_id, receiver_id, status, created_at, responded_at
    FROM direct_invites
    WHERE id = ?
    LIMIT 1
    `,
    [inviteId]
  );

  return rows[0] || null;
}

function serializeDirectInvite(invite) {
  if (!invite) {
    return null;
  }

  return {
    id: Number(invite.id),
    senderId: Number(invite.sender_id),
    receiverId: Number(invite.receiver_id),
    status: String(invite.status || "pending"),
    createdAt: toIsoString(invite.created_at),
    respondedAt: invite.responded_at ? toIsoString(invite.responded_at) : null,
  };
}

async function usersHaveDirectHistory(userIdA, userIdB) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT 1
    FROM messages
    WHERE (
      (sender_id = ? AND receiver_id = ?)
      OR
      (sender_id = ? AND receiver_id = ?)
    )
    LIMIT 1
    `,
    [userIdA, userIdB, userIdB, userIdA]
  );

  return rows.length > 0;
}

async function canUsersDirectlyInteract(userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) {
    return false;
  }

  const directInvite = await getDirectInviteByPair(userIdA, userIdB);
  if (directInvite) {
    return directInvite.status === "accepted";
  }

  return usersHaveDirectHistory(userIdA, userIdB);
}

async function ensureDirectAccess(userIdA, userIdB) {
  const usersExist = await ensureUsersExist(userIdA, userIdB);
  if (!usersExist) {
    throw createHttpError(404, "Sender or receiver not found.");
  }

  const allowed = await canUsersDirectlyInteract(userIdA, userIdB);
  if (!allowed) {
    throw createHttpError(403, "Direct messaging is locked until the friend request is accepted.");
  }
}

function emitDirectInviteUpdate(senderId, receiverId, payload) {
  emitToUser(senderId, "direct_invites_updated", payload);
  if (receiverId !== senderId) {
    emitToUser(receiverId, "direct_invites_updated", payload);
  }
}

async function createDirectInvite(senderId, receiverId) {
  if (!senderId || !receiverId || senderId === receiverId) {
    throw createHttpError(400, "Valid senderId and receiverId are required.");
  }

  const usersExist = await ensureUsersExist(senderId, receiverId);
  if (!usersExist) {
    throw createHttpError(404, "One or both users were not found.");
  }

  const existingInvite = await getDirectInviteByPair(senderId, receiverId);
  const db = getDb();

  if (existingInvite) {
    if (existingInvite.status === "accepted") {
      throw createHttpError(409, "You are already friends.");
    }
    if (existingInvite.status === "pending") {
      throw createHttpError(409, "There is already a pending friend request between these users.");
    }

    await db.execute(
      `
      UPDATE direct_invites
      SET sender_id = ?, receiver_id = ?, status = 'pending', created_at = CURRENT_TIMESTAMP, responded_at = NULL
      WHERE id = ?
      `,
      [senderId, receiverId, existingInvite.id]
    );

    return getDirectInviteById(existingInvite.id);
  }

  if (await usersHaveDirectHistory(senderId, receiverId)) {
    throw createHttpError(409, "This direct conversation already exists.");
  }

  const [result] = await db.execute(
    `
    INSERT INTO direct_invites (pair_key, sender_id, receiver_id, status)
    VALUES (?, ?, ?, 'pending')
    `,
    [buildDirectPairKey(senderId, receiverId), senderId, receiverId]
  );

  return getDirectInviteById(result.insertId);
}

async function respondToDirectInvite(inviteId, userId, action) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  if (normalizedAction !== "accept" && normalizedAction !== "reject") {
    throw createHttpError(400, "Action must be accept or reject.");
  }

  const invite = await getDirectInviteById(inviteId);
  if (!invite) {
    throw createHttpError(404, "Invite not found.");
  }
  if (invite.receiver_id !== userId) {
    throw createHttpError(403, "Only the invited user can respond.");
  }
  if (invite.status !== "pending") {
    throw createHttpError(409, "This invite has already been handled.");
  }

  const db = getDb();
  const nextStatus = normalizedAction === "accept" ? "accepted" : "rejected";
  await db.execute(
    `
    UPDATE direct_invites
    SET status = ?, responded_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [nextStatus, inviteId]
  );

  return getDirectInviteById(inviteId);
}

async function removeDirectFriendship(requesterId, otherUserId) {
  if (!requesterId || !otherUserId || requesterId === otherUserId) {
    throw createHttpError(400, "Valid requesterId and friendId are required.");
  }

  const usersExist = await ensureUsersExist(requesterId, otherUserId);
  if (!usersExist) {
    throw createHttpError(404, "One or both users were not found.");
  }

  const db = getDb();
  const existingInvite = await getDirectInviteByPair(requesterId, otherUserId);

  if (existingInvite) {
    if (existingInvite.status !== "accepted") {
      throw createHttpError(409, "This friendship is not active.");
    }

    await db.execute(
      `
      UPDATE direct_invites
      SET status = 'removed', responded_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [existingInvite.id]
    );

    return getDirectInviteById(existingInvite.id);
  }

  if (!(await usersHaveDirectHistory(requesterId, otherUserId))) {
    throw createHttpError(404, "Friendship not found.");
  }

  const [result] = await db.execute(
    `
    INSERT INTO direct_invites (pair_key, sender_id, receiver_id, status, responded_at)
    VALUES (?, ?, ?, 'removed', CURRENT_TIMESTAMP)
    `,
    [buildDirectPairKey(requesterId, otherUserId), requesterId, otherUserId]
  );

  return getDirectInviteById(result.insertId);
}

async function persistCallLogMessage(callerId, calleeId) {
  return persistEncryptedMessage({
    senderId: callerId,
    receiverId: calleeId,
    messageText: "Voice call",
    messageType: MESSAGE_TYPES.CALL,
    mediaUrl: null,
  });
}

async function findUsersByIds(userIds) {
  const safeUserIds = uniquePositiveInts(userIds);
  if (!safeUserIds.length) {
    return [];
  }

  const db = getDb();
  const placeholders = safeUserIds.map(() => "?").join(", ");
  const [rows] = await db.execute(
    `
    SELECT id, username, avatar_url
    FROM users
    WHERE id IN (${placeholders})
    ORDER BY username ASC
    `,
    safeUserIds
  );

  return rows;
}

async function findGroupById(groupId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT id, name, avatar_url, created_at
    FROM \`groups\`
    WHERE id = ?
    LIMIT 1
    `,
    [groupId]
  );

  return rows[0] || null;
}

async function isGroupMember(groupId, userId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT 1
    FROM group_members
    WHERE group_id = ? AND user_id = ?
    LIMIT 1
    `,
    [groupId, userId]
  );

  return rows.length > 0;
}

async function ensureGroupMembership(groupId, userId) {
  const group = await findGroupById(groupId);
  if (!group) {
    throw createHttpError(404, "Group not found.");
  }

  const member = await isGroupMember(groupId, userId);
  if (!member) {
    throw createHttpError(403, "You are not a member of this group.");
  }

  return group;
}

async function listGroupIdsForUser(userId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT group_id
    FROM group_members
    WHERE user_id = ?
    `,
    [userId]
  );

  return rows.map((row) => row.group_id);
}

async function joinSocketToUserGroups(socket, userId) {
  const groupIds = await listGroupIdsForUser(userId);
  for (const groupId of groupIds) {
    await socket.join(getGroupRoomName(groupId));
  }
}

async function joinUserSocketsToGroup(userId, groupId) {
  const sockets = onlineUsers.get(String(userId));
  if (!sockets || !sockets.size) {
    return;
  }

  const roomName = getGroupRoomName(groupId);
  await Promise.all(
    Array.from(sockets).map(async (socketId) => {
      const activeSocket = io.sockets.sockets.get(socketId);
      if (activeSocket) {
        await activeSocket.join(roomName);
      }
    })
  );
}

async function leaveUserSocketsFromGroup(userId, groupId) {
  const sockets = onlineUsers.get(String(userId));
  if (!sockets || !sockets.size) {
    return;
  }

  const roomName = getGroupRoomName(groupId);
  await Promise.all(
    Array.from(sockets).map(async (socketId) => {
      const activeSocket = io.sockets.sockets.get(socketId);
      if (activeSocket) {
        await activeSocket.leave(roomName);
      }
    })
  );
}

async function getGroupMembers(groupId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT u.id, u.username, u.avatar_url
    FROM group_members gm
    INNER JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY u.username ASC
    `,
    [groupId]
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url || null,
    online: isUserOnline(row.id),
  }));
}

async function getGroupsForUser(userId, specificGroupId = null) {
  const db = getDb();
  const params = [userId];
  let groupFilterSql = "";

  if (specificGroupId) {
    groupFilterSql = " AND g.id = ? ";
    params.push(specificGroupId);
  }

  const [rows] = await db.execute(
    `
    SELECT
      g.id AS group_id,
      g.name,
      g.avatar_url,
      g.created_at AS group_created_at,
      gm_latest.id AS message_id,
      gm_latest.group_id,
      gm_latest.sender_id,
      gm_latest.message_encrypted,
      gm_latest.iv,
      gm_latest.created_at AS created_at,
      sender.username AS sender_username,
      sender.avatar_url AS sender_avatar_url
    FROM \`groups\` g
    INNER JOIN group_members member_scope
      ON member_scope.group_id = g.id
     AND member_scope.user_id = ?
    LEFT JOIN group_messages gm_latest
      ON gm_latest.id = (
        SELECT gm2.id
        FROM group_messages gm2
        WHERE gm2.group_id = g.id
        ORDER BY gm2.created_at DESC, gm2.id DESC
        LIMIT 1
      )
    LEFT JOIN users sender ON sender.id = gm_latest.sender_id
    WHERE 1 = 1
    ${groupFilterSql}
    ORDER BY
      CASE WHEN gm_latest.created_at IS NULL THEN 1 ELSE 0 END ASC,
      gm_latest.created_at DESC,
      g.name ASC
    `,
    params
  );

  if (!rows.length) {
    return [];
  }

  const groupIds = rows.map((row) => row.group_id);
  const placeholders = groupIds.map(() => "?").join(", ");
  const [memberRows] = await db.execute(
    `
    SELECT gm.group_id, u.id, u.username, u.avatar_url
    FROM group_members gm
    INNER JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id IN (${placeholders})
    ORDER BY u.username ASC
    `,
    groupIds
  );

  const membersByGroupId = new Map();
  memberRows.forEach((row) => {
    const currentMembers = membersByGroupId.get(row.group_id) || [];
    currentMembers.push({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url || null,
      online: isUserOnline(row.id),
    });
    membersByGroupId.set(row.group_id, currentMembers);
  });

  return rows.map((row) => {
    const mappedMessage = row.message_id
      ? mapGroupMessageRow(
          {
            id: row.message_id,
            group_id: row.group_id,
            sender_id: row.sender_id,
            message_encrypted: row.message_encrypted,
            iv: row.iv,
            created_at: row.created_at,
            sender_username: row.sender_username,
            sender_avatar_url: row.sender_avatar_url,
          },
          userId
        )
      : null;

    return {
      id: row.group_id,
      name: row.name,
      avatarUrl: row.avatar_url || null,
      createdAt: toIsoString(row.group_created_at),
      members: membersByGroupId.get(row.group_id) || [],
      lastMessage: mappedMessage
        ? {
            id: mappedMessage.id,
            groupId: mappedMessage.groupId,
            senderId: mappedMessage.senderId,
            senderUsername: mappedMessage.senderUsername,
            messageType: mappedMessage.messageType,
            preview: groupConversationPreview(mappedMessage, userId),
            createdAt: mappedMessage.createdAt,
          }
        : null,
    };
  });
}

async function getGroupSummary(groupId, userId) {
  const groups = await getGroupsForUser(userId, groupId);
  return groups[0] || null;
}

async function findUserById(userId) {
  const db = getDb();
  const [rows] = await db.execute(
    "SELECT id, username, avatar_url FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

async function ensureUsersExist(senderId, receiverId) {
  const [sender, receiver] = await Promise.all([
    findUserById(senderId),
    findUserById(receiverId),
  ]);
  return Boolean(sender && receiver);
}

async function persistEncryptedMessage({
  senderId,
  receiverId,
  messageText,
  messageType,
  mediaUrl,
}) {
  const db = getDb();
  const safeMessageText = String(messageText || "");
  const safeMessageType = normalizeMessageType(messageType);
  const { encryptedMessage, iv } = encryptMessage(safeMessageText);

  const [result] = await db.execute(
    `
    INSERT INTO messages (sender_id, receiver_id, message_type, message_encrypted, media_url, iv)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [senderId, receiverId, safeMessageType, encryptedMessage, mediaUrl || null, iv]
  );

  const [rows] = await db.execute(
    `
    SELECT id, sender_id, receiver_id, message_type, message_encrypted, media_url, iv, created_at, deleted_at
    FROM messages
    WHERE id = ?
    LIMIT 1
    `,
    [result.insertId]
  );

  return mapMessageRow(rows[0]);
}

async function persistEncryptedGroupMessage({
  groupId,
  senderId,
  messageText,
  messageType,
  mediaUrl,
}) {
  const db = getDb();
  const safeMessageType = normalizeMessageType(messageType);
  const payload = encodeGroupMessagePayload({
    messageText,
    messageType: safeMessageType,
    mediaUrl,
  });
  const { encryptedMessage, iv } = encryptMessage(payload);

  const [result] = await db.execute(
    `
    INSERT INTO group_messages (group_id, sender_id, message_encrypted, iv)
    VALUES (?, ?, ?, ?)
    `,
    [groupId, senderId, encryptedMessage, iv]
  );

  const [rows] = await db.execute(
    `
    SELECT
      gm.id,
      gm.group_id,
      gm.sender_id,
      gm.message_encrypted,
      gm.iv,
      gm.created_at,
      u.username AS sender_username,
      u.avatar_url AS sender_avatar_url
    FROM group_messages gm
    INNER JOIN users u ON u.id = gm.sender_id
    WHERE gm.id = ?
    LIMIT 1
    `,
    [result.insertId]
  );

  return mapGroupMessageRow(rows[0], senderId);
}

async function markMessageDeleted(messageId, requesterId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT id, sender_id, receiver_id, created_at, message_type, deleted_at
    FROM messages
    WHERE id = ?
    LIMIT 1
    `,
    [messageId]
  );

  const existingMessage = rows[0];
  if (!existingMessage) {
    throw createHttpError(404, "Message not found.");
  }

  if (existingMessage.sender_id !== requesterId) {
    throw createHttpError(403, "You can only delete your own messages.");
  }

  if (normalizeMessageType(existingMessage.message_type) === MESSAGE_TYPES.DELETED) {
    return {
      id: existingMessage.id,
      senderId: existingMessage.sender_id,
      receiverId: existingMessage.receiver_id,
      messageType: MESSAGE_TYPES.DELETED,
      message: "This message was deleted.",
      mediaUrl: null,
      createdAt: toIsoString(existingMessage.created_at),
      deletedAt: existingMessage.deleted_at
        ? toIsoString(existingMessage.deleted_at)
        : new Date().toISOString(),
      status: "sent",
    };
  }

  await db.execute(
    `
    UPDATE messages
    SET message_type = ?, media_url = NULL, deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [MESSAGE_TYPES.DELETED, messageId]
  );

  return {
    id: existingMessage.id,
    senderId: existingMessage.sender_id,
    receiverId: existingMessage.receiver_id,
    messageType: MESSAGE_TYPES.DELETED,
    message: "This message was deleted.",
    mediaUrl: null,
    createdAt: toIsoString(existingMessage.created_at),
    deletedAt: new Date().toISOString(),
    status: "sent",
  };
}

async function buildGroupRealtimePayload(groupId) {
  const group = await findGroupById(groupId);
  if (!group) {
    return null;
  }

  return {
    id: group.id,
    name: group.name,
    avatarUrl: group.avatar_url || null,
    createdAt: toIsoString(group.created_at),
    members: await getGroupMembers(groupId),
  };
}

function emitToUser(userId, eventName, payload) {
  const userKey = String(userId);
  const sockets = onlineUsers.get(userKey);
  if (!sockets) {
    return;
  }

  sockets.forEach((socketId) => {
    io.to(socketId).emit(eventName, payload);
  });
}

async function emitGroupUpdate(groupId) {
  const payload = await buildGroupRealtimePayload(groupId);
  if (!payload) {
    return null;
  }

  await Promise.all(
    payload.members.map((member) => joinUserSocketsToGroup(member.id, groupId))
  );

  io.to(getGroupRoomName(groupId)).emit("group_updated", payload);
  return payload;
}

async function leaveGroupMembership(groupId, userId) {
  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [groupRows] = await connection.execute(
      `
      SELECT id
      FROM \`groups\`
      WHERE id = ?
      LIMIT 1
      `,
      [groupId]
    );

    if (!groupRows.length) {
      throw createHttpError(404, "Group not found.");
    }

    const [memberRows] = await connection.execute(
      `
      SELECT user_id
      FROM group_members
      WHERE group_id = ? AND user_id = ?
      LIMIT 1
      `,
      [groupId, userId]
    );

    if (!memberRows.length) {
      throw createHttpError(403, "You are not a member of this group.");
    }

    await connection.execute(
      `
      DELETE FROM group_members
      WHERE group_id = ? AND user_id = ?
      `,
      [groupId, userId]
    );

    const [remainingRows] = await connection.execute(
      `
      SELECT user_id
      FROM group_members
      WHERE group_id = ?
      `,
      [groupId]
    );

    const remainingUserIds = remainingRows.map((row) => Number(row.user_id)).filter(Boolean);
    const groupDeleted = remainingUserIds.length === 0;

    if (groupDeleted) {
      await connection.execute(
        `
        DELETE FROM \`groups\`
        WHERE id = ?
        `,
        [groupId]
      );
    }

    await connection.commit();

    await leaveUserSocketsFromGroup(userId, groupId);
    emitToUser(userId, "group_left", {
      groupId,
      userId,
      groupDeleted,
    });

    if (!groupDeleted) {
      await emitGroupUpdate(groupId);
    }

    return {
      groupId,
      userId,
      groupDeleted,
      remainingUserIds,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function emitPresenceUpdate(userId, online) {
  io.emit("presence_update", {
    userId: Number(userId),
    online: Boolean(online),
  });
}

function removeSocketFromOnlineUser(userId, socketId) {
  const userKey = String(userId);
  const sockets = onlineUsers.get(userKey);
  if (!sockets) {
    return false;
  }

  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userKey);
    return true;
  }

  return false;
}

app.post("/signup", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    const usernameValidationError = validateUsername(username);
    if (usernameValidationError) {
      return res.status(400).json({ error: usernameValidationError });
    }

    if (!password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long." });
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);

    const db = getDb();
    const [result] = await db.execute(
      `
      INSERT INTO users (username, password_hash, salt)
      VALUES (?, ?, ?)
      `,
      [username, passwordHash, salt]
    );

    return res.status(201).json({
      message: "Signup successful.",
      user: {
        id: result.insertId,
        username,
        avatarUrl: null,
      },
    });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists." });
    }

    console.error("[signup] failed:", error);
    return res.status(500).json({ error: "Failed to create user." });
  }
});

app.post("/login", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const db = getDb();
    const [rows] = await db.execute(
      `
      SELECT id, username, password_hash, salt, avatar_url
      FROM users
      WHERE username = ?
      LIMIT 1
      `,
      [username]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const computedHash = hashPassword(password, user.salt);
    const isValid = safeCompareHex(computedHash, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({
      message: "Login successful.",
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url || null,
      },
    });
  } catch (error) {
    console.error("[login] failed:", error);
    return res.status(500).json({ error: "Login failed." });
  }
});

app.get("/users", async (req, res) => {
  try {
    const excludeId = toPositiveInt(req.query.exclude);
    const viewerId = toPositiveInt(req.query.viewerId);
    const searchTerm = String(req.query.search || "").trim();
    const db = getDb();
    const params = [];
    const conditions = [];

    if (excludeId) {
      conditions.push("id <> ?");
      params.push(excludeId);
    }

    if (searchTerm) {
      conditions.push("username LIKE ?");
      params.push(`%${searchTerm}%`);
    }

    const relationSelectSql = viewerId
      ? `,
        (
          SELECT di.id
          FROM direct_invites di
          WHERE di.pair_key = CONCAT(LEAST(${viewerId}, u.id), ':', GREATEST(${viewerId}, u.id))
          LIMIT 1
        ) AS direct_invite_id,
        (
          SELECT di.status
          FROM direct_invites di
          WHERE di.pair_key = CONCAT(LEAST(${viewerId}, u.id), ':', GREATEST(${viewerId}, u.id))
          LIMIT 1
        ) AS direct_invite_status,
        (
          SELECT di.sender_id
          FROM direct_invites di
          WHERE di.pair_key = CONCAT(LEAST(${viewerId}, u.id), ':', GREATEST(${viewerId}, u.id))
          LIMIT 1
        ) AS direct_invite_sender_id,
        EXISTS(
          SELECT 1
          FROM messages dm
          WHERE (
            (dm.sender_id = ${viewerId} AND dm.receiver_id = u.id)
            OR
            (dm.sender_id = u.id AND dm.receiver_id = ${viewerId})
          )
          LIMIT 1
        ) AS has_direct_history`
      : "";

    let query = `SELECT u.id, u.username, u.avatar_url, u.created_at${relationSelectSql} FROM users u`;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    query += " ORDER BY username ASC";

    const [rows] = await db.execute(query, params);
    const users = rows.map((row) => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url || null,
      online: isUserOnline(row.id),
      createdAt: toIsoString(row.created_at),
      directInviteId: row.direct_invite_id || null,
      directRelationStatus: viewerId
        ? row.direct_invite_id
          ? row.direct_invite_status === "accepted"
            ? "accepted"
            : row.direct_invite_status === "pending"
              ? Number(row.direct_invite_sender_id) === viewerId
                ? "outgoing_pending"
                : "incoming_pending"
              : "none"
          : row.has_direct_history
            ? "accepted"
            : "none"
        : null,
    }));

    return res.json({ users });
  } catch (error) {
    console.error("[users] failed:", error);
    return res.status(500).json({ error: "Failed to load users." });
  }
});

app.post("/profile/avatar", async (req, res) => {
  try {
    const userId = toPositiveInt(req.body.userId);
    let avatarUrl =
      req.body.avatarUrl === undefined || req.body.avatarUrl === null
        ? null
        : String(req.body.avatarUrl).trim();

    if (!userId) {
      return res.status(400).json({ error: "Valid userId is required." });
    }

    if (avatarUrl === "") {
      avatarUrl = null;
    }

    if (avatarUrl && avatarUrl.length > MAX_MEDIA_URL_LENGTH) {
      return res.status(400).json({ error: "Avatar image is too large." });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const db = getDb();
    await db.execute(
      `
      UPDATE users
      SET avatar_url = ?
      WHERE id = ?
      `,
      [avatarUrl, userId]
    );

    const payload = {
      userId,
      username: user.username,
      avatarUrl: avatarUrl || null,
    };

    io.emit("user_profile_updated", payload);

    return res.json({
      message: "Profile picture updated.",
      user: {
        id: userId,
        username: user.username,
        avatarUrl: avatarUrl || null,
      },
    });
  } catch (error) {
    console.error("[profile/avatar] failed:", error);
    return res.status(500).json({ error: "Failed to update profile picture." });
  }
});

app.post("/profile/username", async (req, res) => {
  try {
    const userId = toPositiveInt(req.body.userId);
    const newUsername = normalizeUsername(req.body.newUsername);

    if (!userId) {
      return res.status(400).json({ error: "Valid userId is required." });
    }

    const usernameValidationError = validateUsername(newUsername);
    if (usernameValidationError) {
      return res.status(400).json({ error: usernameValidationError });
    }

    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const db = getDb();
    await db.execute(
      `
      UPDATE users
      SET username = ?
      WHERE id = ?
      `,
      [newUsername, userId]
    );

    const payload = {
      userId,
      username: newUsername,
      avatarUrl: existingUser.avatar_url || null,
    };

    io.emit("user_profile_updated", payload);

    return res.json({
      message: "Username updated.",
      user: {
        id: userId,
        username: newUsername,
        avatarUrl: existingUser.avatar_url || null,
      },
    });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists." });
    }
    console.error("[profile/username] failed:", error);
    return res.status(500).json({ error: "Failed to update username." });
  }
});

app.get("/conversations", async (req, res) => {
  try {
    const userId = toPositiveInt(req.query.userId);
    const searchTerm = String(req.query.search || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "Valid userId query param is required." });
    }

    const db = getDb();
    const params = [userId, userId, userId, userId, userId, userId, userId, userId, userId];
    let searchFilter = "";
    if (searchTerm) {
      searchFilter = " AND u.username LIKE ? ";
      params.push(`%${searchTerm}%`);
    }

    const [rows] = await db.execute(
      `
      SELECT
        u.id AS user_id,
        u.username,
        u.avatar_url,
        m.id AS message_id,
        m.sender_id,
        m.receiver_id,
        m.message_type,
        m.message_encrypted,
        m.media_url,
        m.iv,
        m.created_at,
        m.deleted_at
      FROM users u
      LEFT JOIN messages m ON m.id = (
        SELECT m2.id
        FROM messages m2
        WHERE (
          (m2.sender_id = ? AND m2.receiver_id = u.id)
          OR
          (m2.sender_id = u.id AND m2.receiver_id = ?)
        )
        ORDER BY m2.created_at DESC, m2.id DESC
        LIMIT 1
      )
      WHERE u.id <> ?
        AND (
          EXISTS (
            SELECT 1
            FROM direct_invites di
            WHERE di.pair_key = CONCAT(LEAST(?, u.id), ':', GREATEST(?, u.id))
              AND di.status = 'accepted'
            LIMIT 1
          )
          OR (
            NOT EXISTS (
              SELECT 1
              FROM direct_invites di_existing
              WHERE di_existing.pair_key = CONCAT(LEAST(?, u.id), ':', GREATEST(?, u.id))
              LIMIT 1
            )
            AND EXISTS (
              SELECT 1
              FROM messages dm
              WHERE (
                (dm.sender_id = ? AND dm.receiver_id = u.id)
                OR
                (dm.sender_id = u.id AND dm.receiver_id = ?)
              )
              LIMIT 1
            )
          )
        )
      ${searchFilter}
      ORDER BY
        CASE WHEN m.created_at IS NULL THEN 1 ELSE 0 END ASC,
        m.created_at DESC,
        u.username ASC
      `,
      params
    );

    const conversations = rows.map((row) => {
      let lastMessage = null;
      if (row.message_id) {
        const mapped = mapMessageRow(
          {
            id: row.message_id,
            sender_id: row.sender_id,
            receiver_id: row.receiver_id,
            message_type: row.message_type,
            message_encrypted: row.message_encrypted,
            media_url: row.media_url,
            iv: row.iv,
            created_at: row.created_at,
            deleted_at: row.deleted_at,
          },
          userId
        );
        lastMessage = {
          id: mapped.id,
          senderId: mapped.senderId,
          preview: messagePreviewFromType(mapped.messageType, mapped.message),
          messageType: mapped.messageType,
          createdAt: mapped.createdAt,
        };
      }

      return {
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url || null,
        online: isUserOnline(row.user_id),
        lastMessage,
      };
    });

    return res.json({ conversations });
  } catch (error) {
    console.error("[conversations] failed:", error);
    return res.status(500).json({ error: "Failed to load conversations." });
  }
});

app.post("/direct-invites", async (req, res) => {
  try {
    const senderId = toPositiveInt(req.body.senderId);
    const receiverId = toPositiveInt(req.body.receiverId);

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Valid senderId and receiverId are required." });
    }

    const invite = await createDirectInvite(senderId, receiverId);
    const payload = {
      action: "sent",
      invite: serializeDirectInvite(invite),
    };
    emitDirectInviteUpdate(senderId, receiverId, payload);

    return res.status(201).json({
      message: "Invite sent.",
      invite: payload.invite,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[direct-invites:create] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to send invite." });
  }
});

app.post("/direct-invites/:id/respond", async (req, res) => {
  try {
    const inviteId = toPositiveInt(req.params.id);
    const userId = toPositiveInt(req.body.userId);
    const action = String(req.body.action || "").trim().toLowerCase();

    if (!inviteId || !userId) {
      return res.status(400).json({ error: "Valid invite id and userId are required." });
    }

    const invite = await respondToDirectInvite(inviteId, userId, action);
    const payload = {
      action: invite.status === "accepted" ? "accepted" : "rejected",
      invite: serializeDirectInvite(invite),
    };
    emitDirectInviteUpdate(invite.sender_id, invite.receiver_id, payload);

    return res.json({
      message: invite.status === "accepted" ? "Invite accepted." : "Invite declined.",
      invite: payload.invite,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[direct-invites:respond] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to respond to invite." });
  }
});

app.post("/friends/:id/remove", async (req, res) => {
  try {
    const friendId = toPositiveInt(req.params.id);
    const requesterId = toPositiveInt(req.body.requesterId ?? req.body.userId);

    if (!friendId || !requesterId) {
      return res.status(400).json({ error: "Valid friend id and requesterId are required." });
    }

    const invite = await removeDirectFriendship(requesterId, friendId);
    const payload = {
      action: "removed",
      invite: serializeDirectInvite(invite),
    };
    emitDirectInviteUpdate(requesterId, friendId, payload);

    return res.json({
      message: "Friend removed.",
      invite: payload.invite,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[friends:remove] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to remove friend." });
  }
});

app.post("/groups", async (req, res) => {
  try {
    const creatorId = toPositiveInt(req.body.userId);
    const groupName = normalizeGroupName(req.body.name);
    const requestedMemberIds = uniquePositiveInts(req.body.memberIds);

    if (!creatorId) {
      return res.status(400).json({ error: "Valid userId is required." });
    }

    const groupNameValidationError = validateGroupName(groupName);
    if (groupNameValidationError) {
      return res.status(400).json({ error: groupNameValidationError });
    }

    const memberIds = uniquePositiveInts([creatorId, ...requestedMemberIds]);
    if (memberIds.length < MIN_GROUP_MEMBER_COUNT) {
      return res.status(400).json({
        error: "Select at least one additional user to create a group.",
      });
    }

    const users = await findUsersByIds(memberIds);
    if (users.length !== memberIds.length) {
      return res.status(404).json({ error: "One or more selected users do not exist." });
    }

    const db = getDb();
    const connection = await db.getConnection();
    let groupId = null;

    try {
      await connection.beginTransaction();

      const [groupResult] = await connection.execute(
        `
        INSERT INTO \`groups\` (name)
        VALUES (?)
        `,
        [groupName]
      );

      groupId = groupResult.insertId;
      const valuesSql = memberIds.map(() => "(?, ?)").join(", ");
      const values = memberIds.flatMap((memberId) => [groupId, memberId]);

      await connection.execute(
        `
        INSERT INTO group_members (group_id, user_id)
        VALUES ${valuesSql}
        `,
        values
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await Promise.all(memberIds.map((memberId) => joinUserSocketsToGroup(memberId, groupId)));
    await emitGroupUpdate(groupId);
    const group = await getGroupSummary(groupId, creatorId);

    return res.status(201).json({
      message: "Group created.",
      group,
    });
  } catch (error) {
    console.error("[groups:create] failed:", error);
    return res.status(500).json({ error: "Failed to create group." });
  }
});

app.get("/groups", async (req, res) => {
  try {
    const userId = toPositiveInt(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: "Valid userId query param is required." });
    }

    const groups = await getGroupsForUser(userId);
    return res.json({ groups });
  } catch (error) {
    console.error("[groups:list] failed:", error);
    return res.status(500).json({ error: "Failed to load groups." });
  }
});

app.post("/groups/:id/avatar", async (req, res) => {
  try {
    const groupId = toPositiveInt(req.params.id);
    const requesterId = toPositiveInt(req.body.requesterId);
    let avatarUrl =
      req.body.avatarUrl === undefined || req.body.avatarUrl === null
        ? null
        : String(req.body.avatarUrl).trim();

    if (!groupId || !requesterId) {
      return res.status(400).json({ error: "Valid group id and requesterId are required." });
    }

    await ensureGroupMembership(groupId, requesterId);

    if (avatarUrl === "") {
      avatarUrl = null;
    }

    if (avatarUrl && avatarUrl.length > MAX_MEDIA_URL_LENGTH) {
      return res.status(400).json({ error: "Group image is too large." });
    }

    const db = getDb();
    await db.execute(
      `
      UPDATE \`groups\`
      SET avatar_url = ?
      WHERE id = ?
      `,
      [avatarUrl, groupId]
    );

    await emitGroupUpdate(groupId);
    const group = await getGroupSummary(groupId, requesterId);

    return res.json({
      message: "Group photo updated.",
      group,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[groups:avatar] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to update group photo." });
  }
});

app.post("/groups/:id/add-user", async (req, res) => {
  try {
    const groupId = toPositiveInt(req.params.id);
    const requesterId = toPositiveInt(req.body.requesterId);
    const newUserId = toPositiveInt(req.body.newUserId ?? req.body.userId);

    if (!groupId || !requesterId || !newUserId) {
      return res.status(400).json({
        error: "Valid group id, requesterId, and newUserId are required.",
      });
    }

    await ensureGroupMembership(groupId, requesterId);

    const user = await findUserById(newUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const alreadyMember = await isGroupMember(groupId, newUserId);
    if (alreadyMember) {
      return res.status(409).json({ error: "That user is already in the group." });
    }

    const db = getDb();
    await db.execute(
      `
      INSERT INTO group_members (group_id, user_id)
      VALUES (?, ?)
      `,
      [groupId, newUserId]
    );

    await joinUserSocketsToGroup(newUserId, groupId);
    await emitGroupUpdate(groupId);
    const group = await getGroupSummary(groupId, requesterId);

    return res.status(201).json({
      message: "User added to group.",
      group,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[groups:add-user] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to add user to group." });
  }
});

app.post("/groups/:id/leave", async (req, res) => {
  try {
    const groupId = toPositiveInt(req.params.id);
    const userId = toPositiveInt(req.body.userId ?? req.body.requesterId);

    if (!groupId || !userId) {
      return res.status(400).json({
        error: "Valid group id and userId are required.",
      });
    }

    const result = await leaveGroupMembership(groupId, userId);
    return res.json({
      message: "You left the group.",
      groupId: result.groupId,
      groupDeleted: result.groupDeleted,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[groups:leave] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to leave group." });
  }
});

app.get("/groups/:id/messages", async (req, res) => {
  try {
    const groupId = toPositiveInt(req.params.id);
    const userId = toPositiveInt(req.query.userId);

    if (!groupId || !userId) {
      return res.status(400).json({
        error: "Valid group id path param and userId query param are required.",
      });
    }

    await ensureGroupMembership(groupId, userId);

    const db = getDb();
    const [rows] = await db.execute(
      `
      SELECT
        gm.id,
        gm.group_id,
        gm.sender_id,
        gm.message_encrypted,
        gm.iv,
        gm.created_at,
        u.username AS sender_username,
        u.avatar_url AS sender_avatar_url
      FROM group_messages gm
      INNER JOIN users u ON u.id = gm.sender_id
      WHERE gm.group_id = ?
      ORDER BY gm.created_at ASC, gm.id ASC
      `,
      [groupId]
    );

    const messages = rows.map((row) => mapGroupMessageRow(row, userId));
    return res.json({ messages });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[groups:messages] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to load group messages." });
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const senderId = toPositiveInt(req.body.senderId);
    const receiverId = toPositiveInt(req.body.receiverId);
    const messageType = normalizeMessageType(req.body.messageType || MESSAGE_TYPES.TEXT);
    const message = String(req.body.message || "");
    const mediaUrl =
      req.body.mediaUrl === undefined || req.body.mediaUrl === null
        ? null
        : String(req.body.mediaUrl).trim();

    if (!senderId || !receiverId) {
      return res.status(400).json({
        error: "senderId and receiverId are required.",
      });
    }

    if (!ALLOWED_OUTGOING_TYPES.has(messageType)) {
      return res.status(400).json({
        error: "messageType must be text, image, or gif.",
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    if (messageType === MESSAGE_TYPES.TEXT && !message.trim()) {
      return res.status(400).json({ error: "Text message cannot be empty." });
    }

    if ((messageType === MESSAGE_TYPES.IMAGE || messageType === MESSAGE_TYPES.GIF) && !mediaUrl) {
      return res.status(400).json({ error: "mediaUrl is required for image/gif messages." });
    }

    if (mediaUrl && mediaUrl.length > MAX_MEDIA_URL_LENGTH) {
      return res.status(400).json({ error: "Media payload is too large." });
    }

    const usersExist = await ensureUsersExist(senderId, receiverId);
    if (!usersExist) {
      return res.status(404).json({ error: "Sender or receiver not found." });
    }
    await ensureDirectAccess(senderId, receiverId);

    const savedMessage = await persistEncryptedMessage({
      senderId,
      receiverId,
      messageText: message,
      messageType,
      mediaUrl,
    });

    const delivered = isUserOnline(receiverId);
    const senderPayload = {
      ...savedMessage,
      status: delivered ? "delivered" : "sent",
    };
    const receiverPayload = {
      ...savedMessage,
      status: "delivered",
    };

    emitToUser(receiverId, "receive_message", receiverPayload);

    if (delivered) {
      emitToUser(senderId, "message_status", {
        messageId: savedMessage.id,
        status: "delivered",
        receiverId,
      });
    }

    return res.status(201).json({
      message: "Message sent.",
      data: senderPayload,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[send-message] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to send message." });
  }
});

app.post("/delete-message", async (req, res) => {
  try {
    const messageId = toPositiveInt(req.body.messageId);
    const userId = toPositiveInt(req.body.userId);

    if (!messageId || !userId) {
      return res.status(400).json({ error: "messageId and userId are required." });
    }

    const deletedMessage = await markMessageDeleted(messageId, userId);

    emitToUser(deletedMessage.senderId, "message_deleted", deletedMessage);
    emitToUser(deletedMessage.receiverId, "message_deleted", deletedMessage);

    return res.json({
      message: "Message deleted.",
      data: deletedMessage,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[delete-message] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to delete message." });
  }
});

app.get("/messages/:userId", async (req, res) => {
  try {
    const otherUserId = toPositiveInt(req.params.userId);
    const currentUserId = toPositiveInt(req.query.currentUserId);

    if (!currentUserId || !otherUserId) {
      return res
        .status(400)
        .json({ error: "currentUserId query param and userId param are required." });
    }
    await ensureDirectAccess(currentUserId, otherUserId);

    const db = getDb();
    const [rows] = await db.execute(
      `
      SELECT id, sender_id, receiver_id, message_type, message_encrypted, media_url, iv, created_at, deleted_at
      FROM messages
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC, id ASC
      `,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    const otherUserOnline = isUserOnline(otherUserId);
    const messages = rows.map((row) => {
      const mapped = mapMessageRow(row, currentUserId);
      if (mapped.senderId === currentUserId && mapped.messageType !== MESSAGE_TYPES.DELETED) {
        mapped.status = otherUserOnline ? "delivered" : "sent";
      }
      return mapped;
    });

    return res.json({ messages });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[messages] failed:", error);
    }
    return res.status(status).json({ error: error.message || "Failed to fetch messages." });
  }
});

app.get("/gifs/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 24);

    if (!query) {
      return res.json({ gifs: [] });
    }

    if (typeof fetch !== "function") {
      return res.status(500).json({
        error: "GIF search is unavailable on this Node runtime.",
      });
    }

    if (GIPHY_API_KEY) {
      const url = new URL("https://api.giphy.com/v1/gifs/search");
      url.searchParams.set("api_key", GIPHY_API_KEY);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("rating", "pg-13");
      url.searchParams.set("lang", "en");

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`GIPHY responded with status ${response.status}`);
      }

      const data = await response.json();
      const gifs = (data.data || [])
        .map((gif) => ({
          id: `giphy_${gif.id}`,
          title: gif.title || "GIF",
          previewUrl:
            gif.images?.fixed_width_small_still?.url ||
            gif.images?.fixed_width_small?.url ||
            gif.images?.preview_gif?.url ||
            null,
          mediaUrl:
            gif.images?.downsized_medium?.url ||
            gif.images?.downsized?.url ||
            gif.images?.original?.url ||
            null,
        }))
        .filter((gif) => Boolean(gif.mediaUrl));

      return res.json({ gifs });
    }

    const tenorUrl = new URL("https://tenor.googleapis.com/v2/search");
    tenorUrl.searchParams.set("key", TENOR_API_KEY);
    tenorUrl.searchParams.set("client_key", TENOR_CLIENT_KEY);
    tenorUrl.searchParams.set("q", query);
    tenorUrl.searchParams.set("limit", String(limit));
    tenorUrl.searchParams.set("media_filter", "tinygif,gif,mediumgif");
    tenorUrl.searchParams.set("contentfilter", "medium");

    const tenorResponse = await fetch(tenorUrl, {
      headers: { Accept: "application/json" },
    });

    if (!tenorResponse.ok) {
      throw new Error(`Tenor responded with status ${tenorResponse.status}`);
    }

    const tenorData = await tenorResponse.json();
    const gifs = (tenorData.results || [])
      .map((gif) => {
        const mediaFormats = gif.media_formats || {};
        const previewUrl =
          mediaFormats.tinygif?.preview ||
          mediaFormats.tinygif?.url ||
          mediaFormats.gif?.preview ||
          mediaFormats.gif?.url ||
          null;
        const mediaUrl =
          mediaFormats.mediumgif?.url ||
          mediaFormats.gif?.url ||
          mediaFormats.tinygif?.url ||
          null;

        return {
          id: `tenor_${gif.id}`,
          title: gif.content_description || "GIF",
          previewUrl,
          mediaUrl,
        };
      })
      .filter((gif) => Boolean(gif.mediaUrl));

    return res.json({ gifs });
  } catch (error) {
    console.error("[gifs/search] failed:", error);
    return res.status(500).json({ error: "Failed to search GIFs." });
  }
});

io.on("connection", (socket) => {
  socket.on("register", async (payload) => {
    const rawUserId =
      payload && typeof payload === "object" ? payload.userId : payload;
    const userId = toPositiveInt(rawUserId);
    if (!userId) {
      return;
    }

    const previousUserId = toPositiveInt(socket.data.userId);
    if (previousUserId && previousUserId !== userId) {
      const becameOffline = removeSocketFromOnlineUser(previousUserId, socket.id);
      if (becameOffline) {
        emitPresenceUpdate(previousUserId, false);
      }

      const joinedGroupRooms = Array.from(socket.rooms).filter((roomName) =>
        roomName.startsWith("group_")
      );
      for (const roomName of joinedGroupRooms) {
        await socket.leave(roomName);
      }
    }

    const wasOnline = isUserOnline(userId);

    const userKey = String(userId);
    if (!onlineUsers.has(userKey)) {
      onlineUsers.set(userKey, new Set());
    }
    onlineUsers.get(userKey).add(socket.id);
    socket.data.userId = userId;

    try {
      await joinSocketToUserGroups(socket, userId);
    } catch (error) {
      console.error("[socket register] failed to join group rooms:", error);
    }

    if (!wasOnline) {
      emitPresenceUpdate(userId, true);
    }
  });

  socket.on("typing", async (payload) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const receiverId = toPositiveInt(payload && payload.receiverId);
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!senderId || !receiverId) {
        return;
      }

      if (registeredUserId && senderId !== registeredUserId) {
        return;
      }

      if (!(await canUsersDirectlyInteract(senderId, receiverId))) {
        return;
      }

      emitToUser(receiverId, "typing", { senderId, receiverId });
    } catch (error) {
      console.error("[socket typing] failed:", error);
    }
  });

  socket.on("stop_typing", async (payload) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const receiverId = toPositiveInt(payload && payload.receiverId);
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!senderId || !receiverId) {
        return;
      }

      if (registeredUserId && senderId !== registeredUserId) {
        return;
      }

      if (!(await canUsersDirectlyInteract(senderId, receiverId))) {
        return;
      }

      emitToUser(receiverId, "stop_typing", { senderId, receiverId });
    } catch (error) {
      console.error("[socket stop_typing] failed:", error);
    }
  });

  socket.on("group_typing", async (payload) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const groupId = toPositiveInt(payload && payload.groupId);
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!senderId || !groupId) {
        return;
      }
      if (registeredUserId && senderId !== registeredUserId) {
        return;
      }

      const member = await isGroupMember(groupId, senderId);
      if (!member) {
        return;
      }

      socket.to(getGroupRoomName(groupId)).emit("group_typing", {
        groupId,
        senderId,
      });
    } catch (error) {
      console.error("[socket group_typing] failed:", error);
    }
  });

  socket.on("group_stop_typing", async (payload) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const groupId = toPositiveInt(payload && payload.groupId);
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!senderId || !groupId) {
        return;
      }
      if (registeredUserId && senderId !== registeredUserId) {
        return;
      }

      const member = await isGroupMember(groupId, senderId);
      if (!member) {
        return;
      }

      socket.to(getGroupRoomName(groupId)).emit("group_stop_typing", {
        groupId,
        senderId,
      });
    } catch (error) {
      console.error("[socket group_stop_typing] failed:", error);
    }
  });

  socket.on("send_direct_invite", async (payload, callback) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const receiverId = toPositiveInt(payload && payload.receiverId);
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!senderId || !receiverId) {
        throw createHttpError(400, "senderId and receiverId are required.");
      }
      if (registeredUserId && senderId !== registeredUserId) {
        throw createHttpError(403, "Invalid sender identity.");
      }

      const invite = await createDirectInvite(senderId, receiverId);
      const message = {
        action: "sent",
        invite: serializeDirectInvite(invite),
      };
      emitDirectInviteUpdate(senderId, receiverId, message);

      if (typeof callback === "function") {
        callback({ ok: true, message });
      }
    } catch (error) {
      if ((error.status || 500) >= 500) {
        console.error("[socket send_direct_invite] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "Failed to send invite." });
      }
    }
  });

  socket.on("respond_direct_invite", async (payload, callback) => {
    try {
      const inviteId = toPositiveInt(payload && payload.inviteId);
      const userId = toPositiveInt(payload && payload.userId);
      const action = String((payload && payload.action) || "").trim().toLowerCase();
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!inviteId || !userId) {
        throw createHttpError(400, "inviteId and userId are required.");
      }
      if (registeredUserId && userId !== registeredUserId) {
        throw createHttpError(403, "Invalid user identity.");
      }

      const invite = await respondToDirectInvite(inviteId, userId, action);
      const message = {
        action: invite.status === "accepted" ? "accepted" : "rejected",
        invite: serializeDirectInvite(invite),
      };
      emitDirectInviteUpdate(invite.sender_id, invite.receiver_id, message);

      if (typeof callback === "function") {
        callback({ ok: true, message });
      }
    } catch (error) {
      if ((error.status || 500) >= 500) {
        console.error("[socket respond_direct_invite] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "Failed to respond to invite." });
      }
    }
  });

  socket.on("remove_friend", async (payload, callback) => {
    try {
      const requesterId = toPositiveInt(payload && (payload.requesterId ?? payload.userId));
      const friendId = toPositiveInt(payload && (payload.friendId ?? payload.targetUserId));
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!requesterId || !friendId) {
        throw createHttpError(400, "requesterId and friendId are required.");
      }
      if (registeredUserId && requesterId !== registeredUserId) {
        throw createHttpError(403, "Invalid user identity.");
      }

      const invite = await removeDirectFriendship(requesterId, friendId);
      const message = {
        action: "removed",
        invite: serializeDirectInvite(invite),
      };
      emitDirectInviteUpdate(requesterId, friendId, message);

      if (typeof callback === "function") {
        callback({ ok: true, message });
      }
    } catch (error) {
      if ((error.status || 500) >= 500) {
        console.error("[socket remove_friend] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "Failed to remove friend." });
      }
    }
  });

  socket.on("send_message", async (payload, callback) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const receiverId = toPositiveInt(payload && payload.receiverId);
      const messageType = normalizeMessageType(
        payload && payload.messageType ? payload.messageType : MESSAGE_TYPES.TEXT
      );
      const message = String((payload && payload.message) || "");
      const mediaUrl =
        payload && payload.mediaUrl !== undefined && payload.mediaUrl !== null
          ? String(payload.mediaUrl).trim()
          : null;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!senderId || !receiverId) {
        throw createHttpError(400, "senderId and receiverId are required.");
      }
      if (registeredUserId && senderId !== registeredUserId) {
        throw createHttpError(403, "Invalid sender identity.");
      }
      if (!ALLOWED_OUTGOING_TYPES.has(messageType)) {
        throw createHttpError(400, "Invalid message type.");
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        throw createHttpError(400, `Message exceeds ${MAX_MESSAGE_LENGTH} characters.`);
      }
      if (messageType === MESSAGE_TYPES.TEXT && !message.trim()) {
        throw createHttpError(400, "Text message cannot be empty.");
      }
      if ((messageType === MESSAGE_TYPES.IMAGE || messageType === MESSAGE_TYPES.GIF) && !mediaUrl) {
        throw createHttpError(400, "mediaUrl is required for image/gif messages.");
      }
      if (mediaUrl && mediaUrl.length > MAX_MEDIA_URL_LENGTH) {
        throw createHttpError(400, "Media payload is too large.");
      }

      const usersExist = await ensureUsersExist(senderId, receiverId);
      if (!usersExist) {
        throw createHttpError(404, "Sender or receiver not found.");
      }
      await ensureDirectAccess(senderId, receiverId);

      const savedMessage = await persistEncryptedMessage({
        senderId,
        receiverId,
        messageText: message,
        messageType,
        mediaUrl,
      });

      const delivered = isUserOnline(receiverId);
      const senderPayload = {
        ...savedMessage,
        status: delivered ? "delivered" : "sent",
      };
      const receiverPayload = {
        ...savedMessage,
        status: "delivered",
      };

      emitToUser(receiverId, "receive_message", receiverPayload);
      emitToUser(receiverId, "stop_typing", { senderId, receiverId });

      if (delivered) {
        emitToUser(senderId, "message_status", {
          messageId: savedMessage.id,
          status: "delivered",
          receiverId,
        });
      }

      if (typeof callback === "function") {
        callback({ ok: true, message: senderPayload });
      }
    } catch (error) {
      const errorMessage = error.message || "Failed to send message.";
      if ((error.status || 500) >= 500) {
        console.error("[socket send_message] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: errorMessage });
      }
    }
  });

  socket.on("send_group_message", async (payload, callback) => {
    try {
      const groupId = toPositiveInt(payload && payload.groupId);
      const senderId = toPositiveInt(payload && payload.senderId);
      const messageType = normalizeMessageType(
        payload && payload.messageType ? payload.messageType : MESSAGE_TYPES.TEXT
      );
      const message = String((payload && payload.message) || "");
      const mediaUrl =
        payload && payload.mediaUrl !== undefined && payload.mediaUrl !== null
          ? String(payload.mediaUrl).trim()
          : null;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!groupId || !senderId) {
        throw createHttpError(400, "groupId and senderId are required.");
      }
      if (registeredUserId && senderId !== registeredUserId) {
        throw createHttpError(403, "Invalid sender identity.");
      }
      if (!ALLOWED_OUTGOING_TYPES.has(messageType)) {
        throw createHttpError(400, "Invalid message type.");
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        throw createHttpError(400, `Message exceeds ${MAX_MESSAGE_LENGTH} characters.`);
      }
      if (messageType === MESSAGE_TYPES.TEXT && !message.trim()) {
        throw createHttpError(400, "Text message cannot be empty.");
      }
      if ((messageType === MESSAGE_TYPES.IMAGE || messageType === MESSAGE_TYPES.GIF) && !mediaUrl) {
        throw createHttpError(400, "mediaUrl is required for image/gif messages.");
      }
      if (mediaUrl && mediaUrl.length > MAX_MEDIA_URL_LENGTH) {
        throw createHttpError(400, "Media payload is too large.");
      }

      await ensureGroupMembership(groupId, senderId);
      await socket.join(getGroupRoomName(groupId));

      const savedMessage = await persistEncryptedGroupMessage({
        groupId,
        senderId,
        messageText: message,
        messageType,
        mediaUrl,
      });

      io.to(getGroupRoomName(groupId)).emit("receive_group_message", savedMessage);
      socket.to(getGroupRoomName(groupId)).emit("group_stop_typing", {
        groupId,
        senderId,
      });

      if (typeof callback === "function") {
        callback({ ok: true, message: savedMessage });
      }
    } catch (error) {
      const errorMessage = error.message || "Failed to send group message.";
      if ((error.status || 500) >= 500) {
        console.error("[socket send_group_message] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: errorMessage });
      }
    }
  });

  socket.on("leave_group", async (payload, callback) => {
    try {
      const groupId = toPositiveInt(payload && payload.groupId);
      const userId = toPositiveInt(payload && (payload.userId ?? payload.requesterId));
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!groupId || !userId) {
        throw createHttpError(400, "groupId and userId are required.");
      }
      if (registeredUserId && userId !== registeredUserId) {
        throw createHttpError(403, "Invalid user identity.");
      }

      const result = await leaveGroupMembership(groupId, userId);

      if (typeof callback === "function") {
        callback({
          ok: true,
          message: {
            groupId: result.groupId,
            userId: result.userId,
            groupDeleted: result.groupDeleted,
          },
        });
      }
    } catch (error) {
      const errorMessage = error.message || "Failed to leave group.";
      if ((error.status || 500) >= 500) {
        console.error("[socket leave_group] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: errorMessage });
      }
    }
  });

  socket.on("delete_message", async (payload, callback) => {
    try {
      const messageId = toPositiveInt(payload && payload.messageId);
      const userId = toPositiveInt(payload && payload.userId);
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!messageId || !userId) {
        throw createHttpError(400, "messageId and userId are required.");
      }

      if (registeredUserId && userId !== registeredUserId) {
        throw createHttpError(403, "Invalid user identity.");
      }

      const deletedMessage = await markMessageDeleted(messageId, userId);
      emitToUser(deletedMessage.senderId, "message_deleted", deletedMessage);
      emitToUser(deletedMessage.receiverId, "message_deleted", deletedMessage);

      if (typeof callback === "function") {
        callback({ ok: true, message: deletedMessage });
      }
    } catch (error) {
      const errorMessage = error.message || "Failed to delete message.";
      if ((error.status || 500) >= 500) {
        console.error("[socket delete_message] failed:", error);
      }

      if (typeof callback === "function") {
        callback({ ok: false, error: errorMessage });
      }
    }
  });

  const relayCallOffer = async (payload, callback) => {
    try {
      const fromUserId = toPositiveInt(payload && (payload.fromUserId ?? payload.from));
      const toUserId = toPositiveInt(payload && (payload.toUserId ?? payload.to));
      const callId = String((payload && payload.callId) || "").trim();
      const offer = payload && payload.offer;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!fromUserId || !toUserId || !callId || !offer) {
        throw createHttpError(400, "fromUserId, toUserId, callId, and offer are required.");
      }
      if (fromUserId === toUserId) {
        throw createHttpError(400, "Cannot call yourself.");
      }
      if (registeredUserId && fromUserId !== registeredUserId) {
        throw createHttpError(403, "Invalid caller identity.");
      }
      await ensureDirectAccess(fromUserId, toUserId);
      if (!isUserOnline(toUserId)) {
        throw createHttpError(409, "The selected user is offline.");
      }

      const callMessage = await persistCallLogMessage(fromUserId, toUserId);
      const senderMessage = {
        ...callMessage,
        status: "delivered",
      };
      const receiverMessage = {
        ...callMessage,
        status: "delivered",
      };

      emitToUser(fromUserId, "receive_message", senderMessage);
      emitToUser(toUserId, "receive_message", receiverMessage);
      emitToUser(fromUserId, "message_status", {
        messageId: callMessage.id,
        status: "delivered",
        receiverId: toUserId,
      });

      const outgoingPayload = {
        callId,
        fromUserId,
        from: fromUserId,
        toUserId,
        to: toUserId,
        offer,
      };
      emitToUser(toUserId, "incoming_call", outgoingPayload);
      emitToUser(toUserId, "incoming-call", outgoingPayload);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if ((error.status || 500) >= 500) {
        console.error("[socket call_offer] failed:", error);
      }
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "Failed to start call." });
      }
    }
  };

  socket.on("call_offer", relayCallOffer);
  socket.on("call-user", relayCallOffer);

  const relayCallAnswer = (payload, callback) => {
    try {
      const fromUserId = toPositiveInt(payload && (payload.fromUserId ?? payload.from));
      const toUserId = toPositiveInt(payload && (payload.toUserId ?? payload.to));
      const callId = String((payload && payload.callId) || "").trim();
      const answer = payload && payload.answer;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!fromUserId || !toUserId || !callId || !answer) {
        throw createHttpError(400, "fromUserId, toUserId, callId, and answer are required.");
      }
      if (registeredUserId && fromUserId !== registeredUserId) {
        throw createHttpError(403, "Invalid caller identity.");
      }

      const outgoingPayload = {
        callId,
        fromUserId,
        from: fromUserId,
        toUserId,
        to: toUserId,
        answer,
      };
      emitToUser(toUserId, "call_answer", outgoingPayload);
      emitToUser(toUserId, "call-answered", outgoingPayload);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if ((error.status || 500) >= 500) {
        console.error("[socket call_answer] failed:", error);
      }
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "Failed to answer call." });
      }
    }
  };

  socket.on("call_answer", relayCallAnswer);
  socket.on("answer-call", relayCallAnswer);

  const relayIceCandidate = (payload) => {
    try {
      const fromUserId = toPositiveInt(payload && (payload.fromUserId ?? payload.from));
      const toUserId = toPositiveInt(payload && (payload.toUserId ?? payload.to));
      const callId = String((payload && payload.callId) || "").trim();
      const candidate = payload && payload.candidate;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!fromUserId || !toUserId || !callId || !candidate) {
        return;
      }
      if (registeredUserId && fromUserId !== registeredUserId) {
        return;
      }

      const outgoingPayload = {
        callId,
        fromUserId,
        from: fromUserId,
        toUserId,
        to: toUserId,
        candidate,
      };
      emitToUser(toUserId, "call_ice_candidate", outgoingPayload);
      emitToUser(toUserId, "ice-candidate", outgoingPayload);
    } catch (error) {
      console.error("[socket call_ice_candidate] failed:", error);
    }
  };

  socket.on("call_ice_candidate", relayIceCandidate);
  socket.on("ice-candidate", relayIceCandidate);

  socket.on("call_reject", (payload) => {
    const fromUserId = toPositiveInt(payload && payload.fromUserId);
    const toUserId = toPositiveInt(payload && payload.toUserId);
    const callId = String((payload && payload.callId) || "").trim();
    const registeredUserId = toPositiveInt(socket.data.userId);

    if (!fromUserId || !toUserId || !callId) {
      return;
    }
    if (registeredUserId && fromUserId !== registeredUserId) {
      return;
    }

    emitToUser(toUserId, "call_reject", { callId, fromUserId, toUserId });
  });

  socket.on("call_end", (payload) => {
    const fromUserId = toPositiveInt(payload && payload.fromUserId);
    const toUserId = toPositiveInt(payload && payload.toUserId);
    const callId = String((payload && payload.callId) || "").trim();
    const registeredUserId = toPositiveInt(socket.data.userId);

    if (!fromUserId || !toUserId || !callId) {
      return;
    }
    if (registeredUserId && fromUserId !== registeredUserId) {
      return;
    }

    emitToUser(toUserId, "call_end", { callId, fromUserId, toUserId });
  });

  socket.on("disconnect", () => {
    const userId = toPositiveInt(socket.data.userId);
    if (!userId) {
      return;
    }

    const becameOffline = removeSocketFromOnlineUser(userId, socket.id);
    if (becameOffline) {
      emitPresenceUpdate(userId, false);
    }
  });
});

app.use((error, _req, res, _next) => {
  console.error("[express] unhandled error:", error);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error." });
});

async function startServer() {
  if (hasStarted) {
    return;
  }

  try {
    await initDatabase();
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(SERVER_PORT, HOST);
    });

    hasStarted = true;
    const webRtcConfig = getWebRtcConfig();
    console.log(`[startup] Server listening on port ${SERVER_PORT}`);
    console.log(`[startup] Static client directory: ${clientDir}`);
    console.log(
      `[startup] WebRTC policy=${webRtcConfig.iceTransportPolicy}, ` +
        `iceServers=${webRtcConfig.iceServers.length}, ` +
        `candidatePool=${webRtcConfig.iceCandidatePoolSize}`
    );
    const hasTurnUrls = getConfiguredTurnUrls().length > 0;
    if (hasTurnUrls && !(TURN_USERNAME && TURN_PASSWORD)) {
      console.warn("[startup] TURN URLs detected but TURN_USERNAME/TURN_PASSWORD are missing.");
    }
  } catch (error) {
    console.error("[startup] Failed to start:", error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`[shutdown] Received ${signal}. Closing resources...`);

  const forceCloseTimer = setTimeout(() => {
    console.error("[shutdown] Forced exit after timeout.");
    process.exit(1);
  }, 10_000);
  if (typeof forceCloseTimer.unref === "function") {
    forceCloseTimer.unref();
  }

  try {
    io.close();
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeDatabase();
    clearTimeout(forceCloseTimer);
    console.log("[shutdown] Complete.");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceCloseTimer);
    console.error("[shutdown] Failed:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception:", error);
});

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  startServer,
};
