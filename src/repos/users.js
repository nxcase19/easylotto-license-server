// src/repos/users.js
const db = require("../db");

/**
 * Find user by email
 */
async function findByEmail(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email=$1 LIMIT 1",
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Create new user
 */
async function createUser(email, passwordHash, role = "staff") {
  const result = await db.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [email, passwordHash, role]
  );
  return result.rows[0];
}

module.exports = {
  findByEmail,
  createUser,
};
