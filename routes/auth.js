const router = require('express').Router();
const authController = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/me
//NOTE: Assumes a middleware that verifies token; can use the same function from authController
const { verifyToken } = require('../controllers/authController'); // IF not defined separately, can copy the verifyToken from another file
router.get('/me', verifyToken, authController.getMe);

module.exports = router;