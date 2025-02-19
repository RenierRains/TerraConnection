const { logAuditEvent } = require('../controllers/auditLogger');

function auditMiddleware(req, res, next) {
  const details = {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    ip: req.ip
  };

  const userId = (req.session && req.session.admin && req.session.admin.id) ||
                 (req.user && req.user.userId) ||
                 null;

  logAuditEvent(userId, 'REQUEST', details);

  next();
}

module.exports = auditMiddleware;
