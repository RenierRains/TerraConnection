const express = require('express');
const router = express.Router();
const guardianLocationController = require('../controllers/guardianLocationController');
const { authenticateToken, isStudent, isGuardian } = require('../middleware/auth');

// Student endpoints
router.get('/status', authenticateToken, isStudent, guardianLocationController.getGuardianSharingStatus);
router.post('/start', authenticateToken, isStudent, guardianLocationController.startGuardianSharing);
router.post('/stop', authenticateToken, isStudent, guardianLocationController.stopGuardianSharing);
router.post('/update', authenticateToken, isStudent, guardianLocationController.updateLocation);

// Guardian endpoints
router.get('/student', authenticateToken, isGuardian, guardianLocationController.getStudentLocation);

module.exports = router; 