'use strict';
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)
});

const createLicenseSchema = z.object({
  customerName: z.string().min(1).max(120),
  plan: z.enum(['basic','pro','business']),
  years: z.number().int().min(1).max(5).default(1),
  maxUsers: z.number().int().min(1).max(200).default(1),
  note: z.string().max(500).optional().default('')
});

const activateSchema = z.object({
  licenseKey: z.string().min(10),
  machineId: z.string().min(6).max(200)
});

const validateSchema = z.object({
  licenseKey: z.string().min(10),
  machineId: z.string().min(6).max(200)
});

const createUserSchema = z.object({
  licenseKey: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(['owner','clerk']).default('clerk'),
  displayName: z.string().min(1).max(120).optional().default('')
});

module.exports = { loginSchema, createLicenseSchema, activateSchema, validateSchema, createUserSchema };
