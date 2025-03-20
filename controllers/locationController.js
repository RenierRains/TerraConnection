const { GPS_Location, User, Class_Enrollment, Class } = require('../models');
const { Op } = require('sequelize');

// Helper function to get active users count
async function getActiveUsersCount(classId) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Get the latest location for each user who is enrolled in the class
    const latestLocations = await GPS_Location.findAll({
        attributes: ['user_id', 'timestamp'],
        where: {
            timestamp: {
                [Op.gte]: fiveMinutesAgo
            }
        },
        include: [{
            model: User,
            required: true,
            attributes: ['id'],
            include: [{
                model: Class,
                as: 'studentClasses',
                required: true,
                where: { id: classId },
                through: {
                    model: Class_Enrollment,
                    attributes: []
                }
            }]
        }],
        group: ['user_id', 'timestamp', 'User.id', 'User.studentClasses.id'],
        order: [['timestamp', 'DESC']]
    });

    // Count unique users with recent locations
    const uniqueUsers = new Set();
    latestLocations.forEach(location => {
        uniqueUsers.add(location.user_id);
    });

    return uniqueUsers.size;
}

// Helper function to broadcast active users count
async function broadcastActiveUsersCount(classId, wss, io) {
    try {
        const count = await getActiveUsersCount(classId);
        console.log(`Broadcasting active users count for class ${classId}: ${count}`);
        
        const message = {
            type: 'activeUsers',
            classId: classId.toString(),
            count
        };

        // Broadcast through WebSocket
        wss.clients.forEach(function each(client) {
            try {
                if (client.classId === classId) {
                    client.send(JSON.stringify(message));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        // Broadcast through Socket.IO
        io.to(`class-${classId}`).emit('activeUsers', message);
    } catch (error) {
        console.error('Error in broadcastActiveUsersCount:', error);
    }
}

// Update user's location
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, classId } = req.body;
        console.log('Location update request:', { latitude, longitude, classId });
        console.log('Request user object:', req.user);
        
        const userId = req.user?.id || req.user?.userId;

        if (!userId) {
            console.error('No user ID in request. User object:', req.user);
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!latitude || !longitude || !classId) {
            return res.status(400).json({
                success: false,
                message: 'Latitude, longitude, and classId are required'
            });
        }

        // Verify if the user is enrolled in the class
        const enrollment = await Class_Enrollment.findOne({
            where: {
                class_id: classId,
                student_id: userId
            }
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to share location in this class'
            });
        }

        const location = await GPS_Location.create({
            latitude,
            longitude,
            user_id: userId,
            timestamp: new Date() // Ensure timestamp is set
        });

        console.log('Created location:', location.toJSON());

        // Get user details for the update message
        const user = await User.findByPk(userId, {
            attributes: ['id', 'first_name', 'last_name', 'profile_picture']
        });

        const updateMessage = {
            type: 'location-update',
            studentId: userId.toString(),
            studentName: `${user.first_name} ${user.last_name}`,
            profilePicture: user.profile_picture,
            latitude,
            longitude,
            timestamp: location.timestamp
        };

        // Emit the location update through Socket.IO and WebSocket
        const io = req.app.get('io');
        const wss = req.app.get('wss');
        
        console.log('Broadcasting location update for class:', classId);
        
        // Broadcast through WebSocket
        wss.clients.forEach(function each(client) {
            try {
                if (client.classId === classId) {
                    client.send(JSON.stringify(updateMessage));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        // Broadcast through Socket.IO
        io.to(`class-${classId}`).emit('location-update', updateMessage);

        // Update active users count
        await broadcastActiveUsersCount(classId, wss, io);

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

// Stop sharing location
exports.stopSharing = async (req, res) => {
    try {
        const { classId } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) {
            console.error('No user ID in request. User object:', req.user);
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

        // Get user details for the stop message
        const user = await User.findByPk(userId, {
            attributes: ['id', 'first_name', 'last_name']
        });

        const stopMessage = {
            type: 'stop-sharing',
            studentId: userId.toString(),
            studentName: `${user.first_name} ${user.last_name}`
        };

        // Emit messages through Socket.IO and WebSocket
        const io = req.app.get('io');
        const wss = req.app.get('wss');
        
        // Broadcast through WebSocket
        wss.clients.forEach(function each(client) {
            try {
                if (client.classId === classId) {
                    client.send(JSON.stringify(stopMessage));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        // Broadcast through Socket.IO
        io.to(`class-${classId}`).emit('stop-sharing', stopMessage);

        // Update active users count
        await broadcastActiveUsersCount(classId, wss, io);

        res.status(200).json({
            success: true,
            message: 'Location sharing stopped'
        });
    } catch (error) {
        console.error('Error stopping location sharing:', error);
        res.status(500).json({
            success: false,
            message: 'Error stopping location sharing'
        });
    }
};

// Get locations of all students in a class
exports.getClassLocations = async (req, res) => {
    try {
        const { classId } = req.params;
        console.log('Request user object:', req.user);
        
        const userId = req.user?.id || req.user?.userId;
        
        if (!userId) {
            console.error('No user ID in request. User object:', req.user);
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
                student_id: userId
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
                as: 'studentData',
                attributes: ['id', 'first_name', 'last_name', 'profile_picture'],
                include: [{
                    model: GPS_Location,
                    limit: 1,
                    order: [['timestamp', 'DESC']],
                    attributes: ['latitude', 'longitude', 'timestamp']
                }]
            }]
        });

        // Get current timestamp for filtering active locations
        const currentTime = new Date();
        const fiveMinutesAgo = new Date(currentTime - 5 * 60 * 1000);

        const locations = enrollments.map(enrollment => {
            const latestLocation = enrollment.studentData.GPS_Locations[0];
            const isActive = latestLocation && new Date(latestLocation.timestamp) >= fiveMinutesAgo;
            
            return {
                studentId: enrollment.studentData.id.toString(),
                studentName: `${enrollment.studentData.first_name} ${enrollment.studentData.last_name}`,
                profilePicture: enrollment.studentData.profile_picture,
                latitude: isActive ? latestLocation.latitude : null,
                longitude: isActive ? latestLocation.longitude : null,
                timestamp: isActive ? latestLocation.timestamp : null
            };
        }).filter(loc => loc.latitude !== null && loc.longitude !== null);

        // Send initial active users count along with locations
        const io = req.app.get('io');
        const wss = req.app.get('wss');
        await broadcastActiveUsersCount(classId, wss, io);

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