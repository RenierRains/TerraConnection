const db = require('../models');
const { Op } = require('sequelize');
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

exports.getAttendance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date } = req.query;
    let whereClause = { user_id: userId };
    if (date) {
      //date is in YYYY-MM-DD
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      whereClause.timestamp = { [db.Sequelize.Op.between]: [start, end] };
    }
    const logs = await db.Entry_Exit_Log.findAll({ where: whereClause, order: [['timestamp', 'ASC']] });
    res.json({ attendance: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve attendance records' });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const userId = req.user.userId;
    let date = req.query.date ? new Date(req.query.date) : new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayAbbrev = days[date.getDay()];
    
    const enrollments = await db.Class_Enrollment.findAll({
      where: { student_id: userId },
      include: [{
        model: db.Class,
        as: 'classData',
        where: {
          schedule: { [Op.like]: `%${dayAbbrev}%` }
        }
      }]
    });
    
    const classes = enrollments.map(enrollment => enrollment.classData);
    
    res.json({
      date: date.toISOString().slice(0,10),
      schedule: classes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get student schedule' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all classes the student is enrolled in
    const enrollments = await db.Class_Enrollment.findAll({
      where: { student_id: userId }
    });

    const classIds = enrollments.map(e => e.class_id);

    // Get notifications for these classes
    const notifications = await db.Notification.findAll({
      where: {
        class_id: { [db.Sequelize.Op.in]: classIds }
      },
      include: [
        {
          model: db.Class,
          as: 'class',
          attributes: ['class_name', 'class_code']
        },
        {
          model: db.User,
          as: 'sender',
          attributes: ['first_name', 'last_name']
        },
        {
          model: db.User,
          as: 'readBy',
          attributes: ['id'],
          where: { id: userId },
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 50 // Limit to last 50 notifications
    });

    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      class_name: notification.class.class_name,
      class_code: notification.class.class_code,
      sender_name: `${notification.sender.first_name} ${notification.sender.last_name}`,
      created_at: notification.created_at,
      is_read: notification.readBy.length > 0
    }));

    res.json({ notifications: formattedNotifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    // Check if notification exists and user has access to it
    const notification = await db.Notification.findOne({
      where: { id: notificationId },
      include: [{
        model: db.Class,
        as: 'class',
        include: [{
          model: db.Class_Enrollment,
          where: { student_id: userId }
        }]
      }]
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found or access denied' });
    }

    // Mark as read
    await db.NotificationReadStatus.create({
      notification_id: notificationId,
      user_id: userId
    });

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      // Notification was already marked as read
      return res.json({ message: 'Notification was already marked as read' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};