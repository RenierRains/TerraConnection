const db = require('../models');
const bcrypt = require('bcrypt');

exports.showLoginForm = (req, res) => {
  res.render('admin/login');
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await db.User.findOne({ where: { email, role: 'admin' } });
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.render('admin/login', { error: 'Invalid credentials or not an admin' });
    }

    req.session.admin = admin;
    return res.redirect('/admin/dashboard');
  } catch (error) {
    console.error(error);
    res.render('admin/login', { error: 'Login failed' });
  }
};

exports.dashboard = (req, res) => {
  // Ensure admin is logged in
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  res.render('admin/dashboard', { admin: req.session.admin });
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};