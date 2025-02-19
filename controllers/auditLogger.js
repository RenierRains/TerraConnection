const db = require('../models');

async function logAuditEvent(userId, actionType, details) {
  try {
    const detailsString = typeof details === 'string' ? details : JSON.stringify(details);
    await db.Audit_Log.create({
      user_id: userId,
      action_type: actionType,
      details: detailsString,
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
async function logAnomalyAudit(userId, action, details) {
  await logAuditEvent(userId, 'ANOMALY_' + action, details);
}

module.exports = { logAuditEvent, logUserAudit, logDataAudit, logSecurityAudit, logAnomalyAudit };
