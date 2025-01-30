const router = require('express').Router();
const rfidController = require('../controllers/rfidController');

// POST /api/rfid/scan
router.post('/scan', rfidController.processScan);

module.exports = router;