const crypto = require("crypto");

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

function safeCompareHex(leftHex, rightHex) {
  if (typeof leftHex !== "string" || typeof rightHex !== "string") {
    return false;
  }

  try {
    const leftBuffer = Buffer.from(leftHex, "hex");
    const rightBuffer = Buffer.from(rightHex, "hex");

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch (error) {
    return false;
  }
}

function getAesKey() {
  const keyHex = process.env.AES_KEY_HEX;

  if (!keyHex) {
    throw new Error("AES_KEY_HEX is required in environment variables.");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("AES_KEY_HEX must be exactly 64 hex characters (32 bytes).");
  }

  return Buffer.from(keyHex, "hex");
}

const aesKey = getAesKey();

function encryptMessage(plainTextMessage) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainTextMessage), "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedMessage: encrypted.toString("hex"),
    iv: iv.toString("hex"),
  };
}

function decryptMessage(encryptedMessage, ivHex) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    aesKey,
    Buffer.from(ivHex, "hex")
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedMessage, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

module.exports = {
  generateSalt,
  hashPassword,
  safeCompareHex,
  encryptMessage,
  decryptMessage,
};
