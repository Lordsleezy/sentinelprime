/** Best-effort client IP (Netlify, reverse proxies, local dev). */
function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (
    req.headers["x-nf-client-connection-ip"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.ip ||
    ""
  );
}

function clientIpFromNetlifyEvent(event) {
  const h = event.headers || {};
  const xf = h["x-forwarded-for"] || h["X-Forwarded-For"];
  if (xf) return String(xf).split(",")[0].trim();
  return h["client-ip"] || h["x-nf-client-connection-ip"] || "";
}

module.exports = { clientIp, clientIpFromNetlifyEvent };
