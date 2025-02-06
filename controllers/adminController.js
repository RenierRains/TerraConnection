const db = require('../models');
const bcrypt = require('bcrypt');

// USERS MANAGEMENT
exports.createUser = async (req, res) => {
  try {
    const { first_name, last_name, username, email, password, role, school_id } = req.body;
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    const user = await db.User.create({ first_name, last_name, username, email, password_hash, role, school_id });
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await db.User.findAll({ attributes: { exclude: ['password_hash'] } });
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await db.User.update(req.body, { where: { id: userId } });
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await db.User.destroy({ where: { id: userId } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// CLASS MANAGEMENT
exports.createClass = async (req, res) => {
  try {
    const { class_name, schedule, professorIds } = req.body;
    // create the class record
    const newClass = await db.Class.create({ class_name, schedule });
    // link professors  NOTE: for mobile: triple check if professorIds is an array)
    if (professorIds && professorIds.length > 0) {
      await newClass.setProfessors(professorIds);
    }
    res.status(201).json({ message: 'Class created', class: newClass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  }
};

exports.getClasses = async (req, res) => {
  try {
    const classes = await db.Class.findAll({
      include: [{ model: db.User, as: 'professors', attributes: ['id', 'first_name', 'last_name'] }]
    });
    res.json({ classes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve classes' });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const { class_name, schedule, professorIds } = req.body;
    await db.Class.update({ class_name, schedule }, { where: { id: classId } });
    // Update professors if provided
    if (professorIds) {
      const theClass = await db.Class.findByPk(classId);
      await theClass.setProfessors(professorIds);
    }
    res.json({ message: 'Class updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update class' });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classId = req.params.id;
    await db.Class.destroy({ where: { id: classId } });
    res.json({ message: 'Class deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete class' });
  }
};

// AUDIT LOGS
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await db.Audit_Log.findAll({ order: [['timestamp', 'DESC']] });
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
};