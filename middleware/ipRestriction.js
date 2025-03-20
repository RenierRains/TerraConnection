const allowedIPs = ['127.0.0.1', '175.176.0.31']; //request static ip from network ####

function ipRestriction(req, res, next) {
  console.log('All Request Headers:', req.headers);
  
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIp = req.headers['x-real-ip'];
  const socketRemoteAddr = req.socket?.remoteAddress;
  
  const clientIP = xForwardedFor?.split(',').map(ip => ip.trim())[0] || 
                  xRealIp || 
                  req.ip || 
                  socketRemoteAddr ||
                  req.connection.remoteAddress;

  const cleanIP = clientIP?.replace(/^::ffff:/, '');
                  
  console.log('Detailed IP Detection:', {
    'Raw Headers': {
      'X-Forwarded-For': xForwardedFor,
      'X-Real-IP': xRealIp
    },
    'Socket Remote Address': socketRemoteAddr,
    'Express req.ip': req.ip,
    'Connection Remote Address': req.connection.remoteAddress,
    'Final Raw IP': clientIP,
    'Clean IP': cleanIP
  });

  if (allowedIPs.includes(cleanIP)) {
    console.log('Access granted for IP:', cleanIP);
    next();
  } else {
    console.warn('Unauthorized IP attempt:', cleanIP);
    res.status(403).send('Access denied: unauthorized IP address.');
  }
}

module.exports = ipRestriction;
