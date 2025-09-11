const express = require('express');
const router = express.Router();
const visitorAdminController = require('../controllers/visitorAdminController');

// Use session-based authentication like other admin routes
router.use((req, res, next) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
});

// Admin routes for visitor management
// All routes require authentication

/**
 * @route GET /admin/visitors
 * @desc Display visitor logs with filtering and pagination
 * @access Private (Admin)
 */
router.get('/', visitorAdminController.index);

/**
 * @route GET /admin/visitors/export
 * @desc Export visitor logs to CSV/JSON
 * @access Private (Admin)
 */
router.get('/export', visitorAdminController.exportLogs);

/**
 * @route GET /admin/visitors/:id
 * @desc Show visitor details
 * @access Private (Admin)
 */
router.get('/:id', visitorAdminController.show);

/**
 * @route DELETE /admin/visitors/:id
 * @desc Delete visitor record
 * @access Private (Admin)
 */
router.delete('/:id', visitorAdminController.destroy);

/**
 * @route POST /admin/visitors/bulk
 * @desc Perform bulk actions on visitors
 * @access Private (Admin)
 */
router.post('/bulk', visitorAdminController.bulkAction);

// API routes for AJAX requests

/**
 * @route GET /api/admin/visitors/stats
 * @desc Get visitor statistics for dashboard
 * @access Private (Admin)
 */
router.get('/api/stats', visitorAdminController.getStats);

module.exports = router;
