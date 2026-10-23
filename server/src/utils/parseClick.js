const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

// Get the visitor's real IP (works behind a proxy/host like Render)
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
  // IPv6-mapped IPv4 looks like "::ffff:1.2.3.4", strip the prefix
  if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
};

// Reduce a full referrer URL to just its domain, e.g. "https://www.google.com/search?q=x" -> "google.com"
const getReferrerDomain = (referer) => {
  if (!referer) return 'direct';
  try {
    return new URL(referer).hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }
};

const parseClick = (req) => {
  const parser = new UAParser(req.headers['user-agent']);
  const ua = parser.getResult();
  const geo = geoip.lookup(getClientIp(req));

  return {
    device: ua.device.type || 'desktop', // ua-parser leaves type empty for desktops
    browser: ua.browser.name || 'unknown',
    os: ua.os.name || 'unknown',
    referrer: getReferrerDomain(req.headers.referer),
    country: geo?.country || 'unknown',
    city: geo?.city || 'unknown',
  };
};

module.exports = parseClick;