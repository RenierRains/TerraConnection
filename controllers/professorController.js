const { Op } = require('sequelize');
const db = require('../models');
const jwt = require('jsonwebtoken');

// Reuse a verifyToken from GPS or create your own
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'SuperSecretKey', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

exports.verifyToken = verifyToken;

exports.getClassAttendance = async (req, res) => {
  try {
    // professor must have token
    if (req.user.role !== 'professor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { date, classId } = req.query;
    // sample: GET /api/professor/attendance?date=2025-01-01&classId=3

    // validate professor has access to that class
    const classProfessor = await db.Class_Professor.findOne({
      where: { class_id: classId, professor_id: req.user.userId }
    });
    if (!classProfessor && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not manage this class' });
    }

    // find all students in that class
    const enrollments = await db.Class_Enrollment.findAll({ 
      where: { class_id: classId },
      include: [{ model: db.User, as: 'studentData' }] 
    });
    const studentIds = enrollments.map(e => e.student_id);

    // check entry logs for that day
    // check logs with a timestamp "same day" logic; simple approach
    const startOfDay = new Date(date);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23,59,59,999);

    const logs = await db.Entry_Exit_Log.findAll({
      where: {
        user_id: { [Op.in]: studentIds },
        timestamp: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      include: [{ model: db.User, as: 'user'}] // to get user details
    });

    // check GPS sharing for those students
    const gpsRecords = await db.GPS_Location.findAll({
      where: {
        user_id: { [Op.in]: studentIds },
        timestamp: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      order: [['timestamp', 'DESC']] // so you get the most recent first if you group them
    });

    // Construct response
    // For each student, we'll gather entry/exit logs + last known GPS if any
    // This is a quick approach; in production you might want more advanced logic
    const attendanceData = studentIds.map(studentId => {
      const studentLogs = logs.filter(l => l.user_id === studentId);
      // last known location from the gpsRecords
      const studentGPS = gpsRecords.filter(g => g.user_id === studentId);

      return {
        studentId,
        logs: studentLogs, 
        lastKnownLocation: studentGPS.length > 0 ? studentGPS[0] : null
      };
    });

    res.json({
      date,
      classId,
      attendance: attendanceData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch class attendance' });
  }
};