const { getDb } = require("./db");

function normalizeRevokedCertificateRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: Number(row.user_id),
    username: row.username || null,
    revokedAt: row.revoked_at instanceof Date ? row.revoked_at.toISOString() : new Date(row.revoked_at).toISOString(),
  };
}

async function getRevokedCertificateByUserId(userId) {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT rc.user_id, rc.revoked_at, u.username
    FROM revoked_certificates rc
    LEFT JOIN users u ON u.id = rc.user_id
    WHERE rc.user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  return normalizeRevokedCertificateRow(rows[0] || null);
}

async function isCertificateRevoked(userId) {
  const revokedCertificate = await getRevokedCertificateByUserId(userId);
  return Boolean(revokedCertificate);
}

async function revokeCertificateByUserId(userId) {
  const db = getDb();
  await db.execute(
    `
    INSERT INTO revoked_certificates (user_id)
    VALUES (?)
    ON DUPLICATE KEY UPDATE user_id = user_id
    `,
    [userId]
  );

  return getRevokedCertificateByUserId(userId);
}

async function listRevokedCertificates() {
  const db = getDb();
  const [rows] = await db.execute(
    `
    SELECT rc.user_id, rc.revoked_at, u.username
    FROM revoked_certificates rc
    LEFT JOIN users u ON u.id = rc.user_id
    ORDER BY rc.revoked_at DESC, rc.user_id ASC
    `
  );

  return rows.map((row) => normalizeRevokedCertificateRow(row));
}

module.exports = {
  getRevokedCertificateByUserId,
  isCertificateRevoked,
  revokeCertificateByUserId,
  listRevokedCertificates,
};
