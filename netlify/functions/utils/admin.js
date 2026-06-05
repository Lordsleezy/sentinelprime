const crypto = require("crypto");
const { cookie } = require("./http");

const SESSION_TTL_SECONDS = 86400;

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value) {
  if (!process.env.ADMIN_PASSWORD) throw new Error("Admin password is not configured");
  return crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(value).digest("base64url");
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createAdminSessionToken(email) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url({
    sub: String(email || "").toLowerCase(),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString("base64url")
  });
  return `${payload}.${sign(payload)}`;
}

async function verifyAdminSession(event) {
  const token = cookie(event, "admin_token");
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeEqual(signature, sign(payload))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase();
    const expiresAt = Number(session.exp || 0);
    return Boolean(adminEmail && session.sub === adminEmail && expiresAt > Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

module.exports = { SESSION_TTL_SECONDS, createAdminSessionToken, timingSafeEqual, verifyAdminSession };
