const router = require('express').Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/verify-otp
router.post('/verify-otp', authController.verifyOtp);

// GET /api/auth/me
router.get('/me', verifyToken, authController.getMe);

module.exports = router;