const db = require('../models');

class DashboardWebSocketService {
  constructor(io) {
    this.io = io;
    this.intervalId = null;
    this.connectedAdmins = new Set();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log('Dashboard WebSocket client connected:', socket.id);
      
      // Admin dashboard specific events
      socket.on('joinDashboard', async (adminData) => {
        if (adminData && adminData.role === 'admin') {
          socket.join('dashboard');
          this.connectedAdmins.add(socket.id);
          console.log(`Admin ${adminData.email} joined dashboard updates`);
          
          // Send initial dashboard data
          await this.sendDashboardUpdate(socket);
          await this.sendSystemHealth(socket);
        }
      });

      socket.on('leaveDashboard', () => {
        socket.leave('dashboard');
        this.connectedAdmins.delete(socket.id);
        console.log('Admin left dashboard updates');
      });

      socket.on('requestDashboardUpdate', async () => {
        if (this.connectedAdmins.has(socket.id)) {
          await this.sendDashboardUpdate(socket);
        }
      });

      socket.on('disconnect', () => {
        this.connectedAdmins.delete(socket.id);
        console.log('Dashboard WebSocket client disconnected:', socket.id);
      });
    });

    // Start periodic updates for dashboard
    this.startPeriodicUpdates();
  }

  startPeriodicUpdates() {
    // Update dashboard every 60 seconds (reduced frequency)
    this.intervalId = setInterval(async () => {
      if (this.connectedAdmins.size > 0) {
        await this.broadcastDashboardUpdate();
        // Update system health less frequently (every 2 minutes)
        if (Date.now() % 120000 < 60000) {
          await this.broadcastSystemHealth();
        }
      }
    }, 60000);
  }

  stopPeriodicUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async sendDashboardUpdate(socket) {
    try {
      const stats = await this.getDashboardStats();
      const activities = await this.getRecentActivities();
      
      socket.emit('dashboardUpdate', {
        stats,
        activities,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error sending dashboard update:', error);
    }
  }

  async broadcastDashboardUpdate() {
    try {
      const stats = await this.getDashboardStats();
      const activities = await this.getRecentActivities();
      
      this.io.to('dashboard').emit('dashboardUpdate', {
        stats,
        activities,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error broadcasting dashboard update:', error);
    }
  }

  async sendSystemHealth(socket) {
    try {
      const health = await this.getSystemHealth();
      socket.emit('systemHealth', health);
    } catch (error) {
      console.error('Error sending system health:', error);
    }
  }

  async broadcastSystemHealth() {
    try {
      const health = await this.getSystemHealth();
      this.io.to('dashboard').emit('systemHealth', health);
    } catch (error) {
      console.error('Error broadcasting system health:', error);
    }
  }

  async getDashboardStats() {
    try {
      // Get stats for the last 7 days by default
      const [statsResult] = await db.sequelize.query(`
        SELECT 
          SUM(CASE WHEN al.action_type LIKE '%ENTRY_%' OR al.action_type LIKE '%ACCESS_GRANTED%' THEN 1 ELSE 0 END) as totalEntries,
          SUM(CASE WHEN al.action_type LIKE '%EXIT_%' OR al.action_type LIKE '%LOGOUT%' THEN 1 ELSE 0 END) as totalExits,
          SUM(CASE WHEN al.action_type LIKE 'ANOMALY_%' OR al.action_type LIKE 'SECURITY_%' THEN 1 ELSE 0 END) as totalAnomalies,
          COUNT(DISTINCT u.id) as activeUsers
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        WHERE al.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);

      return statsResult[0] || {
        totalEntries: 0,
        totalExits: 0,
        totalAnomalies: 0,
        activeUsers: 0
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        totalEntries: 0,
        totalExits: 0,
        totalAnomalies: 0,
        activeUsers: 0
      };
    }
  }

  async getRecentActivities() {
    try {
      // Define activities that are too vague or not useful for admin dashboard
      const excludedActionTypes = [
        'REQUEST',            // Simple REQUEST entries are too vague
        'REQUEST_API',
        'REQUEST_DOWNLOAD',
        'REQUEST_UPLOAD',
        'REQUEST_BATCH',
        'USER_TOKEN_REFRESH'  // Also exclude token refresh as it's too frequent and not actionable
      ];

      const { Op } = require('sequelize');
      
      const activities = await db.Audit_Log.findAll({
        where: {
          action_type: {
            [Op.notIn]: excludedActionTypes
          }
        },
        limit: 15,
        order: [['timestamp', 'DESC']],
        include: [{
          model: db.User,
          attributes: ['first_name', 'last_name', 'email'],
          required: false
        }]
      });

      return activities.map(activity => ({
        id: activity.id,
        action_type: activity.action_type,
        timestamp: activity.timestamp,
        User: activity.User ? {
          first_name: activity.User.first_name,
          last_name: activity.User.last_name,
          email: activity.User.email
        } : null
      }));
    } catch (error) {
      console.error('Error getting recent activities:', error);
      return [];
    }
  }

  async getSystemHealth() {
    try {
      // Get database health
      const dbHealth = await this.getDatabaseHealth();
      
      // Get RFID scanner status (mock for now)
      const rfidHealth = await this.getRFIDHealth();
      
      // Get API response time
      const apiHealth = await this.getAPIHealth();
      
      // Get storage usage (mock for now)
      const storageHealth = await this.getStorageHealth();

      return {
        database: dbHealth,
        rfidScanners: rfidHealth,
        apiResponse: apiHealth,
        storage: storageHealth,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        database: { status: 'unknown', message: 'Unable to check' },
        rfidScanners: { status: 'unknown', message: 'Unable to check' },
        apiResponse: { status: 'unknown', message: 'Unable to check' },
        storage: { status: 'unknown', message: 'Unable to check' }
      };
    }
  }

  async getDatabaseHealth() {
    try {
      const start = Date.now();
      await db.sequelize.authenticate();
      const responseTime = Date.now() - start;
      
      return {
        status: responseTime < 100 ? 'good' : responseTime < 500 ? 'warning' : 'critical',
        message: 'Operational',
        responseTime: `${responseTime}ms`,
        details: `Connection established in ${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'critical',
        message: 'Connection Failed',
        details: error.message
      };
    }
  }

  async getRFIDHealth() {
    try {
      // Simulated RFID health check - in real implementation, you'd ping actual scanner endpoints
      // This simulates checking scanner availability based on recent RFID activity
      const recentScans = await db.sequelize.query(`
        SELECT COUNT(*) as scan_count 
        FROM Audit_Logs 
        WHERE action_type LIKE '%RFID%' 
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      `);
      
      const scanCount = recentScans[0][0]?.scan_count || 0;
      const totalScannersCount = 3;
      
      // Simulate scanner health based on activity
      let activeScannersCount = totalScannersCount;
      if (scanCount === 0) {
        // If no recent scans, assume some scanners might be offline
        activeScannersCount = 2;
      }
      
      return {
        status: activeScannersCount === totalScannersCount ? 'good' : 'warning',
        message: `Online (${activeScannersCount}/${totalScannersCount})`,
        details: `${activeScannersCount} of ${totalScannersCount} scanners responding (${scanCount} recent scans)`
      };
    } catch (error) {
      return {
        status: 'critical',
        message: 'Scanner Check Failed',
        details: error.message
      };
    }
  }

  async getAPIHealth() {
    try {
      const start = Date.now();
      // Test database query as API health indicator
      await db.User.count({ limit: 1 });
      const responseTime = Date.now() - start;
      
      return {
        status: responseTime < 200 ? 'good' : responseTime < 1000 ? 'warning' : 'critical',
        message: `${responseTime}ms avg`,
        responseTime: responseTime,
        details: `Average response time: ${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'critical',
        message: 'API Error',
        details: error.message
      };
    }
  }

  async getStorageHealth() {
    try {
      // Simulated storage check based on database metrics
      // In real implementation, you'd check actual disk usage
      const [dbSize] = await db.sequelize.query(`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS db_size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `);
      
      const dbSizeMB = dbSize[0]?.db_size_mb || 0;
      // Simulate storage percentage based on database size
      // Assume we have a 1GB storage limit for simulation
      const usagePercentage = Math.min(Math.round((dbSizeMB / 1024) * 100), 95);
      
      return {
        status: usagePercentage < 80 ? 'good' : usagePercentage < 90 ? 'warning' : 'critical',
        message: `${usagePercentage}% used`,
        usage: usagePercentage,
        details: `Database: ${dbSizeMB}MB, ${usagePercentage}% of allocated storage`
      };
    } catch (error) {
      return {
        status: 'critical',
        message: 'Storage Check Failed',
        details: error.message
      };
    }
  }


  // Method to trigger immediate dashboard update (for external calls)
  async triggerDashboardUpdate() {
    if (this.connectedAdmins.size > 0) {
      await this.broadcastDashboardUpdate();
    }
  }

  // Method to trigger immediate system health update
  async triggerSystemHealthUpdate() {
    if (this.connectedAdmins.size > 0) {
      await this.broadcastSystemHealth();
    }
  }
}

module.exports = DashboardWebSocketService;
