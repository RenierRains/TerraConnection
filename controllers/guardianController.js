const { Op } = require('sequelize');
const db = require('../models');
const jwt = require('jsonwebtoken');

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

// Get all students linked to a guardian
exports.getLinkedStudents = async (req, res) => {
  try {
    // verify role
    if (req.user.role !== 'guardian' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // get guardianId from the token
    const guardianId = req.user.userId;

    // get all linked students
    const relations = await db.Guardian_Student.findAll({
      where: { guardian_id: guardianId },
      include: [{
        model: db.User,
        as: 'student',
        attributes: ['id', 'first_name', 'last_name', 'school_id', 'profile_picture']
      }]
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // get status for each student
    const students = await Promise.all(relations.map(async (relation) => {
      const student = relation.student;

      // get last RFID scan
      const lastLog = await db.Entry_Exit_Log.findOne({
        where: { user_id: student.id },
        order: [['timestamp', 'DESC']],
        include: [{
          model: db.User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'school_id', 'profile_picture']
        }]
      });

      let onCampus = false;
      if (lastLog) {
        onCampus = (lastLog.type === 'entry');
      }

      // get last GPS location - prioritize guardian-specific location sharing
      const guardianGPS = await db.GPS_Location.findOne({
        where: { 
          user_id: student.id,
          class_id: null // Guardian sharing records have null class_id
        },
        order: [['timestamp', 'DESC']]
      });
      
      const anyGPS = await db.GPS_Location.findOne({
        where: { user_id: student.id },
        order: [['timestamp', 'DESC']]
      });
      
      const lastGPS = guardianGPS || anyGPS;
      
      console.log(`Guardian GPS for student ${student.id}:`, {
        guardianGPS: guardianGPS ? 'found' : 'none',
        anyGPS: anyGPS ? 'found' : 'none',
        selected: lastGPS ? 'found' : 'none',
        generalArea: lastGPS?.general_area
      });

      // count today's entry/exit activity
      const todaysLogs = await db.Entry_Exit_Log.findAll({
        where: {
          user_id: student.id,
          timestamp: {
            [Op.between]: [startOfDay, endOfDay]
          }
        },
        attributes: ['type', 'timestamp'],
        order: [['timestamp', 'ASC']]
      });

      const entryCount = todaysLogs.filter(log => log.type === 'entry').length;
      const exitCount = todaysLogs.filter(log => log.type === 'exit').length;
      const hasMultipleEntryExit = entryCount >= 2 && exitCount >= 2;

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        school_id: student.school_id,
        profile_picture: student.profile_picture,
        onCampus,
        lastLog,
        lastGPS,
        dailyEntryCount: entryCount,
        dailyExitCount: exitCount,
        hasMultipleEntryExit
      };
    }));

    res.json({ students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get linked students' });
  }
};

exports.getChildAttendance = async (req, res) => {
  try {
    if (req.user.role !== 'guardian' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const guardianId = req.user.userId;
    const { studentId } = req.params;
    const { date } = req.query;

    const relation = await db.Guardian_Student.findOne({
      where: { guardian_id: guardianId, student_id: studentId }
    });

    if (!relation) {
      return res.status(403).json({ error: 'You are not a guardian for this student' });
    }

    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const attendanceLogs = await db.Entry_Exit_Log.findAll({
      where: {
        user_id: studentId,
        timestamp: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      order: [['timestamp', 'ASC']],
      include: [{
        model: db.User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'school_id', 'profile_picture']
      }]
    });

    return res.json({ attendance: attendanceLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get child attendance' });
  }
};

// guardian queries child by userId and checks relaton
exports.getChildStatus = async (req, res) => {
  try {
    // verify
    if (req.user.role !== 'guardian' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // get guardianId from the token (req.user)
    const guardianId = req.user.userId;  // NOTE: test

    const { studentId } = req.params;

    // verify link
    const relation = await db.Guardian_Student.findOne({
      where: { guardian_id: guardianId, student_id: studentId }
    });
    if (!relation) {
      return res.status(403).json({ error: 'You are not a guardian for this student' });
    }

    // get last RFID scan
    const lastLog = await db.Entry_Exit_Log.findOne({
      where: { user_id: studentId },
      order: [['timestamp', 'DESC']]
    });

    let onCampus = false;
    if (lastLog) {
      onCampus = (lastLog.type === 'entry');
    }

    // get last GPS location - prioritize guardian-specific location sharing
    const lastGPS = await db.GPS_Location.findOne({
      where: { 
        user_id: studentId,
        class_id: null // Guardian sharing records have null class_id
      },
      order: [['timestamp', 'DESC']]
    }) || await db.GPS_Location.findOne({
      where: { user_id: studentId },
      order: [['timestamp', 'DESC']]
    });

    res.json({
      studentId,
      onCampus,
      lastLog,
      lastGPS
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get child status' });
  }
};
