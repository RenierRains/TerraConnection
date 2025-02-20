const { logSecurityAudit } = require('../controllers/auditLogger');

function securityAudit(req, res, next) {

  if (!req.user) {
    logSecurityAudit(null, 'UNAUTHORIZED_ACCESS', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  next();
}

module.exports = securityAudit;
