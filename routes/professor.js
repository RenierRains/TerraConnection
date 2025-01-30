const router = require('express').Router();
const professorController = require('../controllers/professorController');

// GET /api/professor/attendance?date=YYYY-MM-DD&classId=X
router.get('/attendance', 
  professorController.verifyToken,
  professorController.getClassAttendance
);

module.exports = router;