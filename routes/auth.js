const router = require('express').Router();
const authController = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/me
const { verifyToken } = require('../controllers/authController'); 
router.get('/me', verifyToken, authController.getMe);

router.post('/register-admin', authController.registerAdmin);


module.exports = router;