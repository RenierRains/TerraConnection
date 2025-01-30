const router = require('express').Router();
const guardianController = require('../controllers/guardianController');

// GET /api/guardian/child-status/:studentId
router.get('/child-status/:studentId',
  guardianController.verifyToken,
  guardianController.getChildStatus
);

module.exports = router;