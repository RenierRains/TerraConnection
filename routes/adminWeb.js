const express = require('express');
const router = express.Router();
const adminWebController = require('../controllers/adminWebController');

router.get('/login', adminWebController.showLoginForm);
router.post('/login', adminWebController.login);

router.use((req, res, next) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
});

// protected test
router.get('/dashboard', adminWebController.dashboard);
router.get('/users', adminWebController.usersIndex);
router.get('/users/create', adminWebController.usersCreateForm);
router.post('/users', adminWebController.usersCreate);
router.get('/users/:id', adminWebController.usersShow);
router.get('/users/:id/edit', adminWebController.usersEditForm);
router.put('/users/:id', adminWebController.usersEdit);
router.delete('/users/:id', adminWebController.usersDelete);

router.get('/classes', adminWebController.classesIndex);
router.get('/classes/create', adminWebController.classesCreateForm);
router.post('/classes', adminWebController.classesCreate);
router.get('/classes/:id', adminWebController.classesShow);
router.get('/classes/:id/edit', adminWebController.classesEditForm);
router.put('/classes/:id', adminWebController.classesEdit);
router.delete('/classes/:id', adminWebController.classesDelete);

router.get('/rfid-cards', adminWebController.rfidCardsIndex);
router.get('/rfid-cards/create', adminWebController.rfidCardsCreateForm);
router.post('/rfid-cards', adminWebController.rfidCardsCreate);
router.get('/rfid-cards/:id', adminWebController.rfidCardsShow);
router.get('/rfid-cards/:id/edit', adminWebController.rfidCardsEditForm);
router.put('/rfid-cards/:id', adminWebController.rfidCardsEdit);
router.delete('/rfid-cards/:id', adminWebController.rfidCardsDelete);

router.get('/audit-logs', adminWebController.auditLogs);
router.get('/guardian-link', adminWebController.guardianLinkForm);
router.post('/guardian-link', adminWebController.linkGuardianToStudent);

router.get('/logout', adminWebController.logout);

module.exports = router;
