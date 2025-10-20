const express = require('express');
const router = express.Router();
const visitorKioskController = require('../controllers/visitorKioskController');
const { ipRestriction } = require('../middleware/ipRestriction');

// Apply IP restriction to all visitor kiosk API routes (same as RFID scanner)
router.use(ipRestriction);

// Kiosk routes for visitor management
// These routes are IP-restricted for kiosk terminals

/**
 * @route POST /api/kiosk/visitor/register
 * @desc Register a new visitor
 * @access Restricted (IP-based)
 */
router.post('/register', visitorKioskController.registerVisitor);

/**
 * @route POST /api/kiosk/visitor/exit
 * @desc Process visitor exit using RFID visitor pass
 * @access Restricted (IP-based)
 */
router.post('/exit', visitorKioskController.processExit);

/**
 * @route GET /api/kiosk/visitor/status
 * @desc Get current visitor status for kiosk display
 * @access Restricted (IP-based)
 */
router.get('/status', visitorKioskController.getVisitorStatus);

/**
 * @route GET /api/kiosk/visitor/:id
 * @desc Get visitor by ID for verification
 * @access Restricted (IP-based)
 */
router.get('/:id', visitorKioskController.getVisitorById);

/**
 * @route GET /api/kiosk/health
 * @desc Health check for kiosk system
 * @access Restricted (IP-based)
 */
router.get('/health', visitorKioskController.healthCheck);

module.exports = router;
