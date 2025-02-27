const db = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { logAnomalyAudit } = require('./auditLogger');
const { logDataAudit } = require('./auditLogger');
const { logUserAudit } = require('./auditLogger');
const { logSecurityAudit } = require('./auditLogger');

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
  res.render('admin/login', { title: 'Admin Login', layout: false });
};

exports.login = async (req, res) => {
  try {
    const ip = req.ip;
    const { email, password } = req.body;
    const admin = await db.User.findOne({ where: { email, role: 'admin' } });
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      loginFailures[ip] = (loginFailures[ip] || 0) + 1;
      await logSecurityAudit(req.user ? req.user.userId : null, 'ADMIN_UNAUTHORIZED_ACCESS', { url: req.originalUrl, method: req.method });
      if (loginFailures[ip] > 5) {
        await logAnomalyAudit(ip, 'ADMIN_MULTIPLE_LOGIN_FAILURES', { ip, count: loginFailures[ip] });
      }
      return res.render('admin/login', { error: 'Invalid credentials or not an admin', title: 'Admin Login', layout: false });
    }
    req.session.admin = admin;
    await logUserAudit(admin.id, 'ADMIN_LOGIN_SUCCESS', { email });
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.render('admin/login', { error: 'Login failed', title: 'Admin Login', layout: false });
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

exports.dashboard = (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  res.render('admin/dashboard', { admin: req.session.admin, title: 'Dashboard' });
};

// ========= Users =========

exports.usersIndex = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const offset = (page - 1) * limit;

    const { count, rows: users } = await db.User.findAndCountAll({
      order: [['id', 'ASC']],
      limit: limit,
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/users/index', { 
      users, 
      title: 'Manage Users', 
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: count
    });
  } catch (err) {
    res.status(500).send('Error retrieving users');
  }
};

exports.usersCreateForm = (req, res) => {
  res.render('admin/users/create', { title: 'Create User', admin: req.session.admin });
};

exports.usersCreate = async (req, res) => {
  try {
    const { first_name, last_name, email, role, school_id, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.User.create({
      first_name,
      last_name,
      email,
      role,
      school_id,
      password_hash: hashedPassword
    });
    
    await logDataAudit(newUser.id, 'USER_CREATED', {
      first_name,
      last_name,
      email,
      role,
      school_id
    });

    res.redirect('/admin/users');
  } catch (err) {
    res.status(500).send('Error creating user');
  }
};

exports.usersEditForm = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    res.render('admin/users/edit', { user, title: 'Edit User', admin: req.session.admin });
  } catch (err) {
    res.status(500).send('Error retrieving user');
  }
};

exports.usersEdit = async (req, res) => {
  try {
    const { first_name, last_name, email, role, school_id } = req.body;
    await db.User.update(
      { first_name, last_name, email, role, school_id },
      { where: { id: req.params.id } }
    );

    await logDataAudit(req.params.id, 'USER_UPDATED', {
      first_name,
      last_name,
      email,
      role,
      school_id
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
    const limit = 10;
    const offset = (page - 1) * limit;

    const { count, rows: logs } = await db.Audit_Log.findAndCountAll({
      order: [['timestamp', 'DESC']],
      limit: limit,
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/audit-logs', { 
      logs, 
      title: 'Audit Logs', 
      admin: req.session.admin,
      currentPage: page,
      totalPages: totalPages,
      totalLogs: count
    });
  } catch (err) {
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