const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes - require authentication
router.use(authenticateToken);

// Update user's current location
router.post('/update', locationController.updateLocation);

// Stop sharing location
router.post('/stop', locationController.stopSharing);

// Get locations of all students in a class
router.get('/class/:classId', locationController.getClassLocations);

module.exports = router; 