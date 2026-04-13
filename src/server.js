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
const MAX_MEDIA_URL_LENGTH = 2_500_000;
const MAX_MESSAGE_LENGTH = 3000;

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
  DELETED: "deleted",
};

const ALLOWED_OUTGOING_TYPES = new Set([MESSAGE_TYPES.TEXT, MESSAGE_TYPES.IMAGE, MESSAGE_TYPES.GIF]);
const ALL_DB_TYPES = new Set([
  MESSAGE_TYPES.TEXT,
  MESSAGE_TYPES.IMAGE,
  MESSAGE_TYPES.GIF,
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

function normalizeMessageType(rawType) {
  const type = String(rawType || MESSAGE_TYPES.TEXT).toLowerCase().trim();
  if (!ALL_DB_TYPES.has(type)) {
    return MESSAGE_TYPES.TEXT;
  }
  return type;
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
  if (messageType === MESSAGE_TYPES.IMAGE) {
    return messageText ? `Photo: ${toPreviewText(messageText, 36)}` : "Photo";
  }
  if (messageType === MESSAGE_TYPES.GIF) {
    return messageText ? `GIF: ${toPreviewText(messageText, 36)}` : "GIF";
  }
  return toPreviewText(messageText, 45);
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

    let query = "SELECT id, username, avatar_url, created_at FROM users";
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
    const params = [userId, userId, userId];
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
    console.error("[send-message] failed:", error);
    return res.status(500).json({ error: "Failed to send message." });
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
    console.error("[messages] failed:", error);
    return res.status(500).json({ error: "Failed to fetch messages." });
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
  socket.on("register", (payload) => {
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
    }

    const wasOnline = isUserOnline(userId);

    const userKey = String(userId);
    if (!onlineUsers.has(userKey)) {
      onlineUsers.set(userKey, new Set());
    }
    onlineUsers.get(userKey).add(socket.id);
    socket.data.userId = userId;

    if (!wasOnline) {
      emitPresenceUpdate(userId, true);
    }
  });

  socket.on("typing", (payload) => {
    const senderId = toPositiveInt(payload && payload.senderId);
    const receiverId = toPositiveInt(payload && payload.receiverId);
    const registeredUserId = toPositiveInt(socket.data.userId);

    if (!senderId || !receiverId) {
      return;
    }

    if (registeredUserId && senderId !== registeredUserId) {
      return;
    }

    emitToUser(receiverId, "typing", { senderId, receiverId });
  });

  socket.on("stop_typing", (payload) => {
    const senderId = toPositiveInt(payload && payload.senderId);
    const receiverId = toPositiveInt(payload && payload.receiverId);
    const registeredUserId = toPositiveInt(socket.data.userId);

    if (!senderId || !receiverId) {
      return;
    }

    if (registeredUserId && senderId !== registeredUserId) {
      return;
    }

    emitToUser(receiverId, "stop_typing", { senderId, receiverId });
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

  socket.on("call_offer", (payload, callback) => {
    try {
      const fromUserId = toPositiveInt(payload && payload.fromUserId);
      const toUserId = toPositiveInt(payload && payload.toUserId);
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
      if (!isUserOnline(toUserId)) {
        throw createHttpError(409, "The selected user is offline.");
      }

      emitToUser(toUserId, "incoming_call", {
        callId,
        fromUserId,
        toUserId,
        offer,
      });

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
  });

  socket.on("call_answer", (payload, callback) => {
    try {
      const fromUserId = toPositiveInt(payload && payload.fromUserId);
      const toUserId = toPositiveInt(payload && payload.toUserId);
      const callId = String((payload && payload.callId) || "").trim();
      const answer = payload && payload.answer;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!fromUserId || !toUserId || !callId || !answer) {
        throw createHttpError(400, "fromUserId, toUserId, callId, and answer are required.");
      }
      if (registeredUserId && fromUserId !== registeredUserId) {
        throw createHttpError(403, "Invalid caller identity.");
      }

      emitToUser(toUserId, "call_answer", {
        callId,
        fromUserId,
        toUserId,
        answer,
      });

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
  });

  socket.on("call_ice_candidate", (payload) => {
    try {
      const fromUserId = toPositiveInt(payload && payload.fromUserId);
      const toUserId = toPositiveInt(payload && payload.toUserId);
      const callId = String((payload && payload.callId) || "").trim();
      const candidate = payload && payload.candidate;
      const registeredUserId = toPositiveInt(socket.data.userId);

      if (!fromUserId || !toUserId || !callId || !candidate) {
        return;
      }
      if (registeredUserId && fromUserId !== registeredUserId) {
        return;
      }

      emitToUser(toUserId, "call_ice_candidate", {
        callId,
        fromUserId,
        toUserId,
        candidate,
      });
    } catch (error) {
      console.error("[socket call_ice_candidate] failed:", error);
    }
  });

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
    console.log(`[startup] Server listening on port ${SERVER_PORT}`);
    console.log(`[startup] Static client directory: ${clientDir}`);
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
