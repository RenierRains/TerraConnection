const router = require('express').Router();
const rfidController = require('../controllers/rfidController');
const ipRestriction = require('../middleware/ipRestriction');

// POST /api/rfid/scan
router.post('/scan', ipRestriction, rfidController.processScan);

// POST /api/rfid/face-verify
router.post('/face-verify', ipRestriction, rfidController.updateFaceVerification);

module.exports = router;