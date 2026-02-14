'use strict';
const { query } = require('../db');

async function findUserByEmail(email){
  const r = await query(`SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1`, [email]);
  return r.rows[0] || null;
}

async function createUser({ licenseId, email, passwordHash, role, displayName }){
  const r = await query(
    `INSERT INTO users (license_id, email, password_hash, role, display_name)
     VALUES ($1, lower($2), $3, $4, $5)
     RETURNING id, license_id, email, role, display_name, created_at`,
    [licenseId, email, passwordHash, role, displayName||'']
  );
  return r.rows[0];
}

async function listUsersByLicense(licenseId){
  const r = await query(
    `SELECT id, email, role, display_name, created_at FROM users WHERE license_id=$1 ORDER BY created_at ASC`,
    [licenseId]
  );
  return r.rows;
}

module.exports = { findUserByEmail, createUser, listUsersByLicense };
