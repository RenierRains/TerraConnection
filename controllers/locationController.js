const { GPS_Location, User, Class_Enrollment, Class, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logLocationAudit } = require('./auditLogger');

// Helper function to get active users count
exports.getActiveUsersCount = async function(classId) {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    
    try {
        // Get the count of users with recent locations for this specific class
        const result = await sequelize.query(`
            SELECT COUNT(DISTINCT gl.user_id) as count
            FROM GPS_Locations gl
            INNER JOIN Class_Enrollments ce ON gl.user_id = ce.student_id
            WHERE ce.class_id = :classId
            AND gl.class_id = :classId
            AND gl.timestamp >= :oneMinuteAgo
            AND gl.id IN (
                SELECT MAX(gl2.id)
                FROM GPS_Locations gl2
                WHERE gl2.user_id = gl.user_id
                AND gl2.class_id = :classId
                GROUP BY gl2.user_id
            )
        `, {
            replacements: { 
                classId: classId,
                oneMinuteAgo: oneMinuteAgo.toISOString()
            },
            type: sequelize.QueryTypes.SELECT
        });

        return result[0].count;
    } catch (error) {
        console.error('Error in getActiveUsersCount:', error);
        return 0;
    }
}

// Helper function to broadcast active users count
async function broadcastActiveUsersCount(classId, wss, io) {
    try {
        const count = await exports.getActiveUsersCount(classId);
        console.log(`Broadcasting active users count for class ${classId}: ${count}`);
        
        const message = {
            type: 'activeUsers',
            classId: classId.toString(),
            count: count
        };

        // Broadcast through WebSocket
        wss.clients.forEach(function each(client) {
            try {
                if (client.classId && client.classId.toString() === classId.toString()) {
                    console.log('Sending active users count to client in class:', client.classId);
                    client.send(JSON.stringify(message));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        // Broadcast through Socket.IO
        io.to(`class-${classId}`).emit('activeUsers', {
            type: 'activeUsers',
            classId: classId.toString(),
            count: count
        });

        console.log('Broadcasting message:', message);
    } catch (error) {
        console.error('Error in broadcastActiveUsersCount:', error);
    }
}

// Update user's location
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, classId, accuracy, provider } = req.body;
        console.log('Location update request:', { latitude, longitude, classId });
        
        const userId = req.user?.id || req.user?.userId;

        if (!userId) {
            console.error('No user ID in request. User object:', req.user);
            await logLocationAudit(null, 'UPDATE', {
                error: 'User not authenticated',
                status: 'failed',
                locationContext: { classId }
            }, req);
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!latitude || !longitude || !classId) {
            await logLocationAudit(userId, 'UPDATE', {
                error: 'Missing required fields',
                status: 'failed',
                locationContext: { classId }
            }, req);
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
            await logLocationAudit(userId, 'UPDATE', {
                error: 'Not authorized for class',
                status: 'denied',
                locationContext: { classId }
            }, req);
            return res.status(403).json({
                success: false,
                message: 'Not authorized to share location in this class'
            });
        }

        const location = await GPS_Location.create({
            latitude,
            longitude,
            user_id: userId,
            class_id: classId,
            timestamp: new Date()
        });

        // Get user details for the update message
        const user = await User.findByPk(userId, {
            attributes: ['id', 'first_name', 'last_name', 'profile_picture', 'role']
        });

        const updateMessage = {
            type: 'location-update',
            studentId: userId.toString(),
            studentName: `${user.first_name} ${user.last_name}`,
            profilePicture: user.profile_picture,
            role: user.role,
            latitude,
            longitude,
            timestamp: location.timestamp
        };

        // Emit the location update through Socket.IO and WebSocket
        const io = req.app.get('io');
        const wss = req.app.get('wss');
        
        // Broadcast through WebSocket and Socket.IO
        wss.clients.forEach(function each(client) {
            try {
                if (client.classId && client.classId.toString() === classId.toString()) {
                    client.send(JSON.stringify(updateMessage));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        io.to(`class-${classId}`).emit('location-update', updateMessage);

        // Update active users count
        await broadcastActiveUsersCount(classId, wss, io);

        await logLocationAudit(userId, 'UPDATE', {
            status: 'success',
            accuracy,
            provider,
            locationContext: {
                classId,
                latitude,
                longitude,
                timestamp: location.timestamp
            }
        }, req);

        res.status(200).json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('Error updating location:', error);
        await logLocationAudit(req.user?.id || req.user?.userId, 'UPDATE', {
            error: error.message,
            status: 'failed',
            locationContext: { classId: req.body?.classId }
        }, req);
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
            await logLocationAudit(null, 'TRACKING_STOP', {
                error: 'User not authenticated',
                status: 'failed',
                locationContext: { classId }
            }, req);
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!classId) {
            await logLocationAudit(userId, 'TRACKING_STOP', {
                error: 'Class ID required',
                status: 'failed'
            }, req);
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
        
        // Broadcast through WebSocket and Socket.IO
        wss.clients.forEach(function each(client) {
            try {
                if (client.classId === classId) {
                    client.send(JSON.stringify(stopMessage));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        io.to(`class-${classId}`).emit('stop-sharing', stopMessage);

        // Update active users count
        await broadcastActiveUsersCount(classId, wss, io);

        await logLocationAudit(userId, 'TRACKING_STOP', {
            status: 'success',
            locationContext: {
                classId,
                timestamp: new Date()
            }
        }, req);

        res.status(200).json({
            success: true,
            message: 'Location sharing stopped'
        });
    } catch (error) {
        console.error('Error stopping location sharing:', error);
        await logLocationAudit(req.user?.id || req.user?.userId, 'TRACKING_STOP', {
            error: error.message,
            status: 'failed',
            locationContext: { classId: req.body?.classId }
        }, req);
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
                attributes: ['id', 'first_name', 'last_name', 'profile_picture', 'role'],
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
        const oneMinuteAgo = new Date(currentTime - 1 * 60 * 1000);

        const locations = enrollments.map(enrollment => {
            const latestLocation = enrollment.studentData.GPS_Locations[0];
            const isActive = latestLocation && new Date(latestLocation.timestamp) >= oneMinuteAgo;
            
            return {
                studentId: enrollment.studentData.id.toString(),
                studentName: `${enrollment.studentData.first_name} ${enrollment.studentData.last_name}`,
                profilePicture: enrollment.studentData.profile_picture,
                role: enrollment.studentData.role,
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