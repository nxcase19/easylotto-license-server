// src/config.js
require('dotenv').config();

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const PORT = Number(process.env.PORT || 3000);

const DATABASE_URL = must('DATABASE_URL');
const JWT_SECRET = must('JWT_SECRET');
const LICENSE_MASTER_KEY = must('LICENSE_MASTER_KEY');

// Admin (คุณ) ใช้สร้าง License
const ADMIN_EMAIL = must('ADMIN_EMAIL');
const ADMIN_PASSWORD = must('ADMIN_PASSWORD');

// CORS (ถ้าต้องยิงจากเว็บภายนอก)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

module.exports = {
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  LICENSE_MASTER_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CORS_ORIGIN
};
