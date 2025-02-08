const router = require('express').Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../controllers/authController');

router.use(verifyToken, adminController.verifyAdmin);

router.post('/users', adminController.createUser);
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

router.post('/classes', adminController.createClass);
router.get('/classes', adminController.getClasses);
router.put('/classes/:id', adminController.updateClass);
router.delete('/classes/:id', adminController.deleteClass);
router.post('/classes/enroll', adminController.enrollStudentsToClass);


//TODO: change 
router.get('/audit-logs', adminController.getAuditLogs);

router.post('/rfid-cards', adminController.createRFIDCard);
router.get('/rfid-cards', adminController.getRFIDCards);
router.put('/rfid-cards/:id', adminController.updateRFIDCard);
router.delete('/rfid-cards/:id', adminController.deleteRFIDCard);

module.exports = router;