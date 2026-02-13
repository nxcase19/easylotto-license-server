// src/middleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

function getMachineFp(req) {
  // ให้โปรแกรมส่ง header นี้ทุกครั้ง
  return String(req.headers['x-machine-fp'] || '').trim();
}

function requireMachine(req, res, next) {
  const fp = getMachineFp(req);
  if (!fp) return res.status(400).json({ ok: false, error: 'MISSING_MACHINE_FP' });
  req.machineFp = fp;
  next();
}

function requireAuth(req, res, next) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'NO_TOKEN' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'BAD_TOKEN' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const r = req.user?.role;
    if (!r || !roles.includes(r)) return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    next();
  };
}

module.exports = {
  getMachineFp,
  requireMachine,
  requireAuth,
  requireRole
};
