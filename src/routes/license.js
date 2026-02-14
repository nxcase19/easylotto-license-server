'use strict';
const express = require('express');

const { activateSchema, validateSchema } = require('../validators');
const { verifyLicenseKey, hashLicenseKey } = require('../crypto');
const { findLicenseByHash, bindMachineIfEmpty, countUsers } = require('../repos/licenses');
const { listUsersByLicense } = require('../repos/users');

const router = express.Router();

function featuresFromPlan(plan){
  const base = { key2:true, key3:true, export:true, ocr:false, multiBranch:false };
  if(plan==='pro') return { ...base, ocr:true };
  if(plan==='business') return { ...base, ocr:true, multiBranch:true };
  return base;
}

router.post('/activate', async (req,res)=>{
  const parsed = activateSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ ok:false, error:'bad_request', details: parsed.error.flatten() });

  const { licenseKey, machineId } = parsed.data;

  const verified = verifyLicenseKey(licenseKey);
  if(!verified.ok) return res.status(400).json({ ok:false, error:'invalid_license_key', reason: verified.error });

  const keyHash = hashLicenseKey(licenseKey);
  const lic = await findLicenseByHash(keyHash);
  if(!lic) return res.status(404).json({ ok:false, error:'license_not_found' });

  if(new Date(lic.expires_at).getTime() < Date.now()) return res.status(403).json({ ok:false, error:'license_expired' });

  const bound = await bindMachineIfEmpty(lic.id, machineId);
  if(!bound.ok) return res.status(403).json({ ok:false, error: bound.error });

  return res.json({
    ok:true,
    license: {
      id: bound.license.id,
      plan: bound.license.plan,
      expiresAt: bound.license.expires_at,
      maxUsers: bound.license.max_users,
      boundMachineId: bound.license.bound_machine_id
    },
    features: featuresFromPlan(bound.license.plan)
  });
});

router.post('/validate', async (req,res)=>{
  const parsed = validateSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ ok:false, error:'bad_request', details: parsed.error.flatten() });

  const { licenseKey, machineId } = parsed.data;

  const verified = verifyLicenseKey(licenseKey);
  if(!verified.ok) return res.status(400).json({ ok:false, error:'invalid_license_key', reason: verified.error });

  const keyHash = hashLicenseKey(licenseKey);
  const lic = await findLicenseByHash(keyHash);
  if(!lic) return res.status(404).json({ ok:false, error:'license_not_found' });

  if(new Date(lic.expires_at).getTime() < Date.now()) return res.status(403).json({ ok:false, error:'license_expired' });

  if(lic.bound_machine_id && lic.bound_machine_id !== machineId){
    return res.status(403).json({ ok:false, error:'machine_mismatch' });
  }

  const usersCount = await countUsers(lic.id);
  const users = await listUsersByLicense(lic.id);

  return res.json({
    ok:true,
    license: {
      id: lic.id,
      customerName: lic.customer_name,
      plan: lic.plan,
      expiresAt: lic.expires_at,
      maxUsers: lic.max_users,
      boundMachineId: lic.bound_machine_id,
      activatedAt: lic.activated_at
    },
    usersCount,
    users,
    features: featuresFromPlan(lic.plan)
  });
});

module.exports = router;
