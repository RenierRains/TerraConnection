const db = require('../models');
const os = require('os');

const AuditActions = {
  USER: {
    LOGIN_SUCCESS: 'USER_LOGIN_SUCCESS',
    LOGOUT: 'USER_LOGOUT',
    PROFILE_UPDATE: 'USER_PROFILE_UPDATE',
    PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
    TOKEN_REFRESH: 'USER_TOKEN_REFRESH',
    SETTINGS_UPDATE: 'USER_SETTINGS_UPDATE'
  },
  DATA: {
    CREATE: 'DATA_CREATE',
    UPDATE: 'DATA_UPDATE',
    DELETE: 'DATA_DELETE',
    IMPORT: 'DATA_IMPORT',
    EXPORT: 'DATA_EXPORT',
    BULK_CREATE: 'DATA_BULK_CREATE',
    BULK_UPDATE: 'DATA_BULK_UPDATE',
    BULK_DELETE: 'DATA_BULK_DELETE'
  },
  SECURITY: {
    UNAUTHORIZED_ACCESS: 'SECURITY_UNAUTHORIZED_ACCESS',
    LOGIN_FAILED: 'SECURITY_LOGIN_FAILED',
    PERMISSION_DENIED: 'SECURITY_PERMISSION_DENIED',
    SUSPICIOUS_ACTIVITY: 'SECURITY_SUSPICIOUS_ACTIVITY',
    TOKEN_INVALID: 'SECURITY_TOKEN_INVALID',
    RATE_LIMIT_EXCEEDED: 'SECURITY_RATE_LIMIT_EXCEEDED'
  },
  ANOMALY: {
    MULTIPLE_LOGIN_FAILURES: 'ANOMALY_LOGIN_FAILURES',
    UNUSUAL_ACCESS_PATTERN: 'ANOMALY_ACCESS_PATTERN',
    DATA_ANOMALY: 'ANOMALY_DATA_PATTERN',
    LOCATION_ANOMALY: 'ANOMALY_LOCATION_PATTERN',
    TIME_ANOMALY: 'ANOMALY_TIME_PATTERN'
  },
  ADMIN: {
    LOGIN: 'ADMIN_LOGIN',
    LOGOUT: 'ADMIN_LOGOUT',
    USER_MANAGEMENT: 'ADMIN_USER_MANAGEMENT',
    SYSTEM_CONFIG: 'ADMIN_SYSTEM_CONFIG',
    PERMISSION_CHANGE: 'ADMIN_PERMISSION_CHANGE',
    BULK_OPERATION: 'ADMIN_BULK_OPERATION'
  },
  REQUEST: {
    API_CALL: 'REQUEST_API',
    FILE_DOWNLOAD: 'REQUEST_DOWNLOAD',
    FILE_UPLOAD: 'REQUEST_UPLOAD',
    BATCH_OPERATION: 'REQUEST_BATCH'
  },
  RFID: {
    CARD_SCAN: 'RFID_CARD_SCAN',
    CARD_ISSUE: 'RFID_CARD_ISSUE',
    CARD_REVOKE: 'RFID_CARD_REVOKE',
    ACCESS_GRANTED: 'RFID_ACCESS_GRANTED',
    ACCESS_DENIED: 'RFID_ACCESS_DENIED'
  },
  LOCATION: {
    UPDATE: 'LOCATION_UPDATE',
    BOUNDARY_EXIT: 'LOCATION_BOUNDARY_EXIT',
    BOUNDARY_ENTER: 'LOCATION_BOUNDARY_ENTER',
    TRACKING_START: 'LOCATION_TRACKING_START',
    TRACKING_STOP: 'LOCATION_TRACKING_STOP'
  }
};

function getSystemMetadata(req) {
  return {
    environment: process.env.NODE_ENV || 'development',
    processId: process.pid,
    hostname: os.hostname(),
    platform: os.platform(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent'],
    requestId: req?.id,
    sessionId: req?.session?.id
  };
}

function sanitizeData(data) {
  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'credit_card'];
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = Array.isArray(data) ? [...data] : {...data};
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  return sanitized;
}

async function logAuditEvent(userId, actionType, details, req = null) {
  try {
    const metadata = getSystemMetadata(req);
    const detailsObj = {
      timestamp: metadata.timestamp,
      action: actionType,
      userId: userId,
      data: sanitizeData(typeof details === 'string' ? { message: details } : details),
      metadata
    };

    const log = await db.Audit_Log.create({
      user_id: userId,
      action_type: actionType,
      details: JSON.stringify(detailsObj),
      timestamp: new Date()
    });

    // If it's a security or anomaly event, we might want to trigger alerts
    if (actionType.startsWith('SECURITY_') || actionType.startsWith('ANOMALY_')) {
      await triggerSecurityAlert(log);
    }

    return log;
  } catch (err) {
    console.error('Error logging audit event:', err);
    // Don't throw - we don't want audit logging to break the main flow
    return null;
  }
}

async function triggerSecurityAlert(log) {
  try {
    // Here you could implement security alert notifications
    // For example, sending emails to admins or integrating with a SIEM system
    console.warn('Security Alert:', {
      id: log.id,
      action: log.action_type,
      userId: log.user_id,
      timestamp: log.timestamp
    });
  } catch (err) {
    console.error('Error triggering security alert:', err);
  }
}

async function logUserAudit(userId, action, details, req = null) {
  return await logAuditEvent(userId, 'USER_' + action, details, req);
}

async function logDataAudit(userId, action, details, req = null) {
  const enrichedDetails = {
    ...details,
    entityType: details.entityType || 'unknown',
    entityId: details.entityId || null,
    changes: details.changes || [],
    original: details.original || null,
    updated: details.updated || null
  };
  return await logAuditEvent(userId, 'DATA_' + action, enrichedDetails, req);
}

async function logSecurityAudit(userId, action, details, req = null) {
  const enrichedDetails = {
    ...details,
    riskLevel: details.riskLevel || 'medium',
    impact: details.impact || 'unknown',
    mitigationApplied: details.mitigationApplied || []
  };
  return await logAuditEvent(userId, 'SECURITY_' + action, enrichedDetails, req);
}

async function logAnomalyAudit(identifier, action, details, req = null) {
  const enrichedDetails = {
    ...details,
    anomalyType: details.anomalyType || 'unknown',
    severity: details.severity || 'medium',
    detectionMethod: details.detectionMethod || 'system'
  };
  return await logAuditEvent(identifier, 'ANOMALY_' + action, enrichedDetails, req);
}

async function logLocationAudit(userId, action, details, req = null) {
  const enrichedDetails = {
    ...details,
    accuracy: details.accuracy || null,
    provider: details.provider || 'unknown',
    locationContext: details.locationContext || {}
  };
  return await logAuditEvent(userId, 'LOCATION_' + action, enrichedDetails, req);
}

async function logRFIDAudit(userId, action, details, req = null) {
  const enrichedDetails = {
    ...details,
    deviceId: details.deviceId || 'unknown',
    location: details.location || null,
    cardDetails: details.cardDetails || {}
  };
  return await logAuditEvent(userId, 'RFID_' + action, enrichedDetails, req);
}

module.exports = { 
  logAuditEvent,
  logUserAudit,
  logDataAudit,
  logSecurityAudit,
  logAnomalyAudit,
  logLocationAudit,
  logRFIDAudit,
  AuditActions
};
