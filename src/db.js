const mysql = require("mysql2/promise");

const DATABASE_URL = process.env.MYSQL_URL ? String(process.env.MYSQL_URL).trim() : "";
const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "cryptochat",
} = process.env;

if (!DATABASE_URL && !/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error("DB_NAME can only contain letters, numbers, and underscores.");
}

let pool;

function buildPoolConfig() {
  if (DATABASE_URL) {
    return {
      uri: DATABASE_URL,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: "Z",
    };
  }

  return {
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: "Z",
  };
}

async function verifyPoolConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

async function initDatabase() {
  if (pool) {
    return pool;
  }

  if (!DATABASE_URL) {
    const bootstrapConnection = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
    });

    try {
      await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    } finally {
      await bootstrapConnection.end();
    }
  }

  pool = mysql.createPool(buildPoolConfig());
  await verifyPoolConnection();

  await createTables();
  return pool;
}

async function createTables() {
  const usersTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(128) NOT NULL,
      salt VARCHAR(64) NOT NULL,
      avatar_url LONGTEXT NULL,
      public_key TEXT NULL,
      private_key TEXT NULL,
      certificate TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const messagesTableSql = `
    CREATE TABLE IF NOT EXISTS messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message_type VARCHAR(20) NOT NULL DEFAULT 'text',
      message_encrypted TEXT NOT NULL,
      encrypted_aes_key TEXT NULL,
      sender_encrypted_aes_key TEXT NULL,
      signature TEXT NULL,
      media_url LONGTEXT NULL,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      iv VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_messages_sender_receiver_created (sender_id, receiver_id, created_at),
      INDEX idx_messages_receiver_sender_created (receiver_id, sender_id, created_at)
    );
  `;

  const directInvitesTableSql = `
    CREATE TABLE IF NOT EXISTS direct_invites (
      id INT PRIMARY KEY AUTO_INCREMENT,
      pair_key VARCHAR(64) NOT NULL UNIQUE,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      responded_at TIMESTAMP NULL DEFAULT NULL,
      CONSTRAINT fk_direct_invites_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_direct_invites_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_direct_invites_receiver_status (receiver_id, status, created_at),
      INDEX idx_direct_invites_sender_status (sender_id, status, created_at)
    );
  `;

  const revokedCertificatesTableSql = `
    CREATE TABLE IF NOT EXISTS revoked_certificates (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_revoked_certificates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_revoked_certificates_revoked_at (revoked_at, user_id)
    );
  `;

  const userBlocksTableSql = `
    CREATE TABLE IF NOT EXISTS user_blocks (
      id INT PRIMARY KEY AUTO_INCREMENT,
      blocker_id INT NOT NULL,
      blocked_id INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT uq_user_blocks_pair UNIQUE (blocker_id, blocked_id),
      INDEX idx_user_blocks_blocker (blocker_id, created_at),
      INDEX idx_user_blocks_blocked (blocked_id, created_at)
    );
  `;

  const groupsTableSql = `
    CREATE TABLE IF NOT EXISTS \`groups\` (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      avatar_url LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const groupMembersTableSql = `
    CREATE TABLE IF NOT EXISTS group_members (
      id INT PRIMARY KEY AUTO_INCREMENT,
      group_id INT NOT NULL,
      user_id INT NOT NULL,
      CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
      CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT uq_group_members UNIQUE (group_id, user_id),
      INDEX idx_group_members_user_group (user_id, group_id)
    );
  `;

  const groupMessagesTableSql = `
    CREATE TABLE IF NOT EXISTS group_messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      group_id INT NOT NULL,
      sender_id INT NOT NULL,
      message_encrypted LONGTEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_group_messages_group FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
      CONSTRAINT fk_group_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_group_messages_group_created (group_id, created_at, id),
      INDEX idx_group_messages_sender_created (sender_id, created_at, id)
    );
  `;

  await pool.query(usersTableSql);
  await pool.query(messagesTableSql);
  await pool.query(directInvitesTableSql);
  await pool.query(revokedCertificatesTableSql);
  await pool.query(userBlocksTableSql);
  await pool.query(groupsTableSql);
  await pool.query(groupMembersTableSql);
  await pool.query(groupMessagesTableSql);
  await ensureUserColumns();
  await ensureMessageColumns();
  await ensureGroupColumns();
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, definitionSql) {
  const exists = await columnExists(tableName, columnName);
  if (exists) {
    return;
  }

  await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definitionSql}`);
}

async function ensureMessageColumns() {
  await ensureColumn(
    "messages",
    "message_type",
    "message_type VARCHAR(20) NOT NULL DEFAULT 'text' AFTER receiver_id"
  );
  await ensureColumn(
    "messages",
    "encrypted_aes_key",
    "encrypted_aes_key TEXT NULL AFTER message_encrypted"
  );
  await ensureColumn(
    "messages",
    "sender_encrypted_aes_key",
    "sender_encrypted_aes_key TEXT NULL AFTER encrypted_aes_key"
  );
  await ensureColumn(
    "messages",
    "signature",
    "signature TEXT NULL AFTER sender_encrypted_aes_key"
  );
  await ensureColumn(
    "messages",
    "media_url",
    "media_url LONGTEXT NULL AFTER signature"
  );
  await ensureColumn(
    "messages",
    "deleted_at",
    "deleted_at TIMESTAMP NULL DEFAULT NULL AFTER media_url"
  );
}

async function ensureUserColumns() {
  await ensureColumn(
    "users",
    "avatar_url",
    "avatar_url LONGTEXT NULL AFTER salt"
  );
  await ensureColumn(
    "users",
    "public_key",
    "public_key TEXT NULL AFTER avatar_url"
  );
  await ensureColumn(
    "users",
    "private_key",
    "private_key TEXT NULL AFTER public_key"
  );
  await ensureColumn(
    "users",
    "certificate",
    "certificate TEXT NULL AFTER private_key"
  );
}

async function ensureGroupColumns() {
  await ensureColumn(
    "groups",
    "avatar_url",
    "avatar_url LONGTEXT NULL AFTER name"
  );
}

function getDb() {
  if (!pool) {
    throw new Error("Database pool is not initialized. Call initDatabase() first.");
  }
  return pool;
}

async function closeDatabase() {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = null;
  await activePool.end();
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
};
