const db = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { logAnomalyAudit } = require('./auditLogger');
const { logDataAudit } = require('./auditLogger');
const { logUserAudit } = require('./auditLogger');
const { logSecurityAudit } = require('./auditLogger');
const axios = require('axios');

const fs = require('fs');
const path = require('path');
const csv = require('csvtojson');
const ExcelJS = require('exceljs');

const loginFailures = {};

exports.searchStudents = async (req, res) => {
  try {
    const q = req.query.q || '';
    const { Op } = require('sequelize');
    const students = await db.User.findAll({
      where: {
        role: 'student',
        [Op.or]: [
          { first_name: { [Op.like]: `%${q}%` } },
          { last_name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 10,
      order: [['first_name', 'ASC']]
    });
    res.json({ students, admin: req.session.admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error searching students' });
  }
};

exports.searchProfessors = async (req, res) => {
  try {
    const q = req.query.q || '';
    const { Op } = require('sequelize');
    const professors = await db.User.findAll({
      where: {
        role: 'professor',
        [Op.or]: [
          { first_name: { [Op.like]: `%${q}%` } },
          { last_name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 10,
      order: [['first_name', 'ASC']]
    });
    res.json({ professors, admin: req.session.admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error searching professors' });
  }
};

exports.searchGuardians = async (req, res) => {
  try {
    const q = req.query.q || '';
    const { Op } = require('sequelize');
    const guardians = await db.User.findAll({
      where: {
        role: 'guardian',
        [Op.or]: [
          { first_name: { [Op.like]: `%${q}%` } },
          { last_name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 10,
      order: [['first_name', 'ASC']]
    });
    res.json({ guardians, admin: req.session.admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error searching guardians' });
  }
};

exports.showLoginForm = (req, res) => {
  res.render('admin/login', { 
    title: 'Admin Login', 
    layout: false,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
  });
};

exports.login = async (req, res) => {
  try {
    const ip = req.ip;
    const { email, password, 'g-recaptcha-response': recaptchaResponse } = req.body;

    // Verify CAPTCHA
    if (!recaptchaResponse) {
      return res.render('admin/login', { 
        error: 'Please complete the CAPTCHA', 
        title: 'Admin Login', 
        layout: false,
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
      });
    }

    try {
      const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
      const response = await axios.post(verifyUrl, null, {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaResponse
        }
      });

      if (!response.data.success) {
        await logSecurityAudit(null, 'ADMIN_CAPTCHA_FAILED', { ip });
        return res.render('admin/login', { 
          error: 'CAPTCHA verification failed', 
          title: 'Admin Login', 
          layout: false,
          recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
        });
      }
    } catch (error) {
      console.error('CAPTCHA verification error:', error);
      return res.render('admin/login', { 
        error: 'Error verifying CAPTCHA', 
        title: 'Admin Login', 
        layout: false,
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
      });
    }

    const admin = await db.User.findOne({ where: { email, role: 'admin' } });
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      loginFailures[ip] = (loginFailures[ip] || 0) + 1;
      await logSecurityAudit(req.user ? req.user.userId : null, 'ADMIN_UNAUTHORIZED_ACCESS', { url: req.originalUrl, method: req.method });
      if (loginFailures[ip] > 5) {
        await logAnomalyAudit(ip, 'ADMIN_MULTIPLE_LOGIN_FAILURES', { ip, count: loginFailures[ip] });
      }
      return res.render('admin/login', { 
        error: 'Invalid credentials or not an admin', 
        title: 'Admin Login', 
        layout: false,
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
      });
    }
    req.session.admin = admin;
    await logUserAudit(admin.id, 'ADMIN_LOGIN_SUCCESS', { email });
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.render('admin/login', { 
      error: 'Login failed', 
      title: 'Admin Login', 
      layout: false,
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
    });
  }
};

exports.logout = (req, res) => {
  if (req.session.admin) {
    logUserAudit(req.session.admin.id, 'ADMIN_LOGOUT', { email: req.session.admin.email });
  }
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};

exports.dashboard = async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  
  try {
    const categoryColors = {
      'User Actions': '#4CAF50',
      'Data Operations': '#2196F3',
      'Security Events': '#FFC107',
      'Anomalies': '#F44336',
      'Admin Actions': '#9C27B0',
      'API Requests': '#FF9800'
    };

    // Default to 7 days for the main dashboard
    const [categoryStats] = await db.sequelize.query(`
      WITH RECURSIVE dates AS (
        SELECT CURDATE() - INTERVAL 6 DAY AS date
        UNION ALL
        SELECT date + INTERVAL 1 DAY
        FROM dates
        WHERE date < CURDATE()
      ),
      categories AS (
        SELECT 'USER' as prefix, 'User Actions' as category
        UNION ALL SELECT 'DATA', 'Data Operations'
        UNION ALL SELECT 'SECURITY', 'Security Events'
        UNION ALL SELECT 'ANOMALY', 'Anomalies'
        UNION ALL SELECT 'ADMIN', 'Admin Actions'
        UNION ALL SELECT 'REQUEST', 'API Requests'
      ),
      daily_counts AS (
        SELECT 
          DATE(timestamp) as log_date,
          CASE 
            WHEN action_type LIKE 'USER_%' THEN 'USER'
            WHEN action_type LIKE 'DATA_%' THEN 'DATA'
            WHEN action_type LIKE 'SECURITY_%' THEN 'SECURITY'
            WHEN action_type LIKE 'ANOMALY_%' THEN 'ANOMALY'
            WHEN action_type LIKE 'ADMIN_%' THEN 'ADMIN'
            WHEN action_type LIKE 'REQUEST' THEN 'REQUEST'
            ELSE 'OTHER'
          END as category_prefix,
          COUNT(*) as count
        FROM Audit_Logs
        WHERE timestamp >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(timestamp),
          CASE 
            WHEN action_type LIKE 'USER_%' THEN 'USER'
            WHEN action_type LIKE 'DATA_%' THEN 'DATA'
            WHEN action_type LIKE 'SECURITY_%' THEN 'SECURITY'
            WHEN action_type LIKE 'ANOMALY_%' THEN 'ANOMALY'
            WHEN action_type LIKE 'ADMIN_%' THEN 'ADMIN'
            WHEN action_type LIKE 'REQUEST' THEN 'REQUEST'
            ELSE 'OTHER'
          END
      )
      SELECT 
        c.category,
        c.prefix,
        d.date,
        COALESCE(dc.count, 0) as count
      FROM dates d
      CROSS JOIN categories c
      LEFT JOIN daily_counts dc ON dc.log_date = d.date AND dc.category_prefix = c.prefix
      ORDER BY c.category, d.date;
    `);

    const timeSeriesData = {};
    categoryStats.forEach(stat => {
      if (!timeSeriesData[stat.category]) {
        timeSeriesData[stat.category] = {
          category: stat.category,
          prefix: stat.prefix,
          dates: [],
          counts: []
        };
      }
      timeSeriesData[stat.category].dates.push(stat.date);
      timeSeriesData[stat.category].counts.push(stat.count);
    });

    res.render('admin/dashboard', { 
      admin: req.session.admin, 
      title: 'Dashboard',
      timeSeriesData: Object.values(timeSeriesData),
      categoryColors
    });
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    res.render('admin/dashboard', { 
      admin: req.session.admin, 
      title: 'Dashboard',
      timeSeriesData: [],
      categoryColors: {}
    });
  }
};

exports.getTimeSeriesData = async (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });
  
  try {
    const { range } = req.query;
    let interval, days, groupBy, dateSelect;
    
    switch(range) {
      case '24h':
        interval = '24 HOUR';
        days = 1;
        groupBy = 'HOUR(timestamp)';
        dateSelect = 'DATE_FORMAT(NOW() - INTERVAL (24-n) HOUR, "%Y-%m-%d %H:00:00") AS date';
        break;
      case 'week':
        interval = '7 DAY';
        days = 7;
        groupBy = 'DATE(timestamp)';
        dateSelect = 'CURDATE() - INTERVAL (7-n) DAY AS date';
        break;
      case 'month':
        interval = '30 DAY';
        days = 30;
        groupBy = 'DATE(timestamp)';
        dateSelect = 'CURDATE() - INTERVAL (30-n) DAY AS date';
        break;
      case 'year':
        interval = '365 DAY';
        days = 365;
        groupBy = 'DATE(timestamp)';
        dateSelect = 'CURDATE() - INTERVAL (365-n) DAY AS date';
        break;
      default:
        interval = '7 DAY';
        days = 7;
        groupBy = 'DATE(timestamp)';
        dateSelect = 'CURDATE() - INTERVAL (7-n) DAY AS date';
    }

    const [data] = await db.sequelize.query(`
      WITH RECURSIVE numbers AS (
        SELECT 1 AS n
        UNION ALL
        SELECT n + 1
        FROM numbers
        WHERE n < ${days}
      ),
      dates AS (
        SELECT ${dateSelect}
        FROM numbers
      ),
      categories AS (
        SELECT 'USER' as prefix, 'User Actions' as category
        UNION ALL SELECT 'DATA', 'Data Operations'
        UNION ALL SELECT 'SECURITY', 'Security Events'
        UNION ALL SELECT 'ANOMALY', 'Anomalies'
        UNION ALL SELECT 'ADMIN', 'Admin Actions'
        UNION ALL SELECT 'REQUEST', 'API Requests'
      ),
      event_counts AS (
        SELECT 
          ${range === '24h' ? 'DATE_FORMAT(timestamp, "%Y-%m-%d %H:00:00")' : 'DATE(timestamp)'} as log_date,
          CASE 
            WHEN action_type LIKE 'USER_%' THEN 'USER'
            WHEN action_type LIKE 'DATA_%' THEN 'DATA'
            WHEN action_type LIKE 'SECURITY_%' THEN 'SECURITY'
            WHEN action_type LIKE 'ANOMALY_%' THEN 'ANOMALY'
            WHEN action_type LIKE 'ADMIN_%' THEN 'ADMIN'
            WHEN action_type LIKE 'REQUEST' THEN 'REQUEST'
            ELSE 'OTHER'
          END as category_prefix,
          COUNT(*) as count
        FROM Audit_Logs
        WHERE timestamp >= NOW() - INTERVAL ${interval}
        GROUP BY 
          ${range === '24h' ? 'DATE_FORMAT(timestamp, "%Y-%m-%d %H:00:00")' : 'DATE(timestamp)'},
          CASE 
            WHEN action_type LIKE 'USER_%' THEN 'USER'
            WHEN action_type LIKE 'DATA_%' THEN 'DATA'
            WHEN action_type LIKE 'SECURITY_%' THEN 'SECURITY'
            WHEN action_type LIKE 'ANOMALY_%' THEN 'ANOMALY'
            WHEN action_type LIKE 'ADMIN_%' THEN 'ADMIN'
            WHEN action_type LIKE 'REQUEST' THEN 'REQUEST'
            ELSE 'OTHER'
          END
      )
      SELECT 
        c.category,
        c.prefix,
        d.date,
        COALESCE(ec.count, 0) as count
      FROM dates d
      CROSS JOIN categories c
      LEFT JOIN event_counts ec ON ec.log_date = d.date AND ec.category_prefix = c.prefix
      ORDER BY c.category, d.date;
    `);

    const timeSeriesData = {};
    data.forEach(stat => {
      if (!timeSeriesData[stat.category]) {
        timeSeriesData[stat.category] = {
          category: stat.category,
          prefix: stat.prefix,
          dates: [],
          counts: []
        };
      }
      timeSeriesData[stat.category].dates.push(stat.date);
      timeSeriesData[stat.category].counts.push(stat.count);
    });

    res.json({ 
      success: true, 
      data: Object.values(timeSeriesData)
    });
  } catch (err) {
    console.error('Error getting time series data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch time series data'
    });
  }
};

// ========= Users =========

exports.usersIndex = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const offset = (page - 1) * limit;
    const departmentFilter = req.query.department;

    // Build where clause for department filtering
    const whereClause = {};
    if (departmentFilter) {
      whereClause.department = departmentFilter;
    }

    const { count, rows: users } = await db.User.findAndCountAll({
      where: whereClause,
      order: [['id', 'ASC']],
      limit: limit,
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get departments for filter dropdown
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['code', 'ASC']]
    });

    res.render('admin/users/index', { 
      users, 
      title: 'Manage Users', 
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: count,
      departments: departments,
      req: req
    });
  } catch (err) {
    res.status(500).send('Error retrieving users');
  }
};

exports.usersCreateForm = async (req, res) => {
  try {
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['code', 'ASC']]
    });
    res.render('admin/users/create', { 
      title: 'Create User', 
      admin: req.session.admin,
      departments: departments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading create user form');
  }
};

exports.usersCreate = async (req, res) => {
  try {
    const { first_name, last_name, email, role, school_id, department, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.User.create({
      first_name,
      last_name,
      email,
      role,
      school_id,
      department,
      password_hash: hashedPassword
    });
    
    await logDataAudit(newUser.id, 'USER_CREATED', {
      first_name,
      last_name,
      email,
      role,
      school_id,
      department
    });

    res.redirect('/admin/users');
  } catch (err) {
    res.status(500).send('Error creating user');
  }
};

exports.usersEditForm = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['code', 'ASC']]
    });
    res.render('admin/users/edit', { 
      user, 
      title: 'Edit User', 
      admin: req.session.admin,
      departments: departments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving user');
  }
};

exports.usersEdit = async (req, res) => {
  try {
    const { first_name, last_name, email, role, school_id, department } = req.body;
    await db.User.update(
      { first_name, last_name, email, role, school_id, department },
      { where: { id: req.params.id } }
    );

    await logDataAudit(req.params.id, 'USER_UPDATED', {
      first_name,
      last_name,
      email,
      role,
      school_id,
      department
    });
    
    res.redirect('/admin/users');
  } catch (err) {
    res.status(500).send('Error updating user');
  }
};

exports.usersShow = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    res.render('admin/users/show', { user, title: 'User Details', admin: req.session.admin });
  } catch (err) {
    res.status(500).send('Error retrieving user');
  }
};

exports.usersDelete = async (req, res) => {
  try {
    const userToDelete = await db.User.findByPk(req.params.id);

    await logDataAudit(req.params.id, 'USER_DELETED', {
      first_name: userToDelete.first_name,
      last_name: userToDelete.last_name,
      email: userToDelete.email,
      role: userToDelete.role
    });

    await db.User.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/users');
  } catch (err) {
    res.status(500).send('Error deleting user');
  }
};

// ========= Classes =========

exports.classesIndex = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const { count, rows: classes } = await db.Class.findAndCountAll({
      order: [['id', 'ASC']],
      limit: limit,
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/classes/index', { 
      classes, 
      title: 'Manage Classes', 
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalClasses: count
    });
  } catch (err) {
    res.status(500).send('Error retrieving classes');
  }
};

exports.classesCreateForm = (req, res) => {
  res.render('admin/classes/create', { title: 'Create Class', admin: req.session.admin });
};

exports.classesCreate = async (req, res) => {
  try {
    const { class_code, class_name, course, year, section, room, start_time, end_time, schedule, professorIds } = req.body;
    const newClass = await db.Class.create({
      class_code,
      class_name,
      course,
      year,
      section,
      room,
      start_time,
      end_time,
      schedule  
    });

    await logDataAudit(req.session.admin.id, 'CLASS_CREATED', {
      class_code,
      class_name,
      course,
      year,
      section,
      room,
      start_time,
      end_time,
      schedule
    });

    if (professorIds) {
      const ids = professorIds.split(',').map(x => parseInt(x.trim()));
      await newClass.setProfessors(ids);
    }
    res.redirect('/admin/classes');
  } catch (err) {
    res.status(500).send('Error creating class');
  }
};

exports.classesEditForm = async (req, res) => {
  try {
    const cls = await db.Class.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'professors', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'students', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
    if (!cls) return res.status(404).send('Class not found');
    res.render('admin/classes/edit', { cls, title: 'Edit Class', admin: req.session.admin });
  } catch (err) {
    res.status(500).send('Error retrieving class');
  }
};

exports.classesEdit = async (req, res) => {
  try {
    const {
      class_code, class_name, course, year, section, room, start_time, end_time, schedule, professorIds, studentIds,
    } = req.body;

    const original = await db.Class.findByPk(req.params.id);

    await db.Class.update(
      {
        class_code, class_name, course, year, section, room, start_time, end_time, schedule,
      },
      { where: { id: req.params.id } }
    );

    const updated = await db.Class.findByPk(req.params.id);

    if (professorIds) {
      const profIdsArray = professorIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      await updated.setProfessors(profIdsArray);
    }

    if (studentIds) {
      const studIdsArray = studentIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      await updated.setStudents(studIdsArray);
    }

    await logDataAudit(req.session.admin.id, 'ADMIN_CLASS_UPDATED', {
      id: req.params.id,
      original: original.toJSON(),
      updated: updated.toJSON(),
    });

    res.redirect('/admin/classes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating class');
  }
};

exports.classesShow = async (req, res) => {
  try {
    const cls = await db.Class.findByPk(req.params.id);
    res.render('admin/classes/show', { cls, title: 'Class Details', admin: req.session.admin });
  } catch (err) {
    res.status(500).send('Error retrieving class');
  }
};

exports.classesDelete = async (req, res) => {
  try {
    const cls = await db.Class.findByPk(req.params.id);

    await logDataAudit(req.session.admin.id, 'CLASS_DELETED', {
      id: cls.id,
      class_code: cls.class_code,
      class_name: cls.class_name
    });
    await db.Class.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/classes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting class');
  }
};

// ========= RFID Cards =========

exports.rfidCardsIndex = async (req, res) => {
  try {
    const rfidCards = await db.RFID_Card.findAll({ order: [['id', 'ASC']] });
    res.render('admin/rfid-cards/index', { rfidCards, title: 'Manage RFID Cards', admin: req.session.admin });
  } catch (err) {
    res.status(500).send('Error retrieving RFID cards');
  }
};

exports.rfidCardsCreateForm = async (req, res) => {
  try {
    const students = await db.User.findAll({
      where: { role: 'student' },
      order: [['first_name', 'ASC']]
    });
    res.render('admin/rfid-cards/create', { title: 'Create RFID Card', students, admin: req.session.admin });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading create RFID card form');
  }
};

exports.rfidCardsCreate = async (req, res) => {
  try {
    const { card_uid, user_id, is_active } = req.body;
    await db.RFID_Card.create({
      card_uid,
      user_id,
      is_active: is_active === 'true',
      issued_at: new Date()
    });

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_CREATED', {
      card_uid,
      user_id,
      is_active: is_active === 'true'
    });

    res.redirect('/admin/rfid-cards');
  } catch (err) {
    res.status(500).send('Error creating RFID card');
  }
};

exports.rfidCardsEditForm = async (req, res) => {
  try {
    const card = await db.RFID_Card.findByPk(req.params.id);
    let studentName = '';
    if (card.user_id) {
      const student = await db.User.findByPk(card.user_id);
      if (student) {
        studentName = `${student.first_name} ${student.last_name} (${student.email})`;
      }
    }
    res.render('admin/rfid-cards/edit', { card, title: 'Edit RFID Card', studentName, admin: req.session.admin });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading edit RFID card form');
  }
};

exports.rfidCardsEdit = async (req, res) => {
  try {
    const { card_uid, user_id, is_active } = req.body;
    await db.RFID_Card.update(
      { card_uid, user_id, is_active: is_active === 'true' },
      { where: { id: req.params.id } }
    );

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_UPDATED', {
      id: req.params.id,
      card_uid,
      user_id,
      is_active: is_active === 'true'
    });

    res.redirect('/admin/rfid-cards');
  } catch (err) {
    res.status(500).send('Error updating RFID card');
  }
};

exports.rfidCardsShow = async (req, res) => {
  try {
    const card = await db.RFID_Card.findByPk(req.params.id);
    res.render('admin/rfid-cards/show', { card, title: 'RFID Card Details', admin: req.session.admin });
  } catch (err) {
    res.status(500).send('Error retrieving RFID card');
  }
};

exports.rfidCardsDelete = async (req, res) => {
  try {
    const card = await db.RFID_Card.findByPk(req.params.id);
    if (!card) {
      console.error('RFID card not found with id:', req.params.id);
      return res.status(404).send('RFID card not found');
    }

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_DELETED', {
      id: card.id,
      card_uid: card.card_uid,
      user_id: card.user_id
    });
    await db.RFID_Card.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/rfid-cards');
  } catch (err) {
    console.error("Error in rfidCardsDelete:", err);
    res.status(500).send('Error deleting RFID card');
  }
};


// ========= Audit Logs =========

exports.auditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const {
      startDate,
      endDate,
      actionType,
      userId,
      searchTerm
    } = req.query;

    const where = {};
    const { Op } = require('sequelize');

    let parsedStartDate = startDate ? new Date(startDate) : null;
    let parsedEndDate = endDate ? new Date(endDate) : null;


    if (parsedStartDate && !isNaN(parsedStartDate.getTime()) && parsedEndDate && !isNaN(parsedEndDate.getTime())) {

      parsedStartDate.setHours(0, 0, 0, 0);
      parsedEndDate.setHours(23, 59, 59, 999);
      
      where.timestamp = {
        [Op.between]: [parsedStartDate, parsedEndDate]
      };
    } else if (parsedStartDate && !isNaN(parsedStartDate.getTime())) {
      parsedStartDate.setHours(0, 0, 0, 0);
      where.timestamp = {
        [Op.gte]: parsedStartDate
      };
    } else if (parsedEndDate && !isNaN(parsedEndDate.getTime())) {
      parsedEndDate.setHours(23, 59, 59, 999);
      where.timestamp = {
        [Op.lte]: parsedEndDate
      };
    }

    if (actionType && actionType !== 'undefined') {
      where.action_type = {
        [Op.like]: `${actionType}%`
      };
    }

    if (userId && userId !== 'undefined') {
      where.user_id = userId;
    }

    if (searchTerm && searchTerm !== 'undefined') {
      where[Op.or] = [
        { action_type: { [Op.like]: `%${searchTerm}%` } },
        { details: { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    const { count, rows: logs } = await db.Audit_Log.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: limit,
      offset: offset,
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name', 'email'],
        required: false
      }]
    });

    const totalPages = Math.ceil(count / limit);

    const actionStats = await db.Audit_Log.findAll({
      where,
      attributes: [
        'action_type',
        [db.sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['action_type'],
      order: [[db.sequelize.fn('COUNT', '*'), 'DESC']]
    });
 
    const userStats = await db.Audit_Log.findAll({
      where,
      attributes: [
        'user_id',
        [db.sequelize.fn('COUNT', '*'), 'count']
      ],
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name', 'email'],
        required: false
      }],
      group: ['user_id', 'User.id', 'User.first_name', 'User.last_name', 'User.email'],
      order: [[db.sequelize.fn('COUNT', '*'), 'DESC']],
      limit: 10
    });

    const hourlyActivity = await db.sequelize.query(`
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as count
      FROM Audit_Logs
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
      ORDER BY hour ASC
    `, { type: db.sequelize.QueryTypes.SELECT });

    res.render('admin/audit-logs', { 
      logs,
      actionStats,
      userStats,
      hourlyActivity,
      title: 'Audit Logs',
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalLogs: count,
      filters: {
        startDate: startDate || '',
        endDate: endDate || '',
        actionType: actionType || '',
        userId: userId || '',
        searchTerm: searchTerm || '',
        limit
      }
    });
  } catch (err) {
    console.error('Error retrieving audit logs:', err);
    res.status(500).send('Error retrieving audit logs');
  }
};

// ========= Guardian Linking =========

exports.guardianLinksIndex = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const { count, rows: links } = await db.Guardian_Student.findAndCountAll({
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ],
      order: [['guardian_id', 'ASC']],
      limit: limit,
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/guardian-links/index', { 
      title: 'Manage Guardian Links', 
      links, 
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalLinks: count
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving guardian links');
  }
};

exports.guardianLinkNewForm = (req, res) => {
  res.render('admin/guardian-links/form', { 
    title: 'Create Guardian Link', 
    action: '/admin/guardian-link', 
    submitLabel: 'Create Link', 
    method: 'POST',
    guardian: null,
    student: null,
    admin: req.session.admin
  });
};

exports.guardianLinkCreate = async (req, res) => {
  try {
    const { guardianId, studentId } = req.body;
    const guardian = await db.User.findByPk(guardianId);
    const student = await db.User.findByPk(studentId);
    if (!guardian || guardian.role !== 'guardian') {
      return res.status(400).send('Invalid guardian');
    }
    if (!student || student.role !== 'student') {
      return res.status(400).send('Invalid student');
    }

    const link = await db.Guardian_Student.create({
      guardian_id: guardianId,
      student_id: studentId,
      created_at: new Date()
    });

    await logDataAudit(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINK_CREATED',
      {
        linkId: link.id,
        guardian: {
          id: guardian.id,
          first_name: guardian.first_name,
          last_name: guardian.last_name,
          email: guardian.email
        },
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email
        }
      }
    );
    res.redirect('/admin/guardian-link');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error linking guardian to student');
  }
};

exports.guardianLinkEditForm = async (req, res) => {
  try {
    const link = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
    if (!link) {
      return res.status(404).send('Guardian link not found');
    }
    res.render('admin/guardian-links/form', {
      title: 'Edit Guardian Link',
      action: '/admin/guardian-link/' + link.id,
      submitLabel: 'Update Link',
      method: 'PUT',
      guardian: link.guardian,
      student: link.student,
      admin: req.session.admin
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading guardian link for editing');
  }
};

exports.guardianLinkUpdate = async (req, res) => {
  try {
    const originalLink = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
    if (!originalLink) {
      return res.status(404).send('Guardian link not found');
    }
    const { guardianId, studentId } = req.body;

    await db.Guardian_Student.update(
      { guardian_id: guardianId, student_id: studentId },
      { where: { id: req.params.id } }
    );

    const updatedLink = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });

    await logDataEvent(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINK_UPDATED',
      {
        linkId: req.params.id,
        original: originalLink.toJSON(),
        updated: updatedLink.toJSON()
      }
    );
    res.redirect('/admin/guardian-link');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating guardian link');
  }
};

exports.guardianLinkDelete = async (req, res) => {
  try {
    const link = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });
    if (!link) {
      return res.status(404).send('Guardian link not found');
    }

    await logDataAudit(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINK_DELETED',
      { linkId: link.id, details: link.toJSON() }
    );

    await db.Guardian_Student.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/guardian-link');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting guardian link');
  }
};


// Import

exports.importClasses = async (req, res) => {
  try {
    if (!req.file) {
      console.error('No file uploaded.');
      return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log('Uploaded file path:', filePath, 'Extension:', ext);
    let classesData = [];

    if (ext === '.csv') {
      classesData = await csv({
        headers: ['class_code','class_name','course','year','section','room','start_time','end_time','schedule']
      }).fromFile(filePath);
    } else if (ext === '.xlsx') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowValues = row.values;
        classesData.push({
          class_code: rowValues[1],
          class_name: rowValues[2],
          course: rowValues[3],
          year: rowValues[4],
          section: rowValues[5],
          room: rowValues[6],
          start_time: rowValues[7],
          end_time: rowValues[8],
          schedule: rowValues[9]
        });
      });
      console.log('Parsed Excel data:', classesData);
    } else {
      console.error('Unsupported file type:', ext);
      return res.status(400).send('Unsupported file type.');
    }

    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file:', err);
      else console.log('Temporary file deleted:', filePath);
    });

    if (classesData.length === 0) {
      console.error('No class data parsed from file.');
      return res.status(400).send('No class data found in file.');
    }

    await db.Class.bulkCreate(classesData);
    console.log('Classes successfully imported:', classesData.length);
    res.render('admin/classes/index', { 
      title: 'Classes Imported', 
      message: 'Classes successfully imported', 
      admin: req.session.admin 
    });
  } catch (err) {
    console.error('Error importing classes:', err);
    res.render('admin/classes/index', { 
      title: 'Import Error', 
      error: 'Error importing classes', 
      admin: req.session.admin 
    });
  }
};

exports.importUsers = async (req, res) => {
  try {
    if (!req.file) {
      console.error('No file uploaded.');
      return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log('Uploaded file path:', filePath, 'Extension:', ext);
    let usersData = [];

    if (ext === '.csv') {
      usersData = await csv({
        headers: ['first_name', 'last_name', 'email', 'role', 'school_id']
      }).fromFile(filePath);
      console.log('Parsed CSV data:', usersData);
    } else if (ext === '.xlsx') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; 
        const rowValues = row.values; 
        usersData.push({
          first_name: rowValues[1],
          last_name: rowValues[2],
          email: rowValues[3],
          role: rowValues[4],
          school_id: rowValues[5] || null
        });
      });
      console.log('Parsed Excel data:', usersData);
    } else {
      console.error('Unsupported file type:', ext);
      return res.status(400).send('Unsupported file type.');
    }

    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file:', err);
      else console.log('Temporary file deleted:', filePath);
    });

    if (usersData.length === 0) {
      console.error('No user data parsed from file.');
      return res.status(400).send('No user data found in file.');
    }

    for (let user of usersData) {
      const randomPassword = crypto.randomBytes(8).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user.password_hash = hashedPassword;
    }

    await db.User.bulkCreate(usersData);
    console.log('Users successfully imported:', usersData.length);
    
    const users = await db.User.findAll({ order: [['id', 'ASC']] });
    
    res.render('admin/users/index', { 
      title: 'Users Imported', 
      message: 'Users successfully imported', 
      admin: req.session.admin,
      users: users
    });
  } catch (err) {
    console.error('Error importing users:', err);
    const users = await db.User.findAll({ order: [['id', 'ASC']] });
    res.render('admin/users/index', { 
      title: 'Import Error', 
      error: 'Error importing users', 
      admin: req.session.admin,
      users: users
    });
  }
};

exports.globalSearch = async (req, res) => {
    try {
        const query = req.query.q || '';
        const { Op } = require('sequelize');
        const results = [];

        // Search Users
        const users = await db.User.findAll({
            where: {
                [Op.or]: [
                    { first_name: { [Op.like]: `%${query}%` } },
                    { last_name: { [Op.like]: `%${query}%` } },
                    { email: { [Op.like]: `%${query}%` } }
                ]
            },
            limit: 5
        });

        const classes = await db.Class.findAll({
            where: {
                [Op.or]: [
                    { class_code: { [Op.like]: `%${query}%` } },
                    { class_name: { [Op.like]: `%${query}%` } }
                ]
            },
            limit: 5
        });

        const rfidCards = await db.RFID_Card.findAll({
            where: {
                card_uid: { [Op.like]: `%${query}%` }
            },
            limit: 5
        });

        users.forEach(user => {
            results.push({
                type: 'User',
                title: `${user.first_name} ${user.last_name} (${user.email})`,
                url: `/admin/users/${user.id}`
            });
        });

        classes.forEach(cls => {
            results.push({
                type: 'Class',
                title: `${cls.class_code} - ${cls.class_name}`,
                url: `/admin/classes/${cls.id}`
            });
        });

        rfidCards.forEach(card => {
            results.push({
                type: 'RFID Card',
                title: `Card UID: ${card.card_uid}`,
                url: `/admin/rfid-cards/${card.id}`
            });
        });

        res.json({ results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error performing search' });
    }
};

// ========= Departments =========

exports.departmentsIndex = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const { count, rows: departments } = await db.Department.findAndCountAll({
      order: [['code', 'ASC']],
      limit: limit,
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/departments/index', {
      departments,
      title: 'Manage Departments',
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalDepartments: count
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving departments');
  }
};

exports.departmentsCreateForm = (req, res) => {
  res.render('admin/departments/create', { 
    title: 'Create Department', 
    admin: req.session.admin 
  });
};

exports.departmentsCreate = async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    const newDepartment = await db.Department.create({
      name,
      code: code.toUpperCase(),
      description,
      is_active: is_active === 'true' || is_active === true
    });

    await logDataAudit(req.session.admin.id, 'DEPARTMENT_CREATED', {
      name,
      code: code.toUpperCase(),
      description,
      is_active: is_active === 'true' || is_active === true
    });

    res.redirect('/admin/departments');
  } catch (err) {
    console.error(err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      res.status(400).send('Department code already exists');
    } else if (err.name === 'SequelizeValidationError') {
      res.status(400).send('Validation error: ' + err.errors.map(e => e.message).join(', '));
    } else {
      res.status(500).send('Error creating department');
    }
  }
};

exports.departmentsEditForm = async (req, res) => {
  try {
    const department = await db.Department.findByPk(req.params.id);
    if (!department) {
      return res.status(404).send('Department not found');
    }
    res.render('admin/departments/edit', { 
      department, 
      title: 'Edit Department', 
      admin: req.session.admin 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving department');
  }
};

exports.departmentsEdit = async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    const [updatedRows] = await db.Department.update({
      name,
      code: code.toUpperCase(),
      description,
      is_active: is_active === 'true' || is_active === true
    }, {
      where: { id: req.params.id }
    });

    if (updatedRows === 0) {
      return res.status(404).send('Department not found');
    }

    await logDataAudit(req.session.admin.id, 'DEPARTMENT_UPDATED', {
      id: req.params.id,
      name,
      code: code.toUpperCase(),
      description,
      is_active: is_active === 'true' || is_active === true
    });

    res.redirect('/admin/departments');
  } catch (err) {
    console.error(err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      res.status(400).send('Department code already exists');
    } else if (err.name === 'SequelizeValidationError') {
      res.status(400).send('Validation error: ' + err.errors.map(e => e.message).join(', '));
    } else {
      res.status(500).send('Error updating department');
    }
  }
};

exports.departmentsShow = async (req, res) => {
  try {
    const department = await db.Department.findByPk(req.params.id);
    if (!department) {
      return res.status(404).send('Department not found');
    }
    res.render('admin/departments/show', { 
      department, 
      title: 'Department Details', 
      admin: req.session.admin 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving department');
  }
};

exports.departmentsDelete = async (req, res) => {
  try {
    const department = await db.Department.findByPk(req.params.id);
    if (!department) {
      return res.status(404).send('Department not found');
    }

    // Check if department is being used by any users
    const usersCount = await db.User.count({
      where: { department: department.code }
    });

    if (usersCount > 0) {
      return res.status(400).send(`Cannot delete department: ${usersCount} users are assigned to this department`);
    }

    await logDataAudit(req.session.admin.id, 'DEPARTMENT_DELETED', {
      id: req.params.id,
      name: department.name,
      code: department.code
    });

    await db.Department.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/departments');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting department');
  }
};