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

const primaryClientDir = path.resolve(__dirname, "..", "server", "client");
const fallbackClientDir = path.resolve(__dirname, "..", "client");
const clientDir = fs.existsSync(primaryClientDir)
  ? primaryClientDir
  : fallbackClientDir;
const indexFilePath = path.join(clientDir, "index.html");

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
app.use(express.json({ limit: "1mb" }));
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

async function findUserById(userId) {
  const db = getDb();
  const [rows] = await db.execute(
    "SELECT id, username FROM users WHERE id = ? LIMIT 1",
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

async function persistEncryptedMessage(senderId, receiverId, plainTextMessage) {
  const db = getDb();
  const { encryptedMessage, iv } = encryptMessage(plainTextMessage);

  const [result] = await db.execute(
    `
    INSERT INTO messages (sender_id, receiver_id, message_encrypted, iv)
    VALUES (?, ?, ?, ?)
    `,
    [senderId, receiverId, encryptedMessage, iv]
  );

  const [rows] = await db.execute(
    "SELECT id, created_at FROM messages WHERE id = ? LIMIT 1",
    [result.insertId]
  );

  return {
    id: result.insertId,
    senderId,
    receiverId,
    message: plainTextMessage,
    createdAt: rows[0] ? toIsoString(rows[0].created_at) : new Date().toISOString(),
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

app.post("/signup", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters long." });
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
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const db = getDb();
    const [rows] = await db.execute(
      `
      SELECT id, username, password_hash, salt
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
    const db = getDb();
    let query = "SELECT id, username, created_at FROM users";
    const params = [];

    if (excludeId) {
      query += " WHERE id <> ?";
      params.push(excludeId);
    }

    query += " ORDER BY username ASC";

    const [rows] = await db.execute(query, params);
    const users = rows.map((row) => ({
      id: row.id,
      username: row.username,
      createdAt: toIsoString(row.created_at),
    }));

    return res.json({ users });
  } catch (error) {
    console.error("[users] failed:", error);
    return res.status(500).json({ error: "Failed to load users." });
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const senderId = toPositiveInt(req.body.senderId);
    const receiverId = toPositiveInt(req.body.receiverId);
    const message = String(req.body.message || "").trim();

    if (!senderId || !receiverId || !message) {
      return res.status(400).json({
        error: "senderId, receiverId, and message are required.",
      });
    }

    const usersExist = await ensureUsersExist(senderId, receiverId);
    if (!usersExist) {
      return res.status(404).json({ error: "Sender or receiver not found." });
    }

    const savedMessage = await persistEncryptedMessage(senderId, receiverId, message);
    emitToUser(receiverId, "receive_message", savedMessage);

    return res.status(201).json({
      message: "Message sent.",
      data: savedMessage,
    });
  } catch (error) {
    console.error("[send-message] failed:", error);
    return res.status(500).json({ error: "Failed to send message." });
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
      SELECT id, sender_id, receiver_id, message_encrypted, iv, created_at
      FROM messages
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC, id ASC
      `,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    const messages = rows.map((row) => {
      let decryptedText;
      try {
        decryptedText = decryptMessage(row.message_encrypted, row.iv);
      } catch (error) {
        decryptedText = "[Unable to decrypt message]";
      }

      return {
        id: row.id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        message: decryptedText,
        createdAt: toIsoString(row.created_at),
      };
    });

    return res.json({ messages });
  } catch (error) {
    console.error("[messages] failed:", error);
    return res.status(500).json({ error: "Failed to fetch messages." });
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

    const userKey = String(userId);
    if (!onlineUsers.has(userKey)) {
      onlineUsers.set(userKey, new Set());
    }
    onlineUsers.get(userKey).add(socket.id);
    socket.data.userId = userKey;
  });

  socket.on("send_message", async (payload, callback) => {
    try {
      const senderId = toPositiveInt(payload && payload.senderId);
      const receiverId = toPositiveInt(payload && payload.receiverId);
      const message = String((payload && payload.message) || "").trim();

      if (!senderId || !receiverId || !message) {
        if (typeof callback === "function") {
          callback({ ok: false, error: "Invalid message payload." });
        }
        return;
      }

      const usersExist = await ensureUsersExist(senderId, receiverId);
      if (!usersExist) {
        if (typeof callback === "function") {
          callback({ ok: false, error: "Sender or receiver not found." });
        }
        return;
      }

      const savedMessage = await persistEncryptedMessage(senderId, receiverId, message);
      emitToUser(receiverId, "receive_message", savedMessage);

      if (typeof callback === "function") {
        callback({ ok: true, message: savedMessage });
      }
    } catch (error) {
      console.error("[socket send_message] failed:", error);
      if (typeof callback === "function") {
        callback({ ok: false, error: "Failed to send message." });
      }
    }
  });

  socket.on("disconnect", () => {
    const userKey = socket.data.userId;
    if (!userKey) {
      return;
    }

    const sockets = onlineUsers.get(userKey);
    if (!sockets) {
      return;
    }

    sockets.delete(socket.id);
    if (sockets.size === 0) {
      onlineUsers.delete(userKey);
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
