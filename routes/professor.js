const router = require('express').Router();
const professorController = require('../controllers/professorController');

// GET /api/professor/classes
router.get('/classes', professorController.verifyToken, professorController.getClasses);

// GET /api/professor/attendance?date=YYYY-MM-DD&classId=X
router.get('/attendance', professorController.verifyToken, professorController.getAttendance);

// POST /api/professor/notification TODO: test 
router.post('/notification', professorController.verifyToken, professorController.sendNotification);

module.exports = router;