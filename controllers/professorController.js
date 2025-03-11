const { Op } = require('sequelize');
const db = require('../models');
const jwt = require('jsonwebtoken');
const firebase = require('../config/firebase');
const bcrypt = require('bcrypt');
const { logUserEvent } = require('./auditLogger');

// Track last notification time for each class
const notificationCooldowns = new Map();
const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
      include: [{ model: db.User, as: 'user', attributes: ['first_name', 'last_name', 'id'] }],
      attributes: ['user_id', 'timestamp', 'type']
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
    const { classId, title, message: notificationMessage } = req.body;

    // First get the class to ensure it exists and get its ID
    const classRecord = await db.Class.findOne({
      where: { 
        [Op.or]: [
          { id: classId }, // If classId is already a number
          { class_code: classId } // If classId is actually a class_code
        ]
      }
    });

    if (!classRecord) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check cooldown
    const lastNotificationTime = notificationCooldowns.get(classRecord.id);
    const now = Date.now();
    if (lastNotificationTime && (now - lastNotificationTime) < COOLDOWN_DURATION) {
      const remainingTime = Math.ceil((COOLDOWN_DURATION - (now - lastNotificationTime)) / 1000);
      return res.status(429).json({ 
        error: 'Notification cooldown in effect',
        remainingSeconds: remainingTime
      });
    }

    // Store notification in database using the actual class ID
    const notification = await db.Notification.create({
      title,
      message: notificationMessage,
      class_id: classRecord.id, // Use the actual class ID
      sender_id: req.user.userId
    });
    
    notificationCooldowns.set(classRecord.id, now);

    // Get all students in the class
    const enrollments = await db.Class_Enrollment.findAll({
      where: { class_id: classRecord.id }, // Use the actual class ID
      include: [{
        model: db.User,
        as: 'studentData',
        attributes: ['id', 'fcm_token']
      }]
    });

    // Get all FCM tokens
    const tokens = enrollments
      .map(enrollment => enrollment.studentData.fcm_token)
      .filter(token => token); // Remove null/undefined tokens

    console.log('Found tokens:', tokens);

    if (tokens.length > 0) {
      try {
        const messaging = await firebase.getMessaging();

        // Create a message for each token
        const messages = tokens.map(token => ({
          token,
          notification: {
            title,
            body: notificationMessage
          },
          data: {
            title,
            body: notificationMessage,
            notification_id: notification.id.toString(),
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'terra_channel',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          }
        }));

        console.log('Sending FCM messages:', JSON.stringify(messages, null, 2));
        
        let successCount = 0;
        let failureCount = 0;
        const responses = [];

        // Send messages one by one to handle errors for each token
        for (const msg of messages) {
          try {
            const response = await messaging.send(msg);
            responses.push(response);
            successCount++;
          } catch (fcmError) {
            failureCount++;
            console.error('FCM Error for token:', msg.token, {
              code: fcmError.code,
              message: fcmError.message
            });

            // If token is invalid or not registered, remove it from the database
            if (fcmError.code === 'messaging/registration-token-not-registered') {
              const studentWithToken = enrollments.find(e => e.studentData.fcm_token === msg.token);
              if (studentWithToken) {
                await db.User.update(
                  { fcm_token: null },
                  { where: { id: studentWithToken.studentData.id } }
                );
                console.log('Removed invalid token for user:', studentWithToken.studentData.id);
              }
            }
          }
        }

        return res.json({
          message: `Notification sent to class ${classId}`,
          success: successCount,
          failure: failureCount,
          total: tokens.length,
          responses: responses,
          notification_id: notification.id
        });
      } catch (fcmError) {
        console.error('FCM Error Details:', {
          code: fcmError.code,
          message: fcmError.message,
          stack: fcmError.stack,
          details: fcmError.errorInfo
        });
        return res.status(500).json({
          error: 'Failed to send FCM notification',
          details: fcmError.message
        });
      }
    } else {
      console.log('No valid FCM tokens found for class:', classId);
      return res.status(400).json({ error: 'No valid FCM tokens found for this class' });
    }
  } catch (err) {
    console.error('General Error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('Fetching schedule for professor:', userId);
    
    // Get all classes assigned to this professor through Class_Professor
    const assignments = await db.Class_Professor.findAll({
      where: { professor_id: userId },
      include: [{
        model: db.Class,
        as: 'classData',
        required: true
      }]
    });

    console.log('Found assignments:', JSON.stringify(assignments, null, 2));

    // Map the assignments to the schedule format
    const schedule = assignments.map(assignment => {
      // Normalize schedule days to three-letter format
      let normalizedSchedule = assignment.classData.schedule;
      if (normalizedSchedule) {
        normalizedSchedule = normalizedSchedule.split(',')
          .map(day => {
            day = day.trim();
            // Convert full names or single letters to three-letter format
            switch(day.toLowerCase()) {
              case 'monday': case 'm': case 'mon': return 'Mon';
              case 'tuesday': case 't': case 'tue': return 'Tue';
              case 'wednesday': case 'w': case 'wed': return 'Wed';
              case 'thursday': case 'th': case 'thu': return 'Thu';
              case 'friday': case 'f': case 'fri': return 'Fri';
              case 'saturday': case 'sa': case 'sat': return 'Sat';
              case 'sunday': case 'su': case 'sun': return 'Sun';
              default: return day;
            }
          })
          .join(',');
      }

      return {
        id: assignment.classData.id,
        class_code: assignment.classData.class_code,
        class_name: assignment.classData.class_name,
        course: assignment.classData.course,
        year: assignment.classData.year,
        section: assignment.classData.section,
        room: assignment.classData.room,
        start_time: assignment.classData.start_time,
        end_time: assignment.classData.end_time,
        schedule: normalizedSchedule,
        createdAt: assignment.classData.createdAt,
        updatedAt: assignment.classData.updatedAt
      };
    });

    console.log('Returning schedule:', JSON.stringify({ schedule }, null, 2));
    res.json({ schedule });
  } catch (err) {
    console.error('Error in getSchedule:', err);
    res.status(500).json({ error: 'Failed to get professor schedule' });
  }
};

exports.getClassEnrollment = async (req, res) => {
  try {
    if (req.user.role !== 'professor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { classId } = req.query;
    const classRecord = await db.Class.findByPk(classId);
    if (!classRecord) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const enrollments = await db.Class_Enrollment.findAll({
      where: { class_id: classId },
      include: [{
        model: db.User,
        as: 'studentData',
        attributes: ['id', 'first_name', 'last_name', 'email']
      }]
    });

    const formattedEnrollments = enrollments.map(enrollment => ({
      studentId: enrollment.student_id,
      student: {
        id: enrollment.studentData.id,
        firstName: enrollment.studentData.first_name,
        lastName: enrollment.studentData.last_name,
        email: enrollment.studentData.email
      }
    }));

    res.json({ enrollments: formattedEnrollments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve class enrollment data' });
  }
};