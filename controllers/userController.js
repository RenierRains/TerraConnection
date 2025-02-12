const multer = require('multer');
const path = require('path');
const db = require('../models');

// Set up storage for uploaded files.
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Ensure this folder exists in your project root.
    cb(null, 'uploads/profile_pics/');
  },
  filename: function(req, file, cb) {
    // Create a unique filename.
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

    await db.User.update({ profile_picture: filePath }, { where: { id: userId } });
    res.json({ message: "Profile picture updated", profile_picture: filePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
};

exports.uploadProfilePic = upload.single('profile_picture');
