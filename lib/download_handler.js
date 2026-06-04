/**
 * Log download click then redirect to installer URL (GitHub release or env override).
 */
const github = require("./github_releases");
const analytics = require("./analytics_store");
const { countryFromIp } = require("./geoip");

async function resolveDownloadTarget(versionQuery) {
  const gh = await github.fetchLatestRelease();
  const fallback = {
    version: process.env.BETA_VERSION || versionQuery || "1.0.0-beta.1",
    downloadUrl:
      process.env.BETA_INSTALLER_URL ||
      process.env.DOWNLOAD_REDIRECT_URL ||
      "https://github.com/Lordsleezy/SentinelAI/releases/latest/download/SentinelAISetup.exe",
    installerName: "SentinelAISetup.exe",
  };
  if (gh.ok && gh.downloadUrl) {
    return {
      version: gh.version || fallback.version,
      downloadUrl: gh.downloadUrl,
      installerName: gh.installerName || fallback.installerName,
    };
  }
  return fallback;
}

async function handleDownloadRequest({ ip, userAgent, referrer, version, channel }) {
  const target = await resolveDownloadTarget(version);
  const country = await countryFromIp(ip);
  analytics.recordDownloadEvent({
    ip_address: ip,
    user_agent: userAgent,
    country,
    referrer: referrer || null,
    version: version || target.version,
    channel: channel || "windows",
  });
  return target;
}

module.exports = { handleDownloadRequest, resolveDownloadTarget };
