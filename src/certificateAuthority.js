const fs = require("fs");
const path = require("path");

const {
  generateRsaKeyPairPem,
  signPlaintextMessage,
  verifyPlaintextSignature,
} = require("./cryptoUtils");

const CA_ISSUER = "CryptoChat-CA";
const caStorageDir = path.resolve(__dirname, "..", "data", "ca");
const caPrivateKeyPath = path.join(caStorageDir, "ca-private.pem");
const caPublicKeyPath = path.join(caStorageDir, "ca-public.pem");

let caState = null;

function serializeCertificatePayload(certificate) {
  return JSON.stringify({
    userId: Number(certificate.userId),
    username: String(certificate.username || ""),
    publicKey: String(certificate.publicKey || ""),
    issuedBy: String(certificate.issuedBy || CA_ISSUER),
  });
}

function ensureCaStorageDir() {
  fs.mkdirSync(caStorageDir, { recursive: true });
}

function loadStoredCaKeys() {
  if (!fs.existsSync(caPrivateKeyPath) || !fs.existsSync(caPublicKeyPath)) {
    return null;
  }

  return {
    privateKey: fs.readFileSync(caPrivateKeyPath, "utf8"),
    publicKey: fs.readFileSync(caPublicKeyPath, "utf8"),
  };
}

function writeCaKeys(keyPair) {
  ensureCaStorageDir();
  fs.writeFileSync(caPrivateKeyPath, keyPair.privateKey, "utf8");
  fs.writeFileSync(caPublicKeyPath, keyPair.publicKey, "utf8");
}

function initializeCertificateAuthority() {
  if (caState) {
    return caState;
  }

  const storedKeys = loadStoredCaKeys();
  const keyPair = storedKeys || generateRsaKeyPairPem(2048);

  if (!storedKeys) {
    writeCaKeys(keyPair);
  }

  caState = {
    issuer: CA_ISSUER,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };

  return caState;
}

function getCertificateAuthority() {
  if (!caState) {
    throw new Error("Certificate Authority is not initialized.");
  }
  return caState;
}

function issueUserCertificate({ userId, username, publicKey }) {
  const certificateAuthority = getCertificateAuthority();
  const certificate = {
    userId: Number(userId),
    username: String(username || ""),
    publicKey: String(publicKey || ""),
    issuedBy: certificateAuthority.issuer,
  };

  const signature = signPlaintextMessage(
    serializeCertificatePayload(certificate),
    certificateAuthority.privateKey
  );

  return {
    certificate,
    signature,
  };
}

function parseCertificateEnvelope(rawCertificate) {
  const parsed =
    typeof rawCertificate === "string" ? JSON.parse(rawCertificate) : rawCertificate;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Certificate payload is invalid.");
  }

  const certificate = parsed.certificate;
  const signature = parsed.signature;

  if (!certificate || typeof certificate !== "object" || !signature) {
    throw new Error("Certificate payload is incomplete.");
  }

  return {
    certificate: {
      userId: Number(certificate.userId),
      username: String(certificate.username || ""),
      publicKey: String(certificate.publicKey || ""),
      issuedBy: String(certificate.issuedBy || ""),
    },
    signature: String(signature),
  };
}

function verifyUserCertificate(rawCertificate) {
  const certificateAuthority = getCertificateAuthority();
  const envelope = parseCertificateEnvelope(rawCertificate);
  const valid =
    envelope.certificate.issuedBy === certificateAuthority.issuer &&
    verifyPlaintextSignature(
      serializeCertificatePayload(envelope.certificate),
      envelope.signature,
      certificateAuthority.publicKey
    );

  return {
    valid,
    certificate: envelope.certificate,
    signature: envelope.signature,
  };
}

module.exports = {
  CA_ISSUER,
  initializeCertificateAuthority,
  getCertificateAuthority,
  issueUserCertificate,
  parseCertificateEnvelope,
  verifyUserCertificate,
};
