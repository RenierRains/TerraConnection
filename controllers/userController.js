const multer = require('multer');
const path = require('path');
const db = require('../models');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/profile_pics/');
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = '/uploads/profile_pics/' + req.file.filename;
    const userId = req.user.userId;

    // Fetch the original user record to get the current profile picture
    const originalUser = await db.User.findByPk(userId);
    const originalProfilePic = originalUser.profile_picture;

    // Update the profile picture field
    await db.User.update({ profile_picture: filePath }, { where: { id: userId } });

    // Log the audit event with both the original and updated values
    const { logAuditEvent } = require('./auditLogger');
    await logAuditEvent(userId, 'USER_PROFILE_PICTURE_UPDATED', {
      original: originalProfilePic,
      updated: filePath
    });

    res.json({ message: "Profile picture updated", profile_picture: filePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
};

exports.updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fcm_token = req.body.fcm_token || req.body.fcmToken;

    if (!fcm_token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    await db.User.update(
      { fcm_token },
      { where: { id: userId } }
    );

    res.json({ message: 'FCM token updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
};

exports.uploadProfilePic = upload.single('profile_picture');
