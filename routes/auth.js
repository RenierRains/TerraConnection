const router = require('express').Router();
const authController = require('../controllers/authController');
const { apiRateLimiter } = require('../middleware/rateLimiters');
const { verifyToken } = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', apiRateLimiter, authController.login);

// POST /api/auth/verify-otp
router.post('/verify-otp', authController.verifyOtp);

// POST /api/auth/forgot-password/request
router.post('/forgot-password/request', authController.requestPasswordReset);

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', authController.verifyPasswordResetOtp);

// POST /api/auth/forgot-password/reset
router.post('/forgot-password/reset', authController.completePasswordReset);

// GET /api/auth/me
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
