// src/repos/licenses.js
const db = require("../db");

/**
 * Find license by key
 */
async function findByKey(key) {
  const result = await db.query(
    "SELECT * FROM licenses WHERE license_key=$1 LIMIT 1",
    [key]
  );
  return result.rows[0] || null;
}

/**
 * Create license
 */
async function createLicense(licenseKey, packageCode, deviceId, expiresAt) {
  const result = await db.query(
    `INSERT INTO licenses (license_key, package_code, device_id, expires_at)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [licenseKey, packageCode, deviceId, expiresAt]
  );
  return result.rows[0];
}

module.exports = {
  findByKey,
  createLicense,
};
