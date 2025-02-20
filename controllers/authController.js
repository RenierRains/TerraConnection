const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');
const { logUserEvent } = require('./auditLogger');

const loginFailures = {};

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

exports.login = async (req, res) => {
  const ip = req.ip;
  try {
    const { email, password } = req.body;

    // find
    const user = await db.User.findOne({ where: { email } });

    if (!user) {
      loginFailures[ip] = (loginFailures[ip] || 0) + 1;
      await logSecurityAudit(null, 'LOGIN_FAILED', { email, ip, reason: 'User not found' });
      if (loginFailures[ip] > 5) {
        await logAnomalyAudit(ip, 'MULTIPLE_LOGIN_FAILURES', { ip, count: loginFailures[ip] });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // compre password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      loginFailures[ip] = (loginFailures[ip] || 0) + 1;
      await logSecurityAudit(user.id, 'LOGIN_FAILED', { email, ip, reason: 'Invalid password' });
      if (loginFailures[ip] > 5) {
        await logAnomalyAudit(ip, 'MULTIPLE_LOGIN_FAILURES', { ip, count: loginFailures[ip] });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    loginFailures[ip] = 0;

    // generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'SuperSecretKey',
      { expiresIn: '8h' }
    );
    

    await logUserAudit(user.id, 'LOGIN_SUCCESS', { email });

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

exports.logout = async (req, res) => {
  try {
    if (req.user && req.user.userId) {
      await logUserEvent(req.user.userId, 'LOGOUT', { email: req.user.email });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Logout failed' });
  }
};