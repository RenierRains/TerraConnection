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

// Export comprehensive dashboard data
exports.exportDashboardData = async (req, res) => {
  try {
    const { format = 'json', range = 'week', department } = req.query;
    const [startDate, endDate] = getDateRange(range);

    // Build date filter
    let dateFilter = `AND al.timestamp >= '${startDate.toISOString()}' AND al.timestamp <= '${endDate.toISOString()}'`;
    
    // Build department filter
    let departmentFilter = '';
    if (department) {
      departmentFilter = `AND u.department = '${department}'`;
    }

    // Get dashboard statistics
    const [statsResult] = await db.sequelize.query(`
      SELECT 
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as totalEntries,
        SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as totalExits,
        SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as totalAnomalies,
        COUNT(DISTINCT u.id) as activeUsers
      FROM Audit_Logs al
      LEFT JOIN Users u ON al.user_id = u.id
      WHERE 1=1 ${dateFilter} ${departmentFilter}
    `);

    // Get department breakdown
    const [departmentStats] = await db.sequelize.query(`
      SELECT 
        u.department,
        d.name as department_name,
        COUNT(DISTINCT u.id) as user_count,
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as exits,
        SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as anomalies
      FROM Users u
      LEFT JOIN Departments d ON u.department = d.code
      LEFT JOIN Audit_Logs al ON al.user_id = u.id ${dateFilter.replace('WHERE 1=1 AND', 'AND')}
      WHERE u.department IS NOT NULL ${department ? `AND u.department = '${department}'` : ''}
      GROUP BY u.department, d.name
      ORDER BY user_count DESC
    `);

    // Get recent activities
    const recentActivities = await db.Audit_Log.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [{
        model: db.User,
        attributes: ['first_name', 'last_name', 'email', 'department'],
        required: false,
        where: department ? { department } : {}
      }],
      order: [['timestamp', 'DESC']],
      limit: 100
    });

    // Get time series data
    const [timeSeriesData] = await db.sequelize.query(`
      SELECT 
        DATE(al.timestamp) as date,
        SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as exits,
        SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as anomalies
      FROM Audit_Logs al
      LEFT JOIN Users u ON al.user_id = u.id
      WHERE 1=1 ${dateFilter} ${departmentFilter}
      GROUP BY DATE(al.timestamp)
      ORDER BY date
    `);

    // Compile comprehensive dashboard data
    const dashboardData = {
      metadata: {
        exportDate: new Date().toISOString(),
        dateRange: { start: startDate, end: endDate },
        range: range,
        department: department || 'All Departments'
      },
      summary: {
        statistics: statsResult[0] || {
          totalEntries: 0,
          totalExits: 0,
          totalAnomalies: 0,
          activeUsers: 0
        },
        departmentBreakdown: departmentStats.map(dept => ({
          department: dept.department,
          departmentName: dept.department_name,
          userCount: parseInt(dept.user_count) || 0,
          entries: parseInt(dept.entries) || 0,
          exits: parseInt(dept.exits) || 0,
          anomalies: parseInt(dept.anomalies) || 0
        }))
      },
      timeSeries: timeSeriesData.map(item => ({
        date: item.date,
        entries: parseInt(item.entries) || 0,
        exits: parseInt(item.exits) || 0,
        anomalies: parseInt(item.anomalies) || 0
      })),
      recentActivities: recentActivities.map(activity => ({
        timestamp: activity.timestamp,
        actionType: activity.action_type,
        user: activity.User ? {
          name: `${activity.User.first_name} ${activity.User.last_name}`,
          email: activity.User.email,
          department: activity.User.department
        } : null,
        details: activity.details
      }))
    };

    // Send response based on format
    if (format === 'csv') {
      // For CSV, create a flattened structure
      const csvData = [];
      
      // Add summary statistics
      csvData.push({
        type: 'Summary',
        metric: 'Total Entries',
        value: dashboardData.summary.statistics.totalEntries,
        date: '',
        department: '',
        user: ''
      });
      csvData.push({
        type: 'Summary',
        metric: 'Total Exits',
        value: dashboardData.summary.statistics.totalExits,
        date: '',
        department: '',
        user: ''
      });
      csvData.push({
        type: 'Summary',
        metric: 'Total Anomalies',
        value: dashboardData.summary.statistics.totalAnomalies,
        date: '',
        department: '',
        user: ''
      });
      csvData.push({
        type: 'Summary',
        metric: 'Active Users',
        value: dashboardData.summary.statistics.activeUsers,
        date: '',
        department: '',
        user: ''
      });

      // Add department breakdown
      dashboardData.summary.departmentBreakdown.forEach(dept => {
        csvData.push({
          type: 'Department',
          metric: 'User Count',
          value: dept.userCount,
          date: '',
          department: dept.departmentName,
          user: ''
        });
        csvData.push({
          type: 'Department',
          metric: 'Entries',
          value: dept.entries,
          date: '',
          department: dept.departmentName,
          user: ''
        });
        csvData.push({
          type: 'Department',
          metric: 'Exits',
          value: dept.exits,
          date: '',
          department: dept.departmentName,
          user: ''
        });
        csvData.push({
          type: 'Department',
          metric: 'Anomalies',
          value: dept.anomalies,
          date: '',
          department: dept.departmentName,
          user: ''
        });
      });

      // Add time series data
      dashboardData.timeSeries.forEach(item => {
        csvData.push({
          type: 'TimeSeries',
          metric: 'Entries',
          value: item.entries,
          date: item.date,
          department: '',
          user: ''
        });
        csvData.push({
          type: 'TimeSeries',
          metric: 'Exits',
          value: item.exits,
          date: item.date,
          department: '',
          user: ''
        });
        csvData.push({
          type: 'TimeSeries',
          metric: 'Anomalies',
          value: item.anomalies,
          date: item.date,
          department: '',
          user: ''
        });
      });

      const fields = ['type', 'metric', 'value', 'date', 'department', 'user'];
      const parser = new Parser({ fields });
      const csv = parser.parse(csvData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dashboard_comprehensive_${range}_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=dashboard_comprehensive_${range}_${new Date().toISOString().split('T')[0]}.json`);
    return res.json(dashboardData);

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