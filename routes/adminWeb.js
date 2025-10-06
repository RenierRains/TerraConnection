const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminWebController = require('../controllers/adminWebController');
const exportController = require('../controllers/exportController');
const upload = require('../middleware/upload');
const { upload: profileUpload } = require('../middleware/profileUpload');

// Create multer instance for handling multipart forms without file uploads
const formUpload = multer();

router.get('/login', adminWebController.showLoginForm);
router.post('/login', adminWebController.login);

router.use((req, res, next) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
});

// protected test

router.get('/dashboard/data', adminWebController.getTimeSeriesData);
router.get('/dashboard/departments', adminWebController.getDepartmentData);
router.get('/dashboard/export', exportController.exportDashboardData);

router.get('/users/import', (req, res) => {
  res.render('admin/users/import', { 
    title: 'Import Users',
    admin: req.session.admin
  });
});
router.post('/users/import', upload.single('importFile'), adminWebController.importUsers);

router.get('/dashboard', adminWebController.dashboard);
router.get('/users', adminWebController.usersIndex);
router.get('/users/create', adminWebController.usersCreateForm);
router.post('/users', profileUpload.single('profile_picture'), adminWebController.usersCreate);
router.get('/users/:id', adminWebController.usersShow);
router.get('/users/:id/edit', adminWebController.usersEditForm);
router.get('/users/:id/edit-content', adminWebController.usersEditContent);
router.put('/users/:id', profileUpload.single('profile_picture'), adminWebController.usersEdit);
router.delete('/users/:id', adminWebController.usersDelete);

// Bulk actions
router.post('/users/bulk-delete', adminWebController.usersBulkDelete);
router.post('/users/bulk-export', adminWebController.usersBulkExport);
router.post('/users/bulk-department-change', adminWebController.usersBulkDepartmentChange);

// Quick edit
router.post('/users/quick-edit', adminWebController.usersQuickEdit);

router.get('/departments', adminWebController.departmentsIndex);
router.get('/departments/create', adminWebController.departmentsCreateForm);
router.post('/departments', formUpload.none(), adminWebController.departmentsCreate);
router.get('/departments/statistics', adminWebController.departmentsStatistics);
router.get('/departments/:id', adminWebController.departmentsShow);
router.get('/departments/:id/statistics', adminWebController.departmentStatistics);
router.get('/departments/:code/activity', adminWebController.departmentActivity);
router.get('/departments/:id/edit', adminWebController.departmentsEditForm);
router.put('/departments/:id', formUpload.none(), adminWebController.departmentsEdit);
router.delete('/departments/:id', adminWebController.departmentsDelete);

router.get('/classes/import', (req, res) => {
  res.render('admin/classes/import', { 
    title: 'Import Classes',
    admin: req.session.admin
  });
});
router.post('/classes/import', upload.single('importFile'), adminWebController.importClasses);

router.get('/classes', adminWebController.classesIndex);
router.get('/classes/create', adminWebController.classesCreateForm);
router.post('/classes', formUpload.none(), adminWebController.classesCreate);
router.get('/classes/statistics', adminWebController.classesStatistics);
router.get('/classes/status-capacity', adminWebController.classesStatusCapacity);
router.get('/classes/schedule', adminWebController.classesSchedule);
router.get('/classes/:id', adminWebController.classesShow);
router.get('/classes/:id/edit', adminWebController.classesEditForm);
router.put('/classes/:id', formUpload.none(), adminWebController.classesEdit);
router.delete('/classes/:id', adminWebController.classesDelete);

router.get('/rfid-cards', adminWebController.rfidCardsIndex);
router.get('/rfid-cards/create', adminWebController.rfidCardsCreateForm);
router.post('/rfid-cards', adminWebController.rfidCardsCreate);
router.get('/rfid-cards/:id', adminWebController.rfidCardsShow);
router.get('/rfid-cards/:id/edit', adminWebController.rfidCardsEditForm);
router.put('/rfid-cards/:id', adminWebController.rfidCardsEdit);
router.post('/rfid-cards/:id/toggle-status', adminWebController.rfidCardsToggleStatus);
router.get('/rfid-cards/:id/replace', adminWebController.rfidCardsReplaceForm);
router.post('/rfid-cards/:id/replace', adminWebController.rfidCardsReplace);
router.delete('/rfid-cards/:id', adminWebController.rfidCardsDelete);

// RFID Cards bulk operations
router.post('/rfid-cards/bulk-activate', adminWebController.rfidCardsBulkActivate);
router.post('/rfid-cards/bulk-deactivate', adminWebController.rfidCardsBulkDeactivate);
router.post('/rfid-cards/bulk-delete', adminWebController.rfidCardsBulkDelete);
router.post('/rfid-cards/bulk-export', adminWebController.rfidCardsBulkExport);

// RFID Cards analytics and export
router.get('/rfid-cards-analytics', adminWebController.rfidCardsAnalytics);
router.get('/rfid-cards/export', adminWebController.rfidCardsExport);

// RFID Cards statistics API
router.get('/rfid-cards/statistics', adminWebController.rfidCardsStatistics);

router.get('/audit-logs', adminWebController.auditLogs);
router.get('/audit-logs/export', exportController.exportAuditLogs);

// Guardian Links Management
router.get('/guardian-link', adminWebController.guardianLinksIndex);
router.get('/guardian-link/new', adminWebController.guardianLinkNewForm);
router.post('/guardian-link', adminWebController.guardianLinkCreate);
router.get('/guardian-link/:id', adminWebController.guardianLinkShow);
router.get('/guardian-link/:id/edit', adminWebController.guardianLinkEditForm);
router.put('/guardian-link/:id', adminWebController.guardianLinkUpdate);
router.delete('/guardian-link/:id', adminWebController.guardianLinkDelete);

// Guardian Links API endpoints
router.get('/guardian-links/statistics', adminWebController.guardianLinksStatistics);
router.post('/guardian-links/bulk-delete', adminWebController.guardianLinksBulkDelete);
router.post('/guardian-links/bulk-export', adminWebController.guardianLinksBulkExport);
router.post('/guardian-links/quick-edit', adminWebController.guardianLinksQuickEdit);
router.get('/guardian-links/:id/export', adminWebController.guardianLinkExport);
router.post('/guardian-links/:id/notify', adminWebController.guardianLinkNotify);

router.get('/students/search', adminWebController.searchStudents);
router.get('/professors/search', adminWebController.searchProfessors);
router.get('/guardians/search', adminWebController.searchGuardians);

router.get('/global-search', adminWebController.globalSearch);

router.get('/logout', adminWebController.logout);

module.exports = router;
