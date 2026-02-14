'use strict';
const { query, tx } = require('../db');

async function findLicenseByHash(licenseKeyHash){
  const r = await query(`SELECT * FROM licenses WHERE license_key_hash=$1 LIMIT 1`, [licenseKeyHash]);
  return r.rows[0] || null;
}

async function createLicense({ licenseKeyHash, customerName, plan, expiresAt, maxUsers, note, metaJson }){
  const r = await query(
    `INSERT INTO licenses (license_key_hash, customer_name, plan, expires_at, max_users, note, meta_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [licenseKeyHash, customerName, plan, expiresAt, maxUsers, note||'', metaJson||{}]
  );
  return r.rows[0];
}

async function bindMachineIfEmpty(licenseId, machineId){
  return tx(async (client)=>{
    const cur = await client.query(`SELECT id, bound_machine_id FROM licenses WHERE id=$1 FOR UPDATE`, [licenseId]);
    if(!cur.rows[0]) return { ok:false, error:'not_found' };
    const bound = cur.rows[0].bound_machine_id;
    if(bound && bound !== machineId) return { ok:false, error:'machine_mismatch' };
    if(!bound){
      await client.query(`UPDATE licenses SET bound_machine_id=$2, activated_at=NOW() WHERE id=$1`, [licenseId, machineId]);
    }
    const fresh = await client.query(`SELECT * FROM licenses WHERE id=$1`, [licenseId]);
    return { ok:true, license:fresh.rows[0] };
  });
}

async function countUsers(licenseId){
  const r = await query(`SELECT COUNT(*)::int AS c FROM users WHERE license_id=$1`, [licenseId]);
  return r.rows[0]?.c ?? 0;
}

module.exports = { findLicenseByHash, createLicense, bindMachineIfEmpty, countUsers };
