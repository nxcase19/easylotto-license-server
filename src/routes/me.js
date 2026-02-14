'use strict';
const express = require('express');
const { authRequired } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

router.get('/', authRequired, async (req,res)=>{
  const r = await query(`SELECT id, email, role, display_name, created_at FROM users WHERE id=$1 LIMIT 1`, [req.user.uid]);
  return res.json({ ok:true, user: r.rows[0]||null, session: req.user });
});

module.exports = router;
