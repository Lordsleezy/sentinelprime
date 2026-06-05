const { json, method, parseBody } = require("./utils/http");
const { SESSION_TTL_SECONDS, createAdminSessionToken, timingSafeEqual } = require("./utils/admin");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { email, password } = parseBody(event);
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return json(503, { error: "Admin login is not configured yet." });

  const validEmail = String(email || "").toLowerCase() === adminEmail.toLowerCase();
  const validPassword = timingSafeEqual(password, adminPassword);
  if (!validEmail || !validPassword) {
    return json(401, { error: "Invalid credentials" });
  }

  const token = createAdminSessionToken(adminEmail);
  return json(
    200,
    { success: true, token, expires_in: SESSION_TTL_SECONDS },
    { "Set-Cookie": `admin_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}; Path=/` }
  );
};
