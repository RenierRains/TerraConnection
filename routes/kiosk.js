const express = require('express');
const router = express.Router();
const ipRestriction = require('../middleware/ipRestriction');

// Apply IP restriction to all kiosk routes (same as RFID scanner)
router.use(ipRestriction);

/**
 * @route GET /kiosk
 * @desc Display main kiosk page with entry/exit options
 * @access Restricted (IP-based)
 */
router.get('/', (req, res) => {
    res.render('kiosk/index', {
        title: 'Visitor Kiosk - TerraConnection',
        layout: false // Don't use the admin layout for kiosk
    });
});

/**
 * @route GET /kiosk/entry
 * @desc Display visitor entry kiosk interface
 * @access Restricted (IP-based)
 */
router.get('/entry', (req, res) => {
    res.render('kiosk/entry', {
        title: 'Visitor Registration - TerraConnection',
        layout: false // Don't use the admin layout for kiosk
    });
});

/**
 * @route GET /kiosk/exit
 * @desc Display visitor exit kiosk interface
 * @access Restricted (IP-based)
 */
router.get('/exit', (req, res) => {
    res.render('kiosk/exit', {
        title: 'Visitor Exit - TerraConnection',
        layout: false // Don't use the admin layout for kiosk
    });
});

module.exports = router;
