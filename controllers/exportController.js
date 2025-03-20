const db = require('../models');
const { Parser } = require('json2csv');
const { Op } = require('sequelize');

// Helper function to format date ranges
const getDateRange = (range) => {
  const now = new Date();
  switch (range) {
    case '24h':
      return [new Date(now - 24 * 60 * 60 * 1000), now];
    case 'week':
      return [new Date(now - 7 * 24 * 60 * 60 * 1000), now];
    case 'month':
      return [new Date(now - 30 * 24 * 60 * 60 * 1000), now];
    case 'year':
      return [new Date(now - 365 * 24 * 60 * 60 * 1000), now];
    default:
      return [new Date(now - 7 * 24 * 60 * 60 * 1000), now]; // Default to week
  }
};

// Helper function to process audit log for export
const processAuditLog = (log) => {
  try {
    const details = JSON.parse(log.details);
    return {
      timestamp: new Date(log.timestamp).toISOString(),
      user: log.User ? `${log.User.first_name} ${log.User.last_name}` : 'System',
      action_type: log.action_type,
      status: details.data?.status || 'N/A',
      details: JSON.stringify(details.data),
      environment: details.metadata?.environment || 'N/A',
      ip: details.metadata?.ip || 'N/A',
      user_agent: details.metadata?.userAgent || 'N/A',
      platform: details.metadata?.platform || 'N/A',
      session_id: details.metadata?.sessionId || 'N/A'
    };
  } catch (e) {
    return {
      timestamp: new Date(log.timestamp).toISOString(),
      user: log.User ? `${log.User.first_name} ${log.User.last_name}` : 'System',
      action_type: log.action_type,
      status: 'N/A',
      details: log.details,
      environment: 'N/A',
      ip: 'N/A',
      user_agent: 'N/A',
      platform: 'N/A',
      session_id: 'N/A'
    };
  }
};

// Export dashboard data
exports.exportDashboardData = async (req, res) => {
  try {
    const { format = 'json', range = 'week', prefix } = req.query;
    const [startDate, endDate] = getDateRange(range);

    // Build query conditions
    const whereConditions = {
      timestamp: {
        [Op.between]: [startDate, endDate]
      }
    };

    if (prefix && prefix !== 'all') {
      whereConditions.action_type = {
        [Op.startsWith]: prefix.toUpperCase()
      };
    }

    // Fetch logs
    const logs = await db.Audit_Log.findAll({
      where: whereConditions,
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name']
      }],
      order: [['timestamp', 'DESC']]
    });

    // Process logs
    const processedLogs = logs.map(processAuditLog);

    // Send response based on format
    if (format === 'csv') {
      const fields = ['timestamp', 'user', 'action_type', 'status', 'details', 'environment', 'ip', 'user_agent', 'platform', 'session_id'];
      const parser = new Parser({ fields });
      const csv = parser.parse(processedLogs);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dashboard_export_${range}_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=dashboard_export_${range}_${new Date().toISOString().split('T')[0]}.json`);
    return res.json(processedLogs);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export dashboard data' });
  }
};

// Export audit logs
exports.exportAuditLogs = async (req, res) => {
  try {
    const { format = 'json', startDate, endDate, actionType, status, searchTerm, severity } = req.query;

    // Build query conditions
    const whereConditions = {};
    
    if (startDate && endDate) {
      whereConditions.timestamp = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    if (actionType) {
      whereConditions.action_type = {
        [Op.startsWith]: actionType
      };
    }

    if (searchTerm) {
      whereConditions[Op.or] = [
        { action_type: { [Op.like]: `%${searchTerm}%` } },
        { details: { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    // Fetch logs with filters
    const logs = await db.Audit_Log.findAll({
      where: whereConditions,
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name']
      }],
      order: [['timestamp', 'DESC']]
    });

    // Filter logs by status and severity after fetching
    // (since these are inside the JSON details)
    let filteredLogs = logs;
    if (status || severity) {
      filteredLogs = logs.filter(log => {
        try {
          const details = JSON.parse(log.details);
          const matchesStatus = !status || details.data?.status === status;
          const matchesSeverity = !severity || details.data?.severity === severity;
          return matchesStatus && matchesSeverity;
        } catch (e) {
          return false;
        }
      });
    }

    // Process logs
    const processedLogs = filteredLogs.map(processAuditLog);

    // Send response based on format
    if (format === 'csv') {
      const fields = ['timestamp', 'user', 'action_type', 'status', 'details', 'environment', 'ip', 'user_agent', 'platform', 'session_id'];
      const parser = new Parser({ fields });
      const csv = parser.parse(processedLogs);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_export_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_export_${new Date().toISOString().split('T')[0]}.json`);
    return res.json(processedLogs);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
}; 