CREATE TABLE IF NOT EXISTS licenses (
  id BIGSERIAL PRIMARY KEY,
  license_key_hash TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basic','pro','business')),
  expires_at TIMESTAMPTZ NOT NULL,
  max_users INT NOT NULL DEFAULT 1,
  bound_machine_id TEXT NULL,
  activated_at TIMESTAMPTZ NULL,
  note TEXT NOT NULL DEFAULT '',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','owner','clerk')),
  display_name TEXT NOT NULL DEFAULT '',
  license_key_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_license_id ON users(license_id);
