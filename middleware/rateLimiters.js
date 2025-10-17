'use strict';

const rateLimit = require('express-rate-limit');

// General rate limiter for mobile/API clients. Focuses on per-IP fairness.
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this device. Please try again later.'
  }
});

// Stricter limiter for admin web dashboard traffic to protect sensitive routes.
const adminWebRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP. Please slow down and try again shortly.'
});

module.exports = {
  apiRateLimiter,
  adminWebRateLimiter
};
