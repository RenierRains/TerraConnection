const net = require('net');
const db = require('../models');

const FALLBACK_IPS = (process.env.ALLOWED_IP_FALLBACK || process.env.ALLOWED_IPS || '127.0.0.1,::1,175.176.0.31,192.168.10.128')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

const CACHE_TTL_MS = Number(process.env.ALLOWED_IP_CACHE_TTL_MS || 5 * 60 * 1000);
const CACHE_REFRESH_INTERVAL_MS = Number(process.env.ALLOWED_IP_CACHE_REFRESH_MS || 5 * 60 * 1000);

let cache = {
  ips: new Set(FALLBACK_IPS),
  loaded: false,
  lastLoadedAt: 0,
  error: null
};

let refreshPromise = null;

async function loadAllowedIPs({ force = false } = {}) {
  if (!force && cache.loaded && (Date.now() - cache.lastLoadedAt) < CACHE_TTL_MS) {
    return cache.ips;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const records = await db.Allowed_IP.findAll({
        where: { is_active: true },
        attributes: ['ip_address']
      });

      if (records.length > 0) {
        cache.ips = new Set(records.map(record => record.ip_address));
      } else if (cache.ips.size === 0) {
        cache.ips = new Set(FALLBACK_IPS);
      }

      cache.loaded = true;
      cache.lastLoadedAt = Date.now();
      cache.error = null;
    } catch (error) {
      console.error('Failed to refresh allowed IPs from database:', error);
      cache.error = error;
      cache.loaded = true;
      cache.lastLoadedAt = Date.now();

      if (cache.ips.size === 0) {
        cache.ips = new Set(FALLBACK_IPS);
      }
    } finally {
      refreshPromise = null;
    }

    return cache.ips;
  })();

  return refreshPromise;
}

if (CACHE_REFRESH_INTERVAL_MS > 0) {
  setInterval(() => {
    loadAllowedIPs({ force: true }).catch(error => {
      console.error('Scheduled allowed IP refresh failed:', error);
    });
  }, CACHE_REFRESH_INTERVAL_MS).unref();
}

async function ensureCacheLoaded() {
  if (!cache.loaded) {
    await loadAllowedIPs({ force: true });
  }
  return cache.ips;
}

async function ipRestriction(req, res, next) {
  try {
    const allowedSet = await ensureCacheLoaded();

    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIp = req.headers['x-real-ip'];
    const socketRemoteAddr = req.socket?.remoteAddress;

    const clientIP = xForwardedFor?.split(',').map(ip => ip.trim())[0] ||
                    xRealIp ||
                    req.ip ||
                    socketRemoteAddr ||
                    req.connection?.remoteAddress;

    const cleanIP = clientIP?.replace(/^::ffff:/, '');

    if (cleanIP && net.isIP(cleanIP) !== 0 && allowedSet.has(cleanIP)) {
      return next();
    }

    console.warn('Unauthorized IP attempt:', {
      attemptedIP: cleanIP,
      original: clientIP,
      headers: {
        'x-forwarded-for': xForwardedFor,
        'x-real-ip': xRealIp
      }
    });

    res.status(403).send('Access denied: unauthorized IP address.');
  } catch (error) {
    console.error('IP restriction middleware error:', error);
    res.status(500).send('Access denied: failed to evaluate IP restrictions.');
  }
}

function clearAllowedIpCache() {
  cache = {
    ips: new Set(FALLBACK_IPS),
    loaded: false,
    lastLoadedAt: 0,
    error: null
  };
}

async function refreshAllowedIpCache() {
  clearAllowedIpCache();
  await loadAllowedIPs({ force: true });
}

function getAllowedIpCacheMetadata() {
  return {
    count: cache.ips.size,
    loaded: cache.loaded,
    lastLoadedAt: cache.lastLoadedAt,
    error: cache.error ? cache.error.message : null,
    source: cache.error ? 'fallback' : (cache.loaded ? 'database' : 'fallback')
  };
}

function getFallbackIPs() {
  return [...FALLBACK_IPS];
}

module.exports = {
  ipRestriction,
  clearAllowedIpCache,
  refreshAllowedIpCache,
  getAllowedIpCacheMetadata,
  getFallbackIPs
};
