const allowedIPs = ['127.0.0.1']; //request static ip from network ####

function ipRestriction(req, res, next) {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                  req.headers['x-real-ip'] || 
                  req.ip || 
                  req.connection.remoteAddress;

  console.log('IP Detection Details:', {
    'X-Forwarded-For': req.headers['x-forwarded-for'],
    'X-Real-IP': req.headers['x-real-ip'],
    'req.ip': req.ip,
    'remoteAddress': req.connection.remoteAddress,
    'Final detected IP': clientIP
  });

  if (allowedIPs.includes(clientIP)) {
    next();
  } else {
    console.warn('Unauthorized IP attempt:', clientIP);
    res.status(403).send('Access denied: unauthorized IP address.');
  }
}

module.exports = ipRestriction;
