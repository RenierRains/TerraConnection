const router = require('express').Router();
const gpsController = require('../controllers/gpsController');

// valid jwt needed
router.post('/share', gpsController.verifyToken, gpsController.shareLocation);

module.exports = router;