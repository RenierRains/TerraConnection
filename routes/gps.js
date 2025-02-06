const router = require('express').Router();
const gpsController = require('../controllers/gpsController');

// POST /api/gps/share (note Protected)
router.post('/share', gpsController.verifyToken, gpsController.shareLocation);

module.exports = router;