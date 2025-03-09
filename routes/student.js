const router = require('express').Router();
const studentController = require('../controllers/studentController');
const { verifyToken } = require('../controllers/authController');

// GET /api/student/attendance
router.get('/attendance', studentController.verifyToken, studentController.getAttendance);

// GET /api/student/schedule
router.get('/schedule', verifyToken, studentController.getSchedule);

// GET /api/student/notifications
router.get('/notifications', verifyToken, studentController.getNotifications);

module.exports = router;