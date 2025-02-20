const db = require('../models');
const bcrypt = require('bcrypt');
const { logAuditEvent } = require('./auditLogger');
const { logDataAudit } = require('./auditLogger');
const { logUserAudit } = require('./auditLogger');
const { logSecurityAudit } = require('./auditLogger');
//TODO: god fix imports on all and test

exports.showLoginForm = (req, res) => {
  res.render('admin/login', { title: 'Admin Login', layout: false});
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await db.User.findOne({ where: { email, role: 'admin' } });
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      await logSecurityAudit(req.user ? req.user.userId : null, 'UNAUTHORIZED_ACCESS', { url: req.originalUrl, method: req.method });
      return res.render('admin/login', { error: 'Invalid credentials or not an admin', title: 'Admin Login', layout: false});
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
    const users = await db.User.findAll({ order: [['id', 'ASC']] });
    res.render('admin/users/index', { users, title: 'Manage Users' });
  } catch (err) {
    res.status(500).send('Error retrieving users');
  }
};

exports.usersCreateForm = (req, res) => {
  res.render('admin/users/create', { title: 'Create User' });
};

exports.usersCreate = async (req, res) => {
  try {
    const { first_name, last_name, email, role, school_id, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.User.create({
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
    res.render('admin/users/edit', { user, title: 'Edit User' });
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
    res.render('admin/users/show', { user, title: 'User Details' });
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
    const classes = await db.Class.findAll({ order: [['id', 'ASC']] });
    res.render('admin/classes/index', { classes, title: 'Manage Classes' });
  } catch (err) {
    res.status(500).send('Error retrieving classes');
  }
};

exports.classesCreateForm = (req, res) => {
  res.render('admin/classes/create', { title: 'Create Class' });
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
    const cls = await db.Class.findByPk(req.params.id);
    res.render('admin/classes/edit', { cls, title: 'Edit Class' });
  } catch (err) {
    res.status(500).send('Error retrieving class');
  }
};

exports.classesEdit = async (req, res) => {
  try {
    const original = await db.Class.findByPk(req.params.id);
    if (!original) {
      return res.status(404).send('Class not found');
    }

    const { class_code, class_name, course, year, section, room, start_time, end_time, schedule, professorIds } = req.body;
  
    await db.Class.update(
      { class_code, class_name, course, year, section, room, start_time, end_time, schedule },
      { where: { id: req.params.id } }
    );
    
    const updated = await db.Class.findByPk(req.params.id);

    if (professorIds) {
      const ids = professorIds.split(',').map(x => parseInt(x.trim()));
      await updated.setProfessors(ids);
    }
    
    await logDataAudit(req.session.admin.id, 'CLASS_UPDATED', {
      id: req.params.id,
      original: original.toJSON(),
      updated: updated.toJSON()
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
    res.render('admin/classes/show', { cls, title: 'Class Details' });
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
    res.render('admin/rfid-cards/index', { rfidCards, title: 'Manage RFID Cards' });
  } catch (err) {
    res.status(500).send('Error retrieving RFID cards');
  }
};

exports.rfidCardsCreateForm = (req, res) => {
  res.render('admin/rfid-cards/create', { title: 'Create RFID Card' });
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
    res.render('admin/rfid-cards/edit', { card, title: 'Edit RFID Card' });
  } catch (err) {
    res.status(500).send('Error retrieving RFID card');
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
    res.render('admin/rfid-cards/show', { card, title: 'RFID Card Details' });
  } catch (err) {
    res.status(500).send('Error retrieving RFID card');
  }
};

exports.rfidCardsDelete = async (req, res) => {
  try {
    await db.RFID_Card.destroy({ where: { id: req.params.id } });

    const card = await db.RFID_Card.findByPk(req.params.id);
    
    await logDataAudit(req.session.admin.id, 'ADMIN_RFID_DELETED', {
      id: card.id,
      card_uid: card.card_uid,
      user_id: card.user_id
    });

    res.redirect('/admin/rfid-cards');
  } catch (err) {
    res.status(500).send('Error deleting RFID card');
  }
};

// ========= Audit Logs =========

exports.auditLogs = async (req, res) => {
  try {
    const logs = await db.Audit_Log.findAll({ order: [['timestamp', 'DESC']] });
    res.render('admin/audit-logs', { logs, title: 'Audit Logs' });
  } catch (err) {
    res.status(500).send('Error retrieving audit logs');
  }
};

// ========= Guardian Linking =========

exports.guardianLinkForm = (req, res) => {
  res.render('admin/guardian-link', { title: 'Link Guardian to Student' });
};

exports.linkGuardianToStudent = async (req, res) => {
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
    await guardian.addStudentsMonitored(student);
    res.redirect('/admin/guardian-link');
  } catch (err) {
    res.status(500).send('Error linking guardian to student');
  }
};
