// src/util.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function nowISO() {
  return new Date().toISOString();
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function hmacSha256(key, msg) {
  return crypto.createHmac('sha256', key).update(String(msg)).digest('hex');
}

function b64urlEncode(obj) {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString('base64url');
}

function b64urlDecode(str) {
  const json = Buffer.from(String(str), 'base64url').toString('utf8');
  return JSON.parse(json);
}

/**
 * License Key format:
 *   EL.<payloadB64>.<sigHex>
 * payload = {
 *   lid, plan, seats, exp, issuedAt, note
 * }
 */
function makeLicenseKey(masterKey, payload) {
  const payloadB64 = b64urlEncode(payload);
  const sig = hmacSha256(masterKey, payloadB64);
  return `EL.${payloadB64}.${sig}`;
}

function verifyLicenseKey(masterKey, licenseKey) {
  const s = String(licenseKey || '').trim();
  const parts = s.split('.');
  if (parts.length !== 3) return { ok: false, error: 'BAD_FORMAT' };
  if (parts[0] !== 'EL') return { ok: false, error: 'BAD_PREFIX' };

  const payloadB64 = parts[1];
  const sig = parts[2];
  const expect = hmacSha256(masterKey, payloadB64);
  if (sig !== expect) return { ok: false, error: 'BAD_SIGNATURE' };

  let payload;
  try {
    payload = b64urlDecode(payloadB64);
  } catch {
    return { ok: false, error: 'BAD_PAYLOAD' };
  }
  return { ok: true, payload };
}

async function hashPassword(pw) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(pw), salt);
}

async function comparePassword(pw, hash) {
  return bcrypt.compare(String(pw), String(hash || ''));
}

function clampInt(n, def = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : def;
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

module.exports = {
  nowISO,
  sha256,
  hmacSha256,
  makeLicenseKey,
  verifyLicenseKey,
  hashPassword,
  comparePassword,
  clampInt,
  isEmail
};
