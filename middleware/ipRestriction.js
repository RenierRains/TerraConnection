const allowedIPs = ['127.0.0.1']; //request static ip from network ####

function ipRestriction(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  console.log('Client IP:', clientIP);

  if (allowedIPs.includes(clientIP)) {
    next();
  } else {
    console.warn('Unauthorized IP attempt:', clientIP);
    res.status(403).send('Access denied: unauthorized IP address.');
  }
}

module.exports = ipRestriction;
