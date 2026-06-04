/**
 * Resolve ISO country code from IP (non-blocking, best-effort).
 * No personal data stored beyond country code.
 */
async function countryFromIp(ip) {
  const clean = (ip || "").replace(/^::ffff:/, "").trim();
  if (!clean || clean === "127.0.0.1" || clean.startsWith("192.168.") || clean.startsWith("10.")) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(clean)}/country_code/`, {
      signal: controller.signal,
      headers: { "User-Agent": "SentinelPrime-Analytics/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.length === 2 ? text.toUpperCase() : null;
  } catch {
    return null;
  }
}

module.exports = { countryFromIp };
