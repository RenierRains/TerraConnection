const router = require('express').Router();
const guardianController = require('../controllers/guardianController');
const guardianStudentController = require('../controllers/guardianStudentController');  

// Get all linked students for a guardian
router.get('/linked-students',
  guardianController.verifyToken,
  guardianController.getLinkedStudents
);

router.get('/child-attendance/:studentId',
  guardianController.verifyToken,
  guardianController.getChildAttendance
);

// For getting child status
router.get('/child-status/:studentId',
  guardianController.verifyToken,
  guardianController.getChildStatus
);

module.exports = router;
