const router = require('express').Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../controllers/authController');  

// PUT /api/user/profile-picture |to update profile pic
router.put('/profile-picture', verifyToken, userController.uploadProfilePic, userController.updateProfilePicture);

module.exports = router;
