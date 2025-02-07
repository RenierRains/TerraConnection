const db = require('../models');
const bcrypt = require('bcrypt');

exports.verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Admins only.' });
};

//users
exports.createUser = async (req, res) => {
  try {
    const { first_name, last_name, username, email, password, role, school_id } = req.body;
    // NOTE Hash password
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

//classes
exports.createClass = async (req, res) => {
  try {

    console.log('incoming body: ',req.body);

    const { class_name, room, start_time, end_time, schedule, professorIds } = req.body;
    const newClass = await db.Class.create({ class_name, room, start_time, end_time, schedule });
    
    // If there are professorIds, associate the professors with this class.
    if (professorIds && professorIds.length > 0) {
      await newClass.setProfessors(professorIds);
    }
    
    res.status(201).json({ message: 'Class created', class: newClass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class', details: err.message });
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

exports.enrollStudentsToClass = async (req, res) => {
  try {
    const { classId, studentIds } = req.body;

    const theClass = await db.Class.findByPk(classId);
    if (!theClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    await theClass.setStudents(studentIds);

    res.json({ message: 'Students enrolled successfully', classId, studentIds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to enroll students' });
  }
};


//rfid
exports.createRFIDCard = async (req, res) => {
  try {
    const { card_uid, user_id } = req.body;
    const rfidCard = await db.RFID_Card.create({
      card_uid,
      user_id,
      is_active: true,
      issued_at: new Date()
    });
    res.status(201).json({ message: 'RFID card created', rfidCard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create RFID card' });
  }
};

exports.getRFIDCards = async (req, res) => {
  try {
    const cards = await db.RFID_Card.findAll();
    res.json({ cards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve RFID cards' });
  }
};

exports.updateRFIDCard = async (req, res) => {
  try {
    const cardId = req.params.id;
    await db.RFID_Card.update(req.body, { where: { id: cardId } });
    res.json({ message: 'RFID card updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update RFID card' });
  }
};


exports.deleteRFIDCard = async (req, res) => {
  try {
    const cardId = req.params.id;
    await db.RFID_Card.destroy({ where: { id: cardId } });
    res.json({ message: 'RFID card deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete RFID card' });
  }
};

//audit log test
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await db.Audit_Log.findAll({ order: [['timestamp', 'DESC']] });
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
};