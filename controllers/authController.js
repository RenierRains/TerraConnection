const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');

exports.verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SuperSecretKey');
    req.user = decoded;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

exports.register = async (req, res) => {
  try {
    const { first_name, last_name, username, email, password, role, school_id } = req.body;

    // check if user exists
    const existingUser = await db.User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // create user
    const newUser = await db.User.create({
      first_name,
      last_name,
      username,
      email,
      password_hash,
      role,       // 'student','professor','guardian','admin'
      school_id   // nullable
    });

    res.status(201).json({ message: 'User registered', user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.registerAdmin = async (req, res) => {
  try {
    // Check if any admin account exists
    const adminExists = await db.User.findOne({ where: { role: 'admin' } });
    if (adminExists) {
      return res.status(400).json({ error: 'Admin account already exists.' });
    }
    const { first_name, last_name, email, password } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const admin = await db.User.create({
      first_name,
      last_name,
      email,
      password_hash,
      role: 'admin'
    });
    res.status(201).json({ message: 'Admin account created', admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // find
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // compre password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'SuperSecretKey',
      { expiresIn: '8h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  } 
};

exports.getMe = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.userId, {
      attributes: { exclude: ['password_hash'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve user info' });
  }
};