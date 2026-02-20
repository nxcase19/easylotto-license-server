'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { loginSchema } = require('../validators');
const { findUserByEmail } = require('../repos/users');
const { findLicenseById } = require('../repos/licenses'); // ✅ เปลี่ยนตรงนี้

function requireEnv(name){
  const v = process.env[name];
  if(!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const router = express.Router();

router.post('/login', async (req,res)=>{
  const parsed = loginSchema.safeParse(req.body);
  if(!parsed.success){
    return res.status(400).json({
      ok:false,
      error:'bad_request',
      details: parsed.error.flatten()
    });
  }

  const { email, password } = parsed.data;

  // 1) หา user
  const user = await findUserByEmail(email);
  if(!user){
    return res.status(401).json({ ok:false, error:'invalid_credentials' });
  }

  // 2) bcrypt compare แบบมาตรฐาน Node
  const ok = await bcrypt.compare(password, user.password_hash);
  if(!ok){
    return res.status(401).json({ ok:false, error:'invalid_credentials' });
  }

  // 3) ใช้ license_id ที่ถูกต้อง
  const lic = await findLicenseById(user.license_id);
  if(!lic){
    return res.status(401).json({ ok:false, error:'license_not_found' });
  }

  // 4) ตรวจหมดอายุ
  if(new Date(lic.expires_at).getTime() < Date.now()){
    return res.status(403).json({ ok:false, error:'license_expired' });
  }

  // 5) JWT Token
  const token = jwt.sign(
    {
      uid: user.id,
      email: user.email,
      role: user.role,
      licenseId: lic.id,
      plan: lic.plan
    },
    requireEnv('JWT_SECRET'),
    { expiresIn: '12h' }
  );

  return res.json({
    ok:true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name || ''
    },
    license: {
      id: lic.id,
      plan: lic.plan,
      expiresAt: lic.expires_at,
      maxUsers: lic.max_users
    }
  });
});

module.exports = router;
