// src/validators.js

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isStrongPassword(str) {
  return typeof str === "string" && str.length >= 6;
}

module.exports = {
  isEmail,
  isStrongPassword,
};
