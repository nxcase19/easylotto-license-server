// src/db.js
const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function q(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function one(text, params) {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const api = {
      q: (t, p) => client.query(t, p),
      one: async (t, p) => {
        const r = await client.query(t, p);
        return r.rows[0] || null;
      }
    };
    const out = await fn(api);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, q, one, tx };
