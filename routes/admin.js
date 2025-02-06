const router = require('express').Router();
const adminController = require('../controllers/adminController');

// USERS MANAGEMENT
router.post('/users', adminController.createUser);
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// CLASS MANAGEMENT
router.post('/classes', adminController.createClass);
router.get('/classes', adminController.getClasses);
router.put('/classes/:id', adminController.updateClass);
router.delete('/classes/:id', adminController.deleteClass);

// AUDIT LOGS
router.get('/audit-logs', adminController.getAuditLogs);

//TODO RFID ENABLE TABLE AND ASSOCIATION 

module.exports = router;