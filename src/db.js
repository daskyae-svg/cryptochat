const mysql = require("mysql2/promise");

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "cryptochat",
} = process.env;

if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error("DB_NAME can only contain letters, numbers, and underscores.");
}

let pool;

async function initDatabase() {
  const bootstrapConnection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
  });

  await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await bootstrapConnection.end();

  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
  });

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const messagesTableSql = `
    CREATE TABLE IF NOT EXISTS messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message_encrypted TEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_messages_sender_receiver_created (sender_id, receiver_id, created_at),
      INDEX idx_messages_receiver_sender_created (receiver_id, sender_id, created_at)
    );
  `;

  await pool.query(usersTableSql);
  await pool.query(messagesTableSql);
}

function getDb() {
  if (!pool) {
    throw new Error("Database pool is not initialized. Call initDatabase() first.");
  }
  return pool;
}

module.exports = {
  initDatabase,
  getDb,
};
