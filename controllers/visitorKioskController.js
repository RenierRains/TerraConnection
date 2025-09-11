const { Visitor } = require('../models');
const VisitorFaceService = require('../services/visitorFaceService');
const { Op } = require('sequelize');

// Create a single instance of the face service
const faceService = new VisitorFaceService();

/**
 * Register a new visitor
 * POST /api/kiosk/visitor/register
 */
async function registerVisitor(req, res) {
    try {
        const { name, purpose, faceImage } = req.body;

        // Validate required fields
        if (!name || !purpose) {
            return res.status(400).json({
                success: false,
                error: 'Name and purpose are required fields'
            });
        }

        // Validate name
        if (name.length < 2 || name.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Name must be between 2 and 100 characters'
            });
        }

        // Validate purpose
        if (purpose.length < 5 || purpose.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Purpose must be between 5 and 500 characters'
            });
        }

        // Sanitize inputs
        const sanitizedName = name.trim();
        const sanitizedPurpose = purpose.trim();

        let faceImagePath = null;

        // Process face image if provided
        if (faceImage) {
            try {
                // Validate face image
                const validation = faceService.validateFaceImage(faceImage);
                if (!validation.valid) {
                    return res.status(400).json({
                        success: false,
                        error: validation.error
                    });
                }

                // Create visitor first to get ID for image naming
                const tempVisitor = await Visitor.create({
                    name: sanitizedName,
                    purpose: sanitizedPurpose,
                    status: 'active'
                });

                // Save face image
                faceImagePath = await faceService.saveFaceImage(faceImage, tempVisitor.id);
                
                // Update visitor with face image path
                await tempVisitor.update({ faceImagePath });

                // Audit log
                req.auditLog = {
                    action: 'VISITOR_REGISTER',
                    details: `Visitor registered: ${sanitizedName}`,
                    metadata: {
                        visitorId: tempVisitor.id,
                        name: sanitizedName,
                        purpose: sanitizedPurpose,
                        hasFaceImage: !!faceImagePath
                    }
                };

                return res.status(201).json({
                    success: true,
                    message: 'Visitor registered successfully',
                    data: {
                        id: tempVisitor.id,
                        name: tempVisitor.name,
                        purpose: tempVisitor.purpose,
                        entryTime: tempVisitor.entryTime,
                        status: tempVisitor.status,
                        hasFaceImage: !!faceImagePath
                    }
                });

            } catch (imageError) {
                console.error('Error processing face image:', imageError);
                return res.status(400).json({
                    success: false,
                    error: 'Failed to process face image: ' + imageError.message
                });
            }
        } else {
            // Register visitor without face image
            const visitor = await Visitor.create({
                name: sanitizedName,
                purpose: sanitizedPurpose,
                status: 'active'
            });

            // Audit log
            req.auditLog = {
                action: 'VISITOR_REGISTER',
                details: `Visitor registered without face: ${sanitizedName}`,
                metadata: {
                    visitorId: visitor.id,
                    name: sanitizedName,
                    purpose: sanitizedPurpose,
                    hasFaceImage: false
                }
            };

            return res.status(201).json({
                success: true,
                message: 'Visitor registered successfully (without face verification)',
                data: {
                    id: visitor.id,
                    name: visitor.name,
                    purpose: visitor.purpose,
                    entryTime: visitor.entryTime,
                    status: visitor.status,
                    hasFaceImage: false
                }
            });
        }

    } catch (error) {
        console.error('Error registering visitor:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while registering visitor'
        });
    }
}

/**
 * Process visitor exit with face verification
 * POST /api/kiosk/visitor/exit
 */
async function processExit(req, res) {
    try {
        const { faceImage, faceDescriptor } = req.body;

        if (!faceImage) {
            return res.status(400).json({
                success: false,
                error: 'Face image is required for exit verification'
            });
        }

        if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
            return res.status(400).json({
                success: false,
                error: 'Face descriptor is required for verification. Please ensure face detection is working properly.'
            });
        }

        // Validate face image format
        const validation = faceService.validateFaceImage(faceImage);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error
            });
        }

        // Find all active visitors with face images
        const activeVisitors = await Visitor.findAll({
            where: {
                status: 'active',
                faceImagePath: {
                    [Op.ne]: null
                }
            },
            order: [['entryTime', 'DESC']] // Most recent first
        });

        if (activeVisitors.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No active visitors found with face verification'
            });
        }

        console.log(`Processing exit verification for ${activeVisitors.length} active visitors`);

        // Since we don't store face descriptors in the database (for privacy/storage reasons),
        // we need to return the active visitors list so the frontend can compare
        // the current face descriptor against the stored face images
        
        // For security, we'll return minimal visitor info for frontend comparison
        const visitorList = activeVisitors.map(visitor => ({
            id: visitor.id,
            name: visitor.name,
            faceImagePath: visitor.faceImagePath,
            entryTime: visitor.entryTime
        }));

        return res.status(200).json({
            success: true,
            requiresFrontendMatching: true,
            message: 'Please wait while we verify your identity...',
            data: {
                visitors: visitorList,
                currentFaceDescriptor: faceDescriptor
            }
        });

    } catch (error) {
        console.error('Error processing visitor exit:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while processing exit'
        });
    }
}

/**
 * Complete visitor exit after frontend face matching
 * POST /api/kiosk/visitor/exit/complete
 */
async function completeExit(req, res) {
    try {
        const { visitorId, matchResult } = req.body;

        if (!visitorId || !matchResult) {
            return res.status(400).json({
                success: false,
                error: 'Visitor ID and match result are required'
            });
        }

        // Find the visitor
        const visitor = await Visitor.findByPk(visitorId);
        if (!visitor) {
            return res.status(404).json({
                success: false,
                error: 'Visitor not found'
            });
        }

        if (visitor.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'Visitor is not currently active'
            });
        }

        // Check if face verification passed
        if (!matchResult.match || matchResult.distance >= 0.6) {
            // Face verification failed
            req.auditLog = {
                action: 'VISITOR_EXIT_FAILED',
                details: `Visitor exit verification failed: ${visitor.name}`,
                metadata: {
                    visitorId: visitor.id,
                    name: visitor.name,
                    reason: 'face_verification_failed',
                    similarity: matchResult.similarity || 0,
                    distance: matchResult.distance || 999
                }
            };

            return res.status(403).json({
                success: false,
                error: 'Face verification failed. Please contact security for assistance.',
                data: {
                    verification: {
                        matched: false,
                        similarity: matchResult.similarity || 0,
                        distance: matchResult.distance || 999,
                        threshold: 0.6
                    }
                }
            });
        }

        // Face verification passed - complete the exit
        await visitor.update({
            status: 'exited',
            exitTime: new Date()
        });

        // Calculate visit duration
        const visitDuration = new Date() - new Date(visitor.entryTime);
        const durationMinutes = Math.round(visitDuration / (1000 * 60));

        // Audit log
        req.auditLog = {
            action: 'VISITOR_EXIT',
            details: `Visitor exit verified: ${visitor.name}`,
            metadata: {
                visitorId: visitor.id,
                name: visitor.name,
                entryTime: visitor.entryTime,
                exitTime: visitor.exitTime,
                durationMinutes,
                faceSimilarity: matchResult.similarity,
                faceDistance: matchResult.distance
            }
        };

        return res.status(200).json({
            success: true,
            message: 'Exit verified successfully. Thank you for visiting!',
            data: {
                visitor: {
                    id: visitor.id,
                    name: visitor.name,
                    purpose: visitor.purpose,
                    entryTime: visitor.entryTime,
                    exitTime: visitor.exitTime,
                    durationMinutes
                },
                verification: {
                    matched: true,
                    similarity: matchResult.similarity,
                    distance: matchResult.distance,
                    threshold: 0.6
                }
            }
        });

    } catch (error) {
        console.error('Error completing visitor exit:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while completing exit'
        });
    }
}

/**
 * Get current visitor status (for kiosk display)
 * GET /api/kiosk/visitor/status
 */
async function getVisitorStatus(req, res) {
    try {
        const activeCount = await Visitor.count({
            where: { status: 'active' }
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayVisitors = await Visitor.count({
            where: {
                entryTime: {
                    [Op.gte]: todayStart
                }
            }
        });

        const todayExited = await Visitor.count({
            where: {
                exitTime: {
                    [Op.gte]: todayStart
                },
                status: 'exited'
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                activeVisitors: activeCount,
                todayTotal: todayVisitors,
                todayExited: todayExited,
                timestamp: new Date()
            }
        });

    } catch (error) {
        console.error('Error getting visitor status:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while getting status'
        });
    }
}

/**
 * Get visitor by ID (for verification purposes)
 * GET /api/kiosk/visitor/:id
 */
async function getVisitorById(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Visitor ID is required'
            });
        }

        const visitor = await Visitor.findByPk(id);

        if (!visitor) {
            return res.status(404).json({
                success: false,
                error: 'Visitor not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: visitor.id,
                name: visitor.name,
                purpose: visitor.purpose,
                entryTime: visitor.entryTime,
                exitTime: visitor.exitTime,
                status: visitor.status,
                hasFaceImage: !!visitor.faceImagePath
            }
        });

    } catch (error) {
        console.error('Error getting visitor by ID:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while getting visitor'
        });
    }
}

/**
 * Health check for kiosk
 * GET /api/kiosk/health
 */
async function healthCheck(req, res) {
    try {
        // Check database connection
        await Visitor.findOne({ limit: 1 });

        return res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date(),
            services: {
                database: 'connected',
                faceService: 'available'
            }
        });

    } catch (error) {
        console.error('Health check failed:', error);
        return res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date()
        });
    }
}

module.exports = {
    registerVisitor,
    processExit,
    completeExit,
    getVisitorStatus,
    getVisitorById,
    healthCheck
};