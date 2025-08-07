const db = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { logAnomalyAudit } = require('./auditLogger');
const { logDataAudit } = require('./auditLogger');
const { logUserAudit } = require('./auditLogger');
const { logSecurityAudit } = require('./auditLogger');
const axios = require('axios');
const { deleteOldProfilePicture, getProfilePictureUrl } = require('../middleware/profileUpload');

const fs = require('fs');
const path = require('path');
const csv = require('csvtojson');
const ExcelJS = require('exceljs');

const loginFailures = {};

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
    const limit = 20; // Fixed limit for simplicity
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
      attributes: ['first_name', 'last_name', 'email', 'department'],
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
      limit: limit,
      offset: offset,
      include: includeOptions
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/audit-logs', { 
      logs,
      departments,
      title: 'Audit Logs',
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalLogs: count,
      filters
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