const crypto = require("crypto");

const AES_KEY_BYTES = 32;
const AES_IV_BYTES = 16;
const RSA_OAEP_OPTIONS = {
  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: "sha256",
};

function generateRsaKeyPairPem(modulusLength = 2048) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey,
    privateKey,
  };
}

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
  } catch (_error) {
    return false;
  }
}

function getSharedAesKey() {
  const keyHex = process.env.AES_KEY_HEX;

  if (!keyHex) {
    throw new Error("AES_KEY_HEX is required in environment variables.");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("AES_KEY_HEX must be exactly 64 hex characters (32 bytes).");
  }

  return Buffer.from(keyHex, "hex");
}

const sharedAesKey = getSharedAesKey();

function normalizeAesKey(aesKey) {
  const buffer = Buffer.isBuffer(aesKey) ? aesKey : Buffer.from(aesKey, "hex");
  if (buffer.length !== AES_KEY_BYTES) {
    throw new Error("AES-256 key must be exactly 32 bytes.");
  }
  return buffer;
}

function normalizeIv(iv) {
  const buffer = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, "hex");
  if (buffer.length !== AES_IV_BYTES) {
    throw new Error("AES-CBC IV must be exactly 16 bytes.");
  }
  return buffer;
}

function encryptWithAesKey(plainTextMessage, aesKey, iv) {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    normalizeAesKey(aesKey),
    normalizeIv(iv)
  );
  const encrypted = Buffer.concat([
    cipher.update(String(plainTextMessage), "utf8"),
    cipher.final(),
  ]);

  return encrypted.toString("hex");
}

function decryptWithAesKey(encryptedMessage, aesKey, iv) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    normalizeAesKey(aesKey),
    normalizeIv(iv)
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(String(encryptedMessage || ""), "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function encryptMessage(plainTextMessage) {
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const encryptedMessage = encryptWithAesKey(plainTextMessage, sharedAesKey, iv);

  return {
    encryptedMessage,
    iv: iv.toString("hex"),
  };
}

function decryptMessage(encryptedMessage, ivHex) {
  return decryptWithAesKey(encryptedMessage, sharedAesKey, ivHex);
}

function generateAesKey() {
  return crypto.randomBytes(AES_KEY_BYTES);
}

function generateIv() {
  return crypto.randomBytes(AES_IV_BYTES);
}

function encryptAesKeyWithPublicKey(aesKey, publicKey) {
  return crypto
    .publicEncrypt(
      {
        key: publicKey,
        ...RSA_OAEP_OPTIONS,
      },
      normalizeAesKey(aesKey)
    )
    .toString("base64");
}

function decryptAesKeyWithPrivateKey(encryptedAesKey, privateKey) {
  const decryptedKey = crypto.privateDecrypt(
    {
      key: privateKey,
      ...RSA_OAEP_OPTIONS,
    },
    Buffer.from(String(encryptedAesKey || ""), "base64")
  );

  return normalizeAesKey(decryptedKey);
}

function signPlaintextMessage(plainTextMessage, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(String(plainTextMessage), "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyPlaintextSignature(plainTextMessage, signature, publicKey) {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(String(plainTextMessage), "utf8");
  verifier.end();
  return verifier.verify(publicKey, String(signature || ""), "base64");
}

function encryptHybridMessage(plainTextMessage, { senderPrivateKey, senderPublicKey, receiverPublicKey }) {
  if (!senderPrivateKey || !senderPublicKey || !receiverPublicKey) {
    throw new Error("Sender private/public keys and receiver public key are required.");
  }

  const aesKey = generateAesKey();
  const iv = generateIv();
  const encryptedMessage = encryptWithAesKey(plainTextMessage, aesKey, iv);
  const encryptedAesKey = encryptAesKeyWithPublicKey(aesKey, receiverPublicKey);
  const senderEncryptedAesKey = encryptAesKeyWithPublicKey(aesKey, senderPublicKey);
  const signature = signPlaintextMessage(plainTextMessage, senderPrivateKey);

  return {
    encryptedMessage,
    iv: iv.toString("hex"),
    encryptedAesKey,
    senderEncryptedAesKey,
    signature,
  };
}

function decryptHybridMessage({
  encryptedMessage,
  iv,
  encryptedAesKey,
  signature,
  viewerPrivateKey,
  senderPublicKey,
}) {
  if (!viewerPrivateKey || !senderPublicKey) {
    throw new Error("Viewer private key and sender public key are required.");
  }

  try {
    const aesKey = decryptAesKeyWithPrivateKey(encryptedAesKey, viewerPrivateKey);
    const decryptedMessage = decryptWithAesKey(encryptedMessage, aesKey, iv);
    const verified = verifyPlaintextSignature(decryptedMessage, signature, senderPublicKey);

    if (!verified) {
      throw new Error("Message signature verification failed.");
    }

    return decryptedMessage;
  } catch (error) {
    if (error && error.message === "Message signature verification failed.") {
      throw error;
    }

    throw new Error("Failed to decrypt message.");
  }
}

module.exports = {
  generateSalt,
  hashPassword,
  safeCompareHex,
  generateRsaKeyPairPem,
  encryptMessage,
  decryptMessage,
  generateAesKey,
  generateIv,
  encryptWithAesKey,
  decryptWithAesKey,
  encryptAesKeyWithPublicKey,
  decryptAesKeyWithPrivateKey,
  signPlaintextMessage,
  verifyPlaintextSignature,
  encryptHybridMessage,
  decryptHybridMessage,
};
