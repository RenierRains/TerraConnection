const db = require('../models');

const AuditActions = {
  USER: {
    LOGIN_SUCCESS: 'USER_LOGIN_SUCCESS',
    LOGOUT: 'USER_LOGOUT',
    PROFILE_UPDATE: 'USER_PROFILE_UPDATE',
    PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE'
  },
  DATA: {
    CREATE: 'DATA_CREATE',
    UPDATE: 'DATA_UPDATE',
    DELETE: 'DATA_DELETE',
    IMPORT: 'DATA_IMPORT',
    EXPORT: 'DATA_EXPORT'
  },
  SECURITY: {
    UNAUTHORIZED_ACCESS: 'SECURITY_UNAUTHORIZED_ACCESS',
    LOGIN_FAILED: 'SECURITY_LOGIN_FAILED',
    PERMISSION_DENIED: 'SECURITY_PERMISSION_DENIED',
    SUSPICIOUS_ACTIVITY: 'SECURITY_SUSPICIOUS_ACTIVITY'
  },
  ANOMALY: {
    MULTIPLE_LOGIN_FAILURES: 'ANOMALY_LOGIN_FAILURES',
    UNUSUAL_ACCESS_PATTERN: 'ANOMALY_ACCESS_PATTERN',
    DATA_ANOMALY: 'ANOMALY_DATA_PATTERN'
  },
  ADMIN: {
    LOGIN: 'ADMIN_LOGIN',
    LOGOUT: 'ADMIN_LOGOUT',
    USER_MANAGEMENT: 'ADMIN_USER_MANAGEMENT',
    SYSTEM_CONFIG: 'ADMIN_SYSTEM_CONFIG'
  },
  REQUEST: {
    API_CALL: 'REQUEST_API',
    FILE_DOWNLOAD: 'REQUEST_DOWNLOAD',
    FILE_UPLOAD: 'REQUEST_UPLOAD'
  }
};

async function logAuditEvent(userId, actionType, details) {
  try {
    const detailsObj = {
      timestamp: new Date().toISOString(),
      action: actionType,
      userId: userId,
      data: typeof details === 'string' ? { message: details } : details,
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid,
        hostname: require('os').hostname()
      }
    };

    await db.Audit_Log.create({
      user_id: userId,
      action_type: actionType,
      details: JSON.stringify(detailsObj),
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Error logging audit event:', err);
  }
}

async function logUserAudit(userId, action, details) {
  await logAuditEvent(userId, 'USER_' + action, details);
}
async function logDataAudit(userId, action, original, updated) {
  await logAuditEvent(userId, 'DATA_' + action, { original, updated });
}
async function logSecurityAudit(userId, action, details) {
  await logAuditEvent(userId, 'SECURITY_' + action, details);
}
async function logAnomalyAudit(identifier, action, details) {
  await logAuditEvent(identifier, 'ANOMALY_' + action, details);
}

module.exports = { 
  logAuditEvent, 
  logUserAudit, 
  logDataAudit, 
  logSecurityAudit, 
  logAnomalyAudit,
  AuditActions 
};
