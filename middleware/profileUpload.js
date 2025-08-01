const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/profile_pics directory exists
const uploadDir = path.join(__dirname, '../uploads/profile_pics');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename: userId-timestamp.ext or temp-timestamp.ext for create
    const ext = path.extname(file.originalname).toLowerCase();
    const userId = req.params.id || 'temp';
    const timestamp = Date.now();
    cb(null, `${userId}-${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common image formats
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    // Check MIME type as well for additional security
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. MIME type does not match extension.'));
    }
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

const profileUpload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1 // Only one file at a time
  }
});

// Helper function to delete old profile picture
const deleteOldProfilePicture = (filename) => {
  if (filename) {
    // Extract just the filename if it's a full path
    const actualFilename = filename.startsWith('/uploads/profile_pics/') 
      ? filename.replace('/uploads/profile_pics/', '') 
      : filename;
    
    const filepath = path.join(uploadDir, actualFilename);
    fs.unlink(filepath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('Error deleting old profile picture:', err);
      }
    });
  }
};

// Helper function to get profile picture URL
const getProfilePictureUrl = (filename) => {
  return filename ? `/uploads/profile_pics/${filename}` : null;
};

module.exports = {
  upload: profileUpload,
  deleteOldProfilePicture,
  getProfilePictureUrl
}; 