'use strict';
const jwt = require('jsonwebtoken');

function requireEnv(name){ const v=process.env[name]; if(!v) throw new Error(`Missing env: ${name}`); return v; }

function authRequired(req,res,next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if(!token) return res.status(401).json({ ok:false, error:'missing_token' });
  try{
    req.user = jwt.verify(token, requireEnv('JWT_SECRET'));
    return next();
  }catch{
    return res.status(401).json({ ok:false, error:'invalid_token' });
  }
}

function roleRequired(roles){
  const allowed = new Set(Array.isArray(roles)?roles:[roles]);
  return (req,res,next)=>{
    const r=req.user?.role;
    if(!r || !allowed.has(r)) return res.status(403).json({ ok:false, error:'forbidden' });
    return next();
  };
}

module.exports = { authRequired, roleRequired };
