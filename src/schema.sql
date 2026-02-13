-- src/schema.sql

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,                -- BASIC / PRO / BUSINESS
  seats INTEGER NOT NULL,            -- จำนวนคนคีย์ที่อนุญาต
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  note TEXT,

  license_key_hash TEXT NOT NULL UNIQUE,

  status TEXT NOT NULL DEFAULT 'issued',  -- issued / active / revoked
  org_id TEXT,
  machine_fp TEXT,                   -- ผูกเครื่องเดียว
  activated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                 -- owner / clerk
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_licenses_org ON licenses(org_id);
