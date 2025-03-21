const express = require('express');
const router = express.Router();
const guardianLocationController = require('../controllers/guardianLocationController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes - require authentication
router.use(authenticateToken);

// Update guardian's location
router.post('/update', guardianLocationController.updateLocation);

// Stop sharing location
router.post('/stop', guardianLocationController.stopSharing);

// Get student's location
router.get('/student/:studentId', guardianLocationController.getStudentLocation);

module.exports = router; 