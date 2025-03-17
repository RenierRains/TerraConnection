const { GPS_Location, User, Class_Enrollment, Class } = require('../models');
const { Op } = require('sequelize');

// Update user's location
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;  // Assuming user is authenticated

        const location = await GPS_Location.create({
            latitude,
            longitude,
            user_id: userId
        });

        // Emit the location update through WebSocket
        req.app.get('io').emit(`location-update-${userId}`, {
            userId,
            latitude,
            longitude,
            timestamp: location.timestamp
        });

        res.status(200).json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating location'
        });
    }
};

// Get locations of all students in a class
exports.getClassLocations = async (req, res) => {
    try {
        const { classId } = req.params;
        
        // Verify if the requester is enrolled in or teaching the class
        const classAccess = await Class_Enrollment.findOne({
            where: {
                class_id: classId,
                user_id: req.user.id
            }
        });

        if (!classAccess) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this class'
            });
        }

        // Get all students enrolled in the class
        const enrollments = await Class_Enrollment.findAll({
            where: { class_id: classId },
            include: [{
                model: User,
                attributes: ['id', 'name'],
                include: [{
                    model: GPS_Location,
                    limit: 1,
                    order: [['timestamp', 'DESC']],
                    attributes: ['latitude', 'longitude', 'timestamp']
                }]
            }]
        });

        const locations = enrollments.map(enrollment => ({
            studentId: enrollment.User.id,
            studentName: enrollment.User.name,
            location: enrollment.User.GPS_Locations[0] || null
        }));

        res.status(200).json({
            success: true,
            data: locations
        });
    } catch (error) {
        console.error('Error fetching class locations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching class locations'
        });
    }
}; 