const { GPS_Location, User, Guardian_Student, sequelize } = require('../models');
const { logLocationAudit } = require('./auditLogger');

// Update guardian's location
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, studentId } = req.body;
        const guardianId = req.user?.id || req.user?.userId;

        if (!guardianId) {
            await logLocationAudit(null, 'GUARDIAN_UPDATE', {
                error: 'Guardian not authenticated',
                status: 'failed',
                locationContext: { studentId }
            }, req);
            return res.status(401).json({
                success: false,
                message: 'Guardian not authenticated'
            });
        }

        if (!latitude || !longitude || !studentId) {
            await logLocationAudit(guardianId, 'GUARDIAN_UPDATE', {
                error: 'Missing required fields',
                status: 'failed',
                locationContext: { studentId }
            }, req);
            return res.status(400).json({
                success: false,
                message: 'Latitude, longitude, and studentId are required'
            });
        }

        // Verify if the guardian is linked to the student
        const guardianStudent = await Guardian_Student.findOne({
            where: {
                guardian_id: guardianId,
                student_id: studentId
            }
        });

        if (!guardianStudent) {
            await logLocationAudit(guardianId, 'GUARDIAN_UPDATE', {
                error: 'Not authorized for student',
                status: 'denied',
                locationContext: { studentId }
            }, req);
            return res.status(403).json({
                success: false,
                message: 'Not authorized to share location with this student'
            });
        }

        const location = await GPS_Location.create({
            latitude,
            longitude,
            user_id: guardianId,
            student_id: studentId,
            type: 'guardian',
            timestamp: new Date()
        });

        // Get guardian details for the update message
        const guardian = await User.findByPk(guardianId);
        const updateMessage = {
            type: 'location-update',
            guardianId: guardianId.toString(),
            guardianName: `${guardian.first_name} ${guardian.last_name}`,
            role: 'guardian',
            latitude,
            longitude,
            timestamp: location.timestamp
        };

        // Emit the location update through WebSocket
        const wss = req.app.get('wss');
        wss.clients.forEach(function each(client) {
            try {
                if (client.studentId && client.studentId.toString() === studentId.toString()) {
                    client.send(JSON.stringify(updateMessage));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        await logLocationAudit(guardianId, 'GUARDIAN_UPDATE', {
            status: 'success',
            locationContext: {
                studentId,
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
        console.error('Error updating guardian location:', error);
        await logLocationAudit(req.user?.id || req.user?.userId, 'GUARDIAN_UPDATE', {
            error: error.message,
            status: 'failed',
            locationContext: { studentId: req.body?.studentId }
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
        const { studentId } = req.body;
        const guardianId = req.user?.id || req.user?.userId;

        if (!guardianId) {
            await logLocationAudit(null, 'GUARDIAN_STOP', {
                error: 'Guardian not authenticated',
                status: 'failed',
                locationContext: { studentId }
            }, req);
            return res.status(401).json({
                success: false,
                message: 'Guardian not authenticated'
            });
        }

        if (!studentId) {
            await logLocationAudit(guardianId, 'GUARDIAN_STOP', {
                error: 'Student ID required',
                status: 'failed'
            }, req);
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        // Get guardian details for the stop message
        const guardian = await User.findByPk(guardianId);
        const stopMessage = {
            type: 'stop-sharing',
            guardianId: guardianId.toString(),
            guardianName: `${guardian.first_name} ${guardian.last_name}`,
            role: 'guardian'
        };

        // Emit the stop message through WebSocket
        const wss = req.app.get('wss');
        wss.clients.forEach(function each(client) {
            try {
                if (client.studentId && client.studentId.toString() === studentId.toString()) {
                    client.send(JSON.stringify(stopMessage));
                }
            } catch (err) {
                console.error('Error sending WebSocket message:', err);
            }
        });

        await logLocationAudit(guardianId, 'GUARDIAN_STOP', {
            status: 'success',
            locationContext: { studentId }
        }, req);

        res.status(200).json({
            success: true,
            message: 'Location sharing stopped'
        });
    } catch (error) {
        console.error('Error stopping guardian location sharing:', error);
        await logLocationAudit(req.user?.id || req.user?.userId, 'GUARDIAN_STOP', {
            error: error.message,
            status: 'failed',
            locationContext: { studentId: req.body?.studentId }
        }, req);
        res.status(500).json({
            success: false,
            message: 'Error stopping location sharing'
        });
    }
};

// Get student's location
exports.getStudentLocation = async (req, res) => {
    try {
        const { studentId } = req.params;
        const guardianId = req.user?.id || req.user?.userId;

        if (!guardianId) {
            return res.status(401).json({
                success: false,
                message: 'Guardian not authenticated'
            });
        }

        // Verify if the guardian is linked to the student
        const guardianStudent = await Guardian_Student.findOne({
            where: {
                guardian_id: guardianId,
                student_id: studentId
            }
        });

        if (!guardianStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this student\'s location'
            });
        }

        // Get the student's most recent location
        const location = await GPS_Location.findOne({
            where: {
                user_id: studentId,
                type: 'student'
            },
            order: [['timestamp', 'DESC']]
        });

        if (!location) {
            return res.status(404).json({
                success: false,
                message: 'No location data available for this student'
            });
        }

        res.status(200).json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('Error getting student location:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving student location'
        });
    }
}; 