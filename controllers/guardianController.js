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
        attributes: ['id', 'first_name', 'last_name', 'school_id']
      }]
    });

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
          attributes: ['id', 'first_name', 'last_name', 'school_id']
        }]
      });

      let onCampus = false;
      if (lastLog) {
        onCampus = (lastLog.type === 'entry');
      }

      // get last GPS location
      const lastGPS = await db.GPS_Location.findOne({
        where: { user_id: student.id },
        order: [['timestamp', 'DESC']]
      });

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        school_id: student.school_id,
        onCampus,
        lastLog,
        lastGPS
      };
    }));

    res.json({ students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get linked students' });
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

    // get last GPS location
    const lastGPS = await db.GPS_Location.findOne({
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