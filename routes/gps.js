const router = require('express').Router();
const gpsController = require('../controllers/gpsController');

// Protected route: must have valid JWT in Auth header
router.post('/share', gpsController.verifyToken, gpsController.shareLocation);

module.exports = router;