const { Student, Guardian, Location } = require('../models');
const { Op } = require('sequelize');

const guardianLocationController = {
    // Get student's location sharing status
    getGuardianSharingStatus: async (req, res) => {
        try {
            const studentId = req.user.id;
            const location = await Location.findOne({
                where: { 
                    studentId,
                    type: 'guardian'
                }
            });

            res.json({
                isSharing: !!location,
                lastUpdated: location ? location.updatedAt : null
            });
        } catch (error) {
            console.error('Error getting guardian sharing status:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Start sharing location with guardian
    startGuardianSharing: async (req, res) => {
        try {
            const studentId = req.user.id;
            
            // Check if student has a guardian
            const student = await Student.findOne({
                where: { id: studentId },
                include: [{ model: Guardian }]
            });

            if (!student.Guardian) {
                return res.status(400).json({ message: 'No guardian associated with this student' });
            }

            // Create or update location sharing
            const [location, created] = await Location.findOrCreate({
                where: { 
                    studentId,
                    type: 'guardian'
                },
                defaults: {
                    isSharing: true
                }
            });

            if (!created) {
                await location.update({ isSharing: true });
            }

            res.json({ message: 'Location sharing with guardian started' });
        } catch (error) {
            console.error('Error starting guardian location sharing:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Stop sharing location with guardian
    stopGuardianSharing: async (req, res) => {
        try {
            const studentId = req.user.id;
            
            await Location.update(
                { isSharing: false },
                { 
                    where: { 
                        studentId,
                        type: 'guardian'
                    }
                }
            );

            res.json({ message: 'Location sharing with guardian stopped' });
        } catch (error) {
            console.error('Error stopping guardian location sharing:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get student location (for guardian)
    getStudentLocation: async (req, res) => {
        try {
            const guardianId = req.user.id;
            
            // Find student associated with guardian
            const guardian = await Guardian.findOne({
                where: { id: guardianId },
                include: [{
                    model: Student,
                    include: [{
                        model: Location,
                        where: { type: 'guardian' },
                        required: false
                    }]
                }]
            });

            if (!guardian || !guardian.Student) {
                return res.status(404).json({ message: 'No student found for this guardian' });
            }

            const student = guardian.Student;
            const location = student.Locations?.[0];

            res.json({
                studentId: student.id,
                name: `${student.firstName} ${student.lastName}`,
                isSharing: location?.isSharing || false,
                latitude: location?.latitude,
                longitude: location?.longitude,
                lastUpdated: location?.updatedAt
            });
        } catch (error) {
            console.error('Error getting student location:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Update student location
    updateLocation: async (req, res) => {
        try {
            const studentId = req.user.id;
            const { latitude, longitude } = req.body;

            if (!latitude || !longitude) {
                return res.status(400).json({ message: 'Latitude and longitude are required' });
            }

            await Location.update(
                { 
                    latitude,
                    longitude,
                    lastUpdated: new Date()
                },
                { 
                    where: { 
                        studentId,
                        type: 'guardian',
                        isSharing: true
                    }
                }
            );

            res.json({ message: 'Location updated successfully' });
        } catch (error) {
            console.error('Error updating location:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = guardianLocationController; 