// src/server.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const { q, one, tx } = require('./db');
const {
  PORT, CORS_ORIGIN, JWT_SECRET,
  LICENSE_MASTER_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
} = require('./config');

const {
  nowISO, sha256,
  makeLicenseKey, verifyLicenseKey,
  hashPassword, comparePassword,
  clampInt, isEmail
} = require('./util');

const { requireAuth, requireRole, requireMachine } = require('./middleware');

const app = express();
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

function rid(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await q(sql);
}

// -------- Health --------
app.get('/health', async (req, res) => {
  try {
    const x = await one('SELECT 1 AS ok');
    res.json({ ok: true, db: !!x });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'DB_DOWN' });
  }
});

// -------- Admin Login (คุณ) --------
app.post('/admin/login', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  if (email !== ADMIN_EMAIL) return res.status(401).json({ ok: false, error: 'BAD_ADMIN' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: 'BAD_ADMIN' });

  const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ ok: true, token });
});

/**
 * Admin: Create License
 * POST /admin/licenses
 * headers: Authorization: Bearer <adminToken>
 * body: { plan: "BASIC|PRO|BUSINESS", years: 1, seats: 1, note: "" }
 */
app.post('/admin/licenses', requireAuth, requireRole('admin'), async (req, res) => {
  const plan = String(req.body?.plan || '').toUpperCase();
  const years = clampInt(req.body?.years, 1);
  let seats = clampInt(req.body?.seats, 1);
  const note = String(req.body?.note || '').trim();

  if (!['BASIC', 'PRO', 'BUSINESS'].includes(plan)) {
    return res.status(400).json({ ok: false, error: 'BAD_PLAN' });
  }

  // default seats per plan (ปรับได้)
  if (!req.body?.seats) {
    seats = plan === 'BASIC' ? 1 : plan === 'PRO' ? 3 : 10;
  }
  if (seats < 1) seats = 1;

  const id = rid('lic');
  const issuedAt = new Date();
  const exp = new Date(issuedAt);
  exp.setFullYear(exp.getFullYear() + Math.max(1, years));

  const payload = {
    lid: id,
    plan,
    seats,
    exp: exp.toISOString(),
    issuedAt: issuedAt.toISOString(),
    note
  };

  const licenseKey = makeLicenseKey(LICENSE_MASTER_KEY, payload);
  const licenseKeyHash = sha256(licenseKey);

  await q(
    `INSERT INTO licenses (id, plan, seats, expires_at, issued_at, note, license_key_hash, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'issued')`,
    [id, plan, seats, exp.toISOString(), issuedAt.toISOString(), note, licenseKeyHash]
  );

  res.json({
    ok: true,
    license: { id, plan, seats, expiresAt: exp.toISOString(), issuedAt: issuedAt.toISOString(), note },
    licenseKey
  });
});

/**
 * Admin: Revoke license
 * POST /admin/licenses/revoke
 * body: { licenseKey }
 */
app.post('/admin/licenses/revoke', requireAuth, requireRole('admin'), async (req, res) => {
  const licenseKey = String(req.body?.licenseKey || '').trim();
  if (!licenseKey) return res.status(400).json({ ok: false, error: 'MISSING_KEY' });

  const h = sha256(licenseKey);
  const lic = await one('SELECT * FROM licenses WHERE license_key_hash=$1', [h]);
  if (!lic) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  await q('UPDATE licenses SET status=$1 WHERE id=$2', ['revoked', lic.id]);
  res.json({ ok: true });
});

// -------- Customer APIs --------

/**
 * Validate license (no activation)
 * POST /license/validate
 * body: { licenseKey }
 */
app.post('/license/validate', async (req, res) => {
  const licenseKey = String(req.body?.licenseKey || '').trim();
  if (!licenseKey) return res.status(400).json({ ok: false, error: 'MISSING_KEY' });

  const v = verifyLicenseKey(LICENSE_MASTER_KEY, licenseKey);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

  const payload = v.payload || {};
  const h = sha256(licenseKey);
  const lic = await one('SELECT * FROM licenses WHERE license_key_hash=$1', [h]);
  if (!lic) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  const expired = new Date(lic.expires_at) < new Date();
  res.json({
    ok: true,
    license: {
      plan: lic.plan,
      seats: lic.seats,
      status: lic.status,
      expiresAt: lic.expires_at,
      activated: !!lic.activated_at,
      machineLocked: !!lic.machine_fp
    },
    expired
  });
});

/**
 * Activate license (ครั้งแรกผูกเครื่องเดียว + สร้าง Org + Owner)
 * POST /license/activate
 * headers: x-machine-fp: <fingerprint>
 * body: { licenseKey, orgName, ownerEmail, ownerPassword }
 */
app.post('/license/activate', requireMachine, async (req, res) => {
  const machineFp = req.machineFp;
  const licenseKey = String(req.body?.licenseKey || '').trim();
  const orgName = String(req.body?.orgName || '').trim() || 'EasyLotto Customer';
  const ownerEmail = String(req.body?.ownerEmail || '').trim();
  const ownerPassword = String(req.body?.ownerPassword || '');

  if (!licenseKey) return res.status(400).json({ ok: false, error: 'MISSING_KEY' });
  if (!isEmail(ownerEmail)) return res.status(400).json({ ok: false, error: 'BAD_EMAIL' });
  if (String(ownerPassword).length < 6) return res.status(400).json({ ok: false, error: 'PW_TOO_SHORT' });

  const v = verifyLicenseKey(LICENSE_MASTER_KEY, licenseKey);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

  const h = sha256(licenseKey);
  const lic = await one('SELECT * FROM licenses WHERE license_key_hash=$1', [h]);
  if (!lic) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  if (lic.status === 'revoked') return res.status(403).json({ ok: false, error: 'REVOKED' });
  if (new Date(lic.expires_at) < new Date()) return res.status(403).json({ ok: false, error: 'EXPIRED' });

  // ถ้าเคยผูกเครื่องแล้ว ต้องตรงเท่านั้น
  if (lic.machine_fp && lic.machine_fp !== machineFp) {
    return res.status(403).json({ ok: false, error: 'MACHINE_MISMATCH' });
  }

  // ถ้า activate แล้ว และมี org อยู่แล้ว -> ห้าม activate ซ้ำ (กันสร้าง org ซ้ำ)
  if (lic.org_id) {
    return res.status(200).json({
      ok: true,
      alreadyActive: true,
      message: 'License นี้ถูก Activate แล้ว',
      license: {
        plan: lic.plan,
        seats: lic.seats,
        expiresAt: lic.expires_at
      }
    });
  }

  const orgId = rid('org');
  const userId = rid('usr');
  const pwHash = await hashPassword(ownerPassword);

  await tx(async (db) => {
    await db.q(
      `INSERT INTO orgs (id, name, license_id, created_at)
       VALUES ($1,$2,$3,$4)`,
      [orgId, orgName, lic.id, nowISO()]
    );

    await db.q(
      `INSERT INTO users (id, org_id, email, password_hash, role, created_at)
       VALUES ($1,$2,$3,$4,'owner',$5)`,
      [userId, orgId, ownerEmail.toLowerCase(), pwHash, nowISO()]
    );

    await db.q(
      `UPDATE licenses
         SET status='active',
             org_id=$1,
             machine_fp=$2,
             activated_at=$3
       WHERE id=$4`,
      [orgId, machineFp, nowISO(), lic.id]
    );
  });

  const token = jwt.sign(
    { uid: userId, orgId, role: 'owner', email: ownerEmail.toLowerCase() },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    ok: true,
    token,
    org: { id: orgId, name: orgName },
    license: { plan: lic.plan, seats: lic.seats, expiresAt: lic.expires_at }
  });
});

/**
 * Login (Owner/Clerk)
 * POST /auth/login
 * headers: x-machine-fp: <fingerprint>
 * body: { email, password }
 */
app.post('/auth/login', requireMachine, async (req, res) => {
  const machineFp = req.machineFp;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!isEmail(email)) return res.status(400).json({ ok: false, error: 'BAD_EMAIL' });

  const user = await one('SELECT * FROM users WHERE email=$1', [email]);
  if (!user) return res.status(401).json({ ok: false, error: 'BAD_LOGIN' });

  const org = await one('SELECT * FROM orgs WHERE id=$1', [user.org_id]);
  if (!org) return res.status(401).json({ ok: false, error: 'BAD_LOGIN' });

  const lic = await one('SELECT * FROM licenses WHERE id=$1', [org.license_id]);
  if (!lic) return res.status(401).json({ ok: false, error: 'BAD_LOGIN' });

  if (lic.status !== 'active') return res.status(403).json({ ok: false, error: 'LICENSE_NOT_ACTIVE' });
  if (new Date(lic.expires_at) < new Date()) return res.status(403).json({ ok: false, error: 'EXPIRED' });
  if (lic.machine_fp && lic.machine_fp !== machineFp) return res.status(403).json({ ok: false, error: 'MACHINE_MISMATCH' });

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ ok: false, error: 'BAD_LOGIN' });

  const token = jwt.sign(
    { uid: user.id, orgId: org.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, role: user.role },
    org: { id: org.id, name: org.name },
    license: { plan: lic.plan, seats: lic.seats, expiresAt: lic.expires_at }
  });
});

/**
 * WhoAmI (ใช้ตอนเปิดโปรแกรม)
 * GET /me
 * headers: Authorization + x-machine-fp
 */
app.get('/me', requireMachine, requireAuth, async (req, res) => {
  const machineFp = req.machineFp;
  const org = await one('SELECT * FROM orgs WHERE id=$1', [req.user.orgId]);
  if (!org) return res.status(401).json({ ok: false, error: 'BAD_ORG' });

  const lic = await one('SELECT * FROM licenses WHERE id=$1', [org.license_id]);
  if (!lic) return res.status(401).json({ ok: false, error: 'BAD_LICENSE' });

  if (lic.machine_fp && lic.machine_fp !== machineFp) return res.status(403).json({ ok: false, error: 'MACHINE_MISMATCH' });
  if (lic.status !== 'active') return res.status(403).json({ ok: false, error: 'LICENSE_NOT_ACTIVE' });
  if (new Date(lic.expires_at) < new Date()) return res.status(403).json({ ok: false, error: 'EXPIRED' });

  const seatUsed = await one(
    `SELECT COUNT(*)::int AS n
       FROM users
      WHERE org_id=$1 AND role='clerk'`,
    [org.id]
  );

  res.json({
    ok: true,
    user: req.user,
    org: { id: org.id, name: org.name },
    license: { plan: lic.plan, seats: lic.seats, expiresAt: lic.expires_at },
    seats: { used: seatUsed?.n || 0, limit: lic.seats }
  });
});

/**
 * Owner: create keyer (clerk)
 * POST /users
 * headers: Authorization + x-machine-fp
 * body: { email, password, role: "clerk" }
 */
app.post('/users', requireMachine, requireAuth, requireRole('owner'), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const role = String(req.body?.role || 'clerk');

  if (role !== 'clerk') return res.status(400).json({ ok: false, error: 'ONLY_CLERK_ALLOWED' });
  if (!isEmail(email)) return res.status(400).json({ ok: false, error: 'BAD_EMAIL' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'PW_TOO_SHORT' });

  const org = await one('SELECT * FROM orgs WHERE id=$1', [req.user.orgId]);
  if (!org) return res.status(400).json({ ok: false, error: 'BAD_ORG' });

  const lic = await one('SELECT * FROM licenses WHERE id=$1', [org.license_id]);
  if (!lic) return res.status(400).json({ ok: false, error: 'BAD_LICENSE' });

  // Seat limit
  const seatUsed = await one(
    `SELECT COUNT(*)::int AS n
       FROM users
      WHERE org_id=$1 AND role='clerk'`,
    [org.id]
  );
  const used = seatUsed?.n || 0;
  if (used >= lic.seats) {
    return res.status(403).json({ ok: false, error: 'SEAT_LIMIT', used, limit: lic.seats });
  }

  const exists = await one('SELECT id FROM users WHERE org_id=$1 AND email=$2', [org.id, email]);
  if (exists) return res.status(409).json({ ok: false, error: 'EMAIL_EXISTS' });

  const id = rid('usr');
  const pwHash = await hashPassword(password);

  await q(
    `INSERT INTO users (id, org_id, email, password_hash, role, created_at)
     VALUES ($1,$2,$3,$4,'clerk',$5)`,
    [id, org.id, email, pwHash, nowISO()]
  );

  res.json({ ok: true, user: { id, email, role: 'clerk' }, seats: { used: used + 1, limit: lic.seats } });
});

/**
 * Owner: list users
 * GET /users
 */
app.get('/users', requireMachine, requireAuth, requireRole('owner'), async (req, res) => {
  const rows = await q(
    `SELECT id, email, role, created_at
       FROM users
      WHERE org_id=$1
      ORDER BY role ASC, created_at ASC`,
    [req.user.orgId]
  );
  res.json({ ok: true, users: rows.rows });
});

/**
 * Owner: delete user (clerk only)
 * DELETE /users/:id
 */
app.delete('/users/:id', requireMachine, requireAuth, requireRole('owner'), async (req, res) => {
  const id = String(req.params.id || '');
  const u = await one('SELECT * FROM users WHERE id=$1 AND org_id=$2', [id, req.user.orgId]);
  if (!u) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  if (u.role !== 'clerk') return res.status(403).json({ ok: false, error: 'CAN_DELETE_ONLY_CLERK' });

  await q('DELETE FROM users WHERE id=$1', [id]);
  res.json({ ok: true });
});

// ---- Boot ----
(async () => {
  await ensureSchema();
  app.listen(PORT, () => console.log(`EasyLotto API running on :${PORT}`));
})().catch((e) => {
  console.error('BOOT_ERROR', e);
  process.exit(1);
});
