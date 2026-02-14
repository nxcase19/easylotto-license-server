'use strict';
const { Pool } = require('pg');

function requireEnv(name){ const v=process.env[name]; if(!v) throw new Error(`Missing env: ${name}`); return v; }

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
});

async function query(text, params){ return pool.query(text, params); }

async function tx(fn){
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  }catch(e){
    try{ await client.query('ROLLBACK'); }catch{}
    throw e;
  }finally{
    client.release();
  }
}

module.exports = { pool, query, tx };
