'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');

const { authRequired, roleRequired } = require('../middleware/auth');
const { createLicenseSchema, createUserSchema } = require('../validators');
const { generateLicenseKey, hashLicenseKey, randomId } = require('../crypto');
const { createLicense, findLicenseByHash, countUsers } = require('../repos/licenses');
const { createUser, findUserByEmail } = require('../repos/users');
const { query } = require('../db');

const router = express.Router();

router.post('/licenses', authRequired, roleRequired(['admin']), async (req,res)=>{
  const parsed = createLicenseSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ ok:false, error:'bad_request', details: parsed.error.flatten() });

  const { customerName, plan, years, maxUsers, note } = parsed.data;

  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + years);

  const payload = { v:1, product:'EasyLotto', plan, years, issuedAt: now.toISOString(), expHint: expires.toISOString(), kid: randomId('K') };
  const licenseKey = generateLicenseKey(payload);
  const licenseKeyHash = hashLicenseKey(licenseKey);

  const lic = await createLicense({
    licenseKeyHash,
    customerName,
    plan,
    expiresAt: expires.toISOString(),
    maxUsers,
    note,
    metaJson: payload
  });

  return res.json({
    ok:true,
    licenseKey,
    license: { id: lic.id, customerName: lic.customer_name, plan: lic.plan, expiresAt: lic.expires_at, maxUsers: lic.max_users }
  });
});

router.post('/users', authRequired, roleRequired(['admin']), async (req,res)=>{
  const parsed = createUserSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ ok:false, error:'bad_request', details: parsed.error.flatten() });

  const { licenseKey, email, password, role, displayName } = parsed.data;

  const keyHash = hashLicenseKey(licenseKey);
  const lic = await findLicenseByHash(keyHash);
  if(!lic) return res.status(404).json({ ok:false, error:'license_not_found' });

  if(new Date(lic.expires_at).getTime() < Date.now()) return res.status(403).json({ ok:false, error:'license_expired' });

  const existing = await findUserByEmail(email);
  if(existing) return res.status(409).json({ ok:false, error:'email_exists' });

  const used = await countUsers(lic.id);
  if(used >= (lic.max_users || 0)){
    return res.status(403).json({ ok:false, error:'seat_limit_reached', used, maxUsers: lic.max_users });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const u = await createUser({ licenseId: lic.id, email, passwordHash, role, displayName });

  await query(`UPDATE users SET license_key_hash=$1 WHERE id=$2`, [keyHash, u.id]);

  return res.json({ ok:true, user:u, licenseId: lic.id, plan: lic.plan });
});

module.exports = router;
