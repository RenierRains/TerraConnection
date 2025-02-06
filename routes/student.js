const router = require('express').Router();
const studentController = require('../controllers/studentController');

// GET /api/student/attendance
router.get('/attendance', studentController.verifyToken, studentController.getAttendance);

module.exports = router;