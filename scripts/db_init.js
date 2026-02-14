'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/db');

async function main(){
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  console.log('[db:init] schema applied');
}

main().catch(e=>{
  console.error('[db:init] error:', e);
  process.exitCode = 1;
}).finally(async ()=>{
  try{ await pool.end(); }catch{}
});
