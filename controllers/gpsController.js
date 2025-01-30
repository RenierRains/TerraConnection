const db = require('../models');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'SuperSecretKey', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

exports.verifyToken = verifyToken;

exports.shareLocation = async (req, res) => {
  try {
    const userId = req.user.userId;  // from the decoded token
    const { latitude, longitude } = req.body;

    // maybe add
    // if (req.user.role !== 'student') {
    //   return res.status(403).json({ error: 'Only students can share location' });
    // }

    const newLocation = await db.GPS_Location.create({
      user_id: userId,
      latitude,
      longitude
    });

    res.json({ message: 'Location shared', location: newLocation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to share location' });
  }
};
