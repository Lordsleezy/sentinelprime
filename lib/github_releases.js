/** Fetch latest GitHub Release for beta download portal. */
async function fetchLatestRelease() {
  const repo = process.env.GITHUB_REPO || "Lordsleezy/SentinelAI";
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "SentinelPrime-Site",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (!res.ok) {
    return { ok: false, error: `GitHub API ${res.status}` };
  }
  const data = await res.json();
  const assets = data.assets || [];
  const installer =
    assets.find(a => /SentinelAISetup\.exe$/i.test(a.name)) ||
    assets.find(a => /\.exe$/i.test(a.name)) ||
    assets[0];

  return {
    ok: true,
    version: (data.tag_name || "").replace(/^v/, ""),
    tag_name: data.tag_name,
    name: data.name,
    published_at: data.published_at,
    body: data.body || "",
    downloadUrl: installer?.browser_download_url || data.html_url,
    installerName: installer?.name || "SentinelAISetup.exe",
    size_bytes: installer?.size,
  };
}

module.exports = { fetchLatestRelease };
