const { GPS_Location, User, Class_Enrollment, Class } = require('../models');
const { Op } = require('sequelize');

// Update user's location
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, classId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            console.error('No user ID in request');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const location = await GPS_Location.create({
            latitude,
            longitude,
            user_id: userId
        });

        // Emit the location update through WebSocket
        if (classId) {
            req.app.get('io').to(`class-${classId}`).emit('location-update', {
                userId,
                latitude,
                longitude,
                timestamp: location.timestamp
            });
        }

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
        const userId = req.user?.id;
        
        if (!userId) {
            console.error('No user ID in request');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!classId) {
            return res.status(400).json({
                success: false,
                message: 'Class ID is required'
            });
        }

        // Verify if the requester is enrolled in or teaching the class
        const classAccess = await Class_Enrollment.findOne({
            where: {
                class_id: classId,
                user_id: userId
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