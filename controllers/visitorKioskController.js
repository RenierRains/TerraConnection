const { Visitor } = require('../models');
const { Op } = require('sequelize');

const MIN_CARD_UID_LENGTH = 4;
const MAX_CARD_UID_LENGTH = 128;

const ALLOWED_PURPOSES = [
    'Finance',
    'Admission/Enrollment',
    'Seminar/Workshop/Conference',
    'Guest Lecture',
    'Research Collaboration / Data Gathering',
    'Campus Tour',
    'Visiting a Student / Relative',
    'Alumni Visit',
    'Dropping Off or Picking Up Items'
];

/**
 * Normalize raw RFID input from scanner into a consistent value for storage/lookup.
 * Removes whitespace and non-alphanumeric characters, then uppercases the result.
 */
function normalizeCardUid(value) {
    if (value === undefined || value === null) {
        return '';
    }

    const normalized = String(value)
        .trim()
        .replace(/[^0-9a-z]/gi, '')
        .toUpperCase();

    return normalized;
}

function validateBasicFields(name, purpose, cardUid) {
    if (!name || !purpose || !cardUid) {
        return 'Name, purpose, and visitor pass are required fields';
    }

    const sanitizedName = name.trim();
    const sanitizedPurpose = purpose.trim();

    if (sanitizedName.length < 2 || sanitizedName.length > 100) {
        return 'Name must be between 2 and 100 characters';
    }

    if (!ALLOWED_PURPOSES.includes(sanitizedPurpose)) {
        return 'Select a valid purpose from the list';
    }

    if (cardUid.length < MIN_CARD_UID_LENGTH || cardUid.length > MAX_CARD_UID_LENGTH) {
        return `Visitor pass must be between ${MIN_CARD_UID_LENGTH} and ${MAX_CARD_UID_LENGTH} characters`;
    }

    return null;
}

function calculateVisitDurationMinutes(entryTime, exitTime) {
    if (!entryTime || !exitTime) {
        return 0;
    }

    const start = new Date(entryTime);
    const end = new Date(exitTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    const durationMs = end.getTime() - start.getTime();
    return Math.max(0, Math.round(durationMs / (1000 * 60)));
}

/**
 * Register a new visitor with an RFID visitor pass
 * POST /api/kiosk/visitor/register
 */
async function registerVisitor(req, res) {
    try {
        const { name, purpose, rfidCardUid } = req.body;

        const normalizedCardUid = normalizeCardUid(rfidCardUid);
        const validationError = validateBasicFields(name, purpose, normalizedCardUid);

        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        const sanitizedName = name.trim();
        const sanitizedPurpose = purpose.trim();

        // Ensure the visitor pass is not already assigned to an active visitor
        const existingActive = await Visitor.findOne({
            where: {
                status: 'active',
                rfidCardUid: normalizedCardUid
            }
        });

        if (existingActive) {
            return res.status(409).json({
                success: false,
                error: 'This visitor pass is already assigned to an active visitor. Please choose a different pass or check the visitor out first.'
            });
        }

        const visitor = await Visitor.create({
            name: sanitizedName,
            purpose: sanitizedPurpose,
            rfidCardUid: normalizedCardUid,
            status: 'active'
        });

        req.auditLog = {
            action: 'VISITOR_REGISTER',
            details: `Visitor registered via kiosk: ${sanitizedName}`,
            metadata: {
                visitorId: visitor.id,
                name: sanitizedName,
                purpose: sanitizedPurpose,
                visitorPass: visitor.rfidCardUid
            }
        };

        return res.status(201).json({
            success: true,
            message: 'Visitor registered successfully',
            data: {
                id: visitor.id,
                name: visitor.name,
                purpose: visitor.purpose,
                entryTime: visitor.entryTime,
                status: visitor.status,
                rfidCardUid: visitor.rfidCardUid
            }
        });

    } catch (error) {
        console.error('Error registering visitor:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while registering visitor'
        });
    }
}

/**
 * Process visitor exit using RFID visitor pass
 * POST /api/kiosk/visitor/exit
 */
async function processExit(req, res) {
    try {
        const { rfidCardUid } = req.body;

        const normalizedCardUid = normalizeCardUid(rfidCardUid);

        if (!normalizedCardUid) {
            return res.status(400).json({
                success: false,
                error: 'Visitor pass is required to process exit'
            });
        }

        if (normalizedCardUid.length < MIN_CARD_UID_LENGTH || normalizedCardUid.length > MAX_CARD_UID_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `Visitor pass must be between ${MIN_CARD_UID_LENGTH} and ${MAX_CARD_UID_LENGTH} characters`
            });
        }

        const visitor = await Visitor.findOne({
            where: {
                status: 'active',
                rfidCardUid: normalizedCardUid
            },
            order: [['entryTime', 'ASC']]
        });

        if (!visitor) {
            return res.status(404).json({
                success: false,
                error: 'No active visitor found for the scanned pass. Please ensure the visitor registered on entry.'
            });
        }

        const exitTime = new Date();
        await visitor.update({
            status: 'exited',
            exitTime
        });

        const durationMinutes = calculateVisitDurationMinutes(visitor.entryTime, exitTime);

        req.auditLog = {
            action: 'VISITOR_EXIT',
            details: `Visitor exit recorded: ${visitor.name}`,
            metadata: {
                visitorId: visitor.id,
                name: visitor.name,
                entryTime: visitor.entryTime,
                exitTime,
                durationMinutes,
                visitorPass: visitor.rfidCardUid
            }
        };

        return res.status(200).json({
            success: true,
            message: 'Visitor checked out successfully. Thank you for visiting!',
            data: {
                visitor: {
                    id: visitor.id,
                    name: visitor.name,
                    purpose: visitor.purpose,
                    entryTime: visitor.entryTime,
                    exitTime,
                    status: 'exited',
                    durationMinutes,
                    rfidCardUid: visitor.rfidCardUid
                }
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
                todayExited,
                timestamp: new Date(),
                visitorPassMode: 'rfid-card'
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
                rfidCardUid: visitor.rfidCardUid
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
                visitorPass: 'available'
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
    getVisitorStatus,
    getVisitorById,
    healthCheck
};
