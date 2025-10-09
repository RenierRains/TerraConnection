const db = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const net = require('net');
const { logAnomalyAudit } = require('./auditLogger');
const { logDataAudit } = require('./auditLogger');
const { logUserAudit } = require('./auditLogger');
const { logSecurityAudit } = require('./auditLogger');
const axios = require('axios');
const { deleteOldProfilePicture, getProfilePictureUrl } = require('../middleware/profileUpload');
const {
  refreshAllowedIpCache,
  getAllowedIpCacheMetadata,
  getFallbackIPs
} = require('../middleware/ipRestriction');

const fs = require('fs');
const path = require('path');
const csv = require('csvtojson');
const ExcelJS = require('exceljs');

const loginFailures = {};

function queueToast(req, { type = 'info', title = 'Notice', message = '' }) {
  if (!req.session) {
    return;
  }

  if (!Array.isArray(req.session.toasts)) {
    req.session.toasts = [];
  }

  req.session.toasts.push({ type, title, message });
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

function getClientIp(req) {
  if (!req) {
    return null;
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  let ip = null;

  if (forwarded) {
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    if (forwardedValue) {
      ip = forwardedValue.trim();
    }
  }

  if (!ip) {
    ip = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || null;
  }

  if (ip && ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  return ip;
}

exports.globalSearch = async (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) {
      return res.json([]);
    }

    const { Op } = require('sequelize');
    const results = [];

    // Search users
    const users = await db.User.findAll({
      where: {
        [Op.or]: [
          { first_name: { [Op.like]: `%${q}%` } },
          { last_name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 5,
      order: [['first_name', 'ASC']]
    });

    users.forEach(user => {
      results.push({
        id: user.id,
        title: `${user.first_name} ${user.last_name}`,
        type: 'user',
        subtitle: user.email,
        role: user.role
      });
    });

    // Search departments
    const departments = await db.Department.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { code: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 3,
      order: [['name', 'ASC']]
    });

    departments.forEach(dept => {
      results.push({
        id: dept.id,
        title: dept.name,
        type: 'department',
        subtitle: dept.code
      });
    });

    // Search classes
    const classes = await db.Class.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { code: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 3,
      order: [['name', 'ASC']]
    });

    classes.forEach(cls => {
      results.push({
        id: cls.id,
        title: cls.name,
        type: 'class',
        subtitle: cls.code
      });
    });

    // Search RFID cards
    const rfidCards = await db.RFIDCard.findAll({
      where: {
        card_number: { [Op.like]: `%${q}%` }
      },
      include: [{
        model: db.User,
        as: 'user',
        attributes: ['first_name', 'last_name']
      }],
      limit: 3,
      order: [['card_number', 'ASC']]
    });

    rfidCards.forEach(card => {
      results.push({
        id: card.id,
        title: `Card ${card.card_number}`,
        type: 'rfid-card',
        subtitle: card.user ? `${card.user.first_name} ${card.user.last_name}` : 'Unassigned'
      });
    });

    res.json(results);
  } catch (err) {
    console.error('Global search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

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
    res.json({ success: true, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error searching students' });
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
    res.json({ success: true, professors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error searching professors' });
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
    res.json({ success: true, guardians });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error searching guardians' });
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
    const { department, dateRange } = req.query;
    const selectedDepartment = department || '';
    const selectedDateRange = dateRange || 'week';
    
    // Get departments for filtering
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    // Build date range filter
    let dateFilter = '';
    const now = new Date();
    switch (selectedDateRange) {
      case 'today':
        dateFilter = `AND DATE(al.timestamp) = CURDATE()`;
        break;
      case 'week':
        dateFilter = `AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        break;
      case 'month':
        dateFilter = `AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        break;
      default:
        dateFilter = `AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
    }

    // Build department filter
    let departmentFilter = '';
    if (selectedDepartment) {
      departmentFilter = `AND u.department = '${selectedDepartment}'`;
    }

    // Get current period statistics
    const [statsResult] = await db.sequelize.query(`
      SELECT 
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as totalEntries,
        SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as totalExits,
        SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as totalAnomalies,
        COUNT(DISTINCT u.id) as activeUsers
      FROM Audit_Logs al
      LEFT JOIN Users u ON al.user_id = u.id
      WHERE 1=1 ${dateFilter} ${departmentFilter}
    `);

    // Get previous period statistics for trend calculation
    let previousDateFilter = '';
    switch (selectedDateRange) {
      case 'today':
        previousDateFilter = `AND DATE(al.timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
        break;
      case 'week':
        previousDateFilter = `AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND al.timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        break;
      case 'month':
        previousDateFilter = `AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND al.timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        break;
      default:
        previousDateFilter = `AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND al.timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)`;
    }

    const [previousStatsResult] = await db.sequelize.query(`
      SELECT 
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as totalEntries,
        SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as totalExits,
        SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as totalAnomalies,
        COUNT(DISTINCT u.id) as activeUsers
      FROM Audit_Logs al
      LEFT JOIN Users u ON al.user_id = u.id
      WHERE 1=1 ${previousDateFilter} ${departmentFilter}
    `);

    const currentStats = statsResult[0] || {
      totalEntries: 0,
      totalExits: 0,
      totalAnomalies: 0,
      activeUsers: 0
    };

    const previousStats = previousStatsResult[0] || {
      totalEntries: 0,
      totalExits: 0,
      totalAnomalies: 0,
      activeUsers: 0
    };

    // Calculate trends
    const calculateTrend = (current, previous) => {
      const currentNum = parseInt(current) || 0;
      const previousNum = parseInt(previous) || 0;
      
      if (previousNum === 0) {
        if (currentNum === 0) return 0;
        return currentNum > 0 ? 100 : 0; // New data, show as 100% increase
      }
      return parseFloat(((currentNum - previousNum) / previousNum * 100).toFixed(1));
    };

    const stats = {
      totalEntries: currentStats.totalEntries,
      totalExits: currentStats.totalExits,
      totalAnomalies: currentStats.totalAnomalies,
      activeUsers: currentStats.activeUsers,
      trends: {
        entriesTrend: calculateTrend(currentStats.totalEntries, previousStats.totalEntries),
        exitsTrend: calculateTrend(currentStats.totalExits, previousStats.totalExits),
        anomaliesTrend: calculateTrend(currentStats.totalAnomalies, previousStats.totalAnomalies),
        usersTrend: calculateTrend(currentStats.activeUsers, previousStats.activeUsers)
      }
    };

    // Get recent activities
    const recentActivities = await db.Audit_Log.findAll({
      limit: 10,
      order: [['timestamp', 'DESC']],
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name'],
        required: false,
        where: selectedDepartment ? { department: selectedDepartment } : {}
      }]
    });

    res.render('admin/dashboard', { 
      admin: req.session.admin, 
      title: 'Dashboard',
      departments,
      selectedDepartment,
      selectedDateRange,
      stats,
      recentActivities
    });
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    res.render('admin/dashboard', { 
      admin: req.session.admin, 
      title: 'Dashboard',
      departments: [],
      selectedDepartment: '',
      selectedDateRange: 'week',
      stats: { totalEntries: 0, totalExits: 0, totalAnomalies: 0, activeUsers: 0 },
      recentActivities: []
    });
  }
};

exports.getDepartmentData = async (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });
  
  try {
    // Get department activity breakdown
    const [departmentStats] = await db.sequelize.query(`
      SELECT 
        u.department,
        d.name as department_name,
        COUNT(DISTINCT u.id) as user_count,
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as exits,
        SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as anomalies
      FROM Users u
      LEFT JOIN Departments d ON u.department = d.code
      LEFT JOIN Audit_Logs al ON al.user_id = u.id AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      WHERE u.department IS NOT NULL
      GROUP BY u.department, d.name
      ORDER BY user_count DESC
    `);

    const labels = departmentStats.map(dept => dept.department_name || dept.department);
    const userCounts = departmentStats.map(dept => parseInt(dept.user_count) || 0);
    const entryCounts = departmentStats.map(dept => parseInt(dept.entries) || 0);
    const exitCounts = departmentStats.map(dept => parseInt(dept.exits) || 0);
    const anomalyCounts = departmentStats.map(dept => parseInt(dept.anomalies) || 0);

    res.json({
      success: true,
      data: {
        labels,
        datasets: {
          users: userCounts,
          entries: entryCounts,
          exits: exitCounts,
          anomalies: anomalyCounts
        }
      }
    });
  } catch (err) {
    console.error('Error getting department data:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch department data'
    });
  }
};

exports.getTimeSeriesData = async (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });
  
  try {
    const { range = 'week' } = req.query;
    let dateFilter = '';
    let groupByFormat = '';
    
    switch(range) {
      case '24h':
        dateFilter = 'timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
        groupByFormat = 'DATE_FORMAT(timestamp, "%Y-%m-%d %H:00")';
        break;
      case 'week':
        dateFilter = 'timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        groupByFormat = 'DATE(timestamp)';
        break;
      case 'month':
        dateFilter = 'timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        groupByFormat = 'DATE(timestamp)';
        break;
      case 'year':
        dateFilter = 'timestamp >= DATE_SUB(NOW(), INTERVAL 365 DAY)';
        groupByFormat = 'DATE(timestamp)';
        break;
      default:
        dateFilter = 'timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        groupByFormat = 'DATE(timestamp)';
    }

    // Get time series data for entries, exits, and anomalies
    const [timeSeriesData] = await db.sequelize.query(`
      SELECT 
        ${groupByFormat} as date,
        SUM(CASE WHEN action_type LIKE '%ENTRY_%' OR action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN action_type LIKE '%EXIT_%' OR action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as exits,
        SUM(CASE WHEN action_type LIKE 'ANOMALY_%' OR action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as anomalies
      FROM Audit_Logs
      WHERE ${dateFilter}
      GROUP BY ${groupByFormat}
      ORDER BY date ASC
    `);

    // Format data for Chart.js
    const labels = timeSeriesData.map(item => item.date);
    const entries = timeSeriesData.map(item => parseInt(item.entries) || 0);
    const exits = timeSeriesData.map(item => parseInt(item.exits) || 0);
    const anomalies = timeSeriesData.map(item => parseInt(item.anomalies) || 0);

    res.json({ 
      success: true, 
      data: {
        labels,
        entries,
        exits,
        anomalies
      }
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
    const limit = parseInt(req.query.limit) || 10; // Add page size option
    const offset = (page - 1) * limit;
    
    // Advanced filtering options
    const departmentFilter = req.query.department;
    const roleFilter = req.query.role;
    const searchTerm = req.query.search;
    const statusFilter = req.query.status; // active/inactive based on last activity
    const sortBy = req.query.sortBy || 'id';
    const sortOrder = req.query.sortOrder || 'ASC';

    // Build where clause for advanced filtering
    const whereClause = {};
    const { Op } = require('sequelize');

    if (departmentFilter) {
      whereClause.department = departmentFilter;
    }

    if (roleFilter) {
      whereClause.role = roleFilter;
    }

    if (searchTerm) {
      whereClause[Op.or] = [
        { first_name: { [Op.like]: `%${searchTerm}%` } },
        { last_name: { [Op.like]: `%${searchTerm}%` } },
        { email: { [Op.like]: `%${searchTerm}%` } },
        { school_id: { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    // Get users with advanced filtering
    const { count, rows: users } = await db.User.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: limit,
      offset: offset,
      include: [{
        model: db.Audit_Log,
        attributes: ['timestamp'],
        order: [['timestamp', 'DESC']],
        limit: 1,
        required: false
      }]
    });

    // Process users to add activity status
    const processedUsers = users.map(user => {
      const lastActivity = user.Audit_Logs && user.Audit_Logs.length > 0 
        ? user.Audit_Logs[0].timestamp 
        : user.createdAt;
      
      const daysSinceActivity = Math.floor((new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24));
      const isActive = daysSinceActivity <= 30; // Consider active if activity within 30 days
      
      return {
        ...user.toJSON(),
        lastActivity,
        isActive,
        daysSinceActivity
      };
    });

    // Apply status filter after processing
    let filteredUsers = processedUsers;
    if (statusFilter) {
      filteredUsers = processedUsers.filter(user => {
        if (statusFilter === 'active') return user.isActive;
        if (statusFilter === 'inactive') return !user.isActive;
        return true;
      });
    }

    const totalPages = Math.ceil(count / limit);

    // Get departments for filter dropdown
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['code', 'ASC']]
    });

    // Get user statistics
    const userStats = await db.User.findAll({
      attributes: [
        'role',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    const roleStats = {};
    userStats.forEach(stat => {
      roleStats[stat.role] = parseInt(stat.dataValues.count);
    });

    // Get department statistics
    const deptStats = await db.User.findAll({
      attributes: [
        'department',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: { department: { [Op.ne]: null } },
      group: ['department']
    });

    const departmentStats = {};
    deptStats.forEach(stat => {
      departmentStats[stat.department] = parseInt(stat.dataValues.count);
    });

    res.render('admin/users/index', { 
      users: filteredUsers, 
      title: 'Manage Users', 
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: count,
      departments: departments,
      req: req,
      filters: {
        department: departmentFilter || '',
        role: roleFilter || '',
        search: searchTerm || '',
        status: statusFilter || '',
        sortBy,
        sortOrder
      },
      pagination: {
        limit,
        pageSizeOptions: [5, 10, 25, 50, 100]
      },
      statistics: {
        roles: roleStats,
        departments: departmentStats,
        total: count
      }
    });
  } catch (err) {
    console.error('Error retrieving users:', err);
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
    
    // Handle profile picture upload
    let profile_picture = null;
    if (req.file) {
      profile_picture = getProfilePictureUrl(req.file.filename);
    }
    
    // Handle department field - convert empty string to null to avoid foreign key constraint error
    const departmentValue = department && department.trim() !== '' ? department.trim() : null;
    
    const newUser = await db.User.create({
      first_name,
      last_name,
      email,
      role,
      school_id,
      department: departmentValue,
      password_hash: hashedPassword,
      profile_picture
    });
    
    await logDataAudit(newUser.id, 'USER_CREATED', {
      first_name,
      last_name,
      email,
      role,
      school_id,
      department: departmentValue,
      profile_picture: profile_picture ? 'uploaded' : 'none'
    });

    res.redirect('/admin/users');
  } catch (err) {
    // Clean up uploaded file if user creation fails
    if (req.file) {
      deleteOldProfilePicture(req.file.filename);
    }
    console.error('Error creating user:', err);
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

exports.usersEditContent = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['code', 'ASC']]
    });
    res.render('admin/users/edit-content', { 
      user, 
      departments: departments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving user');
  }
};

exports.usersEdit = async (req, res) => {
  try {
    const { first_name, last_name, email, role, school_id, department, remove_profile_picture } = req.body;
    
    // Get current user to access old profile picture
    const currentUser = await db.User.findByPk(req.params.id);
    if (!currentUser) {
      return res.status(404).send('User not found');
    }
    
    // Handle profile picture upload
    const updateData = { first_name, last_name, email, role, school_id };
    
    // Handle department field - convert empty string to null to avoid foreign key constraint error
    if (department && department.trim() !== '') {
      updateData.department = department.trim();
    } else {
      updateData.department = null;
    }
    
    // Handle profile picture removal
    if (remove_profile_picture === '1') {
      // Delete old profile picture if it exists
      if (currentUser.profile_picture) {
        deleteOldProfilePicture(currentUser.profile_picture);
      }
      updateData.profile_picture = null;
    } else if (req.file) {
      // Delete old profile picture if it exists
      if (currentUser.profile_picture) {
        deleteOldProfilePicture(currentUser.profile_picture);
      }
      updateData.profile_picture = getProfilePictureUrl(req.file.filename);
    }
    
    await db.User.update(updateData, { where: { id: req.params.id } });

    await logDataAudit(req.params.id, 'USER_UPDATED', {
      first_name,
      last_name,
      email,
      role,
      school_id,
      department: updateData.department,
      profile_picture_changed: req.file ? 'uploaded' : remove_profile_picture === '1' ? 'removed' : 'no_change'
    });
    
    res.redirect('/admin/users');
  } catch (err) {
    // Clean up uploaded file if update fails
    if (req.file) {
      deleteOldProfilePicture(req.file.filename);
    }
    console.error('Error updating user:', err);
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
    if (!userToDelete) {
      return res.status(404).send('User not found');
    }

    // Delete profile picture if it exists
    if (userToDelete.profile_picture) {
      deleteOldProfilePicture(userToDelete.profile_picture);
    }

    await logDataAudit(req.params.id, 'USER_DELETED', {
      first_name: userToDelete.first_name,
      last_name: userToDelete.last_name,
      email: userToDelete.email,
      role: userToDelete.role,
      had_profile_picture: userToDelete.profile_picture ? 'yes' : 'no'
    });

    await db.User.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).send('Error deleting user');
  }
};

// ========= Bulk Actions =========

exports.usersBulkDelete = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users selected for deletion' });
    }

    // Get users to be deleted for audit logging
    const usersToDelete = await db.User.findAll({
      where: { id: userIds },
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture']
    });

    // Delete profile pictures
    for (const user of usersToDelete) {
      if (user.profile_picture) {
        deleteOldProfilePicture(user.profile_picture);
      }
    }

    // Log bulk deletion
    await logDataAudit(req.session.admin.id, 'BULK_USER_DELETION', {
      deletedCount: usersToDelete.length,
      deletedUsers: usersToDelete.map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        role: u.role
      }))
    });

    // Delete users
    await db.User.destroy({ where: { id: userIds } });

    res.json({ 
      success: true, 
      message: `Successfully deleted ${usersToDelete.length} users`,
      deletedCount: usersToDelete.length
    });
  } catch (err) {
    console.error('Error in bulk delete:', err);
    res.status(500).json({ error: 'Failed to delete users' });
  }
};

exports.usersBulkExport = async (req, res) => {
  try {
    const { userIds, format = 'csv' } = req.body;
    
    let whereClause = {};
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      whereClause.id = { [require('sequelize').Op.in]: userIds };
    }

    const users = await db.User.findAll({
      where: whereClause,
      include: [{
        model: db.Department,
        as: 'departmentInfo',
        attributes: ['name'],
        required: false
      }],
      order: [['id', 'ASC']]
    });

    const userData = users.map(user => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      school_id: user.school_id || '',
      department: user.departmentInfo ? user.departmentInfo.name : (user.department || ''),
      department_code: user.department || '',
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      has_profile_picture: user.profile_picture ? 'Yes' : 'No'
    }));

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      const fields = ['id', 'first_name', 'last_name', 'email', 'role', 'school_id', 'department', 'department_code', 'created_at', 'updated_at', 'has_profile_picture'];
      const parser = new Parser({ fields });
      const csv = parser.parse(userData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.json`);
    return res.json(userData);

  } catch (err) {
    console.error('Error in bulk export:', err);
    res.status(500).json({ error: 'Failed to export users' });
  }
};

exports.usersBulkDepartmentChange = async (req, res) => {
  try {
    const { userIds, newDepartment } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users selected' });
    }

    if (!newDepartment) {
      return res.status(400).json({ error: 'New department is required' });
    }

    // Verify department exists
    const department = await db.Department.findOne({ where: { code: newDepartment } });
    if (!department) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    // Get users before update for audit logging
    const usersBeforeUpdate = await db.User.findAll({
      where: { id: userIds },
      attributes: ['id', 'first_name', 'last_name', 'email', 'department']
    });

    // Update users
    await db.User.update(
      { department: newDepartment },
      { where: { id: userIds } }
    );

    // Log bulk department change
    await logDataAudit(req.session.admin.id, 'BULK_USER_DEPARTMENT_CHANGE', {
      updatedCount: usersBeforeUpdate.length,
      newDepartment: newDepartment,
      updatedUsers: usersBeforeUpdate.map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        oldDepartment: u.department,
        newDepartment: newDepartment
      }))
    });

    res.json({ 
      success: true, 
      message: `Successfully updated department for ${usersBeforeUpdate.length} users`,
      updatedCount: usersBeforeUpdate.length,
      newDepartment: newDepartment
    });
  } catch (err) {
    console.error('Error in bulk department change:', err);
    res.status(500).json({ error: 'Failed to update user departments' });
  }
};

// ========= Quick Edit =========

exports.usersQuickEdit = async (req, res) => {
  try {
    const { userId, field, value } = req.body;
    
    if (!userId || !field || value === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate field
    const allowedFields = ['first_name', 'last_name', 'email', 'role', 'school_id', 'department'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }

    // Get user before update for audit logging
    const userBefore = await db.User.findByPk(userId);
    if (!userBefore) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate department if changing department
    if (field === 'department' && value) {
      const department = await db.Department.findOne({ where: { code: value } });
      if (!department) {
        return res.status(400).json({ error: 'Invalid department' });
      }
    }

    // Update user
    await db.User.update(
      { [field]: value },
      { where: { id: userId } }
    );

    // Log quick edit
    await logDataAudit(req.session.admin.id, 'USER_QUICK_EDIT', {
      userId: userId,
      field: field,
      oldValue: userBefore[field],
      newValue: value,
      userEmail: userBefore.email
    });

    res.json({ 
      success: true, 
      message: 'User updated successfully',
      user: {
        id: userId,
        [field]: value
      }
    });
  } catch (err) {
    console.error('Error in quick edit:', err);
    res.status(500).json({ error: 'Failed to update user' });
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

exports.classesCreateForm = async (req, res) => {
  try {
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
    res.render('admin/classes/create', { 
      title: 'Create Class', 
      admin: req.session.admin,
      departments 
    });
  } catch (err) {
    console.error(err);
    res.render('admin/classes/create', { 
      title: 'Create Class', 
      admin: req.session.admin,
      departments: [] 
    });
  }
};

exports.classesCreate = async (req, res) => {
  try {
    const { class_code, class_name, course, year, section, room, start_time, end_time, schedule, department, professorIds } = req.body;
    const newClass = await db.Class.create({
      class_code,
      class_name,
      course,
      year,
      section,
      room,
      start_time,
      end_time,
      schedule,
      department  
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
      schedule,
      department
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
    
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
    
    res.render('admin/classes/edit', { cls, departments, title: 'Edit Class', admin: req.session.admin });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving class');
  }
};

exports.classesEdit = async (req, res) => {
  try {
    const {
      class_code, class_name, course, year, section, room, start_time, end_time, schedule, department, professorIds, studentIds,
    } = req.body;

    const original = await db.Class.findByPk(req.params.id);

    await db.Class.update(
      {
        class_code, class_name, course, year, section, room, start_time, end_time, schedule, department,
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

// Helper function to get RFID card statistics
async function getRfidCardStatistics() {
  try {
    const [
      totalCards,
      activeCards,
      inactiveCards,
      assignedCards,
      unassignedCards,
      departmentCounts,
      roleCounts,
      recentActivity
    ] = await Promise.all([
      // Total cards
      db.RFID_Card.count(),
      
      // Active cards
      db.RFID_Card.count({ where: { is_active: true } }),
      
      // Inactive cards
      db.RFID_Card.count({ where: { is_active: false } }),
      
      // Assigned cards
      db.RFID_Card.count({ where: { user_id: { [db.Sequelize.Op.ne]: null } } }),
      
      // Unassigned cards
      db.RFID_Card.count({ where: { user_id: null } }),
      
      // Department distribution
      db.RFID_Card.findAll({
        include: [{
          model: db.User,
          attributes: ['department'],
          required: true
        }],
        attributes: [
          [db.Sequelize.col('User.department'), 'department'],
          [db.Sequelize.fn('COUNT', db.Sequelize.col('RFID_Card.id')), 'count']
        ],
        group: ['User.department'],
        raw: true
      }),
      
      // Role distribution
      db.RFID_Card.findAll({
        include: [{
          model: db.User,
          attributes: ['role'],
          required: true
        }],
        attributes: [
          [db.Sequelize.col('User.role'), 'role'],
          [db.Sequelize.fn('COUNT', db.Sequelize.col('RFID_Card.id')), 'count']
        ],
        group: ['User.role'],
        raw: true
      }),
      
      // Recent activity (cards created in last 30 days)
      db.RFID_Card.count({
        where: {
          issued_at: {
            [db.Sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Process department counts
    const departments = {};
    departmentCounts.forEach(item => {
      if (item.department) {
        departments[item.department] = parseInt(item.count);
      }
    });

    // Process role counts
    const roles = {};
    roleCounts.forEach(item => {
      if (item.role) {
        roles[item.role] = parseInt(item.count);
      }
    });

    return {
      total: totalCards,
      active: activeCards,
      inactive: inactiveCards,
      assigned: assignedCards,
      unassigned: unassignedCards,
      departments,
      roles,
      recentActivity,
      usageRate: totalCards > 0 ? Math.round((assignedCards / totalCards) * 100) : 0
    };
  } catch (error) {
    console.error('Error calculating RFID card statistics:', error);
    return {
      total: 0,
      active: 0,
      inactive: 0,
      assigned: 0,
      unassigned: 0,
      departments: {},
      roles: {},
      recentActivity: 0,
      usageRate: 0
    };
  }
}

exports.rfidCardsIndex = async (req, res) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // Parse filters
    const filters = {
      search: req.query.search || '',
      status: req.query.status || '',
      assignment: req.query.assignment || '',
      department: req.query.department || '',
      userRole: req.query.userRole || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || '',
      sortBy: req.query.sortBy || 'id',
      sortOrder: req.query.sortOrder || 'ASC'
    };

    // Build where conditions
    const whereConditions = {};
    const userWhereConditions = {};

    // Status filter
    if (filters.status === 'active') {
      whereConditions.is_active = true;
    } else if (filters.status === 'inactive') {
      whereConditions.is_active = false;
    }

    // Assignment filter
    if (filters.assignment === 'assigned') {
      whereConditions.user_id = { [db.Sequelize.Op.ne]: null };
    } else if (filters.assignment === 'unassigned') {
      whereConditions.user_id = null;
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const dateFilter = {};
      if (filters.dateFrom) {
        dateFilter[db.Sequelize.Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        dateFilter[db.Sequelize.Op.lte] = toDate;
      }
      whereConditions.issued_at = dateFilter;
    }

    // User-based filters
    if (filters.userRole) {
      userWhereConditions.role = filters.userRole;
    }
    if (filters.department) {
      userWhereConditions.department = filters.department;
    }

    // Search filter
    let searchConditions = {};
    if (filters.search) {
      searchConditions = {
        [db.Sequelize.Op.or]: [
          { card_uid: { [db.Sequelize.Op.like]: `%${filters.search}%` } },
          { '$User.first_name$': { [db.Sequelize.Op.like]: `%${filters.search}%` } },
          { '$User.last_name$': { [db.Sequelize.Op.like]: `%${filters.search}%` } },
          { '$User.email$': { [db.Sequelize.Op.like]: `%${filters.search}%` } },
          { '$User.school_id$': { [db.Sequelize.Op.like]: `%${filters.search}%` } }
        ]
      };
    }

    // Combine all conditions
    const finalWhereConditions = {
      ...whereConditions,
      ...searchConditions
    };

    // Get RFID cards with pagination and filtering
    const { count: totalCards, rows: rfidCards } = await db.RFID_Card.findAndCountAll({
      where: finalWhereConditions,
      include: [{
        model: db.User,
        required: false,
        where: Object.keys(userWhereConditions).length > 0 ? userWhereConditions : undefined,
        attributes: ['id', 'first_name', 'last_name', 'email', 'school_id', 'role', 'department', 'profile_picture']
      }],
      order: [[
        filters.sortBy === 'user_name' ? [db.User, 'first_name'] :
        filters.sortBy === 'user_email' ? [db.User, 'email'] :
        filters.sortBy === 'user_role' ? [db.User, 'role'] :
        filters.sortBy === 'user_department' ? [db.User, 'department'] :
        filters.sortBy, 
        filters.sortOrder
      ]],
      limit,
      offset,
      distinct: true
    });

    // Calculate statistics
    const statistics = await getRfidCardStatistics();

    // Get departments for filter dropdown
    const departments = await db.Department.findAll({
      attributes: ['code', 'name'],
      order: [['name', 'ASC']]
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCards / limit);
    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: totalCards,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      pageSizeOptions: [10, 25, 50, 100]
    };

    // Add calculated fields to cards
    const cardsWithExtras = rfidCards.map(card => {
      const cardData = card.toJSON();
      
      // Calculate days since issued
      if (cardData.issued_at) {
        const daysSinceIssued = Math.floor((new Date() - new Date(cardData.issued_at)) / (1000 * 60 * 60 * 24));
        cardData.daysSinceIssued = daysSinceIssued;
      }

      return cardData;
    });

    res.render('admin/rfid-cards/index', {
      rfidCards: cardsWithExtras,
      statistics,
      departments,
      filters,
      pagination,
      totalCards,
      currentPage: page,
      totalPages,
      title: 'RFID Cards Management',
      admin: req.session.admin
    });
  } catch (err) {
    console.error('Error in rfidCardsIndex:', err);
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
    console.log('Full req.body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);
    
    const { card_uid, user_id, is_active } = req.body;
    
    console.log('Creating RFID card with data:', { card_uid, user_id, is_active });
    
    // Validate required fields
    if (!card_uid) {
      return res.status(400).send('Card UID is required');
    }
    
    // Check if user exists (if user_id is provided)
    if (user_id) {
      const user = await db.User.findByPk(user_id);
      if (!user) {
        return res.status(400).send('Selected user does not exist');
      }
    }
    
    // Check if card_uid already exists
    const existingCard = await db.RFID_Card.findOne({ where: { card_uid } });
    if (existingCard) {
      return res.status(400).send('This RFID card UID already exists');
    }
    
    await db.RFID_Card.create({
      card_uid,
      user_id: user_id || null,
      is_active: is_active === 'true',
      issued_at: new Date()
    });

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_CREATED', {
      card_uid,
      user_id: user_id || null,
      is_active: is_active === 'true'
    });

    res.redirect('/admin/rfid-cards');
  } catch (err) {
    console.error('Error creating RFID card:', err);
    res.status(500).send(`Error creating RFID card: ${err.message}`);
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
    if (!card) {
      return res.status(404).send('RFID card not found');
    }

    let userData = null;
    let accessHistory = [];
    let cardStats = {
      totalAccess: 0,
      lastAccess: null,
      mostFrequentLocation: null,
      avgAccessPerDay: 0
    };

    // Get user information if card is assigned
    if (card.user_id) {
      // Try to get user from different tables
      userData = await db.User.findByPk(card.user_id) || 
                 await db.Student.findByPk(card.user_id) ||
                 await db.Professor.findByPk(card.user_id) ||
                 await db.Guardian.findByPk(card.user_id);
      
      if (userData) {
        // Get user's department if exists
        if (userData.department_id && db.Department) {
          const department = await db.Department.findByPk(userData.department_id);
          userData.department_name = department ? department.name : null;
        }
      }
    }

    // Get access history (last 50 entries)
    if (db.Access_Log) {
      try {
        accessHistory = await db.Access_Log.findAll({
          where: { card_uid: card.card_uid },
          order: [['timestamp', 'DESC']],
          limit: 50,
          include: [
            {
              model: db.Gate,
              as: 'gate',
              required: false
            }
          ]
        });

        // Calculate statistics
        if (accessHistory.length > 0) {
          cardStats.totalAccess = accessHistory.length;
          cardStats.lastAccess = accessHistory[0].timestamp;
          
          // Calculate average access per day
          const firstAccess = accessHistory[accessHistory.length - 1].timestamp;
          const daysDiff = Math.ceil((new Date() - new Date(firstAccess)) / (1000 * 60 * 60 * 24));
          cardStats.avgAccessPerDay = daysDiff > 0 ? (accessHistory.length / daysDiff).toFixed(1) : 0;
          
          // Find most frequent location
          const locationCounts = {};
          accessHistory.forEach(log => {
            const location = log.gate ? log.gate.name : log.location || 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + 1;
          });
          
          cardStats.mostFrequentLocation = Object.keys(locationCounts).reduce((a, b) => 
            locationCounts[a] > locationCounts[b] ? a : b, Object.keys(locationCounts)[0]
          );
        }
      } catch (accessErr) {
        console.log('Access history not available:', accessErr.message);
      }
    }

    // Get other cards for this user
    let otherCards = [];
    if (card.user_id) {
      try {
        otherCards = await db.RFID_Card.findAll({
          where: { 
            user_id: card.user_id,
            id: { [db.Sequelize.Op.ne]: card.id }
          },
          order: [['created_at', 'DESC']]
        });
      } catch (otherCardsErr) {
        console.log('Other cards not available:', otherCardsErr.message);
      }
    }

    res.render('admin/rfid-cards/show', { 
      card, 
      userData, 
      accessHistory, 
      cardStats,
      otherCards,
      title: 'RFID Card Details', 
      admin: req.session.admin 
    });
  } catch (err) {
    console.error('Error in rfidCardsShow:', err);
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

exports.rfidCardsToggleStatus = async (req, res) => {
  try {
    const card = await db.RFID_Card.findByPk(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'RFID card not found' });
    }

    const newStatus = !card.is_active;
    await card.update({ is_active: newStatus });

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_STATUS_TOGGLED', {
      id: card.id,
      card_uid: card.card_uid,
      old_status: card.is_active,
      new_status: newStatus
    });

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.json({ 
        success: true, 
        message: `Card ${newStatus ? 'activated' : 'deactivated'} successfully`,
        new_status: newStatus
      });
    } else {
      res.redirect('/admin/rfid-cards');
    }
  } catch (err) {
    console.error("Error in rfidCardsToggleStatus:", err);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.status(500).json({ error: 'Error toggling card status' });
    } else {
      res.status(500).send('Error toggling card status');
    }
  }
};

// Card Replacement Workflow
exports.rfidCardsReplaceForm = async (req, res) => {
  try {
    const oldCard = await db.RFID_Card.findByPk(req.params.id);
    if (!oldCard) {
      return res.status(404).send('RFID card not found');
    }

    // Get user info if card is assigned
    let userData = null;
    if (oldCard.user_id) {
      userData = await db.User.findByPk(oldCard.user_id) || 
                 await db.Student.findByPk(oldCard.user_id) ||
                 await db.Professor.findByPk(oldCard.user_id) ||
                 await db.Guardian.findByPk(oldCard.user_id);
    }

    res.render('admin/rfid-cards/replace', { 
      oldCard, 
      userData,
      title: 'Replace RFID Card', 
      admin: req.session.admin 
    });
  } catch (err) {
    console.error("Error in rfidCardsReplaceForm:", err);
    res.status(500).send('Error loading card replacement form');
  }
};

exports.rfidCardsReplace = async (req, res) => {
  try {
    const { new_card_uid, reason, transfer_assignment } = req.body;
    const oldCard = await db.RFID_Card.findByPk(req.params.id);
    
    if (!oldCard) {
      return res.status(404).json({ error: 'Original card not found' });
    }

    // Check if new UID already exists
    const existingCard = await db.RFID_Card.findOne({ where: { card_uid: new_card_uid } });
    if (existingCard) {
      return res.status(400).json({ error: 'New card UID already exists in system' });
    }

    const transaction = await db.sequelize.transaction();

    try {
      // Create new card
      const newCard = await db.RFID_Card.create({
        card_uid: new_card_uid,
        user_id: transfer_assignment === 'true' ? oldCard.user_id : null,
        is_active: true,
        issued_at: new Date(),
        notes: `Replacement for card ${oldCard.card_uid}. Reason: ${reason || 'Not specified'}`
      }, { transaction });

      // Deactivate old card and add replacement notes
      await oldCard.update({
        is_active: false,
        notes: `${oldCard.notes || ''}\nReplaced by card ${new_card_uid} on ${new Date().toLocaleDateString()}. Reason: ${reason || 'Not specified'}`
      }, { transaction });

      // Log the replacement
      await logDataAudit(req.session.admin.id, 'ADMIN_RFID_REPLACED', {
        old_card_id: oldCard.id,
        old_card_uid: oldCard.card_uid,
        new_card_id: newCard.id,
        new_card_uid: new_card_uid,
        user_id: oldCard.user_id,
        reason: reason,
        transfer_assignment: transfer_assignment === 'true'
      });

      await transaction.commit();

      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        res.json({ 
          success: true, 
          message: 'Card replaced successfully',
          new_card_id: newCard.id,
          old_card_id: oldCard.id
        });
      } else {
        res.redirect('/admin/rfid-cards');
      }
    } catch (transactionErr) {
      await transaction.rollback();
      throw transactionErr;
    }
  } catch (err) {
    console.error("Error in rfidCardsReplace:", err);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.status(500).json({ error: 'Error replacing card' });
    } else {
      res.status(500).send('Error replacing card');
    }
  }
};

// Advanced Analytics Endpoints
exports.rfidCardsAnalytics = async (req, res) => {
  try {
    const { period = '30', department, role } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get comprehensive analytics
    const analytics = await getRfidAnalytics(startDate, endDate, { department, role });
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.json(analytics);
    } else {
      res.render('admin/rfid-cards/analytics', { 
        analytics, 
        period,
        title: 'RFID Cards Analytics', 
        admin: req.session.admin 
      });
    }
  } catch (err) {
    console.error("Error in rfidCardsAnalytics:", err);
    res.status(500).send('Error loading analytics');
  }
};

// Export functionality
exports.rfidCardsExport = async (req, res) => {
  try {
    const { format = 'csv', filters } = req.query;
    const cards = await getRfidCardsForExport(filters);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=rfid-cards.csv');
      
      const csvData = generateRfidCardsCsv(cards);
      res.send(csvData);
    } else if (format === 'excel') {
      // Excel export would require additional library
      res.status(501).json({ error: 'Excel export not yet implemented' });
    } else {
      res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (err) {
    console.error("Error in rfidCardsExport:", err);
    res.status(500).send('Error exporting cards');
  }
};

// Helper function for analytics
async function getRfidAnalytics(startDate, endDate, filters = {}) {
  const analytics = {
    summary: {
      totalCards: 0,
      activeCards: 0,
      assignedCards: 0,
      totalAccess: 0,
      uniqueUsers: 0
    },
    trends: {
      cardCreation: [],
      accessPattern: [],
      departmentDistribution: [],
      roleDistribution: []
    },
    insights: []
  };

  try {
    // Basic counts
    const [totalCards, activeCards, assignedCards] = await Promise.all([
      db.RFID_Card.count(),
      db.RFID_Card.count({ where: { is_active: true } }),
      db.RFID_Card.count({ where: { user_id: { [db.Sequelize.Op.ne]: null } } })
    ]);

    analytics.summary.totalCards = totalCards;
    analytics.summary.activeCards = activeCards;
    analytics.summary.assignedCards = assignedCards;

    // Access analytics (if access log exists)
    if (db.Access_Log) {
      const accessCount = await db.Access_Log.count({
        where: {
          timestamp: {
            [db.Sequelize.Op.between]: [startDate, endDate]
          }
        }
      });
      analytics.summary.totalAccess = accessCount;
    }

    // Generate insights
    const usageRate = totalCards > 0 ? ((assignedCards / totalCards) * 100).toFixed(1) : 0;
    const activeRate = totalCards > 0 ? ((activeCards / totalCards) * 100).toFixed(1) : 0;
    
    analytics.insights = [
      {
        type: 'usage',
        title: 'Card Assignment Rate',
        value: `${usageRate}%`,
        description: `${assignedCards} out of ${totalCards} cards are assigned to users`,
        trend: usageRate > 80 ? 'positive' : usageRate > 60 ? 'neutral' : 'negative'
      },
      {
        type: 'status',
        title: 'Active Card Rate',
        value: `${activeRate}%`,
        description: `${activeCards} out of ${totalCards} cards are currently active`,
        trend: activeRate > 90 ? 'positive' : activeRate > 70 ? 'neutral' : 'negative'
      }
    ];

    return analytics;
  } catch (err) {
    console.error('Error generating analytics:', err);
    return analytics;
  }
}

// Helper function for export
async function getRfidCardsForExport(filters = {}) {
  const whereClause = {};
  
  if (filters.status) {
    whereClause.is_active = filters.status === 'active';
  }
  
  if (filters.assignment) {
    if (filters.assignment === 'assigned') {
      whereClause.user_id = { [db.Sequelize.Op.ne]: null };
    } else if (filters.assignment === 'unassigned') {
      whereClause.user_id = null;
    }
  }

  return await db.RFID_Card.findAll({
    where: whereClause,
    include: [
      {
        model: db.User,
        as: 'user',
        required: false
      }
    ],
    order: [['created_at', 'DESC']]
  });
}

// Helper function to generate CSV
function generateRfidCardsCsv(cards) {
  const headers = ['ID', 'Card UID', 'User Name', 'User Email', 'Status', 'Assigned Date', 'Created Date'];
  const rows = [headers.join(',')];
  
  cards.forEach(card => {
    const row = [
      card.id,
      `"${card.card_uid}"`,
      card.user ? `"${card.user.first_name} ${card.user.last_name}"` : '',
      card.user ? `"${card.user.email}"` : '',
      card.is_active ? 'Active' : 'Inactive',
      card.issued_at ? new Date(card.issued_at).toLocaleDateString() : '',
      new Date(card.created_at).toLocaleDateString()
    ];
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

// RFID Cards Bulk Operations
exports.rfidCardsBulkActivate = async (req, res) => {
  try {
    const { cardIds } = req.body;
    
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No cards selected' });
    }

    await db.RFID_Card.update(
      { is_active: true },
      { where: { id: { [db.Sequelize.Op.in]: cardIds } } }
    );

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_BULK_ACTIVATE', {
      cardIds,
      count: cardIds.length
    });

    res.json({ 
      success: true, 
      message: `Successfully activated ${cardIds.length} RFID card(s)` 
    });
  } catch (err) {
    console.error('Error in rfidCardsBulkActivate:', err);
    res.status(500).json({ success: false, error: 'Failed to activate cards' });
  }
};

exports.rfidCardsBulkDeactivate = async (req, res) => {
  try {
    const { cardIds } = req.body;
    
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No cards selected' });
    }

    await db.RFID_Card.update(
      { is_active: false, deactivated_at: new Date() },
      { where: { id: { [db.Sequelize.Op.in]: cardIds } } }
    );

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_BULK_DEACTIVATE', {
      cardIds,
      count: cardIds.length
    });

    res.json({ 
      success: true, 
      message: `Successfully deactivated ${cardIds.length} RFID card(s)` 
    });
  } catch (err) {
    console.error('Error in rfidCardsBulkDeactivate:', err);
    res.status(500).json({ success: false, error: 'Failed to deactivate cards' });
  }
};

exports.rfidCardsBulkDelete = async (req, res) => {
  try {
    const { cardIds } = req.body;
    
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No cards selected' });
    }

    // Get card details before deletion for audit
    const cardsToDelete = await db.RFID_Card.findAll({
      where: { id: { [db.Sequelize.Op.in]: cardIds } },
      attributes: ['id', 'card_uid', 'user_id']
    });

    await db.RFID_Card.destroy({
      where: { id: { [db.Sequelize.Op.in]: cardIds } }
    });

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_BULK_DELETE', {
      cardIds,
      count: cardIds.length,
      deletedCards: cardsToDelete.map(card => ({
        id: card.id,
        card_uid: card.card_uid,
        user_id: card.user_id
      }))
    });

    res.json({ 
      success: true, 
      message: `Successfully deleted ${cardIds.length} RFID card(s)` 
    });
  } catch (err) {
    console.error('Error in rfidCardsBulkDelete:', err);
    res.status(500).json({ success: false, error: 'Failed to delete cards' });
  }
};

exports.rfidCardsBulkExport = async (req, res) => {
  try {
    const { cardIds, format = 'csv' } = req.body;
    
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No cards selected' });
    }

    // Get cards with user information
    const cards = await db.RFID_Card.findAll({
      where: { id: { [db.Sequelize.Op.in]: cardIds } },
      include: [{
        model: db.User,
        required: false,
        attributes: ['first_name', 'last_name', 'email', 'school_id', 'role', 'department']
      }],
      order: [['id', 'ASC']]
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=rfid-cards-export-${new Date().toISOString().split('T')[0]}.json`);
      res.json(cards);
    } else {
      // CSV format
      const csvHeader = 'ID,Card UID,Status,User Name,Email,School ID,Role,Department,Issued Date\n';
      const csvRows = cards.map(card => {
        const user = card.User;
        return [
          card.id,
          card.card_uid,
          card.is_active ? 'Active' : 'Inactive',
          user ? `${user.first_name} ${user.last_name}` : 'Unassigned',
          user ? user.email : '',
          user ? user.school_id || '' : '',
          user ? user.role : '',
          user ? user.department || '' : '',
          card.issued_at ? new Date(card.issued_at).toISOString().split('T')[0] : ''
        ].map(field => `"${field}"`).join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=rfid-cards-export-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvHeader + csvRows);
    }

    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_BULK_EXPORT', {
      cardIds,
      count: cardIds.length,
      format
    });

  } catch (err) {
    console.error('Error in rfidCardsBulkExport:', err);
    res.status(500).json({ success: false, error: 'Failed to export cards' });
  }
};

// RFID Cards Statistics API
exports.rfidCardsStatistics = async (req, res) => {
  try {
    const statistics = await getRfidCardStatistics();
    res.json({ success: true, data: statistics });
  } catch (err) {
    console.error('Error in rfidCardsStatistics:', err);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
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
      department
    } = req.query;

    const filters = { startDate, endDate, actionType, department };
    const where = {};
    const { Op } = require('sequelize');

    // Get departments for filtering
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    // Date filtering with simplified logic
    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (!isNaN(parsedStartDate.getTime())) {
        parsedStartDate.setHours(0, 0, 0, 0);
        where.timestamp = { [Op.gte]: parsedStartDate };
      }
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (!isNaN(parsedEndDate.getTime())) {
        parsedEndDate.setHours(23, 59, 59, 999);
        if (where.timestamp) {
          where.timestamp[Op.lte] = parsedEndDate;
        } else {
          where.timestamp = { [Op.lte]: parsedEndDate };
        }
      }
    }

    // Action type filtering
    if (actionType && actionType.trim() !== '') {
      where.action_type = {
        [Op.like]: `${actionType}%`
      };
    }

    // Build include array for User model with department filtering
    const includeOptions = [{
      model: db.User,
      attributes: ['first_name', 'last_name', 'email', 'department', 'profile_picture'],
      required: false
    }];

    // Add department filtering if specified
    if (department && department.trim() !== '') {
      includeOptions[0].where = { department: department };
      includeOptions[0].required = true; // Only get logs from users in specified department
    }

    const { count, rows: logs } = await db.Audit_Log.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit,
      offset,
      include: includeOptions
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/audit-logs', { 
      logs,
      departments,
      title: 'Audit Logs',
      admin: req.session.admin,
      currentPage: page,
      totalPages,
      totalLogs: count,
      filters,
      pagination: {
        limit,
        pageSizeOptions: [5, 10, 25, 50, 100]
      }
    });
  } catch (err) {
    console.error('Error retrieving audit logs:', err);
    res.status(500).send('Error retrieving audit logs');
  }
};

// ========= Security Settings =========

exports.ipRestrictionsIndex = async (req, res) => {
  try {
    const allowedIps = await db.Allowed_IP.findAll({
      include: [
        {
          model: db.User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: db.User,
          as: 'updater',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const cacheMetadata = getAllowedIpCacheMetadata();

    res.render('admin/security/ip-restrictions', {
      title: 'IP Restrictions',
      admin: req.session.admin,
      allowedIps,
      cacheMetadata,
      fallbackIps: getFallbackIPs(),
      currentClientIp: getClientIp(req)
    });
  } catch (error) {
    console.error('Failed to load IP restrictions page:', error);
    queueToast(req, {
      type: 'error',
      title: 'Error Loading Data',
      message: 'Unable to load IP restrictions. Please try again later.'
    });
    res.redirect('/admin/dashboard');
  }
};

exports.ipRestrictionsCreate = async (req, res) => {
  const adminId = req.session?.admin?.id;
  const ipAddress = req.body.ip_address?.trim();
  const label = req.body.label?.trim() || null;
  const notes = req.body.notes?.trim() || null;
  const isActive = parseBoolean(req.body.is_active);

  if (!ipAddress || net.isIP(ipAddress) === 0) {
    queueToast(req, {
      type: 'error',
      title: 'Invalid IP Address',
      message: 'Please provide a valid IPv4 or IPv6 address.'
    });
    return res.redirect('/admin/security/ip-restrictions');
  }

  try {
    const existing = await db.Allowed_IP.findOne({ where: { ip_address: ipAddress } });
    if (existing) {
      queueToast(req, {
        type: 'warning',
        title: 'Duplicate IP',
        message: 'That IP address is already in the whitelist.'
      });
      return res.redirect('/admin/security/ip-restrictions');
    }

    const entry = await db.Allowed_IP.create({
      ip_address: ipAddress,
      label,
      notes,
      is_active: isActive,
      created_by: adminId || null,
      updated_by: adminId || null
    });

    await logSecurityAudit(adminId, 'ALLOWED_IP_CREATED', {
      ip_address: entry.ip_address,
      label: entry.label,
      notes: entry.notes,
      is_active: entry.is_active
    }, req);

    await logUserAudit(adminId, 'SETTINGS_UPDATE', {
      category: 'ip_restrictions',
      action: 'create',
      entityId: entry.id,
      ip_address: entry.ip_address
    }, req);

    await refreshAllowedIpCache();

    queueToast(req, {
      type: 'success',
      title: 'IP Added',
      message: 'The IP address has been added to the whitelist.'
    });
  } catch (error) {
    console.error('Failed to create allowed IP:', error);
    queueToast(req, {
      type: 'error',
      title: 'Create Failed',
      message: 'Unable to add the IP address. Please try again.'
    });
  }

  res.redirect('/admin/security/ip-restrictions');
};

exports.ipRestrictionsUpdate = async (req, res) => {
  const adminId = req.session?.admin?.id;
  const { id } = req.params;
  const ipAddress = req.body.ip_address?.trim();
  const label = req.body.label?.trim() || null;
  const notes = req.body.notes?.trim() || null;
  const isActive = parseBoolean(req.body.is_active);

  if (!ipAddress || net.isIP(ipAddress) === 0) {
    queueToast(req, {
      type: 'error',
      title: 'Invalid IP Address',
      message: 'Please provide a valid IPv4 or IPv6 address.'
    });
    return res.redirect('/admin/security/ip-restrictions');
  }

  try {
    const entry = await db.Allowed_IP.findByPk(id);

    if (!entry) {
      queueToast(req, {
        type: 'warning',
        title: 'Entry Not Found',
        message: 'The selected IP address could not be located.'
      });
      return res.redirect('/admin/security/ip-restrictions');
    }

    if (entry.ip_address !== ipAddress) {
      const duplicate = await db.Allowed_IP.findOne({ where: { ip_address: ipAddress } });
      if (duplicate) {
        queueToast(req, {
          type: 'warning',
          title: 'Duplicate IP',
          message: 'Another whitelist entry already uses that IP address.'
        });
        return res.redirect('/admin/security/ip-restrictions');
      }
    }

    const previous = entry.toJSON();

    entry.ip_address = ipAddress;
    entry.label = label;
    entry.notes = notes;
    entry.is_active = isActive;
    entry.updated_by = adminId || null;

    await entry.save();

    await logSecurityAudit(adminId, 'ALLOWED_IP_UPDATED', {
      entityId: entry.id,
      previous,
      updated: entry.toJSON()
    }, req);

    await logUserAudit(adminId, 'SETTINGS_UPDATE', {
      category: 'ip_restrictions',
      action: 'update',
      entityId: entry.id,
      ip_address: entry.ip_address
    }, req);

    await refreshAllowedIpCache();

    queueToast(req, {
      type: 'success',
      title: 'IP Updated',
      message: 'The whitelist entry has been updated successfully.'
    });
  } catch (error) {
    console.error('Failed to update allowed IP:', error);
    queueToast(req, {
      type: 'error',
      title: 'Update Failed',
      message: 'Unable to update the IP address. Please try again.'
    });
  }

  res.redirect('/admin/security/ip-restrictions');
};

exports.ipRestrictionsDelete = async (req, res) => {
  const adminId = req.session?.admin?.id;
  const { id } = req.params;

  try {
    const entry = await db.Allowed_IP.findByPk(id);

    if (!entry) {
      queueToast(req, {
        type: 'warning',
        title: 'Entry Not Found',
        message: 'The selected IP address could not be located.'
      });
      return res.redirect('/admin/security/ip-restrictions');
    }

    const snapshot = entry.toJSON();

    await entry.destroy();

    await logSecurityAudit(adminId, 'ALLOWED_IP_DELETED', {
      entityId: snapshot.id,
      ip_address: snapshot.ip_address,
      label: snapshot.label
    }, req);

    await logUserAudit(adminId, 'SETTINGS_UPDATE', {
      category: 'ip_restrictions',
      action: 'delete',
      entityId: snapshot.id,
      ip_address: snapshot.ip_address
    }, req);

    await refreshAllowedIpCache();

    queueToast(req, {
      type: 'success',
      title: 'IP Removed',
      message: 'The IP address has been removed from the whitelist.'
    });
  } catch (error) {
    console.error('Failed to delete allowed IP:', error);
    queueToast(req, {
      type: 'error',
      title: 'Delete Failed',
      message: 'Unable to delete the IP address. Please try again.'
    });
  }

  res.redirect('/admin/security/ip-restrictions');
};

// ========= Guardian Linking =========

exports.guardianLinksIndex = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { Op } = require('sequelize');
    
    // Build where clause for filtering
    let whereClause = {};
    const { search, department, guardianRole, relationshipType, dateFrom, dateTo, sortBy, sortOrder } = req.query;
    
    // Build OR conditions for search and department
    let orConditions = [];
    
    if (search) {
      orConditions.push(
        { '$guardian.first_name$': { [Op.like]: `%${search}%` } },
        { '$guardian.last_name$': { [Op.like]: `%${search}%` } },
        { '$guardian.email$': { [Op.like]: `%${search}%` } },
        { '$student.first_name$': { [Op.like]: `%${search}%` } },
        { '$student.last_name$': { [Op.like]: `%${search}%` } },
        { '$student.email$': { [Op.like]: `%${search}%` } }
      );
    }
    
    if (department) {
      orConditions.push(
        { '$guardian.department$': department },
        { '$student.department$': department }
      );
    }
    
    // Add OR conditions to where clause if any exist
    if (orConditions.length > 0) {
      whereClause[Op.or] = orConditions;
    }
    
    if (guardianRole) {
      whereClause['$guardian.role$'] = guardianRole;
    }
    
    if (relationshipType) {
      whereClause.relationship_type = relationshipType;
    }
    
    // Note: student.year field doesn't exist in User model, so this filter is disabled
    // if (studentYear) {
    //   whereClause['$student.year$'] = studentYear;
    // }
    
    if (dateFrom || dateTo) {
      whereClause.created_at = {};
      if (dateFrom) whereClause.created_at[Op.gte] = new Date(dateFrom);
      if (dateTo) whereClause.created_at[Op.lte] = new Date(dateTo + ' 23:59:59');
    }

    // Build order clause
    let orderClause = [['created_at', 'DESC']]; // default
    if (sortBy) {
      const direction = sortOrder === 'ASC' ? 'ASC' : 'DESC';
      switch (sortBy) {
        case 'id':
          orderClause = [['id', direction]];
          break;
        case 'guardian_name':
          orderClause = [[{ model: db.User, as: 'guardian' }, 'first_name', direction]];
          break;
        case 'student_name':
          orderClause = [[{ model: db.User, as: 'student' }, 'first_name', direction]];
          break;
        case 'created_at':
          orderClause = [['created_at', direction]];
          break;
        case 'updated_at':
          orderClause = [['updated_at', direction]];
          break;
      }
    }

    const { count, rows: links } = await db.Guardian_Student.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: db.User, 
          as: 'guardian', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'department', 'school_id', 'profile_picture'],
          required: false
        },
        { 
          model: db.User, 
          as: 'student', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'department', 'school_id', 'profile_picture'],
          required: false
        }
      ],
      limit,
      offset,
      order: orderClause,
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    // Load departments for filter
    const departments = await db.Department.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['code', 'name']
    });

    // Load statistics for the main view
    const statistics = {
      totalLinks: await db.Guardian_Student.count({
        where: { status: 'active' }
      }),
      activeGuardians: await db.Guardian_Student.count({
        distinct: true,
        col: 'guardian_id',
        where: { status: 'active' }
      }),
      studentsWithGuardians: await db.Guardian_Student.count({
        distinct: true,
        col: 'student_id',
        where: { status: 'active' }
      }),
      totalStudents: await db.User.count({
        where: { role: 'student' }
      })
    };
    statistics.orphanedStudents = statistics.totalStudents - statistics.studentsWithGuardians;

    res.render('admin/guardian-links/index', {
      title: 'Guardian Links',
      links,
      currentPage: page,
      totalPages,
      totalLinks: count,
      admin: req.session.admin,
      filters: req.query,
      pagination: { limit, page, totalPages, count },
      departments,
      statistics
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading guardian links');
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
    const { 
      guardianId, 
      studentId, 
      relationship_type, 
      priority_level, 
      email_notifications, 
      emergency_contact, 
      notes, 
      effective_from, 
      effective_to 
    } = req.body;

    const guardian = await db.User.findByPk(guardianId);
    const student = await db.User.findByPk(studentId);
    
    if (!guardian) {
      return res.status(400).send('Invalid guardian');
    }
    if (!student || student.role !== 'student') {
      return res.status(400).send('Invalid student');
    }

    // Check if link already exists
    const existingLink = await db.Guardian_Student.findOne({
      where: { guardian_id: guardianId, student_id: studentId }
    });
    if (existingLink) {
      return res.status(400).send('Guardian link already exists');
    }

    // Create the link with all the new fields
    const linkData = {
      guardian_id: guardianId,
      student_id: studentId,
      relationship_type: relationship_type || null,
      priority_level: priority_level || 'primary',
      email_notifications: email_notifications === 'on' || email_notifications === true,
      emergency_contact: emergency_contact === 'on' || emergency_contact === true,
      notes: notes || null,
      effective_from: effective_from ? new Date(effective_from) : null,
      effective_to: effective_to ? new Date(effective_to) : null,
      status: 'active'
    };

    const link = await db.Guardian_Student.create(linkData);

    await logDataAudit(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINK_CREATED',
      {
        linkId: link.id,
        linkData,
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

    await logDataAudit(
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

// Guardian Link Show (Detail View)
exports.guardianLinkShow = async (req, res) => {
  try {
    const link = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { 
          model: db.User, 
          as: 'guardian', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'school_id', 'department', 'profile_picture', 'created_at', 'last_login']
        },
        { 
          model: db.User, 
          as: 'student', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'school_id', 'department', 'year', 'profile_picture', 'created_at', 'last_login']
        }
      ]
    });

    if (!link) {
      return res.status(404).send('Guardian link not found');
    }

    res.render('admin/guardian-links/show', {
      title: 'Guardian Link Details',
      link: link,
      admin: req.session.admin
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading guardian link details');
  }
};

// Guardian Links Statistics API
exports.guardianLinksStatistics = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    // Get total links
    const totalLinks = await db.Guardian_Student.count({
      where: { status: 'active' }
    });

    // Get active guardians (unique guardians with active links)
    const activeGuardians = await db.Guardian_Student.count({
      distinct: true,
      col: 'guardian_id',
      where: { status: 'active' }
    });

    // Get students with guardians
    const studentsWithGuardians = await db.Guardian_Student.count({
      distinct: true,
      col: 'student_id',
      where: { status: 'active' }
    });

    // Get total students
    const totalStudents = await db.User.count({
      where: { role: 'student' }
    });

    // Calculate orphaned students (students without guardians)
    const orphanedStudents = totalStudents - studentsWithGuardians;

    res.json({
      success: true,
      data: {
        totalLinks,
        activeGuardians,
        studentsWithGuardians,
        orphanedStudents,
        totalStudents
      }
    });
  } catch (err) {
    console.error('Error fetching guardian links statistics:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Bulk Delete Guardian Links
exports.guardianLinksBulkDelete = async (req, res) => {
  try {
    const { linkIds } = req.body;
    
    if (!linkIds || !Array.isArray(linkIds) || linkIds.length === 0) {
      return res.status(400).json({ error: 'No link IDs provided' });
    }

    // Get links for audit logging
    const links = await db.Guardian_Student.findAll({
      where: { id: linkIds },
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });

    // Log the bulk deletion
    await logDataAudit(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINKS_BULK_DELETED',
      { linkIds, count: links.length, links: links.map(l => l.toJSON()) }
    );

    // Delete the links
    const deletedCount = await db.Guardian_Student.destroy({
      where: { id: linkIds }
    });

    res.json({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} guardian link(s)`,
      deletedCount 
    });
  } catch (err) {
    console.error('Error in bulk delete:', err);
    res.status(500).json({ error: 'Failed to delete guardian links' });
  }
};

// Bulk Export Guardian Links
exports.guardianLinksBulkExport = async (req, res) => {
  try {
    const { format = 'csv', all = false } = req.query;
    const { Op } = require('sequelize');
    
    let whereClause = {};
    
    // Apply filters if not exporting all
    if (!all) {
      const { search, department, guardianRole, relationshipType, dateFrom, dateTo } = req.query;
      
      // Build OR conditions for search and department
      let orConditions = [];
      
      if (search) {
        orConditions.push(
          { '$guardian.first_name$': { [Op.like]: `%${search}%` } },
          { '$guardian.last_name$': { [Op.like]: `%${search}%` } },
          { '$guardian.email$': { [Op.like]: `%${search}%` } },
          { '$student.first_name$': { [Op.like]: `%${search}%` } },
          { '$student.last_name$': { [Op.like]: `%${search}%` } },
          { '$student.email$': { [Op.like]: `%${search}%` } }
        );
      }
      
      if (department) {
        orConditions.push(
          { '$guardian.department$': department },
          { '$student.department$': department }
        );
      }
      
      // Add OR conditions to where clause if any exist
      if (orConditions.length > 0) {
        whereClause[Op.or] = orConditions;
      }
      
      if (guardianRole) {
        whereClause['$guardian.role$'] = guardianRole;
      }
      
      if (relationshipType) {
        whereClause.relationship_type = relationshipType;
      }
      
      if (dateFrom || dateTo) {
        whereClause.created_at = {};
        if (dateFrom) whereClause.created_at[Op.gte] = new Date(dateFrom);
        if (dateTo) whereClause.created_at[Op.lte] = new Date(dateTo + ' 23:59:59');
      }
    }

    const links = await db.Guardian_Student.findAll({
      where: whereClause,
      include: [
        { 
          model: db.User, 
          as: 'guardian', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'department', 'school_id']
        },
        { 
          model: db.User, 
          as: 'student', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'department', 'school_id', 'year']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="guardian-links.json"');
      return res.json(links);
    }

    // CSV export
    const csvData = links.map(link => ({
      'Link ID': link.id,
      'Guardian Name': link.guardian ? `${link.guardian.first_name} ${link.guardian.last_name}` : 'N/A',
      'Guardian Email': link.guardian ? link.guardian.email : 'N/A',
      'Guardian School ID': link.guardian ? link.guardian.school_id || 'N/A' : 'N/A',
      'Guardian Department': link.guardian ? link.guardian.department || 'N/A' : 'N/A',
      'Student Name': link.student ? `${link.student.first_name} ${link.student.last_name}` : 'N/A',
      'Student Email': link.student ? link.student.email : 'N/A',
      'Student ID': link.student ? link.student.school_id || 'N/A' : 'N/A',
      'Student Department': link.student ? link.student.department || 'N/A' : 'N/A',
      // 'Student Year': link.student ? link.student.year || 'N/A' : 'N/A', // Field doesn't exist in User model
      'Relationship Type': link.relationship_type || 'N/A',
      'Priority Level': link.priority_level || 'N/A',
      'Email Notifications': link.email_notifications ? 'Yes' : 'No',
      'Emergency Contact': link.emergency_contact ? 'Yes' : 'No',
      'Status': link.status || 'active',
      'Notes': link.notes || 'N/A',
      'Created Date': link.created_at ? new Date(link.created_at).toLocaleDateString() : 'N/A',
      'Updated Date': link.updated_at ? new Date(link.updated_at).toLocaleDateString() : 'N/A'
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="guardian-links.csv"');
    res.send(csvContent);

  } catch (err) {
    console.error('Error exporting guardian links:', err);
    res.status(500).json({ error: 'Failed to export guardian links' });
  }
};

// Quick Edit Guardian Link
exports.guardianLinksQuickEdit = async (req, res) => {
  try {
    const { linkId, relationship_type, notes } = req.body;
    
    if (!linkId) {
      return res.status(400).json({ error: 'Link ID is required' });
    }

    const link = await db.Guardian_Student.findByPk(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Guardian link not found' });
    }

    // Update the link
    const updateData = {};
    if (relationship_type !== undefined) updateData.relationship_type = relationship_type || null;
    if (notes !== undefined) updateData.notes = notes || null;

    await link.update(updateData);

    // Log the update
    await logDataAudit(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINK_QUICK_EDITED',
      { linkId, changes: updateData }
    );

    res.json({ 
      success: true, 
      message: 'Guardian link updated successfully',
      link: link 
    });
  } catch (err) {
    console.error('Error in quick edit:', err);
    res.status(500).json({ error: 'Failed to update guardian link' });
  }
};

// Export Single Guardian Link Details
exports.guardianLinkExport = async (req, res) => {
  try {
    const link = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { 
          model: db.User, 
          as: 'guardian', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'department', 'school_id', 'profile_picture']
        },
        { 
          model: db.User, 
          as: 'student', 
          attributes: ['id', 'first_name', 'last_name', 'email', 'department', 'school_id', 'year', 'profile_picture']
        }
      ]
    });

    if (!link) {
      return res.status(404).json({ error: 'Guardian link not found' });
    }

    // For now, return JSON. In a full implementation, you might generate a PDF
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="guardian-link-${link.id}-details.json"`);
    res.json({
      link: link,
      exported_at: new Date().toISOString(),
      exported_by: req.session.admin.email
    });

  } catch (err) {
    console.error('Error exporting guardian link details:', err);
    res.status(500).json({ error: 'Failed to export guardian link details' });
  }
};

// Send Notification to Guardian and Student
exports.guardianLinkNotify = async (req, res) => {
  try {
    const link = await db.Guardian_Student.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'guardian', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: db.User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });

    if (!link) {
      return res.status(404).json({ error: 'Guardian link not found' });
    }

    // Log the notification attempt
    await logDataAudit(
      req.session.admin.id,
      'ADMIN_GUARDIAN_LINK_NOTIFICATION_SENT',
      { 
        linkId: link.id, 
        guardianEmail: link.guardian?.email,
        studentEmail: link.student?.email 
      }
    );

    // Here you would implement actual email sending logic
    // TODO EMAIL 
    // TODO NUM
    
    res.json({ 
      success: true, 
      message: 'Notifications sent successfully to guardian and student' 
    });

  } catch (err) {
    console.error('Error sending notifications:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
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

      // Validate required fields
      if (!name || !code) {
        return res.status(400).send('Department name and code are required');
      }

      // Check for empty strings after trimming
      if (!name.trim() || !code.trim()) {
        return res.status(400).send('Department name and code cannot be empty');
      }
    
    // Ensure code is a string and convert to uppercase
    const departmentCode = String(code).toUpperCase().trim();
    
    if (departmentCode.length < 2 || departmentCode.length > 10) {
      return res.status(400).send('Department code must be between 2 and 10 characters');
    }
    
    const newDepartment = await db.Department.create({
      name: name.trim(),
      code: departmentCode,
      description: description ? description.trim() : null,
      is_active: is_active === 'true' || is_active === true
    });

    await logDataAudit(req.session.admin.id, 'DEPARTMENT_CREATED', {
      name: name.trim(),
      code: departmentCode,
      description: description ? description.trim() : null,
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
    
    // Validate required fields
    if (!name || !code) {
      return res.status(400).send('Department name and code are required');
    }
    
    // Ensure code is a string and convert to uppercase
    const departmentCode = String(code).toUpperCase().trim();
    
    if (departmentCode.length < 2 || departmentCode.length > 10) {
      return res.status(400).send('Department code must be between 2 and 10 characters');
    }
    
    const [updatedRows] = await db.Department.update({
      name: name.trim(),
      code: departmentCode,
      description: description ? description.trim() : null,
      is_active: is_active === 'true' || is_active === true
    }, {
      where: { id: req.params.id }
    });

    if (updatedRows === 0) {
      return res.status(404).send('Department not found');
    }

    await logDataAudit(req.session.admin.id, 'DEPARTMENT_UPDATED', {
      id: req.params.id,
      name: name.trim(),
      code: departmentCode,
      description: description ? description.trim() : null,
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

// ========= Department API Endpoints =========

exports.departmentsStatistics = async (req, res) => {
  try {
    if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Get user counts for each department
    const [departmentUserCounts] = await db.sequelize.query(`
      SELECT 
        d.id,
        d.code,
        d.name,
        COUNT(u.id) as user_count
      FROM Departments d
      LEFT JOIN Users u ON u.department = d.code
      WHERE d.is_active = 1
      GROUP BY d.id, d.code, d.name
      ORDER BY d.name ASC
    `);

    const departmentUserCountsMap = {};
    departmentUserCounts.forEach(dept => {
      departmentUserCountsMap[dept.id] = parseInt(dept.user_count) || 0;
    });

    res.json({
      success: true,
      data: {
        departmentUserCounts: departmentUserCountsMap
      }
    });
  } catch (err) {
    console.error('Error getting department statistics:', err);
    res.status(500).json({ success: false, error: 'Failed to load statistics' });
  }
};

exports.departmentStatistics = async (req, res) => {
  try {
    if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const departmentId = req.params.id;
    const department = await db.Department.findByPk(departmentId);
    
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }

    // Get statistics for this specific department
    const [stats] = await db.sequelize.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT c.id) as total_classes,
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' AND DATE(al.timestamp) = CURDATE() THEN 1 ELSE 0 END) as today_entries
      FROM Users u
      LEFT JOIN Classes c ON c.department = u.department
      LEFT JOIN Audit_Logs al ON al.user_id = u.id
      WHERE u.department = :departmentCode
    `, {
      replacements: { departmentCode: department.code }
    });

    const result = stats[0] || { total_users: 0, total_classes: 0, today_entries: 0 };

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(result.total_users) || 0,
        totalClasses: parseInt(result.total_classes) || 0,
        todayEntries: parseInt(result.today_entries) || 0
      }
    });
  } catch (err) {
    console.error('Error getting department statistics:', err);
    res.status(500).json({ success: false, error: 'Failed to load statistics' });
  }
};

exports.departmentActivity = async (req, res) => {
  try {
    if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const departmentCode = req.params.code;

    // Get recent activity for users in this department
    const activities = await db.Audit_Log.findAll({
      limit: 10,
      order: [['timestamp', 'DESC']],
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name', 'email'],
        where: { department: departmentCode },
        required: true
      }]
    });

    const activityData = activities.map(activity => ({
      action_type: activity.action_type,
      timestamp: activity.timestamp,
      user_name: activity.User ? `${activity.User.first_name} ${activity.User.last_name}` : 'Unknown User',
      description: activity.description || formatActionType(activity.action_type)
    }));

    res.json({
      success: true,
      data: activityData
    });
  } catch (err) {
    console.error('Error getting department activity:', err);
    res.status(500).json({ success: false, error: 'Failed to load activity' });
  }
};

// ========= Class API Endpoints =========

exports.classesStatistics = async (req, res) => {
  try {
    if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Get class statistics
    const [stats] = await db.sequelize.query(`
      SELECT 
        COUNT(*) as total_classes,
        COUNT(DISTINCT department) as unique_departments,
        SUM(CASE WHEN start_time <= CURTIME() AND end_time >= CURTIME() THEN 1 ELSE 0 END) as active_classes,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_classes
      FROM Classes
    `);

    // Get enrollment data to calculate total capacity
    const [capacityStats] = await db.sequelize.query(`
      SELECT 
        COUNT(ce.student_id) as total_enrolled
      FROM Class_Enrollments ce
      INNER JOIN Classes c ON c.id = ce.class_id
    `);

    // For schedule conflicts, check for overlapping time slots (simplified)
    const [conflictStats] = await db.sequelize.query(`
      SELECT COUNT(*) as conflicts
      FROM Classes c1
      INNER JOIN Classes c2 ON c1.id < c2.id 
      WHERE c1.room = c2.room 
      AND c1.start_time < c2.end_time 
      AND c1.end_time > c2.start_time
      AND c1.schedule = c2.schedule
    `);

    const result = stats[0] || {};
    const capacity = capacityStats[0] || {};
    const conflicts = conflictStats[0] || {};

    res.json({
      success: true,
      data: {
        activeClasses: parseInt(result.active_classes) || 0,
        todayClasses: parseInt(result.today_classes) || 0,
        totalCapacity: parseInt(capacity.total_enrolled) || 0,
        uniqueDepartments: parseInt(result.unique_departments) || 0,
        scheduleConflicts: parseInt(conflicts.conflicts) || 0
      }
    });
  } catch (err) {
    console.error('Error getting class statistics:', err);
    res.status(500).json({ success: false, error: 'Failed to load statistics' });
  }
};

exports.classesStatusCapacity = async (req, res) => {
  try {
    if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Get enrollment data for all classes
    const [classData] = await db.sequelize.query(`
      SELECT 
        c.id,
        c.class_code,
        c.start_time,
        c.end_time,
        COUNT(ce.student_id) as enrolled_count,
        COUNT(cp.professor_id) as professor_count
      FROM Classes c
      LEFT JOIN Class_Enrollments ce ON ce.class_id = c.id
      LEFT JOIN Class_Professors cp ON cp.class_id = c.id
      GROUP BY c.id, c.class_code, c.start_time, c.end_time
    `);

    const result = {};
    
    classData.forEach(cls => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);
      const startTime = cls.start_time;
      const endTime = cls.end_time;
      
      // Determine class status
      let status;
      if (currentTime >= startTime && currentTime <= endTime) {
        status = { label: 'Active', class: 'bg-success', icon: 'fa-play-circle' };
      } else if (currentTime < startTime) {
        status = { label: 'Scheduled', class: 'bg-info', icon: 'fa-clock' };
      } else {
        status = { label: 'Completed', class: 'bg-secondary', icon: 'fa-check-circle' };
      }

      // Check if class is full (assuming max capacity of 30 for demo)
      const maxCapacity = 30;
      const enrolled = parseInt(cls.enrolled_count) || 0;
      
      if (enrolled >= maxCapacity) {
        status = { label: 'Full', class: 'bg-warning', icon: 'fa-users' };
      }

      result[cls.id] = {
        status: status,
        capacity: {
          enrolled: enrolled,
          total: maxCapacity
        }
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error getting class status and capacity:', err);
    res.status(500).json({ success: false, error: 'Failed to load data' });
  }
};

exports.classesSchedule = async (req, res) => {
  try {
    if (!req.session.admin) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const weekOffset = parseInt(req.query.weekOffset) || 0;

    // Get classes with their schedule information
    const classes = await db.Class.findAll({
      attributes: ['id', 'class_code', 'class_name', 'room', 'start_time', 'end_time', 'schedule'],
      order: [['start_time', 'ASC']]
    });

    // Parse schedule data and format for calendar
    const scheduleData = [];
    
    classes.forEach(cls => {
      // Parse the schedule field to extract days (assuming format like "MWF" or "TTh")
      const schedule = cls.schedule || '';
      const days = parseScheduleDays(schedule);
      const timeSlot = formatTimeSlot(cls.start_time);
      
      days.forEach(day => {
        scheduleData.push({
          id: cls.id,
          class_code: cls.class_code,
          class_name: cls.class_name,
          room: cls.room,
          day: day,
          time_slot: timeSlot,
          start_time: cls.start_time,
          end_time: cls.end_time
        });
      });
    });

    res.json({
      success: true,
      data: scheduleData
    });
  } catch (err) {
    console.error('Error getting class schedule:', err);
    res.status(500).json({ success: false, error: 'Failed to load schedule' });
  }
};

// Helper functions
function formatActionType(actionType) {
  const actionMap = {
    'RFID_ENTRY': 'RFID Entry',
    'RFID_EXIT': 'RFID Exit',
    'USER_LOGIN': 'User Login',
    'USER_LOGOUT': 'User Logout',
    'FACE_VERIFICATION_SUCCESS': 'Face Verified',
    'FACE_VERIFICATION_FAILED': 'Face Verification Failed'
  };
  return actionMap[actionType] || actionType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function parseScheduleDays(schedule) {
  // Parse schedule string to extract days
  // Common formats: MWF, TTh, MW, etc.
  const dayMap = {
    'M': 'Monday',
    'T': 'Tuesday', 
    'W': 'Wednesday',
    'Th': 'Thursday',
    'F': 'Friday',
    'S': 'Saturday',
    'Su': 'Sunday'
  };
  
  const days = [];
  let i = 0;
  while (i < schedule.length) {
    if (i < schedule.length - 1 && schedule.substr(i, 2) === 'Th') {
      days.push('Thursday');
      i += 2;
    } else if (i < schedule.length - 1 && schedule.substr(i, 2) === 'Su') {
      days.push('Sunday');
      i += 2;
    } else if (dayMap[schedule[i]]) {
      days.push(dayMap[schedule[i]]);
      i++;
    } else {
      i++;
    }
  }
  
  return days;
}

function formatTimeSlot(timeString) {
  // Convert time to hour format for calendar slots
  if (!timeString) return '08:00';
  
  const time = new Date(`2000-01-01T${timeString}`);
  const hours = time.getHours();
  return `${hours.toString().padStart(2, '0')}:00`;
}
