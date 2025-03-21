const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded); // Debug log
        
        if (!decoded.userId && !decoded.id) {
            console.error('Token missing user ID. Token contents:', decoded);
            return res.status(401).json({ message: 'Invalid token format - missing user ID' });
        }
        
        req.user = {
            id: decoded.userId || decoded.id, // Handle both possible field names
            role: decoded.role
        };
        
        console.log('Set user object:', req.user); // Debug log
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

const isStudent = (req, res, next) => {
    if (!req.user || req.user.role !== 'student') {
        return res.status(403).json({ message: 'Access denied. Student role required.' });
    }
    next();
};

const isGuardian = (req, res, next) => {
    if (!req.user || req.user.role !== 'guardian') {
        return res.status(403).json({ message: 'Access denied. Guardian role required.' });
    }
    next();
};

module.exports = {
    authenticateToken,
    isStudent,
    isGuardian
}; 