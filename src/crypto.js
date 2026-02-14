'use strict';
const crypto = require('crypto');

function requireEnv(name){ const v=process.env[name]; if(!v) throw new Error(`Missing env: ${name}`); return v; }

function sha256Base64url(input){
  return crypto.createHash('sha256').update(String(input)).digest('base64url');
}
function hmacBase64url(key, input){
  return crypto.createHmac('sha256', String(key)).update(String(input)).digest('base64url');
}
function hashLicenseKey(licenseKey){
  return sha256Base64url(licenseKey);
}

// Format: EL.<base64url(json)>.<sig32>
function generateLicenseKey(payload){
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = hmacBase64url(requireEnv('LICENSE_MASTER_KEY'), body).slice(0,32);
  return `EL.${body}.${sig}`;
}

function verifyLicenseKey(licenseKey){
  try{
    const parts = String(licenseKey||'').split('.');
    if(parts.length!==3) return { ok:false, error:'invalid_format' };
    if(parts[0]!=='EL') return { ok:false, error:'invalid_prefix' };
    const body=parts[1], sig=parts[2];
    const exp = hmacBase64url(requireEnv('LICENSE_MASTER_KEY'), body).slice(0,32);
    if(!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return { ok:false, error:'invalid_signature' };
    const payload = JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    return { ok:true, payload };
  }catch{
    return { ok:false, error:'invalid_key' };
  }
}

function randomId(prefix=''){ return prefix + crypto.randomBytes(16).toString('hex'); }

module.exports = { sha256Base64url, hmacBase64url, hashLicenseKey, generateLicenseKey, verifyLicenseKey, randomId };
