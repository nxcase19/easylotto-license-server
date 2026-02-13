'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

function requireEnv(name){ const v=process.env[name]; if(!v) throw new Error(`Missing env: ${name}`); return v; }

requireEnv('DATABASE_URL');
requireEnv('JWT_SECRET');
requireEnv('LICENSE_MASTER_KEY');

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/health', (req,res)=>res.json({ ok:true, service:'easylotto-license-server', time:new Date().toISOString() }));

app.use('/auth', require('./src/routes/auth'));
app.use('/license', require('./src/routes/license'));
app.use('/admin', require('./src/routes/admin'));
app.use('/me', require('./src/routes/me'));

app.use((req,res)=>res.status(404).json({ ok:false, error:'not_found' }));
app.use((err,req,res,next)=>{ console.error('[error]', err); res.status(500).json({ ok:false, error:'server_error' }); });

const port = Number(process.env.PORT || 3000);
app.listen(port, ()=>console.log(`[boot] listening on :${port}`));
