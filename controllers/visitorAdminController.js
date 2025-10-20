const { Visitor } = require('../models');
const { Op } = require('sequelize');
const { Parser } = require('json2csv');
const VisitorFaceService = require('../services/visitorFaceService');

// Create a single instance of the face service
const faceService = new VisitorFaceService();

// Helper function to get visitor statistics
async function getVisitorStatistics() {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [active, today, month, total] = await Promise.all([
            Visitor.count({ where: { status: 'active' } }),
            Visitor.count({ where: { createdAt: { [Op.gte]: todayStart } } }),
            Visitor.count({ where: { createdAt: { [Op.gte]: monthStart } } }),
            Visitor.count()
        ]);

        // Calculate average visit duration
        const exitedVisitors = await Visitor.findAll({
            where: {
                status: 'exited',
                exitTime: { [Op.ne]: null }
            },
            attributes: ['entryTime', 'exitTime']
        });

        let averageVisitMinutes = 0;
        if (exitedVisitors.length > 0) {
            const totalMinutes = exitedVisitors.reduce((sum, visitor) => {
                const duration = new Date(visitor.exitTime) - new Date(visitor.entryTime);
                return sum + (duration / (1000 * 60)); // Convert to minutes
            }, 0);
            averageVisitMinutes = Math.round(totalMinutes / exitedVisitors.length);
        }

        return {
            active,
            today,
            month,
            total,
            averageVisitMinutes
        };
    } catch (error) {
        console.error('Error getting visitor statistics:', error);
        return {
            active: 0,
            today: 0,
            month: 0,
            total: 0,
            averageVisitMinutes: 0
        };
    }
}

/**
 * Get all visitors with filtering and pagination
 * GET /admin/visitors
 */
async function index(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;

        // Build where conditions
        const whereConditions = {};

        // Search by name
        if (search) {
            whereConditions.name = {
                [Op.like]: `%${search}%`
            };
        }

        // Filter by status
        if (status) {
            whereConditions.status = status;
        }

        // Date range filter
        if (dateFrom || dateTo) {
            whereConditions.createdAt = {};
            if (dateFrom) {
                whereConditions.createdAt[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                whereConditions.createdAt[Op.lte] = endDate;
            }
        }

        const { count, rows: visitors } = await Visitor.findAndCountAll({
            where: whereConditions,
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        // Get statistics
        const stats = await getVisitorStatistics();

        return res.render('admin/visitors/index', {
            title: 'Visitor Logs',
            visitors,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: count,
                limit,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: {
                search,
                status,
                dateFrom,
                dateTo
            },
            stats,
            admin: req.session.admin,
            layout: 'layout'
        });

    } catch (error) {
        console.error('Error loading visitors:', error);
        return res.status(500).render('admin/visitors/index', {
            title: 'Visitor Logs',
            visitors: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                limit: 25,
                hasNext: false,
                hasPrev: false
            },
            filters: {
                search: '',
                status: '',
                dateFrom: '',
                dateTo: ''
            },
            stats: {
                active: 0,
                today: 0,
                month: 0,
                total: 0,
                averageVisitMinutes: 0
            },
            admin: req.session.admin,
            layout: 'layout',
            error: 'Error loading visitor logs'
        });
    }
}

/**
 * Show visitor details
 * GET /admin/visitors/:id
 */
async function show(req, res) {
    try {
        const { id } = req.params;

        const visitor = await Visitor.findByPk(id);

        if (!visitor) {
            return res.status(404).render('admin/visitors/show', {
                title: 'Visitor Not Found',
                visitor: null,
                visitDuration: null,
                faceImageInfo: null,
                error: 'Visitor not found',
                admin: req.session.admin,
                layout: 'layout'
            });
        }

        // Calculate visit duration if visitor has exited
        let visitDuration = null;
        if (visitor.exitTime) {
            const duration = new Date(visitor.exitTime) - new Date(visitor.entryTime);
            const totalMinutes = Math.round(duration / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const seconds = Math.floor((duration % (1000 * 60)) / 1000);
            
            visitDuration = {
                hours,
                minutes,
                seconds,
                totalMinutes
            };
        }

        // Get face image information if visitor has face image
        let faceImageInfo = null;
        if (visitor.faceImagePath) {
            try {
                faceImageInfo = await faceService.getImageInfo(visitor.faceImagePath);
            } catch (error) {
                console.error('Error getting face image info:', error);
                faceImageInfo = {
                    exists: false,
                    error: error.message,
                    path: visitor.faceImagePath
                };
            }
        }

        // Get statistics for context
        const stats = await getVisitorStatistics();

        return res.render('admin/visitors/show', {
            title: `Visitor Details - ${visitor.name}`,
            visitor,
            visitDuration,
            faceImageInfo,
            stats,
            admin: req.session.admin,
            layout: 'layout'
        });

    } catch (error) {
        console.error('Error loading visitor details:', error);
        return res.status(500).render('admin/visitors/show', {
            title: 'Error',
            visitor: null,
            visitDuration: null,
            faceImageInfo: null,
            error: 'Error loading visitor details',
            admin: req.session.admin,
            layout: 'layout'
        });
    }
}

/**
 * Delete a visitor
 * DELETE /admin/visitors/:id
 */
async function destroy(req, res) {
    try {
        const { id } = req.params;

        const visitor = await Visitor.findByPk(id);
        if (!visitor) {
            return res.status(404).json({
                success: false,
                error: 'Visitor not found'
            });
        }

        // Delete associated face image if exists
        if (visitor.faceImagePath) {
            try {
                await faceService.deleteFaceImage(visitor.faceImagePath);
            } catch (imageError) {
                console.error('Error deleting face image:', imageError);
                // Continue with visitor deletion even if image deletion fails
            }
        }

        await visitor.destroy();

        return res.json({
            success: true,
            message: 'Visitor deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting visitor:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete visitor'
        });
    }
}

/**
 * Export visitor logs
 * GET /admin/visitors/export
 */
async function exportLogs(req, res) {
    try {
        // Check if this is an AJAX request for the modal form
        if (req.get('X-Requested-With') === 'XMLHttpRequest' && !req.query.format) {
            return res.render('admin/visitors/export', {
                title: 'Export Visitor Logs',
                layout: false
            });
        }

        const format = req.query.format || 'csv';
        const search = req.query.search || '';
        const status = req.query.status || '';
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;

        // Build where conditions (same as index)
        const whereConditions = {};

        if (search) {
            whereConditions.name = {
                [Op.like]: `%${search}%`
            };
        }

        if (status) {
            whereConditions.status = status;
        }

        if (dateFrom || dateTo) {
            whereConditions.createdAt = {};
            if (dateFrom) {
                whereConditions.createdAt[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                whereConditions.createdAt[Op.lte] = endDate;
            }
        }

        const visitors = await Visitor.findAll({
            where: whereConditions,
            order: [['createdAt', 'DESC']]
        });

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=visitor-logs.json');
            return res.json(visitors);
        } else {
            // CSV export
            const fields = [
                { label: 'ID', value: 'id' },
                { label: 'Name', value: 'name' },
                { label: 'Visitor Pass', value: 'rfidCardUid' },
                { label: 'Purpose', value: 'purpose' },
                { label: 'Status', value: 'status' },
                { label: 'Entry Time', value: 'entryTime' },
                { label: 'Exit Time', value: 'exitTime' },
                { label: 'Created At', value: 'createdAt' },
                { label: 'Updated At', value: 'updatedAt' }
            ];

            const parser = new Parser({ fields });
            const csv = parser.parse(visitors);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=visitor-logs.csv');
            return res.send(csv);
        }

    } catch (error) {
        console.error('Error exporting visitor logs:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to export visitor logs'
        });
    }
}

/**
 * Perform bulk actions on visitors
 * POST /admin/visitors/bulk
 */
async function bulkAction(req, res) {
    try {
        const { action, visitorIds } = req.body;

        if (!action || !visitorIds || !Array.isArray(visitorIds)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bulk action request'
            });
        }

        let result = { success: true, message: '', count: 0 };

        switch (action) {
            case 'delete':
                // Find visitors with face images to clean up
                const visitorsToDelete = await Visitor.findAll({
                    where: { id: { [Op.in]: visitorIds } },
                    attributes: ['id', 'faceImagePath']
                });

                // Delete face images
                for (const visitor of visitorsToDelete) {
                    if (visitor.faceImagePath) {
                        try {
                            await faceService.deleteFaceImage(visitor.faceImagePath);
                        } catch (imageError) {
                            console.error('Error deleting face image:', imageError);
                        }
                    }
                }

                // Delete visitors
                const deleteCount = await Visitor.destroy({
                    where: { id: { [Op.in]: visitorIds } }
                });

                result.message = `${deleteCount} visitors deleted successfully`;
                result.count = deleteCount;
                break;

            case 'export':
                const visitors = await Visitor.findAll({
                    where: { id: { [Op.in]: visitorIds } },
                    order: [['createdAt', 'DESC']]
                });

                const fields = [
                    { label: 'ID', value: 'id' },
                    { label: 'Name', value: 'name' },
                    { label: 'Visitor Pass', value: 'rfidCardUid' },
                    { label: 'Purpose', value: 'purpose' },
                    { label: 'Status', value: 'status' },
                    { label: 'Entry Time', value: 'entryTime' },
                    { label: 'Exit Time', value: 'exitTime' },
                    { label: 'Created At', value: 'createdAt' }
                ];

                const parser = new Parser({ fields });
                const csv = parser.parse(visitors);

                return res.json({
                    success: true,
                    data: csv,
                    filename: `selected-visitors-${Date.now()}.csv`
                });

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid bulk action'
                });
        }

        return res.json(result);

    } catch (error) {
        console.error('Error performing bulk action:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to perform bulk action'
        });
    }
}

/**
 * Get visitor statistics for API
 * GET /admin/visitors/api/stats
 */
async function getStats(req, res) {
    try {
        const stats = await getVisitorStatistics();
        return res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting visitor statistics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get visitor statistics'
        });
    }
}

module.exports = {
    index,
    show,
    destroy,
    exportLogs,
    bulkAction,
    getStats
};
