const { Op } = require('sequelize');
const db = require('../models');
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'SuperSecretKey', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

exports.getClasses = async (req, res) => {
  try {
    // Get the list of classes for which the professor is assigned
    const classes = await db.Class.findAll({
      include: [{ model: db.User, as: 'professors', where: { id: req.user.userId }, attributes: ['id', 'first_name', 'last_name'] }]
    });
    res.json({ classes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve classes' });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    if (req.user.role !== 'professor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { date, classId } = req.query;
    const classRecord = await db.Class.findByPk(classId);
    if (!classRecord) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // TODO:  verify professor access via a join table check

    // get student
    const enrollments = await db.Class_Enrollment.findAll({ where: { class_id: classId } });
    const studentIds = enrollments.map(e => e.student_id);

    // filter attendance logs by the given date
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const logs = await db.Entry_Exit_Log.findAll({
      where: {
        user_id: { [Op.in]: studentIds },
        timestamp: { [Op.between]: [start, end] }
      },
      order: [['timestamp', 'ASC']],
      include: [{ model: db.User, as: 'user', attributes: ['first_name', 'last_name', 'id'] }]
    });
    // get last known GPS for these students
    const gpsRecords = await db.GPS_Location.findAll({
      where: { user_id: { [Op.in]: studentIds } },
      order: [['timestamp', 'DESC']]
    });
    // map data per student
    const attendance = studentIds.map(studentId => {
      const studentLogs = logs.filter(l => l.user_id === studentId);
      const studentGPS = gpsRecords.filter(g => g.user_id === studentId);
      return {
        studentId,
        logs: studentLogs,
        lastKnownLocation: studentGPS.length > 0 ? studentGPS[0] : null
      };
    });
    res.json({ date, classId, attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve class attendance' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    if (req.user.role !== 'professor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { classId, title, message } = req.body;
    // TODO: for steven/gelo: endpoint neto gamit kayo ng push notif service like ex. FCM.
    // naglolog ng notification tapos return success lang, pm if change.
    console.log(`Notification for class ${classId}: ${title} - ${message}`);
    res.json({ message: `Notification sent to class ${classId}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};