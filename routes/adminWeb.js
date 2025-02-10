const express = require('express');
const router = express.Router();
const adminWebController = require('../controllers/adminWebController');

console.log('Admin Web Controller:', adminWebController);

router.get('/login', adminWebController.showLoginForm);
router.post('/login', adminWebController.login);

router.use((req, res, next) => {
  if (!req.session || !req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
});

router.get('/dashboard', adminWebController.dashboard);
router.get('/logout', adminWebController.logout);

module.exports = router;
