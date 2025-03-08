const router = require('express').Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../controllers/authController');  

// PUT /api/user/profile-picture |to update profile pic
router.put('/profile-picture', verifyToken, userController.uploadProfilePic, userController.updateProfilePicture);

// POST /api/user/fcm-token | to update FCM token
router.post('/fcm-token', verifyToken, userController.updateFcmToken);

module.exports = router;
