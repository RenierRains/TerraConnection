const router = require('express').Router();
const guardianController = require('../controllers/guardianController');
const guardianStudentController = require('../controllers/guardianStudentController');  

// Get all linked students for a guardian
router.get('/linked-students',
  guardianController.verifyToken,
  guardianController.getLinkedStudents
);

// For getting child status
router.get('/child-status/:studentId',
  guardianController.verifyToken,
  guardianController.getChildStatus
);

module.exports = router;