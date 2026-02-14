'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/db');
const { generateLicenseKey, hashLicenseKey } = require('../src/crypto');

async function main(){
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@easylotto.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';

  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 5);

  const payload = { v:1, product:'EasyLotto', plan:'business', years:5, issuedAt: now.toISOString(), expHint: expires.toISOString(), kid:'INTERNAL-ADMIN' };
  const licenseKey = generateLicenseKey(payload);
  const licenseKeyHash = hashLicenseKey(licenseKey);

  const lic = await query(
    `INSERT INTO licenses (license_key_hash, customer_name, plan, expires_at, max_users, note, meta_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (license_key_hash) DO UPDATE SET customer_name=EXCLUDED.customer_name
     RETURNING *`,
    [licenseKeyHash, 'EasyLotto Internal Admin', 'business', expires.toISOString(), 50, 'internal', payload]
  );

  const existing = await query(`SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1`, [email]);
  if(existing.rows[0]){
    console.log('[seed:admin] admin already exists:', email);
    console.log('[seed:admin] internal license key (keep private):', licenseKey);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (license_id, email, password_hash, role, display_name, license_key_hash)
     VALUES ($1, lower($2), $3, 'admin', 'Super Admin', $4)`,
    [lic.rows[0].id, email, passwordHash, licenseKeyHash]
  );

  console.log('[seed:admin] created admin:', email);
  console.log('[seed:admin] password:', password);
  console.log('[seed:admin] internal license key (keep private):', licenseKey);
}

main().catch(e=>{
  console.error('[seed:admin] error:', e);
  process.exitCode = 1;
}).finally(async ()=>{
  try{ await pool.end(); }catch{}
});
